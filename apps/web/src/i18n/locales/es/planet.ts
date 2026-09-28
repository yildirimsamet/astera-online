/**
 * YOUR OWN WORLD — the four decision groups, the rows they are made of, the
 * detail sheet behind each row, and the launch planner.
 */

export const planet = {
  recovery: "Recuperación en curso · los sistemas regresan en {{duration}}",
  empActive: "EMP · Égida a cero y sin regeneración durante {{duration}}; las defensas terrestres no disparan ni reciben daño.",
  /**
   * THE COUNTER TO THE THING ABOVE. T10 · T12.
   *
   * Its own block rather than a `deathStar` sub-key: they are two controls on two
   * different tabs, and the day either is reworded the other must not move with
   * it. `docs/interface.md` I1 — every requirement is a door and names itself.
   */
  interceptor: {
    eyebrow: "Batería antiestratégica",
    tally: "{{used}} de {{total}} cargas disponibles",
    none: "Sin cargo cargado",
    building: "Cargando · {{duration}}",
    paused: "Carga pausada durante la recuperación",
    ready: "Una carga cargada",
    noRadar: "Cargado · El anillo de radar está fuera de línea",
    build: "Cargo de carga",
    started: "Cargando carga",
    hint: "Destruye la primera Estrella de la Muerte que ingresa al anillo del radar cronometrado o se identifica en la mira del telescopio. Gastado cuando se dispara.",
    readyHint:
      "Armado. Destruye la próxima Estrella de la Muerte que ingresa al anillo de intercepción del radar o es identificada en la mira del telescopio.",
    noRadarHint:
      "La carga sigue cargada, pero este mundo no tiene anillo de interceptación de radar. Restaurar su enlace ascendente y radar 3; La vista telescópica de otro mundo todavía puede activarlo.",
    needResearch: "Cuadrícula de intercepción",
    needRadar: "Radar L{{level}}",
    needUplink: "Enlace ascendente en órbita",
    needOperational: "Operativo mundial",
    buildTime: "{{duration}} · una carga · gastada en disparar",
    buildSecond: 'Cargar la segunda carga',
  },

  deathStar: {
    eyebrow: "Arma EMP táctica",
    tally: "{{used}} de {{total}} armas disponibles",
    none: "No hay Estrella de la Muerte en este mundo",
    building: "Edificio · {{duration}}",
    paused: "Compilación pausada durante la recuperación",
    ready: "Listo para iniciar",
    stock: "{{ready}} listo · {{building}} edificio · {{held}}/{{capacity}}",
    build: "Construir",
    started: "Comenzó la construcción de la Estrella de la Muerte",
    dangerHint:
      "EMP: la Égida cae a cero y no se regenera durante 1 hora. Las defensas terrestres no disparan ni reciben daño en ese tiempo.",
    readyHint:
      "Preparada: la Égida del objetivo cae a cero y no se regenera durante 1 hora; las defensas terrestres no disparan ni reciben daño.",
    needProtocol: "Protocolo",
    needCore: "Núcleo L{{level}}",
    needShipyard: "Astillero L{{level}}",
    needOperational: "Operativo mundial",
    buildTime: "{{duration}} · un arma · sin recuperación",

    needs: 'Requiere {{need}}',
  },
  tabs: {
    label: "Categorías de planetas",
    defendProblem: "Defender",
    defendQuestion: "Fortalece tu escudo, bóveda y armas planetarias aquí.",
    orbitProblem: "Intel",
    orbitQuestion: "Crea las herramientas que te ayudarán a ver a tus rivales.",
    reachProblem: "Flota",
    reachQuestion: "Desarrolla tus naves y alcance aquí.",
    growProblem: "Producción",
    growQuestion: "Haga crecer sus recursos y el límite de nivel de construcción aquí.",
    tacticalProblem: "Táctico",
    tacticalQuestion: "Construye y administra herramientas tácticas aquí.",
  },


  queue: {
    /** The end of all the work in one lane, which no screen used to carry. */
    waiting: "En cola",
    ends: "finaliza {{time}}",
    segment: "{{name}} · {{duration}}",
    cancelOne: "Cancelar {{name}}",
    title: "Colas de construcción",
    idle: "Nada en construcción",
    capacity: "{{count}} ranuras cada una",
    construction: "Construcción",
    yard: "Yarda",
    slotFree: "Gratis",
    empty: "No hay trabajo comprometido",
    committing: "confirmando…",
    staged: "comienza cuando se reclama",
    queued_one: "{{count}} pedido en cola",
    queued_other: "{{count}} pedidos en cola",
    unitsQueued_one: "{{count}} unidad en cola",
    unitsQueued_other: "{{count}} unidades en cola",
    afterQueue: "Después de la cola",
    cancel: "Cancelar",
    cancelling: "Cancelando…",
    refund:
      "Reembolso: {{alloy}} aleación · {{crystal}} cristal · {{deuterium}} Deuterio",
    cancelled:
      "Pedido cancelado · Aleación {{alloy}}, cristal {{crystal}} y deuterio {{deuterium}} devueltos",

    /**
     * THE SECOND BEAT ON A CANCEL. Owner report.
     *
     * The price of cancelling was on a `title` attribute — a hover tooltip, on a
     * phone — so the half that burns was not merely unconfirmed, it was never on
     * screen at all. It leads with what is DESTROYED: a refund figure alone reads
     * as a gain, because the player is being handed resources.
     */
    confirm: {
      eyebrow: "Cancelar un pedido",
      lead: "{{share}}% de lo que costó este pedido se destruye. El resto vuelve ahora.",
      lost: "Destruido",
      kept: "Devuelto",
      progress: "El trabajo realizado también se pierde: un nuevo pedido comienza desde cero.",
      commit: "Cancelar el pedido",
      back: "Guárdalo",
    },
  },

  capacity: {
    hangarBand: "Sala de flota",
    hangarFull: "El hangar está lleno: la sala {{used}} / {{total}} está comprometida. Levanta el Hangar para construir más naves.",
    hullUse:
      "Cada uno utiliza el espacio {{bulk}} · {{used}} / {{total}} comprometidos después de la cola.",
    full: "No hay espacio: {{used}} / {{total}} el espacio ya está comprometido. Eleve primero la capacidad relevante.",
  },

  /** What each structure is for, in one line, where the row states it. */
  roles: {
    vault:
      "Establece cuántas horas de producción propia tiene cada recurso; el 10% inferior, con un límite de 8 horas de producción, está a salvo de redadas.",
    shipyard:
      "Desbloquea cascos más pesados, los construye más rápido y afina cada sonda que envías.",
    refinery:
      "Aumenta la producción de aleación por hora; la almacén se mide en horas, por lo que lo que contiene crece con ella. La mayoría de los edificios y naves gastan esto.",
    extractor:
      "Aumenta la producción de cristales por hora; la almacén se mide en horas, por lo que lo que contiene crece con ella. Los naves, los instrumentos y la investigación avanzados gastan cristal.",
    coreCapped_one:
      "{{count}} La mejora del edificio está bloqueada hasta que se eleve el Núcleo de Mando.",
    coreCapped_other:
      "{{count}} las mejoras del edificio están bloqueadas hasta que se eleve el Núcleo de Mando.",
    coreClear:
      "Núcleo de Mando establece límites de nivel de construcción y acorta el tiempo de construcción e investigación.",
  },

  defend: {
    escapeMinimum: "La retirada táctica requiere al menos {{minimum}} naves de combate aquí · {{count}} de {{minimum}} listas",
    strategicBand: "Defensa estratégica",
    strategicNote:
      "Una carga destruye la siguiente Estrella de la Muerte detectada por el Radar 3 o identificada en la mira del Telescopio. La carga se gasta cuando dispara.",
    /** Taktik geri çekilme: el umbral del propio defensor y el combustible que cuesta. */
    escapeReady:
      "Retirada táctica · un ataque de {{at}}+ de fuego que aniquilaría esta línea no encuentra tus naves · el despegue quema {{fuel}} de Deuterio",
    escapeShort:
      "Retirada táctica · tus naves huirían de un ataque de {{at}}+ de fuego, pero el despegue necesita {{fuel}} de Deuterio y el depósito tiene {{stock}}",
    shieldBand: "Escudo",
    shieldNote:
      "Égida absorbe el daño antes de que llegue a tus unidades y se regenera el 35% de su máximo cada hora.",
    groundBand: "En tierra (la capacidad aumenta según el nivel central)",
    /* The figures moved into `CapacityBar`; the band keeps the RULE. */
    groundNote:
      "Las armas terrestres nunca abandonan el mundo. Las Espinas contrarrestan Baluartes, los Arpones Hostigadores y los Bastiones Lanzas.",
    thornNone:
      "Cañones ligeros con ventaja contra cascos clase Baluarte; vulnerable a los cascos clase Lanza.",
    thornStanding:
      "{{count}} de pie. Fuerte contra cascos clase Baluarte; débil contra cascos clase Lanza.",
    thornGain: "Espinas",
    harpoonNone: "Defensa terrestre Lanza. Fuerte contra Hostigadores y débil contra Baluartes.",
    harpoonStanding: "{{count}} desplegados. Fuerte contra Hostigadores y débil contra Baluartes.",
    harpoonGain: "Arpones",
    bastionNone:
      "Cañones pesados ​​con ventaja contra cascos clase Lanza; vulnerable a los hostigadores.",
    bastionStanding:
      "{{count}} en pie. Fuerte contra cascos clase Lanza; débil contra hostigadores. Después del combate, el 60% de los cañones terrestres destruidos se restauran, redondeando hacia abajo.",
    groundGain: "Unidades terrestres",
    aegisPointer: "Un escudo es hardware: <0>{{name}}</0> está en órbita.",
  },

  orbit: {
    contextLabel: "Red orbital",
    networkBand: "Conexión",
    networkNote:
      "El Uplink gasta un zócalo para desbloquear el telescopio y el radar.",
    intelBand: "Instrumentos planetarios",
    intelNote: "Ganan niveles y nunca consumen una órbita.",
    inOrbitBand: "en orbita",
    inOrbitNote: "Cada uno ocupa un slot. Construidos una vez, no tienen niveles.",
    onPlanetBand: "En el planeta",
    onPlanetNote:
      "No se necesita ranura. Estos tienen niveles: súbelos tanto como te lo permita tu Núcleo de Mando.",
    slotsFree_one: "{{count}} ranura aún libre arriba",
    slotsFree_other: "{{count}} espacios aún libres arriba\nLa órbita",
    slotsNone: "está llena",
    slotsUsed: "{{used}}/{{total}}",
    slotsNext: "+1 en el núcleo L{{level}}",
    rackLabel: "Ranuras de órbita",
    slotEmpty: "Vacío",
    inactiveSatellite:
      "Propiedad, pero inactiva hasta que el Núcleo de Mando vuelva a abrir esta ranura orbital.",
    inactiveUplink:
      "L{{owned}} es propiedad, pero está inactiva hasta que un enlace ascendente esté activo nuevamente.",
    inactiveCore:
      "L{{owned}} propiedad · L{{active}} activo hasta que se restaure el Núcleo de Mando.",
    alreadyInOrbit: "ya en órbita",
  },

  reach: {
    orbitBand: "Satélites de operaciones",
    orbitNote:
      "Una torre de perforación mejora a los prospectores de este mundo; un Beacon acelera sus flotas de incursión y transferencia. Cada satélite utiliza una ranura orbital.",
    family: {
      OFFENSIVE: {
        label: "Cascos ofensivos",
        note: "Los asaltantes compran velocidad y los delanteros compran ataque. Las filas van desde el Nivel 1 al Nivel 4.",
      },
      DEFENSIVE: {
        label: "Cascos defensivos",
        note: "Las fortalezas compran durabilidad con velocidad; los escoltas mantienen un ritmo más rápido. Filas ordenadas por niveles.",
      },
      CARGO: {
        label: "Cascos de carga",
        note: "Los transportes desarmados intercambian la velocidad de la ruta con la capacidad de retención y necesitan escoltas supervivientes.",
      },
      SPECIALIST: {
        label: "Cascos especializados",
        note: "Respuestas estrechas a un problema visible; su prima se desperdicia contra el objetivo equivocado.",
      },
    },
    frontierBand: "Investigación de fronteras",
    frontierNote:
      "La investigación utiliza la cola de todo tu comandante. Construction y Yard siguen funcionando por separado.",
    isotopeName: "Espectrometría de isótopos",
    isotopeTag: "Desbloquea la minería de deuterio",
    isotopeRole:
      "Muestra el deuterio en rocas isotópicas y te permite enviarles buscadores. El botín de regreso ingresa a Obras.",
    denseName: "Pilas de combustible densas",
    denseTag: "Desbloquea el corredor",
    denseRole:
      "Para revelarlo, llena tu carga en una incursión mientras el botín permanece en el objetivo. El Runner es más rápido que un Hauler pero lleva menos.",
    graviticName: "Cargas Gravíticas",
    graviticTag: "Desbloquea al infractor",
    graviticRole:
      "Para desbloquearlo, ataca un mundo defendido con una Égida activa; el escudo debe absorber al menos {{share}} de tu daño. Una sola Avispa puede calificar; no necesitas ganar. El Breacher golpea los escudos cinco veces más fuerte.",
    gridName: "Cuadrícula de intercepción",
    gridTag: "Derriba una Estrella de la Muerte",
    gridRole:
      "Una carga cargada destruye la próxima Estrella de la Muerte detectada por el Radar 3 o identificada en la mira del Telescopio · requiere un enlace ascendente",
    stockpileName: "Reserva estratégica",
    stockpileTag: "Mantén una segunda arma en la plataforma.",
    stockpileRole:
      "Una segunda Estrella de la Muerte, construida después de la primera · la espera no ha cambiado",
    waspDoctrineName: "Doctrina Avispa",
    lanceDoctrineName: "Doctrina Lanza/Breacher",
    bulwarkDoctrineName: "Doctrina Baluarte",
    groundDoctrineName: "Doctrina de Emplazamiento",
    generalName: "Armas y armaduras",
    generalTag: "Mejora todos los cascos que posees",
    doctrineTag: "Mejor ataque y armadura.",
    doctrineRole:
      "Las bonificaciones generales y de clase se acumulan, pero su multiplicador de combate combinado tiene un límite del 25 %. Los contadores de clases siguen siendo la mayor ventaja.",
    yardName: "Automatización de astilleros",
    yardTag: "Construye naves más rápido",
    yardRole:
      "Reduce el tiempo de construcción de cada casco · El Astillero aún marca la curva",
    holdsName: "Retenciones del prospector",
    holdsTag: "Las naves mineras llevan más",
    holdsRole: "Aumenta cada bodega de Prospector y se multiplica con la bonificación de capacidad x2 de la torre de perforación.",
    cargoName: "Bodegas de carga",
    cargoTag: "Cada bodega lleva más",
    cargoRole: "Aumenta el botín de incursiones, las transferencias mundiales y los convoyes comerciales por igual",
    synthesisName: "Síntesis de deuterio",
    synthesisTag: "Eleva el techo de la Refinería",
    synthesisRole:
      "Cada peldaño abre tres niveles más de Refinería de Deuterio en cada mundo que tengas",
    researchNeedCore: "Elevar el núcleo de comando a L{{level}}",
    researchAct: "Investigación",
    researchComplete: "investigado",
    researchAt: "Investigable en {{duration}}",
    researchIsotopeFirst: "Primero investiga la espectrometría de isótopos",
    researchDenseFirst: "Investiga primero las pilas de combustible densas",
    researchGraviticFirst: "Investiga primero las cargas gravíticas",
    researchWarAt: "El acto de guerra se abre en {{duration}}",
    researchCargoInsight: "Llena tu carga en una incursión mientras quede el botín",
    researchShieldInsight:
      "Haz que una Égida absorba al menos {{share}} del daño de tu banda.",
    warshipsBand: "Buques de guerra",
    warshipsNote: "Estos cascos atacan y defienden. Los enfrentamientos de clases determinan a qué objetivos contrarrestan.",
    supportBand: "Soporte",
    supportNote:
      "Los transportistas y corredores realizan incursiones o transfieren carga, pero no pueden atacar. Permanecen protegidos sólo mientras sobreviven los cascos de combate.",
    miningBand: "Minería",
    miningNote: "Los buscadores viajan solo a asteroides o campos de escombros revelados y devuelven su botín a las Obras.",
    ownedGain: "Tienes",
    hullAwayCount: "{{count}} de distancia",
    hullLocationCounts: "{{home}} entra · {{away}} sale",
    hullTier: "Nivel{{tier}}",
    prospectorLimit: "{{owned}} / {{max}} · límite",
  },

  grow: {
    multiplierBand: "Satélite de producción",
    multiplierNote:
      "La Fundición aumenta la producción de aleaciones, cristales y deuterio de este mundo en un 6% y consume un zócalo en la red de órbita compartida.",
  },

  projectSheet: {
    frontier: "Investigación de fronteras",
    complete: "Investigación completa",
    cost: "Costo de investigación",
    once: "Se coloca una vez en la cola de investigación de todo comandante.",
  },

  /** Why a row cannot be pressed yet. Each is a door, so each names its fix. */
  blocked: {
    core: "Núcleo L{{level}}",
    uplink: "un enlace ascendente en órbita",
    orbitSlot: "un espacio orbital libre",
    shipyard: "Astillero L{{level}}",
    research: "{{research}} {{level}}",
    requirements: "Requiere: {{requirements}}",
    maxed: "en su nivel más alto",
    /** The one building with a second ceiling: its research rung. T5. */
    plantRung: "Investiga otro peldaño de la síntesis de deuterio",
    queueFull: "Ya hay 3 pedidos esperando. Termine o cancele uno para agregar esto.",
  },

  /** What a purchase says once it has landed. */
  done: {
    raised: "{{name}} ahora es L{{level}}",
    instrument: "{{name}} en línea en L{{level}}",
    satellite: "{{name}} está en órbita",
    built: "{{count}} × {{name}} construido",
    researched: "{{name}} completo",
    queued: "{{name}} L{{level}} en cola",
    queuedSimple: "{{name}} en cola",
    unitsQueued: "{{count}} × {{name}} en cola",
  },

  buildSheet: {
    eyebrowGround: "Defensa terrestre · nunca sale",
    eyebrowMobile: "Casco móvil",
    howMany: "¿Cuantos",
    fewer: "Menos {{name}}",
    more: "Más {{name}}",
    quantity: "{{name}} cantidad",
    max: "Máximo {{name}}",
    maxShort: "Máximo",
    /* The way back down from Max, in one press. */
    reset: "Restablecer el recuento de {{name}}",
    resetShort: "Restablecer",
    build: "Construir {{count}}",
    capped:
      "Ya tienes {{count}}: el límite. Las naves que están fuera todavía cuentan, por lo que no puedes construir otra.",
    heldOfMax: "{{owned}} de {{max}} retenido. Los que están fuera también cuentan.",
    defenceAfter: "Defensa local cuando esté completa: {{count}} unidades",
    maxOf: 'Máx · {{value}}',
    byPurse: 'hasta donde llegan tus recursos',
    byHangar: 'hasta donde cabe en el hangar',
    byGround: 'hasta donde cabe en tierra',
    byBerth: 'hasta donde permiten tus amarres',
    cycle: 'Ciclo de clases',
    yardFill: 'Cola del astillero {{used}}/{{total}}',
    standing: '{{value}} instalados',
  },
} as const;

