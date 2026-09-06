/**
 * WHAT A CRASH LEAVES BEHIND, SO THE NEXT ONE CAN BE FIXED RATHER THAN GUESSED AT.
 *
 * Owner instruction, on a report that a world tap turns the screen black: *"hem
 * sorun veya sorunlar tam olarak ne ve neden kaynaklanıyor önce bilelim."* A
 * boundary that only stops the blank screen answers half of that. This is the
 * other half — the four facts that cannot be recovered afterwards and that decide
 * what the fix even is:
 *
 *   WHAT threw, with its type. `TypeError: … reading 'atk'` and
 *   `RangeError: Invalid time value` are two different bugs in two different
 *   files, and the type is most of the difference.
 *   WHERE, twice: the JavaScript stack and React's component stack. In a
 *   production build the names are minified, so the component stack is the
 *   weaker of the two — but the MESSAGE is a runtime string and survives
 *   minification intact, which is why it leads.
 *   WHICH DEVICE, and at what size. The standing question is whether one phone
 *   is failing or every phone is; a report without an agent cannot answer it.
 *   WHEN, as an absolute instant, so a report can be lined up against the
 *   server's own logs.
 *
 * NO DEPENDENCIES, AND THAT IS DELIBERATE. This module runs at the one moment the
 * application has already proven it can fail. It imports nothing, parses by hand
 * rather than through Zod, and every storage access is wrapped — the same lesson
 * `lib/accordion.ts` learned for a chevron, where a private window or a browser
 * set to block site data throws on the ACCESS itself. A reporter that throws
 * while describing a throw would restore the blank screen it exists to prevent.
 */

/** One key, so a device's whole crash history is one read and one write. */
export const CRASH_KEY = 'astera.crash.log';

/**
 * How many are kept.
 *
 * Enough to show a repeat — the same message four times is a different bug from
 * four different messages — and few enough that a stack trace apiece cannot fill
 * a storage quota somebody else is using.
 */
export const CRASH_LIMIT = 5;

export interface CrashRecord {
  /** ISO instant, absolute, so it lines up with the server's own log. */
  readonly at: string;
  /** `Type: message`, or the raw value for anything that was not an Error. */
  readonly message: string;
  readonly stack: string | null;
  readonly componentStack: string | null;
  readonly agent: string | null;
  /** `375x812`. Which phone, in the one number the layout is budgeted against. */
  readonly viewport: string | null;
}

/**
 * @param error whatever was thrown. `unknown`, because `throw 'string'` and
 *   `throw null` are both legal and both happen in libraries we do not own.
 * @param componentStack React's own trace, available only in `componentDidCatch`.
 */
export function describeCrash(
  error: unknown,
  componentStack: string | null,
  now: Date = new Date(),
): CrashRecord {
  return {
    at: now.toISOString(),
    message: messageOf(error),
    stack: error instanceof Error && typeof error.stack === 'string' ? error.stack : null,
    componentStack: text(componentStack),
    agent: typeof navigator === 'undefined' ? null : navigator.userAgent,
    viewport: typeof window === 'undefined'
      ? null
      : `${String(window.innerWidth)}x${String(window.innerHeight)}`,
  };
}

/**
 * THE HEADLINE, AND IT IS NEVER EMPTY.
 *
 * An `Error` with no message still has a type worth reading, and a thrown string
 * is already the sentence. Everything else is named as the anomaly it is rather
 * than being dressed up as an error — `Non-error thrown: null` says exactly what
 * happened, where a blank line would look like a reporting bug.
 */
function messageOf(error: unknown): string {
  if (error instanceof Error) {
    const name = text(error.name) ?? 'Error';
    const message = text(error.message);
    return message === null ? name : `${name}: ${message}`;
  }
  if (typeof error === 'string') return text(error) ?? 'Empty string thrown';
  try {
    return `Non-error thrown: ${stringify(error)}`;
  } catch {
    // A symbol, or an object with a hostile `toString`. The fact that something
    // was thrown is still worth recording.
    return 'Non-error thrown';
  }
}

/** `String()` on an `unknown`, kept in one place so its cast is stated once. */
function stringify(value: unknown): string {
  return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

/**
 * Newest first, because the crash a player is describing is the last one, and a
 * history that has to be read from the bottom is read wrong.
 */
export function rememberCrash(record: CrashRecord): void {
  try {
    const kept = [record, ...readCrashes()].slice(0, CRASH_LIMIT);
    window.localStorage.setItem(CRASH_KEY, JSON.stringify(kept));
  } catch {
    // A device that will not store the report still shows it on screen, and the
    // copy control is there precisely so this is not the only route out.
  }
}

export function readCrashes(): CrashRecord[] {
  try {
    const raw = window.localStorage.getItem(CRASH_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: CrashRecord[] = [];
    for (const entry of parsed) {
      const record = readRecord(entry);
      if (record !== null) out.push(record);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Rebuilt field by field rather than trusted as a shape.
 *
 * Anything in storage was written by an older build, or by a hand in a console,
 * or is not ours at all. A record missing its two required fields is not a
 * record; one missing an optional field is simply a record without it.
 */
function readRecord(value: unknown): CrashRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const at = text(Reflect.get(value, 'at'));
  const message = text(Reflect.get(value, 'message'));
  if (at === null || message === null) return null;
  return {
    at,
    message,
    stack: text(Reflect.get(value, 'stack')),
    componentStack: text(Reflect.get(value, 'componentStack')),
    agent: text(Reflect.get(value, 'agent')),
    viewport: text(Reflect.get(value, 'viewport')),
  };
}

/**
 * THE PASTEABLE BLOCK, AND IT IS NOT TRANSLATED.
 *
 * This text is not read by the player; it is pasted into a message to the person
 * who will fix it. A Turkish heading over a stack trace helps nobody and would
 * have to be understood twice. A part that is missing is left out entirely — an
 * empty heading reads as a second failure.
 */
export function crashReportText(record: CrashRecord): string {
  const lines = ['Astera crash report', record.at, record.message];
  if (record.agent !== null) lines.push(record.agent);
  if (record.viewport !== null) lines.push(`Viewport ${record.viewport}`);
  if (record.stack !== null) lines.push('', 'Stack', record.stack);
  if (record.componentStack !== null) lines.push('', 'Component stack', record.componentStack);
  return lines.join('\n');
}
