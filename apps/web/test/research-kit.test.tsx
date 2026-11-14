import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RESEARCH_MAX_LEVEL, RESEARCH_PROJECTS, RESEARCH_PROJECT_IDS, type ResearchProjectId } from '@astera/rules';
import { ResearchPanel } from '../src/screens/ResearchPanel.js';
import i18n from '../src/i18n/index.js';
import { ToastProvider } from '../src/ui/Toast.js';
import type { PlanetView, ResearchQueueOrderView } from '../src/api/schemas.js';
import { CONSTELLATION_ASPECT } from '../src/lib/constellation.js';
import { planetView } from './fixtures.js';

/**
 * G2-i1 (2026-11-15): RESEARCH ON THE GAME KIT. The commander comes here to choose what to
 * learn next. The map reads every project by its whole name — two lines, never cut — and a
 * star is a thumb's target; the card under it is the decision: what the next rung buys,
 * what stands in front of it as a door, the price, and one heavy press. The lane is the
 * Base's own row of rings.
 */

type ResearchState = PlanetView['research'][number];

const state = (id: ResearchProjectId, over: Partial<ResearchState> = {}): ResearchState => ({
  id,
  level: 0,
  maxLevel: RESEARCH_MAX_LEVEL[id],
  cost: RESEARCH_PROJECTS[id].costAt(1),
  discovered: true,
  completed: false,
  completedAt: null,
  available: true,
  queueDiscovered: true,
  queueAvailable: true,
  availableAt: new Date('2026-01-01T00:00:00.000Z'),
  prerequisite: RESEARCH_PROJECTS[id].prerequisite,
  prerequisiteMet: true,
  queuePrerequisiteMet: true,
  ...over,
});

const order = (projectId: ResearchProjectId, finishesAt: Date, slot = 0, level = 1): ResearchQueueOrderView => ({
  id: `research-${String(slot)}-${projectId}`,
  slot,
  projectId,
  level,
  startedAt: new Date('2026-08-28T09:00:00.000Z'),
  finishesAt,
  cost: RESEARCH_PROJECTS[projectId].costAt(level),
});

const world = (
  research: Partial<Record<ResearchProjectId, Partial<ResearchState>>> = {},
  over: Partial<Omit<PlanetView, 'planet'>> = {},
  stock: Partial<PlanetView['planet']> = {},
): PlanetView => planetView(
  {
    buildings: { CORE: 14, REFINERY: 6, EXTRACTOR: 6, VAULT: 3, SHIPYARD: 6 },
    research: RESEARCH_PROJECT_IDS.map((id) => state(id, research[id] ?? {})),
    ...over,
  },
  { alloy: 900_000, crystal: 500_000, deuterium: 90_000, alloyCap: 2_000_000, crystalCap: 1_000_000, deuteriumCap: 200_000, ...stock },
);

const mutate = vi.fn();
let current: PlanetView = world();

vi.mock('../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/api/queries.js');
  return {
    ...actual,
    usePlanet: () => ({ data: current, dataUpdatedAt: Date.now(), isPending: false }),
    useCompleteResearch: () => ({ mutate, isPending: false }),
  };
});

const show = (view: PlanetView = world(), focus?: ResearchProjectId) => {
  current = view;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <ResearchPanel {...(focus ? { focus } : {})} />
      </ToastProvider>
    </QueryClientProvider>,
  );
};

const star = (id: ResearchProjectId): HTMLElement => document.querySelector<HTMLElement>(`[data-star="${id}"]`)!;
const card = (id: ResearchProjectId): HTMLElement => {
  fireEvent.click(star(id));
  return document.querySelector<HTMLElement>(`[data-constellation-card="${id}"]`)!;
};

