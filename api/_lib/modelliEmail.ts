/**
 * Modelli email predefiniti, generati nella lingua dell'organizzazione.
 *
 * Prima erano dieci blocchi di HTML scritti a mano, in inglese, incollati in
 * un componente. Tradurli in cinque lingue avrebbe significato cinquanta
 * blocchi: nessuno li avrebbe tenuti allineati, e un colore o un `{{taskUrl}}`
 * sbagliato in uno solo sarebbe rimasto li' per sempre.
 *
 * Qui la struttura sta in un posto solo (`STRUTTURE`: che riquadro, che
 * colori, che righe) e le frasi in un altro (`TESTI`, una tabella per lingua).
 * Cambiare il layout di tutte le email e' una modifica sola; aggiungere una
 * lingua e' una tabella di frasi, senza toccare una riga di HTML.
 *
 * ATTENZIONE ai due tipi di segnaposto, che qui convivono:
 *   - `{{taskTitle}}` appartiene ai MODELLI. Resta nel testo salvato e viene
 *     sostituito al momento dell'invio. Non va tradotto.
 *   - le frasi di questo file sono contenuto, non interfaccia: non passano da
 *     `t()`. I modelli sono dati modificabili dall'utente, e una volta che
 *     un'organizzazione li ha personalizzati non vanno piu' toccati.
 */

/*
 * Nessun import, ed e' voluto: questo modulo lo usano sia l'interfaccia sia le
 * funzioni del server, e i due lati non condividono gli alias dei percorsi.
 * I due tipi qui sotto ripetono di proposito le unioni definite in
 * `src/lib/types.ts` e `src/lib/i18n.ts`; sono strutturalmente identiche,
 * quindi il compilatore verifica comunque che i due lati restino allineati —
 * se qualcuno aggiunge una lingua o un tipo di notifica di la' e non di qua,
 * il type-check fallisce dove i due si incontrano.
 */

export type TipoNotifica =
  | 'task_assigned'
  | 'task_reassigned'
  | 'task_updated'
  | 'task_comment'
  | 'task_due_soon'
  | 'task_overdue'
  | 'task_completed'
  | 'task_status_changed'
  | 'task_priority_changed'
  | 'mention';

export type LinguaModello = 'it' | 'en' | 'fr' | 'de' | 'es';

const LINGUA_PREDEFINITA: LinguaModello = 'it';

/** La parte di un modello che questo generatore sa produrre. */
export interface ModelloGenerato {
  name: string;
  type: TipoNotifica;
  subject: string;
  htmlContent: string;
  textContent: string;
  isActive: boolean;
  variables: string[];
}

/** Riga `<strong>Etichetta:</strong> valore` del riquadro. */
type Riga = 'priorita' | 'scadenza' | 'stato';

interface Struttura {
  /** Colore del titolo e, dove il riquadro non c'e', anche del bottone. */
  coloreTitolo: string;
  /** Emoji del titolo. */
  emoji?: string;
  /**
   * Se l'emoji compare anche nella versione testuale, in apertura di frase.
   * Vale per il ritardo e per il completamento — dove segnala qualcosa che
   * cambia cosa fai — non per il semplice promemoria di scadenza.
   */
  emojiNelTesto?: boolean;
  riquadro?: {
    sfondo: string;
    bordo: string;
    /** Colore del testo dentro il riquadro, quando diverso dal solito. */
    testo?: string;
    /** Il titolo dell'attivita' in cima al riquadro. */
    titolo?: boolean;
    righe?: Riga[];
    /** Il paragrafo con la descrizione dell'attivita'. */
    descrizione?: boolean;
    /** La citazione del commento, al posto di titolo e righe. */
    citazione?: boolean;
    /** Una frase di chiusura dentro al riquadro (i complimenti). */
    nota?: boolean;
  };
  bottone: { sfondo: string; testo: string };
  /** I saluti finali con il nome dell'applicazione. */
  firma?: boolean;
  variabili: string[];
}

