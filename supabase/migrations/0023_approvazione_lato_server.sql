-- 0023_approvazione_lato_server.sql
--
-- L'approvazione era una regola scritta solo nel client.
--
-- Il flusso di approvazione dice che approva chi ha `tasks.edit_any` e mai
-- l'assegnatario del lavoro. Quella regola viveva in `src/lib/approvazione.ts`,
-- cioe' in codice che gira sul computer di chi la deve rispettare. Le policy di
-- UPDATE permettono a chiunque possa modificare un task — e l'assegnatario puo'
-- — di scrivere QUALUNQUE colonna, `approved_by` e `approved_at` comprese.
--
-- Non e' un rischio teorico: e' stato provato con l'account di un dipendente
-- vero, chiamando PostgREST senza passare dall'interfaccia. Tre varianti,
-- tutte riuscite:
--   1. l'assegnatario si e' approvato il proprio lavoro;
--   2. lo ha approvato scrivendo l'id dell'AMMINISTRATORE, quindi il visto
--      risultava firmato dal capo — l'id di un collega non e' un segreto, lo
--      restituisce l'elenco dei membri a ogni utente;
--   3. ha semplicemente tolto `requires_approval`, e l'approvazione non e'
--      stata piu' nemmeno richiesta.
--
-- Un controllo che il client puo' saltare non e' un controllo. Qui si sposta
-- nel database, che e' l'unico posto dove chi scrive non decide le regole.

create or replace function public.task_approvazione_valida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  visto_cambiato boolean;
  visto_concesso boolean;
begin
  -- Il service role passa: i lavori pianificati e le rotte serverless hanno
  -- gia' fatto i loro controlli, e qui `auth.uid()` e' nullo. E' la stessa
  -- convenzione del trigger dei campi immutabili (migrazione 0018).
  if auth.uid() is null then
    return new;
  end if;

  visto_cambiato :=
    new.approved_by is distinct from old.approved_by
    or new.approved_at is distinct from old.approved_at;

  -- Concedere un visto e' un'altra cosa dal toglierlo.
  --
  -- Toglierlo RIAPRE il lavoro, quindi non e' un privilegio che qualcuno possa
  -- volersi prendere: succede quando si rimanda indietro un task e a ogni
  -- cambio di stato, gesti che fa anche l'assegnatario. Vietarlo romperebbe il
  -- flusso normale senza proteggere niente.
  visto_concesso := visto_cambiato and new.approved_by is not null;

  if visto_concesso then
    if not is_org_manager(new.organization_id) then
      raise exception 'Solo un responsabile puo'' approvare un''attivita''';
    end if;

    -- Il cuore del flusso: nessuno chiude da solo il proprio lavoro. Vale
    -- anche per un amministratore assegnatario — il permesso dice cosa si puo'
    -- fare sul lavoro ALTRUI, non che il proprio non vada guardato.
    if old.assignee_id is not null and old.assignee_id = auth.uid() then
      raise exception 'Non si approva un''attivita'' assegnata a se stessi';
    end if;

    -- Il visto porta il nome di chi lo mette, non di chi si sceglie.
    if new.approved_by <> auth.uid() then
      raise exception 'L''approvazione deve essere firmata da chi la concede';
    end if;

    -- Un visto senza data non e' un visto: `eApprovato()` chiede entrambi, e
    -- una riga a meta' renderebbe il task chiuso per il database e aperto per
    -- l'interfaccia, o viceversa.
    if new.approved_at is null then
      raise exception 'Un''approvazione deve avere una data';
    end if;
  end if;

  -- Togliere la richiesta di approvazione e' il terzo modo di aggirarla, ed e'
  -- il piu' silenzioso: nessun visto falso, semplicemente non serve piu'.
  -- Metterla e' invece libero — chiedere che il proprio lavoro venga guardato
  -- non e' un privilegio.
  if old.requires_approval is true and new.requires_approval is not true then
    if not is_org_manager(new.organization_id) then
      raise exception 'Solo un responsabile puo'' togliere la richiesta di approvazione';
    end if;
    if old.assignee_id is not null and old.assignee_id = auth.uid() then
      raise exception 'Non si toglie la richiesta di approvazione dal proprio lavoro';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists task_approvazione_valida on public.tasks;

create trigger task_approvazione_valida
  before update on public.tasks
  for each row
  execute function public.task_approvazione_valida();

-- ---------------------------------------------------------------------------
-- E in creazione: nessun task nasce gia' approvato.
--
-- Il trigger sopra guarda gli UPDATE. Senza questo, la scorciatoia sarebbe
-- creare direttamente una riga con il visto gia' dentro.

create or replace function public.task_creazione_valida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.approved_by is not null or new.approved_at is not null then
    raise exception 'Un''attivita'' non puo'' nascere gia'' approvata';
  end if;

  return new;
end;
$$;

drop trigger if exists task_creazione_valida on public.tasks;

create trigger task_creazione_valida
  before insert on public.tasks
  for each row
  execute function public.task_creazione_valida();
