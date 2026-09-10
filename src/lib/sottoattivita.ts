/**
 * I passi di un task: le regole, senza React e senza database.
 *
 * Una sottoattivita' e' un passo — un testo e una spunta — e non un task
 * figlio. La ragione sta per esteso nella migrazione 0022 e in `types.ts`, e
 * questo file la rispetta fino in fondo: qui dentro non esistono assegnatario,
 * scadenza, stato, notifiche. Se un passo ha bisogno di quelle cose e' un
 * task, e l'applicazione sa gia' crearlo.
 *
 * Due problemi giustificano un modulo a parte invece di qualche riga dentro il
 * componente.
 *
 * Il primo e' la FIDUCIA nel dato. I passi vivono in una colonna JSONB, quindi
 * quello che torna dal database non e' garantito essere quello che ci abbiamo
 * scritto — una versione precedente dell'app, un import, una modifica a mano.
 * `sottoattivitaValide` e' l'unica porta d'ingresso, non lancia mai, e al
 * massimo scarta cio' che non capisce. E' lo stesso mestiere che
 * `filtriSalvati.ts` fa per l'altra colonna JSONB, ed e' scritto nello stesso
 * modo di proposito.
 *
 * Il secondo e' che le operazioni devono essere PURE. L'elenco e' il valore di
 * un componente controllato che sta dentro un dialogo: modificarlo sul posto
 * significherebbe che React non vede il cambiamento (stesso riferimento,
 * nessun render) e che annullare il dialogo lascerebbe comunque l'array del
 * task gia' modificato. Ogni funzione qui restituisce un array NUOVO — tranne
 * quando non c'e' niente da cambiare, e allora restituisce quello ricevuto:
 * cosi' "non e' successo niente" e' visibile con un confronto di riferimenti e
 * non fa scattare un salvataggio inutile.
 */

import { newId } from '@/lib/utils';
import type { Sottoattivita } from '@/lib/types';

/**
 * Quanti passi al massimo in un task.
 *
 * Non e' un limite tecnico — il JSONB ne reggerebbe migliaia — ma il punto in
 * cui la funzione smette di essere quella che si voleva. Una lista di spunte
 * serve a vedere a colpo d'occhio quanto manca; oltre una cinquantina di righe
 * non si guarda piu' a colpo d'occhio, si scorre, e quello che serviva era un
 * piano di lavoro vero, cioe' altri task.
 *
 * Il tetto vale in SCRITTURA e non in lettura. Troncare in lettura sarebbe
 * stato piu' coerente, e sbagliato: un elenco arrivato piu' lungo — da un
 * import, o da una versione futura con un tetto piu' alto — perderebbe dei
 * passi in silenzio, e li perderebbe per sempre al primo salvataggio
 * successivo. Un elenco troppo lungo si legge male; un elenco a cui mancano
 * righe che nessuno ha tolto e' peggio.
 */
export const MAX_SOTTOATTIVITA = 50;

/**
 * Lunghezza massima del testo di un passo.
 *
 * Stessa logica delle etichette: tagliare qui invece che nella CSS significa
 * che il valore SALVATO e quello mostrato coincidono, quindi nessuno scrive un
 * paragrafo convinto che si veda tutto. Duecento caratteri sono una riga di
 * istruzione lunga; oltre, e' la descrizione del task, che esiste gia'.
 */
export const MAX_LUNGHEZZA_PASSO = 200;

/**
 * Tetto agli identificatori letti dal database.
 *
 * Non e' paranoia sul contenuto ma sulla DIMENSIONE: un JSONB puo' contenere
 * una stringa da un megabyte, e un id del genere finirebbe dentro una chiave
 * React e dentro ogni confronto di questo file.
 */
const MAX_LUNGHEZZA_ID = 200;

/**
 * Forma canonica del testo di un passo.
 *
 * Gli spazi interni si comprimono prima del taglio: "compila   il modulo" e
 * "compila il modulo" sono lo stesso passo, e vederli come due righe diverse
 * in un elenco di spunte e' solo un modo di far dubitare chi legge.
 * A differenza delle etichette le maiuscole si tengono: qui non c'e' nessun
 * vocabolario condiviso da difendere, il testo e' una frase e va letta come
 * chi l'ha scritta l'ha pensata.
 */
export function normalizzaPasso(testo: string): string {
  if (typeof testo !== 'string') return '';
  return testo
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LUNGHEZZA_PASSO)
    // Il taglio puo' cadere su uno spazio e lasciarlo in coda.
    .trim();
}

/** Una stringa non vuota e di lunghezza ragionevole, oppure `undefined`. */
function testo(valore: unknown, massimo: number): string | undefined {
  if (typeof valore !== 'string') return undefined;
  const pulito = valore.trim().slice(0, massimo);
  return pulito === '' ? undefined : pulito;
}

