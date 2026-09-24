/**

* CE QUE TU SAIS — les lignes qui construisent le centre de renseignement,
* les rapports de combat, la lecture de clarté et la barre de suivi.
*
* Cet écran n’a qu’un seul rôle : faire sentir au joueur CE QU’IL NE SAIT PAS.
* Les états vides ne sont donc pas des excuses, mais des invitations. Chacun nomme
* l’appareil manquant et explique ce qu’il permettrait d’apprendre.
  */
export const intel = {
  openOrbit: "Ouvrir l’orbite",
  tabs: {
    label: "Rapports de renseignement",
  },
  coverage: {
    label: "Couverture",
    blind: "Tu ne peux voir l’intérieur d’aucune planète",
    partial_one: "{{seen}} de tes {{count}} emplacements surveille une cible",
    partial_other:
      "{{seen}} de tes {{count}} emplacements surveillent une cible",
    full: "Tous tes emplacements surveillent une cible",
    blindHint:
      "Le moyen le moins coûteux d’y remédier est de construire un Télescope.",
    idleHint_one:
      "{{count}} emplacement est libre. Choisis une planète dans la galaxie et oriente-le vers elle.",
    idleHint_other:
      "{{count}} emplacements sont libres. Choisis une planète dans la galaxie et oriente l’un d’eux vers elle.",
    scarcity_one:
      "Il y a {{neighbours}} planètes autour de toi, mais seulement {{count}} œil à ta disposition. Déplacer un emplacement impose un délai ; choisis bien qui surveiller.",
    scarcity_other:
      "Il y a {{neighbours}} planètes autour de toi, mais seulement {{count}} yeux à ta disposition. Déplacer un emplacement impose un délai ; choisis bien qui surveiller.",
    oneMore:
      "Un Télescope de niveau {{level}} peut surveiller une planète supplémentaire.",
    noRadar:
      "Tu n’as pas non plus de Radar ; impossible de distinguer une menace dirigée contre toi des autres mouvements.",
  },
  watching: {
    heading: "Tes surveillances",
    slotsUsed: "{{used}} emplacements utilisés sur {{total}}",
    slotLabel: "Emplacement {{slot}}",
    slotEmpty: "Libre",
    missingNoSlot: "Aucun emplacement ne surveille de cible",
    missingNoTelescope: "Tu n’as pas de Télescope",
    gives:
      "Il t’avertit lorsqu’une flotte quitte une planète. Avant un raid, tu peux ainsi savoir si sa défense est encore présente.",
    costPoint:
      "Choisis une planète dans la galaxie et oriente un emplacement vers elle.",
    costInstall: "Construis-en un depuis l’écran de la planète.",
    away: "Jusqu’au retour de la flotte, seules les unités restées sur place défendent la planète.",
    intermittent:
      "Une lecture intermittente se renouvelle au mieux toutes les vingt minutes. Regarder à nouveau avant la prochaine lecture ne changera pas le résultat.",
  },
  probes: {
    heading: "Rapports de sonde",
    newest: "plus récents d’abord",
    missing: "Aucune sonde n’est encore revenue",
    gives:
      "Elle estime les ressources et les unités sous forme de fourchettes. Elle ne garantit pas l’issue d’un combat.",
    /** Les valeurs viennent de la constante `PROBE` ; elles ne sont plus écrites en dur. D59. */
    cost: "Rapide et peu coûteuse : {{alloy}} alliage, {{crystal}} cristal. Aucun de tes vaisseaux de combat ne peut la rattraper, mais les Radars peuvent la détecter.",
    stock: "Réserves",
    defence: "Valeur des unités armées",
    ships: "Vaisseaux",
    /** `{{percent}}` arrive déjà dans le format local ; le signe est géré par `format.percent`. */
    accuracyHome: "{{percent}} de précision · la flotte était présente",
    accuracyOut: "{{percent}} de précision · la flotte était absente",
    estimateNote:
      "Les nombres sont des estimations. La valeur des unités armées n’inclut ni le bouclier ni les vaisseaux sans armes.",
    caught: "la sonde a été détectée",
    /* Deux mots à côté des barres de signal ; les barres portent la précision. */
    homeTag: "flotte présente",
    outTag: "flotte absente",
  },
  radar: {
    heading: "Qui t’observe",
    level: "Radar · niveau {{level}}",
    missing: "Tu n’as pas de Radar",
    gives:
      "Il trace le rayon dans lequel tu détectes les appareils en mouvement, repère les sondes dirigées contre toi et signale avec leur temps d’arrivée les menaces visant ton monde.",
    cost: "Sans Radar, la plupart des sondes envoyées vers ce monde passent inaperçues.",
    quiet: "Aucun sondage détecté. Radar de niveau {{level}} à l’écoute.",
    scan: "Sondage détecté",
    bearing: " · depuis la direction galactique {{bearing}}",
    origin: " · {{planet}}",
    /** Le monde sur lequel le sondage est arrivé. */
    onWorld: " · {{planet}}",
    /* Légendes placées à côté des deux anneaux dessinés ; l’image porte le reste. */
    ringSense: "Mouvement détecté",
    ringWarn: "Alerte temporisée",
    /** Tant que les deux anneaux sont confondus, un seul titre suffit. */
    ringOne: "Détection et alerte temporisée",
    /** Même lecture pour ceux qui ne voient pas les anneaux. */
    noteFleets:
      "Un Radar de niveau {{level}} distingue à {{sense}} unités les menaces dirigées contre toi, mais n’affiche leur temps d’arrivée qu’à partir de {{warn}} unités.",
    /** Version fusionnée : un seul anneau, deux fonctions, une phrase. */
    noteFleetsOne:
      "Un Radar de niveau {{level}} détecte les appareils en mouvement jusqu’à {{sense}} unités et signale avec leur temps d’arrivée les menaces visant ton monde.",
    /** Ce qu’aucune illustration ne montre : les anneaux sont fixes, pas le temps passé dedans. */
    noteSlow:
      "Une flotte lourde et lente reste plus longtemps dans la portée du Radar.",
    noteProbesLegacy:
      "Un Radar de niveau {{level}} détecte les sondes et signale les flottes entrant dans son rayon.",
    noteBearing:
      " À partir du niveau 2, il indique également la direction d’arrivée.",
    noteOrigin: " Le niveau 5 révèle le nom du monde d’origine.",
  },
} as const;
export const reports = {
  heading: "Rapports de combat",
  newest: "plus récents d’abord",
  empty:
    "Aucun combat n’a encore été enregistré dans la galaxie. Un rapport de combat révèle directement les forces réellement engagées et l’issue de l’affrontement.",
  youRaided: "Tu as attaqué : ",
  raidedBy: "Tu as été attaqué par : ",
  rounds: "{{count}} tours",
  sheetYouRaided: "Cible : {{opponent}} · {{planet}}",
  sheetYouRaidedPirate: "Cible : {{opponent}}",
  sheetTheyRaided: "Attaquant : {{opponent}}",
  attackedPlanet: "Planète attaquée : {{planet}}",
  heldAgainstYou:
    "{{planet}} a tenu. Tu n’as obtenu aucun butin lors de cette attaque.",
  brokenByYou: "Tu as endommagé les défenses de {{planet}}.",
  /**

  * LE VERDICT CONTRE UN PIRATE NE NOMME AUCUNE PLANÈTE, puisqu’il n’y en a pas.
  * Les deux phrases précédentes reposent sur `{{planet}}`, qui est vide ici.
    */
  pirateBroken: "L’équipage a été dispersé. Ce qui reste est à toi.",
  pirateHeld:
    "Les pirates ont tenu. Tu n’as obtenu aucun butin lors de cette attaque.",
  /** Récompense : la seule manière d’obtenir une coque que tu n’as pas construite. */
  pirateCaptured: "Capturé aux pirates.",
  pirateCapturedNote:
    "Récupéré intact dans les débris de l’équipage détruit. Il rejoint la garnison du monde où ta flotte revient, même si le Hangar est plein, et ne compte pas parmi les vaisseaux que tu as construits.",
  youHeld: "Tu as repoussé l’attaque. L’adversaire n’a pris aucune ressource.",
  youFell: "L’attaque a endommagé ta défense.",
  shipsLost: "Vaisseaux perdus",
  haul: "Ramené chez toi",
  haulLost: "Emporté",
  salvageHaul: "Récupéré dans les débris",
  roundsLabel: "Tour",
  taken: "Pris",
  lost: "Perdu",
  dominion: "Domination",
  dominionSummaryGained:
    "Tu as gagné {{amount}} de Domination lors de ce combat.",
  dominionSummaryLost:
    "Tu as perdu {{amount}} de Domination lors de ce combat.",
  dominionReason:
    "Le butin sécurisé et les pertes permanentes infligées à l’adversaire rapportent des points. Le butin qui t’est pris et tes propres pertes permanentes en retirent. Le calcul repose sur la valeur en ressources, pas sur le nombre de vaisseaux.",
  dominionBreakdown: {
    title: "Évolution de la Domination",
    lootGained: "Butin sécurisé",
    lootLost: "Butin pris chez toi",
    enemyLosses: "Pertes permanentes ennemies",
    ownLosses: "Tes pertes permanentes",
    total: "Variation totale",
  },
  clansAtLaunch: "Clans au moment du départ de la flotte",
  yourClan: "Ton camp",
  theirClan: "Camp adverse",
  noClan: "Aucun clan",
  verdict: {
    label: "Issue du combat",
    yourForce: "Tes unités",
    yourLosses: "Tes pertes",
    sent: "Envoyées",
    held: "Présentes",
    total: "Total",
    lost: "Perdues",
    returned: "Survivantes",
    standing: "Encore debout",
    destroyed: "Détruites",
    enemyDestroyed: "Unités ennemies détruites",
    attackerDestroyed: "Vaisseaux attaquants détruits",
    noneReturned: "Aucun de tes vaisseaux n’a survécu au combat.",
    someReturned: "{{count}} de tes vaisseaux ont survécu au combat.",
    enemySurvivedNote:
      "Des unités ennemies ont survécu ; leur nombre reste caché. Ce chiffre indique uniquement celles que tu as détruites.",
    enemyUnknownNote:
      "Ce chiffre indique uniquement les unités détruites ; le nombre restant chez l’adversaire reste caché.",
    loot: "Butin",
    rosterUnknown:
      "Ce rapport ne contient pas les effectifs de départ. Le nombre de survivants ne peut pas être calculé.",
    walkoverSummary:
      "Aucune unité ne pouvait défendre la cible. Il n’y a pas eu de combat.",
    piratePartialSummary:
      "Une partie de la flotte pirate était encore en vie à la fin du combat.",
    title: {
      attacking: {
        DECISIVE: "Ton attaque a réussi",
        DECISIVE_WIPED: "Tu as brisé la défense, mais perdu ta flotte",
        PARTIAL: "Ton attaque a partiellement réussi",
        PARTIAL_WIPED: "Tu as endommagé la défense, mais perdu ta flotte",
        REPELLED: "Ton attaque a été repoussée",
      },
      defending: {
        DECISIVE: "Ta défense a été brisée",
        PARTIAL: "Ta défense a été partiellement brisée",
        REPELLED: "Tu as repoussé l’attaque",
      },
    },
    summary: {
      attacking: {
        DECISIVE:
          "Aucune unité ne restait pour maintenir la défense de la cible.",
        PARTIAL:
          "Les conditions d’une victoire totale n’étaient pas réunies : des unités défensives ou le bouclier tenaient encore.",
        REPELLED: "La défense adverse a tenu. Tu n’as obtenu aucun butin.",
      },
      defending: {
        DECISIVE:
          "Toutes tes unités défensives ont été détruites lors de ce combat.",
        PARTIAL:
          "L’attaquant n’a pas obtenu une victoire totale : certaines de tes unités ou ton bouclier ont tenu.",
        REPELLED: "Ta défense a tenu. L’attaquant n’a obtenu aucun butin.",
      },
    },
  },
  theirLosses: "Ce que tu as détruit",
  theirs: "Ce qu’il y avait en face",
  theirsEmpty: "L’adversaire n’a perdu aucune unité.",
  yourForce: "Ta flotte",
  yours: "Ce que cela t’a coûté",
  yoursEmpty: "Tu n’as perdu aucune unité.",
  howItWent: "Déroulement du combat",
  reasonHeading: "Pourquoi ce résultat ?",
  rulesToggle: "Règles et calcul du combat",
  roundCalculationToggle: "Afficher le calcul des tirs de ce tour",
  roundLossesYours: "Tes unités détruites",
  roundLossesTheirs: "Unités ennemies détruites",
  roundNoCasualties: "Aucune perte",
  roundShield: "Le bouclier du défenseur a absorbé {{amount}} dégâts.",
  turningPointSupport:
    "À la fin du tour {{round}}, tu n’avais plus aucune unité capable de tirer. Les {{support}} vaisseaux de soutien restants ne pouvaient pas attaquer.",
  turningPointWiped:
    "À la fin du tour {{round}}, toutes tes unités avaient été détruites.",
  roundDamageNote:
    "Les valeurs de dégâts incluent également ceux absorbés par le bouclier du défenseur.",
  roundDealt: "Dégâts infligés",
  roundTook: "Dégâts subis",
  roundLine: "<0>{{dealt}}</0> infligés, <1>{{took}}</1> subis",
  shield: "bouclier {{amount}}",
  shieldBreaker: "Dissipateur +{{amount}}",
  aegis: {
    aria: "Bouclier Aegis",
    label: "BOUCLIER AEGIS",
    labelTheirs: "Bouclier Aegis adverse",
    labelYours: "Ton bouclier Aegis",
    broken: "BRISÉ",
    roundedZero: "0 DANS LE RAPPORT",
    damaged: "ENDOMMAGÉ",
    held: "A TENU",
    before: "Au début du combat",
    after: "À la fin du combat",
    note: "Le bouclier planétaire absorbe les dégâts avant les unités défensives.",
    brokenUnitsRemain:
      "Le rapport affiche 0 de bouclier, mais certaines unités défensives ont survécu.",
    brokenDefenceGone:
      "Le bouclier a été brisé. Toutes les unités défensives ont également été détruites pendant ce combat.",
    brokenMeaning:
      "La valeur du bouclier est arrondie dans le rapport. Voir 0 ne signifie pas à lui seul que toute la défense a été détruite.",
    absorbed: "{{amount}} dégâts absorbés par le bouclier",
  },
  /* ── ce que le rapport doit toujours expliquer. `docs/battle-reports.md` ── */
  q: {
    happened: "Ce qui s’est passé",
    there: "Ce que tu as appris sur l’adversaire",
    enemyForce: "Forces ennemies au début du combat",
    enemyLosses: "Unités ennemies détruites",
    incomingForce: "Flotte qui t’a attaqué",
    who: "Qu’est-il arrivé à ta flotte ?",
    changed: "Butin et variation des points",
  },
  walkoverHeading: "Aucune unité ne pouvait défendre ici",
  walkoverBody:
    "Il n’y avait ni flotte ni défense terrestre capable de combattre. Tes vaisseaux sont arrivés, ont chargé leur cargaison et sont repartis. Aucun affrontement n’a eu lieu.",
  walkoverDefendingBody:
    "Aucune unité ne pouvait défendre ton monde. La flotte attaquante a pu prendre les ressources pillables sans combattre.",
  theirBoardComplete:
    "Toutes les unités défensives présentes au début du combat",
  theirBoardCompleteNote:
    "Elles ont toutes été détruites pendant ce combat. Certains canons terrestres peuvent être reconstruits après la bataille.",
  theirBoardEmptyAtStart: "Aucune unité défensive au début du combat",
  theirBoardEmptyAtStartNote:
    "Aucun vaisseau ni canon terrestre capable de combattre n’était présent sur la cible ; il n’y a donc aucune unité détruite à afficher ici.",
  theirBoardFloor: "Uniquement les unités détruites",
  theirBoardFloorNote:
    "Cette liste ne représente pas toute la flotte adverse. Elle montre seulement les unités détruites pendant ce combat. Les survivants ne sont pas révélés dans ce rapport ; envoie une nouvelle sonde pour obtenir une estimation.",
  theirBoardMissingRosterNote:
    "Ce rapport ne contient pas les effectifs de départ de la flotte attaquante. Seuls les vaisseaux que tu as détruits sont affichés ; impossible de calculer combien ont survécu.",
  theirBoardNothing: "Tu n’as rien détruit",
  theirBoardArrived: "Flotte arrivée contre toi",
  theirBoardArrivedNote:
    "Toute la flotte envoyée contre toi, vaisseaux de combat et de soutien compris. Chaque ligne indique combien sont arrivés, combien ont été détruits et combien sont restés.",
  groundHeading: "Défenses terrestres",
  groundNote:
    "Ces canons défendent la planète et ne peuvent pas voler. %{{percent}} de chaque type détruit est reconstruit après le combat, arrondi à l’entier inférieur. Ils sont comptés séparément des pertes de vaisseaux.",
  shipsHeading: "Vaisseaux",
  noGroundHeading: "Aucune défense terrestre",
  noGroundNote:
    "À ton arrivée, aucun mur défensif ne tenait encore sur ce monde.",
  calculation: {
    intro:
      "Les règles fixes ci-dessus produisent les valeurs ci-dessous. Chaque tour suit ensuite les trois mêmes étapes.",
    formulaHeading: "Calcul de la puissance de tir",
    formulaBase: "1 · Base : nombre d’unités × attaque × recherche.",
    formulaCounter:
      "2 · Avantage de classe : affrontement favorable ×{{strong}} ; défavorable ×{{weak}}.",
    formulaRoll: "3 · Effet aléatoire du tour : de −%{{min}} à +%{{max}}.",
    formulaHp:
      "Les dégâts sont répartis selon la part de chaque type de cible dans les points de vie totaux.",
    formulaCarry:
      "Une unité n’est détruite que lorsque tous ses points de vie sont épuisés ; les dégâts partiels sont conservés au tour suivant.",
    formulaSupport:
      "Les vaisseaux de soutien restent protégés tant qu’au moins une unité de combat survit de leur côté.",
    resultHeading: "Détermination du résultat",
    resultDecisive:
      "DÉCISIF · toutes les unités défensives ont été détruites et le bouclier est tombé à zéro · jusqu’à %{{decisiveLoot}} des réserves exposées peuvent être prises avant la limite de soute.",
    /**

    * MÊME RÈGLE, SANS SA MOITIÉ INAPPLICABLE. Le bouclier est une structure
    * planétaire ; l’évoquer dans un point de rendez-vous décrirait une condition
    * que le joueur ne peut jamais rencontrer ici.
      */
    resultDecisivePirate:
      "DÉCISIF · tous les vaisseaux de l’équipage ont été détruits · jusqu’à %{{decisiveLoot}} du butin peut être pris avant les limites de cargaison ; remorquer une coque n’est possible que dans ce cas.",
    resultPartial:
      "PARTIEL · au moins %{{threshold}} de la valeur des unités défensives a été détruite · jusqu’à %{{partialLoot}} des réserves exposées peuvent être prises avant la limite de soute.",
    resultRepelled:
      "REPOUSSÉ · moins de %{{threshold}} de la valeur des unités défensives a été détruite · aucune ressource ne peut être prise.",
    round: "Tour {{round}}",
    fire: "1 · Tirs simultanés",
    fireNote:
      "Les deux camps tirent simultanément. Un vaisseau détruit pendant ce tour effectue malgré tout son tir.",
    yourShot: "Ton tir",
    theirShot: "Tir adverse",
    shotChange: "Effet aléatoire",
    positivePercent: "+{{amount}}%",
    negativePercent: "−{{amount}}%",
    neutralPercent: "0 %",
    aegis: "2 · L’Aegis absorbe l’impact",
    noAegis: "2 · Aucun Aegis actif",
    shieldCharge: "Puissance du bouclier",
    absorbed: "{{amount}} absorbés",
    reachedHulls: "Dégâts atteignant les coques",
    shieldBreaker:
      "{{amount}} provenaient des dégâts du Dissipateur réservés au bouclier",
    noAegisNote:
      "Aucun bouclier n’a arrêté l’impact ; les {{amount}} points de puissance de tir ont tous atteint les coques défensives.",
    /** Même étape dans le vide : ici, aucune planète, donc aucune structure. */
    openSpace: "2 · Rien entre les tirs et les coques",
    openSpaceNote:
      "À un point de rendez-vous, il n’y a ni planète ni structure pour absorber l’impact ; les {{amount}} points de puissance de tir ont tous atteint l’équipage.",
    losses: "3 · Les pertes quittent le combat",
  },
  gradeDecisive: "DÉCISIF",
  gradePartial: "PARTIEL",
  gradeRepelled: "REPOUSSÉ",
  strategicFirstStrike: "IMPACT",
  strategicEmpEffect: "L’Aegis est tombée à zéro et ne se régénère pas pendant 1 heure. Les défenses terrestres ne tirent pas et ne subissent aucun dégât durant ce temps.",
  strategicCaptured: "CAPTURÉ",
  strategicIneffective: "INEFFICACE",
  strategicIntercepted: "DÉTRUIT EN VOL",
  strategicYouAttacked: "Cible de ton Étoile de la Mort : ",
  strategicAttackedBy: "Étoile de la Mort envoyée par : ",
  strategicDestroyedInFlight: "Étoile de la Mort détruite en vol",
  strategicRadarTrigger:
    "Le monde ciblé a ouvert le feu lorsque l’appareil est entré dans le rayon d’interception d’un Radar de niveau 3 ou supérieur.",
  strategicTelescopeTrigger:
    "Un monde du défenseur a ouvert le feu après avoir identifié l’appareil dans le champ de vision de son Télescope.",
  strategicTotalDamage: "Valeur totale détruite",
  strategicShieldLost: "Bouclier détruit",
  strategicResourcesLost: "Ressources détruites",
  strategicOrdersLost: "Travaux en file détruits",
  strategicResourceBreakdown: "Ressources détruites",
  strategicNoFleetLost:
    "Aucune perte de flotte ni de défense terrestre sur la planète.",
  strategicLevelLosses: "Niveaux perdus",
  strategicNoLevelLoss:
    "Aucun niveau de bâtiment ou d’instrument n’a été perdu.",
  strategicDestroyedOrders: "Constructions détruites",
  strategicNoOrdersLost: "Aucun ordre de construction actif n’a été détruit.",
  neutralHolder: "un monde sans propriétaire",
  /**
   * Le jeu explique ici pour la première fois ce que signifie le verdict placé
   * en haut du rapport.
   *
   * SANS JARGON ET DU POINT DE VUE DU LECTEUR. Le joueur doit comprendre à la fin
   * de cette ligne ce qui lui est arrivé et pourquoi le pillage a pris cette ampleur.
   */
  why: {
    attacking: {
      DECISIVE:
        "Tu as détruit tout ce qui défendait la cible et fait tomber son bouclier ; c’est pourquoi tout le butin disponible s’est ouvert.",
      DECISIVE_WIPED:
        "Tu as détruit toutes les unités défensives, mais aucun de tes vaisseaux n’a survécu pour transporter le butin.",
      DECISIVE_WITHOUT_SHIELD:
        "Tu as détruit tout ce qui défendait la cible ; c’est pourquoi tout le butin disponible s’est ouvert.",
      WALKOVER:
        "Aucune unité ne défendait la cible ; les ressources pillables étaient directement accessibles à ta flotte.",
      PARTIAL:
        "Tu as infligé assez de dégâts pour obtenir un succès partiel, mais pas une victoire totale. Seule une partie du butin s’est ouverte ; si aucun de tes vaisseaux n’a survécu pour le transporter, tu ne peux rien prendre.",
      PARTIAL_WIPED:
        "Tu as suffisamment endommagé la défense pour obtenir un succès partiel, mais aucun de tes vaisseaux n’a survécu pour transporter le butin.",
      REPELLED:
        "La valeur en ressources des unités détruites n’a pas atteint %{{threshold}} de la valeur totale des unités défensives présentes au début du combat. L’attaque a donc été repoussée ; le nombre de vaisseaux ou le simple fait de briser le bouclier ne suffit pas.",
    },
    defending: {
      DECISIVE:
        "Toutes tes unités défensives sont tombées et ton bouclier a été brisé ; tes ressources pillables se sont ouvertes à la flotte attaquante. La quantité emportée dépend de la capacité de transport des survivants.",
      DECISIVE_WITHOUT_SHIELD:
        "Toutes tes unités défensives sont tombées ; tes ressources pillables se sont ouvertes à la flotte attaquante. La quantité emportée dépend de la capacité de transport des survivants.",
      DECISIVE_WIPED:
        "Toutes tes unités défensives sont tombées, mais aucun vaisseau attaquant n’a survécu. Le butin était accessible, mais plus personne ne pouvait le transporter.",
      WALKOVER:
        "Aucune unité ne défendait ton monde ; les ressources pillables étaient directement accessibles à la flotte attaquante.",
      PARTIAL:
        "L’attaquant a infligé assez de dégâts pour obtenir un succès partiel, mais pas une victoire totale. Seule une partie du butin s’est ouverte.",
      PARTIAL_WIPED:
        "L’attaquant a infligé assez de dégâts pour obtenir un succès partiel, mais aucun de ses vaisseaux n’a survécu pour transporter quoi que ce soit. Rien n’a quitté ton monde.",
      REPELLED:
        "Ta défense a tenu. Ils n’ont pas réussi à passer et n’ont emporté aucune ressource.",
    },
  },
  /** Ce que le combat a provoqué au-delà de la ligne de butin ; affiché uniquement si pertinent. */
  effects: {
    heading: "Conséquences du combat",
    shieldTheirs:
      "Leur bouclier a absorbé {{amount}} dégâts avant qu’ils n’atteignent les coques.",
    shieldYours:
      "Ton bouclier a absorbé {{amount}} dégâts avant qu’ils n’atteignent tes coques.",
    cargoLimited:
      "Tes soutes étaient pleines. Cette planète contenait plus de ressources que ta flotte ne pouvait en transporter ; ajoute un Cargo, un Voyageur, un Atlas ou un Argosi.",
    salvaged_one:
      "{{count}} canon terrestre a été reconstruit après le combat à partir de ses propres débris.",
    salvaged_other:
      "{{count}} canons terrestres ont été reconstruits après le combat à partir de leurs propres débris.",
    worksTheirs:
      "Leurs installations sont arrêtées pendant {{duration}}. Aucune ressource n’y est produite pendant cette période.",
    worksYours: "Tes installations sont hors service pendant {{duration}}.",
    salvageTheirs:
      "Leurs Ferrailleurs ont récupéré {{amount}} de ferraille avant la dispersion des débris.",
    /** Pannes de colonie : ce qu’une lourde défaite endommage. Défenseur uniquement. */
    /** Taktik geri çekilme. Défenseur : ce qui a décollé et ce que le décollage a brûlé, ou pourquoi il n’a pas pu. */
    escaped_one: 'Ton vaisseau a décollé avant le combat (−{{fuel}} Deutérium) : le raid surclassait ta ligne à trois contre un.',
    escaped_other: 'Tes {{count}} vaisseaux ont décollé avant le combat (−{{fuel}} Deutérium) : le raid surclassait ta ligne à trois contre un.',
    stranded: 'Tes vaisseaux auraient décollé, mais le réservoir ne suffisait pas : {{fuel}} Deutérium requis, {{available}} disponibles.',
    /** Attaquant : la ligne s’est vidée devant le raid ; rien sur son contenu. */
    fled: 'Leurs vaisseaux ont décollé avant le combat : une ligne surclassée à trois contre un et vouée à l’anéantissement fuit si son réservoir peut payer.',
    colonyFaults:
      "Cette défaite a endommagé les éléments suivants sur {{planet}} : {{faults}}.",
    /**

    * Bouclier de récupération, défenseur uniquement : perte NETTE sur la dernière fenêtre
    * au moment de ce combat, exprimée en heures de production du lecteur.
      */
    recoveryProgress:
      "Bouclier de récupération : tu as perdu l’équivalent net de {{hours}} / {{bar}} heures de production sur les {{window}} dernières heures. À {{bar}} heures, tu obtiens {{shield}} heures pendant lesquelles aucun raid ne peut te viser ; les gains de tes propres raids sont déduits de ce calcul.",
    recoveryEarned:
      "Cette défaite t’a accordé {{shield}} heures de bouclier de récupération : tu as perdu l’équivalent net de {{hours}} heures de production sur les {{window}} dernières heures.",
    recoveryRefused:
      "Tu as perdu l’équivalent net de {{hours}} heures de production sur les {{window}} dernières heures et dépassé le seuil de {{bar}} heures ; aucun bouclier n’est toutefois accordé tant qu’un de tes propres raids est en vol.",
    wreck:
      "Une épave d’une valeur de {{amount}} dérive au-dessus de {{planet}}. N’importe qui peut aller la récupérer.",
    wreckYours:
      "Une épave d’une valeur de {{amount}} dérive dans ta propre orbite. N’importe qui peut aller la récupérer, toi compris.",
    /** Aucune orbite à nommer : le champ existe dans le vide, au point de rendez-vous. */
    wreckVoid:
      "Une épave d’une valeur de {{amount}} dérive dans le vide au point de rendez-vous. Envoie un Prospecteur — tous ceux qui ont vu ce qui s’est passé peuvent en faire autant.",
  },
  /** Tableau du lecteur : ce qui est entré, ce qui est tombé, ce qui est resté. */
  force: {
    reading: "{{sent}} envoyées, {{lost}} perdues, {{left}} restantes",
    hull: "Coque",
    sent: "Envoyées",
    held: "Présentes",
    lost: "Perdues",
    left: "Restantes",
    rebuilt: "Reconstruites",
    start: "Au départ",
    arrived: "Arrivées",
    rebuiltNote:
      "{{count}} canons terrestres détruits ont été reconstruits après le combat ; ils sont inclus dans le nombre restant.",
    groundType: "Canon terrestre · ne peut pas voler",
    supportType: "Vaisseau de soutien · ne peut pas tirer",
    combatType: "Vaisseau de combat",
    summary: "{{brought}} engagées · {{lost}} détruites · {{left}} restantes",
  },
  roundTheirs: "Eux",
  roundYours: "Toi",
  roundNoLosses: "Aucun des deux camps n’a perdu d’unité pendant ce tour.",
  roundStanding: {
    unknownOwn:
      "Les effectifs de départ ne figurent pas dans ce rapport ; impossible de calculer combien d’unités il te reste.",
    heading: "Ton camp à la fin du tour {{round}}",
    enemyHeading: "Flotte attaquante à la fin du tour {{round}}",
    summary:
      "{{combat}} unités capables de tirer · {{support}} vaisseaux de soutien sans armes",
    supportExposed:
      "Les vaisseaux de soutien ne peuvent pas tirer. Plus aucune unité de combat ne reste pour les protéger.",
    noneLeft: "Il ne te reste aucune unité capable de poursuivre le combat.",
    unknownEnemy:
      "Le nombre d’unités ennemies restantes est caché. Les pertes adverses affichées ci-dessus ne représentent pas toute leur flotte.",
  },
} as const;
export const clarity = {
  barsLabel: "Clarté : {{state}}",
  stateFull: "complète",
  stateClear: "claire",
  stateIntermittent: "intermittente",
  stateDegraded: "dégradée",
  stateBlind: "aveugle",
  unreadable: "ILLISIBLE",
  fleetHome: "FLOTTE PRÉSENTE",
  fleetAway: "FLOTTE ABSENTE",
  backIn: " · retour dans {{minutes}} min",
  unwatched: "non surveillée",
} as const;
export const dossier = {
  /* The E2 target dossier (docs/ui-v2/gozlemevi.md), in the mock's words. */
  page: {
    peekWing: "ton escadre {{value}}",
    peekDefence: "défense {{band}}",
    peekDefenceUnknown: "défense inconnue",
    rival: "Rival {{n}}",
    range: "Distance {{d}}",
    flight: "vol de {{time}}",
    unreachable: "Hors de portée",
    known: "Connu {{have}}/{{total}}",
    lookNone: "Aucune sonde n’a regardé dedans",
    wing: "Ton escadre au monde",
    power: "Puissance",
    loot: "Butin",
    lootTag: "estimation",
    lootMeaning: "Ce qu’une victoire pourrait emporter, selon la sonde — la part du Magasin est déjà retirée.",
    lootDecisive: "Victoire décisive",
    lootPartial: "Victoire partielle",
    lootDeuterium: "dont deutérium {{band}}",
    lootHold: "Ta soute {{cargo}}",
    lootShort: "Ta soute prend {{cargo}} ; l’essentiel resterait sur place.",
    colony: "Colonie",
    colonyRule: "Une victoire décisive retire {{decisive}} de loyauté, une partielle {{partial}}. À zéro, la colonie devient neutre avec ses bâtiments et son stock : le premier arrivé la prend.",
  },
  sourcePublic: "Public",
  sourceTelescope: "Télescope",
  sourceProbe: "Sonde",
  sourceBattle: "Rapport de combat",
  confidencePrecise: "précis",
  confidenceGood: "fiable",
  confidenceRough: "approximatif",
  confidenceVague: "incertain",
  ownerLabel: "Propriétaire",
  ownerNote: "Information publique pendant toute la saison.",
  ownerRecordNote:
    "Identité relevée par la sonde. Le monde a pu changer de mains depuis.",
  developmentLabel: "Développement",
  developmentValue: "palier {{tier}}",
  hardwareLabel: "Satellites en orbite",
  hardwareNote:
    "Tu vois le matériel. Une sonde suffit pour découvrir ce qu’il permet.",
  hardwareRecordNote:
    "Ce qui se trouvait en orbite au passage de la sonde. De nouveaux équipements ont pu être construits depuis.",
  fleetLabel: "Flotte",
  fleetUnreadable: "Illisible",
  fleetAway: "Absente",
  fleetHome: "Présente",
  fleetVeiledNote:
    "Ton Télescope ne peut pas lire l’état de la flotte à cause du Voile. Améliore le Télescope ou envoie une sonde.",
  fleetAwayUnknownNote:
    "Tu ne sais pas quand elle reviendra. C’est exactement le risque que tu prends.",
  fleetAwayNote:
    "Jusqu’au retour de la flotte, seules les unités restées sur place défendent la planète.",
  fleetHomeNote:
    "La surveillance est silencieuse ; ils ne sauront jamais que tu les observes.",
  fleetGapNoTelescope: "Tu n’as pas de Télescope",
  fleetGapOutOfRange: "Ton Télescope ne porte pas jusqu’ici",
  fleetGapNoSlot: "Aucun emplacement ne surveille cette planète",
  fleetGapWhy:
    "L’une des opportunités les plus précieuses de la galaxie : une flotte en vol ne peut pas défendre son propre monde avant son retour.",
  fleetGapRange:
    "Portée : {{reach}} unités ; cette planète se trouve à {{distance}} unités",
  fleetGapSlots:
    "Tes {{count}} emplacements sont tous occupés ; tu dois en déplacer un",
  stockLabel: "Actuellement pillable",
  stockNote:
    "Quantité pouvant être emportée en cas de victoire décisive. La réserve protégée du Dépôt n’est pas incluse ; ta propre capacité de soute peut encore réduire ce montant.",
  stockCaught:
    "Leur Radar a détecté la sonde ; ils savent que quelqu’un les observe.",
  stockClean: "La sonde est entrée et ressortie sans être détectée.",
  defenceLabel: "Valeur des unités armées",
  defenceNote:
    "Coût en ressources des vaisseaux et canons capables de tirer au moment du passage de la sonde. Ce n’est pas leur puissance d’attaque ; le bouclier et les vaisseaux sans armes ne sont pas inclus.",
  defenceRatio: "Environ {{ratio}} fois ce qui se trouve sur {{world}}.",
  shapeLabel: "Composition de la défense",
  shapeNote:
    "Selon la valeur des unités capables de tirer. Au-delà de la moitié, une catégorie est considérée comme dominante.",
  shapeUnread: "Illisible",
  shapeUnreadNote:
    "Leur Voile est plus avancé que le Chantier Spatial qui a envoyé la sonde.",
  shieldLabel: "Puissance du bouclier",
  shieldNote:
    "Il absorbe les tirs du raid avant les coques et se régénère en quelques heures.",
  unarmedLabel: "Vaisseaux sans armes en défense",
  unarmedNote:
    "Ils ne tirent pas, mais doivent tous être détruits pour obtenir une victoire totale.",
  shipsLabel: "Vaisseaux comptés",
  shipsAllHome: "Tous les vaisseaux comptés étaient présents.",
  shipsSomeOut: "Une partie de leurs vaisseaux était absente.",
  /** Quatre lectures toujours obtenues par la sonde mais jamais affichées auparavant. Elles restent figées au moment de l’observation. */
  /** Part de carburant de la bande supérieure ; pas le Dépôt. D166. */
  deuteriumLabel: "Deutérium pillable",
  deuteriumNote:
    "Part de carburant de la bande supérieure — quantité pouvant être emportée en cas de victoire décisive.",
  strategicLabel: "Arme stratégique",
  strategicReady: "Prête et installée",
  strategicBuilding: "En construction",
  strategicUnknown: "Un appareil stratégique est présent sur la rampe",
  strategicNote:
    "Il se trouvait sur la rampe au passage de la sonde. Il a peut-être décollé depuis.",
  strategicUnknownNote:
    "La sonde n’était pas assez précise pour déterminer son état d’avancement.",
  interceptorLabel: "Défense stratégique",
  interceptorLoaded: "Charge prête",
  interceptorEmpty: "Aucune charge",
  interceptorLoadedNote:
    "Une munition chargée détruit la première arme stratégique détectée dans le rayon d’un Radar de niveau 3 ou supérieur, ou identifiée dans le champ de vision d’un Télescope appartenant à l’un de tes mondes.",
  interceptorEmptyNote:
    "Aucun intercepteur chargé au moment du passage de la sonde. Des munitions ont pu être ajoutées depuis.",
  doctrinesLabel: "Doctrine de combat",
  doctrinesNone: "Aucune recherche terminée",
  doctrinesNote:
    "Ces recherches augmentent la puissance d’attaque et la résistance de coque des vaisseaux. Les valeurs du rapport correspondent au moment du passage de la sonde.",
  doctrinesNoneNote:
    "Aucune recherche de combat n’était terminée au moment du passage de la sonde.",
  surfaceGapLabel: "Identité et développement de la planète",
  surfaceGapMissing: "Tu n’as jamais observé ce monde",
  surfaceGapWhy:
    "Tu ne sais ni qui le contrôle, ni jusqu’où il est développé, ni ce qui se trouve en orbite. Une seule sonde peut te révéler tout cela.",
  probeGapLabel: "Ressources et défense",
  probeGapMissing: "Tu n’as jamais observé cette planète de près",
  probeGapAged: "Tes informations sur cette planète ont vieilli",
  probeGapWhy:
    "Sans savoir ce qui t’attend en dessous, tu vas risquer toute une flotte. Une sonde réduit au moins cette incertitude à une fourchette.",
  compositionLabel: "Forces connues engagées",
  compositionValue: "au moins {{fleet}}",
  compositionNote:
    "Unités détruites lors du dernier combat. Elles ont pu être remplacées depuis.",
  compositionGapLabel: "Ce qu’ils font réellement voler",
  compositionGapMissing: "Tu ne les as encore jamais affrontés",
  compositionGapWhy:
    "La composition exacte d’une flotte ne peut être connue qu’à travers un rapport de combat.",
} as const;
