/**
 * ASTERA ONLINE — canonical game rules.
 *
 * Single source of truth for every formula in the GDD. Imported by both
 * simulate.mjs (headless season simulator) and prototype.html (text prototype),
 * so the two can never disagree about the maths.
 *
 * Pure functions only. No state, no I/O, no clock. Time is always passed in.
 */

/* ══════════════════════════════════════════════════════════════
   TUNING CONSTANTS  —  every number the design can be wrong about
   ══════════════════════════════════════════════════════════════ */

export const ECON = {
  alloyBase: 40, alloyMult: 1.45,
  crystalBase: 14, crystalMult: 1.42,
  costBase: 200, costMult: 1.55,
  crystalCostBase: 40, crystalCostMult: 1.58,
  crystalCostFromLevel: 3,
  capHours: 12,
  // INVARIANT: vaultMult MUST stay below alloyMult (1.45), or the vault outgrows
  // the stock it protects and nothing in the galaxy is ever raidable again.
  // Found by simulate.mjs on the first run — the vault was covering 208–301% of
  // storage from level 3 onward, which silently killed the entire PvP economy.
  vaultBase: 300, vaultMult: 1.30,
};

export const COMBAT = {
  rounds: 3,
  /**
   * Fraction of destroyed ground defence rebuilt free from wreckage.
   *
   * Consumable defence meant ~95% of all attacks resolved DECISIVE, and if blind
   * raiding almost never fails there is nothing for information to reduce — the
   * whole fog layer becomes decoration. Durable defence puts genuine uncertainty
   * back into the attack decision, which is what scouting exists to resolve.
   *
   * This was only safe to add once the ladder moved to Dominion: under a wealth
   * ladder, durable defence recreates the turtle exploit. Under Dominion a turtle
   * that is never attacked scores exactly zero, so the ladder handles it instead.
   */
  defenceSalvage: 0.60,
  varianceMin: 0.92,
  varianceMax: 1.08,
  strongMult: 1.6,
  weakMult: 0.625,
  partialThreshold: 0.60,
  lootDecisive: 0.50,
  lootPartial: 0.25,
};

export const TRAVEL = { baseMinutes: 3, distanceFactor: 1.2 };

export const INTEL = {
  detectBase: 0.25, detectSlope: 0.18, detectMin: 0.05, detectMax: 0.95,
  accuracyBase: 0.55, accuracySlope: 0.12, accuracyMin: 0.30, accuracyMax: 1.00,
  intermittentRefreshMin: 20,   // Clarity 0: telescope refreshes only this often
  intermittentDropRate: 0.25,   // ...and this fraction of refreshes are lost
  degradedUnknownRate: 0.70,    // Clarity -1: reads UNKNOWN this often
};

export const SHIELD = { base: 700, mult: 1.42, regenPerHour: 0.05 };

/**
 * DISRUPTION — the answer to the compounding problem.
 *
 * A raid that only transfers stock can never compete with building, because an
 * invested alloy compounds ~16x over a season while a stolen one returns 1x.
 * Measured: raiding was 5% of the economy and the loot dial was inert.
 *
 * So a successful raid also knocks the target's surface works offline. Buildings
 * are never damaged — the ownership pillar holds — but the victim loses
 * COMPOUNDING rather than merely stock, which is the thing raiding could not
 * previously touch.
 */
export const DISRUPTION = {
  decisiveMinutes: 180,
  partialMinutes: 60,
  maxPendingMinutes: 240,   // you can never be disrupted more than 4h into the future
};

export const disruptionMinutes = (grade) =>
  grade === 'DECISIVE' ? DISRUPTION.decisiveMinutes
  : grade === 'PARTIAL' ? DISRUPTION.partialMinutes : 0;

/** Refreshes rather than stacks, and is capped — chain-raiding cannot bury a player. */
export function applyDisruption(disruptedUntil, now, grade) {
  const add = disruptionMinutes(grade);
  if (!add) return disruptedUntil;
  return Math.min(now + DISRUPTION.maxPendingMinutes, Math.max(disruptedUntil, now + add));
}

