import { describe, expect, it } from 'vitest';
import { parseRadiationCommand } from '../src/cli/radiationCommand.js';

/**
 * THE OPERATOR'S RADIATION DOOR. Owner decision K4 (`plan.md` F9): no live season has a
 * cloud; the operator places test clouds from the command line, on a world or on a point
 * in space, lists them, and ends them. The parser is pure so the words it accepts are
 * pinned here; the service it calls holds the rules (ruleset gate, bounds).
 */

const SEASON = '11111111-1111-4111-8111-111111111111';
const PLANET = '22222222-2222-4222-8222-222222222222';
const MONUMENT = '33333333-3333-4333-8333-333333333333';

describe('pnpm radiation', () => {
  it('places an HP cloud on a monument without changing the legacy percentage command', () => {
    expect(parseRadiationCommand(['add', '--hp', '--season', SEASON, '--monument', MONUMENT,
      '--radius', '1000', '--intensity', '4', '--from', '2026-10-04T00:00:00Z'])).toEqual({
      command: 'addHp',
      input: {
        seasonId: SEASON, anchor: { kind: 'MONUMENT', monumentId: MONUMENT },
        radius: 1000, intensityHpPerMinute: 4,
        mode: 'EMIT', label: '',
        activeFrom: new Date('2026-10-04T00:00:00Z'),
      },
    });
  });

  it('places a cloud on a point in space', () => {
    expect(parseRadiationCommand(['add', '--season', SEASON, '--at', '1,-2.5,3', '--radius', '20',
      '--intensity', '0.5', '--label', 'Kestrel storm'])).toEqual({
      command: 'add',
      input: {
        seasonId: SEASON, anchor: { kind: 'ZONE', at: { x: 1, y: -2.5, z: 3 } },
        radius: 20, intensityPctPerMinute: 0.5, mode: 'EMIT', label: 'Kestrel storm',
      },
    });
  });

  it('places a shelter on a world, with its window', () => {
    expect(parseRadiationCommand(['add', '--season', SEASON, '--planet', PLANET, '--radius', '8', '--shelter',
      '--from', '2026-10-01T10:00:00Z', '--until', '2026-10-01T12:00:00Z'])).toEqual({
      command: 'add',
      input: {
        seasonId: SEASON, anchor: { kind: 'PLANET', planetId: PLANET },
        radius: 8, intensityPctPerMinute: 0, mode: 'SHELTER', label: '',
        activeFrom: new Date('2026-10-01T10:00:00Z'), activeUntil: new Date('2026-10-01T12:00:00Z'),
      },
    });
  });

  it('lists a season\'s clouds and ends one', () => {
    expect(parseRadiationCommand(['list', '--season', SEASON])).toEqual({ command: 'list', seasonId: SEASON });
    expect(parseRadiationCommand(['end', PLANET])).toEqual({ command: 'end', id: PLANET });
  });

  it('refuses what it cannot read, with the usage', () => {
    for (const argv of [
      [],
      ['blow-up'],
      ['add', '--season', SEASON, '--radius', '5', '--intensity', '1'],
      ['add', '--season', SEASON, '--at', '1,2,3', '--planet', PLANET, '--radius', '5', '--intensity', '1'],
      ['add', '--season', SEASON, '--at', '1,2', '--radius', '5', '--intensity', '1'],
      ['add', '--season', SEASON, '--at', '1,2,3', '--radius', 'wide', '--intensity', '1'],
      ['add', '--season', SEASON, '--at', '1,2,3', '--radius', '5'],
      ['add', '--season', SEASON, '--at', '1,2,3', '--radius', '5', '--intensity', '1', '--colour', 'green'],
      ['add', '--season', SEASON, '--at', '1,2,3', '--radius', '5', '--intensity', '1', '--from', 'tomorrow'],
      ['list'],
      ['end', 'not-an-id'],
    ]) {
      expect(() => parseRadiationCommand(argv), argv.join(' ')).toThrow(/usage/i);
    }
  });
});
