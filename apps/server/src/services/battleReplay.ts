import {
  BATTLE_REPLAY_RESEARCH, HULLS, combatValue, createBattleRecording, fleetCount, partitionCombatFleet,
  type BattleRecording, type BattleReplayData, type BattleReplayOwner, type BattleSide,
  type BattleReplayStatus, type CombatResult, type DefenderStack, type EscapeOutcome, type JointAttackerStack,
} from '@astera/rules';
import { and, eq, inArray } from 'drizzle-orm';
import type { Db, Queryable, Tx } from '../db/client.js';
import { battleReplays, battleReports, clanWarParticipantResults, clanSupportBattleResults, monumentBattles, monumentBattleParticipants } from '../db/schema.js';
import { GameError } from './planet.js';

/** Visual capture ceilings never cap fleets or change a battle's outcome. */
export const BATTLE_REPLAY_LIMITS = { ships: 2000, hits: 100000, bytes: 8 * 1024 * 1024 } as const;
type ReplayStack = JointAttackerStack | DefenderStack;
export interface BattleReplayCapture {
  recording: BattleRecording | undefined;
  reason: 'TOO_LARGE' | 'NOT_RECORDED' | null;
  attackerVisible: boolean;
  owners: BattleReplayOwner[];
  participants: { playerId: string; alias: string }[];
  aliases: ReadonlyMap<string, { playerId: string; stackId: string }>;
}
const stackKey = (side: BattleSide, id: string) => `${side}:${id}`;
const stackId = (stack: ReplayStack) => 'contributionId' in stack ? stack.contributionId : stack.stackId;
const ready = (stack: ReplayStack) => 'maintenanceExempt' in stack && stack.maintenanceExempt
  ? stack.fleet : partitionCombatFleet(stack.fleet, stack.damage).eligible;

/** Freeze eligibility and combat research before settlement mutates any live inventory. */
export function prepareBattleReplay(attackers: readonly JointAttackerStack[], defenders: readonly DefenderStack[], options: { wingIds?: ReadonlyMap<string, string> } = {}): BattleReplayCapture {
  const power = (stacks: readonly ReplayStack[]) => stacks.reduce((sum, stack) => sum + combatValue(ready(stack)), 0);
  const attackerVisible = power(attackers) * 2 >= power(defenders);
  const total = [...attackers, ...defenders].reduce((sum, stack) => sum + fleetCount(stack.fleet), 0);
  const modern = [...attackers, ...defenders].some(stack => stack.tech.shipShields !== false);
  const reason = !modern ? 'NOT_RECORDED' : total > BATTLE_REPLAY_LIMITS.ships ? 'TOO_LARGE' : null;
  const aliases = new Map<string, { playerId: string; stackId: string }>(), owners: BattleReplayOwner[] = [];
  const participants: BattleReplayCapture['participants'] = [];
  for (const [side, stacks] of [['ATTACK', attackers], ['DEFENCE', defenders]] as const) {
    const players = new Map<string, string>(), wings = new Map<string, number>();
    for (const [index, stack] of stacks.entries()) {
      const id = stackId(stack), wingId = options.wingIds?.get(id) ?? id;
      if (!players.has(stack.playerId)) {
        const alias = `${side}:P${players.size + 1}`;
        players.set(stack.playerId, alias); participants.push({ playerId: stack.playerId, alias });
      }
      if (!wings.has(wingId)) wings.set(wingId, wings.size + 1);
      const alias = { playerId: players.get(stack.playerId)!, stackId: `${side}:S${index + 1}` };
      aliases.set(stackKey(side, id), alias);
      const research: BattleReplayOwner['research'] = {};
      for (const key of BATTLE_REPLAY_RESEARCH) research[key] = stack.tech.tech[key] ?? 0;
      owners.push({ ...alias, side, wing: wings.get(wingId)!, research });
    }
  }
  return { attackerVisible, owners, participants, aliases, reason,
    recording: reason === null ? createBattleRecording({ hitLimit: BATTLE_REPLAY_LIMITS.hits }) : undefined };
}

