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
  empActive: "EMP · Aegis sıfırda ve {{duration}} boyunca yenilenemez; yer savunmaları ateş etmez ve hasar almaz.",
  capacityNext: "{{name}} ile dünya başına {{total}}",
  interceptor: {
    eyebrow: "Stratejik savunma bataryası",
    tally: "{{total}} şarjın {{used}} tanesi yüklü",
    none: "Yüklü mühimmat yok",
    building: "Yükleniyor · {{duration}}",
    paused: "Toparlanma sırasında yükleme durdu",
    ready: "Yüklü şarj: {{count}}",
    noRadar: "Yüklü · Radar çemberi devre dışı",
    build: "Mühimmat yükle",
    started: "Mühimmat yükleniyor",
    hint: "Zamanlı Radar çemberine giren veya dünyalarından birinin Teleskop görüşünde tanımladığı ilk Ölüm Yıldızı’nı imha eder. Ateşlendiğinde tükenir.",
    colonyHint: "Geçen her Ölüm Yıldızı bu koloniden {{loss}} sadakat götürür; {{loss}} veya altındaysa koloni kopar.",
    readyHint:
      "Hazır. Radar önleme çemberine giren veya Teleskop görüşünde tanımlanan ilk Ölüm Yıldızı’nı imha eder.",
    noRadarHint:
      "Mühimmat yüklü kalır ancak bu dünyanın Radar önleme çemberi yoktur. Anten’i ve Radar 3’ü yeniden etkinleştir; başka bir dünyandaki Teleskop görüşü yine ateşlemeyi başlatabilir.",
    needRadar: "Radar {{level}}. seviye",
    needUplink: "Yörüngede Anten",
    needOperational: "Dünya çalışır durumda",
    buildTime: "{{duration}} · tek mühimmat · ateşlenince biter",
    buildSecond: 'İkinci şarjı sıraya koy',
  },

  deathStar: {
    eyebrow: "Taktiksel EMP silahı",
    tally: "{{total}} silahtan {{used}} tanesi hazır veya üretimde",
    none: "Bu dünyada Ölüm Yıldızı yok",
    building: "Üretiliyor · {{duration}}",
    paused: "Toparlanma sırasında üretim duraklatıldı",
    ready: "Fırlatmaya hazır",
    stock: "{{ready}} hazır · {{building}} üretimde · {{held}}/{{capacity}}",
    build: "Üret",
    started: "Ölüm Yıldızı üretimi başladı",
    dangerHint: "EMP: Aegis canını sıfırlar ve 1 saat yenilenmesini durdurur. Yer savunmaları bu sürede ateş etmez ve hasar almaz. Koloni ayrıca {{loss}} sadakat kaybeder; {{loss}} veya altındaysa kopar ve tarafsız olur.",
    readyHint:
      "Hazır: hedefte Aegis canı sıfırlanır ve 1 saat yenilenmez; yer savunmaları ateş etmez ve hasar almaz.",
    needCore: "Çekirdek {{level}}. seviye",
    needShipyard: "Tersane {{level}}. seviye",
    needOperational: "Dünya çalışır durumda",
    buildTime: "{{duration}} · tek silah · geri çağrılamaz",

    needs: 'Gerekli: {{need}}',
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
      "Gemilerini ve menzilini burada geliştirirsin.",
    growProblem: "Üretim",
    growQuestion: "Kaynaklarını ve bina seviye sınırını burada büyütürsün.",
    tacticalProblem: "Taktiksel",
    tacticalQuestion: "Taktiksel araçlarını burada üretir ve yönetirsin.",
  },


  queue: {
    waiting: "Sırada",
    ends: "{{time}}’de biter",
    segment: "{{name}} · {{duration}}",
    cancelOne: "{{name}} siparişini iptal et",
    title: "Üretim sıraları",
    idle: "Üretim yok",
    capacity: "her birinde {{count}} yer",
    construction: "İnşaat",
    yard: "Tersane",
    repair: "Tamirhane",
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

    /**
     * İPTALİN İKİNCİ VURUŞU. Sahip raporu.
     *
     * İptalin bedeli bir `title` niteliğindeydi — telefonda var olmayan bir üstüne
     * gelme ipucu — yani yanan yarı yalnızca onaysız değildi, hiç ekrana çıkmıyordu.
     * Önce YOK OLANI söyler: tek başına iade rakamı kazanç gibi okunur, çünkü
     * oyuncunun eline kaynak veriliyor.
     */
    confirm: {
      eyebrow: "Siparişi iptal et",
      lead: "Bu siparişin bedelinin %{{share}}'i yok olur. Kalanı hemen geri gelir.",
      lost: "Yok olan",
      kept: "Geri gelen",
      progress: "Üzerinde yapılan iş de gider — yeniden sipariş sıfırdan başlar.",
      commit: "Siparişi iptal et",
      back: "Vazgeç",
    },
  },

  capacity: {
    hangarBand: "Filo alanı",
    hangarFull: "Hangar dolu: {{total}} alanın {{used}} kadarı bağlı. Daha fazla gemi için Hangarı yükselt.",
    hullUse:
      "Her biri {{bulk}} yer kullanır · sıra bitince {{used}} / {{total}} bağlı.",
    full: "Yer yok: {{total}} alanın {{used}} kadarı bağlı. Önce ilgili kapasiteyi yükselt.",
  },

  roles: {
    vault:
      "Her kaynağın kaç saatlik üretimini tutabildiğini belirler; en alttaki %10'luk dilim, en fazla 8 saatlik üretim olmak üzere, akınlara karşı korumalıdır.",
    shipyard:
      "Yeni gemi sınıflarını açar; gemi ve yer savunması üretimini hızlandırır, sondalarının başarı ihtimalini artırır.",
    refinery:
      "Saatlik alaşım üretimini artırır; depo saat cinsinden olduğu için tuttuğu alaşım da onunla büyür. Binaların ve gemilerin çoğu bu kaynağı kullanır.",
    extractor:
      "Saatlik kristal üretimini artırır; depo saat cinsinden olduğu için tuttuğu kristal da onunla büyür. Gelişmiş gemiler, cihazlar ve araştırmalar kristal kullanır.",
    coreCapped_one:
      "{{count}} bina mevcut Çekirdek sınırına ulaştı; Çekirdeği yükseltmeden ilerleyemez.",
    coreCapped_other:
      "{{count}} bina mevcut Çekirdek sınırına ulaştı; Çekirdeği yükseltmeden ilerleyemez.",
    coreClear:
      "Hiçbir bina Çekirdek seviyesini geçemez. Bina sınırlarını ve inşaat hızını Çekirdek belirler.",
  },

  defend: {
    escapeMinimum: "Taktik geri çekilme için burada en az {{minimum}} savaş gemisi gerekli · {{count}} / {{minimum}} hazır",
    strategicBand: "Stratejik savunma",
    strategicNote:
      "Yüklü mühimmat, 3. seviye Radarın algıladığı veya Teleskop görüşünde tanımlanan ilk Ölüm Yıldızı’nı imha eder; ateşlenince tükenir.",
    /** Taktik geri çekilme: savunanın kendi eşiği ve kalkışın yakıtı. */
    escapeReady:
      "Taktik geri çekilme · {{at}}+ ateş gücünde ve bu hattı silecek bir akın gemilerini bulamaz · kalkış {{fuel}} Döteryum yakar",
    escapeShort:
      "Taktik geri çekilme · gemilerin {{at}}+ ateş gücündeki bir akından kaçardı ama kalkış {{fuel}} Döteryum ister, depoda {{stock}} var",
    shieldBand: "Kalkan",
    shieldNote:
      "Aegis hasarı birliklerine ulaşmadan önce karşılar. Seviyeler azami kalkanı artırır; yenilenme hızı azami değerin saatte %35’idir.",
    groundBand: "Yerdekiler (kapasite komuta çekirdeği ile artar)",
    groundNote:
      "Gezegenden ayrılmazlar. Kirpi Sur’a, Zıpkın Akıncıya, Tabya ise Mızrak sınıfına karşı üstünlük kazanır.",
    thornNone:
      "Hafif yer savunmasıdır. Sur sınıfına karşı güçlü, Mızrak sınıfına karşı zayıftır.",
    thornStanding:
      "Yerde {{count}} tane var. Sur sınıfına güçlü, Mızrak sınıfına zayıf.",
    thornGain: "Kirpi",
    harpoonNone: "Mızrak sınıfı yer savunmasıdır. Akıncı sınıfına karşı güçlü, Sur sınıfına karşı zayıftır.",
    harpoonStanding: "Yerde {{count}} tane var. Akıncı sınıfına güçlü, Sur sınıfına zayıf.",
    harpoonGain: "Zıpkın",
    bastionNone:
      "Ağır yer savunmasıdır. Mızrak sınıfına karşı güçlü, Akıncı sınıfına karşı zayıftır.",
    bastionStanding:
      "Yerde {{count}} tane var. Mızrak sınıfına güçlü, Akıncı sınıfına zayıf. Yok edilen yer toplarının %60’ı aşağı yuvarlanarak enkazdan yeniden kurulur.",
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
    slotsNext: "Çekirdek {{level}}. seviyede +1",
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
    bulwarkDoctrineName: "Sur Doktrini",
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
    cargoTag: "Her ambar daha çok taşır",
    cargoRole:
      "Akın ganimetini, dünyalar arası transferi ve ticaret konvoyunu birlikte artırır.",
    synthesisName: "Döteryum Sentezi",
    synthesisTag: "Rafineri seviye sınırını yükseltir",
    synthesisRole:
      "Her kademe, sahip olduğun bütün dünyalarda üç yeni Döteryum Rafinerisi seviyesi açar.",
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
    hullLocationCounts: "{{home}} ev · {{away}} dış",
    hullTier: "Lv{{tier}}",
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
    research: "{{research}} {{level}}. seviye",
    requirements: "Önce şunlar gerekli: {{requirements}}",
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
    maxOf: 'Maks · {{value}}',
    byPurse: 'kaynağın bu kadarına yetiyor',
    byHangar: 'Hangarda bu kadar yer var',
    byGround: 'yerde bu kadar yer var',
    byBerth: 'yuva sınırın bu kadar',
    cycle: 'Sınıf döngüsü',
    yardFill: 'Tersane sırası {{used}}/{{total}}',
    standing: '{{value}} kurulu',
  },
} as const;

