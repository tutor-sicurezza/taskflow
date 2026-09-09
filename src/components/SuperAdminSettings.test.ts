import { describe, it, expect } from 'vitest';
import { conImpostazioniPredefinite } from '@/components/SuperAdminSettings';

/**
 * Regressione: un valore malformato in `system-settings` mandava giu' l'intera
 * applicazione.
 *
 * Il codice leggeva direttamente `settings.ai.enableAIFeatures` e simili. Con
 * un valore parziale — un backup vecchio ripristinato, una scrittura
 * interrotta, una chiave creata a mano — l'accesso andava in TypeError e il
 * risultato era una schermata bianca per TUTTI i membri dell'organizzazione,
 * amministratore compreso, cioe' proprio chi avrebbe dovuto rimediare. E'
 * successo davvero, con `system-settings` valorizzato a `{}`.
 *
 * La fusione con i valori predefiniti deve reggere qualunque cosa arrivi dal
 * database, perche' quel dato non e' sotto il controllo del codice.
 */
describe('conImpostazioniPredefinite', () => {
  it('un oggetto vuoto non deve rompere nulla: era la causa della schermata bianca', () => {
    const unite = conImpostazioniPredefinite({} as never);

    expect(unite.ai).toBeDefined();
    expect(typeof unite.ai.enableAIFeatures).toBe('boolean');
    expect(unite.general).toBeDefined();
    expect(unite.security).toBeDefined();
  });

  it('valori assenti o non validi ricadono sui predefiniti', () => {
    expect(conImpostazioniPredefinite(undefined).ai).toBeDefined();
    expect(conImpostazioniPredefinite(null as never).general).toBeDefined();
    expect(conImpostazioniPredefinite('rotto' as never).tasks).toBeDefined();
  });

  it('una sezione parziale conserva i campi salvati e completa il resto', () => {
    const unite = conImpostazioniPredefinite({
      general: { applicationName: 'Nome scelto' },
    } as never);

    expect(unite.general.applicationName).toBe('Nome scelto');
    // I campi non salvati devono esserci comunque, altrimenti si torna al
    // TypeError da cui e' nato tutto.
    expect(unite.general.timezone).toBeDefined();
    expect(unite.general.dateFormat).toBeDefined();
  });

  it('una sezione di tipo sbagliato viene sostituita, non fusa', () => {
    // Un array o una stringa al posto di un oggetto: fondere produrrebbe
    // qualcosa di inutilizzabile con chiavi numeriche.
    const unite = conImpostazioniPredefinite({ ai: 'non un oggetto' } as never);

    expect(typeof unite.ai).toBe('object');
    expect(typeof unite.ai.enableAIFeatures).toBe('boolean');
  });

  it('non modifica l\'oggetto ricevuto', () => {
    const salvate = { general: { applicationName: 'Originale' } } as never;
    const copia = JSON.parse(JSON.stringify(salvate));

    conImpostazioniPredefinite(salvate);

    expect(salvate).toEqual(copia);
  });
});
