import { render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useProjected } from '../src/lib/projection.js';
import { describeNotification, isAlarming, isUrgent } from '../src/lib/notifications.js';
import { arrivalOf } from '../src/shell/PendingStrip.js';
import { LoadingScreen } from '../src/shell/LoadingScreen.js';
import { Bays } from '../src/shell/StatusBar.js';
import type { PlanetView } from '../src/api/schemas.js';

const planet = (over: Partial<PlanetView['planet']> = {}): PlanetView['planet'] => ({
  id: 'p1',
  name: 'Kestrel-12',
  position: { x: 0, y: 0, z: 0 },
  alloy: 1000,
  crystal: 100,
  deuterium: 0,
  alloyCap: 5000,
  crystalCap: 1000,
  deuteriumCap: 500,
  alloyPerHour: 600,
  crystalPerHour: 200,
  bufferAlloy: 0,
  bufferCrystal: 0,
  bufferDeuterium: 0,
  bufferAlloyCap: 3200,
  bufferCrystalCap: 640,
  bufferDeuteriumCap: 320,
  vaultFloor: 300,
  vaultProtected: { alloy: 250, crystal: 50, deuterium: 0 },
  vaultCapacity: { alloy: 250, crystal: 50, deuterium: 0 },
  shield: 0,
  shieldMax: 0,
  shieldPerHour: 0,
  disruptedUntil: null,
  ...over,
});

/**
 * THE TICKER FILLS THE WORKS, NOT STORAGE.
 *
 * These assertions used to say the opposite — that `alloy` climbed by
 * `rate × hours` between fetches — and they passed, because the projection did
 * exactly that. Both were written before D16 and neither was updated when
 * production stopped landing in storage.
 *
 * D16 is the source of truth and the code was wrong, so the tests move: storage
 * must NOT creep on its own (a player who is not collecting is not gaining, which
 * is the whole point of a manual collector), and the works must fill and then stop
 * at the collector's ceiling.
 */
describe('the resource ticker', () => {
  it('fills the works between fetches, so the world visibly runs', () => {
    const fetchedAt = Date.now() - 30 * 60_000; // half an hour ago
    const { result } = renderHook(() => useProjected(planet(), fetchedAt));
    expect(result.current.bufferAlloy).toBeCloseTo(300, 0);
  });

  /**
   * The manual collector's entire argument. If the projection let storage drift
   * upward, the interface would be quietly teaching that ore arrives on its own —
   * exactly the belief D16 exists to break.
   */
  it('never moves storage on its own', () => {
    const fetchedAt = Date.now() - 30 * 60_000;
    const { result } = renderHook(() => useProjected(planet(), fetchedAt));
    expect(result.current.alloy).toBe(1000);
    expect(result.current.crystal).toBe(100);
  });

  it('never predicts past the collector ceiling, because production stops there', () => {
    const fetchedAt = Date.now() - 100 * 60 * 60_000;
    const { result } = renderHook(() => useProjected(planet(), fetchedAt));
    expect(result.current.bufferAlloy).toBe(3200);
    expect(result.current.bufferCrystal).toBe(640);
  });

  /**
   * Disruption is the point of raiding: it takes production *time*, not just
   * stock. A ticker that kept counting through it would tell the victim they
   * were fine.
   */
  it('stops accruing while the surface works are offline', () => {
    const fetchedAt = Date.now() - 30 * 60_000;
    const disruptedUntil = new Date(Date.now() + 60 * 60_000);
    const { result } = renderHook(() => useProjected(planet({ disruptedUntil }), fetchedAt));
    expect(result.current.bufferAlloy).toBe(0);
  });

  it('resumes for the part of the gap that was productive', () => {
    const fetchedAt = Date.now() - 60 * 60_000;
    // Disruption ended half an hour ago, so only half the hour produced.
    const disruptedUntil = new Date(Date.now() - 30 * 60_000);
    const { result } = renderHook(() => useProjected(planet({ disruptedUntil }), fetchedAt));
    expect(result.current.bufferAlloy).toBeCloseTo(300, 0);
  });
});

