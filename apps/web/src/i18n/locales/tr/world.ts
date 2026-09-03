/**
 * DİSK VE ÜZERİNDEKİ HER ŞEY — galaksinin kendi çerçevesi, komutan sayfası ve
 * "bu ne, ben bunun hakkında ne biliyorum" sorusunu cevaplayan odak şeridi.
 *
 * Odak şeridindeki sınır cümleleri bu oyunun kalbi: oyuncuya neyi GÖREMEDİĞİNİ
 * söylerler. O yüzden hepsi düz ve net kurulur — "bu okumada yok" gibi bir kalıp
 * tek bir yerde belirlenir ve her yerde aynı biçimde tekrarlanır, ki oyuncu
 * sınırın nerede olduğunu ezberleyebilsin.
 */

export const galaxy = {
  settlementAway: "{{world}} için yerleşim görevi yola çıktı",
  deathStarAway: "Ölüm Yıldızı {{world}} yönüne fırlatıldı",
  online: "{{count}} çevrimiçi",
  onlineToday: "24 saatte {{count}}",
  worlds: "{{count}} gezegen",
  fleetAway: " · {{count}} filo dışarıda",
  rocks: " · {{count}} kaya",
  pirates_one: " · {{count}} korsan",
  pirates_other: " · {{count}} korsan",
  wrecks_one: " · {{count}} enkaz",
  wrecks_other: " · {{count}} enkaz",
  asteroidShower: 'Asteroid yağmuru',
  asteroidShowerStatus: 'Oluşma ×{{multiplier}} · {{remaining}} kaldı',
  openWorlds: "Dünyaların",
  openIntel: "İstihbarat",
  /* Disk başlığının altındaki iki sensör anahtarı. Yalnızca `aria-label`. */
  showTelescope: "Teleskop menzilini göster",
  hideTelescope: "Teleskop menzilini gizle",
  showRadar: "Radar menzilini göster",
  hideRadar: "Radar menzilini gizle",
  openResearch: "Araştırma",
  openClan: "Klan",
  kindCapital: "Ana gezegen",
  kindColony: "Koloni",
  kindNeutral: "Tarafsız · {{tier}}. kademe",
  /** A world nobody has surveyed. The only honest thing to print about it. D127. */
  /** Hatırlanan dünyanın alt satırı: kaydın kendisi ve kaç yaşında olduğu. D151. */
  recordAge: "Kayıt · {{age}}",
  unsurveyed: "Keşfedilmemiş",
  owned: "Senin",
  clanmate: "Klan arkadaşın",
  rival: "Rakip",
  recovery: "Toparlanma açığı",
  claimOpen: "Hak açık",

  harvestAway: "{{count}} araç kalktı · enkaza {{minutes}} dk",
  miningAway: "{{count}} araç kalktı · kayaya {{minutes}} dk",

  panelPlanetEyebrow: "Gezegenin",
  panelCommanderEyebrow: "Komutan",
  panelIntelEyebrow: "Bildiklerin",
  panelIntelTitle: "İstihbarat",

  commander: {
    galaxyLabel: "Galaksi",
    galaxyUnknown: "—",
    endsLabel: "Sezonun bitmesine",
    endsUnknown: "—",
    wipeNote:
      "Sıfırlamada bütün galaksiler baştan kuruluyor ve herkes yeniden başlıyor.",
    signOut: "Çıkış yap",
  },
} as const;

/**
 * ELİNDEKİ DÜNYALARIN LİSTESİ. T3.
 *
 * `galaxy`'nin dünya sözcüklerinin tekrarı değil, kendi ad alanı: burası
 * basılabilen bir satırda başkent diyor, disk ise bir altyazıda. İkisi ayrışmakta
 * serbest olmalı — D55.
 */
