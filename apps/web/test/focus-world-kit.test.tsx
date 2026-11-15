import type { ReactNode } from 'react';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import type { GalaxyPlanet, IntelView, PlanetView } from '../src/api/schemas.js';
import { PlanetFocus } from '../src/galaxy/FocusPanel.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';

/**
 * G4-b1 (2026-11-15): A FOREIGN WORLD'S COMMITMENTS ON THE KIT. "Attack, probe, settle?"
 * The two presses a commander opens this card for sit side by side as kit presses — the
 * attack the one orange action, the probe steel with its price on its face — under one line
 * of value; the notes above the file (a window open, radiation here) are kit plates.
 */

const V2_LOOK = /(^|\s)(text|bg|border|font)-v2-|rounded-control|rounded-chip|(^|\s)text-(micro|caption|label|body)(\s|$)|v2-legend/;
const oldPaint = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => V2_LOOK.test(name));

const harness = () => {
  const api = new Api({ fetch: () => new Promise<Response>(() => undefined) });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queries}>
      <ApiProvider api={api}><ToastProvider>{children}</ToastProvider></ApiProvider>
    </QueryClientProvider>
  );
};

const world = (over: Partial<GalaxyPlanet> = {}): GalaxyPlanet => ({
  id: 'p2', name: 'Grimhold', owner: 'Sable', position: { x: 200, y: 0, z: 0 }, coreTier: 2, coreLevel: 6,
  intel: 'RESOLVED', state: { kind: 'NORMAL' }, satellites: [], shielded: false, isSelf: false, ...over,
});
const mine: PlanetView = planetView(
  { buildings: { CORE: 4, SHIPYARD: 1 }, instruments: { TELESCOPE: 1, RADAR: 0, AEGIS: 0, VEIL: 0 }, fleet: { DART: 6 } },
  { alloy: 4000, crystal: 2000 },
);
const intel: IntelView = { watching: [], probeReports: [], probeCooldowns: [], radarLog: [], probeCost: { alloy: 25, crystal: 25, deuterium: 0 } };

const show = ({ open, origin = mine, ...over }: { open: boolean; origin?: PlanetView } & Partial<GalaxyPlanet>, extra: { onSendSupport?: () => void } = {}) => {
  const Wrapper = harness();
  render(
    <Wrapper>
      <PlanetFocus target={world(over)} planet={origin} intel={intel} reports={[]} now={0}
        onClose={vi.fn()} onAttack={vi.fn()} onInstallTelescope={vi.fn()} onLaunched={vi.fn()} open={open} onToggle={vi.fn()} {...extra} />
    </Wrapper>,
  );
};
const rail = () => document.querySelector<HTMLElement>('[data-focus-rail]')!;

describe('a foreign world’s commitments on the kit', () => {
  it('closed, sets the attack and the probe side by side as kit presses under one line of value', () => {
    show({ open: false });
    const peek = rail().querySelector('.gk-focus__peek')!;
    expect(oldPaint(peek)).toEqual([]);
    const attack = rail().querySelector<HTMLElement>('[data-attack]')!;
    expect(attack).toHaveClass('gk-btn', 'gk-btn--action');
    expect(attack).toHaveAttribute('data-primary');
    expect(attack).toHaveAttribute('data-own-sound');
    const probe = within(rail()).getByRole('button', { name: /probe/i });
    expect(probe).toHaveClass('gk-btn');
    expect(probe).toHaveAttribute('data-guide', 'probe');
    expect(probe.querySelector('.gk-cost')).not.toBeNull();
    expect(screen.getByTestId('peek-value').querySelector('.gk-label')).not.toBeNull();
  });

  it('open, keeps the strip at the foot on the kit', () => {
    show({ open: true });
    expect(oldPaint(rail().querySelector('.gk-focus__acts')!)).toEqual([]);
  });

  it('a refused attack says why on its own face, still a kit press', () => {
    show({ open: false, state: { kind: 'PROTECTED', until: new Date(6 * 3_600_000) } });
    const attack = rail().querySelector<HTMLElement>('[data-attack]')!;
    expect(attack).toBeDisabled();
    expect(attack).toHaveClass('gk-btn--action');
    expect(attack.textContent).toMatch(/protected|shielded/i);
  });

  it('sends support to a clanmate with a kit press that says when the line is closed', () => {
    show({ open: true, clanmate: true, supportOpen: false, origin: { ...mine, rulesetVersion: 99 } }, { onSendSupport: vi.fn() });
    const send = rail().querySelector<HTMLElement>('[data-send-support]')!;
    expect(send).toHaveClass('gk-btn');
    expect(send).toBeDisabled();
    expect(oldPaint(rail().querySelector('.gk-focus__acts')!)).toEqual([]);
  });
});

