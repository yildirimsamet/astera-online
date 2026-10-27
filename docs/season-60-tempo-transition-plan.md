# 60 günlük sezon ve tempo geçişi — uygulama planı

**Durum:** Gereksinimler ve kod incelemesi tamamlandı; oyun değişiklikleri henüz uygulanmadı.
**Belgenin kapsamı:** Uygulama, regresyon testleri ve sezon sınırındaki yayın için referans plan.
**Başlangıç:** Önümüzdeki sezon ve onu izleyen sezonlar. Mevcut sezonun süresi ve kuralları korunacak.

## 1. Kesinleşen gereksinimler

Oranların tamamı **bugünkü çalışan değerlere ek olarak** uygulanacak; eski bir denge profiline dönülmeyecek.

| Konu | Karar | Örnek / açıklama |
| --- | --- | --- |
| Sezon uzunluğu | Tam 60 × 24 saat | Takvimde iki ay eklemek kullanılmayacak. |
| Alaşım rafinerisi | Her seviyede saatlik çıktı ×0,85 | 100 kaynak/saat → 85 kaynak/saat. |
| Kristal rafinerisi | Her seviyede saatlik çıktı ×0,85 | Seviye eğrisi ve bonus oranları korunacak. |
| Döteryum rafinerisi | Her seviyede saatlik çıktı ×0,85 | Seviye 0 yine üretmeyecek. |
| Üretim ve araştırma | Mevcut süre ×1,15 | 100 dakika → 115 dakika. |
| Gemi ve koloni arızası tamiri | Mevcut süre ×1,15 | Her iki tamir hesabı da kapsama dahil. |
| Oyuncu gemileri, probe ve kazıcı | Mevcut uçuş hızı ×0,90 | Aynı sabit mesafede kesin uçuş süresi ÷0,90. |
| Korsan ve NPC tüccar | Mevcut hareket hızı ×0,90 | Filo hızından türeyen değerlere ikinci çarpan eklenmeyecek. |
| Gezegenler | Üç boyut referansı ve aradaki büyüme eğrisi ×0,80 | Gerçek koordinatlar ve harita mesafeleri değişmeyecek. |
| Depo ve toplama havuzu | Kaynak kapasiteleri korunacak | Aynı seviye ve aynı bonusla aynı miktar kaynak sığacak. |
| Kasa koruması, konvoy ödül tavanı ve tatil bedeli | Üretim saati kuralları korunacak | Yeni üretime bağlı kaynak karşılıkları azalabilecek. |
| Sezon evreleri | Mevcut açılış günleri korunacak | Yaklaşık 8,57 / 17,14 / 25,71. gün. |
| Ölüm Yıldızı ve radyasyon bombaları | Kendi özellikleri değişmeyecek | İmalat süreleri, uçuş hızları, fiyatlar, hasar ve etki parametreleri korunacak. |

### Kapsam sınırları

- Süre artışı; bina, sensör/cihaz, uydu, araştırma, gemi, kazıcı, toplayıcı, yer savunması, gemi tamiri ve koloni arızası tamirini kapsar. Önleyici mühimmat imalatı da kapsamdadır.
- Ölüm Yıldızı ve bütün radyasyon bombası seviyeleri, genel imalat süresi artışının istisnasıdır. Onlarla ilişkili araştırmalar normal araştırma kuralını izler; araştırma açılış günleri korunur.
- Uçuş değişikliği galaksi haritasındaki araçlara uygulanır. Komutan Gemisi / gerçek zamanlı Savaş Alanı pilotaj parametreleri bu harita temposu değişikliğinin kapsamı değildir.
- Asteroit hızları ve ömürleri, anıt hareketi ve üretimi, zamanlı galaksiler arası konvoyun 180 dakikalık hareketi korunur. Bu konvoya gönderilen oyuncu gemileri normal filo kuralıyla yavaşlar.
- Yakıt tarifeleri, fiyatlar, gemi savaş istatistikleri, kargo kapasiteleri, araştırma/uydu bonus oranları, muharebe süresi, bekleme süreleri, sadakat ve kalkan yenilenme parametreleri yeniden dengelenmez.
- Görev, kuyruk ve bonus sürelerine toplu bir dünya hızı çarpanı uygulanmaz. Yalnız yukarıdaki hesaplar değiştirilir.

**Matematik:** Süreyi ×1,15 yapmak işleme hızını yaklaşık %13,04 azaltır. Owner'ın 100 → 115 dakika örneği bağlayıcıdır; kuyruklarda ÷0,85 kullanılmayacak. Uçuş hızını ×0,90 yapmak ise sabit mesafedeki kesin süreyi yaklaşık %11,11 uzatır; hareketli hedeflerde buluşma noktası da değişebilir.

## 2. Mevcut kod ve hedef değerler

### 2.1 Sezon takvimi ve fiyatlandırma

Kaynaklar: [ekonomi profili](../packages/rules/src/economy-profile.ts), [sezon sabitleri](../packages/rules/src/constants.ts), [sezon oluşturma ve evre onarımı](../apps/server/src/services/season.ts), [sunucu yenileme](../apps/server/src/services/servers.ts), [WAITING sezonları](../apps/server/src/services/waitingServers.ts).

