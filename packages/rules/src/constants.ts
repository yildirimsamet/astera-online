import type { InstrumentId, SatelliteId } from './types.js';

/**
 * Every number the design can be wrong about, in one place.
 *
 * Values marked PROVISIONAL are settled by the Phase 8 playtest, not by argument.
 * Values marked INVARIANT have a stated relationship that must never be broken;
 * `test/invariants.test.ts` enforces each one.
 */

export const ECON = {
  /**
   * D17. Doubled from 40/14 on the owner's instruction — the opening was too slow
   * to hold anyone.
   *
   * INCOME was doubled rather than costs being cut, and that choice is the whole
   * safety of the change: every relationship the balance work rests on is a RATIO.
   * `vaultMult < alloyMult` (D13), the crystal cost share against the crystal
   * income share, `paybackHours = cost / gain` — scaling both income bases by the
   * same factor leaves all three exactly where they were and simply runs the clock
   * twice as fast. Cutting costs would have moved the crystal share and forced
   * D5's season length to be re-derived from scratch.
   *
   * Storage is 12 hours of production, so the caps double with it: there is twice
   * as much on the table to steal, which is the point.
   */
  alloyBase: 80,
  alloyMult: 1.45,
  crystalBase: 28,
  crystalMult: 1.42,

  costBase: 200,
  costMult: 1.70,
  /**
   * PROVISIONAL. INVARIANT: the crystal share of an upgrade must track the
   * crystal share of INCOME, or the scarce resource is not scarce.
   *
   * The first draft charged crystal only from L4 upward and at 22% of the alloy
   * price, against a crystal income that is 33% of alloy income. Crystal
   * therefore arrived half again as fast as it could be spent: it filled its
   * twelve-hour store during the first night of every account and wasted from
   * then on, and for the whole opening — no crystal in the Wasp, none in a
   * probe, none in the first three upgrades — it bought literally nothing.
   * A resource the player watches accumulate and never spends is not scarcity,
   * it is decoration.
   *
   * The multiplier is DERIVED, not chosen: `costMult * (crystalMult / alloyMult)`.
   * Two independently hand-picked multipliers drift — the old 1.58 against a
   * 1.55 alloy curve pushed the crystal share from 0.21 to 0.37 across ten
   * levels while the income share fell, so the late game slowly inverted which
   * resource was scarce. Tying it to the income curve holds the ratio flat at
   * every level, and the base is then the only number a playtest has to move.
   *
   * The base is set at about four fifths of income parity, not at parity: the
   * simulator showed that charging crystal as fast as it arrives empties the
   * stores, and an empty store is nothing to raid. Raid returns fell through
   * their floor and the informed archetype lost the ladder. Crystal must be
   * spent AND worth stealing.
   *
   * `test/invariants.test.ts` holds the cost ratio to the income ratio.
   */
  crystalCostBase: 55,
  crystalCostMult: 1.6648,
  crystalCostFromLevel: 1,

  /** Storage ceiling, expressed as hours of production at the current level. */
  capHours: 12,

  /**
   * PROVISIONAL. Hours of production the works hold before they STOP. D16.
   *
   * Production no longer flows into storage on its own: it fills a buffer inside
   * the Refinery and the Extractor, and when that buffer is full the works stand
   * idle until the player empties them. One tap, and they start again.
   *
   * Eight hours is not an arbitrary round number — it is the length of a night. A
   * player who sleeps a normal night wakes to a buffer that filled and stopped at
   * the exact moment it was full, having wasted nothing. Four hours would punish
   * the async mobile player this game is aimed at; twelve would match the storage
   * cap and remove the reason the buffer exists.
   *
   * Note this makes a long absence MORE forgiving, not less: total accumulation is
   * now `collectorHours` of buffer plus `capHours` of storage — twenty hours
   * against the old twelve.
   */
  collectorHours: 10,

  /**
   * PROVISIONAL. INVARIANT: vaultMult MUST stay below alloyMult.
   *
   * If protection compounds faster than the stock it protects, the vault
   * eventually covers 100% of storage and nothing in the galaxy is raidable —
   * silently, with no other symptom. The first draft shipped 1.50 against an
   * alloyMult of 1.45 and killed the entire PvP economy for a whole season
   * before the simulator caught it.
   */
  vaultBase: 600,
  vaultMult: 1.3,
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
 * way, and the tier band (`ABUSE.tierBand`) already stops a developed player
 * farming a fresh one.
 *
 * THE FIGURE IS DERIVED, NOT PICKED. It is exactly the cost of the opening the
 * design wants a new commander to be able to complete in their first sitting:
 *
 *   Command Core 1 → 2      340 alloy ·  92 crystal
 *   Alloy Refinery 1 → 2    340 alloy ·  92 crystal
 *   Crystal Extractor 1 → 2 340 alloy ·  92 crystal
 *   two Wasps             1,040 alloy ·   0 crystal
 *   ────────────────────────────────────────────────
 *                         2,060 alloy · 276 crystal
 *
 * THE CORE IS FIRST BECAUSE NOTHING ELSE CAN BE. No building may exceed it, and a
 * new planet holds the Core and the Refinery both at L1 — so `1 >= 1` refuses the
 * very first upgrade a commander reaches for. All three upgrades are therefore
 * mandatory in that order, and together they consume **all 276 crystal exactly**.
 *
 * SO CRYSTAL IS WHAT BINDS THE OPENING, NOT ALLOY, and that is the whole reason
 * the first session used to close with nothing in the air: the cheapest flight in
 * the game is a probe at 50 alloy and 50 crystal, and after three mandatory
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
  alloy: 2060,
  crystal: 276,
} as const;

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
export const INSTRUMENT_LEVEL_WORTH = 1;

