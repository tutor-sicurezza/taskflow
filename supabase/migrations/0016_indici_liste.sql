-- 0016_indici_liste.sql
--
-- Indici per le quattro letture di lista che l'applicazione fa davvero.
--
-- Fino a qui le tabelle avevano solo indici su una colonna sola
-- (idx_tasks_organization_id, idx_notifications_user_id,
-- idx_email_logs_organization_id, tutti dalla 0001). Servono a filtrare, non a
-- ordinare: Postgres trova le righe dell'organizzazione e poi le ORDINA a
-- parte, in memoria o su disco. Con `order by ... limit`, che e' esattamente il
-- caso di tre di queste quattro query, quel riordino costa quanto leggere
-- tutto: il limite non limita nulla, perche' per sapere quali sono le 200 piu'
-- recenti bisogna prima averle viste tutte. Mettendo la colonna di ordinamento
-- nell'indice, e nella direzione giusta, il limite torna a fare il suo mestiere
-- e la lettura si ferma dopo le righe che servono.
--
-- `create index if not exists` e non `concurrently`: le migrazioni girano in
-- transazione, e CONCURRENTLY in transazione non e' ammesso. Le tabelle sono
-- piccole e il blocco in scrittura dura un istante.

-- L'elenco dei task di useTasks:
--   where organization_id = ? order by created_at
-- Con il solo idx_tasks_organization_id l'ordinamento e' un sort a parte su
-- tutti i task dell'organizzazione, a ogni lettura e su ogni scheda aperta.
create index if not exists tasks_org_created_at_idx
  on public.tasks (organization_id, created_at);

-- Il lavoro notturno dei promemoria (api/cron/promemoria.ts):
--   where status <> 'completed' and assignee_id is not null
--     and due_date <= ? order by due_date
-- Nessun indice esistente copre `status` o `due_date`, quindi oggi e' una
-- scansione completa della tabella, su TUTTE le organizzazioni insieme.
--
-- L'indice e' PARZIALE, con la stessa condizione della query nel `where`: i
-- task completati sono la maggioranza e crescono per sempre, mentre quelli
-- ancora aperti e assegnati sono pochi. L'indice contiene solo questi ultimi,
-- quindi resta piccolo e — cosa che conta di piu' — si RIMPICCIOLISCE quando un
-- task viene chiuso, invece di gonfiarsi all'infinito.
--
-- Perche' Postgres lo usi, il predicato della query deve implicare quello
-- dell'indice: `status <> 'completed'` e `assignee_id is not null` vanno
-- lasciati scritti cosi' come sono nel client.
create index if not exists tasks_promemoria_due_date_idx
  on public.tasks (due_date)
  where status <> 'completed' and assignee_id is not null;

-- Le notifiche di useNotifications:
--   where user_id = ? order by created_at desc limit 200
-- `desc` nell'indice non e' un dettaglio estetico: e' cio' che permette di
-- leggere le prime 200 e fermarsi, senza scorrere all'indietro l'intero
-- storico dell'utente.
create index if not exists notifications_user_created_at_idx
  on public.notifications (user_id, created_at desc);

-- Il registro degli invii email (EmailDeliveryAnalytics):
--   where organization_id = ? order by created_at desc limit 500
-- Questa tabella e' quella destinata a crescere di piu' — una riga per ogni
-- email spedita, per sempre — ed e' anche l'unica che nessuno cancella mai.
create index if not exists email_delivery_logs_org_created_at_idx
  on public.email_delivery_logs (organization_id, created_at desc);
