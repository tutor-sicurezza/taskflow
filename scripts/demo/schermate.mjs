/**
 * Genera le immagini del README guidando l'applicazione VERA in un browser
 * vero, con un'organizzazione inventata al posto del database.
 *
 * Perche' esiste: senza credenziali non si puo' fotografare un'installazione
 * reale, e fotografarne una reale sarebbe comunque sbagliato — le schermate di
 * un gestionale mostrano chi lavora su cosa e chi e' in ritardo. Cio' che si
 * vuole mostrare e' l'interfaccia, non i dati di qualcuno.
 *
 * Cosa NON e': un mockup. Non c'e' nessuna finta interfaccia. Gira il bundle
 * prodotto da `npm run build`, con i suoi componenti, i suoi mapper e i suoi
 * conteggi; l'unica cosa sostituita e' la rete. Le risposte hanno la forma di
 * PostgREST, quindi passano per lo stesso codice che legge il database vero —
 * se un mapper si rompe, queste immagini si rompono con lui.
 *
 * Uso:
 *   npm run build -- --outDir dist-demo --mode demo   (con le variabili finte)
 *   node scripts/demo/schermate.mjs
 *
 * Le immagini finiscono in docs/immagini/.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { IO, MEMBRI, NOTIFICHE, STATO_APP, STATO_UTENTE, TASK } from './dati.mjs';

/*
  Playwright non e' una dipendenza del progetto, di proposito.

  Serve solo a rigenerare le immagini del README: e' un lavoro che si fa ogni
  tanto, e infilare un browser da centinaia di megabyte fra le dipendenze di
  sviluppo lo farebbe scaricare a chiunque cloni il repository per lavorare sul
  prodotto. Si cerca quindi dove sta — nel progetto o installato globalmente —
  e se non c'e' si dice come averlo, invece di fallire con "modulo non trovato".
*/
async function caricaPlaywright() {
  try {
    return await import('playwright');
  } catch {
    /* si prova con l'installazione globale */
  }

  try {
    const radiceGlobale = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
    return await import(pathToFileURL(join(radiceGlobale, 'playwright', 'index.js')).href);
  } catch {
    console.error(
      'Serve Playwright per generare le immagini, e non l\'ho trovato.\n' +
        '  npm i -D playwright && npx playwright install chromium\n' +
        'oppure installalo globalmente: npm i -g playwright'
    );
    process.exit(1);
  }
}

const modulo = await caricaPlaywright();
// Dall'installazione globale arriva come modulo CommonJS, e li' l'oggetto sta
// sotto `default`.
const chromium = modulo.chromium ?? modulo.default?.chromium;

const RADICE = resolve(import.meta.dirname, '..', '..');
const CARTELLA = join(RADICE, 'dist-demo');
const USCITA = join(RADICE, 'docs', 'immagini');
const INDIRIZZO_FINTO = 'demo.supabase.co';

if (!existsSync(CARTELLA)) {
  console.error(
    `Manca ${CARTELLA}.\n` +
      'Prima: npm run build:demo'
  );
  process.exit(1);
}

mkdirSync(USCITA, { recursive: true });

/* -------------------------------------------------------------------------- */
/* Un server statico minimo per il bundle                                     */
/* -------------------------------------------------------------------------- */

const TIPI = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

const server = createServer(async (richiesta, risposta) => {
  const percorso = decodeURIComponent(new URL(richiesta.url, 'http://x').pathname);
  const candidato = join(CARTELLA, percorso === '/' ? 'index.html' : percorso);

  /*
    Le rotte server rispondono come su un'installazione SENZA chiave AI.

    Prima cadevano nel ripiego a pagina singola e ricevevano l'HTML dell'app
    con stato 200. Il client lo trattava come una risposta buona, e ne usciva
    l'avviso `"undefined" is not valid JSON` in cima alla dashboard: brutto
    nelle immagini, ma soprattutto FALSO — nessuna installazione vera si
    comporta cosi'. Qui si risponde 503 con lo stesso codice che manda
    `api/ai/complete.ts` quando ANTHROPIC_API_KEY non c'e', che e' la
    configurazione predefinita di chi installa il progetto.
  */
  if (percorso.startsWith('/api/')) {
    risposta.writeHead(503, { 'content-type': 'application/json' });
    risposta.end(
      JSON.stringify({ error: 'ai_non_configurata', message: 'ANTHROPIC_API_KEY is not set' })
    );
    return;
  }

  try {
    const corpo = await readFile(candidato);
    risposta.writeHead(200, { 'content-type': TIPI[extname(candidato)] ?? 'application/octet-stream' });
    risposta.end(corpo);
  } catch {
    // Applicazione a pagina singola: qualunque percorso sconosciuto e' una
    // rotta del client, non un file mancante.
    risposta.writeHead(200, { 'content-type': TIPI['.html'] });
    risposta.end(await readFile(join(CARTELLA, 'index.html')));
  }
});

