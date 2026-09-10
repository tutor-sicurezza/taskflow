import Anthropic from '@anthropic-ai/sdk';

/**
 * Costruzione del client Anthropic e traduzione dei suoi errori in codici
 * stabili.
 *
 * Perche' esiste come modulo separato da api/ai/complete.ts: la rotta si
 * occupa di autorizzazione, tetti di spesa e conteggi; qui sta tutto cio' che
 * riguarda il PROVIDER. Le due cose falliscono per motivi diversi e vanno
 * spiegate all'utente in modi diversi.
 */

/**
 * Codici di errore restituiti al client.
 *
 * Sono stringhe stabili e non traducibili: il testo che l'utente legge lo
 * decide il client, che conosce la lingua scelta. Il server manda il codice
 * piu' un `message` tecnico, utile a chi guarda i log o la console di rete, mai
 * pensato per essere mostrato cosi' com'e'.
 *
 * La distinzione importante e' fra i codici di CONFIGURAZIONE (qualcuno deve
 * mettere le mani su Vercel: `ai_non_configurata`, `ai_chiave_non_valida`,
 * `ai_workspace_mancante`, `ai_credito_esaurito`, `ai_modello_non_disponibile`)
 * e quelli TEMPORANEI (`ai_provider_sovraccarico`, `ai_timeout`,
 * `ai_errore_temporaneo`): sui primi riprovare e' inutile, sui secondi e'
 * l'unica cosa sensata da fare.
 */
export type CodiceErroreAI =
  | 'ai_non_configurata'
  | 'ai_chiave_non_valida'
  | 'ai_workspace_mancante'
  | 'ai_credito_esaurito'
  | 'ai_modello_non_disponibile'
  | 'ai_richiesta_rifiutata'
  | 'ai_provider_sovraccarico'
  | 'ai_timeout'
  | 'ai_errore_temporaneo';

export interface ErroreAIClassificato {
  /** Codice stabile da tradurre lato client. */
  codice: CodiceErroreAI;
  /** Stato HTTP con cui rispondere. */
  stato: number;
  /** Dettaglio tecnico: log del server e, troncato, corpo della risposta. */
  message: string;
  /**
   * `true` quando serve un intervento su Vercel (chiave, workspace, credito).
   * Riprovare non cambia nulla, quindi il client puo' evitare i retry e
   * spegnere i comandi AI invece di riproporli.
   */
  configurazione: boolean;
}

/**
 * Timeout della singola chiamata al provider.
 *
 * Le funzioni di questo progetto girano su runtime edge, che ha un tetto suo
 * sulla durata dell'invocazione: se lo si supera la piattaforma tronca la
 * risposta e il client vede un 500 opaco, senza corpo JSON e senza nulla nei
 * log applicativi. Meglio arrendersi prima noi, con un codice leggibile.
 * Regolabile da env perche' il tetto della piattaforma dipende dal piano.
 */
const TIMEOUT_PREDEFINITO_MS = 20000;

export function timeoutProviderMs(): number {
  const letto = Number.parseInt(process.env.AI_TIMEOUT_MS ?? '', 10);
  // Come per i rate limit: un env scritto male non deve tradursi in
  // "nessun timeout".
  return Number.isFinite(letto) && letto > 0 ? letto : TIMEOUT_PREDEFINITO_MS;
}

/**
 * Client Anthropic configurato per questo ambiente.
 *
 * L'header `anthropic-workspace-id` e' il motivo per cui questa funzione
 * esiste: una chiave API creata a livello di ORGANIZZAZIONE (e non dentro un
 * workspace) fa rispondere 400 a qualunque richiesta finche' non le si dice a
 * quale workspace addebitare i token. E' il guasto visto in produzione.
 *
 * L'header viene mandato SOLO se ANTHROPIC_WORKSPACE_ID e' valorizzata: una
 * chiave gia' legata a un workspace con l'header addosso romperebbe il caso
 * opposto, quindi non lo si manda "per sicurezza".
 */
export function creaClientAnthropic(apiKey: string): Anthropic {
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim();

  return new Anthropic({
    apiKey,
    timeout: timeoutProviderMs(),
    // Il default dell'SDK e' 2 tentativi extra: su edge, con un tetto di durata
    // stretto, tre chiamate in fila consumano il tempo che serve alla prima per
    // andare a buon fine. Un solo ritentativo copre il blip di rete senza
    // trasformare un 429 in un timeout della piattaforma.
    maxRetries: 1,
    ...(workspaceId
      ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } }
      : {}),
  });
}

/** `true` se l'header workspace verra' inviato: solo per diagnostica nei log. */
export function workspaceConfigurato(): boolean {
  return Boolean(process.env.ANTHROPIC_WORKSPACE_ID?.trim());
}

