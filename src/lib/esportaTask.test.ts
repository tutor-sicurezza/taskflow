import { describe, it, expect } from 'vitest';
import {
  COLONNE_DISPONIBILI,
  neutralizzaFormula,
  righeDaTask,
  versoCSV,
  type OpzioniEsportazione,
} from '@/lib/esportaTask';
import type { Employee, Task } from '@/lib/types';

/**
 * I test guardano il testo che finisce nel file, non le strutture intermedie:
 * e' li' che si vedono i due difetti che rompono davvero un export — una
 * virgola in un titolo che sposta tutte le colonne, e un titolo che il foglio
 * di calcolo esegue come formula.
 */

const IMPIEGATI: Employee[] = [
  { id: 'e1', name: 'Chiara Bianchi', avatar: '', role: 'Dev', status: 'active', joinedDate: '2024-01-01' },
];

function task(parziale: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Titolo',
    description: 'Descrizione',
    assigneeId: 'e1',
    priority: 'medium',
    status: 'not-started',
    dueDate: '2025-03-10T00:00:00.000Z',
    createdAt: '2025-01-05T00:00:00.000Z',
    ...parziale,
  };
}

const opz = (colonne: string[], resto: Partial<OpzioniEsportazione> = {}): OpzioniEsportazione => ({
  colonne,
  ...resto,
});

describe('righeDaTask', () => {
  it('mette l intestazione in prima riga e una riga per task', () => {
    const righe = righeDaTask([task(), task({ id: 't2' })], IMPIEGATI, opz(['titolo', 'stato']), 'it');

    expect(righe).toHaveLength(3);
    expect(righe[0]).toEqual(['Titolo', 'Stato']);
    expect(righe[1]).toEqual(['Titolo', 'Da iniziare']);
  });

  it('esporta solo le colonne scelte, nell ordine in cui sono state chieste', () => {
    const righe = righeDaTask([task()], IMPIEGATI, opz(['stato', 'titolo']), 'en');

    expect(righe[0]).toEqual(['Status', 'Title']);
    expect(righe[1]).toEqual(['Not Started', 'Titolo']);
  });

  it('scarta le colonne che non esistono invece di fallire', () => {
    // Una preferenza salvata mesi fa puo' contenere una colonna che non c'e' piu'.
    const righe = righeDaTask([task()], IMPIEGATI, opz(['titolo', 'colonna-fantasma']), 'it');
    expect(righe[0]).toEqual(['Titolo']);
  });

  it('senza colonne valide non produce nulla, nemmeno l intestazione', () => {
    expect(righeDaTask([task()], IMPIEGATI, opz([]), 'it')).toEqual([]);
  });

  it('con un elenco vuoto resta la sola intestazione', () => {
    const righe = righeDaTask([], IMPIEGATI, opz(['titolo', 'stato']), 'it');
    expect(righe).toEqual([['Titolo', 'Stato']]);
    // E il CSV corrispondente e' una riga sola, non una stringa vuota: chi lo
    // apre deve vedere che l'export e' riuscito e che i task erano zero.
    expect(versoCSV(righe)).toBe('Titolo,Stato');
  });

  it('un task senza scadenza da una cella vuota, non "Invalid Date"', () => {
    const senza = [task({ dueDate: null }), task({ id: 't2', dueDate: undefined }), task({ id: 't3', dueDate: 'non-una-data' })];
    const righe = righeDaTask(senza, IMPIEGATI, opz(['scadenza']), 'it');

    expect(righe.slice(1)).toEqual([[''], [''], ['']]);
  });

  it('un task senza assegnatario da una cella vuota, e cosi anche uno assegnato a chi non c e piu', () => {
    const righe = righeDaTask(
      [task({ assigneeId: null }), task({ id: 't2', assigneeId: 'licenziato' })],
      IMPIEGATI,
      opz(['assegnatario']),
      'it'
    );

    expect(righe.slice(1)).toEqual([[''], ['']]);
  });

  it('risolve il nome dell assegnatario quando esiste', () => {
    const righe = righeDaTask([task()], IMPIEGATI, opz(['assegnatario']), 'it');
    expect(righe[1]).toEqual(['Chiara Bianchi']);
  });

  it('formatta date e numeri nella lingua chiesta, non in en-US', () => {
    const t = task({ dueDate: '2025-03-10T12:00:00.000Z', estimateMinutes: 90 });

    const [, itRiga] = righeDaTask([t], IMPIEGATI, opz(['scadenza', 'stima']), 'it');
    const [, enRiga] = righeDaTask([t], IMPIEGATI, opz(['scadenza', 'stima']), 'en');

    // 1,5 con la virgola in italiano: un "1.5" in un foglio italiano si legge
    // come millecinquecento.
    expect(itRiga[1]).toBe('1,5 h');
    expect(enRiga[1]).toBe('1.5 h');
    expect(itRiga[0]).not.toBe(enRiga[0]);
  });

  it('lascia vuote stima e tempo impiegato quando non ci sono', () => {
    const righe = righeDaTask(
      [task({ estimateMinutes: null, spentMinutes: undefined })],
      IMPIEGATI,
      opz(['stima', 'tempoImpiegato']),
      'it'
    );
    expect(righe[1]).toEqual(['', '']);
  });

  it('esclude gli archiviati salvo richiesta esplicita', () => {
    const elenco = [task(), task({ id: 't2', archivedAt: '2025-02-01T00:00:00.000Z' })];

    expect(righeDaTask(elenco, IMPIEGATI, opz(['titolo']), 'it')).toHaveLength(2);
    expect(
      righeDaTask(elenco, IMPIEGATI, opz(['titolo'], { soloVisibili: false }), 'it')
    ).toHaveLength(3);
  });

  it('unisce le etichette in una cella sola', () => {
    const righe = righeDaTask([task({ labels: ['urgente', 'cliente'] })], IMPIEGATI, opz(['etichette']), 'it');
    expect(righe[1]).toEqual(['urgente, cliente']);
  });

  it('copre tutte le colonne dichiarate senza mai restituire undefined', () => {
    const righe = righeDaTask([task()], IMPIEGATI, opz([...COLONNE_DISPONIBILI]), 'it');
    expect(righe[1]).toHaveLength(COLONNE_DISPONIBILI.length);
    righe[1].forEach((cella) => expect(typeof cella).toBe('string'));
  });
});

