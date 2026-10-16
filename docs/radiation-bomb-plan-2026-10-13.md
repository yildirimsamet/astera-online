# Radyasyon Bombası — ortak plan, 13 Ekim 2026


15 Ekim güncellemesi: her isabet 30 dk. Aktif Aegis seviyesi toplam 50 HP/dk sınırından sonra çıkarılır, ardından gemi araştırması uygulanır. Sıfır HP Aegis 15 dk bekledikten sonra dolmaya başlar; en az 1 HP’de koruması geri gelir. Duman/ham radyasyon korumada da kalır. Tamirhane yalnız Aegis sonrası hasar pozitifse kapanır. Ayrıntı: `radiation-aegis-plan-2026-10-15.md`.
Durum (15 Ekim, yerel kapanış): Radyasyon Bombası ve gezegen/anıt radyasyon entegrasyonu uygulandı; son owner onayıyla Ortak Savaş toplanma havuzu da kapsama alındı. Üretim/slot, fırlatma/anti-battery, hedef koruması, bağımsız 30 dakikalık kaynaklar ve 50 HP/dk sınırı, home/dock/savunma desteği/STAGED/NPC hasarı, onarım iptal/tam iade, küçük Honor entegrasyonu ve kaynak başına göstergeler tamamlandı. Onaylanan füze/egzoz/yüzey çarpması/sis ve sarı-turuncu-kırmızı bar/kadran altı dilde telefon/masaüstünde doğrulandı. CR bulguları düzeltildi; normal sunucu dosyalarının tamamı ardışık partiler ve ilgili tekrarlarla geçti, web/kural/lint/tip ve aktif sezon sentetik geçiş kanıtları review notunda. Yeni STAGED kapsamı 11 gerçek entegrasyon senaryosu ve API/UI sözleşmeleriyle doğrulandı. Çalışma master'da yereldir; push/deploy/canlı DB aktivasyonu yapılmadı. Ayrıntı: `radiation-bomb-review-2026-10-15.md`.
Çalışma yeri `master`; yeni branch/worktree açılmayacak. Mevcut çalışma ağacındaki değişiklikler korunacak.

Tamamlanan ön iş: [gemi hasarı, manuel bakım ve parçalama](ship-maintenance-plan-2026-10-13.md); doğrulama ve kapsam sınırı [ek CR raporunda](ship-maintenance-review-2026-10-14.md). Bomba mekanik kararları aşağıda; uygulama sonrası kalan işler ilk paragraftadır.
Bu belgeye göre ücretsiz tamir ve otomatik dock aktarımı bütün durumlarda kalkar; radyasyona özel istisna değildir.
Canı %5 veya altındaki gemiler savaş dışıdır, transfer/tahliye edilebilir; hangardakiler baskında vurulmaz fakat radyasyon maruziyeti farklıdır.
Parçalama anında ve radyasyonda kapalıdır. Aşağıdaki ilk incelemeler eski kod davranışını açıklar; yeni bakım kararlarının otoritesi bağlantılı ön iş planıdır.

## Kesinleşen gereksinimler

- Radyasyon Bombası L1, L2, L3 üç ayrı üretilen, stoklanan ve fırlatılan ürün.
- Stok kararı: gezegen başına her seviyeden 1 adet; toplam 3. Seviyeler paralel üretilebilir. Üretimde/duraklatılmış/hazır/uçuşta olan bomba kendi seviyesinin aynı yuvasını tutar; uçuş terminal olduğunda yuva boşalır. Stratejik Stok araştırması bu sınırı otomatik artırmayacak.
- Hedef türleri: gezegen ve anıt. Gezegenlere gelen bombalar mevcut anti-battery ile durdurulabilir.
- Anıtlar bu füze karşısında savunmasız; gezegendeki battery anıtı korumaz.
- Her başarılı isabet kendi 30 dakikalık radyasyon kaynağını ekler.
- Kaynaklar birlikte hasar verir; yeni isabet eski kaynağın bitişini yenilemez.
- L1 = 9 HP/dk; L2 = 12,5 HP/dk; L3 = 18 HP/dk.
- Bir hedefte toplam radyasyon hasarı en fazla 50 HP/dk.
- Gezegenin hangarında duran gemiler hasar alır. Evdeki filoyu bağışık tutmak bu bombanın amacıyla çelişir.
- Owner'ın güncel onarım kararı: Aegis sonrası radyasyon hasarı pozitifse tamirhane çalışmaz; gemiler tamirhaneye aktarılamaz. Hasarlı geri dönen gemiler de bu yasağa dahildir; mevcut yaraları korunur.
- SON KARAR: Aegis sonrası radyasyon hasarı pozitif olduğunda çalışan ve sırada bekleyen bütün ücretli REPAIR işleri otomatik iptal edilir; ödenmiş onarım kaynakları tam iade edilir, iş ilerlemesi silinir. Gemiler mevcut yaralarıyla tamirhanede bekler ve radyasyon hasarı alır; oyuncu onları hangara çıkarıp tahliye edebilir.
- Radyasyon bitince eski iş devam etmez. Oyuncu güncel can üzerinden yeni fiyat/süreyle yeniden onarım başlatır. Önceki pause/resume ve eski faturayla ek yarayı onarma kararları kaldırıldı.
- Gezegen/anıt modellerinin üzerinde kaliteli radyasyon göstergesi olacak.
- Füze gövdesi, çarpma ve kalıcı efekt görsel olarak owner'a gösterilip seçilecek.

## Karar durumu — 15 Ekim

Son owner onayı: ortak klan saldırısı için toplanma havuzunda STAGED bekleyen gemiler de toplandıkları gezegende radyasyon hasarı alır. Köken gezegeni aynı dozu ikinci kez yazmaz. Havuz adedi, kapasite rezervi, yaralar, manuel geri çağırma ve %5 savaş sınırı birlikte güncellenir; tam kayıpta rezerv sıfırlanır. Eski escrow bağışıklığı korunmaz.

Üretim fiyatları/süreleri/açılma, her seviyeye tek stok ve paralel üretim, uçuşta stok işgali, NPC ve klan desteği dahil hasar, Prospector/kara savunması istisnaları onaylıdır. Toplam bütün radyasyon 50 HP/dk ile sınırlıdır; önce aktif Aegis seviyesi çıkarılır, ardından geminin kendi araştırma koruması uygulanır. Aegis fırlatmayı engellemez; aktif her seviye 1 HP/dk radyasyon koruması sağlar.

Kendi/dost/korumalı hedefe fırlatma yasaktır; fırlatıldıktan sonra hedef el değiştirse bile füze vurur, geri çağırma yoktur. VARIŞ ONAYI: Gezegen varış anında süreli saldırı korumasına sahipse füze tüketilir fakat radyasyon eklenmez. Koruma Aegis enerjisi değildir. Başarılı isabette tek bildirim; radyasyon ölümlerine ayrı savaş raporu ve enkaz yok. 15 Ekim son owner kararı: yeni Honor kuralları bombaya da uygulanır; puana etkisi küçük olmalıdır. Önceki “puan yok” kararı kalktı. Mevcut v4 adaptörü gerçek yeni radyasyon hasarını paylaştırır, pozitif toplam katkıyı bomba başına 2.500.000 mikro-Honor (2,5 Honor) ile sınırlar; repeat/retry ikinci ödeme yapmamalıdır. Zayıfa baskı ve gerçek önleme mevcut Honor kurallarına tabidir; ayrı Dominion/kill ödülü eklenmez.

