-- 0028_deroghe_per_organizzazione.sql
--
-- Le deroghe ai permessi valevano ovunque. Ora valgono dove sono state date.
--
-- E' il rovescio preciso del lavoro fatto con la 0018 e con
-- `dipendenteCorrente`. Le deroghe stavano in `app_state.employees`: una
-- chiave PER ORGANIZZAZIONE, ma riscrivibile da ogni membro con il proprio
-- token — chiunque si concedeva i permessi che voleva. Sono state spostate su
-- `profiles.custom_permissions`, che nessuno puo' modificare per se' (il
-- trigger della 0018 lo impedisce).
--
-- Quella mossa ha chiuso una falla e ne ha aperta un'altra di forma diversa:
-- `profiles` non ha una colonna per organizzazione, quindi le deroghe sono
-- diventate GLOBALI. Mario e' membro sia di Acme sia di Beta; l'amministratrice
-- di Acme gli concede `tasks.edit_any` dal pannello ruoli; Mario cambia
-- organizzazione su Beta e si ritrova i comandi di approvazione sul lavoro di
-- colleghi che non hanno mai deciso niente in proposito.
--
-- La sede giusta non era nessuna delle due: e' `organization_members`, che e'
-- gia' la tabella che dice "questa persona, in questa organizzazione, e'
-- questo". E' per organizzazione come `app_state`, e non e' scrivibile
-- dall'interessato come `profiles`.
--
-- La colonna vecchia NON viene cancellata. I valori vengono copiati, e da qui
-- in poi nessuno la legge piu'. Toglierla sarebbe irreversibile per guadagnare
-- qualche byte; il commento qui sotto e' li' per chi la trovera'.

alter table public.organization_members
  add column if not exists custom_permissions jsonb;

comment on column public.organization_members.custom_permissions is
  'Deroghe ai permessi del ruolo, valide SOLO in questa organizzazione. Vedi 0028.';

comment on column public.profiles.custom_permissions is
  'ABBANDONATA dalla 0028: le deroghe vivono in organization_members.custom_permissions, perche'' qui sarebbero valide in ogni organizzazione. Non piu'' letta da nessuno.';

-- I valori esistenti seguono la persona in ogni organizzazione a cui appartiene
-- OGGI. E' l'unica lettura possibile di un dato che non sapeva distinguerle, ed
-- e' anche quella che non toglie niente a nessuno: chi aveva una deroga la
-- conserva dove la stava usando.
update public.organization_members om
   set custom_permissions = p.custom_permissions
  from public.profiles p
 where p.id = om.user_id
   and p.custom_permissions is not null
   and om.custom_permissions is null;

-- E nessuno si concede una deroga da solo, per la stessa ragione per cui
-- nessuno si cambia il ruolo. La policy di UPDATE della 0027 gia' limita la
-- scrittura agli amministratori dell'organizzazione, quindi si arriva qui solo
-- essendo amministratori; ma un amministratore E' un membro, e la sua riga e'
-- una riga come le altre.
create or replace function public.membro_ruolo_protetto()
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

  if new.role is distinct from old.role and new.user_id = auth.uid() then
    raise exception 'Non si cambia il proprio ruolo';
  end if;

  if new.custom_permissions is distinct from old.custom_permissions
     and new.user_id = auth.uid() then
    raise exception 'Non si cambiano i propri permessi';
  end if;

  if new.role = 'owner' and old.role <> 'owner'
     and not public.is_org_owner(new.organization_id) then
    raise exception 'Solo il proprietario puo'' conferire la proprieta''';
  end if;

  if new.user_id is distinct from old.user_id then
    raise exception 'Un''appartenenza non cambia persona';
  end if;

  if new.organization_id is distinct from old.organization_id then
    raise exception 'Un''appartenenza non cambia organizzazione';
  end if;

  return new;
end;
$$;