describe('versoCSV: RFC 4180', () => {
  it('racchiude fra virgolette il campo che contiene una virgola', () => {
    // Il caso che rompe i file veri: senza virgolette la riga guadagna una
    // colonna e tutto cio' che segue scivola di uno, in silenzio.
    expect(versoCSV([['Rivedi il contratto, poi firma', 'ok']])).toBe(
      '"Rivedi il contratto, poi firma",ok'
    );
  });

  it('raddoppia le virgolette interne e racchiude il campo', () => {
    expect(versoCSV([['Titolo con "virgolette" dentro']])).toBe(
      '"Titolo con ""virgolette"" dentro"'
    );
  });

  it('conserva gli a capo dentro il campo, racchiudendolo', () => {
    expect(versoCSV([['prima riga\nseconda riga']])).toBe('"prima riga\nseconda riga"');
    expect(versoCSV([['con\r\nCRLF']])).toBe('"con\r\nCRLF"');
  });

  it('separa le righe con CRLF, come prescrive la specifica', () => {
    expect(versoCSV([['a', 'b'], ['c', 'd']])).toBe('a,b\r\nc,d');
  });

  it('non tocca i campi che non ne hanno bisogno', () => {
    expect(versoCSV([['semplice', '42']])).toBe('semplice,42');
  });

  it('lascia intatti gli accenti e i caratteri non ASCII', () => {
    const righe = [['Verifica qualità', 'Übergabe prüfen', 'révision 完了']];
    expect(versoCSV(righe)).toBe('Verifica qualità,Übergabe prüfen,révision 完了');
  });
});

describe('versoCSV: protezione da CSV injection', () => {
  // Un titolo che comincia con uno di questi caratteri viene ESEGUITO da Excel
  // e LibreOffice all'apertura: chi scrive il task deciderebbe cosa gira sul
  // computer di chi apre l'export.
  it.each(['=', '+', '-', '@'])('neutralizza il campo che comincia con "%s"', (segno) => {
    const contenuto = versoCSV([[`${segno}HYPERLINK("http://male.example","clicca")`]]);
    expect(contenuto.startsWith(`"'${segno}`)).toBe(true);
  });

  it('neutralizza anche tabulazione e ritorno a capo iniziali', () => {
    // I fogli di calcolo li saltano prima di guardare il primo carattere utile.
    expect(neutralizzaFormula('\t=cmd')).toBe("'\t=cmd");
    expect(neutralizzaFormula('\r=cmd')).toBe("'\r=cmd");
  });

  it('mette l apice PRIMA della citazione RFC 4180', () => {
    // L'ordine conta: l'apice fa parte del valore, le virgolette del trasporto.
    expect(versoCSV([['=SOMMA(1,2)']])).toBe('"\'=SOMMA(1,2)"');
  });

  it('non tocca un campo che ha quei caratteri in mezzo', () => {
    expect(neutralizzaFormula('2+2 da verificare')).toBe('2+2 da verificare');
    expect(versoCSV([['budget = 100']])).toBe('budget = 100');
  });

  it('lascia in pace il campo vuoto', () => {
    expect(neutralizzaFormula('')).toBe('');
    expect(versoCSV([['', '']])).toBe(',');
  });

  it('protegge i dati veri che arrivano dai task', () => {
    const righe = righeDaTask(
      [task({ title: '=cmd|\' /C calc\'!A0', description: 'Nota, con virgola e "virgolette"' })],
      IMPIEGATI,
      opz(['titolo', 'descrizione']),
      'it'
    );

    const csv = versoCSV(righe);
    // Nessuna riga dei dati comincia con un carattere da formula.
    csv.split('\r\n').slice(1).forEach((riga) => {
      expect(['=', '+', '-', '@'].includes(riga[0])).toBe(false);
    });
    expect(csv).toContain('"Nota, con virgola e ""virgolette"""');
  });
});
