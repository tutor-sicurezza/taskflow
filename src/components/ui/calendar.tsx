import { ComponentProps } from "react"
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left"
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

/*
  Il giorno scelto: fondo pieno, anche sotto il mouse e con il fuoco.

  Sta in una costante perche' serve identico in tre punti — il giorno singolo,
  l'inizio e la fine di un intervallo — e perche' deve restare un selettore
  DISCENDENTE (`.classe > button`, specificita' maggiore di `.hover\:bg-accent:hover`
  della variante "ghost"): altrimenti il fondo del passaggio del mouse coprirebbe
  quello della selezione, e quale delle due vince dipenderebbe dall'ordine in cui
  Tailwind ha emesso le due utilita'.
*/
const GIORNO_SCELTO =
  "[&>button]:bg-primary [&>button]:text-primary-foreground " +
  "[&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground " +
  "[&>button]:focus:bg-primary [&>button]:focus:text-primary-foreground"

/**
 * Il selettore di data dei pannelli "scadenza" e "ricorrenza".
 *
 * Le classi qui sotto erano scritte per react-day-picker 8 (`head_row`,
 * `head_cell`, `row`, `cell`, `table`, `day_selected`, `nav_button`...) mentre
 * il progetto installa la 9, che ha rinominato ogni elemento. I vecchi nomi
 * sopravvivono nel tipo `DeprecatedUI`, quindi `tsc` li accettava senza una
 * parola e il componente a runtime li buttava via: il difetto non poteva essere
 * intercettato da nessun controllo automatico, si vedeva solo a schermo.
 *
 * Il danno peggiore lo faceva la chiave `day`. Nella 8 era il PULSANTE del
 * giorno, nella 9 e' la CELLA `<td>`: le classi del pulsante — a partire da
 * `inline-flex` della variante "ghost" — finivano cosi' sul `<td>`, che smette
 * di comportarsi da cella di tabella. Il browser gli costruisce intorno una
 * cella anonima per riga, le sette colonne dei numeri diventano una sola mentre
 * l'intestazione `<th>` resta a sette, ed e' esattamente lo scivolamento delle
 * iniziali dei giorni che e' stato segnalato.
 *
 * I nomi usati ora sono quelli dell'enum `UI` della versione installata. Nella
 * 9 gli stati (selezionato, oggi, fuori mese, estremi dell'intervallo) vengono
 * messi sul `<td>` e non sul pulsante: per vestire il pulsante lo si raggiunge
 * da li' con `[&>button]:`.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        // Nella 9 la navigazione non sta piu' dentro l'intestazione del mese ma
        // e' sorella dei mesi: per riavere le frecce ai lati del titolo la si
        // sovrappone al contenitore, che percio' diventa `relative`.
        months: "relative flex flex-col sm:flex-row gap-2",
        month: "flex flex-col gap-4",
        month_caption: "flex h-7 w-full items-center justify-center",
        caption_label: "text-sm font-medium",
        nav: "absolute inset-x-1 top-0 flex h-7 items-center justify-between",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "size-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "size-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        month_grid: "w-full border-collapse",
        // Righe a `flex` con celle di larghezza fissa: e' l'unica cosa che
        // teneva allineate intestazione e numeri anche prima, e va ripetuta su
        // ENTRAMBE le righe o l'una scivola rispetto all'altra.
        weekdays: "flex",
        weekday: "w-8 rounded-md text-[0.8rem] font-normal text-muted-foreground",
        week: "mt-2 flex w-full",
        day: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
          // `aria-selected` nella 9 sta sulla cella stessa, non piu' su un suo
          // discendente: `[&:has([aria-selected])]` non troverebbe piu' nulla.
          props.mode === "range"
            ? "[&[aria-selected]]:bg-accent first:[&[aria-selected]]:rounded-l-md last:[&[aria-selected]]:rounded-r-md"
            : "[&[aria-selected]]:rounded-md [&[aria-selected]]:bg-accent"
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 p-0 font-normal"
        ),
        // In modalita' intervallo TUTTI i giorni compresi risultano
        // "selezionati", estremi inclusi: se il fondo pieno lo desse questa
        // chiave lo prenderebbe anche il centro. Li' lo danno solo gli estremi.
        selected: props.mode === "range" ? "" : GIORNO_SCELTO,
        range_start: cn("rounded-l-md", GIORNO_SCELTO),
        range_end: cn("rounded-r-md", GIORNO_SCELTO),
        range_middle: "[&>button]:text-accent-foreground",
        // Oggi si evidenzia solo se non e' gia' selezionato: i due fondi sono la
        // stessa proprieta' e con selettori che si escludono a vicenda non c'e'
        // da sperare in un ordine di emissione.
        today:
          "[&:not([aria-selected])>button]:bg-accent [&:not([aria-selected])>button]:text-accent-foreground",
        // Anche da selezionato, un giorno di un altro mese resta smorzato: da
        // qui la ripetizione piu' specifica, che batte GIORNO_SCELTO.
        outside:
          "text-muted-foreground [&[aria-selected]>button]:text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        /*
          Nella 9 `PreviousMonthButton` e `NextMonthButton` SONO i due `<button>`
          della navigazione, completi di `aria-label`, `tabIndex` e `onClick`:
          sostituirli con un'icona, come si faceva qui, cancellava il pulsante e
          con lui la raggiungibilita' da tastiera. `Chevron` e' il punto in cui
          la 9 vuole che si cambi solo il disegno, e resta dentro il pulsante.

          Di `size` e `disabled` non si fa nulla apposta: non sono attributi
          validi per l'`<svg>` di lucide. L'orientamento puo' valere anche
          "up"/"down", ma solo con la navigazione a tendina, che qui non si usa.
        */
        Chevron: ({ orientation, className }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("size-4", className)} />
          ) : (
            <ChevronRight className={cn("size-4", className)} />
          ),
      }}
      {...props}
    />
  )
}

export { Calendar }
