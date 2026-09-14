import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { ABUSE } from '@astera/rules';
import { battleReports, missions, planets, players, strategicAssets } from '../src/db/schema.js';
import { launchAttack } from '../src/services/mission.js';
import { launchProbe } from '../src/services/intel.js';
import { launchDeathStar } from '../src/services/strategic.js';
import { baysInUse } from '../src/services/flight.js';
import { publicWorlds } from '../src/services/publicGalaxy.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  fuelUp,
  giveNewcomerShield,
  giveUnits,
  grant,
  levelWorld,
  seedWorld,
  setLevel,
  settledAt,
  testDb,
  type Fixture,
} from './helpers.js';

/**
 * THE SHIELD A HEAVY DEFEAT BUYS. Owner instruction, 2026-09-14:
 * *"Ağır bir PvP kaybından sonra 4 saatlik saldırı koruması ver; korunan oyuncu
 * başka bir oyuncuya saldırmayı seçerse korumayı kaldır."*
 *
 * IT IS THE FIRST-DAY SHIELD'S CONTRACT, NOT A SECOND MECHANISM — same scope, same
 * forfeit, same confirmation — so most of what this file holds is that the two
 * behave identically to a raider and differently to the commander who owns them:
 * the first day is given once and spent for good, this one is EARNED and can be
 * earned again. `packages/rules/test/recovery-shield.test.ts` holds the thresholds
 * themselves; everything here is about launches, locks and the audit trail.
 */

