import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TRADE, tradeShipPosition, type TradeShipSpec } from '@astera/rules';
import { CRAFT_SCALE, toWorld, tradeShipWorldPosition, type OrbitLike } from '../src/galaxy/scene.js';
import {
  TRADE_SHIP_BASE_SCALE,
  TRADE_SHIP_SCALE,
  TRADE_SHIP_SCALE_MULT,
} from '../src/galaxy/TradeShip.js';

/**
 * TİCARET GEMİSİ, DRAWN. D156.
 *
 * The merchant is a public NPC, so — unlike a rock or a pirate — there is no fog
 * question here at all: only whether the disc draws it in the same place the
 * rules package would resolve a rendezvous against, and whether it moves.
 */

const SEASON_START = new Date('2026-01-01T00:00:00Z');

const spec = (overrides: Partial<TradeShipSpec> = {}): TradeShipSpec => ({
  sequence: 0,
  radius: 1_100,
  period: (2 * Math.PI * 1_100) / TRADE.speed,
  phase: 0.7,
  inclination: 0.5,
  ascendingNode: 1.9,
  speed: TRADE.speed,
  appearsAt: 0,
  expiresAt: 180,
  rate: { alloy: 1, crystal: 3, deuterium: 90 },
  ...overrides,
});

describe('tradeShipWorldPosition', () => {
  it('agrees with @astera/rules’s tradeShipPosition at several times across an orbit', () => {
    const orbit = spec();
    for (const minutes of [0, 3, 17, 42.5, 90, 179.9]) {
      const now = SEASON_START.getTime() + minutes * 60_000;
      const expected = toWorld(tradeShipPosition(orbit, minutes));
      const actual = tradeShipWorldPosition(orbit, SEASON_START, now);
      expect(actual[0]).toBeCloseTo(expected[0], 9);
      expect(actual[1]).toBeCloseTo(expected[1], 9);
      expect(actual[2]).toBeCloseTo(expected[2], 9);
    }
  });

  it('agrees on a second, differently-rolled orbit too — not a coincidence of one spec', () => {
    const orbit = spec({
      radius: 640,
      period: (2 * Math.PI * 640) / TRADE.speed,
      phase: 4.4,
      inclination: 2.1,
      ascendingNode: 0.2,
    });
    const now = SEASON_START.getTime() + 55 * 60_000;
    const expected = toWorld(tradeShipPosition(orbit, 55));
    const actual = tradeShipWorldPosition(orbit, SEASON_START, now);
    expect(actual[0]).toBeCloseTo(expected[0], 9);
    expect(actual[1]).toBeCloseTo(expected[1], 9);
    expect(actual[2]).toBeCloseTo(expected[2], 9);
  });

  it('moves — two reads a minute apart land in meaningfully different places', () => {
    const orbit: OrbitLike = spec();
    const t0 = SEASON_START.getTime() + 10 * 60_000;
    const t1 = t0 + 60_000;
    const a = tradeShipWorldPosition(orbit, SEASON_START, t0);
    const b = tradeShipWorldPosition(orbit, SEASON_START, t1);
    const gap = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    expect(gap).toBeGreaterThan(0.01);
  });
});

describe('TRADE_SHIP_SCALE', () => {
  it('is exactly four times the base craft scale', () => {
    expect(TRADE_SHIP_SCALE_MULT).toBe(4);
    expect(TRADE_SHIP_SCALE).toBeCloseTo(TRADE_SHIP_BASE_SCALE * TRADE_SHIP_SCALE_MULT, 9);
  });

  it('reads its base off the same shared dial every hull in the galaxy uses', () => {
    // The per-kind fraction (0.15-0.34 elsewhere) times `CRAFT_SCALE`, exactly as
    // every existing `MODEL_STYLE`/`CONTACT_STYLE` entry in `Fleets.tsx` is built —
    // never a bare literal that drifts from the shared multiplier.
    expect(TRADE_SHIP_BASE_SCALE).toBeGreaterThan(0);
    expect(TRADE_SHIP_BASE_SCALE).toBeLessThan(CRAFT_SCALE);
  });

  it('draws bigger than an ordinary ship and smaller than the largest world', () => {
    // 1.40 is the largest authored world size (D153); a public landmark ship
    // should read as prominent without out-scaling every planet in the galaxy.
    expect(TRADE_SHIP_SCALE).toBeGreaterThan(TRADE_SHIP_BASE_SCALE);
    expect(TRADE_SHIP_SCALE).toBeLessThan(1.40);
  });
});

describe('TradeShip.tsx, by its source', () => {
  const source = readFileSync('src/galaxy/TradeShip.tsx', 'utf8');

  it('names the drawn node so tools/visual.mjs can prove it moves', () => {
    expect(source).toContain('name="trade-ship"');
  });

  /**
   * THE FLAME COMES OUT OF THE SHIP. Owner report against the shipped merchant:
   * *"geminin kıçında motor alevi yok?"*
   *
   * Every other craft in the galaxy carries `Exhaust` behind its hull, at the same
   * proportions off its own drawn scale (`Fleets.tsx`, four call sites). The
   * merchant reused `Hull` and stopped there, so a four-times-size freighter flew
   * with dead engines. D154 names the rule the other way round — a posed hull's
   * exhaust reads the lift the hull is drawn at — and this is the same rule at
   * zero lift: the plume belongs to the craft, not to whoever remembers it.
   */
  it('burns a plume behind the hull, at the proportions every craft uses', () => {
    expect(source).toContain('<Exhaust');
    expect(source).toContain('TRADE_SHIP_SCALE * 0.8');
    expect(source).toContain('TRADE_SHIP_SCALE * 0.46');
    // Behind the nose, which `posedCraft` has already turned onto +Z.
    expect(source).toMatch(/position=\{\[0, 0, -TRADE_SHIP_SCALE \* 0\.42\]\}/);
  });

  it('preloads with Draco off, exactly like every other craft in the galaxy', () => {
    expect(source).toContain('useGLTF.preload(MODEL.tradeShip, false)');
  });

  it('never gates on sensor zone — the merchant is public, not fogged', () => {
    expect(source).not.toContain('sensorZone');
  });
});