export const itemSheet = {
  coreTierGuide: "Çekirdek seviyeleri ve gezegen kademeleri",
  coreTierCurrent: "Çekirdek Sv.{{level}} → Kademe {{tier}}",
  coreTierRule: "Gezegen kademesi her üç çekirdek seviyesinde bir artar. Vurgulanan satır mevcut kademeni gösterir.",
  coreTierLevel: "Çekirdek seviyesi",
  coreTierPlanet: "Gezegen kademesi",
  coreTierRange: "Sv.{{from}}–Sv.{{to}}",
  eyebrowNotInOrbit: "Yörüngede değil",
  eyebrowInOrbit: "Yörüngede",
  eyebrowNotInstalled: "Kurulu değil",
  eyebrowLevel: "Seviye {{level}}",
  actPutInOrbit: "Yörüngeye çıkar",
  actAlreadyInOrbit: "Zaten yörüngede",
  actInstall: "Kur",
  actRaise: "{{level}}. seviyeye çıkar",
  lockedNote: "Kilitli. Gereken: {{reason}}.",
  howItWorks: "Nasıl çalışır",
  ladderHeading: "Hangi seviye ne getiriyor",
  rungLevel: "Sv.{{level}}",
  nextLook: "Yeni görünüm · Sv.{{level}}",
  queueFill: "İnşaat sırası {{used}}/{{total}}",
  affordIn: "~{{duration}} sonra yeter",
  short: "Kaynak yetmiyor",
  orbitalDoesHeading: "Ne işe yarar",
  orbitalOnce: "Bir kez alınır; yükseltilmez",
  orbitalFree: "Boş yuva: {{free}}/{{total}}",
  slotHeading: "Yörünge yuvası",
  slotAfter_one: "Kesikli yuvaya yerleşir; sonra {{count}} boş yuva kalır.",
  slotAfter_other: "Kesikli yuvaya yerleşir; sonra {{count}} boş yuva kalır.",
  nextSlotCore: "Komuta Çekirdeği {{level}} bir yuva daha açar.",
  orbitalNoSlot: "Boş yuva yok. Komuta Çekirdeği {{level}} bir sonrakini açar",
  orbitalNoSlotMax: "Boş yuva yok. Komuta Çekirdeğinin açtığı her yuva dolu",
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
  statHull: "Defans",
  statSpeed: "Hız",
  statSpeedFixed: "sabit",
  statCargo: "Ambar",
  statCargoNone: "—",
  statSalvage: "Hurda",
  statRoom: "Hacim",
  statFuel: "Yakıt",
  statFuelRate: "{{value}} /1b",
  statFuelNone: "—",
} as const;

