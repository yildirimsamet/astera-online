import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
  StrategicInterception,
  StrategicInterceptionImpact,
} from '../src/api/schemas.js';
import {
  reconcileOwnInterceptionImpacts,
  reconcileOwnInterceptions,
} from '../src/galaxy/ownCraft.js';

describe('camera policy for dispatched craft', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/screens/GalaxyView.tsx'),
    'utf8',
  );

  /**
   * This regression is an absence at the host: every player-directed launch used
   * to enter through one pending/mining reconciliation effect, regardless of its
   * target or vehicle. Removing that effect covers the whole shared route; keeping
   * `craftFocusRequest` below proves that only the player's row tap still follows it.
   */
  it('does not turn any new player-directed flight payload into camera focus', () => {
    expect(source).not.toMatch(/reconcileOwnCraft|seenOwnCraft/);
  });

  it('keeps the explicit route from the in-flight sheet to a craft', () => {
    expect(source).toMatch(/handledCraftFocusRequest/);
  });
});

const interception = (
  over: Partial<StrategicInterception> = {},
): StrategicInterception => ({
  id: 'interception-1',
  targetPlanetId: 'colony-2',
  trigger: 'RADAR',
  launchAt: new Date('2026-08-25T12:02:00.000Z'),
  impactAt: new Date('2026-08-25T12:02:04.000Z'),
  launch: { x: 0, y: 0, z: 0 },
  deathStarFrom: { x: -4, y: 0, z: 0 },
  collision: { x: 4, y: 0, z: 0 },
  ...over,
});

const interceptionImpact = (
  over: Partial<StrategicInterceptionImpact> = {},
): StrategicInterceptionImpact => ({
  id: 'interception-1',
  at: new Date('2026-08-25T12:02:04.000Z'),
  collision: { x: 4, y: 0, z: 0 },
  effectOnly: false,
  focusEligible: true,
  ...over,
});

describe('automatic focus for strategic interceptions', () => {
  it('focuses a newly launched interceptor from any controlled world', () => {
    const result = reconcileOwnInterceptions(
      new Set(),
      [interception()],
      new Set(['capital-1', 'colony-2']),
      new Date('2026-08-25T12:02:01.000Z').getTime(),
    );

    expect(result.focus).toEqual({ kind: 'interception', id: 'interception-1' });
  });

  it('does not focus another commander’s interceptor that destroys my Death Star', () => {
    const result = reconcileOwnInterceptions(
      new Set(),
      [interception({ targetPlanetId: 'enemy-world' })],
      new Set(['capital-1', 'colony-2']),
      new Date('2026-08-25T12:02:01.000Z').getTime(),
    );

    expect(result.focus).toBeNull();
  });

  it('does not hijack the camera for an interception learned after its flight ended', () => {
    const result = reconcileOwnInterceptions(
      new Set(),
      [interception()],
      new Set(['capital-1', 'colony-2']),
      new Date('2026-08-25T12:02:05.000Z').getTime(),
    );

    expect(result.focus).toBeNull();
  });

  it('baselines an already-running interception and never refocuses it', () => {
    const initial = reconcileOwnInterceptions(
      null,
      [interception()],
      new Set(['capital-1', 'colony-2']),
      new Date('2026-08-25T12:02:01.000Z').getTime(),
    );
    const repeated = reconcileOwnInterceptions(
      initial.seen,
      [interception()],
      new Set(['capital-1', 'colony-2']),
      new Date('2026-08-25T12:02:02.000Z').getTime(),
    );

    expect(initial.focus).toBeNull();
    expect(repeated.focus).toBeNull();
  });

  it('focuses the defender on the collision if the eight-second launch was missed', () => {
    const result = reconcileOwnInterceptionImpacts(
      new Set(),
      [interceptionImpact()],
    );

    expect(result.focus).toEqual({ kind: 'interceptionImpact', id: 'interception-1' });
  });

  it('uses a distinct collision focus even after launch follow, without moving attackers or witnesses', () => {
    const alreadyFollowed = reconcileOwnInterceptionImpacts(
      new Set(),
      [interceptionImpact()],
    );
    const attacker = reconcileOwnInterceptionImpacts(
      new Set(),
      [interceptionImpact({ focusEligible: false })],
    );

    expect(alreadyFollowed.focus).toEqual({
      kind: 'interceptionImpact',
      id: 'interception-1',
    });
    expect(attacker.focus).toBeNull();
  });
});
