import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMBAT } from '../packages/rules/src/constants.js';
import { resolveBattle } from '../packages/rules/src/combat.js';
import { fleetValue } from '../packages/rules/src/hulls.js';
import { matchup, powerUnits } from '../packages/rules/src/matchupPower.js';
import { mulberry32 } from '../packages/rules/src/rng.js';
import type { TechLevels } from '../packages/rules/src/tech.js';
import type { Fleet } from '../packages/rules/src/types.js';

/**
 * SAVAŞ v3 KAÇIŞ KALİBRASYONU — owner 2026-10-25 (docs/combat-v3-plan-2026-10-25.md §7).
 *
 * Fits `COMBAT.retreatWindows` to the owner's table with the real engine: per tier of the
 * weaker side's matchup power, per anchor ratio, the {hull threshold, chance} that leaves
 * the weak side its target share. The stronger side's loss is not fitted — the handicap
 * (α) sets it — but reported against the owner's minimums, and among windows that hit the
 * weak target the one that makes the strong side pay most is kept.
 *
 * Run: `nice -n 10 npx tsx tools/combat-v3-calibration.ts` (minutes; owner-requested study).
 */

type Windows = typeof COMBAT.retreatWindows;
export interface Scenario { tier: number; name: string; weak: Fleet; template: Fleet; weakTech: TechLevels; strongTech: TechLevels }

const T = COMBAT.outcomeTargets;
/** Weak side's 1:1 share by tier: 0–25k, 25–100k, 100–300k, 300k+. */
export const EVEN_KEPT = T.evenKept;
/** Weak side's share kept by ratio; 1:2.5 and 1:3 extend the table toward the 3× fleet escape (K3). */
const WEAK_KEPT: Record<number, number> = Object.fromEntries(T.ratios.map((r, i) => [r, T.weakKept[i]!]));
/** The least the stronger side should lose of its own fleet: the owner's table, to 1:2. */
export const STRONG_LOSS_MIN: Record<number, number> = Object.fromEntries(T.ratios.filter(r => r <= 2).map((r) => [r, T.strongLost[T.ratios.indexOf(r)]!]));
/**
 * Past 1:2 the owner set no floor. Fitted to none, the handicap fell to almost nothing and
 * the stronger side's loss dropped from 30% at 1:2 to 2% at 1:2.5 — a cliff that makes every
 * raid bring 2.5×. These carry the owner's falling trend on to the 3× fleet escape instead.
 */
const STRONG_LOSS_PAST_TABLE: Record<number, number> = Object.fromEntries(T.ratios.filter(r => r > 2).map((r) => [r, T.strongLost[T.ratios.indexOf(r)]!]));
export const strongLossFloor = (ratio: number): number | undefined => STRONG_LOSS_MIN[ratio] ?? STRONG_LOSS_PAST_TABLE[ratio];

/** K6: past 1:1 the weak side never keeps less than its tier's even share. */
export const keptTarget = (tier: number, ratio: number): number =>
  ratio <= 1 ? EVEN_KEPT[tier]! : Math.max(WEAK_KEPT[ratio]!, EVEN_KEPT[tier]!);
export const tierOf = (power: number): number => COMBAT.retreatTiers.filter(edge => power >= edge).length;

const R = (level: number): TechLevels => ({ SHIP_POWER: level, SHIP_ARMOR: level, SHIP_SHIELDS: Math.min(4, level) });
const row = (tier: number, name: string, weak: Fleet, template: Fleet, weakLevel: number, strongLevel = weakLevel): Scenario =>
  ({ tier, name, weak, template, weakTech: R(weakLevel), strongTech: R(strongLevel) });

