/**
 * THE NAMED THINGS, AND THE SENTENCES THE GAME SAYS ABOUT THEM.
 *
 * `packages/rules` owns the numbers and stays language-free (it is the shared
 * source of truth for the server and the simulator, and a translation table in
 * there would be I/O by another name). So every NAME a player reads lives here,
 * keyed by the same id the rules use.
 */

export const vocabulary = {
  building: {
    CORE: { name: 'Befehlskern', tag: 'Schaltet höhere Level frei', role: "Bestimmt die Stufengrenzen der Anlagen außer dem Hangar. Auf dem Heimatplaneten öffnet er Kolonieplätze auf Stufe 9, 13 und 16.", detail: "Bestimmt die Stufengrenzen dieser Welt außer dem Hangar mit seiner eigenen Grenze. Bestimmte Stufen schaffen Flugbuchten, Orbitplätze und Raum für Bodenabwehr. Er beschleunigt Instrumente und Satelliten außer dem Uplink. Gebäudeausbauten haben eigene Zeiten nach Typ und Stufe. Der Befehlskern des Heimatplaneten bestimmt Forschungszeiten und manche Voraussetzungen. Seine Stufen 9, 13 und 16 öffnen den ersten, zweiten und dritten Kolonieplatz." },
    REFINERY: { name: 'Legierungsraffinerie', tag: 'Erstellt Legierung', role: 'Legierung pro Stunde und Legierungslagerung', detail: 'Jedes Level erhöht das passive Legierungseinkommen und die Menge, die gespeichert werden kann. Die meisten Konstruktionen und Rümpfe werden aus Legierungen finanziert, was viele zukünftige Wartezeiten verkürzt.' },
    EXTRACTOR: { name: 'Kristallextraktor', tag: 'Macht Kristall', role: 'Kristall pro Stunde und Kristallspeicher', detail: 'Jedes Level erhöht das passive Kristalleinkommen und die Lagerung. Kristall ist die seltenere Hälfte der Kosten für fortschrittliche Hardware, Instrumente und Forschung.' },
    VAULT: { name: 'Speicher', tag: 'Vertieft den Shop', role: 'Erweitert den Ressourcenspeicher und lässt 10 % Spielraum für die nächsten passenden Legierungs- und Kristallhersteller-Upgrades. Die unteren 10 %, deren Produktionszeit auf 8 Stunden begrenzt ist, sind vor Überfällen sicher.', detail: 'Der Speicher wächst zunächst um seine erstellte Produktionsstundenleiter. Wenn diese Etage auf hohen Ebenen zu klein ist, wird Lager L erweitert, um 110 % der Legierungskosten der Legierungsraffinerie L→L+1 und des Kristallextraktors L→L+1 der Kristallkosten aufzunehmen. das daraus resultierende Stundenfenster gilt auch für Deuterium. Ein Überfall kann nicht die unteren 10 % des Lagers oder 8 Stunden der Produktion dieser Ressource erreichen. Der Speicher kämpft nicht und reduziert den eingehenden Schaden nicht.' },
    SHIPYARD: { name: 'Werft', tag: 'Schaltet bessere Schiffe frei', role: 'Schaltet Rümpfe frei, beschleunigt den Schiffs- und Bodenverteidigungsbau und stellt Sondengenauigkeit und Tarnung ein', detail: 'Höhere Level eröffnen neue Rumpfklassen und fertigen Schiffe und Bodenverteidigungen schneller. Sie verbessern außerdem die Messwerte Ihrer Sonden und erschweren das Erfassen Ihrer eigenen Sonden. Werftebenen fügen keine Warteschlangenplätze hinzu.' },
    HANGAR: { name: 'Hangar', tag: 'Legt fest, wie viel Flotte hineinpasst', role: 'Flottenraum auf dieser Welt · bei jedem Kommandokern ausbaubar', detail: 'Jedes Schiff belegt Hangarraum nach seiner Größe, auch Schiffe außerhalb der Heimat; Bodenverteidigungen nicht. Ein voller Hangar baut und empfängt keine weiteren Schiffe, verliert aber nichts, was er bereits enthält. Jede Stufe kostet ein Drittel der Flotte, für die sie Platz schafft; die oberen Stufen kosten daher mehr, als eine Welt ohne ausgebauten Speicher auf einmal fassen kann.' },
    DEUTERIUM_PLANT: { name: 'Deuterium-Raffinerie', tag: 'Stellt Deuterium her', role: 'Deuterium pro Stunde und Brennstoffspeicher · die Obergrenze wird durch die Deuteriumsynthese festgelegt', detail: "Jede Stufe erhöht die Deuteriumproduktion pro Stunde und die Speicherkapazität. Deuterium ist der Treibstoff für Flottenflüge. Wenn die Deuterium-Raffinerie ihre Stufengrenze erreicht, erforsche die nächste Stufe der Deuteriumsynthese." },
  },

  instrument: {
    TELESCOPE: {
      name: 'Teleskop',
      tag: 'Fernbewegung auflösen',
      role:
        'Identifiziert Bewegungen innerhalb seiner Reichweite; Die Uhrenplätze werden zu 1, 2, 3 und 4 bei L1, L3, L5 und L7. Still.',
      roleNone:
        'Identifiziert entfernte Bewegungen und ermöglicht es Ihnen, eine ausgewählte Welt still zu beobachten, um herauszufinden, ob sich ihre Flotte zu Hause befindet. Erfordert einen Uplink im Orbit.',
      roleOwned:
        'Erweitert den Bereich, in dem sich bewegende Fahrzeuge identifiziert werden, und bietet stille Überwachungsplätze. Es gibt Intelligenz, keinen Schutz.',
      detail: 'Weitere Level erweitern die Bewegungskontaktsicht und enthüllen vorbeiziehende Asteroiden, wenn sie diesen Bereich betreten. Ein enthüllter Stein bleibt bekannt, bis er verschwunden ist. L1, L3, L5 und L7 bieten einen, zwei, drei und vier Silent-Watch-Slots. Ein Teleskop warnt niemals, dass eine Flotte auf Sie gerichtet ist.',
    },
    RADAR: {
      name: 'Radar',
      tag: 'Erkennen Sie Bedrohungen für Sie',
      role:
        'Erkennt Bewegungen innerhalb seines Kreises, verbessert die Sondenerkennung und markiert Bedrohungen, die auf diese Welt gerichtet sind, mit einer Ankunftszeit.',
      roleNone:
        /*
          IT SAYS "MOST", BECAUSE A BARE WORLD IS NOT BLIND TO SCOUTS.
          `detectChance` has a floor: a world with no Radar still catches about one
          probe in seven and is told. That is deliberate — the scan notification is
          what teaches a new commander the Radar exists at all. The copy said
          "unseen", which was simply false, and a sentence that oversells a purchase
          is the one thing a decision surface may not do.
        */
        'Erfordert einen Uplink im Orbit. Ohne Radar geben ankommende Flotten keine Ankunftswarnung und die meisten Sonden bleiben unbemerkt.',
      roleOwned:
        'Erkennt Bewegungen innerhalb seines Kreises ohne voraussichtliche Ankunftszeit und markiert Bedrohungen, die auf diese Welt abzielen, mit einer Ankunftszeit. L2 fügt die Peilung hinzu, L4 die grobe Größe und L5 die Ursprungswelt und die gesamte Flotte.',
      detail: "Radar erkennt ankommende Flotten und verbessert die Sondenerkennung. Stufe 1 zeigt die Ankunftszeit. Stufe 2 ergänzt die Richtung; Stufe 4 schätzt die Stärke. Stufe 5 zeigt Herkunft und Schiffe. Höhere Stufen vergrößern auch die Reichweite.",
    },
    AEGIS: {
      name: 'Aegis',
      tag: 'Schild für deinen Planeten',
      role: 'Ein Planetenschild, das vor Einheiten Schaden erleidet und jede Stunde 35 % seines Maximums regeneriert.',
      roleNone:
        'Absorbiert Angriffsschaden vor Schiffen und Bodengeschützen und regeneriert sich dann ohne Ressourcen. Es liefert keine Informationen.',
      roleOwned:
        'Absorbiert Angriffsschaden vor Schiffen und Bodengeschützen und regeneriert jede Stunde 35 % seines Maximums. Es liefert keine Informationen.',
      detail: 'Jede Stufe erhöht die maximale Schildstärke. Kampfschaden wird von Aegis entfernt, bevor er Schiffe oder Bodengeschütze erreicht, und der Schild regeneriert ohne Ressourcen 35 % seines Maximums pro Stunde. Es sammelt keine Informationen.',
    },
    VEIL: {
      name: 'Schleier',
      tag: 'Vor Teleskopen verstecken',
      role: "Degradiert, was jedes Teleskop über Sie lesen kann.",
      roleNone:
        'Kann Ihren Flottenstatus für ein gegnerisches Teleskop unleserlich machen. Es verbirgt Informationen, erfindet aber weder falsche Messwerte noch stoppt es Untersuchungen.',
      roleOwned:
        'Kann Ihren Flottenstatus für ein gegnerisches Teleskop unleserlich machen. Es verbirgt Informationen, erfindet aber weder falsche Messwerte noch stoppt es Untersuchungen.',
      detail: 'Ein stärkerer Schleier macht stärkere Teleskopwerte zunichte und verringert die Genauigkeit der Werftsonde. Es verbirgt Ihren Zustand; Es erfindet keine falschen Daten und blockiert keine eingehende Untersuchung.',
    },
  },

  satellite: {
    UPLINK: {
      name: 'Uplink',
      tag: 'Schaltet Teleskop und Radar frei',
      role:
        'Erforderlich, um ein Teleskop oder Radar auf dieser Welt zu installieren. Es nutzt einen Orbitplatz und bietet keinen Produktions- oder Verteidigungsbonus.',
      blurb:
        'Ein Kommunikationsrelais, das das Teleskop und das Radar freischaltet. Es erweitert die Sicht nicht von alleine.',
      detail: 'Installieren Sie es einmal, um den Teleskop- und Radarbau auf dieser Welt verfügbar zu machen. Es nutzt einen Orbit-Slot und benötigt nie eigene Level.',
    },
    FOUNDRY: {
      name: 'Gießerei',
      tag: 'Jede Stunde mehr Erz',
      role:
        'Erhöht die passive Legierungs-, Kristall- und Deuteriumproduktion dieser Welt um 6 %.',
      blurb:
        'Unterstützt die Produktion aus dem Orbit und erhöht alle drei stündlichen Ressourcenströme sowie die daraus abgeleiteten Werke und Speicherkapazitäten.',
      detail: 'Die Gießerei wendet einen Multiplikator von 1,06 auf die passive Legierungs-, Kristall- und Deuteriumproduktion auf dieser Welt an. Damit erhöhen sich auch die daraus abgeleiteten Arbeits- und Lagergrenzen; Der Überfall-geschützte Betrag des Speichers gilt nicht. Es wirkt sich nicht auf Bergbauladeräume oder Schlachtzugsfracht aus.',
    },
    DERRICK: {
      name: 'Derrick',
      tag: 'Besseres Bergbauschiff',
      role:
        'Verleiht jedem Prospektor dieser Welt die 2-fache Tragfähigkeit und die 1,5-fache Reisegeschwindigkeit.',
      blurb:
        'Unterstützt die Bergbauschiffe dieser Welt aus dem Orbit. Größere Laderäume erhöhen die Anzahl der Transporte, während eine schnellere Reise ihre Chance erhöht, einen umkämpften Asteroiden rechtzeitig zu erreichen.',
      detail: 'Es multipliziert die Tragfähigkeit des Prospektoren mit dem 2-fachen und die Geschwindigkeit mit dem 1,5-fachen. Die Erforschung von Prospektor Holds vervielfacht den verbesserten Laderaum erneut. Der Derrick wechselt nur Bergbaufahrzeuge; Überfall-Fracht ist davon nicht betroffen.',
    },
    BEACON: {
      name: 'Leuchtfeuer',
      tag: 'Schnellere Flotten',
      role:
        'Lässt hier gestartete Überfall-, Transfer-, Handels- und Clan-Hilfsflotten auf beiden Strecken 1,3-mal schneller reisen.',
      blurb:
        'Ein Navigationszeichen für Überfall-, Transfer-, Handels- und Clan-Hilfsflotten. Kürzere Flüge bedeuten ein kürzeres Zeitfenster für Ihre Verteidigung auswärts.',
      detail: 'Sein Geschwindigkeitsmultiplikator von 1,3 gilt für ausgehende und zurückkehrende Überfall-, Transfer-, Handels- und Clan-Hilfsflotten, die hier gestartet werden. Es wirkt sich nicht auf Siedlungsflotten oder Prospektoren aus und es ändert weder Angriffs-, Rüstungs-, Fracht- noch Treibstoffkosten.',
    },
  },

  /**
   * THE THREE ROLES A FIGHT IS DECIDED BY, plus the one that is prey.
   *
   * Named separately from `hull.*.family` on purpose. Family is a PURCHASING
   * taxonomy — where a hull sits in the shipyard — and it runs at right angles to
   * this one: a Pike is Offensive and a Rampart Defensive, and the Rampart beats
   * the Pike. Teaching the two with one word was how the interface came to imply
   * the opposite of the rule it enforces.
   */
  combatClass: {
    SKIRMISHER: { name: 'Scharmützler', tag: 'Stark gegen Bollwerk; schwach gegen Lanze' },
    BULWARK: { name: 'Bollwerk', tag: 'Stark gegen Lanze; schwach gegen Scharmützler' },
    LANCE: { name: 'Lanze', tag: 'Stark gegen Scharmützler; schwach gegen Bollwerk' },
    SUPPORT: { name: '-Unterstützung', tag: 'Unbewaffnet; abgedeckt, solange Kriegsschiffe leben' },
  },

  hull: {
    DART: {
      name: 'Dart', tag: 'Zerbrechlicher Speed-Überfaller', role: "Das schnellste Einstiegskampfschiff. Seine Rumpfstärke ist gering.",
      pitch: "Hohe Geschwindigkeit verkürzt die Zeit fern vom Heimatplaneten. Die geringe Rumpfstärke erhöht das Verlustrisiko.",
      detail: "Ein günstiges Kampfschiff der Klasse Scharmützler. Es ist gegen Schiffe der Klasse Bollwerk im Vorteil und gegen die Klasse Lanze im Nachteil. Seine Geschwindigkeit eignet sich für kurze Angriffe. Prüfe vor dem Start die Verteidigungsklassen des Ziels; seine Rumpfstärke ist gering.",
    },
    PIKE: {
      name: 'Hecht', tag: 'Einstiegslanzenrumpf', role: 'Zu Darts Preis greift es härter an und hat weniger Hülle, mit Klassenvorteil gegenüber Scharmützlern.',
      pitch: 'Der Angriff übersteigt die Rumpfstärke: Eine härtere Eröffnungssalve erkauft ein zerbrechlicheres Schiff.',
      detail: 'Pike ist eine Einstiegslanze, die Scharmützler wie Dart und Thorn jagt. Für den Dart-Preis erhält man mehr Angriff und weniger Rumpf und fliegt langsamer. Bollwerkrümpfe und Bastionen wirken dem entgegen, sodass eine reine Pikenflotte eine klare und wirksame Antwort hat.',
    },
    RAMPART: {
      name: 'Wall', tag: 'Eintrittsfestung', role: 'Zum Preis des Wächters erhält man mehr Haltbarkeit, greift aber weniger an und verlangsamt die Flotte stärker.',
      pitch: 'Absorbiert Lanzenfeuer effizient; anfällig für Scharmützlerschwärme.',
      detail: 'Ein langsamer Linienrumpf der Bollwerkklasse. Es erkauft Überleben statt Angriff und eignet sich am besten, wenn die Reisezeit weniger wichtig ist als das Halten der Formation.',
    },
    WARDEN: {
      name: 'Aufseher', tag: 'Mobile Begleitung', role: 'Zum Rampart-Preis greift es härter an und fliegt schneller, hat aber weniger Hülle.',
      pitch: 'Tauscht einen Teil der Festungshaltbarkeit gegen Angriff und gemischtes Flottentempo.',
      detail: 'Warden ist eine mobile Bollwerk-Eskorte mit demselben Ressourcenpreis wie Rampart. Sein reiner Angriff und seine Geschwindigkeit sind höher und seine Hüllenstärke ist geringer. Wall passt zu einer statischen Wand; Warden passt zu einer gemischten Flotte, die Tempo braucht.',
    },
    COURIER: {
      name: 'Kurier', tag: 'Schneller leichter Transport', role: 'Einstiegsfrachtrumpf; schnell, leicht geschützt und unbewaffnet.',
      pitch: 'Hält mit Festungs- und Lanzenflotten Schritt, verlangsamt aber die schnellsten Scharmützlerformationen.',
      detail: 'Ein Unterstützungsrumpf für Beute, Transfers und Siedlung. Es verursacht keinen Schaden und ist nur geschützt, solange die Kampfeskorte überlebt.',
    },
    VIPER: {
      name: 'Viper', tag: 'Effizienter Überfaller', role: 'Geschwindigkeit der Stufe zwei und besseres Überleben als Dart.',
      pitch: "Mehr Angriff und Rumpfstärke als Dart bei gleicher Basisgeschwindigkeit.",
      detail: 'Ein forschungsfreier Scharmützler der zweiten Stufe. Dart bleibt billiger, während beide Rümpfe die gleiche Geschwindigkeit haben. Viper setzt sein größeres Engagement in mehr Angriff, Rumpf, Ladung und eine bessere Kampfeffizienz bei gleichen Kosten um.',
    },
    TALON: {
      name: 'Kralle', tag: 'Schwerer Stürmer', role: 'Zum Viper-Preis greift es wesentlich härter an, hat weniger Hülle, fliegt langsamer und kontert Scharmützler.',
      pitch: 'Angriff übersteigt Hüllenstärke; Ein zerbrechlicheres Schiff gleicht seinen höheren Schaden aus.',
      detail: 'Ein Schadensrumpf der Lanzenklasse für entwickelte Werften. Bollwerk-Marken sind immer noch wichtiger als ihr Stufenvorteil.',
    },
    STRONGHOLD: {
      name: 'Festung', tag: 'Schwerer Rumpf', role: 'Zum Sentinel-Preis hat es die höchste Haltbarkeit der Stufe 2, aber weniger Angriff und Geschwindigkeit.',
      pitch: 'Baut eine Mauer, wenn das Überleben wichtiger ist als die Ankunftszeit.',
      detail: 'Ein Bollwerk im Festungsprofil. Sein hoher Rumpf verankert Flotten, während Scharmützler und Langzeitexponierung klare Kosten bleiben.',
    },
    SENTINEL: {
      name: 'Sentinel', tag: 'Eskorte der zweiten Stufe', role: 'Zum Stronghold-Preis greift es härter an und fliegt schneller, hat aber weniger Hülle.',
      pitch: 'Tauscht Festungshaltbarkeit gegen Angriffs- und Flottentempo.',
      detail: 'Eine mobile Bollwerk-Eskorte, die Transporte schützt, ohne das Stronghold-Reiseprofil zu erzwingen.',
    },
    WAYFARER: {
      name: 'Wanderer', tag: 'Ausgewogener Transport', role: 'Mehr Kapazität als Kurier; langsamer, aber immer noch flexibel.',
      pitch: 'Die mittlere Wahl zwischen schnellem Kurier und Atlas mit hoher Kapazität.',
      detail: 'Ein Unterstützungstransporter der zweiten Stufe für größere Überfälle und Transfers. Es bleibt unbewaffnet und ist auf Kampfeskorten angewiesen.',
    },
    TEMPEST: {
      name: 'Sturm', tag: 'Fortgeschrittener Speed-Überfaller', role: 'Scharmützler der Stufe 3 mit Forschungszugriff; teilt sich die höchste reine Kampfgeschwindigkeit mit Dart, Viper und Corsair.',
      pitch: 'Late-Game-Geschwindigkeit mit verbesserter Effizienz, immer noch kein Linienschiff.',
      detail: 'Ein fortgeschrittener Überfaller, freigeschaltet durch Technik und Schiffskraft. Es behält ein fragiles Profil bei, sodass Wände und Theken in den unteren Ebenen weiterhin relevant bleiben.',
    },
    BALLISTA: {
      name: 'Balliste', tag: 'Fortgeschrittener Stürmer', role: 'Zum Preis von Tempest greift es wesentlich härter an, hat weniger Hülle und fliegt langsamer als eine Lanze der Stufe drei.',
      pitch: 'Der Angriff übersteigt die Hüllenstärke, aber hoher Schaden rettet ihn nicht vor der rechten Bollwerkswand.',
      detail: 'Ein Angriffsrumpf der Stufe 3, der Ingenieurskunst und Schiffskraft erfordert. Er belohnt ein informiertes Ziel und nicht die blinde Produktion einer Monoflotte.',
    },
    LEVIATHAN: {
      name: 'Leviathan', tag: 'Fortgeschrittene Festung', role: 'Zum Preis des Prätorianers erhält man mehr Hülle, aber weniger Angriff und Geschwindigkeit für eine Mauer der Stufe 3.',
      pitch: 'Eine Late-Game-Wall, die jeden Flug zu einer langen Verpflichtung macht.',
      detail: 'Eine Festung der Stufe 3, die durch Ingenieurskunst und Schiffspanzerung freigeschaltet wird. Scharmützler bleiben sein effizienter Konter.',
    },
    PRAETORIAN: {
      name: 'Prätorianer', tag: 'Fortgeschrittene Eskorte', role: 'Zu Leviathans Preis greift es härter an und fliegt schneller, hat aber weniger Hülle.',
      pitch: 'Tauscht einen Teil der Festungshaltbarkeit gegen Angriff und gemischtes Flottentempo.',
      detail: 'Eine Bollwerk-Eskorte der Stufe drei, die Technik und Schiffspanzerung erfordert. Es schützt die Ladung, ohne zur langsamsten Wahl zu werden.',
    },
    ATLAS: {
      name: 'Atlas', tag: 'Schwertransport der dritten Stufe', role: 'Der größte Laderaum der dritten Stufe; langsam, sperrig und forschungsorientiert.',
      pitch: "Transportiert große Ressourcenmengen. Es ist unbewaffnet; schicke bei einem Angriff Kampfschiffe als Eskorte mit.",
      detail: 'Ein Unterstützungstransporter der Stufe 3, freigeschaltet durch Technik und Antrieb. Es verursacht keinen Schaden und macht die Planung einer Eskorte unerlässlich.',
    },
    NULLIFIER: {
      name: 'Nullifier',
      tag: 'Durchbricht aktive Schilde',
      role: 'Ein angriffsgesteuerter Lanzenspezialist: Der Angriff übersteigt die Hüllenstärke und hat das Fünffache seiner normalen Wirkung gegen einen aktiven Schild.',
      pitch: 'Zerschmettert eine Aegis, ohne Bonusschaden in Einheitentötungen umzuwandeln. Schwach, wenn kein Schild steht.',
      detail: 'Seine Spezialladung fügt einer aktiven Aegis den fünffachen normalen Effekt zu. Sobald der Schild fällt, wirkt sich dieser Bonus nicht auf Schiffe oder Geschütze aus, sodass nicht abgeschirmte Ziele seine Prämie verschwenden.',
    },
    /** D200. `{{salvage}}` is `SALVAGE.perCollector`, filled in by `names.ts`. */
    GARBAGE_COLLECTOR: {
      name: 'Garbage Collector',
      tag: 'Hebt {{salvage}} des Wracks',
      role: 'Spezialunterstützungsrumpf: Feuert nichts ab und sammelt nach dem Gefecht, in das er geflogen ist, Wrackteile ein.',
      pitch: 'Fliegt wie ein Transporter hinter der Linie und macht die letzten Schüsse. Halten Sie Kriegsschiffe daneben – sobald sie fallen, ist es Beute.',
      detail: 'Wenn die Schlacht endet, hebt jeder noch lebende Sammler bis zu {{salvage}} des Wracks hoch – in der wrackeigenen Mischung aus Legierung, Kristall und Deuterium – bevor der Rest als öffentliches Feld treibt. Der Transport landet im Lager der Flotte. Es fügt dem Laderaum nichts hinzu, kann nicht ohne ein Kriegsschiff fliegen, kann nicht auf ein Wrackfeld oder einen Asteroiden geschickt werden und sammelt bei der Verteidigung nichts ein.',
    },
    CATACLYSM: {
      name: 'Katastrophe', tag: 'Hauptweltstürmer', role: 'Zum Preis von Corsair greift es wesentlich härter an, hat weniger Hülle und fliegt langsamer als eine Lanze der Stufe 4.',
      pitch: 'Angriff übersteigt Hüllenstärke; ein fragileres Schiff und Klassenkonter gleichen seine harte Salve aus.',
      detail: 'Ein großartiger Lanze-Rumpf hinter Technik, Kraft und Panzerung. Seine Effizienz ist höher, aber die Verteidigung der Bollwerk-Klasse ist immer noch eine bessere Antwort als eine Spiegelung.',
    },
    CORSAIR: {
      name: 'Corsair',
      tag: 'Hauptwelträuber',
      role: 'Der einzige Scharmützler der obersten Stufe – was eine Bollwerksmauer durchbricht.',
      pitch: 'Zum Preis von Cataclysm ist es schneller und härter, greift aber weniger an und hat einen geringeren Halt.',
      detail: 'Corsair ist der einzige Scharmützler der Stufe 4 und teilt sich die höchste Kampfgeschwindigkeit mit Dart, Viper und Tempest. Es hat weniger rohe Angriffe als Cataclysm, erhält aber den Scharmützler-Vorteil gegen Zitadellenmauern; Ziele der Lanzenklasse wirken dem entgegen.',
    },
    CITADEL: {
      name: 'Zitadelle', tag: 'Hauptstadtfestung', role: 'Zu Paladins Preis hat es mehr Hülle, weniger Angriff und die langsamste Kampfgeschwindigkeit der Stufe 4.',
      pitch: 'Die stärkste Wand, bezahlt durch Kosten und Belichtungszeit.',
      detail: 'Ein Bollwerk-Rumpf der Extraklasse, der sich durch Technik, Panzerung und Kraft auszeichnet. Es verankert die Verteidigung, bleibt aber anfällig für Plänkler-Konter.',
    },
    PALADIN: {
      name: 'Paladin',
      tag: 'Hauptstadt-Eskorte',
      role: 'Zum Citadel-Preis greift es härter an und fliegt schneller, hat aber weniger Hülle.',
      pitch: 'Eine Eskorte der Stufe 4, die einen Teil der Festungshaltbarkeit gegen Angriffs- und Flottentempo eintauscht.',
      detail: 'Der Paladin gehört zur Bollwerk-Klasse, also stoppt er Lanzen und fällt Scharmützlern zum Opfer. Die Prämie, die eine Citadel für die Rüstung zahlt, wird stattdessen für Waffen ausgegeben – die einzige Option zwischen den beiden Extremen der vierten Stufe.',
    },
    ARGOSY: {
      name: 'Argosy',
      tag: 'Hauptwelttransporter',
      role: 'Der tiefste Laderaum im Spiel und der langsamste Transporter.',
      pitch: "Bietet den größten Frachtraum. Seine geringe Geschwindigkeit kann die Reisezeit der Flotte verlängern.",
      detail: 'Der Argosy ist das Transportmittel der vierten Stufe. Unterstützungsklasse, daher ist sie abgeschirmt, solange Kampfrümpfe aktiv sind, und wehrlos, sobald die Linie verschwunden ist. Das Tempo des Händlers ist an diesen Rumpf gebunden: Der langsamste Laderaum im Katalog bestimmt ihn.',
    },
    BASTION: {
      name: 'Bastion',
      tag: 'Schwere Bodengeschütze',
      role: 'Bodenverteidigung · kann den Planeten niemals verlassen',
      pitch: 'Schwere Bodenverteidigung mit einem Vorteil gegenüber Rümpfen der Lanzenklasse; anfällig für Scharmützler.',
      detail: 'Bastionen verlassen niemals den Planeten. Ihre Bollwerk-Klasse verschafft ihnen einen Vorteil gegenüber Rümpfen der Lanzenklasse, während Scharmützler ihnen gegenüber einen Vorteil haben. Nach dem Kampf werden 60 % der zerstörten Bodengeschütze wiederhergestellt (abgerundet).',
    },
    HARPOON: {
      name: 'Harpune', tag: 'Lanzen-Bodengeschütz', role: 'Bodenverteidigung · ortsfeste Lanzenstellung',
      pitch: 'Durchbricht Plänklerformationen; anfällig gegen Bollwerke.',
      detail: 'Harpunen verlassen den Planeten nie. Als Lanzen haben sie einen Vorteil gegen Plänkler, während Bollwerke sie kontern. Sie belegen Bodenkapazität; 60 % zerstörter Bodengeschütze werden nach dem Kampf abgerundet wiederhergestellt.',
    },
    THORN: {
      name: 'Dorn',
      tag: 'Leichte Bodengeschütze',
      role: 'Bodenverteidigung · leicht, günstig und blättert nie ab',
      pitch: 'Kostengünstige Bodenverteidigung mit Vorteil gegenüber Bollwerken; anfällig für Lanzen.',
      detail: 'Dornen verlassen niemals den Planeten. Ihre Scharmützler-Klasse verschafft ihnen einen Vorteil gegenüber Rümpfen der Bollwerkklasse, während Rümpfe der Lanzenklasse ihnen gegenüber im Vorteil sind. Sie nutzen die Bodenkapazität; 60 % der zerstörten Bodengeschütze werden nach dem Kampf wiederhergestellt, abgerundet.',
    },
    PROSPECTOR: {
      name: 'Prospektor',
      tag: 'Miniert Asteroiden',
      role: 'Minen von Asteroiden mit einer Basiskapazität von 200 · kann keiner Schlachtzugsflotte beitreten',
      pitch: 'Fängt einen sich bewegenden Asteroiden ab und gibt alles, was er transportieren kann, an die Werke zurück. Es kann nicht geplündert oder transferiert werden.',
      detail: 'Ein Prospektor kann nur zu aufgedeckten Asteroiden und Trümmerfeldern geschickt werden. Seine Grundgeschwindigkeit auf dem Hinweg und bei leerem Rückflug beträgt 1238; beladen kehrt er mit 619 zurück. Sein Grundladeraum beträgt 200; Derrick- und Prospektor-Holds-Forschung können diese Werte verbessern. Jede Welt beginnt mit Platz für zwei; Prospektor Holds III eröffnet einen dritten Schiffsplatz. Er beteiligt sich nie an Angriffen oder der Heimatverteidigung.',
    },
  },

  resource: {
    alloy: '-Legierung',
    crystal: 'Kristall',
    deuterium: 'Deuterium',
  },

  /** The four things a season can hand you, announced the moment they open. */
  unlock: {
    TELESCOPE: {
      title: 'Teleskop entsperrt',
      body: 'Ein Uplink und ein Teleskop identifizieren Bewegungen weiter draußen und ermöglichen die Beobachtung eines Planeten.',
    },
    RADAR: {
      title: 'Radar freigeschaltet',
      body: 'Eine Uplink- und Radarfangsonde; Ab L1 markiert sein Kreis auch auf Sie gerichtete Bedrohungen mit ihrer Ankunftszeit.',
    },
    EXPLORER: {
      title: 'Explorer freigeschaltet',
      body: "Sende eine Sonde, um die Flotte und Ressourcen des Ziels zu erkunden. Der Bericht kann Schätzungen enthalten; das Ziel kann den Scan bemerken.",
    },
    VEIL: { title: 'Schleier freigeschaltet', body: 'Ihr Flottenstatus kann für jeden, der zuschaut, als UNBEKANNT angezeigt werden.' },
  },
} as const;

