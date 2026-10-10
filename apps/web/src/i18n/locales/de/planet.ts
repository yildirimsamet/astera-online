/**
 * YOUR OWN WORLD — the four decision groups, the rows they are made of, the
 * detail sheet behind each row, and the launch planner.
 */

export const planet = {
  abandon: {
    "action": "Kolonie aufgeben",
    "title": "Diese Kolonie aufgeben?",
    "cancel": "Kolonie behalten",
    "confirm": "Ja, Kolonie aufgeben",
    "pending": "Wird aufgegeben…",
    "irreversible": "Diese Kolonie wird neutral und gibt einen Kolonieplatz frei. Du kannst diese Aktion nicht rückgängig machen.",
    "keeps": "Gebäude, Satelliten, Ressourcen und Bodenverteidigung bleiben auf dem Planeten. Bereite Todessterne und Abfangladungen bleiben ebenfalls dort.",
    "ships": "Stationierte Schiffe und Schiffe in Reparatur werden auf deine Hauptstadt verlegt. Ihr Schaden bleibt erhalten.",
    "queue": "Bau-, Produktions- und Reparaturaufträge werden ohne Erstattung abgebrochen.",
    "rule": "Alle Flüge und Missionen dieser Kolonie müssen zuerst abgeschlossen sein.",
    "checking": "Aktive Missionen werden geprüft…",
    "blocked": "Du kannst diese Kolonie noch nicht aufgeben",
    "recheck": "Erneut prüfen",
    "checkFailed": "Aktive Missionen konnten nicht geprüft werden. Prüfe erneut, wenn die Verbindung wieder verfügbar ist.",
    "success": "Du hast {{planet}} aufgegeben · die Kolonie ist jetzt neutral",
    "reasons": {
      "FLIGHT": "Ein Flug mit Verbindung zu dieser Kolonie ist noch aktiv. Warte, bis er abgeschlossen ist.",
      "MINING": "Eine Bergbau- oder Bergungsmission ist noch aktiv. Warte auf die Rückkehr der Schiffe.",
      "PIRATE": "Ein Piratenangriff ist noch aktiv. Warte auf die Rückkehr der Flotte.",
      "TRADE": "Eine Handelsmission ist noch aktiv. Warte auf die Rückkehr der Schiffe.",
      "CONVOY": "Eine intergalaktische Konvoimission ist noch aktiv. Warte auf die Rückkehr der Flotte.",
      "CLAN_WAR": "Schiffe dieser Kolonie nehmen an einer gemeinsamen Clanoperation teil. Rufe sie zurück oder warte auf ihre Rückkehr.",
      "CLAN_SUPPORT": "Unterstützungsschiffe fliegen, sind stationiert oder kehren zurück. Rufe gesendete Unterstützung zurück oder schicke stationierte Unterstützung heim. Warte dann auf die Landung.",
      "MONUMENT": "Eine Monumentflotte oder Sonde dieser Kolonie ist unterwegs. Rufe die Flotte zurück oder warte auf die Sonde.",
      "STRATEGIC": "Strategische Produktion, ein Angriff oder ein Abfangvorgang ist noch aktiv. Warte auf den Abschluss.",
      "AWAY_SHIPS": "Einige Schiffe dieser Kolonie sind noch unterwegs. Warte, bis alle zurückkehren.",
      "RECOVERY": "Diese Kolonie erholt sich oder steht unter Besatzungsschutz. Warte auf das Ende dieses Zeitraums.",
      "SECESSION": "Die Loyalität dieser Kolonie ist auf null gefallen und sie löst sich ab. Warte auf die Aktualisierung des Besitzes."
    }
  },
  recovery: "Wiederherstellung läuft · Systeme kehren in {{duration}} zurück",
  empActive: "EMP · Aegis bei null und für {{duration}} ohne Regeneration; Bodenverteidigungen feuern nicht und erleiden keinen Schaden.",
  capacityNext: "Mit {{name}}: {{total}} pro Welt",
  /**
   * THE COUNTER TO THE THING ABOVE. T10 · T12.
   *
   * Its own block rather than a `deathStar` sub-key: they are two controls on two
   * different tabs, and the day either is reworded the other must not move with
   * it. `docs/interface.md` I1 — every requirement is a door and names itself.
   */
  interceptor: {
    eyebrow: "Antistrategische Batterie",
    tally: "{{used}} von {{total}} Ladungen geladen",
    none: "Keine Gebühr geladen",
    building: "wird geladen · {{duration}}",
    paused: "Der Ladevorgang wurde während der Wiederherstellung angehalten",
    ready: "Geladene Ladungen: {{count}}",
    noRadar: "Geladen · Radarring ist offline",
    build: "Ladung laden",
    started: "Ladung wird geladen",
    hint: "Zerstört den ersten Todesstern, der in den zeitgesteuerten Radarring eintritt oder im Sichtfeld des Teleskops identifiziert wird. Wird ausgegeben, wenn es feuert.",
    colonyHint: "Jeder Todesstern, der durchkommt, kostet diese Kolonie {{loss}} Loyalität; bei {{loss}} oder weniger fällt sie ab.",
    readyHint:
      "Bewaffnet. Es zerstört den nächsten Todesstern, der in den Radar-Abfangring eintritt oder im Sichtfeld des Teleskops identifiziert wird.",
    noRadarHint:
      "Die Ladung bleibt geladen, aber diese Welt hat keinen Radar-Abfangring. Stellen Sie Uplink und Radar 3 wieder her. Ein Teleskopblick aus einer anderen Welt kann es immer noch auslösen.",
    needRadar: "Radar L{{level}}",
    needUplink: "Uplink im Orbit",
    needOperational: "Welt betriebsbereit",
    buildTime: "{{duration}} · eine Ladung · für das Schießen aufgewendet",
    buildSecond: 'Zweite Ladung laden',
  },

  deathStar: {
    eyebrow: "Taktische EMP-Waffe",
    tally: "{{used}} von {{total}} Waffen vorhanden",
    none: "Kein Todesstern auf dieser Welt",
    building: "Gebäude · {{duration}}",
    paused: "Build wurde während der Wiederherstellung angehalten",
    ready: "Bereit zum Start",
    stock: "{{ready}} bereit · {{building}} Gebäude · {{held}}/{{capacity}}",
    build: "Build",
    started: "Der Bau des Todessterns hat begonnen",
    dangerHint: "EMP: Die Aegis fällt auf null und regeneriert sich 1 Stunde lang nicht. Bodenverteidigungen feuern in dieser Zeit nicht und erleiden keinen Schaden. Eine Kolonie verliert zudem {{loss}} Loyalität; bei {{loss}} oder weniger fällt sie ab und wird neutral.",
    readyHint:
      "Bereit: Die Aegis des Ziels fällt auf null und regeneriert sich 1 Stunde lang nicht; Bodenverteidigungen feuern nicht und erleiden keinen Schaden.",
    needCore: "Kern L{{level}}",
    needShipyard: "Werft L{{level}}",
    needOperational: "Welt betriebsbereit",
    buildTime: "{{duration}} · eine Waffe · kein Rückruf",

    needs: 'Braucht {{need}}',
  },
  tabs: {
    label: "Planetenkategorien",
    defendProblem: "Verteidigen",
    defendQuestion: "Baue hier Aegis, den Speicher und die Bodenabwehr aus.",
    orbitProblem: "Intel",
    orbitQuestion: "Erstellen Sie die Tools, die Ihnen helfen, Konkurrenten zu erkennen.",
    reachProblem: "Flotte",
    reachQuestion: "Entwickeln Sie hier Ihre Schiffe und Reichweite.",
    growProblem: "Produktion",
    growQuestion: "Erweitern Sie hier Ihre Ressourcen und Ihr Gebäudelevel-Limit.",
    tacticalProblem: "Taktisch",
    tacticalQuestion: "Taktische Werkzeuge hier bauen und verwalten.",
  },


  queue: {
    /** The end of all the work in one lane, which no screen used to carry. */
    waiting: "Wartet",
    ends: "beendet {{time}}",
    segment: "{{name}} · {{duration}}",
    cancelOne: "Abbrechen {{name}}",
    title: "Bauschlangen",
    idle: "Nichts im Bau",
    capacity: "je {{count}} Plätze",
    construction: "Konstruktion",
    yard: "Yard",
    repair: "Reparatur",
    slotFree: "Kostenlos",
    empty: "Keine Arbeit festgeschrieben",
    committing: "begeht…",
    staged: "startet, wenn es beansprucht wird",
    queued_one: "{{count}} Bestellung in der Warteschlange",
    queued_other: "{{count}} Bestellungen in der Warteschlange",
    unitsQueued_one: "{{count}} Einheit in der Warteschlange",
    unitsQueued_other: "{{count}} Einheiten in der Warteschlange",
    afterQueue: "Nach der Warteschlange",
    cancel: "Abbrechen",
    cancelling: "Stornierung…",
    refund:
      "Rückerstattung: {{alloy}} Legierung · {{crystal}} Kristall · {{deuterium}} Deuterium",
    cancelled:
      "Bestellung storniert · {{alloy}} Legierung, {{crystal}} Kristall und {{deuterium}} Deuterium zurückgegeben",

    /**
     * THE SECOND BEAT ON A CANCEL. Owner report.
     *
     * The price of cancelling was on a `title` attribute — a hover tooltip, on a
     * phone — so the half that burns was not merely unconfirmed, it was never on
     * screen at all. It leads with what is DESTROYED: a refund figure alone reads
     * as a gain, because the player is being handed resources.
     */
    confirm: {
      eyebrow: "Eine Bestellung stornieren",
      lead: "{{share}} % der Kosten dieser Bestellung werden zerstört. Der Rest kommt jetzt zurück.",
      lost: "Zerstört",
      kept: "Zurückgegeben",
      progress: "Der Fortschritt dieses Auftrags geht verloren. Ein neuer Auftrag beginnt von vorn.",
      commit: "Bestellung stornieren",
      back: "Behalte es",
    },
  },

  capacity: {
    hangarBand: "Flottenraum",
    hangarFull: "Hangar ist voll: {{used}} / {{total}} Raum ist belegt. Erweitere den Hangar, um mehr Schiffe zu bauen.",
    hullUse:
      "Jeder verwendet {{bulk}}-Speicherplatz · {{used}} / {{total}} wird nach der Warteschlange festgeschrieben.",
    full: "Kein Platz: {{used}} / {{total}} Speicherplatz ist bereits reserviert. Erhöhen Sie zunächst die entsprechende Kapazität.",
  },

  /** What each structure is for, in one line, where the row states it. */
  roles: {
    vault:
      "Bestimmt die Lagerkapazität jeder Ressource. Der kleinere Betrag aus 10 % Kapazität und 8 Stunden Produktion ist vor Raubzügen geschützt.",
    shipyard:
      "Schaltet Schiffe frei und beschleunigt Schiffe und Bodenabwehr. Verbessert die Genauigkeit und Tarnung von Sonden.",
    refinery:
      "Erhöht die stündliche Legierungsproduktion; Der Speicher wird in Stunden gemessen, sodass der Inhalt, den er enthält, mitwächst. Die meisten Gebäude und Schiffe geben dies aus.",
    extractor:
      "Erhöht die stündliche Kristallproduktion; Der Speicher wird in Stunden gemessen, sodass der Inhalt, den er enthält, mitwächst. Fortschrittliche Schiffe, Instrumente und Forschungskristalle werden ausgegeben.",
    coreCapped_one:
      "{{count}} Gebäude-Upgrade ist blockiert, bis der Kommandokern angehoben wird.",
    coreCapped_other:
      "{{count}} Gebäude-Upgrades werden blockiert, bis der Kommandokern erhöht wird.",
    coreClear:
      "Anlagen außer dem Hangar können die Befehlskern-Stufe dieser Welt nicht überschreiten. Er beschleunigt Instrumente und Satelliten außer dem Uplink.",
  },

  defend: {
    escapeMinimum: "Für den taktischen Rückzug sind hier mindestens {{minimum}} Kampfschiffe nötig · {{count}} von {{minimum}} bereit",
    strategicBand: "Strategische Verteidigung",
    strategicNote:
      "Eine Ladung zerstört den nächsten Todesstern, der von Radar 3 entdeckt oder im Visier des Teleskops identifiziert wurde. Die Ladung wird verbraucht, wenn es abgefeuert wird.",
    /** Taktik geri çekilme: die eigene Schwelle des Verteidigers und der Treibstoff dafür. */
    escapeReady:
      "Taktischer Rückzug · ein Angriff mit {{at}}+ Feuerkraft, der diese Linie auslöschen würde, findet deine Schiffe nicht mehr vor · der Start verbrennt {{fuel}} Deuterium",
    escapeShort:
      "Taktischer Rückzug · deine Schiffe würden vor {{at}}+ Feuerkraft fliehen, doch der Start braucht {{fuel}} Deuterium und der Tank hält {{stock}}",
    shieldBand: "Schild",
    shieldNote:
      "Aegis absorbiert Schaden, bevor er Ihre Einheiten erreicht, und regeneriert jede Stunde 35 % seines Maximums.",
    groundBand: "Am Boden (Kapazität erhöht sich je nach Kernstufe)",
    /* The figures moved into `CapacityBar`; the band keeps the RULE. */
    groundNote:
      "Bodengeschütze verlassen niemals die Welt. Dornen kontern Bollwerke, Harpunen Plänkler und Bastionen Lanzen.",
    thornNone:
      "Leichte Geschütze mit Vorteil gegenüber Rümpfen der Bollwerkklasse; anfällig für Rümpfe der Lanzenklasse.",
    thornStanding:
      "{{count}} steht. Stark gegen Rümpfe der Bollwerkklasse; schwach gegen Rümpfe der Lanzenklasse.",
    thornGain: "Dornen",
    harpoonNone: "Lanzen-Bodenverteidigung. Stark gegen Plänkler, schwach gegen Bollwerke.",
    harpoonStanding: "{{count}} stationiert. Stark gegen Plänkler, schwach gegen Bollwerke.",
    harpoonGain: "Harpunen",
    bastionNone:
      "Schwere Geschütze mit Vorteil gegenüber Rümpfen der Lanzenklasse; anfällig für Scharmützler.",
    bastionStanding:
      "{{count}} steht. Stark gegen Rümpfe der Lanzenklasse; schwach gegen Scharmützler. Nach dem Kampf werden 60 % der zerstörten Bodengeschütze wiederhergestellt (abgerundet).",
    groundGain: "Bodeneinheiten",
    aegisPointer: "Ein Schild ist Hardware – das <0>{{name}}</0> befindet sich im Orbit.",
  },

  orbit: {
    contextLabel: "Orbit-Netzwerk",
    networkBand: "-Verbindung",
    networkNote:
      "Der Uplink benötigt einen Socket, um das Teleskop und das Radar freizuschalten.",
    intelBand: "Planeteninstrumente",
    intelNote: "Sie gewinnen Level und verbrauchen niemals einen Orbitsockel.",
    inOrbitBand: "Im Orbit",
    inOrbitNote: "Jeder nimmt einen Slot ein. Einmal gebaut – sie haben keine Ebenen.",
    onPlanetBand: "Auf dem Planeten",
    onPlanetNote:
      "Kein Steckplatz erforderlich. Diese haben Stufen – erhöhen Sie sie so weit, wie es Ihr Kommandokern zulässt.",
    slotsFree_one: "{{count}} Slot oben noch frei\nOben sind noch",
    slotsFree_other: "{{count}} Slots frei\nDie",
    slotsNone: "-Umlaufbahn ist voll",
    slotsUsed: "{{used}}/{{total}}",
    slotsNext: "+1 am Kern L{{level}}",
    rackLabel: "Orbit-Slots",
    slotEmpty: "Leer",
    inactiveSatellite:
      "Im Besitz, aber inaktiv, bis der Kommandokern diesen Orbit-Slot wieder öffnet.",
    inactiveUplink:
      "L{{owned}} im Besitz, aber inaktiv, bis ein Uplink wieder aktiv ist.",
    inactiveCore:
      "L{{owned}} im Besitz · L{{active}} aktiv, bis der Befehlskern wiederhergestellt ist.",
    alreadyInOrbit: "bereits im Orbit",
  },

  reach: {
    orbitBand: "Operationssatelliten",
    orbitNote:
      "Ein Derrick verbessert die Prospektoren dieser Welt; Ein Beacon beschleunigt seine Angriffs- und Transferflotten. Jeder Satellit nutzt einen Orbit-Slot.",
    family: {
      OFFENSIVE: {
        label: "Offensivrümpfe",
        note: "Überfaller kaufen Geschwindigkeit und Stürmer kaufen Angriff. Die Reihen verlaufen von Ebene 1 bis Ebene 4.",
      },
      DEFENSIVE: {
        label: "Verteidigungsrümpfe",
        note: "Festungen kaufen Haltbarkeit mit Geschwindigkeit; Begleitpersonen halten mehr Flottentempo. Zeilen werden nach Ebenen ausgeführt.",
      },
      CARGO: {
        label: "Frachtrümpfe",
        note: "Unbewaffnete Transporte handeln mit Handelsroutengeschwindigkeit im Vergleich zur Laderaumkapazität und benötigen überlebende Eskorten.",
      },
      SPECIALIST: {
        label: "Spezialrümpfe",
        note: "Enge Antworten auf ein sichtbares Problem; Ihre Prämie wird für das falsche Ziel verschwendet.",
      },
    },
    frontierBand: "Grenzforschung",
    frontierNote:
      "Forschung nutzt Ihre kommandantenweite Warteschlange. Bau und Hof laufen getrennt weiter.",
    isotopeName: "Isotopenspektrometrie",
    isotopeTag: "Schaltet den Deuteriumabbau frei",
    isotopeRole:
      "Zeigt das Deuterium in Isotopengesteinen an und ermöglicht es Ihnen, Prospektoren dorthin zu schicken. Der Rücktransport gelangt ins Werk.",
    denseName: "Dichte Brennstoffzellen",
    denseTag: "Schaltet Schiffsantrieb frei",
    denseRole:
      "Fülle bei einem Überfall den Frachtraum, während am Ziel Beute zurückbleibt. Der Forschungsabschluss schaltet Schiffsantrieb frei.",
    graviticName: "Gravitische Ladungen",
    graviticTag: "Schaltet den Nullifier frei",
    graviticRole:
      "Greife für diese Forschung eine verteidigte Welt mit aktivem Aegis an. Der Schild muss mindestens {{share}} deines Schadens absorbieren. Du musst nicht gewinnen. Sie schaltet den Nullifier frei, der Schilden fünffachen Angriff zufügt.",
    gridName: "Abfanggitter",
    gridTag: "Schießt einen Todesstern ab",
    gridRole:
      "Eine geladene Ladung zerstört den nächsten Todesstern, der von Radar 3 entdeckt oder im Teleskopvisier identifiziert wird · erfordert einen Uplink",
    stockpileName: "Strategischer Vorrat",
    stockpileTag: "Behalten Sie eine zweite Waffe auf dem Pad",
    stockpileRole:
      "Ein zweiter Todesstern, gebaut nach dem ersten · die Wartezeit ist unverändert",
    waspDoctrineName: "Wespenlehre",
    lanceDoctrineName: "Lanzen-/Brecher-Doktrin",
    bulwarkDoctrineName: "Bollwerk-Doktrin",
    groundDoctrineName: "Bodenverteidigungsdoktrin",
    generalName: "Waffen und Rüstungen",
    generalTag: "Verbessert Kampf- und Frachtschiffe",
    doctrineTag: "Besserer Angriff und Panzerung",
    doctrineRole:
      "Erhöht Angriff und Rumpfstärke der Bodenverteidigung gemeinsam. Klassenverhältnisse, Bodenkapazität und Bergung bleiben unverändert.",
    yardName: "Yard-Automatisierung",
    yardTag: "Baut Schiffe schneller",
    yardRole:
      "Verkürzt die Bauzeit jedes Rumpfes · die Werft gibt immer noch die Kurve",
    holdsName: "Prospektor hält",
    holdsTag: "Bergbauschiffe transportieren mehr",
    holdsRole: "Erhöht jeden Prospektor-Laderaum und multipliziert ihn mit dem 2-fachen Kapazitätsbonus des Derrick",
    cargoName: "Frachträume",
    cargoTag: "Jeder Laderaum trägt mehr",
    cargoRole: "Erhöht Überfall-Beute, Welttransfers und Handelskonvois gleichermaßen",
    synthesisName: "Deuteriumsynthese",
    synthesisTag: "Erhöht die Raffinerie-Obergrenze",
    synthesisRole:
      "Jede Sprosse öffnet drei weitere Ebenen der Deuterium-Raffinerie auf jeder Welt, die Sie besitzen",
    researchNeedCore: "Befehlskern auf L{{level}} erhöhen",
    researchAct: "Forschung",
    researchComplete: "recherchiert",
    researchAt: "Erforschbar in {{duration}}",
    researchIsotopeFirst: "Forschungsisotopenspektrometrie zuerst",
    researchDenseFirst: "Erforscht zunächst dichte Brennstoffzellen",
    researchGraviticFirst: "Erforsche zuerst Gravitische Ladungen",
    researchWarAt: "Kriegshandlung wird in {{duration}} eröffnet",
    researchCargoInsight: "Füllen Sie Ihre Fracht in einem Überfall auf, solange Beute übrig bleibt",
    researchShieldInsight:
      "Lassen Sie eine Aegis mindestens {{share}} Ihres Schlachtzugsschadens absorbieren",
    warshipsBand: "Kriegsschiffe",
    warshipsNote: "Diese Rümpfe greifen an und verteidigen. Klassenzuordnungen bestimmen, welche Ziele sie kontern.",
    supportBand: "-Unterstützung",
    supportNote:
      "Schlepper und Läufer transportieren Raubzüge oder transportieren Fracht, können aber nicht angreifen. Sie bleiben nur so lange geschützt, wie Kampfschiffe überleben.",
    miningBand: "Bergbau",
    miningNote: "Prospektoren reisen nur zu entdeckten Asteroiden oder Trümmerfeldern und bringen ihre Beute zum Werk zurück.",
    ownedGain: "Du hast",
    hullAwayCount: "{{count}} weg",
    hullLocationCounts: "{{home}} rein · {{away}} raus",
    hullTier: "Lv{{tier}}",
    prospectorLimit: "{{owned}} / {{max}} · Grenze",
  },

  grow: {
    multiplierBand: "Produktionssatellit",
    multiplierNote:
      "Die Gießerei erhöht die Legierungs-, Kristall- und Deuteriumproduktion dieser Welt um 6 % und verbraucht einen Sockel im gemeinsamen Orbitnetzwerk.",
  },

  projectSheet: {
    frontier: "Grenzforschung",
    complete: "Forschung abgeschlossen",
    cost: "Forschungskosten",
    once: "Wird einmal in Ihrer kommandantenweiten Forschungswarteschlange platziert.",
  },

  /** Why a row cannot be pressed yet. Each is a door, so each names its fix. */
  blocked: {
    core: "Kern L{{level}}",
    uplink: "ein Uplink im Orbit",
    orbitSlot: "ein freier Orbit-Slot",
    shipyard: "Werft L{{level}}",
    research: "{{research}} {{level}}",
    requirements: "Erfordert: {{requirements}}",
    maxed: "auf höchstem Niveau",
    /** The one building with a second ceiling: its research rung. T5. */
    plantRung: "Erforschen Sie eine weitere Stufe der Deuteriumsynthese",
    queueFull: "3 Bestellungen warten bereits. Beenden oder brechen Sie einen Vorgang ab, um ihn hinzuzufügen.",
  },

  /** What a purchase says once it has landed. */
  done: {
    raised: "{{name}} ist jetzt L{{level}}",
    instrument: "{{name}} online unter L{{level}}",
    satellite: "{{name}} befindet sich im Orbit",
    built: "{{count}} × {{name}} erstellt",
    researched: "{{name}} abgeschlossen",
    queued: "{{name}} L{{level}} in der Warteschlange",
    queuedSimple: "{{name}} in der Warteschlange",
    unitsQueued: "{{count}} × {{name}} in der Warteschlange",
  },

  buildSheet: {
    eyebrowGround: "Bodenverteidigung · geht nie",
    eyebrowMobile: "Mobiler Rumpf",
    howMany: "Wie viele",
    fewer: "Weniger {{name}}",
    more: "Mehr {{name}}",
    quantity: "{{name}} Menge",
    max: "Max. {{name}}",
    maxShort: "Max",
    /* The way back down from Max, in one press. */
    reset: "Setzt den {{name}}-Zähler zurück",
    resetShort: "Zurücksetzen",
    build: "Erstellen Sie {{count}}",
    capped:
      "Sie besitzen bereits {{count}} – das Limit. Fertige Objekte, die nicht mehr verfügbar sind, zählen weiterhin, du kannst also kein weiteres bauen.",
    heldOfMax: "{{owned}} von {{max}} gehalten. Es zählen auch diejenigen, die draußen sind.",
    defenceAfter: "Heimverteidigung nach Fertigstellung: {{count}} Einheiten",
    maxOf: 'Max · {{value}}',
    byPurse: 'so weit deine Ressourcen reichen',
    byHangar: 'so weit der Hangar Platz hat',
    byGround: 'so weit der Boden Platz hat',
    byBerth: 'so weit deine Liegeplätze reichen',
    cycle: 'Klassenzyklus',
    yardFill: 'Werftschlange {{used}}/{{total}}',
    standing: '{{value}} stehen',
  },
} as const;

