/**
 * BİLDİKLERİN — istihbarat merkezi, savaş raporları, netlik okuması ve odak
 * şeridinin kurulduğu dosya satırları.
 *
 * Bu ekranın tek bir işi var: oyuncuya NE BİLMEDİĞİNİ hissettirmek. O yüzden
 * buradaki boş durum metinleri özür değil, davet. Her biri eksik olan cihazın
 * adını verir ve o cihazın ne söyleyeceğini anlatır.
 */

export const intel = {
  openOrbit: 'Yörüngeyi aç',
  tabs: {
    label: 'İstihbarat raporları',
  },
  coverage: {
    label: 'Kapsama',
    blind: 'Tek bir gezegenin bile içini göremiyorsun',
    partial_one: '{{count}} yuvandan {{seen}} tanesi bir yere bakıyor',
    partial_other: '{{count}} yuvandan {{seen}} tanesi bir yere bakıyor',
    full: 'Bütün yuvaların birini izliyor',
    blindHint: 'Bunu bitirmenin en ucuz yolu bir Teleskop.',
    idleHint_one: '{{count}} yuvan boşta duruyor. Galaksiden bir gezegen seç, oraya çevir.',
    idleHint_other: '{{count}} yuvan boşta duruyor. Galaksiden bir gezegen seç, birini oraya çevir.',
    scarcity_one:
      'Dışarıda {{neighbours}} gezegen var, elinde {{count}} göz. Bir yuvayı kaydırmak bekleme süresine mal oluyor; kimi izleyeceğine iyi karar ver.',
    scarcity_other:
      'Dışarıda {{neighbours}} gezegen var, elinde {{count}} göz. Bir yuvayı kaydırmak bekleme süresine mal oluyor; kimi izleyeceğine iyi karar ver.',
    oneMore: '{{level}}. seviye Teleskop bir gezegen daha izleyebilir.',
    noRadar: 'Radarın da yok; sana yönelen tehdidi diğer hareketlerden ayıramazsın.',
  },

  watching: {
    heading: 'İzlediklerin',
    slotsUsed: '{{total}} yuvadan {{used}} tanesi dolu',
    slotLabel: 'Yuva {{slot}}',
    slotEmpty: 'Boşta',
    missingNoSlot: 'Hiçbir yuva bir yere bakmıyor',
    missingNoTelescope: 'Teleskopun yok',
    gives: 'Bir gezegenin filosu havalandığında haber verir. Böylece akın öncesinde savunmanın evde olup olmadığını bilirsin.',
    costPoint: 'Galaksiden bir gezegen seç, bir yuvayı ona çevir.',
    costInstall: 'Gezegen ekranından bir tane kur.',
    away: 'Filo dönene kadar gezegeni yalnız evde kalan birlikler savunuyor.',
    intermittent:
      'Kesikli okuma en iyi ihtimalle yirmi dakikada bir yenilenir. Yeni okuma dönemi başlayana kadar tekrar bakmak sonucu değiştirmez.',
  },

  probes: {
    heading: 'Sonda raporları',
    newest: 'en yeni önce',
    missing: 'Henüz geri dönen bir sonda olmadı',
    gives: 'Kaynaklarını ve birliklerini tahmin aralıklarıyla gösterir. Savaş sonucunu garanti etmez.',
    /** Rakamlar `PROBE` sabitinden gelir; artık elle yazılmaz. D59. */
    cost: 'Hızlı ve ucuz: {{alloy}} alaşım, {{crystal}} kristal. Elindeki hiçbir savaş gemisi ona yetişemez; ama radarları onu yakalayabilir.',
    stock: 'Stok',
    defence: 'Silahlı birlik değeri',
    ships: 'Gemi',
    /** `{{percent}}` buraya yerel yüzde biçiminde geliyor; işaret `format.percent`'te. */
    accuracyHome: '{{percent}} doğruluk · filo evdeydi',
    accuracyOut: '{{percent}} doğruluk · filo dışarıdaydı',
    estimateNote: 'Sayılar tahmin aralığıdır. Silahlı birlik değeri, kalkanı ve silahsız gemileri içermez.',
    caught: 'sondayı yakaladılar',
    /* Sinyal çubuklarının yanındaki iki kelime; isabeti çubuklar taşıyor. */
    homeTag: 'filo evdeydi',
    outTag: 'filo dışarıdaydı',
  },

  radar: {
    heading: 'Sana kim bakıyor',
    level: 'Radar · {{level}}. seviye',
    missing: 'Radarın yok',
    gives:
      'Hareket eden araçları görebildiğin çemberi çizer, sana gelen sondaları yakalar ve dünyana yönelen tehdidi varış süresiyle birlikte işaretler.',
    cost: 'Radar olmadan bu dünyaya gönderilen sondaların çoğu fark edilmeden geçer.',
    quiet: 'Seni kimse taramadı. {{level}}. seviye Radar dinlemede.',
    scan: 'Tarama yakalandı',
    bearing: ' · galaktik {{bearing}} yönünden',
    origin: ' · {{planet}}',
    /** Taramanın hangi dünyaya geldiği. */
    onWorld: ' · {{planet}}',
    /* Captions beside the two drawn rings; the picture carries the rest. */
    ringSense: 'Hareket algılandı',
    ringWarn: 'Zamanlı uyarı',
    /** İki çember tek olduğu sürece tek başlık, çemberin ne yaptığını söyler. */
    ringOne: 'Tespit ve zamanlı uyarı',
    /** Halkaları göremeyen için aynı okuma; iki çember bu bilgiyi zaten taşıyor. */
    noteFleets:
      '{{level}}. seviye Radar, {{sense}} birimde sana yönelen tehdidi ayırt eder ancak varış süresini {{warn}} birime girdiğinde gösterir.',
    /** Birleşik hâli: tek çember, iki ürün, tek cümle. */
    noteFleetsOne:
      '{{level}}. seviye Radar, {{sense}} birime kadar hareket eden araçları gösterir ve dünyana yönelen tehdidi varış süresiyle işaretler.',
    /** Hiçbir resmin çizemediği yarısı: çemberler sabit, içinde kalma süresi değil. */
    noteSlow: 'Ağır ve yavaş bir filo Radar menzilinde daha uzun kalır.',
    noteProbesLegacy: '{{level}}. seviye Radar sondaları yakalar ve çemberine giren filoları haber verir.',
    noteBearing: ' 2. seviyeden itibaren geliş yönünü de söyler.',
    noteOrigin: ' 5. seviye çıkış dünyasının adını verir.',
  },
} as const;