export const INSTRUMENT_COST_MULT = {
  TELESCOPE: 3,
  RADAR: 2,
  AEGIS: 2,
  VEIL: 2,
} as const satisfies Record<InstrumentId, number>;

/**
 * WHAT EACH SATELLITE COSTS, AND WHAT IT DOES. D25.
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
  FOUNDRY: { alloy: 9000, crystal: 3000, production: 1.06 },
  /**
   * The comms relay the two seeing instruments hang off.
   *
   * It gates the Telescope and the Radar, which is the one place a satellite is
   * allowed to gate anything: it is what makes the FIRST slot a real decision — do
   * you open your eyes, or do you take production, or speed for your drills.
   */
  UPLINK: { alloy: 1500, crystal: 500 },
  /** Services every mining craft the planet owns: bigger hold, faster crossing. */
  DERRICK: { alloy: 9000, crystal: 3000, hold: 2.6, speed: 1.5 },
  /** A navigation beacon. Every fleet that leaves here flies faster. */
  BEACON: { alloy: 11000, crystal: 3500, speed: 1.3 },
} as const;

/** Every satellite has a price, and the map is total. Checked, not assumed. */
const _priced: Record<SatelliteId, { readonly alloy: number; readonly crystal: number }> = SATELLITES;
void _priced;

