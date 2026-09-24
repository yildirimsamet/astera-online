/**

* TA PLANÈTE — les quatre axes de décision, leurs lignes, la fiche détaillée
* derrière chaque ligne et le planificateur d’attaque.
*
* LES NOMS DES ONGLETS SONT TOUS DES NOMS, JAMAIS DES ORDRES. L’anglais mélange
* Defend / Orbit / Reach / Grow : deux verbes et deux noms, ce qui choque peu en
* anglais. En français, mélanger « Défendre / Renseignement / Portée / Développer »
* rendrait la barre incohérente, car l’impératif s’adresse directement au joueur.
* Les quatre deviennent donc des noms : Production · Renseignement · Défense · Flotte.
* L’onglet dit « ce qui se trouve ici » ; la phrase dessous dit « ce que tu décides ici ».
  */
export const planet = {
  recovery: "Récupération en cours · systèmes disponibles dans {{duration}}",
  empActive: "EMP · Aegis à zéro et sans régénération pendant {{duration}} ; les défenses terrestres ne tirent pas et ne subissent aucun dégât.",
  interceptor: {
    eyebrow: "Batterie de défense stratégique",
    tally: "{{used}} munitions sur {{total}} chargées",
    none: "Aucune munition chargée",
    building: "Chargement · {{duration}}",
    paused: "Chargement interrompu pendant la récupération",
    ready: "Une munition chargée",
    noRadar: "Chargée · rayon Radar désactivé",
    build: "Charger une munition",
    started: "Chargement de la munition",
    hint: "Détruit la première Étoile de la Mort entrant dans le rayon Radar temporisé ou identifiée dans le champ de vision d’un Télescope appartenant à l’un de tes mondes. La munition est consommée lorsqu’elle tire.",
    readyHint:
      "Prête. Détruit la première Étoile de la Mort entrant dans le rayon d’interception Radar ou identifiée dans le champ de vision d’un Télescope.",
    noRadarHint:
      "La munition reste chargée, mais ce monde ne dispose plus de rayon d’interception Radar. Réactive l’Antenne et un Radar de niveau 3 ; le champ de vision d’un Télescope sur un autre de tes mondes peut toujours déclencher le tir.",
    needResearch: "Réseau d’Interception",
    needRadar: "Radar niveau {{level}}",
    needUplink: "Antenne en orbite",
    needOperational: "Monde opérationnel",
    buildTime: "{{duration}} · une munition · consommée au tir",
  },
  deathStar: {
    eyebrow: "Arme EMP tactique",
    tally: "{{used}} armes sur {{total}} disponibles",
    none: "Aucune Étoile de la Mort sur ce monde",
    building: "Construction · {{duration}}",
    paused: "Construction interrompue pendant la récupération",
    ready: "Prête au lancement",
    stock:
      "{{ready}} prêtes · {{building}} en construction · {{held}}/{{capacity}}",
    build: "Construire",
    started: "Construction de l’Étoile de la Mort lancée",
    dangerHint:
      "EMP : l’Aegis tombe à zéro et ne se régénère pas pendant 1 heure. Les défenses terrestres ne tirent pas et ne subissent aucun dégât durant ce temps.",
    readyHint:
      "Prête : l’Aegis de la cible tombe à zéro et ne se régénère pas pendant 1 heure ; les défenses terrestres ne tirent pas et ne subissent aucun dégât.",
    needProtocol: "Protocole",
    needCore: "Noyau niveau {{level}}",
    needShipyard: "Chantier Spatial niveau {{level}}",
    needOperational: "Monde opérationnel",
    buildTime: "{{duration}} · une arme · aucun rappel possible",
  },
  tabs: {
    label: "Sections de la planète",
    defendProblem: "Défense",
    defendQuestion:
      "Renforce ici ton bouclier, tes réserves et tes canons planétaires.",
    orbitProblem: "Renseignement",
    orbitQuestion:
      "Construis ici les outils qui te permettent d’observer tes rivaux.",
    reachProblem: "Flotte",
    reachQuestion:
      "Développe ici tes vaisseaux et ta portée.",
    growProblem: "Production",
    growQuestion:
      "Augmente ici tes ressources et la limite de niveau de tes bâtiments.",
    tacticalProblem: "Tactique",
    tacticalQuestion: "Construis et gère ici les outils tactiques.",
  },
  queue: {
    ends: "se termine à {{time}}",
    segment: "{{name}} · {{duration}}",
    cancelOne: "Annuler la commande {{name}}",
    title: "Files de production",
    idle: "Aucune production",
    capacity: "{{count}} places chacune",
    construction: "Construction",
    yard: "Chantier Spatial",
    slotFree: "Libre",
    empty: "Aucun travail assigné",
    committing: "traitement…",
    staged: "démarrera après la revendication",
    queued_one: "{{count}} commande en attente",
    queued_other: "{{count}} commandes en attente",
    unitsQueued_one: "{{count}} unité en attente",
    unitsQueued_other: "{{count}} unités en attente",
    afterQueue: "Après la file",
    cancel: "Annuler",
    cancelling: "Annulation…",
    refund:
      "Remboursement : {{alloy}} alliage · {{crystal}} cristal · {{deuterium}} Deutérium",
    cancelled:
      "Commande annulée · {{alloy}} alliage, {{crystal}} cristal et {{deuterium}} Deutérium remboursés",
    /**

  * LE DEUXIÈME COÛT D’UNE ANNULATION. Rapport au propriétaire.
  *
  * Le coût de l’annulation se trouvait dans un attribut `title`, donc dans une
  * infobulle inexistante sur téléphone. La moitié perdue n’était ainsi pas seulement
  * non confirmée : elle n’apparaissait jamais à l’écran.
  * On commence par dire CE QUI DISPARAÎT : afficher uniquement le remboursement
  * ressemble à un gain puisque des ressources reviennent au joueur.
    */
    confirm: {
      eyebrow: "Annuler la commande",
      lead: "%{{share}} du coût de cette commande sera perdu. Le reste te sera immédiatement rendu.",
      lost: "Perdu",
      kept: "Remboursé",
      progress:
        "Le travail déjà effectué est également perdu — une nouvelle commande repartira de zéro.",
      commit: "Annuler la commande",
      back: "Retour",
    },
  },
  capacity: {
    hangarBand: "Capacité de flotte",
    hangarFull:
      "Hangar plein : {{used}} sur {{total}} d’espace sont occupés. Améliore le Hangar pour accueillir davantage de vaisseaux.",
    hullUse:
      "Chaque unité occupe {{bulk}} d’espace · après la file : {{used}} / {{total}} occupés.",
    full: "Plus de place : {{used}} sur {{total}} d’espace sont occupés. Augmente d’abord la capacité correspondante.",
  },
  roles: {
    vault:
      "Détermine combien d’heures de production de chaque ressource peuvent être stockées ; les 10 % inférieurs, dans la limite de 8 heures de production, sont protégés contre les raids.",
    shipyard:
      "Débloque de nouvelles classes de vaisseaux ; accélère la construction des vaisseaux et des défenses terrestres, et augmente les chances de réussite de tes sondes.",
    refinery:
      "Augmente la production horaire d’alliage ; comme le Dépôt est exprimé en heures, la quantité d’alliage stockable augmente avec elle. La plupart des bâtiments et des vaisseaux utilisent cette ressource.",
    extractor:
      "Augmente la production horaire de cristal ; comme le Dépôt est exprimé en heures, la quantité de cristal stockable augmente avec elle. Les vaisseaux avancés, les dispositifs et les recherches utilisent du cristal.",
    coreCapped_one:
      "{{count}} bâtiment a atteint la limite actuelle du Noyau ; il ne peut plus progresser tant que le Noyau n’est pas amélioré.",
    coreCapped_other:
      "{{count}} bâtiments ont atteint la limite actuelle du Noyau ; ils ne peuvent plus progresser tant que le Noyau n’est pas amélioré.",
    coreClear:
      "Aucun bâtiment ne peut dépasser le niveau du Noyau. Le Noyau détermine les limites des bâtiments et leur vitesse de construction.",
  },
  defend: {
    strategicBand: "Défense stratégique",
    strategicNote:
      "Une munition chargée détruit la première Étoile de la Mort détectée par un Radar de niveau 3 ou identifiée dans le champ de vision d’un Télescope ; elle est consommée lorsqu’elle tire.",
    /** Taktik geri çekilme : le seuil propre du défenseur et le carburant qu’il coûte. */
    escapeReady:
      "Retraite tactique · un raid de {{at}}+ de feu qui anéantirait cette ligne ne trouve plus tes vaisseaux · le décollage brûle {{fuel}} Deutérium",
    escapeShort:
      "Retraite tactique · tes vaisseaux fuiraient un raid de {{at}}+ de feu, mais le décollage demande {{fuel}} Deutérium et le réservoir en contient {{stock}}",
    shieldBand: "Bouclier",
    shieldNote:
      "L’Aegis absorbe les dégâts avant qu’ils n’atteignent tes unités. Ses niveaux augmentent le bouclier maximal ; il régénère chaque heure 35 % de sa valeur maximale.",
    groundBand:
      "Défenses terrestres (capacité augmentée par le Noyau de Commandement)",
    groundNote:
      "Elles ne quittent jamais la planète. Le Hérisson contre les Remparts, le Harpon les Escarmoucheurs et le Bastion les Lances.",
    thornNone:
      "Défense terrestre légère. Forte contre la classe Rempart, faible contre la classe Lance.",
    thornStanding:
      "{{count}} présents au sol. Forts contre la classe Rempart, faibles contre la classe Lance.",
    thornGain: "Hérisson",
    harpoonNone: "Défense terrestre Lance, forte contre les Escarmoucheurs et faible contre les Remparts.",
    harpoonStanding: "{{count}} en place. Forte contre les Escarmoucheurs et faible contre les Remparts.",
    harpoonGain: "Harpon",
    bastionNone:
      "Défense terrestre lourde. Forte contre la classe Lance, faible contre les Escarmoucheurs.",
    bastionStanding:
      "{{count}} présents au sol. Forts contre la classe Lance, faibles contre les Escarmoucheurs. 60 % des canons terrestres détruits sont reconstruits à partir des débris, arrondis à l’entier inférieur.",
    groundGain: "Unité terrestre",
    aegisPointer:
      "Le bouclier est un équipement ; <0>{{name}}</0> se trouve dans l’onglet Orbite.",
  },
  orbit: {
    contextLabel: "Réseau orbital",
    networkBand: "Liaison",
    networkNote:
      "L’Antenne utilise un emplacement et débloque le Télescope et le Radar.",
    intelBand: "Dispositifs planétaires",
    intelNote:
      "Ils possèdent des niveaux et n’utilisent aucun emplacement orbital.",
    inOrbitBand: "En orbite",
    inOrbitNote:
      "Chacun utilise un emplacement. Ils ne s’achètent qu’une fois et ne possèdent aucun niveau.",
    onPlanetBand: "Sur la planète",
    onPlanetNote:
      "Aucun emplacement requis. Ils possèdent des niveaux et peuvent être améliorés jusqu’à la limite autorisée par le Noyau de Commandement.",
    slotsFree_one: "{{count}} emplacement encore libre ci-dessus",
    slotsFree_other: "{{count}} emplacements encore libres ci-dessus",
    slotsNone: "orbite pleine",
    slotsUsed: "{{used}}/{{total}}",
    slotsNext: "+1 au niveau {{level}} du Noyau",
    rackLabel: "Emplacements orbitaux",
    slotEmpty: "Libre",
    inactiveSatellite:
      "Tu le possèdes ; il reste inactif jusqu’à ce que le Noyau de Commandement rouvre cet emplacement orbital.",
    inactiveUplink:
      "Tu possèdes le niveau {{owned}} ; il reste inactif jusqu’à la réactivation de l’Antenne.",
    inactiveCore:
      "Tu possèdes le niveau {{owned}} · niveau {{active}} actif jusqu’à la réparation du Noyau de Commandement.",
    alreadyInOrbit: "déjà en orbite",
  },
  reach: {
    orbitBand: "Satellites opérationnels",
    orbitNote:
      "La Foreuse accélère les Prospecteurs de ce monde et augmente leurs soutes ; le Guide accélère les flottes de raid et de transfert. Chacun utilise un emplacement orbital.",
    family: {
      OFFENSIVE: {
        label: "Vaisseaux offensifs",
        note: "Les Escarmoucheurs misent sur la vitesse, les vaisseaux d’assaut sur l’attaque. Les lignes progressent par palier.",
      },
      DEFENSIVE: {
        label: "Vaisseaux défensifs",
        note: "Les forteresses échangent de la vitesse contre de la résistance ; les escortes préservent mieux le rythme de la flotte.",
      },
      CARGO: {
        label: "Vaisseaux cargo",
        note: "Ces transports sans armes échangent vitesse de trajet contre capacité de soute et nécessitent une escorte.",
      },
      SPECIALIST: {
        label: "Vaisseaux spécialisés",
        note: "Ils apportent une réponse précise à un problème visible ; contre la mauvaise cible, le coût de leur spécialisation est gaspillé.",
      },
    },
    frontierBand: "Recherches de pointe",
    frontierNote:
      "Les recherches utilisent la file commune de ton commandant. La Construction et le Chantier Spatial continuent de fonctionner séparément.",
    isotopeName: "Spectrométrie Isotopique",
    isotopeTag: "Débloque l’extraction du Deutérium",
    isotopeRole:
      "Révèle le Deutérium présent dans les astéroïdes isotopiques et permet d’y envoyer des Prospecteurs. Les ressources rapportées rejoignent le stock de production.",
    denseName: "Cellules de Carburant Dense",
    denseTag: "Débloque le Coureur",
    denseRole:
      "Pour la découvrir, remplis ta soute pendant un raid tout en laissant du butin sur la cible. Le Coureur est plus rapide que le Cargo Lourd, mais transporte moins.",
    graviticName: "Charges Gravitiques",
    graviticTag: "Débloque le Perceur",
    graviticRole:
      "Pour la débloquer, attaque un monde disposant de défenses et d’un Aegis actif ; le bouclier doit absorber au moins {{share}} des dégâts du raid. Un seul Faucon suffit et tu n’as pas besoin de gagner. Le Perceur inflige cinq fois plus de dégâts au bouclier.",
    gridName: "Réseau d’Interception",
    gridTag: "Détruit l’Étoile de la Mort",
    gridRole:
      "Une munition chargée détruit une arme stratégique dans le rayon d’interception d’un Radar de niveau 3 ou dans le champ de vision d’un Télescope. Une Antenne et un Radar 3 sont nécessaires à son installation.",
    stockpileName: "Réserve Stratégique",
    stockpileTag: "Une deuxième arme sur la rampe",
    stockpileRole:
      "Tu peux maintenir deux Étoiles de la Mort prêtes sur chaque monde. La seconde est construite après la première, pour le même coût et avec la même durée.",
    waspDoctrineName: "Doctrine du Faucon",
    lanceDoctrineName: "Doctrine Lance/Perceur",
    bulwarkDoctrineName: "Doctrine du Rempart",
    groundDoctrineName: "Doctrine Bastion/Hérisson",
    generalName: "Armement et Blindage",
    generalTag: "Améliore toutes les coques que tu possèdes",
    doctrineTag: "Meilleure attaque et meilleur blindage",
    doctrineRole:
      "Augmente simultanément la puissance d’attaque et la résistance de coque de la classe concernée. Les recherches ne modifient pas les avantages naturels entre classes.",
    yardName: "Automatisation du Chantier Spatial",
    yardTag: "Construit les vaisseaux plus rapidement",
    yardRole:
      "Réduit le temps de production des vaisseaux mobiles ; n’affecte ni les défenses terrestres ni la capacité des files de production.",
    holdsName: "Soutes de Prospecteur",
    holdsTag: "Les Prospecteurs transportent davantage",
    holdsRole:
      "Augmente la quantité de minerai que chaque Prospecteur peut transporter en un voyage ; le bonus de soute de la Foreuse s’applique ensuite par-dessus.",
    cargoName: "Soutes de Vaisseau",
    cargoTag: "Chaque soute transporte davantage",
    cargoRole:
      "Augmente à la fois le butin des raids, les transferts entre mondes et les convois commerciaux.",
    synthesisName: "Synthèse du Deutérium",
    synthesisTag: "Augmente le niveau maximal de la Raffinerie",
    synthesisRole:
      "Chaque palier débloque trois niveaux supplémentaires de Raffinerie de Deutérium sur tous les mondes que tu possèdes.",
    researchNeedCore: "Améliore le Noyau de Commandement au niveau {{level}}",
    researchAct: "Rechercher",
    researchComplete: "recherchée",
    researchAt: "disponible dans {{duration}}",
    researchIsotopeFirst: "Recherche d’abord la Spectrométrie Isotopique",
    researchDenseFirst: "Recherche d’abord les Cellules de Carburant Dense",
    researchGraviticFirst: "Recherche d’abord les Charges Gravitiques",
    researchWarAt: "La phase de guerre commence dans {{duration}}",
    researchCargoInsight:
      "Remplis ta soute pendant un raid tout en laissant du butin sur la cible",
    researchShieldInsight:
      "L’Aegis doit absorber au moins {{share}} des dégâts du raid",
    warshipsBand: "Vaisseaux de combat",
    warshipsNote:
      "Ils constituent la puissance de combat de la flotte de raid. Lorsqu’ils sont en mission, ils ne peuvent pas défendre leur monde d’origine.",
    supportBand: "Soutien",
    supportNote:
      "Ils ne combattent pas. Choisis entre une capacité moins coûteuse et une durée d’exposition plus courte.",
    miningBand: "Mineurs",
    miningNote:
      "Ils se rendent sur les astéroïdes et les champs d’épaves et rapportent les ressources qu’ils peuvent transporter vers le stock de production.",
    ownedGain: "Possédés",
    hullAwayCount: "{{count}} en vol",
    hullLocationCounts: "{{home}} chez toi · {{away}} dehors",
    hullTier: "Niv. {{tier}}",
    prospectorLimit: "{{owned}} / {{max}} · limite",
  },
  grow: {
    multiplierBand: "Satellite de production",
    multiplierNote:
      "Le Soufflet augmente de 6 % la production d’alliage, de cristal et de Deutérium de ce monde et utilise un emplacement du réseau orbital commun.",
  },
  projectSheet: {
    frontier: "Recherche de pointe",
    complete: "Recherche terminée",
    cost: "Coût de la recherche",
    once: "Entre une seule fois dans la file de Recherche commune de ton commandant.",
  },
  blocked: {
    core: "Noyau niveau {{level}}",
    uplink: "Antenne en orbite",
    orbitSlot: "emplacement orbital libre",
    shipyard: "Chantier Spatial niveau {{level}}",
    research: "{{research}} {{level}}",
    requirements: "Requis : {{requirements}}",
    plantRung: "Recherche un palier supplémentaire de Synthèse du Deutérium",
    maxed: "niveau maximal",
    queueFull:
      "Il y a déjà 3 commandes dans la file. Attends que l’une d’elles se termine ou annule-en une avant d’ajouter celle-ci.",
  },
  done: {
    raised: "{{name}} est maintenant au niveau {{level}}",
    instrument: "{{name}} niveau {{level}} opérationnel",
    satellite: "{{name}} installé en orbite",
    built: "{{count}} {{name}} construits",
    researched: "{{name}} terminée",
    queued: "{{name}} niveau {{level}} ajouté à la file",
    queuedSimple: "{{name}} ajouté à la file",
    unitsQueued: "{{count}} {{name}} ajoutés à la file",
  },
  buildSheet: {
    eyebrowGround: "Défense terrestre · ne décolle jamais",
    eyebrowMobile: "Coque mobile",
    howMany: "Combien",
    fewer: "Réduire {{name}}",
    more: "Ajouter {{name}}",
    quantity: "Nombre de {{name}}",
    max: "Maximum de {{name}}",
    maxShort: "Maximum",
    /* Permet de revenir du maximum à zéro en une seule pression. */
    reset: "Remettre le nombre de {{name}} à zéro",
    resetShort: "Réinitialiser",
    build: "En construire {{count}}",
    capped:
      "Tu en possèdes déjà {{count}}, c’est la limite. Les unités en mission comptent aussi, tu ne peux donc pas en construire davantage.",
    heldOfMax:
      "Tu en possèdes {{owned}} sur un maximum de {{max}}. Les unités en mission comptent également.",
    defenceAfter:
      "Une fois terminé, {{count}} unités seront présentes sur ce monde",
  },
} as const;
export const itemSheet = {
  eyebrowNotInOrbit: "Pas en orbite",
  eyebrowInOrbit: "En orbite",
  eyebrowNotInstalled: "Non installé",
  eyebrowLevel: "Niveau {{level}}",
  actPutInOrbit: "Placer en orbite",
  actAlreadyInOrbit: "Déjà en orbite",
  actInstall: "Installer",
  actRaise: "Passer au niveau {{level}}",
  lockedNote: "Verrouillé. Requis : {{reason}}.",
  ladderHeading: "Ce que chaque niveau apporte",
  rungLevel: "Niveau {{level}}",
  rungNewHardware: "Nouvel équipement au niveau {{level}}",
  orbitalDoesHeading: "Ce qu’il apporte",
  orbitalCostHeading: "Ce qu’il coûte",
  orbitalOnce: "une seule fois ; aucune amélioration possible",
  orbitalFree: "{{free}} emplacements libres sur {{total}}",
  orbitalNoSlot: "Aucun emplacement libre. Améliore le Noyau de Commandement",
} as const;
export const upgradeRow = {
  about: "Qu’est-ce que {{name}} ?",
  nextTierAlt: "{{name}} au palier suivant",
  becomes: "devient",
  /** Fin de l’échelle ; un palier ne prend son sens que par rapport à l’ensemble. */
  ceiling: "· plafond {{value}}",
  affordableIn: "À ce rythme, tu pourras l’acheter dans <0>{{duration}}</0>",
  /** Durée du travail lui-même — l’horloge de l’objet, pas celle du portefeuille. */
  takes: "{{duration}}",
  takesLabel: "Construction : {{duration}}",
  ladder: "Niveau {{level}} / {{max}}",
} as const;
export const action = {
  verbRaise: "Améliorer",
  verbBuild: "Construire",
  verbInstall: "Installer",
  verbClaim: "Récupérer",
  verbSend: "Envoyer",
  short: "Manque",
  shortfallAlloy: "{{amount}} alliage",
  shortfallCrystal: "{{amount}} cristal",
  shortfallDeuterium: "{{amount}} Deutérium",
  shortfallJoin: " et ",
  shortfallLabel: "Manque : {{parts}} requis",
  statAttack: "Attaque",
  statHull: "Résistance",
  statSpeed: "Vitesse",
  statSpeedFixed: "fixe",
  statCargo: "Soute",
  statCargoNone: "—",
  statSalvage: "Ferraille",
  statRoom: "Volume",
  statFuel: "Carburant",
  statFuelRate: "{{value}} /1k",
  statFuelNone: "—",
} as const;
export const planetHero = {
  capital: "Planète capitale",
  colony: "Planète coloniale",
  /**
   * LE PALIER DU MONDE LUI-MÊME, SOUS SON PORTRAIT. Rapport au propriétaire.
   *
   * Le palier est le nombre utilisé pour classer toute la galaxie : le disque
   * dimensionne le monde à partir de lui, chaque fichier le mentionne et, depuis
   * D168, il détermine aussi qui peut combattre qui. Il était visible partout,
   * sauf sur les propres mondes du joueur.
   */
  tier: "palier {{tier}}",
  firepower: "Puissance de feu",
  perHourSuffix: "/h",
  disrupted: "Raid subi, production interrompue · {{countdown}}",
  defence: "Défense",
  defenceNone: "Aucune",
  defenceShips_one: "{{count}} vaisseau",
  defenceShips_other: "{{count}} vaisseaux",
  defenceGuns_one: "{{count}} canon",
  defenceGuns_other: "{{count}} canons",
  defenceUnarmed_one: "dont {{count}} cargo sans armes",
  defenceUnarmed_other: "dont {{count}} cargos sans armes",
  fleetAway: "{{count}} en vol",
  shield: "Bouclier",
  shieldNone: "Aucun",
  shieldNoAegis: "aucun Aegis",
  shieldOffline: "Hors service",
  shieldCoreOffline: "Centre de commandement défaillant · Aegis hors ligne",
  defenceCoreOffline:
    "Canons terrestres hors ligne · centre de commandement défaillant",
  shieldValue: "{{current}} / {{max}}",
  shieldMeter: "Charge du bouclier Aegis",
  shieldRegen: "+{{amount}}/h · avant les unités",
  vaultSafe: "Protégé dans le Dépôt",
  storeLabel: "Dépôt",
  storeRule:
    "Le niveau du Dépôt détermine la longueur de ces barres ; la zone encadrée par un bouclier représente la part protégée contre les raids.",
  alloyStore: "{{held}} / {{cap}} alliage, dont {{safe}} protégés",
  crystalStore: "{{held}} / {{cap}} cristal, dont {{safe}} protégés",
  deuteriumStore: "{{held}} / {{cap}} Deutérium, dont {{safe}} protégés",
  alloySafe: "{{amount}} alliage protégés",
  crystalSafe: "{{amount}} cristal protégés",
  deuteriumSafe: "{{amount}} Deutérium protégés",
  atRisk: "À risque",
  atRiskValue: "{{amount}} exposés",
} as const;
export const launch = {
  /** When the world is covered again, under the exposure: the mock's "Dönüş 23:06". */
  backAt: "retour {{time}}",
  fuel: "Carburant",
  eyebrow: "Attaque",
  /** Engagement fondé sur un relevé. L’ancienneté de la cible est indiquée ici. D151. */
  eyebrowRecord: "Attaque · dernière observation il y a {{age}}",
  /**
   * UN PIRATE N’A PAS DE RELEVÉ QUI VIEILLIT — il n’est jamais mémorisé et sa
   * lecture est, par définition, en direct. L’autre horloge est donc plus utile :
   * combien de temps il restera encore là, c’est-à-dire pourquoi il faut se dépêcher.
   */
  eyebrowPirate: "Attaque · départ dans {{duration}}",
  back: "Retour",
  launching: "Décollage",
  commit: "Envoyer — aucun rappel possible",
  /** A raid on a world, which may be turned once while it flies (K8); a pirate raid keeps `commit`. */
  commitWorld: "Envoyer",
  /** B14: the held commit, and the price line under the ships (K8: a world raid turns). */
  holdWorld_one: "Lancer {{count}} vaisseau",
  holdWorld_other: "Lancer {{count}} vaisseaux",
  holdPirate_one: "Lancer {{count}} vaisseau — aucun rappel",
  holdPirate_other: "Lancer {{count}} vaisseaux — aucun rappel",
  warningWorld: "Ton monde garde {{count}} unités jusqu'au retour de cette flotte.",
  warningPirate: "Aucun rappel. Ton monde garde {{count}} unités jusqu'au retour de cette flotte.",
  exposed: "Exposé",
  baysFree: "{{count}} libres",
  recallNote:
    "Rappelable une fois en vol — le retour dure autant que le trajet déjà effectué. Le carburant n'est pas remboursé.",
  chooseFleet: "Choisis ta flotte",
  send: "Envoyer {{count}} vaisseaux",
  launched:
    "Flotte lancée. Tu restes exposé pendant {{duration}} ; {{count}} unités restent chez toi.",
  whileAway: "Pendant l’absence de cette flotte",
  defending: "{{count}} unités défendent le monde",
  nothingSent: "Tu n’as encore sélectionné aucun vaisseau",
  exposedFor: "Exposé pendant {{duration}}",
  oneWay: "Aller simple",
  oneWayUnknown: "—",
  pace: "Vitesse de vol",
  paceHint: "Plus lent arrive plus tard. Même carburant, et rien ne reste en vol au-delà de 12 h.",
  paceFull: "Pleine",
  /* Raisons pour lesquelles cet engagement peut être refusé ; chacune apparaît sur le bouton. */
  noBay: "Aucune baie de vol libre",
  noFuel: "Pas assez de Deutérium",
  tooLate: "La cible sera partie avant ton arrivée",
  /** Aucun vaisseau stationné ici ne peut la rattraper. */
  unreachable: "Aucun vaisseau d’ici ne peut l’atteindre",
  /** Certains pourraient l’atteindre — mais pas le plus lent de la sélection actuelle. */
  tooSlow: "Laisse les vaisseaux lents derrière",
  /** Un raid contre un monde doit pouvoir tirer. Le serveur le refuse également. */
  noEscort: "Ajoute un vaisseau de combat",
  shipyardRevolt: "Mutinerie en cours",
  cargo: "Soute",
  salvage:
    "Si tes Ferrailleurs survivent, ils récupéreront jusqu’à {{amount}} dans les débris",
  distance: "Distance",
  fleetHeading: "Flotte",
  atHome: "{{count}} chez toi",
  perShipStats: "Valeurs par vaisseau · recherches incluses",
  away: "{{fleet}} sont actuellement en vol. Tu ne peux envoyer depuis ici que les vaisseaux présents sur ce monde.",
  awaySeparator: " · ",
  awayHull: "{{count}} {{name}}",
  fewer: "Réduire {{name}}",
  more: "Ajouter {{name}}",
  quantity: "Nombre de {{name}}",
  max: "Maximum de {{name}}",
  maxShort: "Maximum",
  noShips:
    "Aucun vaisseau n’est présent. Construis-en au Chantier Spatial ou attends le retour de ceux qui sont en mission.",
  warning:
    "Impossible de rappeler cette flotte. Une fois partie, tu ne découvriras ce qui se trouve en dessous qu’en suivant son arrivée ; jusqu’à son retour, {{count}} unités resteront sur ta planète.",
  shieldWarning:
    "Ce raid fera tomber ton bouclier de premier jour. Une fois la protection levée, les autres commandants pourront eux aussi t’attaquer.",
  recoveryShieldWarning:
    "Ce raid mettra fin à ton bouclier de récupération et au bonus de production de +50 %. Une fois la protection levée, les autres commandants pourront eux aussi t’attaquer.",
  fleetsave:
    "Les vaisseaux en vol ne peuvent pas être pillés. Ta planète, elle, peut l’être.",
} as const;
export const transfer = {
  fuel: "carburant de vol",
  cooldown: "Déchargement — {{duration}} restantes",
  homewardFuel: "Demi-tarif — entre vos propres mondes. Une attaque paie plein.",
  /** Under the pace rungs: what a slower TRANSFER buys — time in the air. */
  paceHint: "Plus lent arrive plus tard — les vaisseaux en vol ne peuvent pas être pillés. Même carburant ; rien ne reste en vol au-delà de 12 h.",
  fuelShort: "{{short}} manquants",
  eyebrow: "Transfert interplanétaire",
  eta: "Arrivée",
  capacity: "Cargaison",
  fleet: "Vaisseaux",
  homeDefence:
    "{{ships}} vaisseaux resteront sur le monde de départ · {{power}} de puissance de feu",
  cargo: "Ressources",
  alloy: "Alliage",
  crystal: "Cristal",
  deuterium: "Deutérium",
  commit: "Transférer",
  /** B14: what stops a transfer, on the held commit rather than a grey button. */
  noRoom: "Plus de place dans le Hangar de destination",
  overLoad: "Plus que la soute ne peut porter",
  sending: "Départ en cours",
  launched: "Transfert lancé · {{duration}}",
  /** The recall rule and the two limits on what moves. Faz 2A.4 made "one way" false. */
  rules:
    "Rappelable une fois en vol — le retour dure autant que le trajet déjà effectué. Les défenses terrestres ne peuvent pas être transférées ; seuls les Cargos, Voyageurs, Atlas et Argosi apportent de la capacité de transport.",
  hullNone: "Aucun sur ce monde",
  holdReady:
    "Les ressources sont transportées par les Cargos, Voyageurs, Atlas et Argosi. Soute : {{capacity}}.",
  destinationLabel: "Hangar de destination",
  holdNeedsLoad:
    "Ajoute un Cargo, un Voyageur, un Atlas ou un Argosi ci-dessus pour transporter des ressources.",
  holdNoCarrier:
    "Aucun Cargo, Voyageur, Atlas ou Argosi capable de transporter des ressources n’est présent sur ce monde.",
  /** Sous-titre de la barre d’espace de la cible ; les valeurs sont dessinées par la barre elle-même. */
  /** Équivalent lecteur d’écran des marqueurs indiquant le nombre de vaisseaux. */
  hullPacked: "{{packed}} {{name}} chargés sur {{held}} disponibles",
  /** Sous-titre de la barre située sous le curseur de cargaison : ce qui part avec ce transfert. */
  cargoSending: "Tu envoies",
} as const;
export const capacity = {
  fit: "peuvent encore tenir",
  full: "PLEIN",
  /* Les deux extrémités de la barre d’une carte de capacité. */
  used: "occupé",
  free: "libre",
  reading: "{{used}} utilisés sur {{total}} de capacité",
} as const;
/**
 * PANNES DE COLONIE. Ton : dire ce qui se passe, sans déclencher d’alarme.
 *
 * Chaque phrase nomme quelque chose qui S’EST ARRÊTÉ et explique ce que cela bloque ;
 * aucune ne parle d’« alerte » ou de situation « critique ». Gérer trois mondes implique
 * naturellement ce genre de problème. Un texte alarmiste apprendrait soit au joueur
 * à l’ignorer, soit à considérer quatre petites pannes comme une catastrophe.
 */
