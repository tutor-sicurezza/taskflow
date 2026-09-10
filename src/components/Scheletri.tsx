/**
 * I segnaposto mostrati mentre i dati sono ancora in volo.
 *
 * Esistono per una ragione precisa, e non e' estetica: prima di questi
 * componenti l'applicazione mostrava il proprio stato INIZIALE — zero task,
 * elenco vuoto, cruscotto a zeri — come se fosse un risultato. Chi apriva la
 * pagina leggeva "0 attivita' totali" e un istante dopo "6": nel mezzo c'e'
 * una persona che crede di aver perso il lavoro di una settimana. Un numero
 * sbagliato mostrato con sicurezza e' peggio di nessun numero.
 *
 * Regola che governa tutto il file: OGNI scheletro ha la stessa forma e la
 * stessa altezza del contenuto che sostituisce. Se le misure divergono, al
 * momento dell'arrivo dei dati la pagina salta, e un salto sotto il dito di
 * chi sta gia' toccando qualcosa e' un tocco finito sul bersaglio sbagliato.
 * Per questo qui sotto le classi sono ricopiate da TaskCard e da App.tsx
 * invece di essere "circa uguali": h-8 e' l'interlinea di text-2xl, h-7 e'
 * l'altezza dei SelectTrigger della scheda, e cosi' via.
 */

import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { useTranslation } from '@/contexts/LanguageContext';
import type { ChiaveTraduzione } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Il rettangolo grigio, mattone di tutto il resto.
 *
 * `motion-safe:` e non `animate-pulse` secco: `prefers-reduced-motion` viene
 * impostata anche da chi soffre di emicrania o di disturbi vestibolari
 * scatenati dal movimento, e un blocco che pulsa senza sosta per tutta la
 * durata di una lettura lenta e' esattamente il caso che quella preferenza
 * chiede di evitare. Chi la esprime vede rettangoli fermi, che comunicano lo
 * stesso identico messaggio.
 *
 * Non riusa `components/ui/skeleton`: quello applica `animate-pulse` senza
 * condizioni, e una classe aggiunta da fuori non lo toglie — le due
 * varianti convivrebbero e l'animazione resterebbe accesa proprio per chi
 * aveva chiesto di spegnerla.
 *
 * `aria-hidden` perche' la forma non significa niente per chi non la vede: il
 * messaggio per i lettori di schermo lo da' una volta sola il contenitore.
 */
function Blocco({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('bg-muted rounded-md motion-safe:animate-pulse', className)}
    />
  );
}

/**
 * Il contenitore che ANNUNCIA l'attesa.
 *
 * Senza questo, per chi usa un lettore di schermo il caricamento non esiste:
 * la pagina resta muta e poi, di colpo, cambia sotto di lui. `role="status"`
 * con `aria-live="polite"` fa leggere la frase senza interrompere cio' che
 * sta gia' dicendo, e `aria-busy` dice che quello che c'e' non e' il
 * risultato finale.
 */
function Attesa({
  etichetta,
  className,
  children,
}: {
  etichetta: ChiaveTraduzione;
  className?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{t(etichetta)}</span>
      {children}
    </div>
  );
}

/**
 * Le quattro schede in cima (totali, in corso, completati, in ritardo).
 *
 * La griglia e le classi della scheda sono le stesse di App.tsx; dentro, h-8
 * e' l'interlinea di `text-2xl` (il numero) e h-5 quella di `text-sm`
 * (l'etichetta), quindi l'altezza complessiva coincide.
 */
export function ScheletroSchedeStatistiche() {
  return (
    <Attesa
      etichetta="Loading statistics"
      className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4"
    >
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-card rounded-lg p-4 border">
          <Blocco className="h-8 w-12 mb-1" />
          <Blocco className="h-5 w-24" />
        </div>
      ))}
    </Attesa>
  );
}

/**
 * Una riga dell'elenco, modellata su TaskCard.
 *
 * Le proporzioni dei blocchi variano di poco da riga a riga (`w-2/3`,
 * `w-1/2`) di proposito: rettangoli identici in colonna sembrano un errore di
 * rendering, mentre righe di lunghezza diversa si leggono subito come "del
 * testo che sta arrivando".
 */
