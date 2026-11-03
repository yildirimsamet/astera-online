# Galaksilerarası Konvoy — yalnız gidişte 2× hız

Tarih: 2026-11-04. Durum: **ayrı worktree’de uygulandı**; uygulama ve doğrulama kaydı §10’da. Yayın yapılmadı.
Bu belge konuşmadaki ilk planın yerine geçer. Kök dizindeki `plan.md`, eski gemi hasarı ve
radyasyon çalışmasıdır; bu değişikliğin uygulama planı değildir.

## 1. Kesin kapsam

Kullanıcı kararı: yalnız Galaksilerarası Konvoya giden filonun uçuş hızı iki katına çıkar.

- Normal hız: seçilen filonun en yavaş gemisi, komutanın mevcut itki araştırması ve çıkış
  gezegenindeki etkin Beacon ile hesaplanır. Konvoy gidiş hızı bu sonucun **tam 2 katıdır**.
- Bu çarpan bütün gönderilebilir gemilere aynı uygulanır. Hızlı bir gemi veya kargo eklemek,
  filonun en yavaş gemisini geçersiz kılamaz. Yalnız silahsız filo hâlâ gönderilemez.
- Saldırı 5 saniyedir; konvoy kendi rotasında 50 birim/dakika ile 180 dakikada geçer.
- Dönüş, gönderimdeki normal hız ve teknoloji/Beacon koşullarıyla hesaplanır. Gidiş çarpanı
  dönüşe, ödül gemilerine veya oyuncunun sonraki görevlerine aktarılmaz.
- Konvoyla temas ve 5 saniyelik saldırı etkinliğin bitimine sığmalıdır. Dönüşün konvoyun
  ayrılışına yetişmesi gerekmez; **sezon bitimine yetişmesi** gerekir.
- Uygulama öncesinde gönderilmiş görevlerin zamanları ve noktaları korunur. Yeni kural,
  güncelleme sonrası sunucunun kabul ettiği yeni gönderimlere uygulanır.
- Savaş, aktarım, klan görevleri, anıt, korsan, tüccar, madencilik, enkaz, sinyal, sonda ve
  stratejik silah uçuşlarında hız veya yakıt kuralı değişmez.

Yeni kalıcı bonus, görev hız seçeneği, istemciden alınan çarpan, şema/migration, sezon
aktivasyonu veya ekonomi kalibrasyonu gerekmez. Bu inceleme yayın/deploy talimatı değildir.

## 2. İncelemede doğrulanan eksik ve yanlışlar

