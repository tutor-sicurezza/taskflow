/**
 * Il nucleo di TaskFlow fuori dal browser: sessione, lettura, scrittura.
 *
 * Stava tutto dentro `taskflow.mjs`, mescolato ai comandi che stampano. E'
 * uscito di li' quando e' servito un secondo consumatore — il server MCP di
 * `scripts/mcp/taskflow.mjs` — perche' l'alternativa era duplicare
 * l'autenticazione, e una copia dell'autenticazione e' una copia che un giorno
 * diverge da quella vera.
 *
 * PERCHE' NON PASSA DA UNA ROTTA IN api/. Le rotte serverless girano con il
 * service role, che scavalca le policy RLS e per cui `auth.uid()` e' nullo:
 * ogni regola andrebbe riscritta li' dentro, e una dimenticanza sarebbe un
 * buco. Qui invece si accede come l'utente e si parla direttamente a
 * PostgREST con il SUO token, quindi valgono esattamente le stesse policy e
 * gli stessi trigger dell'interfaccia: chi non puo' fare una cosa dal browser
 * non la puo' fare nemmeno da qui, e non perche' lo controlla questo file.
 *
 * Vale anche — e soprattutto — per il server MCP: quando un modello agisce al
 * posto di una persona, agisce con i permessi di quella persona e non con
 * quelli del server.
 *
 * In particolare le due regole del cambio di stato — non si completa
 * un'attivita' che ne aspetta altre, e il cambio di stato azzera il visto
 * precedente — stanno nel database dalla migrazione 0025. Questo modulo non le
 * ricontrolla: le SUBISCE, come deve.
 *
 * Quello che invece fa, perche' il database non lo fa al posto suo, e'
 * scrivere la riga di cronologia e le notifiche, cosi' che un'attivita' chiusa
 * da qui sia indistinguibile da una chiusa dall'interfaccia.
 *
 * Le funzioni qui dentro NON stampano: restituiscono. Chi le chiama decide se
 * scrivere una riga a terminale o incapsularla in una risposta MCP.
 */

import { createHash, randomUUID } from 'node:crypto';
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

/**
 * L'impronta del file di sessione: cambia quando cambia chi sei.
 *
 * Serve a chi tiene una sessione in memoria per ore — il connettore MCP vive
 * quanto Claude Desktop — e deve accorgersi che nel frattempo quel file e'
 * stato tolto da `esci` o riscritto da un altro accesso. Non basta guardare la
 * scadenza del token: revocare il rinnovo NON spegne il token di accesso gia'
 * emesso, che resta buono fino a un'ora. Senza questo controllo, dopo `esci` o
 * dopo essere entrati con un altro account, il processo continuava a leggere e
 * scrivere come la persona di prima.
 *
 * Si guarda il contenuto e non la data: due scritture nello stesso
 * millesimo di secondo hanno la stessa data ma non lo stesso token, e qui
 * sbagliare vuol dire non accorgersi di un cambio di identita'.
 *
 * File assente e file illeggibile danno la stessa impronta, `'assente'`: per
 * chi ha una sessione in mano sono lo stesso fatto, cioe' "quella salvata non
 * c'e' piu'".
 */
