/**
 * Le regole del riepilogo giornaliero, senza database attorno.
 *
 * Il contesto: fino a ieri le preferenze offrivano un selettore di frequenza
 * ("digest giornaliero", "settimanale", "raggruppa per task") che non pilotava
 * nulla — ogni evento faceva partire comunque la sua email. Il selettore e' stato
 * tolto proprio perche' mentiva. Questo file e' la meta' del lavoro che lo rende
 * vero: le decisioni pure — chi vuole il riepilogo, a che ora gli tocca, cosa
 * c'e' scritto dentro — stanno qui e sono verificabili senza una connessione;
 * l'esecuzione sta in `api/cron/digest.ts`.
 *
 * Sta in `_lib` e non accanto alla rotta per lo stesso motivo di
 * `promemoriaLogica.ts`: `api/cron/` e' instradata da Vercel e ogni file li'
 * dentro diventa un endpoint pubblico, test compresi. Il trattino basso di
 * `_lib` esclude la cartella dall'instradamento.
 */

import type { LinguaModello } from './modelliEmail.js';

/**
 * La finestra di raccolta: 24 ore all'indietro dal momento dell'esecuzione.
 *
 * Coincide con la cadenza (uno ogni giorno per persona), quindi in condizioni
 * normali nessuna notifica viene ne' saltata ne' contata due volte. Nei casi
 * anomali la sovrapposizione e' preferibile al buco: una notifica ripetuta in
 * due riepiloghi e' un fastidio, una notifica che non compare in nessuno dei
 * due e' un'informazione persa.
 */
export const FINESTRA_DIGEST_MS = 24 * 60 * 60 * 1000;

/**
 * Tetto agli invii per esecuzione, come nei promemoria e per la stessa ragione:
 * non e' una quota di prodotto ma una cintura di sicurezza. Se un guasto rende
 * "dovuto adesso" il riepilogo di tutti insieme, e' meglio fermarsi, dirlo nella
 * risposta e far intervenire una persona, che spedire una campagna di posta
 * involontaria a nome del dominio verificato.
 */
export const TETTO_DIGEST_PER_ESECUZIONE = 200;

/**
 * Quante righe di preferenze leggere al massimo. Piu' alto del tetto perche' la
 * stragrande maggioranza verra' scartata subito: chi ha il riepilogo spento (il
 * caso predefinito) e chi ce l'ha acceso ma a un'altra ora.
 */
export const MAX_PREFERENZE_LETTE = 5000;

/**
 * Quante notifiche elencare per email. Oltre questo numero il riepilogo smette
 * di essere leggibile e diventa un muro: si elencano le piu' recenti e si dice
 * quante altre ce ne sono, con il link per vederle tutte.
 */
export const MAX_VOCI_PER_EMAIL = 30;

/**
 * La chiave di `user_state` in cui il lavoro pianificato ricorda l'ultimo
 * riepilogo spedito. Vedi `finestraDigest` per il meccanismo anti-doppione.
 */
export const CHIAVE_ULTIMO_INVIO = 'digest-ultimo-invio';

/* ------------------------------------------------------------------ *
 * 1. Le preferenze
 * ------------------------------------------------------------------ */

/**
 * Dice se il destinatario ha scelto il riepilogo al posto delle email immediate.
 *
 * In caso di dubbio torna FALSO, cioe' "spedisci subito". E' la stessa regola di
 * `puoRicevereEmail` in `preferenzeNotifiche.ts`, applicata al rovescio ma con lo
 * stesso principio: preferenze assenti (l'utente non ha mai aperto la
 * schermata, ed e' il caso piu' comune), malformate, o salvate da una versione
 * precedente del client non sono una scelta dell'utente. Il predefinito
 * dell'interfaccia e' "email immediate", e questa funzione lo rispecchia.
 *
 * Il verso conta: sbagliarlo qui significherebbe zittire la posta di chi non ha
 * chiesto niente, e nessuno se ne accorgerebbe — un'email che non arriva non
 * genera un errore da nessuna parte.
 *
 * Serve anche a `puoRicevereEmail`, che deve smettere di spedire evento per
 * evento a chi ha il riepilogo: senza quel filtro il riepilogo sarebbe posta in
 * PIU', non in meno.
 */
