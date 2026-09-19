/**

* RÉCOMPENSES.
*
* ÉCRIT POUR LE FRANÇAIS, PAS TRADUIT MOT À MOT DEPUIS L’ANGLAIS. Cet écran a deux
* rôles : dire au joueur *ce qu’il doit faire* et *ce qu’il recevra en échange*.
* Aucune phrase ne félicite, ne presse ni ne lance de compte à rebours ; il s’agit
* d’une liste permanente d’objectifs, pas d’une campagne à poursuivre dans l’urgence.
*
* Les titres portent le nom de L’OBJECTIF, pas celui de la récompense — pas
* « Récompense d’exploration I », mais « Sondes envoyées ». Le rôle principal de
* cette liste est de montrer à un nouveau commandant les parties du jeu qu’il n’a
* peut-être pas encore essayées : sondage, raid, minage et récupération d’épaves.
  */
export const rewards = {
  eyebrow: "Objectifs permanents",
  title: "Récompenses",
  intro:
    "Ces objectifs n’expirent jamais et aucun ne demande une série ininterrompue. Les ressources récupérées sont ajoutées directement à ton Dépôt ; elles peuvent dépasser sa capacité et peuvent être perdues lors de raids.",
  waiting: "{{count}} récompenses t’attendent",
  allTaken: "Tu as récupéré les récompenses de tous les objectifs.",
  claim: "Récupérer",
  claimed: "Récupérée",
  /** Indique ce qu’il reste, sans réprimander. */
  toGo: "Encore {{count}}",
  locked: "Verrouillé",
  goalCount: "×{{n}}",
  goalLevel: "N{{n}}",
  progressCount: "{{have}} / {{need}}",
  progressLevel: "N{{have}}",
  progressDone: "Terminé",
  granted: "+{{alloy}} alliage · +{{crystal}} cristal",
  overCap:
    "Cette récompense dépassera la capacité du Dépôt. Les ressources ne seront pas perdues ; en revanche, tu ne pourras plus collecter celles du stock de production tant que tu n’auras pas libéré de la place.",
  /**

  * Nom et étiquette de chaque chaîne. Le nom dit CE QU’EST l’objectif ; l’étiquette
  * explique pourquoi il peut être intéressant. Quelqu’un qui parcourt onze cartes
  * a besoin des deux informations.
    */
  chains: {
    VAULT: {
      name: "Dépôt",
      tag: "Agrandis tes réserves et protège-en une partie contre les raids",
    },
    PIRATE: {
      name: "Pirates vaincus",
      tag: "Bats différents pirates et ramène tes vaisseaux",
    },
    PROBE: {
      name: "Sondes envoyées",
      tag: "Renseigne-toi avant d’envoyer une flotte",
    },
    RAID: {
      name: "Mondes attaqués",
      tag: "Chaque monde différent compte une fois",
    },
    CORE: {
      name: "Noyau de Commandement",
      tag: "La limite supérieure des niveaux de bâtiments",
    },
    SHIPYARD: {
      name: "Chantier Spatial",
      tag: "Nouvelles classes de vaisseaux et production plus rapide",
    },
    REFINERY: {
      name: "Raffinerie d’Alliage",
      tag: "Davantage d’alliage chaque heure",
    },
    EXTRACTOR: {
      name: "Mine de Cristal",
      tag: "Davantage de cristal chaque heure",
    },
    SHIPS: {
      name: "Flèches construites",
      tag: "Comptées pendant toute la saison",
    },
    AEGIS: { name: "Aegis", tag: "Un bouclier autour de ton monde" },
    MINE: {
      name: "Astéroïdes exploités",
      tag: "Envoie un Prospecteur vers un astéroïde en mouvement",
    },
    SALVAGE: {
      name: "Épaves récupérées",
      tag: "Rapporte des ressources depuis un champ d’épaves",
    },
    SOCIAL: { name: "Suivre @JoinAstera", tag: "Une seule fois par compte" },
  },
  /**
   * Récompense communautaire ; comme c’est la seule action effectuée hors du jeu,
   * elle est formulée comme une INSTRUCTION plutôt que comme une simple description.
   * Trois étapes, dans l’ordre où elles doivent être réalisées.
   */
  social: {
    eyebrow: "Récompense communautaire",
    handle: "@JoinAstera",
    url: "https://x.com/JoinAstera",
    alloy: "alliage",
    crystal: "cristal",
    open: "Ouvrir @JoinAstera sur X",
    step1:
      "Suis @JoinAstera ; le bouton ci-dessous ouvre le compte dans un nouvel onglet.",
    step2: "Envoie-nous ensuite un DM avec le nom de ton commandant :",
    step3:
      "Nous vérifions manuellement. Dès que nous aurons validé, ta récompense t’attendra ici.",
    pending: "En attente de ton message",
    ready: "Validée ; récupère ta récompense",
    /**

    * Ce texte est lu par un joueur qui l’a déjà récupérée. « Récupérée » ne suffit
    * pas : toutes les autres cartes du panneau disent cela POUR CETTE saison et
    * reviennent dans une nouvelle galaxie. Celle-ci ne revient pas ; la carte le dit
    * explicitement afin que personne ne recommence à suivre le compte en attendant
    * une validation qui n’arrivera pas.
      */
    forever:
      "Versée. Ce bonus n’est accordé qu’une seule fois par compte ; il ne revient pas dans une nouvelle galaxie.",
  },
} as const;
