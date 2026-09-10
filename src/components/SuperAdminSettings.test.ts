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

    expect(unite.general).toBeDefined();
    expect(typeof unite.general.applicationName).toBe('string');
  });

  it('valori assenti o non validi ricadono sui predefiniti', () => {
    expect(conImpostazioniPredefinite(undefined).general).toBeDefined();
    expect(conImpostazioniPredefinite(null as never).general).toBeDefined();
    expect(conImpostazioniPredefinite('rotto' as never).general).toBeDefined();
  });

  it('una sezione parziale conserva i campi salvati e completa il resto', () => {
    const unite = conImpostazioniPredefinite({
      general: { applicationName: 'Nome scelto' },
    } as never);

    expect(unite.general.applicationName).toBe('Nome scelto');
  });

  it('una sezione di tipo sbagliato viene sostituita, non fusa', () => {
    // Un array o una stringa al posto di un oggetto: fondere produrrebbe
    // qualcosa di inutilizzabile con chiavi numeriche.
    const unite = conImpostazioniPredefinite({ general: 'non un oggetto' } as never);

    expect(typeof unite.general).toBe('object');
    expect(typeof unite.general.applicationName).toBe('string');
  });

  it('non modifica l\'oggetto ricevuto', () => {
    const salvate = { general: { applicationName: 'Originale' } } as never;
    const copia = JSON.parse(JSON.stringify(salvate));

    conImpostazioniPredefinite(salvate);

    expect(salvate).toEqual(copia);
  });

  /**
   * Migrazione dei record esistenti.
   *
   * Nelle organizzazioni gia' avviate `app_state` contiene ancora l'oggetto con
   * le quarantadue impostazioni di prima — sezioni intere (`security`, `ai`,
   * `tasks`...) che non esistono piu' nel tipo. Devono essere ignorate senza
   * errori e senza sopravvivere al primo salvataggio: se venissero ricopiate
   * nell'oggetto fuso, il pannello le riscriverebbe su `app_state` per sempre,
   * e un `enableIPWhitelist: true` continuerebbe a far credere a chi legge il
   * database che esista un filtro sugli IP.
   */
  it('un record salvato con i campi vecchi non rompe nulla e viene ripulito', () => {
    const vecchio = {
      general: {
        applicationName: 'Nome storico',
        companyName: 'Acme',
        timezone: 'Europe/Rome',
        dateFormat: 'DD/MM/YYYY',
        weekStartDay: 'monday',
        language: 'it',
      },
      security: { enableIPWhitelist: true, allowedIPs: ['10.0.0.1'], enableTwoFactorAuth: true },
      ai: { enableAIFeatures: false, aiModel: 'gpt-4o' },
      tasks: { maxAttachmentSize: 25 },
      integrations: { enableSlackIntegration: true },
    } as never;

    const unite = conImpostazioniPredefinite(vecchio);

    expect(unite.general.applicationName).toBe('Nome storico');
    expect(Object.keys(unite)).toEqual(['general']);
    expect(Object.keys(unite.general)).toEqual(['applicationName']);
  });
});
