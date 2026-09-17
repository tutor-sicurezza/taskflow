/**
 * Il calendario, caricato solo quando si apre — e nella lingua giusta.
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
 *
 * ## Perche' la lingua si decide qui
 *
 * Senza `locale`, `DayPicker` usa l'inglese: "September 2026" e le iniziali
 * "Su Mo Tu" anche a chi ha scelto l'italiano, con la settimana che parte di
 * domenica. Nessuno gliela passava.
 *
 * Questo file legge la lingua — puo' farlo, e' gia' nel guscio
 * dell'applicazione, mentre `ui/calendar.tsx` e' il componente di shadcn e non
 * deve sapere che esiste un contesto di lingua — ma passa solo il CODICE.
 * I dati delle localizzazioni stanno in `CalendarioLocalizzato`, dietro il
 * confine pigro, perche' questo file e' importato staticamente e tutto cio'
 * che tocca finisce nel pacchetto di avvio.
 */

import { Suspense, lazy, type ComponentProps } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/contexts/LanguageContext';
import type { Calendar as CalendarioVero } from '@/components/ui/calendar';

const Pigro = lazy(() => import('@/components/CalendarioLocalizzato'));

export function Calendario(props: ComponentProps<typeof CalendarioVero>) {
  const { lingua } = useTranslation();

  return (
    <Suspense fallback={<Attesa />}>
      <Pigro lingua={lingua} {...props} />
    </Suspense>
  );
}

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
