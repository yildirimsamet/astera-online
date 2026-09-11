import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * THE ECONOMY IS MEASURED WITHOUT THE PUBLIC EVENTS. Owner instruction, 2026-09-12:
 * *"asteroid shower, tradeShip eventleri açılacak! sadece ekonomi testlerine dahil
 * edilmeyecek. Bu ARR falan hesaplamalarına!"*
 *
 * The game ships both on (`ECONOMY_PROFILE.tradeShip` / `asteroidShower`). What
 * ARR, VFR and the rest measure is what a commander PRODUCES — D183's rule that an
 * outside income is a share of a frozen reference needs that reference measured
 * clean. The simulator honours it by construction: it mines the base asteroid
 * field and never deals a calendar, a shower lane or a merchant. This holds that
 * construction, so the day somebody wires an event into a season it fails here
 * rather than quietly moving every band in `docs/balance.md`.
 */
const SOURCE = fileURLToPath(new URL('../src', import.meta.url));
const EVENT_SURFACE = [
  'generateGalaxyEventSchedule',
  'withAsteroidShowerLanes',
  'ASTEROID_SHOWER',
  'TRADE_SHIP',
  'tradeShipSpec',
  'quoteTrade',
  'tradeShip',
  'asteroidShower',
] as const;

describe('the simulator’s economy', () => {
  it('reaches for none of the public events it must not measure', () => {
    const files = readdirSync(SOURCE).filter((name) => name.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) {
      const text = readFileSync(join(SOURCE, name), 'utf8');
      for (const token of EVENT_SURFACE) {
        expect(text.includes(token), `${name} names ${token}`).toBe(false);
      }
    }
  });
});
