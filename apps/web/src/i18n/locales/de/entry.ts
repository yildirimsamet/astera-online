/**
 * THE WAY IN — the front door, the galaxy list, the frames between them.
 *
 * Every key in this file belongs to exactly one element on one screen. Two
 * controls that happen to read "Sign in" get two keys, because the second one is
 * a verb on a form and the first one is an invitation on a poster, and the day
 * one of them wants rewording the other must not move with it.
 */

export const landing = {
  /**
   * How busy the world is. Silent until it knows — see `Population`.
   *
   * `<0>` is the tinted span the figure sits in, filled by `<Trans>`. The figure
   * arrives pre-grouped as `amount` rather than as `count`, because `count` is
   * i18next's plural selector and handing it a formatted string breaks that.
   */
  populationHeld: '<0>{{amount}}</0> Kommandanten beherrschen bereits eine Welt',
  populationOnline: '<0>{{amount}}</0> gerade im Spiel',
  register: 'Entdecke deinen Planeten',
  signIn: 'Ich habe schon einen Kommandanten',
  reassurance: 'Noch kein Konto? Spiel erst einmal los und sichere deinen Fortschritt später.',

  /**
   * THE RETURNING DOOR. Owner-reported bug.
   *
   * A device that has held a commander gets the two controls swapped: signing in
   * becomes the loud one. Their own strings rather than a reuse of `signIn` and
   * `register`, because they say different things — one is "come back to the world
   * you left", the other is "see what this is".
   */
  welcomeBack: 'Deine Heimatwelt wartet dort, wo du sie verlassen hast',
  signInPrimary: 'Anmelden',
  returningHint: 'Dein Kommandant und deine Galaxie sind in jedem Browser dieselben.',
  newCommander: 'Stattdessen einen neuen Kommandanten erstellen',
  opening: 'Die Galaxie öffnen',
  ready: 'Dein Planet ist bereit',
  cover: 'Der Himmel öffnet sich',
  publicLinksLabel: 'Weitere Informationen',
  aboutLink: 'Über Astera',
  guideLink: 'Spielanleitung',
  privacyLink: 'Datenschutz',
  termsLink: 'Bedingungen',
  contactLink: 'Kontakt',

  form: {
    labelRegister: 'Erstelle einen Kommandanten',
    labelLogin: 'Anmelden',
    close: 'Schließen',
    eyebrowRegister: 'Neuer Kommandant',
    eyebrowLogin: 'Willkommen zurück',
    headingRegister: 'Nimm einen Planeten',
    headingLogin: 'Anmelden',
    nameLabel: 'Kommandantenname',
    namePlaceholder: 'Vantage',
    passwordLabel: 'Passwort',
    passwordPlaceholder: 'Mindestens {{count}} Zeichen',
    submitBusy: 'Verbindung wird hergestellt',
    submitRegister: 'Kommandant erstellen',
    submitLogin: 'Anmelden',
    switchToLogin: 'Ich habe schon einen Kommandanten',
    switchToRegister: 'Ich brauche einen Kommandanten',
    badName: 'Nutze 2–32 Buchstaben, Zahlen, Unterstriche oder einzelne Leerzeichen in jeder Sprache.',
    noName: 'Gib deinen Kommandantennamen ein.',
    shortPassword: 'Passwörter bestehen aus mindestens {{count}} Zeichen.',
    noPassword: 'Gib dein Passwort ein.',
    failed: 'Anmeldung nicht möglich',
  },
} as const;

export const servers = {
  commanderLabel: 'Kommandant',
  signOut: 'Abmelden',
  rule:
    'In jeder Galaxie ist Platz für höchstens {{seats}} Kommandanten. Die Galaxien füllen sich nacheinander – du landest also dort, wo schon andere spielen.',
  loading: 'Der Himmel wird erkundet',
  unreachable: 'Die Galaxien sind gerade nicht erreichbar.',
  retry: 'Erneut versuchen',
  listLabel: 'Galaxien',
  noneOpen: 'Zurzeit ist keine Galaxie geöffnet. Eine neue Saison steht bevor – versuch es bald wieder.',
  allFull: 'Alle Galaxien sind voll. Mit dem Saisonwechsel beginnt eine neue Galaxie, in der alle von vorn starten.',
  online: '<0>{{amount}}</0> gerade im Spiel',
  yours: 'Deine Galaxie',
  status: {
    open: 'Offen für Kommandanten',
    full: 'Voll',
    locked: 'Öffnet sich, sobald die Galaxie darüber voll ist',
    closed: 'Zwischen zwei Saisons',
  },
  enter: 'Betreten',
  join: 'Beitreten',
  joining: '…',
} as const;

export const app = {
  blockedTitle: 'Im Moment nicht',
  blockedRetry: 'Erneut versuchen',
  /** What `useSession` says when a request failed with no message of its own. */
  sessionFailed: 'Der Server konnte nicht erreicht werden',
} as const;

export const loading = {
  /** Between screens, while identity is being settled. */
  contact: 'Verbindung wird hergestellt',
  /** The galaxy: three waits, three different sentences. */
  sweeping: 'Die Galaxie wird erkundet',
  charting: 'Die Galaxie wird kartiert',
  raising: 'Die Galaxie erscheint',
} as const;

/**
 * WHAT THE DOCUMENT ITSELF SAYS, outside React.
 *
 * The `<meta name="description">` a link preview and a search result read, and
 * which localized install manifest the browser is pointed at. The NAME is not
 * here on purpose — "Astera Online" is the product, and a product does not get
 * translated (D54).
 */
export const document = {
  description: 'Kommandiere eine geschützte Hauptstadt, gewinne Kolonien und decke auf, was die Rivalen halten.',
  manifest: '/manifest.de.webmanifest',
} as const;

export const settings = {
  sectionLabel: 'Sprache',
  hint: 'Die Sprache ändert sich im ganzen Spiel. Alles andere bleibt, wie es ist.',
  /** On the control that opens the picker, and on the picker's own options. */
  choose: 'Sprache wählen',
  current: 'In Verwendung',
} as const;

/**
 * THE PRIVACY CHOICE, IN THE PLAYER'S OWN WORDS.
 *
 * Two sentences, two buttons, one link. The first sentence says what is kept
 * whatever they choose, because the session cookie is not part of the bargain
 * and a notice that implies it is has misdescribed the deal. The second says
 * exactly what each button does — "refuse" leaves ads running, unpersonalised,
 * rather than removing them, and a player who discovers that afterwards was
 * misled by the wording rather than by the ads.
 */
export const consent = {
  title: 'Cookies und Anzeigenauswahl',
  essentials: 'Bei der Anmeldung wird immer ein Sitzungscookie gespeichert. Dieser Teil ist nicht optional.',
  optional:
    'Daten für Reichweitenmessung und Werbung speichern wir nur mit deiner Zustimmung. Wenn du ablehnst, kannst du unverändert weiterspielen; die Anzeigen werden dann nicht personalisiert.',
  accept: 'Erlauben',
  refuse: 'Ablehnen',
  close: 'Schließen',
  policy: 'Cookie-Richtlinie',
  /** The permanent way back in. A row in the device group, not its own section. */
  menuRowLabel: 'Datenschutz',
  /** The row's accessible name; its visible text is the current answer. */
  menuLabel: 'Datenschutz- und Cookie-Einstellungen',
  menuGranted: 'Erlaubt',
  menuDenied: 'Abgelehnt',
  menuUnset: 'Noch nicht ausgewählt',
} as const;
