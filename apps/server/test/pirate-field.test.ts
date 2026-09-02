import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { fleetCount, fleetEntries, pirateActive, pirateRoster, seededFrom } from '@astera/rules';
import { pirateState, seasons } from '../src/db/schema.js';
import {
  livingRoster,
  loadPirateSnapshot,
  pirateCallsign,
  pirateId,
  pirateIndexFromId,
  privatePirateField,
} from '../src/services/pirateField.js';
import { minutesSince } from '../src/clock.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

/**
 * THE PIRATE FIELD IS DERIVED, AND ITS INDICES ARE A SECRET. D150 · D143.
 *
 * The lane is a pure function of the season key, so the only thing worth storing
 * is what has been shot off a pirate. Everything else in this file guards the
 * boundary: a raw index is the address of a target in a schedule nobody may
 * download, and handing one out — in a payload, in an error, in an id — would let
 * a client enumerate pirates it has never seen.
 */
afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('the private pirate field', () => {
  it('is the same lane every time the season key is read', () => {
    const a = privatePirateField('key-one');
    const b = privatePirateField('key-one');
    expect(a).toBe(b);
    expect(a).toEqual(privatePirateField('key-one'));
    expect(a).not.toEqual(privatePirateField('key-two'));
    expect(a.length).toBeGreaterThan(0);
  });

  it('hands out an opaque handle and never the index behind it', () => {
    const field = privatePirateField('key-one');
    const issued = new Set<string>();
    for (const spec of field) {
      const id = pirateId('key-one', spec.index);
      expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect(id).not.toBe(String(spec.index));
      issued.add(id);
    }
    // Distinct across the whole lane, and every one resolves back to its own index.
    expect(issued.size).toBe(field.length);
    for (const spec of field.slice(0, 30)) {
      expect(pirateIndexFromId('key-one', field, pirateId('key-one', spec.index)))
        .toBe(spec.index);
    }
  });

  it('refuses an id minted under another season key', () => {
    const field = privatePirateField('key-one');
    const foreign = pirateId('key-two', field[0]!.index);
    expect(pirateIndexFromId('key-one', field, foreign)).toBeNull();
  });

  it('refuses malformed and unknown ids without throwing', () => {
    const field = privatePirateField('key-one');
    for (const bad of ['', '0', '../../etc', 'x'.repeat(21), 'x'.repeat(23), 'A'.repeat(22)]) {
      expect(pirateIndexFromId('key-one', field, bad)).toBeNull();
    }
  });

  it('names a pirate without spelling out where it sits in the lane', () => {
    /*
      A season-unique label the interface can print, derived from the OPAQUE id
      rather than from the index. `Korsan L3-7` would be a readable name and also a
      running count of how many level 3 pirates the season has produced — which is
      the schedule leaking through the copy instead of through the payload.
    */
    const field = privatePirateField('key-one');
    const seen = new Set<string>();
    for (const spec of field) {
      const sign = pirateCallsign('key-one', spec.index);
      expect(sign).toMatch(/^[A-Za-z0-9_-]{4}$/);
      seen.add(sign);
    }
    expect(seen.size).toBeGreaterThan(field.length * 0.9);
  });
});

describe('what a pirate has left', () => {
  let f: Fixture;

  beforeEach(async () => {
    f = await seedWorld(2, 4242, { pirates: true });
  });

  it('reads an untouched pirate as its full roster', () => {
    const roster = pirateRoster(3, seededFrom('living'));
    expect(livingRoster(roster, {})).toEqual(roster);
    expect(livingRoster(roster, undefined)).toEqual(roster);
  });

  it('subtracts what other commanders already destroyed, and never goes negative', () => {
    const roster = pirateRoster(3, seededFrom('living'));
    const [firstHull, firstCount] = fleetEntries(roster)[0]!;
    const after = livingRoster(roster, { [firstHull]: firstCount + 5 });
    expect(after[firstHull] ?? 0).toBe(0);
    expect(fleetCount(after)).toBe(fleetCount(roster) - firstCount);
  });

  it('loads the season lane with its stored damage applied', async () => {
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const field = privatePirateField(season!.asteroidKey);
    // An hour in: the lane's first arrivals are up, so there is something to damage.
    const now = new Date(season!.startsAt.getTime() + 60 * 60_000);
    const nowMinutes = minutesSince(season!.startsAt, now);
    const live = field.find((spec) => pirateActive(spec, nowMinutes))!;
    const [hull, count] = fleetEntries(live.roster)[0]!;

    await f.db.insert(pirateState).values({
      seasonId: f.seasonId,
      index: live.index,
      losses: { [hull]: count },
      updatedAt: now,
    });

    const snapshot = await loadPirateSnapshot(f.db, f.seasonId, now);
    expect(snapshot.pirates.length).toBe(field.length);
    expect(snapshot.livingRosterOf(live.index)[hull] ?? 0).toBe(0);
    // Everything else is untouched, and reads its full roster with no row at all.
    const other = field.find((spec) => spec.index !== live.index)!;
    expect(snapshot.livingRosterOf(other.index)).toEqual(other.roster);
    expect(snapshot.destroyedAt(live.index)).toBeNull();
  });

  it('treats a destroyed pirate as gone even while its orbit is still live', async () => {
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const field = privatePirateField(season!.asteroidKey);
    const now = new Date(season!.startsAt.getTime() + 60 * 60_000);
    const nowMinutes = minutesSince(season!.startsAt, now);
    const live = field.find((spec) => pirateActive(spec, nowMinutes));
    expect(live).toBeDefined();

    await f.db.insert(pirateState).values({
      seasonId: f.seasonId,
      index: live!.index,
      losses: live!.roster,
      destroyedAt: now,
      destroyedByPlayerId: f.playerIds[0]!,
      updatedAt: now,
    });

    const snapshot = await loadPirateSnapshot(f.db, f.seasonId, now);
    expect(snapshot.destroyedAt(live!.index)).not.toBeNull();
    expect(snapshot.standing(now).some((spec) => spec.index === live!.index)).toBe(false);
  });

  it('stands up only the pirates whose life covers this instant', async () => {
    const now = new Date(f.clock.now().getTime() + 60 * 60_000);
    const snapshot = await loadPirateSnapshot(f.db, f.seasonId, now);
    const nowMinutes = minutesSince(snapshot.startsAt, now);
    for (const spec of snapshot.standing(now)) {
      expect(pirateActive(spec, nowMinutes)).toBe(true);
    }
    expect(snapshot.standing(now).length).toBeGreaterThan(0);
    expect(snapshot.standing(now).length).toBeLessThan(snapshot.pirates.length);
  });
});
