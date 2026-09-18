import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { traduci, linguaIniziale } from '@/lib/i18n';

/**
 * Sostituto di `window.spark.llm`, che girava nel browser appoggiandosi alle
 * credenziali del runtime GitHub Spark. Qui la chiamata passa da /api/ai/complete
 * e la chiave API resta lato server.
 *
 * La firma resta stringa -> stringa come l'originale, cosi' i chiamanti
 * continuano a fare JSON.parse sul risultato senza altre modifiche. La
 * differenza e' che quando si chiede JSON il server lo valida prima di
 * restituirlo: JSON.parse non esplode piu' su output malformato.
 */

export interface AskOptions {
  /** Chiedi al modello di rispondere in JSON. Il server valida prima di restituire. */
  json?: boolean;
  /**
   * Schema JSON del risultato atteso. Se presente, il formato e' garantito
   * dall'API invece di essere solo richiesto nel prompt.
   */
  schema?: Record<string, unknown>;
  /** Sovrascrive il modello di default configurato lato server. */
  model?: string;
}

export class AIError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AIError';
    this.status = status;
  }
}

export function useAI() {
  const { organization } = useAuth();

  const ask = useCallback(
    async (prompt: string, options: AskOptions = {}): Promise<string> => {
      if (!organization?.id) {
        throw new AIError('comune.nessunaOrganizzazione', 400);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new AIError('comune.sessioneScaduta', 401);
      }

      const response = await window.fetch('/api/ai/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          tenantId: organization.id,
          prompt,
          json: options.json ?? false,
          schema: options.schema,
          model: options.model,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new AIError(fraseErrore(payload, response.status), response.status);
      }

      /*
        Un 200 non basta: dentro ci deve essere del testo.

        Qui c'era `return payload.text as string`, e il cast diceva una cosa
        non vera. Una risposta con stato 200 e un corpo senza `text` — o non
        JSON, che il `.catch` qui sopra trasforma in `{}` — passava per
        riuscita e la funzione restituiva `undefined`. Ogni chiamante fa
        `JSON.parse` su quel valore, quindi a schermo compariva l'avviso
        `"undefined" is not valid JSON`: un messaggio che non dice a nessuno
        cosa e' successo ne' cosa fare, e che contraddiceva la promessa scritta
        in testa a questo file — "JSON.parse non esplode piu'".

        Non e' un caso di laboratorio. Lo danno una pagina di protezione del
        deploy, un `api/` non pubblicato, un proxy che intercetta: tutti
        rispondono 200 con dell'HTML. `risposta_vuota` esiste gia' fra i codici
        del server e si traduce in una frase che dice di riprovare, che e'
        esattamente il consiglio giusto.
      */
      const testo = testoDaRisposta(payload);
      if (testo === null) {
        throw new AIError(
          fraseErrore({ error: 'risposta_vuota' }, response.status),
          response.status
        );
      }

      return testo;
    },
    [organization?.id]
  );

  return { ask };
}

/**
 * Traduce il codice d'errore del server in una frase per l'utente.
 *
 * Il server risponde con codici stabili (`ai_workspace_mancante`,
 * `limite_richieste_superato`, ...) piu' un `message` tecnico in inglese.
 * Prima quel messaggio finiva dritto a schermo: chi usava l'applicazione
 * leggeva il JSON grezzo del fornitore, comprensivo di istruzioni su quale
 * header HTTP aggiungere.
 *
 * I codici sono raggruppati per COSA PUO' FARE chi legge, non per causa
 * tecnica: se serve un intervento su una configurazione, riprovare e' inutile
 * e va detto; se il servizio e' occupato, riprovare ha senso. Il dettaglio
 * tecnico resta nei log del server, dove serve a chi ripara.
 */
/**
 * Il testo utile dentro una risposta riuscita, oppure `null`.
 *
 * Sta fuori dall'hook perche' e' l'unica decisione interessante di `ask`, e
 * dentro un `useCallback` si potrebbe verificare solo montando un componente
 * React. `null` e non una stringa vuota: chi chiama fa `JSON.parse`, e su `''`
 * esplode esattamente come su `undefined`.
 */