/** The ladder behind one row: what this thing becomes. */
export const itemSheet = {
  coreTierGuide: "Kernlevel und Planetenstufen",
  coreTierCurrent: "Kern L{{level}} → Stufe {{tier}}",
  coreTierRule: "Dein Planet gewinnt alle drei Kernlevel eine Stufe. Die markierte Zeile zeigt deine aktuelle Stufe.",
  coreTierLevel: "Kernlevel",
  coreTierPlanet: "Planetenstufe",
  coreTierRange: "L{{from}}–L{{to}}",
  eyebrowNotInOrbit: "Nicht im Orbit",
  eyebrowInOrbit: "Im Orbit",
  eyebrowNotInstalled: "Nicht installiert",
  eyebrowLevel: "Stufe {{level}}",
  actPutInOrbit: "In den Orbit bringen",
  actAlreadyInOrbit: "Bereits im Orbit",
  actInstall: "Installieren",
  actRaise: "Erhöhen auf L{{level}}",
  lockedNote: "Gesperrt – benötigt {{reason}}.",
  howItWorks: "So funktioniert es",
  ladderHeading: "Was jedes Level kauft",
  rungLevel: "L{{level}}",
  nextLook: "Neues Aussehen ab L{{level}}",
  queueFill: "Bauschlange {{used}}/{{total}}",
  affordIn: "Reicht in ~{{duration}}",
  short: "Nicht genug Ressourcen",
  orbitalDoesHeading: "Was es tut",
  orbitalOnce: "Einmal gekauft – nie ausgebaut",
  orbitalFree: "{{free}} von {{total}} frei",
  slotHeading: "Orbitplatz",
  slotAfter_one: "Er belegt den gestrichelten Platz; {{count}} Platz bleibt frei.",
  slotAfter_other: "Er belegt den gestrichelten Platz; {{count}} Plätze bleiben frei.",
  nextSlotCore: "Befehlskern {{level}} öffnet einen weiteren.",
  orbitalNoSlot: "Kein freier Platz – Befehlskern {{level}} öffnet den nächsten",
  orbitalNoSlotMax: "Kein freier Platz – jeder Platz, den der Befehlskern öffnet, ist belegt",
} as const;

