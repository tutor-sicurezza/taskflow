import type { DeroghePermessi, Employee, UserRole } from '@/lib/types';

/**
 * Chi sta guardando, e con quali permessi.
 *
 * Sta qui e non dentro App.tsx perche' e' la decisione che regge l'intera
 * interfaccia: da cosa restituisce questa funzione dipendono i comandi che
 * compaiono a schermo. Finche' viveva in un `useMemo` dentro un componente da
 * tremila righe non era verificabile, e proprio quella riga era stata la falla:
 * i permessi personalizzati venivano presi dall'array `employees` dello stato
 * applicativo, che ogni membro puo' riscrivere per intero con il proprio token.
 * Un dipendente si concedeva `tasks.edit_any` da solo e l'interfaccia gli
 * credeva.
 *
 * Ora la fonte e' `organization_members.custom_permissions`: la scrive solo la
 * rotta dei membri, da amministratore, e il trigger della 0028 impedisce a
 * chiunque di cambiare le PROPRIE.
 *
 * Il primo tentativo l'aveva messa su `profiles`, dove nessuno puo' toccare
 * la propria — ma `profiles` ha una riga per persona, non una per
 * organizzazione, quindi una deroga concessa in un'azienda seguiva la persona
 * in tutte le altre. La 0028 l'ha spostata sull'appartenenza, che e' l'unica
 * riga che sa dire "questa persona, QUI".
 */

/** Il database ha un ruolo 'owner' in piu' rispetto al tipo UserRole della UI. */
export function ruoloInterfaccia(orgRole: string | null | undefined): UserRole {
  switch (orgRole) {
    case 'owner':
    case 'admin':
      return 'admin';
    case 'manager':
      return 'manager';
    case 'viewer':
      return 'viewer';
    default:
      return 'member';
  }
}

/**
 * Le deroghe ai permessi, cosi' come stanno sul database.
 *
 * Il valore e' jsonb e potrebbe contenere qualunque cosa: si accetta solo un
 * oggetto, tutto il resto vale come "nessuna deroga". La forma fine la
 * garantisce la rotta che scrive (api/_lib/permessiPersonalizzati.ts).
 */
export function derogheDalProfilo(valore: unknown): DeroghePermessi | undefined {
  if (!valore || typeof valore !== 'object' || Array.isArray(valore)) return undefined;
  return Object.keys(valore).length > 0 ? (valore as DeroghePermessi) : undefined;
}

/** Il profilo letto all'accesso, nei soli campi che servono qui. */
export interface ProfiloPerDipendente {
  job_title?: string | null;
  email?: string | null;
  departments?: string[] | null;
  status?: 'active' | 'inactive' | null;
  team_lead?: boolean | null;
}

export interface IngressoDipendenteCorrente {
  userId: string;
  /** Nome e immagine gia' risolti dal chiamante (profilo, oppure email). */
  nome: string;
  avatar: string;
  emailAccesso?: string;
  profilo: ProfiloPerDipendente | null | undefined;
  /** Il ruolo NELL'organizzazione corrente, letto da organization_members. */
  orgRole: string | null | undefined;
  /**
   * Le deroghe NELL'organizzazione corrente, dalla stessa riga del ruolo.
   *
   * Prima venivano da `profiles.custom_permissions`, che non sa distinguere
   * le organizzazioni: una deroga concessa in un'azienda seguiva la persona
   * in tutte le altre (0028).
   */
  orgDeroghe: unknown;
  /** L'anagrafica applicativa: comoda, ma non e' una fonte di autorizzazione. */
  employees: Employee[] | null | undefined;
  /** Data di creazione dell'account, per la voce "membro dal". */
  creatoIl?: string | null;
}

export function dipendenteCorrente({
  userId,
  nome,
  avatar,
  emailAccesso,
  profilo,
  orgRole,
  orgDeroghe,
  employees,
  creatoIl,
}: IngressoDipendenteCorrente): Employee {
  /*
    Le deroghe vengono SEMPRE dall'appartenenza, mai dalla copia in
    `employees`.

    E' una sostituzione e non una fusione: se l'appartenenza non ne ha, chi
    guarda non ne ha, anche quando l'array ne porta. L'array arriva da una
    chiave che ogni membro puo' riscrivere, quindi in fatto di permessi non ha
    voce.

    E vengono dall'APPARTENENZA e non dal profilo (0028): il profilo e' uno
    solo per persona, quindi una deroga scritta li' valeva in ogni
    organizzazione a cui quella persona appartiene — comprese quelle dove
    nessuno gliel'aveva concessa.
  */
  const deroghe = derogheDalProfilo(orgDeroghe);

  const esistente = (employees || []).find((e) => e.id === userId);
  if (esistente) {
    /*
      Non basta sostituire le deroghe: anche `userRole` e `status` devono
      venire dalla fonte attendibile, non dall'array.

      La prima versione di questo ramo sostituiva le sole `customPermissions`
      e lasciava passare il resto della riga. Ma `userRole` e' proprio il
      campo su cui `getEmployeePermissions` costruisce tutta la matrice, e
      `status` decide se l'account e' attivo: entrambi arrivavano da
      `app_state.employees`, cioe' da una chiave che ogni membro puo'
      riscrivere per intero con il proprio token. Chi si metteva
      `"userRole": "admin"` nella propria riga si vedeva comparire i pannelli
      amministrativi — non i dati, che le policy continuano a negare, ma i
      comandi si'. `useSyncEmployees` rimargina l'array poco dopo, e proprio
      per questo il buco era difficile da vedere: dura una frazione di
      secondo, tranne quando la lettura dei membri fallisce, e allora dura
      tutta la sessione.

      Dell'array resta cio' per cui esiste: l'anagrafica (nome, reparto,
      competenze, immagine). Delle autorizzazioni non ha voce, come per le
      deroghe.
    */
    return {
      ...esistente,
      userRole: ruoloInterfaccia(orgRole),
      status: profilo?.status ?? esistente.status,
      teamLead: profilo?.team_lead ?? false,
      customPermissions: deroghe,
    };
  }

  return {
    id: userId,
    name: nome,
    avatar,
    role: profilo?.job_title || 'User',
    userRole: ruoloInterfaccia(orgRole),
    email: profilo?.email ?? emailAccesso ?? undefined,
    departments: profilo?.departments ?? [],
    department: profilo?.departments?.[0],
    status: profilo?.status ?? 'active',
    joinedDate: creatoIl ?? new Date().toISOString(),
    teamLead: profilo?.team_lead ?? false,
    customPermissions: deroghe,
  };
}
