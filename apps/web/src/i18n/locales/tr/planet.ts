/**
 * KENDİ GEZEGENİN — dört karar başlığı, satırları, satırın arkasındaki detay
 * sayfası ve saldırı planlayıcısı.
 *
 * SEKME ADLARI HEPSİ AD, HİÇBİRİ EMİR DEĞİL. İngilizcesi Defend / Orbit / Reach /
 * Grow: ikisi fiil, ikisi ad, ve İngilizcede bu karışım göze batmaz. Türkçede
 * "Savun / İstihbarat / Menzil / Büyüt" diye karışık dizmek sekme çubuğunu dağıtır,
 * çünkü Türkçede emir kipi doğrudan oyuncuya seslenir ve ad öyle değildir. Dördü
 * de ad oldu: Üretim · Bilgi · Savunma · Filo. Sekme "burada ne var" der,
 * altındaki soru "burada neye karar veriyorsun" der.
 */

export const planet = {
  recovery: "Toparlanma sürüyor · sistemler {{duration}} sonra açılır",
  interceptor: {
    eyebrow: "Stratejik savunma bataryası",
    none: "Yüklü mühimmat yok",
    building: "Yükleniyor · {{duration}}",
    paused: "Toparlanma sırasında yükleme durdu",
    ready: "Bir mühimmat yüklü",
    build: "Mühimmat yükle",
    started: "Mühimmat yükleniyor",
    hint: "Zamanlı Radar çemberine giren veya dünyalarından birinin Teleskop görüşünde tanımladığı ilk Ölüm Yıldızı’nı imha eder. Ateşlendiğinde tükenir.",
    readyHint:
      "Hazır. Radar önleme çemberine giren veya Teleskop görüşünde tanımlanan ilk Ölüm Yıldızı’nı imha eder.",
    needResearch: "Önleme Ağı",
    needRadar: "Radar {{level}}. seviye",
    needUplink: "Yörüngede Anten",
    needOperational: "Dünya çalışır durumda",
    buildTime: "{{duration}} · tek mühimmat · ateşlenince biter",
  },

  deathStar: {
    eyebrow: "Kısıtlı stratejik silah",
    none: "Bu dünyada Ölüm Yıldızı yok",
    building: "Üretiliyor · {{duration}}",
    paused: "Toparlanma sırasında üretim duraklatıldı",
    ready: "Fırlatmaya hazır",
    build: "Üret",
    started: "Ölüm Yıldızı üretimi başladı",
    dangerHint:
      "Tek yönlü gezegen kırıcı. Her darbe harap eder; ikinci darbe yalnız koloni veya tarafsız dünyayı ele geçirebilir.",
    readyHint:
      "Silahlı. Herhangi bir düşman dünyasını seç; ana gezegenler harap edilir ama ele geçirilemez.",
    needProtocol: "Protokol",
    needCore: "Çekirdek {{level}}. seviye",
    needShipyard: "Tersane {{level}}. seviye",
    needOperational: "Dünya çalışır durumda",
    buildTime: "60 dk · tek silah · geri çağrılamaz",

    /** Tek darbenin ne yaptığı, para harcanmadan önce, açık açık. D113. */
    effectsTitle: "Tek darbe ne yapar",
    effectFleet: "Dünyada duran bütün gemileri ve topları yok eder",
    effectStock: "Depo ve üretim havuzundaki kaynakların yarısını yok eder",
    effectCore:
      "Komuta Çekirdeği’ni bir seviye indirir; yeni Çekirdek sınırını aşan binalar da bu seviyeye düşer",
    effectAegis: "Aegis’i {{levels}} seviye indirir ve kalkanı sıfırlar",
    effectDark:
      "{{duration}} boyunca üretimi, toplamayı, inşayı, yeni siparişleri ve fırlatmayı durdurur",
    effectSurvives:
      "Yeni Çekirdek sınırını aşmayan binalar, araştırmalar ve diğer yörünge donanımları korunur",
  },
  tabs: {
    label: "Gezegen bölümleri",
    defendProblem: "Savunma",
    defendQuestion:
      "Kalkanını, kasanı ve gezegen toplarını burada güçlendirirsin.",
    orbitProblem: "Bilgi",
    orbitQuestion: "Rakipleri görmeni sağlayan araçları burada kurarsın.",
    reachProblem: "Filo",
    reachQuestion:
      "Gemilerini, menzilini ve özel projelerini burada geliştirirsin.",
    growProblem: "Üretim",
    growQuestion: "Kaynaklarını ve bina seviye sınırını burada büyütürsün.",
  },

  wallet: {
    inTheWorks: "havuzda <0>{{amount}}</0>",
  },

  queue: {
    ends: "{{time}}’de biter",
    segment: "{{name}} · {{duration}}",
    cancelOne: "{{name}} siparişini iptal et",
    title: "Üretim sıraları",
    idle: "Üretim yok",
    capacity: "her birinde {{count}} yer",
    construction: "İnşaat",
    yard: "Tersane",
    slotFree: "Boş",
    empty: "Bağlanmış iş yok",
    committing: "işleniyor…",
    staged: "sahiplenince başlar",
    queued_one: "{{count}} sipariş sırada",
    queued_other: "{{count}} sipariş sırada",
    unitsQueued_one: "{{count}} birlik sırada",
    unitsQueued_other: "{{count}} birlik sırada",
    afterQueue: "Sıra bitince",
    cancel: "İptal",
    cancelling: "İptal ediliyor…",
    refund:
      "İade: {{alloy}} alaşım · {{crystal}} kristal · {{deuterium}} döteryum",
    cancelled:
      "Sipariş iptal edildi · {{alloy}} alaşım, {{crystal}} kristal ve {{deuterium}} döteryum geri geldi",
  },

  capacity: {
    hangarBand: "Filo alanı",
    hangarUse:
      "Hangar alanı {{used}} / {{total}}. Bu dünyadan ayrılmış gemiler de kendi yerini kullanmaya devam eder.",
    hullUse:
      "Her biri {{bulk}} yer kullanır · sıra bitince {{used}} / {{total}} bağlı.",
    full: "Yer yok: {{total}} alanın {{used}} kadarı bağlı. Önce ilgili kapasiteyi yükselt.",
  },

  roles: {
    vault:
      "Her kaynak için korumalı bir miktar belirler. Bu sınırın üstünde kalan stok akınlarda yağmalanabilir.",
    shipyard:
      "Yeni gemi sınıflarını açar; gemi ve yer savunması üretimini hızlandırır, sondalarının başarı ihtimalini artırır.",
    refinery:
      "Saatlik alaşım üretimini ve alaşım depo kapasitesini artırır. Binaların ve gemilerin çoğu bu kaynağı kullanır.",
    extractor:
      "Saatlik kristal üretimini ve kristal depo kapasitesini artırır. Gelişmiş gemiler, cihazlar ve araştırmalar kristal kullanır.",
    coreCapped_one:
      "{{count}} bina mevcut Çekirdek sınırına ulaştı; Çekirdeği yükseltmeden ilerleyemez.",
    coreCapped_other:
      "{{count}} bina mevcut Çekirdek sınırına ulaştı; Çekirdeği yükseltmeden ilerleyemez.",
    coreClear:
      "Hiçbir bina Çekirdek seviyesini geçemez. Bina sınırlarını ve inşaat hızını Çekirdek belirler.",
  },

  defend: {
    strategicBand: "Stratejik savunma",
    strategicNote:
      "Yüklü mühimmat, 3. seviye Radarın algıladığı veya Teleskop görüşünde tanımlanan ilk Ölüm Yıldızı’nı imha eder; ateşlenince tükenir.",
    shieldBand: "Kalkan",
    shieldNote:
      "Aegis hasarı birliklerine ulaşmadan önce karşılar. Seviyeler azami kalkanı artırır; yenilenme hızı azami değerin saatte %35’idir.",
    groundBand: "Yerdekiler (kapasite komuta merkezi ile artar)",
    groundNote:
      "Gezegenden ayrılmazlar. Kirpi Siper sınıfına, Tabya ise Mızrak sınıfına karşı üstünlük kazanır.",
    thornNone:
      "Hafif yer savunmasıdır. Siper sınıfına karşı güçlü, Mızrak sınıfına karşı zayıftır.",
    thornStanding:
      "Yerde {{count}} tane var. Siper sınıfına güçlü, Mızrak sınıfına zayıf.",
    thornGain: "Kirpi",
    bastionNone:
      "Ağır yer savunmasıdır. Mızrak sınıfına karşı güçlü, Çevik sınıfa karşı zayıftır.",
    bastionStanding:
      "Yerde {{count}} tane var. Mızrak sınıfına güçlü, Çevik sınıfa zayıf. Yok edilen yer toplarının %60’ı aşağı yuvarlanarak enkazdan yeniden kurulur.",
    groundGain: "Yerdeki birlik",
    aegisPointer: "Kalkan bir donanım; <0>{{name}}</0> Yörünge sekmesinde.",
  },

  orbit: {
    contextLabel: "Yörünge ağı",
    networkBand: "Bağlantı",
    networkNote: "Anten bir yuva karşılığında Teleskop ve Radarı açar.",
    intelBand: "Gezegen cihazları",
    intelNote: "Seviye alırlar, yörünge yuvası kullanmazlar.",
    inOrbitBand: "Yörüngede",
    inOrbitNote: "Her biri bir yuva kaplar. Bir kez alınır, seviyesi yoktur.",
    onPlanetBand: "Gezegende",
    onPlanetNote:
      "Yuva istemez. Bunların seviyesi var; Komuta Çekirdeğin izin verdiği kadar yükseltirsin.",
    slotsFree_one: "Yukarıda {{count}} yuva daha boş",
    slotsFree_other: "Yukarıda {{count}} yuva daha boş",
    slotsNone: "yörünge dolu",
    slotsUsed: "{{used}}/{{total}}",
    slotsNext: " · Çekirdek {{level}}. seviyede +1",
    rackLabel: "Yörünge yuvaları",
    slotEmpty: "Boş",
    inactiveSatellite:
      "Sahipsin; Komuta Çekirdeği bu yörünge yuvasını yeniden açana kadar pasif.",
    inactiveUplink:
      "{{owned}}. seviye sende; Anten yeniden etkinleşene kadar pasif.",
    inactiveCore:
      "{{owned}}. seviye sende · Komuta Çekirdeği onarılana kadar {{active}}. seviye etkin.",
    alreadyInOrbit: "zaten yörüngede",
  },

  reach: {
    orbitBand: "Operasyon uyduları",
    orbitNote:
      "Matkap bu dünyanın Kazıcılarını hızlandırıp ambarlarını büyütür; Kılavuz akın ve transfer filolarını hızlandırır. Her biri bir yörünge yuvası kullanır.",
    family: {
      OFFENSIVE: {
        label: "Saldırı gemileri",
        note: "Akıncılar hıza, taarruz gemileri saldırıya yatırım yapar. Satırlar seviyeye göre ilerler.",
      },
      DEFENSIVE: {
        label: "Savunma gemileri",
        note: "Kaleler hızdan dayanım kazanır; refakatçiler filo temposunu daha iyi korur.",
      },
      CARGO: {
        label: "Yük gemileri",
        note: "Silahsız nakliyeler rota hızıyla ambar kapasitesini değiş tokuş eder ve refakat ister.",
      },
      SPECIALIST: {
        label: "Özel gemiler",
        note: "Görünür bir soruna dar cevap verir; yanlış hedefte uzmanlık bedeli boşa gider.",
      },
    },
    frontierBand: "Ufuk araştırmaları",
    frontierNote:
      "Araştırmalar komutanın ortak sırasını kullanır. İnşaat ve Tersane ayrı çalışmaya devam eder.",
    isotopeName: "İzotop Spektrometrisi",
    isotopeTag: "Döteryum madenciliğini açar",
    isotopeRole:
      "İzotop kayalarındaki Döteryumu gösterir ve onlara Kazıcı göndermeni sağlar. Dönen yük üretim havuzuna gelir.",
    denseName: "Yoğun Yakıt Hücreleri",
    denseTag: "Koşucuyu açar",
    denseRole:
      "Keşfetmek için bir akında ambarını doldur; hedefte ganimet kalsın. Koşucu, Şilep’ten hızlıdır ama daha az taşır.",
    graviticName: "Gravitik Yükler",
    graviticTag: "Delici’yi açar",
    graviticRole:
      "Açmak için savunması ve aktif Aegis’i olan bir dünyaya saldır; kalkan hasarın en az {{share}}’ini emsin. Bir Atmaca bile yeter; kazanman gerekmez. Delici kalkana beş kat vurur.",
    gridName: "Önleme Ağı",
    gridTag: "Ölüm Yıldızı’nı düşürür",
    gridRole:
      "Yüklü mühimmat; stratejik silahı 3. seviye Radar önleme çemberinde veya Teleskop görüşünde imha eder. Kurulum için Anten ve Radar 3 gerekir.",
    stockpileName: "Stratejik Stok",
    stockpileTag: "Rampada ikinci silah",
    stockpileRole:
      "Her dünyada iki Ölüm Yıldızı hazır tutabilirsin. İkincisi, birincinin üretimi bittikten sonra aynı bedel ve süreyle kurulur.",
    waspDoctrineName: "Atmaca Doktrini",
    lanceDoctrineName: "Mızrak/Delici Doktrini",
    bulwarkDoctrineName: "Siper Doktrini",
    groundDoctrineName: "Tabya/Kirpi Doktrini",
    generalName: "Silah ve Zırh",
    generalTag: "Sahip olduğun her gövdeyi geliştirir",
    doctrineTag: "Daha iyi saldırı ve zırh",
    doctrineRole:
      "İlgili sınıfın saldırı gücünü ve gövde dayanımını birlikte artırır. Araştırmalar doğal sınıf üstünlüklerini değiştirmez.",
    yardName: "Tersane Otomasyonu",
    yardTag: "Gemileri daha hızlı kurar",
    yardRole:
      "Hareketli gemilerin üretim süresini kısaltır; yer savunmalarını ve üretim sırası kapasitesini etkilemez.",
    holdsName: "Kazıcı Ambarları",
    holdsTag: "Kazıcılar daha çok taşır",
    holdsRole:
      "Her Kazıcının tek seferde taşıdığı cevheri artırır; Matkabın sağladığı ambar artışı bunun üzerine uygulanır.",
    cargoName: "Gemi Ambarları",
    cargoTag: "Akınlar daha çok getirir",
    cargoRole:
      "Akın filosunun taşıyabileceği ganimeti artırır; dünyalar arası transferi ve asteroit madenciliğini etkilemez.",
    synthesisName: "Döteryum Sentezi",
    synthesisTag: "Rafineri seviye sınırını yükseltir",
    synthesisRole:
      "Her kademe, sahip olduğun bütün dünyalarda üç yeni Döteryum Rafinerisi seviyesi açar.",
    deathStarName: "Ölüm Yıldızı Protokolü",
    deathStarTag: "Ölüm Yıldızı’nı açar",
    deathStarRole:
      "Bu dünyada bir Ölüm Yıldızı üretmeni sağlar. Darbe evdeki birlikleri ve bina siparişlerini yok eder, depoyla üretim havuzunu yarıya indirir ve dünyayı iki saat devre dışı bırakır. Bu sürede ele geçirme emriyle verilen ikinci darbe yalnız koloni veya tarafsız dünyayı ele geçirir; ana gezegen ele geçirilemez.",
    researchNeedCore: "Komuta Çekirdeğini {{level}}. seviyeye yükselt",
    researchAct: "Araştır",
    researchComplete: "araştırıldı",
    researchAt: "{{duration}} sonra araştırılabilir",
    researchIsotopeFirst: "Önce İzotop Spektrometrisi’ni araştır",
    researchDenseFirst: "Önce Yoğun Yakıt Hücreleri’ni araştır",
    researchGraviticFirst: "Önce Gravitik Yükler’i araştır",
    researchWarAt: "Savaş dönemi {{duration}} sonra başlar",
    researchCargoInsight: "Bir akında ambarını doldur; hedefte ganimet kalsın",
    researchShieldInsight: "Aegis akın hasarının en az {{share}}’ini emsin",
    warshipsBand: "Savaş gemileri",
    warshipsNote:
      "Akın filosunun savaş gücünü oluştururlar. Görevdeyken kendi dünyalarını savunamazlar.",
    supportBand: "Destek",
    supportNote:
      "Dövüşmezler. Ucuz kapasite ile daha kısa açıkta kalma süresi arasında seçim yap.",
    miningBand: "Madenci",
    miningNote:
      "Asteroit ve enkaz sahalarına gider; taşıyabildiği kaynağı üretim havuzuna getirir.",
    ownedGain: "Elinde",
    hullAwayCount: "{{count}} dışarıda",
    hullLocationCounts: "(Evde: {{home}}, Dışarıda: {{away}})",
    prospectorLimit: "{{owned}} / {{max}} · sınır",
  },

  grow: {
    multiplierBand: "Üretim uydusu",
    multiplierNote:
      "Körük, bu dünyanın alaşım, kristal ve Döteryum üretimini %6 artırır ve ortak yörünge ağında bir yuva kaplar.",
  },

  projectSheet: {
    frontier: "Ufuk araştırması",
    complete: "Araştırma tamamlandı",
    cost: "Araştırma maliyeti",
    once: "Komutanın ortak Araştırma sırasına bir kez girer.",
  },

  blocked: {
    core: "Çekirdek {{level}}. seviye",
    uplink: "yörüngede Anten",
    orbitSlot: "boş yörünge yuvası",
    shipyard: "Tersane {{level}}. seviye",
    research: "Gerekli: {{research}} {{level}}",
    plantRung: "Bir kademe daha Döteryum Sentezi araştır",
    maxed: "en üst seviyede",
    queueFull:
      "Sırada zaten 3 sipariş var. Bunu eklemek için biri bitsin veya birini iptal et.",
  },

  done: {
    raised: "{{name}} artık {{level}}. seviyede",
    instrument: "{{name}} {{level}}. seviyede devrede",
    satellite: "{{name}} yörüngeye yerleşti",
    built: "{{count}} {{name}} yapıldı",
    researched: "{{name}} tamamlandı",
    queued: "{{name}} {{level}}. seviye için sıraya alındı",
    queuedSimple: "{{name}} sıraya alındı",
    unitsQueued: "{{count}} {{name}} sıraya alındı",
  },

  buildSheet: {
    eyebrowGround: "Yer savunması · hiç kalkmaz",
    eyebrowMobile: "Hareketli gövde",
    howMany: "Kaç tane",
    fewer: "{{name}} azalt",
    more: "{{name}} artır",
    quantity: "{{name}} adedi",
    max: "{{name}} için en fazla",
    maxShort: "En fazla",
    /* En fazla'dan tek dokunuşla geri dönmenin yolu. */
    reset: "{{name}} sayısını sıfırla",
    resetShort: "Sıfırla",
    build: "{{count}} tane yap",
    capped:
      "Elinde zaten {{count}} tane var, sınır bu. Dışarıdakiler de sayıldığı için bir tane daha yapamazsın.",
    heldOfMax:
      "Elinde {{max}} üzerinden {{owned}} var. Dışarıdakiler de sayılıyor.",
    defenceAfter: "Tamamlanınca evde {{count}} birlik olur",
  },
} as const;

