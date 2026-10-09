# Asteroid spawn — prod incelemesi, 2026-10-09

İncelenen prod sürümü: `900b18a842111e9d205bd420b33293e4ba276e8a`.
Bu rapordaki saatler, aksi belirtilmedikçe Türkiye saati (UTC+3).
Veriler canlı sistemin belirli anlardaki okumalarıdır; güncel sayaç olarak kullanılmamalıdır.

**Sonuç:** Bugünkü yoğunluk için deployment'ın takvimi yeniden üretmesi veya kuyruğun aynı
spawn'ı tekrar çalıştırması yönünde kanıt yok. EU-1'in 120 saklanan saatindeki doğal üretim
şeritleri ve nüfus ortalamaları yeniden hesaplandı; sapma bulunmadı. Bugünkü fazla görünüm,
yüksek çarpan, ilk beş dakikaya ayrılan üretim, altı saatlik nüfus ortalaması ve cevher artığı
taşıyan kayaların sahada kalmasıyla açıklanıyor. Ayrıca başka koşullarda gerçek fazlalık
yaratabilecek üç operasyon/uygulama açığı bulundu: süre değiştirmeyen `restamp`, saat yaşı
sınırlanmayan nüfus geçmişi ve üretim girdilerinin eksik dondurulması.

**Yapılan işlemler ve sınırları**

Owner önce 30, ardından 40 kaya kaldırılmasına izin verdi; uygulanan ilk miktar 40'tır.
Sonraki isteği üzerine 20 kaya daha kaldırıldı. Toplam 60 farklı asteroid kaldırıldı.

| İşlem | EU-1 genelinde işlem öncesi | İşlem sonrası, aynı an | Aktif filo hedefi etkilenen |
| --- | ---: | ---: | ---: |
| 20:40:37 — 40 kaya | 89 | 49 | 0 |
| 20:48:46 — 20 kaya | 41 | 21 | 0 |

Kayalar bağımsız dünya satırları değildir. Kaldırma, seçilen asteroidlerin
`asteroid_claims.ore_taken` değerlerini kendi cevher toplamlarına getirerek yapıldı.
Üretim şeritleri, asteroid indeksleri/yörüngeleri, takvim, filolar ve zamanlanmış işler
değiştirilmedi. Her işlem önce aynı transaction içinde denenip geri alındı; uygulamada
sezonun parent kilidi altında aktif hedefler tekrar kontrol edildi. İşlem öncesi değerler
veritabanı yazısından önce diske kaydedildi. İşlemler 40 ve 20 farklı claim ile sınırlandı.
SSE için mevcut `mining` invalidation yayımlandı.

Prod host üzerindeki kayıtlar:

- `/home/yildirim/astera-operator-audits/asteroid-remove40-20261009-20261009T174016192Z/`
- `/home/yildirim/astera-operator-audits/asteroid-remove20-20261009T174836642Z/`

İki dizinde de `before.json` ve `after.json` bulunur. Kod deploy edilmedi veya servis
yeniden başlatılmadı. Bu iki yetkili temizliğin dışında prod incelemeleri salt okunurdu.

**Prod'da doğrulananlar**

- Üç API ve bir prod worker aynı image üzerinde. Worker son olarak 8 Ekim 16:54'te açılmış;
  bugünkü shower sırasında restart olmamış.
- EU-1 dinamik alana sezon başlangıcından itibaren geçmiş; legacy takvim yok. Eski sabit
  alan ve dinamik alan birlikte üretmiyor.
- 120 saatlik doğal şeridin tamamı `planAsteroidHour` ile uyumlu. Saklanan üretim nüfuslarının
  tamamı da aynı raw geçmişten yeniden hesaplanan ortalamayla uyumlu.
- EU-1 saatleri arasında en büyük aralık bir saat: eksik saat yok.
- Mükerrer `asteroid_hour`, mükerrer shower penceresi ve çakışan shower çifti: sıfır.
  Spawn event'lerinde birden fazla deneme: sıfır.
