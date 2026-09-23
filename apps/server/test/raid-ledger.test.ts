import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { resourceValue } from '@astera/rules';
import { battleReports, missions } from '../src/db/schema.js';
import { launchAttack } from '../src/services/mission.js';
import { ledgerForMission } from '../src/services/raidLedger.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  fuelUp, giveUnits, grant, levelWorld, seedWorld, setLevel, settledAt, testDb, type Fixture,
} from './helpers.js';

/**
 * A RAID'S REAL P&L, BUILT FROM WHAT THE BATTLE ACTUALLY SETTLED.
 *
 * Nothing in the game could answer "did that raid pay?" — the pieces were spread across the report
 * (loot, losses, the collectors' haul) and the one term nobody kept at all was the fuel. Measured
 * three times in one session, the answer came out differently each time because a different piece
 * was left out.
 *
 * THIS READS THE COMMITTED RESULT; it does not re-run the rules. A second model of combat sitting
 * beside the server's own would drift, and the number it produced would be the one people trusted.
 */
const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('a settled raid, in the books', () => {
  let f: Fixture;
  let mine: string;
  let theirs: string;

  const worker = () => new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

  beforeEach(async () => {
    f = await seedWorld(2);
    [mine, theirs] = f.planetIds as [string, string];
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 8);
      await setLevel(f.db, id, 'SHIPYARD', 4);
    }
    await levelWorld(f.db, f.planetIds);
    await grant(f.db, theirs, 60_000, 20_000);
    await giveUnits(f.db, mine, { BALLISTA: 60 });
    await giveUnits(f.db, theirs, { BALLISTA: 6 });
    await fuelUp(f.db, mine, 50_000);
    f.clock.advance(250);
  });

  const raid = async () => {
    const launch = await launchAttack(f.db, mine, theirs, { BALLISTA: 60 }, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();
    return launch.missionId;
  };

  it('charges the fuel the launch actually paid, and never a recomputed one', async () => {
    const missionId = await raid();
    const [row] = await f.db.select().from(missions).where(eq(missions.id, missionId));
    expect(row!.fuelPaid).toBeGreaterThan(0);

    const ledger = await ledgerForMission(f.db, missionId);
    expect(ledger).not.toBeNull();
    expect(ledger!.liquid.deuterium).toBe(
      (ledger!.loot.deuterium + ledger!.salvage.deuterium) - row!.fuelPaid,
    );
  });

  /** The three views are different questions and must not collapse into one another. */
  it('separates what came home from what stopped existing', async () => {
    const missionId = await raid();
    const ledger = (await ledgerForMission(f.db, missionId))!;
    const [report] = await f.db.select().from(battleReports)
      .where(eq(battleReports.missionId, missionId));

    expect(ledger.liquid).toEqual({
      alloy: report!.loot.alloy + report!.salvage.alloy,
      crystal: report!.loot.crystal + report!.salvage.crystal,
      deuterium: report!.loot.deuterium + report!.salvage.deuterium - ledger.fuelPaid,
    });
    expect(ledger.ae.replacement).toBeLessThanOrEqual(ledger.ae.liquid);
    expect(ledger.ae.liquid).toBeCloseTo(resourceValue(ledger.liquid), 6);
  });

  /** The defender's loss is Dominion's input; it is never the attacker's income. */
  it('keeps what the defender lost out of the attacker books', async () => {
    const ledger = (await ledgerForMission(f.db, await raid()))!;
    expect(resourceValue(ledger.denied)).toBeGreaterThan(0);
    expect(ledger.wealth.alloy).toBeLessThan(resourceValue(ledger.denied) + ledger.liquid.alloy);
  });

  it('answers nothing for a mission that never settled a battle', async () => {
    expect(await ledgerForMission(f.db, crypto.randomUUID())).toBeNull();
  });

  /**
   * THE LANE IS THE REPORT'S, NOT THE MISSION'S. Owner review, 2026-09-21.
   *
   * A neutral raid is a `kind: 'attack'` mission too, so checking the mission kind alone let a
   * caretaker world's losses come back as Dominion denied to a PLAYER — which is precisely the
   * two accounting lanes the plan keeps apart running into each other. `targetKind` is the field
   * that actually says which fight this was, and a PvP report always carries a defender.
   */
  it('refuses a raid that was not flown at a commander', async () => {
    const missionId = await raid();
    /*
      A NEUTRAL REPORT CARRIES NO DOMINION FIGURES, and the database says so:
      `battle_reports_dominion_audit_check` only admits those columns on a `PLAYER` report. The
      first version of this test flipped a settled PvP row's `targetKind` and left the audit
      columns behind, which Postgres correctly refused — so it was asserting against a row the
      game can never produce. Clearing them is what makes this the shape a caretaker fight
      actually writes.
    */
    const asNeutralLane = {
      defenderPlayerId: null,
      dominionEligible: null,
      dominionRuleVersion: null,
      dominionLootValue: null,
      dominionAttackerLossValue: null,
      dominionDefenderLossValue: null,
      dominionRawExchange: null,
      dominionSwing: null,
    } as const;
    await expect(
      f.db.update(battleReports)
        .set({ targetKind: 'NEUTRAL' })
        .where(eq(battleReports.missionId, missionId)),
    ).rejects.toThrow();
    await f.db.update(battleReports)
      .set({ targetKind: 'NEUTRAL', ...asNeutralLane })
      .where(eq(battleReports.missionId, missionId));
    expect(await ledgerForMission(f.db, missionId)).toBeNull();
  });

  it('refuses a PvP-looking report with nobody on the other side of it', async () => {
    const missionId = await raid();
    await f.db.update(battleReports)
      .set({ targetKind: 'PLAYER', defenderPlayerId: null })
      .where(eq(battleReports.missionId, missionId));
    expect(await ledgerForMission(f.db, missionId)).toBeNull();
  });
});
