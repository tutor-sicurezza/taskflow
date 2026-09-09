# TaskFlow

Applicazione web per assegnare, tracciare e completare attività all'interno di
un'organizzazione: utenti, ruoli, dipartimenti, notifiche in tempo reale e
invio email.

Multi-tenant, con isolamento imposto dal database (Row Level Security) e non
dall'interfaccia.

---

## Cosa fa

- **Attività**: creazione, assegnazione, stati, priorità, scadenze, commenti,
  allegati e cronologia delle modifiche.
- **Persone e ruoli**: `owner`, `admin`, `manager`, `member`, `viewer`. Gli
  account li crea un amministratore: non esiste registrazione pubblica.
- **Dipartimenti** con analisi per reparto e per persona.
- **Notifiche** per destinatario, recapitate in tempo reale, con preferenze
  personali (tipi abilitati, orari di silenzio, suono).
- **Email** di assegnazione tramite Resend o SendGrid, inviate solo lato
  server.
- **Backup e ripristino** dei dati dell'organizzazione.
- **Funzioni AI facoltative** (assistente, auto-assegnazione, stime, insight):
  senza chiave API restano semplicemente nascoste.

## Come sta in piedi

- **Frontend**: React 19 + TypeScript, build con Vite, interfaccia Radix/shadcn
  e Tailwind CSS 4.
- **Autenticazione e dati**: Supabase (Postgres + Auth). Ogni tabella
  applicativa ha RLS attiva.
- **Funzioni server**: cartella `api/`, eseguita da Vercel. È l'unico posto in
  cui vivono le chiavi segrete.
- **Migrazioni**: `supabase/migrations/`, numerate e da applicare in ordine.

### Dove sta l'autorizzazione

Nel database, non nei componenti. I controlli di permesso nell'interfaccia
servono a non mostrare comandi inutili; a rifiutare le operazioni sono le
policy RLS e le rotte in `api/`, che girano con privilegi elevati e ricontrollano
il ruolo di chi chiama.

In pratica:

- le attività sono righe di `public.tasks`, con policy per riga: crea chi può
  scrivere, modifica l'autore o l'assegnatario o un manager, elimina l'autore o
  un manager;
- le notifiche sono righe di `public.notifications`, leggibili solo dal
  destinatario;
- lo stato applicativo restante (`app_state`) distingue le chiavi di
  configurazione, riservate a manager e amministratori, da quelle di lavoro
  quotidiano.

## Installazione

Guida completa in **[INSTALL.md](INSTALL.md)**, comprese le due trappole di
configurazione che costano più tempo. In sintesi:

```bash
npm install
cp .env.example .env.local          # e compilalo
supabase link --project-ref <ref>
supabase db push                    # applica TUTTE le migrazioni, in ordine
vercel dev                          # frontend + funzioni api/
```

## Test

```bash
npm run test        # unità (Vitest)
npm run typecheck
npm run lint
npm run build
```

La suite copre la matrice dei permessi per ruolo, la sanificazione dei
contenuti che finiscono nel DOM, l'unicità degli identificatori e la
resistenza delle impostazioni a dati malformati. Sono tutte aree in cui sono
stati trovati difetti reali: i test descrivono il comportamento corretto perché
non tornino.

Esiste inoltre un controllo di integrazione contro un progetto Supabase vero:

```bash
node scripts/smoke-auth.mjs
```

Verifica che la registrazione pubblica sia chiusa, che la creazione di account
da parte di un amministratore funzioni e che gli account esistenti risolvano la
propria organizzazione. Va rieseguito dopo ogni modifica alla configurazione di
autenticazione: un errore lì blocca l'accesso a tutti.

**Cosa la suite non copre**: non ci sono test end-to-end né test dei componenti
React. La copertura è sulla logica pura e sui punti critici, non
sull'applicazione intera.

## Contribuire

Segnalazioni e pull request sono benvenute. Prima di aprire una PR:
`npm run test && npm run typecheck && npm run lint && npm run build`.

Se la modifica tocca permessi, policy RLS o autenticazione, spiega nella
descrizione **quale operazione diventa possibile e per chi**: è la parte che
richiede più attenzione in revisione.

## Licenza

[MIT](LICENSE).
