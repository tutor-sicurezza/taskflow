/**
 * Testi delle email di notifica, nelle lingue supportate.
 *
 * Vivono sul server, non nel client, per un motivo che non e' organizzativo ma
 * di permessi: l'email va scritta nella lingua di CHI LA RICEVE, e quella
 * preferenza sta in `user_state`, leggibile solo dal proprietario (RLS). Il
 * browser di chi assegna il task non puo' quindi conoscerla. L'endpoint, che
 * gira con il service role, si'.
 *
 * Prima la composizione avveniva nel client e usava le stringhe italiane
 * fisse: un destinatario che aveva scelto l'inglese riceveva comunque
 * un'email in italiano.
 */

export type LinguaEmail = 'it' | 'en' | 'fr' | 'de' | 'es';

export const LINGUE_EMAIL: LinguaEmail[] = ['it', 'en', 'fr', 'de', 'es'];

export interface ParametriTask {
  recipientName: string;
  taskTitle: string;
  taskDescription?: string;
  dueDate?: string;
  priority?: string;
  assignedByName: string;
  kind: 'assigned' | 'reassigned';
}

interface Testi {
  oggetto: (azione: string, titolo: string) => string;
  azione: Record<'assigned' | 'reassigned', string>;
  saluto: (nome: string) => string;
  frase: (autore: string, azione: string, titolo: string) => string;
  scadenza: string;
  priorita: string;
  priorita_valori: Record<string, string>;
  chiusura: string;
  localeData: string;
}

const TESTI: Record<LinguaEmail, Testi> = {
  it: {
    oggetto: (azione, titolo) => `Attività ${azione}: ${titolo}`,
    azione: { assigned: 'assegnata', reassigned: 'riassegnata' },
    saluto: (nome) => `Ciao ${nome},`,
    frase: (autore, azione, titolo) =>
      `${autore} ti ha ${azione} l'attività "${titolo}".`,
    scadenza: 'Scadenza',
    priorita: 'Priorità',
    priorita_valori: { low: 'bassa', medium: 'media', high: 'alta' },
    chiusura: 'Apri TaskFlow per vedere i dettagli.',
    localeData: 'it-IT',
  },
  en: {
    oggetto: (azione, titolo) => `Task ${azione}: ${titolo}`,
    azione: { assigned: 'assigned', reassigned: 'reassigned' },
    saluto: (nome) => `Hi ${nome},`,
    frase: (autore, azione, titolo) =>
      `${autore} ${azione} you the task "${titolo}".`,
    scadenza: 'Due date',
    priorita: 'Priority',
    priorita_valori: { low: 'low', medium: 'medium', high: 'high' },
    chiusura: 'Open TaskFlow to see the details.',
    localeData: 'en-GB',
  },
  fr: {
    oggetto: (azione, titolo) => `Tâche ${azione} : ${titolo}`,
    azione: { assigned: 'attribuée', reassigned: 'réattribuée' },
    saluto: (nome) => `Bonjour ${nome},`,
    frase: (autore, azione, titolo) =>
      `${autore} vous a ${azione} la tâche « ${titolo} ».`,
    scadenza: 'Échéance',
    priorita: 'Priorité',
    priorita_valori: { low: 'basse', medium: 'moyenne', high: 'haute' },
    chiusura: 'Ouvrez TaskFlow pour voir le détail.',
    localeData: 'fr-FR',
  },
  de: {
    // In tedesco il participio regge la frase e l'oggetto: "Aufgabe
    // zugewiesen: ..." resta leggibile con la stessa struttura delle altre
    // lingue, senza inventare una forma diversa per il solo tedesco.
    oggetto: (azione, titolo) => `Aufgabe ${azione}: ${titolo}`,
    azione: { assigned: 'zugewiesen', reassigned: 'neu zugewiesen' },
    saluto: (nome) => `Hallo ${nome},`,
    frase: (autore, azione, titolo) =>
      `${autore} hat Ihnen die Aufgabe „${titolo}" ${azione}.`,
    scadenza: 'Fälligkeitsdatum',
    priorita: 'Priorität',
    priorita_valori: { low: 'niedrig', medium: 'mittel', high: 'hoch' },
    chiusura: 'Öffnen Sie TaskFlow, um die Details zu sehen.',
    localeData: 'de-DE',
  },
  es: {
    oggetto: (azione, titolo) => `Tarea ${azione}: ${titolo}`,
    azione: { assigned: 'asignada', reassigned: 'reasignada' },
    saluto: (nome) => `Hola ${nome},`,
    frase: (autore, azione, titolo) =>
      `${autore} le ha ${azione} la tarea «${titolo}».`,
    scadenza: 'Fecha límite',
    priorita: 'Prioridad',
    priorita_valori: { low: 'baja', medium: 'media', high: 'alta' },
    chiusura: 'Abra TaskFlow para ver los detalles.',
    localeData: 'es-ES',
  },
};

function escapeHtml(valore: string) {
  return valore
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Normalizza un valore arbitrario nella lingua di un'email supportata. */
export function linguaValida(valore: unknown): LinguaEmail {
  return LINGUE_EMAIL.includes(valore as LinguaEmail)
    ? (valore as LinguaEmail)
    : 'it';
}

/**
 * Formatta una data ISO nella convenzione della lingua indicata.
 *
 * Esportata perche' la usa anche il percorso dei modelli personalizzati: se
 * la data li' restasse in formato ISO, la stessa email avrebbe due formati
 * diversi a seconda che l'organizzazione abbia personalizzato il modello o no.
 */
export function formattaData(lingua: LinguaEmail, iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return data.toLocaleDateString(TESTI[lingua].localeData);
}

/** Traduce il valore di priorita' del task nella lingua indicata. */
export function traduciPriorita(lingua: LinguaEmail, valore: string): string {
  return TESTI[lingua].priorita_valori[valore] ?? valore;
}

export function componiEmailTask(lingua: LinguaEmail, p: ParametriTask) {
  const testi = TESTI[lingua];
  const azione = testi.azione[p.kind];

  const dettagli = [
    p.dueDate
      ? `${testi.scadenza}: ${new Date(p.dueDate).toLocaleDateString(testi.localeData)}`
      : null,
    p.priority
      ? `${testi.priorita}: ${testi.priorita_valori[p.priority] ?? p.priority}`
      : null,
  ].filter(Boolean) as string[];

  const textContent = [
    testi.saluto(p.recipientName),
    '',
    testi.frase(p.assignedByName, azione, p.taskTitle),
    p.taskDescription ? '' : null,
    p.taskDescription || null,
    dettagli.length ? '' : null,
    ...dettagli,
    '',
    testi.chiusura,
  ]
    .filter((v) => v !== null)
    .join('\n');

  const htmlContent = `
    <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#1f2937">
      <p>${escapeHtml(testi.saluto(p.recipientName))}</p>
      <p>${escapeHtml(testi.frase(p.assignedByName, azione, p.taskTitle))}</p>
      ${p.taskDescription ? `<p>${escapeHtml(p.taskDescription)}</p>` : ''}
      ${dettagli.length ? `<ul>${dettagli.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ul>` : ''}
      <p style="color:#6b7280;font-size:14px">${escapeHtml(testi.chiusura)}</p>
    </div>
  `;

  return {
    subject: testi.oggetto(azione, p.taskTitle),
    textContent,
    htmlContent,
  };
}