/** Producing minutes inside [from, to), given surface works offline until `until`. */
export function productiveMinutes(from, to, until = 0) {
  const span = Math.max(0, to - from);
  const lost = Math.max(0, Math.min(to, until) - from);
  return Math.max(0, span - lost);
}

export const ABUSE = {
  bashLimit: 3,            // successful attacks per attacker per target
  bashWindowMinutes: 720,  // ...within 12 hours
  graceMinutes: 240,       // newcomer immunity
  graceUntilCoreLevel: 4,
  rankFloor: 0.40,         // cannot attack below 40% of your Empire Value
};

/* ══════════════════════════════════════════════════════════════
   HULLS  —  four ships plus the ground turret
   ══════════════════════════════════════════════════════════════ */

export const HULLS = {
  WASP:    { name: 'Wasp',    cls: 'SKIRMISHER', atk: 14, hp: 24,  speed: 46, cargo: 40,  alloy: 260,  crystal: 0,   minShipyard: 0 },
  LANCE:   { name: 'Lance',   cls: 'LANCE',      atk: 46, hp: 62,  speed: 34, cargo: 50,  alloy: 950,  crystal: 190, minShipyard: 2 },
  BULWARK: { name: 'Bulwark', cls: 'BULWARK',    atk: 26, hp: 210, speed: 21, cargo: 70,  alloy: 2500, crystal: 620, minShipyard: 4 },
  HAULER:  { name: 'Hauler',  cls: 'SUPPORT',    atk: 0,  hp: 80,  speed: 30, cargo: 900, alloy: 1150, crystal: 130, minShipyard: 1 },
  BASTION: { name: 'Bastion', cls: 'BULWARK',    atk: 34, hp: 260, speed: 0,  cargo: 0,   alloy: 1700, crystal: 380, minShipyard: 1, ground: true },
};

export const MOBILE_HULLS = ['WASP', 'LANCE', 'BULWARK', 'HAULER'];

/** WASP ▸ BULWARK ▸ LANCE ▸ WASP. Support is prey to everything. */
const BEATS = { SKIRMISHER: 'BULWARK', BULWARK: 'LANCE', LANCE: 'SKIRMISHER' };

export function counterMult(attackerCls, defenderCls) {
  if (defenderCls === 'SUPPORT') return COMBAT.strongMult;
  if (attackerCls === 'SUPPORT') return 0;
  if (BEATS[attackerCls] === defenderCls) return COMBAT.strongMult;
  if (BEATS[defenderCls] === attackerCls) return COMBAT.weakMult;
  return 1.0;
}

/* ══════════════════════════════════════════════════════════════
   BUILDINGS
   ══════════════════════════════════════════════════════════════ */

export const BUILDINGS = {
  CORE:      { name: 'Command Core',     blurb: 'Level ceiling for every other building' },
  REFINERY:  { name: 'Alloy Refinery',   blurb: 'Alloy per hour, and alloy storage' },
  EXTRACTOR: { name: 'Crystal Extractor', blurb: 'Crystal per hour, and crystal storage' },
  VAULT:     { name: 'Vault',            blurb: 'Protects stock from raiders. No yield.' },
  SHIPYARD:  { name: 'Shipyard',         blurb: 'Unlocks hulls. Sets probe stealth.' },
  RING:      { name: 'Orbital Ring',     blurb: 'Satellite slots' },
};

export const SATELLITES = {
  TELESCOPE: { name: 'Telescope', blurb: 'Watch L planets' },
  RADAR:     { name: 'Radar',     blurb: 'Detect probes; incoming fleets at L3' },
  AEGIS:     { name: 'Aegis',     blurb: 'Shield HP' },
  VEIL:      { name: 'Veil',      blurb: 'Degrade enemy telescopes' },
  DRILL:     { name: 'Drill',     blurb: 'Mine passing asteroids' },
};

/* ══════════════════════════════════════════════════════════════
   ECONOMY  —  GDD §F.2
   ══════════════════════════════════════════════════════════════ */

export const alloyRate   = (L) => ECON.alloyBase   * Math.pow(ECON.alloyMult,   L);
export const crystalRate = (L) => ECON.crystalBase * Math.pow(ECON.crystalMult, L);