Görsel yönler owner tarafından onaylandı: M1 kalın başlık; E3 yeşil enerji çarpması + A1 ince sis; haritada bar, seçili hedefte kadran. Nihai malzeme ve hareketli efekt önizlendi; owner onayladı. L1 rengi son talebe göre zeytin yeşili. Aktif sezona yayın niyeti var; bu bir deploy/migration emri değildir.

Paylaşılan kodda stratejik fırlatma/önleme ve radyasyon Honor adaptörleri var. Owner yeni Honor kurallarını bomba için de onayladı. Bomba stoğu, uçuşu, imhası ve radyasyon kaybının mevcut envanter/değer muhasebesiyle uyumu korunmalı; hasar aralıkları, aynı bombanın toplam pozitif sınırı ve tekrar işlem idempotency'si ayrıca doğrulanmalı.

Bakımın bu planı etkileyen kuralları kapandı: otomatik dock/ücretsiz tamir yok; %5 ve altı ateş vermez; dock baskından korunur fakat doz alır; anıttaki pasif gemi üretir ve hedef olur. Aegis sonrası pozitif radyasyon dozu REPAIR işlerini otomatik iptal/tam iade eder, onarım yeniden fiyatlanır. Bunlar açık karar gibi yeniden sorulmaz.

Uygulama sınırları (ilk iki madde 15 Ekim onaylıdır; diğerleri mevcut plan varsayımlarıdır):

- 50 HP/dk sınırına anıtın doğal radyasyonu da dahildir; Radyasyon Koruması sınır uygulandıktan sonra hasarı azaltır.
- Sınıra ulaşılsa da yeni isabet kendi zaman penceresiyle kaydedilir. Önceki kaynaklar bittiğinde kalan bombaların hasarı devam eder.
- Etki gövdeye/hedef kimliğine bağlı kalır; anıt hareketi veya kontrol değişimi radyasyonu silmez.
- Yalnız radyasyon etkisi: Ölüm Yıldızının EMP, sadakat kaybı ve yüzey çatlakları bombaya otomatik eklenmez.
- Owner'ın seçtiği tamirhane kapanması dışında üretim ve binalara ayrı debuff eklenmez. Anıtta gemi kayıplarının mevcut üretim/yük sonuçları devam eder.
- Gezegende/anıtta bulunmayan, uçuşta olan gemiler hedefin bombası yüzünden hasar almaz.
- Gezegene saldırıda mevcut oyuncu korumaları, tier bandı, klan/ateşkes kuralları ve saldırganın kalkan kaybı uygulanır.
- Anıta saldırıda mevcut anıt hedef uygunluğu/klan kuralları değerlendirilir; gezegenin tier kuralları anıta körlemesine kopyalanmaz.
- ONAY: Kendi/dost/korumalı hedefe fırlatma kapalıdır; füze fırlatıldıktan sonra hedef el değiştirse bile vurur. Sonradan dost/kendi kontrolüne geçiş nedeniyle uçuş iptal edilmez. Geri çağırma yoktur. Varış anında saldırı koruması varsa isabet etkisizdir.
- Füze tek kullanımlıktır, tek fırlatma bir uçuş yuvası tüketir; uçuş sonlanınca yuva açılır.

## Koddan doğrulanan mevcut yapı (değişmiş olabilir)

| Alan | Mevcut davranış / kaynak | Yeni işin gereği |
| --- | --- | --- |
| Stratejik üretim | `apps/server/src/services/strategic.ts`: kaynak harcama, dünya kilidi, per-type stok, BUILDING/PAUSED/READY/LAUNCHED yaşam döngüsü | Üç yeni ürün tipi; maliyet/süre/type-aware tamamlama, durdurma, devam etme ve başarısız iş iadesi |
| Stratejik veri | `apps/server/src/db/schema.ts`: `strategic_assets` yalnız DEATH_STAR/INTERCEPTOR kabul ediyor | Tipler ve ilişki kısıtları genişletilir; eski satırlar korunur |
| Ölüm Yıldızı | `packages/rules/src/constants.ts`: Core 13 / Tersane 5, 50.000/35.000/3.000 kaynak, hız 1000 | Üretim/effect kuralları ayrı bombaya körlemesine kopyalanmaz |
| Güncel üretim temposu | `packages/rules/src/tempo.ts`: buildTime 1,21875 | Ölüm Yıldızının güncel gerçek yapımı ~73,125 dk; nominal 60 dk ile karıştırılmaz |
| Anti-battery | `strategicInterception.ts`: hedef gezegenin hazır mühimmatı; Radar 3+ veya savunanın teleskopla tanımlaması | Gezegen bombalarını da aynı yarış/tek mühimmat tüketimiyle durdurur; anıtları durdurmaz |
| Görev hedefi | `missions.targetPlanetId` NOT NULL gezegen FK; mining/pirate gibi özel uçuşlar ayrı tablolar | Anıtı sahte gezegen yapmak veya bütün mission hedeflerini nullable yapmak yerine sınırlı ayrı bomba uçuş kaydı |
| Radyasyon | `radiation.ts`, `radiationHp.ts`: kaynak pencereleri, toplama, HP hasarı, kesirli hasar, shelter | L3 ve 50 sınırı ortak kurallara; doz ve ölüm tahmini aynı zaman profili üzerinden |
| Hedef radyasyonu | `radiationSources.ts`: entity kaynakları PLANET/MONUMENT kimliğine bağlı; uçuş yolları target etiketi taşımaz | Bomba kaynağı aynı hedef kimliğiyle; geçtiği yere fiziksel hasar saçmaz |
| Anıt filo hasarı | `monument.ts`, `monumentView.ts`: HOLD lotları zaman aralığıyla hesaplanır, ölüm sınırı yeniden planlanır | İsabet anına kadar önce eski kaynaklarla hesapla; sonra yeni kaynağı ekle ve ölüm/üretim sınırlarını güncelle |
| Anıt hareketi | `monumentMotion.ts`, `monumentMovement.ts`: hedef hareketli | Mevcut hareketli hedef uçuş geometrisi ve varış zamanı; aura/gösterge anıtı takip eder |
| Hangar hasarı | Bakım ön işi tamamlandı: `units.home` yaraları kesirleriyle saklar, çıkış/dönüş ve savaş gerçek canı taşır | Yeni iş doz zamanını hesaplamak; giriş/üretimden önce eski zaman aralığını kapatıp yeni gemiye geçmiş doz yazmamak |
| Onarım | Otomatik dock ve ücretsiz yama kaldırıldı; manuel aktarım, ücretli onarım, parçalama ve radyasyon erişim kontrolü var | Radyasyon başlangıcında aktif/sıradaki REPAIR işlerini atomik iptal/tam iade ve dock dozu henüz eklenecek |
| İstisnalar | Prospector bağışık; HP radyasyon helper'ı kara savunması için kullanılamıyor; NPC anıt garnizonu doğal radyasyondan etkilenmiyor | Bomba NPC garnizonuna zarar verir; doğal kaynak bağışıklığı korunur |
| Görsel | `RadiationHaze.tsx`, `PlanetField.tsx`, `Monuments.tsx`, stratejik uçuş/çarpma bileşenleri | Radyasyona özel füze, isabet ve kalıcı etki; 0–50 gösterge, mevcut fog/occlusion davranışı |

