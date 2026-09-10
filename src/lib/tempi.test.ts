import { describe, it, expect } from 'vitest';
import { analizzaDurata, caricoPersona, formattaMinuti, scostamentoStima } from '@/lib/tempi';
import type { Task } from '@/lib/types';

const IERI = new Date(Date.now() - 86400000).toISOString();
const DOMANI = new Date(Date.now() + 86400000).toISOString();

const task = (patch: Partial<Task>): Task =>
  ({
    id: Math.random().toString(36).slice(2),
    title: 'x',
    description: '',
    assigneeId: 'ada',
    priority: 'medium',
    status: 'not-started',
    createdAt: IERI,
    ...patch,
  }) as Task;

/**
 * Il punto di questi test non e' l'aritmetica: e' che "non lo so" resti
 * distinguibile da zero in ogni funzione. E' l'unico modo perche' una vista
 * del carico non faccia sembrare scarico chi semplicemente non e' stimato.
 */
describe('formattaMinuti', () => {
  it('non trasforma un dato mancante in un tempo', () => {
    expect(formattaMinuti(null, 'it')).toBe('—');
    expect(formattaMinuti(undefined, 'it')).toBe('—');
    expect(formattaMinuti(Number.NaN, 'it')).toBe('—');
    // Zero invece e' un tempo misurato, e va mostrato come tale.
    expect(formattaMinuti(0, 'it')).toBe('0m');
  });

  it('passa da minuti a ore quando ha senso leggerle cosi', () => {
    expect(formattaMinuti(59, 'it')).toBe('59m');
    expect(formattaMinuti(60, 'it')).toBe('1h');
    expect(formattaMinuti(90, 'it')).toBe('1h 30m');
    expect(formattaMinuti(1440, 'it')).toBe('24h');
  });

  it('usa i separatori della lingua sui numeri grandi', () => {
    // "12.000h" e "12,000h" sono lo stesso carico scritto in due lingue: in
    // quella sbagliata si legge un numero mille volte diverso.
    expect(formattaMinuti(12000 * 60, 'it')).toBe('12.000h');
    expect(formattaMinuti(12000 * 60, 'en')).toBe('12,000h');
  });

  it('mostra il segno di uno scostamento in difetto', () => {
    expect(formattaMinuti(-30, 'it')).toBe('-30m');
  });
});

describe('analizzaDurata', () => {
  it('accetta le forme in cui una persona scrive una durata', () => {
    expect(analizzaDurata('90')).toBe(90);
    expect(analizzaDurata('1.5h')).toBe(90);
    expect(analizzaDurata('2h30')).toBe(150);
    expect(analizzaDurata('2h 30m')).toBe(150);
    expect(analizzaDurata('45m')).toBe(45);
    expect(analizzaDurata('45 min')).toBe(45);
    expect(analizzaDurata('2H30M')).toBe(150);
    expect(analizzaDurata('  3h  ')).toBe(180);
    expect(analizzaDurata('0')).toBe(0);
  });

  it('accetta la virgola decimale', () => {
    // L'interfaccia parla anche italiano, francese, tedesco e spagnolo: "1,5"
    // e' il modo NORMALE di scrivere un'ora e mezza, non un errore di battitura.
    expect(analizzaDurata('1,5h')).toBe(90);
    expect(analizzaDurata('0,5h')).toBe(30);
  });

  it('rifiuta invece di indovinare', () => {
    expect(analizzaDurata('')).toBeNull();
    expect(analizzaDurata('   ')).toBeNull();
    expect(analizzaDurata('abc')).toBeNull();
    expect(analizzaDurata('-5')).toBeNull();
    expect(analizzaDurata('-2h')).toBeNull();
    expect(analizzaDurata('due ore')).toBeNull();
    expect(analizzaDurata('2h30x')).toBeNull();
    expect(analizzaDurata('circa 2h')).toBeNull();
    // Decimale senza unita': puo' valere un'ora e mezza o un minuto e mezzo.
    // Sceglierne una vorrebbe dire salvare un numero che nessuno ha scritto.
    expect(analizzaDurata('1,5')).toBeNull();
  });
});

describe('caricoPersona', () => {
  const tasks: Task[] = [
    task({ assigneeId: 'ada', estimateMinutes: 120 }),
    task({ assigneeId: 'ada', estimateMinutes: 60, dueDate: IERI }),
    task({ assigneeId: 'ada', estimateMinutes: null }),
    task({ assigneeId: 'ada' }),
    // Chiuso: non e' piu' carico, per quanto grosso fosse.
    task({ assigneeId: 'ada', estimateMinutes: 6000, status: 'completed', dueDate: IERI }),
    task({ assigneeId: 'grace', estimateMinutes: 30, dueDate: DOMANI }),
  ];

  it('somma solo i task aperti e dice quanti non hanno stima', () => {
    const carico = caricoPersona(tasks, 'ada');
    expect(carico.taskAperti).toBe(4);
    expect(carico.minutiStimati).toBe(180);
    // Il numero che impedisce di leggere "3h" come "ha poco da fare".
    expect(carico.minutiSenzaStima).toBe(2);
    expect(carico.inRitardo).toBe(1);
  });

  it('chi non ha task e a zero, non ignoto', () => {
    expect(caricoPersona(tasks, 'linus')).toEqual({
      taskAperti: 0,
      minutiStimati: 0,
      minutiSenzaStima: 0,
      inRitardo: 0,
    });
  });

  it('non conta come stima un valore che non e una durata', () => {
    const strani = [
      task({ assigneeId: 'ada', estimateMinutes: -30 }),
      task({ assigneeId: 'ada', estimateMinutes: Number.NaN }),
    ];
    const carico = caricoPersona(strani, 'ada');
    expect(carico.minutiStimati).toBe(0);
    expect(carico.minutiSenzaStima).toBe(2);
  });
});

describe('scostamentoStima', () => {
  it('confronta impiegato e stimato solo quando ci sono entrambi', () => {
    expect(scostamentoStima({ estimateMinutes: 60, spentMinutes: 90 })).toBe(30);
    expect(scostamentoStima({ estimateMinutes: 90, spentMinutes: 60 })).toBe(-30);
    expect(scostamentoStima({ estimateMinutes: 60, spentMinutes: 60 })).toBe(0);
  });

  it('senza uno dei due valori non esiste scostamento', () => {
    // Zero direbbe "ci ha preso", che di un task non stimato non e' vero.
    expect(scostamentoStima({ estimateMinutes: null, spentMinutes: 90 })).toBeNull();
    expect(scostamentoStima({ estimateMinutes: 60, spentMinutes: null })).toBeNull();
    expect(scostamentoStima({})).toBeNull();
  });
});
