# Monument ayrıntılı kod ve oynanış incelemesi

Tarih: 2026-10-04. Kod, ürün sözleşmesi ve ikinci bağımsız inceleme karşılaştırıldı; aşağıdaki ilk bölümler geliştirme sırasında tutulan ara kayıtlardır. Güncel kararlar, kritik yol incelemesi ve görsel kanıtlar son bölümde yer alır. Genel test kapısının sonucu ayrıca kaydedilir; hedefli test başarısı tüm proje doğrulaması anlamına gelmez. Sezon ekonomisi simülasyonu ve snowball audit sahibin son talimatıyla kapsam dışındadır.

## İnceleme sınırları

- Ruleset 14–15 yüzde radyasyonu ile 16+ HP radyasyonunun ayrılması; her uçuş ailesinde gerçek rota, teknoloji snapshot'ı, ölüm zamanı ve yük kaybı.
- Fiziksel gemi/kargo korunumu; tek kök uçuş yuvası, hassas sağlık/kesirler, üretim paylaşımı ve tier kapasite seçimi.
- Solo/klan kontrolü, bağımsız ve ortak saldırı, savaş başı Dominion ağırlıkları, yönetici muafiyeti ve immutable sonuç kayıtları.
- Lazy settlement, geç/stale worker, aynı zamanlı işlemler, sıralı kilitler, geri çağırma, üyelik/köken kaybı ve sezon bitişi.
- Gerçek API/fog, event/cache bağlantıları, kendi filo görünümü, probe, bildirim, savaş raporu ve radyasyon önizlemesi.
- 350 px ve masaüstünde gerçek backend ile etkileşim ve görsel kontrol; testlerin doğrulayamadığı anlaşılırlık, rota/model ölçeği ve karar desteği.

## Açık bulgular ve doğrulamalar

### İkinci bağımsız inceleme — yeniden açılan kapanış maddeleri

Önceki incelemedeki toplu “düzeltildi” kayıtları bütün yolları kapsamıyordu. `monument-review-2026-10-04.md` ikinci turundaki N maddeleri ayrı ayrı yeniden doğrulanıyor. Genel test kapısı bunlar, son radyasyon görseli ve anıt isimleri tamamlanmadan çalıştırılmayacak.

- N-01 saldırı quote rezervasyon sızıntısı; N-02 canlı radyasyon toplamı; N-03 varış hasarlı HOLD tahmini: kodda doğrulandı, regression test ve düzeltme bekliyor.
- N-05 kapasite dönüş bildirimi; N-06 yanlış radyasyon sürümü; N-07 yeni dost tutucuya inbound uyarısı; N-08 katkı kalkan onayı; N-15 kaynağın geriye tarihlenmesi ve timer planlaması: servis ve HTTP yolları test edilecek.
- N-09/N-10 toplu katılımcı okuma kilit sırası ve quote maliyeti; N-11 convoy görsel testi; N-13 gerçek simülasyon; N-14 yeni sezonun varsayılan sürümü; N-16 boş/garnizon dönüş UI'sı; N-18 hassas dock eşiği ve migration kayıtları: inceleme açık.
- N-12 Türkçe hacim birimi düzeltildi; i18n regression tekrar çalıştırılacak. N-17 eski lint snapshot'ı güncel çalışma ağacında yeniden ölçülecek; yeni isim gallery referansındaki kalan kullanım düzeltildi.
- `clan-support-schema.test.ts` gerçek regresyon olarak yeniden üretilecek. Mevcut Death Star ve notification test hataları ayrıca HEAD kıyasından ayrılarak değerlendirilecek; tarihsel başarısızlıklar saklanmayacak.
- Radyasyon görseli gerçek masaüstü/mobil/inside çıktılarında owner tarafından onaylandı; son talimatla bütün haze opacity değerleri %25 azaltıldı. Anıt isimleri bütün UI yollarında tek dil çözümleyicisine taşındı; 46 hedefli UI testi geçti. Son görsel kapı ve tip/lint kontrolleri tamamlanacak.

### Normal uçuşun bütün bilinen yoluna onay

