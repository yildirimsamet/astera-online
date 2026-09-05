/**
 * THE DISC AND EVERYTHING ON IT — the galaxy's own chrome, the commander sheet,
 * and the focus rail that answers "what is this, and what do I know about it".
 */

export const galaxy = {
  settlementAway: "Settlement dispatched for {{world}}",
  deathStarAway: "Death Star launched toward {{world}}",
  /**
   * Its own key rather than a reuse of the server list's, because nothing is
   * shared between surfaces (D55): this one sits at 8px in the corner of the
   * disc and the other is a row in a list, and they are free to diverge.
   */
  online: "{{count}} online",
  /** The same population over a day, so an off-peak galaxy still reads as inhabited. */
  onlineToday: "{{count}} in 24h",
  worlds: "{{count}} worlds",
  fleetAway: " · {{count}} fleet away",
  rocks: " · {{count}} rocks",
  pirates_one: " · {{count}} pirate",
  pirates_other: " · {{count}} pirates",
  wrecks_one: " · {{count}} wreck",
  wrecks_other: " · {{count}} wrecks",
  asteroidShower: 'Asteroid shower',
  asteroidShowerStatus: 'Spawn ×{{multiplier}} · {{remaining}} left',
  openIntel: "Intel",
  /**
   * THE PLANET GLYPH IS A CAMERA MOVE NOW, AND THE SHEET HAS ITS OWN MARK. D163.
   *
   * `openWorlds` is gone with the tap that opened a list from a glyph that looked
   * like "go to my planet"; the list itself is the transfer sheet and is named
   * for what a commander opens it to DO.
   */
  goHome: "Zoom in on your active planet",
  openTransfer: "Transfer between your worlds",
  /* The two sensor switches under the disc readout. `aria-label` only. */
  showTelescope: "Show Telescope reach",
  hideTelescope: "Hide Telescope reach",
  showRadar: "Show Radar reach",
  hideRadar: "Hide Radar reach",
  /* Screen-reader names for the marks on the disc. Nothing is painted. */
  openResearch: "Research",
  openClan: "Clan",
  kindCapital: "Capital",
  kindColony: "Colony",
  kindNeutral: "Neutral T{{tier}}",
  /** A world nobody has surveyed. The only honest thing to print about it. D127. */
  /** What a remembered world's bottom line says: the record, and how old it is. D151. */
  recordAge: "Record · {{age}}",
  unsurveyed: "Unsurveyed",
  owned: "Yours",
  clanmate: "Clanmate",
  rival: "Rival",
  recovery: "Recovery breach",
  claimOpen: "Claim open",

  /** What a launch says as it leaves. */
  harvestAway: "{{count}} away · {{minutes}}m to the wreck",
  miningAway: "{{count}} away · meets the rock in {{minutes}}m",

  panelPlanetEyebrow: "Your planet",
  panelCommanderEyebrow: "Commander",
  panelIntelEyebrow: "What you know",
  panelIntelTitle: "Intel",

  commander: {
    galaxyLabel: "Galaxy",
    galaxyUnknown: "—",
    endsLabel: "Season ends in",
    endsUnknown: "—",
    wipeNote: "At the wipe every galaxy resets and everyone starts again.",
    signOut: "Sign out",
  },
} as const;

/**
 * THE LIST OF WHAT YOU HOLD. T3.
 *
 * Its own namespace and not a reuse of `galaxy`'s world words: this surface names
 * a capital in a row you can press, and the disc names one in a caption. They are
 * free to diverge, and D55 says they must be able to.
 */
export const worlds = {
  eyebrow: "Your holdings",
  title: "Worlds",
  /** Names the list itself, so the rows are not three unlabelled buttons. */
  list: "Your worlds",
  active: "Active",
  kindCapital: "Capital",
  kindColony: "Colony",
  craft_one: "{{count}} craft",
  craft_other: "{{count}} craft",
  bays: "Bays",
  sendTitle: "Quick Transfer",
  /**
   * THE TWO ENDS OF ONE SENTENCE, AND THE BUTTON THAT COMMITS IT. D163.
   *
   * The labels are visually hidden — the arrow between the dropdowns says which is
   * which, and two words above two controls that already read `Kestrel-12 → Haven`
   * would be the interface writing out what it has just drawn. They stay for the
   * screen reader, where there is no arrow to see.
   */
  sendFrom: "From",
  sendTo: "To",
  send: "Transfer",
  /** Screen-reader readings for the two pictures on a row. */
  store: "{{resource}}: {{amount}} of {{cap}}",
  baysReading: "{{used}} of {{total}} flight bays in use",
  alloy: "Alloy",
  crystal: "Crystal",
  deuterium: "Deuterium",
} as const;

