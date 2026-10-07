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
  yours: "le tien {{value}}",
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
  /** Taktik geri çekilme dans la comparaison : le verdict et la règle un geste plus loin. */
  escapeRun: 'Leur ligne est sous un tiers de ton feu : si leur réservoir suffit, leurs vaisseaux décollent et seuls les canons combattent.',
  escapeStand: 'Leurs vaisseaux restent et combattent : la lecture dépasse un tiers de ton feu ou ce que cette aile balaie.',
  escapeUnsure: 'Leurs vaisseaux pourraient décoller ; la lecture ne précise pas toutes les conditions de retraite.',
  escapeAt: 'Seuil de retraite : {{at}}',
  escapeRule:
    'Retraite tactique : une ligne face à au moins trois fois sa propre puissance de feu, que ce raid anéantirait, fait décoller ses vaisseaux au lieu de combattre, si le réservoir du monde paie un aller-retour de {{distance}} unités. Les canons restent, et les stocks sont tout de même pillés.',
  escapeMinimumRule: 'Le défenseur doit aussi avoir au moins {{count}} vaisseaux de combat sur place. Une sonde ne révèle pas leur nombre.',
  compareRuleToggle: "Qu’est-ce que c’est ?",
  compareMeaning:
    "Il s’agit du coût en ressources, pas des dégâts d’attaque. Une grande flotte ne garantit pas à elle seule la victoire.",
  compareRule:
    "Le coût en ressources des vaisseaux et canons capables de tirer des deux camps est comparé. Le bouclier et les vaisseaux sans armes ne sont pas inclus dans cette valeur. L’estimation tient également compte des classes de vaisseaux, des recherches et du bouclier connu. Si leur défense ne dépasse pas une ligne, le modèle attend cette réussite : la défense brisée et au moins un de tes vaisseaux rentre. Une ligne est une plage parce que la lecture ne montre pas tout (répartition des classes, bouclier) : l’extrémité gauche est le pire cas, la droite le meilleur. Ce que cela coûte à l’escadre est la perte estimée ci-dessous. Les renseignements peuvent être anciens et l’effet aléatoire des tours n’est pas pris en compte.",
  linesClears: "Victoire totale si leur défense vaut au plus {{at}}",
  linesBreaks: "Au moins une réussite partielle si au plus {{at}}",
  lineJoin: " · ",
  lossLabel: "Ta perte estimée : {{share}} de l’escadre (selon la valeur en ressources)",
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
