/**
 * Le poche convenzioni per lingua che i modelli email non contengono.
 *
 * I testi delle email non stanno piu' qui. Questo file aveva una propria copia
 * dei messaggi, che pero' conosceva due tipi di notifica su dieci e non era
 * quella mostrata nell'editor dei modelli: l'anteprima e l'email spedita
 * potevano divergere senza che nessuno se ne accorgesse. Ora la sorgente e'
 * una sola, `modelliEmail.ts`, condivisa fra interfaccia e server.
 *
 * Restano qui le due cose che dipendono dalla lingua ma non dal testo: come si
 * scrive una data e come si chiama una priorita'. Il modello le riceve gia'
 * pronte, perche' dentro un modello personalizzabile c'e' solo un segnaposto —
 * `{{taskDueDate}}` — e la decisione su come riempirlo non puo' stare li'.
 *
 * Il perche' tutto questo stia sul server e non nel client non e' cambiato: la
 * lingua del DESTINATARIO sta in `user_state`, che le policy RLS rendono
 * leggibile solo al proprietario. Chi assegna il task non puo' conoscerla.
 */

export type LinguaEmail = 'it' | 'en' | 'fr' | 'de' | 'es';

export const LINGUE_EMAIL: LinguaEmail[] = ['it', 'en', 'fr', 'de', 'es'];

interface Convenzioni {
  priorita: Record<string, string>;
  localeData: string;
}

const CONVENZIONI: Record<LinguaEmail, Convenzioni> = {
  it: {
    priorita: { low: 'bassa', medium: 'media', high: 'alta' },
    localeData: 'it-IT',
  },
  en: {
    priorita: { low: 'low', medium: 'medium', high: 'high' },
    localeData: 'en-GB',
  },
  fr: {
    priorita: { low: 'basse', medium: 'moyenne', high: 'haute' },
    localeData: 'fr-FR',
  },
  de: {
    priorita: { low: 'niedrig', medium: 'mittel', high: 'hoch' },
    localeData: 'de-DE',
  },
  es: {
    priorita: { low: 'baja', medium: 'media', high: 'alta' },
    localeData: 'es-ES',
  },
};

/** Normalizza un valore arbitrario nella lingua di un'email supportata. */
export function linguaValida(valore: unknown): LinguaEmail {
  return LINGUE_EMAIL.includes(valore as LinguaEmail) ? (valore as LinguaEmail) : 'it';
}

/**
 * Formatta una data ISO nella convenzione della lingua indicata.
 *
 * Una data non riconoscibile viene restituita com'e': meglio una data in
 * formato tecnico che la parola "Invalid Date" dentro un'email.
 */
export function formattaData(lingua: LinguaEmail, iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return data.toLocaleDateString(CONVENZIONI[lingua].localeData);
}

/** Traduce il valore di priorita' del task nella lingua indicata. */
export function traduciPriorita(lingua: LinguaEmail, valore: string): string {
  return CONVENZIONI[lingua].priorita[valore] ?? valore;
}