const STRUTTURE: Record<TipoNotifica, Struttura> = {
  task_assigned: {
    coloreTitolo: '#2c3e50',
    riquadro: {
      sfondo: '#f8f9fa',
      bordo: '#3498db',
      titolo: true,
      righe: ['priorita', 'scadenza'],
      descrizione: true,
    },
    bottone: { sfondo: '#3498db', testo: 'white' },
    firma: true,
    variabili: [
      'recipientName',
      'actionBy',
      'taskTitle',
      'taskPriority',
      'taskDueDate',
      'taskDescription',
      'taskUrl',
      'applicationName',
    ],
  },
  task_reassigned: {
    coloreTitolo: '#2c3e50',
    riquadro: {
      sfondo: '#fff3cd',
      bordo: '#ffc107',
      titolo: true,
      righe: ['priorita', 'scadenza'],
    },
    bottone: { sfondo: '#ffc107', testo: '#2c3e50' },
    variabili: [
      'recipientName',
      'actionBy',
      'taskTitle',
      'taskPriority',
      'taskDueDate',
      'taskUrl',
    ],
  },
  task_updated: {
    coloreTitolo: '#2c3e50',
    bottone: { sfondo: '#3498db', testo: 'white' },
    variabili: ['recipientName', 'actionBy', 'taskTitle', 'taskUrl'],
  },
  task_comment: {
    coloreTitolo: '#2c3e50',
    riquadro: { sfondo: '#f8f9fa', bordo: '#6c757d', citazione: true },
    bottone: { sfondo: '#6c757d', testo: 'white' },
    variabili: ['recipientName', 'actionBy', 'taskTitle', 'commentText', 'taskUrl'],
  },
  task_due_soon: {
    coloreTitolo: '#2c3e50',
    emoji: '⏰',
    riquadro: {
      sfondo: '#fff3cd',
      bordo: '#ffc107',
      titolo: true,
      righe: ['scadenza', 'stato'],
    },
    bottone: { sfondo: '#ffc107', testo: '#2c3e50' },
    variabili: ['recipientName', 'taskTitle', 'taskDueDate', 'taskStatus', 'taskUrl'],
  },
  task_overdue: {
    coloreTitolo: '#dc3545',
    emoji: '⚠️',
    emojiNelTesto: true,
    riquadro: {
      sfondo: '#f8d7da',
      bordo: '#dc3545',
      testo: '#721c24',
      titolo: true,
      righe: ['scadenza', 'priorita'],
    },
    bottone: { sfondo: '#dc3545', testo: 'white' },
    variabili: ['recipientName', 'taskTitle', 'taskDueDate', 'taskPriority', 'taskUrl'],
  },
  task_completed: {
    coloreTitolo: '#28a745',
    emoji: '✅',
    emojiNelTesto: true,
    riquadro: {
      sfondo: '#d4edda',
      bordo: '#28a745',
      testo: '#155724',
      titolo: true,
      nota: true,
    },
    bottone: { sfondo: '#28a745', testo: 'white' },
    variabili: ['recipientName', 'taskTitle', 'actionBy', 'taskUrl'],
  },
  task_status_changed: {
    coloreTitolo: '#2c3e50',
    bottone: { sfondo: '#3498db', testo: 'white' },
    variabili: ['recipientName', 'taskTitle', 'taskStatus', 'actionBy', 'taskUrl'],
  },
  task_priority_changed: {
    coloreTitolo: '#2c3e50',
    bottone: { sfondo: '#3498db', testo: 'white' },
    variabili: ['recipientName', 'taskTitle', 'taskPriority', 'actionBy', 'taskUrl'],
  },
  mention: {
    coloreTitolo: '#2c3e50',
    // Con la citazione, come per il commento: sapere di essere stati chiamati
    // in causa senza leggere in cosa costringe ad aprire l'applicazione per
    // scoprire una riga di testo.
    riquadro: { sfondo: '#f8f9fa', bordo: '#6c757d', citazione: true },
    bottone: { sfondo: '#3498db', testo: 'white' },
    variabili: ['recipientName', 'actionBy', 'taskTitle', 'commentText', 'taskUrl'],
  },
};

