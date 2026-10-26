import type { BattleRecording, BattleShipState, BattleSide, RecordedAegisStrike, RecordedHit, RecordedShot } from '@astera/rules';

interface EventBase { at: number; round: number; afterBattle?: true }
interface HitEvent extends EventBase { side: BattleSide; shot: RecordedShot; hit: RecordedHit }
export type ReplayEvent =
  | EventBase & { kind: 'SHOT'; side: BattleSide; shot: RecordedShot; impactAt: number; impactEnd: number }
  | EventBase & { kind: 'AEGIS_STRIKE'; strike: RecordedAegisStrike; launchAt: number; endAt: number }
  | HitEvent & { kind: 'AEGIS_HIT' }
  | HitEvent & { kind: 'HIT' }
  | EventBase & { kind: 'DESTROY'; shipId: string }
  | EventBase & { kind: 'RETREAT'; shipId: string }
  | EventBase & { kind: 'ROUND_END' };
export type ShotEvent = Extract<ReplayEvent, { kind: 'SHOT' }>;
export type AegisStrikeEvent = Extract<ReplayEvent, { kind: 'AEGIS_STRIKE' }>;
export type RetreatEvent = Extract<ReplayEvent, { kind: 'RETREAT' }>;
export interface ReplayRound { round: number; start: number; openingEnd: number; defenderStart: number; retreatAt: number; end: number }
export interface ReplayTimeline { recording: BattleRecording; events: ReplayEvent[]; rounds: ReplayRound[]; duration: number }
export interface DamageBadge { targetId: string; hullDamage: number; shieldDamage: number; at: number }
export const DAMAGE_BADGE_SECONDS = 1.2;
/**
 * The longest one side's fire is drawn, in replay seconds. A side whose shots, one at a time, would
 * take longer fires them as one overlapping volley inside this window: 200 ships fire in 16 seconds,
 * not seven minutes. Every recorded shot still plays, in order, and stepping still lands on each.
 */
export const VOLLEY_SECONDS = 16;
const FLIGHT = .8, SHOT_GAP = .9;
const spreadOf = (shot: RecordedShot) => Math.min(.55, shot.hits.length * .035);

