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
  shortfall: '{{short}} short',
} as const;

/** A probe's fuzzed reading, drawn as the doubt it is: `RangeBand`. */
export const rangeBand = {
  join: ' – ',
  reading: '{{label}}: somewhere between {{low}} and {{high}}',
  yours: 'yours {{value}}',
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
  /** Above the two bars on the launch sheet — the one name of the one force unit. D199. */
  /** Combat v3 force ruler (owner 2026-10-25): each side’s power, their ratio, and the rule one tap deep. */
  compareHeading: "Relative power",
  compareLabel: "Your power {{yours}}; their power {{theirs}}",
  comparePick: "Pick ships to weigh them against this target.",
  compareMeaning: "Firepower and durability against each other, counters included. The stronger side keeps more of its fleet.",
  compareRule: "Power counts armed ships and active ground guns: their research, wounds and the counter cycle against the other side, plus the Aegis charge. Unarmed ships add nothing. A probe reads in ranges, so each side is a range; the low end of the ratio is your worst case. Readings age, and every battle rolls its shots.",
  ratioYou: "You are {{band}}× as strong",
  ratioThem: "They are {{band}}× as strong",
  ratioOpen: "The reading does not settle who is stronger: they up to {{them}}×, you up to {{you}}×",
  ratioEven: "About even",
  ratioNoFire: "Nothing there fires back",
  ratioUnarmed: "Your wing has nothing that fires",
  axisTheirs: "They’re stronger",
  axisEven: "Even",
  axisYours: "You’re stronger",
  outcomeHeading: "What each side keeps, on average",
  outcomeRatio: "Ratio",
  outcomeWeak: "Weaker keeps",
  outcomeStrong: "Stronger loses",
  outcomeNote: "Averages over many battles. Ships that retreat alive count as kept. At 1:1, larger fleets keep more.",
  escapeRun: "Your power is at least {{ratio}}× theirs across the whole reading. If your wing would wipe out their line and their tank pays the lift, their ships lift off.",
  escapeStand: "Their ships stand and fight: across the reading, your power stays under {{ratio}}× theirs.",
  escapeRule: "Their ships lift off before the battle if your power is at least {{ratio}}× their line’s, active ground guns included. Your wing must also be able to wipe out that line. Their planet must fund a {{distance}}-unit round trip. Ground guns stay, and resources can still be raided.",
  compareYours: 'Sending',
  compareTheirs: 'Standing there',
  compareRecord: '{{source}}, {{age}}',
  compareLive: '{{source}}, read now',
  compareUnknown: 'Never measured',
  compareUnknownWhy: 'A probe would put a number on this side of the bar.',
  escapeUnsure: 'Their ships may lift off; the reading does not settle every retreat condition.',
  escapeMinimumRule: 'The defender also needs at least {{count}} fighting ships at home. A probe reading does not reveal the count.',
  compareRuleToggle: 'What is this?',
  lineJoin: ' · ',
  /** What the lines could not see, and what is already known about the reading. D199. */
  noteShieldUnmeasured: 'Shield charge not measured',
  noteShapeUnread: 'Shape of the wall not read',
  noteUnarmedUnknown: 'Transports not counted',
  noteUnarmed_one: '{{band}} transport stands in the line',
  noteUnarmed_other: '{{band}} transports stand in the line',
  noteSeen: 'Your probe was seen',
  noteSomeAway: 'Some of their fleet was out at the look',
  noteTelescopeAway: 'Telescope: their fleet is out now',
  noteTelescopeHome: 'Telescope: their fleet is home',
  noteLastRaid: 'Last raid sank mostly {{class}}',
  mixMostly: 'Mostly {{class}}',
  mixEven: 'No single class dominates',
  matchupMajority: 'Mostly {{class}} — more than half',
  matchupRemainder: 'the remainder is unread and may counter you',
  matchupUnread: "{{share}}% unread",
  matchupMixed: 'Mixed defence — no single hard counter',
  matchupSplit: 'Read split',
  matchupBring: 'Bring {{class}}',
  matchupSingle: 'Your wing is single-class — its counter may be in the unread part',
  matchupExposure: 'strong {{strong}}% · weak {{weak}}%',
  matchupProbe: 'a probe two Shipyard levels up reveals the split',
} as const;
