import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MULTI_WORLD } from '@astera/rules';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { accounts, players, seasonResults, seasons } from '../src/db/schema.js';
import {
  assertClanDominionLedgers,
  assertDominionLedgers,
  addDominionCounters,
  compareDominionScoresDescending,
  dominionScore,
  sumDominionScores,
} from '../src/services/dominion.js';
import { publicWorlds } from '../src/services/publicGalaxy.js';
import { seedWorld, testDb } from './helpers.js';

const here = path.dirname(fileURLToPath(import.meta.url));

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

const v7Report = (overrides: Partial<{
  attackerPlayerId: string;
  defenderPlayerId: string | null;
  dominionSwing: number | null;
  dominionRuleVersion: number | null;
  dominionLootValue: number | null;
  dominionAttackerLossValue: number | null;
  dominionDefenderLossValue: number | null;
  dominionRawExchange: number | null;
  dominionEligible: boolean | null;
}> = {}) => ({
  attackerPlayerId: 'attacker',
  defenderPlayerId: 'defender',
  dominionSwing: 70,
  dominionRuleVersion: MULTI_WORLD.dominionLinearRulesetVersion,
  dominionLootValue: 20,
  dominionAttackerLossValue: 50,
  dominionDefenderLossValue: 100,
  dominionRawExchange: 70,
  dominionEligible: true,
  ...overrides,
});

describe('Dominion settlement audit', () => {
  it('reproduces positive and negative transfers into separate taken/lost ledgers', () => {
    expect(() => { assertDominionLedgers(
      [
        { playerId: 'attacker', taken: 70, lost: 50 },
        { playerId: 'defender', taken: 50, lost: 70 },
      ],
      [
        v7Report(),
        v7Report({
          dominionSwing: -50,
          dominionLootValue: 10,
          dominionAttackerLossValue: 80,
          dominionDefenderLossValue: 20,
          dominionRawExchange: -50,
        }),
      ],
      MULTI_WORLD.dominionLinearRulesetVersion,
    ); }).not.toThrow();
  });

  it('reproduces a surviving opponent after the other seat was reclaimed', () => {
    expect(() => { assertDominionLedgers(
      [{ playerId: 'defender', taken: 0, lost: 70 }],
      [v7Report()],
      MULTI_WORLD.dominionLinearRulesetVersion,
    ); }).not.toThrow();
  });

  it('rejects incomplete or arithmetically inconsistent v7 journals', () => {
    expect(() => { assertDominionLedgers(
      [
        { playerId: 'attacker', taken: 70, lost: 0 },
        { playerId: 'defender', taken: 0, lost: 70 },
      ],
      [v7Report({ dominionLootValue: null })],
      MULTI_WORLD.dominionLinearRulesetVersion,
    ); }).toThrow(/incomplete audit data/);

    expect(() => { assertDominionLedgers(
      [
        { playerId: 'attacker', taken: 70, lost: 0 },
        { playerId: 'defender', taken: 0, lost: 70 },
      ],
      [v7Report({ dominionRawExchange: 71 })],
      MULTI_WORLD.dominionLinearRulesetVersion,
    ); }).toThrow(/does not reproduce/);

    expect(() => { assertDominionLedgers(
      [
        { playerId: 'attacker', taken: 1, lost: 0 },
        { playerId: 'defender', taken: 0, lost: 1 },
      ],
      [v7Report({
        dominionSwing: 1,
        dominionRuleVersion: null,
        dominionLootValue: null,
        dominionAttackerLossValue: null,
        dominionDefenderLossValue: null,
        dominionRawExchange: null,
      })],
      MULTI_WORLD.dominionLinearRulesetVersion,
    ); }).toThrow(/incomplete audit data/);
  });

  it('ignores operator battles that were outside the competition', () => {
    expect(() => { assertDominionLedgers(
      [{ playerId: 'defender', taken: 0, lost: 0 }],
      [v7Report({
        attackerPlayerId: 'operator',
        dominionEligible: false,
        dominionSwing: 0,
        // Durable Dominion events always freeze the season rule, including
        // competition-exempt operator battles.
        dominionRuleVersion: MULTI_WORLD.dominionLinearRulesetVersion,
        dominionLootValue: null,
        dominionAttackerLossValue: null,
        dominionDefenderLossValue: null,
        dominionRawExchange: null,
      })],
      MULTI_WORLD.dominionLinearRulesetVersion,
    ); }).not.toThrow();
  });

  it('does not infer an exemption from an unmarked zero report', () => {
    expect(() => { assertDominionLedgers(
      [{ playerId: 'defender', taken: 0, lost: 0 }],
      [v7Report({
        dominionEligible: null,
        dominionSwing: 0,
        dominionRuleVersion: null,
        dominionLootValue: null,
        dominionAttackerLossValue: null,
        dominionDefenderLossValue: null,
        dominionRawExchange: null,
      })],
      MULTI_WORLD.dominionLinearRulesetVersion,
    ); }).toThrow(/eligibility marker/);
  });

  it('rejects a journal whose accumulated counter exceeds the safe integer range', () => {
    const maximum = v7Report({
      dominionSwing: Number.MAX_SAFE_INTEGER,
      dominionLootValue: Number.MAX_SAFE_INTEGER,
      dominionAttackerLossValue: 0,
      dominionDefenderLossValue: 0,
      dominionRawExchange: Number.MAX_SAFE_INTEGER,
    });
    expect(() => { assertDominionLedgers(
      [
        { playerId: 'attacker', taken: Number.MAX_SAFE_INTEGER, lost: 0 },
        { playerId: 'defender', taken: 0, lost: Number.MAX_SAFE_INTEGER },
      ],
      [maximum, maximum],
      MULTI_WORLD.dominionLinearRulesetVersion,
    ); }).toThrow(/accumulated movement/);
  });

  it('audits an exact exchange whose intermediate sum crosses the safe-number boundary', () => {
    const exactMaximum = v7Report({
      dominionSwing: Number.MAX_SAFE_INTEGER,
      dominionLootValue: Number.MAX_SAFE_INTEGER,
      dominionAttackerLossValue: 2,
      dominionDefenderLossValue: 2,
      dominionRawExchange: Number.MAX_SAFE_INTEGER,
    });

    expect(() => { assertDominionLedgers(
      [
        { playerId: 'attacker', taken: Number.MAX_SAFE_INTEGER, lost: 0 },
        { playerId: 'defender', taken: 0, lost: Number.MAX_SAFE_INTEGER },
      ],
      [exactMaximum],
      MULTI_WORLD.dominionLinearRulesetVersion,
    ); }).not.toThrow();
  });

  it('does not reinterpret ledgers from legacy rulesets', () => {
    expect(() => { assertDominionLedgers(
      [{ playerId: 'attacker', taken: 9_999, lost: 123 }],
      [],
      MULTI_WORLD.dominionLinearRulesetVersion - 1,
    ); }).not.toThrow();
  });
});