/** Le quattro frasi che cambiano per ogni tipo di notifica. */
interface VociModello {
  /** Nome mostrato nell'elenco dei modelli. */
  nome: string;
  oggetto: string;
  titolo: string;
  intro: string;
  bottone: string;
  /** Solo per il completamento: i complimenti dentro al riquadro. */
  nota?: string;
}

interface TestiModelli {
  saluto: string;
  etichette: Record<Riga, string>;
  /** Etichette della sola versione testuale. */
  attivita: string;
  descrizione: string;
  commento: string;
  apri: string;
  firma: [string, string];
  modelli: Record<TipoNotifica, VociModello>;
}

const TESTI: Record<LinguaModello, TestiModelli> = {
  it: {
    saluto: 'Ciao {{recipientName}},',
    etichette: { priorita: 'Priorità', scadenza: 'Scadenza', stato: 'Stato' },
    attivita: 'Attività',
    descrizione: 'Descrizione',
    commento: 'Commento',
    apri: 'Apri l’attività',
    firma: ['Un saluto,', 'Il team di {{applicationName}}'],
    modelli: {
      task_assigned: {
        nome: 'Attività assegnata',
        oggetto: 'Nuova attività assegnata: {{taskTitle}}',
        titolo: 'Nuova attività assegnata',
        intro: '{{actionBy}} ti ha assegnato una nuova attività.',
        bottone: 'Apri l’attività',
      },
      task_reassigned: {
        nome: 'Attività riassegnata',
        oggetto: 'Attività riassegnata: {{taskTitle}}',
        titolo: 'Attività riassegnata a te',
        intro: '{{actionBy}} ti ha riassegnato un’attività.',
        bottone: 'Apri l’attività',
      },
      task_updated: {
        nome: 'Attività aggiornata',
        oggetto: 'Attività aggiornata: {{taskTitle}}',
        titolo: 'Attività aggiornata',
        intro: '{{actionBy}} ha aggiornato l’attività "{{taskTitle}}".',
        bottone: 'Apri l’attività',
      },
      task_comment: {
        nome: 'Commento a un’attività',
        oggetto: 'Nuovo commento a: {{taskTitle}}',
        titolo: 'Nuovo commento',
        intro: '{{actionBy}} ha commentato "{{taskTitle}}".',
        bottone: 'Leggi il commento',
      },
      task_due_soon: {
        nome: 'Attività in scadenza',
        oggetto: 'Promemoria: {{taskTitle}} è in scadenza',
        titolo: 'Attività in scadenza',
        intro: 'Ti ricordiamo che la tua attività sta per scadere.',
        bottone: 'Apri l’attività',
      },
      task_overdue: {
        nome: 'Attività scaduta',
        oggetto: 'Scaduta: {{taskTitle}}',
        titolo: 'Attività scaduta',
        intro: 'La tua attività è scaduta e richiede attenzione immediata.',
        bottone: 'Apri subito l’attività',
      },
      task_completed: {
        nome: 'Attività completata',
        oggetto: 'Attività completata: {{taskTitle}}',
        titolo: 'Attività completata',
        intro: '{{actionBy}} ha segnato come completata la tua attività "{{taskTitle}}".',
        bottone: 'Apri l’attività',
        nota: 'Ottimo lavoro! 🎉',
      },
      task_status_changed: {
        nome: 'Stato cambiato',
        oggetto: 'Stato cambiato: {{taskTitle}}',
        titolo: 'Stato aggiornato',
        intro: '{{actionBy}} ha portato "{{taskTitle}}" allo stato {{taskStatus}}.',
        bottone: 'Apri l’attività',
      },
      task_priority_changed: {
        nome: 'Priorità cambiata',
        oggetto: 'Priorità cambiata: {{taskTitle}}',
        titolo: 'Priorità aggiornata',
        intro: '{{actionBy}} ha portato "{{taskTitle}}" alla priorità {{taskPriority}}.',
        bottone: 'Apri l’attività',
      },
      mention: {
        nome: 'Menzione',
        oggetto: 'Sei stato menzionato in: {{taskTitle}}',
        titolo: 'Sei stato menzionato',
        intro: '{{actionBy}} ti ha menzionato in "{{taskTitle}}".',
        bottone: 'Apri l’attività',
      },
    },
  },

  en: {
    saluto: 'Hi {{recipientName}},',
    etichette: { priorita: 'Priority', scadenza: 'Due Date', stato: 'Status' },
    attivita: 'Task',
    descrizione: 'Description',
    commento: 'Comment',
    apri: 'View task',
    firma: ['Best regards,', 'The {{applicationName}} Team'],
    modelli: {
      task_assigned: {
        nome: 'Task Assigned',
        oggetto: 'New Task Assigned: {{taskTitle}}',
        titolo: 'New Task Assigned',
        intro: 'You have been assigned a new task by {{actionBy}}.',
        bottone: 'View Task',
      },
      task_reassigned: {
        nome: 'Task Reassigned',
        oggetto: 'Task Reassigned: {{taskTitle}}',
        titolo: 'Task Reassigned to You',
        intro: 'A task has been reassigned to you by {{actionBy}}.',
        bottone: 'View Task',
      },
      task_updated: {
        nome: 'Task Updated',
        oggetto: 'Task Updated: {{taskTitle}}',
        titolo: 'Task Updated',
        intro: '{{actionBy}} updated the task "{{taskTitle}}".',
        bottone: 'View Task',
      },
      task_comment: {
        nome: 'Task Comment',
        oggetto: 'New Comment on: {{taskTitle}}',
        titolo: 'New Comment',
        intro: '{{actionBy}} commented on "{{taskTitle}}".',
        bottone: 'View Comment',
      },
      task_due_soon: {
        nome: 'Task Due Soon',
        oggetto: 'Reminder: {{taskTitle}} is due soon',
        titolo: 'Task Due Soon',
        intro: 'This is a reminder that your task is due soon.',
        bottone: 'View Task',
      },
      task_overdue: {
        nome: 'Task Overdue',
        oggetto: 'Overdue: {{taskTitle}}',
        titolo: 'Task Overdue',
        intro: 'Your task is now overdue and requires immediate attention.',
        bottone: 'View Task Now',
      },
      task_completed: {
        nome: 'Task Completed',
        oggetto: 'Task Completed: {{taskTitle}}',
        titolo: 'Task Completed',
        intro: 'Your task "{{taskTitle}}" has been marked as completed by {{actionBy}}.',
        bottone: 'View Task',
        nota: 'Great work! 🎉',
      },
      task_status_changed: {
        nome: 'Task Status Changed',
        oggetto: 'Task Status Changed: {{taskTitle}}',
        titolo: 'Task Status Updated',
        intro:
          'The status of "{{taskTitle}}" has been changed to {{taskStatus}} by {{actionBy}}.',
        bottone: 'View Task',
      },
      task_priority_changed: {
        nome: 'Task Priority Changed',
        oggetto: 'Task Priority Changed: {{taskTitle}}',
        titolo: 'Task Priority Updated',
        intro:
          'The priority of "{{taskTitle}}" has been changed to {{taskPriority}} by {{actionBy}}.',
        bottone: 'View Task',
      },
      mention: {
        nome: 'Mention',
        oggetto: 'You were mentioned in: {{taskTitle}}',
        titolo: 'You Were Mentioned',
        intro: '{{actionBy}} mentioned you in "{{taskTitle}}".',
        bottone: 'View Task',
      },
    },
  },

  fr: {
    saluto: 'Bonjour {{recipientName}},',
    etichette: { priorita: 'Priorité', scadenza: 'Échéance', stato: 'Statut' },
    attivita: 'Tâche',
    descrizione: 'Description',
    commento: 'Commentaire',
    apri: 'Ouvrir la tâche',
    firma: ['Cordialement,', 'L’équipe {{applicationName}}'],
    modelli: {
      task_assigned: {
        nome: 'Tâche attribuée',
        oggetto: 'Nouvelle tâche attribuée : {{taskTitle}}',
        titolo: 'Nouvelle tâche attribuée',
        intro: '{{actionBy}} vous a attribué une nouvelle tâche.',
        bottone: 'Ouvrir la tâche',
      },
      task_reassigned: {
        nome: 'Tâche réattribuée',
        oggetto: 'Tâche réattribuée : {{taskTitle}}',
        titolo: 'Une tâche vous a été réattribuée',
        intro: '{{actionBy}} vous a réattribué une tâche.',
        bottone: 'Ouvrir la tâche',
      },
      task_updated: {
        nome: 'Tâche mise à jour',
        oggetto: 'Tâche mise à jour : {{taskTitle}}',
        titolo: 'Tâche mise à jour',
        intro: '{{actionBy}} a mis à jour la tâche « {{taskTitle}} ».',
        bottone: 'Ouvrir la tâche',
      },
      task_comment: {
        nome: 'Commentaire sur une tâche',
        oggetto: 'Nouveau commentaire sur : {{taskTitle}}',
        titolo: 'Nouveau commentaire',
        intro: '{{actionBy}} a commenté « {{taskTitle}} ».',
        bottone: 'Lire le commentaire',
      },
      task_due_soon: {
        nome: 'Tâche bientôt à échéance',
        oggetto: 'Rappel : l’échéance de {{taskTitle}} approche',
        titolo: 'Échéance proche',
        intro: 'Nous vous rappelons que l’échéance de votre tâche approche.',
        bottone: 'Ouvrir la tâche',
      },
      task_overdue: {
        nome: 'Tâche en retard',
        oggetto: 'En retard : {{taskTitle}}',
        titolo: 'Tâche en retard',
        intro: 'Votre tâche est en retard et demande une attention immédiate.',
        bottone: 'Ouvrir la tâche maintenant',
      },
      task_completed: {
        nome: 'Tâche terminée',
        oggetto: 'Tâche terminée : {{taskTitle}}',
        titolo: 'Tâche terminée',
        intro: '{{actionBy}} a marqué votre tâche « {{taskTitle}} » comme terminée.',
        bottone: 'Ouvrir la tâche',
        nota: 'Beau travail ! 🎉',
      },
      task_status_changed: {
        nome: 'Statut modifié',
        oggetto: 'Statut modifié : {{taskTitle}}',
        titolo: 'Statut mis à jour',
        intro:
          '{{actionBy}} a fait passer « {{taskTitle}} » au statut {{taskStatus}}.',
        bottone: 'Ouvrir la tâche',
      },
      task_priority_changed: {
        nome: 'Priorité modifiée',
        oggetto: 'Priorité modifiée : {{taskTitle}}',
        titolo: 'Priorité mise à jour',
        intro:
          '{{actionBy}} a fait passer « {{taskTitle}} » à la priorité {{taskPriority}}.',
        bottone: 'Ouvrir la tâche',
      },
      mention: {
        nome: 'Mention',
        oggetto: 'Vous avez été mentionné dans : {{taskTitle}}',
        titolo: 'Vous avez été mentionné',
        intro: '{{actionBy}} vous a mentionné dans « {{taskTitle}} ».',
        bottone: 'Ouvrir la tâche',
      },
    },
  },

  de: {
    saluto: 'Hallo {{recipientName}},',
    etichette: {
      priorita: 'Priorität',
      scadenza: 'Fälligkeitsdatum',
      stato: 'Status',
    },
    attivita: 'Aufgabe',
    descrizione: 'Beschreibung',
    commento: 'Kommentar',
    apri: 'Aufgabe öffnen',
    firma: ['Viele Grüße', 'Ihr {{applicationName}}-Team'],
    modelli: {
      task_assigned: {
        nome: 'Aufgabe zugewiesen',
        oggetto: 'Neue Aufgabe zugewiesen: {{taskTitle}}',
        titolo: 'Neue Aufgabe zugewiesen',
        intro: '{{actionBy}} hat Ihnen eine neue Aufgabe zugewiesen.',
        bottone: 'Aufgabe öffnen',
      },
      task_reassigned: {
        nome: 'Aufgabe neu zugewiesen',
        oggetto: 'Aufgabe neu zugewiesen: {{taskTitle}}',
        titolo: 'Eine Aufgabe wurde Ihnen neu zugewiesen',
        intro: '{{actionBy}} hat Ihnen eine Aufgabe neu zugewiesen.',
        bottone: 'Aufgabe öffnen',
      },
      task_updated: {
        nome: 'Aufgabe aktualisiert',
        oggetto: 'Aufgabe aktualisiert: {{taskTitle}}',
        titolo: 'Aufgabe aktualisiert',
        intro: '{{actionBy}} hat die Aufgabe „{{taskTitle}}" aktualisiert.',
        bottone: 'Aufgabe öffnen',
      },
      task_comment: {
        nome: 'Kommentar zu einer Aufgabe',
        oggetto: 'Neuer Kommentar zu: {{taskTitle}}',
        titolo: 'Neuer Kommentar',
        intro: '{{actionBy}} hat „{{taskTitle}}" kommentiert.',
        bottone: 'Kommentar lesen',
      },
      task_due_soon: {
        nome: 'Aufgabe bald fällig',
        oggetto: 'Erinnerung: {{taskTitle}} wird bald fällig',
        titolo: 'Aufgabe bald fällig',
        intro: 'Wir erinnern Sie daran, dass Ihre Aufgabe bald fällig wird.',
        bottone: 'Aufgabe öffnen',
      },
      task_overdue: {
        nome: 'Aufgabe überfällig',
        oggetto: 'Überfällig: {{taskTitle}}',
        titolo: 'Aufgabe überfällig',
        intro: 'Ihre Aufgabe ist überfällig und erfordert sofortige Aufmerksamkeit.',
        bottone: 'Aufgabe jetzt öffnen',
      },
      task_completed: {
        nome: 'Aufgabe abgeschlossen',
        oggetto: 'Aufgabe abgeschlossen: {{taskTitle}}',
        titolo: 'Aufgabe abgeschlossen',
        intro:
          '{{actionBy}} hat Ihre Aufgabe „{{taskTitle}}" als abgeschlossen markiert.',
        bottone: 'Aufgabe öffnen',
        nota: 'Gute Arbeit! 🎉',
      },
      task_status_changed: {
        nome: 'Status geändert',
        oggetto: 'Status geändert: {{taskTitle}}',
        titolo: 'Status aktualisiert',
        intro:
          '{{actionBy}} hat „{{taskTitle}}" auf den Status {{taskStatus}} gesetzt.',
        bottone: 'Aufgabe öffnen',
      },
      task_priority_changed: {
        nome: 'Priorität geändert',
        oggetto: 'Priorität geändert: {{taskTitle}}',
        titolo: 'Priorität aktualisiert',
        intro:
          '{{actionBy}} hat „{{taskTitle}}" auf die Priorität {{taskPriority}} gesetzt.',
        bottone: 'Aufgabe öffnen',
      },
      mention: {
        nome: 'Erwähnung',
        oggetto: 'Sie wurden erwähnt in: {{taskTitle}}',
        titolo: 'Sie wurden erwähnt',
        intro: '{{actionBy}} hat Sie in „{{taskTitle}}" erwähnt.',
        bottone: 'Aufgabe öffnen',
      },
    },
  },

  es: {
    saluto: 'Hola {{recipientName}}:',
    etichette: {
      priorita: 'Prioridad',
      scadenza: 'Fecha límite',
      stato: 'Estado',
    },
    attivita: 'Tarea',
    descrizione: 'Descripción',
    commento: 'Comentario',
    apri: 'Abrir la tarea',
    firma: ['Un saludo,', 'El equipo de {{applicationName}}'],
    modelli: {
      task_assigned: {
        nome: 'Tarea asignada',
        oggetto: 'Nueva tarea asignada: {{taskTitle}}',
        titolo: 'Nueva tarea asignada',
        intro: '{{actionBy}} le ha asignado una nueva tarea.',
        bottone: 'Abrir la tarea',
      },
      task_reassigned: {
        nome: 'Tarea reasignada',
        oggetto: 'Tarea reasignada: {{taskTitle}}',
        titolo: 'Se le ha reasignado una tarea',
        intro: '{{actionBy}} le ha reasignado una tarea.',
        bottone: 'Abrir la tarea',
      },
      task_updated: {
        nome: 'Tarea actualizada',
        oggetto: 'Tarea actualizada: {{taskTitle}}',
        titolo: 'Tarea actualizada',
        intro: '{{actionBy}} ha actualizado la tarea «{{taskTitle}}».',
        bottone: 'Abrir la tarea',
      },
      task_comment: {
        nome: 'Comentario en una tarea',
        oggetto: 'Nuevo comentario en: {{taskTitle}}',
        titolo: 'Nuevo comentario',
        intro: '{{actionBy}} ha comentado «{{taskTitle}}».',
        bottone: 'Leer el comentario',
      },
      task_due_soon: {
        nome: 'Tarea próxima a vencer',
        oggetto: 'Recordatorio: {{taskTitle}} vence pronto',
        titolo: 'La tarea vence pronto',
        intro: 'Le recordamos que su tarea vence pronto.',
        bottone: 'Abrir la tarea',
      },
      task_overdue: {
        nome: 'Tarea vencida',
        oggetto: 'Vencida: {{taskTitle}}',
        titolo: 'Tarea vencida',
        intro: 'Su tarea ha vencido y requiere atención inmediata.',
        bottone: 'Abrir la tarea ahora',
      },
      task_completed: {
        nome: 'Tarea completada',
        oggetto: 'Tarea completada: {{taskTitle}}',
        titolo: 'Tarea completada',
        intro:
          '{{actionBy}} ha marcado como completada su tarea «{{taskTitle}}».',
        bottone: 'Abrir la tarea',
        nota: '¡Buen trabajo! 🎉',
      },
      task_status_changed: {
        nome: 'Estado modificado',
        oggetto: 'Estado modificado: {{taskTitle}}',
        titolo: 'Estado actualizado',
        intro:
          '{{actionBy}} ha cambiado «{{taskTitle}}» al estado {{taskStatus}}.',
        bottone: 'Abrir la tarea',
      },
      task_priority_changed: {
        nome: 'Prioridad modificada',
        oggetto: 'Prioridad modificada: {{taskTitle}}',
        titolo: 'Prioridad actualizada',
        intro:
          '{{actionBy}} ha cambiado «{{taskTitle}}» a la prioridad {{taskPriority}}.',
        bottone: 'Abrir la tarea',
      },
      mention: {
        nome: 'Mención',
        oggetto: 'Le han mencionado en: {{taskTitle}}',
        titolo: 'Le han mencionado',
        intro: '{{actionBy}} le ha mencionado en «{{taskTitle}}».',
        bottone: 'Abrir la tarea',
      },
    },
  },
};