/** The row. One decision, presented as a decision. */
export const upgradeRow = {
  about: "Über {{name}}",
  nextTierAlt: "{{name}} auf der nächsten Ebene",
  becomes: "wird",
  /** Where a ladder ends, so one rung of it can be judged against the whole. */
  ceiling: "von {{value}}",
  affordableIn: "Erschwinglich in <0>{{duration}}</0> zu Ihrem aktuellen Preis",
  /**
   * HOW LONG THE WORK ITSELF TAKES — a different clock from `affordableIn`.
   *
   * That one is a property of the wallet and only ever appeared when the player
   * was SHORT; this is a property of the item and shows whether or not they can
   * pay. A commander who can already afford a Citadel used to get no clock at all,
   * which is precisely when the wait is the only thing left to decide.
   */
  takes: "{{duration}}",
  takesLabel: "Benötigt {{duration}} zum Erstellen",
  /** A row whose level has a top: research ladders are the only ones so far. T12. */
  ladder: "L{{level}} / {{max}}",
} as const;

/** The control at the right-hand edge of every row. */
export const action = {
  verbRaise: "Erhöhen",
  verbBuild: "Build",
  verbInstall: "Installieren",
  verbClaim: "Sammeln",
  verbSend: "Senden",
  short: "Kurz",
  shortfallAlloy: "{{amount}} mehr Legierung",
  shortfallCrystal: "{{amount}} mehr Kristall",
  shortfallDeuterium: "{{amount}} mehr Deuterium",
  shortfallJoin: "und",
  shortfallLabel: "Short – benötigt {{parts}}",
  statAttack: "Angriff",
  statHull: "Haltbarkeit",
  statSpeed: "Geschwindigkeit",
  statSpeedFixed: "behoben",
  statCargo: "Fracht",
  statCargoNone: "—",
  /** What a Garbage Collector lifts off its battle's wreck. It takes the Cargo cell. D200. */
  statSalvage: "Bergung",
  statRoom: "Bulk",
  statFuel: "Kraftstoff",
  /** The rate carries its own span: the row form of the strip prints no labels. */
  statFuelRate: "{{value}} /1k",
  statFuelNone: "—",
} as const;

