import { useEffect, useId, useState } from 'react';
import { CalendarBlank, X } from '@phosphor-icons/react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calendario } from '@/components/CalendarioPigro';
import { cn } from '@/lib/utils';
import type { RegolaRicorrenza } from '@/lib/types';
import { descriviRicorrenza } from '../../api/_lib/ricorrenza';

/**
 * La scelta della ricorrenza di un'attivita'.
 *
 * Autosufficiente e controllato: chi lo monta gli passa la regola e riceve
 * quella nuova, senza sapere nulla di come e' fatta. Serve identico nella
 * creazione e nella modifica di un task, e duplicarlo avrebbe significato due
 * interfacce che col tempo si comportano in modo diverso.
 *
 * `descriviRicorrenza` arriva da `api/_lib/ricorrenza.ts`, lo stesso modulo che
 * il lavoro pianificato usa per CALCOLARE le occorrenze. Non e' un dettaglio:
 * la frase mostrata qui sotto e' l'unica verifica che l'utente ha prima di
 * fidarsi: se venisse da una funzione diversa, prima o poi direbbe una cosa e
 * il sistema ne farebbe un'altra.
 */

interface SelettoreRicorrenzaProps {
  value: RegolaRicorrenza | null;
  onChange: (regola: RegolaRicorrenza | null) => void;
  disabled?: boolean;
}

/** Il valore del menu quando non c'e' ricorrenza: e' il caso normale. */
const NESSUNA = 'mai';

/**
 * Lunedi' per primo, domenica in fondo: e' l'ordine con cui si guarda una
 * settimana di lavoro. I numeri restano quelli di `Date.getDay()` (0 =
 * domenica), che e' la convenzione salvata nella regola.
 */
const GIORNI: { valore: number; breve: string; esteso: string }[] = [
  { valore: 1, breve: 'Mon', esteso: 'Monday' },
  { valore: 2, breve: 'Tue', esteso: 'Tuesday' },
  { valore: 3, breve: 'Wed', esteso: 'Wednesday' },
  { valore: 4, breve: 'Thu', esteso: 'Thursday' },
  { valore: 5, breve: 'Fri', esteso: 'Friday' },
  { valore: 6, breve: 'Sat', esteso: 'Saturday' },
  { valore: 0, breve: 'Sun', esteso: 'Sunday' },
];

/** Lo stesso tetto di `api/_lib/ricorrenza.ts`: oltre, la regola viene rifiutata. */
const OGNI_MASSIMO = 60;

/**
 * Data in formato 'AAAA-MM-GG' costruita dai campi LOCALI.
 *
 * `toISOString()` converte prima in UTC: a est di Greenwich, una data scelta
 * come 1 gennaio diventerebbe '2025-12-31'. Su una data di fine significa una
 * serie che si chiude un giorno prima di quanto l'utente ha indicato.
 */