- Canlı sezonlardaki tüm version-10 shower pencereleri 30 dakika. EU-1'deki 58 version-10
  oluşumun hiçbirinde süre hatası yok. EU-1/EU-2'deki iki version-9 geçmiş oluşumun 60 dakika
  olması kendi eski tanımlarıyla uyumlu.
- Son kontrollerde dört rolün health sonucu temiz; failed event, stranded flight,
  worker tick error ve handler failure sıfır.
- Tek manuel bonus şeridi 4 Ekim 23:00 saatinde 10 kaya. Bugüne kadar yaşamış olamaz.

**1. Aktif nüfus, anlık online nüfus değil**

[`asteroidSpawn.ts`](../apps/server/src/services/asteroidSpawn.ts), `countEligibleCommanders`
son 60 dakikada API kullanan uygun insanları ve aktif, emekli olmayan botların yarısını sayıyor.
`rollingSupply` bu raw sayının son altı kayıt üzerinden ortalamasını alıyor. Kurucu gününde
ortalama yerine raw sayı kullanılıyor. Yeni hesaplar için yaş/Core kapıları var; kurucu ve
sezondan eski hesaplar bu kapılardan muaf.

Bu akşam saat 20:00'de raw uygun nüfus 36, üretim nüfusu 35. Ortalama, 15:00–20:00 raw
değerleri `38, 36, 39, 32, 31, 36` üzerinden geliyor: `round(212 / 6) = 35`.
Başka bir okumada son beş dakikada 16 insan, son bir saatte 32 insan ve 5 bot vardı.
Ekrandaki online sayısını doğrudan üretim formülüne koymak bu nedenle yanlış sonuç verir.

Üretim hesabı mevcut kaya/cevher stokunu veya gerçek madencilik tüketimini girdi olarak almıyor.
Alan doluyken, oyuncular başka faaliyetlerdeyken veya nüfus kısa süre önce düşmüşken de
üretim sürebilir. Prospector sahipliği sayılma koşulu değil; ancak bu incelemede bir saat
aktif olan 32 insanın tamamında evde veya uçuşta Prospector bulundu. Dolayısıyla bugün için
"madencilik gemisi olmayan hesaplar çoğunluğu oluşturuyor" açıklaması desteklenmiyor.

**2. Aynı event toplamının daha kısa sürede gelmesi ve ek normal üretim**

[`constants.ts`](../packages/rules/src/constants.ts), `GALAXY_EVENTS`: 5 Ekim'deki
`5279c7c` değişikliği, hafta içi akşam shower'ını 60 dakika x3'ten 30 dakika x6'ya çevirmiş.
Yeni takvim satırları 5 Ekim 22:57'de oluşturulmuş; 8 Ekim deploy'u bunları yeniden üretmemiş.

35 kişilik sabit üretim nüfusunda:

- Eski 20:00–21:00: `35 × 3 × 1 = 105` kaya.
- Yeni 20:00–20:30: `35 × 6 × 0.5 = 105` kaya.
- Yeni 20:30–21:00 normal üretim: `round(35 × 0.5) = 18` kaya daha.
- Yeni 20:00 saatinin toplamı 123. Dolayısıyla yalnızca event içi toplamın aynı kalması,
  saatin veya günün toplam arzının aynı kaldığı anlamına gelmiyor.

Günler arasındaki gerçek akşam oluşumları da nüfus artışını gösteriyor:

| Gün | Üretim nüfusu | Shower çarpanı/süresi | Shower kayası |
| --- | ---: | --- | ---: |
| 5 Ekim | 20 | x3 / 60 dk | 60 |
| 6 Ekim | 19 | x6 / 30 dk | 57 |
| 7 Ekim | 33 | x6 / 30 dk | 99 |
| 8 Ekim | 44 | x6 / 30 dk | 132 |
| 9 Ekim | 35 | x6 / 30 dk | 105 |