export function upgradeCost(level) {
  return {
    alloy: Math.round(ECON.costBase * Math.pow(ECON.costMult, level)),
    crystal: level >= ECON.crystalCostFromLevel
      ? Math.round(ECON.crystalCostBase * Math.pow(ECON.crystalCostMult, level))
      : 0,
  };
}

export const storageCap    = (ratePerHour) => Math.round(ECON.capHours * ratePerHour);
/** Level 0 still protects the base amount — nobody is ever lootable to zero. */
export const vaultProtects = (L) => Math.round(ECON.vaultBase * Math.pow(ECON.vaultMult, Math.max(0, L)));

/** Hours for an upgrade at `level` to repay itself. The brake on runaway growth. */
export function paybackHours(level) {
  const cost = ECON.costBase * Math.pow(ECON.costMult, level);
  const gain = ECON.alloyBase * Math.pow(ECON.alloyMult, level) * (ECON.alloyMult - 1);
  return cost / gain;
}

export const shieldHP  = (L) => (L <= 0 ? 0 : Math.round(SHIELD.base * Math.pow(SHIELD.mult, L)));
export const satSlots  = (ringLevel) => 1 + Math.floor(ringLevel / 2);

/* ══════════════════════════════════════════════════════════════
   TRAVEL  —  GDD §F.1
   ══════════════════════════════════════════════════════════════ */

export function fleetSpeed(fleet) {
  let s = Infinity;
  for (const k of MOBILE_HULLS) if ((fleet[k] | 0) > 0) s = Math.min(s, HULLS[k].speed);
  return Number.isFinite(s) ? s : 0;
}

export function fleetCargo(fleet) {
  let c = 0;
  for (const k of MOBILE_HULLS) c += (fleet[k] | 0) * HULLS[k].cargo;
  return c;
}

export function travelMinutes(distance, speed) {
  if (speed <= 0) return Infinity;
  return Math.ceil(TRAVEL.baseMinutes + (distance / speed) * TRAVEL.distanceFactor);
}

/* ══════════════════════════════════════════════════════════════
   FLEET MATHS
   ══════════════════════════════════════════════════════════════ */

export function fleetCount(fleet) {
  let n = 0;
  for (const k in fleet) n += fleet[k] | 0;
  return n;
}

/** Rough combat heft. Advisory only — it ignores the counter matrix, so never
 *  grade an outcome with it. Grading uses fleetValue. */
export function fleetPower(fleet) {
  let p = 0;
  for (const k in fleet) {
    const n = fleet[k] | 0;
    if (n > 0 && HULLS[k]) p += n * HULLS[k].atk * HULLS[k].hp;
  }
  return p / 1000;
}

export function fleetValue(fleet) {
  let alloy = 0, crystal = 0;
  for (const k in fleet) {
    const n = fleet[k] | 0;
    if (n > 0 && HULLS[k]) { alloy += n * HULLS[k].alloy; crystal += n * HULLS[k].crystal; }
  }
  return alloy + crystal;
}

function totalHP(fleet) {
  let h = 0;
  for (const k in fleet) h += (fleet[k] | 0) * HULLS[k].hp;
  return h;
}

/* ══════════════════════════════════════════════════════════════
   COMBAT  —  GDD §F.4
   Three rounds, simultaneous fire, ±8% variance, shield soaks first.
   ══════════════════════════════════════════════════════════════ */

/**
 * Damage each enemy type receives this round, split by that type's HP share.
 *
 * Support hulls (Haulers) are shielded while any combat hull on their side is
 * still alive — they fly behind the line. Without this they evaporate in round 1
 * (80 HP, taking 1.6× from everything), the attacker arrives with no cargo, and
 * raiding cannot pay for itself. This is what creates the escort decision:
 * bring enough combat hulls to cover the cargo you brought.
 */
