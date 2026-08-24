import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMBAT, engagementEndsAt } from '@astera/rules';
import { useContactWindows, useFleetArrivals, useMiningArrivals } from '../src/api/queries.js';
import type { Contact, MiningRun, PendingThread } from '../src/api/schemas.js';

/**
 * WAKE UP WHEN SOMETHING LANDS. D48.
 *
 * Every leg in the galaxy is drawn by an interpolation that CLAMPS at its own end,
 * so a craft whose payload has not caught up is not missing from the disc — it is
 * PARKED on its destination. That is what a stale poll actually looks like: a
 * squadron hanging motionless over a world it has finished fighting, and a drill
 * sitting at a point in empty space while the rock it was sent to sails past.
 *
 * Both were reported as bugs in the flight logic. Neither was: the geometry was
 * right and the payload was thirty to sixty seconds old. The instant that matters
 * is KNOWN — it is in the payload — so the client waits for it instead of polling
 * past it.
 *
 * These hold the property that fixes: an arrival invalidates on its own schedule,
 * and nothing fires early.
 */

const at = (ms: number): Date => new Date(ms);

function Harness({
  runs,
  pending,
  contacts,
}: {
  runs?: MiningRun[];
  pending?: PendingThread[];
  contacts?: Contact[];
}) {
  useMiningArrivals(runs);
  useFleetArrivals(pending);
  useContactWindows(contacts);
  return null;
}