Her deployment ile artan sabit bir sayaç görünmüyor. Aynı version-10 tanımı içinde bile
nüfus değiştikçe sayı yükselip düşüyor. Hafta sonu akşam x10: aynı 35 nüfusta 175 kaya/30 dk.

**3. İlk beş dakikadaki yoğunlaşma**

[`asteroidDynamic.ts`](../packages/rules/src/asteroidDynamic.ts), `planAsteroidHour`
bugünkü shower için 105 kaya ve `frontCount = 44` yazmış. `generateAsteroidHour` bu 44'ünü
ilk beş dakikaya; kalan 61'ini bütün 30 dakikaya dağıtıyor. Kalanların da ilk beş dakikaya
düşmesi mümkün. Prod'un gerçek anahtarıyla hesaplanan sonuç: ilk beş dakikada 52 kaya.

Bu, toplam 105'i aşan yeni üretim değil; geliş zamanlarının yoğunlaşması. Eğer ürün hedefi
"bonusun yalnız yarısı ilk beş dakika, diğer yarısı sonraki dakikalar" ise mevcut dağıtım
bunu tam karşılamıyor. Mevcut testler ayrılan front grubun ilk beş dakikada olduğunu
doğruluyor; diğer grubun o aralığa girmesini yasaklamıyor.

**4. Maden artıkları yeni spawn gibi kalabalık görünür**

[`mining.ts`](../apps/server/src/services/mining.ts) alanı yalnızca `oreRemaining > 0`
koşuluyla gösteriyor. Kaya ömrü 2.5–5 saat; shower'ın bitmesi kaya ömrünü bitirmiyor.
100 cevheri kalan kaya hâlâ bir kaya. Son iki saatte sık kullanılan madencilik
bileşimlerinden biri tek gemi / 700 kapasiteydi; 800'lük kaya bu seferden sonra 100 bırakır.

[`Asteroids.tsx`](../apps/web/src/galaxy/Asteroids.tsx) boyutu kalan cevherden değil
orijinal `level` üzerinden belirliyor. Küçük artıklar aynı büyük modelle sahada durabiliyor.
20:53:42 kontrolünde kalan 16 kayanın 14'ü kısmen kazılmıştı; 13'ünde en fazla 300 cevher
vardı. Bu dağılım iki manuel temizliğin SONRASINA aittir; ilk 95 kayanın dağılımı olarak
yorumlanmamalı.

İki temizlik arasında yalnızca iki yeni kaya doğmuş: 20:42:32 ve 20:46:25. İkisi de
20:30–21:00 normal şeridinden. İlk 40 kayadan hiçbiri geri gelmemiş. Oyuncunun sensörlerine
göre gördüğü sayı galaksi toplamından farklı olabilir; örneğin oyuncunun gördüğü 26 ile
sunucunun o anda hesapladığı 41 aynı kapsam değildir.

**5. Restart'ın gerçek bir anlık yığılma yaratabildiği koşul**

[`asteroidSpawn.ts`](../apps/server/src/services/asteroidSpawn.ts), `openAsteroidHour`:
worker saat başından en fazla beş dakika sonra yetişirse bütün saat başlangıçtan planlanıyor.
Ancak bu senaryo, o saatin satırı henüz oluşturulmamışsa geçerli. Satır varsa primary key ve
`onConflictDoNothing` ikinci bir saat üretimini engelliyor.

Bugünkü gerçek üretim anahtarıyla, saklanan saate dokunmadan hesaplanan alternatif ilk açılışlar:

| İlk açılış gecikmesi | Planlanan saat toplamı | İlk okumada zamanı geçmiş kayalar |
| --- | ---: | ---: |
| 0 dk | 123 | 0 |
| 1 dk | 123 | 16 |
| 4.99 dk | 123 | 52 |
| 5.01 dk | 105 | 0 |
| 10 dk | 88 | 0 |

