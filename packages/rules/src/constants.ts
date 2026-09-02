import type { BuildingId, InstrumentId, Resources, SatelliteId } from './types.js';
import { ECONOMY_TEMPO, scalePrice } from './tempo.js';

/**
 * Every number the design can be wrong about, in one place.
 *
 * Values marked PROVISIONAL are settled by the Phase 8 playtest, not by argument.
 * Values marked INVARIANT have a stated relationship that must never be broken;
 * `test/invariants.test.ts` enforces each one.
 */

export const ECON = {
  /**
   * PRODUCTION IS `base × L × growth^L`, NOT `base × growth^L`. Economy v2.
   *
   * The shape changed, and it is the one shape change in the rewrite. It is the
   * only common form that delivers both halves of the brief from a single
   * formula: L1 → L2 MULTIPLIES OUTPUT BY 2.2, which is the day-zero dopamine a
   * fourteen-day season needs, while the MARGINAL rate decays from +120% to +16%
   * per level, which is the season brake. A pure exponential has one growth rate
   * for ever — to buy the early jump you must accept a late explosion.
   *
   * It is OGame's shape (`30 · L · 1.1^L`), re-derived for a 14-day round rather
   * than copied.
   *
   * THE GROWTH IS DERIVED, NOT PICKED. A season must carry a commander from about
   * 145/h to about 13,000/h — a 91× span over seventeen levels — and
   * `18 · g^17 = 91` gives `g = 1.100`.
   *
   * THE BASES CARRY THE CURRENT TEMPO PROFILE. Scale passive production here,
   * never in the growth terms: changing a growth term changes the economy's
   * shape, not merely its pace. Prices and storage have their own explicit tempo
   * levers so every ratio is measured rather than accidentally coupled.
   */
  alloyBase: 132 * ECONOMY_TEMPO.passiveIncome,
  alloyMult: 1.10,
  crystalBase: 48 * ECONOMY_TEMPO.passiveIncome,
  crystalMult: 1.09,
  /**
   * THE THIRD PRODUCER, AND IT IS DELIBERATELY A TRICKLE. T5.
   *
   * Scaled by `passiveIncome` like the other two, so a tempo change moves all
   * three together rather than leaving deuterium behind.
   *
   * A FLATTER CURVE THAN ALLOY OR CRYSTAL (1.04 against 1.10 and 1.09), because
   * this ladder must not be able to catch the rocks. Measured: two craft on an
   * isotope rock carry home about 105, and a dedicated miner turns that round
   * roughly once an hour once the frontier opens. The plant reads
   *
   *   L1  3/h     L3  10/h     L6  22/h     L9  37/h     L15  78/h
   *
   * so even at the top of both its ladders — research 5 and Core 16 — it is
   * visibly short of a miner who is actually flying, and it is guaranteed instead.
   * The floor, never the ceiling: if the two ever meet, the whole Frontier act
   * becomes dead content.
   */
  deuteriumBase: 4.15 * ECONOMY_TEMPO.passiveIncome,
  deuteriumMult: 1.04,

  costBase: 52 * ECONOMY_TEMPO.upgradePrice,
  costMult: ECONOMY_TEMPO.upgradeGrowth,
  /**
   * INVARIANT: the crystal share of an upgrade must track the crystal share of
   * INCOME, or the scarce resource is not scarce.
   *
   * BOTH OF THESE ARE DERIVED. `crystalCostMult` is `costMult × (crystalMult /
   * alloyMult)` and `crystalCostBase` is `costBase × 0.79 × (crystalBase /
   * alloyBase)`. Two independently hand-picked multipliers drift: the shipped
   * game once ran 1.58 against a 1.55 alloy curve and the crystal cost share
   * climbed from 0.21 to 0.37 across ten levels WHILE THE INCOME SHARE FELL,
   * quietly inverting which resource was scarce. Tying it to the income curve
   * holds the ratio at 0.796 at every level, and `test/invariants.test.ts`
   * enforces exactly that.
   *
   * THE 0.79 RATHER THAN PARITY IS A PvP CONSTRAINT, NOT AN ECONOMIC ONE.
   * Charging crystal as fast as it arrives empties the stores, and an empty store
   * is nothing to raid — raid returns fell through their floor and the informed
   * archetype lost the ladder. Crystal must be spent AND worth stealing.
   *
   * CHARGED FROM LEVEL 0, unlike the shipped curve which started at 1. A crystal
   * cost that begins one rung late leaves a fresh commander watching a resource
   * accumulate that buys nothing, which is decoration rather than scarcity.
   */
  crystalCostBase: 52 * ECONOMY_TEMPO.upgradePrice * 0.2895,
  crystalCostMult: ECONOMY_TEMPO.upgradeGrowth * (1.09 / 1.10),
  crystalCostFromLevel: 0,

  /**
   * STORAGE IS `capHours + capHoursPerVault × vaultLevel` HOURS OF PRODUCTION,
   * AND THE VAULT IS THE BANK. Economy v2, and this change was FORCED.
   *
   * `upgradeCost` grows at 1.54 while a flat-hours store grows at `L · 1.10^L`.
   * THEY CROSS. Above the crossing point one upgrade costs more alloy than a full
   * store can hold, the player simply cannot buy it, and progression stops for a
   * reason nothing in the interface explains.
   *
   * THIS WAS ALREADY LIVE AND NOBODY HAD NOTICED. On the shipped curves,
   * `200 · 1.70^L` against `12 · 80 · 1.45^L` crosses at L10 — 40,320 alloy of
   * upgrade against a 39,441 alloy store — which is well inside the range a real
   * season reaches.
   *
   * Letting the store grow with the Vault fixes it with no new building and no
   * new system, and it hands the Vault a reason to exist a player can feel: how
   * big a purchase can I hold for? The active tempo curve requires 13.2 base
   * hours plus 0.88 per Vault; measured, `costAlloy / storageCap` peaks at
   * 0.906 at L20, so every legal upgrade remains reachable without suppressing
   * raidable stock behind unused headroom.
   *
   * THE PRODUCTION CAP IS STILL THE WORKS, so a bigger store is not a bigger
   * cushion for an absent commander: nothing accrues past `worksHours` while
   * nobody is collecting. A tall store is only reachable by somebody who keeps
   * emptying the works into it — which is one more thing active play buys.
   */
  capHours: 12 * ECONOMY_TEMPO.storageHours,
  capHoursPerVault: 0.8 * ECONOMY_TEMPO.storageHours,

  /**
   * Hours the works hold before they STOP. D16.
   *
   * Production does not flow into storage on its own: it fills a buffer inside
   * the Refinery and the Extractor, and when that buffer is full the works stand
   * idle until the player empties them. One tap, and they start again.
   *
   * TEN HOURS IS A NIGHT PLUS A MARGIN, and it is the single number that decides
   * whether the casual player is excluded. Measured across a 14-day season: a
   * commander who opens the game twice a day throws away 28.8% of their
   * production against an active player's 6.5%. That gap IS the effort gradient,
   * and it is deliberately set at the harsher end because everything else in this
   * economy is generous to the casual player. Raise it to 12 and the waste goes
   * to nearly zero.
   */
  collectorHours: 10,

  /**
   * THE VAULT FLOOR IS DENOMINATED IN HOURS OF THAT RESOURCE'S OWN PRODUCTION,
   * and that shape is what makes D61's bug unrepresentable.
   *
   * The shipped floor was a flat alloy figure applied to crystal as well. Crystal
   * income is about 35% of alloy income, so the same number covered 88% of a
   * young planet's crystal store and crystal was unraidable for the whole
   * opening — measured on the live shard, 13 of 26 raids took nothing at all.
   * There is no single number that can be sized against one resource and
   * misapplied to another once the floor is priced in hours.
   *
   * Deuterium's floor falls out as zero, correctly, because it has no passive
   * rate. That is not a special case any more; it is the same rule.
   *
   * INVARIANT, REPLACING `vaultMult < alloyMult`:
   *   `protectedHoursPerVault / capHoursPerVault < 0.5`
   * At most half a store may ever be safe. At 0.55 / 1.5 the protected share
   * measures 48% for a brand-new planet and 17-27% for everybody else. Nobody is
   * farmed to zero; nobody is ever unraidable.
   *
   * THE FLAT TERM BELOW IS LOAD-BEARING AND WAS MEASURED TO BE. It was removed once
   * — expressing the whole floor in hours, which is tidier — and the five-seed gate
   * refused it twice over: `TI` fell under its floor and **the informed archetype
   * stopped topping the ladder**, which is the claim the whole design rests on. A
   * young planet's two hours of production is a small number, and a galaxy where
   * the weakest worlds can be stripped to nothing is one where being present beats
   * being clever. Do not remove it again without re-running `pnpm sim`.
   *
   * It moved from 0.55 with `capHoursPerVault` because it is denominated against
   * it — a constant priced in another constant has to move with it.
   *
   * The old rule guarded exactly this failure and guarded it silently: a vault
   * that compounds faster than the stock it protects eventually covers 100% of
   * storage with no other symptom. The first draft shipped 1.50 against an
   * `alloyMult` of 1.45 and killed the entire PvP economy for a whole season
   * before the simulator caught it.
   */
  protectedHoursBase: 2 * ECONOMY_TEMPO.storageHours,
  protectedHoursPerVault: 0.3 * ECONOMY_TEMPO.storageHours,
  /**
   * The floor a brand-new planet gets, in alloy, before the hours rule outgrows it
   * — about nine hours of a Refinery-1 world's output. It follows the current
   * price profile so the protected opening moves with the purchases it protects.
   *
   * It binds only below about Refinery 3. While it binds the Vault buys no extra
   * PROTECTION, so `buildingGain` switches that row to what the Vault does move —
   * the storage ceiling — exactly as the Shipyard row switches metric once its own
   * headline flattens. A row that quotes the same figure twice and still charges is
   * the one thing an upgrade screen must never do.
   *
   * The crystal figure is derived from the income ratio, never picked.
   */
  openingFloorAlloy: scalePrice(840, ECONOMY_TEMPO.upgradePrice),
} as const;

/**
 * Deuterium has no passive rate. The Extractor only determines how much of the
 * volatile material its works and storage can contain. D92.
 *
 * PROVISIONAL: the integration sweep may move this inside the measured 0.35–0.60
 * band, but there is one value for every player and season.
 */
export const DEUTERIUM = {
  containmentRatio: 0.5,
  /**
   * HOW MANY PLANT LEVELS ONE RESEARCH RUNG OPENS. T5 — owner's shape.
   *
   * This is the Command Core's rule said a second time, and that is the whole
   * point of choosing it: no building may pass its Core, and no plant may pass its
   * research. A player who has already met one ceiling has nothing new to learn
   * about the other, so the mechanic costs zero teaching.
   */
  plantLevelsPerResearch: 3,
  /**
   * The Frontier act begins simultaneously for the whole galaxy. D93.
   *
   * 42 → 35 hours: this is a game-clock moment, so it takes the INVERSE of the
   * ×1.20 speed factor. The act must open at the same point in the season's
   * shape, not at the same wall-clock hour.
   */
  frontierStartsAtMinutes: 35 * 60,
  /** One rich index per lane, plus one extra seam every ten lanes. D98. */
  isotopeCadence: 9,
  isotopeBonusCadence: 10,
  isotopeRate: 11 / 90,
  /** Inclusive seeded range; replaces ore rather than increasing total value. D102. */
  isotopeShareMin: 0.10,
  isotopeShareMax: 0.25,
  /** A shield must absorb this share of normal outgoing damage to reveal D95. */
  graviticDiscoveryShieldShare: 0.25,
} as const;

/** A specialist profile, not a fourth counter class. D95 · D148. */
export const SHIELD_BREAKER = {
  /** Four bonus copies plus the ordinary hit make five against a live shield. */
  bonusShieldDamageMult: 4,
} as const;

/**
 * THE OPENING GRANT. D22, and MEASURED AGAINST by D29.
 *
 * What a commander is holding the second their planet exists — and it is the ONLY
 * thing they are given. No warships arrive with the planet.
 *
 * WHY THE FLEET WENT. Twelve Wasps was 6,240 alloy of military handed over before
 * the player had made a single decision, and it made the first hour a tour rather
 * than a choice: the one thing the game asks — what do you spend on — had already
 * been answered for them, in favour of the least interesting option. A planet that
 * starts undefended is also honest about what this game is. Everyone starts that
 * way, and the bash limit already stops a developed player
 * farming a fresh one.
 *
 * THE FIGURE IS DERIVED, NOT PICKED. It is exactly the cost of the opening the
 * design wants a new commander to be able to complete in their first sitting:
 *
 *   Command Core 1 → 2      340 alloy ·  92 crystal
 *   Alloy Refinery 1 → 2    340 alloy ·  92 crystal
 *   Crystal Extractor 1 → 2 340 alloy ·  92 crystal
 *   two Wasps               520 alloy ·   0 crystal
 *   ────────────────────────────────────────────────
 *                         1,540 alloy · 276 crystal
 *
 * THE ALLOY FIGURE MOVED AT D61 AND THE ARITHMETIC DID NOT. Hull prices were
 * halved on the owner's instruction, so two Wasps cost 520 rather than 1,040 and
 * this grant is re-derived from the same four lines. It is a smaller number
 * buying exactly the same opening — not a tightening.
 *
 * THE CORE IS FIRST BECAUSE NOTHING ELSE CAN BE. No building may exceed it, and a
 * new planet holds the Core and the Refinery both at L1 — so `1 >= 1` refuses the
 * very first upgrade a commander reaches for. All three upgrades are therefore
 * mandatory in that order, and together they consume **all 276 crystal exactly**.
 *
 * SO CRYSTAL IS WHAT BINDS THE OPENING, NOT ALLOY, and that is the whole reason
 * the first session used to close with nothing in the air: the cheapest flight in
 * the game is a probe at 50 alloy and 25 crystal (D59), and after three mandatory
 * upgrades there is no crystal left to buy one. The two Wasps are the flight the
 * grant actually funds — sending them is what fills a bay, and `firstOrders` now
 * says so in as many words.
 *
 * DO NOT ENLARGE IT TO FIX THAT. Measured across EIGHT seasons at 50 players,
 * adding exactly one probe's worth (2,110 / 326) reads:
 *
 *                       informed archetype tops   RR      TAX
 *   2,060 / 276              7 of 8            1.28     0.073
 *   2,110 / 326              5 of 8            1.49     0.106
 *   3,660 / 516              3 of 5            1.17     0.075
 *
 * A looser opening genuinely improves raid returns and the tax on peaceful players
 * — everyone can act sooner — and it does so by eroding the edge the informed
 * player has. `informedArchetypeWins` is the design's central claim, so that trade
 * is refused. **The opening grant is a lever on how much thinking is worth, and
 * tightening it is the direction that favours the player who thinks.**
 */
