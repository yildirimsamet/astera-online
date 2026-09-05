import type {
  BuildingId, GroundHullId, InstrumentId, MobileHullId, ResearchProjectId, SatelliteId,
} from '@astera/rules';

/**
 * COMMANDERS THE SERVER PLAYS, AND WHY THEY EXIST AT ALL. D159.
 *
 * A live galaxy holds three hundred seats and five to ten people. Every figure the
 * disc prints is honest and the impression it leaves is false: a commander opens
 * Astera, reads "6 online" over an empty sky, and concludes the game is not being
 * played. `SERVERS.dayWindowMinutes` was added for exactly this (D154) and a second
 * number was never the missing thing — MOVEMENT was. `reclaim.ts` already records
 * the owner's own words for it: worlds "that read as bots to the owner because
 * nothing has happened on them since".
 *
 * So the server seats commanders of its own. They are not a simulation layered over
 * the game: they hold a real account, a real capital, a real economy, and they act
 * by calling the very same services a phone calls. Nothing here can do anything a
 * player could not, and nothing here is exempt from a rule.
 *
 * THIS FILE IS SERVER-ONLY ON PURPOSE. It could sit in `packages/rules` — the
 * schedule is pure arithmetic and would test just as well there — and it must not,
 * because `apps/web` imports that package and a `BOTS` symbol in the client bundle
 * is the one clue the whole design is trying not to leave.
 *
 * IT ALSO DOES NOT IMPORT `@astera/sim`. That package's `ARCHETYPES` table is a
 * balance-calibration artefact tuned against async-era pacing, and CLAUDE.md's
 * standing instruction is not to tune against it. The SHAPE of a session below is
 * owed to it; not one of its numbers is.
 */

export type BotPersonaId = 'BUILDER' | 'RAIDER' | 'PROSPECTOR' | 'BALANCED';

/** One research rung this habit intends to reach, in the order it wants them. */
export interface BotResearchWant {
  readonly project: ResearchProjectId;
  readonly level: number;
}

/**
 * Relative weights for the ONE flight a turn may commit.
 *
 * Weights rather than probabilities: a bay is often busy and a lane is often
 * unavailable, so the draw is over whatever is actually possible this minute.
 * `idle` is a real option — a commander who launches something every single time
 * they open the game is the least human thing this system could do.
 */
export interface BotFlightWeights {
  readonly probe: number;
  readonly mine: number;
  readonly harvest: number;
  readonly pirate: number;
  readonly attack: number;
  readonly idle: number;
}

export interface BotPersona {
  readonly id: BotPersonaId;
  readonly buildOrder: readonly BuildingId[];
  /**
   * ONE WISHLIST SPANNING BOTH KINDS OF HARDWARE, and it is not a tidying choice.
   *
   * The Uplink GATES the Telescope and the Radar. Walked as two passes —
   * instruments, then satellites — a habit that wants a Telescope reaches for it
   * every turn, is refused for want of an Uplink it never queues, and plays the
   * whole season blind. One list makes the gate a thing the order can express.
   */
  readonly wants: readonly (InstrumentId | SatelliteId)[];
  readonly research: readonly BotResearchWant[];
  /** Shares of the military budget. Need not sum to one. */
  readonly composition: Partial<Record<MobileHullId, number>>;
  readonly groundMix: Partial<Record<GroundHullId, number>>;
  /** Ground defence value held per unit of raidable stock. Bought FIRST, not from leftovers. */
  readonly defenceRatio: number;
  /** Share of stock this habit will not spend on anything but ships. */
  readonly militaryShare: number;
  readonly prospectorTarget: 1 | 2;
  readonly flight: BotFlightWeights;
}

