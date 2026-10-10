/**
 * THE CHROME THAT NEVER LEAVES — the header, the in-flight strip, Signals, and
 * the furniture every surface is built out of.
 */

export const statusBar = {
  activeWorld: 'Aktive Welt',
  capitalWorld: 'HEIMATWELT · {{name}}',
  colonyWorld: 'KOLONIE · {{name}}',
  alloyLabel: 'Legierung',
  crystalLabel: 'Kristall',
  deuteriumLabel: 'Deuterium',
  /** The store's ceiling, stated as space. */
  storeFull: 'VOLL',
  storeFree: '{{amount}} frei',
  /**
   * THE MENU CONTROL. Owner decision: the header's right-hand end had grown to
   * three controls plus a beacon and had run out of room for a fourth.
   *
   * It says what is behind it rather than saying "menu", because D54's bug was a
   * control labelled as something other than what it opened.
   */
  /*
    IT NAMES WHAT IS ACTUALLY BEHIND IT, and it used to promise Intel — which
    moved onto the disc with research and the clan. A control whose name lists a
    surface it cannot reach is D54's bug wearing an accessible name instead of a
    face, and this string is what a screen reader and the screenshot harness read.
    The four groups the sheet is built from, in the order it draws them.
  */
  menuHint: 'Kommandant {{name}} – Rangliste, Belohnungen, Ankündigungen, Hilfe und Konto',
  menuWaiting: '{{count}} Belohnungen warten',
  clanWaiting: '{{count}} Clan-Updates warten',
  newcomerShield: {
    hint: 'Du bist noch {{duration}} vor Überfällen geschützt',
  },
  recoveryShield: {
    hint: 'Schutzschild: Noch {{duration}} lang kann dich niemand überfallen',
  },
  recoveryBoost: {
    mark: 'Produktion +50 %',
    note: 'Während des Schutzes produziert deine Welt 50 % mehr',
  },
  bays: {
    hint: '{{used}} von {{total}} Startrampen belegt',
    label: 'Startrampen',
    free: '{{count}} frei',
  },
  works: {
    label: 'Produktionslager',
    labelFull: 'Produktionslager voll',
    collect: 'Abholen',
    firstTip: "Hole Ressourcen aus dem Produktionslager in den Speicher, um sie auszugeben.",
    fullStopped: 'Voll — Produktion gestoppt',
    fillsIn: 'voll in {{time}}',
    gathers: 'Die Produktion sammelt sich hier, bis du sie abholst',
    idle: '—',
    hintFull: 'Das Produktionslager ist voll – hol die Ressourcen ab',
    hintCollect: '{{amount}} abholen',
    /** Each waiting resource by name, in the bubble's accessible name (owner, 2026-09-24). */
    alloy: '{{amount}} Legierung',
    crystal: '{{amount}} Kristall',
    deuterium: '{{amount}} Deuterium',
    collected: '{{amount}} abgeholt',
    collectedPartly: "{{moved}} in den Speicher gesammelt · {{held}} bleibt in dem Produktionslager",
    storeFull: 'Speicher voll',
  },
} as const;

