import { describe, expect, it } from 'vitest';
import { ACADEMY_STEPS, academyCheckpoint, wealth, RESEARCH_PROJECT_IDS } from '@astera/rules';
import { academyPreview, advanceAcademy, beginAcademyOrder, academyPlanet, openAcademy, completeAcademyLesson, beginAcademyFlight } from '../src/onboarding/academyWorld.js';
import { planetSchema, previewSchema } from '../src/api/schemas.js';
import { planetArt } from '../src/ui/assets.js';
import { ACADEMY_TARGET_ID } from '../src/onboarding/academyViews.js';

describe('the local Academy world', () => {
  const now = 1_800_000_000_000;
  it('introduces the actual research catalogue without granting a project', () => {
    const planet = academyPlanet(openAcademy(now, ACADEMY_STEPS.findIndex((s) => s.id === 'research')));
    expect(planet.research.map((r) => r.id)).toEqual(RESEARCH_PROJECT_IDS);
    expect(planet.research.every((r) => r.level === 0 && !r.completed)).toBe(true);
  });
  it.each(['pirate', 'mine', 'raid'] as const)('flies %s out and home before delivering its result exactly once', (kind) => {
    const step = ACADEMY_STEPS.findIndex((s) => s.id === kind);
    const start = openAcademy(now, step);
    const flown = beginAcademyFlight(start, kind, now);
    expect(flown.flight).not.toBeNull();
    expect(academyPlanet(flown).flight.used).toBe(1);
    expect(() => beginAcademyFlight(flown, kind, now)).toThrow();
    const flight = flown.flight!;
    expect(flight.homeAt - now).toBeLessThanOrEqual(60_000);
    expect(advanceAcademy(flown, flight.homeAt - 1).step).toBe(step);
    const done = advanceAcademy(flown, flight.homeAt);
    expect(done.step).toBe(step + 1);
    expect(done.checkpoint).toEqual(academyCheckpoint(step + 1));
    expect(advanceAcademy(done, flight.homeAt + 1)).toBe(done);
    if (kind === 'mine') expect(academyPlanet(done).planet.bufferAlloy).toBeGreaterThan(0);
    else {
      expect(done.reports).toHaveLength(1);
      expect(done.reports[0]?.grade).toBe('DECISIVE');
      // BOTH LESSONS PAY. The pirate exercise asserted zero until D195, and it was
      // true for one reason: `profileHull` overwrote every warship's hold with zero,
      // so the Darts flew home empty and the tutorial taught that beating a pirate
      // is worth nothing. The hoard was always there; there was nothing to put it in.
      expect(done.reports[0]?.lootAlloy).toBeGreaterThan(0);
    }
  });
  it('authors its sky without a server preview', () => {
    expect(previewSchema.safeParse(academyPreview(now)).success).toBe(true);
  });
  it('includes completed ships and instruments in the displayed wealth', () => {
    const world = openAcademy(now, ACADEMY_STEPS.findIndex((step) => step.id === 'pirate'));
    const state = world.checkpoint;
    expect(academyPlanet(world).score.wealth).toBe(wealth({
      buildings: state.buildings, instruments: state.instruments, satellites: [],
      fleet: state.fleet, ground: {}, ...state.resources,
    }));
  });
  it('keeps an upgrade in a real timed queue until its finish', () => {
    const step = ACADEMY_STEPS.findIndex((s) => s.id === 'core');
    const world = openAcademy(now, step);
    const queued = beginAcademyOrder(world, 'core', now);
    expect(queued.pending).not.toBeNull();
    expect(academyPlanet(queued).buildings.CORE).toBe(1);
    expect(academyPlanet(queued).queues?.CONSTRUCTION).toHaveLength(1);
    expect(planetSchema.safeParse(academyPlanet(queued)).success).toBe(true);
    const end = queued.pending!.endsAt;
    expect(end - now).toBeGreaterThanOrEqual(1000);
    expect(end - now).toBeLessThanOrEqual(60_000);
    expect(advanceAcademy(queued, end - 1).step).toBe(step);
    const done = advanceAcademy(queued, end);
    expect(done.step).toBe(step + 1);
    expect(academyPlanet(done).buildings.CORE).toBe(2);
    expect(done.checkpoint).toEqual(academyCheckpoint(step + 1));
  });
  it('refuses out-of-order actions and a second commitment while busy', () => {
    const world = openAcademy(now, 2);
    expect(() => beginAcademyOrder(world, 'extractor', now)).toThrow();
    const queued = beginAcademyOrder(world, 'core', now);
    expect(() => beginAcademyOrder(queued, 'core', now)).toThrow();
  });
  it.each(['refinery', 'extractor', 'vault', 'aegis', 'shipyard', 'darts', 'prospector', 'reinforcements', 'courier'] as const)('pays %s once and completes into the shared checkpoint', (action) => {
    const step = ACADEMY_STEPS.findIndex((s) => s.id === action);
    const world = openAcademy(now, step);
    const queued = beginAcademyOrder(world, action, now);
    expect(queued.checkpoint.resources.alloy).toBe(world.checkpoint.resources.alloy - queued.pending!.order.cost.alloy);
    expect(planetSchema.safeParse(academyPlanet(queued)).success).toBe(true);
    const done = advanceAcademy(queued, queued.pending!.endsAt);
    expect(done.checkpoint).toEqual(academyCheckpoint(step + 1));
    expect(planetSchema.safeParse(academyPlanet(done)).success).toBe(true);
    expect(advanceAcademy(done, now + 100_000)).toBe(done);
  });
  it('advances introductions and rewards only when their own lesson is acknowledged', () => {
    const world = openAcademy(now);
    expect(completeAcademyLesson(world, 'welcome').step).toBe(1);
    expect(() => completeAcademyLesson(world, 'coreReward')).toThrow();
    const reward = openAcademy(now, 3);
    const claimed = completeAcademyLesson(reward, 'coreReward');
    expect(claimed.checkpoint.claimedRewards).toEqual(['CORE:2']);
    expect(() => completeAcademyLesson(claimed, 'coreReward')).toThrow();
  });
  it.each(['core', 'aegis', 'darts', 'pirate', 'mine', 'raid', 'telescope'] as const)('cannot acknowledge %s instead of doing the exercise', (action) => {
    const world = openAcademy(now, ACADEMY_STEPS.findIndex((s) => s.id === action));
    expect(() => completeAcademyLesson(world, action)).toThrow();
  });
});

describe('the world the raid lesson attacks', () => {
  /**
   * IT MUST NOT LOOK LIKE HOME. Owner report.
   *
   * Planet art is `hash(id) % 16`, so which render a world gets is decided by its
   * id and nothing else — and `academy-home` and `academy-target` both landed on
   * `planet_8`. The final lesson of the tutorial therefore asked the commander to
   * send a fleet at an exact copy of their own world, which is the one target a
   * raid lesson may not have: the whole beat is "that one is not yours".
   *
   * Asserted through `planetArt` rather than by pinning an id, because the id is
   * only the input. Rename either world and this still holds, or fails for the
   * right reason.
   */
  it('does not wear the commander’s own planet render', () => {
    const world = openAcademy(1_800_000_000_000);
    expect(planetArt(ACADEMY_TARGET_ID)).not.toBe(planetArt(world.preview.reserved.id));
  });
});