export const focus = {
  /** The rail itself. */
  shellLabel: "{{title}} — focus",
  clear: "Clear selection",

  /** One known thing, with where it came from stamped on it. */
  unknown: "Unknown",

  planet: {
    transfer: "Transfer",
    settle: "Found colony",
    settleNeedSlot: "Found colony · colony slot full",
    settleNeedBay: "Found colony · flight bays full",
    settleNeedCourier: "Found colony · 2 Couriers needed",
    settleNeedAlloy: "Found colony · Alloy missing",
    settleNeedCrystal: "Found colony · Crystal missing",
    settleNeedFuel: "Found colony · Deuterium missing",
    settleTooLate: "Found colony · arrives too late",
    settleRecovering: "Found colony · origin recovering",
    settlementConfirm: {
      eyebrow: "Colony race",
      title: "Found {{world}}",
      unsurveyedTitle: "Found this world",
      race: "The first valid two-Courier fleet to arrive takes the world.",
      noRecall:
        "Colony ships cannot be recalled. If another commander wins first, your Couriers and founding cargo return; spent fuel does not.",
      transports: "Colony ships",
      foundingCargo: "Founding cargo",
      cargoValue: "{{alloy}} Alloy · {{crystal}} Crystal",
      fuel: "Flight fuel",
      arrives: "Arrives in",
      closes: "Race closes in",
      confirm: "Dispatch colony ships",
      confirming: "Dispatching…",
    },
    deathStar: "Death Star",
    deathStarStrike: "Death Star · devastate",
    deathStarUnavailable: "No Death Star ready",
    deathStarProtected: "Death Star · target protected",
    deathStarNeedBay: "Death Star · flight bays full",
    deathStarTooLate: "Death Star · arrives too late",
    deathStarNeedSlot: "Death Star · colony slot full",
    deathStarOriginRecovering: "Death Star · origin recovering",
    kindCapital: "Capital",
    kindColony: "Colony",
    kindNeutral: "Neutral",
    capitalProtected: "Uncapturable capital",
    capitalProtectedHint:
      "A Death Star halves its stores, destroys every craft at home and takes a level off its Core; control never changes.",
    capitalRecovering: "Capital devastated · uncapturable",
    capitalRecoveringHint:
      "You may strike again: half of what is LEFT goes and the recovery restarts; control still cannot change.",
    yourCapital: "Your protected capital",
    yourColony: "Your colony",
    transferHint: "Move craft and resources here with a one-way transfer.",
    transferRoute: "World transfer",
    transferOrigin: "Origin",
    transferTarget: "Target",
    transferFrom: "From {{origin}}",
    transferCraft: "Craft ready",
    transferPrepare: "Choose craft and resources",
    transferRecovering: "Origin world is recovering",
    colonyRoute: "Route to a colony",
    claimOpen: "Colony race open",
    settlementInFlight: "Your colony ships are on the way",
    claimRaceExplain: "Nobody owns it yet. The first valid 2 Couriers to arrive take it.",
    colonySlots: "{{used}} / {{total}} colony slots",
    routeRaid: "Win a decisive raid",
    routeRaidDetail: "Attack with combat ships. Destroy every defender and the shield.",
    routeClaim: "Race opens automatically",
    routeClaimDetail: "Nothing to send. A decisive raid opens the public race by itself.",
    routeSettle: "Dispatch the colony fleet",
    routeSettleDetail: "Only now send the founding ships and cargo. First valid arrival wins.",
    routeSettleInFlightDetail: "Your founding fleet is flying. The first valid arrival wins.",
    raidFleetBadge: "Raid fleet",
    raidFleetExplain:
      "Choose combat ships in the Raid screen and destroy every defender and the shield. No Couriers, founding cargo or colony slot are needed for step 1.",
    automaticBadge: "Automatic",
    automaticExplain:
      "A decisive raid opens the race automatically. You do not send another ship or pay another resource for step 2.",
    settlementAwayBadge: "In flight",
    settlementAwayExplain:
      "Your 2 Couriers and founding cargo have departed. They cannot be recalled; the first valid arrival takes the world.",
    claimCloses: "Closes in {{duration}}",
    claimRaidStillOpen:
      "Another raid is possible; it does not extend this claim.",
    claimDeathStarConsequence:
      "A Death Star clears this claim and starts {{duration}} of recovery. It takes no world: a colony left without ships when the window closes simply stops belonging to anyone.",
    openColonySlot: "Colony slot",
    colonySlotExplain:
      "Needed only for step 3. Your strongest Command Core must provide an unused colony slot when the founding fleet leaves.",
    captureColonySlotExplain:
      "Needed to found a colony, never to strike one: a Death Star transfers nothing.",
    openFlightBay: "1 free flight bay",
    flightBayExplain:
      "Needed only for step 3. The one-way flight of the 2 Couriers occupies 1 bay until they reach the neutral world.",
    courierCount: "2 Couriers",
    haulerExplain:
      "Only for step 3: these are the founding fleet, sent separate from the raid after it opens the race. They are not needed for the raid.",
    foundingAlloy: "{{amount}} Alloy",
    foundingAlloyExplain:
      "{{amount}} Alloy travels as the new colony’s starting stock in step 3. It is not a cost of the raid.",
    foundingCrystal: "{{amount}} Crystal",
    foundingCrystalExplain:
      "{{amount}} Crystal travels as the new colony’s starting stock in step 3. It is not a cost of the raid.",
    settlementFuel: "{{amount}} Deuterium",
    settlementFuelExplain:
      "The 2 Couriers burn {{amount}} Deuterium on their one-way flight in step 3. Distance changes this amount.",
    settlementArrivalExplain:
      "The founding flight lasts {{duration}}. It must arrive before the public race closes; first valid arrival wins.",
    arrivesIn: "Arrives {{duration}}",
    deathStarRoute: "What a strike does",
    /** The clock a defender is racing, named for what runs out at the end of it. */
    recoveryBreach: "Recovery breach · drop deadline",
    occupationProtected: "Occupation protection",
    protectedFor: "Cannot be struck or captured for {{duration}}.",
    firstImpact: "Damage + {{duration}} dark",
    secondImpact: "No ships sent · the world is nobody's",
    deathStarReadyRequirement: "Death Star ready",
    deathStarReadyExplain:
      "A strike needs a completed Death Star waiting at the launch world.",
    /**
     * THE ONE THING A DEFENDER HAS TO KNOW, WHERE THEY ARE LOOKING AT IT. D167.
     *
     * It replaces three requirement chips that described the capture route: an
     * open colony slot, a ready weapon, an arrival before the window shut, none of
     * which exist any more. A rule the player cannot see is not a usable rule, and
     * this is the only rule left on this panel that can cost them a world.
     */
    recoveryDropWarning:
      "{{duration}} left. Land a ship here before the clock runs out or this colony stops being yours — no second strike required.",

    /**
     * THE SAME FACTS AS THE FORGE CARD, WRITTEN FOR THE PERSON PULLING THE
     * TRIGGER. D113, and D55: two surfaces, two sets of words, nothing shared.
     */
    strikeTitle: "What this impact does",
    strikeFleet: "Every ship and gun on the ground is destroyed",
    strikeStock: "Half the resources in storage and the Works are destroyed",
    strikeCore: "The Command Core loses a level",
    strikeAegis:
      "The Aegis loses {{levels}} levels and the shield drops to nothing",
    strikeDark:
      "Production, collection, construction, new orders and launches stop for {{duration}}",
    strikeCapture: "If its commander lands no ship before that window closes, the world becomes nobody's",
    strikeNoCapture: "A capital can be devastated again, but is never lost",
    eyebrow: "Held by {{owner}}",
    location: "World · {{planet}}",
    /** A world outside every reach and never probed. It has no other name. D127. */
    unsurveyedEyebrow: "World · unsurveyed",
    unsurveyedTitle: "Nobody has looked here",
    /* Paired side by side on the rail, so the verb is the label and the cost is
       its own micro line. See `ProbeControl`. */
    attackShort: "Attack",
    probeShort: "Probe",
    probeCoolingShort: "Probe in {{duration}}",
    attack: "Plan an attack",
    attackNeutralAgain: "Raid again · claim unchanged",
    attackOriginRecovering: "Attack · origin recovering",
    windowOpen:
      "Their fleet is not home. This is the window the whole game is about.",
    distance: "Distance",
    reach: "Your reach",
    reachUnknown: "—",
    known: "Known",
    knownOf: "{{have}} of {{total}}",

    headlineFleetAway: "Fleet away",
    headlineFleetHome: "Fleet home",
    headlineVeiled: "Veiled",
    headlineProbed: "Probed {{age}}",
    headlineFought: "Fought {{age}}",
    headlineNone: "No intel",

    installTelescope: "Install a Telescope",
    watchSlot: "Watch · slot {{slot}}",
    replaceSlot: "Slot {{slot}} · replace {{target}}",
    watching: "Watching {{target}}",
    sendProbe: "Send a probe · {{alloy}} alloy · {{crystal}} crystal",
    probeAway: "Probe away · reports back in {{duration}}",
    /*
      ONE LOOK PER WORLD PER HOUR (D121). The control says which world is closed
      and for how long, rather than letting the player spend the tap to find out.
    */
    probeCooling: "You just looked here · another probe in {{duration}}",
    markRival: "Mark rival",
    rivalMarkedAction: "Rival",
    rivalMarked: "{{commander}} is now your Rival.",
    rivalCleared: "{{commander}} is no longer marked as your Rival.",
    rivalHeading: "Your story this season",
    rivalMarkedBadge: "Marked rival",
    rivalEncounters: "Encounters",
    rivalYourRaids: "Your raids",
    rivalTheirRaids: "Their raids",
    rivalDominion: "Dominion",
    rivalDominionValue: "+{{gained}} · −{{lost}}",
    rivalLastContact: "Last contact {{age}}",
    rivalProbeOnly:
      "You have looked at this world, but neither side has opened fire yet.",
    rivalNoContact:
      "You marked this commander. The first move between you is still waiting.",
    rivalAhead:
      "You hold the edge. They have more Dominion to win back from you.",
    rivalBehind: "They hold the edge. The debt is still open.",
    rivalEven:
      "The ledger between you is balanced. The next encounter breaks it.",
    rivalFeud: "{{count}} encounters have made this more than a single raid.",
    rivalPurpose:
      "Pins this commander and your shared season record. It grants no combat or intel bonus.",
  },

  asteroid: {
    eyebrow: "Level {{level}} asteroid",
    title: "Passing rock",
    summaryOre: "{{amount}} ore",
    summaryAnomaly: "{{amount}} ore · isotope anomaly",
    working_one: "{{count}} craft already working this rock · {{state}}",
    working_other: "{{count}} craft already working this rock · {{state}}",
    stateReturning: "heading home",
    stateInbound: "inbound",
    noCraft: "No Prospectors at home",
    tooLate: "It will be gone before you arrive",
    researchNeeded: "Research Isotope Spectrometry first",
    send: "Send {{count}} · {{duration}}",
    oreLeft: "Ore left",
    leavesIn: "Leaves in",
    composition: "Composition",
    compositionValue: "{{percent}}% crystal",
    compositionUnknown: "Isotope composition unknown",
    compositionIsotope: "{{crystal}}% crystal · {{deuterium}}% Deuterium",
    deuteriumRoute:
      "Send Prospectors to recover Deuterium. The return haul lands in the Works; Collect it into storage.",
    speed: "Speed",
    speedValue: "{{rate}}/min",
    spill:
      "Your works can only take {{room}} more. About {{lost}} of this haul would be lost on arrival — empty them first.",
    taken: "Somebody has already taken {{amount}} out of it.",
    untouched: "Untouched. First craft to reach it takes what it can carry.",
    // "{{total}} between them" is nonsense about a single craft, in either language.
    fleetLine_one: "{{count}} Prospector at home · carries {{hold}}",
    fleetLine_other:
      "{{count}} Prospectors at home · each carries {{hold}} · {{total}} between them",
    derrickPitch:
      "A <0>{{name}}</0> in orbit would make that <1>{{hold}}</1> each, and get them there sooner.",
    intercept:
      "Your craft would meet it in {{reach}}, with {{spare}} to spare.",
  },

  craftPicker: {
    label: "How many to send",
  },

  debris: {
    eyebrow: "Wreckage",
    titleUnknown: "Debris field",
    titleOver: "Debris over {{planet}}",
    summarySalvage: "{{amount}} salvage",
    working_one: "{{count}} craft already there · {{state}}",
    working_other: "{{count}} craft already there · {{state}}",
    stateReturning: "heading home",
    stateInbound: "inbound",
    noCraft: "No craft at home",
    tooLate: "It will be gone before you arrive",
    send: "Send {{count}} · {{duration}}",
    alloyLeft: "Alloy left",
    crystalLeft: "Crystal left",
    deuteriumLeft: "Deuterium left",
    goneIn: "Gone in",
    yourHold: "Your hold",
    spill:
      "Your works can only take {{room}} more. About {{lost}} of this would be lost on arrival — empty them first.",
    body: "Somebody lost a fleet here. It is fading, and everyone can see it — whoever gets there first takes what is left.",
  },

  run: {
    eyebrowHome: "Coming home",
    eyebrowSalvage: "Salvage run",
    eyebrowOutbound: "Outbound",
    title_one: "{{count}} Prospector",
    title_other: "{{count}} Prospectors",
    homeIn: "Home in",
    reachesIn: "Reaches it in",
    meetsRockIn: "Meets the rock in",
    target: "Target",
    targetWreck: "Wreckage over {{planet}}",
    targetWreckAnon: "Wreckage over a world",
    targetDecayed: "Field has decayed",
    targetRock: "Level {{level}} rock",
    targetRockGone: "Rock has passed",
    carrying: "Carrying {{alloy}} alloy and {{crystal}} crystal.",
    carryingDeuterium:
      "Carrying {{alloy}} alloy, {{crystal}} crystal and {{deuterium}} Deuterium.",
    emptySalvage:
      "Arrived to find the field already picked over. Coming back empty.",
    emptyRock: "Arrived to find the rock already stripped. Coming back empty.",
    salvageNote:
      "A field does not move, and everybody can see it. {{clock}} Whoever gets there first takes what they can carry.",
    salvageClock: "It is gone in {{duration}}.",
    miningNote:
      "Flying to where the rock will be, not where it is. Whoever gets there first takes what they can carry.",
  },

  thread: {
    eyebrowProbeHome: "Probe coming home",
    eyebrowProbeOut: "Probe outbound",
    eyebrowFleetHome: "Fleet returning",
    eyebrowFleetOut: "Fleet outbound",
    arrivesIn: "Arrives in",
    craft: "Craft",
    craftUnknown: "—",
    returning: "On its way back. Nothing more to decide.",
    outbound: "A launched fleet cannot be recalled.",
  },

  contact: {
    eyebrowBattle: "A raid is landing",
    eyebrowInbound: "This contact is coming for you",
    eyebrowSalvage: "Somebody is salvaging",
    eyebrowMining: "Somebody is mining",
    eyebrowProbe: "Somebody is scouting",
    eyebrowMoving: "Somebody is moving",
    titleUnknown: "Unidentified",
    eyebrowUnknown: "Something is out there",
    unknownHint:
      "Outside your Telescope sight. When this contact enters sight, its craft type and, for a fleet, its exact hulls and counts become readable.",
    /**
     * RADAR L5 NAMES THE KIND WITHOUT NAMING THE CRAFT.
     *
     * The top of the ladder, paying out on ordinary traffic rather than only on a
     * raid aimed at you. It has to say WHERE the reading came from, or the panel
     * would be claiming sight it does not have — and the fog hides, never lies.
     */
    radarKind: "Radar reads it as a {{kind}}. Nothing else at this range.",
    titleBattle: "Under fire",
    titleFleet: "Squadron",
    titleProbe: "Probe",
    titleMining: "Mining run",
    titleHarvest: "Salvage run",
    titleDeathStar: "Death Star",
    titlePirate: "Pirate fleet",
    eyebrowPirate: "Pirates are out there",
    boundaryPirate:
      "You can see the pirates themselves and what they fly. Nothing about where they came from, and nothing about their orbit — a pirate is a position, not a route.",
    working: "Working",
    craftCount: "{{count}} craft",
    /**
     * A SILHOUETTE, NOT A ROSTER. D123.
     *
     * The panel used to name every hull in somebody else's squadron, which is what
     * Radar L4 and L5 are sold for. What a stranger reads now is roughly how much
     * is out there — and the word chosen has to make clear it is an estimate, or
     * the interface is quietly claiming a precision the payload does not have.
     */
    massLight: "Light contact",
    massMedium: "Sizeable force",
    massHeavy: "Heavy force",
    massHint: "Size only — no manifest at this range.",
    inboundHint:
      "Radar knows it is aimed at one of your worlds. Its arrival time is delivered separately as a timed warning.",
    bombarding: "Bombarding",
    settling: "Settling now",
    unattributed: "Unattributed",
    arrivalUnknown: "Arrival unknown",
    inboundNoClock: "Aimed at you · no arrival time",
    craftLabel: "Craft",
    craftUnknown: "—",
    statusLabel: "Status",
    statusLanded: "Landed",
    arrivesIn: "Arrives in",
    arrivesUnknown: "Unknown",
    boundaryBattle:
      "A fleet is over that world and firing. If it is inside Telescope sight, its exact formation is visible; whose it is, where it came from and who wins are not.",
    boundarySalvage:
      "A salvage run is public — the field, the route and the clock. What it brings home is not.",
    boundaryMining:
      "You discovered this rock, so its mining race is visible: target, route and clock. What comes home remains private.",
    boundaryFleet:
      "Inside Telescope sight you can identify the craft itself; for a fleet, its exact hulls and counts are visible. Its owner, origin and destination are not.",
    boundaryUnknown:
      "You can see movement only. Craft type, size, owner, origin and destination are absent from this reading.",
    telescopeHint:
      "Watching a world tells you whether its fleet is home. That is the information that turns movement on the map into a possible attack window.",
    wreckHint:
      "Wreckage is public. Whatever is left of both fleets will be in orbit there shortly, and anyone may go and get it.",
  },
} as const;

