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
  compareHeading: 'Armed unit value',
  compareYours: 'Sending',
  compareTheirs: 'Standing there',
  /** The reading has an age and a width, and both are the fact. */
  compareRecord: '{{source}}, {{age}}',
  compareLive: '{{source}}, read now',
  compareUnknown: 'Never measured',
  compareUnknownWhy: 'A probe would put a number on this side of the bar.',
  compareLabel: 'You are sending {{yours}}; the last reading of their world was {{theirs}}',
  /**
   * WHAT THE FIGURE AND THE LINES ARE, ONE TAP DEEP. D199.
   *
   * The figure is what the hulls and guns that can fire cost — D183 took the
   * transports out of it. The lines are the battle engine run on this wing against
   * every wall the reading allows, so they include the counter cycle, research and
   * a known shield; what they leave out is said, never implied.
   */
  /** Taktik geri çekilme on the comparison: the verdict line and the rule one tap deeper. */
  escapeRun: 'Their line sits under a third of your fire: if their tank can pay, their ships lift off and only the guns fight.',
  escapeStand: 'Their ships stand and fight: the reading is over a third of your fire, or more than this wing clears.',
  escapeUnsure: 'Their ships may lift off; the reading does not settle every retreat condition.',
  escapeAt: 'Retreat power line: {{at}}',
  escapeRule:
    'Tactical retreat: a line facing at least three times its own firepower, which that raid would wipe out, lifts its ships off instead of fighting, if the world\u2019s tank pays a {{distance}}-unit round trip. The guns stay, and the stores are still raided.',
  escapeMinimumRule: 'The defender also needs at least {{count}} fighting ships at home. A probe reading does not reveal the count.',
  compareRuleToggle: 'What is this?',
  compareMeaning: 'Resource cost, not attack damage. A bigger fleet alone does not guarantee victory.',
  compareRule:
    'Both sides\u2019 firing ships and ground guns are compared by resource cost. The shield and unarmed ships are not in this number. The forecast also uses ship classes, research and the known shield. When their defence stays under a line, the model expects that success — the defender broken and at least one of your ships comes home. A line is a range because the reading does not show everything (class split, shield): the left end is the worst case, the right end the best. How much of the wing it costs is the estimated loss below. The reading may be old; random shot changes are not included.',
  linesClears: 'Full success if their defence is at most {{at}}',
  linesBreaks: 'At least partial success if at most {{at}}',
  lineJoin: ' · ',
  lossLabel: 'Your estimated loss: {{share}} of the wing (by resource value)',
  lossUncertainty: 'This is a loss range based on current information, not a chance of winning.',
  lossTotalRisk: 'High risk: None of your ships may return.',
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
