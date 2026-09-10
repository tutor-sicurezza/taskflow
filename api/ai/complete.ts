/**
 * Runtime edge, come tutte le altre rotte di api/.
 *
 * Mancava, ed e' una delle ragioni per cui questa rotta poteva rispondere 500
 * senza corpo: senza questa riga Vercel compila il file per il runtime Node,
 * che cerca un `export default` e non l'`export const fetch` usato qui e in
 * tutti gli altri handler del progetto. Il risultato e' un
 * FUNCTION_INVOCATION_FAILED, cioe' un 500 che non passa mai da withErrors e
 * quindi non lascia traccia utile nei log.
 */
export const runtime = 'edge';

import Anthropic from '@anthropic-ai/sdk';

import {
  classificaErroreAI,
  corpoErroreAI,
  creaClientAnthropic,
  workspaceConfigurato,
} from '../_lib/aiProvider.js';
import {
  createSupabaseAdminClient,
  ensureTenantMembership,
  getAuthenticatedUser,
  jsonResponse,
  withErrors,
} from '../_lib/supabase.js';

/**
 * Endpoint unico per tutte le funzioni AI dell'app.
 *
 * Perche' esiste: i componenti AI chiamavano window.spark.llm DAL BROWSER.
 * Funzionava solo perche' il runtime GitHub Spark faceva da proxy con le proprie
 * credenziali. Con un provider vero quel percorso non e' replicabile: una chiave
 * API nel bundle del client e' leggibile da chiunque apra i DevTools. La chiave
 * resta quindi qui, lato server, e il client passa da questa rotta.
 *
 * Chi puo' chiamarlo: solo utenti autenticati e membri dell'organizzazione
 * indicata. Senza questo controllo l'endpoint sarebbe un modo gratuito per
 * chiunque di consumare token a spese del titolare della chiave.
 *
 * Sui codici di errore: il campo `error` di ogni risposta non-2xx e' un codice
 * stabile in snake_case, non una frase. Le frasi che l'utente legge le compone
 * il client, che sa in che lingua sta parlando; qui accanto al codice viaggia
 * solo un `message` tecnico per i log e la console di rete.
 */

const DEFAULT_MODEL = 'claude-opus-5';

/**
 * Il modello arrivava dal body senza controlli: chiunque passasse per questa
 * rotta poteva chiedere il modello piu' costoso del listino (o un id inventato,
 * che si traduce in un 404 di Anthropic restituito come 500 al client). Il
 * costo per token varia di un ordine di grandezza fra i modelli, quindi la
 * scelta non puo' stare al chiamante. Lista esplicita e non regex: una regex
 * su 'claude-*' continuerebbe ad accettare qualunque modello futuro, incluso
 * il prossimo che costa dieci volte tanto.
 *
 * Gli id sono quelli correnti e vanno usati NUDI, senza suffisso di data: gli
 * alias datati che si vedono in giro (`claude-haiku-4-5-20251001`) sono
 * snapshot storici e non sono l'identificatore da usare qui.
 */
const ALLOWED_MODELS = new Set([
  'claude-opus-5',
  'claude-sonnet-5',
  'claude-haiku-4-5',
]);

/**
 * Tetti sulla singola richiesta. max_tokens era gia' fisso a 4096, ma il prompt
 * no: un prompt da qualche megabyte costa in input quanto centinaia di
 * richieste normali, e nessuna funzione dell'app ne ha bisogno.
 */
const MAX_OUTPUT_TOKENS = 4096;
const MAX_PROMPT_CHARS = 24000;

/**
 * Soglie orarie. Sono la difesa vera contro la spesa non limitata: i tetti per
 * richiesta limitano il costo di UNA chiamata, queste limitano quante ne puoi
 * fare. Leggibili da env per poterle alzare in produzione senza un deploy di
 * codice; i default sono tarati sull'uso umano dell'app (l'assistente AI, la
 * stima dei task), non sull'uso da script.
 */
