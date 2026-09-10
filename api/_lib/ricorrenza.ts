/**
 * Le regole di ricorrenza, senza database attorno.
 *
 * Sta in `_lib` per lo stesso motivo di `promemoriaLogica.ts`: `api/cron/` e'
 * instradata da Vercel e ogni file li' dentro diventa un endpoint pubblico,
 * test compresi. Il trattino basso esclude questa cartella dal routing.
 *
 * Qui c'e' l'unico punto del progetto che sa COSA vuol dire "ogni due mesi":
 * il lavoro pianificato lo usa per generare le occorrenze, l'interfaccia per
 * descrivere all'utente cosa ha scelto. Averne due copie significherebbe che
 * la frase mostrata e la data creata prima o poi non coincidono piu'.
 */

/*
 * Nessun import da `src/`, ed e' voluto: come in `modelliEmail.ts`, questo
 * modulo lo usano sia l'interfaccia sia le funzioni del server, e i due lati
 * non condividono gli alias dei percorsi. Il tipo qui sotto ripete di
 * proposito l'interfaccia definita in `src/lib/types.ts`: e' strutturalmente
 * identica, quindi il compilatore verifica comunque che le due restino
 * allineate nel punto in cui si incontrano (il componente che le usa
 * entrambe).
 */

export type TipoRicorrenza = 'giorni' | 'settimane' | 'mesi';

export interface RegolaRicorrenza {
  tipo: TipoRicorrenza;
  /** Ogni quanti giorni/settimane/mesi. */
  ogni: number;
  /** Solo per `settimane`: 0 = domenica. Vuoto significa "lo stesso giorno". */
  giorniSettimana?: number[];
  /** Data oltre la quale la serie non si rinnova piu'. */
  fine?: string | null;
}

export type LinguaRicorrenza = 'it' | 'en' | 'fr' | 'de' | 'es';

const LINGUA_PREDEFINITA: LinguaRicorrenza = 'it';

/**
 * Tetto all'intervallo accettato.
 *
 * Non e' un limite di prodotto ma una cintura: `ogni` arriva da una colonna
 * jsonb e da un campo numerico dell'interfaccia. Un 999999 li' dentro
 * produrrebbe date nell'anno 84000 — che Postgres accetta pure — e nessuno se
 * ne accorgerebbe finche' un elenco non mostra una scadenza assurda. Sessanta
 * unita' bastano a qualunque controllo periodico reale: due mesi di giorni,
 * poco piu' di un anno di settimane, cinque anni di mesi.
 */
const OGNI_MASSIMO = 60;

const TIPI: readonly TipoRicorrenza[] = ['giorni', 'settimane', 'mesi'];

// ---------------------------------------------------------------------------
// Validazione
// ---------------------------------------------------------------------------

/**
 * Interpreta un valore qualunque come regola, o restituisce null.
 *
 * Il valore arriva da `tasks.recurrence`, che e' `jsonb`: puo' contenere
 * letteralmente qualsiasi cosa — un numero, `true`, un oggetto scritto da una
 * versione precedente, o l'esito di un import fatto a mano. Questa funzione
 * non lancia MAI: e' chiamata dentro il ciclo del lavoro pianificato, dove
 * un'eccezione su una riga malformata bloccherebbe il rinnovo di tutte le
 * altre serie dell'organizzazione.
 */
