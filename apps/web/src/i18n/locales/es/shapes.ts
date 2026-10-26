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
  reading: '{{label}}: {{spend}} gastado, {{left}} restante',
  readingSpend: '{{label}}: {{spend}}',
  readingShort: '{{label}}: {{short}} corto',
  shortfall: 'faltan {{short}}',
} as const;

/** A probe's fuzzed reading, drawn as the doubt it is: `RangeBand`. */
export const rangeBand = {
  join: ' – ',
  reading: '{{label}}: en algún lugar entre {{low}} y {{high}}',
  yours: 'el tuyo {{value}}',
} as const;

/** Which way a craft is pointing and how far it has got: `FlightBar`. */
export const flightBar = {
  out: 'Saliente, lejos de este mundo',
  back: 'Regresando a este mundo',
  incoming: 'Entrante: posición desconocida',
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
  heading: 'Emparejamientos',
  strongVs: 'Fuerte contra {{class}}',
  weakVs: 'Débil contra {{class}}',
  /** SUPPORT is outside the cycle in both directions and must not fake a rung. */
  supportNote: 'Desarmado. Cubierto mientras sobrevive un casco de combate en su costado.',
  /** The three-word verdict on one pairing. */
  strong: 'Fuerte',
  weak: 'Débil',
  even: 'Incluso',
  /** No shot at all: a support hull firing is not a weak match, it is no match. */
  none: 'Sin ataque',
  multiplier: '×{{mult}}',
  matchupLabel: '{{attacker}} contra {{defender}}: {{outcome}}, ×{{mult}} daño',
  cycleLabel: 'Hostigador vence a Baluarte, Baluarte vence a Lanza, Lanza vence a Hostigador',
  /** Above the two bars on the launch sheet — the one name of the one force unit. D199. */
  /** Combat v3 force ruler (owner 2026-10-25): each side’s power, their ratio, and the rule one tap deep. */
  compareHeading: "Poder relativo",
  compareLabel: "Tu poder {{yours}}; su poder {{theirs}}",
  comparePick: "Elige naves para compararlas con este objetivo.",
  compareMeaning: "Potencia de fuego y resistencia una contra otra, ventajas de clase incluidas. El bando más fuerte conserva más de su flota.",
  compareRule: "El poder cuenta naves armadas y cañones terrestres activos: su investigación, sus daños y el ciclo de clases frente al otro bando, más la carga del Aegis. Las naves desarmadas no suman nada. Una sonda lee en rangos, así que cada bando es un rango; el extremo bajo de la proporción es tu peor caso. Las lecturas envejecen, y en cada batalla los disparos caen al azar.",
  ratioYou: "Eres {{band}}× más fuerte",
  ratioThem: "Son {{band}}× más fuertes",
  ratioOpen: "La lectura no aclara quién es más fuerte: ellos hasta {{them}}×, tú hasta {{you}}×",
  ratioEven: "Más o menos iguales",
  ratioNoFire: "Allí nada devuelve el fuego",
  ratioUnarmed: "Tu ala no tiene nada que dispare",
  axisTheirs: "Ellos más fuertes",
  axisEven: "Igual",
  axisYours: "Tú más fuerte",
  outcomeHeading: "Lo que conserva cada bando, de media",
  outcomeRatio: "Proporción",
  outcomeWeak: "El débil conserva",
  outcomeStrong: "El fuerte pierde",
  outcomeNote: "Medias de muchas batallas. Las naves que se retiran con vida cuentan como conservadas. A 1:1, las flotas grandes conservan más.",
  escapeRun: "En toda la lectura tu poder es al menos {{ratio}}× el suyo. Si tu ala puede aniquilar su línea y su tanque paga el despegue, sus naves despegan.",
  escapeStand: "Sus naves se quedan a luchar: en toda la lectura tu poder queda por debajo de {{ratio}}× el suyo.",
  escapeRule: "Sus naves despegan antes de la batalla si tu poder es al menos {{ratio}}× el de su línea, cañones terrestres activos incluidos. Tu ala también debe poder aniquilar esa línea. Su planeta debe pagar un viaje de ida y vuelta de {{distance}} unidades. Los cañones terrestres se quedan, y los recursos aún pueden saquearse.",
  compareYours: 'Enviando',
  compareTheirs: 'Parado ahí',
  compareRecord: '{{source}}, {{age}}',
  compareLive: '{{source}}, leer ahora',
  compareUnknown: 'Nunca medido',
  compareUnknownWhy: 'Una sonda pondría un número en este lado de la barra.',
  escapeUnsure: 'Sus naves podrían despegar; la lectura no resuelve todas las condiciones de retirada.',
  escapeMinimumRule: 'El defensor también necesita al menos {{count}} naves de combate en casa. La lectura de la sonda no muestra cuántas hay.',
  compareRuleToggle: '¿Qué es esto?',
  lineJoin: ' · ',
  /** What the lines could not see, and what is already known about the reading. D199. */
  noteShieldUnmeasured: 'Carga de escudo no medida',
  noteShapeUnread: 'Forma de la pared no leída',
  noteUnarmedUnknown: 'Transportes no contabilizados',
  noteUnarmed_one: '{{band}} puestos de transporte en la línea',
  noteUnarmed_other: '{{band}} transportes se encuentran en la fila',
  noteSeen: 'Se vio su sonda',
  noteSomeAway: 'Parte de su flota estaba observando\nTelescopio',
  noteTelescopeAway: ': su flota ya está disponible\nTelescopio',
  noteTelescopeHome: ': su flota está en casa',
  noteLastRaid: 'La última incursión se hundió en su mayor parte {{class}}',
  mixMostly: 'Mayormente {{class}}',
  mixEven: 'Ninguna clase domina',
  matchupMajority: 'Mayoría {{class}} — más de la mitad',
  matchupRemainder: 'el resto no se leyó y puede contrarrestarte',
  matchupUnread: "{{share}} % sin leer",
  matchupMixed: 'Defensa mixta — ningún contador único',
  matchupSplit: 'División leída',
  matchupBring: 'Lleva {{class}}',
  matchupSingle: 'Tu flota es de una sola clase — su contador puede estar en la parte no leída',
  matchupExposure: 'fuerte {{strong}}% · débil {{weak}}%',
  matchupProbe: 'una sonda dos niveles de astillero por encima revela la división',
} as const;
