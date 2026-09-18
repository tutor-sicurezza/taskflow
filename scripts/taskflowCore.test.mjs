/*
  Il nucleo condiviso fra la riga di comando e il server MCP, messo alla prova
  senza rete.

  Questo file non esisteva, ed e' la parte che non poteva restare scoperta:
  `taskflowCore.mjs` e' l'unico posto dove si decide se una scrittura parte,
  se una notifica viene spedita e a chi. Entrambi i clienti — `taskflow.mjs` e
  `mcp/taskflow.mjs` — si limitano a stampare cio' che il nucleo restituisce,
  quindi un errore qui e' un errore in tutti e due.

  La cucitura e' `fetch`: `chiamata()` lo usa direttamente, percio' sostituirlo
  basta a far girare il codice vero — compreso l'ordine fra scrittura e
  notifica, che e' cio' che conta davvero e che nessun test sulle sole funzioni
  pure avrebbe potuto guardare.
*/
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ErroreUtente,
  aggiungiNota,
  cambiaStato,
  dettaglioTask,
  eChiusaDavvero,
  accediConPassword,
  attendeIlVisto,
  bloccantiApertiPerTask,
  organizzazione,
  staPerScadere,
  statoCanonico,
  trovaAttivita,
} from './taskflowCore.mjs';

const CFG = { url: 'https://esempio.supabase.co', chiave: 'chiave-anon' };
const IO = 'utente-1';
const SESSIONE = {
  token: 'token-di-accesso',
  utente: { id: IO, email: 'io@esempio.it', user_metadata: { full_name: 'Nome Vecchio' } },
};
const ORG = { id: 'org-1', ruolo: 'member', name: 'Acme' };

const taskBase = (extra = {}) => ({
  id: 'aaaaaaaa-1111-2222-3333-444444444444',
  title: 'Scrivere il rapporto',
  status: 'not-started',
  due_date: '2026-10-01',
  updated_at: '2026-09-01T10:00:00.000Z',
  assignee_id: IO,
  watchers: [],
  blocked_by: [],
  requires_approval: false,
  approved_by: null,
  approved_at: null,
  comments: [],
  activities: [],
  ...extra,
});

/**
 * Un finto PostgREST: risponde in base al percorso e REGISTRA ogni richiesta,
 * perche' meta' di cio' che si vuole verificare e' quali richieste NON sono
 * partite.
 */
function finServer({ tasks = [], archiviate = [], membri = [], profilo, patch }) {
  const richieste = [];

  const risposta = (corpo, ok = true, stato = 200) => ({
    ok,
    status: stato,
    text: async () => (corpo === undefined ? '' : JSON.stringify(corpo)),
  });

  /*
    `select` si rispetta davvero: si restituiscono SOLO le colonne chieste.

    Prima le righe tornavano intere, e una prova per mutazione l'ha mostrato:
    restringendo la `select` di `dettaglioTask` a `id,title,status` nessun test
    cambiava esito, mentre contro PostgREST vero quella riga arriverebbe senza
    `requires_approval` — e `eChiusaDavvero`, non trovandolo, tratterebbe un
    lavoro in attesa di visto come chiuso. Un finto server piu' generoso del
    vero nasconde proprio gli errori che si vogliono trovare.

    Le select con sottorisorse fra parentesi — `organizations(id,name)` — si
    lasciano stare: qui non servono e gestirle bene vorrebbe dire riscrivere
    PostgREST.
  */
  const proietta = (righe, select) => {
    if (!select || select.includes('*') || select.includes('(')) return righe;
    const volute = select.split(',').map((c) => c.trim()).filter(Boolean);
    return righe.map((riga) =>
      Object.fromEntries(volute.filter((c) => c in riga).map((c) => [c, riga[c]]))
    );
  };

  globalThis.fetch = vi.fn(async (indirizzo, opzioni = {}) => {
    const percorso = String(indirizzo).replace(CFG.url, '');
    richieste.push({ percorso, metodo: opzioni.method ?? 'GET', corpo: opzioni.body });

    if (percorso.startsWith('/rest/v1/profiles')) {
      return risposta(profilo === undefined ? [] : [profilo]);
    }
    if (percorso.startsWith('/rest/v1/organization_members')) {
      return risposta(membri);
    }
    if (percorso.startsWith('/rest/v1/notifications')) {
      return risposta(undefined);
    }
    if (percorso.startsWith('/rest/v1/tasks')) {
      if (opzioni.method === 'PATCH') {
        // `patch` decide cosa risponde il database: `[]` e' il rifiuto
        // silenzioso delle regole di riga, che e' il caso interessante.
        const esito = typeof patch === 'function' ? patch(JSON.parse(opzioni.body)) : patch;
        return risposta(esito === undefined ? [taskBase()] : esito);
      }
      if (percorso.includes('archived_at=not.is.null')) return risposta(archiviate);
      if (percorso.includes('select=comments,activities')) {
        const t = tasks[0] ?? {};
        return risposta([{ comments: t.comments ?? [], activities: t.activities ?? [] }]);
      }
      if (percorso.includes('id=in.(')) {
        const dentro = percorso.split('id=in.(')[1].split(')')[0].split(',');
        return risposta(
          proietta(
            tasks.filter((t) => dentro.includes(t.id)),
            percorso.split('select=')[1]?.split('&')[0]
          )
        );
      }
      return risposta(proietta(tasks, percorso.split('select=')[1]?.split('&')[0]));
    }
    throw new Error(`percorso non previsto dal finto server: ${percorso}`);
  });

  return richieste;
}

const originale = globalThis.fetch;
beforeEach(() => vi.useRealTimers());
afterEach(() => {
  globalThis.fetch = originale;
  vi.restoreAllMocks();
});

/* -------------------------------------------------------------------------- */

describe('statoCanonico', () => {
  it('accetta gli alias italiani e quelli veri', () => {
    expect(statoCanonico('completata')).toBe('completed');
    expect(statoCanonico('fatto')).toBe('completed');
    expect(statoCanonico('in-corso')).toBe('in-progress');
    expect(statoCanonico('non-iniziata')).toBe('not-started');
    expect(statoCanonico('bloccata')).toBe('blocked');
    expect(statoCanonico('COMPLETATA')).toBe('completed');
    expect(statoCanonico('blocked')).toBe('blocked');
  });

  it('rifiuta uno stato inventato dicendo quali esistono', () => {
    expect(() => statoCanonico('quasi-fatta')).toThrow(ErroreUtente);
    expect(() => statoCanonico('quasi-fatta')).toThrow(/non-iniziata, in-corso, bloccata/);
    expect(() => statoCanonico(undefined)).toThrow(ErroreUtente);
  });
});

