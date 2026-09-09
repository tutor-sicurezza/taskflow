-- 0006_restrict_task_mutations.sql
--
-- Le policy della 0001 permettevano a QUALUNQUE membro di modificare o
-- cancellare qualunque task dell'organizzazione:
--
--     create policy "members can delete tasks" on public.tasks
--       for delete using (public.is_org_member(organization_id));
--
-- Un 'viewer' aveva quindi gli stessi privilegi di scrittura di un 'owner'.
-- Non e' raggiungibile dall'interfaccia — l'app tiene i task in app_state, non
-- in questa tabella — ma qualunque membro autenticato puo' chiamare PostgREST
-- direttamente con il proprio token, quindi la falla e' reale. Oggi e' innocua
-- solo perche' la tabella non e' ancora in uso: va chiusa prima della
-- normalizzazione, non dopo.
--
-- Nuova regola: puo' modificare o cancellare un task solo chi ne e' l'autore,
-- chi ne e' l'assegnatario, o un amministratore dell'organizzazione.
-- La lettura resta a tutti i membri (invariata).

drop policy if exists "members can update tasks" on public.tasks;

create policy "task owners and admins can update tasks"
  on public.tasks
  for update
  using (
    public.is_org_admin(organization_id)
    or created_by = auth.uid()
    or assignee_id = auth.uid()
  )
  with check (
    public.is_org_admin(organization_id)
    or created_by = auth.uid()
    or assignee_id = auth.uid()
  );

drop policy if exists "members can delete tasks" on public.tasks;

create policy "task authors and admins can delete tasks"
  on public.tasks
  for delete
  using (
    public.is_org_admin(organization_id)
    or created_by = auth.uid()
  );