- Yeni HP modelinde raid için gidiş, on saniyelik engagement ve tam hızlı dönüş birlikte kontrol edilir. Radyasyon gelecekte yalnız dönüş aralığında etkinse onaysız gönderim rollback eder. Bu tahmin savaş sonrası gemi sayısını garanti etmez.
- Transferde bütün gemiler gidişi, yalnız seçilen RETURN gemileri dönüşü öder. Hedefte kalan bir gemiye dönüş dozu veya kayıp onayı yüklenmez; kayıp sayısı iki bacağın toplamında bir gemiyi iki kez saymaz. Eski yüzde modelinin gidiş kapısı korunur.
- Dokunulacak yerler `mission.ts`, `movement.ts`, ortak radiation onay sınırı ve gerçek DB HP uçuş testleridir. Ayrı return-window ve karışık stay/return testlerinin FAIL/PASS kanıtı gerekir.

### Canlı fiziksel uçuş görünümü

- Launch roster geçmiş kaydıdır. Kendi pending ve sensörün çözebildiği public contact gerçek `units`, taşınan hasar ve ödenmiş cursor'dan okunur; boş physical roster geçmiş snapshot ile doldurulmaz.
- Read-only HP tahmini gerçek rota hızını korur. Cursor öncesi doz tekrar uygulanmaz; tek düşük HP gövdesinin ölümü yüksek HP gövdesini gizlemez. Bütün kanat gerçekten öldüğünde late worker beklenmeden contact kalkar. Prospector ve dönüşte kazanılmış sağlıklı gemiler fiziksel roster'a dahildir.
- Pirate gerçek dönüş başlangıcını kullanır; trade dock ve convoy moving engagement aralıkları gelecekteki ölüm hesabına dahildir. Kaynak tarih pencereleri korunur. Salt görüntü tahmini kaynak, HP veya sonuç journal'ına yazmaz.
- Etkilenen yerler ortak readonly radiation projection, pending ve traffic snapshot/projection, pirate capture staging'dir; gerçek DB temporal/physical/cursor testleri ve eski traffic/pending regresyonları gerekir.

### Frozen ekranın ağ davranışı

- Sezon kapanınca monument verisi ve geçmiş filo okunabilir kalır, ama send/recall quote POST'ları cache veya physical lot yenilenmesiyle tekrar çalışmaz. Seçili recall ile açık ekranın kapanışa geçişi kontrol edilir; yalnız fieldset disable yeterli değildir.
- Etkilenen yerler MonumentSheet/useSeasonLocked ve gerçek QueryClient ağ testi; önce açık→frozen→güncel lot geçişi FAIL ile gösterilir.

### Klan dalgası çevresel kayıp onayı

- Her katkının açık radiation kaybı onayı kendi oyuncusundan gelir ve dalgada saklanır. Liderin kendi onayı üyenin izin vermediği bilinen ölüm riskini aşamaz. Staging sırasında bilinen HP kaybı da quote/commit'te görünür; shield onayı bu izin yerine geçmez.
- Gerçek start yeni kaynak pencereleri, gerçek ortak hız, her owner'ın snapshot araştırması ve taşınan yarasıyla yeniden kontrol edilir. Nötr/native yolda HOLD belirsiz olduğu için bilinen gidiş kontrol edilir; gezegen joint raid'inde bilinen engagement/dönüş de yer alır. Hiçbir refusal gemi/fuel/bay/kalkan/operasyon mutasyonu bırakmaz.
- Etkilenen yerler contribution consent migrasyonu, quote/start/HTTP, ClanWaveSheet/WarPanel ve typed client; üye onayını liderin aşması, lethal staging, damage ve HTTP false/true testleri önce FAIL olmalıdır. Ekran riskli gidişi, per-hull sağlığı ve hangi üyenin kendi onayının eksik olduğunu gösterir.

