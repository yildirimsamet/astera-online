/**
 * WHAT YOU KNOW — the intel centre, the battle reports, the clarity readout, and
 * the dossier lines the focus rail is built from.
 */

export const intel = {
  openOrbit: 'Open Orbit',
  tabs: {
    label: 'Intel reports',
  },
  coverage: {
    label: 'Coverage',
    blind: 'You cannot see into a single planet',
    partial_one: 'Watching {{seen}} of your {{count}} slot',
    partial_other: 'Watching {{seen}} of your {{count}} slots',
    full: 'Every slot you have is watching someone',
    blindHint: 'A Telescope is the cheapest way to stop that.',
    idleHint_one: '{{count}} slot is idle. Pick a world in the galaxy and point one at it.',
    idleHint_other: '{{count}} slots are idle. Pick a world in the galaxy and point one at it.',
    scarcity_one:
      '{{neighbours}} worlds out there and {{count}} eye to spend. Moving one costs a cooldown, so choose who.',
    scarcity_other:
      '{{neighbours}} worlds out there and {{count}} eyes to spend. Moving one costs a cooldown, so choose who.',
    oneMore: 'Telescope L{{level}} would watch one more.',
    noRadar: 'And with no Radar, you cannot tell when someone is doing the same to you.',
  },

  watching: {
    heading: 'Watching',
    slotsUsed: '{{used}}/{{total}} slots used',
    slotLabel: 'Slot {{slot}}',
    slotEmpty: 'Idle',
    missingNoSlot: 'No slot is pointed at anything',
    missingNoTelescope: 'You have no Telescope',
    gives: "Tells you the moment a planet's fleet leaves — the one fact that decides every raid.",
    costPoint: 'Pick a planet in the galaxy and point a slot at it.',
    costInstall: 'Install one from your planet screen.',
    away: 'Their planet is defended by whatever they left behind.',
    intermittent:
      'An intermittent reading refreshes every twenty minutes at best. Checking again will not improve it — the answer is fixed until the window turns over.',
  },

  probes: {
    heading: 'Probe reports',
    newest: 'newest first',
    missing: 'No probe has ever come back',
    gives: 'Real numbers — how much they hold and how hard they are to take — as a range.',
    /**
     * THE FIGURES ARE INTERPOLATED, NOT WRITTEN. D59.
     *
     * This line said "220 alloy" for two phases while `PROBE` charged 50 and 50 —
     * a price the game had never charged, on the one card whose whole job is to
     * sell scouting to somebody deciding whether to look or to hit. It is passed
     * the real constants now, so it cannot drift from them again.
     *
     * Speed leads the sentence on the owner's instruction: a probe is the fastest
     * thing a commander can arm, and nobody was using it.
     */
    cost: 'Fast and cheap — {{alloy}} alloy, {{crystal}} crystal, and it outruns every warship you own. Their radar may catch it.',
    stock: 'Stock',
    defence: 'Defence',
    ships: 'Ships',
    accuracyHome: '{{percent}} accuracy · fleet was home',
    accuracyOut: '{{percent}} accuracy · fleet was out',
    caught: ' · they caught it',
  },

  radar: {
    heading: 'Who is looking at you',
    level: 'Radar L{{level}}',
    missing: 'You have no Radar',
    gives:
      'Catches probes aimed at you. From L3, it sweeps a circle around your world and warns you the moment a fleet crosses into it.',
    cost: 'Someone can build a complete picture of this planet and you will never know.',
    quiet: 'Nothing has scanned you. Radar L{{level}} is listening.',
    scan: 'Scan detected',
    bearing: ' from the galactic {{bearing}}',
    origin: ' · {{planet}}',
    noteFleets:
      'Radar L{{level}} catches a fleet {{range}} units out. A slow, heavy fleet is inside that circle for far longer than a fast one — so you get more warning about the raids that can actually hurt you.',
    noteProbes: 'Radar L{{level}} catches probes. From L3 it also warns of inbound fleets.',
    noteBearing: ' L2 adds the direction they came from.',
    noteOrigin: ' L5 names the planet.',
  },
} as const;

