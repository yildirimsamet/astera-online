/**
 * THE RESEARCH SURFACE. T12.
 *
 * Its own namespace because it is its own screen. These strings lived under
 * `planet.reach` while research was four cards on the planet sheet's fleet tab —
 * and while there were four of them, that was the truth. There are fifteen now,
 * they belong to the COMMANDER rather than to a world (T7), and they moved to a
 * surface of their own.
 *
 * `planet.reach` KEPT ITS OWN COPIES of the two sentences that gate a hull
 * ("Research Dense Fuel Cells first" on the Wayfarer, the same for the Nullifier).
 * They read the same in English today and they are still two different strings on
 * two different screens — one is a door on a research card, one is a requirement
 * on a ship. The day either is reworded the other must not move with it.
 */
export const research = {
  eyebrow: "Commander",
  title: "Research",
  /** What the whole screen is for, in the one clause a player reads before scrolling. */
  premise: "Bought once, held by you, and every world you hold has it.",

  /** THE QUEUE. It belongs to the commander, not to the funding world. */
  queueTitle: "Research queue",
  queueCapacity: "{{count}} slots",
  queueLane: "Commander research",
  queueGlobalHint:
    "This queue belongs to your commander, and started research cannot be cancelled. Construction and Yard on every world keep running separately.",
  runningLabel: "Under way",
  runningFinishes: "finishes {{time}}",
  idleLabel: "Nothing under way",
  idleHint: "Start a project below. Up to three can wait here; once started, they cannot be cancelled.",

  frontierBand: "Frontier",
  frontierNote:
    "Revealed by specific events in the galaxy, then completed by spending resources and research time.",
  industryBand: "Industry",
  industryNote:
    "Open from the first minute with five rungs each. Improves production, build time and carrying capacity.",
  doctrineBand: "Doctrine",
  doctrineNote:
    "Opens advanced hull tiers and improves attack, armour or propulsion on separate bounded ladders. Combat levels are probe-visible.",
  strategicBand: "Strategic",
  strategicNote:
    "Unlocks the galaxy’s most destructive weapon, its defensive answer and additional stock capacity.",

  act: "Research",
  complete: "researched",

  needCore: "Raise Command Core to L{{level}}",
  queueFull: "3 research projects are already queued. Wait for one to finish before adding another.",
  at: "Researchable in {{duration}}",
  warAt: "War act opens in {{duration}}",
  isotopeFirst: "Research Isotope Spectrometry first",
  prerequisiteFirst: "Research {{name}} first",
  graviticFirst: "Research Gravitic Charges first",
  cargoInsight: "Fill your cargo in one raid while loot remains",
  shieldInsight: "Have an Aegis absorb at least {{share}} of your raid damage",

  sheetEyebrow: "Research project",
  sheetComplete: "Research complete",
  sheetCost: "Research cost",
  sheetOnce: "Placed in your commander-wide Research queue. It does not use a Construction or Yard slot.",
  sheetRung: "Rung {{level}} of {{max}}. Each rung is bought separately.",

  isotopeName: "Isotope Spectrometry",
  isotopeTag: "Unlocks Deuterium mining",
  isotopeRole:
    "Shows the Deuterium in isotope rocks and lets you send Prospectors to them. The return haul enters the Works.",
  isotopeDetail:
    "Research it once to turn isotope asteroids into selectable mining targets. It unlocks access to contested Deuterium; it does not create passive fuel on a planet.",
  denseName: "Dense Fuel Cells",
  denseTag: "Unlocks Ship Propulsion",
  denseRole:
    "To reveal it, fill your cargo in one raid while loot remains on the target. Completion opens the Ship Propulsion research ladder.",
  denseDetail:
    "Completing it permanently opens Ship Propulsion research for your commander. Propulsion improves all eighteen ships in your fleet and is also part of the Atlas build gate; it does not change Prospectors, probes or the Death Star.",
  graviticName: "Gravitic Charges",
  graviticTag: "Unlocks the Nullifier",
  graviticRole:
    "To unlock it, attack a defended world with an active Aegis; the shield must absorb at least {{share}} of your damage. A single Dart can qualify; you do not need to win. The Nullifier hits active shields five times harder.",
  graviticDetail:
    "Completing it permanently satisfies the specialist-research part of the Nullifier gate. The Nullifier is an answer to an active Aegis, not a general damage upgrade; its bonus shield damage never spills into ships or ground guns.",
  deathStarName: "Death Star Protocol",
  deathStarTag: "Unlocks the Death Star",
  deathStarRole:
    "Lets a world with Command Core 12 and Shipyard 5 build the single-use Death Star. A capital can never be captured.",
  deathStarDetail:
    "Every strike consumes one Death Star. A first hit destroys every fleet at home and every pending building order, removes half the resources in storage and the Works, lowers the Command Core by one level and Aegis by two, and clamps other buildings to the new Core ceiling. For two hours the world cannot produce, collect, place orders or launch. A second hit ordered to capture inside that recovery window can transfer only a colony or neutral world.",

  synthesisName: "Deuterium Synthesis",
  synthesisTag: "Raises the Refinery ceiling",
  synthesisRole:
    "Each rung opens three more Deuterium Refinery levels on every world you hold",
  synthesisDetail:
    "Each research rung raises the Deuterium Refinery ceiling by three levels on every world. You still build those Refinery levels separately where you need fuel production.",
  yardName: "Yard Automation",
  yardTag: "Builds ships faster",
  yardRole:
    "Shortens mobile-craft build time without affecting ground guns or Yard capacity",
  yardDetail:
    "Each rung reduces the time of every future mobile-craft order across your worlds, including Prospectors. It does not speed up ground defences, reduce resource prices or add Yard queue slots.",
  holdsName: "Prospector Holds",
  holdsTag: "Mining craft carry more",
  holdsRole: "Raises every Prospector hold; the Derrick’s capacity bonus applies on top",
  holdsDetail:
    "Each rung increases how much every Prospector can return with. The bonus multiplies with the Derrick satellite, so research and orbital hardware reward the same mining plan.",
  cargoName: "Cargo Holds",
  cargoTag: "Raids carry more home",
  cargoRole: "Raises raid loot capacity without changing world transfers or asteroid mining",
  cargoDetail:
    "Each rung increases raid cargo across your mobile fleet. It helps when exposed stock remains after a battle; peaceful transfers and asteroid mining are unchanged.",

  engineeringName: "Starship Engineering",
  engineeringTag: "Opens advanced hull tiers",
  engineeringRole:
    "Engineering I opens Tier 3 hull permissions; Engineering II opens Tier 4. Individual hulls retain their system-research and Shipyard requirements.",
  engineeringDetail:
    "Engineering grants build permission rather than a combat multiplier. Its first rung opens Tier 3 hull gates and its second opens Tier 4; a specific hull may still require Power, Armor, Propulsion or Gravitic Charges and the stated Shipyard level.",
  powerName: "Ship Power",
  powerTag: "Raises warship attack",
  powerRole:
    "Increases the attack of every warship in your fleet and satisfies advanced offensive build gates. Cargo hulls and ground defence are unaffected.",
  powerDetail:
    "Each rung increases ordinary attack on every warship, the Nullifier included, and applies to ships you already own. It does not add attack to transports or affect Bastion, Thorn, Prospector, probes or the Death Star. An attacker carries its launch-time level; a defender reads the battle-time level.",
  armorName: "Ship Armor",
  armorTag: "Raises ship hull strength",
  armorRole:
    "Increases hull strength for all eighteen ships in your fleet, transports included, and satisfies advanced defensive build gates.",
  armorDetail:
    "Each rung increases hull strength for all eighteen ships, Courier, Wayfarer and Atlas included. It does not affect Bastion, Thorn, Prospector, probes or the Death Star. An attacker carries its launch-time level; a defender reads the battle-time level.",
  propulsionName: "Ship Propulsion",
  propulsionTag: "Raises fleet speed",
  propulsionRole:
    "Increases the speed of all eighteen ships in your fleet and contributes to the Atlas gate. It opens after Dense Fuel Cells.",
  propulsionDetail:
    "Each of the four rungs adds a quarter to the nominal speed of all eighteen ships, so the last one doubles it and halves every flight. A mixed fleet still travels at the speed of its slowest member, so propulsion improves a chosen composition without erasing its profile. It does not affect Prospectors, probes or the Death Star, and only missions quoted after completion receive the gain.",
  groundDoctrineName: "Emplacement Doctrine",
  doctrineTag: "Improves ground defence",
  doctrineRole:
    "Raises Bastion and Thorn attack and hull strength together without changing their capacity, salvage or class matchups.",
  groundDoctrineDetail:
    "Improves the attack and hull of Bastions and Thorns on every world. It changes combat strength, not ground capacity or salvage; defenders use the rung held when battle begins.",

  gridName: "Interception Grid",
  gridTag: "Shoots down a Death Star",
  gridRole:
    "A loaded interceptor destroys one strategic weapon on the Radar interception ring or in Telescope sight",
  gridDetail:
    "It grants access to the interceptor charge. Building one requires an Uplink and Radar 3 on the target world. A loaded charge automatically destroys the first strategic weapon that enters its timed Radar interception ring or is identified in Telescope sight from any world you hold, then is spent.",
  stockpileName: "Strategic Stockpile",
  stockpileTag: "Keep a second weapon on the pad",
  stockpileRole:
    "Each world may hold two Death Stars; the second begins after the first finishes",
  stockpileDetail:
    "Raises the Death Star limit from one to two on each world, not across the commander as a whole. The second can be queued but starts only after the first finishes, and still costs the full price and time. A strike still consumes its weapon.",
} as const;
