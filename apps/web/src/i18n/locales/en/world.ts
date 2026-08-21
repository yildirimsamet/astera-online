/**
 * THE DISC AND EVERYTHING ON IT — the galaxy's own chrome, the commander sheet,
 * and the focus rail that answers "what is this, and what do I know about it".
 */

export const galaxy = {
  discLabel: 'The disc',
  /**
   * Its own key rather than a reuse of the server list's, because nothing is
   * shared between surfaces (D55): this one sits at 8px in the corner of the
   * disc and the other is a row in a list, and they are free to diverge.
   */
  online: '{{count}} online',
  worlds: '{{count}} worlds',
  fleetAway: ' · {{count}} fleet away',
  rocks: ' · {{count}} rocks',
  wrecks_one: ' · {{count}} wreck',
  wrecks_other: ' · {{count}} wrecks',
  home: 'Centre on your planet',

  /** What a launch says as it leaves. */
  harvestAway: '{{count}} away · {{minutes}}m to the wreck',
  miningAway: '{{count}} away · meets the rock in {{minutes}}m',

  panelPlanetEyebrow: 'Your planet',
  panelCommanderEyebrow: 'Commander',
  panelIntelEyebrow: 'What you know',
  panelIntelTitle: 'Intel',

  commander: {
    galaxyLabel: 'Galaxy',
    galaxyUnknown: '—',
    endsLabel: 'Season ends in',
    endsUnknown: '—',
    body:
      'Your commander is a name and a password, so this planet is waiting on any browser you sign into. At the wipe every galaxy resets and everyone starts again.',
    signOut: 'Sign out',
  },
} as const;

