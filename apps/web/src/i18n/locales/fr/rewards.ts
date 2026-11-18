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
  empty: 'Aucun objectif de récompense disponible',
  emptyHint: 'Recharge la liste des récompenses pour vérifier.',
  summaryReady: "À récupérer",
  summaryClaimed: "Paliers récupérés",
  allMilestones: "Tous les paliers",
  eyebrow: "Objectifs permanents",
  title: "Récompenses",
  intro:
    "Sans expiration ni série. Tout va au Magasin ; le non protégé peut être pillé.",
  waiting: "{{count}} récompenses t’attendent",
  allTaken: "Tu as récupéré les récompenses de tous les objectifs.",
  claim: "Récupérer",
  /** The supply pod over the list: the next ready payout, opened by a tap (C34). */
  welcome: {
    board: 'Nouveau commandant · 7 caisses',
    rule: 'Chaque caisse contient {{hours}} heure de production de ta capitale, la dernière {{big}} heures. La suivante est prête {{gap}} heures après en avoir ouvert une, et elle t\'attend.',
    title: 'Caisse du commandant {{box}}/{{of}}',
    opened: 'Ouverte',
    ready: 'Prête',
    hold: 'Maintiens',
    wait: 'dans {{time}}',
    big: 'Grande caisse',
    later: 'À la production du jour',
    poured: 'Dans ton entrepôt : {{purse}}',
  },
  takeAll: 'Tout prendre · {{count}}',
  go: 'Y aller',
  next: 'Ensuite : {{name}} · encore {{count}}',
  openPod: 'Ouvrir la capsule',
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
    "Dépôt dépassé : rien n’est perdu, mais pas de collecte avant de faire de la place.",
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
      tag: "Augmente la limite de niveau des bâtiments, sauf le Hangar",
    },
    SHIPYARD: {
      name: "Chantier spatial",
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
    how: 'Comment l’obtenir',
    howFact: 'Trois étapes sur X.',
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
