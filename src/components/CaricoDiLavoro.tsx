import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Question, Warning } from '@phosphor-icons/react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { caricoPersona, formattaMinuti, SEGNO_IGNOTO, type CaricoPersona } from '@/lib/tempi';
import { cn } from '@/lib/utils';
import type { Employee, Task } from '@/lib/types';

/**
 * Chi e' carico, e quanto di quel carico non lo sappiamo.
 *
 * Esiste per una domanda sola: a chi posso dare il prossimo lavoro. Il
 * conteggio dei task per persona non risponde — dieci task da mezz'ora e dieci
 * da tre giorni fanno la stessa colonna — quindi qui si guardano le ore.
 *
 * Le ore pero' arrivano dalle stime, e le stime mancano spesso. Una tabella
 * che sommasse solo cio' che e' stimato direbbe "3h" di una persona che ne ha
 * davanti quaranta, e sarebbe una bugia peggiore del conteggio che sostituisce.
 * Per questo il numero di task NON stimati sta accanto al totale, il totale
 * porta il segno "almeno" quando ne esistono, e la barra del carico e' grigia
 * a righe per la parte ignota invece di fingere una lunghezza.
 *
 * Un'ultima cosa, sul cosa NON c'e': niente punteggi, classifiche o percentuali
 * di efficienza. Questa schermata mostra numeri per persona e verra' letta come
 * una valutazione anche senza volerlo; l'unica difesa e' che ogni cifra sia
 * qualcosa di misurato — task, ore dichiarate, ritardi — e mai qualcosa
 * calcolato da noi su dati che non abbiamo.
 */

interface CaricoDiLavoroProps {
  tasks: Task[];
  employees: Employee[];
}

type Colonna = 'persona' | 'aperti' | 'stimati' | 'senzaStima' | 'ritardo';

interface RigaCarico extends CaricoPersona {
  employee: Employee;
}