1. **Entegrasyon eksikliği:** monument sonuç journal'ı mevcut rapor okuyucusuna ve bildirim akışına henüz bağlı değil. Probe ve dönüş payload'ları mevcut istemci ayrıştırıcılarıyla uyumlu değil. Kesin yabancı filo bilgisi sızdırmadan birinci sınıf monument kimliğiyle tamamlanacak.
2. **Entegrasyon eksikliği:** özel uçuş servislerindeki HP kayıp onayı HTTP sınırlarına ve oyuncu önizlemelerine henüz taşınmadı. Kodun serviste doğru olması oyuncunun riski görebildiğini veya onaylayabildiğini kanıtlamaz.
3. **Zaman/snapshot riski:** özel uçuşların canlı roster'ı, gerçek dönüş başlangıcı, tam filo ölümünde haritadan kalkması ve bekleme/engagement dozu ayrı ayrı incelenecek.
4. **Kilit/yetki riski:** ortak monument hazırlığında global world/target/clan/player kilit sırası; geç savaşların configured-admin kapsamı ve son outbound dalga geri çağrıldığında operasyonun kapanması kontrol edilecek.
5. **Public cache riski:** son HOLD gemisinin lazy settlement sırasında ölmesiyle kontrolün public event'e taşınması ve sezon sonundan sonraki read/forecast cutoff'ı kontrol edilecek.
6. **İstemci regresyonu:** yeni monument focus türü eski pending-strip test helper'ının dar callback tipiyle uyuşmuyor; typecheck bunu yakaladı. Native uçuş bağlamının legacy yüzeylerinde hedefli regresyon çalıştırılıyor.

### Klan read/lock düzeltmesinin gereksinimleri

- Gecikmiş native savaş hangi girişten ilerlerse ilerlesin aynı configured-admin muafiyeti geçerlidir. HTTP klan read, mark, quote, send, recall, cancel ve start sunucu kapsamını taşır; istemci yönetici listesi gönderemez.
- `ATTACKING` monument operasyonu klan ekranı okunmadan ilerletilir; tek savaş, tek journal ve yalnız gerçek canlı HOLD gösterilir. Salt hazırlık ve normal gezegen akışı mevcut davranışını korur.
- Yazılabilecek bütün origin/staging/target/monument home dünyaları keşfedilip birlikte sıralanır. Monument hazırlanmasından önce kısmi world kilidi almak, sonraki daha küçük kimlikli world ile döngü oluşturabilir; bu çağrılar ortak keşif helper'ına taşınır.
- Etkilenen yerler: `clanWar.ts`, HTTP klan yolları ve gerçek DB joint-war testleri. Yönetici puanı ve gecikmiş ATTACKING read için iki ayrı FAIL kanıtı; normal klan hazırlığı, recall/expiry/concurrency regresyonu da gereklidir.

### Sezon cutoff ve özel uçuş onayının gereksinimleri

- Sezon status satırı henüz `live` iken bitiş saati aşılabilir. Geç read negatif zaman segmenti oluşturmamalı; üretim/HP cutoff'ta durmalı, sonrasındaki return forecast doğrudan kapanış teslimini göstermeli ve bütün quote/mutation yolları `SEASON_FROZEN` vermelidir. Recall kimliği authenticated sezona ait değilse yabancı hedefi kilitlemeden 404 verir.
- Pirate/trade/convoy servisindeki `acknowledgeRadiationLoss` boolean'ı strict HTTP parser'dan gerçek servise ulaşmalıdır. Açık false/eksik onay lethal uçuşta 409 ve sıfır yan etki; true gerçek kalkış; convoy retry tek run üretir. Mevcut shield onayı bu onayın yerine geçmez.
- Dokunulan yüzeyler native API/forecast, üç özel launch HTTP yolu ve test fixture'larıdır. Eski sezonlara HP source veya onay davranışı uygulanmaz.

### Native public traffic gereksinimleri

- Yalnız native OUTBOUND/RETURNING ve probe transit çizilir; HOLD manifest'i bu sorguya girmez. Kendi commander'ın uçuşu origin ele geçirilse bile public listede ikinci kez görünmez.
- Mevcut sensör kuralı korunur: NONE'da hiç payload yok; Radar yalnız bearing ve kendi rung'ının size/kind bilgisi; Telescope havadaki gerçek roster'ı çözer. Kargo, yara, araştırma, target/origin/player kimlikleri ve bütün rota verilmez.
- Worker gecikse bile gerçek cursor/rota/owner armor ile canlı roster forecast edilir. Bir gövdenin ölümü kalan wing'i silmez; bütün wing ölürse contact kalkar. Orijinal hız, dönüş yönü ve sezon cutoff'ı korunur; probe HP'den muaftır.
- Yeni gerçek DB traffic testleri bu dört grubu FAIL ile gösterir; mevcut trafik regresyonu ve renderer ölüm sınırı ayrıca doğrulanır.