export const pendingStrip = {
  empty: 'Nichts im Flug',
  openFlights: 'Offene Flüge',
  sheetEyebrow: 'Deine Flüge',
  sheetTitle: 'Im Flug',
  sheetEmpty: 'Noch ist nichts in der Luft.',
  incoming: 'Inbound-Flotte',
  /**
   * AND WHICH WORLD IT IS COMING FOR. Not a radar product — it is your own world.
   * With four of them, "inbound fleet · 6 min" does not say where to move.
   */
  incomingAt: 'Eingehend → {{world}}',
  incomingFromAt: 'Eingehend → {{world}} · von {{origin}}',
  probe: 'Ihre Sonde → {{target}}',
  deathStar: 'Dein Todesstern → {{target}}',
  settlement: 'Besiedlung → {{target}}',
  transfer: 'Übertragung → {{target}}',
  pirateOut: 'Überfall → {{target}}',
  pirateHome: 'Überfall kehrt zurück · {{target}}',
  /*
    THE MERCHANT IS NAMED HERE, NOT ON THE SERVER. D156.

    A `trade` thread carries the event-kind identifier `TRADE_SHIP` and no world,
    because there is no world on the far end and the server has never written
    user-facing copy. Without these two lines the strip printed that identifier.
  */
  tradeOut: 'Konvoi → Handelsschiff',
  tradeHome: 'Konvoi kehrt zurück · Handelsschiff',
  intergalacticConvoyOut: 'Angriff → Intergalaktischer Konvoi',
  intergalacticConvoyHome: 'Der Angriff kehrt zurück · Intergalaktischer Konvoi',
  fleetHome: 'Deine Flotte kehrt von {{target}} zurück',
  fleetOut: 'Ihre Flotte → {{target}}',
  engaging: 'Im Gefecht',
  more: '+{{count}}',
  drillOut: 'Deine Prospector → Asteroid',
  drillHome: 'Deine Prospector kehren zurück',
  salvageOut: 'Deine Prospector → Wrack',
  drillCount: '{{count}} Prospektoren',
  recallProspectors: 'Prospector zurückrufen',
  recallFleet: "Flotte zurückrufen",
  recallingFleet: "Wird zurückgerufen",
  recallFleetStarted: "Dreht heimwärts – so lange wie der Hinflug dauerte.",
  recallingProspectors: 'Rückruf läuft…',
  recallStarted: 'Die Prospector haben umgedreht und kehren zurück',
  craftCount: '{{count}} Schiff',
  craftUnknown: 'Schiffstypen unbekannt',
  incomingHint: 'Eingehende Warnung · Ursprung durch Nebel verdeckt',
  /**
   * THE SAME WARNING, WHEN THE CRAFT IS ON YOUR DISC. D162.
   *
   * The origin is still unsold — that is the top of the radar ladder — but saying
   * "hidden by fog" over a fleet the commander can watch crossing their own circle
   * reads as the interface disagreeing with the picture.
   */
  incomingVisible: 'Eingehende Warnung · auf Ihren Sensoren – tippen Sie, um nachzuschauen',
  /**
   * THE RADAR LADDER, FINALLY WORTH CLIMBING. D123.
   *
   * L3 is the warning. L4 adds the size, which is what turns "something is coming"
   * into a choice between spending the stock, flying the fleet out and standing.
   * L5 names the world it left, and a named world is what a warning has to become
   * before it is a grudge.
   */
  incomingFrom: 'Eingehend von {{origin}}',
  massLight: 'Kleine Flotte im Anflug',
  massMedium: 'Eingehende mittelgroße Flotte',
  massHeavy: 'Große Flotte im Anflug',
} as const;

export const signals = {
  beacon: 'Signale',
  beaconUnread: 'Signale – {{count}} ungelesen',
  title: 'Signale',
  eyebrowUnread: '{{count}} neu',
  eyebrowRead: 'Alles was Ihnen gesagt wurde',
  statusHeading: 'Im Moment',
  eventsHeading: 'Was ist passiert?',
  openEvent: 'Zugehöriger Bericht öffnen',
  /** The eyebrow on a galaxy-wide row, so it is never mistaken for personal news. */
  worldEvent: 'Galaxie-Ereignis',
  empty:
    "Noch keine Benachrichtigungen. Flottenwarnungen, erkannte Sonden und zurückkehrende Schiffe erscheinen hier.",
  repeat: '×{{count}}',

  /** The states that are true right now, rather than things that happened. */
  status: {
    disruptedLine: 'Deine Werke sind offline',
    disruptedDetail: 'Überfallen. Die Produktion wird in {{duration}} wieder aufgenommen.',
    worksStoppedLine: 'Die Arbeiten wurden eingestellt',
    worksStoppedDetail: 'Die Arbeiten sind voll. Die Produktion wird bei {{amount}} pro Stunde pausiert, bis Sie die Ware abholen.',
    alloyStoreLine: 'Legierungslager ist voll',
    crystalStoreLine: 'Kristallspeicher ist voll',
    storeDetail: "{{amount}} Ressourcen warten in dem Produktionslager. Gib gelagerte Ressourcen aus oder erhöhe die Kapazität, um Platz zu schaffen.",
  },
} as const;

