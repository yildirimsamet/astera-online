import { QueryClient, replaceEqualDeep } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { shareStructure } from '../src/api/structural.js';
import { trafficSchema, pendingSchema } from '../src/api/schemas.js';

/**
 * IDENTITY IS THE THING BEING TESTED, so every assertion here is `toBe`.
 *
 * `toEqual` would pass against the broken behaviour this file exists to prevent —
 * the payload was always correct, it was simply never the SAME object twice, and
 * that is what re-ran every memo and rebuilt every geometry on the disc.
 */
describe('structural sharing', () => {
  it('keeps the old value when nothing changed', () => {
    const before = { a: 1, b: [1, 2, 3] };
    const after = { a: 1, b: [1, 2, 3] };
    expect(shareStructure(before, after)).toBe(before);
  });

  it('keeps the branches that did not change', () => {
    const before = { moved: { n: 1 }, still: { n: 2 } };
    const after = { moved: { n: 9 }, still: { n: 2 } };
    const merged = shareStructure(before, after);
    expect(merged).not.toBe(before);
    expect(merged.still).toBe(before.still);
    expect(merged.moved).toEqual({ n: 9 });
  });

  /** The clause the library is missing, and the reason this file exists. */
  it('treats two Dates for the same instant as the same fact', () => {
    const before = { at: new Date('2026-04-01T12:00:00.000Z') };
    const after = { at: new Date('2026-04-01T12:00:00.000Z') };
    expect(shareStructure(before, after)).toBe(before);
    expect(shareStructure(before, after).at).toBe(before.at);
  });

  it('takes the new Date when the instant really moved', () => {
    const before = { at: new Date('2026-04-01T12:00:00.000Z') };
    const after = { at: new Date('2026-04-01T12:00:01.000Z') };
    const merged = shareStructure(before, after);
    expect(merged.at).toBe(after.at);
  });

  it('does not descend into a Date and rebuild it as an object', () => {
    const merged = shareStructure({ at: new Date(1) }, { at: new Date(2) });
    expect(merged.at).toBeInstanceOf(Date);
    expect(merged.at.getTime()).toBe(2);
  });

  it('notices a key that disappeared', () => {
    const before = { a: 1, b: 2 };
    const after = { a: 1 };
    expect(shareStructure(before, after)).not.toBe(before);
    expect(shareStructure(before, after)).toEqual({ a: 1 });
  });

  it('notices an array that got shorter', () => {
    const before = [{ n: 1 }, { n: 2 }];
    const after = [{ n: 1 }];
    const merged = shareStructure(before, after);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toBe(before[0]);
  });

  it('keeps the surviving items when one is added', () => {
    const before = [{ n: 1 }];
    const after = [{ n: 1 }, { n: 2 }];
    const merged = shareStructure(before, after);
    expect(merged[0]).toBe(before[0]);
    expect(merged[1]).toEqual({ n: 2 });
  });

  it('never mistakes null for an object', () => {
    expect(shareStructure({ a: null }, { a: null })).toEqual({ a: null });
    expect(shareStructure(null, { a: 1 })).toEqual({ a: 1 });
    expect(shareStructure({ a: 1 }, null)).toBeNull();
  });

  /* ── the payloads the disc actually draws from ─────────────── */

  /**
   * THE REAL SHAPE, PARSED TWICE, WHICH IS WHAT A REFETCH IS.
   *
   * Two identical responses through the same Zod schema produce two structurally
   * identical values made of entirely different Dates. This is the exact case the
   * client hits every sixty seconds on `traffic`, `pending` and `mining`.
   */
  const trafficBody = {
    contacts: [
      {
        id: '5d2b7f5a-1c4e-4a2d-9f0b-8a3c1d5e6f70',
        kind: 'fleet',
        from: { x: 0, y: 0, z: 0 },
        to: { x: 10, y: 0, z: 0 },
        startAt: '2026-04-01T12:00:00.000Z',
        endAt: '2026-04-01T12:04:00.000Z',
        fleet: { WASP: 8 },
      },
    ],
  };

  it('holds a traffic payload stable across two identical parses', () => {
    const first = trafficSchema.parse(trafficBody);
    const second = trafficSchema.parse(trafficBody);
    expect(second, 'a fresh parse is a fresh object, which is the premise').not.toBe(first);
    expect(shareStructure(first, second)).toBe(first);
    expect(shareStructure(first, second).contacts[0]).toBe(first.contacts[0]);
  });

  it('holds a pending payload stable across two identical parses', () => {
    const body = {
      pending: [
        {
          id: '3a1f9c22-5b6d-4e8f-9012-abcdef012345',
          kind: 'fleet',
          targetName: 'Vega-3',
          minutesRemaining: 4,
          arriveAt: '2026-04-01T12:04:00.000Z',
          leg: 'outbound',
          fleet: { WASP: 8 },
          path: {
            from: { x: 0, y: 0, z: 0 },
            to: { x: 40, y: 0, z: 0 },
            departAt: '2026-04-01T12:00:00.000Z',
            arriveAt: '2026-04-01T12:04:00.000Z',
          },
        },
      ],
    };
    const first = pendingSchema.parse(body);
    expect(shareStructure(first, pendingSchema.parse(body))).toBe(first);
  });

  it('replaces only the contact that moved when one of three did', () => {
    const three = {
      contacts: [0, 1, 2].map((i) => ({
        ...trafficBody.contacts[0]!,
        id: `0000000${String(i)}-1c4e-4a2d-9f0b-8a3c1d5e6f70`,
      })),
    };
    const first = trafficSchema.parse(three);
    const moved = {
      contacts: three.contacts.map((c, i) =>
        i === 1 ? { ...c, endAt: '2026-04-01T12:05:00.000Z' } : c,
      ),
    };
    const merged = shareStructure(first, trafficSchema.parse(moved));

    expect(merged).not.toBe(first);
    expect(merged.contacts[0]).toBe(first.contacts[0]);
    expect(merged.contacts[2]).toBe(first.contacts[2]);
    expect(merged.contacts[1]).not.toBe(first.contacts[1]);
  });

  /**
   * AND IT IS ACTUALLY INSTALLED, through the option the app configures rather than
   * through a direct call. A function that is correct and unwired fixes nothing.
   */
  it('is what a QueryClient configured this way does to its cache', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, structuralSharing: shareStructure } },
    });
    const key = ['traffic'];
    const fetchIt = () =>
      client.fetchQuery({
        queryKey: key,
        // A fresh parse every time, exactly as the real client does.
        queryFn: () => Promise.resolve(trafficSchema.parse(trafficBody)),
        staleTime: 0,
      });

    /**
     * READ OUT OF THE CACHE, NOT OFF `fetchQuery`.
     *
     * `fetchQuery` resolves with whatever the query function returned; the shared
     * value is what goes into the cache, and the cache is what every `useQuery` in
     * the app renders from. Asserting on the return value would be testing a
     * different object from the one the disc draws.
     */
    await fetchIt();
    const first = client.getQueryData(key);
    await fetchIt();
    expect(client.getQueryData(key)).toBe(first);
  });

  /* ── it is `replaceEqualDeep` plus one clause, and nothing else ── */

  /**
   * THE BLAST RADIUS, BOUNDED BY A TEST.
   *
   * This replaces the walker React Query uses for EVERY query in the app, so the
   * claim that matters is not "it handles Dates" — it is "it is otherwise exactly
   * what the library would have done". Anything else is a silent behaviour change
   * across the whole client.
   *
   * Checked against the library's own `replaceEqualDeep` on Date-free values: the
   * two must agree on the RESULT and, crucially, on the IDENTITY — which branch
   * was kept and which was replaced.
   */
  const sameAsLibrary = (before: unknown, after: unknown): void => {
    const mine = shareStructure(before, after);
    const theirs = replaceEqualDeep(before, after);
    expect(mine).toEqual(theirs);
    // Identity is the whole point: if the library kept the old branch, so must we.
    expect(mine === before).toBe(theirs === before);
  };

  it.each([
    ['identical objects', { a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } }],
    ['a changed leaf', { a: 1, b: { c: 2 } }, { a: 1, b: { c: 3 } }],
    ['a removed key', { a: 1, b: 2 }, { a: 1 }],
    ['an added key', { a: 1 }, { a: 1, b: 2 }],
    ['identical arrays', [1, 2, 3], [1, 2, 3]],
    ['a shorter array', [1, 2, 3], [1, 2]],
    ['a longer array', [1, 2], [1, 2, 3]],
    ['arrays of objects', [{ a: 1 }, { a: 2 }], [{ a: 1 }, { a: 9 }]],
    ['nulls', { a: null }, { a: null }],
    ['undefined values', { a: undefined }, { a: undefined }],
    ['a value that became undefined', { a: 1 }, { a: undefined }],
    ['a primitive against an object', 7, { a: 1 }],
    ['an object against a primitive', { a: 1 }, 7],
    ['nested empties', { a: {}, b: [] }, { a: {}, b: [] }],
    ['deep nesting', { a: { b: { c: { d: [1, { e: 2 }] } } } }, { a: { b: { c: { d: [1, { e: 2 }] } } } }],
    ['numbers that are not equal', { a: 0 }, { a: -0 }],
    ['NaN', { a: NaN }, { a: NaN }],
  ])('matches the library on %s', (_label, before, after) => {
    sameAsLibrary(before, after);
  });

  /**
   * AND IT DOES NOT DESCEND INTO ANYTHING THAT IS NOT PLAIN.
   *
   * A `Map`, a `Set` or a class instance walked as if it were a record would be
   * compared on its internal slots and rebuilt as a bare object — which is how a
   * "harmless" structural-sharing helper corrupts data. The library refuses for the
   * same reason, so this is also a same-as-library check.
   */
  it.each([
    ['a Map', new Map([['a', 1]]), new Map([['a', 1]])],
    ['a Set', new Set([1]), new Set([1])],
    ['a RegExp', /x/, /x/],
  ])('does not walk into %s', (_label, before, after) => {
    const merged = shareStructure(before, after);
    expect(merged).toBe(after);
    sameAsLibrary(before, after);
  });

  /** And it is off by default, which is the bug this whole file is about. */
  it('is not what an unconfigured QueryClient does', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const key = ['traffic'];
    const fetchIt = () =>
      client.fetchQuery({
        queryKey: key,
        queryFn: () => Promise.resolve(trafficSchema.parse(trafficBody)),
        staleTime: 0,
      });

    await fetchIt();
    const first = client.getQueryData(key);
    await fetchIt();
    expect(client.getQueryData(key)).not.toBe(first);
  });
});
