import { bloccantiAperti } from '@/lib/dipendenze';
import { ETICHETTA_PRIORITA, ETICHETTA_STATO } from '@/lib/scaleTask';
import type { Sottoattivita, Task } from '@/lib/types';

/**
 * Il testo da consegnare a Claude perche' lavori su un'attivita'.
 *
 * ## Perche' esiste un "prompt" e non solo il connettore
 *
 * Il connettore MCP e' la strada buona: Claude legge le attivita' da solo e
 * ci riscrive sopra. Ma richiede di installarlo, e soprattutto richiede
 * Claude Desktop. Chi usa Claude nel browser, o chi non ha ancora installato
 * niente, resta fuori — e per quelle persone "copia questo testo" e' una
 * risposta completa, non un ripiego.
 *
 * ## Perche' NON c'e' un bottone che lancia Claude
 *
 * Non si puo'. Una pagina web non avvia processi sul computer di chi la
 * guarda: e' la garanzia che rende un browser sicuro da usare. Il bottone
 * quindi prepara, non esegue — e lo dice, invece di far credere il contrario e
 * lasciare che sia l'utente a scoprire che non succede niente.
 *
 * ## Cosa NON finisce nel testo
 *
 * I commenti. Contengono nomi di colleghi e discussioni interne, e questo
 * testo e' fatto per essere incollato altrove — magari in un Claude che non e'
 * quello aziendale. Ci va il lavoro da fare, non la conversazione di chi lo ha
 * discusso.
 *
 * ## In che lingua
 *
 * In quella dell'interfaccia. Le prime versioni componevano il testo in
 * italiano fisso: chi usava l'applicazione in inglese premeva un bottone che
 * diceva "Work on this with Claude" e si trovava nella casella un testo che
 * cominciava con "Aiutami a portare avanti questa attivita'". Se ne e'
 * accorta una fotografia fatta per il README, che e' un modo fortunato di
 * scoprirlo.
 *
 * Il traduttore arriva da fuori invece di essere importato qui, cosi' questo
 * file resta una funzione pura e i suoi test non devono montare un contesto
 * React per sapere cosa contiene il testo.
 */

/** Come `t` di `useTranslation`, ridotto a cio' che serve qui. */
export type Traduttore = (chiave: string, parametri?: Record<string, string | number>) => string;

/*
  Senza traduttore si usa la chiave stessa, cioe' l'inglese, sostituendo i
  segnaposto: e' la stessa regola di ripiego di `traduci`, e serve a chi chiama
  questa funzione fuori dall'interfaccia — per esempio i test.
*/
const SENZA_TRADUZIONE: Traduttore = (chiave, parametri) =>
  Object.entries(parametri ?? {}).reduce(
    (acc, [nome, valore]) => acc.split(`{${nome}}`).join(String(valore)),
    chiave
  );

function passiLeggibili(passi: Sottoattivita[] | undefined): string[] {
  if (!passi?.length) return [];
  return passi.map((p) => `- [${p.done ? "x" : " "}] ${p.title}`);
}

export interface OpzioniPrompt {
  /** Nome del reparto o dell'organizzazione, per dare contesto. */
  organizzazione?: string | null;
  /** Il `t` dell'interfaccia. Assente: si resta in inglese. */
  t?: Traduttore;
  /*
    Tutti i task, per sapere quali bloccanti sono ancora APERTI.

    `task.blockedBy` e' l'elenco dei legami, non dei blocchi: un bloccante
    completato e vistato resta li' dentro come traccia storica. Contandoli
    tutti si avvisava Claude che il database avrebbe rifiutato la chiusura
    anche quando non c'era piu' niente a bloccare — e con un numero che non
    corrispondeva a nulla di cio' che l'utente vede.

    Facoltativo: senza elenco non si puo' distinguere, e allora non si dice
    niente. Meglio tacere che dire una cosa che potrebbe essere falsa.
  */
  tuttiITask?: Task[];
}