export const itemSheet = {
  eyebrowNotInOrbit: "Yörüngede değil",
  eyebrowInOrbit: "Yörüngede",
  eyebrowNotInstalled: "Kurulu değil",
  eyebrowLevel: "Seviye {{level}}",
  actPutInOrbit: "Yörüngeye çıkar",
  actAlreadyInOrbit: "Zaten yörüngede",
  actInstall: "Kur",
  actRaise: "{{level}}. seviyeye çıkar",
  lockedNote: "Kilitli. Gereken: {{reason}}.",
  ladderHeading: "Hangi seviye ne getiriyor",
  rungLevel: "{{level}}. seviye",
  rungNewHardware: "{{level}}. seviyede yeni donanım",
  orbitalDoesHeading: "Ne işe yarar",
  orbitalCostHeading: "Neye mal olur",
  orbitalOnce: "bir kere; asla yükseltilmez",
  orbitalFree: "{{total}} yuvadan {{free}}’i boş",
  orbitalNoSlot: "Boş yuva yok. Komuta Çekirdeğini yükselt",
} as const;

export const upgradeRow = {
  about: "{{name}} nedir",
  nextTierAlt: "{{name}} bir üst kademede",
  becomes: "olur",
  /** Merdivenin bittiği yer; bir kademe ancak bütünün karşısında değerlendirilir. */
  ceiling: "· tavan {{value}}",
  affordableIn: "Bu hızla <0>{{duration}}</0> sonra alabilirsin",
  /** İşin kendisi ne kadar sürer — cüzdanın değil, nesnenin saati. */
  takes: "{{duration}}",
  takesLabel: "Yapımı {{duration}} sürer",
  ladder: "Seviye {{level}} / {{max}}",
} as const;