export const planetHero = {
  capital: "Ana gezegen",
  colony: "Koloni gezegeni",
  /**
   * DÜNYANIN KENDİ KADEMESİ, PORTRESİNİN ALTINDA. Sahip raporu.
   *
   * Kademe, bütün galaksinin sıralandığı sayı — disk dünyanın boyunu ondan
   * çizer, her dosya onu yazar ve D168'den beri kimin kiminle dövüşebileceğini
   * o belirler. Oyuncunun KENDİ dünyaları dışında her yerde görünüyordu.
   */
  tier: "{{tier}}. kademe",
  firepower: "Ateş gücü",
  perHourSuffix: "/sa",
  /** E5: the orbit line under the world — "Orbit 1/2 · +1 at Core L15". */
  orbit: "Yörünge",
  disrupted: "Akın yedin, üretim durdu · {{countdown}}",
  defence: "Savunma",
  defenceNone: "Yok",
  defenceShips_one: "{{count}} gemi",
  defenceShips_other: "{{count}} gemi",
  defenceGuns_one: "{{count}} top",
  defenceGuns_other: "{{count}} top",
  defenceUnarmed_one: "hatta {{count}} yük gemisi",
  defenceUnarmed_other: "hatta {{count}} yük gemisi",
  defenceDocked_one: "{{count}} gemi Tamirhanede · savunmaz",
  defenceDocked_other: "{{count}} gemi Tamirhanede · savunmaz",
  fleetAway: "Havada {{count}} tane",
  shield: "Kalkan",
  shieldNone: "Yok",
  shieldNoAegis: "aegis yok",
  shieldOffline: "Devre dışı",
  shieldCoreOffline: "Komuta merkezi arızalı · Aegis sönük",
  defenceCoreOffline: "Yer topları devre dışı · komuta merkezi arızalı",
  shieldValue: "{{current}} / {{max}}",
  shieldMeter: "Aegis kalkan doluluğu",
  shieldRegen: "+{{amount}}/sa · birliklerden önce",
  vaultSafe: "Kasada güvende",
  storeLabel: "Depo",
  storeRule: "Depo seviyesi bu çubukların uzunluğunu belirler; kalkanlı kutu akına karşı korumalı dilimdir.",
  alloyStore: "{{held}} / {{cap}} alaşım, {{safe}} kadarı korumalı",
  crystalStore: "{{held}} / {{cap}} kristal, {{safe}} kadarı korumalı",
  deuteriumStore: "{{held}} / {{cap}} döteryum, {{safe}} kadarı korumalı",
  alloySafe: "{{amount}} alaşım güvende",
  crystalSafe: "{{amount}} kristal güvende",
  deuteriumSafe: "{{amount}} döteryum güvende",
  atRisk: "Risk altında",
  atRiskValue: "{{amount}} açıkta",
  /** E5 production row: how full the store is, and the part the Vault keeps from a raid. */
  storeShare: "depo %{{pct}}",
  safeShare: "güvenli %{{pct}}",
  storeFull: "depo dolu",
} as const;

