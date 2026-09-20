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
    "Lance un projet ci-dessous. Jusqu’à trois projets peuvent attendre dans cette file ; une fois commencés, ils ne peuvent plus être annulés.",
  frontierBand: "Pointe",
  frontierNote:
    "Ces recherches se découvrent grâce à certains événements de la galaxie. Une fois découvertes, elles doivent être terminées en dépensant des ressources et du temps de recherche.",
  industryBand: "Industrie",
  industryNote:
    "Disponible dès le début et composée de cinq paliers par recherche. Elle améliore la production, les temps de construction et les capacités de transport.",
  doctrineBand: "Doctrine",
  doctrineNote:
    "Débloque les vaisseaux de haut palier et améliore séparément l’attaque, le blindage et la propulsion par étapes limitées. Les niveaux de combat apparaissent dans les rapports de sonde.",
  strategicBand: "Stratégique",
  strategicNote:
    "Débloque l’Étoile de la Mort, le Réseau d’Interception qui peut l’arrêter et la capacité d’une deuxième arme.",
  act: "Rechercher",
  complete: "recherchée",
  rowRunning: "En cours",
  rowQueued: "En attente",
  needCore:
    "Améliore le Noyau de Commandement de la planète capitale au niveau {{level}}",
  queueFull:
    "Il y a déjà 3 recherches dans la file. Attends que l’une d’elles se termine avant d’en ajouter une nouvelle.",
  at: "disponible dans {{duration}}",
  warAt: "La phase de guerre commence dans {{duration}}",
  isotopeFirst: "Recherche d’abord la Spectrométrie Isotopique",
  /* Forme sans accord particulier : tous les noms de projet peuvent s’y insérer directement. */
  prerequisiteFirst: "Termine d’abord la recherche {{name}}",
  graviticFirst: "Recherche d’abord les Charges Gravitiques",
  cargoInsight:
    "Remplis ta soute pendant un raid tout en laissant du butin sur la cible",
  shieldInsight: "L’Aegis doit absorber au moins {{share}} des dégâts du raid",
  sheetEyebrow: "Projet de recherche",
  sheetComplete: "Recherche terminée",
  sheetCost: "Coût de la recherche",
  sheetOnce:
    "Entre dans la file de Recherche commune de ton commandant. N’utilise aucun emplacement de Construction ni de Chantier Spatial.",
  sheetRung: "Palier {{level}} sur {{max}}. Chaque palier s’achète séparément.",
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
  graviticTag: "Débloque le Dissipateur",
  graviticRole:
    "Pour la débloquer, attaque un monde disposant de défenses et d’un Aegis actif ; le bouclier doit absorber au moins {{share}} des dégâts. Une seule Flèche suffit, et tu n’as pas besoin de gagner. Le Dissipateur est cinq fois plus efficace contre un bouclier actif.",
  graviticDetail:
    "Une fois terminée, cette recherche remplit définitivement la condition spécialisée du Dissipateur. Le Dissipateur est une réponse spécifique aux Aegis actifs : ce n’est pas une amélioration générale des dégâts et son bonus contre le bouclier ne se reporte ni sur les vaisseaux ni sur les canons terrestres.",
  deathStarName: "Protocole de l’Étoile de la Mort",
  deathStarTag: "Débloque l’Étoile de la Mort",
  deathStarRole:
    "L’Étoile de la Mort se construit désormais sans cette recherche ; ce projet est indisponible.",
  deathStarDetail:
    "Une frappe EMP vide l’Aegis et bloque sa régénération pendant une heure. Les défenses terrestres ne tirent pas et ne subissent aucun dégât durant cette période.",
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
    "Chaque palier accélère toutes les futures commandes placées dans la file de Construction sur tous tes mondes : bâtiments, instruments et satellites. Il n’accélère pas les vaisseaux — c’est le rôle de l’Automatisation du Chantier Spatial —, ne réduit pas le coût en ressources et n’ajoute aucun emplacement à la file.",
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
    "Chaque palier augmente la capacité de transport de tes vaisseaux : le butin des flottes de raid ainsi que la soute de tous les Cargos, Voyageurs, Atlas et Argosi transportant des ressources entre tes mondes ou commerçant avec le Marchand. Les Prospecteurs utilisent leur propre recherche, Soutes de Prospecteur.",
  engineeringName: "Ingénierie Stellaire",
  engineeringTag: "Débloque les vaisseaux de haut palier",
  engineeringRole:
    "Ingénierie I autorise les coques de troisième palier et Ingénierie II celles de quatrième palier. Les recherches de systèmes et les conditions de Chantier Spatial propres à chaque vaisseau restent applicables.",
  engineeringDetail:
    "L’Ingénierie n’est pas un multiplicateur de combat, mais une autorisation de production. Le premier palier ouvre les coques de troisième palier et le second celles de quatrième palier ; un vaisseau donné peut également exiger Puissance, Blindage, Propulsion ou Charges Gravitiques, ainsi qu’un niveau précis de Chantier Spatial.",
  powerName: "Puissance des Vaisseaux",
  powerTag: "Augmente l’attaque des vaisseaux de combat",
  powerRole:
    "Augmente l’attaque des vaisseaux de combat de ta flotte et contribue aux conditions de production des vaisseaux offensifs avancés. Les transports et les défenses terrestres ne sont pas affectés.",
  powerDetail:
    "Chaque palier augmente l’attaque normale de tous les vaisseaux de combat, Dissipateur compris, et s’applique aussi aux vaisseaux que tu possèdes déjà. Il n’ajoute aucune attaque aux transports ; le Bastion, le Hérisson, les Prospecteurs et les sondes ne sont pas affectés. La flotte attaquante utilise le niveau possédé au décollage, la défense celui présent au moment du combat.",
  armorName: "Blindage des Vaisseaux",
  armorTag: "Augmente la résistance des coques",
  armorRole:
    "Augmente la résistance de tous les vaisseaux de ta flotte, transports compris, et contribue aux conditions de production des vaisseaux défensifs avancés.",
  armorDetail:
    "Chaque palier augmente la résistance de coque de tous les vaisseaux de ta flotte, y compris les Cargos, Voyageurs, Atlas et Argosi. Le Bastion, le Hérisson, les Prospecteurs et les sondes ne sont pas affectés. La flotte attaquante utilise le niveau possédé au décollage, la défense celui présent au moment du combat.",
  propulsionName: "Propulsion des Vaisseaux",
  propulsionTag: "Augmente la vitesse de la flotte",
  propulsionRole:
    "Augmente la vitesse de tous les vaisseaux de ta flotte et contribue aux conditions de production de l’Atlas. Se débloque après les Cellules de Carburant Dense.",
  propulsionDetail:
    "Chacun des quatre paliers ajoute un quart de la vitesse de base aux vaisseaux de ta flotte ; le dernier double ainsi leur vitesse et réduit de moitié la durée de chaque vol. Une flotte mixte continue de voler à la vitesse de son membre le plus lent : la Propulsion améliore donc la flotte choisie sans effacer le profil propre de chaque coque. Les Prospecteurs et les sondes ne sont pas affectés ; seules les missions calculées après la fin de la recherche bénéficient du bonus.",
  groundDoctrineName: "Doctrine Bastion/Hérisson",
  doctrineTag: "Améliore les défenses terrestres",
  doctrineRole:
    "Augmente à la fois l’attaque et la résistance du Bastion et du Hérisson ; la capacité, la reconstruction depuis les débris et les avantages de classe restent inchangés.",
  groundDoctrineDetail:
    "Renforce les Bastions et Hérissons de tous tes mondes. La capacité terrestre et la règle de reconstruction depuis les débris restent inchangées ; la défense utilise le palier possédé au moment du combat.",
  gridName: "Réseau d’Interception",
  gridTag: "Détruit l’Étoile de la Mort",
  gridRole:
    "Un intercepteur chargé détruit automatiquement une arme stratégique dans le rayon d’interception d’un Radar de niveau 3 ou lorsqu’elle est identifiée dans le champ de vision d’un Télescope appartenant à l’un de tes mondes.",
  gridDetail:
    "Donne accès aux munitions d’interception. Pour installer une munition, le monde concerné doit disposer d’une Antenne et d’un Radar de niveau 3 au minimum. Une munition chargée détruit automatiquement la première arme stratégique entrant dans le rayon Radar temporisé ou identifiée dans le champ de vision d’un Télescope appartenant à l’un de tes mondes, puis elle est consommée.",
  stockpileName: "Réserve Stratégique",
  stockpileTag: "Une deuxième arme sur la rampe",
  stockpileRole:
    "Fait passer de une à deux le nombre d’Étoiles de la Mort que chaque monde peut maintenir prêtes ; la seconde commence sa construction une fois la première terminée.",
  stockpileDetail:
    "Augmente de une à deux la limite d’Étoiles de la Mort pour chacun de tes mondes, et non pour ton commandant dans son ensemble. La seconde arme exige son coût complet et son temps de construction complet ; elle peut être mise en file mais n’est pas construite en parallèle avec la première. Chaque tir consomme toujours l’arme.",
} as const;
