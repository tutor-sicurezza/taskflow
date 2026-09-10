-- 0021_ricorrenze_ed_escalation.sql
--
-- Due vincoli chiesti dai lavori pianificati nuovi. Entrambi servono a
-- garantire nel DATABASE cio' che il codice da solo non puo' garantire: che
-- due esecuzioni sovrapposte non producano un doppione.

-- ---------------------------------------------------------------------------
-- 1) Una sola occorrenza per serie e per scadenza.
--
-- Il rinnovo dei task ricorrenti calcola la data della prossima occorrenza
-- dalla SCADENZA di quella appena chiusa, non da "adesso": ricalcolarla due
-- volte da' sempre lo stesso risultato, quindi il secondo inserimento va in
-- conflitto invece di creare un secondo task identico.
--
-- Il controllo esiste anche nel codice — due query che escludono le serie con
-- un'occorrenza ancora aperta — ma un controllo nel codice non regge a due
-- esecuzioni contemporanee: fra il "guarda se c'e'" e il "crea" c'e' sempre
-- una finestra. Questo indice quella finestra la chiude.
--
-- Parziale, perche' i task che non appartengono a una serie hanno
-- `recurrence_parent` nullo e non devono entrare nell'indice.

create unique index if not exists tasks_ricorrenza_occorrenza_unica
  on public.tasks (recurrence_parent, due_date)
  where recurrence_parent is not null;

-- ---------------------------------------------------------------------------
-- 2) L'escalation riusa la memoria dei promemoria gia' spediti.
--
-- `email_promemoria_inviati` ha gia' il vincolo di unicita' su (task_id, tipo),
-- che e' esattamente la garanzia "una escalation sola per task". Mancava solo
-- che il CHECK ammettesse il terzo valore: senza, l'inserimento fallisce e —
-- per come e' scritto il lavoro pianificato, che segna PRIMA di spedire — non
-- parte nessuna email invece di partirne una al giorno.
--
-- Segnare prima di spedire e' l'opposto di cio' che fanno i promemoria, ed e'
-- deliberato: li' il costo di una ripetizione e' un'email in piu' a una
-- persona, qui e' un'email a ogni responsabile dell'organizzazione, ogni
-- giorno, finche' il task resta aperto.

alter table public.email_promemoria_inviati
  drop constraint if exists email_promemoria_inviati_tipo_check;

alter table public.email_promemoria_inviati
  add constraint email_promemoria_inviati_tipo_check
  check (tipo in ('task_due_soon', 'task_overdue', 'escalation'));