export const COMBAT = {
  rounds: 3,
  varianceMin: 0.92,
  varianceMax: 1.08,

  /** Counter cycle: WASP ▸ BULWARK ▸ LANCE ▸ WASP. */
  strongMult: 1.6,
  weakMult: 0.625,

  /** Value-loss share below DECISIVE that still earns a partial haul. */
  partialThreshold: 0.45,
  lootDecisive: 0.5,
  lootPartial: 0.25,

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

export const TRAVEL = {
  /** Launch and landing overhead, in minutes. */
  baseMinutes: 3,
  distanceFactor: 1.2,
} as const;

export const INTEL = {
  detectBase: 0.25,
  detectSlope: 0.18,
  detectMin: 0.05,
  detectMax: 0.95,

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
   * HOW FAR A RADAR REACHES, in game units, by level. D49.
   *
   * THIS REPLACES A COUNTDOWN, and the replacement is the whole point. The radar
   * used to fire at `arriveAt − lead` off a table of minutes, which made its
   * effective REACH depend on the attacker's hull rather than on the defender's
   * instrument: at the old top rung of twelve minutes it caught a Wasp fleet 460
   * units out and a Bulwark fleet 210, so the heaviest, most dangerous thing in
   * the game was also the thing a radar saw latest. That is backwards, and it is
   * why a maxed Radar read as worthless — twelve minutes is twelve minutes
   * whatever is flying at you.
   *
   * A RADIUS FIXES BOTH HALVES AT ONCE. The warning fires when the fleet crosses
   * inside the circle, so how much NOTICE it buys falls out of how fast the fleet
   * is moving. Measured against a typical 800-unit leg at L5:
   *
   *     Wasp fleet     (46)  ->  15 min
   *     Lance fleet    (34)  ->  20 min
   *     Hauler in tow  (30)  ->  22 min
   *     Bulwark siege  (21)  ->  30 min
   *
   * So surprise is something an attacker BUYS WITH SPEED, and a slow fleet is
   * telegraphed. Two systems that already existed now interact, which is the
   * design north star's own test for whether depth was added or complexity was.
   *
   * D9 SURVIVES INTACT, and by arithmetic rather than by a clamp: notice is
   * `oneWay × range / distance`, so a long flight can never hand over its whole
   * duration — only a raid launched from INSIDE the circle does that, and such a
   * raid is short anyway. The ceiling is a Bulwark fleet from exactly `range`
   * away, which is half an hour.
   *
   * Index 0-2 reach nothing: L1 still catches probes and L2 still adds the
   * bearing. Fleet detection starts at L3, exactly as it always did.
   */
  radarRange: [0, 0, 0, 200, 340, 500] as readonly number[],

  /**
   * PROVISIONAL. How far a telescope can see, in game units, by level. D18.
   *
   * The disc has radius 1000, so the furthest two planets can be is a little over
   * 2000 apart. L1 reaches about a fifth of that — your own neighbourhood and
   * nothing else — and L5 reaches everywhere.
   *
   * This is the constraint the shipped version was missing entirely. Distance
   * decided how long a fleet took to arrive but never decided what you were
   * allowed to KNOW, so a brand-new commander could read the far rim of the galaxy
   * as easily as the planet next door. Range is what makes "who are my neighbours"
   * a real question, and what makes the far half of the disc something you have to
   * earn your way into rather than something you already have.
   */
  telescopeRange: [0, 420, 640, 950, 1400, Infinity] as readonly number[],

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
  telescopeCooldownHours: [0, 24, 20, 15, 10, 6] as readonly number[],
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
   */
  alloy: 50,
  crystal: 50,
  /** Faster than any hull — a probe is a sensor package, not a ship. */
  speed: 90,
} as const;

/**
 * The Prospector — the drill craft. D19, rebuilt by D25.
 *
 * ONE CRAFT, AND NO LADDER. Its speed and hold used to come from a DRILL satellite's
 * LEVEL, which is a structure D25 removed: a drill is a craft you build at the
 * Shipyard, and the thing that improves it is the DERRICK in orbit — one satellite,
 * owned or not, lifting every craft the planet has at once.
 *
 * SPEED IS THE LOAD-BEARING NUMBER, AND IT IS NOW A MULTIPLE OF THE ROCKS. D43,
 * owner's figure: a Prospector flies at THREE TIMES the mean asteroid speed, and a
 * Derrick lifts it to four and a half.
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
 * At 3x the same sweep reads 0.34 revolutions and a median 784 units — a third of
 * a lap, which is a lead shot the eye can follow rather than a lap and a bit,
 * which is not. It also makes the solve UNCONDITIONALLY WELL-POSED: see
 * `interceptAsteroid`, where a hull speed above `distanceFactor x asteroidSpeedMax`
 * (= 360) makes the intercept function strictly decreasing, so there is exactly one
 * meeting and no scan can step over it.
 *
 * THE ARITHMETIC, and it is arithmetic rather than a round number — `invariants`
 * asserts it: 3 x (asteroidSpeedMin + asteroidSpeedMax) / 2 = 3 x 220 = 660.
 *
 * WHY THIS IS NOT A MINING BUFF. Income is `hold ÷ round trip` per craft, but the
 * GALAXY's mining income is bounded by the ore that exists — about 6,700 an hour
 * across every player, against a demand of three craft x 300 hold per planet per
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
export const PROSPECTOR = {
  /** Game units per minute, before a Derrick. Three times the mean rock. */
  speed: 660,
  /**
   * LAUNCH AND LANDING OVERHEAD FOR A MINING CRAFT. D48.
   *
   * `TRAVEL.baseMinutes` is 3, and for a raid that is 7% of a forty-minute flight
   * and invisible. For an interception it is the whole problem. Measured over
   * 3,744 launches on the live seed: the median mining flight is 4.44 minutes, of
   * which **3.00 is this overhead and 1.44 is actual travel** — 68% of the trip is
   * a craft not going anywhere.
   *
   * That is what made the aim point unreadable, and it is why raising the drill's
   * SPEED (D43) could only ever half-fix it. A rock covers **660 game units during
   * the launch overhead alone**, against a median total lead of 778: the overhead
   * is 85% of the distance between the rock a player taps and the point their
   * craft sets off for. No speed makes a fixed delay smaller.
   *
   * At 0.4 the median flight is 1.84 minutes, the lead falls from 0.29 revolutions
   * to 0.12 — about forty degrees, which reads as aiming ahead of a moving target
   * rather than as flying somewhere unrelated.
   *
   * NOT A MINING BUFF, by exactly the argument D43 already made and measured: the
   * galaxy's mining income is bounded by the ore that EXISTS (about 6,700 an hour)
   * against a demand two orders of magnitude larger. A shorter round trip changes
   * who reaches a rock first, not what the field yields — and `PROSPECTOR.max`
   * still caps a planet at three craft.
   *
   * IT DOES NOT TOUCH `TRAVEL.baseMinutes`, and must not. That figure is priced
   * into every raid, every probe and the whole season simulator; this is a
   * property of one unarmed craft on a short errand.
   */
  launchMinutes: 0.4,
  /** Resource units one craft carries home, before a Derrick. */
  hold: 300,
  /**
   * HOW MANY A PLANET MAY EVER OWN. Owner's figure.
   *
   * Mining is a side errand, not a career. Uncapped, the only question a miner ever
   * faces is "how many more can I afford" — the answer is always "more", the fleet
   * scales linearly with wealth, and mining income decouples from every decision
   * the game is actually about. Three makes the interesting question the one D19
   * wanted: WHICH rock, and WHEN, given that a squadron is away for a round trip
   * and holds one of a handful of flight bays while it is.
   *
   * It also bounds the throughput D31 deliberately capped by planet size: three
   * craft is `3 x hold` per round trip and no more, whatever a season's wealth
   * curve does.
   *
   * Counted across EVERY location, not just the ones sitting at home — craft in
   * flight are still owned, and a cap that a launch could dodge is not a cap.
   */
  max: 3,
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
  base: 40,
  mult: 1.42,
  regenPerHour: 0.05,
} as const;