export interface BattleReplayContext {
  environment: 'PLANET' | 'MONUMENT';
  aegisCapacity: number;
  defenceOffline: boolean;
  escape: EscapeOutcome | null;
  control: 'ATTACKER' | 'DEFENDER' | 'EMPTY' | null;
  aftermath?: 'PIRATE_OVERRUN' | 'CARGO_WITHDRAWAL';
}

/** Only battle facts enter the client packet; no resource stock, seed or private entity IDs. */
export function buildBattleReplay(capture: BattleReplayCapture, result: Pick<CombatResult, 'grade' | 'defenceSalvage'>, context: BattleReplayContext): BattleReplayData | null {
  const source = capture.recording;
  if (!source || source.truncated) return null;
  const used = new Set<string>();
  const ships = source.ships.map(ship => {
    const alias = capture.aliases.get(stackKey(ship.side, ship.stackId));
    if (!alias) throw new Error('battle recording contains an unknown owner');
    used.add(alias.stackId);
    return { ...ship, ...alias };
  });
  const finalState = (source.rounds.at(-1)?.after ?? source.ships).map(({ id, hp, shield, status }) => ({ id, hp, shield, status }));
  const targets = new Set(context.aftermath ? ships.filter(ship => ship.side === 'DEFENCE' && (ship.cls ?? HULLS[ship.hull].cls) === 'SUPPORT'
    && finalState.some(state => state.id === ship.id && state.status === 'ACTIVE' && state.hp > 0)).map(ship => ship.id) : []);
  for (const state of finalState) if (targets.has(state.id)) {
    state.status = context.aftermath === 'PIRATE_OVERRUN' ? 'DESTROYED' : 'RETREATED';
    if (context.aftermath === 'PIRATE_OVERRUN') { state.hp = 0; state.shield = 0; }
  }
  return {
    recording: { schemaVersion: 1, roundLimit: source.roundLimit, initialAegis: source.initialAegis, ships, rounds: source.rounds, finalState,
      ...(context.aftermath && targets.size > 0 ? { aftermath: [{ kind: context.aftermath, shipIds: [...targets] }] } : {}) },
    owners: capture.owners.filter(owner => used.has(owner.stackId)), result: { grade: result.grade, defenceSalvage: result.defenceSalvage },
    environment: context.environment, aegisCapacity: context.aegisCapacity, defenceOffline: context.defenceOffline,
    escape: context.escape ? { kind: context.escape.kind, ships: context.escape.ships } : null, control: context.control,
  };
}

export interface BattleReplaySource { kind: 'BATTLE' | 'MONUMENT'; id: string }
interface ReplayMetadata {
  status: 'AVAILABLE' | 'TOO_LARGE' | 'NOT_RECORDED';
  attackerVisible: boolean;
}
export function replayStatusFor(metadata: ReplayMetadata | undefined, attacking: boolean): BattleReplayStatus {
  if (!metadata) return 'NOT_RECORDED';
  if (attacking && !metadata.attackerVisible) return 'INSUFFICIENT_FORCE';
  return metadata.status;
}
export async function readBattleReplayMetadata(db: Queryable, kind: BattleReplaySource['kind'], ids: string[]): Promise<Map<string, ReplayMetadata>> {
  if (ids.length === 0) return new Map();
  const key = kind === 'BATTLE' ? battleReplays.battleReportId : battleReplays.monumentBattleId;
  const rows = await db.select({ id: key, status: battleReplays.status, attackerVisible: battleReplays.attackerVisible })
    .from(battleReplays).where(inArray(key, ids));
  return new Map(rows.flatMap(row => row.id === null ? [] : [[row.id, row] as const]));
}
export async function persistBattleReplay(tx: Tx, input: {
  source: BattleReplaySource; seasonId: string; capture: BattleReplayCapture;
  result: Pick<CombatResult, 'grade' | 'defenceSalvage'>; context: BattleReplayContext; at: Date;
}): Promise<void> {
  let data = buildBattleReplay(input.capture, input.result, input.context);
  const tooLarge = input.capture.recording?.truncated ?? (data !== null && Buffer.byteLength(JSON.stringify(data)) > BATTLE_REPLAY_LIMITS.bytes);
  if (tooLarge) data = null;
  await tx.insert(battleReplays).values({
    seasonId: input.seasonId,
    battleReportId: input.source.kind === 'BATTLE' ? input.source.id : null,
    monumentBattleId: input.source.kind === 'MONUMENT' ? input.source.id : null,
    attackerVisible: input.capture.attackerVisible, participants: input.capture.participants,
    status: data ? 'AVAILABLE' : tooLarge ? 'TOO_LARGE' : input.capture.reason ?? 'NOT_RECORDED',
    data, createdAt: input.at,
  }).onConflictDoNothing();
}

