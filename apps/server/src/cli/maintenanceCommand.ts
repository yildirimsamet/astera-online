import { z } from 'zod';

/**
 * THE OPERATOR'S MAINTENANCE DOOR, AS WORDS. Scaling plan F0.9.
 *
 * Pure, so the grammar is pinned by a test; `cli/maintenance.ts` only runs it. The
 * notice, length and clearances are the service's to refuse — this reads the words.
 */

export const MAINTENANCE_USAGE = `usage:
  pnpm maintenance schedule --at <iso instant with zone> --minutes <n>
  pnpm maintenance list
  pnpm maintenance cancel <window id>`;

export type MaintenanceCommand =
  | { command: 'schedule'; startsAt: Date; minutes: number }
  | { command: 'list' }
  | { command: 'cancel'; id: string };

function refuse(why: string): never {
  throw new Error(`${why}\n${MAINTENANCE_USAGE}`);
}

const instant = z.string().datetime({ offset: true });
const minutes = z.string().regex(/^\d+$/).transform(Number);
const uuid = z.string().uuid();

export function parseMaintenanceCommand(argv: readonly string[]): MaintenanceCommand {
  const [command, ...rest] = argv;
  if (command === 'list' && rest.length === 0) return { command: 'list' };
  if (command === 'cancel' && rest.length === 1) {
    const id = uuid.safeParse(rest[0]);
    if (!id.success) refuse('cancel needs a window id');
    return { command: 'cancel', id: id.data };
  }
  if (command === 'schedule') {
    const flags = new Map<string, string>();
    for (let i = 0; i < rest.length; i += 2) {
      const [flag, value] = [rest[i]!, rest[i + 1]];
      if ((flag !== '--at' && flag !== '--minutes') || value === undefined) refuse(`unknown argument ${flag}`);
      flags.set(flag, value);
    }
    const at = instant.safeParse(flags.get('--at'));
    if (!at.success) refuse('--at needs an ISO instant with a zone, e.g. 2026-11-02T00:30:00Z');
    const length = minutes.safeParse(flags.get('--minutes'));
    if (!length.success) refuse('--minutes needs a whole number');
    return { command: 'schedule', startsAt: new Date(at.data), minutes: length.data };
  }
  return refuse('unknown command');
}