### Oyuncunun HP önizlemesi gereksinimleri

- Ruleset 16'da HP cloud geometry/history kullanılır. Tek yüzde bütün gövdelere yazılmaz: HP/gemi, her gövdenin gerçek kalan HP/yüzdesi, kayıp adedi ve ücretsiz tamir/dock sınırı gösterilir; armor ve alt-bp kesri korunur. Eski yüzde önizlemesinin sözleşmesi aynen kalır.
- Bilinen planlanan gidiş, dock/engagement ve dönüş segmentleri aynı saf HP motoruyla hesaplanır. Bu radyasyon hesabı savaş hasarını tahmin ettiği anlamına gelmez; kapsamı oyuncuya belirtilir. Transfer'de yalnız gerçekten geri dönecek seçim için dönüş hesaplanır.
- Pirate/trade/convoy held commit'i gerçek `acknowledgeRadiationLoss` alanını ancak gösterilen kayıp/onayla taşır; özel hedefte gecikmiş server lethal cevabı da aynı seçime bağlanır. Normal world/transfer mevcut `acknowledgeRadiation` alanını korur.
- Dokunulan yerler ortak client HP adaptörü/uyarı, dört launch yüzeyi ve typed API/mutation girdileridir. Happy/partial loss, muaf araç, shelter/window, mixed hull/armor ve hassas dock sınırı için önce FAIL gerekir; gerçek 350 px/desktop görsel onay kapatılmadan bitmiş sayılmaz.

## Kabul kanıtı

Her kapatılan bulgu için ilgili FAIL → PASS testi, hedefli regresyon, manuel/görsel kanıt ve kalan sınırlama buraya eklenecek. İnceleme bitmeden hiçbir madde örtük olarak onaylanmış sayılmaz.

- **Rapor kimliği düzeltildi:** savaş journal'ı monument ordinal/konum snapshot'ı taşır (0136). NPC savaşı planet history boşken de görünür; hedef temizliği raporu bozmaz. Kendi roster/yaralar/loot/Dominion yalnız own participant'tan, karşı taraftan yalnız doğrulanan kayıplar okunur. Yeni testler 2 FAIL → PASS; mevcut rapor/arrival/event regresyonuyla **69 PASS / 4 dosya**.
- **Bildirim ve kapılar bağlandı:** her katılımcıya bir savaş sonucu; gerçek inişten önce dönüş haberi yok; probe gözlem/teslim saatleri ayrı. Fiziksel teslim/probe/movement/send **45 PASS / 4 dosya**; istemci bell/report/legacy sinyaller **171 PASS / 8 dosya**. Ortak kalkış payload'ı da aynı public hedef adını taşır. Görsel onay hâlâ bekliyor.
- **Native uçuş yüzeyleri:** harita, airborne liste, Now line, HOLD grubu ve anıta açılan uçuş rail'i bağlandı. Kendi tam ölüm zamanı renderer'a aktarılır; tek gövde ölümü bütün wing'i silmez. İlgili UI **46 PASS / 4 dosya**. İlk native ölüm tahmini eksikliği HTTP testinde FAIL olarak görüldü; own armor/route zamanları eklendi ve **15 API testi PASS**. Geç sezon okuması ve public loss/cache bildirimi ayrıca kontrol edilecek.

## Son inceleme ve teslim kararı

### İkinci bağımsız incelemenin kararları

Önceki “M-02–M-08 ve M-14–M-20 düzeltildi” ifadesi eksik yolları kapandı sayıyordu. M-08'in sürüm reddi, M-14'ün saldırı quote'u ve M-19'un Türkçe hacim metni gerçek eksiklerdi. Bu incelemede ayrı ayrı düzeltildiler. İnceleme, daha önceki kapanış cümlesini kanıt olarak kullanmaz.

