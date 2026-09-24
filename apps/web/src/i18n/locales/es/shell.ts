/**
 * THE CHROME THAT NEVER LEAVES — the header, the in-flight strip, Signals, and
 * the furniture every surface is built out of.
 */

export const statusBar = {
  activeWorld: 'Mundo activo',
  capitalWorld: 'CAPITAL · {{name}}',
  colonyWorld: 'COLONIA · {{name}}',
  alloyLabel: 'Aleación',
  crystalLabel: 'Cristal',
  deuteriumLabel: 'Deuterio',
  /** The store's ceiling, stated as space. */
  storeFull: 'LLENO',
  storeFree: '{{amount}} libres',
  /**
   * THE MENU CONTROL. Owner decision: the header's right-hand end had grown to
   * three controls plus a beacon and had run out of room for a fourth.
   *
   * It says what is behind it rather than saying "menu", because D54's bug was a
   * control labelled as something other than what it opened.
   */
  /*
    IT NAMES WHAT IS ACTUALLY BEHIND IT, and it used to promise Intel — which
    moved onto the disc with research and the clan. A control whose name lists a
    surface it cannot reach is D54's bug wearing an accessible name instead of a
    face, and this string is what a screen reader and the screenshot harness read.
    The four groups the sheet is built from, in the order it draws them.
  */
  menuHint: 'Comandante {{name}}: clasificación, recompensas, anuncios, ayuda y cuenta',
  menuWaiting: '{{count}} recompensas en espera',
  clanWaiting: '{{count}} novedades del clan pendientes',
  newcomerShield: {
    hint: 'No puedes ser atacado por {{duration}}',
  },
  recoveryShield: {
    hint: 'Escudo de recuperación: no puedes ser atacado por {{duration}}',
  },
  recoveryBoost: {
    mark: 'Producción +50 %',
    note: 'Producción un 50 % mayor mientras dure la protección',
  },
  bays: {
    hint: '{{used}} de {{total}} plataformas de lanzamiento ocupadas',
    label: 'Plataformas',
    free: '{{count}} libres',
  },
  works: {
    label: 'Depósito de producción',
    labelFull: 'Depósito de producción lleno',
    collect: 'Recoger',
    fullStopped: 'Lleno — producción detenida',
    fillsIn: 'lleno en {{time}}',
    gathers: 'La producción se acumula aquí hasta que la recojas',
    idle: '—',
    hintFull: 'El depósito de producción está lleno: recoge los recursos',
    hintCollect: 'Recoger {{amount}}',
    /** Each waiting resource by name, in the bubble's accessible name (owner, 2026-09-24). */
    alloy: '{{amount}} aleación',
    crystal: '{{amount}} cristal',
    deuterium: '{{amount}} deuterio',
    collected: '{{amount}} recogidos',
    collectedPartly: '{{moved}} recogidos · No había sitio para {{held}}',
    storeFull: 'Almacén lleno',
  },
} as const;

