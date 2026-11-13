import type { AnalyticsProperties } from '../../api/analyticsSchemas.js';

/**
 * Where an error was thrown and what type it was, never its message.
 *
 * The production bundle is minified and ships no source map, so a component name reads `Xe`. The top
 * stack frame (`chunk:line:column`) of a known build revision maps back through a rebuild of that
 * revision with source maps. Both fields are squeezed into the telemetry code allowlist.
 */
export function errorWhere(error: unknown, at?: { filename?: string; lineno?: number; colno?: number }): Pick<AnalyticsProperties, 'subject' | 'variant'> {
  const variant = error instanceof Error ? safe(error.name) || 'Error' : error === null && at ? 'unknown' : typeof error;
  const frame = error instanceof Error ? topFrame(error.stack) : null;
  const subject = frame ?? (at?.filename ? `${base(at.filename)}:${String(at.lineno ?? 0)}:${String(at.colno ?? 0)}` : null);
  return subject ? { subject: safe(subject), variant } : { variant };
}

/**
 * `at Xe (url:12:34)`, `at url:12:34` (Chromium) and `Xe@url:12:34` (Firefox, Safari). Only frame
 * lines are read: Chromium's first line is the message, and a message must never become a location.
 */
function topFrame(stack: string | undefined): string | null {
  for (const line of stack?.split('\n') ?? []) {
    const match = /^\s*at\s.*?\(?([^\s()]+):(\d+):(\d+)\)?\s*$/u.exec(line) ?? /^[^\s@]*@(\S+):(\d+):(\d+)\s*$/u.exec(line);
    if (match) return `${base(match[1] ?? '')}:${match[2] ?? '0'}:${match[3] ?? '0'}`;
  }
  return null;
}

const base = (url: string): string => url.replace(/[?#].*$/u, '').split('/').pop() ?? '';
const safe = (value: string): string => value.replace(/[^a-zA-Z0-9_.:-]/gu, '_').slice(-128);