/** WHAT YOU GET IF YOU PRESS IT. */
export const gains = {
  rangeUnits: '{{count}} Einheiten',

  core: {
    label: 'Decke bauen',
    level: 'L{{level}}',
    releases_one: 'Gibt das {{count}} blockierte Upgrade frei',
    releases_other: 'Gibt {{count}} blockierte Upgrades frei',
    raisesCap: 'Erhöht die Niveauobergrenze für Gebäude',
  },
  hangar: {
    label: 'Flottenraum',
    value: '{{room}} Raum',
    none: 'Kein Hangar',
    ceiling: 'Bis zu {{room}} auf der obersten Sprosse',
  },
  refinery: {
    label: 'Legierung pro Stunde',
    rate: '{{amount}}/h',
    storage: 'Speicher {{now}} → {{next}}',
  },
  extractor: {
    label: 'Kristall pro Stunde',
    rate: '{{amount}}/h',
    storage: 'Speicher {{now}} → {{next}}',
  },
  vault: {
    label: 'Speichertiefe',
    value: '{{store}}h Speicher · {{safe}}h geschützt',
  },
  shipyard: {
    accuracyLabel: 'Sondengenauigkeit',
    seesLabel: 'Sieht durch einen Schleier bis zu',
    seesValue: 'L{{level}}',
    unlocksHull: 'Schaltet den {{hull}} frei',
    stealth: 'Und macht Ihre eigenen Sonden schwerer zu erkennen',
  },

  telescope: {
    slotsLabel: 'Planeten, die Sie beobachten können',
    rangeLabel: 'Wie weit Sie sehen können',
    maxed: 'Oberste Ebene: {{slots}} Uhrenslots und {{range}} Einheiten des beweglichen Kontaktvisiers; genug, um die Galaxie zu umspannen',
    reachAndCooldown: 'erreicht {{range}} · ein Slot wird in {{hours}}h neu ausgerichtet',
    nextSlot: 'Die nächste Ebene fügt einen {{ordinal}}-Slot hinzu',
    ordinalSecond: '2',
    ordinalThird: '3',
    ordinalFourth: '4',
    cooldown: 'Ein Slot wird in {{hours}}h neu ausgerichtet',
  },
  radar: {
    scansLabel: 'Erkennt Scans',
    scansNo: 'no',
    scansYes: 'ja',
    scansBearing: 'ja, mit Lager',
    sweepLabel: 'Kontaktbereich · zeitgesteuerte Warnung',
    sweepNone: 'keine',
    reaches: '{{sense}} Kontakt (keine voraussichtliche Ankunftszeit) · {{warn}} zeitgesteuerte Warnung',
    maxed: 'Oberste Ebene; Warnungen verraten auch die Ursprungswelt und die genaue Flotte',
    l1: "Verbessert die Sondenerkennung. Warnt vor der Ankunft, sobald eine anfliegende Flotte in Radarreichweite kommt.",
    bearing: 'L2 verrät auch die Anflugrichtung',
    interception: "L3 erlaubt dieser Welt, Abfangladungen zu laden (Uplink nötig)",
    estimate: 'Zeigt die grobe Größe der herannahenden Kraft frühzeitig an',
    origin: 'Die Warnung nennt die Ursprungswelt und die genaue Flotte',
  },
  aegis: {
    label: 'Max. Schild',
    unlocks: 'Absorbiert Schaden, bevor es Einheiten tun · regeneriert jede Stunde {{percent}} % des Maximums',
  },
  veil: {
    label: 'Blendet ein Teleskop bis zu',
    none: 'keine',
    level: 'L{{level}}',
    unlocks: "Reduziert die Genauigkeit einer Sonde auf {{percent}} bei gleicher Werft",
  },

  foundry: {
    label: 'Stündliche Ressourcenproduktion',
    now: 'Stromausgang',
    next: '+{{percent}}%',
    unlocks: 'Gilt für die Legierungs-, Kristall- und Deuteriumproduktion auf dieser Welt',
  },
  uplink: {
    label: 'Teleskop und Radar',
    now: 'gesperrt',
    next: 'freigeschaltet',
    unlocks: 'Auf dieser Welt können ein Teleskop und ein Radar installiert werden',
  },
  derrick: {
    label: 'Jeder Prospektor trägt',
    now: '1×',
    next: '{{factor}}×',
    unlocks: 'Prospektoren reisen auch {{factor}}× schneller',
  },
  beacon: {
    label: 'Überfall-, Transfer-, Handels- und Hilfsflotten',
    now: 'normale Geschwindigkeit',
    next: '{{factor}}× schneller',
    unlocks: 'Hin und zurück – ein kürzeres Zeitfenster mit Ihrer Verteidigung auswärts',
  },
  /** Every research row names the quantity or permission the player actually buys. */
  research: {
    powerLabel: 'Kriegsschiffangriff',
    powerScope:
      'Jedes Kriegsschiff Ihrer Flotte. Kraft und Panzerung ergeben zusammen höchstens 56 % der Kampfkraft mit gleichem Budget; Transporte und Bodenverteidigung bleiben davon unberührt.',
    armorLabel: 'Schiffsrumpfstärke',
    armorScope:
      'Alle Schiffe Ihrer Flotte, inklusive Transporte. Kraft und Panzerung ergeben zusammen höchstens 56 % der Kampfkraft mit gleichem Budget; Die Bodenverteidigung bleibt davon unberührt.',
    speedLabel: 'Flottengeschwindigkeit',
    speedScope:
      'Alle Schiffe Ihrer Flotte. Eine gemischte Flotte fliegt immer noch mit der – verbesserten – Geschwindigkeit ihres langsamsten Mitglieds; Prospektoren und Sonden sind davon nicht betroffen.',
    engineeringLabel: 'Zugang zur Rumpfebene',
    engineeringTier: 'Stufe {{tier}}',
    engineeringScope:
      'Technik I eröffnet Stufe 3 und Technik II eröffnet Stufe 4. Einzelne Rümpfe können auch Energie, Panzerung, Antrieb oder Gravitationsladungen erfordern.',
    groundLabel: 'Bodenverteidigungsstärke',
    groundScope: '{{bastion}}, {{harpoon}} und {{thorn}} auf jeder Welt, die du besitzt.',
    yardLabel: 'Schiffsbauzeit',
    robotsLabel: 'Strukturerstellungszeit',
    holdsLabel: 'Prospektor-Haltestelle',
    holdsScope: 'Multipliziert sich mit einem Derrick im Orbit.',
    cargoLabel: 'Überfall-Fracht',
    cargoScope: 'Nur Beute – Welttransfers und Bergbau bleiben unverändert.',
    industrialLabel: 'Reparaturkosten und -dauer',
    industrialScope: "Nur die Reparaturstation – der Schiffbau bleibt unverändert.",
    refineryLabel: 'Raffineriedecke',
    stockpileLabel: "Todessterne pro Welt",
    gridLabel: "Ladungen pro Welt",
    /* A permission opens a door; drawing it as a ladder would invent a quantity. */
    opensLabel: 'Entsperrt',
    open: 'Öffnen',
    shut: 'Gesperrt',
    isotopeOpens: 'Isotopen-Asteroiden werden zu auswählbaren Bergbauzielen.',
    denseOpens: 'Forschung zu Schiffsantrieben wird verfügbar.',
    graviticOpens: 'Die Anforderungen an die Fachforschung des Nullifiers sind erfüllt.',
  },
  plant: {
    label: 'Deuterium',
    value: '{{rate}}/h',
    storage: 'Kraftstoffspeicher {{now}} → {{next}}',
  },
} as const;