## Hasar ve zaman tasarımı

Önerilen sıralama: aktif kaynakların toplamı → 50 HP/dk sınırı → ilgili geminin Radyasyon Koruması → süre boyunca HP hasarı.
HP/dk her etkilenen geminin aldığı hızdır; filodaki gemi sayısına bölünmez.

Örnek: 12:00 L1, 12:20 L2 isabeti, doğal radyasyon yok:

| Zaman | Ham radyasyon |
| --- | --- |
| 12:00–12:20 | 9 HP/dk |
| 12:20–13:00 | 21,5 HP/dk |
| 13:00–13:20 | 12,5 HP/dk |
| 13:20 sonrası | 0 |

50 sınırı etkinin başında bir kere uygulanamaz: kaynakların her başlangıç/bitiş sınırında oran yeniden hesaplanır.
Örneğin doğal L2 + üç L3 = 66,5 yerine 50; bir L3 bitince 48,5 olur.
Shelter ve koruma için mevcut kurallar korunacaksa bütün tahmin/settlement/harita aynı profili okumalı.

İsabet sunucunun gerçek varış zamanında başlar. Worker'ın geç çalışması 30 dakikayı uzatmaz veya gemileri gecikme boyunca bağışık bırakmaz.
Tam bitiş anında kaynak etkisizdir: `start <= now < end`. Sezon sonrasına hasar yürütülmez.

Hangarda kalma süresi hesaplanacak; gemi gelişi/üretimi eski dozu miras almaz. Fırlatılan gemi ayrılışına kadar aldığı gerçek yarayı taşır.
Filo çıkarma, üretim tamamlama, transfer/geri dönüş, savaş, onarım, teknoloji tamamlanması ve dünya sahipliği değişiminden önce ilgili zaman aralığı kapatılır.
İlk isabet öncesi süreye hasar yazılmaz. Teknoloji değişimi geçmiş hasarı yeni korumayla yeniden hesaplamaz.
Okuma/poll/yeniden bağlanma ücretsiz iyileşme sağlayamaz; küçük hasarlar ve kesirleri saklanır.
Radyasyonun başlangıç anında REPAIR işleri otomatik iptal/tam iade edilir; sonrasında dock gemileri doz alır. Önceden bitmiş işler, yeni isabet, kaynak bitişi ve ölüm aynı timeline'da çözülür; eski cancelled completion gemiyi iyileştiremez veya geri üretemez.

## Önerilen veri ve servis sınırları

- Üç ayrı stratejik tip: `RADIATION_BOMB_L1`, `RADIATION_BOMB_L2`, `RADIATION_BOMB_L3`.
- Ayrı sınırlı bomba uçuş tablosu: owner/origin/season, targetKind + yalnız doğru target FK, asset, level, uçuş ve çözülme zamanları, durum, hareketli hedefin varış geometrisi.
- Varış için tek seferlik durum claim'i; kaynakla uçuş arasında unique bağ. Aynı event veya HTTP retry ikinci bomba/kaynak yaratamaz.
- Mevcut `hp_radiation_sources` kullanılır; kaynak tipi/seviye/başlangıç/bitiş ve isabet kökeni açıkça saklanır. L3 için DB check ve Zod sınırları birlikte güncellenir.
- Stratejik asset ile özel uçuş bağlantısı FK/check ile ifade edilir; mevcut `missionId` gezegen görev FK'si anıt için yanlış kullanılmaz.
- Home filo için hasar cohort'ları ve hesaplanmış zaman cursor'ı; `units` gemi adedinin tek otoritesi kalır. Kesin şema, home/dock kapsam kararından sonra testlerle netleştirilir.
- Ortak uçuş yuvası sayacı, private pending görünümü ve public traffic yeni uçuşu kapsar.
- Mevcut anti-battery geometri/claim mantığı dar bir hedef/uçuş adaptörüyle paylaşılır. Ölüm Yıldızı ve bütün missions sistemine kapsam dışı refactor yapılmaz.
- Her saniye bütün gezegenleri tarayan tick yok: lazy settlement + gerçek ölüm/başlangıç/bitiş sınırları için idempotent scheduled event.
- Bomba kaynak değişikliği yalnız etkilenen hedefin hesaplarını ve sınırlarını yeniler. Operator'ın bütün sezon anıtlarını kilitleyen yolunu her isabet için doğrudan kullanmak uygun değil.
- Kilit sırası mevcut sezon → sıralı ilgili gezegenler → anıt/destek/klan/oyuncu protokollerine uyarlanır; owner gemileri ve değişen target/klan kimliği yeniden doğrulanır.
- Sezon kapatma, kaynak geçmişi, taşıma/yer değiştirme, queue repair/health ve terminal temizlik yeni tablo/kayıt türlerini kapsar.
- Public gösterge ham radyasyonu verir. Saldırgan kimliği, gizli filo miktarı veya hasarı public kaynak/gösterge verisinden sızmaz.

## Üretim — 15 Ekim owner onayı

Üç ürün için Core 13 + Tersane 5, hız 1000. Kaynak sırası: alaşım / kristal / döteryum.

| Ürün | Kaynak | Nominal iş | Güncel tempo ile gerçek süre |
| --- | --- | --- | --- |
| L1 | 30.000 / 20.000 / 2.000 | 30 dk | ~36,6 dk |
| L2 | 40.000 / 28.000 / 2.500 | 45 dk | ~54,8 dk |
| L3 | 50.000 / 35.000 / 3.000 | 60 dk | ~73,1 dk |

Stok: her seviyeden 1, toplam 3 radyasyon bombası. Önceki araştırmayla 2'ye çıkarma teklifi geçerli değil.
Ölüm Yıldızı ve battery stoklarından ayrıdır. Seviyeler bağımsız/paralel üretilir.
BUILDING/PAUSED/READY ve uçuşta LAUNCHED aynı seviyenin tek yuvasını tutar. Fırlatma tek başına yuvayı boşaltmaz; isabet/önleme/diğer terminal çözümden sonra yeni üretim yapılabilir.
Bu rakamlar test edilmiş denge sonucu olarak sunulmaz. Uzun ekonomi/sezon simülasyonu bu planın kapsamında çalıştırılmayacak.

## Görsel seçimi

Kaynak arşivi: `/home/yildirim/Desktop/Coding/MyProjects/blindspace-komutan-gemisi/astera-refs`.
Kaynaklar değiştirilmedi. Gerçek OBJ geometrileri aynı nötr malzeme/ışıkla karşılaştırmalı render edildi; nihai premium malzeme değildir.

Owner son seçimi: M1; E3 + A1; haritada G1 bar, seçili hedefte G2 kadran. Nihai hareketli önizleme hazırlandı ve owner tarafından beğenildi; son renk/gösterge talepleri uygulandı.

