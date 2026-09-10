import { describe, it, expect } from 'vitest';
import {
  MAX_VOCI_PER_EMAIL,
  componiRiepilogo,
  eOraDelRiepilogo,
  finestraDigest,
  fusoRiepilogo,
  oraLocale,
  oraRiepilogo,
  preferisceRiepilogo,
  scappaHtml,
  ultimaFinestraInviata,
  type VoceRiepilogo,
} from './digest.js';
import { LINGUE_EMAIL } from './emailTemplates.js';

/**
 * La rotta intera non e' provabile senza un database, ma le decisioni che
 * possono sbagliare IN SILENZIO sono pure e stanno tutte qui.
 *
 * Sono tre, e nessuna produce un errore quando va storta: un'email che non parte
 * non lascia traccia da nessuna parte, un'ora confrontata nel fuso sbagliato
 * spedisce due ore prima senza che nessuno lo segnali, e un testo composto nella
 * lingua di ripiego arriva comunque. Il caso peggiore di tutti e'
 * `preferisceRiepilogo` che dice "si'" a chi non ha scelto niente: quella persona
 * smette di ricevere posta e non lo scopre mai.
 */

const ADESSO = new Date('2026-09-10T08:00:00.000Z');

/** Preferenze complete, come le salva l'interfaccia. */
const conRiepilogo = (extra: Record<string, unknown> = {}) => ({
  userId: 'u1',
  emailNotifications: true,
  enabledNotifications: { task_assigned: true },
  digestEnabled: true,
  digestTime: '08:00',
  digestTimezone: 'UTC',
  ...extra,
});

describe('preferisceRiepilogo', () => {
  it('riconosce chi ha scelto il riepilogo', () => {
    expect(preferisceRiepilogo(conRiepilogo())).toBe(true);
  });

  /*
   * Il gruppo che conta davvero: in tutti questi casi si deve spedire SUBITO,
   * come fa gia' il resto del sistema quando le preferenze non dicono nulla di
   * chiaro. Il verso sbagliato qui zittisce la posta di chi non ha chiesto
   * niente.
   */
  it.each([
    ['preferenze assenti', undefined],
    ['preferenze nulle', null],
    ['preferenze vuote', {}],
    ['una stringa al posto delle preferenze', 'digestEnabled'],
    ['un numero', 42],
    ['un array', [{ digestEnabled: true, digestTime: '08:00' }]],
    ['digestEnabled assente', { digestTime: '08:00' }],
    ['digestEnabled falso', { digestEnabled: false, digestTime: '08:00' }],
    ['digestEnabled come stringa "true"', { digestEnabled: 'true', digestTime: '08:00' }],
    ['digestEnabled come 1', { digestEnabled: 1, digestTime: '08:00' }],
  ])('torna falso con %s', (_caso, valore) => {
    expect(preferisceRiepilogo(valore)).toBe(false);
  });

  it("torna falso se l'interruttore e acceso ma l'ora e inservibile", () => {
    // Senza un'ora valida non esisterebbe un istante in cui il riepilogo parte:
    // la persona resterebbe senza email di nessun tipo, immediate comprese.
    expect(preferisceRiepilogo({ digestEnabled: true })).toBe(false);
    expect(preferisceRiepilogo({ digestEnabled: true, digestTime: 'mattina' })).toBe(false);
    expect(preferisceRiepilogo({ digestEnabled: true, digestTime: '25:00' })).toBe(false);
    expect(preferisceRiepilogo({ digestEnabled: true, digestTime: 800 })).toBe(false);
  });

  it('non si fa ingannare dai campi che sono stati tolti', () => {
    // `digestFrequency` e compagni erano campi inerti: se ricompaiono da un
    // record salvato da una versione vecchia non devono accendere niente.
    expect(
      preferisceRiepilogo({ digestFrequency: 'daily', emailSchedule: { digestTime: '08:00' } })
    ).toBe(false);
  });
});

describe('oraRiepilogo', () => {
  it('normalizza a HH:MM', () => {
    expect(oraRiepilogo({ digestTime: '8:00' })).toBe('08:00');
    expect(oraRiepilogo({ digestTime: ' 09:30 ' })).toBe('09:30');
    expect(oraRiepilogo({ digestTime: '00:00' })).toBe('00:00');
    expect(oraRiepilogo({ digestTime: '23:59' })).toBe('23:59');
  });

  it('rifiuta ore e minuti fuori scala, che non corrisponderebbero a nessuna esecuzione', () => {
    expect(oraRiepilogo({ digestTime: '24:00' })).toBeNull();
    expect(oraRiepilogo({ digestTime: '08:60' })).toBeNull();
    expect(oraRiepilogo({ digestTime: '08:0' })).toBeNull();
    expect(oraRiepilogo({ digestTime: '' })).toBeNull();
  });
});