/**
 * PROVISIONAL. A successful raid also knocks the target's surface works offline.
 * Buildings are never damaged — the ownership pillar holds — but the victim now
 * loses COMPOUNDING rather than merely stock, which is the only thing that makes
 * raiding competitive with building over a season.
 */
export const DISRUPTION = {
  decisiveMinutes: 180,
  partialMinutes: 60,
  /** You can never be disrupted more than this far into the future. */
  maxPendingMinutes: 240,
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
  /**
   * HOW MANY DEVELOPMENT TIERS APART TWO WORLDS MAY FIGHT. D49, owner's figure.
   *
   * Tier 5 may hit anything from Tier 3 to Tier 7; Tier 1 may hit Tier 1 to 3.
   *
   * THIS REPLACED A WEALTH RATIO (`rankFloor`, 0.4), and the reason is that the
   * ratio was invisible. Development tier is already public on every planet in
   * the galaxy — it is what decides the silhouette the disc draws (D34) and the
   * one free line on every dossier — so a band measured in tiers is a rule the
   * player can READ OFF THE MAP before committing a fleet, rather than one they
   * discover when a launch is refused.
   *
   * It is also a wider band than the ratio was. A building step costs 1.70× the
   * one below it, so 40% of a player's Wealth is roughly a tier and a half: the
   * old floor closed the door on neighbours who were visibly the same size. Two
   * tiers is six Core levels, which is most of a season's development gap.
   *
   * WHAT IT GIVES UP is protection against a hoarder — somebody who banks
   * everything and builds nothing is now in band with the players they out-hold.
   * That is the trade, and the bash limit is what keeps it from being a farm.
   */
  tierBand: 2,
} as const;

