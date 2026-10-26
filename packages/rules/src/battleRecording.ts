import { COMBAT } from './constants.js';
import type { Fleet, Grade, HullClass, HullId } from './types.js';
import type { TechLevels } from './tech.js';

export type BattleSide = 'ATTACK' | 'DEFENCE';
export type BattleShipStatus = 'ACTIVE' | 'DESTROYED' | 'RETREATED';
export interface BattleShipState {
  id: string;
  hp: number;
  shield: number;
  status: BattleShipStatus;
}
export interface BattleShipSnapshot extends BattleShipState {
  side: BattleSide;
  hull: HullId;
  stackId: string;
  playerId: string;
  maxHp: number;
  maxShield: number;
  attack: number;
  canFire: boolean;
  /** Frozen for historical replays; optional on early standalone recordings. */
  cls?: HullClass;
  ground?: boolean;
}
export interface RecordedHit {
  targetId: string;
  /** Zero is the initial distribution; subsequent passes redistribute unused base damage. */
  pass: number;
  baseShare: number;
  counter: number;
  hpBefore: number;
  hpAfter: number;
  shieldBefore: number;
  shieldAfter: number;
  aegisBefore: number;
  aegisAfter: number;
  bonusAegisDamage: number;
  normalAegisDamage: number;
  shieldDamage: number;
  hullDamage: number;
}
export interface RecordedShot {
  sourceId: string;
  /** Each side has its own order; both volleys retain round-entry firing rights. */
  order: number;
  baseDamage: number;
  unusedBaseDamage: number;
  hits: RecordedHit[];
}
/** The shield-only opening is separate from every normal shot and has no ship target. */
export interface RecordedAegisStrike {
  sourceId: string;
  baseDamage: number;
  classMultiplier: number;
  bonusMultiplier: number;
  damage: number;
  aegisBefore: number;
  aegisAfter: number;
}
export interface RecordedRound {
  round: number;
  attackerRoll: number;
  defenderRoll: number;
  aegisBefore: number;
  aegisAfter: number;
  aegisStrikes?: RecordedAegisStrike[];
  attackerShots: RecordedShot[];
  defenderShots: RecordedShot[];
  retreated: string[];
  /** Combat v3 critical damage: ships hit this round that broke apart. */
  exploded?: string[];
  after: BattleShipState[];
}
/** A capture of calculation values, independent of renderer timing or current balance tables. */
export interface BattleRecording {
  schemaVersion: 1;
  roundLimit: number;
  initialAegis: number;
  /** Combat v3: each side's damage scale (tempo × the stronger side's handicap), already inside every shot. */
  damageScale?: { attacker: number; defender: number };
  ships: BattleShipSnapshot[];
  rounds: RecordedRound[];
  /** Settlement actions are explicit; they never invent a weapon hit or a new combat round. */
  aftermath?: { kind: 'PIRATE_OVERRUN' | 'CARGO_WITHDRAWAL'; shipIds: string[] }[];
  finalState?: BattleShipState[];
  /** Capture-only budget. A truncated recording must never be exposed as a full replay. */
  hitLimit?: number;
  truncated?: true;
}
export function createBattleRecording(options: { hitLimit?: number } = {}): BattleRecording {
  if (options.hitLimit !== undefined && (!Number.isSafeInteger(options.hitLimit) || options.hitLimit < 0)) throw new RangeError('invalid recording hit limit');
  return { schemaVersion: 1, roundLimit: COMBAT.rounds, initialAegis: 0, ships: [], rounds: [],
    ...(options.hitLimit === undefined ? {} : { hitLimit: options.hitLimit }) };
}

export const BATTLE_REPLAY_RESEARCH = ['SHIP_POWER', 'SHIP_ARMOR', 'SHIP_SHIELDS', 'EMPLACEMENT_DOCTRINE'] as const;
export interface BattleReplayOwner {
  side: BattleSide;
  playerId: string;
  stackId: string;
  wing: number;
  research: Pick<TechLevels, typeof BATTLE_REPLAY_RESEARCH[number]>;
}
/** A viewer consumes the frozen fight, never recalculates it from today's fleet or balance. */
export interface BattleReplayData {
  recording: BattleRecording;
  owners: BattleReplayOwner[];
  result: { grade: Grade; defenceSalvage: Fleet };
  environment: 'PLANET' | 'MONUMENT';
  aegisCapacity: number;
  defenceOffline: boolean;
  escape: { kind: 'ESCAPED' | 'STRANDED'; ships: Fleet } | null;
  control: 'ATTACKER' | 'DEFENDER' | 'EMPTY' | null;
}
export type BattleReplayStatus = 'AVAILABLE' | 'NOT_RECORDED' | 'INSUFFICIENT_FORCE' | 'TOO_LARGE';
