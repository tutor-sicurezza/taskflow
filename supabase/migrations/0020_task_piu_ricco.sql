-- 0020_task_piu_ricco.sql
--
-- Le colonne che servono al gruppo di funzioni nuove. Una migrazione sola e
-- non una per funzione: sono tutte aggiunte alla stessa tabella, e spezzarle
-- significherebbe cinque riscritture di `tasks` invece di una.
--
-- Ogni colonna e' facoltativa e ha un valore predefinito che riproduce il
-- comportamento di oggi: applicare questa migrazione non cambia nulla finche'
-- l'interfaccia non comincia a usarle.

-- ---------------------------------------------------------------------------
-- 1) La scadenza diventa facoltativa.
--
-- Era obbligatoria, e nell'interfaccia il pulsante "Crea" restava disattivato
-- senza data. Ma moltissimi task non hanno una scadenza vera: l'obbligo
-- costringeva a inventarne una, e quella data finta faceva poi scattare
-- promemoria di scadenza e conteggi "in ritardo" su lavori che non erano in
-- ritardo affatto. E' il difetto che degrada piu' dati a valle.
--
-- Il lavoro pianificato dei promemoria filtra gia' `due_date <= ...`, che su
-- NULL e' falso: un task senza scadenza semplicemente non genera promemoria.

alter table public.tasks alter column due_date drop not null;

-- ---------------------------------------------------------------------------
-- 2) Stato "bloccato".
--
-- Tre stati dicono cosa si sta facendo; nessuno dice PERCHE' non si sta
-- facendo, che in un elenco di lavori e' l'informazione piu' utile. Un task
-- fermo in "in corso" da tre settimane e uno bloccato da un fornitore si
-- somigliano soltanto a chi non li segue.
--
-- 'blocked' NON e' uno stato terminale: i promemoria e i conteggi di ritardo
-- continuano a valere, perche' un task bloccato puo' benissimo essere anche in
-- ritardo, ed e' proprio quello che si vuole vedere.

alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check
  check (status in ('not-started', 'in-progress', 'blocked', 'completed'));

-- ---------------------------------------------------------------------------
-- 3) Il reparto sul task.
--
-- Finora "prestazioni per reparto" deduceva il reparto DALL'ASSEGNATARIO: un
-- task non assegnato non contava per nessuno, e riassegnarlo a una persona di
-- un altro reparto ne riscriveva la storia retroattivamente. Il reparto e' una
-- proprieta' del lavoro, non di chi lo esegue.
--
-- E' testo e non una chiave esterna perche' i reparti vivono in `app_state`
-- come elenco di nomi, non come tabella: introdurre qui un vincolo
-- significherebbe migrare anche quelli, che e' un lavoro a se'.

alter table public.tasks add column if not exists department text;

-- ---------------------------------------------------------------------------
-- 4) Etichette libere.
--
-- Priorita' e stato sono scale chiuse e non bastano a organizzare: "urgente"
-- non dice se e' una verifica, una manutenzione o un adempimento.

alter table public.tasks add column if not exists labels text[] not null default '{}';

-- ---------------------------------------------------------------------------
-- 5) Stima e tempo impiegato, in minuti.
--
-- Minuti interi e non un intervallo: si sommano, si mediano e si esportano
-- senza conversioni, ed e' la granularita' con cui le persone dichiarano il
-- proprio tempo. Senza questi due campi, "tempo medio di completamento" non
-- potra' mai misurare davvero il lavoro svolto.

alter table public.tasks add column if not exists estimate_minutes integer
  check (estimate_minutes is null or estimate_minutes >= 0);
alter table public.tasks add column if not exists spent_minutes integer
  check (spent_minutes is null or spent_minutes >= 0);

-- ---------------------------------------------------------------------------
-- 6) Osservatori.
--
-- Un task ha un solo assegnatario, e chi l'ha creato o ci ha commentato non
-- puo' seguirlo: e' la radice di tre buchi noti nelle notifiche — chi commenta
-- non sa delle risposte, chi perde un task non viene avvisato, chi ha creato
-- un lavoro non sa quando viene chiuso.
--
-- Un array di identificativi e non una tabella di legame: si legge e si scrive
-- con la riga del task, che e' esattamente come lo usa chi manda le notifiche,
-- e non serve una join per sapere chi avvisare.

alter table public.tasks add column if not exists watchers uuid[] not null default '{}';

-- ---------------------------------------------------------------------------
-- 7) Ricorrenza.
--
-- Descritta come oggetto e non come colonne separate perche' le regole sono di
-- forme diverse — ogni N giorni, ogni mese lo stesso giorno, il primo lunedi'
-- — e appiattirle in colonne significherebbe una colonna nulla per ogni forma
-- che non si sta usando. Il generatore della prossima occorrenza la interpreta
-- in un punto solo.
--
-- `recurrence_parent` collega le occorrenze alla prima, cosi' si puo' mostrare
-- la serie e fermarla tutta insieme.

alter table public.tasks add column if not exists recurrence jsonb;
alter table public.tasks add column if not exists recurrence_parent uuid
  references public.tasks(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 8) Archiviazione.
--
-- I task completati restano nell'elenco per sempre. Archiviare NON e'
-- cancellare: la riga resta, esce dalle viste correnti e continua a contare
-- nelle analisi storiche. Una data e non un booleano, perche' "quando" serve a
-- capire se l'archiviazione automatica sta facendo il suo lavoro.

alter table public.tasks add column if not exists archived_at timestamptz;

-- ---------------------------------------------------------------------------
-- 9) Approvazione.
--
-- Per i lavori che qualcuno deve controllare prima di considerarli chiusi. Chi
-- ha approvato e quando: senza il nome, un'approvazione non vale niente.

alter table public.tasks add column if not exists requires_approval boolean not null default false;
alter table public.tasks add column if not exists approved_by uuid references public.profiles(id) on delete set null;
alter table public.tasks add column if not exists approved_at timestamptz;

-- ---------------------------------------------------------------------------
-- Indici per le nuove viste.
--
-- L'elenco corrente esclude gli archiviati, quindi il filtro entra in QUASI
-- ogni lettura: l'indice e' parziale e resta piccolo perche' indicizza solo le
-- righe vive. Quello sulla ricorrenza serve al lavoro pianificato che cerca le
-- serie da rinnovare, ed e' parziale per lo stesso motivo.

create index if not exists tasks_org_attivi_idx
  on public.tasks (organization_id, created_at)
  where archived_at is null;

create index if not exists tasks_ricorrenti_idx
  on public.tasks (organization_id)
  where recurrence is not null;