/** The bottom sheet every decision is made from. */
export const sheet = {
  /*
    A SHEET OPENED FROM THE MENU HAS SOMEWHERE TO GO BACK TO, and that is a
    different word from "close". See `Sheet`'s own note.
  */
  back: 'Zurück',
  close: 'Schließen',
  dismiss: 'Schließen',
} as const;

export const toast = {
  dismiss: 'Nachricht verwerfen',
} as const;

/** Loading, failure and emptiness, wherever a whole surface is in one of them. */
export const surface = {
  unreachable: '{{what}} konnte nicht erreicht werden.',
  retry: 'Erneut versuchen',
  /** What each caller of `Unreachable` is naming. */
  whatPlanet: 'dein Planet',
  whatIntel: 'deine Aufklärung',
  whatReports: 'deine Kampfberichte',
  whatRewards: 'deine Belohnungen',
  whatLeaderboard: 'die Rangliste',
  whatChat: 'Galaxie-Chat',
  whatChronicle: 'die Galaxiechronik',
  whatAnnouncements: 'die Ankündigungen',
  whatAdminFeedback: 'Spieler-Feedback',
  waitingPlanet: 'Planet wird geladen',
  waitingIntel: 'Aufklärung wird geladen',
  waitingLeaderboard: 'Rangliste wird geladen',
  waitingChat: 'Galaxie-Chat wird geöffnet',
  waitingChronicle: 'Die Galaxie lesen',
  /** The generated crest a world wears. One element, used on two surfaces. */
  planetSigil: 'Planet',
} as const;

/**
 * THE MENU — one way in to everything that is not the galaxy.
 *
 * Every string here is its own, including the ones that read like a label
 * somewhere else: the row that opens Intel is not the header button that used to,
 * and the day one of them is reworded the other must not move with it.
 */
