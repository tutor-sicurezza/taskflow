/**
 * Traduzioni, senza librerie.
 *
 * Un dizionario per lingua, una funzione che risolve una chiave, e nient'altro:
 * per un'applicazione con poche lingue una dipendenza di i18n costerebbe piu'
 * di quanto risolva. Se un giorno servissero pluralizzazione o formati per
 * lingua, si sostituisce questo file — l'interfaccia usa solo `t()`, quindi il
 * resto del codice non cambia.
 *
 * I dizionari oltre italiano e inglese si caricano a richiesta: vedi
 * `caricaDizionario`.
 *
 * L'italiano e' la lingua di riferimento: definisce le chiavi valide (il tipo
 * `ChiaveTraduzione` nasce da li') e fa da rete quando una traduzione manca.
 * Cosi' l'interfaccia non mostra mai una chiave grezza tipo `login.titolo`,
 * che e' il modo tipico in cui questi sistemi si rompono in produzione.
 */

import { TESTI_IT, TESTI_EN_EXTRA } from './traduzioni';

export const LINGUE = {
  it: 'Italiano',
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
} as const;

export type Lingua = keyof typeof LINGUE;

export const LINGUA_PREDEFINITA: Lingua = 'it';

const it = {
  // --- accesso ---
  'app.sottotitolo': 'Gestisci il lavoro del tuo team',
  'login.titolo': 'Accedi',
  'login.descrizione': 'Inserisci le tue credenziali per continuare.',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.entra': 'Accedi',
  'login.inCorso': 'Accesso in corso...',
  'login.emailObbligatoria': "L'email è obbligatoria",
  'login.emailNonValida': 'Inserisci un indirizzo email valido',
  'login.passwordObbligatoria': 'La password è obbligatoria',
  'login.erroreGenerico': 'Si è verificato un errore imprevisto',
  'login.operazioneFallita': 'Operazione non riuscita',
  'login.accountDaAmministratore': 'Gli account sono creati dall\'amministratore.',
  'login.contattaAmministratore': 'Se non riesci ad accedere, contattalo.',
  'login.passwordDimenticata': 'Password dimenticata?',
  'login.invioInCorso': 'Invio in corso...',
  'login.inserisciEmailPerRipristino': 'Inserisci la tua email, poi richiedi il ripristino',
  'login.ripristinoInviato':
    "Se l'indirizzo corrisponde a un account, riceverai un link per reimpostare la password. Controlla anche lo spam.",

  // --- nuova password ---
  'password.sottotitolo': 'Scegli una nuova password',
  'password.titolo': 'Nuova password',
  'password.descrizione': "Imposta la password che userai d'ora in poi per accedere.",
  'password.nuova': 'Nuova password',
  'password.ripeti': 'Ripeti la password',
  'password.minimo': 'Almeno 8 caratteri.',
  'password.troppoCorta': 'La password deve contenere almeno 8 caratteri',
  'password.nonCoincidono': 'Le due password non coincidono',
  'password.salva': 'Salva la nuova password',
  'password.salvataggio': 'Salvataggio...',
  'password.annullaEsci': 'Annulla ed esci',

  // --- organizzazioni ---
  'org.nessuna': 'Nessuna organizzazione associata a questo account',
  'org.creaTitolo': 'Crea la tua organizzazione',
  'org.creaDescrizione':
    "Se stai configurando l'applicazione per la prima volta, crea qui lo spazio di lavoro: ne diventerai il proprietario e potrai invitare gli altri. Se invece dovresti far parte di un'organizzazione esistente, chiedi a un amministratore di aggiungerti.",
  'org.nome': "Nome dell'organizzazione",
  'org.crea': 'Crea organizzazione',
  'org.creazione': 'Creazione...',
  'org.nuovaTitolo': 'Nuova organizzazione',
  'org.nuovaDescrizione':
    "Diventerai il proprietario del nuovo spazio di lavoro, che parte vuoto. I dati dell'organizzazione attuale non vengono toccati.",
  'org.attiva': 'Organizzazione attiva',
  'org.creaNuova': 'Crea una nuova organizzazione',
  'org.creata': 'Organizzazione "{nome}" creata',
  'org.creazioneFallita': 'Creazione fallita',

  // --- account disattivato ---
  'account.disattivato': 'Account disattivato',
  'account.disattivatoDescrizione':
    'Questo account è stato disattivato da un amministratore. Contattalo se pensi si tratti di un errore.',

  // --- credenziali ---
  'credenziali.titolo': 'Credenziali di accesso',
  'credenziali.descrizione':
    'Consegna queste credenziali all\'utente: la password provvisoria non viene inviata per email e non sarà più visibile dopo la chiusura di questa finestra.',
  'credenziali.annotate': 'Ho annotato le credenziali',

  // --- comuni ---
  'comune.esci': 'Esci',
  'comune.annulla': 'Annulla',
  'comune.caricamento': 'Caricamento…',
  'comune.lingua': 'Lingua',
  'comune.nessunaOrganizzazione': 'Nessuna organizzazione attiva',
  'comune.sessioneScaduta': 'Sessione scaduta, accedi di nuovo',
  'comune.inizializzazioneFallita': 'Inizializzazione fallita',
  'comune.richiestaFallita': 'Richiesta fallita ({stato})',
  'comune.modificaNonSalvata': 'Modifica non salvata',
  'comune.rispostaIncompleta': 'Risposta del server incompleta',
  'comune.utenteNonIndicato': 'Utente non indicato',
  'comune.passwordNonRestituita': 'Il server non ha restituito una password',
  'ai.nonConfigurata': 'Le funzioni AI non sono configurate. Riprovare non serve: contatta un amministratore.',
  'ai.nonDisponibile': 'Il servizio AI non e’ raggiungibile in questo momento. Riprova fra poco.',
  'ai.tempoScaduto': 'Il servizio AI ci ha messo troppo. Riprova.',
  'ai.limiteRaggiunto': 'Hai raggiunto il limite di richieste AI. Riprova piu’ tardi.',
  'ai.testoTroppoLungo': 'Il testo e’ troppo lungo per essere elaborato.',
  'ai.rifiutata': 'Il servizio AI non ha accettato questa richiesta.',
  'email.nonPartita': 'Avviso salvato, ma l’email non e’ partita',
} as const;

