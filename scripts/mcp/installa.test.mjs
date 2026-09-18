/*
  L'installatore del connettore, provato su file veri.

  Vale la pena provarlo in un processo a parte invece di esportare `installa()`
  e chiamarla: cio' che si vuole verificare e' il comportamento che l'utente
  vede — cosa resta scritto sul disco e con quale codice di uscita — e in
  particolare i casi in cui NON deve restare scritto niente.

  Il file che tocca e' la configurazione di Claude Desktop, cioe' l'elenco di
  tutti i connettori di quella persona. Riscriverlo per sbaglio non fa perdere
  TaskFlow: fa perdere gli altri, quelli che l'installatore non ha messo e non
  gli appartengono. Per questo ogni caso verifica il file BYTE PER BYTE.
*/
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const QUI = dirname(fileURLToPath(import.meta.url));
const SERVER = resolve(QUI, 'taskflow.mjs');

/** Lancia `--installa` con la configurazione fintata, e riferisce com'e' andata. */
function installa(contenuto, ambiente = {}, argomenti = []) {
  const casa = mkdtempSync(resolve(tmpdir(), 'taskflow-installa-'));
  const percorso = resolve(casa, 'Claude/claude_desktop_config.json');
  mkdirSync(dirname(percorso), { recursive: true });
  if (contenuto !== null) writeFileSync(percorso, contenuto);

  // `spawnSync` e non `execFileSync` perche' l'installatore parla su stderr
  // anche quando riesce — lo standard output appartiene al protocollo MCP — e
  // quei messaggi servono anche nel caso andato bene.
  const esito = spawnSync(process.execPath, [SERVER, '--installa', ...argomenti], {
    env: { ...process.env, XDG_CONFIG_HOME: casa, ...ambiente },
    encoding: 'utf8',
  });

  return {
    uscita: esito.status,
    messaggi: `${esito.stdout ?? ''}${esito.stderr ?? ''}`,
    dopo: existsSync(percorso) ? readFileSync(percorso, 'utf8') : null,
  };
}

/*
  Su questa piattaforma l'installatore usa XDG_CONFIG_HOME; altrove il percorso
  e' un altro e il finto ambiente non avrebbe effetto, quindi si salta invece
  di dichiarare una verifica che non e' avvenuta.
*/
const soloSuLinux = process.platform === 'linux' ? describe : describe.skip;