export const faults = {
  title: "Pannes",
  mark: "Panne active",
  launchBlock: {
    SHIPYARD_REVOLT: "Mutinerie au Chantier Spatial",
    PROSPECTOR_FAULT: "Centre des Prospecteurs en panne",
  },
  strip: {
    title: "Réparation",
    capacity: "{{count}} équipes",
    priceAlloy: "{{alloy}} alliage",
    priceBoth: "{{alloy}} alliage · {{crystal}} cristal",
    lane: "Équipe {{slot}}",
  },
  tab: "Quelque chose est en panne ici",
  name: {
    REFINERY_OUTAGE: "Coupure de courant à la Raffinerie d’Alliage",
    EXTRACTOR_OUTAGE: "Coupure de courant à la Mine de Cristal",
    PLANT_OUTAGE: "Coupure de courant à la Raffinerie de Deutérium",
    VAULT_LEAK: "Fuite du Dépôt",
    CORE_OUTAGE: "Coupure de courant au centre de commandement",
    TELESCOPE_FAULT: "Panne du Télescope",
    SHIPYARD_REVOLT: "Mutinerie au Chantier Spatial",
    PROSPECTOR_FAULT: "Panne du centre des Prospecteurs",
  },
  stopped: {
    REFINERY_OUTAGE:
      "La Raffinerie est plongée dans le noir. Ce monde ne produit plus aucun alliage.",
    EXTRACTOR_OUTAGE:
      "La Mine est plongée dans le noir. Ce monde ne produit plus aucun cristal.",
    PLANT_OUTAGE:
      "La Raffinerie est plongée dans le noir. Ce monde ne produit plus aucun Deutérium.",
    VAULT_LEAK:
      "Le Dépôt fuit vers l’orbite — tous ceux dont le Télescope porte jusque-là peuvent voir ce champ et venir le récupérer.",
    CORE_OUTAGE:
      "Le centre est hors ligne : l’Aegis est éteint et les canons terrestres n’ont plus de contrôle de tir. Les vaisseaux présents continuent de combattre. Si quelqu’un arrive maintenant, il tombe sur un monde exposé.",
    TELESCOPE_FAULT:
      "Le Télescope est aveugle. Jusqu’à sa réparation, ce monde ne voit rien au-delà de sa portée naturelle.",
    SHIPYARD_REVOLT:
      "Le Chantier Spatial s’est arrêté. Plus rien ne décolle de ce monde — ni raid, ni transfert, ni convoi. Les flottes déjà en vol peuvent toujours rentrer.",
    PROSPECTOR_FAULT:
      "Le centre des Prospecteurs est fermé. Aucun Prospecteur ne peut partir de ce monde. Ceux déjà en mission peuvent toujours être rappelés.",
  },
  toll: {
    title: "Ce que cette panne te coûte",
    alloy: "{{amount}} alliage par heure ne sont plus produits",
    crystal: "{{amount}} cristal par heure ne sont plus produits",
    deuterium: "Toute la production horaire de Deutérium de ce monde",
    leak: "{{amount}} fuient en orbite chaque heure ; tous ceux qui peuvent voir ce monde peuvent venir les récupérer",
  },
  loyalty: {
    title: "Loyauté de ce monde",
    battleLoss: "Défaite légère −15 · défaite lourde −30",
    line: "%{{value}} — diminue tant que {{count}} éléments sont en panne. À ce rythme, elle atteindra zéro dans {{time}} et la colonie déclarera son indépendance.",
    bar: "Loyauté %{{value}}",
    left: "{{time}} restantes",
  },
  price: {
    title: "Réparation",
    crew: "équipe",
    parts: "pièce",
    takes:
      "Prend entre 5 et 15 minutes. L’équipe donne sa durée exacte au moment où elle est mobilisée.",
  },
  repair: "Envoyer une équipe",
  running: "Une équipe sur place · {{time}}",
  noCancel: "Une réparation commencée ne peut pas être annulée.",
  lanesFull: "Tes {{count}} équipes sont toutes mobilisées",
  started: "Équipe en route.",
  failed: "Impossible de démarrer.",
} as const;
