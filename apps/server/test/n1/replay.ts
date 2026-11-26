import { isSchema, type Recorded } from './record.js';

export interface Failure { module: string; name: string; path: string; message: string; count: number }
export interface ReplayResult { passed: number; failures: Failure[]; skipped: string[] }

/**
 * Reads every recorded payload with the live client's schemas. A module or export the live client
 * lacks is skipped: that client never asks for it. Failures fold by schema and field, so a broken
 * field reads once with how many payloads it broke.
 */
export function replay(lines: readonly Recorded[], load: (module: string) => Record<string, unknown> | undefined): ReplayResult {
  const failures = new Map<string, Failure>();
  const skipped = new Set<string>();
  let passed = 0;
  for (const { module, name, value } of lines) {
    const exports = load(module);
    if (!exports) { skipped.add(module); continue; }
    const schema = exports[name];
    if (!isSchema(schema)) { skipped.add(`${module}.${name}`); continue; }
    const result = schema.safeParse(value);
    if (result.success) { passed += 1; continue; }
    for (const issue of result.error.issues) {
      const path = issue.path.join('.');
      const key = `${module}.${name}:${path}`;
      const known = failures.get(key);
      if (known) known.count += 1;
      else failures.set(key, { module, name, path, message: issue.message, count: 1 });
    }
  }
  return { passed, failures: [...failures.values()], skipped: [...skipped].sort() };
}
