-- 0022_sottoattivita_e_dipendenze.sql
--
-- Due funzioni che cambiano la forma di un task: la sua lista di passi, e i
-- legami con gli altri task.

-- ---------------------------------------------------------------------------
-- 1) Le sottoattivita' come elenco dentro il task, non come task figli.
--
-- La scelta pesa, quindi la si scrive: un task figlio a tutti gli effetti —
-- con assegnatario, scadenza, stato, notifiche — avrebbe voluto dire che ogni
-- conteggio, ogni filtro, ogni grafico e ogni promemoria dell'applicazione
-- dovesse decidere se guardare anche i figli. Sei viste e quattro lavori
-- pianificati, tutti da rivedere, per una funzione che nella pratica serve a
-- spuntare i passi di un lavoro solo.
--
-- Qui una sottoattivita' e' un passo: un testo e una spunta. Se un passo ha
-- bisogno di un assegnatario e di una scadenza propri, allora e' un task, e
-- l'applicazione sa gia' crearlo — con le dipendenze del punto 2 si puo' anche
-- dire che quello viene prima di questo.
--
-- JSONB e non una tabella: i passi si leggono e si scrivono SEMPRE insieme al
-- task che li contiene, non esiste una vista "tutti i passi di tutti" e non ci
-- sono query che li cerchino per conto loro. Una tabella avrebbe aggiunto una
-- join a ogni lettura e due policy RLS da tenere allineate a quelle dei task,
-- per nessun vantaggio.

alter table public.tasks
  add column if not exists subtasks jsonb not null default '[]'::jsonb;

-- Un array e non un oggetto: l'ordine dei passi e' informazione, e in un
-- oggetto JSON l'ordine delle chiavi non e' garantito.
alter table public.tasks
  drop constraint if exists tasks_subtasks_array;

alter table public.tasks
  add constraint tasks_subtasks_array
  check (jsonb_typeof(subtasks) = 'array');

-- ---------------------------------------------------------------------------
-- 2) Le dipendenze: quali task devono chiudersi prima di questo.
--
-- `blocked_by` contiene gli id dei task che bloccano QUESTO. La direzione e'
-- quella, e non il contrario, perche' e' la domanda che si fa chi guarda un
-- task fermo: "perche' non posso andare avanti?". Girata — "quali task blocco
-- io" — avrebbe richiesto di leggere tutti gli altri per rispondere.
--
-- Array e non tabella di legami, per coerenza con `watchers`, che e' gia'
-- `uuid[]` e ha lo stesso identico profilo d'uso. Il prezzo dell'array e' che
-- Postgres non puo' garantire l'integrita' referenziale: lo compensa il
-- trigger qui sotto.

alter table public.tasks
  add column if not exists blocked_by uuid[] not null default '{}'::uuid[];

-- Un task non puo' bloccare se stesso. I cicli piu' lunghi (A blocca B blocca
-- A) qui non si possono vedere — servirebbe una ricorsione a ogni scrittura —
-- e li impedisce l'applicazione, che al momento di aggiungere un legame ha in
-- mano tutti i task e puo' cercare il ciclo prima di crearlo.
alter table public.tasks
  drop constraint if exists tasks_non_blocca_se_stesso;

alter table public.tasks
  add constraint tasks_non_blocca_se_stesso
  check (not (blocked_by @> array[id]));

-- Trovare "cosa blocca questo" e' immediato (e' una colonna). Trovare "cosa
-- blocco io" richiede di cercare dentro gli array altrui: senza indice e'
-- una scansione della tabella a ogni apertura di un task.
create index if not exists tasks_blocked_by_idx
  on public.tasks using gin (blocked_by);

-- ---------------------------------------------------------------------------
-- 3) Un task cancellato sparisce anche dalle dipendenze degli altri.
--
-- E' la parte che un array non sa fare da solo. Senza, cancellare un task
-- lascerebbe il suo id dentro `blocked_by` di chi lo aspettava: quei task
-- resterebbero bloccati per sempre da qualcosa che non esiste piu', e nessuno
-- potrebbe sbloccarli perche' l'interfaccia non ha niente da mostrare.
--
-- `security definer` perche' il trigger deve poter modificare righe che chi
-- cancella potrebbe non avere il permesso di toccare: sta togliendo un
-- riferimento rotto, non cambiando il lavoro di qualcun altro.

create or replace function public.pulisci_dipendenze_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tasks
     set blocked_by = array_remove(blocked_by, old.id)
   where blocked_by @> array[old.id];
  return old;
end;
$$;

drop trigger if exists task_pulisci_dipendenze on public.tasks;

create trigger task_pulisci_dipendenze
  after delete on public.tasks
  for each row
  execute function public.pulisci_dipendenze_task();