/** Il segnaposto del modello che porta il valore di una riga del riquadro. */
const SEGNAPOSTO: Record<Riga, string> = {
  priorita: '{{taskPriority}}',
  scadenza: '{{taskDueDate}}',
  stato: '{{taskStatus}}',
};

function corpoHtml(tipo: TipoNotifica, testi: TestiModelli): string {
  const s = STRUTTURE[tipo];
  const v = testi.modelli[tipo];
  const titolo = s.emoji ? `${s.emoji} ${v.titolo}` : v.titolo;

  const pezzi: string[] = [
    `  <h1 style="color: ${s.coloreTitolo}; margin-bottom: 20px;">${titolo}</h1>`,
    `  <p style="font-size: 16px; color: #34495e;">${testi.saluto}</p>`,
    `  <p style="font-size: 16px; color: #34495e;">${v.intro}</p>`,
  ];

  const r = s.riquadro;
  if (r) {
    const colore = r.testo ?? '#7f8c8d';
    const dentro: string[] = [];

    if (r.citazione) {
      dentro.push(
        `    <p style="font-style: italic; color: #495057; margin: 0;">"{{commentText}}"</p>`
      );
    }
    if (r.titolo) {
      dentro.push(
        `    <h2 style="margin: 0 0 10px 0; color: ${r.testo ?? '#2c3e50'}; font-size: 18px;">{{taskTitle}}</h2>`
      );
    }
    for (const riga of r.righe ?? []) {
      dentro.push(
        `    <p style="margin: 5px 0; color: ${colore};"><strong>${testi.etichette[riga]}:</strong> ${SEGNAPOSTO[riga]}</p>`
      );
    }
    if (r.descrizione) {
      dentro.push(
        `    <p style="margin: 10px 0 0 0; color: #34495e;">{{taskDescription}}</p>`
      );
    }
    if (r.nota && v.nota) {
      dentro.push(`    <p style="margin: 5px 0; color: ${colore};">${v.nota}</p>`);
    }

    pezzi.push(
      '  ',
      `  <div style="background-color: ${r.sfondo}; border-left: 4px solid ${r.bordo}; padding: 15px; margin: 20px 0;">`,
      ...dentro,
      '  </div>',
      '  '
    );
  }

  pezzi.push(
    `  <a href="{{taskUrl}}" style="display: inline-block; background-color: ${s.bottone.sfondo}; color: ${s.bottone.testo}; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px;">${v.bottone}</a>`
  );

  if (s.firma) {
    pezzi.push(
      '  ',
      `  <p style="margin-top: 30px; font-size: 14px; color: #7f8c8d;">${testi.firma[0]}<br>${testi.firma[1]}</p>`
    );
  }

  return [
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">',
    ...pezzi,
    '</div>',
  ].join('\n');
}

