import { STARTER, canTakePart, type Vec3 } from '@astera/rules';

interface World { position: Vec3; hasPart?: boolean | undefined }
interface Field { at: Vec3; hasPart?: boolean | undefined }

/** Every place this ship knows holds a thrust part. The server sends the flag to no one else. */
export const partMarks = (worlds: readonly World[] | undefined, fields: readonly Field[] | undefined): Vec3[] => [
  ...(worlds ?? []).filter(world => world.hasPart).map(world => world.position),
  ...(fields ?? []).filter(field => field.hasPart).map(field => field.at),
];

/**
 * WHETHER A WRECK IS WORTH A PROBE: only to a ship hunting a part, and only on a standing wreck. A
 * battle's debris never holds one and is gone within the hour, which is how the card can tell them apart.
 */
export const wreckWorthProbing = (ship: { features: readonly string[]; parts: number } | undefined, minutesLeft: number): boolean =>
  ship !== undefined && ship.features.includes('drive') && canTakePart(ship.parts) && minutesLeft > STARTER.battleDebris.decayMinutes;

export const partsSeen = (worlds: readonly World[] | undefined, fields: readonly Field[] | undefined): number =>
  partMarks(worlds, fields).length;
