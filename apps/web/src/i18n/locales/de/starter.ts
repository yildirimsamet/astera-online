/** The colony ship's screens. `docs/ux-writing.md` applies. */
export const starter = {
  "visual": {"probe": "Sonde", "mine": "Abbauen", "crate": "Bergung", "collect": "Abholen", "waiting": "Im Flug", "galaxy": "Hauptgalaxie"},
  "dossier": {"surfaceGapLabel": "Alles über dieses Schiff", "surfaceGapMissing": "Du hast dieses Schiff noch nie gesehen", "surfaceGapWhy": "Du siehst nicht, wer es fliegt, wie weit die Reparaturen sind oder was es trägt. Eine Sonde bringt alles auf einmal.", "probeGapAged": "Deine Daten zu diesem Schiff sind veraltet", "probeGapWhy": "Du setzt eine Flotte auf das, was an Bord ist. Eine Sonde macht aus der Vermutung einen Bereich.", "fleetGapWhy": "Die wertvollste Information im Spiel: Eine abwesende Flotte kann ihr Schiff nicht verteidigen.", "fleetGapRange": "Reichweite {{reach}}; dieses Schiff ist {{distance}} entfernt"},
  "reports": {"guardDown": "Die Wache ist gefallen. Der Außenposten steht noch {{time}} offen: Eine weitere Flotte kann den Rest holen.", "outpost": "einen verlassenen Außenposten", "pirates": "Piraten", "attackedShip": "Angegriffenes Schiff: {{planet}}", "walkover": "Auf deinem Schiff standen keine Verteidiger, daher war die verfügbare Beute für die Angreifer offen.", "cargoLimited": "Deine Laderäume waren voll. Dort gab es mehr, als du tragen konntest. Bring Kuriere mit.", "landing": "Überlebende kehren mit ihren Schäden in den Hangar zurück. Schicke sie selbst zur Reparaturstation.", "walkoverBody": "Auf deinem Schiff standen keine Verteidiger. Die Angreifer konnten die verfügbare Beute kampflos nehmen.", "noGroundNote": "Dieses Schiff hatte bei deiner Ankunft keine stehende Verteidigung.", "piratesName": "Piraten", "aegisNote": "Das Aegis nimmt Schaden, bevor eine verteidigende Einheit getroffen wird."},
  "fleetPage": {"roomRule": "Platz für jedes Schiff, das dieses Schiff trägt – daheim, unterwegs und in der Werft. Ein voller Hangar stoppt die Werft; eine zurückgerufene Flotte passt immer.", "bays": "Angriffsplätze", "openStation": "Reparaturstation öffnen", "emptyAir": "Nichts in der Luft. Tippe in der Galaxie auf ein Schiff, einen Felsen oder einen Außenposten, um Schiffe zu senden."},
  "handbook": {"title": "Handbuch", "replay": "Die ersten Minuten noch einmal ansehen", "repairs": {"title": "Reparaturen öffnen alles", "body": "Jede Reparatur öffnet das nächste System. Eine läuft zur Zeit, auch wenn du weg bist."}, "holds": {"title": "Maschinen behalten, was sie herstellen", "body": "Produktion wartet im Produktionslager, bis du sie in den Speicher abholst. Ressourcen im Laderaum können geplündert werden."}, "sight": {"title": "Erst schauen, dann fliegen", "body": "Ein Sondenbericht zeigt einen festen Moment. Je älter er wird, desto weniger sagt er über jetzt."}, "fleets": {"title": "Eine Flotte unterwegs ist sicher, das Schiff nicht", "body": "Schiffe im Flug können nicht geplündert werden. Dein Kolonieschiff und alles zu Hause schon."}, "jump": {"title": "Der Sprung ist das Ziel", "body": "Stelle den Antrieb fertig, lade Treibstoff, bring die Teile mit, und du landest mit deiner Ladung in der Hauptgalaxie. Es gibt keinen Rückweg."}, "crates": {"title": "Bergungskisten", "body": "Bestimmte Reparaturen legen Bergungskisten frei. Halte im Schiffsbildschirm einen Deckel gedrückt, um alle bereiten Kisten zu öffnen. Jede zahlt einmal Legierung und Kristall ins Lager. Diese Ressourcen sind plünderbar und zählen zum Sprunglimit von 2.000 Legierung und 1.000 Kristall."}},
  "prologue": {"progress": "Schritt {{step}} von {{total}}", "skip": "Überspringen", "signIn": "Anmelden", "close": "Schließen", "alloy": "Legierung {{value}}", "crystal": "Kristall {{value}}", "refinery": "Raffinerie", "feed": "Sensorleitung", "action": {"power": "Reservestrom anschließen", "burn": "Raffinerie starten", "collect": "Einsammeln", "patch": "Sensorleitung flicken"}, "dark": {"title": "Dein Schiff ist dunkel.", "body": "Das Riff hat die Flotte zerschlagen und dich hierher geworfen. Das Licht vor dir ist die Galaxie, zu der du aufgebrochen bist."}, "powered": {"title": "Der Reservestrom hält.", "body": "Alle fünf Systeme sind beschädigt. Im Kühllager liegen noch {{crystal}} Kristall. Jede Reparatur kostet Legierung, also zuerst die Raffinerie."}, "burning": {"title": "Der Ofen zündet.", "body": "Die erste Charge läuft auf den letzten Treibstoffleitungen."}, "batch": {"title": "Erste Charge: {{alloy}} Legierung.", "body": "Eine Raffinerie behält, was sie herstellt, bis du sie leerst."}, "collected": {"title": "Die Sensoren sind blind.", "body": "Du siehst nicht, wer sonst noch durchkam. Ein Flicken an der Leitung gibt ihnen ein Ohr zurück."}, "patching": {"title": "Leitung wird geflickt…", "body": "Deine erste Reparatur. Die echten laufen, während du schläfst."}, "signal": {"mark": "Unbekanntes Signal", "title": "Etwas hat geantwortet.", "body": "Weit draußen, und die Antenne ist zu kaputt, um es zu lesen. Der Antrieb schafft noch einen kurzen Sprung.", "replayBody": "Weit draußen, und die Antenne war zu kaputt, um es zu lesen. Den Rest kennst du.", "replayAction": "Zurück zum Spiel", "go": "Zum Signal fliegen"}, "hint": {"hold": "Halten, bis es zündet", "weld": "Zum Schweißen halten", "claim": "Zum Start halten"}, "warping": {"title": "Sprung…"}, "found": {"title": "Dieses Schiff kann dir gehören.", "body": "Es treibt hinter den Untiefen, der Ofen brennt, ein Ohr ist geflickt. Mach es zu deinem, und das Abenteuer beginnt.", "action": "Ans Steuer"}, "claim": {"title": "Dieses Schiff kann dir gehören.", "ship": "dieses Schiff", "intro": "Dein Schiff startet mit {{alloy}} Legierung, {{crystal}} Kristall und einer laufenden Raffinerie. Reparaturen laufen weiter, während du weg bist."}},
  "chatRoom": "Galaxiekanal",
  "away": {"fleetHome": "Flotte zurück", "fleetHomeDetail_one": "+{{resources}} Ressourcen · {{count}} Schiff", "fleetHomeDetail_other": "+{{resources}} Ressourcen · {{count}} Schiffe", "haulAlloy": "+{{value}} Legierung", "haulCrystal": "+{{value}} Kristall", "haulDeuterium": "+{{value}} Deuterium", "ships_one": "{{count}} Schiff", "ships_other": "{{count}} Schiffe", "toShip": "Zum Schiff"},
  "launchFleetsave": "Schiffe im Flug können nicht geplündert werden. Dein Kolonieschiff schon.",
  "contact": {"scout": "Piratenspäher", "scoutDetail": "Er schaut nur, er kämpft nicht. Beim nächsten Mal ist er vielleicht nicht allein.", "raid": "Piratenüberfall"},
  "outpost": {"title": "Verlassener Außenposten", "rule": "Besiege die Wache und nimm bis zu {{amount}} Ressourcen. Füllt sich in 6 Stunden wieder.", "label": "Außenposten · Stufe {{level}}"},
  "readout": {"ships": "{{count}} Schiffe", "outposts": "{{count}} Außenposten", "level": "Wachstufe {{level}}"},
  "lab": {"premise": "Diese Forschung bleibt beim Schiff. Sie kommt nicht mit in die Hauptgalaxie.", "holdsRole": "Erhöht die Frachtkapazität der Prospektoren.", "queue": "Schiffsforschung", "queueHint": "Das Schiff bearbeitet ein Projekt zur Zeit. Reparaturen und Werft laufen getrennt weiter.", "idleHint": "Wähle einen Stern auf der Karte.", "queueFull": "Das Schiff bearbeitet ein Projekt zur Zeit. Warte, bis dieses fertig ist."},
  "deck": {"label": "Schiffsdecks", "repairs": "Reparatur", "yard": "Werft", "research": "Forschung"},
  "yard": {"queue": "Werft-Warteschlange", "dockRule": "Die Station verlangt {{percent}} % des Hauptpreises.", "dockHurt": "{{count}} Schiffe brauchen die Station", "dockGo": "{{count}} Schiffe reparieren"},
  "board": {"title": "Abflüge", "empty": "Noch niemand ist gesprungen. Du könntest der Erste sein.", "ago": "vor {{time}}"},
  "mainRow": {"facts": "{{worlds}} Welten. Die Saison endet in {{days}} Tagen.", "waiting": "Eine neue Saison ist unterwegs.", "repair": "Repariere den Antrieb, um dorthin zu springen. Sonst überquert nichts die Lücke.", "ready": "Dein Schiff ist bereit. Öffne den Antrieb zum Springen.", "eyebrow": "Dein Ziel", "story": "Dorthin war die Flotte unterwegs, bevor das Riff sie zerstreute. Hier beginnt die eigentliche Reise: Welten zu halten, Rivalen, Clans, eine Saison zu gewinnen.", "legRepair": "Schiff repariert", "legFuel": "Sprungtreibstoff", "go": "Zum Schiff"},
  "jump": {"panel": "Der Sprung", "parts": "Schubteile", "partsHint": "Wracks und bewachte Außenposten haben sie. Wer zuerst da ist, nimmt das Teil.", "tank": "Treibstofftank", "tankLocked": "Der Tank wird mit der Schubmontage und Deuteriumanlage 2 angeschlossen.", "tankHint": "Der Sprung verbrennt {{needed}} Deuterium. Flüge zehren vom selben Vorrat.", "load": "{{amount}} laden", "loadAll": "Alles laden", "go": "Sprung vorbereiten", "title": "Sprung nach {{name}}", "addresses": "Wo du landest", "neighbours": "Welten nah: {{count}}", "tone": {"quiet": "Ruhig", "mixed": "Dazwischen", "busy": "Voll"}, "toneNote": {"quiet": "Sicherer. Ziele sind weit.", "mixed": "Etwas von beidem.", "busy": "Ziele nah, und du bist eins."}, "cargo": "Der Laderaum bringt mit", "package": "Dazu bekommst du das Startpaket der ersten Saison und 72 Stunden Schild.", "carryMost": "Ein Sprung trägt höchstens {{alloy}} Legierung, {{crystal}} Kristall, {{deuterium}} Deuterium und {{ships}} Schiffe.", "left": "Bleibt zurück und geht verloren: {{alloy}} Legierung, {{crystal}} Kristall, {{deuterium}} Deuterium, {{ships}} Schiffe.", "warn": "Das Schiff wird bei diesem Sprung verbraucht. Ressourcen und Schiffe außerhalb des Laderaums gehen verloren.", "hold": "Springen", "leaving": "Startet…", "replay": "Nochmal ansehen", "skip": "Überspringen", "scene": {"lit": "Antrieb gezündet", "leaving": "Raus aus den Untiefen", "gap": "Die Lücke überqueren", "fall": "{{name}}", "world": "Deine Welt"}, "partsSeen": "Deine Scanner zeigen {{count}} Orte. Sie sind auf der Karte markiert.", "partsLater": "Sie erscheinen auf der Karte, sobald der Antriebsrumpf repariert werden kann.", "partsNone": "Keins in Sicht: Schicke eine Sonde zu einem Wrack oder Außenposten.", "partHere": "Hier liegt ein Schubteil. Wer zuerst kommt, nimmt es."},
  "landing": {"dismiss": "Schließen", "title": "Du bist in {{name}} gelandet", "go": "Zu meiner Welt", "cargo": "Mit dir gelandet: {{alloy}} Legierung, {{crystal}} Kristall, {{deuterium}} Deuterium", "line": {"battle": "Kämpfe sind jetzt doppelt so hart, und Aegis hat volle Stärke.", "shield": "Dein Schild hält 72 Stunden.", "absence": "Bleibst du 3 Tage weg, wird dein Planet gelöscht.", "core": "Der Kern bestimmt die Stufe deiner Welt.", "opened": "Clan und Ranglisten sind offen.", "alerts": "Handy-Hinweise kommen jetzt aus der Benachrichtigungszentrale."}, "tip": {"core": "Der Kern bestimmt deine Stufe. Du greifst nur in ihrer Nähe an und wirst ebenso angegriffen.", "colony": "Du kannst bis zu drei Kolonien halten. Neutrale Welten öffnen sich kurz zum Besetzen.", "clan": "Ein Clan teilt Informationen und verteidigt gemeinsam. Sieh dir den Clan-Tab an.", "dominion": "Dominion zählt, wer am meisten hält. Am Saisonende gibt es Belohnungen.", "honor": "Honor zählt, wer fair kämpft. Eine schwächere Flotte anzugreifen bringt wenig."}},
  "shieldNote": "Schiffsschilde beginnen jeden Kampf voll. Rumpfschäden bleiben, bis die Reparaturstation sie behebt.",
  "tempoNote": "Schaden und Aegis sind hier halbiert. In der Hauptgalaxie läuft dieselbe Schlacht doppelt so schnell.",
  "intel": {"blind": "Du kannst in kein einziges Schiff hineinsehen", "openShip": "Schiff öffnen", "telescopeGives": "Zeigt, ob die Flotte des beobachteten Schiffs abgeflogen ist. Wäge vor einem Angriff das Alter der Messung und das Zurückgebliebene ab.", "telescopeCost": "Repariere das Teleskop deines Schiffs.", "idleHint": "Freie Plätze: {{count}}. Wähle ein Schiff auf der Karte und richte einen darauf.", "scarcity": "Schiffe da draußen: {{neighbours}}. Deine Plätze: {{count}}. Umschwenken kostet Wartezeit, also wähle gut.", "radarGives": "Zeigt Bewegungen in Reichweite und wann eine Bedrohung dein Schiff erreicht. Sonden kann es erkennen, aber nicht garantiert.", "radarCost": "Repariere das Radar deines Schiffs.", "nextSlot": "Reparatur {{level}}", "oneMore": "Teleskop-Reparatur {{level}} beobachtet ein Schiff mehr.", "radarLevel": "Radar · Reparatur {{level}}", "radarFleets": "Radar-Reparatur {{level}} erkennt eine Bedrohung gegen dich auf {{sense}} Einheiten, ohne Uhr. Auf {{warn}} Einheiten kommt die Ankunftszeit hinzu.", "radarFleetsOne": "Radar-Reparatur {{level}} zeigt bewegte Einheiten bis {{sense}} Einheiten und markiert eine Bedrohung gegen dein Schiff mit Ankunftszeit.", "radarBearing": " Reparatur 2 zeigt zusätzlich, woher sie kamen.", "radarQuiet": "Keine Scans erkannt. Dein Radar ist aktiv.", "scaleNote": "Jeder Balken beginnt bei null: Das Band ist ihre Schätzung, die türkise Linie dein Schiff.", "home": "Zu deinem Schiff fliegen"},
  "news": {"repairDone": "{{name}} repariert.", "probeReport": "Sondenbericht von {{name}}.", "probeDetected": "Eine Sonde hat dein Schiff gescannt.", "radarPast": "Radar: Eine Flotte ist eingetroffen.", "shieldPast": "Dein Schild ist gefallen.", "radar": "Radar: Eine Flotte trifft in {{time}} ein.", "raidOver": "Dein Angriff auf {{name}} ist vorbei. Lies den Bericht.", "attacked": "{{name}} hat dein Schiff angegriffen. Lies den Bericht.", "fleetHome": "Deine Flotte ist zurück.", "fleetHomePart": "Deine Flotte ist mit einem Schubteil zurück.", "turnedBack": "Das Ziel war nicht erreichbar. Deine Flotte kehrt um.", "yardDone": "Werft: {{count}} {{name}} bereit.", "researchDone": "{{name}} hat Stufe {{level}} erreicht.", "dockDone": "Die Reparaturstation ist fertig. Deine Schiffe sind heil.", "shieldWarning": "Dein Schild fällt in {{time}}.", "seasonOpen": "In {{name}} ist eine neue Saison offen. Dein Schiff kann springen."},
  "reading": {"repairLabel": "Reparaturen", "repairNote": "Wie viel dieses Schiffs repariert ist. Je weiter, desto mehr hat es aufgebaut und desto näher ist sein Aufbruch.", "unknownShip": "Unbekanntes Schiff"},
  "systemShort": {"REFINERY": "Raffinerie", "SURVEY": "Sonde", "DEFENCE": "Abwehr", "CARGO": "Fracht", "DRIVE": "Antrieb"},
  "systemsLabel": "Schiffssysteme",
  "locked": "gesperrt",
  "perHour": "/h",
  "moreRepairs": "Weitere Reparaturen", "nextRepairs": "Reparaturen",
  "slots": "Arbeitsplätze",
  "stepState": {"done": "repariert", "queued": "in der Warteschlange", "closed": "gesperrt", "open": "bereit"},
  "repairedLabel": "Repariert",
  "quiet": {"warn": "Repariere innerhalb von {{time}}, sonst gibt dein Schiff seinen Platz in dieser Galaxie auf.", "asleep": "Dein Schiff hat nach {{hours}} Stunden ohne Reparatur seinen Platz aufgegeben. Starte eine Reparatur, um wieder einen zu bekommen."},
  "queue": {"title": "Reparaturschlange"},
  "eyebrow": "Kolonieschiff",
  "goal": "Repariere alle Systeme, fülle den Treibstofftank und springe in die Hauptgalaxie.",
  "next": "Als Nächstes",
  "tutorial": {"skip": {"link": "Ich brauche keine Anleitung", "title": "Anleitung schließen?", "body": "Möchtest du die Anleitung schließen? Der Offizier wird dich nicht mehr anleiten. Dein Spiel geht an derselben Stelle weiter.", "keep": "Mit Anleitung fortfahren", "close": "Anleitung schließen"}, "chapter": {"1": "Erwachen", "2": "Erste Reparaturen", "3": "Die Antenne", "4": "Die erste Sonde", "5": "Die erste Flotte", "6": "Die erste Ladung", "7": "Teleskop", "8": "Radar"}, "next": "Weiter", "reveal": "Ganze Nachricht zeigen", "away": "Ich rufe dich, wenn es fertig ist, gegen {{clock}}. Bis dahin sieh dich auf deinem Schiff und in der Galaxie um.", "ok": "OK", "back": "Zurück in {{time}}", "reopen": "Anleitung zeigen", "nav": {"openShip": "Öffne das Schiff: Tippe auf {{base}}.", "closePage": "Schließe diese Seite. Die nächste Aufgabe wartet in der Galaxie.", "dismissUnlock": "Ein System ist gerade online gegangen. Lies seine Karte und schließe sie, um weiterzumachen."}, "line": {"lookAround": "Willkommen an Bord, Kommandant! Dieses Schiff gehört jetzt dir. Zieh über den Bildschirm und sieh dir dein Schiff und seine Umgebung von allen Seiten an.", "welcome": "Kommandant, der Funk geht! Ich bin der Aufklärungsoffizier der Flotte. Das Riff hat die Flotte zerstreut, aber dieses Schiff gehört jetzt dir. Ich bleibe in der Leitung, bis es wieder fliegt. Sehen wir erst, was wir haben.", "online": "Die Raffinerie läuft wieder. Das heißt Legierung für Reparaturen. Tippe auf der Karte auf {{try}}.", "collect": "Was die Raffinerie erzeugt hat, wartet im Produktionslager. Um es auszugeben, bring es ins Lager: Tippe oben auf das Produktionslager.", "orderRefinery": "Jede Reparatur kostet Legierung und Kristall. Zuerst {{name}}: Je stärker sie ist, desto schneller geht alles. Tippe auf {{repair}}.", "orderExtractor": "Wir brauchen auch Kristall. Stell auch {{name}} in die Warteschlange; sie trägt drei Aufträge gleichzeitig.", "waitFirst": "Reparaturen laufen von selbst. Diese beiden dauern zehn Sekunden; die großen dauern Stunden und laufen weiter, während du weg bist.", "firstCrate": "Die Reparatur hat einen versiegelten Raum geöffnet. Darin steht eine Bergungskiste voller Legierung und Kristall, alles für dich. Halte die Kiste gedrückt, um sie zu öffnen.", "orderAntenna": "Jetzt öffnen wir die Ohren. Wechsle zum Tab {{tab}} und repariere {{name}}: Nur damit sehen wir die Schiffe um uns.", "orderExtractor2": "Kein Stillstand, während die Antenne repariert wird. Zurück zum Tab {{tab}}: {{name}} eine Stufe höher.", "waitAntenna": "Die Antenne ist in dreißig Sekunden bereit. Dann sehen wir, wer noch hier draußen ist.", "intelOnline": "Die Antenne funktioniert! Schiffe in der Nähe sind jetzt auf der Karte. Tippe auf {{try}}, ich bringe dich zum nächsten.", "probe": "Das ist ein Nachbarschiff. Wir wissen nicht, was es hat. Schick eine Sonde: Sie fliegt hin, misst und meldet zurück.", "probeFlying": "Die Sonde ist unterwegs. Sie misst am Ziel und fliegt zurück; der Bericht kommt mit ihr.", "openIntel": "Der Bericht ist da. Tippe unten auf den Tab {{intel}}.", "openReport": "Hier steht alles, was wir wissen. Tippe auf das sondierte Schiff, um seinen Bericht zu öffnen.", "report": "Hier ist der Sondenbericht. Der beleuchtete Teil ist, was ein Sieg einbringen könnte; darunter ihre Schiffe. Wir schicken nie eine Flotte los, ohne das zu lesen.", "farewell": "Die erste Ladung ist an Bord. {{underway}} Die nächste Reparatur ist in etwa {{time}} bezahlbar. Du übernimmst. Die Zeile für den nächsten Schritt hilft dir.", "welcomeBack": "Willkommen zurück, Kommandant! Das Produktionslager hat sich gefüllt, während du weg warst. Sammle ein, und wir machen weiter, wo wir aufgehört haben.", "collectAgain": "Tippe auf das Produktionslager und bring das Angesammelte ins Lager.", "orderRefinery3": "Repariere {{name}} erneut. Mehr Legierung hilft uns, die Werft wiederherzustellen. Das dauert {{time}}.", "finale": "Jetzt kennst du den Weg. Die Zeile unten nennt immer den nächsten Schritt. Große Reparaturen dauern Stunden: Komm zwischendurch zurück, sammle ein und mach weiter. Die Hauptgalaxie wartet auf dich.", "openCrates": "Die Reparaturen haben Bergungskisten freigelegt. Halte den Deckel gedrückt. Legierung und Kristall bezahlen die nächsten Reparaturen.", "orderVault": "Stelle auch {{name}} in die Warteschlange. So bekommt das Schiff mehr Platz für Ressourcen.", "waitRefinery": "Die Raffinerie läuft an. Ihre nächste Kiste bezahlt die Werft.", "openRefineryCrate": "Die Raffinerie ist fertig. Halte die Kiste gedrückt: Wir brauchen ihre Ladung für die Werft.", "orderShipyard": "Öffne {{tab}} und repariere {{name}}. Damit kommen unser erster Prospektor und zwei Darts.", "orderExtractor3": "Die Werft arbeitet. Stelle {{name}} vor unserem ersten Flug in die Warteschlange. Mehr Kristall bezahlt Antenne und Forschung.", "waitShipyard": "Die Besatzung repariert die Werft. Danach ist der erste Prospektor bereit.", "mine": "Unser erster Prospektor ist bereit. Tippe auf den nächsten Schritt, finde den nächsten Asteroiden und schicke ihn zum Abbau.", "mineFlying": "Beobachte den Prospektor in der Galaxie. Er baut den Asteroiden ab und kehrt heim. Erwartete Rückkehr: {{clock}}.", "collectMine": "Der Prospektor ist zurück! Sammle seine Ladung aus dem Produktionslager über die obere Leiste ein.", "openShipyardCrate": "Die Werft ist bereit. Halte ihre Kiste gedrückt. Danach schicken wir unseren ersten Prospektor los.", "collectForExtractor": "Sammle die während der Reparaturen erzeugten Ressourcen. Zusammen mit der Kiste bezahlen sie die nächste Kristallextraktor-Reparatur.", "telescopeRing": "Das Teleskop ist dein Auge. Diesen Kreis kannst du sehen.", "telescopeTraffic": "Schiffe und Flotten in diesem Kreis sind sichtbar.", "telescopeTrack": "Kennst du den Kurs eines Flugkörpers, kannst du diesen Flug auch außerhalb des Kreises verfolgen.", "radarRing": "Radar erkennt Bewegungen im grünen Kreis, auch außerhalb der Teleskopsicht.", "radarContact": "Ein ? zeigt eine unbekannte Bewegung. Eine anfliegende Flotte erscheint hier, bevor sie dein Schiff erreicht.", "sightTrio": "Sonden lesen das Innere. Das Teleskop sieht Bewegung. Radar warnt dich."}, "push": "Soll ich dich informieren, wenn eine Reparatur endet und sich jemand deinem Schiff nähert?", "allow": "Benachrichtige mich", "later": "Später", "hint": "Brauchst du einen Kurs? {{task}} Tippe auf den nächsten Schritt.", "dismiss": "Verstanden", "noneFlying": "Derzeit ist kein Flug unterwegs.", "flight": "Ein Flug ist noch unterwegs. Erwartete Rückkehr: {{clock}}."},
  "objective": {"probe": "Sende eine Sonde zum nächsten Schiff. Tippe, um es zu finden.", "mine": "Schicke einen Prospektor zum nächsten Asteroiden. Tippe, um ihn zu finden.", "underwayProbe": "Deine Sonde ist unterwegs. Ihr Bericht landet in Aufklärung.", "underwayMine": "Der Prospector schürft. Er kommt von selbst zurück.", "restSave": "Das ist alles für jetzt. Komm gegen {{clock}} zurück für: {{name}}.", "restWait": "Das ist alles für jetzt. Die Reparatur ist gegen {{clock}} fertig.", "repair": "{{name}} reparieren. Öffne das Schiff.", "collect": "Sammle in der oberen Leiste ein, was die Werke erzeugt haben.", "save": "{{name}}: bezahlbar in etwa {{time}}.", "saveNever": "{{name}}: repariere, was die fehlende Ressource erzeugt.", "wait": "Eine Reparatur läuft. Fertig in {{time}}.", "parts": "Finde {{count}} Schubteile. Wracks und bewachte Außenposten haben sie.", "fuel": "Fülle den Treibstofftank im Antrieb."},
  "log": {"title": "Logbuch", "now": "Jetzt", "go": "Los", "chapter": {"POWER": {"title": "Energie", "line": "Die Reserve hält. Das Schiff ist wach."}, "REFINERY": {"title": "Raffinerie", "line": "Erzeugt Legierung und Kristall. Jede Reparatur kostet sie."}, "SURVEY": {"title": "Erkundung", "line": "Die Antenne: Sonden, Berichte und der Intel-Tab."}, "DEFENCE": {"title": "Verteidigung", "line": "Aegis, Teleskop und Radar: Überfälle kommen sehen und überstehen."}, "CARGO": {"title": "Fracht", "line": "Werft und Hangar: deine ersten Schiffe und der Flotten-Tab."}, "DRIVE": {"title": "Antrieb", "line": "Schubteile, Antriebsrumpf und Treibstoff: der Sprung in die Hauptgalaxie."}}},
  "repair": "Reparieren",
  "stepCount": "Stufe {{stage}} von {{total}}",
  "optional": "Optional · zählt nicht zum Reparatur-%",
  "inQueue": "In der Warteschlange",
  "systemAria": "{{name}}: {{done}} von {{total}} Reparaturen, {{state}}",
  "needs": "Benötigt: {{what}}",
  "queueFull": "Die Reparaturschlange fasst {{count}}. Warte, bis eine fertig ist.",
  "affordIn": "Bezahlbar in etwa {{time}}.",
  "collectFirst": "Sammle über die obere Leiste ein, um dies zu bezahlen.",
  "noIncome": "Diese Ressource wird noch nicht hergestellt. Repariere, was sie herstellt.",
  "allQueued": "Alle nötigen Reparaturen sind fertig oder in der Warteschlange.",
  "allRepaired": "Alle nötigen Reparaturen sind fertig.",
  "ordered": "{{name}}: Reparatur beauftragt",
  "state": {
    "broken": "Defekt",
    "damaged": "Beschädigt",
    "done": "Repariert"
  },
  "system": {
    "REFINERY": "Raffineriemodul",
    "SURVEY": "Erkundungsantenne",
    "DEFENCE": "Verteidigungssysteme",
    "CARGO": "Fracht und Hangar",
    "DRIVE": "Interstellarantrieb"
  },
  "module": {
    "SURVEY": "Erkundungsantenne",
    "DRIVE_HULL": "Antriebsrumpf",
    "DRIVE_THRUST": "Schubmontage"
  },
  "fact": {
    "FIRST_PROBE_REPORT": "dein erster Sondenbericht",
    "FIRST_MINING_RETURN": "deine erste Bergbau-Rückkehr",
    "FIRST_BATTLE_REPORT": "dein erster Kampfbericht"
  },
  "factHow": {"FIRST_PROBE_REPORT": "Schicke eine Sonde zu einem Nachbarschiff.", "FIRST_MINING_RETURN": "Schicke einen Prospektor zu einem Asteroiden und warte, bis er zurückkommt.", "FIRST_BATTLE_REPORT": "Sobald die Aegis repariert ist, überfallen Piraten dein Schiff. Der Bericht dieses Kampfes zählt."},
  "attackLocked": "Angriffe öffnen sich nach deinem ersten Kampf. Sobald die Aegis repariert ist, überfallen Piraten dein Schiff, und der Bericht dieses Kampfes öffnet sie.",
  "partsNeeded": "{{count}} Schubteile",
  "effect": {
    "rate": {
      "alloy": "+{{amount}} Legierung pro Stunde",
      "crystal": "+{{amount}} Kristall pro Stunde",
      "deuterium": "+{{amount}} Deuterium pro Stunde"
    },
    "ships": "Inklusive {{ships}}",
    "deuterium": "Inklusive {{amount}} Deuterium",
    "room": "Hangarplatz {{room}}",
    "storeCeiling": "Legierungslimit {{from}} → {{to}}",
    "telescope": "Teleskop-Reichweite {{distance}}",
    "radar": "Radar-Reichweite {{distance}}",
    "aegis": "Aegis {{hp}}",
    "surveyBand": "Sonden lesen einen engeren Bereich",
    "driveHull": "Trägt die Schubmontage",
    "driveThrust": "Fügt den Treibstofftank hinzu"
  },
  "feature": {
    "production": {
      "gain": "Öffnet die Produktion",
      "line": "Die Raffinerie stellt Legierung her. Sammle sie über die obere Leiste ein."
    },
    "intel": {
      "gain": "Öffnet Sonden",
      "line": "Nachbarschiffe erscheinen als dunkle Punkte. Eine Sonde zeigt, was eines davon besitzt."
    },
    "fleet": {
      "gain": "Öffnet die Flotte",
      "line": "Du kannst Schiffe bauen und einen Prospektor zum Asteroidenabbau schicken."
    },
    "chat": {
      "gain": "Öffnet den Chat",
      "line": "Du kannst mit den anderen Schiffen dieser Galaxie sprechen."
    },
    "salvage": {
      "gain": "Öffnet Trümmerfelder",
      "line": "Trümmerfelder erscheinen jetzt auf der Karte. Ein Prospektor kann sie bergen."
    },
    "research": {
      "gain": "Öffnet die Forschung",
      "line": "Forschung verbessert deine Schiffe und Prospektor-Laderäume. Sie endet mit diesem Schiff."
    },
    "telescope": {
      "gain": "Öffnet das Teleskop",
      "line": "In seinem Ring siehst du andere Schiffe und ihre Flüge."
    },
    "radar": {
      "gain": "Öffnet das Radar",
      "line": "In seinem Ring erscheint ein Flug als unbekannter Kontakt und warnt dich."
    },
    "defence": {
      "risk": "Sobald sie repariert ist, können Piraten dieses Schiff überfallen.",
      "gain": "Öffnet die Verteidigung",
      "line": "Die Aegis fängt Schaden zuerst ab. Piraten können dieses Schiff jetzt überfallen."
    },
    "attack": {
      "gain": "Öffnet Angriffe",
      "line": "Du kannst Schiffe und Außenposten angreifen und beschädigte Schiffe in der Reparaturstation reparieren."
    },
    "deuterium": {
      "gain": "Öffnet Deuterium",
      "line": "Flüge verbrennen Deuterium, und diese Raffinerie stellt es her."
    },
    "drive": {
      "gain": "Öffnet das Antriebsfeld",
      "line": "Schubteile erscheinen jetzt auf der Karte. Der Antrieb braucht {{count}}."
    },
    "migration": {
      "gain": "Öffnet den Sprung",
      "line": "Der Tank ist voll. Dieses Schiff kann in die Hauptgalaxie springen."
    }
  },
  "funnel": {"title": "Startreise", "sessions": "{{accounts}} Konten · {{sessions}} Sitzungen · {{returned}} Rückkehrer zur zweiten Sitzung", "push": "Push: {{asked}} gefragt · {{granted}} erlaubt · {{denied}} abgelehnt", "crates": "Kisten: {{opened}} von {{accounts}} Konten geöffnet", "steps": "Schritte und Abbruch", "dropoff": "{{accounts}} erreicht · {{dropoff}} weniger als zuvor"},
  "crate": {"title_one": "Bergungskiste", "title_other": "{{count}} Bergungskisten", "hold": "Halten zum Öffnen und Nehmen", "open": "Öffnen: {{purse}}"},
  "unlock": {
    "online": "{{system}} online",
    "try": "Ausprobieren",
    "later": "Später"
  },
  "tab": {
    "repair": "Repariere {{module}}, um dies zu öffnen.",
    "mainGalaxy": "Das öffnet sich in der Hauptgalaxie."
  }
};
