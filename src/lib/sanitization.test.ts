import { describe, it, expect } from 'vitest';
import { sanitizeEmailPreview, sanitizeText, sanitizeHTML } from '@/lib/sanitization';

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