/**
 * Una data come stringa, oppure null.
 *
 * Vale la regola di `scadenze.ts`: una data che non si interpreta diventa
 * null, non "Invalid Date" in mezzo all'interfaccia, e non una data finta.
 */
function istante(valore: unknown): string | null {
  const grezzo = testo(valore, MAX_LUNGHEZZA_ID);
  if (grezzo === undefined) return null;
  return Number.isNaN(new Date(grezzo).getTime()) ? null : grezzo;
}

/**
 * Un passo se e' un passo, altrimenti null. Non lancia mai.
 *
 * Servono `id` e `title`: senza id nessuna operazione successiva potrebbe
 * colpirlo, e senza testo sarebbe una riga vuota che si puo' solo spuntare
 * senza sapere cosa si sta dichiarando fatto.
 */
function passoValido(valore: unknown): Sottoattivita | null {
  if (typeof valore !== 'object' || valore === null || Array.isArray(valore)) return null;

  const grezzo = valore as Record<string, unknown>;
  const id = testo(grezzo.id, MAX_LUNGHEZZA_ID);
  const title = normalizzaPasso(typeof grezzo.title === 'string' ? grezzo.title : '');
  if (id === undefined || title === '') return null;

  // `done` diverso da un booleano vale "non fatto", non "scarta la riga":
  // il testo resta utile, e fra i due errori possibili mostrare come da fare
  // qualcosa di gia' fatto e' quello che si corregge con un clic, mentre
  // l'opposto fa dichiarare finito un lavoro che nessuno ha svolto.
  const done = grezzo.done === true;

  // `createdAt` non si inventa: se manca o non e' una data, resta vuoto e chi
  // volesse mostrarlo sa che non lo sappiamo. Una data surrogata (adesso,
  // oppure l'epoca) sarebbe indistinguibile da una vera.
  const createdAt = istante(grezzo.createdAt) ?? '';

  const passo: Sottoattivita = { id, title, done, createdAt };

  // Chi e quando solo se il passo e' davvero fatto: un `doneBy` su una riga
  // non spuntata e' una contraddizione arrivata dal dato grezzo, e lasciarla
  // passare significherebbe mostrare "fatto da Anna" sotto una casella vuota.
  if (done) {
    passo.doneAt = istante(grezzo.doneAt);
    passo.doneBy = testo(grezzo.doneBy, MAX_LUNGHEZZA_ID) ?? null;
  }

  return passo;
}

/**
 * L'elenco dei passi letto dal database, ripulito. Non lancia mai.
 *
 * Quello che non e' un array diventa un elenco vuoto: un task senza passi e un
 * task il cui campo e' rotto si comportano allo stesso modo, cioe' come un
 * task normale.
 *
 * Gli id ripetuti sono l'unico caso in cui si butta via una riga leggibile. Un
 * id che compare due volte vuol dire che spuntare, rinominare o eliminare ne
 * colpirebbe due insieme, e che React userebbe la stessa chiave per due righe:
 * il doppione non e' recuperabile qui, perche' assegnargli un id nuovo
 * renderebbe il risultato diverso a ogni lettura dello stesso identico dato.
 */
export function sottoattivitaValide(valore: unknown): Sottoattivita[] {
  if (!Array.isArray(valore)) return [];

  const visti = new Set<string>();
  const elenco: Sottoattivita[] = [];

  for (const grezzo of valore) {
    const passo = passoValido(grezzo);
    if (!passo || visti.has(passo.id)) continue;
    visti.add(passo.id);
    elenco.push(passo);
  }

  return elenco;
}

/**
 * Quanti passi sono fatti su quanti, e a che punto e' la barra.
 *
 * `percentuale` e' `null` — non zero — quando i passi non ci sono. "Nessun
 * passo" non e' "0% fatto": un task senza lista di spunte non e' un task
 * appena iniziato, e chi disegna la barra deve poter scegliere di non
 * disegnarla affatto invece di mostrare una barra vuota che accusa.
 */
export interface Avanzamento {
  fatte: number;
  totale: number;
  /** 0-100, oppure null se non ci sono passi. */
  percentuale: number | null;
}

export function avanzamento(elenco: Sottoattivita[] | null | undefined): Avanzamento {
  const passi = elenco ?? [];
  const totale = passi.length;
  const fatte = passi.reduce((somma, passo) => somma + (passo?.done ? 1 : 0), 0);

  if (totale === 0) return { fatte: 0, totale: 0, percentuale: null };

  // Gli estremi non si arrotondano: con quaranta passi e uno solo fatto
  // l'arrotondamento darebbe 3%, ma con duecento darebbe 0% — una barra vuota
  // su un lavoro iniziato. Specularmente 99,6% non deve diventare 100 finche'
  // un passo manca: "tutto fatto" e' un'informazione, non una cifra tonda.
  if (fatte === 0) return { fatte, totale, percentuale: 0 };
  if (fatte === totale) return { fatte, totale, percentuale: 100 };

  const grezza = Math.round((fatte / totale) * 100);
  return { fatte, totale, percentuale: Math.min(99, Math.max(1, grezza)) };
}

