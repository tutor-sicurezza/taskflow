-- 0025_stato_regole_lato_server.sql
--
-- Due regole del cambio di stato vivevano solo nel client.
--
-- Cambiare stato a un'attivita' non e' scrivere una colonna: nell'interfaccia
-- (`handleStatusChange` in src/App.tsx) succedono quattro cose, e due sono
-- regole vere, non cortesie.
--
--   1. non si porta a "completata" un'attivita' che ne aspetta altre
--      (`puoCompletare` / `bloccantiAperti` in src/lib/dipendenze.ts);
--   2. il cambio di stato azzera il visto precedente sulle attivita' che
--      l'approvazione la richiedono (`campiCambioStato` in
--      src/lib/approvazione.ts), altrimenti un lavoro approvato, riaperto e
--      richiuso resta approvato dalla volta prima e nessuno va piu' a
--      guardarlo.
--
-- Entrambe stavano in codice che gira sul computer di chi le deve rispettare.
-- Finche' l'unica strada era l'interfaccia il buco non si vedeva; basta pero'
-- una PATCH a PostgREST — e ora anche una riga di comando — per scrivere
-- `status = 'completed'` e saltarle tutte e due. E' la stessa forma delle
-- falle chiuse dalla 0023 e dalla 0024: un controllo che chi scrive puo'
-- saltare non e' un controllo.
--
-- Qui le regole scendono nel database, dove valgono per l'interfaccia, per la
-- riga di comando e per chiunque chiami direttamente.
--
-- NON sono autorizzazioni, sono invarianti sui dati: per questo, a differenza
-- dei trigger della 0018 e della 0023, valgono ANCHE per il service role.
-- Verificato che nessun lavoro pianificato scrive `status` (i cron toccano
-- solo `archived_at`), quindi non c'e' niente che questo possa rompere.
--
-- Conseguenza da sapere, come per la 0024: il ripristino di un backup che
-- rimettesse un'attivita' completata mentre cio' che la blocca risulta ancora
-- aperto viene rifiutato. E' voluto — quei due fatti insieme non possono
-- essere veri — ma va saputo.

create or replace function public.task_regole_stato()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bloccanti text;
begin
  -- -------------------------------------------------------------------------
  -- 1) Non si completa un'attivita' che ne aspetta altre.
  --
  -- Solo sul PASSAGGIO a "completata": un'attivita' gia' chiusa che viene
  -- modificata per altri motivi non deve essere ricontrollata, altrimenti un
  -- bloccante riaperto renderebbe impossibile perfino cambiarle il titolo.
  --
  -- "Aperto" e' la stessa definizione del client (`eChiusoDavvero`): chiuso
  -- significa completato E, se il visto lo richiede, vistato. Un lavoro che
  -- aspetta un'approvazione e' ancora lavoro aperto, e quindi blocca.
  --
  -- Un id che non corrisponde a nessuna attivita' NON blocca: e' la stessa
  -- scelta di `riferimentiValidi`, perche' un riferimento rotto lascerebbe
  -- l'attivita' ferma per sempre dietro qualcosa che non si puo' chiudere.
  if new.status = 'completed' and old.status is distinct from 'completed' then
    select string_agg(b.title, ', ' order by b.title)
      into bloccanti
    from public.tasks b
    where b.id = any(new.blocked_by)
      and not (
        b.status = 'completed'
        and (
          b.requires_approval is not true
          or (b.approved_by is not null and b.approved_at is not null)
        )
      );

    -- Si DICE quali sono, come fa l'interfaccia: "non puoi" senza il motivo
    -- manda a cercare, e chi cerca finisce per togliere la dipendenza invece
    -- di chiudere il lavoro che aspettava.
    if bloccanti is not null then
      raise exception 'Prima vanno chiuse: %', bloccanti;
    end if;
  end if;

  -- -------------------------------------------------------------------------
  -- 2) Il cambio di stato azzera il visto precedente.
  --
  -- Si azzera e basta, senza rifiutare: riaprire un lavoro e' un gesto
  -- legittimo, quello che non deve sopravvivere e' l'approvazione di prima.
  --
  -- La condizione sull'ultima riga lascia passare il caso in cui chi scrive
  -- sta CONCEDENDO un visto nella stessa operazione in cui cambia lo stato:
  -- quello lo ha gia' validato il trigger della 0023 (responsabile, non
  -- l'assegnatario, firmato da se'). Qui si toglie solo il visto STANTIO,
  -- cioe' quello che era gia' li' e che il chiamante si e' limitato a
  -- rimandare indietro insieme al resto della riga.
  if new.requires_approval is true
     and new.status is distinct from old.status
     and (old.approved_by is not null or old.approved_at is not null)
     and new.approved_by is not distinct from old.approved_by
     and new.approved_at is not distinct from old.approved_at then
    new.approved_by := null;
    new.approved_at := null;
  end if;

  return new;
end;
$$;

-- Il nome viene dopo `task_approvazione_valida` e `task_campi_immutabili` in
-- ordine alfabetico, ed e' l'ordine in cui Postgres esegue i trigger BEFORE
-- con lo stesso evento. E' quello che serve: prima la 0023 valuta i valori
-- cosi' come sono arrivati dal chiamante, poi qui si azzera il visto stantio.
drop trigger if exists task_regole_stato on public.tasks;

create trigger task_regole_stato
  before update on public.tasks
  for each row
  execute function public.task_regole_stato();
