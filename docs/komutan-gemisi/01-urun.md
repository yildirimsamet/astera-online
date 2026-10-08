# Komutan Gemisi — Ürün spesifikasyonu (sahibin brief'i)

> **Durum:** Sahip spesifikasyonu, 2026-10-07. Bu dosyadaki maddeler **kesin kurallardır**
> ([KG-K2](02-kararlar.md#kg-k2)). Bir maddeyi değiştiren, kaldıran ya da yeni bir kısıt ekleyen
> her öneri, uygulanmadan **önce sahibe sunulur**.
> **Hedef okuyucu:** Bu özelliği hiç görmemiş, geliştirmeyi yapacak agent.
> **Kaynak:** Sahibin 2026-10-07 tarihli, birkaç mesaja yayılmış brief'i. Sahibin cümleleri
> korunarak konulara ayrıldı ve numaralandı (`S1`…). **Brief'in başka bir kopyası yoktur;**
> bu dosya tek kaynaktır. Sahibin varlık çıkarma isteği [09](09-varliklar-ve-referans-cikarma.md)
> (`V` maddeleri), referans oyun talimatları [10](10-referans-oyunlar.md) (`R` maddeleri) içindedir.
> **Okuma sırası:** [README](README.md) → bu dosya → [02-kararlar](02-kararlar.md) → konu belgeleri.

---

## 1. Amaç ve ana oyunla ilişki

- **S1** Astera Online'a, oyuncunun **doğrudan sürebildiği** ve **kalıcı olarak geliştirebildiği**
  özel bir gemi eklenecek. Şimdilik adı **Komutan Gemisi**.
- **S2** Mevcut gezegen geliştirme, filo yönetimi ve galaksi stratejisi **ana oyun olarak kalır**.
  Komutan Gemisi buna bağlı **aktif pilotluk, savaş, rekabet ve keşif** deneyimi sunar.
- **S3** Ayrı bir haritada oynanır ama **kaynaklar ve gelişim sistemi** üzerinden ana oyunla bağlıdır.
- **S4** Amaç, başarılı oyunları karıştıran yeni ve ayrı bir oyun yapmak **değildir**. Kendi
  oyunumuza en çok uyan yapıyı kurmak; başarılı oyunların iyi yaptığı şeylerin **neden** iyi
  olduğunu ve **nasıl** yapıldığını anlayıp kendi tarzımızla bir nevi **oyun içinde yeni bir
  oyun** oluşturmaktır.

## 2. Ana gezegende gemi yönetimi

- **S5** Komutan Gemisi, mevcut galakside oyuncunun **ana gezegeni üzerinde** yer alır.
  (Galaksi sahnesinde başkentin yanında görünmesi: [KG-A20](02-kararlar.md#kg-a20).)
- **S6** Menüde gemiye özel, geminin **3D olarak görüntülendiği** ayrı bir **yönetim sayfası** olur.
- **S7** **Geliştirme, tamir ve hazırlık** işlemleri bu sayfadan yapılır.
- **S8** Oyuncu bir **butona basarak savaş alanına geçer**. Geçişte bir **yükleme ekranı**
  gösterilir ve ilgili oyun alanı yüklenir.

## 3. Kamera ve mobil kontrol

- **S9** Oynanış **dikey ekranda** ve **birinci şahıs** bakış açısındadır.
- **S10** Kamera, geminin önünden ve kokpitten bakılıyormuş hissi verir; ama görüşü çevreleyen
  bir **kokpit çizimi yapılmaz**. Ekranın **ortasında nişangâh**, sağında ve solunda geminin ateş
  eden **namluları veya silah mekanizmaları** görünür.
- **S11** Ekranın **üst bölümünde**, geminin arkasını **canlı** gösteren bir **arka görüş
  penceresi** olur. Oyuncu ön görüşünden ayrılmadan kendisini takip eden rakipleri görür.
- **S12** Kontroller mobilde **kolay öğrenilir, anlaşılır ve rahat** kullanılır. Oyuncunun
  istediği manevrayı yapmasını zorlaştırmayan bir düzen tasarlanır.
- **S13** Dokunmatik kontrollerin **kesin yerleşimi henüz belirlenmedi** (prototipte denenir:
  [03](03-ucus-ve-kontroller.md)).

## 4. Uçuş, gaz ve yakıt

- **S14** Gemi **baktığı yöne** ilerler. **Geri gitme yoktur.** Oyuncu 3B uzayda sağa, sola,
  yukarı ve aşağı yön değiştirir.
- **S15** Gemi **gaz verildiğinde** hareket eder. **Gaz kesildiğinde yavaşlayarak durur.**
- **S16** **Tamamen durmuş** gemide yakıt tüketimi **çok azalır ama devam eder**.
- **S17** Yakıt **döteryumdur**. **Depo kapasitesi ve tüketim**, oyuncunun sahada kalabileceği
  süreyi sınırlar.

## 5. Silahlar ve geliştirilebilir özellikler

- **S18** Ateş, oyuncunun **baktığı yöne** yapılır. Mermilerin nişangâh çevresindeki dağılımını
  **isabet oranı** belirler: yüksek isabette mermiler hedeflenen noktaya daha yakın gider; düşük
  isabette nişangâh çevresinde daha geniş bir alana dağılır.
- **S19** Geliştirilebilir özellikler (sekiz): **Can · Saldırı gücü · Hareket hızı · Mermi hızı ·
  Atış hızı · İsabet oranı · Yakıt deposu kapasitesi · Ambar kapasitesi.**
- **S20** **Mühimmat kullanımı da döteryum tüketir.**
- **S21** Yakıt ve mühimmat için döteryumun **nasıl yükleneceği veya ayrılacağı ayrıca
  belirlenecek** ([KG-A3](02-kararlar.md#kg-a3)).

## 6. Aktif yetenekler

- **S22 Duman:** Gemi arkasında **görüşü kapatan** bir duman bırakır. Amaç kovalamacada rakibin
  takibini zorlaştırmak ve oyuncuya **kaçış, yön değiştirme veya karşı saldırı** fırsatı
  vermektir. Duman **yalnızca görüşü** etkiler.
- **S23 Turbo:** Gemi **sınırlı şarjla** hızlanır. **Basılı tutularak veya kısa basışlarla**
  kullanılır. Şarj zamanla **kendiliğinden dolar**.
- **S24 Görünmezlik:** Gemi **birkaç saniyeliğine** görünmez olur. Oyuncu **ateş ettiği anda**
  görünmezlik bozulur. (Görünmez gemi **hasar alır**: [KG-K4](02-kararlar.md#kg-k4).)
- **S25** Yetenekler de **geliştirilebilir**. Süreleri, şarj miktarları, yenilenme süreleri ve
  geliştirme değerleri dengeleme aşamasında belirlenir.

## 7. Sürekli açık savaş alanı

- **S26** Savaş alanı galaksi haritasından **ayrı**, **sürekli açık**, **ortak** bir alandır.
  Oyuncular gemilerini doğrudan sürer ve diğer oyuncularla **gerçek zamanlı** savaşır.
- **S27** **Dört giriş ve dört çıkış** vardır: **merkezde** bir giriş + bir çıkış; **dış
  çemberde** üç giriş + üç çıkış.
- **S28** Oyuncu girdiğinde dört girişten **rastgele birinde** doğar. Ayrılmak için **istediği
  çıkışı** kullanır.
- **S29** Yeni doğan oyuncuya **60 saniyelik hasar almama kalkanı** verilir. Oyuncu **ateş ettiği
  anda**, süre dolmamış olsa bile kalkan kalkar. (Ek bitiş koşulu önerisi: [KG-A1](02-kararlar.md#kg-a1).)

## 8. Savaş alanından çıkış

- **S30** Oyuncunun bir **çıkış alanına ulaşması ve tamamen durması** gerekir.
- **S31** Çıkış alanında tam durmuşken **3 saniye boyunca hasar almazsa** alandan çıkar ve ana
  gezegene döner. Topladığı kaynakları **güvenle eve ulaştırmanın tek yolu** bu çıkıştır.

## 9. Geminin yok edilmesi

- **S32** Gemi yok edildiğinde **patlama animasyonu** oynar. Ardından geminin patladığını
  belirten **sonuç ekranı**, ilgili bilgiler ve **"Ana gezegene dön"** butonu gösterilir.
- **S33** Gemi tamamen kaybedilmez; **kurtarma aracıyla çekilmiş gibi** ana gezegene döner.
  Yeniden kullanılabilmesi için **tamir gerekir**.
- **S34** **Kalan yakıt ve mühimmat korunur.** Sahada toplanan kaynaklar **patlama konumuna
  saçılır**; onları gemiyi vuran oyuncu **veya diğer oyuncular** toplayabilir.

## 10. Yakıtın bitmesi

- **S35** Gemi çıkışa ulaşmadan yakıtını bitirirse **kurtarma yoluyla** ana gezegene çekilir.
  (Çekilmenin zamanlaması: [KG-A2](02-kararlar.md#kg-a2).)
- **S36** Yakıtın bitmesi **yeni hasar vermez**. Önceden alınmış hasar **korunur**; çekilme
  **ücretsiz tamir sağlamaz**.
- **S37** Toplanan kaynaklar eve **taşınmaz**; yakıtın bittiği **konumda bırakılır**.

## 11. Kalıcı gelişim

- **S38** Gelişimde mevcut **alaşım ve kristal**, **yeni bir kaynak türü** ve **geliştirme
  kartları** kullanılır. Kartlar kalıcı geliştirme sağlar.
- **S39** Yeni kaynağın adı, kart türleri, geliştirme maliyetleri ve seviye sınırları **henüz
  belirlenmedi** ([KG-A10](02-kararlar.md#kg-a10), [KG-A11](02-kararlar.md#kg-a11)).
- "Kalıcı" = **sezon boyunca kalıcı**; yeni sezonda sıfırlanır ([KG-K3](02-kararlar.md#kg-k3)).

## 12. Monument sistemiyle bağlantı

- **S40** Monumentlar, ana strateji oyununu genişleten **ayrı bir geliştirme işidir**. Galaksinin
  çevresinde yaklaşık 3–5 monument; oyuncular tek başına ya da klanlarıyla, **normal filolarıyla**
  onları ele geçirmeye ve tutmaya çalışır. Kontrol sürdükçe domination puanı, kaynak ve benzeri
  ödüller kazanılır. Tutan filolar **radyasyon** hasarına ve diğer oyuncuların saldırılarına
  maruz kalır. Radyasyon: bulunduğu alan veya nesne üzerinden gemilere **zamanla hasar** veren mekanik.
- **S41** Monument sistemi oturduktan sonra ödüllerine Komutan Gemisi için **yeni kaynak ve
  geliştirme kartları** eklenebilir; böylece monument mücadelesi Komutan Gemisi gelişimini de besler.
- **S42** Monumentlar ve kapsamlı keşif içerikleri **ilk MVP'de yoktur**.
- *Kod notu:* Monumentlar ruleset 16 ile **kodda var** (`rules/monument.ts`, `services/monument*.ts`,
  5 monument, radyasyon bulutları). Bağlantı işi yalnız ödül tarafıdır ve sonraya kalır.

## 13. Temel döngü — kaynak toplama ve hayatta kalma

- **S43** Savaş alanı **kaynak toplama ve hayatta kalma** odağıyla tasarlanır. Temel döngü:
  **kaynak topla → karşılaşılan tehdidi değerlendir → saldır veya kaç → yükünü çıkıştan ana
  gezegene ulaştır.** Uçuş ve savaş sistemi bu döngüyü destekleyecek şekilde geliştirilir.
- **S44** Kaynak toplama sistemi eklendiğinde **ambar, güvenli çıkış ve kaynakların sahaya
  düşmesi** kuralları devreye girer. Kaynak toplama hazır değilse testte **geçici test yükü**
  kullanılır. (Toplama yöntemi: [KG-A12](02-kararlar.md#kg-a12).)

## 14. İlk MVP kapsamı

- **S45** İlk sürümün önceliği **gemiyi sürmenin ve savaşmanın hissini doğru kurmaktır.**
- **S46** MVP listesi:
  1. Dikey ekranda birinci şahıs uçuş.
  2. Gaz, yavaşlama, durma ve yakıt tüketimi.
  3. Nişangâh, görünür silah mekanizmaları ve ateş etme.
  4. Mermi hızı, atış hızı ve isabet dağılımı.
  5. Diğer oyuncularla gerçek zamanlı çatışma.
  6. Duman, turbo ve görünmezlik.
  7. Arka görüş penceresi.
  8. Giriş ve çıkış noktaları.
  9. Doğuş kalkanı.
  10. Patlama, sonuç ekranı ve ana gezegene çekilme akışı.
- **S47** Sahada oyuncunun **yönünü, hareketini ve hızını algılamasına** yardım eden küçük
  nesneler ve görsel referanslar bulunur. Hareket, hızlanma, ateş etme ve vuruş geri bildirimleri
  bu amaçla tasarlanır.
- **S48** Kalıcı geliştirme ve tamirin ilk MVP'de **ne ölçüde açılacağı**; kontrol yerleşimi,
  kaynak toplama yöntemi ve sayısal denge değerleri **ayrıca netleştirilir** (yol haritası:
  [12](12-yol-haritasi.md)).

## 15. Teknik yönergeler

- **S49** Mevcut galaksi **Three.js** kullanıyor. Önce mevcut frontend, backend ve gerçek zamanlı
  iletişim altyapısı incelenir. **Three.js temel seçenektir.** Ek kütüphane/teknoloji gerekirse
  **uyumluluk, mobil performans, bakım kolaylığı ve geliştirme maliyeti** açısından gerekçelendirilir.
  **Gereksiz altyapı değişikliğinden kaçınılır.**
- **S50** Uçuş kontrolü, çarpışma ve mermi simülasyonu, **sunucu otoriteli savaş**, gecikmenin
  gizlenmesi, hareket tahmini ve senkronizasyon için en uygun yaklaşım belirlenir
  ([05](05-ag-ve-sunucu.md)).
- **S51** **Hasar, yakıt, mühimmat, yetenekler ve çıkış koşulları sunucuda doğrulanır.**
- **S52** Arka görüş kamerası, duman efektleri ve **galaksi ↔ savaş sahnesi geçişlerinin mobil
  performansı** dikkate alınır ([06](06-istemci.md)).

## 16. Tasarım ve oynanabilirlik ilkeleri

Sahip: "Bunları mevcut özellik tanımına ek olarak değerlendir; kesinleşmiş mekanikleri
değiştirecek önerilerini önce bana sun."

- **S53 Görsel kimlik:** Astera'nın koyu lacivert zeminleri, ince çerçeveleri, turkuaz vurguları
  ve sade ikon dili korunur. Ama doğrudan pilotlukta **hedefler, nişangâh ve kritik uyarılar
  galaksi ekranından daha kolay okunur** olmalı. Referans görseller **görsel yöndür**; kontrol
  yerleşimleri **test edilmeden aynen uygulanmaz** ([07](07-hud-ve-ekranlar.md)).
- **S54 Kontroller gerçek dikey telefonda tasarlanır:** Yön, gaz, ateş ve yetenekler rahatça
  birleştirilebilmeli. **Aynı başparmakla eşzamanlı kullanılması gereken kontroller
  oluşturulmaz.** Gaz ve yönün birlikte kullanımı prototiple değerlendirilir. Dokunma alanları
  yeterli; ateş, turbo, duman ve görünmezlik **yanlışlıkla birbirine basılmayacak** şekilde ayrışır.
- **S55 Nişan hassas ve öngörülebilir:** Küçük parmak hareketleri hassas düzeltmeye, büyük
  hareketler rahat dönüşe izin verir. **Gereksiz kamera sallanması, aşırı yatma ve hedefi sürekli
  aşmaya neden olan dönüş** yok. **Kontrol hassasiyeti ile isabet özelliği ayrıdır:** isabet
  geliştirmesi yalnız mermi dağılımını etkiler, kamera kontrolünü bozmaz.
- **S56 Okunabilir alan:** Ortadaki görüş alanı açık kalır. Silah modelleri, arka görüş ve
  kontroller ekranı gereğinden fazla kaplamaz. Küçük çevre nesneleri yön, mesafe ve hız hissi
  verir; hedefleri gizleyen görsel kalabalık olmaz. **Dumanın görüş kapatması bilinçli bir
  taktik etki olarak korunur.**
- **S57 Bilgi önem sırasına göre:** Can, yakıt, hız ve yeteneklerin kullanılabilirliği kolay
  okunur. **Düşük yakıt, hasar yönü, doğuş kalkanının kalan süresi ve çıkış sayacı** gerektiğinde
  belirginleşir. **Durumlar yalnız renkle anlatılmaz**; ikon, kısa metin veya sayaçla desteklenir.
  **Çıkışın neden başlamadığı ya da kesildiği** anlaşılmalı.
- **S58 Ateş ve hareket geri bildirimi:** Mermi çıkışı, uçuşu, hedefe isabeti ve yok edilme
  **birbirinden ayırt edilir**. Ses ve ölçülü görsel efektlerle vuruş hissi oluşur. Turbo
  hızlanması ve gaz kesilince yavaşlama **hissedilir**; efektler nişanı zorlaştırmaz.
  **Görünmezliğin ateşle bozulması ve doğuş kalkanının kalkması açıkça anlaşılır.**
- **S59 Gelişim ve maliyetler eğlenceyi destekler:** Yakıt, mühimmat ve tamir **anlamlı kararlar**
  oluşturur; **birkaç yenilgi oyuncuyu uzun süre oynayamaz hâle getirmez**. Geliştirme ekranında
  **mevcut değer, yükseltme sonrası değer ve maliyet** açıkça görülür. Kalıcı güç artışının
  **yeni oyunculara karşı ezici üstünlük** yaratma riski değerlendirilir ([08](08-ilerleme-ve-ekonomi.md)).
- **S60 Mobil performans ve ağ erken test edilir:** Arka görüş, saydam duman, mermiler ve
  patlamalar **aynı anda** çalışırken performans ölçülür. **Gerçek ağ gecikmesinde** uçuş ve isabet
  hissi değerlendirilir. PC ve mobil oyuncular aynı alana girecekse **kontrol avantajları**
  incelenir; çözüm önerileri sahiple paylaşılır ([KG-A18](02-kararlar.md#kg-a18)).

## 17. Uygulama önerileri (sahibin, mevcut kod ve prototip üzerinden değerlendirilecek)

### Kontrol ve uçuş
- **S61** Yön kontrolünde küçük parmak hareketleri hassas nişan düzeltmesi, büyük hareketler
  hızlı dönüş sağlar. **Kontrol bırakıldığında dönüş durur, gemi mevcut doğrultusunu korur.**
- **S62** Gaz, yön ve ateş **iki başparmakla birlikte** kullanılabilmeli. **Sürekli basılı tutmayı
  gerektirmeyen, seçilen seviyede kalan** bir gaz kontrolü prototipte denenir. Gaz sıfıra
  alındığında gemi yavaşlayarak durur.
- **S63** Dikey ekranda **aynı anda dönüş, ateş ve turbo** kullanımı gerçek cihazda test edilir.

### Ateş, mermi ve isabet
- **S64** Ateş düğmesine **basılı tutulduğunda** silahın atış hızına göre mermi üretilir.
- **S65** Mermiler belirli bir **hız ve uçuş süresiyle** ilerler; normal mermiler **hedefi takip
  etmez**. Hareket ederek mermiden **kaçılabilir**.
- **S66** İsabet özelliği nişangâh çevresindeki dağılımı belirler; geliştikçe dağılım **daralır**.
  **Fiziksel olarak hedefe çarpan mermiye ayrıca rastgele ıskalama hesabı uygulanmaz.**
- **S67** Başlangıç gemisinin dağılımı, **doğru nişan alan oyuncuyu sürekli boşa ateş ediyormuş
  gibi hissettirmez.**
- **S68** Hızlı mermilerin güncellemeler arasında gemilerin **içinden geçmesi önlenir**; merminin
  **katettiği yol üzerinden** çarpışma kontrolü yapılır. **Hasarı sunucu doğrular.**
- **S69** **Ateş etmek ile gerçekten isabet ettirmek farklı** görsel/sesli geri bildirim verir.
  Onaylı isabet anlaşılır; namlu parlaması ve efektler **hedefi kapatmaz**.
- **S70** Mermilerin menzili veya yaşam süresi **sınırlıdır**; yeterince uzaklaşan oyuncu ateşten kurtulur.

### Nişan desteği
- **S71** Kontrol hassasiyeti, önleme işareti ve otomatik nişan yardımı **ayrı ayrı** değerlendirilir.
- **S72** İlk prototipte **otomatik hedefe dönme veya hedefe yapışma olmadan** rahat nişan hedeflenir.
- **S73** Hareketli hedefin önünde nereye ateş edilmesi gerektiğini gösteren **isteğe bağlı bir
  önleme işareti** denenir. Bu işaret mermileri **yönlendirmez** ve isabeti **garanti etmez**.

### Takip ve kaçış
- **S74** Saldırıya uğrayan oyuncu **hasarın yönünü** anlar, **arka görüşten** tehdidi değerlendirir
  ve **savaşma/kaçma** kararı verir.
- **S75** **Makul güç farklarında oyuncu durumu anlayamadan yok edilmez.** Öldürme süresi (TTK),
  tepki verme ve kaçış yeteneklerini kullanma fırsatı sağlayacak şekilde test edilir.
- **S76** Dumanın arkasındaki rakibin **isim etiketi, hedef çerçevesi veya önleme işareti**
  konumunu kusursuz biçimde göstermez.
- **S77** Görünmezlik sırasında gemiyi **ele veren hedef işaretleri ve efektler** de ele alınır.
  Ateş edilince görünmezlik bozulur. **Görünmezlik ile hasar almama ayrı mekaniklerdir.**
- **S78** **Turbo tek başına garantili kaçış sağlamaz**; duman ve yön değişimiyle doğru
  kullanıldığında takipten kurtulma fırsatı yaratır.
- **S79** Çıkışta **tamamen durma ve 3 saniye hasar almama** şartı korunur. Çıkış noktalarının
  **sürekli avlanma alanına dönüşme** riski test edilir; gerekirse yerleşim ve çevre düzeni önerilir.

## 18. İlk oynanabilir aşama ve sahiple inceleme

- **S80** Önce **temel uçuş ve çok oyunculu çatışmanın** denenebildiği oynanabilir bir prototip
  kurulur. Bu aşamaya gelince **kapsam büyütülmeden** sahibe inceletilir. Birlikte bakılacaklar:
  **dikey ekranda kontrol rahatlığı, hareket ve hız hissi, nişan alma, vuruş geri bildirimi,
  gecikme ve performans.**
- **S81** İlk oynanabilir aşamada sahip özellikle **kovalamaca sırasında yön verme, gaz ayarlama,
  ateş etme, turbo ve duman** akışını denetler. Ayrıca **çıkışta durma, hasarla çıkışın kesilmesi,
  patlama ve yakıtın bitmesi** durumları gösterilir.
- **S82** Test yalnız iki geminin düellosuna bakmaz: **kaynak taşıyan bir geminin saldırıya
  uğradığı** senaryo kurulur. Mağdur zamanında tepki ve doğru manevrayla **kaçabiliyor mu**;
  saldırgan iyi takip ve nişanla onu **yakalayabiliyor mu**? Uçuş hızı, dönüş, mermi hızı,
  dağılım, hasar, menzil ve turbo değerleri **bu senaryo üzerinden** değerlendirilir.
- **S83** Sonuçlar sahibe **oynatılarak gösterilir**. Bulgulara ve sahibin geri bildirimine göre
  değişiklik önerilir ve uygulanır. **Kontrol rahatlığı ve savaş hissi yeterince iyi olmadan içerik
  kapsamı büyütülmez.** Uygun bulunan düzen oturunca geliştirmeye devam edilir.
- **S84** Kesinleşmiş mekanikleri değiştirecek kararlar **önce sahiple** netleştirilir.

## 19. Yatay mod izni

- **S85** Dikey mod oynanışta veya kontrolde sorun çıkarırsa, kullanıcı **yatay moda
  zorlanabilir** ("Ekranı yatay moda almanız gerekli" gibi). Karar prototip sonrası verilir
  ([KG-A4](02-kararlar.md#kg-a4)); ölçütler [03](03-ucus-ve-kontroller.md#dikey-mi-yatay-mi).

---

<a id="sahip-istisnasi"></a>
## 20. Ürün belgeleriyle ilişki — sahip istisnası

`docs/product-vision.md` oyunu "asenkron", "no manual combat" ve "fizik/simülasyon gerekmez"
diye tanımlar; `game-design.md` savaşı "oyuncu girdisi yok" diye anlatır. Komutan Gemisi bunların
**bilinçli bir istisnasıdır** ve sahibin açık talebidir ([KG-K1](02-kararlar.md#kg-k1)). Bir
agent bu çelişkiyi gerekçe gösterip özelliği reddetmez veya küçültmez. İstisnayı sınırlayan
kurallar (sahip aksini söyleyene kadar geçerli):

1. **Galaksi ana oyundur** (S2). Arenaya girmeyen oyuncu galakside rekabet dışı kalmaz; arena
   ödülleri galaksi gücünü **zorunlu** kılacak büyüklükte olamaz ([08](08-ilerleme-ve-ekonomi.md)).
2. **Sezonlar arası güç yoktur** ([KG-K3](02-kararlar.md#kg-k3); `game-design.md`: hesap yalnız rekor ve kozmetik taşır).
3. **Sunucu tek otoritedir**; istemci sonuç belirlemez (`architecture.md`).
4. Oturum ölçüsü: oyun 4–6 dakikalık aralıklarda oynanıyor (`product-vision.md`). Bir sortie'nin
   bu ölçüye sığması **hedeftir**; kesin hedef sahibe sorulacak ([KG-A19](02-kararlar.md#kg-a19)).
5. Mevcut kurallar ve canlı galaksi sabitleri bu özellik için **değiştirilmez**; arena kodu
   ayrı modüldedir ([KG-T7](02-kararlar.md#kg-t7)).