export function CaricoDiLavoro({ tasks, employees }: CaricoDiLavoroProps) {
  const { t, lingua } = useTranslation();

  // Si parte dalle ore, decrescenti: e' l'ordine che risponde alla domanda per
  // cui la schermata esiste. Chi cerca altro ha le intestazioni.
  const [colonna, setColonna] = useState<Colonna>('stimati');
  const [discendente, setDiscendente] = useState(true);

  const righe = useMemo<RigaCarico[]>(
    () => employees.map((employee) => ({ employee, ...caricoPersona(tasks, employee.id) })),
    [employees, tasks]
  );

  const ordinate = useMemo(() => {
    const verso = discendente ? -1 : 1;
    return [...righe].sort((a, b) => {
      if (colonna === 'persona') return a.employee.name.localeCompare(b.employee.name, lingua) * -verso;
      return (valore(a, colonna) - valore(b, colonna)) * verso;
    });
  }, [righe, colonna, discendente, lingua]);

  // Il massimo serve solo a dare una scala alle barre. Se nessuno ha stime la
  // scala non esiste, e le barre non vengono disegnate affatto: una barra
  // piena in un mondo senza dati e' il modo piu' diretto per far credere il
  // contrario di cio' che si sa.
  const massimo = Math.max(0, ...righe.map((r) => r.minutiStimati));

  const apertiTotali = righe.reduce((n, r) => n + r.taskAperti, 0);
  const senzaStimaTotali = righe.reduce((n, r) => n + r.minutiSenzaStima, 0);

  const ordina = (nuova: Colonna) => {
    if (nuova === colonna) {
      setDiscendente((d) => !d);
      return;
    }
    setColonna(nuova);
    // Sui numeri interessa quasi sempre il piu' alto; sui nomi, la A.
    setDiscendente(nuova !== 'persona');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Workload')}</CardTitle>
        <CardDescription>
          {t('Open tasks per person, and how much of that work has an estimate.')}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* La copertura delle stime prima della tabella: senza, ogni riga qui
            sotto si legge come un carico certo. */}
        {apertiTotali > 0 && (
          <p
            className={cn(
              'flex items-start gap-2 rounded-md border p-3 text-sm',
              senzaStimaTotali > 0 ? 'border-amber-500/40 bg-amber-500/5' : 'text-muted-foreground'
            )}
          >
            {senzaStimaTotali > 0 && (
              <Warning className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            )}
            <span>
              {senzaStimaTotali > 0
                ? t('{senza} of {totale} open tasks have no estimate: that part of the workload is unknown.', {
                    senza: senzaStimaTotali,
                    totale: apertiTotali,
                  })
                : t('All {totale} open tasks have an estimate.', { totale: apertiTotali })}
            </span>
          </p>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <Intestazione
                etichetta={t('Person')}
                colonna="persona"
                attiva={colonna}
                discendente={discendente}
                onClick={ordina}
              />
              <Intestazione
                etichetta={t('Open')}
                colonna="aperti"
                attiva={colonna}
                discendente={discendente}
                onClick={ordina}
                numerica
              />
              <Intestazione
                etichetta={t('Estimated')}
                colonna="stimati"
                attiva={colonna}
                discendente={discendente}
                onClick={ordina}
                numerica
              />
              <Intestazione
                etichetta={t('No estimate')}
                colonna="senzaStima"
                attiva={colonna}
                discendente={discendente}
                onClick={ordina}
                numerica
              />
              <Intestazione
                etichetta={t('Overdue')}
                colonna="ritardo"
                attiva={colonna}
                discendente={discendente}
                onClick={ordina}
                numerica
              />
            </TableRow>
          </TableHeader>

          <TableBody>
            {ordinate.map((riga) => (
              <TableRow key={riga.employee.id}>
                <TableCell className="min-w-[10rem]">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={riga.employee.avatar} alt="" />
                      <AvatarFallback>{iniziali(riga.employee.name)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate font-medium">{riga.employee.name}</span>
                  </div>
                </TableCell>

                <TableCell className="text-right tabular-nums">{riga.taskAperti}</TableCell>

                <TableCell className="min-w-[9rem] text-right">
                  <div className="flex flex-col items-end gap-1">
                    <span className="tabular-nums font-medium">
                      {riga.minutiSenzaStima === 0
                        ? formattaMinuti(riga.minutiStimati, lingua)
                        : riga.minutiStimati === 0
                          ? // Nessuno dei task aperti e' stimato: qui non c'e'
                            // un totale basso, non c'e' proprio un totale, e
                            // "0m" lo farebbe sembrare libero.
                            SEGNO_IGNOTO
                          : // "almeno": sotto ci sono task non stimati, quindi
                            // il totale e' un pavimento, non una misura.
                            t('at least {tempo}', { tempo: formattaMinuti(riga.minutiStimati, lingua) })}
                    </span>
                    {massimo > 0 && (
                      <BarraCarico
                        minuti={riga.minutiStimati}
                        massimo={massimo}
                        ignoti={riga.minutiSenzaStima}
                      />
                    )}
                  </div>
                </TableCell>

                <TableCell className="text-right">
                  {riga.minutiSenzaStima > 0 ? (
                    <Badge variant="outline" className="gap-1 border-amber-500/50 font-normal">
                      <Question className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="tabular-nums">{riga.minutiSenzaStima}</span>
                    </Badge>
                  ) : (
                    <span className="tabular-nums text-muted-foreground">0</span>
                  )}
                </TableCell>

                <TableCell className="text-right">
                  {riga.inRitardo > 0 ? (
                    <Badge variant="destructive" className="gap-1 font-normal">
                      <Warning className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="tabular-nums">{riga.inRitardo}</span>
                    </Badge>
                  ) : (
                    <span className="tabular-nums text-muted-foreground">0</span>
                  )}
                </TableCell>
              </TableRow>
            ))}

            {ordinate.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  {t('No people to show')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function valore(riga: RigaCarico, colonna: Exclude<Colonna, 'persona'>): number {
  if (colonna === 'aperti') return riga.taskAperti;
  if (colonna === 'stimati') return riga.minutiStimati;
  if (colonna === 'senzaStima') return riga.minutiSenzaStima;
  return riga.inRitardo;
}

interface IntestazioneProps {
  etichetta: string;
  colonna: Colonna;
  attiva: Colonna;
  discendente: boolean;
  onClick: (colonna: Colonna) => void;
  numerica?: boolean;
}

/**
 * Intestazione ordinabile.
 *
 * E' un `button` vero dentro la cella, non un `th` con un `onClick`: cosi'
 * l'ordinamento si raggiunge con il tabulatore e si attiva con Invio o spazio
 * senza che si debba reimplementare nulla. `aria-sort` dice a chi non vede la
 * freccia come e' ordinata la tabella in quel momento.
 */
function Intestazione({
  etichetta,
  colonna,
  attiva,
  discendente,
  onClick,
  numerica,
}: IntestazioneProps) {
  const { t } = useTranslation();
  const eAttiva = colonna === attiva;
  const Freccia = discendente ? ArrowDown : ArrowUp;

  return (
    <TableHead
      aria-sort={eAttiva ? (discendente ? 'descending' : 'ascending') : 'none'}
      className={cn('p-0', numerica && 'text-right')}
    >
      <button
        type="button"
        onClick={() => onClick(colonna)}
        className={cn(
          'flex w-full items-center gap-1 px-2 py-2 text-xs font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          numerica && 'justify-end'
        )}
      >
        <span>{etichetta}</span>
        {/* La freccia compare solo sulla colonna ordinata, ma l'ordinamento non
            e' comunicato dalla sola icona: c'e' `aria-sort` e c'e' il titolo. */}
        {eAttiva && <Freccia className="h-3.5 w-3.5" aria-hidden="true" />}
        <span className="sr-only">
          {eAttiva
            ? discendente
              ? t('sorted descending, activate to sort ascending')
              : t('sorted ascending, activate to sort descending')
            : t('activate to sort by this column')}
        </span>
      </button>
    </TableHead>
  );
}

/**
 * La barra che rende evidente chi e' piu' carico.
 *
 * La parte piena e' proporzionale alle ore stimate. Quando esistono task senza
 * stima si aggiunge una coda a righe di larghezza FISSA: non rappresenta una
 * quantita' — non la conosciamo — ma dice che la barra continua oltre cio' che
 * si vede. Darle una larghezza proporzionale a qualcosa sarebbe inventare le
 * ore che mancano.
 */
function BarraCarico({
  minuti,
  massimo,
  ignoti,
}: {
  minuti: number;
  massimo: number;
  ignoti: number;
}) {
  const percentuale = massimo > 0 ? Math.round((minuti / massimo) * 100) : 0;

  return (
    <div className="flex h-1.5 w-full max-w-[8rem] items-stretch gap-px overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <div className="rounded-full bg-primary" style={{ width: `${percentuale}%` }} />
      {ignoti > 0 && (
        <div
          className="w-4 shrink-0 rounded-full text-muted-foreground opacity-70"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, currentColor 0 2px, transparent 2px 4px)',
          }}
        />
      )}
    </div>
  );
}

/** Iniziali per l'avatar quando manca l'immagine. */
function iniziali(nome: string): string {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('');
}
