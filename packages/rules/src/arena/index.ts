// Independent subpath: never re-export these through the galaxy rules barrel.
export { ARENA_TUNING, type FlightTuning } from './tuning.js';
export { DEFAULT_STEERING, clampAssist, createInput, sampleAssist, sampleInput, shapeSteering } from './controls.js';
export { createFlightState, stepFlight } from './flight.js';
export { fuelBurn, remainingFlightSeconds } from './fuel.js';
export { ARENA_LAYOUT, ARENA_SEED, buildArenaLayout, spawnFlight } from './layout.js';
export { queryObstacles } from './grid.js';
export { clampToArena, nearestObstacle, segmentObstacles, separate, type Contact } from './collision.js';
export { assistSteer, gimbalAim, leadPoint, leadTime } from './aim.js';
export { alignUp, forwardVector, sideVector, toLocal, upVector } from './vec.js';
export { alive, PHASES } from './pilot.js';
export { scatter } from './combat.js';
export { FARM_KINDS, FARM_POINTS, FIELD_GROUP_SIZE, FIELD_SPAWNS, emptyHold, holdPoints, pickFieldSpawn, type FarmKind, type FieldSpawn } from './farms.js';
export { createBrain, type BotBrain, type BotRole } from './bots.js';
export { hiddenBySmoke } from './visibility.js';
export {
  createSandboxWorld, stepSandboxWorld, stepArenaWorld, stepPredictedTracers, createPilot, recoverPilot, copyFlight,
  pilotVisible, predictPilot, type WorldOptions,
} from './world.js';
export { ARENA_PROTOCOL, MAX_REMOTE_PILOTS, PILOT_WIDTH, packPilot, unpackPilot, decodeArenaSnapshot } from './protocol.js';
export type { ArenaSnapshot } from './protocol.js';
export type { ArenaWorld } from './world.js';
export type { ArenaIntent, CargoDrop, Impact, Pilot, PilotPhase, Projectile, SmokePuff } from './pilot.js';
export type {
  ArenaField, ArenaLayout, ArenaObstacle, ArenaStructure, BoxObstacle, FlightInput, FlightState, ObstacleKind, Quaternion,
  SphereObstacle, SteeringSettings, StructureKind, Vec3,
} from './types.js';
