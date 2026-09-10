import type { Task } from '@/lib/types';

/**
 * Etichette libere sui task.
 *
 * Priorita' e stato sono scale chiuse e uguali per tutti: dicono quanto un
 * lavoro e' urgente, non che COSA sia. In un'azienda che assegna lavoro
 * eterogeneo la differenza fra "richiesta cliente", "manutenzione" e
 * "adempimento" e' quella che serve per filtrare, e nessuna scala fissa la
 * copre senza diventare la scala di qualcun altro.
 *
 * Il rischio speculare e' noto: un campo di testo libero, senza vincoli,
 * produce in un mese trenta varianti della stessa etichetta. Tutto quello che
 * c'e' qui dentro esiste per contenere quel rischio.
 */

/**
 * Oltre questa lunghezza non e' piu' un'etichetta ma una frase, e in un elenco
 * di chip finirebbe comunque troncata. Tagliare qui invece che nella CSS
 * significa che il valore SALVATO e quello mostrato coincidono, quindi due
 * persone non creano mai due etichette che a schermo sembrano identiche.
 */
export const MAX_LUNGHEZZA_ETICHETTA = 32;

/** Piu' di sei voci non aiutano piu' a scegliere: fanno rileggere l'elenco. */
export const MAX_SUGGERIMENTI = 6;

/**
 * Forma canonica di un'etichetta.
 *
 * Le maiuscole si perdono, di proposito. La scelta e' fra rispettare come
 * ciascuno scrive e avere un vocabolario condiviso, e le due cose non stanno
 * insieme: senza abbassare le maiuscole "Urgente", "urgente" e "URGENTE" sono
 * tre etichette diverse per il database e una sola per chi legge, quindi il
 * filtro ne mostra un terzo dei task e l'elenco dei suggerimenti si riempie di
 * doppioni apparenti — cioe' proprio il problema che le etichette dovrebbero
 * risolvere. Il costo (chi scrive "Cliente ACME" lo rivede in minuscolo) e'
 * visibile subito e non peggiora nel tempo; il costo opposto e' invisibile
 * all'inizio e irreversibile dopo qualche centinaio di task.
 *
 * Poiche' la stessa funzione normalizza in creazione, nel suggerimento e nel
 * filtro, il testo salvato E' la chiave di confronto: non esistono due forme
 * (una da mostrare e una da confrontare) che possano divergere.
 */
export function normalizzaEtichetta(testo: string): string {
  if (!testo) return '';
  return (
    testo
      // Gli spazi interni si comprimono prima del taglio: "richiesta   cliente"
      // e "richiesta cliente" devono essere la stessa etichetta.
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .slice(0, MAX_LUNGHEZZA_ETICHETTA)
      // Il taglio puo' cadere su uno spazio e lasciarlo in coda.
      .trim()
  );
}

/**
 * Le etichette gia' in uso nell'organizzazione, dalla piu' frequente alla meno.
 *
 * L'ordine non e' estetico: e' il meccanismo con cui si evita che ognuno
 * inventi la propria. Chi apre l'elenco vede per prime quelle che il resto del
 * team usa davvero, e sceglierne una costa meno che scriverne una nuova.
 *
 * A parita' di frequenza si ordina alfabeticamente, cosi' l'elenco non cambia
 * ordine da un render all'altro davanti agli occhi di chi sta scegliendo.
 */
export function etichetteUsate(tasks: Task[]): { etichetta: string; quante: number }[] {
  const conteggio = new Map<string, number>();

  for (const task of tasks ?? []) {
    // Un doppione dentro lo stesso task ("Urgente" e "urgente") non e' due
    // task che usano l'etichetta: contarlo due volte gonfierebbe la classifica
    // proprio delle etichette scritte peggio.
    const nelTask = new Set<string>();
    for (const grezza of task?.labels ?? []) {
      const etichetta = normalizzaEtichetta(grezza);
      if (etichetta) nelTask.add(etichetta);
    }
    for (const etichetta of nelTask) {
      conteggio.set(etichetta, (conteggio.get(etichetta) ?? 0) + 1);
    }
  }

  return [...conteggio.entries()]
    .map(([etichetta, quante]) => ({ etichetta, quante }))
    .sort((a, b) => b.quante - a.quante || a.etichetta.localeCompare(b.etichetta));
}

