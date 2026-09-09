-- 0010_rimuove_notifiche_da_app_state.sql
--
-- La 0009 ha travasato le notifiche nella tabella public.notifications ma ha
-- lasciato di proposito la vecchia chiave in app_state, come copia di
-- sicurezza finche' la nuova lettura non fosse verificata.
--
-- Ora lo e' (letta dall'interfaccia, consegnata in tempo reale, e un
-- amministratore che interroga la tabella con il proprio token vede solo le
-- proprie notifiche). Quella copia va quindi tolta: finche' resta, la falla
-- che la 0009 chiude e' ancora aperta dall'altra parte, perche' la policy di
-- app_state rende il blob leggibile a ogni membro dell'organizzazione.

delete from public.app_state where key = 'notifications';