| Bulgu | Karar ve son davranış | Doğrulama |
| --- | --- | --- |
| N-01 / M-14 | Gerçek bilgi sızıntısı düzeltildi. Düşman quote'unda savunmanın yoldaki rezervasyonu 0; `after` hesabı da rezervasyondan gizli bilgi türetmez. Dost quote gerçek kapasite bütçesini kullanır. Public liste yalnız okuyanın kendi rezervasyonunu gösterir. | `monument-send.test.ts`: rezervasyonun bütün hostile quote alanlarında gizlenmesi; `monument-api.test.ts`: public/own ayrımı. |
| N-02 | Gerçek hesap hatası düzeltildi. HP/dk, o anda etkin kaynakların ortak küre/shelter hesabıyla örneklenir. Bitmiş ve gelecekte başlayacak bulutlar anlık değere eklenmez; uçuş tarihi için kaynak geçmişi tutulur. | `monument-api.test.ts`: sona ermiş, gelecek, üst üste binen, farklı ankraj ve shelter kaynakları. |
| N-03 | Gerçek tahmin hatası düzeltildi. Dost takviyenin HOLD tahmini, gidiş sonunda kalan fiziksel lotlar ve gerçek yara ile başlar. Yolda ölen gemi gelecekteki üretime veya kayıp saatine girmez. | `monument-send.test.ts`: yol hasarıyla ilk HOLD kaybı; `monument-api.test.ts`: dost tahmini ve saldırı belirsizliği. |
| N-05 | Gerçek bildirim eksikliği düzeltildi. `monument_returning`, CAPACITY nedeni ve eve ETA ile hemen gönderilir. `fleet_returned` yalnız fiziksel inişte gönderilir. | `monument-arrival.test.ts`, `monument-movement.test.ts`, `monument-news.test.tsx`: metin, ETA, gerçek anıta açılan kapı. |
| N-06 / M-08 | Gerçek operatör hatası düzeltildi. Ruleset 16'da yüzde kaynağı eklemek reddedilir; HP ekle/bitir/listele yolu kullanılır. Eski sezonların yüzde modeli korunur. | `radiation-service.test.ts`, `radiation-cli.test.ts`. |
| N-07 | Gerçek uyarı eksikliği düzeltildi. Sonradan HOLD'a giren dost oyuncu, daha önce kalkmış ve ETA'sı geçmemiş düşman saldırısını öğrenir. Bildirim mevcut tutucularda çoğalmaz; filo kompozisyonu taşımaz. | `monument-arrival.test.ts`: takviye ile yeni tutucu; `monument-send.test.ts`: ele geçirme ve kalkış. |
| N-08 | Gerçek HTTP doğrulama eksikliği düzeltildi. Kalkan onayı katkı staging sınırında zorunludur; onaysız istek hiçbir gemi veya kaynak taşımaz. Ortak kalkışta gerçek kalkan ve her üyenin kendi HP kayıp onayı tekrar kontrol edilir. | `monument-joint-war.test.ts`: strict HTTP false/true, liderin üye yerine onay verememesi, staging/başlangıç arasında kaynak değişimi. |
| N-09 | Önceki deneyde deadlock üretilemedi, ama toplu kilit sırası ihlali gerçekti. Hedeflerin bütün dünyaları tek seferde, ardından hedef/klan/oyuncular sıralı kilitlenir. | `monument-api.test.ts`: iki gecikmiş hedefte 8 eşzamanlı okuma, tek kayıp bildirimi; üyelik ve ownership race testleri. |
| N-10 | Gerçek maliyet sorunu düzeltildi. Olağan HOLD ve gidiş/dönüş okuması HP/geliri bellekte projekte eder. Ancak gerçekleşmiş varış, ölüm, respawn veya probe teslimi yazma yolunu açar. Quote 200 ms debounce edilir ve yeni seçimin eski quote ile gönderilmesi engellenir. | Kilitli home dünyası varken read/send quote/recall quote tamamlanır ve DB değişmez. Ayrıca bir recall manifest sorguları arasında commit ederken repeatable-read snapshot testi; 48 okuma ve iki kısmi recall yarışı. |
| N-11 | Davranış doğru, source sözleşmesi testi eskiydi. Native monument uçuşu mevcut convoy koşuluna eklendi; test ikisinin birlikte kalmasını doğrular. | `intergalactic-convoy-visual.test.ts`: 12 PASS. |
| N-12 / M-19 | Gerçek metin eksikliği düzeltildi: Türkçe “Hacim”. Beş modelin gerçek adları finder, focus, sheet, rapor, haber ve filo yüzeylerinde ortak çeviri çözümleyicisiyle kullanılır. | `monument-names.test.ts`, `monument-news.test.tsx`, `monument-sheet.test.tsx`; EN/TR gerçek browser çıktıları. |
| N-13 | Sahip kararıyla kapsam dışı. Sezon ekonomisi simülatörü, snowball audit ve kalibrasyon çalıştırılmadı. Veri taşıma gerçek simülasyon desteği sayılmaz. | Son talimat; genel kapı `--exclude-sims` kullanır. |
| N-14 | Açılış tamamlandı. Varsayılan ruleset 16; yeni normal sezon ve otomatik devam sezonu beş hedef/bulutla açılır. Eski sezonlar değiştirilmez. | `monument-season-seed.test.ts`, `season-lifecycle.test.ts`; local DB ruleset 16, live, 5/5. |
| N-15 | Gerçek geçmiş hasar ve timer hatası düzeltildi. Geçmiş başlangıç, bitmiş pencere ve cutoff dışı başlangıç reddedilir. Operatör önce eski kaynaklarla bütün native zamanı öder, sonra kaynağı değiştirir ve pending kayıp timer'larını yeniden planlar. Gelecek bulutu iptal etmek sıfır uzunluklu geçerli pencere bırakır. | `radiation-service.test.ts`: geriye tarih reddi, yeni HOLD timer'ı, geçmişi koruyan bitirme, gelecek kaynağı iptal. |
| N-16 | Boş hedef “Sahipsiz”; 24 saat garnizon dönüşü gösterilir, sezon bitişine yetişmeyecek respawn vaat edilmez. “Senin rezervasyonun” metni private kapsamı açıklar. Saldırıya HOLD saati verilmemesi bilinçli: savaş sonucu ve kalan sağlık bilinmiyor. | `monument-api.test.ts`, `monument-sheet.test.tsx`; 350 px TR boş-state browser çıktısı. |
| N-17 | Kaynak/test lint hataları düzeltildi; final workspace kapısı ayrıca ölçülür. Yalnız değişen dosyalardaki ESLint başarısı final lint yerine kullanılmaz. | Hedefli ESLint yeşil; son kapı sonucu aşağıya eklenecek. |
| N-18 | Dock hesabı ortak `needsHpDock` ile eşlendi. Uygulanmış 0138/0139 migration adları kozmetiktir; journal kimlikleri değiştirilmedi. | Subnormal ve eşik testleri; migration journal/local DB 141/141. |