export const menu = {
  /* The card the Commander page opens on: who, where, and how you stand (owner, 2026-09-24). */
  profile: {
    label: 'Dein Kommandant',
    noClan: 'Kein Clan',
    seasonDay: 'Saisontag {{day}}',
    rank: 'Rang',
    worlds: 'Welten',
    shield: 'Schild',
    shieldNone: 'Keiner',
  },
  eyebrow: 'Kommandant',
  /*
    THE GROUP NAMES. Four words doing the work nine identical rows could not: a
    reader should be able to tell WITHOUT reading the rows that the leaderboard
    and the sound slider are different kinds of thing.
  */
  seasonHeading: 'Diese Saison',
  asteraHeading: 'Astera-Team',
  helpHeading: 'Hilfe',
  deviceHeading: 'Dieses Gerät',
  marksHeading: 'Deine Noten',
  intelLabel: 'Intel',
  intelHint: 'Teleskop, Sonden, Radar und Kampfberichte',
  rewardsLabel: 'Belohnungen',
  rewardsHint: "Hole Ressourcenbelohnungen für erreichte Ziele ab",
  /*
    The hint is this row's accessible name (see `MenuRow`), so it says what the
    page IS. It no longer promises a new tab, because the row no longer opens
    one — a hint that describes the old behaviour is worse than none.
  */
  guideLabel: 'Wiki',
  guideHint: 'Gebäude, Schiffe und die Regeln der Galaxie',
  rewardsWaiting: '{{count}} bereit',
  /** T12: research is a commander's, not a world's, so its way in is here. */
  researchLabel: 'Forschung',
  researchHint: "Sieh die gemeinsame Forschung deiner Welten und ihre Voraussetzungen",
  leaderboardLabel: 'Bestenliste',
  leaderboardHint: 'Jeder Kommandant, geordnet nach Dominion',
  announcementsLabel: 'Ankündigungen',
  announcementsHint: 'Neuigkeiten, Updates und Notizen vom Astera-Team',
  announcementsWaiting: '{{count}} neu',
  feedbackLabel: 'Feedback',
  feedbackHint: "Melde ein Problem oder sende Feedback und Vorschläge",
  skinsShopLabel: 'Shop',
  skinsShopHint: "Modelle, Effekte und Preise ansehen",
  skinsInventoryLabel: 'Inventar',
  skinsInventoryHint: "Designs ansehen und ausrüsten",
  clanLabel: 'Clan',
  clanHint: "Tritt einem Clan bei oder gründe einen mit bis zu fünf Kommandanten",
  clanMemberLabel: 'Clan · [{{tag}}]',
  clanMemberHint: "Mitglieder, Hilfe, gemeinsame Beute, Clanverlauf und Chat",
  clanWaiting: '{{count}} wartet',
  rivalLabel: 'Rivale · {{commander}}',
  rivalHint: 'Fokussiere {{planet}} und wähle deinen nächsten Zug',
  rivalLostLabel: 'Rivalensignal verloren',
  /** The chip's own face. The sentence above is still its accessible name. */
  rivalLostShort: 'Markierung verloren',
  rivalLostHint: 'Diese Welt ist verschwunden. Löschen Sie die Markierung.',
  rivalCleared: 'Der verlorene Rival-Marker wurde gelöscht.',
  accountHeading: 'Konto',
  soundLabel: 'Ton',
  soundOn: 'Die Partitur wird abgespielt.',
  soundOff: 'Auf diesem Gerät stummgeschaltet.',
  volumeLabel: 'Musiklautstärke',
  volumeValue: '{{volume}}%',
  /**
   * WHICH OF THE NINE IS SOUNDING. The count is part of the label on purpose: "3"
   * alone is a number, "3 / 9" is a position — it says how far the arrows reach
   * and that there is something on the other side of them.
   */
  trackLabel: 'Verfolgen Sie {{index}} / {{total}}',
  trackPrev: 'Vorheriger Titel',
  trackNext: 'Nächster Titel',
  trackClock: '{{position}} / {{duration}}',
  /**
   * RESOLUTION. Three rungs, one word each — all three share a 350-wide row. The
   * line beneath belongs to the chosen rung: a rung's name does not say what it
   * buys, and the sentence does.
   */
  qualityLabel: 'Bildqualität',
  quality: {
    high: 'Hoch',
    balanced: 'Ausgeglichen',
    low: 'Niedrig',
  },
  qualityHint: {
    high: "Höchste Bilddetails. Kann mehr Akku verbrauchen.",
    balanced: "Senkt die Auflösungsgrenze und entlastet die Grafik. Wärme und Akkuverbrauch hängen von deinem Gerät ab.",
    low: "Niedrigste Auflösungsgrenze. Kantenglättung bleibt aktiv; Bilddetails können abnehmen.",
  },
  fpsLabel: 'Bildrate',
  fpsOn: 'An',
  fpsOff: 'Aus',
  fpsHint: "Bilder, die die Galaxie pro Sekunde zeichnet. Ein höherer Wert bedeutet flüssigere Bewegung.",
} as const;

