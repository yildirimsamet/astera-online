/**
 * WHAT YOU KNOW — the intel centre, the battle reports, the clarity readout, and
 * the dossier lines the focus rail is built from.
 */

export const intel = {
  shelf: {
    label: 'Aufklärung',
    watch: 'Beobachtung',
    probes: 'Sonden',
    battles: 'Kämpfe',
    radar: 'Radar',
  },
  rivals: {
    heading: 'Markierte Rivalen',
    none: 'Markiere einen Rivalen an seiner Welt in der Galaxie; die Markierung folgt ihm auf jede seiner Welten.',
    lost: 'nicht auf deiner Scheibe',
  },
  known: {
    heading: 'Was du weißt',
    legendToggle: 'Klarheit und Alter',
    legend: 'Balken sind die Live-Klarheit eines Teleskops. Eine Sondenmessung altert: Ihr Bild wird nach einer Stunde körnig, nach einem Tag blass, und sagt, wie alt sie ist.',
    telescope: 'Teleskop',
    probe: 'Sondenbericht',
    window: 'Fenster {{duration}}',
    empty: 'Noch nichts bekannt: Ein Teleskop beobachtet live, eine Sonde bringt eine Messung zurück.',
  },
  openOrbit: 'Orbit öffnen',
  coverage: {
    label: '-Abdeckung',
    blind: 'Du kannst in keinen einzigen Planeten hineinsehen',
    partial_one: 'Du beobachtest {{seen}} von {{count}} Slot',
    partial_other: 'Du beobachtest {{seen}} von {{count}} Slots',
    full: 'Jeder deiner Slots beobachtet jemanden',
    blindHint: 'Ein Teleskop ist der günstigste Weg, das zu verhindern.',
    idleHint_one: '{{count}} Slot ist frei. Wähle eine Welt in der Galaxie und richte ihn auf sie.',
    idleHint_other: '{{count}} Slots sind frei. Wähle eine Welt in der Galaxie und richte einen auf sie.',
    scarcity_one:
      '{{neighbours}} Welten da draußen und {{count}} Auge zu vergeben. Ein Wechsel kostet eine Abklingzeit, also wähle, wen.',
    scarcity_other:
      '{{neighbours}} Welten da draußen und {{count}} Augen zu vergeben. Ein Wechsel kostet eine Abklingzeit, also wähle, wen.',
    oneMore: 'Telescope L{{level}} würde sich noch einen ansehen.',
    noRadar: 'Und ohne Radar kannst du eine Bedrohung, die auf dich zielt, nicht von anderen Bewegungen unterscheiden.',
  },

  watching: {
    nextSlot: 'Teleskop L{{level}}',
    heading: 'Zuschauen',
    slotsUsed: '{{used}}/{{total}} Slots verwendet',
    slotLabel: 'Steckplatz {{slot}}',
    slotEmpty: 'Leerlauf',
    missingNoSlot: 'Kein Slot ist auf irgendetwas gerichtet',
    missingNoTelescope: 'Du hast kein Teleskop',
    gives: "Zeigt, ob eine Flotte die beobachtete Welt verlassen hat. Berücksichtige bei einem Überfall das Alter der Messung und die verbliebene Verteidigung.",
    costPoint: 'Wähle einen Planeten in der Galaxie und richte einen Slot auf ihn.',
    costInstall: 'Installiere eines von deinem Planetenbildschirm.',
    away: 'Ihr Planet wird durch alles verteidigt, was sie zurückgelassen haben.',
    intermittent:
      'Ein intermittierender Messwert wird bestenfalls alle zwanzig Minuten aktualisiert. Eine erneute Überprüfung führt nicht zu einer Verbesserung – die Antwort steht fest, bis sich das Fenster umdreht.',
  },

  probes: {
    openDossier: 'Dossier öffnen',
    heading: 'Probe-Berichte',
    newest: 'Neueste zuerst',
    missing: 'Keine Sonde ist jemals zurückgekommen',
    gives: 'Schätzungen ihrer Ressourcen und Einheiten, angezeigt als Bereiche. Es garantiert keinen Ausgang des Kampfes.',
    /**
     * THE FIGURES ARE INTERPOLATED, NOT WRITTEN. D59.
     *
     * This line said "220 alloy" for two phases while `PROBE` charged 50 and 50 —
     * a price the game had never charged, on the one card whose whole job is to
     * sell scouting to somebody deciding whether to look or to hit. It is passed
     * the real constants now, so it cannot drift from them again.
     *
     * Speed leads the sentence on the owner's instruction: a probe is the fastest
     * thing a commander can arm, and nobody was using it.
     */
    cost: 'Schnell und günstig – {{alloy}} Legierung, {{crystal}} Kristall, und sie ist schneller als jedes deiner Kriegsschiffe. Ihr Radar könnte sie erfassen.',
    stock: 'Lagerbestand',
    defence: 'Wert der bewaffneten Einheit',
    ships: 'Schiffe',
    accuracyHome: '{{percent}} Genauigkeit · Flotte war zu Hause',
    accuracyOut: '{{percent}} Genauigkeit · Flotte war unterwegs',
    scaleNote: 'Jeder Balken beginnt bei null: das Band ist ihre Schätzung, die türkise Linie deine Welt.',
    estimateNote: 'Bei diesen Zahlen handelt es sich um geschätzte Bereiche. Der Wert der bewaffneten Einheit schließt den Schild und unbewaffnete Schiffe aus.',
    caught: 'Die Sonde wurde entdeckt',
    /* Two words beside the signal bars, which carry the accuracy themselves. */
    homeTag: '-Flotte war zu Hause',
    outTag: '-Flotte war außer Betrieb',
  },

  radar: {
    glance: 'Radar · letzte 24 h',
    contacts_one: '{{count}} Kontakt',
    contacts_other: '{{count}} Kontakte',
    dayAgo: '−24 h',
    now: 'jetzt',
    day: 'Letzte 24 Stunden',
    heading: 'Wer schaut dich an?',
    level: 'Radar L{{level}}',
    missing: 'Du hast kein Radar',
    gives:
      "Zeigt Bewegungen in Reichweite und die Ankunftszeit von Bedrohungen deiner Welt. Sonden können erkannt werden; eine Erkennung ist nicht garantiert.",
    cost: "Ohne Radar bleiben die meisten Sonden zu dieser Welt unentdeckt.",
    quiet: "Keine Scans erkannt. Radar Stufe {{level}} ist aktiv.",
    scan: 'Scan erkannt',
    bearing: 'vom galaktischen {{bearing}}',
    origin: '· {{planet}}',
    /** Which of the caller's own worlds the scan landed on. */
    onWorld: '· {{planet}}',
    /* Captions beside the two drawn rings; the picture carries the rest. */
    ringSense: 'Da draußen ist etwas',
    ringWarn: 'Zeitgesteuerte Warnung',
    /** While the two circles are one, one caption states what the circle does. */
    ringOne: 'Erkennung und zeitgesteuerte Warnung',
    /** C9: the dashed rim the rings are drawn against, and a ring's reach with its unit. */
    rim: 'Rand der Galaxie',
    reach: '{{value}} Einheiten',
    /**
     * THE READING FOR SOMEBODY WHO CANNOT SEE THE RINGS. The two circles carry
     * both figures and the difference between them; this is the same fact in the
     * one form a screen reader can take.
     */
    noteFleets:
      'Radar L{{level}} unterscheidet eine Bedrohung, die auf dich zielt, ab {{sense}} Einheiten, ohne Uhr. Ab {{warn}} Einheiten kommt die Ankunftszeit hinzu.',
    /** The merged form. One circle, both products, one sentence. */
    noteFleetsOne:
      'Radar L{{level}} zeigt Flugobjekte in Bewegung bis {{sense}} Einheiten und markiert eine Bedrohung, die auf deine Welt zielt, mit ihrer Ankunftszeit.',
    /**
     * THE HALF NO PICTURE CAN DRAW. D49: a reach is what the defender owns and
     * the warning it buys is what the ATTACKER decides, by choosing what to fly.
     * The rings are fixed; how long something sits inside them is not.
     */
    noteSlow: 'Eine langsame, schwere Flotte bleibt länger in Radarreichweite.',
    noteProbesLegacy: 'Radar L{{level}} fängt Sonden ab und warnt vor ankommenden Flotten innerhalb seines Kreises.',
    noteBearing: 'L2 fügt die Richtung hinzu, aus der sie kamen.',
    noteOrigin: 'L5 benennt den Planeten.',
  },
} as const;

