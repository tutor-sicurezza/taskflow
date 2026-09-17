-- 0030_colonne_di_sistema_immutabili.sql
--
-- La 0026 ha chiuso `recurrence_parent` e `archived_at` in CREAZIONE e le ha
-- lasciate aperte in MODIFICA. E' lo stesso buco, dall'altra porta.
--
-- La policy di insert della 0026 vieta di far nascere un task figlio di una
-- serie o gia' archiviato. Ma in UPDATE non le guarda nessuno:
--
--   * la policy di update (0027) si ferma a `is_org_writer` piu' (manager,
--     autore, assegnatario): non nomina quelle colonne;
--   * `task_campi_immutabili` (0018) controllava solo `organization_id` e
--     `created_by`;
--   * `task_assegnazione_protetta` (0027) solo `assignee_id`;
--   * `task_regole_stato` (0026) solo stato, approvazione e bloccanti.
--
-- E il client le manda: `colonneScrivibili` in src/lib/scritturaTask.ts le
-- include entrambe. Bastava quindi una PATCH.
--
-- Il danno e' esattamente quello che la 0026 dichiarava di impedire: un membro
-- crea un task suo, legge dall'elenco l'id della capostipite di una serie
-- ricorrente — e' visibile a tutti — e con una PATCH si dichiara sua figlia.
-- Al giro dopo `api/cron/ricorrenze.ts` trova una "figlia aperta" e SMETTE di
-- rigenerare quel controllo periodico. Risponde 200, con un contatore che non
-- guarda nessuno.
--
-- Con `archived_at` si nasconde un'attivita' dalle viste, o si riporta in
-- elenco una che il lavoro di manutenzione aveva archiviato.
--
-- Chiuderlo toglie anche un canale trans-organizzazione minore: la chiave
-- esterna di `recurrence_parent` non e' limitata per organizzazione, quindi
-- scriverci un uuid qualunque distingueva "esiste da qualche parte" (passa) da
-- "non esiste" (violazione 23503). Un oracolo di esistenza su uuid casuali,
-- di valore pratico scarso, ma che esisteva solo perche' quella colonna era
-- scrivibile.
--
-- Nessuna schermata scrive quelle due colonne: nel client si leggono soltanto
-- (verificato). Le scrive solo il service role, dai lavori pianificati, che
-- questo trigger non tocca perche' per lui `auth.uid()` e' nullo.

create or replace function public.task_campi_immutabili()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Scrittura dal server: i lavori pianificati e le rotte in api/ devono poter
  -- archiviare e creare le occorrenze di una serie. E' il loro mestiere.
  if auth.uid() is null then
    return new;
  end if;

  if new.organization_id is distinct from old.organization_id then
    raise exception 'Un task non puo'' cambiare organizzazione';
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'L''autore di un task non e'' modificabile';
  end if;

  -- L'appartenenza a una serie ricorrente la decide il lavoro pianificato,
  -- non chi scrive.
  if new.recurrence_parent is distinct from old.recurrence_parent then
    raise exception 'L''appartenenza a una serie ricorrente non si modifica da qui';
  end if;

  -- E l'archiviazione e' il risultato di trenta giorni di lavoro chiuso, non
  -- una casella da spuntare.
  if new.archived_at is distinct from old.archived_at then
    raise exception 'L''archiviazione non si modifica da qui';
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Igiene: `is_org_owner` non era stata revocata, a differenza delle sorelle.
--
-- Le altre `is_org_*` sono revocate da `public` e da `anon` fin dalla 0003 e
-- dalla 0008. La 0027 ha aggiunto `is_org_owner` senza farlo, e Postgres
-- concede EXECUTE a PUBLIC per default: era invocabile come RPC anche da un
-- anonimo.
--
-- Non era una scalata — per un anonimo `auth.uid()` e' nullo, quindi risponde
-- sempre falso, e per chi e' autenticato dice solo se e' proprietario di
-- un'organizzazione di cui conosce gia' l'uuid. Ma e' una deviazione da una
-- regola che il progetto si era dato, e le deviazioni silenziose sono quelle
-- che poi si citano come precedente.
-- -----------------------------------------------------------------------------

revoke execute on function public.is_org_owner(uuid) from public;
revoke execute on function public.is_org_owner(uuid) from anon;
grant execute on function public.is_org_owner(uuid) to authenticated;
grant execute on function public.is_org_owner(uuid) to service_role;
