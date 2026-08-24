/**
 * THE NAMED THINGS, AND THE SENTENCES THE GAME SAYS ABOUT THEM.
 *
 * `packages/rules` owns the numbers and stays language-free (it is the shared
 * source of truth for the server and the simulator, and a translation table in
 * there would be I/O by another name). So every NAME a player reads lives here,
 * keyed by the same id the rules use.
 */

export const vocabulary = {
  building: {
    CORE: { name: 'Command Core', tag: 'Unlocks higher levels', role: 'Level ceiling for everything else' },
    REFINERY: { name: 'Alloy Refinery', tag: 'Makes alloy', role: 'Alloy per hour, and alloy storage' },
    EXTRACTOR: { name: 'Crystal Extractor', tag: 'Makes crystal', role: 'Crystal per hour, and crystal storage' },
    VAULT: { name: 'Vault', tag: 'Keeps ore safe from raids', role: 'Stock a raid can never reach' },
    SHIPYARD: { name: 'Shipyard', tag: 'Unlocks better ships', role: 'Unlocks hulls · sets probe accuracy and stealth' },
  },

  instrument: {
    TELESCOPE: {
      name: 'Telescope',
      tag: 'Watch other planets',
      role: 'Watch one more planet per level. Silent — nobody is told.',
      roleNone:
        'SEE OUT. Watch one world and know when its fleet leaves — the single most valuable fact in the game. Needs an Uplink overhead.',
      roleOwned:
        'SEE OUT. Watches a world silently; they are never told. Knowledge, and no protection whatsoever.',
    },
    RADAR: {
      name: 'Radar',
      tag: 'See who is coming',
      role: 'Catches probes. From L3, warns of an inbound fleet in time to arm for it.',
      roleNone:
        'BE WARNED. Right now a fleet can land here with no notice and probes come and go unseen. Needs an Uplink overhead.',
      roleOwned:
        'BE WARNED. Catches probes, and names an inbound fleet while there is still time to put a gun on the ground. Wins nothing on offence.',
    },
    AEGIS: {
      name: 'Aegis',
      tag: 'Shield for your planet',
      role: 'Shield HP, regenerating 40% an hour. Sits at the planet, not in orbit.',
      roleNone:
        'ABSORB. Sits at the planet, not in orbit. Soaks the opening damage of a raid and regrows on its own, free. Safe, and completely blind.',
      roleOwned:
        'ABSORB. Sits at the planet, not in orbit. Soaks the opening damage of a raid and regrows on its own, free. Safe, and completely blind.',
    },
    VEIL: {
      name: 'Veil',
      tag: 'Hide from telescopes',
      role: "Degrades what anyone's telescope can read about you.",
      roleNone:
        'BE UNREADABLE. Their telescope reads UNKNOWN instead of your fleet. It hides; it never lies — and it does not stop a probe.',
      roleOwned:
        'BE UNREADABLE. Their telescope reads UNKNOWN instead of your fleet. It hides; it never lies — and it does not stop a probe.',
    },
  },

  satellite: {
    UPLINK: {
      name: 'Uplink',
      tag: 'Unlocks Telescope and Radar',
      role:
        'SEE AT ALL. The only way to reach the Telescope and the Radar. It produces nothing, defends nothing, and without it you are guessing about everyone around you.',
      blurb:
        'A comms relay. It produces nothing and defends nothing — it is the only way to reach the Telescope and the Radar, and so the only way to stop guessing about the people around you.',
    },
    FOUNDRY: {
      name: 'Foundry',
      tag: 'More ore every hour',
      role:
        'EARN. Both metals, faster, for the rest of the season. The slowest reward here and the only one still paying on the last day.',
      blurb:
        'Refits the works. Alloy and crystal both come out faster, for as long as it is up there. The slowest reward on this list and the one that is still paying on the last day of the season.',
    },
    DERRICK: {
      name: 'Derrick',
      tag: 'Better mining craft',
      role:
        'MINE. Your Prospectors carry far more and get there much sooner — which on a contested rock is the whole difference between first and second. Worth nothing if you never send one.',
      blurb:
        'A tender for mining craft. Every Prospector you own carries far more ore and reaches its rock much sooner — which on a contested asteroid is the whole difference between arriving first and arriving second.',
    },
    BEACON: {
      name: 'Beacon',
      tag: 'Faster fleets',
      role:
        'STRIKE. Every fleet you send is away for less time, out and back. It wins no fight; it shortens the window where your planet is the undefended one.',
      blurb:
        'A navigation mark. Every fleet that leaves this planet flies faster, out and back. Shorter flights mean a shorter window with your defence away from home.',
    },
  },

  hull: {
    WASP: {
      name: 'Wasp',
      tag: 'Cheap, fast attacker',
      role: 'Cheapest attack, fastest out and back',
      pitch: 'Cheapest damage, fastest home. The shortest time spent undefended.',
    },
    LANCE: {
      name: 'Lance',
      tag: 'Hits the hardest',
      role: 'Highest attack · strong into Wasps, weak into Bulwarks',
      pitch: 'Hits hardest. Shreds Wasps, bounces off Bulwarks.',
    },
    BULWARK: {
      name: 'Bulwark',
      tag: 'Slow and tough',
      role: 'The durability anchor · slow enough to double your exposure',
      pitch: 'Survives what kills everything else. Nearly doubles your time away.',
    },
    HAULER: {
      name: 'Hauler',
      tag: 'Carries the loot home',
      role: 'Carries the loot home · contributes nothing to the fight',
      pitch: 'Carries the loot home. Useless in the fight — escort it or lose it.',
    },
    RUNNER: {
      name: 'Runner',
      tag: 'Fast strike cargo',
      role: 'Fast support hold · expensive capacity for short exposure windows',
      pitch: 'Carries less than a Hauler, but moves with a strike fleet. Speed is what you buy.',
    },
    BREACHER: {
      name: 'Breacher',
      tag: 'Breaks active shields',
      role: 'Lance specialist. Five times its normal effect against an active shield.',
      pitch: 'Crushes an Aegis without turning bonus damage into unit kills. Weak when no shield is standing.',
    },
    BASTION: {
      name: 'Bastion',
      tag: 'Heavy ground guns',
      role: 'Ground defence · cannot ever leave the planet',
      pitch: 'Heavy ground guns. Break Lances; swarms overwhelm them.',
    },
    THORN: {
      name: 'Thorn',
      tag: 'Light ground guns',
      role: 'Ground defence · light, cheap, and never leaves',
      pitch: 'Light ground guns, cheap and many. Tear into heavies; Lances pick them off.',
    },
    PROSPECTOR: {
      name: 'Prospector',
      tag: 'Mines asteroids',
      role: 'Mines passing asteroids · never joins a fight',
      pitch: 'Flies to a passing rock and brings the ore back. Never fights.',
    },
  },

  resource: {
    alloy: 'alloy',
    crystal: 'crystal',
    deuterium: 'Deuterium',
  },

  /** The four things a season can hand you, announced the moment they open. */
  unlock: {
    TELESCOPE: {
      title: 'Telescope unlocked',
      body: 'Put an Uplink in orbit and you can watch one planet.',
    },
    RADAR: {
      title: 'Radar unlocked',
      body: 'Put an Uplink in orbit and you will catch anyone looking at you.',
    },
    EXPLORER: {
      title: 'Explorer unlocked',
      body: 'Send a probe to know for certain. Their radar may catch it.',
    },
    VEIL: { title: 'Veil unlocked', body: 'Your fleet status can read UNKNOWN to anyone watching.' },
  },
} as const;

