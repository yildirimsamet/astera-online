import { z } from 'zod';
import type { NotificationView } from '../api/schemas.js';
import { observe } from '../lib/playerAnalytics/runtime.js';

const serverId = z.string().uuid();

/**
 * RESULTS THE PLAYER WAS JUST SHOWN, under the id the server recorded them by (plan 2026-11-08 F1:
 * order → result → viewed). A toast on screen and a feed opened are the two places news is read.
 */
export function observeOutcomes(notes: readonly Pick<NotificationView, 'kind' | 'refId'>[], surface: 'signals' | 'toast'): void {
  for (const { kind, refId } of notes) {
    if (refId != null && serverId.safeParse(refId).success) observe('outcome_visible', { refId, surface, code: kind }, 'live');
  }
}
