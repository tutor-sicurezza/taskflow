import { useId, useState, type KeyboardEvent } from 'react';
import { BookmarkSimple, Check, FloppyDisk, PencilSimple, Trash, X } from '@phosphor-icons/react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { descriviFiltro, nomeSuggerito, stessoFiltro, type Filtro } from '@/lib/filtriSalvati';
import type { Employee } from '@/lib/types';

/**
 * I filtri salvati dell'elenco task.
 *
 * Il componente NON sa dove finiscono: riceve l'elenco e chiama le funzioni che
 * gli vengono passate. E' voluto — i filtri sono per-utente, e il posto in cui
 * si scrivono (colonna JSONB, stato locale, altro) e' una decisione che deve
 * poter cambiare senza rimettere le mani sull'interfaccia.
 *
 * Due scelte pesano piu' delle altre:
 *
 * 1. Se non c'e' nessun filtro salvato, qui compare una spiegazione e non un
 *    pulsante muto. Una funzione che si scopre solo per caso non viene usata da
 *    nessuno, e questa in particolare vale solo per chi la usa tutti i giorni.
 *
 * 2. Quando i filtri attivi coincidono con uno gia' salvato, il salvataggio
 *    sparisce e al suo posto si evidenzia quello: senza, l'elenco si
 *    riempirebbe di copie dello stesso identico filtro con nomi diversi.
 */

interface Props {
  filtri: Filtro[];
  filtriAttivi: Partial<Filtro>;
  employees: Employee[];
  onApplica: (filtro: Filtro) => void;
  onSalva: (filtro: Filtro) => void;
  onElimina: (id: string) => void;
  onRinomina: (id: string, nome: string) => void;
}

/**
 * Un identificativo per il filtro appena creato.
 *
 * `randomUUID` non esiste ovunque (contesti non sicuri, browser piu' vecchi) e
 * qui un fallimento significherebbe un pulsante "Salva" che non fa niente:
 * meglio un ripiego meno elegante ma che c'e' sempre.
 */
function nuovoId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

/**
 * Solo i campi che descrivono la vista: `id` e `nome` li mette chi salva.
 *
 * I campi vuoti e quelli a `'all'` non vengono scritti affatto: significano
 * entrambi "nessun filtro", e salvarli riempirebbe il JSONB di rumore che poi
 * qualcuno dovrebbe interpretare.
 */
function soloCampi(filtri: Partial<Filtro>): Omit<Filtro, 'id' | 'nome'> {
  const campi = ['stato', 'priorita', 'reparto', 'assegnatario', 'ordine', 'ricerca'] as const;
  const risultato: Omit<Filtro, 'id' | 'nome'> = {};

  for (const campo of campi) {
    const valore = filtri[campo]?.trim();
    if (valore && valore !== 'all') risultato[campo] = valore;
  }
  return risultato;
}

/**
 * Un filtro senza alcun campo: serve a chiedere a `stessoFiltro` se i filtri
 * attivi sono "nessun filtro". Riusare quel confronto invece di riscriverlo qui
 * garantisce che l'equivalenza fra campo assente e `'all'` valga anche in
 * questa domanda.
 */
const FILTRO_VUOTO: Filtro = { id: '', nome: '' };

