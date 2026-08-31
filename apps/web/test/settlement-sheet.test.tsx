import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MULTI_WORLD } from '@astera/rules';
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
        planet={planetView({ fleet: { HAULER: 2 } }, {
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

    expect(screen.getByText(/first valid haulers to arrive take the world/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(String(MULTI_WORLD.settlement.haulers)))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(MULTI_WORLD.settlement.cost.alloy.toLocaleString('en-US'))))
      .toBeInTheDocument();
    expect(screen.getByText(/cannot be recalled/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /dispatch colony ships/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
