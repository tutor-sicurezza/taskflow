import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Plus, Tag, X } from '@phosphor-icons/react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  MAX_LUNGHEZZA_ETICHETTA,
  coloreEtichetta,
  normalizzaEtichetta,
  suggerisci,
} from '@/lib/etichette';

/**
 * Le etichette di un task.
 *
 * Il compito difficile non e' aggiungere del testo a un elenco: e' impedire
 * che l'elenco diventi inutile. Un campo libero senza aiuto produce nel giro
 * di un mese "cliente", "clienti", "Cliente ACME" e "richiesta cliente" come
 * quattro cose distinte, e a quel punto filtrare per etichetta non dice piu'
 * nulla. Per questo qui si suggerisce PRIMA di lasciar creare:
 *
 * - l'elenco dei suggerimenti e' aperto gia' a campo vuoto, con le etichette
 *   piu' usate dal team, perche' chi non sa cosa esiste e' esattamente chi sta
 *   per inventare l'ennesima variante;
 * - la voce "crea" sta in fondo e non e' mai quella preselezionata: premere
 *   Invio su un elenco con risultati sceglie un'etichetta esistente, creare
 *   richiede di arrivarci di proposito;
 * - quando ci sono corrispondenze, sopra la voce "crea" compare l'avviso che
 *   qualcosa di simile esiste gia'.
 *
 * Il componente e' controllato e non sa nulla di task: riceve `value` e
 * `esistenti`, restituisce il nuovo elenco. Serve identico in creazione e in
 * modifica, e due copie divergerebbero.
 */

interface SelettoreEtichetteProps {
  value: string[];
  onChange: (etichette: string[]) => void;
  /** Le etichette gia' in uso, in ordine di frequenza (vedi `etichetteUsate`). */
  esistenti: string[];
  disabled?: boolean;
  className?: string;
}

