import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { reportsSchema } from '../../api/schemas.js';
import { BattleReportDoor } from '../../screens/BattleReports.js';

/**
 * ONE BATTLE REPORT, OPENED THE WAY A NOTIFICATION OPENS IT (C15). The camera photographs the
 * whole sheet: a raid with three rounds and a read fleet, a defence the raider was turned back
 * from, and a pirate fight that handed over a hull.
 *
 * Development only (`v2-gallery.html`); nothing here is imported by the game.
 */

const NOW = Date.now();
const MIN = 60_000;
const iso = (minutes: number) => new Date(NOW + minutes * MIN).toISOString();
const noop = () => undefined;

const RAID = {
  kind: 'BATTLE', id: 'r-raid', missionId: 'm-raid', at: iso(-24), grade: 'PARTIAL', replayStatus: 'AVAILABLE',
  enemyFleetVisibility: 'FULL', attacking: true, opponentName: 'VEX', opponentPlanet: 'Kestrel', opponentPlanetId: 'p-kestrel',
  yourPlanet: 'Bellwether', yourPlanetId: 'p-1', neutral: false, fuelPaid: 320,
  attackerClan: { id: 'c-1', name: 'Halo Watch', tag: 'HALO' }, defenderClan: { id: 'c-2', name: 'Nova Pact', tag: 'NOVA' },
  rounds: [
    { round: 1, attackerRoll: 1.04, defenderRoll: 0.97, attackerDamage: 8_400, defenderDamage: 3_100, shieldBefore: 2_400, shieldAfter: 600,
      shieldAbsorbed: 1_800, shieldBreakerDamage: 0, attackerHullDamage: 6_600, attackerLosses: { DART: 6 }, defenderLosses: { PIKE: 10 } },
    { round: 2, attackerRoll: 0.92, defenderRoll: 1.08, attackerDamage: 6_400, defenderDamage: 1_200, shieldBefore: 600, shieldAfter: 0,
      shieldAbsorbed: 600, shieldBreakerDamage: 0, attackerHullDamage: 5_800, attackerLosses: { DART: 3, TALON: 1 }, defenderLosses: { PIKE: 8, RAMPART: 8 } },
    { round: 3, attackerRoll: 1.01, defenderRoll: 0.99, attackerDamage: 900, defenderDamage: 400, shieldBefore: 0, shieldAfter: 0,
      shieldAbsorbed: 0, shieldBreakerDamage: 0, attackerHullDamage: 900, attackerLosses: {}, defenderLosses: { BASTION: 2 } },
  ],
  yourFleet: { DART: 23, TALON: 19, RAMPART: 10, COURIER: 8 },
  yourLosses: { DART: 9, TALON: 1 },
  theirFleet: { PIKE: 30, RAMPART: 12, BASTION: 4 },
  theirLosses: { PIKE: 18, RAMPART: 8, BASTION: 2 },
  lootAlloy: 3_100, lootCrystal: 1_000, lootDeuterium: 240, cargoLimited: true,
  dominion: 120,
  dominionBreakdown: { ruleVersion: 7, lootValue: 4_580, enemyPermanentLossValue: 9_200, ownPermanentLossValue: 4_100, rawExchange: 9_680 },
  honor: {
    delta: 38_000_000, reason: 'COMBAT',
    breakdown: { teamDelta: 38_000_000, rawTeamDelta: 41_000_000, participants: 1, contributionPpm: 1_000_000, militaryDamage: 9_200, permanentLoss: 4_100 },
  },
  shieldAbsorbed: 2_400, shieldBefore: 2_400, shieldAfter: 0, defenceSalvage: {},
  salvage: { alloy: 600, crystal: 240, deuterium: 0 }, wreckValue: 5_200, disruptedMinutes: 0,
  yourDamage: [{ hull: 'TALON', count: 1, damageBp: 3_400 }, { hull: 'DART', count: 2, damageBp: 900 }],
};

