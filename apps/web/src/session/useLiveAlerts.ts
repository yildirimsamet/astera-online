import { useEffect, useRef } from 'react';
import { useApi } from '../api/context.js';
import { useNotifications } from '../api/queries.js';
import { describeNotification } from '../lib/notifications.js';
import { useToast } from '../ui/Toast.js';

/**
 * Events that arrive while the player is actually looking.
 *
 * The first snapshot is swallowed on purpose: everything unseen at that moment
 * has already been told to the player by the return overlay, and repeating it as
 * a stack of toasts would make the most important screen in the game feel like a
 * duplicate.
 */
export function useLiveAlerts(enabled: boolean): void {
  const { data } = useNotifications();
  const api = useApi();
  const say = useToast();
  const primed = useRef(false);
  const announced = useRef(new Set<string>());

  useEffect(() => {
    if (!enabled || !data) return;
    const unseen = data.notifications.filter((n) => !n.seen);

    if (!primed.current) {
      primed.current = true;
      for (const n of unseen) announced.current.add(n.id);
      if (unseen.length > 0) void api.markSeen(unseen.map((n) => n.id));
      return;
    }

    const fresh = unseen.filter((n) => !announced.current.has(n.id));
    if (fresh.length === 0) return;

    for (const n of fresh) {
      announced.current.add(n.id);
      const line = describeNotification(n);
      if (line) say(line, n.kind === 'incoming_fleet' || n.kind === 'raided' ? 'error' : 'info');
    }
    void api.markSeen(fresh.map((n) => n.id));
  }, [data, enabled, api, say]);
}
