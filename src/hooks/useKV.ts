import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Rimpiazzo drop-in di `useKV` di @github/spark, con persistenza su Supabase.
 *
 * Stessa firma dell'originale:
 *   const [value, setValue, deleteValue] = useKV<T>(key, initialValue)
 *
 * Instradamento:
 *   - chiavi per-utente  -> public.user_state (RLS: solo il proprietario)
 *   - tutto il resto     -> public.app_state  (RLS: membri dell'organizzazione)
 *
 * CONCORRENZA (vedi anche il commento su `enqueue`): ogni chiave e' un unico
 * blob JSON riscritto per intero. Finche' la scrittura partiva dalla copia in
 * memoria del browser, due persone che lavoravano insieme si cancellavano il
 * lavoro a vicenda: chi salvava per ultimo sovrascriveva l'array COMPLETO con
 * la propria versione, vecchia di minuti. Non e' un caso di scuola, e'
 * successo in produzione (un task completato due volte, con attivita' e
 * notifiche duplicate, perche' il secondo browser aveva ancora la fotografia
 * precedente al completamento).
 */

/** Chiavi il cui valore appartiene al singolo utente, non all'organizzazione. */
const PER_USER_KEYS = new Set([
  'has-completed-welcome',
  'has-seen-launch-announcement',
  // La lingua sta qui, e non solo in localStorage, perche' il SERVER deve
  // poterla leggere: le email vanno scritte nella lingua di chi le riceve, e
  // chi le invia non puo' conoscerla. Vedi api/email/send.ts.
  'lingua',
]);

const PER_USER_PREFIXES = ['notification-preferences-'];

function isPerUserKey(key: string) {
  return (
    PER_USER_KEYS.has(key) || PER_USER_PREFIXES.some((p) => key.startsWith(p))
  );
}

/**
 * Lo store di modulo e' indicizzato per SCOPE + chiave, non per sola chiave.
 *
 * Indicizzarlo per sola chiave causava una fuga di dati fra organizzazioni:
 * dopo un logout la cache sopravviveva, e al login successivo `loaded` faceva
 * saltare la rilettura. L'utente entrante vedeva i dati di quello uscente e,
 * alla prima modifica, li riscriveva nella PROPRIA riga di app_state,
 * distruggendo i suoi. Con lo scope nella chiave la collisione non e' piu'
 * rappresentabile, indipendentemente da chi si ricordi di svuotare la cache.
 */
function scopedKey(scopeId: string, key: string) {
  return `${scopeId}:${key}`;
}

type Listener = (value: unknown) => void;
type Op = (previous: unknown) => unknown;

interface Target {
  scopeId: string;
  key: string;
  perUser: boolean;
}

interface Pending extends Target {
  /** Operazioni in attesa, nell'ordine in cui sono state richieste. */
  ops: Op[];
  timer: ReturnType<typeof setTimeout> | null;
  /** Flush in corso: serializza i salvataggi sulla stessa chiave. */
  running: Promise<void> | null;
  userId: string | null;
}

const cache = new Map<string, unknown>();
const listeners = new Map<string, Set<Listener>>();
/** Chiavi gia' caricate dal server, per non rifare la fetch a ogni mount. */
const loaded = new Set<string>();
/**
 * Ultimo valore che risulta essere SUL SERVER, per chiave.
 *
 * Distinto da `cache`, che contiene il valore ottimistico gia' mostrato
 * nell'interfaccia. Confonderli duplica i dati: le operazioni in coda vanno
 * riapplicate allo stato del server, e il valore ottimistico le ha gia'
 * dentro. Applicandole una seconda volta su di esso, creare un task lo
 * inseriva DUE volte (stesso id) alla prima scrittura di una chiave che sul
 * server non esisteva ancora.
 */
const serverValue = new Map<string, unknown>();
/** Scritture in sospeso (debounce non ancora scaduto), per poterle forzare. */
const pending = new Map<string, Pending>();
/** Chiavi attualmente montate: sono quelle da rivalidare al rientro. */
const active = new Map<string, Target>();

const WRITE_DEBOUNCE_MS = 400;

/**
 * Canali realtime, uno per scope (organizzazione o utente) e non uno per
 * chiave: le chiavi sono una quindicina e aprire quindici websocket per
 * mostrare la stessa pagina sarebbe sproporzionato. Il canale riceve tutte le
 * righe dello scope e le smista.
 *
 * Senza questo, una scheda aperta si aggiornava solo tornando in primo piano:
 * due persone che lavoravano insieme vedevano il lavoro dell'altra con minuti
 * di ritardo. La pubblicazione realtime su app_state e' abilitata dalla 0009;
 * se non lo fosse, la sottoscrizione non riceve nulla e resta la rivalidazione
 * al rientro, quindi il comportamento peggiora ma non si rompe.
 */
interface Channel {
  unsubscribe: () => void;
  refs: number;
}

const channels = new Map<string, Channel>();

function subscribeRealtime(scopeId: string, perUser: boolean) {
  const channelKey = `${perUser ? 'user' : 'org'}:${scopeId}`;
  const existing = channels.get(channelKey);
  if (existing) {
    existing.refs += 1;
    return () => releaseRealtime(channelKey);
  }

  const channel = supabase
    .channel(`kv-${channelKey}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: perUser ? 'user_state' : 'app_state',
        filter: perUser ? `user_id=eq.${scopeId}` : `organization_id=eq.${scopeId}`,
      },
      (payload) => {
        const row = (payload.new ?? payload.old) as { key?: string; value?: unknown };
        if (!row?.key) return;

        const cacheKey = scopedKey(scopeId, row.key);

        // Con modifiche non ancora salvate l'evento e' piu' vecchio di cio'
        // che l'utente ha in mano: applicarlo gliele cancellerebbe sotto le
        // dita. Verranno riconciliate dal flush, che rilegge dal server.
        if (pending.has(cacheKey)) return;

        const value = payload.eventType === 'DELETE' ? undefined : row.value;
        serverValue.set(cacheKey, value);

        // Anche le nostre scritture tornano indietro dal canale: senza questo
        // confronto ogni salvataggio provocherebbe un render inutile.
        if (JSON.stringify(value) === JSON.stringify(cache.get(cacheKey))) return;

        broadcast(cacheKey, value);
      }
    )
    .subscribe();

  channels.set(channelKey, {
    refs: 1,
    unsubscribe: () => {
      void supabase.removeChannel(channel);
    },
  });

  return () => releaseRealtime(channelKey);
}

function releaseRealtime(channelKey: string) {
  const entry = channels.get(channelKey);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs > 0) return;
  entry.unsubscribe();
  channels.delete(channelKey);
}

function subscribe(cacheKey: string, fn: Listener) {
  if (!listeners.has(cacheKey)) listeners.set(cacheKey, new Set());
  listeners.get(cacheKey)!.add(fn);
  return () => {
    listeners.get(cacheKey)?.delete(fn);
  };
}

function broadcast(cacheKey: string, value: unknown) {
  cache.set(cacheKey, value);
  listeners.get(cacheKey)?.forEach((fn) => fn(value));
}

/** Legge il valore attualmente sul server. `undefined` = riga assente. */
async function readRemote({ scopeId, key, perUser }: Target) {
  const query = perUser
    ? supabase
        .from('user_state')
        .select('value')
        .eq('user_id', scopeId)
        .eq('key', key)
        .maybeSingle()
    : supabase
        .from('app_state')
        .select('value')
        .eq('organization_id', scopeId)
        .eq('key', key)
        .maybeSingle();

  const { data, error } = await query;

  if (error) {
    console.error(`[useKV] lettura fallita per "${key}":`, error.message);
    return { ok: false as const, value: undefined };
  }

  return {
    ok: true as const,
    value: data && data.value !== null ? (data.value as unknown) : undefined,
  };
}

/** Come readRemote, ma memorizza anche cio' che il server ha davvero. */
async function readRemoteTracked(cacheKey: string, target: Target) {
  const remote = await readRemote(target);
  if (remote.ok) serverValue.set(cacheKey, remote.value);
  return remote;
}

/**
 * Applica le operazioni in coda al valore FRESCO letto dal server.
 *
 * E' qui che sta la differenza con la versione precedente, che salvava il
 * valore gia' calcolato in memoria: partendo dal server, la modifica di chi
 * salva per ultimo si somma a quella dell'altro invece di cancellarla. Resta
 * una finestra di rischio fra lettura e scrittura, ma si misura in
 * millisecondi invece che nella durata della sessione.
 */
async function flushKey(cacheKey: string): Promise<void> {
  const entry = pending.get(cacheKey);
  if (!entry) return;

  if (entry.timer) {
    clearTimeout(entry.timer);
    entry.timer = null;
  }

  // Un flush per volta sulla stessa chiave, altrimenti due letture
  // concorrenti ripartirebbero dallo stesso valore e la seconda scrittura
  // perderebbe la prima — esattamente il problema che stiamo chiudendo.
  if (entry.running) {
    await entry.running;
    return flushKey(cacheKey);
  }

  const ops = entry.ops;
  if (ops.length === 0) {
    pending.delete(cacheKey);
    return;
  }
  entry.ops = [];

  const run = (async () => {
    const remote = await readRemoteTracked(cacheKey, entry);

    if (!remote.ok && !serverValue.has(cacheKey)) {
      // Non sappiamo cosa c'e' sul server e non l'abbiamo mai saputo:
      // scrivere ora significherebbe sovrascrivere alla cieca. Le operazioni
      // tornano in coda e riparte tutto al prossimo salvataggio o rientro
      // sulla scheda. Il valore ottimistico resta a schermo, quindi per
      // l'utente non si perde nulla nel frattempo.
      console.error(`[useKV] scrittura rinviata per "${entry.key}": stato del server ignoto`);
      entry.ops.unshift(...ops);
      return;
    }

    // La base e' SEMPRE lo stato del server, mai `cache`: quest'ultima
    // contiene gia' il risultato ottimistico delle stesse operazioni che
    // stiamo per riapplicare. `undefined` significa "riga non ancora
    // esistente", e gli updater dell'app lo gestiscono (`current || []`).
    const base = remote.ok ? remote.value : serverValue.get(cacheKey);

    let next: unknown = base;
    for (const op of ops) next = op(next);

    const now = new Date().toISOString();
    const { error } = entry.perUser
      ? await supabase.from('user_state').upsert(
          { user_id: entry.scopeId, key: entry.key, value: next, updated_at: now },
          { onConflict: 'user_id,key' }
        )
      : await supabase.from('app_state').upsert(
          {
            organization_id: entry.scopeId,
            key: entry.key,
            value: next,
            updated_at: now,
            updated_by: entry.userId,
          },
          { onConflict: 'organization_id,key' }
        );

    if (error) {
      console.error(`[useKV] scrittura fallita per "${entry.key}":`, error.message);
      return;
    }

    serverValue.set(cacheKey, next);

    // Il risultato riconciliato torna all'interfaccia: se il server aveva
    // qualcosa che non avevamo, ora compare senza aspettare un reload.
    broadcast(cacheKey, next);
  })();

  entry.running = run;

  try {
    await run;
  } finally {
    entry.running = null;
    if (entry.ops.length === 0 && !entry.timer) pending.delete(cacheKey);
  }
}

/** Forza subito tutte le scritture ancora in attesa del debounce. */
export async function flushKVWrites() {
  await Promise.all(Array.from(pending.keys()).map((k) => flushKey(k)));
}

/** Svuota lo store: chiamata al logout da AuthContext. */
export function resetKVCache() {
  cache.clear();
  loaded.clear();
  serverValue.clear();
  channels.forEach((c) => c.unsubscribe());
  channels.clear();
  pending.forEach((entry) => entry.timer && clearTimeout(entry.timer));
  pending.clear();
  listeners.forEach((set) => set.forEach((fn) => fn(undefined)));
}

/**
 * Rilegge dal server le chiavi montate.
 *
 * Senza questo, una scheda lasciata aperta restava ferma alla fotografia del
 * primo caricamento (`loaded` impedisce la rilettura) e mostrava dati vecchi
 * di ore: e' la stessa staleness che produceva i doppi completamenti.
 */
async function revalidateActive() {
  await Promise.all(
    Array.from(active.entries()).map(async ([cacheKey, target]) => {
      // Con modifiche non ancora salvate la risposta del server e' piu'
      // vecchia di cio' che ha in mano l'utente: sovrascriverlo gliele
      // cancellerebbe sotto le dita.
      if (pending.has(cacheKey)) return;

      const remote = await readRemoteTracked(cacheKey, target);
      if (!remote.ok || remote.value === undefined) return;
      if (pending.has(cacheKey)) return;

      if (JSON.stringify(remote.value) !== JSON.stringify(cache.get(cacheKey))) {
        broadcast(cacheKey, remote.value);
      }
    })
  );
}

// Una modifica fatta e subito seguita dalla chiusura della scheda andrebbe
// persa: il debounce non fa in tempo a scadere. `pagehide` copre chiusura,
// reload e navigazione; `visibilitychange` copre il passaggio in background su
// mobile, dove `pagehide` non sempre arriva. Al ritorno in primo piano si
// rilegge, perche' nel frattempo puo' aver scritto qualcun altro.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    void flushKVWrites();
  });
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushKVWrites();
    else void revalidateActive();
  });
  window.addEventListener('focus', () => {
    void revalidateActive();
  });
}

// Due firme, perche' i due casi sono davvero diversi e la differenza e' cio'
// che il codice chiamante assume ovunque:
//
//   useKV<Config>('k', DEFAULT)  -> il valore non e' MAI undefined
//   useKV<Config>('k')           -> puo' esserlo
//
// Dichiarando un unico ritorno `T | undefined` si ottenevano 67 errori in due
// componenti, tutti della forma "config is possibly undefined" su chiavi che un
// default ce l'hanno sempre. Erano invisibili solo perche' il build gira con
// `tsc --noCheck`. La firma sotto non e' un cast per zittire il compilatore: se
// initialValue e' fornito, lo stato parte da quel valore e il caricamento non
// lo riporta mai a undefined, quindi `T` e' il tipo corretto.
export function useKV<T>(
  key: string,
  initialValue: T
): readonly [T, (newValue: T | ((oldValue: T) => T)) => void, () => void];
export function useKV<T = string>(
  key: string
): readonly [T | undefined, (newValue: T | ((oldValue?: T) => T)) => void, () => void];
export function useKV<T = string>(
  key: string,
  initialValue?: T
): readonly [T | undefined, (newValue: T | ((oldValue?: T) => T)) => void, () => void] {
  const { user, organization } = useAuth();
  const perUser = isPerUserKey(key);
  const scopeId = perUser ? user?.id : organization?.id;
  const cacheKey = scopeId ? scopedKey(scopeId, key) : null;

  // `initialValue` e' spesso un letterale (`[]`, `{}`) ricreato a ogni render.
  // Tenuto in un ref, altrimenti finirebbe nelle dipendenze dell'effetto di
  // caricamento e ogni render annullerebbe e rilancerebbe la fetch.
  const initialRef = useRef(initialValue);

  const [value, setValue] = useState<T | undefined>(() =>
    cacheKey && cache.has(cacheKey) ? (cache.get(cacheKey) as T) : initialValue
  );

  const latest = useRef<T | undefined>(value);
  latest.current = value;

  // Sincronizzazione fra componenti che condividono la stessa chiave
  useEffect(() => {
    if (!cacheKey) return;
    return subscribe(cacheKey, (v) => setValue(v as T | undefined));
  }, [cacheKey]);

  // Registro delle chiavi montate, usato dalla rivalidazione al rientro.
  useEffect(() => {
    if (!cacheKey || !scopeId) return;
    active.set(cacheKey, { scopeId, key, perUser });
    return () => {
      active.delete(cacheKey);
    };
  }, [cacheKey, scopeId, key, perUser]);

  // Aggiornamenti in tempo reale dello scope.
  useEffect(() => {
    if (!scopeId) return;
    return subscribeRealtime(scopeId, perUser);
  }, [scopeId, perUser]);

  // Caricamento iniziale dal database
  useEffect(() => {
    if (!scopeId || !cacheKey || loaded.has(cacheKey)) return;
    let cancelled = false;

    (async () => {
      const remote = await readRemoteTracked(cacheKey, { scopeId, key, perUser });
      if (cancelled || !remote.ok) return;

      loaded.add(cacheKey);

      // Se nel frattempo l'utente ha gia' modificato qualcosa, il valore letto
      // dal server e' vecchio: sovrascriverlo cancellerebbe una modifica non
      // ancora salvata.
      if (pending.has(cacheKey)) return;

      if (remote.value !== undefined) {
        broadcast(cacheKey, remote.value as T);
      } else if (initialRef.current !== undefined && !cache.has(cacheKey)) {
        // Nessun valore salvato: teniamo il default in memoria senza scrivere,
        // cosi' non creiamo righe inutili finche' l'utente non modifica nulla.
        broadcast(cacheKey, initialRef.current);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key, cacheKey, scopeId, perUser]);

  /**
   * Mette in coda l'OPERAZIONE, non il risultato.
   *
   * E' la scelta che rende possibile la fusione con lo stato del server: al
   * momento del salvataggio l'updater viene rieseguito sul valore fresco. Un
   * valore costante resta invece una sostituzione, che e' la semantica attesa
   * da `setX(valore)`.
   */
  const enqueue = useCallback(
    (op: Op) => {
      if (!scopeId || !cacheKey) return;

      let entry = pending.get(cacheKey);
      if (!entry) {
        entry = {
          scopeId,
          key,
          perUser,
          ops: [],
          timer: null,
          running: null,
          userId: user?.id ?? null,
        };
        pending.set(cacheKey, entry);
      }

      entry.userId = user?.id ?? null;
      entry.ops.push(op);

      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = setTimeout(() => {
        const current = pending.get(cacheKey);
        if (current) current.timer = null;
        void flushKey(cacheKey);
      }, WRITE_DEBOUNCE_MS);
    },
    [cacheKey, scopeId, key, perUser, user?.id]
  );

  const update = useCallback(
    (newValue: T | ((oldValue?: T) => T)) => {
      if (!cacheKey) return;

      // L'updater funzionale DEVE partire dallo store di modulo, non da
      // `latest.current`: quest'ultimo si aggiorna solo al render successivo,
      // quindi due update consecutivi nello stesso handler leggerebbero
      // entrambi il valore precedente e il secondo annullerebbe il primo.
      // Succedeva davvero: completando un task, addActivity() sovrascriveva
      // il cambio di stato appena applicato e il task restava "not-started".
      const base = cache.has(cacheKey) ? (cache.get(cacheKey) as T) : latest.current;

      if (typeof newValue === 'function') {
        const updater = newValue as (oldValue?: T) => T;
        // Anteprima immediata in interfaccia; la versione che finisce sul
        // server sara' ricalcolata sul valore fresco dentro flushKey.
        broadcast(cacheKey, updater(base));
        enqueue((previous) => updater(previous as T | undefined));
      } else {
        broadcast(cacheKey, newValue);
        enqueue(() => newValue);
      }
    },
    [cacheKey, enqueue]
  );

  const remove = useCallback(() => {
    if (!scopeId || !cacheKey) return;
    broadcast(cacheKey, undefined);
    loaded.delete(cacheKey);
    serverValue.delete(cacheKey);

    const entry = pending.get(cacheKey);
    if (entry?.timer) clearTimeout(entry.timer);
    pending.delete(cacheKey);

    void (perUser
      ? supabase.from('user_state').delete().eq('user_id', scopeId).eq('key', key)
      : supabase
          .from('app_state')
          .delete()
          .eq('organization_id', scopeId)
          .eq('key', key));
  }, [key, cacheKey, scopeId, perUser]);

  // Smontando il componente il debounce verrebbe semplicemente annullato e la
  // modifica persa (cambiare tab entro il debounce bastava). Qui lo si forza.
  useEffect(
    () => () => {
      void flushKVWrites();
    },
    []
  );

  return [value, update, remove] as const;
}
