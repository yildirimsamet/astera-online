/**

* LE CADRE QUI NE DISPARAÎT JAMAIS — barre supérieure, bandeau des vols, Signaux
* et les éléments d’interface qui composent chaque surface.
*
* Pour « Works », le français utilise ici STOCK DE PRODUCTION : l’endroit où la
* production s’accumule, s’arrête lorsqu’il est plein et se vide manuellement.
* Un terme plus technique alourdirait inutilement l’interface ; cette formulation
* correspond directement aux deux réservoirs représentés à l’écran.
  */
export const statusBar = {
  activeWorld: "Monde actif",
  capitalWorld: "PLANÈTE CAPITALE · {{name}}",
  colonyWorld: "COLONIE · {{name}}",
  alloyLabel: "Alliage",
  crystalLabel: "Cristal",
  deuteriumLabel: "Deutérium",
  storeFull: "PLEIN",
  storeFree: "{{amount}} de place",
  menuHint:
    "Commandant {{name}} ; classement, récompenses, annonces, aide et compte",
  menuWaiting: "{{count}} récompenses en attente",
  clanWaiting: "{{count}} nouveautés de clan en attente",
  newcomerShield: {
    hint: "Aucun raid ne peut te viser pendant {{duration}}",
  },
  recoveryShield: {
    hint: "Bouclier de récupération : aucun raid ne peut te viser pendant {{duration}}",
  },
  recoveryBoost: {
    mark: "Production +50 %",
    note: "Production +50 % pendant la protection",
  },
  bays: {
    hint: "{{used}} rampes occupées sur {{total}}",
    label: "Rampe",
    free: "{{count}} libres",
  },
  works: {
    label: "Stock de production",
    labelFull: "Stock de production plein",
    collect: "Collecter",
    idle: "—",
    hintFull: "Le stock de production est plein, collecte-le maintenant",
    hintCollect: "Collecter {{amount}}",
    collected: "{{amount}} collectés",
    collectedPartly: "{{moved}} collectés, {{held}} n’ont pas pu être stockés",
    storeFull: "Dépôt plein",
  },
} as const;
export const pendingStrip = {
  empty: "Aucun vol en cours",
  openFlights: "Voir les appareils en vol",
  sheetEyebrow: "Tes appareils en vol",
  sheetTitle: "En vol",
  sheetEmpty: "Aucun de tes appareils n’est encore en vol.",
  incoming: "Flotte en approche",
  /** Et le monde visé. Ce n’est pas une information produite par le Radar ; c’est ton propre monde. */
  incomingAt: "Arrive → {{world}}",
  incomingFromAt: "Arrive → {{world}} · depuis {{origin}}",
  probe: "Ta sonde → {{target}}",
  deathStar: "Ton Étoile de la Mort → {{target}}",
  settlement: "Colonisation → {{target}}",
  transfer: "Transfert → {{target}}",
  pirateOut: "Raid → {{target}}",
  pirateHome: "Raid en retour · {{target}}",
  tradeOut: "Convoi → Vaisseau marchand",
  tradeHome: "Convoi en retour · Vaisseau marchand",
  intergalacticConvoyOut: "Raid → Convoi Intergalactique",
  intergalacticConvoyHome: "Raid en retour · Convoi Intergalactique",
  fleetHome: "Ta flotte revient · {{target}}",
  fleetOut: "Ta flotte → {{target}}",
  engaging: "Combat en cours",
  more: "+{{count}}",
  drillOut: "Tes Prospecteurs → astéroïde",
  drillHome: "Tes Prospecteurs rentrent",
  salvageOut: "Tes Prospecteurs → épave",
  drillCount: "{{count}} Prospecteurs",
  recallProspectors: "Rappeler les Prospecteurs",
  recallFleet: "Rappeler la flotte",
  recallingFleet: "Rappel en cours",
  recallFleetStarted: "Retour au bercail — aussi long que le trajet déjà parcouru.",
  recallingProspectors: "Rappel en cours…",
  recallStarted: "Les Prospecteurs ont fait demi-tour · retour en cours",
  craftCount: "{{count}} appareils",
  craftUnknown: "Composition inconnue",
  incomingHint: "Menace en approche · ressources masquées",
  /** Même alerte lorsque l’appareil est visible dans ton disque. D162. */
  incomingVisible: "Menace en approche · dans tes capteurs — appuie pour voir",
  incomingFrom: "Arrive depuis {{origin}}",
  massLight: "Petite flotte en approche",
  massMedium: "Flotte de taille moyenne en approche",
  massHeavy: "Grande flotte en approche",
} as const;
export const signals = {
  beacon: "Signaux",
  beaconUnread: "Signaux — {{count}} non lus",
  title: "Signaux",
  eyebrowUnread: "{{count}} nouveaux",
  eyebrowRead: "Historique des notifications",
  statusHeading: "En ce moment",
  eventsHeading: "Ce qui s’est passé",
  openEvent: "Ouvrir le rapport associé",
  worldEvent: "Événement galactique",
  empty:
    "Aucune notification pour le moment. La galaxie t’avertira lorsqu’une flotte te visera, lorsqu’une sonde sera détectée ou lorsque tes vaisseaux rentreront.",
  repeat: "×{{count}}",
  status: {
    disruptedLine: "Stock de production hors service",
    disruptedDetail:
      "Tu as subi un raid. La production reprend dans {{duration}}.",
    worksStoppedLine: "Production arrêtée",
    worksStoppedDetail:
      "Le stock de production est plein. {{amount}} de production horaire sont perdus jusqu’à ce que tu le collectes.",
    alloyStoreLine: "Réserve d’alliage pleine",
    crystalStoreLine: "Réserve de cristal pleine",
    storeDetail:
      "{{amount}} attendent dans le stock de production, mais le Dépôt est plein. Dépense des ressources pour libérer de la place.",
  },
} as const;
export const sheet = {
  back: "Retour",
  close: "Fermer",
  dismiss: "Fermer",
} as const;
export const toast = {
  dismiss: "Fermer le message",
} as const;
export const surface = {
  unreachable: "Impossible de charger {{what}}.",
  retry: "Réessayer",
  whatPlanet: "ta planète",
  whatIntel: "tes renseignements",
  whatReports: "tes rapports de combat",
  whatRewards: "tes récompenses",
  whatLeaderboard: "le classement de Domination",
  whatChat: "le chat de la galaxie",
  whatChronicle: "le Pouls de la Galaxie",
  whatAnnouncements: "les annonces",
  whatAdminFeedback: "les retours des joueurs",
  waitingPlanet: "Chargement de la planète",
  waitingIntel: "Collecte des renseignements",
  waitingLeaderboard: "Classement de la galaxie",
  waitingChat: "Ouverture du chat de la galaxie",
  waitingChronicle: "Lecture de la galaxie",
  planetSigil: "Planète",
} as const;
/**
 * MENU — point d’entrée unique vers tout ce qui se trouve hors de la galaxie.
 *
 * Chaque chaîne est indépendante, même lorsqu’elle ressemble à une étiquette utilisée
 * ailleurs. La ligne qui ouvre le Renseignement n’est pas l’ancien bouton de titre qui
 * ouvrait cette vue ; modifier l’un ne doit pas faire dériver l’autre.
 */