export const BOT_PERSONAS: Record<BotPersonaId, BotPersona> = {
  BUILDER: {
    id: 'BUILDER',
    buildOrder: ['REFINERY', 'EXTRACTOR', 'CORE', 'VAULT', 'SHIPYARD', 'DEUTERIUM_PLANT', 'HANGAR'],
    wants: ['UPLINK', 'RADAR', 'AEGIS', 'FOUNDRY', 'TELESCOPE'],
    research: [
      { project: 'DEUTERIUM_SYNTHESIS', level: 2 },
      { project: 'STARSHIP_ENGINEERING', level: 1 },
      { project: 'SHIP_ARMOR', level: 2 },
      { project: 'YARD_AUTOMATION', level: 1 },
    ],
    composition: { WARDEN: 0.6, RAMPART: 0.4 },
    groundMix: { BASTION: 0.6, THORN: 0.4 },
    defenceRatio: 1.2, militaryShare: 0.2, prospectorTarget: 1,
    flight: { probe: 2, mine: 3, harvest: 2, pirate: 1, attack: 1, idle: 5 },
  },
  RAIDER: {
    id: 'RAIDER',
    buildOrder: ['SHIPYARD', 'REFINERY', 'CORE', 'EXTRACTOR', 'DEUTERIUM_PLANT', 'HANGAR', 'VAULT'],
    wants: ['UPLINK', 'RADAR', 'TELESCOPE', 'VEIL', 'BEACON'],
    research: [
      { project: 'DEUTERIUM_SYNTHESIS', level: 2 },
      { project: 'STARSHIP_ENGINEERING', level: 1 },
      { project: 'SHIP_POWER', level: 2 },
      { project: 'DENSE_FUEL_CELLS', level: 1 },
      { project: 'SHIP_PROPULSION', level: 2 },
    ],
    composition: { DART: 0.55, PIKE: 0.25, WARDEN: 0.2 },
    groundMix: { THORN: 0.7, BASTION: 0.3 },
    defenceRatio: 0.45, militaryShare: 0.6, prospectorTarget: 1,
    flight: { probe: 4, mine: 1, harvest: 2, pirate: 3, attack: 6, idle: 3 },
  },
  PROSPECTOR: {
    id: 'PROSPECTOR',
    buildOrder: ['REFINERY', 'EXTRACTOR', 'CORE', 'SHIPYARD', 'VAULT', 'DEUTERIUM_PLANT', 'HANGAR'],
    wants: ['UPLINK', 'RADAR', 'DERRICK', 'AEGIS', 'TELESCOPE'],
    research: [
      { project: 'ISOTOPE_SPECTROMETRY', level: 1 },
      { project: 'DEUTERIUM_SYNTHESIS', level: 2 },
      { project: 'PROSPECTOR_HOLDS', level: 1 },
      { project: 'STARSHIP_ENGINEERING', level: 1 },
    ],
    composition: { WARDEN: 0.5, DART: 0.5 },
    groundMix: { BASTION: 0.5, THORN: 0.5 },
    defenceRatio: 0.9, militaryShare: 0.3, prospectorTarget: 2,
    flight: { probe: 2, mine: 8, harvest: 5, pirate: 1, attack: 2, idle: 4 },
  },
  BALANCED: {
    id: 'BALANCED',
    buildOrder: ['REFINERY', 'CORE', 'EXTRACTOR', 'SHIPYARD', 'DEUTERIUM_PLANT', 'VAULT', 'HANGAR'],
    wants: ['UPLINK', 'RADAR', 'TELESCOPE', 'AEGIS', 'FOUNDRY'],
    research: [
      { project: 'DEUTERIUM_SYNTHESIS', level: 2 },
      { project: 'STARSHIP_ENGINEERING', level: 1 },
      { project: 'SHIP_POWER', level: 2 },
      { project: 'SHIP_ARMOR', level: 2 },
    ],
    composition: { DART: 0.4, WARDEN: 0.35, PIKE: 0.25 },
    groundMix: { BASTION: 0.5, THORN: 0.5 },
    defenceRatio: 0.8, militaryShare: 0.4, prospectorTarget: 1,
    flight: { probe: 3, mine: 4, harvest: 3, pirate: 2, attack: 4, idle: 4 },
  },
};

/**
 * Dealt round-robin by `ordinal`, so a roster of any size is a spread of habits.
 *
 * READ ONCE, AT CREATION. The chosen habit is then STORED on `bot_profiles.persona`
 * and that row is the authority from then on — a turn reads the row rather than
 * re-deriving from the ordinal, so the two can never disagree and a habit can be
 * changed by hand without the brain quietly overruling it.
 */
export const BOT_PERSONA_ORDER: readonly BotPersonaId[] = [
  'BALANCED', 'RAIDER', 'PROSPECTOR', 'BUILDER',
];

export const personaFor = (ordinal: number): BotPersona => {
  const id = BOT_PERSONA_ORDER[
    ((ordinal % BOT_PERSONA_ORDER.length) + BOT_PERSONA_ORDER.length) % BOT_PERSONA_ORDER.length
  ] ?? 'BALANCED';
  return BOT_PERSONAS[id];
};

/**
 * What a stored `bot_profiles.persona` means.
 *
 * `persona` is plain text in the database, so an unrecognised value is a real
 * possibility — a hand-edited row, or a habit removed from this file while a
 * profile still names it. It falls back rather than throwing: a commander with an
 * odd habit is a commander that still plays, and one that throws is a turn the
 * sweep logs as a bug for the rest of the season.
 */
export const personaNamed = (id: string): BotPersona =>
  isPersonaId(id) ? BOT_PERSONAS[id] : BOT_PERSONAS.BALANCED;

const isPersonaId = (id: string): id is BotPersonaId =>
  Object.hasOwn(BOT_PERSONAS, id);