/**
 * G4-b2 (2026-11-15): WHAT THE FILE KNOWS AND DOES NOT, ON THE KIT. Each source a kit fold
 * that says how many readings it holds; each reading a row with its age and how sharp it is;
 * each gap the same row, dashed in warning, with the press that would close it.
 */
describe('a foreign world’s readings on the kit', () => {
  const probed: IntelView = {
    ...intel,
    probeReports: [{
      targetPlanetId: 'p2', targetName: 'Grimhold', targetUsername: 'Sable',
      at: new Date(-3 * 60 * 60_000), accuracy: 0.6, detected: false,
      stock: { low: 400, high: 900 }, deuteriumStock: { low: 20, high: 50 },
      defence: { low: 0, high: 0 }, fleetSize: { low: 3, high: 7 }, fleetHome: true,
      classReading: { kind: 'UNREAD' },
    }],
  };
  const showFile = (data: IntelView = intel, extra: Partial<Parameters<typeof PlanetFocus>[0]> = {}) => {
    const Wrapper = harness();
    render(
      <Wrapper>
        <PlanetFocus target={world()} planet={mine} intel={data} reports={[]} now={0}
          onClose={vi.fn()} onAttack={vi.fn()} onInstallTelescope={vi.fn()} onLaunched={vi.fn()} open onToggle={vi.fn()} {...extra} />
      </Wrapper>,
    );
  };

  it('folds each source under a kit press that counts what it holds', () => {
    window.localStorage.setItem('astera.accordion.dossier', JSON.stringify(['public', 'telescope', 'probe', 'battle']));
    showFile(probed);
    const bands = [...document.querySelectorAll('[data-fact-source]')];
    expect(bands.length).toBeGreaterThan(0);
    for (const band of bands) {
      const fold = band.querySelector('[aria-expanded]')!;
      expect(fold).toHaveAttribute('data-own-sound');
      expect(fold).toHaveClass('gk-band--fold');
      expect(oldPaint(band)).toEqual([]);
    }
    expect(document.querySelector('[data-fact]')).toHaveClass('gk-fact');
  });

  it('draws a gap as the same row, its fold a kit press, its close a kit press', () => {
    showFile();
    const gap = document.querySelector<HTMLElement>('[data-gap]')!;
    expect(gap).toHaveClass('gk-fact', 'gk-fact--gap');
    expect(gap.querySelector('button[aria-expanded]')).toHaveAttribute('data-own-sound');
    for (const row of document.querySelectorAll('[data-gap]')) expect(oldPaint(row)).toEqual([]);
  });

  it('tells a marked rival’s story in the kit’s language', () => {
    showFile(probed, { rivalSlot: 0 });
    const history = screen.getByRole('region', { name: 'Your story this season' });
    expect(oldPaint(history)).toEqual([]);
  });
});

/**
 * G4-b3 (2026-11-15): THE ROUTE TO A WORLD, ON THE KIT. A neutral world's three steps (raid,
 * claim, settle) as kit steps, the current one lit; what the settlement needs as the kit's
 * need chips on a 44 px door, each explaining itself on a press.
 */
describe('a world’s route on the kit', () => {
  const neutral = () => {
    const Wrapper = harness();
    render(
      <Wrapper>
        <PlanetFocus
          target={world({ kind: 'NEUTRAL', controller: { kind: 'NEUTRAL', tier: 1 }, neutral: {
            tier: 1, threat: 'UNGUARDED', reserve: 'RICH', claimUntil: null, nextReinforcementAt: null } })}
          planet={{ ...mine, colonies: { capitalCore: 4, colonies: 0, reservations: 0, capacity: 1 } }}
          intel={intel} reports={[]} now={0}
          onClose={vi.fn()} onAttack={vi.fn()} onSettle={vi.fn()} onInstallTelescope={vi.fn()} onLaunched={vi.fn()} open onToggle={vi.fn()}
        />
      </Wrapper>,
    );
  };

  it('draws the guide and its steps with none of the old look', () => {
    neutral();
    const guide = document.querySelector<HTMLElement>('.gk-guide')!;
    expect(guide).not.toBeNull();
    expect(oldPaint(guide)).toEqual([]);
    const step = document.querySelector<HTMLElement>('[data-colony-step="1"]')!;
    expect(step).toHaveClass('gk-step');
    expect(step.querySelector('button[aria-expanded]')).toHaveAttribute('data-own-sound');
  });

  it('makes each requirement a kit need chip on a door that answers its press', () => {
    neutral();
    const door = screen.getByRole('button', { name: '2 Couriers' });
    expect(door).toHaveClass('gk-need-door');
    expect(door).toHaveAttribute('data-own-sound');
    expect(door.querySelector('.gk-need-chip')).not.toBeNull();
  });
});

