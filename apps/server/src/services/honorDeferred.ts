import type { Tx } from '../db/client.js';
import { beforeCommit } from '../db/finalizers.js';
import { honorEvidenceSchema, honorEventKey, type HonorEvidence } from './honorAccounting.js';
import { settleHonor } from './honorLedger.js';

const pending = new WeakMap<Tx, Map<string, HonorEvidence[]>>();

/** Preserve evidence now; acquire accounting locks only after the gameplay callback finishes. */
export function deferHonor(tx: Tx, seasonId: string, value: unknown): void {
  const evidence = honorEvidenceSchema.parse(value);
  let seasons = pending.get(tx);
  if (!seasons) {
    seasons = new Map();
    pending.set(tx, seasons);
    const work = seasons;
    beforeCommit(tx, 'honor', async () => {
      try {
        for (const [id, events] of [...work].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
          events.sort((a, b) => {
            const left = honorEventKey(a), right = honorEventKey(b);
            return a.at - b.at || (left < right ? -1 : left > right ? 1 : 0);
          });
          for (const event of events) await settleHonor(tx, id, event);
        }
      } finally {
        pending.delete(tx);
      }
    }, 'accounting');
  }
  const events = seasons.get(seasonId) ?? [];
  events.push(evidence);
  seasons.set(seasonId, events);
}
