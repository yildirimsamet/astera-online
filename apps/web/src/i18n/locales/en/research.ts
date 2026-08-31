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
 * ("Research Dense Fuel Cells first" on the Runner, the same for the Breacher).
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
    "This queue belongs to your commander. Construction and Yard on every world keep running separately.",
  cancelled: "{{alloy}} Alloy · {{crystal}} Crystal · {{deuterium}} Deuterium refunded",
  runningLabel: "Under way",
  runningOn: "on {{planet}}",
  runningFinishes: "finishes {{time}}",
  idleLabel: "Nothing under way",
  idleHint: "Start a project below. Up to three can wait here while every world's own queues keep running.",
  /** Why a card is shut while another world holds the slot. */
  slotBusy: "{{name}} is running on {{planet}}",

  frontierBand: "Frontier",
  frontierNote:
    "Revealed by specific events in the galaxy, then completed by spending resources and research time.",
  industryBand: "Industry",
  industryNote:
    "Open from the first minute with five rungs each. Improves production, build time and carrying capacity.",
  doctrineBand: "Doctrine",
  doctrineNote:
    "Raises attack and hull strength together for specific craft classes. Rivals can learn these levels from probe reports.",
  strategicBand: "Strategic",
  strategicNote:
    "Unlocks the galaxy’s most destructive weapon, its defensive answer and additional stock capacity.",

  act: "Research",
  complete: "researched",

  needCore: "Raise Command Core to L{{level}}",
  queueFull: "The Research queue is full",
  at: "Researchable in {{duration}}",
  warAt: "War act opens in {{duration}}",
  isotopeFirst: "Research Isotope Spectrometry first",
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
  denseTag: "Unlocks the Runner",
  denseRole:
    "To reveal it, fill your cargo in one raid while loot remains on the target. The Runner is faster than a Hauler but carries less.",
  denseDetail:
    "Completing it permanently unlocks Runner construction on every world you hold. The Runner lets a fast strike carry loot without waiting for a slow Hauler.",
  graviticName: "Gravitic Charges",
  graviticTag: "Unlocks the Breacher",
  graviticRole:
    "To unlock it, attack a defended world with an active Aegis; the shield must absorb at least {{share}} of your damage. A single Wasp can qualify; you do not need to win. The Breacher hits shields five times harder.",
  graviticDetail:
    "Completing it permanently unlocks the Breacher everywhere. That hull is a specialist answer to active Aegis shields, not a general damage upgrade.",
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

  waspDoctrineName: "Wasp Doctrine",
  lanceDoctrineName: "Lance/Breacher Doctrine",
  bulwarkDoctrineName: "Bulwark Doctrine",
  groundDoctrineName: "Emplacement Doctrine",
  generalName: "Weapons and Armour",
  generalTag: "Improves every hull you own",
  doctrineTag: "Better attack and armour",
  doctrineRole:
    "Attack and hull rise together. A class doctrine plus general research can add at most 25% equal-budget combat power; choosing the right counter hull buys far more.",
  waspDoctrineDetail:
    "Improves the attack and hull of every Wasp you field, including existing ships. An attacking fleet carries the rung held at launch; a defender uses the rung held when battle begins.",
  lanceDoctrineDetail:
    "Improves the attack and hull of every Lance and Breacher you own, including existing ships, without changing their natural matchups. Attackers carry the launch-time rung; defenders use the battle-time rung.",
  bulwarkDoctrineDetail:
    "Improves every Bulwark you field without fixing its slow travel speed. Attackers carry the launch-time rung; defenders use the rung held when battle begins.",
  groundDoctrineDetail:
    "Improves the attack and hull of Bastions and Thorns on every world. It changes combat strength, not ground capacity or salvage; defenders use the rung held when battle begins.",
  generalDetail:
    "Raises the durability of every ship and ground gun, and the attack of each hull that has an attack value; support craft gain durability only. It stacks with class doctrine without taking their combined equal-budget combat-power gain beyond 25%. Attackers carry the launch-time rung; defenders use the battle-time rung.",

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
