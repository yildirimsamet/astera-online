import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MULTI_WORLD, fleetTravelExact } from '@astera/rules';
import { flightModifiers } from '../src/lib/navigation.js';
import { SettlementSheet } from '../src/screens/SettlementSheet.js';
import type { GalaxyPlanet, PlanetView } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';

/**
 * G4-g (2026-11-15): FOUNDING A COLONY ON THE GAME KIT. "Shall I found a colony?" The race
 * leads in a well — its rule, then the line from now to the race's end with where the
 * Couriers land on it (and where my own hour ends) — so the player can see whether they land
 * in time. What leaves reads as the store's own pictures; what each ending brings stands as
 * two lines, the win and the loss. The launch is final: a 1.5 s hold.
 */

const V2_LOOK = /(^|\s)(text|bg|border|font)-v2-|rounded-control|(^|\s)text-(micro|body|caption)(\s|$)/;
const oldPaint = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => V2_LOOK.test(name));

const NOW = Date.UTC(2026, 10, 15, 12);
const target = (over: Partial<GalaxyPlanet> = {}): GalaxyPlanet => ({
  id: 'neutral-1', name: 'Haven', owner: 'Neutral T1', position: { x: 200, y: 0, z: 0 }, coreTier: 1, coreLevel: 2,
  intel: 'RESOLVED', kind: 'NEUTRAL', controller: { kind: 'NEUTRAL', tier: 1 }, state: { kind: 'NORMAL' },
  satellites: [], shielded: false, isSelf: false,
  neutral: { tier: 1, threat: 'UNGUARDED', reserve: 'LOW', claimUntil: new Date(NOW + 40 * 60_000), nextReinforcementAt: null },
  ...over,
});
const rich = planetView({ fleet: { COURIER: 2 } }, { alloy: 10_000, crystal: 10_000, deuterium: 10_000 });

const sheet = (world: GalaxyPlanet = target(), planet: PlanetView = rich) =>
  render(<SettlementSheet target={world} planet={planet} now={NOW} pending={false} onClose={vi.fn()} onConfirm={vi.fn()} />);

describe('founding a colony on the kit', () => {
  it('is a kit sheet in my colour with none of the old look', () => {
    sheet();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('gk-sheet');
    expect(oldPaint(dialog)).toEqual([]);
  });

  it('leads with the race in a well: its rule, then where my Couriers land against its end', () => {
    sheet();
    const race = document.querySelector<HTMLElement>('[data-race]')!;
    expect(race).toHaveClass('gk-well');
    expect(within(race).getByText(/first valid two-Courier fleet/i)).toBeInTheDocument();
    const line = within(race).getByRole('img', { name: /arrives in .* race closes in 40m/i });
    const landing = line.querySelector<HTMLElement>('[data-part="arrival"]')!;
    expect(Number.parseFloat(landing.style.width)).toBeGreaterThan(0);
    expect(Number.parseFloat(landing.style.width)).toBeLessThan(100);
    expect(line.querySelector('[data-part="priority"]')).toBeNull();
    expect(within(race).getByText(/cannot be recalled/i)).toBeInTheDocument();
  });

  it('marks the end of my own hour on the line and lights the well when I land inside it', () => {
    const eta = fleetTravelExact(200, { COURIER: 2 }, { boost: 1, tech: flightModifiers(rich).tech });
    sheet(target({ claimPriorityMine: true,
      neutral: { tier: 1, threat: 'UNGUARDED', reserve: 'LOW', claimUntil: new Date(NOW + 90 * 60_000),
        claimPriorityUntil: new Date(NOW + (eta + 5) * 60_000), nextReinforcementAt: null } }));
    const race = document.querySelector<HTMLElement>('[data-race]')!;
    expect(race).toHaveAttribute('data-tone', 'self');
    expect(race.querySelector('[data-part="priority"]')).not.toBeNull();
  });

  it('warns when my Couriers land after my own hour', () => {
    const eta = fleetTravelExact(200, { COURIER: 2 }, { boost: 1, tech: flightModifiers(rich).tech });
    sheet(target({ claimPriorityMine: true,
      neutral: { tier: 1, threat: 'UNGUARDED', reserve: 'LOW', claimUntil: new Date(NOW + 90 * 60_000),
        claimPriorityUntil: new Date(NOW + (eta / 2) * 60_000), nextReinforcementAt: null } }));
    expect(document.querySelector('[data-race]')).toHaveAttribute('data-tone', 'warn');
  });

  it('shows what leaves as the store’s own pictures, short of the store in warning', () => {
    sheet(target(), planetView({ fleet: { COURIER: 2 } }, { alloy: 10_000, crystal: 100, deuterium: 10_000 }));
    const cost = screen.getByText('Founding cost').closest('.gk-figure')!;
    expect(cost.querySelectorAll('.gk-cost__part img')).toHaveLength(2);
    expect(cost).toHaveTextContent(`${MULTI_WORLD.settlement.charge.alloy.toLocaleString('en-US')} Alloy`);
    expect(cost.querySelectorAll('.gk-cost__part[data-short]')).toHaveLength(1);
  });

  it('states both endings: the win opens on the tier’s stock, the loss returns all but the fuel', () => {
    sheet();
    const win = document.querySelector<HTMLElement>('[data-ending="win"]')!;
    const stock = MULTI_WORLD.neutral[1].captureStock;
    expect(win).toHaveTextContent(`${stock.alloy.toLocaleString('en-US')} Alloy`);
    expect(win.querySelectorAll('.gk-cost__part')).not.toHaveLength(0);
    const loss = document.querySelector<HTMLElement>('[data-ending="loss"]')!;
    expect(loss).toHaveTextContent(/fuel does not/i);
  });

  it('commits on the kit’s final hold', () => {
    sheet();
    const hold = screen.getByRole('button', { name: /^dispatch colony ships/i });
    expect(hold).toHaveAttribute('data-hold');
    expect(hold.style.getPropertyValue('--gk-hold-ms')).toBe('1500ms');
  });
});
