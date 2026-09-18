#!/usr/bin/env node
/**
 * TaskFlow come connettore MCP: le tue attivita' dentro Claude.
 *
 * Quello che risolve: fin qui, per far lavorare un modello su un'attivita'
 * assegnata, bisognava copiarne a mano titolo e descrizione nella
 * conversazione, e poi tornare nell'applicazione a segnare cosa era stato
 * fatto. Due travasi manuali, entrambi facili da sbagliare e impossibili da
 * verificare. Con questo server le attivita' sono li' dentro, e il risultato
 * torna indietro per la stessa strada.
 *
 * ## Gira con i TUOI permessi, non con quelli del server
 *
 * Riusa `taskflowCore.mjs`, quindi parla a PostgREST con il token dell'utente
 * che ha fatto `accedi` — non con il service role. Ne segue la cosa piu'
 * importante di questo file: **un modello qui dentro non puo' fare niente che
 * tu non potresti fare dal browser.** Le policy RLS e i trigger sono gli
 * stessi; se un'attivita' e' bloccata da un'altra, il database rifiuta la
 * chiusura a lui come la rifiuterebbe a te.
 *
 * Non c'e' nessuna chiave di servizio in questo processo, e non c'e' niente da
 * configurare oltre alla sessione che la CLI ha gia' salvato.
 *
 * ## Perche' stdio e non HTTP
 *
 * Il server gira sulla macchina di chi lo usa, avviato da Claude Desktop, e
 * legge la sessione da `~/.config/taskflow/`. Un trasporto HTTP vorrebbe dire
 * esporre una porta e inventarsi un'autenticazione propria: esattamente il
 * pezzo che qui non serve, perche' l'autenticazione ce l'ha gia' il file di
 * sessione.
 *
 * ATTENZIONE, su stdio: lo standard output E' il canale del protocollo. Una
 * sola `console.log` di troppo rompe la conversazione fra client e server. In
 * questo file si scrive solo su stderr, e solo quando serve.
 *
 * ## Installazione
 *
 *   node scripts/taskflow.mjs accedi        (una volta, se non l'hai gia' fatto)
 *   node scripts/mcp/taskflow.mjs --installa
 *
 * e poi si riavvia Claude Desktop.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import {
  ErroreUtente,
  aggiungiNota,
  attendeIlVisto,
  apriSessione,
  bloccantiApertiPerTask,
  cambiaStato,
  configurazione,
  dettaglioTask,
  eChiusaDavvero,
  improntaSessione,
  mieAttivita,
  organizzazione,
  staPerScadere,
} from '../taskflowCore.mjs';

const QUESTO = fileURLToPath(import.meta.url);

/* -------------------------------------------------------------------------- */
/* Sessione                                                                   */
/* -------------------------------------------------------------------------- */

/*
  La sessione si apre alla PRIMA chiamata, non all'avvio.

  Se si aprisse all'avvio, chi non ha ancora fatto `accedi` vedrebbe il server
  morire subito e Claude direbbe soltanto "connettore non disponibile" — un
  messaggio che non dice cosa fare. Aprendola qui, l'errore arriva come
  risposta a uno strumento, con dentro il comando esatto da eseguire.

  Si tiene in cache perche' ogni apertura brucia un token di rinnovo (Supabase
  li ruota), e una conversazione fa molte chiamate.
*/
let inCache = null;

