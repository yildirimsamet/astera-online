import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AsteroidView, MiningRun, PendingThread } from '../src/api/schemas.js';
import { ContactFocus, RunFocus, ThreadFocus } from '../src/galaxy/FocusPanel.js';
import { countdown, duration, minutesLeft } from '../src/lib/time.js';

/**
 * ONE CRAFT, ONE CLOCK.
 *
 * Every payload that carries a flight carries the instant it lands AND a
 * `minutesRemaining` the server rounded when it answered. The focus rail read the
 * rounded one while the pending strip beneath it counted the exact one down in
 * seconds, so the same fleet was shown two different times, stacked, and only one
 * of them moved. `minutesLeft` is the single derivation both now use.
 */
describe('a flight in the interface', () => {
  const arriveAt = new Date(Date.now() + 11 * 60_000 + 10_000);

  const thread = (over: Partial<PendingThread> = {}): PendingThread => ({
    kind: 'fleet',
    targetName: 'Tharsis',
    // Deliberately stale: what a payload answered nearly a minute ago said.
    minutesRemaining: 12,
    arriveAt,
    leg: 'outbound',
    fleet: { DART: 8 },
    ...over,
  });

  it('agrees with the strip that counts the same craft down with seconds', () => {
    const now = Date.now();
    const expectedCountdown = countdown(arriveAt.getTime() - now);
    render(
      <ThreadFocus
        thread={thread()}
        minutesRemaining={minutesLeft(arriveAt, now)}
        open
        onToggle={() => undefined}
        onClose={() => undefined}
      />,
    );
    // The summary rail uses countdown() with minutes and seconds
    expect(screen.getByText(expectedCountdown)).toBeInTheDocument();
    // Body figure still shows duration
    expect(screen.getAllByText('11m').length).toBeGreaterThan(0);
    // And never the figure the server rounded a poll ago
    expect(screen.queryByText('12m')).not.toBeInTheDocument();
  });

  it('does not round a stale payload figure into the rail', () => {
    expect(duration(minutesLeft(arriveAt, Date.now()))).toBe('11m');
  });
});

/**
 * A SALVAGE RUN IS NOT A MINING RUN. D32.
 *
 * The two share the table, the launch path and the flight rendering; they do not
 * share a target. A harvest carries no `asteroidId`, so the rock lookup that
 * feeds this panel could only ever miss — and the panel renders a miss as "Rock
 * has passed". A player who had just sent Prospectors at a wreck field was told
 * their target was gone.
 */
describe('a run of your own', () => {
  const run = (over: Partial<MiningRun> = {}): MiningRun => ({
    id: 'r1',
    targetKind: 'asteroid',
    asteroidId: 'mJt7YvxMZEC5S7yYQ32SYw',
    debrisFieldId: null,
    status: 'outbound',
    craft: 3,
    departAt: new Date(Date.now() - 60_000),
    arriveAt: new Date(Date.now() + 9 * 60_000),
    homeAt: null,
    intercept: { x: 100, y: 0, z: 0 },
    minedAlloy: 0,
    minedCrystal: 0,
    minedDeuterium: 0,
    ...over,
  });

  const rock: AsteroidView = {
    id: 'mJt7YvxMZEC5S7yYQ32SYw', level: 3, ore: 1_000, oreRemaining: 900,
    crystalShare: 0.3, radius: 1_000, period: 10, phase: 0, inclination: 0,
    ascendingNode: 0, speed: 500, appearsAt: 0, expiresAt: 100, active: true,
    isotopeRich: false, deuteriumShare: null,
  };

  const show = (r: MiningRun, wreck?: { planetName: string | undefined; minutesLeft: number }) =>
    render(
      <RunFocus
        run={r}
        rock={r.asteroidId === null ? undefined : rock}
        wreck={wreck}
        minutesRemaining={9}
        open
        onToggle={() => undefined}
        onClose={() => undefined}
      />,
    );

  it('names the rock on a mining run and shows countdown with seconds in summary', () => {
    const r = run();
    show(r);
    expect(screen.getByText(/level 3 rock/i)).toBeInTheDocument();
    expect(screen.getByText(/meets the rock in/i)).toBeInTheDocument();
    const expected = countdown(r.arriveAt.getTime() - Date.now());
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('never tells a salvage run that its rock has passed', () => {
    show(run({ targetKind: 'debris', asteroidId: null, debrisFieldId: 'd1' }), {
      planetName: 'Grimhold',
      minutesLeft: 96,
    });
    expect(screen.queryByText(/rock/i)).not.toBeInTheDocument();
    expect(screen.getByText(/wreckage over grimhold/i)).toBeInTheDocument();
  });

  it('says a field has decayed rather than that a rock has passed', () => {
    show(run({ targetKind: 'debris', asteroidId: null, debrisFieldId: 'd1' }), undefined);
    expect(screen.getByText(/field has decayed/i)).toBeInTheDocument();
    expect(screen.queryByText(/rock has passed/i)).not.toBeInTheDocument();
  });

  it('comes home empty from a picked-over field, not from a stripped rock', () => {
    show(
      run({
        targetKind: 'debris',
        asteroidId: null,
        debrisFieldId: 'd1',
        status: 'returning',
        homeAt: new Date(Date.now() + 5 * 60_000),
      }),
      { planetName: 'Grimhold', minutesLeft: 40 },
    );
    expect(screen.getByText(/field already picked over/i)).toBeInTheDocument();
  });
});

/** And somebody else's salvage run reads as one too — the server sends `harvest`. */
describe("somebody else's salvage run", () => {
  it('is described as salvage, with the public clock a field carries', () => {
    render(
      <ContactFocus
        contact={{
          id: 'c1',
          kind: 'harvest',
          from: { x: 0, y: 0, z: 0 },
          to: { x: 100, y: 0, z: 0 },
          startAt: new Date(),
          endAt: new Date(Date.now() + 60_000),
          craft: 4,
          minutesRemaining: 7,
        }}
        open
        onToggle={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByText(/somebody is salvaging/i)).toBeInTheDocument();
    expect(screen.getAllByText(/salvage run/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/the field, the route and the clock/i)).toBeInTheDocument();
    expect(screen.getAllByText('7m').length).toBeGreaterThan(0);
    expect(screen.queryByText(/arrival unknown/i)).not.toBeInTheDocument();
  });
});
