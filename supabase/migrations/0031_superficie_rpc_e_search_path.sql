-- Gli ultimi due rilievi degli advisor di sicurezza di Supabase, quelli che
-- riguardano il database e non la console.
--
-- Nessuno dei due e' una falla aperta. Sono due margini: cose che oggi non
-- fanno danno per ragioni che nessuno ha scritto da nessuna parte, e che
-- smetterebbero di essere vere senza che nessuno se ne accorga.

-- 1. Otto funzioni di trigger esposte come RPC
--
-- Le funzioni di trigger vivono nello schema `public`, quindi PostgREST le
-- pubblica come `/rest/v1/rpc/<nome>` e chiunque, anche senza aver fatto
-- l'accesso, puo' chiamarle. Sono `security definer`: girano con i privilegi
-- del proprietario.
--
-- Oggi non fanno danno perche' una funzione di trigger chiamata fuori da un
-- trigger fallisce: `new` e `old` non esistono. E' una difesa che viene dal
-- linguaggio, non da una decisione presa qui, e copre il codice di OGGI. Se
-- domani una di queste funzioni prende un ramo che non tocca `new`, la
-- protezione sparisce in silenzio.
--
-- La revoca non spegne i trigger. In PostgreSQL il permesso EXECUTE su una
-- funzione di trigger si controlla quando il trigger viene CREATO, non quando
-- scatta. Misurato su questo database prima di scrivere questa migrazione, con
-- una tabella e un trigger usa-e-getta, agendo come `authenticated` senza
-- EXECUTE: il trigger e' scattato lo stesso.
--
-- `service_role` non e' nell'elenco perche' non e' nemmeno lui a chiamarle: le
-- chiama il motore, per conto del proprietario della tabella.

revoke execute on function public.membro_ruolo_protetto() from public, anon, authenticated;
revoke execute on function public.profilo_campi_protetti() from public, anon, authenticated;
revoke execute on function public.pulisci_dipendenze_task() from public, anon, authenticated;
revoke execute on function public.task_approvazione_valida() from public, anon, authenticated;
revoke execute on function public.task_assegnazione_protetta() from public, anon, authenticated;
revoke execute on function public.task_campi_immutabili() from public, anon, authenticated;
revoke execute on function public.task_creazione_valida() from public, anon, authenticated;
revoke execute on function public.task_regole_stato() from public, anon, authenticated;

-- Le `is_org_*` NON si revocano da `authenticated`, e non e' una dimenticanza.
-- Le policy RLS vengono valutate con i privilegi di chi fa la richiesta: se
-- `authenticated` non puo' eseguire `is_org_member`, ogni policy che la usa
-- fallisce e l'applicazione si ferma. Sono gia' revocate da `anon`.

-- 2. Due funzioni con search_path mutabile
--
-- `app_state_key_amministrativa` e `app_state_key_riservata` decidono, dentro
-- le policy di `app_state`, se una chiave e' riservata ai manager. Sono
-- `security invoker` e nel corpo non c'e' nessun oggetto del database: solo un
-- `in` su una lista di stringhe. L'unica cosa che il search_path potrebbe
-- dirottare e' l'operatore `=` fra text.
--
-- Per farlo servirebbe poter creare un operatore in uno schema sul percorso.
-- Verificato: ne' `anon` ne' `authenticated` hanno CREATE su nessuno schema di
-- questo progetto. Quindi oggi non e' sfruttabile — di nuovo, per una ragione
-- che sta altrove e che una GRANT futura puo' cancellare.
--
-- Il costo va detto: una funzione SQL con una clausola SET non puo' piu' essere
-- incorporata dal planner, quindi diventa una chiamata per riga invece di
-- un'espressione. Su `app_state` ci sono 7 righe. Il costo e' zero misurabile,
-- il margine sparisce, e si sceglie il margine.

alter function public.app_state_key_amministrativa(text) set search_path = '';
alter function public.app_state_key_riservata(text) set search_path = '';

-- 3. `email_promemoria_inviati`: RLS attiva e zero policy
--
-- L'advisor la segnala come INFO. Non e' un errore: e' esattamente il disegno,
-- ed e' gia' scritto nella migrazione 0014. La tabella la scrivono solo i
-- lavori pianificati con il service role; per il client deve essere vuota e
-- non scrivibile, perche' cancellare una riga qui vorrebbe dire far rispedire
-- un'email e inserirne una vorrebbe dire zittire il promemoria di un collega.
-- Nessuna modifica: si annota e basta, cosi' chi legge l'advisor la prossima
-- volta non ci perde tempo.
