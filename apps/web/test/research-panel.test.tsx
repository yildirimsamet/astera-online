import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEUTERIUM,
  RESEARCH_MAX_LEVEL,
  RESEARCH_PROJECTS,
  RESEARCH_PROJECT_IDS,
  type ResearchProjectId,
} from '@astera/rules';
import { ResearchPanel } from '../src/screens/ResearchPanel.js';
import i18n from '../src/i18n/index.js';
import { ToastProvider } from '../src/ui/Toast.js';
import type { PlanetView, ResearchQueueOrderView } from '../src/api/schemas.js';
import { compact } from '../src/lib/format.js';
import { planetView } from './fixtures.js';

/**
 * THE RESEARCH SURFACE. T12.
 *
 * Research came off the planet sheet's "Reach" tab because it stopped being a
 * property of a world: since T7 the levels belong to the COMMANDER, and a screen
 * listing per-world hardware was the wrong shelf for the one thing on it that
 * every world already shares.
 *
 * TWO FACTS THIS FILE EXISTS TO KEEP TRUE, and both have been broken here before:
 *
 *  · EVERY PROJECT IS REACHABLE. When this panel was written the server priced,
 *    queued and applied fifteen projects and the interface rendered four — eleven
 *    ladders with no control anywhere that could buy them. A test that walks
 *    `RESEARCH_PROJECT_IDS` rather than a hand-written list is the only thing that
 *    catches the sixteenth.
 *  · A CLOSED DOOR SAYS WHY (interface I1: a requirement is a door, not an alarm).
 *    With one research queue shared across a commander's worlds, a row that is
 *    merely un-pressable teaches nothing.
 */

const ALL = RESEARCH_PROJECT_IDS;
const GROUPS = ['frontier', 'industry', 'doctrine', 'strategic'] as const;

type ResearchState = PlanetView['research'][number];

/** A project as the server reports it, open by default so a test states its own shut. */
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
  ...over,
});

const allOpen = (over: Partial<Record<ResearchProjectId, Partial<ResearchState>>> = {}) =>
  ALL.map((id) => state(id, over[id] ?? {}));

const researchOrder = (
  projectId: ResearchProjectId,
  finishesAt: Date,
  slot = 0,
): ResearchQueueOrderView => ({
  id: `research-${String(slot)}-${projectId}`,
  slot,
  projectId,
  level: 1,
  startedAt: new Date('2026-08-28T09:00:00.000Z'),
  finishesAt,
  cost: RESEARCH_PROJECTS[projectId].costAt(1),
});

