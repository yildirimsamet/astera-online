/**
 * THE DISC AND EVERYTHING ON IT — the galaxy's own chrome, the commander sheet,
 * and the focus rail that answers "what is this, and what do I know about it".
 */

export const galaxy = {
  settlementAway: "Siedlungsflotte nach {{world}} entsandt",
  deathStarAway: "Todesstern startete in Richtung {{world}}",
  /**
   * Its own key rather than a reuse of the server list's, because nothing is
   * shared between surfaces (D55): this one sits at 8px in the corner of the
   * disc and the other is a row in a list, and they are free to diverge.
   */
  online: "{{count}} gerade online",
  /** The same population over a day, so an off-peak galaxy still reads as inhabited. */
  onlineToday: "{{count}} in den letzten 24 Std.",
  worlds: "{{count}} Welten",
  fleetAway_one: " · {{count}} Flotte unterwegs",
  fleetAway_other: " · {{count}} Flotten unterwegs",
  rocks_one: " · {{count}} Asteroid",
  rocks_other: " · {{count}} Asteroiden",
  pirates_one: " · {{count}} Pirat",
  pirates_other: " · {{count}} Piraten",
  wrecks_one: " · {{count}} Wrack",
  wrecks_other: " · {{count}} Wracks",
  targetOre: "{{amount}} Erz übrig",
  targetResources: "{{amount}} Rohstoffe übrig",
  targetMinutes: "Noch {{count}} Min.",
  asteroidShower: 'Asteroidenschauer',
  asteroidShowerStatus: 'Asteroiden ×{{multiplier}} · noch {{remaining}}',
  intergalacticConvoy: 'Intergalaktischer Konvoi',
  intergalacticConvoyStatus: 'Durchquert die Galaxie · noch {{remaining}}',
  openIntel: "Aufklärung",
  /**
   * THE PLANET GLYPH IS A CAMERA MOVE NOW, AND THE SHEET HAS ITS OWN MARK. D163.
   *
   * `openWorlds` is gone with the tap that opened a list from a glyph that looked
   * like "go to my planet"; the list itself is the transfer sheet and is named
   * for what a commander opens it to DO.
   */
  goHome: "Auf deinen aktiven Planeten zoomen",
  openTransfer: "Ressourcen zwischen deinen Welten verschicken",
  /* The two sensor switches under the disc readout. `aria-label` only. */
  showTelescope: "Teleskopreichweite anzeigen",
  hideTelescope: "Teleskopreichweite ausblenden",
  showRadar: "Radarreichweite anzeigen",
  hideRadar: "Radarreichweite ausblenden",
  eventsGuide: {
    open: "Galaxienereignisse anzeigen",
    eyebrow: "Wochenkalender",
    title: "Galaxieereignisse",
    intro: "Diese Ereignisse kehren an Werktagen und am Wochenende zu festen Zeiten wieder.",
    timeZone: "Türkische Zeit (UTC+3)",
    nextLabel: "Nächstes Ereignis",
    nextUpcoming: "{{event}} · in {{duration}}",
    localTime: "Ortszeit · {{time}}",
    event: {
      ASTEROID_SHOWER: "Asteroidenschauer",
      TRADE_SHIP: "Handelsschiff",
      INTERGALACTIC_CONVOY: "Intergalaktischer Konvoi",
    },
    dailyNote: "Werktage: Montag bis Freitag. Wochenende: Samstag und Sonntag. Alle Zeiten gelten für die Türkei.",
    days: {
      WEEKDAY: "Wochentage",
      WEEKEND: "Wochenende",
      EVERY_DAY: "Jeden Tag",
    },
    asteroid: {
      title: "Asteroidenschauer",
      summary: "Jede Stunde erscheint ein Asteroid pro Kommandant, der zuletzt gespielt hat. Während des Schauers entstehen entsprechend mehr. Bereits vorhandene Asteroiden bleiben bis zu ihrem Ablauf bestehen.",
    },
    trade: {
      title: "Handelsschiff",
      summary: "Wähle das Handelsschiff auf der Galaxienkarte, um deine Ressourcen gegen die benötigten zu tauschen.",
      rate: "Feste Rate: 32 Legierung = 16 Kristall = 1 Deuterium.",
    },
    convoy: {
      title: "Intergalaktischer Konvoi",
      summary: "Greif den Konvoi während seiner Durchreise an. Je nach Feuerkraft erhältst du bis zu vier Stunden Weltproduktion und vielleicht geborgene Schiffe.",
      note: "Der Konvoi schießt nicht zurück. Deine Flotte erleidet deshalb keine Verluste. Jede Welt kann ihn pro Durchreise einmal angreifen.",
    },
  },
  /* Screen-reader names for the marks on the disc. Nothing is painted. */
  openResearch: "Forschung",
  openClan: "Clan",
  kindCapital: "Hauptwelt",
  kindColony: "Kolonie",
  kindNeutral: "Neutral T{{tier}}",
  /** A world nobody has surveyed. The only honest thing to print about it. D127. */
  /** What a remembered world's bottom line says: the record, and how old it is. D151. */
  recordAge: "Letzte Aufzeichnung · {{age}}",
  unsurveyed: "Nicht vermessen",
  owned: "Deine Welt",
  clanmate: "Clanmitglied",
  rival: "Rivale",
  recovery: "Schutz nach Rückkehr durchbrochen",
  emp: "EMP-Ausfall",
  claimOpen: "Kann beansprucht werden",
  claimMine: "Ihr Vorrang",
  claimPriority: "Vorrang des Angreifers",

  /** What a launch says as it leaves. */
  harvestAway: "{{count}} unterwegs · {{minutes}} Min. bis zum Wrack",
  miningAway: "{{count}} unterwegs · {{minutes}} Min. bis zum Asteroiden",

  panelPlanetEyebrow: "Dein Planet",
  panelCommanderEyebrow: "Kommandant",
  panelIntelEyebrow: "Was du weißt",
  panelIntelTitle: "Aufklärung",

  commander: {
    galaxyLabel: "Galaxie",
    galaxyUnknown: "—",
    endsLabel: "Saison endet in",
    endsUnknown: "—",
    wipeNote: "Beim Saisonwechsel werden alle Galaxien zurückgesetzt und jeder beginnt von vorn.",
    signOut: "Abmelden",
  },
} as const;

