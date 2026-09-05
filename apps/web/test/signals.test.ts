import { describe, expect, it } from 'vitest';
import { group, statusOf } from '../src/shell/Signals.js';
import { signalFamily, signalGlyph, signalOutcome } from '../src/lib/notifications.js';
import { TAB_OF } from '../src/screens/PlanetScreen.js';
import type { NotificationView, PlanetView } from '../src/api/schemas.js';
import type { Projected } from '../src/lib/projection.js';

/**
 * The signals list is the only place the game tells a player something without
 * being asked, so what it decides to say is a product decision, not a display
 * detail.
 *
 * REWRITTEN FOR D16. These used to pin "a full STORE is a loss", which was right
 * while production flowed into storage. It no longer does: production fills the
 * works and halts there, so a full store costs nothing by itself — it only matters
 * because it blocks the next collection. What is now pinned is that the WORKS
 * stopping surfaces as an hourly loss, and that a full store is reported as the
 * blockage it actually is.
 */

const view = (over: Partial<PlanetView['planet']> = {}): PlanetView =>
  ({
    planet: {
      id: 'p1',
      name: 'Kestrel-12',
      position: { x: 0, y: 0, z: 0 },
      alloy: 0,
      crystal: 0,
      alloyCap: 6000,
      crystalCap: 2000,
      alloyPerHour: 600,
      crystalPerHour: 200,
      bufferAlloy: 0,
      bufferCrystal: 0,
      bufferAlloyCap: 4800,
      bufferCrystalCap: 1600,
      vaultFloor: 300,
      shield: 0,
      disruptedUntil: null,
      ...over,
    },
  }) as PlanetView;

/**
 * WHAT THE PLAYER IS ACTUALLY HOLDING, which is the projection and not the payload.
 *
 * Both piles are read off this now. `statusOf` used to judge the STORE against the
 * projection and the WORKS against the last fetch, so the header's Works meter could
 * hit 100% while Signals — the one surface whose job is to say the works have
 * stopped — stayed silent until the next poll.
 */
const holding = (over: Partial<Projected> = {}): Projected => ({
  alloy: 100,
  crystal: 50,
  deuterium: 0,
  bufferAlloy: 0,
  bufferCrystal: 0,
  bufferDeuterium: 0,
  ...over,
});

describe('what the game volunteers', () => {
  it('says nothing when there is nothing to say', () => {
    expect(statusOf(view(), holding())).toEqual([]);
  });

  /**
   * THE RETENTION HOOK, and the only one the design permits. The works stop when
   * they are full, so the status states exactly which production rate is paused
   * until collection makes room again.
   */
  it('reports the works stopping as paused production', () => {
    const status = statusOf(view(), holding({ bufferAlloy: 4800 }));
    expect(status).toHaveLength(1);
    expect(status[0]?.line).toBe('The works have stopped');
    expect(status[0]?.detail).toContain('Production is paused at 800 per hour');
    expect(status[0]?.go).toBe('planet');
  });

  it('says nothing while the works still have room', () => {
    expect(statusOf(view(), holding({ bufferAlloy: 2000 }))).toEqual([]);
  });

  /** Either vessel filling halts that resource, even if the other has room. */
  it('reports the works as stopped when only one vessel is full', () => {
    const status = statusOf(view(), holding({ bufferCrystal: 1600 }));
    expect(status.map((s) => s.line)).toContain('The works have stopped');
  });

  /**
   * A FULL STORE IS NOT A LOSS BY ITSELF ANY MORE — nothing flows into it on its
   * own. It matters only when it is blocking ore that is waiting in the works, so
   * it is reported that way round or not at all.
   */
  it('ignores a full store when nothing is waiting to go into it', () => {
    expect(statusOf(view(), holding({ alloy: 6000, crystal: 2000 }))).toEqual([]);
  });

  it('reports a full store as the blockage it is when ore is waiting', () => {
    const status = statusOf(view(), holding({ alloy: 6000, crystal: 50, bufferAlloy: 900 }));
    expect(status.map((s) => s.line)).toContain('Alloy store is full');
    expect(status.find((s) => s.line === 'Alloy store is full')?.detail).toContain(
      'nowhere to go',
    );
  });

  /**
   * THE TWO HALVES OF THE WIDGET MUST AGREE. D52a.
   *
   * The payload says the works are empty because it was fetched thirty seconds ago;
   * the projection says they are full because it has been counting since. Signals
   * read the first and the header read the second, so the meter pinned at 100% while
   * the sentence that explains it never appeared.
   */
  it('reports the works as stopped from the projection, not from the last fetch', () => {
    const status = statusOf(view({ bufferAlloy: 0 }), holding({ bufferAlloy: 4800 }));
    expect(status.map((s) => s.line)).toContain('The works have stopped');
  });

  /** And the other way: a fetch that says full is corrected by a collect. */
  it('stops warning once the projection says the works were emptied', () => {
    expect(statusOf(view({ bufferAlloy: 4800 }), holding({ bufferAlloy: 0 }))).toEqual([]);
  });

  it('leads with the works being offline, which outranks any store', () => {
    const disruptedUntil = new Date(Date.now() + 90 * 60_000);
    const status = statusOf(
      view({ disruptedUntil }),
      holding({ alloy: 6000, crystal: 2000, bufferAlloy: 900 }),
    );
    expect(status[0]?.line).toBe('Your works are offline');
    expect(status[0]?.tone).toBe('threat');
  });

  it('forgets a disruption that has already expired', () => {
    const disruptedUntil = new Date(Date.now() - 60_000);
    expect(statusOf(view({ disruptedUntil }), holding({ alloy: 10, crystal: 10 }))).toEqual([]);
  });
});

