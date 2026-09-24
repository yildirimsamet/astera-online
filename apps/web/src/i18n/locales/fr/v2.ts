/** Composants Gözlemevi v2 — les textes des nouveaux composants (docs/ui-v2/gozlemevi.md). */

/** B9 : maintenir pour envoyer. */
export const hold = {
  hint: 'Maintenez appuyé, ou appuyez deux fois sur Entrée pour confirmer',
  confirm: '{{label}} · sûr ?',
  /** Shown on the face after a release that came too soon. */
  release: 'Maintenir pour confirmer',
  verb: 'Maintenir',
};

/** B12 : une file de production en anneaux. */
export const lane = {
  /** Une place vide dans la file. */
  free: '+ Place libre',
};

/** B1 : une jauge de ressource dans la barre du haut. */
export const meter = {
  /** Read by a screen reader: the stock against the store. */
  reading: '{{resource}} : {{value}} sur {{cap}}',
  /** The same, when the store is full. */
  full: '{{resource}} : {{value}} sur {{cap}}, entrepôt plein',
};

/** B5 : la règle des forces. */
export const ruler = {
  /** In place of the defence strip when nothing was ever measured. */
  unknown: 'Aucune sonde : leur défense est inconnue',
  /** The button that closes that gap. */
  probe: 'Envoyer une sonde',
};

/** La feuille v2 : sa poignée. */
export const handle = {
  /** Opens the sheet one height further. */
  expand: 'Agrandir',
  /** At the top: settles it one height lower. */
  collapse: 'Réduire',
};

/** B4 : le dock, cinq onglets dans un ordre fixe. */
export const dock = {
  /** The navigation landmark, for a screen reader. */
  label: 'Navigation principale',
  galaxy: 'Galaxie',
  base: 'Base',
  fleet: 'Flotte',
  intel: 'Renseignement',
  clan: 'Clan',
  /** The dot on Base, read aloud. */
  baseWaiting: 'Quelque chose à collecter ou à réparer',
  /** Beside the Fleet ring: your own craft in the air. */
  airborne: 'En vol : {{count}}',
  /** The count on Intel: reports you have not seen. */
  reports: 'Nouveaux rapports : {{count}}',
  /** The count on Clan. */
  attention: 'En attente de toi : {{count}}',
};

/** B2 : la ligne Maintenant, le minuteur qui compte le plus. */
export const now = {
  /** The line, for a screen reader. */
  label: 'Minuteur le plus urgent',
  /** The sheet one tap under it: every timer. */
  sheet: 'Minuteurs',
  work: 'Travaux bientôt finis',
  research: 'Recherche bientôt finie',
  event: 'Événement bientôt fini',
  shield: 'Ton bouclier tombe',
  shieldDetail: 'Ensuite, les raids peuvent t’atteindre',
  /** The clock time beside a countdown in the sheet. */
  at: 'à {{time}}',
};

/** K1 : la feuille de la cloche, trois onglets. */
export const bell = {
  /** The sheet's name: all three tabs answer it. */
  title: 'Ce qui s’est passé',
  /** The tab list, for a screen reader. */
  label: 'Signaux, chronique et discussion',
  signals: 'Signaux',
  chronicle: 'Chronique',
  chat: 'Discussion',
  /** The dot on Chat, read aloud. */
  chatUnread: '{{count}} non lus',
};

/** B1 : la barre du haut. */
export const topBar = {
  /** The shield's time on the commander chip: whole hours, rounded down. */
  hours: '{{h}}h',
};

/** La puce Vue : calques, guide des événements et légende de la galaxie. */
export const view = {
  chip: 'Vue',
  title: 'Vue',
  layers: 'Calques',
  telescope: 'Portée du télescope',
  telescopeDetail: 'Où tes mondes voient l’état des flottes',
  radar: 'Portée du radar',
  radarDetail: 'Où ton radar signale les flottes entrantes',
  events: 'Guide des événements galactiques',
  /** The round button under the View chip: the disc's old Home mark. */
  home: 'Aller à ton monde',
};

/** B3 : l’emplacement de contexte, une carte à la fois. */
export const slot = {
  incoming: 'Attaque en approche',
  prepare: 'Préparer la défense',
  look: 'Regarder',
  event: 'Événement galactique',
  show: 'Montrer',
  lands: 'arrive dans {{time}}',
  ends: 'finit dans {{time}}',
  pill: 'Attaques en approche : {{count}}',
  dismiss: 'Fermer',
};

/** E4: the Fleet page — in flight, at home, the Hangar. */
export const fleetPage = {
  views: "Vues de la flotte",
  air: "En vol",
  home: "À quai",
  bays: "Baies de vol",
  hangar: "Hangar",
  pace: "vitesse {{pct}} %",
  recall: "Rappeler",
  recallHome: "Rappelée, de retour dans {{time}}",
  recalling: "Demi-tour…",
  emptyAir: "Rien en vol. Touche un monde, un astéroïde ou un pirate dans la galaxie pour envoyer des vaisseaux.",
  shipsHome_one: "{{count}} vaisseau à quai",
  shipsHome_other: "{{count}} vaisseaux à quai",
  away: "{{count}} en route",
  noShips: "Aucun vaisseau à quai",
  capital: "Capitale",
  colony: "Colonie",
  roomRule: "Place pour chaque vaisseau d'un monde — à quai, en route et au chantier. Un Hangar plein arrête le chantier et les transferts entrants ; une flotte rappelée trouve toujours sa place.",
  ground: "Défense au sol",
  ceiling: "jusqu'à {{shown}} avec ce Noyau",
  full: "Plein",
};

/** The battle report scene (B15), the mock's "KISMİ ZAFER" page. */
export const reportScene = {
  eyebrow: "Rapport de combat · {{planet}}",
  rounds_one: "{{count}} tour",
  rounds_other: "{{count}} tours",
  you: "Toi",
  destroyed: "{{count}} détruits",
  hidden: "Ce qui leur reste et le reste du terrain restent cachés ; un rapport ne dit que ce que tu as détruit.",
  whyHeading: "Pourquoi ?",
  why: "La plupart de tes pertes étaient des {{lost}} : {{by}} est fort contre eux, et {{bring}} est fort contre {{by}}.",
  balance: "Bilan",
  balanceLoot: "butin {{amount}}",
  balanceFuel: "carburant −{{amount}}",
  balanceLost: "pertes {{list}}",
  balanceNone: "aucune perte",
  cargoFull: "soute pleine",
  colonyRule: "Loyauté d’une colonie : une victoire décisive retire {{decisive}}, une partielle {{partial}}.",
  again: "Attaquer à nouveau",
} as const;

/** K6: the switch at the top of the Base — this world, or the commander's research. */
export const baseSwitch = {
  label: 'Base',
  world: 'Ce monde',
  research: 'Recherche',
} as const;
