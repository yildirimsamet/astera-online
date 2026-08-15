import { render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useProjectedResources } from '../src/lib/projection.js';
import { describeNotification } from '../src/lib/notifications.js';
import { arrivalOf } from '../src/shell/PendingStrip.js';
import { ReturnOverlay } from '../src/shell/ReturnOverlay.js';
import type { PlanetView, ReturnPayload } from '../src/api/schemas.js';

const planet = (over: Partial<PlanetView['planet']> = {}): PlanetView['planet'] => ({
  id: 'p1',
  name: 'Kestrel-12',
  position: { x: 0, y: 0, z: 0 },
  alloy: 1000,
  crystal: 100,
  alloyCap: 5000,
  crystalCap: 1000,
  alloyPerHour: 600,
  crystalPerHour: 200,
  vaultFloor: 300,
  shield: 0,
  disruptedUntil: null,
  ...over,
});

describe('the resource ticker', () => {
  it('accrues between fetches so the world visibly runs', () => {
    const fetchedAt = Date.now() - 30 * 60_000; // half an hour ago
    const { result } = renderHook(() => useProjectedResources(planet(), fetchedAt));
    expect(result.current.alloy).toBeCloseTo(1300, 0);
  });

  it('never predicts past the storage ceiling', () => {
    const fetchedAt = Date.now() - 100 * 60 * 60_000;
    const { result } = renderHook(() => useProjectedResources(planet(), fetchedAt));
    expect(result.current.alloy).toBe(5000);
  });

  /**
   * Disruption is the point of raiding: it takes production *time*, not just
   * stock. A ticker that kept counting through it would tell the victim they
   * were fine.
   */
  it('stops accruing while the surface works are offline', () => {
    const fetchedAt = Date.now() - 30 * 60_000;
    const disruptedUntil = new Date(Date.now() + 60 * 60_000);
    const { result } = renderHook(() =>
      useProjectedResources(planet({ disruptedUntil }), fetchedAt),
    );
    expect(result.current.alloy).toBe(1000);
  });

  it('resumes for the part of the gap that was productive', () => {
    const fetchedAt = Date.now() - 60 * 60_000;
    // Disruption ended half an hour ago, so only half the hour produced.
    const disruptedUntil = new Date(Date.now() - 30 * 60_000);
    const { result } = renderHook(() =>
      useProjectedResources(planet({ disruptedUntil }), fetchedAt),
    );
    expect(result.current.alloy).toBeCloseTo(1300, 0);
  });
});

/**
 * A countdown anchored to `now` never moves, because both sides advance
 * together. This is a regression guard: the strip must be anchored to the
 * moment the server answered.
 */
describe('the in-flight countdown', () => {
  it('is anchored to when the server answered, not to now', () => {
    const answeredAt = 1_000_000;
    const thread = { kind: 'fleet' as const, targetName: 'Grimhold', minutesRemaining: 10 };

    const arrival = arrivalOf(thread, answeredAt);
    expect(arrival - answeredAt).toBe(600_000);
    // Thirty seconds later the same thread reads thirty seconds closer.
    expect(arrival - (answeredAt + 30_000)).toBe(570_000);
  });
});

describe('the return overlay', () => {
  const payload = (over: Partial<ReturnPayload> = {}): ReturnPayload => ({
    awayMinutes: 186,
    entries: [],
    pending: [],
    newUnlocks: [],
    ...over,
  });

  it('answers "what happened?" before anything else on the screen', () => {
    render(
      <ReturnOverlay
        arrival={payload({
          entries: [
            {
              kind: 'raid_result',
              title: 'DECISIVE',
              detail: '+8,400 looted · 1 ship lost',
              at: new Date(),
            },
          ],
        })}
        playerName="Kestrel-12"
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText(/while you were gone/i)).toBeInTheDocument();
    expect(screen.getByText('3h 06m')).toBeInTheDocument();
    expect(screen.getByText('DECISIVE')).toBeInTheDocument();
  });

  /** DESIGN LAW #1: the return re-opens the loop, it does not close it. */
  it('ends on what is still in flight', () => {
    render(
      <ReturnOverlay
        arrival={payload({
          pending: [
            { kind: 'fleet', targetName: 'Grimhold', minutesRemaining: 24, leg: 'return' },
          ],
        })}
        playerName="Kestrel-12"
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText(/still in flight/i)).toBeInTheDocument();
    expect(screen.getByText(/returning from Grimhold/i)).toBeInTheDocument();
  });

  it('says plainly when nothing is pending, because that is the prompt', () => {
    render(<ReturnOverlay arrival={payload()} playerName="Kestrel-12" onDismiss={vi.fn()} />);
    expect(screen.getByText(/nothing is in flight/i)).toBeInTheDocument();
  });
});

describe('notification copy', () => {
  const base = { id: 'n1', seen: false, at: new Date() };

  it('leads with the ETA, which is the whole reason the message exists', () => {
    expect(
      describeNotification({ ...base, kind: 'incoming_fleet', payload: { etaMinutes: 9 } }),
    ).toBe('Incoming fleet · ETA 9 min');
  });

  it('adds a size estimate only when radar paid for one', () => {
    expect(
      describeNotification({
        ...base,
        kind: 'incoming_fleet',
        payload: { etaMinutes: 9, estimatedShips: 74 },
      }),
    ).toContain('est. 74 ships');
  });

  it('distinguishes a repelled raid from a successful one', () => {
    expect(
      describeNotification({
        ...base,
        kind: 'raided',
        payload: { grade: 'REPELLED', lootAlloy: 0, lootCrystal: 0, unitsLost: 4 },
      }),
    ).toBe('You repelled a raid.');
  });

  it('degrades to a plain sentence rather than throwing on a payload it cannot read', () => {
    expect(describeNotification({ ...base, kind: 'fleet_returned', payload: null })).toBe(
      'Your fleet is home.',
    );
    expect(describeNotification({ ...base, kind: 'incoming_fleet', payload: 'nonsense' })).toBe(
      'Incoming fleet.',
    );
  });
});