await new Promise((ok) => server.listen(4173, '127.0.0.1', ok));
const BASE = 'http://127.0.0.1:4173';

/* -------------------------------------------------------------------------- */
/* Il finto PostgREST                                                          */
/* -------------------------------------------------------------------------- */

const UTENTE = {
  id: IO.id,
  aud: 'authenticated',
  role: 'authenticated',
  email: IO.email,
  created_at: IO.joined_date,
  user_metadata: { full_name: IO.full_name, avatar_url: IO.avatar_url },
  app_metadata: { provider: 'email' },
};

const PROFILO = {
  id: IO.id,
  email: IO.email,
  full_name: IO.full_name,
  avatar_url: IO.avatar_url,
  job_title: IO.job_title,
  departments: IO.departments,
  status: IO.status,
  team_lead: IO.team_lead,
  joined_date: IO.joined_date,
};

const SESSIONE = {
  access_token: 'token-di-prova-non-valido',
  refresh_token: 'rinnovo-di-prova-non-valido',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: UTENTE,
};

/*
  I filtri si applicano davvero.

  Prima le righe tornavano tutte, e il primo tentativo l'ha fatto vedere: alla
  domanda "a quali organizzazioni appartiene questo utente" rispondevo con
  tutte e cinque le righe di appartenenza, quindi l'interfaccia mostrava cinque
  volte la stessa organizzazione nel selettore. Un finto server che ignora il
  `where` non fotografa il prodotto: ne fotografa una versione che nessuno
  vedra' mai.
*/
function applicaFiltri(righe, q) {
  return righe.filter((riga) =>
    [...q.entries()].every(([colonna, condizione]) => {
      if (['select', 'order', 'limit', 'offset'].includes(colonna)) return true;
      if (!(colonna in riga)) return true;

      const valore = riga[colonna];

      if (condizione.startsWith('eq.')) return String(valore) === condizione.slice(3);
      if (condizione.startsWith('neq.')) return String(valore) !== condizione.slice(4);
      if (condizione === 'is.null') return valore === null || valore === undefined;
      if (condizione === 'not.is.null') return valore !== null && valore !== undefined;
      if (condizione.startsWith('in.(')) {
        const dentro = condizione
          .slice(4, -1)
          .split(',')
          .map((v) => v.replace(/^"|"$/g, ''));
        return dentro.includes(String(valore));
      }
      // Un operatore che non conosco non deve escludere silenziosamente delle
      // righe: meglio mostrarle e accorgersene guardando l'immagine.
      return true;
    })
  );
}

/** Le righe che questo percorso deve restituire. */
function righePer(url) {
  const percorso = url.pathname;
  const q = url.searchParams;

  const tabella = percorso.endsWith('/profiles')
    ? [PROFILO]
    : percorso.endsWith('/organization_members')
      ? MEMBRI
      : percorso.endsWith('/tasks')
        ? TASK
        : percorso.endsWith('/notifications')
          ? NOTIFICHE
          : percorso.endsWith('/app_state')
            ? STATO_APP
            : percorso.endsWith('/user_state')
              ? STATO_UTENTE
              : [];

  return applicaFiltri(tabella, q);
}

async function servi(rotta, richiesta) {
  const url = new URL(richiesta.url());
  const intestazioni = { 'content-type': 'application/json' };

  if (url.pathname.startsWith('/auth/v1/')) {
    const corpo = url.pathname.endsWith('/user') ? UTENTE : SESSIONE;
    return rotta.fulfill({ status: 200, headers: intestazioni, body: JSON.stringify(corpo) });
  }

  // Le scritture non devono arrivare da nessuna parte: queste immagini si
  // GUARDANO. Si risponde come farebbe PostgREST a una PATCH andata a buon
  // fine, senza tenere niente.
  if (richiesta.method() !== 'GET') {
    return rotta.fulfill({ status: 200, headers: intestazioni, body: '[]' });
  }

  return rotta.fulfill({
    status: 200,
    headers: intestazioni,
    body: JSON.stringify(righePer(url)),
  });
}

/* -------------------------------------------------------------------------- */

