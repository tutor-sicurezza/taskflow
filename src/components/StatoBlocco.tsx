import { useMemo } from 'react';
import { Prohibit } from '@phosphor-icons/react';
import { useTranslation } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { bloccantiAperti } from '@/lib/dipendenze';
import type { Task } from '@/lib/types';

/**
 * Il segnale su un task che non puo' andare avanti.
 *
 * Serve a rispondere in un colpo solo alla domanda di chi apre una scheda
 * ferma: perche' non posso procedere, e cosa devo aspettare. Lo stato
 * `blocked` da solo non lo dice — dice che qualcuno l'ha marcato fermo, non da
 * cosa — ed e' il motivo per cui questo pannello elenca i bloccanti per nome
 * invece di limitarsi a un colore.
 *
 * Restituisce `null` quando non c'e' niente da dire: nessuna dipendenza,
 * oppure tutte gia' chiuse. Cosi' si puo' montare senza un `&&` intorno, e
 * nessuno deve ricordarsi di ripetere la condizione in ogni punto in cui
 * compare — che e' il modo in cui due schermate finiscono per dire cose
 * diverse sullo stesso task.
 *
 * "Chiuso" qui non e' `status === 'completed'`: un bloccante che aspetta
 * un'approvazione tiene ancora fermo il lavoro, vedi `dipendenze.ts`.
 */

interface StatoBloccoProps {
  task: Task;
  tuttiITask: Task[];
  /**
   * Facoltativa. Dove c'e' modo di aprire un altro task (la scheda di
   * dettaglio) il bloccante diventa raggiungibile con un clic; dove non c'e'
   * (una card in un elenco) resta un'informazione, e non si mostra un pulsante
   * che non porta da nessuna parte.
   */
  onApri?: (bloccante: Task) => void;
  /** Versione ridotta a una riga, per gli spazi stretti. */
  compatto?: boolean;
  className?: string;
}

export function StatoBlocco({
  task,
  tuttiITask,
  onApri,
  compatto = false,
  className,
}: StatoBloccoProps) {
  const { t } = useTranslation();

  const aperti = useMemo(() => bloccantiAperti(task, tuttiITask), [task, tuttiITask]);

  // Il ritorno anticipato e' il contratto del componente, non una scorciatoia:
  // vedi il commento in testa al file.
  if (aperti.length === 0) return null;

  // Due frasi intere e non un plurale calcolato: il progetto non ha un sistema
  // di pluralizzazione, e un "1 tasks" — o peggio una regola inventata qui che
  // vale solo per l'inglese — si vedrebbe subito. Due chiavi complete si
  // traducono anche nelle lingue che declinano diversamente.
  const riepilogo =
    aperti.length === 1
      ? t('Waiting for one other task to be done')
      : t('Waiting for {count} other tasks to be done', { count: aperti.length });

  if (compatto) {
    return (
      <span
        className={cn(
          'inline-flex min-h-6 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
          className
        )}
        // Il titolo elenca i bloccanti anche nella forma ridotta: senza, il
        // badge direbbe "sei fermo" senza dire da cosa.
        title={aperti.map((b) => b.title).join(', ')}
      >
        <Prohibit className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {riepilogo}
      </span>
    );
  }

  return (
    <section
      className={cn(
        'flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
        className
      )}
      aria-label={t('Blocked by other tasks')}
    >
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Prohibit className="h-4 w-4 shrink-0" aria-hidden="true" />
        {riepilogo}
      </p>

      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {aperti.map((bloccante) => (
          <li key={bloccante.id} className="flex min-h-8 items-center gap-2">
            {onApri ? (
              <button
                type="button"
                onClick={() => onApri(bloccante)}
                className="min-h-10 min-w-0 flex-1 truncate rounded-md px-1 text-left text-sm underline underline-offset-2 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-amber-900 sm:min-h-8"
                aria-label={t('Open {title}', { title: bloccante.title })}
              >
                {bloccante.title}
              </button>
            ) : (
              <span className="min-w-0 flex-1 truncate px-1 text-sm">{bloccante.title}</span>
            )}
          </li>
        ))}
      </ul>

      <p className="text-xs">
        {t('This task can be completed once those are done.')}
      </p>
    </section>
  );
}
