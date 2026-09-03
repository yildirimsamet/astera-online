import { describe, expect, it } from 'vitest';
import { rendezvousMarks, toWorld } from '../src/galaxy/scene.js';

/**
 * THE POINT A CRAFT IS AIMED AT, DRAWN. D40 · D155.
 *
 * `InterceptMarks` exists because an interception is the least obvious thing in
 * the game: a craft heading for empty space looks like a bug until the thing it
 * is meeting arrives there. It was wired to mining runs only — so the mining lane
 * explained itself and the pirate lane, whose target moves faster and leads
 * further, did not. One list, two lanes, and the same mark.
 *
 * ONLY EVER THE OUTBOUND LEG. A return leg is aimed at a world that is drawn
 * already; marking it would put a ring on top of the player's own planet.
 */
describe('the rendezvous marks', () => {
  const at = (x: number) => ({ x, y: 0, z: 0 });

  it('marks where a mining run is going, and not where it has been', () => {
    const marks = rendezvousMarks(
      [
        { intercept: at(100), status: 'outbound' },
        { intercept: at(200), status: 'returning' },
      ],
      [],
    );
    expect(marks).toHaveLength(1);
    expect(marks[0]).toEqual(toWorld(at(100)));
  });

  it('marks a raid at a pirate the same way it marks a drill', () => {
    const marks = rendezvousMarks([], [
      { kind: 'pirate', leg: 'outbound', path: { to: at(100) } },
    ]);
    expect(marks).toHaveLength(1);
    expect(marks[0]).toEqual(toWorld(at(100)));
  });

  it('drops a raid on its way home — the world at that end is drawn already', () => {
    expect(rendezvousMarks([], [
      { kind: 'pirate', leg: 'return', path: { to: at(0) } },
    ])).toHaveLength(0);
  });

  it('never marks a mission at a world, which is a fixed address', () => {
    /*
      A raid, a probe, a transfer and a settlement all fly at something that is
      already on screen with a label under it. The mark means "this apparently
      empty coordinate is the target", so putting one over a planet says nothing
      and clutters the one place the disc is busiest.
    */
    for (const kind of ['fleet', 'probe', 'transfer', 'settlement', 'death_star'] as const) {
      expect(rendezvousMarks([], [
        { kind, leg: 'outbound', path: { to: at(100) } },
      ])).toHaveLength(0);
    }
  });

  it('survives a thread with no path at all — an inbound attack carries none', () => {
    expect(rendezvousMarks([], [{ kind: 'pirate', leg: 'outbound' }])).toHaveLength(0);
    expect(rendezvousMarks([], [{ kind: 'incoming' }])).toHaveLength(0);
  });

  it('marks both lanes at once', () => {
    const marks = rendezvousMarks(
      [{ intercept: at(40), status: 'outbound' }],
      [{ kind: 'pirate', leg: 'outbound', path: { to: at(80) } }],
    );
    expect(marks).toHaveLength(2);
  });
});
