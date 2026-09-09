-- 0003_restrict_helper_functions.sql
--
-- Gli advisor di sicurezza Supabase (lint 0028 / 0029) segnalano che
-- is_org_member() e is_org_admin(), essendo SECURITY DEFINER nello schema
-- public, sono invocabili come endpoint REST da chiunque:
--   POST /rest/v1/rpc/is_org_member
--
-- Il rischio concreto e' contenuto — entrambe usano auth.uid() e rivelano solo
-- se CHI CHIAMA e' membro di un'organizzazione di cui conosce gia' l'UUID — ma
-- l'esposizione non serve a nulla: le funzioni esistono solo per essere usate
-- dentro le policy RLS.
--
-- Per default Postgres concede EXECUTE a PUBLIC su ogni nuova funzione. Qui lo
-- revochiamo e lo riconcediamo solo ai ruoli che ne hanno davvero bisogno.
--
-- NOTA: 'authenticated' DEVE mantenere EXECUTE. Le espressioni delle policy RLS
-- vengono valutate con i privilegi del chiamante, quindi togliendogli il
-- permesso ogni SELECT sulle tabelle protette fallirebbe con "permission
-- denied for function" invece di restituire zero righe.

revoke execute on function public.is_org_member(uuid) from public;
revoke execute on function public.is_org_admin(uuid)  from public;

revoke execute on function public.is_org_member(uuid) from anon;
revoke execute on function public.is_org_admin(uuid)  from anon;

grant execute on function public.is_org_member(uuid) to authenticated, service_role;
grant execute on function public.is_org_admin(uuid)  to authenticated, service_role;