export function preferisceRiepilogo(valore: unknown): boolean {
  if (!valore || typeof valore !== 'object' || Array.isArray(valore)) return false;
  const preferenze = valore as Record<string, unknown>;

  // Solo un `true` esplicito accende. E non basta l'interruttore: senza un'ora
  // valida non esisterebbe un istante in cui il riepilogo parte, quindi la
  // persona resterebbe senza alcuna email — ne' immediata ne' riassunta.
  if (preferenze.digestEnabled !== true) return false;
  return oraRiepilogo(valore) !== null;
}

/**
 * L'ora scelta, normalizzata a "HH:MM", oppure null se non e' utilizzabile.
 *
 * Accetta anche "8:00" perche' un valore salvato a mano o da un client vecchio
 * non deve far sparire l'email; rifiuta invece ore e minuti fuori scala, che non
 * corrisponderebbero mai a nessuna esecuzione.
 */
export function oraRiepilogo(valore: unknown): string | null {
  if (!valore || typeof valore !== 'object' || Array.isArray(valore)) return null;
  const grezzo = (valore as Record<string, unknown>).digestTime;
  if (typeof grezzo !== 'string') return null;

  const pezzi = /^(\d{1,2}):(\d{2})$/.exec(grezzo.trim());
  if (!pezzi) return null;

  const ore = Number(pezzi[1]);
  const minuti = Number(pezzi[2]);
  if (ore < 0 || ore > 23 || minuti < 0 || minuti > 59) return null;

  return `${String(ore).padStart(2, '0')}:${String(minuti).padStart(2, '0')}`;
}

/**
 * Il fuso orario del destinatario, o 'UTC' se non ne ha uno utilizzabile.
 *
 * IL PUNTO DELICATO DI TUTTO IL FILE. L'ora che la persona sceglie e' la SUA
 * ora: "mandamelo alle 8" significa alle 8 di casa sua. Il lavoro pianificato
 * pero' gira in UTC, e le due cose coincidono solo a Greenwich d'inverno.
 *
 * Le strade erano due. Dichiarare che l'ora e' UTC e scriverlo
 * nell'interfaccia sarebbe onesto ma scarica sull'utente una conversione che
 * cambia due volte l'anno con l'ora legale: chi sceglie "08:00" a gennaio se lo
 * ritrova alle 10 di mattina a luglio, e non ha sbagliato niente. Tenere il fuso
 * per utente costa un campo in piu' e queste venti righe, e il campo non e' un
 * altro selettore da compilare: il browser lo sa gia'
 * (`Intl.DateTimeFormat().resolvedOptions().timeZone`) e l'interfaccia lo salva
 * da sola, mostrando quale ha rilevato. Un identificativo IANA — "Europe/Rome",
 * non "+02:00" — segue l'ora legale da solo.
 *
 * Il ripiego su UTC non e' una scommessa: e' l'unico fuso di cui si e' certi che
 * esista ovunque, e l'interfaccia dichiara quale sta usando, quindi chi ci
 * finisce dentro lo vede scritto.
 */
export function fusoRiepilogo(valore: unknown): string {
  if (!valore || typeof valore !== 'object' || Array.isArray(valore)) return 'UTC';
  const grezzo = (valore as Record<string, unknown>).digestTimezone;
  if (typeof grezzo !== 'string' || !grezzo.trim()) return 'UTC';
  return fusoValido(grezzo.trim()) ? grezzo.trim() : 'UTC';
}