describe('fusoRiepilogo', () => {
  it('tiene il fuso IANA salvato dal client', () => {
    expect(fusoRiepilogo({ digestTimezone: 'Europe/Rome' })).toBe('Europe/Rome');
  });

  it('ripiega su UTC quando il fuso manca o non esiste', () => {
    // UTC e' l'unico fuso di cui si e' certi che il runtime lo conosca;
    // l'interfaccia dichiara quale sta usando, quindi il ripiego resta visibile.
    expect(fusoRiepilogo({})).toBe('UTC');
    expect(fusoRiepilogo({ digestTimezone: '' })).toBe('UTC');
    expect(fusoRiepilogo({ digestTimezone: 'Terra/Mezzo' })).toBe('UTC');
    expect(fusoRiepilogo({ digestTimezone: 42 })).toBe('UTC');
    expect(fusoRiepilogo(null)).toBe('UTC');
  });
});

describe('oraLocale', () => {
  it('converte nel fuso del destinatario', () => {
    // 08:00 UTC del 10 settembre: a Roma e' ora legale, quindi le 10.
    expect(oraLocale(ADESSO, 'Europe/Rome')).toBe('10');
    expect(oraLocale(ADESSO, 'UTC')).toBe('08');
    expect(oraLocale(ADESSO, 'America/New_York')).toBe('04');
    expect(oraLocale(ADESSO, 'Asia/Tokyo')).toBe('17');
  });

  it('a mezzanotte dice 00 e non 24', () => {
    // Con `hour12: false` certe versioni di ICU restituiscono "24": un riepilogo
    // impostato a mezzanotte non partirebbe mai, senza alcun errore.
    expect(oraLocale(new Date('2026-09-10T00:00:00.000Z'), 'UTC')).toBe('00');
    expect(oraLocale(new Date('2026-09-10T22:00:00.000Z'), 'Europe/Rome')).toBe('00');
  });

  it('segue l ora legale da solo, che e il motivo per cui si salva un nome IANA', () => {
    const inverno = new Date('2026-01-10T08:00:00.000Z');
    expect(oraLocale(inverno, 'Europe/Rome')).toBe('09');
    expect(oraLocale(ADESSO, 'Europe/Rome')).toBe('10');
  });
});

describe('eOraDelRiepilogo', () => {
  it('sceglie chi ha indicato proprio questa ora', () => {
    expect(eOraDelRiepilogo(conRiepilogo({ digestTime: '08:00' }), ADESSO)).toBe(true);
  });

  it('lascia stare chi ha indicato un altra ora', () => {
    expect(eOraDelRiepilogo(conRiepilogo({ digestTime: '09:00' }), ADESSO)).toBe(false);
    expect(eOraDelRiepilogo(conRiepilogo({ digestTime: '07:00' }), ADESSO)).toBe(false);
  });

  it("interpreta l'ora nel fuso del destinatario, non in quello del lavoro pianificato", () => {
    // Chi a Roma ha chiesto "le 10" va servito alle 08:00 UTC, non alle 10:00.
    const romano = conRiepilogo({ digestTime: '10:00', digestTimezone: 'Europe/Rome' });
    expect(eOraDelRiepilogo(romano, ADESSO)).toBe(true);
    expect(eOraDelRiepilogo(romano, new Date('2026-09-10T10:00:00.000Z'))).toBe(false);
  });

  it('confronta le ore e non i minuti, perche il lavoro si sveglia una volta all ora', () => {
    expect(eOraDelRiepilogo(conRiepilogo({ digestTime: '08:30' }), ADESSO)).toBe(true);
  });

  it('non tocca chi non ha scelto il riepilogo', () => {
    expect(eOraDelRiepilogo(undefined, ADESSO)).toBe(false);
    expect(eOraDelRiepilogo({ digestEnabled: false, digestTime: '08:00' }, ADESSO)).toBe(false);
  });

  it('copre tutte le 24 ore, una sola volta ciascuna', () => {
    // Ogni esecuzione oraria deve selezionare esattamente le persone di quell'ora:
    // se una preferenza corrispondesse a due esecuzioni sarebbero due email.
    for (let ora = 0; ora < 24; ora += 1) {
      const preferenze = conRiepilogo({ digestTime: `${String(ora).padStart(2, '0')}:00` });
      let quante = 0;
      for (let passata = 0; passata < 24; passata += 1) {
        const istante = new Date(Date.UTC(2026, 8, 10, passata, 0, 0));
        if (eOraDelRiepilogo(preferenze, istante)) quante += 1;
      }
      expect(quante).toBe(1);
    }
  });
});

