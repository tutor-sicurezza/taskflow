import { describe, it, expect } from 'vitest';
import {
  sanitizeEmailPreview,
  sanitizeText,
  sanitizeHTML,
  sanitizeTaskTitle,
  sanitizeTaskDescription,
  sanitizeComment,
  sanitizeUserName,
  sanitizeAttachmentDataURL,
  isAllowedAttachmentDataURL,
} from '@/lib/sanitization';

/**
 * Sanificazione dei contenuti che finiscono nel DOM.
 *
 * L'anteprima dei template email veniva iniettata con
 * dangerouslySetInnerHTML senza alcuna sanificazione, e i template sono
 * modificabili dagli amministratori (in una versione precedente, da qualunque
 * membro). Bastava quindi del markup ostile perche' venisse eseguito nel
 * browser di chi apriva l'anteprima, con la sua sessione.
 *
 * Questi test descrivono il confine: il markup di impaginazione tipico delle
 * email deve sopravvivere, tutto cio' che esegue codice no.
 */
describe('sanitizeEmailPreview', () => {
  it('conserva il markup di impaginazione delle email', () => {
    const pulito = sanitizeEmailPreview(
      '<div style="padding:20px"><h1>Titolo</h1><table><tr><td>Cella</td></tr></table><a href="https://esempio.it">Apri</a></div>'
    );

    expect(pulito).toContain('<h1>Titolo</h1>');
    expect(pulito).toContain('<td>Cella</td>');
    expect(pulito).toContain('href="https://esempio.it"');
    expect(pulito).toContain('style="padding:20px"');
  });

  it('rimuove gli script', () => {
    const pulito = sanitizeEmailPreview('<p>Ciao</p><script>alert(1)</script>');
    expect(pulito).toContain('<p>Ciao</p>');
    expect(pulito).not.toContain('<script');
    expect(pulito).not.toContain('alert(1)');
  });

  it('rimuove i gestori di eventi inline', () => {
    // Il vettore piu' comune: non serve un tag <script>, basta un attributo.
    const pulito = sanitizeEmailPreview('<img src="x" onerror="alert(document.cookie)">');
    expect(pulito).not.toContain('onerror');
    expect(pulito).not.toContain('alert');
  });

  it('rimuove iframe e contenuti incorporati', () => {
    const pulito = sanitizeEmailPreview('<iframe src="https://esterno.example"></iframe><p>ok</p>');
    expect(pulito).not.toContain('<iframe');
    expect(pulito).toContain('<p>ok</p>');
  });

  it('neutralizza i link javascript:', () => {
    const pulito = sanitizeEmailPreview('<a href="javascript:alert(1)">clicca</a>');
    expect(pulito).not.toContain('javascript:');
  });

  it('su valori non validi restituisce stringa vuota invece di rompersi', () => {
    expect(sanitizeEmailPreview('')).toBe('');
    expect(sanitizeEmailPreview(undefined as unknown as string)).toBe('');
    expect(sanitizeEmailPreview(null as unknown as string)).toBe('');
  });
});

describe('sanitizeText', () => {
  it('elimina qualunque tag, lasciando il testo', () => {
    expect(sanitizeText('<b>grassetto</b>')).toBe('grassetto');
    expect(sanitizeText('<script>alert(1)</script>')).not.toContain('<script');
  });
});

describe('sanitizeHTML', () => {
  it('consente la formattazione di base ma non gli script', () => {
    const pulito = sanitizeHTML('<p>testo <strong>forte</strong></p><script>alert(1)</script>');
    expect(pulito).toContain('<strong>forte</strong>');
    expect(pulito).not.toContain('<script');
  });
});

/**
 * I campi che React stampa come TESTO.
 *
 * Passavano da DOMPurify e tornavano indietro come HTML serializzato: le
 * entita' finivano nel database e da li' a schermo e nelle email, perche'
 * nessuno le decodificava piu' (non c'e' alcun dangerouslySetInnerHTML su
 * task, commenti o annunci). Questi test fissano la regola: dentro esce il
 * testo dell'utente, senza markup e senza entita'.
 */
