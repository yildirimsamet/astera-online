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
  menuHint: 'Commander {{name}} — intel, leaderboard, rewards, account',
  menuWaiting: '{{count}} rewards waiting',
  clanWaiting: '{{count}} clan updates waiting',
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
  fleetHome: 'Your fleet home from {{target}}',
  fleetOut: 'Your fleet → {{target}}',
  engaging: 'Engaging',
  more: '+{{count}}',
  drillOut: 'Your drills → asteroid',
  drillHome: 'Your drills returning home',
  salvageOut: 'Your drills → wreckage',
  drillCount: '{{count}} Prospectors',
  craftCount: '{{count}} craft',
  craftUnknown: 'Craft manifest unavailable',
  incomingHint: 'Inbound warning · origin hidden by fog',
  /**
   * THE RADAR LADDER, FINALLY WORTH CLIMBING. D123.
   *
   * L3 is the warning. L4 adds the size, which is what turns "something is coming"
   * into a choice between spending the stock, flying the fleet out and standing.
   * L5 names the world it left, and a named world is what a warning has to become
   * before it is a grudge.
   */
  incomingFrom: 'Inbound from {{origin}}',
  massLight: 'Light force inbound',
  massMedium: 'Sizeable force inbound',
  massHeavy: 'Heavy force inbound',
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
  intelLabel: 'Intel',
  intelHint: 'Telescope, probes, radar and battle reports',
  rewardsLabel: 'Rewards',
  rewardsHint: 'What the galaxy owes you for playing it',
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
  rivalLostHint: 'That world is gone. Clear the marker.',
  rivalCleared: 'The lost Rival marker was cleared.',
  accountHeading: 'Account',
  soundLabel: 'Sound',
  soundOn: 'The score is playing.',
  soundOff: 'Silenced on this device.',
  volumeLabel: 'Music volume',
  volumeValue: '{{volume}}%',
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
