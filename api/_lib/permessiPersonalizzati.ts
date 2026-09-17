/**
 * I permessi personalizzati, letti e scritti dal server.
 *
 * Prima vivevano solo nell'array `employees` di app_state, cioe' in una chiave
 * che ogni membro puo' riscrivere per intero con il proprio token (la 0011 la
 * lascia fra quelle di "lavoro quotidiano"). Un membro poteva quindi mettersi
 * `customPermissions: { tasks: { edit_any: true } }` da solo, e
 * `getEmployeePermissions` nel client li fondeva SOPRA quelli del ruolo.
 * Restava un inganno della sola interfaccia — policy e rotte rileggono il
 * ruolo da organization_members — ma un'interfaccia che mostra comandi da
 * responsabile a un dipendente e' comunque una cosa da chiudere: e' il primo
 * passo di ogni altra scalata, e chi la vede non sa piu' di cosa fidarsi.
 *
 * Ora la fonte di verita' e' `profiles.custom_permissions`: una colonna che il
 * trigger della 0018 impedisce di modificare dal proprio profilo, che il
 * client puo' solo leggere, e che scrive esclusivamente la rotta dei membri
 * con il service role, dopo aver verificato che chi chiama e' amministratore.
 *
 * Questo file conosce la FORMA di quei permessi, per non scrivere nel database
 * qualunque JSON arrivi nel corpo della richiesta. Il catalogo e' lo stesso
 * di `src/lib/types.ts` (interfaccia `Permission`): api/ ha un tsconfig
 * separato e non puo' importare da src/, quindi e' scritto due volte, e un
 * test in src/lib/permissions.test.ts verifica che le due copie coincidano.
 */

export const CATALOGO_PERMESSI = {
  tasks: [
    'create',
    'edit_own',
    'edit_any',
    'delete_own',
    'delete_any',
    'view_own',
    'view_team',
    'view_all',
    'assign',
    'change_status',
    'comment',
    'attach_files',
    'bulk_operations',
  ],
  employees: ['view', 'add', 'edit', 'delete', 'manage_roles'],
  announcements: ['view', 'create', 'edit', 'delete'],
  analytics: ['view_own', 'view_team', 'view_all'],
  ai_features: ['use_assistant', 'auto_assign', 'get_insights', 'estimate_duration'],
} as const;

export type CategoriaPermesso = keyof typeof CATALOGO_PERMESSI;

/** Una deroga: solo le voci esplicitamente presenti, per categoria. */
export type PermessiPersonalizzati = Partial<
  Record<CategoriaPermesso, Partial<Record<string, boolean>>>
>;

export type EsitoPermessi =
  | { ok: true; valore: PermessiPersonalizzati | null }
  | { ok: false; errore: string };

/**
 * Interpreta il valore ricevuto nel corpo della richiesta.
 *
 * - `null` significa "nessuna deroga": si torna ai permessi del ruolo.
 * - Un oggetto vuoto vale come `null`: una deroga che non deroga niente non
 *   ha motivo di stare nel database, e l'interfaccia mostrerebbe
 *   "personalizzato" senza nulla di personalizzato.
 * - Categorie o voci sconosciute sono un errore, non vengono scartate in
 *   silenzio: un client che manda `tasks.delete_everything` ha un difetto, e
 *   un permesso ignorato senza dirlo e' un difetto che nessuno vedra' mai.
 * - I valori devono essere booleani veri: `"true"` come stringa e' vero in
 *   JavaScript e non lo e' per `=== true`, che e' il confronto usato dal
 *   client. Scriverlo darebbe un permesso che sembra concesso e non lo e'.
 */
export function normalizzaPermessiPersonalizzati(valore: unknown): EsitoPermessi {
  if (valore === null) return { ok: true, valore: null };

  if (typeof valore !== 'object' || Array.isArray(valore)) {
    return { ok: false, errore: 'customPermissions deve essere un oggetto o null' };
  }

  const risultato: PermessiPersonalizzati = {};
  let voci = 0;

  for (const [categoria, deroghe] of Object.entries(valore as Record<string, unknown>)) {
    if (!(categoria in CATALOGO_PERMESSI)) {
      return { ok: false, errore: `Categoria di permessi sconosciuta: ${categoria}` };
    }

    // Una categoria assente e una categoria vuota sono la stessa cosa: si
    // salta, per non salvare `{ tasks: {} }`.
    if (deroghe == null) continue;

    if (typeof deroghe !== 'object' || Array.isArray(deroghe)) {
      return { ok: false, errore: `I permessi di ${categoria} devono essere un oggetto` };
    }

    const ammesse: readonly string[] = CATALOGO_PERMESSI[categoria as CategoriaPermesso];
    const pulite: Partial<Record<string, boolean>> = {};

    for (const [voce, concesso] of Object.entries(deroghe as Record<string, unknown>)) {
      if (!ammesse.includes(voce)) {
        return { ok: false, errore: `Permesso sconosciuto: ${categoria}.${voce}` };
      }
      if (typeof concesso !== 'boolean') {
        return { ok: false, errore: `Il permesso ${categoria}.${voce} deve essere vero o falso` };
      }
      pulite[voce] = concesso;
      voci += 1;
    }

    if (Object.keys(pulite).length > 0) {
      risultato[categoria as CategoriaPermesso] = pulite;
    }
  }

  return { ok: true, valore: voci > 0 ? risultato : null };
}