export const worlds = {
  eyebrow: "Elindekiler",
  title: "Dünyaların",
  /** Listenin kendi adı; yoksa satırlar adsız üç düğme olur. */
  list: "Dünyaların",
  centre: "Aktif Gezegenine Yakınlaş 🪐",
  active: "Etkin",
  kindCapital: "Ana gezegen",
  kindColony: "Koloni",
  craft_one: "{{count}} araç",
  craft_other: "{{count}} araç",
  bays: "Rampa",
  sendTitle: "Kolay Aktarım",
  sendFrom: "Gönderen",
  sendHere: "Buraya gönder",
  /** Listedeki üç aynı düğmenin hangisi olduğunu söylemesi gerekir. */
  sendTo: "Buraya gönder — {{name}}",
  /** Satırdaki iki resmin ekran okuyucu karşılığı. */
  store: "{{resource}}: {{cap}} kapasitenin {{amount}} kadarı",
  baysReading: "{{total}} uçuş yuvasının {{used}} tanesi dolu",
  alloy: "Alaşım",
  crystal: "Kristal",
  deuterium: "Döteryum",
} as const;

export const focus = {
  shellLabel: "{{title}} — odak",
  clear: "Seçimi bırak",

  unknown: "Bilinmiyor",

  planet: {
    transfer: "Aktar",
    settle: "Koloni kur",
    settleNeedSlot: "Koloni kur · koloni yuvası dolu",
    settleNeedBay: "Koloni kur · uçuş rampaları dolu",
    settleNeedCourier: "Koloni kur · 2 Kurye gerekli",
    settleNeedAlloy: "Koloni kur · Alaşım eksik",
    settleNeedCrystal: "Koloni kur · Kristal eksik",
    settleNeedFuel: "Koloni kur · Döteryum eksik",
    settleTooLate: "Koloni kur · zamanında varamaz",
    settleRecovering: "Koloni kur · ana dünya toparlanıyor",
    settlementConfirm: {
      eyebrow: "Koloni yarışı",
      title: "{{world}} üzerinde koloni kur",
      unsurveyedTitle: "Bu dünyada koloni kur",
      race: "Geçerli 2 Şilebi ilk ulaştıran oyuncu gezegeni alır.",
      noRecall:
        "Koloni gemileri geri çağrılamaz. Başkası önce kazanırsa Kuryelerin ve kuruluş yükün geri döner; harcanan yakıt dönmez.",
      transports: "Koloni gemileri",
      foundingCargo: "Kuruluş yükü",
      cargoValue: "{{alloy}} Alaşım · {{crystal}} Kristal",
      fuel: "Uçuş yakıtı",
      arrives: "Varış süresi",
      closes: "Yarışın bitmesine",
      confirm: "Koloni gemilerini gönder",
      confirming: "Gönderiliyor…",
    },
    deathStar: "Ölüm Yıldızı",
    deathStarStrike: "Ölüm Yıldızı · harap et",
    deathStarCapture: "Ölüm Yıldızı · ele geçir",
    deathStarUnavailable: "Hazır Ölüm Yıldızı yok",
    deathStarProtected: "Ölüm Yıldızı · hedef korumada",
    deathStarNeedBay: "Ölüm Yıldızı · rampalar dolu",
    deathStarTooLate: "Ölüm Yıldızı · yetişemez",
    deathStarNeedSlot: "Ölüm Yıldızı · koloni yuvası dolu",
    deathStarOriginRecovering: "Ölüm Yıldızı · ana dünya toparlanıyor",
    kindCapital: "Ana gezegen",
    kindColony: "Koloni",
    kindNeutral: "Tarafsız",
    capitalProtected: "Ele geçirilemez ana gezegen",
    capitalProtectedHint:
      "Ölüm Yıldızı evdeki gemileri, topları ve bina siparişlerini yok eder; depodaki ve üretim havuzundaki kaynakları yarıya indirir, Çekirdeği bir ve Aegis’i iki seviye düşürür. Ana gezegenin kontrolü asla el değiştirmez.",
    capitalRecovering: "Ana gezegen harap · ele geçirilemez",
    capitalRecoveringHint:
      "Tekrar vurabilirsin: kalanın yarısı da gider ve toparlanma baştan başlar; kontrol yine el değiştirmez.",
    yourCapital: "Korunan ana gezegenin",
    yourColony: "Kolonin",
    transferHint: "Gemi ve kaynakları buraya tek yönlü aktarımla taşı.",
    transferRoute: "Dünyalar arası aktarım",
    transferOrigin: "Çıkış",
    transferTarget: "Hedef",
    transferFrom: "{{origin}} gezegeninden",
    transferCraft: "Hazır gemi",
    transferPrepare: "Gemi ve kaynak seç",
    transferRecovering: "Çıkış dünyası toparlanıyor",
    colonyRoute: "Koloni kurmanın yolu",
    claimOpen: "Koloni yarışı açık",
    settlementInFlight: "Koloni gemilerin yolda",
    claimRaceExplain: "Gezegen henüz kimsenin değil. Geçerli 2 Şilebi ilk ulaştıran oyuncu gezegeni alır.",
    colonySlots: "{{used}} / {{total}} koloni yuvası",
    routeRaid: "Kesin zafer kazan",
    routeRaidDetail: "Savaş gemileriyle akın yap. Bütün savunma gemilerini ve kalkanı yok et.",
    routeClaim: "Yarış otomatik açılır",
    routeClaimDetail: "Bir şey göndermezsin. Kesin zafer gelince sistem yarışı kendisi açar.",
    routeSettle: "Koloni filosunu gönder",
    routeSettleDetail: "Kuruluş gemileri ve kaynakları yalnızca şimdi gönderilir. İlk geçerli varış kazanır.",
    routeSettleInFlightDetail: "Kuruluş filon yolda. İlk geçerli varış gezegeni alır.",
    raidFleetBadge: "Akın filosu",
    raidFleetExplain:
      "Akın ekranında savaş gemilerini seç; tüm savunmayı ve kalkanı yok et. 1. adımda Kurye, kuruluş kaynağı veya koloni yuvası gerekmez.",
    automaticBadge: "Otomatik",
    automaticExplain:
      "Kesin zafer yarışı otomatik açar. 2. adım için başka gemi veya kaynak göndermezsin.",
    settlementAwayBadge: "Yolda",
    settlementAwayExplain:
      "2 Şilebin ve kuruluş kaynakların yola çıktı. Geri çağrılamazlar; ilk geçerli varış gezegeni alır.",
    claimCloses: "{{duration}} sonra kapanır",
    claimRaidStillOpen: "Tekrar akın yapılabilir; açık hakkın süresi uzamaz.",
    claimDeathStarConsequence:
      "Ölüm Yıldızı bu hakkı siler ve {{duration}} toparlanma başlatır. Ele geçirme yolu ikinci darbedir.",
    openColonySlot: "Koloni yuvası",
    colonySlotExplain:
      "Yalnızca 3. adımda gerekir. Kuruluş filosu kalkarken en güçlü Komuta Çekirdeğinde kullanılabilir bir koloni yuvası olmalı.",
    captureColonySlotExplain:
      "İkinci Ölüm Yıldızı darbesinin bu koloniyi alabilmesi için boş bir koloni yuvan olmalı.",
    openFlightBay: "1 boş uçuş rampası",
    flightBayExplain:
      "Yalnızca 3. adımda gerekir. 2 Şilebin tek yönlü kuruluş uçuşu, gezegene varana kadar 1 rampayı kullanır.",
    courierCount: "2 Kurye",
    haulerExplain:
      "Yalnızca 3. adımda gerekir: kuruluş filosudur ve yarış açıldıktan sonra akından ayrı gönderilir. Akın için Kurye gerekmez.",
    foundingAlloy: "{{amount}} Alaşım",
    foundingAlloyExplain:
      "{{amount}} Alaşım, 3. adımda yeni koloninin başlangıç stoğu olarak taşınır. Akının maliyeti değildir.",
    foundingCrystal: "{{amount}} Kristal",
    foundingCrystalExplain:
      "{{amount}} Kristal, 3. adımda yeni koloninin başlangıç stoğu olarak taşınır. Akının maliyeti değildir.",
    settlementFuel: "{{amount}} Döteryum",
    settlementFuelExplain:
      "2 Kurye, 3. adımdaki tek yön uçuşunda {{amount}} Döteryum yakar. Bu miktar mesafeye göre değişir.",
    settlementArrivalExplain:
      "Kuruluş uçuşu {{duration}} sürer. Yarış kapanmadan varmalı; ilk geçerli varış kazanır.",
    arrivesIn: "{{duration}} içinde varır",
    deathStarRoute: "Stratejik ele geçirme yolu",
    recoveryBreach: "Toparlanma açığı · ele geçirme penceresi",
    occupationProtected: "İşgal koruması",
    protectedFor: "{{duration}} boyunca vurulamaz veya ele geçirilemez.",
    firstImpact: "Hasar + {{duration}} toparlanma",
    secondImpact: "Kontrol el değiştirir",
    deathStarReadyRequirement: "Ölüm Yıldızı hazır",
    deathStarReadyExplain:
      "İkinci darbe için çıkış gezegeninde tamamlanmış bir Ölüm Yıldızı bekliyor olmalı.",
    deathStarArrivalExplain:
      "Kontrolün el değiştirebilmesi için Ölüm Yıldızı bu toparlanma süresi bitmeden varmalı.",

    /** Üretim kartıyla aynı gerçekler, tetiği çeken kişinin diliyle. D113/D55. */
    strikeTitle: "Bu darbe ne yapar",
    strikeFleet: "Yerdeki bütün gemiler ve toplar yok olur",
    strikeStock: "Depo ve üretim havuzundaki kaynakların yarısı yok olur",
    strikeCore: "Komuta Çekirdeği bir seviye iner; yeni sınırı aşan binalar da düşer",
    strikeAegis: "Aegis {{levels}} seviye iner ve kalkan sıfırlanır",
    strikeDark:
      "{{duration}} boyunca üretim, toplama, inşa, sipariş verme ve fırlatma durur",
    strikeCapture: "Bu pencere içinde inen ikinci darbe kontrolü alır",
    strikeNoCapture:
      "Ana gezegen tekrar harap edilebilir ama asla ele geçirilemez",
    eyebrow: "Sahibi: {{owner}}",
    location: "Dünya · {{planet}}",
    /** A world outside every reach and never probed. It has no other name. D127. */
    unsurveyedEyebrow: "Dünya · keşfedilmemiş",
    unsurveyedTitle: "Buraya kimse bakmadı",
    attack: "Saldırı planla",
    attackNeutralAgain: "Tekrar akın · hak değişmez",
    attackOriginRecovering: "Saldırı · ana dünya toparlanıyor",
    windowOpen: "Filoları evde değil. Bu dünya şu anda normalden daha az savunuluyor.",
    distance: "Mesafe",
    reach: "Varış süren",
    reachUnknown: "—",
    known: "Bildiklerin",
    knownOf: "{{total}} üzerinden {{have}}",

    headlineFleetAway: "Filo dışarıda",
    headlineFleetHome: "Filo evde",
    headlineVeiled: "Perdeli",
    headlineProbed: "Sonda · {{age}}",
    headlineFought: "Çatışma · {{age}}",
    headlineNone: "Hiçbir bilgi yok",

    installTelescope: "Teleskop kur",
    watchSlot: "{{slot}}. yuvayı çevir",
    replaceSlot: "{{slot}}. yuva · {{target}} yerine",
    watching: "{{target}} izlemeye alındı",
    sendProbe: "Sonda gönder · {{alloy}} alaşım · {{crystal}} kristal",
    probeAway: "Sonda kalktı · {{duration}} sonra rapor verecek",
    probeCooling: "Buraya az önce baktın · yeni sonda {{duration}} sonra",
    markRival: "Rakip olarak işaretle",
    rivalMarkedAction: "Rakibin",
    rivalMarked: "{{commander}} artık Rakibin.",
    rivalCleared: "{{commander}} artık Rakip olarak işaretli değil.",
    rivalHeading: "Bu sezonki hikâyeniz",
    rivalMarkedBadge: "İşaretli Rakip",
    rivalEncounters: "Karşılaşma",
    rivalYourRaids: "Senin baskınların",
    rivalTheirRaids: "Onların baskınları",
    rivalDominion: "Hâkimiyet",
    rivalDominionValue: "kazanç +{{gained}} · kayıp −{{lost}}",
    rivalLastContact: "Son temas {{age}}",
    rivalProbeOnly: "Bu dünyaya baktın ama iki taraf da henüz ateş açmadı.",
    rivalNoContact:
      "Bu komutanı Rakip seçtin. Aranızdaki ilk hamle hâlâ bekliyor.",
    rivalAhead:
      "Üstünlük sende. Senden geri almak isteyecekleri Hâkimiyet var.",
    rivalBehind: "Üstünlük onlarda. Hesap henüz kapanmadı.",
    rivalEven:
      "Aranızdaki hesap dengede. Bir sonraki karşılaşma dengeyi bozacak.",
    rivalFeud:
      "{{count}} karşılaşma bunu tek bir baskından daha fazlası yaptı.",
    rivalPurpose:
      "Bu komutanı ve ortak sezon hesabınızı sabitler. Savaş veya istihbarat bonusu vermez.",
  },

  asteroid: {
    eyebrow: "{{level}}. seviye asteroit",
    title: "Geçen kaya",
    summaryOre: "{{amount}} cevher",
    summaryAnomaly: "{{amount}} cevher · izotop anomalisi",
    working_one: "{{count}} aracın bu kayada · {{state}}",
    working_other: "{{count}} aracın bu kayada · {{state}}",
    stateReturning: "dönüyor",
    stateInbound: "gidiyor",
    noCraft: "Evde Kazıcı yok",
    tooLate: "Sen varmadan gitmiş olur",
    researchNeeded: "Önce İzotop Spektrometrisi araştır",
    send: "{{count}} gönder · {{duration}}",
    oreLeft: "Kalan cevher",
    leavesIn: "Diskten çıkışına",
    composition: "İçindeki",
    compositionValue: "%{{percent}} kristal",
    compositionUnknown: "İzotop bileşimi bilinmiyor",
    compositionIsotope: "%{{crystal}} kristal · %{{deuterium}} Döteryum",
    deuteriumRoute:
      "Döteryum kazanmak için Kazıcı gönder. Dönüş yükü üretim havuzuna iner; depoya geçirmek için Topla düğmesine bas.",
    speed: "Hız",
    speedValue: "dakikada {{rate}}",
    spill:
      "Havuzun ancak {{room}} daha alabilir. Bu yükün {{lost}} kadarı varışta kaybedilir; önce havuzu boşalt.",
    taken: "İçinden {{amount}} kadarını birileri çoktan almış.",
    untouched: "Hiç dokunulmamış. İlk varan, taşıyabildiği kadarını alır.",
    fleetLine_one: "Evde {{count}} Kazıcı var; {{hold}} taşıyor.",
    fleetLine_other:
      "Evde {{count}} Kazıcı var. Her biri {{hold}} taşıyor, hepsi birden {{total}}.",
    derrickPitch:
      "Yörüngedeki bir <0>{{name}}</0> bunu her biri için <1>{{hold}}</1> yapar, üstelik daha erken vardırır.",
    intercept:
      "Araçların {{reach}} sonra kayayı yakalar; {{spare}} de payın kalır.",
  },

  craftPicker: {
    label: "Kaç araç gitsin",
  },

  debris: {
    eyebrow: "Enkaz",
    titleUnknown: "Enkaz sahası",
    titleOver: "{{planet}} üzerindeki enkaz",
    summarySalvage: "{{amount}} hurda",
    working_one: "{{count}} aracın orada · {{state}}",
    working_other: "{{count}} aracın orada · {{state}}",
    stateReturning: "dönüyor",
    stateInbound: "gidiyor",
    noCraft: "Evde Kazıcı yok",
    tooLate: "Sen varmadan dağılır",
    send: "{{count}} gönder · {{duration}}",
    alloyLeft: "Kalan alaşım",
    crystalLeft: "Kalan kristal",
    deuteriumLeft: "Kalan Döteryum",
    goneIn: "Dağılmasına",
    yourHold: "Taşıma kapasiten",
    spill:
      "Havuzun ancak {{room}} daha alabilir. Bunun {{lost}} kadarı varışta kaybedilir; önce havuzu boşalt.",
    body: "Bir çatışmadan kalan bu enkaz sahası zamanla dağılıyor ve galaksideki herkese açık. İlk varan taşıyabildiği kaynağı alır.",
  },

  run: {
    eyebrowHome: "Dönüş yolunda",
    eyebrowSalvage: "Hurda seferi",
    eyebrowOutbound: "Gidiş yolunda",
    title_one: "{{count}} Kazıcı",
    title_other: "{{count}} Kazıcı",
    homeIn: "Eve varışına",
    reachesIn: "Varışına",
    meetsRockIn: "Kayayı yakalamasına",
    target: "Hedef",
    targetWreck: "{{planet}} üzerindeki enkaz",
    targetWreckAnon: "Bir gezegenin üzerindeki enkaz",
    targetDecayed: "Saha dağıldı",
    targetRock: "{{level}}. seviye kaya",
    targetRockGone: "Kaya geçip gitti",
    carrying: "{{alloy}} alaşım ve {{crystal}} kristal taşıyor.",
    carryingDeuterium:
      "{{alloy}} alaşım, {{crystal}} kristal ve {{deuterium}} Döteryum taşıyor.",
    emptySalvage: "Vardığında saha çoktan yağmalanmıştı; eli boş dönüyor.",
    emptyRock: "Vardığında kaya çoktan boşaltılmıştı; eli boş dönüyor.",
    salvageNote:
      "Enkaz sahası sabit kalır ve herkes tarafından görülür. {{clock}} İlk varan taşıyabildiğini alır.",
    salvageClock: "{{duration}} sonra dağılıyor.",
    miningNote:
      "Kayanın şu anki yerine değil, varacağı yere uçuyor. İlk varan taşıyabildiğini alır.",
  },

  thread: {
    eyebrowProbeHome: "Sonda dönüyor",
    eyebrowProbeOut: "Sonda gidiyor",
    eyebrowFleetHome: "Filo dönüyor",
    eyebrowFleetOut: "Filo gidiyor",
    arrivesIn: "Varışına",
    craft: "Gemi",
    craftUnknown: "—",
    returning: "Dönüş yolundaki araçlara yeni emir verilemez.",
    outbound: "Kalkan filo geri çağrılamaz.",
  },

  contact: {
    eyebrowBattle: "Bir akın iniyor",
    eyebrowInbound: "Bu temas sana geliyor",
    eyebrowSalvage: "Biri hurda topluyor",
    eyebrowMining: "Biri maden çıkarıyor",
    eyebrowProbe: "Biri keşif yapıyor",
    eyebrowMoving: "Biri hareket hâlinde",
    titleUnknown: "Tanımsız",
    eyebrowUnknown: "Tanımlanamayan hareket",
    unknownHint:
      "Teleskop görüş alanının dışında. Bu temas görüş alanına girdiğinde araç türü; bir filoysa içerdiği gemiler ve kesin adetleri okunabilir.",
    /** Radar 5 türü söyler ama aracı göstermez; okumanın kaynağı yazılmalı. */
    radarKind: "Radar bunu {{kind}} olarak tanımlıyor. Bu mesafede araç görüntüsü ve filo dökümü okunamıyor.",
    titleBattle: "Ateş altında",
    titleFleet: "Filo",
    titleProbe: "Sonda",
    titleMining: "Maden seferi",
    titleHarvest: "Hurda seferi",
    titleDeathStar: "Ölüm Yıldızı",
    titlePirate: "Korsan filosu",
    eyebrowPirate: "Dışarıda korsanlar var",
    boundaryPirate:
      "Korsanı ve uçurduğu gemileri görüyorsun. Nereden geldiği ve yörüngesi görünmez — korsan bir konumdur, bir rota değil.",
    working: "Çalışıyor",
    craftCount: "{{count}} gemi",
    massLight: "Küçük temas",
    massMedium: "Kayda değer güç",
    massHeavy: "Ağır güç",
    massHint: "Yalnızca büyüklük — bu mesafeden döküm alınamaz.",
    inboundHint:
      "Radar bunun dünyalarından birine yöneldiğini ayırt etti. Varış süresi ayrı bir zamanlı uyarıyla bildirilir.",
    bombarding: "Bombardıman",
    settling: "Şu an sonuçlanıyor",
    unattributed: "Kime ait belli değil",
    arrivalUnknown: "Varışı bilinmiyor",
    inboundNoClock: "Sana geliyor · saati bilinmiyor",
    craftLabel: "Gemi",
    craftUnknown: "—",
    statusLabel: "Durum",
    statusLanded: "İndi",
    arrivesIn: "Varışına",
    arrivesUnknown: "Bilinmiyor",
    boundaryBattle:
      "O gezegenin üzerinde bir filo var ve ateş ediyor. Teleskop görüşündeyse tam formasyonu görünür; sahibi, geldiği yer ve kimin kazanacağı bilinmez.",
    boundarySalvage:
      "Enkaz sahası, rota ve varış süresi herkese açıktır; aracın eve götürdüğü kaynak gizli kalır.",
    boundaryMining:
      "Bu kayayı keşfettiğin için hedefi, rotayı ve varış süresini görürsün; aracın eve götürdüğü kaynak gizli kalır.",
    boundaryFleet:
      "Teleskop görüşünde aracın kendisini; bir filoysa gemi türlerini ve kesin adetlerini görüyorsun. Sahibi, çıkış ve varış yeri bilinmez.",
    boundaryUnknown:
      "Yalnızca hareketi görüyorsun. Araç türü, büyüklüğü, sahibi, çıkış ve varış yeri bu okumada yok.",
    telescopeHint:
      "Bir dünyayı izlemek, filosunun evde olup olmadığını söyler. Haritadaki hareketi olası bir saldırı fırsatına bağlayan bilgi budur.",
    wreckHint:
      "Enkaz herkese açıktır. İki filodan geriye ne kalırsa birazdan orada olacak; isteyen gidip alır.",
  },
} as const;

