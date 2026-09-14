# Denge ve Oyun Temposu Değişiklik Planı

**Tarih:** 2026-09-14  
**Durum:** İnceleme tamamlandı; bu doküman uygulama öncesi kapsam ve doğrulama planıdır. Oyun kodunda henüz değişiklik yapılmadı.

## 1. Amaç ve kapsam

Bu çalışma aşağıdaki sekiz talebi tek bir denge paketi olarak ele alır:

1. Kazıcı temel kapasitesini 400 yapmak ve asteroid cevherlerini 400'ün katlarına taşımak.
2. Bütün araştırma seviyelerinin kristal maliyetini %20 azaltmak.
3. Telescope ve Radar'ın bütün seviyelerindeki kaynak maliyetlerini %25 azaltmak; korsan yoğunluğunu mevcut değerin 2 katına çıkarmak.
4. Asteroid Shower başladığında etkinin ilk dakikalarda belirginleşmesini sağlamak.
5. Yakıt tüketen bütün gemilerin Deuterium tüketimini %50 azaltmak.
6. Üretilen veya araştırılan her şeyin yapım süresini %25 azaltmak.
7. Ağır bir PvP kaybından sonra 4 saatlik saldırı koruması vermek; korunan oyuncu başka bir oyuncuya saldırmayı seçerse korumayı kaldırmak.
8. Bu maddeyi son anda ekledim bununda yapılması lazım: Prospector dönerken yük ile dönüyorsa -> gidiş hızının 3 katı kadar yavaş dönüyor. Bunun 3 katı değil 2 katı kadar yavaş dönecegi şekilde güncellenmesini istiyorum.

Değişiklikler birbirinden bağımsız görünse de ekonomi ve oyun temposu üzerinde çarpan etkisi yaratır. Bu nedenle tekil birim testleri kadar birleşik sezon simülasyonu da yayın kriteridir.

## 2. Mevcut durumdan çıkan önemli kararlar

### 2.1 Kazıcı kapasitesi ve asteroid miktarı

- Mevcut temel Prospector kapasitesi `300` birimdir.
- Etkin kapasite yalnızca bu sayı değildir: Prospector Holds araştırması, Derrick uydusu ve aynı hedefe gönderilen gemi sayısı kapasiteyi artırır.
- Mevcut ana asteroid seviye tablosu `800, 1600, 3200, 6000, 11000` değerlerini kullanır. Ancak günlük kaynak bütçesi uygulanırken cevher miktarı `Math.floor(...)` ile yeniden ölçeklenir. Bu yüzden gerçek sahada 300 veya 800 ile bölünmeyen yüzlerce farklı miktar oluşur. Oyuncunun gördüğü 20/30/40 birimlik artıkların ana sebebi yalnızca ana tablo değildir.
- Ölçülen örnek sezonlarda asteroidlerin yaklaşık %28-30'u 800 birimden küçüktür. Bu nedenle sadece ana tabloyu değiştirmek sorunu çözmez; yalnızca aşağı yuvarlamak da çok sayıda asteroidi sıfırlayıp görünür yoğunluğu azaltır.

Karar:

- Temel, yükseltmesiz, tek Prospector kapasitesi `400` yapılacak.
- Asteroid cevheri için kanonik kuantum `400` kabul edilecek.
- Ana seviye tablosu en yakın uygun şu katlara çekilecek: `1600, 3200, 4800, 6400, 8000`.
- Günlük/aylık kaynak bütçesi asteroidlere dağıtılırken sonradan kesirli ölçekleme yapılmayacak. Bütçe, 400'lük ayrık paketler halinde asteroid kabul etme/seviye düşürme yöntemiyle dağıtılacak.
- Sıfır cevherli görünür asteroid üretilemeyecek; toplam aylık kaynak tavanı da sessizce aşılmayacak.

Önemli sınır:

400'e bölünebilir asteroidler, yükseltmeli bütün filo kapasitelerine tam bölünemez. Örneğin tek gemi kapasitesi araştırmayla `1000, 1200, 1400, 1600, 2000`; Derrick ile `2080, 2600, 3120...` olabilir. Dolayısıyla talebin harfi harfine uygulanması, temel kazıcının bıraktığı küçük artıkları çözer; her olası yükseltme ve filo bileşimi için sıfır artık garantisi vermez. Böyle bir garanti istenirse ayrıca “son küçük artığı ücretsiz/toleranslı toplama” veya “cevheri etkin filo kapasitesine göre değiştirme” kuralı gerekir. İkincisi hedefin değerini oyuncuya göre değiştireceği için önerilmez.

### 2.2 Araştırma kristal maliyeti

- Kodda 16 araştırma projesi ve toplam 52 satın alınabilir araştırma seviyesi vardır.
- Gerçek fiyat kaynağı `RESEARCH_PROJECTS[id].costAt(level)` çağrısıdır.
- Kodda bulunan `RESEARCH_CRYSTAL_UPLIFT = 1.25` sabiti mevcut gerçek fiyat akışında kullanılmıyor. Yalnızca bu sabiti değiştirmek hiçbir sonuç üretmez.

