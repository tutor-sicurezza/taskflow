import { useEffect, useId, useRef, useState } from 'react';
import { Warning } from '@phosphor-icons/react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { analizzaDurata, formattaMinuti, scostamentoStima } from '@/lib/tempi';
import { cn } from '@/lib/utils';

/**
 * I campi con cui si dichiara quanto durera' un lavoro e quanto e' durato.
 *
 * Il valore viaggia in MINUTI, che e' come sta nel database; il testo digitato
 * resta un fatto locale del campo. Un campo numerico puro avrebbe chiesto alle
 * persone di convertire "due ore e mezza" in 150 a mente, cioe' avrebbe reso
 * la stima un piccolo fastidio — e una stima fastidiosa semplicemente non
 * viene compilata, che e' esattamente il buco che questa funzione dovrebbe
 * chiudere.
 *
 * Quindi si accetta il testo libero e si mostra subito come e' stato
 * interpretato: chi scrive "1,5h" deve vedere "1h 30m" mentre digita, non
 * scoprire dopo il salvataggio di aver registrato un minuto e mezzo.
 */

interface CampoDurataProps {
  /** Minuti, o null quando non e' stato dichiarato nulla. */
  value: number | null;
  onChange: (minuti: number | null) => void;
  label: string;
  /** Testo sotto al campo quando non c'e' niente da interpretare. */
  aiuto?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Un campo durata, controllato dall'esterno in minuti.
 *
 * Tiene due stati di proposito: `testo` e' cio' che si sta scrivendo, `value`
 * cio' che e' stato capito. Sono diversi mentre si digita — "2h3" e' un
 * passaggio obbligato per arrivare a "2h30" — e forzare il campo a mostrare
 * sempre la forma normalizzata significherebbe riscrivere sotto le dita di chi
 * scrive, il difetto piu' odioso dei campi "intelligenti".
 */
export function CampoDurata({ value, onChange, label, aiuto, disabled, id }: CampoDurataProps) {
  const { t, lingua } = useTranslation();
  const idGenerato = useId();
  const idCampo = id ?? idGenerato;
  const idDescrizione = `${idCampo}-descrizione`;

  const [testo, setTesto] = useState(() => (value === null ? '' : formattaMinuti(value, lingua)));

  // L'ultimo valore che ha lasciato questo campo. Serve a distinguere un
  // cambiamento arrivato da fuori (un altro campo, il caricamento del task) da
  // l'eco di cio' che si e' appena digitato: senza, ogni battitura tornerebbe
  // indietro riformattata e il cursore salterebbe a fine riga.
  const emesso = useRef<number | null>(value);

  useEffect(() => {
    if (value === emesso.current) return;
    emesso.current = value;
    setTesto(value === null ? '' : formattaMinuti(value, lingua));
  }, [value, lingua]);

  const vuoto = testo.trim().length === 0;
  const minuti = vuoto ? null : analizzaDurata(testo);
  const incomprensibile = !vuoto && minuti === null;

  const aggiorna = (nuovo: string) => {
    setTesto(nuovo);

    const letto = nuovo.trim().length === 0 ? null : analizzaDurata(nuovo);

    // Cio' che non si capisce non viene propagato, ma nemmeno cancella il
    // valore precedente: chi sta ancora scrivendo "2h3" non ha chiesto di
    // azzerare la stima. Si avvisa e si aspetta.
    if (letto === null && nuovo.trim().length > 0) return;

    emesso.current = letto;
    onChange(letto);
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={idCampo}>{label}</Label>
      <Input
        id={idCampo}
        // `text` e non `number`: il campo accetta "2h 30m", che un input
        // numerico rifiuterebbe. `inputMode` tiene comunque il tastierino
        // numerico sui telefoni, dove e' cio' che serve nove volte su dieci.
        type="text"
        inputMode="text"
        autoComplete="off"
        value={testo}
        disabled={disabled}
        onChange={(e) => aggiorna(e.target.value)}
        placeholder={t('e.g. 90, 1.5h, 2h 30m')}
        aria-invalid={incomprensibile || undefined}
        aria-describedby={idDescrizione}
        className={cn(incomprensibile && 'border-destructive')}
      />
      {/* Una sola regione annunciata: quella che cambia mentre si scrive.
          `polite` perche' l'interpretazione e' un'informazione di conferma, non
          un allarme che debba interrompere la digitazione. */}
      <p
        id={idDescrizione}
        aria-live="polite"
        className={cn(
          'flex items-center gap-1.5 text-xs',
          incomprensibile ? 'text-destructive' : 'text-muted-foreground'
        )}
      >
        {incomprensibile ? (
          <>
            {/* L'icona accompagna il testo, non lo sostituisce: il colore da
                solo non arriva a chi non lo distingue. */}
            <Warning className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{t('Not understood. Try 90, 1.5h or 2h 30m.')}</span>
          </>
        ) : vuoto ? (
          <span>{aiuto ?? t('Leave empty if unknown')}</span>
        ) : (
          <span>
            {t('Understood as')} <strong className="font-medium">{formattaMinuti(minuti, lingua)}</strong>
          </span>
        )}
      </p>
    </div>
  );
}

interface CampiTempoProps {
  /** Stima in minuti, null se il task non e' stimato. */
  stima: number | null;
  /** Tempo impiegato in minuti, null se nessuno l'ha ancora registrato. */
  impiegato: number | null;
  onChangeStima: (minuti: number | null) => void;
  onChangeImpiegato: (minuti: number | null) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * La coppia stima / tempo impiegato.
 *
 * Sotto compare lo scostamento, ma solo quando esistono entrambi i valori: con
 * uno dei due mancante non c'e' nessuno scostamento da mostrare, e un "0"
 * messo li' per riempire lo spazio si leggerebbe come "la stima era giusta".
 */
export function CampiTempo({
  stima,
  impiegato,
  onChangeStima,
  onChangeImpiegato,
  disabled,
  className,
}: CampiTempoProps) {
  const { t, lingua } = useTranslation();

  // Stessa funzione che usa il resto del prodotto: la regola su quando uno
  // scostamento esiste sta in un posto solo, altrimenti qui e altrove
  // finirebbero due idee diverse di "stima sbagliata".
  const scostamento = scostamentoStima({ estimateMinutes: stima, spentMinutes: impiegato });

  return (
    <div className={cn('space-y-3', className)}>
      {/* Una colonna sul telefono, due dove c'e' spazio: i due campi sono
          correlati e affiancati si leggono come una cosa sola. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CampoDurata
          value={stima}
          onChange={onChangeStima}
          label={t('Estimated time')}
          aiuto={t('Leave empty if you cannot estimate it yet')}
          disabled={disabled}
        />
        <CampoDurata
          value={impiegato}
          onChange={onChangeImpiegato}
          label={t('Time spent')}
          aiuto={t('Leave empty if not tracked')}
          disabled={disabled}
        />
      </div>

      {scostamento !== null && (
        <p className="text-xs text-muted-foreground">
          {scostamento === 0
            ? t('Same as the estimate')
            : scostamento > 0
              ? t('{tempo} over the estimate', { tempo: formattaMinuti(scostamento, lingua) })
              : t('{tempo} under the estimate', { tempo: formattaMinuti(-scostamento, lingua) })}
        </p>
      )}
    </div>
  );
}