describe('eChiusaDavvero', () => {
  it('non considera chiusa una consegna che aspetta il visto', () => {
    expect(eChiusaDavvero(taskBase({ status: 'completed', requires_approval: true }))).toBe(
      false
    );
  });

  it('la considera chiusa solo con approvatore E data', () => {
    const conVisto = { status: 'completed', requires_approval: true, approved_by: 'capo' };
    expect(eChiusaDavvero(taskBase(conVisto))).toBe(false);
    expect(
      eChiusaDavvero(taskBase({ ...conVisto, approved_at: '2026-09-02T09:00:00.000Z' }))
    ).toBe(true);
  });

  it('senza visto richiesto basta completed', () => {
    expect(eChiusaDavvero(taskBase({ status: 'completed' }))).toBe(true);
    expect(eChiusaDavvero(taskBase({ status: 'in-progress' }))).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */

describe('trovaAttivita', () => {
  it('trova dal prefisso che mostra l elenco', async () => {
    finServer({ tasks: [taskBase()] });
    const t = await trovaAttivita(CFG, SESSIONE, ORG, 'aaaaaaaa');
    expect(t.title).toBe('Scrivere il rapporto');
  });

  it('si ferma invece di scegliere quando il prefisso e ambiguo', async () => {
    finServer({
      tasks: [
        taskBase(),
        taskBase({ id: 'aaaaaaaa-9999-2222-3333-444444444444', title: 'Altra cosa' }),
      ],
    });
    // Nel messaggio ci va l'identificativo INTERO: troncato darebbe due righe
    // identiche, cioe' nessun modo di sceglierne una.
    await expect(trovaAttivita(CFG, SESSIONE, ORG, 'aaaa')).rejects.toThrow(
      /aaaaaaaa-1111-2222-3333-444444444444/
    );
    await expect(trovaAttivita(CFG, SESSIONE, ORG, 'aaaa')).rejects.toThrow(
      /aaaaaaaa-9999-2222-3333-444444444444/
    );
  });

  it('distingue "archiviata" da "non esiste"', async () => {
    finServer({
      tasks: [],
      archiviate: [{ id: 'bbbbbbbb-0000-0000-0000-000000000000', title: 'Vecchio lavoro' }],
    });
    await expect(trovaAttivita(CFG, SESSIONE, ORG, 'bbbb')).rejects.toThrow(
      /e' archiviata/
    );
    await expect(trovaAttivita(CFG, SESSIONE, ORG, 'cccc')).rejects.toThrow(
      /Nessuna attivita' che inizi per "cccc"/
    );
  });

  it('chiede un identificativo invece di prendere la prima', async () => {
    finServer({ tasks: [taskBase()] });
    await expect(trovaAttivita(CFG, SESSIONE, ORG, '')).rejects.toThrow(/Indica/);
  });
});

/* -------------------------------------------------------------------------- */

describe('cambiaStato', () => {
  it('non scrive e non avvisa nessuno se lo stato e gia quello', async () => {
    const richieste = finServer({ tasks: [taskBase({ status: 'in-progress' })] });
    const esito = await cambiaStato(CFG, SESSIONE, ORG, {
      pezzo: 'aaaa',
      stato: 'in-corso',
    });

    expect(esito.cambiato).toBe(false);
    expect(esito.conNota).toBe(false);
    expect(richieste.filter((r) => r.metodo === 'PATCH')).toHaveLength(0);
    expect(richieste.filter((r) => r.percorso.includes('/notifications'))).toHaveLength(0);
  });

  it('con la nota scrive i commenti ma non tocca lo stato', async () => {
    const richieste = finServer({ tasks: [taskBase({ status: 'in-progress' })] });
    const esito = await cambiaStato(CFG, SESSIONE, ORG, {
      pezzo: 'aaaa',
      stato: 'in-corso',
      nota: 'Ci sto lavorando',
    });

    expect(esito.cambiato).toBe(false);
    expect(esito.conNota).toBe(true);

    const scrittura = JSON.parse(richieste.find((r) => r.metodo === 'PATCH').corpo);
    expect(scrittura.status).toBeUndefined();
    expect(scrittura.comments).toHaveLength(1);
    expect(scrittura.comments[0].content).toBe('Ci sto lavorando');
    // Nessuna voce di cambio stato: non e' cambiato niente.
    expect(scrittura.activities.map((a) => a.type)).toEqual(['comment_added']);
  });

  it('manda indietro solo le colonne toccate', async () => {
    const richieste = finServer({ tasks: [taskBase()] });
    await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaa', stato: 'in-corso' });

    const scrittura = JSON.parse(richieste.find((r) => r.metodo === 'PATCH').corpo);
    expect(Object.keys(scrittura).sort()).toEqual(['activities', 'status', 'updated_at']);
    // In particolare: mai la riga intera. `attachments`, `title`, `due_date`
    // non devono comparire, altrimenti si riscrive cio' che non si e' letto.
    expect(scrittura.title).toBeUndefined();
  });

  it('firma col nome del profilo, non con quello della registrazione', async () => {
    const richieste = finServer({
      tasks: [taskBase()],
      profilo: { full_name: 'Nome Nuovo', avatar_url: 'https://esempio/a.png' },
    });
    await cambiaStato(CFG, SESSIONE, ORG, {
      pezzo: 'aaaa',
      stato: 'completata',
      nota: 'Fatto',
    });

    const scrittura = JSON.parse(richieste.find((r) => r.metodo === 'PATCH').corpo);
    expect(scrittura.comments[0].userName).toBe('Nome Nuovo');
    expect(scrittura.activities.every((a) => a.userName === 'Nome Nuovo')).toBe(true);
  });

  it('conserva un commento arrivato dal browser fra la lettura e la scrittura', async () => {
    const altrui = { id: 'com-altrui', content: 'Scritto dal browser', userId: 'altro' };
    // `trovaAttivita` legge una riga con `comments: []`; la rilettura appena
    // prima di scrivere ne trova uno in piu'. Deve finire nella scrittura.
    const richieste = finServer({ tasks: [taskBase({ comments: [altrui] })] });
    await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaa', stato: 'in-corso', nota: 'Mia' });

    const scrittura = JSON.parse(richieste.find((r) => r.metodo === 'PATCH').corpo);
    expect(scrittura.comments.map((c) => c.content)).toEqual(['Scritto dal browser', 'Mia']);
  });

  it('non spedisce notifiche se il database ha rifiutato la scrittura', async () => {
    // PostgREST risponde 200 con zero righe quando le regole non lasciano
    // passare: e' il caso in cui prima si stampava "fatto" e partivano gli
    // avvisi per un cambio mai avvenuto.
    const richieste = finServer({
      tasks: [taskBase({ watchers: ['osservatore-1'] })],
      patch: [],
    });

    await expect(
      cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaa', stato: 'completata' })
    ).rejects.toThrow(/non ha lasciato passare/);

    expect(richieste.filter((r) => r.percorso.includes('/notifications'))).toHaveLength(0);
  });

  it('avvisa gli osservatori, ma mai se stesso', async () => {
    const richieste = finServer({
      tasks: [taskBase({ watchers: ['osservatore-1', IO] })],
    });
    await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaa', stato: 'in-corso' });

    const avvisi = richieste
      .filter((r) => r.percorso.includes('/notifications'))
      .map((r) => JSON.parse(r.corpo));
    expect(avvisi).toHaveLength(1);
    expect(avvisi[0].user_id).toBe('osservatore-1');
  });

  it('quando serve il visto avvisa chi puo darlo, non l assegnatario', async () => {
    const richieste = finServer({
      tasks: [taskBase({ requires_approval: true, assignee_id: 'altra-persona' })],
      membri: [{ user_id: 'capo-1' }, { user_id: IO }],
    });
    const esito = await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaa', stato: 'completata' });

    expect(esito.attendeVisto).toBe(true);
    const avvisi = richieste
      .filter((r) => r.percorso.includes('/notifications'))
      .map((r) => JSON.parse(r.corpo));
    expect(avvisi.map((a) => a.user_id)).toEqual(['capo-1']);
    expect(avvisi[0].message).toMatch(/aspetta la tua approvazione/);
  });

  it('senza visto richiesto avvisa l assegnatario della chiusura', async () => {
    const richieste = finServer({
      tasks: [taskBase({ assignee_id: 'altra-persona' })],
    });
    const esito = await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaa', stato: 'completata' });

    expect(esito.attendeVisto).toBe(false);
    const avvisi = richieste
      .filter((r) => r.percorso.includes('/notifications'))
      .map((r) => JSON.parse(r.corpo));
    expect(avvisi.map((a) => a.type)).toEqual(['task_completed']);
    expect(avvisi[0].user_id).toBe('altra-persona');
  });

  it('riporta il messaggio del database quando una dipendenza blocca', async () => {
    finServer({
      tasks: [taskBase()],
      patch: () => {
        throw new Error('mai chiamata');
      },
    });
    // Il rifiuto vero arriva come errore HTTP dal trigger: si verifica che il
    // messaggio del database arrivi intatto a chi chiama, senza essere
    // sostituito da un codice.
    globalThis.fetch = vi.fn(async (indirizzo, opzioni = {}) => {
      const percorso = String(indirizzo).replace(CFG.url, '');
      if (opzioni.method === 'PATCH') {
        return {
          ok: false,
          status: 400,
          text: async () =>
            JSON.stringify({ message: 'Prima vanno chiuse: Preparare i dati' }),
        };
      }
      if (percorso.startsWith('/rest/v1/profiles')) {
        return { ok: true, status: 200, text: async () => '[]' };
      }
      return { ok: true, status: 200, text: async () => JSON.stringify([taskBase()]) };
    });

    await expect(
      cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaa', stato: 'completata' })
    ).rejects.toThrow('Prima vanno chiuse: Preparare i dati');
  });
});

/* -------------------------------------------------------------------------- */

describe('aggiungiNota', () => {
  it('rifiuta una nota vuota o di soli spazi', async () => {
    const richieste = finServer({ tasks: [taskBase()] });
    await expect(
      aggiungiNota(CFG, SESSIONE, ORG, { pezzo: 'aaaa', testo: '   ' })
    ).rejects.toThrow(/Scrivi il testo/);
    // E non legge nemmeno: si ferma prima di toccare la rete.
    expect(richieste).toHaveLength(0);
  });

  it('scrive il commento ripulito e avvisa assegnatario e osservatori una volta sola', async () => {
    const richieste = finServer({
      tasks: [taskBase({ assignee_id: 'altra-persona', watchers: ['altra-persona', 'terzo'] })],
    });
    await aggiungiNota(CFG, SESSIONE, ORG, { pezzo: 'aaaa', testo: '  Ecco cosa ho fatto  ' });

    const scrittura = JSON.parse(richieste.find((r) => r.metodo === 'PATCH').corpo);
    expect(scrittura.comments[0].content).toBe('Ecco cosa ho fatto');
    expect(scrittura.status).toBeUndefined();

    const avvisi = richieste
      .filter((r) => r.percorso.includes('/notifications'))
      .map((r) => JSON.parse(r.corpo));
    // L'assegnatario e' anche osservatore: un avviso solo, non due.
    expect(avvisi.map((a) => a.user_id).sort()).toEqual(['altra-persona', 'terzo']);
  });
});

/* -------------------------------------------------------------------------- */

describe('dettaglioTask', () => {
  it('risolve i titoli di chi blocca invece di restituire uuid', async () => {
    const bloccante = taskBase({
      id: 'bbbbbbbb-1111-1111-1111-111111111111',
      title: 'Preparare i dati',
      status: 'in-progress',
    });
    const bloccata = taskBase({ blocked_by: [bloccante.id] });
    finServer({ tasks: [bloccata, bloccante] });

    const { task, bloccanti } = await dettaglioTask(CFG, SESSIONE, ORG, 'aaaa');
    expect(task.id).toBe(bloccata.id);
    expect(bloccanti.map((b) => b.title)).toEqual(['Preparare i dati']);
  });

  it('non chiede niente quando non c e niente che blocca', async () => {
    const richieste = finServer({ tasks: [taskBase()] });
    const { bloccanti } = await dettaglioTask(CFG, SESSIONE, ORG, 'aaaa');
    expect(bloccanti).toEqual([]);
    expect(richieste.filter((r) => r.percorso.includes('id=in.('))).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */

describe('organizzazione', () => {
  it('restituisce anche il nome, non solo id e ruolo', async () => {
    finServer({
      membri: [
        { organization_id: 'org-1', role: 'manager', organizations: { id: 'org-1', name: 'Acme' } },
      ],
    });
    expect(await organizzazione(CFG, SESSIONE)).toEqual({
      id: 'org-1',
      ruolo: 'manager',
      name: 'Acme',
      deroghe: null,
    });
  });

  it('con piu organizzazioni si ferma invece di indovinare', async () => {
    finServer({
      membri: [
        { organization_id: 'org-1', role: 'member', organizations: { name: 'Acme' } },
        { organization_id: 'org-2', role: 'member', organizations: { name: 'Beta' } },
      ],
    });
    await expect(organizzazione(CFG, SESSIONE)).rejects.toThrow(/TASKFLOW_ORG/);
  });

  it('con TASKFLOW_ORG sceglie per nome o per identificativo', async () => {
    const membri = [
      { organization_id: 'org-1', role: 'member', organizations: { name: 'Acme' } },
      { organization_id: 'org-2', role: 'admin', organizations: { name: 'Beta' } },
    ];
    finServer({ membri });
    expect(await organizzazione({ ...CFG, org: 'beta' }, SESSIONE)).toEqual({
      id: 'org-2',
      ruolo: 'admin',
      name: 'Beta',
      deroghe: null,
    });
    finServer({ membri });
    expect(await organizzazione({ ...CFG, org: 'org-1' }, SESSIONE)).toMatchObject({
      id: 'org-1',
    });
    finServer({ membri });
    await expect(organizzazione({ ...CFG, org: 'Gamma' }, SESSIONE)).rejects.toThrow(
      /non corrisponde a nessuna delle tue: Acme, Beta/
    );
  });

  it('porta le deroghe dal database, non solo il ruolo', async () => {
    /*
      Senza questa prova il controllo sulle deroghe resterebbe inerte in
      produzione mentre tutti i suoi test passano: quelli costruiscono `org` a
      mano, e nessuno guardava se `organizzazione()` lo popola davvero. Una
      prova per mutazione l'ha mostrato — `deroghe: null` fisso non faceva
      fallire niente.
    */
    const deroghe = { tasks: { change_status: false } };
    finServer({
      membri: [
        {
          organization_id: 'org-1',
          role: 'member',
          custom_permissions: deroghe,
          organizations: { id: 'org-1', name: 'Acme' },
        },
      ],
    });
    expect((await organizzazione(CFG, SESSIONE)).deroghe).toEqual(deroghe);
  });

  it('chiede al database anche la colonna delle deroghe', async () => {
    // Se sparisse dalla `select`, PostgREST non la manderebbe e la riga sopra
    // resterebbe `null` per sempre: il finto server proietta le colonne
    // chieste proprio per rendere visibile questo caso.
    const richieste = finServer({
      membri: [
        {
          organization_id: 'org-1',
          role: 'member',
          custom_permissions: { tasks: { comment: false } },
          organizations: { id: 'org-1', name: 'Acme' },
        },
      ],
    });
    await organizzazione(CFG, SESSIONE);
    expect(richieste[0].percorso).toContain('custom_permissions');
  });

  it('rifiuta un nome che appartiene a piu di una delle tue', async () => {
    /*
      `find()` prendeva la prima e scriveva li'. Il caso peggiore non e'
      l'errore: e' il successo apparente nell'organizzazione sbagliata, che
      nessuno nota finche' non va a cercarlo.
    */
    const membri = [
      { organization_id: 'org-1', role: 'member', organizations: { name: 'Acme' } },
      { organization_id: 'org-2', role: 'admin', organizations: { name: 'Acme' } },
    ];
    finServer({ membri });
    await expect(organizzazione({ ...CFG, org: 'Acme' }, SESSIONE)).rejects.toThrow(
      /piu' di una/
    );
    finServer({ membri });
    await expect(organizzazione({ ...CFG, org: 'acme' }, SESSIONE)).rejects.toThrow(
      /org-1[\s\S]*org-2/
    );
  });

  it('con un nome ambiguo l identificativo decide comunque', async () => {
    const membri = [
      { organization_id: 'org-1', role: 'member', organizations: { name: 'Acme' } },
      { organization_id: 'org-2', role: 'admin', organizations: { name: 'Acme' } },
    ];
    finServer({ membri });
    expect(await organizzazione({ ...CFG, org: 'org-2' }, SESSIONE)).toMatchObject({
      id: 'org-2',
      ruolo: 'admin',
    });
  });

  it('l identificativo vince sul nome, se qualcuno li ha fatti coincidere', async () => {
    /*
      Caso costruito, ma la precedenza e' una regola dichiarata e le regole
      dichiarate si fissano. Se il valore corrisponde all'identificativo di una
      e al nome di un'altra, vince l'identificativo: e' l'unico dei due che non
      puo' essere ambiguo, quindi e' l'unico su cui si possa contare.
    */
    finServer({
      membri: [
        { organization_id: 'org-1', role: 'admin', organizations: { name: 'Beta' } },
        { organization_id: 'org-2', role: 'member', organizations: { name: 'org-1' } },
      ],
    });
    expect(await organizzazione({ ...CFG, org: 'org-1' }, SESSIONE)).toMatchObject({
      id: 'org-1',
      ruolo: 'admin',
    });
  });

  it('un nome unico continua a funzionare', async () => {
    finServer({
      membri: [
        { organization_id: 'org-1', role: 'member', organizations: { name: 'Acme' } },
        { organization_id: 'org-2', role: 'admin', organizations: { name: 'Beta' } },
      ],
    });
    expect(await organizzazione({ ...CFG, org: 'Beta' }, SESSIONE)).toMatchObject({
      id: 'org-2',
    });
  });

  it('con UNA sola appartenenza rispetta lo stesso cio che e stato scelto', async () => {
    /*
      Sembrava innocuo saltare il controllo quando l'appartenenza e' una sola —
      se ne hai una, quella e'. Con la sola riga di comando quasi lo era: un
      comando dura un secondo. Il connettore cambia il conto, perche' resta
      configurato per giorni: revocata l'appartenenza ad A mentre l'account
      resta in B, al primo rinnovo Claude Desktop cominciava a lavorare in B —
      letture, scritture, notifiche — con scritto A nella propria
      configurazione e senza dirlo a nessuno.
    */
    finServer({
      membri: [
        { organization_id: 'org-b', role: 'member', organizations: { name: 'Beta' } },
      ],
    });
    await expect(organizzazione({ ...CFG, org: 'org-a' }, SESSIONE)).rejects.toThrow(
      /non corrisponde/
    );
  });

  it('con una sola appartenenza che CORRISPONDE prosegue', async () => {
    finServer({
      membri: [
        { organization_id: 'org-b', role: 'member', organizations: { name: 'Beta' } },
      ],
    });
    expect(await organizzazione({ ...CFG, org: 'org-b' }, SESSIONE)).toMatchObject({
      id: 'org-b',
    });
  });

  it('senza scelta, una sola appartenenza resta la scorciatoia di sempre', async () => {
    finServer({
      membri: [
        { organization_id: 'org-b', role: 'admin', organizations: { name: 'Beta' } },
      ],
    });
    expect(await organizzazione(CFG, SESSIONE)).toMatchObject({ id: 'org-b', ruolo: 'admin' });
  });

  it('un account senza organizzazione lo dice, non va avanti', async () => {
    finServer({ membri: [] });
    await expect(organizzazione(CFG, SESSIONE)).rejects.toThrow(/non appartiene/);
  });
});

/* -------------------------------------------------------------------------- */

describe('scadenza della sessione', () => {
  /*
    Il server MCP vive quanto Claude Desktop, cioe' giorni, mentre il token di
    accesso dura un'ora. Prima la sessione in memoria si teneva finche' non
    falliva: la prima chiamata dopo la scadenza tornava un errore di
    autenticazione e chi aveva chiesto qualcosa doveva chiederlo due volte.
  */
  const ADESSO = Date.parse('2026-09-18T12:00:00.000Z');
  const fra = (minuti) => ({ scadenza: ADESSO + minuti * 60 * 1000 });

  it('tiene la sessione finche manca piu del margine', () => {
    expect(staPerScadere(fra(60), ADESSO)).toBe(false);
    expect(staPerScadere(fra(6), ADESSO)).toBe(false);
  });

  it('la riapre dentro il margine, e a maggior ragione se e gia scaduta', () => {
    expect(staPerScadere(fra(5), ADESSO)).toBe(true);
    expect(staPerScadere(fra(1), ADESSO)).toBe(true);
    expect(staPerScadere(fra(-30), ADESSO)).toBe(true);
  });

  it('senza scadenza nota tiene la sessione invece di rinnovare a vuoto', () => {
    // Rinnovare per scrupolo a ogni chiamata brucerebbe un token di rinnovo
    // per volta: Supabase li ruota a ogni uso.
    expect(staPerScadere({}, ADESSO)).toBe(false);
    expect(staPerScadere({ scadenza: null }, ADESSO)).toBe(false);
    expect(staPerScadere(undefined, ADESSO)).toBe(false);
  });

  it('legge la scadenza dalla risposta dell autenticazione', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          access_token: 'token',
          refresh_token: 'rinnovo',
          expires_at: Math.floor(ADESSO / 1000) + 3600,
          user: { id: IO, email: 'io@esempio.it' },
        }),
    }));

    const sessione = await accediConPassword(CFG, 'io@esempio.it', 'segreta');
    expect(sessione.scadenza).toBe(ADESSO + 3600 * 1000);
    expect(staPerScadere(sessione, ADESSO)).toBe(false);
    expect(staPerScadere(sessione, ADESSO + 3600 * 1000)).toBe(true);
  });

  it('ripiega su expires_in quando il server non manda expires_at', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          access_token: 'token',
          refresh_token: 'rinnovo',
          expires_in: 3600,
          user: { id: IO },
        }),
    }));

    const sessione = await accediConPassword(CFG, 'io@esempio.it', 'segreta');
    expect(typeof sessione.scadenza).toBe('number');
    expect(sessione.scadenza).toBeGreaterThan(Date.now() + 3500 * 1000);
  });

  it('resta null se il server non dice niente, e allora non si rinnova', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ access_token: 'token', refresh_token: 'r', user: { id: IO } }),
    }));

    const sessione = await accediConPassword(CFG, 'io@esempio.it', 'segreta');
    expect(sessione.scadenza).toBeNull();
    expect(staPerScadere(sessione)).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */

describe('le notifiche alla chiusura', () => {
  /*
    Il caso che le rendeva necessarie e' proprio quello per cui esiste la riga
    di comando: l'assegnatario che chiude da solo il proprio lavoro. Li' l'unico
    destinatario "classico" e' se stesso, e `notifica` lo scarta — quindi
    chiudere da Claude o dal terminale non avvisava NESSUNO, mentre chiuderlo
    dal browser avvisava chi lo aveva chiesto e chi stava aspettando.
  */
  const conCreatore = (chi) => ({
    activities: [{ id: 'a1', type: 'created', userId: chi, userName: 'Chi lo ha chiesto' }],
  });

  const avvisi = (richieste) =>
    richieste
      .filter((r) => r.percorso.includes('/notifications'))
      .map((r) => JSON.parse(r.corpo));

  it('avvisa chi ha chiesto il lavoro quando lo chiude l assegnatario', async () => {
    const richieste = finServer({
      tasks: [taskBase({ ...conCreatore('committente-1') })],
    });
    await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaa', stato: 'completata' });

    const spediti = avvisi(richieste);
    expect(spediti.map((a) => a.user_id)).toEqual(['committente-1']);
    expect(spediti[0].type).toBe('task_completed');
  });

  it('non avvisa il creatore due volte quando e anche l assegnatario', async () => {
    const richieste = finServer({
      tasks: [taskBase({ assignee_id: 'altra-persona', ...conCreatore('altra-persona') })],
    });
    await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaa', stato: 'completata' });
    // Un avviso solo: quello di completamento all'assegnatario.
    expect(avvisi(richieste)).toHaveLength(1);
  });

  it('non avvisa se stessi di aver creato cio che si e appena chiuso', async () => {
    const richieste = finServer({ tasks: [taskBase({ ...conCreatore(IO) })] });
    expect(avvisi(richieste)).toHaveLength(0);
    await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaa', stato: 'completata' });
    expect(avvisi(richieste)).toHaveLength(0);
  });

  it('dice a chi aspettava che ora puo iniziare', async () => {
    const bloccata = taskBase({
      id: 'cccccccc-1111-2222-3333-444444444444',
      title: 'Migrare la sessione',
      status: 'not-started',
      assignee_id: 'chi-aspetta',
      blocked_by: ['aaaaaaaa-1111-2222-3333-444444444444'],
    });
    const richieste = finServer({ tasks: [taskBase(), bloccata] });
    await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaaaaaa', stato: 'completata' });

    const sbloccata = avvisi(richieste).filter((a) => /non e' piu' bloccata/.test(a.message));
    expect(sbloccata).toHaveLength(1);
    expect(sbloccata[0].user_id).toBe('chi-aspetta');
    expect(sbloccata[0].task_title).toBe('Migrare la sessione');
  });

  it('non lo dice a chi resta fermo dietro un ALTRO bloccante', async () => {
    // Sbloccata a meta' non e' sbloccata: l'avviso sarebbe un invito a
    // sbattere contro il trigger della 0025.
    const altroBloccante = taskBase({
      id: 'bbbbbbbb-1111-2222-3333-444444444444',
      status: 'in-progress',
    });
    const bloccata = taskBase({
      id: 'cccccccc-1111-2222-3333-444444444444',
      assignee_id: 'chi-aspetta',
      blocked_by: ['aaaaaaaa-1111-2222-3333-444444444444', altroBloccante.id],
    });
    const richieste = finServer({ tasks: [taskBase(), altroBloccante, bloccata] });
    await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaaaaaa', stato: 'completata' });

    expect(avvisi(richieste).filter((a) => /bloccata/.test(a.message))).toHaveLength(0);
  });

  it('un bloccante completato ma non vistato blocca ancora, come il trigger', async () => {
    const inAttesaDiVisto = taskBase({
      id: 'bbbbbbbb-1111-2222-3333-444444444444',
      status: 'completed',
      requires_approval: true,
      approved_by: null,
    });
    const bloccata = taskBase({
      id: 'cccccccc-1111-2222-3333-444444444444',
      assignee_id: 'chi-aspetta',
      blocked_by: ['aaaaaaaa-1111-2222-3333-444444444444', inAttesaDiVisto.id],
    });
    const richieste = finServer({ tasks: [taskBase(), inAttesaDiVisto, bloccata] });
    await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaaaaaa', stato: 'completata' });

    expect(avvisi(richieste).filter((a) => /bloccata/.test(a.message))).toHaveLength(0);
  });

  it('un riferimento rotto non blocca, come il trigger', async () => {
    const bloccata = taskBase({
      id: 'cccccccc-1111-2222-3333-444444444444',
      assignee_id: 'chi-aspetta',
      blocked_by: ['aaaaaaaa-1111-2222-3333-444444444444', 'id-che-non-esiste'],
    });
    const richieste = finServer({ tasks: [taskBase(), bloccata] });
    await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaaaaaa', stato: 'completata' });

    expect(avvisi(richieste).filter((a) => /bloccata/.test(a.message))).toHaveLength(1);
  });

  it('non sblocca niente se il lavoro chiuso aspetta un visto', async () => {
    const bloccata = taskBase({
      id: 'cccccccc-1111-2222-3333-444444444444',
      assignee_id: 'chi-aspetta',
      blocked_by: ['aaaaaaaa-1111-2222-3333-444444444444'],
    });
    const richieste = finServer({
      tasks: [taskBase({ requires_approval: true }), bloccata],
      membri: [{ user_id: 'capo-1' }],
    });
    const esito = await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaaaaaa', stato: 'completata' });

    expect(esito.attendeVisto).toBe(true);
    expect(avvisi(richieste).filter((a) => /bloccata/.test(a.message))).toHaveLength(0);
  });

  it('niente di tutto questo quando lo stato non diventa completato', async () => {
    const richieste = finServer({
      tasks: [taskBase({ ...conCreatore('committente-1') })],
    });
    await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaa', stato: 'in-corso' });
    expect(avvisi(richieste)).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */

describe('la chiave dell evento', () => {
  /*
    L'indice unico su (organization_id, event_key) respinge i doppioni, e
    l'errore 23505 qui viene ignorato di proposito: se due avvisi DIVERSI
    finiscono sulla stessa chiave, il secondo sparisce in silenzio.
  */
  const chiavi = (richieste) =>
    richieste
      .filter((r) => r.percorso.includes('/notifications'))
      .map((r) => JSON.parse(r.corpo).event_key);

  it('due transizioni nello stesso minuto non si sovrascrivono', async () => {
    const primo = finServer({ tasks: [taskBase({ watchers: ['chi-guarda'] })] });
    await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaa', stato: 'bloccata' });

    const secondo = finServer({
      tasks: [taskBase({ status: 'blocked', watchers: ['chi-guarda'] })],
    });
    await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaa', stato: 'in-corso' });

    // Il caso vero: uno stato messo per sbaglio e corretto subito dopo.
    // Prima le due chiavi erano identiche e l'osservatore restava con lo
    // stato vecchio.
    expect(chiavi(primo)[0]).not.toBe(chiavi(secondo)[0]);
  });

  it('osservatore e approvatore insieme ricevono due avvisi, non uno', async () => {
    // Stesso tipo (`task_status_changed`), stessa persona, stesso minuto: con
    // la chiave di prima ne passava uno solo, e quale dipendeva dall'ordine.
    const richieste = finServer({
      tasks: [taskBase({ requires_approval: true, watchers: ['capo-1'] })],
      membri: [{ user_id: 'capo-1' }],
    });
    await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaa', stato: 'completata' });

    const suoi = chiavi(richieste).filter((k) => k.includes('capo-1'));
    expect(suoi).toHaveLength(2);
    expect(new Set(suoi).size).toBe(2);
  });

  it('avvisi diversi sullo stesso task portano motivi diversi', async () => {
    const richieste = finServer({
      tasks: [
        taskBase({
          assignee_id: 'altra-persona',
          activities: [{ id: 'a1', type: 'created', userId: 'committente-1' }],
        }),
      ],
    });
    await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaa', stato: 'completata' });

    const motivi = chiavi(richieste).map((k) => k.split(':')[3]);
    expect(motivi).toEqual(['assegnatario', 'creatore']);
  });
});

describe('dettaglioTask e i bloccanti', () => {
  const bloccante = (extra) => ({
    id: 'bbbbbbbb-1111-1111-1111-111111111111',
    title: 'Preparare i dati',
    status: 'completed',
    requires_approval: false,
    approved_by: null,
    approved_at: null,
    ...extra,
  });

  it('porta la data del visto, non solo l approvatore', async () => {
    /*
      La selezione del dettaglio si fermava a `approved_by`. Chi giudica se un
      lavoro aspetta ancora il visto ha bisogno di ENTRAMBE le colonne: con la
      sola prima, una riga approvata a meta' sembra chiusa.
    */
    const richieste = finServer({ tasks: [taskBase()] });
    await dettaglioTask(CFG, SESSIONE, ORG, 'aaaa');
    const lettura = richieste.find(
      (r) => r.percorso.includes('/tasks?id=eq.') && r.percorso.includes('select=')
    );
    expect(lettura.percorso).toContain('approved_at');
  });

  it('non elenca un bloccante gia chiuso', async () => {
    /*
      `blocked_by` conserva i legami, non i blocchi. Restituendoli tutti si
      diceva a Claude che un'attivita' perfettamente lavorabile era bloccata,
      e lo si ripeteva nel risultato strutturato.
    */
    const bloccata = taskBase({ blocked_by: [bloccante().id] });
    finServer({ tasks: [bloccata, bloccante()] });

    const { bloccanti } = await dettaglioTask(CFG, SESSIONE, ORG, 'aaaa');
    expect(bloccanti).toEqual([]);
  });

  it('elenca un bloccante completato che aspetta ancora il visto', async () => {
    const aspetta = bloccante({ requires_approval: true, approved_by: null });
    const bloccata = taskBase({ blocked_by: [aspetta.id] });
    finServer({ tasks: [bloccata, aspetta] });

    const { bloccanti } = await dettaglioTask(CFG, SESSIONE, ORG, 'aaaa');
    expect(bloccanti.map((b) => b.title)).toEqual(['Preparare i dati']);
  });

  it('elenca un bloccante ancora aperto', async () => {
    const aperto = bloccante({ status: 'in-progress' });
    const bloccata = taskBase({ blocked_by: [aperto.id] });
    finServer({ tasks: [bloccata, aperto] });

    const { bloccanti } = await dettaglioTask(CFG, SESSIONE, ORG, 'aaaa');
    expect(bloccanti).toHaveLength(1);
  });
});

/* -------------------------------------------------------------------------- */

describe('consegnato non e concluso', () => {
  /*
    Con il visto richiesto il lavoro e' CONSEGNATO, non concluso:
    `eChiusaDavvero` lo considera ancora aperto e il resto del prodotto lo
    conta fra le cose da fare. Gli avvisi devono dire la stessa cosa, a tutti.
  */
  const avvisi = (richieste) =>
    richieste
      .filter((r) => r.percorso.includes('/notifications'))
      .map((r) => JSON.parse(r.corpo));

  it('non dice a chi ha chiesto il lavoro che e completato, se aspetta il visto', async () => {
    const richieste = finServer({
      tasks: [
        taskBase({
          requires_approval: true,
          activities: [{ id: 'a1', type: 'created', userId: 'committente-1' }],
        }),
      ],
      membri: [{ user_id: 'capo-1' }],
    });
    const esito = await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaa', stato: 'completata' });

    expect(esito.attendeVisto).toBe(true);
    const suoi = avvisi(richieste).filter((a) => a.user_id === 'committente-1');
    // Prima leggeva "ha completato" nello stesso minuto in cui i responsabili
    // leggevano "aspetta la tua approvazione".
    expect(suoi).toEqual([]);
  });

  it('glielo dice quando il visto non serve', async () => {
    const richieste = finServer({
      tasks: [
        taskBase({
          activities: [{ id: 'a1', type: 'created', userId: 'committente-1' }],
        }),
      ],
    });
    await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaa', stato: 'completata' });
    expect(avvisi(richieste).map((a) => a.user_id)).toEqual(['committente-1']);
  });

  it('non chiede all assegnatario di approvare il proprio lavoro', async () => {
    /*
      Il caso: chiude qualcun altro — per esempio chi lo aveva chiesto — e
      l'assegnatario e' un responsabile. `notifica` scarta chi agisce, non
      l'assegnatario, quindi arrivava l'invito a fare una cosa che sia
      `valutaApprovazione` sia il trigger della 0023 rifiutano.
    */
    const richieste = finServer({
      tasks: [taskBase({ requires_approval: true, assignee_id: 'capo-1' })],
      membri: [{ user_id: 'capo-1' }, { user_id: 'capo-2' }],
    });
    await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaa', stato: 'completata' });

    const inviti = avvisi(richieste).filter((a) => /approvazione/.test(a.message));
    expect(inviti.map((a) => a.user_id)).toEqual(['capo-2']);
  });
});

/* -------------------------------------------------------------------------- */

describe('i tre rami, come nell interfaccia', () => {
  /*
    Ogni giro di revisione trovava un avviso sfasato rispetto al browser: il
    tipo sbagliato, un destinatario in meno, la condizione di chiusura persa.
    Non erano difetti diversi, era la stessa struttura mancante. Questi test
    fissano i tre rami, cosi' che un quarto non si aggiunga per sbaglio.
  */
  const avvisi = (richieste) =>
    richieste
      .filter((r) => r.percorso.includes('/notifications'))
      .map((r) => JSON.parse(r.corpo));

  it('un passaggio qualunque avvisa l assegnatario, non solo gli osservatori', async () => {
    /*
      Se un responsabile mette "bloccata" l'attivita' di qualcun altro, la
      persona che ci sta lavorando deve saperlo. Prima non lo sapeva, a meno
      che non fosse anche osservatrice di se stessa.
    */
    const richieste = finServer({
      tasks: [taskBase({ assignee_id: 'chi-ci-lavora', watchers: ['chi-guarda'] })],
    });
    await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaa', stato: 'bloccata' });

    const spediti = avvisi(richieste);
    expect(spediti.map((a) => a.user_id).sort()).toEqual(['chi-ci-lavora', 'chi-guarda']);
    expect(spediti.every((a) => a.type === 'task_status_changed')).toBe(true);
    expect(spediti[0].message).toContain('not started → blocked');
  });

  it('alla chiusura gli osservatori ricevono task_completed, non un cambio di stato', async () => {
    /*
      Le preferenze per tipo sono una cosa vera: chi ha spento i passaggi di
      stato ma tenuto acceso il completamento non veniva avvisato proprio
      della cosa che gli interessava.
    */
    const richieste = finServer({
      tasks: [taskBase({ assignee_id: 'altra-persona', watchers: ['chi-guarda'] })],
    });
    await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaa', stato: 'completata' });

    const suo = avvisi(richieste).find((a) => a.user_id === 'chi-guarda');
    expect(suo.type).toBe('task_completed');
  });

  it('in attesa di visto gli osservatori sentono parlare di approvazione', async () => {
    const richieste = finServer({
      tasks: [
        taskBase({ requires_approval: true, assignee_id: 'altra-persona', watchers: ['chi-guarda'] }),
      ],
      membri: [{ user_id: 'capo-1' }],
    });
    await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaa', stato: 'completata' });

    const suo = avvisi(richieste).find((a) => a.user_id === 'chi-guarda');
    expect(suo.message).toMatch(/approvazione/);
    expect(avvisi(richieste).some((a) => a.type === 'task_completed')).toBe(false);
  });

  it('l assegnatario che e anche osservatore riceve un avviso solo', async () => {
    // Ha gia' il suo, piu' preciso: quello da osservatore sarebbe la stessa
    // cosa detta due volte. E' la regola di `avvisaOsservatori` in App.tsx.
    const richieste = finServer({
      tasks: [taskBase({ assignee_id: 'altra-persona', watchers: ['altra-persona'] })],
    });
    await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaa', stato: 'completata' });

    expect(avvisi(richieste).filter((a) => a.user_id === 'altra-persona')).toHaveLength(1);
  });
});

describe('due note nello stesso minuto', () => {
  it('non si sovrascrivono a vicenda', async () => {
    /*
      Con un motivo fisso le due chiavi erano identiche e l'indice unico
      respingeva la seconda, in silenzio. Chi seguiva l'attivita' vedeva il
      primo commento e non il secondo — e due note ravvicinate sono cio' che
      succede quando si risponde a se stessi.
    */
    const chiave = async () => {
      const richieste = finServer({ tasks: [taskBase({ assignee_id: 'altra-persona' })] });
      await aggiungiNota(CFG, SESSIONE, ORG, { pezzo: 'aaaa', testo: 'una nota' });
      return JSON.parse(
        richieste.find((r) => r.percorso.includes('/notifications')).corpo
      ).event_key;
    };

    expect(await chiave()).not.toBe(await chiave());
  });
});

describe('bloccantiApertiPerTask', () => {
  const bloccante = (id, extra) => ({
    id,
    status: 'completed',
    requires_approval: false,
    approved_by: null,
    approved_at: null,
    ...extra,
  });

  it('conta i bloccanti aperti, non i legami', async () => {
    const chiuso = bloccante('b-chiuso');
    const aperto = bloccante('b-aperto', { status: 'in-progress' });
    const mio = taskBase({ blocked_by: [chiuso.id, aperto.id] });
    finServer({ tasks: [mio, chiuso, aperto] });

    const conteggi = await bloccantiApertiPerTask(CFG, SESSIONE, ORG, [mio]);
    expect(conteggi.get(mio.id)).toBe(1);
  });

  it('un completato che aspetta il visto conta come aperto', async () => {
    const aspetta = bloccante('b-visto', { requires_approval: true, approved_by: null });
    const mio = taskBase({ blocked_by: [aspetta.id] });
    finServer({ tasks: [mio, aspetta] });

    expect((await bloccantiApertiPerTask(CFG, SESSIONE, ORG, [mio])).get(mio.id)).toBe(1);
  });

  it('un riferimento rotto non blocca', async () => {
    const mio = taskBase({ blocked_by: ['non-esiste'] });
    finServer({ tasks: [mio] });
    expect((await bloccantiApertiPerTask(CFG, SESSIONE, ORG, [mio])).get(mio.id)).toBe(0);
  });

  it('senza legami non chiede niente alla rete', async () => {
    const mio = taskBase({ blocked_by: [] });
    const richieste = finServer({ tasks: [mio] });
    expect((await bloccantiApertiPerTask(CFG, SESSIONE, ORG, [mio])).get(mio.id)).toBe(0);
    expect(richieste).toHaveLength(0);
  });

  it('legge tutti i bloccanti in una richiesta sola', async () => {
    const uno = bloccante('b-1', { status: 'in-progress' });
    const due = bloccante('b-2', { status: 'in-progress' });
    const a = taskBase({ id: 'aaaa1111-0000-0000-0000-000000000000', blocked_by: [uno.id] });
    const b = taskBase({ id: 'aaaa2222-0000-0000-0000-000000000000', blocked_by: [due.id] });
    const richieste = finServer({ tasks: [a, b, uno, due] });

    await bloccantiApertiPerTask(CFG, SESSIONE, ORG, [a, b]);
    expect(richieste).toHaveLength(1);
  });
});

describe('la nota avvisa da tutte e due le strade', () => {
  /*
    Le note si scrivono da due comandi: `nota`, e `stato` con il terzo
    argomento — cioe' proprio il gesto che il bottone «Lavoraci con Claude»
    suggerisce, "chiudi e scrivi cosa hai fatto". Solo il primo avvisava: il
    testo restava nella scheda e chi seguiva il lavoro non sapeva che c'era da
    leggerlo.
  */
  const avvisi = (richieste) =>
    richieste
      .filter((r) => r.percorso.includes('/notifications'))
      .map((r) => JSON.parse(r.corpo));

  it('anche quando la nota accompagna un cambio di stato', async () => {
    const richieste = finServer({
      tasks: [taskBase({ assignee_id: 'altra-persona', watchers: ['chi-guarda'] })],
    });
    await cambiaStato(CFG, SESSIONE, ORG, {
      pezzo: 'aaaa',
      stato: 'completata',
      nota: 'Ecco cosa ho fatto',
    });

    const commenti = avvisi(richieste).filter((a) => a.type === 'task_comment');
    expect(commenti.map((a) => a.user_id).sort()).toEqual(['altra-persona', 'chi-guarda']);
  });

  it('anche quando lo stato non cambia affatto', async () => {
    // Una nota si puo' lasciare senza spostare niente: l'avviso deve partire
    // lo stesso.
    const richieste = finServer({
      tasks: [taskBase({ status: 'in-progress', assignee_id: 'altra-persona' })],
    });
    await cambiaStato(CFG, SESSIONE, ORG, {
      pezzo: 'aaaa',
      stato: 'in-corso',
      nota: 'Solo un aggiornamento',
    });

    expect(avvisi(richieste).filter((a) => a.type === 'task_comment')).toHaveLength(1);
  });

  it('il cambio di stato e la nota restano due avvisi distinti', async () => {
    const richieste = finServer({
      tasks: [taskBase({ assignee_id: 'altra-persona' })],
    });
    await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaa', stato: 'bloccata', nota: 'perche' });

    const suoi = avvisi(richieste).filter((a) => a.user_id === 'altra-persona');
    expect(suoi.map((a) => a.type).sort()).toEqual(['task_comment', 'task_status_changed']);
    expect(new Set(suoi.map((a) => a.event_key)).size).toBe(2);
  });

  it('senza nota non parte nessun avviso di commento', async () => {
    const richieste = finServer({ tasks: [taskBase({ assignee_id: 'altra-persona' })] });
    await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaa', stato: 'bloccata' });
    expect(avvisi(richieste).filter((a) => a.type === 'task_comment')).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */

describe('le deroghe ai permessi', () => {
  /*
    NON e' una barriera di sicurezza, e i test non devono far credere il
    contrario. La barriera sarebbe la policy di UPDATE della 0027, che guarda
    solo il RUOLO e non ha mai letto `custom_permissions`: chi volesse
    aggirare la deroga puo' farlo con `curl` e il proprio token, e poteva farlo
    anche prima che questo connettore esistesse.

    Qui si verifica una cosa piu' modesta e reale: che chiedere a Claude non
    sia il modo comodo per fare cio' che l'amministratore ha appena tolto.
  */
  const conDeroga = (azione, valore) => ({
    ...ORG,
    deroghe: { tasks: { [azione]: valore } },
  });

  it('rifiuta il cambio di stato a chi se l e visto togliere', async () => {
    const richieste = finServer({ tasks: [taskBase()] });
    await expect(
      cambiaStato(CFG, SESSIONE, conDeroga('change_status', false), {
        pezzo: 'aaaa',
        stato: 'completata',
      })
    ).rejects.toThrow(/tolto il permesso/);
    // Si ferma PRIMA di leggere, non dopo aver scritto.
    expect(richieste).toHaveLength(0);
  });

  it('rifiuta il commento a chi se l e visto togliere', async () => {
    const richieste = finServer({ tasks: [taskBase()] });
    await expect(
      aggiungiNota(CFG, SESSIONE, conDeroga('comment', false), {
        pezzo: 'aaaa',
        testo: 'ciao',
      })
    ).rejects.toThrow(/tolto il permesso/);
    expect(richieste).toHaveLength(0);
  });

  it('rifiuta la NOTA dentro un cambio di stato, se il commento e stato tolto', async () => {
    /*
      Il primo controllo guardava solo `change_status`: chi si era visto
      togliere `comment` ma non `change_status` poteva commentare lo stesso
      passando il testo come terzo argomento di `stato` — cioe' proprio il
      comando che il bottone suggerisce.
    */
    const richieste = finServer({ tasks: [taskBase()] });
    await expect(
      cambiaStato(CFG, SESSIONE, conDeroga('comment', false), {
        pezzo: 'aaaa',
        stato: 'completata',
        nota: 'una nota',
      })
    ).rejects.toThrow(/commentare/);
    expect(richieste).toHaveLength(0);
  });

  it('ma lascia passare il cambio di stato SENZA nota', async () => {
    // Togliere il commento non toglie lo stato: rifiutare anche quello
    // sarebbe punire un permesso che nessuno ha revocato.
    finServer({ tasks: [taskBase()] });
    const esito = await cambiaStato(CFG, SESSIONE, conDeroga('comment', false), {
      pezzo: 'aaaa',
      stato: 'completata',
    });
    expect(esito.cambiato).toBe(true);
  });

  it('una deroga che CONCEDE non blocca niente', async () => {
    finServer({ tasks: [taskBase()] });
    const esito = await cambiaStato(CFG, SESSIONE, conDeroga('change_status', true), {
      pezzo: 'aaaa',
      stato: 'completata',
    });
    expect(esito.cambiato).toBe(true);
  });

  it('senza deroghe si lavora come sempre', async () => {
    finServer({ tasks: [taskBase()] });
    const esito = await cambiaStato(CFG, SESSIONE, { ...ORG, deroghe: null }, {
      pezzo: 'aaaa',
      stato: 'completata',
    });
    expect(esito.cambiato).toBe(true);
  });

  it('una deroga su un altra azione non blocca questa', async () => {
    finServer({ tasks: [taskBase()] });
    const esito = await cambiaStato(CFG, SESSIONE, conDeroga('delete_any', false), {
      pezzo: 'aaaa',
      stato: 'completata',
    });
    expect(esito.cambiato).toBe(true);
  });
});

describe('il tetto alla lunghezza delle note', () => {
  /*
    Duemila caratteri, come `sanitizeComment` nell'interfaccia. A scrivere e'
    un modello, e a un modello a cui si chiede "racconta cosa hai fatto" viene
    naturale produrre pagine. `comments` e' una colonna jsonb CUMULATIVA che
    questo codice rilegge e riscrive per intero a ogni nota: una risposta da
    mezzo megabyte resta li' e viaggia a ogni commento successivo, per sempre.
  */
  const lunghissima = 'a'.repeat(5000);
  const scrittura = (richieste) =>
    JSON.parse(richieste.find((r) => r.metodo === 'PATCH').corpo);

  it('taglia la nota di `nota`', async () => {
    const richieste = finServer({ tasks: [taskBase()] });
    await aggiungiNota(CFG, SESSIONE, ORG, { pezzo: 'aaaa', testo: lunghissima });
    expect(scrittura(richieste).comments[0].content).toHaveLength(2000);
  });

  it('taglia anche la nota che accompagna un cambio di stato', async () => {
    const richieste = finServer({ tasks: [taskBase()] });
    await cambiaStato(CFG, SESSIONE, ORG, {
      pezzo: 'aaaa',
      stato: 'completata',
      nota: lunghissima,
    });
    expect(scrittura(richieste).comments[0].content).toHaveLength(2000);
  });

  it('una nota di soli spazi non conta come nota', async () => {
    // Prima `conNota` sarebbe stata vera e la colonna dei commenti riscritta
    // per aggiungere niente.
    const richieste = finServer({ tasks: [taskBase({ status: 'in-progress' })] });
    const esito = await cambiaStato(CFG, SESSIONE, ORG, {
      pezzo: 'aaaa',
      stato: 'in-corso',
      nota: '   \n  ',
    });
    expect(esito.conNota).toBe(false);
    expect(richieste.filter((r) => r.metodo === 'PATCH')).toHaveLength(0);
  });
});

describe('chi riceve l invito ad approvare', () => {
  const avvisi = (richieste) =>
    richieste
      .filter((r) => r.percorso.includes('/notifications'))
      .map((r) => JSON.parse(r.corpo));

  it('non lo riceve chi si e visto togliere il permesso di approvare', async () => {
    /*
      `valutaApprovazione` chiede `tasks.edit_any`, e una deroga puo' averlo
      tolto a un manager: senza questo filtro gli arrivava "aspetta la tua
      approvazione" per un lavoro che in interfaccia non avrebbe potuto
      approvare. Un invito a cercare un pulsante che non c'e'.
    */
    const richieste = finServer({
      tasks: [taskBase({ requires_approval: true, assignee_id: 'altra-persona' })],
      membri: [
        { user_id: 'capo-1', custom_permissions: { tasks: { edit_any: false } } },
        { user_id: 'capo-2', custom_permissions: null },
      ],
    });
    await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaa', stato: 'completata' });

    const inviti = avvisi(richieste).filter((a) => /approvazione/.test(a.message));
    expect(inviti.map((a) => a.user_id)).toEqual(['capo-2']);
  });

  it('una deroga che CONCEDE non toglie l invito', async () => {
    const richieste = finServer({
      tasks: [taskBase({ requires_approval: true, assignee_id: 'altra-persona' })],
      membri: [{ user_id: 'capo-1', custom_permissions: { tasks: { edit_any: true } } }],
    });
    await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaa', stato: 'completata' });
    expect(
      avvisi(richieste).filter((a) => /approvazione/.test(a.message))
    ).toHaveLength(1);
  });

  it('chiede al database anche la colonna delle deroghe', async () => {
    const richieste = finServer({
      tasks: [taskBase({ requires_approval: true, assignee_id: 'altra-persona' })],
      membri: [{ user_id: 'capo-1', custom_permissions: null }],
    });
    await cambiaStato(CFG, SESSIONE, ORG, { pezzo: 'aaaa', stato: 'completata' });
    expect(
      richieste.some(
        (r) => r.percorso.includes('organization_members') && r.percorso.includes('custom_permissions')
      )
    ).toBe(true);
  });
});

describe('attendeIlVisto', () => {
  /*
    La stessa domanda si faceva in due punti — l'elenco della riga di comando e
    quello del connettore — e tutti e due la facevano male allo stesso modo:
    `!approved_by`. Un'approvazione valida richiede anche `approved_at`, quindi
    una riga con l'approvatore ma senza la data risultava ne' chiusa ne' in
    attesa: compariva fra le aperte con scritto "completed" accanto e nessuna
    spiegazione del perche' fosse ancora li'.
  */
  it('e vera per una consegna che aspetta davvero', () => {
    expect(
      attendeIlVisto(taskBase({ status: 'completed', requires_approval: true }))
    ).toBe(true);
  });

  it('resta vera con l approvatore ma senza la data: era questo il buco', () => {
    expect(
      attendeIlVisto(
        taskBase({ status: 'completed', requires_approval: true, approved_by: 'capo' })
      )
    ).toBe(true);
  });

  it('e falsa quando il visto c e per intero', () => {
    expect(
      attendeIlVisto(
        taskBase({
          status: 'completed',
          requires_approval: true,
          approved_by: 'capo',
          approved_at: '2026-09-02T09:00:00.000Z',
        })
      )
    ).toBe(false);
  });

  it('e falsa quando il visto non serve, o il lavoro non e consegnato', () => {
    expect(attendeIlVisto(taskBase({ status: 'completed' }))).toBe(false);
    expect(
      attendeIlVisto(taskBase({ status: 'in-progress', requires_approval: true }))
    ).toBe(false);
  });

  it('e l esatto complemento di eChiusaDavvero sul ramo con il visto', () => {
    // Non si sovrappongono mai: una consegna che richiede il visto o e' chiusa
    // o e' in attesa, e nessuna delle due puo' essere vera insieme all'altra.
    for (const extra of [
      { approved_by: null, approved_at: null },
      { approved_by: 'capo', approved_at: null },
      { approved_by: null, approved_at: '2026-09-02T09:00:00.000Z' },
      { approved_by: 'capo', approved_at: '2026-09-02T09:00:00.000Z' },
    ]) {
      const t = taskBase({ status: 'completed', requires_approval: true, ...extra });
      expect(attendeIlVisto(t), JSON.stringify(extra)).toBe(!eChiusaDavvero(t));
    }
  });
});

/*
  L'impronta del file di sessione.

  Il connettore MCP la usa per accorgersi che chi ha fatto l'accesso non e' piu'
  la stessa persona: e' l'unico segnale che ha, perche' `esci` e `accedi`
  girano in un altro processo e si limitano a riscrivere quel file. Qui si
  guarda il modulo vero, con la cartella di configurazione spostata in una
  temporanea, cosi' la prova passa dalle stesse funzioni che quel file lo
  scrivono e lo cancellano.
*/
describe('l impronta della sessione salvata', () => {
  let casa;
  let nucleo;

  beforeEach(async () => {
    casa = mkdtempSync(resolve(tmpdir(), 'taskflow-impronta-'));
    vi.stubEnv('XDG_CONFIG_HOME', casa);
    // Il percorso si calcola una volta sola, all'import: senza ricaricare il
    // modulo si starebbe guardando la cartella vera di chi esegue i test.
    vi.resetModules();
    nucleo = await import('./taskflowCore.mjs');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(casa, { recursive: true, force: true });
  });

  it('dice "assente" quando la sessione non c e', () => {
    expect(nucleo.improntaSessione()).toBe('assente');
  });

  it('cambia quando entra un altro account', () => {
    nucleo.salvaSessione({ rinnovo: 'rinnovo-anna' });
    const anna = nucleo.improntaSessione();
    nucleo.salvaSessione({ rinnovo: 'rinnovo-bruno' });
    expect(nucleo.improntaSessione()).not.toBe(anna);
  });

  it('non cambia se il contenuto e lo stesso, anche riscritto dopo', () => {
    nucleo.salvaSessione({ rinnovo: 'rinnovo-anna' });
    const prima = nucleo.improntaSessione();
    nucleo.salvaSessione({ rinnovo: 'rinnovo-anna' });
    // Guardare la data invece del contenuto passerebbe di qui con due impronte
    // diverse, e il connettore butterebbe la cache a ogni giro.
    expect(nucleo.improntaSessione()).toBe(prima);
  });

  it('torna "assente" dopo esci', () => {
    nucleo.salvaSessione({ rinnovo: 'rinnovo-anna' });
    expect(nucleo.improntaSessione()).not.toBe('assente');
    expect(nucleo.dimenticaSessione()).toBe(true);
    expect(nucleo.improntaSessione()).toBe('assente');
  });
});