describe('Clan Dominion settlement audit', () => {
  it('reproduces the immutable clan event journal', () => {
    expect(() => { assertClanDominionLedgers(
      [{ clanId: 'clan', taken: 90, lost: 35 }],
      [
        { clanId: 'clan', dominionDelta: 90 },
        { clanId: 'clan', dominionDelta: -35 },
      ],
      MULTI_WORLD.dominionLinearRulesetVersion,
    ); }).not.toThrow();
  });

  it('refuses an active clan cache that does not match its journal', () => {
    expect(() => { assertClanDominionLedgers(
      [{ clanId: 'clan', taken: 91, lost: 35 }],
      [
        { clanId: 'clan', dominionDelta: 90 },
        { clanId: 'clan', dominionDelta: -35 },
      ],
      MULTI_WORLD.dominionLinearRulesetVersion,
    ); }).toThrow(/Clan Dominion audit failed/);
  });
});

describe('Dominion numeric boundary', () => {
  it('rejects unsafe ledger arithmetic', () => {
    expect(() => dominionScore(Number.MAX_SAFE_INTEGER + 1, 0)).toThrow(RangeError);
    expect(() => dominionScore(Number.MAX_SAFE_INTEGER, 0)).not.toThrow();
  });

  it('orders extreme safe scores without subtraction overflow', () => {
    expect(compareDominionScoresDescending(
      -Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
    )).toBe(1);
    expect(compareDominionScoresDescending(
      Number.MAX_SAFE_INTEGER,
      -Number.MAX_SAFE_INTEGER,
    )).toBe(-1);
    expect(compareDominionScoresDescending(42, 42)).toBe(0);
  });

  it('never silently rounds lifetime Dominion counters while folding seasons', () => {
    expect(addDominionCounters(Number.MAX_SAFE_INTEGER - 1, 1))
      .toBe(Number.MAX_SAFE_INTEGER);
    expect(() => addDominionCounters(Number.MAX_SAFE_INTEGER, 1))
      .toThrow(/safe integer range/i);
    expect(() => addDominionCounters(-1, 1)).toThrow(/non-negative/i);
  });

  it('sums signed Dominion scores exactly and refuses an unsafe result', () => {
    expect(sumDominionScores([Number.MAX_SAFE_INTEGER, 2, -2]))
      .toBe(Number.MAX_SAFE_INTEGER);
    expect(() => sumDominionScores([Number.MAX_SAFE_INTEGER, 1]))
      .toThrow(/safe integer range/i);
    expect(() => sumDominionScores([Number.MAX_SAFE_INTEGER + 1]))
      .toThrow(/safe integer range/i);
  });

  it('rejects negative monotonic ledger counters', () => {
    expect(() => dominionScore(-1, 0)).toThrow(/non-negative/i);
    expect(() => dominionScore(0, -1)).toThrow(/non-negative/i);
  });

  it('guards the permanent JSON copies with the same exact integer contract', async () => {
    const fixture = await seedWorld(1);
    await expect(fixture.db.update(accounts).set({
      lifetime: { dominionTaken: 0.5 },
    }).where(eq(accounts.id, fixture.accountIds[0]!))).rejects.toThrow();
    await expect(fixture.db.update(accounts).set({
      lifetime: { dominionLost: -1 },
    }).where(eq(accounts.id, fixture.accountIds[0]!))).rejects.toThrow();

    const [season] = await fixture.db.select({ cycleId: seasons.cycleId })
      .from(seasons)
      .where(eq(seasons.id, fixture.seasonId));
    await expect(fixture.db.insert(seasonResults).values({
      cycleId: season!.cycleId,
      seasonId: fixture.seasonId,
      accountId: fixture.accountIds[0]!,
      finalRank: 1,
      dominion: 0,
      title: 'Commander',
      recap: {
        commanderName: 'Commander',
        planetName: 'Capital',
        battles: 0,
        attacks: 0,
        defences: 0,
        rival: null,
        biggestRaid: null,
        clan: {
          name: 'Unsafe',
          tag: 'BAD',
          finalRank: 1,
          dominion: 0.5,
          topThree: true,
        },
      },
      createdAt: fixture.clock.now(),
    })).rejects.toThrow();
  });
});