soloSuLinux('installa il connettore', () => {
  it('crea la configurazione quando non esiste', () => {
    const { uscita, dopo } = installa(null);
    expect(uscita).toBe(0);
    expect(JSON.parse(dopo).mcpServers.taskflow.args[0]).toBe(SERVER);
  });

  it('conserva gli altri connettori invece di sostituirli', () => {
    const prima = JSON.stringify({
      mcpServers: { github: { command: 'gh-mcp', args: ['--stdio'] } },
      globalShortcut: 'Ctrl+Q',
    });
    const { uscita, dopo } = installa(prima);
    expect(uscita).toBe(0);

    const letta = JSON.parse(dopo);
    expect(letta.mcpServers.github).toEqual({ command: 'gh-mcp', args: ['--stdio'] });
    expect(letta.globalShortcut).toBe('Ctrl+Q');
    expect(letta.mcpServers.taskflow).toBeDefined();
  });

  it('aggiorna un taskflow gia presente al percorso nuovo', () => {
    const { uscita, dopo, messaggi } = installa(
      JSON.stringify({ mcpServers: { taskflow: { command: 'vecchio', args: ['/vecchio.mjs'] } } })
    );
    expect(uscita).toBe(0);
    expect(messaggi).toMatch(/Aggiornato/);
    expect(JSON.parse(dopo).mcpServers.taskflow.args).toEqual([SERVER]);
  });

  /*
    Da qui in giu': file che l'installatore non capisce. In tutti la verifica
    e' la stessa, ed e' l'unica che conta — il file dopo e' IDENTICO a prima.
  */
  it('non tocca una configurazione malformata', () => {
    const rotta = '{ "mcpServers": { "altro": { "command": "x" }, } }';
    const { uscita, dopo, messaggi } = installa(rotta);
    expect(uscita).toBe(1);
    expect(dopo).toBe(rotta);
    expect(messaggi).toMatch(/Non lo tocco/);
  });

  it('non tocca un file che si legge ma non e una configurazione', () => {
    /*
      Il caso dell'elenco e' quello che faceva il danno peggiore, e non lo
      faceva in modo rumoroso: `JSON.stringify` butta via le proprieta'
      aggiunte a un array, quindi il file veniva riscritto SENZA taskflow
      mentre l'installatore annunciava "Aggiunto". Si riavviava Claude Desktop
      e non c'era niente, con un messaggio di successo alle spalle.
    */
    for (const contenuto of ['null', '"ciao"', '[{"mcpServers":{"a":{}}}]', '42']) {
      const { uscita, dopo } = installa(contenuto);
      expect(uscita, `con ${contenuto}`).toBe(1);
      expect(dopo, `con ${contenuto}`).toBe(contenuto);
    }
  });

  it('non tocca un file dove mcpServers non e un oggetto', () => {
    const strana = '{"mcpServers":["github"]}';
    const { uscita, dopo } = installa(strana);
    expect(uscita).toBe(1);
    expect(dopo).toBe(strana);
  });
  /*
    L'organizzazione, per chi ne ha piu' di una.

    Claude Desktop lo lancia un'icona, non un terminale: non eredita le
    variabili della shell in cui si e' eseguito `--installa`. Finche' la scelta
    viveva solo in TASKFLOW_ORG, per quegli account ogni chiamata dentro Claude
    Desktop si fermava — cioe' le due righe promesse nella documentazione
    funzionavano solo per chi ha una sola organizzazione.
  */
  it('registra TASKFLOW_ORG nell elemento, cosi sopravvive al riavvio', () => {
    const { uscita, dopo, messaggi } = installa(null, { TASKFLOW_ORG: 'Acme' });
    expect(uscita).toBe(0);
    expect(JSON.parse(dopo).mcpServers.taskflow.env).toEqual({ TASKFLOW_ORG: 'Acme' });
    expect(messaggi).toMatch(/Acme/);
  });

  it('senza organizzazione non scrive un env vuoto, ma dice come fare', () => {
    const { uscita, dopo, messaggi } = installa(null, { TASKFLOW_ORG: '' });
    expect(uscita).toBe(0);
    expect(JSON.parse(dopo).mcpServers.taskflow.env).toBeUndefined();
    // Il consiglio e' `--org`, non la sintassi POSIX: su Windows quella non si
    // esegue, e questo installatore Windows lo supporta.
    expect(messaggi).toMatch(/--org/);
  });

  it('conserva le variabili che qualcuno aveva aggiunto a mano', () => {
    const prima = JSON.stringify({
      mcpServers: {
        taskflow: { command: 'vecchio', args: ['/v.mjs'], env: { MIA_VARIABILE: 'x' } },
      },
    });
    const { dopo } = installa(prima, { TASKFLOW_ORG: 'Beta' });
    expect(JSON.parse(dopo).mcpServers.taskflow.env).toEqual({
      MIA_VARIABILE: 'x',
      TASKFLOW_ORG: 'Beta',
    });
  });
  /*
    `--org`, e perche' non basta la variabile d'ambiente.

    `TASKFLOW_ORG=x comando` e' sintassi POSIX: non si esegue ne' in PowerShell
    ne' in cmd.exe. Questo installatore ha un ramo `win32` esplicito, quindi le
    istruzioni che stampava erano ineseguibili proprio sulla piattaforma per
    cui quel ramo esiste.
  */
  it('accetta --org e lo registra', () => {
    const { uscita, dopo } = installa(null, {}, ['--org', 'd35392e2-0c26-4333-8344-a40fc781f020']);
    expect(uscita).toBe(0);
    expect(JSON.parse(dopo).mcpServers.taskflow.env).toEqual({
      TASKFLOW_ORG: 'd35392e2-0c26-4333-8344-a40fc781f020',
    });
  });

  it('avverte anche su un identificativo, se non ha potuto verificarlo', () => {
    /*
      C'era una scorciatoia: forma di UUID, allora va bene. Ma la forma non dice
      che quell'organizzazione esista ne' che sia tua — un carattere sbagliato
      in un UUID resta un UUID. Cosi' un nome scritto male veniva respinto e un
      identificativo scritto male veniva registrato con un "Aggiunto".
    */
    const { uscita, messaggi } = installa(null, {}, [
      '--org',
      'd35392e2-0c26-4333-8344-a40fc781f020',
    ]);
    expect(uscita).toBe(0);
    expect(messaggi).toMatch(/Non ho potuto verificarlo/);
  });

  it('--org vince sulla variabile d ambiente', () => {
    const { dopo } = installa(null, { TASKFLOW_ORG: 'dall-ambiente' }, [
      '--org',
      'd35392e2-0c26-4333-8344-a40fc781f020',
    ]);
    expect(JSON.parse(dopo).mcpServers.taskflow.env.TASKFLOW_ORG).toBe(
      'd35392e2-0c26-4333-8344-a40fc781f020'
    );
  });

  it('si ferma se dopo --org non c e niente', () => {
    const { uscita, dopo, messaggi } = installa(null, {}, ['--org']);
    expect(uscita).toBe(1);
    expect(messaggi).toMatch(/Dopo --org/);
    expect(dopo).toBeNull();
  });

  it('avverte quando non ha potuto verificare un nome', () => {
    /*
      I nomi non sono unici — solo lo slug lo e' — e `organizzazione()` li
      risolve con `find()`. Senza sessione non si puo' trasformare il nome in
      identificativo, e allora lo si dice invece di legare Claude Desktop a
      un'organizzazione forse sbagliata in silenzio.
    */
    const { uscita, dopo, messaggi } = installa(null, {}, ['--org', 'Acme']);
    expect(uscita).toBe(0);
    expect(JSON.parse(dopo).mcpServers.taskflow.env.TASKFLOW_ORG).toBe('Acme');
    expect(messaggi).toMatch(/stesso nome/);
  });

  it('non suggerisce la sintassi POSIX a chi non ha indicato niente', () => {
    const { messaggi } = installa(null);
    expect(messaggi).toMatch(/--org/);
    expect(messaggi).not.toMatch(/TASKFLOW_ORG=</);
  });
});