export const reports = {
  heading: 'Battle reports',
  newest: 'newest first',
  empty:
    'Nothing has been fought over yet. A battle is the only intel in this game that is never a guess.',
  youRaided: 'You raided ',
  raidedBy: 'Raided by ',
  rounds: '{{count}} rounds',
  sheetYouRaided: 'You raided {{opponent}}',
  sheetTheyRaided: '{{opponent}} raided you',
  heldAgainstYou: '{{planet}} held. You now know what it takes to break it.',
  brokenByYou: '{{planet}} did not hold.',
  youHeld: 'You held. They now know how much you had waiting.',
  youFell: 'You did not hold.',
  /** The price of the haul, beside it. `Rounds` is the model's number, not the player's. */
  shipsLost: 'Ships lost',
  haul: 'What came home',
  haulLost: 'What they took',
  roundsLabel: 'Rounds',
  taken: 'Taken',
  lost: 'Lost',
  dominion: 'Dominion',
  clansAtLaunch: 'Clans when this fleet launched',
  yourClan: 'Your side',
  theirClan: 'Their side',
  noClan: 'No clan',
  /*
    WHAT IT SHOWS IS LOSSES, so that is what it says. The heading claimed 'what
    they had' over a list of what was DESTROYED — and its own empty state said
    'nothing of theirs was destroyed', so the two disagreed inside one block.
    Losses are still the floor on what they fielded; the dossier is where that
    inference is drawn, and it says 'at least' in as many words.
  */
  theirLosses: 'What you destroyed',
  theirs: 'What they had',
  theirsEmpty: 'Nothing of theirs was destroyed.',
  /** The roster table. 'What it cost you' describes one of its three columns. */
  yourForce: 'Your force',
  yours: 'What it cost you',
  yoursEmpty: 'You lost nothing.',
  howItWent: 'How it went',
  roundLine: 'you dealt <0>{{dealt}}</0>, took <1>{{took}}</1>',
  shield: 'shield {{amount}}',
  breacherShield: 'Breacher +{{amount}}',
  /** The three outcomes the whole combat model produces. */
  gradeDecisive: 'DECISIVE',
  gradePartial: 'PARTIAL',
  gradeRepelled: 'REPELLED',

  /** A world nobody holds. There is no commander to name. */
  neutralHolder: 'an unclaimed world',

  /**
   * WHAT THE STAMP AT THE TOP OF THE REPORT ACTUALLY MEANS.
   *
   * The grade sets the loot share and how long the works stay down, so it is the
   * most consequential word on the surface — and nothing in the game had ever said
   * what separates the three.
   *
   * IT IS SAID WITHOUT JARGON AND FROM THE READER'S SIDE, and both halves of that
   * were got wrong first. "More than 42% of the DEFENCE VALUE was destroyed" is a
   * combat model talking to itself: `defenceValue` is an internal quantity, the
   * percentage is a threshold nobody can act on, and the sentence is written from
   * nobody's point of view — so the commander who had just been raided read a
   * neutral description of their own losses. A player should finish this line
   * knowing what happened to THEM and why the haul was the size it was.
   */
  why: {
    attacking: {
      DECISIVE: 'You destroyed everything defending it and broke the shield, which is what opens the full haul.',
      PARTIAL: 'You broke most of the defence but not all of it, so only part of their stock came away.',
      REPELLED: 'Their defence held. Your fleet could not get through, and nothing came away.',
    },
    defending: {
      DECISIVE: 'Everything you had defending fell and the shield went with it, so they took the full haul.',
      PARTIAL: 'Most of your defence fell but something held, so they only got part of your stock.',
      REPELLED: 'Your defence held. They got through nothing, and took nothing.',
    },
  },

  /** Everything a battle did beyond the loot line, each said only when true. */
  effects: {
    heading: 'What it did',
    shieldTheirs: 'Their shield soaked {{amount}} damage before anything reached a hull.',
    shieldYours: 'Your shield soaked {{amount}} damage before anything reached a hull.',
    cargoLimited:
      'Your holds were full. There was more on that world than you had the cargo to carry — bring Haulers.',
    salvaged_one: '{{count}} ground gun was rebuilt from its own wreckage and is standing again.',
    salvaged_other: '{{count}} ground guns were rebuilt from their own wreckage and are standing again.',
    worksTheirs: 'Their works are offline for {{duration}}. Nothing is being produced there.',
    worksYours: 'Your works were knocked offline for {{duration}}.',
    wreck: '{{amount}} in wreckage is drifting over {{planet}}. Anyone can go and take it.',
    /** The same field, read from the world it is drifting over. */
    wreckYours: '{{amount}} in wreckage is drifting in your own orbit. Anyone can go and take it — including you.',
  },

  /** The caller's own board: what went in, what died, what was standing after. */
  force: {
    hull: 'Hull',
    /** The attacker chose to send it; the defender simply had it there. */
    sent: 'Sent',
    held: 'Had',
    lost: 'Lost',
    left: 'Left',
    summary: '{{brought}} into the fight · {{lost}} destroyed · {{left}} standing',
  },
  /** Whose casualties. Both sides fly Wasps, so colour alone cannot say it. */
  roundTheirs: 'Them',
  roundYours: 'You',
  roundNoLosses: 'Nothing came off the board this round.',
} as const;

