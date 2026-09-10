# Da dove riprendere

Documento per riaprire il lavoro in una sessione nuova, senza rileggere tutto.
Aggiornato al 10 settembre 2026, dopo l'audit finale.

## Cos'è TaskFlow

Gestionale di attività per assegnare lavoro ai dipendenti. **Generico**, non
legato a un settore: i dati di prova parlano di sicurezza sul lavoro perché
l'organizzazione di collaudo è quella, ma il prodotto non lo è.

React 19 + Vite + TypeScript + Supabase (multi-organizzazione con RLS) +
funzioni serverless su Vercel. Cinque lingue, dove **la chiave di traduzione è
il testo inglese**.

- Sviluppo: `github.com/tutor-sicurezza/employee-task-m-last` (privato)
- Pubblico: `github.com/tutor-sicurezza/taskflow`, allineato con
  `node scripts/sync-public.mjs --commit --push`
- Produzione: `employee-task-m-last.vercel.app`, pubblica da `main`
- Database: progetto Supabase `ibjlfamnoewpixfnowvd` ("task manager")

## Come si lavora qui

**Le migrazioni si applicano così**, perché la cronologia locale e quella remota
non coincidono e `supabase db push` rifiuta:

```
supabase db query --linked -f supabase/migrations/00NN_nome.sql
```

Solo SELECT per le verifiche: `supabase db query --linked "select ..."`.

**Verifica prima di pubblicare.** Type-check e test verdi non bastano: metà dei
difetti seri di questa giornata sono stati trovati guardando lo schermo con un
account reale, o provando l'attacco con curl. Le credenziali di collaudo sono in
`.env.local` (`QA_ADMIN_*`, `QA_MARIO_*`, `QA_LUCIA_*`, `QA_USER_*`).

**Il service worker serve il pacchetto precedente.** Dopo un `npm run build`, la
pagina va ricaricata due volte, o si azzera con
`navigator.serviceWorker.getRegistrations()` + `caches.delete`. Non è un guasto:
è la PWA che fa il suo mestiere.

**Traduzioni.** Non si modificano i dizionari a mano. Le chiavi nuove vanno in un
file JSON `{"English key": ["it", "fr", "de", "es"]}` e si uniscono con lo
script `unisci_chiavi.py` (nella scratchpad di sessione, va ricreato: legge i
`chiavi-*.json`, salta ciò che esiste già e rifiuta le chiavi non usate nel
codice). Controlli utili: `allineamento.py` (le quattro lingue devono avere lo
stesso numero di chiavi) e `doppioni.py`.

**Gli agenti in parallelo funzionano** se ognuno ha file suoi e nessuno tocca
`src/App.tsx`, che va tenuto per sé: è il punto di collisione.

## Stato: fatto e verificato in produzione

Attività con etichette, osservatori, stima e tempo impiegato, scadenza
facoltativa, stato "bloccata", ricorrenze, archiviazione, calendario, carico di
lavoro, esportazione CSV/PDF, filtri salvati (per-utente), riepilogo email
giornaliero, escalation, **approvazione**, **sottoattività**, **dipendenze**,
PWA installabile su computer.

Cinque lavori pianificati su Vercel: promemoria, pulizia, digest (orario),
manutenzione, ricorrenze.

## Aperto, in ordine di gravità

### 1. Un membro può darsi i permessi da solo — GRAVE, pre-esistente
`app_state['employees']` non è fra le chiavi riservate ai responsabili
(migrazione 0011), quindi qualunque membro può riscriverla via PostgREST
mettendosi `customPermissions: { tasks: { edit_any: true } }`. `permissions.ts`
fonde i permessi personalizzati **sopra** quelli del ruolo, e
`useSyncEmployees` risincronizza solo `userRole`, non i permessi.

Con questo, il trigger di approvazione della 0023 si può aggirare diventando
"responsabile". **Va chiuso prima di dare il prodotto a clienti veri.** Due
strade: mettere `employees` fra le chiavi amministrative, oppure smettere di
fidarsi di `customPermissions` letto dal client e leggerlo lato server.