Karar:

- Nihai araştırma fiyatının birleştiği ortak noktaya `0.80` kristal çarpanı eklenecek.
- Yeni kristal maliyeti `Math.round(mevcutKristal * 0.80)` olacak.
- Alloy ve Deuterium maliyetleri değişmeyecek.
- Ön koşullar, araştırma etkileri, seviye sınırları ve kilit açma şartları değişmeyecek.
- Kullanılmayan/yanıltıcı eski uplift sabiti ve ona bağlı açıklamalar kaldırılacak veya gerçek davranışı anlatacak şekilde düzeltilecek.

### 2.3 Telescope ve Radar maliyeti

Maliyetler `instrumentCost(id, level)` üzerinden merkezi olarak hesaplanıyor. Sadece Telescope ve Radar'a nihai `0.75` maliyet çarpanı uygulanacak; Aegis ve Veil değişmeyecek.

| Araç | Seviye | Mevcut Alloy / Crystal | Hedef Alloy / Crystal |
|---|---:|---:|---:|
| Telescope | 1 | 296 / 222 | 222 / 167 |
| Telescope | 2 | 1457 / 1092 | 1093 / 819 |
| Telescope | 3 | 4931 / 3698 | 3698 / 2774 |
| Telescope | 4 | 14333 / 10749 | 10750 / 8062 |
| Telescope | 5 | 38310 / 28733 | 28733 / 21550 |
| Radar | 1 | 197 / 148 | 148 / 111 |
| Radar | 2 | 971 / 728 | 728 / 546 |
| Radar | 3 | 3287 / 2465 | 2465 / 1849 |
| Radar | 4 | 9555 / 7166 | 7166 / 5375 |
| Radar | 5 | 25540 / 19155 | 19155 / 14366 |

Tablodaki hedefler en yakın tam sayıya yuvarlanmıştır. Telescope/Radar menzili, tespit/tanıma davranışı, sis kuralları ve repoint süresi değişmeyecek.

### 2.4 Korsan yoğunluğu

Mevcut toplam aday üretim oranı koltuk başına saatte `0.03`'tür; 300 koltukta yaklaşık 9 aday/saat eder. Talepteki “şu ankinin 2 katı” ifadesi `0.03 -> 0.06`, yani yaklaşık 18 aday/saat olarak uygulanacak.

Kritik uyumluluk ayrıntısı:

- Mevcut alan iki deterministik şeritten oluşur: eski `0.02` şeridi ve sonradan eklenen `0.01` şeridi.
- Mevcut ek şeridi `0.04` olarak büyütmek, daha önce oluşmuş korsanların zamanını, yörüngesini ve indeksini değiştirir. Bu da canlı hedefleri ve devam eden saldırıları bozabilir.
- İki mevcut şerit byte düzeyinde aynı bırakılacak; yeni ve bağımsız bir `0.03` şeridi yeni RNG/HMAC alan etiketiyle sona eklenecek. Böylece toplam `0.06` olurken eski hedef kimlikleri korunur.
- Mevcut adayların bir kısmını eleyen aylık korsan kaynak payı da mevcut `%9.75` değerinden `%19.5` seviyesine çıkarılacak. Aksi halde aday oranı iki katına çıksa bile oyuncunun gördüğü gerçek korsan sayısı iki katına ulaşmaz.
- Yeni şerit ayrı bir yayın bayrağıyla açılacak. Önce API'ler ve worker yeni hedefleri okuyabilecek sürüme getirilecek, daha sonra bayrak etkinleştirilecek.

Korsan başına filo, ödül, yaşam süresi ve hız değişmeyecek. Ancak toplam korsan ödülü/gemi enkazı arzı yaklaşık iki katına çıkacağı ve aynı pakette yakıt yarıya ineceği için korsan PvE net getirisi ayrıca ölçülecek.

### 2.5 Asteroid Shower'ın geç hissedilmesi

Sorunun ana kaynağı event bildiriminin geç gelmesi değildir. Event başladığında ek asteroidlerin tamamı 60 dakikalık pencereye eşitçe yayılıyor; başlangıç anında sahaya eklenmiş asteroid sayısı sıfırdır.

100 deterministik örnek üzerindeki ham aktif asteroid artışı:

| Event çarpanı | Başlangıç | +5 dk | +15 dk | +30 dk | +60 dk |
|---|---:|---:|---:|---:|---:|
| x3 | %0.0 | %4.6 | %13.1 | %26.6 | %53.2 |
| x5 | %0.0 | %8.7 | %26.5 | %52.9 | %106.3 |
| x10 | %0.0 | %19.8 | %59.7 | %119.4 | %240.1 |

Sis ve sensör kapsamı bu artışı tek oyuncunun ekranında daha da belirsiz kılabilir.

Karar:

- Event yine yalnızca yeni asteroid ekleyecek; mevcut asteroidlerin cevheri veya ömrü çarpılmayacak.
- Saatlik toplam bonus asteroid sayısı değişmeyecek; yalnızca geliş zamanları yeniden dağıtılacak.
- Bonusun `%50`si ilk `5` dakikaya, kalan `%50`si sonraki `55` dakikaya deterministik olarak yayılacak.
- Bütün bonusu aynı saniyede doğuran tek seferlik bir yığın oluşturulmayacak. Böylece event ilk dakikalarda görünür olurken tek bir oyuncunun başlangıç piyangosuna dönüşmez.
- Yeni davranış yeni event tanım sürümüne yazılacak. Başlamış veya daha önce açılmış event yeniden damgalanmayacak.
- Eski asteroid indekslerini/kimliklerini korumak için yeni ön-yüklemeli bölüm bağımsız deterministik alt şerit olarak eklenecek.

Event başlangıcındaki SSE/cache invalidation yolu da regresyon testine alınacak. Ancak görsel meteor efektinin başlaması gerçek asteroid sayısı için otorite sayılmayacak; başarı sunucu alanındaki ölçülebilir artışla doğrulanacak.

### 2.6 Gemi Deuterium tüketimi

- Normal uçuş yakıtı merkezi `fuelMass`/`missionFuel` hesaplarından geçer.
- Ana katsayı `FUEL.perValue = 0.011` değerinden `0.0055` değerine indirilecek.
- Garbage Collector ayrı `SALVAGE.fuelMass = 100` sabitini kullandığı için bu değer de `50` yapılacak. Aksi halde “bütün gemiler” kapsamı tamamlanmış olmaz.

Kapsam:

- PvP saldırısı, korsan saldırısı, transfer, yerleşim, klan yardımı, ticaret gemisi ve intergalaktik konvoy dahil bütün yakıt ücretli uçuş yolları.
- Web önizlemesi, simülatör ve sunucu kesintisi aynı ortak kuralla eşleşecek.
- Prospector/mining, probe ve kara savunmaları gibi hâlihazırda yakıttan muaf yollar muaf kalacak; bu değişiklik onlara yeni ücret getirmeyecek.

Yakıt tam sayı ve en az 1 kuralıyla hesaplandığı için çok küçük görevlerde görünen sonuç tam yarıya düşmeyebilir. Örneğin eski ücret 1 ise yeni ücret de 1 kalabilir. Kabul kriteri, alttaki sürekli oranın yarıya inmesi ve normal/büyük örneklerde yalnızca görev başına tam sayı yuvarlamasından kaynaklanan fark bulunmasıdır; yakıt ücretli hiçbir mobil gemi sıfır maliyetli olmayacak.

### 2.7 Bütün yapım/araştırma süreleri

Ortak zaman ayarı `ECONOMY_ADJUSTMENT.buildTime = 1.30` değeridir. Yeni değer mevcut sürenin `%75`i olacak şekilde `1.30 * 0.75 = 0.975` yapılacak.

Kapsama girenler:

- Altı bina.
- Telescope, Radar, Aegis ve Veil.
- Dört uydu.
- Prospector dahil bütün mobil gemiler.
- Kara savunmaları.
- Bütün araştırmalar.
- Uplink, Death Star ve interceptor üretimi.

Kapsama girmeyenler:

- Uçuş/seyahat süreleri.
- Event süreleri.
- Mining dönüş süresi ve cooldown'lar.
- Telescope repoint cooldown'u.
- Disruption/recovery süreleri.
- Pasif kaynak üretim aralıkları.

Mevcut etkin 8 saatlik üst sınır `624 dk` iken yeni üst sınır, AI Robots etkisinden önce `468 dk` olacaktır. AI Robots ve Yard Automation hız çarpanları mevcut biçimde bunun üzerine uygulanmaya devam edecek.
### 2.8 Ağır kayıp sonrası saldırı koruması

Mevcut ilk gün kalkanı komutan seviyesinde tutulur ve komutanın bütün dünyalarını korur. Başka bir oyuncuya Raid veya Death Star göndermek kalkanı, oyuncuya önce uyarı gösterilip onayı alındıktan sonra kaldırır. Probe, Pirate/Neutral saldırısı, mining, transfer, ticaret ve klan yardımı kalkanı kaldırmaz. Hedefin kalkanı saldırganınkinden önce kontrol edilir; ulaşılamayan bir hedefe saldırmaya çalışmak oyuncunun kendi kalkanını boşa harcamaz.

Yeni toparlanma kalkanı aynı saldırı/feragat sözleşmesini kullanacak. Bununla birlikte mevcut `newcomerShieldUntil` alanına farklı bir anlam yüklenmeyecek. Oyuncu satırına ayrı, nullable bir `recoveryShieldUntil` alanı eklenecek ve sistem tek bir ortak `effectiveAttackProtection(...)` fonksiyonundan iki korumanın geçerli olanını okuyacak. Bu yaklaşım mevcut ilk gün davranışını ve canlı veriyi korurken toparlanma kalkanının tekrar verilebilmesini sağlar.

#### Önerilen tetikleme kuralı

Sadece oran kullanmak düşük stoklu bir kolonide 1-2 kaynak kaybettirip bütün komutanı dört saat koruma altına alma açığı oluşturur. Bu nedenle önerilen kural iki koşulludur:

```text
raidableBefore = savaş çözülmeden hemen önce, hedef dünyadaki
                 DECISIVE + sınırsız kargo ile hesaplanan yağmalanabilir toplam
lootLost        = o savaşta savunandan gerçekten düşülen ve dönüş filosuna yazılan toplam

relativeLoss = raidableBefore > 0 ve 2 × lootLost >= raidableBefore
materialLoss = 20 × lootLost >= komutanın bütün dünyalarındaki toplam depo kapasitesi

korumaVer = relativeLoss ve materialLoss
```

Böylece ana eşik oyuncunun önerdiği gibi savaş öncesi yağmalanabilir kaynağın `%50`si olur. Ek `%5` toplam depo kapasitesi tabanı, küçük ve bilerek boş bırakılmış bir koloninin bütün hesap için kalkan üretmesini engeller. Depo kapasitesi seviyelerle büyüdüğü için ayrıca görünmeyen bir Command Core seviye tablosu kullanmaya gerek kalmaz; eşik oyuncunun gelişimine kendiliğinden ölçeklenir. `%5` ilk simülasyon değeridir ve düşük seviyedeki gerçek ağır kayıpları engelliyorsa yayın öncesinde ölçümle ayarlanacaktır.

`raidableBefore`, savaş sonunda kalan kaynaklardan değil, kaynak düşülmeden önceki aynı transaction snapshot'ından hesaplanmalıdır. Vault koruması, Works'ün `%50` maruziyeti, üç kaynak ve gerçek tam sayı yuvarlamaları mevcut `computeLoot`/`raidableStock` kuralından gelmeli; ikinci bir loot formülü yazılmamalıdır. Karşılaştırmalar bölme yerine yukarıdaki tam sayı çarpımlarıyla yapılmalıdır.

Mevcut loot oranları DECISIVE için `%70`, PARTIAL için `%35`tir. Bu yüzden kargosu yeterli bir PARTIAL sonuç, oyuncuya gösterilen DECISIVE yağmalanabilir tavanın tam `%50`sini alır ve maddi kayıp tabanını da geçiyorsa kalkanı tetikler. Bu tesadüfi bırakılmayacak, testte sabitlenecektir. Yalnızca DECISIVE savaşların kalkan vermesi istenirse ayrıca grade koşulu eklenmelidir; önerilen sürüm, sonuç etiketini değil oyuncunun gerçek kaybını esas alır.

#### Kalkan davranışı

- Süre savaşın çözüldüğü andan itibaren `4 saat`tir ve komutanın bütün dünyalarını Raid ve Death Star'a karşı korur.
- Death Star bir dünyanın kaynaklarının yarısını yok edip bina/araç seviyelerine de zarar verdiği için, oyuncuya ait bir dünyaya isabet ettiğinde aynı 4 saatlik toparlanma kalkanını doğrudan verir. Hedef dünyanın mevcut 2 saatlik recovery durumu ayrıca devam eder.
- Komutanın zaten daha uzun süren bir koruması varsa süre kısaltılmaz: `max(mevcutUntil, now + 4h)` kullanılır. Süreler toplanmaz.
- Kalkan alındığı anda komutanın aktif bir outbound PvP Raid veya Death Star saldırısı varsa kalkan verilmez. Bu, saldırmış bir komutanın rakibinden hasar alarak saldırırken koruma kazanmasını engeller.
- Kalkan aktifken başka bir oyuncuya Raid veya Death Star başlatılırsa mevcut ilk gün akışındaki gibi önce uyarı/onay gösterilir; kabul edilince toparlanma ve varsa ilk gün kalkanı birlikte kaldırılır.
- Pirate/Neutral saldırısı, Probe, mining, debris, transfer, settlement, ticaret ve klan yardımı korumayı kaldırmaz veya koruma üretmez.
- Kalkan yalnızca yeni düşman launch'larını durdurur. Kalkan verilmeden önce yasal biçimde havalanmış filolar geri çevrilmez ve vardıklarında çözülür. Bu önceden taahhüt edilmiş saldırılardan biri de ağır kayıp yaratırsa süre, ekleme yapılmadan `now + 4h` sonuna kadar uzatılabilir.
- Birden fazla dünyaya aynı anda gelen saldırılar ile oyuncunun yeni saldırı başlatması yarışmamalıdır. Koruma okuma/yazma ve feragat işlemleri oyuncu satırlarını sabit sırada kilitleyen aynı transaction sözleşmesinden geçmelidir.

Koruma bütün dünyalarda mevcut `PROTECTED` durumu olarak açıkça görülecek. Oyuncunun kendi HUD'ı süreyi “Toparlanma kalkanı” olarak adlandıracak; launch onayı “ilk gün kalkanı” demeyecek ve hangi korumanın harcanacağını gösterecek. Savaş raporunda denetlenebilirlik için `raidableBefore`, gerçekleşen kayıp oranı ve verilen koruma bitişi saklanacak. Kalkan verildiğinde season/galaxy sorguları hemen invalidate edilerek oyuncunun bir sonraki dakikalık poll'u beklenmeyecek.