const browser = await chromium.launch();
const contesto = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  /*
    1.5 e non 2: a 2 le immagini erano nitide e pesavano 4,7 MB in totale, che
    ogni clone del repository si porta dietro per sempre. A 1.5 restano
    abbondantemente sopra la larghezza con cui GitHub le mostra e pesano meno
    della meta'.
  */
  deviceScaleFactor: 1.5,
  locale: 'en-US',
  colorScheme: 'light',
  /*
    I caratteri arrivano da Google Fonts attraverso il proxy di questo
    ambiente, che presenta un certificato firmato da una CA che Chromium non
    conosce. Senza questa riga il foglio di stile veniva rifiutato e le
    immagini uscivano con il carattere di sistema al posto di quello del
    prodotto — una differenza che si nota, in una schermata fatta di testo.
  */
  ignoreHTTPSErrors: true,
  /*
    Il service worker resta spento, e non e' un dettaglio.

    Il progetto e' una PWA: al primo caricamento il worker si registra e da li'
    in poi RISPONDE LUI. Le prime immagini uscivano giuste e tutte le
    successive mostravano "nessuna organizzazione collegata", perche' le
    richieste non arrivavano piu' all'intercettazione ma alla cache del worker.
    Spegnendolo ogni schermata riparte dalle stesse condizioni.
  */
  serviceWorkers: 'block',
});

/*
  L'ordine di queste due conta, e me ne sono accorto sbagliandolo: Playwright
  consulta le rotte dall'ULTIMA registrata alla prima, quindi la rete di
  sicurezza va messa per PRIMA, altrimenti si mangia anche le richieste che
  dovrebbe gestire il finto PostgREST.
*/
await contesto.route('**', (rotta) => {
  const indirizzo = rotta.request().url();
  if (indirizzo.startsWith(BASE) || indirizzo.startsWith('data:')) return rotta.continue();
  // I caratteri arrivano da Google Fonts. Senza, l'immagine mostrerebbe un
  // carattere di sistema al posto di quello del prodotto: si lasciano passare.
  if (indirizzo.startsWith('https://fonts.')) return rotta.continue();
  console.warn(`  richiesta verso l'esterno bloccata: ${indirizzo}`);
  return rotta.abort();
});

// Registrata DOPO, quindi vista PRIMA: e' la rete che sostituisce il database.
await contesto.route(`**://${INDIRIZZO_FINTO}/**`, servi);

await contesto.addInitScript(
  ([sessione, indirizzo]) => {
    // supabase-js ricava la chiave dal sottodominio del progetto.
    const riferimento = new URL(indirizzo).hostname.split('.')[0];
    localStorage.setItem(`sb-${riferimento}-auth-token`, JSON.stringify(sessione));
    localStorage.setItem('taskflow.lingua', 'en');
  },
  [SESSIONE, `https://${INDIRIZZO_FINTO}`]
);

const pagina = await contesto.newPage();
pagina.on('console', (m) => {
  if (m.type() === 'error') console.warn(`  console: ${m.text().slice(0, 160)}`);
});
pagina.on('pageerror', (e) => {
  console.warn(`  ERRORE DI PAGINA: ${e.message}\n${(e.stack ?? '').split('\n').slice(0, 6).join('\n')}`);
});

/*
  `attesa` e' un pezzo di testo che DEVE comparire prima di scattare.

  Non e' pignoleria: senza, si fotografa lo scheletro di caricamento e non ce
  ne si accorge finche' non si guardano le immagini una per una. Ogni vista
  aspetta qualcosa che esiste solo quando i dati sono arrivati davvero — un
  conteggio calcolato, il titolo di un'attivita' — non un'intestazione fissa,
  che comparirebbe anche a pagina vuota.
*/
const SCHERMATE = [
  { nome: 'dashboard', vista: '', attesa: 'Total Tasks' },
  { nome: 'attivita', vista: 'tasks', attesa: 'Rate limiting on the public API' },
  { nome: 'calendario', vista: 'calendario', attesa: 'Rate limiting on the public API' },
  { nome: 'carico', vista: 'carico', attesa: 'Davide Ferrero' },
  { nome: 'analytics', vista: 'analytics', attesa: 'Completion' },
];

