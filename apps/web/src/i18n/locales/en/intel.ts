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
    gives: 'Estimates of their resources and units, shown as ranges. It does not guarantee a battle outcome.',
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
    defence: 'Armed unit value',
    ships: 'Ships',
    accuracyHome: '{{percent}} accuracy · fleet was home',
    accuracyOut: '{{percent}} accuracy · fleet was out',
    estimateNote: 'These numbers are estimated ranges. Armed unit value excludes the shield and unarmed ships.',
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
  sheetYouRaided: 'Target: {{opponent}} · {{planet}}',
  sheetYouRaidedPirate: 'Target: {{opponent}}',
  sheetTheyRaided: 'Attacker: {{opponent}}',
  heldAgainstYou: '{{planet}} kept defending. You took no loot from this raid.',
  brokenByYou: 'You damaged the defence on {{planet}}.',
  /**
   * A PIRATE VERDICT NAMES NO WORLD, because there is not one. Both sentences
   * above are built around `{{planet}}`, which is the empty string out here.
   */
  pirateBroken: 'The crew broke. What was left of them is yours.',
  pirateHeld: 'The pirates kept defending. You took no loot from this raid.',
  /** The prize, and the only door in the game into a hull you did not build. */
  pirateCaptured: 'From pirates',
  pirateCapturedNote:
    'Taken intact from the wreck of a crew you destroyed. It joins the garrison at the world your fleet returns to, and it does not count as one you built.',
  youHeld: 'You stopped the raid. The attacker took no resources.',
  youFell: 'The raid damaged your defence.',
  /** The price of the haul, beside it. `Rounds` is the model's number, not the player's. */
  shipsLost: 'Ships lost',
  haul: 'What came home',
  haulLost: 'What they took',
  /** What your Garbage Collectors lifted — beside the haul, never inside it. D200. */
  salvageHaul: 'Salvaged from the wreck',
  roundsLabel: 'Rounds',
  taken: 'Taken',
  lost: 'Lost',
  dominion: 'Dominion',
  dominionSummaryGained: 'You gained {{amount}} Dominion in this battle.',
  dominionSummaryLost: 'You lost {{amount}} Dominion in this battle.',
  dominionReason: 'Loot you secured and the enemy\u2019s permanent losses add points. Loot taken from you and your permanent losses subtract points. Resource value is used, not ship count.',
  dominionBreakdown: {
    title: 'How Dominion moved',
    lootGained: 'Secured loot',
    lootLost: 'Loot taken from you',
    enemyLosses: 'Enemy permanent losses',
    ownLosses: 'Your permanent losses',
    total: 'Total point change',
  },
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
    returned: 'Survived',
    standing: 'Standing',
    destroyed: 'You destroyed',
    enemyDestroyed: 'Enemy units destroyed',
    attackerDestroyed: 'Attacking ships destroyed',
    noneReturned: 'None of your ships survived the battle.',
    someReturned: '{{count}} of your ships survived the battle.',
    enemySurvivedNote: 'Enemy units remain; their count is hidden. This number is only what you destroyed.',
    enemyUnknownNote: 'This number is only what you destroyed; the remaining enemy count is hidden.',
    loot: 'Loot',
    rosterUnknown: 'This report has no starting count. The surviving count cannot be calculated.',
    walkoverSummary: 'No units were there to defend the target. There was no fight.',
    piratePartialSummary: 'Part of the pirate fleet was still alive at the end of battle.',
    title: {
      attacking: {
        DECISIVE: 'Your raid succeeded',
        DECISIVE_WIPED: 'You breached the defence but lost your fleet',
        PARTIAL: 'Your raid partly succeeded',
        PARTIAL_WIPED: 'You damaged the defence but lost your fleet',
        REPELLED: 'Your raid was repelled',
      },
      defending: {
        DECISIVE: 'Your defence was breached',
        PARTIAL: 'Your defence was partly breached',
        REPELLED: 'You stopped the raid',
      },
    },
    summary: {
      attacking: {
        DECISIVE: 'No units remained to defend the target.',
        PARTIAL: 'The full-success condition was not met: defending units or the shield were still standing.',
        REPELLED: 'The enemy kept defending. You took no loot.',
      },
      defending: {
        DECISIVE: 'All your defending units were destroyed in this battle.',
        PARTIAL: 'The attacker did not fully succeed: your units or shield were still standing.',
        REPELLED: 'Your defence held. The attacker took no loot.',
      },
    },
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
  reasonHeading: 'Why this result?',
  rulesToggle: 'Battle rules and calculation',
  roundCalculationToggle: 'Show this round\u2019s shot calculation',
  roundLossesYours: 'Your units destroyed',
  roundLossesTheirs: 'Enemy units destroyed',
  roundNoCasualties: 'No losses',
  roundShield: 'The defender\u2019s shield absorbed {{amount}} damage.',
  turningPointSupport: 'After round {{round}}, you had no units able to fire. The {{support}} remaining support ships could not attack.',
  turningPointWiped: 'After round {{round}}, your entire force was destroyed.',
  roundDamageNote: 'The damage figures include any damage absorbed by the defender\u2019s shield.',
  roundDealt: 'You dealt',
  roundTook: 'You took',
  roundLine: 'you dealt <0>{{dealt}}</0>, took <1>{{took}}</1>',
  shield: 'shield {{amount}}',
  shieldBreaker: 'Nullifier +{{amount}}',
  aegis: {
    aria: 'Aegis shield',
    label: 'AEGIS',
    labelTheirs: 'Enemy Aegis shield',
    labelYours: 'Your Aegis shield',
    broken: 'BROKEN',
    roundedZero: 'REPORTED 0',
    damaged: 'DAMAGED',
    held: 'HELD',
    before: 'Before battle',
    after: 'After battle',
    note: 'The planet shield takes damage before any defending unit does.',
    brokenUnitsRemain: 'The shield reports 0, but defending units survived.',
    brokenDefenceGone: 'The shield broke. All defending units were also destroyed in this battle.',
    brokenMeaning: 'Shield strength is rounded. A reported 0 alone does not prove that all defending forces were destroyed.',
    absorbed: '{{amount}} shield damage absorbed',
  },
  /* ── what a report owes each case. `docs/battle-reports.md` ── */
  /**
   * THE WALKOVER. `resolveCombat` breaks before round one when there is nothing
   * standing and no shield, so the most common raid in the game arrives with
   * `rounds: []` — and drew a heading over an empty plate.
   */
  /** The four questions a battle report answers, in the order a reader asks them. */
  q: {
    happened: 'What happened',
    there: 'What you learned about the enemy',
    enemyForce: 'Enemy units at the start of battle',
    enemyLosses: 'What you destroyed from the enemy',
    incomingForce: 'The fleet that attacked you',
    who: 'What happened to your force?',
    changed: 'Loot and point changes',
  },
  walkoverHeading: 'No defending force stood here',
  walkoverBody:
    'No combat fleet or ground defence stood here. Your ships arrived, loaded, and left. There was no fight to report.',
  walkoverDefendingBody:
    'No defending units stood on your world. The attacking fleet could take the available loot without a fight.',
  /** Their board, and how far the reading goes. */
  theirBoardComplete: 'All units defending at the start of battle',
  theirBoardCompleteNote:
    'All were destroyed in this battle. Some ground guns may be rebuilt after the battle.',
  theirBoardEmptyAtStart: 'No defending units stood here at the start',
  theirBoardEmptyAtStartNote:
    'There were no combat ships or ground guns at the target, so there is no destroyed-unit list here.',
  theirBoardFloor: 'Destroyed units only',
  theirBoardFloorNote:
    'This is not the enemy\u2019s whole fleet. It lists only units destroyed in this battle. Remaining units are not revealed here; send a new probe for an estimate.',
  theirBoardMissingRosterNote: 'This report has no starting roster for the attacking fleet. Only the ships you destroyed are listed; survivors cannot be calculated.',
  theirBoardNothing: 'You destroyed nothing',
  /**
   * THE DEFENDER'S VERSION, WHICH IS NOT A BOUND AT ALL. D164.
   *
   * The two above describe a reading with an edge to it — wreckage, and how far it
   * lets you see. This one describes a force the reader stood underneath, so it
   * makes no claim about limits: it names what arrived, and the bar beside each
   * hull says how much of it the defence took down.
   */
  theirBoardArrived: 'What came at you',
  theirBoardArrivedNote:
    'The entire fleet sent at you, including combat and support ships. Each row labels how many arrived, were destroyed and remained.',
  /** The wall, stated apart from the ships, because it is a different kind of thing. */
  groundHeading: 'Ground defence',
  groundNote: 'These guns defend the planet and cannot fly. {{percent}}% of each destroyed type is rebuilt after battle, rounded down. Their losses are handled separately from ships.',
  shipsHeading: 'Ships',
  noGroundHeading: 'No ground defence',
  noGroundNote: 'This world had no wall standing when you arrived.',
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
    /**
     * THE SAME RULE WITHOUT THE HALF THAT CANNOT APPLY. A shield is a structure on
     * a world; a legend that names one out at a rendezvous is describing a
     * condition the reader could never have met or failed.
     */
    resultDecisivePirate:
      'DECISIVE · every ship in the crew is gone · {{decisiveLoot}}% of the hoard can be taken before cargo limits, and only here can a hull be towed home.',
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
    /** The same step, in open space: there is no world here and so no structure. */
    openSpace: '2 · Nothing between the guns and the hulls',
    openSpaceNote:
      'A rendezvous has no world and no structure to catch a hit; all {{amount}} attack power reached the crew.',
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
      DECISIVE_WIPED: 'You destroyed every defending unit, but none of your ships survived to carry loot home.',
      DECISIVE_WITHOUT_SHIELD: 'You destroyed everything defending it, which is what opens the full haul.',
      WALKOVER: 'No defending units stood here; the available loot was open to your fleet.',
      PARTIAL: 'You dealt enough damage for partial success, but not full success. Only part of the loot became available; without surviving cargo space, nothing can be taken.',
      PARTIAL_WIPED: 'You dealt enough damage for partial success, but none of your ships survived to carry loot home.',
      REPELLED: 'The destroyed units\u2019 resource value did not reach {{threshold}}% of all defending units\u2019 starting value. That is why the raid was repelled; ship count or breaking the shield alone does not decide the result.',
    },
    defending: {
      DECISIVE: 'All your defending units fell and the shield broke, opening the available loot to the raiders. The amount taken depends on their surviving cargo space.',
      DECISIVE_WITHOUT_SHIELD: 'All your defending units fell, opening the available loot to the raiders. The amount taken depends on their surviving cargo space.',
      DECISIVE_WIPED: 'All your defending units fell — and so did every ship they came with. The loot was open and there was nothing left alive to carry it home.',
      WALKOVER: 'No defending units stood on your world, so the available loot was open to the raiders.',
      PARTIAL: 'The attacker dealt enough damage for partial success, but not full success. Only part of the loot became available.',
      PARTIAL_WIPED: 'The attacker dealt enough damage for partial success, but not one of their ships survived to carry it. Nothing left your world.',
      REPELLED: 'Your defence held. They got through nothing, and took nothing.',
    },
  },

  /** Everything a battle did beyond the loot line, each said only when true. */
  effects: {
    heading: 'What it did',
    shieldTheirs: 'Their shield soaked {{amount}} damage before anything reached a hull.',
    shieldYours: 'Your shield soaked {{amount}} damage before anything reached a hull.',
    cargoLimited:
      'Your holds were full. There was more on that world than you could carry — bring Courier, Wayfarer, Atlas or Argosy transports.',
    salvaged_one: '{{count}} ground gun was rebuilt from its own wreckage after the battle.',
    salvaged_other: '{{count}} ground guns were rebuilt from their own wreckage after the battle.',
    worksTheirs: 'Their works are offline for {{duration}}. Nothing is being produced there.',
    worksYours: 'Your works were knocked offline for {{duration}}.',
    /** The defender's copy of what the raider's collectors lifted. D200. */
    salvageTheirs: 'Their Garbage Collectors lifted {{amount}} of the wreckage before it could drift.',
    /** Koloni arızaları: what a heavy defeat broke. Defender only. */
    colonyFaults: 'Broken on {{planet}} by this defeat: {{faults}}.',
    /**
     * Recovery shield, defender only: the NET loss of the lookback at this battle, in
     * hours of the reader's own production, against the bar. Owner instruction, 2026-09-18.
     */
    recoveryProgress:
      'Recovery shield: {{hours}} of {{bar}} h of your production lost, net, over the last {{window}} h. Reach {{bar}} and no one can raid you for {{shield}} h; profit from your own raids is subtracted.',
    recoveryEarned:
      'This defeat earned you a {{shield}} h recovery shield: {{hours}} h of your production lost, net, over the last {{window}} h.',
    recoveryRefused:
      '{{hours}} h of your production lost, net, over the last {{window}} h — past the {{bar}} h bar, but no shield is granted while your own raid is in the air.',
    wreck: '{{amount}} in wreckage is drifting over {{planet}}. Anyone can go and take it.',
    /** The same field, read from the world it is drifting over. */
    wreckYours: '{{amount}} in wreckage is drifting in your own orbit. Anyone can go and take it — including you.',
    /** No orbit to name: the field sits at the rendezvous, in open space. */
    wreckVoid:
      '{{amount}} in wreckage is drifting at the rendezvous, in open space. Send a Prospector — and so can anyone else who saw it happen.',
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
    rebuilt: 'Rebuilt',
    start: 'At the start',
    arrived: 'Arrived',
    rebuiltNote: '{{count}} destroyed ground guns were rebuilt after battle; included in the remaining count.',
    groundType: 'Ground gun · cannot fly',
    supportType: 'Support ship · cannot fire',
    combatType: 'Combat ship',
    summary: '{{brought}} into the fight · {{lost}} destroyed · {{left}} standing',
  },
  /** Whose casualties. Both sides fly Darts, so colour alone cannot say it. */
  roundTheirs: 'Them',
  roundYours: 'You',
  roundNoLosses: 'Neither side lost a unit this round.',
  roundStanding: {
    unknownOwn: 'This report has no starting counts; your remaining units cannot be calculated.',
    heading: 'Your side after round {{round}}',
    enemyHeading: 'Attacking fleet after round {{round}}',
    summary: '{{combat}} units able to fire · {{support}} unarmed support ships',
    supportExposed: 'Support ships cannot fire. No combat units remain to protect them.',
    noneLeft: 'You have no units left to continue fighting.',
    unknownEnemy: 'The enemy\u2019s remaining count is hidden. The enemy losses above are not their whole fleet.',
  },
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

  /**
   * THE LABEL FOLLOWS THE NUMBER. The probe reports what a raid could TAKE now —
   * `raidableStock` — rather than the whole store, so "Resources held" would be
   * naming a different quantity than the one printed under it.
   */
  stockLabel: 'Raidable now',
  stockNote: 'What a decisive raid could carry off. The vault floor is not in it, and your own holds may cap it further.',
  stockCaught: 'Their radar caught the probe — they know somebody looked.',
  stockClean: 'The probe got in and out unnoticed.',
  /** The one force unit, D199 — what the hulls and guns that can fire cost. */
  defenceLabel: 'Armed unit value',
  defenceNote: 'Resource cost of firing ships and ground guns when the probe passed. Not attack damage; excludes the shield and unarmed ships.',
  defenceRatio: 'About ×{{ratio}} what stands on {{world}}.',
  shapeLabel: 'Shape of the wall',
  shapeNote: 'By value, of what can fire. More than half is a majority.',
  shapeUnread: 'Not read',
  shapeUnreadNote: 'Their Veil is stronger than the Shipyard that sent the probe.',
  shieldLabel: 'Shield charge',
  shieldNote: 'Takes a raid’s fire before any hull does, and refills over the hours.',
  unarmedLabel: 'Unarmed in the line',
  unarmedNote: 'They fire nothing, and a clean sweep must still sink every one.',
  shipsLabel: 'Ships counted',
  shipsAllHome: 'Everything they own was home.',
  shipsSomeOut: 'Some of their ships were out.',

  /**
   * THE FOUR READINGS THE PROBE ALWAYS TOOK AND NOTHING EVER PRINTED.
   *
   * Each one names WHEN it was true rather than asserting it now, because all
   * four are frozen at the look. The dossier prints the age beside them.
   */
  /**
   * THE FUEL SHARE OF THE BAND ABOVE, NOT THE TANK. D166.
   *
   * It used to read the whole store while sitting directly under "Raidable now",
   * so the one deuterium figure on the screen measured a different quantity from
   * every other number beside it. Both come off `computeLoot` now, and the label
   * says which question this answers.
   */
  deuteriumLabel: 'Raidable Deuterium',
  deuteriumNote: 'The fuel share of the band above — what a decisive raid could carry off.',
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
  surfaceGapMissing: 'You have never seen this world',
  surfaceGapWhy:
    'You cannot see who holds it, how far along they are or what is in orbit. A probe brings all of it back at once.',

  probeGapLabel: 'Resources and defence',
  probeGapMissing: 'You have never looked closely',
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