export const START = {
  /**
   * RE-DERIVED, AND THE ARITHMETIC IS UNCHANGED. Economy v2.
   *
   *   Command Core 1 → 2       90 alloy · 26 crystal
   *   Alloy Refinery 1 → 2     90 alloy · 26 crystal
   *   Crystal Extractor 1 → 2  90 alloy · 26 crystal
   *   two Darts               600 alloy ·  0 crystal
   *   ─────────────────────────────────────────────
   *                           870 alloy · 78 crystal
   *
   * The figure moved because `costBase` and `costMult` did. The DERIVATION did
   * not, and `test/invariants.test.ts` still holds this to it exactly.
   */
  alloy:
    3 * Math.round(ECON.costBase * ECON.costMult)
    + 2 * scalePrice(240, ECONOMY_TEMPO.hullPrice),
  crystal: 3 * Math.round(ECON.crystalCostBase * ECON.crystalCostMult),
  deuterium: 0,
} as const satisfies Resources;

/**
 * A CUSHION ON TOP OF THE ARITHMETIC — OWNER DECISION, D58.
 *
 * `START` above is exactly what the opening COSTS, and it is spent to the last
   * crystal by the time the rehearsal ends: three mandatory upgrades and the two
   * Darts, which then leave. A commander who has just finished onboarding therefore
 * lands on a world with no ships at home, no resources, and a flight forty minutes
 * out — nothing to press, at the one moment the game has the least credit with
 * them. That is the problem this fixes and it is a real one.
 *
 * IT IS ALSO EXACTLY WHAT THE PARAGRAPH ABOVE REFUSES, and that refusal was
 * measured. The owner's call overrides it knowingly, so the evidence stays where
 * the next reader will find it rather than being quietly deleted: a looser opening
 * buys raid returns and a kinder tax by eroding the informed player's edge, and
 * `informedArchetypeWins` is the design's central claim. Watch it.
 *
 * KEPT SEPARATE FROM `START` RATHER THAN FOLDED INTO IT, for two reasons. The
 * arithmetic is load-bearing documentation — it is what explains why the first
 * three upgrades are mandatory and in that order — and it would be lost inside a
 * single larger number. And a cushion that is its own constant can be tuned, or
 * withdrawn, without re-deriving anything.
 *
 * The current 1,277-alloy planet grant is below the 5,611-alloy Vault-0 store, so
 * the works can be collected immediately. Nothing clamps stored resources
 * downward; the cap only gates what may be collected out of the works.
 */
export const OPENING_BONUS = {
  /**
   * SIZED AS FOUR HOURS OF A FRESH WORLD'S PRODUCTION, rather than picked. That
   * ties the cushion to the economy: it moves with passive production and with
   * any future rate change, and it stays the same thing — an evening's output the
   * commander did not have to wait for.
   */
  alloy: Math.round(4 * ECON.alloyBase * ECON.alloyMult),
  crystal: Math.round(4 * ECON.crystalBase * ECON.crystalMult),
  /**
   * THE STARTING TANK. T6.
   *
   * Zero until fuel existed, because there was nothing to put in it. A world now
   * opens with enough for a real run of early launches and no way to make more
   * until it researches one — which is the chain the opening has to teach, in the
   * order it has to teach it: I have fuel · it is running out · I need a refinery ·
   * the refinery needs research.
   *
   * NOT SIZED IN LAUNCHES, sized in fuel, and `test/fuel.test.ts` holds the ratio.
   * A figure written as "ten launches" stops meaning ten launches the first time
   * `FUEL.scale` moves.
   */
  deuterium: 40,
} as const satisfies Resources;

/**
 * WHAT A NEW PLANET IS ACTUALLY CREATED WITH. One answer, four callers.
 *
 * The server writes it, the claim's idempotency guard recognises an untouched
 * world by it, the simulator opens every bot on it, and the rehearsal predicts
 * against it. Those four MUST agree: a rehearsal that predicts a different opening
 * from the one the server hands out is a screen that contradicts itself at the
 * last step, and a simulator that models a different one is measuring a game that
 * is not shipping.
 */
export const PLANET_START = {
  alloy: START.alloy + OPENING_BONUS.alloy,
  crystal: START.crystal + OPENING_BONUS.crystal,
  deuterium: START.deuterium + OPENING_BONUS.deuterium,
} as const satisfies Resources;

/**
 * WHAT A FRESH PLANET IS BUILT WITH, before the grant above is spent on anything.
 *
 * The Core and the Refinery are BOTH at 1, which is what makes the first three
 * upgrades mandatory and ordered: no building may exceed the Core, so `1 >= 1`
 * refuses the Refinery until the Core moves. That is not a quirk to be worked
 * around — it is the arithmetic the paragraph above describes, and the opening the
 * player is taught.
 *
 * IT LIVES HERE BECAUSE THREE PLACES NEED THE SAME ANSWER. The server writes these
 * rows when a planet is created, the simulator starts its bots on them, and the
 * onboarding rehearsal (D56) shows a visitor a planet that does not exist yet — and
 * a rehearsal whose opening differs by one level from the world it turns into is
 * the interface contradicting itself at the moment it asks to be trusted.
 */
export const START_BUILDINGS = {
  CORE: 1,
  REFINERY: 1,
  EXTRACTOR: 1,
  VAULT: 0,
  SHIPYARD: 0,
  /** No plant, and no research to allow one. Deuterium is earned before it flows. */
  DEUTERIUM_PLANT: 0,
  /**
   * ZERO, AND `HANGAR.base` IS WHY THAT IS SAFE. A world opens with no Hangar and
   * still has to keep a fleet, so the ladder starts at a real figure rather than
   * at nothing — see the block. A base of zero would lock the game shut on the
   * first Wasp anybody bought.
   */
  HANGAR: 0,
} as const satisfies Record<BuildingId, number>;

/**
 * WHAT AN INSTRUMENT COSTS, RELATIVE TO A BUILDING. D22, narrowed by D25.
 *
 * The four ground instruments are not rationed by anything but price — any of them,
 * in any order, at any time. A slot cap says NO; a price says *not this and that as
 * well*, which is the same trade-off without a refusal, and it stays a live
 * decision at every level. The orbit slots that D25 brought back ration SATELLITES,
 * which is a different list and a different kind of object.
 *
 * The multiplier scales `upgradeCost` at every level, so the ratio between an
 * instrument and a building is constant all season and no curve has to be
 * re-derived.
 *
 *   TELESCOPE ×3 — HARD. It sells the single most valuable fact in the game and it
 *     is the one thing the whole design is built to make you want. Something that
 *     good has to cost enough that a player feels the reach for it; free vision is
 *     the fastest way to make a fog layer decorative.
 *   RADAR · AEGIS · VEIL ×2 — MEDIUM-HARD. Each buys one real capability — warning,
 *     absorption, concealment — and none of them is the game.
 *
 * Owner call, and the ratio between the two tiers is the part that matters rather
 * than the absolute numbers.
 */
/**
 * HOW MANY BUILDING LEVELS ONE INSTRUMENT LEVEL IS WORTH. D30.
 *
 * `instrumentCost(id, L) = upgradeCost(L * this) * INSTRUMENT_COST_MULT[id]`.
 *
 * IT IS 1, WHICH IS A NO-OP — AND IT IS HERE ANYWAY, because this is the lever
 * somebody will reach for next and the map of what it does is expensive to
 * re-derive. Read the numbers below before moving it.
 *
 * THE PROBLEM IT WAS ADDED TO FIX IS REAL. Buildings run past L12 in a season;
 * instruments stop at L5, because every effect table that reads them
 * (`telescopeRange`, `telescopeCooldownHours`, `radarRange`) is five entries
 * long. At parity an instrument's TOP rung is therefore priced like a building's
 * FIFTH rung while the player's income sits at a building's tenth — so all four
 * instruments at maximum cost 42,219, which is LESS than a single building step at
 * L10→L11 (49,315) and about ten hours of production for a developed planet. A
 * determined player can own the entire information layer, at maximum, for ten
 * hours of output in a 336-hour season.
 *
 * THE OBVIOUS FIX IS MEASURED TO BREAK THE GAME. Eight seasons at 50 players, then
 * the five-seed gate, moving nothing else:
 *
 *   worth   four@L5    vs a L10 step   informed   gate
 *   1.0      42,219        0.86x         7/8      PASSES  (47/47)
 *   1.1      49,482        1.00x          —       TAX on 3 assertions
 *   1.2      58,194        1.18x          —       TAX + ARR
 *   1.5      96,480        1.96x         8/8      ARR on every seed + RR
 *   2.0     235,962        4.78x         8/8      ARR on every seed + TAX
 *   2.5     605,016       12.27x         7/8      ARR + RR + TAX
 *
 * WHY IT BREAKS, AND IT IS NOT THE OBVIOUS REASON. Dearer instruments do not stop
 * anyone buying them — adoption is FLAT at every value tested: 34% of the galaxy
 * owns a telescope and 100% own at least one instrument, whatever they cost. What
 * moves is where the rest of the money goes. Measured, the wealth split shifts from
 * 15% instruments / 57% buildings to 7% / 60%, and buildings are the one thing a
 * raid can never take — so the share of wealth actually at risk (`ARR`) falls
 * through its floor, and the extra production dilutes `TAX` at the same time.
 *
 * Raising the price of the un-losable thing pushes wealth into the OTHER un-losable
 * thing. That is the opposite of what the design wants.
 *
 * THE MULTIPLIER IS NOT THE ALTERNATIVE LEVER. Raising `INSTRUMENT_COST_MULT` lifts
 * the whole ladder including L1 and shuts the door D22 priced open on purpose. Note
 * `upgradeCost(0)` is unchanged by this constant whatever it is set to, so a
 * Telescope L1 stays at 600 at every value in the table above.
 *
 * WHAT WOULD HAVE TO CHANGE FIRST. `TAX` currently reads 0.100 against a floor of
 * 0.10 — it passes on the last digit, so ANY perturbation tips it, which is why
 * even 1.1 fails. Give `TAX` real headroom and this becomes measurable again.
 */
/**
 * RAISED FROM 1, AND THIS CONTRADICTS D30's MEASUREMENT. Economy v2.
 *
 * At 1, all four instruments at maximum cost less than a third of a mid-game
 * building step, so the entire information layer is bought out by day 2 — the fog
 * becomes uniform, which makes it decoration. At 2 the four cost about one L15
 * step, so owning the set is a real trade, while Telescope L1 still costs 156
 * alloy and the door D22 priced open stays open.
 *
 * D30 MEASURED THAT RAISING THIS BREAKS THE GATE — not through adoption, which is
 * flat at every price, but because it pushes wealth into the OTHER un-losable
 * holding and drops `ARR` through its floor. That measurement was taken against an
 * economy whose `TAX` sat on its floor at 0.100. This economy measures `TAX` at
 * 0.18-0.34 and `ARR` ABOVE its band, so the direction of the risk is reversed.
 *
 * THAT ARGUMENT IS REASONED, NOT MEASURED. It is the single most likely thing in
 * the rewrite to fail the five-seed gate. If it does, put it back to 1.
 */
export const INSTRUMENT_LEVEL_WORTH = 2;

export const INSTRUMENT_COST_MULT = {
  TELESCOPE: 3,
  RADAR: 2,
  AEGIS: 2,
  VEIL: 2,
} as const satisfies Record<InstrumentId, number>;