| Ayar | Mevcut | Hedef |
| --- | --- | --- |
| `ECONOMY_PROFILE.id` | `season-30-v1` | `season-60-v1` |
| `ECONOMY_PROFILE.seasonDays` | 30 | 60 |
| `ECONOMY_PROFILE.progressionDays` | 30 | **30, değişmeyecek** |
| `SEASON.actBoundaries` payları | 4/14, 8/14, 12/14 | 1/7, 2/7, 3/7 |
| `SEASON.afterglowMinutes` | 5 | 5 |

- Yeni sezonun `endsAt` değeri başlangıçtan 60 gün sonra olacak. Varsayılan oluşturma, bootstrap, CLI ve otomatik rollover aynı varsayılanı kullanacak.
- Fiyatlandırma ufku takvimden ayrı tutulacak. `progressionDays = 60` bazı bina maliyetlerini yaklaşık ikiye, bazı araştırma fiyatlarını daha da fazla büyütebilir. Örnek: Core 12 referans alaşım fiyatı 30 günlük ufukta 7.327, 60 günlük ufukta 14.654 çıkıyor.
- Evre payları, 60 günlük varsayılan sezonda mevcut günleri koruyacak şekilde yarılanacak. Oluşturma, `ensureSeasonActs`, araştırma erişimi ve Wiki birlikte doğrulanacak.
- `INTERCEPTION_GRID` ve `STRATEGIC_STOCKPILE` savaş evresinden açılış zamanı türetiyor. Sezonu uzatırken bu araştırmaların açılışı iki kat geciktirilmeyecek.
- WAITING sezonu kendi oluşturulduğu günden itibaren yeni 60 gün almayacak; kaynak MAIN sezonunun dönemini ve mevcut kurallarını miras almaya devam edecek.
- Test/geliştirme amaçlı açık `--days` / `days` değerleri kaldırılmayacak. Bu kısa sezonlar için evre testleri yeni paylarla tutarlı olacak; üretim varsayılanı 60 gündür.
- `MONTHLY_REFERENCE` ve geçmiş ölçüm tabloları takvim 60 oldu diye ikiyle çarpılmayacak. Fiyat, başlangıç kaynağı ve sabit ödül katalogları korunacak.

### 2.2 Rafineriler, depo ve havuzlar

Kaynaklar: [tempo](../packages/rules/src/tempo.ts), [ekonomi hesapları](../packages/rules/src/economy.ts), [ekonomi sabitleri](../packages/rules/src/constants.ts).

| Ayar / sonuç | Mevcut | Hedef |
| --- | --- | --- |
| `producerOutput` | 0,56 | `0,56 × 0,85 = 0,476` |
| `producerCapacityTime` | 1,25 | `1,25 / 0,85 ≈ 1,4705882353` |
| `ECON.collectorHours` | 12,5 | `12,5 / 0,85 ≈ 14,7058823529` |
| Depo ve havuzun kaynak kapasitesi | Mevcut miktar | Aynı miktar |

- `alloyRate`, `crystalRate` ve `deuteriumRate` aynı ek azaltımı kullanacak. Erken alaşım artışı ve geç seviye üretim eğrisinin şekli korunacak.
- `storageCap`, `collectorCap`, `deuteriumStorageCap` ve `deuteriumCollectorCap` aynı seviyelerde bugünkü kaynak miktarlarını vermeye devam edecek.
- `storageHours` içindeki aynı seviye rafineri yükseltmesini satın alabilme garantisi korunacak. Telafi hem taban kapasiteyi hem fiyat/üretimden türeyen dalı kapsamalı.
- Karşılaştırmalar farklı rafineri/Vault seviyeleri, döteryum tesisi 0, FOUNDRY bonusu ve yüksek seviyeleri içerecek. Yalnız eşit seviyeli örnekler yeterli değildir.
- Üretim kesintisi, Silent Space, recovery ve enerji bonusları altında gerçek üretim yeni orana inerken kapasite hesabı nominal üretimi kullanmaya devam edecek.
- Önceden biriken kaynakların kısılması, kaybolması veya telafi amacıyla yeni kaynak verilmesi gerekmiyor. Geçiş yeni sezon sınırında yapılacak.

### 2.3 Kuyruklar ve tamirler

Kaynaklar: [ortak süre hesapları](../packages/rules/src/economy.ts), [HP tamiri](../packages/rules/src/hpDamage.ts), [koloni tamiri](../packages/rules/src/faults.ts), [build kuyruğu](../apps/server/src/services/buildQueue.ts), [araştırma](../apps/server/src/services/research.ts), [gemi tamiri](../apps/server/src/services/repair.ts), [koloni tamiri servisi](../apps/server/src/services/faultRepair.ts).

