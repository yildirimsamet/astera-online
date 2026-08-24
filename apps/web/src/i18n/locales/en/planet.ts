/**
 * YOUR OWN WORLD — the four decision groups, the rows they are made of, the
 * detail sheet behind each row, and the launch planner.
 */

export const planet = {
  recovery: 'Recovery in progress · systems return in {{duration}}',
  deathStar: {
    eyebrow: 'Restricted strategic weapon',
    none: 'No Death Star on this world',
    building: 'Building · {{duration}}',
    paused: 'Build paused during recovery',
    ready: 'Ready to launch',
    build: 'Build',
    started: 'Death Star construction started',
    dangerHint: 'A one-way planet-breaker. Every impact devastates; a second can capture only a colony or neutral world.',
    readyHint: 'Armed. Select any enemy world; capitals can be devastated but never captured.',
    needProtocol: 'Protocol',
    needCore: 'Core L6',
    needShipyard: 'Shipyard L5',
    needOperational: 'World operational',
    buildTime: '60 min · one weapon · no recall',
  },
  tabs: {
    defendProblem: 'Defend',
    defendQuestion: 'What survives if someone lands here?',
    orbitProblem: 'Orbit',
    orbitQuestion:
      'Four satellites overhead, four instruments on the ground. Any of them, in any order.',
    reachProblem: 'Reach',
    reachQuestion: 'What can you send, and how far?',
    growProblem: 'Grow',
    growQuestion: 'How much ore you make, and how high you can build.',
  },

  wallet: {
    inTheWorks: '<0>{{amount}}</0> in the works',
  },

  queue: {
    title: 'Build queues',
    capacity: '{{count}} slots each',
    construction: 'Construction',
    yard: 'Yard',
    empty: 'No work committed',
    committing: 'committing…',
    staged: 'starts when claimed',
    queued_one: '{{count}} order queued',
    queued_other: '{{count}} orders queued',
    unitsQueued_one: '{{count}} unit queued',
    unitsQueued_other: '{{count}} units queued',
    afterQueue: 'After queue',
    cancel: 'Cancel',
    cancelling: 'Cancelling…',
    refund: 'Refund: {{alloy}} alloy · {{crystal}} crystal · {{deuterium}} Deuterium',
    cancelled: 'Order cancelled · {{alloy}} alloy, {{crystal}} crystal and {{deuterium}} Deuterium returned',
  },

  /** What each structure is for, in one line, where the row states it. */
  roles: {
    vault: 'The only stock a raid cannot touch. Everything above it is takeable.',
    shipyard: 'Unlocks heavier hulls, builds them faster, and sharpens every probe you send.',
    refinery: 'Everything you build waits on this number.',
    extractor: 'Scarce. Gates the heavy hulls and every high building level.',
    coreCapped_one: '{{count}} thing is stuck at the ceiling until this goes up.',
    coreCapped_other: '{{count}} things are stuck at the ceiling until this goes up.',
    coreClear: 'Nothing may exceed the Core. It is the ceiling and construction throughput.',
  },

  defend: {
    groundBand: 'On the ground',
    groundNote:
      'They never leave. Each is strong against what the other is weak to — build one kind and a raider who scouts you will bring its counter.',
    thornNone: 'Light guns. They tear into heavy hulls, and Lances pick them off.',
    thornStanding: '{{count}} standing. Strong against heavies, weak to Lances.',
    thornGain: 'Thorns',
    bastionNone: 'Heavy guns. They break Lances, and a swarm of Wasps overwhelms them.',
    bastionStanding:
      '{{count}} standing. Strong against Lances, weak to swarms. 60% of losses rebuild free.',
    groundGain: 'Ground units',
    aegisPointer: 'A shield is hardware — the <0>{{name}}</0> is under Orbit.',
  },

  orbit: {
    inOrbitBand: 'In orbit',
    inOrbitNote: 'Each one takes a slot. Built once — they have no levels.',
    onPlanetBand: 'On the planet',
    onPlanetNote:
      'No slot needed. These have levels — raise them as far as your Command Core allows.',
    slotsFree_one: '{{count}} slot still free above',
    slotsFree_other: '{{count}} slots still free above',
    slotsNone: 'orbit is full',
    slotsUsed: '{{used}}/{{total}}',
    slotsNext: ' · +1 at Core L{{level}}',
    rackLabel: 'Orbit slots',
    slotEmpty: 'Empty',
    inactiveSatellite: 'Owned, but inactive until the Command Core reopens this orbit slot.',
    inactiveUplink: 'L{{owned}} owned, but inactive until an Uplink is active again.',
    inactiveCore: 'L{{owned}} owned · L{{active}} active until the Command Core is restored.',
    alreadyInOrbit: 'already in orbit',
  },

  reach: {
    frontierBand: 'Frontier projects',
    frontierNote: 'Four discoveries. They share Construction and complete on its clock.',
    isotopeName: 'Isotope Spectrometry',
    isotopeTag: 'Unlock Deuterium recovery',
    isotopeRole: 'Reveals the Deuterium mix in neon-green isotope anomalies and permits a Prospector launch. Collect the return haul from the Works.',
    denseName: 'Dense Fuel Cells',
    denseTag: 'Unlock the Runner',
    denseRole: 'A cargo-limited raid reveals the design. The Runner trades capacity for a shorter exposure window.',
    graviticName: 'Gravitic Charges',
    graviticTag: 'Unlock the Breacher',
    graviticRole: 'A shield-heavy raid reveals the design. The Breacher tears through shields without spilling its bonus damage into units.',
    deathStarName: 'Death Star Protocol',
    deathStarTag: 'Unlock the strategic foundry',
    deathStarRole: 'Authorises one protected strategic asset on this world. It devastates any enemy world; only colonies and neutrals can be captured by a second strike.',
    researchAct: 'Research',
    researchComplete: 'complete',
    researchAt: 'opens in {{duration}}',
    researchIsotopeFirst: 'Isotope Spectrometry first',
    researchDenseFirst: 'Dense Fuel Cells first',
    researchGraviticFirst: 'Gravitic Charges first',
    researchWarAt: 'War act opens this in {{duration}}',
    researchCargoInsight: 'fill your cargo in a raid',
    researchShieldInsight: 'strike a meaningful Aegis shield',
    warshipsBand: 'Warships',
    warshipsNote: 'These fight. Send them at another planet.',
    supportBand: 'Support',
    supportNote: 'They never fight. Choose cheap capacity or a faster exposure window.',
    miningBand: 'Mining',
    miningNote: 'Sent at an asteroid, not at a planet. Brings the ore home.',
    ownedGain: 'You have',
    prospectorLimit: '{{owned}} / {{max}} · limit',
  },

  /** Why a row cannot be pressed yet. Each is a door, so each names its fix. */
  blocked: {
    core: 'Core L{{level}}',
    uplink: 'an Uplink in orbit',
    orbitSlot: 'a free orbit slot',
    shipyard: 'Shipyard L{{level}}',
    maxed: 'at its highest level',
    queueFull: 'that build queue is full',
  },

  /** What a purchase says once it has landed. */
  done: {
    raised: '{{name}} is now L{{level}}',
    instrument: '{{name}} online at L{{level}}',
    satellite: '{{name}} is in orbit',
    built: '{{count}} × {{name}} built',
    researched: '{{name}} complete',
    queued: '{{name}} L{{level}} queued',
    queuedSimple: '{{name}} queued',
    unitsQueued: '{{count}} × {{name}} queued',
  },

  buildSheet: {
    eyebrowGround: 'Ground defence · never leaves',
    eyebrowMobile: 'Mobile hull',
    howMany: 'How many',
    max: 'Max {{count}}',
    build: 'Build {{count}}',
    capped:
      'You already hold {{count}} — the limit. Craft that are out still count, so you cannot build another.',
    heldOfMax: '{{owned}} of {{max}} held. The ones that are out count too.',
    defenceAfter: 'Home defence when complete: {{count}} units',
  },
} as const;