/** The ladder behind one row: what this thing becomes. */
export const itemSheet = {
  eyebrowNotInOrbit: "No en órbita",
  eyebrowInOrbit: "En órbita",
  eyebrowNotInstalled: "No instalado",
  eyebrowLevel: "Nivel {{level}}",
  actPutInOrbit: "Poner en órbita",
  actAlreadyInOrbit: "Ya en órbita",
  actInstall: "Instalar",
  actRaise: "Subir a L{{level}}",
  lockedNote: "Bloqueado: necesita {{reason}}.",
  howItWorks: "Cómo funciona",
  ladderHeading: "Lo que compra cada nivel",
  rungLevel: "L{{level}}",
  nextLook: "Nuevo aspecto en L{{level}}",
  queueFill: "Cola de obras {{used}}/{{total}}",
  affordIn: "Suficiente en ~{{duration}}",
  short: "Recursos insuficientes",
  orbitalDoesHeading: "Qué hace",
  orbitalOnce: "Se compra una vez; nunca se mejora",
  orbitalFree: "{{free}} de {{total}} libres",
  slotHeading: "Ranura orbital",
  slotAfter_one: "Ocupa la ranura punteada; queda {{count}} libre.",
  slotAfter_other: "Ocupa la ranura punteada; quedan {{count}} libres.",
  nextSlotCore: "El Núcleo de comando {{level}} abre otra.",
  orbitalNoSlot: "No hay ranura libre: el Núcleo de comando {{level}} abre la siguiente",
  orbitalNoSlotMax: "No hay ranura libre: todas las que abre el Núcleo de comando están ocupadas",
} as const;

