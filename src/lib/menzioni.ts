import type { Employee } from '@/lib/types';

/**
 * Rilevamento delle menzioni `@Nome Cognome` nei commenti.
 *
 * Il tipo di notifica `mention` esisteva gia' ovunque (icona, suono,
 * preferenza, template email in cinque lingue) ma nessuno lo generava, perche'
 * mancava del tutto il pezzo che riconosce chi e' stato menzionato.
 *
 * La difficolta' e' che i nomi delle persone contengono spazi: una regex tipo
 * `@\w+` catturerebbe solo "Marco" di "@Marco Bianchi", e qualunque tentativo
 * di indovinare dove finisce un nome sbaglia sulle frasi reali ("@Marco puoi
 * guardare?"). Per questo qui non si prova a interpretare il testo: si cercano
 * dentro il testo i nomi degli `employees` che esistono davvero.
 */

/**
 * Un nome puo' iniziare solo se la `@` non e' attaccata a lettere o cifre:
 * serve a non scambiare `mario@azienda.it` per una menzione di Mario.
 */
function confineValidoPrima(testo: string, posizioneChiocciola: number): boolean {
  if (posizioneChiocciola === 0) return true;
  const precedente = testo[posizioneChiocciola - 1];
  return !/[\p{L}\p{N}]/u.test(precedente);
}

/**
 * Simmetrico al precedente: "@Marco Bianchi" non deve essere riconosciuto
 * dentro "@Marco Bianchini", altrimenti si notifica la persona sbagliata.
 */
function confineValidoDopo(testo: string, posizioneFine: number): boolean {
  if (posizioneFine >= testo.length) return true;
  return !/[\p{L}\p{N}]/u.test(testo[posizioneFine]);
}

/** Oltre questa lunghezza si smette di considerare la `@` un completamento
 * ancora aperto: senza un limite l'elenco resterebbe attaccato al cursore per
 * tutto il resto del commento. */
const MAX_CARATTERI_PARZIALE = 30;

/** Piu' di cinque voci trasformano l'aiuto alla scrittura in un ostacolo. */
const MAX_CANDIDATI = 5;

/** Gli id delle persone menzionate nel testo, senza ripetizioni. */
export function trovaMenzioni(testo: string, employees: Employee[]): string[] {
  if (!testo || employees.length === 0) return [];

  const testoMinuscolo = testo.toLowerCase();

  // Dal nome piu' lungo al piu' corto: altrimenti un collega di nome "Marco"
  // consumerebbe la `@` di "@Marco Bianchi" e il match piu' specifico non
  // avverrebbe mai.
  const perLunghezzaDecrescente = [...employees]
    .filter((persona) => persona.name.trim().length > 0)
    .sort((a, b) => b.name.length - a.name.length);

  // Le posizioni gia' assegnate a una menzione: impedisce che un nome piu'
  // corto venga ritrovato dentro il tratto di testo di uno piu' lungo.
  const occupate = new Array<boolean>(testo.length).fill(false);
  const idTrovati: string[] = [];

  for (const persona of perLunghezzaDecrescente) {
    const bersaglio = `@${persona.name.toLowerCase()}`;
    let da = 0;

    while (da <= testoMinuscolo.length - bersaglio.length) {
      const posizione = testoMinuscolo.indexOf(bersaglio, da);
      if (posizione === -1) break;

      const fine = posizione + bersaglio.length;
      const liberoDaAltreMenzioni = !occupate
        .slice(posizione, fine)
        .some(Boolean);

      if (
        liberoDaAltreMenzioni &&
        confineValidoPrima(testo, posizione) &&
        confineValidoDopo(testo, fine)
      ) {
        for (let i = posizione; i < fine; i++) occupate[i] = true;
        if (!idTrovati.includes(persona.id)) idTrovati.push(persona.id);
      }

      da = posizione + 1;
    }
  }

  return idTrovati;
}

/** I candidati per il completamento, dato cio' che l'utente ha digitato dopo la @. */
export function candidatiMenzione(parziale: string, employees: Employee[]): Employee[] {
  const cercato = parziale.trim().toLowerCase();

  // Appena digitata la `@` non c'e' ancora nulla da filtrare: si mostrano i
  // primi nomi invece di un elenco vuoto.
  if (cercato.length === 0) return employees.slice(0, MAX_CANDIDATI);

  return employees
    .filter((persona) => {
      const nome = persona.name.toLowerCase();
      const email = (persona.email ?? '').toLowerCase();
      return nome.includes(cercato) || email.includes(cercato);
    })
    .slice(0, MAX_CANDIDATI);
}

/** La @parziale che l'utente sta scrivendo in questo momento, o null. */
export function menzioneInCorso(
  testo: string,
  posizioneCursore: number
): { parziale: string; inizio: number } | null {
  const cursore = Math.max(0, Math.min(posizioneCursore, testo.length));

  for (let i = cursore - 1; i >= 0; i--) {
    const carattere = testo[i];

    // Una menzione non attraversa un a capo: se l'utente e' andato a riga
    // nuova, la `@` di prima non e' piu' quella che sta scrivendo.
    if (carattere === '\n') return null;

    if (carattere === '@') {
      if (!confineValidoPrima(testo, i)) return null;
      const parziale = testo.slice(i + 1, cursore);
      if (parziale.length > MAX_CARATTERI_PARZIALE) return null;
      return { parziale, inizio: i };
    }

    // Senza questo limite si risalirebbe fino all'inizio del commento.
    if (cursore - i > MAX_CARATTERI_PARZIALE) return null;
  }

  return null;
}

/** Sostituisce nel testo la @parziale in corso con la menzione completa scelta. */
export function completaMenzione(
  testo: string,
  posizioneCursore: number,
  scelto: Employee
): { testo: string; nuovaPosizione: number } {
  const cursore = Math.max(0, Math.min(posizioneCursore, testo.length));
  const inCorso = menzioneInCorso(testo, cursore);

  // Lo spazio finale serve a due cose: separa la menzione dalla parola dopo
  // (il confine di fine nome) e lascia il cursore pronto per continuare a
  // scrivere.
  const menzione = `@${scelto.name} `;

  // Senza una `@` aperta non c'e' nulla da sostituire: si inserisce al
  // cursore, cosi' il click su un candidato non perde mai il testo.
  const inizio = inCorso ? inCorso.inizio : cursore;

  const prima = testo.slice(0, inizio);
  const dopo = testo.slice(cursore);

  return {
    testo: prima + menzione + dopo,
    nuovaPosizione: inizio + menzione.length,
  };
}