export function regolaValida(valore: unknown): RegolaRicorrenza | null {
  try {
    // Tollera anche la stringa: un jsonb letto come testo, o un valore
    // salvato con un JSON.stringify di troppo, e' un caso che si vede.
    const grezzo = typeof valore === 'string' ? JSON.parse(valore) : valore;

    if (!grezzo || typeof grezzo !== 'object' || Array.isArray(grezzo)) return null;
    const oggetto = grezzo as Record<string, unknown>;

    const tipo = oggetto.tipo;
    if (typeof tipo !== 'string' || !TIPI.includes(tipo as TipoRicorrenza)) return null;

    const ogni = oggetto.ogni;
    // `Number.isInteger` respinge in un colpo solo NaN, Infinity, i decimali e
    // qualunque cosa non sia un numero. Lo zero e i negativi vanno rifiutati
    // qui e non piu' avanti: `ogni: 0` darebbe una "prossima occorrenza"
    // uguale alla precedente, cioe' un ciclo infinito di task identici.
    if (typeof ogni !== 'number' || !Number.isInteger(ogni)) return null;
    if (ogni < 1 || ogni > OGNI_MASSIMO) return null;

    let giorniSettimana: number[] | undefined;
    if (oggetto.giorniSettimana != null) {
      if (!Array.isArray(oggetto.giorniSettimana)) return null;
      const giorni = oggetto.giorniSettimana.filter(
        (g): g is number => typeof g === 'number' && Number.isInteger(g) && g >= 0 && g <= 6
      );
      // Se l'array c'era ma nessun elemento e' un giorno valido, il valore e'
      // corrotto: meglio rifiutare la regola che ripiegare in silenzio su una
      // semantica diversa da quella che l'utente aveva scelto.
      if (giorni.length !== oggetto.giorniSettimana.length) return null;
      // Ordinati e senza doppioni: il calcolo della prossima occorrenza
      // scorre l'elenco in ordine, e `[3, 1, 1]` lo farebbe sbagliare.
      const unici = Array.from(new Set(giorni)).sort((a, b) => a - b);
      if (unici.length > 0) giorniSettimana = unici;
    }

    let fine: string | null | undefined;
    if (oggetto.fine != null) {
      if (typeof oggetto.fine !== 'string') return null;
      // Una data di fine illeggibile e' peggio dell'assenza di data: non
      // sapremmo quando fermarci, e la serie si rinnoverebbe per sempre.
      if (limiteFine(oggetto.fine) === null) return null;
      fine = oggetto.fine;
    }

    // Ricostruito campo per campo e non passato avanti cosi' com'e': quello in
    // ingresso puo' portarsi dietro chiavi extra, che finirebbero riscritte
    // nel jsonb della nuova occorrenza e si moltiplicherebbero di serie in
    // serie.
    const regola: RegolaRicorrenza = { tipo: tipo as TipoRicorrenza, ogni };
    if (tipo === 'settimane' && giorniSettimana) regola.giorniSettimana = giorniSettimana;
    if (fine) regola.fine = fine;
    return regola;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Calcolo della prossima occorrenza
// ---------------------------------------------------------------------------

/**
 * L'istante oltre il quale la serie non si rinnova piu'.
 *
 * Una `fine` scritta come sola data ('2026-12-31') vale fino a fine giornata:
 * chi la sceglie in un calendario intende "l'ultimo giorno compreso", non "a
 * mezzanotte di quel giorno smetti". Con `new Date('2026-12-31')` — che in
 * JavaScript e' mezzanotte UTC — un'occorrenza del 31 alle 9 del mattino
 * sarebbe scartata, e la serie finirebbe un giorno prima del previsto.
 *
 * Restituisce null se la stringa non e' una data leggibile.
 */
function limiteFine(fine: string): Date | null {
  const soloData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fine);
  if (soloData) {
    return new Date(
      Number(soloData[1]),
      Number(soloData[2]) - 1,
      Number(soloData[3]),
      23,
      59,
      59,
      999
    );
  }
  const istante = new Date(fine);
  return Number.isNaN(istante.getTime()) ? null : istante;
}

/** Ultimo giorno del mese indicato (mese in base 0, come in `Date`). */
function ultimoGiornoDelMese(anno: number, mese: number): number {
  // Il giorno 0 del mese successivo e' l'ultimo di questo: evita di ricordarsi
  // a memoria i mesi da 30 e la regola degli anni bisestili.
  return new Date(anno, mese + 1, 0).getDate();
}

/**
 * Sposta una data di N giorni di CALENDARIO, non di N per 86400000 millisecondi.
 *
 * E' la differenza che due volte l'anno conta: nei fusi con l'ora legale il
 * giorno del cambio dura 23 o 25 ore. Sommando millisecondi, un controllo
 * fissato alle 09:00 diventa delle 08:00 (o delle 10:00) a fine marzo, e a
 * ogni rinnovo successivo l'errore resta li'; con due cambi l'anno e una serie
 * lunga, la deriva si accumula. Il costruttore `Date(anno, mese, giorno, ...)`
 * ragiona invece in ora locale e tiene fermo l'orario da orologio.
 */
function aggiungiGiorni(base: Date, giorni: number): Date {
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() + giorni,
    base.getHours(),
    base.getMinutes(),
    base.getSeconds(),
    base.getMilliseconds()
  );
}

