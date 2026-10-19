/**
 * Honor integer arithmetic. Score amounts are signed micro-Honor; resource values use the
 * season's frozen A + 2C + 32D catalogue. No clock, ownership or battle winner
 * is inferred here. Settlement supplies authoritative, committed facts.
 */
export const HONOR_LEGACY_VERSION = 1;
/** Shared sides cannot earn positive Honor; previous season policies remain frozen. */
export const HONOR_VERSION = 3;
/** Reviewable next policy; only explicit SHADOW preparation may select it. */
export const HONOR_CANDIDATE_VERSION = 2;
/** Solo-credit launch policy with tactical sources and simultaneous accounting. */
export const HONOR_LAUNCH_VERSION = 4;
export type HonorVersion = typeof HONOR_LEGACY_VERSION | typeof HONOR_VERSION | typeof HONOR_CANDIDATE_VERSION | typeof HONOR_LAUNCH_VERSION;
export const isSupportedHonorVersion = (version: number): version is HonorVersion =>
  version === HONOR_LEGACY_VERSION || version === HONOR_VERSION || version === HONOR_CANDIDATE_VERSION || version === HONOR_LAUNCH_VERSION;
export const isHonorCandidate = (version: HonorVersion): boolean => version === HONOR_CANDIDATE_VERSION;
/** Accounting/catalogue capability is independent from release eligibility. */
export const honorAdvancedPolicy = (version: HonorVersion): boolean => version === HONOR_CANDIDATE_VERSION || version === HONOR_LAUNCH_VERSION;
export const honorSoloCredit = (version: HonorVersion): boolean => version === HONOR_VERSION || version === HONOR_LAUNCH_VERSION;
export const HONOR_MICROS = 1_000_000;
export const HONOR_PAIR_CAP = 200 * HONOR_MICROS;
export const HONOR_HISTORY_HOURS = 24;
export const HONOR_RELATION_DAYS = 7;

export function honorInteger(value: number, signed = false): bigint {
  if (!Number.isSafeInteger(value) || (!signed && value < 0)) throw new RangeError('Invalid Honor integer');
  return BigInt(value);
}

export function honorNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError('Unsafe Honor amount');
  }
  return Number(value);
}

export interface HonorComparison {
  /** Frozen galaxy/season maximum at dispatch. Absent on historical contracts. */
  galaxyTopTier?: number;
  ownTier: number;
  enemyTier: number;
  ownNavy: number;
  enemyNavy: number;
}

export interface HonorChallenge {
  kind: 'WEAK' | 'PEER' | 'UPPER';
  gainFactor: 0 | 500_000 | 1_000_000;
  tierNumerator: 4 | 5;
}

/** Public coarse bands, never the private exact enemy navy ratio. */
export function honorChallenge(q: HonorComparison): HonorChallenge {
  for (const tier of [q.ownTier, q.enemyTier, ...(q.galaxyTopTier === undefined ? [] : [q.galaxyTopTier])]) {
    if (honorInteger(tier) < 1n) throw new RangeError('Honor tier must be positive');
  }
  const a = honorInteger(q.ownNavy), d = honorInteger(q.enemyNavy);
  const topTierPeer = q.ownTier === q.galaxyTopTier && q.enemyTier === q.ownTier - 1;
  const weak = !topTierPeer && q.enemyTier < q.ownTier && (d < a || d === 0n);
  const upper = q.enemyTier > q.ownTier && d >= a && d > 0n;
  return {
    kind: weak ? 'WEAK' : upper ? 'UPPER' : 'PEER',
    gainFactor: a === 0n || 2n * d < a ? 0 : 4n * d < 3n * a ? 500_000 : 1_000_000,
    tierNumerator: upper ? 5 : 4,
  };
}

export interface HonorSideInput extends HonorComparison {
  /** Frozen at dispatch; absent historical contracts use 20%. */
  retaliationLootPercent?: 20 | 40;
  /** Enemy permanent armed losses, net of free ground reconstruction. */
  k: number;
  enemyLoss: number;
  /** Own permanent losses, including civilians. */
  l: number;
  loot: number;
  defending: boolean;
  weakRepeat: number;
  related: boolean;
  eligible: boolean;
  /** Five times resource value: preserves 20%/40% loot without fractional accounting. */
  retaliationFifths: number;
}

export interface HonorSideResult extends HonorChallenge {
  raw: number;
  gain: number;
  lossDebit: number;
  weakDebit: number;
  retaliationSpentFifths: number;
  bullying: boolean;
}

export function honorCombatBase(k: bigint, l: bigint): bigint {
  return k === 0n ? 0n : 1000n * k * (2n * k + l) / (2n * (k + l));
}

/** One common measure for provocation, retaliation consumption and weak sanctions. */
export function honorHarmFifths(loss: number, loot: number, lootPercent = 20): bigint {
  if (lootPercent !== 20 && lootPercent !== 40) throw new RangeError('Invalid Honor loot percentage');
  return 5n * honorInteger(loss) + BigInt(lootPercent / 20) * honorInteger(loot);
}

