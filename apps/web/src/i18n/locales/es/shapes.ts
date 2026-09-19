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
} as const;

/** A probe's fuzzed reading, drawn as the doubt it is: `RangeBand`. */
export const rangeBand = {
  join: ' – ',
  reading: '{{label}}: en algún lugar entre {{low}} y {{high}}',
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
  compareHeading: 'Valor de unidad armada',
  compareYours: 'Enviando',
  compareTheirs: 'Parado ahí',
  /** The reading has an age and a width, and both are the fact. */
  compareRecord: '{{source}}, {{age}}',
  compareLive: '{{source}}, leer ahora',
  compareUnknown: 'Nunca medido',
  compareUnknownWhy: 'Una sonda pondría un número en este lado de la barra.',
  compareLabel: 'Estás enviando {{yours}}; la última lectura de su mundo fue {{theirs}}',
  /**
   * WHAT THE FIGURE AND THE LINES ARE, ONE TAP DEEP. D199.
   *
   * The figure is what the hulls and guns that can fire cost — D183 took the
   * transports out of it. The lines are the battle engine run on this wing against
   * every wall the reading allows, so they include the counter cycle, research and
   * a known shield; what they leave out is said, never implied.
   */
  compareRuleToggle: '¿Qué es esto?',
  compareMeaning: 'Coste de recursos, no daño de ataque. Una flota más grande por sí sola no garantiza la victoria.',
  compareRule:
    'Los naves que disparan y los cañones terrestres de ambos bandos se comparan según el coste de los recursos. El escudo y los naves desarmados no están en este número. El pronóstico también utiliza clases de naves, investigaciones y el escudo conocido. Cuando el valor del enemigo está por debajo de un límite, el modelo espera ese nivel de éxito. El éxito total no garantiza la supervivencia de los naves: ambos bandos pueden ser destruidos. La lectura puede ser antigua; Los cambios de disparo aleatorios no están incluidos.',
  linesClears: 'Límite de éxito total: {{at}}',
  linesBreaks: 'límite de éxito parcial: {{at}}',
  lineJoin: ' · ',
  lossLabel: 'Pérdida estimada: {{share}} (por valor de recurso de la flota)',
  lossUncertainty: 'Este es un rango de pérdida basado en información actual, no una posibilidad de ganar.',
  lossTotalRisk: 'Riesgo alto: Ninguno de tus naves puede regresar.',
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
} as const;