export const leaderboard = {
  eyebrow: 'Die lokale Galaxie',
  title: 'Bestenliste',
  empty: 'Bisher sind noch keine Kommandeure dieser Galaxie beigetreten.',
  rank: 'Rang {{rank}}',
  score: 'Dominion',
  you: 'Du',
  nearby: 'Deine nächsten Rivalen',
  searchLabel: 'Suche nach Kommandanten, Planeten oder Clans',
  searchPlaceholder: 'Kommandant, Planet oder Clan',
  noMatch: 'Kein Kommandant, Planet oder Clan entspricht dieser Suche.',
  locationUnknown: "Sie haben den Standort dieses Kommandanten noch nicht ermittelt.",
  /*
    THE IN-SEASON PRIZE — the answer to "what am I playing for".
    It sits directly above the standings, because that is where the decision is.
  */
  rewards: {
    title: 'Preis zum Saisonende',
    left: '{{duration}} übrig',
    explain: 'Die ersten {{places}} Plätze können Ressourcen für die nächste Galaxie gewinnen. Bots behalten ihren Platz, erhalten aber keinen Preis; Kommandeure brauchen mindestens {{minimum}} Dominion.',
    table: 'Preis nach Ort',
    tableCount: 'Top {{places}} Orte · zur Inspektion geöffnet',
    place: 'Rang {{place}}',
    holding: 'Rang {{place}} · Sie gewinnen hier',
    paidWhen: 'Es landet in dem Moment, in dem Sie Ihre Welt in der neuen Saison gefunden haben.',
    standing: 'Rang {{place}}',
    behind: '{{score}} mehr Dominion, um die Spitze zu erreichen {{places}}.',
    minimum: '{{score}} mehr Dominion für einen Preis erforderlich.',
    botIneligible: 'Bots behalten ihren Rang, erhalten aber keinen Saisonpreis.',
    climb: 'Erreiche die Spitze {{places}} und nimm es.',
    unranked: 'Treten Sie dieser Galaxie bei, um an der Rangliste teilzunehmen.',
  },
  archive: {
    selectorLabel: 'Saisonrekorde',
    archiveIndex: 'Saisonrekorde',
    waitingArchive: 'Saisondatensätze werden geladen',
    live: 'Live-Saison',
    seasonChoice: 'Saison {{ordinal}} · {{galaxy}}',
    seasonNumber: 'Saison {{ordinal}}',
    seasonHeading: 'Saison {{ordinal}} · {{galaxy}}',
    /* A rank is not a boast without its field — first of four reads like first of three hundred. */
    percentile: 'Top {{share}} % · {{rank}} der {{commanders}} Kommandeure',
    fieldSize: '{{count}} Kommandeure',
    medals: 'Trophäen',
    signature: 'Ihr Signaturschiff',
    leadWorks: 'Produktion',
    leadProduced: 'Gesamtproduktion',
    leadRuns: 'von {{count}} Asteroidenläufen',
    signatureCount: 'Sie haben {{count}} erstellt',
    multiple: '×{{value}}',
    share: '{{value}}%',
    loadingOlder: 'Ältere Staffeln werden geladen',
    completedBoard: 'Saison-Rangliste abgeschlossen',
    waitingBoard: 'Öffnen der fertigen Bestenliste',
    emptyBoard: 'Für diese Galaxie wurden keine Commander-Ergebnisse aufgezeichnet.',
    searchLabel: 'Durchsuchen Sie die abgeschlossene Staffel nach Kommandant',
    searchPlaceholder: 'Kommandant',
    noMatch: 'Kein Kommandant entspricht dieser Suche.',
    galaxyRecord: {
      title: 'Galaxiechronik', subtitle: "Aufgezeichnete Saisonergebnisse dieser Galaxie",
      champion: 'Champion', clans: 'Clan-Podium',
      biggestBattle: 'Größte bestätigte Schlacht', dominionSwing: 'Stärkste Dominion-Änderung',
      contestedWorld: 'Umkämpfteste Welt',
      battleLine: '{{attacker}} → {{defender}} bei {{planet}} · {{value}} verloren',
      swingLine: '{{attacker}} → {{defender}} · {{amount}} Dominion',
      worldLine: '{{planet}} · {{count}} Konflikteinträge',
    },
    openCommander: 'Offener {{commander}} Saisonrekord',
    openSeasonRecord: 'Offene Saison {{ordinal}} · {{galaxy}} Datensatz\nSaisonrekord des',
    commanderCard: '-Kommandanten',
    waitingProfile: 'Öffnen des Commander-Datensatzes',
    back: 'Zurück zur Saisonwertung',
    profileViews: 'Commander-Datensatzansichten',
    seasonTab: 'Saison {{ordinal}}',
    overall: 'Insgesamt',
    cohort_one: 'Andere = der Durchschnitt aller {{count}} Kommandanten in dieser Saison',
    cohort_other: 'Andere = der Durchschnitt aller {{count}} Kommandeure in dieser Saison',
    /** The three-column breakdown truncates; the long sentence is said once above. */
    averageShort: 'Andere: {{value}}',
    statsUnavailable: 'Für diese Saison wurden keine detaillierten Aufzeichnungen geführt.',
    statsUnavailableHint: 'Ihr Rang und Titel bleiben erhalten. Was nie gemessen wurde, wird nicht als Null angezeigt.',
    legacyStats: {
      title: 'Konservierter Saisonrekord',
      hint: 'Aufgezeichnete Kampffiguren werden angezeigt. Wirtschaftlichkeit, Flottenproduktion und Exploration wurden nicht gemessen und werden weggelassen.',
    },
    partialStats: {
      title: "Unvollständiger Aktivitätsverlauf",
      hint: "Aktivitäten vor Beginn der Aufzeichnung können fehlen. Die angezeigten Summen umfassen aufgezeichnete Aktivitäten.",
    },
    forcedEnd: {
      title: 'Saison vorzeitig beendet',
      hint: "Die Saison wurde mit Rangliste und Belohnungen zum Zeitpunkt ihres vorzeitigen Endes gespeichert.",
    },
    none: 'Keine',
    ratios: {
      trade: 'Schaden gehandelt',
      haul: 'Beute pro Überfall',
      kept: 'Flotte gehalten',
      convoy: 'Konvoi-Trefferquote',
      hourly: 'Leistung pro Stunde',
      perRun: 'Transport pro Lauf',
    },
    sections: {
      form: 'Form & Effizienz',
      competition: 'Wettbewerb und Kampf',
      economy: 'Wirtschaft & Produktion',
      exploration: 'Exploration und Gelegenheit',
    },
    metrics: {
      finalRank: 'Endgültiger Rang',
      battles: 'Schlachten',
      shipsBuilt: 'Schiffe gebaut',
      shipsLost: 'Schiffe verloren',
      shipsBuiltByHull: 'Schiffe nach Typ gebaut',
      shipsLostByHull: 'Verlorene Schiffe nach Typ',
      playerLoot: 'Beute von Kommandanten',
      productiveTime: 'Produktionszeit, alle Welten',
      produced: 'Produziert von den Werken',
      asteroidRuns: 'Asteroid läuft',
      asteroidMined: 'Aus Asteroiden gewonnen',
      convoyAttempts: 'Konvoi-Versuche',
      convoySuccesses: 'Konvoi-Erfolge',
      convoyDelivered: 'Konvoi-Belohnungen geliefert',
    },
    resources: {
      alloy: 'Legierung',
      crystal: 'Kristall',
      deuterium: 'Deuterium',
    },
    career: {
      completed: 'Abgeschlossene Staffeln',
      bestRank: 'Bester Rang',
      championships: '-Meisterschaften',
      podiums: 'Podien',
      topTen: 'Top-10-Platzierungen',
      noTelemetry: 'Für keine abgeschlossene Saison gibt es noch eine detaillierte Aufzeichnung.',
      recordedCombatTotals: 'Aufgezeichnete Kampfsummen',
      recordedTotals: 'Erfasste Karriere-Gesamtzahlen',
      covered_one: '{{count}} Saison abgedeckt',
      covered_other: '{{count}} Staffeln abgedeckt',
      coveredWithPartial: "{{count}} Saisons aufgezeichnet · {{partial}} mit unvollständigem Aktivitätsverlauf",
      seasons: 'Saison für Saison',
    },
  },
} as const;

