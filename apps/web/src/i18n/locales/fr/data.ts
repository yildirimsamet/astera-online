/**
 * ADI OLAN ŞEYLER VE OYUNUN ONLAR HAKKINDA KURDUĞU CÜMLELER.
 *
 * GEMİ ADLARI ÇEVRİLMEDİ, TÜRKÇE KARŞILIĞI KONULDU. Bunlar özel isim gibi durur
 * ama aslında sınıf adıdır: "Dart" bir oyuncuya ucuz, hızlı ve sürü hâlinde
 * demektir. Türkçe okuyan biri bunu "Dart"tan çıkaramaz, "Ok"dan çıkarır.
 * Seçimler sözlük karşılığı değil, Türkçede aynı askerî tınıyı veren adlar:
 *
 *   Dart → Ok · Lance → Mızrak · Bulwark → Sur · Courier → Kurye
 *   Bastion → Tabya · Thorn → Kirpi · Prospector → Kazıcı
 *
 * "Tabya" ve "Kurye" gerçek Türkçe askerî ve denizcilik terimleri; oyuncunun
 * kulağına yabancı gelmezler.
 *
 * UYDULARIN ADI, YAPTIKLARI İŞTEN GELİR — SÖZLÜKTEN DEĞİL. İlk turda hepsi
 * İngilizce adın birebir karşılığıydı ve beşi de kulağa saçma geliyordu: bir
 * muhabere rölesine "Röle", yörüngedeki bir üretim çarpanına "Dökümhane", maden
 * kulesine "Vinç", seyir işaretçisine "Fener". Doğru kelimelerdi ve yanlış
 * adlardı; hiçbiri oyuncuya o uydunun ne işe yaradığını söylemiyordu.
 *
 *   Uplink  → Anten    Teleskopla Radarın bağlandığı yer; ikisinin yanında durur
 *   Foundry → Körük    Körük ocağı harlar: üretim çarpanının tam karşılığı
 *   Derrick → Matkap   Delme işini iyileştirir, ve kelimeyi herkes bilir
 *   Beacon  → Kılavuz  Filoyu hızlandıran rehber; "fener"in yükü yok
 *   Thorn   → Kirpi    Ucuz, dikenli, savunmacı — Türkçe zırhlıyı zaten böyle adlandırır
 *
 * ROL CÜMLELERİNİN KURALI. Her biri iki şey söyler: bu ne kazandırır, ve neyi
 * kazandırmaz. İkinci yarı olmadan dört seçenek de "işine yarar" demiş olur ve
 * seçim seçim olmaktan çıkar. Cümleler tam kurulur; İngilizcedeki tireli kesik
 * yapı Türkçeye taşınmaz.
 */

