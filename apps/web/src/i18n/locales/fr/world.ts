/**

* LE DISQUE ET TOUT CE QU’IL CONTIENT — le cadre de la galaxie, la page du
* commandant et le panneau de focus qui répond à la question :
* « qu’est-ce que c’est, et qu’est-ce que j’en sais ? »
*
* Les phrases qui décrivent les limites d’information dans le panneau de focus
* sont au cœur du jeu : elles disent au joueur ce qu’il NE VOIT PAS. Elles sont
* donc toujours formulées de manière simple et constante — une expression comme
* « cette lecture ne contient pas cette information » doit garder la même forme
* partout pour que le joueur apprenne instinctivement où se trouve la limite.
  */
export const galaxy = {
  settlementAway: "Mission de colonisation lancée vers {{world}}",
  deathStarAway: "Étoile de la Mort lancée vers {{world}}",
  online: "{{count}} en ligne",
  onlineToday: "{{count}} sur les dernières 24 h",
  worlds: "{{count}} planètes",
  fleetAway_one: " · {{count}} flotte en vol",
  fleetAway_other: " · {{count}} flottes en vol",
  rocks_one: " · {{count}} astéroïde",
  rocks_other: " · {{count}} astéroïdes",
  pirates_one: " · {{count}} pirate",
  pirates_other: " · {{count}} pirates",
  wrecks_one: " · {{count}} épave",
  wrecks_other: " · {{count}} épaves",
  asteroidShower: "Pluie d’astéroïdes",
  asteroidShowerStatus: "Apparition ×{{multiplier}} · {{remaining}} restantes",
  intergalacticConvoy: "Convoi Intergalactique",
  intergalacticConvoyStatus: "Traverse la galaxie · {{remaining}} restantes",
  openIntel: "Renseignement",
  /**

  * LE GLYPHE DE PLANÈTE EST DÉSORMAIS UN MOUVEMENT DE CAMÉRA, ET LA FICHE POSSÈDE
  * SON PROPRE REPÈRE. D163.
  *
  * `openWorlds` a disparu avec l’action qui ouvrait une liste depuis un glyphe
  * ressemblant à « aller sur ma planète » ; la liste elle-même est la fiche de
  * transfert et porte le nom de l’action que le commandant veut réellement y faire.
    */
  goHome: "Recentrer sur ta planète active",
  openTransfer: "Transfert entre tes mondes",
  /* Deux commandes de capteur sous le titre du disque. `aria-label` uniquement. */
  showTelescope: "Afficher la portée du Télescope",
  hideTelescope: "Masquer la portée du Télescope",
  showRadar: "Afficher la portée du Radar",
  hideRadar: "Masquer la portée du Radar",
  eventsGuide: {
    open: "Afficher les événements galactiques",
    eyebrow: "Calendrier hebdomadaire",
    title: "Événements galactiques",
    intro:
      "Les horaires des événements récurrents de semaine et de week-end sont indiqués ici.",
    timeZone: "Heure de Turquie (UTC+3)",
    nextLabel: "Prochain événement",
    nextUpcoming: "{{event}} · dans {{duration}}",
    localTime: "Heure locale · {{time}}",
    event: {
      ASTEROID_SHOWER: "Pluie d’Astéroïdes",
      TRADE_SHIP: "Vaisseau marchand",
      INTERGALACTIC_CONVOY: "Convoi Intergalactique",
    },
    dailyNote:
      "Semaine : lundi à vendredi. Week-end : samedi et dimanche. Les horaires sont indiqués à l’heure de Turquie.",
    days: {
      WEEKDAY: "Semaine",
      WEEKEND: "Week-end",
      EVERY_DAY: "Tous les jours",
    },
    asteroid: {
      title: "Pluie d’Astéroïdes",
      summary:
        "Au début de chaque heure, 1 astéroïde apparaît pour chaque commandant ayant joué pendant l’heure précédente. Pendant la pluie, ce nombre est multiplié par le coefficient de l’événement ; les astéroïdes déjà apparus restent jusqu’à leur disparition normale.",
    },
    trade: {
      title: "Vaisseau marchand",
      summary:
        "Sélectionne le vaisseau apparu dans la galaxie et échange tes ressources contre celles dont tu as besoin.",
      rate: "Taux fixe : 32 Alliage = 16 Cristal = 1 Deutérium.",
    },
    convoy: {
      title: "Convoi Intergalactique",
      summary:
        "Envoie une flotte contre le convoi pendant son passage ; selon ta puissance de feu, tu peux gagner jusqu’à l’équivalent de 4 heures de production de ton monde ainsi qu’une chance d’obtenir des vaisseaux.",
      note: "Le convoi ne riposte pas ; ta flotte ne subit aucune perte. Chaque monde ne peut attaquer qu’une seule fois pendant le même passage.",
    },
  },
  openResearch: "Recherche",
  openClan: "Clan",
  kindCapital: "Planète capitale",
  kindColony: "Colonie",
  kindNeutral: "Neutre · palier {{tier}}",
  /** Un monde que personne n’a encore sondé. C’est la seule chose honnête à afficher. D127. */
  /** Sous-ligne d’un monde mémorisé : la source du relevé et son ancienneté. D151. */
  recordAge: "Relevé · {{age}}",
  unsurveyed: "Inexploré",
  owned: "À toi",
  clanmate: "Membre de ton clan",
  rival: "Rival",
  recovery: "Fenêtre de récupération",
  emp: "Panne EMP",
  claimOpen: "Revendication ouverte",
  harvestAway: "{{count}} appareils partis · épave dans {{minutes}} min",
  miningAway: "{{count}} appareils partis · astéroïde dans {{minutes}} min",
  panelPlanetEyebrow: "Ta planète",
  panelCommanderEyebrow: "Commandant",
  panelIntelEyebrow: "Ce que tu sais",
  panelIntelTitle: "Renseignement",
  commander: {
    galaxyLabel: "Galaxie",
    galaxyUnknown: "—",
    endsLabel: "Fin de la saison dans",
    endsUnknown: "—",
    wipeNote:
      "À la réinitialisation, toutes les galaxies sont recréées depuis zéro et tout le monde recommence.",
    signOut: "Se déconnecter",
  },
} as const;
/**
 * LISTE DES MONDES QUE TU POSSÈDES. T3.
 *
 * Ce n’est pas une répétition des termes de `galaxy`, mais son propre espace de noms :
 * ici, « capitale » apparaît dans une ligne interactive ; sur le disque, dans une
 * légende. Les deux doivent pouvoir évoluer indépendamment — D55.
 */