/** Mirrors, counters both ways, mixed lines, and a few-ship and many-ship side in every tier. */
export const SCENARIOS: readonly Scenario[] = [
  row(0, 'Ok ayna', { DART: 30 }, { DART: 1 }, 0),
  row(0, 'Kargı ayna', { PIKE: 28 }, { PIKE: 1 }, 1),
  row(0, 'T1 karma ayna', { DART: 10, PIKE: 10, WARDEN: 8 }, { DART: 10, PIKE: 10, WARDEN: 8 }, 0),
  row(0, 'Ok vs Kargı (güçlü counter)', { DART: 30 }, { PIKE: 1 }, 0),
  row(0, 'Ok vs Sur (zayıf counter)', { DART: 30 }, { RAMPART: 1 }, 0),
  row(0, 'Az gemi: 8 Ok', { DART: 8 }, { DART: 1 }, 0),
  row(0, 'Çok gemi: 50 T1 karma', { DART: 15, PIKE: 20, WARDEN: 15 }, { DART: 1, PIKE: 1, WARDEN: 1 }, 0),
  row(1, 'Engerek ayna', { VIPER: 36 }, { VIPER: 1 }, 2),
  row(1, 'Pençe ayna', { TALON: 36 }, { TALON: 1 }, 2),
  row(1, 'T2 karma ayna', { VIPER: 12, TALON: 12, SENTINEL: 9 }, { VIPER: 4, TALON: 4, SENTINEL: 3 }, 2),
  row(1, 'Hisar vs Pençe (zayıf counter)', { STRONGHOLD: 28 }, { TALON: 1 }, 2),
  row(1, 'Engerek araş.+2 vs Nöbetçi', { VIPER: 30 }, { SENTINEL: 1 }, 3, 1),
  row(1, 'Az gemi: 20 Engerek', { VIPER: 20 }, { VIPER: 1 }, 2),
  row(1, 'Çok gemi: 120 T1 vs T2', { DART: 60, PIKE: 60 }, { VIPER: 4, TALON: 4, SENTINEL: 3 }, 2),
  row(2, 'Kasırga ayna', { TEMPEST: 48 }, { TEMPEST: 1 }, 3),
  row(2, 'Balista ayna', { BALLISTA: 48 }, { BALLISTA: 1 }, 3),
  row(2, 'Leviathan ayna', { LEVIATHAN: 38 }, { LEVIATHAN: 1 }, 3),
  row(2, 'T3 karma ayna', { TEMPEST: 15, BALLISTA: 15, PRAETORIAN: 12 }, { TEMPEST: 5, BALLISTA: 5, PRAETORIAN: 4 }, 3),
  row(2, 'Balista araş.+2 vs Praetoryen (güçlü counter)', { BALLISTA: 45 }, { PRAETORIAN: 1 }, 4, 2),
  row(2, 'Kasırga vs Balista (güçlü counter)', { TEMPEST: 48 }, { BALLISTA: 1 }, 3),
  row(2, 'Az gemi: 22 Leviathan', { LEVIATHAN: 22 }, { LEVIATHAN: 1 }, 3),
  row(2, 'Çok gemi: 150 T2 karma', { VIPER: 55, TALON: 55, SENTINEL: 40 }, { TEMPEST: 5, BALLISTA: 5, PRAETORIAN: 4 }, 3),
  row(3, 'Korsan ayna', { CORSAIR: 60 }, { CORSAIR: 1 }, 4),
  row(3, 'Kıyamet ayna', { CATACLYSM: 60 }, { CATACLYSM: 1 }, 4),
  row(3, 'Kale ayna', { CITADEL: 50 }, { CITADEL: 1 }, 5),
  row(3, 'T4 karma ayna', { CORSAIR: 15, CATACLYSM: 15, CITADEL: 12, PALADIN: 12 }, { CORSAIR: 5, CATACLYSM: 5, CITADEL: 4, PALADIN: 4 }, 4),
  row(3, 'Kıyamet araş.+1 vs Palatin (güçlü counter)', { CATACLYSM: 60 }, { PALADIN: 1 }, 5, 4),
  row(3, 'Kıyamet ağır vs Kale ağır', { CATACLYSM: 36, CORSAIR: 12, PALADIN: 12 }, { CITADEL: 5, CORSAIR: 2, CATACLYSM: 2 }, 4, 5),
  row(3, 'Az gemi: 24 Kale', { CITADEL: 24 }, { CITADEL: 1 }, 4),
  row(3, 'Çok gemi: 400 T4', { CORSAIR: 200, CATACLYSM: 200 }, { CORSAIR: 1, CATACLYSM: 1 }, 5),
];

/** The strong side's power over the weak side's: directional, unlike `matchupRatio`. */
export const ratioOf = (s: Scenario, strong: Fleet): number => {
  const m = matchup({ units: powerUnits(strong, { tech: s.strongTech }) }, { units: powerUnits(s.weak, { tech: s.weakTech }) });
  return m.attacker.power / m.defender.power;
};
const scale = (fleet: Fleet, by: number): Fleet =>
  Object.fromEntries(Object.entries(fleet).map(([hull, count]) => [hull, Math.round(count * by)]).filter(([, count]) => Number(count) > 0));

/** The template scaled to the whole-hull fleet whose ratio over the weak side sits closest to `ratio`. */
export function strongAt(s: Scenario, ratio: number): Fleet {
  let low = 0, high = 1;
  while (ratioOf(s, scale(s.template, high)) < ratio || fleetValue(scale(s.template, high)) === 0) high *= 2;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    if (ratioOf(s, scale(s.template, mid)) < ratio || fleetValue(scale(s.template, mid)) === 0) low = mid; else high = mid;
  }
  const above = scale(s.template, high), below = scale(s.template, low);
  const off = (fleet: Fleet) => fleetValue(fleet) === 0 ? Infinity : Math.abs(Math.log(ratioOf(s, fleet) / ratio));
  return off(below) < off(above) ? below : above;
}