export const pendingStrip = {
  empty: 'Nada en vuelo',
  openFlights: 'Vuelos abiertos',
  sheetEyebrow: 'Tus vuelos',
  sheetTitle: 'En vuelo',
  sheetEmpty: 'Aún no hay nada en el aire.',
  incoming: 'Flota entrante',
  /**
   * AND WHICH WORLD IT IS COMING FOR. Not a radar product — it is your own world.
   * With four of them, "inbound fleet · 6 min" does not say where to move.
   */
  incomingAt: 'Entrante → {{world}}',
  incomingFromAt: 'Entrante → {{world}} · desde {{origin}}',
  probe: 'Tu sonda → {{target}}',
  deathStar: 'Tu estrella de la muerte → {{target}}',
  settlement: 'Colonización → {{target}}',
  transfer: 'Traslado → {{target}}',
  pirateOut: 'Incursión → {{target}}',
  pirateHome: 'Incursión que regresa · {{target}}',
  /*
    THE MERCHANT IS NAMED HERE, NOT ON THE SERVER. D156.

    A `trade` thread carries the event-kind identifier `TRADE_SHIP` and no world,
    because there is no world on the far end and the server has never written
    user-facing copy. Without these two lines the strip printed that identifier.
  */
  tradeOut: 'Convoy → Nave comercial',
  tradeHome: 'Convoy regresando · Nave comercial',
  intergalacticConvoyOut: 'Ataque → Convoy intergaláctico',
  intergalacticConvoyHome: 'Vuelve el ataque · Convoy intergaláctico',
  fleetHome: 'Tu flota regresa de {{target}}',
  fleetOut: 'Tu flota → {{target}}',
  engaging: 'En combate',
  more: '+{{count}}',
  drillOut: 'Tus Prospector → asteroide',
  drillHome: 'Tus Prospector regresan',
  salvageOut: 'Tus Prospector → restos',
  drillCount: '{{count}} Prospectores',
  recallProspectors: 'Llamar de vuelta a los Prospector',
  recallFleet: "Retirar la flota",
  recallingFleet: "Retirando",
  recallFleetStarted: "Vuelve a casa: tardará lo mismo que ya ha volado.",
  recallingProspectors: 'Llamando de vuelta…',
  recallStarted: 'Los Prospector han dado la vuelta y regresan',
  craftCount: '{{count}} nave',
  craftUnknown: 'No se conocen los tipos de nave',
  incomingHint: 'Advertencia de entrada · origen oculto por la niebla',
  /**
   * THE SAME WARNING, WHEN THE CRAFT IS ON YOUR DISC. D162.
   *
   * The origin is still unsold — that is the top of the radar ladder — but saying
   * "hidden by fog" over a fleet the commander can watch crossing their own circle
   * reads as the interface disagreeing with the picture.
   */
  incomingVisible: 'Advertencia entrante · en tus sensores: toca para ver',
  /**
   * THE RADAR LADDER, FINALLY WORTH CLIMBING. D123.
   *
   * L3 is the warning. L4 adds the size, which is what turns "something is coming"
   * into a choice between spending the stock, flying the fleet out and standing.
   * L5 names the world it left, and a named world is what a warning has to become
   * before it is a grudge.
   */
  incomingFrom: 'Entrante desde {{origin}}',
  massLight: 'Flota pequeña entrante',
  massMedium: 'Flota mediana entrante',
  massHeavy: 'Flota grande entrante',
} as const;

export const signals = {
  beacon: 'Señales',
  beaconUnread: 'Señales: {{count}} no leídas',
  title: 'Señales',
  eyebrowUnread: '{{count}} nuevo',
  eyebrowRead: 'Todo lo que te han dicho',
  statusHeading: 'Ahora mismo',
  eventsHeading: '¿Qué pasó?',
  openEvent: 'Abrir informe relacionado',
  /** The eyebrow on a galaxy-wide row, so it is never mistaken for personal news. */
  worldEvent: 'Evento de galaxia',
  empty:
    'Nada todavía. La galaxia te avisa cuando una flota se mueve contra ti, cuando una sonda es capturada y cuando tus propias naves regresan a casa.',
  repeat: '×{{count}}',

  /** The states that are true right now, rather than things that happened. */
  status: {
    disruptedLine: 'Tus obras están fuera de línea',
    disruptedDetail: 'Asaltado. La producción se reanuda en {{duration}}.',
    worksStoppedLine: 'Las obras se han parado',
    worksStoppedDetail: 'El depósito de producción está lleno. La producción de {{amount}} por hora se detiene hasta que recojas los recursos.',
    alloyStoreLine: 'El almacén de aleaciones está lleno',
    crystalStoreLine: 'El almacén de cristal está lleno',
    storeDetail: 'Hay {{amount}} en producción sin espacio para almacenarlos. Gasta algunos recursos.',
  },
} as const;

/** The bottom sheet every decision is made from. */
export const sheet = {
  /*
    A SHEET OPENED FROM THE MENU HAS SOMEWHERE TO GO BACK TO, and that is a
    different word from "close". See `Sheet`'s own note.
  */
  back: 'Atrás',
  close: 'Cerrar',
  dismiss: 'Cerrar',
} as const;

