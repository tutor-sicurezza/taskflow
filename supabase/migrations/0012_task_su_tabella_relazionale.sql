-- 0012_task_su_tabella_relazionale.sql
--
-- I task erano un unico blob JSON in app_state. La policy di quella tabella
-- ragiona per RIGA, e la riga e' l'intero elenco: chiunque possa scrivere
-- (quindi ogni 'member') poteva sostituirlo per intero. Verificato con un
-- account reale: una singola chiamata a PostgREST azzerava tutti i task
-- dell'organizzazione. Nessuna policy sul blob puo' impedirlo, perche' a quel
-- livello "modificare il proprio task" e "cancellarli tutti" sono la stessa
-- operazione: sostituire un valore.
--
-- public.tasks esiste dalla 0001 e non e' mai stata usata. Ha gia' le policy
-- giuste, per riga:
--   0008  create : chi puo' scrivere nell'organizzazione (non i viewer)
--   0008  update : autore, assegnatario o manager/admin
--   0008  delete : autore o manager/admin
-- Spostare i dati li' dentro rende quelle regole finalmente operative.
--
-- Gli id cambiano: nel blob erano stringhe epoch ('1788948852606'), qui sono
-- uuid. La corrispondenza viene mantenuta e usata per aggiornare anche
-- notifications.task_ref, altrimenti le notifiche gia' recapitate punterebbero
-- a task inesistenti e il clic non aprirebbe piu' nulla.

create extension if not exists "pgcrypto";

with estratti as (
  select
    s.organization_id,
    t as task,
    gen_random_uuid() as nuovo_id
  from public.app_state s
  cross join lateral jsonb_array_elements(s.value) as t
  where s.key = 'tasks'
    and jsonb_typeof(s.value) = 'array'
),
mappa as (
  select
    organization_id,
    task,
    nuovo_id,
    task->>'id' as vecchio_id,
    -- L'autore non e' un campo del task: si ricava dall'attivita' 'created',
    -- registrata alla creazione. E' il valore su cui si regge la policy di
    -- update ("l'autore puo' modificare"), quindi va popolato ora: dopo, quel
    -- dato non esiste piu' da nessuna parte.
    (
      select a->>'userId'
      from jsonb_array_elements(coalesce(task->'activities', '[]'::jsonb)) a
      where a->>'type' = 'created'
      limit 1
    ) as autore
  from estratti
),
inseriti as (
  insert into public.tasks (
    id, organization_id, title, description, assignee_id, priority, status,
    due_date, created_by, created_at, updated_at, comments, activities, attachments
  )
  select
    m.nuovo_id,
    m.organization_id,
    coalesce(nullif(m.task->>'title', ''), 'Senza titolo'),
    coalesce(m.task->>'description', ''),
    -- Solo assegnatari che esistono davvero: i dati piu' vecchi contengono id
    -- inventati da "Add User", che non corrispondono ad alcun account e che la
    -- chiave esterna rifiuterebbe.
    (select p.id from public.profiles p where p.id::text = m.task->>'assigneeId'),
    case when m.task->>'priority' in ('low','medium','high') then m.task->>'priority' else 'medium' end,
    case when m.task->>'status' in ('not-started','in-progress','completed') then m.task->>'status' else 'not-started' end,
    coalesce((m.task->>'dueDate')::timestamptz, now()),
    (select p.id from public.profiles p where p.id::text = m.autore),
    coalesce((m.task->>'createdAt')::timestamptz, now()),
    now(),
    coalesce(m.task->'comments', '[]'::jsonb),
    coalesce(m.task->'activities', '[]'::jsonb),
    coalesce(m.task->'attachments', '[]'::jsonb)
  from mappa m
  returning id
)
-- Le notifiche puntano ai task con l'id applicativo: va riscritto, altrimenti
-- restano appese al vecchio identificativo.
update public.notifications n
set task_ref = m.nuovo_id::text
from mappa m
where n.organization_id = m.organization_id
  and n.task_ref = m.vecchio_id;

-- Aggiornamenti in tempo reale anche per i task, come gia' per app_state e
-- notifications (0009): senza, una scheda aperta resterebbe indietro.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;
end
$$;

-- La chiave 'tasks' in app_state NON viene rimossa qui: resta come copia di
-- sicurezza finche' non e' confermato che la lettura dalla tabella funziona.
-- La rimuove la 0013.
