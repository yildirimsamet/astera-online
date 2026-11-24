import { inArray, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { dockLocation, isDockLocation, type WorldBody } from '@astera/rules';

/**
 * WHERE A UNIT ROW STANDS — the one place that knows the spellings of `units.location`.
 * Ay entegrasyon planı §3 ilke 1, §6.1 (F2a).
 *
 * A row is exactly one of:
 * · STANDING on a body of its world: `home` (the planet) or `moon`;
 * · DOCKED in the planet's Repair Station: `dock:<lot>`;
 * · HOPPING between the planet and its moon: `hop:<move>`;
 * · AWAY on anything else (a mission id, a support wave, a monument wave, a clan war line).
 *
 * Before moons, "not home and not a dock" meant "on a mission", and that test was written out
 * by hand in a dozen services. A second standing body breaks every one of those copies at once,
 * so they all read from here, and `unit-location-guard.test.ts` keeps raw spellings out.
 */
export const PLANET_LOCATION = 'home';
export const MOON_LOCATION = 'moon';
const HOP_PREFIX = 'hop:';

export type StandingLocation = typeof PLANET_LOCATION | typeof MOON_LOCATION;

export const bodyLocation = (body: WorldBody): StandingLocation =>
  body === 'MOON' ? MOON_LOCATION : PLANET_LOCATION;

export const isStanding = (location: string): location is StandingLocation =>
  location === PLANET_LOCATION || location === MOON_LOCATION;

export const isDock = (location: string): boolean => isDockLocation(location);

export const hopLocation = (moveId: string): string => `${HOP_PREFIX}${moveId}`;
export const isHop = (location: string): boolean => location.startsWith(HOP_PREFIX);

/** Owed a landing somewhere: neither standing, nor docked, nor between its own two bodies. */
export const isAway = (location: string): boolean =>
  !isStanding(location) && !isDock(location) && !isHop(location);

/** `isStanding` for a query: on the planet or on the moon. */
export const standingSql = (column: AnyPgColumn): SQL => inArray(column, [PLANET_LOCATION, MOON_LOCATION]);

/** `isAway` for a query: the row owes a landing somewhere. */
export const awaySql = (column: AnyPgColumn): SQL =>
  sql`(${column} not in (${PLANET_LOCATION}, ${MOON_LOCATION}) and ${column} not like ${dockLocation('%')} and ${column} not like ${`${HOP_PREFIX}%`})`;