### Deploy için kritik yollar ve plan karşılaştırması

| Kritik sınır | İncelenen karşı örnekler ve sonuç | Kanıt dosyaları |
| --- | --- | --- |
| Yetki ve gizlilik | Auth yok, yabancı origin, yabancı wave/lot, başka sezon, sahte actor ve yasak hull reddedilir. Düşman hasarı, teknolojisi, kargosu, tam rotası ve rezervasyonu public/hostile quote'a verilmez. Probe raporu eve gelmeden açılmaz. | `monument-api`, `monument-send`, `monument-probe`, `monument-traffic`. |
| Çifte harcama ve idempotency | Aynı home gemisini ve son kapasiteyi isteyen iki kalkış seri çözülür. Aynı key/body tekrarında gemi, yakıt, bay, kalkan veya notice çoğalmaz; aynı key farklı body reddedilir. Recall, battle ve probe aynı korumayı taşır. | `monument-send`, `monument-api`, `monument-arrival`, `monument-movement`, `monument-probe`. |
| Fiziksel gemi ve kargo | Kısmi recall gerçek yaralı kohortu ve orantılı kendi yükünü böler. Alt-bp yara taşınır; hiçbir varış/HOLD/geri dönüş ücretsiz tamir değildir. Radiation ile ölen geminin yükü yok olur; PvP loot yalnız sağ kalan cargo room kadar alınır. | Rules `hp-landing`, `monument-battle-cargo`; server `monument-movement`, `monument-delivery-precision`, `hp-landing-storage`. |
| Kapasite | Saldırı tüm filo ile savaşır; yalnız zafer sonrası HOLD seçiminde yüksek tier ve taraf içi güç oranı uygulanır. Önceki HOLD gemileri dost varışta yerinden edilmez. Dost outbound rezervasyonu korunur. Kapasite aşanı sahibine nedeniyle döner. | Rules `monument-capacity`; server `monument-arrival`, `monument-send`, `monument-joint-war`. |
| Ele geçirme | Cargo-only saldırı boş hedefi ele geçiremez; tutulmuş hedef cargo-only savunmayla kalabilir. Kısmi savunma kontrolü korur. İki tarafın ölmesi hedefi boşaltır. Bağımsız aynı-ETA saldırıları stable sırada ayrı çözülür; açık ortak saldırı tek savaş olur. | Rules `monument-combat`; server `monument-arrival`, `monument-joint-war`. |
| Puan | Nötr garnizon/radiation PvP puanı değildir. Normal PvP taraf toplamları kişisel battle-start güç ağırlıklarına dağıtılır; savaşta ölen katılımcının payı silinmez. Sadece toplam güç 0 ise cargo + Collector yapım değeri kullanılır. Configured-admin muafiyeti read/worker/üyelik yolunda aynı kalır. | Rules `monument-combat`; server `monument-arrival`, `monument-joint-war`, `monument-membership`. |
| Üretim | Anıt toplam üretimi oyuncu sayısıyla çoğalmaz. Kendi savaş gücü/boş kargosu olmayan pay almaz. Dolu kargo payı diğer uygun oyuncuya gider; owner içi kohortlar kapasiteye göre benzer dolar. HOLD öncesi veya cutoff sonrası gelir oluşmaz. | Rules `monument-production`; server `monument-settlement`, `monument-api`, `monument-delivery-precision`. |
| Zaman ve eski worker | Gecikmiş varış/probe/respawn gerçek ETA sırasında, geçmiş kaynak pencereleriyle çözülür. Bir kohortun ölümü tüm wing'i silmez. Stale generation, tekrar event ve eski respawn yeni kontrolü değiştirmez. | `monument-events`, `monument-arrival`, `monument-probe`, `monument-traffic`, `radiation-hp-flights`, `radiation-hp-special-flights`. |
| Sezon kapanışı | ETA tam cutoff'ta savaş yok; gemi mevcut rotanın cutoff'a kadarki dozuyla doğrudan eve alınır. HOLD gelir/HP cutoff'ta durur. Gecikmiş eski dönüş gerçek iniş saatinde teslim edilir. Kapanışla event sonlandırma atomiktir; bozuk rota rollback eder. Duplicate/forced kapanış ve wipe testlidir. | `monument-season-close`, `monument-lifecycle`, `monument-joint-war`. |
| Üyelik/ownership | Ayrılma/atılma yalnız kişinin gemi/yükünü döndürür. Disband bütün üyeleri döndürür. Yeni klan solo kontrolü promote eder. Origin ele geçirilince gerçek sahiplik ve bay korunur; terminal root'un aktif child'ı cleanup ile cascade silinmez. Silent Space/reclaim/demolition aktif wave/probe varken ilerlemez. | `monument-membership`, `monument-ownership`, `monument-lifecycle`, `monument-transfer-policy`, `monument-silent-space`. |
| Normal oyun regresyonu | Ruleset 14–15 yüzde modeli korunur. Normal raid, transfer, trade, pirate ve convoy HP modelinde kendi gerçek rota/engagement/dönüşüyle çalışır; exemptions yalnız gerçek probe/drill araçlarıdır. Bildirim enum'una ekleme eski türleri silmez. | İlgili eski flight/launch/notification testleri ve son genel kapı. |