export const action = {
  verbRaise: "Yükselt",
  verbBuild: "Yap",
  verbInstall: "Kur",
  verbClaim: "Topla",
  verbSend: "Gönder",
  short: "Eksik",
  shortfallAlloy: "{{amount}} alaşım",
  shortfallCrystal: "{{amount}} kristal",
  shortfallDeuterium: "{{amount}} döteryum",
  shortfallJoin: " ve ",
  shortfallLabel: "Eksik: {{parts}} gerekiyor",
  statAttack: "Saldırı",
  statHull: "Gövde",
  statSpeed: "Hız",
  statSpeedFixed: "sabit",
  statCargo: "Ambar",
  statCargoNone: "—",
  statRoom: "Hangar",
  statFuel: "Yakıt",
  statFuelRate: "{{value}} /1b",
  statFuelNone: "—",
} as const;

export const planetHero = {
  capital: "Ana gezegen",
  colony: "Koloni gezegeni",
  power: "Güç",
  perHour: "Saatte",
  perHourSuffix: "/sa",
  disrupted: "Akın yedin, üretim durdu · {{countdown}}",
  defence: "Savunma",
  defenceNone: "Yok",
  defenceThin: "Zayıf",
  defenceHeld: "Sağlam",
  defenceShipsOnly: "sadece {{count}} gemi",
  defenceOnGround: "yerde {{count}} tane",
  shield: "Kalkan",
  shieldNone: "Yok",
  shieldNoAegis: "aegis yok",
  shieldValue: "{{current}} / {{max}}",
  shieldMeter: "Aegis kalkan doluluğu",
  shieldRegen: "+{{amount}}/sa · birliklerden önce",
  vaultSafe: "Kasada güvende",
  alloySafe: "{{amount}} alaşım güvende",
  crystalSafe: "{{amount}} kristal güvende",
  deuteriumSafe: "{{amount}} döteryum güvende",
  atRisk: "Risk altında",
  atRiskValue: "{{amount}} açıkta",
} as const;

