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
export const onboarding = {
  /** The one-line caption over the disc while the galaxy is being looked at. */
  beats: {
    wide: {
      title: '{{shard}}',
      line: 'Echte Menschen spielen in dieser Galaxie. Jeder Planet ist die Heimat eines Spielers. Die Schiffe, die Sie sehen, sind ihre echten Flotten.',
      action: 'Zeig mir meine Welt',
    },
    yours: {
      title: 'Dieser Planet gehört dir',
      line: '{{name}} ist Ihr sicherer Heimatplanet. Hier stellen Sie Ressourcen her, studieren Rivalen, bauen Verteidigungsanlagen und bauen Schiffe. Tippen Sie auf Ihren Planeten.',
    },
    briefing: {
      title: 'Das Spiel besteht aus vier Schritten',
      line: 'Erstellen Sie zunächst Ressourcen. Dann studieren Sie Rivalen. Schützen Sie Ihren Planeten. Wenn Sie bereit sind, schicken Sie Ihre Schiffe. Jedes Upgrade macht einen dieser Jobs stärker.',
      action: 'Machen Sie den ersten Schritt',
      mapGrow: 'Machen',
      mapIntel: 'Siehe',
      mapDefend: 'Schützen',
      mapReach: 'Senden',
      mapOutcome: 'Lernen · entscheiden · senden',
    },
    fog: {
      title: 'Erst lernen, später riskieren',
      line: 'Tippen Sie auf einen anderen Planeten. Sie können den Level sehen, aber nicht die Ressourcen, Schiffe oder Verteidigungsanlagen. Sammeln Sie zunächst Informationen. Dann entscheiden Sie, ob Sie angreifen sollen.',
    },
    fogAlone: {
      title: 'Es ist noch niemand hier',
      line: '{{shard}} füllt sich noch. Wenn dies der Fall ist, können Sie nicht sehen, was einer von ihnen in der Hand hält.',
      action: 'Verstanden',
    },
    core: {
      title: 'Erhöhen Sie zuerst das Levellimit',
      line: 'Der Kommandokern legt fest, wie hoch Ihre anderen Gebäude steigen können. Tippen Sie auf die entsprechende Zeile. Sehen Sie, was Level 2 bringt und kostet, und fügen Sie es dann zur Warteschlange hinzu.',
    },
    refinery: {
      title: 'Mehr Legierung herstellen',
      line: 'Die Raffinerie stellt stündlich Legierungen her. Für die meisten Gebäude und Schiffe verwenden Sie Legierungen. Tippen Sie auf die entsprechende Zeile und Warteschlangenebene 2.',
    },
    extractor: {
      title: 'Jetzt Kristall herstellen',
      line: 'Der Extraktor stellt stündlich Kristalle her. Starke Schiffe und Geheimdienstwerkzeuge brauchen Kristall. Tippen Sie auf die entsprechende Zeile und Warteschlangenebene 2.',
    },
    fleet: {
      title: 'Baue nun zwei Schiffe',
      line: 'Öffnen Sie die Zeile {{ship}} unter Flotte. Wählen Sie „Max“ und stellen Sie beide Schiffe in die Warteschlange. Mit diesen schnellen Schiffen können Sie Rivalen auskundschaften oder angreifen.',
    },
  },

  /** Always reachable: skip to claim, or leave for an existing account. */
  skip: 'Überspringen',
  haveAccount: 'Ich habe bereits einen Kommandanten',

  /** The wall, at the one moment the player wants something. */
  claim: {
    eyebrowName: 'Letzter Schritt',
    headingName: 'Unterschreiben Sie die Welt mit Ihrem Namen',
    lineName: 'Ihre vier Bestellungen werden bereitgestellt. Beanspruchen Sie {{name}} und ihre echten Uhren beginnen gemeinsam.',
    nameLabel: 'Kommandantenname',
    next: 'Weiter',

    eyebrowPassword: 'Noch eins',
    headingPassword: 'Sperre {{name}}',
    linePassword: 'Wählen Sie ein Passwort und Ihr Kommandant wartet in dem Browser, in dem Sie sich anmelden.',
    passwordLabel: 'Passwort',
    submit: 'Beanspruche den Planeten',
    working: 'Die Welt erobern',
    back: 'Zurück',
  },

  /** What the beats could not deliver, said plainly rather than swallowed. */
  trouble: {
    noFrontier: 'Jede Galaxie ist im Moment voll. Es gibt nichts zu proben, bis eine Saison vorbei ist.',
    unreachable: 'Die Galaxie konnte nicht erreicht werden.',
    retry: 'Versuchen Sie es erneut',
    /** One or more replayed decisions were refused once the server ran them. */
    partial: 'Deine Welt gehört dir. Eine abgestufte Bestellung wurde abgelehnt, als es zu echten Warteschlangen kam.',
  },
} as const;
