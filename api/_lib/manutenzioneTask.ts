/**
 * Le regole della manutenzione periodica dei task, senza database attorno.
 *
 * Due compiti, un modulo solo: archiviare i completati vecchi e portare in
 * alto i task in ritardo che nessuno ha sbloccato. Stanno insieme perche'
 * girano nella stessa esecuzione pianificata e leggono la stessa tabella, e
 * perche' le due soglie in giorni vanno lette una accanto all'altra: sono i
 * due numeri che decidono quando un task "esce di scena" e quando invece
 * "diventa un problema di qualcun altro".
 *
 * Sta in `_lib` e non accanto alla rotta per il motivo gia' documentato in
 * `promemoriaLogica.ts`: `api/cron/` e' instradata da Vercel e ogni file li'
 * dentro diventa un endpoint pubblico, test compresi. Il trattino basso
 * esclude questa cartella dall'instradamento.
 */

import type { LinguaModello, TipoNotifica } from './modelliEmail.js';

const GIORNO_MS = 24 * 60 * 60 * 1000;

/**
 * Dopo quanti giorni dal completamento un task viene archiviato: 30.
 *
 * Archiviare NON e' cancellare. La riga resta al suo posto, con tutta la sua
 * cronologia: esce soltanto dalle viste correnti e continua a contare nelle
 * analisi storiche (tempo medio di completamento, prestazioni per reparto,
 * export). E' questa la differenza che rende accettabile un'operazione
 * automatica: nessun dato se ne va, cambia solo cio' che si vede aprendo
 * l'elenco. Se fosse una cancellazione, nessuna soglia sarebbe abbastanza
 * lunga.
 *
 * Trenta giorni, cioe' un ciclo mensile intero, perche' e' la cadenza con cui
 * le persone guardano indietro davvero: la riunione di fine mese, il
 * consuntivo, la fattura, il "cosa abbiamo chiuso a settembre". Chi cerca un
 * lavoro chiuso lo cerca entro quel giro; oltre, lo cerca per nome o nei
 * rapporti, non scorrendo l'elenco.
 *
 * Piu' corto (una o due settimane) farebbe sparire task appena chiusi mentre
 * qualcuno ci sta ancora lavorando intorno — la verifica, la contestazione, il
 * collega che torna dalle ferie. Piu' lungo (un trimestre) non risolverebbe il
 * problema per cui esiste: l'elenco resterebbe ingombro proprio nel periodo in
 * cui lo si usa.
 */
export const GIORNI_ARCHIVIAZIONE = 30;

/**
 * Dopo quanti giorni di ritardo scatta l'escalation: 7.
 *
 * Il giorno stesso in cui la scadenza passa ci pensano gia' i promemoria, che
 * avvisano l'assegnatario. Una settimana intera dopo, quell'avviso ha
 * dimostrato di non bastare: o la persona non puo' chiudere il task, o si e'
 * dimenticata, o non e' al lavoro. In tutti e tre i casi la cosa utile non e'
 * un altro promemoria alla stessa persona, ma dirlo a chi puo' riassegnare,
 * rinviare o togliere l'ostacolo.
 *
 * Sette giorni e non tre perche' una settimana piena assorbe ferie brevi,
 * malattie e task che scadono di venerdi': con tre giorni l'escalation
 * diventerebbe rumore, e il rumore si impara a ignorare — che e' esattamente
 * il modo in cui un canale di allerta smette di funzionare.
 */
export const GIORNI_ESCALATION = 7;

/**
 * Il valore usato nella colonna `tipo` di `email_promemoria_inviati` per
 * ricordare che un task e' gia' stato scalato.
 *
 * Quella tabella nasce per i promemoria, con un vincolo di unicita' su
 * (task_id, tipo): riusarla con un tipo diverso da' gratis la garanzia che
 * serve qui, cioe' "una escalation sola per task". ATTENZIONE: la colonna ha
 * un CHECK che al momento ammette solo 'task_due_soon' e 'task_overdue' —
 * finche' non viene esteso, l'inserimento fallisce e questo lavoro si ferma
 * PRIMA di spedire (vedi `api/cron/manutenzione.ts`).
 */
export const TIPO_ESCALATION = 'escalation';

/**
 * Quanti task completati leggere per esecuzione.
 *
 * Piu' basso del limite dei promemoria (2000) perche' qui ogni riga porta con
 * se' l'intero array `activities`: e' l'unico posto dove sta la data di
 * completamento, quindi non si puo' evitare di leggerlo, ma mille cronologie
 * sono gia' qualche megabyte da trasferire fino a una funzione edge. Cio' che
 * avanza viene archiviato alla prossima esecuzione: l'arretrato si smaltisce
 * in qualche giorno e nessuno se ne accorge.
 */
