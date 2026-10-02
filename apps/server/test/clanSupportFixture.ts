import { eq } from 'drizzle-orm';
import { CLAN, MULTI_WORLD } from '@astera/rules';
import { accounts, clanMemberships, planets, seasons } from '../src/db/schema.js';
import { acceptClanRequest, applyToClan, clanActor, createClan } from '../src/services/clan.js';
import { rememberWorld } from '../src/services/intel.js';
import {
  giveUnits,
  grant,
  levelWorld,
  seedWorld,
  setLevel,
  type Fixture,
} from './helpers.js';

/**
 * KLAN SAVUNMA DESTEĞİ — the shared arrangement for its server suites.
 *
 * Every world gets the same Core (so every commander shares one tier band), a tall
 * Hangar, a yard full of Darts and Couriers and a full tank; every commander has a
 * probe memory of every world, the way a real clanmate learns where friends live.
 */
export const DEFENCE: number = MULTI_WORLD.clanDefenseRulesetVersion;

export async function supportWorld(count = 4, seed = 15_015, rulesetVersion = DEFENCE): Promise<Fixture> {
  const f = await seedWorld(count, seed);
  await f.db.update(seasons).set({ rulesetVersion }).where(eq(seasons.id, f.seasonId));
  for (const planetId of f.planetIds) {
    await grant(f.db, planetId, 600_000, 300_000);
    await setLevel(f.db, planetId, 'SHIPYARD', 4);
  }
  await levelWorld(f.db, f.planetIds);
  for (const planetId of f.planetIds) {
    await setLevel(f.db, planetId, 'HANGAR', 6);
    await giveUnits(f.db, planetId, { DART: 120, COURIER: 10 });
  }
  for (const observerPlayerId of f.playerIds) {
    for (const targetPlanetId of f.planetIds) {
      await f.db.transaction((tx) => rememberWorld(tx, {
        observerPlayerId,
        targetPlanetId,
        seasonId: f.seasonId,
        seenAt: f.clock.now(),
        source: 'PROBE',
      }));
    }
  }
  return f;
}

/** Push a member's adaptation period into the past. */
export async function mature(f: Fixture, playerId: string): Promise<void> {
  const joinedAt = new Date(f.clock.now().getTime() - (CLAN.adaptationMinutes + 60) * 60_000);
  await f.db.update(clanMemberships)
    .set({ joinedAt, matureAt: new Date(joinedAt.getTime() + CLAN.adaptationMinutes * 60_000) })
    .where(eq(clanMemberships.playerId, playerId));
}

/**
 * Found a clan led by account `leader` and admit `members`, all matured unless asked
 * otherwise. Returns the clan id.
 */
export async function formClan(
  f: Fixture,
  leader = 0,
  members: readonly number[] = [1],
  options: { matured?: boolean; name?: string; tag?: string } = {},
): Promise<string> {
  const leaderActor = await clanActor(f.db, f.accountIds[leader]!);
  const created = await f.db.transaction((tx) => createClan(tx, {
    actor: leaderActor,
    name: options.name ?? 'Aegis Pact',
    tag: options.tag ?? 'AP',
    description: 'We hold the line.',
    recruiting: true,
    clock: f.clock,
  }));
  for (const index of members) {
    const candidate = await clanActor(f.db, f.accountIds[index]!);
    const application = await f.db.transaction((tx) => applyToClan(tx, {
      actor: candidate,
      clanId: created.clanId,
      now: f.clock.now(),
    }));
    await f.db.transaction((tx) => acceptClanRequest(tx, {
      actor: leaderActor,
      requestId: application.requestId,
      acknowledgeHostile: true,
      now: f.clock.now(),
    }));
  }
  if (options.matured !== false) {
    for (const index of [leader, ...members]) await mature(f, f.playerIds[index]!);
  }
  return created.clanId;
}

/** The name a notice is written in for account `index`, and the name of its world. */
export async function namesOf(f: Fixture, index: number): Promise<{ commander: string; world: string }> {
  const [account] = await f.db.select({ name: accounts.displayName }).from(accounts)
    .where(eq(accounts.id, f.accountIds[index]!));
  const [world] = await f.db.select({ name: planets.name }).from(planets)
    .where(eq(planets.id, f.planetIds[index]!));
  if (!account || !world) throw new Error(`no commander at ${String(index)}`);
  return { commander: account.name, world: world.name };
}