export function SelettoreEtichette({
  value,
  onChange,
  esistenti,
  disabled = false,
  className,
}: SelettoreEtichetteProps) {
  const { t } = useTranslation();
  const idCampo = useId();
  const idElenco = `${idCampo}-elenco`;
  const contenitore = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  const [testo, setTesto] = useState('');
  const [aperto, setAperto] = useState(false);
  // Indice della voce evidenziata da tastiera. Parte da 0, cioe' dal primo
  // suggerimento: e' il modo in cui "suggerisci prima di creare" diventa un
  // comportamento e non un consiglio.
  const [evidenziata, setEvidenziata] = useState(0);
  // Messaggio per i lettori di schermo: aggiungere o togliere un chip cambia
  // una zona lontana dal fuoco, che altrimenti nessuno annuncerebbe.
  const [annuncio, setAnnuncio] = useState('');

  const scelte = useMemo(() => value ?? [], [value]);
  const proposte = useMemo(
    () => suggerisci(testo, esistenti ?? [], scelte),
    [testo, esistenti, scelte]
  );

  const candidata = normalizzaEtichetta(testo);
  const gia = scelte.some((e) => normalizzaEtichetta(e) === candidata);
  // Se il testo scritto coincide con un suggerimento, creare non ha senso:
  // e' gia' li' nell'elenco, un clic sopra.
  const creabile = candidata.length > 0 && !gia && !proposte.includes(candidata);
  const voci: string[] = creabile ? [...proposte, candidata] : proposte;
  const indiceCrea = creabile ? voci.length - 1 : -1;

  // L'evidenziazione torna in cima ogni volta che l'elenco cambia sotto di
  // essa, altrimenti punta a una voce che non c'e' piu' o a quella sbagliata.
  useEffect(() => {
    setEvidenziata(0);
  }, [testo, aperto]);

  // Un tocco fuori chiude l'elenco. Senza, su telefono resterebbe aperto a
  // coprire il resto del modulo anche dopo aver toccato altrove.
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

  function aggiungi(grezza: string) {
    const etichetta = normalizzaEtichetta(grezza);
    if (!etichetta) return;
    // Il doppione si ferma qui: normalizzando entrambi i lati il confronto e'
    // lo stesso che usano suggerimento e filtro, quindi non esiste un caso in
    // cui l'interfaccia accetta cio' che il filtro poi non ritrova.
    if (scelte.some((e) => normalizzaEtichetta(e) === etichetta)) {
      setTesto('');
      return;
    }
    onChange([...scelte, etichetta]);
    setAnnuncio(t('Label {name} added', { name: etichetta }));
    setTesto('');
    setAperto(true);
    campo.current?.focus();
  }

  function rimuovi(etichetta: string) {
    onChange(scelte.filter((e) => e !== etichetta));
    setAnnuncio(t('Label {name} removed', { name: etichetta }));
  }

  function daTastiera(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      if (!aperto) {
        setAperto(true);
        return;
      }
      if (voci.length === 0) return;
      const passo = evento.key === 'ArrowDown' ? 1 : -1;
      setEvidenziata((corrente) => (corrente + passo + voci.length) % voci.length);
      return;
    }

    // La virgola separa le etichette come in qualunque campo di questo tipo:
    // scriverne tre di fila non deve costare tre passaggi col mouse.
    if (evento.key === 'Enter' || evento.key === ',') {
      evento.preventDefault();
      const scelta = aperto ? voci[evidenziata] : undefined;
      aggiungi(scelta ?? testo);
      return;
    }

    if (evento.key === 'Escape') {
      if (aperto) {
        // Si ferma solo quando c'e' davvero un elenco da chiudere: se il
        // componente sta dentro un dialogo, l'Escape successivo deve poterlo
        // chiudere come sempre.
        evento.preventDefault();
        evento.stopPropagation();
        setAperto(false);
      }
      return;
    }

    // A campo vuoto il tasto di cancellazione toglie l'ultimo chip: e' il
    // gesto che tutti provano, e senza di esso togliere un'etichetta
    // richiederebbe per forza il mouse.
    if (evento.key === 'Backspace' && testo === '' && scelte.length > 0) {
      evento.preventDefault();
      rimuovi(scelte[scelte.length - 1]);
    }
  }

  return (
    <div className={cn('flex flex-col gap-2', className)} ref={contenitore}>
      <Label htmlFor={idCampo} className="flex items-center gap-1.5">
        <Tag className="h-4 w-4" aria-hidden="true" />
        {t('Labels')}
      </Label>

      {scelte.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {scelte.map((etichetta) => (
            <li key={etichetta}>
              <span
                className={cn(
                  // Riga alta almeno 40px: su telefono il chip e la sua
                  // crocetta devono restare colpibili col pollice.
                  'inline-flex min-h-10 items-center gap-1 rounded-full border pl-3 pr-1 text-sm font-medium',
                  coloreEtichetta(etichetta)
                )}
              >
                <span className="max-w-[12rem] truncate">{etichetta}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => rimuovi(etichetta)}
                    aria-label={t('Remove label {name}', { name: etichetta })}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <Input
          id={idCampo}
          ref={campo}
          value={testo}
          disabled={disabled}
          maxLength={MAX_LUNGHEZZA_ETICHETTA}
          onChange={(e) => {
            setTesto(e.target.value);
            setAperto(true);
          }}
          onFocus={() => setAperto(true)}
          onKeyDown={daTastiera}
          placeholder={t('Search or add a label')}
          className="h-10"
          role="combobox"
          aria-expanded={aperto}
          aria-controls={idElenco}
          aria-autocomplete="list"
          aria-activedescendant={
            aperto && voci.length > 0 ? `${idElenco}-${evidenziata}` : undefined
          }
          aria-describedby={`${idCampo}-aiuto`}
        />

        {aperto && !disabled && (
          <div
            id={idElenco}
            role="listbox"
            aria-label={t('Label suggestions')}
            className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          >
            {proposte.length === 0 && !creabile && (
              <p className="px-2 py-2 text-sm text-muted-foreground">
                {t('No matching label in use — type to create one')}
              </p>
            )}

            {proposte.map((etichetta, indice) => (
              <div
                key={etichetta}
                id={`${idElenco}-${indice}`}
                role="option"
                aria-selected={indice === evidenziata}
                // onMouseDown e non onClick: il clic arriva dopo il blur del
                // campo, che avrebbe gia' chiuso l'elenco sotto il dito.
                onMouseDown={(e) => {
                  e.preventDefault();
                  aggiungi(etichetta);
                }}
                onMouseEnter={() => setEvidenziata(indice)}
                className={cn(
                  'flex min-h-10 cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                  indice === evidenziata && 'bg-accent text-accent-foreground'
                )}
              >
                <span
                  className={cn('h-3 w-3 shrink-0 rounded-full border', coloreEtichetta(etichetta))}
                  aria-hidden="true"
                />
                <span className="truncate">{etichetta}</span>
              </div>
            ))}

            {creabile && (
              <>
                {proposte.length > 0 && (
                  // L'avviso sta fra i suggerimenti e la voce "crea", cioe'
                  // nell'istante esatto in cui si sta per aggiungere una
                  // variante di qualcosa che esiste gia'.
                  <p className="border-t px-2 pb-1 pt-2 text-xs text-muted-foreground">
                    {t('Similar labels already exist. Reusing one keeps filters useful.')}
                  </p>
                )}
                <div
                  id={`${idElenco}-${indiceCrea}`}
                  role="option"
                  aria-selected={indiceCrea === evidenziata}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    aggiungi(candidata);
                  }}
                  onMouseEnter={() => setEvidenziata(indiceCrea)}
                  className={cn(
                    'flex min-h-10 cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                    indiceCrea === evidenziata && 'bg-accent text-accent-foreground'
                  )}
                >
                  <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{t('Create label "{name}"', { name: candidata })}</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <p id={`${idCampo}-aiuto`} className="text-xs text-muted-foreground">
        {t('Labels are saved in lowercase so the same one is never created twice.')}
      </p>

      <span aria-live="polite" className="sr-only">
        {annuncio}
      </span>
    </div>
  );
}