/**
 * Sposta una data di N mesi, tenendo il giorno del mese quando esiste.
 *
 * IL CASO DEL 31. Il 31 gennaio piu' un mese non esiste: febbraio finisce al
 * 28 (o 29). Le due scelte possibili sono slittare al 3 marzo o fermarsi
 * all'ultimo giorno di febbraio, e qui si sceglie l'ULTIMO GIORNO DEL MESE.
 *
 * Il motivo e' il mestiere di questa applicazione: i controlli periodici di
 * sicurezza sono adempimenti "una volta al mese", e la verifica di febbraio
 * deve cadere in febbraio. Con lo slittamento, il controllo di febbraio
 * finirebbe a marzo e quel mese resterebbe scoperto sul registro — che e'
 * esattamente il dato che un ispettore guarda. In piu' lo slittamento sposta
 * il giorno in avanti a ogni passaggio (31 gen, 3 mar, 3 apr...), e dopo
 * qualche mese la serie non e' piu' riconoscibile.
 *
 * Il prezzo, dichiarato: la regola non conserva un "giorno di riferimento"
 * della serie, quindi una volta ridotta a 28 la serie prosegue dal 28 e non
 * torna al 31. E' accettabile — la cadenza mensile resta esatta e nessun mese
 * viene saltato — ed e' il compromesso che si paga per una funzione pura, che
 * conosce solo la data da cui partire.
 */
function aggiungiMesi(base: Date, mesi: number): Date {
  const anno = base.getFullYear();
  const mese = base.getMonth() + mesi;
  const giorno = Math.min(
    base.getDate(),
    // `new Date(anno, mese, 0)` normalizza da solo i mesi fuori da 0-11, quindi
    // non serve riportare a mano l'anno indietro o avanti.
    ultimoGiornoDelMese(anno, mese)
  );
  return new Date(
    anno,
    mese,
    giorno,
    base.getHours(),
    base.getMinutes(),
    base.getSeconds(),
    base.getMilliseconds()
  );
}

/**
 * La prossima data della serie dopo `daQuando`, o null se la serie e' finita.
 *
 * `daQuando` e' la scadenza dell'occorrenza appena chiusa, non "adesso": la
 * cadenza deve restare ancorata alle scadenze previste, altrimenti chiudere un
 * controllo con tre giorni di ritardo sposterebbe in avanti tutta la serie.
 */
export function prossimaOccorrenza(
  regola: RegolaRicorrenza,
  daQuando: Date,
  /**
   * Se indicato, si salta avanti finche' la scadenza non e' nel futuro.
   *
   * Facoltativo di proposito: senza, questa funzione resta cio' che dice il suo
   * nome — UN passo di calendario, puro e verificabile con date fisse. Il
   * salto delle occorrenze gia' passate e' una decisione del lavoro
   * pianificato, che sa che ora e', non del calendario.
   */
  adesso?: Date
): Date | null {
  // Rivalidazione e non fiducia sul tipo: la firma dice `RegolaRicorrenza`, ma
  // il valore reale nasce da un jsonb e TypeScript non e' li' a runtime.
  const valida = regolaValida(regola);
  if (!valida) return null;
  if (Number.isNaN(daQuando.getTime())) return null;

  const limite = valida.fine ? limiteFine(valida.fine) : null;

  /*
    Si avanza finche' la scadenza non e' nel futuro.
    
    Con un passo solo, una serie mensile chiusa con sei mesi di ritardo
    generava un'occorrenza gia' scaduta: il mattino dopo partiva un
    "in ritardo", e sette giorni dopo un'escalation ai responsabili, per un
    controllo appena creato. Ancorare la cadenza alla scadenza precedente e non
    a "adesso" resta giusto — e' cio' che tiene il ciclo allineato al
    calendario — ma le occorrenze gia' passate vanno saltate.
    
    Il tetto e' una rete di sicurezza contro una regola che non avanza mai
    (ogni = 0 e' gia' escluso dalla validazione, ma qui gira codice che riceve
    jsonb): meglio nessuna occorrenza che un ciclo infinito in una funzione
    serverless.
  */
  const MAX_PASSI = adesso ? 500 : 1;
  let prossima = daQuando;

  for (let passo = 0; passo < MAX_PASSI; passo++) {
    switch (valida.tipo) {
      case 'giorni':
        prossima = aggiungiGiorni(prossima, valida.ogni);
        break;
      case 'settimane':
        prossima = prossimaSettimanale(valida, prossima);
        break;
      case 'mesi':
        prossima = aggiungiMesi(prossima, valida.ogni);
        break;
    }

    if (limite && prossima.getTime() > limite.getTime()) return null;
    if (!adesso || prossima.getTime() > adesso.getTime()) return prossima;
  }

  return null;
}