const DEFENCE = {
  kind: 'BATTLE', id: 'r-defend', missionId: 'm-defend', at: iso(-95), grade: 'REPELLED', replayStatus: 'AVAILABLE',
  attacking: false, opponentName: 'Sable', opponentPlanet: 'Tharsis', opponentPlanetId: 'p-tharsis',
  yourPlanet: 'Thistle-88', yourPlanetId: 'p-88', neutral: false,
  attackerClan: { id: 'c-3', name: 'Iron Choir', tag: 'IRON' }, defenderClan: null,
  rounds: [
    { round: 1, attackerRoll: 0.96, defenderRoll: 1.05, attackerDamage: 4_200, defenderDamage: 5_600, shieldBefore: 3_000, shieldAfter: 900,
      shieldAbsorbed: 2_100, shieldBreakerDamage: 0, attackerHullDamage: 2_100, attackerLosses: { VIPER: 7 }, defenderLosses: { DART: 4 } },
    { round: 2, attackerRoll: 1.02, defenderRoll: 0.98, attackerDamage: 1_100, defenderDamage: 4_800, shieldBefore: 900, shieldAfter: 0,
      shieldAbsorbed: 900, shieldBreakerDamage: 0, attackerHullDamage: 200, attackerLosses: { VIPER: 9, COURIER: 4 }, defenderLosses: { BASTION: 2 } },
  ],
  yourFleet: { DART: 30, PIKE: 12, BASTION: 4 },
  yourLosses: { DART: 4, BASTION: 2 },
  theirFleet: { VIPER: 22, COURIER: 6 },
  theirLosses: { VIPER: 16, COURIER: 4 },
  lootAlloy: 0, lootCrystal: 0, lootDeuterium: 0,
  dominion: 64, dominionBreakdown: null,
  honor: { delta: 12_000_000, reason: 'COMBAT' },
  shieldAbsorbed: 3_000, shieldBefore: 3_000, shieldAfter: 0, cargoLimited: false,
  defenceSalvage: { BASTION: 1 }, wreckValue: 3_800, disruptedMinutes: 0,
  yourDamage: [{ hull: 'PIKE', count: 2, damageBp: 2_200 }],
};

const PIRATE = {
  kind: 'BATTLE', id: 'r-pirate', missionId: null, pirateRaidId: 'raid-7', at: iso(-8), grade: 'DECISIVE', replayStatus: 'AVAILABLE',
  pirate: { level: 2, callsign: 'Rook', damageMult: 0.7, capturedHull: 'VIPER' },
  attacking: true, opponentName: 'Pirate L2-Rook', opponentPlanet: '', opponentPlanetId: null,
  yourPlanet: 'Bellwether', yourPlanetId: 'p-1', neutral: false,
  rounds: [
    { round: 1, attackerRoll: 1.06, defenderRoll: 0.94, attackerDamage: 7_200, defenderDamage: 1_900, shieldAbsorbed: 0, shieldBreakerDamage: 0,
      attackerHullDamage: 7_200, attackerLosses: { DART: 2 }, defenderLosses: { CORSAIR: 9 } },
    { round: 2, attackerRoll: 0.99, defenderRoll: 1.0, attackerDamage: 3_100, defenderDamage: 300, shieldAbsorbed: 0, shieldBreakerDamage: 0,
      attackerHullDamage: 3_100, attackerLosses: {}, defenderLosses: { CORSAIR: 5, VIPER: 1 } },
  ],
  yourFleet: { DART: 24, TALON: 8, COURIER: 6 },
  yourLosses: { DART: 2 },
  theirFleet: {},
  theirLosses: { CORSAIR: 14, VIPER: 1 },
  lootAlloy: 2_400, lootCrystal: 900, lootDeuterium: 120,
  dominion: null, dominionBreakdown: null,
  shieldAbsorbed: 0, cargoLimited: false, defenceSalvage: {}, wreckValue: 0, disruptedMinutes: 0, yourDamage: [],
};

/** A Death Star that landed on your world (C17): what it broke, what it burned, the orders it took. */
const STRIKE = {
  kind: 'STRATEGIC', id: 's-hit', missionId: 'm-hit', at: iso(-40), attacking: false,
  opponentName: 'Sable', opponentPlanet: 'Tharsis', opponentPlanetId: 'p-tharsis', yourPlanet: 'Thistle-88', yourPlanetId: 'p-88',
  outcome: 'FIRST_STRIKE', damage: 18_400, shieldDestroyed: 2_400, trigger: null, loyalty: null,
  destroyedFleet: { DART: 6, PIKE: 4 }, destroyedResources: { alloy: 4_200, crystal: 1_800, deuterium: 300 },
  levelChanges: [{ kind: 'BUILDING', id: 'SHIPYARD', before: 6, after: 5 }, { kind: 'INSTRUMENT', id: 'RADAR', before: 4, after: 3 }],
  destroyedOrders: [
    { kind: 'HULL', subject: 'VIPER', count: 3, cost: { alloy: 1_800, crystal: 900, deuterium: 0 } },
    { kind: 'BUILDING', subject: 'DEUTERIUM_PLANT', count: 1, cost: { alloy: 2_600, crystal: 1_400, deuterium: 0 } },
  ],
};