/**
 * THE LIST OF WHAT YOU HOLD. T3.
 *
 * Its own namespace and not a reuse of `galaxy`'s world words: this surface names
 * a capital in a row you can press, and the disc names one in a caption. They are
 * free to diverge, and D55 says they must be able to.
 */
export const worlds = {
  eyebrow: "Deine Welten",
  title: "Welten",
  /** Names the list itself, so the rows are not three unlabelled buttons. */
  list: "Deine Welten",
  active: "Aktiv",
  kindCapital: "Hauptwelt",
  kindColony: "Kolonie",
  craft_one: "{{count}} Schiff",
  craft_other: "{{count}} Schiffe",
  bays: "Startrampen",
  sendTitle: "Schnellübertragung",
  /**
   * THE TWO ENDS OF ONE SENTENCE, AND THE BUTTON THAT COMMITS IT. D163.
   *
   * The labels are visually hidden — the arrow between the dropdowns says which is
   * which, and two words above two controls that already read `Kestrel-12 → Haven`
   * would be the interface writing out what it has just drawn. They stay for the
   * screen reader, where there is no arrow to see.
   */
  sendFrom: "Von",
  sendTo: "An",
  send: "-Übertragung",
  /** Screen-reader readings for the two pictures on a row. */
  store: "{{resource}}: {{amount}} von {{cap}}",
  baysReading: "{{used}} von {{total}} Flugschächten im Einsatz",
  alloy: "Legierung",
  crystal: "Kristall",
  deuterium: "Deuterium",
} as const;