/** The situation engine: what a competent player would be thinking about now. */
export const directives = {
  inboundTitle: 'Eingehende Flotte · {{duration}}',
  inboundDetail:
    "Du kannst gefährdete Ressourcen ausgeben, deine Flotte losschicken oder die Verteidigung verstärken. Schiffe im Flug können diesen Planeten nicht verteidigen.",
  inboundAction: 'Jetzt ausgeben',

  undefendedTitle: 'Diese Welt hat keine Bodenverteidigung',
  undefendedShieldedTitle: 'Ihr Schild endet in {{duration}}: Bauen Sie eine Bodenverteidigung',
  undefendedDetail: '{{amount}} ist Überfalls ausgesetzt. Bauen Sie Dornen oder Bastionen zur dauerhaften Verteidigung.',
  undefendedAction: 'Verteidigung aufbauen',

  exposedTitle: '{{amount}} kann von Ihnen genommen werden',
  exposedDetail: "Der Speicher schützt {{now}} Ressourcen vor Angriffen. Die nächste Stufe schützt {{next}}.",
  exposedAction: "Speicher ausbauen",

  scannedTitle_one: 'Jemand hat Sie gescannt',
  scannedTitle_other: '{{count}} scannt gegen Sie',
  scannedDetail: 'Sie versuchen, Ihren Bestand und Ihre Verteidigung kennenzulernen. Ein Schleier reduziert, was ihre Sonde enthüllen kann.',
  scannedAction: 'Siehe Protokoll',

  windowTitle: "Die Flotte von {{name}} ist weg",
  windowDetailUnknownJustNow: 'Gerade gesehen. Sie wissen nicht, wann es zurückkommt.',
  windowDetailUnknown: 'Vor {{age}} gesehen. Sie wissen nicht, wann es zurückkommt.',
  windowDetailEta:
    'Zurück in etwa {{duration}}. Ihr Planet enthält alles, was sie zurückgelassen haben.',
  windowAction: 'Öffnen Sie das Fenster',

  storageFullTitle: '{{amount}} kann nicht gesammelt werden',
  storageFullDetail:
    'Ihr Laden ist voll, sodass die Werke nirgendwo entleert werden können. Gib etwas aus und beanspruche es.',
  storageFullAction: 'Gib es aus',

  noTelescopeTitle: 'Sie können nur mit bloßem Auge sehen',
  noTelescopeDetail:
    'Ihre freie Sicht kann bereits einen vorbeiziehenden Asteroiden in der Nähe erkennen. Ein Teleskop erweitert den Entdeckungsbereich, identifiziert weiter entfernte Schiffe und kann stillschweigend einen Planeten beobachten, um Ihnen mitzuteilen, wann seine Flotte abfliegt.',
  noTelescopeAction: 'Installieren Sie ein Teleskop',

  noRadarTitle: 'Eine Flotte könnte hier ohne Vorwarnung landen',
  noRadarDetail: 'Radar L1 markiert bereits eine auf Sie gerichtete Bedrohung mit der Ankunftszeit innerhalb des Kreises. Höhere Ebenen erweitern den Bereich und offenbaren mehr Details.',
  noRadarAction: 'Schauen Sie sich Radar an',

  coreCeilingTitle: 'Kommandokern blockiert {{count}}-Upgrades',
  coreCeilingDetail: "Der Befehlskern begrenzt Gebäudestufen, außer beim Hangar. Verbessere zuerst den Kern, um diese Grenze zu erhöhen.",
  coreCeilingAction: 'Erhöhe den Kern',

  idleTitle: 'Nichts ist im Flug',
  idleDetailHasShips: 'Ihre Buchten sind leer. Sie können einen Überfall-, Transfer- oder Mining-Lauf starten; Sonden verwenden keine Buchten.',
  idleDetailNoShips: 'Du hast keine Schiffe zu Hause. Bauen Sie welche oder warten Sie, bis Ihre zurückkommt.',
  idleAction: 'Finde ein Ziel',

  baysFreeTitle_one: 'Ein Schacht ist noch frei',
  baysFreeTitle_other: '{{count}} Einschübe sind noch frei',
  baysFreeDetail: 'Überfalls, Transfers und Mining-Runs dauern einen. Sonden verwenden keine Buchten.',
  baysFreeAction: 'Suchen Sie nach etwas',

  /** The card that carries the top directive. */
  kindThreat: 'Bedrohung',
  kindOpportunity: 'Gelegenheit',
  kindGrowth: 'Schwäche',
  kindIdle: 'Nichts ausstehend',

  /** The fold. One word each way: the card is small enough that a label is the control. */
  hide: 'Ausblenden',
  show: 'Anzeigen',
} as const;