- Gövde panosu: M1–M11, Space Commander `Missile_*_high*.obj`. Owner M1 (`0002`) kalın başlığı seçti.
- E1: `dist/v2/fx/explosionAtlas.webp`.
- E2: `dist/v2/fx/explosionAtlas2.webp`.
- E3: `dist/v2/webp/vfx_atlas/weapons/plasma_beam_hit_green.webp`.
- A1: `dist/v2/ktx/vfx/fog/large_smoke.png`.
- Onaylanan efekt bileşimi: E3 enerji çarpması + A1 ince, hedefe bağlı radyasyon sisi. Hareketli önizleme gösterildi; owner geri bildirimiyle havai fişek çizgileri yerine yeşil basınç/plazma bulutu kullanıldı.
- Füzenin üç seviyesi üretim UI'sında açıkça ayrılır. Ortak gövde seçilirse seviyeler yalnız renk değil fiziksel başlık/detay ve L1/L2/L3 etiketiyle ayrılır.
- Referans arşivinin mevcut yerel kullanım sınırı korunur; final asset üretim/optimizasyonu ayrıca bu projenin art akışına uyar.

Gösterge taslakları mevcut Astera gezegen ve anıt GLB'leri üzerinde gösterildi:

- G1: parçalı bar; haritada küçük gösterge, seçili hedefte büyük sayı ve detay.
- G2: otomobil tipi ibreli kadran; 0–50 aralığı.
- Üçüncü seçenek: haritada G1, seçili hedefte G2.
- Kaynak seviyesi ile toplam hasar ayrı kavramlar: iki L2 tek L3 diye adlandırılmaz. Toplam HP/dk esas alınır.
- Seçili detayda doğal + bomba kaynakları, ayrı kalan süreler ve komutanın korumasına göre etki gösterilir.
- Sayaç bir sonraki kaynak bitişini değil gerçek toplam hasar düşüşünü anlatır; sınır üstü stack'te ilk bitiş oranı değiştirmeyebilir.
- Sürekli doğal radyasyon varsa son bomba bittiğinde gösterge kaybolmaz; doğal değere döner.
- Görüş/örtülme, mevcut isim etiketi, dokunma hedefleri ve 350px telefon ekranında kalabalık kontrol edilir.
- Renk tek başına bilgi değildir. Geminin zırhı/koruması bilinmeden evrensel “ölümcül” etiketi kullanılmaz.
- Premium final efektin harita uzaktan/yakından, ülke skinleri ve hareketli anıtta önizlemesi owner'a gösterilir; bunlar yalnız yön seçme taslaklarıdır.

Yerel inceleme artefaktları: `/tmp/astera-radiation-planning/candidates.png`, `gauge-options.png` ve aynı klasördeki HTML galerileri.
Playwright ile 11 gerçek mesh ve iki mevcut GLB'nin hatasız yüklendiği doğrulandı. Oyun davranışı için test koşturulmadı; henüz uygulama yok.

## Uygulama sırası ve TDD

1. Açık owner kararlarını kapat; yeni cevaplarla bu belgeyi güncelle.
2. Rules testlerini önce FAIL: L1/L2/L3, kaynak pencereleri, 50 sınırı, koruma, çoklu expiry, fraksiyonlar, ölüm tahmini/hasar tutarlılığı.
3. DB/API yaşam döngüsü testlerini önce FAIL; şema/migrasyon ve üç ayrı üretim tipi.
4. Üretim/fırlatma/varış; gezegen anti-battery; hareketli anıt hedefi ve idempotent isabet.
5. Home/dock/support hasarı; mevcut anıt HOLD hasarıyla uyum, offline ve olay sırası.
6. Üretim/saldırı/rapor/istihbarat UI'sı, gösterge ve owner'ın seçtiği asset/efektlerin oyun içi önizlemesi.
7. İlgili rules/server/web testleri, ardından olağan `pnpm verify`; bir workspace ve bir worker, `nice -n 10`, Node heap en çok 4 GiB.
8. `tools/visual.mjs` ile telefon/masaüstü, render bütçesi ve görsel doğrulama; son review ve düzeltmeler.

## Zorunlu regresyon ve uç durumlar

- Üç ürünün kaynak harcaması, stok sayımı, hazır doğru seviyenin seçimi, aynı anda iki build/launch'ın tek asset veya son kaynağı çift harcayamaması.
- Queue completion/retry/paused/resume/failure refund doğru seviye maliyetini kullanır; sezon öncesinde bitmeyen işler reddedilir.
- Aynı varışın tekrar teslimi, aynı anda farklı bombalar, 200ms/300ms/1s aralıklı ve eşzamanlı varış; yalnız başarılı isabet kaynak ekler.
- Tek anti-battery charge yarışan iki stratejik silahtan yalnız birini durdurur; karışık Ölüm Yıldızı/radyasyon bombası dalgası.
- Radar/Telescope görünürlüğü, geç worker'ın borçlu önleme atışı, mühimmatın isabetten önce/sonra hazır oluşu.
- Gezegen/anıt yanlış tür FK, farklı sezon, sahiplik değişimi, kendi/klan/ateşkes ve koruma reddi kaynak/asset harcamaz.
- Hareketli anıt varışı/radyasyon kimliği; kontrol/boşalma/respawn durumları radyasyon geçmişini yanlış silmez.
- 50'nin altı/tam 50/üstü; doğal radyasyon dahil örnekler; iki kaynağın aynı anda bitişi; biten kaynak kadar düşüş; üst sınırdayken oran değiştirmeyen expiry.
- Offline doz; açıp kapatma/poll/pencere sayısının sonucu değiştirmemesi; olayın gerçek zamanına göre süre.
- Filo ayrılışı/geri gelişi/üretimi, destek katılımı/ayrılışı, onarım başlangıcı/iptali/bitişi ve radyasyon ölümü sınırları.
- Düşük hasarın ücretsiz yama ile sürekli silinmemesi; yeni geminin geçmiş hasarı miras almaması; yaralı geminin ayrılırken iyileşmemesi.
- Araştırma tamamlanması, farklı komutanların koruması/zırhı; HP hasarının gemi sayısına bölünmemesi.
- Tamirhane kapanması dışında binalar/üretim/EMP/sadakat için kapsam dışında etki yazılmaması; doğal anıt üretiminin gemi ölümüyle mevcut sonuçlarının korunması.
- Sezon kapanışı/taşıma/silme/stranded job onarımı; Wealth/units/raporlar ve kaynak geçmişi tutarlılığı.
- Public rate verisi, private filo bilgisi, visibility katmanları, SSE/poll/refetch ve istemci expiry aynı sonucu verir.
- Radyasyonsuz/no-op eski gezegenler, mevcut Ölüm Yıldızı ve anti-battery davranışı bozulmaz.

## İkinci kod incelemesi: home filosu için somut entegrasyon

`loadPlanetState` şu anda evdeki mobil gemileri ve kara savunmalarını aynı `units(location='home')` sorgusundan okuyup ayırıyor.
`setUnits` yalnız verilen hull sayısını overwrite ediyor; hasar veya zaman taşımıyor. `addUnits` mevcut filoya adet ekliyor.
Bu alt seviye adet yazıcılarına gizli radyasyon hesabı koymak uygun değil: farklı caller'lar önce ayrılan/eklenen gemi anını açıkça belirtmeli.

Hasarı saklamak tek başına yeterli değildir. Mevcut savaş çözümü savunanın `homeFleet` adedini `line` olarak veriyor;
saldırganın hasarı ise stack üzerinde taşınıyor. Yeni home yaraları savunan combat girdisine de verilmezse gemi görünürde yaralı,
savaşta tam canlı olur. Aynı açık launch yollarında da var: ordinary attack başlangıç hasarını taşımadan sadece adet çıkarıyor.

