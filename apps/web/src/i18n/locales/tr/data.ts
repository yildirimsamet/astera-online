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
      name: 'Komuta Çekirdeği',
      tag: 'Gezegenin gelişim sınırı',
      role: "Gezegenin yapı seviye sınırlarını belirler; uçuş rampası, yörünge yuvası ve yer savunması kapasitesi açar.",
      detail: "Çekirdek, gezegenin yapı seviyelerini sınırlar; Hangarın sınırı bağımsızdır. Belirli seviyelerde uçuş rampası, yörünge yuvası ve yer savunması kapasitesi ekler. Yükseltmeler, gezegen cihazlarının ve Anten dışındaki uyduların kurulumunu hızlandırır. Bina yükseltme süresi, bina türüne ve seviyesine bağlıdır. Araştırma süresini ve bazı araştırma koşullarını ana gezegendeki Çekirdek belirler. Ana gezegende 9, 13 ve 16. seviyeler, sırasıyla birinci, ikinci ve üçüncü koloni yuvasını açar.",
    },
    REFINERY: {
      name: 'Alaşım Rafinerisi',
      tag: 'Alaşım üretir',
      role: "Bu gezegenin saatlik alaşım üretimini ve alaşım depo kapasitesini artırır.",
      detail: "Her seviye, Havuzda üretilen saatlik alaşımı ve Depoya sığan alaşımı artırır. Üretilen kaynağı harcamadan önce toplamalısın. Alaşım, çoğu bina, gemi ve yer savunmasında kullanılır.",
    },
    EXTRACTOR: {
      name: 'Kristal Ocağı',
      tag: 'Kristal üretir',
      role: "Bu gezegenin saatlik kristal üretimini ve kristal depo kapasitesini artırır.",
      detail: "Her seviye, Havuzda üretilen saatlik kristali ve Depoya sığan kristali artırır. Harcamadan önce toplamalısın. Kristal, gelişmiş gemiler, gezegen cihazları ve araştırmalar için gerekir.",
    },
    VAULT: {
      name: 'Depo',
      tag: 'Depo kapasitesini büyütür',
      role: "Depoyu büyütür. Kapasitenin %10’u ile 8 saatlik üretimden küçük olanı akından korunur.",
      detail: "Her seviye, daha fazla saatlik üretime karşılık gelen kaynak tutar. Kapasite, aynı seviyedeki alaşım veya kristal üreticisinin sonraki yükseltme bedelinin en az %110’unu da karşılar. Örneğin Depo 3 için Rafineri 3→4 alaşım bedeli ve Ocak 3→4 kristal bedeli kullanılır. Böyle hesaplanan depolama saatleri döteryuma da uygulanır. Korunan miktar, kapasitenin %10’u ile o kaynağın 8 saatlik üretiminden küçük olanıdır. Kalan stok yağmalanabilir; Depo savaş hasarını emmez.",
    },
    SHIPYARD: {
      name: 'Tersane',
      tag: 'Yeni gemileri açar',
      role: "Yeni birimleri açar; gemi ve yer savunması üretimini hızlandırır, sondalarını geliştirir.",
      detail: "Yüksek seviye, daha fazla gemi ve yer savunmasının üretim koşulunu karşılar; üretim süresini kısaltır. Sondalarının doğruluğunu artırır ve rakip Radarın onları fark etmesini zorlaştırır. Sipariş sırasına yer eklemez. Gelişmiş birimler ayrıca tamamlanmış araştırma gerektirebilir.",
    },
    HANGAR: {
      name: 'Hangar',
      tag: 'Filonun sığacağı yeri belirler',
      role: "Bu gezegenin gemilerine alan sağlar. Komuta Çekirdeği seviyesinden bağımsız yükseltilir.",
      detail: "Gemiler büyüklüğüne göre alan kullanır; görevdekiler ve onarım bekleyenler de sayılır. Yer savunmaları ayrı yer kapasitesi kullanır. Yeni gemi siparişleri ve gelen gemiler için boş alan gerekir. Hangar dolunca mevcut gemiler silinmez. Yüksek yükseltme bedelini toplamak için Depoyu büyütmen gerekebilir.",
    },
    DEUTERIUM_PLANT: {
      name: 'Döteryum Rafinerisi',
      tag: 'Döteryum üretir',
      role: "Saatlik döteryum üretimini ve depolanabilen miktarı artırır. Seviyeyi Döteryum Sentezi de sınırlar.",
      detail: "Her seviye, Havuzda üretilen döteryumu ve buna bağlı Depo kapasitesini artırır. Döteryum, uçuş yakıtıdır. Yeni yükseltme hem gezegenin Komuta Çekirdeği hem Döteryum Sentezi sınırına uymalıdır. Sentez sınırına ulaştıysan sonraki araştırma seviyesini tamamla.",
    },
  },

  instrument: {
    TELESCOPE: {
      name: 'Teleskop',
      tag: 'Uzağı okunur kılar',
      role:
        "Hareketli izleri tanımlar. 1, 3, 5 ve 7. seviyelerde sırasıyla 1, 2, 3 ve 4 sessiz gözlem yuvası sağlar.",
      roleNone:
        'Kurulabilmesi için yörüngede Anten bulunmalıdır. Uzak hareketleri tanımlar, asteroitleri keşfeder ve seçtiğin bir dünyanın filosunun evde olup olmadığını sessizce izler.',
      roleOwned:
        'Hareketleri tanıdığın alanı büyütür ve seçtiğin dünyaların filo durumunu sessizce izler. Bilgi toplar; gezegeni savunmaz.',
      detail: "Yüksek seviye, hareketleri tanımlayabildiğin menzili artırır. Bu alana giren asteroitler keşfedilir ve yok olana kadar bilinir. Gözlem yuvaları, seçilen gezegenlerin filosunun evde veya uzakta olduğunu izler; Perde netliği etkiler. Tanımlama menzili ile gözlem menzili ayrıdır. Yaklaşan saldırının varış uyarısını Teleskop değil Radar verir.",
    },
    RADAR: {
      name: 'Radar',
      tag: 'Sana geleni ayırt eder',
      role:
        "Yakındaki hareketleri ve sondaları algılar; bu gezegene yönelen saldırıları bildirir.",
      roleNone:
        'Kurulabilmesi için yörüngede Anten bulunmalıdır. Radar olmadan yaklaşan filo varış uyarısı üretmez ve sondaların çoğu fark edilmeden geçer.',
      roleOwned:
        'Çemberindeki hareketleri varış süresi olmadan algılar; bu dünyaya yönelen tehditleri ise varış süresiyle işaretler. 2. seviye yönü, 4. seviye yaklaşık büyüklüğü, 5. seviye çıkış dünyasını ve filo dökümünü gösterir.',
      detail: "1. seviye, yaklaşan saldırının varış süresini gösterir. 2. seviye yönü, 4. seviye tahmini gücü, 5. seviye çıkışı ve gemi ayrıntılarını ekler. Yüksek seviye, algılama menzilini ve sonda yakalama ihtimalini de artırır. Başka bir hareketli iz, saldırı varış uyarısı vermeyebilir.",
    },
    AEGIS: {
      name: 'Aegis',
      tag: 'Gezegeni saran kalkan',
      role: "Savunmadaki birimlerden önce hasar alır; azami dayanımının saatte %35’ini yeniler.",
      roleNone:
        'Akın hasarını gemilere ve yer savunmasına ulaşmadan önce karşılar. Kaynak harcamadan yenilenir; istihbarat sağlamaz.',
      roleOwned:
        'Akın hasarını önce kalkan karşılar. Azami dayanımının saatte %35’ini kaynak harcamadan yeniler; istihbarat sağlamaz.',
      detail: "Her seviye, azami kalkan dayanımını artırır. Aktif Aegis, savaş hasarını gemilerden ve yer savunmalarından önce alır. EMP etkisi dışında kaynak harcamadan yenilenir. Savaşabilecek birim yoksa gezegeni tek başına savunamaz. İstihbarat sağlamaz.",
    },
    VEIL: {
      name: 'Perde',
      tag: 'Teleskoptan gizler',
      role: "Rakip Teleskopların filo bilgisini almasını zorlaştırır; bu gezegendeki sonda doğruluğunu düşürebilir.",
      roleNone:
        'Rakip Teleskoplarının filo durumunu okumasını zorlaştırır ve sana gönderilen sondaların doğruluğunu düşürür. Sahte bilgi üretmez, sondayı engellemez.',
      roleOwned:
        'Rakip Teleskoplarının filo durumunu okumasını zorlaştırır ve sana gönderilen sondaların doğruluğunu düşürür. Savunma veya Radar menzili sağlamaz.',
      detail: "Yüksek seviye, daha gelişmiş Teleskoplara karşı da filo durumunu gizleyebilir. Eşit Tersane seviyesinden gönderilen sondanın doğruluğunu da düşürür. Bilgiyi gizler; sahte sonuç üretmez. Sondaları yakalamaz ve savaş gücünü artırmaz.",
    },
  },

  satellite: {
    UPLINK: {
      name: 'Anten',
      tag: 'Teleskop ve Radarı açar',
      role:
        "Bu gezegende Teleskop ve Radar kurulumunu açar; bir yörünge yuvası kullanır.",
      blurb:
        'Gezegen cihazlarını yörünge ağına bağlar. Bir yörünge yuvası karşılığında Teleskop ve Radar kurulumunu açar; çıplak göz menzilini tek başına değiştirmez.',
      detail: "Teleskop veya Radar kurmadan önce Anten kur. Her gezegende bir kez kurulur; yükseltme seviyesi yoktur. Tek başına gözlem, uyarı, üretim veya savunma sağlamaz.",
    },
    FOUNDRY: {
      name: 'Körük',
      tag: 'Saatlik üretimi artırır',
      role:
        "Bu gezegenin saatlik alaşım, kristal ve döteryum üretimini %6 artırır.",
      blurb:
        'Üretim sistemlerini yörüngeden destekler. Üç kaynağın saatlik üretimini, üretim havuzu kapasitesini ve depo kapasitesini birlikte büyütür.',
      detail: "Bonus yalnız kurulduğu gezegene uygulanır. Üretime bağlı Havuz ve Depo kapasiteleri de artar. Deponun akınlardan koruduğu miktar artmaz. Maden kapasitesi ve akın kargosu etkilenmez.",
    },
    DERRICK: {
      name: 'Matkap',
      tag: 'Madencileri güçlendirir',
      role:
        "Bu gezegenin Kazıcı ambarlarını 2 katına, Kazıcı hızını 1,5 katına çıkarır.",
      blurb:
        'Kazıcı seferlerini destekleyen bir yörünge platformudur. Daha hızlı araçlar hareketli asteroide daha erken ulaşır; büyüyen ambar her aracın daha fazla cevherle dönmesini sağlar.',
      detail: "Ambar bonusu, Kazıcı Ambarları araştırmasının büyüttüğü kapasiteye de uygulanır. Yalnız Kazıcıları etkiler. Akın kargosunu, diğer gemilerin hızını veya gezegen transferlerini değiştirmez.",
    },
    BEACON: {
      name: 'Kılavuz',
      tag: 'Filoları hızlandırır',
      role:
        "Bu gezegenden başlayan akın, transfer, ticaret ve klan yardımı hızını 1,3 katına çıkarır.",
      blurb:
        'Akın, transfer, ticaret ve klan yardımı filolarına rota desteği sağlar. Gidiş ve dönüş kısaldıkça gemilerin ev savunmasından ayrı kaldığı süre de azalır.',
      detail: "Hız bonusu, belirtilen görevlerin gidişine ve dönüşüne uygulanır. Yerleşim filoları ve Kazıcılar etkilenmez. Saldırıyı, gövde dayanımını, kargoyu veya yakıt bedelini değiştirmez.",
    },
  },

  /** Muharebeyi belirleyen üç rol, artı avı olan dördüncü. */
  combatClass: {
    SKIRMISHER: { name: 'Akıncı', tag: 'Sur’a karşı güçlü; Mızrak’a karşı zayıf' },
    BULWARK: { name: 'Sur', tag: 'Mızrak’a karşı güçlü; Akıncıya karşı zayıf' },
    LANCE: { name: 'Mızrak', tag: 'Akıncıya karşı güçlü; Sur’a karşı zayıf' },
    SUPPORT: { name: 'Destek', tag: 'Silahsız; savaş gemileri ayaktayken korunur' },
  },

  hull: {
    DART: {
      name: 'Ok',
      tag: 'Kırılgan hızlı akıncı',
      role: "Düşük bedelli Akıncı gemisidir; hızlı uçar ve gövde dayanımı düşüktür.",
      pitch: "Yüksek hızı, görevde geçirdiği süreyi azaltır. Düşük dayanımı gemi kaybı riskini artırır.",
      detail: "Ok, savaş gemilerinin en yüksek temel hızını Engerek, Kasırga ve Korsan ile paylaşır. Bu gelişmiş gemilerden ucuzdur; saldırısı ve dayanımı daha düşüktür. Hızlı akın filosu seçerken hedefin sınıflarını kontrol et.",
    },
    PIKE: {
      name: 'Kargı',
      tag: 'Giriş seviye Mızrak gemisi',
      role: "Ok ile aynı bedelde daha çok saldıran, daha az dayanan ve daha yavaş uçan Mızrak gemisidir.",
      pitch: 'Saldırısı dayanımından yüksektir; güçlü ilk salvo karşılığında daha kırılgan bir gövde alırsın.',
      detail: "Kargı, Ok ve Kirpi gibi Akıncı birimlere karşı sınıf üstünlüğü kazanır. Sur sınıfı ise ona karşı üstünlük kazanır. Yüksek saldırısı, her ters eşleşmeyi telafi etmez.",
    },
    RAMPART: {
      name: 'Sur',
      tag: 'Giriş seviye kale gemisi',
      role: "Yavaş ve dayanıklı Sur gemisidir. Muhafız ile aynı bedelde daha çok dayanır, daha az saldırır.",
      pitch: 'Mızrak ateşini iyi karşılar; Akıncı sürülerine karşı açık verir.',
      detail: "Sur gemisi, hız ve saldırı yerine dayanımı öne çıkarır. Aynı kaynak bedelindeki Muhafız daha hızlıdır. Karma filoyu yavaşlatabilir; gezegen dışındaki görevlerde yolculuk süresini karşılaştır.",
    },
    WARDEN: {
      name: 'Muhafız',
      tag: 'Hareketli refakatçi',
      role: "Sur gemisiyle aynı bedelde daha hızlı uçan ve daha çok saldıran, daha az dayanan Sur sınıfı refakatçidir.",
      pitch: 'Kale gövdesinin bir bölümünü saldırı ve filo temposuyla değiştirir.',
      detail: "Muhafız, Sur gemisine göre daha hızlı uçan bir Sur sınıfı gemidir. Nakliyecilere eşlik edebilir veya akına katılabilir. Mızrak sınıfına karşı üstünlük kazanır; Akıncı sınıfı ona karşı üstünlük kazanır.",
    },
    COURIER: {
      name: 'Kurye',
      tag: 'Hızlı hafif nakliye',
      role: "Ganimet, transfer, ticaret ve yerleşim için hızlı, silahsız başlangıç nakliyecisidir.",
      pitch: 'Kale ve Mızrak filolarına ayak uydurur; en hızlı Akıncı filolarını ise yavaşlatır.',
      detail: "Kurye, kargo kapasitesi ekler; saldırı eklemez. Savaş gemileri hayattayken onu korur. Büyük nakliyecilerden ucuz ve hızlıdır; daha az taşır. Başarılı yerleşimde gönderilen Kuryeler yeni kolonide kalır.",
    },
    VIPER: {
      name: 'Engerek',
      tag: 'Verimli akıncı',
      role: "Ok ile aynı temel hızda, daha yüksek saldırı, dayanım ve kargo sunan 2. kademe Akıncıdır.",
      pitch: "Ok ile aynı temel hızda, daha yüksek saldırı gücü ve gövde dayanımı sunar.",
      detail: "Engerek için araştırma gerekmez. Temel hızı Ok ile aynıdır. Daha pahalıdır; gemi başına saldırısı, dayanımı ve kargosu daha yüksektir. Akıncı sınıfıyla Sur birimlerine karşı üstün, Mızrak birimlerine karşı zayıftır.",
    },
    TALON: {
      name: 'Pençe',
      tag: 'Ağır taarruz gemisi',
      role: "Engerek ile aynı bedelde daha çok saldıran, daha az dayanan ve daha yavaş uçan 2. kademe Mızraktır.",
      pitch: 'Saldırısı dayanımından yüksektir; yüksek hasarı daha kırılgan bir gövdeyle dengeler.',
      detail: "Pençe, Akıncılara karşı saldırıyı öne çıkarır. Araştırma gerektirmez. Sur sınıfı ona karşı üstünlük kazanır; yalnız Pençelerden filo kurmadan önce savunmayı kontrol et.",
    },
    STRONGHOLD: {
      name: 'Hisar',
      tag: 'Ağır hat gemisi',
      role: "Nöbetçi ile aynı bedelde daha çok dayanan, daha az saldıran ve daha yavaş uçan 2. kademe Sur gemisidir.",
      pitch: 'Varış süresinden çok hayatta kalmak önemliyse sağlam bir duvar kurar.',
      detail: "Hisar, uçuş hızından önce dayanımı öne çıkarır. Evde savunabilir veya savaş filosuna katılabilir. Akıncı sınıfı ona karşı üstünlük kazanır. Düşük hızı, filonun uzakta kaldığı süreyi artırabilir.",
    },
    SENTINEL: {
      name: 'Nöbetçi',
      tag: 'İkinci seviye refakatçi',
      role: "Hisar ile aynı bedelde daha hızlı uçan ve daha çok saldıran, daha az dayanan 2. kademe Sur refakatçisidir.",
      pitch: 'Kale dayanımının bir bölümünü filo temposu ve saldırıyla değiştirir.',
      detail: "Nöbetçi, Hisardan daha hızlı bir Sur refakatçisidir. Nakliye veya akın süresini planlarken bu hız farkını kullan. Aynı kaynak bedelinde daha düşük dayanımı vardır.",
    },
    WAYFARER: {
      name: 'Seyyah',
      tag: 'Dengeli nakliye',
      role: "Kuryeden daha çok taşıyan ve daha yavaş uçan, silahsız 2. kademe nakliyecisidir.",
      pitch: 'Hızlı Kurye ile yüksek kapasiteli Atlas arasındaki orta seçenektir.',
      detail: "Seyyah; akın, transfer, ticaret ve uygun klan yardımlarında kaynak taşır. Saldırı eklemez; savaşta silahlı refakat gerekir. Kuryeleri değiştirirken büyük ambarla daha uzun yolculuğu birlikte karşılaştır.",
    },
    TEMPEST: {
      name: 'Kasırga',
      tag: 'İleri seviye hızlı akıncı',
      role: "Savaş gemilerinin en yüksek temel hızını koruyan 3. kademe Akıncıdır.",
      pitch: 'Geç oyunda yüksek hız ve verim sunar, fakat hâlâ bir hat gemisi değildir.',
      detail: "Kasırga, aşağıdaki seviyelerde Yıldız Gemisi Mühendisliği ve Gemi Gücü gerektirir. Temel hızı Ok, Engerek ve Korsan ile aynıdır. Mızrak birimleri ona karşı üstünlük kazanır; yüksek kademe bu zayıflığı kaldırmaz.",
    },
    BALLISTA: {
      name: 'Balista',
      tag: 'İleri seviye taarruz',
      role: "Kasırga ile aynı bedelde daha çok saldıran, daha az dayanan ve daha yavaş uçan 3. kademe Mızraktır.",
      pitch: 'Saldırısı dayanımından yüksektir; doğru Sur duvarına çarptığında yüksek hasarı onu kurtarmaz.',
      detail: "Balista, Yıldız Gemisi Mühendisliği ve Gemi Gücü gerektirir. Akıncılara karşı üstünlük kazanır; Sur sınıfına karşı zayıftır. Yüksek saldırılı filo için yatırım yapmadan önce güncel savunma bilgisini incele.",
    },
    LEVIATHAN: {
      name: 'Leviathan',
      tag: 'İleri seviye kale',
      role: "Praetoryen ile aynı bedelde daha çok dayanan, daha az saldıran ve daha yavaş uçan 3. kademe Sur gemisidir.",
      pitch: 'Her uçuşu uzun bir taahhüde dönüştüren geç oyun duvarıdır.',
      detail: "Leviathan, Yıldız Gemisi Mühendisliği ve Gemi Zırhı gerektirir. Uçuş hızı yerine dayanımı öne çıkarır. Akıncıların sınıf üstünlüğü devam eder; yalnız dayanım başarılı savunmayı garanti etmez.",
    },
    PRAETORIAN: {
      name: 'Praetoryen',
      tag: 'İleri seviye refakatçi',
      role: "Leviathan ile aynı bedelde daha hızlı uçan ve daha çok saldıran, daha az dayanan 3. kademe Sur refakatçisidir.",
      pitch: 'Kale dayanımının bir bölümünü saldırı ve karma filo temposuyla değiştirir.',
      detail: "Praetoryen, Yıldız Gemisi Mühendisliği ve Gemi Zırhı gerektirir. Nakliyecileri korurken veya akına katılırken Leviathandan daha hızlı seçenek sunar. Sur sınıfının üstünlükleri ve zayıflıkları aynıdır.",
    },
    ATLAS: {
      name: 'Atlas',
      tag: 'Üçüncü seviye ağır nakliye',
      role: "Seyyahtan daha çok taşıyan ve daha yavaş uçan, silahsız 3. kademe nakliyecisidir.",
      pitch: "Büyük miktarda kaynak taşır. Silahsızdır; akına gönderirken savaş gemileriyle koru.",
      detail: "Atlas, Yıldız Gemisi Mühendisliği ve Gemi İtkisi gerektirir. Hedefte kaynak varsa büyük ambarıyla daha çok yük getirebilir. Saldırı eklemez; yeterli savaş refakati bırak ve filonun son hızını kontrol et.",
    },
    NULLIFIER: {
      name: 'Söndürücü',
      tag: 'Aktif kalkanları kırar',
      role: "Aktif Aegis’e normal hasarının 5 katını veren Mızrak sınıfı uzman gemisidir.",
      pitch: "Saldırısı dayanımından yüksektir. Ek kalkan hasarı gemilere veya yer savunmalarına geçmez.",
      detail: "Söndürücü, Yıldız Gemisi Mühendisliği ve Gravitik Yükler gerektirir. Ek hasarı yalnız aktif kalkana uygulanır; gemilere veya yer savunmalarına geçmez. Kalkan bitince normal saldırısını kullanır. Gövde dayanımı, saldırı değerinden düşüktür.",
    },
    /** D200. `{{salvage}}` `SALVAGE.perCollector`'dır; `names.ts` doldurur. */
    GARBAGE_COLLECTOR: {
      name: 'Hurdacı',
      tag: 'Enkazdan {{salvage}} toplar',
      role: "Katıldığı saldırıdan sonra enkaz toplayan silahsız destek gemisidir.",
      pitch: 'Yük gemisi gibi hattın arkasında uçar, son atışları o yer. Yanında savaş gemisi tut; onlar düşünce hedef olur.',
      detail: "En az bir savaş gemisiyle gönder. Sağ kalan her Hurdacı, enkazdaki alaşım, kristal ve döteryum oranlarıyla en fazla {{salvage}} kaynak getirir. Kalan enkaz, herkese açık saha oluşturur. Normal kargo kapasitesi eklemez; savunmada kaynak toplamaz. Asteroide veya enkaz sahasına gönderilemez.",
    },
    CATACLYSM: {
      name: 'Kıyamet',
      tag: 'Başkent taarruz gemisi',
      role: "Korsan ile aynı bedelde daha çok saldıran, daha az dayanan ve daha yavaş uçan 4. kademe Mızraktır.",
      pitch: 'Saldırısı dayanımından yüksektir; güçlü salvoyu daha kırılgan gövde ve sınıf karşıları dengeler.',
      detail: "Kıyamet, Yıldız Gemisi Mühendisliği ve Gemi Gücü gerektirir. Akıncılara karşı üstünlük kazanır; Sur sınıfı ona karşı üstünlük kazanır. Yüksek saldırı, düşük dayanımı veya sınıf zayıflığını kaldırmaz.",
    },
    CORSAIR: {
      name: 'Korsan',
      tag: 'Başkent akıncı gemisi',
      role: "Surlara karşı sınıf üstünlüğü ve en yüksek temel savaş gemisi hızı olan 4. kademe Akıncıdır.",
      pitch: 'Kıyametle aynı bedelde daha hızlı ve daha dayanıklıdır; daha az saldırır ve daha küçük ambar taşır.',
      detail: "Korsan, Yıldız Gemisi Mühendisliği ve Gemi Gücü gerektirir. Temel hızı Ok, Engerek ve Kasırga ile aynıdır. Kıyamet ile aynı bedelde daha az saldırır ve daha çok dayanır. Kale gibi Surlara karşı üstün, Mızraklara karşı zayıftır.",
    },
    CITADEL: {
      name: 'Kale',
      tag: 'Başkent kale gemisi',
      role: "Palatin ile aynı bedelde daha çok dayanan, daha az saldıran ve daha yavaş uçan 4. kademe Sur gemisidir.",
      pitch: 'Oyundaki en güçlü duvarı maliyet ve uzun açıkta kalma süresiyle satın alır.',
      detail: "Kale, Yıldız Gemisi Mühendisliği ve Gemi Zırhı gerektirir. Dayanımı öne çıkarır; savaş gemilerinin en düşük temel hızındadır. Akıncılar ona karşı üstünlük kazanır. Hareketli filoda kullanırken uzun yolculuk süresini hesaba kat.",
    },
    PALADIN: {
      name: 'Palatin',
      tag: 'Başkent refakat gemisi',
      role: "Kale ile aynı bedelde daha hızlı uçan ve daha çok saldıran, daha az dayanan 4. kademe Sur refakatçisidir.",
      pitch: 'Kale gövdesinin bir bölümünü saldırı ve filo temposuna çeviren dördüncü seviye refakatçidir.',
      detail: "Palatin, Yıldız Gemisi Mühendisliği ve Gemi Zırhı gerektirir. Kaleye göre dayanımın bir kısmını hız ve saldırıyla değiştirir. Sur sınıfıyla Mızraklara karşı üstün, Akıncılara karşı zayıftır.",
    },
    ARGOSY: {
      name: 'Argosi',
      tag: 'Başkent yük gemisi',
      role: "En büyük temel ambara ve en düşük nakliyeci hızına sahip, silahsız 4. kademe gemidir.",
      pitch: "En büyük kargo kapasitesini sunar. Yavaş olduğu için filonun yolculuk süresini uzatabilir.",
      detail: "Argosi, Yıldız Gemisi Mühendisliği ve Gemi İtkisi gerektirir. Kargo ekler; saldırı eklemez. Silahlı refakat hayattayken korunur. Düşük hızı, bütün filonun yolculuğunu uzatabilir; kapasiteyle süreyi birlikte karşılaştır.",
    },
    BASTION: {
      name: 'Tabya',
      tag: 'Ağır yer topu',
      role: "Mızraklara karşı sınıf üstünlüğü olan sabit Sur sınıfı yer savunmasıdır.",
      pitch: 'Kargı, Pençe ve Söndürücü ağırlıklı saldırılara dayanır; Akıncı sınıfı filolara karşı zayıftır.',
      detail: "Tabya, gezegenden ayrılmaz; Hangar yerine yer kapasitesi kullanır. Akıncılar ona karşı üstünlük kazanır. Savaştan sonra yok edilen yer birimlerinin %60’ı aşağı yuvarlanarak ücretsiz yeniden kurulur. Yer Savunma Doktrini saldırısını ve dayanımını artırır.",
    },
    HARPOON: {
      name: 'Zıpkın', tag: 'Mızrak yer topu', role: "Akıncılara karşı sınıf üstünlüğü olan sabit Mızrak sınıfı yer savunmasıdır.",
      pitch: 'Akıncı birliklerini deler; Sur sınıfına karşı zayıftır.',
      detail: "Zıpkın, gezegenden ayrılmaz; Hangar yerine yer kapasitesi kullanır. Surlar ona karşı üstünlük kazanır. Savaştan sonra yok edilen yer birimlerinin %60’ı aşağı yuvarlanarak ücretsiz yeniden kurulur. Yer Savunma Doktrini saldırısını ve dayanımını artırır.",
    },
    THORN: {
      name: 'Kirpi',
      tag: 'Hafif yer topu',
      role: "Surlara karşı sınıf üstünlüğü olan, düşük bedelli sabit Akıncı sınıfı yer savunmasıdır.",
      pitch: 'Sur sınıfı gemilere karşı etkili, düşük maliyetli savunmadır; Mızrak sınıfına karşı zayıftır.',
      detail: "Kirpi, gezegenden ayrılmaz; Hangar yerine yer kapasitesi kullanır. Mızraklar ona karşı üstünlük kazanır. Savaştan sonra yok edilen yer birimlerinin %60’ı aşağı yuvarlanarak ücretsiz yeniden kurulur. Yer Savunma Doktrini saldırısını ve dayanımını artırır.",
    },
    PROSPECTOR: {
      name: 'Kazıcı',
      tag: 'Asteroit kazar',
      role: "Keşfedilmiş asteroitlerden ve enkaz sahalarından kaynak toplar; akın filosuna katılamaz.",
      pitch: 'Hareketli bir asteroidi yakalar, taşıyabildiği cevheri üretim havuzuna getirir. Savaş veya transfer görevi yapmaz.',
      detail: "Araştırma olmadan her gezegen iki Kazıcı tutabilir; Kazıcı Ambarları 3. seviye üçüncü yuvayı açar. Yüklü dönüş, gidiş hızının yarısında yapılır. Matkap ve Kazıcı Ambarları maden kapasitesini artırır; Matkap hızı da artırır. Kazıcılar Hangar alanı kullanır, ancak gezegen savunmasında savaşmaz.",
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
      body: 'Anten ve Radar sondaları yakalar; ilk Radar seviyesinden başlayarak çembere giren tehditleri varış süresiyle işaretler.',
    },
    EXPLORER: {
      title: 'Kâşif açıldı',
      body: "Hedefin filosu ve kaynakları hakkında bilgi almak için sonda gönder. Rapor tahmin içerebilir; hedef taramayı fark edebilir.",
    },
    VEIL: {
      title: 'Perde açıldı',
      body: 'Perde, rakip Teleskopların bu dünyadaki filo durumunu okumasını zorlaştırır.',
    },
  },
} as const;