export const MAX_TASK_COMPLETATI_LETTI = 1000;

/** Quanti task archiviare al massimo in una esecuzione. */
export const TETTO_ARCHIVIAZIONI_PER_ESECUZIONE = 500;

/**
 * Quanti task leggere fra quelli in ritardo. Largo, perche' la maggior parte
 * sara' gia' stata scalata nei giorni precedenti e va scartata in memoria.
 */
export const MAX_TASK_RITARDO_LETTI = 2000;

/**
 * Tetti dell'escalation: quanti task e quante email per esecuzione.
 *
 * Qui il tetto conta piu' che nei promemoria, ed e' un tetto DOPPIO per un
 * motivo aritmetico: un promemoria e' un task = una email, un'escalation e' un
 * task = quanti sono i responsabili dell'organizzazione. Con dieci manager,
 * cinquanta task scalati fanno cinquecento messaggi. Un import sbagliato o una
 * migrazione che azzera le date, senza tetto, diventerebbe una campagna di
 * posta involontaria a nome del dominio verificato — e il primo giorno in cui
 * si attiva questa funzione l'arretrato storico E' quel caso.
 *
 * Quando un tetto morde, il lavoro si ferma e lo dice nella risposta: i task
 * rimasti vengono scalati alle esecuzioni successive, i piu' in ritardo per
 * primi.
 */
export const TETTO_TASK_SCALATI_PER_ESECUZIONE = 50;
export const TETTO_EMAIL_ESCALATION_PER_ESECUZIONE = 200;

/** Un'attivita' della cronologia, ridotta ai campi che qui servono. */
export interface AttivitaTask {
  type?: string | null;
  newValue?: string | null;
  createdAt?: string | null;
}

/** Il minimo che serve per decidere se archiviare o scalare un task. */
export interface TaskDaManutenere {
  status?: string | null;
  due_date?: string | null;
  archived_at?: string | null;
  updated_at?: string | null;
  activities?: AttivitaTask[] | null;
  /*
    L'approvazione. `status = 'completed'` non basta a dire "chiuso": un task
    che richiede un visto e lo aspetta e' consegnato, non concluso.
  */
  requires_approval?: boolean | null;
  approved_by?: string | null;
  approved_at?: string | null;
}

/**
 * Chiuso davvero: completato E, se serviva un visto, approvato.
 *
 * DUPLICATO CONSAPEVOLE di `eChiusoDavvero` in `src/lib/approvazione.ts`, per
 * lo stesso motivo per cui lo e' `dataDiCompletamento` qui sotto: `api/` ha un
 * suo tsconfig e non condivide i percorsi con `src/`. La regola e' una sola e
 * va cambiata in due posti — il commento serve a ricordarlo.
 */
export function eChiuso(task: TaskDaManutenere): boolean {
  if (task.status !== 'completed') return false;
  if (task.requires_approval !== true) return true;
  return Boolean(task.approved_by && task.approved_at);
}

/**
 * Quando un task e' stato davvero completato, secondo la sua cronologia.
 *
 * DUPLICATO CONSAPEVOLE di `dataCompletamento` in `src/lib/scadenze.ts`.
 * La regola e' la stessa — l'ultima attivita' `status_changed` con
 * `newValue = 'completed'` — ma i due lati non condividono i percorsi: `api/`
 * ha un suo tsconfig, non conosce l'alias `@/`, e importa con estensione `.js`
 * perche' a runtime su Vercel e' ESM puro. Tirare dentro un modulo di `src/`
 * significherebbe trascinarsi i suoi tipi e le sue dipendenze dentro una
 * funzione edge. Fra un import impossibile e una regola di quattro righe
 * riscritta e coperta da test su entrambi i lati, la seconda e' la scelta meno
 * cara: il giorno in cui la regola cambia, la si cerca per nome e la si trova
 * in due posti, entrambi con i loro test.
 *
 * Differenza voluta rispetto alla versione del client: qui i campi arrivano
 * dal JSONB grezzo, quindi si accetta che `activities` sia assente o malformato
 * senza rompere l'esecuzione pianificata.
 */
export function dataCompletamento(task: TaskDaManutenere): Date | null {
  if (task.status !== 'completed') return null;
  if (!Array.isArray(task.activities)) return null;

  const attivita = task.activities
    .filter(
      (a) =>
        a &&
        a.type === 'status_changed' &&
        a.newValue === 'completed' &&
        typeof a.createdAt === 'string'
    )
    // La piu' recente vince: un task riaperto e richiuso e' stato completato
    // l'ultima volta, non la prima.
    .sort((a, b) => (b.createdAt as string).localeCompare(a.createdAt as string))[0];

  if (!attivita) return null;
  const data = new Date(attivita.createdAt as string);
  return Number.isNaN(data.getTime()) ? null : data;
}