/** A developed commander: Core past every gate, stock past every price. */
const world = (
  over: Partial<Omit<PlanetView, 'planet'>> = {},
  stock: Partial<PlanetView['planet']> = {},
): PlanetView =>
  planetView(
    {
      buildings: { CORE: 14, REFINERY: 6, EXTRACTOR: 6, VAULT: 3, SHIPYARD: 6, HANGAR: 2 },
      research: allOpen(),
      ...over,
    },
    {
      alloy: 900_000,
      crystal: 500_000,
      deuterium: 90_000,
      alloyCap: 2_000_000,
      crystalCap: 1_000_000,
      deuteriumCap: 200_000,
      ...stock,
    },
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

const show = (
  over: Partial<Omit<PlanetView, 'planet'>> = {},
  stock: Partial<PlanetView['planet']> = {},
  props: { onNeed?: (id: string) => void } = {},
) => {
  current = world(over, stock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <ResearchPanel {...props} />
      </ToastProvider>
    </QueryClientProvider>,
  );
};

type View = ReturnType<typeof render>;

const row = (view: View, id: ResearchProjectId): HTMLElement => {
  const found = view.container.querySelector<HTMLElement>(`#row-${id}`);
  expect(found, `no row for ${id}`).not.toBeNull();
  return found!;
};

const progression = (view: View, id: ResearchProjectId): string | null =>
  row(view, id).querySelector('[data-progression-state]')
    ?.getAttribute('data-progression-state') ?? null;

/**
 * WHERE A SHUT ROW STATES ITS REASON.
 *
 * The caption, not a button: a row that opens a detail sheet renders a chevron
 * where an inline action would go (`UpgradeRow`), so the sentence in the row IS
 * the whole statement of why. The sheet carries the control.
 */
const reason = (view: View, id: ResearchProjectId): string =>
  row(view, id).querySelector('[data-blocked-reason]')?.textContent ?? '';

/** Open one project's sheet — the row is the summary, the sheet is the decision. */
const open = async (view: View, id: ResearchProjectId): Promise<HTMLElement> => {
  const opener = row(view, id).querySelector<HTMLElement>('[data-open-item]');
  expect(opener, `${id} does not open`).not.toBeNull();
  await userEvent.click(opener!);
  const sheet = view.baseElement.querySelector<HTMLElement>('[data-item-sheet]');
  expect(sheet, `${id} opened no sheet`).not.toBeNull();
  return sheet!;
};

/** The sheet's one control, whatever state it is in. */
const act = (sheet: HTMLElement): HTMLElement | null =>
  sheet.querySelector<HTMLElement>('[data-act] button');

beforeEach(async () => {
  mutate.mockClear();
  // jsdom has no layout, so it has no `scrollIntoView`. `chat-screen.test.tsx`
  // stubs it the same way; the component calls it unguarded, as `PlanetScreen`
  // has since it gained the same "go to the thing blocking you" behaviour.
  Element.prototype.scrollIntoView = vi.fn();
  await i18n.changeLanguage('en');
});

describe('every project is reachable', () => {
  it('renders a row for all fifteen projects', () => {
    const view = show();
    for (const id of ALL) expect(row(view, id)).toBeInTheDocument();
  });

  it('renders each project exactly once', () => {
    const view = show();
    for (const id of ALL) {
      expect(view.container.querySelectorAll(`#row-${id}`), id).toHaveLength(1);
    }
  });

  /**
   * Derived rather than typed, so a sixteenth project in the rules package fails
   * here until someone gives it a home on this screen.
   */
  it('renders nothing the rules package does not have', () => {
    const view = show();
    const rendered = [...view.container.querySelectorAll('[id^="row-"]')]
      .map((element) => element.id.slice('row-'.length))
      .sort();
    expect(rendered).toEqual([...ALL].sort());
  });

  it('opens a clear, item-specific explanation for every project', async () => {
    const explanations = new Set<string>();
    for (const id of ALL) {
      const view = show();
      const sheet = await open(view, id);
      const detail = sheet.querySelector<HTMLElement>('[data-item-detail]')?.textContent.trim();
      expect(detail?.length, id).toBeGreaterThan(60);
      explanations.add(detail ?? '');
      view.unmount();
    }
    expect(explanations.size).toBe(ALL.length);
  }, 7_500);
});

describe('the groups', () => {
  const bands = (view: View): string[] =>
    [...view.container.querySelectorAll('[data-band]')]
      .map((element) => element.getAttribute('data-band') ?? '');

  const groupOf = (view: View, id: ResearchProjectId): string =>
    row(view, id).closest('[data-band]')?.getAttribute('data-band') ?? '';

  it('lists four groups in a fixed order', () => {
    expect(bands(show())).toEqual([...GROUPS]);
  });

  it('puts every project under the group it belongs to', () => {
    const view = show();
    const expected: Record<ResearchProjectId, string> = {
      ISOTOPE_SPECTROMETRY: 'frontier',
      DENSE_FUEL_CELLS: 'frontier',
      GRAVITIC_CHARGES: 'frontier',
      DEATH_STAR_PROTOCOL: 'frontier',
      DEUTERIUM_SYNTHESIS: 'industry',
      YARD_AUTOMATION: 'industry',
      PROSPECTOR_HOLDS: 'industry',
      CARGO_HOLDS: 'industry',
      WASP_DOCTRINE: 'doctrine',
      LANCE_DOCTRINE: 'doctrine',
      BULWARK_DOCTRINE: 'doctrine',
      EMPLACEMENT_DOCTRINE: 'doctrine',
      WEAPONS_GENERAL: 'doctrine',
      INTERCEPTION_GRID: 'strategic',
      STRATEGIC_STOCKPILE: 'strategic',
    };
    for (const id of ALL) expect(groupOf(view, id), id).toBe(expected[id]);
  });

  it('leaves no group empty', () => {
    const view = show();
    for (const band of GROUPS) {
      expect(ALL.some((id) => groupOf(view, id) === band), band).toBe(true);
    }
  });

  it('heads every group with a name', () => {
    const view = show();
    for (const band of view.container.querySelectorAll('[data-band] h3')) {
      expect(band.textContent.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('a levelled project shows how far up it is', () => {
  /**
   * DRAWN, NOT WRITTEN. Owner instruction: the fraction became a row of marks, so
   * what is asserted is the PICTURE — two lit, one on offer, the rest holes — and
   * the fraction survives only as the label a screen reader hears.
   */
  it('draws the rung held and the ceiling', () => {
    const view = show({ research: allOpen({ CARGO_HOLDS: { level: 2 } }) });
    const card = row(view, 'CARGO_HOLDS');
    expect(card.querySelectorAll('[data-rung]'))
      .toHaveLength(RESEARCH_MAX_LEVEL.CARGO_HOLDS);
    expect(card.querySelectorAll('[data-rung="held"]')).toHaveLength(2);
    expect(card.querySelectorAll('[data-rung="next"]')).toHaveLength(1);
    expect(card.querySelector('[role="img"]'))
      .toHaveAttribute('aria-label', `L2 / ${String(RESEARCH_MAX_LEVEL.CARGO_HOLDS)}`);
  });

  it('quotes the price of the next rung rather than the first', async () => {
    const third = RESEARCH_PROJECTS.CARGO_HOLDS.costAt(3);
    expect(third.alloy).not.toBe(RESEARCH_PROJECTS.CARGO_HOLDS.costAt(1).alloy);
    const view = show({ research: allOpen({ CARGO_HOLDS: { level: 2, cost: third } }) });
    const sheet = await open(view, 'CARGO_HOLDS');
    // Prices are compacted on both surfaces, so compare against the same formatter
    // the interface uses rather than against a raw figure it never renders.
    expect(sheet.textContent).toContain(compact(third.alloy));
    expect(sheet.textContent)
      .not.toContain(compact(RESEARCH_PROJECTS.CARGO_HOLDS.costAt(1).alloy));
    // And the sheet names which rung the money is buying.
    expect(sheet).toHaveTextContent(/Rung 3 of 5/i);
  });

  /**
   * A PERMISSION IS NOT A ONE-RUNG LADDER. "L1 / 1" is noise on a card that is
   * simply held or not, and six of the fifteen have nothing to count.
   */
  it('draws no ladder on a project with one rung', () => {
    const view = show({ research: allOpen({ GRAVITIC_CHARGES: { level: 1, completed: true } }) });
    expect(row(view, 'GRAVITIC_CHARGES').querySelectorAll('[data-rung]')).toHaveLength(0);
  });

  it('reads a project at its ceiling as complete', () => {
    const top = RESEARCH_MAX_LEVEL.YARD_AUTOMATION;
    const view = show({
      research: allOpen({
        YARD_AUTOMATION: {
          level: top, completed: true, available: false, queueAvailable: false,
        },
      }),
    });
    expect(progression(view, 'YARD_AUTOMATION')).toBe('complete');
  });

  it('buys nothing from a project already at its ceiling', async () => {
    const top = RESEARCH_MAX_LEVEL.YARD_AUTOMATION;
    const view = show({
      research: allOpen({
        YARD_AUTOMATION: {
          level: top, completed: true, available: false, queueAvailable: false,
        },
      }),
    });
    const control = act(await open(view, 'YARD_AUTOMATION'));
    if (control) await userEvent.click(control);
    expect(mutate).not.toHaveBeenCalled();
  });
});

/**
 * THE SWEEP — not one door at a time, but every row on the screen in a state where
 * most of them are shut, with none of them allowed to be silent about it.
 */
describe('a closed door states its reason', () => {
  const silent = (view: View): string[] =>
    ALL.filter((id) => progression(view, id) === 'locked' && reason(view, id).trim().length === 0);

  it('leaves no row shut and silent for a brand new commander', () => {
    const view = show(
      {
        buildings: { CORE: 1, REFINERY: 1, EXTRACTOR: 1, VAULT: 0, SHIPYARD: 0, HANGAR: 0 },
        research: ALL.map((id) => state(id, {
          discovered: id === 'DEUTERIUM_SYNTHESIS',
          available: id === 'DEUTERIUM_SYNTHESIS',
          queueDiscovered: id === 'DEUTERIUM_SYNTHESIS',
          queueAvailable: id === 'DEUTERIUM_SYNTHESIS',
          availableAt: new Date('2999-01-01T00:00:00.000Z'),
        })),
      },
      { alloy: 0, crystal: 0, deuterium: 0 },
    );
    expect(silent(view)).toEqual([]);
  });

  it('leaves no row shut and silent while the shared queue has room', () => {
    expect(silent(show({
      researchQueue: [
        researchOrder('YARD_AUTOMATION', new Date('2026-08-28T11:30:00.000Z')),
      ],
    }))).toEqual([]);
  });

  it('names the act clock on a Frontier project the season has not opened', () => {
    const view = show({
      research: allOpen({
        ISOTOPE_SPECTROMETRY: {
          discovered: false, available: false,
          queueDiscovered: false, queueAvailable: false,
          availableAt: new Date(Date.now() + 3_600_000),
        },
      }),
    });
    expect(row(view, 'ISOTOPE_SPECTROMETRY')).toHaveTextContent(/Researchable in/i);
  });

  it('names the raid condition behind Dense Fuel Cells once the isotope is held', () => {
    const view = show({
      research: allOpen({
        ISOTOPE_SPECTROMETRY: { level: 1, completed: true, available: false },
        DENSE_FUEL_CELLS: {
          discovered: false, available: false,
          queueDiscovered: false, queueAvailable: false,
        },
      }),
    });
    expect(row(view, 'DENSE_FUEL_CELLS')).toHaveTextContent(/Fill your cargo in one raid/i);
  });

  it('states the exact shield share behind Gravitic Charges', () => {
    const view = show({
      research: allOpen({
        ISOTOPE_SPECTROMETRY: { level: 1, completed: true, available: false },
        GRAVITIC_CHARGES: {
          discovered: false, available: false,
          queueDiscovered: false, queueAvailable: false,
        },
      }),
    });
    const share = Math.round(DEUTERIUM.graviticDiscoveryShieldShare * 100);
    expect(row(view, 'GRAVITIC_CHARGES')).toHaveTextContent(new RegExp(String(share)));
  });

  it('points at the isotope when nothing downstream has been found yet', () => {
    const view = show({
      research: allOpen({
        DENSE_FUEL_CELLS: {
          discovered: false, available: false,
          queueDiscovered: false, queueAvailable: false,
        },
      }),
    });
    expect(row(view, 'DENSE_FUEL_CELLS')).toHaveTextContent(/Isotope Spectrometry first/i);
  });

  /** D113's ordering: an act clock is not something you can fix by building. */
  it('names the War clock on the Protocol rather than claiming Gravitic is missing', () => {
    const view = show({
      research: allOpen({
        GRAVITIC_CHARGES: { level: 1, completed: true, available: false },
        DEATH_STAR_PROTOCOL: {
          discovered: false, available: false,
          queueDiscovered: false, queueAvailable: false,
          availableAt: new Date(Date.now() + 7_200_000),
        },
      }),
    });
    const protocol = row(view, 'DEATH_STAR_PROTOCOL');
    expect(protocol).toHaveTextContent(/War act opens in/i);
    expect(protocol).not.toHaveTextContent(/Gravitic Charges first/i);
  });

  it('names the Core level a project still needs', () => {
    const need = RESEARCH_PROJECTS.DEATH_STAR_PROTOCOL.requiredCore ?? 0;
    expect(need).toBeGreaterThan(1);
    const view = show({
      buildings: { CORE: need - 1, REFINERY: 6, EXTRACTOR: 6, VAULT: 3, SHIPYARD: 6, HANGAR: 2 },
    });
    expect(row(view, 'DEATH_STAR_PROTOCOL'))
      .toHaveTextContent(new RegExp(`Command Core to L${String(need)}`, 'i'));
  });

  /**
   * The Core lives on the planet sheet, not here, so the fix has to leave this
   * screen. Where the host cannot take it — the rehearsal, a standalone render —
   * the REASON still shows and only the shortcut is missing.
   */
  it('offers the Core as a fix when the host can take it', async () => {
    const onNeed = vi.fn();
    const need = RESEARCH_PROJECTS.DEATH_STAR_PROTOCOL.requiredCore ?? 0;
    const view = show(
      { buildings: { CORE: need - 1, REFINERY: 6, EXTRACTOR: 6, VAULT: 3, SHIPYARD: 6, HANGAR: 2 } },
      {},
      { onNeed },
    );
    const fix = act(await open(view, 'DEATH_STAR_PROTOCOL'));
    expect(fix).not.toBeNull();
    await userEvent.click(fix!);
    expect(onNeed).toHaveBeenCalledWith('CORE');
  });

  it('still states the Core reason with no host to take the fix', () => {
    const need = RESEARCH_PROJECTS.DEATH_STAR_PROTOCOL.requiredCore ?? 0;
    const view = show({
      buildings: { CORE: need - 1, REFINERY: 6, EXTRACTOR: 6, VAULT: 3, SHIPYARD: 6, HANGAR: 2 },
    });
    expect(row(view, 'DEATH_STAR_PROTOCOL'))
      .toHaveTextContent(new RegExp(`Command Core to L${String(need)}`, 'i'));
  });

  /**
   * A PREREQUISITE FIX STAYS ON THIS SCREEN. T12.
   *
   * The card it points at is three rows up. Handing that to the host — which is
   * what `onNeed` does for the Core — would close the research panel, open the
   * planet sheet, and land on a tab that has no research on it at all, which is
   * exactly what `TAB_OF` did after the cards moved.
   */
  it('scrolls to the prerequisite rather than leaving the screen', async () => {
    const onNeed = vi.fn();
    const view = show(
      {
        research: allOpen({
          DENSE_FUEL_CELLS: {
            discovered: false, available: false,
            queueDiscovered: false, queueAvailable: false,
          },
        }),
      },
      {},
      { onNeed },
    );
    expect(reason(view, 'DENSE_FUEL_CELLS')).toMatch(/Isotope Spectrometry first/i);
    const fix = act(await open(view, 'DENSE_FUEL_CELLS'));
    expect(fix).not.toBeNull();
    await userEvent.click(fix!);
    // The host is never called: nothing about this refusal lives off this screen.
    expect(onNeed).not.toHaveBeenCalled();
    expect(row(view, 'ISOTOPE_SPECTROMETRY')).toHaveAttribute('data-focused', 'true');
  });

  it('points the Protocol at Gravitic Charges the same way', async () => {
    const view = show({
      research: allOpen({
        DEATH_STAR_PROTOCOL: {
          discovered: false, available: false,
          queueDiscovered: false, queueAvailable: false,
        },
      }),
    });
    expect(reason(view, 'DEATH_STAR_PROTOCOL')).toMatch(/Gravitic Charges first/i);
    await userEvent.click(act(await open(view, 'DEATH_STAR_PROTOCOL'))!);
    expect(row(view, 'GRAVITIC_CHARGES')).toHaveAttribute('data-focused', 'true');
  });

  it('names a full Research queue', () => {
    const view = show({
      researchQueue: [
        researchOrder('YARD_AUTOMATION', new Date('2026-08-28T10:00:00.000Z'), 0),
        researchOrder('CARGO_HOLDS', new Date('2026-08-28T11:00:00.000Z'), 1),
        researchOrder('WASP_DOCTRINE', new Date('2026-08-28T12:00:00.000Z'), 2),
      ],
    });
    const fullQueueReason = reason(view, 'CARGO_HOLDS');
    expect(fullQueueReason).toMatch(/3 research projects are already queued/i);
    expect(fullQueueReason).toMatch(/wait for one to finish/i);
    expect(fullQueueReason).not.toMatch(/cancel/i);
  });
});

/**
 * ONE QUEUE, ACROSS EVERY WORLD. The selected world funds a project; the lane
 * itself belongs to the commander and never occupies Construction or Yard.
 */
describe('the commander research queue', () => {
  it('does not offer cancellation for a commander commitment', () => {
    const view = show({
      researchQueue: [
        researchOrder('YARD_AUTOMATION', new Date('2026-08-28T11:30:00.000Z')),
      ],
    });
    expect(view.container.querySelector('[data-cancel]')).toBeNull();
  });

  it('names the running project and when it finishes', () => {
    const view = show({
      researchQueue: [
        researchOrder('YARD_AUTOMATION', new Date('2026-08-28T11:30:00.000Z')),
      ],
    });
    const running = view.container.querySelector('[data-research-running]');
    expect(running).toHaveTextContent(/Yard Automation/);
  });

  it('gives the finish as a clock time rather than a bare countdown', () => {
    const view = show({
      researchQueue: [
        researchOrder('YARD_AUTOMATION', new Date('2026-08-28T11:30:00.000Z')),
      ],
    });
    expect(view.container.querySelector('[data-research-finishes]')?.textContent ?? '')
      .toMatch(/\d/);
  });

  it('says so when nothing is running', () => {
    const view = show();
    expect(view.container.querySelector('[data-research-running]')).toBeNull();
    expect(view.container.querySelector('[data-research-idle]')).toBeInTheDocument();
  });

  it('keeps projects available while the shared queue has room', () => {
    const view = show({
      researchQueue: [
        researchOrder('YARD_AUTOMATION', new Date('2026-08-28T11:30:00.000Z')),
      ],
    });
    for (const id of ALL) {
      expect(reason(view, id), id).not.toMatch(/queue is full/i);
    }
  });

  it('states that planet queues keep running separately', () => {
    const view = show({
      researchQueue: [
        researchOrder('YARD_AUTOMATION', new Date('2026-08-28T11:30:00.000Z')),
      ],
    });
    expect(view.getByText(/Construction and Yard.*keep running separately/i))
      .toBeInTheDocument();
  });

  /**
   * D93–D95's chaining: a project queued behind its own prerequisite on the SAME
   * world is how the Frontier act is meant to be played, and the server allows it.
   * Refusing it here would break a working sequence with a rule aimed elsewhere.
   */
  it('still allows a second project behind the first on this world', () => {
    const view = show({
      researchQueue: [
        researchOrder('ISOTOPE_SPECTROMETRY', new Date('2026-08-28T10:00:00.000Z')),
      ],
    });
    expect(reason(view, 'DENSE_FUEL_CELLS')).not.toMatch(/is running/i);
  });

  /**
   * THE QUEUE'S OWN PROJECTION, WHICH THIS SCREEN INHERITED. D93-D95.
   *
   * A prerequisite sitting in the Construction queue counts: the server's
   * `queueAvailable` says so, and refusing the second half of a chain because the
   * first has not FINISHED would break the sequence the Frontier act is built on.
   * This assertion lived in `build-sheet.test.tsx` while the cards did, and it
   * moved here with them rather than being rewritten.
   */
  it('offers research unlocked by the queued world, not only by durable state', async () => {
    const view = show({
      research: allOpen({
        DENSE_FUEL_CELLS: {
          discovered: false,
          available: false,
          queueDiscovered: true,
          queueAvailable: true,
        },
      }),
      researchQueue: [
        researchOrder('ISOTOPE_SPECTROMETRY', new Date('2026-08-28T10:00:00.000Z')),
      ],
    });

    expect(reason(view, 'DENSE_FUEL_CELLS')).toBe('');
    const control = act(await open(view, 'DENSE_FUEL_CELLS'));
    expect(control).toBeEnabled();
    await userEvent.click(control!);
    expect(mutate).toHaveBeenCalledWith('DENSE_FUEL_CELLS', expect.anything());
  });

  it('marks a project queued on this world rather than calling it blocked', () => {
    const view = show({
      researchQueue: [
        researchOrder('CARGO_HOLDS', new Date('2026-08-28T10:00:00.000Z')),
      ],
    });
    expect(progression(view, 'CARGO_HOLDS')).toBe('queued');
  });

  it('reads the running project off this world too', () => {
    const view = show({
      researchQueue: [
        researchOrder('CARGO_HOLDS', new Date('2026-08-28T10:00:00.000Z')),
      ],
    });
    expect(view.container.querySelector('[data-research-running]'))
      .toHaveTextContent(/Cargo Holds/);
  });
});

describe('buying a rung', () => {
  it('sends the project id', async () => {
    const view = show();
    const control = act(await open(view, 'CARGO_HOLDS'));
    expect(control).not.toBeNull();
    await userEvent.click(control!);
    expect(mutate).toHaveBeenCalledWith('CARGO_HOLDS', expect.anything());
  });

  it('sends nothing from a row whose door is shut', async () => {
    const view = show({
      research: allOpen({
        CARGO_HOLDS: {
          discovered: false, available: false,
          queueDiscovered: false, queueAvailable: false,
        },
      }),
    });
    const control = act(await open(view, 'CARGO_HOLDS'));
    if (control) await userEvent.click(control);
    expect(mutate).not.toHaveBeenCalled();
  });
});

describe('in Turkish', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('tr');
  });

  it('states the raid conditions as Turkish rather than as translated English', () => {
    const view = show({
      research: allOpen({
        ISOTOPE_SPECTROMETRY: { level: 1, completed: true, available: false },
        DENSE_FUEL_CELLS: {
          discovered: false, available: false,
          queueDiscovered: false, queueAvailable: false,
        },
        GRAVITIC_CHARGES: {
          discovered: false, available: false,
          queueDiscovered: false, queueAvailable: false,
        },
      }),
    });
    expect(row(view, 'DENSE_FUEL_CELLS'))
      .toHaveTextContent('Bir akında ambarını doldur; hedefte ganimet kalsın');
    expect(row(view, 'GRAVITIC_CHARGES'))
      .toHaveTextContent('Aegis akın hasarının en az %25’ini emsin');
  });

  it('names every project and every group', () => {
    const view = show();
    for (const id of ALL) {
      expect(row(view, id).textContent.trim().length, id).toBeGreaterThan(0);
    }
    for (const band of view.container.querySelectorAll('[data-band] h3')) {
      expect(band.textContent.trim().length).toBeGreaterThan(0);
    }
  });
});

/**
 * THE ROW/SHEET GRAMMAR, WHICH CAME WITH THE CARDS. D109.
 *
 * `orbit.test.tsx` walks this for every item kind on the planet sheet and used to
 * include Isotope Spectrometry among them. Research left that screen, so the case
 * left with it: a card never commits money inline — it opens, and the sheet is
 * where the decision is made.
 */
describe('the row and sheet grammar', () => {
  it('opens every project before it offers a commitment', async () => {
    for (const id of ALL) {
      const view = show();
      const card = row(view, id);
      expect(
        within(card).queryByRole('button', { name: /^research$/i }),
        id,
      ).toBeNull();
      const sheet = await open(view, id);
      expect(within(sheet).getByRole('button', { name: /research/i }), id).toBeInTheDocument();
      view.unmount();
    }
  }, 7_500);
});

/**
 * WHAT THE PORTRAIT SAYS YOU OWN.
 *
 * GREY MEANS "YOU DO NOT HAVE THIS". Every other buyable in the game greys its
 * portrait on `level === 0` — `ItemSheet` on the planet screen, and `UpgradeRow`
 * for the row itself, including the research rows. The research SHEET used a
 * different threshold: it greyed unless the project was COMPLETE, so a doctrine
 * with three of its five rungs bought was drawn as though the player owned none of
 * it — and it contradicted the row the player had just tapped, which showed the
 * same project in colour. One item, two answers, one tap apart.
 */
describe('the sheet portrait', () => {
  const portrait = (sheet: HTMLElement): HTMLImageElement => {
    const img = sheet.querySelector<HTMLImageElement>('img');
    expect(img, 'the sheet drew no portrait').not.toBeNull();
    return img!;
  };

  it('greys a project the commander has never bought', async () => {
    const view = show({ research: allOpen({ CARGO_HOLDS: { level: 0 } }) });
    expect(portrait(await open(view, 'CARGO_HOLDS')).className).toMatch(/grayscale/);
  });

  /** THE REGRESSION: part-owned is owned, and must not read as unowned. */
  it('draws a part-owned ladder in full colour', async () => {
    const view = show({ research: allOpen({ CARGO_HOLDS: { level: 2 } }) });
    expect(portrait(await open(view, 'CARGO_HOLDS')).className).not.toMatch(/grayscale/);
  });

  it('draws a finished ladder in full colour too', async () => {
    const view = show({ research: allOpen({ CARGO_HOLDS: { level: 5, completed: true } }) });
    expect(portrait(await open(view, 'CARGO_HOLDS')).className).not.toMatch(/grayscale/);
  });

  /** A one-rung permission is owned or it is not; there is no part-way. */
  it('colours a permission the moment it is held', async () => {
    const shut = show({ research: allOpen({ GRAVITIC_CHARGES: { level: 0 } }) });
    expect(portrait(await open(shut, 'GRAVITIC_CHARGES')).className).toMatch(/grayscale/);
    shut.unmount();

    const held = show({ research: allOpen({ GRAVITIC_CHARGES: { level: 1, completed: true } }) });
    expect(portrait(await open(held, 'GRAVITIC_CHARGES')).className).not.toMatch(/grayscale/);
  });

  /**
   * AND IT SAYS WHICH RUNG. Research art is not tiered, so a doctrine at 1 and at
   * 4 are the same picture — the index is the only thing that can tell them apart.
   */
  it('draws the rung held on a ladder', async () => {
    const view = show({ research: allOpen({ CARGO_HOLDS: { level: 2 } }) });
    const sheet = await open(view, 'CARGO_HOLDS');
    expect(sheet.querySelector('.item-portrait-index')?.textContent).toBe('02');
  });

  /** A permission has no rung to report, so it shows no index. */
  it('draws no rung on a permission', async () => {
    const view = show({ research: allOpen({ GRAVITIC_CHARGES: { level: 1, completed: true } }) });
    const sheet = await open(view, 'GRAVITIC_CHARGES');
    expect(sheet.querySelector('.item-portrait-index')).toBeNull();
  });
});