| Entegrasyon noktası | Zorunlu değişiklik |
| --- | --- |
| `planet.ts` / `planetView.ts` | Projection ve mutation aynı home hasar profilini kullanır; fleet adedi, gerçek hasar ve kalan HP uyumludur |
| `mission.ts` | Ayrılmadan önce doz kapatılır; seçilen gemilerin cohort yaraları mission damage'a taşınır; kalan yaralar home'da kalır |
| `handlers.ts` savaş çözümü | Savunan home yaraları savaşın başlangıç girdisidir; çatışma sonucu radyasyon yarasını yok sayamaz |
| `shipDamage.ts` iniş/onarım | Mevcut home cohort korunur; yeni gelen yalnız geldiği andan sonrası için doz alır; free patch kuralları sürekli maruziyeti silemez |
| `buildQueue.ts` gemi üretim bitişi | Üretilen gemi `readyAt` anından itibaren maruz kalır; worker'ın çalıştığı an başlangıç sayılmaz |
| `research.ts` araştırma bitişi | Etkilenen owned dünyalarda koruma/zırh değişiminden önce eski teknolojiyle doz kapatılır; yeni oran geçmişe uygulanmaz |
| `clanSupport.ts`, `clanWar.ts` ve anıt gönderimleri | Home'dan çıkan gemilerin yaraları kendi wave/stack'lerine taşınır; destek hasarı kapsam kararıyla aynı zaman hesabını kullanır |
| Mining/trade/pirate/convoy/settlement uçuşları | Etkilenebilen home gemisini alan her yol aynı yarayı taşır; bir görev türü bedelsiz iyileşme yolu olamaz |
| `ownership.ts` ve dünya kontrol devirleri | Eski sahibin dönemi gerçek devir anında kapanır; yeni sahip ve teknoloji geçmiş dozu değiştirmez |
| `flight.ts`, `radar.ts`, `session.ts`, `traffic.ts` | Yeni bomba uçuşu bay/pending/hostility/visibility sayımlarına açıkça katılır |
| worker handlers/abandon/health/season cleanup | Yeni uçuş/event/source bağları başarısız iş, geç varış, freeze ve temizlikte kapsanır |

Home hasarı için küçük, yeniden kullanılabilir üç işlem gerekir: belirli ana kadar hesapla; seçilen filonun yaralarını ayır;
yeni gelen filoyu o andan başlayarak ekle. Bunlar timestamp ve teknoloji girdisini açıkça alır. Global bir event replay motoru kurulmaz.
Aegis sonrası hasar pozitifken home/dock sınırı: tamirhaneye yeni aktarım yok. Kesin tablo/JSON tercihi home hasarını kayıpsız taşımak üzere verilir; metadata lotları `units` adedini ikinci otoriteye dönüştürmez.
Aynı hull/aynı hasarlı cohort birleştirilebilir; farklı yaraları ortalamak, yeni gemiyi yaralamak veya eskisini iyileştirmek yasaktır.
Yalnız gemi adedi seçilen UI'da hasar cohort seçimi deterministik olur; öneri en sağlam gemiler önce ve kalan HP bilgisinin gösterilmesidir.

## Olay sırası ve hasar hesabı için kabul örnekleri

Bu örneklerde araştırma yok; yalnız gemi başına alınan doz hesaplanıyor. HP'si dozdan önce tükenen gemi tam ölüm anında çıkarılır.

| Senaryo | Beklenen sonuç |
| --- | --- |
| 12:00 L1; filo 12:10 ayrılıyor | Ayrılan her etkilenebilir gemi 90 HP yara taşır; 12:10 sonrası o gezegenin radyasyonundan etkilenmez |
| 12:00 L1; yeni gemi 12:10 üretiliyor; 12:20 okuma | Eski gemi 180 HP, yeni gemi 90 HP doz alır |
| 12:00 L1; 12:20 L2; filo 12:40 ayrılıyor | 20×9 + 20×21,5 = 610 HP/gemi; önce ölen gemi ayrılan filoda bulunmaz |
| Aynı L1 için 60 kez dakikalık okuma veya 1 kez saat sonunda okuma | Aynı 540 HP/gemi; pencere/poll sayısı hasarı değiştirmez |
| HARD doğal 12,5 + üç L3 | 50 HP/dk; bir L3 bitince 48,5 HP/dk (doğal radyasyon dahil önerisi onaylanırsa) |
| 12:00–13:00 kaynak; worker 13:10'da uyanıyor | Kaynak penceresi yine 12:00–13:00; hiç 13:10–14:10 olmaz |
| Uçuşta iki ayrı bomba aynı milisaniyede çarpıyor | İkisi de kaydedilir; o andaki filo yeni toplamdan sonraki süre için hasar alır |
| Aynı arrival üç kez işleniyor | Tek kaynak ve tek sonuç bildirimi; ikinci hasar/asset tüketimi yok |
| Sınır üstü kaynak toplamı 72; bir 18'lik kaynak bitiyor | Ham toplam 54, gerçek oran hâlâ 50; göstergede hasar düştü denmez |

Geç gelen bir handler, daha erken çözülmemiş isabet/gemi gelişi/araştırma sınırının üzerinden cursor ilerletemez.
İlgili önceki olay mevcut reconciler/queue protokolünde çözülür veya işlem retry olur; geriye dönük hasar kaynağı ekleyip hesaplanmış aralığı kaybetmek yasaktır.
Queue sırası tek başına yeterli güvence değildir: HTTP mutation worker'ı geçebilir, claimed event ve farklı due zamanları yarışabilir.
Saat başına 300 gezegeni saniyelik taramak yerine aktif radyasyonlu hedeflerin sınırları planlanır; oran değişimi ilk ölüm zamanını yeniden hesaplatır.

## Oyuncunun izleyeceği akış

1. Stratejik üretim yüzeyinde üç ayrı ürün: L1/L2/L3, hasar, 30 dk etki, maliyet, gerçek üretim süresi, stok sınırı ve kilit sebebi.
2. Hedefin gezegen/anıt panelinden Radyasyon Bombası eylemi; eldeki seviyeler ve hazır adetler birlikte karşılaştırılır.
3. Fırlatma öncesinde seçilen seviye, varış, hedefin mevcut toplamı, isabet halinde eklenecek kaynak, 50 sınırı ve varsa kalkan kaybı aynı akışta görünür.
4. Mevcut hedef oranı bir gelecek garantisi değildir: yol sırasında eski kaynak bitebilir, başka bomba gelebilir. İstemci zaman penceresiyle tahmin eder.
5. Savunanın sensörü hakkı varsa gelen stratejik tehdit/ETA görünür. Anti-battery durdurursa hedefte radyasyon başlamaz.
6. Başarılı çarpma gerçek sunucu zamanında oynar. Hedefe bağlı kalıcı radyasyon görseli ve gösterge görünür.
7. Hedef sahibi kendi filo HP'si, hasar alma hızı, kaynak bitişleri ve mümkünse ilk kayba kalan süre üzerinden tahliye/koruma kararı verir. Aegis sonrası hasar pozitifken tamirhanenin kapalı olduğu görünür; hasar sıfırlanınca yeni onarım açılabilir.
8. Son geçici kaynak bitince etki baz değere döner. Başarılı isabette tek bildirim; doz/kalan süre canlı göstergeden okunur. Radyasyon ölümü veya etki sonu ayrıca savaş raporu/bildirim üretmez; mevcut battery önleme bildirimi korunur.

