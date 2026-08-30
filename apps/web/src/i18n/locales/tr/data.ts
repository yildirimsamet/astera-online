/**
 * ADI OLAN ŞEYLER VE OYUNUN ONLAR HAKKINDA KURDUĞU CÜMLELER.
 *
 * GEMİ ADLARI ÇEVRİLMEDİ, TÜRKÇE KARŞILIĞI KONULDU. Bunlar özel isim gibi durur
 * ama aslında sınıf adıdır: "Wasp" bir oyuncuya ucuz, hızlı ve sürü hâlinde
 * demektir. Türkçe okuyan biri bunu "Wasp"tan çıkaramaz, "Atmaca"dan çıkarır.
 * Seçimler sözlük karşılığı değil, Türkçede aynı askerî tınıyı veren adlar:
 *
 *   Wasp → Atmaca · Lance → Mızrak · Bulwark → Siper · Hauler → Şilep
 *   Bastion → Tabya · Thorn → Kirpi · Prospector → Kazıcı
 *
 * "Tabya" ve "Şilep" gerçek Türkçe askerî ve denizcilik terimleri; oyuncunun
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
      name: 'Komuta Çekirdeği',
      tag: 'Diğer binaların tavanı',
      role: 'Bina tavanlarını, yapım hızını ve gezegenin yörünge, uçuş ve yer savunması kapasitesini belirler.',
      detail: 'Diğer binalar Komuta Çekirdeğinden daha yüksek seviyeye çıkamaz. Çekirdeği yükseltmek bina ve araştırma sürelerini kısaltır; belirli seviyelerde yeni yörünge ve uçuş yuvaları açar, yer savunması kapasitesini büyütür. Tek başına cevher veya savaş gücü üretmez.',
    },
    REFINERY: {
      name: 'Alaşım Rafinerisi',
      tag: 'Alaşım üretir',
      role: 'Saatlik alaşım üretimi ve alaşım deposu.',
      detail: 'Her seviye saatlik alaşım akışını ve depolayabileceğin miktarı artırır. İnşaatların ve çoğu geminin ana girdisi alaşım olduğu için sonraki beklemeleri kısaltır.',
    },
    EXTRACTOR: {
      name: 'Kristal Ocağı',
      tag: 'Kristal üretir',
      role: 'Saatlik kristal üretimi ve kristal deposu.',
      detail: 'Her seviye saatlik kristal akışını ve depo tavanını büyütür. Gelişmiş donanım, cihaz ve araştırmalarda gereken kıt kaynağı daha düzenli toplarsın.',
    },
    VAULT: {
      name: 'Kasa',
      tag: 'Akına karşı korur',
      role: 'Hiçbir akının alamayacağı stok.',
      detail: 'Korunan stok tabanını ve depo tavanını yükseltir. Akıncı yalnız bu tabanın üstünde kalan cevheri alabilir; Kasa saldırganla savaşmaz.',
    },
    SHIPYARD: {
      name: 'Tersane',
      tag: 'Yeni gemileri açar',
      role: 'Yeni gövdeleri açar; gemi ve yer savunması yapımını hızlandırır, sonda başarısını belirler.',
      detail: 'Seviye yükseldikçe yeni gemi sınıfları açılır, gemiler ile yer savunmaları daha hızlı tamamlanır. Sondaların daha doğru okuma yapmasını sağlar ve kendi sondalarının yakalanmasını zorlaştırır. Hangar kapasitesini veya üretim sırasındaki yuva sayısını artırmaz.',
    },
    DEUTERIUM_PLANT: {
      name: 'Döteryum Rafinerisi',
      tag: 'Döteryum üretir',
      role: 'Yakıtın tek istikrarlı kaynağı. Tavanını Döteryum Sentezi araştırman belirler.',
      detail: 'Filoları kaldırmak için gereken yakıtı düzenli üretir. Bir sonraki seviye kilitliyse önce Döteryum Sentezi araştırmasını bir kademe ilerletmelisin.',
    },
    HANGAR: {
      name: 'Hangar',
      tag: 'Filonun sığacağı yeri belirler',
      role: 'Gemilere yer açar. Filonun sınırı kasan değil, burasıdır.',
      detail: 'Her hareketli gövde büyüklüğüne göre Hangarda yer kaplar; dışarıda uçan gemiler de sayılır. Gezegene sığmayacak bir filo sipariş etmeden önce bunu büyüt.',
    },
  },

  instrument: {
    TELESCOPE: {
      name: 'Teleskop',
      tag: 'Uzağı okunur kılar',
      role:
        'Görüş alanındaki hareketleri tanır; izleme yuvaları L1, L3 ve L5’te 1, 2 ve 3 olur. Sessizdir.',
      roleNone:
        'GÖZ. Uzak hareketleri tanır; bir gezegeni izlediğinde filosunun evde olup olmadığını öğrenirsin. Önce yörüngeye Anten koyman gerekiyor.',
      roleOwned:
        'GÖZ. Görüş alanını büyütür ve seçtiğin dünyaları sessizce izler. Sana bilgi verir, koruma vermez.',
      detail: 'Seviyesi arttıkça hareket görüşü uzar ve bu alana giren asteroitleri keşfedersin; keşfettiğin kaya yok olana kadar haritanda kalır. L1, L3 ve L5 sırasıyla bir, iki ve üç sessiz izleme yuvası verir. Teleskop sana yönelen filoya karşı alarm vermez.',
    },
    RADAR: {
      name: 'Radar',
      tag: 'Sana geleni ayırt eder',
      role:
        'Sondaları yakalar. L3’ten sonra Radar çemberinde sana yönelen tehdidi varış süresiyle gösterir.',
      roleNone:
        'UYARI. Şu anda buraya bir filo hiç haber vermeden inebilir, sondaların çoğu da fark edilmeden gelip gider. Önce yörüngeye Anten koyman gerekiyor.',
      roleOwned:
        'UYARI. Sana gelen tehdidi varış süresiyle işaretler. L4 yaklaşık büyüklüğü, L5 çıkış yerini ve tam filoyu ekler.',
      detail: 'İlk seviyeler sondaları ve geliş yönünü yakalar. L3’ten sonra Radar çemberi bu gezegene yönelen filoyu varış süresiyle işaretler.',
    },
    AEGIS: {
      name: 'Aegis',
      tag: 'Gezegeni saran kalkan',
      role: 'Kalkan canı. Saatte %40 kendini toplar; yörüngede değil, gezegende durur.',
      roleNone:
        'EMER. Akının ilk darbesini birliklerin yerine kalkan yer, sonra kendi kendine bedavaya dolar. Güvenlidir ama sana hiçbir şey göstermez.',
      roleOwned:
        'EMER. Akının ilk darbesini birliklerin yerine kalkan yer, sonra kendi kendine bedavaya dolar. Güvenlidir ama sana hiçbir şey göstermez.',
      detail: 'Her seviye kalkan dayanımını artırır. Hasarı gemi ve yer toplarından önce karşılar, sonra kaynak harcamadan yenilenir; bilgi vermez ve gelen silahı önlemez.',
    },
    VEIL: {
      name: 'Perde',
      tag: 'Teleskoptan gizler',
      role: 'Karşı taraf teleskopla baktığında senin hakkında okuduğunu bozar.',
      roleNone:
        'GÖRÜNME. Teleskopları filon yerine BİLİNMİYOR okur. Gizler ama yalan söylemez, sondayı da durdurmaz.',
      roleOwned:
        'GÖRÜNME. Teleskopları filon yerine BİLİNMİYOR okur. Gizler ama yalan söylemez, sondayı da durdurmaz.',
      detail: 'Daha güçlü Perde daha güçlü Teleskop okumalarını bozar ve eşit Tersanede sonda isabetini düşürür. Durumunu saklar; sahte bilgi üretmez, gelen sondayı durdurmaz.',
    },
  },

  satellite: {
    UPLINK: {
      name: 'Anten',
      tag: 'Teleskop ve Radarı açar',
      role:
        'UZAĞI GÖR. Teleskoba ve Radara açılan tek kapı. Ne üretir ne savunur; Antensiz de çıplak göz çevreni görmeye devam edersin.',
      blurb:
        'Bir muhabere rölesi. Ne üretir ne savunur; çıplak göz çevrenin ötesine ulaşan Teleskop ve Radarı açar.',
      detail: 'Bir kez kurulduğunda bu dünyada Teleskop ve Radar inşa edebilmeni sağlar. Bir yörünge yuvası kullanır; kendi seviyesi yoktur.',
    },
    FOUNDRY: {
      name: 'Körük',
      tag: 'Saatlik üretimi artırır',
      role:
        'KAZAN. İki metal de sezon boyunca daha hızlı gelir. Buradaki en yavaş ödül, ama son gün hâlâ kazandıran tek şey.',
      blurb:
        'Havuzu baştan kurar. Yukarıda durduğu sürece alaşım da kristal de daha hızlı çıkar. Listenin en yavaş getirisi; buna karşılık sezonun son gününde hâlâ para kazandıran tek uydu.',
      detail: 'Bu dünyanın iki pasif cevher akışına da kalıcı çarpan uygular. Getirisi zamana yayıldığı için erken kurulduğunda daha değerlidir.',
    },
    DERRICK: {
      name: 'Matkap',
      tag: 'Madencileri güçlendirir',
      role:
        'KAZ. Kazıcıların çok daha fazla taşır ve çok daha erken varır. Kapışılan bir kayada birinci ile ikinci arasındaki fark tam olarak budur. Hiç madene çıkmayacaksan bir işe yaramaz.',
      blurb:
        'Madenci araçlarının ikmal gemisi. Her Kazıcın çok daha fazla cevher taşır ve kayasına çok daha erken varır. Kapışılan bir asteroitte birinci varmakla ikinci varmak arasındaki farkı bu belirler.',
      detail: 'Bu dünyadan çıkan Kazıcıların hem hızını hem ambarını çarpar. Yalnız asteroit madenciliğini etkiler; normal akın ganimetini büyütmez.',
    },
    BEACON: {
      name: 'Kılavuz',
      tag: 'Filoları hızlandırır',
      role:
        'VUR. Gönderdiğin her filo gidiş dönüş daha az zaman harcar. Hiçbir dövüşü kazandırmaz; sadece gezegeninin açıkta kaldığı süreyi kısaltır.',
      blurb:
        'Bir seyir feneri. Buradan kalkan her filo gidişte de dönüşte de daha hızlı uçar. Uçuş kısaldıkça savunmanın evde olmadığı süre de kısalır.',
      detail: 'Hız çarpanı buradan kalkan bütün filoların gidiş ve dönüşüne uygulanır. Yol kısalır; saldırı, zırh ve ambar değerleri değişmez.',
    },
  },

  hull: {
    WASP: {
      name: 'Atmaca',
      tag: 'Ucuz ve hızlı',
      role: 'En ucuz saldırı, en kısa gidiş dönüş.',
      pitch: 'En ucuza hasar, en çabuk dönüş. Gezegenin en kısa süre açıkta kalır.',
      detail: 'Ucuz ve hızlı baskınlarda ya da ağır Siper filolarını cezalandırmakta kullan. Mızraklara karşı hızla erir; tek başına ganimet taşımaz.',
    },
    LANCE: {
      name: 'Mızrak',
      tag: 'En sert vuran',
      role: 'En yüksek saldırı. Atmacaya güçlü, Sipere zayıf.',
      pitch: 'En sert vuran gemi. Atmacaları biçer, Siperlerden seker.',
      detail: 'Filo yerini yüksek saldırıya çevirir ve Atmaca sürülerini karşılar. Siper zırhı kötü eşleşmesidir; yalnız Mızraktan oluşan filonun cevabı kolaydır.',
    },
    BULWARK: {
      name: 'Siper',
      tag: 'Ağır ve dayanıklı',
      role: 'Dayanıklılığın omurgası. O kadar yavaştır ki açıkta kalma süreni ikiye katlar.',
      pitch: 'Her şeyi öldüren ateşe dayanır. Karşılığında dışarıda kaldığın süreyi neredeyse ikiye katlar.',
      detail: 'Mızrak ağırlıklı düşmana karşı filoyu ayakta tutar ve onu verimli biçimde karşılar. Çok yavaş olduğu için görev süresiyle gezegeninin açıkta kaldığı süreyi ciddi biçimde uzatır.',
    },
    HAULER: {
      name: 'Şilep',
      tag: 'Ganimeti taşır',
      role: 'Ganimeti eve getirir, dövüşe hiçbir katkısı olmaz.',
      pitch: 'Ganimeti eve getirir. Dövüşte bir işe yaramaz; ya yanına koruma ver ya da kaybetmeyi göze al.',
      detail: 'Hedefte alınacak açık stok varsa filoya ekle. Ucuz ambar sağlar; hasar veremez ve yalnız savaş gemileri ayaktayken korunur.',
    },
    RUNNER: {
      name: 'Koşucu',
      tag: 'Hızlı akın ambarı',
      role: 'Hızlı destek ambarı. Kısa açıkta kalma süresi için pahalı kapasite.',
      pitch: 'Şilepten az taşır ama vurucu filoyla aynı hızda gider. Satın aldığın şey hızdır.',
      detail: 'Hızlı akın filosunu ambar yüzünden yavaşlatmaz. Taşıdığı birim başına Şilepten pahalıdır; verimden çok kısa açıkta kalma süresi önemliyse seç.',
    },
    BREACHER: {
      name: 'Delici',
      tag: 'Aktif kalkanları kırar',
      role: 'Mızrak uzmanı. Aktif kalkana karşı normal etkisinin beş katını uygular.',
      pitch: 'Aegis’i ezer ama bonus hasarı birliklere taşımaz. Kalkan yoksa verimsiz kalır.',
      detail: 'Uzman yükü aktif Aegis’e normal etkinin beş katını uygular. Kalkan düşünce artan hasar gemi ve toplara taşmaz; kalkansız hedefte ödediğin fark boşa gider.',
    },
    BASTION: {
      name: 'Tabya',
      tag: 'Ağır yer topu',
      role: 'Yer savunması. Gezegenden asla ayrılmaz.',
      pitch: 'Ağır yer topları. Mızrakları kırarlar, ama Atmaca sürüsünün altında ezilirler.',
      detail: 'Gezegenden ayrılmaz ve Mızrak ağırlıklı saldırıları durdurmak için kurulur. Atmaca sürüleri ağır ateşini boğar; yok edilen yer toplarının bir bölümü enkazdan ücretsiz kurulur.',
    },
    THORN: {
      name: 'Kirpi',
      tag: 'Hafif yer topu',
      role: 'Yer savunması. Ucuz, hafif ve hiç kalkmaz.',
      pitch: 'Hafif yer topları; ucuz oldukları için çok sayıda dizilir. Ağırları biçerler, Mızraklar onları teker teker toplar.',
      detail: 'Siper ağırlıklı akınlara karşı ucuz ve kalıcı cevaptır. Mızraklar onları kolay toplar; diğer yer topları gibi Hangarı değil, yer savunma kapasitesini kullanır.',
    },
    PROSPECTOR: {
      name: 'Kazıcı',
      tag: 'Asteroit kazar',
      role: 'Geçen asteroitleri kazar, hiçbir dövüşe girmez.',
      pitch: 'Geçmekte olan bir kayaya gider, cevheri alıp döner. Dövüşmez.',
      detail: 'Görünen asteroide başka bir komutandan önce gönder. Cevheri Havuz’a taşır, gezegenin toplam Kazıcı sınırına dâhildir ve savaşta hiçbir katkı vermez.',
    },
  },

  resource: {
    alloy: 'alaşım',
    crystal: 'kristal',
    deuterium: 'Döteryum',
  },

  unlock: {
    TELESCOPE: {
      title: 'Teleskop açıldı',
      body: 'Anten ve Teleskop uzaktaki hareketi tanımlar; ayrıca bir gezegeni izlemene izin verir.',
    },
    RADAR: {
      title: 'Radar açıldı',
      body: 'Anten ve Radar sondaları yakalar; L3’te Radar çemberi sana yönelen tehdidi varış süresiyle işaretler.',
    },
    EXPLORER: {
      title: 'Kâşif açıldı',
      body: 'Kesin bilgi istiyorsan sonda gönder. Radarları onu yakalayabilir.',
    },
    VEIL: {
      title: 'Perde açıldı',
      body: 'Artık seni izleyenler filonu BİLİNMİYOR olarak görebilir.',
    },
  },
} as const;

export const gains = {
  rangeUnits: '{{count}} birim',

  core: {
    label: 'İnşa tavanı',
    level: 'L{{level}}',
    releases_one: 'Tıkanan {{count}} yükseltmeyi açar',
    releases_other: 'Tıkanan {{count}} yükseltmeyi açar',
    raisesCap: 'Diğer her şeyin tavanını yükseltir',
  },
  refinery: {
    label: 'Saatlik alaşım',
    rate: '{{amount}}/sa',
    storage: 'Depo {{now}} → {{next}}',
  },
  extractor: {
    label: 'Saatlik kristal',
    rate: '{{amount}}/sa',
    storage: 'Depo {{now}} → {{next}}',
  },
  vault: {
    label: 'Kasa kapasitesi',
    value: '{{alloy}} alaşım · {{crystal}} kristal',
    storeLabel: 'Depo tavanı',
    storeValue: '{{hours}} saatlik üretim',
  },
  shipyard: {
    accuracyLabel: 'Sonda isabeti',
    seesLabel: 'Deldiği Perde seviyesi',
    seesValue: 'L{{level}}',
    unlocksHull: '{{hull}} açılır',
    stealth: 'Kendi sondalarının yakalanması da zorlaşır',
  },

  telescope: {
    slotsLabel: 'İzleyebildiğin gezegen',
    rangeLabel: 'Görüş menzilin',
    maxed: 'En üst seviye; {{slots}} izleme yuvası ve {{range}} birim hareket görüşü. Dış sınır sisli kalır',
    reachAndCooldown: '{{range}} görür, bir yuva {{hours}} saatte yeniden kurulur',
    nextSlot: 'Sonraki seviye {{ordinal}} yuvayı açar',
    ordinalSecond: '2.',
    ordinalThird: '3.',
    cooldown: 'Bir yuva {{hours}} saatte yeniden kurulur',
  },
  radar: {
    scansLabel: 'Taramayı yakalar',
    scansNo: 'hayır',
    scansYes: 'evet',
    scansBearing: 'evet, yönüyle birlikte',
    sweepLabel: 'Tehdit sezgisi · süreli uyarı',
    sweepNone: 'yok',
    reaches: '{{sense}} saatsiz · {{warn}} süreli',
    maxed: 'En üst seviye; yakın uyarı geldiği yeri ve filonun tam içeriğini de açar',
    l2l3: 'L2 yönü, L3 gelen filoları ekler',
    estimate: 'Yaklaşan gücün yaklaşık büyüklüğünü erkenden gösterir',
    origin: 'Yakın uyarıda geldiği gezegeni ve filonun tam içeriğini verir',
  },
  aegis: {
    label: 'Azami kalkan',
    unlocks: 'Birliklerin hasar almadan önce o emer, saatte %40 dolar',
  },
  veil: {
    label: 'Kör ettiği teleskop',
    none: 'yok',
    level: 'L{{level}}',
    unlocks: 'Eşit Tersanede sondanın isabetini %{{percent}} seviyesine düşürür',
  },

  foundry: {
    label: 'Havuzun ürettiği her şey',
    now: 'olduğu gibi',
    next: '+%{{percent}}',
    unlocks: 'Alaşım da kristal de, sezonun sonuna kadar',
  },
  uplink: {
    label: 'Teleskop ve Radar',
    now: 'kilitli',
    next: 'açık',
    unlocks: 'Çevrendekiler hakkında tahmin yürütmeyi bırakmanın tek yolu',
  },
  derrick: {
    label: 'Her Kazıcının taşıdığı',
    now: '1×',
    next: '{{factor}}×',
    unlocks: 'Üstelik {{factor}}× hızlanır; cevher kayaya ilk varanın olur',
  },
  beacon: {
    label: 'Buradan kalkan her filo',
    now: 'normal hızda',
    next: '{{factor}}× hızlı',
    unlocks: 'Gidiş de dönüş de kısalır, savunman evde olmadan geçen süre azalır',
  },
  hangar: {
    label: 'Filo yeri',
    value: '{{room}}',
  },
  research: {
    doctrineLabel: '{{hull}} saldırı ve gövde',
    doctrineScope: 'Sahip olduğun her {{hull}}, her yerde. Destek gemilerini etkilemez.',
    lanceScope: 'Sahip olduğun her {{lance}} ve {{breacher}}. Destek gemilerini etkilemez.',
    groundLabel: 'Yer savunması gücü',
    groundScope: 'Elindeki her dünyadaki {{bastion}} ve {{thorn}}.',
    generalLabel: 'Her gemi, saldırı ve zırh',
    generalScope:
      'Hiçbir doktrinin kapsamadığı destek gemileri dahil, sahip olduğun her araca uygulanır. Sınıf doktriniyle birleşir; ikisi birlikte %25 savaş gücüyle sınırlıdır.',
    yardLabel: 'Gemi yapım süresi',
    holdsLabel: 'Prospector ambarı',
    holdsScope: 'Yörüngedeki Derrick ile çarpımsal birleşir.',
    cargoLabel: 'Akın yükü',
    cargoScope: 'Yalnız yağma — dünyalar arası transfer ve madencilik değişmez.',
    refineryLabel: 'Rafineri tavanı',
    stockpileLabel: 'Hazır silah',
    /* İzin bir kapı açar; merdiven gibi çizmek olmayan bir miktar uydurmak olur. */
    opensLabel: 'Açar',
    open: 'Açık',
    shut: 'Kilitli',
    isotopeOpens: 'İzotop asteroitleri seçilebilir madencilik hedefi olur.',
    denseOpens: 'Runner gövdesi inşa edilebilir olur.',
    graviticOpens: 'Breacher gövdesi inşa edilebilir olur.',
    protocolOpens: 'Ölüm Yıldızı inşa edilebilir olur.',
    gridOpens: 'Interceptor şarjı inşa edilebilir olur.',
  },
  plant: {
    label: 'Döteryum',
    value: '{{rate}}/sa',
  },
} as const;

