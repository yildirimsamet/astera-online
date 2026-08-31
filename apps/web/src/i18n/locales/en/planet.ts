/**
 * YOUR OWN WORLD — the four decision groups, the rows they are made of, the
 * detail sheet behind each row, and the launch planner.
 */

export const planet = {
  recovery: "Recovery in progress · systems return in {{duration}}",
  /**
   * THE COUNTER TO THE THING ABOVE. T10 · T12.
   *
   * Its own block rather than a `deathStar` sub-key: they are two controls on two
   * different tabs, and the day either is reworded the other must not move with
   * it. `docs/interface.md` I1 — every requirement is a door and names itself.
   */
  interceptor: {
    eyebrow: "Anti-strategic battery",
    none: "No charge loaded",
    building: "Loading · {{duration}}",
    paused: "Loading paused during recovery",
    ready: "One charge loaded",
    build: "Load charge",
    started: "Charge loading",
    hint: "Destroys the first Death Star that enters the timed Radar ring or is identified in Telescope sight. Spent when it fires.",
    readyHint:
      "Armed. It destroys the next Death Star that enters the Radar interception ring or is identified in Telescope sight.",
    needResearch: "Interception Grid",
    needRadar: "Radar L{{level}}",
    needUplink: "Uplink in orbit",
    needOperational: "World operational",
    buildTime: "{{duration}} · one charge · spent on firing",
  },

  deathStar: {
    eyebrow: "Restricted strategic weapon",
    none: "No Death Star on this world",
    building: "Building · {{duration}}",
    paused: "Build paused during recovery",
    ready: "Ready to launch",
    build: "Build",
    started: "Death Star construction started",
    dangerHint:
      "A one-way planet-breaker. Every impact devastates; a second can capture only a colony or neutral world.",
    readyHint:
      "Armed. Select any enemy world; capitals can be devastated but never captured.",
    needProtocol: "Protocol",
    needCore: "Core L{{level}}",
    needShipyard: "Shipyard L{{level}}",
    needOperational: "World operational",
    buildTime: "60 min · one weapon · no recall",

    /**
     * WHAT AN IMPACT DOES, SAID PLAINLY, BEFORE THE MONEY IS SPENT. D113.
     *
     * This is the most expensive thing in the game and its effect was described
     * as "devastates" — a word that answers nothing. Five lines of consequence and
     * one line of what SURVIVES, because knowing what a strike cannot take is
     * what makes it a decision rather than a hope.
     */
    effectsTitle: "What one impact does",
    effectFleet: "Destroys every ship and gun standing on the world",
    effectStock: "Destroys half of everything stored and in the works",
    effectCore:
      "Takes one level off the Command Core and lowers buildings above the new Core ceiling",
    effectAegis:
      "Takes {{levels}} levels off the Aegis, and drops the shield to nothing",
    effectDark:
      "Stops production, collection, construction, new orders and launching for {{duration}}",
    effectSurvives:
      "Buildings within the new Core ceiling, all research and other orbital hardware survive",
  },
  tabs: {
    label: "Planet categories",
    defendProblem: "Defend",
    defendQuestion: "Strengthen your shield, vault and planet guns here.",
    orbitProblem: "Intel",
    orbitQuestion: "Build the tools that help you see rivals.",
    reachProblem: "Fleet",
    reachQuestion: "Develop your ships, range and special projects here.",
    growProblem: "Production",
    growQuestion: "Grow your resources and building level limit here.",
  },

  wallet: {
    inTheWorks: "<0>{{amount}}</0> in the works",
  },

  queue: {
    /** The end of all the work in one lane, which no screen used to carry. */
    ends: "ends {{time}}",
    segment: "{{name}} · {{duration}}",
    cancelOne: "Cancel {{name}}",
    title: "Build queues",
    capacity: "{{count}} slots each",
    construction: "Construction",
    yard: "Yard",
    slotFree: "Free",
    empty: "No work committed",
    committing: "committing…",
    staged: "starts when claimed",
    queued_one: "{{count}} order queued",
    queued_other: "{{count}} orders queued",
    unitsQueued_one: "{{count}} unit queued",
    unitsQueued_other: "{{count}} units queued",
    afterQueue: "After queue",
    cancel: "Cancel",
    cancelling: "Cancelling…",
    refund:
      "Refund: {{alloy}} alloy · {{crystal}} crystal · {{deuterium}} Deuterium",
    cancelled:
      "Order cancelled · {{alloy}} alloy, {{crystal}} crystal and {{deuterium}} Deuterium returned",
  },

  capacity: {
    hangarBand: "Fleet room",
    hangarUse:
      "Hangar space {{used}} / {{total}}. Ships away from this world still occupy their space.",
    hullUse:
      "Each uses {{bulk}} space · {{used}} / {{total}} committed after the queue.",
    full: "No room: {{used}} / {{total}} space is already committed. Raise the relevant capacity first.",
  },

  /** What each structure is for, in one line, where the row states it. */
  roles: {
    vault:
      "The only stock a raid cannot touch. Everything above it is takeable.",
    shipyard:
      "Unlocks heavier hulls, builds them faster, and sharpens every probe you send.",
    refinery: "Raises passive alloy production and alloy storage on this world.",
    extractor: "Raises passive crystal production and crystal storage on this world.",
    coreCapped_one:
      "{{count}} building upgrade is blocked until the Command Core is raised.",
    coreCapped_other:
      "{{count}} building upgrades are blocked until the Command Core is raised.",
    coreClear:
      "The Command Core sets building level ceilings and shortens construction and research time.",
  },

  defend: {
    strategicBand: "Strategic defence",
    strategicNote:
      "One charge destroys the next Death Star detected by Radar 3 or identified in Telescope sight. The charge is spent when it fires.",
    shieldBand: "Shield",
    shieldNote:
      "Aegis absorbs damage before it reaches your units and regenerates 35% of its maximum each hour.",
    groundBand: "On the ground",
    /* The figures moved into `CapacityBar`; the band keeps the RULE. */
    groundNote:
      "Ground guns never leave the world. Thorns counter Bulwarks; Bastions counter Lances and Breachers.",
    thornNone:
      "Light guns with an advantage against Bulwarks; vulnerable to Lances and Breachers.",
    thornStanding:
      "{{count}} standing. Strong against Bulwarks; weak against Lances and Breachers.",
    thornGain: "Thorns",
    bastionNone:
      "Heavy guns with an advantage against Lances and Breachers; vulnerable to Wasps.",
    bastionStanding:
      "{{count}} standing. Strong against Lances and Breachers; weak against Wasps. After combat, 60% of destroyed ground guns are restored, rounded down.",
    groundGain: "Ground units",
    aegisPointer: "A shield is hardware — the <0>{{name}}</0> is under Orbit.",
  },

  orbit: {
    contextLabel: "Orbit network",
    networkBand: "Connection",
    networkNote:
      "The Uplink spends one socket to unlock the Telescope and Radar.",
    intelBand: "Planet instruments",
    intelNote: "They gain levels and never consume an orbit socket.",
    inOrbitBand: "In orbit",
    inOrbitNote: "Each one takes a slot. Built once — they have no levels.",
    onPlanetBand: "On the planet",
    onPlanetNote:
      "No slot needed. These have levels — raise them as far as your Command Core allows.",
    slotsFree_one: "{{count}} slot still free above",
    slotsFree_other: "{{count}} slots still free above",
    slotsNone: "orbit is full",
    slotsUsed: "{{used}}/{{total}}",
    slotsNext: " · +1 at Core L{{level}}",
    rackLabel: "Orbit slots",
    slotEmpty: "Empty",
    inactiveSatellite:
      "Owned, but inactive until the Command Core reopens this orbit slot.",
    inactiveUplink:
      "L{{owned}} owned, but inactive until an Uplink is active again.",
    inactiveCore:
      "L{{owned}} owned · L{{active}} active until the Command Core is restored.",
    alreadyInOrbit: "already in orbit",
  },

  reach: {
    orbitBand: "Operations satellites",
    orbitNote:
      "A Derrick improves this world’s Prospectors; a Beacon speeds its raid and transfer fleets. Each satellite uses one orbit slot.",
    frontierBand: "Frontier research",
    frontierNote:
      "Each project is researched once and uses Construction. A locked card states its unlock condition.",
    isotopeName: "Isotope Spectrometry",
    isotopeTag: "Unlocks Deuterium mining",
    isotopeRole:
      "Shows the Deuterium in isotope rocks and lets you send Prospectors to them. The return haul enters the Works.",
    denseName: "Dense Fuel Cells",
    denseTag: "Unlocks the Runner",
    denseRole:
      "To reveal it, fill your cargo in one raid while loot remains on the target. The Runner is faster than a Hauler but carries less.",
    graviticName: "Gravitic Charges",
    graviticTag: "Unlocks the Breacher",
    graviticRole:
      "To unlock it, attack a defended world with an active Aegis; the shield must absorb at least {{share}} of your damage. A single Wasp can qualify; you do not need to win. The Breacher hits shields five times harder.",
    gridName: "Interception Grid",
    gridTag: "Shoots down a Death Star",
    gridRole:
      "A loaded charge destroys the next Death Star detected by Radar 3 or identified in Telescope sight · requires an Uplink",
    stockpileName: "Strategic Stockpile",
    stockpileTag: "Keep a second weapon on the pad",
    stockpileRole:
      "A second Death Star, built after the first · the wait is unchanged",
    waspDoctrineName: "Wasp Doctrine",
    lanceDoctrineName: "Lance/Breacher Doctrine",
    bulwarkDoctrineName: "Bulwark Doctrine",
    groundDoctrineName: "Emplacement Doctrine",
    generalName: "Weapons and Armour",
    generalTag: "Improves every hull you own",
    doctrineTag: "Better attack and armour",
    doctrineRole:
      "Class and general bonuses stack, but their combined combat multiplier is capped at 25%. Class counters remain the larger advantage.",
    yardName: "Yard Automation",
    yardTag: "Builds ships faster",
    yardRole:
      "Shaves build time off every hull · the Shipyard still sets the curve",
    holdsName: "Prospector Holds",
    holdsTag: "Mining craft carry more",
    holdsRole: "Raises every Prospector hold and multiplies with the Derrick’s 2.6× capacity bonus",
    cargoName: "Cargo Holds",
    cargoTag: "Raids carry more home",
    cargoRole: "Raises what a fleet can loot · does not change world transfers",
    synthesisName: "Deuterium Synthesis",
    synthesisTag: "Raises the Refinery ceiling",
    synthesisRole:
      "Each rung opens three more Deuterium Refinery levels on every world you hold",
    deathStarName: "Death Star Protocol",
    deathStarTag: "Unlocks the Death Star",
    deathStarRole:
      "Lets this world build one Death Star. The first strike devastates its target; a second can capture only a colony or neutral world. A capital cannot be captured.",
    researchNeedCore: "Raise Command Core to L{{level}}",
    researchAct: "Research",
    researchComplete: "researched",
    researchAt: "Researchable in {{duration}}",
    researchIsotopeFirst: "Research Isotope Spectrometry first",
    researchDenseFirst: "Research Dense Fuel Cells first",
    researchGraviticFirst: "Research Gravitic Charges first",
    researchWarAt: "War act opens in {{duration}}",
    researchCargoInsight: "Fill your cargo in one raid while loot remains",
    researchShieldInsight:
      "Have an Aegis absorb at least {{share}} of your raid damage",
    warshipsBand: "Warships",
    warshipsNote: "These hulls attack and defend. Class matchups determine which targets they counter.",
    supportBand: "Support",
    supportNote:
      "Haulers and Runners carry raid or transfer cargo but cannot attack. They remain protected only while combat hulls survive.",
    miningBand: "Mining",
    miningNote: "Prospectors travel only to revealed asteroids or debris fields and return their haul to the Works.",
    ownedGain: "You have",
    prospectorLimit: "{{owned}} / {{max}} · limit",
  },

  grow: {
    multiplierBand: "Production satellite",
    multiplierNote:
      "The Foundry raises this world’s alloy, crystal and Deuterium production by 6% and consumes one socket in the shared orbit network.",
  },

  projectSheet: {
    frontier: "Frontier research",
    complete: "Research complete",
    cost: "Research cost",
    once: "Researched once and placed in the Construction queue.",
  },

  /** Why a row cannot be pressed yet. Each is a door, so each names its fix. */
  blocked: {
    core: "Core L{{level}}",
    uplink: "an Uplink in orbit",
    orbitSlot: "a free orbit slot",
    shipyard: "Shipyard L{{level}}",
    maxed: "at its highest level",
    /** The one building with a second ceiling: its research rung. T5. */
    plantRung: "Research another rung of Deuterium Synthesis",
    queueFull: "3 orders are already waiting. Finish or cancel one to add this.",
  },

  /** What a purchase says once it has landed. */
  done: {
    raised: "{{name}} is now L{{level}}",
    instrument: "{{name}} online at L{{level}}",
    satellite: "{{name}} is in orbit",
    built: "{{count}} × {{name}} built",
    researched: "{{name}} complete",
    queued: "{{name}} L{{level}} queued",
    queuedSimple: "{{name}} queued",
    unitsQueued: "{{count}} × {{name}} queued",
  },

  buildSheet: {
    eyebrowGround: "Ground defence · never leaves",
    eyebrowMobile: "Mobile hull",
    priceLabel: "Costs",
    howMany: "How many",
    fewer: "Fewer {{name}}",
    more: "More {{name}}",
    quantity: "{{name}} quantity",
    max: "Max {{name}}",
    maxShort: "Max",
    /* The way back down from Max, in one press. */
    reset: "Reset the {{name}} count",
    resetShort: "Reset",
    build: "Build {{count}}",
    capped:
      "You already hold {{count}} — the limit. Craft that are out still count, so you cannot build another.",
    heldOfMax: "{{owned}} of {{max}} held. The ones that are out count too.",
    defenceAfter: "Home defence when complete: {{count}} units",
  },
} as const;