export const launch = {
  /** When the world is covered again, under the exposure: the mock's "Dönüş 23:06". */
  fuel: "Yakıt",
  eyebrow: "Saldırı",
  /** Kayda dayanarak yapılan taahhüt. Hedefin ne kadar eski olduğu burada söylenir. D151. */
  lastSeen: "en son {{age}} görüldü",
  /**
   * Teleskop keşfi hatırlansa da korsanın filosu ve yörüngesi günceldir.
   * Acil olan, hedefin ne kadar süre daha orada kalacağıdır.
   */
  goneIn: "{{duration}} içinde gidiyor",
  back: "Geri",
  launching: "Kalkıyor",
  commit: "Gönder — geri dönüşü yok",
  /** A raid on a world, which may be turned once while it flies (K8); a pirate raid keeps `commit`. */
  commitWorld: "Gönder",
  /** B14: the held commit, and the price line under the ships (K8: a world raid turns). */
  holdWorld_one: "{{count}} gemi gönder",
  holdWorld_other: "{{count}} gemi gönder",
  holdPirate_one: "{{count}} gemi gönder — geri dönüşü yok",
  holdPirate_other: "{{count}} gemi gönder — geri dönüşü yok",
  warningWorld: "{{world}} {{duration}} zayıf kalır — filo dönene kadar.",
  warningPirate: "Geri çağrılamaz. {{world}} {{duration}} zayıf kalır — filo dönene kadar.",
  recallNote:
    "Yoldayken bir kez geri çağrılabilir — uçtuğu süre kadar sürede döner. Yakıt iade edilmez.",
  chooseFleet: "Filonu seç",
  send: "{{count}} gemi gönder",
  launched:
    "Filo kalktı. {{duration}} boyunca açıktasın, evde {{count}} birlik kalıyor.",
  whileAway: "Bu filo dışarıdayken",
  defending: "Evi {{count}} birlik savunuyor",
  nothingSent: "Henüz gemi seçmedin",
  exposedFor: "{{duration}} boyunca açıksın",
  oneWayUnknown: "—",
  pace: "Uçuş hızı",
  paceHint: "Yavaş olan geç varır ve aynı hızla döner. Yakıt aynı; hiçbir bacak 12 saati geçemez.",
  paceFull: "Tam",
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
  shipyardRevolt: "İsyan var",
  cargo: "Kargo",
  salvage: "Hurdacıların sağ kalırsa enkazdan en fazla {{amount}} toplar",
  atHome: "evde {{count}}",
  away: "Havada {{fleet}} var. Buradan yalnızca bu dünyada duran gemileri gönderebilirsin.",
  awaySeparator: " · ",
  awayHull: "{{count}} {{name}}",
  fewer: "{{name}} azalt",
  more: "{{name}} artır",
  quantity: "{{name}} adedi",
  max: "{{name}} için en fazla",
  maxShort: "Maks",
  noShips:
    "Evde gemi yok. Tersanede yap ya da dışarıdakilerin dönmesini bekle.",
  warning:
    "Bunu geri çağıramazsın. Kalktıktan sonra aşağıda ne olduğunu ancak inişini izleyerek öğrenirsin; o dönene kadar gezegeninde {{count}} birlik kalıyor.",
  shieldWarning:
    "Bu akın başlangıç kalkanını bitirir. Kalkan kalktığında diğer komutanlar da sana akın edebilir.",
  recoveryShieldWarning:
    "Bu akın toparlanma kalkanını ve +%50 üretimi bitirir. Kalkan kalktığında diğer komutanlar da sana akın edebilir.",
  radiationLethal_one: "Bu rotadaki radyasyon {{count}} gemiyi varmadan yok eder. Basılı tutarsan yine de gönderilir.",
  radiationLethal_other: "Bu rotadaki radyasyon {{count}} gemiyi varmadan yok eder. Basılı tutarsan yine de gönderilir.",
  radiationHpOutbound: "Gidiş radyasyonu: gemi başına {{hp}} HP.",
  radiationHpReturn: "Dönen gemiler ayrıca {{hp}} HP hasar alır.",
  radiationHpHome: "Eve döner.",
  radiationHpStays: "Hedefte kalır.",
  radiationHpDose: "Uçuş radyasyonu: gemi başına {{hp}} HP.",
  radiationHpHealth: "{{count}}× {{hull}} · %{{health}} HP · {{hp}} / {{max}} HP",
  radiationHpDock: "İnişte Repair Station gerekir.",
  radiationHpFree: "İnişte ücretsiz onarılır.",
  radiationHpCombat: "Savaş ek hasar verebilir.",
  radiationDock: "Rota radyasyondan geçiyor: her gemi gövdesinin ~%{{pct}} kadarını kaybeder. %20'yi aşan Tamirhanede bekler.",
  radiationPatched: "Rota radyasyondan geçiyor: her gemi gövdesinin ~%{{pct}} kadarını kaybeder, inişte ücretsiz onarılır.",
  fleetsave: "Havadaki gemiler yağmalanamaz. Gezegenin yağmalanabilir.",
  range: "mesafe {{d}}",
  arrive: "Varış",
  homeLabel: "Dönüş",
  exposedShort: "açıkta {{duration}}",
  lootSub: "ganimet ~{{band}}",
  bay: "Uçuş yuvası",
  bayThis: "bu sefer 1",
  bayNone: "boş yok",
  stays: "Evde kalan",
  staysUnits_one: "{{count}} birim",
  staysUnits_other: "{{count}} birim",
  staysPower: "güç {{value}}",
  cargoEach: "{{amount}} kargo/gemi",
  cargoAdds: "+{{amount}} kargo",
  paceBrief: "yakıt aynı · en çok 12 sa",
  warningWorldOpen: "{{world}} filo dönene kadar zayıf kalır.",
  warningPirateOpen: "Geri çağrılamaz. {{world}} filo dönene kadar zayıf kalır.",
} as const;