export const directives = {
  inboundTitle: 'Filo geliyor · {{duration}}',
  inboundDetail:
    'Stoğu harca, filonu kaçır ya da kal ve dövüş. Burada olmayan şey senden alınamaz.',
  inboundAction: 'Hemen harca',

  undefendedTitle: 'Bu gezegeni savunan hiçbir şey yok',
  undefendedDetail:
    'Kasa tabanının {{amount}} üstündesin ve yerde tek bir top bile yok. Tabyalar hiç kalkmaz.',
  undefendedAction: 'Savunma kur',

  exposedTitle: 'Senden {{amount}} alınabilir',
  exposedDetail: 'Kasan {{now}} koruyor, bir üst seviyesi {{next}} koruyacak.',
  exposedAction: 'Kasayı yükselt',

  scannedTitle_one: 'Biri seni taradı',
  scannedTitle_other: 'Sana karşı {{count}} tarama',
  scannedDetail:
    'Elinde ne olduğunu öğrenmeye çalışıyorlar. Perde, çıkardıkları resmi yanlış gösterir.',
  scannedAction: 'Kayda bak',

  windowTitle: '{{name}} gezegeninin filosu dışarıda',
  windowDetailUnknownJustNow: 'Az önce gördün. Ne zaman döneceğini bilmiyorsun.',
  windowDetailUnknown: '{{age}} önce gördün. Ne zaman döneceğini bilmiyorsun.',
  windowDetailEta:
    'Yaklaşık {{duration}} sonra dönüyor. Gezegeni şu an geride bıraktıklarına emanet.',
  windowAction: 'Fırsatı değerlendir',

  storageFullTitle: '{{amount}} toplanamıyor',
  storageFullDetail: 'Depon dolu, havuz boşalacak yer bulamıyor. Bir şeye harca, gerisi gelsin.',
  storageFullAction: 'Harca',

  noTelescopeTitle: 'Yalnızca çıplak göz mesafesini görüyorsun',
  noTelescopeDetail:
    'Ücretsiz görüşün yakından geçen bir asteroidi zaten keşfedebilir. Teleskop bu keşif alanını büyütür, uzaktaki araçları tanır ve bir gezegeni sessizce izleyip filosu kalktığında sana söyler.',
  noTelescopeAction: 'Teleskop kur',

  noRadarTitle: 'Buraya bir filo habersiz inebilir',
  noRadarDetail:
    'Radar L3, Radar çemberinde sana yönelen tehdidi varış süresiyle işaretler.',
  noRadarAction: 'Radara bak',

  coreCeilingTitle: 'Komuta Çekirdeği {{count}} yükseltmeyi tıkıyor',
  coreCeilingDetail: 'Hiçbir bina Çekirdeği geçemez. Onu yükseltince hepsi birden açılır.',
  coreCeilingAction: 'Çekirdeği yükselt',

  idleTitle: 'Havada hiçbir şey yok',
  idleDetailHasShips: 'Bir şey göndermezsen ne sana ne senin için bir şey olur.',
  idleDetailNoShips: 'Evde gemin yok. Ya yenisini yap ya da dışarıdakilerin dönmesini bekle.',
  idleAction: 'Hedef bul',

  baysFreeTitle_one: 'Bir rampa hâlâ boş',
  baysFreeTitle_other: '{{count}} rampa hâlâ boş',
  baysFreeDetail: 'Sonda, akın ya da maden seferi — kalkan her şey bir rampa kullanır.',
  baysFreeAction: 'Etrafa bak',

  kindThreat: 'Tehdit',
  kindOpportunity: 'Fırsat',
  kindGrowth: 'Açık',
  kindIdle: 'Bekleyen yok',
} as const;

