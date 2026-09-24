/**

* VAISSEAU MARCHAND — sa trajectoire, son badge dans le coin et la page du convoi. D156.
*
* Il possède son propre fichier ; ce n’est pas un bloc ajouté à la fin de `world.ts`.
* C’est la règle du répertoire : chaque surface possède son propre espace de noms.
* Le Marchand est une surface à part entière — une trajectoire sur le disque, un badge
* dans le coin et une page unique où l’échange est confirmé.
*
* Aucune ligne ici n’est partagée avec `transfer` ; même lorsqu’elles expriment parfois
* la même chose, ce sont deux contrôles distincts. Réécrire l’un ne doit pas faire
* dériver l’autre avec lui (D55).
  */
export const trade = {
  /* ── badge dans le coin ─────────────────────────────────────── */
  chip: "Vaisseau marchand",
  chipRemaining: "{{remaining}} restantes",
  /* ── trajectoire ciblée ─────────────────────────────────────── */
  eyebrow: "Fenêtre de commerce",
  title: "Vaisseau marchand",
  summaryReach: "atteignable dans {{duration}}",
  rateHeading: "Valeur équivalente",
  rateReading: "{{amount}} {{resource}} pour 1 Deutérium",
  leavesIn: "Départ dans",
  reachLabel: "Arrivée la plus rapide",
  reachNoCraft: "Aucun vaisseau",
  reachNoCarrier: "Aucun vaisseau cargo",
  reachCarriersAway: "Tes vaisseaux cargo sont en vol",
  reachNone: "Hors de portée",
  boundary:
    "Tous les commandants de la galaxie voient ce vaisseau, son orbite et son taux d’échange. Aucun quota, aucune commission.",
  open: "Envoyer un convoi",
  noCraft: "Aucun vaisseau disponible sur ce monde",
  noCarrier: "Un Cargo, un Voyageur, un Atlas ou un Argosi est requis",
  carriersAway: "Tes vaisseaux cargo sont en vol",
  tooLate: "Aucun vaisseau présent ici ne peut arriver à temps",
  /* ── page du convoi ─────────────────────────────────────────── */
  sheetEyebrow: "Fenêtre de commerce · {{duration}} restantes",
  sheetTitle: "Vaisseau marchand",
  alloy: "Alliage",
  crystal: "Cristal",
  deuterium: "Deutérium",
  convoyHeading: "Convoi",
  offerHeading: "Je donne",
  askHeading: "Je reçois",
  askUnits: "{{units}} unités",
  carrierRoom: "{{count}} chez toi · {{volume}} de volume chacun",
  holdReading: "Volume de cargaison du convoi : {{volume}}",
  ceilingStore:
    "Maximum {{amount}} — c’est ce que contient ton Dépôt · vaut exactement {{worth}} {{good}}",
  ceilingHold:
    "Maximum {{amount}} — vaut exactement {{worth}} {{good}}. Ajoute des vaisseaux au convoi pour augmenter cette limite.",
  splitLabel: "Ce que tu recevras",
  splitToward: "davantage de {{resource}}",
  legOut: "Aller",
  legHome: "Retour",
  legHold: "Convoi",
  legReturnDecides:
    "Ce que tu reçois prend plus de place que ce que tu donnes. Au retour, le convoi ne pourra transporter que cette quantité — c’est ce qui fixe la limite ci-dessus. Ajoute des vaisseaux au convoi pour pouvoir donner davantage.",
  givePick: "Ce que tu donnes",
  giveAmount: "{{resource}} à donner",
  giveSpend: "Retiré du Dépôt",
  holdNoCarrier:
    "Seuls les Cargos, Voyageurs, Atlas et Argosi apportent de la capacité de transport — sélectionne-en un.",
  hullNone: "Aucun sur ce monde",
  bays: "Baies de vol",
  baysReading: "{{used}} baies occupées sur {{total}}",
  homeDefence:
    "{{ships}} vaisseaux resteront ici · {{power}} de puissance de feu",
  fuel: "carburant aller-retour",
  figureOut: "Aller",
  figureAway: "En vol",
  figureDistance: "Distance",
  figureNone: "aucune route",
  fewer: "Réduire {{name}}",
  more: "Ajouter {{name}}",
  quantity: "Nombre de {{name}}",
  max: "Envoyer tous les {{name}}",
  maxShort: "Tous",
  /* ── confirmation ───────────────────────────────────────────── */
  send: "Envoyer le convoi",
  sending: "Départ en cours",
  warning:
    "Un convoi lancé ne peut pas être rappelé. Il restera en vol pendant {{duration}}.",
  fleetsave:
    "Il ne peut pas être attaqué pendant son trajet, mais il ne peut pas non plus défendre ce monde.",
  launched: "Convoi lancé · {{duration}}",
  /* ── une raison pour chaque refus du serveur ───────────────── */
  chooseFleet: "Choisis un convoi",
  windowClosed: "Le Marchand est parti",
  noBay: "Aucune baie de vol libre",
  needsCarrier: "Ajoute un Cargo, un Voyageur, un Atlas ou un Argosi",
  noOffer: "Choisis ce que tu veux donner",
  noAsk: "Choisis ce que tu veux recevoir",
  cannotPay: "Ton offre ne suffit pas pour cet échange",
  selfSwap: "Le Marchand n’échange pas une ressource contre elle-même",
  badAmount: "Unités entières uniquement",
  overHold: "Le convoi n’a pas assez de capacité de cargaison",
  noStock: "Ton Dépôt n’en contient pas assez",
  cannotReach: "Le Marchand sera parti avant l’arrivée du convoi",
  noFuel: "Pas assez de Deutérium pour le vol",
} as const;
