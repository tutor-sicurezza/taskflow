-- 0013_rimuove_task_da_app_state.sql
--
-- La 0012 ha spostato i task in public.tasks lasciando la vecchia chiave in
-- app_state come copia di sicurezza. La lettura e la scrittura dalla tabella
-- sono state verificate (elenco, cambio di stato persistito, permessi per riga
-- rispettati), quindi la copia va rimossa: finche' resta, un membro puo'
-- ancora riscriverla e il backup esporterebbe due versioni divergenti degli
-- stessi task.
delete from public.app_state where key = 'tasks';
