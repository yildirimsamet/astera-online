import type { Tx } from './client.js';

type FinalizerPhase = 'gameplay' | 'accounting' | 'cosmetic';
const pending = new WeakMap<Tx, Map<string, { action: () => Promise<void>; phase: FinalizerPhase }>>();
const running = new WeakSet<Tx>();

/** Same transaction, after its action callback: accounting may then take its final lock. */
export function beforeCommit(tx: Tx, key: string, action: () => Promise<void>, phase: FinalizerPhase = 'gameplay'): void {
  if (running.has(tx)) throw new Error('A finalizer cannot schedule more transaction work');
  const actions = pending.get(tx) ?? new Map<string, { action: () => Promise<void>; phase: FinalizerPhase }>();
  if (actions.has(key)) throw new Error('Duplicate transaction finalizer');
  actions.set(key, { action, phase });
  pending.set(tx, actions);
}

export async function flushBeforeCommit(tx: Tx): Promise<void> {
  const actions = pending.get(tx);
  if (!actions) return;
  pending.delete(tx);
  running.add(tx);
  try {
    // Journal locks are last even if radiation evidence queued accounting first.
    for (const phase of ['gameplay', 'accounting', 'cosmetic'] as const) {
      for (const work of actions.values()) if (work.phase === phase) await work.action();
    }
  } finally {
    running.delete(tx);
  }
}
