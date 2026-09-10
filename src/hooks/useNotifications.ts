import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { TaskNotification } from '@/lib/types';

/**
 * Esito dell'inserimento di una notifica.
 *
 * Tre valori e non un booleano: "duplicata" e "fallita" portano a decisioni
 * opposte in chi chiama, e un `false` solo le confonderebbe.
 */
export type EsitoNotifica = 'creata' | 'duplicata' | 'fallita';

/**
 * Notifiche del solo utente corrente, lette dalla tabella public.notifications.
 *
 * Perche' non stanno piu' in app_state: li' erano un unico blob JSON per
 * organizzazione, e la policy di app_state lo rende leggibile a QUALUNQUE
 * membro. Il filtro "solo le mie" viveva nell'interfaccia, quindi bastava una
 * GET diretta a PostgREST per leggere le notifiche di tutti i colleghi. Con la
 * tabella, il filtro e' la policy `user_id = auth.uid()`: nessun client puo'
 * scavalcarlo, perche' non e' scritto nel client.
 *
 * La deduplica e' passata dalla memoria al database (indice unico su
 * organization_id + event_key, vedi 0009): due schede con copie diverse dello
 * stato non possono piu' generare la stessa notifica due volte, che era
 * esattamente il difetto osservato in produzione.
 */