/** The ladder behind one row: what this thing becomes. */
export const itemSheet = {
  eyebrowNotInOrbit: "Not in orbit",
  eyebrowInOrbit: "In orbit",
  eyebrowNotInstalled: "Not installed",
  eyebrowLevel: "Level {{level}}",
  actPutInOrbit: "Put in orbit",
  actAlreadyInOrbit: "Already in orbit",
  actInstall: "Install",
  actRaise: "Raise to L{{level}}",
  lockedNote: "Locked — needs {{reason}}.",
  ladderHeading: "What each level buys",
  rungLevel: "L{{level}}",
  rungNewHardware: "New hardware at L{{level}}",
  orbitalDoesHeading: "What it does",
  orbitalCostHeading: "What it costs",
  orbitalOnce: "once — it is never raised",
  orbitalFree: "{{free}} of {{total}} free",
  orbitalNoSlot: "No free slot — raise the Command Core",
} as const;

/** The row. One decision, presented as a decision. */
export const upgradeRow = {
  about: "About {{name}}",
  nextTierAlt: "{{name}} at the next tier",
  becomes: "becomes",
  affordableIn: "Affordable in <0>{{duration}}</0> at your current rate",
  /** A row whose level has a top: research ladders are the only ones so far. T12. */
  ladder: "L{{level}} / {{max}}",
} as const;

