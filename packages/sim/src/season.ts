import {
  ABUSE,
  ALL_HULLS,
  collectorCap,
  GROUND_HULLS,
  HULLS,
  MOBILE_HULLS,
  counterMult,
  advanceEconomy,
  alloyRate,
  applyDisruption,
  bookBattle,
  canAttack,
  collect,
  computeLoot,
  crystalRate,
  distance,
  dominion,
  emptyLedger,
  fleetCargo,
  fleetCount,
  fleetEntries,
  fleetSpeed,
  fleetSpeedMult,
  fleetValue,
  generateGalaxy,
  START,
  investedInBuilding,
  mulberry32,
  resolveCombat,
  instrumentCost,
  isSatellite,
  productionMult,
  satelliteCost,
  satelliteSlots,
  seeingUnlocked,
  storageCap,
  travelMinutes,
  upgradeCost,
  vaultProtects,
  wealth,
  type BuildingLevels,
  type Fleet,
  type Ledger,
  type Rng,
  type GroundHullId,
  type InstrumentLevels,
  type SatelliteId,
} from '@blindspace/rules';
import { ARCHETYPES, ARCHETYPE_NAMES, type ArchetypeName, type CombatHullId, type Composition } from './archetypes.js';
import { measure, type Invariants } from './invariants.js';

export interface SimPlayer {
  id: number;
  name: string;
  type: ArchetypeName;
  x: number; y: number; z: number;
  buildings: BuildingLevels;
  instruments: InstrumentLevels;
  /** What is in orbit. Presence is the whole state — D25. */
  orbit: SatelliteId[];
  fleet: Fleet;
  ground: Fleet;
  alloy: number;
  crystal: number;
  /** Uncollected production sitting in the works. D16. */
  bufferAlloy: number;
  bufferCrystal: number;
  shield: number;
  lastTick: number;
  joinedAt: number;
  disruptedUntil: number;
  nextLogin: number;
  ledger: Ledger;
  attacks: number[];
  scoutsSent: number;
  lootToday: number;
  lossToday: number;
  disruptedToday: number;
  wealthNow: number;
  wealthHistory: number[];
  recentHits: Map<number, number[]>;
  /** What a probe last measured: what could be carried off, and what defends it. */
  intel: Map<number, { stock: number; defence: number; composition: Fleet; at: number }>;
  neighbours: { id: number; d: number }[];
}

export interface Mission {
  from: number;
  to: number;
  fleet: Fleet;
  arriveAt: number;
  distance: number;
  scouted: boolean;
  returning: boolean;
  loot?: { alloy: number; crystal: number };
}

export interface DayStats {
  attacks: number;
  lootValue: number;
  attackerLossValue: number;
  defenderLossValue: number;
  disruptedMinutes: number;
  byGrade: Record<'DECISIVE' | 'PARTIAL' | 'REPELLED', number>;
  scoutedAttacks: number; scoutedGain: number; scoutedLoss: number;
  blindAttacks: number; blindGain: number; blindLoss: number;
}

export const freshStats = (): DayStats => ({
  attacks: 0, lootValue: 0, attackerLossValue: 0, defenderLossValue: 0,
  disruptedMinutes: 0,
  byGrade: { DECISIVE: 0, PARTIAL: 0, REPELLED: 0 },
  scoutedAttacks: 0, scoutedGain: 0, scoutedLoss: 0,
  blindAttacks: 0, blindGain: 0, blindLoss: 0,
});

export interface SimConfig {
  players: number;
  days: number;
  seed: number;
}

export interface World {
  players: SimPlayer[];
  missions: Mission[];
  rng: Rng;
}

/* ── setup ─────────────────────────────────────────────────────── */

