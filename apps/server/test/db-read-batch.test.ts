import { randomUUID } from 'node:crypto';
import { asc, desc, eq, getTableName, inArray, isTable, sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Sql } from 'postgres';
import { batching, batchReads } from '../src/db/readBatch.js';
import { AsyncCache } from '../src/services/asyncCache.js';
import { countStatements, createDb } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';
import { buildings, planets, players, seasons, units } from '../src/db/schema.js';
import { seedWorld, TEST_DATABASE_URL, testDb, type Fixture } from './helpers.js';

/**
 * READS ASKED FOR TOGETHER ARE ONE STATEMENT. Query plan, 2026-11-03.
 *
 * A planet view is 32 statements for a few KB, and most of what production's database
 * does is parse and answer them one by one. The services read with `Promise.all`, so
 * inside `batchReads` the reads of one turn of the event loop go out as one statement,
 * which is also one snapshot. No service changes its query or its result: that is the
 * whole contract, and most of this file holds it.
 */
const { db, close } = createDb(TEST_DATABASE_URL, { max: 1 });
let world: Fixture;
beforeAll(async () => { world = await seedWorld(2); });
afterAll(async () => { await close(); await (await testDb()).close(); });

const inScope = async <T>(run: () => Promise<T>) => {
  const scope = { statements: 0 };
  const result = await countStatements(scope, () => batchReads(run));
  return { result, statements: scope.statements };
};
/** A second read in the same turn forces the first through the batched path. */
const batched = async <T>(read: () => Promise<T>) => (await batchReads(async () => {
  const [result] = await Promise.all([read(), db.select({ one: sql<number>`1` }).from(seasons).limit(1)]);
  return { result };
})).result;
const compositesPrepared = async () => (await db.execute<{ count: number }>(
  sql`select count(*)::int as count from pg_prepared_statements where statement like '%json_agg(row(%' and statement not like '%pg_prepared_statements%'`))[0]!.count;

describe('what goes out', () => {
  it('sends the reads of one turn as one statement', async () => {
    const before = await compositesPrepared();
    const { result, statements } = await inScope(() => Promise.all([
      db.select().from(players).where(eq(players.id, world.playerIds[0]!)),
      db.select().from(planets).where(eq(planets.id, world.planetIds[0]!)),
      db.select().from(buildings).where(eq(buildings.planetId, world.planetIds[0]!)),
    ]));
    expect(statements).toBe(1);
    expect(await compositesPrepared()).toBe(before + 1);
    expect(result[0][0]!.id).toBe(world.playerIds[0]);
    expect(result[1][0]!.id).toBe(world.planetIds[0]);
    expect(result[2].every(row => row.planetId === world.planetIds[0])).toBe(true);
  });

  it('gathers reads that follow a shared read through different helpers', async () => {
    const helper = async (id: string) => {
      const [player] = await db.select({ id: players.id }).from(players).where(eq(players.id, id));
      return db.select().from(planets).where(eq(planets.controllerPlayerId, player!.id));
    };
    const { result, statements } = await inScope(() => Promise.all(world.playerIds.map(helper)));
    expect(statements).toBe(2);
    expect(result.map(rows => rows[0]!.controllerPlayerId)).toEqual(world.playerIds);
  });

  it('prepares one composite once, however often it runs', async () => {
    const read = () => inScope(() => Promise.all([
      db.select({ id: players.id, hp: sql<number>`41` }).from(players).limit(1),
      db.select({ id: planets.id, hp: sql<number>`42` }).from(planets).limit(1),
    ]));
    const before = await compositesPrepared();
    await read();
    await read();
    expect(await compositesPrepared()).toBe(before + 1);
  });

  it('does not prepare a composite that holds a long parameter list', async () => {
    const ids = Array.from({ length: 33 }, () => randomUUID());
    const before = await compositesPrepared();
    const { result } = await inScope(() => Promise.all([
      db.select({ id: players.id }).from(players).where(inArray(players.id, ids)),
      db.select({ id: planets.id }).from(planets).where(eq(planets.id, world.planetIds[0]!)),
    ]));
    expect(result[1]).toHaveLength(1);
    expect(await compositesPrepared()).toBe(before);
  });

  it('runs a lone read as itself', async () => {
    const before = await compositesPrepared();
    const { result, statements } = await inScope(async () => await db.select({ id: players.id }).from(players).where(eq(players.id, world.playerIds[0]!)));
    expect(statements).toBe(1);
    expect(result).toEqual([{ id: world.playerIds[0] }]);
    expect(await compositesPrepared()).toBe(before);
  });

  it('leaves everything outside a scope alone', async () => {
    const scope = { statements: 0 };
    await countStatements(scope, () => Promise.all([
      db.select({ id: players.id }).from(players).limit(1),
      db.select({ id: planets.id }).from(planets).limit(1),
    ]));
    expect(scope.statements).toBe(2);
  });

  it('keeps the requests of two scopes apart', async () => {
    const one = { statements: 0 };
    const two = { statements: 0 };
    const reads = () => Promise.all([
      db.select({ id: players.id }).from(players).limit(1),
      db.select({ id: planets.id }).from(planets).limit(1),
    ]);
    const [a, b] = await Promise.all([
      countStatements(one, () => batchReads(reads)),
      countStatements(two, () => batchReads(reads)),
    ]);
    expect(a).toEqual(b);
    expect([one.statements, two.statements]).toEqual([1, 1]);
  });

  it('keeps a transaction\'s reads on its own connection', async () => {
    const first = world.planetIds[0]!;
    const { result, statements } = await inScope(() => db.transaction(async tx => {
      await tx.update(planets).set({ alloy: sql`${planets.alloy} + 1` }).where(eq(planets.id, first));
      const [own, outsideShape] = await Promise.all([
        tx.select({ alloy: planets.alloy }).from(planets).where(eq(planets.id, first)),
        tx.select({ id: players.id }).from(players).limit(1),
      ]);
      tx.rollback();
      return [own, outsideShape];
    }).catch((error: unknown) => error));
    expect(result).toBeInstanceOf(Error);
    expect(statements).toBe(2);
    const stored = await db.select({ alloy: planets.alloy }).from(planets).where(eq(planets.id, first));
    expect(stored).toHaveLength(1);
  });

  it('shows a transaction its own writes', async () => {
    const first = world.planetIds[0]!;
    const seen = await batchReads(() => db.transaction(async tx => {
      const [{ alloy }] = await tx.select({ alloy: planets.alloy }).from(planets).where(eq(planets.id, first)) as [{ alloy: number }];
      await tx.update(planets).set({ alloy: alloy + 7 }).where(eq(planets.id, first));
      const [read] = await Promise.all([
        tx.select({ alloy: planets.alloy }).from(planets).where(eq(planets.id, first)),
        tx.select({ id: players.id }).from(players).limit(1),
      ]);
      await tx.update(planets).set({ alloy }).where(eq(planets.id, first));
      return { before: alloy, read: read[0]!.alloy };
    }));
    expect(seen.read).toBe(seen.before + 7);
  });
});