export const reports = {
  heading: 'Savaş raporları',
  newest: 'en yeni önce',
  empty:
    'Galakside henüz çatışma kaydı yok. Savaş raporu, karşı tarafın gerçek kuvvetini ve çatışma sonucunu doğrudan gösterir.',
  youRaided: 'Akın ettiğin: ',
  raidedBy: 'Sana akın eden: ',
  rounds: '{{count}} tur',
  sheetYouRaided: 'Hedef: {{opponent}} · {{planet}}',
  sheetYouRaidedPirate: 'Hedef: {{opponent}}',
  sheetTheyRaided: 'Saldıran: {{opponent}}',
  heldAgainstYou: '{{planet}} savunmayı sürdürdü. Bu saldırıdan ganimet alamadın.',
  brokenByYou: '{{planet}} üzerindeki savunmaya zarar verdin.',
  /**
   * KORSAN HÜKMÜ BİR GEZEGEN ADI ANMAZ, çünkü orada gezegen yok. Yukarıdaki iki
   * cümle de `{{planet}}` üzerine kurulu ve o alan burada boş string.
   */
  pirateBroken: 'Mürettebat dağıldı. Geriye kalan artık senin.',
  pirateHeld: 'Korsanların savunması devam etti. Bu saldırıdan ganimet alamadın.',
  /** Ödül: oyunda inşa etmediğin bir gövdeye açılan tek kapı. */
  pirateCaptured: 'Korsanlardan kaçırıldı.',
  pirateCapturedNote:
    'Yok ettiğin mürettebatın enkazından sağlam çıkarıldı. Filonun döndüğü dünyanın garnizonuna katılır ve inşa ettiğin gemilerden sayılmaz.',
  youHeld: 'Saldırıyı durdurdun. Rakip kaynak alamadı.',
  youFell: 'Saldırı savunmana zarar verdi.',
  shipsLost: 'Kaybettiğin gemi',
  haul: 'Eve dönen',
  haulLost: 'Götürdükleri',
  salvageHaul: 'Enkazdan toplanan',
  roundsLabel: 'Tur',
  taken: 'Alınan',
  lost: 'Kaybedilen',
  dominion: 'Hâkimiyet',
  dominionSummaryGained: 'Bu savaşta {{amount}} Hâkimiyet kazandın.',
  dominionSummaryLost: 'Bu savaşta {{amount}} Hâkimiyet kaybettin.',
  dominionReason: 'Topladığın ganimet ve rakibin kalıcı kayıpları puan kazandırır. Senden alınan ganimet ve senin kalıcı kayıpların puan düşürür. Gemi sayısı değil, kaynak değeri kullanılır.',
  dominionBreakdown: {
    title: 'Hâkimiyet nasıl değişti',
    lootGained: 'Güvenceye alınan ganimet',
    lootLost: 'Senden alınan ganimet',
    enemyLosses: 'Düşmanın kalıcı kaybı',
    ownLosses: 'Senin kalıcı kaybın',
    total: 'Toplam puan değişimi',
  },
  clansAtLaunch: 'Bu filo yola çıktığındaki klanlar',
  yourClan: 'Senin tarafın',
  theirClan: 'Karşı taraf',
  noClan: 'Klan yok',
  verdict: {
    label: 'Savaşın sonucu',
    yourForce: 'Senin birliklerin',
    yourLosses: 'Senin kaybın',
    sent: 'Giden',
    held: 'Vardı',
    total: 'Toplam',
    lost: 'Kaybettin',
    returned: 'Sağ kalan',
    standing: 'Ayakta',
    destroyed: 'Yok ettin',
    enemyDestroyed: 'Rakipten yok edilen birlik',
    attackerDestroyed: 'Saldırandan yok edilen gemi',
    noneReturned: 'Savaş sonunda hiçbir gemin hayatta kalmadı.',
    someReturned: 'Savaş sonunda {{count}} gemin hayatta kaldı.',
    enemySurvivedNote: 'Rakibin birlikleri kaldı; sayıları gizli. Bu sayı yalnızca yok ettiklerindir.',
    enemyUnknownNote: 'Bu sayı yalnızca yok ettiklerindir; rakibin kalan birlik sayısı gizli.',
    loot: 'Ganimet',
    rosterUnknown: 'Bu raporda başlangıç sayısı yok. Sağ kalan sayısı hesaplanamıyor.',
    walkoverSummary: 'Hedefte savunacak birlik yoktu. Çatışma yaşanmadı.',
    piratePartialSummary: 'Korsan filosunun bir bölümü savaş sonunda hâlâ hayattaydı.',
    title: {
      attacking: {
        DECISIVE: 'Saldırın başarılı oldu',
        DECISIVE_WIPED: 'Savunmayı aştın, filonu kaybettin',
        PARTIAL: 'Saldırın kısmen başarılı oldu',
        PARTIAL_WIPED: 'Savunmaya zarar verdin, filonu kaybettin',
        REPELLED: 'Saldırın püskürtüldü',
      },
      defending: {
        DECISIVE: 'Savunman aşıldı',
        PARTIAL: 'Savunman kısmen aşıldı',
        REPELLED: 'Saldırıyı durdurdun',
      },
    },
    summary: {
      attacking: {
        DECISIVE: 'Hedefte savunmayı sürdürecek birlik kalmadı.',
        PARTIAL: 'Tam başarı koşulu sağlanmadı: savunma birlikleri veya kalkan hâlâ duruyordu.',
        REPELLED: 'Rakibin savunması devam etti. Ganimet alamadın.',
      },
      defending: {
        DECISIVE: 'Bu savaşta tüm savunma birliklerin yok edildi.',
        PARTIAL: 'Saldıran tam başarı sağlayamadı: birliklerin veya kalkanın ayakta kaldı.',
        REPELLED: 'Savunman devam etti. Saldıran ganimet alamadı.',
      },
    },
  },
  theirLosses: 'Yok ettiklerin',
  theirs: 'Karşıda ne varmış',
  theirsEmpty: 'Karşı taraf birlik kaybetmedi.',
  yourForce: 'Senin filon',
  yours: 'Sana neye mal oldu',
  yoursEmpty: 'Birlik kaybetmedin.',
  howItWent: 'Çatışma nasıl geçti',
  reasonHeading: 'Neden bu sonuç?',
  rulesToggle: 'Savaş kuralları ve hesaplama',
  roundCalculationToggle: 'Bu turun atış hesabını göster',
  roundLossesYours: 'Senden yok edilenler',
  roundLossesTheirs: 'Rakipten yok edilenler',
  roundNoCasualties: 'Kayıp yok',
  roundShield: 'Savunanın kalkanı {{amount}} hasarı karşıladı.',
  turningPointSupport: '{{round}}. tur sonunda ateş edebilen birliğin kalmadı. Kalan {{support}} destek gemisi saldırı yapamadı.',
  turningPointWiped: '{{round}}. tur sonunda bütün birliklerin yok edildi.',
  roundDamageNote: 'Hasar sayıları, savunanın kalkanının karşıladığı hasarı da içerir.',
  roundDealt: 'Sen vurdun',
  roundTook: 'Sana vurdular',
  roundLine: '<0>{{dealt}}</0> vurdun, <1>{{took}}</1> yedin',
  shield: 'kalkan {{amount}}',
  shieldBreaker: 'Söndürücü +{{amount}}',
  aegis: {
    aria: 'Aegis kalkanı',
    label: 'AEGIS KALKANI',
    labelTheirs: 'Rakibin Aegis kalkanı',
    labelYours: 'Senin Aegis kalkanın',
    broken: 'KIRILDI',
    roundedZero: 'RAPORDA 0',
    damaged: 'HASAR ALDI',
    held: 'DAYANDI',
    before: 'Savaş başında',
    after: 'Savaş sonunda',
    note: 'Gezegen kalkanı, savunmadaki birliklerden önce hasar alır.',
    brokenUnitsRemain: 'Kalkan gücü raporda 0 görünüyor, ama savunmadaki birlikler hayatta kaldı.',
    brokenDefenceGone: 'Kalkan kırıldı. Savunmadaki tüm birlikler de bu savaşta yok edildi.',
    brokenMeaning: 'Kalkan gücü yuvarlanarak gösterilir. 0 görünmesi, tek başına tüm savunmanın yok edildiğini göstermez.',
    absorbed: '{{amount}} kalkan hasarı emildi',
  },
  /* ── raporun her duruma borcu. `docs/battle-reports.md` ── */
  q: {
    happened: 'Ne oldu',
    there: 'Rakip hakkında öğrendiklerin',
    enemyForce: 'Rakibin savaş başındaki birlikleri',
    enemyLosses: 'Rakipten yok ettiklerin',
    incomingForce: 'Sana saldıran filo',
    who: 'Filona ne oldu?',
    changed: 'Ganimet ve puan değişimi',
  },
  walkoverHeading: 'Burada savunabilecek birlik yoktu',
  walkoverBody:
    'Savaşabilecek filo veya yer savunması yoktu. Gemilerin geldi, yükledi ve gitti. Rapor edilecek bir çarpışma olmadı.',
  walkoverDefendingBody:
    'Dünyanda savunacak birlik yoktu. Saldıran filo yağmalanabilir kaynakları çatışmadan alabildi.',
  theirBoardComplete: 'Savaş başındaki tüm savunma birlikleri',
  theirBoardCompleteNote:
    'Bu savaşta hepsi yok edildi. Bazı yer topları savaştan sonra yeniden kurulabilir.',
  theirBoardEmptyAtStart: 'Savaş başında savunma birliği yoktu',
  theirBoardEmptyAtStartNote:
    'Hedefte savaşabilecek gemi veya yer topu yoktu; bu yüzden burada yok edilen birlik listesi bulunmuyor.',
  theirBoardFloor: 'Yalnızca yok edilen birlikler',
  theirBoardFloorNote:
    'Bu liste rakibin tüm filosu değildir. Yalnızca bu savaşta yok edilenleri gösterir. Kalan birlikler bu raporda açıklanmaz; yeni bir sonda göndererek tahmin alabilirsin.',
  theirBoardMissingRosterNote: 'Bu raporda saldıran filonun başlangıç sayıları yok. Yalnızca yok ettiğin gemiler listeleniyor; sağ kalan sayısı hesaplanamıyor.',
  theirBoardNothing: 'Hiçbir şey yok edemedin',
  theirBoardArrived: 'Üzerine gelen filo',
  theirBoardArrivedNote:
    'Savaş ve destek gemileri dahil, sana gönderilen tüm filo. Her satırda kaç geminin geldiği, yok edildiği ve kaldığı yazıyor.',
  groundHeading: 'Yer savunması',
  groundNote: 'Bu toplar gezegeni savunur, uçamaz. Yok edilen her türün %{{percent}}\u2019ı, aşağı yuvarlanarak savaştan sonra yeniden kurulur. Gemi kayıplarından ayrı değerlendirilir.',
  shipsHeading: 'Gemiler',
  noGroundHeading: 'Yer savunması yok',
  noGroundNote: 'Vardığında bu dünyada ayakta duran bir duvar yoktu.',
  calculation: {
    intro:
      'Yukarıdaki sabit tarif aşağıdaki sayıları üretir. Sonra her raunt aynı üç adımla ilerler.',
    formulaHeading: 'Atış gücü nasıl oluşur',
    formulaBase: '1 · Temel: birlik adedi × saldırı × araştırma.',
    formulaCounter: '2 · Sınıf avantajı: güçlü eşleşme ×{{strong}}; zayıf eşleşme ×{{weak}}.',
    formulaRoll: '3 · Turun şans etkisi: −%{{min}} ile +%{{max}}.',
    formulaHp: 'Hasar, hedef türlerin toplam can içindeki payına göre bölünür.',
    formulaCarry: 'Bir birliğin yok olması için tüm canı bitmelidir; yarım kalan hasar sonraki tura taşınır.',
    formulaSupport: 'Destek gemileri, kendi taraflarında en az bir savaş birliği kaldığı sürece korunur.',
    resultHeading: 'Sonuç nasıl belirlenir',
    resultDecisive:
      'KESİN · savunmadaki tüm birlikler yok olmuş ve kalkan sıfıra inmiştir · ambar sınırından önce açık stokun %{{decisiveLoot}} kadarı alınabilir.',
    /**
     * AYNI KURAL, UYGULANAMAYACAK YARISI OLMADAN. Kalkan bir dünya üzerindeki
     * yapıdır; randevu noktasında kalkandan söz eden bir açıklama, okuyucunun asla
     * karşılaşmadığı bir koşulu anlatır.
     */
    resultDecisivePirate:
      'KESİN · mürettebattaki her gemi yok edildi · kargo sınırlarından önce ganimetin %{{decisiveLoot}} kadarı alınabilir; bir gövdeyi çekerek getirmek yalnızca burada mümkündür.',
    resultPartial:
      'KISMİ · savunma birliklerinin değer olarak en az %{{threshold}} kadarı yok edilmiştir · ambar sınırından önce açık stokun %{{partialLoot}} kadarı alınabilir.',
    resultRepelled:
      'PÜSKÜRTÜLDÜ · savunma birliklerinin değer olarak %{{threshold}} kadarından azı yok edilmiştir · kaynak alınamaz.',
    round: '{{round}}. tur',
    fire: '1 · Aynı anda ateş',
    fireNote: 'İki taraf aynı anda ateş eder. Bu turda yok edilen bir gemi de o turun atışını yapar.',
    yourShot: 'Senin atışın',
    theirShot: 'Rakibin atışı',
    shotChange: 'Şans etkisi',
    positivePercent: '+%{{amount}}',
    negativePercent: '−%{{amount}}',
    neutralPercent: '%0',
    aegis: '2 · Darbeyi Aegis karşılar',
    noAegis: '2 · Aktif Aegis yok',
    shieldCharge: 'Kalkan gücü',
    absorbed: '{{amount}} emildi',
    reachedHulls: 'Gövdelere ulaşan',
    shieldBreaker: '{{amount}}, Söndürücünün yalnız kalkana vuran hasarıydı',
    noAegisNote: 'Darbeyi tutan bir kalkan yoktu; {{amount}} atış gücünün tamamı savunma gövdelerine ulaştı.',
    /** Aynı adım, boşlukta: burada dünya yok, dolayısıyla yapı da yok. */
    openSpace: '2 · Toplarla gövdeler arasında hiçbir şey yok',
    openSpaceNote:
      'Bir randevu noktasında ne dünya ne de darbeyi tutacak bir yapı vardır; {{amount}} atış gücünün tamamı mürettebata ulaştı.',
    losses: '3 · Kayıplar savaştan çıkar',
  },
  gradeDecisive: 'KESİN',
  gradePartial: 'KISMİ',
  gradeRepelled: 'PÜSKÜRTÜLDÜ',
  strategicFirstStrike: 'İSABET',
  strategicCaptured: 'ELE GEÇİRİLDİ',
  strategicIneffective: 'ETKİSİZ',
  strategicIntercepted: 'HAVADA VURULDU',
  strategicYouAttacked: 'Ölüm Yıldızı hedefin: ',
  strategicAttackedBy: 'Ölüm Yıldızı gönderen: ',
  strategicDestroyedInFlight: 'Ölüm Yıldızı havada yok edildi',
  strategicRadarTrigger: 'Hedef dünya, araç 3. seviye veya üstü Radar önleme çemberine girince ateş açtı.',
  strategicTelescopeTrigger: 'Savunmacının dünyalarından biri aracı Teleskop görüşünde tanımlayınca ateş açtı.',
  strategicTotalDamage: 'Yok edilen toplam değer',
  strategicShieldLost: 'Yok edilen kalkan',
  strategicResourcesLost: 'Yok edilen maden',
  strategicOrdersLost: 'Yok edilen kuyruk işi',
  strategicResourceBreakdown: 'Yok edilen madenler',
  strategicNoFleetLost: 'Gezegendeki filo veya yer savunması kaybı yok.',
  strategicLevelLosses: 'Düşen seviyeler',
  strategicNoLevelLoss: 'Bina veya enstrüman seviyesi düşmedi.',
  strategicDestroyedOrders: 'Yok edilen inşaatlar',
  strategicNoOrdersLost: 'Aktif inşaat emri yok edilmedi.',

  neutralHolder: 'sahipsiz bir dünya',

  /**
   * Raporun tepesindeki damganın ne anlama geldiğini oyun ilk kez söylüyor.
   *
   * JARGONSUZ VE OKUYANIN TARAFINDAN. İlk hâli "savunma değerinin %42 eşiği"
   * diyordu: `defenceValue` oyunun iç hesabı, yüzde kimsenin bir şey yapamayacağı
   * bir eşik, cümle de kimsenin gözünden yazılmamıştı — yani akına uğrayan
   * komutan kendi kaybının tarafsız tarifini okuyordu. Oyuncu bu satırı bitirince
   * KENDİSİNE ne olduğunu ve yağmanın neden o kadar olduğunu bilmeli.
   */
  why: {
    attacking: {
      DECISIVE: 'Savunan ne varsa yok ettin, kalkanı da düşürdün; yağmanın tamamı bu yüzden açıldı.',
      DECISIVE_WIPED: 'Savunmadaki bütün birlikleri yok ettin; ancak hiçbir gemin hayatta kalmadığı için ganimet taşıyamadın.',
      DECISIVE_WITHOUT_SHIELD: 'Savunan ne varsa yok ettin; yağmanın tamamı bu yüzden açıldı.',
      WALKOVER: 'Savunacak birlik yoktu; yağmalanabilir kaynaklar filona açıktı.',
      PARTIAL: 'Kısmi başarı için gereken hasarı verdin, ama tam başarı sağlayamadın. Ganimetin yalnızca bir bölümü açıldı; taşıyacak gemin kalmadıysa kaynak alamazsın.',
      PARTIAL_WIPED: 'Savunmaya kısmi başarı sağlayacak kadar zarar verdin; ancak hiçbir gemin hayatta kalmadığı için ganimet taşıyamadın.',
      REPELLED: 'Yok ettiğin birliklerin kaynak değeri, savaş başındaki tüm savunma birliklerinin değerinin %{{threshold}}\u2019sine ulaşmadı. Bu yüzden saldırı püskürtüldü; gemi sayısı veya yalnız kalkanı kırmak sonucu belirlemez.',
    },
    defending: {
      DECISIVE: 'Savunmadaki bütün birliklerin düştü, kalkanın da kırıldı; yağmalanabilir kaynaklar saldıran filoya açıldı. Alınan miktar, hayatta kalan gemilerin taşıma kapasitesine bağlıdır.',
      DECISIVE_WITHOUT_SHIELD: 'Savunmadaki bütün birliklerin düştü; yağmalanabilir kaynaklar saldıran filoya açıldı. Alınan miktar, hayatta kalan gemilerin taşıma kapasitesine bağlıdır.',
      DECISIVE_WIPED: 'Savunmadaki bütün birliklerin düştü; ama saldıranın geldiği gemilerden de hiçbiri sağ kalmadı. Ganimet açıldı, taşıyacak kimse kalmadı.',
      WALKOVER: 'Dünyanda savunacak birlik yoktu; yağmalanabilir kaynaklar saldıran filoya açıktı.',
      PARTIAL: 'Saldıran kısmi başarı için gereken hasarı verdi, ama tam başarı sağlayamadı. Ganimetin yalnızca bir bölümü açıldı.',
      PARTIAL_WIPED: 'Saldıran kısmi başarı için gereken hasarı verdi; ama taşıyacak tek bir gemisi bile sağ kalmadı. Dünyandan hiçbir şey çıkmadı.',
      REPELLED: 'Savunman dayandı. İçeri giremediler ve kaynak götüremediler.',
    },
  },

  /** Savaşın yağma satırının ötesinde yaptıkları; her biri yalnız doğruysa yazılır. */
  effects: {
    heading: 'Bu savaş ne yaptı',
    shieldTheirs: 'Kalkanları, gövdelere ulaşmadan önce {{amount}} hasarı karşıladı.',
    shieldYours: 'Kalkanın, gövdelerine ulaşmadan önce {{amount}} hasarı karşıladı.',
    cargoLimited:
      'Ambarların doldu. O gezegende taşıyabileceğinden fazla kaynak vardı; filona Kurye, Seyyah, Atlas veya Argosi ekleyebilirsin.',
    salvaged_one: '{{count}} yer topu savaştan sonra kendi enkazından yeniden kuruldu.',
    salvaged_other: '{{count}} yer topu savaştan sonra kendi enkazından yeniden kuruldu.',
    worksTheirs: 'Tesisleri {{duration}} boyunca kapalı. Bu sürede kaynak üretilmiyor.',
    worksYours: 'Tesislerin {{duration}} boyunca devre dışı kaldı.',
    salvageTheirs: 'Hurdacıları, enkaz dağılmadan {{amount}} değerinde hurda topladı.',
    /** Koloni arızaları: ağır bir yenilginin bozdukları. Yalnızca savunan. */
    colonyFaults: 'Bu yenilgide {{planet}} üzerinde bozulanlar: {{faults}}.',
    /**
     * Toparlanma kalkanı, yalnızca savunan: bu savaş anında son pencerenin NET kaybı,
     * okuyanın kendi üretim saatiyle, eşiğe karşı. Owner instruction, 2026-09-18.
     */
    recoveryProgress:
      'Toparlanma kalkanı: son {{window}} saatte net {{hours}} / {{bar}} saatlik üretim kaybettin. {{bar}} saate ulaşınca {{shield}} saat sana akın yapılamaz; kendi akınlarının kârı bundan düşülür.',
    recoveryEarned:
      'Bu yenilgi sana {{shield}} saatlik toparlanma kalkanı kazandırdı: son {{window}} saatte net {{hours}} saatlik üretim kaybettin.',
    recoveryRefused:
      'Son {{window}} saatte net {{hours}} saatlik üretim kaybettin ve {{bar}} saatlik eşiği geçtin; ama kendi akının havadayken kalkan verilmez.',
    wreck: '{{planet}} üzerinde {{amount}} değerinde enkaz sürükleniyor. İsteyen gidip alabilir.',
    wreckYours: 'Kendi yörüngende {{amount}} değerinde enkaz sürükleniyor. İsteyen gidip alabilir; sen de.',
    /** Anılacak bir yörünge yok: alan, boşlukta, randevu noktasında duruyor. */
    wreckVoid:
      'Randevu noktasında, boşlukta {{amount}} değerinde enkaz sürükleniyor. Bir Prospector yolla — olup biteni gören herkes de yollayabilir.',
  },

  /** Okuyanın kendi tahtası: savaşa ne girdi, ne öldü, sonunda ne ayakta kaldı. */
  force: {
    reading: '{{sent}} gitti, {{lost}} kayıp, {{left}} kaldı',
    hull: 'Gövde',
    sent: 'Giden',
    held: 'Duran',
    lost: 'Kayıp',
    left: 'Kalan',
    rebuilt: 'Yeniden kurulan',
    start: 'Başlangıçta',
    arrived: 'Gelen',
    rebuiltNote: 'Yok edilen {{count}} yer topu savaştan sonra yeniden kuruldu; kalan sayısına dahildir.',
    groundType: 'Yer topu · uçamaz',
    supportType: 'Destek gemisi · ateş edemez',
    combatType: 'Savaş gemisi',
    summary: 'Savaşa {{brought}} girdi · {{lost}} yok edildi · {{left}} ayakta kaldı',
  },
  roundTheirs: 'Onlar',
  roundYours: 'Sen',
  roundNoLosses: 'Bu turda iki taraf da birlik kaybetmedi.',
  roundStanding: {
    unknownOwn: 'Başlangıç sayıları bu raporda yok; senin tarafında kaç birlik kaldığı hesaplanamıyor.',
    heading: '{{round}}. tur sonunda senin tarafın',
    enemyHeading: '{{round}}. tur sonunda saldıran filo',
    summary: '{{combat}} ateş edebilen birlik · {{support}} silahsız destek gemisi',
    supportExposed: 'Destek gemileri ateş edemez. Onları koruyacak savaş birliği de kalmadı.',
    noneLeft: 'Savaşa devam edebilecek hiçbir birliğin kalmadı.',
    unknownEnemy: 'Rakibin kalan birlik sayısı gizli. Yukarıdaki rakip kayıpları, tüm filosu değildir.',
  },
} as const;

