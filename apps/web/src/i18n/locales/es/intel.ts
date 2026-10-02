/**
 * WHAT YOU KNOW — the intel centre, the battle reports, the clarity readout, and
 * the dossier lines the focus rail is built from.
 */

export const intel = {
  shelf: {
    label: 'Inteligencia',
    watch: 'Vigilancia',
    reports: 'Informes',
    radar: 'Radar',
  },
  rivals: {
    heading: 'Rivales marcados',
    none: 'Marca a un rival desde su mundo en la galaxia; la marca lo sigue a cada mundo que tenga.',
    lost: 'fuera de tu disco',
  },
  known: {
    heading: 'Lo que sabes',
    legendToggle: 'Nitidez y antigüedad',
    legend: 'Las barras son la nitidez en vivo de un telescopio. La lectura de una sonda envejece: su imagen se vuelve granulada tras una hora, se desvanece tras un día y dice hace cuánto.',
    telescope: 'Telescopio',
    probe: 'Informe de sonda',
    window: 'Ventana {{duration}}',
    empty: 'Aún no sabes nada: un telescopio vigila en vivo, una sonda trae una lectura.',
  },
  openOrbit: 'Órbita abierta',
  tabs: {
    label: 'Informes Intel',
  },
  coverage: {
    label: 'Cobertura',
    blind: 'No puedes ver ni un solo planeta',
    partial_one: 'Viendo {{seen}} de tu ranura {{count}}',
    partial_other: 'Viendo {{seen}} de tus espacios {{count}}',
    full: 'Cada espacio que tienes está vigilando a alguien',
    blindHint: 'Un telescopio es la forma más barata de detener eso.',
    idleHint_one: '{{count}} está inactiva. Elige un mundo en la galaxia y apúntalo.\nLas ranuras',
    idleHint_other: '{{count}} están inactivas. Elige un mundo en la galaxia y apúntalo.',
    scarcity_one:
      '{{neighbours}} mundos por ahí y {{count}} ojo para gastar. Mover uno cuesta un tiempo de reutilización, así que elige quién.',
    scarcity_other:
      '{{neighbours}} mundos ahí fuera y {{count}} ojos para gastar. Mover uno cuesta un tiempo de reutilización, así que elige quién.',
    oneMore: 'Telescopio L{{level}} observaría uno más.',
    noRadar: 'Y sin radar, no puedes distinguir una amenaza dirigida a ti de otro movimiento.',
  },

  watching: {
    nextSlot: 'Telescopio N{{level}}',
    heading: 'Mirando',
    slotsUsed: '{{used}}/{{total}} ranuras utilizadas',
    slotLabel: 'Ranura {{slot}}',
    slotEmpty: 'Inactivo',
    missingNoSlot: 'Ninguna ranura apunta a nada',
    missingNoTelescope: 'No tienes telescopio',
    gives: "Te indica el momento en que sale la flota de un planeta, el único hecho que decide cada incursión.",
    costPoint: 'Elige un planeta en la galaxia y apúntalo con una ranura.',
    costInstall: 'Instala uno desde la pantalla de tu planeta.',
    away: 'Su planeta está defendido por lo que dejaron atrás.',
    intermittent:
      'Una lectura intermitente se actualiza cada veinte minutos en el mejor de los casos. Verificar nuevamente no mejorará: la respuesta está fija hasta que se abre la ventana.',
  },

  probes: {
    openDossier: 'Abrir expediente',
    heading: 'Informes de sonda',
    newest: 'más nuevo primero',
    missing: 'Ninguna sonda ha regresado nunca',
    gives: 'Estimaciones de sus recursos y unidades, mostradas como rangos. No garantiza el resultado de la batalla.',
    /**
     * THE FIGURES ARE INTERPOLATED, NOT WRITTEN. D59.
     *
     * This line said "220 alloy" for two phases while `PROBE` charged 50 and 50 —
     * a price the game had never charged, on the one card whose whole job is to
     * sell scouting to somebody deciding whether to look or to hit. It is passed
     * the real constants now, so it cannot drift from them again.
     *
     * Speed leads the sentence on the owner's instruction: a probe is the fastest
     * thing a commander can arm, and nobody was using it.
     */
    cost: 'Rápido y barato: aleación {{alloy}}, cristal {{crystal}} y supera a todos los buques de guerra que posees. Su radar puede captarlo.',
    stock: 'Valores',
    defence: 'Valor de unidad armada',
    ships: 'Naves',
    accuracyHome: '{{percent}} precisión · la flota estaba en casa',
    accuracyOut: '{{percent}} precisión · la flota estaba fuera',
    scaleNote: 'Cada barra parte de cero: la banda es su estimación, la línea turquesa es tu mundo.',
    estimateNote: 'Estos números son rangos estimados. El valor de la unidad armada excluye el escudo y los naves desarmados.',
    caught: 'lo pillaron\nLa flota',
    /* Two words beside the signal bars, which carry the accuracy themselves. */
    homeTag: 'estaba en casa',
    outTag: 'estaba fuera',
  },

  radar: {
    glance: 'Radar · últimas 24 h',
    contacts_one: '{{count}} contacto',
    contacts_other: '{{count}} contactos',
    dayAgo: '−24 h',
    now: 'ahora',
    day: 'Últimas 24 horas',
    heading: '¿Quién te está mirando?',
    level: 'Radar L{{level}}',
    missing: 'No tienes radar',
    gives:
      'Dibuja el círculo en el que ves las naves en movimiento, detecta las sondas que apuntan a ti y marca una amenaza dirigida a tu mundo con el tiempo que le queda para volar.',
    cost: 'Alguien puede hacerse una idea completa de este planeta y nunca lo sabrás.',
    quiet: 'Nada te ha escaneado. El radar L{{level}} está escuchando.',
    scan: 'Escaneo detectado',
    bearing: 'del galáctico {{bearing}}',
    origin: '· {{planet}}',
    /** Which of the caller's own worlds the scan landed on. */
    onWorld: '· {{planet}}',
    /* Captions beside the two drawn rings; the picture carries the rest. */
    ringSense: 'Hay algo ahí fuera',
    ringWarn: 'Aviso cronometrado',
    /** While the two circles are one, one caption states what the circle does. */
    ringOne: 'Detección y aviso cronometrado',
    /**
     * THE READING FOR SOMEBODY WHO CANNOT SEE THE RINGS. The two circles carry
     * both figures and the difference between them; this is the same fact in the
     * one form a screen reader can take.
     */
    noteFleets:
      'El radar L{{level}} distingue una amenaza dirigida a usted en las unidades {{sense}}, sin reloj. En {{warn}} unidades agrega hora de llegada.',
    /** The merged form. One circle, both products, one sentence. */
    noteFleetsOne:
      'El radar L{{level}} muestra las naves en movimiento hacia las unidades {{sense}} y marca una amenaza dirigida a tu mundo con su hora de llegada.',
    /**
     * THE HALF NO PICTURE CAN DRAW. D49: a reach is what the defender owns and
     * the warning it buys is what the ATTACKER decides, by choosing what to fly.
     * The rings are fixed; how long something sits inside them is not.
     */
    noteSlow: 'Una flota lenta y pesada permanece dentro del alcance del radar por más tiempo.',
    noteProbesLegacy: 'El radar L{{level}} detecta sondas y advierte sobre flotas entrantes dentro de su círculo.',
    noteBearing: 'L2 agrega la dirección de donde vinieron.',
    noteOrigin: 'L5 nombra el planeta.',
  },
} as const;