export const GALAXY = {
  radius: 1000,
  /** Vertical half-thickness of the disc. */
  thickness: 120,
  minSeparation: 90,
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

  /** New rocks entering the disc per hour. PROVISIONAL. */
  asteroidSpawnPerHour: 2.7,

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
  asteroidSpeedMin: 140,
  asteroidSpeedMax: 300,

  /** How far out they run. Inside the disc, clear of the crowded centre. */
  asteroidOrbitMin: 200,
  asteroidOrbitMax: 950,

  /**
   * Hours a rock stays in the disc before it is gone for good. PROVISIONAL.
   *
   * This is what "the asteroid got away" means, and it is now a real deadline
   * rather than a consequence of arithmetic: three to six hours is several
   * revolutions to watch it go round, long enough that an async player who checks
   * in twice a day meets a few, and short enough that the field turns over instead
   * of accumulating.
   */
  asteroidLifeHoursMin: 3,
  asteroidLifeHoursMax: 6,

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
   * Deliberately wide. Crystal is the scarce resource that gates every heavy hull
   * and every high building level, so a crystal-rich rock is worth flying past two
   * closer ones for — and that is a decision the player can only make if the rocks
   * differ from each other.
   */
  asteroidCrystalShareMin: 0.25,
  asteroidCrystalShareMax: 0.65,
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
  share: 0.1,
  /**
   * Minutes until a field is worthless. PROVISIONAL.
   *
   * The nearest neighbour on a 50-world disc is an 8-minute flight and the tenth is
   * 18, so three hours is generous — it may need to come DOWN to make the race
   * sharp rather than up.
   */
  decayMinutes: 180,
  /** Below this a field is not worth creating; it would be noise on the disc. */
  minimum: 200,
} as const;

export const SEASON = {
  days: 14,
  /** Above this, an upgrade no longer repays before the wipe — the sunset phase. */
  investmentHorizonShare: 0.4,
} as const;

/**
 * THE SHAPE OF THE WORLD ABOVE ONE GALAXY. D21.
 *
 * Ten galaxies exist; each holds fifty worlds and nothing more. A player owns one
 * planet in exactly one of them, and galaxies fill strictly in order — nobody may
 * take a slot in the second until the first has none left.
 *
 * WHY FIFTY AND NOT TWO HUNDRED. `KNOWN RISKS` in CLAUDE.md names the empty shard
 * as the second-highest risk in the project: "async PvP with 12 players is
 * nothing", and its stated mitigation is to fill one galaxy before opening the
 * next. A cap of 200 made that mitigation a promise; a cap of 50 with sequential
 * fill makes it a rule the code enforces. Fifty real people is also the smallest
 * number at which the information layer has anything to be uncertain about.
 *
 * WHAT IT COSTS. The disc keeps `GALAXY.radius`, so fifty worlds sit about twice
 * as far apart as two hundred did: flights are longer and a Telescope L1 reaches
 * roughly nine neighbours rather than thirty-five. Both readings are inside what
 * `game-design.md` asks for ("8-15 planets" is a player's world for the season),
 * and longer flights serve Design Law #1 rather than fighting it — so no balance
 * constant moves for this. It is a playtest question, not an argument.
 */
export const SERVERS = {
  /** How many galaxies exist at once. */
  count: 10,
  /** Planets per galaxy — also the number of slots generated for it. */
  capacity: 50,
  /**
   * How long a player counts as "in game" after their last authenticated request.
   *
   * Only ever used for the population figure on the server list. Generous on
   * purpose: this game is played in gaps, and a commander reading a battle report
   * for four minutes has not left.
   */
  onlineWindowMinutes: 5,
} as const;