/** Vero se non si puo' aggiungere altro: serve a spiegarlo prima, non dopo. */
export function elencoPieno(elenco: Sottoattivita[] | null | undefined): boolean {
  return (elenco ?? []).length >= MAX_SOTTOATTIVITA;
}

/**
 * Un passo in fondo all'elenco.
 *
 * In fondo e non in cima: chi scrive una lista di passi la scrive nell'ordine
 * in cui li fara', e vedere l'ultimo scritto scavalcare tutti gli altri
 * costringerebbe a riordinare a ogni riga.
 *
 * Un testo vuoto o di soli spazi non aggiunge niente e non e' un errore: e'
 * l'Invio a vuoto di chi ha finito di scrivere la lista.
 *
 * `opzioni` esiste per i test: l'id e l'istante sono le uniche due cose non
 * deterministiche di questo file, e poterle fissare evita di dover falsificare
 * l'orologio globale per verificare una regola che non parla di tempo.
 */
export function aggiungiSottoattivita(
  elenco: Sottoattivita[],
  titolo: string,
  opzioni: { id?: string; adesso?: string } = {}
): Sottoattivita[] {
  const passi = elenco ?? [];
  const title = normalizzaPasso(titolo);
  if (title === '' || elencoPieno(passi)) return passi;

  return [
    ...passi,
    {
      id: opzioni.id ?? newId('passo'),
      title,
      done: false,
      createdAt: opzioni.adesso ?? new Date().toISOString(),
    },
  ];
}

/**
 * Il nuovo testo di un passo.
 *
 * Svuotare il testo non cancella il passo: sono due gesti diversi, e chi
 * seleziona tutto e preme Canc mentre riscrive una riga non si aspetta di
 * vederla sparire. Il passo resta com'era e chi vuole eliminarlo ha il
 * pulsante apposta.
 */
export function rinominaSottoattivita(
  elenco: Sottoattivita[],
  id: string,
  titolo: string
): Sottoattivita[] {
  const passi = elenco ?? [];
  const title = normalizzaPasso(titolo);
  if (title === '') return passi;

  let cambiato = false;
  const nuovo = passi.map((passo) => {
    if (passo.id !== id || passo.title === title) return passo;
    cambiato = true;
    return { ...passo, title };
  });

  return cambiato ? nuovo : passi;
}

/**
 * Spunta o despunta un passo, registrando chi e quando.
 *
 * Despuntare cancella `doneAt` e `doneBy` invece di conservarli: tenerli
 * significherebbe che la riga porta il nome di chi l'aveva chiusa mentre e'
 * di nuovo da fare, e la cronologia di chi ha fatto cosa non e' compito di
 * questo elenco — sta nelle attivita' del task.
 *
 * `chi` puo' mancare (utente non ancora caricato): allora si registra il
 * quando e non il chi, che e' esattamente quello che si sa.
 */
export function spuntaSottoattivita(
  elenco: Sottoattivita[],
  id: string,
  fatta: boolean,
  chi?: string | null,
  adesso?: string
): Sottoattivita[] {
  const passi = elenco ?? [];

  let cambiato = false;
  const nuovo = passi.map((passo) => {
    if (passo.id !== id || passo.done === fatta) return passo;
    cambiato = true;
    return fatta
      ? {
          ...passo,
          done: true,
          doneAt: adesso ?? new Date().toISOString(),
          doneBy: chi ?? null,
        }
      : { ...passo, done: false, doneAt: null, doneBy: null };
  });

  return cambiato ? nuovo : passi;
}

/** Elimina un passo. Un id che non esiste non e' un errore: non cambia niente. */
export function eliminaSottoattivita(elenco: Sottoattivita[], id: string): Sottoattivita[] {
  const passi = elenco ?? [];
  const nuovo = passi.filter((passo) => passo.id !== id);
  return nuovo.length === passi.length ? passi : nuovo;
}

/**
 * Sposta il passo dalla posizione `da` alla posizione `a`.
 *
 * Gli indici fuori dai limiti non si correggono avvicinandoli al bordo: chi
 * chiede di spostare piu' in su del primo sta premendo un pulsante che non
 * doveva essere premibile, e "non succede niente" e' l'unica risposta che non
 * riordina la lista in un modo che nessuno ha chiesto.
 */
export function spostaSottoattivita(
  elenco: Sottoattivita[],
  da: number,
  a: number
): Sottoattivita[] {
  const passi = elenco ?? [];
  const dentro = (i: number) => Number.isInteger(i) && i >= 0 && i < passi.length;
  if (!dentro(da) || !dentro(a) || da === a) return passi;

  const nuovo = [...passi];
  const [passo] = nuovo.splice(da, 1);
  nuovo.splice(a, 0, passo);
  return nuovo;
}