describe('campi di testo semplice', () => {
  it('non lascia entita HTML nei titoli', () => {
    expect(sanitizeTaskTitle('Rilascio v2 & test')).toBe('Rilascio v2 & test');
    expect(sanitizeTaskTitle('Prezzo < 10k > 5k')).toBe('Prezzo < 10k > 5k');
    expect(sanitizeTaskTitle('Q&A "virgolette" e apostrofi')).toBe('Q&A "virgolette" e apostrofi');
  });

  it('non lascia entita HTML nelle descrizioni', () => {
    expect(sanitizeTaskDescription('Budget < 10k & margine > 5%')).toBe('Budget < 10k & margine > 5%');
  });

  it('conserva gli a capo dei commenti', () => {
    expect(sanitizeComment('prima riga\nseconda riga')).toBe('prima riga\nseconda riga');
  });

  it('toglie comunque il markup, anche quello che esegue codice', () => {
    expect(sanitizeTaskTitle('<b>Titolo</b>')).toBe('Titolo');
    expect(sanitizeTaskDescription('<script>alert(1)</script>ok')).toBe('ok');
    expect(sanitizeUserName('<img src=x onerror=alert(1)>Mario')).toBe('Mario');
  });

  it('rispetta i limiti di lunghezza', () => {
    expect(sanitizeTaskTitle('a'.repeat(300))).toHaveLength(200);
    expect(sanitizeTaskDescription('a'.repeat(6000))).toHaveLength(5000);
    expect(sanitizeComment('a'.repeat(3000))).toHaveLength(2000);
    expect(sanitizeUserName('a'.repeat(200))).toHaveLength(100);
  });

  it('su valori non validi restituisce stringa vuota', () => {
    expect(sanitizeText('')).toBe('');
    expect(sanitizeText(undefined as unknown as string)).toBe('');
    expect(sanitizeText(null as unknown as string)).toBe('');
  });
});

/**
 * fileData degli allegati.
 *
 * Arriva dal jsonb `tasks.attachments`, riscrivibile con una PATCH diretta a
 * PostgREST da autore, assegnatario e manager, e veniva messo alla lettera in
 * `link.href`: `javascript:` significava esecuzione di codice nella sessione
 * di chi apriva l'allegato. `download` non protegge, viene ignorato per
 * `javascript:` e `data:text/html`.
 */
describe('sanitizeAttachmentDataURL', () => {
  it('accetta i data URL dei tipi in whitelist', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    expect(sanitizeAttachmentDataURL(png)).toBe(png);
    expect(isAllowedAttachmentDataURL('data:application/pdf;base64,JVBERi0=')).toBe(true);
    expect(isAllowedAttachmentDataURL('data:text/plain;charset=utf-8,ciao')).toBe(true);
    expect(
      isAllowedAttachmentDataURL(
        'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,UEsD'
      )
    ).toBe(true);
  });

  it('non guarda le maiuscole del tipo MIME', () => {
    expect(isAllowedAttachmentDataURL('data:IMAGE/PNG;base64,iVBORw0KGgo=')).toBe(true);
  });

  it('rifiuta javascript: e gli altri schemi', () => {
    expect(sanitizeAttachmentDataURL('javascript:fetch("//evil")')).toBe('');
    expect(sanitizeAttachmentDataURL('  javascript:alert(1)')).toBe('');
    expect(sanitizeAttachmentDataURL('vbscript:msgbox(1)')).toBe('');
    expect(sanitizeAttachmentDataURL('blob:https://app.example/abc')).toBe('');
    expect(sanitizeAttachmentDataURL('https://esterno.example/file.pdf')).toBe('');
  });

  it('rifiuta i tipi data: che il browser esegue', () => {
    expect(sanitizeAttachmentDataURL('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(sanitizeAttachmentDataURL('data:image/svg+xml;base64,PHN2Zz4=')).toBe('');
    expect(sanitizeAttachmentDataURL('data:application/xhtml+xml,<html/>')).toBe('');
  });

  it('rifiuta i data URL senza tipo e i valori non stringa', () => {
    expect(sanitizeAttachmentDataURL('data:,ciao')).toBe('');
    expect(sanitizeAttachmentDataURL('data:')).toBe('');
    expect(sanitizeAttachmentDataURL(undefined)).toBe('');
    expect(sanitizeAttachmentDataURL(null)).toBe('');
    expect(sanitizeAttachmentDataURL(42)).toBe('');
  });
});
