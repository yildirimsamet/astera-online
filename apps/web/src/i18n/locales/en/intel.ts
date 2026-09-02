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
    noRadar: 'And with no Radar, you cannot distinguish a threat aimed at you from other movement.',
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
    caught: 'they caught it',
    /* Two words beside the signal bars, which carry the accuracy themselves. */
    homeTag: 'fleet was home',
    outTag: 'fleet was out',
  },

  radar: {
    heading: 'Who is looking at you',
    level: 'Radar L{{level}}',
    missing: 'You have no Radar',
    gives:
      'Draws the circle you see moving craft in at all, catches probes aimed at you, and marks a threat aimed at your world with the time it has left to fly.',
    cost: 'Someone can build a complete picture of this planet and you will never know.',
    quiet: 'Nothing has scanned you. Radar L{{level}} is listening.',
    scan: 'Scan detected',
    bearing: ' from the galactic {{bearing}}',
    origin: ' · {{planet}}',
    /** Which of the caller's own worlds the scan landed on. */
    onWorld: ' · {{planet}}',
    /* Captions beside the two drawn rings; the picture carries the rest. */
    ringSense: 'Something is out there',
    ringWarn: 'Timed warning',
    /** While the two circles are one, one caption states what the circle does. */
    ringOne: 'Detection and timed warning',
    /**
     * THE READING FOR SOMEBODY WHO CANNOT SEE THE RINGS. The two circles carry
     * both figures and the difference between them; this is the same fact in the
     * one form a screen reader can take.
     */
    noteFleets:
      'Radar L{{level}} distinguishes a threat aimed at you at {{sense}} units, without a clock. At {{warn}} units it adds arrival time.',
    /** The merged form. One circle, both products, one sentence. */
    noteFleetsOne:
      'Radar L{{level}} shows moving craft out to {{sense}} units, and marks a threat aimed at your world with its arrival time.',
    /**
     * THE HALF NO PICTURE CAN DRAW. D49: a reach is what the defender owns and
     * the warning it buys is what the ATTACKER decides, by choosing what to fly.
     * The rings are fixed; how long something sits inside them is not.
     */
    noteSlow: 'A slow, heavy fleet remains inside Radar reach longer.',
    noteProbesLegacy: 'Radar L{{level}} catches probes and warns about inbound fleets inside its circle.',
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
  verdict: {
    label: 'Battle result',
    yourForce: 'Your force',
    yourLosses: 'Your losses',
    sent: 'Sent',
    held: 'Had',
    total: 'Total',
    lost: 'Lost',
    returned: 'Returned',
    standing: 'Standing',
    destroyed: 'You destroyed',
  },
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
  roundDealt: 'You dealt',
  roundTook: 'You took',
  roundLine: 'you dealt <0>{{dealt}}</0>, took <1>{{took}}</1>',
  shield: 'shield {{amount}}',
  shieldBreaker: 'Nullifier +{{amount}}',
  aegis: {
    aria: 'Aegis shield',
    label: 'AEGIS',
    broken: 'BROKEN',
    damaged: 'DAMAGED',
    held: 'HELD',
    before: 'Before battle',
    after: 'After battle',
    note: 'The planet shield takes damage before any defending unit does.',
    absorbed: '{{amount}} shield damage absorbed',
  },
  calculation: {
    intro:
      'The fixed recipe above produces the numbers below. Every round then follows the same three steps.',
    formulaHeading: 'How attack power is built',
    formulaBase: '1 · Base: unit count × attack × research.',
    formulaCounter: '2 · Counter: strong match ×{{strong}}; weak match ×{{weak}}.',
    formulaRoll: '3 · Shot change: −{{min}}% to +{{max}}%.',
    formulaHp: 'Damage is split by the targets’ share of total HP.',
    formulaCarry: 'A unit needs all its HP to fall; unfinished damage carries into the next round.',
    formulaSupport: 'Support ships stay protected while at least one combat unit on their side remains.',
    resultHeading: 'How the result is decided',
    resultDecisive:
      'DECISIVE · every defending unit is gone and the shield is at zero · {{decisiveLoot}}% of exposed stock can be taken before cargo limits.',
    resultPartial:
      'PARTIAL · at least {{threshold}}% of defending unit value is destroyed · {{partialLoot}}% of exposed stock can be taken before cargo limits.',
    resultRepelled:
      'REPELLED · less than {{threshold}}% of defending unit value is destroyed · nothing can be taken.',
    round: 'Round {{round}}',
    fire: '1 · Simultaneous fire',
    fireNote: 'Both sides fire before losses are removed. A unit destroyed in this round still fires.',
    yourShot: 'Your shot',
    theirShot: 'Their shot',
    shotChange: 'Shot change',
    positivePercent: '+{{amount}}%',
    negativePercent: '−{{amount}}%',
    neutralPercent: '0%',
    aegis: '2 · Aegis takes the hit',
    noAegis: '2 · No active Aegis',
    shieldCharge: 'Shield charge',
    absorbed: '{{amount}} absorbed',
    reachedHulls: 'Reached hulls',
    shieldBreaker: '{{amount}} was Nullifier-only shield damage',
    noAegisNote: 'Nothing caught the hit; all {{amount}} attack power reached the defending hulls.',
    losses: '3 · Losses leave the battle',
  },
  /** The three outcomes the whole combat model produces. */
  gradeDecisive: 'DECISIVE',
  gradePartial: 'PARTIAL',
  gradeRepelled: 'REPELLED',
  strategicFirstStrike: 'IMPACT',
  strategicCaptured: 'CAPTURED',
  strategicIneffective: 'INEFFECTIVE',
  strategicIntercepted: 'INTERCEPTED',
  strategicYouAttacked: 'Your Death Star targeted ',
  strategicAttackedBy: 'Death Star sent by ',
  strategicDestroyedInFlight: 'Death Star destroyed in flight',
  strategicRadarTrigger: 'The target world engaged it after it crossed the Radar L3+ interception ring.',
  strategicTelescopeTrigger: 'The defender engaged it after one of their worlds identified it through Telescope sight.',
  strategicTotalDamage: 'Total destroyed value',
  strategicShieldLost: 'Shield destroyed',
  strategicResourcesLost: 'Resources destroyed',
  strategicOrdersLost: 'Queued work destroyed',
  strategicResourceBreakdown: 'Destroyed resources',
  strategicNoFleetLost: 'No stationed fleet or ground defence was destroyed.',
  strategicLevelLosses: 'Levels lost',
  strategicNoLevelLoss: 'No building or instrument level was lost.',
  strategicDestroyedOrders: 'Construction destroyed',
  strategicNoOrdersLost: 'No active construction order was destroyed.',

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
      DECISIVE_WITHOUT_SHIELD: 'You destroyed everything defending it, which is what opens the full haul.',
      PARTIAL: 'You broke most of the defence but not all of it, so only part of their stock came away.',
      REPELLED: 'Their defence held. Your fleet could not get through, and nothing came away.',
    },
    defending: {
      DECISIVE: 'Everything you had defending fell and the shield went with it, so they took the full haul.',
      DECISIVE_WITHOUT_SHIELD: 'Everything you had defending fell, so they took the full haul.',
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
      'Your holds were full. There was more on that world than you could carry — bring Courier, Wayfarer or Atlas transports.',
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
    /** Screen-reader only: the bar is the picture, this is what it says. */
    reading: '{{sent}} in, {{lost}} lost, {{left}} left',
    hull: 'Hull',
    /** The attacker chose to send it; the defender simply had it there. */
    sent: 'Sent',
    held: 'Had',
    lost: 'Lost',
    left: 'Left',
    summary: '{{brought}} into the fight · {{lost}} destroyed · {{left}} standing',
  },
  /** Whose casualties. Both sides fly Darts, so colour alone cannot say it. */
  roundTheirs: 'Them',
  roundYours: 'You',
  roundNoLosses: 'Neither side lost a unit this round.',
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
  ownerRecordNote: 'Whose flag your probe found. It may have changed hands since.',

  developmentLabel: 'Development',
  developmentValue: 'Tier {{tier}}',

  hardwareLabel: 'Satellites in orbit',
  hardwareNote: 'You can see the hardware. What it can do costs a probe.',
  hardwareRecordNote: 'What was in orbit when your probe passed. They may have built more.',

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

  /**
   * THE FOUR READINGS THE PROBE ALWAYS TOOK AND NOTHING EVER PRINTED.
   *
   * Each one names WHEN it was true rather than asserting it now, because all
   * four are frozen at the look. The dossier prints the age beside them.
   */
  deuteriumLabel: 'Deuterium held',
  deuteriumNote: 'Fuel. What they can still launch with.',
  strategicLabel: 'Strategic weapon',
  strategicReady: 'Armed and ready',
  strategicBuilding: 'Under construction',
  strategicUnknown: 'Something on the pad',
  strategicNote: 'Seen on the pad when the probe passed. It may have flown since.',
  strategicUnknownNote: 'The probe was too coarse to tell how far along it is.',
  interceptorLabel: 'Strategic defence',
  interceptorLoaded: 'Charge loaded',
  interceptorEmpty: 'No charge',
  interceptorLoadedNote:
    'A strategic weapon sent at this world would be destroyed on its radar circle. One charge stops one strike.',
  interceptorEmptyNote: 'Nothing here stops a strategic weapon. They may have loaded one since.',
  doctrinesLabel: 'Combat doctrine',
  doctrinesNone: 'None researched',
  doctrinesNote: 'Their hulls fight better than the table says. This is the multiplier you would meet.',
  doctrinesNoneNote: 'They had researched nothing into their hulls when the probe looked.',

  surfaceGapLabel: 'Everything about this world',
  surfaceGapMissing: 'Nobody has ever looked here',
  surfaceGapWhy:
    'You cannot see who holds it, how far along they are or what is in orbit. A probe brings all of it back at once.',

  probeGapLabel: 'Resources and defence',
  probeGapMissing: 'Nothing has ever looked closely',
  probeGapAged: 'Your reading of this world has aged out',
  probeGapWhy:
    'You are about to bet a fleet on what is down there. A probe turns that guess into a range.',

  compositionLabel: 'Known to field',
  compositionValue: 'at least {{fleet}}',
  compositionNote: 'What you destroyed last time you fought. They may have rebuilt.',
  compositionGapLabel: 'What they actually fly',
  compositionGapMissing: 'You have never fought them',
  compositionGapWhy: 'A battle report is the only place an exact composition ever comes from.',
} as const;
