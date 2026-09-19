/**
 * YOUR OWN WORLD — the four decision groups, the rows they are made of, the
 * detail sheet behind each row, and the launch planner.
 */

export const planet = {
  recovery: "Wiederherstellung läuft · Systeme kehren in {{duration}} zurück",
  /**
   * THE COUNTER TO THE THING ABOVE. T10 · T12.
   *
   * Its own block rather than a `deathStar` sub-key: they are two controls on two
   * different tabs, and the day either is reworded the other must not move with
   * it. `docs/interface.md` I1 — every requirement is a door and names itself.
   */
  interceptor: {
    eyebrow: "Antistrategische Batterie",
    none: "Keine Gebühr geladen",
    building: "wird geladen · {{duration}}",
    paused: "Der Ladevorgang wurde während der Wiederherstellung angehalten",
    ready: "Eine Ladung geladen",
    noRadar: "Geladen · Radarring ist offline",
    build: "Ladung laden",
    started: "Ladung wird geladen",
    hint: "Zerstört den ersten Todesstern, der in den zeitgesteuerten Radarring eintritt oder im Sichtfeld des Teleskops identifiziert wird. Wird ausgegeben, wenn es feuert.",
    readyHint:
      "Bewaffnet. Es zerstört den nächsten Todesstern, der in den Radar-Abfangring eintritt oder im Sichtfeld des Teleskops identifiziert wird.",
    noRadarHint:
      "Die Ladung bleibt geladen, aber diese Welt hat keinen Radar-Abfangring. Stellen Sie Uplink und Radar 3 wieder her. Ein Teleskopblick aus einer anderen Welt kann es immer noch auslösen.",
    needResearch: "Abfanggitter",
    needRadar: "Radar L{{level}}",
    needUplink: "Uplink im Orbit",
    needOperational: "Welt betriebsbereit",
    buildTime: "{{duration}} · eine Ladung · für das Schießen aufgewendet",
  },

  deathStar: {
    eyebrow: "Eingeschränkte strategische Waffe",
    none: "Kein Todesstern auf dieser Welt",
    building: "Gebäude · {{duration}}",
    paused: "Build wurde während der Wiederherstellung angehalten",
    ready: "Bereit zum Start",
    stock: "{{ready}} bereit · {{building}} Gebäude · {{held}}/{{capacity}}",
    build: "Build",
    started: "Der Bau des Todessterns hat begonnen",
    dangerHint:
      "Ein Einweg-Planetenbrecher. Es braucht nichts und es verliert niemanden eine Welt: Es zerstört und es verdunkelt sich für zwei Stunden.",
    readyHint:
      "Bewaffnet. Wählen Sie eine beliebige feindliche Welt aus. Zwei Stunden Erholung, was auch immer es sein mag; Keine Welt wechselt jemals den Besitzer.",
    needProtocol: "-Protokoll",
    needCore: "Kern L{{level}}",
    needShipyard: "Werft L{{level}}",
    needOperational: "Welt betriebsbereit",
    buildTime: "{{duration}} · eine Waffe · kein Rückruf",

    /**
     * WHAT AN IMPACT DOES, SAID PLAINLY, BEFORE THE MONEY IS SPENT. D113.
     *
     * This is the most expensive thing in the game and its effect was described
     * as "devastates" — a word that answers nothing. Five lines of consequence and
     * one line of what SURVIVES, because knowing what a strike cannot take is
     * what makes it a decision rather than a hope.
     */
    effectsTitle: "Was ein Aufprall bewirkt",
    effectFleet: "Lässt jedes Schiff und jede Waffe auf der Welt stehen – der Angriff berührt niemals eine Flotte",
    effectStock: "Zerstört die Hälfte von allem, was gelagert und in Arbeit ist",
    effectCore:
      "Entfernt eine Ebene vom Kommandokern und senkt Gebäude über die neue Kerndecke ab",
    effectAegis:
      "Entzieht der Aegis {{levels}} Stufen und lässt den Schild auf nichts fallen",
    effectDark:
      "Verdunkelt die Welt für 2 Stunden: keine Produktion, Sammlung, Bau, Bestellungen oder Produkteinführungen",
    /** D179: the strike is an OUTAGE. No world is lost and no fleet dies. */
    effectCapital: "Keine Welt wechselt jemals den Besitzer, weder Hauptstadt noch Kolonie; Die Uhr läuft einfach ab",
    effectSurvives:
      "Gebäude innerhalb der neuen Kerndecke, sämtliche Forschungs- und andere Orbitalhardware bleibt erhalten",
  },
  tabs: {
    label: "Planetenkategorien",
    defendProblem: "Verteidigen",
    defendQuestion: "Stärken Sie hier Ihre Schild-, Tresor- und Planetengeschütze.",
    orbitProblem: "Intel",
    orbitQuestion: "Erstellen Sie die Tools, die Ihnen helfen, Konkurrenten zu erkennen.",
    reachProblem: "Flotte",
    reachQuestion: "Entwickeln Sie hier Ihre Schiffe, Reichweite und Sonderprojekte.",
    growProblem: "Produktion",
    growQuestion: "Erweitern Sie hier Ihre Ressourcen und Ihr Gebäudelevel-Limit.",
  },

  wallet: {
    inTheWorks: "<0>{{amount}}</0> in Arbeit",
  },

  queue: {
    /** The end of all the work in one lane, which no screen used to carry. */
    ends: "beendet {{time}}",
    segment: "{{name}} · {{duration}}",
    cancelOne: "Abbrechen {{name}}",
    title: "Warteschlangen erstellen",
    idle: "Es wird nichts gebaut\nJeweils",
    capacity: "{{count}} Slots",
    construction: "Konstruktion",
    yard: "Yard",
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
      progress: "Die daran geleistete Arbeit geht ebenfalls verloren – eine Nachbestellung beginnt bei Null.",
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
      "Legt fest, wie viele Stunden der eigenen Produktion jede Ressource enthält; Die unteren 10 %, die auf eine Produktionszeit von 8 Stunden begrenzt sind, sind vor Überfällen sicher.",
    shipyard:
      "Schaltet schwerere Rümpfe frei, baut sie schneller und schärft jede von Ihnen gesendete Sonde.",
    refinery:
      "Erhöht die stündliche Legierungsproduktion; Der Speicher wird in Stunden gemessen, sodass der Inhalt, den er enthält, mitwächst. Die meisten Gebäude und Schiffe geben dies aus.",
    extractor:
      "Erhöht die stündliche Kristallproduktion; Der Speicher wird in Stunden gemessen, sodass der Inhalt, den er enthält, mitwächst. Fortschrittliche Schiffe, Instrumente und Forschungskristalle werden ausgegeben.",
    coreCapped_one:
      "{{count}} Gebäude-Upgrade ist blockiert, bis der Kommandokern angehoben wird.",
    coreCapped_other:
      "{{count}} Gebäude-Upgrades werden blockiert, bis der Kommandokern erhöht wird.",
    coreClear:
      "Der Kommandokern legt Obergrenzen auf Gebäudeebene fest und verkürzt die Bau- und Forschungszeit.",
  },

  defend: {
    strategicBand: "Strategische Verteidigung",
    strategicNote:
      "Eine Ladung zerstört den nächsten Todesstern, der von Radar 3 entdeckt oder im Visier des Teleskops identifiziert wurde. Die Ladung wird verbraucht, wenn es abgefeuert wird.",
    shieldBand: "Schild",
    shieldNote:
      "Aegis absorbiert Schaden, bevor er Ihre Einheiten erreicht, und regeneriert jede Stunde 35 % seines Maximums.",
    groundBand: "Am Boden (Kapazität erhöht sich je nach Kernstufe)",
    /* The figures moved into `CapacityBar`; the band keeps the RULE. */
    groundNote:
      "Bodengeschütze verlassen niemals die Welt. Dornen kontern Rümpfe der Bollwerkklasse; Bastionen wirken den Rümpfen der Lanzenklasse entgegen.",
    thornNone:
      "Leichte Geschütze mit Vorteil gegenüber Rümpfen der Bollwerkklasse; anfällig für Rümpfe der Lanzenklasse.",
    thornStanding:
      "{{count}} steht. Stark gegen Rümpfe der Bollwerkklasse; schwach gegen Rümpfe der Lanzenklasse.",
    thornGain: "Dornen",
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
    slotsNext: "· +1 am Kern L{{level}}",
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
    denseTag: "Schaltet den Runner frei",
    denseRole:
      "Um es aufzudecken, füllen Sie Ihre Fracht in einem Überfall auf, während die Beute auf dem Ziel verbleibt. Der Runner ist schneller als ein Hauler, trägt aber weniger.",
    graviticName: "Gravitische Ladungen",
    graviticTag: "Schaltet den Breacher frei",
    graviticRole:
      "Um es freizuschalten, greife eine verteidigte Welt mit einer aktiven Aegis an; Der Schild muss mindestens {{share}} deines Schadens absorbieren. Eine einzelne Wespe kann sich qualifizieren; Du musst nicht gewinnen. Der Breacher trifft Schilde fünfmal stärker.",
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
    groundDoctrineName: "Einlagerungslehre",
    generalName: "Waffen und Rüstungen",
    generalTag: "Verbessert jeden Rumpf, den Sie besitzen",
    doctrineTag: "Besserer Angriff und Panzerung",
    doctrineRole:
      "Klassen- und allgemeine Boni sind stapelbar, ihr kombinierter Kampfmultiplikator ist jedoch auf 25 % begrenzt. Klassenzähler bleiben der größere Vorteil.",
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
    deathStarName: "Todesstern-Protokoll",
    deathStarTag: "Schaltet den Todesstern frei",
    deathStarRole:
      "Lässt diese Welt einen Todesstern bauen. Der erste Schlag zerstört sein Ziel; Eine Sekunde kann nur eine Kolonie oder eine neutrale Welt erobern. Eine Hauptstadt kann nicht erobert werden.",
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
  },
} as const;