/**
 * THE COUNTDOWN IS AN ABSOLUTE INSTANT, and it has to be for two separate reasons.
 *
 * The original guard here was that it must not be anchored to `now` — a countdown
 * rebuilt against the current moment never moves, because both sides advance
 * together. That was fixed by anchoring to when the server answered, which held the
 * countdown still no longer but introduced a subtler fault:
 *
 * `minutesRemaining` is ROUNDED. Reconstructing the arrival from it is accurate to
 * within half a minute and no better — and a player's own strip could read the
 * exact `arriveAt` off the thread's path while a DEFENDER's inbound thread, which
 * deliberately carries no path, could not. So the attacker and the defender counted
 * down to instants up to thirty seconds apart, on the same fleet. The server now
 * publishes `arriveAt` on every thread and this reads it directly.
 */
describe('the in-flight countdown', () => {
  const arriveAt = new Date(2_000_000);
  const thread = {
    kind: 'fleet' as const,
    targetName: 'Grimhold',
    minutesRemaining: 10,
    arriveAt,
  };

  it('is the instant the server named, whatever the client asks when', () => {
    expect(arrivalOf(thread)).toBe(arriveAt.getTime());
  });

  it('still moves — thirty seconds later it reads thirty seconds closer', () => {
    expect(arrivalOf(thread) - 1_000_000).toBe(1_000_000);
    expect(arrivalOf(thread) - 1_030_000).toBe(970_000);
  });

  /**
   * THE BUG THAT PROMPTED THIS, stated as an assertion.
   *
   * Both sides of one mission are the same row in the database, so both threads
   * carry the same `arriveAt` — and reading the instant rather than rebuilding it
   * from a rounded minute is what makes the two agree to the second.
   */
  it('reads the same instant for the attacker and the defender', () => {
    const attacker = { ...thread, minutesRemaining: 3 };
    // The defender's rounded minute differs, because it is rounded from a slightly
    // later moment. The instant does not.
    const defender = {
      kind: 'incoming' as const,
      targetName: 'inbound fleet',
      minutesRemaining: 2,
      arriveAt,
    };
    expect(arrivalOf(attacker)).toBe(arrivalOf(defender));
  });
});

/**
 * THE RETURN OVERLAY IS GONE, AND THIS IS WHAT REPLACED IT. D23.
 *
 * "While you were gone" was a modal on the way in. On a phone it fired every time
 * a backgrounded tab was evicted and remounted — which is most of the time — so
 * the screen that was meant to answer *what happened?* became a door to close.
 *
 * These hold the shape of the replacement rather than the old component: the wait
 * is now the only thing between a player and the disc, it says what is actually
 * being waited on, and it never invents a number.
 */