export const toast = {
  dismiss: 'Descartar mensaje',
} as const;

/** Loading, failure and emptiness, wherever a whole surface is in one of them. */
export const surface = {
  unreachable: 'No se pudo acceder a {{what}}.',
  retry: 'Inténtalo de nuevo',
  /** What each caller of `Unreachable` is naming. */
  whatPlanet: 'tu planeta',
  whatIntel: 'lo que sabes',
  whatReports: 'tus informes de batalla',
  whatRewards: 'tus recompensas',
  whatLeaderboard: 'la clasificación',
  whatChat: 'el chat de la galaxia',
  whatChronicle: 'la crónica de la galaxia',
  whatAnnouncements: 'los anuncios',
  whatAdminFeedback: 'las opiniones de los jugadores',
  waitingPlanet: 'Cargando el planeta',
  waitingIntel: 'Cargando inteligencia',
  waitingLeaderboard: 'Clasificación de la galaxia',
  waitingChat: 'Abriendo chat de galaxias',
  waitingChronicle: 'Leyendo la galaxia',
  /** The generated crest a world wears. One element, used on two surfaces. */
  planetSigil: 'Planeta',
} as const;

/**
 * THE MENU — one way in to everything that is not the galaxy.
 *
 * Every string here is its own, including the ones that read like a label
 * somewhere else: the row that opens Intel is not the header button that used to,
 * and the day one of them is reworded the other must not move with it.
 */
export const menu = {
  /* The card the Commander page opens on: who, where, and how you stand (owner, 2026-09-24). */
  profile: {
    label: 'Tu comandante',
    noClan: 'Sin clan',
    seasonDay: 'Día {{day}} de la temporada',
    rank: 'Puesto',
    worlds: 'Mundos',
    shield: 'Escudo',
    shieldNone: 'Ninguno',
  },
  eyebrow: 'Comandante',
  /*
    THE GROUP NAMES. Four words doing the work nine identical rows could not: a
    reader should be able to tell WITHOUT reading the rows that the leaderboard
    and the sound slider are different kinds of thing.
  */
  seasonHeading: 'Esta temporada',
  asteraHeading: 'Equipo Astera',
  helpHeading: 'Ayuda',
  deviceHeading: 'Este dispositivo',
  marksHeading: 'Tus logros',
  intelLabel: 'Inteligencia',
  intelHint: 'Telescopio, sondas, radar e informes de batalla',
  rewardsLabel: 'Recompensas',
  rewardsHint: 'Las recompensas que has ganado en la galaxia',
  /*
    The hint is this row's accessible name (see `MenuRow`), so it says what the
    page IS. It no longer promises a new tab, because the row no longer opens
    one — a hint that describes the old behaviour is worse than none.
  */
  guideLabel: 'Inicio rápido',
  guideHint: 'Tus primeros pasos, explicados por orden',
  rewardsWaiting: '{{count}} listo',
  /** T12: research is a commander's, not a world's, so its way in is here. */
  researchLabel: 'Investigación',
  researchHint: 'Quince proyectos que mejoran todos tus mundos',
  leaderboardLabel: 'Tabla de clasificación',
  leaderboardHint: 'Cada comandante clasificado por Dominio',
  announcementsLabel: 'Anuncios',
  announcementsHint: 'Noticias, actualizaciones y notas del equipo de Astera.',
  announcementsWaiting: '{{count}} nuevo',
  feedbackLabel: 'Opiniones',
  feedbackHint: 'Cuéntale al equipo un error, una idea o algo que te haya gustado',
  skinsShopLabel: 'Comercio',
  skinsShopHint: 'Explora el aspecto del planeta en 3D',
  skinsInventoryLabel: 'Inventario',
  skinsInventoryHint: 'Equipa máscaras en tus mundos.',
  clanLabel: 'Clan',
  clanHint: 'Encuentra una tripulación de cinco asientos o encuentra la tuya propia\nClan',
  clanMemberLabel: '· [{{tag}}]',
  clanMemberHint: 'Tripulación, ayuda, botín compartido y chat privado',
  clanWaiting: '{{count}} esperando',
  rivalLabel: 'Rival · {{commander}}',
  rivalHint: 'Concéntrate en {{planet}} y elige tu próximo movimiento.',
  rivalLostLabel: 'Se perdió la señal rival',
  /** The chip's own face. The sentence above is still its accessible name. */
  rivalLostShort: 'Marca perdida',
  rivalLostHint: 'Ese mundo se ha ido. Limpia el marcador.',
  rivalCleared: 'Se borró el marcador de rival perdido.',
  accountHeading: 'Cuenta',
  soundLabel: 'Sonido',
  soundOn: 'La partitura está sonando.',
  soundOff: 'Silenciado en este dispositivo.',
  volumeLabel: 'Volumen de música',
  volumeValue: '{{volume}}%',
  /**
   * WHICH OF THE NINE IS SOUNDING. The count is part of the label on purpose: "3"
   * alone is a number, "3 / 9" is a position — it says how far the arrows reach
   * and that there is something on the other side of them.
   */
  trackLabel: 'Seguimiento de {{index}} / {{total}}',
  trackPrev: 'Pista anterior',
  trackNext: 'Siguiente pista',
  trackClock: '{{position}} / {{duration}}',
  /**
   * RESOLUTION. Three rungs, one word each — all three share a 350-wide row. The
   * line beneath belongs to the chosen rung: a rung's name does not say what it
   * buys, and the sentence does.
   */
  qualityLabel: 'Calidad de imagen',
  quality: {
    high: 'Alto',
    balanced: 'Equilibrado',
    low: 'Bajo',
  },
  qualityHint: {
    high: 'Resolución completa. Imagen más nítida, mayor cantidad de batería.',
    balanced: 'Resolución de tres cuartos. Difícil de ver, notablemente más fresco.',
    low: 'Media resolución, sin suavizado de bordes. Para teléfonos más antiguos.',
  },
  fpsLabel: 'Fotogramas',
  fpsOn: 'Sí',
  fpsOff: 'No',
  fpsHint: 'Fotogramas que la galaxia dibuja por segundo. 24–30 sin movimiento es normal; sube con el movimiento y en combate.',
} as const;

