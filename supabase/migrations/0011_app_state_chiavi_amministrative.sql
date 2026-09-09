-- 0011_app_state_chiavi_amministrative.sql
--
-- Fino alla 0008 la scrittura su app_state era "tutto o niente": chi non e'
-- un viewer puo' riscrivere QUALUNQUE chiave dell'organizzazione. Verificato
-- in produzione con un account 'member' reale: riusciva a riscrivere sia
-- l'elenco dei dipendenti sia i template email, semplicemente chiamando
-- PostgREST con il proprio token, senza passare dall'interfaccia.
--
-- Due conseguenze concrete:
--
--   1. l'array `employees` contiene il campo `userRole`, che guida TUTTI i
--      controlli di permesso dell'interfaccia. Un membro poteva quindi
--      promuoversi ad "admin" agli occhi del client;
--   2. i template email finiscono in un'anteprima renderizzata con
--      dangerouslySetInnerHTML: un membro poteva piazzare markup che sarebbe
--      poi stato eseguito nel browser di un amministratore, con la sua
--      sessione. (Il rendering e' ora sanificato, ma la scrittura andava
--      comunque chiusa: la difesa non deve stare in un solo punto.)
--
-- Qui si separano le chiavi di CONFIGURAZIONE, che solo manager e
-- amministratori devono poter scrivere, da quelle di LAVORO QUOTIDIANO
-- (tasks, employees, announcements, feedback), che restano scrivibili da
-- chiunque possa collaborare.
--
-- NOTA ONESTA sui limiti: questo NON rende i dati a prova di membro
-- malintenzionato. `tasks` resta un unico blob riscrivibile per intero, quindi
-- un membro puo' ancora azzerare i task dell'organizzazione con una sola
-- chiamata. La soluzione vera e' spostare i task nella tabella relazionale
-- public.tasks, che esiste gia' dalla 0001 con policy per riga (0006/0008) ed
-- e' tuttora inutilizzata. Quella e' una migrazione di dati e di codice, non
-- una policy.

create or replace function public.app_state_key_amministrativa(k text)
returns boolean
language sql
immutable
as $$
  select k in (
    'system-settings',
    'audit-log',
    'maintenance-mode',
    'email-templates',
    'email-attachment-settings',
    'sendgrid-config',
    'departments'
  );
$$;

revoke execute on function public.app_state_key_amministrativa(text) from public, anon;
grant execute on function public.app_state_key_amministrativa(text) to authenticated, service_role;

drop policy if exists "writers can insert app state" on public.app_state;
drop policy if exists "writers can update app state" on public.app_state;

create policy "writers can insert app state"
  on public.app_state for insert
  with check (
    case
      when public.app_state_key_amministrativa(key)
        then public.is_org_manager(organization_id)
      else public.is_org_writer(organization_id)
    end
  );

create policy "writers can update app state"
  on public.app_state for update
  using (
    case
      when public.app_state_key_amministrativa(key)
        then public.is_org_manager(organization_id)
      else public.is_org_writer(organization_id)
    end
  )
  with check (
    case
      when public.app_state_key_amministrativa(key)
        then public.is_org_manager(organization_id)
      else public.is_org_writer(organization_id)
    end
  );
