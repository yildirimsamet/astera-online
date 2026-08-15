import {
  alloyRate,
  crystalRate,
  dominion,
  fleetValue,
  investedInBuilding,
  median,
  storageCap,
  vaultProtects,
} from '@blindspace/rules';
import type { DayStats, SimPlayer } from './season.js';
import type { ArchetypeName } from './archetypes.js';

/** Healthy bands. A value outside its band names the lever that moves it. */
export const BANDS = {
  ARR: [0.3, 0.55],
  VFR: [0.25, 0.65],
  /** Passive share of an active player's LADDER position — not their wealth. */
  TI: [-0.4, 0.55],
  RR: [1.3, 3.5],
  SV: [0.1, 0.3],
  TAX: [0.1, 0.45],
} as const;

export type InvariantKey = keyof typeof BANDS;

export const LEVERS: Record<InvariantKey, string> = {
  ARR: 'building cost vs ship cost balance',
  VFR: 'upgrade lumpiness (costMult / capHours). LOW means nothing is worth raiding.',
  TI: 'loot grades, Bastion cost-efficiency, disruption duration',
  RR: 'loot grades, defenceSalvage, hull HP',
  SV: 'loot %, travel times',
  TAX: 'disruption duration, loot %, attack frequency',
};

export type Invariants = Record<InvariantKey, number>;

const capsOf = (p: SimPlayer) => ({
  alloy: storageCap(alloyRate(p.buildings.REFINERY)),
  crystal: storageCap(crystalRate(p.buildings.EXTRACTOR)),
});

/**
 * Must be called AT the day boundary, not afterwards: the per-day counters are
 * reset once the day rolls over, so holding a reference to the live player array
 * silently measures a world where nothing ever happened.
 */
export function measure(
  day: number,
  ps: readonly SimPlayer[],
  stats: DayStats,
): Invariants {

  const arr = median(
    ps.map((p) => {
      const risk =
        fleetValue(p.fleet) +
        p.alloy +
        p.crystal +
        Object.values(p.satellites).reduce((s, l) => s + investedInBuilding(l ?? 0), 0);
      return p.wealthNow > 0 ? risk / p.wealthNow : 0;
    }),
  );

  /**
   * RAIDABLE fill, not raw fill. The first version measured stock/cap and read a
   * healthy 0.50 all season while the vault was protecting 100% of it — the
   * diagnostic missed the exact bug it existed to catch.
   */
  const vfr = median(
    ps.map((p) => {
      const c = capsOf(p);
      const vault = vaultProtects(p.buildings.VAULT);
      const raidable = Math.max(0, p.alloy - vault) + Math.max(0, p.crystal - vault);
      const cap = Math.max(1, c.alloy - vault + (c.crystal - vault));
      return Math.max(0, raidable / cap);
    }),
  );

  const cutoff = day * 1440 - 2880;
  const passive = ps.filter((p) => p.attacks.filter((x) => x > cutoff).length === 0);
  const active = ps.filter((p) => p.attacks.filter((x) => x > cutoff).length >= 3);
  const activeDom = active.length ? median(active.map((p) => dominion(p.ledger))) : 0;
  const passiveDom = passive.length ? median(passive.map((p) => dominion(p.ledger))) : 0;
  const ti = activeDom > 0 ? passiveDom / activeDom : NaN;

  /** Dominion gained per unit spent gaining it — loot alone understates a raid. */
  const rr =
    stats.attackerLossValue > 0
      ? (stats.lootValue + stats.defenderLossValue) / stats.attackerLossValue
      : NaN;

  const sv = median(
    ps.map((p) => {
      const prev = p.wealthHistory.at(-1);
      return prev && p.wealthNow > 0 ? Math.abs(p.wealthNow - prev) / p.wealthNow : 0;
    }),
  );

  /**
   * Mean, not median: on any given day most players are not raided at all, so the
   * median peaceful player always reads 0.00 and the diagnostic says nothing.
   * Counts production DENIED by disruption as well as resources taken.
   */
  const taxes = passive.map((p) => {
    const dayProd =
      (alloyRate(p.buildings.REFINERY) + crystalRate(p.buildings.EXTRACTOR)) * 24;
    const denied =
      (alloyRate(p.buildings.REFINERY) + crystalRate(p.buildings.EXTRACTOR)) *
      (p.disruptedToday / 60);
    return dayProd > 0 ? Math.min(2, (p.lossToday + denied) / dayProd) : 0;
  });
  const tax = taxes.length ? taxes.reduce((a, b) => a + b, 0) / taxes.length : NaN;

  return { ARR: arr, VFR: vfr, TI: ti, RR: rr, SV: sv, TAX: tax };
}

export type Verdict = 'OK' | 'LOW' | 'HIGH' | 'n/a';

export function verdict(key: InvariantKey, value: number): Verdict {
  if (Number.isNaN(value)) return 'n/a';
  const [lo, hi] = BANDS[key];
  return value < lo ? 'LOW' : value > hi ? 'HIGH' : 'OK';
}

/** Median rank on the Dominion ladder, by archetype. Lower is better. */
export function ladderByArchetype(
  players: readonly SimPlayer[],
): Array<{ type: ArchetypeName; medianRank: number; bestRank: number; medianDominion: number }> {
  const ladder = [...players].sort((a, b) => dominion(b.ledger) - dominion(a.ledger));
  const ranks = new Map<ArchetypeName, number[]>();
  ladder.forEach((p, i) => {
    const list = ranks.get(p.type) ?? [];
    list.push(i + 1);
    ranks.set(p.type, list);
  });
  return [...ranks.entries()]
    .map(([type, rs]) => ({
      type,
      medianRank: median(rs),
      bestRank: rs[0] ?? 0,
      medianDominion: median(
        players.filter((p) => p.type === type).map((p) => dominion(p.ledger)),
      ),
    }))
    .sort((a, b) => a.medianRank - b.medianRank);
}

/** The design's central claim, as a boolean. */
export const informedArchetypeWins = (players: readonly SimPlayer[]): boolean =>
  ladderByArchetype(players)[0]?.type === 'GRINDER';
