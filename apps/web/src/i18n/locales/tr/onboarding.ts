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
      line: '{{capacity}} komutan yerinin {{planets}} tanesi tutulmuş, hepsi gerçek insanlarda. Diskte gördüğün her hareket şu anda oluyor.',
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
      line: 'Bütçenin tamamı bu. Önce Komuta Çekirdeği’ni sıraya koy; hiçbir yapı onu geçemez, sonraki sipariş yeni tavanı hesaba katar.',
    },
    refinery: {
      title: 'Sıra Rafineri’de',
      line: 'Çekirdek sırada önde; bu sipariş onun açacağı tavanı kullanabilir. Alaşımı Rafineri üretir.',
    },
    extractor: {
      title: 'Ve Kristal Ekstraktörü',
      line: 'Üçüncüsü. Satın alırken kristale dikkat et.',
    },
    fleet: {
      title: 'Kristalin bitti. Tam olarak.',
      line: 'Bu bir tesadüf değil; açılış bütçesi birim birim üç yükseltme ve iki gemi eder. Kalanla İKİ {{ship}}yı birden sıraya koy.',
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
