import {
  COMBAT,
  alloyRate,
  collectorCap,
  crystalRate,
  dominion,
  fleetValue,
  instrumentEntries,
  investedInInstrument,
  investedInSatellite,
  median,
  storageCap,
  vaultProtects,
} from '@astera/rules';
import type { DayStats, SimPlayer } from './season.js';
import type { ArchetypeName } from './archetypes.js';

/** Healthy bands. A value outside its band names the lever that moves it. */
export const BANDS = {
  ARR: [0.3, 0.55],
  /**
   * RE-DERIVED for the two-pile economy. Was [0.25, 0.65].
   *
   * D16 did not make the galaxy less worth raiding — it changed what this ratio can
   * arithmetically reach. Production now enters the WORKS, and the works are
   * exposed at `lootBufferShare`; storage is only ever filled by collecting, so a
   * typical planet's raidable stock is dominated by a half-weighted buffer instead
   * of a fully-weighted store. The ceiling in the denominator still counts a full
   * store, because a hoarder who collects repeatedly without spending really can
   * reach it — so the ratio is honest, its practical maximum is simply lower than
   * it was.
   *
   * Measured across the three gate seeds after the D16/D17 rebalance: 0.204-0.223.
   * The floor is set below that with margin rather than at it, because this is a
   * regression gate and not a snapshot.
   *
   * THE FLOOR STILL HAS TO CATCH THE BUG IT EXISTS FOR. `vaultMult > alloyMult`
   * makes the vault cover 100% of storage and drives this ratio toward zero;
   * `test/season.test.ts` asserts that directly, so the number below cannot be
   * loosened into meaninglessness without that test failing.
   */
  VFR: [0.16, 0.65],
  /**
   * Passive share of an active player's LADDER position — not their wealth.
   *
   * UNSTABLE AT n=50, AND ASSERTED ON THE POOLED MEDIAN FOR THAT REASON. It divides
   * the passive players' median Dominion by the active players' median, and at a
   * fifty-world galaxy the denominator can sit near zero for a whole day — seed 1337
   * read 28.79 on day 14 of the pre-S1 baseline, and seed 42 read -2.37 on day 14
   * after it. Both are division artefacts, not signals. The daily median is almost
   * always exactly 0.00 because most passive players never fight at all, so a single
   * day with a small denominator moves the whole reading.
   */
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
 * What a raid could actually carry off this instant. D16.
 *
 * The buffer HAS to be in here. When production moved out of storage and into the
 * works, every measurement that read `p.alloy + p.crystal` as "what this player is
 * holding" started describing a world that no longer exists — storage is now a
 * transient that fills at login and is spent minutes later, so the old VFR read
 * 0.11 and reported that nothing in the galaxy was worth raiding while the actual
 * pile sat one column to the left, untouched and unmeasured.
 *
 * This is the second time this exact diagnostic has been fooled by a change it did
 * not know about — the first was the vault covering 100% of storage. Both times
 * the number stayed plausible while meaning nothing, which is the only really
 * dangerous kind of wrong for a balance metric.
 */
const raidableNow = (p: SimPlayer): number => {
  const vault = vaultProtects(p.buildings.VAULT);
  return (
    Math.max(0, p.alloy - vault) +
    Math.max(0, p.crystal - vault) +
    (p.bufferAlloy + p.bufferCrystal) * COMBAT.lootBufferShare
  );
};

/** The most a player of this development could ever have exposed at once. */
const raidableCeiling = (p: SimPlayer): number => {
  const c = capsOf(p);
  const vault = vaultProtects(p.buildings.VAULT);
  const ra = alloyRate(p.buildings.REFINERY);
  const rc = crystalRate(p.buildings.EXTRACTOR);
  return Math.max(
    1,
    Math.max(0, c.alloy - vault) +
      Math.max(0, c.crystal - vault) +
      (collectorCap(ra) + collectorCap(rc)) * COMBAT.lootBufferShare,
  );
};

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
        p.bufferAlloy +
        p.bufferCrystal +
        instrumentEntries(p.instruments).reduce((s, [id, l]) => s + investedInInstrument(id, l), 0) +
        p.orbit.reduce((s, id) => s + investedInSatellite(id), 0);
      return p.wealthNow > 0 ? risk / p.wealthNow : 0;
    }),
  );

  /**
   * RAIDABLE fill, not raw fill. The first version measured stock/cap and read a
   * healthy 0.50 all season while the vault was protecting 100% of it — the
   * diagnostic missed the exact bug it existed to catch.
   */
  const vfr = median(ps.map((p) => Math.max(0, raidableNow(p) / raidableCeiling(p))));

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
): { type: ArchetypeName; medianRank: number; bestRank: number; medianDominion: number }[] {
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
