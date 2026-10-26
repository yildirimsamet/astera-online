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
  /** Combat v3 force ruler (owner 2026-10-25): each side’s power, their ratio, and the rule one tap deep. */
  compareHeading: "Relative Stärke",
  compareLabel: "Deine Stärke {{yours}}; ihre Stärke {{theirs}}",
  comparePick: "Wähle Schiffe, um sie gegen dieses Ziel abzuwägen.",
  compareMeaning: "Feuerkraft und Haltbarkeit gegeneinander, Klassenvorteile eingerechnet. Die stärkere Seite behält mehr von ihrer Flotte.",
  compareRule: "Stärke zählt bewaffnete Schiffe und aktive Bodengeschütze: ihre Forschung, Schäden und den Klassenkreislauf gegen die andere Seite, dazu die Aegis-Ladung. Unbewaffnete Schiffe zählen nicht. Eine Sonde misst in Bereichen, daher ist jede Seite ein Bereich; das untere Ende des Verhältnisses ist dein schlechtester Fall. Messungen veralten, und in jedem Kampf fallen die Schüsse zufällig.",
  ratioYou: "Du bist {{band}}× so stark",
  ratioThem: "Sie sind {{band}}× so stark",
  ratioOpen: "Die Messung klärt nicht, wer stärker ist: sie bis {{them}}×, du bis {{you}}×",
  ratioEven: "Etwa gleich stark",
  ratioNoFire: "Dort feuert nichts zurück",
  ratioUnarmed: "Dein Flügel hat nichts, das feuert",
  axisTheirs: "Sie stärker",
  axisEven: "Gleich",
  axisYours: "Du stärker",
  outcomeHeading: "Was jede Seite im Schnitt behält",
  outcomeRatio: "Verhältnis",
  outcomeWeak: "Schwächere behält",
  outcomeStrong: "Stärkere verliert",
  outcomeNote: "Durchschnitt vieler Kämpfe. Lebend zurückgezogene Schiffe zählen als behalten. Bei 1:1 behalten größere Flotten mehr.",
  escapeRun: "In der ganzen Messung beträgt deine Stärke mindestens das {{ratio}}-Fache ihrer. Kann dein Flügel ihre Linie vernichten und zahlt ihr Tank den Start, heben ihre Schiffe ab.",
  escapeStand: "Ihre Schiffe bleiben und kämpfen: In der ganzen Messung liegt deine Stärke unter dem {{ratio}}-Fachen ihrer.",
  escapeRule: "Ihre Schiffe heben vor dem Kampf ab, wenn deine Stärke mindestens das {{ratio}}-Fache ihrer Linie beträgt, aktive Bodengeschütze eingeschlossen. Dein Flügel muss diese Linie außerdem vernichten können. Ihr Planet muss einen Hin- und Rückflug über {{distance}} Einheiten bezahlen. Bodengeschütze bleiben, und Ressourcen können weiter geplündert werden.",
  compareYours: 'Senden',
  compareTheirs: 'Steht da',
  compareRecord: '{{source}}, {{age}}',
  compareLive: '{{source}}, jetzt lesen',
  compareUnknown: 'Nie gemessen',
  compareUnknownWhy: 'Eine Sonde würde eine Zahl auf dieser Seite des Balkens platzieren.',
  escapeUnsure: 'Ihre Schiffe könnten abheben; die Messung klärt nicht alle Rückzugsbedingungen.',
  escapeMinimumRule: 'Der Verteidiger braucht außerdem mindestens {{count}} Kampfschiffe vor Ort. Eine Sondenmessung zeigt ihre Anzahl nicht.',
  compareRuleToggle: 'Was ist das?',
  lineJoin: ' · ',
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
