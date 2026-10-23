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
  baseWaiting: 'Algo que reparar',
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
  /** An order behind the head of its lane: no clock yet (2026-10-06). */
  queued: "Empieza cuando termine el anterior",
  event: 'El evento termina',
  shield: 'Tu escudo termina',
  shieldDetail: 'Después, los ataques pueden alcanzarte',
  silentSpace: "Traslado al Espacio Silencioso",
  silentSpaceDetail: "Inicia construcción, investigación, producción o ataque",
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
  focusWorld: "Mostrar {{world}} en la galaxia",
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
  damageTitle: "Salieron dañadas",
  damageLot: "{{name}} ×{{count}} · {{pct}} % de daño",
  toDock: "Traslado manual al taller",
  patched: "Daño conservado",
  landing: "Las naves supervivientes vuelven al hangar con sus daños. Trasládalas tú al taller.",
  eyebrow: "Informe de batalla · {{planet}}",
  rounds_one: "{{count}} ronda",
  rounds_other: "{{count}} rondas",
  you: "Tú",
  destroyed: "{{count}} destruidos",
  hidden: "Lo que les queda y el resto del campo siguen ocultos; un informe solo dice lo que destruiste.",
  whyDecisive: "De dónde vienen las pérdidas",
  whyPartial: "¿Por qué parcial?",
  whyRepelled: "¿Por qué rechazado?",
  why: "La mayoría de tus pérdidas fueron {{lost}}: {{by}} es fuerte contra ellos, y {{bring}} es fuerte contra {{by}}.",
  balance: "Balance",
  balanceLoot: "botín {{amount}}",
  balanceFuel: "combustible −{{amount}}",
  balanceLost: "perdido {{list}}",
  balanceNone: "sin pérdidas",
  cargoFull: "bodega llena",
  intel: "La defensa de {{planet}} está en su expediente desde las {{time}}",
  loyalty: "lealtad de la colonia −{{amount}}",
  watch: "Ver",
  share: "Al clan",
  shareLine: "{{word}} en {{planet}} · botín {{loot}} · perdido {{lost}}",
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
  /** The strategic three while their release switch is off: the server refuses them. */
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
  done: 'Volver a la galaxia',
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
    report: 'Abrir el informe',
    intel: 'Abrir el radar',
    base: 'Ir a la base',
    orbit: 'Instalar',
    signals: 'Abrir señales',
    dossier: 'Abrir el expediente',
    repair: 'reparar',
  },
  sighting: 'La flota de {{planet}} está fuera',
  sightingBack: 'Vuelve ~{{time}} · vista por tu telescopio',
  sightingSeen: 'Vista por tu telescopio',
  careLoyalty: '{{world}} lealtad {{loyalty}} %',
  careFaults_one: '{{count}} avería pendiente',
  careFaults_other: '{{count}} averías pendientes',
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

