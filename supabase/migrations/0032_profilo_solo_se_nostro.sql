-- Il controllo "questa persona e' solo nostra" e la scrittura del suo profilo
-- diventano UNA istruzione sola.
--
-- ## Perche'
--
-- La rotta `POST /api/tenants/:id/members` faceva due viaggi: prima leggeva se
-- la persona appartenesse ad altre organizzazioni, poi — se no — scriveva i
-- campi anagrafici. Fra i due c'e' una finestra, segnalata da Codex sulla
-- PR #15: l'organizzazione A legge e non trova nessuno, B inserisce la propria
-- appartenenza, A scrive lo stesso su un profilo ormai condiviso.
--
-- Qui il `not exists` sta nel `where` dello stesso `update`, quindi non esiste
-- piu' un "fra i due".
--
-- ## Cosa questa funzione NON garantisce, e va detto
--
-- In `read committed` la sotto-interrogazione vede l'istantanea presa all'INIZIO
-- dell'istruzione. Se B conferma il proprio inserimento mentre questo `update`
-- e' gia' partito, questo `update` non lo vede e scrive.
--
-- Cioe' la garanzia e': **si scrive solo se, nel momento in cui la scrittura e'
-- cominciata, quella persona era soltanto nostra.** E' una semantica difendibile
-- e infinitamente piu' stretta di due viaggi separati, ma non e' la
-- serializzazione piena.
--
-- Per quella servirebbe che l'inserimento dell'appartenenza e questa decisione
-- stessero nella STESSA funzione, con un `pg_advisory_xact_lock` sull'id della
-- persona: finche' l'upsert dell'appartenenza lo fa PostgREST per conto della
-- rotta, non c'e' niente su cui i due percorsi possano sincronizzarsi. E' il
-- passo successivo, e va fatto potendo esercitare la rotta via HTTP — non alla
-- cieca, che e' il modo in cui in questa stessa rotta sono gia' nate due falle.

create or replace function public.aggiorna_profilo_se_solo_nostro(
  p_utente uuid,
  p_organizzazione uuid,
  p_campi jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  scritte int;
begin
  -- Ogni colonna si tocca solo se la chiave e' PRESENTE nel json: assente
  -- vuol dire "non ne parlo", ed e' diverso da "mettila a null". La stessa
  -- distinzione che la rotta fa gia' per le deroghe ai permessi.
  update public.profiles p set
    full_name = case when p_campi ? 'full_name'
                     then p_campi ->> 'full_name' else p.full_name end,
    job_title = case when p_campi ? 'job_title'
                     then p_campi ->> 'job_title' else p.job_title end,
    phone = case when p_campi ? 'phone'
                 then p_campi ->> 'phone' else p.phone end,
    location = case when p_campi ? 'location'
                    then p_campi ->> 'location' else p.location end,
    status = case when p_campi ? 'status'
                  then p_campi ->> 'status' else p.status end,
    team_lead = case when p_campi ? 'team_lead'
                     then (p_campi ->> 'team_lead')::boolean else p.team_lead end,
    departments = case when p_campi ? 'departments'
                       then array(select jsonb_array_elements_text(p_campi -> 'departments'))
                       else p.departments end
  where p.id = p_utente
    and not exists (
      select 1
      from public.organization_members m
      where m.user_id = p_utente
        and m.organization_id <> p_organizzazione
    );

  get diagnostics scritte = row_count;

  -- `false` vuol dire "non scritto", e la rotta lo traduce nell'avviso che
  -- l'amministratore legge. Non e' un errore: l'invito e' comunque riuscito.
  return scritte > 0;
end
$funzione$;

-- La chiama solo la rotta, che gira col service role dopo aver verificato che
-- chi chiede e' amministratore di questa organizzazione. Nessun client deve
-- poterla invocare: scavalcherebbe proprio quel controllo.
revoke execute on function public.aggiorna_profilo_se_solo_nostro(uuid, uuid, jsonb)
  from public, anon, authenticated;

-- E il permesso di chi la usa si SCRIVE, invece di darlo per scontato.
--
-- Su questo progetto non serviva: misurato dopo la revoca, i permessi erano
-- gia' `{postgres=X/postgres, service_role=X/postgres}` — Supabase concede
-- `execute` a `service_role` alla creazione, tramite i propri default
-- privileges, quindi togliere a `public` non lo tocca.
--
-- Si scrive lo stesso perche' quella e' una configurazione dell'installazione,
-- non una proprieta' di questa migrazione: chi la applica altrove (un progetto
-- ospitato in proprio, o questo stesso dopo un cambio di default) si
-- ritroverebbe la rotta che fallisce con "permission denied for function"
-- DOPO che l'appartenenza e' gia' stata scritta. Cioe' di nuovo un'operazione
-- riuscita a meta' e dichiarata fallita, che e' il difetto da cui nasce questa
-- intera migrazione.
--
-- Segnalato da Codex sulla PR #15 come P1. La diagnosi era sbagliata su questo
-- database — il permesso c'era — ma la cura era giusta.
grant execute on function public.aggiorna_profilo_se_solo_nostro(uuid, uuid, jsonb)
  to service_role;
