/**
 * THE CHROME THAT NEVER LEAVES — the header, the in-flight strip, Signals, and
 * the furniture every surface is built out of.
 */

export const statusBar = {
  activeWorld: 'Active world',
  capitalWorld: 'CAPITAL · {{name}}',
  colonyWorld: 'COLONY · {{name}}',
  alloyLabel: 'Alloy',
  crystalLabel: 'Crystal',
  deuteriumLabel: 'Deuterium',
  /** The store's ceiling, stated as space. */
  storeFull: 'FULL',
  storeFree: '{{amount}} free',
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
  menuHint: 'Commander {{name}} — leaderboard, rewards, announcements, help and account',
  menuWaiting: '{{count}} rewards waiting',
  clanWaiting: '{{count}} clan updates waiting',
  newcomerShield: {
    hint: 'You cannot be raided for {{duration}}',
  },
  recoveryShield: {
    hint: 'Recovery shield — you cannot be raided for {{duration}}',
  },
  recoveryBoost: {
    mark: 'Output boosted +100%',
    note: '+100% output while shielded',
  },
  bays: {
    hint: '{{used}} of {{total}} flight bays in use',
    label: 'Bays',
    free: '{{count}} free',
  },
  works: {
    label: 'Works',
    labelFull: 'Works full',
    collect: 'Collect',
    idle: '—',
    hintFull: 'Works are full — collect now',
    hintCollect: 'Collect {{amount}}',
    collected: 'Collected {{amount}}',
    collectedPartly: 'Collected {{moved}} · {{held}} would not fit',
    storeFull: 'Store full',
  },
} as const;

export const pendingStrip = {
  empty: 'Nothing in flight',
  openFlights: 'Open flights',
  sheetEyebrow: 'Your airborne craft',
  sheetTitle: 'In flight',
  sheetEmpty: 'Nothing is airborne yet.',
  incoming: 'Inbound fleet',
  /**
   * AND WHICH WORLD IT IS COMING FOR. Not a radar product — it is your own world.
   * With four of them, "inbound fleet · 6 min" does not say where to move.
   */
  incomingAt: 'Inbound → {{world}}',
  incomingFromAt: 'Inbound → {{world}} · from {{origin}}',
  probe: 'Your probe → {{target}}',
  deathStar: 'Your Death Star → {{target}}',
  settlement: 'Settlement → {{target}}',
  transfer: 'Transfer → {{target}}',
  pirateOut: 'Raid → {{target}}',
  pirateHome: 'Raid returning · {{target}}',
  /*
    THE MERCHANT IS NAMED HERE, NOT ON THE SERVER. D156.

    A `trade` thread carries the event-kind identifier `TRADE_SHIP` and no world,
    because there is no world on the far end and the server has never written
    user-facing copy. Without these two lines the strip printed that identifier.
  */
  tradeOut: 'Convoy → Trade Ship',
  tradeHome: 'Convoy returning · Trade Ship',
  intergalacticConvoyOut: 'Strike → Intergalactic Convoy',
  intergalacticConvoyHome: 'Strike returning · Intergalactic Convoy',
  fleetHome: 'Your fleet home from {{target}}',
  fleetOut: 'Your fleet → {{target}}',
  engaging: 'Engaging',
  more: '+{{count}}',
  drillOut: 'Your drills → asteroid',
  drillHome: 'Your drills returning home',
  salvageOut: 'Your drills → wreckage',
  drillCount: '{{count}} Prospectors',
  recallProspectors: 'Recall Prospectors',
  recallingProspectors: 'Recalling…',
  recallStarted: 'Prospectors turned around · returning home',
  craftCount: '{{count}} craft',
  craftUnknown: 'Craft manifest unavailable',
  incomingHint: 'Inbound warning · origin hidden by fog',
  /**
   * THE SAME WARNING, WHEN THE CRAFT IS ON YOUR DISC. D162.
   *
   * The origin is still unsold — that is the top of the radar ladder — but saying
   * "hidden by fog" over a fleet the commander can watch crossing their own circle
   * reads as the interface disagreeing with the picture.
   */
  incomingVisible: 'Inbound warning · on your sensors — tap to look',
  /**
   * THE RADAR LADDER, FINALLY WORTH CLIMBING. D123.
   *
   * L3 is the warning. L4 adds the size, which is what turns "something is coming"
   * into a choice between spending the stock, flying the fleet out and standing.
   * L5 names the world it left, and a named world is what a warning has to become
   * before it is a grudge.
   */
  incomingFrom: 'Inbound from {{origin}}',
  massLight: 'Small fleet inbound',
  massMedium: 'Mid-sized fleet inbound',
  massHeavy: 'Large fleet inbound',
} as const;

