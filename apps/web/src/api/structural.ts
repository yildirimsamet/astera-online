/**
 * WHY EVERY PAYLOAD ON THIS CLIENT WAS A NEW OBJECT, EVERY TIME.
 *
 * React Query preserves identity across a refetch: it walks the old value against
 * the new one and, wherever a branch is deep-equal, hands back the OLD reference.
 * That is what makes `useMemo([data])` and `key={x.id}` cheap — a payload that has
 * not changed does not re-render anything, does not re-run a memo, and does not
 * rebuild a `BufferGeometry`.
 *
 * Its walker (`replaceEqualDeep`) recurses through plain arrays and plain objects
 * and treats everything else as a leaf compared by `===`. A `Date` is neither, so
 * two Dates for the same instant are never equal — and every schema in this client
 * parses its instants with `z.coerce.date()`, which mints fresh ones on every
 * parse. `arriveAt`, `departAt`, `startAt`, `endAt`, `createdAt`: there is a Date
 * on essentially every payload the disc draws from.
 *
 * So structural sharing was OFF in practice, everywhere, and had been since the
 * first schema. The effects were not subtle and had each been patched locally:
 *
 *   · `contacts`, `pending` and `runs` were brand-new arrays of brand-new objects
 *     on every refetch, so every `useMemo` keyed on them re-ran and every geometry
 *     built from one was rebuilt and the old one leaked (see `Fleets.tsx`).
 *   · `GalaxyCanvas`'s camera subject is a memo over six of those lists, so the rig
 *     re-framed itself several times a minute while the player sat still — D69,
 *     which is why `focusIdentity` exists.
 *   · The docblocks in `queries.ts` and `useArrivals` both reason from "React
 *     Query's structural sharing keeps it stable while the payload is unchanged",
 *     which was true of the library and false of this client's data.
 *
 * The fix is one function, installed once, rather than a rule every schema has to
 * remember. It is `replaceEqualDeep` with one clause added: a Date compared to a
 * Date is equal when it names the same instant, and then the OLD one is kept.
 *
 * IT IS NOT A CACHE AND IT DECIDES NOTHING. The server remains the only authority;
 * this only answers "is this byte-for-byte the value we already hold", and returns
 * the copy we already hold when it is. A payload that really changed is returned
 * whole, exactly as before.
 */

const isPlainArray = Array.isArray;

/**
 * A plain object, and nothing that merely looks like one.
 *
 * The prototype test is what keeps a `Date`, a `Map`, a `Set` or a class instance
 * out of the recursion — descending into one would compare its internal slots as
 * if they were data and, worse, would rebuild it as a bare object.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

/** `Object.hasOwn` rather than a loose reference to the prototype method. */
const hasKey = (o: object, key: string): boolean => Object.hasOwn(o, key);

/**
 * How deep to walk before giving up and taking the new value.
 *
 * The same guard the library uses, and for the same reason: a cyclic structure
 * would otherwise recurse until the stack goes. Nothing this client parses is
 * anywhere near it — the deepest payload is four levels — so reaching this is a
 * bug somewhere else, and taking the new value is the safe way to lose.
 */
const MAX_DEPTH = 500;

/**
 * The old value where it is deep-equal to the new one, the new value elsewhere.
 *
 * Installed as React Query's `structuralSharing`, so every query in the app gets
 * it. Exported on its own so it can be tested directly, which matters more than
 * usual here: what it guarantees is an IDENTITY, and an identity is invisible to
 * every assertion written with `toEqual`.
 */
export function shareStructure<T>(previous: unknown, next: T, depth = 0): T {
  if (previous === next) return previous as T;
  if (depth > MAX_DEPTH) return next;

  /**
   * THE CLAUSE THE LIBRARY IS MISSING, AND THE ONLY ONE.
   *
   * Two Dates for the same instant are the same fact. Keeping the OLD one is what
   * makes the object holding it deep-equal, which is what makes the array holding
   * THAT deep-equal, all the way up to the payload — one clause at the leaf is the
   * whole of the fix.
   *
   * Everything below this line is `replaceEqualDeep` transcribed, deliberately and
   * to the comparison operator. This function replaces the walker for EVERY query
   * in the app, so "it handles Dates" is not the claim that matters — "it is
   * otherwise exactly what the library would have done" is, and `structural.test.ts`
   * holds it against the library itself. Writing `Object.is` here instead of `===`
   * looked tidier and quietly changed the answer for `NaN` and for `-0`; the
   * conformance test is what found that.
   */
  if (previous instanceof Date && next instanceof Date) {
    return (previous.getTime() === next.getTime() ? previous : next) as T;
  }

  const array = isPlainArray(previous) && isPlainArray(next);
  if (!array && !(isPlainObject(previous) && isPlainObject(next))) return next;

  const previousKeys = array ? (previous as unknown[]) : Object.keys(previous as object);
  const nextKeys = array ? (next as unknown[]) : Object.keys(next as object);
  const previousSize = previousKeys.length;
  const nextSize = nextKeys.length;

  const merged: Record<string, unknown> = array ? (new Array(nextSize) as never) : {};
  let equal = 0;

  for (let i = 0; i < nextSize; i += 1) {
    const key = array ? String(i) : (nextKeys[i] as string);
    const before = (previous as Record<string, unknown>)[key];
    const after = (next as Record<string, unknown>)[key];

    if (before === after) {
      merged[key] = before;
      /**
       * A key that is ABSENT from the old value must not count towards "nothing
       * changed", even when reading it yields the same `undefined` — otherwise a
       * payload that gained a key would be handed back as the one that lacked it.
       */
      if (array ? i < previousSize : hasKey(previous as object, key)) equal += 1;
      continue;
    }

    // A leaf, or a pair the walk cannot descend into. Take the new one.
    if (
      before === null ||
      after === null ||
      typeof before !== 'object' ||
      typeof after !== 'object'
    ) {
      merged[key] = after;
      continue;
    }

    // Both are objects — which includes two Dates, handled at the top of the call.
    const kept = shareStructure(before, after, depth + 1);
    merged[key] = kept;
    if (kept === before) equal += 1;
  }

  return (previousSize === nextSize && equal === previousSize ? previous : merged) as T;
}