interface NotificationRow {
  id: string;
  user_id: string;
  task_ref: string | null;
  task_title: string | null;
  type: string;
  message: string;
  action_by: string | null;
  action_by_name: string | null;
  action_by_avatar: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

function rowToNotification(row: NotificationRow): TaskNotification {
  return {
    // L'id esposto all'interfaccia e' quello della RIGA (uuid): e' cio' con
    // cui si marca letta o si elimina. L'id deterministico dell'evento vive
    // nella colonna event_key e serve solo alla deduplica.
    id: row.id,
    userId: row.user_id,
    taskId: row.task_ref ?? '',
    taskTitle: row.task_title ?? '',
    type: row.type as TaskNotification['type'],
    message: row.message,
    actionBy: row.action_by ?? undefined,
    actionByName: row.action_by_name ?? undefined,
    actionByAvatar: row.action_by_avatar ?? undefined,
    link: row.link ?? undefined,
    read: row.read,
    createdAt: row.created_at,
  };
}

export function useNotifications(onArrived?: (n: TaskNotification) => void) {
  const { user, organization } = useAuth();
  const [notifications, setNotifications] = useState<TaskNotification[]>([]);

  /**
   * Id gia' visti, per riconoscere cio' che arriva DOPO il primo caricamento.
   *
   * Suono e notifica desktop spettano al destinatario, non a chi scrive: chi
   * crea la notifica sta guardando un altro schermo. Prima venivano riprodotti
   * sul client del mittente, dove la condizione "e' per me" era praticamente
   * sempre falsa — quindi non suonavano quasi mai.
   */
  const idsNoti = useRef<Set<string> | null>(null);
  const onArrivedRef = useRef(onArrived);
  onArrivedRef.current = onArrived;

  const reload = useCallback(async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('notifications')
      .select(
        'id, user_id, task_ref, task_title, type, message, action_by, action_by_name, action_by_avatar, link, read, created_at'
      )
      .eq('user_id', user.id)
      /**
       * Le PIU' RECENTI, non le piu' vecchie.
       *
       * Con l'ordine crescente il limite prendeva le 200 notifiche piu'
       * antiche: superata quella soglia — poche settimane in un team attivo —
       * l'utente smetteva di vedere qualunque notifica nuova, e `idsNoti` non
       * riconosceva piu' nessun arrivo, quindi niente suono ne' notifica di
       * sistema. Non era un limite di scala futura: era gia' rotto a 200.
       */
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('[useNotifications] lettura fallita:', error.message);
      return;
    }

    // Rimesse in ordine cronologico: la query le chiede dalla piu' recente per
    // via del limite, ma il resto del codice e l'elenco a schermo le vogliono
    // dalla piu' vecchia.
    const lista = (data ?? [])
      .map((r) => rowToNotification(r as NotificationRow))
      .reverse();
    setNotifications(lista);

    // Primo caricamento: si popola l'elenco dei noti senza annunciare nulla,
    // altrimenti a ogni apertura dell'app suonerebbe tutto lo storico.
    if (idsNoti.current === null) {
      idsNoti.current = new Set(lista.map((n) => n.id));
      return;
    }

    const nuove = lista.filter((n) => !idsNoti.current!.has(n.id));
    idsNoti.current = new Set(lista.map((n) => n.id));
    for (const n of nuove) onArrivedRef.current?.(n);
  }, [user?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /**
   * Consegna in tempo reale. Le RLS valgono anche qui: il canale filtra per
   * user_id, e comunque il database non manderebbe righe che l'utente non puo'
   * leggere. Se la pubblicazione realtime non fosse attiva sul progetto, la
   * sottoscrizione semplicemente non riceve nulla e resta il caricamento
   * iniziale piu' la rilettura al rientro sulla scheda.
   */
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifiche-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void reload();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, reload]);

  // Una scheda lasciata aperta senza realtime resterebbe indietro.
  useEffect(() => {
    const onFocus = () => void reload();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [reload]);

  /** Esito dell'inserimento di una notifica. */
  /**
   * Inserisce la notifica; restituisce true solo se e' davvero nuova.
   *
   * Il chiamante usa l'esito per decidere se riprodurre il suono, mostrare la
   * notifica desktop e spedire l'email: un duplicato non deve rifare rumore.
   *
   * I tre esiti sono distinti perche' vogliono decisioni diverse. Un
   * duplicato e' il funzionamento previsto e non va annunciato di nuovo. Un
   * fallimento e' un guasto: la notifica in app non c'e', e proprio per
   * questo l'email diventa l'unico modo per avvisare la persona — trattarlo
   * come un duplicato la lascerebbe senza niente.
   */
  const addNotification = useCallback(
    async (notification: TaskNotification): Promise<EsitoNotifica> => {
      if (!organization?.id) return 'fallita';

      // INSERT semplice, non upsert, e senza .select().
      //
      // Due trappole, entrambe incontrate davvero:
      //   - `.select()` dopo l'inserimento aggiunge un RETURNING, soggetto
      //     alla policy di LETTURA (`user_id = auth.uid()`): la riga e' del
      //     destinatario, quindi Postgres rifiutava tutto con "new row
      //     violates row-level security policy";
      //   - `.upsert(..., onConflict)` fa valutare anche la policy di
      //     AGGIORNAMENTO, che vale solo sulle proprie notifiche: stesso
      //     rifiuto, pur trattandosi di un inserimento.
      //
      // Il duplicato si riconosce quindi dal codice 23505 dell'indice unico,
      // che e' la garanzia vera e vale per tutte le schede insieme.
      const { error } = await supabase
        .from('notifications')
        .insert(
          {
            organization_id: organization.id,
            user_id: notification.userId,
            task_ref: notification.taskId || null,
            task_title: notification.taskTitle ?? null,
            type: notification.type,
            message: notification.message,
            action_by: notification.actionBy ?? null,
            action_by_name: notification.actionByName ?? null,
            action_by_avatar: notification.actionByAvatar ?? null,
            link: notification.link ?? null,
            read: false,
            // L'id calcolato dall'app identifica l'EVENTO, non la riga.
            event_key: notification.id,
          }
        );

      if (error) {
        // 23505 = violazione di unicita': la notifica per questo evento c'e'
        // gia'. Non e' un guasto, e' esattamente cio' che si voleva impedire.
        if (error.code === '23505') return 'duplicata';
        console.error('[useNotifications] inserimento fallito:', error.message);
        return 'fallita';
      }

      if (notification.userId === user?.id) await reload();
      return 'creata';
    },
    [organization?.id, user?.id, reload]
  );

  const markAsRead = useCallback(
    async (id: string) => {
      setNotifications((current) =>
        current.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
      if (error) console.error('[useNotifications] aggiornamento fallito:', error.message);
    },
    []
  );

  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;
    setNotifications((current) => current.map((n) => ({ ...n, read: true })));
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);
    if (error) console.error('[useNotifications] aggiornamento fallito:', error.message);
  }, [user?.id]);

  const removeNotification = useCallback(async (id: string) => {
    setNotifications((current) => current.filter((n) => n.id !== id));
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) console.error('[useNotifications] eliminazione fallita:', error.message);
  }, []);

  const removeAllNotifications = useCallback(async () => {
    if (!user?.id) return;
    setNotifications([]);
    const { error } = await supabase.from('notifications').delete().eq('user_id', user.id);
    if (error) console.error('[useNotifications] eliminazione fallita:', error.message);
  }, [user?.id]);

  return {
    notifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    removeAllNotifications,
    reload,
  };
}
