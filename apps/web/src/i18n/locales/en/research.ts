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
  premise: "Completed research applies to all worlds you own. Each research level is bought separately.",

  /** THE QUEUE. It belongs to the commander, not to the funding world. */
  queueTitle: "Research queue",
  queueCapacity: "{{count}} slots",
  queueLane: "Commander research",
  queueGlobalHint:
    "This queue belongs to your commander, and started research cannot be cancelled. Construction and Yard on every world keep running separately.",
  runningLabel: "Under way",
  runningFinishes: "finishes {{time}}",
  idleLabel: "Nothing under way",
  idleHint:
    "Pick a star on the map. Up to three projects can wait here.",

  frontierBand: "Frontier",
  frontierNote:
    "Revealed by specific events in the galaxy, then completed by spending resources and research time.",
  industryBand: "Industry",
  industryNote:
    "Improves production, build and repair time, and carrying capacity. Each project shows its own level limit and prerequisites.",
  doctrineBand: "Doctrine",
  doctrineNote:
    "Unlocks advanced ship tiers and improves attack, armour or propulsion through research levels. Probes can reveal combat research levels.",
  strategicBand: "Strategic",
  strategicNote: "Raises how many Death Stars and interceptor charges each of your worlds can hold.",

  act: "Research",
  details: "Details",
  cannotAfford: "Not enough resources",
  complete: "researched",
  /**
   * WHAT IS HAPPENING TO A PROJECT ALREADY BOUGHT. D183.
   *
   * Two words, two states: the clock is paying for one of them and the other is
   * waiting in a line of three. A row that said "1 order queued" for both hid the
   * only fact a commander choosing what to buy next needs.
   */
  rowRunning: "Researching",
  rowQueued: "In queue",

  needCore: "Raise your capital’s Command Core to L{{level}}",
  queueFull: "3 research projects are already queued. Wait for one to finish before adding another.",
  at: "Researchable in {{duration}}",
  isotopeFirst: "Research Isotope Spectrometry first",
  prerequisiteFirst: "Research {{name}} first",
  prerequisiteLevelFirst: "Raise {{name}} to level {{level}} first",
  nameAtLevel: "{{name}} L{{level}}",
  cargoInsight: "Fill your cargo in one raid while loot remains",
  shieldInsight: "Have an Aegis absorb at least {{share}} of your raid damage",

  sheetEyebrow: "Research project",
  sheetComplete: "Research complete",
  sheetCost: "Research cost",
  sheetOnce: "Placed in your commander-wide Research queue. It does not use a Construction or Yard slot.",
  sheetRung: "Level {{level}} of {{max}}. Each level is bought separately.",

  isotopeName: "Isotope Spectrometry",
  isotopeTag: "Unlocks Deuterium mining",
  isotopeRole:
    "Opens deuterium mining from revealed isotope asteroids.",
  isotopeDetail:
    "Complete this research once to select isotope asteroids as mining targets. Prospectors bring the load to the Works, where you collect it before spending. Other players can take the resources first. This research does not create passive fuel production.",
  denseName: "Dense Fuel Cells",
  denseTag: "Unlocks Ship Propulsion",
  denseRole:
    "Opens Ship Propulsion research. Discover it by filling raid cargo while loot remains on the target.",
  denseDetail:
    "Discovery makes Dense Fuel Cells available to research; it is not automatic completion. Complete it to unlock Ship Propulsion. Propulsion speeds fleet ships and is required for Atlas and Argosy. Prospectors and probes use separate speed rules.",
  graviticName: "Gravitic Charges",
  graviticTag: "Unlocks the Nullifier",
  graviticRole:
    "Opens Nullifier access. Discovery needs active Aegis to absorb at least {{share}} of your raid damage.",
  graviticDetail:
    "Attack a defended planet with active Aegis to meet the discovery condition. You do not need to win. Complete the discovered research to meet Nullifier’s specialist requirement; its Shipyard and Engineering requirements still apply. Nullifier’s extra damage affects only active shields, never ships or ground defences.",

  synthesisName: "Deuterium Synthesis",
  synthesisTag: "Raises the Refinery ceiling",
  synthesisRole:
    "Each research level raises every planet’s Deuterium Refinery limit by three levels.",
  synthesisDetail:
    "Research increases the permitted level; it does not build the Refinery for you. Upgrade the Refinery separately on each planet where you need fuel production. The local Command Core must also allow the new level.",
  yardName: "Yard Automation",
  yardTag: "Builds ships faster",
  yardRole:
    "Shortens new ship and ground-defence production orders on all your planets.",
  yardDetail:
    "Each level reduces the build time of new Yard orders, including Prospectors and ground defences. The table shows the share of base time that remains. Resource prices and queue capacity do not change. Construction and ship repairs have separate research effects.",
  robotsName: "AI Robots",
  robotsTag: "Builds structures faster",
  robotsRole:
    "Shortens new Construction orders for buildings, instruments and satellites.",
  robotsDetail:
    "The effect applies on all your planets to new Construction orders. The table shows the share of base time that remains. Ships and ground defences use the Yard and are unaffected. Resource prices and queue capacity stay the same.",
  industrialName: "Industrial",
  industrialTag: "Repairs ships cheaper and faster",
  industrialRole:
    "Reduces ship repair cost and time in every Repair Station.",
  industrialDetail:
    "Level 1 uses 75% of normal repair cost and time; level 2 uses 50%. The effect applies on all your planets. It does not speed up new ship construction. Ships with 20% damage or less are already repaired free on landing.",
  holdsName: "Prospector Holds",
  holdsTag: "Mining craft carry more",
  holdsRole: "Increases Prospector cargo capacity. Level 3 opens a third Prospector slot on each planet.",
  holdsDetail:
    "Each level increases the resources a Prospector can carry per trip. Derrick’s capacity bonus multiplies the researched hold too. The effect applies across your planets. It does not increase ordinary raid or trade cargo capacity.",
  cargoName: "Cargo Holds",
  cargoTag: "Every hold carries more",
  cargoRole: "Increases fleet cargo capacity for raids, planet transfers and trade.",
  cargoDetail:
    "Each level expands fleet ships’ holds for raids and transfers. Courier, Wayfarer, Atlas and Argosy also carry more in trade. A larger hold does not guarantee more loot if the target has less. Prospectors use Prospector Holds instead.",

  engineeringName: "Starship Engineering",
  engineeringTag: "Opens advanced hull tiers",
  engineeringRole:
    "Level 1 meets tier-three ship Engineering requirements; level 2 meets tier-four requirements.",
  engineeringDetail:
    "Level 1 meets Tier 3 engineering requirements; Level 2 meets Tier 4 requirements. Engineering grants build access, not a direct attack or hull-strength bonus. Each ship may also need Ship Power, Ship Armor, Ship Propulsion or Gravitic Charges. Its local Shipyard requirement must still be met.",
  powerName: "Ship Power",
  powerTag: "Raises warship attack",
  powerRole:
    "Increases warship attack across your planets and meets some advanced ship requirements.",
  powerDetail:
    "Each level increases normal attack, including Nullifier’s, and applies to ships you already own. Unarmed ships gain no attack. Ground defences, Prospectors and probes are unaffected. Attacking fleets use launch-time research; ordinary defenders use their levels at combat time.",
  armorName: "Ship Armor",
  armorTag: "Raises ship hull strength",
  armorRole:
    "Increases fleet hull strength, including transports, and meets some advanced ship requirements.",
  armorDetail:
    "The increase applies to existing fleet ships on all your planets. Ground defences, Prospectors and probes are unaffected. Attacking fleets use launch-time research; ordinary defenders use their levels at combat time. More hull strength does not add attack or cargo capacity.",
  propulsionName: "Ship Propulsion",
  propulsionTag: "Raises fleet speed",
  propulsionRole:
    "Increases fleet speed and meets Atlas and Argosy propulsion requirements. Dense Fuel Cells is required.",
  propulsionDetail:
    "Each of four levels adds 25% of base speed; the final level doubles it. A mixed fleet still flies at its slowest ship’s improved speed. The effect applies to missions launched after completion. Prospectors and probes are unaffected.",
  groundDoctrineName: "Emplacement Doctrine",
  doctrineTag: "Improves ground defence",
  doctrineRole:
    "Increases Bastion, Harpoon and Thorn attack and hull strength across your planets.",
  groundDoctrineDetail:
    "The effect applies to existing Bastion, Harpoon and Thorn ground defences. They use the research level completed when combat begins. Ground capacity, free rebuilding and class matchups do not change. The project adds no bonus to mobile ships.",

  gridName: "Interception Grid",
  gridTag: "Four interceptor charges per world",
  gridRole: "Raises each planet’s interceptor capacity from 2 charges to 4.",
  gridDetail: "The research increases capacity; it does not create free charges. Each charge must be built on a planet with Uplink and Radar level 3. Operational sensors can trigger interception of one Death Star; firing consumes one charge. More capacity is useful only if charges are ready.",
  stockpileName: "Strategic Stockpile",
  stockpileTag: "Two Death Stars per world",
  stockpileRole: "Raises Death Star capacity from 1 to 2 on each planet. Each weapon is built and paid for separately.",
  stockpileDetail: "The limit applies to each planet, not to your whole fleet combined. The second weapon starts after the first finishes and uses its own full cost and build time. More launched weapons can exceed ready interceptor charges, but do not guarantee a hit.",
} as const;