/**
 * Il nome tradotto di un valore di una scala chiusa.
 *
 * `ETICHETTA_*` contiene la CHIAVE di traduzione, che in questo progetto e' il
 * testo inglese: passarla a `t` da' "High" in inglese e "Alta" in italiano.
 * Senza, il testo restava mezzo tradotto — le intestazioni nella lingua giusta
 * e i valori con dentro `high` e `not-started` grezzi dalla colonna.
 *
 * Un valore fuori scala — i dati arrivano anche da importazioni — si mostra
 * com'e' scritto invece di sparire.
 */
function scala(valore: string, etichette: Record<string, string>, t: Traduttore): string {
  const chiave = etichette[valore];
  return chiave ? t(chiave) : valore;
}

/**
 * Costruisce il testo. E' una funzione pura: prende un'attivita' e restituisce
 * una stringa, cosi' si puo' verificare cosa contiene senza aprire un browser.
 */
export function promptPerTask(task: Task, opzioni: OpzioniPrompt = {}): string {
  const t = opzioni.t ?? SENZA_TRADUZIONE;
  const righe: string[] = [];

  righe.push(t('Help me move this task forward. If something is unclear, ask me instead of making it up.'));
  righe.push('');
  righe.push(`# ${task.title}`);

  const meta: string[] = [
    `${t('Priority')}: ${scala(task.priority, ETICHETTA_PRIORITA, t)}`,
    `${t('Status')}: ${scala(task.status, ETICHETTA_STATO, t)}`,
  ];
  if (task.dueDate) meta.push(`${t('Due Date')}: ${task.dueDate.slice(0, 10)}`);
  if (opzioni.organizzazione) meta.push(`${t('Organization')}: ${opzioni.organizzazione}`);
  if (task.department) meta.push(`${t('Department')}: ${task.department}`);
  righe.push(meta.join('  ·  '));

  if (task.labels?.length) righe.push(`${t('Labels')}: ${task.labels.join(', ')}`);

  righe.push('');
  righe.push(task.description?.trim() || t('(no description)'));

  const passi = passiLeggibili(task.subtasks);
  if (passi.length) {
    righe.push('', `${t('Steps')}:`, ...passi);
  }

  /*
    Si dice che e' bloccata anche qui: chi incolla questo testo altrove non ha
    sotto gli occhi l'interfaccia che glielo mostrerebbe.

    Ma solo per i bloccanti ANCORA APERTI, e solo se si hanno gli altri task
    con cui stabilirlo. `blockedBy` da solo elenca i legami, non i blocchi.
  */
  const aperti = opzioni.tuttiITask
    ? bloccantiAperti(task, opzioni.tuttiITask)
    : [];
  if (aperti.length) {
    righe.push(
      '',
      t(
        'Careful: this task is waiting for {quante} other tasks to be closed. Until that happens, the database refuses to mark it complete.',
        { quante: aperti.length }
      )
    );
  }

  righe.push('');
  righe.push(
    t('When we are done, I will record the result in TaskFlow myself (id {id}).', {
      id: task.id.slice(0, 8),
    })
  );

  return righe.join('\n');
}

/**
 * Il comando da riga di comando che segna l'attivita' come completata.
 *
 * Il valore predefinito e' la CHIUSURA, ed e' quello giusto perche' e' il
 * gesto che si dimentica: mettere "in corso" lo si fa mentre si e' ancora
 * dentro l'applicazione, chiudere l'attivita' capita quando si e' gia'
 * altrove. Il bottone sopra promette proprio quello.
 *
 * Lo stato resta in italiano: non e' prosa, e' un argomento del comando, e
 * `statoCanonico` nel nucleo accetta sia gli alias italiani sia i valori
 * inglesi della colonna.
 */
