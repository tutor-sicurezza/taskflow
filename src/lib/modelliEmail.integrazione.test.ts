import { describe, it, expect } from 'vitest';
import { rendiModello, scegliModello } from '../../api/_lib/modelliOrganizzazione';
import { modelliPredefiniti } from '@/lib/modelliEmail';
import { LINGUE, type Lingua } from '@/lib/i18n';

/**
 * I due pezzi insieme: un modello come lo salva davvero l'interfaccia, riempito
 * come lo riempie davvero la rotta di invio.
 *
 * Sta fra i test di `src` e non accanto al modulo che prova, perche' il
 * tsconfig delle funzioni non conosce gli alias di `src`: un test in `api/`
 * che importa il generatore fa fallire il type-check del deploy.
 *
 * I test dei singoli moduli usano modelli inventati. Questo usa quelli veri —
 * ed e' l'unico che si accorgerebbe di un segnaposto scritto in un modo nel
 * generatore e letto in un altro dal renderer, che e' esattamente il tipo di
 * disallineamento che nessuno vede finche' non arriva l'email.
 */
const VALORI = {
  recipientName: 'Ana Ruiz',
  recipientEmail: 'ana@example.com',
  actionBy: 'Marco Bianchi',
  taskTitle: 'Bilancio Q4',
  taskDescription: 'Chiudere la revisione.',
  taskPriority: 'Alta',
  taskDueDate: '13/09/2026',
  taskStatus: 'In corso',
  taskUrl: 'https://taskflow.example/#task-1',
  applicationName: 'TaskFlow',
  companyName: 'Acme',
  commentText: 'Rivedilo entro domani?',
  currentDate: '10/09/2026',
  currentYear: '2026',
};

describe('modelli veri, riempiti dalla rotta di invio', () => {
  for (const lingua of Object.keys(LINGUE) as Lingua[]) {
    it(`${lingua}: nessun segnaposto sopravvive in nessun modello`, () => {
      for (const modello of modelliPredefiniti(lingua)) {
        const salvato = scegliModello([{ ...modello, isActive: true }], modello.type);
        expect(salvato, `${modello.type} non riconosciuto`).not.toBeNull();

        const email = rendiModello(salvato!, VALORI);
        for (const campo of [email.subject, email.htmlContent, email.textContent]) {
          expect(campo).not.toContain('{{');
          expect(campo).not.toContain('}}');
        }
        expect(email.subject).not.toBe('');
        expect(email.htmlContent).toContain('https://taskflow.example/#task-1');
      }
    });
  }

  it('un titolo ostile non resta eseguibile nell email', () => {
    const modello = modelliPredefiniti('it')[0];
    const salvato = scegliModello([{ ...modello, isActive: true }], modello.type)!;
    const email = rendiModello(salvato, {
      ...VALORI,
      taskTitle: '<img src=x onerror=alert(1)>',
      taskDescription: '"><script>alert(2)</script>',
    });

    expect(email.htmlContent).not.toContain('<img src=x');
    expect(email.htmlContent).not.toContain('<script>');
    expect(email.htmlContent).toContain('&lt;img src=x');
    // Nel testo semplice non c'e' niente da eseguire: deve restare leggibile.
    expect(email.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('un modello disattivato fa ricadere sul predefinito', () => {
    const modello = modelliPredefiniti('it')[0];
    expect(scegliModello([{ ...modello, isActive: false }], modello.type)).toBeNull();
  });
});