/** The control at the right-hand edge of every row. */
export const action = {
  verbRaise: "Raise",
  verbBuild: "Build",
  verbInstall: "Install",
  verbClaim: "Collect",
  verbSend: "Send",
  short: "Short",
  shortfallAlloy: "{{amount}} more alloy",
  shortfallCrystal: "{{amount}} more crystal",
  shortfallDeuterium: "{{amount}} more Deuterium",
  shortfallJoin: " and ",
  shortfallLabel: "Short — needs {{parts}}",
  statAttack: "Attack",
  statHull: "Hull",
  statSpeed: "Speed",
  statSpeedFixed: "fixed",
  statCargo: "Cargo",
  statCargoNone: "—",
  statFuel: "Fuel",
  /** The rate carries its own span: the row form of the strip prints no labels. */
  statFuelRate: "{{value}} /1k",
  statFuelNone: "—",
} as const;

/** The portrait and the three verdicts at the top of your own planet. */
export const planetHero = {
  capital: "Capital world",
  colony: "Colony world",
  power: "Power",
  perHour: "Per hour",
  perHourSuffix: "/h",
  disrupted: "Production stopped · raided · {{countdown}}",
  defence: "Defence",
  defenceNone: "None",
  defenceThin: "Thin",
  defenceHeld: "Held",
  defenceShipsOnly: "{{count}} ships only",
  defenceOnGround: "{{count}} on the ground",
  shield: "Shield",
  shieldNone: "None",
  shieldNoAegis: "no aegis",
  shieldValue: "{{current}} / {{max}}",
  shieldMeter: "Aegis shield charge",
  shieldRegen: "+{{amount}}/h · before units",
  vaultSafe: "Safe in the vault",
  alloySafe: "{{amount}} alloy safe",
  crystalSafe: "{{amount}} crystal safe",
  deuteriumSafe: "{{amount}} deuterium safe",
  atRisk: "At risk",
  atRiskValue: "{{amount}} exposed",
} as const;