/**
 * Chiavi ammesse: quelle semantiche delle schermate scritte in italiano, piu'
 * qualunque stringa inglese del corpo dell'interfaccia. Il secondo insieme e'
 * `string` perche' le chiavi sono i testi stessi: vincolarlo darebbe un tipo
 * enorme senza aggiungere sicurezza, visto che una chiave sbagliata mostra
 * comunque il testo inglese e non un identificatore.
 */
export type ChiaveTraduzione = keyof typeof it | (string & {});

const en: Partial<Record<ChiaveTraduzione, string>> = {
  'app.sottotitolo': "Manage your team's work",
  'login.titolo': 'Sign in',
  'login.descrizione': 'Enter your credentials to continue.',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.entra': 'Sign in',
  'login.inCorso': 'Signing in...',
  'login.emailObbligatoria': 'Email is required',
  'login.emailNonValida': 'Enter a valid email address',
  'login.passwordObbligatoria': 'Password is required',
  'login.erroreGenerico': 'Something went wrong',
  'login.operazioneFallita': 'Request failed',
  'login.accountDaAmministratore': 'Accounts are created by an administrator.',
  'login.contattaAmministratore': "If you can't sign in, get in touch with them.",
  'login.passwordDimenticata': 'Forgot your password?',
  'login.invioInCorso': 'Sending...',
  'login.inserisciEmailPerRipristino': 'Enter your email, then request the reset',
  'login.ripristinoInviato':
    "If that address matches an account, you'll receive a link to reset your password. Check your spam folder too.",

  'password.sottotitolo': 'Choose a new password',
  'password.titolo': 'New password',
  'password.descrizione': "Set the password you'll use from now on.",
  'password.nuova': 'New password',
  'password.ripeti': 'Repeat the password',
  'password.minimo': 'At least 8 characters.',
  'password.troppoCorta': 'The password must be at least 8 characters long',
  'password.nonCoincidono': "The two passwords don't match",
  'password.salva': 'Save the new password',
  'password.salvataggio': 'Saving...',
  'password.annullaEsci': 'Cancel and sign out',

  'org.nessuna': 'No organisation is linked to this account',
  'org.creaTitolo': 'Create your organisation',
  'org.creaDescrizione':
    "If you're setting up the application for the first time, create the workspace here: you'll become its owner and can invite others. If you should belong to an existing organisation, ask an administrator to add you.",
  'org.nome': 'Organisation name',
  'org.crea': 'Create organisation',
  'org.creazione': 'Creating...',
  'org.nuovaTitolo': 'New organisation',
  'org.nuovaDescrizione':
    "You'll become the owner of the new workspace, which starts empty. Your current organisation's data is left untouched.",
  'org.attiva': 'Active organisation',
  'org.creaNuova': 'Create a new organisation',
  'org.creata': 'Organisation "{nome}" created',
  'org.creazioneFallita': 'Creation failed',

  'account.disattivato': 'Account deactivated',
  'account.disattivatoDescrizione':
    'This account was deactivated by an administrator. Get in touch with them if you think this is a mistake.',

  'credenziali.titolo': 'Sign-in credentials',
  'credenziali.descrizione':
    "Hand these credentials to the user: the temporary password isn't emailed and won't be visible again once you close this window.",
  'credenziali.annotate': "I've written the credentials down",

  'comune.esci': 'Sign out',
  'comune.annulla': 'Cancel',
  'comune.caricamento': 'Loading…',
  'comune.lingua': 'Language',
  'comune.nessunaOrganizzazione': 'No active organisation',
  'comune.sessioneScaduta': 'Session expired, sign in again',
  'comune.inizializzazioneFallita': 'Initialisation failed',
  'comune.richiestaFallita': 'Request failed ({stato})',
  'comune.modificaNonSalvata': 'Change not saved',
  'comune.rispostaIncompleta': 'The server sent back an incomplete reply',
  'comune.utenteNonIndicato': 'No user was given',
  'comune.passwordNonRestituita': 'The server did not send back a password',
  'ai.nonConfigurata': 'AI features are not configured. Retrying will not help: contact an administrator.',
  'ai.nonDisponibile': 'The AI service is unreachable right now. Try again shortly.',
  'ai.tempoScaduto': 'The AI service took too long. Try again.',
  'ai.limiteRaggiunto': 'You have reached the AI request limit. Try again later.',
  'ai.testoTroppoLungo': 'The text is too long to process.',
  'ai.rifiutata': 'The AI service did not accept this request.',
  'email.nonPartita': 'Notification saved, but the email could not be sent',
};

