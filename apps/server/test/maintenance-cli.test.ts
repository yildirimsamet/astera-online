import { describe, expect, it } from 'vitest';
import { parseMaintenanceCommand } from '../src/cli/maintenanceCommand.js';

/**
 * THE OPERATOR'S MAINTENANCE DOOR. Scaling plan F0.9: a window is planned from the
 * command line a day ahead, listed, and cancelled. The parser is pure so the words it
 * accepts are pinned here; the service holds the rules (notice, length, clearances).
 */
const ID = '11111111-1111-4111-8111-111111111111';

describe('pnpm maintenance', () => {
  it('plans a window from an instant and a length', () => {
    expect(parseMaintenanceCommand(['schedule', '--at', '2026-11-02T00:30:00Z', '--minutes', '45']))
      .toEqual({ command: 'schedule', startsAt: new Date('2026-11-02T00:30:00Z'), minutes: 45 });
  });

  it('lists and cancels', () => {
    expect(parseMaintenanceCommand(['list'])).toEqual({ command: 'list' });
    expect(parseMaintenanceCommand(['cancel', ID])).toEqual({ command: 'cancel', id: ID });
  });

  it('refuses an instant without a zone, a fractional length, a bad id and unknown words', () => {
    expect(() => parseMaintenanceCommand(['schedule', '--at', '2026-11-02T00:30', '--minutes', '45'])).toThrow(/--at/);
    expect(() => parseMaintenanceCommand(['schedule', '--at', '2026-11-02T00:30:00Z', '--minutes', '4.5'])).toThrow(/--minutes/);
    expect(() => parseMaintenanceCommand(['schedule', '--minutes', '45'])).toThrow(/--at/);
    expect(() => parseMaintenanceCommand(['cancel', 'nope'])).toThrow(/id/);
    expect(() => parseMaintenanceCommand(['open'])).toThrow(/usage/);
    expect(() => parseMaintenanceCommand([])).toThrow(/usage/);
  });
});