/**
 * WHAT EACH SATELLITE COSTS, AND WHAT IT DOES. D25.
 *
 * PRICED WELL BELOW THE SHIPPED RATIO, AND THAT WAS MEASURED. The shipped game
 * held the three commitments at four to five times a mid building step; these sit
 * at about half of one. Restoring the old multiple was tried — a satellite is one
 * of the few holdings `ARR` counts as AT RISK, so it looked like the lever for the
 * one metric still out of band. **It moved `ARR` by 0.006 and cost `VFR` on one
 * seed and the Core band on another.** The cheap price stays; see
 * `docs/balance.md` for the five levers that were tried and what each one cost.
 *
 * THE UPLINK IS A DOOR, NOT A COMMITMENT. It has to be reachable from what a
 * commander is holding on turn one — `test/invariants.test.ts` holds it under
 * `PLANET_START.alloy` — because the whole fog layer hangs off it.
 *
 * Four bodies in orbit, one slot each, bought once and never raised. They are the
 * planet-wide multipliers — each one changes a different number, so what you can
 * run at the same time is who you are.
 *
 * PRICED AS A COMMITMENT, NOT AS A STEP. A satellite has no ladder to climb, so its
 * whole value arrives with the purchase and its price has to match: these are
 * roughly what a mid Core level costs, which is a real evening's production.
 *
 * THE BONUSES ARE DELIBERATELY LARGE. A binary you can only own once has to be
 * felt the moment it lands, or the choice between four of them is a shrug. A tenth
 * of a percent is a spreadsheet; a quarter more production is a decision.
 */
export const SATELLITES = {
  /**
   * More of everything the works produce.
   *
   * SIX PER CENT LOOKS TIMID AND IS NOT. PROVISIONAL. A production multiplier
   * compounds twice: it raises the stock a planet holds, and the bots buy ground
   * defence as a ratio OF that stock — so a fat Foundry quietly buys Bastions as
   * well as ore. Measured across the three gate seeds, +8% and above put TURTLE on
   * top of the Dominion ladder on every one of them and +6% put GRINDER back on
   * top of all three. That is the wealth-ladder failure `docs/balance.md` was
   * written about, arriving through a satellite instead of through a score. Raise
   * this and re-run the season gate, or do not raise it.
   */
  FOUNDRY: {
    alloy: scalePrice(2000, ECONOMY_TEMPO.fixedPrice),
    crystal: scalePrice(700, ECONOMY_TEMPO.fixedPrice),
    production: 1.06,
  },
  /**
   * The comms relay the two seeing instruments hang off.
   *
   * It gates the Telescope and the Radar, which is the one place a satellite is
   * allowed to gate anything: it is what makes the FIRST slot a real decision — do
   * you open your eyes, or do you take production, or speed for your drills.
   */
  UPLINK: {
    alloy: scalePrice(900, ECONOMY_TEMPO.gatewayPrice),
    crystal: scalePrice(300, ECONOMY_TEMPO.gatewayPrice),
  },
  /** Services every mining craft the planet owns: bigger hold, faster crossing. */
  DERRICK: {
    alloy: scalePrice(2200, ECONOMY_TEMPO.fixedPrice),
    crystal: scalePrice(800, ECONOMY_TEMPO.fixedPrice),
    hold: 2.6,
    speed: 1.5,
  },
  /** A navigation beacon. Every fleet that leaves here flies faster. */
  BEACON: {
    alloy: scalePrice(3000, ECONOMY_TEMPO.fixedPrice),
    crystal: scalePrice(1000, ECONOMY_TEMPO.fixedPrice),
    speed: 1.3,
  },
} as const;

/** Every satellite has a price, and the map is total. Checked, not assumed. */
const _priced: Record<SatelliteId, { readonly alloy: number; readonly crystal: number }> = SATELLITES;
void _priced;

/**
 * HOW LONG A THING TAKES TO BUILD. Economy v2, and it overrides D4.
 *
 * D4 ruled out build timers and its reasoning was sound AT THE TIME: a timer is a
 * weak return hook and a permanent temptation to sell speed-ups. That was measured
 * against forty-minute flights. Since D63 a raid is a round trip a player can sit
 * through, and CLAUDE.md already records Design Law #6 — *every session must end
 * with something in flight* — as needing re-deriving because the long clock it hung
 * on is gone. **A build queue is the clock that replaced it**, and it is the one
 * pacing mechanism that touches neither the fog, nor combat, nor the ladder.
 *
 * D4'S SECOND ARGUMENT SURVIVES AND CONSTRAINS THIS TABLE. Instant construction is
 * what makes panic defence possible, and `docs/balance.md` sells the radar as *the
 * window to ARM*. So `defence` is not a flourish — it is DERIVED from that promise:
 *
 *   INVARIANT: one ground gun must finish faster than a Radar L3 warning at the
 *   median raid distance. Measured, a Thorn at Shipyard 0 takes 45 seconds against
 *   a 2.0-minute L3 warning, and about eight fit inside an L5 one.
 *
 * TIME IS PRICED IN RESOURCES, which is why there is no per-level table. A constant
 * priced in another constant moves with it, so no price change can ever leave a
 * build time behind, and one formula covers buildings, instruments, satellites,
 * hulls, ground defence and research.
 *
 * THROUGHPUTS ARE CALIBRATED SEPARATELY. Construction, research, the shipyard and
 * emergency defence each make a different gameplay promise; one global speed
 * factor cannot preserve all four.
 */
export const BUILD = {
  /** Resource units per minute. `min(capMinutes, costTotal / throughput)`. */
  conBase: ECONOMY_TEMPO.constructionBase,
  conPerCore: ECONOMY_TEMPO.constructionPerCore,
  yardBase: ECONOMY_TEMPO.yardBase,
  yardPerYard: 0.35,
  defBase: ECONOMY_TEMPO.defenceBase,
  defPerYard: 0.35,
  /** Research is deliberate work, not assembly. */
  researchTimeMult: ECONOMY_TEMPO.researchWork,
  /**
   * Nothing may ever take longer than this. Eight hours, against a brief that says
   * the top of the tree must not reach one to two days. It only binds at Core 20,
   * which no fourteen-day season reaches.
   */
  capMinutes: ECONOMY_TEMPO.buildCapMinutes,
  /**
   * How many orders may be pending in ONE queue. There are two — construction and
   * the yard — and they run independently.
   */
  queueDepth: 3,
  /**
   * What cancelling gives back.
   *
   * NOT A CONVENIENCE NUMBER — it prices an exploit. Resources committed to a queue
   * are out of a raider's reach, so "dump everything into the queue when the radar
   * fires" is a real defensive play. Three slots cap how much can be hidden and
   * half the value is the fee for undoing it. The alternative — making queued
   * resources raidable — costs a whole new concept for one edge case.
   *
   * An order the SERVER abandons refunds in full; that is a fault, not a choice.
   */
  cancelRefund: 0.5,
} as const;

export const COMBAT = {
  rounds: 3,
  varianceMin: 0.92,
  varianceMax: 1.08,

  /** Counter cycle: SKIRMISHER ▸ BULWARK ▸ LANCE ▸ SKIRMISHER. */
  strongMult: 1.6,
  weakMult: 0.625,

  /**
   * Value-loss share below DECISIVE that still earns a partial haul.
   *
   * LOWERED 0.45 → 0.42 AT D62, on the owner's instruction to tip the odds a
   * little toward the attacker. It is the only honest lever for that: the variance
   * band is locked at ±8% (below it randomness drowns the intel layer, D8) and the
   * counter cycle is what makes composition a decision. This number is the one
   * that DEFINES whether an attack counted — a raid that breaks 42% of the
   * defending fleet now comes home with a partial haul and an hour of disruption
   * instead of nothing at all.
   *
   * 0.38 WAS TRIED FIRST AND REFUSED BY THE MEASUREMENT. A lower bar helps the
   * BLIND attacker more than the informed one — an informed attacker already picks
   * fights it wins outright — and at 0.38 the informed archetype lost the ladder
   * again, which is the claim the whole design rests on. 0.42 keeps it.
   *
   * IT CHANGES ALMOST NOTHING TODAY, and that is worth writing down. Measured on
   * the live shard: 30 DECISIVE against 1 REPELLED, because the whole galaxy is
   * defended by 22 Wasps and one Thorn and almost nobody has a shield. The
   * attacker already wins 97% of the time. This is a lever for the point where
   * people start building defence, not for this week.
   */
  partialThreshold: 0.42,
  /**
   * RAISED AT D61 — 0.5 → 0.65 and 0.25 → 0.35. Owner instruction: the game is
   * PvP-first and winning a fight has to feel like winning one.
   *
   * `docs/balance.md` records the loot dial as INERT, and that finding stands: it
   * was tried as a way to change WHO wins a season and it does not, because what a
   * loss costs cannot fix what an attack achieves. That is exactly why it is the
   * right dial to move here. The complaint was never about the ladder — it was
   * that a commander sends a fleet, wins, and is handed 22 resources. Inert on the
   * outcome is precisely what makes it safe to spend on the reward.
   */
  /**
   * 0.65 → 0.70. The brief asks for a high rate because the game is PvP-first,
   * and `docs/balance.md` records the loot dial as INERT on who wins a season —
   * which is precisely what makes it safe to spend on reward feel.
   *
   * It is also the repeat-raid decay system: successive decisive raids take 70%,
   * then 21%, then 6.3% of the original pile, with no cooldown table and no extra
   * state.
   */
  lootDecisive: 0.70,
  lootPartial: 0.35,

  /**
   * PROVISIONAL. How much of an UNCOLLECTED buffer a raid can take, relative to
   * what it takes from storage. D16.
   *
   * Ore still sitting in the works is half as easy to carry off as ore in the
   * store. Not free, and not safe.
   *
   * Both extremes were rejected for the same reason: they remove a decision.
   * Full immunity would make the Vault pointless and would teach every player to
   * leave everything uncollected, which deletes the raidable stock the whole PvP
   * economy is built on (D13). Full exposure would make collecting a chore with no
   * upside rather than a choice. At a half share, "empty the works before you
   * close the app" costs you nothing but a tap and buys you real cover — and
   * forgetting costs you something without wiping you out.
   */
  lootBufferShare: 0.5,

  /**
   * Share of destroyed ground defence rebuilt free from wreckage.
   *
   * With consumable defence the simulator resolved ~95% of attacks as DECISIVE,
   * and if blind raiding never fails there is nothing for information to reduce.
   * Only safe because the ladder is Dominion — under a wealth ladder, durable
   * defence recreates the turtle exploit.
   */
  defenceSalvage: 0.6,

  /**
   * HOW LONG A LANDING TAKES. D44, owner's figure.
   *
   * A fleet reaches its target at `arriveAt` and the outcome is settled ten
   * seconds later. In between, the squadron is over the world firing on it — that
   * is the whole of the engagement, and it is the only moment in the game a player
   * can watch a decision they made forty minutes ago actually land.
   *
   * IT IS A REAL SERVER WINDOW, NOT AN ANIMATION LENGTH, and that distinction is
   * the point. If the battle resolved at `arriveAt` and the client merely played
   * something afterwards, the picture would be a re-enactment of a fact already
   * recorded — and the ten seconds would be a lie about when the fleet fought.
   * Instead `mission_arrival` is scheduled at `arriveAt + this`: the mission is
   * genuinely still `in_flight`, the ships are genuinely still committed, and
   * nothing has been decided. The client draws the state; it does not invent it.
   *
   * WHY IT IS SAFE AGAINST EVERYTHING THE WINDOW TOUCHES. It cannot be used to
   * dodge a raid — a launched fleet cannot be recalled and the defender may not
   * act inside it either, because nothing they could do lands in ten seconds. It
   * does not move the radar ladder, which warns at `arriveAt − lead` and is
   * unchanged. And it is far below the granularity of every clock the player
   * reads: ETAs are whole minutes.
   *
   * SECONDS, NOT MINUTES, because it is the one duration in the game shorter than
   * a minute and rounding it into the travel model would make it either free or
   * an entire minute of standing still.
   */
  engagementSeconds: 10,
} as const;

/**
 * A FLIGHT IS DISTANCE AND SPEED. NOTHING ELSE. D121.
 *
 * THE LAUNCH OVERHEAD IS GONE, AND WITH IT A WHOLE SYSTEM. There were three of
 * them — `TRAVEL.baseMinutes` at 1 minute for warships, `PROSPECTOR.launchMinutes`
 * at 0.13 for drills, and a third about to be added for probes — each with its own
 * travel function, and the only rule binding them was "do not let a craft read the
 * wrong one" (D48). Three constants, three functions and a hazard, in service of a
 * flat charge added to every leg.
 *
 * WHAT IT WAS FOR, AND WHY NEITHER REASON SURVIVED.
 *
 *   · WEIGHT. A fleet does not reach cruise instantly. True, and it read as 8% of
 *     a raid, which is to say it read as nothing. Nobody has ever made a decision
 *     because of it.
 *   · THE MINING LEAD. D48's argument, and the serious one: the rock keeps moving
 *     while the craft is on the pad, so the overhead widens the angle a drill has
 *     to aim ahead by. But it never CREATED that angle — the rock also moves for
 *     the whole flight, which is what makes interception a solve rather than a
 *     straight line. Removing the overhead narrows the lead; it does not delete
 *     the decision. The generated-field sweep in `invariants.test.ts` still finds
 *     every rock reachable through 90% of its life with the term at zero.
 *
 * WHAT FORCED IT was the probe. Three speed increases in a row — ×4, ×12, ×36 —
 * each moved a term that was already small, because at 36× a Wasp the fixed minute
 * was 86% of the flight and no speed divides a constant. The choice was a third
 * overhead constant or none, and none is the one that removes a system.
 *
 * WHAT IT COSTS, MEASURED. Round trips on a typical neighbourhood leg shorten by
 * 7–14%: Wasp 14.6 → 12.6 minutes, Lance 18.4 → 16.4, Bulwark 27.2 → 25.2, Hauler
 * 21.3 → 19.3. The heavier the hull the smaller the share, so the composition
 * decision D63 was protecting gets slightly SHARPER rather than flatter.
 *
 * `distanceFactor` stays. It is the tempo dial — the one number that scales every
 * flight in the game against the map — and it is a multiplier, so a speed change
 * moves through it instead of being swallowed by it.
 */
