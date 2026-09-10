import { useId, useRef, useState, type KeyboardEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ListChecks,
  PencilSimple,
  Plus,
  Trash,
} from '@phosphor-icons/react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  MAX_LUNGHEZZA_PASSO,
  MAX_SOTTOATTIVITA,
  aggiungiSottoattivita,
  avanzamento,
  elencoPieno,
  eliminaSottoattivita,
  normalizzaPasso,
  rinominaSottoattivita,
  spostaSottoattivita,
  spuntaSottoattivita,
} from '@/lib/sottoattivita';
import type { Sottoattivita } from '@/lib/types';

/**
 * L'elenco a spunte dei passi di un task.
 *
 * Il componente e' controllato e non sa nulla del database: riceve `value`,
 * restituisce il nuovo elenco con `onChange`. Serve identico in creazione, in
 * modifica e nel dettaglio del task, e tre copie divergerebbero; inoltre in
 * creazione il task non esiste ancora, quindi non c'e' proprio niente da
 * salvare mentre lo si compila. Tutte le regole stanno in
 * `@/lib/sottoattivita`, e qui restano solo il disegno e i gesti.
 *
 * Due scelte che pesano:
 *
 * - E' una lista di CASELLE DI CONTROLLO vere, non di div cliccabili. Una
 *   spunta finta non si raggiunge con Tab, non si aziona con la barra
 *   spaziatrice e non viene annunciata come "casella, selezionata": qui il
 *   gesto principale e' proprio spuntare, quindi farlo con un elemento non
 *   nativo vorrebbe dire escludere chi non usa il mouse dalla funzione intera.
 *
 * - Il riordino e' a PULSANTI, non a trascinamento. Il trascinamento senza
 *   alternativa da tastiera e' inaccessibile per definizione, costruire
 *   l'alternativa costa piu' dei due pulsanti, e la libreria in piu' non si
 *   giustifica per una lista che al massimo ha qualche decina di righe.
 */

interface ElencoSottoattivitaProps {
  value: Sottoattivita[];
  onChange: (nuovo: Sottoattivita[]) => void;
  /** Chi sta spuntando: finisce in `doneBy`. Puo' mancare, e allora resta null. */
  currentUserId?: string | null;
  disabled?: boolean;
  className?: string;
}