#### Neden ilk sürümde filo hasarı eşiği önerilmiyor?

Savunma filosunun yarısının kalıcı değerini kaybetmesi de mantıklı bir ikinci tetikleyicidir ve kaynak taşınmasa bile oyuncu için ağır olabilir. Ancak “tek Dart'ın yarısı”, ground defence salvage'i, kaynak değer ağırlıkları ve anlaşmalı savaşlarla kalkan üretme gibi ayrı sorunlar doğurur. İlk sürümde oyuncunun görebildiği ve savaş raporuyla doğrulayabildiği kaynak kaybı kuralı kullanılacak; `defenderLossValue / defenderValueBefore` telemetrisi toplanacak. Gerçek oyun verisi, filosu silindiği halde koruma alamayan anlamlı bir grup gösterirse aynı maddi kayıp tabanıyla ikinci bir `OR` koşulu olarak eklenebilir.

## 3. Maliyet ve süre değişikliklerinin birleşmesi

Yapım süresi mevcut tasarımda kaynak fiyatından türetilir. Bu nedenle görevler kümülatif uygulanacaktır:

- Fiyatı değişmeyen bina, gemi ve savunmalar mevcut sürenin yaklaşık `%75`ine iner.
- Telescope/Radar önce `%25` ucuzlar, ardından global süre de `%25` azalır. Tavan ve yuvarlama dışındaki seviyelerde eski sürenin yaklaşık `%56.25`ine iner; yani toplam kısalma yaklaşık `%43.75` olur.
- Araştırmalarda kristal payı `%20` ucuzlar; yeni toplam fiyat üzerinden hesaplanan süreye ayrıca `0.75` zaman çarpanı uygulanır. Toplam kısalma projenin Alloy/Crystal/Deuterium karışımına göre değişir ve `%25`ten fazla olur.
- Dört saatlik toparlanma penceresi üretim süreleri `%25` kısaldıktan sonra eski oyuna göre daha fazla yeniden inşa imkânı verir. Bu etki ve yarıya inen saldırı yakıtıyla birlikte ölçülecektir.

Bu, mevcut fiyat-temelli süre modelinin doğal sonucudur ve önerilen yorumdur. Her kalemin eski sürüme göre tam olarak yalnızca `%25` kısalması istenirse Telescope/Radar ve araştırma için maliyet ile zaman hesabının ayrıştırılması gerekir; bu daha büyük bir tasarım değişikliğidir.

## 4. Canlı veri ve sezon sınırı

Bu paketin güvenli uygulama şekli yeni ruleset/sezon sınırıdır.

- Asteroid sahası takvimden deterministik olarak yeniden türetildiği için aynı sezon içinde formülü değiştirmek canlı hedeflerin cevherini veya kimliğini değiştirebilir.
- Mevcut uçuşların `holdEach` değeri kalkışta kaydedilir; yeni kapasite eski uçuşlara geriye dönük uygulanmayacak.
- Mevcut build/research/strategic kuyrukları maliyet ve `readyAt` bilgilerini kaydeder. Bunlar geriye dönük hızlandırılmayacak ve kaynak farkı iade edilmeyecek.
- Yeni kurallar açıldıktan sonra verilen yeni siparişler, başlatılan yeni araştırmalar ve yeni uçuşlar yeni değerleri kullanacak.
- Devam eden Asteroid Shower eski sürüm davranışıyla tamamlanacak; yalnızca gelecekteki, henüz açılmamış oluşumlar yeni sürümle damgalanacak.
- Korsan artışı uyumluluk bayrağıyla iki aşamalı yayımlanacak ve mümkünse aynı sezon sınırında etkinleştirilecek.
- Toparlanma kalkanı için önce nullable veritabanı alanı ve rapor audit alanları eklenecek; özellik kapalıyken eski ilk gün kalkanı aynen çalışacak. Eski savaşlar geriye dönük kalkan üretmeyecek.

Canlı kuyrukları geriye dönük değiştirmek istenirse build, research, strategic asset ve scheduled event satırlarını atomik biçimde yeniden zamanlayan; bağlı kuyrukları sırayla öteleyen ayrı bir veri operasyonu gerekir. Riskine karşılık oyuncu faydası düşük olduğu için önerilmez.

## 5. Uygulamada temas edecek ana alanlar

