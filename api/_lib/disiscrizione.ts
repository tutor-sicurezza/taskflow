/**
 * Disiscrizione con un clic dalle email di notifica.
 *
 * Serve per due ragioni che coincidono. La prima e' di educazione: un
 * messaggio automatico deve dire come farlo smettere, e "entra
 * nell'applicazione e cerca le preferenze" non e' una risposta. La seconda e'
 * pratica: dal 2024 Gmail considera l'assenza di un'intestazione
 * `List-Unsubscribe` un segnale negativo, e le notifiche finiscono nello spam
 * anche quando il destinatario le aspetta.
 *
 * Il collegamento non puo' contenere l'identificativo dell'utente in chiaro:
 * sarebbe un modo per zittire le notifiche di un collega cambiando una cifra
 * nell'indirizzo. Porta invece una firma HMAC che solo il server puo'
 * produrre, e che il server ricalcola per verificarla.
 *
 * La chiave della firma e' derivata dal service role: e' un segreto che esiste
 * gia' solo lato server e che, se cambiasse, invaliderebbe i vecchi
 * collegamenti — conseguenza accettabile, perche' un collegamento di
 * disiscrizione vive quanto l'email che lo contiene.
 */

const CODIFICATORE = new TextEncoder();

/** Base64 adatta a un indirizzo web: niente `+`, `/` o `=`. */
function base64url(dati: ArrayBuffer): string {
  const byte = new Uint8Array(dati);
  let binario = '';
  for (const b of byte) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function firma(valore: string, segreto: string): Promise<string> {
  const chiave = await crypto.subtle.importKey(
    'raw',
    CODIFICATORE.encode(segreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return base64url(await crypto.subtle.sign('HMAC', chiave, CODIFICATORE.encode(valore)));
}

function segretoFirma(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

/** Il gettone da mettere nel collegamento di disiscrizione. */
export async function creaGettone(userId: string): Promise<string | null> {
  const segreto = segretoFirma();
  if (!segreto) return null;
  return `${userId}.${await firma(userId, segreto)}`;
}

/**
 * Verifica un gettone e restituisce l'utente, oppure null.
 *
 * Il confronto scorre tutti i caratteri anche dopo aver trovato una
 * differenza: confrontare due firme con `===` lascerebbe misurare, dal tempo
 * di risposta, quanti caratteri iniziali sono corretti.
 */
export async function verificaGettone(gettone: string): Promise<string | null> {
  const segreto = segretoFirma();
  if (!segreto) return null;

  const separatore = gettone.lastIndexOf('.');
  if (separatore <= 0) return null;

  const userId = gettone.slice(0, separatore);
  const firmaRicevuta = gettone.slice(separatore + 1);
  const firmaAttesa = await firma(userId, segreto);

  if (firmaRicevuta.length !== firmaAttesa.length) return null;

  let differenze = 0;
  for (let i = 0; i < firmaAttesa.length; i += 1) {
    differenze |= firmaRicevuta.charCodeAt(i) ^ firmaAttesa.charCodeAt(i);
  }

  return differenze === 0 ? userId : null;
}

/** L'indirizzo da mettere nelle intestazioni, o null se manca la base. */
export async function collegamentoDisiscrizione(
  origine: string | undefined,
  userId: string | null
): Promise<string | null> {
  if (!origine || !userId) return null;
  const gettone = await creaGettone(userId);
  if (!gettone) return null;
  return `${origine.replace(/\/$/, '')}/api/email/disiscrivi?g=${encodeURIComponent(gettone)}`;
}