/** The row. One decision, presented as a decision. */
export const upgradeRow = {
  about: "Acerca de {{name}}",
  nextTierAlt: "{{name}} en el siguiente nivel",
  becomes: "se convierte en",
  /** Where a ladder ends, so one rung of it can be judged against the whole. */
  ceiling: "de {{value}}",
  affordableIn: "Asequible en <0>{{duration}}</0> a tu tarifa actual",
  /**
   * HOW LONG THE WORK ITSELF TAKES — a different clock from `affordableIn`.
   *
   * That one is a property of the wallet and only ever appeared when the player
   * was SHORT; this is a property of the item and shows whether or not they can
   * pay. A commander who can already afford a Citadel used to get no clock at all,
   * which is precisely when the wait is the only thing left to decide.
   */
  takes: "{{duration}}",
  takesLabel: "Toma {{duration}} para construir",
  /** A row whose level has a top: research ladders are the only ones so far. T12. */
  ladder: "L{{level}} / {{max}}",
} as const;

/** The control at the right-hand edge of every row. */
export const action = {
  verbRaise: "Subir",
  verbBuild: "Construir",
  verbInstall: "Instalar",
  verbClaim: "Recoger",
  verbSend: "Enviar",
  short: "Corto",
  shortfallAlloy: "{{amount}} más aleación",
  shortfallCrystal: "{{amount}} más cristal",
  shortfallDeuterium: "{{amount}} más Deuterio",
  shortfallJoin: "y",
  shortfallLabel: "Corto: necesita {{parts}}",
  statAttack: "Ataque",
  statHull: "Durabilidad",
  statSpeed: "Velocidad",
  statSpeedFixed: "arreglado",
  statCargo: "Carga",
  statCargoNone: "—",
  /** What a Garbage Collector lifts off its battle's wreck. It takes the Cargo cell. D200. */
  statSalvage: "Salvamento",
  statRoom: "A granel",
  statFuel: "Combustible",
  /** The rate carries its own span: the row form of the strip prints no labels. */
  statFuelRate: "{{value}} /1k",
  statFuelNone: "—",
} as const;

