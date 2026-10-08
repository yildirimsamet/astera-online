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
export const country = {
  label: 'Ülke',
  choose: 'Ülkeni seç',
  searchLabel: 'Ülkelerde ara',
  searchPlaceholder: 'Ülke adıyla ara',
  list: 'Ülkeler',
  confirm: 'Ülkeyi onayla',
  change: 'Değiştir',
  saved: 'Ülke güncellendi',
} as const;

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
      title: 'Galakside dört temel adım var',
      line: 'Önce kaynak üret. Sonra rakipleri incele. Gezegenini koru. Hazır olunca gemilerini gönder. Binaların, cihazların ve araştırmaların bu dört alanı geliştirir.',
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
      line: "{{shard}} henüz dolmadı. Katılan komutanların kaynaklarını ve savunmasını öğrenmek için istihbarat toplaman gerekir.",
      action: 'Anlaşıldı',
    },
    core: {
      title: 'Önce seviye sınırını aç',
      line: "Komuta Çekirdeği, Hangar dışındaki yapıların seviye sınırını belirler. Satırını aç; 2. seviyenin etkisini ve bedelini incele. Sonra yükseltmeyi sıraya ekle.",
    },
    refinery: {
      title: 'Daha çok alaşım üret',
      line: 'Rafineri her saat alaşım üretir. Bina ve gemi yapmak için en çok alaşım kullanırsın. Satıra dokun ve 2. seviyeyi sıraya koy.',
    },
    extractor: {
      title: 'Şimdi kristal üret',
      line: 'Kristal Ocağı her saat kristal üretir. Güçlü gemiler ve istihbarat araçları için kristal gerekir. Satıra dokun ve 2. seviyeyi sıraya koy.',
    },
    fleet: {
      title: 'Şimdi iki gemi yap',
      line: 'Filo sekmesinde {{ship}} satırına dokun. “En fazla” seçeneğini seç ve iki gemiyi sıraya koy. Bu hızlı gemileri rakipleri yoklamak veya saldırmak için kullanacaksın.',
    },
  },

  skip: 'Atla',
  haveAccount: 'Zaten bir komutanım var',

  claim: {
    eyebrowName: 'Son adım',
    headingName: "Komutan adını seç",
    lineName: 'Dört siparişin hazır. {{name}} senin olduğunda gerçek sayaçları birlikte başlar.',
    nameLabel: 'Komutan adı',
    next: 'Devam',

    eyebrowPassword: 'Bir tane daha',
    headingPassword: "{{name}} için parola belirle",
    linePassword: "Başka bir cihazda aynı komutanla giriş yapmak için bu parolayı kullanacaksın.",
    passwordLabel: 'Parola',
    submit: 'Gezegeni sahiplen',
    working: "Komutan oluşturuluyor…",
    back: 'Geri',
  },

  trouble: {
    noFrontier: 'Şu anda bütün galaksiler dolu. Yeni bir sezon açılana kadar prova yapılamıyor.',
    unreachable: 'Galaksiye ulaşılamadı.',
    retry: 'Tekrar dene',
    partial: "Gezegenin oluşturuldu. Hazırladığın siparişlerin bazıları başlatılamadı. Güncel üretim sıralarını kontrol et.",
  },
} as const;
