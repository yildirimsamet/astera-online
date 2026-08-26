import { createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import type { Db, Tx } from '../db/client.js';
import { requestLog } from '../db/schema.js';
import { GameError } from './planet.js';

const canonicalJson = (value: unknown): string => {
  if (value === undefined) return '"__undefined__"';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(object[key])}`
  )).join(',')}}`;
};

export const requestHash = (body: unknown): string => createHash('sha256')
  .update(canonicalJson(body))
  .digest('hex');

/**
 * Exactly-once response semantics for mobile retries. The advisory lock is only a
 * wait queue; the scoped unique index remains the authority if the hash collides.
 */
export async function idempotentMutation<T>(
  db: Db,
  input: {
    playerId: string;
    operation: string;
    key: string;
    body: unknown;
    now: Date;
  },
  mutate: (tx: Tx) => Promise<T>,
): Promise<T> {
  const hash = requestHash(input.body);
  const scope = `idem:${input.playerId}:${input.operation}:${input.key}`;
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${scope}))`);
    const [existing] = await tx
      .select({ requestHash: requestLog.requestHash, response: requestLog.response })
      .from(requestLog)
      .where(and(
        eq(requestLog.playerId, input.playerId),
        eq(requestLog.operation, input.operation),
        eq(requestLog.idempotencyKey, input.key),
      ))
      .limit(1);
    if (existing) {
      if (existing.requestHash !== hash) {
        throw new GameError(
          'IDEMPOTENCY_CONFLICT',
          'That retry key was already used for different input',
          409,
        );
      }
      return existing.response as T;
    }

    const response = await mutate(tx);
    // Clan contracts use JSON wire types (ISO strings, never Date instances), so
    // the first response and a replay have precisely the same shape.
    const serialisable = JSON.parse(JSON.stringify(response)) as T;
    await tx.insert(requestLog).values({
      idempotencyKey: input.key,
      playerId: input.playerId,
      operation: input.operation,
      requestHash: hash,
      response: serialisable,
      createdAt: input.now,
    });
    return serialisable;
  });
}
