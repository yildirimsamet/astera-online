import { z } from 'zod';

export const ANALYTICS_CHOICE_EVENT = 'astera:player-analytics-choice';
export const ANALYTICS_TRAINING_STORAGE_KEY = 'astera.school-observation.v1';
const KEY = 'astera.player-analytics.choice';
const choice = z.object({ version: z.literal(1), decision: z.enum(['granted', 'denied']) }).strict();
export function analyticsChoice(): 'granted' | 'denied' | null {
  try {
    const parsed = choice.safeParse(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
    return parsed.success ? parsed.data.decision : null;
  } catch { return null; }
}
export function chooseAnalytics(decision: 'granted' | 'denied'): void {
  if (decision === 'denied') {
    try { localStorage.removeItem(ANALYTICS_TRAINING_STORAGE_KEY); } catch { /* Optional observation identity. */ }
  }
  try { localStorage.setItem(KEY, JSON.stringify({ version: 1, decision })); } catch { /* Choice still applies to this page. */ }
  window.dispatchEvent(new CustomEvent(ANALYTICS_CHOICE_EVENT, { detail: decision }));
}
export const analyticsAvailable = (): boolean => import.meta.env.VITE_ASTERA_PLAYER_ANALYTICS === '1';
