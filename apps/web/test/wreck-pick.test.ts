import { describe, expect, it } from 'vitest';
import { freshestWreckAt } from '../src/lib/wrecks.js';

/**
 * A TAP ON A RING OPENS THE FIELD THAT IS STILL THERE TO RACE FOR. Owner report,
 * 2026-10-15: *"Bir debris oluştuğunda hemen debris'e tıklayıp, açılan kazıcı yollama
 * sheetinde buton disabled olarak gözüküyor. Yetişemezsin diyor ama sheeti kapatıp
 * açınca veya kısa bir süre sonra buton tekrar aktif oluyor."*
 *
 * Every battle over a world leaves its own field, and production measured 780 of 1,304
 * world fields in a week born while an older one still orbited the same world. Their
 * rings are drawn on the same spot, so a tap landed on whichever the ray met first —
 * often the old one, with minutes left and nothing the craft could still reach.
 */

const field = (id: string, minutesLeft: number, planetId: string | null = 'p1', at = { x: 10, y: 0, z: 5 }) =>
  ({ id, planetId, at, alloy: 100, crystal: 50, minutesLeft });

describe('which field a tap on a wreck ring opens', () => {
  it('opens the newest field over the same world, whichever ring was hit', () => {
    const wrecks = [field('old', 6), field('new', 40), field('mid', 22)];
    expect(freshestWreckAt(wrecks, 'old')).toBe('new');
    expect(freshestWreckAt(wrecks, 'mid')).toBe('new');
    expect(freshestWreckAt(wrecks, 'new')).toBe('new');
  });

  it('never borrows a field over another world', () => {
    const wrecks = [field('here', 6, 'p1'), field('there', 40, 'p2')];
    expect(freshestWreckAt(wrecks, 'here')).toBe('here');
  });

  it('groups open-space fields only when they share the spot', () => {
    const spot = { x: 3, y: 1, z: -2 };
    const wrecks = [
      field('void-old', 5, null, spot),
      field('void-new', 35, null, { ...spot }),
      field('void-far', 39, null, { x: 90, y: 0, z: 0 }),
      field('world', 40, 'p1', spot),
    ];
    expect(freshestWreckAt(wrecks, 'void-old')).toBe('void-new');
    expect(freshestWreckAt(wrecks, 'void-far')).toBe('void-far');
  });

  it('keeps the tapped field when it is the only one, or no longer listed', () => {
    expect(freshestWreckAt([field('solo', 12)], 'solo')).toBe('solo');
    expect(freshestWreckAt([field('other', 12)], 'gone')).toBe('gone');
  });
});
