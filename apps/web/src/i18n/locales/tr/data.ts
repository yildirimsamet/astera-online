/**
 * ADI OLAN ŞEYLER VE OYUNUN ONLAR HAKKINDA KURDUĞU CÜMLELER.
 *
 * GEMİ ADLARI ÇEVRİLMEDİ, TÜRKÇE KARŞILIĞI KONULDU. Bunlar özel isim gibi durur
 * ama aslında sınıf adıdır: "Dart" bir oyuncuya ucuz, hızlı ve sürü hâlinde
 * demektir. Türkçe okuyan biri bunu "Dart"tan çıkaramaz, "Ok"dan çıkarır.
 * Seçimler sözlük karşılığı değil, Türkçede aynı askerî tınıyı veren adlar:
 *
 *   Dart → Ok · Lance → Mızrak · Bulwark → Siper · Courier → Kurye
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
      role: 'Binaların ulaşabileceği en yüksek seviyeyi, inşa hızını ve gezegen kapasitesini belirler.',
      detail: 'Hiçbir bina Komuta Çekirdeğinden daha yüksek seviyeye çıkamaz. Her yükseltme bina ve araştırma sürelerini kısaltır; belirli seviyelerde yeni yörünge yuvaları ve uçuş rampaları açar, yer savunması kapasitesini büyütür. Doğrudan kaynak veya savaş gücü üretmez.',
    },
    REFINERY: {
      name: 'Alaşım Rafinerisi',
      tag: 'Alaşım üretir',
      role: 'Saatlik alaşım üretimini ve alaşım deposunun kapasitesini artırır.',
      detail: 'Her seviye, havuzda biriken saatlik alaşımı ve depoya sığan toplam alaşımı artırır. Alaşım; binaların, gemilerin ve savunmaların temel girdisidir. Üretim arttıkça yeni siparişler için gereken kaynak daha kısa sürede birikir.',
    },
    EXTRACTOR: {
      name: 'Kristal Ocağı',
      tag: 'Kristal üretir',
      role: 'Saatlik kristal üretimini ve kristal deposunun kapasitesini artırır.',
      detail: 'Her seviye, havuzda biriken saatlik kristali ve depoya sığan toplam kristali artırır. Kristal özellikle gelişmiş gemilerde, gezegen cihazlarında ve araştırmalarda kullanılır; bu nedenle üretim artışı ileri gelişim adımlarını hızlandırır.',
    },
    VAULT: {
      name: 'Kasa',
      tag: 'Akına karşı korur',
      role: 'Kaynaklarının bir bölümünü akınlardan korur ve depo kapasitesini büyütür.',
      detail: 'Kasa, her kaynak için akınların erişemeyeceği korumalı miktarı ve toplam depo kapasitesini artırır. Saldırgan yalnız koruma sınırının üstünde kalan kaynakları yağmalayabilir. Kasa çatışmaya katılmaz ve gelen hasarı azaltmaz.',
    },
    SHIPYARD: {
      name: 'Tersane',
      tag: 'Yeni gemileri açar',
      role: 'Yeni gemileri açar; gemi ve yer savunması üretimini hızlandırır, sondalarını geliştirir.',
      detail: 'Seviye yükseldikçe yeni gemi sınıfları açılır; gemiler ve yer savunmaları daha kısa sürede tamamlanır. Yüksek Tersane seviyesi sondalarının daha doğru bilgi toplamasını ve rakip Radarlarına daha zor yakalanmasını sağlar. Hangar kapasitesini veya üretim sırası uzunluğunu artırmaz.',
    },
    DEUTERIUM_PLANT: {
      name: 'Döteryum Rafinerisi',
      tag: 'Döteryum üretir',
      role: 'Saatlik Döteryum üretimini ve Döteryum deposunun kapasitesini artırır; seviye sınırını Döteryum Sentezi belirler.',
      detail: 'Her seviye, filo uçuşlarında harcanan Döteryumun saatlik üretimini ve depoya sığan miktarını artırır. Yapabileceğin Rafineri seviyesi, Komuta Çekirdeğinin yanında Döteryum Sentezi araştırmana da bağlıdır; sınırdaysan araştırmayı bir kademe ilerletmelisin.',
    },
    HANGAR: {
      name: 'Hangar',
      tag: 'Filonun sığacağı yeri belirler',
      role: 'Bu dünyaya bağlı hareketli gemilerin toplam kapasitesini belirler.',
      detail: 'Her hareketli gemi, maliyetinden türetilen büyüklüğü kadar Hangar alanı kullanır. Uçuşta olan gemiler de çıkış dünyalarının kapasitesinde sayılmaya devam eder. Yeni sipariş ancak tamamlandığında bütün gemiler Hangara sığacaksa verilebilir.',
    },
  },

  instrument: {
    TELESCOPE: {
      name: 'Teleskop',
      tag: 'Uzağı okunur kılar',
      role:
        'Görüş alanındaki hareketleri tanımlar; 1, 3 ve 5. seviyelerde bir, iki ve üç izleme yuvası sağlar.',
      roleNone:
        'Kurulabilmesi için yörüngede Anten bulunmalıdır. Uzak hareketleri tanımlar, asteroitleri keşfeder ve seçtiğin bir dünyanın filosunun evde olup olmadığını sessizce izler.',
      roleOwned:
        'Hareketleri tanıdığın alanı büyütür ve seçtiğin dünyaların filo durumunu sessizce izler. Bilgi toplar; gezegeni savunmaz.',
      detail: 'Her seviye hareketleri tanımlayabildiğin menzili büyütür. Bu alana giren asteroitler keşfedilir ve yok olana kadar haritada kalır. 1, 3 ve 5. seviyeler sırasıyla bir, iki ve üç izleme yuvası verir. Teleskop, sana yönelen filolar için varış uyarısı üretmez; bu Radarın görevidir.',
    },
    RADAR: {
      name: 'Radar',
      tag: 'Sana geleni ayırt eder',
      role:
        'Çemberindeki hareketleri algılar, sondaları yakalama ihtimalini artırır ve bu dünyaya yönelen tehditleri varış süresiyle gösterir.',
      roleNone:
        'Kurulabilmesi için yörüngede Anten bulunmalıdır. Radar olmadan yaklaşan filo varış uyarısı üretmez ve sondaların çoğu fark edilmeden geçer.',
      roleOwned:
        'Çemberindeki hareketleri varış süresi olmadan algılar; bu dünyaya yönelen tehditleri ise varış süresiyle işaretler. 2. seviye yönü, 4. seviye yaklaşık büyüklüğü, 5. seviye çıkış dünyasını ve filo dökümünü gösterir.',
      detail: 'Her Radar seviyesi temas ve zamanlı uyarı çemberini genişletir, sondaları yakalama ihtimalini artırır. İlk seviye yaklaşan filoyu ve varış süresini gösterir; 2. seviye geliş yönünü, 4. seviye yaklaşık gücü, 5. seviye çıkış dünyasını ve filodaki gemileri açar. Bu dünyaya yönelmeyen hareketler algılanır ancak varış süresi taşımaz. Önleme Ağı, stratejik silahlara ancak Radar 3 veya üstünde ateş edebilir.',
    },
    AEGIS: {
      name: 'Aegis',
      tag: 'Gezegeni saran kalkan',
      role: 'Birliklerden önce hasar alan gezegen kalkanıdır; azami dayanımının saatte %35’ini yeniler.',
      roleNone:
        'Akın hasarını gemilere ve yer savunmasına ulaşmadan önce karşılar. Kaynak harcamadan yenilenir; istihbarat sağlamaz ve stratejik silahları durdurmaz.',
      roleOwned:
        'Akın hasarını önce kalkan karşılar. Azami dayanımının saatte %35’ini kaynak harcamadan yeniler; istihbarat sağlamaz ve stratejik silahları durdurmaz.',
      detail: 'Her seviye kalkanın azami dayanımını artırır. Çatışmada hasar önce Aegis’ten düşer, kalkan bittikten sonra gemilere ve yer savunmasına geçer. Kalkan azami değerinin saatte %35’i kadar yenilenir. Aegis bilgi toplamaz; Ölüm Yıldızı’nı durdurmak için Önleme Ağı gerekir.',
    },
    VEIL: {
      name: 'Perde',
      tag: 'Teleskoptan gizler',
      role: 'Rakip Teleskopların bu dünyadaki filo durumunu okumasını zorlaştırır.',
      roleNone:
        'Rakip Teleskoplarının filo durumunu okumasını zorlaştırır ve sana gönderilen sondaların doğruluğunu düşürür. Sahte bilgi üretmez, sondayı engellemez.',
      roleOwned:
        'Rakip Teleskoplarının filo durumunu okumasını zorlaştırır ve sana gönderilen sondaların doğruluğunu düşürür. Savunma veya Radar menzili sağlamaz.',
      detail: 'Perde seviyesi yükseldikçe daha gelişmiş Teleskopların bu dünyadaki filo durumunu okuması zorlaşır. Ayrıca eşit Tersane seviyesine sahip bir rakibin sonda doğruluğunu düşürür. Perde yalnız bilgiyi gizler; sahte sonuç üretmez, sondaları yakalamaz ve çatışma gücü vermez.',
    },
  },

  satellite: {
    UPLINK: {
      name: 'Anten',
      tag: 'Teleskop ve Radarı açar',
      role:
        'Bu dünyada Teleskop ve Radar kurabilmenin ön koşuludur. Kaynak üretmez ve savunmaya katılmaz.',
      blurb:
        'Gezegen cihazlarını yörünge ağına bağlar. Bir yörünge yuvası karşılığında Teleskop ve Radar kurulumunu açar; çıplak göz menzilini tek başına değiştirmez.',
      detail: 'Bir kez kurulduğunda bu dünyada Teleskop ve Radar inşa edebilmeni sağlar. Bir yörünge yuvası kullanır; kendi seviyesi yoktur.',
    },
    FOUNDRY: {
      name: 'Körük',
      tag: 'Saatlik üretimi artırır',
      role:
        'Bu dünyanın saatlik alaşım, kristal ve Döteryum üretimini %6 artırır.',
      blurb:
        'Üretim sistemlerini yörüngeden destekler. Üç kaynağın saatlik üretimini, üretim havuzu kapasitesini ve depo kapasitesini birlikte büyütür.',
      detail: 'Körük, yalnız kurulduğu dünyanın saatlik alaşım, kristal ve Döteryum üretimini %6 artırır. Üretim hızına bağlı havuz ve depo kapasiteleri de aynı oranda yükselir; Kasanın koruduğu miktar değişmez. Kazıcı ambarını ve akın ganimetini artırmaz.',
    },
    DERRICK: {
      name: 'Matkap',
      tag: 'Madencileri güçlendirir',
      role:
        'Bu dünyadan kalkan Kazıcıların hızını 1,5 katına, taşıma kapasitesini 2,6 katına çıkarır.',
      blurb:
        'Kazıcı seferlerini destekleyen bir yörünge platformudur. Daha hızlı araçlar hareketli asteroide daha erken ulaşır; büyüyen ambar her aracın daha fazla cevherle dönmesini sağlar.',
      detail: 'Matkap, bu dünyadan kalkan Kazıcıların hızını 1,5 katına, taban ambarını 2,6 katına çıkarır. Kazıcı Ambarları araştırmasının artışı bunun üzerine uygulanır. Akın ganimetini, diğer gemilerin hızını ve dünyalar arası transferleri etkilemez.',
    },
    BEACON: {
      name: 'Kılavuz',
      tag: 'Filoları hızlandırır',
      role:
        'Bu dünyadan kalkan akın ve transfer filolarının gidiş ve dönüş hızını 1,3 katına çıkarır.',
      blurb:
        'Akın ve transfer filolarına rota desteği sağlar. Gidiş ve dönüş kısaldıkça gemilerin ev savunmasından ayrı kaldığı süre de azalır.',
      detail: 'Kılavuz, bu dünyadan başlayan akın ve transfer filolarını gidişte ve dönüşte 1,3 kat hızlandırır. Kazıcıları veya Ölüm Yıldızı’nı hızlandırmaz; saldırı, gövde dayanımı, ambar ve yakıt maliyeti değişmez.',
    },
  },

  hull: {
    DART: {
      name: 'Ok',
      tag: 'Kırılgan hızlı akıncı',
      role: 'Giriş seviyesindeki en hızlı savaş gövdesidir; dayanım yerine kısa görev süresi sunar.',
      pitch: 'Hızla vurup döner, fakat yoğun ateş altında çabuk dağılır.',
      detail: 'Ok, kısa akınlar ve ağır gövdelere karşı hızlı karşılık vermek için tasarlanmış ucuz bir Çevik sınıf gemidir. Hızı ev savunmasının dışarıda kaldığı süreyi azaltır; ince gövdesi ise yanlış istihbaratı pahalıya çevirir.',
    },
    PIKE: {
      name: 'Kargı',
      tag: 'Giriş seviye taarruz gemisi',
      role: 'Bedeline göre yüksek saldırı üretir; dayanıklı Siper sınıfı hedeflere karşı verimsizdir.',
      pitch: 'Kaynağının büyük bölümünü hayatta kalmaya değil hasara ayırır.',
      detail: 'Kargı, Çevik gemileri ve Kirpileri avlayan Mızrak sınıfı bir saldırı gövdesidir. Sur ve Tabya doğal karşılığıdır; bu yüzden yalnız Kargıdan oluşan bir filonun rakip tarafından okunabilir ve etkili bir cevabı vardır.',
    },
    RAMPART: {
      name: 'Sur',
      tag: 'Giriş seviye kale gemisi',
      role: 'Ucuz dayanıklılık sağlar, fakat bulunduğu bütün filonun uçuşunu yavaşlatır.',
      pitch: 'Mızrak ateşini iyi karşılar; Çevik sürülere karşı açık verir.',
      detail: 'Sur, saldırı yerine gövde dayanımına yatırım yapan yavaş bir Siper sınıfı hat gemisidir. Yolculuk süresinin önemsiz, filonun ayakta kalmasının önemli olduğu kuşatma ve savunma görevlerinde değer kazanır.',
    },
    WARDEN: {
      name: 'Muhafız',
      tag: 'Hareketli refakatçi',
      role: 'Sur kadar yavaşlamadan karma filolara dengeli koruma sağlar.',
      pitch: 'Kale gövdesinden daha az dayanır; karşılığında hız ve saldırı kazanır.',
      detail: 'Muhafız, en yavaş uçuş profilini kabul etmeden koruma isteyen filolar için giriş seviyesinde bir Siper refakatçisidir. Sur daha sağlam ve ucuz bir duvar olarak kalırken Muhafız tempo isteyen karma filolarda yer bulur.',
    },
    COURIER: {
      name: 'Kurye',
      tag: 'Hızlı hafif nakliye',
      role: 'Giriş seviyesi yük gemisidir; hızlı, hafif korumalı ve silahsızdır.',
      pitch: 'Hızlı akınları yavaşlatmaz, ancak daha az taşır ve refakat ister.',
      detail: 'Kurye; ganimet, barışçıl transfer ve yerleşim görevlerinde kullanılan bir destek gövdesidir. Hasar vermez ve yalnız savaş gemileri hayattayken korunur. Düşük hacimli hızlı rotalarda üst seviye nakliye gemilerinden daha çevik ve ucuzdur.',
    },
    VIPER: {
      name: 'Engerek',
      tag: 'Verimli akıncı',
      role: 'Okun hız planını korurken ikinci seviyede daha iyi dayanım sunar.',
      pitch: 'Hızlı filo fikrini sürdürür ve kırılganlık bedelini biraz azaltır.',
      detail: 'Engerek araştırma istemeyen ikinci seviye bir Çevik gemidir. Ok daha ucuz ve daha hızlı kalır; Engerek ise daha büyük bir yatırımı eşit maliyette daha iyi savaş verimine ve hata payına dönüştürür.',
    },
    TALON: {
      name: 'Pençe',
      tag: 'Ağır taarruz gemisi',
      role: 'Orta hızda, ikinci seviyeye ait saldırı odaklı bir Mızrak gövdesidir.',
      pitch: 'Kargının ucuz rolünü silmeden daha verimli yoğun hasar üretir.',
      detail: 'Pençe, gelişmiş tersanelerin saldırı gemisidir. Daha yüksek verimi yanlış hedef seçimini telafi etmez; Siper sınıfı doğal karşılar seviye üstünlüğünden daha belirleyici olmaya devam eder.',
    },
    STRONGHOLD: {
      name: 'Hisar',
      tag: 'Ağır hat gemisi',
      role: 'İkinci seviyenin en yüksek dayanımını sunar; ağır, yavaş ve pahalıdır.',
      pitch: 'Varış süresinden çok hayatta kalmak önemliyse sağlam bir duvar kurar.',
      detail: 'Hisar, kale profiline sahip bir Siper gövdesidir. Yüksek dayanımı filonun hattını sabitler; buna karşılık uzun uçuş süresi ve Çevik sınıf karşıları rakibe açık ve kullanılabilir cevaplar bırakır.',
    },
    SENTINEL: {
      name: 'Nöbetçi',
      tag: 'İkinci seviye refakatçi',
      role: 'Karma filolar için daha hızlı ve saldırgan bir savunma refakatçisidir.',
      pitch: 'Kale dayanımının bir bölümünü filo temposu ve saldırıyla değiştirir.',
      detail: 'Nöbetçi, nakliye gemilerini Hisarın ağır uçuş profiline mahkûm etmeden koruyan hareketli bir Siper gövdesidir. Saf kuşatmada Hisar, hızlı karma görevlerde Nöbetçi daha anlamlıdır.',
    },
    WAYFARER: {
      name: 'Seyyah',
      tag: 'Dengeli nakliye',
      role: 'Kuryeden daha çok taşır; biraz yavaşlasa da farklı görevlere uyum sağlar.',
      pitch: 'Hızlı Kurye ile yüksek kapasiteli Atlas arasındaki orta seçenektir.',
      detail: 'Seyyah, daha büyük akınlar ve dünyalar arası transferler için ikinci seviye bir destek gemisidir. Silahsız kalır ve savaş refakatine bağımlıdır; Kurye ise küçük ve hızlı görevlerde değerini korur.',
    },
    TEMPEST: {
      name: 'Kasırga',
      tag: 'İleri seviye hızlı akıncı',
      role: 'Araştırmayla açılan ve savaş gemileri içinde hız tavanını belirleyen Çevik gövdedir.',
      pitch: 'Geç oyunda yüksek hız ve verim sunar, fakat hâlâ bir hat gemisi değildir.',
      detail: 'Kasırga, Yıldız Gemisi Mühendisliği ve Gemi Gücü gerektiren ileri seviye bir akıncıdır. Kırılgan profilini koruduğu için alt seviye duvarlar ve doğru sınıf karşıları anlamını yitirmez.',
    },
    BALLISTA: {
      name: 'Balista',
      tag: 'İleri seviye taarruz',
      role: 'Araştırmayla açılan Mızrak sınıfında yoğun ve ağır saldırı sağlar.',
      pitch: 'Doğru duvarla karşılaştığında hâlâ kırılan yüksek hasarlı bir seçimdir.',
      detail: 'Balista, Yıldız Gemisi Mühendisliği ve Gemi Gücü isteyen üçüncü seviye bir saldırı gövdesidir. Kör tek tip üretimi değil, hedef hakkında doğru bilgi edinip uygun filoyu kurmayı ödüllendirir.',
    },
    LEVIATHAN: {
      name: 'Leviathan',
      tag: 'İleri seviye kale',
      role: 'Çok yüksek hat dayanımını düşük hız ve uzun görev süresi karşılığında verir.',
      pitch: 'Her uçuşu uzun bir taahhüde dönüştüren geç oyun duvarıdır.',
      detail: 'Leviathan, Yıldız Gemisi Mühendisliği ve Gemi Zırhı ile açılan üçüncü seviye bir kaledir. Çok güçlü gövdesine rağmen Çevik sınıf gemiler hâlâ ona karşı en verimli cevaptır.',
    },
    PRAETORIAN: {
      name: 'Praetoryen',
      tag: 'İleri seviye refakatçi',
      role: 'Değerli karma filolar için dayanıklı ve hareketli koruma sağlar.',
      pitch: 'Leviathandan az dayanır, karşılığında karma filo temposunu korur.',
      detail: 'Praetoryen, Yıldız Gemisi Mühendisliği ve Gemi Zırhı isteyen üçüncü seviye Siper refakatçisidir. Yük gemilerini korurken filoyu mümkün olan en yavaş tercihe dönüştürmez.',
    },
    ATLAS: {
      name: 'Atlas',
      tag: 'Azami yük kapasitesi',
      role: 'En büyük ambara sahip, yavaş, hacimli ve araştırmaya bağlı nakliye gemisidir.',
      pitch: 'Rota yeterince güvenliyse en iyi kapasite verimini sağlar.',
      detail: 'Atlas, Yıldız Gemisi Mühendisliği ve Gemi İtkisi ile açılan üçüncü seviye destek gemisidir. Hasar vermez ve düşük hızı nedeniyle değerli yükü için refakat ile rota güvenliği planını zorunlu kılar.',
    },
    NULLIFIER: {
      name: 'Söndürücü',
      tag: 'Aktif kalkanları kırar',
      role: 'Aktif kalkan üzerinde normal etkisinin beş katını üreten Mızrak uzmanıdır.',
      pitch: 'Aegis’i ezer; uzmanlık hasarı gemi veya yer savunmasına taşmaz.',
      detail: 'Söndürücünün uzmanlık yükü aktif Aegis’e normal etkinin beş katını uygular. Kalkan düştüğünde artan özel hasar gemilere veya toplara geçmez; bu yüzden kalkansız hedefler pahalı uzmanlığını boşa çıkarır.',
    },
    CATACLYSM: {
      name: 'Kıyamet',
      tag: 'Başkent taarruz gemisi',
      role: 'Dördüncü seviyenin saldırı zirvesidir; güçlü, pahalı ve bilinçli olarak yavaştır.',
      pitch: 'Sınıf karşılarına bağışıklık kazanmadan olağanüstü yoğun hasar üretir.',
      detail: 'Kıyamet; Mühendislik, Güç ve Zırh araştırmalarının arkasındaki başkent tipi Mızrak gövdesidir. Verimi yüksektir, ancak doğru Siper savunması onu kopyalamaktan hâlâ daha iyi bir cevaptır.',
    },
    CITADEL: {
      name: 'Kale',
      tag: 'Başkent kale gemisi',
      role: 'Dördüncü seviyenin dayanım zirvesi ve en yavaş hareketli taahhüdüdür.',
      pitch: 'Oyundaki en güçlü duvarı maliyet ve uzun açıkta kalma süresiyle satın alır.',
      detail: 'Kale; Mühendislik, Zırh ve Güç araştırmalarının arkasındaki başkent tipi Siper gövdesidir. Savunmayı sabitler, fakat Çevik sınıf karşılarına ve uzun görev süresinin yarattığı fırsat penceresine açıktır.',
    },
    BASTION: {
      name: 'Tabya',
      tag: 'Ağır yer topu',
      role: 'Yer savunması. Gezegenden asla ayrılmaz.',
      pitch: 'Kargı, Pençe ve Söndürücü ağırlıklı saldırılara dayanır; Çevik sınıf filolara karşı zayıftır.',
      detail: 'Tabya gezegenden ayrılamaz ve yer savunması kapasitesini kullanır. Siper sınıfında olduğu için Mızrak sınıfına karşı güçlü, Çevik sınıfa karşı zayıftır. Yok edilen yer savunmalarının %60’ı aşağı yuvarlanarak enkazdan yeniden kurulur.',
    },
    THORN: {
      name: 'Kirpi',
      tag: 'Hafif yer topu',
      role: 'Yer savunması. Ucuz, hafif ve hiç kalkmaz.',
      pitch: 'Siper sınıfı gemilere karşı etkili, düşük maliyetli savunmadır; Mızrak sınıfına karşı zayıftır.',
      detail: 'Kirpi gezegenden ayrılamaz ve Hangar yerine yer savunması kapasitesini kullanır. Çevik sınıfta olduğu için Siperlere karşı güçlü, Mızraklara karşı zayıftır. Yok edilen yer savunmalarının %60’ı aşağı yuvarlanarak enkazdan yeniden kurulur.',
    },
    PROSPECTOR: {
      name: 'Kazıcı',
      tag: 'Asteroit kazar',
      role: 'Asteroitlerden cevher getirir; taban ambarı 300’dür ve akın filosuna katılamaz.',
      pitch: 'Hareketli bir asteroidi yakalar, taşıyabildiği cevheri üretim havuzuna getirir. Savaş veya transfer görevi yapmaz.',
      detail: 'Kazıcı yalnız keşfedilmiş asteroitlere ve enkaz sahalarına gönderilir. Taban hızı 825, taban ambarı 300’dür; Matkap ve Kazıcı Ambarları araştırması bu değerleri artırabilir. Her dünya en fazla iki Kazıcı tutabilir. Hangar alanı kullanır ancak normal akınlara katılmaz ve ev savunmasında savaşmaz.',
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
      body: 'Kesin bilgi istiyorsan sonda gönder. Radarları onu yakalayabilir.',
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
    value: '{{alloy}} alaşım · {{crystal}} kristal · {{deuterium}} Döteryum',
    storeLabel: 'Depo kapasitesi',
    storeValue: '{{hours}} saatlik üretim',
  },
  shipyard: {
    accuracyLabel: 'Sonda isabeti',
    seesLabel: 'Deldiği Perde seviyesi',
    seesValue: 'Sv. {{level}}',
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
    sweepLabel: 'Temas alanı · zamanlı uyarı',
    sweepNone: 'yok',
    reaches: '{{sense}} birim temas (varış süresi yok) · {{warn}} birim zamanlı uyarı',
    maxed: 'En üst seviye; uyarı çıkış dünyasını ve filonun tam içeriğini de gösterir',
    l1: 'Sondaları yakalamaya başlar ve yaklaşan filo için varış uyarısı verir',
    bearing: '2. seviye geliş yönünü de gösterir',
    interception: '3. seviye, Önleme Ağı araştırıldıysa stratejik önleyiciyi etkinleştirir',
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
    powerLabel: 'Fleet V2 savaş gemisi saldırısı',
    powerScope:
      'Bütün Fleet V2 savaş gemileri. Güç × Zırh, eşit maliyetli savaş gücünü en fazla %25 artırır; nakliye ve korunan birimler etkilenmez.',
    armorLabel: 'Fleet V2 gövde dayanımı',
    armorScope:
      'Nakliye gemileri dâhil 18 Fleet V2 gövdesi. Güç × Zırh, eşit maliyetli savaş gücünü en fazla %25 artırır; korunan birimler etkilenmez.',
    speedLabel: 'Fleet V2 hızı',
    speedScope:
      'Bütün 18 Fleet V2 gövdesi. Karma filo yine en yavaş üyesinin geliştirilmiş hızında uçar; Kazıcı, sonda ve Ölüm Yıldızı etkilenmez.',
    engineeringLabel: 'Gövde seviyesi erişimi',
    engineeringTier: '{{tier}}. seviye',
    engineeringScope:
      'Mühendislik I üçüncü, Mühendislik II dördüncü seviyeyi açar. Gemiler ayrıca Güç, Zırh, İtki veya Gravitik Yükler isteyebilir.',
    groundLabel: 'Yer savunması gücü',
    groundScope: 'Elindeki her dünyadaki {{bastion}} ve {{thorn}}.',
    yardLabel: 'Gemi yapım süresi',
    holdsLabel: 'Kazıcı ambarı',
    holdsScope: 'Yörüngedeki Matkap ile çarpılarak birlikte uygulanır.',
    cargoLabel: 'Akın yükü',
    cargoScope: 'Yalnız yağma — dünyalar arası transfer ve madencilik değişmez.',
    refineryLabel: 'Rafineri seviye sınırı',
    stockpileLabel: 'Hazır silah',
    /* İzin bir kapı açar; merdiven gibi çizmek olmayan bir miktar uydurmak olur. */
    opensLabel: 'Açar',
    open: 'Açık',
    shut: 'Kilitli',
    isotopeOpens: 'İzotop asteroitleri seçilebilir madencilik hedefi olur.',
    denseOpens: 'Gemi İtkisi araştırması açılır.',
    graviticOpens: 'Söndürücünün uzman araştırma koşulu karşılanır.',
    protocolOpens: 'Ölüm Yıldızı inşa edilebilir olur.',
    gridOpens: 'Stratejik önleyici mühimmatı üretilebilir hâle gelir.',
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
    'Kaynaklarını harcayabilir, filonu başka göreve çıkarabilir veya savunmayı güçlendirebilirsin. Havadaki gemiler bu çatışmaya girmez.',
  inboundAction: 'Hemen harca',

  undefendedTitle: 'Bu gezegende yer savunması yok',
  undefendedDetail:
    '{{amount}} kaynak akına açık. Kalıcı savunma için Kirpi veya Tabya kurabilirsin.',
  undefendedAction: 'Savunma kur',

  exposedTitle: 'Senden {{amount}} alınabilir',
  exposedDetail: 'Kasan {{now}} koruyor, bir üst seviyesi {{next}} koruyacak.',
  exposedAction: 'Kasayı yükselt',

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
  coreCeilingDetail: 'Hiçbir bina Çekirdeği geçemez. Onu yükseltince hepsi birden açılır.',
  coreCeilingAction: 'Çekirdeği yükselt',

  idleTitle: 'Devam eden uçuş yok',
  idleDetailHasShips: 'Rampaların boş. Sonda, akın, transfer veya madencilik görevi başlatabilirsin.',
  idleDetailNoShips: 'Evde gemin yok. Ya yenisini yap ya da dışarıdakilerin dönmesini bekle.',
  idleAction: 'Hedef bul',

  baysFreeTitle_one: 'Bir rampa hâlâ boş',
  baysFreeTitle_other: '{{count}} rampa hâlâ boş',
  baysFreeDetail: 'Her sonda, akın, transfer ve madencilik seferi bir rampa kullanır.',
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
    FIRST_STRIKE: 'Ölüm Yıldızı darbesi · dünya toparlanmaya girdi',
    CAPTURED: 'Ölüm Yıldızı darbesi · koloni ele geçirildi',
    INEFFECTIVE: 'Ölüm Yıldızı darbesi · etkisiz kaldı',
  },
  colonyCaptured: 'Koloni kuruldu · işgal koruması aktif',
  colonyLost: 'Koloni stratejik darbeyle kaybedildi',
  settlementLost: 'Yerleşim yarışı kaybedildi · Kuryeler ve kuruluş yükü geri dönüyor',
  interceptedDefended: 'Savunma ağın bir Ölüm Yıldızı’nı {{range}} birim uzakta imha etti.',
  interceptedLost: 'Ölüm Yıldızı’n hedefine {{range}} birim kala imha edildi.',
  interceptedFallback: 'Bir Ölüm Yıldızı uçuş hâlinde imha edildi.',
  asteroidShowerStarted: 'Galakside asteroid yağmuru başladı.',
  asteroidShowerEnded: 'Asteroid yağmuru bitti. Yeni asteroid oluşma hızı normale döndü.',
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