export const TRAVEL = {
  distanceFactor: 1.2,
} as const;

/**
 * HOW MUCH OF A CRAFT'S MOTION THE GALAXY IS TOLD, AND HOW OFTEN IT IS ASKED.
 *
 * These three used to be private constants inside the server's traffic
 * projection, and one of them silently referred to a number that lives on the
 * CLIENT — the poll interval. When that interval moved, nothing here moved with
 * it, and the result was the largest fog leak in the intel layer.
 *
 * WHAT WENT WRONG, because it is the reason this block exists. A published window
 * is floored at "one refetch" so a craft never freezes between reads. The floor
 * was written as a flat sixty seconds, which was the poll interval at the time. A
 * probe's whole flight is between three and sixty-two seconds (D121 made it
 * thirty-six times a fleet's speed), so the floor covered ALL of it — and a window
 * clamped to the arrival has the DESTINATION as its far end. Every probe in the
 * game therefore published the world it was flying to, to everyone who could see
 * it, for its entire life. Its return leg published the scout's home the same way,
 * which is precisely what Radar L5 is sold for.
 *
 * The floor is the refetch cadence, so it is written down once and both sides read
 * it. D63's lesson, applied to the third constant it had not reached yet: a rule
 * measured in absolute time breaks when speeds change; a rule measured against the
 * thing it is actually about does not.
 */
export const TRAFFIC = {
  /**
   * How often a client asks for the contact list, in milliseconds.
   *
   * NOT A SAFETY NET, unlike every other read's interval. Under the three-zone
   * model a craft outside the caller's circles is not in the payload at all, so
   * when it crosses in the client holds no record to solve a crossing instant
   * from. Nothing can announce that without telling the caller something is coming
   * before it arrives, so this asks often enough that the entry is not felt.
   */
  refreshMs: 5_000,

  /**
   * How far ahead a contact's motion is published, in minutes.
   *
   * Long enough that a missed read does not freeze a craft mid-flight, and short
   * enough that the window is a heading rather than a route.
   */
  bearingMinutes: 4,

  /**
   * AND NEVER MORE THAN THIS SHARE OF WHAT IS LEFT TO FLY. D63.
   *
   * The ceiling above is an absolute duration, and an absolute duration stops
   * being a heading the moment flights get shorter than it. Expressed as a share
   * so it holds at any speed: whatever the tempo, an observer is shown where a
   * craft will be part of the way from here, never where it stops.
   */
  bearingShare: 0.5,
} as const;

export const INTEL = {
  /**
   * WHAT A WORLD CATCHES WHEN ITS RADAR MATCHES THE SCOUT'S SHIPYARD. Owner's figure.
   *
   * Detection is a RACE, not a threshold: `base + slope * (radar - shipyard)`. The
   * base is therefore what a defender catches against an equally developed scout,
   * and — because a missing radar reads as level 0 — it is also what a world with
   * NO radar at all catches from a beginner. It was 0.25, which made the first two
   * rungs of the ladder feel like they unlocked nothing: a quarter of every probe
   * was already being caught by hardware nobody had bought.
   *
   * At 0.15 the bare world still notices SOMETHING, which is deliberate — the
   * `scan_detected` notification is what teaches a new commander that the Radar
   * exists at all (Design Law #2) — but noticing is now the exception rather than
   * the rule, and the instrument is what turns it into a habit.
   */
  detectBase: 0.15,
  /**
   * AND THE STEP PER LEVEL, CHOSEN SO THE LAST RUNG STILL SELLS SOMETHING. D36.
   *
   * `detectMax` is 0.80 and the ladder is five rungs, so a slope of 0.13 puts a
   * maxed Radar against an unequipped scout at exactly `0.15 + 5 * 0.13 = 0.80`.
   * The old 0.18 saturated at L4 — `0.15 + 4 * 0.18 = 0.87`, clamped — which meant
   * Radar 5 bought nothing over Radar 4 against half the galaxy. That is the exact
   * failure `INSTRUMENT_MAX_LEVEL` exists to prevent, arriving through the clamp
   * instead of through the table length.
   */
  detectSlope: 0.13,
  detectMin: 0.05,
  /**
   * AND NOBODY EVER CATCHES EVERYTHING. Owner's figure, lowered from 0.95.
   *
   * A one-in-five chance of getting away is what keeps scouting a decision against
   * a fortified world rather than an arithmetic refusal. It also leaves the Veil
   * and the Shipyard something to buy at the top of the ladder.
   */
  detectMax: 0.80,

  accuracyBase: 0.55,
  accuracySlope: 0.12,
  accuracyMin: 0.3,
  accuracyMax: 1.0,

  /** Clarity 0: a reading refreshes at most this often... */
  intermittentRefreshMin: 20,
  /** ...and this share of refreshes are silently dropped. */
  intermittentDropRate: 0.25,
  /** Clarity −1: reads UNKNOWN this often. */
  degradedUnknownRate: 0.7,

  /**
   * HOW FAR A RADAR REACHES, in game units, by level. D49, owner's ladder.
   *
   * THIS REPLACES A COUNTDOWN, and the replacement is the whole point. The radar
   * used to fire at `arriveAt − lead` off a table of minutes, which made its
   * effective REACH depend on the attacker's hull rather than on the defender's
   * instrument: at the old top rung of twelve minutes it caught a Wasp fleet 460
   * units out and a Bulwark fleet 210, so the heaviest, most dangerous thing in
   * the game was also the thing a radar saw latest. That is backwards.
   *
   * A RADIUS FIXES BOTH HALVES AT ONCE. The warning fires when the fleet crosses
   * inside the circle, so how much NOTICE it buys falls out of how fast the fleet
   * is moving: a Bulwark siege crossing the same shell as a Wasp swarm hands over
   * twice the minutes, because it takes twice as long to cover the distance. So
   * surprise is something an attacker BUYS WITH SPEED.
   *
   * EVERY RUNG NOW REACHES, AND THAT IS THE CHANGE. Indices 0–2 used to be zero,
   * inherited verbatim from the pre-D49 ladder where fleet warning began at L3.
   * The consequence was two rungs that sold almost nothing — a slightly better
   * probe-catch roll and a compass bearing in a log — for 1,100 alloy, while the
   * disc stayed empty for every commander below Radar 3. Under the three-zone
   * model (see `sensorZone`) the radar circle is what makes the galaxy VISIBLE at
   * all, so a rung with no radius is a rung with no product.
   *
   * AND IT OUT-REACHES THE TELESCOPE AT EVERY LEVEL, which is the owner's rule and
   * was not true before: Radar 4 reached 1,500 against a Telescope 4 that saw
   * 1,525, so the instrument that trades detail for range was the narrower of the
   * two. An instrument that detects must reach further than one that identifies,
   * or the ring it draws is inside out.
   *
   *     level   telescope   radar   margin
   *       1         950     1,200     +250
   *       2       1,150     1,450     +300
   *       3       1,250     1,700     +450
   *       4       1,450     1,900     +450
   *       5       1,600     2,200     +600
   */
  radarRange: [0, 1200, 1450, 1700, 1900, 2200] as readonly number[],

  /**
   * HOW FAR A RADAR KNOWS SOMETHING IS COMING FOR YOU. D126, MERGED FOR NOW.
   *
   * These were two circles with two different jobs, and the split is a real design
   * decision that is being TEMPORARILY collapsed on the owner's instruction while
   * the visibility engine is rebuilt — one circle is one thing to draw, one thing
   * to explain and one thing to test.
   *
   * WHAT THE SPLIT WAS FOR, so it can be put back deliberately rather than
   * rediscovered. The wide circle said "something is coming" and carried NO CLOCK;
   * the tight one said "and it lands in fourteen minutes". Notice is
   * `oneWay × min(1, range / distance)`, so a circle wider than a typical leg
   * hands over the ENTIRE flight — and `docs/balance.md` puts the 10th nearest
   * world at 707 units and the 25th at 994. At 2,200 that minimum saturates for
   * the whole neighbourhood, so every local raid is now fully telegraphed and the
   * raidable store the PvP economy stands on (D9, D13) is exposed.
   *
   * THAT COST IS ACCEPTED FOR NOW AND IS NOT A BUG. Splitting the two again is
   * editing this one table back to a tighter ladder — nothing else in the codebase
   * assumes they are equal, because both functions are still separate.
   */
  radarContactRange: [0, 1200, 1450, 1700, 1900, 2200] as readonly number[],

  /**
   * PROVISIONAL. How far a telescope can see, in game units, by level. D18.
   *
   * The galaxy has radius 2,000, so the furthest two worlds can be 4,000 apart.
   * The raw table remains the watch-slot ladder; moving-contact sight is separately
   * floored and capped by `sensorReach` below.
   *
   * This is the constraint the shipped version was missing entirely. Distance
   * decided how long a fleet took to arrive but never decided what you were
   * allowed to KNOW, so a brand-new commander could read the far rim of the galaxy
   * as easily as the planet next door. Range is what makes "who are my neighbours"
   * a real question, and what makes the far half of the disc something you have to
   * earn your way into rather than something you already have.
   */
  /**
   * IT ENDS AT A NUMBER NOW, AND IT USED TO END AT `Infinity`.
   *
   * The top rung was unbounded because this table originally only decided WATCH
   * RANGE — how far a slot may be pointed — and slots are rationed by count and
   * cooldown rather than by distance (D18). Reading the same table for traffic
   * sight quietly turned it into "one maxed Telescope identifies every craft in
   * the galaxy for the rest of the season", which is why `SENSOR.maxRadius` was
   * bolted on top as a cap.
   *
   * A cap over an infinity is two statements of one limit, and they drifted: the
   * L4 rung sat at 1,525 while the cap was 1,800, so the last rung of a five-rung
   * ladder bought 275 units. The ceiling is the owner's figure and the ladder is
   * spread to reach it, so every rung buys a real step and the table says its own
   * ceiling out loud.
   */
  telescopeRange: [0, 950, 1150, 1250, 1450, 1600] as readonly number[],

  /**
   * PROVISIONAL. Hours a telescope slot is locked after being RE-POINTED. D18.
   *
   * Assigning a slot that is empty is free — the cost is switching, not looking.
   *
   * Without this the fog was optional. A Telescope L1 has one slot and re-pointing
   * it was instant and free, so a player could read the fleet status of all two
   * hundred planets in half a minute by moving that one slot down the list. Every
   * word in D6 about a clarity gradient producing judgement assumed you had to
   * CHOOSE who to look at, and nothing in the code made you.
   *
   * Scaled by level rather than flat, on the owner's decision: a low telescope is
   * both narrow and slow to re-aim, and levelling buys slots, range and agility at
   * once. That is what lets it compete with levelling anything else.
   */
  /**
   * SCALED DOWN AT D63, from [0, 24, 20, 15, 10, 6].
   *
   * The cooldown exists so choosing who to watch costs something. It still does —
   * but at twelve-minute round trips six hours was thirty raids long, so a player
   * picked one target and the galaxy turned over completely before they were
   * allowed to look anywhere else. These keep the "several flights" weight the
   * ladder was designed with.
   */
  /**
   * WHOLE HOURS, AND THAT IS A CONSTRAINT RATHER THAN A COINCIDENCE.
   *
   * The first draft of this ladder read `[0, 4, 3, 2, 1.5, 1]`, and `gains.ts`
   * hands the figure straight to `{{hours}}` — which i18next stringifies with
   * `String()`, so a Turkish player upgrading to Telescope L4 was shown "1.5 saat"
   * where the language writes "1,5". Every number a player reads is supposed to go
   * through `format.ts` for exactly that reason. Five whole hours down to one keeps
   * five distinct rungs and takes the decimal out of the problem entirely.
   */
  telescopeCooldownHours: [0, 5, 4, 3, 2, 1] as readonly number[],
} as const;

/**
 * WHAT A COMMANDER CAN SEE MOVING, AND WHAT A SILHOUETTE SAYS. D123.
 *
 * THE GALAXY WAS PAYING FOR THE INTEL LADDER AND KEEPING THE CHANGE. `traffic.ts`
 * wrote the failure down before it happened — "a departure is visible now and was
 * not before, and a composition is readable where it used to cost Radar L4… this
 * is the first thing to re-read if a playtest says scouting stopped mattering" —
 * and the first real play session said exactly that. Telescope and Radar were
 * selling what a logged-in player already had, so there was no asymmetry left for
 * a tactic to live in, and the only strategy the numbers rewarded was mass.
 *
 * TELESCOPE IDENTIFIES; RADAR DETECTS. The Telescope says what a craft is inside
 * its finite reach. The wider Radar makes it a moving question mark and adds a
 * size/kind disclosure on its upper rungs; its warning ladder separately attributes
 * an inbound threat. `sensorZone` is the only place those radii become an answer.
 *
 * `baseRadius` IS THE FLOOR, AND IT IS LOAD-BEARING. `INTEL.telescopeRange` starts
 * at zero, so a ladder with no floor would open on a dead galaxy for every new
 * commander. This is the naked-eye neighbourhood: generous enough that the galaxy
 * is busy where you live, small enough against a 2,000 radius that the far side is
 * something you buy your way into.
 */
