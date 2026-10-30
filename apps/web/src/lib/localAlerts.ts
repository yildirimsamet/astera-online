/**
 * FREE QUEUE ALERTS ON THE PHONE. Owner 2026-10-30, docs/bildirim-merkezi-plani-2026-10-30.md
 * (decision 3): a finished build, research, ship order or a fleet back home is scheduled on
 * the device itself — no server, no charge — and dropped when the order stops being due.
 *
 * Pure: the queues in, the alerts that should exist out. The native adapter reconciles the
 * phone against this list, so a cancelled or paused order simply stops appearing in it.
 */
export type LocalAlertCategory = 'build' | 'research' | 'ships' | 'fleet';
export const LOCAL_ALERT_CATEGORIES = ['build', 'research', 'ships', 'fleet'] as const satisfies readonly LocalAlertCategory[];
export type LocalAlertPrefs = Record<LocalAlertCategory, boolean>;

/** Soonest first; a long queue must not flood the phone or the OS alarm budget. */
export const LOCAL_ALERT_LIMIT = 24;

interface Timed { id: string; finishesAt?: Date; pausedAt?: Date }
export interface LocalAlertWorld {
  id: string;
  name: string;
  construction: readonly (Timed & { kind: string; subject: string })[];
  yard: readonly (Timed & { subject: string; count: number })[];
  research: readonly (Timed & { projectId: string })[];
}
export interface LocalAlertInput {
  now: number;
  prefs: LocalAlertPrefs;
  worlds: readonly LocalAlertWorld[];
  pending: readonly { id?: string; kind: string; leg?: 'outbound' | 'return'; arriveAt: Date }[];
}
export interface LocalAlert {
  /** Android wants a 32-bit int; derived from `key` so a reschedule replaces, never duplicates. */
  id: number;
  key: string;
  category: LocalAlertCategory;
  at: number;
  world?: string;
  subject?: string;
  count?: number;
}

/** FNV-1a, folded to a positive 31-bit int. */
export function localAlertId(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 0x01000193);
  return (hash >>> 1) || 1;
}

export function planLocalAlerts({ now, prefs, worlds, pending }: LocalAlertInput): LocalAlert[] {
  const alerts: Omit<LocalAlert, 'id'>[] = [];
  const due = (order: Timed): number | null =>
    order.finishesAt && !order.pausedAt && order.finishesAt.getTime() > now ? order.finishesAt.getTime() : null;
  for (const world of worlds) {
    for (const order of world.construction) {
      const at = due(order);
      const category = order.kind === 'RESEARCH' ? 'research' : 'build';
      if (at !== null) alerts.push({ key: `${category}:${order.id}`, category, at, world: world.name, subject: order.subject });
    }
    for (const order of world.yard) {
      const at = due(order);
      if (at !== null) alerts.push({ key: `ships:${order.id}`, category: 'ships', at, world: world.name, subject: order.subject, count: order.count });
    }
    for (const order of world.research) {
      const at = due(order);
      if (at !== null) alerts.push({ key: `research:${order.id}`, category: 'research', at, world: world.name, subject: order.projectId });
    }
  }
  // Your own craft on its way home; an inbound thread carries no id and is the Merkez's business.
  for (const thread of pending) {
    if (thread.kind === 'incoming' || thread.leg !== 'return' || !thread.id) continue;
    const at = thread.arriveAt.getTime();
    if (at > now) alerts.push({ key: `fleet:${thread.id}`, category: 'fleet', at });
  }
  // The research queue is the commander's, so every world's view repeats it.
  const seen = new Set<string>();
  return alerts
    .filter(alert => {
      if (!prefs[alert.category] || seen.has(alert.key)) return false;
      seen.add(alert.key);
      return true;
    })
    .sort((a, b) => a.at - b.at)
    .slice(0, LOCAL_ALERT_LIMIT)
    .map(alert => ({ ...alert, id: localAlertId(alert.key) }));
}
