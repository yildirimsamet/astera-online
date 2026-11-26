import { fleetCount, type Fleet } from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Tx } from '../db/client.js';
import { battleReports, type missions } from '../db/schema.js';
import { identityOfPlanet } from './battleSettlement.js';
import { rememberVisitedWorld } from './intel.js';
import { returnAttackUntouched } from './neutral.js';
import { notify } from './notifications.js';

const NOTHING = { alloy: 0, crystal: 0, deuterium: 0 };

/**
 * THE MOON WAS EMPTY (S31, V11, V43). Nothing on it could fight, so nothing was fought: no Dominion, no
 * Honor, no loyalty, no shield, no replay, and the wing flies home whole. The raid still ARRIVED, so it
 * leaves the report that says so — a MOON report with no rounds — which is also what the twelve-hour
 * personal cooldown counts, exactly as for any raid that reached its target.
 */
export async function settleEmptyMoon(
  tx: Tx,
  input: {
    mission: typeof missions.$inferSelect;
    defender: { playerId: string; planetId: string; name: string };
    attackingFleet: Fleet;
    clock: Clock;
  },
): Promise<void> {
  const { mission, defender, attackingFleet, clock } = input;
  const now = clock.now();
  await tx.insert(battleReports).values({
    seasonId: mission.seasonId,
    missionId: mission.id,
    appliedCapsules: mission.appliedCapsules,
    attackerPlayerId: mission.ownerPlayerId,
    defenderPlayerId: defender.playerId,
    targetPlanetId: defender.planetId,
    targetKind: 'PLAYER',
    targetBody: 'MOON',
    grade: 'DECISIVE',
    rounds: [],
    loot: NOTHING,
    attackerLosses: {},
    defenderLosses: {},
    attackerFleet: attackingFleet,
    defenderFleet: {},
    salvage: NOTHING,
    dominionSwing: 0,
    dominionEligible: false,
    createdAt: now,
  });
  await returnAttackUntouched(tx, mission, clock);

  const [attacker, target] = await Promise.all([
    identityOfPlanet(tx, mission.originPlanetId),
    identityOfPlanet(tx, defender.planetId),
  ]);
  await notify(tx, {
    playerId: defender.playerId,
    kind: 'raided',
    payload: {
      targetBody: 'MOON',
      moonEmpty: true,
      ...(attacker ? { originUsername: attacker.username, originPlanetName: attacker.planetName } : {}),
      lootAlloy: 0, lootCrystal: 0, lootDeuterium: 0, unitsLost: 0, theirLosses: 0, disruptedMinutes: 0,
    },
    at: now,
    refId: mission.id,
  });
  await notify(tx, {
    playerId: mission.ownerPlayerId,
    kind: 'raid_result',
    payload: {
      targetBody: 'MOON',
      moonEmpty: true,
      targetPlanetId: defender.planetId,
      targetUsername: target?.username ?? 'someone',
      targetPlanetName: defender.name,
      lootAlloy: 0, lootCrystal: 0, lootDeuterium: 0, unitsLost: 0,
      shipsHome: fleetCount(attackingFleet),
      dominion: 0,
    },
    at: now,
    refId: mission.id,
  });
  // The wing was there and saw the world, as after any arrival (D151).
  await rememberVisitedWorld(tx, {
    observerPlayerId: mission.ownerPlayerId,
    targetPlanetId: defender.planetId,
    seasonId: mission.seasonId,
    seenAt: now,
  });
}
