/**
 * Preferenze di notifica del DESTINATARIO, applicate all'invio delle email.
 *
 * L'interfaccia dei modelli email dice, testualmente, che "le email di notifica
 * partono solo se sono attive nelle preferenze di notifica dell'utente". Non
 * era vero: nessuno le guardava. Chi disattivava le email continuava a
 * riceverle, e l'interruttore nelle preferenze non spegneva niente.
 *
 * Il controllo non poteva stare nel client di chi assegna il task: le
 * preferenze sono in `user_state`, che le policy RLS rendono leggibile solo al
 * proprietario. Il mittente non puo' sapere cosa ha disattivato il
 * destinatario. Sul server, con il service role, si puo' — ed e' lo stesso
 * motivo per cui li' si legge anche la lingua.
 *
 * Le notifiche in applicazione e quelle desktop restano filtrate sul client di
 * chi le riceve (vedi `App.tsx`): li' il dato e' leggibile e il filtro serve
 * prima del suono. Qui si filtra solo l'email.
 */

import { preferisceRiepilogo } from './digest.js';

/** Non entra nel merito del tipo: gli piace qualunque chiave dei modelli. */
export interface EsitoPreferenze {
  /** Falso quando il destinatario ha disattivato questa email. */
  consentito: boolean;
  /** Il motivo, per il registro degli invii: serve a spiegare un non-invio. */
  motivo?: 'email disattivate' | 'tipo disattivato' | 'riepilogo giornaliero';
}

/**
 * Decide se spedire, partendo dal contenuto grezzo di `user_state`.
 *
 * In caso di dubbio si spedisce. Le preferenze possono essere assenti (utente
 * che non le ha mai aperte, ed e' il caso piu' comune), malformate, o salvate
 * da una versione precedente del client: interpretare quel silenzio come "non
 * vuole email" spegnerebbe le notifiche a tutti quelli che non hanno mai
 * toccato la schermata. Il valore predefinito dell'interfaccia e' "attive", e
 * questa funzione lo rispecchia.
 */
export function puoRicevereEmail(valore: unknown, tipo: string): EsitoPreferenze {
  if (!valore || typeof valore !== 'object' || Array.isArray(valore)) {
    return { consentito: true };
  }

  const preferenze = valore as Record<string, unknown>;

  // Solo un `false` esplicito spegne: un campo assente o di tipo sbagliato
  // non e' una scelta dell'utente.
  if (preferenze.emailNotifications === false) {
    return { consentito: false, motivo: 'email disattivate' };
  }

  /**
   * Chi ha scelto il riepilogo giornaliero non riceve le email evento per
   * evento: le sue notifiche le raccoglie il lavoro pianificato del digest e
   * le spedisce in un messaggio solo. Senza questo controllo il riepilogo
   * sarebbe posta in PIU', non in meno — cioe' l'opposto del motivo per cui
   * esiste.
   *
   * Sta DOPO `emailNotifications` e PRIMA del filtro per tipo: chi ha spento
   * del tutto la posta non deve comparire come "riepilogo" nel registro, e
   * una volta deciso che l'email non parte, il tipo non serve piu'.
   *
   * Non tocca le notifiche in applicazione, che restano immediate: qui si
   * filtra solo l'email.
   */
  if (preferisceRiepilogo(valore)) {
    return { consentito: false, motivo: 'riepilogo giornaliero' };
  }

  const perTipo = preferenze.enabledNotifications;
  if (perTipo && typeof perTipo === 'object' && !Array.isArray(perTipo)) {
    if ((perTipo as Record<string, unknown>)[tipo] === false) {
      return { consentito: false, motivo: 'tipo disattivato' };
    }
  }

  return { consentito: true };
}

/** La chiave di `user_state` che contiene le preferenze di una persona. */
export function chiavePreferenze(userId: string): string {
  return `notification-preferences-${userId}`;
}