export const signals = {
  beacon: 'Signals',
  beaconUnread: 'Signals — {{count}} unread',
  title: 'Signals',
  eyebrowUnread: '{{count}} new',
  eyebrowRead: 'Everything you have been told',
  statusHeading: 'Right now',
  eventsHeading: 'What happened',
  openEvent: 'Open related report',
  /** The eyebrow on a galaxy-wide row, so it is never mistaken for personal news. */
  worldEvent: 'Galaxy event',
  empty:
    'Nothing yet. The galaxy tells you when a fleet moves against you, when a probe is caught, and when your own ships come home.',
  repeat: '×{{count}}',

  /** The states that are true right now, rather than things that happened. */
  status: {
    disruptedLine: 'Your works are offline',
    disruptedDetail: 'Raided. Production resumes in {{duration}}.',
    worksStoppedLine: 'The works have stopped',
    worksStoppedDetail: 'The Works are full. Production is paused at {{amount}} per hour until you collect.',
    alloyStoreLine: 'Alloy store is full',
    crystalStoreLine: 'Crystal store is full',
    storeDetail: '{{amount}} is waiting in the works with nowhere to go. Spend something.',
  },
} as const;

/** The bottom sheet every decision is made from. */
export const sheet = {
  /*
    A SHEET OPENED FROM THE MENU HAS SOMEWHERE TO GO BACK TO, and that is a
    different word from "close". See `Sheet`'s own note.
  */
  back: 'Back',
  close: 'Close',
  dismiss: 'Close',
} as const;

export const toast = {
  dismiss: 'Dismiss message',
} as const;

/** Loading, failure and emptiness, wherever a whole surface is in one of them. */
export const surface = {
  unreachable: 'Could not reach {{what}}.',
  retry: 'Try again',
  /** What each caller of `Unreachable` is naming. */
  whatPlanet: 'your planet',
  whatIntel: 'what you know',
  whatReports: 'your battle reports',
  whatRewards: 'your rewards',
  whatLeaderboard: 'the Dominion ladder',
  whatChat: 'galaxy chat',
  whatChronicle: 'the Galaxy Chronicle',
  whatAnnouncements: 'the announcements',
  whatAdminFeedback: 'player feedback',
  waitingPlanet: 'Reading planet',
  waitingIntel: 'Collecting',
  waitingLeaderboard: 'Ranking the galaxy',
  waitingChat: 'Opening galaxy chat',
  waitingChronicle: 'Reading the galaxy',
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
  eyebrow: 'Commander',
  /*
    THE GROUP NAMES. Four words doing the work nine identical rows could not: a
    reader should be able to tell WITHOUT reading the rows that the leaderboard
    and the sound slider are different kinds of thing.
  */
  seasonHeading: 'This season',
  asteraHeading: 'Astera team',
  helpHeading: 'Help',
  deviceHeading: 'This device',
  marksHeading: 'Your marks',
  intelLabel: 'Intel',
  intelHint: 'Telescope, probes, radar and battle reports',
  rewardsLabel: 'Rewards',
  rewardsHint: 'What the galaxy owes you for playing it',
  /*
    The hint is this row's accessible name (see `MenuRow`), so it says what the
    page IS. It no longer promises a new tab, because the row no longer opens
    one — a hint that describes the old behaviour is worse than none.
  */
  guideLabel: 'Quick start',
  guideHint: 'The opening moves, in the order to make them',
  rewardsWaiting: '{{count}} ready',
  /** T12: research is a commander's, not a world's, so its way in is here. */
  researchLabel: 'Research',
  researchHint: 'Fifteen projects, held by you and by every world you hold',
  leaderboardLabel: 'Leaderboard',
  leaderboardHint: 'Every commander ranked by Dominion',
  announcementsLabel: 'Announcements',
  announcementsHint: 'News, updates and notes from the Astera team',
  announcementsWaiting: '{{count}} new',
  feedbackLabel: 'Feedback',
  feedbackHint: 'Send a bug, idea or congratulations to the team',
  clanLabel: 'Clan',
  clanHint: 'Find a five-seat crew or found your own',
  clanMemberLabel: 'Clan · [{{tag}}]',
  clanMemberHint: 'Crew, aid, shared loot and private chat',
  clanWaiting: '{{count}} waiting',
  rivalLabel: 'Rival · {{commander}}',
  rivalHint: 'Focus {{planet}} and choose your next move',
  rivalLostLabel: 'Rival signal lost',
  /** The chip's own face. The sentence above is still its accessible name. */
  rivalLostShort: 'Lost mark',
  rivalLostHint: 'That world is gone. Clear the marker.',
  rivalCleared: 'The lost Rival marker was cleared.',
  accountHeading: 'Account',
  soundLabel: 'Sound',
  soundOn: 'The score is playing.',
  soundOff: 'Silenced on this device.',
  volumeLabel: 'Music volume',
  volumeValue: '{{volume}}%',
  /**
   * RESOLUTION. Three rungs, one word each — all three share a 350-wide row. The
   * line beneath belongs to the chosen rung: a rung's name does not say what it
   * buys, and the sentence does.
   */
  qualityLabel: 'Image quality',
  quality: {
    high: 'High',
    balanced: 'Balanced',
    low: 'Low',
  },
  qualityHint: {
    high: 'Full resolution. Sharpest picture, most battery.',
    balanced: 'Three quarter resolution. Hard to see, markedly cooler.',
    low: 'Half resolution, no edge smoothing. For older phones.',
  },
} as const;