/** One telescope reading, rendered as certainty. */
export const clarity = {
  barsLabel: 'Clarity {{state}}',
  stateFull: 'full',
  stateClear: 'clear',
  stateIntermittent: 'intermittent',
  stateDegraded: 'degraded',
  stateBlind: 'blind',
  unreadable: 'UNREADABLE',
  fleetHome: 'FLEET HOME',
  fleetAway: 'FLEET AWAY',
  backIn: ' · back in {{minutes}}m',
  unwatched: 'no watch assigned',
} as const;

/** What you know about another world, and how you know it. */
export const dossier = {
  sourcePublic: 'Public',
  sourceTelescope: 'Telescope',
  sourceProbe: 'Probe',
  sourceBattle: 'Battle report',

  confidencePrecise: 'precise',
  confidenceGood: 'good',
  confidenceRough: 'rough',
  confidenceVague: 'vague',

  ownerLabel: 'Held by',
  ownerNote: 'Free to everyone, all season.',

  developmentLabel: 'Development',
  developmentValue: 'Tier {{tier}}',
  developmentInBand: 'How big the world is. You are Tier {{tier}}, so this one is inside your reach.',
  developmentOutOfBand:
    'Out of reach. You are Tier {{tier}} and may fight Tier {{low}} to {{high}}.',

  hardwareLabel: 'Satellites in orbit',
  hardwareNote: 'You can see the hardware. What it can do costs a probe.',

  fleetLabel: 'Their fleet',
  fleetUnreadable: 'Unreadable',
  fleetAway: 'Not home',
  fleetHome: 'Home',
  fleetVeiledNote: 'Their Veil is beating your Telescope. Raise it, or send a probe instead.',
  fleetAwayUnknownNote: 'You cannot tell when it comes back. That is the risk you are taking.',
  fleetAwayNote: 'Their planet is defended by whatever they left behind.',
  fleetHomeNote: 'Watching is silent — they are never told you are looking.',

  fleetGapNoTelescope: 'You have no Telescope',
  fleetGapOutOfRange: 'Beyond your Telescope’s reach',
  fleetGapNoSlot: 'No slot is pointed here',
  fleetGapWhy:
    'The single most valuable fact in the game: a fleet that is away cannot defend its planet.',
  fleetGapRange: 'Reaches {{reach}}; this world is {{distance}} away',
  fleetGapSlots: 'All {{count}} slots are in use — one has to be moved',

  stockLabel: 'Resources held',
  stockCaught: 'Their radar caught the probe — they know somebody looked.',
  stockClean: 'The probe got in and out unnoticed.',
  defenceLabel: 'Defence value',
  defenceNote: 'What was standing on the planet when the probe passed.',
  shipsLabel: 'Ships counted',
  shipsAllHome: 'Everything they own was home.',
  shipsSomeOut: 'Some of their ships were out.',

  probeGapLabel: 'Resources and defence',
  probeGapMissing: 'Nothing has ever looked closely',
  probeGapWhy:
    'You are about to bet a fleet on what is down there. A probe turns that guess into a range.',

  compositionLabel: 'Known to field',
  compositionValue: 'at least {{fleet}}',
  compositionNote: 'What you destroyed last time you fought. They may have rebuilt.',
  compositionGapLabel: 'What they actually fly',
  compositionGapMissing: 'You have never fought them',
  compositionGapWhy: 'A battle report is the only place an exact composition ever comes from.',
} as const;
