import { z } from 'zod';
import { HONOR_HISTORY_HOURS, HONOR_VERSION, HONOR_LAUNCH_VERSION, HONOR_CANDIDATE_VERSION, isSupportedHonorVersion, honorAdvancedPolicy, honorSoloCredit,
  honorNumber, honorPairKey, honorPairCredit, honorSplit, honorTeam, honorTeamCredit,
  type HonorVersion, type HonorTeamPool, type HonorTeamSettlement } from '@astera/rules';

const amount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const signed = z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
const identity = z.string().min(1);
const member = z.object({ id: identity, tier: amount.min(1), navy: amount, defenceNavy: amount.optional(), efficiencyCost: amount.optional(), weight: amount,
  civilianWeight: amount, loss: amount, combatLoss: amount, lootLost: amount }).strict();
export const honorEvidenceSchema = z.object({
  galaxyTopTier: amount.min(1).optional(),
  /** Owner 2026-10-30: lower tier is weak only below 75 % navy. Absent on older contracts. */
  weakNavyBand: z.literal(75).optional(),
  retaliationLootPercent: z.union([z.literal(20), z.literal(40)]).optional(),
  source: z.enum(['WORLD', 'CLAN_WAR', 'MONUMENT', 'STRATEGIC_IMPACT', 'STRATEGIC_INTERCEPTION']),
  id: identity, at: amount, eligible: z.boolean(), attack: z.array(member).min(1), defence: z.array(member),
  exclusion: z.enum(['TARGET_CHANGED', 'PARTICIPANT_JOINED_LATE']).optional(),
  selectedDefenders: z.array(identity).optional(),
  relations: z.array(z.object({ a: identity, b: identity, related: z.boolean() }).strict()),
  attackKey: identity.optional(),
  tactical: z.array(z.object({ actor: identity, enemy: identity, base: amount, pressureFifths: amount,
    radiation: z.object({ armedMicros: amount, allMicros: amount }).strict().optional() }).strict()).optional(),
  tacticalCap: z.object({ id: identity, limit: amount }).strict().optional(),
}).strict();
export type HonorEvidence = z.infer<typeof honorEvidenceSchema>;

export const honorStateSchema = z.object({
  lastAt: amount.nullable(), lastKey: z.string(),
  pairs: z.array(z.object({ a: identity, b: identity, raw: amount }).strict()),
  totals: z.array(z.object({ actor: identity, score: signed }).strict()),
  repeats: z.array(z.object({ a: identity, b: identity, at: amount, sourceKey: identity.optional(), step: amount.optional(),
    factor: z.object({ numerator: amount.min(2), denominator: amount.min(1) }).strict().optional() }).strict()),
  retaliations: z.array(z.object({ holder: identity, opponent: identity, at: amount, remaining: amount, sourceKey: identity }).strict()),
  effectUsed: z.array(z.object({ id: identity, value: amount }).strict()).optional(),
  radiationUsed: z.array(z.object({ id: identity, armedMicros: amount, allMicros: amount }).strict()).optional(),
}).strict();
export type HonorAccountingState = z.infer<typeof honorStateSchema>;
export interface HonorAccountedEvent extends HonorTeamSettlement { key: string; pool: HonorTeamPool }
export const emptyHonorState = (): HonorAccountingState => ({ lastAt: null, lastKey: '', pairs: [], totals: [], repeats: [], retaliations: [] });
export const honorEventKey = (e: Pick<HonorEvidence, 'source' | 'id'>): string => JSON.stringify([e.source, e.id]);

/** Snapshot relationships are exhaustive; an absent fact must not mean permission. */
function validateRelations(e: HonorEvidence): void {
  const expected = new Set(e.attack.flatMap(a => e.defence.map(d => JSON.stringify([a.id, d.id]))));
  const seen = new Set<string>();
  for (const row of e.relations) {
    const key = JSON.stringify([row.a, row.b]);
    if (!expected.has(key) || seen.has(key)) throw new Error('Invalid committed Honor relationship');
    seen.add(key);
  }
  if (seen.size !== expected.size) throw new Error('Incomplete committed Honor relationships');
  const effects = new Set<string>();
  for (const effect of e.tactical ?? []) {
    const key = JSON.stringify([effect.actor, effect.enemy]);
    if (!expected.has(key) || effects.has(key)) throw new Error('Invalid tactical Honor participants');
    effects.add(key);
  }
  if (e.tacticalCap && !e.tactical) throw new Error('Honor tactical cap without effects');
}