export const vocabulary = {
  building: {
    CORE: {
      name: 'Noyau de commande',
      tag: 'Débloque des niveaux plus élevés',
      role: 'Définit les plafonds du bâtiment et la vitesse de construction ; la capitale ouvre des emplacements de colonie aux niveaux 9, 12 et 15.',
      detail: 'Aucun autre bâtiment ne peut dépasser le Noyau de commandement. L\'améliorer raccourcit le temps de construction, ouvre davantage d\'orbites et de créneaux de vol à certains niveaux et augmente la capacité de défense au sol. Seul le Noyau de la capitale fixe les plafonds et la vitesse de recherche, et accorde les premier, deuxième et troisième emplacements de colonie aux niveaux 9, 12 et 15. Il ne produit ni minerai ni puissance de combat à lui seul.',
    },
    REFINERY: {
      name: 'Raffinerie d\'alliages',
      tag: 'Fait de l\'alliage',
      role: 'Alliage par heure et stockage d\'alliage',
      detail: 'Chaque niveau augmente les revenus de l\'alliage passif et le montant pouvant être stocké. L\'alliage finance la plupart des constructions et des coques, ce qui réduit de nombreuses attentes futures.',
    },
    EXTRACTOR: {
      name: 'Extracteur de cristaux',
      tag: 'Donne du cristal',
      role: 'Cristal par heure et stockage de cristaux',
      detail: 'Chaque niveau augmente les revenus et le stockage de cristal. Le cristal est la ressource la plus rare pour les équipements, les instruments et les recherches avancées.',
    },
    VAULT: {
      name: 'Magasin',
      tag: 'Approfondit le magasin',
      role: 'Étend le stockage des ressources et laisse une marge de 10 % pour les prochaines mises à niveau correspondantes du producteur d\'alliages et de cristaux. Les 10 % les plus pauvres, plafonnés à 8 heures de production, sont à l’abri des raids.',
      detail: 'Le magasin grandit d’abord grâce à son échelle d’heures de production créée. À des niveaux élevés, si cet étage est trop petit, le magasin L s\'agrandit pour contenir 110 % du coût de l\'alliage de la raffinerie d\'alliage L → L + 1 et du coût du cristal de l\'extracteur de cristal L → L + 1 ; la fenêtre horaire qui en résulte s\'applique également au Deutérium. Un raid ne peut pas atteindre le moindre des 10 % inférieurs du magasin ou 8 heures de production de cette ressource. Le magasin ne combat ni ne réduit les dégâts reçus.',
    },
    SHIPYARD: {
      name: 'Chantier naval',
      tag: 'Débloque de meilleurs vaisseaux',
      role: 'Déverrouille les coques · accélère la construction des navires et de la défense au sol · définit la précision et la furtivité des sondes',
      detail: 'Les niveaux supérieurs ouvrent de nouvelles classes de coque et terminent les navires et les défenses au sol plus rapidement. Ils affinent également les lectures de vos sondes et rendent vos propres sondes plus difficiles à attraper. Les niveaux de chantier naval n’ajoutent aucun emplacement de file d’attente.',
    },
    HANGAR: {
      name: 'Hangar',
      tag: 'Définit la taille de la flotte',
      role: 'Espace de flotte sur ce monde · s\'améliore à tout niveau du Noyau de commandement',
      detail: 'Chaque navire occupe de l\'espace dans le hangar selon sa taille, y compris les navires loin de chez eux ; les défenses terrestres non. Un hangar plein ne construit et ne reçoit plus de navires, mais ne perd rien de ce qu\'il contient déjà. Chaque échelon coûte un tiers de la flotte à laquelle il fait de la place ; les échelons supérieurs coûtent donc plus qu\'un monde sans Magasin amélioré ne peut contenir d\'un coup.',
    },
    DEUTERIUM_PLANT: {
      name: 'Raffinerie de deutérium',
      tag: 'Fabrique du Deutérium',
      role: 'Deutérium par heure et stockage du combustible · son plafond est fixé par synthèse de deutérium',
      detail: 'Chaque niveau augmente la production passive de deutérium et la quantité pouvant être stockée. Lancements de flottes de carburants au deutérium ; recherchez le prochain échelon de synthèse de deutérium lorsque la raffinerie atteint son plafond de niveau.',
    },
  },

  instrument: {
    TELESCOPE: {
      name: 'Télescope',
      tag: 'Résoudre les mouvements à distance',
      role:
        'Identifie le mouvement à sa portée ; les emplacements de montre deviennent 1, 2, 3 et 4 en L1, L3, L5 et L7. Silencieux.',
      roleNone:
        'Identifie les mouvements distants et vous permet d\'observer silencieusement un monde choisi pour savoir si sa flotte est chez elle. Nécessite une liaison montante en orbite.',
      roleOwned:
        'Étend la zone où les engins en mouvement sont identifiés et fournit des emplacements de surveillance silencieux. Cela donne de l\'intelligence, pas de protection.',
      detail: 'Plus de niveaux étendent la vue par contact mobile et révèlent les astéroïdes qui passent lorsqu\'ils entrent dans cette zone ; un rocher révélé reste connu jusqu\'à ce qu\'il disparaisse. L1, L3, L5 et L7 offrent un, deux, trois et quatre emplacements de montre silencieuse. Un télescope ne vous avertit jamais qu\'une flotte vous vise.',
    },
    RADAR: {
      name: 'Radar',
      tag: 'Distinguer les menaces qui vous pèsent',
      role:
        'Détecte les mouvements à l\'intérieur de son cercle, améliore la détection des sondes et marque les menaces visant ce monde avec une heure d\'arrivée.',
      roleNone:
        'Nécessite une liaison montante en orbite. Sans radar, les flottes entrantes ne donnent aucun avertissement d\'arrivée et la plupart des sondes passent inaperçues.',
      roleOwned:
        'Détecte les mouvements à l\'intérieur de son cercle sans ETA et marque les menaces visant ce monde avec une heure d\'arrivée. L2 ajoute le roulement, L4 la taille brute et L5 le monde d\'origine et la flotte complète.',
      detail: 'Chaque niveau élargit le cercle de contact et d’avertissement chronométré. Les niveaux jusqu\'à L5 améliorent également les chances d\'attraper des sondes : L1 marque une flotte entrante avec son heure d\'arrivée, L2 ajoute le relèvement, L4 estime sa force et L5 révèle son origine et ses navires. L6–L8 achètent une portée supplémentaire. Un mouvement non destiné à ce monde est détecté sans ETA. Une grille d\'interception ne peut engager des armes stratégiques qu\'au radar 3 ou supérieur.',
    },
    AEGIS: {
      name: 'Aegis',
      tag: 'Bouclier pour votre planète',
      role: 'Un bouclier planétaire qui subit des dégâts avant les unités et régénère 35% de son maximum chaque heure.',
      roleNone:
        'Absorbe les dégâts du raid avant les navires et les canons au sol, puis se régénère sans ressources. Il ne fournit aucune intelligence.',
      roleOwned:
        'Absorbe les dégâts du raid avant les navires et les canons au sol et régénère 35 % de son maximum chaque heure. Il ne fournit aucune intelligence.',
      detail: 'Chaque niveau augmente la force maximale du bouclier. Les dégâts de combat sont supprimés d\'Aegis avant qu\'ils n\'atteignent les navires ou les canons au sol, et le bouclier régénère 35 % de son maximum par heure sans ressources. Il ne recueille aucune intelligence.',
    },
    VEIL: {
      name: 'Voile',
      tag: 'Se cacher des télescopes',
      role: 'Dégrade ce que n\'importe quel télescope peut lire sur vous.',
      roleNone:
        'Peut rendre le statut de votre flotte illisible pour un télescope adverse. Il cache des informations mais n\'invente pas de fausses lectures ni n\'arrête les sondes.',
      roleOwned:
        'Peut rendre le statut de votre flotte illisible pour un télescope adverse. Il cache des informations mais n\'invente pas de fausses lectures ni n\'arrête les sondes.',
      detail: 'Un voile plus fort annule les lectures plus fortes du télescope et réduit la précision de la sonde du chantier naval. Cela cache votre état ; il n\'invente pas de fausses données et ne bloque pas une sonde entrante.',
    },
  },

  satellite: {
    UPLINK: {
      name: 'Liaison montante',
      tag: 'Débloque le télescope et le radar',
      role:
        'Nécessaire pour installer un télescope ou un radar sur ce monde. Il utilise un emplacement orbital et n\'offre aucun bonus de production ou de défense.',
      blurb:
        'Un relais de communication qui déverrouille le télescope et le radar. Il n\'étend pas la vue par lui-même.',
      detail: 'Installez-le une fois pour rendre la construction de télescopes et de radars disponible sur ce monde. Il utilise un emplacement orbital et n’a jamais besoin de niveaux propres.',
    },
    FOUNDRY: {
      name: 'Fonderie',
      tag: 'Plus de minerai toutes les heures',
      role:
        'Augmente la production mondiale d’alliages passifs, de cristaux et de deutérium de 6 %.',
      blurb:
        'Prend en charge la production depuis l\'orbite, augmentant les trois flux de ressources horaires ainsi que les travaux et les capacités de stockage qui en découlent.',
      detail: 'La Fonderie applique un multiplicateur de 1,06 à la production passive d\'alliages, de cristaux et de deutérium sur ce monde. Les limites de Travaux et de stockage dérivées de ces tarifs augmentent avec cela ; le montant protégé contre les raids du magasin ne le fait pas. Cela n’affecte pas les cales minières ni les marchandises de raid.',
    },
    DERRICK: {
      name: 'Derrick',
      tag: 'Un meilleur vaisseau minier',
      role:
        'Donne à chaque prospecteur possédé par ce monde une capacité de charge de 2 × et une vitesse de déplacement de 1,5 ×.',
      blurb:
        'Prend en charge les vaisseaux miniers de ce monde depuis l’orbite. Des prises plus grandes augmentent à chaque trajet, tandis qu\'un voyage plus rapide améliore leurs chances d\'atteindre un astéroïde contesté à temps.',
      detail: 'Il multiplie la capacité de charge du Prospector par 2× et sa vitesse par 1,5×. La recherche Prospector Holds multiplie à nouveau la prise améliorée. Le Derrick change uniquement de vaisseau minier ; la cargaison de raid n’est pas affectée.',
    },
    BEACON: {
      name: 'Balise',
      tag: 'Des flottes plus rapides',
      role:
        'Permet aux flottes de raid, de transfert, de commerce et d\'aide aux clans lancées ici de voyager 1,3 fois plus vite sur les deux jambes.',
      blurb:
        'Une marque de navigation pour les flottes de raid, de transfert, de commerce et d\'aide aux clans. Des vols plus courts signifient une fenêtre plus courte avec votre défense loin de chez vous.',
      detail: 'Son multiplicateur de vitesse de 1,3 s\'applique aux flottes de raid, de transfert, de commerce et d\'aide aux clans aller et retour lancées ici. Cela n\'affecte pas les flottes des colonies ou les prospecteurs, et cela ne change aucun coût d\'attaque, de blindage, de fret ou de carburant.',
    },
  },

  /** Muharebeyi belirleyen üç rol, artı avı olan dördüncü. */
  combatClass: {
    SKIRMISHER: { name: 'Tirailleur', tag: 'Fort contre rempart ; faible contre Lance' },
    BULWARK: { name: 'Rempart', tag: 'Fort contre Lance ; faible contre tirailleur' },
    LANCE: { name: 'Lance', tag: 'Fort contre tirailleur ; faible contre rempart' },
    SUPPORT: { name: 'Soutien', tag: 'Sans armes; couvert pendant que les navires de guerre sont en vie' },
  },

  hull: {
    DART: {
      name: 'Dard',
      tag: 'Raid de vitesse fragile',
      role: 'Coque de combat d\'entrée la plus rapide ; échange la durabilité contre le temps d’exposition.',
      pitch: 'Arrive et revient rapidement, mais se plie sous un feu concentré.',
      detail: 'Un tirailleur à faible coût pour les raids courts et les contre-attaques à coque lourde. Sa vitesse préserve la disponibilité de la défense nationale ; sa coque mince rend coûteuse une lecture ratée.',
    },
    PIKE: {
      name: 'Brochet',
      tag: 'Coque de lance d\'entrée',
      role: 'Au prix du Dart, il attaque plus fort et a moins de coque, avec un avantage de classe contre les tirailleurs.',
      pitch: 'L\'attaque dépasse la force de la coque : une salve d\'ouverture plus dure achète un navire plus fragile.',
      detail: 'Pike est une lance d\'entrée de gamme qui chasse les tirailleurs tels que Dart et Thorn. Au prix du Dart, il achète plus d’attaque et moins de coque, et vole plus lentement. Les coques de rempart et les bastions le contrent, donc une flotte entièrement composée de brochets a une réponse claire et efficace.',
    },
    RAMPART: {
      name: 'Rempart',
      tag: 'Forteresse d\'entrée',
      role: 'Au prix du Gardien, il achète plus de durabilité, mais attaque moins et ralentit davantage la flotte.',
      pitch: 'Absorbe efficacement le feu de la Lance ; vulnérables aux essaims de tirailleurs.',
      detail: 'Une coque de ligne lente de classe Bulwark. Cela permet d\'acheter la survie plutôt que l\'attaque et est préférable lorsque le temps de trajet compte moins que le maintien de la formation.',
    },
    WARDEN: {
      name: 'Directeur',
      tag: 'Escorte mobile',
      role: 'Au prix de Rampart, il attaque plus fort et vole plus vite, mais a moins de coque.',
      pitch: 'Échange une partie de la durabilité de la forteresse contre un rythme d\'attaque et de flotte mixte.',
      detail: 'Warden est une escorte mobile de Bulwark avec le même prix en ressources que Rampart. Son attaque brute et sa vitesse sont plus élevées et la résistance de sa coque est inférieure. Rempart convient à un mur statique ; Warden convient à une flotte mixte qui a besoin de tempo.',
    },
    COURIER: {
      name: 'Courrier',
      tag: 'Transport léger et rapide',
      role: 'Coque de chargement d\'entrée ; rapide, légèrement protégé et non armé.',
      pitch: 'Suit le rythme des flottes de forteresses et de lances, mais ralentit les formations de tirailleurs les plus rapides.',
      detail: 'Une coque de support pour le butin, les transferts et le règlement. Il n\'inflige aucun dégât et n\'est protégé que pendant la survie des escortes de combat.',
    },
    VIPER: {
      name: 'Vipère',
      tag: 'Raider efficace',
      role: 'Vitesse de niveau deux et meilleure survie que Dart.',
      pitch: 'Préserve le plan de flotte rapide tout en payant moins de taxe de durabilité.',
      detail: 'Un tirailleur de niveau deux sans recherche. Le Dart reste moins cher, alors que les deux coques partagent la même vitesse brute. Viper transforme son engagement plus important en plus d\'attaque, de coque, de fret et en une meilleure efficacité de combat à coût égal.',
    },
    TALON: {
      name: 'Talon',
      tag: 'Attaquant lourd',
      role: 'Au prix du Viper, il attaque beaucoup plus fort, a moins de coque, vole plus lentement et contrecarre les tirailleurs.',
      pitch: 'L\'attaque dépasse la force de la coque ; un navire plus fragile équilibre ses dégâts plus élevés.',
      detail: 'Une coque de dégâts de classe Lance pour les chantiers développés. Les pions Rempart comptent toujours plus que leur avantage de rang.',
    },
    STRONGHOLD: {
      name: 'Bastion',
      tag: 'Coque lourde',
      role: 'Au prix de Sentinel, il a la plus grande durabilité de niveau deux, mais moins d’attaque et de vitesse.',
      pitch: 'Construit un mur lorsque la survie compte plus que l\'heure d\'arrivée.',
      detail: 'Un rempart au profil de forteresse. Sa coque haute ancre les flottes, tandis que les tirailleurs et leur longue exposition restent des coûts évidents.',
    },
    SENTINEL: {
      name: 'Sentinelle',
      tag: 'Escorte de niveau deux',
      role: 'Au prix de Stronghold, il attaque plus fort et vole plus vite, mais a moins de coque.',
      pitch: 'Échange la durabilité de la forteresse contre le rythme de l\'attaque et de la flotte.',
      detail: 'Une escorte de rempart mobile qui protège les transports sans forcer le profil de voyage de la forteresse.',
    },
    WAYFARER: {
      name: 'Voyageur',
      tag: 'Transport équilibré',
      role: 'Plus de capacité que le Courrier ; plus lent mais toujours flexible.',
      pitch: 'Le choix intermédiaire entre le Courrier rapide et l’Atlas haute capacité.',
      detail: 'Un transport de soutien de niveau deux pour les raids et transferts plus importants. Elle reste désarmée et dépend des escortes de combat.',
    },
    TEMPEST: {
      name: 'Tempête',
      tag: 'Raider de vitesse avancé',
      role: 'Tirailleur de niveau trois, sécurisé par la recherche ; partage la vitesse de combat brute la plus rapide avec Dart, Viper et Corsair.',
      pitch: 'Vitesse de fin de partie avec une efficacité améliorée, toujours pas un vaisseau de ligne.',
      detail: 'Un raider avancé débloqué par Engineering et Ship Power. Il conserve un profil fragile, de sorte que les murs et les comptoirs des niveaux inférieurs restent pertinents.',
    },
    BALLISTA: {
      name: 'Baliste',
      tag: 'Attaquant avancé',
      role: 'Au prix de Tempest, il attaque beaucoup plus fort, a moins de coque et vole plus lentement qu\'une Lance de niveau trois.',
      pitch: 'L\'attaque dépasse la force de la coque, mais des dégâts élevés ne la sauveront pas du mur droit du rempart.',
      detail: 'Une coque d\'attaque de niveau trois nécessitant de l\'ingénierie et de la puissance du navire. Il récompense une cible informée, et non une production aveugle mono-flotte.',
    },
    LEVIATHAN: {
      name: 'Leviathan',
      tag: 'Forteresse avancée',
      role: 'Au prix du Prétorien, il achète plus de coque, mais moins d\'attaque et de vitesse pour un mur de niveau trois.',
      pitch: 'Un mur de fin de partie qui fait de chaque vol un engagement à long terme.',
      detail: 'Une forteresse de niveau trois débloquée grâce à l\'ingénierie et à l\'armure du navire. Les tirailleurs restent son contre-attaque efficace.',
    },
    PRAETORIAN: {
      name: 'Prétorien',
      tag: 'Escorte avancée',
      role: 'Au prix du Léviathan, il attaque plus fort et vole plus vite, mais a moins de coque.',
      pitch: 'Échange une partie de la durabilité de la forteresse contre un rythme d\'attaque et de flotte mixte.',
      detail: 'Une escorte de rempart de niveau trois nécessitant une ingénierie et un blindage de navire. Il protège la cargaison sans devenir le choix le plus lent possible.',
    },
    ATLAS: {
      name: 'Atlas',
      tag: 'Transport lourd de troisième niveau',
      role: 'La plus grande cale de niveau trois ; lent, volumineux et axé sur la recherche.',
      pitch: 'Le transport sûr et à grand volume le plus efficace avant le déverrouillage d\'Argosy.',
      detail: 'Un transport de soutien de niveau trois débloqué par l\'ingénierie et la propulsion. Il n\'inflige aucun dégât et rend la planification de l\'escorte essentielle.',
    },
    NULLIFIER: {
      name: 'Annulateur',
      tag: 'Brise les boucliers actifs',
      role: 'Un spécialiste de la Lance axé sur l\'attaque : l\'attaque dépasse la force de la coque, avec cinq fois son effet normal contre un bouclier actif.',
      pitch: 'Écrase une égide sans transformer les dégâts supplémentaires en unités tuées. Faible lorsqu\'aucun bouclier n\'est debout.',
      detail: 'Sa charge spécialisée inflige cinq fois l\'effet normal à une égide active. Une fois le bouclier tombé, ce bonus ne se répercute pas sur les navires ou les canons, donc les cibles non protégées gaspillent sa prime.',
    },
    /** D200. `{{salvage}}` `SALVAGE.perCollector`'dır; `names.ts` doldurur. */
    GARBAGE_COLLECTOR: {
      name: 'Éboueur',
      tag: 'Remonte {{salvage}} de l\'épave',
      role: 'Coque de soutien spéciale : ne tire rien et récupère l\'épave après la bataille dans laquelle elle a volé.',
      pitch: 'Vole derrière la ligne comme un moyen de transport et prend les derniers tirs. Gardez les navires de guerre à côté de lui : une fois qu’ils tombent, il devient une proie.',
      detail: 'Lorsque la bataille se termine, chaque collectionneur encore en vie soulève le {{salvage}} de l\'épave – dans le mélange d\'alliage, de cristal et de deutérium de l\'épave – avant que le reste ne dérive comme un champ public. Le transport atterrit en stock avec la flotte. Il n\'ajoute rien à la cale, ne peut pas voler sans navire de guerre, ne peut pas être envoyé sur un champ d\'épaves ou un astéroïde, et ne récupère rien en se défendant.',
    },
    CATACLYSM: {
      name: 'Cataclysme',
      tag: 'L\'attaquant de la capitale',
      role: 'Au prix du Corsair, il attaque beaucoup plus fort, a moins de coque et vole plus lentement qu\'une Lance de rang quatre.',
      pitch: 'L\'attaque dépasse la force de la coque ; un navire plus fragile et des compteurs de classe équilibrent sa dure salve.',
      detail: 'Une coque de Lance capitale derrière l\'ingénierie, la puissance et l\'armure. Son efficacité est plus élevée, mais la défense de classe Bulwark reste une meilleure réponse que son miroir.',
    },
    CORSAIR: {
      name: 'Corsaire',
      tag: 'Pillard de la capitale',
      role: 'Le seul tirailleur du niveau supérieur – ce qui brise un mur de rempart.',
      pitch: 'Au prix de Cataclysm, il est plus rapide et plus résistant, mais attaque moins et a une emprise plus petite.',
      detail: 'Corsair est le seul tirailleur de niveau quatre et partage la vitesse de combat brute la plus élevée avec Dart, Viper et Tempest. Il a moins d\'attaque brute que Cataclysm mais bénéficie de l\'avantage du Tirailleur contre les murs de la Citadelle ; Les cibles de classe Lance le contrent.',
    },
    CITADEL: {
      name: 'Citadelle',
      tag: 'Forteresse capitale',
      role: 'Au prix du Paladin, il a plus de coque, moins d\'attaque et la vitesse de combat de niveau quatre la plus lente.',
      pitch: 'Le mur le plus solide, payé en coût et en temps d\'exposition.',
      detail: 'Une coque de rempart capitale derrière l\'ingénierie, le blindage et la puissance. Il ancre la défense mais reste vulnérable aux pions Skirmisher.',
    },
    PALADIN: {
      name: 'Paladin',
      tag: 'Escorte capitale',
      role: 'Au prix de Citadel, il attaque plus fort et vole plus vite, mais a moins de coque.',
      pitch: 'Une escorte de niveau quatre qui échange une partie de la durabilité de la forteresse contre le rythme de l\'attaque et de la flotte.',
      detail: 'Le Paladin est de classe Bulwark, il arrête donc les Lances et tombe aux mains des Tirailleurs. Il dépense à la place la prime qu\'une Citadelle paie pour l\'armure sur les armes – la seule option entre les deux extrêmes du niveau quatre.',
    },
    ARGOSY: {
      name: 'Argosy',
      tag: 'Transporteur de capitaux',
      role: 'La cale la plus profonde et la coque la plus lente du jeu.',
      pitch: 'Transporte presque jusqu\'à trois Atlas et ne peut rien distancer du tout.',
      detail: 'L\'Argosy est un moyen de transport de niveau quatre. Classe de soutien, elle est donc protégée pendant que les coques de combat sont en vie et sans défense une fois la ligne disparue. L\'allure du marchand est liée à cette coque : la cale la plus lente du catalogue la fixe.',
    },
    BASTION: {
      name: 'Bastion',
      tag: 'Canons terrestres lourds',
      role: 'Défense terrestre · ne peut jamais quitter la planète',
      pitch: 'Défense terrestre lourde avec un avantage contre les coques de classe Lance ; vulnérable aux tirailleurs.',
      detail: 'Les bastions ne quittent jamais la planète. Leur classe Bulwark leur donne un avantage contre les coques de classe Lance, tandis que les tirailleurs reçoivent l\'avantage contre eux. Après le combat, 60 % des canons terrestres détruits sont restaurés, arrondis à l\'inférieur.',
    },
    HARPOON: {
      name: 'Harpon', tag: 'Canon terrestre Lance', role: 'Défense au sol · emplacement Lance immobile',
      pitch: 'Perce les formations d’Escarmoucheurs ; vulnérable aux Remparts.',
      detail: 'Les Harpons ne quittent jamais la planète. Leur classe Lance leur donne l’avantage contre les Escarmoucheurs, tandis que les Remparts les contrent. Ils utilisent la capacité au sol ; 60 % des canons détruits sont reconstruits après le combat, arrondi à l’inférieur.',
    },
    THORN: {
      name: 'Épine',
      tag: 'Canons légers au sol',
      role: 'Défense au sol · léger, bon marché et ne quitte jamais',
      pitch: 'Défense au sol à faible coût avec un avantage contre les remparts ; vulnérable aux Lances.',
      detail: 'Les épines ne quittent jamais la planète. Leur classe Skirmisher leur donne un avantage contre les coques de classe Bulwark, tandis que les coques de classe Lance reçoivent l\'avantage contre eux. Ils utilisent la capacité au sol ; 60 % des canons terrestres détruits sont restaurés après le combat, arrondi à l\'inférieur.',
    },
    PROSPECTOR: {
      name: 'Prospecteur',
      tag: 'Mines d\'astéroïdes',
      role: 'Les astéroïdes miniers avec une base de 200 · ne peuvent pas rejoindre une flotte de raid',
      pitch: 'Intercepte un astéroïde en mouvement et renvoie ce qu\'il peut transporter aux Travaux. Il ne peut ni attaquer ni transférer.',
      detail: 'Un prospecteur ne peut être envoyé que vers des astéroïdes et des champs de débris révélés. Sa vitesse de base est de 825 et sa tenue de base est de 200 ; une recherche de Derrick et Prospector Holds peut les améliorer. Chaque monde commence avec de la place pour deux ; Prospector Holds III ouvre un troisième emplacement d\'artisanat. Il ne rejoint jamais les raids ou la défense intérieure.',
    },
  },

  resource: {
    alloy: 'alliage',
    crystal: 'cristal',
    deuterium: 'Deutérium',
  },

  unlock: {
    TELESCOPE: {
      title: 'Télescope débloqué',
      body: 'Une liaison montante et un télescope identifient les mouvements plus loin et vous permettent d\'observer une planète.',
    },
    RADAR: {
      title: 'Radar débloqué',
      body: 'Une liaison montante et des sondes de capture radar ; à partir de L1, son cercle marque également les menaces qui vous sont adressées avec leur heure d\'arrivée.',
    },
    EXPLORER: {
      title: 'Explorateur débloqué',
      body: 'Envoyez une sonde pour en être sûr. Leur radar pourrait le détecter.',
    },
    VEIL: {
      title: 'Voile débloqué',
      body: 'L\'état de votre flotte peut indiquer INCONNU à toute personne qui vous regarde.',
    },
  },
} as const;

