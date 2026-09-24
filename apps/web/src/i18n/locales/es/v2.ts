/** Componentes Gözlemevi v2 — los textos de los nuevos componentes (docs/ui-v2/gozlemevi.md). */

/** B9: mantener pulsado para enviar. */
export const hold = {
  hint: 'Mantén pulsado o pulsa Intro dos veces para confirmar',
  confirm: '{{label}} · ¿seguro?',
  /** Shown on the face after a release that came too soon. */
  release: 'Mantén pulsado para confirmar',
  verb: 'Mantén',
};

/** B12: una cola de obra dibujada como anillos. */
export const lane = {
  /** Un hueco vacío en la cola. */
  free: '+ Hueco libre',
};

/** B1: un medidor de recurso en la barra superior. */
export const meter = {
  /** Read by a screen reader: the stock against the store. */
  reading: '{{resource}}: {{value}} de {{cap}}',
  /** The same, when the store is full. */
  full: '{{resource}}: {{value}} de {{cap}}, almacén lleno',
  need: '{{resource}}: {{have}} de {{need}}, faltan {{short}}',
  short: 'faltan {{amount}}',
};

/** B5: la regla de fuerzas. */
export const ruler = {
  /** In place of the defence strip when nothing was ever measured. */
  unknown: 'Sin sonda: su defensa es desconocida',
  /** The button that closes that gap. */
  probe: 'Enviar una sonda',
};

/** La hoja v2: su asa. */
export const handle = {
  /** Opens the sheet one height further. */
  expand: 'Ampliar',
  /** At the top: settles it one height lower. */
  collapse: 'Reducir',
};

/** B4: el dock, cinco pestañas en un orden fijo. */
export const dock = {
  /** The navigation landmark, for a screen reader. */
  label: 'Navegación principal',
  galaxy: 'Galaxia',
  base: 'Base',
  fleet: 'Flota',
  intel: 'Inteligencia',
  clan: 'Clan',
  /** The dot on Base, read aloud. */
  baseWaiting: 'Algo que recoger o reparar',
  /** Beside the Fleet ring: your own craft in the air. */
  airborne: 'En vuelo: {{count}}',
  /** The count on Intel: reports you have not seen. */
  reports: 'Informes nuevos: {{count}}',
  /** The count on Clan. */
  attention: 'Esperándote: {{count}}',
};

/** B2: la línea Ahora, el temporizador que más importa. */
export const now = {
  /** The line, for a screen reader. */
  label: 'Temporizador más urgente',
  /** The sheet one tap under it: every timer. */
  sheet: 'Temporizadores',
  work: 'Obra a punto de terminar',
  research: 'Investigación a punto de terminar',
  event: 'El evento termina',
  shield: 'Tu escudo termina',
  shieldDetail: 'Después, los ataques pueden alcanzarte',
  /** The clock time beside a countdown in the sheet. */
  at: 'a las {{time}}',
};

/** K1: la hoja de la campana, tres pestañas. */
export const bell = {
  /** The sheet's name: all three tabs answer it. */
  title: 'Qué pasó',
  /** The tab list, for a screen reader. */
  label: 'Señales, crónica y chat',
  signals: 'Señales',
  chronicle: 'Crónica',
  chat: 'Chat',
  /** The dot on Chat, read aloud. */
  chatUnread: '{{count}} sin leer',
};

/** B1: la barra superior. */
export const topBar = {
  /** The shield's time on the commander chip: whole hours, rounded down. */
  hours: '{{h}}h',
};

/** El chip Vista: capas, guía de eventos y la leyenda de la galaxia. */
export const view = {
  chip: 'Vista',
  title: 'Vista',
  layers: 'Capas',
  telescope: 'Alcance del telescopio',
  telescopeDetail: 'Donde tus mundos ven el estado de las flotas',
  radar: 'Alcance del radar',
  radarDetail: 'Donde tu radar avisa de flotas entrantes',
  events: 'Guía de eventos galácticos',
  /** The round button under the View chip: the disc's old Home mark. */
  home: 'Volar a tu mundo',
};

/** B3: el espacio de contexto, una tarjeta cada vez. */
export const slot = {
  incoming: 'Ataque en camino',
  prepare: 'Preparar la defensa',
  look: 'Mirarlo',
  event: 'Evento galáctico',
  show: 'Mostrar',
  lands: 'llega en {{time}}',
  ends: 'termina en {{time}}',
  pill: 'Ataques en camino: {{count}}',
  dismiss: 'Cerrar',
};