/** Whole 1,000-value health-damage bands hide exact private investment. Carry
 * sub-band evidence between intervals so frequent settlement never earns more. */
function prepareRadiation(state: HonorAccountingState, values: readonly HonorEvidence[]) {
  const entries = values.map(e => ({ ...e, ...(e.tactical ? { tactical: e.tactical.map(t => ({ ...t })) } : {}) }));
  const used = new Map((state.radiationUsed ?? []).map(row => [row.id, row]));
  const groups = new Map<string, { actor: string; weight: number; all: number; index: number; effect: number }[]>();
  entries.forEach((entry, index) => entry.tactical?.forEach((effect, n) => {
    if (!effect.radiation) return;
    if (!entry.attackKey || effect.base !== 0 || effect.pressureFifths !== 0
      || effect.radiation.armedMicros > effect.radiation.allMicros) throw new Error('Invalid radiation Honor evidence');
    const key = JSON.stringify([entry.attackKey, effect.actor, effect.enemy]);
    const slots = groups.get(key) ?? [];
    slots.push({ actor: String(index), weight: effect.radiation.armedMicros, all: effect.radiation.allMicros, index, effect: n });
    groups.set(key, slots);
  }));
  for (const [id, slots] of groups) {
    const previous = used.get(id) ?? { id, armedMicros: 0, allMicros: 0 };
    const armedMicros = slots.reduce((n, row) => add(n, row.weight), previous.armedMicros);
    const allMicros = slots.reduce((n, row) => add(n, row.all), previous.allMicros);
    const band = 1_000_000_000n;
    const base = honorNumber((BigInt(armedMicros) / band - BigInt(previous.armedMicros) / band) * 1_000_000n);
    const pressure = honorNumber((BigInt(allMicros) / band - BigInt(previous.allMicros) / band) * 5000n);
    const gains = honorSplit(base, slots), harms = honorSplit(pressure, slots.map(row => ({ actor: row.actor, weight: row.all })));
    for (const slot of slots) {
      const effect = entries[slot.index]!.tactical![slot.effect]!;
      effect.base = gains.find(row => row.actor === slot.actor)?.points ?? 0;
      effect.pressureFifths = harms.find(row => row.actor === slot.actor)?.points ?? 0;
    }
    used.set(id, { id, armedMicros, allMicros });
  }
  return { entries, projection: used.size === 0 && state.radiationUsed === undefined ? {} : {
    radiationUsed: [...used.values()].sort((a, b) => compare(a.id, b.id)),
  } };
}

/** One finite tactical return per weapon, shared across victims and lazy intervals.
 * The cap affects gains only; actual pressure and weak-target sanctions stay intact. */
function capTacticalPools(state: HonorAccountingState, entries: readonly HonorEvidence[], pools: HonorTeamPool[]) {
  const used = new Map((state.effectUsed ?? []).map(row => [row.id, row.value]));
  const groups = new Map<string, { limit: number; slots: { actor: string; weight: number }[] }>();
  entries.forEach((entry, index) => {
    const cap = entry.tacticalCap;
    if (!cap) return;
    const group = groups.get(cap.id) ?? { limit: cap.limit, slots: [] };
    if (group.limit !== cap.limit) throw new Error('Conflicting Honor tactical source cap');
    group.slots.push({ actor: String(index), weight: Math.max(0, pools[index]!.attack.raw) });
    groups.set(cap.id, group);
  });
  for (const [id, { limit, slots }] of groups) {
    const requested = slots.reduce((sum, row) => add(sum, row.weight), 0);
    const permitted = Math.min(requested, Math.max(0, limit - (used.get(id) ?? 0)));
    for (const share of honorSplit(permitted, slots)) {
      const pool = pools[Number(share.actor)]!.attack;
      if (pool.raw <= 0) continue;
      pool.raw = share.points;
      const weights = pool.exposures.map(e => ({ actor: honorPairKey(e.actor, e.enemy), weight: e.positive }));
      const shares = honorSplit(share.points, weights);
      for (const e of pool.exposures) e.positive = shares.find(s => s.actor === honorPairKey(e.actor, e.enemy))?.points ?? 0;
    }
    used.set(id, add(used.get(id) ?? 0, permitted));
  }
  return used.size === 0 && state.effectUsed === undefined ? {} : {
    effectUsed: [...used].sort(([a], [b]) => compare(a, b)).map(([id, value]) => ({ id, value })),
  };
}

/** Preserve the exact initial multiplier of a simultaneous lingering attack.
 * Physical settlement frequency must not make the same radiation cheaper. */