function ScheletroSchedaTask({ largo }: { largo: boolean }) {
  return (
    <Card className="p-4 border-l-4 border-l-muted">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Titolo (text-base, 24px) piu' il badge di priorita'. */}
          <div className="flex items-center gap-2 mb-2">
            <Blocco className={cn('h-6', largo ? 'w-2/3' : 'w-1/2')} />
            <Blocco className="h-5 w-14" />
          </div>

          {/*
            La descrizione vera e' `line-clamp-2`: due righe da 20px. Due
            blocchi da h-4 con space-y-2 danno gli stessi 40px, e la seconda
            riga piu' corta imita un testo che finisce a meta'.
          */}
          <div className="mb-3 space-y-2">
            <Blocco className="h-4 w-full" />
            <Blocco className="h-4 w-4/5" />
          </div>

          {/* Scadenza, stato e assegnatario: h-7, come i SelectTrigger veri. */}
          <div className="flex flex-wrap items-center gap-3">
            <Blocco className="h-7 w-28" />
            <Blocco className="h-7 w-full sm:w-[180px]" />
            <Blocco className="h-7 w-full sm:w-[180px]" />
          </div>
        </div>

        {/*
          I tre pulsanti a destra: h-10 sul touch, h-8 da sm in su. Se qui
          mancassero, all'arrivo dei dati la colonna destra comparirebbe dal
          nulla e sui telefoni la riga cambierebbe altezza.
        */}
        <div className="flex items-start gap-2">
          <Blocco className="h-10 w-10 sm:h-8 sm:w-8" />
          <Blocco className="h-10 w-10 sm:h-8 sm:w-8" />
          <Blocco className="h-10 w-10 sm:h-8 sm:w-8" />
        </div>
      </div>
    </Card>
  );
}

/**
 * L'elenco delle attivita'.
 *
 * `righe` di default e' 3 e non 20: lo scheletro serve a dire "sto leggendo",
 * non a riempire lo schermo. Riempire tre schermate di rettangoli grigi
 * promette un elenco lungo che potrebbe non esserci, e chi ha davvero zero
 * task lo vive come un secondo inganno dopo quello dei numeri.
 */
export function ScheletroElencoTask({ righe = 3 }: { righe?: number }) {
  return (
    <Attesa etichetta="Loading tasks" className="grid gap-4">
      {Array.from({ length: righe }, (_, i) => (
        <ScheletroSchedaTask key={i} largo={i % 2 === 0} />
      ))}
    </Attesa>
  );
}

/**
 * Il cruscotto.
 *
 * Uno solo per tutti e tre i ruoli, benche' i cruscotti veri siano tre. La
 * struttura che conta e' identica — intestazione, riga di azioni rapide,
 * quattro schede di riepilogo, due pannelli affiancati — e l'unica differenza
 * misurabile e' quante azioni rapide ci sono (3 per l'utente, 4 per il
 * responsabile, 5 per l'amministratore). Quella e' una prop; il resto sarebbe
 * stato tre copie da tenere allineate a mano, cioe' tre copie destinate a
 * divergere alla prima modifica di uno dei cruscotti.
 */
export function ScheletroCruscotto({ azioniRapide = 4 }: { azioniRapide?: number }) {
  return (
    <Attesa etichetta="Loading dashboard" className="space-y-6">
      {/* Titolo (text-2xl) e sottotitolo, come l'intestazione dei cruscotti. */}
      <div>
        <Blocco className="h-8 w-56 mb-2" />
        <Blocco className="h-6 w-72" />
      </div>

      {/*
        Azioni rapide. Le colonne restano fisse e non derivano dal numero: una
        classe Tailwind costruita a runtime (`sm:grid-cols-${n}`) non finisce
        nel foglio di stile, perche' il compilatore legge il sorgente, non lo
        esegue. Sarebbe un riquadro senza griglia, e solo in produzione.
      */}
      <Card className="p-6 border-primary/20">
        <Blocco className="h-7 w-40 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: azioniRapide }, (_, i) => (
            <Blocco key={i} className="h-[74px] w-full" />
          ))}
        </div>
      </Card>

      {/* Le quattro schede di riepilogo: icona a sinistra, numero a destra. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <Blocco className="h-12 w-12" />
              <div className="flex flex-col items-end gap-1">
                <Blocco className="h-9 w-16" />
                <Blocco className="h-5 w-24" />
              </div>
            </div>
            <Blocco className="h-7 w-full" />
          </Card>
        ))}
      </div>

      {/* I due pannelli affiancati (scadenze imminenti / ripartizione). */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[0, 1].map((i) => (
          <Card key={i} className="p-6">
            <Blocco className="h-7 w-48 mb-4" />
            <div className="space-y-3">
              <Blocco className="h-16 w-full" />
              <Blocco className="h-16 w-full" />
              <Blocco className="h-16 w-full" />
            </div>
          </Card>
        ))}
      </div>
    </Attesa>
  );
}
