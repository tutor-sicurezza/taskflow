/**
 * Il calendario, caricato solo quando si apre.
 *
 * `react-day-picker` finiva nel pacchetto iniziale pur servendo in un unico
 * gesto — scegliere la scadenza di un'attivita' — dentro un pannello che parte
 * chiuso. Chi apre TaskFlow per leggere i propri task lo scaricava comunque,
 * e il foglio JavaScript blocca l'avvio.
 *
 * Il ritardo si paga una volta sola, al primo calendario aperto, e da li' in
 * poi il pezzo resta in cache. L'attesa e' un riquadro delle stesse dimensioni
 * della griglia dei giorni: senza, il pannello si aprirebbe alto zero e poi
 * scatterebbe, che e' peggio di aspettare.
 */

import { Suspense, lazy, type ComponentProps } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { Calendar as CalendarioVero } from '@/components/ui/calendar';

const Pigro = lazy(() =>
  import('@/components/ui/calendar').then((m) => ({ default: m.Calendar }))
);

function Attesa() {
  return (
    <div className="p-3">
      <Skeleton className="mb-3 h-7 w-full" />
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-8 rounded-md" />
        ))}
      </div>
    </div>
  );
}

export function Calendario(props: ComponentProps<typeof CalendarioVero>) {
  return (
    <Suspense fallback={<Attesa />}>
      <Pigro {...props} />
    </Suspense>
  );
}