| Ayar / sonuç | Mevcut | Hedef |
| --- | --- | --- |
| `buildTime` | 1,21875 | `1,21875 × 1,15 = 1,4015625` |
| Koloni tamirinde kullanılan `workRate` | 0,8 | `0,8 / 1,15 ≈ 0,6956521739` |
| `BUILD.capMinutes` | 585 | 672,75 |
| Koloni arızası tamir aralığı | 6,25–18,75 dk | 7,1875–21,5625 dk |

- Bina, sensör, uydu, araştırma ve gövde üretimi aynı ek süre çarpanını tam bir kez alacak.
- `shipHpRepairMinutes`, gövde iş süresinden türediği için ayrıca ikinci bir %15 uygulanmayacak. Koloni tamiri ayrı `workRate` hesabıyla güncellenecek.
- Mevcut süre tavanları aynı oranda büyüyecek. Sınırsız toplu gövde işine yeni tavan eklenmeyecek; robot/tersane indirimlerinin tavana göre uygulanma sırası değiştirilmeyecek.
- `readyAt` ve `remainingSeconds` aynı tam saniye hesabından üretilecek. Yuvarlama mevcut sınırda yapılacak; kesin süre oranı ile yuvarlanmış saniye oranı karıştırılmayacak.
- Kuyruk önizlemesi, kuyruktaki önceki işler nedeniyle projekte edilen seviyeler ve sunucunun ödeme anındaki hesabı tutarlı kalacak.
- İptal/iade, bağımlı kuyruk işleri, tatilde durdurma/devam ettirme, radyasyon nedeniyle atölye durması ve tekrar teslim edilen completion olayları korunacak.
- Bitişi sezon sonuna eşit olan iş de reddedilmeye devam edecek. Uzayan işlerde bu kontrol yeni bitiş zamanıyla ödeme yapılmadan çalışacak.

### 2.4 Özel silah istisnaları

Kaynaklar: [stratejik sabitler](../packages/rules/src/constants.ts), [radyasyon bombası hesabı](../packages/rules/src/radiationBomb.ts), [stratejik servis](../apps/server/src/services/strategic.ts), [bomba servisi](../apps/server/src/services/radiationBomb.ts).

- Ölüm Yıldızı ve radyasyon bombalarının bugün kullandığı `1,21875` imalat çarpanı, genel iş çarpanından ayrılacak. Anlamı açık tek bir özel silah imalat sabiti kullanılacak.
- Ölüm Yıldızı mevcut **73,125 dakika** nominal imalat süresini ve **1500** uçuş hızını koruyacak. Servisin mevcut tam saniyeye yukarı yuvarlaması korunacak.
- Radyasyon bombaları mevcut **2194 / 3291 / 4388 saniye** imalat sürelerini ve **1300** uçuş hızını koruyacak.
- Önleyici mühimmat genel `buildTime` artışını alacak; 8 saniyelik müdahale uçuşu ve şarj kuralları korunacak.
- Stok sınırları, fiyatlar, Core/Shipyard gereksinimleri, EMP, radyasyon süresi/yoğunluğu, sadakat ve arıza etkileri değişmeyecek.
- Gezegen küçülmesi ortak çizim geometrisini değiştirir. Silahın kendi boyutu veya mekaniği değişmeden yeni gezegen yüzeyinde doğru bitiş ve müdahale görüntüsü doğrulanacak. Radyasyon maruziyeti hesabında kullanılan dondurulmuş görsel yol da regresyon kapsamındadır.

### 2.5 Gemiler, hareketli hedefler ve gezegen boyutu

Kaynaklar: [filo profili](../packages/rules/src/economy-profile.ts), [araç sabitleri](../packages/rules/src/constants.ts), [gövde kataloğu](../packages/rules/src/hulls.ts), [seyahat](../packages/rules/src/travel.ts), [kazıcı hesapları](../packages/rules/src/galaxy.ts), [ortak görünüm geometrisi](../packages/rules/src/view.ts).

| Ayar / sonuç | Mevcut | Hedef |
| --- | --- | --- |
| `FLEET_SPEED_FACTOR` | 0,60 | 0,54 |
| `PROBE.speed` | 2632,5 | 2369,25 |
| `PROSPECTOR.speed` | 990 | 891 |
| Kazıcının yüklü dönüş hızı, bonus yokken | 495 | 445,5 |
| `WEIGHT_SCALE` | `1,25 × 1,3 × 0,8` | `1,25 × 1,3 × 0,8 × 0,8` |
| Core 1 / 11 / 22 yarıçapı | ≈ 0,37669 / 0,702 / 1,19852 | ≈ 0,30135 / 0,5616 / 0,95882 |