describe('a client waiting for an arrival', () => {
  let client: QueryClient;
  let invalidated: string[][];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-01T12:00:00.000Z'));
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    invalidated = [];
    vi.spyOn(client, 'invalidateQueries').mockImplementation((filters?: unknown) => {
      const key = (filters as { queryKey?: string[] } | undefined)?.queryKey;
      if (key) invalidated.push(key);
      return Promise.resolve();
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const mount = (props: { runs?: MiningRun[]; pending?: PendingThread[]; contacts?: Contact[] }) =>
    render(
      <QueryClientProvider client={client}>
        <Harness {...props} />
      </QueryClientProvider>,
    );

  const run = (over: Partial<MiningRun> = {}): MiningRun => ({
    id: 'r1',
    targetKind: 'asteroid',
    asteroidIndex: 3,
    debrisFieldId: null,
    craft: 2,
    status: 'outbound',
    departAt: at(Date.now()),
    arriveAt: at(Date.now() + 120_000),
    homeAt: null,
    intercept: { x: 100, y: 0, z: 0 },
    minedAlloy: 0,
    minedCrystal: 0,
    minedDeuterium: 0,
    ...over,
  });

  const thread = (over: Partial<PendingThread> = {}): PendingThread => ({
    kind: 'fleet',
    targetName: 'Tharsis',
    minutesRemaining: 2,
    arriveAt: at(Date.now() + 120_000),
    leg: 'outbound',
    fleet: { WASP: 10 },
    path: {
      from: { x: 0, y: 0, z: 0 },
      to: { x: 600, y: 0, z: 0 },
      departAt: at(Date.now()),
      arriveAt: at(Date.now() + 120_000),
    },
    ...over,
  });

  /* ── mining ─────────────────────────────────────────────────── */

  it('does not refetch before the drill is due', () => {
    mount({ runs: [run()] });
    vi.advanceTimersByTime(119_000);
    expect(invalidated).toHaveLength(0);
  });

  /**
   * THE MOMENT THE ROCK IS REACHED, and the reason the drill looked broken: the
   * outbound leg is finished, the rock has moved on, and until the payload turns
   * the run to `returning` the craft is drawn standing at an empty point.
   */
  it('refetches the moment a drill reaches its rock', () => {
    mount({ runs: [run()] });
    vi.advanceTimersByTime(122_000);
    expect(invalidated.map((k) => k[0])).toContain('mining');
  });

  /** And again when it lands, which is when the ore actually arrives. */
  it('refetches when a returning drill gets home', () => {
    mount({
      runs: [run({ status: 'returning', homeAt: at(Date.now() + 60_000) })],
    });
    vi.advanceTimersByTime(62_000);
    expect(invalidated.map((k) => k[0])).toContain('mining');
  });

  /** A run already home has nothing left to wait for and must arm nothing. */
  it('arms nothing for a run that is already done', () => {
    mount({ runs: [run({ status: 'done', homeAt: at(Date.now() - 60_000) })] });
    vi.advanceTimersByTime(600_000);
    expect(invalidated).toHaveLength(0);
  });

  /* ── fleets ─────────────────────────────────────────────────── */

  /**
   * A RAID HAS TWO INTERESTING INSTANTS, NOT ONE. D44 gives the fleet ten seconds
   * over its target before anything is decided, so the arrival starts the
   * bombardment and the END of the engagement is when the squadron should be gone
   * or turning for home. Waking only on the arrival leaves it hanging there.
   */
  it('wakes on the arrival and again when the battle is settled', () => {
    mount({ pending: [thread()] });

    vi.advanceTimersByTime(122_000);
    expect(invalidated.map((k) => k[0])).toContain('pending');
    const afterArrival = invalidated.length;

    // Nothing more until the engagement closes.
    vi.advanceTimersByTime(COMBAT.engagementSeconds * 1000 - 3000);
    expect(invalidated).toHaveLength(afterArrival);

    vi.advanceTimersByTime(4000);
    expect(invalidated.length).toBeGreaterThan(afterArrival);
  });

  /** The second instant is exactly the rules' engagement window, not a guess. */
  it('takes the settling instant from the rules rather than a local constant', () => {
    const arriveAt = Date.now() + 120_000;
    expect(engagementEndsAt(arriveAt) - arriveAt).toBe(COMBAT.engagementSeconds * 1000);
  });

  /**
   * A LEG COMING HOME LANDS; it does not fight. One instant, not two — arming a
   * second would refetch for nothing every time a fleet returned.
   */
  it('arms only the landing for a fleet on its way home', () => {
    mount({ pending: [thread({ leg: 'return' })] });
    vi.advanceTimersByTime(122_000);
    expect(invalidated.map((k) => k[0])).toContain('pending');
    const landed = invalidated.length;
    vi.advanceTimersByTime(60_000);
    expect(invalidated).toHaveLength(landed);
  });

  /** An inbound raid you can see is still an arrival worth waking for. */
  it('wakes for an inbound attack too', () => {
    mount({
      pending: [
        { kind: 'incoming', targetName: 'inbound fleet', minutesRemaining: 2, arriveAt: at(Date.now() + 120_000) },
      ],
    });
    vi.advanceTimersByTime(122_000);
    expect(invalidated.map((k) => k[0])).toContain('pending');
  });

  /**
   * A TIMER PAST `setTimeout`'s RANGE FIRES IMMEDIATELY, which would refetch in a
   * loop for a flight days out. Anything that far away is caught by the ordinary
   * poll long before it matters.
   */
  it('ignores an arrival further out than a timer can hold', () => {
    mount({ runs: [run({ arriveAt: at(Date.now() + 40 * 24 * 3600_000) })] });
    vi.advanceTimersByTime(5000);
    expect(invalidated).toHaveLength(0);
  });

  it('arms nothing at all when nothing is in the air', () => {
    mount({ runs: [], pending: [] });
    vi.advanceTimersByTime(600_000);
    expect(invalidated).toHaveLength(0);
  });

  /* ── somebody else's bearing window ───────────────────────── */

  const contact = (endAt: Date): Contact => ({
    id: 'c1',
    kind: 'fleet',
    from: { x: 0, y: 0, z: 0 },
    to: { x: 40, y: 0, z: 0 },
    startAt: at(Date.now()),
    endAt,
  });

  /**
   * A STRANGER'S WINDOW EXPIRING IS NOT AN ARRIVAL, AND MUST NOT COST WHAT ONE IS.
   *
   * The client interpolates a contact inside its published window and has to ask
   * for the next one when it runs out. That wake used to sit in the same list as
   * real arrivals, which refetch nine payloads — the planet, the galaxy, the
   * reports, the notifications. Not one of them can have moved because somebody
   * else's bearing window expired, and in a busy galaxy one expires every few
   * seconds, so the most expensive read in the game was being pulled on a schedule
   * set entirely by other people's traffic.
   */
  it('asks for the next window when the current one runs out', () => {
    mount({ contacts: [contact(at(Date.now() + 60_000))] });
    vi.advanceTimersByTime(59_000);
    expect(invalidated).toHaveLength(0);

    vi.advanceTimersByTime(2_000);
    expect(invalidated.map((k) => k[0])).toEqual(['traffic']);
  });

  it('reads nothing but traffic, however many contacts are in the air', () => {
    mount({
      contacts: [0, 1, 2].map((i) => ({
        ...contact(at(Date.now() + 20_000 * (i + 1))),
        id: `c${String(i)}`,
      })),
    });
    vi.advanceTimersByTime(120_000);

    expect(invalidated.length).toBeGreaterThan(0);
    expect([...new Set(invalidated.map((k) => k[0]))]).toEqual(['traffic']);
  });

  /**
   * RE-ARMING ON EVERY REFETCH WOULD RESTART THE CLOCK AND NEVER FIRE.
   *
   * The list is refetched every thirty seconds and comes back as a new array of
   * new objects every time. If the timer re-armed on identity rather than on the
   * INSTANTS, a two-minute flight would have its wake-up pushed back by thirty
   * seconds, four times, and arrive without ever waking anything — the exact
   * failure this hook exists to prevent, reintroduced by a dependency array.
   */
  it('does not re-arm when the same list arrives again in a new array', () => {
    const due = at(Date.now() + 120_000);
    const view = mount({ runs: [run({ arriveAt: due })] });
    vi.advanceTimersByTime(60_000);
    view.rerender(
      <QueryClientProvider client={client}>
        <Harness runs={[run({ arriveAt: due })]} />
      </QueryClientProvider>,
    );
    vi.advanceTimersByTime(62_000);
    expect(invalidated.map((k) => k[0])).toContain('mining');
  });
});
