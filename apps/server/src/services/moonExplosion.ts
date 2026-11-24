import { and, eq, inArray, isNull } from 'drizzle-orm';
import { DEBRIS, dominionTransfer, fleetValue, type Fleet, type MoonRarity } from '@astera/rules';
import type { Tx } from '../db/client.js';
import { debrisFields, dominionEvents, hpRadiationSources, missions, moons, seasons, units } from '../db/schema.js';
import { adminPlayerIdsInSeason } from './admin.js';
import { applyDelta, flyingAlloy, flyingCrystal, flyingDeuterium, flyingValue, lockLedgers, saveLedger } from './battleSettlement.js';
import { recordGalaxyEvent } from './chronicle.js';
import { readHomeHealth } from './homeHealth.js';
import { releaseStrike, turnMissionHome } from './movement.js';
import { withdrawRaidWarning } from './notifications.js';
import { recomputePlayerWealth } from './planet.js';
import { MOON_LOCATION } from './unitLocation.js';
import { publishWatchChanges } from './watchEvents.js';
import { publishShard } from '../stream/bus.js';

/**
 * THE MOON BREAKS (S35, plan §6.14 steps 1–10), inside the Death Star's transaction.
 *
 * Every ship standing on it dies, and a share of what died stays as a public wreck beside the world —
 * from which no moon is ever born. Every raid or transfer bound for the moon turns home at this instant;
 * a hop up comes down on the planet, and a jump into it is cancelled, by their own landing checks. The
 * galaxy hears it with the moon's rarity (V18). The score of the dead is the caller's business.
 */
export async function explodeMoon(tx: Tx, input: {
  missionId: string;
  world: { id: string; seasonId: string; name: string; x: number; y: number; z: number };
  /** Whoever held the world, and so the ships on its moon; null on a neutral world. */
  holder: string | null;
  rarity: MoonRarity;
  now: Date;
}): Promise<{ destroyedFleet: Fleet }> {
  const { world, now } = input;
  const { fleet } = await readHomeHealth(tx, world.id, 'MOON');
  await tx.delete(units).where(and(eq(units.planetId, world.id), eq(units.location, MOON_LOCATION)));
  if (input.holder && Object.keys(fleet).length > 0) await recomputePlayerWealth(tx, input.holder, now);

  const raw = flyingValue(fleet);
  const made = raw * DEBRIS.share;
  if (made >= DEBRIS.minimum) {
    const share = (part: number) => made * (part / raw);
    await tx.insert(debrisFields).values({
      seasonId: world.seasonId, planetId: world.id, x: world.x, y: world.y, z: world.z, missionId: input.missionId,
      body: 'MOON', alloy: share(flyingAlloy(fleet)), crystal: share(flyingCrystal(fleet)),
      deuterium: share(flyingDeuterium(fleet)), createdAt: now,
    });
  }

  const bound = await tx.select().from(missions).where(and(
    eq(missions.status, 'in_flight'), eq(missions.targetPlanetId, world.id), eq(missions.targetBody, 'MOON'),
    inArray(missions.kind, ['attack', 'transfer']), isNull(missions.recalledAt), isNull(missions.parentMissionId),
  )).for('update');
  for (const flight of bound) {
    if (flight.arriveAt <= now) continue;
    await turnMissionHome(tx, flight, now);
    if (flight.kind === 'attack') {
      await releaseStrike(tx, flight.id);
      await withdrawRaidWarning(tx, flight.id);
    }
  }

  await recordGalaxyEvent(tx, {
    seasonId: world.seasonId, kind: 'moon_destroyed', refId: input.missionId, subjectPlanetId: world.id,
    payload: { planetName: world.name, rarity: input.rarity }, occurredAt: now,
  });
  await tx.delete(hpRadiationSources).where(and(
    eq(hpRadiationSources.anchorKind, 'PLANET'),
    eq(hpRadiationSources.anchorId, world.id),
    eq(hpRadiationSources.body, 'MOON'),
  ));
  await tx.delete(moons).where(eq(moons.planetId, world.id));
  await publishWatchChanges(tx, [world.id]);
  await publishShard(tx, world.seasonId, 'moons');
  return { destroyedFleet: fleet };
}

/**
 * THE DOMINION OF A BROKEN MOON (S35): the value of the ships that died moves from the holder to the striker,
 * as a battle with no loot and no attacker loss would move it, and leaves the same audit row. Players' own
 * ledgers only; like every strategic strike it books no clan battle score (V51).
 */
export async function scoreMoonBreak(tx: Tx, input: {
  seasonId: string; missionId: string; striker: string; holder: string; destroyed: Fleet; now: Date;
  adminUsernames: ReadonlySet<string>;
}): Promise<void> {
  const [season] = await tx.select({ rulesetVersion: seasons.rulesetVersion }).from(seasons).where(eq(seasons.id, input.seasonId));
  if (!season) throw new Error('moon break season vanished');
  const admins = await adminPlayerIdsInSeason(tx, input.seasonId, input.adminUsernames);
  const eligible = !admins.has(input.striker) && !admins.has(input.holder);
  const value = fleetValue(input.destroyed);
  const transfer = eligible ? dominionTransfer(value, season.rulesetVersion) : 0;
  if (transfer !== 0) {
    const ledgers = await lockLedgers(tx, [input.striker, input.holder]);
    const striker = ledgers.get(input.striker)!;
    const holder = ledgers.get(input.holder)!;
    applyDelta(striker, transfer, 'Moon break Dominion');
    applyDelta(holder, -transfer, 'Moon break Dominion');
    await saveLedger(tx, striker);
    await saveLedger(tx, holder);
  }
  await tx.insert(dominionEvents).values({
    seasonId: input.seasonId, missionId: input.missionId, attackerPlayerId: input.striker, defenderPlayerId: input.holder,
    rulesetVersion: season.rulesetVersion, eligible,
    lootValue: eligible ? 0 : null, attackerLossValue: eligible ? 0 : null, defenderLossValue: eligible ? value : null,
    rawExchange: eligible ? value : null, transfer, createdAt: input.now,
  }).onConflictDoNothing({ target: dominionEvents.missionId });
}
