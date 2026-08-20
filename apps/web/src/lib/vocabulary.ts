import type { BuildingId, HullId, InstrumentId, SatelliteId } from '@astera/rules';

/**
 * Every name and one-line role the player reads, in one place.
 *
 * The rule for these lines: say what the thing *decides*, not what it is. "Level
 * ceiling for everything else" tells a player why they are about to spend; "the
 * main building" tells them nothing.
 */

export const BUILDING_ORDER: readonly BuildingId[] = [
  'CORE',
  'REFINERY',
  'EXTRACTOR',
  'VAULT',
  'SHIPYARD',
];

export const BUILDING_NAME: Record<BuildingId, string> = {
  CORE: 'Command Core',
  REFINERY: 'Alloy Refinery',
  EXTRACTOR: 'Crystal Extractor',
  VAULT: 'Vault',
  SHIPYARD: 'Shipyard',
};

/**
 * THE TAG — two or three words, on every card in the game. Owner request.
 *
 * A different job from `_ROLE`. The role is a sentence that argues: what this buys
 * and what it leaves you without, read by someone deciding. The tag is what the
 * thing IS, read by someone who has never seen it before and is scanning a list of
 * fourteen cards trying to work out which one is which.
 *
 * THE TEST IS A TWELVE-YEAR-OLD, and it is a real constraint rather than a figure
 * of speech. No jargon, no game-specific nouns unless the card is that noun, and no
 * mechanism — "Watch other planets", not "Assigns telescope slots by clarity band".
 * If a tag needs a comma it is probably a role in disguise.
 */
export const BUILDING_TAG: Record<BuildingId, string> = {
  CORE: 'Unlocks higher levels',
  REFINERY: 'Makes alloy',
  EXTRACTOR: 'Makes crystal',
  VAULT: 'Keeps ore safe from raids',
  SHIPYARD: 'Unlocks better ships',
};

export const BUILDING_ROLE: Record<BuildingId, string> = {
  CORE: 'Level ceiling for everything else',
  REFINERY: 'Alloy per hour, and alloy storage',
  EXTRACTOR: 'Crystal per hour, and crystal storage',
  VAULT: 'Stock a raid can never reach',
  SHIPYARD: 'Unlocks hulls · sets probe accuracy and stealth',
};

/* ── the four on the ground ─────────────────────────────────── */

/**
 * INSTRUMENTS. Levelled, no slot, and there is no order between them.
 *
 * The list below is a reading order for one panel, not a tech tree. Any of them,
 * at any time, for the price on the card — except that the two that SEE need an
 * Uplink overhead first, which is the one gate in the whole system and the reason
 * the first orbit slot is a real decision.
 */
export const INSTRUMENT_ORDER: readonly InstrumentId[] = [
  'TELESCOPE',
  'RADAR',
  'AEGIS',
  'VEIL',
];

export const INSTRUMENT_NAME: Record<InstrumentId, string> = {
  TELESCOPE: 'Telescope',
  RADAR: 'Radar',
  AEGIS: 'Aegis',
  VEIL: 'Veil',
};

export const INSTRUMENT_TAG: Record<InstrumentId, string> = {
  TELESCOPE: 'Watch other planets',
  RADAR: 'See who is coming',
  AEGIS: 'Shield for your planet',
  VEIL: 'Hide from telescopes',
};

export const INSTRUMENT_ROLE: Record<InstrumentId, string> = {
  TELESCOPE: 'Watch one more planet per level. Silent — nobody is told.',
  RADAR: 'Catches probes. From L3, warns of an inbound fleet.',
  AEGIS: 'Shield HP, regenerating 5% an hour. Sits at the planet, not in orbit.',
  VEIL: "Degrades what anyone's telescope can read about you.",
};

/** The two that hang off an Uplink. Everything else stands on its own. */
export const INSTRUMENT_NEEDS_UPLINK: readonly InstrumentId[] = ['TELESCOPE', 'RADAR'];

/* ── the four in orbit ──────────────────────────────────────── */

/**
 * SATELLITES. One slot each, bought once, no levels, no order. D25.
 *
 * Each changes a different number across the whole planet, so the interesting
 * question is never "which is best" — it is which two or three you can run at
 * once. The Command Core opens slots at 1, 3, 5 and 9, and four satellites against
 * four slots is not a checklist, because the fourth slot is a Core 9 planet.
 */
