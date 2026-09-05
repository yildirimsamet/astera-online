/**
 * THE DRAWING VOCABULARY'S OWN WORDS. D142.
 *
 * Every string in this file is a caption on a shape that has already made the
 * point, or a sentence for the screen reader that cannot see the shape at all.
 * Nothing here is load-bearing: a player who reads none of it still knows whether
 * the fuel covers the flight, how sure a probe reading is, and which way a fleet
 * is pointing.
 *
 * It has its own namespace because these components are cross-surface — the spend
 * bar is on two launch sheets, the flight bar is on the strip and in the roster —
 * and a caption that lived on one of those surfaces would move with it.
 */

/** A price taken out of a store: `SpendBar`. */
export const spend = {
  reading: '{{label}}: {{spend}} spent, {{left}} left',
  readingSpend: '{{label}}: {{spend}}',
  readingShort: '{{label}}: {{short}} short',
} as const;

/** A probe's fuzzed reading, drawn as the doubt it is: `RangeBand`. */
export const rangeBand = {
  join: ' – ',
  reading: '{{label}}: somewhere between {{low}} and {{high}}',
} as const;

/** Which way a craft is pointing and how far it has got: `FlightBar`. */
export const flightBar = {
  out: 'Outbound, away from this world',
  back: 'Returning to this world',
  incoming: 'Inbound — position unknown',
} as const;

/**
 * THE COUNTER CYCLE'S OWN WORDS. D124.
 *
 * The multipliers this namespace captions were printed in exactly ONE place in the
 * whole game before it existed — `CombatFormula`, inside a battle report, which is
 * to say after the fleet was already lost. Everything here exists so the same rule
 * is legible at the moment it is being bet on instead.
 *
 * The strings are captions. A player who reads none of them still sees three
 * different shapes and a green or red mark, which is the rule arriving without
 * being read; these are for the screen reader and for confirming what the shape
 * already said.
 */
export const counter = {
  /** The relation, as a heading over a hull's two lines. */
  heading: 'Matchups',
  strongVs: 'Strong against {{class}}',
  weakVs: 'Weak against {{class}}',
  /** SUPPORT is outside the cycle in both directions and must not fake a rung. */
  supportNote: 'Unarmed. Covered while a combat hull on its side survives.',
  /** The three-word verdict on one pairing. */
  strong: 'Strong',
  weak: 'Weak',
  even: 'Even',
  /** No shot at all: a support hull firing is not a weak match, it is no match. */
  none: 'No attack',
  multiplier: '×{{mult}}',
  matchupLabel: '{{attacker}} against {{defender}}: {{outcome}}, ×{{mult}} damage',
  cycleLabel: 'Skirmisher beats Bulwark, Bulwark beats Lance, Lance beats Skirmisher',
  /** Above the two bars on the launch sheet. */
  compareHeading: 'Your fleet against theirs',
  compareYours: 'Sending',
  compareTheirs: 'Standing there',
  /** The reading has an age and a width, and both are the fact. */
  compareRecord: '{{source}}, {{age}} old',
  compareLive: '{{source}}, read now',
  compareUnknown: 'Never measured',
  compareUnknownWhy: 'A probe would put a number on this side of the bar.',
  compareLabel: 'You are sending {{yours}}; the last reading of their world was {{theirs}}',
  /** What the player is looking at, in the one sentence that must not overclaim. */
  compareNote: 'Resource value, both sides. It does not include the counter cycle.',
  mixHeading: 'What is standing there',
  mixMostly: 'Mostly {{class}}',
  mixEven: 'No single class dominates',
  mixFrom: 'From {{source}}, {{age}} old',
} as const;
