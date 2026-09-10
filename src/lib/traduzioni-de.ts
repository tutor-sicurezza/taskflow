/** Traduzioni tedesche. Chiavi identiche a quelle italiane/inglesi. */
export const TESTI_DE: Record<string, string> = {
  // --- chiavi semantiche (partendo dall'italiano di i18n.ts) ---
  'app.sottotitolo': 'Verwalten Sie die Arbeit Ihres Teams',
  'login.titolo': 'Anmelden',
  'login.descrizione': 'Geben Sie Ihre Zugangsdaten ein, um fortzufahren.',
  'login.email': 'E-Mail',
  'login.password': 'Passwort',
  'login.entra': 'Anmelden',
  'login.inCorso': 'Anmeldung läuft...',
  'login.emailObbligatoria': 'Die E-Mail-Adresse ist erforderlich',
  'login.emailNonValida': 'Geben Sie eine gültige E-Mail-Adresse ein',
  'login.passwordObbligatoria': 'Das Passwort ist erforderlich',
  'login.erroreGenerico': 'Es ist ein unerwarteter Fehler aufgetreten',
  'login.operazioneFallita': 'Vorgang fehlgeschlagen',
  'login.accountDaAmministratore': 'Konten werden vom Administrator erstellt.',
  'login.contattaAmministratore':
    'Wenn die Anmeldung nicht gelingt, wenden Sie sich an ihn.',
  'login.passwordDimenticata': 'Passwort vergessen?',
  'login.invioInCorso': 'Wird gesendet...',
  'login.inserisciEmailPerRipristino':
    'Geben Sie Ihre E-Mail-Adresse ein und fordern Sie dann die Zurücksetzung an',
  'login.ripristinoInviato':
    'Wenn die Adresse zu einem Konto gehört, erhalten Sie einen Link zum Zurücksetzen des Passworts. Prüfen Sie auch den Spam-Ordner.',

  'password.sottotitolo': 'Wählen Sie ein neues Passwort',
  'password.titolo': 'Neues Passwort',
  'password.descrizione':
    'Legen Sie das Passwort fest, mit dem Sie sich künftig anmelden.',
  'password.nuova': 'Neues Passwort',
  'password.ripeti': 'Passwort wiederholen',
  'password.minimo': 'Mindestens 8 Zeichen.',
  'password.troppoCorta': 'Das Passwort muss mindestens 8 Zeichen lang sein',
  'password.nonCoincidono': 'Die beiden Passwörter stimmen nicht überein',
  'password.salva': 'Neues Passwort speichern',
  'password.salvataggio': 'Wird gespeichert...',
  'password.annullaEsci': 'Abbrechen und abmelden',

  'org.nessuna': 'Diesem Konto ist keine Organisation zugeordnet',
  'org.creaTitolo': 'Erstellen Sie Ihre Organisation',
  'org.creaDescrizione':
    'Wenn Sie die Anwendung zum ersten Mal einrichten, erstellen Sie hier den Arbeitsbereich: Sie werden dessen Eigentümer und können weitere Personen einladen. Sollten Sie dagegen zu einer bestehenden Organisation gehören, bitten Sie einen Administrator, Sie hinzuzufügen.',
  'org.nome': 'Name der Organisation',
  'org.crea': 'Organisation erstellen',
  'org.creazione': 'Wird erstellt...',
  'org.nuovaTitolo': 'Neue Organisation',
  'org.nuovaDescrizione':
    'Sie werden Eigentümer des neuen Arbeitsbereichs, der leer beginnt. Die Daten der aktuellen Organisation bleiben unverändert.',
  'org.attiva': 'Aktive Organisation',
  'org.creaNuova': 'Eine neue Organisation erstellen',
  'org.creata': 'Organisation "{nome}" erstellt',
  'org.creazioneFallita': 'Erstellung fehlgeschlagen',

  'account.disattivato': 'Konto deaktiviert',
  'account.disattivatoDescrizione':
    'Dieses Konto wurde von einem Administrator deaktiviert. Wenden Sie sich an ihn, wenn Sie einen Fehler vermuten.',

  'credenziali.titolo': 'Zugangsdaten',
  'credenziali.descrizione':
    'Übergeben Sie diese Zugangsdaten der Benutzerin oder dem Benutzer: Das vorläufige Passwort wird nicht per E-Mail verschickt und ist nach dem Schließen dieses Fensters nicht mehr sichtbar.',
  'credenziali.annotate': 'Ich habe die Zugangsdaten notiert',

  'comune.esci': 'Abmelden',
  'comune.annulla': 'Abbrechen',
  'comune.caricamento': 'Wird geladen…',
  'comune.lingua': 'Sprache',
  'comune.nessunaOrganizzazione': 'Keine aktive Organisation',
  'comune.sessioneScaduta': 'Sitzung abgelaufen, bitte erneut anmelden',
  'comune.inizializzazioneFallita': 'Initialisierung fehlgeschlagen',
  'comune.richiestaFallita': 'Anfrage fehlgeschlagen ({stato})',
  'comune.modificaNonSalvata': 'Änderung nicht gespeichert',
  'ai.nonConfigurata': 'Die KI-Funktionen sind nicht eingerichtet. Ein erneuter Versuch hilft nicht: Wenden Sie sich an eine Administratorin oder einen Administrator.',
  'ai.nonDisponibile': 'Der KI-Dienst ist derzeit nicht erreichbar. Versuchen Sie es gleich noch einmal.',
  'ai.tempoScaduto': 'Der KI-Dienst hat zu lange gebraucht. Versuchen Sie es erneut.',
  'ai.limiteRaggiunto': 'Sie haben das Limit an KI-Anfragen erreicht. Versuchen Sie es später erneut.',
  'ai.testoTroppoLungo': 'Der Text ist zu lang für die Verarbeitung.',
  'ai.rifiutata': 'Der KI-Dienst hat diese Anfrage nicht angenommen.',
  'email.nonPartita': 'Benachrichtigung gespeichert, aber die E-Mail wurde nicht versendet',

  // --- generale, azioni ricorrenti ---
  'Cancel': 'Abbrechen',
  'Close': 'Schließen',
  'Save': 'Speichern',
  'Delete': 'Löschen',
  'Edit': 'Bearbeiten',
  'Apply': 'Anwenden',
  'Back': 'Zurück',
  'Next': 'Weiter',
  'Clear': 'Leeren',
  'Clear all': 'Alles leeren',
  'Create New': 'Neu erstellen',
  'Complete': 'Abschließen',
  'Bulk': 'Mehrfachauswahl',
  'Analysis': 'Analyse',
  'Analytics': 'Auswertungen',
  'Dashboard': 'Übersicht',
  'Category': 'Kategorie',
  'Custom': 'Benutzerdefiniert',
  'Archived': 'Archiviert',
  'Already exists': 'Existiert bereits',
  'Confirm Delete': 'Löschen bestätigen',
  'Are you sure? This action cannot be undone!':
    'Sind Sie sicher? Dieser Vorgang kann nicht rückgängig gemacht werden.',
  'Are you sure you want to remove': 'Möchten Sie wirklich entfernen',
  'All time': 'Gesamter Zeitraum',
  'All types': 'Alle Typen',
  'All Categories': 'Alle Kategorien',
  'All Departments': 'Alle Abteilungen',
  'All Departments Selected': 'Alle Abteilungen ausgewählt',
  'All Members': 'Alle Mitglieder',
  'All Priority': 'Alle Prioritäten',
  'All Status': 'Alle Status',
  'No data available': 'Keine Daten verfügbar',

  // --- stati e priorità ---
  'Active': 'Aktiv',
  'Completed': 'Abgeschlossen',
  'In Progress': 'In Bearbeitung',
  'Not Started': 'Nicht begonnen',
  'Overdue': 'Überfällig',
  'Priority': 'Priorität',
  'Status': 'Status',
  'High': 'Hoch',
  'High Priority': 'Hohe Priorität',
  'Description': 'Beschreibung',

  // --- attività ---
  'Task': 'Aufgabe',
  'Tasks': 'Aufgaben',
  'Add Task': 'Aufgabe hinzufügen',
  'Create Task': 'Aufgabe erstellen',
  'Create New Task': 'Neue Aufgabe',
  'Total Tasks': 'Aufgaben gesamt',
  'Active Tasks': 'Aktive Aufgaben',
  'Completed Tasks': 'Abgeschlossene Aufgaben',
  'Assigned Tasks': 'Zugewiesene Aufgaben',
  'View Task': 'Aufgabe öffnen',
  'Assign To': 'Zuweisen an',
  'Assignee': 'Zugewiesene Person',
  'Add task details...': 'Details hinzufügen...',
  'Add a comment...': 'Kommentar schreiben...',
  'Add comments and attachments': 'Kommentare und Anhänge hinzufügen',
  "Add a new task to your team's workflow. Fill in the details below.":
    'Fügen Sie der Arbeit Ihres Teams eine neue Aufgabe hinzu. Füllen Sie die Felder unten aus.',
  "All changes are automatically tracked in the task's activity history.":
    'Alle Änderungen werden automatisch im Verlauf der Aufgabe festgehalten.',
  'Comment added!': 'Kommentar hinzugefügt',
  'Comment deleted': 'Kommentar gelöscht',
  'Comment updated!': 'Kommentar aktualisiert',
  'Comments and mentions': 'Kommentare und Erwähnungen',
  'Attachment removed': 'Anhang entfernt',
  'Completion Rate': 'Abschlussquote',
  'Average Completion Time': 'Durchschnittliche Bearbeitungszeit',
  'Avg. Completion Time': 'Durchschn. Bearbeitungszeit',
  'Avg Time': 'Durchschn. Zeit',
  'Avg Tasks': 'Durchschn. Aufgaben',
  'Avg Tasks per Member': 'Durchschn. Aufgaben pro Mitglied',
  'Avg/Employee': 'Durchschnitt pro Person',
  'Avg/User': 'Durchschnitt pro Benutzer',
  'Current state of all tasks': 'Aktueller Stand aller Aufgaben',
  'Consider task priorities and deadlines':
    'Berücksichtigt Prioritäten und Fristen',
  'Auto-archive Completed After (days)':
    'Abgeschlossene archivieren nach (Tage)',
  'Allow Task Deletion': 'Löschen von Aufgaben erlauben',
  'Configure task behavior and policies': 'Verhalten und Regeln der Aufgaben',

  // --- persone e dipartimenti ---
  'Admin': 'Administrator',
  'Admin (Super Admin)': 'Administrator (Super-Administrator)',
  'Add User': 'Benutzer hinzufügen',
  'Add Team Member': 'Teammitglied hinzufügen',
  'Add a new member to your team': 'Fügen Sie Ihrem Team eine Person hinzu',
  'Active Members': 'Aktive Mitglieder',
  'Active Users': 'Aktive Benutzer',
  'Active Team Members': 'Aktive Teammitglieder',
  'Avatar URL': 'Bild-URL',
  'Brief description about the team member...':
    'Kurze Beschreibung des Teammitglieds...',
  'Departments': 'Abteilungen',
  'Department already added': 'Abteilung bereits hinzugefügt',
  'Active Departments': 'Aktive Abteilungen',
  'Active departments': 'Aktive Abteilungen',
  'Archived Departments': 'Archivierte Abteilungen',
  'Archive inactive departments': 'Inaktive Abteilungen archivieren',
  'Add Department': 'Abteilung hinzufügen',
  'Add New Department': 'Neue Abteilung',
  'Create Department': 'Abteilung erstellen',
  'Custom Departments': 'Benutzerdefinierte Abteilungen',
  'Assign Departments': 'Abteilungen zuweisen',
  'Add to existing departments': 'Zu bestehenden Abteilungen hinzufügen',
  'Allow Multiple Departments': 'Mehrere Abteilungen erlauben',
  'Assign employees to multiple departments':
    'Personen mehreren Abteilungen zuweisen',
  'A department with this name already exists':
    'Eine Abteilung mit diesem Namen existiert bereits',
  'Brief description of this department...':
    'Kurze Beschreibung der Abteilung...',
  'Busiest Department': 'Am stärksten ausgelastete Abteilung',
  'Busiest Departments': 'Am stärksten ausgelastete Abteilungen',
  'Choose departments to assign to the selected team members':
    'Wählen Sie die Abteilungen, die den ausgewählten Teammitgliedern zugewiesen werden',
  'Create a new department to organize your team structure':
    'Erstellen Sie eine Abteilung, um die Struktur Ihres Teams zu ordnen',
  'Create and manage departments, assign leads, and track team organization':
    'Abteilungen erstellen und verwalten, Leitungen zuweisen und die Organisation verfolgen',
  'Create new departments with details (name, description, color, lead, budget)':
    'Neue Abteilungen mit Name, Beschreibung, Farbe, Leitung und Budget erstellen',
  'Create your first department to start organizing your team':
    'Erstellen Sie die erste Abteilung, um Ihr Team zu ordnen',
  'Add departments to team members to see department analytics':
    'Weisen Sie Teammitgliedern Abteilungen zu, um Auswertungen je Abteilung zu sehen',
  'Analytics across all departments': 'Auswertungen über alle Abteilungen',
  'Complete breakdown by department': 'Vollständige Aufschlüsselung nach Abteilung',
  'Auto-assign color': 'Farbe automatisch zuweisen',
  'Annual Budget': 'Jahresbudget',
  'Analyze team member workloads': 'Auslastung der Teammitglieder analysieren',
  'Custom Permissions': 'Benutzerdefinierte Berechtigungen',
  'Contact your administrator to request changes to your role or permissions.':
    'Wenden Sie sich an einen Administrator, um Ihre Rolle oder Ihre Berechtigungen ändern zu lassen.',

  // --- analisi ---
  'Analytics Dashboard': 'Auswertungsübersicht',
  'Average Engagement': 'Durchschnittliche Interaktion',
  'Avg Rating': 'Durchschnittliche Bewertung',
  'Comprehensive analytics for your team':
    'Umfassende Auswertungen für Ihr Team',
  'Comprehensive performance insights': 'Umfassender Blick auf die Leistung',
  'Complete performance breakdown': 'Vollständige Aufschlüsselung der Leistung',
  'Complete system overview and analytics':
    'Vollständiger Systemüberblick und Auswertungen',
  'Analyzing...': 'Analyse läuft...',
  'CSV report downloaded successfully!': 'CSV-Bericht heruntergeladen',
  'Can I export analytics reports?': 'Kann ich Auswertungsberichte exportieren?',
  'Can I attach files to tasks?': 'Kann ich Dateien an Aufgaben anhängen?',

  // --- AI ---
  'AI Assistant': 'KI-Assistent',
  'AI Auto-Assign': 'Automatische KI-Zuweisung',
  'AI Features': 'KI-Funktionen',
  'AI Insights': 'KI-Analysen',
  'AI Model': 'KI-Modell',
  'AI Recommendation': 'KI-Empfehlung',
  'AI Assignment Suggestions': 'KI-Vorschläge zur Zuweisung',
  'AI Duration & Deadline Estimate': 'KI-Schätzung von Dauer und Frist',
  'AI estimate generated!': 'KI-Schätzung erstellt',
  'Applied AI suggestion!': 'KI-Vorschlag angewendet',
  'Apply All Assignments': 'Alle Zuweisungen anwenden',
  'Apply This Suggestion': 'Diesen Vorschlag anwenden',
  'Assignment Mode': 'Zuweisungsmodus',
  'Ask me anything about your tasks and team!':
    'Fragen Sie mich alles zu Ihren Aufgaben und Ihrem Team',
  'Ask me anything about your tasks...':
    'Fragen Sie mich etwas zu Ihren Aufgaben...',
  'Configure AI-powered capabilities': 'KI-gestützte Funktionen konfigurieren',

  // --- annunci e feedback ---
  'Announcement': 'Ankündigung',
  'Announcement deleted': 'Ankündigung gelöscht',
  'Announcement posted!': 'Ankündigung veröffentlicht',
  'Announcement updated!': 'Ankündigung aktualisiert',
  'Announcement updated successfully!': 'Ankündigung aktualisiert',
  'Create announcements': 'Ankündigungen erstellen',
  'Be the first to share your thoughts!':
    'Sagen Sie als Erste oder Erster Ihre Meinung',
  'Brief summary of your feedback': 'Kurze Zusammenfassung Ihrer Rückmeldung',
  'Bug Report': 'Fehlermeldung',
  'Bug Reports': 'Fehlermeldungen',

  // --- notifiche ---
  'Choose which events trigger notifications':
    'Wählen Sie, welche Ereignisse eine Benachrichtigung auslösen',
  'Control how often you receive notifications':
    'Wie oft Sie Benachrichtigungen erhalten',
  'Control when and how you receive notifications':
    'Wann und wie Sie Benachrichtigungen erhalten',
  'All notification types disabled': 'Alle Benachrichtigungstypen deaktiviert',
  'All notification types enabled': 'Alle Benachrichtigungstypen aktiviert',
  'Batched (every 15 min)': 'Gebündelt (alle 15 Minuten)',
  'Daily digest': 'Tägliche Zusammenfassung',
  'Daily Digest Time': 'Uhrzeit der täglichen Zusammenfassung',

  // --- email ---
  'Bounce Rate': 'Rücklaufquote',
  'Click': 'Klick',
  'Clicks': 'Klicks',
  'Click Rate': 'Klickrate',
  'Click-to-Open Rate': 'Klicks je geöffneter E-Mail',
  'Combined open and click rate average':
    'Durchschnitt aus Öffnungs- und Klickrate',
  'Attachment Inclusion': 'Anhänge einbeziehen',
  'Allowed File Types': 'Erlaubte Dateitypen',
  'Currently allowed file types for email attachments':
    'Derzeit als E-Mail-Anhang erlaubte Dateitypen',
  'Alert users when attachments cannot be included':
    'Hinweisen, wenn ein Anhang nicht eingefügt werden kann',
  'Configure how task attachments are included in email notifications':
    'Wie Anhänge von Aufgaben in Benachrichtigungs-E-Mails eingefügt werden',
  'Control whether task attachments are sent with email notifications':
    'Legt fest, ob Anhänge von Aufgaben mit den E-Mails versendet werden',
  'Customize email notifications sent to users for various task events':
    'Passen Sie die E-Mails für die verschiedenen Aufgabenereignisse an',
  'Available Variables': 'Verfügbare Variablen',
  'Click a variable to insert it at cursor position':
    'Klicken Sie eine Variable an, um sie an der Cursorposition einzufügen',
  'Best regards,': 'Mit freundlichen Grüßen,',

  // --- amministrazione ---
  'Access email settings and system configuration':
    'Zu den E-Mail-Einstellungen und zur Systemkonfiguration',
  'Active Settings Summary': 'Zusammenfassung der aktiven Einstellungen',
  'Application Name': 'Name der Anwendung',
  'Company Name': 'Name des Unternehmens',
  'Basic application configuration': 'Grundlegende Konfiguration der Anwendung',
  'Configure system-wide settings and preferences':
    'Systemweite Einstellungen konfigurieren',
  'Current system status and statistics':
    'Aktueller Systemzustand und Statistiken',
  'Current data usage across all collections': 'Aktuell belegter Speicherplatz',
  'Audit Entries': 'Protokolleinträge',
  'Audit Log': 'Prüfprotokoll',
  'Audit Logging': 'Protokollierung',
  'Audit log cleared': 'Prüfprotokoll geleert',
  'Clear Audit Log': 'Prüfprotokoll leeren',
  'Clear All Data': 'Alle Daten löschen',
  'All data cleared successfully': 'Alle Daten wurden gelöscht',
  'Backup & Restore': 'Sicherung und Wiederherstellung',
  'Backup, restore, and manage system data':
    'Sicherung, Wiederherstellung und Verwaltung der Daten',
  'Changes discarded': 'Änderungen verworfen',
  'Allow Self Registration': 'Selbstregistrierung erlauben',
  'Allowed IP Addresses': 'Erlaubte IP-Adressen',
  'Add IP Address': 'IP-Adresse hinzufügen',
  'Central Time': 'Central Time',
  'Custom Time Range': 'Benutzerdefinierter Zeitraum',
  'DD/MM/YYYY': 'TT/MM/JJJJ',
  'After 81 iterations, your application is ready to deploy.':
    'Nach 81 Iterationen ist Ihre Anwendung bereit für die Veröffentlichung.',
  'Click the': 'Klicken Sie auf',

  // --- testi la cui lingua di partenza è l'italiano ---
  'Accesso revocato e membro rimosso': 'Zugang entzogen und Mitglied entfernt',
  'Apri TaskFlow per vedere i dettagli.':
    'Öffnen Sie TaskFlow, um die Details zu sehen.',
  'Assegna una nuova password provvisoria':
    'Ein neues vorläufiges Passwort vergeben',
  'Backup ripristinato. Ricarico la pagina...':
    'Sicherung wiederhergestellt. Seite wird neu geladen...',

  // --- dati e backup ---
  'Data': 'Daten',
  'Data Management': 'Datenverwaltung',
  'Data Retention (days)': 'Aufbewahrung der Daten (Tage)',
  'Data Safety': 'Datensicherheit',
  'Data exported successfully!': 'Daten exportiert',
  'Data imported successfully! Refresh to see changes.':
    'Daten importiert. Laden Sie die Seite neu, um die Änderungen zu sehen.',
  'Download a backup of all tasks, employees, and settings':
    'Laden Sie eine Sicherung aller Aufgaben, Personen und Einstellungen herunter',
  'Download a complete backup of all system data including tasks, users, settings, and audit logs.':
    'Laden Sie eine vollständige Sicherung herunter: Aufgaben, Benutzer, Einstellungen und Prüfprotokoll.',
  'Export': 'Exportieren',
  'Export Backup': 'Sicherung exportieren',
  'Export Data': 'Daten exportieren',
  'Export Report': 'Bericht exportieren',
  'Export as CSV': 'Als CSV exportieren',
  'Export as PDF': 'Als PDF exportieren',
  'Export, import, or clear your TaskFlow data':
    'Daten exportieren, importieren oder löschen',
  'Import Data': 'Daten importieren',
  'Failed to clear data': 'Löschen der Daten fehlgeschlagen',
  'Failed to export data': 'Export fehlgeschlagen',
  'Failed to export CSV report': 'Export des CSV-Berichts fehlgeschlagen',
  'Failed to export PDF report': 'Export des PDF-Berichts fehlgeschlagen',
  'Failed to import data. Please check the file format.':
    'Import fehlgeschlagen. Prüfen Sie das Dateiformat.',
  'Failed to read file': 'Datei konnte nicht gelesen werden',
  'File attached successfully!': 'Datei angehängt',
  'File size must be less than 10MB':
    'Die Datei muss kleiner als 10 MB sein',
  'Files are stored securely and can be downloaded or deleted by authorized users.':
    'Die Dateien werden sicher gespeichert und können von berechtigten Personen heruntergeladen oder gelöscht werden.',

  // --- eliminazioni e conferme ---
  'Delete Department?': 'Abteilung löschen?',
  'Delete Task?': 'Aufgabe löschen?',
  'Delete Team Member?': 'Teammitglied entfernen?',
  'Delete Task': 'Aufgabe löschen',
  'Discard Changes': 'Änderungen verwerfen',
  'Deselect All': 'Auswahl aufheben',
  'Disable All': 'Alle deaktivieren',
  'Enable All': 'Alle aktivieren',
  'Declined': 'Abgelehnt',

  // --- dipartimenti ---
  'Department': 'Abteilung',
  'Department Admin Dashboard': 'Übersicht der Abteilungsleitung',
  'Department Analytics': 'Auswertungen je Abteilung',
  'Department Analytics Report': 'Auswertungsbericht je Abteilung',
  'Department Announcements': 'Ankündigungen der Abteilung',
  'Department Color': 'Farbe der Abteilung',
  'Department Color Guide': 'Farbleitfaden der Abteilungen',
  'Department Colors': 'Farben der Abteilungen',
  'Department Details': 'Details der Abteilung',
  'Department Health': 'Zustand der Abteilung',
  'Department Information': 'Informationen zur Abteilung',
  'Department Lead': 'Abteilungsleitung',
  'Department Management': 'Verwaltung der Abteilungen',
  'Department Performance': 'Leistung je Abteilung',
  'Department Performance Overview': 'Leistungsüberblick je Abteilung',
  'Department Performance Radar': 'Leistungsradar je Abteilung',
  'Department Settings': 'Einstellungen der Abteilungen',
  'Department Summary': 'Zusammenfassung der Abteilung',
  'Department Tasks': 'Aufgaben der Abteilung',
  'Department Templates': 'Abteilungsvorlagen',
  'Department name is required': 'Der Name der Abteilung ist erforderlich',
  'Department organization and policies':
    'Organisation und Regeln der Abteilungen',
  'Departments with issues': 'Abteilungen mit Problemen',
  'Edit Department': 'Abteilung bearbeiten',
  'Enable Department Budgets': 'Abteilungsbudgets aktivieren',
  'Employee Count by Department': 'Anzahl der Personen je Abteilung',
  'Filter tasks by department': 'Aufgaben nach Abteilung filtern',
  'Engineering, Sales, Marketing...': 'Technik, Vertrieb, Marketing...',
  'Enter department name or select existing':
    'Namen der Abteilung eingeben oder eine bestehende wählen',
  'Lead': 'Leitung',
  'Leads': 'Leitungen',

  // --- persone ---
  'Default User Role': 'Standardrolle',
  'Designate as Team Lead': 'Als Teamleitung festlegen',
  'Edit Team Member': 'Teammitglied bearbeiten',
  'Employees': 'Personen',
  'Employee Performance': 'Leistung der Personen',
  'Email Address': 'E-Mail-Adresse',
  'Email is required: the account is created from this address':
    'Die E-Mail-Adresse ist erforderlich: Das Konto wird aus dieser Adresse erstellt',
  'Invalid name or role': 'Name oder Rolle ungültig',
  'Full system access': 'Vollständiger Systemzugriff',
  'Highest workload per employee': 'Höchste Auslastung pro Person',
  'Highest completion rates': 'Höchste Abschlussquoten',
  'Highest Rated': 'Beste Bewertung',
  'Health Score': 'Zustandswert',
  'Inactive': 'Inaktiv',

  // --- attività ---
  'Edit Task': 'Aufgabe bearbeiten',
  'Enter task title...': 'Titel der Aufgabe...',
  'Due Date': 'Fälligkeitsdatum',
  'Default Task Duration (days)': 'Standarddauer einer Aufgabe (Tage)',
  'Escalate Overdue After (days)': 'Überfällige Aufgaben melden nach (Tage)',
  'Estimated Duration': 'Geschätzte Dauer',
  'Enable Subtasks': 'Teilaufgaben aktivieren',
  'Enable Task Dependencies': 'Abhängigkeiten zwischen Aufgaben aktivieren',
  'High Priority Tasks': 'Aufgaben mit hoher Priorität',
  'In Progress Tasks': 'Aufgaben in Bearbeitung',
  'From creation to completion': 'Von der Erstellung bis zum Abschluss',
  'Key Factors': 'Wichtigste Faktoren',
  'Generate Estimate': 'Schätzung erstellen',
  'Generate optimal assignment suggestions':
    'Optimale Zuweisungsvorschläge erstellen',
  'Get intelligent insights and suggestions for your tasks':
    'Analysen und Vorschläge zu Ihren Aufgaben',
  'Enable Auto-Assignment': 'Automatische Zuweisung aktivieren',
  'Enable Smart Suggestions': 'Intelligente Vorschläge aktivieren',
  'Enable AI Features': 'KI-Funktionen aktivieren',
  'Enable all AI-powered features': 'Alle KI-gestützten Funktionen aktivieren',
  'Insights updated!': 'Analysen aktualisiert',

  // --- annunci ---
  'Edit announcement': 'Ankündigung bearbeiten',
  'Editing announcement': 'Ankündigung wird bearbeitet',
  'Enter announcement title': 'Titel der Ankündigung',
  'Enter your announcement message...': 'Text der Ankündigung...',
  'Invalid title or message': 'Titel oder Nachricht ungültig',
  'Important': 'Wichtig',
  'Info': 'Information',

  // --- notifiche ---
  'Delivery Frequency': 'Zustellhäufigkeit',
  'Desktop Alerts': 'Desktop-Hinweise',
  'Desktop Notifications': 'Desktop-Benachrichtigungen',
  'Desktop notifications enabled!': 'Desktop-Benachrichtigungen aktiviert',
  'Desktop notifications were blocked. Please enable them in your browser settings.':
    'Desktop-Benachrichtigungen sind blockiert. Aktivieren Sie sie in den Einstellungen Ihres Browsers.',
  'Enable Notifications': 'Benachrichtigungen aktivieren',
  'Enable System Notifications': 'Systembenachrichtigungen aktivieren',
  'Enable Email Notifications': 'E-Mail-Benachrichtigungen aktivieren',
  'Email Notifications': 'E-Mail-Benachrichtigungen',
  'Get notified via email about task updates':
    'Erhalten Sie Aktualisierungen zu Aufgaben per E-Mail',
  'End Time': 'Endzeit',
  'Hourly': 'Stündlich',
  'Last 7 days': 'Letzte 7 Tage',
  'Last 30 days': 'Letzte 30 Tage',
  'Last 90 days': 'Letzte 90 Tage',

  // --- email ---
  'Delivery Logs': 'Zustellprotokoll',
  'Device': 'Gerät',
  'Device Distribution': 'Verteilung nach Gerät',
  'Email': 'E-Mail',
  'Email Activity Over Time': 'E-Mail-Aktivität im Zeitverlauf',
  'Email Analytics': 'E-Mail-Auswertungen',
  'Email Attachments': 'E-Mail-Anhänge',
  'Email Attachment Settings': 'Einstellungen für Anhänge',
  'Email Delivery Analytics': 'Auswertung der E-Mail-Zustellung',
  'Email Template Customization': 'Anpassung der E-Mail-Vorlagen',
  'Email Templates': 'E-Mail-Vorlagen',
  'Email Types Distribution': 'Verteilung nach E-Mail-Typ',
  'Email attachment settings saved': 'Einstellungen für Anhänge gespeichert',
  'Email subject...': 'Betreff...',
  'Email template saved successfully!': 'E-Mail-Vorlage gespeichert',
  'Engagement': 'Interaktion',
  'Engagement Metrics': 'Kennzahlen zur Interaktion',
  'Exclusion Notifications': 'Hinweise auf ausgeschlossene Anhänge',
  'Executable files (.exe, .bat, .sh) are automatically excluded for security reasons':
    'Ausführbare Dateien (.exe, .bat, .sh) werden aus Sicherheitsgründen automatisch ausgeschlossen',
  'Include a note in the email when some attachments exceed size limits':
    'Einen Hinweis in die E-Mail aufnehmen, wenn Anhänge die Größenbeschränkung überschreiten',
  'Include attachments in emails': 'Anhänge in E-Mails einfügen',
  'Individual files larger than this will be excluded from emails':
    'Größere Einzeldateien werden nicht per E-Mail versendet',
  'Images': 'Bilder',
  'HTML Template': 'HTML-Vorlage',
  'Latest email delivery activity': 'Letzte Zustellungen',
  'Editor': 'Editor',

  // --- sistema ---
  'Date Format': 'Datumsformat',
  'Eastern Time': 'Eastern Time',
  'Enable API Access': 'API-Zugriff aktivieren',
  'Enable Audit Log': 'Prüfprotokoll aktivieren',
  'Enable IP Whitelist': 'Liste erlaubter IP-Adressen aktivieren',
  'Enable Slack Integration': 'Slack-Integration aktivieren',
  'Enable Two-Factor Authentication': 'Zwei-Faktor-Authentifizierung aktivieren',
  'Enforce password complexity rules':
    'Regeln zur Passwortkomplexität durchsetzen',
  'Expiration Date': 'Ablaufdatum',
  'External service connections': 'Verbindungen zu externen Diensten',
  'General': 'Allgemein',
  'General Settings': 'Allgemeine Einstellungen',
  'Integrations': 'Integrationen',
  'Invalid IP address format': 'Ungültiges Format der IP-Adresse',
  'IP address added': 'IP-Adresse hinzugefügt',
  'IP address removed': 'IP-Adresse entfernt',
  'Last 10 system changes': 'Letzte 10 Systemänderungen',
  'Iterations': 'Iterationen',
  'Launch Info': 'Informationen zum Start',
  'Language': 'Sprache',
  'English': 'Englisch',
  'Italian': 'Italienisch',
  'French': 'Französisch',
  'German': 'Deutsch',
  'GPT-4o (More capable)': 'GPT-4o (leistungsfähiger)',
  'GPT-4o-mini (Faster)': 'GPT-4o-mini (schneller)',

  // --- aiuto e riscontri ---
  'Help': 'Hilfe',
  'Help us improve TaskFlow by sharing your thoughts, suggestions, or reporting issues.':
    'Helfen Sie uns, TaskFlow zu verbessern: Teilen Sie Ihre Meinung und Vorschläge mit oder melden Sie ein Problem.',
  'Everything you need to know about using TaskFlow effectively':
    'Alles, was Sie für die tägliche Arbeit mit TaskFlow wissen müssen',
  'Feature Request': 'Funktionswunsch',
  'Feature Requests': 'Funktionswünsche',
  'Features': 'Funktionen',
  'Feedback Type': 'Art der Rückmeldung',
  'Feedback status updated': 'Status der Rückmeldung aktualisiert',
  'Give Feedback': 'Rückmeldung geben',
  'How would you rate your experience?':
    'Wie bewerten Sie Ihre Erfahrung?',
  'How do I access analytics?': 'Wie rufe ich die Auswertungen auf?',
  'How do I add comments to tasks?':
    'Wie füge ich einer Aufgabe Kommentare hinzu?',
  'How do I add team members?': 'Wie füge ich Teammitglieder hinzu?',
  'How do I create a new task?': 'Wie erstelle ich eine neue Aufgabe?',
  'How do I edit an existing task?':
    'Wie bearbeite ich eine bestehende Aufgabe?',
  'How do I manage departments?': 'Wie verwalte ich die Abteilungen?',
  'How do bulk operations work?': 'Wie funktionieren Mehrfachaktionen?',
  'How does AI Auto-Assignment work?':
    'Wie funktioniert die automatische KI-Zuweisung?',
  'Improvement Suggestion': 'Verbesserungsvorschlag',
  'Improvements': 'Verbesserungen',
  "I'll Do It Later": 'Später erledigen',
  'Detailed Performance Metrics': 'Detaillierte Leistungskennzahlen',
  'Il file non contiene dati da ripristinare':
    'Die Datei enthält keine Daten zum Wiederherstellen',

  // --- anagrafica e ruoli ---
  'Leave blank to auto-generate an avatar':
    'Leer lassen, um ein Bild automatisch zu erzeugen',
  'Location': 'Standort',
  'Manage': 'Verwalten',
  'Manage Role & Permissions': 'Rolle und Berechtigungen verwalten',
  'Manage Team': 'Team verwalten',
  'Manage Users': 'Benutzer verwalten',
  'Manage all users and departments':
    'Alle Benutzer und Abteilungen verwalten',
  'Manage tasks within their department(s)':
    'Verwaltet die Aufgaben der eigenen Abteilungen',
  'Manage your team members, roles, and departments':
    'Verwalten Sie Teammitglieder, Rollen und Abteilungen',
  "Manage your team's work efficiently":
    'Organisieren Sie die Arbeit Ihres Teams',
  'Manager': 'Manager',
  'Manager (Department Admin)': 'Manager (Abteilungsleitung)',
  'Member': 'Mitglied',
  'Name': 'Name',
  'Name and role are required': 'Name und Rolle sind erforderlich',
  'Phone Number': 'Telefonnummer',
  'Role': 'Rolle',
  'Role and permissions updated successfully':
    'Rolle und Berechtigungen aktualisiert',
  'Need different permissions?': 'Benötigen Sie andere Berechtigungen?',
  'Override default role permissions with custom settings':
    'Die Standardberechtigungen der Rolle durch eigene Einstellungen ersetzen',
  'Permission Status': 'Status der Berechtigungen',
  'Search by name, role, email, department, skills...':
    'Suche nach Name, Rolle, E-Mail, Abteilung, Fähigkeiten...',
  'Select All': 'Alle auswählen',
  'Set Active': 'Als aktiv markieren',
  'Set Inactive': 'Als inaktiv markieren',
  'Senior Developer': 'Senior-Entwickler',
  'San Francisco, CA': 'Berlin, Deutschland',
  'New York, Remote...': 'München, Remote...',
  'React, TypeScript, Node.js': 'React, TypeScript, Node.js',

  // --- dipartimenti ---
  'No Department Data': 'Keine Daten zu Abteilungen',
  'No department data available': 'Keine Daten zu Abteilungen verfügbar',
  'No departments selected. Add departments above.':
    'Keine Abteilung ausgewählt. Fügen Sie oben eine hinzu.',
  'No departments yet': 'Noch keine Abteilungen',
  'No employees assigned to this department':
    'Dieser Abteilung ist keine Person zugewiesen',
  'Multi-metric comparison across departments':
    'Vergleich mehrerer Kennzahlen zwischen Abteilungen',
  'Quick insights for your departments':
    'Schneller Blick auf Ihre Abteilungen',
  'Quick-start templates for common department types. Choose individual departments or create entire categories at once.':
    'Fertige Vorlagen für die gängigsten Abteilungen. Wählen Sie eine einzelne Abteilung oder erstellen Sie ganze Kategorien auf einmal.',
  'Replace all departments': 'Alle Abteilungen ersetzen',
  'Require Department Assignment': 'Zuweisung zu einer Abteilung verlangen',
  'Select All Departments': 'Alle Abteilungen auswählen',
  'Select a team lead (optional)': 'Eine Leitung wählen (optional)',
  'Set department leads': 'Abteilungsleitungen festlegen',
  'Please select at least one department':
    'Wählen Sie mindestens eine Abteilung',

  // --- attività ---
  'Low Priority': 'Niedrige Priorität',
  'Medium': 'Mittel',
  'Medium Priority': 'Mittlere Priorität',
  'My Dashboard': 'Meine Übersicht',
  'My Tasks': 'Meine Aufgaben',
  'Match skills and departments':
    'Bringt Fähigkeiten und Abteilungen in Einklang',
  'New Task Assigned': 'Neue Aufgabe zugewiesen',
  'New Comment': 'Neuer Kommentar',
  'New Announcement': 'Neue Ankündigung',
  'Not Started Tasks': 'Noch nicht begonnene Aufgaben',
  'No task data available yet': 'Noch keine Daten zu Aufgaben',
  'No tasks found': 'Keine Aufgaben gefunden',
  'No unassigned tasks to assign': 'Keine Aufgabe zum Zuweisen vorhanden',
  'No upcoming deadlines in the next 3 days':
    'Keine Fristen in den nächsten 3 Tagen',
  'Overdue Tasks': 'Überfällige Aufgaben',
  'Overdue tasks (priority)': 'Überfällige Aufgaben (Priorität)',
  'Priority Breakdown': 'Aufschlüsselung nach Priorität',
  'Priority Distribution': 'Verteilung der Prioritäten',
  'Priority Warnings': 'Prioritätswarnungen',
  'Please enter a task title first':
    'Geben Sie zuerst den Titel der Aufgabe ein',
  'Reminder Before Due (days)': 'Erinnerung vor der Fälligkeit (Tage)',
  'Require Task Approval': 'Freigabe von Aufgaben verlangen',
  'Requiring immediate attention': 'Erfordern sofortige Aufmerksamkeit',
  'Needs Attention': 'Erfordert Aufmerksamkeit',
  'Need attention': 'Erfordern Aufmerksamkeit',
  'Review the suggested task assignments below. These are optimized for workload balance and task requirements.':
    'Prüfen Sie die vorgeschlagenen Zuweisungen: Sie berücksichtigen die Auslastung und die Anforderungen der Aufgaben.',
  'Review the suggestions before applying them.':
    'Prüfen Sie die Vorschläge, bevor Sie sie anwenden.',

  // --- messaggi vuoti ---
  'No active employees available': 'Keine aktive Person verfügbar',
  'No activity yet': 'Noch keine Aktivität',
  'No announcements': 'Keine Ankündigungen',
  'No attachments yet': 'Noch keine Anhänge',
  'No audit entries yet': 'Noch keine Protokolleinträge',
  'No click data available': 'Keine Daten zu Klicks',
  'No comments yet': 'Noch keine Kommentare',
  'No feedback yet': 'Noch keine Rückmeldungen',
  'No insights available yet': 'Noch keine Analysen verfügbar',
  'No notifications': 'Keine Benachrichtigungen',
  'No performance data available': 'Keine Daten zur Leistung',
  'No team members found': 'Keine Teammitglieder gefunden',
  'No team members yet. Add team members to see analytics.':
    'Noch keine Teammitglieder. Fügen Sie welche hinzu, um Auswertungen zu sehen.',
  'None': 'Keine',

  // --- notifiche ---
  'Mark all read': 'Alle als gelesen markieren',
  'Mark as read': 'Als gelesen markieren',
  'Muted': 'Stummgeschaltet',
  'Notification Frequency': 'Häufigkeit der Benachrichtigungen',
  'Notification Retention (days)':
    'Aufbewahrung der Benachrichtigungen (Tage)',
  'Notification Settings': 'Benachrichtigungseinstellungen',
  'Notification Sounds': 'Benachrichtigungstöne',
  'Notification Type': 'Benachrichtigungstyp',
  'Notification Types': 'Benachrichtigungstypen',
  'Notifications': 'Benachrichtigungen',
  'Notifications will be paused between these times':
    'In diesem Zeitraum werden die Benachrichtigungen ausgesetzt',
  'Notify when attachments are excluded':
    'Hinweisen, wenn ein Anhang ausgeschlossen wird',
  'Pause notifications during specific times':
    'Benachrichtigungen zu bestimmten Zeiten aussetzen',
  'Play sounds when notifications arrive':
    'Bei eingehenden Benachrichtigungen einen Ton abspielen',
  'Quiet Hours': 'Ruhezeiten',
  'Quiet Hours Active': 'Ruhezeiten aktiv',
  'Real-time': 'In Echtzeit',
  'Receive notifications': 'Benachrichtigungen erhalten',
  'Receive notifications via email':
    'Benachrichtigungen per E-Mail erhalten',
  'Receive real-time alerts on your desktop for important task updates':
    'Erhalten Sie sofortige Hinweise auf dem Desktop zu wichtigen Aktualisierungen',
  'Send Test Notification': 'Testbenachrichtigung senden',

  // --- email ---
  'Max Attachment Size (MB)': 'Maximale Größe eines Anhangs (MB)',
  'Maximum single attachment size': 'Maximale Größe eines einzelnen Anhangs',
  'Maximum total attachment size per email':
    'Maximale Gesamtgröße der Anhänge',
  'Most email providers have attachment size limits. SendGrid and Resend both support up to 25MB total.':
    'Fast alle Anbieter begrenzen die Größe von Anhängen: SendGrid und Resend erlauben insgesamt bis zu 25 MB.',
  'Most popular links in your emails':
    'Am häufigsten angeklickte Links in Ihren E-Mails',
  'Office Documents': 'Office-Dokumente',
  'PDF Documents': 'PDF-Dokumente',
  'Open Rate': 'Öffnungsrate',
  'Opened': 'Geöffnet',
  'Open and click rates for different email types':
    'Öffnungen und Klicks je E-Mail-Typ',
  'Percentage of opened emails that received clicks':
    'Anteil der geöffneten E-Mails, die einen Klick erhalten haben',
  'Performance by Email Type': 'Leistung je E-Mail-Typ',
  'Plain Text': 'Nur Text',
  'Preview': 'Vorschau',
  'Recent Deliveries': 'Letzte Zustellungen',
  'Recipient': 'Empfänger',
  'Resend': 'Resend',
  'SendGrid': 'SendGrid',
  'Sent': 'Gesendet',
  'Set maximum file sizes for email attachments':
    'Legen Sie die maximale Größe der Anhänge fest',
  'Save Template': 'Vorlage speichern',

  // --- sistema ---
  'MM/DD/YYYY': 'MM/TT/JJJJ',
  'Maintenance Mode': 'Wartungsmodus',
  'Max AI Requests Per Day': 'Maximale KI-Anfragen pro Tag',
  'Max Login Attempts': 'Maximale Anmeldeversuche',
  'Monday': 'Montag',
  'Mountain Time': 'Mountain Time',
  'Pacific Time': 'Pacific Time',
  'London': 'London',
  'Paris': 'Paris',
  'Password Expiry (days)': 'Ablauf des Passworts (Tage)',
  'Permanently delete all audit log entries. This action cannot be undone.':
    'Löscht alle Einträge des Prüfprotokolls endgültig. Dies kann nicht rückgängig gemacht werden.',
  'Permanently delete all tasks, employees, and settings':
    'Aufgaben, Personen und Einstellungen endgültig löschen',
  'Require 2FA for all users':
    'Zwei-Faktor-Authentifizierung für alle verlangen',
  'Require Email Verification': 'Bestätigung der E-Mail-Adresse verlangen',
  'Require Strong Passwords': 'Sichere Passwörter verlangen',
  'Reset': 'Zurücksetzen',
  'Reset to Default': 'Auf den Standardwert zurücksetzen',
  'Reset to Defaults': 'Auf die Standardwerte zurücksetzen',
  'Restore': 'Wiederherstellen',
  'Restore from a previous backup file':
    'Aus einer früheren Sicherungsdatei wiederherstellen',
  'Restore system data from a previously exported backup file.':
    'Stellen Sie die Daten aus einer zuvor exportierten Sicherung wieder her.',
  'Save Changes': 'Änderungen speichern',
  'Save Settings': 'Einstellungen speichern',
  'Security': 'Sicherheit',
  'Security Settings': 'Sicherheitseinstellungen',
  'Security Status': 'Sicherheitsstatus',
  'Security policies and audit configuration':
    'Sicherheitsregeln und Konfiguration des Prüfprotokolls',
  'Session Timeout (minutes)': 'Ablauf der Sitzung (Minuten)',
  'Set expiration date': 'Ablaufdatum festlegen',
  'Please set an expiry date': 'Legen Sie ein Ablaufdatum fest',
  'Overview': 'Übersicht',
  'Overall Summary': 'Gesamtzusammenfassung',
  'Quick Actions': 'Schnellaktionen',
  'Quick Info': 'Kurzinformationen',
  'Quick Presets': 'Voreinstellungen',
  'Recent Activity': 'Letzte Aktivität',
  'Recent Audit Log': 'Letzte Protokolleinträge',
  'Refresh': 'Aktualisieren',
  'Previous': 'Zurück',
  'Rate': 'Bewerten',
  'Recommendations': 'Empfehlungen',
  'Review': 'Prüfen',
  'Reviewing': 'In Prüfung',
  'Review and manage feedback from your team members':
    'Rückmeldungen des Teams lesen und verwalten',
  'Performance': 'Leistung',
  'Performance Patterns': 'Leistungsverlauf',
  'Message': 'Nachricht',
  'Most Popular': 'Am beliebtesten',
  'Most Recent': 'Neueste',
  'Other': 'Sonstiges',
  'Pinned': 'Angeheftet',
  'Planned': 'Geplant',
  'Praise': 'Lob',
  'Praise & Thanks': 'Lob und Dank',
  'Post Announcement': 'Ankündigung veröffentlichen',
  'New 30d': 'Neu in 30 Tagen',
  'Questions or need help? Check the Help Documentation or contact your administrator.':
    'Fragen oder Hilfe nötig? Sehen Sie in der Dokumentation nach oder wenden Sie sich an einen Administrator.',

  // --- validazioni ---
  'Please enter a message': 'Geben Sie eine Nachricht ein',
  'Please enter a title': 'Geben Sie einen Titel ein',
  'Please enter a valid email address':
    'Geben Sie eine gültige E-Mail-Adresse ein',
  'Please provide a description': 'Fügen Sie eine Beschreibung hinzu',
  'Please provide a title': 'Fügen Sie einen Titel hinzu',
  'Please provide as much detail as possible...':
    'Beschreiben Sie es so genau wie möglich...',
  'PDF report will open in print dialog':
    'Der PDF-Bericht wird im Druckdialog geöffnet',

  // --- testi già in italiano ---
  'Rimossa dalla configurazione una chiave API salvata dalla versione precedente: le chiavi vivono solo lato server.':
    'Ein von der vorherigen Version gespeicherter API-Schlüssel wurde aus der Konfiguration entfernt: Schlüssel liegen ausschließlich auf dem Server.',
  'Se stai leggendo questo messaggio, la configurazione di invio lato server funziona.':
    'Wenn Sie diese Nachricht lesen, funktioniert der serverseitige E-Mail-Versand.',
  'Sessione scaduta, accedi di nuovo':
    'Sitzung abgelaufen, bitte erneut anmelden',
  'Serve il ruolo': 'Erfordert die Rolle',
  'Invio di prova': 'Testversand',
  'Indica un indirizzo a cui inviare la prova':
    'Geben Sie eine Adresse für den Testversand an',
  'Le funzioni AI non sono attive': 'Die KI-Funktionen sind nicht aktiv',

  // --- impostazioni ---
  'Settings Version': 'Version der Einstellungen',
  'Settings reset to defaults':
    'Einstellungen auf die Standardwerte zurückgesetzt',
  'Settings saved successfully!': 'Einstellungen gespeichert',
  'Size Limits': 'Größenbeschränkungen',
  'Slack Webhook URL': 'Slack-Webhook-URL',
  'Webhook URL': 'Webhook-URL',
  'Smart Suggestions': 'Intelligente Vorschläge',
  'Sort by': 'Sortieren nach',
  'Spanish': 'Spanisch',
  'Standard Departments': 'Standardabteilungen',
  'Start Time': 'Startzeit',
  'Storage Information': 'Belegter Speicherplatz',
  'Sunday': 'Sonntag',
  'System Notifications': 'Systembenachrichtigungen',
  'System Overview': 'Systemüberblick',
  'System Settings': 'Systemeinstellungen',
  'System is currently in maintenance mode':
    'Das System befindet sich im Wartungsmodus',
  'System-wide notification configuration':
    'Systemweite Konfiguration der Benachrichtigungen',
  'Timezone': 'Zeitzone',
  'Tokyo': 'Tokio',
  'Week Start Day': 'Erster Tag der Woche',
  'YYYY-MM-DD': 'JJJJ-MM-TT',
  'Templates': 'Vorlagen',
  'Template reset to default. Click Save to apply changes.':
    'Vorlage auf den Standardwert zurückgesetzt. Klicken Sie auf Speichern, um die Änderungen zu übernehmen.',
  'Use Template': 'Vorlage verwenden',
  'Type': 'Typ',
  'Title': 'Titel',
  'Subject': 'Betreff',
  'Subject Line': 'Betreffzeile',
  'Text Files': 'Textdateien',
  'Total': 'Gesamt',
  'Unsaved Changes': 'Nicht gespeicherte Änderungen',
  'Track all system changes and actions':
    'Alle Systemänderungen und Aktionen nachverfolgen',
  'Track and manage department budgets':
    'Abteilungsbudgets verfolgen und verwalten',
  'Trends': 'Entwicklung',
  'Try Again': 'Erneut versuchen',
  'Volume': 'Lautstärke',
  'Test Sounds': 'Töne testen',
  'Test notification sent!': 'Testbenachrichtigung gesendet',
  'Tests Passed': 'Bestandene Tests',

  // --- team e analisi ---
  'Team': 'Team',
  'Team Analytics': 'Auswertungen des Teams',
  'Team Analytics Report': 'Auswertungsbericht des Teams',
  'Team Feedback Board': 'Rückmeldungen des Teams',
  'Team Lead': 'Teamleitung',
  'Team Leads': 'Teamleitungen',
  'Team Member Details': 'Details des Teammitglieds',
  'Team Members': 'Teammitglieder',
  'Team Performance': 'Leistung des Teams',
  'Team Performance Overview': 'Leistungsüberblick des Teams',
  'Team member updated successfully!': 'Teammitglied aktualisiert',
  'Team members will be notified of new comments on their assigned tasks.':
    'Teammitglieder werden über neue Kommentare zu den ihnen zugewiesenen Aufgaben benachrichtigt.',
  'Team members with overdue or high-priority tasks':
    'Teammitglieder mit überfälligen Aufgaben oder Aufgaben hoher Priorität',
  'Team size distribution': 'Verteilung der Teamgrößen',
  'Top Performer': 'Bestes Ergebnis',
  'Top Performers': 'Beste Ergebnisse',
  'Top Performing': 'Mit den besten Ergebnissen',
  'Total Departments': 'Abteilungen gesamt',
  'Total Employees': 'Personen gesamt',
  'Total Feedback': 'Rückmeldungen gesamt',
  'Total Members': 'Mitglieder gesamt',
  'Total Team Members': 'Teammitglieder gesamt',
  'Total Sent': 'Insgesamt gesendet',
  'Total tasks per department': 'Aufgaben gesamt je Abteilung',
  'With Leads': 'Mit Leitung',
  'Workload Alerts': 'Hinweise zur Auslastung',
  'Workload Analysis': 'Analyse der Auslastung',
  'Workload Distribution': 'Verteilung der Auslastung',
  'Workload by Department': 'Auslastung je Abteilung',
  'Target Departments': 'Betroffene Abteilungen',
  'Task Distribution by Department': 'Verteilung der Aufgaben je Abteilung',
  'Task breakdown by team member':
    'Aufschlüsselung der Aufgaben je Teammitglied',
  'Tasks by priority level': 'Aufgaben nach Prioritätsstufe',
  'Tasks completed over the last 7 days':
    'In den letzten 7 Tagen abgeschlossene Aufgaben',
  'Tasks due within 24 hours (priority)':
    'Innerhalb von 24 Stunden fällige Aufgaben (Priorität)',
  'Task Completion Trend': 'Entwicklung der Abschlüsse',
  'Task Status Distribution': 'Verteilung der Status',
  'Super Admin Dashboard': 'Übersicht des Super-Administrators',
  'Upcoming Deadlines': 'Nächste Fristen',
  'Unassigned': 'Nicht zugewiesen',
  'Unassigned Tasks': 'Nicht zugewiesene Aufgaben',

  // --- attività, notifiche ed eventi ---
  'Task Creation': 'Erstellung von Aufgaben',
  'Task Management': 'Verwaltung der Aufgaben',
  'Task Priority Updated': 'Priorität der Aufgabe aktualisiert',
  'Task Questions': 'Fragen zu Aufgaben',
  'Task Reassigned to You': 'Aufgabe Ihnen neu zugewiesen',
  'Task Status Updated': 'Status der Aufgabe aktualisiert',
  'Task Updated': 'Aufgabe aktualisiert',
  'Task assignments and updates':
    'Zuweisungen und Aktualisierungen von Aufgaben',
  'Status changes': 'Statusänderungen',
  'This is a reminder that your task is due soon.':
    'Erinnerung: Ihre Aufgabe wird bald fällig.',
  'Your task is now overdue and requires immediate attention.':
    'Ihre Aufgabe ist überfällig und erfordert sofortige Aufmerksamkeit.',
  'This action cannot be undone. This will permanently delete the task from your workspace.':
    'Dieser Vorgang kann nicht rückgängig gemacht werden: Die Aufgabe wird endgültig gelöscht.',
  'Update the task details below.':
    'Aktualisieren Sie unten die Details der Aufgabe.',
  'Upload Attachment': 'Anhang hochladen',
  'Urgent': 'Dringend',
  'You Were Mentioned': 'Sie wurden erwähnt',
  'View Task Now': 'Jetzt öffnen',
  'View Comment': 'Kommentar ansehen',
  'View My Tasks': 'Meine Aufgaben',
  'View All Tasks': 'Alle Aufgaben',
  'View All': 'Alle ansehen',
  'View Overdue': 'Überfällige ansehen',
  'View': 'Ansehen',
  'View details & comments': 'Details und Kommentare',
  'When you have unassigned tasks, click':
    'Wenn Sie nicht zugewiesene Aufgaben haben, klicken Sie auf',

  // --- utenti e permessi ---
  'User Management': 'Benutzerverwaltung',
  'User Role': 'Benutzerrolle',
  'User account policies and defaults':
    'Regeln und Standardwerte für Benutzerkonten',
  'User data exported successfully!': 'Benutzerdaten exportiert',
  'User not loaded': 'Benutzer nicht geladen',
  'Users': 'Benutzer',
  'Users can belong to multiple departments':
    'Personen können mehreren Abteilungen angehören',
  'Users must be assigned to at least one department':
    'Jede Person muss mindestens einer Abteilung angehören',
  'Viewer': 'Nur Lesezugriff',
  'View all analytics and reports':
    'Sieht alle Auswertungen und Berichte',
  'View and update their own tasks':
    'Sieht und aktualisiert die eigenen Aufgaben',
  'View department analytics': 'Sieht die Auswertungen der Abteilung',
  'View your current role and permissions':
    'Ihre aktuelle Rolle und Ihre Berechtigungen ansehen',
  'Your Access Level': 'Ihre Zugriffsstufe',
  'You do not have permission to manage roles':
    'Sie haben keine Berechtigung, Rollen zu verwalten',
  'You do not have permission to manage user roles. Only administrators can modify roles and permissions.':
    'Sie haben keine Berechtigung, Benutzerrollen zu verwalten: Nur Administratoren können Rollen und Berechtigungen ändern.',
  'Update department information and settings':
    'Informationen und Einstellungen der Abteilung aktualisieren',
  'Update team member information':
    'Informationen des Teammitglieds aktualisieren',
  'Update Announcement': 'Ankündigung aktualisieren',
  'Use AI features': 'Nutzt die KI-Funktionen',

  // --- riscontri ---
  'Share Feedback Now': 'Jetzt Rückmeldung geben',
  'Share Your Feedback': 'Sagen Sie uns Ihre Meinung',
  'Submit Feedback': 'Rückmeldung senden',
  'Suggested Deadline': 'Vorgeschlagene Frist',
  'Suggestion applied!': 'Vorschlag angewendet',
  'Thank you for your feedback! 🎉': 'Danke für Ihre Rückmeldung',
  'Thank You for Being Part of Our Launch':
    'Danke, dass Sie beim Start dabei sind',
  'We Need Your Feedback!': 'Wir brauchen Ihre Meinung',
  'Welcome to your new team productivity platform':
    'Willkommen auf Ihrer neuen Plattform für die Teamarbeit',
  'You must be logged in to submit feedback':
    'Sie müssen angemeldet sein, um eine Rückmeldung zu senden',
  'You must be logged in to upvote':
    'Sie müssen angemeldet sein, um abzustimmen',
  'There are no active announcements for your departments':
    'Für Ihre Abteilungen gibt es keine aktiven Ankündigungen',
  'Skip Tour': 'Einführung überspringen',
  'Your Achievements': 'Ihre Ergebnisse',

  // --- aiuto ---
  'What are AI Insights?': 'Was sind KI-Analysen?',
  'What are the different user roles?': 'Welche Benutzerrollen gibt es?',
  'What can the AI Assistant do?': 'Was kann der KI-Assistent?',
  'Yes! In the analytics view, click the':
    'Ja. Klicken Sie in der Auswertungsansicht auf',
  'Yes! Open the task details dialog and go to the':
    'Ja. Öffnen Sie die Details der Aufgabe und wechseln Sie zu',
  'When enabled, task attachments will be included in notification emails':
    'Wenn aktiv, werden Anhänge von Aufgaben in die Benachrichtigungs-E-Mails eingefügt',
  'Total size of all attachments in a single email cannot exceed this limit':
    'Die Gesamtgröße aller Anhänge einer E-Mail darf diesen Wert nicht überschreiten',
  'Show notifications outside the browser':
    'Benachrichtigungen außerhalb des Browsers anzeigen',
  'Your browser does not support desktop notifications':
    'Ihr Browser unterstützt keine Desktop-Benachrichtigungen',
  'Your data is automatically saved in your browser. Use':
    'Die Daten werden automatisch gespeichert. Nutzen Sie',
  'Your data is automatically saved in your browser. Use backup to preserve data before major changes.':
    'Die Daten werden automatisch gespeichert. Erstellen Sie vor größeren Änderungen eine Sicherung.',
  'This will overwrite all existing data. Make sure to export current data first.':
    'Dieser Vorgang überschreibt alle vorhandenen Daten: Exportieren Sie zuerst die aktuellen Daten.',

  // --- errori di runtime ---
  'This spark has encountered a runtime error':
    'In der Anwendung ist ein Fehler aufgetreten',
  'Something unexpected happened while running the application. The error details are shown below. Contact the spark author and let them know about this issue.':
    'Es ist ein unerwarteter Fehler aufgetreten. Die Details finden Sie unten: Melden Sie sie der für die Anwendung zuständigen Person.',

  // --- parte 5 ---
  'My Permissions': 'Meine Berechtigungen',
  'Avg Completion Time': 'Durchschnittliche Bearbeitungszeit',
  'Avg Tasks/Employee': 'Durchschn. Aufgaben pro Person',
  'Count': 'Anzahl',
  'Low': 'Niedrig',
  'Metric': 'Kennzahl',
  'Total Assigned Tasks': 'Zugewiesene Aufgaben gesamt',
  'Value': 'Wert',
  'Generated': 'Erstellt am',
  'days': 'Tage',
  'Joined': 'Dabei seit',
  'All': 'Alle',
  'tasks': 'Aufgaben',
  'task': 'Aufgabe',
  'more': 'weitere',
  'This user has': 'Diese Person hat',
  'assigned task(s). Those tasks will become unassigned.':
    'zugewiesene Aufgaben, die danach ohne zugewiesene Person bleiben.',
  'This action cannot be undone and any assigned tasks will become unassigned.':
    'Dieser Vorgang kann nicht rückgängig gemacht werden: Zugewiesene Aufgaben bleiben ohne zugewiesene Person.',
  'active': 'aktiv',
  'inactive': 'inaktiv',
  'Feedback Board': 'Rückmeldungen',
  'Announcements': 'Ankündigungen',
  'Skills (comma-separated)': 'Fähigkeiten (durch Komma getrennt)',
  'Task created successfully!': 'Aufgabe erstellt',
  'Task updated successfully!': 'Aufgabe aktualisiert',
  'Task reassigned successfully!': 'Aufgabe neu zugewiesen',
  'Task deleted': 'Aufgabe gelöscht',
  'Task completed!': 'Aufgabe abgeschlossen',
  'Task status distribution across departments':
    'Verteilung der Status über die Abteilungen',
  'Top Clicked Links': 'Am häufigsten angeklickte Links',
  'Visual reference for department color coding and icons used throughout the app':
    'Visuelle Referenz der Farben und Symbole der Abteilungen in der Anwendung',
  'TaskFlow Help & Documentation': 'Hilfe und Dokumentation',
  'TaskFlow is Production Ready!': 'TaskFlow ist produktionsbereit',
  "Get your webhook URL from Slack's Incoming Webhooks app":
    'Die Webhook-URL finden Sie in der Slack-App Incoming Webhooks',
  'TaskFlow Analytics - Team Performance Report':
    'TaskFlow - Bericht zur Leistung des Teams',
  'TaskFlow Analytics - Department Performance Report':
    'TaskFlow - Bericht zur Leistung je Abteilung',
  '{n}% complete': '{n}% erledigt',
  '{n} tasks/user': '{n} Aufgaben pro Person',
  '{n} announcements': '{n} Ankündigungen',
  '{n} unassigned': '{n} ohne Zuweisung',
  'Last modified: {data} by {autore}': 'Zuletzt geändert: {data} von {autore}',
  'Variables': 'Variablen',
  'Note:': 'Hinweis:',
  'Email notifications are sent when enabled in user notification preferences. Variables will be automatically replaced with actual values when emails are sent.': 
    'Benachrichtigungs-E-Mails werden nur versendet, wenn sie in den Benachrichtigungseinstellungen der Person aktiviert sind. Variablen werden beim Versand automatisch durch die tatsächlichen Werte ersetzt.',
  'Mention a teammate': 'Teammitglied erwähnen',
  'Use the arrow keys to choose, Enter to confirm, Esc to close': 'Pfeiltasten zum Auswählen, Enter zum Bestätigen, Esc zum Schließen',
  'Press Cmd+Enter to post. Type @ to mention a teammate': 'Cmd+Enter zum Absenden. @ eingeben, um jemanden zu erwähnen',
  'This attachment was blocked because its format is not allowed': 'Anhang blockiert: Dieses Format ist nicht zulässig',
  'Edit comment': 'Kommentar bearbeiten',
  'Delete comment': 'Kommentar löschen',
  'Post comment': 'Kommentar absenden',
  'Download attachment': 'Anhang herunterladen',
  'Delete attachment': 'Anhang löschen',
  'AI Service': 'KI-Dienst',
  'Available': 'Verfügbar',
  'Unavailable': 'Nicht verfügbar',
  'Checking...': 'Wird geprüft...',
  'Shown in the application header and used in notification emails.': 'Erscheint in der Kopfzeile und in den Benachrichtigungs-E-Mails.',
  'Notifications ({count} unread)': 'Benachrichtigungen ({count} ungelesen)',
  'Delete notification': 'Benachrichtigung löschen',
  'Edit task': 'Aufgabe bearbeiten',
  'Delete task': 'Aufgabe löschen',
  'Select task': 'Aufgabe auswählen',
  'Select {name}': '{name} auswählen',
  'Skip tour': 'Einführung überspringen',
  'tasks shown': 'Aufgaben angezeigt',
  'Show more tasks': 'Weitere Aufgaben anzeigen',
};
