import {
  honorChallenge, honorCombatBase, honorHarmFifths, honorInteger, honorNumber, honorPairCredit, honorSplit,
  type HonorShare, type HonorWeight,
} from './honor.js';

export interface HonorMember {
  id: string;
  tier: number;
  navy: number;
  /** Genuine owned military inventory before battle losses, never shield weight. */
  defenceNavy?: number;
  /** A successfully fired strategic charge affects efficiency, not casualty debit. */
  efficiencyCost?: number;
  /** Armed start value plus the host's capped, actually active shield contribution. */
  weight: number;
  /** Non-firing physical value, including disabled armed hulls. Negative-only fallback. */
  civilianWeight: number;
  loss: number;
  combatLoss: number;
  lootLost: number;
}

export interface HonorRelation {
  /** Offensive owner and opposing owner; retaliation/repeats are directional. */
  a: string;
  b: string;
  related: boolean;
  weakRepeat: number;
  retaliationFifths: number;
}

export interface HonorTeamInput {
  /** Frozen dispatch term; legacy evidence omits it and retains 20%. */
  retaliationLootPercent?: 20 | 40;
  /** Frozen v3 policy: shared sides retain attacking debits but have no positive gain. */
  soloPositiveOnly?: boolean;
  /** Candidate policy: genuine reactive defence need not have owned a navy at launch. */
  defendingZeroNavyFloor?: boolean;
  defendingCurrentNavy?: boolean;
  /** Actual tactical effect, measured by the server; base is micro-Honor before bands. */
  tactical?: readonly { actor: string; enemy: string; base: number; pressureFifths: number }[];
  /** Committed targets before voluntary defence support. Missing only on earlier evidence. */
  selectedDefenders?: readonly string[];
  attack: readonly HonorMember[];
  defence: readonly HonorMember[];
  eligible: boolean;
  relations: readonly HonorRelation[];
}

export interface HonorExposure {
  actor: string;
  enemy: string;
  positive: number;
  harmFifths: number;
  retaliationSpentFifths: number;
  bullying: boolean;
}

export interface HonorSidePool {
  raw: number;
  weights: HonorWeight[];
  exposures: HonorExposure[];
}
export interface HonorTeamPool { attack: HonorSidePool; defence: HonorSidePool }
export interface HonorPairState { a: string; b: string; raw: number }
export interface HonorTeamSettlement {
  attack: { total: number; shares: HonorShare[] };
  defence: { total: number; shares: HonorShare[] };
  pairs: HonorPairState[];
}

export function honorPairKey(a: string, b: string): string {
  if (!a || !b || a === b) throw new Error('Invalid Honor opponent pair');
  return JSON.stringify(a < b ? [a, b] : [b, a]);
}

