/**

* ESSAI — quatre-vingt-dix secondes de jeu avant la création du compte.
*
* ÉCRIT POUR LE FRANÇAIS, PAS TRADUIT MOT À MOT DEPUIS L’ANGLAIS. Les mêmes règles
* que dans `entry.ts` s’appliquent ici : on écrit de vraies phrases, on privilégie
* les verbes, on évite les tirets inutiles et on choisit l’expression française
* qui produit le même effet plutôt qu’un simple équivalent lexical.
*
* Chaque ligne correspond à un temps de l’introduction, et chaque temps annonce
* ce que le joueur VA FAIRE juste après. Aucun texte n’explique longuement un
* système : il indique où regarder, puis s’efface, puisque la séquence n’avance
* que lorsque l’action a réellement été effectuée.
  */
export const country = {
  label: 'Pays',
  choose: 'Choisis ton pays',
  searchLabel: 'Rechercher des pays',
  searchPlaceholder: 'Rechercher un pays',
  list: 'Pays',
  confirm: 'Confirmer le pays',
  change: 'Modifier',
  saved: 'Pays mis à jour',
} as const;

export const onboarding = {
  beats: {
    wide: {
      title: "{{shard}}",
      line: "De vraies personnes jouent dans cette galaxie. Chaque planète est le foyer d’un joueur, et les vaisseaux que tu vois sont leurs véritables flottes.",
      action: "Montrer ma planète",
    },
    yours: {
      title: "Cette planète est à toi",
      line: "{{name}} est ta planète capitale protégée. Tu y produis des ressources, observes tes rivaux, construis tes défenses et fabriques tes vaisseaux. Appuie sur ta planète.",
    },
    briefing: {
      title: "La galaxie repose sur quatre actions essentielles",
      line: "Produis d’abord des ressources. Observe ensuite tes rivaux. Protège ta planète. Quand tu es prêt, envoie tes vaisseaux. Tes bâtiments, tes dispositifs et tes recherches améliorent ces quatre domaines.",
      action: "Faire le premier pas",
      mapGrow: "Produire",
      mapIntel: "Observer",
      mapDefend: "Protéger",
      mapReach: "Envoyer",
      mapOutcome: "Observer · décider · envoyer",
    },
    fog: {
      title: "D’abord les renseignements, ensuite le risque",
      line: "Appuie sur une autre planète. Tu peux voir son niveau, mais pas ses ressources, ses vaisseaux ni ses défenses. Renseigne-toi d’abord, puis décide si elle mérite une attaque.",
    },
    fogAlone: {
      title: "Il n’y a encore personne ici",
      line: "{{shard}} accueille encore des commandants. Rassemble des renseignements pour connaître leurs ressources et défenses.",
      action: "Compris",
    },
    core: {
      title: "Commence par relever la limite",
      line: "Le Noyau de commande limite le niveau des structures, sauf le Hangar. Ouvre sa ligne et vérifie l’effet et le prix du niveau 2. Ajoute ensuite l’amélioration à la file.",
    },
    refinery: {
      title: "Produis davantage d’alliage",
      line: "La Raffinerie produit de l’alliage chaque heure. C’est la ressource que tu utiliseras le plus pour construire des bâtiments et des vaisseaux. Appuie sur sa ligne et ajoute le niveau 2 à la file.",
    },
    extractor: {
      title: "Produis maintenant du cristal",
      line: "La Mine de Cristal produit du cristal chaque heure. Les vaisseaux puissants et les outils de renseignement en consomment. Appuie sur sa ligne et ajoute le niveau 2 à la file.",
    },
    fleet: {
      title: "Construis maintenant deux vaisseaux",
      line: "Dans l’onglet Flotte, appuie sur la ligne {{ship}}. Choisis « Maximum » et ajoute deux vaisseaux à la file. Tu utiliseras ces appareils rapides pour tester tes rivaux ou les attaquer.",
    },
  },
  skip: "Passer",
  haveAccount: "J’ai déjà un commandant",
  claim: {
    eyebrowName: "Dernière étape",
    headingName: "Choisis le nom de ton commandant",
    lineName:
      "Tes quatre commandes sont prêtes. Dès que {{name}} sera à toi, leurs véritables compteurs démarreront ensemble.",
    nameLabel: "Nom du commandant",
    next: "Continuer",
    eyebrowPassword: "Encore une étape",
    headingPassword: "Choisis un mot de passe pour {{name}}",
    linePassword:
      "Utilise ce mot de passe pour retrouver ton commandant sur un autre appareil.",
    passwordLabel: "Mot de passe",
    submit: "Revendiquer la planète",
    working: "Création du commandant…",
    back: "Retour",
  },
  trouble: {
    noFrontier:
      "Toutes les galaxies sont actuellement pleines. L’essai sera de nouveau disponible à l’ouverture d’une nouvelle saison.",
    unreachable: "Impossible de joindre la galaxie.",
    retry: "Réessayer",
    partial:
      "Ta planète a été créée. Certaines commandes préparées n’ont pas démarré. Vérifie les files de production.",
  },
} as const;
