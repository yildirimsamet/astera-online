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
      line: 'Elli dünyanın {{planets}} tanesi tutulmuş, hepsi gerçek insanlarda. Diskte gördüğün her hareket şu anda oluyor.',
      action: 'Gezegenimi göster',
    },
    yours: {
      title: 'Bir dünya seni bekliyor',
      line: '{{name}} senin adına ayrıldı. Üstüne dokun.',
    },
    fog: {
      title: 'Peki diğerlerinde ne var?',
      line: 'Herhangi birine dokun. Adını ve ne kadar geliştiğini görürsün; elinde ne tuttuğunu göremezsin. O da seninkini göremiyor.',
    },
    fogAlone: {
      title: 'Burada henüz kimse yok',
      line: '{{shard}} hâlâ doluyor. Dolduğunda hiçbirinin elinde ne olduğunu göremeyeceksin.',
      action: 'Anlaşıldı',
    },
    core: {
      title: '{{alloy}} alaşım, {{crystal}} kristal',
      line: 'Bütçenin tamamı bu. Önce Komuta Çekirdeği’ni yükselt; hiçbir yapı ondan yüksek olamaz, o yüzden o kalkmadan başka hiçbir şey kıpırdamaz.',
    },
    refinery: {
      title: 'Sıra Rafineri’de',
      line: 'Çekirdek yükseldi, tavan da onunla birlikte kalktı. Alaşımı Rafineri üretir.',
    },
    extractor: {
      title: 'Ve Kristal Ekstraktörü',
      line: 'Üçüncüsü. Satın alırken kristale dikkat et.',
    },
    fleet: {
      title: 'Kristalin bitti. Tam olarak.',
      line: 'Bu bir tesadüf değil; açılış bütçesi birim birim üç yükseltme ve iki gemi eder. Kalanla İKİ {{ship}} birden kur.',
    },
    target: {
      title: 'Filo, riske attığın şeydir',
      line: 'Bir dünyaya dokun, panelini aç ve elindeki her şeyi gönder. Orada ne olduğunu bilmiyorsun; öğrenmenin bir yolu bakmak, öbürü gitmek.',
    },
    targetAlone: {
      title: 'Menzilinde kimse yok',
      line: 'Gemilerin hazır, uçuş yuvan boş. Bu galakside ilk hamleyi yapacak olan sensin.',
      action: 'Dünyamı sahiplen',
    },
  },

  skip: 'Atla',
  haveAccount: 'Zaten bir komutanım var',

  claim: {
    eyebrowName: 'Son adım',
    headingName: 'Dünyayı adınla imzala',
    lineName: 'Filon yola çıktı. Arkasında bir komutan olduğu anda {{name}} senin kalır.',
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
    partial: 'Dünya senin. Bir emir yolda kaldı; sen imzalarken galakside işler değişti.',
  },
} as const;
