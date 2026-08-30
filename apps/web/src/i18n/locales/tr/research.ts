/**
 * ARAŞTIRMA EKRANI. T12.
 *
 * Türkçesi Türkçe yazılır: İngilizceden çevrilmiş cümle değil, bir Türk oyuncunun
 * kuracağı cümle. "Under way" burada "Sürüyor" — "yolda" değil; slot bir sıra
 * değil, tek bir tezgâh.
 */
export const research = {
  eyebrow: "Komutan",
  title: "Araştırma",
  premise: "Bir kez alınır, sende kalır; tuttuğun her dünyada geçerlidir.",

  runningLabel: "Sürüyor",
  runningOn: "{{planet}} üzerinde",
  runningFinishes: "{{time}}’de biter",
  idleLabel: "Sürmekte olan araştırma yok",
  idleHint: "Tuttuğun dünyaların hepsinde toplam tek proje çalışır.",
  slotBusy: "{{name}}, {{planet}} üzerinde sürüyor",

  frontierBand: "Ufuk",
  frontierNote:
    "Satın alınmaz, oynayarak bulunur. Her kart neyin açtığını yazar.",
  industryBand: "Endüstri",
  industryNote:
    "Beşer kademe, ilk dakikadan açık. Ne ürettiğin ve ne taşıdığın.",
  doctrineBand: "Doktrin",
  doctrineNote:
    "Saldırı ve zırh birlikte. Bir sonda bunları gövdelerinden okur.",
  strategicBand: "Stratejik",
  strategicNote: "Oyundaki en ağır silah ve onu durduran tek şey.",

  act: "Araştır",
  complete: "araştırıldı",

  needCore: "Komuta Çekirdeğini L{{level}} yap",
  queueFull: "İnşaat sırası dolu",
  at: "{{duration}} sonra araştırılabilir",
  warAt: "Savaş perdesi {{duration}} sonra açılır",
  isotopeFirst: "Önce İzotop Spektrometrisi’ni araştır",
  graviticFirst: "Önce Gravitik Yükler’i araştır",
  cargoInsight: "Bir akında ambarını doldur; hedefte ganimet kalsın",
  shieldInsight: "Aegis akın hasarının en az {{share}}’ini emsin",

  sheetEyebrow: "Araştırma projesi",
  sheetComplete: "Araştırma tamam",
  sheetCost: "Araştırma bedeli",
  sheetOnce: "Üzerinde bulunduğun dünyanın İnşaat sırasına girer.",
  sheetRung: "{{max}} kademenin {{level}}. kademesi. Her kademe ayrı alınır.",

  isotopeName: "İzotop Spektrometrisi",
  isotopeTag: "Döteryum madenciliğini açar",
  isotopeRole:
    "İzotop kayalarındaki Döteryumu gösterir ve onlara Kazıcı göndermeni sağlar. Dönen yük Havuz’a gelir.",
  isotopeDetail:
    "Bir kez tamamlandığında izotop asteroitlerini seçilebilir maden hedeflerine çevirir. Kapışılan Döteryuma erişim açar; gezegende kendiliğinden yakıt üretmez.",
  denseName: "Yoğun Yakıt Hücreleri",
  denseTag: "Koşucuyu açar",
  denseRole:
    "Keşfetmek için bir akında ambarını doldur; hedefte ganimet kalsın. Koşucu, Şilep’ten hızlıdır ama daha az taşır.",
  denseDetail:
    "Tamamlandığında tuttuğun bütün dünyalarda Koşucu yapımını kalıcı olarak açar. Hızlı vurucu filon, yavaş Şilebi beklemeden ganimet taşıyabilir.",
  graviticName: "Gravitik Yükler",
  graviticTag: "Delici’yi açar",
  graviticRole:
    "Açmak için savunması ve aktif Aegis’i olan bir dünyaya saldır; kalkan hasarın en az {{share}}’ini emsin. Bir Atmaca bile yeter; kazanman gerekmez. Delici kalkana beş kat vurur.",
  graviticDetail:
    "Tamamlandığında Delici yapımını bütün dünyalarında kalıcı olarak açar. Delici aktif Aegis’e karşı uzman cevaptır; genel saldırı yükseltmesi değildir.",
  deathStarName: "Ölüm Yıldızı Protokolü",
  deathStarTag: "Ölüm Yıldızı’nı açar",
  deathStarRole:
    "Komuta Çekirdeği 12 ve Tersane 5 olan bir dünyada, tek kullanımlık Ölüm Yıldızı inşa etmeni sağlar. Ana gezegen ele geçirilemez.",
  deathStarDetail:
    "Her atış bir Ölüm Yıldızı tüketir. İlk darbe yerdeki tüm filoyu ve devam eden bina siparişlerini yok eder; stokların yarısını siler, Komuta Çekirdeğini bir, Aegis’i iki seviye düşürür ve diğer binaları yeni Çekirdek tavanına indirir. Dünya iki saat üretim yapamaz veya emir veremez. Bu toparlanma süresi içinde yapılan ve ele geçirme emri verilen ikinci darbe, yalnız koloni veya tarafsız dünyayı ele geçirir.",

  synthesisName: "Döteryum Sentezi",
  synthesisTag: "Rafineri tavanını yükseltir",
  synthesisRole:
    "Her kademe üç Döteryum Rafinerisi seviyesi açar. Yakıt buradan başlar.",
  synthesisDetail:
    "Her araştırma kademesi bütün dünyalarında Döteryum Rafinerisi tavanını üç seviye yükseltir. Yakıt istediğin dünyada bu Rafineri seviyelerini ayrıca kurarsın.",
  yardName: "Tersane Otomasyonu",
  yardTag: "Gemileri daha hızlı kurar",
  yardRole:
    "Her gövdenin yapım süresini kısaltır. Eğriyi hâlâ Tersane belirler.",
  yardDetail:
    "Her kademe bundan sonra vereceğin bütün hareketli gemi siparişlerini, Kazıcı dâhil, tüm dünyalarında daha çabuk bitirir. Yer savunmalarını hızlandırmaz; kaynak bedelini düşürmez ve Tersane sırasına yeni yuva eklemez.",
  holdsName: "Kazıcı Ambarları",
  holdsTag: "Kazıcılar daha çok taşır",
  holdsRole:
    "Matkap ile çarpan olarak birleşir; donanım ve teknik birbirini büyütür.",
  holdsDetail:
    "Her kademe bütün Kazıcıların tek seferde getirdiği cevheri artırır. Matkap uydusuyla çarpıldığı için araştırma ve yörünge donanımı aynı madencilik planını birlikte büyütür.",
  cargoName: "Gemi Ambarları",
  cargoTag: "Akınlar daha çok getirir",
  cargoRole:
    "Bir filonun yağmalayabileceğini artırır. Dünya transferlerini değiştirmez.",
  cargoDetail:
    "Her kademe hareketli filonun akında taşıyabileceği ganimeti artırır. Savaş sonunda açık stok kaldığında işe yarar; barışçıl transferleri ve asteroit madenciliğini etkilemez.",

  waspDoctrineName: "Atmaca Doktrini",
  lanceDoctrineName: "Mızrak/Delici Doktrini",
  bulwarkDoctrineName: "Siper Doktrini",
  groundDoctrineName: "Tabya/Kirpi Doktrini",
  generalName: "Silah ve Zırh",
  generalTag: "Uçurduğun her gövdeyi geliştirir",
  doctrineTag: "Daha iyi saldırı ve zırh",
  doctrineRole:
    "Saldırı gücü ve gövde dayanımı birlikte artar. Sınıf doktriniyle genel araştırmanın eşit maliyetli savaş gücüne toplam katkısı en fazla %25’tir; doğru karşı gövdeyi seçmek çok daha büyük üstünlük sağlar.",
  waspDoctrineDetail:
    "Elindeki gemiler dâhil bütün Atmacaların saldırı gücünü ve gövde dayanımını artırır. Saldıran filo kalkış anındaki, savunan taraf ise çatışma anındaki araştırma kademesini kullanır.",
  lanceDoctrineDetail:
    "Elindeki gemiler dâhil bütün Mızrak ve Delicilerin saldırı gücünü ve gövde dayanımını artırır; sınıfların doğal güçlü ve zayıf eşleşmelerini değiştirmez. Saldıran filo kalkış anındaki, savunan taraf çatışma anındaki araştırma kademesini kullanır.",
  bulwarkDoctrineDetail:
    "Bütün Siperlerini güçlendirir ama yavaş uçuşunu değiştirmez. Saldıran filo kalkış anındaki, savunan taraf çatışma anındaki araştırma kademesini kullanır.",
  groundDoctrineDetail:
    "Bütün dünyalarındaki Tabya ve Kirpileri güçlendirir. Yer kapasitesi ve enkazdan geri kurulum kuralı değişmez; savunmada çatışma anındaki kademe kullanılır.",
  generalDetail:
    "Bütün hareketli gemilerin gövde dayanımını, saldırısı olan gemilerin de saldırı gücünü artırır. Sınıf doktriniyle birleşir; ikisinin eşit maliyetli savaş gücüne toplam katkısı %25’i aşmaz. Saldıran filo kalkış, savunan taraf çatışma anındaki kademeyi kullanır.",

  gridName: "Önleme Ağı",
  gridTag: "Ölüm Yıldızı’nı düşürür",
  gridRole:
    "Radar çemberinde bir stratejik silahı imha eder. Radar 3 ve Anten ister.",
  gridDetail:
    "Önleyici mühimmatına erişim verir. Anten ve Radar 3 varken yüklü mühimmat, zamanlı Radar çemberine giren bir stratejik silahı otomatik imha eder ve sonra tükenir.",
  stockpileName: "Stratejik Stok",
  stockpileTag: "Rampada ikinci silah",
  stockpileRole:
    "Her dünya en fazla iki Ölüm Yıldızı tutabilir; ikincisi, birincinin yapımı bittikten sonra başlar.",
  stockpileDetail:
    "Ölüm Yıldızı stok sınırını komutan genelinde değil, sahip olduğun her dünya için birden ikiye çıkarır. İkinci silah da tam bedelini ve tam yapım süresini ister; sıraya alınabilir ama birinciyle aynı anda üretilmez. Atış yine silahı tüketir.",
} as const;
