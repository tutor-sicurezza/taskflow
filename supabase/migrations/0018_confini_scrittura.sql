-- 0018_confini_scrittura.sql
--
-- Tre confini che le policy non presidiavano. Tutti e tre sfruttabili da un
-- account 'member' normale chiamando PostgREST con il proprio token, senza
-- passare dall'interfaccia.
--
-- Due si chiudono con un trigger e non con una policy, per un motivo preciso:
-- le RLS ragionano sulla riga NUOVA e non possono confrontarla con la vecchia,
-- ne' limitare QUALI COLONNE si possono toccare. "Puoi aggiornare la tua riga
-- ma non questi tre campi" non e' esprimibile in una `with check`.
--
-- I trigger scattano anche per il service role, che invece scavalca le RLS.
-- Per questo ognuno controlla `auth.uid()`: quando e' NULL la chiamata arriva
-- dal server — cioe' dalle rotte in api/, che hanno gia' fatto i loro
-- controlli sui ruoli — e passa. Il vincolo vale per chi scrive dal browser.

-- ---------------------------------------------------------------------------
-- 1) Un membro riscriveva il proprio profilo, campi di controllo compresi.
--
-- La policy "users can update their own profile" non limita le colonne. Un
-- membro poteva quindi rimettersi `status` da 'inactive' ad 'active',
-- annullando la disattivazione decisa da un amministratore, e assegnarsi
-- `team_lead` e `custom_permissions` — che l'interfaccia usa per decidere cosa
-- mostrare. Non e' una scalata completa (le rotte in api/ ricontrollano il
-- ruolo dal database), ma riattivarsi da soli e sbloccare pannelli
-- amministrativi sono due cose che un utente non deve poter fare.
--
-- Restano modificabili dal diretto interessato nome, foto, telefono, luogo,
-- biografia e competenze: sono i suoi dati, ed e' il senso di quella policy.

create or replace function public.profilo_campi_protetti()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Scrittura dal server: le rotte in api/ hanno gia' verificato il ruolo.
  if auth.uid() is null then
    return new;
  end if;

  -- Si rifiuta solo se il valore CAMBIA davvero: un client che rimanda la riga
  -- intera con gli stessi valori non deve ricevere un errore.
  if new.status is distinct from old.status then
    raise exception 'Il campo status non e'' modificabile dal proprio profilo';
  end if;

  if new.team_lead is distinct from old.team_lead then
    raise exception 'Il campo team_lead non e'' modificabile dal proprio profilo';
  end if;

  if new.custom_permissions is distinct from old.custom_permissions then
    raise exception 'I permessi non sono modificabili dal proprio profilo';
  end if;

  return new;
end;
$$;

drop trigger if exists profilo_campi_protetti on public.profiles;

create trigger profilo_campi_protetti
  before update on public.profiles
  for each row
  execute function public.profilo_campi_protetti();

-- ---------------------------------------------------------------------------
-- 2) Chiunque poteva crearsi un'organizzazione.
--
-- La policy di insert chiedeva solo `owner_id = auth.uid()`, quindi qualunque
-- utente autenticato poteva creare uno spazio proprio con una chiamata
-- diretta, e la policy di bootstrap della 0002 gli permetteva poi di
-- inserirsi come 'owner'. Il caso che conta non e' il furto di dati — la nuova
-- organizzazione e' vuota — ma la PERSISTENZA: un utente rimosso da un
-- amministratore conserva l'account e rientra creandosene una sua, che e'
-- esattamente cio' che api/tenants/index.ts dice di voler impedire.
--
-- La creazione resta possibile, ma solo dalla rotta, che gira con il service
-- role e scavalca le RLS: non serve alcuna policy per lei.

drop policy if exists "organization owners can insert organizations" on public.organizations;

-- ---------------------------------------------------------------------------
-- 3) Un task poteva essere spostato in un'altra organizzazione.
--
-- La `with check` dell'update e' soddisfatta anche dalla riga NUOVA quando
-- `assignee_id = auth.uid()`, e non dice nulla su `organization_id`. Chi era
-- assegnatario o autore poteva quindi cambiare quel campo: il task usciva
-- dalla propria organizzazione e compariva in un'altra, dove i membri lo
-- leggono e dove il lavoro pianificato dei promemoria lo prende in carico.
-- Non e' lettura di dati altrui, e' iniezione di una riga oltre il confine.
--
-- Stesso discorso per `created_by`: cambiarlo significa riscrivere chi ha
-- creato un task, e da quel campo dipendono i permessi di modifica e di
-- cancellazione.

create or replace function public.task_campi_immutabili()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.organization_id is distinct from old.organization_id then
    raise exception 'Un task non puo'' cambiare organizzazione';
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'L''autore di un task non e'' modificabile';
  end if;

  return new;
end;
$$;

drop trigger if exists task_campi_immutabili on public.tasks;

create trigger task_campi_immutabili
  before update on public.tasks
  for each row
  execute function public.task_campi_immutabili();
