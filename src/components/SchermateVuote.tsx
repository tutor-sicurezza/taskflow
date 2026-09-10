/**
 * La schermata "qui non c'e' niente".
 *
 * E' l'altra meta' del problema risolto da Scheletri.tsx, e va tenuta ben
 * distinta: uno scheletro dice "aspetta", una schermata vuota dice "ho
 * guardato, non c'e' nulla". Confonderle produce i due difetti peggiori che
 * un elenco possa avere — un vuoto mostrato durante il caricamento fa credere
 * che i dati siano spariti, e uno scheletro lasciato acceso su un elenco
 * davvero vuoto e' un'attesa che non finisce mai. Chi monta questi componenti
 * deve quindi valutare PRIMA il flag di caricamento e solo dopo la lunghezza
 * dell'elenco: l'ordine e' la sostanza, non un dettaglio.
 *
 * Un solo componente parametrico invece di uno per situazione. Non per
 * risparmiare righe, ma perche' tre copie divergono: una prende il pulsante,
 * un'altra no, la terza resta con il testo di sei mesi fa. Qui la differenza fra i
 * casi e' esattamente quello che cambia davvero — icona, testo, e se ci sia
 * qualcosa da fare — ed e' visibile nella chiamata invece di essere sepolta
 * in tre file.
 */

import type { Icon } from '@phosphor-icons/react';
import { Tray } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/contexts/LanguageContext';
import type { ChiaveTraduzione } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface AzioneSchermataVuota {
  /** Chiave inglese, tradotta qui dentro come ovunque nel progetto. */
  etichetta: ChiaveTraduzione;
  onClick: () => void;
  icona?: Icon;
}

interface SchermataVuotaProps {
  /**
   * Le chiavi, non il testo gia' tradotto: cosi' il cambio di lingua a caldo
   * aggiorna anche queste schermate, senza che il chiamante debba
   * ricordarsene.
   */
  titolo: ChiaveTraduzione;
  descrizione?: ChiaveTraduzione;
  /** Segnaposto `{nome}` della descrizione (vedi `traduci` in lib/i18n). */
  parametri?: Record<string, string | number>;
  icona?: Icon;
  /**
   * L'invito ad agire. Facoltativo perche' non tutti i vuoti sono un invito:
   * "nessun risultato con questi filtri" si risolve cambiando i filtri, e
   * offrire li' un pulsante "crea attivita'" spinge a creare lavoro finto per
   * rispondere a una domanda di ricerca.
   */
  azione?: AzioneSchermataVuota;
  /**
   * Versione ridotta, per i riquadri dentro il cruscotto: li' il vuoto
   * riguarda un pannello alto poche righe, e sedici unita' di spazio verticale
   * lo farebbero diventare l'elemento piu' grande della pagina.
   */
  compatta?: boolean;
  className?: string;
}

export function SchermataVuota({
  titolo,
  descrizione,
  parametri,
  icona: Icona = Tray,
  azione,
  compatta = false,
  className,
}: SchermataVuotaProps) {
  const { t } = useTranslation();
  const IconaAzione = azione?.icona;

  return (
    <div className={cn('text-center', compatta ? 'py-8' : 'py-16', className)}>
      {/*
        L'icona e' decorazione: ripete cio' che il titolo dice gia' a parole.
        Annunciata sarebbe rumore, quindi resta nascosta all'accessibilita'.
      */}
      <Icona
        className={cn(
          'mx-auto text-muted-foreground',
          compatta ? 'w-10 h-10 mb-3' : 'w-16 h-16 mb-4'
        )}
        weight="light"
        aria-hidden="true"
      />

      <h3 className={cn('font-medium', compatta ? 'text-base mb-1' : 'text-lg mb-2')}>
        {t(titolo)}
      </h3>

      {descrizione && (
        <p className={cn('text-muted-foreground text-sm', azione ? 'mb-4' : 'mb-0')}>
          {t(descrizione, parametri)}
        </p>
      )}

      {azione && (
        <Button onClick={azione.onClick} size={compatta ? 'sm' : 'default'}>
          {IconaAzione && <IconaAzione className="mr-2 h-4 w-4" aria-hidden="true" />}
          {t(azione.etichetta)}
        </Button>
      )}
    </div>
  );
}
