-- 0014_promemoria_email.sql
--
-- Memoria degli avvisi di scadenza gia' spediti.
--
-- I promemoria (`task_due_soon`, `task_overdue`) li manda un lavoro pianificato
-- che si sveglia a orario e guarda le date, non un'azione di una persona. Senza
-- una traccia di cosa e' gia' partito, ogni esecuzione ritroverebbe gli stessi
-- task nella stessa condizione e rispedirebbe le stesse email: un task scaduto
-- e mai chiuso genererebbe un messaggio al giorno, all'infinito. Non basta
-- guardare email_delivery_logs, che registra il recapito ma non a QUALE task e
-- a quale tipo di promemoria si riferisce.
--
-- L'unicita' su (task_id, tipo) e' la regola vera, non un indice di comodo: e'
-- il database a garantire che due esecuzioni sovrapposte non riescano
-- entrambe a segnare lo stesso invio.
--
-- Nota deliberata: la chiave NON contiene la scadenza. Se `due_date` viene
-- spostata in avanti, il promemoria "in scadenza" non riparte. E' accettabile:
-- includere la data significherebbe una riga per ogni ritocco di una data, e
-- quindi un'email in piu' ogni volta che qualcuno corregge una scadenza —
-- esattamente il doppione che questa tabella esiste per evitare.

create table if not exists public.email_promemoria_inviati (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  tipo        text not null check (tipo in ('task_due_soon', 'task_overdue')),
  inviato_il  timestamptz not null default now(),
  constraint email_promemoria_inviati_task_tipo_key unique (task_id, tipo)
);

-- Il vincolo unique crea gia' l'indice su (task_id, tipo), che e' anche
-- l'unico accesso che fa il lavoro pianificato: legge le righe dei task
-- candidati con un `in (...)` sugli id. Nessun altro indice serve.

alter table public.email_promemoria_inviati enable row level security;

-- Nessuna policy, di proposito: questa tabella la scrive e la legge solo
-- api/cron/promemoria.ts con il client service role, che scavalca le RLS. Con
-- RLS attiva e zero policy, per 'anon' e 'authenticated' la tabella e' vuota e
-- non scrivibile. E' importante che il client non possa toccarla: poter
-- cancellare una riga qui significherebbe poter far rispedire un'email, e
-- poterne inserire una significherebbe poter zittire il promemoria di un
-- collega.
