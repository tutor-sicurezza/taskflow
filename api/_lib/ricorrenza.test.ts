import { describe, it, expect } from 'vitest';
import {
  descriviRicorrenza,
  prossimaOccorrenza,
  regolaValida,
  type RegolaRicorrenza,
} from './ricorrenza.js';

/**
 * I casi limite di questo modulo non sono teorici: il 31 del mese capita
 * sette volte l'anno e il cambio dell'ora due, e in un registro di controlli
 * di sicurezza una data sbagliata resta li' finche' non la guarda un
 * ispettore. Le date dei test si costruiscono con il costruttore locale
 * `new Date(anno, mese, giorno, ...)` e non con stringhe ISO, perche' tutto il
 * modulo ragiona in ora locale: usare 'Z' renderebbe l'esito dipendente dal
 * fuso della macchina che esegue i test.
 */

/** Scorciatoia leggibile: mese in base 1, come lo scrive una persona. */
function data(anno: number, mese: number, giorno: number, ore = 9): Date {
  return new Date(anno, mese - 1, giorno, ore, 0, 0, 0);
}

function comeTesto(d: Date | null): string | null {
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
}

describe('prossimaOccorrenza - cadenza a giorni', () => {
  it('somma i giorni richiesti', () => {
    const regola: RegolaRicorrenza = { tipo: 'giorni', ogni: 3 };
    expect(comeTesto(prossimaOccorrenza(regola, data(2026, 3, 10)))).toBe('2026-03-13 09:00');
  });

  it('attraversa il cambio di mese e l anno bisestile', () => {
    const regola: RegolaRicorrenza = { tipo: 'giorni', ogni: 1 };
    expect(comeTesto(prossimaOccorrenza(regola, data(2028, 2, 28)))).toBe('2028-02-29 09:00');
    expect(comeTesto(prossimaOccorrenza(regola, data(2026, 12, 31)))).toBe('2027-01-01 09:00');
  });
});

describe('prossimaOccorrenza - ora legale', () => {
  /**
   * Il test che protegge dalla deriva: se il calcolo usasse
   * `+ giorni * 86400000`, nei fusi con l'ora legale il giorno del cambio
   * (23 o 25 ore) sposterebbe l'orario del controllo di un'ora, per sempre.
   * L'asserzione e' sull'invariante — l'ora da orologio non cambia mai — cosi'
   * vale in qualunque fuso, compreso UTC dove il problema non si presenta.
   */
  it('tiene fermo l orario per un anno intero di rinnovi giornalieri', () => {
    const regola: RegolaRicorrenza = { tipo: 'giorni', ogni: 1 };
    let corrente = data(2026, 1, 1, 9);

    for (let i = 0; i < 365; i += 1) {
      const precedente = corrente;
      const prossima = prossimaOccorrenza(regola, precedente);
      expect(prossima).not.toBeNull();
      corrente = prossima as Date;

      expect(corrente.getHours()).toBe(9);
      expect(corrente.getMinutes()).toBe(0);
      // E' anche avanzato di esattamente un giorno di calendario.
      const atteso = new Date(
        precedente.getFullYear(),
        precedente.getMonth(),
        precedente.getDate() + 1
      );
      expect(corrente.getFullYear()).toBe(atteso.getFullYear());
      expect(corrente.getMonth()).toBe(atteso.getMonth());
      expect(corrente.getDate()).toBe(atteso.getDate());
    }
  });

  it('tiene fermo l orario anche a cadenza settimanale', () => {
    const regola: RegolaRicorrenza = { tipo: 'settimane', ogni: 1 };
    let corrente = data(2026, 2, 1, 7);
    for (let i = 0; i < 30; i += 1) {
      corrente = prossimaOccorrenza(regola, corrente) as Date;
      expect(corrente.getHours()).toBe(7);
    }
  });
});

