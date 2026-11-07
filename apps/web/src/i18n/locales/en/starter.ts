/** The colony ship's screens. `docs/ux-writing.md` applies. */
export const starter = {
  "visual": {"probe": "Probe", "mine": "Mine", "crate": "Salvage", "collect": "Collect", "waiting": "In flight", "galaxy": "Main galaxy"},
  "dossier": {"surfaceGapLabel": "Everything about this ship", "surfaceGapMissing": "You have never seen this ship", "surfaceGapWhy": "You cannot see who flies it, how far its repairs have come or what it carries. A probe brings all of it back at once.", "probeGapAged": "Your reading of this ship has aged out", "probeGapWhy": "You are about to bet a fleet on what is aboard. A probe turns that guess into a range.", "fleetGapWhy": "The single most valuable fact in the game: a fleet that is away cannot defend its ship.", "fleetGapRange": "Reaches {{reach}}; this ship is {{distance}} away"},
  "reports": {"guardDown": "The guard is down. The outpost stands open for {{time}}: another fleet can take what is left.", "outpost": "an abandoned outpost", "pirates": "pirates", "attackedShip": "Attacked ship: {{planet}}", "walkover": "No defending units stood on your ship, so the available loot was open to the raiders.", "cargoLimited": "Your holds were full. There was more there than you could carry. Bring Courier transports.", "landing": "Survivors return to the hangar with their wounds. Send them to the Repair Station yourself.", "walkoverBody": "No defending units stood on your ship. The attacking fleet could take the available loot without a fight.", "noGroundNote": "This ship had no wall standing when you arrived.", "piratesName": "Pirates", "aegisNote": "The Aegis takes damage before any defending unit does."},
  "fleetPage": {"roomRule": "Room for every ship this ship carries — home, away and in the yard. A full Hangar stops the yard; a recalled fleet always fits.", "bays": "Attack bays", "openStation": "Open the Repair Station", "emptyAir": "Nothing in the air. Tap a ship, a rock or an outpost on the galaxy to send ships."},
  "handbook": {"title": "Handbook", "replay": "See the first minutes again", "repairs": {"title": "Repairs open everything", "body": "Each repair opens the next system. One runs at a time, and it carries on while you are away."}, "holds": {"title": "Machines hold what they make", "body": "Production waits in the Works until you collect it into the Store. What is in the hold can be raided."}, "sight": {"title": "Look before you fly", "body": "A probe's report is a fixed moment. The older it gets, the less it tells you about now."}, "fleets": {"title": "A fleet away is safe, a ship is not", "body": "Ships in flight cannot be raided. Your colony ship and whatever is at home can."}, "jump": {"title": "The jump is the goal", "body": "Finish the Drive, load the fuel and carry the parts, and you land in the main galaxy with your cargo. There is no way back."}, "crates": {"title": "Salvage crates", "body": "Certain repairs free salvage crates. In the ship screen, hold a crate lid to open every ready crate. Each pays alloy and crystal into the store once. These resources can be raided and still obey the jump’s 2,000 alloy / 1,000 crystal cargo limit."}},
  "prologue": {"progress": "Step {{step}} of {{total}}", "skip": "Skip", "signIn": "Sign in", "close": "Close", "alloy": "Alloy {{value}}", "crystal": "Crystal {{value}}", "refinery": "Refinery", "feed": "Sensor line", "action": {"power": "Connect reserve power", "burn": "Start the refinery", "collect": "Collect", "patch": "Patch the sensor line"}, "dark": {"title": "Your ship is dark.", "body": "The reef broke up the fleet and threw you here. That light ahead is the galaxy you set out for."}, "powered": {"title": "Reserve power holds.", "body": "All five systems are damaged. The cold store still has {{crystal}} crystal. Every repair costs alloy, so the refinery comes first."}, "burning": {"title": "The furnace is catching.", "body": "The first batch runs on the last of the fuel lines."}, "batch": {"title": "First batch: {{alloy}} alloy.", "body": "A refinery holds what it makes until you empty it."}, "collected": {"title": "The sensors are blind.", "body": "You cannot see who else came through. A patch on the line would give them one ear back."}, "patching": {"title": "Patching the line…", "body": "Your first repair. The real ones run while you sleep."}, "signal": {"mark": "Unknown signal", "title": "Something answered.", "body": "Far out, and the antenna is too broken to read it. The drive has one short hop left.", "replayBody": "Far out, and the antenna was too broken to read it. You know the rest.", "replayAction": "Back to the game", "go": "Fly to the signal"}, "hint": {"hold": "Hold until it catches", "weld": "Hold to weld", "claim": "Hold to begin"}, "warping": {"title": "Jumping…"}, "found": {"title": "This ship can be yours.", "body": "Adrift past the shoals, furnace lit, one ear patched. Make it yours and the adventure begins.", "action": "Take the helm"}, "claim": {"title": "This ship can be yours.", "ship": "this ship", "intro": "Your ship starts with {{alloy}} alloy, {{crystal}} crystal and a working refinery. Repairs carry on while you are away."}},
  "chatRoom": "Galaxy channel",
  "away": {"fleetHome": "Fleet home", "fleetHomeDetail_one": "+{{resources}} resources · {{count}} ship", "fleetHomeDetail_other": "+{{resources}} resources · {{count}} ships", "haulAlloy": "+{{value}} alloy", "haulCrystal": "+{{value}} crystal", "haulDeuterium": "+{{value}} deuterium", "ships_one": "{{count}} ship", "ships_other": "{{count}} ships", "toShip": "Go to the ship"},
  "launchFleetsave": "Ships in flight cannot be raided. Your ship can.",
  "contact": {"scout": "Pirate scout", "scoutDetail": "It is looking, not fighting. Next time it may not be alone.", "raid": "Pirate raid"},
  "outpost": {"title": "Abandoned outpost", "rule": "Beat its guard to take up to {{amount}} resources. It refills in 6 hours.", "label": "Outpost · level {{level}}"},
  "readout": {"ships": "{{count}} ships", "outposts": "{{count}} outposts", "level": "Guard level {{level}}"},
  "lab": {"premise": "This research stays with the ship. It does not come along to the main galaxy.", "holdsRole": "Increases Prospector cargo capacity.", "queue": "Ship research", "queueHint": "The ship works one project at a time. Repairs and the Shipyard keep running separately.", "idleHint": "Pick a star on the map.", "queueFull": "The ship works one project at a time. Wait for this one to finish."},
  "deck": {"label": "Ship decks", "repairs": "Repairs", "yard": "Shipyard", "research": "Research"},
  "yard": {"queue": "Yard queue", "dockRule": "The Station charges {{percent}}% of the main price.", "dockHurt": "{{count}} ships need the Station", "dockGo": "Repair {{count}} ships"},
  "board": {"title": "Departures", "empty": "Nobody has made the jump yet. You could be first.", "ago": "{{time}} ago"},
  "mainRow": {"facts": "{{worlds}} worlds. The season ends in {{days}} days.", "waiting": "A new season is on its way.", "repair": "Repair the drive to jump there. Nothing else crosses the gap.", "ready": "Your ship is ready. Open the Drive to jump.", "eyebrow": "Your destination", "story": "Where the fleet was bound before the reef broke it up. The real journey starts here: worlds to hold, rivals, clans, a season to win.", "legRepair": "Ship repaired", "legFuel": "Jump fuel", "go": "Go to the ship"},
  "jump": {"panel": "The jump", "parts": "Thrust parts", "partsHint": "Wrecks and guarded outposts hold them. Whoever gets there first takes the part.", "tank": "Fuel tank", "tankLocked": "The tank connects with the thrust assembly and Deuterium plant 2.", "tankHint": "The jump burns {{needed}} Deuterium. Flights draw on the same stock.", "load": "Load {{amount}}", "loadAll": "Load all", "go": "Prepare the jump", "title": "Jump to {{name}}", "addresses": "Where to land", "neighbours": "Worlds near: {{count}}", "tone": {"quiet": "Quiet", "mixed": "Between", "busy": "Crowded"}, "toneNote": {"quiet": "Safer. Targets are far.", "mixed": "Some of both.", "busy": "Targets close, and you are one."}, "cargo": "The hold takes down", "package": "You also get the first season start and a 72 hour shield.", "carryMost": "A jump carries at most {{alloy}} alloy, {{crystal}} crystal, {{deuterium}} Deuterium and {{ships}} ships.", "left": "Stays behind and is lost: {{alloy}} alloy, {{crystal}} crystal, {{deuterium}} Deuterium, {{ships}} ships.", "warn": "The ship is spent on this jump. Resources and ships outside the hold are lost.", "hold": "Jump", "leaving": "Leaving…", "replay": "Watch again", "skip": "Skip", "scene": {"lit": "Drive lit", "leaving": "Leaving the shoals", "gap": "Crossing the gap", "fall": "{{name}}", "world": "Your world"}, "partsSeen": "Your scanners show {{count}} places. They are marked on the map.", "partsLater": "They show on the map once the drive hull can be repaired.", "partsNone": "None in sight: send a probe to a wreck or an outpost.", "partHere": "A thrust part is here. First to arrive takes it."},
  "landing": {"dismiss": "Dismiss", "title": "You landed in {{name}}", "go": "To my world", "cargo": "Came down with you: {{alloy}} alloy, {{crystal}} crystal, {{deuterium}} Deuterium", "line": {"battle": "Battles are twice as hard now, and Aegis is at full strength.", "shield": "Your shield lasts 72 hours.", "absence": "Stay away for 3 days and your planet is deleted.", "core": "The Core sets your world's tier.", "opened": "Clan and the leaderboards are open.", "alerts": "Phone alerts now come from the Notification Center."}, "tip": {"core": "The Core sets your tier. You can only raid close to it, and be raided the same way.", "colony": "You can hold up to three colonies. Neutral worlds open for a short claim.", "clan": "A clan shares intel and defends together. Look at the Clan tab.", "dominion": "Dominion ranks who holds the most. It pays out at the end of the season.", "honor": "Honor ranks who fights fair. Raiding a weaker fleet earns little."}},
  "shieldNote": "Ship shields start every battle full. Hull wounds stay until the Repair Station mends them.",
  "tempoNote": "Damage and Aegis are half here. In the main galaxy the same battle runs twice as fast.",
  "intel": {"blind": "You cannot see into a single ship", "openShip": "Open ship", "telescopeGives": "Shows whether a fleet has left the ship you watch. Before a raid, weigh how old the reading is and what stayed behind.", "telescopeCost": "Repair the Telescope on your ship.", "idleHint": "Idle slots: {{count}}. Pick a ship on the map and point one at it.", "scarcity": "Ships out there: {{neighbours}}. Your slots: {{count}}. Moving one costs a cooldown, so choose who.", "radarGives": "Shows movement in range and when a threat aimed at your ship arrives. It can detect probes; detection is not guaranteed.", "radarCost": "Repair the Radar on your ship.", "nextSlot": "Repair {{level}}", "oneMore": "Telescope repair {{level}} would watch one more.", "radarLevel": "Radar · repair {{level}}", "radarFleets": "Radar repair {{level}} separates a threat aimed at you at {{sense}} units, without a clock. At {{warn}} units it adds arrival time.", "radarFleetsOne": "Radar repair {{level}} shows moving craft out to {{sense}} units, and marks a threat aimed at your ship with its arrival time.", "radarBearing": " Repair 2 adds the direction they came from.", "radarQuiet": "No scans detected. Your Radar is on.", "scaleNote": "Each bar runs from zero: the band is their estimate, the teal line is your ship.", "home": "Fly to your ship"},
  "news": {"repairDone": "{{name}} repaired.", "probeReport": "Probe report from {{name}}.", "probeDetected": "A probe scanned your ship.", "radarPast": "Radar: a fleet arrived.", "shieldPast": "Your shield dropped.", "radar": "Radar: a fleet arrives in {{time}}.", "raidOver": "Your raid on {{name}} is over. Read the report.", "attacked": "{{name}} attacked your ship. Read the report.", "fleetHome": "Your fleet is back.", "fleetHomePart": "Your fleet is back with a thrust part.", "turnedBack": "The target was out of reach. Your fleet is turning back.", "yardDone": "Shipyard: {{count}} {{name}} ready.", "researchDone": "{{name}} reached level {{level}}.", "dockDone": "The Repair Station has finished. Your ships are sound.", "shieldWarning": "Your shield drops in {{time}}.", "seasonOpen": "A new season is open in {{name}}. Your ship can jump."},
  "reading": {"repairLabel": "Repairs", "repairNote": "How much of this ship is mended. The further along, the more it has built up, and the closer it is to leaving.", "unknownShip": "Unknown ship"},
  "systemShort": {"REFINERY": "Refinery", "SURVEY": "Survey", "DEFENCE": "Defence", "CARGO": "Cargo", "DRIVE": "Drive"},
  "systemsLabel": "Ship systems",
  "locked": "locked",
  "perHour": "/h",
  "moreRepairs": "More repairs", "nextRepairs": "Repairs",
  "slots": "Work slots",
  "stepState": {"done": "repaired", "queued": "in queue", "closed": "locked", "open": "ready"},
  "repairedLabel": "Repaired",
  "quiet": {"warn": "Repair within {{time}}, or your ship gives up its place in this galaxy.", "asleep": "Your ship gave up its place after {{hours}} hours with no repair. Start a repair to take one again."},
  "queue": {"title": "Repair queue"},
  "eyebrow": "Colony ship",
  "goal": "Repair every system, fill the fuel tank and jump to the main galaxy.",
  "next": "Next",
  "tutorial": {"skip": {"link": "I don't need the guide", "title": "Close the guide?", "body": "Are you sure you want to close the guide? The officer will no longer guide you. Your game continues where you left off.", "keep": "Continue with guide", "close": "Close guide"}, "chapter": {"1": "Waking up", "2": "First repairs", "3": "The antenna", "4": "The first probe", "5": "The first fleet", "6": "The first haul", "7": "Telescope", "8": "Radar warnings"}, "next": "Next", "reveal": "Show full message", "away": "I'll call you when it is done, around {{clock}}. Until then, look around your ship and the galaxy.", "ok": "OK", "back": "Back in {{time}}", "reopen": "Show the guide", "nav": {"openShip": "Open the ship: tap {{base}}.", "closePage": "Close this page. The next job is out on the galaxy.", "dismissUnlock": "A system just came online. Read its card, then close it to continue."}, "line": {"lookAround": "Welcome aboard, Commander! This ship is yours now. Drag the screen to look at her from every side, and at the space around her.", "welcome": "Commander, the radio works! I'm the fleet's scout officer. The reef scattered the fleet, but this ship is yours now. I'll stay on the line until she flies. First, let's see what we have.", "online": "The refinery is running again. That means alloy for repairs. Tap {{try}} on the card.", "collect": "What the refinery made waits in the works. To spend it, move it into the store: tap the works line in the top bar.", "orderRefinery": "Every repair is paid in alloy and crystal. First the {{name}}: the stronger it is, the faster everything goes. Tap {{repair}}.", "orderExtractor": "We need crystal too. Queue the {{name}} as well; the repair queue carries three jobs at once.", "waitFirst": "Repairs run by themselves. These two take ten seconds; the big ones take hours and keep going while you are away.", "firstCrate": "The repair unsealed a bay, and there is a salvage crate inside, full of alloy and crystal. It is all yours. Hold the crate to open it.", "orderAntenna": "Now let us open our ears. Switch to the {{tab}} tab and repair the {{name}}: only with it can we see the ships around us.", "orderExtractor2": "No standing still while the antenna is fixed. Back to the {{tab}} tab: raise the {{name}} one more stage.", "waitAntenna": "The antenna is ready in thirty seconds. Then we see who else is out here.", "intelOnline": "The antenna works! Nearby ships are on the map now. Tap {{try}} and I will take you to the closest one.", "probe": "That is a neighbouring ship. We do not know what it holds. Send a probe: it flies there, measures and reports back.", "probeFlying": "The probe is on its way. It takes its readings there and flies home; the report comes back with it.", "openIntel": "The report is in. Tap the {{intel}} tab at the bottom.", "openReport": "Everything we know is listed here. Tap the ship we probed to open its report.", "report": "Here is the probe's report. The lit part is what a win could carry off; below it, the ships she has. We never send a fleet without reading this first.", "farewell": "Your first haul is aboard. {{underway}} The next repair can be paid in about {{time}}. I will leave the controls with you. The next-step line will guide you.", "welcomeBack": "Welcome back, Commander! The works filled up while you were away. Collect it, and let us carry on where we left off.", "collectAgain": "Tap the works line and move what piled up into the store.", "orderRefinery3": "Repair the {{name}} again. More alloy means we can restore the Shipyard. This takes {{time}}.", "finale": "Now you know the way. The line at the bottom always names the next step. Big repairs take hours: come back between them, collect and carry on. The main galaxy is waiting for you.", "openCrates": "The repairs freed salvage crates. Hold the lid to open them. Their alloy and crystal pay for our next repairs.", "orderVault": "Queue the {{name}} too. It gives the ship more room for resources.", "waitRefinery": "The refinery is warming up. Its next crate pays for the Shipyard.", "openRefineryCrate": "The refinery is ready. Hold the crate to open it: we need its cargo to restore the Shipyard.", "orderShipyard": "Open the {{tab}} tab and repair the {{name}}. It comes with our first Prospector and two Darts.", "orderExtractor3": "The Shipyard is working. Queue the {{name}} before our first flight. More crystal will fund the antenna and research.", "waitShipyard": "The crew is restoring the Shipyard. The first Prospector will be ready when this repair ends.", "mine": "Our first Prospector is ready. Tap the next-step line to find the nearest asteroid, then send it to mine.", "mineFlying": "Watch the Prospector cross the galaxy. It mines the asteroid and flies home. Expected home: {{clock}}.", "collectMine": "The Prospector is home! Its haul is in the works. Collect it from the top bar to spend it.", "openShipyardCrate": "The Shipyard is ready. Hold its crate to open it, then we will send our first Prospector.", "collectForExtractor": "Collect what the ship made during repairs. Together with the crate, it pays for the next crystal extractor repair.", "telescopeRing": "The telescope is your eye. This circle is the area you can see.", "telescopeTraffic": "Ships and fleets moving inside this circle are visible.", "telescopeTrack": "Once you see a craft’s course, you can follow that leg beyond the circle.", "radarRing": "Radar sees movement in this green circle, even beyond telescope sight.", "radarContact": "A ? means movement of an unknown kind. An incoming fleet appears here before it reaches your ship.", "sightTrio": "Probes read inside a target. The telescope shows movement. Radar warns you."}, "push": "May I let you know when a repair ends and someone approaches your ship?", "allow": "Notify me", "later": "Later", "hint": "Need a heading? {{task}} Tap the next-step line for the way forward.", "dismiss": "Understood", "noneFlying": "No flight is currently away.", "flight": "A flight is still away. Expected home: {{clock}}."},
  "objective": {"probe": "Probe the nearest ship. Tap to find it.", "mine": "Send a Prospector to the nearest asteroid. Tap to find it.", "underwayProbe": "Your probe is on its way. Its report lands in Intel.", "underwayMine": "The Prospector is out mining. It comes back by itself.", "restSave": "That is all for now. Back around {{clock}} for the {{name}}.", "restWait": "That is all for now. The repair is done around {{clock}}.", "repair": "Repair the {{name}}. Open the ship.", "collect": "Collect what the works made, from the top bar.", "save": "{{name}}: you can pay in about {{time}}.", "saveNever": "{{name}}: repair what makes the missing resource.", "wait": "A repair is under way. Ready in {{time}}.", "parts": "Find {{count}} thrust parts. Wrecks and guarded outposts hold them.", "fuel": "Load the fuel tank in the Drive."},
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
    "FIRST_BATTLE_REPORT": "your first battle report"
  },
  "factHow": {"FIRST_PROBE_REPORT": "Send a probe to a neighbouring ship.", "FIRST_MINING_RETURN": "Send a Prospector to an asteroid and wait for it to come back.", "FIRST_BATTLE_REPORT": "Once the Aegis is repaired, pirates raid your ship. That battle's report counts."},
  "attackLocked": "Attacks open after your first battle. Once the Aegis is repaired, pirates raid your ship, and that battle's report opens them.",
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
      "line": "You can build ships and send a Prospector to mine asteroids."
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
      "risk": "Once it is repaired, pirates can raid this ship.",
      "gain": "Opens defence",
      "line": "The Aegis absorbs damage first. Pirates can now raid this ship."
    },
    "attack": {
      "gain": "Opens attacks",
      "line": "You can attack ships and outposts, and repair damaged ships at the Repair Station."
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
  "funnel": {"title": "Starter journey", "sessions": "{{accounts}} accounts · {{sessions}} sessions · {{returned}} returned for a second session", "push": "Push: {{asked}} asked · {{granted}} allowed · {{denied}} declined", "crates": "Crates: {{opened}} opened by {{accounts}} accounts", "steps": "Steps and dropoff", "dropoff": "{{accounts}} reached · {{dropoff}} fewer than previous"},
  "crate": {"title_one": "Salvage crate", "title_other": "{{count}} salvage crates", "hold": "Hold to open and take it", "open": "Open: {{purse}}"},
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