export const clarity = {
  barsLabel: 'Netlik: {{state}}',
  stateFull: 'tam',
  stateClear: 'berrak',
  stateIntermittent: 'kesikli',
  stateDegraded: 'bozuk',
  stateBlind: 'kör',
  unreadable: 'OKUNAMIYOR',
  fleetHome: 'FİLO EVDE',
  fleetAway: 'FİLO DIŞARIDA',
  backIn: ' · {{minutes}} dk sonra döner',
  unwatched: 'izlemeye alınmadı',
} as const;

export const dossier = {
  sourcePublic: 'Herkese açık',
  sourceTelescope: 'Teleskop',
  sourceProbe: 'Sonda',
  sourceBattle: 'Savaş raporu',

  confidencePrecise: 'kesin',
  confidenceGood: 'iyi',
  confidenceRough: 'kaba',
  confidenceVague: 'belirsiz',

  ownerLabel: 'Sahibi',
  ownerNote: 'Sezon boyunca herkese açık.',
  ownerRecordNote: 'Sondanın bulduğu bayrak. O günden beri el değiştirmiş olabilir.',

  developmentLabel: 'Gelişim',
  developmentValue: '{{tier}}. kademe',

  hardwareLabel: 'Yörüngedeki uydular',
  hardwareNote: 'Donanımı görüyorsun. Ne işe yaradığını öğrenmek bir sondaya bakar.',
  hardwareRecordNote: 'Sonda geçerken yörüngede ne varsa o. Üstüne yenisini kurmuş olabilirler.',

  fleetLabel: 'Filoları',
  fleetUnreadable: 'Okunamıyor',
  fleetAway: 'Evde değil',
  fleetHome: 'Evde',
  fleetVeiledNote: 'Teleskopun Perde nedeniyle filo durumunu okuyamıyor. Teleskopu yükselt veya sonda gönder.',
  fleetAwayUnknownNote: 'Ne zaman döneceğini bilmiyorsun. Aldığın risk tam olarak bu.',
  fleetAwayNote: 'Filo dönene kadar gezegeni yalnız evde kalan birlikler savunuyor.',
  fleetHomeNote: 'İzlemek sessizdir; baktığını asla öğrenemezler.',

  fleetGapNoTelescope: 'Teleskopun yok',
  fleetGapOutOfRange: 'Teleskopunun menzili buraya yetmiyor',
  fleetGapNoSlot: 'Buraya bakan bir yuva yok',
  fleetGapWhy:
    'Galaksideki en değerli fırsatlardan biri: uçuşta olan filo, dönene kadar kendi dünyasını savunamaz.',
  fleetGapRange: '{{reach}} birim görüyor, o gezegen {{distance}} birim uzakta',
  fleetGapSlots: '{{count}} yuvanın hepsi dolu; birini kaydırman gerek',

  stockLabel: 'Şu an yağmalanabilir',
  stockNote: 'Kesin zaferle taşınabilecek miktar. Depo tabanı buna dahil değil; kendi ambarın daha da kısabilir.',
  stockCaught: 'Radarları sondayı yakaladı; birinin baktığını biliyorlar.',
  stockClean: 'Sonda girip çıktı, kimse fark etmedi.',
  defenceLabel: 'Silahlı birliklerin değeri',
  defenceNote: 'Sonda geçerken ateş edebilen gemi ve topların kaynak maliyeti. Saldırı hasarı değildir; kalkan ve silahsız gemiler dahil değildir.',
  defenceRatio: '{{world}} üzerindekinin yaklaşık {{ratio}} katı.',
  shapeLabel: 'Savunma dağılımı',
  shapeNote: 'Ateş edebilenlerin değerine göre. Yarıdan fazlası ağırlıktır.',
  shapeUnread: 'Okunamadı',
  shapeUnreadNote: 'Veil’leri sondayı gönderen tersaneden güçlü.',
  shieldLabel: 'Kalkan gücü',
  shieldNote: 'Akının ateşini gövdelerden önce emer ve saatler içinde dolar.',
  unarmedLabel: 'Savunmadaki silahsız gemi',
  unarmedNote: 'Ateş etmezler, ama temiz zafer için hepsi batırılmalı.',
  shipsLabel: 'Sayılan gemi',
  shipsAllHome: 'Sayılan gemilerin tamamı evdeydi.',
  shipsSomeOut: 'Gemilerinin bir kısmı dışarıdaydı.',

  /** Sondanın hep aldığı ama hiç gösterilmeyen dört okuma. Hepsi bakış anında donar. */
  /** Üstteki bandın yakıt payı; depo değil. D166. */
  deuteriumLabel: 'Yağmalanabilir döteryum',
  deuteriumNote: 'Üstteki bandın yakıt payı — kesin zaferle taşınabilecek miktar.',
  strategicLabel: 'Stratejik silah',
  strategicReady: 'Hazır ve kurulu',
  strategicBuilding: 'Yapım aşamasında',
  strategicUnknown: 'Rampada stratejik bir araç var',
  strategicNote: 'Sonda geçerken rampada duruyordu. O zamandan beri kalkmış olabilir.',
  strategicUnknownNote: 'Sonda ne kadar ilerlediğini ayırt edecek kadar keskin değildi.',
  interceptorLabel: 'Stratejik savunma',
  interceptorLoaded: 'Şarj dolu',
  interceptorEmpty: 'Şarj yok',
  interceptorLoadedNote:
    'Yüklü mühimmat, 3. seviye Radar çemberinde algılanan veya dünyalarından birinin Teleskop görüşünde tanımlanan ilk stratejik silahı imha eder.',
  interceptorEmptyNote: 'Sonda anında yüklü önleyici yoktu. O zamandan beri mühimmat yüklemiş olabilirler.',
  doctrinesLabel: 'Muharebe doktrini',
  doctrinesNone: 'Hiçbiri araştırılmamış',
  doctrinesNote: 'Bu araştırmalar gemilerin saldırı gücünü ve gövde dayanımını artırır. Rapordaki değerler sonda anına aittir.',
  doctrinesNoneNote: 'Sonda anında tamamlanmış muharebe araştırmaları yoktu.',

  surfaceGapLabel: 'Gezegen kimliği ve gelişimi',
  surfaceGapMissing: 'Bu dünyayı hiç görmedin',
  surfaceGapWhy:
    'Kimin elinde, ne kadar gelişmiş, yörüngesinde ne var; hiçbirini göremiyorsun. Bir sonda hepsini tek seferde getirir.',

  probeGapLabel: 'Kaynak ve savunma',
  probeGapMissing: 'Buraya daha önce yakından bakmadın',
  probeGapAged: 'Bu dünyaya dair okuman eskidi',
  probeGapWhy:
    'Aşağıda ne olduğunu bilmeden koca bir filoyu riske atacaksın. Sonda, o tahmini hiç değilse bir aralığa indirir.',

  compositionLabel: 'Sahaya sürdüğü bilinen',
  compositionValue: 'en az {{fleet}}',
  compositionNote: 'Son çatışmada yok ettiklerin. Yerlerine yenisini koymuş olabilirler.',
  compositionGapLabel: 'Gerçekte ne uçuruyorlar',
  compositionGapMissing: 'Onlarla hiç çatışmadın',
  compositionGapWhy: 'Bir filonun tam bileşimi yalnızca savaş raporundan çıkar.',
} as const;
