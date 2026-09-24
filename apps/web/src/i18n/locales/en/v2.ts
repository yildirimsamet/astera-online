/** Gözlemevi v2 kit — the words the new components carry (docs/ui-v2/gozlemevi.md). */

/** B9: press and hold to commit. */
export const hold = {
  /** Read by a screen reader: the two ways to use the button. */
  hint: 'Press and hold, or press Enter twice to confirm',
  /** The inline second step after one Enter. */
  confirm: '{{label}} · sure?',
  /** Shown on the face after a release that came too soon. */
  release: 'Hold to confirm',
  /** Before the label on the face, as the mock's "Basılı tut · 74 gemiyi gönder"; the hint already tells a reader. */
  verb: 'Hold',
};

/** B12: a build lane drawn as rings. */
export const lane = {
  /** A slot in the lane with nothing in it. */
  free: '+ Free slot',
};

/** B1: a resource meter on the top bar. */
export const meter = {
  /** Read by a screen reader: the stock against the store. */
  reading: '{{resource}}: {{value}} of {{cap}}',
  /** The same, when the store is full. */
  full: '{{resource}}: {{value}} of {{cap}}, store full',
  /** A price against what you hold (the need bar). */
  need: '{{resource}}: {{have}} of {{need}}, {{short}} short',
  short: '{{amount}} short',
};

/** B5: the force ruler. */
export const ruler = {
  /** In place of the defence strip when nothing was ever measured. */
  unknown: 'No probe: their defence is unknown',
  /** The button that closes that gap. */
  probe: 'Send a probe',
};

/** The v2 sheet: its grab handle. */
export const handle = {
  /** Opens the sheet one height further. */
  expand: 'Expand',
  /** At the top: settles it one height lower. */
  collapse: 'Collapse',
};

/** B4: the dock, five tabs in one order. */
export const dock = {
  /** The navigation landmark, for a screen reader. */
  label: 'Main',
  galaxy: 'Galaxy',
  base: 'Base',
  fleet: 'Fleet',
  intel: 'Intel',
  clan: 'Clan',
  /** The dot on Base, read aloud. */
  baseWaiting: 'Something to collect or repair',
  /** Beside the Fleet ring: your own craft in the air. */
  airborne: 'In the air: {{count}}',
  /** The count on Intel: reports you have not seen. */
  reports: 'New reports: {{count}}',
  /** The count on Clan. */
  attention: 'Waiting for you: {{count}}',
};

/** B2: the Now line, the one timer that matters most. */
export const now = {
  /** The line, for a screen reader. */
  label: 'Most urgent timer',
  /** The sheet one tap under it: every timer. */
  sheet: 'Timers',
  work: 'Work finishing',
  research: 'Research finishing',
  event: 'Event ending',
  shield: 'Your shield ends',
  shieldDetail: 'Raids can reach you after it',
  /** The clock time beside a countdown in the sheet. */
  at: 'at {{time}}',
};

/** K1: the bell sheet, three tabs. */
export const bell = {
  /** The sheet's name: all three tabs answer it. */
  title: 'What happened',
  /** The tab list, for a screen reader. */
  label: 'Signals, chronicle and chat',
  signals: 'Signals',
  chronicle: 'Chronicle',
  chat: 'Chat',
  /** The dot on Chat, read aloud. */
  chatUnread: '{{count}} unread',
};

/** B1: the top bar. */
export const topBar = {
  /** The shield's time on the commander chip: whole hours, rounded down. */
  hours: '{{h}}h',
};

/** The View chip and sheet: layers, the events guide and the galaxy caption. */
export const view = {
  chip: 'View',
  title: 'View',
  layers: 'Layers',
  telescope: 'Telescope reach',
  telescopeDetail: 'Where your worlds see fleet status',
  radar: 'Radar reach',
  radarDetail: 'Where your radar warns of incoming fleets',
  events: 'Galaxy events guide',
  /** The round button under the View chip: the disc's old Home mark. */
  home: 'Fly to your world',
};

/** B3: the context slot, one card at a time. */
export const slot = {
  incoming: 'Incoming attack',
  prepare: 'Prepare defence',
  look: 'Look at it',
  event: 'Galaxy event',
  show: 'Show me',
  lands: 'lands in {{time}}',
  ends: 'ends in {{time}}',
  pill: 'Incoming attacks: {{count}}',
  dismiss: 'Dismiss',
};

/** E4: the Fleet page — in flight, at home, the Hangar. */
export const fleetPage = {
  views: "Fleet views",
  air: "In flight",
  home: "At home",
  bays: "Flight bays",
  hangar: "Hangar",
  pace: "{{pct}}% speed",
  recall: "Recall",
  recallHome: "If recalled, home in {{time}}",
  recalling: "Turning…",
  emptyAir: "Nothing in the air. Tap a world, a rock or a pirate on the galaxy to send ships.",
  shipsHome_one: "{{count}} ship home",
  shipsHome_other: "{{count}} ships home",
  away: "{{count}} away",
  noShips: "No ships at home",
  capital: "Capital",
  colony: "Colony",
  roomRule: "Room for every ship a world owns — home, away and in the yard. A full Hangar stops the yard and transfers in; a recalled fleet always fits.",
  ground: "Ground defence",
  ceiling: "up to {{shown}} at this Core",
  full: "Full",
};

/** The battle report scene (B15), the mock's "KISMİ ZAFER" page. */
export const reportScene = {
  eyebrow: "Battle report · {{planet}}",
  rounds_one: "{{count}} round",
  rounds_other: "{{count}} rounds",
  you: "You",
  destroyed: "{{count}} destroyed",
  hidden: "What they still have, and the rest of the field, stays hidden; a report only says what you destroyed.",
  whyHeading: "Why?",
  why: "Most of your losses were {{lost}}: {{by}} is strong against them, and {{bring}} is strong against {{by}}.",
  balance: "Balance",
  balanceLoot: "loot {{amount}}",
  balanceFuel: "fuel −{{amount}}",
  balanceLost: "lost {{list}}",
  balanceNone: "nothing lost",
  cargoFull: "hold full",
  colonyRule: "Colony loyalty: a decisive win takes {{decisive}}, a partial one {{partial}}.",
  again: "Attack again",
} as const;

/** K6: the switch at the top of the Base — this world, or the commander's research. */
export const baseSwitch = {
  label: 'Base',
  world: 'This world',
  research: 'Research',
} as const;

/** E8 · K9: the research constellation. */
export const researchMap = {
  label: 'Research map',
  closed: '{{group}} · closed',
  /** The strategic three while their release switch is off: the server refuses them. */
  shut: 'Closed for now',
  /** A prerequisite already held, said on the card. */
  needs: 'Needs {{name}}',
  /** The next rung of a ladder that opens a hull, and the one rung of a permission. */
  opensAt: 'Level {{level}} opens',
  opens: 'Opens',
} as const;

/** D1/D2: a world's room, part by part, in your own colour. */
export const roomBar = {
  hangar: 'Hangar room',
  ground: 'Ground room',
  home: 'home {{value}}',
  away: 'away {{value}}',
  queued: 'queued {{value}}',
  incoming: 'this order {{value}}',
  free: 'free {{value}}',
  reading: '{{label}}: {{used}} of {{total}} taken',
};