function corpoTesto(tipo: TipoNotifica, testi: TestiModelli): string {
  const s = STRUTTURE[tipo];
  const v = testi.modelli[tipo];
  const r = s.riquadro;

  // Nella versione testuale l'emoji non ha un titolo dove stare: apre la frase
  // iniziale, ma solo dove serve davvero a far capire in un colpo d'occhio che
  // l'attivita' e' in ritardo o conclusa.
  const apertura = s.emoji && s.emojiNelTesto ? `${s.emoji} ${v.intro}` : v.intro;
  const righe: string[] = [testi.saluto, '', apertura];

  if (r?.righe?.length) {
    righe.push('', `${testi.attivita}: {{taskTitle}}`);
    for (const riga of r.righe) {
      righe.push(`${testi.etichette[riga]}: ${SEGNAPOSTO[riga]}`);
    }
  }
  if (r?.descrizione) {
    righe.push('', `${testi.descrizione}:`, '{{taskDescription}}');
  }
  if (r?.citazione) {
    righe.push('', `${testi.commento}: "{{commentText}}"`);
  }
  if (r?.nota && v.nota) {
    righe.push('', v.nota);
  }

  righe.push('', `${testi.apri}: {{taskUrl}}`);

  if (s.firma) {
    righe.push('', testi.firma[0], testi.firma[1]);
  }

  return righe.join('\n');
}

