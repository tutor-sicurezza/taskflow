-- 0019_pulizia_dati.sql
--
-- Cio' che serve al lavoro pianificato api/cron/pulizia.ts, e nient'altro:
-- nessuna tabella nuova, nessuna colonna nuova.
--
-- Tre insiemi di dati crescevano senza limite e nessuno li cancellava. Due
-- sono tabelle e si potano con una DELETE per data: perche' quella DELETE non
-- sia una scansione completa servono gli indici qui sotto. Il terzo — il
-- registro di audit — non e' una tabella ma un array JSON dentro app_state, e
-- per quello serve invece una funzione.
--
-- `create index if not exists` e non `concurrently`, come nella 0016: le
-- migrazioni girano in transazione e CONCURRENTLY li' dentro non e' ammesso.


-- 1) Log di consegna email: delete where created_at < <limite>
--
-- L'indice esistente e' (organization_id, created_at desc) — la 0016 — e serve
-- al pannello, che guarda UNA organizzazione alla volta. La pulizia invece
-- attraversa tutte le organizzazioni insieme e filtra solo sulla data: con la
-- colonna dell'organizzazione in testa, quell'indice non e' utilizzabile e
-- Postgres leggerebbe l'intera tabella — cioe' proprio quella che, non essendo
-- mai stata potata, e' la piu' grande del database.
--
-- Non parziale: la condizione (`created_at < X`) cambia a ogni esecuzione,
-- quindi non c'e' un predicato fisso da mettere nel WHERE dell'indice.
create index if not exists email_delivery_logs_created_at_idx
  on public.email_delivery_logs (created_at);


-- 2) Notifiche gia' lette: delete where read and created_at < <limite>
--
-- Indice PARZIALE, con la stessa condizione della query, per la ragione della
-- 0016: le non lette non vengono MAI cancellate, quindi non hanno motivo di
-- stare in questo indice. In piu' il predicato lo fa rimpicciolire da solo —
-- una notifica entra nell'indice quando viene letta ed esce quando viene
-- cancellata — invece di crescere per sempre.
--
-- Perche' Postgres lo scelga, il predicato della query deve implicare quello
-- dell'indice: il filtro `read = true` va lasciato scritto nel client
-- (api/cron/pulizia.ts lo passa con .eq('read', true)).
create index if not exists notifications_lette_created_at_idx
  on public.notifications (created_at)
  where read;


-- 3) Il registro di audit.
--
-- Vive in app_state sotto la chiave 'audit-log' come un unico array JSON, a
-- cui il pannello appende con `[...cur, voce]`: ogni voce riscrive il registro
-- INTERO. A venti voci al giorno per un anno sono migliaia di elementi in un
-- blob da qualche megabyte, riletto e riscritto per intero a ogni azione
-- amministrativa. Il pannello ne mostra dieci.
--
-- La potatura sta qui, in SQL, e non nella funzione edge, per due motivi:
--
--   * portare il blob fino alla funzione e rispedirlo indietro vorrebbe dire
--     fare una volta al giorno esattamente lo spreco che si vuole eliminare;
--   * fra una lettura e una riscrittura separate un amministratore puo'
--     appendere una voce, che verrebbe persa senza che nessuno se ne accorga.
--     Qui lettura e scrittura sono la stessa istruzione.
--
-- QUALE ESTREMO SI TIENE. Le voci si appendono in CODA
-- (`setAuditLog((currentLog) => [...(currentLog || []), entry])` in
-- src/components/SuperAdminSettings.tsx) e il pannello le rilegge con
-- `.slice(-10).reverse()`, cioe' prende le ultime e le mostra dalla piu'
-- nuova. Le recenti stanno quindi in FONDO e si taglia dalla TESTA:
-- `where e.pos > lunghezza - tetto` tiene le ultime `tetto`. Invertire i due
-- estremi non darebbe nessun errore — il pannello mostrerebbe comunque dieci
-- righe, semplicemente le dieci piu' vecchie, e il resto sarebbe perso. La
-- stessa regola e' scritta in modo leggibile e coperta da test in
-- `potaAudit` (api/_lib/pulizia.ts).
--
-- `jsonb_typeof(value) = 'array'` non e' pignoleria: il valore lo scrive il
-- client, e jsonb_array_length su un oggetto solleva un errore che farebbe
-- fallire l'intera esecuzione. Un valore inatteso viene lasciato stare.
create or replace function public.pota_registro_audit(tetto integer)
returns table (org_id uuid, rimosse integer)
language sql
set search_path = public
as $$
  with da_potare as (
    select s.organization_id,
           jsonb_array_length(s.value) as lunghezza
    from public.app_state s
    where s.key = 'audit-log'
      and jsonb_typeof(s.value) = 'array'
      and jsonb_array_length(s.value) > tetto
  ),
  nuove as (
    select d.organization_id,
           (d.lunghezza - tetto) as rimosse,
           coalesce(jsonb_agg(e.voce order by e.pos), '[]'::jsonb) as valore
    from da_potare d
    join public.app_state s
      on s.organization_id = d.organization_id
     and s.key = 'audit-log'
    cross join lateral jsonb_array_elements(s.value) with ordinality as e(voce, pos)
    where e.pos > d.lunghezza - tetto
    group by d.organization_id, d.lunghezza
  )
  update public.app_state s
     set value = n.valore,
         updated_at = now()
    from nuove n
   where s.organization_id = n.organization_id
     and s.key = 'audit-log'
  returning s.organization_id, n.rimosse::integer;
$$;

-- Solo il lavoro pianificato la chiama, e quello parla con il database come
-- service_role. Nessun utente autenticato deve poter accorciare il registro di
-- audit: un registro che chi e' sotto osservazione puo' troncare a piacere non
-- e' un registro. (Il pulsante "Clear Audit Log" del pannello resta, ma passa
-- dalle policy di app_state della 0011, che lo riservano ai manager.)
revoke execute on function public.pota_registro_audit(integer) from public, anon, authenticated;
grant execute on function public.pota_registro_audit(integer) to service_role;