/*
  La sessione si riapre PRIMA che il token scada, non quando fallisce.

  Questo processo vive quanto Claude Desktop, cioe' giorni, mentre il token di
  accesso dura un'ora: tenendolo finche' non falliva, la prima chiamata dopo la
  scadenza tornava un errore di autenticazione e chi aveva chiesto qualcosa
  doveva chiederlo una seconda volta. Il margine e il motivo per cui NON c'e'
  un "riprova una volta" stanno accanto a `staPerScadere`, nel nucleo.
*/
async function contesto({ perScrivere = false } = {}) {
  /*
    Prima di tutto: la sessione salvata e' ancora QUELLA?

    La cache qui sopra vale finche' il token non sta per scadere, e un token
    dura un'ora. Ma `esci` e un nuovo `accedi` non toccano questo processo:
    riscrivono il file, e basta. Senza questo confronto, chi usciva restava
    dentro per il resto dell'ora — revocare il rinnovo non spegne il token di
    accesso gia' emesso — e chi entrava con un altro account continuava a
    vedere e a modificare le attivita' del precedente.

    Il confronto costa la lettura di un file piccolo per chiamata, e toglie
    l'unico modo in cui questo server poteva agire per conto di qualcuno che se
    n'era andato.
  */
  if (inCache && inCache.impronta !== improntaSessione()) inCache = null;

  if (inCache && !staPerScadere(inCache.sessione)) {
    if (!perScrivere) return inCache;

    /*
      Prima di SCRIVERE, l'appartenenza si rilegge.

      La sessione si puo' tenere — un token vale un'ora e non cambia — ma le
      deroghe ai permessi no: stanno in `organization_members`, un
      amministratore le cambia quando vuole, e questo processo vive quanto
      Claude Desktop. Tenendo in cache anche quelle, un permesso tolto restava
      aggirabile fino al rinnovo del token, cioe' fino a un'ora dopo. E il
      database non aiuta a recuperare: la policy di UPDATE le deroghe non le
      guarda proprio (vedi `derogaNega` nel nucleo).

      Una lettura in piu' per ogni scrittura, nessuna per le letture. E' il
      prezzo giusto: chi legge non fa danni, e una revoca deve valere quando
      viene fatta, non quando scade un token.
    */
    inCache = {
      ...inCache,
      org: await organizzazione(inCache.cfg, inCache.sessione),
    };
    return inCache;
  }

  // Si riparte da zero, non solo dal token: cambiando sessione cambia anche
  // chi sei, e l'organizzazione va riletta con il token nuovo.
  inCache = null;

  const cfg = configurazione();
  const sessione = await apriSessione(cfg);
  const org = await organizzazione(cfg, sessione);
  // L'impronta si prende DOPO l'apertura: aprendo, il nucleo riscrive il file
  // con il rinnovo ruotato. Prenderla prima vorrebbe dire trovarla gia'
  // diversa alla chiamata successiva, e buttare la cache a ogni giro.
  inCache = { cfg, sessione, org, impronta: improntaSessione() };
  return inCache;
}

/** Un errore che l'utente puo' risolvere diventa testo, non un crollo. */
async function conErrori(azione) {
  try {
    return await azione();
  } catch (errore) {
    // La sessione potrebbe essere appena scaduta: la prossima chiamata
    // riprovera' da capo invece di riusare un contesto morto.
    if (errore instanceof ErroreUtente) inCache = null;
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text:
            errore instanceof ErroreUtente
              ? errore.message
              : `Non sono riuscito a completare l'operazione: ${errore?.message ?? errore}`,
        },
      ],
    };
  }
}

const testo = (t, dati) => ({
  content: [{ type: 'text', text: t }],
  ...(dati ? { structuredContent: dati } : {}),
});

/* -------------------------------------------------------------------------- */
/* Strumenti                                                                  */
/* -------------------------------------------------------------------------- */

const server = new McpServer({ name: 'taskflow', version: '1.0.0' });