/** Every class the v2 look painted with; the sky behind the map is a picture, shared with the planet hero. */
const V2_LOOK = /(^|\s)(text|bg|border|font|stroke|fill)-v2-|rounded-control|rounded-chip|(^|\s)truncate(\s|$)/;
const v2Painted = (root: Element): string[] =>
  [...root.querySelectorAll('[class]')].filter((el) => el.closest('[data-sky]') === null).map((el) => el.getAttribute('class') ?? '').filter((name) => V2_LOOK.test(name));

beforeEach(async () => {
  mutate.mockClear();
  Element.prototype.scrollIntoView = vi.fn();
  await i18n.changeLanguage('en');
});

describe('the research map on the kit', () => {
  it('is a kit map, as tall as its two-line names need', () => {
    show();
    const map = document.querySelector<HTMLElement>('[data-constellation]')!;
    expect(map).toHaveClass('gk-cmap');
    expect(map.style.aspectRatio).toBe(`1 / ${String(CONSTELLATION_ASPECT)}`);
    for (const region of map.querySelectorAll('[data-region]')) expect(region).toHaveClass('gk-label');
  });

  it('names every project whole under its star, and each star is a kit press', () => {
    show();
    const isotope = star('ISOTOPE_SPECTROMETRY');
    expect(isotope).toHaveClass('gk-cmap__star');
    expect(isotope).toHaveAttribute('data-own-sound');
    expect(isotope.querySelector('.gk-cmap__name')).toHaveTextContent(/^Isotope Spectrometry$/);
    expect(star('SHIP_PROPULSION').querySelector('.gk-cmap__from')).toHaveTextContent(/Dense Fuel Cells/);
  });

  it('says on the star what the player holds, what is shut and what runs', () => {
    show(world({ SHIP_POWER: { level: 2 }, SHIP_ARMOR: { queuePrerequisiteMet: false, prerequisiteMet: false, queueAvailable: false, available: false } }, {
      researchQueue: [order('YARD_AUTOMATION', new Date('2026-08-28T11:30:00.000Z'))],
    }));
    expect(star('SHIP_POWER')).toHaveAttribute('data-level', '2');
    expect(star('SHIP_ARMOR')).toHaveAttribute('data-locked', '');
    expect(star('YARD_AUTOMATION')).toHaveAttribute('data-running', '');
  });

  it('leaves none of the v2 look on the map, the card or the lane', () => {
    show(world({}, { researchQueue: [order('YARD_AUTOMATION', new Date('2026-08-28T11:30:00.000Z'))] }));
    expect(v2Painted(document.body)).toEqual([]);
  });
});

