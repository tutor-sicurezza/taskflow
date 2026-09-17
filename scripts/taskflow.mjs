#!/usr/bin/env node
/**
 * TaskFlow dalla riga di comando.
 *
 * Serve a dire "questa l'ho fatta, ecco cosa ho fatto" senza aprire il
 * browser, entrare, cercare l'attivita' e scriverci dentro a mano.
 *
 * PERCHE' NON PASSA DA UNA ROTTA IN api/. Le rotte serverless girano con il
 * service role, che scavalca le policy RLS e per cui `auth.uid()` e' nullo:
 * ogni regola andrebbe riscritta li' dentro, e una dimenticanza sarebbe un
 * buco. Qui invece si accede come l'utente e si parla direttamente a
 * PostgREST con il SUO token, quindi valgono esattamente le stesse policy e
 * gli stessi trigger dell'interfaccia: chi non puo' fare una cosa dal browser
 * non la puo' fare nemmeno da qui, e non perche' lo controlla questo file.
 *
 * In particolare le due regole del cambio di stato — non si completa
 * un'attivita' che ne aspetta altre, e il cambio di stato azzera il visto
 * precedente — stanno nel database dalla migrazione 0025. Questo programma
 * non le ricontrolla: le SUBISCE, come deve.
 *
 * Quello che invece fa, perche' il database non lo fa al posto suo, e'
 * scrivere la riga di cronologia e le notifiche, cosi' che un'attivita'
 * chiusa da qui sia indistinguibile da una chiusa dall'interfaccia.
 *
 * Uso:
 *   node scripts/taskflow.mjs accedi          (una volta sola)
 *   node scripts/taskflow.mjs elenco
 *   node scripts/taskflow.mjs stato <id> <stato> [nota]
 *   node scripts/taskflow.mjs nota  <id> <testo>
 *   node scripts/taskflow.mjs esci
 *
 * L'accesso si fa una volta: `accedi` chiede email e password, e da li' in poi
 * i comandi non chiedono piu' niente. Cio' che resta su disco e' il token di
 * RINNOVO, in un file leggibile solo dal proprietario e fuori dal repository;
 * il token di accesso, che dura un'ora, viene chiesto al momento e non viene
 * mai scritto da nessuna parte. Per le esecuzioni automatiche restano
 * TASKFLOW_EMAIL e TASKFLOW_PASSWORD nell'ambiente.
 */

import { randomUUID } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* -------------------------------------------------------------------------- */
/* Configurazione                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Legge `.env.local` senza dipendenze.
 *
 * Volutamente minimale: `CHIAVE=valore`, righe vuote e commenti saltati,
 * virgolette tolte. Non e' un parser di dotenv completo e non deve esserlo —
 * i valori che servono qui sono quattro e li scrive una persona.
 */
function leggiEnvLocale() {
  const valori = {};
  let testo;
  try {
    testo = readFileSync(resolve(RADICE, '.env.local'), 'utf8');
  } catch {
    return valori;
  }
  for (const riga of testo.split('\n')) {
    const pulita = riga.trim();
    if (!pulita || pulita.startsWith('#')) continue;
    const taglio = pulita.indexOf('=');
    if (taglio === -1) continue;
    const chiave = pulita.slice(0, taglio).trim();
    let valore = pulita.slice(taglio + 1).trim();
    if (
      (valore.startsWith('"') && valore.endsWith('"')) ||
      (valore.startsWith("'") && valore.endsWith("'"))
    ) {
      valore = valore.slice(1, -1);
    }
    valori[chiave] = valore;
  }
  return valori;
}