/** The portrait and the three verdicts at the top of your own planet. */
export const planetHero = {
  capital: "Hauptstadtwelt",
  colony: "Koloniewelt",
  /**
   * THE WORLD'S OWN TIER, UNDER ITS PORTRAIT. Owner report.
   *
   * The figure the whole galaxy is sorted by — the disc draws a world's size
   * from it, every dossier states it, and since D168 it decides who a commander
   * may fight. It was on screen everywhere EXCEPT a commander's own worlds.
   */
  tier: "Stufe {{tier}}",
  /** The one force unit, on the one world the commander knows exactly. D199. */
  firepower: "Feuerkraft",
  perHourSuffix: "/h",
  /** E5: the orbit line under the world — "Orbit 1/2 · +1 at Core L15". */
  orbit: "Orbit",
  disrupted: "Produktion gestoppt · überfallen · {{countdown}}",
  defence: "Verteidigung",
  defenceNone: "Keine",
  defenceShips_one: "{{count}} Schiff",
  defenceShips_other: "{{count}} wird versendet",
  defenceGuns_one: "{{count}} Waffe",
  defenceGuns_other: "{{count}} Waffen",
  defenceUnarmed_one: "{{count}} Transport in der Zeile",
  defenceUnarmed_other: "{{count}} transportiert in der Zeile",
  defenceDocked_one: "{{count}} in der Reparaturstation · verteidigt nicht",
  defenceDocked_other: "{{count}} in der Reparaturstation · verteidigen nicht",
  fleetAway: "{{count}} in der Luft",
  shield: "Schild",
  shieldNone: "Keine",
  shieldNoAegis: "keine Aegis",
  shieldOffline: "Offline",
  shieldCoreOffline: "Befehlskernausfall · Aegis ist dunkel",
  defenceCoreOffline: "Bodengeschütze offline · Befehlskernausfall",
  shieldValue: "{{current}} / {{max}}",
  shieldMeter: "Aegis-Schildladung",
  shieldRegen: "+{{amount}}/h · vor Einheiten",
  vaultSafe: "Sicher im Tresor",
  storeLabel: "Speicher",
  storeRule: "Die Speicher-Ebene legt fest, wie lang diese Balken sind; Die Halterung unter dem Schild ist vor einem Überfall sicher.",
  alloyStore: "{{held}} aus {{cap}}-Legierung, {{safe}} geschützt",
  crystalStore: "{{held}} von {{cap}} Kristall, {{safe}} geschützt",
  deuteriumStore: "{{held}} von {{cap}} Deuterium, {{safe}} geschützt",
  alloySafe: "{{amount}} Legierungssafe",
  crystalSafe: "{{amount}} Kristallsicher",
  deuteriumSafe: "{{amount}} Deuterium sicher",
  atRisk: "In Gefahr",
  atRiskValue: "{{amount}} ungeschützt",
  /** E5 production row: how full the store is, and the part the Vault keeps from a raid. */
  storeShare: "Lager {{pct}}\u00a0%",
  safeShare: "sicher {{pct}}\u00a0%",
  storeFull: "Lager voll",
} as const;

