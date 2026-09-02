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
    DEUTERIUM_PLANT: { name: 'Deuterium Refinery', tag: 'Makes Deuterium', role: 'Deuterium per hour and fuel storage · its ceiling is set by Deuterium Synthesis', detail: 'Each level increases passive Deuterium production and the amount that can be stored. Deuterium fuels fleet launches; research the next Deuterium Synthesis rung when the Refinery reaches its level ceiling.' },
    HANGAR: { name: 'Hangar', tag: 'Sets how big a fleet fits', role: 'Room for craft · a fleet is bounded by this, not by your purse', detail: 'Every mobile hull consumes hangar space according to its bulk, including craft away from home. Raise this before ordering a fleet the planet cannot hold.' },
  },

  instrument: {
    TELESCOPE: {
      name: 'Telescope',
      tag: 'Resolve distant movement',
      role:
        'Identifies movement inside its reach; watch slots become 1, 2 and 3 at L1, L3 and L5. Silent.',
      roleNone:
        'Identifies distant movement and lets you watch a chosen world silently to learn whether its fleet is home. Requires an Uplink in orbit.',
      roleOwned:
        'Extends the area where moving craft are identified and provides silent watch slots. It gives intelligence, not protection.',
      detail: 'More levels extend moving-contact sight and reveal passing asteroids when they enter that area; a revealed rock stays known until it is gone. L1, L3 and L5 provide one, two and three silent watch slots. A Telescope never warns that a fleet is aimed at you.',
    },
    RADAR: {
      name: 'Radar',
      tag: 'Distinguish threats to you',
      role:
        'Detects movement inside its circle, improves probe detection and marks threats aimed at this world with an arrival time.',
      roleNone:
        /*
          IT SAYS "MOST", BECAUSE A BARE WORLD IS NOT BLIND TO SCOUTS.
          `detectChance` has a floor: a world with no Radar still catches about one
          probe in seven and is told. That is deliberate — the scan notification is
          what teaches a new commander the Radar exists at all. The copy said
          "unseen", which was simply false, and a sentence that oversells a purchase
          is the one thing a decision surface may not do.
        */
        'Requires an Uplink in orbit. Without Radar, inbound fleets give no arrival warning and most probes pass unnoticed.',
      roleOwned:
        'Detects movement inside its circle without an ETA and marks threats aimed at this world with an arrival time. L2 adds bearing, L4 rough size, and L5 the origin world and full fleet.',
      detail: 'Every level widens the contact and timed-warning circle and improves the chance of catching probes. L1 marks an inbound fleet with its arrival time, L2 adds bearing, L4 estimates its strength, and L5 reveals its origin and ships. Movement not aimed at this world is detected without an ETA. An Interception Grid can engage strategic weapons only at Radar 3 or above.',
    },
    AEGIS: {
      name: 'Aegis',
      tag: 'Shield for your planet',
      role: 'A planetary shield that takes damage before units and regenerates 35% of its maximum each hour.',
      roleNone:
        'Absorbs raid damage before ships and ground guns, then regenerates without resources. It provides no intelligence and cannot intercept strategic weapons.',
      roleOwned:
        'Absorbs raid damage before ships and ground guns and regenerates 35% of its maximum each hour. It provides no intelligence or strategic interception.',
      detail: 'Each level raises maximum shield strength. Combat damage is removed from Aegis before it reaches ships or ground guns, and the shield regenerates 35% of its maximum per hour without resources. It gathers no intelligence; stopping a Death Star requires an Interception Grid.',
    },
    VEIL: {
      name: 'Veil',
      tag: 'Hide from telescopes',
      role: "Degrades what anyone's telescope can read about you.",
      roleNone:
        'Can make your fleet status unreadable to an opposing Telescope. It hides information but neither invents false readings nor stops probes.',
      roleOwned:
        'Can make your fleet status unreadable to an opposing Telescope. It hides information but neither invents false readings nor stops probes.',
      detail: 'A stronger Veil defeats stronger Telescope readings and reduces equal-Shipyard probe accuracy. It hides your state; it does not invent false data or block an incoming probe.',
    },
  },

  satellite: {
    UPLINK: {
      name: 'Uplink',
      tag: 'Unlocks Telescope and Radar',
      role:
        'Required to install a Telescope or Radar on this world. It uses one orbit slot and provides no production or defence bonus.',
      blurb:
        'A communications relay that unlocks the Telescope and Radar. It does not extend sight by itself.',
      detail: 'Install it once to make Telescope and Radar construction available on this world. It uses one orbit slot and never needs levels of its own.',
    },
    FOUNDRY: {
      name: 'Foundry',
      tag: 'More ore every hour',
      role:
        'Raises this world’s passive alloy, crystal and Deuterium production by 6%.',
      blurb:
        'Supports production from orbit, increasing all three hourly resource streams along with the Works and storage capacities derived from them.',
      detail: 'The Foundry applies a 1.06 multiplier to passive alloy, crystal and Deuterium production on this world. The Works and storage limits derived from those rates rise with it; Vault protection does not. It does not affect mining holds or raid cargo.',
    },
    DERRICK: {
      name: 'Derrick',
      tag: 'Better mining craft',
      role:
        'Gives every Prospector owned by this world 2.6× carrying capacity and 1.5× travel speed.',
      blurb:
        'Supports this world’s mining craft from orbit. Larger holds increase each haul, while faster travel improves their chance of reaching a contested asteroid in time.',
      detail: 'It multiplies Prospector carrying capacity by 2.6 and speed by 1.5. Prospector Holds research multiplies the improved hold again. The Derrick changes mining craft only; raid cargo is unaffected.',
    },
    BEACON: {
      name: 'Beacon',
      tag: 'Faster fleets',
      role:
        'Makes every raid and transfer fleet launched here travel 1.3× faster on both legs.',
      blurb:
        'A navigation mark. Every fleet that leaves this planet flies faster, out and back. Shorter flights mean a shorter window with your defence away from home.',
      detail: 'Its 1.3 speed multiplier applies to every outbound and return raid or transfer fleet launched here. It does not affect Prospectors, attack, armour or cargo.',
    },
  },

  hull: {
    DART: {
      name: 'Dart', tag: 'Fragile speed raider', role: 'Fastest entry combat hull; trades durability for exposure time.',
      pitch: 'Arrives and returns quickly, but folds under concentrated fire.',
      detail: 'A low-cost Skirmisher for short raids and heavy-hull counters. Its speed preserves home-defence uptime; its thin hull makes a failed read expensive.',
    },
    PIKE: {
      name: 'Pike', tag: 'Entry strike hull', role: 'High attack for its price; fragile against Bulwark-class targets.',
      pitch: 'Commits more of its budget to damage than survival.',
      detail: 'A Lance-class striker that punishes Skirmishers and Thorns. Ramparts and Bastions counter it, so an all-Pike force has a visible answer.',
    },
    RAMPART: {
      name: 'Rampart', tag: 'Entry fortress', role: 'Cheap durability that makes the whole fleet slower.',
      pitch: 'Absorbs Lance fire efficiently; vulnerable to Skirmisher swarms.',
      detail: 'A slow Bulwark-class line hull. It buys survival instead of attack and is best when travel time matters less than holding formation.',
    },
    WARDEN: {
      name: 'Warden', tag: 'Mobile escort', role: 'Balanced protection without Rampart-level delay.',
      pitch: 'Less hull than a fortress, more speed and attack for mixed fleets.',
      detail: 'An entry Bulwark escort for compositions that need protection without accepting the slowest travel profile.',
    },
    COURIER: {
      name: 'Courier', tag: 'Fast light transport', role: 'Entry cargo hull; fast, lightly protected and unarmed.',
      pitch: 'Keeps quick raids quick, but needs escorts and carries less.',
      detail: 'A support hull for loot, transfers and settlement. It deals no damage and is protected only while combat escorts survive.',
    },
    VIPER: {
      name: 'Viper', tag: 'Efficient raider', role: 'Tier-two speed and better survival than Dart.',
      pitch: 'Preserves the fast-fleet plan while paying less durability tax.',
      detail: 'A research-free tier-two Skirmisher. Dart remains cheaper; Viper converts a larger commitment into better equal-cost efficiency.',
    },
    TALON: {
      name: 'Talon', tag: 'Heavy striker', role: 'Tier-two attack specialization with moderate speed.',
      pitch: 'More efficient strike damage without removing Pike’s cheap role.',
      detail: 'A Lance-class damage hull for developed yards. Bulwark counters still matter more than its tier advantage.',
    },
    STRONGHOLD: {
      name: 'Stronghold', tag: 'Heavy line hull', role: 'Maximum tier-two durability; slow and expensive.',
      pitch: 'Builds a wall when survival matters more than arrival time.',
      detail: 'A fortress-profile Bulwark. Its high hull anchors fleets, while Skirmishers and long exposure remain clear costs.',
    },
    SENTINEL: {
      name: 'Sentinel', tag: 'Tier-two escort', role: 'Faster defensive escort for mixed formations.',
      pitch: 'Trades fortress durability for attack and fleet tempo.',
      detail: 'A mobile Bulwark escort that protects transports without forcing the Stronghold travel profile.',
    },
    WAYFARER: {
      name: 'Wayfarer', tag: 'Balanced transport', role: 'More capacity than Courier; slower but still flexible.',
      pitch: 'The middle choice between fast Courier and high-capacity Atlas.',
      detail: 'A tier-two support transport for larger raids and transfers. It remains unarmed and depends on combat escorts.',
    },
    TEMPEST: {
      name: 'Tempest', tag: 'Advanced speed raider', role: 'Fastest combat hull; research-gated Skirmisher.',
      pitch: 'Late-game speed with improved efficiency, still not a line ship.',
      detail: 'An advanced raider unlocked by Engineering and Ship Power. It keeps a fragile profile so lower-tier walls and counters remain relevant.',
    },
    BALLISTA: {
      name: 'Ballista', tag: 'Advanced striker', role: 'Research-gated heavy attack in the Lance class.',
      pitch: 'Concentrated damage that still breaks against the right wall.',
      detail: 'A tier-three strike hull requiring Engineering and Ship Power. It rewards an informed target, not blind mono-fleet production.',
    },
    LEVIATHAN: {
      name: 'Leviathan', tag: 'Advanced fortress', role: 'Huge line durability bought with speed.',
      pitch: 'A late-game wall that makes every flight a long commitment.',
      detail: 'A tier-three fortress unlocked through Engineering and Ship Armor. Skirmishers remain its efficient counter.',
    },
    PRAETORIAN: {
      name: 'Praetorian', tag: 'Advanced escort', role: 'Durable, mobile protection for valuable fleets.',
      pitch: 'Less hull than Leviathan, more tempo for mixed formations.',
      detail: 'A tier-three Bulwark escort requiring Engineering and Ship Armor. It protects cargo without becoming the slowest possible choice.',
    },
    ATLAS: {
      name: 'Atlas', tag: 'Maximum cargo', role: 'Largest hold; slow, bulky and research-gated.',
      pitch: 'Best capacity efficiency when the route is safe enough to be slow.',
      detail: 'A tier-three support transport unlocked by Engineering and Propulsion. It deals no damage and makes escort planning essential.',
    },
    NULLIFIER: {
      name: 'Nullifier',
      tag: 'Breaks active shields',
      role: 'Lance specialist. Five times its normal effect against an active shield.',
      pitch: 'Crushes an Aegis without turning bonus damage into unit kills. Weak when no shield is standing.',
      detail: 'Its specialist charge deals five times normal effect to an active Aegis. Once the shield falls, that bonus does not spill into ships or guns, so unshielded targets waste its premium.',
    },
    CATACLYSM: {
      name: 'Cataclysm', tag: 'Capital striker', role: 'Tier-four attack peak; powerful, costly and deliberately slow.',
      pitch: 'Exceptional concentrated damage without immunity to counters.',
      detail: 'A capital Lance hull behind Engineering, Power and Armor. Its efficiency is higher, but Bulwark-class defence remains a better answer than mirroring it.',
    },
    CITADEL: {
      name: 'Citadel', tag: 'Capital fortress', role: 'Tier-four durability peak and the slowest mobile commitment.',
      pitch: 'The strongest wall, paid for in cost and exposure time.',
      detail: 'A capital Bulwark hull behind Engineering, Armor and Power. It anchors defence but remains vulnerable to Skirmisher counters.',
    },
    BASTION: {
      name: 'Bastion',
      tag: 'Heavy ground guns',
      role: 'Ground defence · cannot ever leave the planet',
      pitch: 'Heavy ground defence with an advantage against Lance-class hulls; vulnerable to Skirmishers.',
      detail: 'Bastions never leave the planet. Their Bulwark class gives them an advantage against Lance-class hulls, while Skirmishers receive the advantage against them. After combat, 60% of destroyed ground guns are restored, rounded down.',
    },
    THORN: {
      name: 'Thorn',
      tag: 'Light ground guns',
      role: 'Ground defence · light, cheap, and never leaves',
      pitch: 'Low-cost ground defence with an advantage against Bulwarks; vulnerable to Lances.',
      detail: 'Thorns never leave the planet. Their Skirmisher class gives them an advantage against Bulwark-class hulls, while Lance-class hulls receive the advantage against them. They use ground capacity rather than Hangar space; 60% of destroyed ground guns are restored after combat, rounded down.',
    },
    PROSPECTOR: {
      name: 'Prospector',
      tag: 'Mines asteroids',
      role: 'Mines asteroids with a base hold of 300 · cannot join a raid fleet',
      pitch: 'Intercepts a moving asteroid and returns what it can carry to the Works. It cannot raid or transfer.',
      detail: 'A Prospector can be sent only to revealed asteroids and debris fields. Its base speed is 825 and its base hold is 300; a Derrick and Prospector Holds research can improve them. Each world may own at most two. It uses Hangar room but never joins raids or home defence.',
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
      body: 'An Uplink and Radar catch probes; from L1 its circle also marks threats aimed at you with their arrival time.',
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
    raisesCap: 'Raises the level ceiling for buildings',
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
    value: '{{alloy}} alloy · {{crystal}} crystal · {{deuterium}} Deuterium',
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
    sweepLabel: 'Contact area · timed warning',
    sweepNone: 'none',
    reaches: '{{sense}} contact (no ETA) · {{warn}} timed warning',
    maxed: 'Top level; warnings also reveal the origin world and exact fleet',
    l1: 'Starts catching probes and warns when an inbound fleet enters the circle',
    bearing: 'L2 also reveals the direction of approach',
    interception: 'L3 enables strategic interception once Interception Grid is researched',
    estimate: 'Shows the approaching force’s rough size early',
    origin: 'The warning names the origin world and exact fleet',
  },
  aegis: {
    label: 'Max shield',
    unlocks: 'Absorbs damage before units do · regenerates {{percent}}% of maximum each hour',
  },
  veil: {
    label: 'Blinds a telescope up to',
    none: 'none',
    level: 'L{{level}}',
    unlocks: "Cuts a probe's accuracy to {{percent}} at equal Shipyard",
  },

  foundry: {
    label: 'Hourly resource production',
    now: 'current output',
    next: '+{{percent}}%',
    unlocks: 'Applies to alloy, crystal and Deuterium production on this world',
  },
  uplink: {
    label: 'Telescope and Radar',
    now: 'locked',
    next: 'unlocked',
    unlocks: 'A Telescope and Radar can be installed on this world',
  },
  derrick: {
    label: 'Every Prospector carries',
    now: '1×',
    next: '{{factor}}×',
    unlocks: 'Prospectors also travel {{factor}}× faster',
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
  /** Every research row names the quantity or permission the player actually buys. */
  research: {
    powerLabel: 'Fleet V2 combat attack',
    powerScope:
      'Every Fleet V2 combat hull. Power × Armor can add at most 25% equal-budget combat power; transports and preserved units are unaffected.',
    armorLabel: 'Fleet V2 hull strength',
    armorScope:
      'All 18 Fleet V2 hulls, including transports. Power × Armor can add at most 25% equal-budget combat power; preserved units are unaffected.',
    speedLabel: 'Fleet V2 speed',
    speedScope:
      'All 18 Fleet V2 hulls. A mixed fleet still flies at its slowest member’s improved speed; Prospectors, probes and the Death Star are unaffected.',
    engineeringLabel: 'Hull tier access',
    engineeringTier: 'Tier {{tier}}',
    engineeringScope:
      'Engineering I opens Tier 3 and Engineering II opens Tier 4. Individual hulls can also require Power, Armor, Propulsion or Gravitic Charges.',
    groundLabel: 'Ground defence strength',
    groundScope: '{{bastion}} and {{thorn}} on every world you hold.',
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
    denseOpens: 'Ship Propulsion research becomes available.',
    graviticOpens: 'The Nullifier’s specialist research requirement is met.',
    protocolOpens: 'The Death Star becomes buildable.',
    gridOpens: 'The interceptor charge becomes buildable.',
  },
  plant: {
    label: 'Deuterium',
    value: '{{rate}}/h',
    storage: 'Fuel storage {{now}} → {{next}}',
  },
} as const;

/** The situation engine: what a competent player would be thinking about now. */
export const directives = {
  inboundTitle: 'Inbound fleet · {{duration}}',
  inboundDetail:
    'Spend the stock, send your fleet out, or stand and fight. It cannot be taken if it is not here.',
  inboundAction: 'Spend it now',

  undefendedTitle: 'This world has no ground defence',
  undefendedDetail: '{{amount}} is exposed to raids. Build Thorns or Bastions for permanent defence.',
  undefendedAction: 'Build defence',

  exposedTitle: '{{amount}} can be taken from you',
  exposedDetail: 'Your vault protects {{now}}. The next level protects {{next}}.',
  exposedAction: 'Raise the Vault',

  scannedTitle_one: 'Someone scanned you',
  scannedTitle_other: '{{count}} scans against you',
  scannedDetail: 'They are trying to learn your stock and defences. A Veil reduces what their probe can reveal.',
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
  noRadarDetail: 'Radar L1 already marks a threat aimed at you with its arrival time inside the circle. Higher levels expand the range and reveal more detail.',
  noRadarAction: 'Look at Radar',

  coreCeilingTitle: 'Command Core is blocking {{count}} upgrades',
  coreCeilingDetail: 'Nothing may exceed the Core. Raising it releases all of them at once.',
  coreCeilingAction: 'Raise the Core',

  idleTitle: 'Nothing is in flight',
  idleDetailHasShips: 'Your bays are idle. You can launch a probe, raid, transfer or mining run.',
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
  transferReturningCapacity: 'Transfer returning from {{target}} · destination capacity filled in flight',
  transferReturningOwnership: 'Transfer returning from {{target}} · the world changed hands in flight',

  salvageWord: 'Salvage',
  oreWord: 'Ore',
  haulWasted: '{{what}} home · no capacity available · {{amount}} discarded',
  haulNothing: '{{what}} run home · nothing left to take',
  haulPartly: '{{what}} home · {{landed}} · {{amount}} lost, works full',
  haul: '{{what}} home · {{landed}}',

  scanDetected: 'Scan detected. Someone is gathering intelligence about your world.',

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
  settlementLost: 'Settlement race lost · the Couriers and cargo are returning',
  interceptedDefended: 'Your grid destroyed a Death Star {{range}} units out.',
  interceptedLost: 'Your Death Star was destroyed {{range}} units short of its target.',
  interceptedFallback: 'A Death Star was destroyed in flight.',
  asteroidShowerStarted: 'An asteroid shower has begun in the galaxy.',
  asteroidShowerEnded: 'The asteroid shower has ended · asteroid spawn is back to normal.',
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
