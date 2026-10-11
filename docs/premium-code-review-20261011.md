**Premium görsel değişiklikler — kod incelemesi ve düzeltmeler, 11 Ekim 2026**

Kapsam, bu oturumda `master` üzerinde yapılan görsel, ses ve yerel geliştirme değişiklikleridir. Başka oturumun stage edilmiş admin, fullscreen ve sunucu performansı değişikliklerine müdahale edilmedi. İki P1 ve dört P2 bulgu için düzeltme uygulandı. Sahibinin talimatıyla birim/regresyon testleri son görsel onayına ertelendi; bu oturumda yazılmadı, değiştirilmedi veya çalıştırılmadı.

**1. [P1] Referans model hazırlama kodu lint kontrolünü bozuyordu — düzeltildi**

- Dosya: `apps/web/src/galaxy/referenceArt.ts`.
- `instanceof THREE.Mesh`, Three generic tiplerini `any` olarak daraltıyordu. İlk root lint çalıştırmasında geometry klonlama ve UV erişiminden 12 `no-unsafe-*` hatası çıktı.
- Typed Mesh predicate ile geometry/material tipleri korundu; kural kapatılmadı. Hazırlanmış full/LOD modellerinde UV bulunması offline araç tarafından doğrulanıyor. Geçersiz model yüklemesi kendi hata sınırında mevcut modele dönüyor.
- İki ek parse hatası yaratan tek seferlik `apps/server/.dev/review-{grants,spawns}.ts` dosyaları `.dev/one-offs/` altına çalıştırılmayan kaynak metni olarak arşivlendi. Tekrar çalıştırılmadılar.
- Düzeltme sonrası tam root lint yalnız bir gereksiz UV koşulu bildirdi. Bu koşul kaldırıldı; değişen `referenceArt.ts` ve `Fleets.tsx` için root lint scripti üzerinden kapsam daraltılarak yapılan son kontrol sıfır hatayla geçti. PC yükü nedeniyle bütün workspace ikinci kez taranmadı.

**2. [P1] İsteğe bağlı referans GLB'sinin yüklenememesi galaksiyi kapatıyordu — düzeltildi**

- Dosyalar: `lib/referenceArtPlugin.ts`, `galaxy/Asteroids.tsx`, `galaxy/Fleets.tsx`, `galaxy/SkinAssetBoundary.tsx`.
- Önce paket yalnız arşiv manifestinin varlığıyla etkinleşiyordu. Model isteğindeki hata, `Suspense` tarafından yakalanamıyor ve Canvas'ın dışına taşınıyordu.
- İlk tarayıcı incelemesinde referans asteroid isteğine 404 verilince canvas sayısı sıfıra düştü, `window.__galaxy` silindi ve galeri boşaldı. İlk kanıt: `out/premium/cr/inspection.json` ve `missing-reference.png`.
- Paket artık seçili üç kaya, patlama atlası ve altı geminin full/LOD türevleri mevcutsa etkinleşiyor. Eksik hazırlıkta Astera'nın kendi assetleri kullanılıyor.
- Asteroid bucket'larına ve filo gövdesi bucket'larına ayrı hata sınırları eklendi. Başarısız istekte aynı nesneler, aynı konumlar ve seçim hedefleri mevcut Astera GLB'siyle korunuyor. Bir geminin hatası diğer gemileri kaldırmıyor.
- Referans geminin yüklenememesi, o modelin egzozunu da mevcut Astera modelinin konumuna döndürüyor. Hata bilgisi altı referans URL'siyle sınırlı.

**3. [P2] Referans gemiler gerçek uzak mesafe LOD'unu devreden çıkarıyordu — düzeltildi**

- Dosyalar: `galaxy/shipCosmetics.ts`, `galaxy/referenceArt.ts`, `tools/premium-reference-assets.mjs`.
- Önce altı gemide full/low aynı GLB'ydi. Örneğin TALON her mesafede 8.483 üçgen taşıyordu; eski uzak TALON 2.998 üçgendi.
- Offline araç orijinalleri değiştirmeden `.dev/reference-art/ships/` altında gerçek türevler oluşturuyor. Tam modeller 5.000, uzak modeller 2.000 üçgen ve tam modelin %60'ıyla sınırlı. Normal ve UV ağırlıklarıyla basitleştirme yapılıyor; çalışma anında geometri sadeleştirme yok.
- Son dosyalardan ölçülen değerler:

| Gemi | Arşiv full | Hazırlanmış full | Uzak LOD |
| --- | ---: | ---: | ---: |
| DART | 3.340 | 3.340 | 2.000 |
| VIPER | 2.702 | 2.702 | 1.620 |
| TALON | 8.483 | 4.999 | 1.996 |
| RAMPART | 4.232 | 4.232 | 1.999 |
| STRONGHOLD | 2.072 | 2.072 | 1.243 |
| LEVIATHAN | 3.826 | 3.826 | 1.999 |

