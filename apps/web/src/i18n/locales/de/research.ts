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
  eyebrow: "Kommandant",
  title: "Forschung",
  /** What the whole screen is for, in the one clause a player reads before scrolling. */
  premise: "Abgeschlossene Forschung gilt auf allen deinen Welten. Jede Forschungsstufe wird einzeln bezahlt.",

  /** THE QUEUE. It belongs to the commander, not to the funding world. */
  queueTitle: "Forschungswarteschlange",
  queueCapacity: "{{count}} Steckplätze",
  queueLane: "Commander-Forschung",
  queueGlobalHint:
    "Diese Warteschlange gehört deinem Kommandanten, und begonnene Forschung lässt sich nicht abbrechen. Bau und Werft laufen auf jeder Welt getrennt weiter.",
  runningLabel: "Läuft",
  runningFinishes: "endet {{time}}",
  idleLabel: "Nichts läuft",
  idleHint:
    "Wähle einen Stern auf der Karte. Bis zu drei Projekte können hier warten.",

  frontierBand: "Grenze",
  frontierNote:
    "Wird durch bestimmte Ereignisse in der Galaxie aufgedeckt und dann durch den Einsatz von Ressourcen und Forschungszeit vervollständigt.",
  industryBand: "Industrie",
  industryNote:
    "Verbessert Produktion, Bau- und Reparaturzeit sowie Ladekapazität. Jedes Projekt zeigt seine Stufengrenze und Voraussetzungen.",
  doctrineBand: "Lehre",
  doctrineNote:
    "Öffnet erweiterte Rumpfstufen und verbessert Angriff, Panzerung oder Antrieb auf separaten begrenzten Leitern. Die Kampfstufen sind per Sonde sichtbar.",
  strategicBand: "Strategisch",
  strategicNote: "Erhöht, wie viele Todessterne und Abfangladungen jede deiner Welten halten kann.",

  act: "Forschung",
  details: "Details",
  cannotAfford: "Nicht genug Rohstoffe",
  complete: "recherchiert",
  /**
   * WHAT IS HAPPENING TO A PROJECT ALREADY BOUGHT. D183.
   *
   * Two words, two states: the clock is paying for one of them and the other is
   * waiting in a line of three. A row that said "1 order queued" for both hid the
   * only fact a commander choosing what to buy next needs.
   */
  rowRunning: "Recherchieren",
  rowQueued: "In der Warteschlange",

  needCore: "Hebe den Kommandokern deiner Hauptstadt auf L{{level}}",
  queueFull: "3 Forschungsprojekte stehen bereits in der Warteschlange. Warte, bis eines fertig ist, bevor du ein weiteres hinzufügst.",
  at: "Erforschbar in {{duration}}",
  isotopeFirst: "Forschungsisotopenspektrometrie zuerst",
  prerequisiteFirst: "Erforsche zuerst {{name}}",
  prerequisiteLevelFirst: "Bringe {{name}} zuerst auf Stufe {{level}}",
  nameAtLevel: "{{name}} L{{level}}",
  cargoInsight: "Fülle in einem Überfall deinen Frachtraum, solange Beute übrig bleibt",
  shieldInsight: "Lass eine Aegis mindestens {{share}} deines Überfallschadens absorbieren",

  sheetEyebrow: "Forschungsprojekt",
  sheetComplete: "Forschung abgeschlossen",
  sheetCost: "Forschungskosten",
  sheetOnce: "Wird in Ihrer kommandantenweiten Forschungswarteschlange platziert. Es wird kein Bau- oder Hofplatz verwendet.",
  sheetRung: "Stufe {{level}} von {{max}}. Jede Stufe wird separat gekauft.",

  isotopeName: "Isotopenspektrometrie",
  isotopeTag: "Schaltet den Deuteriumabbau frei",
  isotopeRole:
    "Zeigt das Deuterium in Isotopengesteinen an und ermöglicht es Ihnen, Prospektoren dorthin zu schicken. Der Rücktransport gelangt ins Werk.",
  isotopeDetail:
    "Erforsche es einmal, um Isotopen-Asteroiden in auswählbare Bergbauziele zu verwandeln. Es schaltet den Zugang zum umstrittenen Deuterium frei; Es erzeugt keinen passiven Treibstoff auf einem Planeten.",
  denseName: "Dichte Brennstoffzellen",
  denseTag: "Schaltet den Schiffsantrieb frei",
  denseRole:
    "Um es aufzudecken, füllen Sie Ihre Fracht in einem Überfall auf, während die Beute auf dem Ziel verbleibt. Durch den Abschluss wird die Forschungsleiter „Schiffsantrieb“ geöffnet.",
  denseDetail:
    "Wenn Sie es abschließen, wird die Schiffsantriebsforschung für Ihren Kommandanten dauerhaft geöffnet. Der Antrieb verbessert jedes Schiff Ihrer Flotte und ist auch Teil des Atlas-Build-Gate; Prospektoren oder Sonden werden dadurch nicht verändert.",
  graviticName: "Gravitische Ladungen",
  graviticTag: "Schaltet den Nullifier frei",
  graviticRole:
    "Um es freizuschalten, greife eine verteidigte Welt mit einer aktiven Aegis an; Der Schild muss mindestens {{share}} deines Schadens absorbieren. Ein einzelner Dart kann sich qualifizieren; Du musst nicht gewinnen. Der Nullifier trifft aktive Schilde fünfmal stärker.",
  graviticDetail:
    "Durch den Abschluss wird der Fachforschungsteil des Nullifier-Tors dauerhaft erfüllt. Der Nullifier ist eine Antwort auf eine aktive Aegis, keine allgemeine Schadensverbesserung; Sein zusätzlicher Schildschaden wirkt sich niemals auf Schiffe oder Bodengeschütze aus.",

  synthesisName: "Deuteriumsynthese",
  synthesisTag: "Erhöht die Raffinerie-Obergrenze",
  synthesisRole:
    "Jede Sprosse öffnet drei weitere Stufen der Deuterium-Raffinerie auf jeder deiner Welten",
  synthesisDetail:
    "Jede Forschungsstufe erhöht die Obergrenze der Deuterium-Raffinerie auf jeder Welt um drei Stufen. Sie bauen die Raffinerieebenen immer noch separat, in denen Sie Treibstoff produzieren müssen.",
  yardName: "Yard-Automatisierung",
  yardTag: "Baut Schiffe schneller",
  yardRole:
    "Verkürzt neue Bauaufträge für Schiffe und Bodenverteidigung auf allen deinen Planeten.",
  yardDetail:
    "Jede Stufe verkürzt neue Werftaufträge, einschließlich Prospektoren und Bodenverteidigung. Die Tabelle zeigt den verbleibenden Anteil der Grundbauzeit. Ressourcenpreise und Warteschlangenkapazität ändern sich nicht. Gebäudebau und Schiffsreparaturen haben eigene Forschungseffekte.",
  robotsName: "KI-Roboter",
  robotsTag: "Baut Strukturen schneller auf",
  robotsRole:
    "Verkürzt alles in der Bauwarteschlange, ohne Schiffe oder Bodengeschütze zu beeinträchtigen",
  robotsDetail:
    "Verkürzt künftige Bauaufträge auf allen Planeten: Gebäude, Instrumente und Satelliten. Beschleunigt weder Schiffe noch Bodenverteidigung. Preise und Warteschlangenkapazität bleiben unverändert.",
  industrialName: "Industrie",
  industrialTag: "Repariert Schiffe billiger und schneller",
  industrialRole:
    "Senkt Kosten und Dauer jedes Auftrags der Reparaturstation",
  industrialDetail:
    "Senkt Schiffsreparaturkosten und -zeit auf allen Planeten. Stufe 1 nutzt 75 % der normalen Kosten und Zeit; Stufe 2 nutzt 50 %. Schiffsbau wird nicht beschleunigt. Schäden bis einschließlich 20 % werden bei Landung bereits kostenlos repariert.",
  holdsName: "Prospektor hält",
  holdsTag: "Bergbauschiffe transportieren mehr",
  holdsRole: "Erhöht jeden Prospektor-Hold; Zusätzlich gilt der Kapazitätsbonus des Derricks",
  holdsDetail:
    "Jede Sprosse erhöht die Menge, mit der jeder Prospektor zurückkehren kann. Der Bonus vervielfacht sich mit dem Derrick-Satelliten und die dritte Sprosse öffnet einen dritten Prospektor-Slot auf jeder Welt.",
  cargoName: "Frachträume",
  cargoTag: "Jeder Laderaum trägt mehr",
  cargoRole: "Erhöht Überfall-Beute, Welttransfers und Handelskonvois gleichermaßen. Der Asteroidenabbau ist eine eigene Leiter",
  cargoDetail:
    "Jede Stufe vergrößert den Laderaum aller mobilen Schiffe für Überfälle und Transfers zwischen eigenen Welten. Kurier, Wanderer, Atlas und Argosy tragen auch in Handelskonvois mehr. Prospektoren nutzen ihre eigene Forschung.",

  engineeringName: "Raumschifftechnik",
  engineeringTag: "Öffnet erweiterte Rumpfstufen",
  engineeringRole:
    "Engineering I eröffnet Rumpfberechtigungen der Stufe 3; Engineering II eröffnet Tier 4. Einzelne Rümpfe behalten ihre Systemforschungs- und Werftanforderungen.",
  engineeringDetail:
    "Stufe 1 erfüllt die Ingenieursanforderung für Schiffe der Stufe 3. Stufe 2 gilt entsprechend für Stufe 4. Einzelne Schiffe benötigen zusätzlich Leistung, Panzerung, Antrieb oder Gravitische Ladungen. Die erforderliche Werftstufe gilt weiterhin.",
  powerName: "Schiffsenergie",
  powerTag: "Löst den Angriff eines Kriegsschiffs aus",
  powerRole:
    "Erhöht den Angriff jedes Kriegsschiffs deiner Flotte und erfüllt fortgeschrittene Offensiv-Baubedingungen. Frachtrümpfe und Bodenverteidigung bleiben unberührt.",
  powerDetail:
    "Jede Stufe erhöht den normalen Angriff aller Kriegsschiffe, einschließlich des Nullifiers. Bereits vorhandene Schiffe profitieren ebenfalls. Transporter erhalten keinen Angriff; Bodengeschütze, Prospektoren und Sonden bleiben unverändert. Angreifer nutzen ihre Forschungsstufe beim Start; Verteidiger die Stufe zu Kampfbeginn.",
  armorName: "Schiffspanzerung",
  armorTag: "Erhöht die Schiffsrumpfstärke",
  armorRole:
    "Erhöht die Rumpfstärke jedes Schiffs deiner Flotte, Transporter eingeschlossen, und erfüllt fortgeschrittene Defensiv-Baubedingungen.",
  armorDetail:
    "Jede Stufe erhöht die Rumpfstärke aller Flottenschiffe, einschließlich Transportern. Bodengeschütze, Prospektoren und Sonden bleiben unverändert. Angreifer nutzen ihre Forschungsstufe beim Start; Verteidiger die Stufe zu Kampfbeginn.",
  propulsionName: "Schiffsantrieb",
  propulsionTag: "Erhöht die Flottengeschwindigkeit",
  propulsionRole:
    "Erhöht die Geschwindigkeit jedes Schiffs deiner Flotte und zählt zur Atlas-Baubedingung. Öffnet sich nach „Dichte Brennstoffzellen“.",
  propulsionDetail:
    "Jede der vier Stufen erhöht die Geschwindigkeit um 25 % der Grundgeschwindigkeit. Die letzte verdoppelt sie. Eine gemischte Flotte nutzt ihr langsamstes Schiff. Prospektoren und Sonden bleiben unverändert. Der Bonus gilt für Missionen, die nach Forschungsabschluss starten.",
  groundDoctrineName: "Bodenverteidigungsdoktrin",
  doctrineTag: "Verbessert die Bodenverteidigung",
  doctrineRole:
    "Erhöht Angriff und Rumpfstärke von Bastion, Harpune und Dorn. Bodenkapazität, Bergung und Klassenverhältnisse bleiben unverändert.",
  groundDoctrineDetail:
    "Erhöht Angriff und Rumpfstärke von Bastion, Harpune und Dorn auf allen deinen Planeten. Bodenkapazität und Bergungsregeln bleiben unverändert. Verteidiger nutzen die Forschungsstufe bei Kampfbeginn.",

  gridName: "Abfanggitter",
  gridTag: "Vier Abfangladungen pro Welt",
  gridRole: "Erhöht die Abfangladungen, die jede deiner Welten halten kann, von 2 auf 4.",
  gridDetail: "Erhöht das Abfangladungsmaximum jedes Planeten von 2 auf 4. Laden erfordert Uplink und Radar 3 auf diesem Planeten. Eine Ladung zerstört einen Todesstern bei Teleskopidentifizierung oder rechtzeitiger Radar-Ring-Abfangung. Die Sensoren müssen funktionieren. Jede Abfangung verbraucht eine Ladung.",
  stockpileName: "Strategischer Vorrat",
  stockpileTag: "Zwei Todessterne pro Welt",
  stockpileRole: "Erhöht die Todessterne, die jede deiner Welten halten kann, von 1 auf 2. Der zweite beginnt, sobald der erste fertig ist.",
  stockpileDetail: "Ohne Forschung hält jede Welt 1 Todesstern; diese Forschung macht daraus 2 auf jeder Welt, nicht im ganzen Reich. Der zweite kostet den vollen Preis und die volle Bauzeit und wird nach dem ersten gebaut. Aus mehreren Welten gleichzeitig zuzuschlagen ist der Weg an den Ladungen eines Verteidigers vorbei.",
} as const;
