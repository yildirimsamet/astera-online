import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { clanSupportWaveSchema, type ClanSupportWave } from '../src/api/schemas.js';
import { FleetPage, type FleetPageProps } from '../src/v2/hud/FleetPage.js';

/**
 * KLAN SAVUNMA DESTEĞİ — my waves on the Fleet page (P12): where each one is, how long
 * it has, and the one control that brings it home.
 */

const NOW = Date.parse('2026-10-01T12:00:00Z');
const MIN = 60_000;

const wave = (over: Record<string, unknown> = {}): ClanSupportWave => clanSupportWaveSchema.parse({
  id: 'w1', status: 'STATIONED',
  sender: { playerId: 'me', name: 'Me' }, host: { playerId: 'ali', name: 'Ali' },
  originPlanetId: 'home', hostPlanetId: 'vega', hostPlanetName: 'Vega',
  fleet: { PIKE: 12 }, bulk: 24, damaged: false,
  sentAt: new Date(NOW - 40 * MIN).toISOString(), arriveAt: new Date(NOW - 20 * MIN).toISOString(),
  stationedAt: new Date(NOW - 20 * MIN).toISOString(), expiresAt: new Date(NOW + 300 * MIN).toISOString(),
  returnAt: null, returnReason: null, outOfBand: false, battles: 0,
  ...over,
});

const props = (support: FleetPageProps['support']): FleetPageProps => ({
  tab: 'air', onTab: vi.fn(), now: NOW, bays: { used: 1, total: 4 }, hangar: { used: 10, total: 80 },
  flights: [], worlds: [], recalling: null, onFocus: vi.fn(), onRecall: vi.fn(),
  onOpenRepairStation: vi.fn(), onClose: vi.fn(), support,
});

describe('the clan support group on the Fleet page', () => {
  it('says where each wave stands and how long it has left', () => {
    render(<FleetPage {...props({ waves: [wave()], recalling: null, onRecall: vi.fn() })} />);
    const group = screen.getByRole('region', { name: /clan support/i });
    expect(within(group).getByText(/standing at vega/i)).toBeInTheDocument();
    expect(within(group).getByText(/12 Pike/i)).toBeInTheDocument();
    expect(within(group).getByText(/left/i)).toBeInTheDocument();
  });

  it('turns a standing wave home, and a flying one back with the price of turning', async () => {
    const onRecall = vi.fn();
    render(<FleetPage {...props({ waves: [
      wave(),
      wave({ id: 'w2', status: 'OUTBOUND', stationedAt: null, expiresAt: null,
        sentAt: new Date(NOW - 5 * MIN).toISOString(), arriveAt: new Date(NOW + 10 * MIN).toISOString() }),
    ], recalling: null, onRecall })} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /^recall/i }));
    expect(onRecall).toHaveBeenCalledWith('w1');
    expect(screen.getByRole('button', { name: /turn back/i })).toBeInTheDocument();
    expect(screen.getByText(/home in the time it has flown/i)).toBeInTheDocument();
  });

  it('offers no control on a wave already coming home', () => {
    render(<FleetPage {...props({ waves: [wave({ status: 'RETURNING', returnReason: 'EXPIRED',
      returnAt: new Date(NOW + 20 * MIN).toISOString() })], recalling: null, onRecall: vi.fn() })} />);
    expect(screen.getByText(/coming home from vega/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /recall|turn back/i })).toBeNull();
  });

  it('draws nothing when no wave is out', () => {
    render(<FleetPage {...props({ waves: [], recalling: null, onRecall: vi.fn() })} />);
    expect(screen.queryByRole('region', { name: /clan support/i })).toBeNull();
  });
});
