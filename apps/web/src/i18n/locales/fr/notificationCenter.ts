export const notificationCenter = {
  "title": "Centre d'alertes",
  "eyebrow": "Alertes sur téléphone",
  "menuHint": "Une alerte sur ton téléphone avant qu'une attaque n'arrive.",
  "menuEmpty": "Caisse vide",
  "lead": "Quand ton radar voit une attaque arriver, le centre envoie une alerte sur ton téléphone, même jeu fermé. Chaque alerte est payée par la caisse de deutérium du centre.",
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
    "incoming_strategic": "Une Étoile de la mort en approche. Coûte 1,5 fois une alerte d'attaque.",
    "probe_detected": "Une sonde repérée au-dessus de l'un de tes mondes. Envoyée tout de suite."
  },
  "buildCost": "Coût de construction",
  "buildFrom": "Payé par {{world}}, ton monde sélectionné. Construit une fois, il couvre tous tes mondes.",
  "buildShort": "Le monde sélectionné n'a pas assez de ressources. Choisis un autre monde ou attends.",
  "build": "Construire le centre",
  "wallet": "Caisse",
  "covers_one": "Paie {{count}} alerte d'attaque à ce moment choisi",
  "covers_other": "Paie {{count}} alertes d'attaque à ce moment choisi",
  "empty": "La caisse ne peut pas payer la prochaine alerte d'attaque. Elle ne sera pas envoyée tant que tu n'ajoutes pas de deutérium.",
  "unfunded_one": "{{count}} alerte n'a pas été envoyée ces dernières 24 heures : la caisse était insuffisante.",
  "unfunded_other": "{{count}} alertes n'ont pas été envoyées ces dernières 24 heures : la caisse était insuffisante.",
  "transferTitle": "Ajouter du deutérium",
  "transferFrom": "Depuis {{world}}. En stock :",
  "amount": "Deutérium à transférer",
  "transfer": "Transférer",
  "alerts_one": "{{count}} alerte",
  "alerts_other": "{{count}} alertes",
  "all": "Tout",
  "confirmTitle": "Transférer {{amount}} deutérium ?",
  "confirmBody": "Le deutérium de la caisse ne peut pas revenir sur un monde. Il ne sert qu'aux alertes.",
  "confirm": "Transférer {{amount}}",
  "back": "Retour",
  "walletAfter": "Caisse ensuite",
  "timingTitle": "Quand alerter",
  "timing": {
    "T3": "3 min",
    "T5": "5 min",
    "T15": "15 min",
    "RADAR": "Au radar"
  },
  "timingRule": "Minutes avant l'arrivée de l'attaque. Une alerte plus tôt coûte plus cher. Si ton radar voit la flotte plus tard, l'alerte part à ce moment-là.",
  "kindsTitle": "Alertes payantes",
  "recentTitle": "Alertes récentes",
  "status": {
    "PENDING": "En attente",
    "SENT": "Envoyée",
    "UNFUNDED": "Caisse vide",
    "CANCELLED": "Non facturée",
    "NO_DEVICE": "Pas de téléphone"
  },
  "rulesTitle": "Fonctionnement des alertes",
  "ruleRadar": "Une alerte part seulement pour une flotte que ton radar voit. Sans détection radar, pas d'alerte.",
  "ruleRecall": "Si l'attaque est rappelée avant l'envoi de l'alerte, rien n'est facturé.",
  "ruleShort": "Si la caisse ne peut pas payer, l'alerte n'est pas envoyée. Elle apparaît ici comme « Caisse vide ».",
  "ruleInGame": "L'avertissement dans le jeu reste gratuit.",
  "priceRule": "Une alerte d'attaque coûte quelques heures de ta production de deutérium sur tous tes mondes, ou son minimum s'il est plus élevé. Ta production : {{rate}} par heure.",
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
    "section": "Alertes gratuites sur ce téléphone",
    "sectionBody": "Ce téléphone te prévient quand une commande se termine. Gratuit, et réglé sur ce téléphone seulement.",
    "switch": "Me prévenir quand une commande se termine",
    "denied": "Le téléphone n'a pas autorisé les notifications. Autorise-les pour Astera Online dans les réglages du téléphone.",
    "blocked": "Les alertes d'Astera Online sont désactivées dans les réglages du téléphone. Elles restent en pause jusqu'à ce que tu les réactives.",
    "late": "Les alertes peuvent arriver avec quelques minutes de retard.",
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