/** Check immutable participation and frozen eligibility before loading the large private JSON. */
export async function readBattleReplay(db: Db, player: { playerId: string; seasonId: string }, source: BattleReplaySource): Promise<{ viewer: BattleSide; ownPlayerIds: string[]; replay: BattleReplayData }> {
  return db.transaction(async tx => {
    let viewer: BattleSide | undefined;
    if (source.kind === 'MONUMENT') {
      const [participant] = await tx.select({ side: monumentBattleParticipants.side }).from(monumentBattleParticipants)
        .innerJoin(monumentBattles, eq(monumentBattles.id, monumentBattleParticipants.battleId))
        .where(and(eq(monumentBattleParticipants.battleId, source.id), eq(monumentBattleParticipants.playerId, player.playerId), eq(monumentBattles.seasonId, player.seasonId))).limit(1);
      viewer = participant?.side;
    } else {
      const [report] = await tx.select({ attacker: battleReports.attackerPlayerId, defender: battleReports.defenderPlayerId }).from(battleReports)
        .where(and(eq(battleReports.id, source.id), eq(battleReports.seasonId, player.seasonId))).limit(1);
      if (report?.attacker === player.playerId) viewer = 'ATTACK';
      else if (report?.defender === player.playerId) viewer = 'DEFENCE';
      else if (report) {
        const [joint] = await tx.select({ id: clanWarParticipantResults.reportId }).from(clanWarParticipantResults)
          .where(and(eq(clanWarParticipantResults.reportId, source.id), eq(clanWarParticipantResults.playerId, player.playerId))).limit(1);
        const [support] = await tx.select({ id: clanSupportBattleResults.reportId }).from(clanSupportBattleResults)
          .where(and(eq(clanSupportBattleResults.reportId, source.id), eq(clanSupportBattleResults.playerId, player.playerId), eq(clanSupportBattleResults.role, 'SUPPORT'))).limit(1);
        viewer = support ? 'DEFENCE' : joint ? 'ATTACK' : undefined;
      }
    }
    if (!viewer) throw new GameError('NOT_FOUND', 'Battle replay not found', 404);
    const metadata = (await readBattleReplayMetadata(tx, source.kind, [source.id])).get(source.id);
    const status = replayStatusFor(metadata, viewer === 'ATTACK');
    if (status !== 'AVAILABLE') throw new GameError('REPLAY_UNAVAILABLE', 'Battle replay unavailable', status === 'INSUFFICIENT_FORCE' ? 403 : status === 'TOO_LARGE' ? 409 : 404, { reason: status });
    const key = source.kind === 'BATTLE' ? battleReplays.battleReportId : battleReplays.monumentBattleId;
    const [row] = await tx.select({ data: battleReplays.data, participants: battleReplays.participants }).from(battleReplays).where(eq(key, source.id)).limit(1);
    if (!row?.data) throw new GameError('REPLAY_UNAVAILABLE', 'Battle replay unavailable', 404);
    return { viewer, ownPlayerIds: row.participants.filter(owner => owner.playerId === player.playerId).map(owner => owner.alias), replay: row.data };
  }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
}
