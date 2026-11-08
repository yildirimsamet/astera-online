/** The colony ship's screens. `docs/ux-writing.md` applies. */
export const starter = {
  "advice": {"open": "Other choices", "title": "What next, Commander?", "recommended": "Recommended", "close": "Close", "fuel": "Load fuel", "huntProbe": "Probe the outposts", "huntDecide": "Compare the guards"},
  "visual": {"probe": "Probe", "mine": "Mine", "crate": "Salvage", "collect": "Collect", "waiting": "In flight", "galaxy": "Main galaxy"},
  "dossier": {"surfaceGapLabel": "Everything about this ship", "surfaceGapMissing": "You have never seen this ship", "surfaceGapWhy": "You cannot see who flies it, how far its repairs have come or what it carries. A probe brings all of it back at once.", "probeGapAged": "Your reading of this ship has aged out", "probeGapWhy": "You are about to bet a fleet on what is aboard. A probe turns that guess into a range.", "fleetGapWhy": "The single most valuable fact in the game: a fleet that is away cannot defend its ship.", "fleetGapRange": "Reaches {{reach}}; this ship is {{distance}} away"},
  "reports": {"guardDown": "The guard is down. The outpost stands open for {{time}}: another fleet can take what is left.", "outpost": "an abandoned outpost", "pirates": "pirates", "attackedShip": "Attacked ship: {{planet}}", "walkover": "No defending units stood on your ship, so the available loot was open to the raiders.", "cargoLimited": "Your holds were full. There was more there than you could carry. Bring Courier transports.", "landing": "Survivors return to the hangar with their wounds. Send them to the Repair Station yourself.", "walkoverBody": "No defending units stood on your ship. The attacking fleet could take the available loot without a fight.", "noGroundNote": "This ship had no wall standing when you arrived.", "piratesName": "Pirates", "aegisNote": "The Aegis takes damage before any defending unit does.", "whyStrong": "Your {{ships}} outclassed the {{guard}} guard ({{mult}}).", "whyWeak": "Your {{ships}} were outclassed by the {{guard}} guard ({{mult}}). Against it, send {{answer}}.", "whyEven": "Your {{ships}} and the {{guard}} guard were even ({{mult}}): numbers and strength decided it. {{answer}} has the edge on it.", "rebuild": "Lost {{ships}}: building them again costs {{alloy}} alloy, {{crystal}} crystal and {{time}}. Your progress stands.", "beatenBy": "{{name}} got there first: the guard was already down when your fleet landed, so this is no victory. You took what was left.", "firstVictory": "Your first win: the victory crate is waiting at the Shipyard.", "whyWon": "Why you won"},
  "fleetPage": {"roomRule": "Room for every ship this ship carries — home, away and in the yard. A full Hangar stops the yard; a recalled fleet always fits.", "bays": "Attack bays", "openStation": "Open the Repair Station", "emptyAir": "Nothing in the air. Tap a ship, a rock or an outpost on the galaxy to send ships."},
  "handbook": {"title": "Handbook", "replay": "See the first minutes again", "repairs": {"title": "Repairs open everything", "body": "Each repair opens the next system. One runs at a time, and it carries on while you are away."}, "holds": {"title": "Machines hold what they make", "body": "Production waits in the Works until you collect it into the Store. A Prospector's haul lands in the Works too, and what finds no room is lost. What is in the hold can be raided."}, "sight": {"title": "Look before you fly", "body": "A probe's report is a fixed moment. The older it gets, the less it tells you about now."}, "fleets": {"title": "A fleet away is safe, a ship is not", "body": "Ships in flight cannot be raided. Your colony ship and whatever is at home can."}, "jump": {"title": "The jump is the goal", "body": "Finish the Drive, load the fuel and carry the parts, and you land in the main galaxy with your cargo. There is no way back."}, "crates": {"title": "Salvage crates", "body": "Certain repairs, and your first decisive outpost win, free salvage crates. In the ship screen, hold a crate lid to open every ready crate. Each pays alloy and crystal into the store once. These resources can be raided and still obey the jump’s 2,000 alloy / 1,000 crystal cargo limit."}},
  "prologue": {"progress": "Step {{step}} of {{total}}", "skip": "Skip", "signIn": "Sign in", "close": "Close", "alloy": "Alloy {{value}}", "crystal": "Crystal {{value}}", "refinery": "Refinery", "feed": "Sensor line", "action": {"power": "Connect reserve power", "burn": "Start the refinery", "collect": "Collect", "patch": "Patch the sensor line"}, "dark": {"title": "Your ship is dark.", "body": "The reef broke up the fleet and threw you here. That light ahead is the galaxy you set out for."}, "powered": {"title": "Reserve power holds.", "body": "All five systems are damaged. The cold store still has {{crystal}} crystal. Every repair costs alloy, so the refinery comes first."}, "burning": {"title": "The furnace is catching.", "body": "The first batch runs on the last of the fuel lines."}, "batch": {"title": "First batch: {{alloy}} alloy.", "body": "A refinery holds what it makes until you empty it."}, "collected": {"title": "The sensors are blind.", "body": "You cannot see who else came through. A patch on the line would give them one ear back."}, "patching": {"title": "Patching the line…", "body": "Your first repair. The real ones run while you sleep."}, "signal": {"mark": "Unknown signal", "title": "Something answered.", "body": "Far out, and the antenna is too broken to read it. The drive has one short hop left.", "replayBody": "Far out, and the antenna was too broken to read it. You know the rest.", "replayAction": "Back to the game", "go": "Fly to the signal"}, "hint": {"hold": "Hold until it catches", "weld": "Hold to weld", "claim": "Hold to begin"}, "warping": {"title": "Jumping…"}, "found": {"title": "This ship can be yours.", "body": "Adrift past the shoals, furnace lit, one ear patched. Make it yours and the adventure begins.", "action": "Take the helm"}, "claim": {"title": "This ship can be yours.", "ship": "this ship", "intro": "Your ship starts with {{alloy}} alloy, {{crystal}} crystal and a working refinery. Repairs carry on while you are away."}},
  "chatRoom": "Galaxy channel",
  "away": {"fell": "{{name}} has fallen", "crateReady": "Your victory crate is ready at the Shipyard.", "beaten": "{{by}} reached {{name}} first", "details_one": "Details ({{count}})", "details_other": "Details ({{count}})", "online": "Back online while you were away: {{systems}}", "lost": "{{value}} found no room", "fleetHome": "Fleet home", "fleetHomeDetail_one": "+{{resources}} resources · {{count}} ship", "fleetHomeDetail_other": "+{{resources}} resources · {{count}} ships", "haulAlloy": "+{{value}} alloy", "haulCrystal": "+{{value}} crystal", "haulDeuterium": "+{{value}} deuterium", "ships_one": "{{count}} ship", "ships_other": "{{count}} ships", "toShip": "Go to the ship"},
  "launchFleetsave": "Ships in flight cannot be raided. Your ship can.",
  "contact": {"scout": "Pirate scout", "scoutDetail": "It is looking, not fighting. Next time it may not be alone.", "raid": "Pirate raid"},
  "outpostGuide": "Go to the {{name}} outpost",
  "outpostReading": {"guard": "Guard", "none": "No guard", "unread": "Classes unread", "even": "Classes even", "most": "most of it", "beats": "› beats the next · ↺ {{last}} › {{first}}", "carry": "You can carry", "stock": "{{band}} in stock", "crate": "Your first decisive win opens a crate"},
  "outpost": {"title": "Abandoned outpost", "rule": "Beat its guard to take up to {{amount}} resources; your ships can carry {{carry}}. It refills in 6 hours.", "label": "Outpost · level {{level}}"},
  "readout": {"ships": "{{count}} ships", "outposts": "{{count}} outposts", "level": "Guard level {{level}}", "firstHunt": "First hunt · {{level}}"},
  "lab": {"premise": "This research stays with the ship. It does not come along to the main galaxy.", "holdsRole": "Increases Prospector cargo capacity.", "queue": "Ship research", "queueHint": "The ship works one project at a time. Repairs and the Shipyard keep running separately.", "idleHint": "Pick a star on the map.", "queueFull": "The ship works one project at a time. Wait for this one to finish."},
  "deck": {"label": "Ship decks", "repairs": "Repairs", "yard": "Shipyard", "research": "Research"},
  "yard": {"against": "Against", "queue": "Yard queue", "dockRule": "The Station charges {{percent}}% of the main price.", "dockHurt": "{{count}} ships need the Station", "dockGo": "Repair {{count}} ships"},
  "board": {"title": "Departures", "empty": "Nobody has made the jump yet. You could be first.", "ago": "{{time}} ago"},
  "mainRow": {"facts": "{{worlds}} worlds. The season ends in {{days}} days.", "waiting": "A new season is on its way.", "repair": "Repair the drive to jump there. Nothing else crosses the gap.", "ready": "Your ship is ready. Open the Drive to jump.", "eyebrow": "Your destination", "story": "Where the fleet was bound before the reef broke it up. The real journey starts here: worlds to hold, rivals, clans, a season to win.", "legRepair": "Ready to leave", "legFuel": "Jump fuel", "go": "Go to the ship"},
  "plan": {"title": "Departure plan", "done": "Repaired", "queued": "Queued · done in {{time}}", "open": "Can be repaired · takes {{time}}", "waiting": "Waits for {{what}}", "fuelAt": "{{have}}/{{needed}} aboard · full in {{time}}", "fuelNow": "{{have}}/{{needed}} aboard · enough for the jump", "fuelNoPlant": "{{have}}/{{needed}} aboard · {{name}} starts the flow", "lever": "With {{name}} 2: full in {{time}}", "flights": "Times hold if no Deuterium is flown.", "waitsFuel": "The fuel is what holds the jump.", "waitsEngines": "The engines are what hold the jump: the fuel is in first.", "optional": "{{count}} optional repairs left. They help only aboard: your capital starts with its own buildings."},
  "outlook": {"noFrontier": "No galaxy has room right now. Your ship plays on here, and the jump opens when a place does.", "seasonClosed": "This season takes no more ships: it ends in {{days}} days. Your ship lands in the next season, and a ready ship hears when it opens. Until then, outposts and repairs still pay here.", "seasonLate": "This season stops taking ships in {{time}}, before your plan is done: the ship lands in the next season. Ready sooner, it lands in this one."},
  "arrival": {"carried": "Came down with you", "package": "First season start", "total": "Yours to use", "ships": "{{count}} ships", "decide": "Your first move", "outward": "Plan a first sortie", "outwardLine": "Your fleet and {{deuterium}} Deuterium are ready. Probe a target first.", "grow": "Open Deuterium output", "growLine": "Here your Deuterium output is zero. Research {{research}}, then build the {{plant}}: it feeds your flights."},
  "readyLabel": "Ready to leave",
  "wholeShip": "All systems {{done}}/{{total}}",
  "jump": {"panel": "The jump", "parts": "Thrust parts", "partsHint": "Wrecks and guarded outposts hold them. Whoever gets there first takes the part.", "tank": "Fuel tank", "tankLocked": "The tank connects with the thrust assembly and Deuterium plant 2.", "tankHint": "The jump burns {{needed}} Deuterium. Flights draw on the same stock.", "load": "Load {{amount}}", "loadAll": "Load all", "go": "Prepare the jump", "title": "Jump to {{name}}", "addresses": "Where to land", "neighbours": "Worlds near: {{count}}", "tone": {"quiet": "Quiet", "mixed": "Between", "busy": "Crowded"}, "toneNote": {"quiet": "Safer. Targets are far.", "mixed": "Some of both.", "busy": "Targets close, and you are one."}, "cargo": "The hold takes down", "package": "You also get the first season start and a 72 hour shield.", "carryMost": "A jump carries at most {{alloy}} alloy, {{crystal}} crystal, {{deuterium}} Deuterium and {{ships}} ships.", "left": "Stays behind and is lost: {{alloy}} alloy, {{crystal}} crystal, {{deuterium}} Deuterium, {{ships}} ships.", "warn": "The ship is spent on this jump. Resources and ships outside the hold are lost.", "hold": "Jump", "leaving": "Leaving…", "replay": "Watch again", "skip": "Skip", "scene": {"lit": "Drive lit", "leaving": "Leaving the shoals", "gap": "Crossing the gap", "fall": "{{name}}", "world": "Your world"}, "partsSeen": "Your scanners show {{count}} places. They are marked on the map.", "partsLater": "They show on the map once the drive hull can be repaired.", "partsNone": "None in sight: send a probe to a wreck or an outpost.", "partHere": "A thrust part is here. First to arrive takes it."},
  "landing": {"dismiss": "Dismiss", "title": "You landed in {{name}}", "go": "To my world", "line": {"battle": "Battles are twice as hard now, and Aegis is at full strength.", "shield": "Your shield lasts 72 hours.", "absence": "Stay away for 3 days and your planet is deleted.", "core": "The Core sets your world's tier.", "opened": "Clan and the leaderboards are open.", "alerts": "Phone alerts now come from the Notification Center."}, "tip": {"core": "The Core sets your tier. You can only raid close to it, and be raided the same way.", "colony": "You can hold up to three colonies. Neutral worlds open for a short claim.", "clan": "A clan shares intel and defends together. Look at the Clan tab.", "dominion": "Dominion ranks who holds the most. It pays out at the end of the season.", "honor": "Honor ranks who fights fair. Raiding a weaker fleet earns little."}},
  "shieldNote": "Ship shields start every battle full. Hull wounds stay until the Repair Station mends them.",
  "tempoNote": "Damage and Aegis are half here. In the main galaxy the same battle runs twice as fast.",
  "intel": {"blind": "You cannot see into a single ship", "openShip": "Open ship", "telescopeGives": "Shows whether a fleet has left the ship you watch. Before a raid, weigh how old the reading is and what stayed behind.", "telescopeCost": "Repair the Telescope on your ship.", "idleHint": "Idle slots: {{count}}. Pick a ship on the map and point one at it.", "scarcity": "Ships out there: {{neighbours}}. Your slots: {{count}}. Moving one costs a cooldown, so choose who.", "radarGives": "Shows movement in range and when a threat aimed at your ship arrives. It can detect probes; detection is not guaranteed.", "radarCost": "Repair the Radar on your ship.", "nextSlot": "Repair {{level}}", "oneMore": "Telescope repair {{level}} would watch one more.", "radarLevel": "Radar · repair {{level}}", "radarFleets": "Radar repair {{level}} separates a threat aimed at you at {{sense}} units, without a clock. At {{warn}} units it adds arrival time.", "radarFleetsOne": "Radar repair {{level}} shows moving craft out to {{sense}} units, and marks a threat aimed at your ship with its arrival time.", "radarBearing": " Repair 2 adds the direction they came from.", "radarQuiet": "No scans detected. Your Radar is on.", "scaleNote": "Each bar runs from zero: the band is their estimate, the teal line is your ship.", "home": "Fly to your ship"},
  "news": {"victoryCrateOpened": "Victory crate opened: +{{alloy}} alloy, +{{crystal}} crystal.", "crateOpened_one": "Salvage crate opened: +{{alloy}} alloy, +{{crystal}} crystal.", "crateOpened_other": "{{count}} salvage crates opened: +{{alloy}} alloy, +{{crystal}} crystal.", "mineHome_one": "Your Prospector is back with {{brought}}: all of it is in the works.", "mineHome_other": "Your {{count}} Prospectors are back with {{brought}}: all of it is in the works.", "mineLost_one": "Your Prospector is back with {{brought}}: {{landed}} went into the works, {{lost}} found no room and was lost.", "mineLost_other": "Your {{count}} Prospectors are back with {{brought}}: {{landed}} went into the works, {{lost}} found no room and was lost.", "mineEmpty_one": "Your Prospector is back empty: there was nothing left to take.", "mineEmpty_other": "Your {{count}} Prospectors are back empty: there was nothing left to take.", "minePart": "It found a thrust part too.", "repairDone": "{{name}} repaired.", "probeReport": "Probe report from {{name}}.", "probeDetected": "A probe scanned your ship.", "radarPast": "Radar: a fleet arrived.", "shieldPast": "Your shield dropped.", "radar": "Radar: a fleet arrives in {{time}}.", "raidOver": "Your raid on {{name}} is over. Read the report.", "firstVictory": "{{name}} has fallen! Your victory crate is ready at the Shipyard.", "beatenBy": "{{by}} reached {{name}} before you: the guard was already down. Read the report.", "attacked": "{{name}} attacked your ship. Read the report.", "fleetHome": "Your fleet is back.", "fleetHomePart": "Your fleet is back with a thrust part.", "turnedBack": "The target was out of reach. Your fleet is turning back.", "yardDone": "Shipyard: {{count}} {{name}} ready.", "researchDone": "{{name}} reached level {{level}}.", "dockDone": "The Repair Station has finished. Your ships are sound.", "shieldWarning": "Your shield drops in {{time}}.", "seasonOpen": "A new season is open in {{name}}. Your ship can jump."},
  "reading": {"repairLabel": "Repairs", "repairNote": "How much of this ship is mended. The further along, the more it has built up, and the closer it is to leaving.", "unknownShip": "Unknown ship"},
  "systemShort": {"REFINERY": "Refinery", "SURVEY": "Survey", "DEFENCE": "Defence", "CARGO": "Cargo", "DRIVE": "Drive"},
  "systemsLabel": "Ship systems",
  "locked": "locked",
  "perHour": "/h",
  "moreRepairs": "More repairs", "nextRepairs": "Repairs",
  "slots": "Work slots",
  "stepState": {"done": "repaired", "queued": "in queue", "closed": "locked", "open": "ready"},
  "quiet": {"warn": "Repair within {{time}}, or your ship gives up its place in this galaxy.", "asleep": "Your ship gave up its place after {{hours}} hours with no repair. Start a repair to take one again."},
  "queue": {"title": "Repair queue"},
  "eyebrow": "Colony ship",
  "goal": "Repair every system, fill the fuel tank and jump to the main galaxy.",
  "next": "Next",
  "tutorial": {"skip": {"link": "I don't need the guide", "title": "Close the guide?", "body": "Are you sure you want to close the guide? The officer will no longer guide you. You can turn the guide back on from Academy in the menu. Your game continues where you left off.", "keep": "Continue with guide", "close": "Close guide", "again": "Turn the guide back on", "againHint": "The scout officer walks with you again"}, "inspect": "Inspect the flight", "chapter": {"1": "Waking up", "2": "First repairs", "3": "Eyes open", "4": "The first probe", "5": "The yard", "6": "The first haul", "7": "Telescope", "8": "Radar warnings", "9": "The road to the main galaxy"}, "next": "Next", "reveal": "Show full message", "away": "I'll call you when it is done, around {{clock}}. Until then, look around your ship and the galaxy.", "ok": "OK", "back": "Back in {{time}}", "reopen": "Show the guide", "nav": {"openShip": "Open the ship: tap {{base}}.", "closePage": "Close this page. The next job is out on the galaxy.", "dismissUnlock": "A system just came online. Read its card, then close it to continue."}, "line": {"online": "Commander, the radio works! This ship is yours now, and its refinery is waking up. Tap {{try}} on the card.", "collect": "Alloy is the metal that repairs the ship. What the refinery made waits in the works: tap the works line in the top bar to store it.", "orderRefinery": "Every repair is paid in alloy and crystal. First the {{name}}, so alloy comes faster. Tap {{repair}}.", "waitFirst": "This takes five seconds. Big repairs keep going while you are away.", "firstCrate": "The repair unsealed a bay. Hold the crate: what is inside is yours.", "openIntel": "The report is in. Tap the {{intel}} tab at the bottom.", "openReport": "Everything we know is listed here. Tap the ship we probed to open its report.", "report": "Here is the probe's report. The lit part is what a win could carry off; below it, the ships she has. We never send a fleet without reading this first.", "farewell": "Your ship is {{percent}}% repaired. To fly to the main galaxy you have to finish the job. What to do is on the Next line.", "mine": "The telescope is open, and those are rocks! There is ore in them: send your Prospector to the nearest one.", "collectMine": "The Prospector is home with a load! It is in the works: collect it from the top bar.", "telescopeLook": "This is your telescope’s field of view. Turn the view to look around it.", "telescopeRing": "There is a flight inside your telescope’s ring. The ring is what you can see: every ship and fleet inside it is named.", "telescopeTraffic": "Touch the flight: read whose it is and where it is going.", "telescopeTrack": "Look: the flight has left the ring, and you still see its course. A flight you have named once is followed to its end.", "radarRing": "Your radar has caught something! The green ring is its reach: it picks up flights your telescope cannot see.", "radarContact": "A ? means movement of an unknown kind. An incoming fleet appears here before it reaches your ship.", "sightTrio": "The telescope has named the flight that entered its ring. A probe reads inside a target, the telescope names movement, the radar warns.", "openCrate": "Another crate is ready, with what the next job costs. Hold to open it.", "orderExtractor": "Crystal mends the delicate parts. The {{name}} makes it: tap {{repair}}.", "orderTelescope": "It is dark out there. The {{name}} will show us what is around: tap {{repair}}.", "orderRadar": "Next the {{name}}: it hears anything moving from far off. Tap {{repair}}.", "waitTelescope": "The telescope is opening. When it is done we will see what is out there.", "orderSurvey": "Your Prospector is on its way. Now the {{name}}, so we can read other ships. Tap {{repair}}.", "waitSurvey": "The antenna is coming up. Soon we can look at the ships out there.", "probe": "You are not alone: there are other ships around you. Send a probe to one and learn what it has.", "orderShipyard": "We will not last without ships. The {{name}} builds them: tap {{repair}}.", "waitYard": "The shipyard is going up. Watch your Prospector and your probe meanwhile.", "buildShip": "The yard works, and two ships are ready. Build one yourself: tap the lit ship."}, "push": "May I let you know when a repair ends and someone approaches your ship?", "allow": "Notify me", "later": "Later", "hint": "Need a heading? {{task}} Tap the next-step line for the way forward.", "dismiss": "Understood"},
  "outcome": {"DECISIVE": "Outpost taken", "PARTIAL": "Partial result", "REPELLED": "Repelled", "BEATEN": "Beaten to it", "beaten": "{{by}} got there first; the guard was already down. You took what was left.", "crate": "Your first win! Your victory crate is ready at the Shipyard.", "line": {"DECISIVE": "The guard is broken. Why you won is in the report.", "PARTIAL": "Part of the guard fell. What was missing is in the report.", "REPELLED": "The guard held. Why is in the report."}, "lost_one": "{{count}} ship lost", "lost_other": "{{count}} ships lost", "lootHome": "The loot lands in the store when the fleet is home.", "ok": "OK", "report": "Read the report", "openCrate": "Open the crate"},
  "objective": {"probe": "Probe the nearest ship. Tap to find it.", "mine": "Send a Prospector to the nearest asteroid. Tap to find it.", "underwayProbe": "Your probe is on its way. Its report lands in Intel.", "underwayMine": "The Prospector is out mining. It comes back by itself.", "restSave": "That is all for now. Back around {{clock}} for the {{name}}.", "restWait": "That is all for now. The repair is done around {{clock}}.", "repair": "Repair the {{name}}. Open the ship.", "collect": "Collect what the works made, from the top bar.", "save": "{{name}}: you can pay in about {{time}}.", "saveNever": "{{name}}: repair what makes the missing resource.", "wait": "A repair is under way. Ready in {{time}}.", "parts": "Find {{count}} thrust parts. Wrecks and guarded outposts hold them.", "fuel": "Load the fuel tank in the Drive.", "huntProbeMining": "The Prospector is on its way. Meanwhile there are two pirate outposts; we don’t attack without knowing their guards. Send a probe.", "huntProbe": "There are two pirate outposts; we don’t attack without knowing their guards. Send a probe.", "huntProbing": "The probes are on their way. We read the guards when they’re home.", "huntDecide": "The reports are in: compare the two guards, choose your ships.", "huntRaid": "Your fleet is flying to the outpost. The battle comes on arrival.", "crate": "Open the ready crate: it holds what the next repair costs."},
  "log": {"title": "Ship's log", "now": "Now", "go": "Go", "chapter": {"POWER": {"title": "Power", "line": "Reserve power holds. The ship is awake."}, "REFINERY": {"title": "Refinery", "line": "Makes alloy and crystal. Every repair is paid in them."}, "SURVEY": {"title": "Survey", "line": "The antenna: probes, reports and the Intel tab."}, "DEFENCE": {"title": "Defence", "line": "Aegis, telescope and radar: see raids coming and outlast them."}, "CARGO": {"title": "Cargo", "line": "Shipyard and hangar: your first ships and the Fleet tab."}, "DRIVE": {"title": "Drive", "line": "Thrust parts, the drive hull and fuel: the jump to the main galaxy."}}},
  "repair": "Repair",
  "stepCount": "Stage {{stage}} of {{total}}",
  "optional": "Optional · not counted in the repair %",
  "inQueue": "In queue",
  "systemAria": "{{name}}: {{done}} of {{total}} repairs, {{state}}",
  "needs": "Needs: {{what}}",
  "queueFull": "The repair queue holds {{count}}. Wait for one to finish.",
  "affordIn": "You can pay in about {{time}}.",
  "collectFirst": "Collect from the works in the top bar to pay for this.",
  "noIncome": "Nothing makes this resource yet. Repair what makes it.",
  "allQueued": "Every required repair is done or in the queue.",
  "allRepaired": "Every required repair is done.",
  "ordered": "{{name}}: repair ordered",
  "state": {
    "broken": "Broken",
    "damaged": "Damaged",
    "done": "Repaired"
  },
  "system": {
    "REFINERY": "Refinery module",
    "SURVEY": "Survey antenna",
    "DEFENCE": "Defence systems",
    "CARGO": "Cargo and hangar",
    "DRIVE": "Interstellar drive"
  },
  "module": {
    "SURVEY": "Survey antenna",
    "DRIVE_HULL": "Drive hull",
    "DRIVE_THRUST": "Thrust assembly"
  },
  "fact": {
    "FIRST_PROBE_REPORT": "your first probe report",
    "FIRST_MINING_RETURN": "your first mining return",
    "FIRST_BATTLE_REPORT": "your first battle report",
    "FIRST_OUTPOST_VICTORY": "your first outpost victory"
  },
  "factHow": {"FIRST_PROBE_REPORT": "Send a probe to a neighbouring ship.", "FIRST_MINING_RETURN": "Send a Prospector to an asteroid and wait for it to come back.", "FIRST_BATTLE_REPORT": "Raid an outpost, or meet the pirates once the Aegis is up. That battle's report counts.", "FIRST_OUTPOST_VICTORY": "Beat an outpost’s guard in a decisive win."},
  "attackLocked": "Attacking ships needs your own Aegis repaired and one battle behind you. With the Aegis up, your ship can be attacked too.",
  "aegisChoice": {"title": "Your choice", "hold": "Take the Aegis", "with": "With the Aegis", "withShield": "The shield takes the damage first.", "withPirates": "Pirates start coming.", "withNeighbours": "After {{hours}} h neighbours can attack you.", "withAttack": "After a battle you can attack ships too.", "without": "Without it", "withoutSafe": "Neither pirates nor neighbours can attack you.", "withoutOutposts": "You raid only outposts.", "withoutJump": "It is not needed to leave."},
  "outpostLocked": "Outpost raids open with the Shipyard. Repair it, and the ships it builds can raid here.",
  "partsNeeded": "{{count}} thrust parts",
  "effect": {
    "rate": {
      "alloy": "+{{amount}} alloy per hour",
      "crystal": "+{{amount}} crystal per hour",
      "deuterium": "+{{amount}} Deuterium per hour"
    },
    "ships": "Comes with {{ships}}",
    "deuterium": "Comes with {{amount}} Deuterium",
    "room": "Hangar room {{room}}",
    "storeCeiling": "Alloy store ceiling {{from}} → {{to}}",
    "telescope": "Telescope reach {{distance}}",
    "radar": "Radar reach {{distance}}",
    "aegis": "Aegis {{hp}}",
    "surveyBand": "Probes read a narrower range",
    "driveHull": "Carries the thrust assembly",
    "driveThrust": "Adds the fuel tank"
  },
  "feature": {
    "production": {
      "gain": "Opens production",
      "line": "The refinery makes alloy. Collect it from the top bar."
    },
    "intel": {
      "gain": "Opens probes",
      "line": "Neighbouring ships appear as dark points. A probe shows what one of them holds."
    },
    "fleet": {
      "gain": "Opens the fleet",
      "line": "You can build ships, send a Prospector to mine asteroids, raid outposts and mend damaged ships at the Repair Station."
    },
    "chat": {
      "gain": "Opens chat",
      "line": "You can talk to the other ships in this galaxy."
    },
    "salvage": {
      "gain": "Opens wreck fields",
      "line": "Wreck fields now show on the map. A Prospector can salvage them."
    },
    "research": {
      "gain": "Opens research",
      "line": "Research improves your ships and Prospector holds. It ends with this ship."
    },
    "telescope": {
      "gain": "Opens the Telescope",
      "line": "Inside its ring you can see other ships and their flights."
    },
    "radar": {
      "gain": "Opens the Radar",
      "line": "Inside its ring a flight shows as an unknown contact and warns you."
    },
    "defence": {
      "gain": "Opens defence",
      "line": "The Aegis absorbs damage first. Pirates and other ships can now attack this ship; after a battle, you can attack ships too."
    },
    "attack": {
      "gain": "Opens attacks",
      "line": "You can attack ships whose Aegis is up. They can attack yours too."
    },
    "deuterium": {
      "gain": "Opens Deuterium",
      "line": "Flights burn Deuterium, and this refinery makes it."
    },
    "drive": {
      "gain": "Opens the drive panel",
      "line": "Thrust parts now show on the map. The drive needs {{count}}."
    },
    "migration": {
      "gain": "Opens the jump",
      "line": "The tank is full. This ship can jump to the main galaxy."
    }
  },
  "funnel": {"title": "Starter journey", "sessions": "{{accounts}} accounts · {{sessions}} sessions · {{returned}} returned for a second session", "push": "Push: {{asked}} asked · {{granted}} allowed · {{denied}} declined", "crates": "Crates: {{opened}} opened by {{accounts}} accounts", "chain": "Order chain: {{accepted}} accounts gave an order → {{resolved}} got its result → {{viewed}} saw it → {{decided}} ordered again", "haul": "First mining return: {{returned}} accounts · {{gained}} with a net gain · {{wasted}} lost some to full works", "steps": "Steps and dropoff", "dropoff": "{{accounts}} reached · {{dropoff}} fewer than previous"},
  "crate": {"victory": "First victory crate", "title_one": "Salvage crate", "title_other": "{{count}} salvage crates", "hold": "Hold to open and take it", "open": "Open: {{purse}}"},
  "unlock": {
    "online": "{{system}} online",
    "try": "Try it",
    "later": "Later"
  },
  "tab": {
    "repair": "Repair the {{module}} to open this.",
    "mainGalaxy": "This opens in the main galaxy."
  }
};