export const gains = {
  /** Under a producer rung: its price over what it adds, on this world's output. Faz 4.1. */
  repays: 'Rentabilisé en {{time}}',
  rangeUnits: 'Unités {{count}}',

  core: {
    label: 'Construire un plafond',
    level: 'L{{level}}',
    releases_one: 'Libère la mise à niveau bloquée {{count}}',
    releases_other: 'Libère les mises à niveau bloquées {{count}}',
    raisesCap: 'Relève le plafond des bâtiments',
  },
  hangar: {
    label: 'Salle de flotte',
    value: 'Salle {{room}}',
    none: 'Pas de hangar',
    ceiling: 'Jusqu\'à {{room}} au niveau supérieur',
  },
  refinery: {
    label: 'Alliage par heure',
    rate: '{{amount}}/h',
    storage: 'Stockage {{now}} → {{next}}',
  },
  extractor: {
    label: 'Cristal par heure',
    rate: '{{amount}}/h',
    storage: 'Stockage {{now}} → {{next}}',
  },
  vault: {
    label: 'Profondeur du magasin',
    value: 'Magasin {{store}}h · {{safe}}h protégé',
  },
  shipyard: {
    accuracyLabel: 'Précision de la sonde',
    seesLabel: 'Voit à travers un voile jusqu\'à',
    seesValue: 'L{{level}}',
    unlocksHull: 'Débloque le {{hull}}',
    stealth: 'Et rend vos propres sondes plus difficiles à détecter',
  },

  telescope: {
    slotsLabel: 'Planètes que vous pouvez observer',
    rangeLabel: 'Jusqu\'où tu peux voir',
    maxed: 'Niveau supérieur : emplacements de montre {{slots}} et unités {{range}} de viseur à contact mobile ; assez pour traverser la galaxie',
    reachAndCooldown: 'Atteint {{range}} · un emplacement se réaligne dans {{hours}}h',
    nextSlot: 'Le niveau suivant ajoute un emplacement {{ordinal}}',
    ordinalSecond: '2ème',
    ordinalThird: '3ème',
    ordinalFourth: '4ème',
    cooldown: 'Un emplacement se réaligne dans {{hours}}h',
  },
  radar: {
    scansLabel: 'Détecte les analyses',
    scansNo: 'Non',
    scansYes: 'Oui',
    scansBearing: 'oui, avec roulement',
    sweepLabel: 'Zone de contact · avertissement chronométré',
    sweepNone: 'aucun',
    reaches: 'Contact {{sense}} (pas d\'ETA) · Avertissement temporisé {{warn}}',
    maxed: 'Niveau supérieur ; les avertissements révèlent également le monde d\'origine et la flotte exacte',
    l1: 'Commence à détecter les sondes et avertit lorsqu\'une flotte entrante entre dans le cercle',
    bearing: 'L2 révèle également la direction de l\'approche',
    interception: 'L3 permet une interception stratégique une fois la grille d\'interception recherchée',
    estimate: 'Affiche tôt la taille approximative de la force qui s\'approche',
    origin: 'L\'avertissement nomme le monde d\'origine et la flotte exacte',
  },
  aegis: {
    label: 'Bouclier maximum',
    unlocks: 'Absorbe les dégâts avant les unités · régénère {{percent}}% du maximum chaque heure',
  },
  veil: {
    label: 'Aveugle un télescope jusqu\'à',
    none: 'aucun',
    level: 'L{{level}}',
    unlocks: 'Réduit la précision d\'une sonde à {{percent}} à chantier naval égal',
  },

  foundry: {
    label: 'Production horaire de ressources',
    now: 'sortie de courant',
    next: '+{{percent}}%',
    unlocks: 'S\'applique à la production d\'alliages, de cristaux et de deutérium sur ce monde.',
  },
  uplink: {
    label: 'Télescope et Radar',
    now: 'fermé',
    next: 'débloqué',
    unlocks: 'Un télescope et un radar peuvent être installés sur ce monde',
  },
  derrick: {
    label: 'Chaque prospecteur porte',
    now: '1×',
    next: '{{factor}}×',
    unlocks: 'Les prospecteurs voyagent également {{factor}}× plus rapidement',
  },
  beacon: {
    label: 'Flotte de raid, de transfert, de commerce et d\'aide',
    now: 'vitesse normale',
    next: '{{factor}}× plus rapide',
    unlocks: 'Aller et retour – une fenêtre plus courte avec votre défense à l’extérieur',
  },
  research: {
    powerLabel: 'Attaque de navire de guerre',
    powerScope:
      'Chaque navire de guerre de votre flotte. La puissance et l\'armure totalisent au maximum 56 % de puissance de combat à budget égal ; les transports et la défense terrestre ne sont pas affectés.',
    armorLabel: 'Résistance de la coque du navire',
    armorScope:
      'Tous les navires de votre flotte, transports inclus. La puissance et l\'armure totalisent au maximum 56 % de puissance de combat à budget égal ; la défense au sol n’est pas affectée.',
    speedLabel: 'Vitesse de la flotte',
    speedScope:
      'Tous les navires de votre flotte. Une flotte mixte vole toujours à la vitesse améliorée de son membre le plus lent ; Les prospecteurs et sondeurs ne sont pas affectés.',
    engineeringLabel: 'Accès au niveau de coque',
    engineeringTier: 'Niveau {{tier}}',
    engineeringScope:
      'L\'ingénierie I ouvre le niveau 3 et l\'ingénierie II ouvre le niveau 4. Les coques individuelles peuvent également nécessiter des charges de puissance, de blindage, de propulsion ou gravitiques.',
    groundLabel: 'Force de défense au sol',
    groundScope: '{{bastion}}, {{harpoon}} et {{thorn}} sur chaque monde que vous possédez.',
    yardLabel: 'Temps de construction des navires',
    robotsLabel: 'Temps de construction de la structure',
    holdsLabel: 'Prise de prospecteur',
    holdsScope: 'Se multiplie avec un Derrick en orbite.',
    cargoLabel: 'Cargaison de raid',
    cargoScope: 'Butin uniquement – ​​les transferts mondiaux et le minage restent inchangés.',
    refineryLabel: 'Plafond de raffinerie',
    stockpileLabel: 'Armes prêtes',
    /* İzin bir kapı açar; merdiven gibi çizmek olmayan bir miktar uydurmak olur. */
    opensLabel: 'Déverrouille',
    open: 'Ouvrir',
    shut: 'Fermé',
    isotopeOpens: 'Les astéroïdes isotopiques deviennent des cibles minières sélectionnables.',
    denseOpens: 'La recherche sur la propulsion des navires devient disponible.',
    graviticOpens: 'Les exigences de recherche spécialisée du Nullifier sont satisfaites.',
    protocolOpens: 'L\'Étoile de la Mort devient constructible.',
    gridOpens: 'La charge d\'interception devient constructible.',
  },
  plant: {
    label: 'Deutérium',
    value: '{{rate}}/h',
    storage: 'Stockage de carburant {{now}} → {{next}}',
  },
} as const;

