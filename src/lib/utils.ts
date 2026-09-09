import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Identificatore univoco per le entita' create nell'interfaccia.
 *
 * Sostituisce `Date.now().toString()`, che con due creazioni nello stesso
 * millisecondo produce lo stesso id — e non e' un caso di scuola: durante il
 * collaudo sono comparsi due task con id identico nello stesso array, quindi
 * indistinguibili per qualsiasi operazione successiva (modifica, eliminazione,
 * cambio di stato agivano su entrambi). Con piu' persone che lavorano insieme
 * la collisione diventa solo piu' probabile.
 *
 * `crypto.randomUUID` e' disponibile in tutti i browser supportati; il
 * fallback copre i contesti non sicuri (http su rete locale), dove non e'
 * esposta.
 */
export function newId(prefix?: string): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  return prefix ? `${prefix}-${uuid}` : uuid;
}
