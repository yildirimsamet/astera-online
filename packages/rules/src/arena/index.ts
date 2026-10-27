// Independent subpath: never re-export these through the galaxy rules barrel.
export { ARENA_TUNING, type FlightTuning } from './tuning.js';
export { CLASS_HULLS, CLASS_STATS, SHIP_CLASSES, classTuning, type ClassStats, type ShipClass } from './classes.js';
export { DEFAULT_STEERING, clampAssist, createInput, sampleAssist, sampleInput, shapeSteering, steeringGain } from './controls.js';
export { createFlightState, stepFlight } from './flight.js';
export { fuelBurn, lowFuel, remainingFlightSeconds } from './fuel.js';
export { ARENA_LAYOUT, ARENA_SEED, buildArenaLayout, obstacleSize, spawnFlight } from './layout.js';
export { queryObstacles } from './grid.js';
export { createMesh, meshClosestPoint, meshRay, meshSegmentClosest, type ArenaMesh, type SegmentPoint, type SurfacePoint } from './mesh.js';
export { ARENA_CATALOG, catalogMeshes, decodeEntry, type CatalogEntry, type CatalogFamily } from './catalog.js';
export { PLANS } from './plans.js';
export { blueprintPorts, blueprintPoses, openPorts, quarter, type Blueprint, type BlueprintPiece, type PlacedPort, type QuarterTurn } from './blueprints.js';
export { arenaMeshes, STRUCTURE_CATALOG, STRUCTURE_MESH_BASE, structureMeshes, type StructureEntry, type StructureMark } from './structures.js';
export { clampToArena, closestSurface, hullCandidates, hullGap, nearestObstacle, segmentObstacles, separate, surfaceGap, type Contact } from './collision.js';
export { hullCapsule, hullReach, segmentCapsule, sweptHull, type Capsule } from './hull.js';
export { aimCone, assistSteer, circleAim, gimbalAim, leadPoint, leadTime, type AimCone } from './aim.js';
export { alignUp, forwardVector, sideVector, toLocal, upVector } from './vec.js';
export { alive, PHASES, TACTICS, sameSide } from './pilot.js';
export { SCANNED, mirrorPose, scanTargets, type Scan } from './tactics.js';
export { HIT_REFERENCE, RING_DISTANCE, SPREAD_PATTERN, SPREAD_REACH, hitShare, scatter, spreadAt, strike } from './combat.js';
export { SIGNATURE_COOLDOWN, lockShare, locked } from './signatures.js';
export { ABILITIES, AFFINITY, MAX_POINT_RANK, abilityRank, abilityStats, flightRanks, pointsLeft, type Ability, type AbilityPoints, type FlightRanks } from './ranks.js';
export { FARM_KINDS, FARM_POINTS, FIELD_GROUP_SIZE, FIELD_SPAWNS, emptyHold, holdPoints, pickFieldSpawn, type FarmKind, type FieldSpawn } from './farms.js';
export { createBrain, type BotBrain, type BotRole } from './bots.js';
export { ARENA_ECONOMY, FULL_LOADOUT, LOADOUT, classChangeOpen, dailyCap, entryOpen, launchLoad, loadoutPlan, refillCost, repairQuote, settleHold, type LoadoutPlan, type Resources as ArenaResources } from './economy.js';
export { ARENA_PROGRESSION, GROWTH, gainXp, levelCap, levelCost, levelOf, shipStats, shipTuning, sortieXp, statsOf, xpToNext, type SortieOutcome } from './progression.js';
export { TEAM_CLAIM_DAYS, TEAM_CONNECT_SECONDS, splitTeamLoot, type SortieLoadout, type TeamMemberView, type TeamView } from './team.js';
export { dustAt, hiddenByDust, hiddenBySmoke, pilotInSight } from './visibility.js';
export {
  createSandboxWorld, stepSandboxWorld, stepArenaWorld, stepPredictedTracers, createPilot, recoverPilot, copyFlight,
  nextEntry, pilotVisible, predictPilot, ROLE_SHIPS, type WorldOptions,
} from './world.js';
export { ARENA_MAX_SEATS, ARENA_PROTOCOL, ARENA_ROSTER_MAX, FAR_EVERY, FAR_WIDTH, MAX_REMOTE_PILOTS, MID_EVERY, PILOT_WIDTH, REMOTE_BAND, REMOTE_FAR_RANGE,
  REMOTE_FULL_RANGE, REMOTE_NEAR_RANGE, REMOTE_WIDTH, packFar, packPilot, packRemote, unpackFar, unpackPilot, unpackRemote, decodeArenaSnapshot } from './protocol.js';
export type { ArenaSnapshot } from './protocol.js';
export { ARENA_POOLS, ageEffects } from './pools.js';
export { MINERAL_STEP, applyFeed, createFeedState, deltaFeed, keyFeed, stepFeedEffects, type ArenaFeed, type FeedState } from './feed.js';
export type { ArenaWorld } from './world.js';
export type { ArenaIntent, CargoDrop, Impact, Missile, Pilot, PilotPhase, Projectile, SmokePuff, Tactic } from './pilot.js';
export type {
  ArenaDust, ArenaField, ArenaLayout, ArenaObstacle, ArenaStructure, BoxObstacle, FlightInput, FlightState, MeshObstacle, ObstacleKind, Quaternion,
  SphereObstacle, SteeringSettings, StructureKind, Vec3,
} from './types.js';

export { ADMIRAL_RULESET, ADMIRAL_WAIT, ADMIRAL_XP, admiralApplies, admiralBonuses, admiralOpen, admiralDefeated, admiralOutcome, admiralXp, withAdmiral, type AdmiralBonuses, type AdmiralSnapshot, type AdmiralFlightKind } from './admiral.js';