export const leaderboard = {
  eyebrow: 'La galaxia local',
  title: 'Tabla de clasificación',
  empty: 'Ningún comandante se ha unido a esta galaxia todavía.',
  rank: 'Clasificación {{rank}}',
  tier: 'Nivel {{tier}}',
  score: 'Dominio',
  you: 'Tú',
  nearby: 'Tus rivales más cercanos',
  searchLabel: 'Busca comandantes, planetas o clanes',
  searchPlaceholder: 'Comandante, planeta o clan',
  noMatch: 'Ningún comandante, planeta o clan coincide con esa búsqueda.',
  locationUnknown: "Aún no has descubierto la ubicación de este comandante.",
  /*
    THE IN-SEASON PRIZE — the answer to "what am I playing for".
    It sits directly above the standings, because that is where the decision is.
  */
  rewards: {
    title: 'Premio fin de temporada',
    left: 'Quedan {{duration}}',
    explain: 'Los {{places}} primeros puestos pueden ganar recursos para la próxima galaxia. Los bots conservan su puesto, pero no reciben premio; se necesita al menos {{minimum}} de Dominio.',
    table: 'Premio por plaza',
    tableCount: 'Mejores lugares {{places}} · abiertos para inspeccionar',
    place: 'Clasificación {{place}}',
    holding: 'Clasificación {{place}} · estás ganando esto',
    paidWhen: 'Llega en el momento en que encontraste tu mundo en la nueva temporada.',
    standing: 'Clasificación {{place}}',
    behind: '{{score}} Dominio más para llegar a la cima {{places}}.',
    minimum: '{{score}} más de Dominio para optar al premio.',
    botIneligible: 'Los bots conservan su puesto, pero no reciben premios de temporada.',
    climb: 'Llega a la cima {{places}} y tómalo.',
    unranked: 'Únete a esta galaxia para entrar en la clasificación.',
  },
  archive: {
    selectorLabel: 'Récords de temporada',
    archiveIndex: 'récords de la temporada',
    waitingArchive: 'Cargando registros de temporada',
    live: 'Temporada en vivo',
    seasonChoice: 'Temporada {{ordinal}} · {{galaxy}}',
    seasonNumber: 'Temporada {{ordinal}}',
    seasonHeading: 'Temporada {{ordinal}} · {{galaxy}}',
    /* A rank is not a boast without its field — first of four reads like first of three hundred. */
    percentile: '{{share}}% superior · {{rank}} de {{commanders}} comandantes',
    fieldSize: '{{count}} comandantes',
    medals: 'Trofeos',
    signature: 'Tu nave emblemático',
    leadWorks: 'Producción',
    leadProduced: 'Total de Obras realizadas',
    leadRuns: 'de {{count}} recorridos de asteroides',
    signatureCount: 'Construiste {{count}}',
    multiple: '×{{value}}',
    share: '{{value}}%',
    loadingOlder: 'Cargando temporadas anteriores',
    completedBoard: 'Clasificación de la temporada completada',
    waitingBoard: 'Abriendo la clasificación completa',
    emptyBoard: 'No se registraron resultados de comandante para esta galaxia.',
    searchLabel: 'Buscar la temporada completa por comandante',
    searchPlaceholder: 'Comandante',
    noMatch: 'Ningún comandante coincide con esa búsqueda.',
    galaxyRecord: {
      title: 'Registro galáctico', subtitle: 'Los hechos compartidos que dejó esta temporada',
      champion: 'Campeón', clans: 'Podio de clanes',
      biggestBattle: 'Mayor batalla verificada', dominionSwing: 'Mayor cambio de Dominio',
      contestedWorld: 'Mundo más disputado',
      battleLine: '{{attacker}} → {{defender}} en {{planet}} · {{value}} perdidos',
      swingLine: '{{attacker}} → {{defender}} · {{amount}} Dominio',
      worldLine: '{{planet}} · {{count}} registros de conflicto',
    },
    openCommander: 'Récord de la temporada abierta {{commander}}',
    openSeasonRecord: 'Temporada Abierta {{ordinal}} · Registro {{galaxy}}',
    commanderCard: 'récord de temporada del comandante',
    waitingProfile: 'Abriendo el registro de comandante',
    back: 'Volver a la clasificación de la temporada',
    profileViews: 'Vistas de registros de Commander',
    seasonTab: 'Temporada {{ordinal}}',
    overall: 'General',
    cohort_one: 'Otros = el promedio del comandante {{count}} en esta temporada',
    cohort_other: 'Otros = el promedio de los comandantes {{count}} en esta temporada',
    /** The three-column breakdown truncates; the long sentence is said once above. */
    averageShort: 'Otros: {{value}}',
    statsUnavailable: 'No se llevó ningún registro detallado de esta temporada.',
    statsUnavailableHint: 'Su rango y título se mantienen. Lo que nunca se midió no se muestra como cero.',
    legacyStats: {
      title: 'Récord de temporada preservado',
      hint: 'Se muestran las cifras de combate registradas. La economía, la producción de flotas y la exploración no se midieron y se omiten.',
    },
    partialStats: {
      title: 'Telemetría parcial',
      hint: 'Es posible que falte actividad anterior al inicio de la telemetría; las cifras registradas siguen siendo exactas.',
    },
    forcedEnd: {
      title: 'La temporada terminó temprano',
      hint: 'El período jugado queda sellado permanentemente, incluida su clasificación final y sus recompensas.',
    },
    none: 'Ninguno',
    ratios: {
      trade: 'Daño intercambiado',
      haul: 'Botín por incursión',
      kept: 'Flota mantenida',
      convoy: 'Tasa de aciertos de convoyes',
      hourly: 'Producción por hora',
      perRun: 'Transporte por carrera',
    },
    sections: {
      form: 'Forma y eficiencia',
      competition: 'Competición y batalla',
      economy: 'Economía y producción',
      exploration: 'Exploración y oportunidad',
    },
    metrics: {
      finalRank: 'Clasificación final',
      battles: 'Batallas',
      shipsBuilt: 'Naves construidos',
      shipsLost: 'Naves perdidos',
      shipsBuiltByHull: 'Naves construidos por tipo',
      shipsLostByHull: 'Naves perdidos por tipo',
      playerLoot: 'Botín de los comandantes',
      productiveTime: 'Tiempo de producción, todos los mundos',
      produced: 'Producido por las Obras',
      asteroidRuns: 'Carreras de asteroides',
      asteroidMined: 'Extraído de asteroides',
      convoyAttempts: 'Intentos de convoy',
      convoySuccesses: 'Éxitos del convoy',
      convoyDelivered: 'Recompensas del convoy entregado',
    },
    resources: {
      alloy: 'Aleación',
      crystal: 'Cristal',
      deuterium: 'Deuterio',
    },
    career: {
      completed: 'Temporadas completadas',
      bestRank: 'Mejor rango',
      championships: 'campeonatos',
      podiums: 'podios',
      topTen: '10 mejores resultados',
      noTelemetry: 'Ninguna temporada completa tiene un registro detallado todavía.',
      recordedCombatTotals: 'Totales de combate registrados',
      recordedTotals: 'Totales de carrera registrados',
      covered_one: '{{count}} temporada cubierta',
      covered_other: '{{count}} temporadas cubiertas',
      coveredWithPartial: '{{count}} temporadas cubiertas · {{partial}} con telemetría parcial',
      seasons: 'Temporada tras temporada',
    },
  },
} as const;