export function comandoCli(
  task: Task,
  stato = 'completata',
  organizzazione?: string | null
): string {
  /*
    L'organizzazione si indica con `--org` e con l'IDENTIFICATIVO, non con il
    nome in una variabile d'ambiente. La prima versione faceva il contrario, ed
    era sbagliata in tre modi diversi.

    IL PRIMO E' GRAVE. `TASKFLOW_ORG="${nome}"` incolla dentro un comando da
    eseguire un testo che un ALTRA persona ha scritto: il nome
    dell'organizzazione lo decide chi l'amministra. Un nome come
    `$(curl ... | sh)` o uno che chiude le virgolette e ne apre un altro
    comando viene eseguito sul computer di chi incolla. Questa finestra dice
    "copia ed esegui", quindi la distanza fra il nome di un'organizzazione e
    l'esecuzione di codice sulla macchina di un collega era un clic.
    L'identificativo e' un UUID: sotto si verifica che lo sia davvero, e se non
    lo e' non si scrive niente — meglio un comando che chiede di indicare
    l'organizzazione a mano che uno che esegue quello che capita.

    IL SECONDO: i nomi non sono unici. Solo lo slug viene reso univoco, quindi
    due organizzazioni possono chiamarsi uguale, e `organizzazione()` risolve i
    nomi con `find()` — cioe' sceglierebbe la prima, e poi non troverebbe
    l'attivita'. L'identificativo non ha questo problema.

    IL TERZO: `VARIABILE=valore comando` e' sintassi POSIX. Su Windows —
    che l'installatore del connettore supporta esplicitamente — ne' PowerShell
    ne' cmd.exe la accettano, quindi il comando copiato li' non poteva partire.
    Un argomento funziona in tutte e tre.

    Chi ha una sola organizzazione non riceve niente: una riga piu' corta e'
    una riga che si legge.
  */
  return `${comandoBase(task, stato)}${argomentoOrg(organizzazione)}`;
}

/**
 * Il pezzo `--org <id>`, solo se l'identificativo e' davvero un UUID.
 *
 * La verifica non e' pignoleria formale: e' cio' che impedisce a un testo
 * scelto da qualcun altro di finire dentro un comando che qualcuno incollera'
 * in un terminale. Un UUID non contiene niente che una shell interpreti.
 */
const FORMA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function argomentoOrg(organizzazione?: string | null): string {
  if (!organizzazione || !FORMA_UUID.test(organizzazione)) return '';
  return ` --org ${organizzazione}`;
}

function comandoBase(task: Task, stato: string): string {
  /*
    Niente `"..."` in fondo.

    C'era, come segnaposto per la nota. Ma il pulsante accanto dice «Copia» e
    il testo sopra dice «da terminale»: chi copia incolla ed esegue, e il
    comando prendeva quei tre puntini come nota vera, salvando un commento che
    diceva "..." e avvisandone chi seguiva l'attivita'. Un segnaposto che
    nessuno ha invitato a sostituire non e' un segnaposto: e' un valore
    predefinito.

    La nota resta possibile — `stato <id> <stato> "cosa ho fatto"` e' nell'aiuto
    del comando — semplicemente non viene messa in bocca a nessuno.
  */
  return `node scripts/taskflow.mjs stato ${task.id.slice(0, 8)} ${stato}`;
}

/**
 * Le due righe da eseguire una volta sola per installare il connettore.
 *
 * L'organizzazione va indicata QUI, non solo nel comando di completamento.
 * Claude Desktop non eredita l'ambiente del terminale: se non finisce nella
 * configurazione durante l'installazione, ogni chiamata successiva si ferma in
 * `organizzazione()` — e la persona lo scopre da dentro Claude, non dal
 * terminale dove aveva appena letto "Aggiunto".
 *
 * Stessa regola del comando di completamento: solo un identificativo, e solo
 * se serve davvero.
 */
export function comandiInstallazione(organizzazione?: string | null): string {
  return (
    'node scripts/taskflow.mjs accedi\n' +
    `node scripts/mcp/taskflow.mjs --installa${argomentoOrg(organizzazione)}`
  );
}

/** La frase da dire a Claude quando il connettore MCP e' installato. */
export function frasePerMcp(task: Task, t: Traduttore = SENZA_TRADUZIONE): string {
  return t('Open TaskFlow task {id} and help me work on it.', { id: task.id.slice(0, 8) });
}