for (const { nome, vista, attesa } of SCHERMATE) {
  const indirizzo = vista ? `${BASE}/?vista=${vista}` : `${BASE}/`;
  console.log(`\n${nome} -> ${indirizzo}`);
  await pagina.goto(indirizzo, { waitUntil: 'networkidle' });

  if (attesa) {
    /*
      Se cio' che si aspetta non arriva, si DICE cosa c'era a schermo invece di
      fermarsi con un timeout muto. Nove volte su dieci il motivo e' che il
      testo atteso non e' piu' quello, e leggere la pagina lo risolve in un
      colpo; fermarsi e basta costringe a rifare tutto il giro per scoprirlo.
    */
    try {
      await pagina.getByText(attesa).first().waitFor({ timeout: 20000 });
    } catch {
      const testo = (await pagina.locator('body').innerText()).slice(0, 700);
      console.error(`  NON HO TROVATO "${attesa}". A schermo c'era:\n${testo.replace(/^/gm, '    ')}`);
      process.exitCode = 1;
      continue;
    }
  }

  /*
    Si aspetta che gli avvisi spariscano da soli, non li si toglie dal DOM.

    Su questo banco le funzioni AI rispondono come su un'installazione senza
    chiave — cioe' quella predefinita — e l'applicazione lo dice con un avviso
    in cima. E' un comportamento giusto e va bene vederlo; semplicemente non e'
    cio' che la prima immagine del README deve raccontare. Cancellarlo dalla
    pagina sarebbe ritoccare la fotografia: si lascia scadere.
  */
  await pagina
    .locator('li[data-sonner-toast]')
    .first()
    .waitFor({ state: 'detached', timeout: 15000 })
    .catch(() => console.warn('  un avviso e rimasto a schermo'));

  // Le animazioni di entrata durano qualche centinaio di millisecondi:
  // fotografare prima darebbe schede a meta' dissolvenza. Imparato male una
  // volta, su un anello di focus fotografato durante la transizione.
  await pagina.waitForTimeout(1500);

  await pagina.screenshot({ path: join(USCITA, `${nome}.png`) });
  console.log(`  salvata docs/immagini/${nome}.png`);
}

/* -------------------------------------------------------------------------- */
/* Due scene che richiedono di CLICCARE                                       */
/* -------------------------------------------------------------------------- */

/*
  Le immagini qui sopra si ottengono caricando un indirizzo. Queste no: il
  dettaglio di un'attivita' e la consegna a Claude vivono dentro finestre di
  dialogo, e sono le due cose che raccontano il prodotto meglio di qualunque
  elenco — una mostra commenti, passi e dipendenze, l'altra la funzione che
  questo progetto ha di suo.
*/
async function scena(nome, azione) {
  console.log(`\n${nome}`);
  await pagina.goto(`${BASE}/?vista=tasks`, { waitUntil: 'networkidle' });
  await pagina.getByText('Rate limiting on the public API').first().waitFor({ timeout: 20000 });
  await pagina
    .locator('li[data-sonner-toast]')
    .first()
    .waitFor({ state: 'detached', timeout: 15000 })
    .catch(() => {});

  try {
    await azione();
  } catch (errore) {
    console.error(`  non sono riuscito ad arrivarci: ${errore.message.split('\n')[0]}`);
    process.exitCode = 1;
    return;
  }

  await pagina.waitForTimeout(1200);
  await pagina.screenshot({ path: join(USCITA, `${nome}.png`) });
  console.log(`  salvata docs/immagini/${nome}.png`);
}

/**
 * Apre il dettaglio dell'attivita' con questo titolo.
 *
 * Si parte dal TITOLO e si risale al primo antenato che contiene il pulsante,
 * invece di prendere l'ennesimo pulsante della pagina: l'elenco e' ordinato per
 * scadenza, quindi un indice fisso punterebbe a un'attivita' diversa ogni volta
 * che cambiano le date dei dati di prova.
 */
async function apriDettaglio(titolo) {
  const ETICHETTA = 'View details & comments';
  const scheda = pagina.locator(
    `xpath=//*[normalize-space(text())=${JSON.stringify(titolo)}]` +
      `/ancestor::*[.//button[@aria-label=${JSON.stringify(ETICHETTA)}]][1]`
  );
  await scheda.first().getByRole('button', { name: ETICHETTA }).click();
  await pagina.getByRole('dialog').waitFor({ timeout: 10000 });
}

await scena('dettaglio', () => apriDettaglio('Rate limiting on the public API'));

await scena('claude', async () => {
  // Il bottone compare SOLO sulle attivita' assegnate a chi guarda: quella di
  // Mara e' l'aggiornamento trimestrale.
  await apriDettaglio('Draft the Q3 engineering update');
  await pagina.getByRole('button', { name: /Work on this with Claude/i }).click();
  await pagina.getByText('Ready-made prompt').waitFor({ timeout: 10000 });
});

await browser.close();
server.close();
console.log('\nfatto.');