export const transfer = {
  fuel: "uçuş yakıtı",
  cooldown: "Boşaltılıyor — {{duration}} kaldı",
  homewardFuel: "Yarı fiyat — kendi dünyaların arasında. Saldırı tam öder.",
  /** Under the pace rungs: what a slower TRANSFER buys — time in the air. */
  paceHint: "Yavaş olan geç varır — havadaki gemi yağmalanamaz. Geri dönen grup da aynı hızla döner. Yakıt aynı; hiçbir bacak 12 saati geçemez.",
  fuelShort: "{{short}} eksik",
  eyebrow: "Dünyalar arası transfer",
  returnEta: "Çıkışa dönüş {{duration}} sonra · {{time}}",
  eta: "Varış",
  capacity: "Yük",
  fleet: "Gemiler",
  homeDefence: "Çıkış dünyasında {{ships}} gemi kalır · {{power}} ateş gücü",
  afterDelivery: "Teslimattan sonra",
  cargoShips: "Yük gemileri",
  otherShips: "Diğer gemiler",
  stay: "Gittiği yerde kalsın",
  return: "Geri dönsün",
  returnHint: "Geri dönecek gemiler önce kaynağı bırakır. Dönüş yakıtı şimdi ödenir.",
  cargo: "Kaynaklar",
  alloy: "Alaşım",
  crystal: "Kristal",
  deuterium: "Döteryum",
  commit: "Transfer et",
  /** B14: what stops a transfer, on the held commit rather than a grey button. */
  noRoom: "Varış Hangarında yer yok",
  overLoad: "Ambarın taşıyabileceğinden fazla",
  sending: "Yola çıkıyor",
  launched: "Transfer yola çıktı · {{duration}}",
  /** The recall rule and the two limits on what moves. Faz 2A.4 made "one way" false. */
  rules: "Yoldayken bir kez geri çağrılabilir; uçtuğu süre kadar sürede döner. Yer savunması taşınamaz; ambarı olan tüm gemiler kaynak taşıyabilir.",
  hullNone: "Bu dünyada yok",
  holdReady: "Seçilen gemiler kaynak taşır. Ambar: {{capacity}}.",
  destinationLabel: "Hedef Hangarı",
  holdNeedsLoad: "Kaynak taşımak için yukarıdan ambarı olan bir gemi seç.",
  holdNoCarrier: "Bu dünyada ambarı olan gemi yok.",
  /** Hedefin yer çubuğunun altyazısı; sayıları çubuğun kendisi çiziyor. */
  /** Gemi sayısını gösteren işaretlerin ekran okuyucu karşılığı. */
  hullPacked: "{{held}} {{name}} içinden {{packed}} tanesi yüklendi",
  /** Yük sürgüsünün altındaki çubuğun altyazısı: bu transferle giden. */
  cargoSending: "Gönderiyorsun",
} as const;