function damageMap(attackers, defenders, roll) {
  const out = {};
  let combatHP = 0;
  for (const dk in defenders) {
    const dn = defenders[dk] | 0;
    if (dn > 0 && HULLS[dk].cls !== 'SUPPORT') combatHP += dn * HULLS[dk].hp;
  }
  const supportShielded = combatHP > 0;

  let hp = 0;
  for (const dk in defenders) {
    const dn = defenders[dk] | 0;
    if (dn <= 0) continue;
    if (supportShielded && HULLS[dk].cls === 'SUPPORT') continue;
    hp += dn * HULLS[dk].hp;
  }
  if (hp <= 0) return out;

  for (const dk in defenders) {
    const dn = defenders[dk] | 0;
    if (dn <= 0) continue;
    if (supportShielded && HULLS[dk].cls === 'SUPPORT') continue;
    const share = (dn * HULLS[dk].hp) / hp;
    let raw = 0;
    for (const ak in attackers) {
      const an = attackers[ak] | 0;
      if (an <= 0) continue;
      raw += an * HULLS[ak].atk * counterMult(HULLS[ak].cls, HULLS[dk].cls);
    }
    out[dk] = raw * share * roll;
  }
  return out;
}

/** Apply damage, carrying the fractional remainder of a partly-damaged hull forward. */
function applyCasualties(fleet, dmg, passRatio, carry) {
  const losses = {};
  for (const k in dmg) {
    const effective = dmg[k] * passRatio + (carry[k] || 0);
    const killed = Math.min(fleet[k] | 0, Math.floor(effective / HULLS[k].hp));
    carry[k] = effective - killed * HULLS[k].hp;
    if (killed > 0) { fleet[k] -= killed; losses[k] = killed; }
  }
  return losses;
}

/**
 * @param {object} attacker  {WASP: 40, LANCE: 10, ...}
 * @param {object} defender  home fleet + BASTION turrets
 * @param {number} shield    shield HP pool
 * @param {function} rng     () => [0,1)
 */
export function resolveCombat(attacker, defender, shield = 0, rng = Math.random) {
  const A = { ...attacker }, D = { ...defender };
  const atkStart = { ...A }, defStart = { ...D };
  const defValueBefore = fleetValue(D);
  const carryA = {}, carryD = {};
  const rounds = [];
  let shieldLeft = shield;

  for (let r = 0; r < COMBAT.rounds; r++) {
    if (fleetCount(A) === 0) break;
    if (fleetCount(D) === 0 && shieldLeft <= 0) break;

    const span = COMBAT.varianceMax - COMBAT.varianceMin;
    const rollA = COMBAT.varianceMin + rng() * span;
    const rollD = COMBAT.varianceMin + rng() * span;

    const toD = damageMap(A, D, rollA);
    const toA = damageMap(D, A, rollD);

    // Shield absorbs everything aimed at the defender before units take any.
    let sum = 0;
    for (const k in toD) sum += toD[k];
    const absorbed = Math.min(shieldLeft, sum);
    shieldLeft -= absorbed;
    const passRatio = sum > 0 ? (sum - absorbed) / sum : 0;

    const defLosses = applyCasualties(D, toD, passRatio, carryD);
    const atkLosses = applyCasualties(A, toA, 1, carryA);

    rounds.push({
      round: r + 1,
      attackerDamage: Math.round(sum),
      defenderDamage: Math.round(Object.values(toA).reduce((a, b) => a + b, 0)),
      shieldAbsorbed: Math.round(absorbed),
      attackerLosses: atkLosses,
      defenderLosses: defLosses,
    });
  }

  // Salvage is computed AFTER grading, so it never softens the outcome or the loot.
  const salvage = {};
  for (const k in defStart) {
    if (!HULLS[k]?.ground) continue;
    const lost = (defStart[k] | 0) - (D[k] | 0);
    const back = Math.floor(lost * COMBAT.defenceSalvage);
    if (back > 0) salvage[k] = back;
  }

  const defAlive = fleetCount(D);
  const lossRatio = defValueBefore > 0 ? 1 - fleetValue(D) / defValueBefore : 1;

  let grade;
  if (defAlive === 0 && shieldLeft <= 0) grade = 'DECISIVE';
  else if (lossRatio >= COMBAT.partialThreshold) grade = 'PARTIAL';
  else grade = 'REPELLED';

  return {
    grade, rounds, lossRatio,
    shieldLeft: Math.max(0, Math.round(shieldLeft)),
    attackerSurvivors: A, defenderSurvivors: D, defenceSalvage: salvage,
    attackerLosses: diff(atkStart, A), defenderLosses: diff(defStart, D),
    attackerLossValue: fleetValue(diff(atkStart, A)),
    defenderLossValue: Math.max(0, fleetValue(diff(defStart, D)) - fleetValue(salvage)),
  };
}

