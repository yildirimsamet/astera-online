import { MOON } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { activeGateFlashes } from '../src/galaxy/MoonGateFlashes.js';

/*
  Owner 2026-11-24: the public Moon Gate flash is the gate itself (the Astral Gate the owner sees on their own
  jump), not a growing dashed ring. Every other commander sees it for MOON.flashSeconds; the commander whose
  own warp is already playing there does not see a second one.
*/
const now = Date.parse('2026-11-24T12:00:00Z');
const at = (secondsAgo: number) => new Date(now - secondsAgo * 1_000);

describe('the public Moon Gate flashes', () => {
  it('opens a gate per arrival and departure still inside the window, coloured by its side', () => {
    const flashes = activeGateFlashes({
      arrivals: [{ planetId: 'a', at: at(5) }, { planetId: 'old', at: at(MOON.flashSeconds + 1) }],
      departures: [{ planetId: 'd', at: at(30) }],
    }, now, new Set());
    expect(flashes.map((f) => [f.planetId, f.side])).toEqual([['a', 'arrival'], ['d', 'departure']]);
    expect(flashes[0]!.ageSec).toBeCloseTo(5);
  });

  it('starts closing just before the window ends, never after', () => {
    const [open] = activeGateFlashes({ arrivals: [{ planetId: 'a', at: at(10) }], departures: [] }, now, new Set());
    const [closing] = activeGateFlashes({ arrivals: [{ planetId: 'a', at: at(MOON.flashSeconds - 0.5) }], departures: [] }, now, new Set());
    expect(open!.closing).toBe(false);
    expect(closing!.closing).toBe(true);
  });

  it('leaves a world whose own warp is already playing to that warp', () => {
    const flashes = activeGateFlashes({
      arrivals: [{ planetId: 'mine', at: at(2) }], departures: [{ planetId: 'mine-too', at: at(2) }],
    }, now, new Set(['mine', 'mine-too']));
    expect(flashes).toEqual([]);
  });

  it('keys a flash by its world, side and moment so a second jump re-opens the gate', () => {
    const first = activeGateFlashes({ arrivals: [{ planetId: 'a', at: at(40) }], departures: [] }, now, new Set());
    const second = activeGateFlashes({ arrivals: [{ planetId: 'a', at: at(3) }], departures: [] }, now, new Set());
    expect(first[0]!.key).not.toBe(second[0]!.key);
  });
});