describe('the selected project’s card on the kit', () => {
  it('is a kit card: the name, the rungs, the gain, the price with its time', () => {
    show(world({ SHIP_POWER: { level: 2 } }));
    const power = card('SHIP_POWER');
    expect(power).toHaveClass('gk-rcard');
    expect(power.querySelector('.gk-rcard__name')).toHaveTextContent('Ship Power');
    expect(power.querySelector('.gk-rungs')?.querySelectorAll('[data-rung="held"]')).toHaveLength(2);
    expect(power.querySelector('.gk-rcard__gain')).not.toBeNull();
    expect(power.querySelector('.gk-cost')).not.toBeNull();
    expect(power.querySelector('.gk-cost__time')).not.toBeNull();
  });

  it('reads the ceiling straight after the figures, with no stray separator', () => {
    show();
    const gain = card('SHIP_POWER').querySelector('.gk-rcard__gain')!;
    expect(gain).toHaveTextContent(/% of \d+%/);
    expect(gain.textContent).not.toMatch(/·\s*of/);
  });

  it('researches with one heavy kit press beside a steel Details', async () => {
    show();
    const isotope = card('ISOTOPE_SPECTROMETRY');
    const go = within(isotope).getByRole('button', { name: /^research$/i });
    expect(go).toHaveClass('gk-btn', 'gk-btn--action');
    expect(within(isotope).getByRole('button', { name: /^details$/i })).toHaveClass('gk-btn');
    await userEvent.click(go);
    expect(mutate).toHaveBeenCalledWith('ISOTOPE_SPECTROMETRY', expect.anything());
  });

  it('says a price the store cannot pay on the press itself', () => {
    show(world({}, {}, { alloy: 0, crystal: 0, deuterium: 0 }));
    const press = within(card('ISOTOPE_SPECTROMETRY')).getByRole('button', { name: /not enough resources/i });
    expect(press).toBeDisabled();
    expect(press).toHaveClass('gk-btn');
  });

  it('turns a missing prerequisite into a door that walks to its star', async () => {
    show(world({ DENSE_FUEL_CELLS: { discovered: false, queueDiscovered: false, available: false, queueAvailable: false } }));
    const dense = card('DENSE_FUEL_CELLS');
    const door = within(dense).getByRole('button', { name: /Isotope Spectrometry first/i });
    expect(door).toHaveClass('gk-rcard__door');
    expect(within(dense).queryByRole('button', { name: /^research$/i })).toBeNull();
    await userEvent.click(door);
    expect(star('ISOTOPE_SPECTROMETRY')).toHaveAttribute('aria-pressed', 'true');
  });

  it('wears a held prerequisite as a met chip, and the ships it opens as chips', () => {
    show(world({ STARSHIP_ENGINEERING: { level: 1 } }));
    const armor = card('SHIP_ARMOR');
    expect(armor.querySelector('[data-prerequisite] .gk-need-chip[data-met]')).toHaveTextContent(/Starship Engineering/);
    const hulls = armor.querySelectorAll('[data-hull]');
    expect(hulls.length).toBeGreaterThan(0);
    for (const hull of hulls) expect(hull).toHaveClass('gk-rcard__hull');
  });

  it('says a project on the queue is under way instead of offering it again', () => {
    show(world({}, { researchQueue: [order('ISOTOPE_SPECTROMETRY', new Date('2026-08-28T11:30:00.000Z'))] }));
    const isotope = card('ISOTOPE_SPECTROMETRY');
    expect(within(isotope).getByRole('status')).toHaveTextContent('Researching');
    expect(within(isotope).queryByRole('button', { name: /^research$/i })).toBeNull();
    // nothing is offered, so no price is either
    expect(isotope.querySelector('.gk-cost')).toBeNull();
  });
});

describe('the research lane on the kit', () => {
  it('is the Base’s row of rings: one per order, the free slots said', () => {
    show(world({}, { researchQueue: [order('SHIP_ARMOR', new Date('2026-08-28T11:30:00.000Z'), 0, 2)] }));
    const lane = document.querySelector('[data-queue-lane]')!;
    expect(lane).toHaveClass('gk-lane');
    expect(lane.querySelectorAll('.gk-qslot--free')).toHaveLength(2);
    const slot = within(lane as HTMLElement).getByRole('button', { name: /Ship Armor/ });
    expect(slot).toHaveClass('gk-qslot');
    // research counts a level, not a batch: no "×2" on the ring
    expect(slot.querySelector('.gk-qslot__count')).toBeNull();
  });

  it('says a lane stopped by a vacation is stopped, never that it runs', () => {
    const stopped = { ...order('SHIP_ARMOR', new Date('2026-08-28T11:30:00.000Z')), pausedAt: new Date('2026-08-28T10:00:00.000Z') };
    show(world({}, { researchQueue: [stopped] }));
    const line = document.querySelector('[data-research-running]')!;
    expect(line).not.toHaveTextContent(/under way/i);
    expect(line).toHaveTextContent(/paused/i);
    expect(line.querySelector('[data-tone="warn"]')).not.toBeNull();
  });

  it('writes a paused ring in one short word, the whole reason left for a reader', () => {
    const stopped = { ...order('SHIP_ARMOR', new Date('2026-08-28T11:30:00.000Z')), pausedAt: new Date('2026-08-28T10:00:00.000Z') };
    show(world({}, { researchQueue: [stopped] }));
    const slot = document.querySelector<HTMLElement>('[data-queue-lane] .gk-qslot')!;
    expect(slot.querySelector('.gk-qslot__time')).toHaveTextContent(/^Paused$/);
    expect(slot).toHaveAccessibleName(/vacation mode/);
  });

  it('says what runs and when it ends, in the kit’s small line', () => {
    show(world({}, { researchQueue: [order('SHIP_ARMOR', new Date('2026-08-28T11:30:00.000Z'))] }));
    expect(document.querySelector('[data-research-running]')).toHaveClass('gk-sub');
  });
});

