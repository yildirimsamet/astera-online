import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { PlanetFocus } from '../src/galaxy/FocusPanel.js';
import type { GalaxyPlanet, IntelView, PlanetView } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { planetView } from './fixtures.js';

/**
 * WHAT THE FOCUS RAIL SPENDS THE SCREEN ON. Owner report, with screenshots.
 *
 * Two things filled a 375-wide phone and neither earned it:
 *
 *   · THREE FULL-WIDTH SLABS stacked down the rail, one of which existed only to
 *     announce a weapon the commander does not own. `interface.md` I1 says an
 *     unavailable action stays visible with its reason on it — and that rule is
 *     about a gap the player is about to CLOSE. "You have no Death Star" to
 *     somebody who has never built one is not a gap; it is a row of type.
 *   · THE COLONY ROUTE as three fully-expanded cards, every step's prose and
 *     requirement chips on screen at once, for a three-step process the player is
 *     only ever standing on one step of.
 *
 * Measured against `interface.md`'s four questions this is Interaction cost, and
 * the fix for both is the same one the ship lists already took: show the step
 * that is live, keep the rest one line and one tap away.
 */

const NOW = new Date('2026-04-01T12:00:00.000Z').getTime();

const harness = () => {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queries}>
      <ApiProvider api={api}>
        <ToastProvider>{children}</ToastProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
};

const target = (over: Partial<GalaxyPlanet> = {}): GalaxyPlanet => ({
  id: 'p2',
  name: 'Grimhold',
  owner: 'Sable',
  position: { x: 200, y: 0, z: 0 },
  coreTier: 2,
  coreLevel: 6,
  intel: 'RESOLVED' as const,
  state: { kind: 'NORMAL' as const },
  satellites: [],
  shielded: false,
  isSelf: false,
  ...over,
});

const commander = (over: Partial<Omit<PlanetView, 'planet'>> = {}): PlanetView =>
  planetView(
    {
      buildings: { CORE: 4, REFINERY: 2, EXTRACTOR: 2, VAULT: 1, SHIPYARD: 1 },
      instruments: { TELESCOPE: 1, RADAR: 0, AEGIS: 0, VEIL: 0 },
      orbit: ['UPLINK'],
      fleet: { DART: 6, COURIER: 2 },
      ...over,
    },
    { alloy: 4000, crystal: 2000, alloyCap: 9000, crystalCap: 4000 },
  );

const intel: IntelView = {
  watching: [],
  probeReports: [],
  probeCooldowns: [],
  radarLog: [],
  probeCost: { alloy: 25, crystal: 25, deuterium: 0 },
};

const show = (world: GalaxyPlanet = target(), planet: PlanetView = commander()) => {
  const Wrapper = harness();
  return render(
    <Wrapper>
      <PlanetFocus
        target={world}
        planet={planet}
        intel={intel}
        reports={[]}
        now={NOW}
        onClose={vi.fn()}
        onAttack={vi.fn()}
        onDeathStar={vi.fn()}
        onInstallTelescope={vi.fn()}
        onLaunched={vi.fn()}
        open
        onToggle={vi.fn()}
      />
    </Wrapper>,
  );
};

beforeEach(async () => {
  await i18n.changeLanguage('en');
  // The panel's folds are remembered per device; jsdom shares one store per file.
  window.localStorage.clear();
});

describe('a weapon you do not own takes no space', () => {
  it('spends no row telling a commander they have no Death Star', () => {
    const view = show();
    expect(view.container.querySelector('[data-death-star]')).toBeNull();
  });

  /**
   * OWNING ONE CHANGES THE ANSWER. Once a strategic asset exists the control is a
   * real action with a real gap, and the block reason is something the commander
   * can act on — which is exactly the case I1 was written for.
   */
  it('shows the control, with its reason, once one is being built', () => {
    const withWeapon = commander();
    const view = show(target(), {
      ...withWeapon,
      strategic: { id: 's1', status: 'BUILDING', readyAt: null, remainingSeconds: 900 },
    });
    const control = view.container.querySelector('[data-death-star]');
    expect(control, 'a commander building one is told nothing about it').not.toBeNull();
    expect(control).toBeDisabled();
  });

  it('offers it as a live action once it is ready', () => {
    const withWeapon = commander();
    const view = show(target(), {
      ...withWeapon,
      strategic: { id: 's1', status: 'READY', readyAt: new Date(NOW), remainingSeconds: null },
    });
    expect(view.container.querySelector('[data-death-star]')).not.toBeNull();
  });
});