/** WHAT YOU GET IF YOU PRESS IT. */
export const gains = {
  rangeUnits: '{{count}} units',
  rangeWhole: 'the whole disc',

  core: {
    label: 'Build ceiling',
    level: 'L{{level}}',
    releases_one: 'Releases {{count}} blocked upgrade',
    releases_other: 'Releases {{count}} blocked upgrades',
    raisesCap: 'Raises the cap on everything else',
  },
  refinery: {
    label: 'Alloy per hour',
    rate: '{{amount}}/h',
    storage: 'Storage {{now}} → {{next}}',
  },
  extractor: {
    label: 'Crystal per hour',
    rate: '{{amount}}/h',
    storage: 'Storage {{now}} → {{next}}',
  },
  vault: {
    label: 'Vault capacity',
    value: '{{alloy}} alloy · {{crystal}} crystal',
    storeLabel: 'Storage ceiling',
    storeValue: '{{hours}}h of production',
  },
  shipyard: {
    accuracyLabel: 'Probe accuracy',
    seesLabel: 'Sees through a Veil up to',
    seesValue: 'L{{level}}',
    unlocksHull: 'Unlocks the {{hull}}',
    stealth: 'And makes your own probes harder to detect',
  },

  telescope: {
    slotsLabel: 'Planets you can watch',
    rangeLabel: 'How far you can see',
    maxed: 'At its highest level — it already reaches the whole disc',
    reachAndCooldown: 'Reaches {{range}} · a slot realigns in {{hours}}h',
    nextSlot: 'Next level adds a {{ordinal}} slot',
    ordinalSecond: '2nd',
    ordinalThird: '3rd',
    cooldown: 'A slot realigns in {{hours}}h',
  },
  radar: {
    scansLabel: 'Detects scans',
    scansNo: 'no',
    scansYes: 'yes',
    scansBearing: 'yes, with bearing',
    sweepLabel: 'How far it sweeps',
    sweepNone: 'none',
    maxed: 'At its highest level — it already names where a scan came from',
    l2l3: 'L2 adds the bearing · L3 warns about inbound fleets',
    estimate: 'Adds an estimate of how many ships are coming',
    origin: 'Names the planet it came from',
  },
  aegis: {
    label: 'Max shield',
    unlocks: 'Absorbs damage before your units take any. Regenerates 40% an hour',
  },
  veil: {
    label: 'Blinds a telescope up to',
    none: 'none',
    level: 'L{{level}}',
    unlocks: "Cuts a probe's accuracy to {{percent}} at equal Shipyard",
  },

  foundry: {
    label: 'Everything the works produce',
    now: 'as built',
    next: '+{{percent}}%',
    unlocks: 'Alloy and crystal both, for the rest of the season',
  },
  uplink: {
    label: 'Telescope and Radar',
    now: 'locked',
    next: 'unlocked',
    unlocks: 'The only way to stop guessing about the people around you',
  },
  derrick: {
    label: 'Every Prospector carries',
    now: '1×',
    next: '{{factor}}×',
    unlocks: 'And flies {{factor}}× faster — first to the rock takes the ore',
  },
  beacon: {
    label: 'Every fleet that leaves here',
    now: 'normal speed',
    next: '{{factor}}× faster',
    unlocks: 'Out and back — a shorter window with your defence away from home',
  },
} as const;

