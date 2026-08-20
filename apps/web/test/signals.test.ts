import { describe, expect, it } from 'vitest';
import { group, statusOf } from '../src/shell/Signals.js';
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
  bufferAlloy: 0,
  bufferCrystal: 0,
  ...over,
});

describe('what the game volunteers', () => {
  it('says nothing when there is nothing to say', () => {
    expect(statusOf(view(), holding())).toEqual([]);
  });

  /**
   * THE RETENTION HOOK, and the only one the design permits. The works stop when
   * they are full, so every hour after that is production thrown away — stated as
   * a loss rather than as "storage full", because a percentage is a fact and a
   * loss is a reason to act.
   */
  it('reports the works stopping as production being thrown away', () => {
    const status = statusOf(view(), holding({ bufferAlloy: 4800 }));
    expect(status).toHaveLength(1);
    expect(status[0]?.line).toBe('The works have stopped');
    expect(status[0]?.detail).toContain('thrown away');
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
