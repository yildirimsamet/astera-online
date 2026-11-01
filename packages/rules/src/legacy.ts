import { ALL_HULLS, HULLS } from './hulls.js';
import { RESEARCH_MAX_LEVEL } from './research.js';
import { RESEARCH_PROJECT_IDS, type HullId, type ResearchProjectId } from './types.js';

const DAY = 86_400_000;
export const LEGACY_VERSION = 1;
export const LEGACY_MIN_SEASON_MS = 12 * DAY;
export const LEGACY_SHOWCASE_SLOTS = 6;

export type LegacyMetric = 'COLONIES_NEUTRALISED' | 'NEUTRAL_COLONIES' | 'PIRATE_VICTORIES'
  | 'ASTEROIDS_MINED' | 'DEATH_STAR_LAUNCHES' | 'RADIATION_BOMB_LAUNCHES'
  | 'STRATEGIC_INTERCEPTIONS' | 'CLAN_WAR_ATTACKS' | 'PROBES' | 'HIGHER_TIER_ATTACKS'
  | 'MONUMENT_SECONDS' | 'LOYAL_SEASONS' | 'RESEARCH_MASTERED' | 'SUPPORTER' | 'PAID_COSMETICS'
  | 'HONOR_RANK' | 'DOMINION_RANK' | 'SEASON_PARTICIPATION' | 'YEAR_PLAYED'
  | `SHIPS_BUILT:${HullId}`;
export type LegacyScope = 'CAREER' | 'SEASON' | 'YEAR';
export type LegacyCategory = 'SEASON' | 'COMBAT' | 'EXPLORATION' | 'PRODUCTION' | 'CLAN' | 'CAREER' | 'SUPPORT';
export type LegacyForm = 'TROPHY' | 'MEDAL' | 'PIN' | 'COIN' | 'PLAQUE' | 'MINIATURE' | 'ARTIFACT';
export type LegacyRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

export interface LegacyDefinition {
  id: string;
  metric: LegacyMetric;
  goals: readonly number[];
  scope: LegacyScope;
  category: LegacyCategory;
  form: LegacyForm;
}

const definition = (id: string, metric: LegacyMetric, goals: readonly number[], category: LegacyCategory,
  form: LegacyForm, scope: LegacyScope = 'CAREER'): LegacyDefinition => ({ id, metric, goals, category, form, scope });

/** Cosmetic recognition only. Its scopes never reuse the next-season resource entitlement. */
export const LEGACY_CATALOGUE: readonly LegacyDefinition[] = [
  definition('honor-podium', 'HONOR_RANK', [1, 2, 3, 10], 'SEASON', 'TROPHY', 'SEASON'),
  definition('dominion-podium', 'DOMINION_RANK', [1, 2, 3, 10], 'SEASON', 'TROPHY', 'SEASON'),
  definition('season-memento', 'SEASON_PARTICIPATION', [1], 'SEASON', 'COIN', 'SEASON'),
  definition('loyal-commander', 'LOYAL_SEASONS', [1], 'CAREER', 'MEDAL'),
  definition('year-of-service', 'YEAR_PLAYED', [1], 'CAREER', 'PIN', 'YEAR'),
  definition('colony-hunter', 'COLONIES_NEUTRALISED', [1, 5, 20, 50], 'COMBAT', 'MINIATURE'),
  definition('colony-pioneer', 'NEUTRAL_COLONIES', [1, 5, 20, 50], 'EXPLORATION', 'MINIATURE'),
  definition('monument-warden', 'MONUMENT_SECONDS', [3_600, 43_200, 86_400, 259_200], 'EXPLORATION', 'ARTIFACT'),
  definition('pirate-hunter', 'PIRATE_VICTORIES', [10, 30, 50, 100], 'COMBAT', 'MEDAL'),
  definition('asteroid-hunter', 'ASTEROIDS_MINED', [10, 100, 500, 2_000], 'EXPLORATION', 'MINIATURE'),
  definition('final-verdict', 'DEATH_STAR_LAUNCHES', [1, 5, 20, 50], 'COMBAT', 'MINIATURE'),
  definition('radiation-master', 'RADIATION_BOMB_LAUNCHES', [1, 10, 50, 100], 'COMBAT', 'ARTIFACT'),
  definition('missile-hunter', 'STRATEGIC_INTERCEPTIONS', [1, 5, 20, 50], 'COMBAT', 'MINIATURE'),
  definition('science-horizon', 'RESEARCH_MASTERED', [1], 'PRODUCTION', 'ARTIFACT'),
  definition('clan-comrade', 'CLAN_WAR_ATTACKS', [1, 5, 20, 50], 'CLAN', 'MEDAL'),
  definition('deep-sight', 'PROBES', [10, 100, 1_000], 'EXPLORATION', 'MEDAL'),
  definition('astera-supporter', 'SUPPORTER', [1], 'SUPPORT', 'MEDAL'),
  definition('troublemaker', 'HIGHER_TIER_ATTACKS', [1, 10, 50, 100], 'COMBAT', 'MEDAL'),
  definition('show-off', 'PAID_COSMETICS', [1, 3, 5], 'SUPPORT', 'MEDAL'),
  ...ALL_HULLS.filter(hull => !HULLS[hull].ground).map(hull =>
    definition(`shipwright-${hull.toLowerCase()}`, `SHIPS_BUILT:${hull}`, [100, 1_000, 10_000], 'PRODUCTION', 'PLAQUE')),
];

