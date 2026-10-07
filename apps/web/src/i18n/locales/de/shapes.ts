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
  reading: '{{label}}: {{spend}} ausgegeben, {{left}} übrig',
  readingSpend: '{{label}}: {{spend}}',
  readingShort: '{{label}}: {{short}} kurz',
  shortfall: '{{short}} fehlen',
} as const;

/** A probe's fuzzed reading, drawn as the doubt it is: `RangeBand`. */
export const rangeBand = {
  join: ' – ',
  reading: '{{label}}: irgendwo zwischen {{low}} und {{high}}',
  yours: 'deins {{value}}',
} as const;

/** Which way a craft is pointing and how far it has got: `FlightBar`. */
export const flightBar = {
  out: 'Hinausgehend, weg von dieser Welt',
  back: 'Rückkehr in diese Welt',
  incoming: 'Eingehend – Position unbekannt',
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
  heading: '-Matchups',
  strongVs: 'Stark gegen {{class}}',
  weakVs: 'Schwach gegenüber {{class}}',
  /** SUPPORT is outside the cycle in both directions and must not fake a rung. */
  supportNote: 'Unbewaffnet. Gedeckt, während ein auf der Seite liegender Kampfrumpf überlebt.',
  /** The three-word verdict on one pairing. */
  strong: 'Stark',
  weak: 'Schwach',
  even: 'Gerade',
  /** No shot at all: a support hull firing is not a weak match, it is no match. */
  none: 'Kein Angriff',
  multiplier: '×{{mult}}',
  matchupLabel: '{{attacker}} gegen {{defender}}: {{outcome}}, ×{{mult}} Schaden',
  cycleLabel: 'Scharmützler schlägt Bollwerk, Bollwerk schlägt Lanze, Lanze schlägt Scharmützler',
  /** Above the two bars on the launch sheet — the one name of the one force unit. D199. */
  compareHeading: 'Wert der bewaffneten Einheit',
  compareYours: 'Senden',
  compareTheirs: 'Steht da',
  /** The reading has an age and a width, and both are the fact. */
  compareRecord: '{{source}}, {{age}}',
  compareLive: '{{source}}, jetzt lesen',
  compareUnknown: 'Nie gemessen',
  compareUnknownWhy: 'Eine Sonde würde eine Zahl auf dieser Seite des Balkens platzieren.',
  compareLabel: 'Sie senden {{yours}}; die letzte Lesung ihrer Welt war {{theirs}}',
  /**
   * WHAT THE FIGURE AND THE LINES ARE, ONE TAP DEEP. D199.
   *
   * The figure is what the hulls and guns that can fire cost — D183 took the
   * transports out of it. The lines are the battle engine run on this wing against
   * every wall the reading allows, so they include the counter cycle, research and
   * a known shield; what they leave out is said, never implied.
   */
  /** Taktik geri çekilme im Vergleich: die Aussage und die Regel einen Tipp tiefer. */
  escapeRun: 'Ihre Linie liegt unter einem Drittel deiner Feuerkraft: reicht ihr Tank, heben ihre Schiffe ab und nur die Geschütze kämpfen.',
  escapeStand: 'Ihre Schiffe bleiben und kämpfen: die Messung liegt über einem Drittel deiner Feuerkraft oder über dem, was dieser Flügel räumt.',
  escapeUnsure: 'Ihre Schiffe könnten abheben; die Messung klärt nicht alle Rückzugsbedingungen.',
  escapeAt: 'Rückzugsgrenze: {{at}}',
  escapeRule:
    'Taktischer Rückzug: eine Linie, die mindestens der dreifachen eigenen Feuerkraft gegenübersteht und von diesem Angriff ausgelöscht würde, lässt ihre Schiffe abheben statt zu kämpfen, sofern der Tank der Welt einen Hin- und Rückflug von {{distance}} Einheiten bezahlt. Die Geschütze bleiben, und die Lager werden trotzdem geplündert.',
  escapeMinimumRule: 'Der Verteidiger braucht außerdem mindestens {{count}} Kampfschiffe vor Ort. Eine Sondenmessung zeigt ihre Anzahl nicht.',
  compareRuleToggle: 'Was ist das?',
  compareMeaning: 'Ressourcenkosten, kein Angriffsschaden. Eine größere Flotte allein garantiert keinen Sieg.',
  compareRule:
    'Die Feuerschiffe und Bodengeschütze beider Seiten werden anhand der Ressourcenkosten verglichen. Der Schild und die unbewaffneten Schiffe sind in dieser Zahl nicht enthalten. Die Vorhersage berücksichtigt auch Schiffsklassen, Forschung und den bekannten Schild. Bleibt ihre Verteidigung unter einer Linie, erwartet das Modell diesen Erfolg – die Verteidigung gebrochen und mindestens eines deiner Schiffe kehrt heim. Eine Linie ist eine Spanne, weil die Messung nicht alles zeigt (Klassenaufteilung, Schild): das linke Ende ist der schlechteste Fall, das rechte der beste. Was es den Flügel kostet, ist der geschätzte Verlust darunter. Die Messung kann alt sein; zufällige Schussschwankungen sind nicht enthalten.',
  linesClears: 'Voller Erfolg bei höchstens {{at}} Verteidigung',
  linesBreaks: 'Mindestens Teilerfolg bei höchstens {{at}}',
  lineJoin: ' · ',
  lossLabel: 'Dein geschätzter Verlust: {{share}} des Flügels (nach Ressourcenwert)',
  lossUncertainty: 'Dies ist eine Verlustspanne, die auf aktuellen Informationen basiert, keine Gewinnchance.',
  lossTotalRisk: 'Hohes Risiko: Keines Ihrer Schiffe kehrt möglicherweise zurück.',
  /** What the lines could not see, and what is already known about the reading. D199. */
  noteShieldUnmeasured: 'Schildladung nicht gemessen',
  noteShapeUnread: 'Form der Wand nicht gelesen',
  noteUnarmedUnknown: 'Transporte nicht gezählt',
  noteUnarmed_one: '{{band}} Transport steht in der Schlange',
  noteUnarmed_other: '{{band}} Transporte stehen in der Schlange',
  noteSeen: 'Ihre Sonde wurde gesehen',
  noteSomeAway: 'Ein Teil ihrer Flotte war bei dem Anblick unterwegs',
  noteTelescopeAway: '-Teleskop: Ihre Flotte ist jetzt draußen',
  noteTelescopeHome: '-Teleskop: Ihre Flotte ist zu Hause',
  noteLastRaid: 'Beim letzten Angriff sanken größtenteils {{class}}',
  mixMostly: 'Meistens {{class}}',
  mixEven: 'Keine einzelne Klasse dominiert',
  matchupMajority: 'Überwiegend {{class}} — mehr als die Hälfte',
  matchupRemainder: 'der Rest ist ungelesen und kann dich kontern',
  matchupUnread: "{{share}} % ungelesen",
  matchupMixed: 'Gemischte Verteidigung — kein einzelner harter Konter',
  matchupSplit: 'Gelesene Aufteilung',
  matchupBring: '{{class}} mitnehmen',
  matchupSingle: 'Deine Flotte ist einklassig — ihr Konter kann im ungelesenen Teil sein',
  matchupExposure: 'stark {{strong}}% · schwach {{weak}}%',
  matchupProbe: 'eine Sonde zwei Werftstufen höher zeigt die Aufteilung',
} as const;
