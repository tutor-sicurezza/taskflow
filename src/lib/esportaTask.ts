/**
 * Esportazione dell'ELENCO dei task (non delle analisi).
 *
 * `exportUtils.ts` esporta le analisi — numeri gia' aggregati, tutti prodotti
 * dal codice. Qui si esporta il contenuto scritto dalle persone: titoli,
 * descrizioni, etichette. E' una differenza che cambia tutto, perche' quel
 * testo contiene virgole, virgolette, a capo, accenti e — se qualcuno ci
 * prova — formule. Da qui le due regole non negoziabili di questo file: la
 * codifica CSV segue RFC 4180 alla lettera, e ogni campo passa da
 * `neutralizzaFormula` prima di finire nel file.
 *
 * Le convenzioni (una funzione `Traduci` passata dal chiamante, il download
 * via link temporaneo, il PDF via finestra di stampa) sono quelle di
 * `exportUtils.ts`: quel file resta la fonte dello stile, qui non se ne
 * inventa uno nuovo.
 */

import { format } from 'date-fns';
import { LINGUA_PREDEFINITA, LINGUE, traduci, type Lingua } from '@/lib/i18n';
import { dataCompletamento, scadenzaFormattata } from '@/lib/scadenze';
import type { Employee, Task } from '@/lib/types';

/**
 * Le colonne esportabili, con un identificatore stabile.
 *
 * Gli identificatori non sono le intestazioni: l'intestazione cambia con la
 * lingua, l'identificatore no. Se le due cose coincidessero, la scelta delle
 * colonne salvata da un utente italiano non varrebbe piu' per lo stesso utente
 * passato all'inglese.
 */
export const COLONNE_DISPONIBILI = [
  'titolo',
  'descrizione',
  'assegnatario',
  'reparto',
  'priorita',
  'stato',
  'scadenza',
  'etichette',
  'stima',
  'tempoImpiegato',
  'creazione',
  'completatoIl',
] as const;

export type ColonnaTask = (typeof COLONNE_DISPONIBILI)[number];

/** Colonne proposte in partenza: quelle che servono a una riunione. */
export const COLONNE_PREDEFINITE: ColonnaTask[] = [
  'titolo',
  'assegnatario',
  'stato',
  'priorita',
  'scadenza',
];

/**
 * Intestazione di ogni colonna, come chiave di traduzione inglese.
 *
 * Le chiavi sono i testi inglesi stessi, come nel resto dell'interfaccia:
 * quando una traduzione manca si vede l'inglese, non un identificatore.
 */
const INTESTAZIONI: Record<ColonnaTask, string> = {
  titolo: 'Title',
  descrizione: 'Description',
  assegnatario: 'Assignee',
  reparto: 'Department',
  priorita: 'Priority',
  stato: 'Status',
  scadenza: 'Due Date',
  etichette: 'Labels',
  stima: 'Estimate',
  tempoImpiegato: 'Time Spent',
  creazione: 'Created',
  completatoIl: 'Completed On',
};

const ETICHETTE_STATO: Record<Task['status'], string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  blocked: 'Blocked',
  completed: 'Completed',
};

const ETICHETTE_PRIORITA: Record<Task['priority'], string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export interface OpzioniEsportazione {
  /** Quali colonne includere, negli identificatori di `COLONNE_DISPONIBILI`. */
  colonne: string[];
  /**
   * Se true (predefinito) esporta solo cio' che si vede nelle viste correnti,
   * cioe' esclude gli archiviati. Chi passa `false` vuole lo storico completo.
   *
   * Il filtro per stato, reparto o ricerca lo ha gia' applicato il chiamante,
   * che e' l'unico a sapere cosa c'e' a schermo: questa funzione riceve una
   * lista e non puo' indovinare da dove viene. L'unica distinzione che puo'
   * fare da sola in modo onesto e' archiviato / non archiviato, perche' un
   * task archiviato non e' in NESSUNA vista corrente per definizione.
   */
  soloVisibili?: boolean;
}

/** L'utente puo' avere una lingua qualunque in mano: qui si torna a un valore noto. */
function linguaValida(lingua: string): Lingua {
  const breve = (lingua || '').split('-')[0] as Lingua;
  return breve in LINGUE ? breve : LINGUA_PREDEFINITA;
}

function eColonnaNota(c: string): c is ColonnaTask {
  return (COLONNE_DISPONIBILI as readonly string[]).includes(c);
}

