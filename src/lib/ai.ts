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
        throw new AIError('Nessuna organizzazione attiva', 400);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new AIError('Sessione scaduta, accedi di nuovo', 401);
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
        // Il messaggio del server e' piu' utile di un generico "richiesta
        // fallita": distingue chiave mancante, rifiuto del modello e JSON
        // malformato, che richiedono azioni diverse.
        throw new AIError(
          payload.message || payload.error || traduci(linguaIniziale(), 'comune.richiestaFallita', { stato: response.status }),
          response.status
        );
      }

      return payload.text as string;
    },
    [organization?.id]
  );

  return { ask };
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