export interface Measure { ratio: number; weakKept: number; strongKept: number; strongLost: number; rounds: number }

/** Strong side raids the weak one; physical survivors (retreated ones included) are what a side kept. */
export function measure(s: Scenario, strong: Fleet, seeds: readonly number[]): Measure {
  let weakKept = 0, strongKept = 0, rounds = 0;
  for (const seed of seeds) {
    const r = resolveBattle([{ contributionId: 'strong', playerId: 'strong', fleet: strong, tech: { tech: s.strongTech } }],
      [{ stackId: 'weak', playerId: 'weak', fleet: s.weak, tech: { tech: s.weakTech } }], 0, mulberry32(seed), 'HP_PLANET');
    weakKept += fleetValue(r.defenderSurvivors) / fleetValue(s.weak);
    strongKept += fleetValue(r.attackerSurvivors) / fleetValue(strong);
    rounds += r.rounds.length;
  }
  const n = seeds.length;
  return { ratio: ratioOf(s, strong), weakKept: weakKept / n, strongKept: strongKept / n, strongLost: 1 - strongKept / n, rounds: rounds / n };
}

/**
 * Runs `fn` with a candidate table. The engine reads `COMBAT` at every battle, so the study
 * swaps the property itself and puts the shipped value back.
 */
function swap<K extends 'retreatWindows' | 'handicap', T>(key: K, value: (typeof COMBAT)[K], fn: () => T): T {
  const shipped = COMBAT[key];
  Object.defineProperty(COMBAT, key, { value, configurable: true, writable: true });
  try { return fn(); } finally { Object.defineProperty(COMBAT, key, { value: shipped, configurable: true, writable: true }); }
}
export const withWindows = <T>(windows: Windows, fn: () => T): T => swap('retreatWindows', windows, fn);
const withHandicap = <T>(handicap: typeof COMBAT.handicap, fn: () => T): T => swap('handicap', handicap, fn);
/** One exponent at every ratio, so a scenario's whole-hull rounding never interpolates. */
export const withExponent = <T>(exponent: number, fn: () => T): T =>
  withHandicap({ ratios: COMBAT.handicap.ratios, exponents: COMBAT.handicap.ratios.map(() => exponent) }, fn);

const THRESHOLDS = [.30, .45, .60, .75, .90, 1] as const;
const round2 = (x: number) => Math.round(x * 100) / 100;
const uniform = (window: { threshold: number; chance: number }): Windows =>
  COMBAT.retreatWindows.map(tier => tier.map(() => window));

interface Fit { threshold: number; chance: number; kept: number; spread: number; strongLost: number; strongLostMin: number; rounds: number }

/** Mean over the tier's scenarios at one ratio, the same window on every anchor so rounding never interpolates. */
function evaluate(rows: readonly { s: Scenario; strong: Fleet }[], window: { threshold: number; chance: number }, seeds: readonly number[], ratio: number): Fit {
  const measured = withWindows(uniform(window), () => rows.map(({ s, strong }) => measure(s, strong, seeds)));
  // At 1:1 both sides fight under the window; either side's share is the target.
  const kept = measured.map(m => ratio <= 1 ? (m.weakKept + m.strongKept) / 2 : m.weakKept);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return { ...window, kept: mean(kept), spread: Math.max(...kept) - Math.min(...kept),
    strongLost: mean(measured.map(m => m.strongLost)), strongLostMin: Math.min(...measured.map(m => m.strongLost)),
    rounds: mean(measured.map(m => m.rounds)) };
}

/** Per threshold, the chance (in 5% steps) that lands the weak share on target; then the window the strong side pays most under. */
export function fitAnchor(tier: number, ratio: number, seeds: readonly number[]): Fit {
  const rows = SCENARIOS.filter(s => s.tier === tier).map(s => ({ s, strong: strongAt(s, ratio) }));
  const target = keptTarget(tier, ratio), fits: Fit[] = [];
  for (const threshold of THRESHOLDS) {
    let low = 1, high = 20; // chance in 5% steps
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (evaluate(rows, { threshold, chance: mid / 20 }, seeds, ratio).kept < target) low = mid + 1; else high = mid;
    }
    for (const step of new Set([Math.max(1, low - 1), low])) fits.push(evaluate(rows, { threshold, chance: step / 20 }, seeds, ratio));
  }
  const close = fits.filter(f => Math.abs(f.kept - target) <= .02);
  const pool = close.length > 0 ? close : [fits.reduce((a, b) => Math.abs(a.kept - target) <= Math.abs(b.kept - target) ? a : b)];
  return pool.reduce((a, b) => ratio <= 1
    ? (a.spread <= b.spread ? a : b)
    : (a.strongLost > b.strongLost + .005 || (Math.abs(a.strongLost - b.strongLost) <= .005 && a.spread <= b.spread) ? a : b));
}