export const SENSOR = {
  /**
   * PROVISIONAL. The neighbourhood every commander sees for free, in game units.
   *
   * Settled by playtest, not by argument: the one thing that can go wrong here is
   * a disc that reads as empty, and no test can see that. `node tools/visual.mjs`
   * and a phone are the instruments.
   */
  baseRadius: 750,

  /**
   * AND A CEILING, BECAUSE THE FOG MAY NEVER FULLY LIFT. D126.
   *
   * `INTEL.telescopeRange` once ended at `Infinity`, written when the top of that
   * ladder only bought WATCH RANGE — how far you may point a slot. It is finite
   * now; this ceiling remains the invariant that guards the identifying horizon.
   *
   * Reading the same table for TRAFFIC reach quietly turned it into something
   * else: one maxed Telescope on one world, and every craft in the galaxy is
   * identified for that commander for the rest of the season. Found on the owner's
   * own account — a Telescope 5 capital beside three Telescope 0 colonies,
   * resolving all 104 worlds while the colonies drew their local sensor
   * bubbles. The system was a no-op for the player who had paid most for it.
   *
   * `docs/game-design.md` already forbids this in as many words: "Floors and
   * ceilings guarantee that no investment buys perfect invisibility or perfect
   * omniscience — the fog never fully lifts." Being below only the maximum
   * crossing was insufficient: a sensor at the centre can see the whole galaxy as
   * soon as its reach equals the radius. The ceiling is 80% of the radius-2,000
   * sphere, so even the best possible origin leaves a real outer shell.
   *
   * IT IS THE TELESCOPE'S CEILING, NOT THE GALAXY'S. The Radar reaches further by
   * design and is capped by its own table — a mote you cannot identify is not
   * omniscience, and letting the detecting instrument out-reach the identifying
   * one is the whole shape of the three-zone model. See `INTEL.radarRange`.
   *
   * It now AGREES with `INTEL.telescopeRange`'s own top rung rather than capping an
   * infinity, so the two can no longer drift apart.
   */
  maxRadius: 1600,


  /**
   * WHERE A SILHOUETTE CHANGES SIZE, in total hull value.
   *
   * Three steps rather than a ramp, for the same reason `worldWeight` has three:
   * a continuous size no eye can separate communicates nothing. LIGHT is a scout
   * party or a probe screen, MEDIUM is a working raid, HEAVY is somebody
   * committing. That is the whole of what a stranger is entitled to.
   *
   * Read against `fleetValue`, which is the quantity the hull table is priced on,
   * so the buckets move with prices instead of drifting away from them.
   */
  massMedium: scalePrice(8_000, ECONOMY_TEMPO.hullPrice),
  massHeavy: scalePrice(40_000, ECONOMY_TEMPO.hullPrice),
} as const;

/**
 * Explorer probes.
 *
 * Fast and cheap relative to a fleet, because the decision they exist to create is
 * "spend 7 minutes to know, or strike blind now" — not "can I afford to look".
 * Shipyard level supplies BOTH probe accuracy and probe stealth: one building
 * gates the whole active-intel path, which keeps the player's model small.
 *
 * `maxInFlight` USED TO LIVE HERE and was deleted by D28. Scouting is still
 * rationed — more tightly, in fact, because a probe now competes with a raid and a
 * mining run for the same bay — but a cap on one craft type was a special case
 * where a general rule was wanted. See `flightSlots` in `economy.ts`.
 */
export const PROBE = {
  /**
   * Cut from 220 alloy to 50 alloy and 50 crystal, on the owner's instruction.
   *
   * The old price was a fifth of a Wasp and still bought nothing at all in the
   * first hour of an account — which is exactly the hour the player is deciding
   * whether this is a game about looking or a game about hitting. Charging a
   * little of BOTH resources is what keeps it a decision after the opening: alloy
   * alone is the resource nobody is ever short of.
   *
   * The crystal half was halved again to 25 at D59, with the speed tripled — see
   * both below. HOW MANY may be in the air at once is NOT set here: it is the
   * general flight-bay rule (`flightSlots`), which D28 made the one scarcity every
   * craft in the game shares, and the owner's call is that it stays that way.
   */
  alloy: 50,
  /**
   * Halved to 25 on the owner's instruction, with the speed below.
   *
   * The pair of changes has one purpose: make looking the thing a player reaches
   * for first. Crystal is the binding resource in the opening — the three
   * mandatory upgrades consume all of it — so it is the half of this price that
   * decides whether a probe is affordable at the moment somebody is deciding what
   * kind of game this is.
   */
  crystal: 30,
  /**
   * ×12 AT D121, ON THE OWNER'S INSTRUCTION: 260 → 3120. ×4 WAS TRIED FIRST.
   *
   * THE HISTORY, BECAUSE IT IS THE REASON THIS NUMBER HAS A CEILING. D59 tripled
   * it from 90 because the answer arrived long after the decision it was meant to
   * inform and players raided blind instead. D63 then scaled every hull by 9.46,
   * and the two compounded to 2554 — at which point EVERY PROBE IN THE GALAXY
   * LANDED IN EXACTLY TWO MINUTES, measured across five legs from the closest pair
   * on the disc to the furthest: 2, 2, 2, 2, 2. Distance had stopped meaning
   * anything to a scout, and "who is near enough to look at cheaply" is a gradient
   * the whole intel layer is built on. 2554 was rejected for that and only that.
   *
   * 3120 IS PAST THAT NUMBER, AND THE DISC IS WHY IT IS NOT THAT OUTCOME. D101
   * widened the galaxy 2.5×, so `GALAXY_SPAN` is 5036 against the ~2010 those five
   * legs were measured on; 2554 on today's map is not the speed 2554 was.
   *
   * ×36 WAS TRIED AND WALKED BACK, AND THE MEASUREMENT IS THE REASON. At 9360 the
   * one-way legs were 1.03 / 1.16 / 1.65 minutes — closest pair, neighbourhood,
   * widest crossing — because `TRAVEL.baseMinutes` was 86% of the flight and speed
   * could not touch it. Tripling the speed bought twenty seconds and flattened the
   * distance gradient to 1.6×, which is D59's failure arriving by the front door.
   * The fix was never a bigger number here; it was `launchMinutes` below.
   *
   * WITH THE OVERHEAD GONE, THIS NUMBER IS THE WHOLE MODEL AGAIN — a probe's
   * flight is exactly `distance ÷ speed`, and every unit of distance is paid for.
   * The gradient is 22× at any speed now, because with no fixed term the ratio is
   * exactly `GALAXY_SPAN / minSeparation` and nothing here can move it: 4 seconds
   * to the closest legal pair, 20 to the neighbourhood a commander actually
   * watches, 78 to cross the whole disc. That is a WIDER spread than the probe has
   * ever had, and it is faster everywhere — the fixed cost was what had been
   * flattening it all along.
   *
   * 4680 remains far above every Fleet V2 hull: a scout outruns the fastest thing
   * anyone can send at you by a wide, stated margin. Probe behavior itself is
   * deliberately untouched by D148.
   *
   * IT NO LONGER RATIONS SCOUTING, AND IT WAS NEVER SUPPOSED TO. What stops a
   * commander reading the same world over and over is stated as a rule rather than
   * smuggled in as travel time: `retargetCooldownMinutes` below, plus the flight
   * bay every craft in the game competes for (D28).
   */
  speed: 4680,
  /**
   * HOW LONG BEFORE THE SAME COMMANDER MAY LOOK AT THE SAME WORLD AGAIN. D121,
   * owner instruction.
   *
   * Measured from the LAUNCH, not from the report, so the hour is the same hour
   * for a neighbour and for a world on the far rim. Anything measured from the
   * return would charge distance twice — once in the flight and again in the
   * cooldown — and the flight is already where distance is supposed to be felt.
   *
   * SCOPED TO THE COMMANDER, NOT TO THE WORLD THE PROBE LEFT FROM. A commander may
   * hold four worlds (D97), and a per-origin rule would sell the same hour four
   * times over to whoever had colonised most — which is a wealth ladder wearing an
   * intel rule's clothes.
   *
   * It replaces the rationing that travel time used to do by accident, and it is a
   * better version of it: a flight that is too long to be worth taking hides the
   * decision inside a wait, while a stated hour puts "is this the world I want to
   * spend my look on" in front of the player at the moment they choose.
   */
  retargetCooldownMinutes: 60,
} as const;

/**
 * The Prospector — the drill craft. D19, rebuilt by D25.
 *
 * ONE CRAFT, AND NO LADDER. Its speed and hold used to come from a DRILL satellite's
 * LEVEL, which is a structure D25 removed: a drill is a craft you build at the
 * Shipyard, and the thing that improves it is the DERRICK in orbit — one satellite,
 * owned or not, lifting every craft the planet has at once.
 *
 * SPEED IS THE LOAD-BEARING NUMBER. D74 sets the base to 330 and keeps the
 * Derrick's 1.5x lift, for 495.
 *
 * It was 62 against rocks that run at 140-300, and the mathematics of that were
 * never wrong — a closed orbit means a slower craft still has a meeting, it simply
 * has to wait for the rock to come back round. What was wrong is what it LOOKED
 * like. Measured over 3,483 launches across twelve planets and a day of clock, the
 * average meeting was 1.10 REVOLUTIONS ahead: the player tapped a rock, and the
 * squadron set off for a point a median of 686 game units away from it, routinely
 * on the far side of the disc. Every one of those flights was exact. Not one of
 * them was legible, and the owner reported it as craft going somewhere unrelated.
 *
 * D43 temporarily put it at 3x the mean rock speed. D74 halves that figure by
 * owner instruction. Across the five gate seeds the widest measured base lead is
 * 1.006 revolutions; the Derrick stays at 0.666.
 *
 * The base is below the old monotonic-root threshold of 360. The circular solver
 * was built for slower craft, and the generated field is measured directly:
 * neither the base nor boosted craft misses a live rock through 90% of its life.
 *
 * WHY THIS IS NOT A MINING BUFF. Income is `hold ÷ round trip` per craft, but the
 * GALAXY's mining income is bounded by the ore that exists — about 6,700 an hour
 * across every player, against a demand of two craft x 300 hold per planet per
 * trip. Supply has always been the binding constraint by two orders of magnitude,
 * so a shorter trip changes WHO reaches a rock first and how long a flight bay is
 * held, not how much ore the field yields. What it sharpens is D19's race, which
 * is the point of the feature.
 *
 * THE HOLD IS WHAT SETS A CRAFT'S OWN INCOME, not the size of the rock. Income is
 * `hold ÷ round trip`, and a rock has always held several loads, so shrinking rocks
 * alone changes how OFTEN a field is exhausted and not what a miner earns in an
 * hour. The base is the old first rung and the Derrick lands it near the old top,
 * so the ceiling a developed miner reaches is where it always was.
 */
/**
 * HOW MUCH FLEET A WORLD MAY KEEP. T4.
 *
 * Nothing bounded a fleet but a purse, so the only question a rich commander ever
 * faced was "how many more can I afford" — the wealth ladder D2 exists to refuse,
 * arriving through the shipyard instead of the score. The owner's brief was exact:
 * unlimited or far too many should not be buildable, and enough or a little more
 * should be.
 *
 * MEASURED, NOT GUESSED. Across the five gate seasons a commander ends with a
 * median 470 units of room in ships, 2,150 at the ninetieth percentile and 3,370 at
 * the very top, against a median Command Core of 14. The ladder below is fitted to
 * that shape:
 *
 *   Hangar 0    100    the opening fleet still fits, but expansion presses early
 *   Hangar 2    260    the median commander must invest deliberately
 *   Hangar 12  1060    the top tenth no longer gets a mostly unused warehouse
 *   Hangar 14  1220    the ceiling at Core 15 remains finite and meaningful
 *
 * So a casual player never meets it, a fleet player spends real levels on it, and
 * unbounded accumulation stops. THE BINDING CONSTRAINT IS THE CORE, not the price:
 * no building may reach its Core's level, so the ceiling is set by how developed
 * a world is rather than by how much ore was poured into one building.
 *
 * `base` IS NOT OPTIONAL AND MAY NOT BE ZERO. `START_BUILDINGS.HANGAR` is 0 and a
 * fresh world must be able to keep the ships its opening grant buys; the neutral
 * templates are seeded at Hangar 0 too and the tier-3 garrison alone is 70 units.
 */
export const HANGAR = {
  base: 100,
  perLevel: 80,
  /** Hangar room is a strategic ceiling, so each rung costs twice an ordinary building. */
  costMultiplier: 2,
} as const;