- Korsan ve tüccar hızları `FLEET_SPEED_FACTOR` üzerinden zaten azalır. Bu sabitlere bir kez daha ×0,90 eklenmeyecek.
- Taşıma gemileri, çöp toplayıcı ve destek gövdeleri kapsama dahil; sabit yer savunmasının hızı 0 kalacak. Kazıcının ayrı kataloğu ve profil istisnası kontrol edilecek.
- Filo en yavaş gövdeyle hareket etmeye devam edecek. Propulsion, Beacon, Derrick, taşıma gemisi hız bonusu ve yüklü dönüş oranı korunacak.
- `TRAVEL.distanceFactor`, gerçek koordinatlar ve görüş mesafeleri değişmeyecek. Uçuşu yavaşlatmak için harita veya mesafe faktörü büyütülmeyecek.
- Gezegenlerin üç boyut referansı aynı çarpanla küçülecek; Core seviyeleri arasındaki geometrik büyüme, oranlar ve alt/üst sınır korunacak. Üç düz boyuta geri dönülmeyecek.

## 3. Review bulguları ve mekanik etkileri

### 3.1 Kapasite telafisi yalnız kapasitede kullanılmıyor

`producerCapacityTime` şu hesaplara da giriyor:

- `FAULT.leakDrainHours`.
- Eski üretim geçişinin öncesini hesaplayan `advanceEconomy` dalı.
- Sunucunun üretken süre/telemetri hesabı.
- Worker geciktiğinde bilinmeyen sinyalin enerji bonusunu telafi eden hesap.

Kapasite telafisi artırıldığında `FAULT.leakDrainHours` kendiliğinden yaklaşık 70,59 saate çıkmamalı. Mevcut **60 saatlik parametre** kapasite telafisinden ayrılıp korunacak. Gelirin iki katı üst sınır ve bir depo toplam kayıp bütçesi mevcut kuralları izlemeye devam edecek; bu nedenle gerçek sızıntı miktarı bazı seviyelerde azalabilir. Bütün seviyelerde tam %15 azalacağı iddia edilmeyecek.

Eski geçiş dalındaki `producerOutput × producerCapacityTime` çarpımı bugün de hedefte de 0,70 verir. Bu eşitlik testle korunacak; eski dönem üretimi yanlışlıkla yeni azaltımı almamalı. Yeni sezonda geçiş anı başlangıçtır; mevcut sezonda ikinci bir tempo aktivasyonu yapılmayacak.

Enerji bonusunun süresi ve bonus oranı korunacak. Yeni sezondaki kaynak getirisi yeni rafineri üretimini izleyecek. Worker gecikmesiyle sonradan ödenen miktar, zamanında işlenmiş aynı senaryoyla eşleşmeli; kapasite telafisi bonusu ayrıca büyütmemeli.

### 3.2 Üretim saatine bağlı değerler azalabilir

Owner kararı: Bu mekaniklerin saat kuralları korunur; kaynak miktarlarını sabitlemek için yeni bir ekonomi referansı eklenmez.

| Hesap | Beklenen sonuç |
| --- | --- |
| Kasa koruması | Açılış tabanı ve saat tavanı nedeniyle her seviyede aynı oranda değişmez; 8 saat tavanına ulaşan koruma yeni üretime göre azalır. |
| Konvoy kaynak ödül tavanı | Aynı seviyede, yuvarlama farkı dışında yaklaşık %15 azalır. Konvoy hareket süresi değişmez. |
| Tatil bedeli | Nominal döteryum üretimi üzerinden azalır; süre sınırları ve sezon sonu kontrolleri korunur. |
| Yenilgi sonrası koruma / ağır kayıp uygunluğu | Üretim saati cinsinden eşik korunur. Aynı kaynak kaybı yeni üretime göre daha fazla emek saati sayılabilir; koruma ve koloni arızası uygunluğu test edilir. |
| Tarafsız gezegenler | Başlangıç kaynak stokları kapasite telafisiyle korunur; alaşım/kristal yeniden birikimi yavaşlar. |
| Klan ganimeti / kapasite hesapları | Üretim ve koruma hesapları yeni değerleri kullanırken depo ve kabul sınırları korunur. |

İnceleme sırasında aynı Core 12 örneğinde bir günlük başkent tatil bedeli **531 → 451 döteryum**, 8 saatlik örnek konvoy alaşım tavanı **11.329 → 9.630** çıktı. Aynı örnekte kasa alaşım koruması **11.330 → 9.630** olurken depo kapasitesi değişmedi. Bunlar uygulama sonrası kabul sonuçları değil, mevcut fonksiyonlarla geçici süreç belleğinde hesaplanmış etki örnekleridir.

### 3.3 Uçuş yavaşlamasının dolaylı etkileri