- 1024px dokular WebP olarak kodlandı. Altı orijinal full GLB **18.006.248 byte** iken hazırlanan altı full + altı LOD toplamı **2.284.496 byte (2,18 MiB)**. Bu sayı yerel gemi dosyaları içindir; kaya/atlas ve Astera'nın diğer assetlerini kapsamaz.
- Komuta-gemisi worktree'si ve orijinal referans dosyaları salt okunur kaldı. Türevler Git/public/production dışında; dar bir development servis yolundan okunuyor.

**4. [P2] Aynı GLB iki kez ayrıştırılıyor, ayrı doku kaynakları oluşuyordu — düzeltildi**

- Dosya: `galaxy/Fleets.tsx`.
- İlk incelemede full/low aynı URL olmasına rağmen `useGLTF([url, lowUrl])` iki sahne ve iki doku kaynağı oluşturuyordu. VIPER ve LEVIATHAN'da farklı Texture/Source UUID'leri canlı sahnede görüldü.
- URL'ler eşitse loader'a tek girdi veriliyor ve aynı sahne/part listesi paylaşılıyor.
- Gerçek referans LOD'ları yalnız geometri içeriyor; UV'leri korunuyor. İki seviye tam modelin malzemesindeki aynı Texture nesnelerini kullanıyor. Astera'nın mevcut kozmetik/LOD doku tercihleri değiştirilmedi.

**5. [P2] RAMPART'ın motor alevleri yeni gövdeye oturmuyordu — düzeltildi**

- Dosyalar: `galaxy/referenceArtManifest.json`, `galaxy/referenceArt.ts`, `galaxy/Fleets.tsx`.
- `SpSh6`/RAMPART'ın gerçek çıkışları `x = ±0.154, z = -0.09` iken eski efekt tek merkezi `z = -0.42` noktasından çıkıyordu.
- Altı referans gövdenin ölçülmüş çift motor noktaları ortak manifestte tutuluyor. Egzoz, gövdenin dikey duruşunu ve her oluşum üyesinin hedef yönünü izliyor.
- Çift çıkışlar mevcut tek batched ışık alanında çiziliyor; gemi başına yeni sprite/draw call eklenmedi. Referans dışı gövdeler ve donatılmış gemi/motor kozmetikleri mevcut sunum önceliğini koruyor. Yükleme hatasında owned modelin tek çıkışına dönülüyor.

**6. [P2] Madencilik efekti sunucu onayı gelmeden zaman aşımına uğruyordu — düzeltildi**

- Dosyalar: `galaxy/MiningPulse.tsx`, `v2/gallery/PremiumSpaceGallery.tsx`, `tools/premium-visual.mjs`.
- Başarı verisi server'dan gelmeden efekt açılmıyordu; buna rağmen süre planlanan `arriveAt` üzerinden sayılıyordu. 350 ms gecikme sesi, 1,6 saniye gecikme görseli atlıyordu. Worker/refetch'in normal gecikmesi bu pencereyi tüketebiliyordu.
- Efekt artık taze, başarılı `outbound → returning` onayının gözlendiği anda başlıyor ve 1,6 saniyelik süresini koruyor. Ses aynı başlangıç üzerinden bir kez deneniyor; ses mixer'ının event deduplication kuralı sürüyor.
- En fazla 10 saniyelik taze geçiş kabul ediliyor; ilk açılışta yalnız son 1,6 saniyede bitmiş bir sefer gösterilebiliyor. Eski dönüş, boş maden, recall ve gizli sekmede gelen onay efekt başlatmıyor. Sunucunun ekonomi/varış zamanlaması değiştirilmedi.
- Galeri artık örnek seferi önce outbound, **2,5 saniye sonra** onaylı returning gösteriyor. Görsel yakalama aracı bu onayı bekliyor; anında hazır başarı fixture'ı kaldırıldı.

**Sahibinin geri alma istekleri**

- Üst gezegen `PlanetHero.tsx` içinde eski `PlanetSigil` resmine ve orijinal uydu mesafesine birebir döndü. `PlanetPortrait.tsx` ve `PlanetPortraitScene.tsx` kaldırıldı; portreye özel frame-scheduler değişikliği geri alındı.
- Galaksi arka planı eski halinde: `galaxy/Environment.tsx` ve `galaxy/sky.ts` HEAD ile birebir. Yeni küçük yansıma ortamı arka plan görselini değiştirmiyor.
- Görsel değişiklik/provenance belgesi `docs/premium-visual-upgrade.md` bu son duruma göre güncellendi. Yerel referans ile production assetleri açıkça ayrıldı.

**Stabilite ve sezon akışı incelemesi**