/** The ladder behind one row: what this thing becomes. */
export const itemSheet = {
  eyebrowNotInOrbit: "Nicht im Orbit",
  eyebrowInOrbit: "Im Orbit",
  eyebrowNotInstalled: "Nicht installiert",
  eyebrowLevel: "Ebene {{level}}",
  actPutInOrbit: "In den Orbit gebracht",
  actAlreadyInOrbit: "Bereits im Orbit",
  actInstall: "Installieren",
  actRaise: "Erhöhen auf L{{level}}",
  lockedNote: "Gesperrt – benötigt {{reason}}.",
  ladderHeading: "Was jedes Level kauft",
  rungLevel: "L{{level}}",
  rungNewHardware: "Neue Hardware bei L{{level}}",
  orbitalDoesHeading: "Was es tut",
  orbitalCostHeading: "Was es kostet",
  orbitalOnce: "einmal – es wird nie ausgelöst",
  orbitalFree: "{{free}} von {{total}} frei",
  orbitalNoSlot: "Kein freier Steckplatz – heben Sie den Kommandokern an",
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
  disrupted: "Produktion gestoppt · überfallen · {{countdown}}",
  defence: "Verteidigung",
  defenceNone: "Keine",
  defenceShips_one: "{{count}} Schiff",
  defenceShips_other: "{{count}} wird versendet",
  defenceGuns_one: "{{count}} Waffe",
  defenceGuns_other: "{{count}} Waffen",
  defenceUnarmed_one: "{{count}} Transport in der Zeile",
  defenceUnarmed_other: "{{count}} transportiert in der Zeile",
  fleetAway: "{{count}} in der Luft",
  shield: "Schild",
  shieldNone: "Keine",
  shieldNoAegis: "keine Sicherheit",
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
  atRiskValue: "{{amount}} verfügbar gemacht",
} as const;

