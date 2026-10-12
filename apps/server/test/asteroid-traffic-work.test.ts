import type { AsteroidSpec, SensorEpoch } from '@astera/rules';
import { expect, it } from 'vitest';
import { discoveredAsteroidIndexes } from '../src/services/asteroidField.js';

const rock: AsteroidSpec = {
  index: 9, level: 1, ore: 100, crystalShare: 0, deuteriumShare: 0, isotopeRich: false,
  radius: 1000, period: 100, phase: 0, inclination: 0, ascendingNode: 0, speed: 10,
  appearsAt: 0, expiresAt: 1,
};
const unused: AsteroidSpec = { ...rock, index: 19, get radius(): number {
  throw new Error('traffic solved discovery for a rock with no active mining run');
} };
const epoch: SensorEpoch = { at: { x: 0, y: 0, z: 0 }, reach: 2000, startsAt: 0, endsAt: null };
const snapshot = { asteroids: [unused, rock], startsAt: new Date(0), oreTaken: new Map<number, number>() };

it('solves only actual traffic targets while preserving discovery for an expired target return', () => {
  expect([...discoveredAsteroidIndexes(snapshot, [epoch], new Date(600_000), new Set([9]))]).toEqual([9]);
});

it('does no lane discovery work when no mining targets are in flight', () => {
  expect([...discoveredAsteroidIndexes(snapshot, [epoch], new Date(600_000), new Set())]).toEqual([]);
});