Bu bir beş dakika eşiği: 20:04:59'da açılan eksik saat, yaklaşık 52 kayayı bir anda görünür
yapabilir. Beş dakikadan sonra yalnız kalan süre planlanır ve front-load yeniden uygulanmaz.
Tamamen kaçırılan saatler geri doldurulmuyor. Bugünkü saat 20:00:00.993'te açılmış;
bu restart senaryosu bugünkü olayın nedeni değil.

**6. `restamp` süre/çarpan karışımı oluşturabilir — prod'da şu an yok**

[`galaxyEvents.ts`](../apps/server/src/services/galaxyEvents.ts), `restampFutureOccurrences`
yalnız `effect` ve `definitionVersion` güncelliyor. `endsAt` ve ilgili end job'unun zamanı
değişmiyor. Eski 60 dakikalık satır yeni x6/version-10 ile damgalanırsa:
`35 × 6 × 1 = 210` kaya; güncel 30 dakikalık event'in 105'inin iki katı.

`syncMissingFixedOccurrences` varlığı kind+başlangıç zamanı ile kontrol ettiğinden bu hibrit
satırı düzeltmez. Ayrıca 12:30 gibi saat ortasında açılan bir future event restamp edilirse,
12:00'de zaten dondurulmuş saatlik şerit eski etkiyi koruyabilir; sonraki saat yeni satırı
okur. Takvim banner'ı ile saklanan üretim hesabı ayrışabilir.

Bugünkü canlı sezonlarda yeni sürüm/yanlış süre birleşimi bulunmadı. Kalıcı koruma,
süre/pencere şekli değiştiğinde `restamp`'in bu işlemi reddetmesi ve yalnız uygun gelecek
sınırda takvim adoption yolunun kullanılmasıdır. Canlı saatlik şeritleri yeniden boyutlamak
güvenli bir çözüm değildir.

**7. Uzun kesintiden sonra eski nüfus hâlâ sayılabilir — prod'da bugün yok**

`rollingSupply`, son beş CLOCK saatini filtrelemiyor; son beş saklanan satırı alıyor.
Saatlik kayıtlar uzun bir outage nedeniyle eksikse, günler önceki kalabalık saatler ortalamada
kalabilir. Saf kural örneği: şimdi sıfır uygun nüfus, geçmiş beş kayıtta 50 → üretim nüfusu
42. Sıfır raw nüfus devam ederse sonraki sonuçlar `42, 33, 25, 17, 8, 0`.

Bu, kesintisiz bir akşamdan sonraki normal yumuşatmayla aynı sayıları üretir; sorun, geçmiş
kayıtların yaşına bakılmamasıdır. EU-1'in kayıtları birer saat arayla kesintisiz olduğu için
bu açık bugünkü sayıları açıklamıyor. Koruma, zaman aralığıyla sınırlı geçmiş okumak ve
eksik saatlerin ne anlama geldiğini açıkça tanımlamaktır.

**8. Bazı kural deploy'ları tükenmiş kayayı yeniden görünür yapabilir**

Dinamik saatler count/frontCount ve seviye ağırlıklarını donduruyor. Fakat generator hâlâ
güncel global cevher tablosunu, yaşam süresini, hız/yörünge sınırlarını, seviye açılma
takvimini ve front-load dakika değerini okuyor. Bunlar saat satırının tam snapshot'ı değil.

Örneğin kayada 2,400 cevher vardı ve claim 2,400 oldu: kaya görünmez. Yeni image aynı
seviyeye 4,800 cevher verirse aynı indekste 2,400 kalan hesaplanır ve kaya tekrar görünür.
Bu koşul yerel, izole süreçte aynı RNG/saklanan saat girdisiyle doğrulandı. Yaşam süresi
artırılması da saat hâlâ lookback içinde ise süresi dolmuş kayaları tekrar aktif yapabilir.

