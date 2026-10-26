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
  shortfall: 'manque {{short}}',
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
  /** Combat v3 force ruler (owner 2026-10-25): each side’s power, their ratio, and the rule one tap deep. */
  compareHeading: "Puissance relative",
  compareLabel: "Ta puissance {{yours}} ; leur puissance {{theirs}}",
  comparePick: "Choisis des vaisseaux pour les comparer à cette cible.",
  compareMeaning: "Puissance de feu et résistance l’une contre l’autre, avantages de classe compris. Le camp le plus fort garde une plus grande part de sa flotte.",
  compareRule: "La puissance compte les vaisseaux armés et les canons au sol actifs : leurs recherches, leurs dégâts et le cycle des classes face à l’autre camp, plus la charge de l’Aegis. Les vaisseaux sans armes n’ajoutent rien. Une sonde lit des fourchettes : chaque camp est donc une fourchette, et le bas du rapport est ton pire cas. Les lectures vieillissent, et chaque combat tire ses coups au hasard.",
  ratioYou: "Tu es {{band}}× plus fort",
  ratioThem: "Ils sont {{band}}× plus forts",
  ratioOpen: "La lecture ne dit pas qui est le plus fort : eux jusqu’à {{them}}×, toi jusqu’à {{you}}×",
  ratioEven: "À peu près égaux",
  ratioNoFire: "Rien ne riposte là-bas",
  ratioUnarmed: "Ton escadre n’a rien qui tire",
  axisTheirs: "Eux plus forts",
  axisEven: "Égal",
  axisYours: "Toi plus fort",
  outcomeHeading: "Ce que chaque camp garde, en moyenne",
  outcomeRatio: "Rapport",
  outcomeWeak: "Le faible garde",
  outcomeStrong: "Le fort perd",
  outcomeNote: "Moyennes sur de nombreux combats. Les vaisseaux repliés en vie comptent comme gardés. À 1:1, les grandes flottes gardent davantage.",
  escapeRun: "Sur toute la lecture, ta puissance atteint au moins {{ratio}}× la leur. Si ton escadre peut anéantir leur ligne et que leur réservoir paie le décollage, leurs vaisseaux décollent.",
  escapeStand: "Leurs vaisseaux restent et combattent : sur toute la lecture, ta puissance reste sous {{ratio}}× la leur.",
  escapeRule: "Leurs vaisseaux décollent avant le combat si ta puissance atteint au moins {{ratio}}× celle de leur ligne, canons au sol actifs compris. Ton escadre doit aussi pouvoir anéantir cette ligne. Leur planète doit payer un aller-retour de {{distance}} unités. Les canons au sol restent, et les ressources peuvent toujours être pillées.",
  compareYours: "Envoyé",
  compareTheirs: "Présent sur place",
  compareRecord: "{{source}}, {{age}}",
  compareLive: "{{source}}, lecture en cours",
  compareUnknown: "Jamais mesuré",
  compareUnknownWhy: "Une sonde permettrait d’obtenir une valeur pour ce camp.",
  escapeUnsure: 'Leurs vaisseaux pourraient décoller ; la lecture ne précise pas toutes les conditions de retraite.',
  escapeMinimumRule: 'Le défenseur doit aussi avoir au moins {{count}} vaisseaux de combat sur place. Une sonde ne révèle pas leur nombre.',
  compareRuleToggle: "Qu’est-ce que c’est ?",
  lineJoin: " · ",
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
