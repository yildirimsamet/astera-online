/**
 * THE DISC AND EVERYTHING ON IT — the galaxy's own chrome, the commander sheet,
 * and the focus rail that answers "what is this, and what do I know about it".
 */

export const galaxy = {
  settlementAway: "Flota colonizadora enviada a {{world}}",
  deathStarAway: "Estrella de la Muerte lanzada hacia {{world}}",
  /**
   * Its own key rather than a reuse of the server list's, because nothing is
   * shared between surfaces (D55): this one sits at 8px in the corner of the
   * disc and the other is a row in a list, and they are free to diverge.
   */
  online: "{{count}} en línea",
  /** The same population over a day, so an off-peak galaxy still reads as inhabited. */
  onlineToday: "{{count}} en 24h",
  worlds: "{{count}} mundos",
  fleetAway: " · {{count}} flota en camino",
  rocks: "· {{count}} rocas",
  pirates_one: "· {{count}} pirata",
  pirates_other: "· {{count}} piratas",
  wrecks_one: "· {{count}} naufragio",
  wrecks_other: "· {{count}} restos de naufragio",
  asteroidShower: 'Lluvia de asteroides',
  asteroidShowerStatus: 'Apariciones ×{{multiplier}} · quedan {{remaining}}',
  intergalacticConvoy: 'Convoy intergaláctico',
  intergalacticConvoyStatus: 'Cruza la galaxia · quedan {{remaining}}',
  openIntel: "Inteligencia",
  /**
   * THE PLANET GLYPH IS A CAMERA MOVE NOW, AND THE SHEET HAS ITS OWN MARK. D163.
   *
   * `openWorlds` is gone with the tap that opened a list from a glyph that looked
   * like "go to my planet"; the list itself is the transfer sheet and is named
   * for what a commander opens it to DO.
   */
  goHome: "Acércate a tu planeta activo",
  openTransfer: "Enviar recursos entre tus mundos",
  /* The two sensor switches under the disc readout. `aria-label` only. */
  showTelescope: "Mostrar alcance del telescopio",
  hideTelescope: "Ocultar alcance del telescopio",
  showRadar: "Mostrar alcance del radar",
  hideRadar: "Ocultar alcance del radar",
  eventsGuide: {
    open: "Mostrar eventos de galaxias",
    eyebrow: "Calendario semanal",
    title: "Eventos de galaxia",
    intro: "Estos eventos vuelven a celebrarse a horas fijas entre semana y los fines de semana.",
    timeZone: "Hora de Turquía (UTC+3)",
    nextLabel: "Próximo evento",
    nextUpcoming: "{{event}} · en {{duration}}",
    localTime: "Hora local · {{time}}",
    event: {
      ASTEROID_SHOWER: "Lluvia de asteroides",
      TRADE_SHIP: "Buque comercial",
      INTERGALACTIC_CONVOY: "Convoy intergaláctico",
    },
    dailyNote: "Días laborables: de lunes a viernes. Fin de semana: sábado y domingo. Todas las horas son de Turquía.",
    days: {
      WEEKDAY: "Días laborables",
      WEEKEND: "Fin de semana",
      EVERY_DAY: "Todos los días",
    },
    asteroid: {
      title: "Lluvia de asteroides",
      summary: "Cada hora aparece un asteroide por cada comandante que haya jugado durante la hora anterior. Durante la lluvia aparecen más; los asteroides que ya estaban siguen ahí hasta que desaparecen.",
    },
    trade: {
      title: "Buque comercial",
      summary: "Selecciona la nave en el mapa de la galaxia para intercambiar tus recursos por el recurso que necesitas.",
      rate: "Tasa fija: 32 Aleación = 16 Cristal = 1 Deuterio.",
    },
    convoy: {
      title: "Convoy intergaláctico",
      summary: "Ataca el convoy mientras atraviesa la galaxia. Según tu potencia de fuego, podrás ganar hasta cuatro horas de producción y quizá recuperar naves.",
      note: "El convoy no devuelve el fuego, así que tu flota no sufre pérdidas. Cada mundo puede atacarlo una vez por travesía.",
    },
  },
  /* Screen-reader names for the marks on the disc. Nothing is painted. */
  openResearch: "Investigación",
  openClan: "Clan",
  kindCapital: "Capital",
  kindColony: "Colonia",
  kindNeutral: "Neutro T{{tier}}",
  /** A world nobody has surveyed. The only honest thing to print about it. D127. */
  /** What a remembered world's bottom line says: the record, and how old it is. D151. */
  recordAge: "Registro · {{age}}",
  unsurveyed: "Sin explorar",
  owned: "Tuyo",
  clanmate: "Compañero de clan",
  rival: "Rival",
  recovery: "Protección de regreso vulnerada",
  emp: "Apagón EMP",
  claimOpen: "Disponible para reclamar",

  /** What a launch says as it leaves. */
  harvestAway: "{{count}} en camino · {{minutes}} min hasta los restos",
  miningAway: "{{count}} en camino · {{minutes}} min hasta el asteroide",

  panelPlanetEyebrow: "Tu planeta",
  panelCommanderEyebrow: "Comandante",
  panelIntelEyebrow: "Lo que sabes",
  panelIntelTitle: "Inteligencia",

  commander: {
    galaxyLabel: "Galaxia",
    galaxyUnknown: "—",
    endsLabel: "La temporada termina en",
    endsUnknown: "—",
    wipeNote: "Al cambiar de temporada se reinician todas las galaxias y todos empiezan de nuevo.",
    signOut: "Cerrar sesión",
  },
} as const;