export const directives = {
  inboundTitle: 'Flotte entrante · {{duration}}',
  inboundDetail:
    'Dépensez le stock, envoyez votre flotte ou restez debout et combattez. Il ne peut pas être pris s\'il n\'est pas là.',
  inboundAction: 'Dépensez-le maintenant',

  undefendedTitle: 'Ce monde n\'a pas de défense terrestre',
  undefendedShieldedTitle: 'Votre bouclier tombe dans {{duration}} : construisez une défense terrestre',
  undefendedDetail:
    '{{amount}} est exposé aux raids. Construisez des épines ou des bastions pour une défense permanente.',
  undefendedAction: 'Construire la défense',

  exposedTitle: '{{amount}} peut vous être retiré',
  exposedDetail: 'Votre coffre-fort protège {{now}}. Le niveau suivant protège {{next}}.',
  exposedAction: 'Élevez le coffre-fort',

  scannedTitle_one: 'Quelqu\'un t\'a scanné',
  scannedTitle_other: '{{count}} effectue une analyse contre vous',
  scannedDetail:
    'Ils essaient de connaître votre stock et vos défenses. Un Voile réduit ce que leur sonde peut révéler.',
  scannedAction: 'Voir le journal',

  windowTitle: 'La flotte de {{name}} est absente',
  windowDetailUnknownJustNow: 'Vu à l\'instant. Vous ne savez pas quand il reviendra.',
  windowDetailUnknown: 'Vu il y a {{age}}. Vous ne savez pas quand il reviendra.',
  windowDetailEta:
    'Revenons à environ {{duration}}. Leur planète retient tout ce qu’ils ont laissé derrière eux.',
  windowAction: 'Ouvre la fenêtre',

  storageFullTitle: '{{amount}} ne peut pas être collecté',
  storageFullDetail: 'Votre magasin est plein, les œuvres n’ont donc nulle part où se vider. Dépensez quelque chose et réclamez-le.',
  storageFullAction: 'Dépensez-le',

  noTelescopeTitle: 'Tu n\'as qu\'une vue à l\'oeil nu',
  noTelescopeDetail:
    'Votre vue libre peut déjà révéler un astéroïde qui passe à proximité. Un télescope étend cette zone de découverte, identifie les engins en mouvement plus loin et peut observer silencieusement une planète pour vous avertir du départ de sa flotte.',
  noTelescopeAction: 'Installer un télescope',

  noRadarTitle: 'Une flotte pourrait atterrir ici sans avertissement',
  noRadarDetail:
    'Le radar L1 marque déjà une menace qui vous vise avec son heure d\'arrivée à l\'intérieur du cercle. Des niveaux plus élevés élargissent la plage et révèlent plus de détails.',
  noRadarAction: 'Regardez le radar',

  coreCeilingTitle: 'Le Noyau de commandement bloque {{count}} amélioration(s)',
  coreCeilingDetail: 'Rien ne peut dépasser le Core. L\'élever les libère tous en même temps.',
  coreCeilingAction: 'Élevez le noyau',

  idleTitle: 'Rien n\'est en vol',
  idleDetailHasShips: 'Vos baies sont inactives. Vous pouvez lancer un raid, un transfert ou une opération minière ; les sondes n\'utilisent pas de baies.',
  idleDetailNoShips: 'Vous n\'avez pas de navires chez vous. Construisez-en ou attendez que le vôtre revienne.',
  idleAction: 'Trouver une cible',

  baysFreeTitle_one: 'Une baie est encore libre',
  baysFreeTitle_other: 'Les baies {{count}} sont toujours libres',
  baysFreeDetail: 'Les raids, les transferts et les opérations minières en prennent un. Les sondes n\'utilisent pas de baies.',
  baysFreeAction: 'Cherche quelque chose',

  kindThreat: 'Menace',
  kindOpportunity: 'Opportunité',
  kindGrowth: 'Faiblesse',
  kindIdle: 'Rien en attente',

  /** The fold. One word each way: the card is small enough that a label is the control. */
  hide: 'Cacher',
  show: 'Montrer',
} as const;