### 2. La creazione di attività non passa dai controlli — GRAVE, pre-esistente
Il client scrive direttamente su Supabase (`useTasks.ts`), non dalla rotta
`api/tasks` che i controlli ce li ha. Conseguenze: un membro può creare
un'attività assegnata a un collega (dovrebbe essere da responsabile in su), può
scrivere `created_by` con l'id di un altro, e `assignee_id` non è vincolato ai
membri dell'organizzazione. Serve un trigger, o far passare la creazione dalla
rotta.

### 3. Due rotte pubblicate e mai usate
`api/notifications/index.ts` e `api/tasks/index.ts` sono deployate ma nessuna
schermata le chiama. Accettano scritture che scavalcano approvazione e
dipendenze. Vanno tolte o messe in uso — non lasciate lì.

### 4. Cron: tetti di lettura e recuperi mancanti
- I promemoria leggono 2000 attività ordinate per scadenza: superata quella
  soglia di scaduti, le nuove scadenze non escono più. Il tetto va messo sui
  candidati esaminati, non sulle email uscite.
- Il riepilogo legge 5000 notifiche **globali**, non per persona: una persona
  molto attiva può far restare tutti gli altri senza riepilogo.
- Il riepilogo non ha recupero: l'ora persa è persa.
- `componiPerDestinatario` fa cinque letture per ogni destinatario, senza cache
  per organizzazione.
- Le preferenze per tipo non valgono dentro il riepilogo.

### 5. Le ore di silenzio non toccano le email
`quietHours` esiste solo nel client, per suono e notifica desktop. Di notte le
email partono lo stesso. E sono valutate sull'ora locale del browser, mentre il
riepilogo usa il fuso salvato: due nozioni di orario nella stessa schermata.

### 6. Prestazioni
- `TaskCard` riceve `tuttiITask`, la cui identità cambia a ogni modifica:
  il memo salta per tutte le schede. Risolvibile passando i bloccanti già
  risolti. Sotto le ~200 attività non si nota.
- `useTasks.applica` scrive una riga alla volta in serie: "seleziona tutto" su
  cento attività sono cento andate e ritorno.
- `useKV` rilegge due volte al rientro sulla scheda (`focus` +
  `visibilitychange`), e `useTasks` rilegge l'intera tabella a ogni alt-tab.
- ~153 kB di componenti da amministratore potrebbero essere caricati a
  richiesta.

### 7. Icone
`@phosphor-icons/react` pesa **360 kB misurati** per 119 icone, perché ognuna
porta sei tratti. Passare a lucide (già presente) ne recupera ~340, ma ridisegna
119 icone in 49 file: **è una scelta estetica, decide il proprietario.**

### 8. Quattro collegamenti rapidi tolti dal cruscotto
Erano cablati a `() => {}`. Per ricollegarli servono dialoghi controllati
(UsersManagement, DepartmentManagement, AnnouncementsDialog, AIAutoAssign).

### 9. Notifiche quando l'applicazione è chiusa
Suoni e notifiche desktop **ci sono già** e funzionano mentre l'applicazione è
aperta (anche installata). Per avvisare a finestra chiusa serve Web Push:
chiavi VAPID, tabella delle sottoscrizioni, invio dal server e gestore `push`
nel service worker. Il service worker ormai c'è, quindi è la strada naturale —
ma le chiavi VAPID le deve generare e configurare il proprietario.

### 10. Da fare a mano nella dashboard Vercel
Controllare i **Cron Jobs**: sono cinque e uno è orario, che richiede il piano
Pro. Aggiungere `CRON_SECRET` e `APP_URL` a `.env.example` (in produzione ci
sono già, manca solo la riga di documentazione).

## Cose che sembrano difetti e non lo sono

- **`api/_lib/manutenzioneTask.ts` duplica `eChiusoDavvero`**: `api/` ha un suo
  tsconfig e non condivide i percorsi con `src/`. Il duplicato è segnalato nei
  commenti di entrambi i lati.
- **`prossimaOccorrenza` fa un passo solo** se non riceve `adesso`: il salto
  delle occorrenze passate è una decisione del lavoro pianificato, non del
  calendario. I test con date fisse dipendono da questo.
- **Il tetto di 50 passi vale solo in scrittura**: troncare in lettura
  perderebbe per sempre i passi di un'importazione più lunga.
- **Il timestamp nel nome dei file esportati resta in forma ISO**: un nome
  ordinato alfabeticamente deve restare ordinato nel tempo.