/** The commitment. Everything here is supporting detail for one line. */
export const launch = {
  fuel: "Fuel",
  eyebrow: "Attack",
  back: "Back",
  launching: "Launching",
  commit: "Launch — no recall",
  chooseFleet: "Choose a fleet",
  send: "Send {{count}} ships",
  launched: "Launched. Exposed for {{duration}} · {{count}} units holding.",
  whileAway: "While this fleet is away",
  defending: "{{count}} units defending home",
  nothingSent: "Nothing sent yet",
  exposedFor: "Exposed for {{duration}}",
  oneWay: "One way",
  oneWayUnknown: "—",
  cargo: "Cargo",
  distance: "Distance",
  fleetHeading: "Fleet",
  atHome: "{{count}} home",
  away: "{{fleet}} away on a flight. Only ships standing on this world can be sent.",
  awaySeparator: " · ",
  awayHull: "{{count}} {{name}}",
  fewer: "Fewer {{name}}",
  more: "More {{name}}",
  quantity: "{{name}} quantity",
  max: "Max {{name}}",
  maxShort: "Max",
  /** Screen-reader sentence for the garrison bar, which is a picture. */
  defenceReading:
    "{{holds}} defence power holds; {{leaves}} leaves with this fleet",
  hangarLabel: "Hangar",
  hangarNote:
    "Launching frees no room. Ships in the air still belong to this world.",
  noShips:
    "No ships at home. Build some in the shipyard, or wait for a fleet to come back.",
  warning:
    "This cannot be recalled. Once it leaves, the only way to find out what was down there is to watch it land — and your planet holds {{count}} units until it comes back.",
  fleetsave: "Ships in flight cannot be raided. Your planet can.",
} as const;