export const leaderboard = {
  eyebrow: 'The local galaxy',
  title: 'Leaderboard',
  empty: 'No commanders have joined this galaxy yet.',
  rank: 'Rank {{rank}}',
  tier: 'Tier {{tier}}',
  score: 'Dominion',
  you: 'You',
  searchLabel: 'Search commanders, planets or clans',
  searchPlaceholder: 'Commander, planet or clan',
  noMatch: 'No commander, planet or clan matches that search.',
  locationUnknown: "You haven't discovered this commander's location yet.",
  /*
    THE IN-SEASON PRIZE — the answer to "what am I playing for".
    It sits directly above the standings, because that is where the decision is.
  */
  rewards: {
    title: 'End of season prize',
    left: '{{duration}} left',
    explain: 'When the season ends, the first {{places}} commanders open the next galaxy with resources.',
    table: 'Prize by place',
    tableCount: 'Top {{places}} places · open to inspect',
    place: 'Rank {{place}}',
    holding: 'Rank {{place}} · you are winning this',
    paidWhen: 'It lands the moment you found your world in the new season.',
    standing: 'Rank {{place}}',
    behind: '{{score}} more Dominion to reach the top {{places}}.',
    climb: 'Reach the top {{places}} and take it.',
    unranked: 'Join this galaxy to enter the standings.',
  },
  archive: {
    selectorLabel: 'Season records',
    archiveIndex: 'season records',
    waitingArchive: 'Loading season records',
    live: 'Live season',
    seasonChoice: 'Season {{ordinal}} · {{galaxy}}',
    seasonNumber: 'Season {{ordinal}}',
    seasonHeading: 'Season {{ordinal}} · {{galaxy}}',
    /* A rank is not a boast without its field — first of four reads like first of three hundred. */
    percentile: 'Top {{share}}% · {{rank}} of {{commanders}} commanders',
    fieldSize: '{{count}} commanders',
    medals: 'Trophies',
    signature: 'Your signature ship',
    leadWorks: 'Works output',
    leadProduced: 'Total the Works turned out',
    leadRuns: 'from {{count}} asteroid runs',
    signatureCount: 'You built {{count}}',
    multiple: '×{{value}}',
    share: '{{value}}%',
    loadingOlder: 'Loading older seasons',
    completedBoard: 'Completed season leaderboard',
    waitingBoard: 'Opening the completed leaderboard',
    emptyBoard: 'No commander results were recorded for this galaxy.',
    searchLabel: 'Search the completed season by commander',
    searchPlaceholder: 'Commander',
    noMatch: 'No commander matches that search.',
    openCommander: 'Open {{commander}} season record',
    openSeasonRecord: 'Open Season {{ordinal}} · {{galaxy}} record',
    commanderCard: 'commander season record',
    waitingProfile: 'Opening the commander record',
    back: 'Back to season standings',
    profileViews: 'Commander record views',
    seasonTab: 'Season {{ordinal}}',
    overall: 'Overall',
    cohort_one: 'Others = the average across {{count}} commander in this season',
    cohort_other: 'Others = the average across {{count}} commanders in this season',
    /** The three-column breakdown truncates; the long sentence is said once above. */
    averageShort: 'Others: {{value}}',
    statsUnavailable: 'No detailed record was kept for this season.',
    statsUnavailableHint: 'Your rank and title are kept. What was never measured is not shown as zero.',
    legacyStats: {
      title: 'Preserved season record',
      hint: 'Recorded combat figures are shown. Economy, fleet production and exploration were not measured and are omitted.',
    },
    partialStats: {
      title: 'Partial telemetry',
      hint: 'Activity from before telemetry began may be missing; recorded figures remain exact.',
    },
    forcedEnd: {
      title: 'Season ended early',
      hint: 'The played period is sealed permanently, including its final standings and rewards.',
    },
    none: 'None',
    ratios: {
      trade: 'Damage traded',
      haul: 'Loot per raid',
      kept: 'Fleet kept',
      convoy: 'Convoy hit rate',
      hourly: 'Output per hour',
      perRun: 'Haul per run',
    },
    sections: {
      form: 'Form & efficiency',
      competition: 'Competition & battle',
      economy: 'Economy & production',
      exploration: 'Exploration & opportunity',
    },
    metrics: {
      finalRank: 'Final rank',
      battles: 'Battles',
      shipsBuilt: 'Ships built',
      shipsLost: 'Ships lost',
      shipsBuiltByHull: 'Ships built by type',
      shipsLostByHull: 'Ships lost by type',
      playerLoot: 'Loot from commanders',
      productiveTime: 'Production time, all worlds',
      produced: 'Produced by the Works',
      asteroidRuns: 'Asteroid runs',
      asteroidMined: 'Extracted from asteroids',
      convoyAttempts: 'Convoy attempts',
      convoySuccesses: 'Convoy successes',
      convoyDelivered: 'Delivered convoy rewards',
    },
    resources: {
      alloy: 'Alloy',
      crystal: 'Crystal',
      deuterium: 'Deuterium',
    },
    career: {
      completed: 'Completed seasons',
      bestRank: 'Best rank',
      championships: 'Championships',
      podiums: 'Podiums',
      topTen: 'Top 10 finishes',
      noTelemetry: 'No completed season has a detailed record yet.',
      recordedCombatTotals: 'Recorded combat totals',
      recordedTotals: 'Recorded career totals',
      covered_one: '{{count}} season covered',
      covered_other: '{{count}} seasons covered',
      coveredWithPartial: '{{count}} seasons covered · {{partial}} with partial telemetry',
      seasons: 'Season by season',
    },
  },
} as const;

