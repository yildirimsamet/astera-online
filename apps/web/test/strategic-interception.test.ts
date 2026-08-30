import { describe, expect, it } from 'vitest';
import {
  STRATEGIC_INTERCEPTION_NEON,
  strategicInterceptionGeometry,
  strategicInterceptionImpactEvents,
  strategicInterceptionMissilePosition,
  strategicInterceptionPose,
} from '../src/galaxy/StrategicInterception.jsx';
import type { StrategicInterception } from '../src/api/schemas.js';

describe('strategic interception flight', () => {
  const launch = [0, 0, 0] as const;
  const control = [5, 4, 0] as const;
  const deathStarFrom = [8, 0, 0] as const;
  const collision = [10, 0, 0] as const;

  it('gives both identified strategic craft their permanent allegiance outline', () => {
    expect(STRATEGIC_INTERCEPTION_NEON).toEqual({
      deathStar: '#ff4d67',
      battery: '#3ff08a',
    });
  });

  it('starts both craft at the server-published positions', () => {
    expect(strategicInterceptionPose(
      launch,
      control,
      deathStarFrom,
      collision,
      0,
    )).toEqual({ missile: launch, deathStar: deathStarFrom });
  });

  it('puts the missile and Death Star on exactly the same collision point', () => {
    const pose = strategicInterceptionPose(
      launch,
      control,
      deathStarFrom,
      collision,
      1,
    );
    expect(pose.missile).toEqual(collision);
    expect(pose.deathStar).toEqual(collision);
  });

  it('keeps the midpoint on the authored interception arc', () => {
    const pose = strategicInterceptionPose(
      launch,
      control,
      deathStarFrom,
      collision,
      0.5,
    );
    expect(pose.missile).toEqual([5, 2, 0]);
    expect(pose.deathStar).toEqual([9, 0, 0]);
  });

  it('gives camera focus the exact same live missile position as the renderer', () => {
    const event: StrategicInterception = {
      id: 'interception-1',
      targetPlanetId: 'colony-2',
      trigger: 'RADAR',
      launchAt: new Date('2026-08-25T12:00:00.000Z'),
      impactAt: new Date('2026-08-25T12:00:04.000Z'),
      launch: { x: 0, y: 0, z: 0 },
      deathStarFrom: { x: 200, y: 0, z: 0 },
      collision: { x: 400, y: 0, z: 0 },
    };
    const geometry = strategicInterceptionGeometry(event, []);
    const expected = strategicInterceptionPose(
      geometry.launch,
      geometry.control,
      geometry.deathStarFrom,
      geometry.collision,
      0.5,
    ).missile;

    expect(strategicInterceptionMissilePosition(
      event,
      [],
      new Date('2026-08-25T12:00:02.000Z').getTime(),
    )).toEqual(expected);
  });

  it('renders public out-of-sight collision fire dimly without exposing either craft', () => {
    const events = strategicInterceptionImpactEvents([{
      id: 'impact-1',
      at: new Date('2026-08-25T12:00:04.000Z'),
      collision: { x: 400, y: 0, z: 0 },
      effectOnly: true,
      focusEligible: false,
    }], []);

    expect(events).toEqual([expect.objectContaining({
      id: 'impact-1',
      at: new Date('2026-08-25T12:00:04.000Z').getTime(),
      intensity: 0.35,
    })]);
    expect(events[0]).not.toHaveProperty('launch');
    expect(events[0]).not.toHaveProperty('deathStarFrom');
  });
});