export const notifications = {
  incomingFallback: 'Flotte entrante.',
  incomingLanded: 'atterri',
  incomingEta: 'ETA {{minutes}} min',
  incomingLandsIn: 'atterrit dans {{duration}}',
  incomingHead: 'Flotte entrante · {{clock}}',
  strategicIncomingHead: 'Arme stratégique entrante · {{clock}}',
  incomingEstimate: 'est. {{count}} navires',
  incomingFrom: 'de {{origin}}',
  /** Okuyanın hangi dünyası hedefte. Radar ürünü değil. */
  incomingAt: 'visant {{world}}',
  commanderAt: '{{username}} à {{planet}}',
  unknownCommander: 'quelqu\'un',
  raidedBy: 'Pillard : {{origin}} ·',
  composition: '{{count}} {{hull}}',
  join: ' · ',

  raidedFallback: 'Vous avez été perquisitionné.',
  repelledHead: 'Raid repoussé · {{cost}}',
  repelledLost: '{{count}} a perdu sa participation',
  repelledTheirs: '{{count}} d\'entre eux détruits',
  raided: 'Perquisitionné · {{detail}}',
  raidedWorks: 'production réduite pendant {{time}}',
  raidedTaken: '−{{amount}} pris',
  raidedLost_one: 'Unité {{count}} perdue',
  raidedLost_other: '{{count}} unités perdues',
  raidedNothing: 'Perquisitionné · ils n\'ont rien obtenu',
  /** Taktik geri çekilme, défenseur : les vaisseaux ont décollé, ou le réservoir n’a pas suffi. */
  raidedEscaped_one: '{{count}} vaisseau a décollé',
  raidedEscaped_other: '{{count}} vaisseaux ont décollé',
  raidedStranded_one: 'le réservoir n’a pas suffi pour {{count}} vaisseau',
  raidedStranded_other: 'le réservoir n’a pas suffi pour {{count}} vaisseaux',
  /** Taktik geri çekilme, attaquant : la ligne s’est vidée — rien sur son contenu. */
  raidTargetFled: 'leurs vaisseaux ont décollé',

  raidResultFallback: 'Votre raid est résolu.',
  raidWiped: '{{target}} détenu · votre flotte a été détruite · {{count}} navires perdus',
  raidResult: '{{grade}} à {{target}} · {{detail}} · {{count}} navires perdus',
  raidNothing: 'rien de pris',
  spoilAlloy: '+Alliage {{amount}}',
  spoilCrystal: '+Cristal {{amount}}',
  spoilDeuterium: '+{{amount}} Deutérium',
  spoilSalvage: '+{{amount}} récupération',

  fleetFallback: 'Votre flotte est à la maison.',
  fleetHomeLooted: 'Accueil de la flotte{{where}} · Navires {{count}} · +{{amount}} pillés',
  fleetHomeEmpty: 'Accueil de la flotte{{where}} · {{count}} navires · les mains vides',
  fleetHomeRecalled: "Flotte rentrée{{where}} · {{count}} vaisseaux · rappelée avant l'assaut",
  fleetHomeBare: 'Accueil de la flotte{{where}} · Navires {{count}}',
  /**
   * THE MERCHANT'S OWN HOMECOMING. D166.
   *
   * A swap is not a raid, so it never borrows the plunder wording — and a
   * convoy that bought nothing is a different fact from a fleet that found
   * nothing, which is why the empty case has its own line.
   */
  tradeHome: 'Convoi à la maison · Navires {{count}} · acheté {{landed}}',
  tradeHomeEmpty: 'Convoi de retour · Navires {{count}} · rien d\'acheté',
  /**
   * THE PIRATE LANE HAS ITS OWN HOMECOMING AND ITS OWN EMPTY TRIP. D177.
   *
   * A pirate is not a commander: there is no world to come back FROM by name
   * and no ledger that moved, so these never borrow the raid's wording. And a
   * flight that arrived at nothing is a different fact from one that fought and
   * lost — it names what was gone and how many craft are turning back, and never
   * who got there first.
   */
  targetGonePirate: 'Le pirate {{callsign}} a déjà été détruit · Les navires {{count}} font demi-tour',
  targetGoneAsteroid: 'La roche a été décapée avant votre arrivée · {{count}} foreurs revenant',
  targetGoneDebris: 'Le champ de l\'épave a déjà été nettoyé · Les forets {{count}} reviennent en arrière',
  pirateHome: 'Retour des pirates · {{count}} vaisseaux · +{{amount}} pillés',
  pirateHomeEmpty: 'Retour des pirates · {{count}} vaisseaux · les cales sont vides',
  pirateHomeBare: 'Retour des pirates · {{count}} vaisseaux',
  pirateHomeTowed_looted: 'Retour des pirates · {{count}} vaisseaux · +{{amount}} pillés · {{hull}} capturé',
  pirateHomeTowed_empty: 'Retour des pirates · {{count}} vaisseaux · {{hull}} capturés',
  fleetFrom: 'de {{origin}}',
  probeLost: 'Votre sonde a été perdue · ce vol n\'a pas pu être effectué',
  recalled: 'L\'engin {{count}} est revenu · ce vol n\'a pas pu être effectué',
  miningRecalledHome: '{{count}} Accueil des prospecteurs · rappel terminé',
  transferReturningCapacity: 'Transfert retour de {{target}} · capacité de destination remplie en vol',
  transferReturningOwnership: 'Transfert revenant de {{target}} · le monde a changé de mains en vol',

  salvageWord: 'Sauver',
  oreWord: 'Minerai',
  haulWasted: 'Accueil {{what}} · aucune capacité disponible · {{amount}} supprimé',
  haulNothing: '{{what}} rentre à la maison · plus rien à prendre',
  haulPartly: '{{what}} Accueil · {{landed}} · {{amount}} perdu, fonctionne à plein',
  haul: '{{what}} accueil · {{landed}}',

  scanDetected: 'Analyse détectée. Quelqu\'un recueille des renseignements sur votre monde.',

  probeFallback: 'Une sonde est à la maison. Son rapport est lisible.',
  probeHome: 'Accueil de la sonde · {{target}} est lisible{{caught}}',
  probeCaught: '· ils l\'ont attrapé',

  unlock: '{{title}} — {{body}}',
  deathStarFallback: 'Votre frappe de l\'Étoile de la Mort a été résolue.',
  deathStar: {
    FIRST_STRIKE: 'Impact EMP · Aegis vidée ; défenses terrestres désactivées pendant 1 heure',
    CAPTURED: 'Impact de l\'Étoile de la Mort · colonie capturée',
    INEFFECTIVE: 'Impact de l\'Étoile de la Mort · aucun effet',
  },
  colonyCaptured: 'Colonie sécurisée · la protection de l\'occupation est active',
  colonyLost: 'Colonie perdue suite à une frappe stratégique',
  colonyFault: '{{planet}} · {{fault}}',
  colonyLoyalty: '{{planet}} glisse — les choses de {{count}} sont cassées et il déclare son indépendance dans {{time}}.',
  settlementLost: 'Course à la colonisation perdue · les courriers et les marchandises reviennent',
  interceptedDefended: 'Votre grille a détruit une étoile de la mort {{range}} unités.',
  interceptedLost: 'Votre étoile de la mort a été détruite {{range}} unités avant sa cible.',
  interceptedFallback: 'Une étoile de la mort a été détruite en vol.',
  asteroidShowerStarted: 'Une pluie d\'astéroïdes a commencé dans la galaxie.',
  asteroidShowerEnded: 'La pluie d\'astéroïdes est terminée · L\'apparition des astéroïdes est revenue à la normale.',
  tradeShipStarted: 'Un vaisseau commercial est dans la galaxie · Alliage {{alloy}} = 1 deutérium.',
  tradeShipEnded: 'Le vaisseau commercial a quitté la galaxie.',
  intergalacticConvoyStarted: 'Le convoi intergalactique traverse la galaxie.',
  intergalacticConvoyEnded: 'Le convoi intergalactique est parti.',
  intergalacticConvoyResult: 'Attaque du convoi résolue · {{resources}} · coût : {{ships}} · retour en cours.',
  intergalacticConvoyHome: 'Le convoi est de retour · {{resources}} · coût : {{ships}}.',
  intergalacticConvoyNoResources: 'pas de ressources',
  intergalacticConvoyNoShip: 'aucun vaisseau',
} as const;