/** Presentation serialises the real shots. It never re-solves combat or removes a frozen firing right. */
export function buildReplayTimeline(recording: BattleRecording): ReplayTimeline {
  const events: ReplayEvent[] = [], rounds: ReplayRound[] = [];
  let cursor = 0;
  for (const round of recording.rounds) {
    const start = cursor;
    cursor += .9;
    for (const strike of round.aegisStrikes ?? []) {
      events.push({ kind: 'AEGIS_STRIKE', strike, round: round.round, launchAt: cursor, at: cursor + .55, endAt: cursor + 1.25 });
      cursor += 1.65;
    }
    const openingEnd = cursor;
    let defenderStart = cursor;
    const currentShots = new Map<string, ShotEvent>();
    const lethal = new Map<string, number>();
    for (const [side, shots] of [['ATTACK', round.attackerShots], ['DEFENCE', round.defenderShots]] as const) {
      if (side === 'DEFENCE') { cursor += .75; defenderStart = cursor; }
      const serial = shots.reduce((sum, shot) => sum + FLIGHT + spreadOf(shot) + SHOT_GAP, 0);
      const stride = serial > VOLLEY_SECONDS ? VOLLEY_SECONDS / shots.length : null;
      const phaseStart = cursor;
      let phaseEnd = cursor;
      for (const [index, shot] of shots.entries()) {
        if (stride !== null) cursor = phaseStart + index * stride;
        const spread = spreadOf(shot);
        const impactAt = cursor + FLIGHT, impactEnd = impactAt + spread;
        const event: ShotEvent = { kind: 'SHOT', side, shot, round: round.round, at: cursor, impactAt, impactEnd };
        events.push(event); currentShots.set(shot.sourceId, event);
        for (let j = 0; j < shot.hits.length; j++) {
          const hit = shot.hits[j]!, offset = j / Math.max(1, shot.hits.length) * spread;
          if (hit.normalAegisDamage + hit.bonusAegisDamage > 0) events.push({ kind: 'AEGIS_HIT', side, shot, hit, round: round.round, at: cursor + .43 + offset });
          const at = impactAt + offset;
          events.push({ kind: 'HIT', side, shot, hit, round: round.round, at });
          if (hit.hpBefore > 0 && hit.hpAfter === 0) lethal.set(hit.targetId, at);
        }
        cursor = impactEnd + SHOT_GAP;
        phaseEnd = Math.max(phaseEnd, cursor);
      }
      cursor = phaseEnd;
    }
    for (const [shipId, at] of lethal) events.push({ kind: 'DESTROY', shipId, round: round.round,
      at: Math.max(at + .08, (currentShots.get(shipId)?.impactEnd ?? 0) + .12) });
    // Kritik hasar: ships that broke apart at the round's end blow up after the fire, before the retreats.
    for (const shipId of round.exploded ?? []) if (!lethal.has(shipId)) events.push({ kind: 'DESTROY', shipId, round: round.round, at: cursor + .1 });
    const retreatAt = cursor + .3, end = retreatAt + 1.65;
    for (const shipId of round.retreated) events.push({ kind: 'RETREAT', shipId, round: round.round, at: retreatAt });
    events.push({ kind: 'ROUND_END', round: round.round, at: end });
    rounds.push({ round: round.round, start, openingEnd, defenderStart, retreatAt, end });
    cursor = end;
  }
  for (const action of recording.aftermath ?? []) {
    for (const shipId of action.shipIds) events.push({ kind: action.kind === 'PIRATE_OVERRUN' ? 'DESTROY' : 'RETREAT', shipId, round: recording.rounds.at(-1)?.round ?? 0, at: cursor + .35, afterBattle: true });
    cursor += 2.25;
  }
  events.sort((a, b) => a.at - b.at);
  return { recording, events, rounds, duration: Math.max(1, cursor) };
}