Haritadaki gösterge ortak ortam oranını verir; özel detayda komutanın korunmuş HP/dk değeri ayrı etiketlenir.
50 HP/dk gösterirken koruması olan komutana aynı hasarı aldığını ima eden metin kullanılmaz.
Kalıcı anıt radyasyonu ile bomba süresi aynı sayaçta “hepsi bitecek” gibi sunulmaz.

## Ek dikkat noktaları ve sonraki karar turu

- Radyasyon hasarı isabet anında bir saatlik toplu HP düşüşü değildir; süre içinde birikir. İlk çarpmanın ayrıca anlık hasarı önerilmez.
- Eski kodda %20 üstü yaralanma dock'a aktarılır ve uçuşu engeller. Yeni bakım planıyla otomatik aktarım bütün durumlarda kalkar; canı %5 ve altı savaşamaz, transfer/tahliye edebilir.
- Yeni bakım kararıyla ücretsiz tamir bütün durumlarda kalkar; aktarım her zaman manueldir. Radyasyon bitince de otomatik sınıflandırma veya yama yapılmaz.
- NPC bağışıklığı devam ederken bomba NPC'yi etkilesin seçilirse kaynak kökeni ayrımı gerekir; doğal radyasyonu NPC'ye yanlışlıkla açmak yasaktır.
- Kayıp gemilerin enkaz/kill kredisi için ayrı ödül sistemi eklenmez. Güncel karar: yeni Honor kuralları uygulanır; küçük pozitif katkı gerçek yeni hasar üzerinden bomba başına sınırlandırılır. Tarihsel “puan yok” önerisi yürürlükte değildir.
- Radyasyonla zayıflayan filonun tahliyesi, desteği, savaşı ve dönüşü gerçek HP'yi taşır; bomba yalnız ekran sayısını değiştiren kozmetik bir zarar olmaz.
- Gezegenin normal Aegis kalkanı ile anti-battery farklıdır. Aegis aktif seviye başına 1 HP/dk azaltır. 0 HP’de korumaz; dolum 15 dk sonra başlar, 1 HP’de koruma döner. Daha uzun EMP engeli geçerlidir. Gemi araştırması kalan dozu azaltır.
- Ölüm Yıldızıyla karışık dalgada işlem sırası EMP ve battery uygunluğunu yanlış değiştirmemeli; mevcut anti-battery'nin gerçek çalışma kuralları korunur.
- Yeni sistemin eski sezonlarda aktivasyonu, deploy anında sürpriz hasar veya geçmiş doza yeni 50 sınırı uygulamayacak sürüm/zaman sınırıyla belirlenir. Üretime aktivasyon henüz yapılmaz.
- Gösterge ve kaynak listesi için sorgular hedef/season indeksleriyle sınırlandırılır. Offline doz sorgusunda şu an bitmiş kaynakları silmek veya yalnız `activeUntil > now` aramak hasarı kaybettirir; cursor'dan sonraki tarihçe gerekir.
- Kaynaklar canlı sezonda silinmez; ayrı 30 dk pencereler geçmiş doz hesabı için saklanır. Final cleanup mevcut season/wipe akışındadır.
- Yeni hücumun oyuncu/klan saldırı kotasına etkisi, ilave yakıt, iptal/geri çağırma ve dost hedefe dönüş politikası henüz owner tarafından kesinleştirilmedi. Başlangıç önerisi Ölüm Yıldızının tek kullanımlık hücum davranışını izlemek, yeni kota veya yakıt eklememektir.

## Son owner kararı: radyasyon sırasında tamirhane

Bu bölüm güncel kuraldır: Aegis sonrası radyasyon hasarı pozitif olduğunda çalışan/sıradaki REPAIR işleri otomatik iptal edilir ve tam onarım bedeli iade edilir.
Gemiler yaralarıyla tamirhanede kalır, radyasyon dozu alır; owner onları manuel home'a çıkarabilir. Aegis sonrası hasar sıfır olduğunda güncel cana göre yeni iş açılır.
Duraklama/otomatik devam/ek yarayı eski fiyatla iyileştirme artık uygulanmaz. Önceki “tüm paused gemiler ölünce iade” durumu da ortadan kalkar: fatura başta zaten iade edilmiştir.

### Davranış matrisi

| Durum | Aegis sonrası hasar pozitifken davranış |
| --- | --- |
| Yeni ücretli onarım başlatma | Reddedilir; kaynak harcanmaz, sıra oluşmaz |
| Hangardan tamirhaneye manuel aktarım | Reddedilir |
| Otomatik dock / ücretsiz yama | Her zaman kaldırıldı; radyasyon dışında da yok |
| Hasarlı filo inişi veya defender savaşı sonucu | Yara home filosunda korunur |
| Radyasyon başlangıcında aktif REPAIR kuyruğu | Çalışan ve bekleyen işler bir kere iptal/tam bedel iade; ilerleme kaybolur |
| Geminin iptal sonrası konumu | Idle dock, gerçek yarasıyla; yeni radyasyon dozunu alır |
| Dock'tan home'a çıkarma | Manuel ve mümkün; ışınlanma değildir, home'da doz devam eder |
| Parçalama | Reddedilir; gemi silinmez, kaynak verilmez |
| İkinci/üçüncü bomba | Kendi 30 dakikalık kaynağı; iptal edilmiş işe tekrar iade yok |
| Aegis sonrası dozun sıfırlanması | Yeni onarım artık oyuncu tarafından güncel can/fiyat/süreyle başlatılabilir |
| Dock gemilerinin radyasyondan ölmesi | Units/lots azalır; cancelled job ikinci refund veya resurrection yaratmaz |

### Uygulama sınırı ve gerçek zaman

Mevcut `cancelBuildOrder`, bütün build türlerinde yarım iade verir. Yeni radyasyon iptali yalnız `kind=REPAIR`/REPAIR lane ile sınırlıdır.
Normal manuel iptal/iade, YARD/CONSTRUCTION/RESEARCH ve Death Star/Interceptor üretimi bu nedenle değişmez.

- Yeni kaynak başlamadan önce hedefin önceki zaman aralığı gerçek olay sırasıyla kapatılır. Gerçekten bitmiş repair geriye dönük iptal edilmez.
- Kesin sınır: gerçek `readyAt <= positiveRadiationStart` olan iş tamamlanır; daha sonra bitecek aktif/sıradaki REPAIR iptal edilir. Aynı anda tamamlanma, yapılmış işin bitmesidir; radyasyon o andan sonraki dozu etkiler.
- Aktif ücretli repair işi CANCELLED + original invoice tam iade + event invalidation + lot bağlarını temizleme tek commit'tir.
- İşin tamamlanmış ve iptal edilmiş olması birlikte mümkün değildir. Eski pending/processing event terminal durumun ardından gemi iyileştiremez.
- İade güncel hull fiyatından veya geminin canından değil o işe gerçekten ödenmiş cost snapshot'ından yapılır. Seçili onarım miktarına ödenen bedel dışında gemi üretim maliyeti geri verilmez.
- Yeni isabet önceki cancelled job'u yeniden canlandırmaz/iade etmez. Manual cancel, arrival, abandon, season cleanup aynı işte toplam bir paid invoice'dan fazla iade edemez.
- Aegis sonrası doz sıfırken yeni ücretli iş başlatılabilir. Sonraki bomba veya Aegis kaybı dozu pozitif yaparsa iş bir kere iptal edilir.
- Tamirhanede beklemek radyasyon sığınağı değildir. Planet baskın koruması, %5 savaş katılımı ve doz maruziyeti farklı kararlardır.
- UI'da paused/finishing veya eski bitiş süresi gösterilmez: “Radyasyon nedeniyle onarım iptal edildi” ve gerçekten iade edilen kaynaklar görünür.
- Çıkış/tahliye, hasar o ana kadar işlendikten sonra uygulanır; işlemden önce ölmüş gemi seçilemez. %5 ve altı yaşayan gemi transfer/tahliye yapabilir.

