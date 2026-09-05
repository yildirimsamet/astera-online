import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlanetScreen } from '../src/screens/PlanetScreen.js';
import { ToastProvider } from '../src/ui/Toast.js';
import type { PlanetView } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';
import i18n from '../src/i18n/index.js';

/**
 * WHERE THE PLANET SHEET PUTS THINGS, AND WHICH TAB IT OPENS ON. D170.
 *
 * Three owner corrections, all about the same failure: the sheet was deciding for
 * the commander. It opened on whichever tab a recommendation engine liked that
 * minute, and it put the two orbital satellites above nineteen hull rows — where
 * they are read first and wanted last.
 */

const rich = (): PlanetView =>
  planetView(
    {
      buildings: { CORE: 6, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 4, HANGAR: 4 },
      orbitSlots: 3,
      fleet: {},
      fleetAway: {},
      score: { wealth: 10_000, dominion: 0 },
    },
    { alloy: 900_000, crystal: 400_000, alloyCap: 2_000_000, crystalCap: 900_000 },
  );

let current: PlanetView = rich();

vi.mock('../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/api/queries.js');
  return {
    ...actual,
    usePlanet: () => ({ data: current, dataUpdatedAt: Date.now(), isPending: false, refetch: vi.fn() }),
    useGalaxy: () => ({ data: undefined }),
    useIntel: () => ({ data: undefined }),
    usePending: () => ({ data: undefined }),
    useReports: () => ({ data: undefined }),
    useUpgrade: () => ({ mutate: vi.fn(), isPending: false }),
    useBuild: () => ({ mutate: vi.fn(), isPending: false }),
    useCompleteResearch: () => ({ mutate: vi.fn(), isPending: false }),
    useInstallSatellite: () => ({ mutate: vi.fn(), isPending: false }),
    useRaiseInstrument: () => ({ mutate: vi.fn(), isPending: false }),
    useCancelBuildOrder: () => ({ mutate: vi.fn(), isPending: false }),
    useBuildDeathStar: () => ({ mutate: vi.fn(), isPending: false }),
    useBuildInterceptor: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

const show = (focusGroup?: 'grow' | 'orbit' | 'defend' | 'reach') => {
  current = rich();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <PlanetScreen {...(focusGroup === undefined ? {} : { focusGroup })} />
      </ToastProvider>
    </QueryClientProvider>,
  );
};

/** Where a band's heading sits in the document, so two can be compared. */
const positionOf = (label: string): number => {
  const node = screen.getByText(label);
  const all = Array.from(document.querySelectorAll('*'));
  return all.indexOf(node);
};

describe('the fleet tab puts the orbit satellites last', () => {
  /**
   * THE DERRICK AND THE BEACON ARE A FOOTNOTE, NOT AN OPENING. Owner instruction.
   *
   * Two satellite rows sat above the whole hull catalogue, so the first thing a
   * commander read on the tab named "what can I reach" was a pair of purchases
   * they make once a season. They belong beside the Prospector, whose yield the
   * Derrick is there to raise, at the bottom where a reader arrives having already
   * passed what they came for.
   */
  it('draws the orbit band after the mining band', () => {
    show('reach');
    const mining = positionOf(i18n.t('planet.reach.miningBand'));
    const orbit = positionOf(i18n.t('planet.reach.orbitBand'));
    expect(mining).toBeGreaterThan(0);
    expect(orbit).toBeGreaterThan(mining);
  });
});

describe('the sheet opens on production', () => {
  /**
   * IT USED TO OPEN WHEREVER A RECOMMENDATION ENGINE POINTED, and the owner's
   * report is the whole case against it: *"bir başka açılıyor bir başka"*. A sheet
   * that opens somewhere different every time cannot be navigated by habit, and
   * habit is the only thing that makes a four-tab sheet cheap to use.
   *
   * An explicit `focusGroup` still wins — that is a caller saying where to go,
   * which is the opposite of the screen guessing.
   */
  it('opens on the production tab when nothing was asked for', () => {
    show();
    expect(screen.getByRole('tab', { name: i18n.t('planet.tabs.growProblem') }))
      .toHaveAttribute('aria-selected', 'true');
  });

  it('still honours a caller that names a tab', () => {
    show('reach');
    expect(screen.getByRole('tab', { name: i18n.t('planet.tabs.reachProblem') }))
      .toHaveAttribute('aria-selected', 'true');
  });
});

describe('what a Death Star strike actually does', () => {
  /**
   * THE COPY WAS TWO DECISIONS OUT OF DATE. D167 replaced acquisition with a
   * DEADLINE: a strike no longer takes anything and a second strike takes nothing
   * either. It darkens a world for its own recovery window — two hours for a
   * capital, eight for a colony — and a COLONY whose commander lands no ship
   * inside that window is released to NOBODY, neutral again and open to any
   * settler. A capital is never released at all.
   *
   * The old lines promised "a second strike can capture a colony", which is a
   * rule the game stopped having. A weapon this expensive being sold on a
   * mechanic that does not exist is the most costly copy error the sheet can make.
   */
  it('states the deadline rather than a capture', () => {
    show('reach');
    const hint = screen.getByText(i18n.t('planet.deathStar.dangerHint'));
    expect(hint).toBeInTheDocument();
    for (const forbidden of ['ele geçir', 'capture']) {
      expect(i18n.t('planet.deathStar.dangerHint').toLowerCase()).not.toContain(forbidden);
      expect(i18n.t('planet.deathStar.readyHint').toLowerCase()).not.toContain(forbidden);
    }
  });

  it('names both recovery windows and what the colony loses', () => {
    const released = i18n.t('planet.deathStar.effectRelease');
    expect(released).toMatch(/8/);
    expect(i18n.t('planet.deathStar.effectDark')).toMatch(/2/);
  });

  /**
   * FOLDED, AND SHUT ON ARRIVAL. Owner instruction.
   *
   * Six lines of reference under a purchase nobody makes twice is height spent on
   * every visit to pay for one. The rule is still one tap away, which is what
   * progressive disclosure means: the row states the fact, the fold states the
   * rule.
   */
  it('folds the effects list and starts it shut', () => {
    show('reach');
    const toggle = screen.getByRole('button', { name: i18n.t('planet.deathStar.effectsTitle') });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(i18n.t('planet.deathStar.effectFleet'))).not.toBeInTheDocument();
  });
});
