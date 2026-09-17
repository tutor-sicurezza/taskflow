-- 0026_confini_creazione_e_dipendenze.sql
--
-- Tre buchi lasciati aperti dalla 0024 e dalla 0025. Sono tutti della stessa
-- forma: una regola scritta nella rotta serverless e non replicata nel posto
-- che avrebbe dovuto farle da rete.
--
-- ---------------------------------------------------------------------------
-- 1) La sottoquery della 0025 non si ferma al confine dell'organizzazione.
--
-- Il trigger e' `security definer` e nessuna tabella ha `force row level
-- security`, quindi quella select vede TUTTI i task del progetto. Il client,
-- invece, considera "riferimento rotto, non blocca" qualunque id che non trova
-- fra i propri (`riferimentiValidi` in src/lib/dipendenze.ts), e fra i propri
-- ci sono solo quelli della sua organizzazione. Le due definizioni di
-- "bloccante" divergono esattamente sugli id di fuori.
--
-- Nessuno valida `blocked_by` in UPDATE: `taskToRow` la scrive e basta, la
-- 0024 e' una policy di sola insert. Quindi chi conosce un uuid di un'altra
-- organizzazione se lo mette fra i propri bloccanti, prova a completare, e si
-- porta a casa il messaggio 'Prima vanno chiuse: <titolo altrui>' — titolo di
-- un'attivita' che non ha nessun diritto di vedere, piu' l'informazione che e'
-- ancora aperta. Ripetibile a piacere come oracolo.
--
-- Oltre alla fuga c'e' il blocco: l'interfaccia mostra il pulsante attivo (per
-- lei quel riferimento non blocca) e l'unico modo di sbloccarsi — togliere la
-- dipendenza — non e' raggiungibile, perche' il selettore non sa mostrare un
-- bloccante che non ha in elenco.
--
-- ---------------------------------------------------------------------------
-- 2) La regola dei bloccanti valeva solo in UPDATE: si nasceva gia' completati.
--
-- La 0025 e' `before update`. Un POST diretto a PostgREST con
-- `status = 'completed'` e `blocked_by` pieno di attivita' aperte non la
-- incontra mai, e l'invariante nasce violata. Qui il trigger passa a
-- `before insert or update`: e' un'invariante sui dati, non un'autorizzazione,
-- quindi come nella 0025 vale ANCHE per il service role.
--
-- ---------------------------------------------------------------------------
-- 3) La 0024 non impedisce di dichiararsi figli di una serie ricorrente.
--
-- `api/_lib/nuovoTask.ts` rifiuta `recurrence_parent` e `archived_at` in
-- creazione, con tanto di commento che spiega il rischio; la policy che
-- dovrebbe fare da rete non li guarda. Il danno non e' teorico: un membro fa
-- un insert con `recurrence_parent` = la capostipite di "Controllo estintori",
-- e al giro successivo `api/cron/ricorrenze.ts` trova una "figlia aperta" e
-- SMETTE di rigenerare il controllo mensile. Risponde 200, con un contatore
-- che non guarda nessuno: un adempimento periodico sparisce in silenzio.
--
-- Le occorrenze vere le crea il cron con il service role, che scavalca le
-- policy, quindi non ne e' toccato.
--
-- ---------------------------------------------------------------------------
-- Conseguenza da sapere, la stessa che gia' vale per la 0024 e la 0025: il
-- ripristino di un backup fatto con il token di un amministratore diventa
-- ancora piu' stretto (niente righe archiviate, niente occorrenze di serie).
-- Oggi quel ripristino non funziona comunque, per un motivo che precede
-- queste policy: `attachments_count` e' una colonna generata (0017) e il
-- backup la rimanda indietro, cosa che Postgres rifiuta. Va rifatto, non
-- protetto.

-- ---------------------------------------------------------------------------
-- 1) e 2): la funzione della 0025, con il confine e con l'insert.
-- ---------------------------------------------------------------------------

create or replace function public.task_regole_stato()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bloccanti text;
  stato_precedente text := null;
begin
  -- In un trigger di INSERT `old` non esiste: leggerlo solleva un errore.
  -- Il valore nullo e' anche semanticamente giusto — non c'era uno stato
  -- prima — e fa scattare il controllo su una riga che nasce completata.
  if tg_op = 'UPDATE' then
    stato_precedente := old.status;
  end if;

  -- -------------------------------------------------------------------------
  -- 1) Non si completa un'attivita' che ne aspetta altre.
  --
  -- Solo sul PASSAGGIO a "completata": un'attivita' gia' chiusa che viene
  -- modificata per altri motivi non deve essere ricontrollata, altrimenti un
  -- bloccante riaperto renderebbe impossibile perfino cambiarle il titolo.
  --
  -- "Aperto" e' la stessa definizione del client (`eChiusoDavvero`): chiuso
  -- significa completato E, se il visto lo richiede, vistato. Un lavoro che
  -- aspetta un'approvazione e' ancora lavoro aperto, e quindi blocca.
  --
  -- Un id che non corrisponde a nessuna attivita' NON blocca: e' la stessa
  -- scelta di `riferimentiValidi`, perche' un riferimento rotto lascerebbe
  -- l'attivita' ferma per sempre dietro qualcosa che non si puo' chiudere.
  --
  -- E un id di un'ALTRA organizzazione conta come riferimento rotto, non come
  -- bloccante: e' cio' che vede il client, ed e' l'unica lettura che non
  -- lasci trapelare di fuori il titolo e lo stato di un'attivita' altrui.
  if new.status = 'completed' and stato_precedente is distinct from 'completed' then
    select string_agg(b.title, ', ' order by b.title)
      into bloccanti
    from public.tasks b
    where b.id = any(new.blocked_by)
      and b.organization_id = new.organization_id
      and not (
        b.status = 'completed'
        and (
          b.requires_approval is not true
          or (b.approved_by is not null and b.approved_at is not null)
        )
      );

    -- Si DICE quali sono, come fa l'interfaccia: "non puoi" senza il motivo
    -- manda a cercare, e chi cerca finisce per togliere la dipendenza invece
    -- di chiudere il lavoro che aspettava.
    if bloccanti is not null then
      raise exception 'Prima vanno chiuse: %', bloccanti;
    end if;
  end if;

  -- -------------------------------------------------------------------------
  -- 2) Il cambio di stato azzera il visto precedente.
  --
  -- Solo in UPDATE: in creazione un visto non puo' essere "stantio", e chi
  -- prova a farne nascere uno lo ferma gia' il trigger della 0023.
  --
  -- Si azzera e basta, senza rifiutare: riaprire un lavoro e' un gesto
  -- legittimo, quello che non deve sopravvivere e' l'approvazione di prima.
  --
  -- La condizione sull'ultima riga lascia passare il caso in cui chi scrive
  -- sta CONCEDENDO un visto nella stessa operazione in cui cambia lo stato:
  -- quello lo ha gia' validato il trigger della 0023 (responsabile, non
  -- l'assegnatario, firmato da se'). Qui si toglie solo il visto STANTIO,
  -- cioe' quello che era gia' li' e che il chiamante si e' limitato a
  -- rimandare indietro insieme al resto della riga.
  if tg_op = 'UPDATE'
     and new.requires_approval is true
     and new.status is distinct from old.status
     and (old.approved_by is not null or old.approved_at is not null)
     and new.approved_by is not distinct from old.approved_by
     and new.approved_at is not distinct from old.approved_at then
    new.approved_by := null;
    new.approved_at := null;
  end if;

  return new;
end;
$$;

-- Il nome viene dopo `task_approvazione_valida` e `task_campi_immutabili` in
-- ordine alfabetico, ed e' l'ordine in cui Postgres esegue i trigger BEFORE
-- con lo stesso evento. E' quello che serve: prima la 0023 valuta i valori
-- cosi' come sono arrivati dal chiamante, poi qui si azzera il visto stantio.
drop trigger if exists task_regole_stato on public.tasks;

create trigger task_regole_stato
  before insert or update on public.tasks
  for each row
  execute function public.task_regole_stato();

-- ---------------------------------------------------------------------------
-- 3): la policy della 0024, con i due confini che mancavano.
-- ---------------------------------------------------------------------------

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

    -- Le occorrenze di una serie ricorrente le crea il cron, col service
    -- role. Nessuno che passi di qui puo' dichiararsi figlio di una serie:
    -- basterebbe a farla smettere di rigenerarsi, senza errori per nessuno.
    and recurrence_parent is null

    -- E niente nasce gia' archiviato: l'archiviazione e' il risultato di un
    -- lavoro chiuso da trenta giorni, non uno stato iniziale.
    and archived_at is null
  );
