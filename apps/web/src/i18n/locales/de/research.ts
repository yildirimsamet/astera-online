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
    "Diese Warteschlange gehört Ihrem Kommandanten und begonnene Forschungen können nicht abgebrochen werden. Bau und Hof laufen auf jeder Welt getrennt weiter.",
  runningLabel: "Unterwegs",
  runningFinishes: "beendet {{time}}",
  idleLabel: "Nichts im Gange",
  idleHint: "Starten Sie unten ein Projekt. Hier können bis zu drei Personen warten; Einmal gestartet, können sie nicht mehr abgebrochen werden.",

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
  strategicNote:
    "Schaltet die zerstörerischste Waffe der Galaxie, ihre defensive Antwort und zusätzliche Lagerkapazität frei.",

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

  needCore: "Erhöhen Sie den Kommandokern Ihrer Hauptstadt auf L{{level}}",
  queueFull: "3 Forschungsprojekte stehen bereits in der Warteschlange. Warten Sie, bis einer fertig ist, bevor Sie einen weiteren hinzufügen.",
  at: "Erforschbar in {{duration}}",
  warAt: "Kriegshandlung wird in {{duration}} eröffnet",
  isotopeFirst: "Forschungsisotopenspektrometrie zuerst",
  prerequisiteFirst: "Erforschen Sie zuerst {{name}}",
  graviticFirst: "Erforsche zuerst Gravitische Ladungen",
  cargoInsight: "Füllen Sie Ihre Fracht in einem Überfall auf, solange Beute übrig bleibt",
  shieldInsight: "Lassen Sie eine Aegis mindestens {{share}} Ihres Schlachtzugsschadens absorbieren",

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
  deathStarName: "Todesstern-Protokoll",
  deathStarTag: "Schaltet den Todesstern frei",
  deathStarRole:
    "Der Todesstern wird jetzt ohne diese Forschung gebaut; dieses Projekt ist nicht verfügbar.",
  deathStarDetail:
    "Ein EMP-Angriff entlädt die Aegis und verhindert eine Stunde lang ihre Regeneration. Bodenverteidigungen feuern in dieser Zeit nicht und erleiden keinen Schaden.",

  synthesisName: "Deuteriumsynthese",
  synthesisTag: "Erhöht die Raffinerie-Obergrenze",
  synthesisRole:
    "Jede Sprosse öffnet drei weitere Ebenen der Deuterium-Raffinerie auf jeder Welt, die Sie besitzen",
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
  holdsName: "Prospektor hält",
  holdsTag: "Bergbauschiffe transportieren mehr",
  holdsRole: "Erhöht jeden Prospektor-Hold; Zusätzlich gilt der Kapazitätsbonus des Derricks",
  holdsDetail:
    "Jede Sprosse erhöht die Menge, mit der jeder Prospektor zurückkehren kann. Der Bonus vervielfacht sich mit dem Derrick-Satelliten und die dritte Sprosse öffnet einen dritten Prospektor-Slot auf jeder Welt.",
  cargoName: "Frachträume",
  cargoTag: "Jeder Laderaum trägt mehr",
  cargoRole: "Erhöht Überfall-Beute, Welttransfers und Handelskonvois gleichermaßen. Der Asteroidenabbau ist eine eigene Leiter",
  cargoDetail:
    "Mit jeder Sprosse erhöht sich die Ladung Ihrer Schiffe: Überfallen Sie Beute in der gesamten mobilen Flotte und im Laderaum jedes Kuriers, Wanderers, Atlas und Argosy, der Erz zwischen Ihren Welten transportiert oder mit einem Händler handelt. Prospektoren haben in den Prospektor-Festungen ihre eigene Leiter.",

  engineeringName: "Raumschifftechnik",
  engineeringTag: "Öffnet erweiterte Rumpfstufen",
  engineeringRole:
    "Engineering I eröffnet Rumpfberechtigungen der Stufe 3; Engineering II eröffnet Tier 4. Einzelne Rümpfe behalten ihre Systemforschungs- und Werftanforderungen.",
  engineeringDetail:
    "Engineering gewährt Bauberechtigung statt eines Kampfmultiplikators. Seine erste Sprosse öffnet Rumpftore der Stufe 3 und seine zweite öffnet die Rumpftore der Stufe 4; Für einen bestimmten Rumpf sind möglicherweise noch Energie, Panzerung, Antrieb oder Gravitationsladungen sowie die angegebene Werftstufe erforderlich.",
  powerName: "Schiffsenergie",
  powerTag: "Löst den Angriff eines Kriegsschiffs aus",
  powerRole:
    "Erhöht den Angriff jedes Kriegsschiffs in Ihrer Flotte und erfüllt fortgeschrittene Offensivbautore. Frachtrümpfe und Bodenverteidigung bleiben davon unberührt.",
  powerDetail:
    "Jede Sprosse erhöht den normalen Angriff auf jedes Kriegsschiff, einschließlich des Nullifiers, und gilt für Schiffe, die Sie bereits besitzen. Es fügt keinen Angriff auf Transporter hinzu und wirkt sich nicht auf Bastion, Thorn, Prospektor oder Sonden aus. Ein Angreifer trägt seine Startzeitebene; Ein Verteidiger liest die Kampfzeitstufe vor.",
  armorName: "Schiffspanzerung",
  armorTag: "Erhöht die Schiffsrumpfstärke",
  armorRole:
    "Erhöht die Rumpfstärke für jedes Schiff Ihrer Flotte, einschließlich Transportschiffen, und erfüllt fortgeschrittene Verteidigungsbautore.",
  armorDetail:
    "Jede Sprosse erhöht die Rumpfstärke für jedes Schiff in Ihrer Flotte, einschließlich Kurier, Wanderer, Atlas und Argosy. Bastion, Thorn, Prospektor oder Sonden sind davon nicht betroffen. Ein Angreifer trägt seine Startzeitebene; Ein Verteidiger liest die Kampfzeitstufe vor.",
  propulsionName: "Schiffsantrieb",
  propulsionTag: "Erhöht die Flottengeschwindigkeit",
  propulsionRole:
    "Erhöht die Geschwindigkeit jedes Schiffes in Ihrer Flotte und trägt zum Atlas-Tor bei. Es öffnet sich nach „Dense Fuel Cells“.",
  propulsionDetail:
    "Jede der vier Stufen erhöht die Nenngeschwindigkeit jedes Schiffes in Ihrer Flotte um ein Viertel, während die letzte Stufe sie verdoppelt und jeden Flug halbiert. Eine gemischte Flotte bewegt sich immer noch mit der Geschwindigkeit ihres langsamsten Mitglieds, sodass der Antrieb eine ausgewählte Zusammensetzung verbessert, ohne ihr Profil zu löschen. Es wirkt sich nicht auf Prospektoren oder Sonden aus und nur Missionen, die nach Abschluss angeboten werden, erhalten den Gewinn.",
  groundDoctrineName: "Einlagerungslehre",
  doctrineTag: "Verbessert die Bodenverteidigung",
  doctrineRole:
    "Erhöht gemeinsam die Angriffs- und Hüllenstärke von Bastion und Thorn, ohne ihre Kapazität, Bergung oder Klassenzuordnung zu ändern.",
  groundDoctrineDetail:
    "Verbessert den Angriff und die Hülle von Bastionen und Dornen auf jeder Welt. Es verändert die Kampfstärke, nicht die Bodenkapazität oder die Bergung; Verteidiger nutzen die Sprosse, die sie zu Beginn des Kampfes halten.",

  gridName: "Abfanggitter",
  gridTag: "Schießt einen Todesstern ab",
  gridRole:
    "Ein geladener Abfangjäger zerstört eine strategische Waffe auf dem Radar-Abfangring oder in Sichtweite des Teleskops",
  gridDetail:
    "Es gewährt Zugriff auf die Abfangjägerladung. Für den Aufbau sind ein Uplink und Radar 3 auf der Zielwelt erforderlich. Eine geladene Ladung zerstört automatisch die erste strategische Waffe, die in ihren zeitgesteuerten Radar-Abfangring gelangt oder im Teleskop-Sichtfeld einer beliebigen von Ihnen gehaltenen Welt identifiziert wird, und wird dann verbraucht.",
  stockpileName: "Strategischer Vorrat",
  stockpileTag: "Behalten Sie eine zweite Waffe auf dem Pad",
  stockpileRole:
    "Jede Welt kann zwei Todessterne enthalten; der zweite beginnt, nachdem der erste beendet ist",
  stockpileDetail:
    "Erhöht das Todesstern-Limit von eins auf zwei auf jeder Welt, nicht für den gesamten Kommandanten. Der zweite kann in die Warteschlange gestellt werden, beginnt aber erst, nachdem der erste fertig ist, und kostet trotzdem den vollen Preis und die volle Zeit. Ein Schlag verbraucht immer noch seine Waffe.",
} as const;