export const gains = {
  rangeUnits: '{{count}} birim',

  core: {
    label: 'Bina seviye sınırı',
    level: 'Sv. {{level}}',
    releases_one: 'Tıkanan {{count}} yükseltmeyi açar',
    releases_other: 'Tıkanan {{count}} yükseltmeyi açar',
    raisesCap: 'Binaların ulaşabileceği seviye sınırını yükseltir',
  },
  hangar: {
    label: 'Filo alanı',
    value: '{{room}} alan',
    none: 'Hangar yok',
    ceiling: 'En üst seviyede {{room}} alana kadar',
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
    label: 'Depo derinliği',
    value: '{{store}} sa depo · {{safe}} sa korumalı',
  },
  shipyard: {
    timeLabel: "Üretim süresi",
    timeReduced: "{{percent}} azalır",
    scope: "Gemiler ve yer savunmaları için. {{from}}. seviyeden {{to}}. seviyeye yükseltme.",
    rowNote: "Her oran, bir önceki seviyeye göre hesaplanır.",
    unlocksHull: "Tersane koşulu karşılanır: {{hull}}. Araştırma da gerekebilir.",
  },

  telescope: {
    slotsLabel: 'İzleyebildiğin gezegen',
    rangeLabel: 'Görüş menzilin',
    maxed: 'En üst seviye; {{slots}} izleme yuvası ve galaksiyi boydan boya kapsayan {{range}} birim hareket görüşü',
    reachAndCooldown: '{{range}} görür, bir yuva {{hours}} saatte yeniden kurulur',
    nextSlot: 'Sonraki seviye {{ordinal}} yuvayı açar',
    ordinalSecond: '2.',
    ordinalThird: '3.',
    ordinalFourth: '4.',
    cooldown: 'Bir yuva {{hours}} saatte yeniden kurulur',
  },
  radar: {
    scansLabel: 'Taramayı yakalar',
    scansNo: 'hayır',
    scansYes: 'evet',
    scansBearing: 'evet, yönüyle birlikte',
    sweepLabel: 'Temas alanı · zamanlı uyarı',
    sweepNone: 'yok',
    reaches: '{{sense}} birim temas (varış süresi yok) · {{warn}} birim zamanlı uyarı',
    maxed: 'En üst seviye; uyarı çıkış dünyasını ve filonun tam içeriğini de gösterir',
    l1: "Sonda taramalarını fark etme ihtimalini artırır. Yaklaşan filo Radar menziline girince varış uyarısı verir.",
    bearing: '2. seviye geliş yönünü de gösterir',
    interception: "3. seviye bu dünyada önleyici şarj kurulmasını sağlar (Anten gerekir)",
    estimate: 'Yaklaşan gücün yaklaşık büyüklüğünü erkenden gösterir',
    origin: 'Uyarıda çıkış dünyasını ve filonun tam içeriğini gösterir',
  },
  aegis: {
    label: 'Azami kalkan',
    unlocks: 'Hasarı birliklerden önce karşılar; azami değerinin saatte %{{percent}}’ini yeniler',
  },
  veil: {
    label: 'Kör ettiği teleskop',
    none: 'yok',
    level: 'Sv. {{level}}',
    unlocks: 'Eşit Tersanede sondanın isabetini %{{percent}} seviyesine düşürür',
  },

  foundry: {
    label: 'Saatlik kaynak üretimi',
    now: 'mevcut üretim',
    next: '+%{{percent}}',
    unlocks: 'Bu dünyadaki alaşım, kristal ve Döteryum üretimine uygulanır',
  },
  uplink: {
    label: 'Teleskop ve Radar',
    now: 'kilitli',
    next: 'açık',
    unlocks: 'Bu dünyada Teleskop ve Radar kurulabilir',
  },
  derrick: {
    label: 'Her Kazıcının taşıdığı',
    now: '1×',
    next: '{{factor}}×',
    unlocks: 'Kazıcılar ayrıca {{factor}}× hızlanır',
  },
  beacon: {
    label: 'Akın, transfer, ticaret ve yardım filoları',
    now: 'normal hızda',
    next: '{{factor}}× hızlı',
    unlocks: 'Gidiş de dönüş de kısalır, savunman evde olmadan geçen süre azalır',
  },
  research: {
    powerLabel: 'Savaş gemisi saldırısı',
    powerScope:
      'Filondaki bütün savaş gemileri. Güç × Zırh birlikte, eşit bütçeyle savaş gücünü en fazla %56 artırır; nakliye gemileri ve yer savunması etkilenmez.',
    armorLabel: 'Gemi gövde dayanımı',
    armorScope:
      'Nakliye dâhil filondaki tüm gemiler. Güç × Zırh birlikte, eşit bütçeyle savaş gücünü en fazla %56 artırır; yer savunması etkilenmez.',
    speedLabel: 'Filo hızı',
    speedScope:
      'Filondaki tüm gemiler. Karma filo yine en yavaş üyesinin — geliştirilmiş — hızıyla uçar; Kazıcı ve sonda etkilenmez.',
    engineeringLabel: 'Gemi seviyesi erişimi',
    engineeringTier: '{{tier}}. seviye',
    engineeringScope:
      'Mühendislik I üçüncü, Mühendislik II dördüncü seviyeyi açar. Gemiler ayrıca Güç, Zırh, İtki veya Gravitik Yükler isteyebilir.',
    groundLabel: 'Yer savunması gücü',
    groundScope: 'Elindeki her dünyadaki {{bastion}}, {{harpoon}} ve {{thorn}}.',
    yardLabel: 'Gemi yapım süresi',
    robotsLabel: 'Yapı kurulum süresi',
    holdsLabel: 'Kazıcı ambarı',
    holdsScope: 'Yörüngedeki Matkap ile çarpılarak birlikte uygulanır.',
    cargoLabel: 'Akın yükü',
    cargoScope: 'Yalnız yağma — dünyalar arası transfer ve madencilik değişmez.',
    industrialLabel: 'Onarım bedeli ve süresi',
    industrialScope: "Yalnız Tamirhane — gemi üretimi değişmez.",
    refineryLabel: 'Rafineri seviye sınırı',
    stockpileLabel: "Dünya başına Ölüm Yıldızı",
    gridLabel: "Dünya başına şarj",
    /* İzin bir kapı açar; merdiven gibi çizmek olmayan bir miktar uydurmak olur. */
    opensLabel: 'Açar',
    open: 'Açık',
    shut: 'Kilitli',
    isotopeOpens: 'İzotop asteroitleri seçilebilir madencilik hedefi olur.',
    denseOpens: 'Gemi İtkisi araştırması açılır.',
    graviticOpens: 'Söndürücünün uzman araştırma koşulu karşılanır.',
  },
  plant: {
    label: 'Döteryum',
    value: '{{rate}}/sa',
    storage: 'Yakıt deposu {{now}} → {{next}}',
  },
} as const;