/**
 * Italiano e inglese sono divisi in due: le chiavi semantiche stanno qui, le
 * stringhe del corpo dell'interfaccia in `traduzioni*.ts`, perche' l'inglese
 * per quelle non ha dizionario (la chiave E' il testo). Le lingue aggiunte
 * dopo non hanno questa asimmetria: un file solo, tutte le chiavi dentro.
 *
 * Il registro parte con le sole italiano e inglese e cresce a richiesta. I tre
 * dizionari aggiuntivi pesano 56 kB di sorgente ciascuno: tenerli qui come
 * import statici significava farli scaricare anche a chi usa l'applicazione in
 * italiano. Italiano e inglese restano invece statici perche' sono la rete di
 * sicurezza di `traduci()`, che e' sincrona e non puo' attendere nulla.
 */
const DIZIONARI: Partial<Record<Lingua, Partial<Record<ChiaveTraduzione, string>>>> = {
  it,
  en,
};

/**
 * Import scritti uno per uno, e non costruiti da una variabile: solo cosi'
 * Vite riconosce i tre moduli e li mette in tre pezzi separati. Un
 * `import(`./traduzioni-${lingua}`)` verrebbe risolto a runtime e finirebbe
 * per includerli tutti e tre, che e' esattamente il problema da evitare.
 */
const CARICATORI: Partial<
  Record<Lingua, () => Promise<Partial<Record<ChiaveTraduzione, string>>>>
> = {
  fr: () => import('./traduzioni-fr').then((m) => m.TESTI_FR),
  de: () => import('./traduzioni-de').then((m) => m.TESTI_DE),
  es: () => import('./traduzioni-es').then((m) => m.TESTI_ES),
};

