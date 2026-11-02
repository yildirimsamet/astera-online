import type { StreamEvent } from './bus.js';

/**
 * THE KINDS THAT FIRE ALL DAY. Each one sends a client to read `/api/galaxy/traffic`
 * and the field, the cheap reads, and they are most of a galaxy's events. Everything
 * rarer keeps its instant: a rollover, a capture, a strike, a shield. Those send every
 * client to `/api/galaxy` and cost far more each, and a gate would not help them: its
 * first frame goes out at once. A shield was a handful a day for 48 active commanders
 * on 2026-11-02; if that grows, it wants the heavy lane instead. What happens TO a
 * commander is on their own topic and never comes here.
 *
 * A KNOWN COST, ACCEPTED BY THE OWNER (2026-11-02): in a busy galaxy a commander can
 * hear of somebody else's wreck up to six seconds after another did. See `docs/capacity-fix-plan-2026-10-31.md`.
 */
const ACTIVITY: ReadonlySet<string> = new Set(['shard:launch', 'shard:arrival', 'shard:mining', 'shard:pirate']);

export const isGalaxyActivity = (kind: string): boolean => ACTIVITY.has(kind);

/**
 * ONE CONNECTION'S RATE OF GALAXY ACTIVITY. Capacity fix plan (2026-11-02).
 *
 * The first event after a quiet gap goes out at once, so a quiet galaxy stays instant.
 * What follows inside the gap is held, once per kind, and goes out when it ends: a
 * frame says only "this happened, go and read", so one says all of a burst, and the
 * last event is never lost. The gap is at least as long as the client's traffic poll,
 * which already keeps a busy galaxy that fresh. A fifth of it is random, because every
 * connection heard the same first event at the same instant and must not read together.
 */
export function activityGate(
  deliver: (event: StreamEvent) => void,
  gapMs: number,
  random: () => number = Math.random,
) {
  const held = new Map<string, StreamEvent>();
  let opensAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const closeFor = (now: number): void => { opensAt = now + gapMs + random() * gapMs * 0.2; };

  return {
    note(event: StreamEvent): void {
      const now = Date.now();
      if (timer === undefined && now >= opensAt) {
        closeFor(now);
        deliver(event);
        return;
      }
      held.set(event.kind, event);
      timer ??= setTimeout(() => {
        timer = undefined;
        closeFor(Date.now());
        const due = [...held.values()];
        held.clear();
        for (const each of due) deliver(each);
      }, Math.max(0, opensAt - now));
    },
    /** When the stream ends. A held frame must not outlive its socket. */
    cancel(): void {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      held.clear();
    },
  };
}
