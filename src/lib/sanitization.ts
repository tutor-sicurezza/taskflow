import DOMPurify from 'dompurify';

export interface SanitizationConfig {
  ALLOWED_TAGS?: string[];
  ALLOWED_ATTR?: string[];
  ALLOW_DATA_ATTR?: boolean;
  RETURN_TRUSTED_TYPE?: boolean;
}

const DEFAULT_CONFIG: SanitizationConfig = {
  ALLOWED_TAGS: [
    'b', 'i', 'em', 'strong', 'u', 's', 'p', 'br', 
    'ul', 'ol', 'li', 'a', 'code', 'pre', 'blockquote'
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
};

const STRICT_CONFIG: SanitizationConfig = {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
  ALLOW_DATA_ATTR: false,
};

/**
 * Configurazione per l'ANTEPRIMA dei template email.
 *
 * Serve un insieme di tag piu' largo del default (le email sono fatte di
 * tabelle, div e stili inline), ma la lista resta esplicita: cio' che non e'
 * elencato viene rimosso, quindi <script>, <iframe> e soprattutto gli
 * attributi on* non sopravvivono.
 *
 * Perche' esiste: l'anteprima veniva iniettata con dangerouslySetInnerHTML
 * senza alcuna sanificazione, e i template vivono in app_state, che qualunque
 * membro dell'organizzazione puo' riscrivere. Bastava quindi essere un
 * 'member' per far eseguire codice nel browser di un amministratore, con la
 * sua sessione, appena apriva l'anteprima.
 */
const EMAIL_PREVIEW_CONFIG: SanitizationConfig = {
  ALLOWED_TAGS: [
    'div', 'span', 'p', 'br', 'hr', 'a', 'b', 'i', 'em', 'strong', 'u', 's',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote',
    'table', 'thead', 'tbody', 'tr', 'td', 'th', 'img', 'center', 'small',
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'src', 'alt', 'title', 'width', 'height',
    'align', 'valign', 'colspan', 'rowspan', 'style', 'class',
  ],
  ALLOW_DATA_ATTR: false,
};

/** Anteprima di un template email, ripulita prima di finire nel DOM. */
export function sanitizeEmailPreview(dirty: string): string {
  if (!dirty || typeof dirty !== 'string') return '';
  return DOMPurify.sanitize(dirty, EMAIL_PREVIEW_CONFIG);
}

export function sanitizeHTML(dirty: string, config?: SanitizationConfig): string {
  if (!dirty || typeof dirty !== 'string') {
    return '';
  }
  
  const sanitizeConfig = config || DEFAULT_CONFIG;
  return DOMPurify.sanitize(dirty, sanitizeConfig);
}

/**
 * Testo semplice: via i tag, ma senza lasciare entita' HTML.
 *
 * DOMPurify con ALLOWED_TAGS: [] toglie il markup ma restituisce comunque
 * HTML *serializzato*: `Budget < 10k & margine > 5%` tornava indietro come
 * `Budget &lt; 10k &amp; margine &gt; 5%`. Questi campi pero' non finiscono
 * mai in un dangerouslySetInnerHTML: li stampa React come testo, e React
 * quota gia' tutto da solo. Risultato: l'utente si vedeva a schermo (e nelle
 * email, e nel database, perche' e' persistente) le entita' al posto dei
 * propri caratteri.
 *
 * Quindi dopo aver tolto i tag decodifichiamo una volta sola le entita'
 * introdotte dalla serializzazione, tramite un textarea: `.value` restituisce
 * il testo decodificato senza mai valutarlo come markup. La decodifica non
 * puo' reintrodurre HTML attivo, perche' il risultato e' una stringa che
 * nessuno inietta nel DOM.
 */
function toPlainText(dirty: string): string {
  const senzaTag = DOMPurify.sanitize(dirty, STRICT_CONFIG);
  if (typeof document === 'undefined') return senzaTag;
  const decodificatore = document.createElement('textarea');
  decodificatore.innerHTML = senzaTag;
  return decodificatore.value;
}

export function sanitizeText(dirty: string): string {
  if (!dirty || typeof dirty !== 'string') {
    return '';
  }

  return toPlainText(dirty);
}

export function sanitizeTaskTitle(title: string): string {
  return sanitizeText(title).slice(0, 200);
}

// Descrizioni e commenti si renderizzano come testo (`whitespace-pre-wrap`),
// non come HTML: sanificarli *in HTML* non aggiungeva sicurezza e mutilava il
// contenuto. Restano i limiti di lunghezza, che valgono per il database.
export function sanitizeTaskDescription(description: string): string {
  return sanitizeText(description).slice(0, 5000);
}

export function sanitizeComment(comment: string): string {
  return sanitizeText(comment).slice(0, 2000);
}

/**
 * Tipi MIME accettati per il contenuto `data:` di un allegato.
 *
 * Whitelist e non blacklist: qui l'unica cosa che conta e' che il tipo NON
 * possa essere interpretato come documento attivo dal browser. Fuori restano
 * quindi `text/html`, `image/svg+xml` (SVG esegue script) e tutto cio' che non
 * e' elencato.
 */
export const ALLOWED_ATTACHMENT_MIME_TYPES: readonly string[] = [
  // Immagini "inerti"
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/tiff',
  'image/heic',
  // Documenti
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
  // Office, vecchio e nuovo formato
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
];

const ALLOWED_ATTACHMENT_MIME_SET = new Set(ALLOWED_ATTACHMENT_MIME_TYPES);

/**
 * Il `fileData` di un allegato, ripulito, oppure stringa vuota.
 *
 * Perche' esiste: `fileData` arriva dal campo jsonb `tasks.attachments`, che
 * autore, assegnatario e manager possono riscrivere con una PATCH diretta a
 * PostgREST, e veniva messo alla lettera in `link.href`. Con
 * `fileData: "javascript:fetch(...)"` il primo che apriva l'allegato eseguiva
 * quel codice con la propria sessione. `link.download` non protegge: viene
 * ignorato per `javascript:` e per `data:text/html`.
 *
 * Accettiamo solo `data:<tipo in whitelist>` — qualunque altro schema
 * (`javascript:`, `blob:`, `http:`, `vbscript:`) e qualunque altro tipo MIME
 * viene rifiutato. Whitelist, quindi nemmeno le varianti offuscate del tipo
 * `java\nscript:` hanno un percorso: se non comincia con `data:` e' fuori.
 */
export function sanitizeAttachmentDataURL(fileData: unknown): string {
  if (typeof fileData !== 'string') return '';

  // Il browser tollera spazi e caratteri di controllo attorno allo schema,
  // quindi normalizziamo prima di decidere e restituiamo il valore normalizzato.
  const valore = fileData.trim();

  // Il tipo MIME e' cio' che sta fra "data:" e il primo ";" o ",".
  // `data:,ciao` (senza tipo) non produce corrispondenza e viene rifiutato.
  const corrispondenza = /^data:([^;,]+)[;,]/i.exec(valore);
  if (!corrispondenza) return '';

  const tipo = corrispondenza[1].trim().toLowerCase();
  return ALLOWED_ATTACHMENT_MIME_SET.has(tipo) ? valore : '';
}

/** Comodita' per i punti che devono solo decidere se mostrare o bloccare. */
export function isAllowedAttachmentDataURL(fileData: unknown): boolean {
  return sanitizeAttachmentDataURL(fileData) !== '';
}

export function sanitizeUserName(name: string): string {
  return sanitizeText(name).slice(0, 100);
}

export function sanitizeEmail(email: string): string {
  const sanitized = sanitizeText(email).slice(0, 255);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(sanitized) ? sanitized : '';
}

export function sanitizeDepartmentName(name: string): string {
  return sanitizeText(name).slice(0, 100);
}

export function sanitizeRole(role: string): string {
  return sanitizeText(role).slice(0, 100);
}

export function sanitizeFileName(fileName: string): string {
  const sanitized = sanitizeText(fileName);
  return sanitized.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 255);
}