export function buildWorld(cfg: SimConfig): World {
  const rng = mulberry32(cfg.seed);
  const galaxy = generateGalaxy(cfg.seed, cfg.players);

  const names: ArchetypeName[] = [];
  for (const type of ARCHETYPE_NAMES) {
    const n = Math.max(1, Math.round(cfg.players * ARCHETYPES[type].share));
    for (let i = 0; i < n; i++) names.push(type);
  }
  while (names.length < cfg.players) names.push('CASUAL');
  names.length = cfg.players;

  const players: SimPlayer[] = galaxy.slots.map((slot, i) => ({
    id: i,
    name: `P${String(i).padStart(3, '0')}`,
    type: names[i] ?? 'CASUAL',
    x: slot.x, y: slot.y, z: slot.z,
    buildings: { CORE: 1, REFINERY: 1, EXTRACTOR: 1, VAULT: 0, SHIPYARD: 0 },
    instruments: {},
    orbit: [],
    // D22: no starting fleet, and the grant is what the opening costs. Mirrors
    // `joinSeason` exactly — a simulation that opens differently from the game is
    // measuring a different game.
    fleet: {},
    ground: {},
    alloy: START.alloy, crystal: START.crystal,
    bufferAlloy: 0, bufferCrystal: 0,
    shield: 0, lastTick: 0, joinedAt: 0, disruptedUntil: 0,
    nextLogin: Math.floor(rng() * 240),
    ledger: emptyLedger(),
    attacks: [], scoutsSent: 0,
    lootToday: 0, lossToday: 0, disruptedToday: 0,
    wealthNow: 0, wealthHistory: [],
    recentHits: new Map(), intel: new Map(),
    neighbours: [],
  }));

  for (const p of players) {
    p.neighbours = players
      .filter((q) => q.id !== p.id)
      .map((q) => ({ id: q.id, d: distance(p, q) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 18);
  }

  return { players, missions: [], rng };
}

/* ── economy ───────────────────────────────────────────────────── */

const capsOf = (p: SimPlayer) => ({
  alloy: storageCap(alloyRate(p.buildings.REFINERY)),
  crystal: storageCap(crystalRate(p.buildings.EXTRACTOR)),
});

/**
 * What the WORKS hold when full, which is where production actually lands (D16).
 *
 * Priced through `productionMult` for the same reason `worksOf` is: a Foundry lifts
 * the rate and therefore the ceiling that follows from it.
 */
const worksCapsOf = (p: SimPlayer) => {
  const boost = productionMult(p.orbit);
  return {
    alloy: collectorCap(alloyRate(p.buildings.REFINERY) * boost),
    crystal: collectorCap(crystalRate(p.buildings.EXTRACTOR) * boost),
  };
};

const worksOf = (p: SimPlayer) => ({
  refineryLevel: p.buildings.REFINERY,
  extractorLevel: p.buildings.EXTRACTOR,
  aegisLevel: p.instruments.AEGIS ?? 0,
  production: productionMult(p.orbit),
});

function sync(p: SimPlayer, t: number): void {
  const next = advanceEconomy(
    {
      alloy: p.alloy, crystal: p.crystal,
      bufferAlloy: p.bufferAlloy, bufferCrystal: p.bufferCrystal,
      shield: p.shield,
      lastTickMinutes: p.lastTick, disruptedUntilMinutes: p.disruptedUntil,
    },
    worksOf(p),
    t,
  );
  p.alloy = next.alloy;
  p.crystal = next.crystal;
  p.bufferAlloy = next.bufferAlloy;
  p.bufferCrystal = next.bufferCrystal;
  p.shield = next.shield;
  p.lastTick = next.lastTickMinutes;
}

/**
 * The tap, as a bot performs it. D16.
 *
 * Every archetype empties the works the moment it logs in — it is one button and
 * there is never a reason not to. Modelling it as automatic-on-login is what makes
 * the simulator honest about the collector's real cost, which is not the tap but
 * the PRODUCTION LOST between logins: a bot that visits twice a day fills an
 * eight-hour buffer and idles for four, and that shortfall now shows up in the
 * archetype spread instead of being invisible.
 */
function collectWorks(p: SimPlayer): void {
  const after = collect(
    {
      alloy: p.alloy, crystal: p.crystal,
      bufferAlloy: p.bufferAlloy, bufferCrystal: p.bufferCrystal,
      shield: p.shield,
      lastTickMinutes: p.lastTick, disruptedUntilMinutes: p.disruptedUntil,
    },
    worksOf(p),
  ).state;

  p.alloy = after.alloy;
  p.crystal = after.crystal;
  p.bufferAlloy = after.bufferAlloy;
  p.bufferCrystal = after.bufferCrystal;
}

// Uncollected ore is still owned, so it still counts as Wealth — and Wealth is
// what the rank floor reads. Leaving the buffer out would make a player cheapest,
// and so most protected from attack, at exactly the moment they were carrying the
// most: overnight, with the works full.
const holdingsOf = (p: SimPlayer) => ({
  buildings: p.buildings, instruments: p.instruments, satellites: p.orbit,
  fleet: p.fleet, ground: p.ground,
  alloy: p.alloy + p.bufferAlloy,
  crystal: p.crystal + p.bufferCrystal,
});

/* ── what to build, and why it is derived rather than listed ───── */

/** Every hull that fights. Haulers carry; ground units never leave. */
export const COMBAT_HULLS: readonly CombatHullId[] = MOBILE_HULLS.filter(
  (h): h is CombatHullId => h !== 'HAULER',
);

/**
 * What a bot expects to meet on the ground.
 *
 * Read off the hull table rather than written down, so a second ground hull is
 * picked up instead of silently ignored.
 *
 * THERE ARE TWO SINCE D27 — a Bastion and a Thorn, in opposite classes — and this
 * comment claimed there was exactly one for long enough that `expectedDefence`
 * sixty lines below documents the bug that arose precisely BECAUSE "how much
 * defence do they have" and "how many Bastions" stopped being the same question.
 * One assumed hull each is a bot reasoning about the classes it may face, which is
 * public in the hull table and not information a human is denied.
 */
export const GROUND_DEFENCE: Fleet = Object.fromEntries(
  ALL_HULLS.filter((id) => HULLS[id].ground).map((id) => [id, 1]),
);

/**
 * Damage a hull deals before it dies, per resource spent, against a known defence.
 *
 * BOTH DIRECTIONS OF THE COUNTER MATRIX, because either one alone lies. A Bulwark's
 * raw attack per resource is a sixth of a Wasp's, so an offence-only measure says
 * never build one; what a Bulwark is actually for is what it survives, and that
 * only shows up in the incoming multiplier.
 *
 * DERIVED FROM `counterMult`, NOT FROM A TABLE OF HULL NAMES. That property is
 * load-bearing rather than tidy: this policy exists so that a combat change can be
 * measured, and a policy that hardcoded today's answer would have to be rewritten
 * by the very change it exists to measure — which would leave the reading exactly
 * as uninterpretable as it was before.
 */
export function tradeScore(hull: CombatHullId, defenders: Fleet): number {
  const h = HULLS[hull];
  const cost = h.alloy + h.crystal;
  if (cost <= 0 || h.atk <= 0) return 0;

  let hpPool = 0;
  let atkPool = 0;
  let outWeighted = 0;
  let inWeighted = 0;
  for (const [id, n] of fleetEntries(defenders)) {
    const d = HULLS[id];
    hpPool += n * d.hp;
    atkPool += n * d.atk;
    outWeighted += n * d.hp * counterMult(h.cls, d.cls);
    inWeighted += n * d.atk * counterMult(d.cls, h.cls);
  }
  if (hpPool <= 0) return 0;

  const out = outWeighted / hpPool;
  const incoming = atkPool > 0 ? inWeighted / atkPool : 1;
  return (h.atk * out * (h.hp / incoming)) / cost;
}

/**
 * What the informed player brings, given what the Shipyard can build.
 *
 * Seventy-thirty and not a hundred-zero, on purpose. A bot that always fields the
 * single best hull is playing a solved game, and `BANDS` measured against a galaxy
 * of solved players says nothing about a galaxy of people. The second hull is the
 * hedge a competent player keeps against the home fleet they cannot see.
 */
export function adaptiveMix(
  yard: number,
  fallback: Composition,
  defence: Fleet = GROUND_DEFENCE,
): Composition {
  const buildable = COMBAT_HULLS.filter((h) => yard >= HULLS[h].minShipyard);
  if (buildable.length === 0) return fallback;

  const ranked = [...buildable].sort((x, y) => tradeScore(y, defence) - tradeScore(x, defence));
  const first = ranked[0];
  if (!first) return fallback;
  const second = ranked[1];
  return second ? { [first]: 0.7, [second]: 0.3 } : { [first]: 1 };
}


/**
 * WHAT THIS PLAYER EXPECTS TO FLY INTO.
 *
 * SCORING AGAINST GROUND DEFENCE ALONE WAS A REAL BUG, and it hid for a whole
 * stage. A planet's guns are roughly a sixth of the hull value a raider meets —
 * most of a galaxy sits in home FLEETS — so ranking hulls against `GROUND_DEFENCE`
 * picked the hull that counters a turret and loses to the swarm guarding it. It
 * was invisible while there was one ground hull, because the answer happened to
 * coincide; D27 made the two answers differ and the bug surfaced at once.
 *
 * VALUE-NORMALISED, NOT SUMMED. A raw sum of every scouted fleet is dominated by
 * whichever neighbour happens to hoard the most Wasps, which is a fact about one
 * planet rather than about the neighbourhood. Each report is scaled to the same
 * weight before being blended, so what comes out is the SHAPE of local defence.
 *
 * It is a PRIOR, never a solution: the fleet is bought before a target is chosen,
 * so this answers "what does my neighbourhood look like", not "what has that
 * planet got". That is what keeps an informed bot competent rather than optimal —
 * and a bot that has scouted nobody falls back to its own habits, which is the
 * honest model of a player guessing from what they would build themselves.
 */
function expectedDefence(p: SimPlayer, t: number, fallback: Composition): Fleet {
  const seen: Fleet = {};
  let reports = 0;
  for (const known of p.intel.values()) {
    // What a neighbourhood BUILDS moves far more slowly than the stock in its
    // stores, so a day-old reading is still worth having.
    if (t - known.at > 1440) continue;
    const value = fleetValue(known.composition);
    if (value <= 0) continue;
    reports++;
    for (const [id, n] of fleetEntries(known.composition)) {
      seen[id] = (seen[id] ?? 0) + (n * 10_000) / value;
    }
  }
  if (reports === 0) {
    for (const [id, share] of Object.entries(fallback) as [CombatHullId, number][]) {
      seen[id] = (share * 10_000) / (HULLS[id].alloy + HULLS[id].crystal);
    }
  }
  // Ground guns never leave, so every raid meets them on top of whatever flies.
  for (const id of GROUND_HULLS) seen[id] = (seen[id] ?? 0) + 1;
  return seen;
}

/** Only what fights. Haulers are cargo — eight of them are not a raid. */
const combatPart = (fleet: Fleet): Fleet =>
  Object.fromEntries(COMBAT_HULLS.map((h) => [h, fleet[h] ?? 0]));

/**
 * The smallest fleet worth launching, PRICED rather than counted.
 *
 * This was `fleetCount(p.fleet) < 8` — eight hulls of anything — a fair proxy only
 * while every combat hull cost about the same. An archetype fielding Lances at
 * 2,280 against a Wasp's 520 met a bar four times dearer for no stated reason, and
 * measured, four of six GRINDERs finished a season holding a good fleet they were
 * never allowed to launch while Wasp swarms sailed through the same gate.
 *
 * Derived from the cheapest combat hull, so it keeps meaning what it always meant
 * — eight Wasps' worth of fight — whatever a future hull table says.
 */
const MIN_RAID_VALUE =
  8 * Math.min(...COMBAT_HULLS.map((h) => HULLS[h].alloy + HULLS[h].crystal));

/* ── a bot session ─────────────────────────────────────────────── */

function runSession(p: SimPlayer, t: number, world: World, rng: Rng): void {
  sync(p, t);
  // First thing anyone does on opening the game, and the thing that restarts
  // production that the full buffer had stopped.
  collectWorks(p);
  const a = ARCHETYPES[p.type];

  /**
   * 0. Defence first, as insurance on what is currently raidable.
   *
   * TWO GUNS NOW, AND THE SPLIT IS THE ARCHETYPE'S OWN. D27. A defender used to have
   * no composition choice at all — there was one ground hull, so "how much defence"
   * was the entire decision. With a heavy Bulwark-class gun and a light
   * Skirmisher-class one, what a planet is strong AGAINST is a choice, and it is the
   * choice an attacker has to scout to discover.
   */
  {
    const raidable = Math.max(0, p.alloy - vaultProtects(p.buildings.VAULT));
    const target = raidable * a.defenceRatio;
    const shortfall = target - fleetValue(p.ground);
    if (shortfall > 0) {
      for (const [id, share] of Object.entries(a.groundMix) as [GroundHullId, number][]) {
        const g = HULLS[id];
        if (p.buildings.SHIPYARD < g.minShipyard) continue;
        const want = Math.floor((shortfall * share) / (g.alloy + g.crystal));
        const n = Math.min(
          want,
          Math.floor((p.alloy * 0.5) / g.alloy),
          g.crystal > 0 ? Math.floor(p.crystal / g.crystal) : Infinity,
        );
        if (n > 0) {
          p.ground[id] = (p.ground[id] ?? 0) + n;
          p.alloy -= n * g.alloy;
          p.crystal -= n * g.crystal;
        }
      }
    }
  }

  // 1. Buildings, in archetype order. CORE gates everything else.
  for (let pass = 0; pass < 3; pass++) {
    for (const key of a.buildOrder) {
      const lvl = p.buildings[key];
      if (key !== 'CORE' && lvl >= p.buildings.CORE) continue;
      const cost = upgradeCost(lvl);
      if (
        p.alloy >= cost.alloy && p.crystal >= cost.crystal &&
        p.alloy - cost.alloy > alloyRate(p.buildings.REFINERY) * 0.5
      ) {
        p.alloy -= cost.alloy;
        p.crystal -= cost.crystal;
        p.buildings[key] = lvl + 1;
      }
    }
  }

  /**
   * 2. ONE PIECE OF HARDWARE PER SESSION, off a single wishlist. D25.
   *
   * The archetype's `wants` mixes ground instruments and satellites in its own
   * priority order, and the first entry it can actually afford is what it buys.
   * Instruments are levelled and so stay on the list until the Command Core
   * ceiling stops them; a satellite drops off it the moment it is in orbit.
   *
   * WHY ONE LIST AND NOT TWO. The Uplink gates the Telescope and the Radar, so an
   * archetype whose first choice is a seeing instrument cannot reach it until a
   * satellite is bought. Modelled as two passes, the gated entries were skipped,
   * something cheaper was bought instead, and the Uplink never came — the GRINDER
   * played whole seasons blind and took the design's central claim down with it.
   *
   * THE BUDGET GUARD MATTERS TOO. Satellites cost several times a building at the
   * same level, and "buy whenever affordable" would have a bot empty its store into
   * orbit while its planet stands undefended. No player does that. Reserving the
   * archetype's military share is the same discipline the building pass applies
   * with its half-hour of production.
   */
  {
    const room = satelliteSlots(p.buildings.CORE) - p.orbit.length;
    for (const id of a.wants) {
      const orbital = isSatellite(id);
      let cost;
      if (orbital) {
        if (room <= 0 || p.orbit.includes(id)) continue;
        cost = satelliteCost(id);
      } else {
        const lvl = p.instruments[id] ?? 0;
        if (lvl >= p.buildings.CORE) continue;
        // The two seeing instruments hang off an Uplink in orbit (D25).
        if ((id === 'TELESCOPE' || id === 'RADAR') && !seeingUnlocked(p.orbit)) continue;
        cost = instrumentCost(id, lvl);
      }

      /**
       * RESERVE BOTH METALS, NOT JUST ALLOY.
       *
       * Guarding alloy alone looks right and is not: pass 3 buys hulls out of a
       * share of ALLOY but clips the count by whatever CRYSTAL is left, and crystal
       * is the scarcer of the two. A guard that protects only alloy therefore lets
       * every hardware purchase come out of the fleet through the side door — the
       * galaxy's military fell by a sixth, and raid returns with it, while the bots
       * appeared to be reserving their military budget the whole time.
       */
      const keepAlloy = p.alloy * a.militaryShare;
      const keepCrystal = p.crystal * a.militaryShare;
      if (p.alloy - cost.alloy < keepAlloy) continue;
      if (p.crystal - cost.crystal < keepCrystal) continue;

      p.alloy -= cost.alloy;
      p.crystal -= cost.crystal;
      if (orbital) p.orbit.push(id);
      else p.instruments[id] = (p.instruments[id] ?? 0) + 1;
      break;
    }
  }

  /**
   * 3. Offensive hulls from what remains, to the archetype's composition.
   *
   * This used to walk `['BULWARK','LANCE','WASP']`, buy the first hull it could
   * afford and `break` — so every bot in the galaxy spent its entire military
   * budget on the most expensive hull available to it, every session. That is the
   * inverse of the dominant composition, and it means every raid-return figure the
   * project has recorded was measured in a world where nobody fields a fleet that
   * works. See `Archetype.composition`.
   */
  {
    const budget = p.alloy * a.militaryShare;
    const yard = p.buildings.SHIPYARD;
    const mix = a.adaptsComposition
      ? adaptiveMix(yard, a.composition, expectedDefence(p, t, a.composition))
      : a.composition;

    // Only what the Shipyard can actually build, renormalised — otherwise a low
    // yard silently forfeits the share it cannot spend and under-buys all season.
    const open = COMBAT_HULLS.filter((h) => (mix[h] ?? 0) > 0 && yard >= HULLS[h].minShipyard);
    const total = open.reduce((sum, h) => sum + (mix[h] ?? 0), 0);

    if (total > 0) {
      /**
       * Biggest share first, carrying whatever a hull could not spend to the next.
       *
       * Without the carry an early budget is smaller than one hull of the preferred
       * type, every share rounds to zero, and a bot that can afford five Wasps buys
       * nothing at all for the first days of the season.
       */
      const order = [...open].sort((x, y) => (mix[y] ?? 0) - (mix[x] ?? 0));
      let carry = 0;
      for (let pass = 0; pass < 2; pass++) {
        for (const hull of order) {
          const h = HULLS[hull];
          const spend = pass === 0 ? (budget * (mix[hull] ?? 0)) / total + carry : carry;
          if (spend < h.alloy) continue;
          let n = Math.floor(spend / h.alloy);
          n = Math.min(n, Math.floor(p.alloy / h.alloy));
          if (h.crystal > 0) n = Math.min(n, Math.floor(p.crystal / h.crystal));
          if (n > 0) {
            p.fleet[hull] = (p.fleet[hull] ?? 0) + n;
            p.alloy -= n * h.alloy;
            p.crystal -= n * h.crystal;
          }
          carry = Math.max(0, spend - n * h.alloy);
        }
      }
    }

    // Cargo sized to what a neighbour is likely holding, not bought one at a time.
    if (yard >= HULLS.HAULER.minShipyard && a.attackChance > 0) {
      const nb = p.neighbours[0] ? world.players[p.neighbours[0].id] : undefined;
      const caps = nb ? capsOf(nb) : { alloy: 5000, crystal: 1500 };
      const want = Math.ceil(((caps.alloy + caps.crystal) * 0.25) / HULLS.HAULER.cargo);
      const have = p.fleet.HAULER ?? 0;
      const n = Math.min(
        want - have,
        Math.floor((p.alloy * 0.3) / HULLS.HAULER.alloy),
        Math.floor(p.crystal / HULLS.HAULER.crystal),
      );
      if (n > 0) {
        p.fleet.HAULER = have + n;
        p.alloy -= n * HULLS.HAULER.alloy;
        p.crystal -= n * HULLS.HAULER.crystal;
      }
    }
  }

  if (rng() < a.attackChance) tryAttack(p, t, world, rng);

  p.nextLogin = t + Math.max(20, Math.round((1440 / a.loginsPerDay) * (0.6 + rng() * 0.8)));
}

function tryAttack(p: SimPlayer, t: number, world: World, rng: Rng): void {
  const a = ARCHETYPES[p.type];
  // A Beacon in orbit shortens every leg this planet flies. D25.
  const speed = fleetSpeed(p.fleet) * fleetSpeedMult(p.orbit);
  if (speed <= 0 || fleetValue(combatPart(p.fleet)) < MIN_RAID_VALUE) return;
  p.wealthNow = wealth(holdingsOf(p));

  let best: { q: SimPlayer; d: number; flight: number; score: number; scouted: boolean; defence: number | null } | null = null;

  for (const nb of p.neighbours.slice(0, 10)) {
    const q = world.players[nb.id];
    if (!q) continue;
    q.wealthNow = q.wealthNow || wealth(holdingsOf(q));

    const hits = (p.recentHits.get(q.id) ?? []).filter((x) => t - x < ABUSE.bashWindowMinutes).length;
    const gate = canAttack(
      // D49: the band is measured in development tiers, not in Wealth.
      { playerId: String(p.id), coreLevel: p.buildings.CORE },
      { playerId: String(q.id), coreLevel: q.buildings.CORE },
      hits,
    );
    if (!gate.ok) continue;

    const known = p.intel.get(q.id);
    const scouted = Boolean(a.scouts && known && t - known.at < 120);
    const defence = scouted && known ? known.defence : null;

    /**
     * A scout learns what a planet is holding; a blind attacker guesses from how
     * developed it looks.
     *
     * Both figures count the works as well as the store (D16) — a target's storage
     * is now a transient that empties minutes after its owner logs in, so a guess
     * or a measurement that looked only at storage would describe every planet in
     * the galaxy as empty.
     */
    /**
     * AND THE BLIND GUESS COUNTS THE WORKS TOO, which is what the note above always
     * claimed and the expression never did. D52a.
     *
     * `capsOf` is storage alone. The scouted branch was updated for D16 — it reads
     * `bufferAlloy + bufferCrystal` off the real planet — and this one was not, so a
     * blind attacker under-valued every target by roughly the collector ceiling and
     * the model preferred scouted targets for a reason that was an omission rather
     * than an effect. That is the kind of silent skew that makes a `TAX` reading
     * uninterpretable, which matters because `TAX` is one of the two gate
     * assertions currently red.
     */
    const blindCaps = capsOf(q);
    const blindWorks = worksCapsOf(q);
    const stock =
      scouted && known
        ? known.stock
        : (blindCaps.alloy + blindCaps.crystal + blindWorks.alloy + blindWorks.crystal) * 0.35;
    const vault = vaultProtects(q.buildings.VAULT);
    const expectedLoot = Math.max(0, stock - vault * 2) * 0.5;
    const flight = travelMinutes(nb.d, speed);
    // A blind attacker cannot make this risk discount. That is the whole point.
    const risk = defence !== null ? 1 + defence / Math.max(1, fleetValue(p.fleet)) : 1.6;
    const score = expectedLoot / ((flight + 10) * risk);

    if (!best || score > best.score) best = { q, d: nb.d, flight, score, scouted, defence };
  }
  if (!best || best.score <= 0) return;

  if (a.scouts && !best.scouted && rng() < 0.7) {
    p.scoutsSent++;
    sync(best.q, t);
    p.intel.set(best.q.id, {
      stock: best.q.alloy + best.q.crystal + best.q.bufferAlloy + best.q.bufferCrystal,
      defence: fleetValue({ ...best.q.fleet, ...best.q.ground }),
      composition: { ...best.q.fleet, ...best.q.ground },
      at: t + 8,
    });
    return; // spends the session on the probe
  }

  // Escorts scale with the expected fight; cargo scales with the expected haul.
  const commit =
    best.scouted && best.defence !== null
      ? Math.min(0.95, Math.max(0.25, (best.defence * 1.8) / Math.max(1, fleetValue(p.fleet))))
      : 0.7 + rng() * 0.25;

  const send: Fleet = {};
  for (const k of MOBILE_HULLS) {
    const have = p.fleet[k] ?? 0;
    if (have <= 0) continue;
    const n = k === 'HAULER' ? have : Math.floor(have * commit);
    if (n > 0) {
      send[k] = n;
      p.fleet[k] = have - n;
    }
  }
  if (fleetCount(send) === 0) return;

  world.missions.push({
    from: p.id, to: best.q.id, fleet: send,
    arriveAt: t + best.flight, distance: best.d,
    scouted: best.scouted, returning: false,
  });
  p.attacks.push(t);
}

/* ── mission resolution ────────────────────────────────────────── */

function resolveMission(m: Mission, t: number, world: World, stats: DayStats): void {
  const atk = world.players[m.from];
  const def = world.players[m.to];
  if (!atk || !def) return;

  if (m.returning) {
    for (const [hull, n] of fleetEntries(m.fleet)) {
      atk.fleet[hull] = (atk.fleet[hull] ?? 0) + n;
    }
    sync(atk, t);
    const caps = capsOf(atk);
    atk.alloy = Math.min(caps.alloy, atk.alloy + (m.loot?.alloy ?? 0));
    atk.crystal = Math.min(caps.crystal, atk.crystal + (m.loot?.crystal ?? 0));
    return;
  }

  sync(def, t);
  const defenders: Fleet = { ...def.fleet, ...def.ground };
  // Seeded from the mission, so any battle can be re-derived from its inputs.
  const rng = mulberry32((m.from * 7919 + m.to * 104729 + m.arriveAt) >>> 0);
  const r = resolveCombat(m.fleet, defenders, def.shield, rng);

  for (const k of Object.keys(def.fleet) as (keyof Fleet)[]) {
    def.fleet[k] = r.defenderSurvivors[k] ?? 0;
  }
  for (const k of Object.keys(def.ground) as (keyof Fleet)[]) {
    def.ground[k] = (r.defenderSurvivors[k] ?? 0) + (r.defenceSalvage[k] ?? 0);
  }
  def.shield = r.shieldLeft;

  const loot = computeLoot(
    { alloy: def.alloy, crystal: def.crystal },
    { alloy: def.bufferAlloy, crystal: def.bufferCrystal },
    vaultProtects(def.buildings.VAULT),
    r.grade,
    fleetCargo(r.attackerSurvivors),
  );
  // Two columns, debited separately — the works are not the store, and the vault
  // covers only one of them. D16.
  def.alloy -= loot.fromStock.alloy;
  def.crystal -= loot.fromStock.crystal;
  def.bufferAlloy -= loot.fromBuffer.alloy;
  def.bufferCrystal -= loot.fromBuffer.crystal;

  const wasUntil = def.disruptedUntil;
  def.disruptedUntil = applyDisruption(wasUntil, t, r.grade);
  const added = Math.max(0, def.disruptedUntil - Math.max(wasUntil, t));
  def.disruptedToday += added;

  bookBattle(atk.ledger, def.ledger, loot.alloy + loot.crystal, r);

  const lootValue = loot.alloy + loot.crystal;
  const gained = lootValue + r.defenderLossValue;
  stats.attacks++;
  stats.lootValue += lootValue;
  stats.attackerLossValue += r.attackerLossValue;
  stats.defenderLossValue += r.defenderLossValue;
  stats.disruptedMinutes += added;
  stats.byGrade[r.grade]++;
  if (m.scouted) {
    stats.scoutedAttacks++; stats.scoutedGain += gained; stats.scoutedLoss += r.attackerLossValue;
  } else {
    stats.blindAttacks++; stats.blindGain += gained; stats.blindLoss += r.attackerLossValue;
  }

  atk.lootToday += lootValue;
  def.lossToday += r.defenderLossValue + lootValue;
  const hits = atk.recentHits.get(def.id) ?? [];
  hits.push(t);
  atk.recentHits.set(def.id, hits);

  if (fleetCount(r.attackerSurvivors) > 0) {
    world.missions.push({
      from: m.from, to: m.to, fleet: r.attackerSurvivors,
      arriveAt: t + travelMinutes(m.distance, fleetSpeed(r.attackerSurvivors) * fleetSpeedMult(atk.orbit)),
      distance: m.distance, scouted: m.scouted, returning: true, loot,
    });
  }
}

/* ── the season loop ───────────────────────────────────────────── */

export interface DayReport {
  day: number;
  stats: DayStats;
  invariants: Invariants;
}

export function runSeason(cfg: SimConfig): { world: World; days: DayReport[] } {
  const world = buildWorld(cfg);
  const total = cfg.days * 1440;
  const days: DayReport[] = [];
  let stats = freshStats();

  for (let t = 0; t <= total; t++) {
    for (let i = world.missions.length - 1; i >= 0; i--) {
      const m = world.missions[i];
      if (m && m.arriveAt <= t) {
        world.missions.splice(i, 1);
        resolveMission(m, t, world, stats);
      }
    }
    for (const p of world.players) {
      if (p.nextLogin <= t) runSession(p, t, world, world.rng);
    }
    if (t > 0 && t % 1440 === 0) {
      for (const p of world.players) {
        sync(p, t);
        p.wealthNow = wealth(holdingsOf(p));
      }
      const day = t / 1440;
      days.push({ day, stats, invariants: measure(day, world.players, stats) });
      for (const p of world.players) {
        p.wealthHistory.push(p.wealthNow);
        p.lootToday = 0;
        p.lossToday = 0;
        p.disruptedToday = 0;
      }
      stats = freshStats();
    }
  }
  return { world, days };
}

export { dominion, investedInBuilding, capsOf, holdingsOf };