/** The portrait and the three verdicts at the top of your own planet. */
export const planetHero = {
  capital: "Capital mundial",
  colony: "Mundo colonial",
  /**
   * THE WORLD'S OWN TIER, UNDER ITS PORTRAIT. Owner report.
   *
   * The figure the whole galaxy is sorted by — the disc draws a world's size
   * from it, every dossier states it, and since D168 it decides who a commander
   * may fight. It was on screen everywhere EXCEPT a commander's own worlds.
   */
  tier: "Nivel {{tier}}",
  /** The one force unit, on the one world the commander knows exactly. D199. */
  firepower: "Potencia de fuego",
  perHourSuffix: "/h",
  /** E5: the orbit line under the world — "Orbit 1/2 · +1 at Core L15". */
  orbit: "Órbita",
  disrupted: "Producción detenida · allanada · {{countdown}}",
  defence: "Defensa",
  defenceNone: "Ninguno",
  defenceShips_one: "{{count}} nave",
  defenceShips_other: "{{count}} naves",
  defenceGuns_one: "{{count}} pistola",
  defenceGuns_other: "{{count}} pistolas",
  defenceUnarmed_one: "{{count}} transporte en la línea",
  defenceUnarmed_other: "{{count}} transportes en la línea",
  fleetAway: "{{count}} en el aire",
  shield: "Escudo",
  shieldNone: "Ninguno",
  shieldNoAegis: "sin Aegis",
  shieldOffline: "Sin conexión",
  shieldCoreOffline: "Interrupción del núcleo de comando · Égida está oscuro",
  defenceCoreOffline: "Cañones terrestres fuera de línea · interrupción del núcleo de comando",
  shieldValue: "{{current}} / {{max}}",
  shieldMeter: "Carga de escudo Égida",
  shieldRegen: "+{{amount}}/h · antes de unidades",
  vaultSafe: "A salvo en la bóveda",
  storeLabel: "Almacenar",
  storeRule: "El nivel de Almacén establece la longitud de estas barras; el soporte debajo del escudo está a salvo de un ataque.",
  alloyStore: "{{held}} de aleación {{cap}}, {{safe}} protegido",
  crystalStore: "{{held}} de cristal {{cap}}, {{safe}} protegido",
  deuteriumStore: "{{held}} de {{cap}} deuterio, {{safe}} protegido",
  alloySafe: "{{amount}} aleación segura",
  crystalSafe: "{{amount}} caja fuerte de cristal",
  deuteriumSafe: "{{amount}} deuterio seguro",
  atRisk: "En riesgo",
  atRiskValue: "{{amount}} expuesto",
  /** E5 production row: how full the store is, and the part the Vault keeps from a raid. */
  storeShare: "almacén {{pct}}\u00a0%",
  safeShare: "a salvo {{pct}}\u00a0%",
  storeFull: "almacén lleno",
} as const;

