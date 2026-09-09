import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useKV } from '@/hooks/useKV';
import type { Employee, UserRole } from '@/lib/types';

/**
 * Allinea la lista `employees` dell'app con i membri reali dell'organizzazione.
 *
 * Perche' serve: l'identita' vive in Supabase (organization_members + profiles),
 * mentre tutta la UI — in particolare il menu "Assign To" e le statistiche del
 * team — legge dall'array KV `employees`. I due insiemi non erano collegati,
 * quindi la lista restava vuota: nessun collega compariva fra gli assegnatari e
 * i task non potevano essere assegnati a nessuno.
 *
 * La sincronizzazione e' additiva: i campi gestiti dall'app (dipartimento,
 * competenze, permessi personalizzati...) non vengono toccati, si aggiornano
 * solo quelli che appartengono al profilo e al ruolo nell'organizzazione.
 */

/** Il database ha un ruolo 'owner' in piu' rispetto al tipo UserRole della UI. */
function mapOrgRole(role: string | null | undefined): UserRole {
  switch (role) {
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

interface MemberRow {
  role: string;
  user_id: string;
  profiles: {
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
    job_title: string | null;
    departments: string[] | null;
    status: string | null;
    team_lead: boolean | null;
    joined_date: string | null;
  } | null;
}

export function useSyncEmployees() {
  const { organization } = useAuth();
  const [employees, setEmployees] = useKV<Employee[]>('employees', []);

  useEffect(() => {
    if (!organization?.id) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('organization_members')
        .select(
          'role, user_id, profiles(id, email, full_name, avatar_url, job_title, departments, status, team_lead, joined_date)'
        )
        .eq('organization_id', organization.id);

      if (cancelled) return;

      if (error) {
        console.error('[useSyncEmployees] lettura membri fallita:', error.message);
        return;
      }

      const rows = (data ?? []) as unknown as MemberRow[];

      setEmployees((current) => {
        const existing = current ?? [];
        const byId = new Map(existing.map((e) => [e.id, e]));

        for (const row of rows) {
          const p = row.profiles;
          if (!p) continue;

          const previous = byId.get(p.id);
          const fromDb: Employee = {
            ...previous,
            id: p.id,
            name: p.full_name ?? p.email ?? 'Utente',
            avatar:
              p.avatar_url ??
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p.id)}`,
            email: p.email ?? undefined,
            role: p.job_title ?? previous?.role ?? 'Membro del team',
            userRole: mapOrgRole(row.role),
            // `profiles.departments` e' NOT NULL DEFAULT '{}', quindi non e'
            // mai null: il vecchio `??` non scattava mai e un array vuoto sul
            // database azzerava a ogni avvio i dipartimenti impostati
            // dall'interfaccia. Vuoto qui significa "il database non ha
            // un'opinione", non "nessun dipartimento".
            departments: p.departments?.length
              ? p.departments
              : previous?.departments ?? [],
            status: p.status === 'inactive' ? 'inactive' : 'active',
            teamLead: p.team_lead ?? previous?.teamLead ?? false,
            joinedDate: p.joined_date ?? previous?.joinedDate ?? new Date().toISOString(),
          };

          byId.set(p.id, fromDb);
        }

        const next = Array.from(byId.values());

        // Evita una scrittura (e un re-render) se non e' cambiato nulla.
        return JSON.stringify(next) === JSON.stringify(existing) ? existing : next;
      });
    })();

    return () => {
      cancelled = true;
    };
    // employees volutamente escluso: la sincronizzazione parte dal server e
    // includerlo creerebbe un ciclo aggiornamento -> effetto -> aggiornamento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id, setEmployees]);

  return employees ?? [];
}