/** The seven kinds of news, turned into the sentences a player reads. */
export const notifications = {
  incomingFallback: 'Eingehende Flotte.',
  incomingLanded: 'ist gelandet',
  incomingEta: 'ETA {{minutes}} min',
  incomingLandsIn: 'landet in {{duration}}',
  incomingHead: 'Eingehende Flotte · {{clock}}',
  strategicIncomingHead: 'Strategische Waffe im Eingang · {{clock}}',
  incomingEstimate: 'geschätzt. {{count}} wird versendet',
  incomingFrom: 'von {{origin}}',
  /** Which of the reader's own worlds is under the crosshair. Never a radar product. */
  incomingAt: 'zielt auf {{world}} ab',
  commanderAt: '{{username}} bei {{planet}}',
  unknownCommander: 'jemand',
  raidedBy: 'Überfaller: {{origin}} ·',
  composition: '{{count}} {{hull}}',
  join: ' · ',

  raidedFallback: 'Sie wurden überfallen.',
  repelledHead: 'Überfall abgewehrt · {{cost}}',
  repelledLost: '{{count}} hat den Besitz verloren',
  repelledTheirs: '{{count}} von ihnen zerstört',
  raided: 'überfallen · {{detail}}',
  raidedWorks: 'Produktion reduziert für {{time}}',
  raidedTaken: '−{{amount}} genommen',
  raidedLost_one: '{{count}} Einheit verloren',
  raidedLost_other: '{{count}} Einheiten verloren',
  dockedClause_one: "{{count}} Schiff zur Reparaturstation",
  dockedClause_other: "{{count}} Schiffe zur Reparaturstation",
  patchedClause_one: "{{count}} kostenlos repariert",
  patchedClause_other: "{{count}} kostenlos repariert",
  damagedClause_one: "{{count}} kehrt beschädigt heim",
  damagedClause_other: "{{count}} kehren beschädigt heim",
  radiationLostAll_one: "Strahlung hat dein Schiff {{way}} zerstört",
  radiationLostAll_other: "Strahlung hat alle {{count}} Schiffe {{way}} zerstört",
  radiationLost_one: "Strahlung hat {{count}} Schiff {{way}} zerstört · noch {{left}} unterwegs",
  radiationLost_other: "Strahlung hat {{count}} Schiffe {{way}} zerstört · noch {{left}} unterwegs",
  radiationWay: "unterwegs",
  radiationWayTo: "auf dem Weg nach {{name}}",
  raidedNothing: 'Überfallen · Sie haben nichts',
  /** Taktik geri çekilme, Verteidiger: die Schiffe sind abgehoben, oder der Tank reichte nicht. */
  raidedEscaped_one: '{{count}} Schiff abgehoben',
  raidedEscaped_other: '{{count}} Schiffe abgehoben',
  raidedStranded_one: 'der Tank reichte nicht für {{count}} Schiff',
  raidedStranded_other: 'der Tank reichte nicht für {{count}} Schiffe',
  /** Taktik geri çekilme, Angreifer: die Linie leerte sich — nichts über ihren Inhalt. */
  raidTargetFled: 'ihre Schiffe sind abgehoben',

  raidResultFallback: 'Dein Überfall wurde gelöst.',
  raidWiped: '{{target}} gehalten · Ihre Flotte wurde zerstört · {{count}} Schiffe verloren',
  raidResult: '{{grade}} bei {{target}} · {{detail}} · {{count}} Schiffe verloren',
  raidNothing: 'nichts vergeben',
  spoilAlloy: '+{{amount}} Legierung',
  spoilCrystal: '+{{amount}} Kristall',
  spoilDeuterium: '+{{amount}} Deuterium',
  /** What a raid's Garbage Collectors lifted off the wreck — never counted as loot. D200. */
  spoilSalvage: '+{{amount}} Bergung',

  fleetFallback: 'Ihre Flotte ist zu Hause.',
  fleetHomeLooted: 'Flottenheimat{{where}} · {{count}} Schiffe · +{{amount}} geplündert',
  fleetHomeEmpty: 'Flottenheimat{{where}} · {{count}} Schiffe · mit leeren Händen',
  fleetHomeRecalled: 'Flotte zurück{{where}} · {{count}} Schiffe · vor dem Angriff zurückgerufen',
  /** Nothing looted, but the collectors' salvage follows it — so not "empty-handed". */
  fleetHomeBare: 'Flottenheimat{{where}} · {{count}} Schiffe',
  /**
   * THE MERCHANT'S OWN HOMECOMING. D166.
   *
   * A swap is not a raid, so it never borrows the plunder wording — and a
   * convoy that bought nothing is a different fact from a fleet that found
   * nothing, which is why the empty case has its own line.
   */
  tradeHome: 'Konvoi-Startseite · {{count}} Schiffe · gekauft {{landed}}',
  tradeHomeEmpty: 'Konvoi-Startseite · {{count}} Schiffe · nichts gekauft',
  /**
   * THE PIRATE LANE HAS ITS OWN HOMECOMING AND ITS OWN EMPTY TRIP. D177.
   *
   * A pirate is not a commander: there is no world to come back FROM by name
   * and no ledger that moved, so these never borrow the raid's wording. And a
   * flight that arrived at nothing is a different fact from one that fought and
   * lost — it names what was gone and how many craft are turning back, and never
   * who got there first.
   */
  targetGonePirate: 'Pirat {{callsign}} wurde bereits zerstört · {{count}} Schiffe kehren um',
  targetGoneAsteroid: 'Der Stein wurde abgetragen, bevor Sie ankamen · {{count}} Bohrer drehen sich um',
  targetGoneDebris: 'Das Wrackfeld wurde bereits bereinigt · {{count}} Bohrer drehen um',
  pirateHome: 'Rückkehr der Piraten · {{count}} Schiffe · +{{amount}} geplündert',
  pirateHomeEmpty: 'Rückkehr der Piraten · {{count}} Schiffe · mit leeren Händen',
  pirateHomeRecalled: "Rückkehr der Piraten · {{count}} Schiffe · vor dem Gefecht zurückgerufen",
  pirateHomeBare: 'Rückkehr der Piraten · {{count}} Schiffe',
  pirateHomeTowed_looted: 'Rückkehr der Piraten · {{count}} Schiffe · +{{amount}} geplündert · {{hull}} gefangen',
  pirateHomeTowed_empty: 'Rückkehr der Piraten · {{count}} Schiffe · {{hull}} gefangen',
  fleetFrom: 'von {{origin}}',
  probeLost: 'Ihre Sonde ging verloren · dieser Flug konnte nicht abgeschlossen werden',
  recalled: '{{count}} Raumschiff zurückgekehrt · dieser Flug konnte nicht abgeschlossen werden',
  miningRecalledHome: '{{count}} Prospektoren-Startseite · Rückruf abgeschlossen',
  transferReturningCapacity: 'Transfer zurück von {{target}} · Zielkapazität im Flug gefüllt',
  transferReturningOwnership: 'Transfer zurück von {{target}} · die Welt wechselte im Flug den Besitzer',

  salvageWord: 'Bergung',
  oreWord: 'Erz',
  haulWasted: '{{what}} Startseite · keine Kapazität verfügbar · {{amount}} verworfen',
  haulNothing: '{{what}} nach Hause rennen · nichts mehr zum Mitnehmen übrig',
  haulPartly: '{{what}} Startseite · {{landed}} · {{amount}} verloren, funktioniert voll',
  haul: '{{what}} Startseite · {{landed}}',

  scanDetected: 'Scan erkannt. Jemand sammelt Informationen über Ihre Welt.',

  probeFallback: 'Eine Sonde ist zu Hause. Sein Bericht ist lesbar.',
  probeHome: 'Probe-Home · {{target}} ist lesbar{{caught}}',
  probeCaught: '· sie haben es erwischt',

  unlock: '{{title}} – {{body}}',
  deathStarFallback: 'Dein Todessternangriff wurde gelöst.',
  deathStar: {
    FIRST_STRIKE: 'EMP-Einschlag · Aegis entladen; Bodenverteidigungen 1 Stunde offline',
    CAPTURED: 'Einschlag des Todessterns · Kolonie erobert',
    INEFFECTIVE: 'Einschlag des Todessterns · keine Auswirkung',
  },
  colonyCaptured: 'Kolonie gesichert · Besatzungsschutz ist aktiv',
  colonyLost: "{{planet}} ist abgefallen und neutral geworden",
  colonyLostUnnamed: "Eine Kolonie ist abgefallen und neutral geworden",
  deathStarColony: "EMP-Treffer · Loyalität der Kolonie {{before}} % → {{after}} %",
  deathStarSeceded: "EMP-Treffer · die Kolonie ist abgefallen und neutral geworden",
  colonyFault: '{{planet}} · {{fault}}',
  colonyLoyalty: '{{planet}} rutscht ab – {{count}} Dinge sind kaputt und es erklärt die Unabhängigkeit in {{time}}.',
  settlementLost: 'Siedlungsrennen verloren · die Kuriere und die Fracht kehren zurück',
  interceptedDefended: 'Dein Gitter hat einen Todesstern zerstört. {{range}} Einheiten.',
  interceptedLost: 'Ihr Todesstern wurde {{range}} Einheiten vor seinem Ziel zerstört.',
  interceptedFallback: 'Ein Todesstern wurde im Flug zerstört.',
  asteroidShowerStarted: 'Ein Asteroidenschauer hat in der Galaxie begonnen.',
  asteroidShowerEnded: 'Der Asteroidenschauer ist beendet · der Asteroidenspawn ist wieder normal.',
  tradeShipStarted: 'Ein Handelsschiff befindet sich in der Galaxie · {{alloy}} Legierung = 1 Deuterium.',
  tradeShipEnded: 'Das Handelsschiff hat die Galaxie verlassen.',
  intergalacticConvoyStarted: 'Der Intergalaktische Konvoi durchquert die Galaxie.',
  intergalacticConvoyEnded: 'Der Intergalaktische Konvoi ist abgereist.',
  intergalacticConvoyResult: 'Konvoi-Angriff gelöst · {{resources}} · Preis: {{ships}} · kehrt jetzt zurück.',
  intergalacticConvoyHome: 'Konvoi trifft ein · {{resources}} · Preis: {{ships}}.',
  intergalacticConvoyNoResources: 'keine Ressourcen',
  intergalacticConvoyNoShip: 'kein Schiff',
} as const;

/**
 * TIME AND NUMBERS.
 *
 * Format primitives rather than sentences: the unit letters a countdown is built
 * from, and the two words that carry a reading's age. Everything here is read by
 * `lib/time.ts`, which is called from a dozen surfaces and must say the same thing
 * on every one of them.
 */
export const units = {
  now: 'jetzt',
  live: 'live',
  ago: '{{duration}}',
  imminent: 'jeden Moment',
  todayAt: 'Heute {{time}}',
  yesterdayAt: 'Gestern {{time}}',
  hoursMinutes: '{{h}}h {{m}}m',
  minutesSeconds: '{{m}}m {{s}}s',
  hoursMinutesSeconds: '{{h}}h {{m}}m {{s}}s',
  seconds: '{{s}}s',
  daysHours: '{{d}}d {{h}}h',
  minutes: '{{m}}m',
  /** Which BCP-47 locale groups thousands and formats decimals. */
  numberLocale: 'de-DE',
  thousands: '{{value}}k',
  millions: '{{value}}M',
  percent: '{{value}}%',
  rangeJoin: '–',
  plus: '+',
  minus: '−',
} as const;