/** The commitment. Everything here is supporting detail for one line. */
export const launch = {
  /** When the world is covered again, under the exposure: the mock's "Dönüş 23:06". */
  fuel: "Combustible",
  eyebrow: "Ataque",
  /**
   * THE EYEBROW OF A COMMITMENT AGAINST A RECORD. D151.
   *
   * This sheet is where a fleet stops being recallable, and it named only the
   * action. A target under a live Telescope and a target last seen three days ago
   * opened the identical screen, so the age of the thing being bet on — which the
   * dossier had stamped on every fact row for two releases — was absent from the
   * one surface where it decides anything.
   */
  lastSeen: "visto por última vez {{age}}",
  /**
   * A PIRATE'S CREW AND ORBIT ARE CURRENT even after Telescope discovery is
   * remembered. The urgent clock is how long the target will still be out there.
   */
  goneIn: "desaparecido {{duration}}",
  back: "Atrás",
  launching: "Lanzando",
  commit: "Lanzamiento: sin recuperación",
  /** A raid on a world, which may be turned once while it flies (K8); a pirate raid keeps `commit`. */
  commitWorld: "Lanzar",
  /** B14: the held commit, and the price line under the ships (K8: a world raid turns). */
  holdWorld_one: "Lanzar {{count}} nave",
  holdWorld_other: "Lanzar {{count}} naves",
  holdPirate_one: "Lanzar {{count}} nave — sin recuperación",
  holdPirate_other: "Lanzar {{count}} naves — sin recuperación",
  warningWorld: "{{world}} queda débil durante {{duration}}, hasta que vuelva esta flota.",
  warningPirate: "Sin recuperación. {{world}} queda débil durante {{duration}}, hasta que vuelva esta flota.",
  recallNote:
    "Se puede recuperar una vez en vuelo: vuelve en el tiempo que ya ha volado. El combustible no se reembolsa.",
  chooseFleet: "Elige una flota",
  send: "Enviar naves {{count}}",
  launched: "Lanzado. Expuesto para la tenencia de unidades {{duration}} · {{count}}.",
  whileAway: "Mientras esta flota está fuera",
  defending: "{{count}} unidades defendiendo casa",
  nothingSent: "Aún no se ha enviado nada",
  exposedFor: "Expuesto para {{duration}}",
  oneWayUnknown: "—",
  pace: "Velocidad de vuelo",
  paceHint: "Más lento llega más tarde. El combustible es el mismo y nada permanece más de 12 h en vuelo.",
  paceFull: "Total",
  /* The five reasons this commitment can be refused, each stated on the button. */
  noBay: "Ninguna bahía de vuelo libre",
  noFuel: "No hay suficiente deuterio",
  tooLate: "Se irá primero",
  /** Nothing standing at this world is fast enough to catch it. */
  unreachable: "Nada aquí puede atraparlo",
  /** Something could — just not the slowest ship in this selection. */
  tooSlow: "Deja atrás los naves lentos",
  /** A raid at a world has to be able to shoot back. The server refuses this too. */
  noEscort: "Añadir un buque de guerra",
  shipyardRevolt: "Revuelta en el astillero",
  cargo: "Carga",
  /** A ceiling on a wreck nobody has made yet, and only for collectors that live. D200. */
  salvage: "Tus recolectores levantan hasta {{amount}} de los restos del naufragio si sobreviven.",
  atHome: "{{count}} en casa",
  away: "{{fleet}} de distancia en un vuelo. Sólo se pueden enviar naves que se encuentren en este mundo.",
  awaySeparator: " · ",
  awayHull: "{{count}} {{name}}",
  fewer: "Menos {{name}}",
  more: "Más {{name}}",
  quantity: "{{name}} cantidad",
  max: "Máximo {{name}}",
  maxShort: "Máximo",
  noShips:
    "No hay naves en casa. Construye algunos en el astillero o espera a que regrese una flota.",
  warning:
    "Esto no se puede recuperar. Una vez que se va, la única forma de descubrir qué había allí abajo es verlo aterrizar, y tu planeta retiene {{count}} unidades hasta que regresa.",
  /**
   * WHAT A RAID COSTS THE COMMANDER FOR THE REST OF THE DAY. D183.
   *
   * One sentence beside the exposure warning, because the two are halves of one
   * price. It says what is spent and what that opens — not how the rule works,
   * which is the sheet's own shape rather than a paragraph's job.
   */
  shieldWarning:
    "Esto renuncia a tu escudo del primer día. Una vez que desaparezca, otros comandantes también podrán atacarte.",
  /** The same price, on the window a heavy defeat bought rather than on the first day. */
  recoveryShieldWarning:
    "Esto renuncia a tu escudo de recuperación y su +50% de producción. Una vez que desaparezca, otros comandantes también podrán atacarte.",
  fleetsave: "Los naves en vuelo no pueden ser asaltados. Tu planeta puede.",
  range: "distancia {{d}}",
  arrive: "Llegada",
  homeLabel: "Regreso",
  exposedShort: "expuesto {{duration}}",
  lootSub: "botín ~{{band}}",
  bay: "Plataforma",
  bayThis: "este ocupa 1",
  bayNone: "ninguna libre",
  stays: "Se queda",
  staysUnits_one: "{{count}} unidad",
  staysUnits_other: "{{count}} unidades",
  staysPower: "poder {{value}}",
  cargoEach: "{{amount}} de carga c/u",
  cargoAdds: "+{{amount}} de carga",
  paceBrief: "mismo combustible · máx. 12 h",
  warningWorldOpen: "{{world}} queda débil hasta que vuelva esta flota.",
  warningPirateOpen: "Sin recuperación. {{world}} queda débil hasta que vuelva esta flota.",
} as const;