/**
 * Every requirement on the planet screen is a button that jumps to the thing that
 * would satisfy it — and since the screen is now tabbed, jumping means switching
 * tab as well as scrolling. A row missing from this map lands the player on the
 * right row of a tab they are not looking at.
 */
describe('the requirement jump', () => {
  it('knows which tab every purchasable thing lives under', () => {
    for (const id of [
      'CORE',
      'REFINERY',
      'EXTRACTOR',
      'VAULT',
      'SHIPYARD',
      'TELESCOPE',
      'RADAR',
      'VEIL',
      'AEGIS',
      // D25: the four satellites share the Orbit surface with the four instruments.
      // The Drill is not on this list any more — it stopped being hardware at all
      // and became a craft the Shipyard builds.
      'UPLINK',
      'FOUNDRY',
      'DERRICK',
      'BEACON',
    ]) {
      expect(TAB_OF[id], `${id} has no home tab`).toBeDefined();
    }
  });
});

/**
 * FOLDING REPEATED NEWS. D45.
 *
 * The "while you were gone" overlay this list replaced grouped scans into one
 * line — "3 scans detected" — and Signals printed them one per row in identical
 * words. A night under a determined neighbour's probes is eleven of them, and
 * eleven identical rows push every other thing that happened off the screen.
 * `game-design.md` calls that a wall of logs and forbids it.
 */
const scan = (id: string, seen: boolean): NotificationView => ({
  id,
  kind: 'scan_detected',
  payload: { bearing: 'north' },
  seen,
  at: new Date(),
});

const raid = (id: string): NotificationView => ({
  id,
  kind: 'raided',
  payload: { grade: 'DECISIVE', lootAlloy: 100, lootCrystal: 0, unitsLost: 1 },
  seen: true,
  at: new Date(),
});

describe('folding repeated news', () => {
  it('collapses a run of identical scans into one row with a count', () => {
    const folded = group([scan('a', true), scan('b', true), scan('c', true)]);
    expect(folded).toHaveLength(1);
    expect(folded[0]!.repeats).toBe(3);
  });

  it('never folds across a different kind — the run has to be adjacent', () => {
    const folded = group([scan('a', true), raid('r'), scan('b', true)]);
    expect(folded.map((g) => g.repeats)).toEqual([1, 1, 1]);
  });

  /** One unread scan inside a fold of five must not read as already handled. */
  it('a fold is unread if anything in it is unread', () => {
    const folded = group([scan('a', true), scan('b', false), scan('c', true)]);
    expect(folded).toHaveLength(1);
    expect(folded[0]!.event.seen).toBe(false);
  });

  /**
   * Anything carrying its own figures says something different every time, so it
   * keeps its own line however many of them arrive together.
   */
  it('leaves rows that carry numbers alone', () => {
    expect(group([raid('a'), raid('b')])).toHaveLength(2);
  });
});

/**
 * WHICH FAMILY OF NEWS A ROW IS, WHICH IS THE ONLY REASON IT CAN BE COLOURED.
 *
 * Every row in Signals used to be drawn the same: one of five glyphs (and the
 * bell for everything else), aqua if it was unread and grey if it was not. So a
 * probe coming home, a colony falling and an asteroid shower starting were three
 * identical lines, and the surface that exists to say WHAT HAPPENED while you were
 * away could only say THAT something had.
 *
 * `docs/visual-design.md` states the law this obeys — **icons carry shape, the
 * interface carries colour** — so the fix is split in two: the family decides the
 * hue (which category of news), and the glyph decides the shape (which kind). Both
 * are asserted, and the exhaustiveness case below is the one that matters: a kind
 * with no family falls back to furniture grey, silently, exactly the way five
 * kinds fell back to the bell for a year.
 */