/** Un fuso e' valido se il runtime lo sa usare: e' l'unica prova che conta. */
export function fusoValido(fuso: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: fuso });
    return true;
  } catch {
    return false;
  }
}

/**
 * L'ora locale ("HH", 00-23) in quel fuso nell'istante dato.
 *
 * `hourCycle: 'h23'` e non `hour12: false`: quest'ultimo, con certe versioni di
 * ICU, restituisce "24" a mezzanotte invece di "00" — e un riepilogo impostato a
 * mezzanotte non partirebbe mai, in silenzio.
 */
export function oraLocale(adesso: Date, fuso: string): string {
  const zona = fusoValido(fuso) ? fuso : 'UTC';
  const parti = new Intl.DateTimeFormat('en-GB', {
    timeZone: zona,
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(adesso);
  const ora = parti.filter((parte) => parte.type === 'hour')[0];
  return (ora?.value ?? '00').padStart(2, '0');
}

/**
 * Dice se a QUESTA persona il riepilogo tocca in QUESTA esecuzione.
 *
 * Si confrontano solo le ore, non i minuti: il lavoro pianificato si sveglia una
 * volta all'ora, quindi i minuti non potrebbero mai essere onorati. Per questo
 * l'interfaccia offre solo ore intere — offrire "08:30" e poi spedire alle 08:00
 * sarebbe di nuovo un comando che dice una cosa e ne fa un'altra, cioe' il
 * difetto che stiamo correggendo. Il confronto resta tollerante sui minuti per
 * non far sparire l'email a chi ha un valore salvato a meta' ora.
 */
export function eOraDelRiepilogo(valore: unknown, adesso: Date): boolean {
  if (!preferisceRiepilogo(valore)) return false;
  const ora = oraRiepilogo(valore);
  if (!ora) return false;
  return ora.slice(0, 2) === oraLocale(adesso, fusoRiepilogo(valore));
}

/* ------------------------------------------------------------------ *
 * 2. Il meccanismo anti-doppione
 * ------------------------------------------------------------------ */

/**
 * Identificativo della finestra oraria corrente, in UTC: "2026-09-10T08".
 *
 * E' il perno contro i doppioni. Dopo un invio riuscito il lavoro scrive questo
 * valore in `user_state`, sotto `CHIAVE_ULTIMO_INVIO`; all'esecuzione successiva
 * chi ha gia' quel valore viene saltato. Se lo scheduler ritenta la stessa ora —
 * un timeout, un 500, un doppio innesco della piattaforma — la seconda passata
 * trova il segno e non spedisce niente.
 *
 * La finestra e' UTC anche se l'ora scelta e' locale, e va bene cosi': serve solo
 * a distinguere due esecuzioni, e le esecuzioni sono a cadenza UTC. Un'ora e'
 * l'unita' giusta perche' ogni persona ha al piu' un riepilogo per ora, quindi
 * la stessa finestra non puo' contenere due riepiloghi legittimi.
 *
 * La riga sta nello stato dell'utente e non in una tabella riservata al server:
 * evitarlo avrebbe richiesto una migrazione, che non fa parte di questo lavoro.
 * La conseguenza va detta: il proprietario puo' cancellare quella riga, e
 * l'effetto sarebbe un secondo riepilogo della propria posta nella stessa ora.
 * E' un danno che ricade solo su chi lo provoca, e non apre nulla verso gli
 * altri utenti. Il passo successivo, se serve, e' una tabella con RLS attiva e
 * zero policy, come `email_promemoria_inviati`.
 *
 * Il segno si scrive DOPO un invio riuscito, mai prima: un fallimento del
 * provider deve poter essere ritentato, non restare zittito da un segno messo in
 * anticipo.
 */
export function finestraDigest(adesso: Date): string {
  return adesso.toISOString().slice(0, 13);
}

/** Legge la finestra dell'ultimo invio da un valore grezzo di `user_state`. */
export function ultimaFinestraInviata(valore: unknown): string | null {
  if (!valore || typeof valore !== 'object' || Array.isArray(valore)) return null;
  const finestra = (valore as Record<string, unknown>).finestra;
  return typeof finestra === 'string' && finestra ? finestra : null;
}

/* ------------------------------------------------------------------ *
 * 3. La composizione del testo
 * ------------------------------------------------------------------ */

/** Il minimo che serve per elencare una notifica dentro il riepilogo. */
export interface VoceRiepilogo {
  /** Il messaggio, gia' scritto nella lingua del destinatario da chi l'ha creato. */
  message: string;
  task_title?: string | null;
  created_at?: string | null;
}

export interface ParametriRiepilogo {
  nomeDestinatario?: string | null;
  voci: VoceRiepilogo[];
  /** Quante notifiche ci sono in tutto, se piu' di quelle elencate. */
  totale: number;
  /** Il link all'applicazione; se manca, il riepilogo esce senza bottone. */
  appUrl?: string;
  /** Il nome che l'organizzazione ha dato all'applicazione. */
  nomeApplicazione: string;
  /** Il fuso in cui mostrare gli orari: quello scelto dal destinatario. */
  fuso: string;
}

export interface RiepilogoComposto {
  subject: string;
  htmlContent: string;
  textContent: string;
}

interface TestiDigest {
  /** L'oggetto dipende dal numero: "1 notifica" non e' "5 notifiche". */
  oggetto: (quante: number) => string;
  saluto: (nome?: string) => string;
  intro: (quante: number) => string;
  altre: (quante: number) => string;
  bottone: string;
  apri: string;
  /**
   * Perche' questo messaggio esiste. Non e' cortesia: un riepilogo che arriva
   * una volta al giorno e' facile da scambiare per posta indesiderata, e chi non
   * ricorda di averlo scelto deve poter risalire subito all'interruttore.
   */
  perche: string;
  localeData: string;
}

const TESTI: Record<LinguaModello, TestiDigest> = {
  it: {
    oggetto: (n) => (n === 1 ? 'Riepilogo giornaliero: 1 notifica' : `Riepilogo giornaliero: ${n} notifiche`),
    saluto: (nome) => (nome ? `Ciao ${nome},` : 'Ciao,'),
    intro: (n) =>
      n === 1
        ? 'Hai 1 notifica non letta delle ultime 24 ore.'
        : `Hai ${n} notifiche non lette delle ultime 24 ore.`,
    altre: (n) => (n === 1 ? "E c'e' un'altra notifica non elencata qui." : `E ci sono altre ${n} notifiche non elencate qui.`),
    bottone: 'Apri le notifiche',
    apri: 'Apri le notifiche',
    perche: 'Ricevi questo messaggio perche\' hai scelto il riepilogo giornaliero nelle preferenze di notifica.',
    localeData: 'it-IT',
  },
  en: {
    oggetto: (n) => (n === 1 ? 'Daily summary: 1 notification' : `Daily summary: ${n} notifications`),
    saluto: (nome) => (nome ? `Hi ${nome},` : 'Hi,'),
    intro: (n) =>
      n === 1
        ? 'You have 1 unread notification from the last 24 hours.'
        : `You have ${n} unread notifications from the last 24 hours.`,
    altre: (n) => (n === 1 ? 'And 1 more notification is not listed here.' : `And ${n} more notifications are not listed here.`),
    bottone: 'Open notifications',
    apri: 'Open notifications',
    perche: 'You are receiving this because you chose the daily summary in your notification preferences.',
    localeData: 'en-GB',
  },
  fr: {
    oggetto: (n) => (n === 1 ? 'Résumé quotidien : 1 notification' : `Résumé quotidien : ${n} notifications`),
    saluto: (nome) => (nome ? `Bonjour ${nome},` : 'Bonjour,'),
    intro: (n) =>
      n === 1
        ? 'Vous avez 1 notification non lue des dernières 24 heures.'
        : `Vous avez ${n} notifications non lues des dernières 24 heures.`,
    altre: (n) => (n === 1 ? "Et 1 autre notification n'est pas listée ici." : `Et ${n} autres notifications ne sont pas listées ici.`),
    bottone: 'Ouvrir les notifications',
    apri: 'Ouvrir les notifications',
    perche: 'Vous recevez ce message parce que vous avez choisi le résumé quotidien dans vos préférences de notification.',
    localeData: 'fr-FR',
  },
  de: {
    oggetto: (n) => (n === 1 ? 'Tageszusammenfassung: 1 Benachrichtigung' : `Tageszusammenfassung: ${n} Benachrichtigungen`),
    saluto: (nome) => (nome ? `Hallo ${nome},` : 'Hallo,'),
    intro: (n) =>
      n === 1
        ? 'Sie haben 1 ungelesene Benachrichtigung aus den letzten 24 Stunden.'
        : `Sie haben ${n} ungelesene Benachrichtigungen aus den letzten 24 Stunden.`,
    altre: (n) =>
      n === 1
        ? 'Und 1 weitere Benachrichtigung ist hier nicht aufgeführt.'
        : `Und ${n} weitere Benachrichtigungen sind hier nicht aufgeführt.`,
    bottone: 'Benachrichtigungen öffnen',
    apri: 'Benachrichtigungen öffnen',
    perche: 'Sie erhalten diese Nachricht, weil Sie in Ihren Benachrichtigungseinstellungen die Tageszusammenfassung gewählt haben.',
    localeData: 'de-DE',
  },
  es: {
    oggetto: (n) => (n === 1 ? 'Resumen diario: 1 notificación' : `Resumen diario: ${n} notificaciones`),
    saluto: (nome) => (nome ? `Hola ${nome}:` : 'Hola:'),
    intro: (n) =>
      n === 1
        ? 'Tienes 1 notificación sin leer de las últimas 24 horas.'
        : `Tienes ${n} notificaciones sin leer de las últimas 24 horas.`,
    altre: (n) => (n === 1 ? 'Y hay 1 notificación más que no aparece aquí.' : `Y hay ${n} notificaciones más que no aparecen aquí.`),
    bottone: 'Abrir las notificaciones',
    apri: 'Abrir las notificaciones',
    perche: 'Recibes este mensaje porque elegiste el resumen diario en tus preferencias de notificación.',
    localeData: 'es-ES',
  },
};

/**
 * Sanifica il testo che finisce nell'HTML.
 *
 * I messaggi delle notifiche contengono titoli di task scritti dagli utenti: un
 * titolo con dentro `<img onerror=...>` non e' un'ipotesi teorica, e un'email
 * HTML e' un posto in cui quella roba viene renderizzata. Qui non serve un
 * sanificatore completo — non ci sono tag leciti da preservare — quindi si
 * neutralizza tutto e basta.
 */
export function scappaHtml(valore: string): string {
  return valore
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Ora e giorno di una notifica, nel fuso e nella convenzione del lettore. */
function quando(iso: string | null | undefined, lingua: LinguaModello, fuso: string): string {
  if (!iso) return '';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(TESTI[lingua].localeData, {
      timeZone: fusoValido(fuso) ? fuso : 'UTC',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(data);
  } catch {
    return '';
  }
}

/**
 * Compone il riepilogo nella lingua del destinatario.
 *
 * E' una funzione pura: prende righe gia' lette e restituisce testo. Il perche'
 * di questa separazione e' lo stesso di `modelliEmail.ts` — la struttura sta in
 * un posto e le frasi in un altro, quindi aggiungere una lingua e' una tabella
 * di frasi e non un blocco di HTML da tenere allineato agli altri quattro.
 *
 * Il riepilogo NON passa dai modelli personalizzabili dell'organizzazione, di
 * proposito: quelli hanno segnaposto per un task solo (`{{taskTitle}}`,
 * `{{taskUrl}}`) e non saprebbero rappresentare un elenco. Meglio un testo
 * onesto e fisso che un modello riempito a meta'.
 */
export function componiRiepilogo(
  lingua: LinguaModello,
  parametri: ParametriRiepilogo
): RiepilogoComposto {
  const testi = TESTI[lingua] ?? TESTI.it;
  const { voci, totale, nomeDestinatario, appUrl, nomeApplicazione, fuso } = parametri;
  const restanti = Math.max(0, totale - voci.length);

  const righeHtml: string[] = [];
  const righeTesto: string[] = [];

  for (const voce of voci) {
    const istante = quando(voce.created_at, lingua, fuso);
    // Il messaggio della notifica e' gia' nella lingua giusta: lo scrive il
    // server quando la notifica nasce, usando la lingua del destinatario.
    const testo = voce.message || voce.task_title || '';
    righeHtml.push(
      `    <li style="margin: 8px 0; color: #2c3e50;">` +
        (istante ? `<span style="color: #7f8c8d;">${scappaHtml(istante)}</span> — ` : '') +
        `${scappaHtml(testo)}</li>`
    );
    righeTesto.push(istante ? `- ${istante} — ${testo}` : `- ${testo}`);
  }

  const pezziHtml: string[] = [
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">',
    `  <h2 style="color: #2c3e50; margin-bottom: 4px;">${scappaHtml(testi.oggetto(totale))}</h2>`,
    `  <p style="color: #2c3e50;">${scappaHtml(testi.saluto(nomeDestinatario ?? undefined))}</p>`,
    `  <p style="color: #2c3e50;">${scappaHtml(testi.intro(totale))}</p>`,
    '  <ul style="padding-left: 18px; margin: 20px 0;">',
    ...righeHtml,
    '  </ul>',
  ];

  const pezziTesto: string[] = [
    testi.saluto(nomeDestinatario ?? undefined),
    '',
    testi.intro(totale),
    '',
    ...righeTesto,
  ];

  if (restanti > 0) {
    pezziHtml.push(`  <p style="color: #7f8c8d;">${scappaHtml(testi.altre(restanti))}</p>`);
    pezziTesto.push('', testi.altre(restanti));
  }

  // Senza APP_URL configurata il modello resta senza link: meglio nessun bottone
  // che un bottone che porta da nessuna parte dentro un'email vera.
  if (appUrl) {
    pezziHtml.push(
      `  <a href="${scappaHtml(appUrl)}" style="display: inline-block; background-color: #3498db; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 10px;">${scappaHtml(testi.bottone)}</a>`
    );
    pezziTesto.push('', `${testi.apri}: ${appUrl}`);
  }

  pezziHtml.push(
    `  <p style="margin-top: 30px; font-size: 14px; color: #7f8c8d;">${scappaHtml(testi.perche)}<br>${scappaHtml(nomeApplicazione)}</p>`,
    '</div>'
  );
  pezziTesto.push('', testi.perche, nomeApplicazione);

  return {
    subject: testi.oggetto(totale),
    htmlContent: pezziHtml.join('\n'),
    textContent: pezziTesto.join('\n'),
  };
}

/** I numeri che la rotta restituisce, per poter leggere un'esecuzione da fuori. */
export interface ConteggiDigest {
  /** Righe di preferenze esaminate. */
  esaminati: number;
  /** Quanti hanno il riepilogo acceso, a qualunque ora. */
  conRiepilogo: number;
  /** Quanti lo avevano dovuto in questa finestra oraria. */
  dovutiOra: number;
  spediti: number;
  saltati: {
    giaSpedito: number;
    nienteDiNuovo: number;
    senzaEmail: number;
    invioFallito: number;
  };
  tettoRaggiunto: boolean;
}
