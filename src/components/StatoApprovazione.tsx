import { CheckCircle, Hourglass, ShieldCheck } from '@phosphor-icons/react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  inAttesaDiApprovazione,
  nomeApprovatore,
  richiedeApprovazione,
  statoApprovazione,
} from '@/lib/approvazione';
import type { Employee, Task } from '@/lib/types';

/**
 * Il segnale visivo che distingue "finito" da "finito e approvato".
 *
 * Senza questo badge un task in attesa di approvazione e' indistinguibile da
 * uno chiuso: entrambi sono `completed`, entrambi hanno la spunta. E' proprio
 * la situazione che rende inutile il flusso — il responsabile non sa che c'e'
 * qualcosa da guardare, e l'assegnatario crede di aver consegnato.
 *
 * Il componente non decide niente: chiede a `@/lib/approvazione` in che stato
 * e' il task e mostra la risposta. Cosi' il badge e i conteggi non possono
 * raccontare due storie diverse sullo stesso task.
 */

interface StatoApprovazioneProps {
  task: Pick<Task, 'status' | 'requiresApproval' | 'approvedBy' | 'approvedAt'>;
  /** Serve solo per dire CHI ha approvato: senza, si mostra la sola data. */
  employees?: Employee[];
  size?: 'sm' | 'md';
  /**
   * Mostra anche il promemoria "richiede approvazione" su un task ancora in
   * lavorazione. Spento di default: in un elenco fitto e' rumore, ma nel
   * dettaglio di un task e' l'unico posto in cui chi lavora scopre che alla
   * fine qualcuno dovra' dare il visto.
   */
  mostraRequisito?: boolean;
  className?: string;
}

export function StatoApprovazione({
  task,
  employees,
  size = 'md',
  mostraRequisito = false,
  className,
}: StatoApprovazioneProps) {
  const { t, lingua } = useTranslation();

  const stato = statoApprovazione(task);
  const inAttesa = inAttesaDiApprovazione(task);

  const classiDimensione = size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5';
  const classiIcona = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  if (inAttesa) {
    return (
      <Badge
        variant="outline"
        // Ambra e non rosso: non e' un errore ne' un ritardo, e' un lavoro
        // fermo in attesa di una persona.
        className={cn(
          'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
          classiDimensione,
          className
        )}
        title={t('This task is completed but still needs approval')}
      >
        <Hourglass className={classiIcona} weight="fill" />
        {t('Awaiting approval')}
      </Badge>
    );
  }

  if (stato === 'approvata') {
    const nome = nomeApprovatore(task, employees);
    const quando = task.approvedAt ? new Date(task.approvedAt) : null;
    const dataValida = quando && !Number.isNaN(quando.getTime()) ? quando : null;
    const quandoTesto = dataValida
      ? dataValida.toLocaleDateString(lingua, { month: 'short', day: 'numeric', year: 'numeric' })
      : '';

    // Chi ha approvato puo' non essere piu' in elenco: in quel caso si dice
    // quando, senza inventare un nome.
    const titolo = nome
      ? t('Approved by {name} on {date}', { name: nome, date: quandoTesto })
      : t('Approved on {date}', { date: quandoTesto });

    return (
      <Badge
        variant="outline"
        className={cn(
          'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
          classiDimensione,
          className
        )}
        title={dataValida ? titolo : t('Approved')}
      >
        <CheckCircle className={classiIcona} weight="fill" />
        {t('Approved')}
      </Badge>
    );
  }

  if (mostraRequisito && richiedeApprovazione(task)) {
    return (
      <Badge
        variant="outline"
        className={cn('text-muted-foreground', classiDimensione, className)}
        title={t('Once completed, this task must be approved before it closes')}
      >
        <ShieldCheck className={classiIcona} />
        {t('Requires approval')}
      </Badge>
    );
  }

  // Nessun badge: un task che non c'entra con le approvazioni non deve
  // guadagnare una riga in piu' nell'interfaccia.
  return null;
}

export default StatoApprovazione;
