/** Componentes Gözlemevi v2 — los textos de los nuevos componentes (docs/ui-v2/gozlemevi.md). */

/** B9: mantener pulsado para enviar. */
export const hold = {
  hint: 'Mantén pulsado o pulsa Intro dos veces para confirmar',
  confirm: '{{label}} · ¿seguro?',
  /** Shown on the face after a release that came too soon. */
  release: 'Mantén pulsado para confirmar',
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
  recallHome: "vuelta {{time}}",
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
