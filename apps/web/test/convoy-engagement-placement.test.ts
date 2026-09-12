import { describe, expect, it } from 'vitest';
import { contactPosition, engagementPosition, engagementTargetPosition } from '../src/galaxy/scene.js';
import type { Contact } from '../src/api/schemas.js';

/**
 * A MOVING ENGAGEMENT IS A WINDOW, NOT A HOLD. D201.
 *
 * `traffic.ts` publishes a convoy strike as `from: currentHold → to: holdEnd` over
 * `startAt: now → endAt: engagementEndsAt`, with `engagement.targetTo` marking the
 * target as one that keeps moving. The craft therefore has to be interpolated
 * across its own window like any other contact — the stationary `engagementHold`
 * solve is the wrong question, and asking it by re-entering `contactPosition` is
 * how the two helpers called each other until the stack ran out.
 */
const arriveAt = new Date('2026-09-12T18:30:00.000Z');
const endsAt = new Date('2026-09-12T18:30:05.000Z');

/** Exactly the shape `projectGalaxyTraffic` pushes at CONTACT and IDENTIFIED. */
const moving = {
  id: 'run-1',
  kind: 'fleet',
  from: { x: 100, y: 0, z: 0 },
  to: { x: 150, y: 0, z: 0 },
  startAt: arriveAt,
  endAt: endsAt,
  landing: true,
  mass: 'MEDIUM',
  fleet: { DART: 3 },
  engagement: {
    arriveAt,
    endsAt,
    target: { x: 200, y: 0, z: 0 },
    targetTo: { x: 250, y: 0, z: 0 },
  },
} as unknown as Contact;

/** A pirate rendezvous: a degenerate window and no `targetTo`. */
const stationary = {
  id: 'raid-1',
  kind: 'fleet',
  from: { x: 100, y: 0, z: 0 },
  to: { x: 100, y: 0, z: 0 },
  startAt: arriveAt,
  endAt: endsAt,
  mass: 'MEDIUM',
  fleet: { DART: 3 },
  engagement: { arriveAt, endsAt, target: { x: 200, y: 0, z: 0 } },
} as unknown as Contact;

describe('a convoy strike that is already firing', () => {
  it('places the craft without re-entering itself', () => {
    expect(() => contactPosition(moving, arriveAt.getTime() + 2_000, [])).not.toThrow();
    expect(() => engagementPosition(moving, moving.engagement!.target, [], arriveAt.getTime()))
      .not.toThrow();
  });

  it('carries the craft along its own published window for the whole five seconds', () => {
    const start = contactPosition(moving, arriveAt.getTime(), []);
    const middle = contactPosition(moving, arriveAt.getTime() + 2_500, []);
    const end = contactPosition(moving, endsAt.getTime(), []);
    expect(start[0]).toBeCloseTo(2, 9);
    expect(middle[0]).toBeCloseTo(2.5, 9);
    expect(end[0]).toBeCloseTo(3, 9);
  });

  it('keeps the craft exactly alongside its target for the whole pass', () => {
    for (const offset of [0, 1_000, 2_500, 5_000]) {
      const craft = contactPosition(moving, arriveAt.getTime() + offset, []);
      const target = engagementTargetPosition(moving.engagement!, arriveAt.getTime() + offset);
      expect(target[0] - craft[0]).toBeCloseTo(2, 9);
    }
  });

  it('never overtakes the convoy when a refetch is late', () => {
    const late = contactPosition(moving, endsAt.getTime() + 4_000, []);
    expect(late[0]).toBeCloseTo(3, 9);
  });

  it('leaves a stationary engagement on its held point', () => {
    const held = contactPosition(stationary, arriveAt.getTime() + 2_500, []);
    expect(held).toEqual([2, 0, 0]);
  });
});
