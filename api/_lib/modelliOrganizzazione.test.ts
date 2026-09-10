import { describe, it, expect } from 'vitest';
import {
  scegliModello,
  rendiModello,
  type ModelloSalvato,
} from './modelliOrganizzazione.js';

/** Un modello valido di comodo, che i singoli test modificano dove serve. */
function modello(campi: Partial<ModelloSalvato> = {}): ModelloSalvato {
  return {
    type: 'task_assigned',
    subject: 'Nuova attività: {{taskTitle}}',
    htmlContent: '<p>Ciao {{recipientName}}</p><h2>{{taskTitle}}</h2>',
    textContent: 'Ciao {{recipientName}}\nAttività: {{taskTitle}}',
    isActive: true,
    ...campi,
  };
}

describe('rendiModello — escape dell HTML', () => {
  it('neutralizza uno script nel titolo dell attività, ma lo lascia leggibile nel testo', () => {
    const reso = rendiModello(modello(), {
      recipientName: 'Anna',
      taskTitle: '<script>alert(1)</script>',
    });

    expect(reso.htmlContent).not.toContain('<script>');
    expect(reso.htmlContent).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    // Nel testo semplice non c'è nulla da neutralizzare: deve restare leggibile.
    expect(reso.textContent).toContain('<script>alert(1)</script>');
    expect(reso.textContent).not.toContain('&lt;');
  });

  it('neutralizza una rottura di attributo con "><img onerror=...>', () => {
    const reso = rendiModello(
      modello({ htmlContent: '<a href="{{taskUrl}}" title="{{taskTitle}}">apri</a>' }),
      {
        taskUrl: 'https://esempio.test/t/1',
        taskTitle: '"><img src=x onerror=alert(1)>',
      }
    );

    // Le virgolette del valore non devono chiudere l'attributo del modello.
    expect(reso.htmlContent).not.toContain('<img');
    expect(reso.htmlContent).toContain('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
    // L'HTML scritto nel modello, invece, resta HTML.
    expect(reso.htmlContent).toContain('<a href="https://esempio.test/t/1"');
  });

  it('trasforma la & di un valore in entità senza toccare il resto del modello', () => {
    const reso = rendiModello(modello({ htmlContent: '<p>{{taskTitle}}</p>' }), {
      taskTitle: 'Fatture & note',
    });

    expect(reso.htmlContent).toBe('<p>Fatture &amp; note</p>');
  });
});

describe('rendiModello — una sola passata', () => {
  it('non ri-sostituisce un segnaposto che arriva dentro un valore', () => {
    const reso = rendiModello(
      modello({
        htmlContent: '<p>{{taskTitle}}</p>',
        textContent: '{{taskTitle}} — {{taskUrl}}',
        subject: '{{taskTitle}}',
      }),
      {
        taskTitle: 'Controllare {{taskUrl}}',
        taskUrl: 'https://esempio.test/segreto',
      }
    );

    expect(reso.htmlContent).toBe('<p>Controllare {{taskUrl}}</p>');
    expect(reso.subject).toBe('Controllare {{taskUrl}}');
    // Il segnaposto scritto nel MODELLO viene invece sostituito normalmente.
    expect(reso.textContent).toBe(
      'Controllare {{taskUrl}} — https://esempio.test/segreto'
    );
  });
});

describe('rendiModello — segnaposto senza valore', () => {
  it('svuota le variabili mancanti, vuote o undefined e non lascia nessuna graffa', () => {
    const reso = rendiModello(
      modello({
        subject: 'Scade il {{taskDueDate}}',
        htmlContent:
          '<p>{{recipientName}}</p><p>{{taskDescription}}</p><p>{{taskStatus}}</p>',
        textContent: 'Priorità: {{taskPriority}} — {{ taskTitle }}',
      }),
      {
        recipientName: 'Anna',
        taskDescription: '',
        taskPriority: undefined,
      }
    );

    expect(reso.subject).toBe('Scade il');
    expect(reso.htmlContent).toBe('<p>Anna</p><p></p><p></p>');
    // Il corpo testuale non viene ripulito ai bordi come l'oggetto: gli spazi
    // attorno al segnaposto svuotato restano dov'erano.
    expect(reso.textContent).toBe('Priorità:  — ');
    for (const campo of [reso.subject, reso.htmlContent, reso.textContent]) {
      expect(campo).not.toContain('{{');
      expect(campo).not.toContain('}}');
    }
  });
});

describe('rendiModello — oggetto dell email', () => {
  it('toglie i ritorni a capo (iniezione di header) e gli spazi ai bordi', () => {
    const reso = rendiModello(modello({ subject: '  Attività: {{taskTitle}}  ' }), {
      taskTitle: 'Report\r\nBcc: spia@esempio.test\nX-Altro: 1',
    });

    expect(reso.subject).not.toContain('\n');
    expect(reso.subject).not.toContain('\r');
    expect(reso.subject).toBe('Attività: Report Bcc: spia@esempio.test X-Altro: 1');
  });

  it('non fa escape nell oggetto: è testo semplice', () => {
    const reso = rendiModello(modello({ subject: '{{taskTitle}}' }), {
      taskTitle: 'Costi & ricavi <urgente>',
    });

    expect(reso.subject).toBe('Costi & ricavi <urgente>');
  });
});

describe('scegliModello — difensiva sul JSONB', () => {
  it('restituisce null per null, undefined, stringhe, numeri e oggetti', () => {
    expect(scegliModello(null, 'task_assigned')).toBeNull();
    expect(scegliModello(undefined, 'task_assigned')).toBeNull();
    expect(scegliModello('email-templates', 'task_assigned')).toBeNull();
    expect(scegliModello(42, 'task_assigned')).toBeNull();
    expect(scegliModello({ task_assigned: modello() }, 'task_assigned')).toBeNull();
  });

  it('restituisce null per un array vuoto', () => {
    expect(scegliModello([], 'task_assigned')).toBeNull();
  });

  it('non lancia su un array di spazzatura', () => {
    const spazzatura = [
      1,
      'x',
      null,
      undefined,
      [],
      {},
      { type: 42 },
      { type: 'task_assigned' },
    ];
    expect(() => scegliModello(spazzatura, 'task_assigned')).not.toThrow();
    expect(scegliModello(spazzatura, 'task_assigned')).toBeNull();
  });

  it('ignora un modello di un altro tipo', () => {
    expect(scegliModello([modello({ type: 'task_overdue' })], 'task_assigned')).toBeNull();
  });

  it('ignora un modello disattivato', () => {
    expect(scegliModello([modello({ isActive: false })], 'task_assigned')).toBeNull();
    // `isActive` deve essere proprio `true`: una stringa "true" non basta.
    expect(scegliModello([{ ...modello(), isActive: 'true' }], 'task_assigned')).toBeNull();
  });

  it('scarta un modello senza oggetto o con oggetto non stringa', () => {
    expect(scegliModello([modello({ subject: '   ' })], 'task_assigned')).toBeNull();
    expect(scegliModello([{ ...modello(), subject: 7 }], 'task_assigned')).toBeNull();
  });

  it('scarta un modello senza nessuno dei due corpi', () => {
    expect(
      scegliModello([modello({ htmlContent: '', textContent: '  ' })], 'task_assigned')
    ).toBeNull();
    // Ne basta uno dei due, però.
    expect(scegliModello([modello({ htmlContent: '' })], 'task_assigned')).not.toBeNull();
  });

  it('restituisce un modello valido, normalizzando i campi assenti a stringa vuota', () => {
    const scelto = scegliModello(
      [{ id: '1', name: 'Assegnata', ...modello(), textContent: undefined }],
      'task_assigned'
    );

    expect(scelto).not.toBeNull();
    expect(scelto?.type).toBe('task_assigned');
    expect(scelto?.subject).toBe('Nuova attività: {{taskTitle}}');
    expect(scelto?.textContent).toBe('');
    expect(scelto?.isActive).toBe(true);
  });

  it('con due modelli dello stesso tipo prende il primo ATTIVO, saltando quello spento', () => {
    const scelto = scegliModello(
      [modello({ isActive: false, subject: 'vecchio' }), modello({ subject: 'nuovo' })],
      'task_assigned'
    );

    expect(scelto?.subject).toBe('nuovo');
  });

  it('con due modelli attivi dello stesso tipo prende il primo', () => {
    const scelto = scegliModello(
      [modello({ subject: 'primo' }), modello({ subject: 'secondo' })],
      'task_assigned'
    );

    expect(scelto?.subject).toBe('primo');
  });
});

describe('scegliModello + rendiModello insieme', () => {
  it('un modello salvato viene reso senza HTML eseguibile', () => {
    const grezzo = [
      {
        id: 'x',
        name: 'Assegnata',
        type: 'task_assigned',
        subject: 'Nuova attività: {{taskTitle}}',
        htmlContent: '<div>{{taskTitle}}</div>',
        textContent: 'Attività: {{taskTitle}}',
        isActive: true,
        variables: ['taskTitle'],
      },
    ];
    const scelto = scegliModello(grezzo, 'task_assigned');
    expect(scelto).not.toBeNull();

    const reso = rendiModello(scelto as ModelloSalvato, {
      taskTitle: '<script>alert(1)</script>',
    });
    expect(reso.htmlContent).toBe('<div>&lt;script&gt;alert(1)&lt;/script&gt;</div>');
    expect(reso.subject).toBe('Nuova attività: <script>alert(1)</script>');
  });
});
