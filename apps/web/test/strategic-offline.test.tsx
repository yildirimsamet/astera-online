import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { FEATURE_FLAGS } from '@astera/rules';
import i18n from '../src/i18n/index.js';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { PlanetFocus } from '../src/galaxy/FocusPanel.js';
import type { GalaxyPlanet, IntelView, PlanetView } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';

/**
 * A WEAPON NOBODY CAN BUILD MAY NOT EXPLAIN ITSELF. Owner report.
 *
 * `FEATURE_FLAGS.STRATEGIC_CRAFTING_ENABLED` took the forge, the interceptor and
 * the three strategic research rows off the screen — and left every SENTENCE
 * about them where it was. The focus rail told a commander what a Death Star does
 * to a capital, what it does to an open claim, and drew a two-step "what a strike
 * does" route under every foreign colony; the Aegis sheet told them which
 * instrument stops one; a probe came home "unsure" about a pad that cannot hold
 * anything.
 *
 * That is worse than showing the feature. A rule with no control attached is the
 * exact failure `CLAUDE.md`'s third question names — the player holds an
 * explanation they cannot act on, about a thing they cannot find, and the only
 * conclusion available is that the game is broken.
 *
 * The guard is on RENDERED TEXT rather than on the individual keys, because the
 * keys are not the bug: each of them is correct copy for the day the flag flips
 * back. What may not happen is one of them reaching a screen while it is off.
 */
const WEAPON = /death star|ölüm yıldız/i;

/**
 * AND THE SYSTEM AROUND IT, for the copy guard below only.
 *
 * "Stopping a Death Star requires an Interception Grid" was the loud leak; "it
 * cannot intercept strategic weapons" is the same sentence with the nouns filed
 * off, and it is on the same Aegis card. A player cannot reach a strategic weapon,
 * a grid or an interception anywhere in this build, so a clause about what the
 * shield does NOT do to them explains nothing and raises a question with no
 * answer on any screen.
 *
 * Kept off the RENDER checks on purpose: the disc, the reports and the chronicle
 * legitimately use "strategic" for other things.
 */
const SYSTEM = /interception grid|strategic weapon|strategic interception|önleme ağı|stratejik silah/i;

const NOW = new Date('2026-09-16T12:00:00.000Z').getTime();

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

/** A commander far enough along to be shown every gate the guide draws. */
const mine: PlanetView = planetView(
  {
    buildings: { CORE: 9, REFINERY: 4, EXTRACTOR: 4, VAULT: 3, SHIPYARD: 3 },
    instruments: { TELESCOPE: 1, RADAR: 1, AEGIS: 0, VEIL: 0 },
    orbit: ['UPLINK'],
    fleet: { DART: 6, COURIER: 4 },
  },
  { alloy: 40_000, crystal: 20_000, alloyCap: 90_000, crystalCap: 40_000 },
);

const intel: IntelView = {
  watching: [],
  probeReports: [],
  probeCooldowns: [],
  radarLog: [],
  probeCost: { alloy: 25, crystal: 25, deuterium: 0 },
};

const show = (world: Partial<GalaxyPlanet>): HTMLElement => {
  const Wrapper = harness();
  const view = render(
    <Wrapper>
      <PlanetFocus
        target={target(world)}
        planet={mine}
        intel={intel}
        reports={[]}
        now={NOW}
        onClose={vi.fn()}
        onAttack={vi.fn()}
        onSettle={vi.fn()}
        onInstallTelescope={vi.fn()}
        onLaunched={vi.fn()}
        open
        onToggle={vi.fn()}
      />
    </Wrapper>,
  );
  return view.container;
};

describe.skipIf(FEATURE_FLAGS.STRATEGIC_CRAFTING_ENABLED)('the focus rail while the weapon is off', () => {
  it('explains a foreign capital without naming the weapon', () => {
    const container = show({ kind: 'CAPITAL', isCapital: true });
    expect(container.textContent).not.toMatch(WEAPON);
  });

  /**
   * AND IT STILL HAS TO SAY THE THING THAT MATTERS. Removing the sentence is only
   * half the job: "Uncapturable capital" with nothing under it is a headline with
   * no rule, which is the failure the copy was written to avoid in the first
   * place.
   */
  it('still tells a raider what a capital costs them', () => {
    const container = show({ kind: 'CAPITAL', isCapital: true });
    expect(container.textContent).toMatch(/uncapturable capital/i);
    expect(container.textContent).toMatch(/never changes hands|control/i);
  });

  it('names no weapon in an open colony race', () => {
    const container = show({
      kind: 'NEUTRAL',
      owner: '',
      neutral: { claimUntil: new Date(NOW + 30 * 60_000) },
    });
    expect(container.textContent).toMatch(/colony race open/i);
    expect(container.textContent).not.toMatch(WEAPON);
  });

  /**
   * THE WHOLE SECTION GOES, NOT ONLY ITS HEADER. "What a strike does" was a
   * heading over a two-step route — damage, then the clock running out — and both
   * steps describe an impact that cannot be delivered.
   */
  it('draws no strike route under a foreign colony', () => {
    const container = show({ kind: 'COLONY' });
    expect(container.textContent).not.toMatch(WEAPON);
    expect(container.textContent).not.toMatch(/what a strike does/i);
    expect(container.textContent).not.toMatch(/dark/i);
  });

  /**
   * THE OCCUPATION WINDOW IS NOT PART OF THE WEAPON. It refuses raids too, so it
   * survives the flag — the section it lives in must lose the strike route
   * without losing this.
   */
  it('keeps the occupation shield notice on a colony that carries one', () => {
    const container = show({
      kind: 'COLONY',
      state: { kind: 'PROTECTED', until: new Date(NOW + 60 * 60_000) },
    });
    expect(container.textContent).toMatch(/occupation protection/i);
    expect(container.textContent).not.toMatch(WEAPON);
  });
});

/**
 * THE SENTENCES THAT ARE ON SCREEN WHATEVER THE FLAG SAYS.
 *
 * Every key below belongs to a surface with no strategic gate on it at all — an
 * instrument sheet, a doctrine sheet, the clan rules card. They named the weapon
 * in a clause about what they do NOT affect, which is the most invisible kind of
 * leak: nobody reads a negative clause when they are checking a feature flag.
 */
describe.skipIf(FEATURE_FLAGS.STRATEGIC_CRAFTING_ENABLED)('copy on ungated surfaces', () => {
  const ALWAYS_VISIBLE = [
    'focus.planet.capitalRaidOnlyHint',
    'vocabulary.instrument.AEGIS.detail',
    'vocabulary.instrument.AEGIS.roleNone',
    'vocabulary.instrument.AEGIS.roleOwned',
    'vocabulary.satellite.BEACON.detail',
    'gains.research.speedScope',
    'research.denseDetail',
    'research.powerDetail',
    'research.armorDetail',
    'research.propulsionDetail',
    'clan.benefits.safeBody',
    'clan.rules.peaceBody',
  ] as const;

  for (const language of ['en', 'tr'] as const) {
    for (const key of ALWAYS_VISIBLE) {
      it(`${language}/${key} names no weapon`, () => {
        const translate = i18n.getFixedT(language);
        const text = translate(key as never, { share: '25%' });
        // A mistyped path returns the path, which matches nothing and would let
        // this guard pass while watching a key that does not exist.
        expect(text, `${key} is not in the ${language} tree`).not.toBe(key);
        expect(text).not.toMatch(WEAPON);
        expect(text).not.toMatch(SYSTEM);
      });
    }
  }
});
