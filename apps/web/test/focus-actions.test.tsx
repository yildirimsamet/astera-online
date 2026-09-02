import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { DEATH_STAR, GALAXY_SPAN, MULTI_WORLD, distance, missionFuel } from '@astera/rules';
import { duration } from '../src/lib/time.js';
import { resetClock } from '../src/lib/clock.js';
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
  coreLevel: 6,
  intel: 'RESOLVED' as const,
  state: { kind: 'NORMAL' as const },
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
    fleet: { DART: 6 },
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

const show = (over: Partial<IntelView> = {}) => {
  const Wrapper = harness();
  render(
    <Wrapper>
      <PlanetFocus
        target={target()}
        planet={mine}
        intel={{ ...intel, ...over }}
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

  it('shows a current clanmate identity without offering hostile controls', () => {
    const Wrapper = harness();
    render(
      <Wrapper>
        <PlanetFocus
          target={target({
            clanmate: true,
            clan: { id: 'clan-1', name: 'Nova', tag: 'NVA' },
          })}
          planet={{
            ...mine,
            strategic: {
              id: 'asset-1',
              status: 'READY',
              readyAt: null,
              remainingSeconds: 0,
            },
          }}
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

    expect(screen.getByRole('region', { name: '[NVA] Sable — focus' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /attack/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /death star/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rival/i })).not.toBeInTheDocument();
  });

  it('gives a focused owned world its own transfer route instead of a hostile dossier', () => {
    const Wrapper = harness();
    const onTransfer = vi.fn();
    const props = {
      target: target({ isOwned: true, kind: 'COLONY' as const }),
      planet: mine,
      intel,
      reports: [],
      now: NOW,
      onClose: vi.fn(),
      onAttack: vi.fn(),
      onInstallTelescope: vi.fn(),
      onLaunched: vi.fn(),
      open: true,
      onToggle: vi.fn(),
    };
    const view = render(
      <Wrapper>
        <PlanetFocus {...props} onTransfer={onTransfer} />
      </Wrapper>,
    );
    expect(screen.getByText(/your colony/i)).toBeInTheDocument();
    expect(screen.getByText(/world transfer/i)).toBeInTheDocument();
    expect(screen.getByText('Origin')).toBeInTheDocument();
    expect(screen.getByText('Target')).toBeInTheDocument();
    expect(screen.queryByText(/^Known$/i)).toBeNull();

    const prepare = screen.getByRole('button', { name: /choose craft and resources/i });
    expect(prepare).toBeEnabled();
    fireEvent.click(prepare);
    expect(onTransfer).toHaveBeenCalledOnce();

    view.rerender(
      <Wrapper>
        <PlanetFocus {...props} />
      </Wrapper>,
    );
    expect(screen.queryByRole('button', { name: /choose craft and resources/i })).toBeNull();
    expect(screen.getByRole('region', { name: /focus/i })).toBeInTheDocument();
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

  /**
   * D113. The rail said "Damage" then "Control transfers" — the sequence, never
   * the effect — and the capital card said nothing at all. Both now carry the
   * five consequences, and both read their figures from the rules rather than
   * from a sentence somebody typed.
   */
  it('spells out what an impact does on both the colony route and the capital card', () => {
    const Wrapper = harness();
    const props = {
      planet: mine,
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
        <PlanetFocus {...props} target={target({ kind: 'COLONY', state: { kind: 'NORMAL' } })} />
      </Wrapper>,
    );
    expect(screen.getByText(/what this impact does/i)).toBeInTheDocument();
    expect(screen.getByText(/every ship and gun on the ground is destroyed/i)).toBeInTheDocument();
    expect(screen.getByText(/half the resources in storage and the Works are destroyed/i)).toBeInTheDocument();
    expect(screen.getByText(/command core loses a level/i)).toBeInTheDocument();
    expect(screen.getByText(
      new RegExp(`aegis loses ${String(DEATH_STAR.aegisLevelsLost)} levels`, 'i'),
    )).toBeInTheDocument();
    // The window is the recovery, and it is read from the constant.
    expect(screen.getByText(
      new RegExp(`production, collection, construction, new orders and launches stop for ${duration(MULTI_WORLD.recoveryMinutes)}`, 'i'),
    )).toBeInTheDocument();
    expect(screen.getByText(/second impact inside that window takes control/i)).toBeInTheDocument();

    view.rerender(
      <Wrapper>
        <PlanetFocus {...props} target={target({ kind: 'CAPITAL', state: { kind: 'NORMAL' } })} />
      </Wrapper>,
    );
    expect(screen.getByText(/what this impact does/i)).toBeInTheDocument();
    expect(screen.getByText(/half the resources in storage and the Works are destroyed/i)).toBeInTheDocument();
    // A capital gets the opposite closing line, because it can never be taken.
    expect(screen.getByText(/never captured/i)).toBeInTheDocument();
    expect(screen.queryByText(/takes control/i)).toBeNull();
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
    expect(screen.getByText(/^colony race open$/i)).toBeInTheDocument();
    expect(screen.getByText(/win a decisive raid/i)).toBeInTheDocument();
    expect(screen.getByText(/dispatch the colony fleet/i)).toBeInTheDocument();
    expect(screen.getByText('2 Couriers')).toBeInTheDocument();
    expect(document.querySelector('[data-colony-step="3"]')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('button', { name: /found colony.*2 Couriers needed/i })).toBeDisabled();
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
            fleet: { ...mine.fleet, COURIER: 1 },
            colonies: { highestCore: 4, colonies: 1, reservations: 0, capacity: 1 },
          }}
        />
      </Wrapper>,
    );
    expect(screen.getByRole('button', { name: /found colony.*colony slot full/i })).toBeDisabled();

    view.rerender(
      <Wrapper>
        <PlanetFocus
          {...props}
          planet={{
            ...mine,
            fleet: { ...mine.fleet, COURIER: 1 },
            colonies: { highestCore: 4, colonies: 0, reservations: 0, capacity: 1 },
            flight: { used: 1, total: 1 },
          }}
        />
      </Wrapper>,
    );
    expect(screen.getByRole('button', { name: /found colony.*flight bays full/i })).toBeDisabled();
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
    expect(screen.getByRole('button', { name: /^plan an attack$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /colony raid/i })).not.toBeInTheDocument();
    const raidStep = document.querySelector('[data-colony-step="1"]');
    const colonyStep = document.querySelector('[data-colony-step="3"]');
    expect(raidStep).not.toBeNull();
    expect(colonyStep).not.toBeNull();
    expect(raidStep).toHaveAttribute('aria-current', 'step');
    expect(within(raidStep as HTMLElement).getByText('Raid fleet')).toBeInTheDocument();
    expect(raidStep).not.toHaveTextContent('2 Couriers');
    expect(raidStep).not.toHaveTextContent(compact(MULTI_WORLD.settlement.cost.crystal));
    expect(raidStep).not.toHaveTextContent('Flight bay');
    expect(within(colonyStep as HTMLElement).getByRole('button', { name: '2 Couriers' }))
      .toBeInTheDocument();
    expect(within(colonyStep as HTMLElement).getByText(compact(MULTI_WORLD.settlement.cost.crystal)))
      .toBeInTheDocument();
  });

  it('explains a step badge on press and closes the explanation after two seconds', () => {
    vi.useFakeTimers();
    try {
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

      fireEvent.click(screen.getByRole('button', { name: '2 Couriers' }));
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveTextContent(
        /only for step 3.*separate from the raid/i,
      );
      expect(tooltip.parentElement).toBe(document.body);
      expect(tooltip).toHaveClass('fixed');

      act(() => { vi.advanceTimersByTime(1_999); });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      act(() => { vi.advanceTimersByTime(1); });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * D111, ON THE CLIENT. The screen refuses a settlement before the server does,
   * off the same arithmetic, so the two must agree about how far a claim reaches.
   * Both branches of that one condition are asserted here because neither was:
   * every other settlement case in this file sits 200 units away, where the answer
   * is yes whatever the window is.
   */
  const neutralAt = (x: number, claimUntil: Date | null) => target({
    kind: 'NEUTRAL',
    position: { x, y: 0, z: 0 },
    controller: { kind: 'NEUTRAL', tier: 1 },
    state: { kind: 'NORMAL' },
    neutral: {
      tier: 1,
      threat: 'UNGUARDED',
      reserve: 'RICH',
      claimUntil,
      nextReinforcementAt: null,
    },
  });

  /**
   * A world that can found a colony — and, since T6, a tank that can fly the
   * settlers there. `deuterium` is a parameter because it is the one requirement
   * on this panel that a test can be about rather than merely satisfy.
   */
  const settlementRig = (world: GalaxyPlanet, deuterium = 5_000) => {
    const Wrapper = harness();
    return render(
      <Wrapper>
        <PlanetFocus
          target={world}
          planet={{
            ...mine,
            fleet: { ...mine.fleet, COURIER: MULTI_WORLD.settlement.transports },
            planet: { ...mine.planet, alloy: 20_000, crystal: 10_000, deuterium },
            colonies: { highestCore: 4, colonies: 0, reservations: 0, capacity: 1 },
          }}
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
  };

  /** The reach chip specifically — several other rows on this panel say "arrives". */
  const reachChip = () => {
    const chip = [...document.querySelectorAll('button.rounded-chip')]
      .find((el) => /arrives/i.test(el.textContent));
    expect(chip, 'the settlement reach requirement is not rendered at all').toBeDefined();
    return chip!.className;
  };

  it('accepts the widest crossing the disc allows as reachable before a claim opens', () => {
    // The far rim: the longest settlement flight the map can produce. Under the
    // old thirty-minute window this read as unreachable and the route was a lie.
    settlementRig(neutralAt(GALAXY_SPAN, null));
    expect(reachChip()).toContain('opportunity');
    expect(reachChip()).not.toContain('alert');
  });

  it('still refuses a settlement the open window cannot contain', () => {
    // Same distance, but only ten minutes of the window are left.
    settlementRig(neutralAt(GALAXY_SPAN, new Date(NOW + 10 * 60_000)));
    expect(reachChip()).toContain('alert');
    expect(screen.getByRole('button', { name: /found colony.*arrives too late/i })).toBeDisabled();
  });

  /**
   * THE FOUNDING BURNS DEUTERIUM, AND THIS PANEL WAS THE ONE LAUNCH SURFACE THAT
   * NEVER SAID SO. T6 — owner instruction, and the plan's own acceptance line:
   * *the launch screen shows the cost before the commitment*.
   *
   * Every other price of a settlement is on this panel — the colony slot, the
   * flight bay, the two Couriers, the Alloy, the Crystal, the reach — and the
   * server has refused `INSUFFICIENT_FUEL` since fuel landed. So the one control
   * in the game that founds a world offered itself to a commander with an empty
   * tank, took the tap, and answered with a refusal nothing on screen predicted.
   *
   * The raid sheet and the transfer sheet have both drawn this figure for a
   * release. This is the same launch through a third door.
   */
  const CLAIM_OPEN = new Date(NOW + 40 * 60_000);

  it('names the deuterium the settlers burn, beside the ore they carry', () => {
    settlementRig(neutralAt(1_200, CLAIM_OPEN));
    const fuel = missionFuel(
      { COURIER: MULTI_WORLD.settlement.transports },
      distance({ x: 0, y: 0, z: 0 }, { x: 1_200, y: 0, z: 0 }),
      1,
    );
    expect(fuel).toBeGreaterThan(0);

    const chip = [...document.querySelectorAll('button.rounded-chip')]
      .find((el) => el.querySelector('img[src*="deuterium"]'));
    expect(chip, 'the founding never says what it burns').toBeDefined();
    expect(chip).toHaveTextContent(compact(fuel));
  });

  it('refuses the founding a dry tank cannot fly, before the tap', () => {
    settlementRig(neutralAt(1_200, CLAIM_OPEN), 0);
    expect(screen.getByRole('button', { name: /found colony.*deuterium/i })).toBeDisabled();
  });

  it('offers it the moment the tank covers the leg', () => {
    settlementRig(neutralAt(1_200, CLAIM_OPEN), 5_000);
    expect(screen.getByRole('button', { name: /^found colony$/i })).toBeEnabled();
  });
});

/**
 * ONE LOOK PER WORLD PER HOUR, SAID BEFORE THE TAP. D121.
 *
 * The rule is enforced in `launchProbe` under the planet lock, which is the only
 * place it can be. What the control must not do is offer a launch the server has
 * already decided to refuse — a spinner where a decision should be (principle 10),
 * paid for with a round trip and a toast.
 *
 * It reads the SAME instant the guard reads, published by `/api/intel`, and it
 * compares against `serverNow()` rather than the device clock so a phone that has
 * drifted cannot open the control early (D52).
 */
describe('the probe control while a world is still cooling', () => {
  const clock = () => Date.now();

  it('offers the launch when nothing has looked here recently', () => {
    show({ probeCooldowns: [] });
    const probe = screen.getByRole('button', { name: /send a probe/i });
    expect(probe).toBeEnabled();
  });

  it('closes the control and says when it reopens', () => {
    show({
      probeCooldowns: [{ targetPlanetId: 'p2', readyAt: new Date(clock() + 42 * 60_000) }],
    });

    const probe = screen.getByRole('button', { name: /another probe/i });
    expect(probe).toBeDisabled();
    expect(probe.textContent).toContain(duration(42));
    // The cost line is gone with it: nothing is being sold that cannot be bought.
    expect(screen.queryByRole('button', { name: /send a probe/i })).not.toBeInTheDocument();
  });

  /** A window that has already passed is not a window. */
  it('reopens the moment the instant is behind us', () => {
    show({
      probeCooldowns: [{ targetPlanetId: 'p2', readyAt: new Date(clock() - 1000) }],
    });
    expect(screen.getByRole('button', { name: /send a probe/i })).toBeEnabled();
  });

  /** The hour belongs to one world. Another world's window must not close this one. */
  it('ignores a window belonging to a different world', () => {
    show({
      probeCooldowns: [{ targetPlanetId: 'somewhere-else', readyAt: new Date(clock() + 42 * 60_000) }],
    });
    expect(screen.getByRole('button', { name: /send a probe/i })).toBeEnabled();
  });

  /** An older server sends no list at all, and the control must still work. */
  it('offers the launch when the server has never heard of the rule', () => {
    show({ probeCooldowns: [] });
    expect(screen.getByRole('button', { name: /send a probe/i })).toBeEnabled();
  });
});

/**
 * THE PANEL FOR A WORLD NOBODY HAS SURVEYED. D127.
 *
 * Tapping an unsurveyed world opens this panel — the tap asked for it, and a
 * control that does nothing reads as broken — and every header line in it was
 * reading a field the server deliberately OMITS. The schema's defaults dressed
 * each absence as an answer:
 *
 *   · the eyebrow printed "World · " with an empty name,
 *   · the title printed an empty commander,
 *   · `WorldKind` fell through both of its branches and announced NEUTRAL,
 *   · and the Rival control appeared, on exactly the worlds where `isRivalNode`
 *     then refuses to draw the reticle — a button whose effect is invisible.
 *
 * What must SURVIVE is everything computed from the POSITION, which is public in
 * every state: the range, the flight time, and the attack itself. Diving blind is
 * the choice D127 exists to create, and the panel has to let a player make it.
 */
describe('the focus rail on an unsurveyed world', () => {
  const unsurveyed = () =>
    target({
      // Exactly the payload: no name, no owner, no kind, no hardware.
      intel: 'UNKNOWN',
      name: '',
      owner: '',
      coreTier: 1,
      coreLevel: 0,
      kind: undefined,
    });

  const openOn = (over: Partial<GalaxyPlanet>, extra: Record<string, unknown> = {}) => {
    const Wrapper = harness();
    render(
      <Wrapper>
        <PlanetFocus
          target={{ ...unsurveyed(), ...over }}
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
          {...extra}
        />
      </Wrapper>,
    );
  };

  it('never calls it neutral, which is a claim it cannot make', () => {
    openOn({});
    expect(screen.queryByText(/^Neutral$/i)).not.toBeInTheDocument();
  });

  it('says nobody has looked here instead of showing an empty commander', () => {
    openOn({});
    expect(screen.getByText(/nobody has looked here/i)).toBeInTheDocument();
    expect(screen.getByText(/unsurveyed/i)).toBeInTheDocument();
  });

  /** Marking a rival you cannot see would put a reticle nowhere. */
  it('offers no rival control', () => {
    openOn({});
    expect(screen.queryByRole('button', { name: /rival/i })).not.toBeInTheDocument();
  });

  /**
   * AND THE COMMITMENT IS STILL THERE. D127 retired the development band exactly
   * so that this control would never become a refusal arriving after the work.
   */
  it('still offers the attack, because diving blind is the whole point', () => {
    openOn({});
    expect(screen.getByRole('button', { name: /attack/i })).toBeInTheDocument();
  });

  /**
   * A LIVE CLAIM WINDOW SURVIVES THE FOG, SO THE CONTROL HAS TO AS WELL. D112.
   *
   * The server publishes the window on an unsurveyed world on purpose — "a race
   * only the people who already probed the rock can see is not a race" — and the
   * panel then gated the settle control on `kind === 'NEUTRAL'`, a field the same
   * payload omits. The disc drew the claim ring and said "Claim open", and the
   * panel offered no way in.
   */
  it('offers the settlement while the claim window it was sent is open', () => {
    openOn(
      { neutral: { claimUntil: new Date(NOW + 6 * 3_600_000) } },
      { onSettle: vi.fn() },
    );
    /**
     * Every state of this control begins with the word, blocked or ready — see
     * `settleNeed*` — so the assertion is that it is ON SCREEN, not that this
     * particular fixture can afford it.
     */
    expect(screen.getByRole('button', { name: /^Found colony\b/ })).toBeInTheDocument();
    expect(screen.getByText(/first valid 2 Couriers to arrive take it/i)).toBeInTheDocument();
  });

  /** And nothing to enter when there is no race on. */
  it('offers no settlement when no window was sent', () => {
    openOn({}, { onSettle: vi.fn() });
    expect(screen.queryByRole('button', { name: /^Found colony\b/ })).not.toBeInTheDocument();
  });

  /**
   * AND NO STRATEGY GUIDE, which is the same rule one level down.
   *
   * Every branch of `StrategicWorldGuide` is keyed on `target.kind`, so an
   * unsurveyed world fell through to the Death Star route — ending in "the second
   * impact captures it". The world may be a CAPITAL, which is uncapturable and
   * returns from that guide long before the line is reached. A commitment surface
   * may state a rule or say nothing; it may not guess.
   */
  it('promises nothing about what a strike would do to it', () => {
    openOn({});
    expect(screen.queryByText(/second impact/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/colony route/i)).not.toBeInTheDocument();
  });

  it('replaces the duplicate launch with an on-the-way state', () => {
    openOn(
      { neutral: { claimUntil: new Date(NOW + 6 * 3_600_000) } },
      { onSettle: vi.fn(), settlementInFlight: true },
    );
    expect(screen.getByText(/your colony ships are on the way/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Found colony\b/ })).not.toBeInTheDocument();
  });
});

/**
 * A WORLD YOU HAVE ALREADY READ IS STILL A WORLD YOU MAY READ AGAIN. Owner report.
 *
 * The launch control used to live inside the "you have never looked here" gap, so
 * it existed exactly until the first report came home and then never again: the
 * newest report per target is kept for the whole season (`readProbeReports`), the
 * gap disappeared with it, and a world probed six hours ago offered no button at
 * all. The cooldown is the ONLY thing that closes this control — an hour, then it
 * is open again, for a world with a dossier exactly as for one without.
 */
describe('re-probing a world already in the dossier', () => {
  const reported = (over: Partial<IntelView> = {}) => { show({
    probeReports: [{
      targetPlanetId: 'p2',
      targetName: 'Grimhold',
      targetUsername: 'Sable',
      at: new Date(NOW - 6 * 60 * 60_000),
      accuracy: 0.8,
      detected: false,
      stock: { low: 100, high: 200 },
      deuteriumStock: null,
      defence: { low: 20, high: 50 },
      fleetSize: { low: 2, high: 5 },
      fleetHome: true,
    }],
    ...over,
  }); };

  it('still offers the launch six hours after the last look', () => {
    reported();
    expect(screen.getByRole('button', { name: /send a probe/i })).toBeEnabled();
  });

  it('closes it only for the hour the server is actually holding', () => {
    reported({
      probeCooldowns: [{ targetPlanetId: 'p2', readyAt: new Date(Date.now() + 42 * 60_000) }],
    });
    expect(screen.getByRole('button', { name: /another probe/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /send a probe/i })).not.toBeInTheDocument();
  });

  /**
   * ONE CONTROL, ONCE. An unsurveyed world is missing its surface AND its stock,
   * which is two gaps closed by the same launch — and two identical buttons on a
   * phone rail read as two different launches.
   */
  it('offers exactly one launch on a world with nothing known about it at all', () => {
    const Wrapper = harness();
    render(
      <Wrapper>
        <PlanetFocus
          target={target({ intel: 'UNKNOWN' as const })}
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
    expect(screen.getAllByRole('button', { name: /send a probe/i })).toHaveLength(1);
  });
});

/**
 * THE THREE THINGS MOVING THE LAUNCH OUT OF THE GAP ROW HAD TO KEEP. Code review.
 *
 * A control that renders unconditionally answers for itself every question the
 * gap used to answer for it by disappearing.
 */
describe('the standing probe control keeps the rail’s own rules', () => {
  const clanmate = (over: Partial<IntelView> = {}) => {
    const Wrapper = harness();
    render(
      <Wrapper>
        <PlanetFocus
          target={target({ clanmate: true, clan: { id: 'c1', name: 'Nova', tag: 'NVA' } })}
          planet={mine}
          intel={{ ...intel, ...over }}
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

  /**
   * `launchProbe` runs `assertClanHostilityAllowed` like every other hostile
   * flight, so a probe at a clanmate is a 403 the rail can see coming — and this
   * rail already hides the attack, the Death Star and the rival mark for exactly
   * that reason. The gap row used to hide the launch by accident, once a report
   * came home; a control that always renders has to mean it.
   */
  it('never offers a launch a clanmate’s world would refuse', () => {
    clanmate();
    expect(screen.queryByRole('button', { name: /send a probe/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /another probe/i })).not.toBeInTheDocument();
  });

  /** And it stays hidden once there is a dossier, which is the other half. */
  it('keeps it hidden on a clanmate this commander probed before they joined', () => {
    clanmate({
      probeReports: [{
        targetPlanetId: 'p2', targetName: 'Grimhold', targetUsername: 'Sable',
        at: new Date(NOW - 6 * 60 * 60_000), accuracy: 0.8, detected: false,
        stock: { low: 100, high: 200 }, deuteriumStock: null,
        defence: { low: 20, high: 50 }, fleetSize: { low: 2, high: 5 }, fleetHome: true,
      }],
    });
    expect(screen.queryByRole('button', { name: /send a probe/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /another probe/i })).not.toBeInTheDocument();
  });

  /**
   * A GAP WITHOUT A CONTROL MUST NOT RESERVE ROOM FOR ONE. `GapRow` gates its
   * action slot on the PROP, and a React element is truthy even when the
   * component returns null — so every probe gap kept an empty 8px box under it.
   */
  it('leaves no empty control slot under a gap it no longer answers', () => {
    show();
    for (const row of document.querySelectorAll('.border-dashed')) {
      for (const child of row.children) {
        expect(child.textContent, 'an empty control slot under a gap row').not.toBe('');
      }
    }
  });

  /**
   * D52. The window is a SERVER instant, and a phone whose clock runs fast must
   * not open the control early. Offset far enough that the two clocks disagree
   * about which side of the window we are on: device time says the hour is over,
   * the server says twenty minutes are left.
   */
  it('reads the window on the server’s clock, not the phone’s', () => {
    resetClock(-30 * 60_000);
    try {
      show({
        probeCooldowns: [{ targetPlanetId: 'p2', readyAt: new Date(Date.now() - 10 * 60_000) }],
      });
      const cooling = screen.getByRole('button', { name: /another probe/i });
      expect(cooling).toBeDisabled();
      expect(cooling.textContent).toContain(duration(20));
      expect(screen.queryByRole('button', { name: /send a probe/i })).not.toBeInTheDocument();
    } finally {
      resetClock();
    }
  });
});
