/**
 * THE CHROME THAT NEVER LEAVES — the header, the in-flight strip, Signals, and
 * the furniture every surface is built out of.
 */

export const statusBar = {
  alloyLabel: 'Alloy',
  crystalLabel: 'Crystal',
  /** The store's ceiling, stated as space. */
  storeFull: 'FULL',
  storeFree: '{{amount}} free',
  /** The commander control — the way out, and it says your name. */
  commanderHint: 'Commander {{name}} — season, galaxy and sign out',
  seasonUnknown: '—',
  intelHint: 'Intel — what you know',
  bays: {
    hint: '{{used}} of {{total}} flight bays in use',
    label: 'In flight',
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
  incoming: 'Inbound fleet',
  probe: 'Your probe → {{target}}',
  fleetHome: 'Your fleet home from {{target}}',
  fleetOut: 'Your fleet → {{target}}',
  more: '+{{count}}',
} as const;

export const signals = {
  beacon: 'Signals',
  beaconUnread: 'Signals — {{count}} unread',
  title: 'Signals',
  eyebrowUnread: '{{count}} new',
  eyebrowRead: 'Everything you have been told',
  statusHeading: 'Right now',
  eventsHeading: 'What happened',
  empty:
    'Nothing yet. The galaxy tells you when a fleet moves against you, when a probe is caught, and when your own ships come home.',
  repeat: '×{{count}}',

  /** The states that are true right now, rather than things that happened. */
  status: {
    disruptedLine: 'Your works are offline',
    disruptedDetail: 'Raided. Production resumes in {{duration}}.',
    worksStoppedLine: 'The works have stopped',
    worksStoppedDetail: 'Full and idle. {{amount}} an hour is being thrown away — collect it.',
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

/** Loading, failure and emptiness, wherever a whole surface is in one of them. */
export const surface = {
  unreachable: 'Could not reach {{what}}.',
  retry: 'Try again',
  /** What each caller of `Unreachable` is naming. */
  whatPlanet: 'your planet',
  whatIntel: 'what you know',
  whatReports: 'your battle reports',
  waitingPlanet: 'Reading planet',
  waitingIntel: 'Collecting',
  /** The generated crest a world wears. One element, used on two surfaces. */
  planetSigil: 'Planet',
} as const;
