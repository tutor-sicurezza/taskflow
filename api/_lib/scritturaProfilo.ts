/**
 * Il messaggio che l'amministratore legge quando i campi anagrafici di un
 * membro non sono stati scritti.
 *
 * ## La storia, perche' e' la parte utile
 *
 * `POST /api/tenants/:id/members` ha sbagliato tre volte la stessa cosa, in
 * tre modi diversi:
 *
 * 1. la scrittura del profilo stava PRIMA del controllo sull'appartenenza:
 *    mandare l'email di un dipendente altrui lo rendeva membro qui e poi
 *    disattivabile ovunque;
 * 2. spostare il controllo dopo l'upsert chiudeva la scrittura ma lasciava
 *    passare **l'appartenenza**, rispondendo `403`. Un accesso concesso e
 *    dichiarato fallito: chi lo provoca non sa di averlo dato (Codex, PR #11);
 * 3. leggere e poi scrivere, in due viaggi, lasciava una finestra fra i due
 *    (Codex, PR #15).
 *
 * Dalla migrazione 0032 la decisione non e' piu' in TypeScript: il controllo
 * "questa persona e' solo nostra" sta nel `where` dello stesso `update`, dentro
 * `aggiorna_profilo_se_solo_nostro`. Qui resta solo cio' che il database non
 * puo' dare, cioe' la frase da mostrare.
 *
 * Qui viveva anche `decidiScritturaProfilo`, che prendeva quella decisione in
 * TypeScript. E' stata tolta quando la decisione e' scesa nel database: una
 * funzione con i suoi test, che nessuno chiama piu', e' peggio di niente —
 * chi legge crede che sia lei a decidere.
 */

/*
  Il testo parla SOLO del profilo, e non dice "aggiunto" ne' "aggiornato".

  La stessa rotta serve due gesti diversi — invitare qualcuno e modificarne
  l'anagrafica — e un avviso che ne raccontasse uno sarebbe falso nell'altro.
  A dire cosa e' riuscito ci pensa chi chiama, che sa quale dei due stava
  facendo; qui si dice solo cosa NON e' stato fatto, e perche'.
*/
export const AVVISO_PROFILO_ALTROVE =
  'I dati anagrafici non sono stati modificati: questa persona appartiene ' +
  'anche ad altre organizzazioni, e il suo profilo vale in tutte.';
