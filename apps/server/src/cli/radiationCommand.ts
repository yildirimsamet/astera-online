import { z } from 'zod';
import type { HpRadiationSourceInput, RadiationSourceInput } from '../services/radiation.js';

/**
 * THE OPERATOR'S RADIATION DOOR, AS WORDS. Owner decision K4 (`plan.md` F9).
 *
 * Pure, so the grammar is pinned by a test; `cli/radiation.ts` only runs it. The bounds
 * of a source (radius, intensity) are the service's to refuse — this reads the words.
 */

export const RADIATION_USAGE = `usage:
  pnpm radiation add --season <id> (--planet <id> | --at x,y,z) --radius <r>
                     (--intensity <%/min> | --shelter) [--from <iso>] [--until <iso>] [--label <text>]
  pnpm radiation add --hp --season <id> (--monument <id> | --planet <id> | --at x,y,z) --radius <r>
                     (--intensity <hp/min> | --shelter) [--from <iso>] [--until <iso>] [--label <text>]
  pnpm radiation list --season <id>
  pnpm radiation end <source id>`;

export type RadiationCommand =
  | { command: 'add'; input: RadiationSourceInput }
  | { command: 'addHp'; input: HpRadiationSourceInput }
  | { command: 'list'; seasonId: string }
  | { command: 'end'; id: string };

function refuse(why: string): never {
  throw new Error(`${why}\n${RADIATION_USAGE}`);
}

const uuid = z.string().uuid();
const VALUE_FLAGS = new Set(['--season', '--planet', '--monument', '--at', '--radius', '--intensity', '--from', '--until', '--label']);
const SWITCHES = new Set(['--shelter', '--hp']);

function flagsOf(argv: readonly string[]): Map<string, string | true> {
  const flags = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === undefined) break;
    if (SWITCHES.has(flag)) {
      flags.set(flag, true);
    } else if (VALUE_FLAGS.has(flag)) {
      const value = argv[i + 1];
      if (value === undefined) refuse(`${flag} needs a value`);
      flags.set(flag, value);
      i++;
    } else {
      refuse(`unknown argument ${flag}`);
    }
  }
  return flags;
}

const text = (flags: Map<string, string | true>, flag: string): string | undefined => {
  const value = flags.get(flag);
  return typeof value === 'string' ? value : undefined;
};

const number = (raw: string, flag: string): number => {
  const value = Number(raw);
  if (raw.trim() === '' || !Number.isFinite(value)) refuse(`${flag} must be a number`);
  return value;
};

const date = (raw: string, flag: string): Date => {
  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) refuse(`${flag} must be an ISO time`);
  return value;
};

const idOf = (raw: string | undefined, what: string): string => {
  const parsed = uuid.safeParse(raw);
  if (!parsed.success) refuse(`${what} must be an id`);
  return parsed.data;
};

export function parseRadiationCommand(argv: readonly string[]): RadiationCommand {
  const [command, ...rest] = argv;
  if (command === 'end') {
    if (rest.length !== 1) refuse('end takes one source id');
    return { command: 'end', id: idOf(rest[0], 'the source') };
  }
  if (command === 'list') {
    return { command: 'list', seasonId: idOf(text(flagsOf(rest), '--season'), '--season') };
  }
  if (command !== 'add') return refuse(command === undefined ? 'no command' : `unknown command ${command}`);

  const flags = flagsOf(rest);
  const seasonId = idOf(text(flags, '--season'), '--season');
  const planet = text(flags, '--planet');
  const monument = text(flags, '--monument');
  const at = text(flags, '--at');
  const hp = flags.get('--hp') === true;
  if (hp) {
    if ([planet, monument, at].filter((value) => value !== undefined).length !== 1) {
      refuse('HP source needs exactly one of --monument, --planet and --at');
    }
    let anchor: HpRadiationSourceInput['anchor'];
    if (monument !== undefined) anchor = { kind: 'MONUMENT', monumentId: idOf(monument, '--monument') };
    else if (planet !== undefined) anchor = { kind: 'PLANET', planetId: idOf(planet, '--planet') };
    else {
      const parts = (at ?? '').split(',');
      if (parts.length !== 3) refuse('--at takes x,y,z');
      const [x = '', y = '', z = ''] = parts;
      anchor = { kind: 'ZONE', at: { x: number(x, '--at'), y: number(y, '--at'), z: number(z, '--at') } };
    }
    const radius = text(flags, '--radius');
    if (radius === undefined) refuse('--radius is required');
    const shelter = flags.get('--shelter') === true;
    const intensity = text(flags, '--intensity');
    if (!shelter && intensity === undefined) refuse('an HP cloud needs --intensity (or --shelter)');
    const from = text(flags, '--from');
    const until = text(flags, '--until');
    return {
      command: 'addHp',
      input: {
        seasonId, anchor, radius: number(radius, '--radius'),
        intensityHpPerMinute: intensity === undefined ? 0 : number(intensity, '--intensity'),
        mode: shelter ? 'SHELTER' : 'EMIT', label: text(flags, '--label') ?? '',
        ...(from === undefined ? {} : { activeFrom: date(from, '--from') }),
        ...(until === undefined ? {} : { activeUntil: date(until, '--until') }),
      },
    };
  }
  if ((planet === undefined) === (at === undefined)) refuse('name exactly one of --planet and --at');
  let anchor: RadiationSourceInput['anchor'];
  if (planet !== undefined) {
    anchor = { kind: 'PLANET', planetId: idOf(planet, '--planet') };
  } else if (at !== undefined) {
    const parts = at.split(',');
    if (parts.length !== 3) refuse('--at takes x,y,z');
    const [x = '', y = '', z = ''] = parts;
    anchor = { kind: 'ZONE', at: { x: number(x, '--at'), y: number(y, '--at'), z: number(z, '--at') } };
  } else {
    refuse('name exactly one of --planet and --at');
  }
  const radius = text(flags, '--radius');
  if (radius === undefined) return refuse('--radius is required');
  const shelter = flags.get('--shelter') === true;
  const intensity = text(flags, '--intensity');
  if (!shelter && intensity === undefined) refuse('a cloud needs --intensity (or --shelter)');
  const from = text(flags, '--from');
  const until = text(flags, '--until');
  return {
    command: 'add',
    input: {
      seasonId,
      anchor,
      radius: number(radius, '--radius'),
      intensityPctPerMinute: intensity === undefined ? 0 : number(intensity, '--intensity'),
      mode: shelter ? 'SHELTER' : 'EMIT',
      label: text(flags, '--label') ?? '',
      ...(from === undefined ? {} : { activeFrom: date(from, '--from') }),
      ...(until === undefined ? {} : { activeUntil: date(until, '--until') }),
    },
  };
}