/**
 * HOW MANY EMPLACEMENTS A WORLD MAY STAND. T4b.
 *
 * This ships with the Hangar and cannot be deferred, because the Hangar is what
 * creates the need for it: before T4 a commander's surplus could go into ships OR
 * turrets, and after it ships are capped and turrets are not — so the only place
 * left for a surplus is the ground, and the turtle becomes the dominant strategy
 * through a slope the fleet cap itself cut.
 *
 * D27 is the second reason and the better one. Two opposing ground classes exist to
 * turn "how much defence" into "what KIND", which is the question only the
 * information layer can answer — and an uncapped "how much" refuses it: buy enough
 * and you own both classes and never choose. Bounding the total is what makes the
 * choice real.
 *
 * A SEPARATE POOL FROM A SEPARATE SOURCE, deliberately. Sharing one pool with the
 * Hangar would bind attack and defence to a single slider and collapse two
 * decisions into one. The Command Core is the right source because it already means
 * "how big is this world" — it opens flight bays, orbit slots and colony capacity —
 * and it needs no seventh building.
 *
 * CALIBRATED AGAINST THE GAME'S OWN FORTRESS, because the simulator cannot see this
 * one: its bots build almost no ground defence at all (median zero, ninety-ninth
 * percentile twelve units), so there is no distribution to fit. `MULTI_WORLD.neutral[3]`
 * is the design's own statement of a FORTIFIED world — 50 units of guns at Core 8 —
 * and the ceiling there is 100. The hardest thing the game builds for itself sits at
 * half of what a player may stand, which leaves room to out-fortify it without
 * leaving room to become unraidable.
 */
/**
 * THE ONE DIAL ON FUEL. T6.
 *
 * `missionFuel` is mass × distance ÷ this, rounded up, once per leg. The figure is
 * fitted to the two ends of the game rather than picked:
 *
 *   · A fresh commander's raid — ten Wasps at a neighbour 600 units away — costs
 *     two, so the opening is not taxed and `PLANET_START.deuterium` covers a real
 *     run of them. The chain the opening teaches is "I have fuel, it is running
 *     out, I need a refinery"; a tank that emptied on the second launch would
 *     teach panic instead.
 *   · A committed fleet at the far rim costs real money, so distance is a decision
 *     rather than a formality.
 *
 * IT IS THE LEVER THAT MOVES IF THE BANDS BREAK. Loot and `COMBAT.defenceSalvage`
 * are inert on attack effectiveness, and the health bands are never widened to
 * admit a feature — so if fuel pushes ARR under its floor, this number comes down
 * and nothing else does.
 */
/**
 * WHAT RESEARCH IS ALLOWED TO BE WORTH. T8 · T9.
 *
 * THE ONE HARD RULE IS THE POWER CEILING, and it is the claim the whole game rests
 * on stated as a number:
 *
 *   information (the counter cycle)  1.6 / 0.625 = 2.56x   =  156% advantage
 *   technology  (every project)                    1.25x   =   25% advantage
 *
 * `hulls.ts` says it outright — "information beats tech by construction, and that
 * is the claim the whole game rests on". Give attack and hit points 25% EACH and
 * the product is 1.5625x, which is not 25%: it is 56%, and it lands close enough
 * to the counter cycle that knowing what your opponent flies stops being the
 * decisive thing. So the ceiling is on the PRODUCT, every weapon project's
 * contribution is derived from it, and `test/tech.test.ts` holds the arithmetic
 * rather than a comment promising it.
 *
 * The economy figures are separate and small on purpose. `cargoPerLevel` is the
 * one that moves ARR — `fleetCargo` caps what a raid carries home — so it is the
 * smallest of the three and the band is measured, never assumed.
 */
export const RESEARCH_TECH = {
  /** Equal-budget power a fully-teched hull may reach. Never above the counter cycle. */
  powerCeiling: 1.25,
  /** Rungs on a weapon doctrine, and on each economy project. */
  engineeringMaxLevel: 2,
  weaponMaxLevel: 5,
  economyMaxLevel: 5,
  /**
   * How the ceiling is split between a hull's own doctrine and the general
   * attack/armour project. Half each, so neither alone is the whole answer and
   * both are worth the levels.
   */
  doctrineShare: 0.5,
  /**
   * FOUR PROPULSION RUNGS ADD A QUARTER EACH, AND THE FOURTH DOUBLES THE FLEET.
   * D152, owner instruction. Existing arrival timestamps never move.
   *
   * IT USED TO BE FIVE RUNGS OF TWO PERCENT. Ten percent at the top of a ladder
   * priced beside `SHIP_POWER` is a rung nobody could feel: a Dart bought all five
   * and arrived twelve seconds earlier across the neighbourhood it actually
   * watches. D124's rule is that a rule the player cannot SEE is not a usable
   * rule, and a bonus this small was that failure wearing a percentage sign.
   *
   * A SEPARATE CEILING FROM `weaponMaxLevel`, and that is the load-bearing part.
   * Power and Armor share `powerCeiling` because they multiply into equal-budget
   * power; speed is not a combat statistic and takes no share of that product, so
   * it needs its own top rather than borrowing the weapon ladder's. Four rungs
   * at a quarter each read as 1.25 / 1.50 / 1.75 / 2.00 — the ladder is legible
   * from the number itself, which is what the old one never was.
   *
   * WHAT IT DOES NOT REACH: the probe, the Prospector and the Death Star. Speed
   * research is a `hullTech` factor and those three are not Fleet V2 hulls, which
   * is the same boundary D101 drew when it named what took the disc's factor.
   */
  propulsionPerLevel: 0.25,
  /** Rungs on Propulsion. Its own, because speed takes no share of `powerCeiling`. */
  propulsionMaxLevel: 4,
  /** Build time shaved per rung. Small: the Shipyard still owns the curve. */
  yardSpeedPerLevel: 0.04,
  holdPerLevel: 0.08,
  cargoPerLevel: 0.04,
} as const;

/**
 * THE WEAPON THAT ANSWERS THE WEAPON. T10.
 *
 * A Death Star is 33,000 resources, an hour of build, a Command Core of twelve, a
 * Shipyard of five and the whole Frontier chain. An interceptor that stopped it
 * cheaply would throw every bit of D113's work away, so the two are priced against
 * each other rather than separately.
 *
 * IT FIRES ON THE RADAR CIRCLE, AND THAT IS THE DESIGN. A check at arrival would be
 * an INVISIBLE rule — you would only ever meet its result, which D124 forbids in as
 * many words. The timed radar ring is already drawn on the disc (D126), so a weapon
 * dying on it is a rule with a picture: the explosion happens in space, over the
 * ring, beside the world; the Radar rung suddenly buys something enormous; and an
 * attacker who scouts can read the reach and price the risk before spending 33,000.
 *
 * ONE CHARGE, AND THE NUMBER IS THE WHOLE INTERLOCK. At two, a loaded defender is
 * immune to a commander who may only stockpile two weapons, and the Death Star
 * stops existing. At one, the answer is on the board: send the first as bait, land
 * the second. T11 is that answer, which is why the two ship together.
 */
export const ANTI_STRATEGIC = {
  /**
   * THE FIRST RADAR RUNG THAT CAN ENGAGE A STRATEGIC WEAPON.
   *
   * General Radar contact and warning circles already exist at L1/L2. Only
   * `interceptionRange` is zero below this rung; a grid installed there could
   * never fire and its owner would have no way of knowing why — the "I built the
   * expensive thing and it never went off" trap, stated as a build refusal.
   */
  requiredRadar: 3,
  requiredResearch: 'INTERCEPTION_GRID',
  maxCharges: 1,
  /** Immediate launch, with enough screen time for every entitled client to join the scene. */
  flightSeconds: 8,
  /**
   * About a third of what it destroys. Dear enough that a defence is a real
   * decision, cheap enough to be worth making — and it reloads in half the time
   * the thing it shoots down takes to build, because a defender who spent their
   * shot should not be defenceless for the rest of the hour.
   */
  cost: {
    alloy: scalePrice(8000, ECONOMY_TEMPO.fixedPrice),
    crystal: scalePrice(8000, ECONOMY_TEMPO.fixedPrice),
    deuterium: scalePrice(1200, ECONOMY_TEMPO.deuteriumPrice),
  },
  buildMinutes: 30,
} as const;

export const FUEL = {
  scale: 10_000,
  /**
   * THE SPAN A PER-CRAFT FUEL FIGURE IS QUOTED OVER. Owner report — a ship card
   * has to say what one of these costs to fly.
   *
   * A READING UNIT, NOT A DIAL, and the difference is load-bearing: `scale` is the
   * price of every launch in the game, this is the width of the yardstick a card
   * holds up against a hull. Moving it changes no charge anywhere.
   *
   * A THOUSAND, because that is a distance the disc actually has — the map is four
   * thousand across and a neighbour is six hundred away — and because it puts the
   * whole hull table on one readable scale: a Wasp at a tenth, a Bulwark at more
   * than one. A hundred would print `0.01` for the most common ship in the game.
   */
  reference: 1_000,
} as const;

export const EMPLACEMENT = {
  base: 20,
  perLevel: 10,
} as const;

export const PROSPECTOR = {
  /**
   * Game units per minute, before a Derrick.
   *
   * 330 → 825: the ×2.5 UNIT CHANGE, and it is not optional. This craft's speed is
   * tied to ROCK speed, not to warship speed — it has to aim ahead of a moving
   * target — and the rocks took the same factor so that the field still reads as
   * moving on a disc 2.5 times wider. The orbital period is unchanged because
   * radius and speed both scaled, so every interception ratio is exactly where it
   * was.
   */
  speed: 825,
  /**
   * HOW MUCH SLOWER A LADEN CRAFT FLIES HOME. Owner's figure: three times.
   *
   * A RATIO, and it has to be one. D63 moved hull speeds by 9.46 and nine tests
   * failed at once, none because the thing they tested had broken — every rule
   * written as an absolute number of minutes stops being the fraction it was meant
   * to be the moment the tempo changes. This is the share of its outbound speed a
   * craft keeps on the way back, so it survives the next time `speed` moves.
   *
   * IT MULTIPLIES THE SPEED, NOT THE TRIP. D121 removed the launch overhead from
   * every craft in the game, so a trip is now `distance ÷ speed` and this ratio
   * scales the whole of it. Before that it scaled only the travel term, because a
   * flat overhead was not a function of speed — the shape changed with the term
   * that made it necessary.
   *
   * WHAT IT COSTS THE PLAYER IS VISIBLE THE WHOLE TIME, which is why it is this
   * rather than a cooldown. A craft is drawn for its owner and for the whole
   * galaxy for every minute of the trip, it holds a flight bay while it flies, and
   * `PROSPECTOR.max` already rations how many a planet may own. A lockout after
   * landing would ration the same thing a second time, and it would do it as a
   * timer with nothing on screen — which is the one thing the product's second
   * test forbids outright.
   *
   * THE SALVAGE RUN PAYS IT TOO. Owner decision. `resolveMiningArrival` turns both
   * kinds of run around through the same line, so a wreck field is not a faster
   * way home than a rock.
   */
  returnSpeedFactor: 1 / 3,
  /** Resource units one craft carries home, before a Derrick. */
  hold: 300,
  /**
   * HOW MANY A PLANET MAY EVER OWN. Owner's figure.
   *
   * Mining is a side errand, not a career. Uncapped, the only question a miner ever
   * faces is "how many more can I afford" — the answer is always "more", the fleet
   * scales linearly with wealth, and mining income decouples from every decision
   * the game is actually about. Two makes the interesting question the one D19
   * wanted: WHICH rock, and WHEN, given that a squadron is away for a round trip
   * and holds one of a handful of flight bays while it is.
   *
   * It also bounds the throughput D31 deliberately capped by planet size: two
   * craft is `2 x hold` per round trip and no more, whatever a season's wealth
   * curve does.
   *
   * Counted across EVERY location, not just the ones sitting at home — craft in
   * flight are still owned, and a cap that a launch could dodge is not a cap.
   */
  max: 2,
} as const;

/**
 * PROVISIONAL — shield curve is settled by playtest.
 *
 * CUT FROM 700 TO 40, AND THE REASON IS D22 RATHER THAN TASTE.
 *
 * The old figure was only ever survivable because almost nobody could afford an
 * Aegis: it competed for one Orbital Ring slot, and the season simulator's own
 * archetypes mostly spent that slot on something else, so the median planet in the
 * galaxy had no shield at all. Under that accident, a first-level shield worth 994
 * hit points — more than forty Wasps — never showed up in the aggregate.
 *
 * The moment satellites stopped being rationed, it did. Measured across the three
 * gate seeds: the share of the galaxy running an Aegis went from 18% to 67%, the
 * median shield from 0 to about 5,700, and raid returns from 1.33–1.42 down to
 * 0.60–0.73 against a floor of 1.30 — raiding destroyed more value than it earned,
 * which ends the core loop. Repricing the satellite does not touch it (an Aegis at
 * five times the price is still bought); the shield itself was mispriced.
 *
 * WHAT 40 MEANS IN PLAY. A new Aegis absorbs 57 points — a couple of Wasps — and a
 * developed one a few hundred, against ground defence measured in the same units.
 * It is a buffer that buys a round, regenerates for free and can never be
 * destroyed outright. It is no longer a wall that makes a planet unraidable for
 * the price of one satellite.
 */
export const SHIELD = {
  base: 60,
  mult: 1.5,
  /**
   * 0.05 → 0.40 AT D63, and it is the same decision as everything else on this
   * page: the number was right against forty-minute flights and is meaningless
   * against six-minute ones.
   *
   * At 5% an hour a stripped shield took twenty hours to come back — a hundred
   * raids at the new tempo, so the shield was permanently at zero and the live
   * shard already showed it: two planets in thirty-nine had any shield at all.
   * At 40% it recovers in two and a half hours, which is what twenty hours used
   * to be worth in raids.
   */
  /**
   * 0.40 → 0.35. Full recovery in about three hours, which at the new tempo is
   * eleven to sixteen raid round trips: a defender hit hard stays soft for a few
   * hours, and a defender hit once is whole again before they next log in.
   */
  regenPerHour: 0.35,
} as const;

