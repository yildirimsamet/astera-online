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
    CORE: { name: 'Command Core', tag: 'Unlocks higher levels', role: 'Sets building ceilings, construction speed and the world\'s orbit, flight and ground-defence capacity', detail: 'No other building can rise above the Command Core. Raising it shortens building and research time, opens more orbit and flight slots at set levels, and expands ground-defence capacity. It produces no ore or combat power by itself.' },
    REFINERY: { name: 'Alloy Refinery', tag: 'Makes alloy', role: 'Alloy per hour, and alloy storage', detail: 'Each level increases passive alloy income and the amount that can be stored. Alloy pays for most construction and hulls, so this shortens many future waits.' },
    EXTRACTOR: { name: 'Crystal Extractor', tag: 'Makes crystal', role: 'Crystal per hour, and crystal storage', detail: 'Each level increases passive crystal income and storage. Crystal is the rarer half of advanced hardware, instruments and research costs.' },
    VAULT: { name: 'Vault', tag: 'Keeps ore safe from raids', role: 'Stock a raid can never reach', detail: 'It raises the protected floor and the storage ceiling. Raiders can take only what remains above that floor; the Vault does not fight them.' },
    SHIPYARD: { name: 'Shipyard', tag: 'Unlocks better ships', role: 'Unlocks hulls · speeds ship and ground-defence construction · sets probe accuracy and stealth', detail: 'Higher levels open new hull classes and finish ships and ground defences faster. They also sharpen your probe readings and make your own probes harder to catch. Shipyard levels add neither hangar room nor queue slots.' },
    DEUTERIUM_PLANT: { name: 'Deuterium Refinery', tag: 'Makes deuterium', role: 'The only steady source of fuel · its ceiling is your Deuterium Synthesis rung', detail: 'It turns the planet into a reliable fuel source for fleet launches. Research Deuterium Synthesis when the next Refinery level is capped.' },
    HANGAR: { name: 'Hangar', tag: 'Sets how big a fleet fits', role: 'Room for craft · a fleet is bounded by this, not by your purse', detail: 'Every mobile hull consumes hangar space according to its bulk, including craft away from home. Raise this before ordering a fleet the planet cannot hold.' },
  },

  instrument: {
    TELESCOPE: {
      name: 'Telescope',
      tag: 'Resolve distant movement',
      role:
        'Identifies movement inside its reach; watch slots become 1, 2 and 3 at L1, L3 and L5. Silent.',
      roleNone:
        'SEE OUT. Identify distant movement; watch a chosen world to learn whether its fleet is home. Needs an Uplink overhead.',
      roleOwned:
        'SEE OUT. Extends moving-contact sight and watches chosen worlds silently. Knowledge, and no protection whatsoever.',
      detail: 'More levels extend moving-contact sight and reveal passing asteroids when they enter that area; a revealed rock stays known until it is gone. L1, L3 and L5 provide one, two and three silent watch slots. A Telescope never warns that a fleet is aimed at you.',
    },
    RADAR: {
      name: 'Radar',
      tag: 'Distinguish threats to you',
      role:
        'Catches probes. From L3, marks a threat aimed at you and gives its arrival time inside the Radar circle.',
      roleNone:
        /*
          IT SAYS "MOST", BECAUSE A BARE WORLD IS NOT BLIND TO SCOUTS.
          `detectChance` has a floor: a world with no Radar still catches about one
          probe in seven and is told. That is deliberate — the scan notification is
          what teaches a new commander the Radar exists at all. The copy said
          "unseen", which was simply false, and a sentence that oversells a purchase
          is the one thing a decision surface may not do.
        */
        'BE WARNED. Right now a fleet can land here with no notice at all, and most scouts come and go unseen. Needs an Uplink overhead.',
      roleOwned:
        'BE WARNED. Marks threats aimed at you with a clock. L4 adds rough size; L5 adds origin and the full force.',
      detail: 'Early levels catch probes and their bearing. From L3 the Radar circle marks fleets aimed at this world and gives their arrival time.',
    },
    AEGIS: {
      name: 'Aegis',
      tag: 'Shield for your planet',
      role: 'Shield HP, regenerating 40% an hour. Sits at the planet, not in orbit.',
      roleNone:
        'ABSORB. Sits at the planet, not in orbit. Soaks the opening damage of a raid and regrows on its own, free. Safe, and completely blind.',
      roleOwned:
        'ABSORB. Sits at the planet, not in orbit. Soaks the opening damage of a raid and regrows on its own, free. Safe, and completely blind.',
      detail: 'Each level adds shield capacity. The shield absorbs damage before ships and ground guns do, then regenerates at no resource cost; it provides no information or interception.',
    },
    VEIL: {
      name: 'Veil',
      tag: 'Hide from telescopes',
      role: "Degrades what anyone's telescope can read about you.",
      roleNone:
        'BE UNREADABLE. Their telescope reads UNKNOWN instead of your fleet. It hides; it never lies — and it does not stop a probe.',
      roleOwned:
        'BE UNREADABLE. Their telescope reads UNKNOWN instead of your fleet. It hides; it never lies — and it does not stop a probe.',
      detail: 'A stronger Veil defeats stronger Telescope readings and reduces equal-Shipyard probe accuracy. It hides your state; it does not invent false data or block an incoming probe.',
    },
  },

  satellite: {
    UPLINK: {
      name: 'Uplink',
      tag: 'Unlocks Telescope and Radar',
      role:
        'SEE FARTHER. The only way to reach the Telescope and Radar. It produces nothing and defends nothing; your free naked-eye neighbourhood remains without it.',
      blurb:
        'A comms relay. It produces nothing and defends nothing — it opens the Telescope and Radar that extend your free naked-eye neighbourhood.',
      detail: 'Install it once to make Telescope and Radar construction available on this world. It uses one orbit slot and never needs levels of its own.',
    },
    FOUNDRY: {
      name: 'Foundry',
      tag: 'More ore every hour',
      role:
        'EARN. Both metals, faster, for the rest of the season. The slowest reward here and the only one still paying on the last day.',
      blurb:
        'Refits the works. Alloy and crystal both come out faster, for as long as it is up there. The slowest reward on this list and the one that is still paying on the last day of the season.',
      detail: 'Its permanent multiplier applies to both passive ore streams on this world. It pays back gradually, so it is strongest when installed early.',
    },
    DERRICK: {
      name: 'Derrick',
      tag: 'Better mining craft',
      role:
        'MINE. Your Prospectors carry far more and get there much sooner — which on a contested rock is the whole difference between first and second. Worth nothing if you never send one.',
      blurb:
        'A tender for mining craft. Every Prospector you own carries far more ore and reaches its rock much sooner — which on a contested asteroid is the whole difference between arriving first and arriving second.',
      detail: 'It multiplies both Prospector speed and carrying capacity from this world. It changes asteroid mining only; ordinary raid cargo is unaffected.',
    },
    BEACON: {
      name: 'Beacon',
      tag: 'Faster fleets',
      role:
        'STRIKE. Every fleet you send is away for less time, out and back. It wins no fight; it shortens the window where your planet is the undefended one.',
      blurb:
        'A navigation mark. Every fleet that leaves this planet flies faster, out and back. Shorter flights mean a shorter window with your defence away from home.',
      detail: 'The speed multiplier applies to every outbound and return fleet launched here. Travel shortens, but attack, armour and cargo stay exactly the same.',
    },
  },

  hull: {
    WASP: {
      name: 'Wasp',
      tag: 'Cheap, fast attacker',
      role: 'Cheapest attack, fastest out and back',
      pitch: 'Cheapest damage, fastest home. The shortest time spent undefended.',
      detail: 'Use Wasps for inexpensive, quick pressure or to punish heavy Bulwarks. They lose badly to Lances and do not carry loot by themselves.',
    },
    LANCE: {
      name: 'Lance',
      tag: 'Hits the hardest',
      role: 'Highest attack · strong into Wasps, weak into Bulwarks',
      pitch: 'Hits hardest. Shreds Wasps, bounces off Bulwarks.',
      detail: 'Lances convert fleet space into high attack and counter Wasp swarms. Bulwark armour is their bad matchup, so a one-hull Lance fleet is easy to answer.',
    },
    BULWARK: {
      name: 'Bulwark',
      tag: 'Slow and tough',
      role: 'The durability anchor · slow enough to double your exposure',
      pitch: 'Survives what kills everything else. Nearly doubles your time away.',
      detail: 'Bulwarks keep a force alive against Lance-heavy opposition and counter it efficiently. Their low speed makes every mission and the time your home is exposed much longer.',
    },
    HAULER: {
      name: 'Hauler',
      tag: 'Carries the loot home',
      role: 'Carries the loot home · contributes nothing to the fight',
      pitch: 'Carries the loot home. Useless in the fight — escort it or lose it.',
      detail: 'Add Haulers when exposed stock is worth taking. Their cargo is cheap, but support hulls cannot deal damage and remain protected only while combat hulls survive.',
    },
    RUNNER: {
      name: 'Runner',
      tag: 'Fast strike cargo',
      role: 'Fast support hold · expensive capacity for short exposure windows',
      pitch: 'Carries less than a Hauler, but moves with a strike fleet. Speed is what you buy.',
      detail: 'Runners keep cargo from slowing a fast raid. They cost more per unit carried than Haulers, so buy them when a shorter exposure window matters more than efficiency.',
    },
    BREACHER: {
      name: 'Breacher',
      tag: 'Breaks active shields',
      role: 'Lance specialist. Five times its normal effect against an active shield.',
      pitch: 'Crushes an Aegis without turning bonus damage into unit kills. Weak when no shield is standing.',
      detail: 'Its specialist charge deals five times normal effect to an active Aegis. Once the shield falls, that bonus does not spill into ships or guns, so unshielded targets waste its premium.',
    },
    BASTION: {
      name: 'Bastion',
      tag: 'Heavy ground guns',
      role: 'Ground defence · cannot ever leave the planet',
      pitch: 'Heavy ground guns. Break Lances; swarms overwhelm them.',
      detail: 'Bastions never leave the planet and are built to stop Lance-heavy attacks. Wasps overwhelm their slow heavy fire; destroyed ground guns partly rebuild from salvage.',
    },
    THORN: {
      name: 'Thorn',
      tag: 'Light ground guns',
      role: 'Ground defence · light, cheap, and never leaves',
      pitch: 'Light ground guns, cheap and many. Tear into heavies; Lances pick them off.',
      detail: 'Thorns are the cheap permanent answer to Bulwark-heavy raids. Lances pick them apart, and like every ground gun they occupy ground capacity rather than Hangar space.',
    },
    PROSPECTOR: {
      name: 'Prospector',
      tag: 'Mines asteroids',
      role: 'Mines passing asteroids · never joins a fight',
      pitch: 'Flies to a passing rock and brings the ore back. Never fights.',
      detail: 'Send it to a visible asteroid before another commander reaches it. It returns ore to the Works, counts against the planet-wide Prospector limit and contributes nothing in combat.',
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
      body: 'An Uplink and Telescope identify movement farther out and let you watch one planet.',
    },
    RADAR: {
      title: 'Radar unlocked',
      body: 'An Uplink and Radar catch probes; at L3 the Radar circle also marks threats aimed at you with their arrival time.',
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
    maxed: 'Top level: {{slots}} watch slots and {{range}} units of moving-contact sight; the outer rim stays fogged',
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
    sweepLabel: 'Threat sense · timed warning',
    sweepNone: 'none',
    reaches: '{{sense}} no ETA · {{warn}} timed',
    maxed: 'Top level; the close warning also gives the origin and exact force',
    l2l3: 'L2 adds the bearing · L3 warns about inbound fleets',
    estimate: 'Shows the approaching force’s rough size early',
    origin: 'The close warning names its origin and exact force',
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
  hangar: {
    label: 'Fleet room',
    value: '{{room}}',
  },
  /**
   * RESEARCH, WHICH WAS SOLD ON PROSE ALONE UNTIL NOW.
   *
   * Every label is the quantity the player FEELS, not the mechanism: a doctrine
   * is "Wasp attack and hull", not "combat multiplier". The scope lines matter
   * more than usual on this ladder, because the choice between a class doctrine
   * and the general project is a choice between the same percentage applied to
   * one hull family and to all of them.
   */
  research: {
    doctrineLabel: '{{hull}} attack and hull',
    doctrineScope: 'Every {{hull}} you own, everywhere. Support hulls are unaffected.',
    lanceScope: 'Every {{lance}} and {{breacher}} you own. Support hulls are unaffected.',
    groundLabel: 'Ground defence strength',
    groundScope: '{{bastion}} and {{thorn}} on every world you hold.',
    generalLabel: 'Every hull, attack and armour',
    generalScope:
      'Applies to every craft you own, including support hulls no doctrine covers. Stacks with class doctrine; the two together are capped at 25% combat power.',
    yardLabel: 'Ship build time',
    holdsLabel: 'Prospector hold',
    holdsScope: 'Multiplies with a Derrick in orbit.',
    cargoLabel: 'Raid cargo',
    cargoScope: 'Loot only — world transfers and mining are unchanged.',
    refineryLabel: 'Refinery ceiling',
    stockpileLabel: 'Ready weapons',
    /* A permission opens a door; drawing it as a ladder would invent a quantity. */
    opensLabel: 'Unlocks',
    open: 'Open',
    shut: 'Locked',
    isotopeOpens: 'Isotope asteroids become selectable mining targets.',
    denseOpens: 'The Runner hull becomes buildable.',
    graviticOpens: 'The Breacher hull becomes buildable.',
    protocolOpens: 'The Death Star becomes buildable.',
    gridOpens: 'The interceptor charge becomes buildable.',
  },
  plant: {
    label: 'Deuterium',
    value: '{{rate}}/h',
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

  noTelescopeTitle: 'You only have naked-eye sight',
  noTelescopeDetail:
    'Your free sight can already reveal a passing asteroid nearby. A Telescope extends that discovery area, identifies moving craft farther out and can silently watch a planet to tell you when its fleet leaves.',
  noTelescopeAction: 'Install a Telescope',

  noRadarTitle: 'A fleet could land here without warning',
  noRadarDetail: 'Radar L3 marks a threat aimed at you with its arrival time inside the Radar circle.',
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
  /** Which of the reader's own worlds is under the crosshair. Never a radar product. */
  incomingAt: 'aimed at {{world}}',
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
  interceptedDefended: 'Your grid destroyed a Death Star {{range}} units out.',
  interceptedLost: 'Your Death Star was destroyed {{range}} units short of its target.',
  interceptedFallback: 'A Death Star was destroyed in flight.',
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