/** E4: the Fleet page — in flight, at home, the Hangar. */
export const fleetPage = {
  views: "Vistas de la flota",
  air: "En vuelo",
  home: "En casa",
  bays: "Bahías de vuelo",
  hangar: "Hangar",
  pace: "velocidad {{pct}} %",
  recall: "Recuperar",
  recallHome: "Si la llamas, en casa en {{time}}",
  recalling: "Volviendo…",
  emptyAir: "Nada en vuelo. Toca un mundo, una roca o un pirata en la galaxia para enviar naves.",
  shipsHome_one: "{{count}} nave en casa",
  shipsHome_other: "{{count}} naves en casa",
  away: "{{count}} fuera",
  noShips: "No hay naves en casa",
  capital: "Capital",
  colony: "Colonia",
  roomRule: "Espacio para cada nave de un mundo: en casa, fuera y en el astillero. Un Hangar lleno detiene el astillero y los traslados entrantes; una flota recuperada siempre cabe.",
  ground: "Defensa terrestre",
  ceiling: "hasta {{shown}} con este Núcleo",
  full: "Lleno",
};

/** The battle report scene (B15), the mock's "KISMİ ZAFER" page. */
export const reportScene = {
  eyebrow: "Informe de batalla · {{planet}}",
  rounds_one: "{{count}} ronda",
  rounds_other: "{{count}} rondas",
  you: "Tú",
  destroyed: "{{count}} destruidos",
  hidden: "Lo que les queda y el resto del campo siguen ocultos; un informe solo dice lo que destruiste.",
  whyHeading: "¿Por qué?",
  why: "La mayoría de tus pérdidas fueron {{lost}}: {{by}} es fuerte contra ellos, y {{bring}} es fuerte contra {{by}}.",
  balance: "Balance",
  balanceLoot: "botín {{amount}}",
  balanceFuel: "combustible −{{amount}}",
  balanceLost: "perdido {{list}}",
  balanceNone: "sin pérdidas",
  cargoFull: "bodega llena",
  colonyRule: "Lealtad de una colonia: una victoria decisiva quita {{decisive}}, una parcial {{partial}}.",
  again: "Atacar de nuevo",
} as const;

/** K6: the switch at the top of the Base — this world, or the commander's research. */
export const baseSwitch = {
  label: 'Base',
  world: 'Este mundo',
  research: 'Investigación',
} as const;

/** E8 · K9: the research constellation. */
export const researchMap = {
  label: 'Mapa de investigación',
  closed: '{{group}} · cerrado',
  /** The strategic three while their release switch is off: the server refuses them. */
  shut: 'Cerrado por ahora',
  /** A prerequisite already held, said on the card. */
  needs: 'Requiere {{name}}',
  /** The next rung of a ladder that opens a hull, and the one rung of a permission. */
  opensAt: 'El nivel {{level}} abre',
  opens: 'Abre',
} as const;

export const roomBar = {
  hangar: 'Espacio del hangar',
  ground: 'Espacio en tierra',
  home: 'en casa {{value}}',
  away: 'fuera {{value}}',
  queued: 'en cola {{value}}',
  incoming: 'este pedido {{value}}',
  free: 'libre {{value}}',
  reading: '{{label}}: {{used}} de {{total}} ocupado',
  returnFits: 'Una flota que vuelve siempre cabe: las naves fuera conservan su espacio.',
  nextHangar: 'El hangar {{level}} lo lleva de {{from}} → {{to}}.',
  gunsStay: 'Los cañones nunca dejan el mundo.',
  nextCore: 'El Núcleo de comando {{level}} lo lleva de {{from}} → {{to}}.',
};

export const away = {
  eyebrow: 'Fuera {{duration}}',
  title: 'Mientras no estabas',
  all: 'Todo ({{count}})',
  done: 'Entendido',
  taken: '{{loot}} robado · {{lost}} unidades perdidas',
  held: '{{lost}} unidades perdidas al resistir',
  looted: '+{{loot}} saqueado · {{lost}} naves perdidas',
  scan_one: 'Un escaneo te encontró',
  scan_other: '{{count}} escaneos te encontraron',
  scanDetail: 'Alguien está armando una imagen de ti.',
  convoySecured: 'Botín del convoy asegurado',
  convoyDelivered: 'Botín del convoy entregado',
  convoyDetail_one: '+{{resources}} recursos · {{count}} nave de botín',
  convoyDetail_other: '+{{resources}} recursos · {{count}} naves de botín',
  accrued: '+{{alloy}} aleación · +{{crystal}} cristal',
  accruedDetail: 'Producido mientras no estabas',
  door: {
    report: 'Informe',
    intel: 'Radar',
    base: 'Base',
    orbit: 'Instalar',
    signals: 'Señales',
  },
};

export const outline = {
  label: 'Resumen',
  worlds: 'Mundos',
  air: 'En vuelo',
  airEmpty: 'Nada en vuelo — lanza desde la tarjeta de un mundo.',
  queues: 'Colas',
  research: 'Investigación',
  idle_one: 'Inactiva · {{count}} hueco libre',
  idle_other: 'Inactiva · {{count}} huecos libres',
  filled: '{{count}} de {{total}}',
  threat_one: '{{count}} ataque en camino',
  threat_other: '{{count}} ataques en camino',
};