export const transfer = {
  /** What the flight burns, beside the figure. T6. */
  fuel: "combustible para el vuelo",
  cooldown: "Descargando: quedan {{duration}}",
  homewardFuel: "Media tarifa: entre tus propios mundos. Un ataque paga completo.",
  /** Under the pace rungs: what a slower TRANSFER buys — time in the air. */
  paceHint: "Más lento llega más tarde: las naves en vuelo no pueden ser saqueadas. Mismo combustible; nada permanece más de 12 h en vuelo.",
  fuelShort: "corto {{short}}",
  eyebrow: "Transferencia mundial",
  returnEta: "Regreso al origen en {{duration}} · {{time}}",
  eta: "ETA",
  capacity: "Carga",
  fleet: "Nave",
  homeDefence: "{{ships}} nave permanece en origen · {{power}} potencia de fuego",
  afterDelivery: "Después de la entrega",
  cargoShips: "Cargueros",
  otherShips: "Otras naves",
  stay: "Quedarse allí",
  return: "Regresar",
  returnHint: "Las naves que regresan descargan primero. El combustible de regreso se paga ahora.",
  cargo: "Recursos",
  alloy: "Aleación",
  crystal: "Cristal",
  deuterium: "Deuterio",
  commit: "Transferir",
  /** B14: what stops a transfer, on the held commit rather than a grey button. */
  noRoom: "No hay sitio en el Hangar de destino",
  overLoad: "Más de lo que cabe en la bodega",
  sending: "Despacho",
  launched: "Transferencia iniciada · {{duration}}",
  /** The recall rule and the two limits on what moves. Faz 2A.4 made "one way" false. */
  rules: "Se puede recuperar una vez en vuelo. La defensa terrestre no se mueve; cualquier nave con bodega puede llevar recursos.",
  hullNone: "Ninguno en este mundo",
  holdReady: "Las naves seleccionadas llevan recursos. Bodega: {{capacity}}.",
  destinationLabel: "Hangar de destino",
  holdNeedsLoad: "Selecciona arriba una nave con bodega para llevar recursos.",
  holdNoCarrier: "Este mundo no tiene naves con bodega.",
  /** Caption on the destination's room bar, which draws the figures itself. */
  /** Screen-reader sentence for the pips beside a hull. */
  hullPacked: "{{packed}} de {{held}} {{name}} empaquetado",
  /** Caption on a cargo slider's spend bar: what this transfer takes. */
  cargoSending: "Enviando",
} as const;