describe('finestraDigest e il segno anti-doppione', () => {
  it('identifica l ora UTC dell esecuzione', () => {
    expect(finestraDigest(ADESSO)).toBe('2026-09-10T08');
  });

  it('due esecuzioni nella stessa ora producono lo stesso segno', () => {
    // E' il caso vero: lo scheduler ritenta dopo un timeout e la seconda passata
    // deve trovare il segno gia' scritto.
    expect(finestraDigest(new Date('2026-09-10T08:00:00.000Z'))).toBe(
      finestraDigest(new Date('2026-09-10T08:59:59.999Z'))
    );
  });

  it('il giorno dopo il segno cambia, altrimenti il riepilogo si spegnerebbe per sempre', () => {
    expect(finestraDigest(new Date('2026-09-11T08:00:00.000Z'))).not.toBe(finestraDigest(ADESSO));
  });

  it('legge il segno salvato e sopravvive a un valore rovinato', () => {
    expect(ultimaFinestraInviata({ finestra: '2026-09-10T08' })).toBe('2026-09-10T08');
    // In tutti questi casi si torna null, cioe' "non risulta spedito": il rischio
    // e' un doppione, non un riepilogo perso. E' il verso giusto in cui sbagliare.
    expect(ultimaFinestraInviata(null)).toBeNull();
    expect(ultimaFinestraInviata(undefined)).toBeNull();
    expect(ultimaFinestraInviata({})).toBeNull();
    expect(ultimaFinestraInviata({ finestra: 12 })).toBeNull();
    expect(ultimaFinestraInviata('2026-09-10T08')).toBeNull();
  });
});

/**
 * "Nessuna notifica nuova" e' una decisione della rotta, non della composizione:
 * qui si verifica il presupposto su cui quella decisione poggia, cioe' che un
 * elenco vuoto non produca mai un riepilogo spedibile.
 */
describe('nessuna notifica', () => {
  it('un elenco vuoto non ha nulla da riassumere', () => {
    const composto = componiRiepilogo('it', {
      voci: [],
      totale: 0,
      nomeApplicazione: 'TaskFlow',
      fuso: 'UTC',
    });
    // Non contiene alcuna riga: la rotta si ferma prima di arrivare qui, e questo
    // test tiene fermo il motivo per cui puo' permetterselo.
    expect(composto.textContent).not.toContain('- ');
    expect(composto.htmlContent).not.toContain('<li');
  });
});