/** The ladder behind one row: what this thing becomes. */
export const itemSheet = {
  eyebrowNotInOrbit: 'Not in orbit',
  eyebrowInOrbit: 'In orbit',
  eyebrowNotInstalled: 'Not installed',
  eyebrowLevel: 'Level {{level}}',
  actPutInOrbit: 'Put in orbit',
  actAlreadyInOrbit: 'Already in orbit',
  actInstall: 'Install',
  actRaise: 'Raise to L{{level}}',
  lockedNote: 'Locked — needs {{reason}}.',
  shortAlloy: '{{amount}} alloy',
  shortCrystal: '{{amount}} crystal',
  shortJoin: ' and ',
  shortNote: 'Short {{parts}}.',
  ladderHeading: 'What each level buys',
  rungLevel: 'L{{level}}',
  rungNewHardware: 'New hardware at L{{level}}',
  orbitalDoesHeading: 'What it does',
  orbitalCostHeading: 'What it costs',
  orbitalOnce: 'once — it is never raised',
  orbitalFree: '{{free}} of {{total}} free',
  orbitalNoSlot: 'No free slot — raise the Command Core',
} as const;

/** The row. One decision, presented as a decision. */
export const upgradeRow = {
  about: 'About {{name}}',
  nextTierAlt: '{{name}} at the next tier',
  becomes: 'becomes',
  affordableIn: 'Affordable in <0>{{duration}}</0> at your current rate',
} as const;