/**
 * La data da cui contare i giorni di archiviazione, con il ripiego.
 *
 * Un task completato PRIMA che la cronologia esistesse — o migrato da
 * `app_state` — non ha nessuna attivita' `status_changed`. In quel caso si usa
 * `updated_at`, che per un task chiuso e mai piu' toccato coincide di fatto con
 * il momento della chiusura.
 *
 * A differenza delle analisi, qui il ripiego e' giusto e l'esclusione sarebbe
 * sbagliata: nelle medie un valore surrogato falsa un numero che qualcuno
 * legge come un giudizio, mentre qui il rischio e' solo che un task venga
 * archiviato qualche giorno prima o dopo del dovuto — e senza ripiego quei
 * task resterebbero nell'elenco PER SEMPRE, che e' esattamente il difetto che
 * questa funzione deve chiudere.
 */
export function dataDiRiferimentoArchiviazione(task: TaskDaManutenere): Date | null {
  const completamento = dataCompletamento(task);
  if (completamento) return completamento;

  if (task.status !== 'completed') return null;
  if (typeof task.updated_at !== 'string') return null;
  const ripiego = new Date(task.updated_at);
  return Number.isNaN(ripiego.getTime()) ? null : ripiego;
}

/**
 * Un task completato da piu' di `giorni` va archiviato.
 *
 * Funzione pura e separata dalla rotta apposta: e' l'unico punto in cui si
 * decide che una riga sparisce dall'elenco di qualcuno, e sbagliarlo non
 * produce nessun messaggio a schermo — produce task che non ci sono piu'.
 */
export function daArchiviare(
  task: TaskDaManutenere,
  giorni: number,
  adesso: Date
): boolean {
  // Gia' archiviato: rifarlo sposterebbe `archived_at` in avanti ogni giorno e
  // renderebbe la colonna inutile proprio per la domanda a cui serve
  // rispondere, cioe' "da quando e' fuori dall'elenco?".
  if (task.archived_at) return false;

  /*
    Un task che aspetta un'approvazione NON si archivia.

    Archiviandolo usciva dalle viste correnti e dall'escalation: il visto non
    lo avrebbe piu' chiesto nessuno, e il lavoro sarebbe rimasto per sempre
    "consegnato e mai guardato". Era una perdita silenziosa a trenta giorni,
    proprio del meccanismo che esiste per non far passare niente inosservato.
  */
  if (!eChiuso(task)) return false;

  const riferimento = dataDiRiferimentoArchiviazione(task);
  if (!riferimento) return false;

  return adesso.getTime() - riferimento.getTime() >= giorni * GIORNO_MS;
}

/**
 * Un task non completato, non archiviato e in ritardo da piu' di `giorni` va
 * segnalato a chi puo' intervenire.
 *
 * Senza scadenza NON e' mai in ritardo, quindi non e' mai scalato: la scadenza
 * e' diventata facoltativa proprio perche' prima chi non ne aveva una se la
 * inventava, e quella data finta faceva comparire il task fra quelli in
 * ritardo. Un'escalation su una data inventata sarebbe la versione peggiore di
 * quel difetto, perche' arriva a un dirigente.
 */
export function daScalare(
  task: TaskDaManutenere,
  giorni: number,
  adesso: Date
): boolean {
  /*
    `eChiuso` e non `status === 'completed'`: un'approvazione ferma da mesi era
    invisibile a tutti. Il task risultava completato, quindi non veniva
    scalato; e nel frattempo l'archiviazione se lo portava via. Un lavoro che
    aspetta il visto di qualcuno e' esattamente il caso in cui serve
    sollecitare qualcuno.
  */
  if (eChiuso(task)) return false;

  // Un task archiviato e' fuori dalle viste correnti per decisione di
  // qualcuno: continuare a segnalarlo significherebbe riportarlo in vita nella
  // posta di tutti i responsabili, ogni volta.
  if (task.archived_at) return false;

  if (!task.due_date) return false;
  const scadenza = new Date(task.due_date);
  if (Number.isNaN(scadenza.getTime())) return false;

  return adesso.getTime() - scadenza.getTime() >= giorni * GIORNO_MS;
}