export const legacyDefinition = (id: string): LegacyDefinition | undefined => LEGACY_CATALOGUE.find(row => row.id === id);

function integer(value: number): void {
  if (!Number.isSafeInteger(value)) throw new RangeError('Legacy values must be safe integers');
}

export function legacySeasonEligible(startsAt: number, closesAt: number): boolean {
  integer(startsAt);
  integer(closesAt);
  return closesAt - startsAt >= LEGACY_MIN_SEASON_MS;
}

export function legacyTiers(goals: readonly number[], progress: number): number[] {
  integer(progress);
  if (progress < 0) throw new RangeError('Legacy progress cannot be negative');
  return goals.flatMap((goal, i) => progress >= goal ? [i + 1] : []);
}

/** Union before rounding: two simultaneous fleets never make one hour into two. */
export function legacyUnionMilliseconds(intervals: readonly { from: number; to: number }[]): number {
  for (const span of intervals) {
    integer(span.from);
    integer(span.to);
    if (span.to < span.from) throw new RangeError('Legacy intervals cannot run backwards');
  }
  let total = 0;
  let end = -Infinity;
  for (const span of [...intervals].sort((a, b) => a.from - b.from)) {
    total += Math.max(0, span.to - Math.max(end, span.from));
    end = Math.max(end, span.to);
  }
  integer(total);
  return total;
}

export function legacyLoyalSeason(input: {
  startsAt: number; closesAt: number; joinedAt: number; activeDays: readonly number[];
}): boolean {
  integer(input.joinedAt);
  if (!legacySeasonEligible(input.startsAt, input.closesAt)
    || input.joinedAt < input.startsAt || input.joinedAt >= input.startsAt + DAY) return false;
  const days = Math.ceil((input.closesAt - input.startsAt) / DAY);
  const active = new Set(input.activeDays.filter(day => Number.isInteger(day) && day >= 0 && day < days));
  return active.size * 5 >= days * 4;
}

export function legacyResearchMastered(levels: Readonly<Partial<Record<ResearchProjectId, number>>>): boolean {
  return RESEARCH_PROJECT_IDS.every(id => (levels[id] ?? 0) >= RESEARCH_MAX_LEVEL[id]);
}

export type LegacyRankDegree = 'CHAMPION' | 'SILVER' | 'BRONZE' | 'TOP_TEN';
export function legacyRankDegree(rank: number, score: number): LegacyRankDegree | null {
  if (!Number.isSafeInteger(rank) || rank < 1 || !Number.isFinite(score) || score <= 0) return null;
  return rank === 1 ? 'CHAMPION' : rank === 2 ? 'SILVER' : rank === 3 ? 'BRONZE' : rank <= 10 ? 'TOP_TEN' : null;
}

export const legacyTierRarity = (tier: number, count: number): LegacyRarity =>
  tier === count && count > 1 ? 'LEGENDARY' : tier >= 3 ? 'EPIC' : tier >= 2 ? 'RARE' : 'COMMON';

/** A podium counts down to first; a career ladder counts up. Neither changes its goals. */
export function legacyAwardRarity(definitionId: string, tier: number): LegacyRarity {
  const entry = legacyDefinition(definitionId);
  if (!entry || !Number.isInteger(tier) || tier < 1 || tier > entry.goals.length) {
    throw new RangeError('Unknown legacy award degree');
  }
  if (definitionId === 'honor-podium' || definitionId === 'dominion-podium') {
    return (['LEGENDARY', 'EPIC', 'RARE', 'COMMON'] as const)[tier - 1]!;
  }
  if (definitionId === 'science-horizon' || definitionId === 'astera-supporter') return 'LEGENDARY';
  if (definitionId === 'loyal-commander') return 'RARE';
  return legacyTierRarity(tier, entry.goals.length);
}
