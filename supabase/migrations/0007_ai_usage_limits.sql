-- 0007_ai_usage_limits.sql
--
-- Perche' esiste questa tabella: l'endpoint api/ai/complete.ts chiama Anthropic
-- con la chiave del titolare del progetto. Il controllo di appartenenza
-- all'organizzazione impedisce agli estranei di consumare token, ma NON
-- impedisce a un membro legittimo di ripetere la stessa chiamata in un ciclo:
-- la spesa e' limitata solo dal plafond della carta di credito. Un rate limit
-- in memoria non serve a nulla su Vercel, dove ogni richiesta puo' atterrare su
-- una lambda diversa e il processo muore fra una chiamata e l'altra: il
-- conteggio deve stare nel database, condiviso da tutte le istanze.
--
-- Ogni riga e' una chiamata riuscita ad Anthropic. L'endpoint conta le righe
-- dell'ultima ora (per utente e per organizzazione) prima di chiamare il
-- modello e risponde 429 quando la soglia e' superata. I token registrati
-- servono per capire a posteriori DOVE va la spesa, non solo quante chiamate
-- sono state fatte.

create table if not exists public.ai_usage (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  model           text not null,
  input_tokens    integer not null default 0,
  output_tokens   integer not null default 0,
  created_at      timestamptz not null default now()
);

-- Gli indici replicano esattamente le due query di rate limit: senza di loro
-- ogni chiamata AI farebbe un sequential scan su una tabella che cresce a ogni
-- richiesta, cioe' il controllo anti-spesa diventerebbe esso stesso il collo di
-- bottiglia.
create index if not exists ai_usage_org_created_at_idx
  on public.ai_usage (organization_id, created_at desc);

create index if not exists ai_usage_user_created_at_idx
  on public.ai_usage (user_id, created_at desc);

alter table public.ai_usage enable row level security;

-- Un utente puo' vedere solo il proprio consumo: le righe degli altri membri
-- non gli servono e rivelerebbero quanto/quando lavorano i colleghi.
drop policy if exists "users can read their own ai usage" on public.ai_usage;

create policy "users can read their own ai usage"
  on public.ai_usage for select
  using (user_id = auth.uid());

-- Nessuna policy di insert/update/delete per 'authenticated': le righe le
-- scrive solo l'endpoint con il client service role, che scavalca le RLS. Se
-- il client potesse inserire potrebbe anche NON inserire — cioe' consumare
-- token senza lasciare traccia nel contatore.