export const reports = {
  heading: 'Informes de batalla',
  newest: 'más nuevo primero',
  empty:
    'Aún no se ha discutido nada. Una batalla es la única información en este juego que nunca se puede adivinar.',
  youRaided: 'Has asaltado',
  raidedBy: 'Asaltado por',
  rounds: '{{count}} rondas',
  sheetYouRaided: 'Objetivo: {{opponent}} · {{planet}}',
  sheetYouRaidedPirate: 'Objetivo: {{opponent}}',
  sheetTheyRaided: 'Atacante: {{opponent}}',
  attackedPlanet: 'Planeta atacado: {{planet}}',
  heldAgainstYou: '{{planet}} siguió defendiendo. No obtuviste ningún botín de esta incursión.',
  brokenByYou: 'Dañaste la defensa en {{planet}}.',
  /**
   * A PIRATE VERDICT NAMES NO WORLD, because there is not one. Both sentences
   * above are built around `{{planet}}`, which is the empty string out here.
   */
  pirateBroken: 'La tripulación se rompió. Lo que quedó de ellos es tuyo.',
  pirateHeld: 'Los piratas siguieron defendiéndose. No obtuviste ningún botín de esta incursión.',
  /** The prize, and the only door in the game into a hull you did not build. */
  pirateCaptured: 'De piratas',
  pirateCapturedNote:
    'Tomado intacto de los restos de una tripulación que destruiste. Se une a la guarnición en el mundo al que regresa tu flota (incluso por encima de la capacidad del hangar) y no cuenta como una que tú construiste.',
  youHeld: 'Detuviste la incursión. El atacante no tomó recursos.',
  youFell: 'El ataque dañó tu defensa.',
  /** The price of the haul, beside it. `Rounds` is the model's number, not the player's. */
  shipsLost: 'Naves perdidos',
  haul: 'Lo que llegó a casa',
  haulLost: 'Lo que se llevaron',
  /** What your Garbage Collectors lifted — beside the haul, never inside it. D200. */
  salvageHaul: 'Rescatado del naufragio',
  roundsLabel: 'Rondas',
  taken: 'Tomado',
  lost: 'Perdido',
  dominion: 'Dominio',
  dominionSummaryGained: 'Obtuviste {{amount}} Dominio en esta batalla.',
  dominionSummaryLost: 'Perdiste {{amount}} Dominion en esta batalla.',
  dominionReason: 'El botín que conseguiste y las pérdidas permanentes del enemigo suman puntos. El botín que te quitan y tus pérdidas permanentes restan puntos. Se utiliza el valor del recurso, no el número de envíos.',
  dominionBreakdown: {
    title: 'Cómo se movió Dominion',
    lootGained: 'Botín asegurado',
    lootLost: 'Te quitaron el botín',
    enemyLosses: 'Pérdidas permanentes del enemigo',
    ownLosses: 'Tus pérdidas permanentes',
    total: 'Cambio de puntos totales',
  },
  clansAtLaunch: 'Clanes cuando se lanzó esta flota',
  yourClan: 'Tu lado',
  theirClan: 'Su lado',
  noClan: 'Sin clan',
  verdict: {
    label: 'Resultado de la batalla',
    yourForce: 'Tu fuerza',
    yourLosses: 'Tus pérdidas',
    sent: 'Enviado',
    held: 'Tenía',
    total: 'Total',
    lost: 'Perdido',
    returned: 'sobrevivió',
    standing: 'De pie',
    destroyed: 'Destruiste',
    enemyDestroyed: 'Unidades enemigas destruidas',
    attackerDestroyed: 'Naves atacantes destruidos',
    noneReturned: 'Ninguno de tus naves sobrevivió a la batalla.',
    someReturned: '{{count}} de tus naves sobrevivieron a la batalla.',
    enemySurvivedNote: 'Las unidades enemigas permanecen; su cuenta está oculta. Este número es sólo lo que destruiste.',
    enemyUnknownNote: 'Este número es solo lo que destruiste; el recuento de enemigos restante está oculto.',
    loot: 'Botín',
    rosterUnknown: 'Este informe no tiene recuento inicial. El recuento de supervivientes no se puede calcular.',
    walkoverSummary: 'No había unidades allí para defender el objetivo. No hubo pelea.',
    piratePartialSummary: 'Parte de la flota pirata todavía estaba viva al final de la batalla.',
    title: {
      attacking: {
        DECISIVE: 'Tu incursión fue exitosa',
        DECISIVE_WIPED: 'Has roto la defensa pero perdiste tu flota.',
        PARTIAL: 'Tu incursión fue parcialmente exitosa',
        PARTIAL_WIPED: 'Dañaste la defensa pero perdiste tu flota.',
        REPELLED: 'Tu ataque fue repelido',
      },
      defending: {
        DECISIVE: 'Tu defensa fue violada',
        PARTIAL: 'Su defensa fue parcialmente violada',
        REPELLED: 'Detuviste la redada',
      },
    },
    summary: {
      attacking: {
        DECISIVE: 'No quedan unidades para defender el objetivo.',
        PARTIAL: 'No se cumplió la condición de éxito total: las unidades defensoras o el escudo todavía estaban en pie.',
        REPELLED: 'El enemigo siguió defendiendo. No tomaste ningún botín.',
      },
      defending: {
        DECISIVE: 'Todas tus unidades defensoras fueron destruidas en esta batalla.',
        PARTIAL: 'El atacante no tuvo éxito del todo: tus unidades o tu escudo todavía estaban en pie.',
        REPELLED: 'Tu defensa aguantó. El atacante no se llevó ningún botín.',
      },
    },
  },
  /*
    WHAT IT SHOWS IS LOSSES, so that is what it says. The heading claimed 'what
    they had' over a list of what was DESTROYED — and its own empty state said
    'nothing of theirs was destroyed', so the two disagreed inside one block.
    Losses are still the floor on what they fielded; the dossier is where that
    inference is drawn, and it says 'at least' in as many words.
  */
  theirLosses: 'Lo que destruiste',
  theirs: 'Lo que tenían',
  theirsEmpty: 'Nada de ellos fue destruido.',
  /** The roster table. 'What it cost you' describes one of its three columns. */
  yourForce: 'Tu fuerza',
  yours: 'Lo que te costó',
  yoursEmpty: 'No perdiste nada.',
  howItWent: 'Cómo te fue',
  reasonHeading: '¿Por qué este resultado?',
  rulesToggle: 'Reglas de batalla y cálculo',
  roundCalculationToggle: 'Mostrar el cálculo de tiro de esta ronda',
  roundLossesYours: 'Tus unidades destruidas',
  roundLossesTheirs: 'Unidades enemigas destruidas',
  roundNoCasualties: 'Sin pérdidas',
  roundShield: 'El escudo del defensor absorbió el daño {{amount}}.',
  turningPointSupport: 'Después de la ronda {{round}}, no tenías unidades capaces de disparar. Las {{support}} naves de apoyo restantes no pudieron atacar.',
  turningPointWiped: 'Después de la ronda {{round}}, toda tu fuerza fue destruida.',
  roundDamageNote: 'Las cifras de daño incluyen cualquier daño absorbido por el escudo del defensor.',
  roundDealt: 'Has negociado',
  roundTook: 'Tomaste',
  roundLine: 'repartiste <0>{{dealt}}</0>, tomaste <1>{{took}}</1>',
  shield: 'escudo {{amount}}',
  shieldBreaker: 'Anulador +{{amount}}',
  aegis: {
    aria: 'Escudo de égida',
    label: 'AEGIS',
    labelTheirs: 'Escudo de Égida del enemigo',
    labelYours: 'Tu escudo Égida',
    broken: 'BROKEN',
    roundedZero: 'REPORTADO 0',
    damaged: 'DAMAGED',
    held: 'HELD',
    before: 'Antes de la batalla',
    after: 'Después de la batalla',
    note: 'El escudo del planeta sufre daños antes que cualquier unidad defensora.',
    brokenUnitsRemain: 'El escudo informa 0, pero las unidades defensoras sobrevivieron.',
    brokenDefenceGone: 'El escudo se rompió. Todas las unidades defensoras también fueron destruidas en esta batalla.',
    brokenMeaning: 'La fuerza del escudo está redondeada. Un 0 por sí solo no prueba que todas las fuerzas defensoras hayan sido destruidas.',
    absorbed: '{{amount}} daño del escudo absorbido',
  },
  /* ── what a report owes each case. `docs/battle-reports.md` ── */
  /**
   * THE WALKOVER. `resolveCombat` breaks before round one when there is nothing
   * standing and no shield, so the most common raid in the game arrives with
   * `rounds: []` — and drew a heading over an empty plate.
   */
  /** The four questions a battle report answers, in the order a reader asks them. */
  q: {
    happened: '¿Qué pasó?',
    there: 'Lo que aprendiste sobre el enemigo',
    enemyForce: 'Unidades enemigas al inicio de la batalla',
    enemyLosses: 'Lo que destruiste del enemigo',
    incomingForce: 'La flota que te atacó',
    who: '¿Qué pasó con tu fuerza?',
    changed: 'Botín y cambios de puntos',
  },
  walkoverHeading: 'No había ninguna fuerza defensora aquí.',
  walkoverBody:
    'Aquí no había ninguna flota de combate ni defensa terrestre. Tus naves llegaron, cargaron y partieron. No hubo pelea que reportar.',
  walkoverDefendingBody:
    'No había unidades defensoras en tu mundo. La flota atacante podría hacerse con el botín disponible sin luchar.',
  /** Their board, and how far the reading goes. */
  theirBoardComplete: 'Todas las unidades que defienden al comienzo de la batalla.',
  theirBoardCompleteNote:
    'Todos fueron destruidos en esta batalla. Es posible que algunos cañones terrestres se reconstruyan después de la batalla.',
  theirBoardEmptyAtStart: 'No había unidades defensoras aquí al principio.',
  theirBoardEmptyAtStartNote:
    'No había naves de combate ni cañones terrestres en el objetivo, por lo que aquí no hay una lista de unidades destruidas.',
  theirBoardFloor: 'Solo unidades destruidas',
  theirBoardFloorNote:
    'Esta no es toda la flota enemiga. Enumera sólo las unidades destruidas en esta batalla. Las unidades restantes no se revelan aquí; enviar una nueva sonda para un presupuesto.',
  theirBoardMissingRosterNote: 'Este informe no tiene una lista inicial para la flota atacante. Sólo se enumeran los naves que destruiste; Los supervivientes no se pueden calcular.',
  theirBoardNothing: 'No destruiste nada',
  /**
   * THE DEFENDER'S VERSION, WHICH IS NOT A BOUND AT ALL. D164.
   *
   * The two above describe a reading with an edge to it — wreckage, and how far it
   * lets you see. This one describes a force the reader stood underneath, so it
   * makes no claim about limits: it names what arrived, and the bar beside each
   * hull says how much of it the defence took down.
   */
  theirBoardArrived: '¿Qué te vino?',
  theirBoardArrivedNote:
    'Toda la flota enviada hacia ti, incluidas las naves de combate y de apoyo. Cada fila indica cuántos llegaron, fueron destruidos y quedaron.',
  /** The wall, stated apart from the ships, because it is a different kind of thing. */
  groundHeading: 'Defensa terrestre',
  groundNote: 'Estas armas defienden el planeta y no pueden volar. {{percent}}% de cada tipo destruido se reconstruye después de la batalla, redondeando hacia abajo. Sus pérdidas se tratan por separado de las de los naves.',
  shipsHeading: 'Naves',
  noGroundHeading: 'Sin defensa terrestre',
  noGroundNote: 'Este mundo no tenía ningún muro cuando llegaste.',
  calculation: {
    intro:
      'La receta fija anterior produce los números siguientes. Luego, cada ronda sigue los mismos tres pasos.',
    formulaHeading: 'Cómo se construye el poder de ataque',
    formulaBase: '1 · Base: recuento de unidades × ataque × investigación.',
    formulaCounter: '2 · Contador: coincidencia fuerte ×{{strong}}; coincidencia débil ×{{weak}}.',
    formulaRoll: '3 · Cambio de tiro: −{{min}}% a +{{max}}%.',
    formulaHp: 'El daño se divide por la proporción de HP total de los objetivos.',
    formulaCarry: 'Una unidad necesita que todos sus HP caigan; el daño incompleto se traslada a la siguiente ronda.',
    formulaSupport: 'Los naves de apoyo permanecen protegidos mientras al menos una unidad de combate permanece de su lado.',
    resultHeading: 'Cómo se decide el resultado',
    resultDecisive:
      'DECISIVO · todas las unidades defensoras han desaparecido y el escudo está en cero · {{decisiveLoot}}% del material expuesto se puede tomar antes de los límites de carga.',
    /**
     * THE SAME RULE WITHOUT THE HALF THAT CANNOT APPLY. A shield is a structure on
     * a world; a legend that names one out at a rendezvous is describing a
     * condition the reader could never have met or failed.
     */
    resultDecisivePirate:
      'DECISIVO · todos los naves de la tripulación se han ido · {{decisiveLoot}}% del tesoro se puede tomar antes de los límites de carga, y solo aquí se puede remolcar un casco a casa.',
    resultPartial:
      'PARCIAL · al menos {{threshold}}% del valor de la unidad defensora se destruye · {{partialLoot}}% del stock expuesto se puede tomar antes de los límites de carga.',
    resultRepelled:
      'REPELIDO · menos del {{threshold}}% del valor de la unidad defensora es destruido · no se puede tomar nada.',
    round: 'Ronda {{round}}',
    fire: '1 · Fuego simultáneo',
    fireNote: 'Ambos bandos disparan antes de que se eliminen las pérdidas. Una unidad destruida en esta ronda seguirá disparando.',
    yourShot: 'Tu oportunidad',
    theirShot: 'Su disparo',
    shotChange: 'Cambio de tiro',
    positivePercent: '+{{amount}}%',
    negativePercent: '−{{amount}}%',
    neutralPercent: '0%',
    aegis: '2 · Égida recibe el golpe',
    noAegis: '2 · Sin Égida activa',
    shieldCharge: 'Carga de escudo',
    absorbed: '{{amount}} absorbido',
    reachedHulls: 'Cascos alcanzados',
    shieldBreaker: '{{amount}} era daño de escudo solo anulador',
    noAegisNote: 'Nada captó el golpe; Todo el poder de ataque {{amount}} llegó a los cascos defensores.',
    /** The same step, in open space: there is no world here and so no structure. */
    openSpace: '2 · Nada entre los cañones y los cascos',
    openSpaceNote:
      'Una cita no tiene mundo ni estructura para recibir un golpe; Todo el poder de ataque {{amount}} llegó a la tripulación.',
    losses: '3 · Las pérdidas abandonan la batalla',
  },
  /** The three outcomes the whole combat model produces. */
  gradeDecisive: 'DECISIVE',
  gradePartial: 'PARTIAL',
  gradeRepelled: 'REPELLED',
  strategicFirstStrike: 'IMPACT',
  strategicEmpEffect: 'La Égida cayó a cero y no se regenera durante 1 hora. Las defensas terrestres no disparan ni reciben daño en ese tiempo.',
  strategicLoyalty: "Lealtad de la colonia",
  strategicLoyaltyChange: "{{before}} % → {{after}} %",
  strategicLoyaltyNext: "Con {{loss}} % o menos, el siguiente impacto se lleva la colonia.",
  strategicSecededAttacker: "La colonia se separó y quedó neutral: ahora no es de nadie.",
  strategicSecededDefender: "Tu colonia se separó y quedó neutral.",
  strategicSecededShort: "colonia separada",
  strategicCaptured: 'CAPTURED',
  strategicIneffective: 'INEFFECTIVE',
  strategicIntercepted: 'INTERCEPTED',
  strategicYouAttacked: 'Tu Estrella de la Muerte apuntada',
  strategicAttackedBy: 'Estrella de la Muerte enviada por',
  strategicDestroyedInFlight: 'Estrella de la Muerte destruida en vuelo',
  strategicRadarTrigger: 'El mundo objetivo se enfrentó a él después de que cruzó el anillo de intercepción del Radar L3+.',
  strategicTelescopeTrigger: 'El defensor lo enfrentó después de que uno de sus mundos lo identificó a través de la mira del telescopio.',
  strategicTotalDamage: 'Valor total destruido',
  strategicShieldLost: 'Escudo destruido',
  strategicResourcesLost: 'Recursos destruidos',
  strategicOrdersLost: 'Trabajo en cola destruido',
  strategicResourceBreakdown: 'Recursos destruidos',
  strategicNoFleetLost: 'No se destruyó ninguna flota estacionada ni defensa terrestre.',
  strategicLevelLosses: 'Niveles perdidos',
  strategicNoLevelLoss: 'No se perdió ningún edificio o nivel de instrumento.',
  strategicDestroyedOrders: 'Construcción destruida',
  strategicNoOrdersLost: 'No se destruyó ninguna orden de construcción activa.',

  /** A world nobody holds. There is no commander to name. */
  neutralHolder: 'un mundo no reclamado',

  /**
   * WHAT THE STAMP AT THE TOP OF THE REPORT ACTUALLY MEANS.
   *
   * The grade sets the loot share and how long the works stay down, so it is the
   * most consequential word on the surface — and nothing in the game had ever said
   * what separates the three.
   *
   * IT IS SAID WITHOUT JARGON AND FROM THE READER'S SIDE, and both halves of that
   * were got wrong first. "More than 42% of the DEFENCE VALUE was destroyed" is a
   * combat model talking to itself: `defenceValue` is an internal quantity, the
   * percentage is a threshold nobody can act on, and the sentence is written from
   * nobody's point of view — so the commander who had just been raided read a
   * neutral description of their own losses. A player should finish this line
   * knowing what happened to THEM and why the haul was the size it was.
   */
  why: {
    attacking: {
      DECISIVE: 'Destruiste todo lo que lo defendía y rompiste el escudo, que es lo que abre el botín completo.',
      DECISIVE_WIPED: 'Destruiste todas las unidades defensoras, pero ninguna de tus naves sobrevivió para llevar el botín a casa.',
      DECISIVE_WITHOUT_SHIELD: 'Destruiste todo defendiéndolo, que es lo que abre el recorrido completo.',
      WALKOVER: 'No había unidades defensoras aquí; el botín disponible estaba abierto a tu flota.',
      PARTIAL: 'Infligiste suficiente daño para un éxito parcial, pero no para un éxito total. Sólo una parte del botín estuvo disponible; sin espacio de carga restante, no se puede llevar nada.',
      PARTIAL_WIPED: 'Causaste suficiente daño para lograr un éxito parcial, pero ninguno de tus naves sobrevivió para llevar el botín a casa.',
      REPELLED: 'El valor de recursos de las unidades destruidas no alcanzó el {{threshold}}% del valor inicial de todas las unidades defensoras. Por eso fue repelida la incursión; El recuento de naves o romper el escudo por sí solo no decide el resultado.',
    },
    defending: {
      DECISIVE: 'Todas tus unidades defensoras cayeron y el escudo se rompió, abriendo el botín disponible para los asaltantes. La cantidad extraída depende del espacio de carga restante.',
      DECISIVE_WITHOUT_SHIELD: 'Todas tus unidades defensoras cayeron, abriendo el botín disponible a los asaltantes. La cantidad extraída depende del espacio de carga restante.',
      DECISIVE_WIPED: 'Todas tus unidades defensoras cayeron, al igual que todos los naves con los que vinieron. El botín estaba abierto y no quedaba nada vivo para llevarlo a casa.',
      WALKOVER: 'No había unidades defensoras en tu mundo, por lo que el botín disponible estaba abierto a los asaltantes.',
      PARTIAL: 'El atacante causó suficiente daño para un éxito parcial, pero no total. Sólo una parte del botín estuvo disponible.',
      PARTIAL_WIPED: 'El atacante causó suficiente daño para lograr un éxito parcial, pero ninguno de sus naves sobrevivió para transportarlo. Nada salió de tu mundo.',
      REPELLED: 'Tu defensa aguantó. No superaron nada y no se llevaron nada.',
    },
  },

  /** Everything a battle did beyond the loot line, each said only when true. */
  effects: {
    heading: 'Qué hizo',
    shieldTheirs: 'Su escudo absorbió el daño {{amount}} antes de que algo alcanzara el casco.',
    shieldYours: 'Tu escudo absorbió el daño {{amount}} antes de que algo alcanzara el casco.',
    cargoLimited:
      'Tus reservas estaban llenas. Había más en ese mundo de lo que podías transportar: trae transportes Mensajero, Caminante, Atlas o Argosy.\nEl cañón terrestre',
    salvaged_one: '{{count}} fue reconstruido a partir de sus propios restos después de la batalla.',
    salvaged_other: '{{count}} Los cañones terrestres fueron reconstruidos a partir de sus propios restos después de la batalla.',
    worksTheirs: 'Sus trabajos están fuera de línea para {{duration}}. Allí no se produce nada.',
    worksYours: 'Tus obras quedaron fuera de línea durante {{duration}}.',
    /** The defender's copy of what the raider's collectors lifted. D200. */
    salvageTheirs: 'Sus recolectores de basura levantaron {{amount}} los restos antes de que pudieran desplazarse.',
    /** Koloni arızaları: what a heavy defeat broke. Defender only. */
    /** Taktik geri çekilme. Defensor: qué despegó y cuánto quemó, o por qué no pudo. */
    escaped_one: 'Tu nave despegó antes del combate (−{{fuel}} Deuterio): el ataque superaba a tu línea tres a uno.',
    escaped_other: 'Tus {{count}} naves despegaron antes del combate (−{{fuel}} Deuterio): el ataque superaba a tu línea tres a uno.',
    stranded: 'Tus naves habrían despegado, pero el depósito no alcanzó: hacían falta {{fuel}} de Deuterio y había {{available}}.',
    /** Atacante: la línea se vació ante el ataque; nada sobre lo que tenía. */
    fled: 'Sus naves despegaron antes del combate: una línea superada tres a uno que iba a ser aniquilada huye si su depósito puede pagarlo.',
    colonyFaults: 'Roto en {{planet}} por esta derrota: {{faults}}.',
    /**
     * Recovery shield, defender only: the NET loss of the lookback at this battle, in
     * hours of the reader's own production, against the bar. Owner instruction, 2026-09-18.
     */
    recoveryProgress:
      'Escudo de recuperación: {{hours}} de {{bar}} h de su producción perdida, neta, durante las últimas {{window}} h. Llega a {{bar}} y nadie podrá atacarte durante {{shield}} h; Se restan las ganancias de tus propias incursiones.',
    recoveryEarned:
      'Esta derrota te valió un escudo de recuperación {{shield}} h: {{hours}} h de tu producción perdida, neta, durante las últimas {{window}} h.',
    recoveryRefused:
      '{{hours}} h de tu producción perdida, neta, durante el último {{window}} h, más allá de la barra {{bar}} h, pero no se otorga ningún escudo mientras tu propia incursión está en el aire.',
    wreck: '{{amount}} entre los restos se desplaza sobre {{planet}}. Cualquiera puede ir y tomarlo.',
    /** The same field, read from the world it is drifting over. */
    wreckYours: '{{amount}} entre los restos está a la deriva en tu propia órbita. Cualquiera puede ir y tomarlo, incluido usted.',
    /** No orbit to name: the field sits at the rendezvous, in open space. */
    wreckVoid:
      '{{amount}} entre los restos está a la deriva en el punto de encuentro, en el espacio abierto. Envíe un prospector, y también puede hacerlo cualquier otra persona que haya visto cómo sucedió.',
  },

  /** The caller's own board: what went in, what died, what was standing after. */
  force: {
    /** Screen-reader only: the bar is the picture, this is what it says. */
    reading: '{{sent}} adentro, {{lost}} perdido, {{left}} izquierdo',
    hull: 'Casco',
    /** The attacker chose to send it; the defender simply had it there. */
    sent: 'Enviado',
    held: 'Tenía',
    lost: 'Perdido',
    left: 'Izquierda',
    rebuilt: 'Reconstruido',
    start: 'Al inicio',
    arrived: 'Llegó',
    rebuiltNote: '{{count}} los cañones terrestres destruidos fueron reconstruidos después de la batalla; incluido en el recuento restante.',
    groundType: 'Cañón terrestre · no puede volar',
    supportType: 'Nave de apoyo · no puede disparar',
    combatType: 'Nave de combate',
    summary: '{{brought}} en la pelea · {{lost}} destruido · {{left}} en pie',
  },
  /** Whose casualties. Both sides fly Darts, so colour alone cannot say it. */
  roundTheirs: 'Ellos',
  roundYours: 'Tú',
  roundNoLosses: 'Ningún bando perdió una unidad esta ronda.',
  roundStanding: {
    unknownOwn: 'Este informe no tiene recuentos iniciales; las unidades restantes no se pueden calcular.',
    heading: 'Tu bando después de la ronda {{round}}',
    enemyHeading: 'Flota atacante después de la ronda {{round}}',
    summary: '{{combat}} unidades capaces de disparar · {{support}} naves de apoyo desarmados',
    supportExposed: 'Los naves de apoyo no pueden disparar. No quedan unidades de combate para protegerlos.',
    noneLeft: 'No te quedan unidades para seguir luchando.',
    unknownEnemy: 'La cuenta restante del enemigo está oculta. Las pérdidas enemigas mencionadas anteriormente no representan toda su flota.',
  },
} as const;

