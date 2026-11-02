/**
 * KOMUTAN MİRASI, AS A PLAYER SEES IT: the face, the metal, the name and the rule of every
 * award the server can grant (`LEGACY_CATALOGUE`). Pure, so the shelf, the collection and the
 * detail sheet can never disagree about what a piece is called or what it took.
 */
import { LEGACY_CATALOGUE, type HullId, type LegacyDefinition } from '@astera/rules';
import i18n from '../i18n/index.js';
import { legacy as LEGACY_EN } from '../i18n/locales/en/legacy.js';
import { hullName } from '../i18n/names.js';
import { HULL_LOD_MODEL, HULL_MODEL, MODEL } from '../ui/assets.js';
import type { LegacyAward } from '../api/legacySchemas.js';

export type LegacyFinish = 'iron' | 'bronze' | 'silver' | 'gold';
export type LegacyEmblem = 'pirate' | 'missile' | 'clan' | 'heart' | 'bolt' | 'gem';

/**
 * How a piece is built. `glb` is a credited award model whose metal takes the tier's finish;
 * `craft` is the game's own model of the thing the award is about, shown floating; the rest
 * are drawn in code (`procedural.ts`). `size` is the height the piece fills on a plinth.
 */
export type LegacyArt =
  | { kind: 'glb'; url: string; size: number; tint: boolean; ribbon?: boolean; obsidian?: boolean; turn?: number }
  /** `flame` lights the engines; `engines` names the model whose nozzles they use (a LOD has none of its own). */
  | { kind: 'craft'; url: string; size: number; upright?: boolean; flame?: true; engines?: string }
  /** A world on a trophy stand. */
  | { kind: 'globe'; url: string }
  | { kind: 'coin' } | { kind: 'pin' } | { kind: 'orrery' }
  | { kind: 'medal'; emblem: LegacyEmblem };

const MODELS = '/assets/legacy/models';
const ART: Record<string, LegacyArt> = {
  'season-memento': { kind: 'coin' },
  'loyal-commander': { kind: 'glb', url: `${MODELS}/star-medal.glb`, size: 0.9, tint: true, ribbon: true },
  'year-of-service': { kind: 'pin' },
  'colony-hunter': { kind: 'globe', url: '/assets/models/patlamis_gezegen_2_lod.glb' },
  'science-horizon': { kind: 'orrery' },
  'deep-sight': { kind: 'glb', url: `${MODELS}/sputnik.glb`, size: 0.82, tint: false, turn: Math.PI / 2 },
  'astera-supporter': { kind: 'medal', emblem: 'heart' },
  'troublemaker': { kind: 'medal', emblem: 'bolt' },
  'show-off': { kind: 'medal', emblem: 'gem' },
};

const SHIPWRIGHT = 'shipwright-';
const shipOf = (definitionId: string): HullId | null => {
  if (!definitionId.startsWith(SHIPWRIGHT)) return null;
  const hull = definitionId.slice(SHIPWRIGHT.length).toUpperCase();
  return hull in HULL_LOD_MODEL ? hull as HullId : null;
};

type AwardFace = Pick<LegacyAward, 'definitionId' | 'tier' | 'rarity' | 'edition'>;
type AwardDegree = Pick<AwardFace, 'definitionId' | 'tier' | 'rarity'>;
const MESHY_FAMILIES: Partial<Record<string, string>> = {
  'honor-podium': 'honor', 'dominion-podium': 'kupa', 'colony-pioneer': 'gezegen',
  'pirate-hunter': 'korsan', 'asteroid-hunter': 'kazici', 'missile-hunter': 'roket',
  'radiation-master': 'radyasyon', 'clan-comrade': 'silah_arkadasi', 'monument-warden': 'anit_tutma',
};
const METAL_FILE: Record<LegacyFinish, string> = { iron: 'iron', bronze: 'bronz', silver: 'silver', gold: 'golden' };
const PODIUM_FINISH: readonly LegacyFinish[] = ['gold', 'silver', 'bronze', 'iron'];
const RARITY_FINISH: Record<LegacyAward['rarity'], LegacyFinish> = { COMMON: 'iron', RARE: 'bronze', EPIC: 'silver', LEGENDARY: 'gold' };

export function legacyFinish(award: AwardDegree): LegacyFinish {
  if (award.definitionId === 'honor-podium' || award.definitionId === 'dominion-podium') return PODIUM_FINISH[award.tier - 1] ?? 'iron';
  return RARITY_FINISH[award.rarity];
}

export function legacyArt(award: AwardDegree): LegacyArt | undefined {
  const family = MESHY_FAMILIES[award.definitionId];
  if (family) return { kind: 'glb', url: `${MODELS}/meshy-v1/${METAL_FILE[legacyFinish(award)]}_${family}.glb`, size: 1, tint: false };
  if (award.definitionId === 'final-verdict') return { kind: 'craft',
    url: `${MODELS}/strategic-v1/${METAL_FILE[legacyFinish(award)]}_death_star.glb`, size: 0.66,
    flame: true, engines: MODEL.deathStar };
  const ship = shipOf(award.definitionId);
  if (ship) return { kind: 'craft', url: HULL_LOD_MODEL[ship], size: 0.7, flame: true, engines: HULL_MODEL[ship] };
  return ART[award.definitionId];
}

