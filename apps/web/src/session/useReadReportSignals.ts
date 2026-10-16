import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { useMarkSeen, useNotifications } from '../api/queries.js';
import { isReportSignal } from '../lib/dock.js';

const supportRef = z.object({ reportId: z.string() });

/** Only successful, visible report surfaces acknowledge their own records.
 * Observe the shared feed without starting another request. A hidden mounted
 * list, failed read or background document must leave the badge untouched. */
export function useReadReportSignals(visible: boolean, refs: readonly string[]): void {
  const { data } = useNotifications(false);
  const { mutate } = useMarkSeen();
  const requested = useRef(new Set<string>());
  const [foreground, setForeground] = useState(() => document.visibilityState === 'visible');
  useEffect(() => {
    const update = () => { setForeground(document.visibilityState === 'visible'); };
    document.addEventListener('visibilitychange', update);
    return () => { document.removeEventListener('visibilitychange', update); };
  }, []);
  useEffect(() => {
    if (!visible || !foreground) {
      requested.current.clear();
      return;
    }
    const displayed = new Set(refs);
    const fresh = (data?.notifications ?? []).filter(note => {
      if (note.seen || requested.current.has(note.id)
        || !isReportSignal(note.kind)) return false;
      const support = note.kind === 'clan_support_result' ? supportRef.safeParse(note.payload) : null;
      return (note.refId != null && displayed.has(note.refId))
        || (support?.success === true && displayed.has(support.data.reportId));
    }).map(note => note.id);
    if (fresh.length === 0) return;
    fresh.forEach(id => requested.current.add(id));
    // Retain attempted ids until this surface closes; automatic retries belong
    // to the mutation. Reopening the surface retries failed acknowledgements.
    mutate(fresh);
  }, [visible, foreground, data, refs, mutate]);
}