export const transfer = {
  /** What the flight burns, beside the figure. T6. */
  fuel: "fuel for the flight",
  fuelShort: "short {{short}}",
  eyebrow: "World transfer",
  eta: "ETA",
  capacity: "Cargo",
  fleet: "Craft",
  homeDefence: "{{ships}} craft remain at origin · {{power}} defence power",
  cargo: "Resources",
  alloy: "Alloy",
  crystal: "Crystal",
  deuterium: "Deuterium",
  commit: "Transfer — no recall",
  sending: "Dispatching",
  launched: "Transfer launched · {{duration}}",
  irreversible:
    "One way. Ground defence cannot move; cargo space comes only from Haulers and Runners.",
  hullNone: "None at this world",
  holdReady: "Haulers and Runners carry the ore. Hold: {{capacity}}.",
  holdNeedsLoad: "Add a Hauler or Runner above to carry ore.",
  holdNoCarrier:
    "This world has no Hauler or Runner, so nothing here can carry ore.",
  /** Caption on the destination's room bar, which draws the figures itself. */
  destinationLabel: "Destination hangar",
  /** Screen-reader sentence for the pips beside a hull. */
  hullPacked: "{{packed}} of {{held}} {{name}} packed",
  /** Caption on a cargo slider's spend bar: what stays in the store. */
  remaining: "stays here",
  destinationProspectorFull:
    "The destination cannot accept another Prospector.",
} as const;

/**
 * THE CAPACITY CARD. Owner instruction: the design explains itself and the words
 * are captions on shapes that have already made the point.
 */
export const capacity = {
  fit: "more fit",
  full: "FULL",
  each: "one takes",
  /* The two ends of a room card's bar, each under the part it describes. */
  used: "used",
  free: "free",
  /** Screen-reader only: the bar is a picture, and a picture needs a sentence. */
  reading: "{{used}} of {{total}} used",
} as const;