export const launch = {
  fuel: "Yakıt",
  eyebrow: "Saldırı",
  /** Kayda dayanarak yapılan taahhüt. Hedefin ne kadar eski olduğu burada söylenir. D151. */
  eyebrowRecord: "Saldırı · en son {{age}} görüldü",
  /**
   * KORSANIN ESKİYECEK BİR KAYDI YOKTUR — hiç hatırlanmaz, okuma tanımı gereği
   * canlıdır. Satıra asıl yakışan öbür saat: daha ne kadar orada olacağı, yani
   * acele etmenin sebebi.
   */
  eyebrowPirate: "Saldırı · {{duration}} içinde gidiyor",
  back: "Geri",
  launching: "Kalkıyor",
  commit: "Gönder — geri dönüşü yok",
  chooseFleet: "Filonu seç",
  send: "{{count}} gemi gönder",
  launched:
    "Filo kalktı. {{duration}} boyunca açıktasın, evde {{count}} birlik kalıyor.",
  whileAway: "Bu filo dışarıdayken",
  defending: "Evi {{count}} birlik savunuyor",
  nothingSent: "Henüz gemi seçmedin",
  exposedFor: "{{duration}} boyunca açıksın",
  oneWay: "Tek yön",
  oneWayUnknown: "—",
  /* Bu taahhüdün reddedilme sebepleri; her biri butonun üzerinde yazılı. */
  noBay: "Boş uçuş yuvası yok",
  noFuel: "Döteryum yetmiyor",
  tooLate: "Sen varmadan gitmiş olur",
  /** Bu dünyada duran hiçbir gemi ona yetişemez. */
  unreachable: "Buradan hiçbir gemi yetişemez",
  /** Yetişebilecek var — ama bu seçimdeki en yavaş gemi değil. */
  tooSlow: "Yavaş gemileri geride bırak",
  /** Bir dünyaya yapılan akın ateş edebilmeli. Sunucu da bunu reddediyor. */
  noEscort: "Bir savaş gemisi ekle",
  cargo: "Ambar",
  distance: "Mesafe",
  fleetHeading: "Filo",
  atHome: "evde {{count}}",
  away: "Havada {{fleet}} var. Buradan yalnızca bu dünyada duran gemileri gönderebilirsin.",
  awaySeparator: " · ",
  awayHull: "{{count}} {{name}}",
  fewer: "{{name}} azalt",
  more: "{{name}} artır",
  quantity: "{{name}} adedi",
  max: "{{name}} için en fazla",
  maxShort: "En fazla",
  /** Garnizon çubuğu bir resim; ekran okuyucu için kurulan cümle bu. */
  defenceReading:
    "Evde {{holds}} savunma gücü kalır; {{leaves}} kadarı bu filoyla gider",
  hangarLabel: "Hangar",
  hangarNote:
    "Filo göndermek yer açmaz. Havadaki gemiler hâlâ bu dünyaya aittir.",
  noShips:
    "Evde gemi yok. Tersanede yap ya da dışarıdakilerin dönmesini bekle.",
  warning:
    "Bunu geri çağıramazsın. Kalktıktan sonra aşağıda ne olduğunu ancak inişini izleyerek öğrenirsin; o dönene kadar gezegeninde {{count}} birlik kalıyor.",
  fleetsave: "Havadaki gemiler yağmalanamaz. Gezegenin yağmalanabilir.",
} as const;