/**
 * Il caso settimanale, che e' l'unico con due comportamenti distinti.
 *
 * Senza giorni scelti vale "lo stesso giorno della settimana, N settimane
 * dopo". Con dei giorni scelti, invece, la settimana ha piu' occorrenze: si
 * cerca prima un giorno ancora disponibile nella settimana corrente, e solo
 * quando sono finiti si salta alla settimana giusta ripartendo dal primo
 * giorno scelto. Senza il salto, un "ogni 3 settimane il lunedi' e il
 * giovedi'" genererebbe lunedi' e giovedi' di OGNI settimana.
 */
function prossimaSettimanale(regola: RegolaRicorrenza, daQuando: Date): Date {
  const giorni = regola.giorniSettimana;
  if (!giorni || giorni.length === 0) {
    return aggiungiGiorni(daQuando, regola.ogni * 7);
  }

  const oggi = daQuando.getDay();
  for (const giorno of giorni) {
    // Strettamente maggiore: la data di partenza e' un'occorrenza gia'
    // avvenuta, e restituirla di nuovo creerebbe un doppione.
    if (giorno > oggi) return aggiungiGiorni(daQuando, giorno - oggi);
  }

  // Nessun giorno utile resta in questa settimana: si torna alla domenica di
  // riferimento, si saltano `ogni` settimane e si riparte dal primo giorno
  // scelto.
  return aggiungiGiorni(daQuando, regola.ogni * 7 - oggi + giorni[0]);
}

// ---------------------------------------------------------------------------
// Descrizione a parole
// ---------------------------------------------------------------------------

/*
 * Le frasi per lingua, con lo stesso schema di `modelliEmail.ts`: la struttura
 * (quale pezzo va prima, dove si infila l'elenco dei giorni) sta nel codice
 * una volta sola, le parole in una tabella per lingua. Aggiungere una lingua
 * e' una riga di tabella.
 *
 * Non passano da `t()` perche' questo modulo lo importa anche il server, dove
 * il contesto React non esiste; e la stessa frase serve identica nelle email e
 * nell'interfaccia.
 */
interface TestiRicorrenza {
  /** `{n}` e' l'intervallo; la forma singolare e' separata perche' quasi
   *  nessuna lingua dice "ogni 1 giorno". */
  giorno: string;
  giorni: string;
  settimana: string;
  settimane: string;
  mese: string;
  mesi: string;
  /** Introduce l'elenco dei giorni scelti: `{giorni}`. */
  nei: string;
  /** Chiude la frase con la data di fine: `{data}`. */
  fino: string;
  /** Domenica per prima, come `Date.getDay()`. */
  abbreviazioni: [string, string, string, string, string, string, string];
  /** Congiunzione fra gli ultimi due giorni dell'elenco. */
  e: string;
  /** Separatore fra la cadenza e la coda della frase. */
  separatore: string;
}

const TESTI: Record<LinguaRicorrenza, TestiRicorrenza> = {
  it: {
    giorno: 'Ogni giorno',
    giorni: 'Ogni {n} giorni',
    settimana: 'Ogni settimana',
    settimane: 'Ogni {n} settimane',
    mese: 'Ogni mese',
    mesi: 'Ogni {n} mesi',
    nei: 'il {giorni}',
    fino: 'fino al {data}',
    abbreviazioni: ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'],
    e: 'e',
    separatore: ', ',
  },
  en: {
    giorno: 'Every day',
    giorni: 'Every {n} days',
    settimana: 'Every week',
    settimane: 'Every {n} weeks',
    mese: 'Every month',
    mesi: 'Every {n} months',
    nei: 'on {giorni}',
    fino: 'until {data}',
    abbreviazioni: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    e: 'and',
    separatore: ', ',
  },
  fr: {
    giorno: 'Tous les jours',
    giorni: 'Tous les {n} jours',
    settimana: 'Toutes les semaines',
    settimane: 'Toutes les {n} semaines',
    mese: 'Tous les mois',
    mesi: 'Tous les {n} mois',
    nei: 'le {giorni}',
    fino: "jusqu'au {data}",
    abbreviazioni: ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'],
    e: 'et',
    separatore: ', ',
  },
  de: {
    giorno: 'Täglich',
    giorni: 'Alle {n} Tage',
    settimana: 'Wöchentlich',
    settimane: 'Alle {n} Wochen',
    mese: 'Monatlich',
    mesi: 'Alle {n} Monate',
    nei: 'am {giorni}',
    fino: 'bis {data}',
    abbreviazioni: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    e: 'und',
    separatore: ', ',
  },
  es: {
    giorno: 'Todos los días',
    giorni: 'Cada {n} días',
    settimana: 'Todas las semanas',
    settimane: 'Cada {n} semanas',
    mese: 'Todos los meses',
    mesi: 'Cada {n} meses',
    nei: 'el {giorni}',
    fino: 'hasta el {data}',
    abbreviazioni: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
    e: 'y',
    separatore: ', ',
  },
};