describe('what never joins a composite', () => {
  it('sends a row lock as itself, still locking', async () => {
    const first = world.planetIds[0]!;
    const { statements } = await inScope(() => db.transaction(tx => Promise.all([
      tx.select({ id: planets.id }).from(planets).where(eq(planets.id, first)).for('update'),
      tx.select({ id: players.id }).from(players).limit(1),
      tx.select({ id: seasons.id }).from(seasons).limit(1),
    ])));
    expect(statements).toBe(2);
  });

  it('sends a write as itself, in the order it was asked', async () => {
    const first = world.planetIds[0]!;
    const { statements } = await inScope(() => db.transaction(async tx => {
      const [row] = await tx.update(planets).set({ alloy: sql`${planets.alloy}` }).where(eq(planets.id, first)).returning({ id: planets.id });
      expect(row!.id).toBe(first);
    }));
    expect(statements).toBe(1);
  });

  it('sends a raw statement as itself', async () => {
    const { result, statements } = await inScope(() => Promise.all([
      db.execute<{ value: number }>(sql`select 5 as value`),
      db.execute<{ value: number }>(sql`select 6 as value`),
    ]));
    expect(result.map(rows => rows[0]!.value)).toEqual([5, 6]);
    expect(statements).toBe(0 + result.length);
  });
});