function mergeMembers(rows: readonly HonorMember[]): HonorMember[] {
  const result = new Map<string, HonorMember>();
  for (const row of rows) {
    if (!row.id) throw new Error('Missing Honor member');
    honorChallenge({ ownTier: row.tier, ownNavy: row.navy, enemyTier: row.tier, enemyNavy: row.navy });
    if (row.defenceNavy !== undefined) honorInteger(row.defenceNavy);
    if (row.efficiencyCost !== undefined) honorInteger(row.efficiencyCost);
    for (const field of ['weight', 'civilianWeight', 'loss', 'combatLoss', 'lootLost'] as const) honorInteger(row[field]);
    if (row.combatLoss > row.loss) throw new Error('Armed losses exceed permanent losses');
    const previous = result.get(row.id);
    if (!previous) result.set(row.id, { ...row });
    else {
      if (row.tier !== previous.tier || row.navy !== previous.navy || row.defenceNavy !== previous.defenceNavy) throw new Error('Inconsistent owner snapshot');
      if (row.efficiencyCost !== undefined) previous.efficiencyCost = honorNumber(BigInt(previous.efficiencyCost ?? 0) + BigInt(row.efficiencyCost));
      for (const field of ['weight', 'civilianWeight', 'loss', 'combatLoss', 'lootLost'] as const) {
        previous[field] = honorNumber(BigInt(previous[field]) + BigInt(row[field]));
      }
    }
  }
  return [...result.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

const sum = (rows: readonly HonorMember[], field: 'weight' | 'combatLoss' | 'loss'): bigint =>
  rows.reduce((n, row) => n + BigInt(row[field]), 0n);

/** Count owners, never waves or kills. Keep empty selected hosts; ignore absent support. */
export function honorSideParticipantCount(input: Pick<HonorTeamInput, 'attack' | 'defence' | 'selectedDefenders'>,
  side: 'attack' | 'defence'): number {
  return new Set(input[side].filter(row => side === 'attack' || input.selectedDefenders === undefined
    || input.selectedDefenders.includes(row.id) || row.weight > 0 || row.civilianWeight > 0
    || row.loss > 0 || row.lootLost > 0).map(row => row.id)).size;
}

export function honorSharedSide(input: Pick<HonorTeamInput, 'attack' | 'defence' | 'selectedDefenders'>,
  side: 'attack' | 'defence'): boolean {
  return honorSideParticipantCount(input, side) > 1;
}

/** One efficiency calculation per side. There is deliberately no killer/last-hit field. */
export function honorTeam(input: HonorTeamInput): HonorTeamPool {
  const attack = mergeMembers(input.attack), defence = mergeMembers(input.defence);
  if (attack.length === 0) throw new Error('Missing attacking participants');
  if (attack.some(a => defence.some(d => d.id === a.id))) throw new Error('Opposing owner identity');
  if (input.selectedDefenders && (new Set(input.selectedDefenders).size !== input.selectedDefenders.length
    || input.selectedDefenders.some(id => !id || attack.some(a => a.id === id)))) throw new Error('Invalid selected Honor targets');
  if (attack.some(a => a.lootLost > 0)) throw new Error('Defenders cannot earn raid loot');
  const relations = new Map<string, HonorRelation>();
  for (const row of input.relations) {
    honorInteger(row.weakRepeat); honorInteger(row.retaliationFifths);
    if (!attack.some(a => a.id === row.a) || !defence.some(d => d.id === row.b)) throw new Error('Unrelated battle participant');
    const key = honorPairKey(row.a, row.b);
    if (relations.has(key)) throw new Error('Duplicate Honor relationship');
    relations.set(key, row);
  }
  const side = (own: HonorMember[], enemy: HonorMember[], defending: boolean): HonorSidePool => {
    const positiveBlocked = input.soloPositiveOnly && honorSharedSide(input, defending ? 'defence' : 'attack');
    const weightField = sum(own, 'weight') > 0n ? 'weight' : 'civilianWeight';
    const weights = own.map(row => ({ actor: row.id, weight: row[weightField] }));
    const W = weights.reduce((n, row) => n + BigInt(row.weight), 0n);
    const K = sum(enemy, 'combatLoss'), permanentLoss = sum(own, 'loss');
    const L = permanentLoss + own.reduce((n, row) => n + BigInt(row.efficiencyCost ?? 0), 0n);
    const base = honorCombatBase(K, L);
    const exposures: HonorExposure[] = [];
    if (!input.eligible || enemy.length === 0) return { raw: 0, weights, exposures };
    if (W === 0n && (L > 0n || K > 0n || enemy.some(row => row.lootLost > 0))) {
      throw new Error('Battle evidence without a participating force');
    }
    let numerator = 0n;
    for (const d of enemy) {
      const harm = defending ? 0 : honorNumber(honorHarmFifths(d.loss, d.lootLost, input.retaliationLootPercent));
      const harmShares = honorSplit(harm, weights);
      for (const a of own) {
        const relation = relations.get(honorPairKey(a.id, d.id));
        const ownNavy = defending && input.defendingCurrentNavy ? Math.max(a.navy, a.defenceNavy ?? a.navy)
          : defending && input.defendingZeroNavyFloor && a.navy === 0 ? a.weight : a.navy;
        const c = honorChallenge({ ownTier: a.tier, enemyTier: d.tier, ownNavy, enemyNavy: d.navy });
        const bullying = !defending && c.kind === 'WEAK'
          && (input.selectedDefenders === undefined || input.selectedDefenders.includes(d.id));
        const harmFifths = harmShares.find(row => row.actor === a.id)?.points ?? 0;
        const exposure: HonorExposure = { actor: a.id, enemy: d.id, positive: 0, harmFifths, retaliationSpentFifths: 0, bullying };
        if (bullying) {
          const used = Math.min(harmFifths, relation?.retaliationFifths ?? 0);
          exposure.retaliationSpentFifths = used;
          const penalty = 50n * BigInt(harmFifths - used) * BigInt(2 + Math.min(relation?.weakRepeat ?? 0, 2)) / 2n;
          numerator -= penalty * W;
        } else if (!positiveBlocked && (defending || c.kind !== 'WEAK') && weightField === 'weight' && !relation?.related) {
          const combat = K === 0n ? 0n : base * BigInt(d.combatLoss) / K;
          const loot = defending ? 0n : 100n * BigInt(Math.min(d.lootLost, d.combatLoss));
          const gain = (combat + loot) * BigInt(c.tierNumerator) / 4n * BigInt(c.gainFactor) / 1_000_000n;
          const term = gain * BigInt(a[weightField]);
          numerator += term;
          exposure.positive = W === 0n ? 0 : honorNumber(term / W);
        }
        exposures.push(exposure);
      }
    }
    if (!defending && input.tactical) for (const effect of input.tactical) {
      honorInteger(effect.base); honorInteger(effect.pressureFifths);
      const a = own.find(row => row.id === effect.actor), d = enemy.find(row => row.id === effect.enemy);
      if (!a || !d || W === 0n) throw new Error('Tactical effect has no committed participant');
      const exposure = exposures.find(row => row.actor === a.id && row.enemy === d.id)!;
      const relation = relations.get(honorPairKey(a.id, d.id));
      const c = honorChallenge({ ownTier: a.tier, enemyTier: d.tier, ownNavy: a.navy, enemyNavy: d.navy });
      const pressure = effect.pressureFifths;
      exposure.harmFifths = honorNumber(BigInt(exposure.harmFifths) + BigInt(pressure));
      if (exposure.bullying) {
        const used = Math.min(pressure, Math.max(0, (relation?.retaliationFifths ?? 0) - exposure.retaliationSpentFifths));
        exposure.retaliationSpentFifths += used;
        numerator -= 50n * BigInt(pressure - used) * BigInt(2 + Math.min(relation?.weakRepeat ?? 0, 2)) / 2n * W;
      } else if (!positiveBlocked && c.kind !== 'WEAK' && !relation?.related) {
        const gain = BigInt(effect.base) * BigInt(c.tierNumerator) / 4n * BigInt(c.gainFactor) / 1_000_000n;
        numerator += gain * W;
        exposure.positive = honorNumber(BigInt(exposure.positive) + gain);
      }
    }
    const raw = honorNumber((W === 0n ? 0n : numerator / W) - (defending ? 0n : 100n * permanentLoss));
    // Pair exposure reserves the NET positive side pool, never charges it twice.
    if (raw > 0) {
      const allocation = honorSplit(raw, exposures.map(e => ({ actor: honorPairKey(e.actor, e.enemy), weight: e.positive })));
      for (const exposure of exposures) exposure.positive = allocation.find(row => row.actor === honorPairKey(exposure.actor, exposure.enemy))?.points ?? 0;
    } else {
      for (const exposure of exposures) exposure.positive = 0;
    }
    return { raw, weights, exposures };
  };
  return { attack: side(attack, defence, false), defence: side(defence, attack, true) };
}

/** Reserve both sides together, then distribute the resulting COMMON side pool. */
export function honorTeamCredit(pool: HonorTeamPool, states: readonly HonorPairState[]): HonorTeamSettlement {
  const prior = new Map<string, HonorPairState>();
  for (const row of states) {
    honorInteger(row.raw);
    const key = honorPairKey(row.a, row.b);
    if (prior.has(key)) throw new Error('Duplicate Honor pair state');
    prior.set(key, row);
  }
  const reservations = new Map<string, { a: string; b: string; attack: number; defence: number }>();
  for (const side of ['attack', 'defence'] as const) {
    for (const exposure of pool[side].exposures) {
      const key = honorPairKey(exposure.actor, exposure.enemy);
      const previous = reservations.get(key) ?? { a: exposure.actor < exposure.enemy ? exposure.actor : exposure.enemy,
        b: exposure.actor < exposure.enemy ? exposure.enemy : exposure.actor, attack: 0, defence: 0 };
      previous[side] = honorNumber(BigInt(previous[side]) + honorInteger(exposure.positive));
      reservations.set(key, previous);
    }
  }
  let attackTotal = 0n, defenceTotal = 0n;
  const pairs: HonorPairState[] = [];
  for (const [key, row] of [...reservations].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    const credit = honorPairCredit(prior.get(key)?.raw ?? 0, row.attack, row.defence);
    attackTotal += BigInt(credit.a); defenceTotal += BigInt(credit.b);
    pairs.push({ a: row.a, b: row.b, raw: credit.rawAfter });
  }
  const attack = pool.attack.raw < 0 ? pool.attack.raw : honorNumber(attackTotal);
  const defence = pool.defence.raw < 0 ? pool.defence.raw : honorNumber(defenceTotal);
  return { attack: { total: attack, shares: honorSplit(attack, pool.attack.weights) },
    defence: { total: defence, shares: honorSplit(defence, pool.defence.weights) }, pairs };
}
