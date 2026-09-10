/**
 * Modelli email personalizzati dall'organizzazione: scelta e riempimento.
 *
 * I modelli arrivano da `app_state` (riga `key='email-templates'`, colonna
 * JSONB `value`). Sono dati scritti dall'interfaccia, quindi qui non si puo'
 * dare per buono niente: la colonna puo' contenere qualsiasi cosa sia stata
 * salvata ieri da una versione precedente del client, o dalla mano di chi ha
 * usato l'API. Per questo `scegliModello` non lancia mai e in caso di dubbio
 * risponde `null`: il chiamante ricade sui testi predefiniti e l'email parte
 * comunque, invece di far fallire l'invio per un JSON malformato.
 *
 * Il punto delicato e' pero' l'altro: i valori che riempiono i segnaposto
 * (titolo dell'attivita', descrizione, testo di un commento, nomi) sono
 * scritti dagli utenti. Finiscono dentro l'HTML di un'email, che nella casella
 * del destinatario e' un documento renderizzato: senza escape un titolo come
 * `<img src=x onerror=...>` diventa codice nella posta di qualcun altro. Qui
 * l'escape non e' una precauzione, e' la ragione per cui questo modulo esiste
 * al posto di due `String.replace` sparsi nella rotta di invio.
 */

/** Un modello come sopravvive alla validazione: solo i campi che servono all'invio. */
export interface ModelloSalvato {
  type: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  isActive: boolean;
}

export type ValoriModello = Record<string, string | undefined>;

/**
 * Il segnaposto: `{{nome}}`, con eventuali spazi interni tollerati perche' chi
 * scrive un modello a mano scrive facilmente `{{ taskTitle }}`.
 */
const SEGNAPOSTO = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

function escapeHtml(valore: string): string {
  return valore
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Sostituisce i segnaposto in UNA SOLA passata.
 *
 * La funzione di rimpiazzo di `String.replace` e' obbligatoria, non stilistica:
 * un ciclo che rilancia il replace finche' trova `{{` rimpiazzerebbe anche i
 * segnaposto contenuti nei valori appena inseriti. Un utente che intitola
 * un'attivita' `{{taskUrl}}` otterrebbe l'indirizzo vero al suo posto — cioe'
 * riuscirebbe a leggere pezzi del contesto dell'email dal titolo di un task.
 *
 * Un segnaposto senza valore diventa stringa vuota: nessun `{{...}}` deve
 * sopravvivere. Un'email che arriva scritta `{{taskDueDate}}` e' peggio di
 * un'email senza data.
 */
function riempi(
  testo: string,
  valori: ValoriModello,
  trasforma: (valore: string) => string
): string {
  return testo.replace(SEGNAPOSTO, (_intero, nome: string) => {
    const valore = valori[nome];
    return valore ? trasforma(valore) : '';
  });
}

/**
 * Ripulisce l'oggetto dell'email.
 *
 * Non c'e' escape (l'oggetto e' testo semplice, non HTML), ma i ritorni a capo
 * vanno tolti: l'oggetto finisce in un header SMTP, e un `\n` dentro il titolo
 * di un'attivita' permetterebbe di aggiungere header arbitrari — un Bcc, per
 * dirne una. E' l'iniezione CRLF classica.
 */
function ripuliciOggetto(subject: string): string {
  return subject.replace(/[\r\n]+/g, ' ').trim();
}

function stringaOppureVuota(valore: unknown): string {
  return typeof valore === 'string' ? valore : '';
}

/**
 * Sceglie dal contenuto grezzo di app_state il modello ATTIVO del tipo
 * richiesto. Restituisce null se non c'e'.
 */
export function scegliModello(valore: unknown, tipo: string): ModelloSalvato | null {
  if (!Array.isArray(valore)) return null;

  for (const riga of valore) {
    if (!riga || typeof riga !== 'object' || Array.isArray(riga)) continue;

    const candidato = riga as Record<string, unknown>;
    if (candidato.type !== tipo) continue;
    // Un modello disattivato dall'interfaccia va ignorato: l'organizzazione ha
    // detto esplicitamente di voler tornare al testo predefinito.
    if (candidato.isActive !== true) continue;

    const subject = stringaOppureVuota(candidato.subject).trim();
    if (!subject) continue;

    const htmlContent = stringaOppureVuota(candidato.htmlContent);
    const textContent = stringaOppureVuota(candidato.textContent);
    // Un modello senza corpo non e' un modello: meglio il predefinito che
    // un'email vuota.
    if (!htmlContent.trim() && !textContent.trim()) continue;

    return {
      type: tipo,
      subject: stringaOppureVuota(candidato.subject),
      htmlContent,
      textContent,
      isActive: true,
    };
  }

  // Nessun modello valido e attivo: il chiamante usa il predefinito.
  return null;
}

/** Sostituisce i segnaposto e restituisce il messaggio pronto da spedire. */
export function rendiModello(
  modello: ModelloSalvato,
  valori: ValoriModello
): { subject: string; htmlContent: string; textContent: string } {
  const identita = (valore: string) => valore;

  return {
    subject: ripuliciOggetto(riempi(modello.subject, valori, identita)),
    // L'unico dei tre campi che finisce in un documento renderizzato.
    htmlContent: riempi(modello.htmlContent, valori, escapeHtml),
    // Testo semplice: l'escape qui renderebbe solo illeggibile un titolo che
    // contiene una `&` o delle virgolette.
    textContent: riempi(modello.textContent, valori, identita),
  };
}