/**
 * THE LIST OF WHAT YOU HOLD. T3.
 *
 * Its own namespace and not a reuse of `galaxy`'s world words: this surface names
 * a capital in a row you can press, and the disc names one in a caption. They are
 * free to diverge, and D55 says they must be able to.
 */
export const worlds = {
  eyebrow: "Tus dominios",
  title: "Mundos",
  /** Names the list itself, so the rows are not three unlabelled buttons. */
  list: "Tus mundos",
  active: "Activo",
  kindCapital: "Capital",
  kindColony: "Colonia",
  craft_one: "{{count}} nave",
  craft_other: "{{count}} naves",
  bays: "Plataformas",
  sendTitle: "Transferencia rápida",
  /**
   * THE TWO ENDS OF ONE SENTENCE, AND THE BUTTON THAT COMMITS IT. D163.
   *
   * The labels are visually hidden — the arrow between the dropdowns says which is
   * which, and two words above two controls that already read `Kestrel-12 → Haven`
   * would be the interface writing out what it has just drawn. They stay for the
   * screen reader, where there is no arrow to see.
   */
  sendFrom: "Desde",
  sendTo: "Para",
  send: "Transferencia",
  /** Screen-reader readings for the two pictures on a row. */
  store: "{{resource}}: {{amount}} de {{cap}}",
  baysReading: "{{used}} de las bahías de vuelo {{total}} en uso",
  alloy: "Aleación",
  crystal: "Cristal",
  deuterium: "Deuterio",
} as const;