export const directives = {
  inboundTitle: 'Filo geliyor · {{duration}}',
  inboundDetail:
    "Açıkta kalan kaynakları harcayabilir, filonu gönderebilir veya savunmayı güçlendirebilirsin. Havadaki gemiler bu gezegeni savunamaz.",
  inboundAction: 'Hemen harca',

  undefendedTitle: 'Bu gezegende yer savunması yok',
  undefendedShieldedTitle: 'Kalkanın {{duration}} sonra biter: yer savunması kur',
  undefendedDetail:
    '{{amount}} kaynak akına açık. Kalıcı savunma için Kirpi veya Tabya kurabilirsin.',
  undefendedAction: 'Savunma kur',

  exposedTitle: 'Senden {{amount}} alınabilir',
  exposedDetail: "Depo şu an {{now}} kaynağı yağmadan korur. Sonraki seviye {{next}} kaynağı korur.",
  exposedAction: "Depoyu yükselt",

  scannedTitle_one: 'Biri seni taradı',
  scannedTitle_other: 'Sana karşı {{count}} tarama',
  scannedDetail:
    'Elindeki kaynakları ve savunmayı öğrenmeye çalışıyorlar. Perde, sondanın aldığı bilgiyi eksiltir.',
  scannedAction: 'Kayda bak',

  windowTitle: '{{name}} gezegeninin filosu dışarıda',
  windowDetailUnknownJustNow: 'Az önce gördün. Ne zaman döneceğini bilmiyorsun.',
  windowDetailUnknown: '{{age}} önce gördün. Ne zaman döneceğini bilmiyorsun.',
  windowDetailEta:
    'Filo yaklaşık {{duration}} sonra dönüyor. O zamana kadar yalnız evde kalan birlikler savunabilir.',
  windowAction: 'Fırsatı değerlendir',

  storageFullTitle: '{{amount}} toplanamıyor',
  storageFullDetail: 'Depon dolu, havuz boşalacak yer bulamıyor. Kaynak harcayıp depoda yer aç.',
  storageFullAction: 'Harca',

  noTelescopeTitle: 'Yalnızca çıplak göz mesafesini görüyorsun',
  noTelescopeDetail:
    'Ücretsiz görüşün yakından geçen bir asteroidi zaten keşfedebilir. Teleskop bu keşif alanını büyütür, uzaktaki araçları tanır ve bir gezegeni sessizce izleyip filosu kalktığında sana söyler.',
  noTelescopeAction: 'Teleskop kur',

  noRadarTitle: 'Buraya bir filo habersiz inebilir',
  noRadarDetail:
    'İlk Radar seviyesi bile çemberine giren ve bu dünyaya yönelen filoyu varış süresiyle işaretler. Sonraki seviyeler menzili ve açıklanan bilgiyi artırır.',
  noRadarAction: 'Radara bak',

  coreCeilingTitle: 'Komuta Çekirdeği {{count}} yükseltmeyi tıkıyor',
  coreCeilingDetail: "Komuta Çekirdeği, Hangar dışındaki binaların seviye sınırını belirler. Sınıra ulaşan binayı geliştirmek için önce Çekirdeği yükselt.",
  coreCeilingAction: 'Çekirdeği yükselt',

  idleTitle: 'Devam eden uçuş yok',
  idleDetailHasShips: 'Rampaların boş. Akın, transfer veya madencilik görevi başlatabilirsin; sondalar rampa kullanmaz.',
  idleDetailNoShips: 'Evde gemin yok. Ya yenisini yap ya da dışarıdakilerin dönmesini bekle.',
  idleAction: 'Hedef bul',

  baysFreeTitle_one: 'Bir rampa hâlâ boş',
  baysFreeTitle_other: '{{count}} rampa hâlâ boş',
  baysFreeDetail: 'Akınlar, transferler ve madencilik seferleri bir rampa kullanır; sondalar kullanmaz.',
  baysFreeAction: 'Etrafa bak',

  kindThreat: 'Tehdit',
  kindOpportunity: 'Fırsat',
  kindGrowth: 'Açık',
  kindIdle: 'Bekleyen yok',

  /** The fold. One word each way: the card is small enough that a label is the control. */
  hide: 'Gizle',
  show: 'Göster',
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
  dockedClause_one: "{{count}} gemi Tamirhaneye",
  dockedClause_other: "{{count}} gemi Tamirhaneye",
  patchedClause_one: "{{count}} gemi ücretsiz onarıldı",
  patchedClause_other: "{{count}} gemi ücretsiz onarıldı",
  damagedClause_one: "{{count}} gemi hasarlı dönüyor",
  damagedClause_other: "{{count}} gemi hasarlı dönüyor",
  radiationLostAll_one: "{{way}} radyasyon gemini yok etti",
  radiationLostAll_other: "{{way}} radyasyon {{count}} geminin tamamını yok etti",
  radiationLost_one: "{{way}} radyasyon {{count}} gemini yok etti · {{left}} gemi yola devam etti",
  radiationLost_other: "{{way}} radyasyon {{count}} gemini yok etti · {{left}} gemi yola devam etti",
  radiationWay: "Yolda",
  radiationWayTo: "{{name}} yolunda",
  raidedNothing: 'Akın yedin · eli boş döndüler',
  /** Taktik geri çekilme, savunan: gemiler kaçtı ya da yakıt yetmedi. */
  raidedEscaped_one: '{{count}} gemin kaçtı',
  raidedEscaped_other: '{{count}} gemin kaçtı',
  raidedStranded_one: 'yakıt yetmedi, {{count}} gemin kaçamadı',
  raidedStranded_other: 'yakıt yetmedi, {{count}} gemin kaçamadı',
  /** Taktik geri çekilme, saldıran: hat boşaldı — ne tuttuğuna dair hiçbir şey. */
  raidTargetFled: 'gemileri kaçtı',

  raidResultFallback: 'Akının sonuçlandı.',
  raidWiped: '{{target}} dayandı. Filon yok edildi, {{count}} gemi kayıp',
  raidResult: '{{target}} üzerinde {{grade}} · {{detail}} · {{count}} gemi kayıp',
  raidNothing: 'eli boş döndün',
  spoilAlloy: '+{{amount}} alaşım',
  spoilCrystal: '+{{amount}} kristal',
  spoilDeuterium: '+{{amount}} Döteryum',
  spoilSalvage: '+{{amount}} hurda',

  fleetFallback: 'Filon evde.',
  fleetHomeLooted: 'Filo evde{{where}} · {{count}} gemi · +{{amount}} ganimet',
  fleetHomeEmpty: 'Filo evde{{where}} · {{count}} gemi · eli boş',
  fleetHomeRecalled: 'Filo evde{{where}} · {{count}} gemi · saldırmadan geri çağrıldı',
  fleetHomeBare: 'Filo evde{{where}} · {{count}} gemi',
  /**
   * THE MERCHANT'S OWN HOMECOMING. D166.
   *
   * A swap is not a raid, so it never borrows the plunder wording — and a
   * convoy that bought nothing is a different fact from a fleet that found
   * nothing, which is why the empty case has its own line.
   */
  tradeHome: 'Konvoy evde · {{count}} gemi · {{landed}} alındı',
  tradeHomeEmpty: 'Konvoy evde · {{count}} gemi · alım yok',
  /**
   * THE PIRATE LANE HAS ITS OWN HOMECOMING AND ITS OWN EMPTY TRIP. D177.
   *
   * A pirate is not a commander: there is no world to come back FROM by name
   * and no ledger that moved, so these never borrow the raid's wording. And a
   * flight that arrived at nothing is a different fact from one that fought and
   * lost — it names what was gone and how many craft are turning back, and never
   * who got there first.
   */
  targetGonePirate: 'Korsan {{callsign}} çoktan yok edilmiş · {{count}} gemi geri dönüyor',
  targetGoneAsteroid: 'Asteroit sen varmadan tükendi · {{count}} kazıcı geri dönüyor',
  targetGoneDebris: 'Enkaz sahası çoktan toplanmış · {{count}} kazıcı geri dönüyor',
  pirateHome: 'Akın filosu evde · {{count}} gemi · +{{amount}} ganimet',
  pirateHomeEmpty: 'Akın filosu evde · {{count}} gemi · eli boş',
  pirateHomeRecalled: "Akın filosu evde · {{count}} gemi · çatışmadan önce geri çağrıldı",
  pirateHomeBare: 'Akın filosu evde · {{count}} gemi',
  pirateHomeTowed_looted: 'Akın filosu evde · {{count}} gemi · +{{amount}} ganimet · {{hull}} ele geçirildi',
  pirateHomeTowed_empty: 'Akın filosu evde · {{count}} gemi · {{hull}} ele geçirildi',
  fleetFrom: ' ({{origin}} dönüşü)',
  probeLost: 'Sondan kayboldu. O uçuş tamamlanamadı',
  recalled: '{{count}} araç geri döndü. O uçuş tamamlanamadı',
  miningRecalledHome: '{{count}} Kazıcı evde · geri çağırma tamamlandı',
  transferReturningCapacity: '{{target}} transferi geri dönüyor · hedef kapasitesi yoldayken doldu',
  transferReturningOwnership: '{{target}} transferi geri dönüyor · gezegen yoldayken el değiştirdi',

  salvageWord: 'Hurda',
  oreWord: 'Cevher',
  haulWasted: '{{what}} geldi ama havuzda yer yoktu · {{amount}} kaybedildi',
  haulNothing: '{{what}} seferi eli boş döndü',
  haulPartly: '{{what}} geldi · {{landed}} · havuz dolu olduğu için {{amount}} kayboldu',
  haul: '{{what}} geldi · {{landed}}',

  scanDetected: 'Tarama yakalandı. Biri kaynaklarını ve savunmanı öğrenmeye çalışıyor.',

  probeFallback: 'Sonda döndü, raporu hazır.',
  probeHome: 'Sonda döndü · {{target}} artık okunabilir{{caught}}',
  probeCaught: ' · sondayı yakaladılar',

  unlock: '{{title}} — {{body}}',
  deathStarFallback: 'Ölüm Yıldızı darben sonuçlandı.',
  deathStar: {
    FIRST_STRIKE: 'EMP darbesi · Aegis sıfırlandı; yer savunmaları 1 saat kapalı',
    CAPTURED: 'Ölüm Yıldızı darbesi · koloni ele geçirildi',
    INEFFECTIVE: 'Ölüm Yıldızı darbesi · etkisiz kaldı',
  },
  colonyCaptured: 'Koloni kuruldu · işgal koruması aktif',
  colonyAbandoned: "{{planet}} kolonisini terk ettin · gezegen artık tarafsız",
  colonyAbandonedUnnamed: "Bir koloniyi terk ettin · gezegen artık tarafsız",
  colonyLost: "{{planet}} koptu ve tarafsız oldu",
  colonyLostUnnamed: "Bir koloni koptu ve tarafsız oldu",
  deathStarColony: "EMP darbesi · koloni sadakati %{{before}} → %{{after}}",
  deathStarSeceded: "EMP darbesi · koloni koptu ve tarafsız oldu",
  colonyFault: '{{planet}} · {{fault}}',
  colonyLoyalty: '{{planet}} elden gidiyor — {{count}} şey bozuk, {{time}} içinde bağımsızlığını ilan ediyor.',
  settlementLost: 'Yerleşim yarışı kaybedildi · Kuryeler ve kuruluş yükü geri dönüyor',
  interceptedDefended: 'Savunma ağın bir Ölüm Yıldızı’nı {{range}} birim uzakta imha etti.',
  interceptedLost: 'Ölüm Yıldızı’n hedefine {{range}} birim kala imha edildi.',
  interceptedFallback: 'Bir Ölüm Yıldızı uçuş hâlinde imha edildi.',
  asteroidShowerStarted: 'Galakside asteroid yağmuru başladı.',
  asteroidShowerEnded: 'Asteroid yağmuru bitti. Yeni asteroid oluşma hızı normale döndü.',
  tradeShipStarted: 'Galakside bir ticaret gemisi var · {{alloy}} alaşım = 1 döteryum.',
  tradeShipEnded: 'Ticaret gemisi galaksiden ayrıldı.',
  intergalacticConvoyStarted: 'Galaksilerarası Konvoy galaksiyi geçiyor.',
  intergalacticConvoyEnded: 'Galaksilerarası Konvoy galaksiden ayrıldı.',
  intergalacticConvoyResult: 'Konvoy akını sonuçlandı · {{resources}} · ganimet: {{ships}} · dönüşte.',
  intergalacticConvoyHome: 'Konvoy akını döndü · {{resources}} · ganimet: {{ships}}.',
  intergalacticConvoyNoResources: 'kaynak yok',
  intergalacticConvoyNoShip: 'gemi yok',
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
  imminent: 'birazdan',
  todayAt: 'Bugün {{time}}',
  yesterdayAt: 'Dün {{time}}',
  hoursMinutes: '{{h}} sa {{m}} dk',
  minutesSeconds: '{{m}} dk {{s}} sn',
  hoursMinutesSeconds: '{{h}} sa {{m}} dk {{s}} sn',
  seconds: '{{s}} sn',
  daysHours: '{{d}} g {{h}} sa',
  minutes: '{{m}} dk',
  numberLocale: 'tr-TR',
  thousands: '{{value}}b',
  millions: '{{value}}M',
  percent: '%{{value}}',
  rangeJoin: '–',
  plus: '+',
  minus: '−',
} as const;
