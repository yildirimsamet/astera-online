/**

* ÉCRAN DE RECHERCHE. T12.
*
* Le français est écrit comme du français : pas comme une phrase traduite mot à mot.
* Ici, « Under way » devient « En cours », pas « en route » ; un emplacement n’est
* pas une file indépendante, mais un seul poste de travail.
  */
export const research = {
  eyebrow: "Commandant",
  title: "Recherche",
  premise:
    "Une fois terminée, une recherche devient permanente et s’applique à tous les mondes que tu possèdes.",
  queueTitle: "File de Recherche",
  queueCapacity: "{{count}} emplacements",
  queueLane: "Recherche du commandant",
  queueGlobalHint:
    "Cette file appartient à ton commandant et une recherche commencée ne peut pas être annulée. Les files de Construction et de Chantier Spatial de chaque planète fonctionnent séparément.",
  runningLabel: "En cours",
  runningFinishes: "se termine à {{time}}",
  idleLabel: "Aucune recherche en cours",
  idleHint:
    "Choisis une étoile sur la carte. Jusqu’à trois projets peuvent attendre dans cette file.",
  frontierBand: "Pointe",
  frontierNote:
    "Ces recherches se découvrent grâce à certains événements de la galaxie. Une fois découvertes, elles doivent être terminées en dépensant des ressources et du temps de recherche.",
  industryBand: "Industrie",
  industryNote:
    "Améliore la production, les temps de construction et de réparation, et les capacités de transport. Chaque projet indique sa limite de niveaux et ses prérequis.",
  doctrineBand: "Doctrine",
  doctrineNote:
    "Débloque les vaisseaux de haut palier et améliore séparément l’attaque, le blindage et la propulsion par étapes limitées. Les niveaux de combat apparaissent dans les rapports de sonde.",
  strategicBand: "Stratégique",
  strategicNote: "Augmente le nombre d’Étoiles de la Mort et de charges d’interception que chacun de tes mondes peut détenir.",
  act: "Rechercher",
  details: "Détails",
  cannotAfford: "Ressources insuffisantes",
  complete: "recherchée",
  rowRunning: "En cours",
  rowQueued: "En attente",
  needCore:
    "Améliore le Noyau de Commandement de la planète capitale au niveau {{level}}",
  queueFull:
    "Il y a déjà 3 recherches dans la file. Attends que l’une d’elles se termine avant d’en ajouter une nouvelle.",
  at: "disponible dans {{duration}}",
  isotopeFirst: "Recherche d’abord la Spectrométrie Isotopique",
  /* Forme sans accord particulier : tous les noms de projet peuvent s’y insérer directement. */
  prerequisiteFirst: "Termine d’abord la recherche {{name}}",
  prerequisiteLevelFirst: "Monte d’abord {{name}} au niveau {{level}}",
  nameAtLevel: "{{name}} N{{level}}",
  cargoInsight:
    "Remplis ta soute pendant un raid tout en laissant du butin sur la cible",
  shieldInsight: "L’Aegis doit absorber au moins {{share}} des dégâts du raid",
  sheetEyebrow: "Projet de recherche",
  sheetComplete: "Recherche terminée",
  sheetCost: "Coût de la recherche",
  sheetOnce:
    "Entre dans la file de Recherche commune de ton commandant. N’utilise aucun emplacement de Construction ni de Chantier Spatial.",
  sheetRung: "Niveau {{level}} sur {{max}}. Chaque niveau est acheté séparément.",
  isotopeName: "Spectrométrie Isotopique",
  isotopeTag: "Débloque l’extraction du Deutérium",
  isotopeRole:
    "Révèle le Deutérium présent dans les astéroïdes isotopiques et permet d’y envoyer des Prospecteurs. Les ressources rapportées rejoignent le stock de production.",
  isotopeDetail:
    "Une fois terminée, cette recherche transforme les astéroïdes isotopiques en cibles minières sélectionnables. Elle donne accès au Deutérium disputé dans l’espace ; elle ne produit pas de carburant automatiquement sur tes planètes.",
  denseName: "Cellules de Carburant Dense",
  denseTag: "Débloque la Propulsion des Vaisseaux",
  denseRole:
    "Pour la découvrir, remplis ta soute pendant un raid tout en laissant du butin sur la cible. Une fois terminée, elle débloque les paliers de recherche de Propulsion des Vaisseaux.",
  denseDetail:
    "Une fois terminée, elle débloque définitivement la recherche Propulsion des Vaisseaux pour ton commandant. La Propulsion accélère tous les vaisseaux de ta flotte et fait partie des conditions de construction de l’Atlas ; les Prospecteurs et les sondes ne sont pas affectés.",
  graviticName: "Charges Gravitiques",
  graviticTag: "Débloque le Annulateur",
  graviticRole:
    "Pour la débloquer, attaque un monde disposant de défenses et d’un Aegis actif ; le bouclier doit absorber au moins {{share}} des dégâts. Une seule Flèche suffit, et tu n’as pas besoin de gagner. Le Annulateur est cinq fois plus efficace contre un bouclier actif.",
  graviticDetail:
    "Une fois terminée, cette recherche remplit définitivement la condition spécialisée du Annulateur. Le Annulateur est une réponse spécifique aux Aegis actifs : ce n’est pas une amélioration générale des dégâts et son bonus contre le bouclier ne se reporte ni sur les vaisseaux ni sur les canons terrestres.",
  synthesisName: "Synthèse du Deutérium",
  synthesisTag: "Augmente le niveau maximal de la Raffinerie",
  synthesisRole:
    "Chaque palier débloque trois niveaux supplémentaires de Raffinerie de Deutérium sur tous tes mondes.",
  synthesisDetail:
    "Chaque palier de recherche augmente de trois le niveau maximal de la Raffinerie de Deutérium sur tous tes mondes. Tu dois ensuite construire séparément ces niveaux de Raffinerie sur chaque monde où tu veux produire davantage de carburant.",
  yardName: "Automatisation du Chantier Spatial",
  yardTag: "Construit les vaisseaux plus rapidement",
  yardRole:
    "Réduit le temps de production des vaisseaux mobiles ; n’affecte ni les défenses terrestres ni la capacité de la file de production.",
  yardDetail:
    "Chaque palier accélère toutes les futures commandes de vaisseaux mobiles, Prospecteurs compris, sur tous tes mondes. Il n’accélère pas les défenses terrestres, ne réduit pas le coût en ressources et n’ajoute aucun emplacement à la file du Chantier Spatial.",
  robotsName: "Robots d’Intelligence Artificielle",
  robotsTag: "Construit les structures plus rapidement",
  robotsRole:
    "Réduit le temps de tout ce qui entre dans la file de Construction ; n’affecte ni les vaisseaux ni les défenses terrestres.",
  robotsDetail:
    "Raccourcit les prochaines constructions sur toutes tes planètes : bâtiments, instruments et satellites. N’accélère ni vaisseaux ni défenses au sol. Prix et capacité de file restent inchangés.",
  industrialName: "Industrie",
  industrialTag: "Répare les vaisseaux moins cher et plus vite",
  industrialRole:
    "Réduit le coût et la durée de chaque réparation à la Station de réparation",
  industrialDetail:
    "Réduit le prix et la durée des réparations sur toutes tes planètes. Le niveau 1 applique 75 % du prix et du temps normaux ; le niveau 2 applique 50 %. La construction des vaisseaux n’accélère pas. Les dégâts de 20 % ou moins sont déjà réparés gratuitement à l’arrivée.",
  holdsName: "Soutes de Prospecteur",
  holdsTag: "Les Prospecteurs transportent davantage",
  holdsRole:
    "Augmente la quantité de minerai transportée par chaque Prospecteur en un seul voyage ; le bonus de soute de la Foreuse s’applique ensuite par-dessus.",
  holdsDetail:
    "Chaque palier augmente la quantité de minerai que tous tes Prospecteurs peuvent rapporter en un voyage. Le multiplicateur de soute ×2 de la Foreuse s’applique ensuite à cette capacité améliorée ; le troisième palier débloque un troisième emplacement de Prospecteur sur chaque monde.",
  cargoName: "Soutes de Vaisseau",
  cargoTag: "Chaque soute transporte davantage",
  cargoRole:
    "Augmente à la fois le butin des raids, les transferts entre mondes et les convois commerciaux ; l’exploitation des astéroïdes possède sa propre recherche.",
  cargoDetail:
    "Chaque palier agrandit la soute de tous les vaisseaux mobiles pour les raids et les transferts entre tes mondes. Cargo, Voyageur, Atlas et Argosi transportent aussi plus dans les convois marchands. Les Prospecteurs utilisent leur propre recherche.",
  engineeringName: "Ingénierie Stellaire",
  engineeringTag: "Débloque les vaisseaux de haut palier",
  engineeringRole:
    "Ingénierie I autorise les coques de troisième palier et Ingénierie II celles de quatrième palier. Les recherches de systèmes et les conditions de Chantier Spatial propres à chaque vaisseau restent applicables.",
  engineeringDetail:
    "Le niveau 1 satisfait le prérequis d’ingénierie des vaisseaux de palier 3. Le niveau 2 fait de même pour le palier 4. Chaque vaisseau peut aussi exiger Puissance, Armure, Propulsion ou Charges Gravitiques. Le niveau de Chantier naval requis reste nécessaire.",
  powerName: "Puissance des Vaisseaux",
  powerTag: "Augmente l’attaque des vaisseaux de combat",
  powerRole:
    "Augmente l’attaque des vaisseaux de combat de ta flotte et contribue aux conditions de production des vaisseaux offensifs avancés. Les transports et les défenses terrestres ne sont pas affectés.",
  powerDetail:
    "Chaque niveau augmente l’attaque normale de tous les vaisseaux de combat, Annulateur compris. Les vaisseaux déjà possédés en bénéficient aussi. Les transports ne gagnent pas d’attaque ; défenses au sol, Prospecteurs et sondes restent inchangés. Les attaquants utilisent leur niveau au décollage ; les défenseurs utilisent celui au début du combat.",
  armorName: "Blindage des Vaisseaux",
  armorTag: "Augmente la résistance des coques",
  armorRole:
    "Augmente la résistance de tous les vaisseaux de ta flotte, transports compris, et contribue aux conditions de production des vaisseaux défensifs avancés.",
  armorDetail:
    "Chaque niveau augmente la résistance de tous les vaisseaux de la flotte, transports compris. Défenses au sol, Prospecteurs et sondes restent inchangés. Les attaquants utilisent leur niveau au décollage ; les défenseurs utilisent celui au début du combat.",
  propulsionName: "Propulsion des Vaisseaux",
  propulsionTag: "Augmente la vitesse de la flotte",
  propulsionRole:
    "Augmente la vitesse de tous les vaisseaux de ta flotte et contribue aux conditions de production de l’Atlas. Se débloque après les Cellules de Carburant Dense.",
  propulsionDetail:
    "Chacun des quatre niveaux ajoute 25 % de la vitesse de base des vaisseaux. Le dernier double cette vitesse. Une flotte mixte utilise son vaisseau le plus lent. Prospecteurs et sondes ne sont pas affectés. L’effet s’applique aux missions lancées après la recherche.",
  groundDoctrineName: "Doctrine de défense au sol",
  doctrineTag: "Améliore les défenses terrestres",
  doctrineRole:
    "Augmente l’attaque et la résistance du Bastion, du Harpon et du Épine. Capacité au sol, récupération et rapports de classes restent inchangés.",
  groundDoctrineDetail:
    "Augmente l’attaque et la résistance du Bastion, du Harpon et du Épine sur toutes tes planètes. Capacité au sol et récupération restent inchangées. La défense utilise le niveau de recherche au début du combat.",
  gridName: "Réseau d’Interception",
  gridTag: "Quatre charges d’interception par monde",
  gridRole: "Fait passer de 2 à 4 les charges d’interception que chacun de tes mondes peut détenir.",
  gridDetail: "Porte la limite de charges d’interception de 2 à 4 par planète. Leur préparation exige Liaison montante et Radar 3 sur cette planète. Une charge détruit une Étoile de la mort identifiée au Télescope ou interceptée dans l’anneau Radar au bon moment. Les capteurs doivent fonctionner. Chaque interception consomme une charge.",
  stockpileName: "Réserve Stratégique",
  stockpileTag: "Deux Étoiles de la Mort par monde",
  stockpileRole: "Fait passer de 1 à 2 les Étoiles de la Mort que chacun de tes mondes peut détenir. La seconde commence quand la première est terminée.",
  stockpileDetail: "Sans recherche, chaque monde détient 1 Étoile de la Mort ; cette recherche la porte à 2 sur chaque monde, pas sur tout ton empire. La seconde coûte le prix complet et le temps de construction complet, et se construit après la première. Frapper depuis plusieurs mondes à la fois est le moyen de dépasser les charges d’un défenseur.",
} as const;
