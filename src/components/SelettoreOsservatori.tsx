import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Eye, MagnifyingGlass, UserPlus, X } from '@phosphor-icons/react';
import { useTranslation } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { Employee } from '@/lib/types';

/**
 * Chi segue un task pur non essendone assegnatario.
 *
 * Oggi un task ha un solo assegnatario, e da li' nascono tre buchi noti nelle
 * notifiche: chi commenta non sa delle risposte, chi ha creato il lavoro non
 * sa quando viene chiuso, chi si vede togliere un task non viene avvisato.
 * Tutti e tre hanno la stessa radice — manca il concetto di "interessato senza
 * essere responsabile" — e questo componente e' il posto in cui si dichiara.
 *
 * Non e' un secondo elenco di assegnatari: chi osserva riceve gli
 * aggiornamenti e basta, la responsabilita' resta di una persona sola. Per
 * questo l'azione piu' visibile e' "segui questo task" su se' stessi, che e'
 * il gesto di gran lunga piu' frequente.
 */

interface SelettoreOsservatoriProps {
  /** Id delle persone che seguono il task. */
  value: string[];
  onChange: (osservatori: string[]) => void;
  employees: Employee[];
  /** L'assegnatario corrente: e' escluso dagli osservatori, vedi sotto. */
  assigneeId: string | null;
  /**
   * Chi sta usando l'applicazione. Normalmente arriva dalla sessione; resta un
   * parametro per poter montare il componente anche fuori dall'autenticazione.
   */
  currentUserId?: string | null;
  disabled?: boolean;
  className?: string;
}

/** Iniziali per l'avatar quando la foto manca o non carica. */
function iniziali(nome: string): string {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((pezzo) => pezzo[0])
    .join('')
    .toUpperCase();
}