export function sanitizeURL(url: string): string {
  if (!url || typeof url !== 'string') {
    return '';
  }
  
  const sanitized = sanitizeText(url);
  
  try {
    const urlObj = new URL(sanitized);
    if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
      return sanitized;
    }
  } catch {
    return '';
  }
  
  return '';
}

// Anche gli annunci si stampano come testo (AnnouncementsDialog li rende in
// un <p>, non con dangerouslySetInnerHTML): stessa storia di titoli e
// commenti, l'HTML serializzato arrivava a schermo come entita'.
export function sanitizeAnnouncementContent(content: string): string {
  return sanitizeText(content).slice(0, 10000);
}

export function sanitizeSearchQuery(query: string): string {
  return sanitizeText(query).slice(0, 200);
}

export function sanitizeJSONField(value: unknown): string {
  if (typeof value === 'string') {
    return sanitizeText(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

export function sanitizeArray<T extends string>(arr: T[]): T[] {
  if (!Array.isArray(arr)) {
    return [];
  }
  return arr.map(item => sanitizeText(String(item)) as T).filter(Boolean);
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): Partial<T> {
  if (!obj || typeof obj !== 'object') {
    return {};
  }
  
  const sanitized: Partial<T> = {};
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      
      if (typeof value === 'string') {
        sanitized[key] = sanitizeText(value) as T[Extract<keyof T, string>];
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (Array.isArray(value)) {
        sanitized[key] = sanitizeArray(value as string[]) as T[Extract<keyof T, string>];
      } else if (value && typeof value === 'object') {
        sanitized[key] = sanitizeObject(value as Record<string, unknown>) as T[Extract<keyof T, string>];
      }
    }
  }
  
  return sanitized;
}

export const Sanitizer = {
  html: sanitizeHTML,
  text: sanitizeText,
  taskTitle: sanitizeTaskTitle,
  taskDescription: sanitizeTaskDescription,
  comment: sanitizeComment,
  userName: sanitizeUserName,
  email: sanitizeEmail,
  departmentName: sanitizeDepartmentName,
  role: sanitizeRole,
  fileName: sanitizeFileName,
  url: sanitizeURL,
  attachmentDataURL: sanitizeAttachmentDataURL,
  announcementContent: sanitizeAnnouncementContent,
  searchQuery: sanitizeSearchQuery,
  jsonField: sanitizeJSONField,
  array: sanitizeArray,
  object: sanitizeObject,
};