describe('componiRiepilogo', () => {
  const voci: VoceRiepilogo[] = [
    {
      message: '"Rivedere il preventivo" ti e stata assegnata',
      task_title: 'Rivedere il preventivo',
      created_at: '2026-09-10T06:30:00.000Z',
    },
    {
      message: '"Chiudere il bilancio" e scaduta',
      task_title: 'Chiudere il bilancio',
      created_at: '2026-09-09T17:05:00.000Z',
    },
  ];

  const base = {
    nomeDestinatario: 'Giulio',
    voci,
    totale: voci.length,
    appUrl: 'https://taskflow.example',
    nomeApplicazione: 'TaskFlow',
    fuso: 'Europe/Rome',
  };

  /**
   * Cinque lingue, e nessuna che ricada in silenzio sull'italiano.
   *
   * Il modo tipico in cui questo si rompe non e' un errore ma una traduzione che
   * manca: l'email parte comunque, in italiano, a un destinatario tedesco.
   * Confrontare gli oggetti fra loro e' l'unico controllo che se ne accorge.
   */
  it.each(LINGUE_EMAIL)('compone in %s', (lingua) => {
    const composto = componiRiepilogo(lingua, base);

    expect(composto.subject.length).toBeGreaterThan(0);
    expect(composto.htmlContent).toContain('<div style="font-family: Arial');
    expect(composto.htmlContent).toContain('</div>');

    // Il contenuto delle notifiche c'e' in entrambe le versioni.
    expect(composto.textContent).toContain('Rivedere il preventivo');
    expect(composto.htmlContent).toContain('Chiudere il bilancio');

    // Il numero compare nell'oggetto: e' l'unica informazione visibile prima di
    // aprire, e senza di essa il riepilogo e' indistinguibile da un altro.
    expect(composto.subject).toContain('2');

    // Il link c'e' e non e' spezzato.
    expect(composto.htmlContent).toContain('href="https://taskflow.example"');
    expect(composto.textContent).toContain('https://taskflow.example');
  });

  it('ogni lingua ha il suo oggetto: nessuna ricade sull italiano', () => {
    const oggetti = LINGUE_EMAIL.map((lingua) => componiRiepilogo(lingua, base).subject);
    expect(new Set(oggetti).size).toBe(LINGUE_EMAIL.length);
  });

  it('ogni lingua ha il suo saluto e la sua spiegazione', () => {
    const testi = LINGUE_EMAIL.map((lingua) => componiRiepilogo(lingua, base).textContent);
    expect(testi[0]).toContain('Ciao Giulio');
    expect(testi[1]).toContain('Hi Giulio');
    expect(testi[2]).toContain('Bonjour Giulio');
    expect(testi[3]).toContain('Hallo Giulio');
    expect(testi[4]).toContain('Hola Giulio');
    for (const testo of testi) {
      // La riga che spiega perche' il messaggio e' arrivato non e' cortesia: e'
      // cio' che permette a chi non ricorda di averlo scelto di risalire
      // all'interruttore invece di segnalare il messaggio come spam.
      expect(testo.length).toBeGreaterThan(120);
    }
  });

  it('usa il singolare quando la notifica e una sola', () => {
    const composto = componiRiepilogo('it', { ...base, voci: [voci[0]], totale: 1 });
    expect(composto.subject).toContain('1 notifica');
    expect(composto.subject).not.toContain('notifiche');
  });

  it('senza nome saluta comunque, senza lasciare un buco', () => {
    const composto = componiRiepilogo('en', { ...base, nomeDestinatario: null });
    expect(composto.textContent).toContain('Hi,');
    expect(composto.textContent).not.toContain('Hi null');
    expect(composto.textContent).not.toContain('undefined');
  });

  it('senza APP_URL non mette un bottone che non porta da nessuna parte', () => {
    const composto = componiRiepilogo('it', { ...base, appUrl: undefined });
    expect(composto.htmlContent).not.toContain('<a href');
    expect(composto.textContent).not.toContain('undefined');
  });

  it('mostra gli orari nel fuso del destinatario', () => {
    // 06:30 UTC sono le 08:30 a Roma: mostrare l'ora UTC farebbe sembrare
    // sbagliato un elenco corretto.
    expect(componiRiepilogo('it', base).textContent).toContain('08:30');
    expect(componiRiepilogo('it', { ...base, fuso: 'UTC' }).textContent).toContain('06:30');
  });

  it('dice quante notifiche non ha elencato invece di troncare in silenzio', () => {
    const tante: VoceRiepilogo[] = Array.from({ length: MAX_VOCI_PER_EMAIL }, (_, i) => ({
      message: `notifica ${i}`,
      created_at: '2026-09-10T06:00:00.000Z',
    }));
    const composto = componiRiepilogo('it', { ...base, voci: tante, totale: MAX_VOCI_PER_EMAIL + 7 });
    expect(composto.textContent).toContain('altre 7');
    expect(composto.subject).toContain(String(MAX_VOCI_PER_EMAIL + 7));
  });

  it('non lascia passare HTML preso dai titoli scritti dagli utenti', () => {
    const composto = componiRiepilogo('it', {
      ...base,
      voci: [{ message: '<img src=x onerror="alert(1)"> assegnata', created_at: null }],
      totale: 1,
    });
    // Il tag non esiste piu': restano dei caratteri, che il client di posta
    // mostra come testo. `onerror` sopravvive come parola, ma senza il tag e
    // senza le virgolette vere non e' piu' un attributo di niente.
    expect(composto.htmlContent).not.toContain('<img');
    expect(composto.htmlContent).not.toContain('onerror="');
    expect(composto.htmlContent).toContain('&lt;img');
  });

  it('una data rovinata non fa comparire "Invalid Date" dentro un email vera', () => {
    const composto = componiRiepilogo('it', {
      ...base,
      voci: [{ message: 'qualcosa', created_at: 'non-una-data' }],
      totale: 1,
    });
    expect(composto.textContent).not.toContain('Invalid');
    expect(composto.textContent).toContain('qualcosa');
  });
});

describe('scappaHtml', () => {
  it('neutralizza i cinque caratteri che contano', () => {
    expect(scappaHtml('<a href="x" data=\'y\'>&</a>')).toBe(
      '&lt;a href=&quot;x&quot; data=&#39;y&#39;&gt;&amp;&lt;/a&gt;'
    );
  });

  it('sostituisce la e commerciale per prima, altrimenti si annida', () => {
    // Con l'ordine sbagliato '&lt;' diventerebbe '&amp;lt;' e il lettore
    // vedrebbe le entita' al posto del testo.
    expect(scappaHtml('&lt;')).toBe('&amp;lt;');
  });
});