describe('a world in its claim window', () => {
  it('pairs the probe and the attack in the strip, the attack’s face a short verb and its name the sentence', () => {
    const Wrapper = harness();
    render(
      <Wrapper>
        <PlanetFocus
          target={world({ kind: 'NEUTRAL', owner: '', controller: { kind: 'NEUTRAL', tier: 1 }, neutral: {
            tier: 1, threat: 'UNGUARDED', reserve: 'RICH', nextReinforcementAt: null, claimUntil: new Date(72 * 60_000) } })}
          planet={{ ...mine, colonies: { capitalCore: 4, colonies: 0, reservations: 0, capacity: 1 } }}
          intel={intel} reports={[]} now={0}
          onClose={vi.fn()} onAttack={vi.fn()} onSettle={vi.fn()} onInstallTelescope={vi.fn()} onLaunched={vi.fn()} open onToggle={vi.fn()}
        />
      </Wrapper>,
    );
    const attack = rail().querySelector<HTMLElement>('.gk-focus__acts [data-attack]')!;
    expect(attack.closest('.gk-focus__pair')).not.toBeNull();
    expect(attack).toHaveTextContent(/^Raid again$/);
    expect(attack).toHaveAccessibleName('Raid again · claim unchanged');
  });
});

/**
 * G4-c (2026-11-15): A WORLD OF MINE, ON THE KIT. "Move something there." The eyebrow already
 * says whose and what it is, so the line under the name only says where from; the route, its
 * three figures and the one press that opens the transfer are the kit's.
 */
describe('a world of mine on the kit', () => {
  const ownWorld = (open: boolean) => {
    const Wrapper = harness();
    render(
      <Wrapper>
        <PlanetFocus target={world({ isOwned: true, kind: 'COLONY', name: 'Haven' })} planet={mine} intel={intel} reports={[]} now={0}
          onClose={vi.fn()} onAttack={vi.fn()} onTransfer={vi.fn()} onInstallTelescope={vi.fn()} onLaunched={vi.fn()} open={open} onToggle={vi.fn()} />
      </Wrapper>,
    );
  };

  it('says whose it is once: the eyebrow, never again under the name', () => {
    ownWorld(false);
    expect(rail().querySelector('.gk-focus__summary .gk-focus__kind')).toBeNull();
    expect(rail().querySelector('.gk-focus__summary')).toHaveTextContent(/from/i);
  });

  it('opens on a kit route, kit figures and the kit’s one action', () => {
    ownWorld(true);
    expect(oldPaint(rail().querySelector('.gk-focus__file')!)).toEqual([]);
    expect(rail().querySelectorAll('.gk-figure')).toHaveLength(3);
    const prepare = within(rail()).getByRole('button', { name: /choose craft and resources/i });
    expect(prepare).toHaveClass('gk-btn', 'gk-btn--action');
    expect(prepare).toHaveAttribute('data-primary');
  });

  it('says on the press itself why it is shut while the origin recovers', () => {
    const Wrapper = harness();
    const recovering = { ...mine, planet: { ...mine.planet, recoveryUntil: new Date(60_000) } };
    render(
      <Wrapper>
        <PlanetFocus target={world({ isOwned: true, kind: 'COLONY', name: 'Haven' })} planet={recovering} intel={intel} reports={[]} now={0}
          onClose={vi.fn()} onAttack={vi.fn()} onTransfer={vi.fn()} onInstallTelescope={vi.fn()} onLaunched={vi.fn()} open onToggle={vi.fn()} />
      </Wrapper>,
    );
    const shut = rail().querySelector('[data-primary]')!;
    expect(shut).toBeDisabled();
    expect(shut).toHaveTextContent(/origin world is recovering/i);
  });
});
