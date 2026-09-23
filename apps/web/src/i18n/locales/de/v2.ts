/** Gözlemevi-v2-Bausteine — die Texte der neuen Komponenten (docs/ui-v2/gozlemevi.md). */

/** B9: gedrückt halten zum Senden. */
export const hold = {
  hint: 'Gedrückt halten oder zum Bestätigen zweimal Enter drücken',
  confirm: '{{label}} · sicher?',
  /** Shown on the face after a release that came too soon. */
  release: 'Zum Bestätigen gedrückt halten',
};

/** B12: eine Bauschlange als Ringe. */
export const lane = {
  /** Ein leerer Platz in der Schlange. */
  free: '+ Freier Platz',
};

/** B1: eine Ressourcenanzeige in der oberen Leiste. */
export const meter = {
  /** Read by a screen reader: the stock against the store. */
  reading: '{{resource}}: {{value}} von {{cap}}',
  /** The same, when the store is full. */
  full: '{{resource}}: {{value}} von {{cap}}, Lager voll',
};

/** B5: das Kräftelineal. */
export const ruler = {
  /** In place of the defence strip when nothing was ever measured. */
  unknown: 'Keine Sonde: ihre Verteidigung ist unbekannt',
  /** The button that closes that gap. */
  probe: 'Sonde senden',
};

/** Das v2-Blatt: sein Griff. */
export const handle = {
  /** Opens the sheet one height further. */
  expand: 'Erweitern',
  /** At the top: settles it one height lower. */
  collapse: 'Einklappen',
};

/** B4: das Dock, fünf Tabs in fester Reihenfolge. */
export const dock = {
  /** The navigation landmark, for a screen reader. */
  label: 'Hauptnavigation',
  galaxy: 'Galaxie',
  base: 'Basis',
  fleet: 'Flotte',
  intel: 'Aufklärung',
  clan: 'Clan',
  /** The dot on Base, read aloud. */
  baseWaiting: 'Etwas zum Einsammeln oder Reparieren',
  /** Beside the Fleet ring: your own craft in the air. */
  airborne: 'In der Luft: {{count}}',
  /** The count on Intel: reports you have not seen. */
  reports: 'Neue Berichte: {{count}}',
  /** The count on Clan. */
  attention: 'Wartet auf dich: {{count}}',
};

/** B2: die Jetzt-Zeile, der eine wichtigste Timer. */
export const now = {
  /** The line, for a screen reader. */
  label: 'Dringendster Timer',
  /** The sheet one tap under it: every timer. */
  sheet: 'Timer',
  work: 'Bau wird fertig',
  research: 'Forschung wird fertig',
  event: 'Ereignis endet',
  shield: 'Dein Schild endet',
  shieldDetail: 'Danach können dich Angriffe erreichen',
  /** The clock time beside a countdown in the sheet. */
  at: 'um {{time}}',
};

/** K1: das Glocken-Blatt, drei Tabs. */
export const bell = {
  /** The sheet's name: all three tabs answer it. */
  title: 'Was geschah',
  /** The tab list, for a screen reader. */
  label: 'Signale, Chronik und Chat',
  signals: 'Signale',
  chronicle: 'Chronik',
  chat: 'Chat',
  /** The dot on Chat, read aloud. */
  chatUnread: '{{count}} ungelesen',
};

/** B1: die obere Leiste. */
export const topBar = {
  /** The shield's time on the commander chip: whole hours, rounded down. */
  hours: '{{h}}h',
};

/** Der Ansicht-Chip: Ebenen, Ereignisführer und die Galaxie-Überschrift. */
export const view = {
  chip: 'Ansicht',
  title: 'Ansicht',
  layers: 'Ebenen',
  telescope: 'Teleskop-Reichweite',
  telescopeDetail: 'Wo deine Welten den Flottenstatus sehen',
  radar: 'Radar-Reichweite',
  radarDetail: 'Wo dein Radar vor anfliegenden Flotten warnt',
  events: 'Leitfaden zu Galaxie-Ereignissen',
};

/** B3: der Kontextplatz, immer nur eine Karte. */
export const slot = {
  incoming: 'Angriff im Anflug',
  prepare: 'Verteidigung vorbereiten',
  look: 'Ansehen',
  event: 'Galaxie-Ereignis',
  show: 'Zeigen',
  lands: 'landet in {{time}}',
  ends: 'endet in {{time}}',
  pill: 'Angriffe im Anflug: {{count}}',
  dismiss: 'Schließen',
};