function improntaSessione() {
  try {
    return createHash('sha256').update(readFileSync(FILE_SESSIONE)).digest('hex');
  } catch {
    return 'assente';
  }
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

/**
 * La risposta dell'autenticazione, con dentro QUANDO scade.
 *
 * `scadenza` non c'era, e chi teneva una sessione in memoria non aveva modo di
 * sapere che stava per marcire: il server MCP vive quanto Claude Desktop, cioe'
 * giorni, mentre il token di accesso dura un'ora. Senza questo valore l'unico
 * modo di accorgersene era fallire.
 *
 * Millisecondi perche' e' cio' che confronta `Date.now()`. Se il server non
 * dice niente resta `null`, che chi legge deve trattare come "non lo so" — non
 * come "non scade".
 */
function daRisposta(dati) {
  if (!dati?.access_token) throw new ErroreUtente('Accesso non riuscito');

  const scadenza =
    typeof dati.expires_at === 'number'
      ? dati.expires_at * 1000
      : typeof dati.expires_in === 'number'
        ? Date.now() + dati.expires_in * 1000
        : null;

  return {
    token: dati.access_token,
    rinnovo: dati.refresh_token,
    utente: dati.user,
    scadenza,
  };
}

/*
  Quanto prima della scadenza conviene riaprire la sessione.

  Il token di accesso dura un'ora. Per la riga di comando non cambia niente —
  un comando vive qualche secondo — ma il server MCP vive quanto Claude
  Desktop, cioe' giorni: tenendo il token finche' non fallisce, la prima
  chiamata dopo la scadenza tornava un errore di autenticazione, e chi aveva
  chiesto qualcosa doveva chiederlo una seconda volta.

  Cinque minuti non sono scelti a caso: sono molto piu' del piu' lungo giro di
  richieste che questo file fa (`cambiaStato` ne concatena cinque o sei, tutte
  brevi), quindi la scadenza non puo' cadere IN MEZZO a un'operazione. E' anche
  la ragione per cui non c'e' un "riprova una volta" attorno alle chiamate: un
  ritentativo cieco su `cambiaStato` rieseguirebbe anche la PATCH gia' andata a
  buon fine, e con una nota vorrebbe dire scriverla due volte. Meglio rinnovare
  prima che rimediare dopo.
*/
const MARGINE_RINNOVO_MS = 5 * 60 * 1000;

/** Vera quando il token e' scaduto, o manca cosi' poco che tanto vale rifarlo. */
function staPerScadere(sessione, adessoMs = Date.now()) {
  /*
    `scadenza` assente significa "il server non l'ha detto", non "non scade
    mai": in quel caso si tiene la sessione e si ricade sul comportamento di
    prima, cioe' scoprirlo dall'errore. L'alternativa — rinnovare per scrupolo
    a ogni chiamata — brucerebbe un token di rinnovo per volta, visto che
    Supabase li ruota a ogni uso.
  */
  if (typeof sessione?.scadenza !== 'number') return false;
  return sessione.scadenza - adessoMs <= MARGINE_RINNOVO_MS;
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
    `/organization_members?user_id=eq.${sessione.utente.id}` +
      '&select=role,organization_id,custom_permissions,organizations(id,name)'
  );
  if (!righe?.length) {
    throw new ErroreUtente('Questo account non appartiene ad alcuna organizzazione');
  }
  const voce = (r) => ({
    id: r.organization_id,
    ruolo: r.role,
    // Il nome viene restituito insieme all'id: la query lo chiede gia', e
    // buttarlo via costringeva chi lo voleva a rifare la stessa domanda.
    name: r.organizations?.name ?? null,
    deroghe: r.custom_permissions ?? null,
  });

  const nomi = righe.map((r) => r.organizations?.name ?? r.organization_id);

  /*
    Una scorciatoia c'e', ma NON quando qualcuno ha gia' scelto.

    Prima con una sola appartenenza si restituiva quella e basta, ignorando
    `cfg.org`. Sembrava innocuo — se ne hai una sola, quella e' — e con la sola
    riga di comando lo era quasi: un comando dura un secondo. Il connettore
    cambia il conto, perche' resta configurato per giorni: se l'appartenenza
    all'organizzazione A viene revocata mentre l'account resta in B, al primo
    rinnovo Claude Desktop cominciava a lavorare in B — letture, scritture,
    notifiche — con scritto A nella propria configurazione e senza dirlo a
    nessuno.

    Chi ha indicato un'organizzazione ha detto QUALE vuole. Se non e' piu' sua,
    la risposta e' un errore, non un'altra organizzazione.
  */
  if (!cfg.org) {
    if (righe.length === 1) return voce(righe[0]);

    // Meglio fermarsi che indovinare: scrivere nell'organizzazione sbagliata
    // e' un errore che nessuno nota finche' non lo va a cercare.
    throw new ErroreUtente(
      `Questo account appartiene a piu' organizzazioni (${nomi.join(', ')}). ` +
        'Scegli con --org o con TASKFLOW_ORG, indicando il nome o l\'identificativo.'
    );
  }

  const cercata = cfg.org.toLowerCase();

  /*
    L'identificativo prima del nome, e sul nome si RIFIUTA l'ambiguita'.

    `find()` restituiva la prima corrispondenza. Gli identificativi sono unici,
    quindi li' non c'era problema; i nomi no — viene reso univoco solo lo
    slug — e due organizzazioni possono chiamarsi uguale. Con `find()` si
    sceglieva quindi la prima e si scriveva li', senza che nessuno se ne
    accorgesse: il caso peggiore non e' l'errore, e' il successo apparente
    nell'organizzazione sbagliata.

    Con un nome ambiguo si elencano gli identificativi e ci si ferma. Non c'e'
    un criterio giusto per scegliere: qualunque cosa si scelga, meta' delle
    volte e' quella sbagliata.
  */
  const perId = righe.find((r) => r.organization_id.toLowerCase() === cercata);
  const perNome = righe.filter(
    (r) => (r.organizations?.name ?? '').toLowerCase() === cercata
  );

  if (!perId && perNome.length > 1) {
    const elenco = perNome.map((r) => `  ${r.organization_id}`).join('\n');
    throw new ErroreUtente(
      `"${cfg.org}" e' il nome di piu' di una delle tue organizzazioni.\n` +
        `Indica quale, con l'identificativo:\n${elenco}`
    );
  }

  const scelta = perId ?? perNome[0];
  if (!scelta) {
    throw new ErroreUtente(
      `L'organizzazione indicata non corrisponde a nessuna delle tue: ${nomi.join(', ')}.`
    );
  }
  return voce(scelta);
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

/**
 * Consegnata e in attesa del visto: completata, il visto serve, e non c'e'.
 *
 * Esiste perche' la stessa domanda si faceva in due punti — l'elenco della riga
 * di comando e quello del connettore — e tutti e due la facevano male allo
 * stesso modo: `!task.approved_by`. Un'approvazione valida richiede ANCHE
 * `approved_at`, come dice `eChiusaDavvero` due righe piu' su, quindi una riga
 * con l'approvatore ma senza la data — una migrazione, una scrittura
 * interrotta — risultava ne' chiusa ne' in attesa: compariva fra le aperte con
 * scritto "completed" accanto e nessuna spiegazione del perche' fosse ancora
 * li'.
 *
 * E' l'esatto complemento di `eChiusaDavvero` sul ramo che richiede il visto:
 * sono due facce della stessa regola, e ora stanno una accanto all'altra.
 */
function attendeIlVisto(task) {
  /*
    Non c'e' un controllo su `requires_approval`, e all'inizio c'era: una prova
    per mutazione ha mostrato che era un ramo morto. Se il visto non serve,
    un'attivita' completata E' chiusa davvero, quindi il complemento e' gia'
    falso. Un controllo che nessuna prova puo' distinguere e' rumore.

    Lo stato invece serve: senza, un lavoro in corso — che non e' chiuso
    davvero — risulterebbe in attesa di un visto che nessuno ha chiesto.
  */
  return task.status === 'completed' && !eChiusaDavvero(task);
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
/** Tutte le attivita' non archiviate dell'organizzazione. */
async function tutteLeAttivita(cfg, sessione, org) {
  return rest(
    cfg,
    sessione,
    `/tasks?organization_id=eq.${org.id}&archived_at=is.null&select=${COLONNE}`
  );
}

async function trovaAttivita(cfg, sessione, org, pezzo, giaLette) {
  const cercato = String(pezzo ?? '').toLowerCase();
  if (!cercato) throw new ErroreUtente("Indica l'identificativo dell'attivita'");

  // L'elenco si puo' passare gia' letto: `cambiaStato` ha bisogno anche degli
  // ALTRI task per sapere chi si sblocca, e rileggerli sarebbe un secondo giro
  // di rete per gli stessi dati.
  const tutte = giaLette ?? (await tutteLeAttivita(cfg, sessione, org));
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
async function notifica(
  cfg,
  sessione,
  org,
  io,
  task,
  { destinatario, tipo, messaggio, motivo }
) {
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
        /*
          `motivo` distingue due avvisi che il tipo da solo confonde.

          La chiave era `cli:<task>:<tipo>:<destinatario>:<minuto>`, e con
          l'indice unico su (organization_id, event_key) questo significava UN
          SOLO avviso di quel tipo al minuto per quella persona. Due casi
          reali ci finivano dentro: un cambio corretto subito dopo — da
          "in corso" a "bloccata" e ritorno — dove il secondo avviso veniva
          respinto e l'osservatore restava con lo stato vecchio; e un
          responsabile che e' anche osservatore, che riceveva "ha messo lo
          stato su completata" oppure "aspetta la tua approvazione", mai
          entrambi, a seconda di quale partiva per primo.

          L'errore 23505 e' ignorato di proposito qui sotto, quindi la perdita
          era silenziosa. L'interfaccia la chiave la costruiva gia' bene
          (`notif-<task>-status-<vecchio>-<nuovo>-...`): questa e' la stessa
          idea, portata dove mancava.
        */
        event_key: `cli:${task.id}:${tipo}:${motivo ?? 'generico'}:${destinatario}:${bloccoMinuto()}`,
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

/**
 * Avvisa di una nota chi ha l'attivita' in carico e chi la segue.
 *
 * Una funzione sola perche' le note si scrivono da due comandi — `nota` e
 * `stato` con il terzo argomento — e finora solo il primo avvisava. Chi
 * chiudeva un'attivita' scrivendo cosa aveva fatto vedeva partire il cambio di
 * stato e non il commento: il testo restava nella scheda, e chi seguiva il
 * lavoro non sapeva che c'era da leggerlo.
 *
 * `motivo` e' l'identificativo del commento: con una parola fissa due note
 * nello stesso minuto producono la stessa chiave e l'indice unico respinge la
 * seconda, in silenzio.
 */
/**
 * Una deroga che TOGLIE un permesso, per questa organizzazione.
 *
 * ## Cosa e', e soprattutto cosa NON e'
 *
 * Non e' una barriera di sicurezza, e va detto senza giri di parole. La
 * barriera sarebbe la policy di UPDATE della 0027, che pero' guarda solo
 * `is_org_writer` — cioe' il RUOLO — e non ha mai letto `custom_permissions`.
 * Il risultato e' che una deroga su `tasks.change_status` oggi vale
 * nell'interfaccia e in nessun altro posto: chi volesse aggirarla poteva
 * farlo con `curl` e il proprio token gia' prima che questo connettore
 * esistesse.
 *
 * Questo controllo serve quindi a una cosa sola, ma reale: che chiedere a
 * Claude non diventi il modo comodo per fare cio' che l'amministratore ha
 * appena tolto. Riporta la riga di comando e il connettore allo stesso
 * comportamento dell'interfaccia.
 *
 * La correzione vera e' una policy che legga `custom_permissions`. E' una
 * migrazione, tocca tutte le scritture sui task, e merita una revisione sua:
 * non la si infila in fondo a questa.
 *
 * ## Perche' basta guardare la deroga
 *
 * Nella tabella dei ruoli `tasks.change_status` e `tasks.comment` sono `true`
 * per admin, manager e member; per il `viewer` il primo e' `false`, ma li'
 * decide gia' il database — `is_org_writer` esclude il ruolo di sola lettura.
 * L'unico caso che sfugge a tutti e' quindi la deroga esplicita a `false`, ed
 * e' quello che si guarda qui. Copiare l'intera matrice dei permessi sarebbe
 * una seconda copia destinata a divergere.
 */
/**
 * Il testo di una nota, ripulito e con lo stesso tetto dell'interfaccia.
 *
 * Duemila caratteri, come `sanitizeComment` in `src/lib/sanitization.ts`.
 * Senza, un cliente MCP poteva mandare un commento lungo quanto voleva — ed e'
 * il caso normale, non quello malevolo: a scrivere e' un modello, e un modello
 * a cui si chiede "racconta cosa hai fatto" produce volentieri pagine.
 *
 * Il danno non si ferma al commento. `comments` e' una colonna jsonb
 * CUMULATIVA che questo codice rilegge e riscrive per intero a ogni nota: una
 * risposta da mezzo megabyte resta li' e viaggia avanti e indietro a ogni
 * commento successivo, per sempre.
 *
 * Si taglia invece di rifiutare perche' il lavoro e' gia' stato fatto: buttare
 * via la nota per punire la lunghezza sarebbe peggio del troncamento.
 */
const TETTO_NOTA = 2000;

function tagliaNota(testo) {
  return String(testo ?? '').trim().slice(0, TETTO_NOTA);
}

function derogaNega(org, azione) {
  return org?.deroghe?.tasks?.[azione] === false;
}

/*
  DUE COSE CHE QUESTA STRADA NON FA, e che l'interfaccia invece fa.

  Sono state sollevate in revisione ed entrambe sono vere. Non le ho colmate
  qui, e il motivo e' lo stesso per tutte e due: colmarle vorrebbe dire
  DUPLICARE, ed e' esattamente cio' che questo file esiste per evitare.

  1. LE EMAIL. L'interfaccia, dopo aver scritto la notifica, chiama
     `/api/email/send`, che vive su Vercel e decide in base alle preferenze del
     destinatario. Da qui quella rotta non e' raggiungibile: questo processo
     conosce solo l'indirizzo di Supabase, non quello dell'applicazione.
     Aggiungerlo significa una variabile di configurazione nuova, che se manca
     fa fallire in silenzio proprio la parte che dovrebbe avvisare. E' un
     lavoro a se', non una riga.

  2. LE MENZIONI. `trovaMenzioni` in `src/lib/menzioni.ts` e' un algoritmo
     sottile — nomi dal piu' lungo al piu' corto, confini di parola,
     posizioni gia' occupate — con ventiquattro prove che lo tengono onesto.
     Riscriverlo qui vorrebbe dire una seconda copia che un giorno diverge
     dalla prima: e' la ragione per cui questo nucleo e' nato. Condividerlo
     davvero si puo' fare, spostandolo in un modulo che leggano sia TypeScript
     sia Node, ma e' un intervento sul codice dell'interfaccia e merita una
     revisione sua.

  Nel frattempo la cosa che NON si fa e' promettere. Le descrizioni degli
  strumenti MCP dicevano "avvisa chi segue l'attivita', esattamente come
  farebbe l'interfaccia": adesso dicono che le notifiche sono quelle in app,
  che le email non partono e che "@Nome" non avvisa nessuno. Meglio uno
  strumento che dichiara cosa non fa di uno che lascia credere il contrario.
*/
async function avvisaDellaNota(cfg, sessione, org, io, task, commento) {
  const destinatari = new Set([
    task.assignee_id,
    ...(Array.isArray(task.watchers) ? task.watchers : []),
  ]);
  for (const d of destinatari) {
    await notifica(cfg, sessione, org, io, task, {
      destinatario: d,
      tipo: 'task_comment',
      motivo: commento.id,
      messaggio: `${io.nome} ha commentato "${task.title}"`,
    });
  }
}

/**
 * Quanti bloccanti ANCORA APERTI ha ciascuna delle attivita' passate.
 *
 * Serve a chi mostra un elenco. `blocked_by` conserva i legami, non i blocchi:
 * contarne la lunghezza fa sembrare bloccata un'attivita' su cui si puo'
 * lavorare benissimo, e a un modello che sceglie cosa fare quella riga dice
 * "salta questa".
 *
 * I bloccanti non sono per forza fra le attivita' dell'elenco — possono essere
 * di un collega — quindi si leggono per identificativo, tutti in una richiesta
 * sola invece di una per riga.
 *
 * Restituisce una `Map` da id di attivita' a numero di bloccanti aperti.
 */
async function bloccantiApertiPerTask(cfg, sessione, org, elenco) {
  const ids = [
    ...new Set(
      elenco.flatMap((t) => (Array.isArray(t.blocked_by) ? t.blocked_by : []))
    ),
  ];
  const conteggi = new Map(elenco.map((t) => [t.id, 0]));
  if (!ids.length) return conteggi;

  const righe = await rest(
    cfg,
    sessione,
    `/tasks?id=in.(${ids.join(',')})` +
      '&select=id,status,requires_approval,approved_by,approved_at'
  );
  const perId = new Map(righe.map((r) => [r.id, r]));

  for (const t of elenco) {
    const bloccanti = Array.isArray(t.blocked_by) ? t.blocked_by : [];
    // Un riferimento che non risolve NON blocca: e' la scelta del trigger
    // della 0025, e lasciarlo bloccare terrebbe l'attivita' ferma per sempre
    // dietro qualcosa che non si puo' chiudere.
    const aperti = bloccanti.filter((id) => {
      const b = perId.get(id);
      return b ? !eChiusaDavvero(b) : false;
    });
    conteggi.set(t.id, aperti.length);
  }
  return conteggi;
}

/**
 * Chi resta senza NESSUN bloccante aperto dopo la chiusura di `chiusa`.
 *
 * "Aperto" e' la definizione del trigger della 0025, ripetuta qui: un id che
 * non corrisponde a nessuna attivita' non blocca, e un lavoro completato che
 * aspetta ancora il visto blocca eccome. Sbloccato a meta' non e' sbloccato,
 * quindi si guardano TUTTI i bloccanti, non solo quello appena chiuso.
 */
function liberatiDa(chiusa, tutte) {
  const perId = new Map(tutte.map((t) => [t.id, t]));
  // La riga appena scritta: in `tutte` c'e' ancora la versione di prima.
  perId.set(chiusa.id, { ...chiusa, status: 'completed' });

  const liberati = [];
  for (const t of tutte) {
    const bloccanti = Array.isArray(t.blocked_by) ? t.blocked_by : [];
    if (!bloccanti.includes(chiusa.id)) continue;

    const restaFermo = bloccanti.some((id) => {
      const b = perId.get(id);
      return b ? !eChiusaDavvero(b) : false;
    });
    if (!restaFermo) liberati.push(t);
  }
  return liberati;
}

/**
 * Chi ha creato l'attivita'.
 *
 * La tabella non ha una colonna per l'autore leggibile da qui: si ricava dalla
 * voce `created` della cronologia, che e' lo stesso modo in cui lo fa
 * l'interfaccia.
 */
function chiHaCreato(task) {
  const cronologia = Array.isArray(task.activities) ? task.activities : [];
  return cronologia.find((a) => a?.type === 'created')?.userId ?? null;
}

/**
 * Chi puo' approvare, per avvisarlo quando un lavoro resta in attesa.
 *
 * Il ruolo non basta. `valutaApprovazione` chiede `tasks.edit_any`, e le
 * deroghe per organizzazione possono averlo tolto a un manager: senza questo
 * filtro gli si mandava "aspetta la tua approvazione" per un lavoro che poi in
 * interfaccia non avrebbe potuto approvare — un invito a cercare un pulsante
 * che non c'e'.
 *
 * Come altrove qui dentro si guarda solo la deroga che TOGLIE: per owner,
 * admin e manager `edit_any` e' vero di suo, e chi non ha uno di quei ruoli
 * non compare nemmeno in questa lista.
 */
async function responsabili(cfg, sessione, org) {
  const righe = await rest(
    cfg,
    sessione,
    `/organization_members?organization_id=eq.${org.id}` +
      '&role=in.(owner,admin,manager)&select=user_id,custom_permissions'
  );
  return righe
    .filter((r) => r.custom_permissions?.tasks?.edit_any !== false)
    .map((r) => r.user_id);
}
/* -------------------------------------------------------------------------- */
/* Le due operazioni di scrittura                                             */
/* -------------------------------------------------------------------------- */

/**
 * Cambia lo stato di un'attivita', con o senza nota.
 *
 * Restituisce cosa e' successo davvero invece di dichiararlo: `cambiato` e
 * `conNota` sono false quando non c'e' stato niente da scrivere, e chi chiama
 * lo riferisce com'e'. E' la stessa regola per cui l'interfaccia, dalla PR #10
 * in poi, non dice "salvato" quando non ha salvato.
 */
export async function cambiaStato(cfg, sessione, org, { pezzo, stato, nota }) {
  if (derogaNega(org, 'change_status')) {
    throw new ErroreUtente(
      'Un amministratore ti ha tolto il permesso di cambiare lo stato delle\n' +
        'attivita\' in questa organizzazione. Puoi ancora leggerle e commentarle.'
    );
  }

  /*
    La nota e' un commento, e i permessi non cambiano perche' cambia la porta
    da cui si entra.

    Il primo controllo guardava solo `change_status`: chi si era visto togliere
    `comment` ma non `change_status` poteva commentare lo stesso, passando il
    testo come terzo argomento di `stato`. Cioe' il comando che il bottone
    suggerisce sarebbe diventato il modo comodo per fare esattamente cio' che
    era stato tolto.

    Si rifiuta invece di ignorare la nota in silenzio: chi l'ha scritta deve
    sapere che non e' stata salvata.
  */
  if (nota && derogaNega(org, 'comment')) {
    throw new ErroreUtente(
      'Un amministratore ti ha tolto il permesso di commentare le attivita\'\n' +
        'in questa organizzazione. Rilancia il comando senza la nota.'
    );
  }

  /*
    La nota si ripulisce SUBITO, perche' da qui in poi tutto la guarda: se una
    nota fatta di soli spazi contasse come nota, il comando direbbe "con nota"
    e riscriverebbe la colonna dei commenti senza aggiungerne nessuno.
  */
  const notaPulita = tagliaNota(nota);

  const tutte = await tutteLeAttivita(cfg, sessione, org);
  const task = await trovaAttivita(cfg, sessione, org, pezzo, tutte);
  const nuovo = statoCanonico(stato);
  const io = await identita(cfg, sessione);

  if (task.status === nuovo && !notaPulita) {
    return {
      task,
      statoPrecedente: task.status,
      statoNuovo: nuovo,
      cambiato: false,
      conNota: false,
      attendeVisto: false,
    };
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
  let commento = null;
  if (notaPulita) {
    commento = {
      id: `com-${randomUUID()}`,
      taskId: task.id,
      userId: io.id,
      userName: io.nome,
      userAvatar: io.avatar,
      content: notaPulita,
      createdAt: adesso(),
    };
    commenti.push(commento);
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
  if (notaPulita) modifiche.comments = commenti;

  // Le notifiche partono DOPO, e solo se la riga e' stata toccata davvero:
  // e' l'ordine che conta, perche' una notifica non si ritira.
  await scriviTask(cfg, sessione, task, modifiche);

  const osservatori = Array.isArray(task.watchers) ? task.watchers : [];
  const diventaChiusa = nuovo === 'completed' && task.status !== 'completed';
  const attendeVisto = diventaChiusa && task.requires_approval === true;

  /*
    Gli avvisi seguono gli stessi TRE RAMI dell'interfaccia, ed e' voluto.

    Prima erano una successione di aggiunte — osservatori sempre allo stesso
    modo, assegnatario solo alla chiusura, creatore e sbloccati appiccicati in
    fondo — e ogni giro di revisione ne trovava uno sfasato rispetto al
    browser: il tipo sbagliato, un destinatario in meno, la condizione di
    chiusura persa. Non erano difetti diversi: era la stessa struttura mancante.

    In `App.tsx` i rami sono `consegnatoInAttesa`, chiusura vera, e qualunque
    altro passaggio; qui sotto sono gli stessi, nell'ordine, cosi' che
    confrontarli sia una lettura e non un'indagine.
  */

  const etichetta = (stato) => stato.replace('-', ' ');

  /**
   * Gli osservatori, mai chi agisce e mai l'assegnatario.
   *
   * L'assegnatario e' escluso perche' ha un avviso suo, piu' preciso, in ogni
   * ramo: ricevere anche quello generico da osservatore sarebbe la stessa cosa
   * detta due volte. E' la regola di `avvisaOsservatori` in App.tsx.
   */
  const avvisaOsservatori = async (tipo, messaggio, motivo) => {
    for (const o of osservatori) {
      if (o === task.assignee_id) continue;
      await notifica(cfg, sessione, org, io, task, {
        destinatario: o,
        tipo,
        motivo,
        messaggio,
      });
    }
  };

  if (task.status !== nuovo) {
    if (attendeVisto) {
      /* Ramo 1: consegnato, aspetta il visto. Non e' concluso. */
      for (const r of await responsabili(cfg, sessione, org)) {
        /*
          Mai all'assegnatario, nemmeno se e' un responsabile: nessuno approva
          il proprio lavoro. Lo vietano `valutaApprovazione` nel client e il
          trigger della 0023 nel database. Chi agisce e' gia' escluso da
          `notifica`, ma il caso e' un altro — a chiudere puo' essere stato
          qualcun altro, e allora l'assegnatario responsabile riceveva un
          invito a fare una cosa che il database gli avrebbe rifiutato.
        */
        if (r === task.assignee_id) continue;
        await notifica(cfg, sessione, org, io, task, {
          destinatario: r,
          tipo: 'task_status_changed',
          motivo: 'visto',
          messaggio: `"${task.title}" aspetta la tua approvazione`,
        });
      }
      await avvisaOsservatori(
        'task_status_changed',
        `"${task.title}" aspetta un'approvazione`,
        'attesa-visto'
      );
    } else if (diventaChiusa) {
      /* Ramo 2: chiusa davvero. */
      await notifica(cfg, sessione, org, io, task, {
        destinatario: task.assignee_id,
        tipo: 'task_completed',
        motivo: 'assegnatario',
        messaggio: `La tua attivita' "${task.title}" e' stata completata`,
      });

      /*
        `task_completed`, non `task_status_changed`: le preferenze per tipo
        sono una cosa vera (`preferenzeNotifiche.ts`), e chi ha spento i
        passaggi di stato ma tenuto acceso il completamento non veniva
        avvisato proprio della cosa che gli interessava.
      */
      await avvisaOsservatori(
        'task_completed',
        `"${task.title}" e' stata completata`,
        'completata'
      );

      // Chi lo aveva chiesto. Non se e' anche l'assegnatario: e' gia' coperto
      // qui sopra, e due avvisi per lo stesso fatto sono rumore.
      const creatore = chiHaCreato(task);
      if (creatore && creatore !== task.assignee_id) {
        await notifica(cfg, sessione, org, io, task, {
          destinatario: creatore,
          tipo: 'task_completed',
          motivo: 'creatore',
          messaggio: `${io.nome} ha completato "${task.title}"`,
        });
      }

      // Chi aspettava questo lavoro e ora e' libero davvero. Il ramo in cui si
      // trova basta a escludere il caso del visto pendente: li' il lavoro non
      // e' `eChiusaDavvero`, e `liberatiDa` lo conta ancora fra i bloccanti.
      for (const liberato of liberatiDa(task, tutte)) {
        await notifica(cfg, sessione, org, io, liberato, {
          destinatario: liberato.assignee_id,
          tipo: 'task_status_changed',
          motivo: 'sbloccata',
          messaggio: `"${liberato.title}" non e' piu' bloccata: puoi iniziare`,
        });
      }
    } else {
      /*
        Ramo 3: qualunque altro passaggio.

        L'assegnatario qui non veniva avvisato per niente: se un responsabile o
        chi aveva chiesto il lavoro lo metteva "bloccato" da Claude, la persona
        che ci stava lavorando non lo sapeva, a meno che non fosse anche
        osservatrice di se stessa. Dal browser l'avviso parte da sempre.
      */
      const passaggio = `${etichetta(task.status)} → ${etichetta(nuovo)}`;
      await notifica(cfg, sessione, org, io, task, {
        destinatario: task.assignee_id,
        tipo: 'task_status_changed',
        motivo: `stato:${task.status}->${nuovo}`,
        messaggio: `"${task.title}": ${passaggio}`,
      });
      await avvisaOsservatori(
        'task_status_changed',
        `"${task.title}": ${passaggio}`,
        `stato:${task.status}->${nuovo}`
      );
    }
  }

  /*
    La nota e' un evento a se', e va detto anche quando accompagna un cambio di
    stato.

    Sta FUORI dal `if` sui rami perche' una nota si puo' lasciare senza
    spostare niente, e in quel caso l'avviso deve partire lo stesso. Il tipo e
    la chiave sono diversi da quelli del cambio di stato, quindi chi riceve
    entrambi li riceve entrambi — come quando nell'interfaccia si commenta e
    poi si cambia stato, che sono due gesti e due avvisi.
  */
  if (commento) {
    await avvisaDellaNota(cfg, sessione, org, io, task, commento);
  }

  return {
    task,
    statoPrecedente: task.status,
    statoNuovo: nuovo,
    cambiato: task.status !== nuovo,
    conNota: Boolean(notaPulita),
    attendeVisto,
  };
}

/** Aggiunge solo un commento, e avvisa chi segue l'attivita'. */
export async function aggiungiNota(cfg, sessione, org, { pezzo, testo }) {
  if (derogaNega(org, 'comment')) {
    throw new ErroreUtente(
      'Un amministratore ti ha tolto il permesso di commentare le attivita\'\n' +
        'in questa organizzazione.'
    );
  }

  const pulito = tagliaNota(testo);
  if (!pulito) throw new ErroreUtente('Scrivi il testo della nota');

  const task = await trovaAttivita(cfg, sessione, org, pezzo);
  const io = await identita(cfg, sessione);

  // Riletti adesso, non quelli di `trovaAttivita`: vedi `rileggiElenchi`.
  const { commenti, cronologia } = await rileggiElenchi(cfg, sessione, task);
  const commento = {
    id: `com-${randomUUID()}`,
    taskId: task.id,
    userId: io.id,
    userName: io.nome,
    userAvatar: io.avatar,
    content: pulito,
    createdAt: adesso(),
  };
  commenti.push(commento);
  cronologia.push(voceCronologia(io, task, 'comment_added'));

  await scriviTask(cfg, sessione, task, {
    comments: commenti,
    activities: cronologia,
    updated_at: adesso(),
  });

  await avvisaDellaNota(cfg, sessione, org, io, task, commento);

  return { task };
}

/**
 * Un'attivita' con tutto cio' che serve per LAVORARCI, non solo per elencarla.
 *
 * `COLONNE` e' volutamente stretta: e' la selezione dell'elenco, e portarsi
 * dietro descrizioni lunghe per venti righe sarebbe spreco. Quando pero'
 * qualcuno deve davvero fare il lavoro — una persona che apre il dettaglio, o
 * un modello attraverso MCP — servono la descrizione, le sottoattivita' e cosa
 * blocca cosa.
 *
 * I titoli di chi blocca si risolvono qui: un elenco di UUID non dice niente a
 * nessuno, e chi legge finirebbe per chiedere comunque "e quello cos'e'".
 */
export async function dettaglioTask(cfg, sessione, org, pezzo) {
  const base = await trovaAttivita(cfg, sessione, org, pezzo);

  const [pieno] = await rest(
    cfg,
    sessione,
    `/tasks?id=eq.${base.id}&select=` +
      'id,title,description,status,priority,due_date,department,labels,' +
      'estimate_minutes,spent_minutes,subtasks,blocked_by,requires_approval,' +
      'approved_by,approved_at,comments,updated_at'
  );

  const task = pieno ?? base;
  const bloccantiIds = Array.isArray(task.blocked_by) ? task.blocked_by : [];

  /*
    Si leggono anche le colonne del visto, e si tengono solo i bloccanti
    ANCORA APERTI.

    `blocked_by` conserva i legami, non i blocchi: un lavoro gia' chiuso resta
    li' dentro come traccia. Restituendoli tutti si diceva a Claude che
    un'attivita' perfettamente lavorabile era "bloccata da" qualcosa, e lo si
    ripeteva nel risultato strutturato. Il database la pensa diversamente — per
    il trigger della 0025 blocca solo cio' che non e' chiuso davvero — quindi
    quell'avviso non era prudenza, era una cosa falsa.

    La selezione prima si fermava a `id,title,status`, che non basta a
    distinguere un completato vistato da uno che aspetta ancora il visto.
  */
  let bloccanti = [];
  if (bloccantiIds.length) {
    const tutti = await rest(
      cfg,
      sessione,
      `/tasks?id=in.(${bloccantiIds.join(',')})` +
        '&select=id,title,status,requires_approval,approved_by,approved_at'
    );
    bloccanti = tutti.filter((b) => !eChiusaDavvero(b));
  }

  return { task, bloccanti };
}

/* -------------------------------------------------------------------------- */

export {
  ErroreUtente,
  FILE_SESSIONE,
  rest,
  accediConRinnovo,
  chiamata,
  STATI,
  adesso,
  apriSessione,
  chiedi,
  configurazione,
  dimenticaSessione,
  improntaSessione,
  attendeIlVisto,
  eChiusaDavvero,
  identita,
  mieAttivita,
  organizzazione,
  bloccantiApertiPerTask,
  salvaSessione,
  staPerScadere,
  statoCanonico,
  trovaAttivita,
  accediConPassword,
  leggiSessioneSalvata,
};
