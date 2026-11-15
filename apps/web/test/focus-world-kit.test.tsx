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