/** Korsan filoları. D150. Türkçe doğal yazılır; `İ` naif case-fold edilmez. */
export const pirate = {
  title: "Korsan filosu",
  name: "Korsan filosu S{{level}}-{{callsign}}",
  level: "Seviye {{level}}",
  eyebrow: "Seviye {{level}} korsanlar",
  damagePenalty: "Bu filo %{{percent}} daha az hasar verir",
  /** Bir dünyaya saldırırken açılan taahhüt sayfasının aynısını açar. D150. */
  attack: "Saldır",
  yourFleet: "Filon",
  atHome: "{{count}} evde",
  fewer: "{{name}} azalt",
  more: "{{name}} artır",
  quantity: "{{name}} adedi",
  max: "Tüm {{name}} gemilerini gönder",
  maxShort: "Tümü",
  noShipsAtHome: "Bu dünyada gönderilecek gemi yok.",
  leftAtHome: "Evde kalan savunma gücü: {{power}}",
  eyebrowUnknown: "Tanımlanamayan temas",
  pickShips: "En az bir gemi seç",
  fuelCost: "Yakıt {{amount}} döteryum",
  noFuel: "Bu gidiş-dönüş için döteryum yetmiyor",
  noBay: "Boş uçuş yatağı yok",
  tooSlow: "Seçtiğin en yavaş gemi ona yetişemez",
  roster: "Kadro",
  rosterUnknown: "Bu menzilde kadro okunamıyor",
  unknownContact: "Tanımlanamayan temas",
  mass: "Kütle",
  leavesIn: "Bölgeden ayrılmasına",
  reach: "{{duration}} sonra yetişir",
  reachLabel: "Varışın",
  tooLate: "Yetişemeden bölgeden ayrılır",
  unreachable: "Bu dünyadaki hiçbir gemi ona yetişemez",
  alreadyRaiding: "Bu dünyadan zaten bir akın yolda",
  outOfSight: "Sensör menzilinde değil",
  noShips: "Evde gemi yok",
  captureHint: "Kesin zafer hâlinde kadrodan bir gemi kazanabilirsin",
  captured: "{{hull}} ele geçirildi",
  captureMissed: "Eve çekilecek gemi kalmadı",
  send: "{{count}} gemi gönder · {{duration}}",
  outbound: "Kalkan filo geri çağrılamaz.",
  boundary:
    "Korsan şu an bulunduğu yerdedir; hatırlanmaz. Sensörlerinden çıktığı anda geri dönene kadar bu listeden kaybolur.",
  hoardHint: "Eve taşıyacağın ganimet, götürdüğün kargo hacmiyle sınırlıdır.",
} as const;
