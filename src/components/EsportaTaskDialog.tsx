import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DownloadSimple, FileCsv, FilePdf } from '@phosphor-icons/react';

import { useTranslation } from '@/contexts/LanguageContext';
import {
  COLONNE_DISPONIBILI,
  COLONNE_PREDEFINITE,
  ErrorePopupBloccato,
  nomeFileEsportazione,
  righeDaTask,
  scaricaCSV,
  versoCSV,
  versoPDF,
  type ColonnaTask,
} from '@/lib/esportaTask';
import type { Employee, Task } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';

/**
 * Etichette delle colonne nella finestra di scelta.
 *
 * Ripetute qui e non importate da `esportaTask.ts` perche' li' sono chiavi per
 * `traduci()` fuori da React, mentre qui passano da `t()`: la stessa stringa,
 * due strade diverse, e nessuna delle due deve dipendere dall'altra.
 */
const ETICHETTE_COLONNE: Record<ColonnaTask, string> = {
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

interface EsportaTaskDialogProps {
  /** I task cosi' come sono a schermo: gia' filtrati da chi monta la finestra. */
  tasks: Task[];
  employees: Employee[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * L'elenco completo, se il chiamante ce l'ha.
   *
   * Facoltativo di proposito: senza, "tutti" significa comunque qualcosa —
   * si aggiungono gli archiviati, che nessuna vista corrente mostra — e la
   * finestra continua a funzionare montata ovunque.
   */
  tuttiITask?: Task[];
}

export function EsportaTaskDialog({
  tasks,
  employees,
  open,
  onOpenChange,
  tuttiITask,
}: EsportaTaskDialogProps) {
  const { t, lingua } = useTranslation();

  const [formato, setFormato] = useState<'csv' | 'pdf'>('csv');
  const [ambito, setAmbito] = useState<'visibili' | 'tutti'>('visibili');
  const [colonne, setColonne] = useState<ColonnaTask[]>(COLONNE_PREDEFINITE);

  const soloVisibili = ambito === 'visibili';
  const elenco = soloVisibili ? tasks : (tuttiITask ?? tasks);

  /**
   * Le righe si calcolano PRIMA di confermare, non al momento dell'esportazione.
   *
   * E' cio' che permette di mostrare quante ne usciranno: chi esporta scopre
   * subito se il filtro che credeva attivo lo era davvero, invece di
   * accorgersene aprendo un file con dentro tre task su duecento.
   */
  const righe = useMemo(
    () => righeDaTask(elenco, employees, { colonne, soloVisibili }, lingua),
    [elenco, employees, colonne, soloVisibili, lingua]
  );

  const numeroRighe = Math.max(0, righe.length - 1);
  const puoEsportare = colonne.length > 0 && numeroRighe > 0;

  /** L'ordine delle colonne nel file segue quello dell'elenco, non quello dei clic. */
  const commutaColonna = (colonna: ColonnaTask, attiva: boolean) => {
    setColonne((precedenti) =>
      attiva
        ? COLONNE_DISPONIBILI.filter((c) => c === colonna || precedenti.includes(c))
        : precedenti.filter((c) => c !== colonna)
    );
  };

  const esporta = () => {
    const titolo = t('Task List');

    try {
      if (formato === 'csv') {
        scaricaCSV(versoCSV(righe), nomeFileEsportazione('csv'));
      } else {
        versoPDF(righe, titolo, lingua);
      }
      onOpenChange(false);
    } catch (errore) {
      // Il blocco pop-up e' la causa piu' comune di "il PDF non esce": qui
      // diventa un messaggio che dice cosa fare, invece di un silenzio.
      if (errore instanceof ErrorePopupBloccato) {
        toast.error(t('Allow pop-ups to export the PDF'));
        return;
      }
      toast.error(t('Export failed'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('Export Tasks')}</DialogTitle>
          <DialogDescription>
            {t('Choose the format, the columns and which tasks to include.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Formato. `role="group"` con aria-labelledby: chi usa un lettore di
              schermo sente a cosa appartengono le due opzioni.
              "CSV" e "PDF" non passano da `t()`: sono nomi di formato identici
              nelle cinque lingue, e tenerli tradotti faceva risultare due
              chiavi sempre mancanti in ogni audit delle traduzioni. */}
          <div role="group" aria-labelledby="esporta-formato-etichetta">
            <p id="esporta-formato-etichetta" className="mb-2 text-sm font-medium">
              {t('Format')}
            </p>
            <RadioGroup
              value={formato}
              onValueChange={(valore) => setFormato(valore as 'csv' | 'pdf')}
              className="flex gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="csv" id="esporta-formato-csv" />
                <Label htmlFor="esporta-formato-csv" className="flex items-center gap-1.5">
                  <FileCsv className="h-4 w-4" aria-hidden="true" />
                  CSV
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="pdf" id="esporta-formato-pdf" />
                <Label htmlFor="esporta-formato-pdf" className="flex items-center gap-1.5">
                  <FilePdf className="h-4 w-4" aria-hidden="true" />
                  PDF
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Ambito. */}
          <div role="group" aria-labelledby="esporta-ambito-etichetta">
            <p id="esporta-ambito-etichetta" className="mb-2 text-sm font-medium">
              {t('Which tasks')}
            </p>
            <RadioGroup
              value={ambito}
              onValueChange={(valore) => setAmbito(valore as 'visibili' | 'tutti')}
              className="space-y-1"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="visibili" id="esporta-ambito-visibili" />
                <Label htmlFor="esporta-ambito-visibili">{t('Only the filtered tasks')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="tutti" id="esporta-ambito-tutti" />
                <Label htmlFor="esporta-ambito-tutti">
                  {t('All tasks, including archived ones')}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Colonne. */}
          <div role="group" aria-labelledby="esporta-colonne-etichetta">
            <div className="mb-2 flex items-center justify-between">
              <p id="esporta-colonne-etichetta" className="text-sm font-medium">
                {t('Columns')}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setColonne(
                    colonne.length === COLONNE_DISPONIBILI.length ? [] : [...COLONNE_DISPONIBILI]
                  )
                }
              >
                {colonne.length === COLONNE_DISPONIBILI.length
                  ? t('Clear All')
                  : t('Select All')}
              </Button>
            </div>
            <ScrollArea className="h-44 rounded-md border p-3">
              <div className="grid grid-cols-2 gap-2">
                {COLONNE_DISPONIBILI.map((colonna) => (
                  <div key={colonna} className="flex items-center gap-2">
                    <Checkbox
                      id={`esporta-colonna-${colonna}`}
                      checked={colonne.includes(colonna)}
                      onCheckedChange={(stato) => commutaColonna(colonna, stato === true)}
                    />
                    <Label htmlFor={`esporta-colonna-${colonna}`} className="font-normal">
                      {t(ETICHETTE_COLONNE[colonna])}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Il conteggio. `aria-live` perche' cambia mentre si toccano i
              filtri, e chi non vede lo schermo deve saperlo senza rileggere. */}
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {colonne.length === 0
              ? t('Select at least one column')
              : t('{righe} rows will be exported', { righe: numeroRighe })}
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('comune.annulla')}
          </Button>
          <Button type="button" onClick={esporta} disabled={!puoEsportare}>
            <DownloadSimple className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('Export')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