Bu karşılaştırmada açık bir monument veri kaybı, gemi/kargo çoğaltma, yetki aşımı veya kritik sezon kapanış hatası bulunmadı. Bu sonuç üretim yükünde sıfır risk garantisi veya production migration süresi ölçümü değildir.

### Test düzeltmeleri ve eski başarısızlıklar

- `clan-support-schema` gerçek regresyondu: enum sonuna eklenen monument event'leri yüzünden “son üç tür” varsayımı bozulmuştu. Test artık tarihsel clan segmentini ve gerçek PostgreSQL enum'unun tür kümesini doğrular.
- `notifications` eksik tür fixtures/listesini tamamladı. Radar testi iki farklı rung'ı gerçekten ayıran, her iki sensörün de bütün kısa rotayı görmediği geometri kullanır. Düşük sensörle yüksek eşik arasında gerçek fark ölçülür.
- Death Star testi önceki HEAD'de de kırmızıydı. Güncel D179 davranışı EMP + loyalty kaybıdır; eski colony-fault beklentisi bununla güncellendi. Oyun mekaniği değiştirilmedi.
- Ruleset 16 varsayılanı nedeniyle yeni devam sezonunun monument sayısı sıfır beklenemez. Wipe testi eski sezonun temizliğini ve yeni sezonda beş hedefi ayrı doğrular.
- Eski full-suite 52 FAIL kaydı tarihsel bir ölçümdür. Final kapısının sonucu yerine geçmez; simülasyon skip'leri sahibin talimatından gelir.

