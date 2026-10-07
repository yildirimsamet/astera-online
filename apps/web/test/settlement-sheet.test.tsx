import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MULTI_WORLD, fleetTravelExact } from '@astera/rules';
import { flightModifiers } from '../src/lib/navigation.js';
import { SettlementSheet } from '../src/screens/SettlementSheet.js';
import type { GalaxyPlanet } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';

const target: GalaxyPlanet = {
  id: 'neutral-1',
  name: 'Haven',
  owner: 'Neutral T1',
  position: { x: 200, y: 0, z: 0 },
  coreTier: 1,
  coreLevel: 2,
  intel: 'RESOLVED',
  kind: 'NEUTRAL',
  controller: { kind: 'NEUTRAL', tier: 1 },
  state: { kind: 'NORMAL' },
  satellites: [],
  shielded: false,
  isSelf: false,
  neutral: {
    tier: 1,
    threat: 'UNGUARDED',
    reserve: 'LOW',
    claimUntil: new Date(Date.now() + 40 * 60_000),
    nextReinforcementAt: null,
  },
};

describe('settlement confirmation', () => {
  it('states the race, irreversible spend and destination before dispatch', () => {
    const onConfirm = vi.fn();
    render(
      <SettlementSheet
        target={target}
        planet={planetView({ fleet: { COURIER: 2 } }, {
          alloy: 10_000,
          crystal: 10_000,
          deuterium: 10_000,
        })}
        now={Date.now()}
        pending={false}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText(/first valid two-Courier fleet to arrive takes the world/i)).toBeInTheDocument();
    expect(screen.getByText('Colony ships').closest('div'))
      .toHaveTextContent(String(MULTI_WORLD.settlement.transports));
    // D209: the whole founding charge is spent on success, and the world opens on
    // its tier's own stock — never on the caretaker's stores plus the cargo.
    const cost = screen.getByText('Founding cost').closest('div');
    expect(cost).not.toBeNull();
    expect(within(cost!).getByText(new RegExp(
      `${MULTI_WORLD.settlement.charge.alloy.toLocaleString('en-US')} Alloy`,
    ))).toBeInTheDocument();
    const opens = screen.getByText('Colony opens with').closest('div');
    expect(opens).not.toBeNull();
    const stock = MULTI_WORLD.neutral[1].captureStock;
    expect(opens).toHaveTextContent(new RegExp(`${stock.alloy.toLocaleString('en-US')} Alloy`));
    expect(opens).toHaveTextContent(new RegExp(`${stock.crystal.toLocaleString('en-US')} Crystal`));
    expect(screen.queryByText('Founding cargo')).not.toBeInTheDocument();
    expect(screen.getByText(/founding cost is spent and the world opens on its tier.s stock/i))
      .toBeInTheDocument();

    // A spend that cannot be undone is held, not tapped (K4): a tap alone commits nothing.
    const commit = screen.getByRole('button', { name: /dispatch colony ships/i });
    fireEvent.click(commit);
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.keyDown(commit, { key: 'Enter' });
    fireEvent.keyDown(commit, { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('states no opening stock for a world whose tier has not been read', () => {
    const { neutral, ...rest } = target;
    const unread: GalaxyPlanet = { ...rest, intel: 'UNKNOWN', neutral: { ...neutral!, tier: undefined } };
    render(
      <SettlementSheet
        target={unread}
        planet={planetView({ fleet: { COURIER: 2 } }, { alloy: 10_000, crystal: 10_000, deuterium: 10_000 })}
        now={Date.now()}
        pending={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.queryByText('Colony opens with')).not.toBeInTheDocument();
  });

  /**
   * THE RAIDER'S OWN HOUR CHANGES WHAT THE PRESS DECIDES (owner, 2026-10-07). Inside it
   * nobody can land first, so there is no race to warn about; landing after it, there is.
   */
  it('tells the raider whether their Couriers land inside their own hour', () => {
    const now = Date.now();
    const planet = planetView({ fleet: { COURIER: 2 } }, { alloy: 10_000, crystal: 10_000, deuterium: 10_000 });
    const eta = fleetTravelExact(200, { COURIER: 2 }, { boost: 1, tech: flightModifiers(planet).tech });
    const theirs = (priorityMinutes: number): GalaxyPlanet => ({
      ...target,
      claimPriorityMine: true,
      neutral: { ...target.neutral!, claimPriorityUntil: new Date(now + priorityMinutes * 60_000) },
    });
    const view = render(
      <SettlementSheet target={theirs(eta + 5)} planet={planet} now={now} pending={false}
        onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(screen.getByText(/your priority: your couriers land before it ends — nobody can land ahead of you/i))
      .toBeInTheDocument();
    expect(screen.queryByText(/first valid two-Courier fleet/i)).not.toBeInTheDocument();

    view.rerender(
      <SettlementSheet target={theirs(eta / 2)} planet={planet} now={now} pending={false}
        onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(screen.getByText(/your couriers land after your priority ends/i)).toBeInTheDocument();
  });
});