- Asteroitler aynı hızda kalırken kazıcı yavaşlar. Buluşma çözücüsü, hedef ömrü ve sezon sonuna yetişme gerçek örneklerle doğrulanmalı.
- Korsan ve tüccarın hız ilişkileri korunsa da ömürleri ve etkinlik pencereleri sabit kalır. Geç kalkışlarda ulaşılabilir hedefler değişebilir.
- 12 saatlik seçilebilir tempo sınırı sabittir; bazı yavaş tempo seçenekleri artık sunulmayabilir. Tam hızın mevcut istisnası korunur.
- Radar uyarısı ve reaksiyon zamanı uzayabilir; savunma imalatı da %15 uzar. Uyarıdan sonra savunma yetiştirme ilişkisi tekrar doğrulanmalı.
- Radyasyonda geçirilen süre ve toplam doz artabilir. Özel silah hasar parametreleri sabit kalırken oyuncu filosunun daha uzun maruz kalması ayrı bir etkidir.
- Kazıcının kısa enkaz yolculuğu bekleme eşiği aynı süreye bağlı kalır; bazı yolculuklar eşiğin diğer tarafına geçebilir. Asteroit seferlerine yeni bekleme eklenmez.
- Yakıt tarifesi uçuş süresinden türemiyor. Aynı filo, mesafe, görev türü ve seçilmiş tempoda yakıt bedeli korunmalı; yavaşlamadan dolayı ayrıca yakıt indirimi/zammı eklenmemeli.
- Kolonileşme hakkı, ilk 60 dakikalık öncelik, klan yardımının kalışı, ortak saldırı buluşması, anıt hareketine yetişme ve geri çağırma senaryoları sınır zamanlarda test edilmeli.

### 3.4 Görsel boyut değişikliği

Gezegen yarıçapını ×0,80 yapmak ekrandaki yaklaşık alanı ×0,64 yapar. Mobilde seçilebilirlik yalnız %20 küçülmüş gibi değerlendirilmeyecek.

Kontrol edilecek yüzeyler: varsayılan ve kaplamalı gezegenler, yakın/uzak LOD, seçim halkası ve hitbox, işaretçiler, etiket/örtüşme hesapları, uydu ve Dyson halkaları, kamera odağı, enkaz, bombardıman ve gemilerin yüzey/yörünge açıklıkları.

Sunucu radar/traffic ve istemci kendi filo çizimi aynı `worldRadius` / `visualLeg` hesabını kullanmaya devam edecek. Yalnız istemcide model ölçeğini değiştirmek yeterli değildir. Sensörlerin oyun birimi cinsinden erişimi küçülmeyecek.

### 3.5 İkinci ay, ekonomi ve veri hacmi

- Yeni sezonun dinamik asteroit ve korsan üretimi 31–60. günlerde de devam etmeli. 30 günlük eski statik bütçe tablolarının sonundan sıfır dönmesi yeni sezonda yanlış kaynak yoluna düşüldüğünü gizlememeli.
- Tarihsel `MONTHLY_REFERENCE` / statik bütçeleri 60 güne uzatmak veya yeni gelirle yeniden kalibre etmek bu değişikliğin otomatik bir parçası değildir. Eski sezon alanlarını yeniden üretip değiştirmekten kaçınılacak.
- Saatlik dinamik hedef kimlikleri, etkinlik sıraları, dedupe anahtarları, saat sonu ve sezon sonu kesimleri 60 günlük aralıkta doğrulanacak.
- `generateGalaxy` eski statik asteroit takvimini de üretiyor. Takvim uzaması bu yolun belleğini/oluşturma maliyetini büyütebilir; başlangıç ve katılım maliyeti kısa ölçümlerle kontrol edilecek. Bu görev gereksiz bir mimari refaktöre dönüştürülmeyecek.
- Olaylar, raporlar, saatlik snapshot'lar ve sıralama kayıtlarının daha uzun birikmesi dikkate alınacak; mevcut saklama kuralları topluca ikiye katlanmayacak.
- 60 gün, ilerlemenin de tam iki aya yayılması anlamına gelmez. Aynı seviyede kesintisiz üretim için sezon toplamı eskiye göre 2 × 0,85 = **1,70** kattır. Kaynak sınırı yokmuş gibi yalnız süre üzerinden bakıldığında iş kapasitesi 2 / 1,15 ≈ **1,74** kattır. Bunlar oyuncu ilerlemesi tahmini değildir.
- Anıt üretimi, sabit ödüller, asteroit cevheri ve NPC ganimetleri rafineri azaltımını otomatik almaz. Rafinerilere göre göreli değerleri artabilir. Ek dengeleme ayrıca değerlendirilir; kendiliğinden uygulanmaz.

## 4. Dokunulacak alanlar