/**
 * G2-i2: THE PROJECT SHEET ON THE KIT. "Details" opens the whole of one project: the scene
 * and the rung held, what the next rung buys, how it works, the price of exactly that rung,
 * and the same one press as the card — or the door, or the state, where the press would be.
 */
describe('the project sheet on the kit', () => {
  const details = async (id: ResearchProjectId): Promise<HTMLElement> => {
    await userEvent.click(within(card(id)).getByRole('button', { name: /^details$/i }));
    return document.querySelector<HTMLElement>('[data-item-sheet]')!;
  };

  it('is a kit sheet: the project’s scene, the rung held, the gain, how it works', async () => {
    show(world({ CARGO_HOLDS: { level: 2, cost: RESEARCH_PROJECTS.CARGO_HOLDS.costAt(3) } }));
    const sheet = await details('CARGO_HOLDS');
    expect(sheet.querySelector('.gk-sheet')).not.toBeNull();
    const hero = sheet.querySelector('[data-research-portrait]')!;
    expect(hero).toHaveClass('gk-ihero');
    expect(hero.querySelector('.gk-rhero__index')).toHaveTextContent('02');
    expect(hero.querySelector('[data-research-gain]')).not.toBeNull();
    expect(sheet.querySelector('[data-item-detail]')).toHaveClass('gk-well');
    expect(sheet).toHaveTextContent(/Level 3 of 5/);
    expect(sheet.querySelector('.gk-cost')).not.toBeNull();
    expect(v2Painted(sheet)).toEqual([]);
  });

  it('researches with the kit’s heavy press and closes', async () => {
    show();
    const sheet = await details('CARGO_HOLDS');
    const press = within(sheet).getByRole('button', { name: /^research$/i });
    expect(press).toHaveClass('gk-btn', 'gk-btn--action');
    await userEvent.click(press);
    expect(mutate).toHaveBeenCalledWith('CARGO_HOLDS', expect.anything());
    expect(document.querySelector('[data-item-sheet]')).toBeNull();
  });

  it('says a price the store cannot pay on the press', async () => {
    show(world({}, {}, { alloy: 0, crystal: 0, deuterium: 0 }));
    const sheet = await details('CARGO_HOLDS');
    expect(within(sheet).getByRole('button', { name: /not enough resources/i })).toBeDisabled();
  });

  it('turns a missing prerequisite into the kit door, which walks to its star', async () => {
    show(world({ DENSE_FUEL_CELLS: { discovered: false, queueDiscovered: false, available: false, queueAvailable: false } }));
    const sheet = await details('DENSE_FUEL_CELLS');
    const door = within(sheet).getByRole('button', { name: /Isotope Spectrometry first/i });
    expect(door).toHaveClass('gk-btn--door');
    await userEvent.click(door);
    expect(document.querySelector('[data-item-sheet]')).toBeNull();
    expect(star('ISOTOPE_SPECTROMETRY')).toHaveAttribute('aria-pressed', 'true');
  });

  it('says a project on the queue is under way where the press would be', async () => {
    show(world({}, { researchQueue: [order('CARGO_HOLDS', new Date('2026-08-28T11:30:00.000Z'))] }));
    const sheet = await details('CARGO_HOLDS');
    expect(within(sheet).getByRole('status')).toHaveTextContent('Researching');
    expect(within(sheet).queryByRole('button', { name: /^research$/i })).toBeNull();
  });
});