function diff(before, after) {
  const d = {};
  for (const k in before) {
    const n = (before[k] | 0) - (after[k] | 0);
    if (n > 0) d[k] = n;
  }
  return d;
}

/* ══════════════════════════════════════════════════════════════
   LOOT  —  GDD §F.7
   ══════════════════════════════════════════════════════════════ */

export const gradeMultiplier = (grade) =>
  grade === 'DECISIVE' ? COMBAT.lootDecisive : grade === 'PARTIAL' ? COMBAT.lootPartial : 0;

/**
 * Cargo is filled with alloy and crystal in proportion to what is available.
 * @returns {{alloy:number, crystal:number}}
 */
export function computeLoot(stock, vaultCap, grade, cargo) {
  const mult = gradeMultiplier(grade);
  if (mult === 0 || cargo <= 0) return { alloy: 0, crystal: 0 };

  const availA = Math.max(0, stock.alloy - vaultCap) * mult;
  const availC = Math.max(0, stock.crystal - vaultCap) * mult;
  const total = availA + availC;
  if (total <= 0) return { alloy: 0, crystal: 0 };

  if (total <= cargo) return { alloy: Math.floor(availA), crystal: Math.floor(availC) };
  return {
    alloy: Math.floor(cargo * (availA / total)),
    crystal: Math.floor(cargo * (availC / total)),
  };
}

/* ══════════════════════════════════════════════════════════════
   INFORMATION  —  GDD §F.8
   ══════════════════════════════════════════════════════════════ */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const clarity = (telescopeLevel, veilLevel) => telescopeLevel - veilLevel;

export function clarityState(c) {
  if (c >= 2) return 'FULL';
  if (c === 1) return 'CLEAR';
  if (c === 0) return 'INTERMITTENT';
  if (c === -1) return 'DEGRADED';
  return 'BLIND';
}

/**
 * What a telescope actually shows this instant.
 * @param {number} minutesSinceRefresh how stale the last successful read is
 * @returns {{status:'HOME'|'AWAY'|'UNKNOWN', stale:number, eta:number|null}}
 */
export function telescopeReading(state, trueStatus, minutesSinceRefresh, etaMinutes, rng = Math.random) {
  switch (state) {
    case 'FULL':
      return { status: trueStatus, stale: 0, eta: etaMinutes };
    case 'CLEAR':
      return { status: trueStatus, stale: 0, eta: null };
    case 'INTERMITTENT': {
      const dropped = rng() < INTEL.intermittentDropRate;
      const stale = dropped
        ? minutesSinceRefresh + INTEL.intermittentRefreshMin
        : Math.min(minutesSinceRefresh, INTEL.intermittentRefreshMin);
      return { status: trueStatus, stale, eta: null };
    }
    case 'DEGRADED':
      return rng() < INTEL.degradedUnknownRate
        ? { status: 'UNKNOWN', stale: 0, eta: null }
        : { status: trueStatus, stale: minutesSinceRefresh, eta: null };
    default:
      return { status: 'UNKNOWN', stale: 0, eta: null };
  }
}

export const detectChance = (radarLevel, probeStealthLevel) =>
  clamp(INTEL.detectBase + INTEL.detectSlope * (radarLevel - probeStealthLevel), INTEL.detectMin, INTEL.detectMax);

export const probeAccuracy = (probeLevel, veilLevel) =>
  clamp(INTEL.accuracyBase + INTEL.accuracySlope * (probeLevel - veilLevel), INTEL.accuracyMin, INTEL.accuracyMax);

