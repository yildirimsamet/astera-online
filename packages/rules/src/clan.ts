import { ALL_HULLS, HULLS, MOBILE_HULLS, fleetEntries } from './hulls.js';
import type { Fleet, Resources } from './types.js';

/** The complete, deliberately bounded clan ruleset. D114. */
export const CLAN = {
  maxMembers: 5,
  founderCoreLevel: 7,
  creationCost: { alloy: 5_000, crystal: 3_000, deuterium: 0 },
  nameMinChars: 3,
  nameMaxChars: 24,
  tagMinChars: 2,
  tagMaxChars: 5,
  descriptionMaxChars: 160,
  adaptationMinutes: 12 * 60,
  membershipLockMinutes: 24 * 60,
  ceasefireMinutes: 24 * 60,
  requestExpiryMinutes: 24 * 60,
  maxPlayerApplications: 3,
  maxClanApplications: 5,
  maxClanInvitations: 5,
  maxLeaderInvitationsPerDay: 10,
  aidPolicyCooldownMinutes: 12 * 60,
  aidWindowMinutes: 24 * 60,
  aidProductionHours: 4,
  aidDeuteriumCapacityShare: 0.20,
  aidSpeedMultiplier: 1.10,
  extraAidBays: 1,
  attackWindowMinutes: 12 * 60,
  attackLimit: 5,
  raidLootShare: 0.10,
  minimumLootRoster: 2,
  purseProductionHours: 2,
  purseDeuteriumCapacityShare: 0.10,
  maxProtectedStorageShare: 0.49,
  chatMaxChars: 280,
  chatBurst: 5,
  chatWindowSeconds: 10,
} as const;

export const CLAN_TRANSFERABLE_HULLS = MOBILE_HULLS;

const RESOURCE_KEYS = ['alloy', 'crystal', 'deuterium'] as const;

const finiteFloor = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const resourceMap = (
  map: (key: keyof Resources) => number,
): Resources => ({
  alloy: finiteFloor(map('alloy')),
  crystal: finiteFloor(map('crystal')),
  deuterium: finiteFloor(map('deuterium')),
});

/** NFKC is the display form persisted for a clan name. */
export function normaliseClanName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
}

/**
 * The comparison key deliberately folds accents and Turkish dotted/dotless I.
 * It prevents visually equivalent names taking two rows without changing display text.
 */
export function clanNameKey(value: string): string {
  return normaliseClanName(value)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/ı/gu, 'i');
}

const RESERVED_CLAN_NAME_KEYS = new Set([
  'admin',
  'administration',
  'astera',
  'destek',
  'moderator',
  'staff',
  'support',
  'system',
  'sistem',
  'yonetim',
]);

export function clanNameIsReserved(value: string): boolean {
  return RESERVED_CLAN_NAME_KEYS.has(clanNameKey(value));
}

export function clanNameIsValid(value: string): boolean {
  const name = normaliseClanName(value);
  const length = Array.from(name).length;
  return length >= CLAN.nameMinChars
    && length <= CLAN.nameMaxChars
    && !/[\p{Cc}<>]/u.test(name)
    && !clanNameIsReserved(name);
}

export function normaliseClanTag(value: string): string {
  return value.normalize('NFKC').trim().toUpperCase();
}

export function clanTagIsValid(value: string): boolean {
  const tag = normaliseClanTag(value);
  return tag.length >= CLAN.tagMinChars
    && tag.length <= CLAN.tagMaxChars
    && /^[A-Z0-9]+$/u.test(tag);
}

/** Only the six ordinary mobile hulls may change owner through clan aid. */
export function clanTransferFleetIsValid(fleet: Fleet): boolean {
  let count = 0;
  for (const id of ALL_HULLS) {
    const quantity = fleet[id] ?? 0;
    if (!Number.isInteger(quantity) || quantity < 0) return false;
    if (quantity === 0) continue;
    if (!(CLAN_TRANSFERABLE_HULLS as readonly string[]).includes(id)) return false;
    count += quantity;
  }
  return count > 0;
}

/** Runner cargo is deliberately excluded; only Haulers carry resources on clan aid. */
export function clanTransferCargoCapacity(fleet: Fleet): number {
  return finiteFloor(fleet.HAULER ?? 0) * HULLS.HAULER.cargo;
}

/** Full per-resource commitment: cargo plus the construction cost of every gifted hull. */
export function clanAidValue(fleet: Fleet, cargo: Resources): Resources {
  const value: Resources = resourceMap((key) => cargo[key]);
  for (const [id, quantity] of fleetEntries(fleet)) {
    const hull = HULLS[id];
    value.alloy += quantity * hull.alloy;
    value.crystal += quantity * hull.crystal;
    value.deuterium += quantity * hull.deuterium;
  }
  return resourceMap((key) => value[key]);
}