server.registerTool(
  'taskflow_elenco_task',
  {
    title: 'Le mie attivita\'',
    description:
      'Elenca le attivita\' di TaskFlow assegnate alla persona che ha fatto ' +
      'l\'accesso. Restituisce identificativo, titolo, stato e scadenza. ' +
      'Usa taskflow_leggi_task per avere descrizione e sottoattivita\' di una.',
    inputSchema: {
      includiChiuse: z
        .boolean()
        .optional()
        .describe('Se true include anche le attivita\' gia\' chiuse. Predefinito: false.'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  },
  async ({ includiChiuse = false }) =>
    conErrori(async () => {
      const { cfg, sessione, org } = await contesto();
      const tutte = await mieAttivita(cfg, sessione, org);
      const scelte = includiChiuse ? tutte : tutte.filter((t) => !eChiusaDavvero(t));

      if (!scelte.length) {
        return testo(
          includiChiuse
            ? `Nessuna attivita' assegnata a te in ${org.name}.`
            : `Nessuna attivita' aperta assegnata a te in ${org.name}.`,
          { organizzazione: org.name, task: [] }
        );
      }

      /*
        I bloccanti si contano APERTI, non a legami.

        `blocked_by` conserva anche i bloccanti gia' chiusi e vistati: contarne
        la lunghezza faceva comparire "(bloccata da 2)" accanto a un lavoro su
        cui si poteva partire subito — e a un modello che sceglie cosa fare,
        quella riga dice "salta questa". Stesso difetto gia' corretto nel testo
        pronto e nel dettaglio: qui era la terza strada.
      */
      const aperti = await bloccantiApertiPerTask(cfg, sessione, org, scelte);

      const righe = scelte.map((t) => ({
        id: t.id,
        titolo: t.title,
        stato: t.status,
        scadenza: t.due_date ? t.due_date.slice(0, 10) : null,
        attendeApprovazione: attendeIlVisto(t),
        bloccataDa: aperti.get(t.id) ?? 0,
      }));

      const elenco = righe
        .map(
          (r) =>
            `- ${r.id}  [${r.stato}]  ${r.scadenza ?? 'senza scadenza'}  ${r.titolo}` +
            (r.attendeApprovazione ? '  (attende il visto)' : '') +
            (r.bloccataDa ? `  (bloccata da ${r.bloccataDa})` : '')
        )
        .join('\n');

      return testo(`${org.name} — ${righe.length} attivita':\n${elenco}`, {
        organizzazione: org.name,
        task: righe,
      });
    })
);

server.registerTool(
  'taskflow_leggi_task',
  {
    title: 'Leggi un\'attivita\'',
    description:
      'Il contenuto completo di una attivita\': descrizione, sottoattivita\', ' +
      'priorita\', etichette, commenti e quali altre attivita\' la bloccano. ' +
      'L\'identificativo puo\' essere parziale, bastano le prime lettere.',
    inputSchema: {
      id: z
        .string()
        .min(2)
        .describe('Identificativo, anche solo le prime lettere (es. "3f2a").'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  },
  async ({ id }) =>
    conErrori(async () => {
      const { cfg, sessione, org } = await contesto();
      const { task, bloccanti } = await dettaglioTask(cfg, sessione, org, id);

      const sottoattivita = Array.isArray(task.subtasks) ? task.subtasks : [];
      const commenti = Array.isArray(task.comments) ? task.comments : [];

      const parti = [
        `# ${task.title}`,
        /*
          "attende il visto" accanto allo stato, come nell'elenco.

          Senza, il dettaglio diceva `Stato: completed` e basta: chi legge —
          una persona o un modello — ne concludeva che il lavoro fosse finito,
          mentre per il resto del prodotto e' ancora aperto. E' l'unica riga in
          cui quella differenza si puo' dire.
        */
        `Stato: ${task.status}${attendeIlVisto(task) ? ' (attende il visto)' : ''}` +
          `   Priorita': ${task.priority ?? '—'}   Scadenza: ${
            task.due_date ? task.due_date.slice(0, 10) : 'nessuna'
          }`,
      ];
      if (task.department) parti.push(`Reparto: ${task.department}`);
      if (Array.isArray(task.labels) && task.labels.length) {
        parti.push(`Etichette: ${task.labels.join(', ')}`);
      }
      parti.push('', task.description?.trim() || '(nessuna descrizione)');

      if (sottoattivita.length) {
        parti.push('', 'Passi:');
        for (const p of sottoattivita) {
          parti.push(`  [${p.done ? 'x' : ' '}] ${p.title ?? ''}`);
        }
      }

      if (bloccanti.length) {
        // Si dice CHE COSA blocca, non quante: "bloccata da 2" non aiuta a
        // decidere se val la pena cominciare.
        parti.push('', 'Bloccata da:');
        for (const b of bloccanti) parti.push(`  - ${b.title} [${b.status}]`);
      }

      if (commenti.length) {
        const ultimi = commenti.slice(-5);
        parti.push('', `Commenti (ultimi ${ultimi.length} di ${commenti.length}):`);
        for (const c of ultimi) {
          parti.push(`  ${c.userName ?? 'qualcuno'}: ${c.content ?? ''}`);
        }
      }

      return testo(parti.join('\n'), {
        id: task.id,
        titolo: task.title,
        stato: task.status,
        attendeApprovazione: attendeIlVisto(task),
        priorita: task.priority ?? null,
        scadenza: task.due_date ?? null,
        descrizione: task.description ?? null,
        sottoattivita,
        bloccataDa: bloccanti.map((b) => ({ id: b.id, titolo: b.title, stato: b.status })),
      });
    })
);

server.registerTool(
  'taskflow_cambia_stato',
  {
    title: 'Cambia lo stato di un\'attivita\'',
    description:
      'Sposta un\'attivita\' fra "non-iniziata", "in-corso", "bloccata" e ' +
      '"completata", con una nota facoltativa su cosa e\' stato fatto. ' +
      'Scrive la cronologia e manda le notifiche IN APP a chi segue ' +
      'l\'attivita\', a chi ce l\'ha in carico e a chi l\'aveva chiesta. ' +
      'Non manda le email e non riconosce le menzioni con @: per quelle serve ' +
      'l\'interfaccia. Le regole restano quelle del database: un\'attivita\' ' +
      'bloccata da un\'altra non si puo\' completare.',
    inputSchema: {
      id: z.string().min(2).describe('Identificativo, anche parziale.'),
      stato: z
        .enum(['non-iniziata', 'in-corso', 'bloccata', 'completata'])
        .describe('Il nuovo stato.'),
      nota: z
        .string()
        .optional()
        .describe('Cosa e\' stato fatto. Diventa un commento visibile a tutti.'),
    },
    /*
      NON idempotente, e la ragione e' la nota.

      Ripetere il solo cambio di stato non farebbe danni. Ma con `nota` ogni
      chiamata aggiunge un commento e una riga di cronologia, anche quando lo
      stato e' gia' quello: dichiararla idempotente inviterebbe un client a
      ritentare dopo un timeout e a lasciare due volte lo stesso commento.
    */
    /*
      `destructiveHint: true`, e non e' una formalita'.

      Il cliente MCP usa questa annotazione per decidere se chiedere conferma
      prima di agire. Cambiare stato SOVRASCRIVE il valore precedente, e il
      trigger della 0025 azzera anche il visto gia' dato: chi aveva approvato
      il lavoro si ritrova l'approvazione cancellata. Dichiararlo additivo
      significava far saltare la domanda proprio sull'operazione che la merita.

      L'altro strumento che scrive, `taskflow_aggiungi_nota`, resta additivo:
      aggiunge un commento e non tocca niente di esistente.
    */
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  },
  async ({ id, stato, nota }) =>
    conErrori(async () => {
      const { cfg, sessione, org } = await contesto({ perScrivere: true });
      const esito = await cambiaStato(cfg, sessione, org, { pezzo: id, stato, nota });

      // Si riferisce cosa e' successo DAVVERO: quando non c'era niente da
      // cambiare lo si dice, invece di rispondere "fatto" a vuoto.
      if (!esito.cambiato && !esito.conNota) {
        return testo(
          `"${esito.task.title}" era gia' ${esito.statoNuovo}: non ho cambiato niente.`,
          { cambiato: false, conNota: false }
        );
      }

      const pezzi = [`"${esito.task.title}"`];
      pezzi.push(esito.cambiato ? `spostata su ${esito.statoNuovo}` : 'stato invariato');
      if (esito.conNota) pezzi.push('con la nota aggiunta');
      if (esito.attendeVisto) pezzi.push('— ora aspetta l\'approvazione di un responsabile');

      return testo(pezzi.join(' '), {
        cambiato: esito.cambiato,
        conNota: esito.conNota,
        statoPrecedente: esito.statoPrecedente,
        statoNuovo: esito.statoNuovo,
        attendeApprovazione: esito.attendeVisto,
      });
    })
);

server.registerTool(
  'taskflow_aggiungi_nota',
  {
    title: 'Commenta un\'attivita\'',
    description:
      'Aggiunge un commento a un\'attivita\' senza toccarne lo stato, e avvisa ' +
      'in app chi la segue e chi ce l\'ha in carico. Serve per lasciare traccia ' +
      'di cosa e\' stato fatto o di cosa manca. Scrivere "@Nome" NON avvisa ' +
      'quella persona: le menzioni le riconosce solo l\'interfaccia.',
    inputSchema: {
      id: z.string().min(2).describe('Identificativo, anche parziale.'),
      testo: z.string().min(1).describe('Il commento.'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  async ({ id, testo: contenuto }) =>
    conErrori(async () => {
      const { cfg, sessione, org } = await contesto({ perScrivere: true });
      const { task } = await aggiungiNota(cfg, sessione, org, { pezzo: id, testo: contenuto });
      return testo(`Nota aggiunta a "${task.title}".`, { id: task.id, titolo: task.title });
    })
);

/* -------------------------------------------------------------------------- */
/* Installazione in Claude Desktop                                            */
/* -------------------------------------------------------------------------- */

/**
 * Dove Claude Desktop tiene la sua configurazione, per sistema operativo.
 *
 * Se un giorno cambiasse, il comando lo dice invece di scrivere in un posto
 * sbagliato in silenzio: e' per questo che restituisce null e non un percorso
 * inventato.
 */
function percorsoConfigurazione() {
  const casa = homedir();
  switch (platform()) {
    case 'darwin':
      return resolve(casa, 'Library/Application Support/Claude/claude_desktop_config.json');
    case 'win32':
      return process.env.APPDATA
        ? resolve(process.env.APPDATA, 'Claude/claude_desktop_config.json')
        : null;
    case 'linux':
      return resolve(
        process.env.XDG_CONFIG_HOME || resolve(casa, '.config'),
        'Claude/claude_desktop_config.json'
      );
    default:
      return null;
  }
}

/**
 * L'organizzazione da fissare, presa da `--org` o dall'ambiente.
 *
 * `--org` esiste perche' l'altra strada e' sintassi POSIX: `TASKFLOW_ORG=x
 * comando` non si esegue ne' in PowerShell ne' in cmd.exe, e questo
 * installatore Windows lo supporta esplicitamente — quindi le istruzioni che
 * stampava erano ineseguibili proprio sulla piattaforma per cui esiste il
 * ramo `win32`. Un argomento vale in tutte e tre le shell.
 */
function orgChiesta() {
  const argomenti = process.argv.slice(2);
  const posizione = argomenti.indexOf('--org');
  if (posizione !== -1) {
    const valore = argomenti[posizione + 1]?.trim();
    if (!valore || valore.startsWith('--')) {
      console.error('Dopo --org serve l\'identificativo o il nome dell\'organizzazione.');
      process.exitCode = 1;
      return { errore: true };
    }
    return { valore };
  }
  const daAmbiente = process.env.TASKFLOW_ORG?.trim();
  return daAmbiente ? { valore: daAmbiente } : {};
}

/**
 * Trasforma un nome nell'identificativo, se si riesce.
 *
 * I nomi NON sono unici: solo lo slug lo e', e `organizzazione()` risolve i
 * nomi con `find()` — cioe' con due organizzazioni chiamate uguale Claude
 * Desktop si legherebbe alla prima, e la scrittura finirebbe nell'altra. Un
 * identificativo non ha questo problema.
 *
 * Serve una sessione, e qui puo' non esserci: chi installa prima di fare
 * `accedi` e' un caso normale. In quel caso si scrive cio' che e' stato dato e
 * si dice perche' sarebbe meglio l'identificativo, invece di rifiutare
 * l'installazione per una cosa che riguarda pochi.
 */
async function risolviOrg(valore) {
  /*
    Anche un identificativo si verifica, se c'e' con cosa.

    C'era una scorciatoia: forma di UUID, allora va bene. Ma la forma non dice
    che quell'organizzazione ESISTA, ne' che sia tua — un carattere sbagliato
    in un UUID resta un UUID. Il risultato era che un nome scritto male veniva
    respinto e un identificativo scritto male veniva registrato con un
    "Aggiunto", lasciando Claude Desktop configurato con un selettore che
    avrebbe fallito a ogni chiamata.

    La forma serve ancora, ma prima: e' cio' che impedisce a un testo qualunque
    di finire nel comando che l'interfaccia fa copiare. Qui invece si ha una
    sessione, e con una sessione si puo' chiedere.
  */

  /*
    Due `try` separati, e non e' pedanteria.

    Prima erano uno solo, e quel `catch` unico trattava allo stesso modo due
    situazioni opposte: "non c'e' una sessione, non posso verificare" e "c'e' la
    sessione, e quel nome NON e' tuo". Nella seconda si registrava lo stesso il
    valore sbagliato, si diceva che era andata bene, e si consigliava di fare
    l'accesso — a una persona che l'accesso ce l'aveva. Claude Desktop restava
    installato con un selettore che avrebbe fallito a ogni chiamata.

    Senza sessione si prosegue con un avviso. Con la sessione, un errore e' una
    risposta: lo si riporta e ci si ferma.
  */
  let cfg;
  let sessione;
  try {
    cfg = { ...configurazione(), org: valore };
    sessione = await apriSessione(cfg);
  } catch {
    return { id: valore, nonRisolto: true };
  }

  const org = await organizzazione(cfg, sessione);
  return { id: org.id, nome: org.name };
}

async function installa() {
  const percorso = percorsoConfigurazione();
  if (!percorso) {
    console.error(
      `Non so dove Claude Desktop tenga la configurazione su "${platform()}".\n` +
        'Aggiungi a mano, dentro "mcpServers":\n' +
        `  "taskflow": { "command": "node", "args": ["${QUESTO}"] }`
    );
    process.exitCode = 1;
    return;
  }

  /*
    Si parte da vuoto SOLO se il file non esiste.

    Prima qualunque errore finiva qui, JSON malformato compreso, e il file
    veniva poi riscritto con dentro il solo taskflow: una virgola di troppo
    nella configurazione di qualcun altro e tutti i suoi connettori sparivano
    in silenzio. Un installatore puo' rifiutarsi di procedere; non puo'
    cancellare quello che non e' riuscito a leggere.
  */
  const rifiuta = (motivo) => {
    console.error(
      `${percorso} esiste ma non e' una configurazione che posso modificare:\n  ${motivo}\n` +
        'Non lo tocco. Sistemalo e riprova, oppure aggiungi a mano dentro "mcpServers":\n' +
        `  "taskflow": { "command": "node", "args": ["${QUESTO}"] }`
    );
    process.exitCode = 1;
  };

  let impostazioni = {};
  try {
    impostazioni = JSON.parse(readFileSync(percorso, 'utf8'));
  } catch (errore) {
    if (errore?.code !== 'ENOENT') {
      rifiuta(errore?.message ?? String(errore));
      return;
    }
  }

  /*
    Leggerlo non basta: deve anche ESSERE una configurazione.

    Con la radice a `null` il codice sotto moriva con un TypeError e una pila
    di chiamate al posto di una spiegazione. Con la radice a `[]` andava
    peggio: `JSON.stringify` butta via le proprieta' aggiunte a un array,
    quindi il file veniva riscritto SENZA taskflow mentre l'installatore
    annunciava "Aggiunto". L'utente riavviava Claude Desktop e non trovava
    niente, con un messaggio di successo alle spalle a dirgli che era tutto a
    posto. Un file che non capisco si lascia dov'e'.
  */
  if (
    impostazioni === null ||
    typeof impostazioni !== 'object' ||
    Array.isArray(impostazioni)
  ) {
    rifiuta(
      `alla radice c'e' ${Array.isArray(impostazioni) ? 'un elenco' : JSON.stringify(impostazioni)}, ` +
        'mentre qui serve un oggetto JSON.'
    );
    return;
  }

  /*
    Stesso motivo, un livello piu' sotto: se `mcpServers` non e' un oggetto,
    lo sparpagliamento qui sotto lo sostituirebbe in silenzio con il solo
    taskflow. E' esattamente la perdita di connettori che si vuole evitare.
  */
  if (
    impostazioni.mcpServers !== undefined &&
    (impostazioni.mcpServers === null ||
      typeof impostazioni.mcpServers !== 'object' ||
      Array.isArray(impostazioni.mcpServers))
  ) {
    rifiuta('"mcpServers" c\'e\' ma non e\' un oggetto: non so cosa conservarci dentro.');
    return;
  }

  const gia = impostazioni.mcpServers?.taskflow;

  /*
    L'organizzazione scelta si SCRIVE qui dentro, se c'e'.

    Chi appartiene a piu' di un'organizzazione deve indicarne una, altrimenti
    ogni chiamata si ferma — giustamente: scrivere in quella sbagliata e' un
    errore che nessuno nota. Finora l'unico modo era TASKFLOW_ORG
    nell'ambiente, e li' stava il difetto: Claude Desktop lo lancia un'icona,
    non un terminale, e non eredita le variabili della shell in cui si e'
    eseguito `--installa`. Le due righe promesse nella documentazione
    funzionavano quindi solo per chi ha una sola organizzazione.

    Registrandola nell'elemento la scelta sopravvive al riavvio ed e' visibile:
    sta scritta in chiaro accanto al comando, e si cambia da li'. Chi ha
    TASKFLOW_ORG in `.env.local` non ne ha bisogno — quel file il server lo
    legge da solo, a ogni avvio.

    `env` precedente conservato: se qualcuno ci aveva aggiunto le proprie
    variabili a mano, riscriverlo intero gliele cancellerebbe.
  */
  const chiesta = orgChiesta();
  if (chiesta.errore) return;

  let risolta = null;
  if (chiesta.valore) {
    try {
      risolta = await risolviOrg(chiesta.valore);
    } catch (errore) {
      // Il messaggio del nucleo e' gia' quello giusto: dice quali sono le tue
      // organizzazioni, o elenca gli identificativi quando il nome e' ambiguo.
      console.error(`${errore.message}\n\nNon ho cambiato niente.`);
      process.exitCode = 1;
      return;
    }
  }

  const env = { ...(gia?.env ?? {}) };
  if (risolta) env.TASKFLOW_ORG = risolta.id;

  impostazioni.mcpServers = {
    ...impostazioni.mcpServers,
    taskflow: {
      command: process.execPath,
      args: [QUESTO],
      ...(Object.keys(env).length ? { env } : {}),
    },
  };

  mkdirSync(dirname(percorso), { recursive: true });
  writeFileSync(percorso, `${JSON.stringify(impostazioni, null, 2)}\n`);

  console.error(
    `${gia ? 'Aggiornato' : 'Aggiunto'} "taskflow" in ${percorso}.\n` +
      (risolta
        ? `Organizzazione fissata a ${risolta.nome ? `"${risolta.nome}" (${risolta.id})` : risolta.id}.\n` +
          (risolta.nonRisolto
            ? 'Non ho potuto verificarlo: non c\'e\' una sessione aperta. Se piu\'\n' +
              'organizzazioni hanno lo stesso nome, questo puo\' legarsi a quella\n' +
              'sbagliata — fai "accedi" e rilancia, oppure indica l\'identificativo.\n'
            : '')
        : '') +
      'Riavvia Claude Desktop, poi prova a chiedergli "quali task ho aperti?".\n' +
      (gia ? '' : 'Se non hai ancora fatto l\'accesso: node scripts/taskflow.mjs accedi\n') +
      (risolta
        ? ''
        : 'Se il tuo account appartiene a piu\' di un\'organizzazione, rilancia\n' +
          'questo comando aggiungendo --org <identificativo o nome>: Claude Desktop\n' +
          'non eredita le variabili del terminale, quindi va scritta qui dentro.\n')
  );
}

/* -------------------------------------------------------------------------- */

if (process.argv.includes('--installa')) {
  await installa();
} else {
  // Da qui in poi lo standard output appartiene al protocollo.
  await server.connect(new StdioServerTransport());
}
