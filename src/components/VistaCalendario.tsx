/* eslint-disable react-refresh/only-export-components -- La logica pura
   (griglia del mese, raggruppamento per giorno) e' esportata da qui per essere
   testata senza montare nulla: e' il requisito principale del componente. Un
   file .ts separato sarebbe stato piu' ortodosso per il fast refresh, ma non
   appartiene a questo componente e la penalita' reale — un ricaricamento
   completo invece di un aggiornamento a caldo modificando questo file — non
   vale la dispersione. */

/**
 * La vista a calendario: dove il lavoro cade nel tempo.
 *
 * L'elenco risponde a "cosa c'e' da fare", il calendario a "quando", ed e' la
 * seconda domanda che fa scoprire la settimana in cui ci si e' caricati
 * troppo. Sono due letture degli stessi dati, non due funzioni diverse:
 * qui non si modifica nulla, si clicca e si apre il task.
 *
 * Tre scelte che vale la pena spiegare:
 *
 * 1. La griglia ha SEMPRE sei settimane, anche quando il mese ne riempirebbe
 *    cinque. Con un numero variabile di righe il contenuto sotto il calendario
 *    salta di una riga intera passando da un mese all'altro, e chi naviga
 *    avanti e indietro perde il segno.
 *
 * 2. Sotto i 640px la griglia diventa un'agenda. Sette colonne su 360px danno
 *    celle da ~45px: dentro non ci sta un titolo, e senza titoli il calendario
 *    non dice piu' niente. Lo scorrimento orizzontale sarebbe stato peggio,
 *    perche' nasconde meta' mese e proprio la distribuzione nel tempo — cioe'
 *    l'unica cosa per cui esiste questa vista — smette di essere visibile in
 *    un colpo d'occhio. L'agenda rinuncia alla forma del mese ma conserva
 *    l'ordine dei giorni, i titoli e i ritardi.
 *
 * 3. La scadenza e' facoltativa, quindi una parte dei task NON e' su questa
 *    vista per costruzione. Il loro numero e' sempre a schermo: senza,
 *    passando all'elenco al calendario sembrerebbero spariti.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { addDays, addMonths, startOfMonth, startOfWeek } from 'date-fns';
import { CaretLeft, CaretRight, Warning, CalendarBlank, X } from '@phosphor-icons/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { dataScadenza, eInRitardo, haScadenza } from '@/lib/scadenze';
import type { Employee, Task, TaskPriority } from '@/lib/types';

// ---------------------------------------------------------------------------
// Logica pura — nessun React, nessun DOM, testabile in isolamento.
// ---------------------------------------------------------------------------

export const GIORNI_PER_SETTIMANA = 7;

/**
 * Sei settimane fisse: e' il massimo che un mese possa occupare (un mese di 31
 * giorni che comincia l'ultimo giorno della settimana ne tocca sei) ed e'
 * anche il minimo che teniamo, per non far cambiare altezza alla griglia.
 */
export const SETTIMANE_MOSTRATE = 6;

/** 0 = domenica, 1 = lunedi'. Sono gli unici due inizi settimana che servono. */
export type InizioSettimana = 0 | 1;

export interface GiornoCalendario {
  data: Date;
  /** Chiave locale `aaaa-mm-gg`, vedi `chiaveGiorno`. */
  chiave: string;
  /** False per i giorni di riempimento presi dal mese precedente o successivo. */
  nelMese: boolean;
  /** I task che scadono in questo giorno, gia' ordinati. */
  task: Task[];
}

export interface MeseCalendario {
  /** Il primo giorno del mese rappresentato, normalizzato a mezzanotte. */
  mese: Date;
  /** I 42 giorni in fila, nell'ordine in cui si leggono. */
  giorni: GiornoCalendario[];
  /** Gli stessi giorni divisi in righe da sette, per la griglia. */
  settimane: GiornoCalendario[][];
  /** Quanti task non compaiono affatto perche' non hanno una scadenza. */
  senzaScadenza: Task[];
}

/**
 * L'identita' di un giorno secondo il fuso dell'utente.
 *
 * NON si usa `toISOString().slice(0, 10)`: quella e' la data in UTC, e per chi
 * sta a est di Greenwich un task che scade alle 00:30 finirebbe nella casella
 * del giorno prima. Il calendario deve concordare con l'orologio di chi legge.
 */
