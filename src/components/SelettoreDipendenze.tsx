import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { LinkSimple, MagnifyingGlass, Plus, Prohibit, X } from '@phosphor-icons/react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { creerebbeCiclo } from '@/lib/dipendenze';
import { eChiusoDavvero } from '@/lib/approvazione';
import type { Employee, Task } from '@/lib/types';

/**
 * Da quali task dipende questo: chi deve chiudersi prima.
 *
 * Il compito difficile non e' scegliere da un elenco, e' non lasciar creare un
 * anello. Un ciclo — A aspetta B, B aspetta C, C aspetta A — non da' errore da
 * nessuna parte: semplicemente tre lavori restano fermi per sempre, e chi li
 * guarda vede tre schede che si rimandano l'una all'altra senza capire da dove
 * cominciare. Il database sa fermare solo il caso "un task aspetta se stesso"
 * (serve una ricorsione per gli altri), quindi tocca a qui.
 *
 * La scelta che pesa e' MOSTRARE le voci impossibili invece di nasconderle.
 * Toglierle dall'elenco sarebbe stato meno codice, ma chi cerca un task per
 * titolo e non lo trova conclude che il task non esista, o che la ricerca sia
 * rotta: la cosa da spiegare — "quello ti sta gia' aspettando" — e' proprio
 * l'informazione che serve per capire come procedere.
 *
 * Il componente e' controllato e non salva: riceve `value`, restituisce il
 * nuovo elenco. Serve identico in creazione e in modifica, e due copie
 * divergerebbero.
 */

interface SelettoreDipendenzeProps {
  /** Gli id dei task che devono chiudersi prima di questo. */
  value: string[];
  onChange: (dipendenze: string[]) => void;
  /**
   * Il task che si sta modificando. In creazione puo' avere un id provvisorio
   * o vuoto: serve solo a escludere se stesso e a cercare i cicli, e un task
   * che non esiste ancora non puo' essere dentro il `blockedBy` di nessuno.
   */
  taskCorrente: Task;
  tuttiITask: Task[];
  employees: Employee[];
  disabled?: boolean;
  className?: string;
}