describe('Dominion migration provenance', () => {
  it('does not invent an operator exemption from an ambiguous legacy zero transfer', () => {
    const migration = readFileSync(
      path.join(here, '../drizzle/0070_dominion_eligibility.sql'),
      'utf8',
    );
    const backfill = /UPDATE "battle_reports"[\s\S]*?;(?=\n--> statement-breakpoint)/
      .exec(migration)?.[0];

    expect(backfill).toBeDefined();
    expect(backfill).not.toContain('THEN false');
  });
});

describe('Dominion podium projection', () => {
  it('keeps a scoped world off the podium when it is fourth galaxy-wide', async () => {
    const fixture = await seedWorld(4);
    for (const [index, score] of [400, 300, 200, 100].entries()) {
      await fixture.db.update(players).set({ dominionTaken: score, dominionLost: 0 })
        .where(eq(players.id, fixture.playerIds[index]!));
    }

    const all = await publicWorlds(fixture.db, fixture.seasonId, fixture.clock.now());
    const [scoped] = await publicWorlds(
      fixture.db,
      fixture.seasonId,
      fixture.clock.now(),
      [fixture.planetIds[3]!],
    );

    expect(all.find((world) => world.id === fixture.planetIds[3])?.dominionRank)
      .toBeUndefined();
    expect(scoped?.dominionRank).toBeUndefined();
  });
});