describe('what family of news a signal is', () => {
  const news = (kind: string, payload: Record<string, unknown> = {}): NotificationView => ({
    id: `n-${kind}`,
    kind,
    payload,
    seen: false,
    at: new Date(),
  });

  it('reads a galaxy event as a galaxy event, not as personal mail', () => {
    expect(signalFamily(news('galaxy_event_started'))).toBe('world');
    expect(signalFamily(news('galaxy_event_ended'))).toBe('world');
  });

  /**
   * THE PIRATE LANE WEARS WHAT IT WEARS ON THE DISC. D150.
   *
   * A pirate formation in the galaxy carries a red skull (`PIRATE_MARK` in
   * `Fleets.tsx`, coloured `THREAT_NEON`), and that is not a judgement about the
   * outcome — it is the mark that says "that is a target, not a commander". A raid
   * at one reports back under the same mark, win or lose, because the player is
   * reading a list and the first question is which fight this was.
   *
   * WHICH IS A DIFFERENT QUESTION FROM WHETHER IT WENT BADLY. `isAlarming` still
   * answers that one and still says a decisive win is not bad news, so the row
   * wears the pirate's red chip while its sentence stays in bone.
   */
  it('marks a raid at a pirate as the pirate lane, whichever way it went', () => {
    const won = news('raid_result', {
      targetKind: 'PIRATE', grade: 'DECISIVE',
      lootAlloy: 100, lootCrystal: 0, unitsLost: 2, shipsHome: 28,
    });
    const lost = news('raid_result', {
      targetKind: 'PIRATE', grade: 'REPELLED',
      lootAlloy: 0, lootCrystal: 0, unitsLost: 30, shipsHome: 0,
    });
    expect(signalFamily(won)).toBe('pirate');
    expect(signalFamily(lost)).toBe('pirate');
  });

  it('separates a raid at a commander from a raid at a pirate', () => {
    const pvp = news('raid_result', {
      grade: 'DECISIVE', lootAlloy: 900, lootCrystal: 40, unitsLost: 1, shipsHome: 20,
    });
    expect(signalFamily(pvp)).toBe('gain');
  });

  it('calls bad news bad, including the two kinds nothing used to', () => {
    expect(signalFamily(news('incoming_fleet', { etaMinutes: 5 }))).toBe('threat');
    expect(signalFamily(news('strategic_incoming', { etaMinutes: 5 }))).toBe('threat');
    expect(signalFamily(news('raided', {
      grade: 'DECISIVE', lootAlloy: 900, lootCrystal: 0, unitsLost: 3,
    }))).toBe('threat');
    expect(signalFamily(news('colony_lost', { targetPlanetId: 'p9' }))).toBe('threat');
    // Neither of these is in `isAlarming`, and both are unambiguously a loss: a
    // settlement race lost, and the most expensive hull in the game shot off a ring.
    expect(signalFamily(news('settlement_lost', { targetPlanetId: 'p9' }))).toBe('threat');
    expect(signalFamily(news('strategic_intercepted', { defended: false, range: 1300 })))
      .toBe('threat');
  });

  /** Your own grid killing a Death Star is the best news the kind can carry. */
  it('reads the two sides of one interception apart', () => {
    expect(signalFamily(news('strategic_intercepted', { defended: true, range: 1300 })))
      .toBe('gain');
  });

  /** A raid of your own where nothing came home is a loss, pirates aside. */
  it('reads a wiped fleet as a loss even though the raid was yours', () => {
    expect(signalFamily(news('raid_result', {
      grade: 'REPELLED', lootAlloy: 0, lootCrystal: 0, unitsLost: 30, shipsHome: 0,
    }))).toBe('threat');
  });

  /**
   * SOMEBODY IS LOOKING AT YOU — which is neither a loss nor a gain. It is the
   * one thing on this surface that is a WARNING about what has not happened yet,
   * so it gets the caution hue rather than the alarm one.
   */
  it('gives being scanned its own hue', () => {
    expect(signalFamily(news('scan_detected'))).toBe('watch');
  });

  it('reads a reading landing, and a gate opening, as a gain', () => {
    expect(signalFamily(news('probe_report', { targetPlanetName: 'Kestrel-12' }))).toBe('gain');
    expect(signalFamily(news('unlock', { unlock: 'RADAR' }))).toBe('gain');
    expect(signalFamily(news('colony_captured', { targetPlanetId: 'p9' }))).toBe('gain');
    expect(signalFamily(news('settlement_success', { targetPlanetId: 'p9' }))).toBe('gain');
    expect(signalFamily(news('fleet_returned', {
      trip: 'raid', ships: 4, lootAlloy: 10, lootCrystal: 0,
    }))).toBe('gain');
  });

  /** A newer server's kind must be furniture, never a hue that means something. */
  it('leaves a kind it has never heard of as a plain note', () => {
    expect(signalFamily(news('teleportation_complete'))).toBe('note');
  });

  /**
   * EVERY KIND THE SERVER CAN SEND HAS A FAMILY, and none of them lands on the
   * fallback. The list is `notification-routes.test.tsx`'s `EVERY_KIND`, which
   * `notifications.test.ts` pins to the database enum — so a new kind fails there
   * first and is then caught here for having no colour and no shape.
   */
  it('classifies every kind the server can actually send', () => {
    const payloads: Record<string, Record<string, unknown>> = {
      colony_captured: { targetPlanetId: 'p9' },
      colony_lost: { targetPlanetId: 'p9' },
      death_star_result: { outcome: 'FIRST_STRIKE', targetPlanetId: 'p9' },
      fleet_returned: { trip: 'raid', ships: 4, lootAlloy: 10, lootCrystal: 0 },
      galaxy_event_ended: {},
      galaxy_event_started: {},
      incoming_fleet: { etaMinutes: 6 },
      probe_report: { targetPlanetName: 'Kestrel-12', detected: false },
      raid_result: { grade: 'PARTIAL', lootAlloy: 5, lootCrystal: 0, unitsLost: 1, shipsHome: 3 },
      raided: { grade: 'DECISIVE', lootAlloy: 900, lootCrystal: 0, unitsLost: 3 },
      scan_detected: {},
      settlement_lost: { targetPlanetId: 'p9' },
      settlement_success: { targetPlanetId: 'p9' },
      strategic_incoming: { etaMinutes: 9 },
      strategic_intercepted: { defended: true, range: 1300 },
      unlock: { unlock: 'RADAR', title: 'Radar unlocked', body: 'Catches anyone looking.' },
    };
    for (const [kind, payload] of Object.entries(payloads)) {
      expect(signalFamily(news(kind, payload)), kind).not.toBe('note');
      expect(signalGlyph(news(kind, payload)), kind).not.toBe('bell');
    }
  });

  /** A pirate raid is the one row whose glyph is not decided by its kind alone. */
  it('hands the pirate lane the skull and nothing else the skull', () => {
    expect(signalGlyph(news('raid_result', {
      targetKind: 'PIRATE', grade: 'DECISIVE',
      lootAlloy: 10, lootCrystal: 0, unitsLost: 0, shipsHome: 30,
    }))).toBe('skull');
    expect(signalGlyph(news('raid_result', {
      grade: 'DECISIVE', lootAlloy: 10, lootCrystal: 0, unitsLost: 0, shipsHome: 30,
    }))).toBe('raided');
  });

  /**
   * EIGHT KINDS SHARED THE BELL, which is the same as having no icon at all.
   *
   * Asserted on the PAIR rather than on the glyph alone, because two kinds are
   * allowed to share a shape when they are about the same object: a Death Star
   * inbound and a Death Star resolving are one silhouette, told apart by the hue
   * (one is done to you, one is yours landing). What is forbidden is two rows
   * being identical in both.
   */
  it('gives every kind that shared the bell a mark of its own', () => {
    const marks = [
      news('strategic_incoming', { etaMinutes: 4 }),
      news('death_star_result', { outcome: 'CAPTURED', targetPlanetId: 'p9' }),
      news('colony_captured', { targetPlanetId: 'p9' }),
      news('colony_lost', { targetPlanetId: 'p9' }),
      news('settlement_lost', { targetPlanetId: 'p9' }),
      news('galaxy_event_started'),
      news('probe_report', { targetPlanetName: 'K' }),
      news('scan_detected'),
    ].map((n) => `${signalFamily(n)}/${signalGlyph(n)}`);

    expect(marks.every((mark) => !mark.endsWith('/bell'))).toBe(true);
    // `colony_lost` and `settlement_lost` are the same loss told twice, and are the
    // one deliberate duplicate in this list.
    expect(new Set(marks).size).toBe(marks.length - 1);
  });
});