export function chiaveGiorno(data: Date): string {
  const mese = String(data.getMonth() + 1).padStart(2, '0');
  const giorno = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mese}-${giorno}`;
}

/**
 * I 42 giorni della griglia, dal primo giorno della settimana che contiene il
 * primo del mese.
 *
 * Il conteggio e' fisso e non dipende da quanti giorni ha il mese: e' cosi'
 * che febbraio (bisestile o no) e un mese che comincia di sabato producono
 * comunque una griglia della stessa forma.
 */
export function giorniDellaGriglia(
  mese: Date,
  inizioSettimana: InizioSettimana = 1
): Date[] {
  const primo = startOfMonth(mese);
  const partenza = startOfWeek(primo, { weekStartsOn: inizioSettimana });
  return Array.from({ length: SETTIMANE_MOSTRATE * GIORNI_PER_SETTIMANA }, (_, i) =>
    addDays(partenza, i)
  );
}

/** Il peso di una priorita' nell'ordinamento: prima le urgenze. */
const PESO_PRIORITA: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

/**
 * L'ordine dei task dentro una singola casella.
 *
 * In un giorno la data non distingue piu' niente, quindi ordina quello che
 * conta davvero per chi guarda: prima cio' che e' ancora aperto (un task
 * chiuso non e' un carico), poi la priorita', poi il titolo — che non aggiunge
 * significato ma rende l'ordine stabile, cioe' evita che due render dello
 * stesso giorno mostrino la stessa lista in ordine diverso.
 */
export function ordinaTaskDelGiorno(task: Task[]): Task[] {
  return [...task].sort((a, b) => {
    const chiusoA = a.status === 'completed' ? 1 : 0;
    const chiusoB = b.status === 'completed' ? 1 : 0;
    if (chiusoA !== chiusoB) return chiusoA - chiusoB;

    const pesoA = PESO_PRIORITA[a.priority] ?? 99;
    const pesoB = PESO_PRIORITA[b.priority] ?? 99;
    if (pesoA !== pesoB) return pesoA - pesoB;

    return a.title.localeCompare(b.title);
  });
}

/**
 * Divide i task fra "cade in un giorno" e "non ha una scadenza".
 *
 * I secondi non sono un caso limite da ignorare: sono task veri, e restituirli
 * insieme alla mappa costringe chi disegna la vista a decidere cosa farne
 * invece di lasciarli cadere silenziosamente.
 */
export function raggruppaPerScadenza(task: Task[]): {
  perGiorno: Map<string, Task[]>;
  senzaScadenza: Task[];
} {
  const perGiorno = new Map<string, Task[]>();
  const senzaScadenza: Task[] = [];

  for (const t of task) {
    // `dataScadenza` e non `new Date(t.dueDate)`: la scadenza puo' essere
    // assente, nulla o malformata, e in tutti e tre i casi la risposta e' la
    // stessa — questo task non ha un posto sul calendario.
    const data = haScadenza(t) ? dataScadenza(t) : null;
    if (!data) {
      senzaScadenza.push(t);
      continue;
    }

    const chiave = chiaveGiorno(data);
    const esistenti = perGiorno.get(chiave);
    if (esistenti) esistenti.push(t);
    else perGiorno.set(chiave, [t]);
  }

  for (const [chiave, elenco] of perGiorno) {
    perGiorno.set(chiave, ordinaTaskDelGiorno(elenco));
  }

  return { perGiorno, senzaScadenza };
}

/**
 * Il modello completo di un mese: la griglia, i task al posto giusto e quelli
 * che un posto non ce l'hanno.
 *
 * E' l'unica funzione che il componente chiama: tutto cio' che c'e' da
 * verificare sul calendario si verifica qui, senza montare React.
 */
export function costruisciMese(
  task: Task[],
  mese: Date,
  inizioSettimana: InizioSettimana = 1
): MeseCalendario {
  const { perGiorno, senzaScadenza } = raggruppaPerScadenza(task);
  const primo = startOfMonth(mese);

  const giorni: GiornoCalendario[] = giorniDellaGriglia(primo, inizioSettimana).map((data) => {
    const chiave = chiaveGiorno(data);
    return {
      data,
      chiave,
      // Confronto su anno e mese e non solo sul mese: a gennaio i giorni di
      // riempimento vengono da dicembre dell'anno prima, e un confronto sul
      // solo numero del mese li darebbe entrambi "dicembre".
      nelMese:
        data.getMonth() === primo.getMonth() && data.getFullYear() === primo.getFullYear(),
      task: perGiorno.get(chiave) ?? [],
    };
  });

  const settimane: GiornoCalendario[][] = [];
  for (let i = 0; i < giorni.length; i += GIORNI_PER_SETTIMANA) {
    settimane.push(giorni.slice(i, i + GIORNI_PER_SETTIMANA));
  }

  return { mese: primo, giorni, settimane, senzaScadenza };
}

/**
 * Le intestazioni dei giorni, nella lingua corrente.
 *
 * Parte da una settimana di riferimento nota (il 7 gennaio 2024 e' una
 * domenica) invece di dedurre l'offset dalla data odierna: cosi' la funzione
 * non dipende da quando viene chiamata, e quindi si puo' testare.
 */
export function nomiGiorniSettimana(
  lingua: string,
  inizioSettimana: InizioSettimana = 1
): { corto: string; lungo: string }[] {
  const domenicaNota = new Date(2024, 0, 7);
  return Array.from({ length: GIORNI_PER_SETTIMANA }, (_, i) => {
    const data = addDays(domenicaNota, i + inizioSettimana);
    return {
      corto: data.toLocaleDateString(lingua, { weekday: 'short' }),
      lungo: data.toLocaleDateString(lingua, { weekday: 'long' }),
    };
  });
}

/** "Marzo 2026" nella lingua corrente. */
export function etichettaMese(mese: Date, lingua: string): string {
  return mese.toLocaleDateString(lingua, { month: 'long', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/** Oltre questo numero la casella smette di crescere e riassume il resto. */
const MAX_TASK_PER_CASELLA = 3;

/** Sotto questa larghezza la griglia diventa un'agenda. Vedi il commento in testa. */
const LARGHEZZA_GRIGLIA = '(min-width: 640px)';

/**
 * Osserva una media query senza stato duplicato.
 *
 * `useSyncExternalStore` invece di useState + useEffect perche' il primo
 * render legge gia' il valore vero: con l'effetto, al primo fotogramma su
 * telefono comparirebbe la griglia a sette colonne, subito sostituita
 * dall'agenda.
 */
// Il nome deve cominciare per `use` anche in un progetto commentato in
// italiano: e' l'unico modo in cui la regola dei hook di React riconosce che
// qui dentro si possono chiamare gli hook.
function useMediaQuery(query: string): boolean {
  const sottoscrivi = useCallback(
    (avvisa: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener('change', avvisa);
      return () => mq.removeEventListener('change', avvisa);
    },
    [query]
  );

  return useSyncExternalStore(
    sottoscrivi,
    () => (typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches
      : true),
    // Fuori dal browser si assume lo schermo largo: e' la forma "canonica"
    // della vista, e sbagliare qui costa solo un riadattamento all'idratazione.
    () => true
  );
}

const COLORI_PRIORITA: Record<TaskPriority, string> = {
  high: 'border-l-accent',
  medium: 'border-l-amber-500',
  low: 'border-l-slate-400',
};

interface Props {
  tasks: Task[];
  employees: Employee[];
  onViewTask: (taskId: string) => void;
}

export function VistaCalendario({ tasks, employees, onViewTask }: Props) {
  const { t, lingua } = useTranslation();
  const schermoLargo = useMediaQuery(LARGHEZZA_GRIGLIA);

  // La settimana comincia di lunedi' ovunque tranne che in inglese: e' la
  // convenzione delle lingue che l'applicazione parla, e sbagliarla sposta
  // l'intera griglia di una colonna.
  const inizioSettimana: InizioSettimana = lingua === 'en' ? 0 : 1;

  const oggi = useMemo(() => new Date(), []);
  const [meseVisibile, setMeseVisibile] = useState<Date>(() => startOfMonth(new Date()));

  // Il giorno "attivo" e' uno solo: e' quello che riceve il focus con le
  // frecce ed e' quello che il pannello di dettaglio mostra. Tenerne due
  // separati faceva divergere cio' che e' selezionato da cio' che si vede.
  const [giornoAttivo, setGiornoAttivo] = useState<string>(() => chiaveGiorno(new Date()));
  const [giornoAperto, setGiornoAperto] = useState<string | null>(null);

  const modello = useMemo(
    () => costruisciMese(tasks, meseVisibile, inizioSettimana),
    [tasks, meseVisibile, inizioSettimana]
  );

  const intestazioni = useMemo(
    () => nomiGiorniSettimana(lingua, inizioSettimana),
    [lingua, inizioSettimana]
  );

  const nomePerId = useMemo(() => {
    const mappa = new Map<string, string>();
    for (const e of employees) mappa.set(e.id, e.name);
    return mappa;
  }, [employees]);

  const chiaveOggi = chiaveGiorno(oggi);

  // Le celle si registrano qui per poter ricevere il focus da tastiera. Un ref
  // e non uno stato: cambia a ogni render della griglia e non deve provocarne
  // un altro.
  const celle = useRef(new Map<string, HTMLDivElement>());

  // Il focus va spostato SOLO dopo una navigazione da tastiera. Senza questa
  // guardia il calendario ruberebbe il focus al primo render, buttando fuori
  // chi stava scrivendo altrove nella pagina.
  const daFocalizzare = useRef<string | null>(null);

  useEffect(() => {
    const chiave = daFocalizzare.current;
    if (!chiave) return;
    daFocalizzare.current = null;
    celle.current.get(chiave)?.focus();
  });

  const vaiA = useCallback((data: Date, conFocus = true) => {
    const chiave = chiaveGiorno(data);
    setGiornoAttivo(chiave);
    // Se la data esce dal mese mostrato si cambia mese: e' cio' che rende la
    // navigazione con le frecce continua invece di fermarsi al bordo.
    setMeseVisibile((precedente) =>
      data.getMonth() === precedente.getMonth() && data.getFullYear() === precedente.getFullYear()
        ? precedente
        : startOfMonth(data)
    );
    if (conFocus) daFocalizzare.current = chiave;
  }, []);

  const apri = useCallback((chiave: string) => {
    setGiornoAttivo(chiave);
    setGiornoAperto((precedente) => (precedente === chiave ? null : chiave));
  }, []);

  const gestisciTasti = useCallback(
    (evento: React.KeyboardEvent<HTMLDivElement>, giorno: GiornoCalendario) => {
      const salta = (giorni: number) => {
        evento.preventDefault();
        vaiA(addDays(giorno.data, giorni));
      };

      switch (evento.key) {
        case 'ArrowLeft':
          return salta(-1);
        case 'ArrowRight':
          return salta(1);
        case 'ArrowUp':
          return salta(-GIORNI_PER_SETTIMANA);
        case 'ArrowDown':
          return salta(GIORNI_PER_SETTIMANA);
        case 'Home':
          evento.preventDefault();
          return vaiA(startOfWeek(giorno.data, { weekStartsOn: inizioSettimana }));
        case 'End':
          evento.preventDefault();
          return vaiA(
            addDays(startOfWeek(giorno.data, { weekStartsOn: inizioSettimana }), GIORNI_PER_SETTIMANA - 1)
          );
        case 'PageUp':
          evento.preventDefault();
          return vaiA(addMonths(giorno.data, -1));
        case 'PageDown':
          evento.preventDefault();
          return vaiA(addMonths(giorno.data, 1));
        case 'Enter':
        case ' ':
          evento.preventDefault();
          return apri(giorno.chiave);
        default:
      }
    },
    [apri, inizioSettimana, vaiA]
  );

  const cambiaMese = (delta: number) => {
    const prossimo = addMonths(meseVisibile, delta);
    setMeseVisibile(prossimo);
    setGiornoAperto(null);
    // Il giorno attivo segue il mese, altrimenti alla prima freccia il focus
    // riporterebbe indietro al mese da cui si e' appena usciti.
    setGiornoAttivo(chiaveGiorno(prossimo));
  };

  const tornaAOggi = () => {
    const adesso = new Date();
    setMeseVisibile(startOfMonth(adesso));
    setGiornoAttivo(chiaveGiorno(adesso));
    setGiornoAperto(null);
  };

  const giornoDiDettaglio = giornoAperto
    ? modello.giorni.find((g) => g.chiave === giornoAperto) ?? null
    : null;

  const taskDelMese = modello.giorni
    .filter((g) => g.nelMese)
    .reduce((somma, g) => somma + g.task.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => cambiaMese(-1)}
            aria-label={t('Previous month')}
          >
            <CaretLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => cambiaMese(1)}
            aria-label={t('Next month')}
          >
            <CaretRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="sm" onClick={tornaAOggi}>
            {t('Today')}
          </Button>
        </div>

        {/*
          `aria-live`: cambiando mese con i pulsanti non cambia il focus, quindi
          senza annuncio un lettore di schermo non direbbe mai dove si e'
          finiti. La prima lettera maiuscola perche' in parecchie lingue
          `toLocaleDateString` restituisce il mese minuscolo.
        */}
        <h2 className="text-lg font-semibold capitalize" aria-live="polite">
          {etichettaMese(modello.mese, lingua)}
        </h2>

        <p className="text-xs text-muted-foreground">
          {t('{count} scheduled this month', { count: taskDelMese })}
        </p>
      </div>

      {schermoLargo ? (
        <Card className="overflow-hidden p-2">
          <div
            role="grid"
            aria-label={t('Tasks by due date for {month}', {
              month: etichettaMese(modello.mese, lingua),
            })}
            className="grid grid-cols-7 gap-px"
          >
            <div role="row" className="contents">
              {intestazioni.map((giorno) => (
                <div
                  key={giorno.lungo}
                  role="columnheader"
                  // Il nome per esteso al lettore di schermo, l'abbreviazione a
                  // schermo: "lun" letto ad alta voce non significa niente.
                  aria-label={giorno.lungo}
                  className="pb-1 text-center text-xs font-medium uppercase text-muted-foreground"
                >
                  <span aria-hidden="true">{giorno.corto}</span>
                </div>
              ))}
            </div>

            {modello.settimane.map((settimana) => (
              <div role="row" className="contents" key={settimana[0].chiave}>
                {settimana.map((giorno) => (
                  <CellaGiorno
                    key={giorno.chiave}
                    giorno={giorno}
                    eOggi={giorno.chiave === chiaveOggi}
                    attivo={giorno.chiave === giornoAttivo}
                    aperto={giorno.chiave === giornoAperto}
                    lingua={lingua}
                    nomePerId={nomePerId}
                    onApri={apri}
                    onTasti={gestisciTasti}
                    onViewTask={onViewTask}
                    registra={(nodo) => {
                      if (nodo) celle.current.set(giorno.chiave, nodo);
                      else celle.current.delete(giorno.chiave);
                    }}
                    t={t}
                  />
                ))}
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Agenda
          modello={modello}
          chiaveOggi={chiaveOggi}
          lingua={lingua}
          nomePerId={nomePerId}
          onViewTask={onViewTask}
          t={t}
        />
      )}

      {giornoDiDettaglio && schermoLargo && (
        <Card className="p-4" role="region" aria-label={t('Selected day')}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-medium capitalize">
              {giornoDiDettaglio.data.toLocaleDateString(lingua, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setGiornoAperto(null)}
              aria-label={t('Close')}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          {giornoDiDettaglio.task.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('Nothing due on this day')}</p>
          ) : (
            <ul className="space-y-2">
              {giornoDiDettaglio.task.map((task) => (
                <li key={task.id}>
                  <RigaTask
                    task={task}
                    nomeAssegnatario={
                      task.assigneeId ? nomePerId.get(task.assigneeId) ?? null : null
                    }
                    onViewTask={onViewTask}
                    t={t}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/*
        I task senza scadenza non stanno da nessuna parte su un calendario, ma
        esistono: mostrarne il numero e' cio' che impedisce di leggere questa
        vista come "tutto il lavoro che c'e'".
      */}
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarBlank className="h-4 w-4 shrink-0" aria-hidden="true" />
        {modello.senzaScadenza.length === 0
          ? t('Every task has a due date')
          : t('{count} tasks have no due date and are not shown here', {
              count: modello.senzaScadenza.length,
            })}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pezzi interni
// ---------------------------------------------------------------------------

type Traduci = (chiave: string, parametri?: Record<string, string | number>) => string;

interface PropsCella {
  giorno: GiornoCalendario;
  eOggi: boolean;
  attivo: boolean;
  aperto: boolean;
  lingua: string;
  nomePerId: Map<string, string>;
  onApri: (chiave: string) => void;
  onTasti: (evento: React.KeyboardEvent<HTMLDivElement>, giorno: GiornoCalendario) => void;
  onViewTask: (taskId: string) => void;
  registra: (nodo: HTMLDivElement | null) => void;
  t: Traduci;
}

function CellaGiorno({
  giorno,
  eOggi,
  attivo,
  aperto,
  lingua,
  nomePerId,
  onApri,
  onTasti,
  onViewTask,
  registra,
  t,
}: PropsCella) {
  const visibili = giorno.task.slice(0, MAX_TASK_PER_CASELLA);
  const nascosti = giorno.task.length - visibili.length;
  const inRitardo = giorno.task.filter((task) => eInRitardo(task)).length;

  // Un solo riepilogo parlato per casella: leggere trenta elementi uno per uno
  // renderebbe la griglia impraticabile con un lettore di schermo. I titoli
  // restano raggiungibili aprendo il giorno.
  const descrizione = [
    giorno.data.toLocaleDateString(lingua, { weekday: 'long', day: 'numeric', month: 'long' }),
    t('{count} tasks', { count: giorno.task.length }),
    inRitardo > 0 ? t('{count} overdue', { count: inRitardo }) : '',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div
      ref={registra}
      role="gridcell"
      // Roving tabindex: una sola cella per volta e' nell'ordine di
      // tabulazione, le altre si raggiungono con le frecce. Cosi' il Tab
      // attraversa il calendario in un colpo invece che in quarantadue.
      tabIndex={attivo ? 0 : -1}
      aria-selected={aperto}
      aria-label={descrizione}
      onKeyDown={(evento) => onTasti(evento, giorno)}
      onClick={() => onApri(giorno.chiave)}
      className={cn(
        'min-h-24 cursor-pointer rounded-md border bg-card p-1 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        !giorno.nelMese && 'bg-muted/40 text-muted-foreground',
        eOggi && 'border-primary',
        aperto && 'ring-2 ring-primary'
      )}
    >
      <div className="mb-1 flex items-center justify-between px-1">
        <span
          className={cn(
            'text-xs font-medium',
            eOggi &&
              'flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground'
          )}
        >
          {giorno.data.getDate()}
        </span>
        {inRitardo > 0 && (
          <Warning className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
        )}
      </div>

      <div className="space-y-1">
        {visibili.map((task) => (
          <ChipTask
            key={task.id}
            task={task}
            nomeAssegnatario={task.assigneeId ? nomePerId.get(task.assigneeId) ?? null : null}
            onViewTask={onViewTask}
            t={t}
          />
        ))}

        {nascosti > 0 && (
          <button
            type="button"
            // Fuori dall'ordine di tabulazione come i chip: dentro una griglia
            // ARIA si entra con le frecce, e il giorno aperto porta gli stessi
            // task in pulsanti raggiungibili normalmente.
            tabIndex={-1}
            onClick={(evento) => {
              evento.stopPropagation();
              onApri(giorno.chiave);
            }}
            className="w-full rounded px-1 text-left text-[11px] text-muted-foreground hover:underline"
          >
            {t('+{count} more', { count: nascosti })}
          </button>
        )}
      </div>
    </div>
  );
}

interface PropsTask {
  task: Task;
  nomeAssegnatario: string | null;
  onViewTask: (taskId: string) => void;
  t: Traduci;
}

/** La versione compatta dentro la casella: titolo, priorita', assegnatario. */
function ChipTask({ task, nomeAssegnatario, onViewTask, t }: PropsTask) {
  const ritardo = eInRitardo(task);

  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={(evento) => {
        // Senza questo il click aprirebbe anche il giorno sottostante: due
        // azioni per un gesto solo.
        evento.stopPropagation();
        onViewTask(task.id);
      }}
      title={task.title}
      className={cn(
        'block w-full truncate rounded border-l-2 bg-muted/60 px-1 py-0.5 text-left text-[11px] hover:bg-muted',
        COLORI_PRIORITA[task.priority],
        ritardo && 'bg-destructive/10 font-medium'
      )}
    >
      {/* Il ritardo non e' comunicato dal solo colore: c'e' anche il simbolo,
          e per chi non vede nemmeno quello c'e' la parola, nascosta a schermo. */}
      {ritardo && (
        <>
          <span aria-hidden="true">! </span>
          <span className="sr-only">{t('Overdue')}: </span>
        </>
      )}
      <span className="sr-only">{t('Priority: {priority}', { priority: t(etichettaPriorita(task.priority)) })}. </span>
      {task.title}
      {nomeAssegnatario && (
        <span className="text-muted-foreground"> · {nomeAssegnatario}</span>
      )}
    </button>
  );
}

/** La versione estesa: nel pannello del giorno e nell'agenda da telefono. */
function RigaTask({ task, nomeAssegnatario, onViewTask, t }: PropsTask) {
  const ritardo = eInRitardo(task);

  return (
    <button
      type="button"
      onClick={() => onViewTask(task.id)}
      className={cn(
        'flex w-full items-center gap-2 rounded-md border border-l-4 p-2 text-left transition-colors hover:bg-muted',
        COLORI_PRIORITA[task.priority],
        ritardo && 'border-destructive/60 bg-destructive/5'
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {ritardo && (
            <Warning className="h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />
          )}
          <span className="truncate text-sm font-medium">{task.title}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {nomeAssegnatario ?? t('Unassigned')}
        </span>
      </div>

      {ritardo && (
        <Badge variant="destructive" className="shrink-0 text-[10px]">
          {t('Overdue')}
        </Badge>
      )}
      <Badge variant="secondary" className="shrink-0 text-[10px]">
        {t(etichettaPriorita(task.priority))}
      </Badge>
    </button>
  );
}

function etichettaPriorita(priorita: TaskPriority): string {
  return priorita === 'high' ? 'High' : priorita === 'medium' ? 'Medium' : 'Low';
}

interface PropsAgenda {
  modello: MeseCalendario;
  chiaveOggi: string;
  lingua: string;
  nomePerId: Map<string, string>;
  onViewTask: (taskId: string) => void;
  t: Traduci;
}

/**
 * La forma da telefono: i soli giorni del mese che hanno qualcosa, in ordine.
 *
 * Non e' una griglia compressa ma un altro modo di leggere lo stesso mese —
 * per questo non usa `role="grid"`: annunciare righe e colonne che a schermo
 * non ci sono confonderebbe, mentre un elenco di intestazioni con sotto i loro
 * task e' navigabile con i comandi che un lettore di schermo ha gia'.
 */
function Agenda({ modello, chiaveOggi, lingua, nomePerId, onViewTask, t }: PropsAgenda) {
  const giorniPieni = modello.giorni.filter((g) => g.nelMese && g.task.length > 0);

  if (giorniPieni.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        {t('Nothing is due this month')}
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {giorniPieni.map((giorno) => (
        <Card key={giorno.chiave} className="p-3">
          <h3
            className={cn(
              'mb-2 text-sm font-semibold capitalize',
              giorno.chiave === chiaveOggi && 'text-primary'
            )}
          >
            {giorno.data.toLocaleDateString(lingua, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
            {giorno.chiave === chiaveOggi && (
              <span className="ml-2 text-xs font-normal">({t('Today')})</span>
            )}
          </h3>
          <ul className="space-y-2">
            {giorno.task.map((task) => (
              <li key={task.id}>
                <RigaTask
                  task={task}
                  nomeAssegnatario={
                    task.assigneeId ? nomePerId.get(task.assigneeId) ?? null : null
                  }
                  onViewTask={onViewTask}
                  t={t}
                />
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

export default VistaCalendario;
