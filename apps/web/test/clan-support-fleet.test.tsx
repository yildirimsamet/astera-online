import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { clanSupportWaveSchema, type ClanSupportWave } from '../src/api/schemas.js';
import { FleetPage, type FleetPageProps } from '../src/v2/hud/FleetPage.js';
import { clockTime } from '../src/lib/time.js';

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
  onOpenRepairStation: vi.fn(), onFocusWorld: vi.fn(), onClose: vi.fn(), support,
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

  describe('a wave flying to a world under a clan alarm (F2 corridor)', () => {
    const flying = (raidMinutes: number | null) => wave({ id: 'w3', status: 'OUTBOUND', stationedAt: null, expiresAt: null,
      sentAt: new Date(NOW - 5 * MIN).toISOString(), arriveAt: new Date(NOW + 10 * MIN).toISOString(),
      raidAt: raidMinutes === null ? null : new Date(NOW + raidMinutes * MIN).toISOString() });

    it('writes its landing beside the raid’s, and says it lands in time', () => {
      render(<FleetPage {...props({ waves: [flying(14)], recalling: null, onRecall: vi.fn() })} />);
      const raid = document.querySelector('[data-raid-race]')!;
      expect(raid).toHaveAttribute('data-raid-race', 'in-time');
      expect(raid).toHaveTextContent(clockTime(new Date(NOW + 10 * MIN)));
      expect(raid).toHaveTextContent(clockTime(new Date(NOW + 14 * MIN)));
      expect(raid).toHaveTextContent(/4m 00s before the raid/i);
    });

    it('says plainly when it will be too late', () => {
      render(<FleetPage {...props({ waves: [flying(4)], recalling: null, onRecall: vi.fn() })} />);
      const raid = document.querySelector('[data-raid-race]')!;
      expect(raid).toHaveAttribute('data-raid-race', 'late');
      expect(raid).toHaveTextContent(/6m 00s too late/i);
    });

    it('tells a standing wave when the raid lands on it', () => {
      render(<FleetPage {...props({ waves: [wave({ raidAt: new Date(NOW + 30 * MIN).toISOString() })], recalling: null, onRecall: vi.fn() })} />);
      expect(document.querySelector('[data-raid-race]')).toHaveTextContent(/raid lands in 30m/i);
    });

    it('adds nothing where no raid is called', () => {
      render(<FleetPage {...props({ waves: [flying(null)], recalling: null, onRecall: vi.fn() })} />);
      expect(document.querySelector('[data-raid-race]')).toBeNull();
    });
  });

  it('draws nothing when no wave is out', () => {
    render(<FleetPage {...props({ waves: [], recalling: null, onRecall: vi.fn() })} />);
    expect(screen.queryByRole('region', { name: /clan support/i })).toBeNull();
  });
});