Bugün incelenen son deploy'larda bu asteroid girdileri değişmemiş; ilgili cevher/ömür
değişiklikleri mevcut sezonun öncesinde. Bu, bugünkü geri gelme iddiasının açıklaması değil.
Gelecekte güvenli değişim için bu girdiler generation sürümü/snapshot ile eski saatlere
sabitlenmeli; yeni değerler yalnız yeni saatlere uygulanmalı.

**Diğer kontrol edilen ihtimaller**

- Aynı dinamik shower'ın iki özdeş satırı çarpanları toplamaz: planner `Math.max` kullanır.
  Bu durum yerel kontrolle de doğrulandı. Farklı zamanlara yayılmış fazladan pencereler süreyi
  büyütebilir; legacy lane generator ise occurrence'ları ayrı ekler. Prod'da ikisi de yok.
- Her segmentte bağımsız `Math.round` küçük farklar yaratabilir; örneğin 35 kişinin yarım
  saatlik normal üretimi 18 olur. Bu, onlarca kayanın katlanmasını açıklamaz.
- Alan için mevcut canlı kaya stoğuna bağlı bir limit yok; `indexSpanPerHour=100000`
  yalnız teknik indeks kapasitesidir.
- Üç API kendi başına kaya eklemiyor. Aynı saklanan saatten aynı indeksleri hesaplıyor.
  Ham alanın indekslerinin benzersizliği de doğrulandı.
- Client'ın mining birleşimi eski/yeni asteroid listelerini append etmiyor; mevcut field
  cevabını map ediyor. Instanced rock sayısı bucket dizisinin uzunluğundan geliyor.
  Bu incelemede prod'a oyuncu olarak giriş veya browser üzerinden görüntü doğrulaması yapılmadı.
- İzotop kayaları araştırma olmadan kazılamaz; kullanılabilir hedef miktarı ile üretim nüfusu
  ayrışabilir. Bir okumada bir saat aktif insanların 20'sinde ilgili araştırma vardı.
  Bu, üretilen indeks sayısını artırmaz; bazı kayaların daha yavaş tüketilmesine yol açabilir.

**Önerilen düzeltme sırası**

1. `restamp` için sürüm/süre/pencere uyumluluğu kontrolü; hibrit takvim satırını reddetme.
2. Nüfus geçmişini son gerçek saatlerle sınırlandırma; kesinti ve eksik kayıt regresyonları.
3. Dondurulmuş saatlerin generation sürümünü/girdilerini tamamlama; ore/expiry değişiminde
   mevcut claim ve filo kimliklerinin korunmasını doğrulama.
4. İlk beş dakika için hedefin "ayrılmış minimum" mu "yalnız bu kadar bonus" mu olduğunu
   kesinleştirip dağıtım testlerini buna göre kurma. Late-start eşiği için ilk okumada gelen
   kaya sayısına ayrı regresyon ekleme.
5. Güncel stok, madencilik tüketimi ve küçük artıkların görünümü için tasarım kararı.
   Çarpanı veya yaşam süresini körlemesine değiştirmek, bugün düzgün saklanan saatleri
   yeniden üretmek ya da kıymetli cevheri otomatik silmek bu raporun önerdiği bir işlem değil.

**Doğrulama**

- Saf kurallardaki odaklı beş dosya: 70/70 test geçti.
- Yerel deterministik kontroller: v9/v10 toplamları, yanlış süreli restamp örneği,
  özdeş çakışmanın dinamik üretimi katlamaması, nüfus düşüşü ve ore değişimiyle yeniden
  görünme örneği doğrulandı.
- Prod'da 120 saat / bütün doğal şeritler / bütün nüfus ortalamaları yeniden hesaplandı.
- 20:53:42'de kaldırılan 60 farklı indeksin tamamı hâlâ tükenmişti; aktif filo hedefi sıfır.
- Sonraki dört health kontrolü temiz. Test amacıyla prod takvimine veya spawn şeritlerine
  hiçbir yazı yapılmadı; uzun ekonomi/sezon simülasyonu çalıştırılmadı.