export function FiltriSalvati({
  filtri,
  filtriAttivi,
  employees,
  onApplica,
  onSalva,
  onElimina,
  onRinomina,
}: Props) {
  const { t, lingua } = useTranslation();
  const idCampo = useId();

  // Un solo campo di testo alla volta, e i due usi si escludono: o si sta
  // dando un nome a un filtro nuovo, o se ne sta correggendo uno esistente.
  const [inRinomina, setInRinomina] = useState<string | null>(null);
  const [inSalvataggio, setInSalvataggio] = useState(false);
  const [bozzaNome, setBozzaNome] = useState('');

  const attivo = filtri.find((f) => stessoFiltro(f, filtriAttivi)) ?? null;
  const senzaFiltri = stessoFiltro(FILTRO_VUOTO, filtriAttivi);

  const chiudi = () => {
    setInRinomina(null);
    setInSalvataggio(false);
    setBozzaNome('');
  };

  const iniziaSalvataggio = () => {
    setInRinomina(null);
    // Il nome arriva gia' scritto: chiedere di inventarne uno a ogni
    // salvataggio e' il modo piu' rapido per far smettere la gente di salvare.
    setBozzaNome(nomeSuggerito(filtriAttivi, employees, lingua));
    setInSalvataggio(true);
  };

  const iniziaRinomina = (filtro: Filtro) => {
    setInSalvataggio(false);
    setBozzaNome(filtro.nome);
    setInRinomina(filtro.id);
  };

  const nomePulito = bozzaNome.trim();

  const conferma = () => {
    if (nomePulito === '') return;
    if (inRinomina) onRinomina(inRinomina, nomePulito);
    else onSalva({ id: nuovoId(), nome: nomePulito, ...soloCampi(filtriAttivi) });
    chiudi();
  };

  /** Invio conferma, Esc annulla: in un campo solo sono le uniche due uscite. */
  const daTastiera = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'Enter') {
      evento.preventDefault();
      conferma();
    } else if (evento.key === 'Escape') {
      evento.preventDefault();
      chiudi();
    }
  };

  const campoNome = (etichetta: string) => (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1">
        <Label htmlFor={idCampo} className="text-xs">{etichetta}</Label>
        <Input
          id={idCampo}
          value={bozzaNome}
          onChange={(e) => setBozzaNome(e.target.value)}
          onKeyDown={daTastiera}
          maxLength={200}
          autoFocus
          className="h-10"
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={conferma} disabled={nomePulito === ''} className="h-10 flex-1 sm:flex-none">
          <FloppyDisk className="mr-2 h-4 w-4" weight="bold" />
          {t('Save')}
        </Button>
        <Button variant="ghost" onClick={chiudi} className="h-10 flex-1 sm:flex-none">
          {t('Cancel')}
        </Button>
      </div>
    </div>
  );

  return (
    <section className="space-y-3" aria-labelledby={`${idCampo}-titolo`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`${idCampo}-titolo`} className="flex items-center gap-2 text-sm font-semibold">
          <BookmarkSimple className="h-4 w-4 text-muted-foreground" weight="bold" />
          {t('Saved filters')}
        </h3>

        {/* Gia' salvato: si dice, invece di offrire un doppione. */}
        {attivo && !inSalvataggio && !inRinomina && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Check className="h-3 w-3" weight="bold" />
            {t('Current filters are already saved')}
          </span>
        )}

        {/* Senza alcun filtro attivo non c'e' niente da salvare: al posto di un
            pulsante spento — che non spiega perche' non funziona — si dice cosa
            manca. */}
        {!attivo && !inSalvataggio && !inRinomina && senzaFiltri && (
          <span className="text-xs text-muted-foreground">
            {t('Set some filters above, then save them here')}
          </span>
        )}

        {!attivo && !inSalvataggio && !inRinomina && !senzaFiltri && (
          <Button variant="outline" size="sm" onClick={iniziaSalvataggio} className="h-10">
            <BookmarkSimple className="mr-2 h-4 w-4" weight="bold" />
            {t('Save current filters')}
          </Button>
        )}
      </div>

      {inSalvataggio && campoNome(t('Name of this view'))}

      {/* Niente filtri salvati: si spiega a cosa servono. Un pulsante e basta
          lascerebbe la funzione invisibile a chi non la sta gia' cercando. */}
      {filtri.length === 0 && !inSalvataggio && (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          {t('Save the filters you use often — status, priority, department, assignee — and bring them back with one click.')}
        </p>
      )}

      {filtri.length > 0 && (
        <ul className="space-y-2">
          {filtri.map((filtro) => {
            const eAttivo = attivo?.id === filtro.id;

            if (inRinomina === filtro.id) {
              return <li key={filtro.id}>{campoNome(t('Rename this view'))}</li>;
            }

            return (
              <li key={filtro.id} className="flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => onApplica(filtro)}
                  // `aria-pressed` e non solo il colore: chi usa un lettore di
                  // schermo deve sapere quale vista sta guardando adesso.
                  aria-pressed={eAttivo}
                  className={cn(
                    'flex min-h-10 flex-1 flex-col justify-center gap-0.5 rounded-lg border px-3 py-2 text-left',
                    'transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2',
                    'focus-visible:ring-ring focus-visible:ring-offset-2',
                    eAttivo && 'border-primary bg-primary/5'
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {eAttivo && <Check className="h-4 w-4 shrink-0 text-primary" weight="bold" />}
                    <span className="truncate">{filtro.nome}</span>
                  </span>
                  {/* La descrizione e' l'unico modo di sapere cosa fa un filtro
                      chiamato "I miei" senza doverlo applicare. */}
                  <span className="truncate text-xs text-muted-foreground">
                    {descriviFiltro(filtro, employees, lingua)}
                  </span>
                </button>

                <Button
                  variant="ghost"
                  onClick={() => iniziaRinomina(filtro)}
                  aria-label={t('Rename "{nome}"', { nome: filtro.nome })}
                  className="h-auto min-h-10 w-10 shrink-0 p-0"
                >
                  <PencilSimple className="h-4 w-4" weight="bold" />
                </Button>

                {/* L'eliminazione passa da una conferma: e' irreversibile e
                    colpisce qualcosa che l'utente ha costruito lui. */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      aria-label={t('Delete "{nome}"', { nome: filtro.nome })}
                      className="h-auto min-h-10 w-10 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash className="h-4 w-4" weight="bold" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('Delete this saved filter?')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('"{nome}" will be removed. The tasks are not affected.', { nome: filtro.nome })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="min-h-10">
                        <X className="mr-2 h-4 w-4" weight="bold" />
                        {t('Cancel')}
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onElimina(filtro.id)}
                        className="min-h-10 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        <Trash className="mr-2 h-4 w-4" weight="bold" />
                        {t('Delete')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default FiltriSalvati;