export function SelettoreOsservatori({
  value,
  onChange,
  employees,
  assigneeId,
  currentUserId,
  disabled = false,
  className,
}: SelettoreOsservatoriProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const idCampo = useId();
  const idElenco = `${idCampo}-elenco`;
  const contenitore = useRef<HTMLDivElement>(null);

  const [testo, setTesto] = useState('');
  const [aperto, setAperto] = useState(false);
  const [evidenziata, setEvidenziata] = useState(0);
  const [annuncio, setAnnuncio] = useState('');

  const ioId = currentUserId ?? user?.id ?? null;

  /**
   * L'assegnatario non compare MAI fra gli osservatori.
   *
   * Riceve gia' ogni notifica del task per il fatto di esserne responsabile:
   * elencarlo anche qui non aggiungerebbe un avviso, ma mescolerebbe due ruoli
   * diversi — "deve farlo" e "vuole saperlo" — e la prima domanda di chi legge
   * la scheda diventerebbe quale dei due valga. Se e' rimasto fra gli
   * osservatori (tipico dopo una riassegnazione: chi seguiva il task se lo
   * ritrova assegnato) lo si toglie da quello che si mostra, senza riscrivere
   * `value`: e' chi monta il componente a decidere quando salvare, e una
   * scrittura partita da sola sorprenderebbe.
   */
  const osservatori = useMemo(
    () => (value ?? []).filter((id) => id !== assigneeId),
    [value, assigneeId]
  );

  const perId = useMemo(() => {
    const mappa = new Map<string, Employee>();
    for (const persona of employees ?? []) mappa.set(persona.id, persona);
    return mappa;
  }, [employees]);

  const candidati = useMemo(() => {
    const gia = new Set(osservatori);
    const cercato = testo.trim().toLowerCase();
    return (employees ?? []).filter((persona) => {
      if (gia.has(persona.id) || persona.id === assigneeId) return false;
      // Chi e' disattivato non riceverebbe comunque nulla: proporlo sarebbe
      // una promessa che il sistema non mantiene.
      if (persona.status !== 'active') return false;
      if (!cercato) return true;
      return (
        persona.name.toLowerCase().includes(cercato) ||
        (persona.email ?? '').toLowerCase().includes(cercato) ||
        (persona.role ?? '').toLowerCase().includes(cercato)
      );
    });
  }, [employees, osservatori, assigneeId, testo]);

  const ioSegue = ioId !== null && osservatori.includes(ioId);
  // Se sono io l'assegnatario non ha senso propormi di seguire il task: sono
  // gia' avvisato di tutto, e il pulsante prometterebbe qualcosa in piu' che
  // non esiste.
  const ioSonoAssegnatario = ioId !== null && ioId === assigneeId;

  useEffect(() => {
    setEvidenziata(0);
  }, [testo, aperto]);

  useEffect(() => {
    if (!aperto) return;
    const fuori = (evento: MouseEvent | TouchEvent) => {
      if (!contenitore.current?.contains(evento.target as Node)) setAperto(false);
    };
    document.addEventListener('mousedown', fuori);
    document.addEventListener('touchstart', fuori);
    return () => {
      document.removeEventListener('mousedown', fuori);
      document.removeEventListener('touchstart', fuori);
    };
  }, [aperto]);

  function aggiungi(id: string) {
    if (!id || id === assigneeId || osservatori.includes(id)) return;
    onChange([...osservatori, id]);
    setAnnuncio(t('{name} now follows this task', { name: perId.get(id)?.name ?? id }));
    setTesto('');
  }

  function rimuovi(id: string) {
    onChange(osservatori.filter((altro) => altro !== id));
    setAnnuncio(t('{name} no longer follows this task', { name: perId.get(id)?.name ?? id }));
  }

  function daTastiera(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      if (!aperto) {
        setAperto(true);
        return;
      }
      if (candidati.length === 0) return;
      const passo = evento.key === 'ArrowDown' ? 1 : -1;
      setEvidenziata((corrente) => (corrente + passo + candidati.length) % candidati.length);
      return;
    }

    if (evento.key === 'Enter') {
      evento.preventDefault();
      const scelto = candidati[evidenziata];
      if (scelto) aggiungi(scelto.id);
      return;
    }

    if (evento.key === 'Escape' && aperto) {
      // Fermato solo con l'elenco aperto: dentro un dialogo, l'Escape
      // successivo deve continuare a chiuderlo.
      evento.preventDefault();
      evento.stopPropagation();
      setAperto(false);
    }
  }

  return (
    <div className={cn('flex flex-col gap-2', className)} ref={contenitore}>
      <Label htmlFor={idCampo} className="flex items-center gap-1.5">
        <Eye className="h-4 w-4" aria-hidden="true" />
        {t('Watchers')}
      </Label>

      {ioId !== null && !ioSonoAssegnatario && (
        <Button
          type="button"
          variant={ioSegue ? 'secondary' : 'outline'}
          disabled={disabled}
          onClick={() => (ioSegue ? rimuovi(ioId) : aggiungi(ioId))}
          // aria-pressed e non il solo colore: "seguo" e "non seguo" devono
          // distinguersi anche per chi non vede la differenza fra le varianti.
          aria-pressed={ioSegue}
          className="h-10 w-full justify-start gap-2 sm:w-auto"
        >
          <Eye className="h-4 w-4" weight={ioSegue ? 'fill' : 'regular'} aria-hidden="true" />
          {ioSegue ? t('Following this task') : t('Follow this task')}
        </Button>
      )}

      {ioSonoAssegnatario && (
        <p className="text-xs text-muted-foreground">
          {t('You are assigned to this task, so you already get every update.')}
        </p>
      )}

      {osservatori.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {osservatori.map((id) => {
            const persona = perId.get(id);
            // Chi ha lasciato l'azienda resta nell'elenco invece di sparire:
            // un osservatore che scompare senza spiegazione fa sospettare che
            // il salvataggio abbia perso dei dati.
            const nome = persona?.name ?? t('Unknown user');
            return (
              <li
                key={id}
                className="flex min-h-10 items-center gap-2 rounded-md border px-2 py-1"
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={persona?.avatar} alt="" />
                  <AvatarFallback className="text-[10px]">{iniziali(nome)}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm">
                    {nome}
                    {id === ioId && (
                      <span className="ml-1 text-xs text-muted-foreground">{t('(you)')}</span>
                    )}
                  </span>
                  {persona?.role && (
                    <span className="truncate text-xs text-muted-foreground">{persona.role}</span>
                  )}
                </div>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => rimuovi(id)}
                    aria-label={t('Remove {name} from watchers', { name: nome })}
                    className="ml-auto inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-8 sm:w-8"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{t('Nobody follows this task yet')}</p>
      )}

      {!disabled && (
        <div className="relative">
          <MagnifyingGlass
            className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={idCampo}
            value={testo}
            onChange={(e) => {
              setTesto(e.target.value);
              setAperto(true);
            }}
            onFocus={() => setAperto(true)}
            onKeyDown={daTastiera}
            placeholder={t('Add someone who should follow this task')}
            className="h-10 pl-8"
            role="combobox"
            aria-expanded={aperto}
            aria-controls={idElenco}
            aria-autocomplete="list"
            aria-activedescendant={
              aperto && candidati.length > 0 ? `${idElenco}-${evidenziata}` : undefined
            }
          />

          {aperto && (
            <div
              id={idElenco}
              role="listbox"
              aria-label={t('People who can follow this task')}
              className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
            >
              {candidati.length === 0 && (
                <p className="px-2 py-2 text-sm text-muted-foreground">
                  {t('No one else to add')}
                </p>
              )}

              {candidati.map((persona, indice) => (
                <div
                  key={persona.id}
                  id={`${idElenco}-${indice}`}
                  role="option"
                  aria-selected={indice === evidenziata}
                  // onMouseDown: il clic arriverebbe dopo il blur del campo,
                  // che avrebbe gia' chiuso l'elenco sotto il dito.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    aggiungi(persona.id);
                  }}
                  onMouseEnter={() => setEvidenziata(indice)}
                  className={cn(
                    'flex min-h-10 cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                    indice === evidenziata && 'bg-accent text-accent-foreground'
                  )}
                >
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarImage src={persona.avatar} alt="" />
                    <AvatarFallback className="text-[10px]">
                      {iniziali(persona.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{persona.name}</span>
                  {persona.id === ioId && (
                    <span className="text-xs text-muted-foreground">{t('(you)')}</span>
                  )}
                  <UserPlus className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <span aria-live="polite" className="sr-only">
        {annuncio}
      </span>
    </div>
  );
}
