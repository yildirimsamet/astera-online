/** The colony ship's screens. `docs/ux-writing.md` applies. */
export const starter = {
  "advice": {"open": "Autres choix", "title": "Et maintenant, Commandant ?", "recommended": "Conseillé", "close": "Fermer", "fuel": "Charger le carburant", "huntProbe": "Sonder les avant-postes", "huntDecide": "Comparer les gardes"},
  "visual": {"probe": "Sonde", "mine": "Extraire", "crate": "Récupération", "collect": "Collecter", "waiting": "En vol", "galaxy": "Galaxie principale"},
  "dossier": {"surfaceGapLabel": "Tout sur ce vaisseau", "surfaceGapMissing": "Tu n’as jamais vu ce vaisseau", "surfaceGapWhy": "Tu ne vois ni qui le pilote, ni où en sont ses réparations, ni ce qu’il transporte. Une sonde rapporte tout d’un coup.", "probeGapAged": "Ta lecture de ce vaisseau est périmée", "probeGapWhy": "Tu vas parier une flotte sur ce qu’il y a à bord. Une sonde change cette supposition en fourchette.", "fleetGapWhy": "L’information la plus précieuse du jeu : une flotte absente ne peut pas défendre son vaisseau.", "fleetGapRange": "Portée {{reach}} ; ce vaisseau est à {{distance}}"},
  "reports": {"guardDown": "La garde est tombée. L’avant-poste reste ouvert encore {{time}} : une autre flotte peut prendre le reste.", "outpost": "un avant-poste abandonné", "pirates": "des pirates", "attackedShip": "Vaisseau attaqué : {{planet}}", "walkover": "Aucune unité ne défendait ton vaisseau : le butin disponible était ouvert aux assaillants.", "cargoLimited": "Tes soutes étaient pleines. Il y avait plus que ce que tu pouvais emporter. Amène des transports Courier.", "landing": "Les survivants rentrent au hangar avec leurs dégâts. Envoie-les toi-même à la station de réparation.", "walkoverBody": "Aucune unité ne défendait ton vaisseau. La flotte adverse a pu prendre le butin disponible sans combattre.", "noGroundNote": "Ce vaisseau n’avait aucune défense debout à ton arrivée.", "piratesName": "Pirates", "aegisNote": "L’Aegis subit les dégâts avant toute unité défensive.", "whyStrong": "Tes {{ships}} surclassaient la garde {{guard}} ({{mult}}).", "whyWeak": "Tes {{ships}} étaient surclassés par la garde {{guard}} ({{mult}}). Contre elle, envoie des {{answer}}.", "whyEven": "Tes {{ships}} et la garde {{guard}} étaient à égalité ({{mult}}) : le nombre et la force ont décidé. Contre elle, les {{answer}} ont l’avantage.", "rebuild": "Perdus : {{ships}}. Les reconstruire coûte {{alloy}} alliage, {{crystal}} cristal et {{time}}. Ta progression reste acquise.", "beatenBy": "{{name}} est arrivé avant toi : la garde était déjà tombée quand ta flotte s’est posée, ce n’est donc pas une victoire. Tu as pris le reste.", "firstVictory": "Ta première victoire : la caisse de victoire t’attend au Chantier.", "whyWon": "Pourquoi tu as gagné"},
  "fleetPage": {"roomRule": "Place pour chaque vaisseau que ce vaisseau transporte — à quai, en route et au chantier. Un Hangar plein arrête le chantier ; une flotte rappelée trouve toujours sa place.", "bays": "Baies d’attaque", "openStation": "Ouvrir la station de réparation", "emptyAir": "Rien en vol. Touche un vaisseau, un astéroïde ou un avant-poste dans la galaxie pour envoyer des vaisseaux."},
  "handbook": {"title": "Manuel", "replay": "Revoir les premières minutes", "repairs": {"title": "Les réparations ouvrent tout", "body": "Chaque réparation ouvre le système suivant. Une seule à la fois, et elle continue en ton absence."}, "holds": {"title": "Les machines gardent ce qu'elles produisent", "body": "La production attend dans le Stock de production avant sa collecte dans le Magasin. La cargaison d’un Prospecteur y arrive aussi ; ce qui n’y tient pas est perdu. Les ressources en soute peuvent être pillées."}, "sight": {"title": "Regarde avant de voler", "body": "Le rapport d'une sonde montre un instant figé. Plus il vieillit, moins il parle du présent."}, "fleets": {"title": "Une flotte au loin est à l'abri, le vaisseau non", "body": "Les vaisseaux en vol ne peuvent pas être pillés. Ton vaisseau colonial et ce qui reste à bord, si."}, "jump": {"title": "Le saut est le but", "body": "Termine le moteur, charge le carburant, emporte les pièces, et tu te poses dans la galaxie principale avec ta cargaison. Il n'y a pas de retour."}, "crates": {"title": "Caisses de récupération", "body": "Certaines réparations, et ta première victoire décisive sur un avant-poste, dégagent des caisses. Sur l’écran du vaisseau, maintiens un couvercle pour ouvrir toutes les caisses prêtes. Chacune verse une fois de l’alliage et du cristal au stock. Ces ressources peuvent être pillées et respectent la limite du saut : 2 000 alliages et 1 000 cristaux."}},
  "prologue": {"progress": "Étape {{step}} sur {{total}}", "skip": "Passer", "signIn": "Se connecter", "close": "Fermer", "alloy": "Alliage {{value}}", "crystal": "Cristal {{value}}", "refinery": "Raffinerie", "feed": "Ligne des capteurs", "action": {"power": "Brancher l'énergie de secours", "burn": "Démarrer la raffinerie", "collect": "Récolter", "patch": "Réparer la ligne des capteurs"}, "dark": {"title": "Ton vaisseau est éteint.", "body": "Le récif a brisé la flotte et t'a jeté ici. Cette lumière devant toi, c'est la galaxie que tu visais."}, "powered": {"title": "L'énergie de secours tient.", "body": "Les cinq systèmes sont endommagés. La réserve froide garde {{crystal}} de cristal. Chaque réparation coûte de l'alliage : d'abord la raffinerie."}, "burning": {"title": "Le four s'allume.", "body": "Le premier lot tourne sur les dernières lignes de carburant."}, "batch": {"title": "Premier lot : {{alloy}} d'alliage.", "body": "Une raffinerie garde ce qu'elle produit jusqu'à ce que tu la vides."}, "collected": {"title": "Les capteurs sont aveugles.", "body": "Tu ne vois pas qui d'autre est passé. Un raccord sur la ligne leur rend une oreille."}, "patching": {"title": "Réparation de la ligne…", "body": "Ta première réparation. Les vraies continuent pendant que tu dors."}, "signal": {"mark": "Signal inconnu", "title": "Quelque chose a répondu.", "body": "Très loin, et l’antenne est trop abîmée pour le lire. Le moteur tient encore un court saut.", "replayBody": "Très loin, et l'antenne était trop abîmée pour le lire. Tu connais la suite.", "replayAction": "Retour au jeu", "go": "Aller vers le signal"}, "hint": {"hold": "Maintiens jusqu’à l’allumage", "weld": "Maintiens pour souder", "claim": "Maintiens pour commencer"}, "warping": {"title": "Saut…"}, "found": {"title": "Ce vaisseau peut être à toi.", "body": "À la dérive au-delà des hauts-fonds, four allumé, une oreille réparée. Fais-le tien et l’aventure commence.", "action": "Prendre la barre"}, "claim": {"title": "Ce vaisseau peut être à toi.", "ship": "ce vaisseau", "intro": "Ton vaisseau démarre avec {{alloy}} d'alliage, {{crystal}} de cristal et une raffinerie en marche. Les réparations continuent en ton absence."}},
  "chatRoom": "Canal de la galaxie",
  "away": {"fell": "{{name}} est tombé", "crateReady": "Ta caisse de victoire t’attend au Chantier.", "beaten": "{{by}} est arrivé à {{name}} avant toi", "details_one": "Détails ({{count}})", "details_other": "Détails ({{count}})", "online": "Remis en marche pendant ton absence : {{systems}}", "lost": "{{value}} sans place", "fleetHome": "Flotte de retour", "fleetHomeDetail_one": "+{{resources}} ressources · {{count}} vaisseau", "fleetHomeDetail_other": "+{{resources}} ressources · {{count}} vaisseaux", "haulAlloy": "+{{value}} d'alliage", "haulCrystal": "+{{value}} de cristal", "haulDeuterium": "+{{value}} de deutérium", "ships_one": "{{count}} vaisseau", "ships_other": "{{count}} vaisseaux", "toShip": "Aller au vaisseau"},
  "launchFleetsave": "Les vaisseaux en vol ne peuvent pas être pillés. Ton vaisseau colonial, si.",
  "contact": {"scout": "Éclaireur pirate", "scoutDetail": "Il observe, il ne combat pas. La prochaine fois, il ne sera peut-être pas seul.", "raid": "Raid pirate"},
  "outpostGuide": "Aller à l’avant-poste {{name}}",
  "outpostReading": {"guard": "Garde", "none": "Aucune garde", "unread": "Classes non lues", "even": "Classes égales", "most": "majoritaire", "beats": "› bat la suivante · ↺ {{last}} › {{first}}", "carry": "Tu peux emporter", "stock": "{{band}} en stock", "crate": "Ta première victoire décisive ouvre une caisse"},
  "outpost": {"title": "Avant-poste abandonné", "rule": "Bats sa garde et prends jusqu'à {{amount}} ressources ; tes vaisseaux en portent {{carry}}. Il se remplit en 6 heures.", "label": "Avant-poste · niveau {{level}}"},
  "readout": {"ships": "{{count}} vaisseaux", "outposts": "{{count}} avant-postes", "level": "Garde niveau {{level}}", "firstHunt": "Première chasse · {{level}}"},
  "lab": {"premise": "Cette recherche reste avec le vaisseau. Elle ne te suit pas dans la galaxie principale.", "holdsRole": "Augmente la capacité de cargo des Prospecteurs.", "queue": "Recherche du vaisseau", "queueHint": "Le vaisseau mène un projet à la fois. Les réparations et le chantier continuent séparément.", "idleHint": "Choisis une étoile sur la carte.", "queueFull": "Le vaisseau mène un projet à la fois. Attends que celui-ci se termine."},
  "deck": {"label": "Ponts du vaisseau", "repairs": "Réparation", "yard": "Chantier", "research": "Recherche"},
  "yard": {"against": "Contre", "queue": "File du chantier", "dockRule": "La Station facture {{percent}} % du prix principal.", "dockHurt": "{{count}} vaisseaux ont besoin de la Station", "dockGo": "Réparer {{count}} vaisseaux"},
  "board": {"title": "Départs", "empty": "Personne n'a encore sauté. Tu pourrais être le premier.", "ago": "il y a {{time}}"},
  "mainRow": {"facts": "{{worlds}} mondes. La saison se termine dans {{days}} jours.", "waiting": "Une nouvelle saison arrive.", "repair": "Répare la propulsion pour y sauter. Rien d'autre ne traverse le vide.", "ready": "Ton vaisseau est prêt. Ouvre la Propulsion pour sauter.", "eyebrow": "Ta destination", "story": "Là où allait la flotte avant que le récif ne la disperse. Le vrai voyage commence ici : des mondes à tenir, des rivaux, des clans, une saison à gagner.", "legRepair": "Prêt au départ", "legFuel": "Carburant du saut", "go": "Aller au vaisseau"},
  "plan": {"title": "Plan de départ", "done": "Réparé", "queued": "En file · fini dans {{time}}", "open": "Réparable · prend {{time}}", "waiting": "Attend : {{what}}", "fuelAt": "{{have}}/{{needed}} à bord · plein dans {{time}}", "fuelNow": "{{have}}/{{needed}} à bord · assez pour le saut", "fuelNoPlant": "{{have}}/{{needed}} à bord · {{name}} lance la production", "lever": "Avec {{name}} 2 : plein dans {{time}}", "flights": "Ces délais valent si aucun Deutérium n’est dépensé en vol.", "waitsFuel": "C’est le carburant qui retient le saut.", "waitsEngines": "Ce sont les moteurs qui retiennent le saut : le carburant arrive avant.", "optional": "Encore {{count}} réparations facultatives. Elles ne servent qu’à bord : ta capitale démarre avec ses propres bâtiments."},
  "outlook": {"noFrontier": "Aucune galaxie n’a de place pour l’instant. Ton vaisseau continue ici, et le saut s’ouvre dès qu’une place se libère.", "seasonClosed": "Cette saison n’accepte plus de vaisseaux : elle finit dans {{days}} jours. Ton vaisseau atterrira dans la suivante, et un vaisseau prêt est prévenu à son ouverture. D’ici là, avant-postes et réparations rapportent encore ici.", "seasonLate": "Cette saison cesse d’accepter des vaisseaux dans {{time}}, avant la fin de ton plan : le vaisseau atterrira dans la suivante. Prêt plus tôt, il atterrit dans celle-ci."},
  "arrival": {"carried": "Descendu avec toi", "package": "Départ de première saison", "total": "Disponible", "ships": "{{count}} vaisseaux", "decide": "Ton premier coup", "outward": "Préparer une première sortie", "outwardLine": "Ta flotte et {{deuterium}} Deutérium sont prêts. Sonde d’abord une cible.", "grow": "Ouvrir la production de Deutérium", "growLine": "Ici, ta production de Deutérium est nulle. Recherche {{research}}, puis construis la {{plant}} : elle alimente tes vols."},
  "readyLabel": "Prêt au départ",
  "wholeShip": "Tous les systèmes {{done}}/{{total}}",
  "jump": {"panel": "Le saut", "parts": "Pièces de poussée", "partsHint": "Les épaves et les avant-postes gardés en contiennent. Le premier arrivé prend la pièce.", "tank": "Réservoir", "tankLocked": "Le réservoir se raccorde avec le montage de poussée et l'usine de Deutérium 2.", "tankHint": "Le saut brûle {{needed}} Deutérium. Les vols puisent dans le même stock.", "load": "Charger {{amount}}", "loadAll": "Tout charger", "go": "Préparer le saut", "title": "Saut vers {{name}}", "addresses": "Où atterrir", "neighbours": "Mondes proches : {{count}}", "tone": {"quiet": "Calme", "mixed": "Entre les deux", "busy": "Peuplé"}, "toneNote": {"quiet": "Plus sûr. Cibles loin.", "mixed": "Un peu des deux.", "busy": "Cibles proches, et tu en es une."}, "cargo": "La soute emporte", "package": "Tu reçois aussi le pack de première saison et un bouclier de 72 heures.", "carryMost": "Un saut emporte au plus {{alloy}} alliage, {{crystal}} cristal, {{deuterium}} Deutérium et {{ships}} vaisseaux.", "left": "Reste derrière et est perdu : {{alloy}} alliage, {{crystal}} cristal, {{deuterium}} Deutérium, {{ships}} vaisseaux.", "warn": "Le vaisseau est consommé par ce saut. Les ressources et vaisseaux hors de la soute sont perdus.", "hold": "Sauter", "leaving": "Départ…", "replay": "Revoir", "skip": "Passer", "scene": {"lit": "Propulsion allumée", "leaving": "Sortie des hauts-fonds", "gap": "La traversée du vide", "fall": "{{name}}", "world": "Ton monde"}, "partsSeen": "Tes scanners montrent {{count}} endroits. Ils sont marqués sur la carte.", "partsLater": "Elles apparaissent sur la carte dès que la coque du moteur peut être réparée.", "partsNone": "Aucune en vue : envoie une sonde vers une épave ou un avant-poste.", "partHere": "Une pièce de poussée est ici. Le premier arrivé la prend."},
  "landing": {"dismiss": "Fermer", "title": "Tu as atterri sur {{name}}", "go": "Vers mon monde", "line": {"battle": "Les batailles sont deux fois plus dures, et l'Aegis est à pleine puissance.", "shield": "Ton bouclier dure 72 heures.", "absence": "Absent 3 jours, ta planète est supprimée.", "core": "Le Noyau fixe le palier de ton monde.", "opened": "Le clan et les classements sont ouverts.", "alerts": "Les alertes téléphone viennent maintenant du Centre de notifications."}, "tip": {"core": "Le Noyau fixe ton palier. Tu n'attaques que près de lui, et on t'attaque de même.", "colony": "Tu peux tenir jusqu'à trois colonies. Les mondes neutres s'ouvrent peu de temps à la prise.", "clan": "Un clan partage ses infos et défend ensemble. Regarde l'onglet Clan.", "dominion": "Dominion classe qui tient le plus. Il paie en fin de saison.", "honor": "Honor classe qui se bat loyalement. Attaquer une flotte faible rapporte peu."}},
  "shieldNote": "Les boucliers des vaisseaux commencent chaque combat pleins. Les dégâts de coque restent jusqu’à leur réparation à la station.",
  "tempoNote": "Ici, les dégâts et l'Aegis sont réduits de moitié. Dans la galaxie principale, la même bataille va deux fois plus vite.",
  "intel": {"blind": "Vous ne voyez l’intérieur d’aucun vaisseau", "openShip": "Ouvrir le vaisseau", "telescopeGives": "Indique si la flotte du vaisseau observé est partie. Avant une attaque, pesez l’âge de la lecture et ce qui reste sur place.", "telescopeCost": "Réparez le télescope de votre vaisseau.", "idleHint": "Emplacements libres : {{count}}. Choisis un vaisseau sur la carte et pointes-en un dessus.", "scarcity": "Vaisseaux alentour : {{neighbours}}. Tes emplacements : {{count}}. Changer de cible impose une attente : choisis bien.", "radarGives": "Montre les mouvements à portée et l’arrivée d’une menace visant votre vaisseau. Il peut détecter des sondes, sans garantie.", "radarCost": "Réparez le radar de votre vaisseau.", "nextSlot": "Réparation {{level}}", "oneMore": "La réparation {{level}} du Télescope surveille un vaisseau de plus.", "radarLevel": "Radar · réparation {{level}}", "radarFleets": "La réparation {{level}} du Radar distingue une menace visant ton vaisseau à {{sense}} unités, sans horloge. À {{warn}} unités, elle ajoute l’heure d’arrivée.", "radarFleetsOne": "La réparation {{level}} du Radar montre les appareils en mouvement jusqu’à {{sense}} unités et indique l’heure d’arrivée d’une menace visant ton vaisseau.", "radarBearing": " La réparation 2 ajoute leur direction d’origine.", "radarQuiet": "Aucun scan détecté. Ton Radar est actif.", "scaleNote": "Chaque barre part de zéro : la bande est leur estimation, la ligne turquoise ton vaisseau.", "home": "Voler vers ton vaisseau"},
  "news": {"victoryCrateOpened": "Caisse de victoire ouverte : +{{alloy}} alliage, +{{crystal}} cristal.", "crateOpened_one": "Caisse de récupération ouverte : +{{alloy}} alliage, +{{crystal}} cristal.", "crateOpened_other": "{{count}} caisses de récupération ouvertes : +{{alloy}} alliage, +{{crystal}} cristal.", "mineHome_one": "Ton Prospecteur est rentré avec {{brought}} : tout est dans le stock de production.", "mineHome_other": "Tes {{count}} Prospecteurs sont rentrés avec {{brought}} : tout est dans le stock de production.", "mineLost_one": "Ton Prospecteur est rentré avec {{brought}} : {{landed}} sont entrés dans le stock de production, {{lost}} n’ont pas trouvé de place et sont perdus.", "mineLost_other": "Tes {{count}} Prospecteurs sont rentrés avec {{brought}} : {{landed}} sont entrés dans le stock de production, {{lost}} n’ont pas trouvé de place et sont perdus.", "mineEmpty_one": "Ton Prospecteur est rentré à vide : il ne restait rien à prendre.", "mineEmpty_other": "Tes {{count}} Prospecteurs sont rentrés à vide : il ne restait rien à prendre.", "minePart": "Il a aussi trouvé une pièce de poussée.", "repairDone": "{{name}} réparé.", "probeReport": "Rapport de sonde sur {{name}}.", "probeDetected": "Une sonde a scanné votre vaisseau.", "radarPast": "Radar : une flotte est arrivée.", "shieldPast": "Ton bouclier est tombé.", "radar": "Radar : une flotte arrive dans {{time}}.", "raidOver": "Ton attaque sur {{name}} est terminée. Lis le rapport.", "firstVictory": "{{name}} est tombé ! Ta caisse de victoire t’attend au Chantier.", "beatenBy": "{{by}} a atteint {{name}} avant toi : la garde était déjà tombée. Lis le rapport.", "attacked": "{{name}} a attaqué ton vaisseau. Lis le rapport.", "fleetHome": "Ta flotte est rentrée.", "fleetHomePart": "Ta flotte est rentrée avec une pièce de poussée.", "turnedBack": "La cible était hors de portée. Ta flotte fait demi-tour.", "yardDone": "Chantier : {{count}} {{name}} prêts.", "researchDone": "{{name}} atteint le niveau {{level}}.", "dockDone": "La Station de réparation a terminé. Tes vaisseaux sont intacts.", "shieldWarning": "Ton bouclier tombe dans {{time}}.", "seasonOpen": "Une nouvelle saison est ouverte sur {{name}}. Ton vaisseau peut sauter."},
  "reading": {"repairLabel": "Réparations", "repairNote": "La part réparée de ce vaisseau. Plus elle est grande, plus il a accumulé et plus il est près de partir.", "unknownShip": "Vaisseau inconnu"},
  "systemShort": {"REFINERY": "Raffinerie", "SURVEY": "Sonde", "DEFENCE": "Défense", "CARGO": "Cargo", "DRIVE": "Moteur"},
  "systemsLabel": "Systèmes du vaisseau",
  "locked": "verrouillé",
  "perHour": "/h",
  "moreRepairs": "Autres réparations", "nextRepairs": "Réparations",
  "slots": "Postes",
  "stepState": {"done": "réparé", "queued": "en file", "closed": "verrouillé", "open": "prêt"},
  "quiet": {"warn": "Répare dans {{time}}, sinon ton vaisseau quittera sa place dans cette galaxie.", "asleep": "Ton vaisseau a quitté sa place après {{hours}} heures sans réparation. Lance une réparation pour en retrouver une."},
  "queue": {"title": "File de réparation"},
  "eyebrow": "Vaisseau colonial",
  "goal": "Répare tous les systèmes, remplis le réservoir et saute vers la galaxie principale.",
  "next": "Ensuite",
  "tutorial": {"skip": {"link": "Je n’ai pas besoin du guide", "title": "Fermer le guide ?", "body": "Veux-tu fermer le guide ? L’officier ne te guidera plus. Tu peux réactiver le guide depuis Académie dans le menu. Ta partie continue là où tu en étais.", "keep": "Continuer avec le guide", "close": "Fermer le guide", "again": "Réactiver le guide", "againHint": "L’officier éclaireur t’accompagne de nouveau"}, "inspect": "Examiner le vol", "chapter": {"1": "Réveil", "2": "Premières réparations", "3": "Les yeux ouverts", "4": "La première sonde", "5": "Le chantier", "6": "La première cargaison", "7": "Télescope", "8": "Radar", "9": "La route vers la galaxie principale"}, "next": "Suivant", "reveal": "Afficher tout le message", "away": "Je t’appelle quand ce sera fini, vers {{clock}}. D’ici là, explore ton vaisseau et la galaxie.", "ok": "OK", "back": "De retour dans {{time}}", "reopen": "Afficher le guide", "nav": {"openShip": "Ouvre le vaisseau : touche {{base}}.", "closePage": "Ferme cette page. La suite se passe dans la galaxie.", "dismissUnlock": "Un système vient de démarrer. Lis sa carte, puis ferme-la pour continuer."}, "line": {"online": "Commandant, la radio marche ! Ce vaisseau est à toi maintenant, et sa raffinerie se réveille. Touche {{try}} sur la carte.", "collect": "L'alliage est le métal qui répare le vaisseau. Ce que la raffinerie a produit attend dans le Stock de production : touche sa ligne dans la barre du haut pour le mettre en réserve.", "orderRefinery": "Chaque réparation se paie en alliage et en cristal. D'abord {{name}}, pour plus d'alliage. Touche {{repair}}.", "waitFirst": "Cela prend cinq secondes. Les grosses réparations continuent pendant ton absence.", "firstCrate": "La réparation a ouvert une soute scellée. Maintiens la caisse : ce qu'elle contient est à toi.", "openIntel": "Le rapport est arrivé. Touche l'onglet {{intel}} en bas.", "openReport": "Tout ce que nous savons est ici. Touche le vaisseau sondé pour ouvrir son rapport.", "report": "Voici le rapport de la sonde. La partie éclairée est ce qu'une victoire pourrait rapporter ; en dessous, ses vaisseaux. Nous n'envoyons jamais de flotte sans le lire.", "farewell": "Ton vaisseau est réparé à {{percent}} %. Pour voler vers la galaxie principale, tu dois finir le travail. La marche à suivre est sur la ligne de la prochaine étape.", "mine": "Le télescope est ouvert, et ces rochers sont visibles ! Ils contiennent du minerai : envoie ton Prospecteur vers le plus proche.", "collectMine": "Le Prospecteur est rentré avec sa cargaison ! Elle attend dans le Stock de production : récupère-la depuis la barre du haut.", "telescopeLook": "Voici le champ de vision de ton télescope. Fais pivoter la vue pour l’explorer.", "telescopeRing": "Un vol est entré dans l’anneau de ton télescope. L’anneau, c’est ce que tu vois : chaque vaisseau et chaque flotte à l’intérieur est identifié.", "telescopeTraffic": "Touche le vol : lis à qui il appartient et où il va.", "telescopeTrack": "Regarde : le vol a quitté l’anneau, et tu vois encore sa trajectoire. Un vol identifié une fois se suit jusqu’au bout.", "radarRing": "Ton radar a capté quelque chose ! L’anneau vert est sa portée : il détecte les vols que ton télescope ne voit pas.", "radarContact": "Un ? indique un mouvement inconnu. Une flotte en approche apparaît ici avant d’atteindre ton vaisseau.", "sightTrio": "Le télescope a identifié le vol entré dans son anneau. La sonde lit l’intérieur d’une cible, le télescope identifie le mouvement, le radar avertit.", "openCrate": "Une autre caisse est prête, avec de quoi payer la suite. Maintiens-la pour l'ouvrir.", "orderExtractor": "Le cristal répare les pièces délicates. {{name}} le produit : touche {{repair}}.", "orderTelescope": "Dehors, tout est noir. {{name}} nous montrera les alentours : touche {{repair}}.", "orderRadar": "Ensuite {{name}} : il entend tout ce qui bouge, de très loin. Touche {{repair}}.", "waitTelescope": "Le télescope s'ouvre. Ensuite, nous verrons ce qu'il y a dehors.", "orderSurvey": "Ton Prospecteur est en route. Maintenant {{name}}, pour lire les autres vaisseaux. Touche {{repair}}.", "waitSurvey": "L'antenne se déploie. Bientôt, nous regarderons les vaisseaux dehors.", "probe": "Tu n'es pas seul : d'autres vaisseaux t'entourent. Envoie une sonde vers l'un d'eux et découvre ce qu'il a.", "orderShipyard": "Sans vaisseaux, nous ne tiendrons pas. {{name}} les construit : touche {{repair}}.", "waitYard": "Le chantier se monte. En attendant, suis ton Prospecteur et ta sonde.", "buildShip": "Le chantier tourne et deux vaisseaux sont prêts. Construis-en un toi-même : touche le vaisseau éclairé."}, "push": "Puis-je te prévenir quand une réparation se termine et que quelqu’un approche de ton vaisseau ?", "allow": "Préviens-moi", "later": "Plus tard", "hint": "Besoin d’un cap ? {{task}} Touche la prochaine étape pour avancer.", "dismiss": "Compris"},
  "outcome": {"DECISIVE": "Avant-poste pris", "PARTIAL": "Résultat partiel", "REPELLED": "Repoussé", "BEATEN": "Quelqu’un est passé avant", "beaten": "{{by}} est arrivé avant toi ; la garde était déjà tombée. Tu as pris le reste.", "crate": "Ta première victoire ! Ta caisse de victoire t’attend au Chantier.", "line": {"DECISIVE": "La garde est brisée. Pourquoi tu as gagné : dans le rapport.", "PARTIAL": "Une partie de la garde est tombée. Ce qui manquait : dans le rapport.", "REPELLED": "La garde a tenu. Pourquoi : dans le rapport."}, "lost_one": "{{count}} vaisseau perdu", "lost_other": "{{count}} vaisseaux perdus", "lootHome": "Le butin arrive en réserve au retour de la flotte.", "ok": "OK", "report": "Lire le rapport", "openCrate": "Ouvrir la caisse"},
  "objective": {"probe": "Envoie une sonde vers le vaisseau le plus proche. Touche pour le trouver.", "mine": "Envoie un Prospecteur vers l’astéroïde le plus proche. Touche pour le trouver.", "underwayProbe": "Ta sonde est en route. Son rapport arrivera dans Renseignement.", "underwayMine": "Le Prospector est en minage. Il revient tout seul.", "restSave": "C'est tout pour l'instant. Reviens vers {{clock}} pour : {{name}}.", "restWait": "C'est tout pour l'instant. La réparation finit vers {{clock}}.", "repair": "Répare : {{name}}. Ouvre le vaisseau.", "collect": "Récolte ce que les ateliers ont produit, depuis la barre du haut.", "save": "{{name}} : payable dans environ {{time}}.", "saveNever": "{{name}} : répare ce qui produit la ressource manquante.", "wait": "Une réparation est en cours. Prête dans {{time}}.", "parts": "Trouve {{count}} pièces de poussée. Épaves et avant-postes gardés en ont.", "fuel": "Remplis le réservoir dans la propulsion.", "huntProbeMining": "Le Prospector est en route. Pendant ce temps, il y a deux avant-postes pirates ; on n’attaque pas sans connaître leur garde. Envoie une sonde.", "huntProbe": "Il y a deux avant-postes pirates ; on n’attaque pas sans connaître leur garde. Envoie une sonde.", "huntProbing": "Les sondes sont en route. À leur retour, on lira les gardes.", "huntDecide": "Les rapports sont là : compare les deux gardes, choisis tes vaisseaux.", "huntRaid": "Ta flotte vole vers l’avant-poste. Le combat aura lieu à l’arrivée.", "crate": "Ouvre la caisse prête : elle contient de quoi payer la prochaine réparation."},
  "log": {"title": "Journal de bord", "now": "Maintenant", "go": "Aller", "chapter": {"POWER": {"title": "Énergie", "line": "La réserve tient. Le vaisseau est réveillé."}, "REFINERY": {"title": "Raffinerie", "line": "Produit alliage et cristal. Chaque réparation se paie avec."}, "SURVEY": {"title": "Exploration", "line": "L'antenne : sondes, rapports et l'onglet Renseignement."}, "DEFENCE": {"title": "Défense", "line": "Aegis, télescope et radar : voir venir les raids et y survivre."}, "CARGO": {"title": "Cargo", "line": "Chantier et hangar : tes premiers vaisseaux et l'onglet Flotte."}, "DRIVE": {"title": "Propulsion", "line": "Pièces de poussée, coque et carburant : le saut vers la galaxie principale."}}},
  "repair": "Réparer",
  "stepCount": "Étape {{stage}} sur {{total}}",
  "optional": "Facultatif · hors du % de réparation",
  "inQueue": "En file",
  "systemAria": "{{name}} : {{done}} réparations sur {{total}}, {{state}}",
  "needs": "Requis : {{what}}",
  "queueFull": "La file de réparation contient {{count}} tâches. Attends qu’une se termine.",
  "affordIn": "Payable dans environ {{time}}.",
  "collectFirst": "Récolte depuis la barre du haut pour payer ceci.",
  "noIncome": "Rien ne produit encore cette ressource. Répare ce qui la produit.",
  "allQueued": "Toutes les réparations requises sont faites ou en file.",
  "allRepaired": "Toutes les réparations requises sont faites.",
  "ordered": "{{name}} : réparation commandée",
  "state": {
    "broken": "En panne",
    "damaged": "Endommagé",
    "done": "Réparé"
  },
  "system": {
    "REFINERY": "Module de raffinerie",
    "SURVEY": "Antenne d’exploration",
    "DEFENCE": "Systèmes de défense",
    "CARGO": "Soute et hangar",
    "DRIVE": "Moteur interstellaire"
  },
  "module": {
    "SURVEY": "Antenne d’exploration",
    "DRIVE_HULL": "Coque du moteur",
    "DRIVE_THRUST": "Montage de poussée"
  },
  "fact": {
    "FIRST_PROBE_REPORT": "ton premier rapport de sonde",
    "FIRST_MINING_RETURN": "ton premier retour de minage",
    "FIRST_BATTLE_REPORT": "ton premier rapport de bataille",
    "FIRST_OUTPOST_VICTORY": "ta première victoire sur un avant-poste"
  },
  "factHow": {"FIRST_PROBE_REPORT": "Envoie une sonde vers un vaisseau voisin.", "FIRST_MINING_RETURN": "Envoie un Prospecteur vers un astéroïde et attends son retour.", "FIRST_BATTLE_REPORT": "Attaque un avant-poste, ou affronte les pirates une fois l’Aegis active. Le rapport de ce combat compte.", "FIRST_OUTPOST_VICTORY": "Bats la garde d’un avant-poste par une victoire décisive."},
  "attackLocked": "Pour attaquer des vaisseaux, il te faut ton Aegis réparée et un combat derrière toi. Avec l’Aegis, ton vaisseau peut aussi être attaqué.",
  "aegisChoice": {"title": "À toi de choisir", "hold": "Réparer l’Aegis", "with": "Avec l’Aegis", "withShield": "Le bouclier encaisse les dégâts en premier.", "withPirates": "Les pirates commencent à venir.", "withNeighbours": "Après {{hours}} h, tes voisins peuvent t’attaquer.", "withAttack": "Après un combat, tu peux aussi attaquer des vaisseaux.", "without": "Sans elle", "withoutSafe": "Ni pirates ni voisins ne peuvent t’attaquer.", "withoutOutposts": "Tu ne pilles que des avant-postes.", "withoutJump": "Inutile pour partir."},
  "outpostLocked": "Les raids sur les avant-postes s’ouvrent avec le Chantier. Répare-le, et les vaisseaux qu’il construit pourront attaquer ici.",
  "partsNeeded": "{{count}} pièces de poussée",
  "effect": {
    "rate": {
      "alloy": "+{{amount}} alliage par heure",
      "crystal": "+{{amount}} cristal par heure",
      "deuterium": "+{{amount}} deutérium par heure"
    },
    "ships": "Avec {{ships}}",
    "deuterium": "Avec {{amount}} deutérium",
    "room": "Place de hangar {{room}}",
    "storeCeiling": "Plafond d’alliage {{from}} → {{to}}",
    "telescope": "Portée du télescope {{distance}}",
    "radar": "Portée du radar {{distance}}",
    "aegis": "Aegis {{hp}}",
    "surveyBand": "Les sondes lisent une plage plus étroite",
    "driveHull": "Porte le montage de poussée",
    "driveThrust": "Ajoute le réservoir"
  },
  "feature": {
    "production": {
      "gain": "Ouvre la production",
      "line": "La raffinerie produit de l’alliage. Récolte-le depuis la barre du haut."
    },
    "intel": {
      "gain": "Ouvre les sondes",
      "line": "Les vaisseaux voisins apparaissent en points sombres. Une sonde montre ce que l’un d’eux possède."
    },
    "fleet": {
      "gain": "Ouvre la flotte",
      "line": "Tu peux construire des vaisseaux, envoyer un Prospecteur miner des astéroïdes, attaquer des avant-postes et réparer les vaisseaux endommagés à la Station de réparation."
    },
    "chat": {
      "gain": "Ouvre le chat",
      "line": "Tu peux parler aux autres vaisseaux de cette galaxie."
    },
    "salvage": {
      "gain": "Ouvre les champs d’épaves",
      "line": "Les champs d’épaves apparaissent sur la carte. Un Prospecteur peut les récupérer."
    },
    "research": {
      "gain": "Ouvre la recherche",
      "line": "La recherche améliore tes vaisseaux et les soutes du Prospecteur. Elle prend fin avec ce vaisseau."
    },
    "telescope": {
      "gain": "Ouvre le télescope",
      "line": "Dans son anneau, tu vois les autres vaisseaux et leurs vols."
    },
    "radar": {
      "gain": "Ouvre le radar",
      "line": "Dans son anneau, un vol apparaît comme un contact inconnu et t’avertit."
    },
    "defence": {
      "gain": "Ouvre la défense",
      "line": "L’Aegis encaisse les dégâts en premier. Les pirates et les autres vaisseaux peuvent maintenant attaquer ce vaisseau ; après un combat, tu peux aussi attaquer des vaisseaux."
    },
    "attack": {
      "gain": "Ouvre les attaques",
      "line": "Tu peux attaquer les vaisseaux dont l’Aegis est active. Eux aussi peuvent t’attaquer."
    },
    "deuterium": {
      "gain": "Ouvre le deutérium",
      "line": "Les vols brûlent du deutérium, et cette raffinerie en produit."
    },
    "drive": {
      "gain": "Ouvre le panneau du moteur",
      "line": "Les pièces de poussée apparaissent sur la carte. Le moteur en demande {{count}}."
    },
    "migration": {
      "gain": "Ouvre le saut",
      "line": "Le réservoir est plein. Ce vaisseau peut sauter vers la galaxie principale."
    }
  },
  "funnel": {"title": "Parcours de départ", "sessions": "{{accounts}} comptes · {{sessions}} sessions · {{returned}} retours en deuxième session", "push": "Push : {{asked}} demandes · {{granted}} accords · {{denied}} refus", "crates": "Caisses : {{opened}} ouvertes par {{accounts}} comptes", "chain": "Chaîne d'ordres : {{accepted}} comptes ont donné un ordre → {{resolved}} ont reçu le résultat → {{viewed}} l'ont vu → {{decided}} ont redonné un ordre", "haul": "Premier retour de minage : {{returned}} comptes · {{gained}} avec un gain net · {{wasted}} ont perdu une part, installations pleines", "steps": "Étapes et abandons", "dropoff": "{{accounts}} arrivées · {{dropoff}} de moins"},
  "crate": {"victory": "Caisse de la première victoire", "title_one": "Caisse de récupération", "title_other": "{{count}} caisses de récupération", "hold": "Maintiens pour ouvrir et prendre", "open": "Ouvrir : {{purse}}"},
  "unlock": {
    "online": "{{system}} en ligne",
    "try": "Essayer",
    "later": "Plus tard"
  },
  "tab": {
    "repair": "Répare {{module}} pour ouvrir ceci.",
    "mainGalaxy": "Ceci s’ouvre dans la galaxie principale."
  }
};