const USER_HOURLY_LIMIT = readLimit('AI_RATE_LIMIT_USER_HOUR', 30);
const ORG_HOURLY_LIMIT = readLimit('AI_RATE_LIMIT_ORG_HOUR', 200);

function readLimit(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  // Un env var scritto male non deve tradursi in "nessun limite": in caso di
  // valore non numerico o non positivo si torna al default.
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const fetch = withErrors(async (request: Request) => {
  const user = await getAuthenticatedUser(request);

  // `trim()` perche' una variabile incollata su Vercel con uno spazio o un a
  // capo in coda non e' vuota ma non e' nemmeno una chiave: senza questo
  // arriverebbe intatta ad Anthropic e tornerebbe un 401 incomprensibile.
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

  if (request.method === 'GET') {
    /**
     * Sonda di disponibilita'.
     *
     * L'interfaccia mostrava i comandi AI anche quando la chiave non era
     * configurata: l'utente li premeva e riceveva un errore in faccia, senza
     * modo di capire che la funzione non e' attiva. Con questa GET il client
     * puo' chiederlo prima e non proporre cio' che non c'e'. Non consuma token
     * e non rivela nulla oltre a un booleano e a un codice — resta comunque
     * dietro l'autenticazione.
     */
    if (!apiKey) {
      return jsonResponse({
        available: false,
        error: 'ai_non_configurata',
        reason: 'ANTHROPIC_API_KEY non e configurata su questo ambiente',
      });
    }

    // Non basta che la chiave ESISTA: deve funzionare.
    //
    // La prima versione di questa sonda controllava solo `Boolean(apiKey)`, e
    // in produzione ha dato "disponibile" con una chiave valida ma NON legata
    // a un workspace. Risultato: l'interfaccia mostrava tutte le funzioni AI e
    // ognuna falliva al primo clic con un 400 di Anthropic. Esattamente lo
    // scenario che la sonda doveva evitare.
    //
    // L'elenco dei modelli e' la verifica giusta: valida chiave, permessi e
    // scope reali senza generare token, quindi senza costo.
    try {
      const anthropic = creaClientAnthropic(apiKey);
      await anthropic.models.list({ limit: 1 });
      return jsonResponse({ available: true });
    } catch (e) {
      const errore = classificaErroreAI(e);
      console.error(
        `[ai/complete] sonda fallita (${errore.codice}, workspace header ${
          workspaceConfigurato() ? 'presente' : 'assente'
        }):`,
        errore.message
      );
      // La sonda risponde sempre 200: il suo esito E' il corpo. Un non-2xx qui
      // diventerebbe "HTTP 500" nel client, che e' meno informativo del codice.
      return jsonResponse({
        available: false,
        error: errore.codice,
        reason: errore.message.slice(0, 300),
        configurazione: errore.configurazione,
      });
    }
  }

  if (request.method !== 'POST') {
    return jsonResponse(
      { error: 'metodo_non_consentito', message: `Metodo ${request.method} non gestito` },
      { status: 405 }
    );
  }

  if (!apiKey) {
    console.error('[ai/complete] ANTHROPIC_API_KEY assente su questo ambiente');
    return jsonResponse(
      {
        error: 'ai_non_configurata',
        message: 'ANTHROPIC_API_KEY is not set',
        configurazione: true,
      },
      { status: 503 }
    );
  }

  // Un body non-JSON diventava `{}` e proseguiva fino ai controlli sui campi:
  // funzionava, ma l'utente riceveva "tenantId mancante" per un problema di
  // formato. Distinguerlo costa una riga e rende leggibile il log.
  let body: Record<string, unknown>;
  try {
    const letto: unknown = await request.json();
    if (!letto || typeof letto !== 'object' || Array.isArray(letto)) {
      throw new Error('il corpo non e un oggetto JSON');
    }
    body = letto as Record<string, unknown>;
  } catch (e) {
    return jsonResponse(
      {
        error: 'corpo_non_valido',
        message: e instanceof Error ? e.message : 'corpo della richiesta illeggibile',
      },
      { status: 400 }
    );
  }

  const tenantId = typeof body.tenantId === 'string' ? body.tenantId : '';
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const wantsJson = body.json === true;
  const schema =
    body.schema && typeof body.schema === 'object' && !Array.isArray(body.schema)
      ? (body.schema as Record<string, unknown>)
      : null;
  const model =
    typeof body.model === 'string' && body.model ? body.model : DEFAULT_MODEL;

  if (!tenantId) {
    return jsonResponse(
      { error: 'tenant_mancante', message: 'tenantId is required' },
      { status: 400 }
    );
  }
  if (!prompt) {
    return jsonResponse(
      { error: 'prompt_mancante', message: 'prompt is required' },
      { status: 400 }
    );
  }
  if (!ALLOWED_MODELS.has(model)) {
    return jsonResponse(
      {
        error: 'modello_non_consentito',
        message: `Model '${model}' is not allowed. Allowed: ${[...ALLOWED_MODELS].join(', ')}.`,
        // Dati grezzi accanto al codice: il client compone la frase tradotta
        // senza doversi ricostruire l'elenco.
        model,
        allowedModels: [...ALLOWED_MODELS],
      },
      { status: 400 }
    );
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return jsonResponse(
      {
        error: 'prompt_troppo_lungo',
        message: `Prompt of ${prompt.length} chars exceeds the ${MAX_PROMPT_CHARS} limit.`,
        limit: MAX_PROMPT_CHARS,
        length: prompt.length,
      },
      { status: 413 }
    );
  }

  await ensureTenantMembership(user.id, tenantId);

  // Il conteggio va fatto PRIMA di chiamare Anthropic: contare dopo
  // significherebbe pagare comunque la richiesta che supera la soglia.
  const admin = createSupabaseAdminClient();
  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const [userUsage, orgUsage] = await Promise.all([
    admin
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', windowStart),
    admin
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', tenantId)
      .gte('created_at', windowStart),
  ]);

  // Se il conteggio fallisce si chiude, non si apre: un errore del database non
  // deve diventare una finestra di spesa illimitata.
  if (userUsage.error || orgUsage.error) {
    const dettaglio = userUsage.error?.message ?? orgUsage.error?.message ?? 'errore interno';
    console.error('[ai/complete] verifica dei limiti fallita:', dettaglio);
    return jsonResponse(
      { error: 'verifica_limiti_fallita', message: dettaglio },
      { status: 500 }
    );
  }

  const overUser = (userUsage.count ?? 0) >= USER_HOURLY_LIMIT;
  const overOrg = (orgUsage.count ?? 0) >= ORG_HOURLY_LIMIT;

  if (overUser || overOrg) {
    return jsonResponse(
      {
        error: 'limite_richieste_superato',
        message: `Hourly AI limit reached (${overUser ? 'user' : 'organization'}).`,
        // 'user' | 'organization' e il numero: il client li usa per comporre la
        // frase tradotta, senza doverli dedurre da un testo.
        scope: overUser ? 'user' : 'organization',
        limit: overUser ? USER_HOURLY_LIMIT : ORG_HOURLY_LIMIT,
        retryAfterSeconds: 3600,
      },
      { status: 429, headers: { 'retry-after': '3600' } }
    );
  }

  const client = creaClientAnthropic(apiKey);

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model,
      // Tetto lato server: qualunque valore chieda il client, l'output — cioe'
      // la parte piu' cara della richiesta — non puo' superare questa soglia.
      max_tokens: MAX_OUTPUT_TOKENS,
      // Il ragionamento esteso e' attivo per default sui modelli attuali e
      // consuma i token di max_tokens prima ancora della risposta: con un
      // tetto di 4096 una domanda difficile puo' esaurirlo pensando e tornare
      // senza testo. Le funzioni di questa app (stimare un task, riassumere
      // una board) non ne hanno bisogno, quindi si tiene lo sforzo basso:
      // meno token bruciati, meno latenza sotto il tetto del runtime edge.
      output_config: {
        effort: 'low',
        // Quando il chiamante fornisce uno schema il formato e' garantito
        // dall'API, non semplicemente richiesto nel prompt: JSON.parse lato
        // client non puo' piu' fallire su output malformato.
        ...(wantsJson && schema
          ? { format: { type: 'json_schema' as const, schema } }
          : {}),
      },
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (e) {
    // Qui finiva il guasto di produzione: l'eccezione risaliva a withErrors,
    // che ne prendeva `message` — cioe' il JSON grezzo del provider — e lo
    // spediva al client come 500. L'utente leggeva un errore scritto per chi
    // gestisce le chiavi API. Ora il dettaglio resta nei log e al client va un
    // codice che sa tradurre.
    const errore = classificaErroreAI(e);
    console.error(
      `[ai/complete] chiamata al provider fallita (${errore.codice}, modello ${model}, workspace header ${
        workspaceConfigurato() ? 'presente' : 'assente'
      }):`,
      errore.message
    );
    return jsonResponse(corpoErroreAI(errore), { status: errore.stato });
  }

  // Si registra qui, appena la chiamata torna, non dopo la validazione del
  // JSON piu' sotto: i token sono gia' stati consumati e fatturati anche quando
  // la risposta si rivela inutilizzabile per il client. Contarli solo sui
  // successi lascerebbe fuori dal limite proprio le richieste che sprecano
  // soldi. L'insert non blocca la risposta: se il logging fallisce si perde una
  // riga di contatore, non l'output gia' pagato.
  const { error: usageError } = await admin.from('ai_usage').insert({
    organization_id: tenantId,
    user_id: user.id,
    model: response.model,
    input_tokens: response.usage?.input_tokens ?? 0,
    output_tokens: response.usage?.output_tokens ?? 0,
  });
  if (usageError) {
    console.error('[ai/complete] impossibile registrare ai_usage:', usageError.message);
  }

  // stop_reason 'refusal' arriva con HTTP 200 e content vuoto: leggere
  // content[0] senza controllare esploderebbe.
  if (response.stop_reason === 'refusal') {
    return jsonResponse(
      {
        error: 'risposta_rifiutata',
        message: `Model refused the request (${response.stop_details?.category ?? 'senza categoria'}).`,
      },
      { status: 422 }
    );
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  if (!text) {
    // Distinguere il troncamento dal vuoto: 'max_tokens' vuol dire che il tetto
    // e' troppo basso per questo prompt — un problema nostro, non del provider —
    // e riproporre la stessa richiesta dara' lo stesso esito.
    const troncata = response.stop_reason === 'max_tokens';
    return jsonResponse(
      {
        error: troncata ? 'risposta_troncata' : 'risposta_vuota',
        message: `Nessun blocco di testo nella risposta (stop_reason: ${response.stop_reason ?? 'assente'}).`,
      },
      { status: 502 }
    );
  }

  if (wantsJson) {
    // Senza schema il modello puo' incorniciare il JSON in un blocco markdown.
    // Lo ripuliamo e validiamo QUI: meglio un errore esplicito lato server che
    // un JSON.parse che esplode dentro un componente React.
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '');

    try {
      JSON.parse(cleaned);
    } catch {
      return jsonResponse(
        {
          error: 'json_non_valido',
          message: 'Il modello non ha restituito JSON valido.',
          raw: text.slice(0, 500),
        },
        { status: 502 }
      );
    }

    return jsonResponse({ text: cleaned, model: response.model });
  }

  return jsonResponse({ text, model: response.model });
});
