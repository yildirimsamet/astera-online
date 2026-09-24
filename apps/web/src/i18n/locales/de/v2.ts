/** Gözlemevi-v2-Bausteine — die Texte der neuen Komponenten (docs/ui-v2/gozlemevi.md). */

/** B9: gedrückt halten zum Senden. */
export const hold = {
  hint: 'Gedrückt halten oder zum Bestätigen zweimal Enter drücken',
  confirm: '{{label}} · sicher?',
  /** Shown on the face after a release that came too soon. */
  release: 'Zum Bestätigen gedrückt halten',
  verb: 'Halten',
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
  need: '{{resource}}: {{have}} von {{need}}, {{short}} fehlen',
  short: '{{amount}} fehlen',
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
  /** The round button under the View chip: the disc's old Home mark. */
  home: 'Zu deiner Welt fliegen',
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

/** E4: the Fleet page — in flight, at home, the Hangar. */
export const fleetPage = {
  views: "Flottenansichten",
  air: "In der Luft",
  home: "Daheim",
  bays: "Flugplätze",
  hangar: "Hangar",
  pace: "{{pct}} % Tempo",
  recall: "Zurückrufen",
  recallHome: "Zurückgerufen in {{time}} daheim",
  recalling: "Kehrt um…",
  emptyAir: "Nichts in der Luft. Tippe in der Galaxie auf eine Welt, einen Felsen oder einen Piraten, um Schiffe zu senden.",
  shipsHome_one: "{{count}} Schiff daheim",
  shipsHome_other: "{{count}} Schiffe daheim",
  away: "{{count}} unterwegs",
  noShips: "Keine Schiffe daheim",
  capital: "Hauptwelt",
  colony: "Kolonie",
  roomRule: "Platz für jedes Schiff einer Welt – daheim, unterwegs und in der Werft. Ein voller Hangar stoppt die Werft und eingehende Transfers; eine zurückgerufene Flotte passt immer.",
  ground: "Bodenverteidigung",
  ceiling: "bis {{shown}} mit diesem Kern",
  full: "Voll",
};

/** The battle report scene (B15), the mock's "KISMİ ZAFER" page. */
export const reportScene = {
  eyebrow: "Kampfbericht · {{planet}}",
  rounds_one: "{{count}} Runde",
  rounds_other: "{{count}} Runden",
  you: "Du",
  destroyed: "{{count}} zerstört",
  hidden: "Was ihnen bleibt und der Rest des Feldes bleibt verborgen; ein Bericht nennt nur, was du zerstört hast.",
  whyHeading: "Warum?",
  why: "Die meisten Verluste waren {{lost}}: {{by}} ist gegen sie stark, und {{bring}} ist gegen {{by}} stark.",
  balance: "Bilanz",
  balanceLoot: "Beute {{amount}}",
  balanceFuel: "Treibstoff −{{amount}}",
  balanceLost: "verloren {{list}}",
  balanceNone: "nichts verloren",
  cargoFull: "Laderaum voll",
  colonyRule: "Loyalität einer Kolonie: ein klarer Sieg nimmt {{decisive}}, ein Teilsieg {{partial}}.",
  again: "Erneut angreifen",
} as const;

/** K6: the switch at the top of the Base — this world, or the commander's research. */
export const baseSwitch = {
  label: 'Basis',
  world: 'Diese Welt',
  research: 'Forschung',
} as const;

/** E8 · K9: the research constellation. */
export const researchMap = {
  label: 'Forschungskarte',
  closed: '{{group}} · geschlossen',
  /** The strategic three while their release switch is off: the server refuses them. */
  shut: 'Vorerst geschlossen',
  /** A prerequisite already held, said on the card. */
  needs: 'Braucht {{name}}',
  /** The next rung of a ladder that opens a hull, and the one rung of a permission. */
  opensAt: 'Stufe {{level}} öffnet',
  opens: 'Öffnet',
} as const;

export const roomBar = {
  hangar: 'Hangarraum',
  ground: 'Bodenraum',
  home: 'daheim {{value}}',
  away: 'unterwegs {{value}}',
  queued: 'in der Schlange {{value}}',
  incoming: 'dieser Auftrag {{value}}',
  free: 'frei {{value}}',
  reading: '{{label}}: {{used}} von {{total}} belegt',
  returnFits: 'Eine heimkehrende Flotte passt immer: Schiffe unterwegs behalten ihren Platz.',
  nextHangar: 'Hangar {{level}} macht daraus {{from}} → {{to}}.',
  gunsStay: 'Geschütze verlassen die Welt nie.',
  nextCore: 'Befehlskern {{level}} macht daraus {{from}} → {{to}}.',
};

export const away = {
  eyebrow: '{{duration}} weg',
  title: 'Während du weg warst',
  all: 'Alle ({{count}})',
  done: 'Verstanden',
  taken: '{{loot}} geraubt · {{lost}} Einheiten verloren',
  held: '{{lost}} Einheiten beim Halten verloren',
  looted: '+{{loot}} erbeutet · {{lost}} Schiffe verloren',
  scan_one: 'Ein Scan hat dich gefunden',
  scan_other: '{{count}} Scans haben dich gefunden',
  scanDetail: 'Jemand macht sich ein Bild von dir.',
  convoySecured: 'Konvoi-Beute gesichert',
  convoyDelivered: 'Konvoi-Beute geliefert',
  convoyDetail_one: '+{{resources}} Ressourcen · {{count}} Beuteschiff',
  convoyDetail_other: '+{{resources}} Ressourcen · {{count}} Beuteschiffe',
  accrued: '+{{alloy}} Legierung · +{{crystal}} Kristall',
  accruedDetail: 'Hergestellt, während du weg warst',
  door: {
    report: 'Bericht',
    intel: 'Radar',
    base: 'Basis',
    orbit: 'Installieren',
    signals: 'Signale',
  },
};
