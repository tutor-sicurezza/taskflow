-- 0015_chiusura_falle_rls.sql
--
-- Due falle rimaste aperte dopo la 0011, entrambe sfruttabili da un account
-- 'member' normale chiamando PostgREST con il proprio token, senza passare
-- dall'interfaccia.
--
-- 1) NOTIFICHE FIRMABILI A NOME DI CHIUNQUE.
--    La policy della 0009 chiedeva solo is_org_writer (che comprende i
--    'member') e non guardava affatto il CONTENUTO della riga. Le colonne
--    action_by / action_by_name / action_by_avatar sono quelle che la
--    campanella mostra come mittente, e `link` e' l'indirizzo su cui il
--    messaggio porta. Un membro poteva quindi scrivere nella casella di ogni
--    collega un messaggio firmato con l'UUID dell'amministratore — UUID che
--    non e' un segreto, GET /api/tenants/<id>/members lo restituisce a tutti —
--    e puntarlo dove voleva. E' phishing interno perfettamente credibile:
--    arriva dentro l'applicazione, con nome e faccia giusti.
--
--    NON si puo' pero' limitare la scrittura nella casella altrui ai soli
--    manager, che sarebbe la regola gia' applicata da api/notifications: le
--    notifiche legittime dell'app le genera IL CLIENT, con il token di chi
--    agisce (src/hooks/useNotifications.ts). Un 'member' puo' commentare e
--    cambiare stato a un task, e deve poterne avvisare l'assegnatario: con la
--    regola "solo manager" l'assegnazione, il commento, la menzione e il
--    cambio di stato smetterebbero di notificare chiunque tranne i capi.
--    La difesa e' quindi sull'ATTRIBUZIONE, non sul destinatario: chi scrive
--    a un altro deve firmarsi con il proprio auth.uid(), e non puo' spedire
--    senza firma. Restano non firmate solo le notifiche dei manager (e quelle
--    del server, che usa il service role e non passa di qui).
--
--    NOTA ONESTA sul limite: action_by_name e action_by_avatar restano testo
--    libero, quindi un membro puo' ancora scrivere "Amministrazione" nel nome
--    visualizzato. Vincolarli al profilo vero significherebbe leggere
--    profiles.full_name dentro la policy, e basterebbe un nome diverso fra
--    profilo e anagrafica applicativa per far fallire OGNI notifica. Cio' che
--    qui si chiude e' l'impersonificazione verificabile — l'identita' su cui
--    l'interfaccia puo' fare click — non la millanteria testuale.
--
-- 2) REGISTRO DI AUDIT E CONFIGURAZIONE EMAIL LEGGIBILI DA CHIUNQUE.
--    La 0011 ha separato le chiavi amministrative di app_state solo in
--    SCRITTURA: in lettura era rimasta la policy della 0004, un
--    is_org_member(organization_id) valido per QUALUNQUE chiave. Un membro
--    poteva quindi scaricarsi 'audit-log' (chi ha fatto cosa, per tutta
--    l'organizzazione) e 'sendgrid-config' (mittenti, dominio, impostazioni
--    di consegna) con una GET.
--
--    L'elenco della 0011 pero' NON va bene per la SELECT: due delle sue chiavi
--    servono a tutti i membri e usarlo cosi' com'e' romperebbe l'applicazione.
--      - 'system-settings' e' letto da src/App.tsx per ogni utente (e' da li'
--        che arriva il nome dell'applicazione mostrato in pagina);
--      - 'departments' e' letto da DepartmentColorLegend, che sta nella barra
--        superiore di chiunque, e serve a colorare i badge di reparto.
--      - 'maintenance-mode' e' un booleano che non svela nulla e che qualsiasi
--        client puo' legittimamente voler leggere per avvisare l'utente.
--    Restano riservate le quattro chiavi che oggi legge SOLO un pannello da
--    amministratore (verificato in src/: SuperAdminSettings, SendGridConfiguration,
--    EmailTemplateCustomization, EmailAttachmentSettings) e che lato server
--    passano dal service role, quindi non toccate dalle RLS.

-- --------------------------------------------------------------------------
-- 1) Notifiche: attribuzione obbligatoria e link solo interni.
-- --------------------------------------------------------------------------

drop policy if exists "writers can create notifications for members" on public.notifications;

create policy "writers can create notifications for members"
  on public.notifications
  for insert
  with check (
    -- Invariato dalla 0009: non si notificano estranei ne' si scrive
    -- nell'organizzazione di qualcun altro.
    public.is_org_member_of(organization_id, user_id)

    -- Nella propria casella scrive chiunque appartenga all'organizzazione
    -- (la riga precedente lo ha gia' dimostrato); in quella altrui serve
    -- almeno poter collaborare, cioe' non essere un 'viewer'.
    and (
      user_id = auth.uid()
      or public.is_org_writer(organization_id)
    )

    -- Il mittente e' chi sta scrivendo, punto. La firma assente resta
    -- possibile solo da manager in su, perche' una notifica senza volto
    -- sembra venire "dal sistema" ed e' un travestimento anch'essa.
    and (
      action_by = auth.uid()
      or (action_by is null and public.is_org_manager(organization_id))
    )

    -- Il link deve restare dentro l'applicazione: un percorso relativo che
    -- inizia con una sola '/' e non contiene spazi. Cosi' cadono
    -- 'http://...', 'javascript:...' e '//dominio-esterno'; escluso anche
    -- '/\dominio', che i browser trattano come protocol-relative esattamente
    -- come '//'. Il controllo e' scritto con left/substr e non con una regex
    -- perche' la barra rovesciata dentro una classe di caratteri viene
    -- interpretata due volte (letterale SQL e poi regex) e nella prova sul
    -- database '/\evil' passava.
    and (
      link is null
      or (
        left(link, 1) = '/'
        and left(link, 2) <> '//'
        and substr(link, 2, 1) <> chr(92)
        and link !~ '[[:space:]]'
      )
    )
  );

-- --------------------------------------------------------------------------
-- 2) app_state: lettura delle chiavi riservate ai soli manager.
-- --------------------------------------------------------------------------

-- Elenco separato da app_state_key_amministrativa (0011) e piu' corto: quello
-- dice chi puo' SCRIVERE una chiave di configurazione, questo dice chi puo'
-- vederla. Sono due domande diverse e le risposte non coincidono: il nome
-- dell'applicazione lo cambia solo un amministratore, ma deve leggerlo chiunque.
create or replace function public.app_state_key_riservata(k text)
returns boolean
language sql
immutable
as $$
  select k in (
    -- Chi ha fatto cosa nell'intera organizzazione.
    'audit-log',
    -- Mittenti, dominio e impostazioni di consegna della posta.
    'sendgrid-config',
    -- Testo dei messaggi automatici: leggerli e' il primo passo per imitarli.
    'email-templates',
    'email-attachment-settings'
  );
$$;

revoke execute on function public.app_state_key_riservata(text) from public, anon;
grant execute on function public.app_state_key_riservata(text) to authenticated, service_role;

drop policy if exists "members can read app state" on public.app_state;

create policy "members can read app state"
  on public.app_state for select
  using (
    case
      when public.app_state_key_riservata(key)
        then public.is_org_manager(organization_id)
      else public.is_org_member(organization_id)
    end
  );
