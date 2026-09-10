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

export type LinguaEmail = 'it' | 'en';

export const LINGUE_EMAIL: LinguaEmail[] = ['it', 'en'];

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
  return valore === 'en' ? 'en' : 'it';
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