export const worlds = {
  eyebrow: "Tes possessions",
  title: "Tes mondes",
  /** Nom propre de la liste ; sinon les lignes seraient trois boutons sans contexte. */
  list: "Tes mondes",
  active: "Actif",
  kindCapital: "Planète capitale",
  kindColony: "Colonie",
  craft_one: "{{count}} appareil",
  craft_other: "{{count}} appareils",
  bays: "Rampe",
  sendTitle: "Transfert rapide",
  /** Les deux extrémités de la phrase et son bouton. Les libellés servent au lecteur d’écran. D163. */
  sendFrom: "Depuis",
  sendTo: "Vers",
  send: "Transférer",
  /** Équivalent lecteur d’écran des deux visuels de la ligne. */
  store: "{{resource}} : {{amount}} sur {{cap}} de capacité",
  baysReading: "{{used}} baies de vol occupées sur {{total}}",
  alloy: "Alliage",
  crystal: "Cristal",
  deuterium: "Deutérium",
} as const;
export const focus = {
  shellLabel: "{{title}} — focus",
  clear: "Désélectionner",
  unknown: "Inconnu",
  planet: {
    transfer: "Transférer",
    settle: "Coloniser",
    settleNeedSlot: "Coloniser · aucun emplacement de colonie",
    settleNeedBay: "Coloniser · rampes de vol occupées",
    settleNeedCourier: "Coloniser · 2 Cargos requis",
    settleNeedAlloy: "Coloniser · manque d’Alliage",
    settleNeedCrystal: "Coloniser · manque de Cristal",
    settleNeedFuel: "Coloniser · manque de Deutérium",
    settleTooLate: "Coloniser · arrivée trop tardive",
    settleRecovering: "Coloniser · planète capitale en récupération",
    settleWhy: {
      recovering:
        "Ton monde est en récupération ; aucune flotte ne peut actuellement en décoller.",
      colonyCore:
        "Noyau de Commandement niveau {{required}} requis pour la prochaine colonie · niveau actuel {{current}}",
      colonyMax: "Tu possèdes déjà le nombre maximal de colonies : {{max}}.",
      flightBay:
        "Toutes les rampes de vol sont occupées ; tu pourras coloniser lorsqu’une flotte sera rentrée.",
      courier: "{{need}} Cargos requis · {{have}} présents ici",
      alloy: "{{need}} Alliage requis · {{have}} présents ici",
      crystal: "{{need}} Cristal requis · {{have}} présents ici",
      fuel: "{{need}} Deutérium requis · {{have}} présents ici",
      tooLate:
        "Les Cargos partant d’ici arriveraient après la fermeture de la course.",
    },
    settlementConfirm: {
      eyebrow: "Course à la colonisation",
      title: "Coloniser {{world}}",
      unsurveyedTitle: "Coloniser ce monde",
      race: "Le premier joueur à faire arriver 2 Cargos valides prend le contrôle de la planète.",
      noRecall:
        "Les vaisseaux de colonisation ne peuvent pas être rappelés. Si tu remportes la colonie, les ressources de fondation sont consommées et la planète s’ouvre avec le stock correspondant à son palier. Si quelqu’un arrive avant toi, tes Cargos et les ressources de fondation reviennent ; le carburant consommé, lui, n’est pas remboursé.",
      transports: "Vaisseaux de colonisation",
      foundingCost: "Coût de fondation",
      opensWith: "La colonie démarre avec",
      cargoValue: "{{alloy}} Alliage · {{crystal}} Cristal",
      stockValue:
        "{{alloy}} Alliage · {{crystal}} Cristal · {{deuterium}} Deutérium",
      fuel: "Carburant de vol",
      arrives: "Temps d’arrivée",
      closes: "Fermeture de la course dans",
      confirm: "Envoyer les vaisseaux de colonisation",
      confirming: "Envoi…",
    },
    deathStar: "Étoile de la Mort",
    deathStarStrike: "Étoile de la Mort · frappe EMP",
    /**

  * LE DEUXIÈME COÛT DE LA FRAPPE. Rapport au propriétaire : « par erreur ».
  *
  * L’action la plus coûteuse qu’un commandant puisse effectuer consomme l’arme
  * et apparaissait comme une simple ligne parmi plusieurs boutons de raid ordinaires.
  * Le monde est nommé explicitement parce qu’un mauvais appui l’enverrait sur la
  * mauvaise cible ; le texte rappelle la destruction et l’obscurité plutôt que
  * la défense, car les détails complets de la frappe appartiennent à l’atelier
  * où l’arme est produite.
    */
    strikeConfirm: {
      eyebrow: "Frappe EMP tactique",
      title: "Neutraliser {{world}}",
      lead: "L’Étoile de la Mort est consommée par la frappe. Aucun rappel n’est possible.",
      outage: "Panne EMP",
      keeps:
        "L’Aegis est vidée et ne se régénère pas pendant une heure. Les défenses terrestres restent désactivées et ne subissent aucun dégât.",
      commit: "Lancer l’EMP",
    },
    deathStarUnavailable: "Aucune Étoile de la Mort prête",
    deathStarProtected: "Étoile de la Mort · cible protégée",
    deathStarNeedBay: "Étoile de la Mort · rampes occupées",
    deathStarTooLate: "Étoile de la Mort · arrivée impossible à temps",
    deathStarNeedSlot: "Étoile de la Mort · emplacement de colonie occupé",
    deathStarOriginRecovering:
      "Étoile de la Mort · planète capitale en récupération",
    kindCapital: "Planète capitale",
    kindColony: "Colonie",
    kindNeutral: "Neutre",
    capitalProtected: "Planète capitale impossible à capturer",
    capitalProtectedHint:
      "L’Étoile de la Mort vide l’Aegis et bloque sa régénération pendant une heure ; les défenses terrestres restent désactivées et ne subissent aucun dégât.",
    /** Seule vraie règle de la planète capitale lorsque l’arme est désactivée. `STRATEGIC_CRAFTING_ENABLED`. */
    capitalRaidOnlyHint:
      "Un raid ne peut prendre ici que des ressources. Une planète capitale ne change jamais de mains.",
    capitalRecovering: "Planète capitale en récupération · impossible à capturer",
    capitalRecoveringHint:
      "Une autre frappe EMP relance la suppression d’une heure ; le contrôle reste inchangé.",
    capitalEmp: "Capitale sous EMP",
    capitalEmpHint: "L’Aegis est vide et les défenses terrestres sont désactivées et invulnérables pendant une heure.",
    yourCapital: "Ta planète capitale protégée",
    yourColony: "Ta colonie",
    transferHint:
      "Transfère ici des vaisseaux et des ressources en aller simple.",
    transferRoute: "Transfert entre mondes",
    transferOrigin: "Origine",
    transferTarget: "Destination",
    transferFrom: "Depuis la planète {{origin}}",
    transferCraft: "Vaisseaux disponibles",
    transferPrepare: "Choisir vaisseaux et ressources",
    transferRecovering: "Le monde d’origine est en récupération",
    colonyRoute: "Comment coloniser",
    claimOpen: "Course à la colonisation ouverte",
    settlementInFlight: "Tes vaisseaux de colonisation sont en route",
    claimRaceExplain:
      "La planète n’appartient encore à personne. Le premier joueur à faire arriver 2 Cargos valides en prend le contrôle.",
    colonySlots: "{{used}} / {{total}} emplacements de colonie",
    routeRaid: "Obtenir une victoire décisive",
    routeRaidDetail:
      "Lance un raid avec des vaisseaux de combat. Détruis toutes les unités défensives ainsi que le bouclier.",
    routeClaim: "La course s’ouvre automatiquement",
    routeClaimDetail:
      "Tu n’envoies rien. Dès qu’une victoire décisive est obtenue, le système ouvre lui-même la course.",
    routeSettle: "Envoyer la flotte de colonisation",
    routeSettleDetail:
      "Les vaisseaux de fondation et les ressources ne partent qu’à ce moment-là. La première arrivée valide gagne.",
    routeSettleInFlightDetail:
      "Ta flotte de fondation est en route. La première arrivée valide prend la planète.",
    raidFleetBadge: "Flotte de raid",
    raidFleetExplain:
      "Dans l’écran de raid, choisis des vaisseaux de combat et détruis toute la défense ainsi que le bouclier. À l’étape 1, aucun Cargo, aucune ressource de fondation ni aucun emplacement de colonie n’est nécessaire.",
    automaticBadge: "Automatique",
    automaticExplain:
      "Une victoire décisive ouvre automatiquement la course. À l’étape 2, tu n’envoies ni vaisseaux ni ressources supplémentaires.",
    settlementAwayBadge: "En route",
    settlementAwayExplain:
      "Tes 2 Cargos et les ressources de fondation sont partis. Aucun rappel possible ; la première arrivée valide prend la planète.",
    claimCloses: "se ferme dans {{duration}}",
    claimRaidStillOpen:
      "Un nouveau raid reste possible ; il ne prolonge pas la revendication ouverte.",
    openColonySlot: "Emplacement de colonie",
    colonySlotExplain:
      "Nécessaire uniquement à l’étape 3. Au départ de la flotte de fondation, un emplacement de colonie doit être disponible dans le Noyau de Commandement de la planète capitale.",
    captureColonySlotExplain:
      "Nécessaire pour coloniser, pas pour frapper une colonie : l’Étoile de la Mort ne transfère jamais le contrôle d’un monde.",
    openFlightBay: "1 rampe de vol libre",
    flightBayExplain:
      "Nécessaire uniquement à l’étape 3. Le vol de fondation aller simple de tes 2 Cargos occupe 1 rampe jusqu’à l’arrivée sur la planète.",
    courierCount: "2 Cargos",
    haulerExplain:
      "Nécessaires uniquement à l’étape 3 : ils forment la flotte de fondation et sont envoyés séparément du raid après l’ouverture de la course. Aucun Cargo n’est nécessaire pour le raid.",
    foundingAlloy: "{{amount}} Alliage",
    foundingAlloyExplain:
      "{{amount}} Alliage sont dépensés à l’étape 3 pour fonder la colonie ; ils reviennent si tu perds la course. Ce n’est pas le coût du raid.",
    foundingCrystal: "{{amount}} Cristal",
    foundingCrystalExplain:
      "{{amount}} Cristal sont dépensés à l’étape 3 pour fonder la colonie ; ils reviennent si tu perds la course. Ce n’est pas le coût du raid.",
    settlementFuel: "{{amount}} Deutérium",
    settlementFuelExplain:
      "Les 2 Cargos consomment {{amount}} Deutérium pendant leur vol aller simple de l’étape 3. Cette quantité dépend de la distance.",
    settlementArrivalExplain:
      "Le vol de fondation dure {{duration}}. Il doit arriver avant la fermeture de la course ; la première arrivée valide gagne.",
    arrivesIn: "arrive dans {{duration}}",
    deathStarRoute: "Effets de cette frappe",
    /** Horloge du défenseur, nommée d’après ce qui expire à la fin. D167. */
    recoveryBreach: "Récupération · monde plongé dans le noir",
    empBreach: "Panne EMP · défenses désactivées",
    occupationProtected: "Protection d’occupation",
    protectedFor: "Impossible à frapper ou capturer pendant {{duration}}.",
    firstImpact: "Dégâts + {{duration}} d’obscurité",
    secondImpact: "La durée expire · le monde reste inchangé",
    deathStarReadyRequirement: "Étoile de la Mort prête",
    deathStarReadyExplain:
      "Une Étoile de la Mort terminée doit attendre sur le monde d’origine pour pouvoir lancer la frappe.",
    /**
     * La seule chose que le défenseur doit savoir, exactement là où il la regarde. D167.
     *
     * Remplace les trois conditions qui décrivaient autrefois une route de capture
     * qui n’existe plus. Une règle invisible n’est pas une règle jouable, et dans ce
     * panneau c’est la seule règle susceptible de faire croire à un commandant qu’il
     * peut perdre un monde.
     */
    recoveryDropWarning:
      "{{duration}} restantes. Jusqu’à ce moment, rien n’est produit et rien ne peut décoller. Le monde reste à toi et ta flotte reste sur place.",
    empWarning: "{{duration}} restantes. L’Aegis ne se régénère pas ; les défenses terrestres ne tirent pas et ne subissent aucun dégât.",
    eyebrow: "Propriétaire : {{owner}}",
    location: "Monde · {{planet}}",
    /** Un monde hors de toute portée et jamais sondé n’a pas d’autre nom. D127. */
    unsurveyedEyebrow: "Monde · inexploré",
    unsurveyedTitle: "Tu n’as encore jamais observé ce monde",
    /**
     * LA MOITIÉ DE LA BANDE QUE LE BROUILLARD PEUT PROUVER. D168 · D127.
     *
     * La version courte doit tenir sur UNE SEULE LIGNE. La version longue est le nom
     * accessible et dispose donc de plus de place. Les deux disent uniquement que la
     * cible est « trop développée » ; le brouillard ne peut pas prouver qu’elle est
     * trop faible, cette direction reste donc laissée au refus serveur.
     */
    attackOutOfBandShort: "Trop développé",
    attackOutOfBand:
      "Ce commandant est trop développé par rapport à toi — l’écart maximal autorisé pour un raid est d’un palier",
    attackProtected: "Protégé — ce monde ne peut pas encore être attaqué",
    attackProtectedShort: "Protégé · {{duration}}",
    attackShort: "Planifier l’attaque",
    probeShort: "Sonde",
    probeCoolingShort: "dans {{duration}}",
    attack: "Préparer une attaque",
    attackNeutralAgain: "Attaquer à nouveau · revendication inchangée",
    attackOriginRecovering: "Attaque · planète capitale en récupération",
    attackShipyardRevolt: "Attaque impossible · mutinerie au Chantier Spatial",
    attackShipyardRevoltShort: "Mutinerie",
    windowOpen:
      "Leur flotte est absente. Ce monde est actuellement moins défendu que d’habitude.",
    distance: "Distance",
    reach: "Ton temps d’arrivée",
    reachUnknown: "—",
    headlineFleetAway: "Flotte absente",
    headlineFleetHome: "Flotte présente",
    headlineVeiled: "Sous Voile",
    headlineProbed: "Sonde · {{age}}",
    headlineFought: "Combat · {{age}}",
    headlineNone: "Aucune information",
    installTelescope: "Construire un Télescope",
    watchSlot: "Orienter l’emplacement {{slot}}",
    replaceSlot: "Emplacement {{slot}} · remplacer {{target}}",
    watching: "{{target}} est maintenant surveillé",
    sendProbe: "Envoyer une sonde · {{alloy}} alliage · {{crystal}} cristal",
    probeAway: "Sonde lancée · rapport dans {{duration}}",
    probeCooling:
      "Tu viens d’observer cette cible · nouvelle sonde dans {{duration}}",
    markRival: "Marquer comme Rival",
    rivalMarkedAction: "Ton Rival",
    rivalMarked: "{{commander}} est désormais ton Rival.",
    rivalCleared: "{{commander}} n’est plus marqué comme Rival.",
    rivalHeading: "Votre histoire cette saison",
    rivalMarkedBadge: "Rival marqué",
    rivalEncounters: "Rencontres",
    rivalYourRaids: "Tes raids",
    rivalTheirRaids: "Leurs raids",
    rivalDominion: "Domination",
    rivalDominionValue: "gagnée +{{gained}} · perdue −{{lost}}",
    rivalLastContact: "Dernier contact {{age}}",
    rivalProbeOnly:
      "Tu as observé ce monde, mais aucun des deux camps n’a encore ouvert le feu.",
    rivalNoContact:
      "Tu as choisi ce commandant comme Rival. Votre premier véritable mouvement reste encore à venir.",
    rivalAhead:
      "Tu as l’avantage. Il y a de la Domination qu’ils voudront te reprendre.",
    rivalBehind: "Ils ont l’avantage. Le compte n’est pas encore réglé.",
    rivalEven:
      "Le score entre vous est équilibré. La prochaine rencontre fera pencher la balance.",
    rivalFeud: "{{count}} rencontres en ont fait plus qu’un simple raid.",
    rivalPurpose:
      "Fixe ce commandant et votre bilan commun de saison. N’accorde aucun bonus de combat ni de renseignement.",
  },
  asteroid: {
    eyebrow: "Astéroïde niveau {{level}}",
    title: "Astéroïde de passage",
    summaryOre: "{{amount}} minerai",
    summaryAnomaly: "{{amount}} minerai · anomalie isotopique",
    working_one: "{{count}} de tes appareils sur cet astéroïde · {{state}}",
    working_other: "{{count}} de tes appareils sur cet astéroïde · {{state}}",
    stateReturning: "en retour",
    stateInbound: "en route",
    noCraft: "Aucun Prospecteur chez toi",
    tooLate: "Il sera parti avant ton arrivée",
    researchNeeded: "Recherche d’abord la Spectrométrie Isotopique",
    resting: "Appareils en repos · {{duration}}",
    send: "Envoyer {{count}} · {{duration}}",
    oreLeft: "Minerai restant",
    leavesIn: "Quitte le disque dans",
    composition: "Composition",
    compositionValue: "{{percent}} % cristal",
    compositionUnknown: "Composition isotopique inconnue",
    compositionIsotope: "{{crystal}} % cristal · {{deuterium}} % Deutérium",
    deuteriumRoute:
      "Envoie un Prospecteur pour récupérer du Deutérium. La cargaison de retour rejoint le stock de production ; appuie sur Collecter pour la transférer au Dépôt.",
    speed: "Vitesse",
    speedValue: "{{rate}} par minute",
    spill:
      "Ton stock de production ne peut encore accueillir que {{room}}. {{lost}} de cette cargaison seront perdus à l’arrivée ; vide d’abord le stock.",
    taken: "Quelqu’un a déjà pris {{amount}} de son contenu.",
    untouched: "Intact. Le premier arrivé prend autant qu’il peut transporter.",
    fleetLine_one: "{{count}} Prospecteur chez toi ; capacité {{hold}}.",
    fleetLine_other:
      "{{count}} Prospecteurs chez toi. Chacun transporte {{hold}}, soit {{total}} au total.",
    derrickPitch:
      "Une <0>{{name}}</0> en orbite porte cette capacité à <1>{{hold}}</1> par appareil et les fait également arriver plus tôt.",
    intercept:
      "Tes appareils rattraperont l’astéroïde dans {{reach}} ; il te restera {{spare}} de marge.",
  },
  craftPicker: {
    label: "Combien d’appareils envoyer",
  },
  debris: {
    eyebrow: "Épave",
    titleUnknown: "Champ d’épaves",
    titleOver: "Épave au-dessus de {{planet}}",
    summarySalvage: "{{amount}} ferraille",
    working_one: "{{count}} de tes appareils sur place · {{state}}",
    working_other: "{{count}} de tes appareils sur place · {{state}}",
    stateReturning: "en retour",
    stateInbound: "en route",
    noCraft: "Aucun Prospecteur chez toi",
    tooLate: "Elle se dispersera avant ton arrivée",
    resting: "Appareils en repos · {{duration}}",
    send: "Envoyer {{count}} · {{duration}}",
    alloyLeft: "Alliage restant",
    crystalLeft: "Cristal restant",
    deuteriumLeft: "Deutérium restant",
    goneIn: "Dispersion dans",
    yourHold: "Ta capacité de transport",
    spill:
      "Ton stock de production ne peut encore accueillir que {{room}}. {{lost}} seront perdus à l’arrivée ; vide d’abord le stock.",
    body: "Ce champ d’épaves issu d’un combat se disperse avec le temps et reste accessible à toute la galaxie. Le premier arrivé prend autant de ressources qu’il peut transporter.",
  },
  run: {
    eyebrowHome: "Sur le chemin du retour",
    eyebrowSalvage: "Expédition de récupération",
    eyebrowOutbound: "À l’aller",
    title_one: "{{count}} Prospecteur",
    title_other: "{{count}} Prospecteurs",
    homeIn: "Retour chez toi dans",
    reachesIn: "Arrivée dans",
    meetsRockIn: "Rattrape l’astéroïde dans",
    target: "Cible",
    targetWreck: "Épave au-dessus de {{planet}}",
    targetWreckAnon: "Épave au-dessus d’une planète",
    targetDecayed: "Le champ s’est dispersé",
    targetRock: "Astéroïde niveau {{level}}",
    targetRockGone: "L’astéroïde est passé",
    carrying: "Transporte {{alloy}} alliage et {{crystal}} cristal.",
    carryingDeuterium:
      "Transporte {{alloy}} alliage, {{crystal}} cristal et {{deuterium}} Deutérium.",
    emptySalvage:
      "Le champ avait déjà été récupéré à l’arrivée ; retour les mains vides.",
    emptyRock:
      "L’astéroïde avait déjà été épuisé à l’arrivée ; retour les mains vides.",
    salvageNote:
      "Le champ d’épaves reste fixe et visible par tous. {{clock}} Le premier arrivé prend autant qu’il peut transporter.",
    salvageClock: "Dispersion dans {{duration}}.",
    miningNote:
      "La flotte ne vole pas vers la position actuelle de l’astéroïde, mais vers l’endroit où il sera à l’arrivée. Le premier arrivé prend autant qu’il peut transporter.",
  },
  thread: {
    eyebrowProbeHome: "Sonde en retour",
    eyebrowProbeOut: "Sonde en route",
    eyebrowFleetHome: "Flotte en retour",
    eyebrowFleetOut: "Flotte en route",
    arrivesIn: "Arrivée dans",
    craft: "Vaisseaux",
    craftUnknown: "—",
    returning:
      "Impossible de donner de nouveaux ordres aux appareils déjà sur le chemin du retour.",
    outbound: "Une flotte déjà lancée ne peut pas être rappelée.",
  },
  contact: {
    eyebrowBattle: "Un raid frappe sa cible",
    eyebrowInbound: "Ce contact se dirige vers toi",
    eyebrowSalvage: "Quelqu’un récupère une épave",
    eyebrowMining: "Quelqu’un exploite un astéroïde",
    eyebrowProbe: "Quelqu’un effectue un sondage",
    eyebrowMoving: "Quelqu’un est en mouvement",
    titleUnknown: "Non identifié",
    eyebrowUnknown: "Mouvement non identifié",
    unknownHint:
      "Hors du champ de vision du Télescope. Lorsque ce contact entre dans ton champ de vision, tu peux identifier le type d’appareil ; s’il s’agit d’une flotte, les types de vaisseaux et leurs nombres exacts deviennent lisibles.",
    /** Un Radar 5 identifie le type sans montrer l’appareil ; la source de la lecture doit être indiquée. */
    radarKind:
      "Le Radar identifie ce contact comme {{kind}}. À cette distance, l’appareil et la composition de la flotte ne sont pas lisibles.",
    titleBattle: "Sous le feu",
    titleFleet: "Flotte",
    titleProbe: "Sonde",
    titleMining: "Expédition minière",
    titleHarvest: "Expédition de récupération",
    titleDeathStar: "Étoile de la Mort",
    titlePirate: "Flotte pirate",
    eyebrowPirate: "Des pirates sont présents",
    boundaryPirate:
      "Tu vois le pirate et les vaisseaux qu’il utilise. Son origine et son orbite restent invisibles — un pirate est une position, pas une route.",
    working: "En activité",
    craftCount: "{{count}} vaisseaux",
    massLight: "Petite flotte",
    massMedium: "Flotte moyenne",
    massHeavy: "Grande flotte",
    massHint:
      "Seulement une estimation de taille — impossible d’obtenir la composition à cette distance.",
    inboundHint:
      "Le Radar a déterminé que ce contact se dirige vers l’un de tes mondes. Son temps d’arrivée est communiqué séparément par une alerte temporisée.",
    bombarding: "Bombardement",
    settling: "Résolution en cours",
    unattributed: "Propriétaire inconnu",
    arrivalUnknown: "Arrivée inconnue",
    inboundNoClock: "Se dirige vers toi · heure inconnue",
    craftLabel: "Vaisseaux",
    craftUnknown: "—",
    statusLabel: "État",
    statusLanded: "Arrivé",
    arrivesIn: "Arrivée dans",
    arrivesUnknown: "Inconnue",
    boundaryBattle:
      "Une flotte se trouve au-dessus de cette planète et ouvre le feu. Si elle est dans le champ de vision du Télescope, sa formation complète est visible ; son propriétaire, son origine et l’issue du combat restent inconnus.",
    boundarySalvage:
      "Le champ d’épaves, la route et le temps d’arrivée sont publics ; les ressources rapportées chez lui par l’appareil restent cachées.",
    boundaryMining:
      "Comme tu as découvert cet astéroïde, tu vois la cible, la route et le temps d’arrivée ; les ressources rapportées chez lui par l’appareil restent cachées.",
    boundaryFleet:
      "Dans le champ de vision du Télescope, tu vois l’appareil lui-même ; s’il s’agit d’une flotte, les types de vaisseaux et leurs nombres exacts sont visibles. Le propriétaire, l’origine et la destination restent inconnus.",
    boundaryUnknown:
      "Tu ne vois que le mouvement. Le type d’appareil, sa taille, son propriétaire, son origine et sa destination ne figurent pas dans cette lecture.",
    telescopeHint:
      "Surveiller un monde permet de savoir si sa flotte est présente ou absente. C’est l’information qui relie un mouvement observé sur la carte à une éventuelle occasion d’attaque.",
    wreckHint:
      "Les épaves sont publiques. Ce qui restera des deux flottes apparaîtra bientôt ici ; n’importe qui pourra venir le récupérer.",
  },
} as const;
/** Flottes pirates. D150. Écrit naturellement en français. */
export const pirate = {
  title: "Flotte pirate",
  name: "Flotte pirate N{{level}}-{{callsign}}",
  level: "Niveau {{level}}",
  eyebrow: "Pirates niveau {{level}}",
  damagePenalty: "Cette flotte inflige %{{percent}} de dégâts en moins",
  /** Ouvre le même écran d’engagement que l’attaque d’un monde. D150. */
  attack: "Attaquer",
  yourFleet: "Ta flotte",
  atHome: "{{count}} chez toi",
  fewer: "Réduire {{name}}",
  more: "Ajouter {{name}}",
  quantity: "Nombre de {{name}}",
  max: "Envoyer tous les {{name}}",
  maxShort: "Tous",
  noShipsAtHome: "Aucun vaisseau à envoyer depuis ce monde.",
  eyebrowUnknown: "Contact non identifié",
  pickShips: "Sélectionne au moins un vaisseau",
  fuelCost: "Carburant : {{amount}} Deutérium",
  noFuel: "Pas assez de Deutérium pour l’aller-retour",
  noBay: "Aucune baie de vol libre",
  tooSlow: "Le vaisseau le plus lent de ta sélection ne peut pas l’atteindre",
  roster: "Composition",
  rosterUnknown: "Composition illisible à cette distance",
  unknownContact: "Contact non identifié",
  mass: "Masse",
  leavesIn: "Quitte la zone dans",
  reach: "atteignable dans {{duration}}",
  reachLabel: "Ton arrivée",
  strengthLabel: "Puissance de feu",
  tooLate: "Il quittera la zone avant ton arrivée",
  unreachable: "Aucun vaisseau présent sur ce monde ne peut l’atteindre",
  alreadyRaiding: "Un raid est déjà en route depuis ce monde",
  outOfSight: "Hors de portée des capteurs",
  noShips: "Aucun vaisseau chez toi",
  captureHint:
    "En cas de victoire décisive, tu peux capturer un vaisseau de l’équipage",
  captured: "{{hull}} capturé",
  captureMissed: "Aucun vaisseau intact à remorquer",
  send: "Envoyer {{count}} vaisseaux · {{duration}}",
  outbound: "Une flotte déjà lancée ne peut pas être rappelée.",
  /** Dire « tu ne le vois pas », pas « cette information est ancienne ». Les valeurs restent en direct. D160. */
  remembered:
    "Suivi depuis son identification · actuellement hors de portée de tes capteurs",
  boundary:
    "Une fois identifié, un pirate reste dans cette liste jusqu’à sa destruction ou son expiration, comme un astéroïde découvert. Son orbite étant calculable, tu conserves sa trace et le nombre de vaisseaux de son équipage même lorsqu’il sort de ta portée ; tu perds la vue directe, pas sa trace.",
  hoardHint:
    "Le butin que tu peux ramener est limité par la capacité de cargaison de ta flotte.",
} as const;
