import { createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import type { Db, Tx } from '../db/client.js';
import { requestLog } from '../db/schema.js';
import { GameError } from './planet.js';

const COMMITTED_GAME_ERROR = '__asteraCommittedGameError' as const;

interface CommittedGameError {
  [COMMITTED_GAME_ERROR]: {
    code: string;
    message: string;
    status: number;
    params?: GameError['params'];
  };
}

/**
 * Return an API refusal after the surrounding idempotent transaction commits.
 *
 * A few state-machine commands must persist a repair they discover and still tell
 * the caller why the requested action did not happen. Throwing inside the callback
 * would roll that repair back. The marker is stored with the idempotency response,
 * then converted back to the same GameError only after commit (and on every replay).
 */
export function commitGameError(error: GameError): never {
  return {
    [COMMITTED_GAME_ERROR]: {
      code: error.code,
      message: error.message,
      status: error.status,
      params: error.params,
    },
  } as never;
}

const isCommittedGameError = (value: unknown): value is CommittedGameError =>
  typeof value === 'object' && value !== null && COMMITTED_GAME_ERROR in value;

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
    onOutcome?: (outcome: 'accepted' | 'replay') => void;
  },
  mutate: (tx: Tx) => Promise<T>,
): Promise<T> {
  const hash = requestHash(input.body);
  const scope = `idem:${input.playerId}:${input.operation}:${input.key}`;
  let outcome: 'accepted' | 'replay' = 'accepted';
  const response = await db.transaction(async (tx) => {
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
      outcome = 'replay';
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
  if (isCommittedGameError(response)) {
    const error = response[COMMITTED_GAME_ERROR];
    throw new GameError(error.code, error.message, error.status, error.params);
  }
  // Observe only after the transaction commits. A failed mutation or insert is
  // neither an accepted command nor a replay and must not inflate success data.
  input.onOutcome?.(outcome);
  return response;
}
