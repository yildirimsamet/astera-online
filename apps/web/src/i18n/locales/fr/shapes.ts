/**

* LE VOCABULAIRE PROPRE AU LANGAGE VISUEL. D142.
*
* Chaque ligne sert de légende à une forme qui fait déjà son travail, ou de phrase
* destinée au lecteur d’écran lorsqu’elle n’est pas visible. Aucune ne porte seule
* toute l’information : même sans lire un seul mot, le joueur voit si le carburant
* suffit au vol, à quel point la sonde est sûre de son estimation et dans quelle
* direction la flotte se déplace.
  */
/** Part retirée du stock : `SpendBar`. */
export const spend = {
  reading: "{{label}} : {{spend}} dépensés, {{left}} restants",
  readingSpend: "{{label}} — quantité : {{spend}}",
  readingShort: "{{label}} : il manque {{short}}",
} as const;
/** Lecture floue d’une sonde, dessinée telle quelle : `RangeBand`. */
export const rangeBand = {
  join: " – ",
  reading: "{{label}} : quelque part entre {{low}} et {{high}}",
} as const;
/** Direction de l’appareil et position sur son trajet : `FlightBar`. */
export const flightBar = {
  out: "En route, s’éloigne de ce monde",
  back: "Revient vers ce monde",
  incoming: "Se dirige vers nous — position inconnue",
} as const;
/** Vocabulaire propre au cycle des contres. D124. */
export const counter = {
  heading: "Affrontements",
  strongVs: "Fort contre la classe {{class}}",
  weakVs: "Faible contre la classe {{class}}",
  supportNote:
    "Sans armes. Protégé tant qu’au moins une unité de combat de son camp reste debout.",
  strong: "Fort",
  weak: "Faible",
  even: "Équilibré",
  none: "Aucune attaque",
  multiplier: "×{{mult}}",
  matchupLabel:
    "{{attacker}} contre {{defender}} : {{outcome}}, dégâts ×{{mult}}",
  cycleLabel:
    "L’Escarmoucheur bat le Rempart, le Rempart bat la Lance, la Lance bat l’Escarmoucheur",
  compareHeading: "Valeur des unités armées",
  compareYours: "Envoyé",
  compareTheirs: "Présent sur place",
  compareRecord: "{{source}}, {{age}}",
  compareLive: "{{source}}, lecture en cours",
  compareUnknown: "Jamais mesuré",
  compareUnknownWhy: "Une sonde permettrait d’obtenir une valeur pour ce camp.",
  compareLabel:
    "Tu envoies {{yours}} ; dernière estimation de leur monde : {{theirs}}",
  compareRuleToggle: "Qu’est-ce que c’est ?",
  compareMeaning:
    "Il s’agit du coût en ressources, pas des dégâts d’attaque. Une grande flotte ne garantit pas à elle seule la victoire.",
  compareRule:
    "Le coût en ressources des vaisseaux et canons capables de tirer des deux camps est comparé. Le bouclier et les vaisseaux sans armes ne sont pas inclus dans cette valeur. L’estimation tient également compte des classes de vaisseaux, des recherches et du bouclier connu. Si la valeur adverse se situe sous le seuil indiqué, le modèle attend ce niveau de réussite. Une victoire totale ne garantit pas la survie de tes vaisseaux : les deux camps peuvent être entièrement détruits. Les renseignements peuvent être anciens et l’effet aléatoire des tours n’est pas pris en compte.",
  linesClears: "Seuil de victoire totale : {{at}}",
  linesBreaks: "Seuil de réussite partielle : {{at}}",
  lineJoin: " · ",
  lossLabel:
    "Pertes estimées : {{share}} (selon la valeur en ressources de la flotte)",
  lossUncertainty:
    "Ce n’est pas une probabilité de victoire, mais une fourchette de pertes fondée sur les renseignements disponibles.",
  lossTotalRisk: "Risque élevé : aucun de tes vaisseaux ne pourrait revenir.",
  noteShieldUnmeasured: "Puissance du bouclier non mesurée",
  noteShapeUnread: "Composition de la défense illisible",
  noteUnarmedUnknown: "Vaisseaux cargo non comptés",
  noteUnarmed_one: "{{band}} vaisseau cargo en défense",
  noteUnarmed_other: "{{band}} vaisseaux cargo en défense",
  noteSeen: "Ta sonde a été détectée",
  noteSomeAway:
    "Une partie de leur flotte était absente lorsque la sonde est arrivée",
  noteTelescopeAway: "Télescope : leur flotte est actuellement absente",
  noteTelescopeHome: "Télescope : leur flotte est présente",
  noteLastRaid:
    "Lors du dernier raid, les pertes étaient principalement de classe {{class}}",
  mixMostly: "Principalement {{class}}",
  mixEven: "Aucune classe dominante",
  matchupMajority: 'Majorité {{class}} — plus de la moitié',
  matchupRemainder: 'le reste n\'a pas été lu et peut vous contrer',
  matchupUnread: "{{share}} % non lu",
  matchupMixed: 'Défense mixte — aucun contre unique',
  matchupSplit: 'Répartition lue',
  matchupBring: 'Prenez {{class}}',
  matchupSingle: 'Votre flotte est mono-classe — son contre peut être dans la partie non lue',
  matchupExposure: 'fort {{strong}} % · faible {{weak}} %',
  matchupProbe: 'une sonde deux niveaux de chantier au-dessus révèle la répartition',
} as const;