describe('the loading screen', () => {
  it('states what is being waited on rather than spinning silently', () => {
    render(<LoadingScreen caption="Making contact" />);
    expect(screen.getByText(/making contact/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  /**
   * The load bar has to be real or it should not be a bar. A fabricated
   * percentage is the one thing a progress indicator can do that is worse than
   * not existing.
   */
  it('shows a measured fraction when the wait is measurable', () => {
    render(<LoadingScreen caption="Bringing the sky up" progress={0.42} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('claims no number at all when the wait cannot be measured', () => {
    render(<LoadingScreen caption="Making contact" />);
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('never reports past the end, whatever it is handed', () => {
    render(<LoadingScreen caption="Making contact" progress={4} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });
});

describe('notification copy', () => {
  const NOW = new Date('2026-08-19T12:00:00Z').getTime();
  const base = { id: 'n1', seen: false, at: new Date(NOW) };
  const say = (kind: string, payload: unknown, now = NOW): string | null =>
    describeNotification({ ...base, kind, payload }, now);

  /**
   * A FLIGHT THE SERVER GAVE UP ON, and what was actually lost. D52a.
   *
   * A probe carries no unit rows — it is built on demand and nothing comes home —
   * so the count was 0 and the line read "0 craft returned · that flight could not
   * be completed": a recall notice reporting the loss of nothing, for a scout that
   * really was lost. The count is the right number and the wrong subject.
   */
  describe('a flight that was abandoned', () => {
    it('names a lost probe as a probe rather than as nothing at all', () => {
      expect(say('fleet_returned', { trip: 'recalled', craft: 0, craftKind: 'probe' })).toBe(
        'Your probe was lost · that flight could not be completed',
      );
    });

    it('still counts the craft on a recalled squadron', () => {
      expect(say('fleet_returned', { trip: 'recalled', craft: 12, craftKind: 'fleet' })).toBe(
        '12 craft returned · that flight could not be completed',
      );
    });

    /** A row written before the field existed must still say something specific. */
    it('reads a payload from before the field was added', () => {
      expect(say('fleet_returned', { trip: 'recalled', craft: 3 })).toBe(
        '3 craft returned · that flight could not be completed',
      );
    });
  });

  describe('an inbound fleet', () => {
    it('counts down against the arrival instant, not the ETA it was written with', () => {
      const arriveAt = new Date(NOW + 9 * 60_000).toISOString();
      expect(say('incoming_fleet', { arriveAt, etaMinutes: 9 })).toBe(
        'Incoming fleet · lands in 9m',
      );
    });

    /**
     * THE ROW OUTLIVES THE RAID, AND USED TO KEEP CLAIMING A COUNTDOWN.
     *
     * `etaMinutes` was measured when the row was written, so an hour later the
     * line still read "ETA 12 min" — beside a timestamp reading "1h 00m ago". One
     * line of interface disagreeing with itself.
     */
    it('goes into the past tense once the fleet has landed', () => {
      const arriveAt = new Date(NOW - 90 * 60_000).toISOString();
      expect(say('incoming_fleet', { arriveAt, etaMinutes: 12 })).toBe(
        'Incoming fleet · landed',
      );
    });

    it('falls back to the written ETA for a row from before the instant was sent', () => {
      expect(say('incoming_fleet', { etaMinutes: 9 })).toBe('Incoming fleet · ETA 9 min');
    });

    it('adds a size estimate only when radar paid for one', () => {
      expect(say('incoming_fleet', { etaMinutes: 9, estimatedShips: 74 })).toContain(
        'est. 74 ships',
      );
    });

    it('renders the current Radar 4 coarse mass without exposing an exact count', () => {
      const line = say('incoming_fleet', { etaMinutes: 9, mass: 'HEAVY' });
      expect(line).toContain('Heavy force inbound');
      expect(line).not.toContain('ships');
    });

    /**
     * WHAT RADAR 5 IS ACTUALLY SOLD FOR. D45.
     *
     * The server had been writing composition and origin into this payload since
     * the radar ladder existed, and the client parsed the fleet and threw it away
     * — so L5 read word for word identical to L4 while costing an exponential
     * step more.
     */
    it('names the hulls and the world they left, once L5 has been paid for', () => {
      const line = say('incoming_fleet', {
        arriveAt: new Date(NOW + 12 * 60_000).toISOString(),
        etaMinutes: 12,
        estimatedShips: 40,
        fleet: { WASP: 30, LANCE: 10 },
        originName: 'Grimhold',
      });
      expect(line).toContain('30 Wasp · 10 Lance');
      expect(line).toContain('from Grimhold');
      // The estimate is redundant once the composition is known.
      expect(line).not.toContain('est.');
    });
  });

  describe('a raid on you', () => {
    it('states what it took and what it cost', () => {
      expect(
        say('raided', { grade: 'DECISIVE', lootAlloy: 4000, lootCrystal: 200, unitsLost: 12 }),
      ).toBe('Raided · −4.2k taken · 12 units lost');
    });

    /** "You repelled a raid" on its own reads as a free win. It was not free. */
    it('prices a repelled raid on both sides', () => {
      const line = say('raided', {
        grade: 'REPELLED',
        lootAlloy: 0,
        lootCrystal: 0,
        unitsLost: 4,
        theirLosses: 31,
      });
      expect(line).toContain('4 lost holding');
      expect(line).toContain('31 of theirs destroyed');
    });
  });

  describe('a raid of your own', () => {
    /**
     * THE LINE THE WHOLE KIND EXISTS FOR. D45.
     *
     * Before it, an attacker whose fleet was annihilated was told nothing at all,
     * by anything, ever — there was no return leg to announce and the defender got
     * the only notification the battle wrote.
     */
    it('says so plainly when nothing came back', () => {
      const line = say('raid_result', {
        grade: 'REPELLED',
        targetName: 'Grimhold',
        lootAlloy: 0,
        lootCrystal: 0,
        unitsLost: 40,
        shipsHome: 0,
      });
      expect(line).toBe('Grimhold held · your fleet was destroyed · 40 ships lost');
    });

    it('leads with the grade and the spoils when it went well', () => {
      const line = say('raid_result', {
        grade: 'DECISIVE',
        targetName: 'Grimhold',
        lootAlloy: 3200,
        lootCrystal: 0,
        unitsLost: 2,
        shipsHome: 38,
      });
      expect(line).toBe('DECISIVE at Grimhold · +3.2k alloy · 2 ships lost');
    });

    it('leads with the canonical username and keeps the planet as location', () => {
      const line = say('raid_result', {
        grade: 'DECISIVE',
        targetUsername: 'İzci',
        targetClanTag: 'WAR',
        targetPlanetName: 'Grimhold',
        lootAlloy: 3200,
        lootCrystal: 0,
        unitsLost: 2,
        shipsHome: 38,
      });
      expect(line).toContain('[WAR] İzci at Grimhold');
    });

    it('does not paint a win as a threat, and does paint a wipeout as one', () => {
      const won = { ...base, kind: 'raid_result', payload: { grade: 'DECISIVE', targetName: 'X', lootAlloy: 1, lootCrystal: 0, unitsLost: 0, shipsHome: 12 } };
      const lost = { ...base, kind: 'raid_result', payload: { grade: 'REPELLED', targetName: 'X', lootAlloy: 0, lootCrystal: 0, unitsLost: 12, shipsHome: 0 } };
      expect(isAlarming(won)).toBe(false);
      expect(isAlarming(lost)).toBe(true);
      // Both are urgent: an outcome you are waiting for outranks a drill landing.
      expect(isUrgent(won) && isUrgent(lost)).toBe(true);
    });
  });

  describe('craft coming home', () => {
    it('reads a raid return as ships and loot', () => {
      expect(
        say('fleet_returned', {
          trip: 'raid',
          ships: 38,
          fromName: 'Grimhold',
          lootAlloy: 3200,
          lootCrystal: 800,
        }),
      ).toBe('Fleet home from Grimhold · 38 ships · +4.0k looted');
    });

    it('reads the new return identity fields and preserves legacy rows', () => {
      expect(
        say('fleet_returned', {
          trip: 'raid',
          ships: 2,
          fromUsername: 'İzci',
          fromPlanetName: 'Grimhold',
          lootAlloy: 0,
          lootCrystal: 0,
        }),
      ).toContain('İzci at Grimhold');
      expect(
        say('fleet_returned', {
          trip: 'raid', ships: 2, fromName: 'Legacy', lootAlloy: 0, lootCrystal: 0,
        }),
      ).toContain('Legacy');
    });

    /**
     * THE BUG THIS WHOLE PAYLOAD CONTRACT EXISTS FOR.
     *
     * The mining payload shared not one field with the schema the client parsed,
     * so every drill and every salvage run in the game reported the four-word
     * fallback. Forty minutes of flight, one sentence, no numbers.
     */
    it('reads a mining return as the ore it actually delivered', () => {
      expect(
        say('fleet_returned', {
          trip: 'mining',
          craft: 2,
          alloy: 812,
          crystal: 190,
          wastedAlloy: 0,
          wastedCrystal: 0,
        }),
      ).toBe('Ore home · +812 alloy · +190 crystal');
    });

    /** D31's lesson, which had never once been displayed anywhere. */
    it('says what was thrown away because the works were full', () => {
      const line = say('fleet_returned', {
        trip: 'mining',
        craft: 3,
        alloy: 400,
        crystal: 0,
        wastedAlloy: 900,
        wastedCrystal: 120,
      });
      expect(line).toContain('+400 alloy');
      expect(line).toContain('1.0k lost, works full');
    });

    it('distinguishes salvage from ore, and an empty run from a full one', () => {
      expect(
        say('fleet_returned', {
          trip: 'harvest',
          craft: 1,
          alloy: 0,
          crystal: 0,
          wastedAlloy: 0,
          wastedCrystal: 0,
        }),
      ).toBe('Salvage run home · nothing left to take');
    });

    it('explains a flight the server could not resolve', () => {
      expect(say('fleet_returned', { trip: 'recalled', craft: 4 })).toBe(
        '4 craft returned · that flight could not be completed',
      );
    });

    /** Rows written before the discriminant existed still read correctly. */
    it('still reads a payload from before `trip` was added', () => {
      expect(say('fleet_returned', { ships: 12, lootAlloy: 500, lootCrystal: 0 })).toBe(
        'Fleet home · 12 ships · +500 looted',
      );
    });
  });

  describe('intel', () => {
    it('announces a probe that is home without giving away what it found', () => {
      expect(say('probe_report', { targetName: 'Grimhold', detected: false })).toBe(
        'Probe home · Grimhold is readable',
      );
    });

    it('uses the new probe username fields without breaking historical payloads', () => {
      expect(say('probe_report', {
        targetUsername: 'İzci', targetPlanetName: 'Grimhold', detected: false,
      })).toContain('İzci at Grimhold');
      expect(say('probe_report', { targetName: 'Legacy', detected: false })).toContain('Legacy');
    });

    it('says when their radar caught it, because that changes what to do next', () => {
      expect(say('probe_report', { targetName: 'Grimhold', detected: true })).toContain(
        'they caught it',
      );
    });

    it('stays vague about a scan — the bearing is the radar log\'s to sell', () => {
      expect(say('scan_detected', { bearing: 'north-west' })).toBe(
        'Scan detected. Someone is gathering intelligence about your world.',
      );
    });

    it('reads an unlock as its own copy', () => {
      expect(say('unlock', { title: 'Telescope unlocked', body: 'You may watch one planet.' })).toBe(
        'Telescope unlocked — You may watch one planet.',
      );
    });
  });

  it('degrades to a plain sentence rather than throwing on a payload it cannot read', () => {
    expect(say('fleet_returned', null)).toBe('Your fleet is home.');
    expect(say('incoming_fleet', 'nonsense')).toBe('Incoming fleet.');
    expect(say('raid_result', undefined)).toBe('Your raid resolved.');
  });

  /**
   * A SERVER ONE DEPLOY AHEAD MUST COST ONE ROW, NOT THE WHOLE HISTORY.
   *
   * `kind` was a Zod enum, so an unrecognised value failed the array, the query
   * errored, and Signals rendered "Nothing yet" over a full mailbox.
   */
  it('returns nothing for a kind it has never heard of', () => {
    expect(say('season_ended', { anything: true })).toBeNull();
  });
});


/**
 * THE FLIGHT-BAY READOUT. D28.
 *
 * The honest version of a return hook: a dark bay states a fact about your own
 * planet and stops. It has to be readable at a glance without the number, which is
 * why it is pips — and it has to be readable by a screen reader, which is why the
 * number is still there.
 */
describe('flight bays', () => {
  /*
    THE RACK IS THE SHARED ONE NOW. D142: flight bays, orbit sockets, telescope
    slots, clan seats and a receiver's bays were five hand-rolled rows of pips
    that looked alike and could drift, so they are one `Tally` — and the assertion
    moves onto its contract, `[data-cell]`, which every rack in the game keeps.
  */
  it('lights one pip per craft in the air and leaves the rest dark', () => {
    const { container } = render(<Bays flight={{ used: 2, total: 5 }} />);
    const pips = container.querySelectorAll('[data-tally] [data-cell]');
    expect(pips).toHaveLength(5);
    expect(container.querySelectorAll('[data-cell="used"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-cell="free"]')).toHaveLength(3);
  });

  it('says the count out loud for anyone who cannot see the pips', () => {
    render(<Bays flight={{ used: 3, total: 4 }} />);
    expect(screen.getByLabelText('3 of 4 flight bays in use')).toBeInTheDocument();
  });

  it('renders nothing at all when a planet has no bays', () => {
    const { container } = render(<Bays flight={{ used: 0, total: 0 }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