/**
 * PROVISIONAL. A successful raid also knocks the target's surface works offline.
 * Buildings are never damaged — the ownership pillar holds — but the victim now
 * loses COMPOUNDING rather than merely stock, which is the only thing that makes
 * raiding competitive with building over a season.
 */
export const DISRUPTION = {
  /**
   * 40 → 15 and 15 → 5 AT D73.
   *
   * Disruption is priced against what a raid COSTS to mount. At forty-minute
   * flights three hours of a victim's works was 3.3× the attacker's effort; at
   * twelve-minute round trips it became 15×, so raiding stopped being rewarding
   * and became disproportionately efficient — a defender hit twice was capped out
   * for four hours on twenty-four minutes of somebody's attention.
   */
  decisiveMinutes: 20,
  partialMinutes: 7,
  /** You can never be disrupted more than this far into the future. */
  maxPendingMinutes: 25,
} as const;

/**
 * The two protections that survive, and the one that does not.
 *
 * Both of these scale with the situation: the tier band stops a large player
 * farming a small one, and the bash limit stops anyone being hit over and over.
 * The newcomer grace period — four hours of immunity for being freshly joined —
 * was removed by owner decision (D14). Nothing is protected for merely being new.
 */
export const ABUSE = {
  bashLimit: 3,
  bashWindowMinutes: 720,
} as const;

export const GALAXY = {
  /** The playable volume is one sphere centred on the origin. */
  radius: 2000,
  minSeparation: 225,
  defaultSlots: 200,

  /**
   * ASTEROIDS ORBIT. They were briefly put on straight passes, and that was wrong.
   *
   * The reasoning for a straight line was that it makes interception a closed-form
   * quadratic, and it does. What it also does is force the rocks to be SLOW: on a
   * one-way path, a craft can only ever meet a rock it is faster than, so the speed
   * band had to sit under the slowest Prospector. At those speeds a rock moved a
   * tenth of a planet-width in twenty seconds — the disc looked frozen — and
   * because lifetime is path over speed, they also lived for hours and piled up
   * fifty at a time.
   *
   * A CLOSED ORBIT REMOVES THE CONSTRAINT ENTIRELY. The rock comes back round, so
   * a craft slower than the rock still has a meeting available to it — it aims at
   * a point the rock will reach on a later pass. Interception stops being a
   * speed comparison and becomes a root find, which is a few hundred cheap
   * iterations and exact enough that the two coincide to a fraction of a unit.
   *
   * So the rocks can be as fast as they need to be to read as moving.
   */

  /**
   * New rocks entering the disc per hour. PROVISIONAL.
   *
   * RAISED 15% FROM 9 TO 10.35, owner decision. A denser sky: more of the disc is
   * worth looking at, and the race for a rock happens oftener.
   *
   * WHAT IT MOVES, BECAUSE THE FIELD IS DERIVED AND NOT STORED (A5). The existing
   * 9/hour lane keeps its indices, rolls and appearance times. The extra 1.35/hour
   * is a second deterministic lane with new indices, so increasing density adds
   * rocks without making a live target jump or disappear between two reads.
   *
   * It is safe for a run already in the air: `resolveMiningArrival` finds its rock
   * by INDEX and does not re-check `asteroidActive`; all established indices still
   * name the same orbit. The claim rows keyed by index stay coherent for the same
   * reason.
   */
  asteroidSpawnPerHour: 10.35,

  /**
   * Game units per minute along the orbit, random inside this band and INDEPENDENT
   * OF LEVEL — a rich rock is not automatically a slow one.
   *
   * Sized for VISIBILITY first, which is now allowed: 140-300 units a minute is
   * 2.8 to 6 world units on screen, so a rock crosses several planet widths every
   * minute and the field reads as moving within a second of looking at it, not
   * after staring. The orbital period follows from this and the radius rather than
   * being chosen — eight to twenty-eight minutes a revolution.
   *
   * DOUBLED FROM 70-150, and the Drill did NOT have to follow. The obvious worry
   * is that a craft at speed 62 cannot catch a rock at 300, but that is
   * straight-line thinking: on a closed orbit the rock comes back round to you, so
   * a faster rock ARRIVES SOONER. Measured over 907 rocks × 40 planets, the
   * outbound leg at Drill 1 fell from a median of 17.3 to 14.6 minutes and nothing
   * became unreachable at any level. Mining throughput is therefore unchanged,
   * which is why this is a visual change and not a balance one.
   */
  asteroidSpeedMin: 350,
  asteroidSpeedMax: 750,

  /** How far out they run. The whole tilted orbit stays inside the playable sphere. */
  asteroidOrbitMin: 400,
  asteroidOrbitMax: 2000,

  /**
   * Hours a rock stays in the disc before it is gone for good. PROVISIONAL.
   *
   * This is what "the asteroid got away" means, and it is now a real deadline
   * rather than a consequence of arithmetic: three to six hours is several
   * revolutions to watch it go round, long enough that an async player who checks
   * in twice a day meets a few, and short enough that the field turns over instead
   * of accumulating.
   */
  asteroidLifeHoursMin: 2.5,
  asteroidLifeHoursMax: 5,

  /**
   * Ore carried, by level. PROVISIONAL.
   *
   * CUT BY ROUGHLY SEVEN. The first pass sized these against the field's own total
   * and never once compared them to a refinery, which is the comparison that
   * decides whether the building half of the game has a point. It did not: a
   * single Prospector at Drill 1 brought home 3,651 an hour against a planet's
   * entire 156, so the correct play was to stop upgrading anything and mine. The
   * owner spotted it from the feel of it before any of this was measured.
   *
   * Now a rock is worth three to ten Prospector loads — a prize a squadron cannot
   * empty in one trip, so two players arriving minutes apart both come home with
   * something and both know they were beaten to it. That is the race D19 is for.
   *
   * The FIELD now produces about 6,700 an hour across every player in the galaxy,
   * against a single developed planet's 674. Mining is deliberately scarce at that
   * ratio: there is not enough ore for everyone to live on it, which is what makes
   * arriving first worth anything.
   */
  asteroidOreByLevel: [0, 800, 1600, 3200, 6000, 11000] as readonly number[],

  /** How often each level turns up. Must sum to 1 across levels 1-5. */
  asteroidLevelWeights: [0, 0.4, 0.27, 0.18, 0.1, 0.05] as readonly number[],

  /**
   * Share of a rock's ore that comes back as crystal, rolled per asteroid.
   *
   * Deliberately wide. The original 25–65% band is reduced by 30% while preserving
   * its shape: rocks still differ enough to create a route choice, but contested
   * mining supplies less of the scarce resource than passive Extractors do.
   */
  asteroidCrystalShareMin: 0.175,
  asteroidCrystalShareMax: 0.455,
} as const;

/**
 * Public galaxy moments. Their exact occurrence timestamps are generated once at
 * season creation and persisted; changing this object never rewrites a live sky.
 *
 * Türkiye quiet hours are deliberately a LOW-WEIGHT band, not a blackout. Five
 * events reserve one quiet-hours start and may roll a second, but can never place
 * more than two on the same Türkiye calendar date.
 */
export const GALAXY_EVENTS = {
  version: 1,
  calendar: {
    /** Human-facing schedule zone; arithmetic uses the pinned offset below. */
    timeZone: 'Europe/Istanbul',
    /** Versioned TRT offset. A future legal clock change requires a new config version. */
    utcOffsetMinutes: 180,
    dailyCount: { min: 5, max: 5 },
    lowPriorityWindow: {
      startsAtLocalMinute: 0,
      endsAtLocalMinute: 8 * 60,
      targetShare: 0.2,
      overflowWeight: 0.25,
      maxDailyCount: 2,
    },
    candidateAttempts: 512,
  },
  definitions: {
    ASTEROID_SHOWER: {
      version: 1,
      durationMinutes: 60,
      /** Two quiet hours after the one-hour shower; starts stay at least three hours apart. */
      repeatCooldownMinutes: 120,
      effect: { asteroidSpawnMultiplier: 5 },
    },
  },
  mutuallyExclusive: [] as readonly (readonly [string, string])[],
} as const;

/**
 * WRECKAGE. D32.
 *
 * A resolved battle leaves a field of debris at the DEFENDER's coordinates, holding
 * a share of the resource value of every non-ground hull destroyed on both sides.
 * It is public, it decays, and anybody can fly out and take what is left.
 *
 * WHY THIS IMPORT IS SAFE WHEN EXPEDITIONS ARE NOT. The single mechanic most
 * blamed for emptying OGame's PvP layer is the expedition: it creates resources out
 * of nothing, so it competes with war and eventually replaces it. **Debris is made
 * of ships, and ships only die because somebody attacked.** It is strictly
 * downstream of combat — if raiding stops, the wreckage stops — and no
 * implementation decision may break that property.
 *
 * WHAT IT BUYS, and it is four things at once:
 *   · the loser is partly refunded, so a lost fleet is not a total write-off
 *   · a private fight becomes a PUBLIC, TIMED, CONTESTED second event
 *   · somebody who is not in the war gets a reason to watch other people's
 *   · a big battle becomes a landmark on the map
 *
 * GROUND UNITS CONTRIBUTE NOTHING. They already have `COMBAT.defenceSalvage` at
 * 60%, and counting them here would return about 85% of a defender's losses — a
 * fortress that profits from being attacked.
 *
 * IT IS WEALTH, NEVER DOMINION. Dominion is exactly zero-sum across the galaxy and
 * only combat generates it (D2). Wreckage was not taken FROM anybody, so crediting
 * it to the ladder would create score from nothing.
 *
 * BOTH NUMBERS ARE PROVISIONAL and neither has a simulation behind it — there is no
 * combat in the mining model and no mining in the season model. `share` is the one
 * to watch: if harvesting out-earns raiding it has become an expedition after all.
 */
export const DEBRIS = {
  /** Share of destroyed non-ground hull value that becomes wreckage. PROVISIONAL. */
  share: 0.30,
  /**
   * Minutes until a field is worthless. PROVISIONAL.
   *
   * 180 → 20 AT D63, which is the "come DOWN to make the race sharp" this comment
   * predicted, arriving for a reason it did not: at the new hull speeds a field
   * lasted thirty crossings of the whole disc, so every player in the galaxy could
   * reach it several times over and there was no race at all. Twenty minutes is
   * about five legs — near enough that being close matters, far enough that a
   * commander who sees it can still get there.
   */
  decayMinutes: 40,
  /**
   * Below this a field is not worth creating; it would be noise on the disc.
   *
   * HALVED WITH THE HULLS AT D61. This threshold is denominated in ship value, so
   * leaving it at 200 while every hull price halved would have doubled it in real
   * terms — and it did, immediately: five debris tests went from a field to no
   * field at all. A constant priced in another constant has to move with it.
   */
  minimum: 250,
} as const;

/**
 * THE GALAXY'S CONVERSATION, IN THE ONE PLACE BOTH ENDS READ. D77.
 *
 * The route and the composer have to agree about the ceiling or the composer lets a
 * player type a message the server then refuses. It lived as a literal `280` in
 * `routes/chat.ts` and a second literal in the client, and when the clan channel was
 * added the client quietly started reading `CLAN.chatMaxChars` for BOTH channels —
 * which coupled the galaxy's limit to a constant that has nothing to do with it.
 */
export const CHAT = {
  maxChars: 280,
  burst: 5,
  windowSeconds: 10,
} as const;

export const SEASON = {
  days: 14,
  /** Frozen finale before the next world opens. D88. */
  afterglowMinutes: 5,
  /** Above this, an upgrade no longer repays before the wipe — the sunset phase. */
  investmentHorizonShare: 0.7,
  /** The three public transitions after the opening act. D96. */
  actBoundaries: [
    { id: 'war', share: 4 / 14 },
    { id: 'consolidation', share: 8 / 14 },
    { id: 'sunset', share: 12 / 14 },
  ],
} as const;

/**
 * THE SHAPE OF THE WORLD ABOVE ONE GALAXY. D21, superseded in capacity by D99.
 *
 * At most two live galaxies exist; each admits three hundred commanders. A player owns one
 * seasonal identity in exactly one of them, and galaxies fill strictly in order —
 * nobody may take a slot in the second until the first has none left.
 *
 * D99 keeps the sequential frontier as the empty-shard mitigation while raising
 * the one supported active galaxy to 300. The disc radius and every travel/intel
 * constant stay fixed: capacity work may make the implementation cheaper, but it
 * may not quietly rebalance the game. The denser neighbourhood is a playtest
 * consequence recorded in the decision.
 */