/**
 * La data di generazione del report, nella lingua di chi esporta.
 *
 * Come in `exportUtils.ts`: `format(..., 'PPpp')` di date-fns senza `locale`
 * esce sempre in inglese, anche in un PDF scaricato da un'interfaccia
 * italiana. Il timestamp nel NOME del file resta invece ISO — vedi
 * `nomeFileEsportazione` — perche' li' serve un ordine alfabetico che
 * coincida con quello cronologico per chiunque scarichi.
 */
function dataGenerazione(lingua: Lingua): string {
  return new Date().toLocaleString(lingua, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Una data ISO formattata nella lingua richiesta, o cella vuota se non e' una data. */
function dataLocale(iso: string | null | undefined, lingua: Lingua): string {
  if (!iso) return '';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '';
  return data.toLocaleDateString(lingua, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Minuti resi in ore nella lingua richiesta.
 *
 * `Intl.NumberFormat` e non `toFixed`: in italiano, francese, tedesco e
 * spagnolo il separatore decimale e' la virgola, e un "1.5" in mezzo a un
 * export italiano si legge come millecinquecento. Il simbolo 'h' resta tale
 * qual e' perche' e' identico nelle cinque lingue dell'applicazione.
 */
function formattaMinuti(minuti: number | null | undefined, lingua: Lingua): string {
  if (minuti === null || minuti === undefined || !Number.isFinite(minuti)) return '';
  const ore = minuti / 60;
  return `${new Intl.NumberFormat(lingua, { maximumFractionDigits: 1 }).format(ore)} h`;
}

function cella(
  task: Task,
  colonna: ColonnaTask,
  nomiPerId: Map<string, string>,
  lingua: Lingua
): string {
  switch (colonna) {
    case 'titolo':
      return task.title ?? '';
    case 'descrizione':
      return task.description ?? '';
    case 'assegnatario':
      // Cella vuota sia per "non assegnato" sia per un id che non corrisponde
      // piu' a nessuno (persona rimossa): inventare "Sconosciuto" metterebbe
      // in un report da riunione un nome che non esiste.
      return task.assigneeId ? (nomiPerId.get(task.assigneeId) ?? '') : '';
    case 'reparto':
      // Il reparto del LAVORO, come dice il tipo: non si ripiega su quello
      // dell'assegnatario, che e' un'altra informazione e falserebbe i totali
      // di chi raggruppa l'export per reparto.
      return task.department ?? '';
    case 'priorita':
      return traduci(lingua, ETICHETTE_PRIORITA[task.priority] ?? task.priority);
    case 'stato':
      return traduci(lingua, ETICHETTE_STATO[task.status] ?? task.status);
    case 'scadenza':
      // Da `scadenze.ts` e non da `new Date(task.dueDate)`: la scadenza e'
      // facoltativa, e senza questo passaggio un task senza scadenza
      // finirebbe nel file come "Invalid Date".
      return scadenzaFormattata(task, lingua) ?? '';
    case 'etichette':
      return (task.labels ?? []).join(', ');
    case 'stima':
      return formattaMinuti(task.estimateMinutes, lingua);
    case 'tempoImpiegato':
      return formattaMinuti(task.spentMinutes, lingua);
    case 'creazione':
      return dataLocale(task.createdAt, lingua);
    case 'completatoIl':
      // La data vera del passaggio a "completato", presa dalla cronologia. Un
      // task chiuso prima che la cronologia esistesse da' cella vuota: meglio
      // vuota che una data surrogata presa dalla scadenza, che misurerebbe il
      // piano e non il lavoro.
      return dataLocale(dataCompletamento(task)?.toISOString(), lingua);
  }
}

/**
 * Le righe da scrivere nel file. La PRIMA riga e' l'intestazione.
 *
 * Intestazione dentro e non a parte perche' CSV e PDF la vogliono entrambi, e
 * tenerla qui garantisce che sia sempre allineata alle colonne dei dati: con
 * due liste separate basta una colonna aggiunta da un lato per spostare tutte
 * le intestazioni di uno, e nessuno se ne accorge finche' non legge il file.
 */
export function righeDaTask(
  tasks: Task[],
  employees: Employee[],
  opzioni: OpzioniEsportazione,
  lingua: string
): string[][] {
  const l = linguaValida(lingua);

  // Le colonne sconosciute si scartano invece di far fallire l'export: la
  // scelta puo' arrivare da una preferenza salvata mesi fa, quando una colonna
  // che oggi non esiste piu' era ancora offerta.
  const colonne = opzioni.colonne.filter(eColonnaNota);
  if (colonne.length === 0) return [];

  const selezionati = opzioni.soloVisibili === false ? tasks : tasks.filter((t) => !t.archivedAt);

  const nomiPerId = new Map(employees.map((e) => [e.id, e.name]));

  return [
    colonne.map((c) => traduci(l, INTESTAZIONI[c])),
    ...selezionati.map((task) => colonne.map((c) => cella(task, c, nomiPerId, l))),
  ];
}

/**
 * I caratteri che aprono una formula in Excel, LibreOffice e Google Sheets.
 *
 * Tab e ritorno a capo ci sono perche' entrambi i programmi li saltano prima
 * di guardare il primo carattere utile: `\t=cmd` viene interpretato come
 * `=cmd`.
 */
const APERTURE_FORMULA = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Toglie a un campo la possibilita' di essere letto come formula.
 *
 * Non e' pignoleria: un titolo di task che comincia con `=` viene eseguito
 * all'apertura del foglio da chi riceve l'export. Con `=HYPERLINK(...)` o le
 * vecchie macro DDE questo significa che chi scrive un task decide cosa gira
 * sul computer del responsabile che lo apre — l'export diventa un vettore di
 * esecuzione di codice, e la vittima non e' chi ha scritto il testo.
 *
 * Il rimedio consueto e' l'apice iniziale: i fogli di calcolo lo trattano come
 * "quanto segue e' testo", non lo mostrano nella cella e non lo rimettono se
 * il valore viene ricopiato. Si antepone PRIMA delle virgolette RFC 4180,
 * perche' la neutralizzazione riguarda il valore, la citazione il trasporto.
 *
 * Nota: colpisce anche un legittimo "-2" o un titolo che inizia con "+". E'
 * un prezzo accettato: una cella con un apice invisibile e' un fastidio,
 * l'alternativa e' eseguire codice altrui.
 */
export function neutralizzaFormula(valore: string): string {
  if (!valore) return valore ?? '';
  return APERTURE_FORMULA.includes(valore[0]) ? `'${valore}` : valore;
}

/**
 * Un campo secondo RFC 4180: si racchiude fra virgolette solo quando serve, e
 * le virgolette interne si raddoppiano.
 *
 * Il caso che rompe i file veri e' il piu' banale: un titolo con una virgola.
 * Senza questa regola la riga acquista una colonna e tutto cio' che segue
 * scivola di uno — un errore che non da' alcun messaggio, si vede solo
 * leggendo il foglio.
 */
function campoCSV(valore: string): string {
  const testo = neutralizzaFormula(valore ?? '');
  return /[",\r\n]/.test(testo) ? `"${testo.replace(/"/g, '""')}"` : testo;
}

/**
 * Le righe in un CSV.
 *
 * Terminatore CRLF perche' lo prescrive RFC 4180 ed e' cio' che Excel su
 * Windows si aspetta. Nessun BOM qui: lo aggiunge `scaricaCSV`, perche' serve
 * al file, non al testo (e in un test renderebbe illeggibile ogni confronto).
 */
export function versoCSV(righe: string[][]): string {
  return righe.map((riga) => riga.map(campoCSV).join(',')).join('\r\n');
}

/** Segnalazione dedicata: il chiamante deve poter tradurre il messaggio. */
export class ErrorePopupBloccato extends Error {
  constructor() {
    super('popup-bloccato');
    this.name = 'ErrorePopupBloccato';
  }
}

function scappaHTML(testo: string): string {
  return testo
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Il PDF, attraverso la finestra di stampa del browser.
 *
 * Stessa strada di `exportUtils.ts`: il progetto non ha jspdf fra le
 * dipendenze (verificato in package.json) e aggiungerlo per una tabella
 * significherebbe ~350 kB nel bundle per una funzione usata di rado. La
 * stampa del browser produce un PDF vero, con la selezione del testo intatta.
 *
 * COLONNE CHE NON CI STANNO — la scelta fatta qui:
 * 1. oltre cinque colonne si passa ad A4 orizzontale, che e' il modo che non
 *    toglie nulla: nessun dato sparisce e nessuna colonna si restringe;
 * 2. il corpo del testo scende a scaglioni al crescere delle colonne;
 * 3. `table-layout: fixed` con `overflow-wrap: anywhere`: il testo lungo VA A
 *    CAPO dentro la cella, allungando la riga, invece di uscire dai bordi.
 *
 * Non si tronca. Il troncamento andrebbe a colpire proprio la descrizione,
 * cioe' l'unica colonna in cui la parte tagliata puo' essere quella che conta;
 * una riga alta due centimetri e' brutta, una descrizione tagliata a meta' e'
 * sbagliata. E non si rimuovono colonne: chi le ha spuntate le vuole.
 */
export function versoPDF(righe: string[][], titolo: string, lingua: string): void {
  if (righe.length === 0) return;

  const [intestazione, ...dati] = righe;
  const numeroColonne = intestazione.length;
  const l = linguaValida(lingua);

  // Le soglie sono empiriche: a parita' di A4, sei colonne stanno strette in
  // verticale e sedici sono illeggibili anche in orizzontale se non si scende
  // di corpo.
  const orizzontale = numeroColonne > 5;
  const corpo = numeroColonne > 10 ? 8 : numeroColonne > 7 ? 9 : 11;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${scappaHTML(titolo)}</title>
      <style>
        @page { size: A4 ${orizzontale ? 'landscape' : 'portrait'}; margin: 12mm; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: #1f2937;
          font-size: ${corpo}px;
        }
        h1 {
          color: oklch(0.45 0.12 210);
          font-size: ${corpo + 9}px;
          margin: 0 0 4px;
        }
        .generated-date { color: #6b7280; font-size: ${corpo - 1}px; margin-bottom: 12px; }
        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        th {
          background: oklch(0.45 0.12 210);
          color: white;
          padding: 6px;
          text-align: left;
          font-weight: 600;
        }
        td {
          padding: 6px;
          border-bottom: 1px solid #e5e7eb;
          vertical-align: top;
          /* Il testo lungo va a capo nella cella invece di uscirne: e' cio'
             che impedisce le colonne sovrapposte. */
          overflow-wrap: anywhere;
        }
        /* Una riga non si spezza fra due pagine, e l'intestazione si ripete
           in cima a ognuna: senza, alla seconda pagina non si sa piu' quale
           colonna si sta leggendo. */
        tr { page-break-inside: avoid; }
        thead { display: table-header-group; }
      </style>
    </head>
    <body>
      <h1>${scappaHTML(titolo)}</h1>
      <div class="generated-date">${scappaHTML(traduci(l, 'Generated on {date}', { date: dataGenerazione(l) }))}</div>
      <table>
        <thead>
          <tr>${intestazione.map((c) => `<th>${scappaHTML(c)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${dati
            .map((riga) => `<tr>${riga.map((c) => `<td>${scappaHTML(c)}</td>`).join('')}</tr>`)
            .join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const finestra = window.open('', '', 'width=1000,height=700');

  // Il blocco pop-up e' la causa numero uno di "il PDF non esce". Qui si
  // lancia invece di fare `alert` come exportUtils: il messaggio va mostrato
  // nella lingua dell'utente, e la lingua la conosce il componente.
  if (!finestra) throw new ErrorePopupBloccato();

  finestra.document.write(htmlContent);
  finestra.document.close();

  finestra.onload = () => {
    setTimeout(() => {
      finestra.focus();
      finestra.print();
      setTimeout(() => finestra.close(), 100);
    }, 250);
  };
}

/**
 * Scarica il CSV.
 *
 * Il BOM UTF-8 e' l'unica ragione per cui questa funzione esiste invece di
 * riusare quella di exportUtils: senza, Excel su Windows apre il file in
 * codepage locale e ogni accento diventa un carattere sbagliato. Chi scrive
 * "Verifica qualità" nel titolo se lo ritrova come "qualitÃ ".
 */
export function scaricaCSV(contenuto: string, nomeFile: string): void {
  // Costruito dal codice del carattere: un BOM scritto nel sorgente sarebbe invisibile a chi legge.
  const BOM = String.fromCharCode(0xfeff);
  const blob = new Blob([BOM + contenuto], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', nomeFile);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/** Nome file con marca temporale, come per le analisi. */
export function nomeFileEsportazione(estensione: 'csv' | 'pdf'): string {
  return `task_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.${estensione}`;
}
