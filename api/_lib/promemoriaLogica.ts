/**
 * Le regole dei promemoria di scadenza, senza database attorno.
 *
 * Stanno in `_lib` e non accanto alla rotta per un motivo pratico: `api/cron/`
 * e' una cartella instradata da Vercel, dove ogni file diventa un endpoint
 * pubblico. Un test li' accanto sarebbe diventato la rotta
 * `/api/cron/promemoria.test`, per giunta con un import di vitest — che in
 * produzione non esiste. Il trattino basso di `_lib` esclude invece la
 * cartella dall'instradamento.
 */

import type { TipoNotifica } from './modelliEmail.js';

/** Quanto in anticipo si avvisa. Cambiare qui cambia anche i test. */
export const FINESTRA_DUE_SOON_MS = 24 * 60 * 60 * 1000;

/**
 * Tetto agli invii per esecuzione.
 *
 * Non e' una quota di prodotto ma una cintura di sicurezza: una migrazione che
 * sbaglia le date, o un import che scrive migliaia di task scaduti, qui
 * diventerebbe una campagna di posta involontaria a nome del dominio
 * verificato. Meglio fermarsi, dirlo nella risposta e far intervenire una
 * persona.
 */
export const TETTO_EMAIL_PER_ESECUZIONE = 200;

/**
 * Quanti task leggere al massimo. Piu' alto del tetto perche' molti candidati
 * verranno scartati (gia' avvisati, preferenze spente): fermarsi a 200 righe
 * lette significherebbe non arrivare mai ai task in fondo alla lista.
 */
export const MAX_TASK_LETTI = 2000;

/** Il minimo che serve per classificare un task; il resto non entra in gioco. */
export interface TaskDaClassificare {
  status?: string | null;
  due_date?: string | null;
  assignee_id?: string | null;
}

export type Promemoria = Extract<TipoNotifica, 'task_due_soon' | 'task_overdue'>;

/**
 * Decide se un task merita un promemoria, e quale.
 *
 * E' una funzione pura e separata dalla rotta apposta: e' l'unica parte con
 * delle regole vere (finestra, stato, assegnatario) e senza database attorno
 * puo' essere provata sui casi limite, a partire da quello delle 24 ore
 * esatte.
 */
export function classificaTask(
  task: TaskDaClassificare,
  adesso: Date
): Promemoria | null {
  // Senza destinatario non c'e' nessuno da avvisare: il task esiste ma non e'
  // di nessuno, e ripiegare su chi l'ha creato sarebbe un'altra notifica.
  if (!task.assignee_id) return null;

  // 'completed' e' l'unico stato terminale in TaskStatus (src/lib/types.ts):
  // gli altri due, 'not-started' e 'in-progress', vanno entrambi avvisati.
  if (task.status === 'completed') return null;

  if (!task.due_date) return null;
  const scadenza = new Date(task.due_date).getTime();
  if (Number.isNaN(scadenza)) return null;

  const ora = adesso.getTime();
  if (scadenza < ora) return 'task_overdue';

  // Il confine delle 24 ore e' incluso: una scadenza esattamente al limite e'
  // "entro le prossime 24 ore". Escluderlo aprirebbe una fessura in cui un
  // task puo' passare da "troppo presto" a "gia' scaduto" senza che il
  // promemoria di preavviso venga mai emesso.
  if (scadenza <= ora + FINESTRA_DUE_SOON_MS) return 'task_due_soon';

  return null;
}

/**
 * Link con cui si apre il task dall'email.
 *
 * Stesso formato usato dal client (`src/lib/taskEmail.ts`) e dalle notifiche
 * di sistema. Qui l'origine non si puo' leggere da `window`: arriva da
 * APP_URL/VERCEL_URL tramite `getRequiredEnv().appUrl`. Se non e' configurata
 * si restituisce `undefined` e il modello resta senza link, che e' meglio di
 * un link rotto dentro un'email vera.
 */
export function costruisciTaskUrl(
  origine: string | undefined,
  taskId: string
): string | undefined {
  if (!origine) return undefined;
  return `${origine.replace(/\/+$/, '')}/#task-${taskId}`;
}

export interface Conteggi {
  esaminati: number;
  spediti: number;
  saltati: {
    nienteDaFare: number;
    giaAvvisati: number;
    senzaEmail: number;
    preferenzeOModello: number;
    invioFallito: number;
  };
  tettoRaggiunto: boolean;
}
