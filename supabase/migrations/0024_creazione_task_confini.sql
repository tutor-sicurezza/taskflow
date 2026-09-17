-- 0024_creazione_task_confini.sql
--
-- La creazione di un task non passava da nessun controllo.
--
-- La policy di insert della 0008 chiede solo di poter scrivere
-- nell'organizzazione (`is_org_writer`), e non guarda il CONTENUTO della riga.
-- Provato con l'account di un dipendente, chiamando PostgREST con il proprio
-- token: ha creato un task assegnato a un collega (nell'interfaccia e' un
-- gesto da responsabile in su), lo ha firmato con l'id dell'amministratore in
-- `created_by` — il campo da cui dipendono i permessi di modifica e di
-- cancellazione, e che la 0018 rende immutabile solo DOPO la creazione — e lo
-- ha assegnato a un utente di un'altra organizzazione, che se lo e' visto
-- comparire fra i propri.
--
-- Il client ora crea i task da POST /api/tasks, che gira con il service role
-- e fa questi controlli piu' altri (osservatori, dipendenze, firma di commenti
-- e cronologia). Ma "il client passa dalla rotta" non e' una difesa: chi chiama
-- PostgREST direttamente non passa da nessuna parte. La regola va scritta dove
-- chi scrive non decide, e a differenza di quelle della 0018 e della 0023
-- questa NON ha bisogno della riga vecchia: e' esprimibile in una `with check`
-- e non serve un trigger.
--
-- Il service role scavalca le policy, quindi la rotta non ne e' toccata.
-- Il ripristino di un backup (SuperAdminSettings) inserisce con il token di un
-- amministratore: per lui `created_by` resta libero, ma un assegnatario che
-- nel frattempo ha lasciato l'organizzazione fa rifiutare la riga. E' voluto:
-- un task assegnato a chi non c'e' piu' non e' un dato da reintrodurre.

drop policy if exists "writers can create tasks" on public.tasks;

create policy "writers can create tasks"
  on public.tasks for insert
  with check (
    -- Invariato dalla 0008: i viewer non creano.
    public.is_org_writer(organization_id)

    -- L'autore e' chi scrive. Un responsabile puo' registrare un task per
    -- conto di altri (e' cio' che fa un ripristino), un membro no.
    and (
      created_by = auth.uid()
      or public.is_org_manager(organization_id)
    )

    -- Assegnare ad altri e' da responsabile in su; a se stessi puo' chiunque.
    and (
      assignee_id is null
      or assignee_id = auth.uid()
      or public.is_org_manager(organization_id)
    )

    -- E l'assegnatario, chiunque lo scelga, sta in QUESTA organizzazione.
    -- Senza, un task esce dal confine multi-tenant e compare nell'elenco di
    -- un utente che di questa organizzazione non sa nulla.
    and (
      assignee_id is null
      or public.is_org_member_of(organization_id, assignee_id)
    )
  );
