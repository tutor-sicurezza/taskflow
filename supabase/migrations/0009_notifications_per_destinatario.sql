-- 0009_notifications_per_destinatario.sql
--
-- Le notifiche vivevano in app_state, sotto la chiave 'notifications': un
-- unico blob JSON per organizzazione, leggibile da QUALUNQUE membro tramite
-- PostgREST. Il filtro "solo le mie" esisteva unicamente nell'interfaccia
-- (App.tsx, myNotifications), quindi bastava una GET diretta per leggere le
-- notifiche di tutti i colleghi: chi ha ricevuto quale task, chi e' in
-- ritardo, chi ha commentato cosa.
--
-- La tabella public.notifications esiste dalla 0001, con la policy giusta
-- (`user_id = auth.uid()`), ma non era mai stata usata: mancavano tre cose
-- perche' l'applicazione potesse scriverci. Questa migration le aggiunge.

-- 1) Riferimento al task a livello applicativo.
--    `task_id` e' una FK verso public.tasks, che l'app non usa: i task stanno
--    in app_state e hanno id epoch ('1788948852606'), non uuid. Serve quindi
--    una colonna testuale, altrimenti ogni insert violerebbe la FK.
alter table public.notifications add column if not exists task_ref text;

-- 2) Chiave di deduplica.
--    L'app calcola un id deterministico dell'evento (task + transizione +
--    destinatario) per non ripetere la stessa notifica quando due schede
--    hanno copie diverse dello stato. Con il dedup in memoria quella garanzia
--    valeva per una sola scheda; qui diventa un vincolo del database, valido
--    per tutte insieme.
alter table public.notifications add column if not exists event_key text;

-- Indice NON parziale di proposito: `ON CONFLICT (organization_id, event_key)`
-- non puo' agganciare un indice parziale a meno di ripeterne la clausola
-- WHERE, che PostgREST non sa esprimere. L'upsert falliva con
-- "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification" e nessuna notifica veniva scritta. Un indice unico normale
-- ammette comunque piu' NULL, quindi le righe senza event_key non si
-- ostacolano a vicenda.
create unique index if not exists notifications_org_event_key_idx
  on public.notifications (organization_id, event_key);

-- 3) Chi puo' creare una notifica per un altro utente.
--    Serve un predicato che dica "questo utente appartiene a quell'organizzazione".
--    SECURITY DEFINER e search_path fissato per gli stessi motivi della 0002:
--    valutato dentro una policy su organization_members, un predicato normale
--    rientrerebbe nella tabella e Postgres solleverebbe ricorsione infinita.
create or replace function public.is_org_member_of(target_org_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_org_id
      and om.user_id = target_user_id
  );
$$;

revoke execute on function public.is_org_member_of(uuid, uuid) from public, anon;
grant execute on function public.is_org_member_of(uuid, uuid) to authenticated, service_role;

drop policy if exists "writers can create notifications for members" on public.notifications;

-- Il mittente deve poter scrivere nell'organizzazione (quindi non un viewer) e
-- il destinatario deve appartenervi: non si notificano estranei, e non si
-- scrive nell'organizzazione di qualcun altro.
create policy "writers can create notifications for members"
  on public.notifications
  for insert
  with check (
    public.is_org_writer(organization_id)
    and public.is_org_member_of(organization_id, user_id)
  );

-- 4) Cancellazione delle proprie notifiche: l'interfaccia ha "Clear all" e
--    l'eliminazione singola, che senza questa policy fallivano in silenzio.
drop policy if exists "users can delete their notifications" on public.notifications;

create policy "users can delete their notifications"
  on public.notifications
  for delete
  using (user_id = auth.uid());

-- 5) Travaso dei dati esistenti da app_state alla tabella.
--    Senza questo passaggio, al primo avvio della nuova versione le notifiche
--    gia' ricevute sparirebbero dalla campanella.
insert into public.notifications (
  organization_id, user_id, task_ref, task_title, type, message,
  action_by, action_by_name, action_by_avatar, read, created_at, event_key
)
select
  s.organization_id,
  (n->>'userId')::uuid,
  n->>'taskId',
  n->>'taskTitle',
  n->>'type',
  n->>'message',
  case
    when n->>'actionBy' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (n->>'actionBy')::uuid
    else null
  end,
  n->>'actionByName',
  n->>'actionByAvatar',
  coalesce((n->>'read')::boolean, false),
  coalesce((n->>'createdAt')::timestamptz, now()),
  n->>'id'
from public.app_state s
cross join lateral jsonb_array_elements(s.value) as n
where s.key = 'notifications'
  and jsonb_typeof(s.value) = 'array'
  and n->>'userId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  -- Solo destinatari che esistono ancora: la FK su profiles rifiuterebbe gli altri.
  and exists (select 1 from public.profiles p where p.id = (n->>'userId')::uuid)
on conflict do nothing;

-- La chiave in app_state non viene rimossa qui di proposito: finche' non e'
-- confermato che la nuova lettura funziona, resta come copia di sicurezza.
-- Va cancellata con una migration successiva.

-- 6) Aggiornamenti in tempo reale.
--    Senza queste due righe una scheda aperta resta ferma alla propria
--    fotografia finche' non torna in primo piano. Con la pubblicazione
--    attiva, le modifiche arrivano subito; le RLS continuano ad applicarsi,
--    quindi ciascuno riceve solo cio' che gia' potrebbe leggere.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_state'
  ) then
    alter publication supabase_realtime add table public.app_state;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;
