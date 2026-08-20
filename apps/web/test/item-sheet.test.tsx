import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { instrumentCost, upgradeCost } from '@astera/rules';
import { compact } from '../src/lib/format.js';
import { ItemSheet } from '../src/ui/ItemSheet.js';
import type { PlanetView } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';

/**
 * THE LADDER SHEET — WHAT THIS THING BECOMES.
 *
 * Two faults, both of them the sheet quietly withholding what it was built to
 * show.
 *
 *   · ART ONLY APPEARED WHERE THE TIER CHANGED. From nothing, that meant L1 and L2
 *     were blank and the first picture a player ever saw was L3 — so the sheet
 *     looked broken and implied the first two levels had no hardware, while the
 *     tier-1 renders sat unused in the repo. Owner's note.
 *   · INSTRUMENTS WERE PRICED AS BUILDINGS. D25 charges two to three times as much
 *     for an instrument, and a ladder quoting the building price would be telling
 *     a player they could afford something the server will refuse.
 *
 * The satellite half of the file is D25: four things with NO levels, which is the
 * one case this sheet was never built for.
 */

/** Developed and rich, so no row is blocked on affordability. */
const planet = (over: Partial<Omit<PlanetView, 'planet'>> = {}): PlanetView =>
  planetView(
    {
      buildings: { CORE: 6, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 1 },
      fleet: {},
      score: { wealth: 10_000, dominion: 0 },
      ...over,
    },
    {
      alloy: 100_000,
      crystal: 50_000,
      alloyCap: 200_000,
      crystalCap: 90_000,
      alloyPerHour: 400,
      crystalPerHour: 120,
      bufferAlloyCap: 4000,
      bufferCrystalCap: 1200,
    },
  );

const show = (over: Partial<Omit<PlanetView, 'planet'>> = {}) =>
  render(
    <ItemSheet
      item={{ kind: 'instrument', id: 'TELESCOPE' }}
      name="Telescope"
      role="Watches a world silently."
      planet={planet(over)}
      held={{ alloy: 100_000, crystal: 50_000 }}
      pending={false}
      onAct={vi.fn()}
      onClose={vi.fn()}
    />,
  );

/** The three rungs the sheet shows, in order, as their own containers. */
const rungs = (): HTMLElement[] =>
  [1, 2, 3].map((level) => {
    const label = screen.getByText(`L${String(level)}`);
    const row = label.closest('div.flex');
    if (!row) throw new Error(`no row for L${String(level)}`);
    return row as HTMLElement;
  });

describe('the level ladder', () => {
  /** The fault, stated directly: every rung shows what you are buying. */
  it('shows a picture on every level, not only where the tier changes', () => {
    show();
    for (const rung of rungs()) {
      expect(within(rung).getAllByRole('presentation', { hidden: true }).length).toBeGreaterThan(0);
    }
  });

  it('uses the level-one art for level one rather than the level-three art', () => {
    show();
    const [one, , three] = rungs();
    const src = (row: HTMLElement): string =>
      within(row).getAllByRole('presentation', { hidden: true })[0]?.getAttribute('src') ?? '';

    expect(src(one!)).toContain('telescope_1');
    expect(src(three!)).toContain('telescope_2');
    expect(src(one!)).not.toBe(src(three!));
  });

  /**
   * The tier change is still marked — it is the anticipation hook the sheet exists
   * for — but as an emphasis on the picture rather than as its presence.
   */
  it('marks the rung where new hardware actually arrives', () => {
    show();
    const [one, , three] = rungs();
    expect(one!.innerHTML).not.toContain('ring-crystal');
    expect(three!.innerHTML).toContain('ring-crystal');
  });
});

describe('what the ladder charges', () => {
  /**
   * D22. An instrument is dearer than a building at the same level, and the sheet
   * is where a player plans three levels ahead — so a stale price here is a plan
   * built on a number that does not exist.
   */
  it('prices an instrument as an instrument, all the way up the ladder', () => {
    show();
    const body = document.body.textContent;
    // L1, L2 and L3 of a Telescope, at the multiplier.
    for (const level of [0, 1, 2]) {
      const alloy = instrumentCost('TELESCOPE', level).alloy;
      // Shown short, as every ladder figure is — the exact number is on the row.
      expect(body, `L${String(level + 1)} should cost ${String(alloy)}`).toContain(
        compact(alloy),
      );
    }
  });

  it('does not quote the building price for an instrument', () => {
    show();
    // The multiplier is the whole point: if these ever coincided, every price
    // assertion above would pass while proving nothing.
    expect(instrumentCost('TELESCOPE', 0).alloy).not.toBe(upgradeCost(0).alloy);
    expect(screen.queryByText(compact(upgradeCost(0).alloy))).toBeNull();
  });

  /** The server's own quote wins for the very next level, where it has one. */
  it('prefers the server quote for the step it is actually selling', () => {
    show({ instrumentCosts: { TELESCOPE: { alloy: 4321, crystal: 0 } } });
    // The next level takes the server's figure; the two beyond it are the rules'.
    expect(screen.getAllByText(compact(4321)).length).toBeGreaterThan(0);
    expect(screen.queryByText(compact(instrumentCost('TELESCOPE', 0).alloy))).toBeNull();
  });
});

/**
 * A SATELLITE HAS NO LADDER, AND THE SHEET MUST NOT DRAW ONE. D25.
 *
 * The whole component is built around "this level, and the next three". A satellite
 * is bought once and never raised, so a ladder here would invent three levels that
 * do not exist and quote three prices the server would refuse. What it needs
 * instead is the one thing that is actually scarce: the SLOT.
 */
describe('a satellite, which has no levels at all', () => {
  const showSat = (over: Partial<PlanetView> = {}) =>
    render(
      <ItemSheet
        item={{ kind: 'satellite', id: 'FOUNDRY' }}
        name="Foundry"
        role="EARN. Both metals, faster."
        planet={planet(over)}
        held={{ alloy: 100_000, crystal: 50_000 }}
        pending={false}
        onAct={vi.fn()}
        onClose={vi.fn()}
      />,
    );

  it('draws no level ladder', () => {
    showSat();
    for (const level of [1, 2, 3]) {
      expect(screen.queryByText(`L${String(level)}`)).toBeNull();
    }
    expect(screen.queryByText(/what each level buys/i)).toBeNull();
  });

  it('says it is not in orbit rather than "not installed at level 0"', () => {
    showSat();
    expect(screen.getByText(/not in orbit/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /put in orbit/i })).toBeDefined();
  });

  it('quotes the flat price, and never a per-level one', () => {
    showSat({ satelliteCosts: { FOUNDRY: { alloy: 9000, crystal: 3000 } } });
    expect(screen.getAllByText(compact(9000)).length).toBeGreaterThan(0);
  });

  /** The slot is the real cost, so the sheet states it before the refusal does. */
  it('shows what the orbit has room for', () => {
    showSat({ orbit: ['UPLINK'], orbitSlots: 2 });
    expect(screen.getByText(/1 of 2 free/i)).toBeDefined();
  });

  it('says which building fixes a full orbit, rather than only refusing', () => {
    showSat({ orbit: ['UPLINK', 'BEACON'], orbitSlots: 2 });
    expect(screen.getByText(/no free slot/i)).toBeDefined();
    expect(screen.getByText(/command core/i)).toBeDefined();
  });

  it('reads as done once it is up there', () => {
    showSat({ orbit: ['FOUNDRY'], orbitSlots: 2 });
    expect(screen.getByText(/^in orbit$/i)).toBeDefined();
  });
});
