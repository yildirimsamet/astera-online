import { describe, expect, it } from 'vitest';
import { commanderShipSchema } from '../src/api/commanderShipSchemas.js';
import { PARK, homewardShip, parkPose, parkedShip, refreshAfter } from '../src/galaxy/parkedShip.js';
import { homewardStandoff, legStandoff, toWorld, type PlanetNode } from '../src/galaxy/scene.js';
import type { PendingThread } from '../src/api/schemas.js';

const capitalPlanetId = '00000000-0000-4000-8000-000000000001';
const now = Date.parse('2026-10-25T12:00:00Z');
const view = (status: 'ready' | 'repair' | 'service' | 'admiral' | 'yarik', readyAt: string | null = null) =>
  ({ capitalPlanetId, rulesetVersion: 19, ship: { class: 'akinci' as const, level: 4, status, readyAt } });

describe('the commander ship parked by its capital (KG-A20)', () => {
  it('parks a ready ship at its own capital, orbiting', () => {
    expect(parkedShip(view('ready'), now)).toEqual({ planetId: capitalPlanetId, ship: 'akinci', level: 4, docked: false, reason: null, until: null });
  });

  it('holds a ship still while its repair or service runs, and lets it fly once the clock passes', () => {
    const later = new Date(now + 60_000).toISOString();
    expect(parkedShip(view('repair', later), now)).toMatchObject({ docked: true, reason: 'repair', until: now + 60_000 });
    expect(parkedShip(view('service', later), now)).toMatchObject({ docked: true, reason: 'service' });
    expect(parkedShip(view('repair', later), now + 60_000)?.docked).toBe(false);
  });

  it('draws nothing for a ship that is away, or for a commander without one', () => {
    expect(parkedShip(view('yarik'), now)).toBeNull();
    expect(parkedShip(view('admiral'), now)).toBeNull();
    expect(parkedShip({ capitalPlanetId, rulesetVersion: 19, ship: null }, now)).toBeNull();
    expect(parkedShip(undefined, now)).toBeNull();
  });

  it('asks the server again when the repair ends, never sooner than five seconds or later than a minute', () => {
    expect(refreshAfter(view('repair', new Date(now + 20_000).toISOString()), now)).toBe(20_000);
    expect(refreshAfter(view('repair', new Date(now + 1_000).toISOString()), now)).toBe(5_000);
    expect(refreshAfter(view('repair', new Date(now + 600_000).toISOString()), now)).toBe(60_000);
    expect(refreshAfter(view('ready'), now)).toBe(60_000);
  });

  it('orbits inside the phone\'s home framing, nose along its travel, and stands at one phase when docked', () => {
    const planet = { position: [10, 2, -4] as [number, number, number], radius: 0.5 };
    const a = parkPose(planet, 0, false); const b = parkPose(planet, 1, false);
    const reach = Math.hypot(a.x - 10, a.z + 4);
    expect(Math.abs(a.y - 2)).toBeLessThanOrEqual(reach * PARK.tilt);
    expect(reach).toBeCloseTo(planet.radius * PARK.radius, 6);
    expect(PARK.radius).toBeLessThanOrEqual(1.75);
    const heading = Math.atan2(b.x - a.x, b.z - a.z);
    expect(Math.abs(Math.atan2(Math.sin(heading - a.yaw), Math.cos(heading - a.yaw)))).toBeLessThan(0.05);
    expect(parkPose(planet, 0, true)).toEqual(parkPose(planet, 500, true));
  });

  describe('flying home alone after its fleet (Y9)', () => {
    const way = { from: { x: 4000, y: 0, z: 0 }, to: { x: 0, y: 0, z: 0 }, departAt: new Date(now - 60_000).toISOString(), arriveAt: new Date(now + 120_000).toISOString() };
    const alone = { ...view('admiral', new Date(now + 3_720_000).toISOString()), homeward: way };

    it('flies the server\'s way from the battle home, and is gone once it lands', () => {
      expect(commanderShipSchema.parse(alone)).toEqual(alone);
      expect(homewardShip(alone, now)).toEqual({ ship: 'akinci', level: 4, path: { from: way.from, to: way.to, departAt: new Date(way.departAt), arriveAt: new Date(way.arriveAt) } });
      expect(homewardShip(alone, now + 120_000)).toBeNull();
      expect(homewardShip(view('admiral'), now)).toBeNull();
      expect(parkedShip(alone, now)).toBeNull();
    });

    it('asks again when it lands, so it parks without a minute\'s gap', () => {
      expect(refreshAfter(alone, now)).toBe(60_000);
      expect(refreshAfter({ ...alone, homeward: { ...way, arriveAt: new Date(now + 20_000).toISOString() } }, now)).toBe(20_000);
    });

    it('clears the battle world and lands short of home, as a returning fleet does', () => {
      const node = (id: string, x: number): PlanetNode => ({ id, position: toWorld({ x, y: 0, z: 0 }), radius: 1 }) as unknown as PlanetNode;
      const nodes = [node('a', 0), node('b', 4000)];
      const path = { from: way.from, to: way.to, departAt: new Date(way.departAt), arriveAt: new Date(way.arriveAt) };
      const thread = { kind: 'fleet', leg: 'return', path, targetName: '', minutesRemaining: 2, arriveAt: path.arriveAt } as unknown as PendingThread;
      expect(homewardStandoff(path, nodes)).toEqual(legStandoff(thread, nodes));
      expect(homewardStandoff(path, nodes).start).toBeGreaterThan(homewardStandoff(path, nodes).end);
    });
  });

  it('refuses a reply it does not understand', () => {
    expect(commanderShipSchema.safeParse(view('ready')).success).toBe(true);
    expect(commanderShipSchema.safeParse({ ...view('ready'), ship: { class: 'akinci', level: 4, status: 'lost', readyAt: null } }).success).toBe(false);
    expect(commanderShipSchema.safeParse({ ...view('ready'), ship: { class: 'zeplin', level: 4, status: 'ready', readyAt: null } }).success).toBe(false);
  });
});