/** The commitment. Everything here is supporting detail for one line. */
export const launch = {
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
  eyebrowRecord: "Angriff · zuletzt gesehen {{age}}",
  /**
   * A PIRATE HAS NO RECORD TO BE STALE — it is never remembered, so the reading is
   * live by definition. What belongs on the line instead is the other clock: how
   * long the thing will still be out there, which is the reason to hurry.
   */
  eyebrowPirate: "Angriff · verschwunden in {{duration}}",
  back: "Zurück",
  launching: "wird gestartet",
  commit: "Start – kein Rückruf",
  chooseFleet: "Wählen Sie eine Flotte",
  send: "Senden Sie {{count}} Schiffe",
  launched: "Gestartet. Verfügbar für {{duration}} · {{count}} Einheiten.",
  whileAway: "Während diese Flotte unterwegs ist",
  defending: "{{count}} Einheiten, die ihr Zuhause verteidigen",
  nothingSent: "Noch nichts gesendet",
  exposedFor: "Verfügbar für {{duration}}",
  oneWay: "Einbahnstraße",
  oneWayUnknown: "—",
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
  distance: "Abstand",
  fleetHeading: "Flotte",
  atHome: "{{count}} Startseite",
  perShipStats: "Pro Schiff · beinhaltet Ihre Forschung",
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
    "Dies kann nicht zurückgerufen werden. Sobald es weg ist, können Sie nur herausfinden, was dort unten war, indem Sie ihm bei der Landung zusehen – und Ihr Planet enthält {{count}} Einheiten, bis es zurückkommt.",
  /**
   * WHAT A RAID COSTS THE COMMANDER FOR THE REST OF THE DAY. D183.
   *
   * One sentence beside the exposure warning, because the two are halves of one
   * price. It says what is spent and what that opens — not how the rule works,
   * which is the sheet's own shape rather than a paragraph's job.
   */
  shieldWarning:
    "Dadurch wird Ihr Ersttagsschild aufgegeben. Sobald es weg ist, können auch andere Kommandeure Sie überfallen.",
  /** The same price, on the window a heavy defeat bought rather than on the first day. */
  recoveryShieldWarning:
    "Dadurch wird Ihr Wiederherstellungsschild und dessen +100 % Leistung aufgegeben. Sobald es weg ist, können auch andere Kommandeure Sie überfallen.",
  fleetsave: "Schiffe im Flug können nicht überfallen werden. Ihr Planet kann.",
} as const;

