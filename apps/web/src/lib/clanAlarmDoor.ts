import { z } from 'zod';
import type { ClanAlarmCall } from './clanAlarm.js';

/**
 * THE BELL'S ROW OPENS THE SUPPORT SHEET (F2 E1). A window event, kept apart from `clanAlarm.ts`
 * so the pure reading of the payload stays importable where there is no window.
 */
const ALARM_DOOR = 'astera:clan-alarm';

export function openClanAlarm(call: ClanAlarmCall): void {
  window.dispatchEvent(new CustomEvent(ALARM_DOOR, { detail: call }));
}

const call = z.object({
  alarmId: z.string(), hostPlanetId: z.string(), hostPlanetName: z.string(),
  hostName: z.string().nullable(), arriveAt: z.date(),
});

export function subscribeClanAlarm(onOpen: (call: ClanAlarmCall) => void): () => void {
  const listener = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const parsed = call.safeParse(event.detail);
    if (parsed.success) onOpen(parsed.data);
  };
  window.addEventListener(ALARM_DOOR, listener);
  return () => { window.removeEventListener(ALARM_DOOR, listener); };
}
