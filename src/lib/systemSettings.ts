import type { SystemSettings } from '@/lib/types';

/**
 * Le impostazioni di sistema si sono ridotte a un campo, e non e' un errore.
 *
 * Il pannello ne offriva quarantadue: manutenzione, whitelist di IP, 2FA,
 * scadenza password, limiti di allegati, digest, budget di reparto. Un'ispezione
 * campo per campo ha trovato UN SOLO consumatore in tutto il codice —
 * `general.applicationName`, letto da `src/App.tsx` e da
 * `api/_lib/composizione.ts` per intestare le email. Tutti gli altri venivano
 * scritti su `app_state` e mai piu' riletti: l'amministratore li configurava,
 * leggeva "Settings saved successfully!" e non cambiava assolutamente nulla.
 *
 * Su un interruttore di comodita' sarebbe stato solo inutile. Su
 * `enableIPWhitelist`, `enableTwoFactorAuth` o `maxLoginAttempts` era una
 * bugia su una funzione di sicurezza: chi compilava la whitelist credeva di
 * aver ristretto l'accesso e non aveva ristretto niente. Meglio non offrire
 * l'interruttore che offrirne uno scollegato; il giorno in cui una di queste
 * funzioni esistera' davvero, il campo tornera' insieme al codice che lo legge.
 */
export const DEFAULT_SETTINGS: SystemSettings = {
  general: {
    applicationName: 'TaskFlow',
  },
};

/**
 * Fonde le impostazioni salvate sopra quelle predefinite, sezione per sezione.
 *
 * Il codice leggeva direttamente `settings.ai.enableAIFeatures` e simili. Se il
 * valore memorizzato era parziale o malformato — un backup vecchio
 * ripristinato, una scrittura interrotta, una chiave creata a mano — l'accesso
 * andava in TypeError e, non essendo intercettato, portava giu' l'intera
 * applicazione: schermata bianca per tutti i membri dell'organizzazione,
 * amministratore compreso, cioe' proprio chi avrebbe dovuto rimediare.
 * Successo davvero, con un `system-settings` valorizzato a {}.
 *
 * La fusione e' a due livelli perche' tali sono le impostazioni: le sezioni
 * mancanti tornano ai valori predefiniti, quelle presenti conservano solo i
 * campi effettivamente salvati.
 *
 * Copia solo i campi previsti dai predefiniti, e questo e' anche il percorso di
 * migrazione: nelle organizzazioni gia' avviate `app_state` contiene ancora gli
 * oggetti con le quarantadue chiavi di prima. Ignorandole si evita sia
 * l'errore, sia il caso peggiore — riscriverle al primo salvataggio, tenendo in
 * vita per sempre dei dati che nessuno legge piu'.
 */
export function conImpostazioniPredefinite(salvate: SystemSettings | undefined): SystemSettings {
  if (!salvate || typeof salvate !== 'object') return DEFAULT_SETTINGS;

  const unite = { ...DEFAULT_SETTINGS } as unknown as Record<string, unknown>;

  for (const [sezione, predefiniti] of Object.entries(DEFAULT_SETTINGS)) {
    const valore = (salvate as unknown as Record<string, unknown>)[sezione];

    if (!valore || typeof valore !== 'object' || Array.isArray(valore)) {
      unite[sezione] = predefiniti;
      continue;
    }

    const salvataSezione = valore as Record<string, unknown>;
    const fusa: Record<string, unknown> = { ...(predefiniti as object) };

    for (const campo of Object.keys(predefiniti as object)) {
      if (campo in salvataSezione) fusa[campo] = salvataSezione[campo];
    }

    unite[sezione] = fusa;
  }

  return unite as unknown as SystemSettings;
}
