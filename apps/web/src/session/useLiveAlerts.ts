import { useEffect, useRef } from 'react';
import { useNotifications } from '../api/queries.js';
import { describeNotification, isAlarming, isThreat, isUrgent } from '../lib/notifications.js';
import { useToast } from '../ui/Toast.js';
import { serverNow } from '../lib/clock.js';
import { attentionIsQuiet, useAttentionQuiet } from '../shell/attention/store.js';
import { observeOutcomes } from './outcomeVisible.js';
import i18n from '../i18n/index.js';

/**
 * Events that arrive while the player is actually looking.
 *
 * THE FIRST SNAPSHOT IS SWALLOWED ON PURPOSE. Everything unseen at that moment is
 * news from BEFORE this session, and it is already stated where news belongs: the
 * beacon in the header is lit and carries the count, and Signals holds every line
 * in full. Replaying it as a stack of toasts on the way in would recreate exactly
 * the interruption D23 deleted the return overlay to be rid of.
 *
 * It marks nothing READ — that belongs to the one surface a player actually reads
 * them on. Marking them on load meant the unread count was always zero, which is
 * the same as not having one.
 */

/**
 * At most three, urgent first.
 *
 * One toast is on screen at a time for four seconds, so six of them is
 * twenty-four seconds of a queue the player cannot skip — and the tail of it is
 * the least important news, arriving long after the moment it belonged to.
 * Everything dropped here is still in Signals, still unread, still counted.
 */
const MAX_TOASTS = 3;

export function useLiveAlerts(enabled: boolean): void {
  const { data } = useNotifications(enabled);
  const say = useToast();
  const primed = useRef(false);
  const announced = useRef(new Set<string>());
  const heldEvents = useRef(0);
  const quietNow = useAttentionQuiet();

  // Plan 2026-11-20 §5.5 & Faz 1: galaxy-event alerts held during a quiet lock arrive once, batched.
  useEffect(() => {
    if (!enabled || quietNow || heldEvents.current <= 0) return;
    const count = heldEvents.current;
    heldEvents.current = 0;
    say(i18n.t('starter.scenario.batchedEvents', { count }), 'info');
  }, [enabled, quietNow, say]);

  useEffect(() => {
    if (!enabled || !data) return;
    const unseen = data.notifications.filter((n) => !n.seen);

    if (!primed.current) {
      primed.current = true;
      for (const n of unseen) announced.current.add(n.id);
      return;
    }

    const fresh = unseen.filter((n) => !announced.current.has(n.id));
    if (fresh.length === 0) return;
    // Every one of them is marked announced, including the ones that will not be
    // shown — a toast dropped for room must not reappear on the next refetch.
    for (const n of fresh) announced.current.add(n.id);

    /**
     * URGENT FIRST, THEN NEWEST FIRST.
     *
     * The list arrives newest-first and this used to walk it straight into a toast
     * component that held ONE message — so the last call won, and the last call
     * was the OLDEST item in the batch. Two things landing in the same second
     * showed the less important one. An inbound fleet losing its toast to a mining
     * run that got home is the exact failure the whole surface exists to prevent.
     */
    // A window or the landing scenario has the screen: only a threat interrupts it. Galaxy-event
    // starts held during the lock are summarised once when the lock lifts; the rest waits in Signals.
    const quiet = attentionIsQuiet();
    if (quiet) {
      for (const n of fresh) {
        if (n.kind === 'galaxy_event_started') heldEvents.current += 1;
      }
    }
    const ordered = fresh.filter((n) => !quiet || isThreat(n)).sort((a, b) => {
      if (isUrgent(a) !== isUrgent(b)) return isUrgent(a) ? -1 : 1;
      return b.at.getTime() - a.at.getTime();
    });

    const now = serverNow();
    const readable = ordered.map(n => ({ n, line: describeNotification(n, now) }))
      .filter((entry): entry is { n: typeof entry.n; line: string } => entry.line !== null);
    const shown = readable.slice(0, MAX_TOASTS);
    for (const { n, line } of shown) {
      say(line, isAlarming(n) ? 'error' : 'info');
    }
    observeOutcomes(shown.map(({ n }) => n), 'toast');
  }, [data, enabled, say]);
}