/**
 * La data di fine, scritta come la scrive la gente di quella lingua.
 *
 * Composta a mano invece che con `toLocaleDateString`: l'implementazione di
 * Intl cambia fra il browser, Node e il runtime edge, e la stessa regola
 * finirebbe descritta in modo diverso nell'interfaccia e nelle email. Qui il
 * risultato e' identico ovunque, ed e' anche verificabile in un test.
 */
function dataLeggibile(fine: string, lingua: LinguaRicorrenza): string {
  const limite = limiteFine(fine);
  if (!limite) return fine;
  const gg = String(limite.getDate()).padStart(2, '0');
  const mm = String(limite.getMonth() + 1).padStart(2, '0');
  const aaaa = limite.getFullYear();
  if (lingua === 'en') return `${mm}/${gg}/${aaaa}`;
  if (lingua === 'de') return `${gg}.${mm}.${aaaa}`;
  return `${gg}/${mm}/${aaaa}`;
}

/**
 * Traduce una regola in una frase leggibile.
 *
 * Serve all'interfaccia: un campo "ogni 3" accanto a un menu a tendina non
 * dice all'utente quando ricevera' davvero il prossimo controllo, e la
 * ricorrenza e' proprio la funzione dove sbagliare in silenzio costa di piu'.
 * Su una regola irriconoscibile restituisce stringa vuota, cosi' chi la mostra
 * puo' semplicemente non mostrare nulla.
 */
export function descriviRicorrenza(regola: RegolaRicorrenza, lingua: string): string {
  const valida = regolaValida(regola);
  if (!valida) return '';

  const testi = TESTI[lingua as LinguaRicorrenza] ?? TESTI[LINGUA_PREDEFINITA];
  const singolare = valida.ogni === 1;

  let frase: string;
  switch (valida.tipo) {
    case 'giorni':
      frase = singolare ? testi.giorno : testi.giorni;
      break;
    case 'settimane':
      frase = singolare ? testi.settimana : testi.settimane;
      break;
    case 'mesi':
      frase = singolare ? testi.mese : testi.mesi;
      break;
  }
  frase = frase.split('{n}').join(String(valida.ogni));

  if (valida.tipo === 'settimane' && valida.giorniSettimana?.length) {
    const nomi = valida.giorniSettimana.map((g) => testi.abbreviazioni[g]);
    const elenco =
      nomi.length === 1
        ? nomi[0]
        : `${nomi.slice(0, -1).join(', ')} ${testi.e} ${nomi[nomi.length - 1]}`;
    frase += testi.separatore + testi.nei.split('{giorni}').join(elenco);
  }

  if (valida.fine) {
    frase += testi.separatore + testi.fino.split('{data}').join(dataLeggibile(valida.fine, lingua as LinguaRicorrenza));
  }

  return frase;
}

// ---------------------------------------------------------------------------
// Costanti del lavoro pianificato
// ---------------------------------------------------------------------------

/**
 * Tetto alle occorrenze create per esecuzione.
 *
 * Stessa logica del tetto sulle email: non e' una quota ma una cintura. Una
 * regola sbagliata su un import di massa, o un `fine` che nessuno ha messo,
 * qui diventerebbe la creazione silenziosa di migliaia di task. Meglio
 * fermarsi, dirlo nella risposta e far guardare una persona.
 */
export const TETTO_OCCORRENZE_PER_ESECUZIONE = 200;

/**
 * Quanti task completati e ricorrenti leggere al massimo. Piu' alto del tetto
 * perche' la maggior parte dei candidati viene scartata (serie gia' rinnovata,
 * serie scaduta): fermarsi a 200 righe lette significherebbe non arrivare mai
 * in fondo.
 */
export const MAX_SERIE_LETTE = 2000;