export const transfer = {
  /** What the flight burns, beside the figure. T6. */
  fuel: "Treibstoff für den Flug",
  fuelShort: "kurz {{short}}",
  eyebrow: "Welttransfer",
  eta: "ETA",
  capacity: "Fracht",
  fleet: "Schiff",
  homeDefence: "{{ships}} Raumschiff bleibt am Ursprung · {{power}} Feuerkraft",
  cargo: "Ressourcen",
  alloy: "Legierung",
  crystal: "Kristall",
  deuterium: "Deuterium",
  commit: "Übertragung – kein Rückruf",
  sending: "Versand",
  launched: "Übertragung gestartet · {{duration}}",
  irreversible:
    "Eine Richtung. Die Bodenverteidigung kann sich nicht bewegen; Der Laderaum stammt nur von Kurier, Wanderer, Atlas und Argosy.",
  hullNone: "Keine auf dieser Welt",
  holdReady: "Kurier, Wanderer, Atlas und Argosy tragen das Erz. Halten: {{capacity}}.",
  destinationLabel: "Zielhangar",
  holdNeedsLoad: "Fügen Sie oben einen Kurier, Wanderer, Atlas oder Argosy hinzu, um Erz zu transportieren.",
  holdNoCarrier:
    "Diese Welt hat keinen Kurier, Wanderer, Atlas oder Argosy, daher kann hier nichts Erz transportieren.",
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
  tab: "Hier ist etwas kaputt",
  /** One line per fault: the name a player sees on the row and the sheet. */
  name: {
    REFINERY_OUTAGE: "Stromausfall in der Legierungsraffinerie",
    EXTRACTOR_OUTAGE: "Ausfall des Kristallextraktors",
    PLANT_OUTAGE: "Stromausfall in der Deuteriumraffinerie",
    VAULT_LEAK: "Tresorleck",
    CORE_OUTAGE: "Befehlskernausfall",
    TELESCOPE_FAULT: "Teleskopfehler",
    SHIPYARD_REVOLT: "Aufstand im Hof",
    PROSPECTOR_FAULT: "Schürfgrube",
  },
  /** What it stops, in the player's terms. One sentence, no hedging. */
  stopped: {
    REFINERY_OUTAGE: "Die Raffinerie ist dunkel. Diese Welt macht überhaupt keine Legierung.",
    EXTRACTOR_OUTAGE: "Der Extraktor ist dunkel. Diese Welt stellt überhaupt keinen Kristall her.",
    PLANT_OUTAGE: "Die Pflanze ist dunkel. Diese Welt produziert überhaupt kein Deuterium.",
    VAULT_LEAK: "Das Gewölbe blutet in den Orbit – und jeder, dessen Teleskop diese Welt erreicht, kann das Feld sehen und dorthin fliegen.",
    CORE_OUTAGE: "Der Kern ist dunkel: Die Aegis ist außer Gefecht gesetzt und die Bodengeschütze haben keine Feuerkontrolle. Schiffe zu Hause kämpfen immer noch. Wenn jemand jetzt landet, landet er auf einer offenen Welt.",
    TELESCOPE_FAULT: "Das Teleskop ist blind. Diese Welt sieht nicht weiter als das bloße Auge, bis sie fixiert ist.",
    SHIPYARD_REVOLT: "Der Hof ist verlassen. Nichts startet von dieser Welt – kein Überfall, kein Transfer, kein Konvoi. Schiff, das bereits in der Luft ist, kommt noch nach Hause.",
    PROSPECTOR_FAULT: "Die Grube ist raus. Kein Prospektor kann von dieser Welt geschickt werden. Bereits verkaufte Artikel können noch zurückgerufen werden.",
  },
  toll: {
    title: "Was es braucht",
    alloy: "{{amount}} Legierung pro Stunde, wird nicht hergestellt",
    crystal: "{{amount}} Kristall pro Stunde, wird nicht hergestellt",
    deuterium: "Jede Stunde Deuterium hätte diese Welt produziert",
    leak: "{{amount}} eine Stunde lang in den Orbit, wo jeder, der diese Welt sehen kann, herausfliegen und sie erobern kann",
  },
  loyalty: {
    title: "Die Loyalität dieser Welt",
    battleLoss: "Teilniederlage −15 · entscheidende Niederlage −30",
    line: "{{value}} % – fällt, während {{count}} Dinge kaputt sind. Bei dieser Rate erreicht es in {{time}} Null und die Kolonie erklärt sich für unabhängig.",
    bar: "Treue {{value}}%",
    left: "{{time}} übrig",
  },
  price: {
    title: "Die Reparatur",
    crew: "die Crew",
    parts: "Teile",
    takes: "Dauert 5–15 Minuten. Bei der Anstellung gibt die Crew ihre Arbeitszeiten selbst an.",
  },
  repair: "Senden Sie eine Crew",
  running: "Eine Crew ist dabei · {{time}}",
  noCancel: "Sobald eine Crew ausgefallen ist, kann sie nicht zurückgerufen werden.",
  lanesFull: "Alle {{count}} Crews sind draußen",
  started: "Eine Crew ist unterwegs.",
  failed: "Das konnte nicht gestartet werden.",
} as const;