export const menu = {
  /* The card the Commander page opens on: who, where, and how you stand (owner, 2026-09-24). */
  profile: {
    label: 'Ton commandant',
    noClan: 'Sans clan',
    seasonDay: 'Jour {{day}} de la saison',
    rank: 'Rang',
    worlds: 'Mondes',
    shield: 'Bouclier',
    shieldNone: 'Aucun',
  },
  eyebrow: "Commandant",
  seasonHeading: "Cette saison",
  asteraHeading: "Équipe Astera",
  helpHeading: "Aide",
  deviceHeading: "Cet appareil",
  marksHeading: "Tes repères",
  intelLabel: "Renseignement",
  intelHint: "Mondes surveillés, relevés Radar, sondes et rapports de combat",
  rewardsLabel: "Récompenses",
  rewardsHint:
    "Ressources gagnées grâce aux objectifs accomplis dans la galaxie",
  guideLabel: "Démarrage rapide",
  guideHint: "Tes premiers mouvements, dans l’ordre recommandé",
  rewardsWaiting: "{{count}} prêtes",
  researchLabel: "Recherche",
  researchHint:
    "Projets permanents qui s’appliquent à tous les mondes que tu possèdes",
  leaderboardLabel: "Classement",
  leaderboardHint:
    "Classement de Domination de tous les commandants de la galaxie",
  announcementsLabel: "Annonces",
  announcementsHint:
    "Actualités, mises à jour et notes brèves de l’équipe Astera",
  announcementsWaiting: "{{count}} nouvelles",
  feedbackLabel: "Retour",
  feedbackHint:
    "Signale un problème, propose une idée ou partage ton avis avec l’équipe Astera",
  skinsShopLabel: "Boutique",
  skinsShopHint: "Découvre les apparences de planète en 3D",
  skinsInventoryLabel: "Inventaire",
  skinsInventoryHint: "Applique tes apparences à tes planètes",
  clanLabel: "Clan",
  clanHint:
    "Rejoins une équipe pouvant compter jusqu’à cinq commandants ou crée ton propre clan",
  clanMemberLabel: "Clan · [{{tag}}]",
  clanMemberHint:
    "Membres, aide, butin partagé, historique du clan et chat privé",
  clanWaiting: "{{count}} en attente",
  rivalLabel: "Ton rival · {{commander}}",
  rivalHint: "Concentre-toi sur {{planet}} et choisis ton prochain mouvement",
  rivalLostLabel: "Signal du rival perdu",
  rivalLostShort: "Repère perdu",
  rivalLostHint: "Ce monde n’existe plus. Efface le repère.",
  rivalCleared: "Repère du rival perdu effacé.",
  accountHeading: "Compte",
  soundLabel: "Son",
  soundOn: "Musique activée.",
  soundOff: "Désactivée sur cet appareil.",
  volumeLabel: "Volume de la musique",
  volumeValue: "{{volume}} %",
  trackLabel: "Piste {{index}} / {{total}}",
  trackPrev: "Piste précédente",
  trackNext: "Piste suivante",
  trackClock: "{{position}} / {{duration}}",
  /**

  * RÉSOLUTION. Trois niveaux, chacun en un mot — les trois doivent tenir côte à côte
  * dans 350 pixels. La phrase dessous décrit le niveau sélectionné : le nom ne dit pas
  * ce qu’il apporte, c’est le texte explicatif qui s’en charge.
    */
  qualityLabel: "Qualité d’image",
  quality: {
    high: "Élevée",
    balanced: "Équilibrée",
    low: "Faible",
  },
  qualityHint: {
    high: "Résolution complète. Image la plus nette, consommation la plus élevée.",
    balanced:
      "Résolution réduite aux trois quarts. Différence visuelle minime, chauffe nettement réduite.",
    low: "Demi-résolution, anticrénelage désactivé. Pour les appareils plus anciens.",
  },
  fpsLabel: "Images/s",
  fpsOn: "Activé",
  fpsOff: "Désactivé",
  fpsHint: "Images que la galaxie dessine chaque seconde. 24–30 à l'arrêt est normal ; cela monte en mouvement et en combat.",
} as const;
export const leaderboard = {
  eyebrow: "Galaxie locale",
  title: "Classement",
  empty: "Aucun commandant n’a encore rejoint cette galaxie.",
  rank: "{{rank}}e place",
  tier: "palier {{tier}}",
  score: "Domination",
  you: "Toi",
  nearby: "Tes rivaux les plus proches",
  searchLabel: "Rechercher un commandant, une planète ou un clan",
  searchPlaceholder: "Commandant, planète ou clan",
  noMatch: "Aucun commandant, planète ou clan ne correspond à cette recherche.",
  locationUnknown: "Tu n’as pas encore découvert la position de ce commandant.",
  /*
    RÉCOMPENSE DE SAISON — réponse à la question « pourquoi est-ce que je joue ? ».
    Elle se trouve juste au-dessus du classement, car c’est là que la décision se prend.
    */
  rewards: {
    title: "Récompense de fin de saison",
    left: "se termine dans {{duration}}",
    explain:
      "Les {{places}} premières places peuvent gagner des ressources pour la prochaine galaxie. Les bots gardent leur place sans prix ; il faut au moins {{minimum}} de Domination.",
    table: "Récompenses selon le classement",
    tableCount: "Top {{places}} · ouvrir pour voir",
    place: "{{place}}e place",
    holding: "{{place}}e place · récompense actuelle",
    paidWhen: "Versée dès que tu établis ton monde dans la nouvelle saison.",
    standing: "Tu es {{place}}e",
    behind:
      "Il te manque {{score}} de Domination pour entrer dans le top {{places}}.",
    minimum: "Encore {{score}} de Domination pour être admissible au prix.",
    botIneligible: "Les bots gardent leur rang mais ne reçoivent pas de récompense de saison.",
    climb: "Entre dans le top {{places}} pour obtenir la récompense.",
    unranked: "Rejoins cette galaxie pour entrer dans le classement.",
  },
  archive: {
    selectorLabel: "Archives de saison",
    archiveIndex: "Tes archives de saison",
    waitingArchive: "Chargement des archives de saison",
    live: "Saison en cours",
    seasonChoice: "Saison {{ordinal}} · {{galaxy}}",
    seasonNumber: "Saison {{ordinal}}",
    seasonHeading: "Saison {{ordinal}} · {{galaxy}}",
    /* Un rang seul n’est pas parlant ; il n’a de sens qu’avec la taille du groupe. */
    percentile: "Top %{{share}} · {{rank}}e sur {{commanders}} commandants.",
    fieldSize: "{{count}} commandants",
    medals: "Trophées",
    signature: "Ton vaisseau emblématique",
    leadWorks: "Produit par tes stocks",
    leadProduced: "Production totale de tes stocks",
    leadRuns: "sur {{count}} expéditions d’astéroïdes",
    signatureCount: "{{count}} construits",
    multiple: "×{{value}}",
    share: "{{value}} %",
    loadingOlder: "Chargement des anciennes saisons",
    completedBoard: "Classement final de la saison",
    waitingBoard: "Ouverture du classement final",
    emptyBoard:
      "Aucun résultat de commandant n’est enregistré pour cette galaxie.",
    searchLabel: "Rechercher un commandant dans cette saison terminée",
    searchPlaceholder: "Commandant",
    noMatch: "Aucun commandant ne correspond à cette recherche.",
    galaxyRecord: {
      title: "Archives de la galaxie", subtitle: "Les faits communs laissés par cette saison",
      champion: "Champion", clans: "Podium des clans",
      biggestBattle: "Plus grande bataille confirmée", dominionSwing: "Variation de Domination la plus forte",
      contestedWorld: "Monde le plus disputé",
      battleLine: "{{attacker}} → {{defender}} sur {{planet}} · {{value}} perdus",
      swingLine: "{{attacker}} → {{defender}} · {{amount}} Domination",
      worldLine: "{{planet}} · {{count}} faits de conflit",
    },
    openCommander: "Ouvrir le bilan de saison de {{commander}}",
    openSeasonRecord: "Ouvrir le bilan Saison {{ordinal}} · {{galaxy}}",
    commanderCard: "bilan de saison du commandant",
    waitingProfile: "Ouverture du bilan du commandant",
    back: "Retour au classement de la saison",
    profileViews: "Vues du bilan du commandant",
    seasonTab: "Saison {{ordinal}}",
    overall: "Global",
    cohort_one: "Autres = moyenne des {{count}} commandants de cette saison",
    cohort_other: "Autres = moyenne des {{count}} commandants de cette saison",
    /** Version courte utilisée dans la ventilation à trois colonnes ; la phrase longue apparaît une fois au-dessus. */
    averageShort: "Autres : {{value}}",
    statsUnavailable:
      "Aucune donnée détaillée n’a été enregistrée pour cette saison.",
    statsUnavailableHint:
      "Ton classement et ton titre sont conservés. Les données qui n’étaient pas mesurées à l’époque ne sont pas affichées comme des zéros.",
    legacyStats: {
      title: "Archive de saison conservée",
      hint: "Les données de combat enregistrées sont affichées. Les données économiques, de production de flotte et d’exploration qui n’étaient pas mesurées à l’époque ne sont pas affichées.",
    },
    partialStats: {
      title: "Télémétrie partielle",
      hint: "Certaines actions antérieures au début de la télémétrie peuvent manquer ; les valeurs enregistrées sont conservées telles quelles.",
    },
    forcedEnd: {
      title: "Saison terminée prématurément",
      hint: "La période jouée a été enregistrée définitivement avec son classement final et ses récompenses.",
    },
    none: "Aucun",
    ratios: {
      trade: "Échange de dégâts",
      haul: "Butin par raid",
      kept: "Flotte conservée",
      convoy: "Réussite des convois",
      hourly: "Production horaire",
      perRun: "Astéroïdes par expédition",
    },
    sections: {
      form: "Performance et efficacité",
      competition: "Compétition et combat",
      economy: "Économie et production",
      exploration: "Exploration et opportunités",
    },
    metrics: {
      finalRank: "Classement final",
      battles: "Combats",
      shipsBuilt: "Vaisseaux construits",
      shipsLost: "Vaisseaux perdus",
      shipsBuiltByHull: "Vaisseaux construits par coque",
      shipsLostByHull: "Vaisseaux perdus par coque",
      playerLoot: "Butin pris aux commandants",
      productiveTime: "Temps de production sur tous les mondes",
      produced: "Ressources produites par les stocks",
      asteroidRuns: "Expéditions d’astéroïdes",
      asteroidMined: "Ressources extraites des astéroïdes",
      convoyAttempts: "Tentatives de convoi",
      convoySuccesses: "Convois réussis",
      convoyDelivered: "Récompenses de convoi livrées",
    },
    resources: {
      alloy: "Alliage",
      crystal: "Cristal",
      deuterium: "Deutérium",
    },
    career: {
      completed: "Saisons terminées",
      bestRank: "Meilleur classement",
      championships: "Titres",
      podiums: "Podiums",
      topTen: "Top 10",
      noTelemetry:
        "Aucune saison terminée avec des données détaillées pour le moment.",
      recordedCombatTotals: "Totaux de combat enregistrés",
      recordedTotals: "Totaux de carrière enregistrés",
      covered_one: "{{count}} saison couverte",
      covered_other: "{{count}} saisons couvertes",
      coveredWithPartial:
        "{{count}} saisons couvertes · télémétrie partielle sur {{partial}} saisons",
      seasons: "Saison par saison",
    },
  },
} as const;
export const chat = {
  eyebrow: "Canaux en direct",
  title: "Chat",
  launcher: "Ouvrir le chat de la galaxie",
  launcherUnread: "Ouvrir le chat de la galaxie — {{count}} non lus",
  launcherClanUnread: "Ouvrir le chat — {{count}} non lus dans le clan",
  launcherBothUnread:
    "Ouvrir le chat — Général : {{general}}, Clan : {{clan}} non lus",
  channelsLabel: "Canaux de discussion",
  languageLabel: 'Langue du chat',
  general: "Général",
  clan: "Clan",
  channelUnread: "{{channel}} — {{count}} non lus",
  clanLocked: "Le chat du clan est réservé à ton équipe.",
  clanLockedHint: "Rejoins ou crée un clan ; ce canal s’ouvrira immédiatement.",
  list: "Messages de la galaxie",
  empty: "Personne n’a encore parlé. Sois la première voix de la galaxie.",
  older: "Charger les anciens messages",
  loadingOlder: "Chargement des anciens messages",
  placeholder: "Écrire un message à la galaxie",
  send: "Envoyer",
  remaining: "{{count}} caractères restants",
  time: {
    justNow: "à l’instant",
    minutes_one: "il y a {{count}} minute",
    minutes_other: "il y a {{count}} minutes",
    hours: "il y a {{hours}} h {{minutes}} min",
    days_one: "il y a {{count}} jour",
    days_other: "il y a {{count}} jours",
  },
} as const;
export const crash = {
  title: "Quelque chose s’est cassé",
  body: "L’interface a cessé de s’afficher. Recharge la page pour revenir à la galaxie — rien n’a été perdu.",
  reload: "Recharger",
  detailShow: "Afficher les détails",
  detailHide: "Masquer les détails",
  copy: "Copier le rapport",
  copied: "Copié — envoie-le-nous",
  copyFailed: "Impossible de copier. Fais une capture d’écran des détails.",
} as const;