export const notifications = {
  incomingFallback: 'Filo geliyor.',
  incomingLanded: 'indi',
  incomingEta: 'Tahmini {{minutes}} dk',
  incomingLandsIn: '{{duration}} sonra iniyor',
  incomingHead: 'Filo geliyor · {{clock}}',
  strategicIncomingHead: 'Stratejik silah geliyor · {{clock}}',
  incomingEstimate: 'yaklaşık {{count}} gemi',
  incomingFrom: 'kalkış: {{origin}}',
  /** Okuyanın hangi dünyası hedefte. Radar ürünü değil. */
  incomingAt: 'hedef {{world}}',
  commanderAt: '{{username}} · {{planet}} gezegeni',
  unknownCommander: 'biri',
  raidedBy: 'Akıncı: {{origin}} · ',
  composition: '{{count}} {{hull}}',
  join: ' · ',

  raidedFallback: 'Akın yedin.',
  repelledHead: 'Akın püskürtüldü · {{cost}}',
  repelledLost: 'savunurken {{count}} kayıp',
  repelledTheirs: 'karşıdan {{count}} gemi yok edildi',
  raided: 'Akın yedin · {{detail}}',
  raidedWorks: 'havuz {{time}} kapalı',
  raidedTaken: '−{{amount}} gitti',
  raidedLost_one: '{{count}} birlik kayıp',
  raidedLost_other: '{{count}} birlik kayıp',
  raidedNothing: 'Akın yedin · eli boş döndüler',

  raidResultFallback: 'Akının sonuçlandı.',
  raidWiped: '{{target}} dayandı. Filon yok edildi, {{count}} gemi kayıp',
  raidResult: '{{target}} üzerinde {{grade}} · {{detail}} · {{count}} gemi kayıp',
  raidNothing: 'eli boş döndün',
  spoilAlloy: '+{{amount}} alaşım',
  spoilCrystal: '+{{amount}} kristal',
  spoilDeuterium: '+{{amount}} Döteryum',

  fleetFallback: 'Filon evde.',
  fleetHomeLooted: 'Filo evde{{where}} · {{count}} gemi · +{{amount}} ganimet',
  fleetHomeEmpty: 'Filo evde{{where}} · {{count}} gemi · eli boş',
  fleetFrom: ' ({{origin}} dönüşü)',
  probeLost: 'Sondan kayboldu. O uçuş tamamlanamadı',
  recalled: '{{count}} araç geri döndü. O uçuş tamamlanamadı',

  salvageWord: 'Hurda',
  oreWord: 'Cevher',
  haulWasted: '{{what}} geldi ama koyacak yer yoktu · {{amount}} çöpe gitti',
  haulNothing: '{{what}} seferi eli boş döndü',
  haulPartly: '{{what}} geldi · {{landed}} · havuz dolu olduğu için {{amount}} kayboldu',
  haul: '{{what}} geldi · {{landed}}',

  scanDetected: 'Tarama yakalandı. Biri senin resmini çıkarıyor.',

  probeFallback: 'Sonda döndü, raporu hazır.',
  probeHome: 'Sonda döndü · {{target}} artık okunabilir{{caught}}',
  probeCaught: ' · sondayı yakaladılar',

  unlock: '{{title}} — {{body}}',
  deathStarFallback: 'Death Star darben sonuçlandı.',
  deathStar: {
    FIRST_STRIKE: 'Death Star darbesi · dünya recovery durumuna girdi',
    CAPTURED: 'Death Star darbesi · koloni ele geçirildi',
    INEFFECTIVE: 'Death Star darbesi · etkisiz kaldı',
  },
  colonyCaptured: 'Koloni kuruldu · işgal koruması aktif',
  colonyLost: 'Koloni stratejik darbeyle kaybedildi',
  settlementLost: 'Yerleşim yarışı kaybedildi · Hauler ve kargo geri dönüyor',
  interceptedDefended: 'Savunma ağın bir Ölüm Yıldızı’nı {{range}} birim uzakta imha etti.',
  interceptedLost: 'Ölüm Yıldızı’n hedefine {{range}} birim kala imha edildi.',
  interceptedFallback: 'Bir Ölüm Yıldızı uçuş hâlinde imha edildi.',
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
  now: 'şimdi',
  live: 'canlı',
  ago: '{{duration}} önce',
  hoursMinutes: '{{h}}s {{m}}d',
  minutesSeconds: '{{m}}d {{s}}sn',
  seconds: '{{s}}sn',
  daysHours: '{{d}}g {{h}}s',
  minutes: '{{m}}d',
  numberLocale: 'tr-TR',
  thousands: '{{value}}b',
  millions: '{{value}}M',
  percent: '%{{value}}',
  rangeJoin: '–',
  plus: '+',
  minus: '−',
} as const;
