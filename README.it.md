<div align="center">

# TaskFlow

**Gestione delle attività di squadra dove i permessi sono veri.**

Utenti, ruoli, dipartimenti, approvazioni, notifiche in tempo reale ed email.
Multi-tenant, con l'isolamento imposto dal database (Row Level Security) e non
dall'interfaccia.

[![React 19](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Test](https://img.shields.io/badge/test-717%20verdi-brightgreen)](#test)
[![MCP](https://img.shields.io/badge/MCP-connettore%20incluso-D97757)](#consegnare-unattività-a-claude)
[![Licenza: MIT](https://img.shields.io/badge/Licenza-MIT-blue.svg)](LICENSE)

[English](README.md) · [Guida all'installazione](INSTALL.md) · [Note di prodotto](PRD.md)

<img src="docs/immagini/dashboard.png" alt="La dashboard di TaskFlow: contatori, andamento per reparto e classifica" width="900">

</div>

---

## Cosa lo distingue

Quasi tutti i gestionali nascondono i pulsanti che non puoi premere. Questo lo
fa, e poi **rifiuta l'operazione anche nel database**: nascondere il pulsante
è una cortesia, non il modo in cui il prodotto si difende.

| | |
| --- | --- |
| **L'autorizzazione sta in Postgres** | Ogni tabella applicativa ha RLS attiva. Un'attività è una riga di `public.tasks` con policy per riga; una notifica è leggibile solo dal destinatario. Disattivare il controllo nell'interfaccia non cambia niente. |
| **Regole che valgono ovunque** | Un'attività bloccata da un'altra non si chiude: né dall'interfaccia, né dalla riga di comando, né da un assistente. La regola è un trigger del database, quindi non c'è strada che la aggiri. |
| **I segreti stanno solo sul server** | La service role key e le chiavi di posta e AI vivono solo in `api/`. Il bundle del browser non le vede mai. |
| **Approvazioni che contano** | "Completata" e "completata e vistata" sono stati diversi, e ogni conteggio del prodotto lo sa. |
| **Nessun interruttore scollegato** | Il pannello ne offriva quarantadue; uno solo veniva davvero letto. Gli altri quarantuno sono stati tolti invece che lasciati lì a fingere — compresi "abilita 2FA" e "whitelist di IP", che su una funzione di sicurezza è una bugia che non vuoi. |

## Schermate

<table>
<tr>
<td width="50%"><img src="docs/immagini/attivita.png" alt="Elenco attività con filtri e schede per persona"><br><sub><b>Attività</b> — filtri, viste salvate, schede per persona, azioni in blocco, esportazione.</sub></td>
<td width="50%"><img src="docs/immagini/dettaglio.png" alt="Dettaglio di un'attività con passi, commenti e cronologia"><br><sub><b>Dettaglio</b> — passi, commenti con @menzioni, allegati, cronologia completa.</sub></td>
</tr>
<tr>
<td><img src="docs/immagini/analytics.png" alt="Analisi con tasso di completamento e distribuzioni"><br><sub><b>Analisi</b> — completamento, distribuzione per stato e priorità, andamenti.</sub></td>
<td><img src="docs/immagini/carico.png" alt="Vista del carico di lavoro per persona"><br><sub><b>Carico</b> — chi sta portando cosa, prima di assegnare la prossima.</sub></td>
</tr>
</table>

<sub>È l'interfaccia vera, fotografata da uno script di questo repository, con
un'organizzazione inventata. Vedi <a href="#come-si-fanno-le-schermate">Come si
fanno le schermate</a>.</sub>

## Consegnare un'attività a Claude

<img src="docs/immagini/claude.png" alt="La finestra «Lavoraci con Claude», con il testo pronto" width="820">

**1. Il connettore MCP** — la strada buona.

```bash
node scripts/mcp/taskflow.mjs --installa    # poi riavvia Claude Desktop
```

Con più di un'organizzazione, aggiungi `--org <identificativo o nome>`: Claude
Desktop lo lancia un'icona, non un terminale, quindi la scelta va scritta nella
configurazione invece che esportata in una shell.

Quattro strumenti: elenca le tue attività, leggine una, cambia uno stato,
aggiungi una nota.

Scrivono la cronologia e mandano le notifiche **in app** — a chi segue
l'attività, a chi ce l'ha in carico, a chi l'aveva chiesta. **Non** mandano le
email e non riconoscono le menzioni con `@Nome`: quelle restano
all'interfaccia, e le descrizioni degli strumenti lo dicono invece di
lasciarlo scoprire.

Gira **con i permessi tuoi, non del server**: riusa la sessione della riga di
comando e parla a PostgREST con il tuo token, mai con una chiave di servizio.
Ne segue la cosa che conta: un modello lì dentro non può fare niente che tu non
potresti fare dal browser — stesse policy, stessi trigger, compreso quello che
rifiuta di chiudere un'attività bloccata.

**2. Il bottone** — per chi usa Claude nel browser.

Prepara la consegna; non può avviare un programma sul tuo computer, e lo dice a
schermo invece di lasciartelo scoprire. I commenti restano fuori dal testo di
proposito: contengono nomi di colleghi, e quel testo nasce per essere incollato
altrove.

E c'è la riga di comando:

```bash
node scripts/taskflow.mjs accedi     # una volta sola
node scripts/taskflow.mjs elenco
node scripts/taskflow.mjs stato 3f2a9c10 completata "cosa ho fatto"
```

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
                                    # (solo su un progetto nuovo: vedi INSTALL.md)
vercel dev                          # frontend + funzioni api/
```

## Test

```bash
npm run test        # unità (Vitest)
npm run typecheck
npm run lint
npm run build
```

717 test in 45 file. Coprono la matrice dei permessi per ruolo e le deroghe,
la sanificazione dei contenuti che finiscono nel DOM, l'unicità degli
identificatori, la resistenza delle impostazioni a dati malformati, le
traduzioni, le ricorrenze, il riepilogo email, l'escalation, le sottoattività,
le dipendenze fra attività, le etichette, le menzioni, l'esportazione, le
approvazioni, i promemoria, la creazione di un task lato server, quali colonne
entrano nell'UPDATE di una modifica e il nucleo condiviso fra la riga di
comando e il connettore MCP. Sono tutte aree in cui sono stati trovati
difetti reali: i test descrivono il comportamento corretto perché non tornino.

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

## Come si fanno le schermate

```bash
npm run immagini
```

Costruisce l'applicazione e la guida in un browser vero con un'organizzazione
inventata — persone finte, attività finte — sostituendo soltanto la rete. Le
risposte hanno la forma di PostgREST, quindi passano per gli stessi mapper che
leggono il database vero.

Due ragioni per farlo così. Le schermate di un'installazione reale
pubblicherebbero le giornate di persone vere: chi è in ritardo, chi ha
commentato cosa. E un mockup mostrerebbe un'interfaccia che non esiste: qui, se
un mapper si rompe, le immagini si rompono con lui. Alla prima esecuzione ha
trovato un difetto vero — l'interfaccia era tradotta in cinque lingue e il testo
che produceva per Claude no.

## Contribuire

Segnalazioni e pull request sono benvenute. Prima di aprire una PR:
`npm run test && npm run typecheck && npm run lint && npm run build`.

Se la modifica tocca permessi, policy RLS o autenticazione, spiega nella
descrizione **quale operazione diventa possibile e per chi**: è la parte che
richiede più attenzione in revisione.

## Licenza

[MIT](LICENSE).