| Alt sistem | Ana kaynaklar | Yapılacak iş |
| --- | --- | --- |
| Ortak sayılar | `packages/rules/src/tempo.ts`, `economy-profile.ts`, `constants.ts` | Sezon, çıktı, kapasite, genel süre ve uçuş ayarları; özel silah/sızıntı ayrımı. |
| Ekonomi ve tamir | `packages/rules/src/economy.ts`, `hpDamage.ts`, `faults.ts` | Telafi, yuvarlama, bonus ve süre zincirlerini doğrulama. |
| Özel silahlar | `packages/rules/src/radiationBomb.ts`, `apps/server/src/services/strategic.ts`, `radiationBomb.ts` | İstisna sürelerini ve servis/önizleme tutarlılığını koruma. |
| Sezon yaşam döngüsü | `apps/server/src/services/season.ts`, `servers.ts`, `waitingServers.ts`, `apps/server/src/worker/handlers.ts` | 60 günlük varsayılan, evreler, bitiş ve kontrollü yenileme. |
| Kuyruk servisleri | `build.ts`, `buildQueue.ts`, `research.ts`, `researchQueue.ts`, `repair.ts`, `faultRepair.ts` | Ortak hesapların tüketildiği yollar; yalnız gerektiğinde değişiklik. |
| Üretim tüketicileri | `planet.ts`, `planetView.ts`, `unknownSignal.ts`, `neutral.ts`, `attackProtection.ts`, `clanLoot.ts`, `session.ts` | Yan etkiler ve gerçek/önizlenen üretim tutarlılığı. |
| Saat temelli kurallar | `packages/rules/src/vacation.ts`, `intergalacticConvoy.ts` | Mevcut kuralları yeni üretimle doğrulama. |
| Hareket ve görünüm | `packages/rules/src/view.ts`, `travel.ts`, `hulls.ts`, `galaxy.ts`; sunucuda mining/radar/traffic ve istemcide galaxy çizimleri | Tek çarpan, ortak geometri, ETA ve yakalama regresyonları. |
| Oyuncuya gösterilen bilgiler | `PlanetScreen.tsx`, uçuş/üretim önizlemeleri, Wiki `facts.ts`, season yüzeyleri | Yeni süre/oranların doğru gösterimi; ilgili açıklamalar ve çeviriler. |
| Yayın uyumluluğu | `apps/web/mobileBuild.ts`, `apps/web/capacitor.config.ts`, `apps/web/src/platform/updateGate.ts`, `apps/server/src/app.ts`, `env.ts` | Native build sınırı ve eski istemci davranışı. |
| Referans belgeler | `docs/balance.md`, `docs/game-design.md`, `docs/deployment.md` | Aktif profil, dönem ve yayın bilgisini güncelleme. |

Bu tablo bağımlılık haritasıdır; her dosyada değişiklik zorunlu değildir. Ortak fonksiyondan doğru değeri alan servis yeniden yazılmayacak. Mevcut ilgisiz çalışma ağacı değişikliklerine dokunulmayacak.

## 5. Test planı ve kabul kriterleri

### Uygulama sırası

1. Mevcut fiyat, kapasite, süre, hız ve istisna değerlerini yeni regresyon testlerinde bağımsız referans olarak kaydet.
2. Yeni gereksinim testlerini önce çalıştırıp ilgili başarısızlıkları göster.
3. Ortak sabitleri ve gerekli ayrımları uygula; ardından bağlantılı servis/istemci hesaplarını düzelt.
4. Hedef testleri geçir; code review ve kapsamlı olağan doğrulamayı tamamla.
5. Gerçek tarayıcıda mobil/masaüstü görsel doğrulama ve izole sezon geçiş provası yap.

### Zorunlu senaryolar

| Alan | Kabul ölçütü |
| --- | --- |
| Çıktı | Desteklenen rafineri seviyelerinde yeni nominal çıktı eski çıktının ×0,85'i; 0 üretim ve seviye monotonluğu korunuyor. |
| Kapasite | Farklı üretici/Vault seviyeleri ve bonuslarda depo/havuz miktarları mevcut referansla eşleşiyor; döteryum tesisi 0 örneği dahil. |
| Kaynak hareketi | Çevrimdışı birikim, kısmi toplama, dolu havuz, dolu depo, üretim kesintisi ve madencilik dönüşünde taşma kuralları korunuyor. |
| Bonus/telemetri | Recovery + enerji + FOUNDRY + Silent Space birleşimleri; geciken worker telafisi; eski geçiş öncesi/sonrası parçalı hesap aynı toplamı veriyor. |
| Genel süreler | Bütün bina/sensör/uydu/araştırma/gövde türleri, toplu işler ve otomasyon seviyelerinde kesin süre ×1,15; saniye yuvarlaması yalnız mevcut sınırda. |
| Tamir | HP oranı, adet ve onarım yüzdesi; Honor indirimleri; koloni tamir RNG uçları; genel süre artışı iki kez uygulanmıyor. |
| Kuyruk yaşam döngüsü | Bağımlı işler, eşzamanlı istek, iptal/iade, tatil, atölye durması ve yinelenen completion olayları; sezon sonuna eşit/geç bitişte ödeme yapılmadan ret. |
| İstisnalar | Ölüm Yıldızı ve üç bomba seviyesinin fiyat, imalat, hız ve etki parametreleri eski referansla aynı; önleyici mühimmat yalnız imalatta ×1,15 alıyor. |
| Uçuş | Bütün hareketli gövdeler, probe, kazıcı, toplayıcı, korsan ve tüccarda tek ×0,90; karışık filo, bonus, yüklü/boş dönüş ve yakıt tutarlılığı. |
| Hareketli hedefler | Asteroit/korsan/tüccar/anıt/konvoy için ulaşılabilir ve ulaşılamaz örnekler; geç kalkış, hedef ömrü, geri çağırma ve sezon sonu. |
| Saat kuralları | Kasa koruması, sızıntı, konvoy tavanı, tatil bedeli ve yenilgi sonrası uygunluk mevcut saat sınırlarını kullanıyor; açılış tabanı ve tavan dalları ayrı test ediliyor. |
| Sezon | Varsayılan tam 60 gün; mevcut evre günleri; WAITING dönemi; birer end/rollover; eşzamanlı veya yeniden çalıştırılan rollover yalnız bir yeni dönem açıyor. |
| İkinci ay | 30→31. gün, 59→60. gün ve son anda dinamik hedefler/etkinlikler çalışıyor; bitişten sonra yeni üretim veya olay yok. |
| Arşiv/ödüller | Eski sezon kapanışı eski kurallarla tamamlanıyor; sonuçlar ve ödüller bir kez mühürleniyor; kalıcı hesap varlıkları korunuyor. |
| Görünüm | Tüm Core boyutları ×0,80; oranlar/NaN sınırları korunuyor; sunucu ve istemci aynı görsel yolu çiziyor; mobil seçim ve LOD doğru. |
| İstemci uyumu | Eski native build güncelleme akışına gidiyor; güncel paket çalışıyor; eski web sekmesi yeni sezona eski hesaplarla devam etmiyor. |