- Yeni görsel kod, model hatalarını bucket düzeyinde karşılıyor; ses hataları oyun eylemini reddetmiyor. Sezon açma, bitirme ve otomatik geçiş handler'larına görsel bağımlılık eklenmedi.
- Yeni sezon oluşturma varsayılanı `MULTI_WORLD.rulesetVersion` kullanıyor. Yerel bootstrap yalnız development + loopback veritabanında eski/frozen yerel dünyaları yenileyebiliyor; normal bootstrap canlı sezonun kurallarını değiştirmiyor.
- Yerel yenileme mevcut `forceSeasonEnd` mühürleme ve transaction/advisory lock kullanan `wipeAllServers` akışını çağırıyor. Wipe, canlı sezonlar mühürlenmeden çalışmayı reddediyor; yeni dünyalar transaction içinde oluşturuluyor. İlgili kod yolları incelendi, yeniden tasarlanmadı.
- Bu düzeltme turunda aktif sezonlar kapatılmadı veya yeniden oluşturulmadı. Read-only DB kontrolünde EU-1/EU-2/MONUMENT-LOCAL aynı ID'lerle live, ruleset 16 ve sekizer anıtla duruyor. Her sezonda bir pending `season_end` ve bir pending `season_rollover` var; failed scheduled event yok. Bu, tam bir sezon geçişi regresyon testi değildir.

**Doğrulama**

| Kontrol | Sonuç |
| --- | --- |
| Web typecheck | Geçti |
| Server typecheck | Önceki CR'de geçti; server kaynakları bu düzeltme turunda değişmedi |
| Lint | Tam taramada kalan tek koşul düzeltildi; son değişen dosyaların kontrolü geçti |
| Web production build | Geçti; mevcut 500 kB chunk uyarısı sürüyor |
| `git diff --check`, asset araçları ve başlangıç scripti sözdizimi | Geçti |
| Web, API health ve LAN üzerinden API | HTTP 200 |
| Son tarayıcı incelemesi | Tamamlandı; kanıt `out/premium/cr-fixed/inspection.json` ve altı ekran görüntüsü |
| Statik üst gezegen | 350/585/1280 px: resim yükleniyor, portre canvas sayısı 0, yatay taşma yok |
| Referans full/LOD | Altı gövdede farklı geometri, aynı map/normalMap/Source UUID; tüm LOD UV’leri mevcut |
| Referans GLB 404 | Üç kaya + VIPER hatasında canvas 1, galaksi açık, 8 kaya mevcut owned modellerle çiziliyor; VIPER owned full/LOD’a dönüyor |
| Motor fallback | Normal oluşumda 156, VIPER fallback’inde 143 plume noktası: ilgili gemi çift çıkıştan owned tek çıkışa dönüyor |
| Gerçek motor noktaları | Canlı point buffer’ında altı gövdenin çıkış aralığı/merkez mesafesi ölçüldü; en büyük fark < 0,00000004 dünya birimi |
| Gecikmiş madencilik | Onay öncesi görünmez; onay sonrası görünür ve tek ses; sonrasında görünmez, ikinci ses yok |
| Production ayrımı | Referans gemi/kaya/atlas URL’leri ve 3D portre chunk’ı build çıktısında yok |

Normal tarayıcı incelemesinde page error yok. Kasıtlı 404 senaryosundaki dört yükleme hatası tarayıcıya raporlanıyor: bu R3F sürümü yakalanmış hataları da `reportError` üzerinden iletiyor. Hata sınırları yine çalışıyor; galaksi/nesneler/seçim kontrolleri korunuyor.

PC yükünü azaltmak için son ağır kontroller `nice -n 19`, tek çekirdek ve sırayla çalışıyor. Son onaydan sonraki testler de tek workspace/tek worker ile çalıştırılacak.

**Son görsel onayından sonra test kapsamı**

1. Eksik referans paket/404: galaksi ve seçim hedefleri çalışırken owned modele dönüş; production ayrımı.
2. Full/low seçimi, eşit URL'de tek ayrıştırma, gerçek düşük geometri, ortak dokular ve model motor noktaları.
3. Gecikmiş madencilik onayı, tek oynatma; eski/boş/recall dönüş ve tekrar gelen veri.
4. Ses gesture, mute/volume kalıcılığı, gizli sekme, altı ses sınırı ve event deduplication.
5. Statik gezegen resmi/skin, scroll ve kaldırılan 3D portreye bağımlılık kalmaması.
6. Yerel bootstrap güncel varsayılan, eski ruleset/layout yenileme, hesapların korunması, tekrar başlangıçta aynı sezon ID'leri, yerel olmayan ortamda ret. Eski `dev-up` fixture'ları yeni komutlarla eşitlenecek.
7. Sezon bitirme/yeniden başlatma, aktif maden/enkaz/görevler varken temiz geçiş, hata halinde transaction rollback ve tekrar denemede idempotency.

Galaksi ekran görüntülerinde software WebGL yükünü sınırlamak için kare akışı durdurulup gerçek bir kare elle çizildi. Bu yalnız inceleme tarayıcısında yapıldı; oyun renderer’ının frame politikası değiştirilmedi.

Tarayıcı incelemesi SwiftShader kullanır; fiziksel Android/iPhone FPS'i, termal davranış, büyük gerçek filo yükü ve GPU context kaybı/geri kazanımı ölçülmüş sayılmaz. Oturum açılmış gerçek hesapla tam oyun regresyonu ve sezon geçiş testleri son onaydan sonra yapılacaktır.