/** The situation engine: what a competent player would be thinking about now. */
export const directives = {
  inboundTitle: 'Inbound fleet · {{duration}}',
  inboundDetail:
    'Spend the stock, send your fleet out, or stand and fight. It cannot be taken if it is not here.',
  inboundAction: 'Spend it now',

  undefendedTitle: 'Nothing is defending this planet',
  undefendedDetail: '{{amount}} above your vault floor, and no ground defence. Bastions never leave.',
  undefendedAction: 'Build defence',

  exposedTitle: '{{amount}} can be taken from you',
  exposedDetail: 'Your vault protects {{now}}. The next level protects {{next}}.',
  exposedAction: 'Raise the Vault',

  scannedTitle_one: 'Someone scanned you',
  scannedTitle_other: '{{count}} scans against you',
  scannedDetail: 'They are building a picture of what you hold. A Veil makes that picture wrong.',
  scannedAction: 'See the log',

  windowTitle: "{{name}}'s fleet is away",
  windowDetailUnknownJustNow: 'Seen just now. You do not know when it returns.',
  windowDetailUnknown: 'Seen {{age}} ago. You do not know when it returns.',
  windowDetailEta:
    'Back in about {{duration}}. Their planet is holding whatever they left behind.',
  windowAction: 'Open the window',

  storageFullTitle: '{{amount}} cannot be collected',
  storageFullDetail:
    'Your store is full, so the works have nowhere to empty into. Spend something and claim it.',
  storageFullAction: 'Spend it',

  noTelescopeTitle: 'You cannot see anyone',
  noTelescopeDetail:
    'A Telescope watches one planet and tells you when its fleet leaves. Nobody is told you are watching.',
  noTelescopeAction: 'Install a Telescope',

  noRadarTitle: 'A fleet could land here without warning',
  noRadarDetail: 'Radar L3 names an inbound fleet while there is still time to put a gun on the ground.',
  noRadarAction: 'Look at Radar',

  coreCeilingTitle: 'Command Core is blocking {{count}} upgrades',
  coreCeilingDetail: 'Nothing may exceed the Core. Raising it releases all of them at once.',
  coreCeilingAction: 'Raise the Core',

  idleTitle: 'Nothing is in flight',
  idleDetailHasShips: 'Nothing will happen to you, or for you, until you send something.',
  idleDetailNoShips: 'You have no ships at home. Build some, or wait for yours to come back.',
  idleAction: 'Find a target',

  baysFreeTitle_one: 'One bay is still free',
  baysFreeTitle_other: '{{count}} bays are still free',
  baysFreeDetail: 'A probe, a raid or a mining run — anything that leaves takes one.',
  baysFreeAction: 'Look for something',

  /** The card that carries the top directive. */
  kindThreat: 'Threat',
  kindOpportunity: 'Opportunity',
  kindGrowth: 'Weakness',
  kindIdle: 'Nothing pending',
} as const;