/** Da quanti giorni interi un task e' in ritardo; 0 se non lo e' o non ha scadenza. */
export function giorniDiRitardo(task: TaskDaManutenere, adesso: Date): number {
  if (!task.due_date) return 0;
  const scadenza = new Date(task.due_date);
  if (Number.isNaN(scadenza.getTime())) return 0;
  const differenza = adesso.getTime() - scadenza.getTime();
  return differenza <= 0 ? 0 : Math.floor(differenza / GIORNO_MS);
}

/**
 * L'istante oltre il quale una scadenza e' "in ritardo da abbastanza".
 *
 * Serve a filtrare nel database invece che in memoria: senza, il lavoro
 * leggerebbe ogni task scaduto dell'installazione per poi scartarne quasi
 * tutti. ISO 8601 in UTC, che e' il formato che PostgREST confronta senza
 * ambiguita' di fuso.
 */
export function sogliaRitardo(adesso: Date, giorni: number): string {
  return new Date(adesso.getTime() - giorni * GIORNO_MS).toISOString();
}

/**
 * I ruoli che ricevono l'escalation.
 *
 * Manager e admin, come da specifica, piu' 'owner': in questo schema (0004)
 * l'owner e' l'amministratore sopra gli amministratori, ed e' spessissimo
 * l'unico ruolo elevato di un'organizzazione piccola. Escluderlo
 * significherebbe che proprio quelle organizzazioni non riceverebbero MAI
 * un'escalation — un canale di allerta che tace non si nota, e chi lo ha
 * acceso crede che vada tutto bene.
 *
 * Fuori restano 'member' e 'viewer': possono vedere il task, non possono
 * riassegnarlo ne' spostarne la scadenza. La stessa terna e' quella di
 * `public.is_org_manager` (0008), cioe' di chi il database considera capace di
 * agire sul lavoro altrui.
 */
export const RUOLI_ESCALATION = ['owner', 'admin', 'manager'] as const;

/**
 * Il tipo di notifica riusato per l'escalation.
 *
 * `task_overdue` esiste gia' come modello di email in tutte le lingue e come
 * tipo di notifica: inventarne uno nuovo vorrebbe dire un modello in piu' da
 * tradurre, da rendere modificabile dalle organizzazioni e da tenere allineato
 * con `src/lib/types.ts`. Il fatto e' lo stesso — un task e' in ritardo —
 * cambia solo il destinatario.
 */
export const TIPO_NOTIFICA_ESCALATION: TipoNotifica = 'task_overdue';

/**
 * Il testo della notifica in applicazione per un'escalation.
 *
 * Diverso da quello dei promemoria, e non per stile: chi lo legge NON e'
 * l'assegnatario. «"X" e' scaduta» detto a un manager non dice ne' di chi e'
 * il task ne' da quanto tempo, cioe' le due cose che gli servono per decidere
 * se intervenire. Si scrive qui e non nel client perche' viene salvato come
 * testo nella riga della notifica e mostrato cosi' com'e': va composto nella
 * lingua di chi lo legge.
 */
const MESSAGGI_ESCALATION: Record<
  LinguaModello,
  (titolo: string, giorni: number) => string
> = {
  it: (t, g) => `"${t}" e' in ritardo da ${g} giorni e non e' stata chiusa`,
  en: (t, g) => `"${t}" has been overdue for ${g} days and is still open`,
  fr: (t, g) => `« ${t} » est en retard de ${g} jours et n'est toujours pas close`,
  de: (t, g) => `„${t}" ist seit ${g} Tagen überfällig und weiterhin offen`,
  es: (t, g) => `«${t}» lleva ${g} días de retraso y sigue abierta`,
};

export function messaggioEscalation(
  lingua: string,
  titolo: string,
  giorni: number
): string {
  const testo = MESSAGGI_ESCALATION[lingua as LinguaModello] ?? MESSAGGI_ESCALATION.it;
  return testo(titolo || '', giorni);
}

/** I conteggi restituiti dalla rotta, uno per compito. */
export interface ConteggiManutenzione {
  archiviazione: {
    esaminati: number;
    archiviati: number;
    /** Quanti sono stati datati con `updated_at` invece che con la cronologia. */
    conRipiego: number;
    giorni: number;
    tettoRaggiunto: boolean;
  };
  escalation: {
    esaminati: number;
    scalati: number;
    emailSpedite: number;
    notificheCreate: number;
    saltati: {
      giaScalati: number;
      /** Rientrati prima dell'invio: chiusi o riprogrammati dopo la lettura. */
      nonPiuInRitardo: number;
      senzaResponsabili: number;
      preferenzeOModello: number;
      invioFallito: number;
    };
    giorni: number;
    tettoRaggiunto: boolean;
  };
}