export const SERVERS = {
  /** How many galaxies may be advertised and opened at once. D100. */
  count: 2,
  /** Commander seats per galaxy — also the number of reserved capital slots. */
  capacity: 300,
  /**
   * How long a player counts as "in game" after their last authenticated request.
   *
   * Only ever used for the population figure on the server list. Generous on
   * purpose: this game is played in gaps, and a commander reading a battle report
   * for four minutes has not left.
   */
  onlineWindowMinutes: 5,

  /**
   * HOW LONG A COMMANDER MAY BE AWAY BEFORE THEIR WORLD IS RECLAIMED. Owner
   * instruction: *"bir oyuncu 3 gün boyunca oyuna girmezse gezegeni silinsin ve
   * böylece serverlarda yer açılır. Pasif hesaplar birikmez."*
   *
   * THE SEAT IS THE SCARCE THING AND THIS IS WHAT KEEPS IT MOVING. A galaxy holds
   * three hundred commander seats and galaxies fill strictly in order, which is the mitigation
   * the empty-shard risk has — and it works exactly backwards once the seats are
   * held by people who signed up on day one and never returned. Three hundred commanders
   * of whom most are inert is not a populated galaxy; it is an empty one that
   * cannot be joined.
   *
   * THREE DAYS IS SHORT, AND IT IS SHORT ON PURPOSE. A season is fourteen days,
   * flights are minutes, and this game is played in gaps of a few hours — somebody
   * still playing simply cannot cross three days without opening it. The number is
   * measured from `players.lastActiveAt`, which every authenticated request
   * advances (throttled to once a minute), so it means "has not opened the game"
   * and not "has not acted".
   *
   * THE ACCOUNT SURVIVES. Only the season presence is reclaimed: the record folds
   * into `accounts.lifetime` exactly as a wipe folds it, and the commander can
   * sign in and take a seat in whatever galaxy is open. Owner decision, and it is
   * why this is called reclaiming rather than deleting.
   */
  idleDays: 3,
} as const;

/** Multi-world ruleset v4. D148 activates Fleet Catalog V2 at an offline rollover. */
const PIRATE_SPAWN_PER_SEAT_PER_HOUR = 0.02;

/**
 * KORSAN FİLOLARI — THE GALAXY'S THIRD TARGET CLASS. D150.
 *
 * Every number here is PROVISIONAL and closes by playtest, not by argument. What
 * is NOT provisional is which dials may be turned: `docs/balance.md` records the
 * VFR blocker, and a pirate is a brand-new resource tap sitting right on top of
 * it. Spawn rate, fleet size, level weights, `hoardValueMult`, the one-raid-per-
 * world rule and the flight-bay cost are all legitimate throttles. Loot grade,
 * hull HP, `defenceSalvage`, the Hangar constants and any acceptance band are NOT
 * — widening one of those to make this feature pay would be the exact move
 * CLAUDE.md forbids.
 *
 * THE REAL THROTTLE IS NOT A NUMBER AT ALL. Loot is capped by
 * `fleetCargo(survivors)`, so carrying the prize home costs combat power on the
 * way out. That is `game-design.md`'s raid decision — how much cargo you bring
 * depends on what you believe is there — moved onto a target that cannot shoot
 * first. The tap itself is a decision.
 */
export const PIRATE = {
  /**
   * WHAT A PIRATE'S GUNS ACTUALLY DO, by level, against the table's own figures.
   *
   * The ONLY combat modifier in the feature, and it lives on ATTACK alone. D11
   * locks combat simple, so this is not a fifth axis: it rides the existing
   * `CombatSide` interface, applies once inside `statsFor`, and is therefore
   * honoured identically in the damage pool and in the casualty arithmetic —
   * which is the one bug `combat.ts` would hide best.
   *
   * HP IS DELIBERATELY UNTOUCHED. A level 4 pirate flies a Cataclysm: 800 attack
   * becomes 680, and all 448 hit points remain. It has to stay genuinely
   * dangerous while you are shooting at it, or the ship it is guarding is not a
   * prize.
   */
  damageMult: { 1: 0.5, 2: 0.65, 3: 0.75, 4: 0.85 },

  /**
   * Chance one of its hulls comes home with you, on a DECISIVE win only.
   *
   * The inverse of the damage table, and that inversion IS the decision: the
   * pirate that is cheapest to beat carries the ship worth least. Anything short
   * of DECISIVE pays nothing here — survivors fly away with their own ships.
   */
  captureChance: { 1: 0.5, 2: 0.35, 3: 0.25, 4: 0.15 },

  /** Ships in one pirate. Small on purpose: this is a fight you can read. */
  sizeMin: 2,
  sizeMax: 5,

  /** How often each level turns up. Must sum to 1 across levels 1-4. */
  levelWeights: [0, 0.45, 0.3, 0.18, 0.07] as readonly number[],

  /**
   * The hoard, as a multiple of what the pirate's own hulls are worth.
   *
   * Above 1 by construction: a prize smaller than its escort makes "never launch"
   * the only rational line. It is swept so `E[net]` is positive for a correctly
   * composed fleet and negative for a wrong one — see `docs/balance.md`.
   */
  hoardValueMult: 1.4,
  /** How the hoard splits. Deuterium is the smallest share: it is also fuel. */
  hoardShare: { alloy: 0.55, crystal: 0.3, deuterium: 0.15 },

  /**
   * New pirates per SEAT per hour, and the galaxy-wide rate that follows.
   *
   * Per seat because content that does not scale with the galaxy dies when the
   * galaxy grows: a fixed rate that feels alive at 40 commanders is an empty sky
   * at 300. The absolute figure is derived here once so the lane generator stays
   * a pure function of the season key rather than of a live population count.
   */
  spawnPerSeatPerHour: PIRATE_SPAWN_PER_SEAT_PER_HOUR,
  spawnPerHour: PIRATE_SPAWN_PER_SEAT_PER_HOUR * SERVERS.capacity,

  /** Hours a pirate rides its orbit before it is gone for good. */
  lifeHoursMin: 2,
  lifeHoursMax: 4,

  /**
   * Game units per minute along the orbit. DELIBERATELY UNDER THE ROCKS.
   *
   * A pirate has to read as a ship rather than as debris, and it has to be
   * catchable often enough that a rendezvous is a plan rather than a lottery.
   * The orbital period follows from this and the radius — six minutes at the
   * inner edge, an hour at the outer — and that shortest period is what sets the
   * ceiling on `bearingMs` below.
   */
  speedMin: 200,
  speedMax: 420,

  /** How far out they run. Same band and same draw as the rocks. */
  orbitMin: 400,
  orbitMax: 2000,

  /**
   * HOW FAR AHEAD A PIRATE'S MOTION IS PUBLISHED. Derived, never typed.
   *
   * `TRAFFIC.bearingMinutes` is four minutes and it was written for a STRAIGHT
   * leg. A pirate's shortest revolution is about six minutes, so four minutes of
   * a closed orbit is most of a lap: the straight chord the client draws between
   * the two published points would visibly cut through the middle of the orbit.
   *
   * Ten seconds is under seven degrees of arc at the very worst radius, which no
   * eye separates from the curve, and the client's own coasting margin covers a
   * late read. IT MAY NEVER GO BELOW `TRAFFIC.refreshMs`: a window shorter than
   * one refetch is a window that names a destination, and CLAUDE.md records that
   * this project has already shipped that bug once. Written as a MULTIPLE of the
   * poll interval so the two cannot drift apart again.
   */
  bearingMs: TRAFFIC.refreshMs * 2,
} as const;

export const MULTI_WORLD = {
  rulesetVersion: 4,
  /** Old hull rows may exist only before this offline season boundary. D148. */
  fleetCatalogRulesetVersion: 4,
  /** Persisted galaxy-event calendars exist only on freshly created seasons at this boundary. */
  galaxyEventsRulesetVersion: 4,
  /** Neutral worlds and colonies remain the v2 boundary. */
  neutralWorldRulesetVersion: 2,
  /** D114 clan state exists only in a freshly created v3 season. */
  clanRulesetVersion: 3,
  /**
   * THE PIRATE LANE'S OWN BOUNDARY. D150.
   *
   * Pirates ship INSIDE a live season, and that is safe for one reason only:
   * the lane is entirely independent. Its own seed, its own indices, its own
   * table — it does not move a single rock, so D143's "a new deterministic
   * distribution must begin at a season boundary" is not engaged. This version
   * exists so that the NEXT change, the one that redraws a distribution players
   * are already flying at, has a boundary to bind to.
   */
  pirateRulesetVersion: 1,
  /** Coupled to admission: every seat needs one collision-free capital address. D99. */
  capitalSlots: SERVERS.capacity,
  /** Nine candidates per neutral preserves D97's placement-search density at the larger scale. */
  neutralSlotPool: SERVERS.capacity + 450,
  neutralCounts: { 1: 30, 2: 15, 3: 6 },
  /**
   * `claimMinutes` IS NOT HERE, AND MUST NEVER BE TYPED BACK IN.
   *
   * The public claim window has to contain a settlement flight, so it is a
   * duration measured against a DISTANCE and belongs with the arithmetic that
   * knows both — `SETTLEMENT_CLAIM_MINUTES` in `strategic.ts`. Written here as a
   * literal it was 30, sized when the disc had radius 1000, and D101 widened the
   * disc 2.5× without it (D111).
   */
  occupationMinutes: 6 * 60,
  /**
   * How long a struck world is dark: no production, no regeneration, no
   * collection, no purchase, no launch. TWO HOURS AT D113, from six.
   *
   * It is also the window a second impact has to arrive in to take control, and
   * that is why it was worth shortening rather than lengthening: six hours put
   * the capture leg on the far side of most people's evening, while a Death Star
   * crosses the whole disc in thirteen minutes. Two hours is still ten crossings
   * wide, so the capture route survives intact and the punishment stops being an
   * evening-long outage for the world that took the hit.
   */
  recoveryMinutes: 2 * 60,
  settlement: {
    cost: {
      alloy: scalePrice(2000, ECONOMY_TEMPO.fixedPrice),
      crystal: scalePrice(1000, ECONOMY_TEMPO.fixedPrice),
      deuterium: 0,
    },
    transportHull: 'COURIER',
    transports: 2,
  },
  neutral: {
    1: {
      buildings: { CORE: 2, REFINERY: 2, EXTRACTOR: 2, VAULT: 0, SHIPYARD: 0, HANGAR: 0, DEUTERIUM_PLANT: 0 },
      instruments: {},
      fleet: {},
      ground: {},
      reinforcementMinutes: null,
    },
    2: {
      buildings: { CORE: 5, REFINERY: 5, EXTRACTOR: 5, VAULT: 0, SHIPYARD: 2, HANGAR: 0, DEUTERIUM_PLANT: 0 },
      instruments: {},
      fleet: { DART: 8, PIKE: 2 },
      ground: {},
      reinforcementMinutes: 6 * 60,
    },
    3: {
      buildings: { CORE: 8, REFINERY: 8, EXTRACTOR: 8, VAULT: 0, SHIPYARD: 4, HANGAR: 0, DEUTERIUM_PLANT: 0 },
      instruments: { AEGIS: 3 },
      fleet: { VIPER: 16, TALON: 6, STRONGHOLD: 2 },
      ground: { THORN: 6, BASTION: 2 },
      reinforcementMinutes: 4 * 60,
    },
  },
} as const;

/**
 * THE STRATEGIC WEAPON, RE-SPECIFIED AT D113 — owner instruction.
 *
 * What an impact DOES is now four things and no more, so it can be said in one
 * sentence on the screen before anybody spends 33,000 resources on it: every
 * fleet on the ground dies, half of everything stored is gone, the Command Core
 * loses a level, and the world produces nothing for two hours.
 *
 * The old strike zeroed the stores and lowered four buildings, which was both
 * harder to describe and effectively unrecoverable. Halving is a rule a player
 * can hold in their head and reason about twice: hit again inside the window and
 * half of what is LEFT goes, so a second strike is a real decision rather than a
 * repeat of an already-total loss.
 */
export const DEATH_STAR = {
  type: 'DEATH_STAR',
  /**
   * BOTH GATES ARE CORE 12 (D113) — the research and the weapon alike.
   *
   * Measured on the five gate seeds: every simulated commander finishes at Core
   * 17-18 and 41 of 50 also hold Shipyard 5, so this is a late gate rather than
   * dead content. `RESEARCH_PROJECTS.DEATH_STAR_PROTOCOL.requiredCore` carries
   * the same figure and reads it from here.
   */
  requiredCore: 12,
  requiredShipyard: 5,
  requiredResearch: 'DEATH_STAR_PROTOCOL',
  cost: {
    alloy: scalePrice(15_000, ECONOMY_TEMPO.fixedPrice),
    crystal: scalePrice(15_000, ECONOMY_TEMPO.fixedPrice),
    deuterium: scalePrice(3000, ECONOMY_TEMPO.deuteriumPrice),
  },
  buildMinutes: 60,
  /** Owner-approved strategic travel speed after local interception playtesting. */
  speed: 1_250,
  /**
   * Share of the target's stores an impact destroys, stock and works alike.
   *
   * A SHARE AND NOT A WIPE, so the arithmetic composes: a second impact inside
   * the recovery window takes half of the remainder. Anything that reads this
   * must advance the world's lazy economy FIRST — half of a figure that is one
   * tick stale is not half of what is there.
   */
  stockShareDestroyed: 0.5,
  /**
   * Levels an impact takes off the Aegis. Owner decision at D113.
   *
   * The one instrument a strike still touches directly, because it is the thing
   * that would otherwise blunt the next one. Everything else in orbit is only
   * ever capped by the Core it hangs off — stored levels survive, exactly as D97
   * requires, and come back when the Core does.
   */
  aegisLevelsLost: 2,
  /** Recent resolved impacts remain public this long so reconnecting tabs see the event. */
  impactSeconds: 8,
  probeVisibilityAccuracy: 0.75,
} as const;
