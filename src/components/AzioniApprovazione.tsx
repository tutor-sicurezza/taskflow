import { useState } from 'react';
import { Check, X } from '@phosphor-icons/react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { valutaApprovazione } from '@/lib/approvazione';
import type { Employee, Task } from '@/lib/types';

/**
 * I due pulsanti con cui un responsabile chiude o rimanda indietro un lavoro.
 *
 * Non conosce il database: riceve `onApprova` e `onRifiuta` e chiama quelli.
 * La ragione non e' stilistica — la stessa coppia di pulsanti deve poter stare
 * nella scheda del task, nel dialogo di dettaglio e (un domani) in una vista
 * "da approvare", e ognuno di quei posti salva a modo suo. Tenendo qui solo il
 * gesto, il punto in cui si scrive resta uno solo, in `App.tsx`.
 *
 * Chi non puo' approvare non vede niente: mostrare pulsanti spenti a un
 * assegnatario che aspetta il visto di un altro non gli da' nessuna
 * informazione utile, gli da' solo qualcosa su cui provare a cliccare. L'unica
 * eccezione e' l'assegnatario stesso, a cui si spiega perche' i pulsanti non
 * ci sono: e' il caso in cui la domanda "e allora chi lo chiude?" nasce
 * davvero.
 */

interface AzioniApprovazioneProps {
  task: Task;
  /** Chi sta guardando. Null quando la sessione non e' ancora pronta. */
  currentUser: Employee | null;
  /** Serve solo a nominare l'assegnatario nel messaggio di attesa. */
  employees: Employee[];
  onApprova: (task: Task) => void | Promise<void>;
  /**
   * Il motivo del rifiuto arriva sempre, anche vuoto: chi salva decide se
   * scriverlo nella cronologia o in un commento, ma non deve dover indovinare
   * se il parametro c'e'.
   */
  onRifiuta: (task: Task, motivo: string) => void | Promise<void>;
  className?: string;
}

export function AzioniApprovazione({
  task,
  currentUser,
  employees,
  onApprova,
  onRifiuta,
  className,
}: AzioniApprovazioneProps) {
  const { t } = useTranslation();

  const [motivoAperto, setMotivoAperto] = useState(false);
  const [motivo, setMotivo] = useState('');
  // Un solo flag per entrambe le azioni: durante un salvataggio nessuna delle
  // due deve poter partire una seconda volta, e un doppio clic su "approva"
  // scriverebbe due volte lo stesso visto.
  const [inCorso, setInCorso] = useState(false);

  const esito = valutaApprovazione(task, currentUser);

  if (!esito.puo) {
    // All'assegnatario si dice perche' non tocca a lui; a chiunque altro non
    // riguardi la cosa non si mostra nulla.
    if (esito.motivo === 'e-assegnatario') {
      return (
        <p className={cn('text-xs text-muted-foreground', className)}>
          {t('Waiting for someone else to approve your work')}
        </p>
      );
    }
    return null;
  }

  // Chi ha fatto il lavoro puo' non essere piu' in elenco: in quel caso si usa
  // la frase senza nome, invece di scriverne uno finto.
  const assegnatario = employees.find((e) => e.id === task.assigneeId)?.name ?? null;

  async function esegui(azione: () => void | Promise<void>) {
    setInCorso(true);
    try {
      await azione();
    } finally {
      // Anche in caso di errore i pulsanti tornano attivi: il salvataggio puo'
      // essere fallito per la rete, e l'unica cosa peggiore di un rifiuto non
      // salvato e' non poter riprovare.
      setInCorso(false);
    }
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <p className="text-xs text-muted-foreground">
        {assegnatario
          ? t('{name} marked this task as done and is waiting for approval', { name: assegnatario })
          : t('This task is marked as done and is waiting for approval')}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={inCorso}
          onClick={() => void esegui(() => onApprova(task))}
        >
          <Check className="h-4 w-4" weight="bold" />
          {t('Approve')}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={inCorso}
          onClick={() => setMotivoAperto((aperto) => !aperto)}
          aria-expanded={motivoAperto}
        >
          <X className="h-4 w-4" weight="bold" />
          {t('Request changes')}
        </Button>
      </div>

      {motivoAperto && (
        <div className="flex flex-col gap-2">
          {/*
            Il motivo e' facoltativo ma chiesto per primo: un task che torna
            indietro senza una parola costringe l'assegnatario a indovinare
            cosa correggere, ed e' il modo piu' rapido per far tornare il
            lavoro indietro una seconda volta.
          */}
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={t('What needs to change? (optional)')}
            rows={3}
            aria-label={t('Reason for sending the task back')}
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={inCorso}
              onClick={() =>
                void esegui(async () => {
                  await onRifiuta(task, motivo.trim());
                  setMotivo('');
                  setMotivoAperto(false);
                })
              }
            >
              {t('Send back to in progress')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={inCorso}
              onClick={() => {
                setMotivo('');
                setMotivoAperto(false);
              }}
            >
              {t('Cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AzioniApprovazione;
