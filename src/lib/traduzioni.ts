/**
 * Traduzioni del corpo dell'interfaccia.
 *
 * Qui la CHIAVE e' la stringa inglese originale, non un identificatore
 * inventato. Con quasi ottocento testi, coniare una chiave per ciascuno
 * avrebbe aggiunto lavoro e un secondo posto in cui sbagliare, senza dare
 * nulla in cambio: la stringa inglese e' gia' univoca e leggibile nel punto in
 * cui viene usata.
 *
 * Ne segue che l'inglese non ha bisogno di dizionario — la chiave e' gia' il
 * testo inglese — e che una voce mancante mostra l'inglese invece di un
 * identificatore grezzo.
 *
 * Le chiavi semantiche (`login.titolo`, `org.crea`, ...) restano in i18n.ts:
 * riguardano schermate scritte direttamente in italiano, dove la lingua di
 * partenza e' l'opposto.
 */

import { PARTE_2 } from './traduzioni-2';
import { PARTE_3 } from './traduzioni-3';
import { PARTE_4 } from './traduzioni-4';
import { PARTE_5 } from './traduzioni-5';

/** Inglese originale -> italiano. Diviso in piu' file solo per leggibilita'. */
export const TESTI_IT: Record<string, string> = {
  ...PARTE_2,
  ...PARTE_3,
  ...PARTE_4,
  ...PARTE_5,
  // --- generale, azioni ricorrenti ---
  'Cancel': 'Annulla',
  'Close': 'Chiudi',
  'Save': 'Salva',
  'Delete': 'Elimina',
  'Edit': 'Modifica',
  'Apply': 'Applica',
  'Back': 'Indietro',
  'Next': 'Avanti',
  'Clear': 'Svuota',
  'Clear all': 'Svuota tutto',
  'Create New': 'Crea nuovo',
  'Complete': 'Completa',
  'Bulk': 'Selezione multipla',
  'Analysis': 'Analisi',
  'Analytics': 'Analisi',
  'Dashboard': 'Cruscotto',
  'Category': 'Categoria',
  'Custom': 'Personalizzato',
  'Archived': 'Archiviato',
  'Already exists': 'Esiste già',
  'Confirm Delete': 'Conferma eliminazione',
  'Are you sure? This action cannot be undone!':
    'Sei sicuro? L\'operazione non può essere annullata.',
  'Are you sure you want to remove': 'Vuoi davvero rimuovere',
  'All time': 'Sempre',
  'All types': 'Tutti i tipi',
  'All Categories': 'Tutte le categorie',
  'All Departments': 'Tutti i dipartimenti',
  'All Departments Selected': 'Tutti i dipartimenti selezionati',
  'All Members': 'Tutti i membri',
  'All Priority': 'Tutte le priorità',
  'All Status': 'Tutti gli stati',
  'No data available': 'Nessun dato disponibile',

  // --- stati e priorità' ---
  'Active': 'Attivo',
  'Completed': 'Completato',
  'In Progress': 'In corso',
  'Not Started': 'Da iniziare',
  'Overdue': 'In ritardo',
  'Priority': 'Priorità',
  'Status': 'Stato',
  'High': 'Alta',
  'High Priority': 'Priorità alta',
  'Description': 'Descrizione',

  // --- attività' ---
  'Task': 'Attività',
  'Tasks': 'Attività',
  'Add Task': 'Aggiungi attività',
  'Create Task': 'Crea attività',
  'Create New Task': 'Nuova attività',
  'Total Tasks': 'Attività totali',
  'Active Tasks': 'Attività attive',
  'Completed Tasks': 'Attività completate',
  'Assigned Tasks': 'Attività assegnate',
  'View Task': 'Apri attività',
  'Assign To': 'Assegna a',
  'Assignee': 'Assegnatario',
  'Add task details...': 'Aggiungi i dettagli...',
  'Add a comment...': 'Scrivi un commento...',
  'Add comments and attachments': 'Aggiungi commenti e allegati',
  "Add a new task to your team's workflow. Fill in the details below.":
    'Aggiungi una nuova attività al lavoro del team. Compila i dettagli qui sotto.',
  "All changes are automatically tracked in the task's activity history.":
    'Tutte le modifiche vengono registrate nella cronologià dell\'attività.',
  'Comment added!': 'Commento aggiunto',
  'Comment deleted': 'Commento eliminato',
  'Comment updated!': 'Commento aggiornato',
  'Comments and mentions': 'Commenti e menzioni',
  'Attachment removed': 'Allegato rimosso',
  'Completion Rate': 'Percentuale di completamento',
  'Average Completion Time': 'Tempo medio di completamento',
  'Avg. Completion Time': 'Tempo medio di completamento',
  'Avg Time': 'Tempo medio',
  'Avg Tasks': 'Attività medie',
  'Avg Tasks per Member': 'Attività medie per membro',
  'Avg/Employee': 'Media per persona',
  'Avg/User': 'Media per utente',
  'Current state of all tasks': 'Stato attuale di tutte le attività',
  'Consider task priorities and deadlines': 'Tiene conto di priorità e scadenze',
  'Auto-archive Completed After (days)': 'Archivia le completate dopo (giorni)',
  'Allow Task Deletion': 'Consenti l\'eliminazione delle attività',
  'Configure task behavior and policies': 'Comportamento e regole delle attività',

  // --- persone e dipartimenti ---
  'Admin': 'Amministratore',
  'Admin (Super Admin)': 'Amministratore (super amministratore)',
  'Add User': 'Aggiungi utente',
  'Add Team Member': 'Aggiungi un membro',
  'Add a new member to your team': 'Aggiungi una persona al tuo team',
  'Active Members': 'Membri attivi',
  'Active Users': 'Utenti attivi',
  'Active Team Members': 'Membri attivi del team',
  'Avatar URL': 'URL dell\'immagine',
  'Brief description about the team member...': 'Breve descrizione della persona...',
  'Departments': 'Dipartimenti',
  'Department already added': 'Dipartimento già aggiunto',
  'Active Departments': 'Dipartimenti attivi',
  'Active departments': 'Dipartimenti attivi',
  'Archived Departments': 'Dipartimenti archiviati',
  'Archive inactive departments': 'Archivia i dipartimenti inattivi',
  'Add Department': 'Aggiungi dipartimento',
  'Add New Department': 'Nuovo dipartimento',
  'Create Department': 'Crea dipartimento',
  'Custom Departments': 'Dipartimenti personalizzati',
  'Assign Departments': 'Assegna dipartimenti',
  'Add to existing departments': 'Aggiungi ai dipartimenti esistenti',
  'Allow Multiple Departments': 'Consenti più dipartimenti',
  'Assign employees to multiple departments': 'Assegna le persone a più dipartimenti',
  'A department with this name already exists': 'Esiste già un dipartimento con questo nome',
  'Brief description of this department...': 'Breve descrizione del dipartimento...',
  'Busiest Department': 'Dipartimento più carico',
  'Busiest Departments': 'Dipartimenti più carichi',
  'Choose departments to assign to the selected team members':
    'Scegli i dipartimenti da assegnare alle persone selezionate',
  'Create a new department to organize your team structure':
    'Crea un dipartimento per organizzare la struttura del team',
  'Create and manage departments, assign leads, and track team organization':
    'Crea e gestisci i dipartimenti, assegna i responsabili e segui l\'organizzazione',
  'Create new departments with details (name, description, color, lead, budget)':
    'Crea nuovi dipartimenti con nome, descrizione, colore, responsabile e budget',
  'Create your first department to start organizing your team':
    'Crea il primo dipartimento per iniziare a organizzare il team',
  'Add departments to team members to see department analytics':
    'Assegna dipartimenti alle persone per vedere le analisi per dipartimento',
  'Analytics across all departments': 'Analisi su tutti i dipartimenti',
  'Complete breakdown by department': 'Dettaglio completo per dipartimento',
  'Auto-assign color': 'Colore assegnato automaticamente',
  'Annual Budget': 'Budget annuale',
  'Analyze team member workloads': 'Analizza il carico di lavoro del team',
  'Custom Permissions': 'Permessi personalizzati',
  'Contact your administrator to request changes to your role or permissions.':
    'Contatta un amministratore per richiedere modifiche al tuo ruolo o ai permessi.',

  // --- analisi ---
  'Analytics Dashboard': 'Cruscotto di analisi',
  'Average Engagement': 'Coinvolgimento medio',
  'Avg Rating': 'Valutazione media',
  'Comprehensive analytics for your team': 'Analisi complete del tuo team',
  'Comprehensive performance insights': 'Quadro completo delle prestazioni',
  'Complete performance breakdown': 'Dettaglio completo delle prestazioni',
  'Complete system overview and analytics': 'Quadro generale del sistema e analisi',
  'Analyzing...': 'Analisi in corso...',
  'CSV report downloaded successfully!': 'Report CSV scaricato',
  'Can I export analytics reports?': 'Posso esportare i report di analisi?',
  'Can I attach files to tasks?': 'Posso allegare file alle attività?',

  // --- AI ---
  'AI Assistant': 'Assistente AI',
  'AI Auto-Assign': 'Assegnazione automatica AI',
  'AI Features': 'Funzioni AI',
  'AI Insights': 'Analisi AI',
  'AI Model': 'Modello AI',
  'AI Recommendation': 'Suggerimento AI',
  'AI Assignment Suggestions': 'Proposte di assegnazione AI',
  'AI Duration & Deadline Estimate': 'Stima AI di durata e scadenza',
  'AI estimate generated!': 'Stima AI generata',
  'Applied AI suggestion!': 'Suggerimento AI applicato',
  'Apply All Assignments': 'Applica tutte le assegnazioni',
  'Apply This Suggestion': 'Applica questo suggerimento',
  'Assignment Mode': 'Modalità di assegnazione',
  'Ask me anything about your tasks and team!':
    'Chiedimi quello che vuoi sulle attività e sul team',
  'Ask me anything about your tasks...': 'Chiedimi qualcosa sulle tue attività...',
  'Configure AI-powered capabilities': 'Configura le funzioni basate su AI',

  // --- annunci e feedback ---
  'Announcement': 'Annuncio',
  'Announcement deleted': 'Annuncio eliminato',
  'Announcement posted!': 'Annuncio pubblicato',
  'Announcement updated!': 'Annuncio aggiornato',
  'Announcement updated successfully!': 'Annuncio aggiornato',
  'Create announcements': 'Crea annunci',
  'Be the first to share your thoughts!': 'Sii il primo a dire la tua',
  'Brief summary of your feedback': 'Breve riassunto del tuo riscontro',
  'Bug Report': 'Segnalazione di un problema',
  'Bug Reports': 'Segnalazioni di problemi',

  // --- notifiche ---
  'Choose which events trigger notifications': 'Scegli quali eventi generano una notifica',
  'Control how often you receive notifications': 'Con quale frequenza ricevere le notifiche',
  'Control when and how you receive notifications': 'Quando e come ricevere le notifiche',
  'All notification types disabled': 'Tutti i tipi di notifica disattivati',
  'All notification types enabled': 'Tutti i tipi di notifica attivati',
  'Batched (every 15 min)': 'Raggruppate (ogni 15 minuti)',
  'Daily digest': 'Riepilogo giornaliero',
  'Daily Digest Time': 'Ora del riepilogo giornaliero',

  // --- email ---
  'Bounce Rate': 'Percentuale di mancata consegna',
  'Click': 'Clic',
  'Clicks': 'Clic',
  'Click Rate': 'Percentuale di clic',
  'Click-to-Open Rate': 'Clic sulle email aperte',
  'Combined open and click rate average': 'Media di aperture e clic',
  'Attachment Inclusion': 'Inclusione degli allegati',
  'Allowed File Types': 'Tipi di file consentiti',
  'Currently allowed file types for email attachments':
    'Tipi di file attualmente consentiti come allegati',
  'Alert users when attachments cannot be included':
    'Avvisa quando un allegato non può essere incluso',
  'Configure how task attachments are included in email notifications':
    'Come includere gli allegati delle attività nelle email di notifica',
  'Control whether task attachments are sent with email notifications':
    'Decide se gli allegati delle attività vengono inviati con le email',
  'Customize email notifications sent to users for various task events':
    'Personalizza le email inviate per i vari eventi delle attività',
  'Available Variables': 'Variabili disponibili',
  'Click a variable to insert it at cursor position':
    'Clicca una variabile per inserirla nel punto del cursore',
  'Best regards,': 'Cordiali saluti,',

  // --- amministrazione ---
  'Access email settings and system configuration':
    'Accedi alle impostazioni email e alla configurazione di sistema',
  'Active Settings Summary': 'Riepilogo delle impostazioni attive',
  'Application Name': 'Nome dell\'applicazione',
  'Company Name': 'Nome dell\'azienda',
  'Basic application configuration': 'Configurazione di base dell\'applicazione',
  'Configure system-wide settings and preferences':
    'Configura le impostazioni generali del sistema',
  'Current system status and statistics': 'Stato attuale del sistema e statistiche',
  'Current data usage across all collections': 'Spazio occupato dai dati',
  'Audit Entries': 'Voci del registro',
  'Audit Log': 'Registro delle attività',
  'Audit Logging': 'Registrazione delle attività',
  'Audit log cleared': 'Registro svuotato',
  'Clear Audit Log': 'Svuota il registro',
  'Clear All Data': 'Cancella tutti i dati',
  'All data cleared successfully': 'Tutti i dati sono stati cancellati',
  'Backup & Restore': 'Backup e ripristino',
  'Backup, restore, and manage system data': 'Backup, ripristino e gestione dei dati',
  'Changes discarded': 'Modifiche annullate',
  'Allow Self Registration': 'Consenti la registrazione autonoma',
  'Allowed IP Addresses': 'Indirizzi IP consentiti',
  'Add IP Address': 'Aggiungi indirizzo IP',
  'Central Time': 'Fuso orario centrale',
  'Custom Time Range': 'Intervallo personalizzato',
  'DD/MM/YYYY': 'GG/MM/AAAA',
  'After 81 iterations, your application is ready to deploy.':
    'Dopo 81 iterazioni, l\'applicazione e pronta per la pubblicazione.',
  'Click the': 'Clicca su',
};

/**
 * Testi la cui lingua di partenza e' l'italiano (schermate scritte
 * direttamente in italiano) e che quindi hanno bisogno della versione inglese.
 */
export const TESTI_EN_EXTRA: Record<string, string> = {
  'Accesso revocato e membro rimosso': 'Access revoked and member removed',
  'Apri TaskFlow per vedere i dettagli.': 'Open TaskFlow to see the details.',
  'Assegna una nuova password provvisoria': 'Set a new temporary password',
  'Backup ripristinato. Ricarico la pagina...': 'Backup restored. Reloading...',
};