### Gerçek browser ve manuel kanıt

Komut: `node tools/visual.mjs out/monument-review-final --monument-ui`. Yerel 5173 + 3100, gerçek `monument_local` oturumu ve ruleset 16 katalog kullanıldı. Dört akış tamamlandı: 1280×900 EN, 350×812 EN, 350×812 TR, 350×812 TR boş hedef. Sonuncu yalnız browser response fixture'ıdır; DB kontrolü veya filo değiştirilmedi. Görsel harness'te software-GPU screenshot için animasyon donduruldu; bu kontrol canlı FPS ölçümü değildir.

Sekiz ekran görüntüsü elle incelendi. Finder beş gerçek adı okunabilir gösteriyor. Uzun EN birinci ve TR beşinci isim sheet başlığında kesilmiyor. Sayfa/panel yatay taşmıyor; probe ve send footer'a erişiliyor. HP/dk ile üretim birimleri ayrılıyor. Boş hedefte “Sahipsiz”, geçen boş süre ve garnizon dönüş geri sayımı beraber görünüyor. Ölçümler `out/monument-review-final/measurements.json` içindedir. Radyasyon opacity'si sahibi tarafından kabul edilmiştir; yeniden tasarlanmadı veya kalibre edilmedi.

Local smoke: `/health` 200, DB 141/141 migration, `MONUMENT-LOCAL` live/ruleset 16, 5 monument/5 HP cloud. Model optimizasyonu ve 3× ticaret gemisi ölçümü önceki `out/monument-models-3x`/`out/monument-models-rebaked` kanıtlarıyla korunur.

### Genel doğrulama

Kod, plan ve manuel inceleme tamamlandıktan sonra `pnpm verify --exclude-sims` çalıştırılacaktır. Sonuç, başarısızlıkların etkisi ve teslim kararı bu bölüme eklenir. Production deployment bu inceleme sırasında yapılmadı.

İlk son-kapı koşusunda workspace typecheck/lint ve **rules 107 dosya / 1.976 test** geçti. Aynı makinede ikinci bir `verify` aynı sunucu test DB'sine geçeceği için bu incelemenin sunucu süreci kontrollü durduruldu; bu koşu komple PASS diye kaydedilmez. Bütün sunucu testleri ayrı `astera_monument_handoff_2050_test` veritabanında, snowball hariç tekrar başlatıldı. Local oyun DB'si değiştirilmedi.

Web koşusu iki ek eksiği gösterdi: development model galerisindeki hardcoded renkler v2 token sözleşmesini kırıyordu; onboarding skip testi yeni browser timezone ülke varsayılanını sabit ABD sanıyordu. İlki tema token'larına bağlandı, ikincisi oyuncunun açık ülke seçimini doğrulayacak şekilde sabitlendi. İlgili **28/28 test** ve iki dosyanın lint'i geçti. Galeri değişikliği gerçek 350 px browser'da yeniden görüldü: tema renkleri boş değil, 4.998 üçgen, model/referans oranı 3,00, browser error yok (`mobile-gallery-tokens.png`). Production web build son değişiklikle tekrar geçti. Bu ek değişiklikler sahibin ilk push'undan sonradır; final toplu sonuç ayrıca kaydedilir.

Web'in son tam tekrarı: **368 dosya PASS / 1 dosya SKIP; 5.035 test PASS / 29 SKIP**. Log: `/tmp/astera-monument-final-web.log`. Model reprojection araç testi ayrıca **8/8 PASS** (`/tmp/astera-monument-final-textures.log`). Sunucunun izole tam koşusu henüz tamamlanmadığından tüm kapı yeşil diye raporlanmaz.