/** The control at the right-hand edge of every row. */
export const action = {
  verbRaise: 'Raise',
  verbBuild: 'Build',
  verbInstall: 'Install',
  verbClaim: 'Collect',
  verbSend: 'Send',
  short: 'Short',
  shortfallAlloy: '{{amount}} more alloy',
  shortfallCrystal: '{{amount}} more crystal',
  shortfallDeuterium: '{{amount}} more Deuterium',
  shortfallJoin: ' and ',
  shortfallLabel: 'Short — needs {{parts}}',
  statAttack: 'Attack',
  statHull: 'Hull',
  statSpeed: 'Speed',
  statSpeedFixed: 'fixed',
  statCargo: 'Cargo',
  statCargoNone: '—',
} as const;

/** The portrait and the three verdicts at the top of your own planet. */
export const planetHero = {
  capital: 'Capital world',
  colony: 'Colony world',
  power: 'Power',
  perHour: 'Per hour',
  perHourSuffix: '/h',
  disrupted: 'Production stopped · raided · {{countdown}}',
  defence: 'Defence',
  defenceNone: 'None',
  defenceThin: 'Thin',
  defenceHeld: 'Held',
  defenceShipsOnly: '{{count}} ships only',
  defenceOnGround: '{{count}} on the ground',
  shield: 'Shield',
  shieldNone: 'None',
  shieldNoAegis: 'no aegis',
  shieldValue: '{{current}} / {{max}}',
  shieldMeter: 'Aegis shield charge',
  shieldRegen: '+{{amount}}/h · before units',
  vault: 'Vault · safe',
  vaultProtected: 'A raid cannot touch these amounts',
  alloySafe: '{{amount}} alloy safe',
  crystalSafe: '{{amount}} crystal safe',
  deuteriumSafe: '{{amount}} deuterium safe',
  atRisk: 'At risk',
  atRiskValue: '{{amount}} exposed',
} as const;

/** The commitment. Everything here is supporting detail for one line. */
export const launch = {
  eyebrow: 'Attack',
  back: 'Back',
  launching: 'Launching',
  commit: 'Launch — no recall',
  chooseFleet: 'Choose a fleet',
  send: 'Send {{count}} ships',
  launched: 'Launched. Exposed for {{duration}} · {{count}} units holding.',
  whileAway: 'While this fleet is away',
  defending: '{{count}} units defending home',
  nothingSent: 'Nothing sent yet',
  exposedFor: 'Exposed for {{duration}}',
  oneWay: 'One way',
  oneWayUnknown: '—',
  cargo: 'Cargo',
  distance: 'Distance',
  fleetHeading: 'Fleet',
  atHome: '{{count}} home',
  fewer: 'Fewer {{name}}',
  more: 'More {{name}}',
  all: 'All',
  noShips: 'No ships at home. Build some in the shipyard, or wait for a fleet to come back.',
  warning:
    'This cannot be recalled. Once it leaves, the only way to find out what was down there is to watch it land — and your planet holds {{count}} units until it comes back.',
  fleetsave: 'Ships in flight cannot be raided. Your planet can.',
} as const;

export const transfer = {
  eyebrow: 'World transfer',
  eta: 'ETA',
  capacity: 'Cargo',
  fleet: 'Craft',
  homeDefence: '{{ships}} craft remain at origin · {{power}} defence power',
  cargo: 'Resources',
  alloy: 'Alloy',
  crystal: 'Crystal',
  deuterium: 'Deuterium',
  commit: 'Transfer — no recall',
  sending: 'Dispatching',
  launched: 'Transfer launched · {{duration}}',
  irreversible: 'One way. Ground defence cannot move; cargo space comes only from Haulers and Runners.',
} as const;
