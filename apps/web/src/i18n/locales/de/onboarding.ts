/**
 * THE REHEARSAL — ninety seconds of the real game, before there is an account.
 *
 * Every line is a beat, and every beat is a thing the player is about to DO. None
 * of them explains a system: the copy names what to look for and gets out of the
 * way, because the beat only advances when the thing actually happens.
 *
 * The house style holds here as hard as anywhere — consequence first, never a
 * system name, and never a paragraph where a clause will do.
 */
export const country = {
  label: 'Land',
  choose: 'Wähle dein Land',
  searchLabel: 'Länder durchsuchen',
  searchPlaceholder: 'Nach Land suchen',
  list: 'Länder',
  confirm: 'Land bestätigen',
  change: 'Ändern',
  saved: 'Land aktualisiert',
} as const;

export const onboarding = {
  /** The one-line caption over the disc while the galaxy is being looked at. */
  beats: {
    wide: {
      title: '{{shard}}',
      line: 'Echte Menschen spielen in dieser Galaxie. Jeder Planet ist die Heimat eines Spielers. Die Schiffe, die du siehst, sind ihre echten Flotten.',
      action: 'Zeig mir meine Welt',
    },
    yours: {
      title: 'Dieser Planet gehört dir',
      line: '{{name}} ist dein sicherer Heimatplanet. Hier erzeugst du Ressourcen, studierst Rivalen, baust Verteidigung und Schiffe. Tippe auf deinen Planeten.',
    },
    briefing: {
      title: 'Das Spiel besteht aus vier Schritten',
      line: 'Erzeuge zuerst Ressourcen. Dann studiere Rivalen. Schütze deinen Planeten. Wenn du bereit bist, schick deine Schiffe los. Jedes Upgrade macht eine dieser Aufgaben stärker.',
      action: 'Mach den ersten Schritt',
      mapGrow: 'Machen',
      mapIntel: 'Siehe',
      mapDefend: 'Schützen',
      mapReach: 'Senden',
      mapOutcome: 'Lernen · entscheiden · senden',
    },
    fog: {
      title: 'Erst lernen, später riskieren',
      line: 'Tippe auf einen anderen Planeten. Du siehst sein Level, aber nicht seine Ressourcen, Schiffe oder Verteidigung. Sammle zuerst Informationen. Dann entscheide, ob du angreifen solltest.',
    },
    fogAlone: {
      title: 'Es ist noch niemand hier',
      line: "{{shard}} füllt sich noch. Sammle Aufklärung über Ressourcen und Verteidigung anderer Kommandanten.",
      action: 'Verstanden',
    },
    core: {
      title: 'Erhöhe zuerst das Levellimit',
      line: "Der Befehlskern begrenzt Strukturstufen, außer beim Hangar. Öffne seine Zeile und prüfe Wirkung und Kosten von Stufe 2. Stelle dann das Upgrade in die Warteschlange.",
    },
    refinery: {
      title: 'Mehr Legierung herstellen',
      line: 'Die Raffinerie erzeugt jede Stunde Legierung. Legierung brauchst du für die meisten Gebäude und Schiffe. Tippe auf ihre Zeile und gib Level 2 in Auftrag.',
    },
    extractor: {
      title: 'Jetzt Kristall herstellen',
      line: 'Der Extraktor erzeugt jede Stunde Kristall. Starke Schiffe und Aufklärungswerkzeuge brauchen Kristall. Tippe auf seine Zeile und gib Level 2 in Auftrag.',
    },
    fleet: {
      title: 'Baue nun zwei Schiffe',
      line: 'Öffne die Zeile {{ship}} unter Flotte. Wähle „Max“ und gib beide Schiffe in Auftrag. Mit diesen schnellen Schiffen kannst du Rivalen auskundschaften oder angreifen.',
    },
  },

  /** Always reachable: skip to claim, or leave for an existing account. */
  skip: 'Überspringen',
  haveAccount: 'Ich habe bereits einen Kommandanten',

  /** The wall, at the one moment the player wants something. */
  claim: {
    eyebrowName: "Deine Identität in der Galaxie",
    headingName: "Gib deinem Kommandanten einen Namen",
    lineName: "Andere Spieler kennen dich unter diesem Namen. Wähle den Namen, der in Nachrichten und Ranglisten erscheinen soll.",
    nameLabel: 'Kommandantenname',
    next: "Mit diesem Namen weiter",

    eyebrowPassword: "Zu deinem Kommandanten zurückkehren",
    headingPassword: "Wähle ein Passwort für {{name}}",
    linePassword: "Mit diesem Passwort erreichst du deinen Kommandanten später oder auf einem anderen Gerät und spielst dort weiter, wo du aufgehört hast.",
    passwordLabel: 'Passwort',
    submit: "Der Galaxie beitreten",
    working: "Deine Galaxie wird vorbereitet…",
    back: 'Zurück',
  },

  /** What the beats could not deliver, said plainly rather than swallowed. */
  trouble: {
    noFrontier: 'Jede Galaxie ist im Moment voll. Es gibt nichts zu proben, bis eine Saison vorbei ist.',
    unreachable: 'Die Galaxie konnte nicht erreicht werden.',
    retry: 'Versuch es erneut',
    /** One or more replayed decisions were refused once the server ran them. */
    partial: "Dein Planet wurde erstellt. Einige vorbereitete Aufträge konnten nicht starten. Prüfe die Produktionswarteschlangen.",
  },
} as const;