export const transfer = {
  fuel: "uçuş yakıtı",
  fuelShort: "{{short}} eksik",
  eyebrow: "Dünyalar arası transfer",
  eta: "Varış",
  capacity: "Yük",
  fleet: "Gemiler",
  homeDefence: "Çıkış dünyasında {{ships}} gemi kalır · {{power}} savunma gücü",
  cargo: "Kaynaklar",
  alloy: "Alaşım",
  crystal: "Kristal",
  deuterium: "Döteryum",
  commit: "Transfer et — geri çağrılamaz",
  sending: "Yola çıkıyor",
  launched: "Transfer yola çıktı · {{duration}}",
  irreversible:
    "Tek yönlüdür. Yer savunması taşınamaz; yük kapasitesini yalnız Kurye, Seyyah ve Atlas sağlar.",
  hullNone: "Bu dünyada yok",
  holdReady: "Madeni Kurye, Seyyah ve Atlas taşır. Ambar: {{capacity}}.",
  holdNeedsLoad: "Maden taşımak için yukarıdan Kurye, Seyyah veya Atlas ekle.",
  holdNoCarrier:
    "Bu dünyada kaynak taşıyabilecek Kurye, Seyyah veya Atlas yok.",
  /** Hedefin yer çubuğunun altyazısı; sayıları çubuğun kendisi çiziyor. */
  destinationLabel: "Hedef hangarı",
  /** Gemi sayısını gösteren işaretlerin ekran okuyucu karşılığı. */
  hullPacked: "{{held}} {{name}} içinden {{packed}} tanesi yüklendi",
  /** Yük sürgüsünün altındaki çubuğun altyazısı: bu transferle giden. */
  cargoSending: "Gönderiyorsun",
  destinationProspectorFull: "Hedef dünya yeni bir Kazıcı kabul edemiyor.",
} as const;

export const capacity = {
  fit: "daha sığar",
  full: "DOLU",
  /* The two ends of a room card's bar, each under the part it describes. */
  used: "dolu",
  free: "boş",
  reading: "{{total}} kapasitenin {{used}} kadarı dolu",
} as const;