const silent = pino({ level: 'silent' });
const HOUR = 3_600_000;

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('the recovery shield', () => {
  let f: Fixture;
  let mine: string;
  let theirs: string;
  let colony: string;

  const worker = () =>
    new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

  const recoveryOf = async (playerId: string): Promise<Date | null> => {
    const [row] = await f.db
      .select({ until: players.recoveryShieldUntil })
      .from(players)
      .where(eq(players.id, playerId));
    return row?.until ?? null;
  };

  const newcomerOf = async (playerId: string): Promise<Date | null> => {
    const [row] = await f.db
      .select({ until: players.newcomerShieldUntil })
      .from(players)
      .where(eq(players.id, playerId));
    return row?.until ?? null;
  };

  /** The wing that wins and, crucially, has room for the whole exposed share. */
  const HEAVY: Record<string, number> = { DART: 240, COURIER: 60 };

  /**
   * A RAID THE DEFENDER CANNOT SURVIVE, WITH ROOM IN THE HOLD FOR ALL OF IT.
   *
   * Every threshold in the rule is about what actually came home, so a fixture that
   * wins decisively and then flies away half-empty would be testing the cargo rule
   * instead — and `cargoLimited` would be the honest name for that raid. Sixty
   * Couriers carry more than the world can expose, which is what makes this a test
   * about the share rather than about a hold.
   *
   * IT FLIES THE WING HOME AGAIN, because an outbound raid and its return both
   * reserve the same origin/target pair: a fixture that left the survivors in the
   * air would have every follow-up launch refused with FLEET_ALREADY_COMMITTED,
   * which is a rule this file is not about.
   */
  const overwhelm = async (target = theirs) => {
    await grant(f.db, target, 60_000, 15_000);
    await giveUnits(f.db, target, { DART: 2 });
    await giveUnits(f.db, mine, HEAVY);
    await fuelUp(f.db, mine);
    await levelWorld(f.db, f.planetIds);
    const launch = await launchAttack(f.db, mine, target, HEAVY, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();
    const [report] = await f.db.select().from(battleReports)
      .where(eq(battleReports.missionId, launch.missionId));
    expect(report, 'the fixture raid never resolved').toBeDefined();
    expect(report!.grade, 'the fixture raid did not win').toBe('DECISIVE');
    expect(report!.cargoLimited, 'the fixture wing could not carry the share').toBe(false);

    const [home] = await f.db.select().from(missions).where(and(
      eq(missions.parentMissionId, launch.missionId),
      eq(missions.kind, 'return'),
    ));
    if (home) {
      f.clock.set(settledAt(home.arriveAt));
      await worker().tick();
    }
    return report!;
  };

  beforeEach(async () => {
    f = await seedWorld(3);
    [mine, theirs, colony] = f.planetIds as [string, string, string];
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 8);
      await setLevel(f.db, id, 'SHIPYARD', 4);
    }
    /*
      THE DEFENDER'S SECOND WORLD, so "every world they hold" is testable — and it
      is a COLONY rather than a second capital, because `planets_capital_player_idx`
      allows a commander exactly one of those.
    */
    await f.db.update(planets)
      .set({ controllerPlayerId: f.playerIds[1]!, kind: 'COLONY' })
      .where(eq(planets.id, colony));
    await levelWorld(f.db, f.planetIds);
    f.clock.advance(250);
  });

  /* ── what earns it ───────────────────────────────────────── */

  it('gives the defender four hours after a battle that took half of everything', async () => {
    const report = await overwhelm();
    const until = await recoveryOf(f.playerIds[1]!);
    expect(until).not.toBeNull();
    expect(until!.getTime())
      .toBe(report.createdAt.getTime() + ABUSE.recoveryShieldHours * HOUR);
  });

  it('records what the grant was decided against, so it can be audited', async () => {
    const report = await overwhelm();
    expect(report.raidableBefore).toBeGreaterThan(0);
    const taken = report.loot.alloy + report.loot.crystal + report.loot.deuterium;
    // The rule's own comparison, re-run against the two stored figures.
    expect(ABUSE.recoveryRaidableMultiple * taken)
      .toBeGreaterThanOrEqual(report.raidableBefore!);
    expect(report.recoveryShieldUntil).not.toBeNull();
  });

  it('gives nothing for a raid that barely dented the world', async () => {
    await grant(f.db, theirs, 400_000, 100_000);
    await giveUnits(f.db, theirs, { DART: 2 });
    // One Wasp's hold: a DECISIVE win that carries almost nothing home.
    await giveUnits(f.db, mine, { DART: 60 });
    await levelWorld(f.db, f.planetIds);
    const launch = await launchAttack(f.db, mine, theirs, { DART: 60 }, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();

    const [report] = await f.db.select().from(battleReports)
      .where(eq(battleReports.missionId, launch.missionId));
    expect(report?.grade).toBe('DECISIVE');
    expect(report?.cargoLimited).toBe(true);
    expect(await recoveryOf(f.playerIds[1]!)).toBeNull();
    expect(report?.recoveryShieldUntil ?? null).toBeNull();
  });

  /**
   * THE EXPLOIT THE MATERIAL FLOOR CLOSES, STATED AS A TEST.
   *
   * A colony deliberately left with almost nothing in it loses ALL of its raidable
   * stock to a single Wasp — a hundred per cent of the share — and the whole
   * commander, capital included, would go behind four hours of immunity for the
   * price of one hull. The twentieth-of-storage floor is what refuses it.
   */
  it('gives nothing for losing everything on a world that held nothing', async () => {
    // The capital is developed and full; the colony is bare.
    await grant(f.db, mine, 200_000, 50_000);
    await grant(f.db, theirs, 400_000, 100_000);
    await f.db.update(planets)
      .set({
        alloy: 3, crystal: 1, deuterium: 0,
        bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0,
      })
      .where(eq(planets.id, colony));
    await giveUnits(f.db, mine, { DART: 60, COURIER: 4 });
    await levelWorld(f.db, f.planetIds);

    const launch = await launchAttack(f.db, mine, colony, { DART: 60, COURIER: 4 }, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();
    expect(await recoveryOf(f.playerIds[1]!)).toBeNull();
  });

  /**
   * A COMMANDER WHO IS MID-ATTACK MAY NOT COLLECT ONE.
   *
   * Otherwise a raid and a counter-raid crossing in the air end with the loser of
   * the exchange safe behind four hours WHILE their own fleet is still in flight
   * toward a target that now cannot answer. A shield earned by attacking inverts
   * what the shield is for.
   */
  it('refuses the grant while the defender has a raid of their own in the air', async () => {
    await grant(f.db, theirs, 200_000, 50_000);
    await giveUnits(f.db, theirs, { DART: 2, COURIER: 2 });
    await giveUnits(f.db, mine, { DART: 240, COURIER: 12 });
    await levelWorld(f.db, f.planetIds);

    const launch = await launchAttack(f.db, mine, theirs, { DART: 240, COURIER: 12 }, f.clock);
    // Committed at the instant the incoming raid settles, so it is genuinely in
    // the air when the battle resolves rather than racing it.
    f.clock.set(settledAt(launch.arriveAt));
    const outbound = await launchAttack(f.db, theirs, mine, { DART: 2 }, f.clock);
    expect(outbound.arriveAt.getTime()).toBeGreaterThan(f.clock.now().getTime());
    await worker().tick();

    expect(await recoveryOf(f.playerIds[1]!)).toBeNull();
    const [report] = await f.db.select().from(battleReports)
      .where(eq(battleReports.missionId, launch.missionId));
    // The denominator is still recorded: only the grant was refused.
    expect(report?.raidableBefore).toBeGreaterThan(0);
    expect(report?.recoveryShieldUntil ?? null).toBeNull();
  });

  /**
   * A SECOND HEAVY DEFEAT PUSHES THE END OUT; IT NEVER STACKS TWO WINDOWS.
   *
   * Both raids are committed BEFORE the first one lands, because that is the only
   * way a second one can exist: the shield refuses new launches, and a fleet that
   * was legally in the air when it went up still arrives (and still counts).
   */
  it('extends the window rather than adding a second one', async () => {
    await grant(f.db, theirs, 60_000, 15_000);
    await grant(f.db, colony, 60_000, 15_000);
    await giveUnits(f.db, theirs, { DART: 1 });
    await giveUnits(f.db, colony, { DART: 1 });
    await giveUnits(f.db, mine, { DART: 480, COURIER: 120 });
    await fuelUp(f.db, mine, 5_000_000);
    await levelWorld(f.db, f.planetIds);

    const first = await launchAttack(f.db, mine, theirs, HEAVY, f.clock);
    const second = await launchAttack(f.db, mine, colony, HEAVY, f.clock);

    f.clock.set(settledAt(first.arriveAt));
    await worker().tick();
    const granted = await recoveryOf(f.playerIds[1]!);
    expect(granted).not.toBeNull();

    f.clock.set(new Date(settledAt(second.arriveAt).getTime() + 90 * 60_000));
    await worker().tick();
    const extended = await recoveryOf(f.playerIds[1]!);
    expect(extended).not.toBeNull();

    // Pushed out to four hours from the SECOND battle, not eight from the first.
    expect(extended!.getTime()).toBeGreaterThan(granted!.getTime());
    expect(extended!.getTime() - granted!.getTime())
      .toBeLessThan(ABUSE.recoveryShieldHours * HOUR);
    expect(extended!.getTime())
      .toBe(f.clock.now().getTime() + ABUSE.recoveryShieldHours * HOUR);
  });

  /* ── what it protects ────────────────────────────────────── */

  it('refuses a new raid at any world the protected commander holds', async () => {
    await overwhelm();
    for (const world of [theirs, colony]) {
      await expect(launchAttack(f.db, mine, world, { DART: 10 }, f.clock))
        .rejects.toMatchObject({ code: 'NEWCOMER_SHIELDED' });
    }
    // Nothing spent for asking: no bay, no fuel, no ships off the stack.
    expect(await baysInUse(f.db, mine)).toBe(0);
  });

  it('names the recovery shield rather than the first day in its refusal', async () => {
    await overwhelm();
    await expect(launchAttack(f.db, mine, theirs, { DART: 10 }, f.clock))
      .rejects.toMatchObject({ params: { protection: 'RECOVERY' } });
  });

  it('refuses a Death Star as well as a raid', async () => {
    await overwhelm();
    await setLevel(f.db, mine, 'CORE', 5);
    await f.db.insert(strategicAssets).values({
      planetId: mine, status: 'READY', startedAt: f.clock.now(), remainingSeconds: 0,
    });
    await expect(launchDeathStar(f.db, mine, theirs, f.clock))
      .rejects.toMatchObject({ code: 'NEWCOMER_SHIELDED' });
  });

  /**
   * A RULE THE RAIDER CANNOT SEE IS NOT A USABLE RULE. D124 · D168.
   *
   * The first-day shield is drawn as `PROTECTED` on every world its commander
   * holds for exactly this reason, and the recovery window has to wear the same
   * badge or a raider discovers it by committing a fleet and being refused.
   */
  it('draws every world the protected commander holds as PROTECTED', async () => {
    await overwhelm();
    const worlds = await publicWorlds(f.db, f.seasonId, f.clock.now());
    for (const id of [theirs, colony]) {
      const world = worlds.find((candidate) => candidate.id === id);
      expect(world?.state.kind, id).toBe('PROTECTED');
    }
    // The attacker is reachable as ever; the badge is about the defeated commander.
    expect(worlds.find((candidate) => candidate.id === mine)?.state.kind).toBe('NORMAL');
  });

  it('stops raids and not sight', async () => {
    await overwhelm();
    await setLevel(f.db, mine, 'SHIPYARD', 2);
    const scout = await launchProbe(f.db, mine, theirs, f.clock);
    expect(scout.missionId).toBeTypeOf('string');
  });

  it('lets the raid through the moment the four hours are over', async () => {
    await overwhelm();
    f.clock.advance(ABUSE.recoveryShieldHours * 60 + 1);
    await giveUnits(f.db, mine, { DART: 10 });
    const launched = await launchAttack(f.db, mine, theirs, { DART: 10 }, f.clock);
    expect(launched.missionId).toBeTypeOf('string');
  });

  /* ── what ends it ────────────────────────────────────────── */

  it('asks before the protected commander spends it, then spends it', async () => {
    await overwhelm();
    await giveUnits(f.db, theirs, { DART: 10 });
    await grant(f.db, theirs, 60_000, 6_000);

    await expect(launchAttack(f.db, theirs, mine, { DART: 10 }, f.clock))
      .rejects.toMatchObject({
        code: 'SHIELD_WOULD_DROP',
        params: { protection: 'RECOVERY' },
      });
    // Asking is not spending.
    expect(await recoveryOf(f.playerIds[1]!)).not.toBeNull();

    const launched = await launchAttack(
      f.db, theirs, mine, { DART: 10 }, f.clock, undefined, true,
    );
    expect(launched.missionId).toBeTypeOf('string');
    expect(await recoveryOf(f.playerIds[1]!)).toBeNull();
  });

  /**
   * ACCEPTING SPENDS BOTH COLUMNS. A commander who holds a first-day shield and a
   * recovery shield at once and fires has committed to the war; leaving the other
   * standing would let somebody keep half a shield by owning two kinds of it.
   */
  it('clears the first-day shield in the same breath', async () => {
    await overwhelm();
    await giveNewcomerShield(
      f.db, f.playerIds[1]!, new Date(f.clock.now().getTime() + 20 * HOUR),
    );
    await giveUnits(f.db, theirs, { DART: 10 });
    await grant(f.db, theirs, 60_000, 6_000);

    await launchAttack(f.db, theirs, mine, { DART: 10 }, f.clock, undefined, true);
    expect(await recoveryOf(f.playerIds[1]!)).toBeNull();
    expect(await newcomerOf(f.playerIds[1]!)).toBeNull();
  });

  /** An economic flight is not the reaching-out the rule is about. */
  it('is not spent by a probe', async () => {
    await overwhelm();
    await setLevel(f.db, theirs, 'SHIPYARD', 2);
    await launchProbe(f.db, theirs, mine, f.clock);
    expect(await recoveryOf(f.playerIds[1]!)).not.toBeNull();
  });

  /* ── the Death Star's own door ───────────────────────────── */

  /**
   * A STRIKE GRANTS IT OUTRIGHT. Owner instruction: it halves a world's stores,
   * takes a Core level with everything standing on it and burns the queue behind
   * it, and it carries no loot for a share to be measured against — so the
   * threshold is skipped rather than approximated from destroyed value. The
   * world's own two-hour recovery runs alongside and is untouched.
   */
  it('is granted by a Death Star impact, beside the world’s own outage', async () => {
    await grant(f.db, theirs, 200_000, 50_000);
    await setLevel(f.db, mine, 'CORE', 5);
    await f.db.insert(strategicAssets).values({
      planetId: mine, status: 'READY', startedAt: f.clock.now(), remainingSeconds: 0,
    });
    const launched = await launchDeathStar(f.db, mine, theirs, f.clock);
    f.clock.set(settledAt(launched.arriveAt));
    await worker().tick();

    const until = await recoveryOf(f.playerIds[1]!);
    expect(until).not.toBeNull();
    const [struck] = await f.db.select().from(planets).where(eq(planets.id, theirs));
    expect(struck?.recoveryUntil).not.toBeNull();
    // Two independent clocks: the world is dark for two hours, the commander is
    // unreachable for four.
    expect(until!.getTime()).toBeGreaterThan(struck!.recoveryUntil!.getTime());
  });

  /* ── the rollout switch ──────────────────────────────────── */

  /**
   * THE COLUMN SHIPS BEFORE THE RULE DOES. The expand-only migration and the report
   * fields go out first with the feature switched off, so a fleet mid-roll cannot
   * have one instance granting shields another instance cannot read.
   */
  it('grants nothing while the feature is staged off', async () => {
    vi.stubEnv('RECOVERY_SHIELD_ENABLED', 'false');
    try {
      const report = await overwhelm();
      expect(await recoveryOf(f.playerIds[1]!)).toBeNull();
      expect(report.recoveryShieldUntil ?? null).toBeNull();
      // The first-day shield is untouched by the switch.
      await giveNewcomerShield(
        f.db, f.playerIds[1]!, new Date(f.clock.now().getTime() + HOUR),
      );
      await expect(launchAttack(f.db, mine, theirs, { DART: 10 }, f.clock))
        .rejects.toMatchObject({ code: 'NEWCOMER_SHIELDED' });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  /** A fleet that was legally in the air before the shield still lands. */
  it('does not turn back an attack that launched before it existed', async () => {
    await grant(f.db, theirs, 60_000, 15_000);
    await grant(f.db, colony, 60_000, 15_000);
    await giveUnits(f.db, theirs, { DART: 1 });
    await giveUnits(f.db, colony, { DART: 1 });
    await giveUnits(f.db, mine, { DART: 480, COURIER: 120 });
    await fuelUp(f.db, mine, 5_000_000);
    await levelWorld(f.db, f.planetIds);

    const first = await launchAttack(f.db, mine, theirs, HEAVY, f.clock);
    const second = await launchAttack(f.db, mine, colony, HEAVY, f.clock);
    f.clock.set(settledAt(first.arriveAt));
    await worker().tick();
    expect(await recoveryOf(f.playerIds[1]!)).not.toBeNull();

    f.clock.set(settledAt(second.arriveAt));
    await worker().tick();
    const [landed] = await f.db.select().from(missions).where(eq(missions.id, second.missionId));
    expect(landed?.status).toBe('resolved');
  });
});