describe('prossimaOccorrenza - cadenza a mesi e il caso del 31', () => {
  it('mantiene il giorno quando il mese di arrivo lo prevede', () => {
    const regola: RegolaRicorrenza = { tipo: 'mesi', ogni: 1 };
    expect(comeTesto(prossimaOccorrenza(regola, data(2026, 3, 15)))).toBe('2026-04-15 09:00');
  });

  it('il 31 gennaio piu un mese si ferma all ultimo giorno di febbraio', () => {
    const regola: RegolaRicorrenza = { tipo: 'mesi', ogni: 1 };
    // Scelta dichiarata in `aggiungiMesi`: il controllo di febbraio deve
    // cadere in febbraio, non slittare al 3 marzo lasciando il mese scoperto.
    expect(comeTesto(prossimaOccorrenza(regola, data(2026, 1, 31)))).toBe('2026-02-28 09:00');
  });

  it('nell anno bisestile si ferma al 29', () => {
    const regola: RegolaRicorrenza = { tipo: 'mesi', ogni: 1 };
    expect(comeTesto(prossimaOccorrenza(regola, data(2028, 1, 31)))).toBe('2028-02-29 09:00');
  });

  it('il 31 verso un mese da 30 giorni si ferma al 30', () => {
    const regola: RegolaRicorrenza = { tipo: 'mesi', ogni: 1 };
    expect(comeTesto(prossimaOccorrenza(regola, data(2026, 3, 31)))).toBe('2026-04-30 09:00');
  });

  it('nessun mese viene saltato in un anno di rinnovi mensili', () => {
    const regola: RegolaRicorrenza = { tipo: 'mesi', ogni: 1 };
    let corrente = data(2026, 1, 31);
    const mesi: number[] = [];
    for (let i = 0; i < 12; i += 1) {
      corrente = prossimaOccorrenza(regola, corrente) as Date;
      mesi.push(corrente.getMonth());
    }
    expect(mesi).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0]);
  });

  it('salta piu mesi e cambia anno', () => {
    const regola: RegolaRicorrenza = { tipo: 'mesi', ogni: 6 };
    expect(comeTesto(prossimaOccorrenza(regola, data(2026, 10, 15)))).toBe('2027-04-15 09:00');
  });
});

describe('prossimaOccorrenza - settimanale con giorni scelti', () => {
  it('senza giorni scelti resta lo stesso giorno della settimana', () => {
    const regola: RegolaRicorrenza = { tipo: 'settimane', ogni: 2 };
    // 2026-03-10 e' un martedi'.
    const prossima = prossimaOccorrenza(regola, data(2026, 3, 10));
    expect(comeTesto(prossima)).toBe('2026-03-24 09:00');
    expect(prossima?.getDay()).toBe(2);
  });

  it('con piu giorni scelti prende il prossimo della stessa settimana', () => {
    // Lunedi' (1), mercoledi' (3), venerdi' (5). Si parte da mercoledi' 11.
    const regola: RegolaRicorrenza = { tipo: 'settimane', ogni: 1, giorniSettimana: [1, 3, 5] };
    expect(comeTesto(prossimaOccorrenza(regola, data(2026, 3, 11)))).toBe('2026-03-13 09:00');
  });

  it('esauriti i giorni della settimana salta all intervallo successivo', () => {
    const regola: RegolaRicorrenza = { tipo: 'settimane', ogni: 1, giorniSettimana: [1, 3, 5] };
    // Venerdi' 13 e' l'ultimo giorno scelto: si riparte dal lunedi' seguente.
    expect(comeTesto(prossimaOccorrenza(regola, data(2026, 3, 13)))).toBe('2026-03-16 09:00');
  });

  it('con intervallo maggiore di uno non genera occorrenze nelle settimane in mezzo', () => {
    const regola: RegolaRicorrenza = { tipo: 'settimane', ogni: 3, giorniSettimana: [1, 4] };
    // Giovedi' 12 marzo: finiti i giorni della settimana, si saltano tre
    // settimane e si riparte dal lunedi'. Senza il salto uscirebbe il 16.
    expect(comeTesto(prossimaOccorrenza(regola, data(2026, 3, 12)))).toBe('2026-03-30 09:00');
  });

  it('i giorni scelti arrivano disordinati e con doppioni', () => {
    const regola = { tipo: 'settimane', ogni: 1, giorniSettimana: [5, 1, 1, 3] } as RegolaRicorrenza;
    expect(comeTesto(prossimaOccorrenza(regola, data(2026, 3, 11)))).toBe('2026-03-13 09:00');
  });
});

describe('prossimaOccorrenza - data di fine', () => {
  it('restituisce null quando la prossima supera la fine', () => {
    const regola: RegolaRicorrenza = { tipo: 'mesi', ogni: 1, fine: '2026-03-31' };
    expect(prossimaOccorrenza(regola, data(2026, 3, 15))).toBeNull();
  });

  it('l ultimo giorno e compreso, anche a un orario qualunque', () => {
    const regola: RegolaRicorrenza = { tipo: 'giorni', ogni: 1, fine: '2026-03-16' };
    // Con `new Date('2026-03-16')` (mezzanotte UTC) questa occorrenza sarebbe
    // stata scartata e la serie sarebbe finita un giorno prima.
    expect(comeTesto(prossimaOccorrenza(regola, data(2026, 3, 15, 18)))).toBe('2026-03-16 18:00');
  });

  it('accetta anche una fine scritta come istante completo', () => {
    const regola: RegolaRicorrenza = {
      tipo: 'giorni',
      ogni: 10,
      fine: new Date(2026, 2, 20, 12).toISOString(),
    };
    expect(prossimaOccorrenza(regola, data(2026, 3, 15))).toBeNull();
  });
});

