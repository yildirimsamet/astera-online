import type { MiningRun, PendingThread } from '../api/schemas.js';
import { runArrival } from './flights.js';

/** The five tabs, in the one order they ever appear in. Spec B4, K1. */
export const DOCK_TABS = ['galaxy', 'base', 'fleet', 'intel', 'clan'] as const;
export type DockTab = (typeof DOCK_TABS)[number];

/** A fight or a probe: the signals that leave a report behind in Intel. */
const REPORTS: ReadonlySet<string> = new Set([
  'raided',
  'raid_result',
  'death_star_result',
  'strategic_intercepted',
  'probe_report',
]);

export const isReportSignal = (kind: string): boolean => REPORTS.has(kind);

export interface DockInput {
  /** Server time. */
  now: number;
  threads: readonly PendingThread[];
  runs: readonly MiningRun[];
  /** The works hold enough to be worth collecting (`collectState().ripe`). */
  collectRipe: boolean;
  /** Broken things on the active world. */
  faults: number;
  unseenReports: number;
  /** What the clan needs from you (`useClanBadge().attentionCount`). */
  clanAttention: number;
}

export interface DockBadges {
  base: boolean;
  /** How many of your own craft are up, and how far the soonest is toward landing (0–1), if it has a span. */
  fleet: { airborne: number; progress: number | null };
  intel: number;
  clan: number;
}

interface Span { from: number; to: number }

const runSpan = (run: MiningRun): Span | null => {
  if (run.status === 'returning') return run.homeAt ? { from: run.arriveAt.getTime(), to: run.homeAt.getTime() } : null;
  return { from: run.departAt.getTime(), to: run.arriveAt.getTime() };
};

/**
 * WHAT THE DOCK SAYS WITHOUT BEING OPENED. Spec B4.
 *
 * An enemy is never counted in Fleet: it is not yours, and it has the Now line
 * and the context slot to itself. The ring follows whichever of your craft lands
 * first, because that is the next thing that will happen to you.
 */
export function dockBadges(input: DockInput): DockBadges {
  const own = [
    ...input.threads
      .filter((thread) => thread.kind !== 'incoming')
      .map((thread) => ({
        at: thread.arriveAt.getTime(),
        span: thread.path ? { from: thread.path.departAt.getTime(), to: thread.path.arriveAt.getTime() } : null,
      })),
    ...input.runs
      .filter((run) => run.status !== 'done')
      .map((run) => ({ at: runArrival(run), span: runSpan(run) })),
  ].sort((a, b) => a.at - b.at);

  const next = own[0]?.span ?? null;
  const progress = next && next.to > next.from
    ? Math.max(0, Math.min(1, (input.now - next.from) / (next.to - next.from)))
    : null;

  return {
    base: input.collectRipe || input.faults > 0,
    fleet: { airborne: own.length, progress },
    intel: input.unseenReports,
    clan: input.clanAttention,
  };
}