export const focus = {
  /** The rail itself. */
  shellLabel: '{{title}} — focus',
  clear: 'Clear selection',

  /** One known thing, with where it came from stamped on it. */
  unknown: 'Unknown',

  planet: {
    eyebrow: 'Held by {{owner}}',
    attack: 'Plan an attack',
    outOfBand: 'Tier {{tier}} — you may fight {{low}}–{{high}}',
    windowOpen: 'Their fleet is not home. This is the window the whole game is about.',
    distance: 'Distance',
    reach: 'Your reach',
    reachUnknown: '—',
    known: 'Known',
    knownOf: '{{have}} of {{total}}',

    headlineFleetAway: 'Fleet away',
    headlineFleetHome: 'Fleet home',
    headlineVeiled: 'Veiled',
    headlineProbed: 'Probed {{age}}',
    headlineFought: 'Fought {{age}}',
    headlineNone: 'No intel',

    installTelescope: 'Install a Telescope',
    watchSlot: 'Watch · slot {{slot}}',
    replaceSlot: 'Slot {{slot}} · replace {{target}}',
    watching: 'Watching {{target}}',
    sendProbe: 'Send a probe · {{alloy}} alloy · {{crystal}} crystal',
    probeAway: 'Probe away · reports back in {{duration}}',
  },

  asteroid: {
    eyebrow: 'Level {{level}} asteroid',
    title: 'Rock {{index}}',
    summaryOre: '{{amount}} ore',
    working_one: '{{count}} craft already working this rock · {{state}}',
    working_other: '{{count}} craft already working this rock · {{state}}',
    stateReturning: 'heading home',
    stateInbound: 'inbound',
    noCraft: 'No Prospectors at home',
    tooLate: 'It will be gone before you arrive',
    send: 'Send {{count}} · {{duration}}',
    oreLeft: 'Ore left',
    leavesIn: 'Leaves in',
    composition: 'Composition',
    compositionValue: '{{percent}}% crystal',
    speed: 'Speed',
    speedValue: '{{rate}}/min',
    spill:
      'Your works can only take {{room}} more. About {{lost}} of this haul would be lost on arrival — empty them first.',
    taken: 'Somebody has already taken {{amount}} out of it.',
    untouched: 'Untouched. First craft to reach it takes what it can carry.',
    // "{{total}} between them" is nonsense about a single craft, in either language.
    fleetLine_one: '{{count}} Prospector at home · carries {{hold}}',
    fleetLine_other: '{{count}} Prospectors at home · each carries {{hold}} · {{total}} between them',
    derrickPitch:
      'A <0>{{name}}</0> in orbit would make that <1>{{hold}}</1> each, and get them there sooner.',
    intercept: 'Your craft would meet it in {{reach}}, with {{spare}} to spare.',
  },

  craftPicker: {
    label: 'How many to send',
  },

  debris: {
    eyebrow: 'Wreckage',
    titleUnknown: 'Debris field',
    titleOver: 'Debris over {{planet}}',
    summarySalvage: '{{amount}} salvage',
    working_one: '{{count}} craft already there · {{state}}',
    working_other: '{{count}} craft already there · {{state}}',
    stateReturning: 'heading home',
    stateInbound: 'inbound',
    noCraft: 'No craft at home',
    tooLate: 'It will be gone before you arrive',
    send: 'Send {{count}} · {{duration}}',
    alloyLeft: 'Alloy left',
    crystalLeft: 'Crystal left',
    goneIn: 'Gone in',
    yourHold: 'Your hold',
    spill:
      'Your works can only take {{room}} more. About {{lost}} of this would be lost on arrival — empty them first.',
    body:
      'Somebody lost a fleet here. It is fading, and everyone can see it — whoever gets there first takes what is left.',
  },

  run: {
    eyebrowHome: 'Coming home',
    eyebrowSalvage: 'Salvage run',
    eyebrowOutbound: 'Outbound',
    title_one: '{{count}} Prospector',
    title_other: '{{count}} Prospectors',
    homeIn: 'Home in',
    reachesIn: 'Reaches it in',
    meetsRockIn: 'Meets the rock in',
    target: 'Target',
    targetWreck: 'Wreckage over {{planet}}',
    targetWreckAnon: 'Wreckage over a world',
    targetDecayed: 'Field has decayed',
    targetRock: 'Level {{level}} rock',
    targetRockGone: 'Rock has passed',
    carrying: 'Carrying {{alloy}} alloy and {{crystal}} crystal.',
    emptySalvage: 'Arrived to find the field already picked over. Coming back empty.',
    emptyRock: 'Arrived to find the rock already stripped. Coming back empty.',
    salvageNote:
      'A field does not move, and everybody can see it. {{clock}} Whoever gets there first takes what they can carry.',
    salvageClock: 'It is gone in {{duration}}.',
    miningNote:
      'Flying to where the rock will be, not where it is. Whoever gets there first takes what they can carry.',
  },

  thread: {
    eyebrowProbeHome: 'Probe coming home',
    eyebrowProbeOut: 'Probe outbound',
    eyebrowFleetHome: 'Fleet returning',
    eyebrowFleetOut: 'Fleet outbound',
    arrivesIn: 'Arrives in',
    craft: 'Craft',
    craftUnknown: '—',
    returning: 'On its way back. Nothing more to decide.',
    outbound: 'A launched fleet cannot be recalled.',
  },

  contact: {
    eyebrowBattle: 'A raid is landing',
    eyebrowSalvage: 'Somebody is salvaging',
    eyebrowMining: 'Somebody is mining',
    eyebrowProbe: 'Somebody is scouting',
    eyebrowMoving: 'Somebody is moving',
    titleBattle: 'Under fire',
    titleFleet: 'Squadron',
    titleProbe: 'Probe',
    titleMining: 'Mining run',
    titleHarvest: 'Salvage run',
    working: 'Working',
    craftCount: '{{count}} craft',
    bombarding: 'Bombarding',
    settling: 'Settling now',
    unattributed: 'Unattributed',
    arrivalUnknown: 'Arrival unknown',
    craftLabel: 'Craft',
    craftUnknown: '—',
    statusLabel: 'Status',
    statusLanded: 'Landed',
    arrivesIn: 'Arrives in',
    arrivesUnknown: 'Unknown',
    boundaryBattle:
      'A fleet is over that world and firing. Whose it is, and where it came from, are still not in this reading — and neither is who wins.',
    boundarySalvage:
      'A salvage run is public — the field, the route and the clock. What it brings home is not.',
    boundaryMining:
      'A mining run is public — the rock, the route and the clock. What it brings home is not.',
    boundaryFleet:
      'You can see what is flying and what is in it. Whose it is, where it came from and where it is going are not in this reading.',
    telescopeHint:
      'A Telescope pointed at a world tells you when ITS fleet leaves. That is the only way to put a name to movement.',
    wreckHint:
      'Wreckage is public. Whatever is left of both fleets will be in orbit there shortly, and anyone may go and get it.',
  },
} as const;