| Bulgu | Koddan doğrulama | Planın düzeltilmiş karşılığı |
| --- | --- | --- |
| Gidiş süresini ikiye bölmek doğru değildir. | Hareketli hedef için `interceptIntergalacticConvoy` gelecekteki buluşmayı çözer. | İki kat hızla buluşma yeniden çözülür; sonuç ETA'ya sonradan bölme uygulanmaz. |
| Dönüş yardımcısının testi tek başına yeterli değildir. | Üretim sunucusu dönüşü `launchIntergalacticConvoy` içindeki `fleetTravelExact` ile hesaplar; `intergalacticConvoyReturnProfile` üretim çağrı zincirinde kullanılmıyor. | Asıl sunucu sonucu, istemci önizlemesi ve kayıtlı `homeAt` bağımsız beklenen değerlerle sınanır. |
| Bazı testler aynı yanlış hesabı paylaşarak geçebilir. | Server testindeki `convoyUp().order()` da beklenen teklifi aynı interception fonksiyonuyla üretir. | Aşağıdaki sabit geometrili sayısal örnekler ve bağımsız mesafe/zaman denklemleri eklenir. |
| Görsel fixture güncel konvoy geometrisini temsil etmiyor. | Gallery'deki `convoy` gerçek `IntergalacticConvoySheet` kullanıyor fakat 120 dakika, 4000 birim ve 33,33 birim/dakika tanımlıyor; mevcut rota 180 dakika, 9000 birim ve 50 birim/dakika. Web sheet/focus testlerinde de eski 120 dakikalık örnekler var. | Yeni davranış ve görsel kabul fixture'ı güncel rotayla kurulur; eski fixture'da metin görmek güncel erişim kanıtı sayılmaz. |
| Radyasyonun daha kısa gidişle azalacağı varsayımı yanlıştır. | Güncel modelde hasar için kaynak ve segment aynı gezegen/anıt kimliğini taşımalıdır; konvoyun uçuş/temas segmentleri bu etiketi taşımaz. | Yeni radyasyon mekaniği eklenmez. Güncel modelde gidiş, temas ve dönüşün ek alan dozu sıfır kalır; mevcut yaralar korunur. |
| Radyasyon açıklamaları hâlâ bütün yüzeylerde doğru değildir. | Altı dilde `convoy.boundary` ve Wiki'nin konvoy makalesi uçuşta radyasyon hasarı anlatıyor. | Konvoy metinleri hız kuralıyla birlikte düzeltilir; tarihsel kaynak desteği kural motorundan kaldırılmaz. |
| Erişim hesabında dakika yuvarlaması yanlış ret üretebilir. | `GalaxyView.convoyReach` dakika başını kalkış zamanı olarak veriyor. Etkinlik başlangıcı bu dakikanın içindeyse gerçek saat geçerli, yuvarlanan saat etkinlikten önce olabilir. | Yalnız konvoy erişim hesabı gerçek sunucu saatinden beslenir; tüccarın pahalı rota hesabındaki dakika optimizasyonu değiştirilmez. |
| Erişim hesabı gönderilemeyen hızlı gemiyi kullanabilir. | `GalaxyView` tüm `home.fleet` üzerinden arıyor; seçim ekranı `fleetCombatReady` veya `partitionCombatFleet(...).eligible` kullanıyor. | Konvoy erişimi ve `hasCombatCraft`, seçim ekranıyla aynı gönderilebilir filo üzerinden hesaplanır. |
| “Dönüş her durumda normal uçar” ifadesi recovery istisnasını atlıyordu. | Worker'ın kalıcı hata toparlama yolu gemileri güvenli eve teslim edebiliyor; bu oyuncunun recall komutu değildir. | Normal görev dönüş hızı korunur; mevcut recovery davranışı yeniden tasarlanmaz veya oyuncuya açılmaz. |
| Eski istemcinin her teklifi mutlaka reddedilmez. | Freshness kontrolünde gecikmeye bağlı tolerans var; çok kısa bir eski teklif toleransa sığabilir. | Güvenlik, teklif reddine değil sunucunun yeniden hesaplamasına dayanır. Kabul edilen sonuç daima sunucunun yeni kuralıdır. |

Kaynaklar:

- [Konvoy kuralları](../packages/rules/src/intergalacticConvoy.ts),
  [genel uçuş hesabı](../packages/rules/src/travel.ts),
  [konvoy sabitleri](../packages/rules/src/constants.ts).
- [Gönderim/dönüş servisi](../apps/server/src/services/intergalacticConvoyRaid.ts),
  [API gövdesi](../apps/server/src/routes/intergalacticConvoy.ts),
  [gönderilebilir sağlık seçimi](../apps/server/src/services/homeHealth.ts).
- [İstemci rotası](../apps/web/src/lib/navigation.ts),
  [galaksi erişimi](../apps/web/src/screens/GalaxyView.tsx),
  [seçim ve gönderim](../apps/web/src/screens/IntergalacticConvoySheet.tsx).