function continuationPenalty(pool: HonorTeamPool, evidence: HonorEvidence, repeats: HonorAccountingState['repeats']) {
  if (!evidence.attackKey) return;
  for (const exposure of pool.attack.exposures) {
    if (!exposure.bullying) continue;
    const prior = repeats.find(row => row.a === exposure.actor && row.b === exposure.enemy && row.sourceKey === evidence.attackKey);
    if (!prior?.factor) continue;
    const harm = BigInt(exposure.harmFifths - exposure.retaliationSpentFifths);
    const original = 50n * harm * BigInt(2 + Math.min(prior.step ?? 0, 2)) / 2n;
    const actual = 50n * harm * BigInt(prior.factor.numerator) / (2n * BigInt(prior.factor.denominator));
    pool.attack.raw = add(pool.attack.raw, honorNumber(original - actual));
  }
  const shares = pool.attack.raw <= 0 ? [] : honorSplit(pool.attack.raw,
    pool.attack.exposures.map(row => ({ actor: honorPairKey(row.actor, row.enemy), weight: row.positive })));
  for (const row of pool.attack.exposures) row.positive = shares.find(share => share.actor === honorPairKey(row.actor, row.enemy))?.points ?? 0;
}

/** Caller holds the season's Honor lock. No wall clock and no client-authored budgets. */
export function advanceHonor(state: HonorAccountingState, value: unknown, version: HonorVersion = HONOR_VERSION): { state: HonorAccountingState; event: HonorAccountedEvent } {
  if (!isSupportedHonorVersion(version)) throw new Error('Unsupported frozen Honor version');
  const parsed = honorEvidenceSchema.parse(value);
  const prepared = prepareRadiation(state, [parsed]);
  const e = prepared.entries[0]!, key = honorEventKey(e);
  if (version !== HONOR_LAUNCH_VERSION && (e.tactical || e.tacticalCap)) throw new Error('Tactical Honor requires launch policy');
  validateRelations(e);
  if (state.lastAt !== null && (e.at < state.lastAt || (e.at === state.lastAt && key <= state.lastKey))) {
    throw new Error('Honor chronological rebuild required');
  }
  const since = e.at - HONOR_HISTORY_HOURS * 3_600_000;
  const repeats = state.repeats.filter(r => r.at > since);
  const retaliations = state.retaliations.filter(r => r.at > since && r.remaining > 0).map(row => ({ ...row }));
  const relations = e.relations.map(row => ({ ...row,
    weakRepeat: (e.attackKey ? repeats.find(r => r.a === row.a && r.b === row.b && r.sourceKey === e.attackKey)?.step : undefined)
      ?? repeats.filter(r => r.a === row.a && r.b === row.b && (!e.attackKey || r.sourceKey !== e.attackKey)).length,
    retaliationFifths: honorNumber(retaliations.filter(r => r.holder === row.a && r.opponent === row.b && r.at < e.at)
      .reduce((n, r) => n + BigInt(r.remaining), 0n)),
  }));
  const pool = honorTeam({ ...e, relations, defendingZeroNavyFloor: version === HONOR_CANDIDATE_VERSION, defendingCurrentNavy: version === HONOR_LAUNCH_VERSION,
    soloPositiveOnly: honorSoloCredit(version) });
  if (version === HONOR_LAUNCH_VERSION) continuationPenalty(pool, e, repeats);
  const effects = capTacticalPools(state, [e], [pool]);
  const settlement = honorTeamCredit(pool, state.pairs);
  const pairs = new Map(state.pairs.map(p => [honorPairKey(p.a, p.b), p]));
  for (const pair of settlement.pairs) pairs.set(honorPairKey(pair.a, pair.b), pair);
  const totals = new Map(state.totals.map(p => [p.actor, p.score]));
  for (const side of [settlement.attack, settlement.defence]) for (const share of side.shares) {
    totals.set(share.actor, honorNumber(BigInt(totals.get(share.actor) ?? 0) + BigInt(share.points)));
  }
  for (const exposure of pool.attack.exposures) {
    let remaining = exposure.retaliationSpentFifths;
    // State is appended in effective time order, hence oldest unspent grant first.
    for (const grant of retaliations) {
      if (grant.holder !== exposure.actor || grant.opponent !== exposure.enemy || grant.at >= e.at) continue;
      const spent = Math.min(remaining, grant.remaining);
      grant.remaining -= spent; remaining -= spent;
    }
    if (remaining !== 0) throw new Error('Honor retaliation overdraw');
    if (exposure.bullying && exposure.harmFifths > 0 && (!e.attackKey || !repeats.some(r => r.a === exposure.actor && r.b === exposure.enemy && r.sourceKey === e.attackKey))) {
      repeats.push({ a: exposure.actor, b: exposure.enemy, at: e.at, ...(e.attackKey ? {
        sourceKey: e.attackKey, step: relations.find(r => r.a === exposure.actor && r.b === exposure.enemy)?.weakRepeat ?? 0,
        ...(version === HONOR_LAUNCH_VERSION ? { factor: { numerator: 2 + Math.min(relations.find(r => r.a === exposure.actor && r.b === exposure.enemy)?.weakRepeat ?? 0, 2), denominator: 1 } } : {}),
      } : {}) });
    }
    const newHarm = exposure.harmFifths - exposure.retaliationSpentFifths;
    if (newHarm > 0) retaliations.push({ holder: exposure.enemy, opponent: exposure.actor,
      at: e.at, remaining: newHarm, sourceKey: key });
  }
  return { event: { ...settlement, key, pool }, state: {
    lastAt: e.at, lastKey: key, ...effects, ...prepared.projection,
    pairs: [...pairs.values()].sort((a, b) => compare(honorPairKey(a.a, a.b), honorPairKey(b.a, b.b))),
    totals: [...totals].sort(([a], [b]) => compare(a, b)).map(([actor, score]) => ({ actor, score })),
    repeats, retaliations: retaliations.filter(r => r.remaining > 0),
  } };
}