/** Your radiation bomb on a rival colony (C17): the works it faulted and the loyalty it cost. */
const BOMB = {
  kind: 'STRATEGIC', id: 's-bomb', missionId: 'bomb:m-bomb', at: iso(-12), attacking: true,
  opponentName: 'VEX', opponentPlanet: 'Kestrel', opponentPlanetId: 'p-kestrel', yourPlanet: 'Bellwether', yourPlanetId: 'p-1',
  outcome: 'FIRST_STRIKE', damage: 0, shieldDestroyed: 0, trigger: null, loyalty: { before: 64, after: 44 },
  radiation: { level: 2, activeUntil: iso(180), faults: ['REFINERY_OUTAGE', 'TELESCOPE_FAULT'] },
  destroyedFleet: {}, destroyedResources: { alloy: 0, crystal: 0, deuterium: 0 }, levelChanges: [], destroyedOrders: [],
  honor: { delta: 6_000_000, reason: 'TACTICAL', breakdown: { teamDelta: 6_000_000, rawTeamDelta: 6_000_000, participants: 1, contributionPpm: 1_000_000, militaryDamage: 0, permanentLoss: 0, tactical: true } },
};

/** A wave into a held monument (C17): half won, a clan beside a neutral garrison, an escort, four rounds. */
const MONUMENT = {
  kind: 'MONUMENT', id: 'mb-3', at: iso(-55), attacking: true, grade: 'PARTIAL', control: 'DEFENDER', roundCount: 4,
  replayStatus: 'AVAILABLE', enemyFleetVisibility: 'FULL',
  monument: { id: '00000000-0000-4000-8000-000000000003', ordinal: 3, position: { x: 6000, y: 410, z: -500 } },
  yourFleet: { CITADEL: 3, ARGOSY: 2, DART: 12 }, yourSurvivors: { CITADEL: 2, ARGOSY: 1, DART: 5 }, yourLosses: { CITADEL: 1, ARGOSY: 1, DART: 7 },
  yourDamage: [{ hull: 'CITADEL', count: 1, damageBp: 3_200, remainderBp: 0 }],
  theirFleet: { DART: 20, PIKE: 8 }, theirLosses: { DART: 12, PIKE: 2 }, lootDeuterium: 17, dominion: -123,
  honor: { delta: 9_000_000, reason: 'COMBAT', breakdown: { teamDelta: 9_000_000, rawTeamDelta: 9_000_000, participants: 1, contributionPpm: 1_000_000, militaryDamage: 3_100, permanentLoss: 2_400 } },
  opponents: [
    { kind: 'PLAYER', playerId: 'pl-sable', name: 'Sable', clanName: 'Iron Choir', clanTag: 'IRON' },
    { kind: 'NEUTRAL', playerId: null, name: '', clanName: null, clanTag: null },
  ],
  admirals: [{ side: 'attack', ship: 'muhafiz', level: 2 }],
  rounds: [
    { round: 1, yourLosses: { DART: 4 }, theirLosses: { DART: 6 }, yourRetreated: {}, theirRetreatedCount: 0 },
    { round: 2, yourLosses: { DART: 3, ARGOSY: 1 }, theirLosses: { DART: 4, PIKE: 1 }, yourRetreated: {}, theirRetreatedCount: 0 },
    { round: 3, yourLosses: { CITADEL: 1 }, theirLosses: { DART: 2 }, yourRetreated: {}, theirRetreatedCount: 0 },
    { round: 4, yourLosses: {}, theirLosses: { PIKE: 1 }, yourRetreated: {}, theirRetreatedCount: 0 },
  ],
};

/** Each view's report, and the id its notification would carry (a pirate raid has no mission). */
const SHEETS = new Map<string, { door: string; report: unknown }>([
  ['report-sheet', { door: RAID.missionId, report: RAID }],
  ['report-sheet-defend', { door: DEFENCE.missionId, report: DEFENCE }],
  ['report-sheet-pirate', { door: PIRATE.pirateRaidId, report: PIRATE }],
  ['report-sheet-strike', { door: STRIKE.missionId, report: STRIKE }],
  ['report-sheet-bomb', { door: BOMB.missionId, report: BOMB }],
  ['report-sheet-monument', { door: MONUMENT.id, report: MONUMENT }],
]);

export function GalleryReports({ view }: { view: string }) {
  const client = useQueryClient();
  const sheet = SHEETS.get(view) ?? { door: RAID.missionId, report: RAID };
  useState(() => {
    client.setQueryData(['reports'], reportsSchema.parse({ rivals: [], reports: [sheet.report] }));
    return null;
  });
  return (
    <BattleReportDoor
      missionId={sheet.door}
      onClose={noop}
      onUnavailable={noop}
      onFocusPlanet={noop}
      onAttackAgain={noop}
      colonyOf={() => false}
      rivalOf={() => 1}
      onShare={noop}
    />
  );
}
