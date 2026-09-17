-- 0029_indici_chiavi_esterne.sql
--
-- Sette chiavi esterne senza indice di copertura, segnalate dall'advisor di
-- prestazioni del progetto — che nessuno aveva mai letto fino al 17 settembre.
--
-- Perche' contano, in concreto:
--
--   * `organization_members.user_id` e' il percorso di ACCESSO. `AuthContext`
--     legge le appartenenze di chi entra (`where user_id = ...`) a ogni avvio,
--     e da oggi lo fa anche la guardia sulla reimpostazione password, che
--     cerca se il bersaglio appartiene ad altre organizzazioni. Senza indice
--     sono scansioni complete, su una tabella che cresce con ogni persona di
--     ogni cliente.
--
--   * `tasks.created_by` sta dentro la `using` della policy di UPDATE
--     (`created_by = auth.uid()`), quindi viene valutata per ogni riga
--     toccata. Un'operazione in blocco su cinquanta attivita' la valuta
--     cinquanta volte.
--
-- Gli altri cinque contano per un motivo diverso e piu' raro: quando si
-- cancella una riga di `profiles` o di `tasks`, Postgres deve controllare
-- tutte le righe che la referenziano. Senza indice e' una scansione completa
-- per ognuna, e cancellare una persona diventa lento in modo sproporzionato.
--
-- Sono tutti additivi: un indice non cambia il significato di nessuna query.
--
-- `if not exists` perche' questa migrazione deve poter essere rigiocata.
--
-- NOTA: l'advisor segnala anche `auth_rls_initplan` su quattordici policy —
-- `auth.uid()` rivalutata riga per riga invece di `(select auth.uid())`. E'
-- un rilievo giusto e a regime conta. NON e' stato applicato qui di
-- proposito: significherebbe riscrivere le policy di sicurezza appena chiuse
-- (0024, 0026, 0027) per un guadagno che si vede da qualche migliaio di righe
-- in su, e riscrivere una policy e' esattamente il gesto con cui si
-- reintroduce un buco. Va fatto come cambiamento a se', con le stesse sonde
-- di verifica della 0026 e della 0027 rieseguite dopo.

-- Il percorso di accesso e la guardia multi-organizzazione.
create index if not exists organization_members_user_id_idx
  on public.organization_members (user_id);

-- Dentro la `using` della policy di update su tasks.
create index if not exists tasks_created_by_idx
  on public.tasks (created_by);

-- Le restanti: servono alla cancellazione di una persona o di un'attivita'.
create index if not exists tasks_approved_by_idx
  on public.tasks (approved_by);

create index if not exists notifications_action_by_idx
  on public.notifications (action_by);

create index if not exists notifications_task_id_idx
  on public.notifications (task_id);

create index if not exists app_state_updated_by_idx
  on public.app_state (updated_by);

create index if not exists email_delivery_logs_user_id_idx
  on public.email_delivery_logs (user_id);