/** L'elenco dei tipi di notifica, con il nome nella lingua richiesta. */
export function tipiNotifica(lingua: LinguaModello): { value: TipoNotifica; label: string }[] {
  const testi = TESTI[lingua] ?? TESTI[LINGUA_PREDEFINITA];
  return (Object.keys(STRUTTURE) as TipoNotifica[]).map((value) => ({
    value,
    label: testi.modelli[value].nome,
  }));
}

/** Il modello predefinito di un tipo, nella lingua richiesta. */
export function modelloPredefinito(
  lingua: LinguaModello,
  tipo: TipoNotifica
): ModelloGenerato {
  const testi = TESTI[lingua] ?? TESTI[LINGUA_PREDEFINITA];
  return {
    name: testi.modelli[tipo].nome,
    type: tipo,
    subject: testi.modelli[tipo].oggetto,
    htmlContent: corpoHtml(tipo, testi),
    textContent: corpoTesto(tipo, testi),
    isActive: true,
    variables: STRUTTURE[tipo].variabili,
  };
}

/** Tutti e dieci i modelli, nella lingua richiesta. */
export function modelliPredefiniti(lingua: LinguaModello) {
  return (Object.keys(STRUTTURE) as TipoNotifica[]).map((tipo) =>
    modelloPredefinito(lingua, tipo)
  );
}
