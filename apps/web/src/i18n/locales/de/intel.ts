/**
 * WHAT YOU KNOW — the intel centre, the battle reports, the clarity readout, and
 * the dossier lines the focus rail is built from.
 */

export const intel = {
  openOrbit: 'Offener Orbit',
  tabs: {
    label: 'Intel-Berichte',
  },
  coverage: {
    label: '-Abdeckung',
    blind: 'Sie können nicht in einen einzelnen Planeten sehen',
    partial_one: 'Beobachten Sie {{seen}} Ihres {{count}}-Slots',
    partial_other: 'Beobachten Sie {{seen}} Ihrer {{count}} Slots',
    full: 'In jedem Slot, den Sie haben, beobachten Sie jemanden',
    blindHint: 'Ein Teleskop ist der günstigste Weg, das zu verhindern.',
    idleHint_one: '{{count}}-Steckplatz ist inaktiv. Wählen Sie eine Welt in der Galaxie aus und richten Sie eine auf sie.',
    idleHint_other: '{{count}} Slots sind inaktiv. Wählen Sie eine Welt in der Galaxie aus und richten Sie eine auf sie.',
    scarcity_one:
      '{{neighbours}} Welten da draußen und {{count}} Auge zum Ausgeben. Das Verschieben eines Gegenstands kostet eine Abklingzeit. Wählen Sie also aus, wen.',
    scarcity_other:
      '{{neighbours}} Welten da draußen und {{count}} Augen zum Ausgeben. Das Verschieben eines Gegenstands kostet eine Abklingzeit. Wählen Sie also aus, wen.',
    oneMore: 'Telescope L{{level}} würde sich noch einen ansehen.',
    noRadar: 'Und ohne Radar können Sie eine auf Sie gerichtete Bedrohung nicht von anderen Bewegungen unterscheiden.',
  },

  watching: {
    heading: 'Zuschauen',
    slotsUsed: '{{used}}/{{total}} Slots verwendet',
    slotLabel: 'Steckplatz {{slot}}',
    slotEmpty: 'Leerlauf',
    missingNoSlot: 'Kein Slot ist auf irgendetwas gerichtet',
    missingNoTelescope: 'Sie haben kein Teleskop',
    gives: "Zeigt Ihnen den Moment an, in dem die Flotte eines Planeten abreist – die einzige Tatsache, die über jeden Überfall entscheidet.",
    costPoint: 'Wählen Sie einen Planeten in der Galaxie aus und richten Sie einen Schlitz darauf.',
    costInstall: 'Installiere eines von deinem Planetenbildschirm.',
    away: 'Ihr Planet wird durch alles verteidigt, was sie zurückgelassen haben.',
    intermittent:
      'Ein intermittierender Messwert wird bestenfalls alle zwanzig Minuten aktualisiert. Eine erneute Überprüfung führt nicht zu einer Verbesserung – die Antwort steht fest, bis sich das Fenster umdreht.',
  },

  probes: {
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
    cost: 'Schnell und günstig – {{alloy}} Legierung, {{crystal}} Kristall, und es übertrifft jedes Kriegsschiff, das Sie besitzen. Ihr Radar könnte es erfassen.',
    stock: 'Lagerbestand',
    defence: 'Wert der bewaffneten Einheit',
    ships: 'Schiffe',
    accuracyHome: '{{percent}} Genauigkeit · Flotte war zu Hause',
    accuracyOut: '{{percent}} Genauigkeit · Flotte war ausgefallen',
    estimateNote: 'Bei diesen Zahlen handelt es sich um geschätzte Bereiche. Der Wert der bewaffneten Einheit schließt den Schild und unbewaffnete Schiffe aus.',
    caught: 'Sie haben es erwischt\nDie',
    /* Two words beside the signal bars, which carry the accuracy themselves. */
    homeTag: '-Flotte war zu Hause',
    outTag: '-Flotte war außer Betrieb',
  },

  radar: {
    heading: 'Wer schaut dich an?',
    level: 'Radar L{{level}}',
    missing: 'Du hast kein Radar',
    gives:
      'Zeichnet den Kreis, in dem Sie überhaupt ein sich bewegendes Raumschiff sehen, fängt auf Sie gerichtete Sonden ab und markiert eine auf Ihre Welt gerichtete Bedrohung mit der verbleibenden Flugzeit.',
    cost: 'Jemand kann sich ein vollständiges Bild dieses Planeten machen, aber Sie werden es nie erfahren.',
    quiet: 'Nichts hat Sie gescannt. Radar L{{level}} hört zu.',
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
    /**
     * THE READING FOR SOMEBODY WHO CANNOT SEE THE RINGS. The two circles carry
     * both figures and the difference between them; this is the same fact in the
     * one form a screen reader can take.
     */
    noteFleets:
      'Radar L{{level}} unterscheidet eine auf Sie gerichtete Bedrohung in {{sense}} Einheiten, ohne Uhr. Bei {{warn}} Einheiten wird die Ankunftszeit hinzugefügt.',
    /** The merged form. One circle, both products, one sentence. */
    noteFleetsOne:
      'Radar L{{level}} zeigt das sich bewegende Raumschiff zu {{sense}} Einheiten und markiert mit seiner Ankunftszeit eine auf Ihre Welt gerichtete Bedrohung.',
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
  pirateCapturedNote:
    'Intakt aus dem Wrack einer von Ihnen zerstörten Besatzung entnommen. Es schließt sich der Garnison der Welt an, zu der Ihre Flotte zurückkehrt – auch wenn die Hangarkapazität überschritten ist – und zählt nicht als eine, die Sie gebaut haben.',
  youHeld: 'Du hast den Überfall gestoppt. Der Angreifer hat keine Ressourcen beansprucht.',
  youFell: 'Der Überfall hat Ihre Verteidigung beschädigt.',
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
    ownLosses: 'Ihre dauerhaften Verluste',
    total: 'Gesamtpunktänderung',
  },
  clansAtLaunch: 'Clans, als diese Flotte gestartet wurde',
  yourClan: 'Ihre Seite',
  theirClan: 'Ihre Seite',
  noClan: 'Kein Clan',
  verdict: {
    label: 'Kampfergebnis',
    yourForce: 'Deine Streitmacht',
    yourLosses: 'Ihre Verluste',
    sent: 'Gesendet',
    held: 'Hatte',
    total: 'Gesamt',
    lost: 'Verloren',
    returned: 'Überlebt',
    standing: 'Stehend',
    destroyed: 'Du hast zerstört',
    enemyDestroyed: 'Feindliche Einheiten zerstört',
    attackerDestroyed: 'Angreifende Schiffe zerstört',
    noneReturned: 'Keines Ihrer Schiffe hat die Schlacht überlebt.',
    someReturned: '{{count}} Ihrer Schiffe haben die Schlacht überlebt.',
    enemySurvivedNote: 'Feindliche Einheiten bleiben; ihre Zählung ist verborgen. Diese Nummer ist nur das, was Sie zerstört haben.',
    enemyUnknownNote: 'Diese Nummer ist nur das, was Sie zerstört haben; Die verbleibende Anzahl der Feinde wird ausgeblendet.',
    loot: 'Beute',
    rosterUnknown: 'Dieser Bericht hat keine Startanzahl. Die Anzahl der Überlebenden kann nicht berechnet werden.',
    walkoverSummary: 'Es waren keine Einheiten zur Verteidigung des Ziels da. Es gab keinen Kampf.',
    piratePartialSummary: 'Ein Teil der Piratenflotte war am Ende der Schlacht noch am Leben.',
    title: {
      attacking: {
        DECISIVE: 'Dein Überfall war erfolgreich',
        DECISIVE_WIPED: 'Sie haben die Verteidigung durchbrochen, aber Ihre Flotte verloren',
        PARTIAL: 'Dein Überfall war teilweise erfolgreich',
        PARTIAL_WIPED: 'Sie haben die Verteidigung beschädigt, aber Ihre Flotte verloren',
        REPELLED: 'Dein Überfall wurde abgewehrt',
      },
      defending: {
        DECISIVE: 'Ihre Verteidigung wurde verletzt',
        PARTIAL: 'Ihre Verteidigung wurde teilweise verletzt',
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
        DECISIVE: 'Alle Ihre verteidigenden Einheiten wurden in dieser Schlacht zerstört.',
        PARTIAL: 'Der Angreifer hatte keinen vollständigen Erfolg: Ihre Einheiten oder Ihr Schild standen noch.',
        REPELLED: 'Ihre Verteidigung hat gehalten. Der Angreifer erbeutete keine Beute.',
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
  yours: 'Was es Sie gekostet hat',
  yoursEmpty: 'Du hast nichts verloren.',
  howItWent: 'Wie es gelaufen ist',
  reasonHeading: 'Warum dieses Ergebnis?',
  rulesToggle: 'Kampfregeln und Berechnung',
  roundCalculationToggle: 'Zeigt die Schussberechnung dieser Runde an',
  roundLossesYours: 'Ihre Einheiten zerstört',
  roundLossesTheirs: 'Feindliche Einheiten zerstört',
  roundNoCasualties: 'Keine Verluste',
  roundShield: 'Der Schild des Verteidigers absorbierte {{amount}} Schaden.',
  turningPointSupport: 'Nach Runde {{round}} hatten Sie keine feuerfähigen Einheiten. Die {{support}} verbleibenden Unterstützungsschiffe konnten nicht angreifen.',
  turningPointWiped: 'Nach Runde {{round}} wurde Ihre gesamte Streitmacht zerstört.',
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
    brokenDefenceGone: 'Der Schild ist kaputt. Auch alle verteidigenden Einheiten wurden in dieser Schlacht vernichtet.',
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
    there: 'Was Sie über den Feind erfahren haben',
    enemyForce: 'Feindliche Einheiten zu Beginn der Schlacht',
    enemyLosses: 'Was du vom Feind zerstört hast',
    incomingForce: 'Die Flotte, die dich angegriffen hat',
    who: 'Was ist mit Ihrer Truppe passiert?',
    changed: 'Beute- und Punkteänderungen',
  },
  walkoverHeading: 'Hier stand keine verteidigende Streitmacht',
  walkoverBody:
    'Hier stand weder eine Kampfflotte noch eine Bodenverteidigung. Ihre Schiffe sind angekommen, beladen und abgereist. Es gab keinen Kampf zu berichten.',
  walkoverDefendingBody:
    'Auf Ihrer Welt standen keine verteidigenden Einheiten. Die angreifende Flotte konnte die verfügbare Beute kampflos an sich nehmen.',
  /** Their board, and how far the reading goes. */
  theirBoardComplete: 'Alle Einheiten, die zu Beginn der Schlacht verteidigen',
  theirBoardCompleteNote:
    'Alle wurden in dieser Schlacht zerstört. Einige Bodengeschütze können nach der Schlacht wieder aufgebaut werden.',
  theirBoardEmptyAtStart: 'Hier standen zu Beginn keine verteidigenden Einheiten',
  theirBoardEmptyAtStartNote:
    'Es befanden sich keine Kampfschiffe oder Bodengeschütze am Ziel, daher gibt es hier keine Liste der zerstörten Einheiten.',
  theirBoardFloor: 'Nur zerstörte Einheiten',
  theirBoardFloorNote:
    'Dies ist nicht die gesamte Flotte des Feindes. Es werden nur die in dieser Schlacht zerstörten Einheiten aufgeführt. Die verbleibenden Einheiten werden hier nicht angezeigt; Senden Sie eine neue Sonde für einen Kostenvoranschlag.',
  theirBoardMissingRosterNote: 'Dieser Bericht enthält keine Startaufstellung für die angreifende Flotte. Es werden nur die Schiffe aufgelistet, die Sie zerstört haben. Hinterbliebene können nicht berechnet werden.',
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
    'Die gesamte Flotte, die auf Sie geschickt wurde, einschließlich Kampf- und Unterstützungsschiffen. In jeder Zeile ist angegeben, wie viele ankamen, zerstört wurden und blieben.',
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
    formulaHp: 'Der Schaden wird durch den Anteil des Ziels an den Gesamt-HP aufgeteilt.',
    formulaCarry: 'Eine Einheit benötigt alle HP, um zu fallen; Unvollendeter Schaden geht in die nächste Runde über.',
    formulaSupport: 'Unterstützungsschiffe bleiben geschützt, während mindestens eine Kampfeinheit auf ihrer Seite verbleibt.',
    resultHeading: 'Wie über das Ergebnis entschieden wird',
    resultDecisive:
      'ENTSCHEIDEND · jede verteidigende Einheit ist verschwunden und der Schild ist auf Null · {{decisiveLoot}} % des exponierten Bestands können vor dem Frachtlimit eingenommen werden.',
    /**
     * THE SAME RULE WITHOUT THE HALF THAT CANNOT APPLY. A shield is a structure on
     * a world; a legend that names one out at a rendezvous is describing a
     * condition the reader could never have met or failed.
     */
    resultDecisivePirate:
      'ENTSCHEIDEND · jedes Schiff der Besatzung ist verschwunden · {{decisiveLoot}} % des Horts können vor den Frachtgrenzen eingenommen werden, und nur hier kann ein Rumpf nach Hause geschleppt werden.',
    resultPartial:
      'TEILWEISE · mindestens {{threshold}} % des Wertes der verteidigenden Einheit sind zerstört · {{partialLoot}} % des ungeschützten Bestands können vor dem Frachtlimit genommen werden.',
    resultRepelled:
      'ABGEWEHRT · weniger als {{threshold}} % des Wertes der verteidigenden Einheit werden zerstört · nichts kann genommen werden.',
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
  strategicCaptured: 'CAPTURED',
  strategicIneffective: 'INEFFECTIVE',
  strategicIntercepted: 'INTERCEPTED',
  strategicYouAttacked: 'Ihr Todesstern im Visier',
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
      DECISIVE: 'Du hast alles zerstört, was es verteidigt hat, und den Schild zerbrochen, was den vollständigen Beutezug freigibt.',
      DECISIVE_WIPED: 'Du hast jede verteidigende Einheit zerstört, aber keines deiner Schiffe hat überlebt, um Beute nach Hause zu transportieren.',
      DECISIVE_WITHOUT_SHIELD: 'Du hast alles zerstört, was dich verteidigt hat, was den vollständigen Angriff eröffnet.',
      WALKOVER: 'Hier standen keine verteidigenden Einheiten; Die verfügbare Beute stand Ihrer Flotte offen.',
      PARTIAL: 'Du hast genug Schaden für einen teilweisen Erfolg verursacht, aber keinen vollständigen Erfolg. Nur ein Teil der Beute wurde verfügbar; Ohne überlebenden Laderaum kann nichts mitgenommen werden.',
      PARTIAL_WIPED: 'Du hast genug Schaden für einen Teilerfolg verursacht, aber keines deiner Schiffe hat überlebt, um Beute nach Hause zu transportieren.',
      REPELLED: 'Der Ressourcenwert der zerstörten Einheiten erreichte nicht {{threshold}} % des Startwerts aller verteidigenden Einheiten. Deshalb wurde der Überfall abgewehrt; Die Anzahl der Schiffe oder das Brechen des Schildes allein entscheiden nicht über das Ergebnis.',
    },
    defending: {
      DECISIVE: 'Alle Ihre verteidigenden Einheiten fielen und der Schild brach, wodurch die verfügbare Beute den Plünderern zugänglich gemacht wurde. Die entnommene Menge hängt von ihrem verbleibenden Laderaum ab.',
      DECISIVE_WITHOUT_SHIELD: 'Alle deine verteidigenden Einheiten sind gefallen, wodurch die verfügbare Beute den Plünderern zugänglich gemacht wurde. Die entnommene Menge hängt von ihrem verbleibenden Laderaum ab.',
      DECISIVE_WIPED: 'Alle Ihre verteidigenden Einheiten fielen – und auch jedes Schiff, mit dem sie kamen. Die Beute war offen und es war nichts mehr übrig, was sie nach Hause hätte tragen können.',
      WALKOVER: 'Auf Ihrer Welt standen keine verteidigenden Einheiten, daher stand die verfügbare Beute den Plünderern offen.',
      PARTIAL: 'Der Angreifer hat genug Schaden für einen teilweisen Erfolg verursacht, aber keinen vollständigen Erfolg. Nur ein Teil der Beute wurde verfügbar.',
      PARTIAL_WIPED: 'Der Angreifer verursachte genug Schaden für einen Teilerfolg, aber keines seiner Schiffe überlebte, um ihn zu tragen. Nichts hat deine Welt verlassen.',
      REPELLED: 'Ihre Verteidigung hat gehalten. Sie haben nichts überstanden und nichts mitgenommen.',
    },
  },

  /** Everything a battle did beyond the loot line, each said only when true. */
  effects: {
    heading: 'Was es bewirkt hat',
    shieldTheirs: 'Ihr Schild absorbierte {{amount}} Schaden, bevor etwas den Rumpf erreichte.',
    shieldYours: 'Dein Schild hat {{amount}} Schaden absorbiert, bevor irgendetwas den Rumpf erreicht hat.',
    cargoLimited:
      'Ihre Laderäume waren voll. Es gab mehr auf dieser Welt, als man transportieren konnte – bringen Sie Kurier-, Wanderer-, Atlas- oder Argosy-Transporte mit.\nDas Bodengeschütz',
    salvaged_one: '{{count}} wurde nach der Schlacht aus seinen eigenen Trümmern wieder aufgebaut.',
    salvaged_other: '{{count}} Bodengeschütze wurden nach der Schlacht aus ihren eigenen Trümmern wieder aufgebaut.',
    worksTheirs: 'Ihre Werke sind für {{duration}} offline. Dort wird nichts produziert.',
    worksYours: 'Ihre Werke wurden für {{duration}} offline geschaltet.',
    /** The defender's copy of what the raider's collectors lifted. D200. */
    salvageTheirs: 'Ihre Müllsammler hoben {{amount}} des Wracks auf, bevor es treiben konnte.',
    /** Koloni arızaları: what a heavy defeat broke. Defender only. */
    /** Taktik geri çekilme. Verteidiger: was abhob und was der Start verbrannte, oder warum nicht. */
    escaped_one: 'Dein Schiff ist vor dem Kampf abgehoben (−{{fuel}} Deuterium): der Angriff war deiner Linie drei zu eins überlegen.',
    escaped_other: 'Deine {{count}} Schiffe sind vor dem Kampf abgehoben (−{{fuel}} Deuterium): der Angriff war deiner Linie drei zu eins überlegen.',
    stranded: 'Deine Schiffe wären abgehoben, doch der Tank reichte nicht: {{fuel}} Deuterium nötig, {{available}} vorhanden.',
    /** Angreifer: die Linie leerte sich vor dem Angriff; nichts über ihren Inhalt. */
    fled: 'Ihre Schiffe sind vor dem Kampf abgehoben: eine drei zu eins unterlegene Linie, die ausgelöscht würde, flieht, wenn ihr Tank es bezahlt.',
    colonyFaults: 'Auf {{planet}} durch diese Niederlage gebrochen: {{faults}}.',
    /**
     * Recovery shield, defender only: the NET loss of the lookback at this battle, in
     * hours of the reader's own production, against the bar. Owner instruction, 2026-09-18.
     */
    recoveryProgress:
      'Wiederherstellungsschild: {{hours}} von {{bar}} h Ihrer netto verlorenen Produktion in den letzten {{window}} h. Erreiche {{bar}} und niemand kann dich für {{shield}} h überfallen; Gewinne aus eigenen Überfalls werden abgezogen.',
    recoveryEarned:
      'Diese Niederlage brachte Ihnen einen {{shield}} h Wiederherstellungsschild ein: {{hours}} h Ihrer Nettoproduktion gingen in den letzten {{window}} h verloren.',
    recoveryRefused:
      '{{hours}} h Ihrer Produktion sind in den letzten {{window}} h netto verloren gegangen – über die {{bar}} h-Leiste hinaus, aber es wird kein Schild gewährt, während Ihr eigener Überfall in der Luft ist.',
    wreck: '{{amount}} im Wrack treibt über {{planet}}. Jeder kann hingehen und es mitnehmen.',
    /** The same field, read from the world it is drifting over. */
    wreckYours: '{{amount}} in Trümmern treibt in Ihrer eigenen Umlaufbahn. Jeder kann es nehmen – auch Sie.',
    /** No orbit to name: the field sits at the rendezvous, in open space. */
    wreckVoid:
      '{{amount}} in Trümmern treibt beim Rendezvous im offenen Raum. Schicken Sie einen Prospektor – und das kann auch jeder andere tun, der das gesehen hat.',
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
    unknownOwn: 'Dieser Bericht hat keine Startzählungen; Ihre verbleibenden Einheiten können nicht berechnet werden.',
    heading: 'Deine Seite nach Runde {{round}}',
    enemyHeading: 'Angreifende Flotte nach Runde {{round}}',
    summary: '{{combat}} feuerfähige Einheiten · {{support}} unbewaffnete Unterstützungsschiffe',
    supportExposed: 'Unterstützungsschiffe können nicht schießen. Es bleiben keine Kampfeinheiten übrig, um sie zu schützen.',
    noneLeft: 'Sie haben keine Einheiten mehr, um weiter zu kämpfen.',
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
  ownerRecordNote: 'Wessen Flagge Ihre Sonde gefunden hat. Möglicherweise hat es seitdem den Besitzer gewechselt.',

  developmentLabel: 'Entwicklung',
  developmentValue: 'Stufe {{tier}}',

  hardwareLabel: 'Satelliten im Orbit',
  hardwareNote: 'Sie können die Hardware sehen. Was es kann, kostet eine Sonde.',
  hardwareRecordNote: 'Was war im Orbit, als Ihre Sonde vorbeiflog? Möglicherweise haben sie mehr gebaut.',

  fleetLabel: 'Ihre Flotte',
  fleetUnreadable: 'Nicht lesbar',
  fleetAway: 'Nicht zu Hause',
  fleetHome: 'Startseite',
  fleetVeiledNote: 'Ihr Schleier schlägt Ihr Teleskop. Erhöhen Sie es oder senden Sie stattdessen eine Sonde.',
  fleetAwayUnknownNote: 'Sie können nicht sagen, wann es zurückkommt. Das ist das Risiko, das Sie eingehen.',
  fleetAwayNote: 'Ihr Planet wird durch alles verteidigt, was sie zurückgelassen haben.',
  fleetHomeNote: 'Zuschauen ist still – ihnen wird nie gesagt, dass Sie hinschauen.',

  fleetGapNoTelescope: 'Sie haben kein Teleskop',
  fleetGapOutOfRange: 'Außerhalb der Reichweite Ihres Teleskops',
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
  stockNote: 'Was für ein entscheidender Überfall das sein könnte. Der Tresorboden befindet sich nicht darin und Ihre eigenen Laderäume könnten ihn noch weiter verschließen.',
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
  interceptorLoaded: 'Ladung geladen',
  interceptorEmpty: 'Keine Gebühr',
  interceptorLoadedNote:
    'Eine auf diese Welt geschickte strategische Waffe würde in ihrem Radarkreis zerstört werden. Eine Ladung stoppt einen Schlag.',
  interceptorEmptyNote: 'Nichts hier hält eine strategische Waffe auf. Möglicherweise haben sie seitdem einen geladen.',
  doctrinesLabel: 'Kampfdoktrin',
  doctrinesNone: 'Keine recherchiert',
  doctrinesNote: 'Ihre Rümpfe kämpfen besser, als die Tabelle sagt. Dies ist der Multiplikator, den Sie erreichen würden.',
  doctrinesNoneNote: 'Sie hatten nichts über ihre Hüllen untersucht, als die Sonde nachschaute.',

  surfaceGapLabel: 'Alles über diese Welt',
  surfaceGapMissing: 'Du hast diese Welt noch nie gesehen',
  surfaceGapWhy:
    'Sie können nicht sehen, wer es hält, wie weit sie entfernt sind oder was sich im Orbit befindet. Eine Sonde bringt alles auf einmal zurück.',

  probeGapLabel: 'Ressourcen und Verteidigung',
  probeGapMissing: 'Du hast noch nie genau hingesehen',
  probeGapAged: 'Ihre Interpretation dieser Welt ist veraltet',
  probeGapWhy:
    'Sie sind dabei, eine Flotte auf das zu setzen, was da unten ist. Eine Sonde wandelt diese Vermutung in eine Spanne um.',

  compositionLabel: 'Dem Feld bekannt',
  compositionValue: 'mindestens {{fleet}}',
  compositionNote: 'Was du beim letzten Kampf zerstört hast. Möglicherweise wurden sie wieder aufgebaut.',
  compositionGapLabel: 'Was sie eigentlich fliegen',
  compositionGapMissing: 'Du hast noch nie gegen sie gekämpft',
  compositionGapWhy: 'Ein Kampfbericht ist der einzige Ort, von dem jemals eine genaue Zusammensetzung stammt.',
} as const;