| Alan | Ana kod | Yapılacak iş |
|---|---|---|
| Prospector ve ana asteroid değerleri | `packages/rules/src/constants.ts`, `packages/rules/src/galaxy.ts` | Kapasiteyi 400 yapmak, seviye tablosunu kuantize etmek, bütçe dağıtımını 400'lük paketlere çevirmek |
| Mining sözleşmesi | `apps/server/src/services/mining.ts`, asteroid field servisleri | Kalkışta kapasite dondurma ve eşzamanlı claim davranışını korumak |
| Araştırma fiyatları | `packages/rules/src/research.ts` | Nihai kristal fiyatına tek merkezden 0.80 uygulamak |
| Sensör fiyatları | `packages/rules/src/economy.ts` | Telescope/Radar için tipe bağlı 0.75 maliyet çarpanı eklemek |
| Korsan alanı | `packages/rules/src/pirates.ts`, server pirate field/worker ve yayın ayarları | Yeni 0.03 deterministik şerit, %19.5 allowance, yeni rollout bayrağı |
| Asteroid Shower | `packages/rules/src/galaxy.ts`, event snapshot/field kodu | Yeni event sürümü ve %50/5 dk ön-yüklemeli alt şerit |
| Yakıt | `packages/rules/src/fuel.ts`, ilgili sabitler | Ana oranı ve Garbage Collector özel değerini yarıya indirmek |
| Üretim süreleri | `packages/rules/src/tempo.ts` | Ortak build-time değerini 0.975 yapmak |
| İstemci ve araçlar | `apps/web`, `tools/`, simülatörler | Ortak kural tüketimini, fiyat/yakıt önizlemelerini ve raporları doğrulamak |
| Dokümantasyon | `docs/game-design.md`, `docs/balance.md`, event/sight/deployment belgeleri | Kodla çelişen eski sayıları ve yeni ruleset/rollout bilgisini güncellemek |

Çoğu web ekranı ortak rules paketini kullandığı için ayrı fiyat mantığı yazılmamalıdır. Sunucudan gelen fiyat ile istemcinin gösterdiği fiyatın sözleşme testleriyle aynı kaldığı doğrulanacaktır.

## 6. Test ve doğrulama planı

Uygulama TDD sırasıyla yapılacaktır: önce mevcut davranışı kaydeden baseline, sonra yeni gereksinimleri ifade eden başarısız testler, ardından en küçük uygulama ve tam doğrulama.

### 6.1 Kazıcı ve asteroidler

- Temel Prospector kapasitesi ve ona bağlı hull/client değerleri 400 olmalı.
- Normal alan, günlük standing artışı ve Asteroid Shower dahil her sıfırdan büyük ilk asteroid cevheri 400'ün pozitif katı olmalı.
- Sıfır cevherli hedef oluşmamalı; aylık kaynak tavanı kabul edilen tolerans içinde kalmalı.
- Eski şeritlerin deterministik prefix hash/indeksleri korunmalı.
- Eşzamanlı iki claim cevheri iki kez vermemeli.
- Değişiklikten önce kalkmış mining filosu kaydedilmiş eski `holdEach` ile dönmeli.
- 300 oyuncu ve sezon simülasyonunda hedef yoğunluğu, cache/projection süresi ve mining rekabeti ölçülmeli.

### 6.2 Araştırma ve sensör fiyatları

- Bütün 16 proje/52 seviyede Alloy ve Deuterium aynı; Crystal `round(eski * 0.80)` olmalı.
- Bütün beş Telescope/Radar seviyesinde her kaynak `round(eski * 0.75)` olmalı.
- Aegis/Veil fiyatları, bütün sensör menzilleri ve sis/tanıma etkileri değişmemeli.
- Sunucu kaynak kesintisi, iptal iadesi, Wealth hesabı ve web tahmini aynı fiyatı kullanmalı.
- Ön koşullar, seviye sınırları ve araştırma etkileri için regresyon testi çalışmalı.

### 6.3 Korsanlar

- Eski `0.02 + 0.01` alanının prefix fingerprint'i değişmemeli.
- Yeni şerit yalnızca sona eklenmeli ve toplam aday oranı `0.06` olmalı.
- Çoklu seed sezon ölçümünde kabul edilen gerçek korsan sayısı mevcut sürümün yaklaşık 2 katına ulaşmalı; yalnızca teorik aday sayısı test edilmemeli.
- Yeni hedefler açılmadan önce bütün API/worker örnekleri bu handle'ları çözebilmeli.
- Sis, trafik, saldırı, rapor ve ödül yolları regresyona alınmalı.
- Aktif korsan sayısındaki artışın projection süresi, response boyutu ve istemci performansına etkisi ölçülmeli.

### 6.4 Asteroid Shower

- Saat boyunca oluşan toplam bonus sayısı eski sürümle aynı kalmalı.
- Bonusun yaklaşık yarısı ilk 5 dakikada oluşmalı; event başlangıcından önce bonus oluşmamalı.
- x3/x5/x10 için çoklu seed ölçümlerinde ilk 5 dakika ham saha artışı belirgin eşikleri karşılamalı. Başlangıç hedefleri sırasıyla yaklaşık `%20-25`, `%45-50` ve `%100` artıştır; nihai eşikler simülasyon dağılımı görülerek sabitlenecek, başarısız sonucu gizlemek için bantlar genişletilmeyecek.
- Eski event sürümleri ve başlamış occurrence'lar değişmemeli.
- HMAC hedef kimliği, sis, `nextFieldChangeAt`, cache invalidation ve event başlangıç bildirimi test edilmeli.
- Worker kısa süre çalışmasa dahi saat tabanlı oyun alanı doğru event durumunu göstermeli.
- Gerçek oyuncu görünümü masaüstü ve mobilde görsel test aracıyla kontrol edilmeli.

### 6.5 Yakıt

