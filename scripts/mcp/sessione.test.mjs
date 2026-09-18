/*
  Il connettore e la sessione salvata: chi esce, esce davvero.

  Questo file prova l'unica cosa che i test sul nucleo non possono vedere: il
  server MCP e' un processo che VIVE, avviato da Claude Desktop e spento con
  lui, mentre `accedi` ed `esci` sono comandi che girano altrove e si limitano
  a riscrivere un file. Fra i due non passa niente — nessun segnale, nessuna
  porta — e l'unico modo che il server ha di accorgersi di un cambio di
  identita' e' guardare quel file.

  Contava provarlo per davvero, con un processo separato e una conversazione
  MCP vera, perche' il difetto che chiude stava proprio nella durata: la
  sessione restava in cache finche' il token era valido, cioe' un'ora, e
  revocare il rinnovo NON spegne il token di accesso gia' emesso. Dopo `esci`
  il connettore continuava a leggere e a scrivere come la persona uscita, e
  dopo un accesso con un altro account rispondeva ancora con le attivita' del
  precedente.

  Al posto di Supabase c'e' un server HTTP locale: cosi' gira il codice vero —
  autenticazione, lettura dell'appartenenza, elenco — e si puo' contare quante
  volte il connettore e' tornato ad autenticarsi, che e' l'altra meta' di cio'
  che si vuole sapere (la cache deve continuare a funzionare quando il file
  non cambia).
*/
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const QUI = dirname(fileURLToPath(import.meta.url));
const SERVER = resolve(QUI, 'taskflow.mjs');

const CONTI = {
  'rinnovo-anna': {
    token: 'token-anna',
    utente: { id: 'utente-anna', email: 'anna@esempio.it' },
    org: { id: 'org-acme', nome: 'Acme' },
    task: 'Rivedere il contratto',
  },
  'rinnovo-bruno': {
    token: 'token-bruno',
    utente: { id: 'utente-bruno', email: 'bruno@esempio.it' },
    org: { id: 'org-contoso', nome: 'Contoso' },
    task: 'Chiudere il bilancio',
  },
};

const perToken = (autorizzazione) =>
  Object.values(CONTI).find((c) => autorizzazione === `Bearer ${c.token}`);

/** Un finto Supabase: risponde come il vero e tiene il conto degli accessi. */
async function fintoSupabase(registro) {
  const server = createServer((req, res) => {
    const pezzi = [];
    req.on('data', (p) => pezzi.push(p));
    req.on('end', () => {
      const percorso = req.url.split('?')[0];
      const rispondi = (stato, corpo) => {
        res.writeHead(stato, { 'content-type': 'application/json' });
        res.end(JSON.stringify(corpo));
      };

      if (percorso === '/auth/v1/token') {
        const { refresh_token: rinnovo } = JSON.parse(Buffer.concat(pezzi).toString() || '{}');
        registro.accessi.push(rinnovo);
        const conto = CONTI[rinnovo];
        if (!conto) return rispondi(400, { message: 'Invalid Refresh Token' });
        return rispondi(200, {
          access_token: conto.token,
          // Lo stesso rinnovo: il nucleo lo riscrive sul file, e restituendo
          // quello di prima il contenuto resta identico. Cosi' un'impronta
          // diversa puo' voler dire una cosa sola, cioe' un altro account.
          refresh_token: rinnovo,
          expires_in: 3600,
          user: conto.utente,
        });
      }

      const conto = perToken(req.headers.authorization);
      if (!conto) return rispondi(401, { message: 'JWT non valido' });

      if (percorso === '/rest/v1/organization_members') {
        return rispondi(200, [
          {
            organization_id: conto.org.id,
            role: 'member',
            custom_permissions: null,
            organizations: { id: conto.org.id, name: conto.org.nome },
          },
        ]);
      }

      if (percorso === '/rest/v1/tasks') {
        registro.elenchi.push(conto.utente.id);
        return rispondi(200, [
          {
            id: 'aaaaaaaa-1111-2222-3333-444444444444',
            title: conto.task,
            status: 'not-started',
            due_date: null,
            assignee_id: conto.utente.id,
            watchers: [],
            blocked_by: [],
            requires_approval: false,
            approved_by: null,
            approved_at: null,
          },
        ]);
      }

      return rispondi(404, { message: `percorso non previsto: ${percorso}` });
    });
  });

  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

describe('il connettore e la sessione salvata', () => {
  let finto;
  let registro;
  let casa;
  let fileSessione;
  let cliente;

  const scriviSessione = (rinnovo) =>
    writeFileSync(fileSessione, JSON.stringify({ url: finto.url, chiave: 'anon', rinnovo }));

  const elenco = async () => {
    const esito = await cliente.callTool({ name: 'taskflow_elenco_task', arguments: {} });
    return { testo: esito.content.map((c) => c.text).join('\n'), errore: esito.isError === true };
  };

  beforeEach(async () => {
    registro = { accessi: [], elenchi: [] };
    finto = await fintoSupabase(registro);

    casa = mkdtempSync(resolve(tmpdir(), 'taskflow-sessione-'));
    fileSessione = resolve(casa, 'taskflow/sessione.json');
    mkdirSync(dirname(fileSessione), { recursive: true });
    scriviSessione('rinnovo-anna');

    cliente = new Client({ name: 'prova', version: '1.0.0' });
    await cliente.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [SERVER],
        env: {
          PATH: process.env.PATH,
          XDG_CONFIG_HOME: casa,
          VITE_SUPABASE_URL: finto.url,
          VITE_SUPABASE_PUBLISHABLE_KEY: 'anon',
        },
      })
    );
  });

  afterEach(async () => {
    await cliente.close();
    await new Promise((ok) => finto.server.close(ok));
    rmSync(casa, { recursive: true, force: true });
  });

  it('risponde con le attivita di chi ha fatto l accesso', async () => {
    const { testo, errore } = await elenco();
    expect(errore).toBe(false);
    expect(testo).toContain('Acme');
    expect(testo).toContain('Rivedere il contratto');
  });

  it('non si riautentica a ogni chiamata se la sessione non e cambiata', async () => {
    await elenco();
    await elenco();
    expect(registro.accessi).toEqual(['rinnovo-anna']);
    expect(registro.elenchi).toEqual(['utente-anna', 'utente-anna']);
  });

  it('dopo un accesso con un altro account risponde con l altro account', async () => {
    expect((await elenco()).testo).toContain('Acme');

    scriviSessione('rinnovo-bruno');

    const { testo, errore } = await elenco();
    expect(errore).toBe(false);
    expect(testo).toContain('Contoso');
    expect(testo).toContain('Chiudere il bilancio');
    expect(testo).not.toContain('Acme');
    expect(registro.accessi).toEqual(['rinnovo-anna', 'rinnovo-bruno']);
    // La prova che conta: nessuna lettura e' partita con il token di prima.
    expect(registro.elenchi).toEqual(['utente-anna', 'utente-bruno']);
  });

  it('dopo esci non risponde piu con le attivita di chi e uscito', async () => {
    expect((await elenco()).testo).toContain('Rivedere il contratto');

    rmSync(fileSessione);

    const { testo, errore } = await elenco();
    expect(errore).toBe(true);
    expect(testo).toMatch(/accedi/);
    expect(testo).not.toContain('Rivedere il contratto');
    expect(registro.elenchi).toEqual(['utente-anna']);
  });
});
