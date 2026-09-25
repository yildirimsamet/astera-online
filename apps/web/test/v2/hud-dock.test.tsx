import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationView, PlanetView } from '../../src/api/schemas.js';
import { HudDock } from '../../src/v2/shell/HudDock.js';
import { planetView } from '../fixtures.js';

/**
 * THE DOCK, WIRED. Spec B4 (docs/ui-v2/gozlemevi.md).
 *
 * Base dots for works worth collecting or a fault nobody has paid to repair;
 * Intel counts unseen battle and probe reports; Clan carries the clan's own
 * attention count.
 */

let planet: PlanetView = planetView();
let notifications: NotificationView[] = [];
let clanAttention = 0;
let clanAvailable = true;

vi.mock('../../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../src/api/queries.js');
  return {
    ...actual,
    usePlanet: () => ({ data: planet, dataUpdatedAt: Date.now() }),
    usePending: () => ({ data: { pending: [] } }),
    useMining: () => ({ data: { runs: [] } }),
    useNotifications: () => ({ data: { notifications } }),
    useClanBadge: () => ({ data: { available: clanAvailable, attentionCount: clanAttention, clanChatUnread: 0 } }),
  };
});

const note = (kind: string, seen = false): NotificationView => ({
  id: `${kind}-${String(seen)}`, kind, payload: {}, seen, at: new Date(),
});

beforeEach(() => {
  planet = planetView();
  notifications = [];
  clanAttention = 0;
  clanAvailable = true;
});

describe('the wired dock', () => {
  it('is quiet on a quiet world', () => {
    render(<HudDock active="galaxy" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Base' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Intel' })).toBeInTheDocument();
  });

  /** The works are read and collected on the top bar (owner, 2026-09-25); the Base's dot is for repairs. */
  it('leaves the base undotted for the works', () => {
    planet = planetView({}, { bufferAlloy: 400 });
    render(<HudDock active="galaxy" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Base' })).toBeInTheDocument();
  });

  it('dots the base for a fault nobody has paid to repair, and not for one being repaired', () => {
    const fault = { id: 'f1', kind: 'REFINERY_OUTAGE', startedAt: new Date(), cost: { alloy: 10, crystal: 0, deuterium: 0 } } as const;
    planet = planetView({ faults: [{ ...fault, repair: { slot: 0, readyAt: new Date(Date.now() + 60_000) } }] });
    const { rerender } = render(<HudDock active="galaxy" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Base' })).toBeInTheDocument();
    planet = planetView({ faults: [{ ...fault, repair: null }] });
    rerender(<HudDock active="galaxy" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^Base · / })).toBeInTheDocument();
  });

  it('counts unseen reports on Intel and nothing else from the feed', () => {
    notifications = [note('raid_result'), note('probe_report'), note('probe_report', true), note('fleet_returned')];
    render(<HudDock active="galaxy" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Intel · New reports: 2' })).toBeInTheDocument();
  });

  it('leaves Clan inert in a season with no clan layer', () => {
    clanAvailable = false;
    render(<HudDock active="galaxy" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Clan' })).toBeDisabled();
  });

  it('carries the clan’s attention', () => {
    clanAttention = 3;
    render(<HudDock active="galaxy" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Clan · Waiting for you: 3' })).toBeInTheDocument();
  });
});
