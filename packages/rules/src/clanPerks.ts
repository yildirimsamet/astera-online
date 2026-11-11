import { CLAN, clanAidTravelMinutes } from './clan.js';
import { CLAN_SUPPORT } from './clanSupport.js';
import { CLAN_LEVEL_MAX, CLAN_LEVEL_MIN } from './clanWar.js';
import type { Resources } from './types.js';

/**
 * KLAN PERKLERİ — THE PERK LADDER ON THE CLAN LEVEL. F2, owner decisions 2026-11-10
 * (`docs/klan-perkleri-f2-plan-2026-11-10.md`).
 *
 * The clan level used to buy one thing, the joint war's Clan Hangar. It now also unlocks one
 * perk per rung, automatically, the moment the leader raises it. None touches a combat
 * statistic: speed, time, information and economy move; attack, armour and shields do not.
 *
 * ONE TABLE. Every perk reads the rung that set it, so a moved rung moves every reader at once.
 */
export type ClanPerkId = 'CORRIDOR' | 'ALARM' | 'STATION' | 'REFINERY' | 'BANNER';

export interface ClanPerkRung {
  level: number;
  perk: ClanPerkId;
  /**
   * CORRIDOR: the first-leg speed multiplier. STATION: hours a wave may stand. REFINERY:
   * production share per active member. ALARM and BANNER: 1 (on).
   */
  value: number;
}

export const CLAN_PERK_LADDER: readonly ClanPerkRung[] = [
  // Owner: support is how a newcomer warms to the game and the group — so from founding, unpaid.
  { level: 1, perk: 'CORRIDOR', value: 2 },
  { level: 2, perk: 'ALARM', value: 1 },
  { level: 3, perk: 'CORRIDOR', value: 3 },
  { level: 4, perk: 'STATION', value: 18 },
  { level: 5, perk: 'CORRIDOR', value: 4 },
  { level: 6, perk: 'REFINERY', value: 0.01 },
  { level: 7, perk: 'CORRIDOR', value: 5 },
  { level: 8, perk: 'STATION', value: 24 },
  { level: 9, perk: 'REFINERY', value: 0.02 },
  { level: 10, perk: 'BANNER', value: 1 },
];

function checkedLevel(level: number): number {
  if (!Number.isSafeInteger(level) || level < CLAN_LEVEL_MIN || level > CLAN_LEVEL_MAX) {
    throw new RangeError(`clan level must be an integer between ${CLAN_LEVEL_MIN} and ${CLAN_LEVEL_MAX}`);
  }
  return level;
}

/** Every rung this level has reached, lowest first. */
export function clanPerksUnlockedAt(level: number): readonly ClanPerkRung[] {
  const at = checkedLevel(level);
  return CLAN_PERK_LADDER.filter((rung) => rung.level <= at);
}

/** The highest rung of one perk this level has reached, or null. */
function topRung(level: number, perk: ClanPerkId): ClanPerkRung | null {
  return clanPerksUnlockedAt(level).filter((rung) => rung.perk === perk).at(-1) ?? null;
}

/**
 * KLAN KORİDORU. The speed of the FIRST leg of every flight between clanmates — aid, a support
 * wave, a joint-war wave to the staging world (owner 3). It replaces the aid lane's ×1.1 on that
 * leg; every return keeps the lane (`clanAidTravelMinutes`) and the joint strike is untouched.
 */
export const clanCorridorMultiplier = (level: number): number => topRung(level, 'CORRIDOR')?.value ?? 1;

/** The first leg's minutes, from the ordinary flight's. */
export function clanCorridorMinutes(ordinaryMinutes: number, level: number): number {
  const multiplier = clanCorridorMultiplier(level);
  // A fleet that cannot fly never lands, here as on the ×1.1 lane; its caller refuses it.
  if (ordinaryMinutes === Number.POSITIVE_INFINITY) return ordinaryMinutes;
  return Number.isFinite(ordinaryMinutes) ? Math.max(0, ordinaryMinutes) / multiplier : 0;
}

/**
 * THE FIRST LEG OF A CLANMATE FLIGHT. A clan of a season dealt before the joint war has no level
 * (null) and keeps the aid lane it was dealt; every perk is new with the level.
 */
export const clanFirstLegMinutes = (ordinaryMinutes: number, level: number | null): number =>
  level === null ? clanAidTravelMinutes(ordinaryMinutes) : clanCorridorMinutes(ordinaryMinutes, level);

/** KLAN ALARMI: a member's radar warning reaches every mature clanmate. */
export const clanAlarmUnlocked = (level: number): boolean => topRung(level, 'ALARM') !== null;

/** UZUN NÖBET: how long a support wave may stand at a clanmate's world. */
export const clanStationHours = (level: number): number =>
  topRung(level, 'STATION')?.value ?? CLAN_SUPPORT.stationHours;

/**
 * ORTAK OCAK (Klan Rafinerisi V1). Each member's production grows by the rung's share for every
 * member — themselves included — who gave an order in the last 24 hours; one share per seat.
 */
export function clanRefineryBonus(level: number, activeMembers: number): number {
  const share = topRung(level, 'REFINERY')?.value ?? 0;
  const members = Number.isFinite(activeMembers)
    ? Math.min(CLAN.maxMembers, Math.max(0, Math.floor(activeMembers)))
    : 0;
  return share * members;
}

/** How long a support wave may stand, for a clan that may have no level (old seasons: 12 h). */
export const clanSupportStationHours = (level: number | null): number =>
  level === null ? CLAN_SUPPORT.stationHours : clanStationHours(level);

/** E4 ZAFER KASASI: the purse's share of the field a won supported defence leaves (owner). */
export const CLAN_VICTORY_WRECK_SHARE = 0.5;

/**
 * Split a won supported defence's wreck between the clan purse and orbit. The purse takes half
 * of each resource in whole units, never past `room` (what the purse may still hold before the
 * next rung's price; null when it holds nothing more); whatever it cannot take stays in the field.
 */
export function clanVictoryWreck(field: Resources, room: Resources | null): { purse: Resources; field: Resources } {
  const take = (key: keyof Resources): number => room === null
    ? 0
    : Math.max(0, Math.min(Math.floor(field[key] * CLAN_VICTORY_WRECK_SHARE), Math.floor(room[key])));
  const purse = { alloy: take('alloy'), crystal: take('crystal'), deuterium: take('deuterium') };
  return {
    purse,
    field: { alloy: field.alloy - purse.alloy, crystal: field.crystal - purse.crystal, deuterium: field.deuterium - purse.deuterium },
  };
}

/**
 * THE CLAN TAG'S COLOUR (owner 2026-11-10): bronze from level 3, silver from 6, gold at 10 — the
 * Golden Banner. Public wherever the tag is drawn; the tier is sent, never the level behind it.
 */
export type ClanTagTier = 'BRONZE' | 'SILVER' | 'GOLD';

export function clanTagTier(level: number | null): ClanTagTier | null {
  if (level === null) return null;
  if (level >= CLAN_LEVEL_MAX) return 'GOLD';
  if (level >= 6) return 'SILVER';
  if (level >= 3) return 'BRONZE';
  return null;
}