export const focus = {
  /** The rail itself. */
  shellLabel: "{{title}} – Fokus",
  clear: "Auswahl löschen",

  /** One known thing, with where it came from stamped on it. */
  unknown: "Unbekannt",

  planet: {
    transfer: "-Übertragung",
    settle: "Kolonie gefunden",
    settleNeedSlot: "Kolonie gefunden · Kolonieplatz voll",
    settleNeedBay: "Kolonie gefunden · Flugschächte voll",
    settleNeedCourier: "Kolonie gefunden · 2 Kuriere benötigt",
    settleNeedAlloy: "Kolonie gefunden · Legierung fehlt",
    settleNeedCrystal: "Kolonie gefunden · Kristall fehlt",
    settleNeedFuel: "Kolonie gefunden · Deuterium fehlt",
    settleTooLate: "Kolonie gefunden · kommt zu spät",
    settleNeedPriority: "Kolonie gründen · Vorrang des Angreifers",
    settleRecovering: "Kolonie gefunden · Ursprung wird wiederhergestellt",
    settleWhy: {
      recovering: "Ihre Welt erholt sich – noch kann keine Flotte sie verlassen.",
      colonyCore: "Nächste Kolonie benötigt Kommandokern {{required}} · jetzt {{current}}",
      colonyMax: "Sie besitzen bereits die meisten Kolonien, die es gibt: {{max}}.",
      flightBay: "Jeder Flugschacht wird genutzt – ich habe ihn gefunden, als eine Flotte landete.",
      courier: "{{need}} Kuriere benötigt · {{have}} hier",
      alloy: "{{need}} Legierung benötigt · {{have}} hier",
      crystal: "{{need}} Kristall benötigt · {{have}} hier",
      fuel: "{{need}} Deuterium benötigt · {{have}} hier",
      tooLate: "Kuriere von hier landen nach Rennende.",
      priority: "Bis sein Vorrang endet, darf nur der Angreifer landen. Starten Sie in {{wait}}, dann landen Ihre Kuriere genau zu dessen Ende.",
    },
    settlementConfirm: {
      eyebrow: "Kolonierasse",
      title: "{{world}} gefunden",
      unsurveyedTitle: "Diese Welt gefunden",
      race: "Die erste gültige Zwei-Kurier-Flotte erobert die Welt.",
      priorityMineFirst: "Ihr Vorrang: Ihre Kuriere landen, bevor er endet – niemand kann vor Ihnen landen.",
      priorityMineLate: "Ihre Kuriere landen nach dem Ende Ihres Vorrangs; ab dann gewinnt die erste gültige Ankunft.",
      noRecall:
        "Kolonieschiffe können nicht zurückgerufen werden. Wenn Sie die Kolonie gefunden haben, werden die Gründungskosten ausgegeben und die Welt wird mit dem Bestand ihrer Stufe geöffnet. Wenn ein anderer Kommandant zuerst gewinnt, kehren Ihre Kuriere und Gründungskosten zurück; abgebrannte Brennelemente nicht.",
      transports: "Kolonieschiffe",
      foundingCost: "Gründungskosten",
      opensWith: "Kolonie wird geöffnet mit",
      cargoValue: "{{alloy}} Legierung · {{crystal}} Kristall",
      stockValue: "{{alloy}} Legierung · {{crystal}} Kristall · {{deuterium}} Deuterium",
      fuel: "Flugtreibstoff",
      arrives: "Kommt an",
      closes: "Das Rennen geht zu Ende",
      confirm: "Kolonieschiffe entsenden",
      confirming: "Versand erfolgt…",
    },
    deathStar: "Todesstern",
    deathStarStrike: "Todesstern · EMP-Angriff",

    /**
     * THE SECOND BEAT ON A STRIKE. Owner report: *"yanlışlıkla"*.
     *
     * The most expensive single action a commander takes, consuming the weapon,
     * offered as one slab in a wrapped row of four whose neighbour is an ordinary
     * raid. It names the WORLD, because a mis-tap sends it to the wrong one, and
     * it states the outage rather than arguing for the rocket — the essay about
     * what a strike does belongs beside the forge that builds one.
     */
    strikeConfirm: {
      eyebrow: "Taktischer EMP-Schlag",
      title: "{{world}} unterdrücken",
      lead: "Der Todesstern wird beim Angriff verbraucht. Er kann nicht zurückgerufen werden.",
      outage: "EMP-Ausfall",
      keeps: "Aegis wird geleert und regeneriert eine Stunde lang nicht. Bodenverteidigungen bleiben offline und erleiden keinen Schaden. Eine Kolonie verliert {{loss}} Loyalität; bei {{loss}} oder weniger fällt sie ab und wird neutral.",
      commit: "EMP starten",
      loyalty: "Loyalität der Kolonie",
      loyaltyRead: "{{value}} % · {{hits}}",
      hits_one: "dieser Treffer reicht",
      hits_other: "{{count}} Treffer",
      loyaltyUnknown: "Unbekannt – zuerst eine Sonde schicken",
      charges: "Abfangladungen",
      chargesRead_one: "{{count}} Ladung · {{needed}} müssen gleichzeitig ankommen",
      chargesRead_other: "{{count}} Ladungen · {{needed}} müssen gleichzeitig ankommen",
      chargesNone: "Keine geladen",
      probeAge: "Aus der letzten Sonde · {{age}}",
    },
    deathStarUnavailable: "Kein Todesstern bereit",
    deathStarProtected: "Todesstern · Ziel geschützt",
    deathStarOutOfBand: "Todesstern · zu entwickelt",
    deathStarNeedBay: "Todesstern · Flugschächte voll",
    deathStarTooLate: "Todesstern · kommt zu spät",
    deathStarNeedSlot: "Todesstern · Kolonieplatz voll",
    deathStarOriginRecovering: "Todesstern · Ursprung erholt sich",
    kindCapital: "Hauptwelt",
    kindColony: "Kolonie",
    kindNeutral: "Neutral",
    capitalProtected: "Nicht einnehmbares Hauptwelt",
    capitalProtectedHint:
      "Ein Todesstern leert die Aegis und blockiert ihre Regeneration für eine Stunde; Bodenverteidigungen bleiben offline und erleiden keinen Schaden.",
    /**
     * WHAT A CAPITAL IS WHILE THE WEAPON IS OFF. `STRATEGIC_CRAFTING_ENABLED`.
     *
     * `capitalProtectedHint` above is the flag-ON sentence and stays exactly as
     * written for the day it flips back. This is the same slot said in the rules
     * a commander can currently reach: a raid, loot, and a world that never moves.
     */
    capitalRaidOnlyHint:
      "Ein Überfall benötigt Ressourcen und sonst nichts. Eine Hauptstadt wechselt niemals den Besitzer, egal, was darauf landet.",
    capitalRecovering: "Hauptwelt erholt sich · uneinnehmbar",
    capitalRecoveringHint:
      "Ein weiterer EMP-Angriff startet die einstündige Unterdrückung neu; die Kontrolle bleibt unverändert.",
    capitalEmp: "Hauptwelt unter EMP",
    capitalEmpHint: "Aegis ist leer und Bodenverteidigungen sind eine Stunde lang offline und unverwundbar.",
    yourCapital: "Ihr geschütztes Hauptwelt",
    yourColony: "Deine Kolonie",
    transferHint: "Bewegen Sie Schiffe und Ressourcen hierher und wählen Sie, welche Schiffe zurückfliegen.",
    transferRoute: "Welttransfer",
    transferOrigin: "Ursprung",
    transferTarget: "Ziel",
    transferFrom: "Von {{origin}}",
    transferCraft: "Bastelbereit",
    transferPrepare: "Wählen Sie Schiff und Ressourcen",
    transferRecovering: "Die Ursprungswelt erholt sich",
    colonyRoute: "Route zu einer Kolonie",
    claimOpen: "Kolonierennen eröffnet",
    settlementInFlight: "Ihre Kolonieschiffe sind unterwegs",
    claimRaceExplain: "Es gehört noch niemandem. Die ersten zwei gültigen Kuriere, die eintreffen, nehmen es entgegen.",
    colonySlots: "{{used}} / {{total}} Kolonieplätze",
    routeRaid: "Gewinne einen entscheidenden Überfall",
    routeRaidDetail: "Angriff mit Kampfschiffen. Zerstöre jeden Verteidiger und den Schild.\nDas",
    routeClaim: "-Rennen wird automatisch geöffnet",
    routeClaimDetail: "Nichts zum Senden. Ein entscheidender Überfall eröffnet das öffentliche Rennen von selbst – haben Sie dabei einen freien Kolonieplatz, gehören die ersten {{minutes}} Min. nur Ihnen.",
    routeSettle: "Entsende die Kolonieflotte",
    routeSettleDetail: "Senden Sie erst jetzt die Gründungsschiffe und Fracht. Die erste gültige Ankunft gewinnt.",
    routeSettleInFlightDetail: "Ihre Gründungsflotte fliegt. Der erste gültige Teilnehmer gewinnt.",
    raidFleetBadge: "Überfall-Flotte",
    raidFleetExplain:
      "Wählen Sie Kampfschiffe im Überfall-Bildschirm und zerstören Sie jeden Verteidiger und den Schild. Für Schritt 1 werden keine Kuriere, Gründungsfracht oder Kolonieplätze benötigt.",
    automaticBadge: "Automatisch",
    automaticExplain:
      "Ein entscheidender Überfall eröffnet das Rennen automatisch. Für Schritt 2 schickst du kein weiteres Schiff und bezahlst auch keine andere Ressource.",
    settlementAwayBadge: "Im Flug",
    settlementAwayExplain:
      "Ihre beiden Kuriere und die Gründungsfracht sind abgereist. Sie können nicht zurückgerufen werden; Die erste gültige Ankunft erobert die Welt.",
    claimCloses: "Schließt in {{duration}}",
    claimPriorityMineTitle: "Kolonierennen · Ihr Vorrang",
    claimPriorityOtherTitle: "Kolonierennen · Vorrang des Angreifers",
    claimPriorityMineExplain: "Sie haben diesen Anspruch eröffnet: In den ersten {{minutes}} Min. dürfen nur Ihre Kuriere landen. Danach treten alle an.",
    claimPriorityOtherExplain: "Der Angreifer, der diesen Anspruch eröffnet hat, hat die ersten {{minutes}} Min.: Nur seine Kuriere dürfen landen. Danach gewinnt die erste gültige Ankunft.",
    claimPriorityCloses: "Vorrang endet in {{priority}} · Rennen schließt in {{closes}}",
    claimRaidStillOpen:
      "Ein weiterer Überfall ist möglich; dieser Anspruch wird dadurch nicht erweitert.",
    colonySlotOpen: "Kolonieplatz frei",
    colonySlotNeedsCore: "Kolonieplatz: Kommandokern {{required}} nötig · jetzt {{current}}",
    colonySlotsFull: "Kolonieplätze voll ({{max}})",
    colonySlotExplain:
      "Der Kommandokern Ihrer Hauptstadt muss beim Abflug der Gründungsflotte einen freien Kolonieplatz bieten. Ist er frei, wenn Ihr Überfall das Rennen eröffnet, gehören Ihnen auch die ersten {{minutes}} Min.",
    captureColonySlotExplain:
      "Wird benötigt, um eine Kolonie zu gründen, niemals, um eine anzugreifen: Ein Todesstern überträgt nichts.",
    openFlightBay: "1 Freiflugbucht",
    flightBayExplain:
      "Wird nur für Schritt 3 benötigt. Der einfache Flug der beiden Kuriere belegt 1 Bucht, bis sie die neutrale Welt erreichen.",
    courierCount: "2 Kuriere",
    haulerExplain:
      "Nur für Schritt 3: Dies ist die Gründungsflotte, die getrennt vom Überfall gesendet wird, nachdem das Rennen eröffnet wurde. Sie werden für den Überfall nicht benötigt.",
    foundingAlloy: "{{amount}} Legierung",
    foundingAlloyExplain:
      "{{amount}} Legierung wird für die Gründung der Kolonie in Schritt 3 aufgewendet; Ein Rennen, das man verliert, gibt es zurück. Es handelt sich nicht um Kosten für den Überfall.",
    foundingCrystal: "{{amount}} Kristall",
    foundingCrystalExplain:
      "{{amount}} Kristall wird für die Gründung der Kolonie in Schritt 3 ausgegeben; Ein Rennen, das man verliert, gibt es zurück. Es handelt sich nicht um Kosten für den Überfall.",
    settlementFuel: "{{amount}} Deuterium",
    settlementFuelExplain:
      "Die beiden Kuriere verbrennen {{amount}} Deuterium auf ihrem Hinflug in Schritt 3. Die Entfernung ändert diesen Betrag.",
    settlementArrivalExplain:
      "Der Gründungsflug dauert {{duration}}. Es muss vor Ende des öffentlichen Rennens eintreffen; Die erste gültige Ankunft gewinnt.",
    arrivesIn: "kommt an {{duration}}",
    deathStarRoute: "Was ein Streik bewirkt",
    /** The clock a defender is racing, named for what runs out at the end of it. */
    recoveryBreach: "Erholung · Welt dunkel",
    empBreach: "EMP-Ausfall · Verteidigung offline",
    occupationProtected: "Arbeitsschutz",
    protectedFor: "Kann für {{duration}} nicht getroffen oder gefangen werden.",
    firstImpact: "Schaden + {{duration}} Dunkelheit",
    firstImpactColony: "Eine Kolonie verliert zudem {{loss}} Loyalität; bei {{loss}} oder weniger fällt sie ab und wird neutral.",
    secondImpact: "Die Uhr läuft ab · die Welt ist unverändert",
    deathStarReadyRequirement: "Todesstern bereit",
    deathStarReadyExplain:
      "Ein Angriff erfordert einen fertigen Todesstern, der auf der Startwelt wartet.",
    /**
     * WHAT THE CLOCK ACTUALLY COSTS, WHERE THE DEFENDER IS LOOKING AT IT. D179.
     *
     * It read "land a ship here or this colony stops being yours" until D179
     * removed the drop. There is nothing to race any more, so the line states the
     * real price instead — the world produces nothing and can launch nothing — and
     * says the one thing a struck commander most needs to hear.
     */
    recoveryDropWarning:
      "{{duration}} übrig. Bis dahin wird nichts produziert und nichts gestartet. Die Welt bleibt Ihnen und Ihre Flotte ist intakt.",
    empWarning: "{{duration}} verbleiben. Aegis regeneriert nicht; Bodenverteidigungen feuern nicht und erleiden keinen Schaden.",

    eyebrow: "Wird von {{owner}} gehalten",
    location: "Welt · {{planet}}",
    /** A world outside every reach and never probed. It has no other name. D127. */
    unsurveyedEyebrow: "Welt · nicht vermessen",
    unsurveyedTitle: "Sie haben hier noch nie nachgeschaut",
    /* Paired side by side on the rail, so the verb is the label and the cost is
       its own micro line. See `ProbeControl`. */
    /**
     * A WORLD THAT CANNOT BE RAIDED YET. D183.
     *
     * Names the CLOCK rather than the rule: "Protected · 4h" is something a
     * commander can plan against, where "that commander is new" is trivia about
     * somebody else. One label for both sources of the state — an occupation window
     * and a first-day shield mean the same thing to a raider.
     */
    /**
     * THE HALF OF THE BAND FOG CAN PROVE. D168 · D127.
     *
     * The short form rides the control and must be ONE LINE — about 129px at
     * 350. The long form is the accessible name, where there is room to say why.
     * Both state only "too developed": the "too weak" direction cannot be proved
     * from a fogged disc, so it stays with the server's refusal.
     */
    attackOutOfBandShort: "Zu entwickelt",
    attackOutOfBand:
      "Dieser Kommandant ist weiter entwickelt als du – ein Überfall erstreckt sich höchstens über eine Stufe",
    attackProtected: "Geschützt – diese Welt kann noch nicht überfallen werden",
    attackProtectedShort: "Geschützt · {{duration}}",
    attackShort: "Angriff planen",
    probeShort: "-Sonde",
    probeCoolingShort: "Sonde in {{duration}}",
    attack: "Planen Sie einen Angriff",
    attackNeutralAgain: "Erneuter Überfall · Anspruch unverändert",
    attackOriginRecovering: "-Angriff · Ursprung wird wiederhergestellt",
    attackSilentSpace: "Kann nicht angreifen · im Stillen Raum geschlossen",
    attackSilentSpaceShort: "Stiller Raum",
    attackShipyardRevolt: "Kann nicht angreifen · Werftaufstand",
    attackShipyardRevoltShort: "Werftaufstand",
    radiationHere: "Strahlungswolke: Jedes Schiff hier verliert pro Minute {{pct}} % seiner Hülle. Ab 20 % wartet es auf die Reparaturstation.",
    radiationShelter: "In einer Strahlungswolke, aber unter einem Schutzraum: Schiffe hier erhalten keine Dosis.",
    windowOpen:
      "Ihre Flotte ist nicht zu Hause. Das ist das Fenster, um das sich das ganze Spiel dreht.",
    distance: "Abstand",
    reach: "Ihre Reichweite",
    reachUnknown: "—",

    headlineFleetAway: "Flotte weg",
    headlineFleetHome: "Flottenheim",
    headlineVeiled: "Verschleiert",
    headlineProbed: "{{age}} geprüft",
    headlineFought: "hat gegen {{age}} gekämpft",
    headlineNone: "Keine Informationen",

    installTelescope: "Installieren Sie ein Teleskop",
    watchSlot: "Watch · Slot {{slot}}",
    replaceSlot: "Slot {{slot}} · ersetzt {{target}}",
    watching: "Beobachten {{target}}",
    sendProbe: "Senden Sie eine Sonde · {{alloy}} Legierung · {{crystal}} Kristall",
    probeAway: "Sonde entfernt · meldet sich in {{duration}} zurück",
    /*
      ONE LOOK PER WORLD PER HOUR (D121). The control says which world is closed
      and for how long, rather than letting the player spend the tap to find out.
    */
    probeCooling: "Sie haben gerade hier nachgesehen · eine weitere Sonde in {{duration}}",
    markRival: "Rivalen markieren",
    rivalMarkedAction: "Rivale",
    rivalMarked: "{{commander}} ist jetzt dein Rivale.",
    rivalCleared: "{{commander}} ist nicht mehr als dein Rivale markiert.",
    rivalHeading: "Deine Geschichte in dieser Saison",
    rivalMarkedBadge: "Markierter Rivale",
    rivalEncounters: "Begegnungen",
    rivalYourRaids: "Deine Überfalls",
    rivalTheirRaids: "Ihre Überfälle",
    rivalDominion: "Dominion",
    rivalDominionValue: "+{{gained}} · −{{lost}}",
    rivalLastContact: "Letzter Kontakt {{age}}",
    rivalProbeOnly:
      "Du hast dir diese Welt angesehen, aber noch hat keine Seite das Feuer eröffnet.",
    rivalNoContact:
      "Du hast diesen Kommandanten markiert. Der erste Schritt zwischen euch wartet noch.",
    rivalAhead:
      "Du hältst die Kante. Sie können noch mehr Dominion von Ihnen zurückgewinnen.",
    rivalBehind: "Sie behalten die Nase vorn. Die Schulden sind noch offen.",
    rivalEven:
      "Das Hauptbuch zwischen Ihnen ist ausgeglichen. Die nächste Begegnung bricht es.",
    rivalFeud: "{{count}} Begegnungen haben dazu geführt, dass dies mehr als ein einzelner Überfall war.",
    rivalPurpose:
      "Pinnt diesen Kommandanten und Ihren gemeinsamen Saisonrekord. Es gewährt keinen Kampf- oder Informationsbonus.",
  },

  asteroid: {
    eyebrow: "Level {{level}} Asteroid",
    title: "Vorbeiziehender Stein",
    summaryOre: "{{amount}} Erz",
    summaryAnomaly: "{{amount}} Erz · Isotopenanomalie",
    working_one: "{{count}} Schiff bearbeitet diesen Stein bereits · {{state}}",
    working_other: "{{count}} Schiff bearbeitet diesen Stein bereits · {{state}}",
    stateReturning: "auf dem Heimweg",
    stateInbound: "eingehend",
    noCraft: "Keine Prospektoren zu Hause",
    tooLate: "Es wird verschwunden sein, bevor Sie ankommen",
    researchNeeded: "Forschungsisotopenspektrometrie zuerst",
    /**
     * THE MINUTE AFTER A TRIP THAT COST NOTHING. D183.
     *
     * The wait is the whole message, so the wait is the whole sentence — a rail
     * that spent a line explaining the rule would be a paragraph doing a design's
     * job. Where the rule came from belongs in the docs, not on the control.
     */
    resting: "Schiff ruht · {{duration}}",
    send: "Senden Sie {{count}} · {{duration}}",
    oreLeft: "Erz übrig",
    leavesIn: "Geht rein",
    composition: "Zusammensetzung",
    compositionValue: "{{percent}} % Kristall",
    compositionUnknown: "Isotopenzusammensetzung unbekannt",
    compositionIsotope: "{{crystal}} % Kristall · {{deuterium}} % Deuterium",
    deuteriumRoute:
      "Schicken Sie Prospektoren, um Deuterium zu bergen. Der Rücktransport landet im Werk; Sammeln Sie es im Lager.",
    speed: "Geschwindigkeit",
    speedValue: "{{rate}}/min",
    spill:
      "Deine Werke können nur noch {{room}} vertragen. Ungefähr {{lost}} dieser Ladung würden bei der Ankunft verloren gehen – leeren Sie sie zuerst.",
    taken: "Jemand hat bereits {{amount}} daraus entnommen.",
    untouched: "Unberührt. Das erste Schiff, das es erreicht, braucht, was es tragen kann.",
    // "{{total}} between them" is nonsense about a single craft, in either language.
    fleetLine_one: "{{count}} Prospektor zu Hause · trägt {{hold}}",
    fleetLine_other:
      "{{count}} Prospektoren zu Hause · jeder trägt {{hold}} · {{total}} zwischen sich",
    derrickPitch:
      "Ein <0>{{name}}</0> im Orbit würde dafür sorgen, dass jeder <1>{{hold}}</1> schneller dort ankommt.",
    intercept:
      "Ihr Schiff würde es in {{reach}} erreichen, mit {{spare}} übrig.",
  },

  craftPicker: {
    label: "Wie viele werden gesendet?",
  },

  debris: {
    eyebrow: "Wrack",
    titleUnknown: "Trümmerfeld",
    titleOver: "Trümmer über {{planet}}",
    summarySalvage: "{{amount}} Bergung",
    working_one: "{{count}} Schiff schon da · {{state}}",
    working_other: "{{count}} Schiff schon da · {{state}}",
    stateReturning: "auf dem Heimweg",
    stateInbound: "eingehend",
    noCraft: "Kein Schiff zu Hause",
    tooLate: "Es wird verschwunden sein, bevor Sie ankommen",
    resting: "Schiff ruht · {{duration}}",
    send: "Senden Sie {{count}} · {{duration}}",
    alloyLeft: "Legierung übrig",
    crystalLeft: "Kristall übrig",
    deuteriumLeft: "Deuterium übrig",
    goneIn: "Eingegangen",
    yourHold: "Ihr Laderaum",
    spill:
      "Deine Werke können nur noch {{room}} vertragen. Ungefähr {{lost}} davon würden bei der Ankunft verloren gehen – leeren Sie sie zuerst.",
    body: "Jemand hat hier eine Flotte verloren. Es verblasst, und jeder kann es sehen – wer zuerst dort ankommt, nimmt, was übrig bleibt.",
  },

  run: {
    eyebrowHome: "Nach Hause kommen",
    eyebrowSalvage: "Bergungslauf",
    eyebrowOutbound: "Ausgehend",
    title_one: "{{count}} Prospektor",
    title_other: "{{count}} Prospektoren",
    homeIn: "Startseite in",
    reachesIn: "Erreicht es",
    meetsRockIn: "Trifft den Fels in",
    target: "Ziel",
    targetWreck: "Wrack über {{planet}}",
    targetWreckAnon: "Trümmer über einer Welt",
    targetDecayed: "Feld ist verfallen",
    targetRock: "Level {{level}} Fels",
    targetRockGone: "Fels ist vorbei",
    carrying: "Trägt eine {{alloy}}-Legierung und einen {{crystal}}-Kristall.",
    carryingDeuterium:
      "Mit {{alloy}}-Legierung, {{crystal}}-Kristall und {{deuterium}} Deuterium.",
    emptySalvage:
      "Ist angekommen und stellt fest, dass das Feld bereits ausgewählt wurde. Komme leer zurück.",
    emptyRock: "Kam an und stellte fest, dass der Stein bereits abgetragen war. Komme leer zurück.",
    salvageNote:
      "Ein Feld bewegt sich nicht und jeder kann es sehen. {{clock}} Wer zuerst dort ankommt, nimmt, was er tragen kann.",
    salvageClock: "Es ist in {{duration}} verschwunden.",
    miningNote:
      "Fliegen dorthin, wo der Stein sein wird, nicht dorthin, wo er ist. Wer zuerst da ist, nimmt mit, was er tragen kann.",
  },

  thread: {
    eyebrowProbeHome: "Sonde kommt nach Hause",
    eyebrowProbeOut: "Probe ausgehend",
    eyebrowFleetHome: "Flotte kehrt zurück",
    eyebrowFleetOut: "Flotte ausgehend",
    arrivesIn: "Kommt an",
    craft: "Schiff",
    craftUnknown: "—",
    returning: "Auf dem Rückweg. Es gibt nichts mehr zu entscheiden.",
    outbound: "Dieser Flug kann nicht zurückgerufen werden.",
    /** A raid or a transfer may be turned once before it arrives (K8). */
    recallable: "Vor der Ankunft kann sie einmal umkehren; der Rückweg dauert so lange wie der bisherige Flug.",
    outboundPirate: "Das Gefecht hat begonnen; dieser Überfall kann nicht mehr umkehren.",
  },

  contact: {
    eyebrowBattle: "Ein Überfall landet",
    eyebrowInbound: "Dieser Kontakt kommt für Sie",
    eyebrowSalvage: "Jemand rettet",
    eyebrowMining: "Jemand schürft",
    eyebrowProbe: "Jemand ist auf der Suche",
    eyebrowMoving: "Jemand bewegt sich",
    titleUnknown: "Nicht identifiziert",
    eyebrowUnknown: "Da draußen ist etwas",
    unknownHint:
      "Außerhalb der Sichtweite Ihres Teleskops. Wenn dieser Kontakt in Sicht kommt, werden der Schiffstyp und bei einer Flotte die genauen Rümpfe und Anzahlen ablesbar.",
    /**
     * RADAR L5 NAMES THE KIND WITHOUT NAMING THE CRAFT.
     *
     * The top of the ladder, paying out on ordinary traffic rather than only on a
     * raid aimed at you. It has to say WHERE the reading came from, or the panel
     * would be claiming sight it does not have — and the fog hides, never lies.
     */
    radarKind: "Radar liest es als {{kind}}. Nichts anderes in diesem Bereich.",
    titleBattle: "Unter Beschuss",
    titleFleet: "Geschwader",
    titleProbe: "-Sonde",
    titleMining: "Mining-Lauf",
    titleHarvest: "Bergungslauf",
    titleDeathStar: "Todesstern",
    titlePirate: "Piratenflotte",
    eyebrowPirate: "Piraten sind da draußen",
    boundaryPirate:
      "Sie können die Piraten selbst sehen und sehen, was sie fliegen. Nichts darüber, woher sie kamen, und nichts über ihre Umlaufbahn – ein Pirat ist eine Position, keine Route.",
    working: "Im Einsatz",
    craftCount: "{{count}} Schiff",
    /**
     * A SILHOUETTE, NOT A ROSTER. D123.
     *
     * The panel used to name every hull in somebody else's squadron, which is what
     * Radar L4 and L5 are sold for. What a stranger reads now is roughly how much
     * is out there — and the word chosen has to make clear it is an estimate, or
     * the interface is quietly claiming a precision the payload does not have.
     */
    massLight: "Kleine Flotte",
    massMedium: "Mittelgroße Flotte",
    massHeavy: "Große Flotte",
    massHint: "Nur Größe – kein Manifest in diesem Bereich.",
    inboundHint:
      "Radar weiß, dass es auf eine Ihrer Welten gerichtet ist. Die Ankunftszeit wird separat als zeitgesteuerte Warnung übermittelt.",
    bombarding: "Bombardierung",
    settling: "Beruhigt sich jetzt",
    unattributed: "Ohne Zuordnung",
    arrivalUnknown: "Ankunft unbekannt",
    inboundNoClock: "Auf Sie gerichtet · keine Ankunftszeit",
    craftLabel: "Schiff",
    craftUnknown: "—",
    statusLabel: "-Status",
    statusLanded: "Gelandet",
    arrivesIn: "Kommt an",
    arrivesUnknown: "Unbekannt",
    boundaryBattle:
      "Eine Flotte ist über dieser Welt und feuert. Befindet es sich im Sichtfeld des Teleskops, ist seine genaue Entstehung sichtbar; wem es gehört, woher es kommt und wer gewinnt ist nicht.",
    boundarySalvage:
      "Ein Bergungslauf ist öffentlich – das Feld, die Route und die Uhr. Was es nach Hause bringt, ist es nicht.",
    boundaryMining:
      "Du hast diesen Felsen entdeckt, daher ist sein Abbauweg sichtbar: Ziel, Route und Uhr. Was nach Hause kommt, bleibt privat.",
    boundaryFleet:
      "Im Visier des Teleskops können Sie das Fahrzeug selbst identifizieren. Für eine Flotte sind die genauen Rümpfe und Anzahlen sichtbar. Sein Besitzer, Herkunft und Ziel sind es nicht.",
    boundaryUnknown:
      "Sie können nur Bewegungen sehen. Art, Größe, Eigentümer, Herkunft und Ziel des Fahrzeugs fehlen in dieser Lesart.",
    telescopeHint:
      "Wenn Sie eine Welt beobachten, erfahren Sie, ob ihre Flotte zu Hause ist. Das sind die Informationen, die Bewegungen auf der Karte in ein mögliches Angriffsfenster verwandeln.",
    wreckHint:
      "Wrack ist öffentlich. Was von beiden Flotten übrig bleibt, wird in Kürze dort im Orbit sein, und jeder kann es holen.",
  },
} as const;

