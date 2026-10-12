import { MONUMENT_MOTION_RULESET, monumentMotion, motionPositionAt, interceptMotion, distance, travelExact, type Vec3, type Segment } from '@astera/rules';
import { GameError } from './planet.js';
interface MotionSeason {
  rulesetVersion: number;
  startsAt: Date;
  endsAt: Date;
  closedAt?: Date | null;
  monumentMotionStartsAt?: Date | null;
}
export const monumentMotionStart = (season: MotionSeason): Date | undefined => season.monumentMotionStartsAt
  ?? (season.rulesetVersion >= MONUMENT_MOTION_RULESET ? season.startsAt : undefined);
export const motionOfMonument = (point: Vec3, season: MotionSeason) => {
  const start = monumentMotionStart(season);
  return start ? { ...monumentMotion(point, start.getTime()), stopAtMs: (season.closedAt ?? season.endsAt).getTime() } : undefined;
};
export const monumentPosition = (point: Vec3, season: MotionSeason, at: Date): Vec3 => {
  const motion = motionOfMonument(point, season);
  return motion ? motionPositionAt(motion, Math.min(at.getTime(), season.endsAt.getTime())) : { x: point.x, y: point.y, z: point.z };
};
export const monumentRadiationTarget = (monument: { id: string }, season: MotionSeason) =>
  monumentMotionStart(season) ? { kind: 'MONUMENT' as const, id: monument.id } : undefined;
export const monumentHoldPath = (point: Vec3 & { id: string }, season: MotionSeason, startMs: number, endMs: number): Segment[] => {
  const target = monumentRadiationTarget(point, season);
  return [{ from: point, to: point, startMs, endMs, ...(target ? { target } : {}) }];
};
export function monumentFlight(from: Vec3, point: Vec3, season: MotionSeason, speed: number, departAt: Date) {
  const motion = motionOfMonument(point, season);
  if (motion) {
    const meeting = interceptMotion(from, speed, motion, departAt.getTime(), season.endsAt.getTime());
    if (!meeting)
      throw new GameError('MONUMENT_UNREACHABLE', 'The fleet cannot reach this monument before the season closes', 400);
    // Persist integer timestamps and calculate the endpoint at that same instant.
    const arriveAt = new Date(Math.ceil(meeting.arriveAt));
    if (arriveAt >= season.endsAt)
      throw new GameError('MONUMENT_UNREACHABLE', 'The fleet cannot reach this monument before the season closes', 400);
    return { at: motionPositionAt(motion, arriveAt.getTime()), arriveAt, minutes: (arriveAt.getTime() - departAt.getTime()) / 60000 };
  }
  const minutes = travelExact(distance(from, point), speed);
  return { at: { x: point.x, y: point.y, z: point.z }, arriveAt: new Date(departAt.getTime() + minutes * 60000), minutes };
}