export const chat = {
  eyebrow: 'Live channels',
  title: 'Chat',
  launcher: 'Open galaxy chat',
  launcherUnread: 'Open galaxy chat — {{count}} unread',
  launcherClanUnread: 'Open chat — {{count}} unread in Clan',
  launcherBothUnread: 'Open chat — {{general}} unread in General, {{clan}} in Clan',
  channelsLabel: 'Chat channels',
  general: 'General',
  clan: 'Clan',
  channelUnread: '{{channel}} — {{count}} unread',
  clanLocked: 'Clan chat is private to a crew.',
  clanLockedHint: 'Join or found a clan, then this channel opens immediately.',
  list: 'Galaxy messages',
  empty: 'No one has spoken yet. Be the first voice in the galaxy.',
  older: 'Load older messages',
  loadingOlder: 'Loading older messages',
  placeholder: 'Message the galaxy',
  send: 'Send',
  remaining: '{{count}} characters left',
  time: {
    justNow: 'just now',
    minutes_one: '{{count}} minute ago',
    minutes_other: '{{count}} minutes ago',
    hours: '{{hours}}h {{minutes}}m ago',
    days_one: '{{count}} day ago',
    days_other: '{{count}} days ago',
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
  title: 'Something broke',
  body: 'The interface stopped drawing. Reloading brings you back to the disc — nothing in the galaxy was lost.',
  reload: 'Reload',
  detailShow: 'Show detail',
  detailHide: 'Hide detail',
  /** What the developer needs, in the one gesture a phone can make. */
  copy: 'Copy report',
  copied: 'Copied — send it to us',
  copyFailed: 'Could not copy. Screenshot the detail instead.',
} as const;