export function testoDaRisposta(payload: unknown): string | null {
  /*
    Il solo guardiano necessario e' quello su null.

    La prima versione controllava anche `typeof payload === 'object'` e
    `!Array.isArray(payload)`. Una prova per mutazione ha mostrato che erano
    rami morti: togliendoli, nessun test cambiava esito, perche' leggere `.text`
    da una stringa, da un numero o da un array restituisce `undefined` e il
    controllo qui sotto lo respinge comunque. Su `null` invece esplode, e quello
    va fermato. Un controllo che nessuna prova puo' distinguere e' rumore: lo si
    toglie, non lo si lascia a rassicurare chi legge.
  */
  if (payload === null || payload === undefined) return null;
  const testo = (payload as { text?: unknown }).text;
  if (typeof testo !== 'string' || !testo.trim()) return null;
  return testo;
}

function fraseErrore(payload: Record<string, unknown>, stato: number): string {
  const codice = typeof payload.error === 'string' ? payload.error : '';
  const lingua = linguaIniziale();

  const gruppi: Record<string, string[]> = {
    'ai.nonConfigurata': [
      'ai_non_configurata',
      'ai_chiave_non_valida',
      'ai_workspace_mancante',
      'ai_credito_esaurito',
      'ai_modello_non_disponibile',
      'modello_non_consentito',
    ],
    'ai.nonDisponibile': [
      'ai_provider_sovraccarico',
      'ai_errore_temporaneo',
      'risposta_troncata',
      'risposta_vuota',
      'json_non_valido',
    ],
    'ai.tempoScaduto': ['ai_timeout'],
    'ai.limiteRaggiunto': ['limite_richieste_superato'],
    'ai.testoTroppoLungo': ['prompt_troppo_lungo'],
    'ai.rifiutata': ['ai_richiesta_rifiutata', 'risposta_rifiutata'],
  };

  for (const [chiave, codici] of Object.entries(gruppi)) {
    if (codici.includes(codice)) return traduci(lingua, chiave);
  }

  return traduci(lingua, 'comune.richiestaFallita', { stato });
}

/**
 * Dice se le funzioni AI sono realmente utilizzabili.
 *
 * Serve perche' i comandi AI erano sempre visibili: senza ANTHROPIC_API_KEY
 * l'endpoint risponde 503 e l'utente scopriva la cosa solo premendo il
 * pulsante. `undefined` significa "non ancora saputo", cosi' l'interfaccia non
 * fa lampeggiare i comandi mentre la risposta arriva.
 */
export interface AIStatus {
  /** `undefined` finche' la risposta non e' arrivata. */
  available: boolean | undefined;
  /** Motivo dell'indisponibilita', da mostrare a chi puo' rimediare. */
  reason?: string;
}

export function useAIAvailability(): AIStatus {
  const { organization } = useAuth();
  const [stato, setStato] = useState<AIStatus>({ available: undefined });

  useEffect(() => {
    if (!organization?.id) return;
    let cancelled = false;

    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) return;

        const response = await window.fetch('/api/ai/complete', {
          method: 'GET',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (cancelled) return;

        if (!response.ok) {
          setStato({ available: false, reason: `HTTP ${response.status}` });
          return;
        }

        const payload = await response.json().catch(() => ({}));
        setStato({
          available: Boolean(payload?.available),
          reason: typeof payload?.reason === 'string' ? payload.reason : undefined,
        });
      } catch {
        // In sviluppo con `npm run dev` le rotte api/ non rispondono affatto:
        // trattarlo come "non disponibile" e' esattamente il comportamento
        // giusto, perche' non lo e'.
        if (!cancelled) {
          setStato({
            available: false,
            reason: 'endpoint non raggiungibile (con `npm run dev` le rotte api/ non rispondono)',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [organization?.id]);

  return stato;
}