/**
 * ZAMAN VE SAYILAR.
 *
 * Kısaltmalar Türkçenin kendi kısaltmaları: saat sa, dakika dk, saniye sn, gün g.
 * Geri sayımda yer çok dar olduğu için saat ve dakika tek harfe iniyor (s, d) —
 * bu, "1s 04d" biçiminin İngilizcedeki "1h 04m" ile aynı genişlikte kalmasını
 * sağlar ve şeritteki sayılar hizadan çıkmaz. Binler ayracı Türkçede nokta,
 * ondalık ayracı virgül; `numberLocale` bunu Intl'e devrediyor. Yüzde işareti
 * Türkçede sayının önüne gelir.
 */
export const units = {
  now: 'maintenant',
  live: 'en direct',
  ago: 'Il y a {{duration}}',
  imminent: 'à tout moment',
  hoursMinutes: '{{h}}h {{m}}m',
  minutesSeconds: '{{m}}m {{s}}s',
  hoursMinutesSeconds: '{{h}}h {{m}}m {{s}}s',
  seconds: '{{s}}s',
  daysHours: '{{d}}d {{h}}h',
  minutes: '{{m}}m',
  numberLocale: 'fr-FR',
  thousands: '{{value}}k',
  millions: '{{value}}M',
  percent: '{{value}}%',
  rangeJoin: '–',
  plus: '+',
  minus: '−',
} as const;
