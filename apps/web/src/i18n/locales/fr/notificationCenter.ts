export const notificationCenter = {
  "title": "Centre d'alertes",
  "eyebrow": "Alertes sur téléphone",
  "menuHint": "Une alerte sur ton téléphone avant qu'une attaque n'arrive.",
  "menuEmpty": "Caisse vide",
  "menuEmptyHint": "Aucune alerte d'attaque ne part : ajoute du deutérium.",
  "pushChannel": "Alertes d'attaque",
  "pushOffTitle": "Les alertes d'attaque n'atteignent pas ce téléphone",
  "pushOff": "Ce téléphone n'autorise pas les notifications. D'ici là, aucune alerte ne part et aucun deutérium ne quitte la caisse.",
  "pushAllow": "Autoriser les notifications",
  "pushDenied": "Android ne redemandera pas. Autorise les notifications pour Astera Online dans les réglages du téléphone.",
  "menuCovers_one": "Paie {{count}} alerte d'attaque",
  "menuCovers_other": "Paie {{count}} alertes d'attaque",
  "lead": "Quand ton radar voit une attaque arriver, le centre envoie une alerte sur ton téléphone, même jeu fermé. Chaque alerte prend du deutérium dans la caisse du centre.",
  "loading": "Chargement du Centre d'alertes…",
  "loadError": "Le Centre d'alertes n'a pas pu être chargé.",
  "retry": "Réessayer",
  "from": "dès",
  "kind": {
    "incoming_attack": "Attaque en approche",
    "incoming_strategic": "Arme stratégique",
    "probe_detected": "Sonde détectée"
  },
  "kindRule": {
    "incoming_attack": "Une flotte ou une flotte de clan commune en route vers l'un de tes mondes.",
    "incoming_strategic": "Une Étoile de la mort en approche. Prend 1,5 fois le deutérium d'une alerte d'attaque.",
    "probe_detected": "Une sonde repérée au-dessus de l'un de tes mondes. Envoyée tout de suite."
  },
  "buildCost": "Coût de construction",
  "buildFrom": "Payé par {{world}}, ton monde sélectionné. Construit une fois, il couvre tous tes mondes.",
  "buildShort": "Le monde sélectionné n'a pas assez de ressources. Choisis un autre monde ou attends.",
  "build": "Construire le centre",
  "wallet": "Caisse",
  "covers_one": "Paie {{count}} alerte d'attaque à « {{timing}} »",
  "covers_other": "Paie {{count}} alertes d'attaque à « {{timing}} »",
  "walletRule": "Une seule caisse paie toutes les alertes, chacune à son envoi. Changer le moment change le prix d'une alerte, pas la caisse.",
  "empty": "La caisse ne peut pas payer la prochaine alerte d'attaque. Elle ne sera pas envoyée tant que tu n'ajoutes pas de deutérium.",
  "unfunded_one": "{{count}} alerte n'a pas été envoyée ces dernières 24 heures : la caisse était insuffisante.",
  "unfunded_other": "{{count}} alertes n'ont pas été envoyées ces dernières 24 heures : la caisse était insuffisante.",
  "transferTitle": "Ajouter du deutérium",
  "transferFrom": "Depuis {{world}}. En stock :",
  "amount": "Deutérium à transférer",
  "transferPreview_one": "Caisse après : {{wallet}} · paie {{count}} alerte d'attaque à ce moment choisi",
  "transferPreview_other": "Caisse après : {{wallet}} · paie {{count}} alertes d'attaque à ce moment choisi",
  "transfer": "Transférer",
  "all": "Tout",
  "confirmTitle": "Transférer {{amount}} deutérium ?",
  "confirmBody": "Le deutérium de la caisse ne peut pas revenir sur un monde. Il ne sert qu'aux alertes.",
  "confirm": "Transférer {{amount}}",
  "back": "Retour",
  "walletAfter": "Caisse ensuite",
  "timingTitle": "Quand une alerte d'attaque doit-elle t'arriver ?",
  "timing": {
    "T3": "3 min",
    "T5": "5 min",
    "T15": "15 min",
    "RADAR": "Au radar"
  },
  "timingRule": "Plus l'alerte est tôt, plus chacune prend de deutérium. Si ton radar voit la flotte plus tard, l'alerte arrive à ce moment-là.",
  "timingOption": {
    "T3": "3 minutes avant l'arrivée",
    "T5": "5 minutes avant l'arrivée",
    "T15": "15 minutes avant l'arrivée",
    "RADAR": "Dès que le radar la voit"
  },
  "perAlert": "par alerte",
  "kindsTitle": "Alertes radar",
  "recentTitle": "Alertes récentes",
  "status": {
    "PENDING": "En attente",
    "SENT": "Envoyée",
    "UNFUNDED": "Caisse vide",
    "CANCELLED": "Rien prélevé",
    "NO_DEVICE": "Pas de téléphone"
  },
  "rulesTitle": "Fonctionnement des alertes",
  "ruleRadar": "Une alerte part seulement pour une flotte que ton radar voit. Sans détection radar, pas d'alerte.",
  "ruleRecall": "Si l'attaque est rappelée avant l'envoi de l'alerte, aucun deutérium ne quitte la caisse.",
  "ruleShort": "Si la caisse ne peut pas payer, l'alerte n'est pas envoyée. Elle apparaît ici comme « Caisse vide ».",
  "ruleInGame": "L'avertissement dans le jeu s'affiche toujours et ne prend aucun deutérium.",
  "priceRule": "Une alerte d'attaque prend quelques heures de ta production de deutérium sur tous tes mondes, ou son minimum s'il est plus élevé. Ta production : {{rate}} par heure.",
  "reading": {
    "NONE": "Non construit",
    "EMPTY": "Caisse vide",
    "FEW": "Quelques alertes",
    "PLENTY": "Bien garni",
    "UNKNOWN": "Non lu"
  },
  "readingMeaning": {
    "NONE": "Aucune alerte sur téléphone avant une attaque.",
    "EMPTY": "Construit, mais l'alerte sur téléphone ne partirait pas : la caisse ne peut pas payer.",
    "FEW": "Paie quelques alertes. Le téléphone peut prévenir.",
    "PLENTY": "Paie de nombreuses alertes. Attends-toi à ce que le téléphone prévienne.",
    "UNKNOWN": "La sonde n'a pas pu lire le Centre d'alertes."
  },
  "readingRule": "Les lectures de sonde peuvent être fausses. Une sonde plus précise se trompe moins souvent.",
  "local": {
    "title": {
      "build": "Construction terminée",
      "research": "Recherche terminée",
      "ships": "Vaisseaux prêts",
      "fleet": "Flotte rentrée"
    },
    "body": {
      "build": "{{name}} sur {{world}} est prêt.",
      "research": "{{name}} est terminée.",
      "ships": "{{count}} × {{name}} prêts sur {{world}}.",
      "fleet": "Une flotte est rentrée sur son monde d'origine.",
      "unnamed": "Une commande sur {{world}} est terminée."
    },
    "section": "Rappels de commandes sur ce téléphone",
    "sectionBody": "Ce téléphone te prévient quand une commande se termine. Ne prend aucun deutérium dans la caisse, et se règle sur ce téléphone seulement.",
    "switch": "Me prévenir quand une commande se termine",
    "denied": "Le téléphone n'a pas autorisé les notifications. Autorise-les pour Astera Online dans les réglages du téléphone.",
    "blocked": "Les alertes d'Astera Online sont désactivées dans les réglages du téléphone. Elles restent en pause jusqu'à ce que tu les réactives.",
    "lateTitle": "Les alertes peuvent arriver en retard",
    "late": "Sans cette autorisation, Android peut retarder une alerte jusqu'à une heure. Autorise-la pour savoir dès qu'une commande se termine.",
    "allowExact": "Autoriser les alertes à l'heure",
    "category": {
      "build": "Construction",
      "research": "Recherche",
      "ships": "Vaisseaux",
      "fleet": "Flottes de retour"
    }
  },
  "hours_one": "{{count}} heure",
  "hours_other": "{{count}} heures",
  "floor": "min {{amount}}"
};
