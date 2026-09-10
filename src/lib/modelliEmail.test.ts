import { describe, it, expect } from 'vitest';
import { modelliPredefiniti, modelloPredefinito, tipiNotifica } from '@/lib/modelliEmail';
import { LINGUE, type Lingua } from '@/lib/i18n';

/**
 * Modelli email predefiniti.
 *
 * Sono contenuto che parte davvero via email, quindi un errore qui non si vede
 * in un'interfaccia: si vede in una casella di posta, dopo. I controlli che
 * contano sono due — che ogni segnaposto dichiarato compaia davvero nel corpo
 * (un `{{taskUrl}}` dimenticato e' un'email senza link) e che nessuna frase
 * sia rimasta nella lingua sbagliata.
 */
const LINGUE_TUTTE = Object.keys(LINGUE) as Lingua[];

describe('modelli email predefiniti', () => {
  for (const lingua of LINGUE_TUTTE) {
    describe(lingua, () => {
      const modelli = modelliPredefiniti(lingua);

      it('ne genera dieci, uno per tipo di notifica', () => {
        expect(modelli).toHaveLength(10);
        expect(new Set(modelli.map((m) => m.type)).size).toBe(10);
      });

      it('usa ogni segnaposto che dichiara', () => {
        for (const m of modelli) {
          for (const variabile of m.variables) {
            const segnaposto = `{{${variabile}}}`;
            expect(
              m.htmlContent.includes(segnaposto) || m.subject.includes(segnaposto),
              `${lingua}/${m.type} dichiara ${segnaposto} ma non lo usa`
            ).toBe(true);
          }
        }
      });

      it('porta sempre il link all attivita e un oggetto', () => {
        for (const m of modelli) {
          expect(m.htmlContent).toContain('{{taskUrl}}');
          expect(m.textContent).toContain('{{taskUrl}}');
          expect(m.subject.trim()).not.toBe('');
          expect(m.name.trim()).not.toBe('');
        }
      });

      it('non lascia segnaposto rotti', () => {
        for (const m of modelli) {
          // Si tolgono i segnaposto validi: quel che resta e' una graffa
          // spaiata, cioe' un `{{taskUrl}` scritto male che il destinatario
          // vedrebbe cosi' com'e' nell'email.
          const resto = (m.htmlContent + m.textContent + m.subject).replace(
            /\{\{[a-zA-Z]+\}\}/g,
            ''
          );
          expect(resto.includes('{'), `${m.type}: graffa spaiata`).toBe(false);
          expect(resto.includes('}'), `${m.type}: graffa spaiata`).toBe(false);
        }
      });

      it('l elenco dei tipi coincide con i modelli', () => {
        expect(tipiNotifica(lingua).map((v) => v.value)).toEqual(
          modelli.map((m) => m.type)
        );
        expect(tipiNotifica(lingua).map((v) => v.label)).toEqual(
          modelli.map((m) => m.name)
        );
      });
    });
  }

  it('traduce davvero: nessuna lingua ripete le frasi inglesi', () => {
    for (const lingua of LINGUE_TUTTE) {
      if (lingua === 'en') continue;
      const m = modelloPredefinito(lingua, 'task_assigned');
      const en = modelloPredefinito('en', 'task_assigned');
      expect(m.name, lingua).not.toBe(en.name);
      expect(m.subject, lingua).not.toBe(en.subject);
      expect(m.htmlContent, lingua).not.toBe(en.htmlContent);
      expect(m.textContent, lingua).not.toBe(en.textContent);
    }
  });

  it('mantiene identica la struttura fra le lingue', () => {
    // Le frasi cambiano, il layout no: se una lingua perde un riquadro o un
    // bottone e' un errore nella tabella, non una scelta di traduzione.
    const conta = (html: string) => ({
      div: (html.match(/<div/g) || []).length,
      p: (html.match(/<p /g) || []).length,
      a: (html.match(/<a /g) || []).length,
    });
    for (const lingua of LINGUE_TUTTE) {
      for (const m of modelliPredefiniti(lingua)) {
        const en = modelloPredefinito('en', m.type);
        expect(conta(m.htmlContent), `${lingua}/${m.type}`).toEqual(
          conta(en.htmlContent)
        );
      }
    }
  });
});
