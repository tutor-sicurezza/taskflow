/**
 * Le tre schermate di analisi, caricate solo quando si aprono.
 *
 * Portavano dentro il pacchetto iniziale l'intera libreria dei grafici, che da
 * sola vale piu' di quanto pesi tutto il resto dell'applicazione messo insieme.
 * Chi apriva TaskFlow per segnare un'attivita' come fatta la scaricava
 * comunque, pur non aprendo mai un grafico: le analisi non sono la prima
 * schermata di nessuno.
 *
 * Il ritardo si paga una volta sola, al primo grafico aperto, e da li' in poi
 * il pezzo resta in cache. Le firme restano identiche a quelle dei componenti
 * veri, cosi' i punti che li usano non cambiano.
 */

import { Suspense, lazy, type ComponentProps } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { TeamAnalytics as TeamAnalyticsVero } from '@/components/TeamAnalytics';
import type { DepartmentAnalytics as DepartmentAnalyticsVero } from '@/components/DepartmentAnalytics';
import type { EmailDeliveryAnalytics as EmailDeliveryAnalyticsVero } from '@/components/EmailDeliveryAnalytics';

const TeamPigro = lazy(() =>
  import('@/components/TeamAnalytics').then((m) => ({ default: m.TeamAnalytics }))
);
const DipartimentiPigro = lazy(() =>
  import('@/components/DepartmentAnalytics').then((m) => ({
    default: m.DepartmentAnalytics,
  }))
);
const EmailPigro = lazy(() =>
  import('@/components/EmailDeliveryAnalytics').then((m) => ({
    default: m.EmailDeliveryAnalytics,
  }))
);

/**
 * L'attesa somiglia a quello che sta per comparire invece di essere una
 * rotellina: la schermata non salta quando il contenuto arriva.
 */
function Attesa() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

export function TeamAnalytics(props: ComponentProps<typeof TeamAnalyticsVero>) {
  return (
    <Suspense fallback={<Attesa />}>
      <TeamPigro {...props} />
    </Suspense>
  );
}

export function DepartmentAnalytics(
  props: ComponentProps<typeof DepartmentAnalyticsVero>
) {
  return (
    <Suspense fallback={<Attesa />}>
      <DipartimentiPigro {...props} />
    </Suspense>
  );
}

export function EmailDeliveryAnalytics(
  props: ComponentProps<typeof EmailDeliveryAnalyticsVero>
) {
  return (
    <Suspense fallback={<Attesa />}>
      <EmailPigro {...props} />
    </Suspense>
  );
}