function testoErrore(e: unknown): string {
  if (e instanceof Anthropic.APIError) {
    // `error` e' il corpo JSON del provider: contiene il messaggio vero
    // ("This API key is not scoped to a workspace...") su cui si basa il
    // riconoscimento qui sotto. `message` da solo a volte e' solo lo stato.
    const corpo =
      typeof e.error === 'object' && e.error !== null ? JSON.stringify(e.error) : '';
    return `${e.message} ${corpo}`;
  }
  return e instanceof Error ? e.message : String(e);
}

/**
 * Traduce un errore del provider in un codice stabile.
 *
 * Il caso 400/workspace si riconosce dal TESTO e non dallo stato, perche'
 * Anthropic usa 400 anche per prompt malformati e credito esaurito: senza
 * guardare il messaggio finirebbero tutti nello stesso codice, e l'utente
 * riceverebbe "riprova piu' tardi" per un problema che nessun tentativo
 * risolvera'.
 */
export function classificaErroreAI(e: unknown): ErroreAIClassificato {
  const testo = testoErrore(e);
  const minuscolo = testo.toLowerCase();
  const stato = e instanceof Anthropic.APIError ? e.status : undefined;

  // Timeout e caduta di connessione: gli unici errori davvero transitori per
  // costruzione. Vanno prima del resto perche' non portano uno stato HTTP.
  if (
    e instanceof Anthropic.APIConnectionTimeoutError ||
    (e instanceof Error && e.name === 'AbortError') ||
    minuscolo.includes('timeout')
  ) {
    return {
      codice: 'ai_timeout',
      stato: 504,
      message: testo,
      configurazione: false,
    };
  }

  if (e instanceof Anthropic.APIConnectionError) {
    return {
      codice: 'ai_provider_sovraccarico',
      stato: 503,
      message: testo,
      configurazione: false,
    };
  }

  // La falla vista in produzione: chiave valida ma non legata a un workspace.
  if (minuscolo.includes('anthropic-workspace-id') || minuscolo.includes('workspace')) {
    return {
      codice: 'ai_workspace_mancante',
      stato: 503,
      message: testo,
      configurazione: true,
    };
  }

  // Credito finito: arriva come 400, ma e' un problema di chi paga, non di chi
  // chiede. Confonderlo con "richiesta non valida" manda l'utente a cercare un
  // bug nel prompt.
  if (
    minuscolo.includes('credit balance') ||
    minuscolo.includes('billing') ||
    minuscolo.includes('quota') ||
    minuscolo.includes('insufficient')
  ) {
    return {
      codice: 'ai_credito_esaurito',
      stato: 503,
      message: testo,
      configurazione: true,
    };
  }

  if (stato === 401 || stato === 403) {
    return {
      codice: 'ai_chiave_non_valida',
      stato: 503,
      message: testo,
      configurazione: true,
    };
  }

  // 404 su /v1/messages significa "questo id di modello non esiste": e' un
  // errore di configurazione nostro (whitelist disallineata al listino), non
  // qualcosa che l'utente possa risolvere riprovando.
  // Volutamente NON si cerca la parola 'model' in un 400 qualunque: comparirebbe
  // anche in errori di parametri, e un prompt sbagliato verrebbe segnalato come
  // guasto di configurazione.
  if (stato === 404 || minuscolo.includes('not_found_error')) {
    return {
      codice: 'ai_modello_non_disponibile',
      stato: 503,
      message: testo,
      configurazione: true,
    };
  }

  if (stato === 429) {
    return {
      codice: 'ai_provider_sovraccarico',
      stato: 429,
      message: testo,
      configurazione: false,
    };
  }

  if (stato !== undefined && stato >= 500) {
    return {
      codice: 'ai_provider_sovraccarico',
      stato: 503,
      message: testo,
      configurazione: false,
    };
  }

  if (stato === 400) {
    return {
      codice: 'ai_richiesta_rifiutata',
      stato: 400,
      message: testo,
      configurazione: false,
    };
  }

  return {
    codice: 'ai_errore_temporaneo',
    stato: 502,
    message: testo,
    configurazione: false,
  };
}

/**
 * Corpo JSON di risposta per un errore del provider.
 *
 * Il dettaglio tecnico viene troncato: il messaggio del provider puo' contenere
 * pezzi del prompt, e il corpo della risposta finisce nella console del
 * browser di chiunque. I log del server tengono la versione integrale.
 */
export function corpoErroreAI(errore: ErroreAIClassificato) {
  return {
    error: errore.codice,
    message: errore.message.slice(0, 300),
    configurazione: errore.configurazione,
  };
}
