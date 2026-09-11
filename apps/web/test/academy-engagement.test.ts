import { describe, expect, it } from 'vitest';
import { ENGAGEMENT_STANDOFF, engagementEndsAt, visualLeg } from '@astera/rules';
import { academyTarget, academyTraffic } from '../src/onboarding/academyViews.js';
import { beginAcademyFlight, openAcademy, type AcademyWorld } from '../src/onboarding/academyWorld.js';
import { ACADEMY_STEPS, academyCheckpoint } from '@astera/rules';

/**
 * THE PIRATE TURNS TO FACE WHAT IS SHOOTING AT IT — IN THE LESSON TOO. D183,
 * owner report: *"Onboarding korsan savaşı aşamasında, savaş animasyonu oynarken
 * korsan olan gemi yani Warden ateş ederken bizim filomuza doğru dönmüyor."*
 *
 * The live lane fixed this at D150: `projectGalaxyTraffic` publishes the pirate's
 * `engagement.target` as the ATTACKER's hold point, precisely so the aim vector is
 * not zero-length — "the client skipped its `lookAt` entirely and the crew sat
 * through the fight pointing wherever the orbit had last left them, with no round
 * crossing the gap because there was no gap."
 *
 * The Academy serves its own traffic payload and carried no `engagement` at all,
 * so the lesson reproduced the exact bug the live game had already fixed. The two
 * payloads are the same shape and now say the same thing.
 */
const battling = (): AcademyWorld => {
  const step = ACADEMY_STEPS.findIndex((beat) => beat.id === 'pirate');
  const world = { ...openAcademy(Date.now()), step, checkpoint: academyCheckpoint(step) };
  return beginAcademyFlight(world, 'pirate', Date.now());
};

describe('the lesson’s pirate fight', () => {
  it('publishes an engagement aimed at the attacking wing, never at itself', () => {
    const world = battling();
    const at = world.flight!.arriveAt + 1_000;
    const [contact] = academyTraffic(world, at);

    expect(contact).toBeDefined();
    expect(contact!.engagement).toBeDefined();
    const target = contact!.engagement!.target;
    const pirate = academyTarget(world);
    // A zero-length aim is the whole bug: three.js answers it with world +Z.
    expect(Math.hypot(target.x - pirate.x, target.y - pirate.y, target.z - pirate.z))
      .toBeGreaterThan(0);
    // And the attacker stands off along the line it flew in on, as the server does.
    expect(target.x).toBeLessThan(pirate.x);
  });

  it('holds the pirate at the meeting point for the length of the fight', () => {
    const world = battling();
    const at = world.flight!.arriveAt + 1_000;
    const [contact] = academyTraffic(world, at);
    expect(contact!.engagement!.arriveAt.getTime()).toBe(world.flight!.arriveAt);
    expect(contact!.engagement!.endsAt.getTime())
      .toBe(engagementEndsAt(world.flight!.arriveAt));
  });

  it('carries no engagement before the wing arrives', () => {
    const world = battling();
    const [contact] = academyTraffic(world, world.flight!.departAt + 1);
    expect(contact?.engagement).toBeUndefined();
  });

  /**
   * THE HOLD IS THE SHARED SOLVE, NOT A NUMBER INVENTED FOR THE LESSON.
   *
   * `traffic.ts` places a fighting attacker at `visualLeg(home, meet, 0,
   * ENGAGEMENT_STANDOFF).to`. Asserting the same call rather than a literal is what
   * keeps the gap the two formations fire across identical on both lanes — a lesson
   * that taught a different distance would be teaching the wrong game.
   */
  it('holds the wing where the live lane holds it', () => {
    const world = battling();
    const at = world.flight!.arriveAt + 1_000;
    const [contact] = academyTraffic(world, at);
    const expected = visualLeg(
      world.preview.reserved.position,
      academyTarget(world),
      0,
      ENGAGEMENT_STANDOFF,
    ).to;
    expect(contact!.engagement!.target).toEqual(expected);
  });
});
