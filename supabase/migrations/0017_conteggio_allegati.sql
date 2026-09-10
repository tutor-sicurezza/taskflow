-- 0017_conteggio_allegati.sql
--
-- Quanti allegati ha un task, senza doverli leggere.
--
-- Gli allegati sono file interi in base64 dentro la colonna jsonb del task.
-- Per questo la lettura di lista ha smesso di chiederli (vedi useTasks): con
-- cinquanta allegati da 2 MB, mostrare un elenco di titoli significava
-- scaricare centoventi megabyte, a ogni ricarica e su ogni scheda aperta.
--
-- La scheda del task pero' mostra una graffetta con il numero di allegati, e
-- senza la colonna quel numero sarebbe sparito: un dato utile perso per una
-- ragione che all'utente non interessa. Una colonna calcolata lo restituisce
-- al costo di un intero per riga, e non puo' andare fuori sincrono con il
-- contenuto — la calcola Postgres a ogni scrittura, non il codice
-- dell'applicazione.
--
-- Il `case` non e' pedanteria: `jsonb_array_length` LANCIA se il valore non e'
-- un array, e in quella colonna ha scritto per anni un client che non
-- validava niente. Una sola riga malformata renderebbe la tabella impossibile
-- da aggiornare, il che sarebbe un modo notevole di rompere l'applicazione per
-- guadagnare una graffetta.

alter table public.tasks
  add column if not exists attachments_count integer
  generated always as (
    case
      when jsonb_typeof(attachments) = 'array' then jsonb_array_length(attachments)
      else 0
    end
  ) stored;

comment on column public.tasks.attachments_count is
  'Numero di allegati, calcolato da Postgres: serve alla lista dei task, che non legge la colonna attachments perche contiene i file in base64.';