export interface ClanAidAllowanceInput {
  alloyPerHour: number;
  crystalPerHour: number;
  deuteriumCapacity: number;
}

/** Receiver-wide allowance for the rolling 24-hour commitment window. */
export function clanAidAllowance(input: ClanAidAllowanceInput): Resources {
  return {
    alloy: finiteFloor(input.alloyPerHour * CLAN.aidProductionHours),
    crystal: finiteFloor(input.crystalPerHour * CLAN.aidProductionHours),
    deuterium: finiteFloor(input.deuteriumCapacity * CLAN.aidDeuteriumCapacityShare),
  };
}

export function clanAidRemaining(allowance: Resources, committed: Resources): Resources {
  return resourceMap((key) => allowance[key] - committed[key]);
}

/** The extra seat can be consumed by clan aid and by no other mission kind. */
export function clanBayAvailable(baseBays: number, baysInUse: number, clanAid: boolean): boolean {
  const ceiling = finiteFloor(baseBays) + (clanAid ? CLAN.extraAidBays : 0);
  return finiteFloor(baysInUse) < ceiling;
}

/** Applying the aid speed multiplier to a duration; ordinary world speed is already in it. */
export function clanAidTravelMinutes(ordinaryTravelMinutes: number): number {
  return Math.max(0, ordinaryTravelMinutes) / CLAN.aidSpeedMultiplier;
}

export interface ClanPurseInput {
  alloyPerHour: number;
  crystalPerHour: number;
  deuteriumCapacity: number;
  storageCapacity: Resources;
  vaultProtection: Resources;
  unclaimed: Resources;
}

/**
 * How much more may be credited now. Existing shares are never clamped away when
 * worlds are lost; a negative ceiling therefore becomes zero remaining capacity.
 */
export function clanPurseRemaining(input: ClanPurseInput): Resources {
  const candidate: Resources = {
    alloy: finiteFloor(input.alloyPerHour * CLAN.purseProductionHours),
    crystal: finiteFloor(input.crystalPerHour * CLAN.purseProductionHours),
    deuterium: finiteFloor(input.deuteriumCapacity * CLAN.purseDeuteriumCapacityShare),
  };

  return resourceMap((key) => {
    const safeUnclaimedCeiling = finiteFloor(
      input.storageCapacity[key] * CLAN.maxProtectedStorageShare
        - input.vaultProtection[key],
    );
    const purseCeiling = Math.min(candidate[key], safeUnclaimedCeiling);
    return purseCeiling - input.unclaimed[key];
  });
}

export interface ClanLootRecipient {
  playerId: string;
  capacityRemaining: Resources;
}

export interface ClanLootCredit {
  playerId: string;
  resources: Resources;
}

export interface ClanLootSplit {
  pool: Resources;
  offerPerMember: Resources;
  credited: Resources;
  attackerLanding: Resources;
  credits: ClanLootCredit[];
}

/**
 * Allocates a return without minting or burning resources. Only actually credited
 * shares leave the attacker's landing; rounding and full purses stay with them.
 */
export function splitClanRaidLoot(
  returned: Resources,
  recipients: readonly ClanLootRecipient[],
): ClanLootSplit {
  const unique: ClanLootRecipient[] = [];
  const seen = new Set<string>();
  for (const recipient of recipients) {
    if (seen.has(recipient.playerId)) continue;
    seen.add(recipient.playerId);
    unique.push(recipient);
  }

  const eligible = unique.length >= CLAN.minimumLootRoster;
  const pool = resourceMap((key) => eligible ? returned[key] * CLAN.raidLootShare : 0);
  const offerPerMember = resourceMap((key) => eligible ? pool[key] / unique.length : 0);
  const credits = unique.map((recipient): ClanLootCredit => ({
    playerId: recipient.playerId,
    resources: resourceMap((key) => Math.min(
      offerPerMember[key],
      recipient.capacityRemaining[key],
    )),
  }));
  const credited = resourceMap((key) => credits.reduce(
    (total, credit) => total + credit.resources[key],
    0,
  ));
  const attackerLanding = resourceMap((key) => returned[key] - credited[key]);

  return { pool, offerPerMember, credited, attackerLanding, credits };
}

export function clanChatMessageIsValid(value: string): boolean {
  const length = Array.from(value.trim()).length;
  return length >= 1 && length <= CLAN.chatMaxChars;
}

/** Convenience for API checks without allowing one resource to subsidise another. */
export function resourcesFit(required: Resources, available: Resources): boolean {
  return RESOURCE_KEYS.every((key) => finiteFloor(required[key]) <= finiteFloor(available[key]));
}