- Yakıt ücretli bütün mobil hull'larda sürekli oran yarıya inmeli; Garbage Collector kapsamda olmalı.
- Çok küçük görevlerdeki en az 1 ve tavan yuvarlaması açıkça test edilmeli.
- PvP, korsan, transfer, settlement, clan aid, trade ve iki yönü farklı intergalaktik konvoy rotaları test edilmeli.
- Sunucu teklifi, istemci kartı/önizlemesi ve simülatör aynı sonucu üretmeli.
- Yakıt ücretli hiçbir mobil hull sıfır maliyetli olmamalı; mevcut verimlilik sıralaması bozulmamalı.

### 6.6 Yapım süreleri

- Bina, instrument, uydu, gemi, savunma, araştırma, Uplink, Death Star ve interceptor süreleri ortak fiyat tabanında `eski * 0.75` olmalı.
- Üst sınır `624 -> 468 dk` olmalı; AI Robots/Yard Automation çarpanları aynı sırada uygulanmalı.
- Sunucunun `readyAt` değeriyle istemci tahmini eşleşmeli.
- Research ve Telescope/Radar için maliyet indirimiyle birleşen kümülatif süre ayrıca test edilmeli.
- Eski kuyruk satırlarının zamanı değişmemeli; yeni siparişler yeni süreyi kullanmalı.

### 6.7 Ağır kayıp sonrası saldırı koruması

- Saf kural testlerinde `%50`nin hemen altı kalkan vermemeli; tam `%50` ve üstü, maddi taban da geçilmişse vermeli.
- `raidableBefore = 0`, sıfır loot, tam sayı yuvarlama sınırları ve Alloy/Crystal/Deuterium karışımları test edilmeli.
- Maddi `%5` tabanının hemen altı ve tam sınırı; tek dünya ve dört dünyalı komutan örnekleri test edilmeli.
- Vault floor ve Works maruziyeti, probe'un gösterdiği DECISIVE yağmalanabilir tavanla aynı ortak hesaplamadan gelmeli.
- Kargosu yeterli PARTIAL sonucun `%35 / %70 = %50` sınırında kalkan verdiği; cargo-limited sonucun gerçek oranına göre karar verdiği test edilmeli.
- Kalkan oyuncu seviyesinde bütün dünyaları Raid ve Death Star'dan korumalı; Pirate/Neutral/Probe ve diğer ekonomik uçuşlar etkilenmemeli.
- Death Star isabeti kalkan vermeli ve hedef dünyanın 2 saatlik recovery süresiyle çakışmadan çalışmalı.
- Kalkanlı oyuncunun PvP Raid/Death Star denemesi önce uyarılmalı; onay yoksa hiçbir şey harcanmamalı, onay varsa kalkan atomik olarak kalkıp launch gerçekleşmeli.
- Hem hedef hem saldırgan korumalıysa hedefin reddi önce gelmeli ve saldırganın kalkanı korunmalı.
- Aktif outbound PvP saldırısı olan savunana yeni kalkan verilmemeli.
- Kalkan öncesi havalanan incoming filolar çözülmeli; birden fazla ağır sonuç süreyi toplamak yerine yalnızca en geç `now + 4h` anına uzatmalı.
- Aynı anda farklı dünyalarda battle resolution ve yeni launch yarışları, satır kilidi altında “hem saldırıyor hem korunuyor” durumu üretememeli.
- İlk gün kalkanı değişmeden çalışmalı; etkin bitiş iki kaynaktan doğru seçilmeli ve saldırı onayı ikisini de temizlemeli.
- Public galaxy, season payload, bot hedef seçimi, TR/EN hata metinleri, HUD sayacı ve battle report aynı koruma durumunu göstermeli.
- Simülasyon kalkan tetikleme sayısını, ortalama koruma süresini, engellenen yeni saldırıları ve koruma altında biriken kaynağı raporlamalı.
### 6.8 Birleşik ekonomi ve kalite kapısı

- Önce ilgili rules/server/web testleri, ardından paket testleri çalıştırılacak.
- Birden çok tam sezon ve ekonomi/snowball simülasyonu çalıştırılacak.
- Mining çıkarma hızı, asteroid tükenme oranı, sensor edinme zamanı, korsan karşılaşma sıklığı ve net getirisi, ele geçirilen gemi/enkaz arzı ölçülecek.
- ARR/VFR/TAX, PvP raid hacmi, kalkan uptime'ı ve stok eğrileri mevcut kabul bantlarında kalmalı. Daha hızlı üretimin stokları daha erken harcayıp VFR'ı düşürme ve kalkanların hedef erişimini azaltma riski özellikle izlenecek.
- Son kalite kapısı tam `pnpm verify` ve gerekli görsel kontroldür.

## 7. Birleşik denge riskleri

