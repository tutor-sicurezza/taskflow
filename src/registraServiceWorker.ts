/**
 * La registrazione del service worker, e l'avviso quando esce una versione nuova.
 *
 * Perche' non basta lasciar fare al plugin. Con l'aggiornamento automatico il
 * service worker nuovo prende il controllo subito e cancella la cache vecchia
 * MENTRE la pagina vecchia e' ancora aperta: da quel momento un pezzo caricato
 * a richiesta — le analisi, il calendario, l'esportazione, un dizionario di
 * lingua — non e' piu' ne' in cache ne' sul server, perche' ogni pubblicazione
 * serve solo i propri file. La prima apertura di una di quelle schermate
 * finisce nella schermata di errore generale. Non e' un caso di scuola: e' il
 * modo tipico in cui una PWA si rompe subito dopo una pubblicazione.
 *
 * Qui si fa il contrario: il service worker nuovo aspetta, la pagina aperta
 * continua a funzionare con i file che ha, e all'utente si CHIEDE di ricaricare
 * con un avviso che resta finche' non decide lui.
 *
 * Il controllo periodico serve a un caso preciso: una finestra installata che
 * non viene mai chiusa non naviga mai, quindi non chiederebbe `/sw.js` per
 * ore. Chi lascia TaskFlow aperto per giorni resterebbe indietro senza saperlo.
 */

import { toast } from 'sonner';
import { registerSW } from 'virtual:pwa-register';
import { traduci, linguaIniziale } from '@/lib/i18n';

/** Ogni mezz'ora. Abbastanza spesso da non restare indietro, abbastanza raro
 *  da non essere una richiesta di rete che si nota. */
const INTERVALLO_CONTROLLO_MS = 30 * 60 * 1000;

export function registraAggiornamenti(): void {
  if (!('serviceWorker' in navigator)) return;

  const t = (chiave: string, parametri?: Record<string, string | number>) =>
    traduci(linguaIniziale(), chiave, parametri);

  const aggiorna = registerSW({
    onNeedRefresh() {
      /*
        `duration: Infinity` di proposito: un avviso che sparisce da solo dopo
        cinque secondi e' un avviso che nessuno vede. Questo resta finche' non
        si ricarica o non lo si chiude.
      */
      toast.info(t('A new version is available'), {
        description: t('Reload to get the latest version.'),
        duration: Infinity,
        action: {
          label: t('Reload'),
          onClick: () => {
            void aggiorna(true);
          },
        },
      });
    },

    onRegisteredSW(_url, registrazione) {
      if (!registrazione) return;

      setInterval(() => {
        // `void`: un controllo fallito (rete assente) non deve diventare un
        // errore non gestito nella console di chi sta solo lavorando.
        void registrazione.update().catch(() => undefined);
      }, INTERVALLO_CONTROLLO_MS);
    },

    onRegisterError(errore) {
      // Non si avvisa l'utente: senza service worker l'applicazione funziona
      // lo stesso, solo senza installazione e senza cache. E' un problema per
      // chi sviluppa, non per chi lavora.
      console.error('[pwa] registrazione fallita:', errore);
    },
  });
}
