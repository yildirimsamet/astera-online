import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { MULTI_WORLD } from '@astera/rules';
import { compact } from '../src/lib/format.js';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { PlanetFocus } from '../src/galaxy/FocusPanel.js';
import type { GalaxyPlanet, IntelView, PlanetView } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';

/**
 * THE TWO CONTROLS ON THE FOCUS RAIL THAT COMMIT SOMETHING. Owner instruction.
 *
 * Both got a glyph, and the reason is a phone: this rail is a stack of slabs of
 * the same size, weight and colour family, and shape is what a thumb recognises
 * before the word is read. The attack is also the ONE irreversible control in the
 * game — `slab-commit` exists for it and nothing else — so it is the one that
 * most deserves to be identifiable at a glance.
 *
 * Asserted at the DOM, because the failure mode is an icon that typechecks and
 * renders nowhere: `.slab` is a flex row and a glyph dropped into it either
 * appears beside the label or does not appear at all.
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
  satellites: [],
  shielded: false,
  isSelf: false,
  ...over,
});

/** A commander who can afford a probe and is inside the attack band. */
const mine: PlanetView = planetView(
  {
    buildings: { CORE: 4, REFINERY: 2, EXTRACTOR: 2, VAULT: 1, SHIPYARD: 1 },
    instruments: { TELESCOPE: 1, RADAR: 0, AEGIS: 0, VEIL: 0 },
    orbit: ['UPLINK'],
    fleet: { WASP: 6 },
  },
  { alloy: 4000, crystal: 2000, alloyCap: 9000, crystalCap: 4000 },
);

const intel: IntelView = {
  watching: [],
  probeReports: [],
  radarLog: [],
  probeCost: { alloy: 25, crystal: 25, deuterium: 0 },
};

const show = () => {
  const Wrapper = harness();
  render(
    <Wrapper>
      <PlanetFocus
        target={target()}
        planet={mine}
        intel={intel}
        reports={[]}
        now={NOW}
        onClose={vi.fn()}
        onAttack={vi.fn()}
        onInstallTelescope={vi.fn()}
        onLaunched={vi.fn()}
        open
        onToggle={vi.fn()}
      />
    </Wrapper>,
  );
};