function configurazione() {
  const file = leggiEnvLocale();
  // L'ambiente ha la precedenza sul file: e' cio' che permette di usare un
  // account diverso per una singola chiamata senza toccare `.env.local`.
  const prendi = (chiave) => process.env[chiave] ?? file[chiave];

  const url = prendi('VITE_SUPABASE_URL') ?? prendi('SUPABASE_URL');
  const chiave = prendi('VITE_SUPABASE_PUBLISHABLE_KEY') ?? prendi('SUPABASE_ANON_KEY');
  const email = prendi('TASKFLOW_EMAIL');
  const password = prendi('TASKFLOW_PASSWORD');
  const org = prendi('TASKFLOW_ORG');

  /*
    Email e password NON sono piu' obbligatorie.

    Prima lo erano, e significava rimetterle nell'ambiente a ogni comando: la
    strada piu' breve per trovarsele scritte in chiaro in uno script di comodo.
    Ora il caso normale e' `accedi` una volta, e da li' in poi vale la sessione
    salvata. Le credenziali nell'ambiente restano utili per due cose: il primo
    accesso senza digitare, e le esecuzioni automatiche dove non c'e' nessuno a
    rispondere a una domanda.

    L'indirizzo del progetto e la chiave pubblica, invece, servono sempre: se
    non sono nell'ambiente si prendono dalla sessione salvata, cosi' il comando
    funziona anche da una cartella qualunque, fuori dal repository.
  */
  const salvata = leggiSessioneSalvata();
  const urlFinale = url ?? salvata?.url;
  const chiaveFinale = chiave ?? salvata?.chiave;

  if (!urlFinale || !chiaveFinale) {
    /*
      Il messaggio mette per primo `accedi`, non le variabili d'ambiente.

      Si arriva qui in due casi, e uno solo e' un problema di configurazione:
      chi non ha mai fatto l'accesso, e chi lo ha appena chiuso con `esci`
      trovandosi fuori dal repository. Per entrambi la cosa da fare e' la
      stessa, ed e' una sola parola.
    */
    throw new ErroreUtente(
      'Nessuna sessione, e non so a quale progetto collegarmi.\n' +
        'Esegui "accedi" da dentro il repository, dove c\'e\' .env.local.\n' +
        'Altrimenti metti VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY\n' +
        "nell'ambiente."
    );
  }

  return { url: urlFinale.replace(/\/+$/, ''), chiave: chiaveFinale, email, password, org };
}

/* -------------------------------------------------------------------------- */
/* Sessione salvata                                                           */
/* -------------------------------------------------------------------------- */

/*
  Dove vive la sessione, e perche' non nel repository.

  Sta nella cartella di configurazione dell'utente e non accanto al codice per
  due motivi. Il primo e' che non puo' finire in un commit nemmeno per
  distrazione. Il secondo e' che cosi' il comando funziona da qualunque
  cartella, non solo da dentro il progetto.

  Il file contiene il token di RINNOVO, non quello di accesso. E' una
  differenza che conta: il token di accesso dura un'ora e non serve tenerlo, il
  token di rinnovo e' invece una credenziale a lunga vita — chi legge quel file
  puo' agire come te finche' non fai `esci`. Per questo la cartella nasce 700 e
  il file 600, e per questo `esci` esiste.
*/
const CARTELLA_SESSIONE = resolve(
  process.env.XDG_CONFIG_HOME || resolve(homedir(), '.config'),
  'taskflow'
);
const FILE_SESSIONE = resolve(CARTELLA_SESSIONE, 'sessione.json');

function leggiSessioneSalvata() {
  try {
    return JSON.parse(readFileSync(FILE_SESSIONE, 'utf8'));
  } catch {
    // File assente o illeggibile: si comporta come "nessuna sessione", che e'
    // uno stato normale e non un errore.
    return null;
  }
}

function salvaSessione(dati) {
  mkdirSync(CARTELLA_SESSIONE, { recursive: true, mode: 0o700 });
  writeFileSync(FILE_SESSIONE, JSON.stringify(dati, null, 2) + '\n', { mode: 0o600 });
  // Di nuovo, esplicitamente: `mode` in writeFileSync vale solo se il file
  // viene creato ora. Se esisteva gia' con permessi larghi, resterebbe largo.
  chmodSync(FILE_SESSIONE, 0o600);
}