- [Hedefe bağlı radyasyon](../packages/rules/src/radiation.ts),
  [sunucu kaynak adaptörü](../apps/server/src/services/radiationSources.ts),
  [güncel radyasyon açıklaması](game-design.md#radyasyon--sabit-hp-hasarı-kesin-kullanıcı-kararı-2026-10-12).

### Yeniden üretilen iki ekran tutarsızlığı

1. Başlangıç `0,25`, mevcut saat `0,5` dakika; rota −4500 → +4500, hız 50; çıkış
   `(-3000, 0, 0)`, filo bir Dart, bonus yok. `planIntergalacticConvoyRoute` gerçek saatte
   rota buluyor; dakika başı `0` verildiğinde `null` dönüyor. Bu, yalnız etkinlik
   başlangıcı çevresindeki bir hatadır; önceki 90 dakika kalan vakayı tek başına açıklamaz.
2. Evde bir Dart ve bir Rampart var; Dart'ın hasarı `9500 bp`, yani kalan canı %5.
   `partitionCombatFleet` yalnız Rampart'ı gönderilebilir buluyor. Mevcut hızla 150.
   dakikada `x=2000` çıkışından Dart yetişiyor, Rampart yetişemiyor. Önerilen 2× hızla
   aynı ayrım `x=0` çıkışında da var. Evdeki bütün gemilerden en iyi erişimi seçmek,
   gönderilemeyen Dart üzerinden yanlış bir erişim gösterebiliyor.

Bu iki durum gerçek fonksiyonlarla yeniden üretildi; uygulama aşamasında regresyon testine
dönüştürülecek. Yeni genel zaman/filo altyapısı kurulmayacak.

## 3. Uygulama sınırı ve hesap sözleşmesi

### 3.1 Çarpanın tek uygulandığı yer

`INTERGALACTIC_CONVOY.outboundSpeedMultiplier = 2` eklenir.
`interceptIntergalacticConvoy`, genel `interceptLinearTransit` çağrısına yalnızca bu
fonksiyonun içinde `normalFleetUnitsPerMinute × outboundSpeedMultiplier` verir.

Mevcut `fleetUnitsPerMinute` girdisinin **çarpan uygulanmamış normal hız** olduğu tip
açıklamasına yazılır. Sunucu ve `planIntergalacticConvoyRoute` bu girdiye mevcut
`fleetPace / TRAVEL.distanceFactor` değerini vermeye devam eder. Çağıranlar ayrıca 2 ile
çarpmaz. Böylece ekran, commit anındaki yeni teklif ve sunucu aynı kuralı bir kez uygular.

`fleetPace`, `fleetSpeed`, `fleetTravelExact`, `FlightModifiers`, `HULLS`,
`TRAVEL.distanceFactor`, `interceptLinearTransit` ve `flightModifiers` değiştirilmez.
Konvoy çarpanı için genel `pace` veya `boost` nesnesi değiştirilmez; dönüşe sızabilecek
ortak/mutable hız nesnesi oluşturulmaz.

### 3.2 Dönüş, yakıt ve ödül

- Buluşma noktası yeni gidiş hızından elde edilir. Saldırı sonu, konvoyun bundan 5 saniye
  sonraki gerçek konumudur.
- Dönüş süresi `distance(engagementEnd, origin) / normalFleetUnitsPerMinute` olur;
  `homeAt = engagementEndsAt + returnMinutes` olarak gönderimde dondurulur.
- Dönüş, gidiş süresine eşit kabul edilmez; `outbound × 2` toplam süre değildir.
- Yakıt mevcut `missionFuelForDistances` ile iki gerçek mesafeden, bacak başına mevcut
  yuvarlamayla peşin alınır. Yeni hız indirimi veya hız cezası eklenmez. Buluşma noktası
  değiştiği için mesafe/yakıt **artabilir veya azalabilir**; önceki ücretin aynısı vaat edilmez.
- Üretim tavanı, ateş gücü, kargo, kalite, gemi olasılığı, Honor ve ödül dağıtımı değiştirilmez.
  Ödül gemileri mevcut çekilerek dönüş davranışını korur; yeni hız profiline katılmaz.
- Araştırma/Beacon gönderimden sonra değişirse kayıtlı rota yeniden hesaplanmaz. Eve
  döndükten sonraki yeni görev, o anda normal görev için geçerli koşulları kullanır.
- Güncel hedef radyasyonu uçuş boyunca ek doz vermez. Evden ayrılmadan önce veya eve
  indikten sonra gezegende alınabilecek radyasyon ve mevcut yaralar ayrı kurallardır.
  Eski uzamsal radyasyon sezonlarının tarihsel hesaplarını bu hız çalışması silmez.

### 3.3 Zaman sınırları

Mevcut sözleşme korunur: etkinlik `[appearsAt, expiresAt)` aralığında gönderime açıktır;
en geç temas `expiresAt − 5 saniye` olur. Saldırının **tam bitiş anına eşit** bitmesi
kabul edilir; mevcut çözücü böyle çalışır. Bundan sonraki temas reddedilir.

Sunucu milisaniye zaman damgalarını, istemci sunucuyla eşitlenmiş saati kullanır. Süre
çözücüsünde tam dakikaya yuvarlama yapılmaz. Konvoyun ayrılışı dönüş için deadline değildir;
`assertSeasonOpenThrough(origin, homeAt)` korunur. Varış/ödül/dönüş zamanlaması worker
queue'sunun kayıtlı `resolveAt` değerleriyle sınanır; çözücü servislerini uygunsuz zamanda
doğrudan çağırıp yeni bir zaman sözleşmesi varsayılmaz.

## 4. API ve abuse kontrolleri

Güvenlik sınırı mevcut sunucu işlemi ve veritabanıdır; ekranın butonu kapatması yeterli değildir.

| Girişim | Korunacak davranış ve doğrulama |
| --- | --- |
| İstekte hız, çarpan, `pace`, buluşma noktası, hedef gezegen veya dönüş noktası ekleme | `.strict()` API gövdesi bunları kabul etmez. Yeni alan eklenmez; başka uçuş API'lerine konvoy modu eklenmez. |
| Sahte ETA, eski/gelecek teklif, istemcide çarpanı 4× yapma | Sunucu gerçek filo, araştırma, Beacon, etkinlik ve saatle yeniden hesaplar. Toleransı aşan teklif reddedilir; toleransa sığan teklif bile sunucu saatlerini değiştiremez. Mevcut 45 saniye yaş/5 saniye taban toleransı sebepsiz sıkılaştırılmaz. |
| Başkasının gezegeni, başka sezon/geçiş, kapalı etkinlik | Sahiplik/season/occurrence kontrolleri korunur; hiçbir gemi, yakıt veya hak tüketilmeden atomik ret doğrulanır. |
| Hızlı ama savaşamayan gemi, yetersiz adet, yalnız kargo, yer savunması, geçersiz sayı | Sunucunun filo ve sağlık seçimi uygulanır. %5 ve altı gemiler saldırıya katılamaz; taşıma/tahliye istisnası konvoya kopyalanmaz. |
| Aynı gemileri konvoydayken savaş/aktarımda yeniden kullanma | Gemiler `intergalactic-convoy:<runId>` konumuna taşınır ve `home` stokundan düşer. Aynı gezegenden iki görev türü yarıştırıldığında stok negatifleşemez ve gemi çoğalamaz. |
| Yeniden istek / bağlantı kopması / aynı anahtarlı eşzamanlı gönderim | Mevcut idempotency aynı komutu bir kez uygular. Değişen gövde aynı anahtarla çatışır; replay güncel planet/pending görünümüyle döner. |
| Farklı anahtarlarla aynı anda konvoy gönderme | Gezegen kilidi ve iki partial unique index korunur. Bir dünya için bir aktif görev ve bir geçişte bir başarılı saldırı; farklı dünyaların ayrı hakları devam eder. |
| Daha erken dönüşle aynı geçişe tekrar saldırma | Görev bitse de geçiş hakkı harcanmış kalır. Sadece dönüş kilidinin kalkması yeniden saldırı hakkı vermez. |
| Geri çağırıp/yön değiştirip bonusu başka uçuşa taşıma | Konvoy kaydı `missions` değildir; genel recall yalnız kendi tablosundaki uygun görevleri kabul eder. Konvoy run kimliğiyle recall denemesi hızlandırılmış aktarım oluşturamaz. |
| Koloniyi terk ederek dönüşü taşımak | Aktif konvoy mevcut koloni terk kontrolünde engeldir. Düşman tarafından ele geçirilirse mevcut `safeHomePlanet` güvenli başkent teslimatı korunur; istemci dönüş hedefi seçemez. |
| Worker retry, iki kez event, kayıp event üzerinden ödül çoğaltma | Mevcut durum claim'i, dedupe ve kayıtlı ödüller korunur. Recovery yalnız worker yoludur; yeni oyuncu endpoint'i veya istemci kontrollü hata toparlama eklenmez. |

“Abuse yok” sonucu yalnız kodun küçük olmasına veya eski testlerin yeşil olmasına
dayandırılmaz. Yukarıdaki yeni hıza ve diğer görevlerle etkileşime ilişkin senaryoların
uygulama testleri tamamlanmadan değişiklik bitmiş sayılmaz.

## 5. İstemci ve açıklamalar

- `GalaxyView.convoyReach` ve `hasCombatCraft`, seçim ekranıyla aynı
  `fleetCombatReady ?? partitionCombatFleet(fleet, fleetDamage).eligible` kaynağını kullanır.
  Sağlık filtresi için yeni bir yüzde hesabı yazılmaz.
- Konvoy erişimi mevcut `now` tick'inden gerçek dakika değerini kullanır; `tradeMinute`
  üzerinden kalkış saati üretilmez. Sabit maliyetli doğrusal çözüm için yeni timer veya
  ağ isteği eklenmez. Tüccar ve diğer erişim hesapları değiştirilmez.
- Seçim ekranı ve hold tamamlanırken teklif aynı konvoy planner'ıyla yeniden hesaplanır.
  Mevcut seçim, hata sonrası korunur; otomatik gemi ekleme/çıkarma yapılmaz.
- Kart ve gönderim ekranında “Konvoya gidişte 2× hız. Dönüş normal hızda.” kuralı görünür
  olur. Çarpan ekrana ortak sabitten verilir; dillerde bağımsız mekanik sabit tutulmaz.
- Mevcut koşulsuz “rota radyasyonu gemilerini yok edebilir” açıklaması kaldırılır.
  Metin, eski sezon uyumluluğuna rağmen bütün sürümler için mutlak kayıpsızlık vaat etmez.
  Güncel modelde ek uçuş hasarı olmadığı ve önceki yaraların korunduğu Wiki'de açıklanır.
- Kartın “buradaki hiçbir filo” ile seçim ekranının “seçtiğin filo” ret nedenleri ayrılır;
  yavaş bir seçim bütün gemiler yetişemiyormuş gibi anlatılmaz. Yeni hız her son dakika
  uçuşuna garanti vermez.
- `locales/{en,tr,de,fr,es,ja}/convoy.ts` birlikte güncellenir; Wiki'nin konvoy makalesindeki
  mevcut İngilizce/Türkçe metinler ve ortak dil sunumu kontrol edilir.
- Görsel trafik, kayıtlı nokta ve zaman damgalarıyla ilerler; renderer'a ayrıca 2× çarpanı
  eklenmez. Eski ve yeni uçuşların animasyonları kendi kayıtlarına göre doğru kalır.

## 6. Dosya ve değişiklik haritası

| Alan | Beklenen değişiklik |
| --- | --- |
| `packages/rules/src/constants.ts` | Yalnız konvoyun gidiş çarpanı. |
| `packages/rules/src/intergalacticConvoy.ts` | Yalnız konvoya özel çözücüde tek çarpım ve normal-hız girdi açıklaması. |
| `apps/web/src/screens/GalaxyView.tsx` | Konvoy erişiminin gerçek saat ve gönderilebilir filo düzeltmeleri. |
| `apps/web/src/galaxy/FocusPanel.tsx`, `screens/IntergalacticConvoySheet.tsx` | Hız açıklaması, doğru ret kapsamı; ortak hesap korunur. |
| Altı `convoy.ts` locale dosyası, `wiki/galaxy-content.ts` | Doğru hız/radyasyon açıklaması. |
| İlgili rules/server/web testleri | Bağımsız hız, dönüş, izolasyon, zaman ve abuse doğrulamaları. |
| `docs/game-design.md` konvoy bölümü | Uygulama tamamlanınca yeni gidiş kuralını güncel davranış olarak yazmak. |

Sunucu gönderim servisi ve istemci `navigation.ts` normal hız vermeye devam edeceğinden
hız uygulaması için değişmek zorunda değildir. Testin doğruladığı gerçek bir ihtiyaç
olmadan bu dosyalar, worker, DB, genel hareket/aktarım veya radyasyon motoru refactor edilmez.

## 7. Test planı — TDD

### 7.1 Bağımsız sayısal örnek

Rota `(-4500,0,0) → (4500,0,0)`, zaman `0 → 180 dk`, konvoy hızı 50;
çıkış `(-3000,0,0)`, gönderim 90. dakika, araştırma/Beacon yok:

| Gemi | Normal hız (birim/dk) | Yeni temas süresi | Normal hızda dönüş süresi | Saldırı dahil toplam |
| --- | --- | --- | --- | --- |
| Warden | 75,7009345794 | 29,5852534562 dk | 59,2255480647 dk | 88,8941348543 dk |
| Pike | 68,0672268908 | 34,8292682927 dk | 69,7197505771 dk | 104,6323522032 dk |

Referans denklem `temas = 3000 / (2 × normalHız − 50)`; dönüş mesafesi
`3000 + 50 × (temas + 5/60)` ve dönüş hızı normal hızdır. Beklenen değerler üretim
konvoy çözücüsünden türetilmez. Özellikle Pike, 90 dakika kalan geçişte toplam uçuşu
90 dakikayı aşsa da kabul edilmelidir. Katalog hızları ileride bilinçli değişirse bu
örnek o değişiklik kapsamında yeniden hesaplanır; sahte başarı için tolerans genişletilmez.

### 7.2 Rules testleri

- Yukarıdaki 2× örnekler mevcut kodda önce FAIL verir; doğru gidişten sonra PASS olur.
- Bağımsız geometri kontrolü: `distance(origin, intercept) / elapsedMinutes = 2 × normalSpeed`;
  rastgele sonlu konum, farklı yön ve araştırma/Beacon kombinasyonlarıyla kontrol edilir.
- Tek ve karışık filolar, savaş gemisi + nakliyeci, gemi sayısı değişikliği; 2× yalnız bir kez
  uygulanır. Ortak hız/modifier girdilerinde mutasyon yoktur.
- Yaklaşan/uzaklaşan konvoy; zaten temas noktasında olma; geçersiz hız, boş filo ve son
  anda hâlâ yetişilemeyen uçuş. `expiresAt − 5 sn` sınırı ve sonrasının ayrımı korunur.
- Genel doğrusal çözücü, normal filo hızı, standart gidiş/dönüş, mission pace ve yakıt
  fonksiyonlarının mevcut sözleşmeleri değişmez. Çarpandan beklenen sonuç testte de
  aynı değiştirilebilir sabitten okunarak döngüsel bir doğrulama yapılmaz.

### 7.3 Gerçek DB / API testleri

- Normal hızla yetişmeyen Pike/Warden'ın yeni kuralla kabulü; iki bacağın gerçek maliyeti,
  normal dönüş hızı, kayıtlı noktalar/zamanlar, doğru queue event'i ve tek uçuş yuvası.
- Konvoy ayrıldıktan sonra normal dönüşün sürmesi; sezon bitiminden sonraki dönüşün
  atomik reddi. Gönderimdeki araştırma/Beacon değişse de kayıtlı görevin değişmemesi.
- §4'teki istek sahteciliği, yetki, aynı/farklı anahtarlı yarış, yetersiz sağlık/stok ve
  konvoydaki gemilerle eşzamanlı savaş/aktarım senaryoları. Ret sonrası stok/yakıt/hak/bay
  durumları da doğrulanır; yalnız hata koduna bakılmaz.
- Aynı gemiler eve döndükten sonra standart savaş/aktarımın normal hızda gitmesi;
  oyuncu veya gemi üzerinde taşınan bir bonus olmadığının davranışla kanıtı.
- İki ayrı gezegenin ayrı konvoy hakkı; dönüş sonrası aynı geçişe tekrar ret; duplicate
  arrival/return ve mevcut worker recovery/başkent fallback'i.
- Güncel hedef radyasyonunda gidiş/temas/dönüşe sıfır ek doz; yaraların taşınması. Eski
  uzamsal radyasyon testleri mevcut sürümlerinin kaydı olarak korunur, güncel kabul testi
  diye sunulmaz. Mevcut server konvoy testlerinin bir bölümü ruleset 8, bazıları HP 16
  kullandığından yeni güncel-model senaryosu ayrıca açıkça kurulmalıdır.
- Uygulamadan önce gönderilmiş görev, eski noktaları ve zamanlarıyla fixture olarak
  oluşturulur. Yeni kodun görüntüleme/worker/replay yolları bunları değiştirmeden tamamlar.

### 7.4 Web ve görsel doğrulama

- Gerçek planner önizlemesi, hold anındaki teklif ve sunucu cevabının uyumu; normal
  dönüş süresi/fuel ve hareketli rendezvous. Yalnız mock edilmiş `reachMinutes` yeterli değildir.
- §2'deki başlangıç-saniyesi ve %5 can örnekleri önce FAIL, düzeltmeden sonra PASS;
  hasarlı hızlı gemi/sağlıklı yavaş gemi, sadece hasarlı savaş gemisi ve sadece kargo durumları.
- Erişim kartı ile seçili-filo ret nedenlerinin doğru kapsamı; quota/bay/fuel öncelikleri.
- 2× açıklaması ve yanıltıcı uçuş-radyasyonu metninin düzeltilmesi; locale anahtarları ve
  Wiki yayın sözleşmesi. Eski açık istemci ve reddedilen teklif sonrası seçimlerin korunması.
- `node tools/visual.mjs` üzerinden gerçek konvoy odağı/gönderim/rota için 350 px telefon
  ve masaüstü kontrolü; altı dilde taşma, eksik çeviri, yanlış süre veya çift hız uygulaması
  olmaması. Gallery'deki `convoy` gerçek `IntergalacticConvoySheet` kullanıyor; ancak
  fixture'ı eski 120 dakikalık/4000 birimlik rotada. Yeni görsel kabul için bu fixture
  güncel 180 dakika/9000 birim/50 birim-dakika rotasıyla kurulmalı; açıklamalar hem
  yeni gönderimde hem kayıtlı eski uçuşta doğru kalmalıdır.

### 7.5 Çalıştırma ve tamamlanma ölçütü

Önce ilgili FAIL testleri, sonra en küçük uygulama, ardından hedefli PASS ve bağlı
regresyonlar. `intergalactic-convoy`, `entity-radiation`, `flight-modifiers`, `flight`,
`mission-pace`, `fuel`, server savaş/aktarım/tüccar/korsan testleri ve ilgili web/Wiki
testleri kapsama göre seçilir. Sonunda typecheck/lint ve normal doğrulama kapısı geçer.

Kısa hedefli testler 1 worker; daha geniş gruplar CLAUDE.md'deki güncel 4 worker kuralı
ve bellek koşullarıyla çalışır. Worker heap'i 1024 MiB; DB kullanan her worker'a ayrı,
göçe tabi geçici `_test` veritabanı; hata/iptal dahil bağlantı kapatma ve cleanup gerekir.
Test/typecheck/lint aynı anda çalıştırılmaz; heavy kilidi ve RSS sınırları korunur.
Ekonomi/sezon simülasyonu veya snowball audit'i bu talebin kapsamına dahil değildir.

## 8. Yayın ve geri alma davranışı

Bu bölüm uygulama kabulünden sonraki yayın için gereksinimdir; şu anda deploy yapılmaz.

- Ortak rules değişikliğini içeren web ve bütün API instance'ları aynı sürüme getirilir;
  worker uyumlu artifact ile yayımlanır. Kullanıcıya sunulan native paket kendi web kodunu
  taşıyorsa onun sürüm uyumu da kontrol edilir. Açık eski istemcilerin yenilenmesi sağlanır;
  karışık API sürümlerinin uzun süre hizmet vermesi kabul edilmez.
- Hız alanı API'ye eklenmez. `routeVersion`, reward/formation sürümleri, konvoy rotası ve
  DB şeması değiştirilmez. Kayıtlı uçuşu okumak için yeni çarpanı bilmek gerekmez.
- Kuyrukta ve yoldaki eski görevler yeniden planlanmaz. Yeni kod sadece yeni gönderimin
  noktalarını ve zamanlarını hesaplar; worker ve animasyon bunların kayıtlı hâlini kullanır.
- Eski istemcinin eski teklifi toleransı aşarsa yeniden inceleme istenir; toleransa sığarsa
  sunucunun doğru hesabıyla kabul edilebilir. Bu fark ekstra yetki veya hız seçimi vermez.
- Geri almada yeni kodla gönderilmiş görevler de kayıtlı saatleriyle tamamlanmalıdır.
  Önce uyumluluk fixture'ı doğrulanır; görev satırı, kaynak veya queue silinmez ve canlı
  verinin üstüne eski dump yüklenmez. Kullanıcı verisi değiştiren bir migration gerekmez.

## 9. Uygulama öncesi review kanıtı

- Üretim çağrı zinciri, API şeması, sağlık seçimi, iki bacağın saklanması, recall ayrımı,
  koloni terk engeli, güvenli eve teslim, worker recovery ve mevcut UI/Wiki metinleri okundu.
- §2'deki iki ekran tutarsızlığı gerçek mevcut fonksiyonlarla yeniden üretildi.
- Rules: `intergalactic-convoy.test.ts` ve `entity-radiation.test.ts`: **35 PASS**.
- İzole ve migration uygulanmış tek worker DB'sinde seçilmiş server testleri: **8 PASS**.
  Kapsam: uçuş verilerini dondurma/yakıt/bay, quota, aynı-dünya yarışı, sahip değişimi,
  idempotent API replay, uçuşta sıfır hedef radyasyonu, serbest alan reddi ve HOLD/dönüş.
  Diğer **17 test bu hedefli koşuda seçilmedi**; bütün server suite'i çalıştırılmış sayılmaz.
  Oluşturulan geçici veritabanı koşu sonunda silindi.
- İlk review sırasında 2× uygulaması ve yeni testler henüz yapılmamıştı. Yukarıdaki
  35 + 8 testi, uygulamanın kabul kanıtı değildir; güncel sonuçlar aşağıdadır.


## 10. Uygulama ve doğrulama kaydı — 2026-11-04

- Taban: `2f22cc99`; dal: `codex/convoy-outbound-2x`.
- Worktree: `/home/yildirim/.codex/worktrees/7570/blindspace`.
- Ana dizindeki bağımsız kapasite/bağlantı çalışmaları taşınmadı. Yalnız bu plan ve önceki
  radyasyon dokümanı düzeltmeleri, HEAD üzerine bu worktree'ye alındı.
- Çarpan yalnız `interceptIntergalacticConvoy` içindeki genel çözücü çağrısında uygulanıyor.
  Genel hız/seyahat/yakıt fonksiyonlarına, sunucu API şemasına, DB veya worker'a uygulama
  değişikliği yapılmadı. Dönüş mevcut normal hız hesabını ve gönderimdeki snapshot'ı kullanıyor.
- `convoyOpportunity`, gönderilebilir gemilerle gerçek kalkış anından en iyi erişimi
  hesaplıyor. Galaksi kartı ve seçim ekranı aynı sağlık uygunluğu kuralını kullanıyor.
- Altı dilde hız kuralı, seçili filoya özel ret nedeni ve konvoy Wiki'si güncellendi.
  Dev gallery hem gerçek kartı hem seçim ekranını güncel 180 dakikalık rotayla gösteriyor.
- TDD: bağımsız Warden/Pike değerleri, mesafe denklemi, son 5 saniye sınırı ve ekran
  beklentilerinin mevcut kodda FAIL olduğu görüldü; uygulama sonrasında PASS oldu.
- Rules regresyonu: **7 dosya / 158 PASS**.
- Web regresyonu: **12 dosya / 263 PASS**. Eski uçuş-radyasyonu metnini zorunlu kılan
  i18n beklentisi doğrulanan güncel kurala göre düzeltildi; genel kayıpsızlık vaadi eklenmedi.
- Server regresyonu: dört ayrı worker/veritabanında **13 dosya / 283 PASS**; ayrıca aynı
  fiziksel gemiler için gerçek konvoy/aktarım yarışı **1 PASS**. Toplam **284 server testi**.
  Yetki/teklif sahteciliği, stok, normal dönüş, sezon sınırı, eski kayıtları tamamlama,
  tekrar istek/ödül, anıt radyasyonu, standart savaş/aktarım/tüccar/korsan yolları kapsandı.
- Toplam: **705 seçilmiş regresyon testi PASS**. Bu sayı tüm deponun testlerini içermez;
  uzun ekonomi/sezon simülasyonu veya snowball audit'i çalıştırılmadı.
- Tip kontrolü: bütün workspace'ler geçti; son server/web test ve gallery güncellemelerinden
  sonra bu iki workspace ayrıca tekrar geçti. Compiler veya lint susturması eklenmedi.
- Değişen 21 TS/TSX dosyasında hedefli lint geçti: 3 rules, 1 server, 17 web.
  Gereksiz bir test non-null işareti ve boşa çıkan `combatValue` importu kaldırıldı;
  kural kapatma veya compiler/lint susturması kullanılmadı.
- Görsel kontrol: altı dil × 350/1280 px × kart/seçim ekranı = **24 görünüm PASS**;
  taşma, eksik çeviri veya tarayıcı hatası yok. TR gönderim ve DE kart görüntüleri ayrıca
  gözle incelendi. `node tools/visual.mjs ... --wiki` üç desktop/mobile yolculuğunu geçti.
- Bu görevin oluşturduğu **7 geçici veritabanının tamamının silindiği** ayrıca sorguyla
  doğrulandı. Önizleme sunucusu durduruldu; ana geliştirme veritabanına dokunulmadı.
- Yerel kanıtlar: `out/convoy-validation/` (RED/PASS logları, tip/lint çıktıları, ekran
  görüntüleri ve ölçümler). Bu kayıt bir merge veya production deploy bildirimi değildir.