/** The smallest exponent, in 0.05 steps up to 2, at which `enough` holds; 2 when none does. */
function leastExponent(enough: (exponent: number) => boolean): number {
  let low = 0, high = 40;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (enough(mid / 20)) high = mid; else low = mid + 1;
  }
  return low / 20;
}

const TIERS = [0, 1, 2, 3] as const;
const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * One ratio: the handicap exponent (shared by every tier), then each tier's window under it.
 * The exponent is the least that makes the stronger side lose its floor, so being stronger
 * keeps every advantage the owner's table leaves it.
 */
export function fitRatio(ratio: number, seeds: readonly number[]): { exponent: number; tiers: Fit[] } {
  const fitTiers = () => TIERS.map(tier => fitAnchor(tier, ratio, seeds));
  const floor = strongLossFloor(ratio);
  const exponent = floor === undefined ? 0
    : leastExponent(e => withExponent(e, () => mean(fitTiers().map(f => f.strongLost)) >= floor - .01));
  return { exponent, tiers: withExponent(exponent, fitTiers) };
}

const seedsFrom = (base: number, n: number) => Array.from({ length: n }, (_, i) => Math.imul(base + i, 0x9E3779B1) >>> 0);
const pct = (x: number) => String(Math.round(x * 100));

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const started = Date.now(), fitSeeds = seedsFrom(1, Number(process.env.SEEDS ?? 10)), holdout = seedsFrom(10_001, 12);
  const rows = COMBAT.retreatRatios.map(ratio => {
    const fit = fitRatio(ratio, fitSeeds);
    console.log(`1:${String(ratio)} üs ${fit.exponent.toFixed(2)}`);
    fit.tiers.forEach((f, tier) => console.log(`  T${String(tier)} gövde ≤%${pct(f.threshold)} şans %${pct(f.chance)}`
      + ` · zayıf kalan %${pct(f.kept)} (hedef %${pct(keptTarget(tier, ratio))}, yayılım ${pct(f.spread)})`
      + ` · güçlü kayıp %${pct(f.strongLost)} (en az %${pct(f.strongLostMin)}) · ${f.rounds.toFixed(1)} tur`));
    return fit;
  });
  // An even fight is never filed down; its slot carries the 1:1.2 exponent so 1–1.2 reads flat.
  const exponents = [rows[1]!.exponent, ...rows.slice(1).map(row => row.exponent), 0];
  const handicap = { ratios: [...COMBAT.retreatRatios, 4], exponents };
  const windows: Windows = TIERS.map(tier => rows.map(row => ({ threshold: row.tiers[tier]!.threshold, chance: row.tiers[tier]!.chance })));
  // Held-out seeds, both fitted tables as shipped (interpolated), at anchors and between them.
  const validation = withHandicap(handicap, () => withWindows(windows, () => SCENARIOS.flatMap(s =>
    [1, 1.1, 1.2, 1.3, 1.4, 1.6, 1.8, 2, 2.25, 2.5, 2.75, 3, 3.5].map(ratio => {
      const m = measure(s, strongAt(s, ratio), holdout);
      return { tier: s.tier, scenario: s.name, ratio: round2(m.ratio), weakKept: round2(m.weakKept), strongLost: round2(m.strongLost), rounds: round2(m.rounds) };
    }))));
  const file = resolve(fileURLToPath(new URL('../', import.meta.url)), 'docs/evidence/combat-v3-calibration-2026-10-25.json');
  writeFileSync(file, `${JSON.stringify({ generated: new Date().toISOString(), fitSeeds: fitSeeds.length, holdoutSeeds: holdout.length,
    tempo: COMBAT.tempo, rounds: COMBAT.rounds, handicap,
    table: rows.flatMap((row, i) => row.tiers.map((f, tier) => ({ tier, ratio: COMBAT.retreatRatios[i], exponent: row.exponent,
      target: keptTarget(tier, COMBAT.retreatRatios[i]!), strongLossFloor: strongLossFloor(COMBAT.retreatRatios[i]!) ?? null,
      threshold: f.threshold, chance: f.chance, kept: round2(f.kept), spread: round2(f.spread), strongLost: round2(f.strongLost),
      strongLostMin: round2(f.strongLostMin), rounds: round2(f.rounds) }))),
    validation }, null, 2)}\n`);
  console.log(`\nhandicap.exponents: [${exponents.map(e => e.toFixed(2)).join(', ')}]`);
  console.log(`retreatWindows: [\n${windows.map(tier => `  [${tier.map(w => `{ threshold: ${w.threshold.toFixed(2)}, chance: ${w.chance.toFixed(2)} }`).join(', ')}],`).join('\n')}\n]`);
  console.log(`${file} · ${String(Math.round((Date.now() - started) / 1000))} s`);
}