function aDataLocale(d: Date): string {
  const mese = String(d.getMonth() + 1).padStart(2, '0');
  const giorno = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mese}-${giorno}`;
}

/** Il percorso inverso, per riaprire il calendario sul giorno gia' scelto. */
function daDataLocale(fine: string | null | undefined): Date | undefined {
  if (!fine) return undefined;
  const pezzi = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fine);
  if (!pezzi) {
    const istante = new Date(fine);
    return Number.isNaN(istante.getTime()) ? undefined : istante;
  }
  return new Date(Number(pezzi[1]), Number(pezzi[2]) - 1, Number(pezzi[3]));
}

export function SelettoreRicorrenza({ value, onChange, disabled }: SelettoreRicorrenzaProps) {
  const { t, lingua } = useTranslation();
  const idBase = useId();
  const idTipo = `${idBase}-tipo`;
  const idOgni = `${idBase}-ogni`;
  const idGiorni = `${idBase}-giorni`;

  /**
   * L'intervallo ha uno stato locale perche' e' un campo di testo: mentre si
   * cancella il numero per scriverne un altro, il valore passa da "3" a "" e
   * poi a "12". Senza uno stato proprio, quella stringa vuota diventerebbe
   * subito una regola non valida da propagare al genitore — che la
   * rifiuterebbe, riscrivendo "1" nel campo sotto le dita di chi sta scrivendo.
   */
  const [ogniTesto, setOgniTesto] = useState(() => String(value?.ogni ?? 1));

  // Riallineamento quando la regola cambia da fuori: apertura del pannello di
  // modifica su un altro task, o annullamento delle modifiche.
  useEffect(() => {
    setOgniTesto(String(value?.ogni ?? 1));
  }, [value?.ogni]);

  const tipo = value?.tipo ?? NESSUNA;
  const giorniScelti = value?.giorniSettimana ?? [];

  const cambiaTipo = (scelta: string) => {
    if (scelta === NESSUNA) {
      onChange(null);
      return;
    }
    const nuovo = scelta as RegolaRicorrenza['tipo'];
    const regola: RegolaRicorrenza = {
      tipo: nuovo,
      ogni: value?.ogni ?? 1,
      // I giorni scelti si conservano solo se hanno ancora senso: portarsi
      // dietro un "lunedi' e giovedi'" su una cadenza mensile lascerebbe nel
      // jsonb un dato che nessuno legge e che riapparirebbe tornando alle
      // settimane con una scelta che l'utente non ricorda di aver fatto.
      ...(nuovo === 'settimane' && giorniScelti.length > 0
        ? { giorniSettimana: giorniScelti }
        : {}),
      ...(value?.fine ? { fine: value.fine } : {}),
    };
    onChange(regola);
  };

  const cambiaOgni = (testo: string) => {
    setOgniTesto(testo);
    if (!value) return;
    const numero = Number.parseInt(testo, 10);
    // Fuori scala o non numerico: si lascia scrivere ma non si propaga nulla,
    // cosi' la regola salvata resta l'ultima valida invece di sparire.
    if (!Number.isInteger(numero) || numero < 1 || numero > OGNI_MASSIMO) return;
    onChange({ ...value, ogni: numero });
  };

  const cambiaGiorni = (scelti: string[]) => {
    if (!value) return;
    const numeri = scelti.map(Number).sort((a, b) => a - b);
    // Nessun giorno selezionato non e' un errore: la regola torna a
    // significare "lo stesso giorno della settimana", che e' il comportamento
    // predefinito della cadenza settimanale.
    if (numeri.length === 0) {
      const { giorniSettimana: _rimosso, ...resto } = value;
      onChange(resto);
      return;
    }
    onChange({ ...value, giorniSettimana: numeri });
  };

  const cambiaFine = (data: Date | undefined) => {
    if (!value) return;
    if (!data) {
      const { fine: _rimossa, ...resto } = value;
      onChange(resto);
      return;
    }
    onChange({ ...value, fine: aDataLocale(data) });
  };

  const descrizione = value ? descriviRicorrenza(value, lingua) : '';
  const dataFine = daDataLocale(value?.fine);

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor={idTipo}>{t('Repeat')}</Label>
        <Select value={tipo} onValueChange={cambiaTipo} disabled={disabled}>
          <SelectTrigger id={idTipo}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NESSUNA}>{t('Does not repeat')}</SelectItem>
            <SelectItem value="giorni">{t('Daily')}</SelectItem>
            <SelectItem value="settimane">{t('Weekly')}</SelectItem>
            <SelectItem value="mesi">{t('Monthly')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value && (
        <>
          <div className="grid gap-2">
            <Label htmlFor={idOgni}>{t('Repeat every')}</Label>
            <div className="flex items-center gap-2">
              <Input
                id={idOgni}
                type="number"
                inputMode="numeric"
                min={1}
                max={OGNI_MASSIMO}
                value={ogniTesto}
                onChange={(e) => cambiaOgni(e.target.value)}
                disabled={disabled}
                className="h-10 w-24"
              />
              <span className="text-sm text-muted-foreground">
                {value.tipo === 'giorni' && t('days')}
                {value.tipo === 'settimane' && t('weeks')}
                {value.tipo === 'mesi' && t('months')}
              </span>
            </div>
          </div>

          {value.tipo === 'settimane' && (
            <div className="grid gap-2">
              <Label id={idGiorni}>{t('Repeat on')}</Label>
              {/*
                ToggleGroup e non sette caselle: da tastiera si entra una volta
                sola nel gruppo e si scorre con le frecce, invece di sette
                tabulazioni. `aria-labelledby` lega il gruppo alla sua etichetta,
                che altrimenti non sarebbe associata a nulla.
              */}
              <ToggleGroup
                type="multiple"
                variant="outline"
                value={giorniScelti.map(String)}
                onValueChange={cambiaGiorni}
                disabled={disabled}
                aria-labelledby={idGiorni}
                className="flex-wrap"
              >
                {GIORNI.map((giorno) => (
                  <ToggleGroupItem
                    key={giorno.valore}
                    value={String(giorno.valore)}
                    // 44px di lato: e' la misura minima perche' un dito centri
                    // il giorno giusto invece di quello accanto.
                    className="h-11 min-w-11 px-2 text-xs"
                    aria-label={t(giorno.esteso)}
                  >
                    {t(giorno.breve)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <p className="text-xs text-muted-foreground">
                {t('Leave empty to repeat on the same weekday.')}
              </p>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor={`${idBase}-fine`}>{t('End date (optional)')}</Label>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id={`${idBase}-fine`}
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                      'h-10 flex-1 justify-start text-left font-normal',
                      !dataFine && 'text-muted-foreground'
                    )}
                  >
                    <CalendarBlank className="mr-2 h-4 w-4" />
                    {dataFine ? dataFine.toLocaleDateString(lingua) : t('No end date')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendario
                    mode="single"
                    selected={dataFine}
                    onSelect={cambiaFine}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {dataFine && (
                <Button
                  type="button"
                  variant="ghost"
                  // Il pulsante e' un'icona sola: senza aria-label uno screen
                  // reader leggerebbe "pulsante" e basta.
                  aria-label={t('Remove end date')}
                  disabled={disabled}
                  onClick={() => cambiaFine(undefined)}
                  className="h-10 w-10 shrink-0 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {descrizione && (
            /*
              `aria-live`: la frase cambia mentre si toccano i controlli sopra,
              e chi non vede lo schermo non avrebbe altro modo di accorgersi che
              la scelta ha avuto effetto.
            */
            <p
              role="status"
              aria-live="polite"
              className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"
            >
              {descrizione}
            </p>
          )}
        </>
      )}
    </div>
  );
}