### Doğrulama sınırları

- Tarihli eski tempo testleri yeni aktif beklentilerle tutarlı güncellenecek. Davranış kontrolleri silinmeyecek veya yalnız yeni sabiti kendisiyle karşılaştıran testlere dönüştürülmeyecek.
- Ortak kurallar birçok sistemi etkilediğinden rules/server/web olağan regresyonları, typecheck ve lint kapsanacak. Komutlar [mühendislik standartlarına](engineering-standards.md) göre sırayla çalıştırılacak.
- Testler `nice -n 10`, tek workspace ve tek Vitest worker ile yürütülecek; Node heap 4 GiB'ı aşmayacak. Aynı anda test/typecheck/lint çalıştırılmayacak.
- Görsel doğrulama `node tools/visual.mjs` ile yapılacak; mevcut kullanıcı değişiklikleri korunacak.
- Uzun ekonomi/season/snowball simülasyonları yalnız ayrıca açık owner talebiyle çalıştırılabilir. Bu belge böyle bir çalıştırma talebi veya 60 günlük dengenin kanıtı değildir.

### İnceleme sırasında elde edilen kanıt

- Mevcut `tempo.test.ts`, `ship-speed.test.ts` ve `view.test.ts`: **3 dosya, 39 test geçti**. Bunlar değişiklik öncesi sonuçlardır.
- Mevcut ekonomi fonksiyonlarıyla süreç belleğinde yapılan kapasite telafisi kontrolü: **364 seviye/bonus kombinasyonu, 0 kaynak kapasitesi farkı**. Repo dosyaları değiştirilmedi; bu kontrol kalıcı regresyon testinin yerine geçmez.
- 1 Kasım 2026 UTC başlangıçlı örnek 60 günlük takvim: **436 olay**, geçersiz/sınır dışı pencere **0**. Üç olay türü de ikinci ayda devam ediyor. Bu sayı farklı başlangıçlar için sabit kabul kriteri değildir.
- Uygulama sonrası tüm kabul sonuçları henüz alınmadı. Geniş testler, canlı dağıtım veya yeni native paket doğrulaması yapılmış gibi raporlanmayacak.

## 6. Sezon sınırında yayın planı

### 6.1 Yayın önkoşulları ve istemciler

Ortak sabitler sezona göre seçilen ayrı tempo profilleri değil, çalışan sürümün değerleridir. Yeni paketi mevcut sezonda kısmen yayınlamak yalnız gelecek sezonu değiştirmez; mevcut üretim, teklif ve görüntüleri de etkileyebilir. Bu nedenle seçilen yöntem **eski sezon kapandıktan sonra kontrollü sürüm geçişidir**.

- API, worker ve web aynı kaynak sürümünden hazırlanacak; eski/new tempo karışımıyla trafik açılmayacak.
- Android production uygulaması web dosyalarını paketinden çalıştırır. Sunucuyu/webroot'u yayınlamak kurulu Android uygulamasını güncellemez. Yeni native paket hazırlanacak; dağıtım erişilebilirliği doğrulandıktan sonra `MIN_NATIVE_BUILD` ile eski paketler mevcut `426 UPDATE_REQUIRED` akışına yönlendirilecek.
- Yeni kuralları taşıyan native paket ve web bundle mevcut sezonda oynanacak istemci olarak erken devreye alınmayacak. Hazırlama/onay süreçleri ile oyuncuya açılma anı ayrılacak.
- Web'de `useSession.rollover` sorguları temizler ve yerleşimi sıfırlar; JavaScript paketini yeniden yüklemez. Eski sekmenin yeni sezona eski hız/kapasite hesabıyla girmesi yayın kabulünde başarısızlıktır. Kesimde tam sayfa güncellemesini sağlayan akış eski sekme üzerinden kanıtlanacak; yalnız SSE invalidation veya cache temizliği yeterli kabul edilmeyecek.
- Önceki plandaki “HTTP/istemci uyumluluğu değişikliği gerekmiyor” varsayımı kullanılmayacak. Yeni bir genel tempo API'si/DB göçü gerekmiyor görünse de, eski web sekmelerinin güncelleme akışı yayın önkoşuludur; mevcut kodda bu güvence doğrulanmış değildir. Bu konu çözümlenmeden dağıtım tamamlandı sayılmayacak.

