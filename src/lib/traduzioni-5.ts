/**
 * Traduzioni, parte 5: le voci sfuggite alla sostituzione automatica.
 *
 * Sono soprattutto testi affiancati a un'icona dentro lo stesso elemento —
 * `<Button><Icona />My Permissions</Button>` — dove il testo non e' delimitato
 * da due tag e quindi non veniva riconosciuto. Sostituite a mano.
 */
export const PARTE_5: Record<string, string> = {
  'My Permissions': 'I miei permessi',
  'Avg Completion Time': 'Tempo medio di completamento',
  'Avg Tasks/Employee': 'Attività medie per persona',
  'Count': 'Numero',
  'Low': 'Bassa',
  'Metric': 'Indicatore',
  'Total Assigned Tasks': 'Attività assegnate in totale',
  'Value': 'Valore',
  'Generated': 'Generato il',
  'days': 'giorni',
  'Joined': 'Iscritto',
  'All': 'Tutti',
  'tasks': 'attività',
  'task': 'attività',
  'more': 'altre',
  'This user has': 'Questa persona ha',
  'assigned task(s). Those tasks will become unassigned.':
    'attività assegnate, che resteranno senza assegnatario.',
  'This action cannot be undone and any assigned tasks will become unassigned.':
    'Operazione non reversibile: le attività assegnate resteranno senza assegnatario.',
  'active': 'attivo',
  'inactive': 'non attivo',
  'Feedback Board': 'Bacheca dei riscontri',
  'Announcements': 'Annunci',
  'Skills (comma-separated)': 'Competenze (separate da virgola)',
  'Task created successfully!': 'Attività creata',
  'Task updated successfully!': 'Attività aggiornata',
  'Task reassigned successfully!': 'Attività riassegnata',
  'Task deleted': 'Attività eliminata',
  'Task completed!': 'Attività completata',
  'Task status distribution across departments':
    'Distribuzione degli stati fra i dipartimenti',
  'Top Clicked Links': 'Link più cliccati',
  'Visual reference for department color coding and icons used throughout the app':
    "Riferimento visivo dei colori e delle icone dei dipartimenti usati nell'applicazione",
  'TaskFlow Help & Documentation': 'Guida e documentazione',
  'TaskFlow is Production Ready!': 'TaskFlow è pronto per la produzione',
  "Get your webhook URL from Slack's Incoming Webhooks app":
    "Trova l'URL del webhook nell'app Incoming Webhooks di Slack",
  'TaskFlow Analytics - Team Performance Report':
    'TaskFlow - Report sulle prestazioni del team',
  'TaskFlow Analytics - Department Performance Report':
    'TaskFlow - Report sulle prestazioni per dipartimento',
  '{n}% complete': '{n}% completato',
  '{n} tasks/user': '{n} attività per utente',
  '{n} announcements': '{n} annunci',
  '{n} unassigned': '{n} senza assegnatario',
  'Last modified: {data} by {autore}': 'Ultima modifica: {data} da {autore}',
  'Variables': 'Variabili',
  'Note:': 'Nota:',
  'Email notifications are sent when enabled in user notification preferences. Variables will be automatically replaced with actual values when emails are sent.': 
    "Le email di notifica partono solo se sono attive nelle preferenze di notifica dell'utente. Le variabili vengono sostituite con i valori reali al momento dell'invio.",
};