export const reports = {
  enemyFleetEmpty: "Zu Kampfbeginn waren keine gegnerischen Einheiten anwesend.",
  enemyFleetAtBattle: "Feindliche Streitmacht zu Kampfbeginn",
  enemyFleetSnapshot: "Diese Aufnahme zeigt die Streitmacht in diesem Kampf, einschließlich Unterstützungsschiffen. Verbleibende Einheiten schließen Rückzüge ein, spätere Reparaturen und Verstärkungen nicht.",
  enemyFleetInsufficient: "Die Kampfkraft deiner Angriffsflotte lag unter der Hälfte der Verteidigung. Die gesamte feindliche Streitmacht konnte nicht ermittelt werden. Nur bestätigte feindliche Verluste werden angezeigt.",
  enemyFleetUnknown: "Dieser alte Bericht enthält keinen verlässlichen Nachweis zur vollständigen Sicht auf die feindliche Streitmacht. Nur bestätigte feindliche Verluste werden angezeigt.",

  distributedRulesTitle: "So wurde dieser Kampf ausgetragen",
  distributedRetreatRule: "Beschädigte Schiffe können am Ende der Runden 1–{{lastRound}} fliehen. Sie behalten ihre Schäden und kämpfen nicht weiter.",
  distributedDamageNote: "Die Summen normaler Schüsse umfassen von Aegis und Schiffsschilden absorbierten Schaden sowie tatsächlichen Hüllenschaden. Weiterverteilter überschüssiger Schaden zählt nicht doppelt. Die Summen gelten für die ganze Seite einschließlich Verbündeter. Deine Verlustliste enthält nur deine eigenen Schiffe.",

  retreated: 'Lebend zurückgezogen: {{count}}. Diese Schiffe behalten ihre Hüllenschäden.',
  enemyRetreated: "{{count}} feindliche Schiffe sind geflohen und haben überlebt.",
  turningPointRetreated: "Nach Runde {{round}} kämpften keine Kriegsschiffe mehr. Einige Schiffe sind lebend geflohen.",
  heading: 'Kampfberichte',
  newest: 'Neueste zuerst',
  empty:
    'Es wurde noch um nichts gekämpft. Ein Kampf ist die einzige Information in diesem Spiel, bei der es sich niemals um eine Vermutung handelt.',
  youRaided: 'Du hast überfallen',
  raidedBy: 'Überfallen von',
  rounds: '{{count}} Runden',
  sheetYouRaided: 'Ziel: {{opponent}} · {{planet}}',
  sheetYouRaidedPirate: 'Ziel: {{opponent}}',
  sheetTheyRaided: 'Angreifer: {{opponent}}',
  attackedPlanet: 'Angegriffener Planet: {{planet}}',
  heldAgainstYou: '{{planet}} verteidigte weiter. Du hast bei diesem Überfall keine Beute mitgenommen.',
  brokenByYou: 'Du hast die Verteidigung auf {{planet}} beschädigt.',
  /**
   * A PIRATE VERDICT NAMES NO WORLD, because there is not one. Both sentences
   * above are built around `{{planet}}`, which is the empty string out here.
   */
  pirateBroken: 'Die Crew ist kaputt. Was von ihnen übrig geblieben ist, gehört dir.',
  pirateHeld: 'Die Piraten verteidigten weiter. Du hast bei diesem Überfall keine Beute mitgenommen.',
  /** The prize, and the only door in the game into a hull you did not build. */
  pirateCaptured: 'Von Piraten',
  pirateOverrun: 'Ohne Geleitschutz konnten die Frachter nicht entkommen: {{fleet}}.',
  pirateCapturedNote:
    'Intakt aus dem Wrack einer Crew geborgen, die du zerstört hast. Es schließt sich der Garnison der Welt an, zu der deine Flotte zurückkehrt – auch über die Hangarkapazität hinaus – und zählt nicht als von dir gebaut.',
  youHeld: 'Du hast den Überfall gestoppt. Der Angreifer hat keine Ressourcen beansprucht.',
  youFell: 'Der Überfall hat deine Verteidigung beschädigt.',
  /** The price of the haul, beside it. `Rounds` is the model's number, not the player's. */
  shipsLost: 'Schiffe verloren',
  haul: 'Was nach Hause kam',
  haulLost: 'Was sie genommen haben',
  /** What your Garbage Collectors lifted — beside the haul, never inside it. D200. */
  salvageHaul: 'Aus dem Wrack geborgen',
  roundsLabel: 'Runden',
  taken: 'vergeben',
  lost: 'Verloren',
  dominion: 'Dominion',
  dominionSummaryGained: 'Du hast in diesem Kampf {{amount}} Dominion erlangt.',
  dominionSummaryLost: 'Du hast {{amount}} Dominion in dieser Schlacht verloren.',
  dominionReason: 'Die von dir gesicherte Beute und die dauerhaften Verluste des Gegners bringen Punkte. Die dir abgenommene Beute und deine dauerhaften Verluste ziehen Punkte ab. Der Ressourcenwert wird verwendet, nicht die Anzahl der Schiffe.',
  dominionBreakdown: {
    title: 'Wie sich Dominion bewegte',
    lootGained: 'Gesicherte Beute',
    lootLost: 'Beute von dir genommen',
    enemyLosses: 'Dauerhafte Verluste des Gegners',
    ownLosses: 'Deine dauerhaften Verluste',
    total: 'Gesamtpunktänderung',
  },
  clansAtLaunch: 'Clans, als diese Flotte gestartet wurde',
  yourClan: 'Deine Seite',
  theirClan: 'Ihre Seite',
  noClan: 'Kein Clan',
  verdict: {
    label: 'Kampfergebnis',
    yourForce: 'Deine Streitmacht',
    yourLosses: 'Deine Verluste',
    sent: 'Gesendet',
    held: 'Hatte',
    total: 'Gesamt',
    lost: 'Verloren',
    returned: 'Überlebt',
    standing: 'Stehend',
    destroyed: 'Du hast zerstört',
    enemyDestroyed: 'Feindliche Einheiten zerstört',
    attackerDestroyed: 'Angreifende Schiffe zerstört',
    noneReturned: 'Keines deiner Schiffe hat die Schlacht überlebt.',
    someReturned: '{{count}} deiner Schiffe haben die Schlacht überlebt.',
    enemySurvivedNote: 'Feindliche Einheiten bleiben; ihre Anzahl ist verborgen. Diese Zahl ist nur das, was du zerstört hast.',
    enemyUnknownNote: 'Diese Zahl ist nur das, was du zerstört hast; die verbleibende Anzahl der Feinde ist verborgen.',
    loot: 'Beute',
    rosterUnknown: 'Dieser Bericht hat keine Startanzahl. Die Anzahl der Überlebenden kann nicht berechnet werden.',
    walkoverSummary: 'Es waren keine Einheiten zur Verteidigung des Ziels da. Es gab keinen Kampf.',
    piratePartialSummary: 'Ein Teil der Piratenflotte war am Ende der Schlacht noch am Leben.',
    title: {
      attacking: {
        DECISIVE: 'Dein Überfall war erfolgreich',
        DECISIVE_WIPED: 'Du hast die Verteidigung durchbrochen, aber deine Flotte verloren',
        PARTIAL: 'Dein Überfall war teilweise erfolgreich',
        PARTIAL_WIPED: 'Du hast die Verteidigung beschädigt, aber deine Flotte verloren',
        REPELLED: 'Dein Überfall wurde abgewehrt',
      },
      defending: {
        DECISIVE: 'Deine Verteidigung wurde durchbrochen',
        PARTIAL: 'Deine Verteidigung wurde teilweise durchbrochen',
        REPELLED: 'Du hast den Überfall gestoppt',
      },
    },
    summary: {
      attacking: {
        DECISIVE: 'Es waren keine Einheiten mehr übrig, um das Ziel zu verteidigen.',
        PARTIAL: 'Die Bedingung für den vollständigen Erfolg wurde nicht erfüllt: Verteidigende Einheiten oder der Schild standen noch.',
        REPELLED: 'Der Feind verteidigte weiter. Du hast keine Beute gemacht.',
      },
      defending: {
        DECISIVE: "Keine Einheit kämpfte mehr in deiner Verteidigung.",
        PARTIAL: 'Der Angreifer hatte keinen vollen Erfolg: Deine Einheiten oder dein Schild standen noch.',
        REPELLED: 'Deine Verteidigung hat gehalten. Der Angreifer hat nichts erbeutet.',
      },
    },
  },
  /*
    WHAT IT SHOWS IS LOSSES, so that is what it says. The heading claimed 'what
    they had' over a list of what was DESTROYED — and its own empty state said
    'nothing of theirs was destroyed', so the two disagreed inside one block.
    Losses are still the floor on what they fielded; the dossier is where that
    inference is drawn, and it says 'at least' in as many words.
  */
  theirLosses: 'Was du zerstört hast',
  theirs: 'Was sie hatten',
  theirsEmpty: 'Nichts von ihnen wurde zerstört.',
  /** The roster table. 'What it cost you' describes one of its three columns. */
  yourForce: 'Deine Streitmacht',
  yours: 'Was es dich gekostet hat',
  yoursEmpty: 'Du hast nichts verloren.',
  howItWent: 'Wie es gelaufen ist',
  reasonHeading: 'Warum dieses Ergebnis?',
  rulesToggle: 'Kampfregeln und Berechnung',
  roundCalculationToggle: 'Zeigt die Schussberechnung dieser Runde an',
  roundLossesYours: 'Deine Einheiten zerstört',
  roundLossesTheirs: 'Feindliche Einheiten zerstört',
  roundNoCasualties: 'Keine Verluste',
  roundShield: "Die Aegis des Verteidigers absorbierte {{amount}} Schaden.",
  turningPointSupport: 'Nach Runde {{round}} hattest du keine feuerfähigen Einheiten mehr. Die {{support}} verbleibenden Unterstützungsschiffe konnten nicht angreifen.',
  turningPointWiped: 'Nach Runde {{round}} wurde deine gesamte Streitmacht zerstört.',
  roundDamageNote: 'Die Schadenswerte beinhalten jeglichen vom Schild des Verteidigers absorbierten Schaden.',
  roundDealt: 'Du hast ausgeteilt',
  roundTook: 'Du hast genommen',
  roundLine: 'Du hast <0>{{dealt}}</0> ausgeteilt und <1>{{took}}</1> genommen',
  shield: 'Schild {{amount}}',
  shieldBreaker: 'Nullifier +{{amount}}',
  aegis: {
    aria: 'Aegis-Schild',
    label: 'AEGIS',
    labelTheirs: 'Feindlicher Aegis-Schild',
    labelYours: 'Dein Aegis-Schild',
    broken: 'BROKEN',
    roundedZero: 'GEMELDET 0',
    damaged: 'DAMAGED',
    held: 'HELD',
    before: 'Vor dem Kampf',
    after: 'Nach dem Kampf',
    note: 'Der Planetenschild erleidet Schaden, bevor es eine verteidigende Einheit erleidet.',
    brokenUnitsRemain: 'Der Schild meldet 0, aber die verteidigenden Einheiten haben überlebt.',
    brokenDefenceGone: "Der Schild brach und keine verteidigende Einheit kämpfte weiter.",
    brokenMeaning: 'Schildstärke ist gerundet. Ein gemeldeter Wert von 0 allein beweist nicht, dass alle verteidigenden Streitkräfte vernichtet wurden.',
    absorbed: '{{amount}} Schildschaden absorbiert',
  },
  /* ── what a report owes each case. `docs/battle-reports.md` ── */
  /**
   * THE WALKOVER. `resolveCombat` breaks before round one when there is nothing
   * standing and no shield, so the most common raid in the game arrives with
   * `rounds: []` — and drew a heading over an empty plate.
   */
  /** The four questions a battle report answers, in the order a reader asks them. */
  q: {
    happened: 'Was ist passiert?',
    there: 'Was du über den Feind erfahren hast',
    enemyForce: 'Feindliche Einheiten zu Beginn der Schlacht',
    enemyLosses: 'Was du vom Feind zerstört hast',
    incomingForce: 'Die Flotte, die dich angegriffen hat',
    who: 'Was ist mit deiner Truppe passiert?',
    changed: 'Beute- und Punkteänderungen',
  },
  walkoverHeading: 'Hier stand keine verteidigende Streitmacht',
  walkoverBody:
    'Hier stand weder eine Kampfflotte noch eine Bodenverteidigung. Deine Schiffe sind angekommen, haben geladen und sind abgeflogen. Es gab keinen Kampf zu berichten.',
  walkoverDefendingBody:
    'Auf deiner Welt standen keine verteidigenden Einheiten. Die angreifende Flotte konnte die verfügbare Beute kampflos nehmen.',
  /** Their board, and how far the reading goes. */
  theirBoardComplete: 'Alle Einheiten, die zu Beginn der Schlacht verteidigen',
  theirBoardCompleteNote:
    'Alle wurden in dieser Schlacht zerstört. Einige Bodengeschütze können nach der Schlacht wieder aufgebaut werden.',
  theirBoardEmptyAtStart: 'Hier standen zu Beginn keine verteidigenden Einheiten',
  theirBoardEmptyAtStartNote:
    'Es befanden sich keine Kampfschiffe oder Bodengeschütze am Ziel, daher gibt es hier keine Liste der zerstörten Einheiten.',
  theirBoardFloor: 'Nur zerstörte Einheiten',
  theirBoardFloorNote:
    'Das ist nicht die gesamte Flotte des Feindes. Aufgeführt sind nur die in dieser Schlacht zerstörten Einheiten. Die verbleibenden Einheiten werden hier nicht gezeigt; sende eine neue Sonde für eine Schätzung.',
  theirBoardMissingRosterNote: 'Dieser Bericht enthält keine Startaufstellung der angreifenden Flotte. Aufgeführt sind nur die Schiffe, die du zerstört hast; Überlebende lassen sich nicht berechnen.',
  theirBoardNothing: 'Du hast nichts zerstört',
  /**
   * THE DEFENDER'S VERSION, WHICH IS NOT A BOUND AT ALL. D164.
   *
   * The two above describe a reading with an edge to it — wreckage, and how far it
   * lets you see. This one describes a force the reader stood underneath, so it
   * makes no claim about limits: it names what arrived, and the bar beside each
   * hull says how much of it the defence took down.
   */
  theirBoardArrived: 'Was auf dich zukam',
  theirBoardArrivedNote:
    'Die gesamte Flotte, die auf dich geschickt wurde, einschließlich Kampf- und Unterstützungsschiffen. Jede Zeile zeigt, wie viele ankamen, zerstört wurden und übrig blieben.',
  /** The wall, stated apart from the ships, because it is a different kind of thing. */
  groundHeading: 'Bodenverteidigung',
  groundNote: 'Diese Waffen verteidigen den Planeten und können nicht fliegen. {{percent}} % jedes zerstörten Typs werden nach dem Kampf wieder aufgebaut, abgerundet. Ihre Verluste werden getrennt von Schiffen behandelt.',
  shipsHeading: 'Schiffe',
  noGroundHeading: 'Keine Bodenverteidigung',
  noGroundNote: 'Diese Welt hatte keine Mauer, als du ankamst.',
  calculation: {
    intro:
      'Das obige feste Rezept ergibt die folgenden Zahlen. Jede Runde folgt dann den gleichen drei Schritten.',
    formulaHeading: 'Wie Angriffskraft aufgebaut wird',
    formulaBase: '1 · Basis: Einheitenanzahl × Angriff × Forschung.',
    formulaCounter: '2 · Zähler: starke Übereinstimmung ×{{strong}}; schwache Übereinstimmung ×{{weak}}.',
    formulaRoll: '3 · Schussänderung: −{{min}}% zu +{{max}}%.',
    formulaHp: "Jede bewaffnete Einheit schießt einmal auf ein zufälliges lebendes Ziel. Überschüssiger Schaden verfällt.",
    formulaCarry: "Hüllenschaden und verbrauchte Schiffsschilde bleiben zwischen Runden erhalten. Im Kampf regeneriert keines davon.",
    formulaSupport: "Nach den Kampfeinheiten treffen übrige Schüsse derselben Runde die Frachter.",
    resultHeading: 'Wie über das Ergebnis entschieden wird',
    resultDecisive:
      "ENTSCHEIDEND · keine verteidigende Einheit kämpft weiter und der aktive Schild ist überwunden · {{decisiveLoot}}% des offenen Vorrats und {{decisiveBuffer}}% der nicht eingesammelten Produktion vor aktiven Frachtraumgrenzen.",
    /**
     * THE SAME RULE WITHOUT THE HALF THAT CANNOT APPLY. A shield is a structure on
     * a world; a legend that names one out at a rendezvous is describing a
     * condition the reader could never have met or failed.
     */
    resultDecisivePirate:
      "ENTSCHEIDEND · kein Pirat kämpft weiter · {{decisiveLoot}}% des Horts vor aktiven Frachtraumgrenzen. Nur ein tatsächlich zerstörtes Schiff kann erbeutet werden.",
    resultPartial:
      "TEILERFOLG · mindestens {{threshold}}% des Verteidigungswerts zerstört oder geflohen · {{partialLoot}}% des ungeschützten Vorrats und {{partialBuffer}}% der nicht eingesammelten Produktion vor aktiven Frachtraumgrenzen.",
    resultRepelled:
      "ABGEWEHRT · weniger als {{threshold}}% des Verteidigungswerts zerstört oder geflohen · keine Beute.",
    round: 'Runde {{round}}',
    fire: '1 · Gleichzeitiges Feuer',
    fireNote: 'Beide Seiten schießen, bevor die Verluste beseitigt sind. Eine in dieser Runde zerstörte Einheit feuert immer noch.',
    yourShot: 'Dein Schuss',
    theirShot: 'Ihr Schuss',
    shotChange: 'Schusswechsel',
    positivePercent: '+{{amount}}%',
    negativePercent: '−{{amount}}%',
    neutralPercent: '0%',
    aegis: '2 · Aegis erhält den Treffer',
    noAegis: '2 · Keine aktive Aegis',
    shieldCharge: 'Schildladung',
    absorbed: '{{amount}} absorbiert',
    reachedHulls: 'Rümpfe erreicht',
    shieldBreaker: '{{amount}} war nur der Nullifier-Schildschaden',
    noAegisNote: 'Nichts hat den Treffer abgefangen; Die gesamte {{amount}}-Angriffskraft erreichte die verteidigenden Rümpfe.',
    /** The same step, in open space: there is no world here and so no structure. */
    openSpace: '2 · Nichts zwischen den Geschützen und den Rümpfen',
    openSpaceNote:
      'Ein Rendezvous hat keine Welt und keine Struktur, um einen Treffer abzufangen; Die gesamte {{amount}}-Angriffskraft erreichte die Besatzung.',
    losses: '3 · Verluste verlassen die Schlacht',
  },
  /** The three outcomes the whole combat model produces. */
  gradeDecisive: 'DECISIVE',
  gradePartial: 'PARTIAL',
  gradeRepelled: 'REPELLED',
  strategicFirstStrike: 'IMPACT',
  strategicEmpEffect: 'Die Aegis fiel auf null und regeneriert sich 1 Stunde lang nicht. Bodenverteidigungen feuern in dieser Zeit nicht und erleiden keinen Schaden.',
  strategicLoyalty: "Loyalität der Kolonie",
  strategicLoyaltyChange: "{{before}} % → {{after}} %",
  strategicLoyaltyNext_one: "Der nächste Treffer bringt die Kolonie zu Fall.",
  strategicLoyaltyNext_other: "Noch {{count}} Treffer in Folge bringen die Kolonie zu Fall.",
  strategicSecededAttacker: "Die Kolonie ist abgefallen und neutral geworden – sie gehört jetzt niemandem.",
  strategicSecededDefender: "Deine Kolonie ist abgefallen und neutral geworden.",
  strategicSecededShort: "Kolonie abgefallen",
  strategicCaptured: 'CAPTURED',
  strategicIneffective: 'INEFFECTIVE',
  strategicIntercepted: 'INTERCEPTED',
  radiationYouAttacked: "Deine Strahlungsbombe traf auf ",
  radiationAttackedBy: "Strahlungsbombe von ",
  strategicYouAttacked: 'Dein Todesstern im Visier',
  strategicAttackedBy: 'Todesstern gesendet von',
  strategicDestroyedInFlight: 'Todesstern im Flug zerstört',
  strategicRadarTrigger: 'Die Zielwelt griff es an, nachdem es den Radar-L3+-Abfangring überquert hatte.',
  strategicTelescopeTrigger: 'Der Verteidiger hat es angegriffen, nachdem eine ihrer Welten es durch die Sicht des Teleskops identifiziert hatte.',
  strategicTotalDamage: 'Gesamter zerstörter Wert',
  strategicShieldLost: 'Schild zerstört',
  strategicResourcesLost: 'Ressourcen zerstört',
  strategicOrdersLost: 'Arbeit in der Warteschlange zerstört',
  strategicResourceBreakdown: 'Ressourcen zerstört',
  strategicNoFleetLost: 'Keine stationierte Flotte oder Bodenverteidigung wurde zerstört.',
  strategicLevelLosses: 'Level verloren',
  strategicNoLevelLoss: 'Es ging keine Gebäude- oder Instrumentenebene verloren.',
  strategicDestroyedOrders: 'Bau zerstört',
  strategicNoOrdersLost: 'Es wurde kein aktiver Bauauftrag vernichtet.',

  /** A world nobody holds. There is no commander to name. */
  neutralHolder: 'eine nicht beanspruchte Welt',

  /**
   * WHAT THE STAMP AT THE TOP OF THE REPORT ACTUALLY MEANS.
   *
   * The grade sets the loot share and how long the works stay down, so it is the
   * most consequential word on the surface — and nothing in the game had ever said
   * what separates the three.
   *
   * IT IS SAID WITHOUT JARGON AND FROM THE READER'S SIDE, and both halves of that
   * were got wrong first. "More than 42% of the DEFENCE VALUE was destroyed" is a
   * combat model talking to itself: `defenceValue` is an internal quantity, the
   * percentage is a threshold nobody can act on, and the sentence is written from
   * nobody's point of view — so the commander who had just been raided read a
   * neutral description of their own losses. A player should finish this line
   * knowing what happened to THEM and why the haul was the size it was.
   */
  why: {
    attacking: {
      DECISIVE: "Alle verteidigenden Einheiten wurden zerstört oder zogen sich zurück. Verfügbare Beute steht nur noch anwesenden Schiffen offen.",
      DECISIVE_WIPED: "Alle verteidigenden Einheiten wurden zerstört oder zogen sich zurück. Kein angreifendes Schiff überlebte, um Beute zu tragen.",
      DECISIVE_WITHOUT_SHIELD: "Alle verteidigenden Einheiten wurden zerstört oder zogen sich zurück. Verfügbare Beute steht nur noch anwesenden Schiffen offen.",
      WALKOVER: 'Hier standen keine verteidigenden Einheiten; die verfügbare Beute stand deiner Flotte offen.',
      PARTIAL: "Genug Verteidigungswert wurde zerstört oder zog sich zurück. Ein Teil der Beute wurde freigegeben.",
      PARTIAL_WIPED: "Genug Verteidigungswert wurde zerstört oder zog sich für einen Teilerfolg zurück. Kein angreifendes Schiff überlebte, um Beute zu tragen.",
      REPELLED: "Zerstörte oder geflohene Einheiten erreichten nicht {{threshold}}% des anfänglichen Verteidigungswerts. Der Angriff wurde abgewehrt.",
    },
    defending: {
      DECISIVE: "Alle verteidigenden Einheiten wurden zerstört oder zogen sich zurück. Verfügbare Beute steht nur noch anwesenden Schiffen offen.",
      DECISIVE_WITHOUT_SHIELD: "Alle verteidigenden Einheiten wurden zerstört oder zogen sich zurück. Verfügbare Beute steht nur noch anwesenden Schiffen offen.",
      DECISIVE_WIPED: "Alle verteidigenden Einheiten wurden zerstört oder zogen sich zurück. Kein angreifendes Schiff überlebte, um Beute zu tragen.",
      WALKOVER: 'Auf deiner Welt standen keine verteidigenden Einheiten, daher stand die verfügbare Beute den Plünderern offen.',
      PARTIAL: "Genug Verteidigungswert wurde zerstört oder zog sich zurück. Ein Teil der Beute wurde freigegeben.",
      PARTIAL_WIPED: "Genug Verteidigungswert wurde zerstört oder zog sich für einen Teilerfolg zurück. Kein angreifendes Schiff überlebte, um Beute zu tragen.",
      REPELLED: 'Deine Verteidigung hat gehalten. Sie sind nicht durchgekommen und haben nichts mitgenommen.',
    },
  },

  /** Everything a battle did beyond the loot line, each said only when true. */
  effects: {
    heading: 'Was es bewirkt hat',
    admiralYours: 'Dein Kommandantenschiff begleitete die Flotte: {{ship}} {{level}}. Es feuerte nie und wurde nie getroffen.',
    admiralHeld: 'Dein Kommandantenschiff begleitete die Flotte: {{ship}} {{level}}. Die Flotte hält das Monument; das Schiff flog allein heim.',
    admiralRepair: 'Dein Kommandantenschiff begleitete die Flotte: {{ship}} {{level}}. Die Schlacht ging verloren, es kommt {{minutes}} Min. in die Reparatur.',
    admiralRaider: 'Das Kommandantenschiff des Angreifers begleitete die Flotte: {{ship}} {{level}}. Es gibt einen Bonus und wird nie getroffen.',
    admiralDefence: 'Ein Kommandantenschiff stand bei der Verteidigung: {{ship}} {{level}}. Es gibt einen Bonus und wird nie getroffen.',
    shieldTheirs: 'Ihr Schild absorbierte {{amount}} Schaden, bevor etwas den Rumpf erreichte.',
    shieldYours: 'Dein Schild hat {{amount}} Schaden absorbiert, bevor irgendetwas den Rumpf erreicht hat.',
    cargoLimited:
      'Deine Laderäume waren voll. Auf dieser Welt gab es mehr, als du tragen konntest – bring Kurier-, Wanderer-, Atlas- oder Argosy-Transporter mit.',
    salvaged_one: '{{count}} wurde nach der Schlacht aus seinen eigenen Trümmern wieder aufgebaut.',
    salvaged_other: '{{count}} Bodengeschütze wurden nach der Schlacht aus ihren eigenen Trümmern wieder aufgebaut.',
    worksTheirs: 'Ihre Werke sind für {{duration}} offline. Dort wird nichts produziert.',
    worksYours: 'Deine Werke wurden für {{duration}} lahmgelegt.',
    /** The defender's copy of what the raider's collectors lifted. D200. */
    salvageTheirs: 'Ihre Müllsammler hoben {{amount}} des Wracks auf, bevor es treiben konnte.',
    /** Koloni arızaları: what a heavy defeat broke. Defender only. */
    /** Taktik geri çekilme. Verteidiger: was abhob und was der Start verbrannte, oder warum nicht. */
    escaped_one: "Dein Schiff ist vor dem Kampf abgehoben (−{{fuel}} Deuterium): Der Angriff überwältigte deine Verteidigungslinie.",
    escaped_other: "Deine {{count}} Schiffe sind vor dem Kampf abgehoben (−{{fuel}} Deuterium): Der Angriff überwältigte deine Verteidigungslinie.",
    escapedSupport_one: '{{count}} Schiff deines Clans hob kostenlos mit deinen ab.',
    escapedSupport_other: '{{count}} Schiffe deines Clans hoben kostenlos mit deinen ab.',
    stranded: 'Deine Schiffe wären abgehoben, doch der Tank reichte nicht: {{fuel}} Deuterium nötig, {{available}} vorhanden.',
    /** Angreifer: die Linie leerte sich vor dem Angriff; nichts über ihren Inhalt. */
    fled: "Ihre Schiffe sind vor dem Kampf abgehoben: Eine überwältigte Linie, die vernichtet würde, zieht sich zurück, wenn der Tank reicht.",
    colonyFaults: 'Auf {{planet}} durch diese Niederlage gebrochen: {{faults}}.',
    /**
     * Recovery shield, defender only: the NET loss of the lookback at this battle, in
     * hours of the reader's own production, against the bar. Owner instruction, 2026-09-18.
     */
    recoveryProgress:
      'Wiederherstellungsschild: {{hours}} von {{bar}} h deiner Produktion in den letzten {{window}} h netto verloren. Erreiche {{bar}}, und niemand kann dich {{shield}} h lang überfallen; Gewinne aus deinen eigenen Überfällen werden abgezogen.',
    recoveryEarned:
      'Diese Niederlage brachte dir einen Wiederherstellungsschild für {{shield}} h: {{hours}} h deiner Produktion gingen in den letzten {{window}} h netto verloren.',
    recoveryRefused:
      '{{hours}} h deiner Produktion sind in den letzten {{window}} h netto verloren gegangen – über der Grenze von {{bar}} h, aber solange dein eigener Überfall unterwegs ist, gibt es keinen Schild.',
    wreck: '{{amount}} im Wrack treibt über {{planet}}. Jeder kann hingehen und es mitnehmen.',
    /** The same field, read from the world it is drifting over. */
    clanPurse: 'Siegesbeute: {{amounts}} gingen in die Clankasse.',
    wreckYours: '{{amount}} in Trümmern treiben in deinem eigenen Orbit. Jeder kann sie holen – auch du.',
    /** No orbit to name: the field sits at the rendezvous, in open space. */
    wreckVoid:
      '{{amount}} in Trümmern treiben am Treffpunkt im offenen Raum. Schick einen Prospektor – das kann auch jeder andere, der es gesehen hat.',
  },

  /** The caller's own board: what went in, what died, what was standing after. */
  force: {
    /** Screen-reader only: the bar is the picture, this is what it says. */
    reading: '{{sent}} eingegangen, {{lost}} verloren, {{left}} übrig',
    hull: 'Rumpf',
    /** The attacker chose to send it; the defender simply had it there. */
    sent: 'Gesendet',
    held: 'Hatte',
    lost: 'Verloren',
    left: 'Links',
    rebuilt: 'Neu erstellt',
    start: 'Am Anfang',
    arrived: 'Angekommen',
    rebuiltNote: '{{count}} zerstörte Bodengeschütze wurden nach der Schlacht wieder aufgebaut; in die Restzählung einbezogen.',
    groundType: 'Bodengeschütz · kann nicht fliegen',
    supportType: 'Unterstützungsschiff · kann nicht schießen',
    combatType: 'Kampfschiff',
    summary: '{{brought}} in den Kampf · {{lost}} zerstört · {{left}} steht',
  },
  /** Whose casualties. Both sides fly Darts, so colour alone cannot say it. */
  roundTheirs: 'Sie',
  roundYours: 'Du',
  roundNoLosses: 'Keine Seite hat in dieser Runde eine Einheit verloren.',
  roundStanding: {
    unknownOwn: 'Dieser Bericht hat keine Startzahlen; deine verbleibenden Einheiten lassen sich nicht berechnen.',
    heading: 'Deine Seite nach Runde {{round}}',
    enemyHeading: 'Angreifende Flotte nach Runde {{round}}',
    summary: '{{combat}} feuerfähige Einheiten · {{support}} unbewaffnete Unterstützungsschiffe',
    supportExposed: 'Unterstützungsschiffe können nicht schießen. Es bleiben keine Kampfeinheiten übrig, um sie zu schützen.',
    noneLeft: 'Du hast keine Einheiten mehr, um weiterzukämpfen.',
    unknownEnemy: 'Der verbleibende Zählerstand des Gegners wird ausgeblendet. Die oben genannten feindlichen Verluste beziehen sich nicht auf die gesamte Flotte.',
  },
} as const;