1. **Mining temposu:** Kapasitenin `300 -> 400` çıkması gemi başına 2.67 kat artıştır. İki/üç gemi, araştırma ve Derrick ile asteroidler çok daha hızlı boşalabilir; toplam cevher sabit kalsa bile rekabet ve oyuncu başına pay değişir.
2. **Korsan net getirisi:** Korsan sayısı iki katına çıkarken uçuş yakıtı yarıya iner. Aynı ödül tablosu teorik olarak iki kat hedef ve daha ucuz erişim sağlar; PvE, PvP'nin önüne geçebilir.
3. **Erken sensör erişimi:** Telescope/Radar hem ucuzlayacak hem de fiyat-temelli zaman ve genel zaman indirimi nedeniyle çok daha hızlı tamamlanacak. Harita bilgisi ve savunma hazırlığı daha erken açılır.
4. **İlerleme hızı:** Araştırma ucuzluğu ile bütün üretim sürelerinin kısalması birlikte snowball'u hızlandırabilir.
5. **VFR/stok riski:** Daha hızlı kuyruklar kaynakların stokta daha az beklemesine ve yağmalanabilir değerin düşmesine yol açabilir.
6. **Event yarışı:** Asteroid Shower'ın önden yüklenmesi ve daha büyük Prospector kapasitesi birlikte ilk dakikalarda yoğun yarış doğurabilir.
7. **Performans:** Yaklaşık iki kat korsan hedefi projection, trafik, sight ve istemci payload maliyetlerini artırır.

Bu riskler nedeniyle sekiz değişiklik tek tek doğru olsa bile paket, bütünleşik ölçüm geçmeden yayınlanmamalıdır.

## 8. Önerilen yayın sırası

1. Mevcut ruleset için baseline ve fingerprint'leri kaydet.
2. Nullable `recoveryShieldUntil` ve battle report audit alanlarını expand-only migration ile ekle; özellik bayrağını kapalı tut.
3. Yeni gereksinim testlerini yaz ve kırmızı olduklarını doğrula.
4. Ortak rules değişikliklerini uygula; istemci/sunucu kopya mantığı oluşturma.
5. Asteroid ve korsan için yeni deterministik şerit/sürüm davranışlarını ekle.
6. Kalkanı okuyabilen API, worker, bot ve web sürümlerini özellik kapalıyken yayımla.
7. Korsan şeridini kapalı tutan bayrakla API ve worker'ları yayımla.
8. Focused test, sezon simülasyonları, ekonomi ölçümleri, `pnpm verify` ve görsel QA'yı tamamla.
9. Yeni ruleset/sezon sınırında maliyet, kapasite, yakıt, zaman, Asteroid Shower ve toparlanma kalkanı değişikliklerini aç.
10. Bütün örneklerin yeni korsan handle'larını okuyabildiği doğrulandıktan sonra korsan bayrağını aç.
11. İlk saat/gün boyunca asteroid event rampası, aktif korsan sayısı, mining projection p95, kuyruk süreleri, yakıt reddi, kalkan tetikleme/uptime, PvP raid hacmi, VFR/ARR ve hata oranlarını izle.

## 9. Uygulama kabul özeti

Paket aşağıdaki şartların tamamı sağlandığında tamamlanmış sayılacaktır:

- Temel Prospector kapasitesi 400 ve yeni asteroid cevherleri 400'ün pozitif katıdır.
- Bütün araştırma seviyelerinde kristal maliyeti tam sayı kuralıyla %20 düşmüştür.
- Telescope/Radar bütün seviyelerde bütün kaynaklar için %25 ucuzlamış; sight davranışı değişmemiştir.
- Oyuncunun gördüğü kabul edilmiş korsan yoğunluğu mevcut sürümün yaklaşık 2 katıdır ve eski hedefler bozulmamıştır.
- Asteroid Shower'ın gerçek saha etkisi ilk 5 dakikada belirginleşmiş, toplam event arzı artmamıştır.
- Yakıt ücretli bütün gemilerde temel Deuterium tüketimi %50 düşmüş; özel Garbage Collector yolu unutulmamıştır.
- Bütün üretim/araştırma sınıflarında ortak süre %25 düşmüş ve fiyat indirimi olan sınıflarda kümülatif davranış bilinçli olarak doğrulanmıştır.
- Bir savaşta savaş öncesi yağmalanabilir kaynağın en az %50'sini ve komutanın toplam depo kapasitesinin en az %5'ini kaybeden oyuncu 4 saat korunmuş; Death Star isabeti de aynı toparlanmayı vermiştir.
- Toparlanma kalkanı komutanın bütün dünyalarını yeni PvP Raid/Death Star launch'larından korumuş; kendi saldırısını onaylayan oyuncunun kalkanı atomik olarak kalkmıştır.
- Küçük koloni, aktif outbound saldırı, eşzamanlı launch/battle ve önceden havalanmış filo senaryoları tanımlanan istismar/taahhüt kurallarına uymuştur.
- Devam eden uçuşlar, kuyruklar ve açılmış eventler geriye dönük değişmemiştir.
- Tam test, simülasyon ve görsel kalite kapıları geçmiştir.

> Not: `docs/decisions.md` çalışma alanında bulunmadığı için incelenemedi. Bu plan davranışın gerçek kaynağı olan kod, testler ve erişilebilir tasarım belgelerine göre hazırlandı.