export const capacity = {
  fit: "daha sığar",
  full: "DOLU",
  /* The two ends of a room card's bar, each under the part it describes. */
  used: "dolu",
  free: "boş",
  reading: "{{total}} kapasitenin {{used}} kadarı dolu",
} as const;

/**
 * KOLONİ ARIZALARI. Ses tonu: olan biteni söyler, alarm vermez.
 *
 * Her cümle DURMUŞ bir şeyi adlandırıyor ve neyi durdurduğunu söylüyor; hiçbiri
 * "uyarı" ya da "kritik" demiyor. Üç dünya tutmanın sıradan bir parçası bu; bağıran
 * bir metin ya oyuncuya görmezden gelmeyi öğretirdi ya da dört küçük arızayı felaket
 * gibi gösterirdi.
 */
export const faults = {
  title: "Arızalar",
  mark: "Arıza var",
  launchBlock: {
    SHIPYARD_REVOLT: "Tersanede isyan var",
    PROSPECTOR_FAULT: "Kazıcı merkezi arızalı",
  },
  strip: {
    title: "Onarım",
    capacity: "{{count}} ekip",
    priceAlloy: "{{alloy}} alaşım",
    priceBoth: "{{alloy}} alaşım · {{crystal}} kristal",
    lane: "{{slot}}. ekip",
  },
  tab: "Burada bir şey bozuk",
  name: {
    REFINERY_OUTAGE: "Alaşım rafinerisinde elektrik kesintisi",
    EXTRACTOR_OUTAGE: "Kristal çıkarıcıda elektrik kesintisi",
    PLANT_OUTAGE: "Döteryum rafinerisinde elektrik kesintisi",
    VAULT_LEAK: "Kasada sızıntı",
    CORE_OUTAGE: "Komuta merkezinde elektrik kesintisi",
    TELESCOPE_FAULT: "Teleskop arızası",
    SHIPYARD_REVOLT: "Tersanede isyan",
    PROSPECTOR_FAULT: "Kazıcı merkezinde arıza",
  },
  stopped: {
    REFINERY_OUTAGE: "Rafineri karanlıkta. Bu dünya hiç alaşım üretmiyor.",
    EXTRACTOR_OUTAGE: "Çıkarıcı karanlıkta. Bu dünya hiç kristal üretmiyor.",
    PLANT_OUTAGE: "Rafineri karanlıkta. Bu dünya hiç döteryum üretmiyor.",
    VAULT_LEAK: "Kasa orbite akıyor — ve teleskobu buraya yetişen herkes o tarlayı görüp toplamaya gelebilir.",
    CORE_OUTAGE: "Merkez karanlıkta: aegis sönük, yer toplarının atış kontrolü yok. Evdeki gemiler yine savaşıyor. Şimdi biri inerse açık bir dünyaya iner.",
    TELESCOPE_FAULT: "Teleskop kör. Onarılana kadar bu dünya çıplak gözden öteye görmüyor.",
    SHIPYARD_REVOLT: "Tersane işi bıraktı. Bu dünyadan hiçbir şey kalkmıyor — ne akın, ne transfer, ne konvoy. Havadakiler yine eve dönüyor.",
    PROSPECTOR_FAULT: "Kazıcı merkezi kapalı. Bu dünyadan Prospector çıkamaz. Dışarıdakiler yine geri çağrılabilir.",
  },
  toll: {
    title: "Sana neye mal oluyor",
    alloy: "Saatte {{amount}} alaşım, üretilmiyor",
    crystal: "Saatte {{amount}} kristal, üretilmiyor",
    deuterium: "Bu dünyanın üreteceği her saatlik döteryum",
    leak: "Saatte {{amount}} orbite akıyor; burayı görebilen herkes uçup alabilir",
  },
  loyalty: {
    title: "Bu dünyanın sadakati",
    battleLoss: "Hafif yenilgi −15 · ağır yenilgi −30 · Ölüm Yıldızı −{{strike}}",
    line: "%{{value}} — {{count}} şey bozukken düşüyor. Bu hızla {{time}} içinde sıfıra iner ve koloni bağımsızlığını ilan eder.",
    bar: "Sadakat %{{value}}",
    left: "{{time}} kaldı",
  },
  price: {
    title: "Onarım",
    crew: "ekip",
    parts: "parça",
    takes: "5–15 dakika sürer. Ekip kendi saatini tutulduğu anda söyler.",
  },
  repair: "Ekip gönder",
  running: "Bir ekip başında · {{time}}",
  noCancel: "Tamir başladıktan sonra iptal edilemez.",
  lanesFull: "{{count}} ekibin hepsi dışarıda",
  started: "Ekip yolda.",
  failed: "Başlatılamadı.",
} as const;