export function honorSide(q: HonorSideInput): HonorSideResult {
  const c = honorChallenge({ ...q, galaxyTopTier: q.defending ? undefined : q.galaxyTopTier });
  const k = honorInteger(q.k), l = honorInteger(q.l);
  const enemyLoss = honorInteger(q.enemyLoss), loot = honorInteger(q.loot);
  const budget = honorInteger(q.retaliationFifths);
  honorInteger(q.weakRepeat);
  if (k > enemyLoss) throw new RangeError('Armed losses exceed total permanent losses');
  if (q.defending && loot !== 0n) throw new RangeError('A defender cannot earn raid loot');
  const zero: HonorSideResult = { ...c, raw: 0, gain: 0, lossDebit: 0, weakDebit: 0, retaliationSpentFifths: 0, bullying: false };
  if (!q.eligible) return zero;
  const lossDebit = q.defending ? 0n : 100n * l;
  const bullying = !q.defending && c.kind === 'WEAK';
  if (bullying) {
    const exposure = honorHarmFifths(q.enemyLoss, q.loot, q.retaliationLootPercent);
    const used = budget < exposure ? budget : exposure;
    const weakDebit = 50n * (exposure - used) * BigInt(2 + Math.min(q.weakRepeat, 2)) / 2n;
    return { ...zero, raw: honorNumber(-weakDebit - lossDebit), lossDebit: honorNumber(lossDebit),
      weakDebit: honorNumber(weakDebit), retaliationSpentFifths: honorNumber(used), bullying };
  }
  const base = honorCombatBase(k, l), lootBonus = 100n * (loot < k ? loot : k);
  const gain = q.related ? 0n : (base + lootBonus) * BigInt(c.tierNumerator) / 4n * BigInt(c.gainFactor) / 1_000_000n;
  return { ...zero, raw: honorNumber(gain - lossDebit), gain: honorNumber(gain), lossDebit: honorNumber(lossDebit) };
}

export interface HonorWeight { actor: string; weight: number }
export interface HonorShare extends HonorWeight { points: number }

/** Merge waves before largest-remainder allocation. UUID only resolves micro-unit dust. */
export function honorSplit(pool: number, weights: readonly HonorWeight[]): HonorShare[] {
  const signed = honorInteger(pool, true), magnitude = signed < 0n ? -signed : signed;
  const merged = new Map<string, bigint>();
  for (const row of weights) {
    if (row.actor.length === 0) throw new Error('Missing Honor owner');
    merged.set(row.actor, (merged.get(row.actor) ?? 0n) + honorInteger(row.weight));
  }
  const rows = [...merged].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const total = rows.reduce((n, [, weight]) => n + weight, 0n);
  if (magnitude > 0n && total === 0n) throw new Error('Honor pool without participants');
  const shares = rows.map(([actor, weight]) => ({ actor, weight: honorNumber(weight),
    points: total === 0n ? 0 : honorNumber(magnitude * weight / total) }));
  const remainder = honorNumber(magnitude - shares.reduce((n, row) => n + BigInt(row.points), 0n));
  const sorted = shares.map((row, index) => ({ index, actor: row.actor,
    remainder: total === 0n ? 0n : magnitude * BigInt(row.weight) % total,
  })).sort((a, b) => a.remainder > b.remainder ? -1 : a.remainder < b.remainder ? 1 : a.actor < b.actor ? -1 : a.actor > b.actor ? 1 : 0);
  for (const row of sorted.slice(0, remainder)) {
    const share = shares[row.index];
    if (share) share.points++;
  }
  return shares.map(row => ({ ...row, points: signed < 0n && row.points !== 0 ? -row.points : row.points }));
}

/** Caller canonicalises the unordered pair and serialises updates in the transaction. */
export function honorPairCredit(rawBefore: number, aRaw: number, bRaw: number): { rawAfter: number; a: number; b: number } {
  const before = honorInteger(rawBefore), a = honorInteger(aRaw, true), b = honorInteger(bRaw, true);
  const aPositive = a > 0n ? a : 0n, bPositive = b > 0n ? b : 0n;
  const after = before + aPositive + bPositive, cap = BigInt(HONOR_PAIR_CAP);
  const rawAfter = honorNumber(after);
  const increment = cap * after / (cap + after) - cap * before / (cap + before);
  const shares = honorSplit(honorNumber(increment), [
    { actor: 'a', weight: honorNumber(aPositive) }, { actor: 'b', weight: honorNumber(bPositive) },
  ]);
  return { rawAfter, a: aRaw < 0 ? aRaw : shares.find(r => r.actor === 'a')?.points ?? 0,
    b: bRaw < 0 ? bRaw : shares.find(r => r.actor === 'b')?.points ?? 0 };
}

/** Only normal fire absorbed while armed defenders were alive; excludes shield-only burn. */
export function honorShieldWeight(input: { armedValue: number; investment: number; capacity: number; normalAbsorbed: number }): number {
  const armed = honorInteger(input.armedValue), investment = honorInteger(input.investment);
  const capacity = honorInteger(input.capacity), absorbed = honorInteger(input.normalAbsorbed);
  if (capacity === 0n || armed === 0n) return 0;
  const weight = investment * absorbed / capacity;
  return honorNumber(weight < armed ? weight : armed);
}
