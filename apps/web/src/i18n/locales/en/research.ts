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
    "Shows the Deuterium in isotope rocks and lets you send Prospectors to them. The return haul enters the Works.",
  isotopeDetail:
    "Research it once to turn isotope asteroids into selectable mining targets. It unlocks access to contested Deuterium; it does not create passive fuel on a planet.",
  denseName: "Dense Fuel Cells",
  denseTag: "Unlocks Ship Propulsion",
  denseRole:
    "To reveal it, fill your cargo in one raid while loot remains on the target. Completing it unlocks Ship Propulsion research.",
  denseDetail:
    "Completing it permanently opens Ship Propulsion research for your commander. Propulsion improves every ship in your fleet and is also part of the Atlas build gate; it does not change Prospectors or probes.",
  graviticName: "Gravitic Charges",
  graviticTag: "Unlocks the Nullifier",
  graviticRole:
    "To unlock it, attack a defended world with an active Aegis; the shield must absorb at least {{share}} of your damage. A single Dart can qualify; you do not need to win. The Nullifier hits active shields five times harder.",
  graviticDetail:
    "Completing it permanently satisfies the specialist-research part of the Nullifier gate. The Nullifier is an answer to an active Aegis, not a general damage upgrade; its bonus shield damage never spills into ships or ground guns.",

  synthesisName: "Deuterium Synthesis",
  synthesisTag: "Raises the Refinery ceiling",
  synthesisRole:
    "Each level opens three more Deuterium Refinery levels on every world you hold",
  synthesisDetail:
    "Each research level raises the Deuterium Refinery ceiling by three levels on every world. You still build those Refinery levels separately where you need fuel production.",
  yardName: "Yard Automation",
  yardTag: "Builds ships faster",
  yardRole:
    "Shortens mobile-craft build time without affecting ground guns or Yard capacity",
  yardDetail:
    "Each level reduces the time of every future mobile-craft order across your worlds, including Prospectors. It does not speed up ground defences, reduce resource prices or add Yard queue slots.",
  robotsName: "AI Robots",
  robotsTag: "Builds structures faster",
  robotsRole:
    "Shortens everything in the Construction queue without affecting ships or ground guns",
  robotsDetail:
    "Shortens future Construction orders on all your worlds: buildings, instruments and satellites. It does not speed up ships or ground defences. Resource prices and queue capacity remain unchanged.",
  industrialName: "Industrial",
  industrialTag: "Repairs ships cheaper and faster",
  industrialRole:
    "Cuts the bill and the time of every Repair Station job",
  industrialDetail:
    "Reduces ship repair cost and time on all your worlds. Level 1 uses 75% of normal cost and time; level 2 uses 50%. It does not speed up shipbuilding. Ships with 20% damage or less are already repaired free on landing.",
  holdsName: "Prospector Holds",
  holdsTag: "Mining craft carry more",
  holdsRole: "Raises every Prospector hold; the Derrick’s capacity bonus applies on top",
  holdsDetail:
    "Each level increases how much every Prospector can return with. The bonus multiplies with the Derrick satellite, and the third level opens a third Prospector slot on every world.",
  cargoName: "Cargo Holds",
  cargoTag: "Every hold carries more",
  cargoRole: "Increases cargo capacity for raids, world transfers and trade convoys. Asteroid mining uses Prospector Holds research.",
  cargoDetail:
    "Each level expands the hold of every mobile ship for raids and transfers between your worlds. Courier, Wayfarer, Atlas and Argosy also carry more in trade convoys. Prospectors use Prospector Holds instead.",

  engineeringName: "Starship Engineering",
  engineeringTag: "Opens advanced hull tiers",
  engineeringRole:
    "Engineering I opens Tier 3 hull permissions; Engineering II opens Tier 4. Individual hulls retain their system-research and Shipyard requirements.",
  engineeringDetail:
    "Level 1 satisfies the engineering requirement for Tier 3 hulls. Level 2 does the same for Tier 4. Individual hulls may also need Power, Armor, Propulsion or Gravitic Charges. Their Shipyard level requirements still apply.",
  powerName: "Ship Power",
  powerTag: "Raises warship attack",
  powerRole:
    "Increases the attack of every warship in your fleet and satisfies advanced offensive build gates. Cargo hulls and ground defence are unaffected.",
  powerDetail:
    "Each level increases normal attack for all warships, including the Nullifier. Ships you already own also benefit. Transports gain no attack; ground defences, Prospectors and probes are unaffected. Attackers use their launch-time research level; defenders use their battle-time level.",
  armorName: "Ship Armor",
  armorTag: "Raises ship hull strength",
  armorRole:
    "Increases hull strength for every ship in your fleet, transports included, and satisfies advanced defensive build gates.",
  armorDetail:
    "Each level increases hull strength for all fleet ships, including transports. Ground defences, Prospectors and probes are unaffected. Attackers use their launch-time research level; defenders use their battle-time level.",
  propulsionName: "Ship Propulsion",
  propulsionTag: "Raises fleet speed",
  propulsionRole:
    "Increases the speed of every ship in your fleet and contributes to the Atlas gate. It opens after Dense Fuel Cells.",
  propulsionDetail:
    "Each of four levels adds 25% of base ship speed. The final level doubles base speed. A mixed fleet uses its slowest ship’s speed. Prospectors and probes are unaffected. The increase applies to missions launched after research finishes.",
  groundDoctrineName: "Emplacement Doctrine",
  doctrineTag: "Improves ground defence",
  doctrineRole:
    "Raises attack and hull strength for Bastion, Harpoon and Thorn. Ground capacity, salvage and class matchups remain unchanged.",
  groundDoctrineDetail:
    "Increases attack and hull strength for Bastion, Harpoon and Thorn on all your worlds. Ground capacity and salvage rules remain unchanged. Defenders use the research level held when battle begins.",

  gridName: "Interception Grid",
  gridTag: "Four interceptor charges per world",
  gridRole: "Raises the interceptor charges each of your worlds can hold from 2 to 4.",
  gridDetail: "Raises each world’s interceptor charge limit from 2 to 4. Loading charges requires Uplink and Radar 3 on that world. A charge destroys one Death Star identified in Telescope sight or caught at a timed Radar interception ring. Sensors must be operational. Each interception consumes one charge.",
  stockpileName: "Strategic Stockpile",
  stockpileTag: "Two Death Stars per world",
  stockpileRole: "Raises the Death Stars each of your worlds can hold from 1 to 2. The second starts once the first is finished.",
  stockpileDetail: "Without research every world holds 1 Death Star; this makes it 2 on each world, not across your whole empire. The second costs the full price and the full build time, and is built after the first. Striking from several worlds at once is how a strike gets past a defender's charges.",
} as const;