/** The Repair Station (Kalıcı gemi hasarı, `plan.md` F4/F6). */
export const repairStation = {
  maintenance: {
    hangar: "Hangar",
    workshop: "Taller",
    repair: "Reparación",
    scrap: "Desguace",
    healthy: "Casco completo",
    ready: "Puede combatir",
    critical: "No puede combatir",
    healthExact: "{{pct}}% de PV",
    healthAbove: "Más del {{pct}}% de PV",
    healthBelow: "Menos del {{pct}}% de PV",
    quantity: "{{name}} · {{health}} · cantidad",
    increase: "Aumentar {{name}}",
    decrease: "Reducir {{name}}",
    selectAll: "Seleccionar todos los {{name}}",
    all: "Todos",
    available: "{{count}} disponibles",
    reserved: "Reservadas para reparar",
    move: "Enviar al taller",
    return: "Devolver al hangar",
    scrapAction: "Desguazar naves",
    moved: "Naves enviadas al taller.",
    returned: "Naves devueltas al hangar.",
    scrapped: "Naves desguazadas.",
    select: "Seleccionar naves",
    stale: "La salud de las naves cambió. Borra la selección y elige de nuevo.",
    clear: "Borrar selección",
    rule: "El daño permanece hasta una reparación pagada. Las naves con un 5% de PV o menos no pueden combatir.",
    dockRule: "El traslado es gratuito. Las naves en el taller no pueden volar ni defender.",
    scrapRule: "Inmediato e irreversible. Recuperas la mitad de los recursos de producción correspondientes al casco restante.",
    scrapConfirm: "¿Desguazar {{count}} naves?",
    keep: "Conservar naves",
    returnedResources: "Recursos recuperados",
    radiation: "La radiación impide el ingreso, la reparación y el desguace. Devuelve las naves al hangar para evacuarlas.",
    homeHint: "Elige las naves dañadas que enviarás al taller de este planeta.",
    selected: "{{count}} seleccionadas",
    empty: "No hay naves en este grupo.",
  },
  order: "Reparación · {{name}}",
  all: "naves mixtas",
  title: "Estación de Reparación",
  role: "Elige naves para reparar o desguazar.",
  tagline: "Devuelve las naves dañadas a la flota.",
  idle: "Taller vacío. Elige naves del hangar.",
  waitingShips_one: "{{count}} nave en espera",
  waitingShips_other: "{{count}} naves en espera",
  repairingShips_one: "{{count}} en reparación",
  repairingShips_other: "{{count}} en reparación",
  queueFill: "Cola {{used}}/{{total}}",
  statWaiting: "En espera",
  statRepairing: "En reparación",
  statQueue: "Cola",
  outOfAction: "Las naves del taller no pueden volar ni defender. Devuelve las que esperan al hangar para trasladarlas.",
  howItWorks: "Cómo funciona",
  ruleFree: "No hay reparación gratuita. Los daños permanecen hasta una reparación pagada.",
  rulePrice: "Precio: la parte dañada de una nave nueva. Una nave dañada al 40 % cuesta el 40 % de una nueva.",
  ruleTime: "Tiempo: la misma parte de su tiempo de construcción. Los niveles de {{shipyard}} y {{automation}} lo acortan.",
  ruleIndustrial: "La investigación {{industrial}} reduce precio y tiempo al 75 %, y luego al 50 %.",
  youPay: "Ahora pagas el {{pct}} %.",
  ruleQueue: "Los trabajos van uno tras otro, hasta {{depth}} en cola, aparte de la cola del Astillero.",
  ruleCancel: "Cancelar devuelve la mitad del precio; las naves vuelven a esperar.",
  industrialChip: "{{industrial}} −{{off}} %",
  damagedHeading: "Naves dañadas",
  selectBatch: "Elegir los primeros {{max}} grupos de salud",
  selectAll: "Elegir todas",
  selectNone: "Vaciar",
  choose: "Reparar {{name}} ×{{count}}",
  noneWaiting: "Ninguna nave espera reparación.",
  damaged: "{{pct}} % dañada",
  share: "{{pct}} % de una nave nueva",
  queueHeading: "Cola de reparación",
  queueEmpty: "Nada en reparación.",
  finishing: "Terminando…",
  startsIn: "empieza en {{time}}",
  ends: "lista en {{time}}",
  selected_one: "{{count}} nave elegida",
  selected_other: "{{count}} naves elegidas",
  afterQueue: "Empieza tras la cola, en {{time}}",
  repairSelected_one: "Reparar {{count}} nave",
  repairSelected_other: "Reparar {{count}} naves",
  pick: "Elige naves para reparar",
  queueFullShort: "Cola llena · {{used}}/{{total}}",
  tooMany: "Elige como máximo {{max}} grupos de integridad por acción.",
  starting: "Iniciando…",
  cancel: "Cancelar",
  docked_one: "{{count}} en reparación",
  docked_other: "{{count}} en reparación",
  started: "Reparación iniciada",
  queue: "Estación de Reparación",
};