/** The seven kinds of news, turned into the sentences a player reads. */
export const notifications = {
  incomingFallback: 'Incoming fleet.',
  incomingLanded: 'landed',
  incomingEta: 'ETA {{minutes}} min',
  incomingLandsIn: 'lands in {{duration}}',
  incomingHead: 'Incoming fleet · {{clock}}',
  strategicIncomingHead: 'Strategic weapon incoming · {{clock}}',
  incomingEstimate: 'est. {{count}} ships',
  incomingFrom: 'from {{origin}}',
  commanderAt: '{{username}} at {{planet}}',
  unknownCommander: 'someone',
  raidedBy: 'Raider: {{origin}} · ',
  composition: '{{count}} {{hull}}',
  join: ' · ',

  raidedFallback: 'You were raided.',
  repelledHead: 'Raid repelled · {{cost}}',
  repelledLost: '{{count}} lost holding',
  repelledTheirs: '{{count}} of theirs destroyed',
  raided: 'Raided · {{detail}}',
  raidedWorks: 'works down {{time}}',
  raidedTaken: '−{{amount}} taken',
  raidedLost_one: '{{count}} unit lost',
  raidedLost_other: '{{count}} units lost',
  raidedNothing: 'Raided · they got nothing',

  raidResultFallback: 'Your raid resolved.',
  raidWiped: '{{target}} held · your fleet was destroyed · {{count}} ships lost',
  raidResult: '{{grade}} at {{target}} · {{detail}} · {{count}} ships lost',
  raidNothing: 'nothing taken',
  spoilAlloy: '+{{amount}} alloy',
  spoilCrystal: '+{{amount}} crystal',
  spoilDeuterium: '+{{amount}} Deuterium',

  fleetFallback: 'Your fleet is home.',
  fleetHomeLooted: 'Fleet home{{where}} · {{count}} ships · +{{amount}} looted',
  fleetHomeEmpty: 'Fleet home{{where}} · {{count}} ships · empty-handed',
  fleetFrom: ' from {{origin}}',
  probeLost: 'Your probe was lost · that flight could not be completed',
  recalled: '{{count}} craft returned · that flight could not be completed',

  salvageWord: 'Salvage',
  oreWord: 'Ore',
  haulWasted: '{{what}} home · nowhere to put it · {{amount}} thrown away',
  haulNothing: '{{what}} run home · nothing left to take',
  haulPartly: '{{what}} home · {{landed}} · {{amount}} lost, works full',
  haul: '{{what}} home · {{landed}}',

  scanDetected: 'Scan detected. Someone is building a picture of you.',

  probeFallback: 'A probe is home. Its report is readable.',
  probeHome: 'Probe home · {{target}} is readable{{caught}}',
  probeCaught: ' · they caught it',

  unlock: '{{title}} — {{body}}',
  deathStarFallback: 'Your Death Star strike resolved.',
  deathStar: {
    FIRST_STRIKE: 'Death Star impact · the world entered recovery',
    CAPTURED: 'Death Star impact · colony captured',
    INEFFECTIVE: 'Death Star impact · no effect',
  },
  colonyCaptured: 'Colony secured · occupation protection is active',
  colonyLost: 'Colony lost to a strategic strike',
  settlementLost: 'Settlement race lost · the Hauler and cargo are returning',
} as const;

/**
 * TIME AND NUMBERS.
 *
 * Format primitives rather than sentences: the unit letters a countdown is built
 * from, and the two words that carry a reading's age. Everything here is read by
 * `lib/time.ts`, which is called from a dozen surfaces and must say the same thing
 * on every one of them.
 */
export const units = {
  now: 'now',
  live: 'live',
  ago: '{{duration}} ago',
  hoursMinutes: '{{h}}h {{m}}m',
  minutesSeconds: '{{m}}m {{s}}s',
  seconds: '{{s}}s',
  daysHours: '{{d}}d {{h}}h',
  minutes: '{{m}}m',
  /** Which BCP-47 locale groups thousands and formats decimals. */
  numberLocale: 'en-US',
  thousands: '{{value}}k',
  millions: '{{value}}M',
  percent: '{{value}}%',
  rangeJoin: '–',
  plus: '+',
  minus: '−',
} as const;
