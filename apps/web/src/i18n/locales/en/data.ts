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
    CORE: { name: 'Command Core', tag: 'Unlocks higher levels', role: "Sets local structure level limits and opens flight bays, orbit slots and ground-defence capacity.", detail: "The Core limits local structure levels; Hangar has an independent limit. Certain levels add flight bays, orbit slots and ground-defence capacity. Core upgrades shorten instrument and satellite installation, except Uplink. Building upgrade time depends on building type and level. The capital’s Core determines research time and some research requirements. On the capital, levels 9, 13 and 16 open the first, second and third colony slots." },
    REFINERY: { name: 'Alloy Refinery', tag: 'Makes alloy', role: "Increases this planet’s hourly alloy production and alloy storage capacity.", detail: "Each level produces more alloy in the Works and increases how much alloy fits in the Store. Collect the produced resources before spending them. Alloy is used in most buildings, ships and ground defences." },
    EXTRACTOR: { name: 'Crystal Extractor', tag: 'Makes crystal', role: "Increases this planet’s hourly crystal production and crystal storage capacity.", detail: "Each level produces more crystal in the Works and increases how much crystal fits in the Store. Collect it before spending. Crystal is required for advanced ships, instruments and research." },
    VAULT: { name: 'Store', tag: 'Deepens the store', role: "Expands storage. Raids cannot take the smaller of 10% of capacity or 8 hours of production.", detail: "Each level stores more hours of production. Capacity also covers at least 110% of the next same-level alloy or crystal producer upgrade cost. At Store level L, these are the alloy cost of Refinery L→L+1 and crystal cost of Extractor L→L+1. The resulting storage hours also apply to deuterium. The protected amount is the smaller of 10% of capacity or 8 hours of that resource’s production. Remaining stock can be raided; the Store does not absorb combat damage." },
    SHIPYARD: { name: 'Shipyard', tag: 'Unlocks better ships', role: "Opens new units, speeds ship and ground-defence production, and improves your probes.", detail: "Higher levels meet more ship and ground-defence build requirements and shorten production time. They improve your probes’ accuracy and make them harder for enemy Radar to detect. They do not add queue slots. Advanced units can also require completed research." },
    HANGAR: { name: 'Hangar', tag: 'Sets how much fleet fits', role: "Provides room for this planet’s ships. Its upgrades are independent of Command Core level.", detail: "Ships use room according to their size, including ships away on missions or waiting for repair. Ground defences use separate ground capacity. New ship orders and arrivals need available room. A full Hangar does not delete existing ships. Higher upgrade prices may require a larger Store to collect enough resources." },
    DEUTERIUM_PLANT: { name: 'Deuterium Refinery', tag: 'Makes Deuterium', role: "Increases hourly deuterium production and storage. Deuterium Synthesis also limits its level.", detail: "Each level increases deuterium produced in the Works and the Store capacity derived from that production. Deuterium supplies flight fuel. The next upgrade must fit both local Command Core and Deuterium Synthesis limits. Research more Synthesis levels when its limit blocks further upgrades." },
  },

  instrument: {
    TELESCOPE: {
      name: 'Telescope',
      tag: 'Resolve distant movement',
      role:
        "Identifies moving contacts. Levels 1, 3, 5 and 7 provide 1, 2, 3 and 4 silent watch slots respectively.",
      roleNone:
        'Identifies distant movement and lets you watch a chosen world silently to learn whether its fleet is home. Requires an Uplink in orbit.',
      roleOwned:
        'Extends the area where moving craft are identified and provides silent watch slots. It gives intelligence, not protection.',
      detail: "Higher levels extend contact identification range. Asteroids entering that area are revealed and stay known until they disappear. Watch slots track whether assigned planets’ fleets are home or away; Veil affects reading clarity. Contact range and watch range are separate. Telescope does not provide inbound attack arrival warnings; Radar does.",
    },
    RADAR: {
      name: 'Radar',
      tag: 'Distinguish threats to you',
      role:
        "Detects nearby movement and probes, and warns about attacks aimed at this planet.",
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
      detail: "Level 1 shows an incoming attack’s arrival time. Level 2 adds direction, level 4 estimated strength, and level 5 origin and ship details. Higher levels also increase detection range and probe-detection chance. An unrelated moving contact does not necessarily carry an arrival warning.",
    },
    AEGIS: {
      name: 'Aegis',
      tag: 'Shield for your planet',
      role: "Absorbs damage before defending units and regenerates 35% of its maximum strength each hour.",
      roleNone:
        'Absorbs raid damage before ships and ground guns, then regenerates without resources. It provides no intelligence.',
      roleOwned:
        'Absorbs raid damage before ships and ground guns and regenerates 35% of its maximum each hour. It provides no intelligence.',
      detail: "Each level raises maximum shield strength. While active, Aegis absorbs combat damage before ships and ground defences. It regenerates without resource payment, except while EMP disables it. Aegis alone cannot defend a planet without combat-ready units. It provides no intelligence.",
    },
    VEIL: {
      name: 'Veil',
      tag: 'Hide from telescopes',
      role: "Makes enemy Telescope readings less clear and can reduce probe accuracy on this planet.",
      roleNone:
        'Can make your fleet status unreadable to an opposing Telescope. It hides information but neither invents false readings nor stops probes.',
      roleOwned:
        'Can make your fleet status unreadable to an opposing Telescope. It hides information but neither invents false readings nor stops probes.',
      detail: "Higher levels can obscure fleet status even from stronger Telescopes. Veil also reduces accuracy for probes sent from an equal-level Shipyard. It hides information without inventing false readings. It neither intercepts probes nor increases combat power.",
    },
  },

  satellite: {
    UPLINK: {
      name: 'Uplink',
      tag: 'Unlocks Telescope and Radar',
      role:
        "Unlocks Telescope and Radar installation on this planet and uses one orbit slot.",
      blurb:
        'A communications relay that unlocks the Telescope and Radar. It does not extend sight by itself.',
      detail: "Install Uplink before building Telescope or Radar. You install it once per planet, without upgrade levels. It does not provide observations, warnings, production or defence by itself.",
    },
    FOUNDRY: {
      name: 'Foundry',
      tag: 'More ore every hour',
      role:
        "Increases this planet’s hourly alloy, crystal and deuterium production by 6%.",
      blurb:
        'Supports production from orbit, increasing all three hourly resource streams along with the Works and storage capacities derived from them.',
      detail: "The bonus applies only to its planet. Works and Store capacities based on production also rise. The Store’s raid-protected amount does not increase. Mining capacity and raid cargo are unaffected.",
    },
    DERRICK: {
      name: 'Derrick',
      tag: 'Better mining craft',
      role:
        "Doubles this planet’s Prospector holds and multiplies their travel speed by 1.5.",
      blurb:
        'Supports this world’s mining craft from orbit. Larger holds increase each haul, while faster travel improves their chance of reaching a contested asteroid in time.',
      detail: "The capacity bonus combines multiplicatively with Prospector Holds research. It affects Prospectors only. It does not change raid cargo, other ships’ speed or planet transfers.",
    },
    BEACON: {
      name: 'Beacon',
      tag: 'Faster fleets',
      role:
        "Multiplies speed by 1.3 for raids, transfers, trade and clan aid launched from this planet.",
      blurb:
        'A navigation mark for raid, transfer, trade and clan-aid fleets. Shorter flights mean a shorter window with your defence away from home.',
      detail: "The speed bonus applies on the outbound and return legs of the listed missions. Settlement fleets and Prospectors are unaffected. It does not change attack, hull strength, cargo or fuel cost.",
    },
  },

  /**
   * THE THREE ROLES A FIGHT IS DECIDED BY, plus the one that is prey.
   *
   * Named separately from `hull.*.family` on purpose. Family is a PURCHASING
   * taxonomy — where a hull sits in the shipyard — and it runs at right angles to
   * this one: a Pike is Offensive and a Rampart Defensive, and the Rampart beats
   * the Pike. Teaching the two with one word was how the interface came to imply
   * the opposite of the rule it enforces.
   */
  combatClass: {
    SKIRMISHER: { name: 'Skirmisher', tag: 'Strong vs Bulwark; weak vs Lance' },
    BULWARK: { name: 'Bulwark', tag: 'Strong vs Lance; weak vs Skirmisher' },
    LANCE: { name: 'Lance', tag: 'Strong vs Skirmisher; weak vs Bulwark' },
    SUPPORT: { name: 'Support', tag: 'Unarmed; covered while warships live' },
  },

  hull: {
    DART: {
      name: 'Dart', tag: 'Fragile speed raider', role: "A low-cost Skirmisher with fast travel and low hull strength.",
      pitch: "High speed reduces time away from home. Low hull strength increases the risk of losing the ship.",
      detail: "Dart shares the fastest base warship speed with Viper, Tempest and Corsair. It costs less than those advanced ships but has less attack and hull strength. Check the target’s classes before choosing a fast raid fleet.",
    },
    PIKE: {
      name: 'Pike', tag: 'Entry Lance hull', role: "A Lance with more attack, less hull strength and lower speed than Dart at the same price.",
      pitch: 'Attack exceeds hull strength: a harder opening salvo buys a more fragile ship.',
      detail: "Pike has a class advantage against Skirmishers such as Dart and Thorn. Bulwarks have the advantage against it. Its high attack does not compensate for every unfavourable matchup.",
    },
    RAMPART: {
      name: 'Rampart', tag: 'Entry fortress', role: "A durable, slow Bulwark. At Warden’s price, it has more hull strength and less attack.",
      pitch: 'Absorbs Lance fire efficiently; vulnerable to Skirmisher swarms.',
      detail: "Rampart favours hull strength over speed and attack. Warden is faster at the same resource cost. Rampart can slow a mixed fleet; compare travel time when using it away from home.",
    },
    WARDEN: {
      name: 'Warden', tag: 'Mobile escort', role: "A Bulwark escort with more speed and attack, but less hull strength, than Rampart at the same price.",
      pitch: 'Trades part of fortress durability for attack and mixed-fleet tempo.',
      detail: "Warden combines Bulwark class with faster travel than Rampart. It can escort transports or join raids. Its class advantage is against Lances; Skirmishers gain the advantage against it.",
    },
    COURIER: {
      name: 'Courier', tag: 'Fast light transport', role: "A fast, unarmed entry transport for loot, transfers, trade and settlement.",
      pitch: 'Keeps pace with fortress and Lance fleets, but slows the fastest Skirmisher formations.',
      detail: "Courier adds cargo capacity but no attack. Armed escorts protect it while they survive. It costs less and flies faster than larger transports, but holds less. Successful settlement leaves the required Couriers on the new colony.",
    },
    VIPER: {
      name: 'Viper', tag: 'Efficient raider', role: "A tier-two Skirmisher with Dart’s base speed and higher attack, hull strength and cargo.",
      pitch: "More attack and hull strength than Dart at the same base speed.",
      detail: "Viper requires no research. It has the same base speed as Dart. It costs more, with higher attack, hull strength and cargo per ship. Its Skirmisher class has an advantage against Bulwarks and a disadvantage against Lances.",
    },
    TALON: {
      name: 'Talon', tag: 'Heavy striker', role: "A tier-two Lance with more attack, less hull strength and lower speed than Viper at the same price.",
      pitch: 'Attack exceeds hull strength; a more fragile ship balances its higher damage.',
      detail: "Talon favours attack against Skirmishers. It requires no research. Bulwarks have the class advantage against it, so check the defence before building a fleet of only Talons.",
    },
    STRONGHOLD: {
      name: 'Stronghold', tag: 'Heavy line hull', role: "A tier-two Bulwark with more hull strength, less attack and lower speed than Sentinel at the same price.",
      pitch: 'Builds a wall when survival matters more than arrival time.',
      detail: "Stronghold favours durability over travel speed. It can defend at home or reinforce a combat fleet. Skirmishers have the class advantage against it. Its slow speed can increase the time your fleet is away.",
    },
    SENTINEL: {
      name: 'Sentinel', tag: 'Tier-two escort', role: "A tier-two Bulwark escort with more speed and attack, but less hull strength, than Stronghold at the same price.",
      pitch: 'Trades fortress durability for attack and fleet tempo.',
      detail: "Sentinel offers faster Bulwark escort than Stronghold. Use the speed difference when planning transport or raid travel. Its lower hull strength makes the same resource investment less durable.",
    },
    WAYFARER: {
      name: 'Wayfarer', tag: 'Balanced transport', role: "An unarmed tier-two transport with more cargo capacity and lower speed than Courier.",
      pitch: 'The middle choice between fast Courier and high-capacity Atlas.',
      detail: "Wayfarer carries resources in raids, transfers, trade and eligible clan aid. It adds no attack and needs armed escorts in combat. Compare its larger hold with the longer journey before replacing smaller Couriers.",
    },
    TEMPEST: {
      name: 'Tempest', tag: 'Advanced speed raider', role: "A tier-three Skirmisher that retains the fastest base warship speed.",
      pitch: 'Late-game speed with improved efficiency, still not a line ship.',
      detail: "Tempest requires Starship Engineering and Ship Power at the levels below. Its base speed matches Dart, Viper and Corsair. Lance units have the class advantage against it; a higher tier does not remove this weakness.",
    },
    BALLISTA: {
      name: 'Ballista', tag: 'Advanced striker', role: "A tier-three Lance with more attack, less hull strength and lower speed than Tempest at the same price.",
      pitch: 'Attack exceeds hull strength, but high damage will not save it from the right Bulwark wall.',
      detail: "Ballista requires Starship Engineering and Ship Power. It gains class advantage against Skirmishers but is weak against Bulwarks. Use a recent defence reading before investing in this high-attack fleet.",
    },
    LEVIATHAN: {
      name: 'Leviathan', tag: 'Advanced fortress', role: "A tier-three Bulwark with more hull strength, less attack and lower speed than Praetorian at the same price.",
      pitch: 'A late-game wall that makes every flight a long commitment.',
      detail: "Leviathan requires Starship Engineering and Ship Armor. It favours hull strength over travel speed. Skirmishers retain class advantage against it, so durability alone does not guarantee a successful defence.",
    },
    PRAETORIAN: {
      name: 'Praetorian', tag: 'Advanced escort', role: "A tier-three Bulwark escort with more speed and attack, but less hull strength, than Leviathan at the same price.",
      pitch: 'Trades part of fortress durability for attack and mixed-fleet tempo.',
      detail: "Praetorian requires Starship Engineering and Ship Armor. It offers a faster alternative to Leviathan when protecting transports or joining raids. It has the same Bulwark class advantages and weaknesses.",
    },
    ATLAS: {
      name: 'Atlas', tag: 'Tier-three heavy transport', role: "An unarmed tier-three transport with more cargo capacity and lower speed than Wayfarer.",
      pitch: "Carries large resource loads. It is unarmed; send combat escorts when using it on a raid.",
      detail: "Atlas requires Starship Engineering and Ship Propulsion. Its large hold can bring more resources home if they are available. It adds no attack; keep enough armed ships to protect it and check the fleet’s final speed.",
    },
    NULLIFIER: {
      name: 'Nullifier',
      tag: 'Breaks active shields',
      role: "A Lance specialist that deals five times its normal damage against an active Aegis.",
      pitch: "Attack exceeds hull strength. Extra shield damage does not pass into ships or ground defences.",
      detail: "Nullifier requires Starship Engineering and Gravitic Charges. Its extra damage applies only to an active shield and does not pass into ships or ground defences. Once the shield is gone, it uses normal attack. Its hull strength is lower than its attack value.",
    },
    /** D200. `{{salvage}}` is `SALVAGE.perCollector`, filled in by `names.ts`. */
    GARBAGE_COLLECTOR: {
      name: 'Garbage Collector',
      tag: 'Lifts {{salvage}} of wreck',
      role: "An unarmed support ship that collects wreckage after an attack it joins.",
      pitch: 'Flies behind the line like a transport and takes the last shots. Keep warships beside it — once they fall, it is prey.',
      detail: "Send it with at least one warship. Each survivor brings up to {{salvage}} wreck resources in the wreck’s alloy, crystal and deuterium proportions. Remaining wreckage forms a public debris field. It adds no ordinary cargo capacity and collects nothing while defending. It cannot fly to asteroids or debris fields.",
    },
    CATACLYSM: {
      name: 'Cataclysm', tag: 'Capital striker', role: "A tier-four Lance with more attack, less hull strength and lower speed than Corsair at the same price.",
      pitch: 'Attack exceeds hull strength; a more fragile ship and class counters balance its hard salvo.',
      detail: "Cataclysm requires Starship Engineering and Ship Power. It gains class advantage against Skirmishers, while Bulwarks have the advantage against it. High attack does not remove its low hull strength or class weakness.",
    },
    CORSAIR: {
      name: 'Corsair',
      tag: 'Capital raider',
      role: "A tier-four Skirmisher with class advantage against Bulwarks and the fastest base warship speed.",
      pitch: 'At Cataclysm’s price it is faster and tougher, but attacks less and carries a smaller hold.',
      detail: "Corsair requires Starship Engineering and Ship Power. It shares base speed with Dart, Viper and Tempest. At Cataclysm’s price, it has less attack and more hull strength. It gains advantage against Bulwarks such as Citadel, but is weak against Lances.",
    },
    CITADEL: {
      name: 'Citadel', tag: 'Capital fortress', role: "A tier-four Bulwark with more hull strength, less attack and lower speed than Paladin at the same price.",
      pitch: 'The strongest wall, paid for in cost and exposure time.',
      detail: "Citadel requires Starship Engineering and Ship Armor. It prioritises durability and has the lowest base warship speed. Skirmishers have class advantage against it. Include the longer travel time when using it in a mobile fleet.",
    },
    PALADIN: {
      name: 'Paladin',
      tag: 'Capital escort',
      role: "A tier-four Bulwark escort with more speed and attack, but less hull strength, than Citadel at the same price.",
      pitch: 'A tier-four escort that trades part of fortress durability for attack and fleet tempo.',
      detail: "Paladin requires Starship Engineering and Ship Armor. Compared with Citadel, it trades some hull strength for speed and attack. Its Bulwark class gains advantage against Lances and is weak against Skirmishers.",
    },
    ARGOSY: {
      name: 'Argosy',
      tag: 'Capital hauler',
      role: "An unarmed tier-four transport with the largest base cargo hold and the lowest transport speed.",
      pitch: "Provides the largest cargo hold. Its low speed can lengthen the fleet’s journey.",
      detail: "Argosy requires Starship Engineering and Ship Propulsion. It adds cargo capacity but no attack. It is protected while armed escorts survive. Its low speed can lengthen the whole fleet’s journey, so compare capacity and time together.",
    },
    BASTION: {
      name: 'Bastion',
      tag: 'Heavy ground guns',
      role: "A fixed Bulwark ground defence with class advantage against Lances.",
      pitch: 'Heavy ground defence with an advantage against Lance-class hulls; vulnerable to Skirmishers.',
      detail: "Bastion stays on its planet and uses ground capacity rather than Hangar room. Skirmishers have class advantage against it. After combat, 60% of destroyed ground units are rebuilt free, rounded down. Emplacement Doctrine improves its attack and hull strength.",
    },
    HARPOON: {
      name: 'Harpoon', tag: 'Spear ground gun', role: "A fixed Lance ground defence with class advantage against Skirmishers.",
      pitch: 'Breaks Skirmisher formations; vulnerable to Bulwarks.',
      detail: "Harpoon stays on its planet and uses ground capacity rather than Hangar room. Bulwarks have class advantage against it. After combat, 60% of destroyed ground units are rebuilt free, rounded down. Emplacement Doctrine improves its attack and hull strength.",
    },
    THORN: {
      name: 'Thorn',
      tag: 'Light ground guns',
      role: "A low-cost fixed Skirmisher ground defence with class advantage against Bulwarks.",
      pitch: 'Low-cost ground defence with an advantage against Bulwarks; vulnerable to Lances.',
      detail: "Thorn stays on its planet and uses ground capacity rather than Hangar room. Lances have class advantage against it. After combat, 60% of destroyed ground units are rebuilt free, rounded down. Emplacement Doctrine improves its attack and hull strength.",
    },
    PROSPECTOR: {
      name: 'Prospector',
      tag: 'Mines asteroids',
      role: "Collects resources from revealed asteroids and debris fields. It cannot join raid fleets.",
      pitch: 'Intercepts a moving asteroid and returns what it can carry to the Works. It cannot raid or transfer.',
      detail: "Each planet can own two Prospectors before research; Prospector Holds level 3 opens a third slot. A loaded return uses half its outbound speed. Derrick and Prospector Holds improve mining capacity; Derrick also improves speed. Prospectors use Hangar room but do not fight in home defence.",
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
      body: "Send a probe to learn about the target’s fleet and resources. Reports can contain estimates; the target may detect the scan.",
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
  hangar: {
    label: 'Fleet room',
    value: '{{room}} room',
    none: 'No Hangar',
    ceiling: "Up to {{room}} at the highest level",
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
    label: 'Store depth',
    value: '{{store}}h store · {{safe}}h protected',
  },
  shipyard: {
    timeLabel: "Production time",
    timeReduced: "{{percent}} shorter",
    scope: "Applies to ships and ground defences. Level {{from}} to {{to}} upgrade.",
    rowNote: "Each percentage compares with the previous level.",
    unlocksHull: "Shipyard requirement met: {{hull}}. Research may also be required.",
  },

  telescope: {
    slotsLabel: 'Planets you can watch',
    rangeLabel: 'How far you can see',
    maxed: 'Top level: {{slots}} watch slots and {{range}} units of moving-contact sight; enough to span the galaxy',
    reachAndCooldown: 'Reaches {{range}} · a slot realigns in {{hours}}h',
    nextSlot: 'Next level adds a {{ordinal}} slot',
    ordinalSecond: '2nd',
    ordinalThird: '3rd',
    ordinalFourth: '4th',
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
    l1: "Improves probe detection. Warns of arrival when an inbound fleet enters Radar range.",
    bearing: 'L2 also reveals the direction of approach',
    interception: "L3 lets this world load interceptor charges (Uplink needed)",
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
    label: 'Raid, transfer, trade and aid fleets',
    now: 'normal speed',
    next: '{{factor}}× faster',
    unlocks: 'Out and back — a shorter window with your defence away from home',
  },
  /** Every research row names the quantity or permission the player actually buys. */
  research: {
    powerLabel: 'Warship attack',
    powerScope:
      'Every warship in your fleet. Power and Armor together add at most 56% equal-budget combat power; transports and ground defence are unaffected.',
    armorLabel: 'Ship hull strength',
    armorScope:
      'All ships in your fleet, transports included. Power and Armor together add at most 56% equal-budget combat power; ground defence is unaffected.',
    speedLabel: 'Fleet speed',
    speedScope:
      'All ships in your fleet. A mixed fleet still flies at its slowest member’s — improved — speed; Prospectors and probes are unaffected.',
    engineeringLabel: 'Hull tier access',
    engineeringTier: 'Tier {{tier}}',
    engineeringScope:
      'Engineering I opens Tier 3 and Engineering II opens Tier 4. Individual hulls can also require Power, Armor, Propulsion or Gravitic Charges.',
    groundLabel: 'Ground defence strength',
    groundScope: '{{bastion}}, {{harpoon}} and {{thorn}} on every world you hold.',
    yardLabel: 'Ship build time',
    robotsLabel: 'Structure build time',
    holdsLabel: 'Prospector hold',
    holdsScope: 'Multiplies with a Derrick in orbit.',
    cargoLabel: 'Raid cargo',
    cargoScope: 'Loot only — world transfers and mining are unchanged.',
    industrialLabel: 'Repair bill and time',
    industrialScope: "Repair Station only — ship building is unchanged.",
    refineryLabel: 'Refinery ceiling',
    stockpileLabel: "Death Stars per world",
    gridLabel: "Charges per world",
    /* A permission opens a door; drawing it as a ladder would invent a quantity. */
    opensLabel: 'Unlocks',
    open: 'Open',
    shut: 'Locked',
    isotopeOpens: 'Isotope asteroids become selectable mining targets.',
    denseOpens: 'Ship Propulsion research becomes available.',
    graviticOpens: 'The Nullifier’s specialist research requirement is met.',
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
    "You can spend exposed resources, send your fleet out or strengthen your defence. Ships in flight cannot defend this world.",
  inboundAction: 'Spend it now',

  undefendedTitle: 'This world has no ground defence',
  undefendedShieldedTitle: 'Your shield ends in {{duration}}: build a ground defence',
  undefendedDetail: '{{amount}} is exposed to raids. Build Thorns or Bastions for permanent defence.',
  undefendedAction: 'Build defence',

  exposedTitle: '{{amount}} can be taken from you',
  exposedDetail: "The Store protects {{now}} resources from raids. The next level protects {{next}}.",
  exposedAction: "Upgrade the Store",

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
  coreCeilingDetail: "The Command Core sets building level limits, except for the Hangar. Upgrade the Core before raising a building beyond that limit.",
  coreCeilingAction: 'Raise the Core',

  idleTitle: 'Nothing is in flight',
  idleDetailHasShips: 'Your bays are idle. You can launch a raid, transfer or mining run; probes do not use bays.',
  idleDetailNoShips: 'You have no ships at home. Build some, or wait for yours to come back.',
  idleAction: 'Find a target',

  baysFreeTitle_one: 'One bay is still free',
  baysFreeTitle_other: '{{count}} bays are still free',
  baysFreeDetail: 'Raids, transfers and mining runs take one. Probes do not use bays.',
  baysFreeAction: 'Look for something',

  /** The card that carries the top directive. */
  kindThreat: 'Threat',
  kindOpportunity: 'Opportunity',
  kindGrowth: 'Weakness',
  kindIdle: 'Nothing pending',

  /** The fold. One word each way: the card is small enough that a label is the control. */
  hide: 'Hide',
  show: 'Show',
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
  dockedClause_one: "{{count}} ship to the Repair Station",
  dockedClause_other: "{{count}} ships to the Repair Station",
  patchedClause_one: "{{count}} patched free",
  patchedClause_other: "{{count}} patched free",
  damagedClause_one: "{{count}} coming home damaged",
  damagedClause_other: "{{count}} coming home damaged",
  radiationLostAll_one: "Radiation destroyed your ship {{way}}",
  radiationLostAll_other: "Radiation destroyed all {{count}} ships {{way}}",
  radiationLost_one: "Radiation destroyed {{count}} ship {{way}} · {{left}} flew on",
  radiationLost_other: "Radiation destroyed {{count}} ships {{way}} · {{left}} flew on",
  radiationWay: "on the way",
  radiationWayTo: "on the way to {{name}}",
  raidedNothing: 'Raided · they got nothing',
  /** Taktik geri çekilme, defender: the ships ran, or the tank could not lift them. */
  raidedEscaped_one: '{{count}} ship lifted off',
  raidedEscaped_other: '{{count}} ships lifted off',
  raidedStranded_one: 'the tank could not lift {{count}} ship',
  raidedStranded_other: 'the tank could not lift {{count}} ships',
  /** Taktik geri çekilme, raider: the line emptied — nothing about what it held. */
  raidTargetFled: 'their ships lifted off',

  raidResultFallback: 'Your raid resolved.',
  raidWiped: '{{target}} held · your fleet was destroyed · {{count}} ships lost',
  raidResult: '{{grade}} at {{target}} · {{detail}} · {{count}} ships lost',
  raidNothing: 'nothing taken',
  spoilAlloy: '+{{amount}} alloy',
  spoilCrystal: '+{{amount}} crystal',
  spoilDeuterium: '+{{amount}} Deuterium',
  /** What a raid's Garbage Collectors lifted off the wreck — never counted as loot. D200. */
  spoilSalvage: '+{{amount}} salvage',

  fleetFallback: 'Your fleet is home.',
  fleetHomeLooted: 'Fleet home{{where}} · {{count}} ships · +{{amount}} looted',
  fleetHomeEmpty: 'Fleet home{{where}} · {{count}} ships · empty-handed',
  fleetHomeRecalled: 'Fleet home{{where}} · {{count}} ships · called back before it struck',
  /** Nothing looted, but the collectors' salvage follows it — so not "empty-handed". */
  fleetHomeBare: 'Fleet home{{where}} · {{count}} ships',
  /**
   * THE MERCHANT'S OWN HOMECOMING. D166.
   *
   * A swap is not a raid, so it never borrows the plunder wording — and a
   * convoy that bought nothing is a different fact from a fleet that found
   * nothing, which is why the empty case has its own line.
   */
  tradeHome: 'Convoy home · {{count}} ships · bought {{landed}}',
  tradeHomeEmpty: 'Convoy home · {{count}} ships · nothing bought',
  /**
   * THE PIRATE LANE HAS ITS OWN HOMECOMING AND ITS OWN EMPTY TRIP. D177.
   *
   * A pirate is not a commander: there is no world to come back FROM by name
   * and no ledger that moved, so these never borrow the raid's wording. And a
   * flight that arrived at nothing is a different fact from one that fought and
   * lost — it names what was gone and how many craft are turning back, and never
   * who got there first.
   */
  targetGonePirate: 'Pirate {{callsign}} was already destroyed · {{count}} ships turning back',
  targetGoneAsteroid: 'The rock was stripped before you arrived · {{count}} drills turning back',
  targetGoneDebris: 'The wreck field was already picked clean · {{count}} drills turning back',
  pirateHome: 'Raiders home · {{count}} ships · +{{amount}} looted',
  pirateHomeEmpty: 'Raiders home · {{count}} ships · empty-handed',
  pirateHomeRecalled: "Raiders home · {{count}} ships · called back before the engagement",
  pirateHomeBare: 'Raiders home · {{count}} ships',
  pirateHomeTowed_looted: 'Raiders home · {{count}} ships · +{{amount}} looted · {{hull}} captured',
  pirateHomeTowed_empty: 'Raiders home · {{count}} ships · {{hull}} captured',
  fleetFrom: ' from {{origin}}',
  probeLost: 'Your probe was lost · that flight could not be completed',
  recalled: '{{count}} craft returned · that flight could not be completed',
  miningRecalledHome: '{{count}} Prospectors home · recall complete',
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
    FIRST_STRIKE: 'EMP impact · Aegis drained; ground defences offline for 1 hour',
    CAPTURED: 'Death Star impact · colony captured',
    INEFFECTIVE: 'Death Star impact · no effect',
  },
  colonyCaptured: 'Colony secured · occupation protection is active',
  colonyAbandoned: "You abandoned {{planet}} · the colony is now neutral",
  colonyAbandonedUnnamed: "You abandoned a colony · it is now neutral",
  colonyLost: "{{planet}} seceded and turned neutral",
  colonyLostUnnamed: "A colony seceded and turned neutral",
  deathStarColony: "EMP impact · colony loyalty {{before}}% → {{after}}%",
  deathStarSeceded: "EMP impact · the colony seceded and turned neutral",
  colonyFault: '{{planet}} · {{fault}}',
  colonyLoyalty: '{{planet}} is slipping — {{count}} things broken, and it declares independence in {{time}}.',
  settlementLost: 'Settlement race lost · the Couriers and cargo are returning',
  interceptedDefended: 'Your grid destroyed a Death Star {{range}} units out.',
  interceptedLost: 'Your Death Star was destroyed {{range}} units short of its target.',
  interceptedFallback: 'A Death Star was destroyed in flight.',
  asteroidShowerStarted: 'An asteroid shower has begun in the galaxy.',
  asteroidShowerEnded: 'The asteroid shower has ended · asteroid spawn is back to normal.',
  tradeShipStarted: 'A trade ship is in the galaxy · {{alloy}} alloy = 1 deuterium.',
  tradeShipEnded: 'The trade ship has left the galaxy.',
  intergalacticConvoyStarted: 'The Intergalactic Convoy is crossing the galaxy.',
  intergalacticConvoyEnded: 'The Intergalactic Convoy has departed.',
  intergalacticConvoyResult: 'Convoy strike resolved · {{resources}} · prize: {{ships}} · returning now.',
  intergalacticConvoyHome: 'Convoy strike home · {{resources}} · prize: {{ships}}.',
  intergalacticConvoyNoResources: 'no resources',
  intergalacticConvoyNoShip: 'no ship',
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
  imminent: 'any moment',
  todayAt: 'Today {{time}}',
  yesterdayAt: 'Yesterday {{time}}',
  hoursMinutes: '{{h}}h {{m}}m',
  minutesSeconds: '{{m}}m {{s}}s',
  hoursMinutesSeconds: '{{h}}h {{m}}m {{s}}s',
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
