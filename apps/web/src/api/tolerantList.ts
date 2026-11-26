import { z } from 'zod';

type Reporter = (list: string, path: string) => void;

let report: Reporter = () => undefined;
const reported = new Set<string>();
let strict = false;

/** Where a dropped row is told (main.tsx: Sentry). Tests and the server's contract tests leave it silent. */
export function onDroppedListItem(reporter: Reporter): void {
  report = reporter;
  reported.clear();
}

/**
 * Strict: an unreadable row fails the parse at its place, as a plain array would. The server's contract
 * tests and the N-1 replay turn it on, or a row the client cannot read would pass them unseen.
 */
export function strictLists(on: boolean): void {
  strict = on;
}

/**
 * A server list read row by row (OTA F4, canlı güncelleme planı §5.3). A row this build cannot read —
 * a new kind, a reshaped field from a server one deploy ahead — is left out, and told once per list
 * and field; the rest of the screen still works. The list itself must still be a list: a broken
 * page fails as before, so nothing goes missing without a trace.
 */
export function tolerantList<T extends z.ZodTypeAny>(item: T, list: string) {
  const rows = z.array(z.unknown()).transform((values, context) => values.flatMap((row, index) => {
    const parsed = item.safeParse(row);
    if (parsed.success) return [parsed.data as z.output<T>];
    if (strict) {
      for (const issue of parsed.error.issues) context.addIssue({ ...issue, path: [index, ...issue.path] });
      return [];
    }
    const path = parsed.error.issues[0]?.path.join('.') ?? '';
    const key = `${list}:${path}`;
    if (!reported.has(key)) { reported.add(key); report(list, path); }
    return [];
  }));
  // The row schema stays reachable as on an array, for code that reads one row on its own.
  return Object.assign(rows, { element: item });
}