/**
 * DID IT GO MY WAY? Owner decision, and the row's background answers it.
 *
 * The family says which CATEGORY of news a row is and the glyph says which kind;
 * neither says whether the news is good, and that is the first thing a person
 * scanning a list wants. A thin green wash for a win, a thin red one for a loss,
 * and nothing at all on the rows that are neither — a wash on a neutral row would
 * make three states out of two and cost the other two their meaning.
 *
 * IT IS NOT THE SAME QUESTION AS THE FAMILY, and the pirate lane is where the two
 * come apart: a raid at a pirate always wears the red skull, and whether it was a
 * win is decided by whether the squadron came home.
 */
describe('whether a signal went the reader’s way', () => {
  const news = (kind: string, payload: Record<string, unknown> = {}): NotificationView => ({
    id: `n-${kind}`,
    kind,
    payload,
    seen: false,
    at: new Date(),
  });

  it('reads every loss as a loss', () => {
    expect(signalOutcome(news('incoming_fleet', { etaMinutes: 5 }))).toBe('loss');
    expect(signalOutcome(news('strategic_incoming', { etaMinutes: 5 }))).toBe('loss');
    expect(signalOutcome(news('raided', {
      grade: 'DECISIVE', lootAlloy: 900, lootCrystal: 0, unitsLost: 3,
    }))).toBe('loss');
    expect(signalOutcome(news('colony_lost', { targetPlanetId: 'p9' }))).toBe('loss');
    expect(signalOutcome(news('settlement_lost', { targetPlanetId: 'p9' }))).toBe('loss');
    expect(signalOutcome(news('strategic_intercepted', { defended: false, range: 1300 })))
      .toBe('loss');
    expect(signalOutcome(news('raid_result', {
      grade: 'REPELLED', lootAlloy: 0, lootCrystal: 0, unitsLost: 30, shipsHome: 0,
    }))).toBe('loss');
  });

  it('reads every win as a win', () => {
    expect(signalOutcome(news('raid_result', {
      grade: 'DECISIVE', lootAlloy: 900, lootCrystal: 0, unitsLost: 1, shipsHome: 20,
    }))).toBe('win');
    expect(signalOutcome(news('probe_report', { targetPlanetName: 'Kestrel-12' }))).toBe('win');
    expect(signalOutcome(news('unlock', { unlock: 'RADAR' }))).toBe('win');
    expect(signalOutcome(news('colony_captured', { targetPlanetId: 'p9' }))).toBe('win');
    expect(signalOutcome(news('settlement_success', { targetPlanetId: 'p9' }))).toBe('win');
    expect(signalOutcome(news('fleet_returned', {
      trip: 'raid', ships: 4, lootAlloy: 10, lootCrystal: 0,
    }))).toBe('win');
    expect(signalOutcome(news('strategic_intercepted', { defended: true, range: 1300 })))
      .toBe('win');
    expect(signalOutcome(news('death_star_result', {
      outcome: 'CAPTURED', targetPlanetId: 'p9',
    }))).toBe('win');
  });

  /** A raid at a pirate is judged by whether the squadron came home, like any raid. */
  it('judges a pirate raid by what came back, not by the lane', () => {
    expect(signalOutcome(news('raid_result', {
      targetKind: 'PIRATE', grade: 'DECISIVE',
      lootAlloy: 900, lootCrystal: 0, unitsLost: 2, shipsHome: 26,
    }))).toBe('win');
    expect(signalOutcome(news('raid_result', {
      targetKind: 'PIRATE', grade: 'REPELLED',
      lootAlloy: 0, lootCrystal: 0, unitsLost: 30, shipsHome: 0,
    }))).toBe('loss');
  });

  /**
   * NEITHER, AND THEREFORE UNTOUCHED. Owner instruction.
   *
   * Being scanned has not cost anything yet, an asteroid shower is the galaxy's
   * news rather than the reader's, and a strike that did nothing did nothing. A
   * wash on any of them would make the two that mean something mean less.
   */
  it('leaves what is neither alone', () => {
    expect(signalOutcome(news('scan_detected'))).toBe('neutral');
    expect(signalOutcome(news('galaxy_event_started'))).toBe('neutral');
    expect(signalOutcome(news('galaxy_event_ended'))).toBe('neutral');
    expect(signalOutcome(news('death_star_result', {
      outcome: 'INEFFECTIVE', targetPlanetId: 'p9',
    }))).toBe('neutral');
    expect(signalOutcome(news('teleportation_complete'))).toBe('neutral');
  });

  /** A rerouted transfer is cargo that could not be delivered — not a win. */
  it('does not call a rerouted convoy a win', () => {
    expect(signalOutcome(news('fleet_returned', {
      trip: 'transfer_rerouted', reason: 'CAPACITY', craft: 3,
      targetPlanetId: 'p9', targetPlanetName: 'Kestrel-12',
    }))).toBe('loss');
  });
});
