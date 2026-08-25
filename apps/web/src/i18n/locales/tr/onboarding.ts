/**
 * PROVA — hesap açılmadan önce oynanan doksan saniye.
 *
 * TÜRKÇE YAZILDI, İNGİLİZCEDEN ÇEVRİLMEDİ. `entry.ts`'in başındaki kurallar
 * burada da geçerli: cümle kurulur, ad değil fiil kullanılır, tire yerine noktalı
 * virgül gelir ve karşılığı değil aynı işi gören Türkçe seçilir.
 *
 * Her satır bir beat, ve her beat oyuncunun birazdan YAPACAĞI şey. Hiçbiri bir
 * sistemi anlatmıyor: metin neye bakılacağını söyleyip çekiliyor, çünkü beat
 * ancak o şey gerçekten olduğunda ilerliyor.
 */
export const onboarding = {
  beats: {
    wide: {
      title: '{{shard}}',
      line: 'Bu galakside gerçek insanlar oynuyor. Her gezegen bir oyuncunun evi. Gördüğün gemiler de onların gerçek filoları.',
      action: 'Gezegenimi göster',
    },
    yours: {
      title: 'Bu gezegen senin',
      line: '{{name}} güvenli ana gezegenin. Burada kaynak üretir, rakipleri inceler, savunma kurar ve gemi yaparsın. Gezegenine dokun.',
    },
    briefing: {
      title: 'Oyunun dört adımı var',
      line: 'Önce kaynak üret. Sonra rakipleri incele. Gezegenini koru. Hazır olunca gemilerini gönder. Yükselttiğin her şey bu dört işi güçlendirir.',
      action: 'İlk adımı yap',
      mapGrow: 'Üret',
      mapIntel: 'Gör',
      mapDefend: 'Koru',
      mapReach: 'Gönder',
      mapOutcome: 'Bilgi topla · karar ver · gönder',
    },
    fog: {
      title: 'Önce bilgi, sonra risk',
      line: 'Başka bir gezegene dokun. Seviyesini görebilirsin; kaynaklarını, gemilerini ve savunmasını göremezsin. Önce bilgi topla, sonra saldırıp saldırmayacağına karar ver.',
    },
    fogAlone: {
      title: 'Burada henüz kimse yok',
      line: '{{shard}} hâlâ doluyor. Dolduğunda hiçbirinin elinde ne olduğunu göremeyeceksin.',
      action: 'Anlaşıldı',
    },
    core: {
      title: 'Önce seviye sınırını aç',
      line: 'Komuta Çekirdeği diğer binaların çıkabileceği seviyeyi belirler. Satıra dokun. Açılan kartta 2. seviyenin ne verdiğini ve fiyatını gör; sonra sıraya koy.',
    },
    refinery: {
      title: 'Daha çok alaşım üret',
      line: 'Rafineri her saat alaşım üretir. Bina ve gemi yapmak için en çok alaşım kullanırsın. Satıra dokun ve 2. seviyeyi sıraya koy.',
    },
    extractor: {
      title: 'Şimdi kristal üret',
      line: 'Ekstraktör her saat kristal üretir. Güçlü gemiler ve istihbarat araçları için kristal gerekir. Satıra dokun ve 2. seviyeyi sıraya koy.',
    },
    fleet: {
      title: 'Şimdi iki gemi yap',
      line: 'Filo sekmesinde {{ship}} satırına dokun. En Fazla seçeneğini seç ve iki gemiyi sıraya koy. Bu hızlı gemileri rakipleri yoklamak veya saldırmak için kullanacaksın.',
    },
  },

  skip: 'Atla',
  haveAccount: 'Zaten bir komutanım var',

  claim: {
    eyebrowName: 'Son adım',
    headingName: 'Dünyayı adınla imzala',
    lineName: 'Dört siparişin hazır. {{name}} senin olduğunda gerçek sayaçları birlikte başlar.',
    nameLabel: 'Komutan adı',
    next: 'Devam',

    eyebrowPassword: 'Bir tane daha',
    headingPassword: '{{name}} kilitleniyor',
    linePassword: 'Bir parola belirle; hangi tarayıcıdan girersen gir komutanın seni orada bekler.',
    passwordLabel: 'Parola',
    submit: 'Gezegeni sahiplen',
    working: 'Dünya alınıyor',
    back: 'Geri',
  },

  trouble: {
    noFrontier: 'Şu anda bütün galaksiler dolu. Yeni bir sezon açılana kadar prova yapılamıyor.',
    unreachable: 'Galaksiye ulaşılamadı.',
    retry: 'Tekrar dene',
    partial: 'Dünya senin. Hazırladığın siparişlerden biri gerçek sıralar başlarken reddedildi.',
  },
} as const;
