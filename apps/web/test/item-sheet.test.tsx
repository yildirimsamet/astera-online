import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BUILD, instrumentCost, upgradeCost } from '@astera/rules';
import { compact } from '../src/lib/format.js';
import { instrumentGain } from '../src/lib/gains.js';
import { orderMinutes } from '../src/lib/orderTime.js';
import { duration } from '../src/lib/time.js';
import { ItemSheet, type ItemRef } from '../src/ui/ItemSheet.js';
import type { PlanetView } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';

/**
 * THE ITEM SHEET — WHAT ONE MORE LEVEL BUYS, AND WHAT THIS THING BECOMES. D1.
 *
 * Owner, 2026-09-24: the old surfaces were redrawn in the Gözlemevi language
 * (docs/ui-v2/design-mocks). The sheet leads with ONE render of what stands and the
 * gain the next level buys, puts the explanation one tap deeper, prices and times
 * the next three levels, and names the level where the look next changes — the
 * anticipation hook the ladder's per-rung pictures used to carry.
 *
 * Kept from before, because they were faults:
 *
 *   · INSTRUMENTS ARE PRICED AS INSTRUMENTS. D25 charges two to three times as much
 *     for an instrument; a ladder quoting the building price tells a player they can
 *     afford something the server will refuse.
 *   · A SATELLITE HAS NO LADDER. It is bought once and never raised; the one scarce
 *     thing is the SLOT.
 */

/** Developed and rich, so no row is blocked on affordability. */
const planet = (
  over: Partial<Omit<PlanetView, 'planet'>> = {},
  stock: Partial<PlanetView['planet']> = {},
): PlanetView =>
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
      ...stock,
    },
  );

const RICH = { alloy: 100_000, crystal: 50_000 };

const show = ({
  item = { kind: 'instrument', id: 'TELESCOPE' },
  over = {},
  held = RICH,
  queued,
  completed,
  blocked,
  onAct = vi.fn(),
  onClose = vi.fn(),
}: {
  item?: ItemRef;
  over?: Partial<Omit<PlanetView, 'planet'>>;
  held?: { alloy: number; crystal: number };
  queued?: string;
  completed?: string;
  blocked?: { reason: string; onFix?: () => void };
  onAct?: () => void;
  onClose?: () => void;
} = {}) =>
  render(
    <ItemSheet
      item={item}
      name="Telescope"
      role="Watches a world silently."
      planet={planet(over)}
      held={held}
      {...(queued ? { queued } : {})}
      {...(completed ? { completed } : {})}
      {...(blocked ? { blocked } : {})}
      pending={false}
      onAct={onAct}
      onClose={onClose}
    />,
  );

