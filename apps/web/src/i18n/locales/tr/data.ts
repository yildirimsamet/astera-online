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
    WASP: {
      name: 'Atmaca',
      tag: 'Ucuz ve hızlı',
      role: 'En ucuz ve en hızlı savaş gemisi; ağır Siper sınıfına karşı etkilidir.',
      pitch: 'Kısa süreli akınlar ve Siper ağırlıklı savunmalar için hızlı, düşük maliyetli saldırı gücü sağlar.',
      detail: 'Atmaca, Siper ve Tabya gibi ağır Siper sınıfı hedeflere karşı güçlü; Mızrak ve Delici sınıfına karşı zayıftır. 130 hızla en kısa görev süresini sunar. Geminin 45 birim ambarı vardır ancak asıl görevi savaşmaktır; büyük ganimet için Şilep veya Koşucu gerekir.',
    },
    LANCE: {
      name: 'Mızrak',
      tag: 'Hafif gemilere karşı',
      role: 'Atmaca ve Kirpi sınıfına karşı güçlü; Siper ve Tabya sınıfına karşı zayıftır.',
      pitch: 'Hafif ve kalabalık kuvvetlere karşı etkilidir; ağır Siper sınıfıyla karşılaştığında verimi düşer.',
      detail: 'Mızrak, Atmaca ve Kirpi gibi hafif hedeflere karşı 1,6 kat sınıf üstünlüğü kazanır. Siper ve Tabya ona karşı aynı üstünlüğe sahiptir. Yüksek saldırı değeri filo alanını iyi değerlendirir; ancak tek tip Mızrak filosu ağır savunmaya karşı kolayca etkisiz kalır.',
    },
    BULWARK: {
      name: 'Siper',
      tag: 'Ağır ve dayanıklı',
      role: 'En dayanıklı savaş gemisidir; Mızrak sınıfına güçlü, Atmaca sınıfına zayıftır.',
      pitch: 'Mızrak ve Delici ağırlıklı kuvvetlere dayanır; düşük hızı bütün filonun görev süresini uzatır.',
      detail: 'Siper, Mızrak ve Delici sınıfına karşı güçlü; Atmaca ve Kirpi sınıfına karşı zayıftır. 662 gövde dayanımı uzun çatışmalarda filoyu ayakta tutar. Filo en yavaş gemisinin hızında ilerlediği için 65 hızındaki tek bir Siper bile hızlı bir filonun gidiş ve dönüş süresini belirgin biçimde artırabilir.',
    },
    HAULER: {
      name: 'Şilep',
      tag: 'Ganimeti taşır',
      role: '2.200 birim akın ve transfer kapasitesi sağlar; saldırı gücü yoktur.',
      pitch: 'Büyük miktarda ganimet veya kaynak taşır. Çatışmada hasar veremediği için savaş gemileriyle korunmalıdır.',
      detail: 'Şilep, 2.200 birimle en büyük gemi ambarına sahiptir ve dünyalar arası kaynak transferinde kullanılabilir. Saldırı değeri sıfırdır; destek sınıfı olduğu için düşmana hasar vermez ve filodaki savaş gemileri yok olduğunda kolay hedef olur. 85 hızı hızlı akın filolarını yavaşlatabilir.',
    },
    RUNNER: {
      name: 'Koşucu',
      tag: 'Hızlı akın ambarı',
      role: '380 birim taşıyan hızlı destek gemisidir; akın ve transferlerde kullanılabilir.',
      pitch: 'Şilepten daha az taşır ancak hızlı filolara ayak uydurur; kısa görev süresi için daha pahalı ambar sunar.',
      detail: 'Koşucu 125 hızla Atmaca filosuna yakın hareket eder ve 380 birim kaynak taşır. Hem akın ganimetinde hem dünyalar arası transferde kullanılabilir. Taşıdığı birim başına Şilepten daha pahalıdır ve saldırı gücü yoktur; tercih nedeni kapasite değil hızdır.',
    },
    BREACHER: {
      name: 'Delici',
      tag: 'Aktif kalkanları kırar',
      role: 'Aktif Aegis kalkanına beş kat etki uygular; ek kalkan hasarı birliklere geçmez.',
      pitch: 'Kalkanlı dünyalara karşı uzmanlaşmıştır. Aegis yoksa yüksek maliyetinin karşılığını vermez.',
      detail: 'Delici, aktif Aegis’e normal kalkan etkisinin toplam beş katını uygular. Uzmanlık hasarı yalnız kalan kalkan kadar kullanılır; kalkan bittiğinde artan bölüm gemilere veya yer savunmasına aktarılmaz. Mızrak sınıfındadır: hafif hedeflere güçlü, Siper sınıfına zayıftır.',
    },
    BASTION: {
      name: 'Tabya',
      tag: 'Ağır yer topu',
      role: 'Yer savunması. Gezegenden asla ayrılmaz.',
      pitch: 'Mızrak ve Delici ağırlıklı saldırılara karşı dayanıklı yer savunmasıdır; Atmaca sınıfına karşı zayıftır.',
      detail: 'Tabya gezegenden ayrılamaz ve yer savunması kapasitesini kullanır. Siper sınıfında olduğu için Mızrak ve Deliciye karşı güçlü, Atmacaya karşı zayıftır. Çatışmada yok edilen yer savunmalarının %60’ı aşağı yuvarlanarak enkazdan yeniden kurulur.',
    },
    THORN: {
      name: 'Kirpi',
      tag: 'Hafif yer topu',
      role: 'Yer savunması. Ucuz, hafif ve hiç kalkmaz.',
      pitch: 'Siperlere karşı etkili, düşük maliyetli yer savunmasıdır; Mızrak sınıfına karşı zayıftır.',
      detail: 'Kirpi gezegenden ayrılamaz ve Hangar yerine yer savunması kapasitesini kullanır. Atmaca sınıfında olduğu için Sipere karşı güçlü, Mızrak ve Deliciye karşı zayıftır. Çatışmada yok edilen yer savunmalarının %60’ı aşağı yuvarlanarak enkazdan yeniden kurulur.',
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
    doctrineLabel: '{{hull}} saldırı ve gövde',
    doctrineScope: 'Sahip olduğun bütün {{hull}} birliklerine uygulanır. Destek gemilerini etkilemez.',
    lanceScope: 'Sahip olduğun bütün {{lance}} ve {{breacher}} birliklerine uygulanır. Destek gemilerini etkilemez.',
    groundLabel: 'Yer savunması gücü',
    groundScope: 'Elindeki her dünyadaki {{bastion}} ve {{thorn}}.',
    generalLabel: 'Tüm gövdelerde saldırı ve dayanım',
    generalScope:
      'Destek gemileri ve yer savunmaları dâhil, sahip olduğun bütün gövdelere uygulanır. Saldırısı olmayan destek gemilerinde yalnız dayanım artar. Sınıf doktriniyle birleştiğinde toplam savaş gücü artışı %25’i aşmaz.',
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
    denseOpens: 'Koşucu üretilebilir hâle gelir.',
    graviticOpens: 'Delici üretilebilir hâle gelir.',
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
  settlementLost: 'Yerleşim yarışı kaybedildi · Şilepler ve yükleri geri dönüyor',
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