describe('the focus rail’s two commitments', () => {
  it('leads with the commander and keeps the planet as location context', () => {
    show();
    expect(screen.getByRole('region', { name: 'Sable — focus' })).toBeInTheDocument();
    expect(screen.getByText('World · Grimhold')).toBeInTheDocument();
  });

  it('marks the attack with a glyph as well as a word', () => {
    show();
    const attack = document.querySelector('[data-attack]');
    expect(attack, 'the attack control is not on the rail at all').not.toBeNull();
    expect(attack!.textContent).toMatch(/attack/i);
    // A glyph, beside the label rather than instead of it.
    expect(attack!.querySelector('svg')).not.toBeNull();
    // And it is still the one control wearing the irreversible weight.
    expect(attack!.className).toContain('slab-commit');
  });

  it('marks sending a probe with a glyph as well as a word', () => {
    show();
    const probe = screen.getByRole('button', { name: /probe/i });
    expect(probe.querySelector('svg')).not.toBeNull();
    // Not the commit weight: a probe is a spend, not the irreversible bet.
    expect(probe.className).not.toContain('slab-commit');
  });

  /**
   * The glyphs are DECORATIVE and the words carry the label. An icon that
   * announced itself would have a screen reader read "eye, send probe" — and one
   * that replaced the word would leave nothing to read at all.
   */
  it('leaves the words doing the labelling', () => {
    show();
    for (const svg of document.querySelectorAll('[data-attack] svg, button svg')) {
      expect(svg.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('offers a ready Death Star against neutrals, but never through occupation protection', () => {
    const Wrapper = harness();
    const strategic = { ...mine, strategic: {
      id: 'asset-1',
      status: 'READY' as const,
      readyAt: null,
      remainingSeconds: 0,
    } };
    const props = {
      planet: strategic,
      intel,
      reports: [],
      now: NOW,
      onClose: vi.fn(),
      onAttack: vi.fn(),
      onDeathStar: vi.fn(),
      onInstallTelescope: vi.fn(),
      onLaunched: vi.fn(),
      open: true,
      onToggle: vi.fn(),
    };
    const view = render(
      <Wrapper>
        <PlanetFocus
          {...props}
          target={target({
            kind: 'NEUTRAL',
            controller: { kind: 'NEUTRAL', tier: 1 },
            state: { kind: 'NORMAL' },
            neutral: {
              tier: 1,
              threat: 'UNGUARDED',
              reserve: 'RICH',
              claimUntil: new Date(NOW + 20 * 60_000),
              nextReinforcementAt: null,
            },
          })}
        />
      </Wrapper>,
    );
    expect(screen.getByRole('button', { name: /death star/i })).toBeEnabled();
    expect(screen.getByText(/death star clears this claim/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /raid again.*claim unchanged/i })).toBeEnabled();

    view.rerender(
      <Wrapper>
        <PlanetFocus
          {...props}
          target={target({
            kind: 'NEUTRAL',
            controller: { kind: 'NEUTRAL', tier: 1 },
            state: { kind: 'PROTECTED', until: new Date(NOW + 60_000) },
          })}
        />
      </Wrapper>,
    );
    expect(screen.getByRole('button', { name: /death star.*target protected/i })).toBeDisabled();
  });

  it('offers a destructive Death Star strike against an uncapturable capital', () => {
    const Wrapper = harness();
    render(
      <Wrapper>
        <PlanetFocus
          target={target({ kind: 'CAPITAL', state: { kind: 'NORMAL' } })}
          planet={{ ...mine, strategic: {
            id: 'asset-capital',
            status: 'READY',
            readyAt: null,
            remainingSeconds: 0,
          } }}
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
    expect(screen.getByText(/uncapturable capital/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /death star.*devastate/i })).toBeEnabled();
  });

  it('explains that a recovering capital can be struck again but never captured', () => {
    const Wrapper = harness();
    render(
      <Wrapper>
        <PlanetFocus
          target={target({
            kind: 'CAPITAL',
            state: { kind: 'RECOVERY', until: new Date(NOW + 5 * 60_000) },
          })}
          planet={{ ...mine, strategic: {
            id: 'asset-capital-repeat',
            status: 'READY',
            readyAt: null,
            remainingSeconds: 0,
          } }}
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
    expect(screen.getByText(/capital devastated.*uncapturable/i)).toBeInTheDocument();
    expect(screen.getByText(/strike again.*control still cannot change/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /death star.*devastate/i })).toBeEnabled();
  });

  it('disables outbound commitments while the active world is recovering', () => {
    const Wrapper = harness();
    render(
      <Wrapper>
        <PlanetFocus
          target={target()}
          planet={{
            ...mine,
            planet: { ...mine.planet, recoveryUntil: new Date(NOW + 60_000) },
          }}
          intel={intel}
          reports={[]}
          now={NOW}
          onClose={vi.fn()}
          onAttack={vi.fn()}
          onInstallTelescope={vi.fn()}
          onLaunched={vi.fn()}
          open
          onToggle={vi.fn()}
        />
      </Wrapper>,
    );
    expect(screen.getByRole('button', { name: /attack.*origin recovering/i })).toBeDisabled();
  });

  it('keeps the Death Star route visible before a weapon is ready', () => {
    const Wrapper = harness();
    render(
      <Wrapper>
        <PlanetFocus
          target={target({ kind: 'COLONY', state: { kind: 'NORMAL' } })}
          planet={mine}
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
    expect(screen.getByText(/strategic capture route/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /no death star ready/i })).toBeDisabled();
  });

  it('shows the whole neutral claim route and unmet founding cargo at the decision', () => {
    const Wrapper = harness();
    render(
      <Wrapper>
        <PlanetFocus
          target={target({
            kind: 'NEUTRAL',
            controller: { kind: 'NEUTRAL', tier: 1 },
            state: { kind: 'NORMAL' },
            neutral: {
              tier: 1,
              threat: 'UNGUARDED',
              reserve: 'RICH',
              claimUntil: new Date(NOW + 20 * 60_000),
              nextReinforcementAt: null,
            },
          })}
          planet={{ ...mine, colonies: { highestCore: 4, colonies: 0, reservations: 0, capacity: 1 } }}
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
    expect(screen.getByText(/claim window open/i)).toBeInTheDocument();
    expect(screen.getByText(/win raid/i)).toBeInTheDocument();
    expect(screen.getByText(/hauler founds/i)).toBeInTheDocument();
    expect(screen.getByText('2 Haulers')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /settle.*hauler needed/i })).toBeDisabled();
    expect(screen.getByText(/another raid is possible.*does not extend/i)).toBeInTheDocument();
  });

  it('names the first unmet settlement requirement on the disabled action', () => {
    const Wrapper = harness();
    const neutral = target({
      kind: 'NEUTRAL',
      controller: { kind: 'NEUTRAL', tier: 1 },
      state: { kind: 'NORMAL' },
      neutral: {
        tier: 1,
        threat: 'UNGUARDED',
        reserve: 'RICH',
        claimUntil: new Date(NOW + 20 * 60_000),
        nextReinforcementAt: null,
      },
    });
    const props = {
      target: neutral,
      intel,
      reports: [],
      now: NOW,
      onClose: vi.fn(),
      onAttack: vi.fn(),
      onSettle: vi.fn(),
      onInstallTelescope: vi.fn(),
      onLaunched: vi.fn(),
      open: true,
      onToggle: vi.fn(),
    };
    const view = render(
      <Wrapper>
        <PlanetFocus
          {...props}
          planet={{
            ...mine,
            fleet: { ...mine.fleet, HAULER: 1 },
            colonies: { highestCore: 4, colonies: 1, reservations: 0, capacity: 1 },
          }}
        />
      </Wrapper>,
    );
    expect(screen.getByRole('button', { name: /settle.*colony slot full/i })).toBeDisabled();

    view.rerender(
      <Wrapper>
        <PlanetFocus
          {...props}
          planet={{
            ...mine,
            fleet: { ...mine.fleet, HAULER: 1 },
            colonies: { highestCore: 4, colonies: 0, reservations: 0, capacity: 1 },
            flight: { used: 1, total: 1 },
          }}
        />
      </Wrapper>,
    );
    expect(screen.getByRole('button', { name: /settle.*flight bays full/i })).toBeDisabled();
  });

  it('shows founding requirements before the raid, so the claim cannot reveal a surprise cost', () => {
    const Wrapper = harness();
    render(
      <Wrapper>
        <PlanetFocus
          target={target({
            kind: 'NEUTRAL',
            controller: { kind: 'NEUTRAL', tier: 1 },
            state: { kind: 'NORMAL' },
            neutral: {
              tier: 1,
              threat: 'UNGUARDED',
              reserve: 'RICH',
              claimUntil: null,
              nextReinforcementAt: null,
            },
          })}
          planet={{ ...mine, colonies: { highestCore: 4, colonies: 0, reservations: 0, capacity: 1 } }}
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
    expect(screen.getByText(/route to a colony/i)).toBeInTheDocument();
    expect(screen.getByText('2 Haulers')).toBeInTheDocument();
    expect(document.querySelectorAll('img[src*="/resources/"]').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(compact(MULTI_WORLD.settlement.cost.crystal))).toBeInTheDocument();
  });
});