export const chat = {
  previousSeasonPlace: "Vorige Saison · Platz {{rank}}",
  supporterBadge: "Astera-Unterstützer",
  supporterExplanation: "Unterstützt Astera Online.",
  previousSeasonExplanation: "Hat die vorige Saison auf Platz {{rank}} beendet.",
  eyebrow: 'Live-Kanäle',
  title: 'Chat',
  launcher: 'Galaxie-Chat öffnen',
  launcherUnread: 'Galaxie-Chat öffnen – {{count}} ungelesen',
  launcherClanUnread: 'Chat öffnen – {{count}} im Clan ungelesen',
  launcherBothUnread: 'Chat öffnen – {{general}} ungelesen in Allgemein, {{clan}} im Clan',
  channelsLabel: 'Chat-Kanäle',
  languageLabel: 'Chatsprache',
  general: 'Allgemein',
  clan: 'Clan',
  dm: {
    title: 'DM', loading: 'Direktnachrichten werden geöffnet', conversations: 'Direktnachrichten',
    start: 'Neue Direktnachricht', closeTab: 'Tab {{name}} schließen', searchLabel: 'Kommandanten suchen',
    searchPlaceholder: 'Kommandanten suchen', cancel: 'Abbrechen', contacts: 'Kommandanten',
    noContacts: 'Kein verfügbarer Kommandant gefunden.', empty: 'Wähle einen Kommandanten für ein privates Gespräch.',
    emptyConversation: 'Sag {{name}} Hallo.', list: 'Nachrichten mit {{name}}',
    placeholder: 'Nachricht an {{name}}', waitingHint: 'Dieser Kommandant ist in Silent Space. Nach der Rückkehr könnt ihr weiterschreiben.',
    seasonEndedHint: 'Diese Saison ist beendet. Direktnachrichten beginnen in der nächsten Saison neu.',
    blockedHint: 'Solange einer der Kommandanten den anderen blockiert, sind keine Nachrichten möglich.',
    block: '{{name}} blockieren', unblock: '{{name}} entsperren', blockShort: 'Blockieren', unblockShort: 'Entsperren',
  },
  channelUnread: '{{channel}} – {{count}} ungelesen',
  clanLocked: 'Der Clan-Chat ist für eine Crew privat.',
  clanLockedHint: 'Tritt einem Clan bei oder gründe einen, dann öffnet sich dieser Kanal sofort.',
  list: 'Nachrichten der Galaxie',
  empty: 'Hier hat noch niemand etwas geschrieben. Sei die erste Stimme in der Galaxie.',
  older: 'Ältere Nachrichten laden',
  loadingOlder: 'Ältere Nachrichten werden geladen',
  placeholder: 'Nachricht an die Galaxie',
  send: 'Senden',
  messageActions: 'Aktionen für Nachricht von {{name}}',
  addReaction: 'Emoji-Reaktion hinzufügen',
  reactions: 'Reaktionen',
  reactionCount: '{{emoji}} {{count}} Reaktionen',
  chooseReaction: 'Emoji auswählen',
  reactWith: 'Mit {{emoji}} reagieren',
  reply: 'Antworten',
  replyingTo: 'Antwort an {{name}}',
  cancelReply: 'Antwort abbrechen',
  remaining: '{{count}} Zeichen übrig',
  time: {
    justNow: 'gerade eben',
    minutes_one: 'vor {{count}} Minute',
    minutes_other: 'vor {{count}} Minuten',
    hours: 'vor {{hours}} Std. {{minutes}} Min.',
    days_one: 'vor {{count}} Tag',
    days_other: 'vor {{count}} Tagen',
  },
} as const;

/**
 * THE SCREEN THAT REPLACES A BLANK ONE.
 *
 * Written for somebody who has just lost what they were looking at, so it says
 * what happened, what it cost them — nothing — and what to do, in that order.
 * "The galaxy is untouched" is a fact, not a comfort: the server is the only
 * authority and this failure never left the phone.
 *
 * The technical detail behind these labels is deliberately NOT translated. It is
 * pasted into a message to the person who will fix it. See `shell/crashReport.ts`.
 */
export const crash = {
  title: "Die Spieloberfläche funktioniert nicht mehr",
  body: "Lade die Seite neu. Die letzte Aktion ist möglicherweise unbestätigt; prüfe danach den aktuellen Stand.",
  reload: 'Neu laden',
  detailShow: 'Details anzeigen',
  detailHide: 'Details ausblenden',
  /** What the developer needs, in the one gesture a phone can make. */
  copy: 'Bericht kopieren',
  copied: 'Kopiert – senden Sie es uns',
  copyFailed: 'Konnte nicht kopiert werden. Machen Sie stattdessen einen Screenshot des Details.',
} as const;