export const focus = {
  /** The rail itself. */
  shellLabel: "{{title}} — foco",
  clear: "Borrar selección",

  /** One known thing, with where it came from stamped on it. */
  unknown: "Desconocido",

  planet: {
    transfer: "Transferencia",
    settle: "Colonia encontrada",
    settleNeedSlot: "Colonia encontrada · espacio de colonia lleno",
    settleNeedBay: "Colonia encontrada · bahías de vuelo llenas",
    settleNeedCourier: "Colonia encontrada · Se necesitan 2 mensajeros",
    settleNeedAlloy: "Colonia encontrada · Falta aleación",
    settleNeedCrystal: "Colonia encontrada · Falta cristal",
    settleNeedFuel: "Colonia encontrada · Falta deuterio",
    settleTooLate: "Colonia encontrada · llega demasiado tarde",
    settleRecovering: "Colonia encontrada · origen recuperando",
    settleWhy: {
      recovering: "Tu mundo se está recuperando; ninguna flota puede abandonarlo todavía.",
      colonyCore: "La próxima colonia necesita Núcleo de Mando {{required}} · ahora {{current}}",
      colonyMax: "Ya tienes la mayor cantidad de colonias que existen: {{max}}.",
      flightBay: "Cada bahía de vuelo está en uso; la encuentra cuando aterriza una flota.",
      courier: "{{need}} Se necesitan mensajeros · {{have}} aquí",
      alloy: "{{need}} Aleación necesaria · {{have}} aquí",
      crystal: "{{need}} Se necesita cristal · {{have}} aquí",
      fuel: "{{need}} Se necesita deuterio · {{have}} aquí",
      tooLate: "Los mensajeros de aquí aterrizan después del cierre de la carrera.",
    },
    settlementConfirm: {
      eyebrow: "Carrera de colonias",
      title: "Encontrado {{world}}",
      unsurveyedTitle: "Encontré este mundo",
      race: "La primera flota válida de dos Mensajero que llega toma el mundo.",
      noRecall:
        "Los naves coloniales no se pueden recuperar. Si encuentras la colonia, el costo de fundación se gasta y el mundo se abre con las existencias de su nivel. Si otro comandante gana primero, tus Mensajeros y el coste de fundación regresan; el combustible gastado no.",
      transports: "Naves coloniales",
      foundingCost: "Costo de fundación",
      opensWith: "La colonia se abre con",
      cargoValue: "{{alloy}} Aleación · {{crystal}} Cristal",
      stockValue: "{{alloy}} Aleación · {{crystal}} Cristal · {{deuterium}} Deuterio",
      fuel: "Combustible de vuelo",
      arrives: "Llega a",
      closes: "La carrera se acerca",
      confirm: "Despacho de naves coloniales",
      confirming: "Despachando…",
    },
    deathStar: "Estrella de la Muerte",
    deathStarStrike: "Estrella de la Muerte · ataque EMP",

    /**
     * THE SECOND BEAT ON A STRIKE. Owner report: *"yanlışlıkla"*.
     *
     * The most expensive single action a commander takes, consuming the weapon,
     * offered as one slab in a wrapped row of four whose neighbour is an ordinary
     * raid. It names the WORLD, because a mis-tap sends it to the wrong one, and
     * it states the outage rather than arguing for the rocket — the essay about
     * what a strike does belongs beside the forge that builds one.
     */
    strikeConfirm: {
      eyebrow: "Ataque EMP táctico",
      title: "Suprimir {{world}}",
      lead: "La Estrella de la Muerte se consume con el ataque. No puede ser retirada.",
      outage: "Apagón EMP",
      keeps: "La Égida se vacía y no se regenera durante una hora. Las defensas terrestres quedan fuera de línea y no reciben daño.",
      commit: "Lanzar EMP",
      back: "Mantenga el fuego",
    },
    deathStarUnavailable: "No hay Estrella de la Muerte lista",
    deathStarProtected: "Estrella de la Muerte · objetivo protegido",
    deathStarNeedBay: "Estrella de la Muerte · bahías de vuelo llenas",
    deathStarTooLate: "Estrella de la Muerte · llega demasiado tarde",
    deathStarNeedSlot: "Estrella de la Muerte · espacio de colonia lleno",
    deathStarOriginRecovering: "Estrella de la Muerte · origen recuperando",
    kindCapital: "Capital",
    kindColony: "Colonia",
    kindNeutral: "Neutro",
    capitalProtected: "Capital incapturable",
    capitalProtectedHint:
      "Una Estrella de la Muerte vacía la Égida y bloquea su regeneración durante una hora; las defensas terrestres quedan fuera de línea y no reciben daño.",
    /**
     * WHAT A CAPITAL IS WHILE THE WEAPON IS OFF. `STRATEGIC_CRAFTING_ENABLED`.
     *
     * `capitalProtectedHint` above is the flag-ON sentence and stays exactly as
     * written for the day it flips back. This is the same slot said in the rules
     * a commander can currently reach: a raid, loot, and a world that never moves.
     */
    capitalRaidOnlyHint:
      "Una incursión requiere recursos y nada más. Una capital nunca cambia de manos, sea lo que sea que acabe en ella.",
    capitalRecovering: "Capital recuperándose · incapturable",
    capitalRecoveringHint:
      "Otro ataque EMP reinicia la supresión de una hora; el control permanece igual.",
    capitalEmp: "Capital bajo EMP",
    capitalEmpHint: "La Égida está vacía y las defensas terrestres quedan fuera de línea e invulnerables durante una hora.",
    yourCapital: "Tu capital protegido",
    yourColony: "Tu colonia",
    transferHint: "Mueve naves y recursos aquí con una transferencia unidireccional.",
    transferRoute: "Transferencia mundial",
    transferOrigin: "Origen",
    transferTarget: "Objetivo",
    transferFrom: "De {{origin}}",
    transferCraft: "Listo para manualidades",
    transferPrepare: "Elige nave y recursos",
    transferRecovering: "El mundo de origen se está recuperando",
    colonyRoute: "Ruta a una colonia",
    claimOpen: "Carrera de colonias abierta",
    settlementInFlight: "Tus naves coloniales están en camino",
    claimRaceExplain: "Nadie es el propietario todavía. Los primeros 2 mensajeros válidos que lleguen se lo llevarán.",
    colonySlots: "{{used}} / {{total}} espacios de colonia",
    routeRaid: "Gana una incursión decisiva.",
    routeRaidDetail: "Ataque con naves de combate. Destruye a todos los defensores y el escudo.",
    routeClaim: "La carrera se abre automáticamente",
    routeClaimDetail: "Nada que enviar. Una incursión decisiva abre por sí sola la carrera pública.",
    routeSettle: "Envía la flota colonial.",
    routeSettleDetail: "Recién ahora envía los naves fundadores y el cargamento. La primera llegada válida gana.",
    routeSettleInFlightDetail: "Tu flota fundadora está volando. Gana la primera llegada válida.",
    raidFleetBadge: "Flota de incursión",
    raidFleetExplain:
      "Elige naves de combate en la pantalla Raid y destruye a todos los defensores y el escudo. No se necesitan mensajeros, carga fundadora ni espacio de colonia para el paso 1.",
    automaticBadge: "Automático",
    automaticExplain:
      "Una incursión decisiva abre la carrera automáticamente. No envías otro nave ni pagas otro recurso por el paso 2.",
    settlementAwayBadge: "En vuelo",
    settlementAwayExplain:
      "Tus 2 mensajeros y el cargamento fundador han partido. No se pueden recordar; la primera llegada válida toma el mundo.",
    claimCloses: "Cierra en {{duration}}",
    claimRaidStillOpen:
      "Otra incursión es posible; no amplía esta afirmación.",
    openColonySlot: "Espacio de colonia",
    colonySlotExplain:
      "Solo es necesario para el paso 3. El núcleo de comando de tu capital debe proporcionar un espacio de colonia no utilizado cuando la flota fundadora se vaya.",
    captureColonySlotExplain:
      "Necesario para fundar una colonia, nunca para atacar una: una Estrella de la Muerte no transfiere nada.",
    openFlightBay: "1 plaza de vuelo libre",
    flightBayExplain:
      "Sólo es necesario para el paso 3. El vuelo de ida de los 2 Mensajeros ocupa 1 bahía hasta llegar al mundo neutral.",
    courierCount: "2 Mensajeros",
    haulerExplain:
      "Solo para el paso 3: esta es la flota fundadora, enviada por separado del raid después de que abre la carrera. No son necesarios para la redada.",
    foundingAlloy: "{{amount}} Aleación",
    foundingAlloyExplain:
      "{{amount}} La aleación se gasta en fundar la colonia en el paso 3; una carrera que pierdes te lo devuelve. No es un costo de la redada.",
    foundingCrystal: "{{amount}} Cristal",
    foundingCrystalExplain:
      "{{amount}} Cristal se gasta en fundar la colonia en el paso 3; una carrera que pierdes te lo devuelve. No es un costo de la redada.",
    settlementFuel: "{{amount}} Deuterio",
    settlementFuelExplain:
      "Los 2 Mensajeros queman {{amount}} Deuterio en su vuelo de ida en el paso 3. La distancia cambia esta cantidad.",
    settlementArrivalExplain:
      "El vuelo fundacional dura {{duration}}. Debe llegar antes del cierre de la carrera pública; La primera llegada válida gana.\nLlega",
    arrivesIn: "{{duration}}",
    deathStarRoute: "Qué hace una ataque",
    /** The clock a defender is racing, named for what runs out at the end of it. */
    recoveryBreach: "Recuperación · mundo oscuro",
    empBreach: "Apagón EMP · defensas desconectadas",
    occupationProtected: "Protección laboral",
    protectedFor: "No se puede golpear ni capturar por {{duration}}.",
    firstImpact: "Daño + {{duration}} oscuro",
    secondImpact: "El tiempo se acaba · el mundo no cambia",
    deathStarReadyRequirement: "Estrella de la Muerte lista",
    deathStarReadyExplain:
      "Un ataque necesita una Estrella de la Muerte completa esperando en el mundo de lanzamiento.",
    /**
     * WHAT THE CLOCK ACTUALLY COSTS, WHERE THE DEFENDER IS LOOKING AT IT. D179.
     *
     * It read "land a ship here or this colony stops being yours" until D179
     * removed the drop. There is nothing to race any more, so the line states the
     * real price instead — the world produces nothing and can launch nothing — and
     * says the one thing a struck commander most needs to hear.
     */
    recoveryDropWarning:
      "Quedan {{duration}}. Hasta entonces no se produce nada ni se pueden lanzar flotas. El mundo sigue siendo tuyo y tu flota está intacta.",
    empWarning: "Quedan {{duration}}. La Égida no se regenera; las defensas terrestres no disparan ni reciben daño.",

    eyebrow: "En poder de {{owner}}",
    location: "Mundo · {{planet}}",
    /** A world outside every reach and never probed. It has no other name. D127. */
    unsurveyedEyebrow: "Mundo · no encuestado",
    unsurveyedTitle: "Nunca has mirado aquí",
    /* Paired side by side on the rail, so the verb is the label and the cost is
       its own micro line. See `ProbeControl`. */
    /**
     * A WORLD THAT CANNOT BE RAIDED YET. D183.
     *
     * Names the CLOCK rather than the rule: "Protected · 4h" is something a
     * commander can plan against, where "that commander is new" is trivia about
     * somebody else. One label for both sources of the state — an occupation window
     * and a first-day shield mean the same thing to a raider.
     */
    /**
     * THE HALF OF THE BAND FOG CAN PROVE. D168 · D127.
     *
     * The short form rides the control and must be ONE LINE — about 129px at
     * 350. The long form is the accessible name, where there is room to say why.
     * Both state only "too developed": the "too weak" direction cannot be proved
     * from a fogged disc, so it stays with the server's refusal.
     */
    attackOutOfBandShort: "Demasiado desarrollado",
    attackOutOfBand:
      "Ese comandante está más desarrollado que tú: una banda abarca como máximo un nivel",
    attackProtected: "Protegido: este mundo aún no puede ser atacado",
    attackProtectedShort: "Protegido · {{duration}}",
    attackShort: "Ataque",
    probeShort: "Sonda",
    probeCoolingShort: "Sonda en {{duration}}",
    attack: "Planificar un ataque",
    attackNeutralAgain: "Incursión nuevamente · reclamación sin cambios",
    attackOriginRecovering: "Ataque · origen recuperando",
    attackShipyardRevolt: "No se puede atacar · revuelta en astilleros",
    attackShipyardRevoltShort: "Revuelta en el astillero",
    windowOpen:
      "Su flota no está en casa. Esta es la ventana de la que trata todo el juego.",
    distance: "Distancia",
    reach: "Tu alcance",
    reachUnknown: "—",
    known: "Conocido",
    knownOf: "{{have}} de {{total}}",

    headlineFleetAway: "Flota lejos",
    headlineFleetHome: "Inicio de la flota",
    headlineVeiled: "Velado",
    headlineProbed: "Sondeado {{age}}",
    headlineFought: "luchó contra {{age}}",
    headlineNone: "Sin información",

    installTelescope: "Instalar un telescopio",
    watchSlot: "Reloj · ranura {{slot}}",
    replaceSlot: "Ranura {{slot}} · reemplazar {{target}}",
    watching: "Viendo {{target}}",
    sendProbe: "Enviar una sonda · {{alloy}} aleación · {{crystal}} cristal",
    probeAway: "Sonda ausente · informa en {{duration}}",
    /*
      ONE LOOK PER WORLD PER HOUR (D121). The control says which world is closed
      and for how long, rather than letting the player spend the tap to find out.
    */
    probeCooling: "Acabas de mirar aquí · otra sonda en {{duration}}",
    markRival: "Marcar rival",
    rivalMarkedAction: "Rival",
    rivalMarked: "{{commander}} ahora es tu rival.",
    rivalCleared: "{{commander}} ya no está marcado como tu rival.",
    rivalHeading: "Tu historia esta temporada",
    rivalMarkedBadge: "Rival marcado",
    rivalEncounters: "Encuentros",
    rivalYourRaids: "Tus incursiones",
    rivalTheirRaids: "Sus incursiones",
    rivalDominion: "Dominio",
    rivalDominionValue: "+{{gained}} · −{{lost}}",
    rivalLastContact: "Último contacto {{age}}",
    rivalProbeOnly:
      "Has mirado este mundo, pero ninguno de los lados ha abierto fuego todavía.",
    rivalNoContact:
      "Marcaste a este comandante. El primer paso entre ustedes todavía está esperando.",
    rivalAhead:
      "Mantienes el borde. Tienen más Dominio que recuperar de ti.",
    rivalBehind: "Mantienen el borde. La deuda sigue abierta.",
    rivalEven:
      "El libro mayor entre ustedes está equilibrado. El próximo encuentro lo rompe.",
    rivalFeud: "{{count}} encuentros han hecho que esta sea más de una incursión.",
    rivalPurpose:
      "Fija a este comandante y tu récord de temporada compartido. No otorga bonificación de combate ni de inteligencia.",
  },

  asteroid: {
    eyebrow: "Nivel {{level}} asteroide",
    title: "Pasando roca",
    summaryOre: "{{amount}} mineral",
    summaryAnomaly: "{{amount}} mineral · anomalía isotópica",
    working_one: "{{count}} nave que ya trabaja en esta roca · {{state}}",
    working_other: "{{count}} nave que ya trabaja en esta roca · {{state}}",
    stateReturning: "regresando a casa",
    stateInbound: "entrante",
    noCraft: "No hay buscadores en casa",
    tooLate: "Desaparecerá antes de que llegues",
    researchNeeded: "Primero investiga la espectrometría de isótopos",
    /**
     * THE MINUTE AFTER A TRIP THAT COST NOTHING. D183.
     *
     * The wait is the whole message, so the wait is the whole sentence — a rail
     * that spent a line explaining the rule would be a paragraph doing a design's
     * job. Where the rule came from belongs in the docs, not on the control.
     */
    resting: "Embarcación descansando · {{duration}}",
    send: "Enviar {{count}} · {{duration}}",
    oreLeft: "Mineral restante",
    leavesIn: "Sale en",
    composition: "Composición",
    compositionValue: "{{percent}}% cristal",
    compositionUnknown: "Composición isotópica desconocida",
    compositionIsotope: "{{crystal}}% cristal · {{deuterium}}% Deuterio",
    deuteriumRoute:
      "Envía buscadores para recuperar el deuterio. El transporte de regreso aterriza en la Obra; Recógelo y guárdalo.",
    speed: "Velocidad",
    speedValue: "{{rate}}/min",
    spill:
      "Tus obras solo pueden tomar {{room}} más. Aproximadamente {{lost}} de este botín se perderían al llegar; vacíelos primero.",
    taken: "Alguien ya le ha quitado {{amount}}.",
    untouched: "Sin tocar. La primera nave que llega hasta él lleva lo que puede transportar.",
    // "{{total}} between them" is nonsense about a single craft, in either language.
    fleetLine_one: "{{count}} Prospector en casa · lleva {{hold}}",
    fleetLine_other:
      "{{count}} Prospectores en casa · cada uno lleva {{hold}} · {{total}} entre ellos",
    derrickPitch:
      "Un <0>{{name}}</0> en órbita haría que <1>{{hold}}</1> cada uno, y los llevaría allí antes.",
    intercept:
      "Tu nave lo encontraría en {{reach}}, con {{spare}} de sobra.",
  },

  craftPicker: {
    label: "Cuantos enviar",
  },

  debris: {
    eyebrow: "Restos",
    titleUnknown: "Campo de escombros",
    titleOver: "Escombros sobre {{planet}}",
    summarySalvage: "{{amount}} recuperación",
    working_one: "{{count}} nave ya allí · {{state}}",
    working_other: "{{count}} nave ya allí · {{state}}",
    stateReturning: "regresando a casa",
    stateInbound: "entrante",
    noCraft: "No hay manualidades en casa",
    tooLate: "Desaparecerá antes de que llegues",
    resting: "Embarcación descansando · {{duration}}",
    send: "Enviar {{count}} · {{duration}}",
    alloyLeft: "Aleación restante",
    crystalLeft: "Cristal restante",
    deuteriumLeft: "Deuterio restante",
    goneIn: "Entró",
    yourHold: "Tu espera",
    spill:
      "Tus obras solo pueden tomar {{room}} más. Aproximadamente {{lost}} de esto se perdería al llegar; vacíelos primero.",
    body: "Alguien perdió una flota aquí. Se está desvaneciendo y todos pueden verlo: quien llegue primero se lleva lo que queda.",
  },

  run: {
    eyebrowHome: "Volviendo a casa",
    eyebrowSalvage: "Ejecución de rescate",
    eyebrowOutbound: "Saliente",
    title_one: "{{count}} Prospector",
    title_other: "{{count}} Prospectores",
    homeIn: "Casa en",
    reachesIn: "Lo alcanza en",
    meetsRockIn: "Se encuentra con la roca en",
    target: "Objetivo",
    targetWreck: "Restos sobre {{planet}}",
    targetWreckAnon: "Restos sobre un mundo",
    targetDecayed: "El campo se ha deteriorado",
    targetRock: "Nivel {{level}} roca",
    targetRockGone: "La roca ha pasado",
    carrying: "Lleva aleación {{alloy}} y cristal {{crystal}}.",
    carryingDeuterium:
      "Lleva aleación {{alloy}}, cristal {{crystal}} y deuterio {{deuterium}}.",
    emptySalvage:
      "Llegué y encontré el campo ya recogido. Volviendo vacío.",
    emptyRock: "Llegué y encontré la roca ya despojada. Volviendo vacío.",
    salvageNote:
      "Un campo no se mueve y todos pueden verlo. {{clock}} El que llegue primero se lleva lo que pueda llevar.",
    salvageClock: "Desapareció en {{duration}}.",
    miningNote:
      "Volando hacia donde estará la roca, no hacia donde está. El que llega primero se lleva lo que puede llevar.",
  },

  thread: {
    eyebrowProbeHome: "Sonda regresando a casa",
    eyebrowProbeOut: "Sonda saliente",
    eyebrowFleetHome: "Flota regresando",
    eyebrowFleetOut: "Flota saliente",
    arrivesIn: "Llega a",
    craft: "Nave",
    craftUnknown: "—",
    returning: "En camino de regreso. Nada más que decidir.",
    outbound: "Una flota lanzada no se puede recuperar.",
  },

  contact: {
    eyebrowBattle: "Está aterrizando una incursión",
    eyebrowInbound: "Este contacto viene por ti",
    eyebrowSalvage: "Alguien está rescatando",
    eyebrowMining: "Alguien está minando",
    eyebrowProbe: "Alguien está explorando",
    eyebrowMoving: "Alguien se está moviendo",
    titleUnknown: "No identificado",
    eyebrowUnknown: "Hay algo ahí fuera",
    unknownHint:
      "Fuera de la mira de tu telescopio. Cuando este contacto aparece a la vista, su tipo de embarcación y, para una flota, sus cascos y recuentos exactos se vuelven legibles.",
    /**
     * RADAR L5 NAMES THE KIND WITHOUT NAMING THE CRAFT.
     *
     * The top of the ladder, paying out on ordinary traffic rather than only on a
     * raid aimed at you. It has to say WHERE the reading came from, or the panel
     * would be claiming sight it does not have — and the fog hides, never lies.
     */
    radarKind: "El radar lo lee como {{kind}}. Nada más a esta distancia.",
    titleBattle: "Bajo fuego",
    titleFleet: "Escuadrón",
    titleProbe: "Sonda",
    titleMining: "Ejecución minera",
    titleHarvest: "Ejecución de rescate",
    titleDeathStar: "Estrella de la Muerte",
    titlePirate: "Flota pirata",
    eyebrowPirate: "Los piratas están ahí fuera",
    boundaryPirate:
      "Puedes ver a los piratas y lo que vuelan. Nada sobre su procedencia ni nada sobre su órbita: un pirata es una posición, no una ruta.",
    working: "Trabajando",
    craftCount: "{{count}} nave",
    /**
     * A SILHOUETTE, NOT A ROSTER. D123.
     *
     * The panel used to name every hull in somebody else's squadron, which is what
     * Radar L4 and L5 are sold for. What a stranger reads now is roughly how much
     * is out there — and the word chosen has to make clear it is an estimate, or
     * the interface is quietly claiming a precision the payload does not have.
     */
    massLight: "Flota pequeña",
    massMedium: "Flota mediana",
    massHeavy: "Flota grande",
    massHint: "Solo tamaño: no hay manifiesto en este rango.",
    inboundHint:
      "El radar sabe que está dirigido a uno de tus mundos. Su hora de llegada se entrega por separado como aviso cronometrado.",
    bombarding: "Bombardeo",
    settling: "Resolviendo ahora",
    unattributed: "Sin atribuir",
    arrivalUnknown: "Llegada desconocida",
    inboundNoClock: "Dirigido a ti · sin hora de llegada",
    craftLabel: "Nave",
    craftUnknown: "—",
    statusLabel: "Estado",
    statusLanded: "Aterrizó",
    arrivesIn: "Llega a",
    arrivesUnknown: "Desconocido",
    boundaryBattle:
      "Una flota está sobre ese mundo y disparando. Si está dentro del alcance del telescopio, su formación exacta es visible; de quién es, de dónde viene y quién gana, no.",
    boundarySalvage:
      "Una carrera de rescate es pública: el campo, la ruta y el reloj. Lo que trae a casa no lo es.",
    boundaryMining:
      "Descubriste esta roca, por lo que su carrera minera es visible: objetivo, ruta y reloj. Lo que llega a casa sigue siendo privado.",
    boundaryFleet:
      "Dentro de la mira del telescopio puedes identificar la nave en sí; para una flota, sus cascos y recuentos exactos son visibles. Su dueño, origen y destino no lo son.",
    boundaryUnknown:
      "Solo puedes ver movimiento. El tipo de embarcación, el tamaño, el propietario, el origen y el destino no están incluidos en esta lectura.",
    telescopeHint:
      "Observar un mundo te indica si su flota está en casa. Esa es la información que convierte el movimiento en el mapa en una posible ventana de ataque.",
    wreckHint:
      "Los restos del naufragio son públicos. Lo que quede de ambas flotas estará en órbita allí en breve y cualquiera podrá ir a buscarlo.",
  },
} as const;