/** Vero se la lingua ha un dizionario da scaricare prima di poter tradurre. */
export function richiedeCaricamento(lingua: Lingua): boolean {
  return CARICATORI[lingua] !== undefined && DIZIONARI[lingua] === undefined;
}

export function registraDizionario(
  lingua: Lingua,
  dizionario: Partial<Record<ChiaveTraduzione, string>>
): void {
  DIZIONARI[lingua] = dizionario;
}

// Le richieste in volo sono condivise: due componenti che chiedono la stessa
// lingua nello stesso istante (avvio + cambio rapido) devono generare una sola
// richiesta di rete e attendere la stessa promessa.
const inCorso = new Map<Lingua, Promise<void>>();

/**
 * Scarica e registra il dizionario di una lingua. Non lancia mai: se la rete
 * fallisce si prosegue con il ripiego di `traduci()` — un'interfaccia in
 * inglese o in italiano e' preferibile a una schermata bianca.
 */
export function caricaDizionario(lingua: Lingua): Promise<void> {
  if (!richiedeCaricamento(lingua)) return Promise.resolve();

  const gia = inCorso.get(lingua);
  if (gia) return gia;

  const caricatore = CARICATORI[lingua]!;
  const promessa = caricatore()
    .then((dizionario) => {
      registraDizionario(lingua, dizionario);
    })
    .catch((errore) => {
      // Un fallimento non va memorizzato per sempre: togliendo la promessa
      // dalla mappa, un successivo cambio lingua puo' ritentare.
      inCorso.delete(lingua);
      console.error(`Dizionario "${lingua}" non caricato:`, errore);
    });

  inCorso.set(lingua, promessa);
  return promessa;
}

/**
 * Corpo dell'interfaccia: chiave = stringa inglese originale.
 *
 * Per queste voci l'inglese non ha dizionario, perche' la chiave E' gia' il
 * testo inglese. E' il motivo per cui `traduci` distingue i due casi: per una
 * chiave semantica il ripiego e' l'italiano, per una stringa inglese il
 * ripiego e' la chiave stessa — che e' esattamente cio' che si vuole mostrare.
 */
function daCorpoInterfaccia(lingua: Lingua, chiave: string): string | undefined {
  if (lingua === 'it') return TESTI_IT[chiave];
  return TESTI_EN_EXTRA[chiave] ?? (TESTI_IT[chiave] ? chiave : undefined);
}

/**
 * Risolve una chiave nella lingua indicata.
 *
 * I segnaposto sono nella forma `{nome}` e vengono sostituiti con i valori
 * passati: e' l'unica forma di interpolazione prevista, perche' e' l'unica che
 * serve.
 */
export function traduci(
  lingua: Lingua,
  chiave: ChiaveTraduzione,
  parametri?: Record<string, string | number>
): string {
  // Ripiego sull'italiano, poi sulla chiave stessa: meglio una frase nella
  // lingua sbagliata che `org.creaTitolo` in mezzo all'interfaccia.
  const testo =
    DIZIONARI[lingua]?.[chiave] ??
    daCorpoInterfaccia(lingua, chiave as string) ??
    it[chiave] ??
    (chiave as string);

  if (!parametri) return testo;

  // `split`/`join` invece di `replaceAll`: il target del progetto e' ES2020,
  // dove replaceAll non esiste. Con una regex servirebbe l'escape del nome del
  // segnaposto, che qui non aggiunge nulla.
  return Object.entries(parametri).reduce(
    (acc, [nome, valore]) => acc.split(`{${nome}}`).join(String(valore)),
    testo
  );
}

/** Lingua da usare all'avvio: scelta salvata, poi browser, poi predefinita. */
export function linguaIniziale(): Lingua {
  if (typeof window === 'undefined') return LINGUA_PREDEFINITA;

  try {
    const salvata = window.localStorage.getItem('taskflow.lingua');
    if (salvata && salvata in LINGUE) return salvata as Lingua;
  } catch {
    // localStorage puo' essere inaccessibile (finestra privata, cookie
    // bloccati): non e' un motivo per non mostrare l'applicazione.
  }

  const browser = window.navigator?.language?.slice(0, 2);
  return browser && browser in LINGUE ? (browser as Lingua) : LINGUA_PREDEFINITA;
}