### İnceleme bulguları: bombaya geçerken korunacak sınırlar

| Alan | Bulgu / gerekli önlem |
| --- | --- |
| Ortak radiationRateProfile | Eski yüzde dozuyla HP aynı geometri helper'ını kullanıyor. 50 HP/dk sınırı HP profilinde ve güncel kural aktivasyonundan sonraki zamanda uygulanır; eski yüzde sezonlara 50 yanlış birim olarak koyulmaz |
| Dose / ölüm / harita tahmini | Cap kaynak başına değil anlık toplamda, her başlangıç/bitiş diliminde. `segmentsExposureHp`, `firstHpLossAtMs`, lethal predictors ve public rate aynı profili kullanmalı |
| Kaynak tarihi | Yeni L3/cap veya home radyasyonu eski uçuşları ve geçmiş hasarı yeniden fiyatlayamaz; season/adoption timestamp sınırı ve eski kaynak pencereleri korunur |
| Bomba özel uçuşu | Missions gezegen FK'si ve strategicAssets.missionId anıt için sahte gezegene bağlanmaz. Ayrı bomba flight ve bağ constraints gerekir |
| Anti-battery kayıtları | `strategic_interceptions.missionId` NOT NULL missions FK ve deathStar alanları var. Bomba için uyumlu ayrı referans/constraint gerekir; eski DS geometry/tek mühimmat claim'i ve eventleri korunur |
| Stratejik Wealth | `planet.ts` şu an strategic adetini tek DEATH_STAR fiyatıyla değerliyor ve launched assets'i missions'a join ediyor. Farklı fiyatlı bombayı bu sorguya körlemesine eklemek yanlış değer ve görünmeyen flight yaratır; yeni türleri type-aware ve doğru flight bağlantısıyla değerle |
| Queue/refund | Otomatik REPAIR iptali ordinary build refund'u değiştiremez; UI/cancel/abandon temizliği terminal state ve bir refund receipt kullanır |
| Source mutation | Operator'ın bütün sezon anıtlarını kilitleyen prepare/replan yolunu her bomba için kullanma; yalnız hedefin dose/death/production sınırları yeniden planlanır |
| Clan/research/ownership locks | Research completion şu an player row alıyor; yeni doz için daha sonra planet lock almak mevcut sıra ile çelişebilir. Etkilenen dünyalar ve teknoloji sınırı sezon→dünya→player kuralıyla hazırlanır |
| Planet relocation | Public planet aurasının merkezini kalıcı eski koordinata değil görünür hedefin güncel konumuna bağla; radiation kimliği/hedef politikası mevcut yer değiştirme/holding kurallarıyla uyumlu olmalı |
| Anıt pasif filo | %5 altında ateş sıfır fakat target/cargo/production/ownership fiziksel lotu korur; genel “savaşamazsa hedef listesinden çıkar” filtresi yanlış |
| İlk bakım aşaması | Home yarası ve manuel bakım temeli önce tamamlanır. Yeni bomba API/modeli/radyasyon eventleri bu aşamaya eklenmez |

### Ek kabul testleri

- Üç REPAIR işi varsa ilk radyasyon başlangıcında üç bedel tam ve bir kere iade; YARD/CONSTRUCTION/RESEARCH dokunulmaz.
- Onarım gerçekten radyasyonun başlangıcından önce/aynı anda/sonra bitecekti; completion/arrival/claim worker sırası sonucu değiştirmez.
- İptal sonrası dock count/damage/repairOrderId temizliği; gemi manuel home'a çıkabilir, radiation source geçmişi aynı kalır.
- İki source: 12:00–13:00 ve 12:20–13:20; başlangıçta iptal/iade, ikinci isabette tekrar yok, 13:00'te yeni repair hâlâ reddedilir.
- Radyasyon bitince eski completion gelse bile iyileşme yok; %30 gemiye açılan yeni iş %30→%100 için güncel ücret ve süre alır.
- Cancelled job'un bütün gemileri ölse de ikinci refund/units insert yok. Depo doluluğu ödenmiş bedelin iadesini sessizce kesmez.
- Karışık Death Star/bomba dalgası ve iki charge claim; durdurulan bomba hiç source/REPAIR cancellation yaratmaz.
- Kaynak, repair completion, shipment birth, tech completion ve colony secession zamanları birbirini doğru keser; dose/prediction aynı gerçek geçmişten çıkar.
- Cap'ın çalıştığı HP/legacy percentage cutover testleri; expired sources/history query, finite fraction ve source levels 1/2/3 API-DB tutarlılığı.


## 15 Ekim origin/master eşitleme ön kontrolü

`git fetch origin` sonrası local HEAD `a8abe4c`, origin/master `b8d6ed0`: local 1 / remote 5 ayrı commit. Ortak tabana göre remote 74 dosyaya dokunuyor; yerel committed+uncommitted tracked değişikliklerle 27 dosya kesişiyor. İki remote dosya localde untracked: `apps/web/test/focus-planet-skin.test.tsx`, `tools/planet-skin-glow-visual.mjs`. Bu sayılar gerçek merge conflict sayısı değildir; henüz merge denenmedi.

Özellikle `1b176fe` planet view sorgu/kilit optimizasyonları `planet`, `planetView`, `repair`, `movement`, `shipDamage` ve stratejik servislerdeki yerel bakım/Honor değişiklikleriyle birlikte incelenmeli. Geçmiş CR sonucu birleştirilmiş kodun doğrulaması sayılmaz. Önerilen sıra: bütün tracked+untracked yerel işlerin geri yüklenebilir yedeği → master üzerinde kontrollü entegrasyon → anlamsal review/test → bomba uygulaması. Reset/clean, branch/worktree, merge/rebase veya deploy yapılmadı.


## Son owner kararları — 15 Ekim

- Bomba NPC anıt garnizonuna da zarar verir: önce bombayla garnizonu azaltıp sonra saldırmak geçerli taktiktir. Anıtın kendi doğal radyasyonundan NPC'nin mevcut bağışıklığı ayrıca kaldırılmadı; bomba kökeni ayrılmalı.
- Klan desteği dahil. Prospector/kazıcı ve kara savunması hariç.
- Toplam radyasyon her kaynak birleşiminde en fazla 50 HP/dk. Geminin mevcut koruması bu üst sınırdan sonra azaltır.
- Aegis enerjisi fırlatmayı engellemez; Aegis'e radyasyon azaltımı bu taskta eklenmez. Süreli saldırı korumaları ve dost hedefe fırlatma yasakları korunur.
- Seviyeler paralel üretilir; uçuşta bomba kendi stok yuvasını tutar; fiyat/süre/açılma önceki tabloda onaylandı.
- Owner yedekli, kontrollü master entegrasyonu ve regresyonlardan sonra bomba uygulamasına geçişi istedi. Yeni worktree/branch yok.