/** The commitment. Everything here is supporting detail for one line. */
export const launch = {
  /** When the world is covered again, under the exposure: the mock's "Dönüş 23:06". */
  fuel: "Kraftstoff",
  eyebrow: "Angriff",
  /**
   * THE EYEBROW OF A COMMITMENT AGAINST A RECORD. D151.
   *
   * This sheet is where a fleet stops being recallable, and it named only the
   * action. A target under a live Telescope and a target last seen three days ago
   * opened the identical screen, so the age of the thing being bet on — which the
   * dossier had stamped on every fact row for two releases — was absent from the
   * one surface where it decides anything.
   */
  lastSeen: "zuletzt gesehen {{age}}",
  /**
   * A PIRATE'S CREW AND ORBIT ARE CURRENT even after Telescope discovery is
   * remembered. The urgent clock is how long the target will still be out there.
   */
  goneIn: "verschwunden in {{duration}}",
  back: "Zurück",
  launching: "wird gestartet",
  commit: "Start – kein Rückruf",
  /** A raid on a world, which may be turned once while it flies (K8); a pirate raid keeps `commit`. */
  commitWorld: "Starten",
  /** B14: the held commit, and the price line under the ships (K8: a world raid turns). */
  holdWorld_one: "{{count}} Schiff starten",
  holdWorld_other: "{{count}} Schiffe starten",
  holdPirate_one: "{{count}} Schiff starten",
  holdPirate_other: "{{count}} Schiffe starten",
  warningWorld: "Diese Flotte verteidigt {{world}} erst nach ihrer Rückkehr wieder. Geschätzte Abwesenheit: {{duration}}.",
  warningPirate: "Du kannst diesen Überfall vor dem Gefecht einmal zurückrufen. Die Flotte verteidigt {{world}} erst nach ihrer Rückkehr wieder. Geschätzte Abwesenheit: {{duration}}.",
  recallNote:
    "Im Flug einmal rückrufbar – der Rückweg dauert so lange wie der bisherige Flug. Treibstoff wird nicht erstattet.",
  chooseFleet: "Wählen Sie eine Flotte",
  send: "Senden Sie {{count}} Schiffe",
  launched: "Flotte gestartet. Geschätzte Rückkehr: {{duration}}. {{count}} Einheiten bleiben zur Verteidigung deines Planeten.",
  whileAway: "Während diese Flotte unterwegs ist",
  defending: "{{count}} Einheiten, die ihr Zuhause verteidigen",
  nothingSent: "Noch nichts gesendet",
  exposedFor: "Geschätzte Flottenabwesenheit: {{duration}}",
  oneWayUnknown: "—",
  pace: "Fluggeschwindigkeit",
  paceHint: "Langsamere Flotten kommen später an und kehren mit derselben Geschwindigkeit zurück. Der Treibstoff bleibt gleich. Jeder verlangsamte Flugabschnitt darf höchstens 12 Stunden dauern.",
  paceFull: "Voll",
  /* The five reasons this commitment can be refused, each stated on the button. */
  noBay: "Kein Flugplatz frei",
  noFuel: "Nicht genügend Deuterium",
  tooLate: "Es wird zuerst weg sein",
  /** Nothing standing at this world is fast enough to catch it. */
  unreachable: "Nichts hier kann es fangen",
  /** Something could — just not the slowest ship in this selection. */
  tooSlow: "Lassen Sie die langsamen Schiffe hinter sich",
  /** A raid at a world has to be able to shoot back. The server refuses this too. */
  noEscort: "Ein Kriegsschiff hinzufügen",
  shipyardRevolt: "Werftaufstand",
  cargo: "Fracht",
  /** A ceiling on a wreck nobody has made yet, and only for collectors that live. D200. */
  salvage: "Deine Sammler heben bis zu {{amount}} des Wracks hoch, wenn sie überleben",
  atHome: "{{count}} daheim",
  away: "{{fleet}} auf einem Flug unterwegs. Es können nur Schiffe geschickt werden, die auf dieser Welt stehen.",
  awaySeparator: " · ",
  awayHull: "{{count}} {{name}}",
  fewer: "Weniger {{name}}",
  more: "Mehr {{name}}",
  quantity: "{{name}} Menge",
  max: "Max. {{name}}",
  maxShort: "Max",
  noShips:
    "Keine Schiffe zu Hause. Bauen Sie welche in der Werft oder warten Sie, bis eine Flotte zurückkommt.",
  warning:
    "Diese Flotte verteidigt deinen Planeten erst nach ihrer Rückkehr wieder. {{count}} Einheiten bleiben zu Hause.",
  /**
   * WHAT A RAID COSTS THE COMMANDER FOR THE REST OF THE DAY. D183.
   *
   * One sentence beside the exposure warning, because the two are halves of one
   * price. It says what is spent and what that opens — not how the rule works,
   * which is the sheet's own shape rather than a paragraph's job.
   */
  shieldWarning:
    "Dadurch wird Ihr Startschutzschild aufgegeben. Sobald es weg ist, können auch andere Kommandeure Sie überfallen.",
  /** The same price, on the window a heavy defeat bought rather than on the first day. */
  recoveryShieldWarning:
    "Dadurch wird Ihr Wiederherstellungsschild und dessen +50 % Leistung aufgegeben. Sobald es weg ist, können auch andere Kommandeure Sie überfallen.",
  radiationLethal_one: "Strahlung auf dieser Route zerstört {{count}} Schiff vor der Ankunft. Halten schickt es trotzdem.",
  radiationLethal_other: "Strahlung auf dieser Route zerstört {{count}} Schiffe vor der Ankunft. Halten schickt sie trotzdem.",
  radiationHpOutbound: "Hinflugstrahlung: {{hp}} HP pro Schiff.",
  radiationHpReturn: "Heimkehrende Schiffe erleiden weitere {{hp}} HP.",
  radiationHpHome: "Kehrt heim.",
  radiationHpStays: "Bleibt am Ziel.",
  radiationHpDose: "Flugstrahlung: {{hp}} HP pro Schiff.",
  radiationHpHealth: "{{count}}× {{hull}} · {{health}}% HP · {{hp}} / {{max}} HP",
  radiationHpDock: "Nach der Landung ist eine Reparatur in der Reparaturstation nötig.",
  radiationHpFree: "Bei Landung kostenlos repariert.",
  radiationHpCombat: "Kampf kann weiteren Schaden verursachen.",
  radiationDock: "Die Route kreuzt Strahlung: Jedes Schiff verliert ~{{pct}} % seiner Hülle. Über 20 % wartet in der Reparaturstation.",
  radiationPatched: "Die Route kreuzt Strahlung: Jedes Schiff verliert ~{{pct}} % seiner Hülle, bei der Landung kostenlos repariert.",
  fleetsave: "Schiffe im Flug können nicht überfallen werden. Ihr Planet kann.",
  range: "Entfernung {{d}}",
  arrive: "Ankunft",
  homeLabel: "Rückkehr",
  exposedShort: "Flotte abwesend: {{duration}}",
  lootSub: "Beute ~{{band}}",
  bay: "Flugplatz",
  bayThis: "dieser belegt 1",
  bayNone: "keiner frei",
  stays: "Bleibt daheim",
  staysUnits_one: "{{count}} Einheit",
  staysUnits_other: "{{count}} Einheiten",
  staysPower: "Stärke {{value}}",
  cargoEach: "je {{amount}} Fracht",
  cargoAdds: "+{{amount}} Fracht",
  paceBrief: "gleicher Treibstoff · langsamer Abschnitt ≤12 h",
  warningWorldOpen: "Diese Flotte verteidigt {{world}} erst nach ihrer Rückkehr wieder.",
  warningPirateOpen: "Du kannst diesen Überfall vor dem Gefecht einmal zurückrufen. Die Flotte verteidigt {{world}} erst nach ihrer Rückkehr wieder.",
} as const;