/** Blur a true value by the probe's accuracy. Low accuracy gives you a range, not a number. */
export function fuzz(trueValue, accuracy, rng = Math.random) {
  const err = (1 - accuracy) * (rng() * 2 - 1);
  return Math.max(0, Math.round(trueValue * (1 + err)));
}

/** The band a player should be shown, rather than a falsely precise figure. */
export function fuzzBand(trueValue, accuracy, rng = Math.random) {
  const mid = fuzz(trueValue, accuracy, rng);
  const spread = (1 - accuracy) * mid;
  return { low: Math.max(0, Math.round(mid - spread)), high: Math.round(mid + spread), mid };
}

/* ══════════════════════════════════════════════════════════════
   SCORE  —  GDD §G.1.  Flat weights, all 1.0.
   ══════════════════════════════════════════════════════════════ */

/** Total resources sunk into a building to reach `level`. */
export function investedInBuilding(level) {
  let total = 0;
  for (let L = 0; L < level; L++) {
    const c = upgradeCost(L);
    total += c.alloy + c.crystal;
  }
  return total;
}

/**
 * @param {object} p  { buildings, satellites, fleet, ground, alloy, crystal }
 * @returns {number}  Empire Value in raw resource units
 */
export function empireValue(p) {
  let v = 0;
  for (const k in p.buildings) v += investedInBuilding(p.buildings[k]);
  for (const k in (p.satellites || {})) v += investedInBuilding(p.satellites[k]);
  v += fleetValue(p.fleet || {});
  v += fleetValue(p.ground || {});
  v += (p.alloy || 0) + (p.crystal || 0);
  return Math.round(v);
}

export const scorePoints = (v) => Math.round(v / 100);

/* ══════════════════════════════════════════════════════════════
   DOMINION  —  the season ladder

   Empire Value measures accumulated wealth, and accumulation is dominated by
   compounding, which is dominated by simply being present. Measured: pure
   builders finished a season with 2.1x the Empire Value of raiders, and no
   loot percentage changed it.

   So wealth is not the ladder. Dominion is: everything you have taken from
   other players, minus everything they have taken from you. It is exactly
   zero-sum across the galaxy, only combat generates it, and it rewards
   winning fights EFFICIENTLY — which is precisely what scouting buys.

   Note it also scores defence. Repelling a raid destroys the attacker's ships,
   which is dominion for the defender. A fortress that is never attacked scores
   nothing; a fortress that is attacked and holds, climbs.
   ══════════════════════════════════════════════════════════════ */

export const dominion = (d) => Math.round((d?.taken || 0) - (d?.lost || 0));

/**
 * Book both sides of a resolved battle. Sums to exactly zero across the pair.
 * @param {{taken:number,lost:number}} attackerLedger
 * @param {{taken:number,lost:number}} defenderLedger
 */
export function bookBattle(attackerLedger, defenderLedger, lootValue, result) {
  const gained = lootValue + result.defenderLossValue;
  attackerLedger.taken += gained;
  attackerLedger.lost += result.attackerLossValue;
  defenderLedger.taken += result.attackerLossValue;
  defenderLedger.lost += gained;
}

/* ══════════════════════════════════════════════════════════════
   ABUSE GUARDS  —  GDD §F.7
   ══════════════════════════════════════════════════════════════ */

export function canAttack(attacker, defender, nowMinutes, recentHits = 0) {
  if (defender.ev < attacker.ev * ABUSE.rankFloor)
    return { ok: false, reason: 'RANK_FLOOR' };
  if (nowMinutes - (defender.joinedAt || 0) < ABUSE.graceMinutes &&
      (defender.buildings?.CORE || 0) < ABUSE.graceUntilCoreLevel)
    return { ok: false, reason: 'NEWCOMER_GRACE' };
  if (recentHits >= ABUSE.bashLimit)
    return { ok: false, reason: 'BASH_LIMIT' };
  return { ok: true };
}

/* ══════════════════════════════════════════════════════════════
   DETERMINISTIC RNG  —  so every run is reproducible from a seed
   ══════════════════════════════════════════════════════════════ */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