/** One telescope reading, rendered as certainty. */
export const clarity = {
  barsLabel: 'Klarheit {{state}}',
  stateFull: 'voll',
  stateClear: 'klar',
  stateIntermittent: 'intermittierend',
  stateDegraded: 'verschlechtert',
  stateBlind: 'Rollo',
  unreadable: 'UNREADABLE',
  fleetHome: 'FLOTTENHAUS',
  fleetAway: 'FLOTTE WEG',
  backIn: '· zurück in {{minutes}}m',
  unwatched: 'keine Überwachung zugewiesen',
} as const;

/** What you know about another world, and how you know it. */
export const dossier = {
  /* The E2 target dossier (docs/ui-v2/gozlemevi.md), in the mock's words. */
  page: {
    peekWing: "dein Geschwader {{value}}",
    peekDefence: "Verteidigung {{band}}",
    peekDefenceUnknown: "Verteidigung unbekannt",
    rival: "Rivale {{n}}",
    range: "Distanz {{d}}",
    flight: "Frühestens {{time}}",
    unreachable: "Unerreichbar",
    known: "Bekannt {{have}}/{{total}}",
    lookNone: "Noch keine Sonde hat hineingesehen",
    lookProbe: "Sondenbericht",
    shape: "Gelesene Zusammensetzung",
    shareUnread: "ungelesen",
    lootRow: "{{label}}: {{band}} · dein Laderaum {{cargo}}",
    others: "Weitere Messwerte",
    wing: "Dein Geschwader daheim",
    value: "Wert",
    power: "Stärke",
    loot: "Beute",
    lootTag: "Schätzung",
    lootMeaning: "Was ein klarer Sieg mitnehmen könnte, laut Sonde – der Anteil des Speichers ist schon abgezogen.",
    lootPartial: "Teilsieg",
    lootHold: "Dein Laderaum {{cargo}}",
    lootShort: "Dein Laderaum fasst {{cargo}}; das meiste bliebe zurück.",
    colony: "Kolonie",
    colonyRule: "Ein klarer Sieg nimmt {{decisive}} Loyalität, ein Teilsieg {{partial}}. Bei null wird die Kolonie mit Gebäuden und Vorrat neutral – wer zuerst landet, nimmt sie.",
  },
  sourcePublic: 'Öffentlich',
  sourceTelescope: 'Teleskop',
  sourceProbe: '-Sonde',
  sourceBattle: 'Kampfbericht',

  confidencePrecise: 'präzise',
  confidenceGood: 'gut',
  confidenceRough: 'grob',
  confidenceVague: 'vage',

  ownerLabel: 'Gehalten von',
  ownerNote: 'Kostenlos für alle, die ganze Saison über.',
  ownerRecordNote: 'Wessen Flagge deine Sonde gefunden hat. Die Welt kann seitdem den Besitzer gewechselt haben.',

  developmentLabel: 'Entwicklung',
  developmentValue: 'Stufe {{tier}}',
  developmentVersus: 'Stufe {{tier}} · du {{mine}}',
  developmentBandNote:
    "Überfälle und Todesstern-Angriffe sind nur zwischen Kommandanten erlaubt, die höchstens eine Stufe auseinanderliegen; gezählt wird jeweils die am weitesten entwickelte Welt. Deine ist Stufe {{mine}}, du erreichst also die Stufen {{low}}–{{high}}. Dies ist vielleicht nicht ihre am weitesten entwickelte Welt. Ist einer der Kommandanten auf Stufe 1–3, darf jeder einen einzelnen Überfall auf den anderen senden und muss danach 12 Stunden ab dem Kampf warten. Ein anfliegender Überfall reserviert dieses Recht; ein Rückruf startet keine Wartezeit. Todessterne und gemeinsame Clanoperationen sind ausgenommen.",

  hardwareLabel: 'Satelliten im Orbit',
  hardwareNote: 'Du kannst die Hardware sehen. Was sie kann, kostet eine Sonde.',
  hardwareRecordNote: 'Was im Orbit war, als deine Sonde vorbeiflog. Möglicherweise haben sie mehr gebaut.',

  fleetLabel: 'Ihre Flotte',
  fleetUnreadable: 'Nicht lesbar',
  fleetAway: 'Nicht zu Hause',
  fleetHome: 'Startseite',
  fleetVeiledNote: 'Ihr Schleier schlägt dein Teleskop. Baue es aus oder sende stattdessen eine Sonde.',
  fleetAwayUnknownNote: 'Du kannst nicht sagen, wann sie zurückkommt. Das ist das Risiko, das du eingehst.',
  fleetAwayNote: 'Ihr Planet wird durch alles verteidigt, was sie zurückgelassen haben.',
  fleetHomeNote: 'Beobachten ist still – sie erfahren nie, dass du hinschaust.',

  fleetGapNoTelescope: 'Du hast kein Teleskop',
  fleetGapOutOfRange: 'Außerhalb der Reichweite deines Teleskops',
  fleetGapNoSlot: 'Hier ist kein Slot angegeben',
  fleetGapWhy:
    'Die wertvollste Tatsache im Spiel: Eine Flotte, die unterwegs ist, kann ihren Planeten nicht verteidigen.',
  fleetGapRange: 'erreicht {{reach}}; Diese Welt ist {{distance}} entfernt',
  fleetGapSlots: 'Alle {{count}}-Slots sind belegt – einer muss verschoben werden',

  /**
   * THE LABEL FOLLOWS THE NUMBER. The probe reports what a raid could TAKE now —
   * `raidableStock` — rather than the whole store, so "Resources held" would be
   * naming a different quantity than the one printed under it.
   */
  stockLabel: 'Jetzt überfallbar',
  stockNote: 'Was ein entscheidender Überfall mitnehmen könnte. Der Tresorboden ist nicht enthalten, und deine eigenen Laderäume können es weiter begrenzen.',
  stockCaught: 'Ihr Radar hat die Sonde erfasst – sie wissen, dass jemand hingesehen hat.',
  stockClean: 'Die Sonde gelangte unbemerkt rein und raus.',
  /** The one force unit, D199 — what the hulls and guns that can fire cost. */
  defenceLabel: 'Wert der bewaffneten Einheit',
  defenceNote: 'Ressourcenkosten für das Abfeuern von Schiffen und Bodengeschützen, wenn die Sonde vorbeikam. Kein Angriffsschaden; ausgenommen sind der Schild und unbewaffnete Schiffe.',
  defenceRatio: 'Über ×{{ratio}}, was auf {{world}} steht.',
  shapeLabel: 'Form der Wand',
  shapeNote: 'Nach Wert, was feuern kann. Mehr als die Hälfte ist eine Mehrheit.',
  shapeUnread: 'Nicht gelesen',
  shapeUnreadNote: 'Ihr Schleier ist stärker als der der Werft, die die Sonde geschickt hat.',
  shapeRangesNote: "Nach Wert dessen, was feuern kann. Jeder Anteil ist ein Bereich; der wahre Anteil liegt darin.",
  shieldLabel: 'Schildladung',
  shieldNote: 'Nimmt das Feuer eines Überfalls auf, bevor es eine Hülle tut, und füllt sich im Laufe der Stunden wieder auf.',
  unarmedLabel: 'Unbewaffnet in der Reihe',
  unarmedNote: 'Sie feuern nichts ab, und ein sauberer Schwung muss immer noch jeden versenken.',
  shipsLabel: 'Schiffe gezählt',
  shipsAllHome: 'Alles, was sie besaßen, war ihr Zuhause.',
  shipsSomeOut: 'Einige ihrer Schiffe waren unterwegs.',

  /**
   * THE FOUR READINGS THE PROBE ALWAYS TOOK AND NOTHING EVER PRINTED.
   *
   * Each one names WHEN it was true rather than asserting it now, because all
   * four are frozen at the look. The dossier prints the age beside them.
   */
  /**
   * THE FUEL SHARE OF THE BAND ABOVE, NOT THE TANK. D166.
   *
   * It used to read the whole store while sitting directly under "Raidable now",
   * so the one deuterium figure on the screen measured a different quantity from
   * every other number beside it. Both come off `computeLoot` now, and the label
   * says which question this answers.
   */
  deuteriumLabel: 'Übergreifbares Deuterium',
  deuteriumNote: 'Der Treibstoffanteil der oben genannten Bande – was ein entscheidender Angriff erbeuten könnte.',
  strategicLabel: 'Strategische Waffe',
  strategicReady: 'Bewaffnet und bereit',
  strategicBuilding: 'Im Aufbau',
  strategicUnknown: 'Etwas auf dem Pad',
  strategicNote: 'Wird auf dem Pad angezeigt, als die Sonde vorbeikam. Möglicherweise ist es seitdem geflogen.',
  strategicUnknownNote: 'Die Sonde war zu grob, um zu sagen, wie weit sie entfernt ist.',
  interceptorLabel: 'Strategische Verteidigung',
  interceptorCount_one: "{{count}} Ladung bereit",
  interceptorCount_other: "{{count}} Ladungen bereit",
  interceptorCountNote: "Eine Ladung zerstört einen Todesstern. Kommen {{needed}} gleichzeitig an, kommt einer durch. Seitdem kann nachgeladen worden sein.",
  interceptorEmpty: "Keine Ladung",
  interceptorEmptyNote: 'Nichts hier hält eine strategische Waffe auf. Möglicherweise haben sie seitdem einen geladen.',
  loyaltyLabel: "Loyalität der Kolonie",
  loyaltyValue: "{{value}} %",
  loyaltyNote_one: "Ein Todesstern kostet {{loss}} Loyalität pro Treffer. Ein Treffer würde diese Kolonie zu Fall bringen.",
  loyaltyNote_other: "Ein Todesstern kostet {{loss}} Loyalität pro Treffer. {{count}} Treffer in Folge würden diese Kolonie zu Fall bringen.",
  doctrinesLabel: 'Kampfdoktrin',
  doctrinesNone: 'Keine recherchiert',
  doctrinesNote: 'Ihre Rümpfe kämpfen besser, als die Tabelle sagt. Das ist der Multiplikator, auf den du treffen würdest.',
  doctrinesNoneNote: 'Sie hatten nichts über ihre Hüllen untersucht, als die Sonde nachschaute.',
  researchWindowNote: "Als Fenster gemessen: Jede wahre Stufe liegt in ihrem Fenster. Höhere Stufen lassen ihre Schiffe stärker kämpfen.",

  surfaceGapLabel: 'Alles über diese Welt',
  surfaceGapMissing: 'Du hast diese Welt noch nie gesehen',
  surfaceGapWhy:
    'Du kannst nicht sehen, wem sie gehört, wie weit sie entwickelt ist oder was im Orbit ist. Eine Sonde bringt alles auf einmal zurück.',

  probeGapLabel: 'Ressourcen und Verteidigung',
  probeGapMissing: 'Du hast noch nie genau hingesehen',
  probeGapAged: 'Deine Messung dieser Welt ist veraltet',
  probeGapWhy:
    'Du setzt gleich eine Flotte auf das, was da unten ist. Eine Sonde macht aus dieser Vermutung eine Spanne.',

  compositionLabel: 'Dem Feld bekannt',
  compositionValue: 'mindestens {{fleet}}',
  compositionNote: 'Was du beim letzten Kampf zerstört hast. Möglicherweise wurden sie wieder aufgebaut.',
  compositionGapLabel: 'Was sie eigentlich fliegen',
  compositionGapMissing: 'Du hast noch nie gegen sie gekämpft',
  compositionGapWhy: 'Ein Kampfbericht ist der einzige Ort, von dem jemals eine genaue Zusammensetzung stammt.',
} as const;