export const transfer = {
  /** What the flight burns, beside the figure. T6. */
  fuel: "Treibstoff für den Flug",
  cooldown: "Entladen – noch {{duration}}",
  homewardFuel: "Halber Tarif – zwischen eigenen Welten. Ein Angriff zahlt voll.",
  /** Under the pace rungs: what a slower TRANSFER buys — time in the air. */
  paceHint: "Schiffe im Flug können nicht geplündert werden. Langsamere Flotten kommen später an und kehren mit derselben Geschwindigkeit zurück. Der Treibstoff bleibt gleich. Jeder verlangsamte Abschnitt darf höchstens 12 Stunden dauern.",
  fuelShort: "kurz {{short}}",
  eyebrow: "Welttransfer",
  returnEta: "Zurück am Start in {{duration}} · {{time}}",
  eta: "ETA",
  capacity: "Fracht",
  fleet: "Schiff",
  homeDefence: "{{ships}} Raumschiff bleibt am Ursprung · {{power}} Feuerkraft",
  afterDelivery: "Nach der Lieferung",
  cargoShips: "Frachter",
  otherShips: "Andere Schiffe",
  stay: "Dort bleiben",
  return: "Zurückkehren",
  returnHint: "Rückkehrende Schiffe entladen zuerst. Der Rückflug wird jetzt bezahlt.",
  cargo: "Ressourcen",
  alloy: "Legierung",
  crystal: "Kristall",
  deuterium: "Deuterium",
  commit: "Übertragen",
  /** B14: what stops a transfer, on the held commit rather than a grey button. */
  noRoom: "Kein Platz im Ziel-Hangar",
  overLoad: "Mehr als der Laderaum trägt",
  sending: "Versand",
  launched: "Übertragung gestartet · {{duration}}",
  /** The recall rule and the two limits on what moves. Faz 2A.4 made "one way" false. */
  rules: "Im Flug einmal rückrufbar. Bodenverteidigung kann nicht fliegen; jedes Schiff mit Laderaum kann Ressourcen transportieren.",
  hullNone: "Keine auf dieser Welt",
  holdReady: "Ausgewählte Schiffe transportieren Ressourcen. Laderaum: {{capacity}}.",
  destinationLabel: "Zielhangar",
  holdNeedsLoad: "Wählen Sie oben ein Schiff mit Laderaum aus.",
  holdNoCarrier: "Diese Welt hat kein Schiff mit Laderaum.",
  /** Caption on the destination's room bar, which draws the figures itself. */
  /** Screen-reader sentence for the pips beside a hull. */
  hullPacked: "{{packed}} von {{held}} {{name}} gepackt",
  /** Caption on a cargo slider's spend bar: what this transfer takes. */
  cargoSending: "Senden",
} as const;