### 6.2 Otomatik rollover ile yarışmayı önleyen devir

Yalnız “eski sezon bitince worker'ı durdur” talimatı yeterli değildir: normal worker eski sürümle yeni sezonu açabilir. Devir [yayın runbook'u](deployment.md) esas alınarak izole restore üzerinde prova edilecek.

1. Artefaktları ve geri dönüş kopyalarını önceden hazırla. İlgili bütün MAIN ve WAITING sezonlarını, bitiş/rollover olaylarını ve canlı işlerini envanterle; yalnız iki MAIN satırı olduğunu varsayma.
2. Sezon sınırında bakım erişimini doğrula; bütün API writer'larını ve worker'ı kontrollü durdur. Devam eden tick/transaction'ların bittiğini doğrula.
3. Bütün ilgili lifecycle olaylarının durumunu kontrol et. Açıklanamayan `processing`/`failed` varsa devri ilerletme. Eski sürümün yeni sezon açmasını önlemek için yalnız ilgili `pending season_rollover` olaylarını gözden geçirilmiş bakım işleminde geçici ileri bir tarihe ertele; özgün zamanları kaydet. Sezon `endsAt` veya `season_end` anı değiştirilmez.
4. API'ler kapalı kalırken eski worker'ın mevcut işleri ve eski sezon kapanışını eski kurallarla tamamlamasına izin ver. Erteleme süresi dolmadan izle; bütün ilgili sezonlar mühürlenmeden yeni sürümle kapanış hesaplama. İş silme veya zorla erken bitirme uygulanmaz.
5. Eski worker'ı durdur; bütün eski writer'ların kapalı olduğunu doğrula ve nihai tutarlı yedeği al. Yedek/restore gizlilik ve hesap silme kuralları mevcut runbook'a uygun kalacak.
6. Aynı sürümden yeni API/worker/web/native yayınını hazır duruma getir. Kontrollü rollover olaylarını özgün zamandan erken olmayacak şekilde, kapanış tamamlandıysa yeni worker'ın işleyebileceği ana geri koy. Yeni worker'ın mevcut atomik rollover akışını çalıştırmasına izin ver.
7. Yeni dönemin bir kez açıldığını; 60 günlük süreyi, evreleri, takvimi, üretim/kapasite/süre/hız örneklerini ve istemci uyumluluğunu doğrula. Ardından trafiği aç.

Bu adımlar veri değişikliği/dağıtım için önceden yapılmış bir işlem veya genel yayın izni değildir. Gerçek yayın, o andaki durum ve mevcut runbook onay koşullarıyla yürütülecek. Bozuk lifecycle kuyruğu, kapanmayan eski iş veya erişilemeyen native güncelleme zorla atlanmayacak.

### 6.3 Açılış kontrolleri ve geri dönüş

- Eski sezon sonuçları mühürlü; eski dünya yenilenmiş; yeni dönem/sunucular beklenen sayıda ve tutarlı kimliklerde olmalı.
- Her yeni sezonda beklenen end/rollover ve evre olayları, geçerli takvim pencereleri ve çalışan dinamik saat üretimi doğrulanmalı.
- En az bir rafineri, toplama havuzu, bina/araştırma/gemi/tamir teklifi, probe, kazıcı ve normal filo için API–UI eşleşmesi kontrol edilmeli. Özel silah istisnaları ayrıca doğrulanmalı.
- Worker gecikmesi, failed/processing olaylar, kuyruk bitişleri, dispatch retleri ve istemci güncelleme hataları izlenmeli. Başlangıç/katılım kaynak maliyetinde belirgin artış araştırılmalı.
- Yeni sezon yazımları başlamadan önce geri dönüş, kaydedilmiş lifecycle zamanları ve bütün artefaktları kapsayan eşleşmiş eski duruma yapılabilir. Yeni sezon yazımları başladıktan sonra yalnız binary geri almak doğru değildir; öncelik ileri düzeltmedir. Restore gerekiyorsa runbook'un bütün veri/hesap silme güvenceleri uygulanır.

## 7. Uygulamanın tamamlanma ölçütü

Bu planın oyun uygulaması; kesin gereksinimler, ilgili olağan testler, görsel doğrulama ve izole geçiş provası tamamlandığında kod açısından hazırdır. Canlı geçiş ise ayrıca bütün sezonların doğru kapanması, tek yeni dönem açılması ve web/native istemcilerin yeni hesapları kullanması kanıtlandığında tamamlanır.

Bu belgeyi hazırlama görevi yalnız planı dosyalaştırır. Oyun kodunu değiştirme, test beklentilerini güncelleme, sezon verisini değiştirme, paket yayınlama veya canlı ortamda bakım başlatma bu belge hazırlanırken yapılmaz.