/**
 * KORSAN FİLOLARI — the third thing in the galaxy worth flying at. D150.
 *
 * Every line here has to make the RULE visible: the level, the handicap it buys,
 * the deadline and the odds of towing a ship home. A rule the player cannot see is
 * not a usable rule (D124), and this is the only surface any of them appear on.
 */
export const pirate = {
  title: "Piratenflotte",
  /** Level and callsign together. The callsign is season-unique and leaks no index. */
  name: "Piratenflotte L{{level}}-{{callsign}}",
  level: "Ebene {{level}}",
  eyebrow: "Level {{level}} Piraten",
  /** The one combat modifier in the feature, stated as a number the player can price. */
  damagePenalty: "Diese Flotte verursacht {{percent}} % weniger Schaden",
  /** Opens the same commitment sheet a raid on a world opens. D150. */
  attack: "Angriff",
  yourFleet: "Ihre Flotte",
  atHome: "{{count}} zu Hause",
  fewer: "Weniger {{name}}",
  more: "Mehr {{name}}",
  quantity: "Wie viele {{name}}",
  max: "Alle {{name}} senden",
  maxShort: "Max",
  noShipsAtHome: "Keine Schiffe auf dieser Welt zum Senden.",
  eyebrowUnknown: "Unbekannter Kontakt",
  pickShips: "Wähle mindestens ein Schiff",
  fuelCost: "Treibstoff {{amount}} Deuterium",
  noFuel: "Nicht genügend Deuterium für den Hin- und Rückflug",
  noBay: "Keine freie Flugbucht",
  tooSlow: "Dein langsamstes Schiff kann es nicht fangen",
  roster: "Besatzung",
  rosterUnknown: "Besatzung in dieser Entfernung unbekannt",
  unknownContact: "Unbekannter Kontakt",
  mass: "Masse",
  leavesIn: "Geht rein",
  reach: "Erreicht es in {{duration}}",
  reachLabel: "Sie kommen an",
  /**
   * WHAT THE CREW IS WORTH, ON THE SHEET'S OWN AXIS. D183.
   *
   * "Strength" rather than "value": both numbers on the comparison a tap later are
   * resource value, and a rail that named the unit would be explaining arithmetic
   * where the player only needs to know which figure is bigger.
   */
  strengthLabel: "Feuerkraft",
  tooLate: "Es verlässt das Gebiet, bevor Sie es erreichen können",
  unreachable: "Nichts auf dieser Welt könnte es fangen",
  alreadyRaiding: "Auf dieser Welt gibt es bereits einen Überfall",
  outOfSight: "Nicht auf Ihren Sensoren",
  noShips: "Keine Schiffe zu Hause",
  captureHint: "Bei einem entscheidenden Sieg erhalten Sie möglicherweise ein Schiff seiner Besatzung",
  captured: "{{hull}} erfasst",
  captureMissed: "Nichts mehr übrig, was es wert wäre, nach Hause geschleppt zu werden",
  send: "Senden Sie {{count}} · {{duration}}",
  outbound: "Einen Piratenüberfall kannst du vor Gefechtsbeginn einmal zurückrufen.",
  holdsHint: "Sind seine Kriegsschiffe gefallen, können seine Frachter nicht entkommen – auch sie gehören dir.",
  /**
   * YOU CANNOT SEE THIS ONE — WHICH IS NOT THE SAME AS "THIS IS OLD". D160.
   *
   * The line says what the faded craft on the disc says: no circle of yours covers
   * it, and it is here because you identified it once. The figures are still
   * current — an orbit is solvable and the crew is the lane's live state, exactly
   * as a rock you have found keeps reporting its remaining ore.
   */
  remembered: "Verfolgt, seit Sie es identifiziert haben · derzeit nicht auf Ihren Sensoren",
  /** The boundary, stated — the same job the contact panel's last line does. */
  boundary:
    "Ein identifizierter Pirat bleibt bis zur Zerstörung oder zum Ablauf gelistet. Außerhalb der Sensorreichweite bleiben Route und bekannte Besatzung sichtbar. Die Live-Sicht hängt weiter von der Reichweite ab.",
  hoardHint: "Was Sie nach Hause tragen, wird durch die von Ihnen mitgebrachten Laderäume begrenzt.",
} as const;
