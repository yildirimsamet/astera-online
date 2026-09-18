import { describe, expect, it } from 'vitest';
import { MULTI_WORLD } from '@astera/rules';
import { planetNameFor } from '../src/services/player.js';

/**
 * A SERVER COMMANDER'S WORLD MAY NOT BE NAMED LIKE ONE. Found in review, 2026-09-19.
 *
 * A capital is named after its address, and since the layered galaxy the server's
 * commanders stand on addresses 1000–1099 while every person is below 1000 — so a
 * name ending in a four-digit number beginning "10" was a bot, at a glance. The bot
 * roster is built on nobody being able to tell (D159).
 */
const reserved = MULTI_WORLD.capitalSlots + MULTI_WORLD.botSlots;
const numberOf = (name: string): number => Number(name.split('-').at(-1));

describe('capital names', () => {
  it('gives every capital and bot address its own name', () => {
    const names = Array.from({ length: reserved }, (_, index) => planetNameFor(index));
    expect(new Set(names).size).toBe(reserved);
    // Every number in the reserved range is used exactly once.
    expect(names.map(numberOf).sort((a, b) => a - b))
      .toEqual(Array.from({ length: reserved }, (_, i) => i));
  });

  it('numbers a bot address from the same spread as a person’s', () => {
    const bots = Array.from({ length: MULTI_WORLD.botSlots }, (_, i) =>
      numberOf(planetNameFor(MULTI_WORLD.capitalSlots + i)));
    const high = bots.filter((n) => n >= MULTI_WORLD.capitalSlots).length;
    // About a eleventh of any address's numbers land in 1000–1099; a bot is no likelier.
    expect(high).toBeLessThan(MULTI_WORLD.botSlots * 0.25);
    expect(Math.min(...bots)).toBeLessThan(200);
  });

  it('is stable: the same address always has the same name', () => {
    expect(planetNameFor(1003)).toBe(planetNameFor(1003));
    expect(planetNameFor(17)).not.toBe(planetNameFor(18));
  });
});