const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const directional = (a: string, b: string): string => JSON.stringify([a, b]);
const exposureKey = (event: HonorEvidence, a: string, b: string): string => JSON.stringify([honorEventKey(event), a, b]);
const add = (a: number, b: number): number => honorNumber(BigInt(a) + BigInt(b));

/** Independent battles keep their own efficiency pools; only scarce accounting is shared. */
function advanceSimultaneousHonor(state: HonorAccountingState, inputGroup: readonly HonorEvidence[], version: HonorVersion): {
  state: HonorAccountingState; events: HonorAccountedEvent[];
} {
  const prepared = prepareRadiation(state, inputGroup);
  const group = prepared.entries;
  const at = group[0]!.at, since = at - HONOR_HISTORY_HOURS * 3_600_000;
  // Reuse exhaustive relationship, member and chronological validation. These
  // throwaway calculations never consume the real prior state or its grants.
  for (const row of inputGroup) advanceHonor(state, row, version);
  const repeats = state.repeats.filter(row => row.at > since);
  const grants = state.retaliations.filter(row => row.at > since && row.remaining > 0).map(row => ({ ...row }));
  const priorRepeats = (a: string, b: string, source?: string) => (source
    ? repeats.find(row => row.a === a && row.b === b && row.sourceKey === source)?.step : undefined)
    ?? repeats.filter(row => row.a === a && row.b === b && row.at < at && (!source || row.sourceKey !== source)).length;
  const available = (a: string, b: string) => grants.filter(row => row.holder === a && row.opponent === b && row.at < at)
    .reduce((sum, row) => add(sum, row.remaining), 0);
  const allocations = new Map<string, number>();
  const harmful = new Map<string, { a: string; b: string; slots: { actor: string; weight: number }[] }>();
  for (const row of group) {
    const pool = honorTeam({ ...row, defendingZeroNavyFloor: version === HONOR_CANDIDATE_VERSION, defendingCurrentNavy: version === HONOR_LAUNCH_VERSION, soloPositiveOnly: honorSoloCredit(version), relations: row.relations.map(r => ({ ...r,
      weakRepeat: priorRepeats(r.a, r.b, row.attackKey), retaliationFifths: 0 })) });
    for (const exposure of pool.attack.exposures.filter(e => e.bullying && e.harmFifths > 0)) {
      const key = directional(exposure.actor, exposure.enemy);
      const pair = harmful.get(key) ?? { a: exposure.actor, b: exposure.enemy, slots: [] };
      pair.slots.push({ actor: exposureKey(row, exposure.actor, exposure.enemy), weight: exposure.harmFifths });
      harmful.set(key, pair);
    }
  }
  for (const { a, b, slots } of harmful.values()) {
    const total = slots.reduce((sum, row) => add(sum, row.weight), 0);
    for (const share of honorSplit(Math.min(total, available(a, b)), slots)) allocations.set(share.actor, share.points);
  }
  const pools = group.map(row => honorTeam({ ...row, defendingZeroNavyFloor: version === HONOR_CANDIDATE_VERSION, defendingCurrentNavy: version === HONOR_LAUNCH_VERSION, soloPositiveOnly: honorSoloCredit(version), relations: row.relations.map(r => ({ ...r,
    weakRepeat: priorRepeats(r.a, r.b, row.attackKey), retaliationFifths: allocations.get(exposureKey(row, r.a, r.b)) ?? 0 })) }));
  const penalties = new Map<string, number>();
  const sourceFactors = new Map<string, { numerator: number; denominator: number }>();
  const factorKey = (a: string, b: string, source: string) => JSON.stringify([a, b, source]);
  for (const { a, b, slots } of harmful.values()) {
    const sources = [...new Set(slots.map(slot => group.find(row => exposureKey(row, a, b) === slot.actor)?.attackKey ?? slot.actor))];
    const oldSources = new Set(repeats.filter(r => r.a === a && r.b === b).map(r => r.sourceKey));
    const newCount = sources.filter(id => !oldSources.has(id)).length;
    const before = priorRepeats(a, b), count = Math.max(1, newCount);
    const factors = Array.from({ length: count }, (_, n) => 2 + Math.min(before + n, 2)).reduce((sum, n) => sum + n, 0);
    const remaining = pools.flatMap((pool, index) => pool.attack.exposures
      .filter(e => e.actor === a && e.enemy === b && e.bullying && e.harmFifths > 0)
      .map(e => ({ actor: exposureKey(group[index]!, a, b), weight: e.harmFifths - e.retaliationSpentFifths })));
    for (const source of sources) {
      const sourceSlots = remaining.filter(slot => {
        const row = group.find(e => exposureKey(e, a, b) === slot.actor)!;
        return (row.attackKey ?? slot.actor) === source;
      });
      const total = sourceSlots.reduce((sum, row) => add(sum, row.weight), 0);
      const known = oldSources.has(source);
      const saved = version === HONOR_LAUNCH_VERSION
        ? repeats.find(row => row.a === a && row.b === b && row.sourceKey === source)?.factor : undefined;
      const factor = saved?.numerator ?? (known ? 2 + Math.min(priorRepeats(a, b, source), 2) : factors);
      const divisor = saved?.denominator ?? (known ? 1 : count);
      sourceFactors.set(factorKey(a, b, source), { numerator: factor, denominator: divisor });
      const debit = honorNumber(50n * BigInt(total) * BigInt(factor) / (2n * BigInt(divisor)));
      for (const share of honorSplit(debit, sourceSlots)) penalties.set(share.actor, share.points);
    }
  }
  for (const [index, pool] of pools.entries()) {
    for (const e of pool.attack.exposures.filter(e => e.bullying && e.harmFifths > 0)) {
      const old = 50n * BigInt(e.harmFifths - e.retaliationSpentFifths) * BigInt(2 + Math.min(priorRepeats(e.actor, e.enemy, group[index]!.attackKey), 2)) / 2n;
      const next = BigInt(penalties.get(exposureKey(group[index]!, e.actor, e.enemy)) ?? 0);
      pool.attack.raw = add(pool.attack.raw, honorNumber(old - next));
    }
    const shares = pool.attack.raw <= 0 ? [] : honorSplit(pool.attack.raw,
      pool.attack.exposures.map(e => ({ actor: honorPairKey(e.actor, e.enemy), weight: e.positive })));
    for (const e of pool.attack.exposures) e.positive = shares.find(row => row.actor === honorPairKey(e.actor, e.enemy))?.points ?? 0;
  }
  const effects = capTacticalPools(state, group, pools);
  const pairs = new Map(state.pairs.map(pair => [honorPairKey(pair.a, pair.b), pair]));
  const reservations = new Map<string, { a: string; b: string; slots: { actor: string; weight: number }[] }>();
  const sideKey = (index: number, side: 'attack' | 'defence') => JSON.stringify([honorEventKey(group[index]!), side]);
  for (const [index, pool] of pools.entries()) for (const side of ['attack', 'defence'] as const) {
    for (const e of pool[side].exposures) {
      const key = honorPairKey(e.actor, e.enemy);
      const pair = reservations.get(key) ?? { a: e.actor < e.enemy ? e.actor : e.enemy,
        b: e.actor < e.enemy ? e.enemy : e.actor, slots: [] };
      pair.slots.push({ actor: sideKey(index, side), weight: e.positive }); reservations.set(key, pair);
    }
  }
  const credits = new Map<string, number>();
  for (const [key, pair] of reservations) {
    const raw = pair.slots.reduce((sum, row) => add(sum, row.weight), 0);
    const settled = honorPairCredit(pairs.get(key)?.raw ?? 0, raw, 0);
    pairs.set(key, { a: pair.a, b: pair.b, raw: settled.rawAfter });
    for (const share of honorSplit(settled.a, pair.slots)) credits.set(share.actor, add(credits.get(share.actor) ?? 0, share.points));
  }
  const totals = new Map(state.totals.map(row => [row.actor, row.score]));
  const events: HonorAccountedEvent[] = [];
  for (const [index, pool] of pools.entries()) {
    const key = honorEventKey(group[index]!);
    const credited = (side: 'attack' | 'defence') => {
      const total = pool[side].raw < 0 ? pool[side].raw : credits.get(sideKey(index, side)) ?? 0;
      const shares = honorSplit(total, pool[side].weights);
      for (const row of shares) totals.set(row.actor, add(totals.get(row.actor) ?? 0, row.points));
      return { total, shares };
    };
    const touched = new Set([...pool.attack.exposures, ...pool.defence.exposures].map(e => honorPairKey(e.actor, e.enemy)));
    events.push({ key, pool, attack: credited('attack'), defence: credited('defence'),
      pairs: [...pairs].filter(([key]) => touched.has(key)).map(([, pair]) => pair)
        .sort((a, b) => compare(honorPairKey(a.a, a.b), honorPairKey(b.a, b.b))) });
    for (const e of pool.attack.exposures) {
      let remaining = e.retaliationSpentFifths;
      for (const grant of grants) {
        if (grant.holder !== e.actor || grant.opponent !== e.enemy || grant.at >= at) continue;
        const spent = Math.min(remaining, grant.remaining); grant.remaining -= spent; remaining -= spent;
      }
      if (remaining !== 0) throw new Error('Honor retaliation overdraw');
      if (e.bullying && e.harmFifths > 0 && (!group[index]!.attackKey || !repeats.some(r => r.a === e.actor && r.b === e.enemy && r.sourceKey === group[index]!.attackKey))) {
        repeats.push({ a: e.actor, b: e.enemy, at, ...(group[index]!.attackKey ? {
          sourceKey: group[index]!.attackKey, step: priorRepeats(e.actor, e.enemy, group[index]!.attackKey),
          ...(version === HONOR_LAUNCH_VERSION ? { factor: sourceFactors.get(factorKey(e.actor, e.enemy, group[index]!.attackKey)) } : {}),
        } : {}) });
      }
      const harm = e.harmFifths - e.retaliationSpentFifths;
      if (harm > 0) grants.push({ holder: e.enemy, opponent: e.actor, at, remaining: harm, sourceKey: key });
    }
  }
  return { events, state: { lastAt: at, lastKey: honorEventKey(group.at(-1)!),
    ...effects, ...prepared.projection, pairs: [...pairs.values()].sort((a, b) => compare(honorPairKey(a.a, a.b), honorPairKey(b.a, b.b))),
    totals: [...totals].sort(([a], [b]) => compare(a, b)).map(([actor, score]) => ({ actor, score })),
    repeats, retaliations: grants.filter(row => row.remaining > 0) } };
}

/** Late events rebuild all dependent common pools, not just the two visible players. */
export function replayHonor(values: readonly unknown[], version: HonorVersion = HONOR_VERSION): HonorAccountingState & { events: HonorAccountedEvent[] } {
  if (!isSupportedHonorVersion(version)) throw new Error('Unsupported frozen Honor version');
  const entries = values.map(value => honorEvidenceSchema.parse(value))
    .sort((a, b) => a.at - b.at || compare(honorEventKey(a), honorEventKey(b)));
  const seen = new Set<string>(), events: HonorAccountedEvent[] = [];
  for (const e of entries) {
    const key = honorEventKey(e);
    if (seen.has(key)) throw new Error('Duplicate Honor event');
    seen.add(key);
  }
  let state = emptyHonorState();
  for (let start = 0; start < entries.length;) {
    let end = start + 1;
    if (honorAdvancedPolicy(version)) while (entries[end]?.at === entries[start]!.at) end++;
    if (end === start + 1) {
      const result = advanceHonor(state, entries[start], version);
      state = result.state; events.push(result.event);
    } else {
      const result = advanceSimultaneousHonor(state, entries.slice(start, end), version);
      state = result.state; events.push(...result.events);
    }
    start = end;
  }
  return { ...state, events };
}