describe('regolaValida', () => {
  it('accetta una regola completa e la ripulisce', () => {
    const risultato = regolaValida({
      tipo: 'settimane',
      ogni: 2,
      giorniSettimana: [5, 1, 1],
      fine: '2026-12-31',
      scherzo: 'da buttare',
    });
    expect(risultato).toEqual({
      tipo: 'settimane',
      ogni: 2,
      giorniSettimana: [1, 5],
      fine: '2026-12-31',
    });
  });

  it('scarta i giorni della settimana quando la cadenza non e settimanale', () => {
    expect(regolaValida({ tipo: 'giorni', ogni: 1, giorniSettimana: [1, 2] })).toEqual({
      tipo: 'giorni',
      ogni: 1,
    });
  });

  it('rifiuta ogni a zero, negativo, decimale o fuori scala', () => {
    for (const ogni of [0, -1, -12, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 1000]) {
      expect(regolaValida({ tipo: 'giorni', ogni })).toBeNull();
    }
  });

  it('non lancia mai, qualunque cosa arrivi dal jsonb', () => {
    const spazzatura: unknown[] = [
      null,
      undefined,
      42,
      true,
      'ciao',
      '{rotto',
      [],
      [{ tipo: 'giorni', ogni: 1 }],
      {},
      { tipo: 'anni', ogni: 1 },
      { tipo: 'giorni' },
      { tipo: 'giorni', ogni: '3' },
      { tipo: 'settimane', ogni: 1, giorniSettimana: 'lunedi' },
      { tipo: 'settimane', ogni: 1, giorniSettimana: [9] },
      { tipo: 'settimane', ogni: 1, giorniSettimana: [1, 'due'] },
      { tipo: 'giorni', ogni: 1, fine: 'domani' },
      { tipo: 'giorni', ogni: 1, fine: 12345 },
    ];
    for (const valore of spazzatura) {
      expect(() => regolaValida(valore)).not.toThrow();
      expect(regolaValida(valore)).toBeNull();
    }
  });

  it('accetta la regola arrivata come stringa JSON', () => {
    expect(regolaValida('{"tipo":"mesi","ogni":3}')).toEqual({ tipo: 'mesi', ogni: 3 });
  });

  it('una regola non valida non produce occorrenze', () => {
    const rotta = { tipo: 'giorni', ogni: 0 } as unknown as RegolaRicorrenza;
    expect(prossimaOccorrenza(rotta, data(2026, 3, 10))).toBeNull();
  });

  it('una data di partenza non valida non produce occorrenze', () => {
    expect(prossimaOccorrenza({ tipo: 'giorni', ogni: 1 }, new Date('boh'))).toBeNull();
  });
});

describe('descriviRicorrenza', () => {
  it('usa il singolare quando l intervallo e uno', () => {
    expect(descriviRicorrenza({ tipo: 'giorni', ogni: 1 }, 'it')).toBe('Ogni giorno');
    expect(descriviRicorrenza({ tipo: 'mesi', ogni: 1 }, 'en')).toBe('Every month');
  });

  it('descrive le cinque lingue', () => {
    const regola: RegolaRicorrenza = { tipo: 'settimane', ogni: 2 };
    expect(descriviRicorrenza(regola, 'it')).toBe('Ogni 2 settimane');
    expect(descriviRicorrenza(regola, 'en')).toBe('Every 2 weeks');
    expect(descriviRicorrenza(regola, 'fr')).toBe('Toutes les 2 semaines');
    expect(descriviRicorrenza(regola, 'de')).toBe('Alle 2 Wochen');
    expect(descriviRicorrenza(regola, 'es')).toBe('Cada 2 semanas');
  });

  it('elenca i giorni scelti e la data di fine', () => {
    const regola: RegolaRicorrenza = {
      tipo: 'settimane',
      ogni: 1,
      giorniSettimana: [1, 3, 5],
      fine: '2026-12-31',
    };
    expect(descriviRicorrenza(regola, 'it')).toBe(
      'Ogni settimana, il lun, mer e ven, fino al 31/12/2026'
    );
    expect(descriviRicorrenza(regola, 'en')).toBe(
      'Every week, on Mon, Wed and Fri, until 12/31/2026'
    );
    expect(descriviRicorrenza(regola, 'de')).toBe(
      'Wöchentlich, am Mo, Mi und Fr, bis 31.12.2026'
    );
  });

  it('con un solo giorno non aggiunge la congiunzione', () => {
    expect(descriviRicorrenza({ tipo: 'settimane', ogni: 1, giorniSettimana: [1] }, 'it')).toBe(
      'Ogni settimana, il lun'
    );
  });

  it('ripiega sull italiano se la lingua non e fra quelle previste', () => {
    expect(descriviRicorrenza({ tipo: 'mesi', ogni: 2 }, 'pt')).toBe('Ogni 2 mesi');
  });

  it('su una regola irriconoscibile restituisce stringa vuota', () => {
    expect(descriviRicorrenza({ tipo: 'giorni', ogni: 0 }, 'it')).toBe('');
  });
});