/**
 * KORSAN FİLOLARI — the third thing in the galaxy worth flying at. D150.
 *
 * Every line here has to make the RULE visible: the level, the handicap it buys,
 * the deadline and the odds of towing a ship home. A rule the player cannot see is
 * not a usable rule (D124), and this is the only surface any of them appear on.
 */
export const pirate = {
  title: "Flota pirata",
  /** Level and callsign together. The callsign is season-unique and leaks no index. */
  name: "Flota pirata L{{level}}-{{callsign}}",
  level: "Nivel {{level}}",
  eyebrow: "Nivel {{level}} piratas",
  /** The one combat modifier in the feature, stated as a number the player can price. */
  damagePenalty: "Esta flota causa {{percent}}% menos de daño",
  /** Opens the same commitment sheet a raid on a world opens. D150. */
  attack: "Ataque",
  yourFleet: "Tu flota",
  atHome: "{{count}} en casa",
  fewer: "Menos {{name}}",
  more: "Más {{name}}",
  quantity: "Cuantos {{name}}",
  max: "Enviar cada {{name}}",
  maxShort: "Máximo",
  noShipsAtHome: "No hay naves en este mundo para enviar.",
  eyebrowUnknown: "Contacto no identificado",
  pickShips: "Elige al menos un nave",
  fuelCost: "Combustible {{amount}} deuterio",
  noFuel: "No hay suficiente deuterio para el viaje de ida y vuelta",
  noBay: "Sin bahía de vuelo libre",
  tooSlow: "Tu nave más lento no puede alcanzarlo",
  roster: "Tripulación",
  rosterUnknown: "Tripulación desconocida a esta distancia",
  unknownContact: "Contacto no identificado",
  mass: "Masa",
  leavesIn: "Sale en",
  reach: "Lo alcanza en {{duration}}",
  reachLabel: "Llegas a",
  /**
   * WHAT THE CREW IS WORTH, ON THE SHEET'S OWN AXIS. D183.
   *
   * "Strength" rather than "value": both numbers on the comparison a tap later are
   * resource value, and a rail that named the unit would be explaining arithmetic
   * where the player only needs to know which figure is bigger.
   */
  strengthLabel: "Potencia de fuego",
  tooLate: "Abandona el área antes de que puedas alcanzarla.",
  unreachable: "Nada en este mundo podría atraparlo.",
  alreadyRaiding: "Este mundo ya tiene una incursión por ahí.",
  outOfSight: "No en tus sensores",
  noShips: "No hay naves en casa",
  captureHint: "Una victoria decisiva puede otorgarte un nave de su tripulación.",
  captured: "{{hull}} capturado",
  captureMissed: "No queda nada que valga la pena remolcar a casa",
  send: "Enviar {{count}} · {{duration}}",
  outbound: "Una flota lanzada no se puede recuperar.",
  /**
   * YOU CANNOT SEE THIS ONE — WHICH IS NOT THE SAME AS "THIS IS OLD". D160.
   *
   * The line says what the faded craft on the disc says: no circle of yours covers
   * it, and it is here because you identified it once. The figures are still
   * current — an orbit is solvable and the crew is the lane's live state, exactly
   * as a rock you have found keeps reporting its remaining ore.
   */
  remembered: "Seguimiento desde que lo identificaste · ahora no está en tus sensores",
  /** The boundary, stated — the same job the contact panel's last line does. */
  boundary:
    "Un pirata que has identificado permanece en esta lista hasta que muere o se acaba su tiempo, exactamente como una roca que has encontrado. Su órbita tiene solución, por lo que mantienes la pista y el conteo de la tripulación fuera del alcance; lo que pierdes es la vista, no el rastro.",
  hoardHint: "Lo que llevas a casa está limitado por las bodegas que trajiste.",
} as const;
