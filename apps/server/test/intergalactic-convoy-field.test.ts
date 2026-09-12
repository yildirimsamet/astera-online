import { createHmac } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  GALAXY_EVENTS,
  intergalacticConvoySpec,
  type PlannedGalaxyEvent,
} from '@astera/rules';
import { FixedClock } from '../src/clock.js';
import { createSeason } from '../src/services/season.js';
import { joinSeason } from '../src/services/player.js';
import { activeGalaxyEvents } from '../src/services/galaxyEvents.js';
import {
  activeIntergalacticConvoy,
  intergalacticConvoyOf,
} from '../src/services/intergalacticConvoyField.js';
import { makeAccount, testDb, truncateAll } from './helpers.js';
import { activeGalaxyEventsSchema } from '../../web/src/api/schemas.js';

type PlannedConvoy = Extract<PlannedGalaxyEvent, { kind: 'INTERGALACTIC_CONVOY' }>;

const START = new Date('2026-09-01T21:00:00.000Z'); // TRT midnight
const effect = GALAXY_EVENTS.definitions.INTERGALACTIC_CONVOY.windows[0]?.effect
  ?? (() => { throw new Error('missing convoy definition'); })();
const occurrence: PlannedConvoy = {
  kind: 'INTERGALACTIC_CONVOY',
  sequence: 3,
  startsAtMinute: 7 * 60,
  endsAtMinute: 9 * 60,
  definitionVersion: 2,
  effect,
};

beforeEach(async () => { await truncateAll((await testDb()).db); });
afterAll(async () => { await (await testDb()).close(); });

describe('the private-key convoy field', () => {
  it('is stable across repeated reads and differs across season secrets', () => {
    expect(intergalacticConvoyOf('season-a', occurrence))
      .toEqual(intergalacticConvoyOf('season-a', occurrence));
    expect(intergalacticConvoyOf('season-a', occurrence).from)
      .not.toEqual(intergalacticConvoyOf('season-b', occurrence).from);
  });

  it('uses the frozen route-v1 HMAC namespace and draw order', () => {
    const digest = createHmac('sha256', 'season-a')
      .update('intergalactic-convoy:route:v1:3')
      .digest();
    let draw = 0;
    const expected = intergalacticConvoySpec(occurrence, () => {
      const value = digest.readUInt32BE(draw * 4) / 0x1_0000_0000;
      draw += 1;
      return value;
    });
    expect(intergalacticConvoyOf('season-a', occurrence)).toEqual(expected);
  });

  it('keys the cache by the complete occurrence snapshot', () => {
    const shifted = { ...occurrence, startsAtMinute: 19 * 60, endsAtMinute: 21 * 60 };
    const first = intergalacticConvoyOf('season-a', occurrence);
    const second = intergalacticConvoyOf('season-a', shifted);
    expect(second.appearsAt).toBe(19 * 60);
    expect(second.expiresAt).toBe(21 * 60);
    expect(second.direction).toEqual(first.direction);
  });

  it('returns only the active half-open occurrence', () => {
    expect(activeIntergalacticConvoy('season-a', [occurrence], 7 * 60 - 0.001)).toBeNull();
    expect(activeIntergalacticConvoy('season-a', [occurrence], 7 * 60)?.sequence).toBe(3);
    expect(activeIntergalacticConvoy('season-a', [occurrence], 9 * 60)).toBeNull();
  });
});

describe('the authenticated active event projection', () => {
  it('publishes a route only while its ruleset-8 occurrence is active', async () => {
    const { db } = await testDb();
    const clock = new FixedClock(new Date(START.getTime() + (7 * 60 - 1) * 60_000));
    const { season } = await createSeason(db, {
      shardCode: 'EU-CONVOY-FIELD',
      seed: 4512,
      startsAt: START,
      playerCap: 60,
      rulesetVersion: 8,
    });
    const account = await makeAccount(db, 'ConvoyFieldTester');
    await joinSeason(db, account.id, season.id, clock);

    expect((await activeGalaxyEvents(db, account.id, clock))
      .some(({ kind }) => kind === 'INTERGALACTIC_CONVOY')).toBe(false);

    clock.set(new Date(START.getTime() + 7 * 60 * 60_000));
    const active = (await activeGalaxyEvents(db, account.id, clock))
      .find((event) => event.kind === 'INTERGALACTIC_CONVOY');
    expect(activeGalaxyEventsSchema.parse({ events: [active] }).events).toHaveLength(1);
    if (active?.kind !== 'INTERGALACTIC_CONVOY') throw new Error('missing active convoy');
    expect(active.appearsAtMinute).toBe(7 * 60);
    expect(active.expiresAtMinute).toBe(9 * 60);
    expect(active.visual).toEqual({ formationVersion: 1 });
    expect(active.rewardPolicy.resourceCapHours).toBe(2);
    expect(active.rewardPolicy.shipDropChanceAtFullQuality).toBe(0.15);
    expect(active.rewardPolicy.maxAwardedShips).toBe(3);
    expect(typeof active.route.from.x).toBe('number');
    expect(active.route.to).toEqual({
      x: -active.route.from.x,
      y: -active.route.from.y,
      z: -active.route.from.z,
    });
    expect(Math.hypot(
      active.route.velocity.x,
      active.route.velocity.y,
      active.route.velocity.z,
    )).toBeCloseTo(active.route.speed, 10);
    expect(JSON.stringify(active)).not.toContain(season.asteroidKey);

    clock.set(new Date(START.getTime() + 9 * 60 * 60_000));
    expect((await activeGalaxyEvents(db, account.id, clock))
      .some(({ kind }) => kind === 'INTERGALACTIC_CONVOY')).toBe(false);
  });
});
