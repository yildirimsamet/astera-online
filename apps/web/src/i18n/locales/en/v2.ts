/** Gözlemevi v2 kit — the words the new components carry (docs/ui-v2/gozlemevi.md). */

/** B9: press and hold to commit. */
export const hold = {
  /** Read by a screen reader: the two ways to use the button. */
  hint: 'Press and hold, or press Enter twice to confirm',
  /** The inline second step after one Enter. */
  confirm: '{{label}} · sure?',
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
  /** The tab list, for a screen reader. */
  label: 'Signals, chronicle and chat',
  signals: 'Signals',
  chronicle: 'Chronicle',
  chat: 'Chat',
  /** The dot on Chat, read aloud. */
  chatUnread: '{{count}} unread',
};