/**
 * THE CAPACITY CARD. Owner instruction: the design explains itself and the words
 * are captions on shapes that have already made the point.
 */
export const capacity = {
  fit: "caben más",
  full: "LLENO",
  /* The two ends of a room card's bar, each under the part it describes. */
  used: "usado",
  free: "libre",
  /** Screen-reader only: the bar is a picture, and a picture needs a sentence. */
  reading: "{{used}} de {{total}} utilizado",
} as const;

/**
 * KOLONİ ARIZALARI — what broke, what it is taking, and what putting it right costs.
 *
 * THE VOICE IS THE FACT, NOT THE ALARM. Every one of these sentences names a thing that
 * has STOPPED and says what that stops; none of them says "warning" or "critical". A
 * colony breaking down is an ordinary part of holding three worlds, and copy that
 * shouted would either train the player to ignore it or make four broken things feel
 * like a catastrophe when they are a Tuesday.
 */
export const faults = {
  title: "Fallos",
  mark: "Fallo presente",
  launchBlock: {
    SHIPYARD_REVOLT: "Revuelta en los astilleros: nada puede lanzarse",
    PROSPECTOR_FAULT: "El centro del prospector está inactivo",
  },
  /** The strip under the build queues, and the row it collapses to when idle. */
  strip: {
    title: "Reparaciones",
    capacity: "{{count}} tripulaciones",
    priceAlloy: "{{alloy}} aleación",
    priceBoth: "{{alloy}} aleación · {{crystal}} cristal",
    lane: "Equipo {{slot}}",
  },
  tab: "Algo aquí está roto",
  /** One line per fault: the name a player sees on the row and the sheet. */
  name: {
    REFINERY_OUTAGE: "Apagón de refinería de aleación",
    EXTRACTOR_OUTAGE: "Apagón extractor de cristal",
    PLANT_OUTAGE: "Apagón en la refinería de deuterio",
    VAULT_LEAK: "Fuga de bóveda",
    CORE_OUTAGE: "Apagón del núcleo de comando",
    TELESCOPE_FAULT: "Fallo del telescopio",
    SHIPYARD_REVOLT: "Revuelta en el astillero",
    PROSPECTOR_FAULT: "Prospección en pozo",
  },
  /** What it stops, in the player's terms. One sentence, no hedging. */
  stopped: {
    REFINERY_OUTAGE: "La refinería está a oscuras. Este mundo no está haciendo ninguna aleación en absoluto.",
    EXTRACTOR_OUTAGE: "El extractor está oscuro. Este mundo no fabrica ningún cristal.",
    PLANT_OUTAGE: "La planta está oscura. Este mundo no produce deuterio en absoluto.",
    VAULT_LEAK: "La bóveda está entrando en órbita, y cualquiera cuyo telescopio llegue a este mundo puede ver el campo y volar hacia él.",
    CORE_OUTAGE: "El núcleo está oscuro: la égida está caída y los cañones terrestres no tienen control de fuego. Los naves en casa todavía luchan. Si alguien aterriza ahora, aterrizará en un mundo abierto.",
    TELESCOPE_FAULT: "El telescopio está ciego. Este mundo no ve más allá del ojo desnudo hasta que sea reparado.",
    SHIPYARD_REVOLT: "El astillero se ha retirado. Nada sale de este mundo: ni incursiones, ni transferencias, ni convoyes. Las naves que ya están en el aire todavía regresan a casa.",
    PROSPECTOR_FAULT: "El foso está cerrado. No se puede enviar ningún Prospector desde este mundo. Las naves que ya están disponibles todavía se pueden recuperar.",
  },
  toll: {
    title: "Lo que está tardando",
    alloy: "{{amount}} aleación por hora, sin fabricar",
    crystal: "{{amount}} cristal por hora, sin fabricar",
    deuterium: "Cada hora de deuterio que este mundo habría producido",
    leak: "{{amount}} una hora entrando en órbita, donde cualquiera que pueda ver este mundo puede volar y tomarlo.",
  },
  loyalty: {
    title: "La lealtad de este mundo",
    battleLoss: "Derrota parcial −15 · derrota decisiva −30",
    line: "{{value}}%: cae mientras {{count}} las cosas están rotas. A este ritmo llega a cero en {{time}} y la colonia se declara independiente.",
    bar: "Lealtad {{value}}%",
    left: "Quedan {{time}}",
  },
  price: {
    title: "La reparación",
    crew: "la tripulación",
    parts: "piezas",
    takes: "Tarda entre 5 y 15 minutos. La tripulación fija sus propios horarios cuando la contratan.",
  },
  repair: "Enviar un equipo",
  running: "Hay un equipo en él · {{time}}",
  noCancel: "Una vez que un equipo sale, no se les puede llamar para que regresen.",
  lanesFull: "Todos los equipos {{count}} están fuera",
  started: "Una tripulación está en camino.",
  failed: "Eso no se pudo iniciar.",
} as const;