function dimenticaSessione() {
  try {
    rmSync(FILE_SESSIONE);
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Domande all'utente                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Chiede una riga, eventualmente senza mostrarla.
 *
 * `nascosto` serve per la password: senza, resterebbe scritta sullo schermo e
 * nella finestra di chi passa. Il prompt viene stampato a mano PRIMA di aprire
 * la lettura, e poi ogni eco viene soppressa — `_writeToOutput` e' interno a
 * Node e non documentato, ma e' il modo con cui questo si fa da sempre, e qui
 * l'alternativa sarebbe una dipendenza in piu' per quattro righe.
 */
function chiedi(domanda, { nascosto = false } = {}) {
  if (!process.stdin.isTTY) {
    throw new ErroreUtente(
      'Serve un terminale per rispondere.\n' +
        'Per le esecuzioni automatiche usa TASKFLOW_EMAIL e TASKFLOW_PASSWORD.'
    );
  }
  return new Promise((risolvi) => {
    process.stdout.write(domanda);
    const lettore = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (nascosto) lettore._writeToOutput = () => {};
    lettore.question('', (risposta) => {
      lettore.close();
      if (nascosto) process.stdout.write('\n');
      risolvi(risposta.trim());
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Rete                                                                       */
/* -------------------------------------------------------------------------- */

/** Un errore che va mostrato all'utente cosi' com'e', senza traccia di stack. */
class ErroreUtente extends Error {}

async function chiamata(cfg, percorso, opzioni = {}) {
  const risposta = await fetch(`${cfg.url}${percorso}`, {
    ...opzioni,
    headers: {
      apikey: cfg.chiave,
      authorization: `Bearer ${opzioni.token ?? cfg.chiave}`,
      'content-type': 'application/json',
      ...(opzioni.headers ?? {}),
    },
  });

  const testo = await risposta.text();
  let corpo = null;
  if (testo) {
    try {
      corpo = JSON.parse(testo);
    } catch {
      corpo = testo;
    }
  }

  if (!risposta.ok) {
    // Il messaggio del database e' piu' utile del codice HTTP: e' quello che
    // dice "Prima vanno chiuse: X" invece di un 400 muto.
    const messaggio =
      (corpo && (corpo.message || corpo.msg || corpo.error_description || corpo.error)) ||
      `richiesta fallita (${risposta.status})`;
    throw new ErroreUtente(messaggio);
  }
  return corpo;
}

function daRisposta(dati) {
  if (!dati?.access_token) throw new ErroreUtente('Accesso non riuscito');
  return { token: dati.access_token, rinnovo: dati.refresh_token, utente: dati.user };
}

async function accediConPassword(cfg, email, password) {
  return daRisposta(
    await chiamata(cfg, '/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  );
}

async function accediConRinnovo(cfg, rinnovo) {
  return daRisposta(
    await chiamata(cfg, '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: rinnovo }),
    })
  );
}

/**
 * La sessione da usare per questo comando, nell'ordine in cui conviene.
 *
 * Prima la sessione salvata, che e' il caso normale dopo `accedi`. Poi le
 * credenziali nell'ambiente, che servono a chi automatizza. Se non c'e' ne'
 * l'una ne' le altre, si dice cosa fare invece di dare un errore di rete.
 */
async function apriSessione(cfg) {
  const salvata = leggiSessioneSalvata();

  if (salvata?.rinnovo) {
    try {
      const sessione = await accediConRinnovo(cfg, salvata.rinnovo);
      /*
        Supabase RUOTA il token di rinnovo a ogni uso: quello vecchio viene
        speso. Se non si salva subito il nuovo, il comando dopo trova in mano
        un token gia' consumato e sembra che la sessione sia scaduta da sola.
      */
      salvaSessione({ ...salvata, rinnovo: sessione.rinnovo });
      return sessione;
    } catch {
      // Scaduta, revocata, o spesa da un altro comando in parallelo. Non e' un
      // guasto: si ricade sulle credenziali, e se non ci sono si dice come
      // rientrare, invece di ripetere il messaggio del server.
      if (!(cfg.email && cfg.password)) {
        throw new ErroreUtente(
          'La sessione salvata non vale piu\'. Esegui di nuovo "accedi".'
        );
      }
    }
  }

  if (cfg.email && cfg.password) {
    return accediConPassword(cfg, cfg.email, cfg.password);
  }

  throw new ErroreUtente(
    'Nessuna sessione.\nEsegui "node scripts/taskflow.mjs accedi" una volta sola.'
  );
}

const rest = (cfg, sessione, percorso, opzioni = {}) =>
  chiamata(cfg, `/rest/v1${percorso}`, { ...opzioni, token: sessione.token });

/**
 * Scrive su un'attivita' e VERIFICA che abbia toccato una riga.
 *
 * Questa funzione esiste per un motivo solo, e vale la pena scriverlo per
 * intero. Una scrittura che le regole del database non lasciano passare NON
 * e' un errore: PostgREST non trova nessuna riga da aggiornare e risponde
 * senza lamentarsi. Con `return=minimal` non torna nemmeno un corpo da
 * guardare, quindi "rifiutata" e "riuscita" arrivano qui identiche.
 *
 * Il file dichiara in testa di subire le regole del database. Le subiva solo
 * quando il database rispondeva con un errore: quando si limitava a non
 * trovare la riga, il comando stampava "fatto" e — peggio — spediva le
 * notifiche. Chi osservava quel lavoro riceveva "Mario ha messo lo stato su
 * completed" per un cambio mai avvenuto.
 *
 * Con `return=representation` la riga aggiornata torna indietro, e un array
 * vuoto e' la risposta a "mi hai lasciato scrivere?".
 */
async function scriviTask(cfg, sessione, task, modifiche) {
  const righe = await rest(cfg, sessione, `/tasks?id=eq.${task.id}`, {
    method: 'PATCH',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify(modifiche),
  });

  if (!Array.isArray(righe) || righe.length === 0) {
    throw new ErroreUtente(
      `"${task.title}": il database non ha lasciato passare la modifica.\n` +
        'Di solito significa che non sei ne\' l\'assegnatario ne\' chi l\'ha\n' +
        'creata, e non sei un responsabile. Le regole sono le stesse\n' +
        "dell'interfaccia."
    );
  }

  return righe[0];
}

/* -------------------------------------------------------------------------- */
/* Dati                                                                       */
/* -------------------------------------------------------------------------- */

async function organizzazione(cfg, sessione) {
  const righe = await rest(
    cfg,
    sessione,
    `/organization_members?user_id=eq.${sessione.utente.id}&select=role,organization_id,organizations(id,name)`
  );
  if (!righe?.length) {
    throw new ErroreUtente('Questo account non appartiene ad alcuna organizzazione');
  }
  if (righe.length === 1) {
    return { id: righe[0].organization_id, ruolo: righe[0].role };
  }

  // Meglio fermarsi che indovinare: scrivere nell'organizzazione sbagliata e'
  // un errore che nessuno nota finche' non lo va a cercare.
  const nomi = righe.map((r) => r.organizations?.name ?? r.organization_id);
  if (!cfg.org) {
    throw new ErroreUtente(
      `Questo account appartiene a piu' organizzazioni (${nomi.join(', ')}). ` +
        'Scegli con TASKFLOW_ORG, indicando il nome o l\'identificativo.'
    );
  }

  const cercata = cfg.org.toLowerCase();
  const scelta = righe.find(
    (r) =>
      r.organization_id.toLowerCase() === cercata ||
      (r.organizations?.name ?? '').toLowerCase() === cercata
  );
  if (!scelta) {
    throw new ErroreUtente(
      `TASKFLOW_ORG non corrisponde a nessuna delle tue: ${nomi.join(', ')}.`
    );
  }
  return { id: scelta.organization_id, ruolo: scelta.role };
}

const COLONNE =
  'id,title,status,due_date,updated_at,assignee_id,watchers,blocked_by,requires_approval,' +
  'approved_by,approved_at,comments,activities';

/**
 * Chiuso DAVVERO, come lo intende il resto del prodotto.
 *
 * Completato non basta: se il lavoro richiede un visto e non ce l'ha, e'
 * consegnato ma non concluso. E' la definizione di `eChiusoDavvero` in
 * src/lib/approvazione.ts, ripetuta qui perche' questo file e' uno script a
 * se' e non importa nulla dal resto del progetto. Se una delle due cambia,
 * cambiano entrambe.
 */
function eChiusaDavvero(task) {
  if (task.status !== 'completed') return false;
  if (task.requires_approval !== true) return true;
  return Boolean(task.approved_by && task.approved_at);
}

async function mieAttivita(cfg, sessione, org) {
  return rest(
    cfg,
    sessione,
    `/tasks?organization_id=eq.${org.id}&assignee_id=eq.${sessione.utente.id}` +
      `&archived_at=is.null&select=${COLONNE}&order=due_date.asc.nullslast`
  );
}

/**
 * Trova l'attivita' da un pezzo di identificativo.
 *
 * Sulla riga di comando nessuno incolla un uuid intero: si usano le prime
 * lettere, quelle che `elenco` mostra. Se il pezzo ne individua piu' di una si
 * rifiuta invece di scegliere: agire sull'attivita' sbagliata e' peggio che
 * doverne scrivere due lettere in piu'.
 */
async function trovaAttivita(cfg, sessione, org, pezzo) {
  const cercato = String(pezzo ?? '').toLowerCase();
  if (!cercato) throw new ErroreUtente("Indica l'identificativo dell'attivita'");

  const tutte = await rest(
    cfg,
    sessione,
    `/tasks?organization_id=eq.${org.id}&archived_at=is.null&select=${COLONNE}`
  );
  const candidate = tutte.filter((t) => t.id.toLowerCase().startsWith(cercato));

  if (candidate.length === 0) {
    /*
      Prima si diceva "nessuna attivita'", e non era vero: la lettura sopra
      esclude le archiviate, quindi un identificativo giusto di un lavoro
      archiviato riceveva la stessa risposta di uno inventato. Chi lo cercava
      pensava di aver sbagliato a copiare.
    */
    const archiviate = await rest(
      cfg,
      sessione,
      `/tasks?organization_id=eq.${org.id}&archived_at=not.is.null&select=id,title`
    );
    const trovata = archiviate.find((t) => t.id.toLowerCase().startsWith(cercato));
    if (trovata) {
      throw new ErroreUtente(
        `"${trovata.title}" e' archiviata: non si modifica da qui.\n` +
          "Le attivita' archiviate si riaprono dall'interfaccia."
      );
    }
    throw new ErroreUtente(`Nessuna attivita' che inizi per "${pezzo}"`);
  }
  if (candidate.length > 1) {
    // L'identificativo INTERO, non il troncato che mostra `elenco`: qui sono
    // ambigui proprio perche' iniziano uguali, e stamparne dodici caratteri
    // darebbe due righe identiche fra cui non si puo' scegliere. Visto
    // provando, con due attivita' create apposta.
    const elenco = candidate.map((t) => `  ${t.id}  ${t.title}`).join('\n');
    throw new ErroreUtente(`"${pezzo}" corrisponde a piu' attivita':\n${elenco}`);
  }
  return candidate[0];
}

/* -------------------------------------------------------------------------- */
/* Stati                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * I valori veri sono quelli inglesi, perche' sono quelli nella colonna. Gli
 * alias italiani esistono perche' chi scrive da terminale scrive nella lingua
 * in cui pensa, e "completata" non deve dare errore.
 */
const STATI = {
  'not-started': 'not-started',
  'non-iniziata': 'not-started',
  'da-fare': 'not-started',
  'in-progress': 'in-progress',
  'in-corso': 'in-progress',
  blocked: 'blocked',
  bloccata: 'blocked',
  completed: 'completed',
  completata: 'completed',
  fatta: 'completed',
  fatto: 'completed',
};

function statoCanonico(valore) {
  const stato = STATI[String(valore ?? '').toLowerCase()];
  if (!stato) {
    throw new ErroreUtente(
      `Stato sconosciuto: "${valore}". Usa uno fra: ` +
        'non-iniziata, in-corso, bloccata, completata.'
    );
  }
  return stato;
}

/* -------------------------------------------------------------------------- */
/* Scritture                                                                  */
/* -------------------------------------------------------------------------- */

const adesso = () => new Date().toISOString();

/**
 * Il blocco di un minuto dentro la chiave dell'evento.
 *
 * L'indice unico su (organization_id, event_key) respinge i doppioni: due
 * comandi identici lanciati nello stesso minuto producono una notifica sola,
 * che e' lo stesso meccanismo usato dall'interfaccia.
 */
const bloccoMinuto = () => adesso().slice(0, 16);

/**
 * Chi sono, come lo vede il resto del prodotto.
 *
 * `user_metadata` e' la copia scritta al momento della registrazione e non
 * cambia piu': l'interfaccia legge `profiles.full_name`, che e' quello che si
 * modifica dal pannello. Prendendo la prima, chi aveva cambiato nome si
 * ritrovava i commenti scritti da terminale firmati col nome vecchio, accanto
 * a quelli del browser firmati col nuovo.
 *
 * Il profilo puo' non rispondere (rete, permessi): in quel caso si ricade sui
 * metadati, che e' peggio che giusto ma meglio che fermarsi.
 */
async function identita(cfg, sessione) {
  const meta = sessione.utente.user_metadata ?? {};
  const ripiego = {
    id: sessione.utente.id,
    nome: meta.full_name || sessione.utente.email || 'Utente',
    avatar: meta.avatar_url || '',
  };

  try {
    const righe = await rest(
      cfg,
      sessione,
      `/profiles?id=eq.${sessione.utente.id}&select=full_name,avatar_url`
    );
    const p = righe?.[0];
    if (!p) return ripiego;
    return {
      id: sessione.utente.id,
      nome: p.full_name || ripiego.nome,
      avatar: p.avatar_url || ripiego.avatar,
    };
  } catch {
    return ripiego;
  }
}

/**
 * Rilegge gli elenchi cumulativi un istante prima di riscriverli.
 *
 * `comments` e `activities` sono colonne jsonb che crescono, e questo comando
 * le rimanda indietro INTERE. Fra la lettura iniziale e la scrittura passano
 * l'accesso, la lettura dell'organizzazione e quella di tutte le attivita':
 * secondi, non millisecondi. Un commento scritto dal browser in quella
 * finestra spariva, e spariva anche dalla cronologia, quindi senza lasciare
 * traccia da nessuna parte.
 *
 * Rileggere qui non chiude la finestra, la riduce a una manciata di
 * millisecondi. Chiuderla del tutto vorrebbe dire una scrittura condizionata
 * sul valore letto, e per due colonne jsonb non e' una cosa che PostgREST
 * offra in modo pulito: questo e' il compromesso, ed e' scritto perche' chi
 * legge sappia che c'e'.
 */
async function rileggiElenchi(cfg, sessione, task) {
  const righe = await rest(
    cfg,
    sessione,
    `/tasks?id=eq.${task.id}&select=comments,activities`
  );
  const fresca = righe?.[0] ?? {};
  return {
    commenti: Array.isArray(fresca.comments) ? fresca.comments : [],
    cronologia: Array.isArray(fresca.activities) ? fresca.activities : [],
  };
}

function voceCronologia(io, task, tipo, extra = {}) {
  return {
    id: `att-${randomUUID()}`,
    taskId: task.id,
    userId: io.id,
    userName: io.nome,
    userAvatar: io.avatar,
    type: tipo,
    createdAt: adesso(),
    ...extra,
  };
}

/**
 * Una notifica, con le stesse colonne che scrive l'interfaccia.
 *
 * Il doppione non e' un guasto: l'indice unico lo respinge con il codice
 * 23505 e qui viene ignorato in silenzio, esattamente come nel client.
 */
async function notifica(cfg, sessione, org, io, task, { destinatario, tipo, messaggio }) {
  if (!destinatario || destinatario === io.id) return;
  try {
    await rest(cfg, sessione, '/notifications', {
      method: 'POST',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({
        organization_id: org.id,
        user_id: destinatario,
        task_ref: task.id,
        task_title: task.title,
        type: tipo,
        message: messaggio,
        action_by: io.id,
        action_by_name: io.nome,
        action_by_avatar: io.avatar || null,
        link: null,
        read: false,
        event_key: `cli:${task.id}:${tipo}:${destinatario}:${bloccoMinuto()}`,
      }),
    });
  } catch (e) {
    if (!/duplicate key|23505/i.test(e.message)) {
      // Una notifica persa non deve far credere che la modifica non sia
      // andata a buon fine: si segnala e si prosegue.
      console.warn(`  avviso: notifica non inviata (${e.message})`);
    }
  }
}

/** Chi puo' approvare, per avvisarlo quando un lavoro resta in attesa. */
async function responsabili(cfg, sessione, org) {
  const righe = await rest(
    cfg,
    sessione,
    `/organization_members?organization_id=eq.${org.id}&role=in.(owner,admin,manager)&select=user_id`
  );
  return righe.map((r) => r.user_id);
}

/* -------------------------------------------------------------------------- */
/* Comandi                                                                    */
/* -------------------------------------------------------------------------- */

function riga(task) {
  const scadenza = task.due_date ? task.due_date.slice(0, 10) : '—'.padEnd(10);
  const attesa =
    task.status === 'completed' && task.requires_approval && !task.approved_by
      ? ' (attende il visto)'
      : '';
  return `  ${task.id.slice(0, 8)}  ${task.status.padEnd(12)}  ${scadenza}  ${task.title}${attesa}`;
}

async function comandoElenco(cfg, sessione, org) {
  const mie = await mieAttivita(cfg, sessione, org);
  if (!mie.length) {
    console.log('Nessuna attivita\' assegnata a te.');
    return;
  }
  /*
    "Aperte" comprende cio' che aspetta un visto.

    Prima il taglio era `status !== 'completed'`, quindi un lavoro consegnato e
    in attesa di approvazione spariva dalle aperte e compariva fra le chiuse.
    Chi la mattina dopo eseguiva `elenco` per sapere cosa gli restava non lo
    vedeva piu' e lo dimenticava — che e' il modo esatto in cui un flusso di
    approvazione diventa un intralcio invece che un controllo.
  */
  const aperte = mie.filter((t) => !eChiusaDavvero(t));
  const chiuse = mie
    .filter(eChiusaDavvero)
    // `mieAttivita` ordina per scadenza crescente, che per un elenco di cose
    // CHIUSE e' l'ordine sbagliato: prendendone dieci si sarebbero prese le
    // dieci con la scadenza piu' vecchia, cioe' le meno recenti possibili,
    // sotto un titolo che dice "di recente".
    .sort((a, b) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')));

  console.log(`\nAperte (${aperte.length}):`);
  if (!aperte.length) console.log('  nessuna');
  for (const t of aperte) console.log(riga(t));

  if (chiuse.length) {
    const MOSTRATE = 10;
    const mostrate = chiuse.slice(0, MOSTRATE);
    // Si dice quante se ne stanno vedendo, non solo quante ce ne sono: prima
    // l'intestazione diceva "(47)" e sotto comparivano dieci righe, senza
    // nessun accenno alle altre trentasette.
    const intestazione =
      chiuse.length > MOSTRATE
        ? `Chiuse di recente (${mostrate.length} di ${chiuse.length}):`
        : `Chiuse di recente (${chiuse.length}):`;
    console.log(`\n${intestazione}`);
    for (const t of mostrate) console.log(riga(t));
  }
  console.log('');
}

async function comandoStato(cfg, sessione, org, [pezzo, statoGrezzo, nota]) {
  const task = await trovaAttivita(cfg, sessione, org, pezzo);
  const nuovo = statoCanonico(statoGrezzo);
  const io = await identita(cfg, sessione);

  if (task.status === nuovo && !nota) {
    console.log(`"${task.title}" e' gia' ${nuovo}. Niente da fare.`);
    return;
  }

  // Riletti adesso, non quelli di `trovaAttivita`: vedi `rileggiElenchi`.
  const { commenti, cronologia } = await rileggiElenchi(cfg, sessione, task);

  if (task.status !== nuovo) {
    cronologia.push(
      voceCronologia(io, task, 'status_changed', {
        oldValue: task.status.replace('-', ' '),
        newValue: nuovo.replace('-', ' '),
      })
    );
  }
  if (nota) {
    commenti.push({
      id: `com-${randomUUID()}`,
      taskId: task.id,
      userId: io.id,
      userName: io.nome,
      userAvatar: io.avatar,
      content: nota,
      createdAt: adesso(),
    });
    cronologia.push(voceCronologia(io, task, 'comment_added'));
  }

  /*
    Si inviano SOLO le colonne toccate.

    Rimandare indietro la riga intera e' il modo classico di cancellare cio'
    che non si era letto: e' la stessa cautela per cui la lista
    dell'interfaccia non scrive mai `attachments`.

    Il visto non si tocca: se va azzerato lo azzera il trigger della 0025, che
    e' l'unico posto in cui quella regola vale per tutti.
  */
  const modifiche = { activities: cronologia, updated_at: adesso() };
  if (task.status !== nuovo) modifiche.status = nuovo;
  if (nota) modifiche.comments = commenti;

  // Le notifiche partono DOPO, e solo se la riga e' stata toccata davvero:
  // e' l'ordine che conta, perche' una notifica non si ritira.
  await scriviTask(cfg, sessione, task, modifiche);

  const osservatori = Array.isArray(task.watchers) ? task.watchers : [];
  const diventaChiusa = nuovo === 'completed' && task.status !== 'completed';
  const attendeVisto = diventaChiusa && task.requires_approval === true;

  if (task.status !== nuovo) {
    for (const o of osservatori) {
      await notifica(cfg, sessione, org, io, task, {
        destinatario: o,
        tipo: 'task_status_changed',
        messaggio: `"${task.title}": ${io.nome} ha messo lo stato su ${nuovo}`,
      });
    }
    if (attendeVisto) {
      // Chi deve approvare va avvisato, altrimenti il lavoro resta fermo
      // finche' un responsabile non passa per caso dalla bacheca.
      for (const r of await responsabili(cfg, sessione, org)) {
        await notifica(cfg, sessione, org, io, task, {
          destinatario: r,
          tipo: 'task_status_changed',
          messaggio: `"${task.title}" aspetta la tua approvazione`,
        });
      }
    } else if (diventaChiusa) {
      await notifica(cfg, sessione, org, io, task, {
        destinatario: task.assignee_id,
        tipo: 'task_completed',
        messaggio: `La tua attivita' "${task.title}" e' stata completata`,
      });
    }
  }

  console.log(
    `"${task.title}" ${task.status !== nuovo ? `-> ${nuovo}` : '(stato invariato)'}` +
      (nota ? ' con nota' : '') +
      (attendeVisto ? '. Ora aspetta l\'approvazione di un responsabile.' : '.')
  );
}

async function comandoNota(cfg, sessione, org, [pezzo, ...resto]) {
  const testo = resto.join(' ').trim();
  if (!testo) throw new ErroreUtente('Scrivi il testo della nota');

  const task = await trovaAttivita(cfg, sessione, org, pezzo);
  const io = await identita(cfg, sessione);

  // Riletti adesso, non quelli di `trovaAttivita`: vedi `rileggiElenchi`.
  const { commenti, cronologia } = await rileggiElenchi(cfg, sessione, task);
  commenti.push({
    id: `com-${randomUUID()}`,
    taskId: task.id,
    userId: io.id,
    userName: io.nome,
    userAvatar: io.avatar,
    content: testo,
    createdAt: adesso(),
  });
  cronologia.push(voceCronologia(io, task, 'comment_added'));

  await scriviTask(cfg, sessione, task, {
    comments: commenti,
    activities: cronologia,
    updated_at: adesso(),
  });

  const destinatari = new Set([
    task.assignee_id,
    ...(Array.isArray(task.watchers) ? task.watchers : []),
  ]);
  for (const d of destinatari) {
    await notifica(cfg, sessione, org, io, task, {
      destinatario: d,
      tipo: 'task_comment',
      messaggio: `${io.nome} ha commentato "${task.title}"`,
    });
  }

  console.log(`Nota aggiunta a "${task.title}".`);
}

async function comandoAccedi(cfg) {
  // Se le credenziali sono gia' nell'ambiente non si chiede niente: e' il caso
  // di chi automatizza e fa `accedi` una volta per lasciare la sessione pronta.
  const email = cfg.email || (await chiedi('Email: '));
  const password = cfg.password || (await chiedi('Password (non si vede): ', { nascosto: true }));
  if (!email || !password) throw new ErroreUtente('Servono email e password.');

  const sessione = await accediConPassword(cfg, email, password);
  if (!sessione.rinnovo) {
    throw new ErroreUtente(
      'Il server non ha dato un token di rinnovo: non posso ricordare la sessione.'
    );
  }

  salvaSessione({
    url: cfg.url,
    chiave: cfg.chiave,
    email: sessione.utente.email,
    utente: sessione.utente.id,
    rinnovo: sessione.rinnovo,
  });

  console.log(`\nAccesso riuscito come ${sessione.utente.email}.`);
  console.log(`Sessione salvata in ${FILE_SESSIONE}, leggibile solo da te.`);
  console.log('Da ora i comandi non chiedono piu\' niente. Per dimenticarla: "esci".\n');
}

/**
 * Chiude la sessione, qui e sul server.
 *
 * Cancellare il file da solo non basterebbe: il token di rinnovo resterebbe
 * valido per chiunque ne avesse fatto una copia. Si prova percio' a revocarlo
 * davvero, e il file si cancella comunque — anche se la revoca fallisce, non
 * lasciarne la copia in giro e' sempre meglio.
 */
async function comandoEsci() {
  const salvata = leggiSessioneSalvata();
  if (!salvata) {
    console.log('Non c\'era nessuna sessione salvata.');
    return;
  }

  try {
    const cfg = configurazione();
    const sessione = await accediConRinnovo(cfg, salvata.rinnovo);
    await chiamata(cfg, '/auth/v1/logout', { method: 'POST', token: sessione.token });
    dimenticaSessione();
    console.log('Sessione chiusa, qui e sul server.');
  } catch {
    dimenticaSessione();
    console.log(
      'Sessione dimenticata qui.\n' +
        'Non sono riuscito a revocarla sul server: scadra\' da sola.'
    );
  }
}

const AIUTO = `
TaskFlow da riga di comando.

  node scripts/taskflow.mjs accedi
      Chiede email e password una volta sola e ricorda la sessione.
      Da li' in poi gli altri comandi non chiedono piu' niente.

  node scripts/taskflow.mjs elenco
      Le attivita' assegnate a te, con l'inizio dell'identificativo.

  node scripts/taskflow.mjs stato <id> <stato> ["cosa ho fatto"]
      Cambia lo stato, e con il terzo argomento lascia anche la nota.
      Stati: non-iniziata, in-corso, bloccata, completata.

  node scripts/taskflow.mjs nota <id> "testo"
      Aggiunge solo un commento.

  node scripts/taskflow.mjs esci
      Dimentica la sessione e la revoca sul server.

L'<id> sono le prime lettere che mostra "elenco": bastano finche' individuano
una sola attivita', altrimenti il comando si ferma invece di indovinare.

Per le esecuzioni automatiche, dove non c'e' nessuno a rispondere, restano
TASKFLOW_EMAIL e TASKFLOW_PASSWORD nell'ambiente. Con piu' organizzazioni si
sceglie con TASKFLOW_ORG.

Le regole sono quelle del database: se un'attivita' e' bloccata da un'altra,
chiuderla viene rifiutato qui come nell'interfaccia.
`;

/* -------------------------------------------------------------------------- */

async function principale() {
  const [comando, ...argomenti] = process.argv.slice(2);

  if (!comando || comando === 'aiuto' || comando === '--help' || comando === '-h') {
    console.log(AIUTO);
    return;
  }

  // `esci` non ha bisogno di sapere chi sei: e' il comando che serve proprio
  // quando la sessione e' in uno stato che non si riesce piu' ad aprire.
  if (comando === 'esci') return comandoEsci();

  const cfg = configurazione();

  if (comando === 'accedi') return comandoAccedi(cfg);

  const sessione = await apriSessione(cfg);
  const org = await organizzazione(cfg, sessione);

  switch (comando) {
    case 'elenco':
      return comandoElenco(cfg, sessione, org);
    case 'stato':
      return comandoStato(cfg, sessione, org, argomenti);
    case 'nota':
      return comandoNota(cfg, sessione, org, argomenti);
    default:
      throw new ErroreUtente(`Comando sconosciuto: "${comando}". Prova "aiuto".`);
  }
}

principale().catch((errore) => {
  if (errore instanceof ErroreUtente) {
    console.error(`\n${errore.message}\n`);
  } else {
    console.error(errore);
  }
  process.exitCode = 1;
});