export const SATELLITE_ORDER: readonly SatelliteId[] = [
  'UPLINK',
  'FOUNDRY',
  'DERRICK',
  'BEACON',
];

export const SATELLITE_NAME: Record<SatelliteId, string> = {
  UPLINK: 'Uplink',
  FOUNDRY: 'Foundry',
  DERRICK: 'Derrick',
  BEACON: 'Beacon',
};

/**
 * WHAT EACH SATELLITE IS FOR — and what it does not do.
 *
 * Deliberately NOT a restatement of the number. The row above this one already
 * prints the multiplier, and a role line that repeats it turns two lines into one
 * line said twice — which is what the first version did, and it read as a bug.
 *
 * Same pairing the instruments use: what it buys, then what it leaves you without.
 * The second half is the part that makes the choice a choice, because four
 * sentences that all mean "helps you" are one option wearing four hats.
 */
export const SATELLITE_TAG: Record<SatelliteId, string> = {
  UPLINK: 'Unlocks Telescope and Radar',
  FOUNDRY: 'More ore every hour',
  DERRICK: 'Better mining craft',
  BEACON: 'Faster fleets',
};

export const SATELLITE_ROLE: Record<SatelliteId, string> = {
  UPLINK:
    'SEE AT ALL. The only way to reach the Telescope and the Radar. It produces nothing, defends nothing, and without it you are guessing about everyone around you.',
  FOUNDRY:
    'EARN. Both metals, faster, for the rest of the season. The slowest reward here and the only one still paying on the last day.',
  DERRICK:
    'MINE. Your Prospectors carry far more and get there much sooner — which on a contested rock is the whole difference between first and second. Worth nothing if you never send one.',
  BEACON:
    'STRIKE. Every fleet you send is away for less time, out and back. It wins no fight; it shortens the window where your planet is the undefended one.',
};

/**
 * The longer line on the detail sheet — what OWNING it changes about your season.
 *
 * A role fits on a row; this is what a player reads before spending a slot they
 * cannot get back without raising a Command Core.
 */
export const SATELLITE_BLURB: Record<SatelliteId, string> = {
  UPLINK:
    'A comms relay. It produces nothing and defends nothing — it is the only way ' +
    'to reach the Telescope and the Radar, and so the only way to stop guessing ' +
    'about the people around you.',
  FOUNDRY:
    'Refits the works. Alloy and crystal both come out faster, for as long as it ' +
    'is up there. The slowest reward on this list and the one that is still ' +
    'paying on the last day of the season.',
  DERRICK:
    'A tender for mining craft. Every Prospector you own carries far more ore and ' +
    'reaches its rock much sooner — which on a contested asteroid is the whole ' +
    'difference between arriving first and arriving second.',
  BEACON:
    'A navigation mark. Every fleet that leaves this planet flies faster, out and ' +
    'back. Shorter flights mean a shorter window with your defence away from home.',
};

export const HULL_ORDER: readonly HullId[] = [
  'WASP', 'LANCE', 'BULWARK', 'HAULER', 'BASTION', 'THORN', 'PROSPECTOR',
];

export const HULL_TAG: Record<HullId, string> = {
  WASP: 'Cheap, fast attacker',
  LANCE: 'Hits the hardest',
  BULWARK: 'Slow and tough',
  HAULER: 'Carries the loot home',
  BASTION: 'Heavy ground guns',
  THORN: 'Light ground guns',
  PROSPECTOR: 'Mines asteroids',
};

export const HULL_ROLE: Record<HullId, string> = {
  WASP: 'Cheapest attack, fastest out and back',
  LANCE: 'Highest attack · strong into Wasps, weak into Bulwarks',
  BULWARK: 'The durability anchor · slow enough to double your exposure',
  HAULER: 'Carries the loot home · contributes nothing to the fight',
  BASTION: 'Ground defence · cannot ever leave the planet',
  THORN: 'Ground defence · light, cheap, and never leaves',
  PROSPECTOR: 'Mines passing asteroids · never joins a fight',
};

export const UNLOCK_NAME = {
  TELESCOPE: 'Telescope',
  RADAR: 'Radar',
  EXPLORER: 'Explorer',
  VEIL: 'Veil',
} as const;