export function sampleReplay(timeline: ReplayTimeline, seconds: number) {
  const time = Math.max(0, Math.min(timeline.duration, seconds));
  const recording = timeline.recording;
  const completed = timeline.rounds.filter(round => round.end <= time).length;
  const checkpoint = recording.rounds[completed - 1];
  const ships = new Map<string, BattleShipState>((checkpoint?.after ?? recording.ships).map(ship =>
    [ship.id, { id: ship.id, hp: ship.hp, shield: ship.shield, status: ship.status }]));
  let aegis = checkpoint?.aegisAfter ?? recording.initialAegis;
  const turn = timeline.rounds[completed];
  const round = turn?.round ?? timeline.rounds.at(-1)?.round ?? 0;
  const badges = new Map<string, DamageBadge>();
  const pendingFire = new Set<string>();
  const retreats = timeline.events.filter((event): event is RetreatEvent => event.kind === 'RETREAT' && event.at <= time);
  let activeShot: ShotEvent | undefined, activeAegisStrike: AegisStrikeEvent | undefined;
  let aegisDamage = 0, aegisNormalDamage = 0, aegisBonusDamage = 0;
  for (const event of timeline.events) {
    if (event.kind === 'AEGIS_STRIKE' && event.launchAt <= time && time < event.endAt + .4) activeAegisStrike = event;
    if (event.at > time) continue;
    if (event.afterBattle && (event.kind === 'RETREAT' || event.kind === 'DESTROY')) {
      const state = ships.get(event.shipId)!;
      state.status = event.kind === 'RETREAT' ? 'RETREATED' : 'DESTROYED';
      if (event.kind === 'DESTROY') { state.hp = 0; state.shield = 0; }
      continue;
    }
    if (!turn || event.round !== round) continue;
    if (event.kind === 'AEGIS_STRIKE') {
      aegis = event.strike.aegisAfter;
      if (time - event.at < DAMAGE_BADGE_SECONDS) { aegisBonusDamage += event.strike.damage; aegisDamage += event.strike.damage; }
    }
    if (event.kind === 'SHOT' && time <= event.impactEnd + .85) activeShot = event;
    if (event.kind === 'AEGIS_HIT') {
      aegis = event.hit.aegisAfter;
      if (time - event.at < DAMAGE_BADGE_SECONDS) {
        aegisNormalDamage += event.hit.normalAegisDamage; aegisBonusDamage += event.hit.bonusAegisDamage;
        aegisDamage += event.hit.normalAegisDamage + event.hit.bonusAegisDamage;
      }
    } else if (event.kind === 'HIT') {
      const state = ships.get(event.hit.targetId)!;
      state.hp = event.hit.hpAfter; state.shield = event.hit.shieldAfter;
      if (state.hp === 0) state.status = 'DESTROYED';
      if (time - event.at < DAMAGE_BADGE_SECONDS && event.hit.hullDamage + event.hit.shieldDamage > 0) {
        const badge = badges.get(event.hit.targetId) ?? { targetId: event.hit.targetId, hullDamage: 0, shieldDamage: 0, at: event.at };
        badge.hullDamage += event.hit.hullDamage; badge.shieldDamage += event.hit.shieldDamage; badge.at = event.at;
        badges.set(badge.targetId, badge);
      }
    } else if (event.kind === 'DESTROY') {
      const state = ships.get(event.shipId)!;
      state.hp = 0; state.status = 'DESTROYED';
    } else if (event.kind === 'RETREAT') ships.get(event.shipId)!.status = 'RETREATED';
  }
  // Zero-HP defenders remain present until their recorded shot has completed.
  for (const event of timeline.events) if (event.kind === 'SHOT' && event.round === round && event.impactEnd > time && ships.get(event.shot.sourceId)?.hp === 0) pendingFire.add(event.shot.sourceId);
  const phase: BattleSide | 'AEGIS_OPENING' | 'RETREAT' | 'ROUND_END' | 'READY' | 'AFTERMATH' | 'FINISHED' = time >= timeline.duration ? 'FINISHED'
    : !turn && (recording.aftermath?.length ?? 0) > 0 ? 'AFTERMATH' : !turn || time < turn.start + .9 ? 'READY' : time < turn.openingEnd ? 'AEGIS_OPENING' : time >= turn.retreatAt ? (round < recording.roundLimit ? 'RETREAT' : 'ROUND_END')
      : time >= turn.defenderStart ? 'DEFENCE' : 'ATTACK';
  return { time, round, ships, aegis, finished: time >= timeline.duration, pendingFire, activeShot, activeAegisStrike,
    phase, retreats, damageBadges: [...badges.values()], aegisDamage, aegisNormalDamage, aegisBonusDamage };
}
export type ReplayFrame = ReturnType<typeof sampleReplay>;

/** Field labels are a fixed pool: their cost must not grow with the fleets. */
export const READOUT_SLOTS = 6;
/** How long a ship that left the line keeps its "out of combat" label. */
export const LEAVING_LABEL_SECONDS = 1.7;

/** The ships the moment is about, most important first: picked, firing, newest hits, leaving. */
export function featuredShips(frame: ReplayFrame, selected: string | null, leaving: ReadonlyMap<string, number>): string[] {
  const ids = new Set<string>();
  const add = (id: string | undefined) => { if (id !== undefined && ids.size < READOUT_SLOTS) ids.add(id); };
  if (selected !== null) add(selected);
  add(frame.activeShot?.shot.sourceId ?? frame.activeAegisStrike?.strike.sourceId);
  for (const badge of [...frame.damageBadges].sort((a, b) => b.at - a.at)) add(badge.targetId);
  for (const [id, at] of leaving) if (frame.time >= at && frame.time - at < LEAVING_LABEL_SECONDS) add(id);
  return [...ids];
}