### Canlı sürüm ile master farkı

Salt okunur canlı kontrolünde üç API, worker ve web release `efa8f8363f95edde1a7ee39c8620baaa83e64fd5`. Bu commit `77b3c2be` resource-fixes paketini içerir, `626746ad` ek paketini içermez. Resource-fixes worktree temiz, branch `perf/resource-fixes-2`, HEAD `626746ad`. İki paket de origin/master `b8d6ed0` ve eski local master `a8abe4c` atası değildir. Son paket remote branch olarak da görünmedi.

Owner origin, canlı release ve son resource-fixes paketini entegre etmeyi onayladı. Master üzerinde üç merge tamamlandı; regresyon doğrulaması sürüyor. Salt origin entegrasyonu canlı eşitliği sayılmayacak, canlıya yayın yapılmayacak.

### 15 Ekim — uçuş ve görsel itirazlarının düzeltmesi

- M1 modelinin gerçek burnu +Z. Manifest düzeltildi; arka motor ağzı -Z'ye taşındı. Own, identified contact, interception ve önizleme aynı seviye boyutu ve aynı hareketli roket egzozunu kullanır.
- L1 zeytin yeşili zırh / 0,48; L2 turkuaz, çift dış kapsül / 0,64; L3 koyu gövde, sarı başlık ve üç dış kapsül / 0,84 dünya birimi. Başlık çapı, renk, kapsül sayısı ve uçuş boyutu birbirinden ayrılır. Owner hareketli önizlemeyi beğendi ve yalnız L1'in beyaz yerine başka renkte olmasını istedi; L1 gövde ve başlığı zeytin yeşiline çevrildi.
- Rota, fırlatmada kaynak yüzeyi ile hedef yüzeyi + yarım füze boyu arasında dondurulur. Burun varışta yüzeye değer; gövde merkeze girmez. Yolculuk süresi, hedef kimliği ve hasar hesabı aynı kalır. Gezegen/anıt boyutları ve owner/contact/anti-battery geometrisi ortak tanımdan gelir; istemci ikinci bir orbit offset'i uygulamaz.
- Radar bildiriminin mesafesi görsel çarpma noktasından değil gerçek gezegen merkezinden ölçülür. Surface offset sonrası erken uyarı regresyonu ayrı testle yakalanıp düzeltildi.
- Havai fişek görünümü veren E3 sprite çizgileri kaldırıldı. Yeşil plazma yönü özel dalgalı basınç/bulut shader'ıyla, kalıcı sis A1 dokusuyla uygulanır. Bilinen isabetler önceden hazırlanır, efekt tam isabet karesinde açılır; bir saniyelik UI tick'i beklenmez.
- Her model 7 gövde draw call; sırasıyla 1.352 / 1.896 / 2.360 üçgen. Basınç bağlantıları malzemeye göre batch edilir. Egzoz 64 parçacığı tek instanced draw'da çizer; radyasyon stack sayısı hedef başına aura draw sayısını artırmaz.
- Doğrulama: gerçek GLB burnu/nozzle/başlık renkleri ve çapları; telefon/masaüstünde uçuş yönü, model yüzeyine girmeme, yaşayan egzoz ve ilk 300 ms içinde doğru isabet zamanı. Önizleme: `/tmp/astera-radiation-bomb-visual-final-v5/moving.webp`. Harita/model/monument/interception UI regresyonları: 97 test; bomb flight/interception/visibility: 27 ayrı senaryo.
- Kırılma riski: model facing/engine attachment, ortak craft/monument ölçüsü, frozen route tüketen Radar/Telescope/anti-battery ve varış anındaki efekt zamanlaması. Bu değişiklikler yalnız master'da ve lokalde; push/deploy/canlı DB aktivasyonu yapılmadı. Bomba sisteminin genel gameplay/aktif sezon review'ı bu görsel doğrulamayla tamamlanmış sayılmaz.

### 15 Ekim — radyasyon tehlike renkleri

Owner kararı: toplam radyasyon 0–16 HP/dk sarı, 17–32 turuncu, 33–50 kırmızı. Bar ve seçili hedef kadranı aynı rengi kullanır. Ondalıklı değerlerde 16→17 ve 32→33 arasında yumuşak harman; değer arttığında veya azaldığında 0,6 saniyelik renk geçişi uygulanır. Renk, kalkan sonrası kişisel hasarı değil hedefteki toplam tehlikeyi gösterir; korumalı hasar ayrıca yazılmaya devam eder. Dolmuş bütün bar segmentleri aynı güncel tehlike rengindedir. Telefon/masaüstü önizlemesinde 9→21,5→39,5 HP/dk ve gerçek ara renkler doğrulandı.


### 15 Ekim — hasar, kaynak yaşam döngüsü ve destek CR

- Nötr gezegen NPC savaşları gerçek radyasyon yarasıyla başlar ve sağ kalanların yarasını saklar. Eski sezonların NPC politikası değişmez; takviye üretimi öncesi mevcut gemilerin zamanı kapatılır, yeni gemi geçmiş doz almaz. Üç yeni senaryo ve mevcut NPC regresyonları geçti.
- Dock yarasının tek kalıcı otoritesi `shipDamageLots`; `units.damage` yalnız home için kalıcıdır. Okuma projeksiyonu ayrı HP gösterir; kısmi RETURN kalan dock cohort'ını yanlış kopyadan yeniden üretmez. Yalnız yara değişiminde bütün servet/Honor muhasebesi tekrar çalışmaz; fiziksel kayıp olduğunda çalışır.
- Geç işlenen klan desteği varışında `stationedAt` worker zamanı yerine gerçek mission varışıdır. Host cursor ilerlemiş olsa da yeni cohort kendi bekleme aralığını öder; destekli savaş regresyonları dahil 20 test geçti.
- Gezegenin mevcut operator HP kaynağı ekleme/bitirme işlemleri de eski dozu önce kapatır. Başlangıç/bitiş ve ölüm sınırları olayla planlanır; gelecekte başlayan kaynak onarımları gerçek başlangıç anında iptal/tam iade eder. Geç worker sırasında mutable işlem sınırı atlayamaz. Eski radyasyon servis testleriyle 19 senaryo geçti.
- Kadranın açılır kaynak listesinde doğal kaynak ve her bombanın seviyesi, ham HP/dk değeri ve kendi kalan süresi ayrı görünür. 50 sınırını aşan kaynaklar da listede saklanır. Bar sade kalır; kadran 350px/1280px görsel kontrolden geçti.
- Devam eden doğrulama: anti-battery gözlemci güncellemesi, fiziksel çarpışma bitmeden gezegen/komutan taşınması, birleşik regresyon, tip/lint ve sentetik aktif sezon geçiş provası. Uzun ekonomi/sezon simülasyonu çalıştırılmayacak; canlı veriye veya deploy'a dokunulmadı.