/**
 * THE CAPACITY CARD. Owner instruction: the design explains itself and the words
 * are captions on shapes that have already made the point.
 */
export const capacity = {
  fit: "mehr Platz frei",
  full: "VOLL",
  /* The two ends of a room card's bar, each under the part it describes. */
  used: "verwendet",
  free: "frei",
  /** Screen-reader only: the bar is a picture, and a picture needs a sentence. */
  reading: "{{used}} von {{total}} verwendet",
} as const;

/**
 * KOLONİ ARIZALARI — what broke, what it is taking, and what putting it right costs.
 *
 * THE VOICE IS THE FACT, NOT THE ALARM. Every one of these sentences names a thing that
 * has STOPPED and says what that stops; none of them says "warning" or "critical". A
 * colony breaking down is an ordinary part of holding three worlds, and copy that
 * shouted would either train the player to ignore it or make four broken things feel
 * like a catastrophe when they are a Tuesday.
 */
export const faults = {
  title: "Fehler",
  mark: "Fehler liegt vor",
  launchBlock: {
    SILENT_SPACE: "Im Stillen Raum geschlossen – nach der Rückkehr offen",
    SHIPYARD_REVOLT: "Werftaufstand – nichts kann starten",
    PROSPECTOR_FAULT: "Prospektor Center ist ausgefallen",
  },
  /** The strip under the build queues, and the row it collapses to when idle. */
  strip: {
    title: "Reparaturen",
    capacity: "{{count}} Besatzungen",
    priceAlloy: "{{alloy}} Legierung",
    priceBoth: "{{alloy}} Legierung · {{crystal}} Kristall",
    lane: "Besatzung {{slot}}",
  },
  tab: "Aktive Störungen",
  /** One line per fault: the name a player sees on the row and the sheet. */
  name: {
    REFINERY_OUTAGE: "Stromausfall in der Legierungsraffinerie",
    EXTRACTOR_OUTAGE: "Ausfall des Kristallextraktors",
    PLANT_OUTAGE: "Stromausfall in der Deuteriumraffinerie",
    VAULT_LEAK: "Speicherleck",
    CORE_OUTAGE: "Befehlskernausfall",
    TELESCOPE_FAULT: "Teleskopfehler",
    SHIPYARD_REVOLT: "Aufstand im Hof",
    PROSPECTOR_FAULT: "Schürfgrube",
  },
  /** What it stops, in the player's terms. One sentence, no hedging. */
  stopped: {
    REFINERY_OUTAGE: "Die Legierungsraffinerie ist ausgefallen. Dieser Planet produziert keine Legierung.",
    EXTRACTOR_OUTAGE: "Der Kristallextraktor ist ausgefallen. Dieser Planet produziert keine Kristalle.",
    PLANT_OUTAGE: "Die Deuteriumraffinerie ist ausgefallen. Dieser Planet produziert kein Deuterium.",
    VAULT_LEAK: "Ausgetretene Ressourcen bilden ein Trümmerfeld im Orbit. Kommandanten mit ausreichender Teleskopreichweite können es sehen und die Ressourcen bergen.",
    CORE_OUTAGE: "Der Befehlskern ist ausgefallen. Aegis und Bodenverteidigung sind deaktiviert. Schiffe auf diesem Planeten verteidigen ihn weiterhin.",
    TELESCOPE_FAULT: "Das Teleskop ist ausgefallen. Dieser Planet nutzt bis zum Reparaturabschluss nur die Grundsichtweite.",
    SHIPYARD_REVOLT: "Von diesem Planeten können keine neuen Missionen starten. Bereits fliegende Schiffe können weiterhin zurückkehren.",
    PROSPECTOR_FAULT: "Prospektoren können von diesem Planeten nicht starten. Prospektoren auf Missionen können weiterhin zurückgerufen werden.",
  },
  toll: {
    title: "Was es braucht",
    alloy: "{{amount}} Legierung pro Stunde, wird nicht hergestellt",
    crystal: "{{amount}} Kristall pro Stunde, wird nicht hergestellt",
    deuterium: "Jede Stunde Deuterium hätte diese Welt produziert",
    leak: "Pro Stunde gelangen {{amount}} Ressourcen ins Trümmerfeld. Kommandanten, die es sehen, können sie bergen.",
  },
  loyalty: {
    title: "Die Loyalität dieser Welt",
    battleLoss: "Teilniederlage −15 · entscheidende Niederlage −30 · Todesstern −{{strike}}",
    line: "Loyalität: {{value}} %. Sie sinkt bei {{count}} aktiven Störungen. Bei diesem Tempo erreicht sie in {{time}} null und du verlierst die Kolonie.",
    bar: "Treue {{value}}%",
    left: "{{time}} übrig",
  },
  price: {
    title: "Die Reparatur",
    crew: "die Crew",
    parts: "Teile",
    takes: "Die Reparatur dauert 5–15 Minuten. Die genaue Dauer steht beim Start fest.",
  },
  repair: "Reparatur starten",
  running: "Eine Crew ist dabei · {{time}}",
  noCancel: "Eine gestartete Reparatur kann nicht abgebrochen werden.",
  lanesFull: "Alle {{count}} Crews sind draußen",
  started: "Reparatur gestartet.",
  failed: "Das konnte nicht gestartet werden.",
} as const;