/**
 * Completamento a partire da quello che si sta scrivendo.
 *
 * `esistenti` arriva gia' ordinato per frequenza da `etichetteUsate`, e
 * quell'ordine viene mantenuto: fra due etichette che corrispondono entrambe,
 * quella che il team usa di piu' va vista per prima.
 *
 * A campo vuoto NON restituisce l'elenco vuoto ma le piu' usate: e' il momento
 * in cui il suggerimento serve di piu', perche' chi non sa cosa esiste e'
 * esattamente chi sta per inventare l'ennesima variante.
 */
export function suggerisci(parziale: string, esistenti: string[], gia: string[]): string[] {
  const scelte = new Set((gia ?? []).map(normalizzaEtichetta));
  const cercato = normalizzaEtichetta(parziale ?? '');

  const viste = new Set<string>();
  const candidate: string[] = [];
  for (const grezza of esistenti ?? []) {
    const etichetta = normalizzaEtichetta(grezza);
    // Chi ha gia' l'etichetta non deve vedersela proporre: sceglierla non
    // farebbe nulla, e l'elenco perderebbe una riga utile.
    if (!etichetta || scelte.has(etichetta) || viste.has(etichetta)) continue;
    viste.add(etichetta);
    candidate.push(etichetta);
  }

  if (!cercato) return candidate.slice(0, MAX_SUGGERIMENTI);

  // Chi corrisponde dall'inizio prima di chi corrisponde in mezzo: scrivendo
  // "cli" ci si aspetta "cliente", non "richiesta cliente".
  const inizia = candidate.filter((e) => e.startsWith(cercato));
  const contiene = candidate.filter((e) => !e.startsWith(cercato) && e.includes(cercato));
  return [...inizia, ...contiene].slice(0, MAX_SUGGERIMENTI);
}

/**
 * Le cinque tinte del tema, non colori scritti a mano: cambiano insieme al
 * tema chiaro/scuro senza che questo file sappia nulla di quale sia attivo.
 * Sfondo tenue e bordo piu' marcato perche' sopra ci va il testo dell'etichetta
 * — il colore accompagna, non comunica: chi non lo distingue legge comunque.
 */
const TAVOLOZZA = [
  'bg-chart-1/15 border-chart-1/50 text-foreground',
  'bg-chart-2/15 border-chart-2/50 text-foreground',
  'bg-chart-3/15 border-chart-3/50 text-foreground',
  'bg-chart-4/15 border-chart-4/50 text-foreground',
  'bg-chart-5/15 border-chart-5/50 text-foreground',
] as const;

/**
 * Un colore derivato dal testo, quindi stabile ovunque e senza doverlo salvare.
 *
 * L'alternativa — una colonna `color` scelta da chi crea l'etichetta — vuol
 * dire una tabella di etichette, una schermata per gestirla e il caso in cui
 * due task hanno la stessa etichetta di due colori diversi. Derivarlo dal testo
 * costa una riga e garantisce che la stessa etichetta abbia lo stesso aspetto
 * nella scheda, nel dettaglio e nel filtro.
 *
 * L'impronta e' FNV-1a: qualunque hash stabile andrebbe, serve solo che due
 * testi vicini ("cliente", "clienti") non finiscano sempre sulla stessa tinta.
 */
export function coloreEtichetta(etichetta: string): string {
  const testo = normalizzaEtichetta(etichetta);
  if (!testo) return TAVOLOZZA[0];

  let impronta = 2166136261;
  for (let i = 0; i < testo.length; i++) {
    impronta ^= testo.charCodeAt(i);
    // `Math.imul` mantiene la moltiplicazione a 32 bit: con `*` il numero
    // supera i 2^53 e l'impronta perde le cifre basse, cioe' proprio quelle
    // che distinguono due testi simili.
    impronta = Math.imul(impronta, 16777619);
  }

  return TAVOLOZZA[(impronta >>> 0) % TAVOLOZZA.length];
}