describe('what comes back', () => {
  it('keeps the order a read asked for', async () => {
    const ordered = () => db.select({ id: buildings.planetId, type: buildings.type }).from(buildings)
      .orderBy(desc(buildings.type), asc(buildings.planetId));
    expect(await batched(ordered)).toEqual(await ordered());
  });

  it('honours a limit and an offset', async () => {
    const page = () => db.select({ type: buildings.type }).from(buildings).orderBy(asc(buildings.type)).limit(3).offset(2);
    const answer = await batched(page);
    expect(answer).toEqual(await page());
    expect(answer).toHaveLength(3);
  });

  it('answers an empty read with no rows', async () => {
    expect(await batched(() => db.select().from(players).where(eq(players.id, randomUUID())))).toEqual([]);
  });

  it('tells columns of one name apart in a join', async () => {
    const joined = () => db.select({ playerId: players.id, planetId: planets.id, season: players.seasonId, planetSeason: planets.seasonId })
      .from(players).innerJoin(planets, eq(planets.controllerPlayerId, players.id));
    const answer = await batched(joined);
    expect(answer).toEqual(await joined());
    expect(answer[0]!.playerId).not.toBe(answer[0]!.planetId);
  });

  it('reads whole joined tables as the driver does', async () => {
    const joined = () => db.select().from(units).innerJoin(planets, eq(planets.id, units.planetId)).limit(5);
    expect(await batched(joined)).toEqual(await joined());
  });

  it('returns a left join\'s missing side as null', async () => {
    const joined = () => db.select({ id: players.id, planet: planets }).from(players)
      .leftJoin(planets, sql`false`).limit(1);
    const answer = await batched(joined);
    expect(answer).toEqual(await joined());
    expect(answer[0]!.planet).toBeNull();
  });

  it('does not take a dollar sign in a literal for a parameter', async () => {
    const dollars = () => db.select({ text: sql<string>`'$1 and $2'`, quoted: sql<string>`'it''s $1'`, id: players.id })
      .from(players).where(eq(players.id, world.playerIds[1]!));
    const answer = await batchReads(async () => (await Promise.all([
      db.select({ id: planets.id }).from(planets).where(eq(planets.id, world.planetIds[0]!)),
      dollars(),
    ]))[1]);
    expect(answer).toEqual([{ text: '$1 and $2', quoted: 'it\'s $1', id: world.playerIds[1] }]);
  });

  it('gives every read of a failed composite the failure, and the connection recovers', async () => {
    const failed = await batchReads(() => Promise.allSettled([
      db.select({ id: players.id }).from(players).limit(1),
      db.select({ broken: sql<number>`1 / (select 0)` }).from(players).limit(1),
    ]));
    expect(failed.map(each => each.status)).toEqual(['rejected', 'rejected']);
    expect(await db.select({ id: players.id }).from(players).limit(1)).toHaveLength(1);
  });

  it.each([
    ['integer', sql<number>`12::int`],
    ['big integer column value', sql<number>`12::bigint`.mapWith(Number)],
    ['real', sql<number>`1.5::real`],
    ['double', sql<number>`0.1::float8`],
    ['very small double', sql<number>`1e-300::float8`],
    ['true', sql<boolean>`true`],
    ['false', sql<boolean>`false`],
    ['text', sql<string>`'a "quoted" \\ line
break'::text`],
    ['unicode', sql<string>`'şğü 🚀'::text`],
    ['uuid', sql<string>`'40bd85ad-2380-407c-af65-dfef40b74c20'::uuid`],
    ['null', sql<null>`null::int`],
    ['jsonb object', sql<unknown>`'{"a":{"b":[1,null,"x"]},"z":1.5}'::jsonb`],
    ['jsonb array', sql<unknown>`'[1,2,3]'::jsonb`],
    ['text array', sql<string[]>`array['a','b,c']::text[]`],
    ['empty array', sql<string[]>`array[]::text[]`],
  ])('reads a %s as the driver does', async (_name, value) => {
    const read = () => db.select({ value }).from(seasons).limit(1);
    expect(await batched(read)).toEqual(await read());
  });

  it('reads a timestamp to the same instant', async () => {
    const read = () => db.select({ at: seasons.startsAt, closed: seasons.closedAt }).from(seasons).limit(1);
    const answer = await batched(read);
    expect(answer).toEqual(await read());
    expect(answer[0]!.at).toBeInstanceOf(Date);
  });

  it.each(Object.entries(schema).flatMap(([name, value]) => isTable(value) ? [[name, value as PgTable] as const] : []))(
    'reads %s as the driver does', async (_name, table) => {
      const read = () => db.select().from(table).limit(10);
      expect(await batched(read), getTableName(table)).toEqual(await read());
    });
});

/**
 * WHAT A REQUEST MAY NOT MERGE WITH. Review, 2026-11-03.
 */
describe('reads that must stay their own', () => {
  const fake = () => {
    const prepared: (boolean | undefined)[] = [];
    const unsafe = (_query: string, _params: readonly unknown[], options?: { prepare?: boolean }) => {
      prepared.push(options?.prepare);
      return { values: () => Promise.resolve([[[], []]]) };
    };
    return { prepared, sql: { unsafe } as unknown as Sql };
  };
  const ask = (sql: Sql, params: number) => sql.unsafe('select 1', Array.from({ length: params }, () => 'x' as never), { prepare: true }).values();

  it('prepares a merged statement of ordinary size', async () => {
    const { prepared, sql } = fake();
    const merged = batching(sql, () => undefined);
    await batchReads(() => Promise.all([ask(merged, 16), ask(merged, 16)]));
    expect(prepared.at(-1)).toBe(true);
  });

  it('does not prepare one past the limit a lone statement has, whose shapes would pile up per connection', async () => {
    const { prepared, sql } = fake();
    const merged = batching(sql, () => undefined);
    await batchReads(() => Promise.all([ask(merged, 17), ask(merged, 16)]));
    expect(prepared.at(-1)).toBe(false);
  });

  it('keeps a shared cache fill out of the request that happened to start it', async () => {
    const f = await seedWorld(1);
    const cache = new AsyncCache<unknown>(4, 1_000, () => true);
    const scope = { statements: 0 };
    await countStatements(scope, () => batchReads(() => Promise.all([
      f.db.select().from(players),
      cache.get('fill', async () => await f.db.select().from(seasons)),
    ])));
    expect(scope.statements).toBe(2);
  });

  it('does not fail a shared fill for the bad read of the request beside it', async () => {
    const f = await seedWorld(1);
    const cache = new AsyncCache<unknown>(4, 1_000, () => true);
    const [bad, fill] = await batchReads(() => Promise.allSettled([
      f.db.select({ broken: sql`1 / (select count(*) - count(*) from players)` }).from(players),
      cache.get('fill', async () => await f.db.select().from(seasons)),
    ]));
    expect(bad.status).toBe('rejected');
    expect(fill.status).toBe('fulfilled');
  });
});

