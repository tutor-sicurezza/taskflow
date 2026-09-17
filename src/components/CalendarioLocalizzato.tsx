/**
 * Il calendario con la sua localizzazione, dietro lo stesso confine pigro.
 *
 * Esiste per una ragione di peso, misurata e non supposta. `CalendarioPigro`
 * e' importato STATICAMENTE da tre pannelli che stanno nel pacchetto iniziale:
 * solo il componente che carica a richiesta sta dietro il confine, non il file
 * che lo avvolge. Mettendo li' `import { it, de, ... } from 'date-fns/locale'`,
 * i dati delle cinque lingue finivano nel pacchetto di avvio — verificato
 * cercando la stringa "maggio" dentro `dist/assets/index-*.js`, dove non deve
 * stare.
 *
 * Qui invece siamo gia' oltre il confine: questo modulo lo carica `lazy`, e con
 * lui arrivano sia `react-day-picker` sia le localizzazioni, cioe' esattamente
 * le cose che servono solo a chi apre un pannello con la data.
 *
 * Non riceve un oggetto `Locale` ma il CODICE della lingua, per la stessa
 * ragione: un oggetto lo dovrebbe costruire chi chiama, cioe' di nuovo il lato
 * che sta nel pacchetto iniziale.
 */

import { ComponentProps } from 'react';
import { de, enUS, es, fr, it } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import type { Lingua } from '@/lib/i18n';

/*
  `weekStartsOn` non si tocca: viene da ciascuna localizzazione, ed e' il motivo
  per cui la settimana parte di lunedi' in quattro lingue su cinque e di
  domenica in inglese.
*/
const LOCALIZZAZIONI: Record<Lingua, Locale> = { it, en: enUS, fr, de, es };

export default function CalendarioLocalizzato({
  lingua,
  ...props
}: ComponentProps<typeof Calendar> & { lingua: Lingua }) {
  // `props` viene dopo: chi passa `locale` esplicitamente vince.
  return <Calendar locale={LOCALIZZAZIONI[lingua]} {...props} />;
}