export function ElencoSottoattivita({
  value,
  onChange,
  currentUserId = null,
  disabled = false,
  className,
}: ElencoSottoattivitaProps) {
  const { t } = useTranslation();
  const idCampo = useId();
  const campoNuovo = useRef<HTMLInputElement>(null);

  const [testoNuovo, setTestoNuovo] = useState('');
  // Quale riga si sta rinominando, e con che testo. Uno solo per volta: due
  // campi aperti insieme sono due modifiche che si possono perdere a vicenda.
  const [inModifica, setInModifica] = useState<string | null>(null);
  const [testoModifica, setTestoModifica] = useState('');
  // Messaggio per i lettori di schermo: aggiungere, togliere o spostare una
  // riga cambia una zona lontana dal fuoco, che altrimenti nessuno
  // annuncerebbe. Lo spostamento in particolare non si "vede" da tastiera.
  const [annuncio, setAnnuncio] = useState('');

  const passi = value ?? [];
  const { fatte, totale, percentuale } = avanzamento(passi);
  const pieno = elencoPieno(passi);

  function aggiungi() {
    const titolo = normalizzaPasso(testoNuovo);
    if (!titolo) return;

    const nuovo = aggiungiSottoattivita(passi, titolo);
    // Se non e' cambiato niente e' perche' l'elenco e' pieno: il testo resta
    // nel campo, cosi' chi lo aveva scritto non lo perde mentre legge perche'.
    if (nuovo === passi) return;

    onChange(nuovo);
    setAnnuncio(t('Step added: {name}', { name: titolo }));
    setTestoNuovo('');
    // Il campo resta pronto per il prossimo: una lista si scrive di seguito,
    // e dover tornare col mouse sul campo dopo ogni riga la fa smettere di
    // essere una lista.
    campoNuovo.current?.focus();
  }

  function spunta(passo: Sottoattivita, fatta: boolean) {
    onChange(spuntaSottoattivita(passi, passo.id, fatta, currentUserId));
  }

  function elimina(passo: Sottoattivita) {
    if (inModifica === passo.id) setInModifica(null);
    onChange(eliminaSottoattivita(passi, passo.id));
    setAnnuncio(t('Step deleted: {name}', { name: passo.title }));
  }

  function sposta(indice: number, verso: -1 | 1) {
    const destinazione = indice + verso;
    const nuovo = spostaSottoattivita(passi, indice, destinazione);
    if (nuovo === passi) return;

    onChange(nuovo);
    setAnnuncio(
      t('Step moved to position {position} of {total}', {
        position: destinazione + 1,
        total: passi.length,
      })
    );
  }

  function apriModifica(passo: Sottoattivita) {
    setInModifica(passo.id);
    setTestoModifica(passo.title);
  }

  function confermaModifica(passo: Sottoattivita) {
    // Svuotare il campo non cancella il passo: chi seleziona tutto e riscrive
    // non si aspetta di veder sparire la riga. Se ne esce senza testo, si
    // torna semplicemente com'era.
    onChange(rinominaSottoattivita(passi, passo.id, testoModifica));
    setInModifica(null);
  }

  function tastiInModifica(evento: KeyboardEvent<HTMLInputElement>, passo: Sottoattivita) {
    if (evento.key === 'Enter') {
      evento.preventDefault();
      confermaModifica(passo);
      return;
    }
    if (evento.key === 'Escape') {
      // Si ferma qui: il componente sta dentro un dialogo, e senza
      // `stopPropagation` l'Escape che annulla la rinomina chiuderebbe anche
      // il dialogo, buttando via tutto il resto delle modifiche.
      evento.preventDefault();
      evento.stopPropagation();
      setInModifica(null);
    }
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={idCampo} className="flex items-center gap-1.5">
          <ListChecks className="h-4 w-4" aria-hidden="true" />
          {t('Steps')}
        </Label>
        {totale > 0 && (
          <span className="text-sm text-muted-foreground">
            {t('{done} of {total} done', { done: fatte, total: totale })}
          </span>
        )}
      </div>

      {/*
        La barra c'e' solo se ci sono passi: `percentuale` e' null quando non
        ce ne sono, e "nessun passo" non e' "zero per cento" — una barra vuota
        su un task senza lista di spunte sembrerebbe un lavoro non iniziato.
        E' `aria-hidden` perche' il conteggio qui sopra dice la stessa cosa in
        modo piu' preciso, e sentirla due volte e' rumore.
      */}
      {percentuale !== null && (
        <Progress value={percentuale} className="h-1.5" aria-hidden="true" />
      )}

      {totale === 0 && (
        <p className="text-sm text-muted-foreground">{t('No steps yet')}</p>
      )}

      {totale > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {passi.map((passo, indice) => {
            const idSpunta = `${idCampo}-${passo.id}`;
            const modifica = inModifica === passo.id;

            return (
              <li
                key={passo.id}
                className="flex min-h-10 items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50"
              >
                <Checkbox
                  id={idSpunta}
                  checked={passo.done}
                  disabled={disabled}
                  onCheckedChange={(stato) => spunta(passo, stato === true)}
                />

                {modifica ? (
                  <Input
                    autoFocus
                    value={testoModifica}
                    maxLength={MAX_LUNGHEZZA_PASSO}
                    aria-label={t('Step text')}
                    onChange={(e) => setTestoModifica(e.target.value)}
                    onKeyDown={(e) => tastiInModifica(e, passo)}
                    // Uscire dal campo conferma: e' quello che si aspetta chi
                    // clicca altrove dopo aver corretto una parola. Per
                    // annullare c'e' Escape.
                    onBlur={() => confermaModifica(passo)}
                    className="h-8 flex-1"
                  />
                ) : (
                  <Label
                    htmlFor={idSpunta}
                    className={cn(
                      'flex-1 cursor-pointer break-words text-sm font-normal',
                      passo.done && 'text-muted-foreground line-through'
                    )}
                  >
                    {passo.title}
                  </Label>
                )}

                {!disabled && !modifica && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={t('Move step up: {name}', { name: passo.title })}
                      disabled={indice === 0}
                      onClick={() => sposta(indice, -1)}
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={t('Move step down: {name}', { name: passo.title })}
                      disabled={indice === passi.length - 1}
                      onClick={() => sposta(indice, 1)}
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={t('Rename step: {name}', { name: passo.title })}
                      onClick={() => apriModifica(passo)}
                    >
                      <PencilSimple className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      aria-label={t('Delete step: {name}', { name: passo.title })}
                      onClick={() => elimina(passo)}
                    >
                      <Trash className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!disabled && (
        <div className="flex items-center gap-2">
          <Input
            id={idCampo}
            ref={campoNuovo}
            value={testoNuovo}
            disabled={pieno}
            maxLength={MAX_LUNGHEZZA_PASSO}
            placeholder={t('Add a step')}
            aria-describedby={pieno ? `${idCampo}-limite` : undefined}
            onChange={(e) => setTestoNuovo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              // Dentro un dialogo Invio invierebbe il modulo: qui deve
              // aggiungere una riga, non salvare il task a meta' lista.
              e.preventDefault();
              aggiungi();
            }}
            className="h-9 flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label={t('Add step')}
            disabled={pieno || normalizzaPasso(testoNuovo) === ''}
            onClick={aggiungi}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}

      {/*
        Il tetto si spiega quando lo si tocca, non prima: un avviso sempre
        presente su una lista di tre righe e' solo una riga di testo in piu' da
        saltare.
      */}
      {!disabled && pieno && (
        <p id={`${idCampo}-limite`} className="text-sm text-muted-foreground">
          {t('A task can have at most {max} steps. For more, create separate tasks.', {
            max: MAX_SOTTOATTIVITA,
          })}
        </p>
      )}

      <p aria-live="polite" className="sr-only">
        {annuncio}
      </p>
    </div>
  );
}