/** One telescope reading, rendered as certainty. */
export const clarity = {
  barsLabel: 'Claridad {{state}}',
  stateFull: 'lleno',
  stateClear: 'claro',
  stateIntermittent: 'intermitente',
  stateDegraded: 'degradado',
  stateBlind: 'ciego',
  unreadable: 'UNREADABLE',
  fleetHome: 'INICIO DE LA FLOTA',
  fleetAway: 'FLOTA LEJOS',
  backIn: '· de vuelta en {{minutes}}m',
  unwatched: 'ningún reloj asignado',
} as const;

/** What you know about another world, and how you know it. */
export const dossier = {
  /* The E2 target dossier (docs/ui-v2/gozlemevi.md), in the mock's words. */
  page: {
    peekWing: "tu ala {{value}}",
    peekDefence: "defensa {{band}}",
    peekDefenceUnknown: "defensa desconocida",
    rival: "Rival {{n}}",
    range: "Distancia {{d}}",
    flight: "vuelo de {{time}}",
    unreachable: "Fuera de alcance",
    known: "Conocido {{have}}/{{total}}",
    lookNone: "Ninguna sonda ha mirado dentro",
    lookProbe: "Informe de sonda",
    shape: "Composición leída",
    shareUnread: "sin leer",
    lootRow: "{{label}}: {{band}} · tu bodega {{cargo}}",
    others: "Otras lecturas",
    wing: "Tu ala en casa",
    power: "Poder",
    loot: "Botín",
    lootTag: "estimación",
    lootMeaning: "Lo que una victoria decisiva podría llevarse, según la sonda — la parte del Almacén ya está descontada.",
    lootPartial: "Victoria parcial",
    lootHold: "Tu bodega {{cargo}}",
    lootShort: "Tu bodega lleva {{cargo}}; la mayor parte se quedaría atrás.",
    colony: "Colonia",
    colonyRule: "Una victoria decisiva quita {{decisive}} de lealtad, una parcial {{partial}}. A cero, la colonia pasa a neutral con sus edificios y su reserva: la toma quien llegue primero.",
  },
  sourcePublic: 'Público',
  sourceTelescope: 'Telescopio',
  sourceProbe: 'Sonda',
  sourceBattle: 'Informe de batalla',

  confidencePrecise: 'preciso',
  confidenceGood: 'bien',
  confidenceRough: 'bruto',
  confidenceVague: 'impreciso',

  ownerLabel: 'Celebrado por',
  ownerNote: 'Gratis para todos, durante toda la temporada.',
  ownerRecordNote: 'Cuya bandera encontró su sonda. Es posible que haya cambiado de manos desde entonces.',

  developmentLabel: 'Desarrollo',
  developmentValue: 'Nivel {{tier}}',
  developmentVersus: 'Nivel {{tier}} · tú {{mine}}',
  developmentBandNote:
    "Las incursiones y los ataques de la Estrella de la Muerte solo se permiten entre comandantes separados por un nivel como máximo, contando el mundo más desarrollado de cada uno. El tuyo es nivel {{mine}}, así que alcanzas los niveles {{low}}–{{high}}. Puede que este no sea su mundo más desarrollado.",

  hardwareLabel: 'Satélites en órbita',
  hardwareNote: 'Puedes ver el hardware. Lo que puede hacer cuesta una investigación.',
  hardwareRecordNote: 'Qué estaba en órbita cuando pasó tu sonda. Es posible que hayan construido más.',

  fleetLabel: 'Su flota',
  fleetUnreadable: 'Ilegible',
  fleetAway: 'No en casa',
  fleetHome: 'Inicio',
  fleetVeiledNote: 'Su Velo está superando a tu Telescopio. Levántelo o envíe una sonda en su lugar.',
  fleetAwayUnknownNote: 'No puedes saber cuándo regresa. Ese es el riesgo que estás corriendo.',
  fleetAwayNote: 'Su planeta está defendido por lo que dejaron atrás.',
  fleetHomeNote: 'La observación es silenciosa: nunca se les dice que estás mirando.',

  fleetGapNoTelescope: 'No tienes telescopio',
  fleetGapOutOfRange: 'Más allá del alcance de su telescopio',
  fleetGapNoSlot: 'No se señala ninguna ranura aquí',
  fleetGapWhy:
    'El hecho más valioso del juego: una flota que está fuera no puede defender su planeta.',
  fleetGapRange: 'alcanza {{reach}}; este mundo está a {{distance}} de distancia',
  fleetGapSlots: 'Todas las ranuras {{count}} están en uso; una debe moverse',

  /**
   * THE LABEL FOLLOWS THE NUMBER. The probe reports what a raid could TAKE now —
   * `raidableStock` — rather than the whole store, so "Resources held" would be
   * naming a different quantity than the one printed under it.
   */
  stockLabel: 'Asaltable ahora',
  stockNote: 'Qué incursión decisiva podría lograr. El suelo de la bóveda no está ahí y tus propias bodegas pueden taparlo aún más.',
  stockCaught: 'Su radar captó la sonda; saben que alguien miró.',
  stockClean: 'La sonda entraba y salía desapercibida.',
  /** The one force unit, D199 — what the hulls and guns that can fire cost. */
  defenceLabel: 'Valor de unidad armada',
  defenceNote: 'Costo de recursos para disparar naves y cañones terrestres cuando pasó la sonda. No daño de ataque; excluye el escudo y los naves desarmados.',
  defenceRatio: 'Acerca de ×{{ratio}} lo que aparece en {{world}}.',
  shapeLabel: 'Forma de la pared',
  shapeNote: 'Por valor, de lo que puede disparar. Más de la mitad es mayoría.',
  shapeUnread: 'No leído',
  shapeUnreadNote: 'Su Velo es más fuerte que el Astillero que envió la sonda.',
  shieldLabel: 'Carga de escudo',
  shieldNote: 'Recibe el fuego de una incursión antes que cualquier casco y se recarga con el paso de las horas.',
  unarmedLabel: 'Desarmado en la fila',
  unarmedNote: 'No disparan nada, y un barrido limpio aún debe hundirlos a todos.',
  shipsLabel: 'Naves contados',
  shipsAllHome: 'Todo lo que poseen era su hogar.',
  shipsSomeOut: 'Algunas de sus naves estaban fuera.',

  /**
   * THE FOUR READINGS THE PROBE ALWAYS TOOK AND NOTHING EVER PRINTED.
   *
   * Each one names WHEN it was true rather than asserting it now, because all
   * four are frozen at the look. The dossier prints the age beside them.
   */
  /**
   * THE FUEL SHARE OF THE BAND ABOVE, NOT THE TANK. D166.
   *
   * It used to read the whole store while sitting directly under "Raidable now",
   * so the one deuterium figure on the screen measured a different quantity from
   * every other number beside it. Both come off `computeLoot` now, and the label
   * says which question this answers.
   */
  deuteriumLabel: 'Deuterio atacable',
  deuteriumNote: 'La cuota de combustible de la banda de arriba: lo que podría lograr una incursión decisiva.',
  strategicLabel: 'Arma estratégica',
  strategicReady: 'Armado y listo',
  strategicBuilding: 'En construcción',
  strategicUnknown: 'Algo en el pad',
  strategicNote: 'Visto en el pad cuando pasó la sonda. Es posible que haya volado desde entonces.',
  strategicUnknownNote: 'La sonda era demasiado gruesa para saber qué tan avanzada está.',
  interceptorLabel: 'Defensa estratégica',
  interceptorCount_one: "{{count}} carga lista",
  interceptorCount_other: "{{count}} cargas listas",
  interceptorCountNote: "Cada carga destruye una Estrella de la Muerte. Si llegan {{needed}} a la vez, una pasa. Puede que hayan cargado más desde entonces.",
  interceptorEmpty: "Sin carga",
  interceptorEmptyNote: 'Nada aquí detiene un arma estratégica. Es posible que hayan cargado uno desde entonces.',
  loyaltyLabel: "Lealtad de la colonia",
  loyaltyValue: "{{value}} %",
  loyaltyNote_one: "Una Estrella de la Muerte quita {{loss}} de lealtad y una colonia con {{loss}} o menos se separa: un impacto bastaría.",
  loyaltyNote_other: "Una Estrella de la Muerte quita {{loss}} de lealtad y una colonia con {{loss}} o menos se separa: harían falta {{count}} impactos. Se recupera mientras nada esté averiado.",
  doctrinesLabel: 'Doctrina de combate',
  doctrinesNone: 'Ninguno investigado',
  doctrinesNote: 'Sus cascos luchan mejor de lo que dice la tabla. Este es el multiplicador que encontrarías.',
  doctrinesNoneNote: 'No habían investigado nada en sus cascos cuando la sonda miró.',

  surfaceGapLabel: 'Todo sobre este mundo',
  surfaceGapMissing: 'Nunca has visto este mundo',
  surfaceGapWhy:
    'No puedes ver quién lo sostiene, qué tan lejos están o qué hay en órbita. Una sonda lo recupera todo a la vez.',

  probeGapLabel: 'Recursos y defensa',
  probeGapMissing: 'Nunca has mirado de cerca',
  probeGapAged: 'Tu lectura de este mundo ha caducado',
  probeGapWhy:
    'Estás a punto de apostar una flota a lo que hay ahí abajo. Una sonda convierte esa suposición en un rango.',

  compositionLabel: 'Conocido por el campo',
  compositionValue: 'al menos {{fleet}}',
  compositionNote: 'Lo que destruiste la última vez que peleaste. Es posible que hayan reconstruido.',
  compositionGapLabel: 'Lo que realmente vuelan',
  compositionGapMissing: 'Nunca has luchado contra ellos',
  compositionGapWhy: 'Un informe de batalla es el único lugar del que proviene una composición exacta.',
} as const;
