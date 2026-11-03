import { Column, entityKind, is, SQL, sql, Table } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { players } from '../src/db/schema.js';

/**
 * `is` ASKS THE SAME QUESTION THOUSANDS OF TIMES PER REQUEST. Query plan, 2026-11-03.
 *
 * Building a statement tests every SQL chunk against a run of entity classes, most of
 * them misses, and each miss climbed the class chain again. A class's ancestors never
 * change, so `patches/drizzle-orm@0.45.2.patch` keeps the answer per class.
 */
afterEach(() => { vi.restoreAllMocks(); });

describe('drizzle is()', () => {
  it('answers as before for the classes a statement is built from', () => {
    expect(is(sql`1`, SQL)).toBe(true);
    expect(is(players.id, Column)).toBe(true);
    expect(is(players, Table)).toBe(true);
    expect(is(sql`1`, Column)).toBe(false);
    expect(is(players, SQL)).toBe(false);
  });

  it('answers as before for values that are not entities', () => {
    for (const value of [null, undefined, 0, 'text', {}, [], new Date(), new Map()]) expect(is(value, SQL)).toBe(false);
  });

  it('recognises a class by its kind, as a second copy of the library is', () => {
    class Copy { static readonly [entityKind] = SQL[entityKind]; readonly copy = true; }
    class Child extends Copy {}
    expect(is(new Copy(), SQL)).toBe(true);
    expect(is(new Child(), SQL)).toBe(true);
    expect(is(new Child(), Column)).toBe(false);
  });

  it('still refuses a class that is no entity', () => {
    class Plain { readonly plain = true; }
    expect(() => is({}, Plain as never)).toThrow(/doesn't look like a Drizzle entity/);
  });

  it('does not climb the class chain twice for one question', () => {
    class Unseen { readonly unseen = true; }
    expect(is(new Unseen(), SQL)).toBe(false);
    const climb = vi.spyOn(Object, 'getPrototypeOf');
    expect(is(new Unseen(), SQL)).toBe(false);
    expect(climb.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
