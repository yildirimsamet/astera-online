/** Entrée du jeu, liste des galaxies et messages de chargement. */

export const landing = {
  populationHeld: '<0>{{amount}}</0> commandants règnent déjà sur leur monde',
  populationOnline: '<0>{{amount}}</0> dans la galaxie en ce moment',
  register: 'Découvre ta planète',
  signIn: 'J\'ai déjà un commandant',
  reassurance: 'Pas besoin de compte pour commencer. Joue d’abord, sauvegarde ensuite.',

  /** Accueil d’un commandant qui revient sur cet appareil. */
  welcomeBack: 'Ta planète capitale t’attend là où tu l’as laissée',
  signInPrimary: 'Se connecter',
  returningHint: 'Retrouve ton commandant et ta galaxie depuis n’importe quel navigateur.',
  newCommander: 'Créer plutôt un nouveau commandant',
  opening: 'La galaxie s’ouvre',
  ready: 'Ta planète est prête',
  cover: 'Le ciel se dévoile',
  publicLinksLabel: 'En savoir plus',
  aboutLink: 'À propos d’Astera',
  guideLink: 'Comment jouer',
  privacyLink: 'Confidentialité',
  termsLink: 'Conditions d’utilisation',
  contactLink: 'Contact',

  form: {
    labelRegister: 'Créer un commandant',
    labelLogin: 'Se connecter',
    close: 'Fermer',
    eyebrowRegister: 'Nouveau commandant',
    eyebrowLogin: 'Content de te revoir',
    headingRegister: 'Prends une planète',
    headingLogin: 'Se connecter',
    nameLabel: 'Nom du commandant',
    namePlaceholder: 'Vantage',
    passwordLabel: 'Mot de passe',
    passwordPlaceholder: 'Au moins {{count}} caractères',
    submitBusy: 'Connexion en cours',
    submitRegister: 'Créer un commandant',
    submitLogin: 'Se connecter',
    switchToLogin: 'J\'ai déjà un commandant',
    switchToRegister: 'J\'ai besoin d\'un commandant',
    badName: 'Utilise 2 à 32 lettres, chiffres, traits de soulignement ou espaces simples, dans toute langue.',
    noName: 'Saisis ton nom de commandant.',
    shortPassword: 'Les mots de passe comportent au moins {{count}} caractères.',
    noPassword: 'Saisis ton mot de passe.',
    failed: 'Impossible de se connecter',
  },
} as const;

export const servers = {
  commanderLabel: 'Commandant',
  signOut: 'Se déconnecter',
  rule:
    'Chaque galaxie accueille au plus {{seats}} commandants. Elles se remplissent l’une après l’autre : tu rejoindras donc une galaxie où d’autres jouent déjà.',
  loading: 'Exploration du ciel',
  unreachable: 'Impossible d\'atteindre les galaxies.',
  retry: 'Essayer à nouveau',
  listLabel: 'Galaxies',
  noneOpen: 'Aucune galaxie n\'est ouverte pour le moment. La saison est entre deux réinitialisations. Réessayez dans un instant.',
  allFull: 'Toutes les galaxies sont pleines. La prochaine ouvrira à la réinitialisation de la saison, quand tout le monde repartira de zéro.',
  online: '<0>{{amount}}</0> dans la galaxie en ce moment',
  yours: 'Ta galaxie',
  status: {
    open: 'Ouverte aux commandants',
    full: 'Complet',
    locked: 'S’ouvre lorsque la galaxie précédente est pleine',
    closed: 'Entre les saisons',
  },
  enter: 'Entrer',
  join: 'Rejoindre',
  joining: '…',
} as const;

export const app = {
  blockedTitle: 'Pas maintenant',
  blockedRetry: 'Essayer à nouveau',
  sessionFailed: 'Impossible d\'atteindre le serveur',
} as const;

export const loading = {
  contact: 'Connexion en cours',
  sweeping: 'Exploration de la galaxie',
  charting: 'Cartographie de la galaxie',
  raising: 'La galaxie apparaît',
} as const;

export const document = {
  description: 'Dirige une planète capitale protégée, conquiers des colonies et découvre ce que cachent tes rivaux.',
  manifest: '/manifest.fr.webmanifest',
} as const;

export const settings = {
  sectionLabel: 'Langue',
  hint: 'La langue change dans tout le jeu. Le reste demeure tel quel.',
  choose: 'Choisir une langue',
  current: 'Langue actuelle',
} as const;

export const consent = {
  title: 'Cookies et choix publicitaires',
  essentials: 'La connexion nécessite toujours un cookie de session. Celui-ci est indispensable.',
  optional:
    'Les données de mesure et de publicité ne sont enregistrées qu’avec ton accord. Si tu refuses, le jeu fonctionne tout aussi bien et les publicités ne sont pas personnalisées.',
  accept: 'Autoriser',
  refuse: 'Refuser',
  close: 'Fermer',
  policy: 'Politique en matière de cookies',
  menuRowLabel: 'Confidentialité',
  menuLabel: 'Paramètres de confidentialité et de cookies',
  menuGranted: 'Autorisé',
  menuDenied: 'Refusé',
  menuUnset: 'Pas encore choisi',
} as const;
