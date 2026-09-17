import { useRef, useState } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FloppyDisk, DownloadSimple, UploadSimple, Warning, CheckCircle, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';

interface DataManagementProps {
  onExportData: () => Promise<void>;
  onImportData: (data: string) => Promise<void>;
  onClearAllData: () => Promise<void>;
}

export function DataManagement({ onExportData, onImportData, onClearAllData }: DataManagementProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [importing, setImporting] = useState(false);
  /*
    Il file viene letto e CONTATO prima di essere applicato.

    Prima l'importazione partiva al secondo clic, senza dire niente — mentre
    "Clear All Data", che fa un danno minore, una conferma ce l'aveva. E cio'
    che faceva non era quello che il titolo prometteva: cancellava ogni
    attivita' che nel file non c'era.
  */
  const [daImportare, setDaImportare] = useState<{ testo: string; task: number } | null>(null);

  /*
    Il vero selettore di file, aperto da un pulsante vero.

    Prima qui c'era `<label htmlFor>` con dentro `<Button asChild><span>`: il
    `<span>` non e' un elemento interattivo, quindi non finisce nell'ordine di
    tabulazione e non risponde a Invio o Spazio, e l'`<input type="file">` era
    `display:none`, che lo toglie a sua volta dal fuoco. Risultato: **l'unico
    modo di importare un backup era il mouse.** Il `<label>` rendeva l'area
    cliccabile, non raggiungibile.

    Un `<button>` che chiama `.click()` sull'input nascosto e' la forma
    standard: il pulsante e' tabulabile e attivabile da tastiera perche' e' un
    pulsante, e il selettore di file del sistema operativo e' a sua volta
    accessibile.

    L'input resta `hidden`, cioe' `display:none`, e adesso va bene che lo sia:
    `display:none` lo toglie del tutto dall'albero di accessibilita', quindi
    non diventa una seconda tappa muta nella tabulazione ne' un campo senza
    etichetta annunciato dal lettore di schermo. Prima era un problema solo
    perche' non c'era nient'altro che lo comandasse.

    `tabIndex={-1}` sembra ridondante accanto a `display:none`, e in un browser
    lo e'. Serve perche' la garanzia resti VERA anche se qualcuno cambia quella
    classe, e perche' resti VERIFICABILE: un test in jsdom non calcola gli
    stili, quindi `class="hidden"` li' non toglie niente dall'ordine di
    tabulazione e l'unica cosa controllabile e' la proprieta'.
  */
  const inputFile = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      await onExportData();
      toast.success(t('Data exported successfully!'));
    } catch (error) {
      toast.error(t('Failed to export data'));
      console.error('Export error:', error);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.tasks && !data.employees && !data.announcements) {
        throw new Error('Invalid backup file format');
      }

      setDaImportare({
        testo: text,
        task: Array.isArray(data.tasks) ? data.tasks.length : 0,
      });
    } catch (error) {
      toast.error(t('Failed to import data. Please check the file format.'));
      console.error('Import error:', error);
    } finally {
      event.target.value = '';
    }
  };

  const confermaImport = async () => {
    if (!daImportare) return;
    setImporting(true);
    try {
      await onImportData(daImportare.testo);
      toast.success(t('Data imported successfully! Refresh to see changes.'));
      setDaImportare(null);
      setOpen(false);
    } catch (error) {
      toast.error(t('Failed to import data. Please check the file format.'));
      console.error('Import error:', error);
    } finally {
      setImporting(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }

    try {
      await onClearAllData();
      toast.success(t('All data cleared successfully'));
      setOpen(false);
      setConfirmClear(false);
    } catch (error) {
      toast.error(t('Failed to clear data'));
      console.error('Clear error:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FloppyDisk className="mr-2 h-4 w-4" weight="duotone" />{t('Backup & Restore')}</Button>
      </DialogTrigger>
      {/* max-h + overflow: DialogContent e' `fixed` e centrato, quindi senza
          tetto d'altezza su uno schermo basso il contenuto esce sopra e sotto,
          la testata e i pulsanti in fondo diventano irraggiungibili e la pagina
          non scorre perche' l'elemento e' fuori dal flusso. */}
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Data Management')}</DialogTitle>
          <DialogDescription>{t('Export, import, or clear your TaskFlow data')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <CheckCircle className="h-4 w-4" weight="duotone" />
            <AlertDescription>{t('Your data is automatically saved in your browser. Use backup to preserve data before major changes.')}</AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <DownloadSimple className="h-5 w-5 text-primary mt-0.5" weight="duotone" />
              <div className="flex-1">
                <h4 className="font-medium mb-1">{t('Export Data')}</h4>
                <p className="text-sm text-muted-foreground mb-3">{t('Download a backup of all tasks, employees, and settings')}</p>
                <Button onClick={handleExport} size="sm">
                  <DownloadSimple className="mr-2 h-4 w-4" />{t('Export Backup')}</Button>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <UploadSimple className="h-5 w-5 text-primary mt-0.5" weight="duotone" />
              <div className="flex-1">
                <h4 className="font-medium mb-1">{t('Import Data')}</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  {t('Updates the tasks contained in the file. Nothing is deleted.')}
                </p>
                {daImportare ? (
                  <div className="space-y-2">
                    <Alert>
                      <AlertDescription className="text-sm">
                        {t('{count} tasks in the file. Those already here will be updated, the rest added. Nothing will be deleted.', {
                          count: String(daImportare.task),
                        })}
                      </AlertDescription>
                    </Alert>
                    <div className="flex gap-2">
                      <Button onClick={confermaImport} size="sm" disabled={importing}>
                        <UploadSimple className="mr-2 h-4 w-4" />
                        {importing ? t('Importing...') : t('Confirm import')}
                      </Button>
                      <Button
                        onClick={() => setDaImportare(null)}
                        size="sm"
                        variant="outline"
                        disabled={importing}
                      >
                        {t('Cancel')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" onClick={() => inputFile.current?.click()}>
                    <UploadSimple className="mr-2 h-4 w-4" />
                    {t('Import Backup')}
                  </Button>
                )}
                <input
                  ref={inputFile}
                  id="import-file"
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                  tabIndex={-1}
                />
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 border border-destructive/50 rounded-lg bg-destructive/5">
              <Warning className="h-5 w-5 text-destructive mt-0.5" weight="duotone" />
              <div className="flex-1">
                <h4 className="font-medium mb-1">{t('Clear All Data')}</h4>
                <p className="text-sm text-muted-foreground mb-3">{t('Permanently delete all tasks, employees, and settings')}</p>
                {confirmClear ? (
                  <div className="space-y-2">
                    <Alert className="border-destructive">
                      <AlertDescription className="text-sm font-medium">{t('Are you sure? This action cannot be undone!')}</AlertDescription>
                    </Alert>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleClearAll}
                        size="sm"
                        variant="destructive"
                      >
                        <Trash className="mr-2 h-4 w-4" />{t('Confirm Delete')}</Button>
                      <Button
                        onClick={() => setConfirmClear(false)}
                        size="sm"
                        variant="outline"
                      >{t('Cancel')}</Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => setConfirmClear(true)}
                    size="sm"
                    variant="outline"
                    className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash className="mr-2 h-4 w-4" />{t('Clear All Data')}</Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t('Close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
