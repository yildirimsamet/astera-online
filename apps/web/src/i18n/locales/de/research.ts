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
  premise: "Einmal gekauft, von dir gehalten, und jede Welt, die du besitzt, hat es.",

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
    "Offen ab der ersten Minute mit jeweils fünf Sprossen. Verbessert Produktion, Bauzeit und Tragfähigkeit.",
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
  sheetRung: "Strompfad {{level}} von {{max}}. Jede Sprosse wird separat gekauft.",

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
    "Verkürzt die Bauzeit mobiler Fahrzeuge, ohne die Bodengeschütze oder die Werftkapazität zu beeinträchtigen",
  yardDetail:
    "Jede Sprosse verkürzt die Zeit für jede zukünftige Bestellung mobiler Fahrzeuge auf Ihren Welten, einschließlich Prospektoren. Es beschleunigt nicht die Bodenverteidigung, senkt die Ressourcenpreise nicht und fügt keine Yard-Warteschlangenplätze hinzu.",
  robotsName: "KI-Roboter",
  robotsTag: "Baut Strukturen schneller auf",
  robotsRole:
    "Verkürzt alles in der Bauwarteschlange, ohne Schiffe oder Bodengeschütze zu beeinträchtigen",
  robotsDetail:
    "Mit jeder Sprosse wird jeder zukünftige Bauauftrag auf Ihren Welten schneller abgeschlossen: Gebäude, Instrumente und Satelliten gleichermaßen. Es beschleunigt Schiffe nicht – das ist Yard Automation – und es senkt weder die Ressourcenpreise noch fügt es Warteschlangenplätze hinzu.",
  industrialName: "Industrie",
  industrialTag: "Repariert Schiffe billiger und schneller",
  industrialRole:
    "Senkt Kosten und Dauer jedes Auftrags der Reparaturstation",
  industrialDetail:
    "Jede Stufe senkt Kosten und Dauer der Reparatur eines beschädigten Schiffs auf all deinen Welten um ein Viertel: 75 % auf Stufe 1, 50 % auf Stufe 2. Schiffe werden dadurch nicht schneller gebaut \u2014 das macht Yard Automation \u2014 und ein Schiff mit höchstens 20 % Schaden wird nach einem Kampf ohnehin kostenlos repariert.",
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
    "Engineering gewährt Bauberechtigung statt eines Kampfmultiplikators. Seine erste Sprosse öffnet Rumpftore der Stufe 3 und seine zweite öffnet die Rumpftore der Stufe 4; Für einen bestimmten Rumpf sind möglicherweise noch Energie, Panzerung, Antrieb oder Gravitationsladungen sowie die angegebene Werftstufe erforderlich.",
  powerName: "Schiffsenergie",
  powerTag: "Löst den Angriff eines Kriegsschiffs aus",
  powerRole:
    "Erhöht den Angriff jedes Kriegsschiffs deiner Flotte und erfüllt fortgeschrittene Offensiv-Baubedingungen. Frachtrümpfe und Bodenverteidigung bleiben unberührt.",
  powerDetail:
    "Jede Sprosse erhöht den normalen Angriff auf jedes Kriegsschiff, einschließlich des Nullifiers, und gilt für Schiffe, die Sie bereits besitzen. Es fügt keinen Angriff auf Transporter hinzu und wirkt sich nicht auf Bastion, Thorn, Prospektor oder Sonden aus. Ein Angreifer trägt seine Startzeitebene; Ein Verteidiger liest die Kampfzeitstufe vor.",
  armorName: "Schiffspanzerung",
  armorTag: "Erhöht die Schiffsrumpfstärke",
  armorRole:
    "Erhöht die Rumpfstärke jedes Schiffs deiner Flotte, Transporter eingeschlossen, und erfüllt fortgeschrittene Defensiv-Baubedingungen.",
  armorDetail:
    "Jede Sprosse erhöht die Rumpfstärke für jedes Schiff in Ihrer Flotte, einschließlich Kurier, Wanderer, Atlas und Argosy. Bastion, Thorn, Prospektor oder Sonden sind davon nicht betroffen. Ein Angreifer trägt seine Startzeitebene; Ein Verteidiger liest die Kampfzeitstufe vor.",
  propulsionName: "Schiffsantrieb",
  propulsionTag: "Erhöht die Flottengeschwindigkeit",
  propulsionRole:
    "Erhöht die Geschwindigkeit jedes Schiffs deiner Flotte und zählt zur Atlas-Baubedingung. Öffnet sich nach „Dichte Brennstoffzellen“.",
  propulsionDetail:
    "Jede der vier Stufen erhöht die Nenngeschwindigkeit jedes Schiffes in Ihrer Flotte um ein Viertel, während die letzte Stufe sie verdoppelt und jeden Flug halbiert. Eine gemischte Flotte bewegt sich immer noch mit der Geschwindigkeit ihres langsamsten Mitglieds, sodass der Antrieb eine ausgewählte Zusammensetzung verbessert, ohne ihr Profil zu löschen. Es wirkt sich nicht auf Prospektoren oder Sonden aus und nur Missionen, die nach Abschluss angeboten werden, erhalten den Gewinn.",
  groundDoctrineName: "Einlagerungslehre",
  doctrineTag: "Verbessert die Bodenverteidigung",
  doctrineRole:
    "Erhöht gemeinsam die Angriffs- und Hüllenstärke von Bastion und Thorn, ohne ihre Kapazität, Bergung oder Klassenzuordnung zu ändern.",
  groundDoctrineDetail:
    "Verbessert den Angriff und die Hülle von Bastionen und Dornen auf jeder Welt. Es verändert die Kampfstärke, nicht die Bodenkapazität oder die Bergung; Verteidiger nutzen die Sprosse, die sie zu Beginn des Kampfes halten.",

  gridName: "Abfanggitter",
  gridTag: "Vier Abfangladungen pro Welt",
  gridRole: "Erhöht die Abfangladungen, die jede deiner Welten halten kann, von 2 auf 4.",
  gridDetail: "Ohne Forschung kann jede Welt 2 Abfangladungen laden; diese Forschung hebt das Limit auf jeder Welt auf 4. Eine Ladung braucht auf ihrer Welt einen Uplink und Radar 3. Eine geladene Ladung zerstört den ersten Todesstern, der ihren zeitlichen Radar-Abfangring kreuzt oder in der Teleskopsicht einer deiner Welten erkannt wird, und ist dann verbraucht. Eine Ladung stoppt eine Waffe – eine geladene Welt fällt nur, wenn mehr Waffen gleichzeitig ankommen, als sie Ladungen hat.",
  stockpileName: "Strategischer Vorrat",
  stockpileTag: "Zwei Todessterne pro Welt",
  stockpileRole: "Erhöht die Todessterne, die jede deiner Welten halten kann, von 1 auf 2. Der zweite beginnt, sobald der erste fertig ist.",
  stockpileDetail: "Ohne Forschung hält jede Welt 1 Todesstern; diese Forschung macht daraus 2 auf jeder Welt, nicht im ganzen Reich. Der zweite kostet den vollen Preis und die volle Bauzeit und wird nach dem ersten gebaut. Aus mehreren Welten gleichzeitig zuzuschlagen ist der Weg an den Ladungen eines Verteidigers vorbei.",
} as const;
