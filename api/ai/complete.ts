import Anthropic from '@anthropic-ai/sdk';

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

  const apiKey = process.env.ANTHROPIC_API_KEY;

  /**
   * Sonda di disponibilita'.
   *
   * L'interfaccia mostrava i comandi AI anche quando la chiave non era
   * configurata: l'utente li premeva e riceveva un errore 503 in faccia, senza
   * modo di capire che la funzione non e' attiva. Con questa GET il client
   * puo' chiederlo prima e non proporre cio' che non c'e'. Non consuma token e
   * non rivela nulla oltre a un booleano — resta comunque dietro
   * l'autenticazione.
   */
  /**
   * Chiavi non legate a un workspace.
   *
   * Una chiave a livello di organizzazione richiede l'header
   * `anthropic-workspace-id`, altrimenti Anthropic risponde 400 a QUALUNQUE
   * richiesta. E' il caso incontrato in produzione. Impostando
   * ANTHROPIC_WORKSPACE_ID la chiave diventa utilizzabile senza doverla
   * sostituire; una chiave gia' legata a un workspace ignora l'header.
   */
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
  const opzioniClient = (key: string) => ({
    apiKey: key,
    ...(workspaceId
      ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } }
      : {}),
  });

  if (request.method === 'GET') {
    if (!apiKey) {
      return jsonResponse({
        available: false,
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
      const anthropic = new Anthropic(opzioniClient(apiKey));
      await anthropic.models.list({ limit: 1 });
      return jsonResponse({ available: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'chiave non utilizzabile';
      console.error('[ai] chiave non utilizzabile:', message);
      return jsonResponse({ available: false, reason: message.slice(0, 300) });
    }
  }

  if (!apiKey) {
    return jsonResponse(
      {
        error: 'AI service not configured',
        message: 'ANTHROPIC_API_KEY is not set',
      },
      { status: 503 }
    );
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  const body = await request.json().catch(() => ({}));
  const tenantId = typeof body.tenantId === 'string' ? body.tenantId : '';
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const wantsJson = body.json === true;
  const schema = body.schema && typeof body.schema === 'object' ? body.schema : null;
  const model = typeof body.model === 'string' && body.model ? body.model : DEFAULT_MODEL;

  if (!tenantId) {
    return jsonResponse({ error: 'tenantId is required' }, { status: 400 });
  }
  if (!prompt) {
    return jsonResponse({ error: 'prompt is required' }, { status: 400 });
  }
  if (!ALLOWED_MODELS.has(model)) {
    return jsonResponse(
      {
        error: 'Model not allowed',
        message: `Il modello '${model}' non e' consentito. Modelli disponibili: ${[
          ...ALLOWED_MODELS,
        ].join(', ')}.`,
      },
      { status: 400 }
    );
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return jsonResponse(
      {
        error: 'Prompt too large',
        message: `Il prompt supera il limite di ${MAX_PROMPT_CHARS} caratteri (ricevuti ${prompt.length}).`,
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
    return jsonResponse(
      {
        error: 'Rate limit check failed',
        message: userUsage.error?.message ?? orgUsage.error?.message ?? 'Errore interno',
      },
      { status: 500 }
    );
  }

  const overUser = (userUsage.count ?? 0) >= USER_HOURLY_LIMIT;
  const overOrg = (orgUsage.count ?? 0) >= ORG_HOURLY_LIMIT;

  if (overUser || overOrg) {
    const scope = overUser ? 'il tuo utente' : 'la tua organizzazione';
    const limit = overUser ? USER_HOURLY_LIMIT : ORG_HOURLY_LIMIT;
    return jsonResponse(
      {
        error: 'Rate limit exceeded',
        message: `Limite di ${limit} richieste AI all'ora raggiunto per ${scope}. Riprova fra un'ora.`,
      },
      { status: 429, headers: { 'retry-after': '3600' } }
    );
  }

  const client = new Anthropic(opzioniClient(apiKey));

  const response = await client.messages.create({
    model,
    // Tetto lato server: qualunque valore chieda il client, l'output — cioe' la
    // parte piu' cara della richiesta — non puo' superare questa soglia.
    max_tokens: MAX_OUTPUT_TOKENS,
    messages: [{ role: 'user', content: prompt }],
    // Quando il chiamante fornisce uno schema il formato e' garantito dall'API,
    // non semplicemente richiesto nel prompt: JSON.parse lato client non puo'
    // piu' fallire su output malformato.
    ...(wantsJson && schema
      ? { output_config: { format: { type: 'json_schema' as const, schema } } }
      : {}),
  });

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
      { error: 'Request declined', message: 'Il modello ha rifiutato la richiesta.' },
      { status: 422 }
    );
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  if (!text) {
    return jsonResponse({ error: 'Empty response from model' }, { status: 502 });
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
        { error: 'Model did not return valid JSON', raw: text.slice(0, 500) },
        { status: 502 }
      );
    }

    return jsonResponse({ text: cleaned, model: response.model });
  }

  return jsonResponse({ text, model: response.model });
});