export const chat = {
  eyebrow: 'Canales en vivo',
  title: 'Chat',
  launcher: 'Abrir chat de galaxia',
  launcherUnread: 'Abrir chat de galaxia — {{count}} no leído',
  launcherClanUnread: 'Abrir chat — {{count}} no leído en Clan',
  launcherBothUnread: 'Abrir chat: {{general}} no leído en General, {{clan}} en Clan',
  channelsLabel: 'Canales de chat',
  languageLabel: 'Idioma del chat',
  general: 'General',
  clan: 'Clan',
  channelUnread: '{{channel}} — {{count}} no leído',
  clanLocked: 'El chat del clan es privado para un equipo.',
  clanLockedHint: 'Únete o funda un clan, entonces este canal se abre inmediatamente.',
  list: 'Mensajes de galaxia',
  empty: 'Nadie ha hablado todavía. Sé la primera voz en la galaxia.',
  older: 'Cargar mensajes antiguos',
  loadingOlder: 'Cargando mensajes antiguos',
  placeholder: 'Mensaje a la galaxia',
  send: 'Enviar',
  remaining: '{{count}} caracteres restantes',
  time: {
    justNow: 'hace un momento',
    minutes_one: 'hace {{count}} minuto',
    minutes_other: 'hace {{count}} minutos',
    hours: 'hace {{hours}} h {{minutes}} min',
    days_one: 'hace {{count}} día',
    days_other: 'hace {{count}} días',
  },
} as const;

/**
 * THE SCREEN THAT REPLACES A BLANK ONE.
 *
 * Written for somebody who has just lost what they were looking at, so it says
 * what happened, what it cost them — nothing — and what to do, in that order.
 * "The galaxy is untouched" is a fact, not a comfort: the server is the only
 * authority and this failure never left the phone.
 *
 * The technical detail behind these labels is deliberately NOT translated. It is
 * pasted into a message to the person who will fix it. See `shell/crashReport.ts`.
 */
export const crash = {
  title: 'Algo se rompió',
  body: 'La interfaz dejó de dibujar. La recarga te devuelve al disco: no se perdió nada en la galaxia.',
  reload: 'Recargar',
  detailShow: 'Mostrar detalle',
  detailHide: 'Ocultar detalle',
  /** What the developer needs, in the one gesture a phone can make. */
  copy: 'Copiar informe',
  copied: 'Copiado: envíanoslo',
  copyFailed: 'No se pudo copiar. En su lugar, haz una captura de pantalla del detalle.',
} as const;