export function SelettoreDipendenze({
  value,
  onChange,
  taskCorrente,
  tuttiITask,
  employees,
  disabled = false,
  className,
}: SelettoreDipendenzeProps) {
  const { t } = useTranslation();
  const idCampo = useId();
  const idElenco = `${idCampo}-elenco`;
  const contenitore = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  const [testo, setTesto] = useState('');
  const [aperto, setAperto] = useState(false);
  const [evidenziata, setEvidenziata] = useState(0);
  // Aggiungere o togliere una dipendenza cambia una zona lontana dal fuoco:
  // senza questo annuncio un lettore di schermo non direbbe niente.
  const [annuncio, setAnnuncio] = useState('');

  const scelte = useMemo(() => value ?? [], [value]);

  const taskPerId = useMemo(() => {
    const mappa = new Map<string, Task>();
    for (const altro of tuttiITask ?? []) mappa.set(altro.id, altro);
    return mappa;
  }, [tuttiITask]);

  const personePerId = useMemo(() => {
    const mappa = new Map<string, Employee>();
    for (const persona of employees ?? []) mappa.set(persona.id, persona);
    return mappa;
  }, [employees]);

  /**
   * L'elenco su cui si cerca, con gia' calcolato il motivo per cui una voce
   * non e' scegliebile.
   *
   * Il controllo del ciclo si fa QUI e non al momento del clic: una voce che
   * accetta il clic e poi rifiuta e' un tranello, e per chi usa la tastiera
   * sarebbe anche impossibile capire quale voce sia il problema.
   *
   * Il `blockedBy` provvisorio passato a `creerebbeCiclo` e' `value` e non
   * quello del task salvato: durante la modifica le due cose divergono, e
   * usare il secondo lascerebbe creare un anello con le scelte appena fatte in
   * questa stessa sessione.
   */
  const candidati = useMemo(() => {
    const gia = new Set(scelte);
    const cercato = testo.trim().toLowerCase();
    // La vista del grafo che tiene conto delle modifiche non ancora salvate.
    const grafo = (tuttiITask ?? []).map((altro) =>
      altro.id === taskCorrente.id ? { ...altro, blockedBy: scelte } : altro
    );

    return (tuttiITask ?? [])
      .filter((altro) => {
        if (altro.id === taskCorrente.id) return false;
        if (gia.has(altro.id)) return false;
        // Un task gia' archiviato non tornera' mai ad "aperto": farci
        // dipendere del lavoro nuovo non aggiunge un'attesa, aggiunge solo
        // una riga che confonde.
        if (altro.archivedAt) return false;
        if (!cercato) return true;
        return altro.title.toLowerCase().includes(cercato);
      })
      .map((altro) => ({
        task: altro,
        ciclo: creerebbeCiclo(taskCorrente.id, altro.id, grafo),
      }));
  }, [tuttiITask, taskCorrente.id, scelte, testo]);

  // Prima voce scegliebile: e' li' che deve puntare l'evidenziazione quando
  // l'elenco cambia, altrimenti Invio finirebbe su una voce rifiutata.
  const primaLibera = candidati.findIndex((voce) => !voce.ciclo);

  useEffect(() => {
    setEvidenziata(primaLibera >= 0 ? primaLibera : 0);
    // Volutamente non dipende da `primaLibera` soltanto: e' il cambio di testo
    // o l'apertura a dover riportare l'evidenziazione in cima.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testo, aperto]);

  useEffect(() => {
    if (!aperto) return;
    const fuori = (evento: MouseEvent | TouchEvent) => {
      if (!contenitore.current?.contains(evento.target as Node)) setAperto(false);
    };
    document.addEventListener('mousedown', fuori);
    document.addEventListener('touchstart', fuori);
    return () => {
      document.removeEventListener('mousedown', fuori);
      document.removeEventListener('touchstart', fuori);
    };
  }, [aperto]);

  function titolo(id: string): string {
    // Un id senza task e' un riferimento rotto: il trigger sul database li
    // ripulisce, ma una lettura fatta prima o un import possono contenerne, e
    // vanno mostrati proprio perche' sono l'unica cosa che si puo' togliere.
    return taskPerId.get(id)?.title ?? t('Task no longer available');
  }

  function aggiungi(id: string) {
    if (!id || id === taskCorrente.id || scelte.includes(id)) return;
    onChange([...scelte, id]);
    setAnnuncio(t('This task now waits for {title}', { title: titolo(id) }));
    setTesto('');
    campo.current?.focus();
  }

  function rimuovi(id: string) {
    onChange(scelte.filter((altro) => altro !== id));
    setAnnuncio(t('This task no longer waits for {title}', { title: titolo(id) }));
  }

  /** Sposta l'evidenziazione saltando le voci che creerebbero un ciclo. */
  function scorri(passo: number) {
    if (candidati.length === 0) return;
    for (let salti = 1; salti <= candidati.length; salti++) {
      const grezza = (evidenziata + passo * salti) % candidati.length;
      const prossima = (grezza + candidati.length) % candidati.length;
      if (!candidati[prossima]?.ciclo) {
        setEvidenziata(prossima);
        return;
      }
    }
  }

  function daTastiera(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      if (!aperto) {
        setAperto(true);
        return;
      }
      scorri(evento.key === 'ArrowDown' ? 1 : -1);
      return;
    }

    if (evento.key === 'Enter') {
      evento.preventDefault();
      const scelto = candidati[evidenziata];
      if (scelto && !scelto.ciclo) aggiungi(scelto.task.id);
      return;
    }

    if (evento.key === 'Escape' && aperto) {
      // Fermato solo con l'elenco aperto: dentro un dialogo, l'Escape
      // successivo deve continuare a chiuderlo.
      evento.preventDefault();
      evento.stopPropagation();
      setAperto(false);
      return;
    }

    // A campo vuoto il tasto di cancellazione toglie l'ultima dipendenza: e'
    // il gesto che tutti provano, e senza di esso servirebbe il mouse.
    if (evento.key === 'Backspace' && testo === '' && scelte.length > 0) {
      evento.preventDefault();
      rimuovi(scelte[scelte.length - 1]);
    }
  }

  return (
    <div className={cn('flex flex-col gap-2', className)} ref={contenitore}>
      <Label htmlFor={idCampo} className="flex items-center gap-1.5">
        <LinkSimple className="h-4 w-4" aria-hidden="true" />
        {t('Waiting for these tasks')}
      </Label>

      {scelte.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {scelte.map((id) => {
            const bloccante = taskPerId.get(id);
            const chiuso = bloccante ? eChiusoDavvero(bloccante) : false;
            const assegnatario = bloccante?.assigneeId
              ? personePerId.get(bloccante.assigneeId)?.name
              : null;
            return (
              <li key={id} className="flex min-h-10 items-center gap-2 rounded-md border px-2 py-1">
                <div className="flex min-w-0 flex-col">
                  <span className={cn('truncate text-sm', chiuso && 'text-muted-foreground')}>
                    {titolo(id)}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {chiuso ? t('Done — no longer holds this task') : t('Still open')}
                    {assegnatario ? ` · ${assegnatario}` : ''}
                  </span>
                </div>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => rimuovi(id)}
                    aria-label={t('Stop waiting for {title}', { title: titolo(id) })}
                    className="ml-auto inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-8 sm:w-8"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{t('This task does not wait for anything')}</p>
      )}

      {!disabled && (
        <div className="relative">
          <MagnifyingGlass
            className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={idCampo}
            ref={campo}
            value={testo}
            onChange={(e) => {
              setTesto(e.target.value);
              setAperto(true);
            }}
            onFocus={() => setAperto(true)}
            onKeyDown={daTastiera}
            placeholder={t('Search a task that must be done first')}
            className="h-10 pl-8"
            role="combobox"
            aria-expanded={aperto}
            aria-controls={idElenco}
            aria-autocomplete="list"
            aria-activedescendant={
              aperto && candidati.length > 0 ? `${idElenco}-${evidenziata}` : undefined
            }
            aria-describedby={`${idCampo}-aiuto`}
          />

          {aperto && (
            <div
              id={idElenco}
              role="listbox"
              aria-label={t('Tasks that can come first')}
              className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
            >
              {candidati.length === 0 && (
                <p className="px-2 py-2 text-sm text-muted-foreground">
                  {t('No other task to wait for')}
                </p>
              )}

              {candidati.map((voce, indice) => (
                <div
                  key={voce.task.id}
                  id={`${idElenco}-${indice}`}
                  role="option"
                  aria-selected={indice === evidenziata}
                  aria-disabled={voce.ciclo || undefined}
                  // onMouseDown e non onClick: il clic arriverebbe dopo il
                  // blur del campo, che avrebbe gia' chiuso l'elenco sotto il
                  // dito.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (!voce.ciclo) aggiungi(voce.task.id);
                  }}
                  onMouseEnter={() => {
                    if (!voce.ciclo) setEvidenziata(indice);
                  }}
                  className={cn(
                    'flex min-h-10 items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                    voce.ciclo ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
                    indice === evidenziata && !voce.ciclo && 'bg-accent text-accent-foreground'
                  )}
                >
                  {voce.ciclo ? (
                    <Prohibit className="h-4 w-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{voce.task.title}</span>
                    {voce.ciclo && (
                      // Il motivo, non un semplice "non disponibile": senza,
                      // chi legge non ha modo di sapere che il legame esiste
                      // gia' nel verso opposto.
                      <span className="truncate text-xs">
                        {t('Not available: that task is already waiting for this one')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p id={`${idCampo}-aiuto`} className="text-xs text-muted-foreground">
        {t('A task can be completed only after everything it waits for is done.')}
      </p>

      <span aria-live="polite" className="sr-only">
        {annuncio}
      </span>
    </div>
  );
}