/**
 * KORSAN FİLOLARI — the third thing in the galaxy worth flying at. D150.
 *
 * Every line here has to make the RULE visible: the level, the handicap it buys,
 * the deadline and the odds of towing a ship home. A rule the player cannot see is
 * not a usable rule (D124), and this is the only surface any of them appear on.
 */
export const pirate = {
  title: "Pirate fleet",
  /** Level and callsign together. The callsign is season-unique and leaks no index. */
  name: "Pirate fleet L{{level}}-{{callsign}}",
  level: "Level {{level}}",
  eyebrow: "Level {{level}} pirates",
  /** The one combat modifier in the feature, stated as a number the player can price. */
  damagePenalty: "This fleet deals {{percent}}% less damage",
  /** Opens the same commitment sheet a raid on a world opens. D150. */
  attack: "Attack",
  yourFleet: "Your fleet",
  atHome: "{{count}} at home",
  fewer: "Fewer {{name}}",
  more: "More {{name}}",
  quantity: "How many {{name}}",
  max: "Send every {{name}}",
  maxShort: "Max",
  noShipsAtHome: "No ships at this world to send.",
  leftAtHome: "Defence left at home: {{power}} power",
  eyebrowUnknown: "Unidentified contact",
  pickShips: "Pick at least one ship",
  fuelCost: "Fuel {{amount}} deuterium",
  noFuel: "Not enough deuterium for the round trip",
  noBay: "No free flight bay",
  tooSlow: "Your slowest ship cannot catch it",
  roster: "Crew",
  rosterUnknown: "Crew unknown at this range",
  unknownContact: "Unidentified contact",
  mass: "Mass",
  leavesIn: "Leaves in",
  reach: "Reaches it in {{duration}}",
  reachLabel: "You arrive in",
  tooLate: "It leaves the area before you could reach it",
  unreachable: "Nothing at this world could catch it",
  alreadyRaiding: "This world already has a raid out there",
  outOfSight: "Not on your sensors",
  noShips: "No ships at home",
  captureHint: "A decisive win may hand you one ship from its crew",
  captured: "{{hull}} captured",
  captureMissed: "Nothing left worth towing home",
  send: "Send {{count}} · {{duration}}",
  outbound: "A launched fleet cannot be recalled.",
  /**
   * YOU CANNOT SEE THIS ONE — WHICH IS NOT THE SAME AS "THIS IS OLD". D160.
   *
   * The line says what the faded craft on the disc says: no circle of yours covers
   * it, and it is here because you identified it once. The figures are still
   * current — an orbit is solvable and the crew is the lane's live state, exactly
   * as a rock you have found keeps reporting its remaining ore.
   */
  remembered: "Tracked since you identified it · not on your sensors now",
  /** The boundary, stated — the same job the contact panel's last line does. */
  boundary:
    "A pirate you have identified stays on this list until it dies or its time runs out, exactly like a rock you have found. Its orbit is solvable, so you keep the track and the crew count out of range — what you lose is the eye, not the trail.",
  hoardHint: "What you carry home is capped by the holds you brought.",
} as const;
