# Installazione

Guida per mettere in piedi una propria istanza di TaskFlow. Richiede un
progetto Supabase, un account Vercel e (facoltativi) Resend per le email e
Anthropic per le funzioni AI.

I passaggi sono in ordine: saltarne uno lascia l'applicazione in uno stato che
sembra funzionante ma non lo e'. Dove un errore e' facile da commettere, e'
segnalato esplicitamente.

---

## 1. Dipendenze

```bash
npm install
```

Node.js 20 o superiore.

## 2. Progetto Supabase

Crea un progetto su [supabase.com](https://supabase.com). Ti servono, da
**Project Settings → API**:

- l'URL del progetto,
- la *publishable* (anon) key,
- la *service role* key — **segreta**: scavalca tutte le policy RLS.

## 3. Variabili d'ambiente

```bash
cp .env.example .env.local
```

Compila `.env.local` seguendo i commenti del file. `.env.local` e' in
`.gitignore` e non deve mai essere committato.

> La service role key non deve **mai** avere il prefisso `VITE_`: tutto cio' che
> inizia con `VITE_` finisce nel bundle JavaScript, quindi nel browser di
> chiunque apra l'applicazione.

## 4. Migrazioni del database

Vanno applicate **tutte, in ordine numerico crescente**. Contengono lo schema,
le policy RLS e i travasi di dati fra una versione e l'altra: saltarne una, o
invertirne l'ordine, lascia le policy in uno stato incoerente.

```bash
supabase link --project-ref <project-ref>
supabase db push
```

In alternativa, incolla il contenuto di ogni file di `supabase/migrations/`
nell'SQL editor di Supabase, rispettando l'ordine.

## 5. Configurazione dell'autenticazione

```bash
cp supabase/config.example.toml supabase/config.toml
# sostituisci i segnaposto, poi:
SUPABASE_AUTH_SMTP_PASS=<chiave Resend> supabase config push
```

Cosa fa questo passaggio, e perche' conta:

- **chiude la registrazione pubblica** (`enable_signup = false` nella sezione
  `[auth]`). Gli account li crea solo un amministratore dall'applicazione. Se
  la lasci aperta, chiunque conosca la chiave anon — che sta nel bundle, quindi
  chiunque — puo' creare un account sul tuo progetto;
- imposta `site_url` sul tuo dominio: e' la base dei link nelle email di
  recupero password. Con il valore predefinito della CLI punterebbero a
  `localhost`, cioe' a nulla per chi li riceve;
- configura un server SMTP tuo. Senza, Supabase usa il mailer condiviso, che e'
  fortemente limitato: le email di recupero arrivano a singhiozzo o non
  arrivano affatto.

> **Trappola da conoscere.** Nel file, `enable_signup = false` sotto
> `[auth.email]` **non** limita le registrazioni: disattiva l'email come metodo
> di accesso, e il risultato e' `Email logins are disabled` per tutti, login
> compreso. L'interruttore giusto e' quello nella sezione `[auth]`. Il file di
> esempio e' gia' corretto e commentato.

Se preferisci non usare la CLI, le stesse impostazioni si trovano nel dashboard
Supabase sotto **Authentication → Sign In / Providers** e **SMTP Settings**.

## 6. Primo accesso

La registrazione pubblica e' chiusa, quindi il primo account lo crei a mano:

1. Supabase → **Authentication → Users → Add user**, con email e password, e
   spunta la conferma dell'indirizzo.
2. Avvia l'applicazione e accedi con quell'account.
3. Non appartenendo ad alcuna organizzazione, ti verra' chiesto di **crearne
   una**: ne diventi il proprietario.
4. Da **Manage Users** crei gli altri account. A ciascuno viene assegnata una
   password provvisoria, mostrata a schermo una sola volta: consegnala tu, non
   viene inviata per email.

> La creazione dell'organizzazione dal browser e' concessa solo se l'istanza e'
> ancora vuota, oppure a chi e' gia' amministratore. Chi viene rimosso da
> un'organizzazione non puo' rientrare creandosene una propria.

## 7. Avvio

```bash
npm run dev     # solo frontend: le rotte in api/ NON rispondono
vercel dev      # frontend + funzioni api/ (creazione utenti, ruoli, email, AI)
```

Le funzioni in `api/` girano sul runtime Vercel. Con `npm run dev` l'interfaccia
si apre lo stesso, ma creazione utenti, gestione ruoli, invio email e AI
rispondono a vuoto: usa `vercel dev` per provarle.

## 8. Deploy

```bash
vercel deploy --prod
```

Le stesse variabili di `.env.local` vanno impostate sul progetto Vercel
(`vercel env add`), per **ognuno** degli ambienti che usi: Production, Preview e
Development sono separati, e una variabile presente solo in Production non
esiste in `vercel dev`.

---

## Funzioni AI (facoltative)

Senza `ANTHROPIC_API_KEY` le funzioni AI restano nascoste e il resto
dell'applicazione funziona normalmente: non e' un guasto, e' l'assenza di una
configurazione.

Se la chiave e' a livello di **organizzazione** e non legata a un **workspace**,
Anthropic rifiuta ogni richiesta con
`This API key is not scoped to a workspace`. In quel caso imposta anche
`ANTHROPIC_WORKSPACE_ID`, oppure usa una chiave gia' associata a un workspace.
Lo stato reale del servizio, con il motivo dell'eventuale indisponibilita', e'
visibile agli amministratori in **System Settings → AI**.

## Verifica

```bash
npm run typecheck
npm run lint
npm run build
node scripts/smoke-auth.mjs
```

`smoke-auth.mjs` controlla contro il progetto reale che la registrazione
pubblica sia chiusa, che la creazione da amministratore funzioni ancora e che
gli account esistenti risolvano la loro organizzazione. E' il controllo da
rifare dopo ogni modifica alla configurazione di autenticazione: una modifica
sbagliata li' blocca l'accesso a tutti, ed e' meglio scoprirlo in un secondo
che da una segnalazione.

## Cosa NON e' incluso

- **Test automatici.** Non esiste una suite: `scripts/smoke-auth.mjs` copre
  l'autenticazione e nient'altro.
- **Tracciamento aperture e clic delle email.** Il pannello di analisi mostra
  gli esiti di consegna reali; aperture e clic non sono misurati e i relativi
  valori restano a zero, dichiarati come non disponibili.