const rung = (level: number): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-rung="${String(level)}"]`);

describe('the Command Core tier information box', () => {
  it('opens the full level-to-tier table at the Command Core', async () => {
    show({ item: { kind: 'building', id: 'CORE' } });
    const toggle = screen.getByRole('button', { name: /Core levels & planet tiers/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await userEvent.click(toggle);
    const table = screen.getByRole('table', { name: 'Core levels & planet tiers' });
    expect(within(table).getByText('L1–L3')).toBeInTheDocument();
    expect(within(table).getByText('L4–L6')).toBeInTheDocument();
    expect(within(table).getByText('L22–L24')).toBeInTheDocument();
    expect(table.querySelector('[aria-current="true"]')).toHaveTextContent('L4–L6');
    await userEvent.click(toggle);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it.each([[1,1],[3,1],[4,2],[6,2],[7,3],[21,7],[22,8],[24,8],[25,9]])('shows Core L%i at tier %i', async (level, tier) => {
    show({ item: { kind: 'building', id: 'CORE' }, over: { buildings: { CORE: level, REFINERY: 1, EXTRACTOR: 1, VAULT: 1, SHIPYARD: 1 } } });
    expect(screen.getByText(`Core L${String(level)} → Tier ${String(tier)}`)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Core levels & planet tiers/ }));
    expect(screen.getByRole('table').querySelector('[aria-current="true"]')).toHaveTextContent(`Tier ${String(tier)}`);
  });

  it('keeps tier information specific to Command Core', () => {
    show({ item: { kind: 'building', id: 'REFINERY' } });
    expect(screen.queryByRole('button', { name: /Core levels & planet tiers/ })).not.toBeInTheDocument();
  });
});

const hero = (): HTMLElement => document.querySelector<HTMLElement>('[data-item-hero]')!;
const heroArt = (): string => hero().querySelector('img')?.getAttribute('src') ?? '';

describe('the sheet', () => {
  /** Owner, round 2: a sheet opens to its content's height; a page only when it must. */
  it('stands as tall as what it holds', () => {
    show();
    expect(document.querySelector('[data-sheet-panel]')).toHaveAttribute('data-detent', 'fit');
  });

  it('closes from its own close control', async () => {
    const onClose = vi.fn();
    show({ onClose });
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('what the next level buys', () => {
  it('states the gain the next level buys, now against next, in the hero', () => {
    show();
    const gain = instrumentGain('TELESCOPE', 0);
    expect(hero()).toHaveTextContent(gain.label);
    expect(hero()).toHaveTextContent(gain.now);
    expect(hero()).toHaveTextContent(gain.next);
  });

  /** Progressive disclosure: the row states the fact, one tap deeper states the rule. */
  it('explains the item beyond its role, one tap deeper', async () => {
    show();
    expect(screen.getByText('Watches a world silently.')).toBeInTheDocument();
    expect(document.querySelector('[data-item-detail]')).toBeNull();

    const how = screen.getByRole('button', { name: /how it works/i });
    expect(how).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(how);
    expect(how).toHaveAttribute('aria-expanded', 'true');
    const detail = document.querySelector<HTMLElement>('[data-item-detail]');
    expect(detail?.textContent.trim().length).toBeGreaterThan(60);
    expect(detail).toHaveTextContent(/range|slot|watch/i);
  });

  it('wears the art of what stands, grey before it is built', () => {
    show();
    expect(heroArt()).toContain('telescope_1');
    expect(hero().querySelector('img')).toHaveClass('grayscale');
  });

  it('wears the picture of the level it stands at once built', () => {
    show({ over: { instruments: { TELESCOPE: 3 } } });
    expect(heroArt()).toContain('telescope_2');
    expect(hero().querySelector('img')).not.toHaveClass('grayscale');
  });
});

describe('the level ladder', () => {
  it('prices and times each of the next three levels', () => {
    const view = planet();
    show();
    for (const level of [1, 2, 3]) {
      const row = rung(level)!;
      expect(row, `L${String(level)}`).not.toBeNull();
      const cost = instrumentCost('TELESCOPE', level - 1);
      expect(row).toHaveTextContent(compact(cost.alloy));
      expect(row).toHaveTextContent(instrumentGain('TELESCOPE', level - 1).next);
      const minutes = orderMinutes('INSTRUMENT', { ...cost, deuterium: 0 }, view);
      expect(within(row).getByText(duration(minutes))).toBeInTheDocument();
    }
    expect(rung(4)).toBeNull();
  });

  /** Seen on the phone: the first rung repeated the hero's line word for word. */
  it('does not repeat on the first rung what the hero already says', () => {
    show({ item: { kind: 'building', id: 'REFINERY' } });
    const unlocks = hero().querySelector('p:last-child')!.textContent;
    expect(rung(4)).not.toHaveTextContent(unlocks);
  });

  /** The Core's gain IS its level: "L3 · L3" read as a fault. */
  it('does not print a Core rung\'s level twice', () => {
    show({ item: { kind: 'building', id: 'CORE' } });
    expect(rung(7)!.textContent.match(/L7/g)).toHaveLength(1);
  });

  /**
   * Seen on the phone: the Telescope's rungs alternate what they buy — a slot, then
   * range — and "1 · 1725 units · 2" under one heading read as one column of nonsense.
   * A rung names what it buys whenever that is not what the hero named.
   */
  it('names what a rung buys when it is not what the hero buys', () => {
    show();
    const hero = instrumentGain('TELESCOPE', 0).label;
    for (const level of [1, 2, 3]) {
      const own = instrumentGain('TELESCOPE', level - 1).label;
      if (own === hero) expect(rung(level)).not.toHaveTextContent(own);
      else expect(rung(level)).toHaveTextContent(own);
    }
    expect([1, 2, 3].some((level) => instrumentGain('TELESCOPE', level - 1).label !== hero)).toBe(true);
  });

  /** The Telescope's range table ends at 8; a ninth rung would sell a level that does not exist. */
  it('stops at the top of a ladder that has one', () => {
    show({ over: { instruments: { TELESCOPE: 7 } } });
    expect(rung(8)).not.toBeNull();
    expect(rung(9)).toBeNull();
  });

  /** The anticipation hook: what it becomes, and when. */
  it('names the level where the look next changes and shows it', () => {
    show();
    const look = document.querySelector<HTMLElement>('[data-next-look]')!;
    expect(look).toHaveTextContent(/L3/);
    expect(look.querySelector('img')?.getAttribute('src')).toContain('telescope_2');
  });

  it('promises no new look on the last picture', () => {
    show({ over: { instruments: { TELESCOPE: 6 } } });
    expect(document.querySelector('[data-next-look]')).toBeNull();
  });
});

/**
 * THE LOOK FOLLOWS THE PICTURE. The three renders are spread over each ladder (owner,
 * 2026-09-24): thirds of a ladder with a top, 1–8 / 9–14 / 15+ without.
 */
describe('a building whose render tiers', () => {
  const at = (id: 'REFINERY' | 'HANGAR' | 'DEUTERIUM_PLANT') =>
    show({
      item: { kind: 'building', id },
      over: { buildings: { CORE: 6, REFINERY: 1, EXTRACTOR: 1, VAULT: 1, SHIPYARD: 1, HANGAR: 1, DEUTERIUM_PLANT: 1 } },
    });

  it('promises the refinery its second look at L9', () => {
    at('REFINERY');
    expect(heroArt()).toContain('alloy_refinery_1.png');
    const look = document.querySelector<HTMLElement>('[data-next-look]')!;
    expect(look).toHaveTextContent(/L9/);
    expect(look.querySelector('img')?.getAttribute('src')).toContain('alloy_refinery_2.png');
  });

  /** Its own renders at last (carried from master's work in progress, 2026-09-25), not the deuterium it makes. */
  it('shows the deuterium plant as a building, and promises its second look at L9', () => {
    at('DEUTERIUM_PLANT');
    expect(heroArt()).toContain('deuterium_refinery_1.webp');
    const look = document.querySelector<HTMLElement>('[data-next-look]')!;
    expect(look).toHaveTextContent(/L9/);
    expect(look.querySelector('img')?.getAttribute('src')).toContain('deuterium_refinery_2.webp');
  });

  /** "of Up to 7.3k at the top rung" was on the phone: the ceiling is a sentence of its own. */
  it('says where the hangar ladder ends, in its own words', () => {
    at('HANGAR');
    expect(hero()).toHaveTextContent(/up to .* at the highest level/i);
    expect(hero()).not.toHaveTextContent(/of up to/i);
  });

  it('promises the hangar, whose ladder ends at 10, its second look at L4', () => {
    at('HANGAR');
    const look = document.querySelector<HTMLElement>('[data-next-look]')!;
    expect(look).toHaveTextContent(/L4/);
    expect(look.querySelector('img')?.getAttribute('src')).toContain('hangar_2.png');
  });
});

describe('what the ladder charges', () => {
  it('prices an instrument as an instrument, all the way up the ladder', () => {
    show();
    const body = document.body.textContent;
    for (const level of [0, 1, 2]) {
      const alloy = instrumentCost('TELESCOPE', level).alloy;
      expect(body, `L${String(level + 1)} should cost ${String(alloy)}`).toContain(compact(alloy));
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
    show({ over: { instrumentCosts: { TELESCOPE: { alloy: 4321, crystal: 0, deuterium: 0 } } } });
    expect(screen.getAllByText(compact(4321)).length).toBeGreaterThan(0);
    expect(screen.queryByText(compact(instrumentCost('TELESCOPE', 0).alloy))).toBeNull();
  });

  it('sells the level after an already queued level without pretending it is installed', () => {
    const now = new Date();
    show({
      over: {
        instruments: { TELESCOPE: 1 },
        queues: {
          CONSTRUCTION: [{
            id: 'telescope-2',
            queue: 'CONSTRUCTION',
            slot: 0,
            kind: 'INSTRUMENT',
            subject: 'TELESCOPE',
            count: 1,
            startedAt: now,
            finishesAt: new Date(now.getTime() + 60_000),
            cost: instrumentCost('TELESCOPE', 1),
          }],
          YARD: [],
        },
      },
      queued: '1 order queued',
    });

    expect(screen.getByText('1 order queued')).toBeInTheDocument();
    expect(screen.getByText(/level 1/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /raise to l3/i })).toBeInTheDocument();
    expect(rung(3)).toHaveTextContent(compact(instrumentCost('TELESCOPE', 2).alloy));
    // The queue it joins, filled as it stands.
    expect(document.querySelector('[data-queue-fill]')).toHaveTextContent(`1/${String(BUILD.queueDepth)}`);
  });
});

describe('the commit', () => {
  it('raises on one press and closes', async () => {
    const onAct = vi.fn();
    const onClose = vi.fn();
    show({ onAct, onClose });
    await userEvent.click(screen.getByRole('button', { name: /^install$/i }));
    expect(onAct).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalled();
  });

  /** How far off, as a distance per resource, and WHEN — never a dead button with no reason. */
  it('says when a price it cannot pay will be met', () => {
    const cost = instrumentCost('TELESCOPE', 0);
    show({ held: { alloy: 0, crystal: 0 } });
    const primary = document.querySelector<HTMLElement>('[data-act] button')!;
    expect(primary).toBeDisabled();
    // 400 alloy and 120 crystal an hour, both short from nothing: the longer wait.
    const minutes = Math.max((cost.alloy / 400) * 60, cost.crystal > 0 ? (cost.crystal / 120) * 60 : 0);
    expect(primary).toHaveTextContent(duration(minutes));
    expect(document.querySelector('[data-need-bar="alloy"]')).not.toBeNull();
  });

  it('draws no need bar for a resource it already holds enough of', () => {
    const cost = instrumentCost('TELESCOPE', 0);
    show({ held: { alloy: 0, crystal: cost.crystal + 1 } });
    expect(document.querySelector('[data-need-bar="alloy"]')).not.toBeNull();
    expect(document.querySelector('[data-need-bar="crystal"]')).toBeNull();
  });

  /** A requirement is a door, not an alarm (I1): warn, and it goes where the fix is. */
  it('opens the door to a requirement instead of raising', async () => {
    const onFix = vi.fn();
    const onClose = vi.fn();
    show({ blocked: { reason: 'Command Core L7', onFix }, onClose });
    const door = screen.getByRole('button', { name: /command core l7/i });
    expect(door.className).toMatch(/v2-warn/);
    expect(door.className).not.toMatch(/hostile/);
    expect(document.querySelector('[data-need-bar]')).toBeNull();
    await userEvent.click(door);
    expect(onFix).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  /** The reasons are written to follow "needs"; on a door of their own they start a sentence. */
  it('starts the door with a capital', () => {
    show({ blocked: { reason: 'a free orbit slot', onFix: vi.fn() } });
    expect(screen.getByRole('button', { name: /free orbit slot/ })).toHaveTextContent(/^A free orbit slot/);
  });

  it('reads as done at the top and offers nothing more', () => {
    show({ completed: 'Top level' });
    expect(screen.getByRole('status')).toHaveTextContent('Top level');
    expect(rung(1)).toBeNull();
    expect(screen.queryByRole('button', { name: /install|raise/i })).toBeNull();
  });
});

/**
 * A SATELLITE HAS NO LADDER, AND THE SHEET MUST NOT DRAW ONE. D25.
 *
 * What it needs instead is the one thing that is actually scarce: the SLOT.
 */
describe('a satellite, which has no levels at all', () => {
  const showSat = (over: Partial<PlanetView> = {}, completed?: string, queued?: string) =>
    render(
      <ItemSheet
        item={{ kind: 'satellite', id: 'FOUNDRY' }}
        name="Foundry"
        role="EARN. Both metals, faster."
        planet={planet(over)}
        held={RICH}
        {...(completed ? { completed } : {})}
        {...(queued ? { queued } : {})}
        pending={false}
        onAct={vi.fn()}
        onClose={vi.fn()}
      />,
    );

  it('draws no level ladder', () => {
    showSat();
    expect(document.querySelector('[data-rung]')).toBeNull();
    expect(screen.queryByText(/what each level buys/i)).toBeNull();
    expect(document.querySelector('[data-next-look]')).toBeNull();
  });

  it('states its lasting effect once, one tap deeper', async () => {
    showSat();
    await userEvent.click(screen.getByRole('button', { name: /how it works/i }));
    expect(document.querySelectorAll('[data-item-detail]')).toHaveLength(1);
    expect(document.querySelector('[data-item-detail]')).toHaveTextContent(/passive|ore|early/i);
  });

  it('says it is not in orbit rather than "not installed at level 0"', () => {
    showSat();
    expect(screen.getByText(/not in orbit/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /put in orbit/i })).toBeDefined();
  });

  it('quotes the flat price, once', () => {
    showSat({ satelliteCosts: { FOUNDRY: { alloy: 9000, crystal: 3000, deuterium: 0 } } });
    expect(screen.getAllByText(compact(9000)).length).toBeGreaterThan(0);
    expect(screen.getByText(/once/i)).toBeDefined();
  });

  /** The slot is the real cost, so the sheet states it before the refusal does. */
  it('shows what the orbit has room for', () => {
    showSat({ buildings: { CORE: 9, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 1 }, orbit: ['UPLINK'], orbitSlots: 2 });
    expect(screen.getByText(/1 of 2 free/i)).toBeDefined();
  });

  it('shows the slot opened by a queued Core upgrade', () => {
    const now = new Date();
    showSat({
      buildings: { CORE: 8, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 1 },
      orbit: ['UPLINK'],
      orbitSlots: 1,
      queues: {
        CONSTRUCTION: [{
          id: 'core-9', queue: 'CONSTRUCTION', slot: 0, kind: 'BUILDING', subject: 'CORE', count: 1,
          cost: { alloy: 1, crystal: 0, deuterium: 0 }, startedAt: now,
          finishesAt: new Date(now.getTime() + 60_000),
        }],
        YARD: [],
      },
    });
    expect(screen.getByText(/1 of 2 free/i)).toBeInTheDocument();
    expect(document.querySelector('[data-item-hero] [data-socket="target"]')).toBeInTheDocument();
    expect(document.querySelector('[data-slot-after]')).toHaveTextContent(/command core 15/i);
  });

  it('draws the orbit as sockets: taken, the one it would take, and the ones still shut', () => {
    // Core 1 opens one slot of four; the Uplink can hold it.
    showSat({ orbit: [], orbitSlots: 1 });
    const sockets = [...document.querySelectorAll<HTMLElement>('[data-socket]')];
    expect(sockets).toHaveLength(4);
    expect(sockets.map((socket) => socket.dataset.socket)).toEqual(['target', 'shut', 'shut', 'shut']);
  });

  it('says what placing it leaves, and which Core opens the next slot', () => {
    // The first slot is open. Putting this up leaves none; Core 9 opens the second.
    showSat({ orbit: [], orbitSlots: 1 });
    expect(document.querySelector('[data-slot-after]')).toHaveTextContent(/0/);
    expect(document.querySelector('[data-slot-after]')).toHaveTextContent(/command core 9/i);
  });

  it('says which building fixes a full orbit, rather than only refusing', () => {
    showSat({ buildings: { CORE: 9, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 1 }, orbit: ['UPLINK', 'BEACON'], orbitSlots: 2 });
    expect(screen.getByText(/no free slot/i)).toBeDefined();
    expect(screen.getByText(/no free slot/i)).toHaveTextContent(/command core/i);
  });

  it('reads as done once it is up there', () => {
    showSat({ buildings: { CORE: 9, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 1 }, orbit: ['FOUNDRY'], orbitSlots: 2 }, 'Already in orbit');
    expect(screen.getByText(/^in orbit$/i)).toBeDefined();
    expect(screen.getByRole('status')).toHaveTextContent('Already in orbit');
    expect(screen.queryByRole('button', { name: /already in orbit/i })).toBeNull();
    expect(screen.queryByText(/locked/i)).toBeNull();
    expect([...document.querySelectorAll<HTMLElement>('[data-socket]')].some((socket) => socket.dataset.socket === 'self')).toBe(true);
  });

  it('marks a stored fourth satellite inactive until Core 18', () => {
    showSat({
      buildings: { CORE: 8, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 1 },
      orbit: ['UPLINK', 'DERRICK', 'BEACON', 'FOUNDRY'],
      effectiveOrbit: ['UPLINK'],
      orbitSlots: 1,
    }, 'Already in orbit');
    expect(document.querySelector('[data-item-hero] [data-socket="inactive"]')).toBeInTheDocument();
    expect(screen.getByText(/owned, but inactive until the command core/i)).toHaveTextContent(/Core L18/);
    expect(screen.getByText(/no free slot/i)).toHaveTextContent(/command core 9/i);
  });

  it('keeps a queued one-time satellite terminal until it reaches orbit', () => {
    const now = new Date();
    showSat({
      queues: {
        CONSTRUCTION: [{
          id: 'foundry-1',
          queue: 'CONSTRUCTION',
          slot: 0,
          kind: 'SATELLITE',
          subject: 'FOUNDRY',
          count: 1,
          startedAt: now,
          finishesAt: new Date(now.getTime() + 60_000),
          cost: { alloy: 9000, crystal: 3000, deuterium: 0 },
        }],
        YARD: [],
      },
    }, undefined, '1 order queued');
    expect(screen.getByRole('status')).toHaveTextContent('1 order queued');
    expect(screen.queryByRole('button', { name: /put in orbit/i })).toBeNull();
  });
});

/** Owner, 2026-09-24: the payback line left the menu items ("Pays for itself kısmını kaldır"). */
describe('a producer ladder', () => {
  it('draws no payback line on any rung', () => {
    show({ item: { kind: 'building', id: 'REFINERY' } });
    expect(document.querySelector('[data-gain-repays]')).toBeNull();
    expect(document.body).not.toHaveTextContent(/pays for itself/i);
  });
});