export const BOTS = {
  /**
   * HOW MANY COMMANDERS THE SERVER SEATS IN EACH LIVE GALAXY. Owner instruction.
   *
   * Per galaxy, not in total: galaxies fill in order and a second one opening
   * empty is the same problem this exists to solve, one shard along.
   */
  perGalaxy: 12,

  /**
   * THE SHIFT ROSTER, AS A TARGET FOR EACH TÜRKIYE HOUR. Owner instruction:
   * nobody between 01:00 and 08:00, and between four and twelve of them awake at
   * every other hour.
   *
   * A FLAT NUMBER WOULD BE THE TELL. Twelve commanders who are all present at
   * 09:00 and all present at 22:00 describe a cron job, not a population; the
   * curve is what makes the evening feel like the evening. The floor of four is
   * the owner's, and it is the number that has to hold at the quietest waking
   * minute of the day — which is why the schedule proves it rather than aims at it.
   *
   * The zeros are a BLACKOUT, not a low-weight band. `GALAXY_EVENTS.calendar`
   * models Türkiye quiet hours as a weight because a shower nobody sees is merely
   * wasted; a commander seen raiding at 04:00 every night is a commander somebody
   * eventually asks about.
   */
  awakeByLocalHour: [
    6, 0, 0, 0, 0, 0, 0, 0, 4, 4, 5, 5,
    6, 6, 5, 6, 7, 8, 9, 10, 11, 12, 11, 9,
  ] as readonly number[],
  /** The roster is re-cut this often. Half an hour is below a session and above a blink. */
  slotMinutes: 30,
  /**
   * How long one commander is PREFERRED to stay in a single sitting.
   *
   * A preference and not a guarantee, and the exception is the honest one: at the
   * evening peak the target IS the whole roster, so everybody is on and nobody can
   * be rested. Four hours is a long evening rather than an impossible one, and the
   * alternative — refusing to ever field the full roster — would spend the owner's
   * stated ceiling to protect a detail nobody can observe.
   */
  maxSessionSlots: 8,
  /** How long a commander sits between two things they do. */
  turnGapMinutes: { min: 7, max: 23 },
  /**
   * HOW MANY SESSIONS ONE SWEEP WILL PLAY, AND IT IS A LATENCY BUDGET.
   *
   * At rest this ceiling is never reached: twelve commanders on a seven-to-twenty-
   * three-minute cadence produce under one due turn a minute. It exists for the
   * COLD START — every commander is seated with the same `nextActionAt`, so the
   * first sweep after a deploy has the whole roster due at once, and a turn is half
   * a dozen locking transactions.
   *
   * `WORKER_POLL_MS` is one second because visible timing matters (D52): a tick
   * that stops to play twelve sessions is a tick during which nobody's raid lands.
   * Three a sweep spreads that cold start over four minutes and costs nothing
   * afterwards; the commanders passed over keep their due time and are simply first
   * in the queue next minute.
   */
  turnsPerSweep: 3,

  /**
   * WHERE THEY STOP. Owner decision: a middle ceiling, and no season rewards.
   *
   * Rewards need no code — every reward in this game is CLAIMED and none of these
   * commanders ever opens the screen that claims one. The ceiling is what keeps
   * them off the podium, and it is the whole of "exempt": twelve tireless
   * commanders with no ceiling would own the top of a ladder that exists for the
   * people playing.
   */
  coreCeiling: 9,
  /** Alloy-equivalent value of ships one of them will hold. `fleetValue` units. */
  fleetValueCeiling: 260_000,

  /**
   * A RAID NEEDS A RECORD, AND THAT IS FOG APPLYING TO THE SERVER'S OWN PLAYERS.
   *
   * These commanders read the database, so nothing stops them picking the richest
   * undefended world in the galaxy every time. Nothing except this: they may only
   * raid a world they have actually had eyes on (D151), no older than this. With
   * no record the turn spends itself on a PROBE instead — which is both the honest
   * rule and, not coincidentally, the traffic the disc was missing.
   */
  recordFreshMinutes: 720,
  /** How much more a bot-held world is worth as a target than a player-held one. */
  botTargetBias: 4,

  /**
   * RESTRAINT TOWARDS PEOPLE, HELD HERE RATHER THAN IN THE RULES.
   *
   * D127 removed the invisible development band and left `bashLimit` alone, so the
   * rules would happily let a Core-9 commander farm somebody who joined an hour
   * ago. That is the correct rule for players, who can be argued with, blocked and
   * out-thought. It is the wrong behaviour for a commander nobody can talk to, so
   * the band comes back HERE — as a bot's manners, changing no rule and applying
   * to nobody else.
   */
  playerCoreFloorGap: 2,
  newPlayerGraceHours: 48,
  playerRaidsPerDay: 2,

  /** How often the worker looks at the roster at all. */
  sweepEveryMs: 60_000,
} as const;