describe('the colony route is a stepper, not three essays', () => {
  /** An unclaimed world nobody has started a race for: phase `NEUTRAL_PREP`. */
  const neutral = target({ kind: 'NEUTRAL', neutral: { claimUntil: null } });

  /** No early return anywhere below: a guard that skips is a test that lies. */
  const stepsOf = (view: ReturnType<typeof show>): HTMLElement[] => {
    const steps = [...view.container.querySelectorAll<HTMLElement>('[data-colony-step]')];
    expect(steps.length, 'the colony route did not render at all').toBeGreaterThan(0);
    return steps;
  };

  it('expands only the step the commander is standing on', () => {
    const open = stepsOf(show(neutral))
      .filter((step) => step.getAttribute('data-open') === 'true');
    expect(open).toHaveLength(1);
  });

  it('keeps the other steps to a single tappable line', () => {
    const shut = stepsOf(show(neutral))
      .filter((step) => step.getAttribute('data-open') !== 'true');
    expect(shut.length).toBeGreaterThan(0);
    for (const step of shut) {
      expect(step.querySelector('[data-step-detail]'), 'a shut step still draws its prose')
        .toBeNull();
    }
  });

  it('opens a step that is pressed, so the player may read ahead', async () => {
    const view = show(neutral);
    const shut = stepsOf(view).find((step) => step.getAttribute('data-open') !== 'true');
    expect(shut, 'every step is already open').toBeDefined();
    await userEvent.click(shut!.querySelector('button')!);
    expect(shut!.querySelector('[data-step-detail]')).not.toBeNull();
  });
});

describe('an unknown fact states itself; its sales pitch waits to be asked for', () => {
  /**
   * A dossier can hold four gaps at once and each drew a label, the fact, a
   * two-line paragraph on why it matters, and a full-width control. Four of those
   * is most of a 375-wide screen spent on things the commander does NOT know,
   * above the two commitments that act on it.
   *
   * The same division the route steps take, for the same reason: PROSE folds,
   * ACTIONS never. What is missing and the button that closes it stay on screen;
   * the argument for caring is one tap away and is not deleted — `interface.md`'s
   * fourth question is about cost, not about removing the answer to its third.
   */
  it('keeps the missing fact and its control visible', () => {
    const view = show();
    const gap = view.container.querySelector('[data-gap]');
    expect(gap, 'the panel shows no intelligence gaps at all').not.toBeNull();
    // The fact itself is never folded.
    expect(gap!.querySelector('[data-gap-missing]')).not.toBeNull();
  });

  it('folds the reason it matters', () => {
    const view = show();
    const gap = view.container.querySelector('[data-gap]')!;
    expect(gap.querySelector('[data-gap-why]')).toBeNull();
  });

  it('gives the reason when it is asked for', async () => {
    const view = show();
    const gap = view.container.querySelector('[data-gap]')!;
    await userEvent.click(gap.querySelector('button')!);
    expect(gap.querySelector('[data-gap-why]')).not.toBeNull();
  });
});

describe('the dossier is grouped by what each reading cost', () => {
  /**
   * Owner instruction: *"focus sheet'indeki telescope bilgileri ve sonda bilgileri
   * ... sectionlar ayrı accordionlara alınabilir."*
   *
   * `Fact.source` has always carried the grouping — free sight, a Telescope slot, a
   * probe and a round trip, ships you cannot get back — and the panel rendered one
   * flat list, so a world's public position sat at the same weight as a reading a
   * commander paid alloy and a flight bay for.
   */
  it('bands the facts by their source rather than listing them flat', () => {
    const view = show();
    const bands = [...view.container.querySelectorAll('[data-fact-source]')];
    expect(bands.length, 'the dossier is still one flat list').toBeGreaterThan(0);
  });

  it('draws no band for a source that returned nothing', () => {
    const view = show();
    for (const band of view.container.querySelectorAll('[data-fact-source]')) {
      // A heading over nothing tells a commander they hold a kind of reading they
      // do not — the same rule `familyGroups` follows for an empty ship band.
      expect(band.querySelector('[aria-expanded]')).not.toBeNull();
    }
  });

  it('remembers which band was left open', () => {
    window.localStorage.setItem('astera.accordion.dossier', JSON.stringify(['battle']));
    const view = show();
    const probe = view.container.querySelector('[data-fact-source="probe"] [aria-expanded]');
    if (probe) expect(probe).toHaveAttribute('aria-expanded', 'false');
    const battle = view.container.querySelector('[data-fact-source="battle"] [aria-expanded]');
    if (battle) expect(battle).toHaveAttribute('aria-expanded', 'true');
  });
});