/** Same builder identity for a shelf piece and its cached image; same-metal tiers stay distinct. */
export function legacyVisualKey(award: AwardFace & Pick<LegacyAward, 'seasonOrdinal'>): string {
  const art = legacyArt(award);
  return [award.definitionId, award.tier, legacyFinish(award), legacyEditionMark(award) ?? '',
    art && 'url' in art ? art.url : art?.kind ?? ''].join('|');
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
/** The ids the copy covers; a catalogue id without copy (a shipwright's hull) is named apart. */
type CopiedDefinition = keyof typeof LEGACY_EN.def;
const hasCopy = (id: string): id is CopiedDefinition => Object.hasOwn(LEGACY_EN.def, id);
const PODIUM_PLACES = ['1', '2', '3', '4'] as const;
const definitionOf = (id: string): LegacyDefinition | undefined => LEGACY_CATALOGUE.find(row => row.id === id);
const yearOf = (edition: string): string | null => /^year:(\d{4})$/.exec(edition)?.[1] ?? null;

/** The name a piece is shown under: a ladder carries its numeral, a podium its place. */
export function legacyAwardTitle(award: Pick<AwardFace, 'definitionId' | 'tier' | 'edition'>): string {
  const definition = definitionOf(award.definitionId);
  if (award.definitionId === 'honor-podium' || award.definitionId === 'dominion-podium') {
    const place = PODIUM_PLACES[Math.min(4, award.tier) - 1] ?? '4';
    return i18n.t(`legacy.podium.${award.definitionId === 'honor-podium' ? 'honor' : 'dominion'}.${place}`);
  }
  if (award.definitionId === 'year-of-service') return i18n.t('legacy.def.year-of-service.title', { year: yearOf(award.edition) ?? '' });
  const ship = shipOf(award.definitionId);
  const base = ship ? i18n.t('legacy.shipwright.name', { ship: hullName(ship) ?? ship }) : legacyDefinitionName(award.definitionId);
  return definition && definition.goals.length > 1 ? `${base} ${ROMAN[award.tier - 1] ?? String(award.tier)}` : base;
}

/** The name of the whole ladder, without a tier — for a piece not earned yet. */
export function legacyDefinitionName(definitionId: string): string {
  const ship = shipOf(definitionId);
  if (ship) return i18n.t('legacy.shipwright.name', { ship: hullName(ship) ?? ship });
  return hasCopy(definitionId) ? i18n.t(`legacy.def.${definitionId}.name`) : definitionId;
}

/** Localized season label, a year, or no edition for a career piece. */
export function legacyEditionLabel(award: Pick<LegacyAward, 'edition' | 'seasonOrdinal' | 'definitionId'>): string | null {
  const year = yearOf(award.edition);
  if (year) return year;
  return award.seasonOrdinal !== null ? i18n.t('legacy.seasons.short', { ordinal: award.seasonOrdinal }) : null;
}

/** Short engraving on the physical coin; display copy must not alter the artwork or its cache. */
export function legacyEditionMark(award: Pick<LegacyAward, 'edition' | 'seasonOrdinal' | 'definitionId'>): string | null {
  const definition = definitionOf(award.definitionId);
  return definition?.scope === 'SEASON' && award.seasonOrdinal !== null
    ? `S${String(award.seasonOrdinal)}` : yearOf(award.edition);
}

function duration(seconds: number): string {
  const days = seconds / 86_400;
  return Number.isInteger(days) && days >= 1
    ? i18n.t('legacy.duration.days', { count: days })
    : i18n.t('legacy.duration.hours', { count: Math.round(seconds / 3_600) });
}

/** What reaching `goal` on this ladder takes, written as the action. */
export function legacyGoalText(definition: LegacyDefinition, goal: number): string {
  const ship = shipOf(definition.id);
  if (ship) return i18n.t('legacy.shipwright.goal', { count: goal, ship: hullName(ship) ?? ship });
  if (definition.id === 'honor-podium' || definition.id === 'dominion-podium') {
    return i18n.t(`legacy.def.${definition.id}.goal`, { context: goal === 1 ? 'first' : goal <= 3 ? 'podium' : 'top', rank: goal });
  }
  if (definition.metric === 'MONUMENT_SECONDS') return i18n.t('legacy.def.monument-warden.goal', { duration: duration(goal) });
  const id = definition.id;
  return hasCopy(id) && id !== 'honor-podium' && id !== 'dominion-podium' && id !== 'monument-warden'
    ? i18n.t(`legacy.def.${id}.goal`, { count: goal }) : id;
}

/** The next tier still open on a ladder, or null once every tier is held. */
export function legacyNextGoal(definition: LegacyDefinition, progress: number): { tier: number; goal: number } | null {
  const index = definition.goals.findIndex(goal => progress < goal);
  return index < 0 ? null : { tier: index + 1, goal: definition.goals[index]! };
}

/** Progress in the unit the rule uses: monument time in hours, everything else as a count. */
export function legacyProgressValue(definition: LegacyDefinition, value: number): number {
  return definition.metric === 'MONUMENT_SECONDS' ? Math.floor(value / 3_600) : value;
}

const RARITY_RANK: Record<LegacyAward['rarity'], number> = { LEGENDARY: 0, EPIC: 1, RARE: 2, COMMON: 3 };
const when = (award: Pick<LegacyAward, 'earnedAt' | 'grantedAt'>): number => (award.earnedAt ?? award.grantedAt).getTime();

/** Rarest first; among equals the most recent piece leads. */
export function sortLegacyAwards<T extends Pick<LegacyAward, 'rarity' | 'earnedAt' | 'grantedAt'>>(awards: readonly T[]): T[] {
  return [...awards].sort((a, b) => RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity] || when(b) - when(a));
}
