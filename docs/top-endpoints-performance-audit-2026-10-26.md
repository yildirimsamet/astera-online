# Astera — Üretimde en çok çağrılan beş endpoint

26 Ekim 2026. Üretim logları + çalışan kod + yerel üretim kopyasında SQL planları. Bu çalışma incelemedir; ürün kodu, prod indeksleri veya prod yapılandırması değiştirilmedi.

## 1. Gerçek istek dağılımı

**26 Ekim 00:51:14–01:51:14 Türkiye saati**, bitiş hariç. Nginx'in tamamlanmış istek logları: **19.012 toplam istek, 18.486 `/api/` isteği**. Method + normalize edilmiş path gruplandı; gezegen UUID'leri `:id`, query string'ler hariç. İlk beş API isteklerinin **%55,78**'i.

| Endpoint — GET | İstek/saat | API payı | p50 | p95 | p99 | 200 / 401 / 499 |
|---|---:|---:|---:|---:|---:|---|
| `/api/galaxy/traffic` | **5.628** | %30,44 | 33 ms | 176 ms | 351 ms | 5607 / 19 / 2 |
| `/api/mining/field` | **2.064** | %11,17 | 21 ms | 109 ms | 226 ms | 2051 / 13 / 0 |
| `/api/galaxy/events` | **880** | %4,76 | 24 ms | 100 ms | 192 ms | 869 / 11 / 0 |
| `/api/galaxy` | **877** | %4,74 | 94 ms | 323 ms | 515 ms | 865 / 12 / 0 |
| `/api/planets/:id` | **862** | %4,66 | 143 ms | 424 ms | 662 ms | 820 / 12 / 30 |

Gecikmeler Nginx `request_time`: yalnız SQL süresi değildir; uygulama, bekleme ve yanıt aktarımını kapsar. Bütün durum kodları dahildir. Açık SSE bağlantıları kapanana kadar bu logda tamamlanmış istek olarak görünmez. Bu liste mesaj sayısı, eşzamanlı kullanıcı veya CPU tüketimi sıralaması değildir. 499, istemci bağlantısının kapanmasıdır; tek başına sunucu hatası kanıtı değildir.

**Mevcut log yeterli olduğu için bir saatlik yeni toplayıcı kurmaya/beklemeye gerek kalmadı.** Log gruplama script'i ve testleri kanıt klasöründe saklandı. IP, kimlik bilgisi, ham URL parametresi veya istek gövdesi rapora alınmadı.

Kaynak: [bir saatlik dağılım](evidence/top-endpoints-2026-10-26/last-hour.json).

## 2. Kanıt ve ölçüm sınırları

- Üç API replica'sında commit: `cb69b8df05310c55624b6991d103956361e4aa12`. Hedef route/servis dosyaları ile `keys`, `refreshQueries`, `shardEvents`, orbital keşif kodu bu commit ile karşılaştırıldı; incelenen dosyalarda fark yok. Bütün repo veya değişmiş diğer bağımlılıklar için eşitlik iddiası yok.
- [Replica metrikleri](evidence/top-endpoints-2026-10-26/replica-metrics.json) yaklaşık 01:50 TRT'de alındı. Sayaçlar yaklaşık 53 dakikalık süreç ömrüne ait; bir saatlik Nginx penceresiyle aynı aralık değiller.
- Önceki izinle alınmış yerel prod kopyası kullanıldı. Yeni prod dump alınmadı. Aktif MAIN sezonunda 53 oyuncu, 166 dünya; kopya toplamında 39.473 görev ancak yalnız 13 aktif görev var. Yoğun gelecek sezon kapasitesi ölçülmedi.
- PostgreSQL 16, 1 CPU/1 GiB container, tek bağlantı. Yeni mining/events yakalamasında önceki yakalamanın saati kullanıldı; daha geç duvar saatiyle olayların doğal olarak sona ermesi ölçümü değiştirmesin diye.
- Önceki 102 başarılı SQL planına bu tur **9 plan** eklendi: events 4, mining snapshot 5. Bunlar ilgili servislerin SQL'idir; auth/placement dahil tam route sayısı değildir.
- Karşılaştırmalar 2 ısınma + 9 tekrar medyanı; gerçek SQL, `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`. Üretimde EXPLAIN ANALYZE çalıştırılmadı. Yerel ms değerleri prod p95 ile çıkarılıp toplanamaz.
- Fonksiyon complexity değerlendirmeleri kaynak kodundan; CPU flamegraph veya her fonksiyonun duvar saati profili çıkarılmadı. Algoritmik iyileştirme adayını ölçülmüş uçtan uca hızlanma diye sunmuyorum.

## 3. Cache gerçekten var mı?

Var ve aktif. Üç replica toplamı:

| Cache | Hit | Miss | Hit / (hit+miss) | Invalidation |
|---|---:|---:|---:|---:|
| Traffic | 3.286 | 1.798 | %64,6 | 908 |
| Mining | 5.711 | 1.828 | %75,8 | 807 |
| Public galaxy | 554 | 235 | %70,2 | 54 |
| Commander | 7.644 | 1.314 | %85,3 | 302 |
| Sensor history | 6.731 | 1.288 | %83,9 | 339 |
| Pirates | 4.205 | 1.348 | %75,7 | 27 |

Bütün bu cache'lerde bypass ve eviction sayacı sıfır. Single-flight bekleyenler hit'e dahil olabilir; oranlar tamamlanmış cache cevabı oranıyla bire bir aynı değildir. Mining/pirate cache'lerini trafik gibi başka endpointler de kullanıyor. Bu sayaçlar endpoint başına SQL kazancını doğrudan vermez. Miss'lerin TTL/invalidation nedenleri ayrı sayılmıyor; neden dağılımı iddia etmiyorum.

Mevcut tasarım doğru bir temel sunuyor: replica-local sınırlı cache, aynı anahtar için tek yükleme, bus sağlıksızken bypass, ortak snapshot ardından oyuncu görünürlük filtresi. Eksik olanlar ortak yardımcı veriler, gereğinden geniş invalidation ve bazı tekrar hesaplamalar. İlk iş Redis eklemek değil.

## 4. `/api/galaxy/traffic`

**Çağrı zinciri:** `routes/galaxy.ts:389` → commander → paralel traffic snapshot / sensors / mining snapshot / sensor history / pirate snapshot → asteroid ve pirate keşfi → `projectGalaxyTraffic` → interception projeksiyonları.

**Neden çok çağrılıyor?** `useTraffic` ve `TRAFFIC.refreshMs` 5.000 ms polling kullanıyor. Launch, arrival, mining, pirate, control gibi SSE olayları ayrıca yeniliyor. Önceden var olan coalescing çakışan okumaları birleştiriyor; sürekli olay akışında arka arkaya yeni okumaları tamamen kaldırmıyor. Loglar bu 5.628 çağrının kaçının timer/olay/focus kaynaklı olduğunu söylemiyor.

**SQL:** `loadTrafficSnapshot` aktif missions, mining_runs, pirate_raids, trade_runs, intergalactic_convoy_runs, interceptions/impacts, monument waves/probes/lots, radiation, unknown signals, units, world positions/core levels ve kozmetik/klan okumaları yapıyor. Birçok okuma batch; bunu N+1 olarak etiketlemek yanlış. Önceki gerçek kopya yakalamasında missions 13 satır / 0,067 ms / 15 buffer. Sıcak sentetik route ölçümünde ana handle'da yalnız 3 ifade vardı: domain snapshot cache'inin işe yaradığını doğruluyor.

**Somut tekrar:** HP yolunda `physicalFleets` pirate birimlerini `units.location` ile zaten yüklüyor; hemen ardından `raidFleets` aynı pirate konumlarını yeniden sorguluyor (`traffic.ts:676–717`). HP modelinde ilk haritayı kullanıp legacy modelde fallback sorgusunu korumak bir SQL'i kaldırabilir. Sıfır adetli birimler ve dönüş filoları için eşdeğerlik testi şart.

**Algoritmalar:** F aktif uçuş, S sensör, A tutulan asteroid, K uçuşu olan asteroid, E tarihsel sensör epoch'u, P pirate nesnesi için görüş bölümü yaklaşık `O(F×S + A + K×E + P×E)`. Güncel sensör sayısı en fazla dört dünya ile sınırlı; **E geçmişi dörtle sınırlı değil**. Bu ifade radyasyon ve rota maliyetini içermez. HP projeksiyonunda her cohort için kaynak/segment taraması ve lethal-time çözümü de çalışıyor; bütün fonksiyona basitçe O(F) demek yanlış.

**Düzeltme adayları:**

1. `signalHomes.find` iki kez/sinyal tarıyor: O(sinyal×ev). Bir kez `(owner,id)` ve owner→capital Map kurmak O(ev+sinyal) yapar. Boş/yanlış sahiplik ve capital fallback aynı kalmalı. Mevcut örnekte sinyal az olduğundan önceliği düşük.
2. `projectHpFlight` aynı rota/cohort/radyasyon için `hpWingLethalAtMs` sonucunu her çağrıda tekrar hesaplıyor (`flightProjection.ts:65`). Bu sonuç `now` parametresine bağlı değil; snapshot generation + rota + cohort/damage/tech + kaynak sürümü ile ortak hesaplanabilir. Anlık kalan filo ve görüş ayrı kalır. Bunun gerçek CPU kazancı henüz ölçülmedi.
3. Asteroid/pirate keşif hesabını oyuncu+sezon+sensor-history sürümü+field generation ile paylaşmak. Keşif/expiry zamanlarında doğru uyanma şart; oyuncular arasında final `contacts` cache'i ortak olamaz.
4. Trafik sürekli hareket ediyor diye her 5 saniyede aynı temel veriyi indirmek zorunda değiliz. Rota/zaman istemcide zaten projekte ediliyor. Olaylarla değişen yetkili contact ekleme/güncelleme/silme ve görüş sınırı zamanları taşınabilir. Ancak mevcut kısa bearing pencereleri polling süresine bağlı; 5 saniyeyi yalnız config'ten büyütmek görünürlüğü bozabilir.

**SQL kararı:** Aktif görev partial index'i önceki kopya deneyinde fayda sağlamadı. Yeni indeks önerisini bu örnekle gerekçelendirmiyorum. Önce ortak snapshot tekrarları ve istek sayısı.

## 5. `/api/mining/field`

**Zincir:** commander → `fieldView` → `miningSnapshot` → `historyFor` → `projectPlayerAsteroidField` → `projectVisibleDebris` → DTO. `fieldView` snapshot ve history'yi peş peşe bekliyor; birbirinden bağımsızlar. `Promise.all` miss durumunda bekleme zincirini kısaltabilir; SQL sayısını azaltmaz.

**SQL:** season → asteroid_spawn_hours (veya legacy schedule) → spawn_gate_skips → asteroid_claims + debris_fields. Yeni plan: 12 saat kaydı, 17 skip, 223 claim, 4 debris. Claims sorgusu 227 asteroid indeksini parametreli IN ile taşıyor; tabloda 10.435 satır, seq scan'de 10.212 satır eleniyor. Diğer tabloların uygun index erişimleri veya küçük seq scan'leri var.

**Deney:** claims IN medyan **1,173 ms, 77 buffer**; aynı sonuçları veren `index = ANY($2::integer[])` **1,207 ms, 77 buffer**. Planning 0,207→0,131 ms. Execution kazancı yok; bunu performans çözümü olarak önermiyorum. Küçük farklar mikroölçüm gürültüsüne açık.

**Hesap maliyeti:** `orbitDiscoveredAt` E epoch tarıyor; `projectPlayerAsteroidField` aktif asteroidleri keşif için taradıktan sonra `nextAsteroidDiscoveryAt` aynı keşif çözümünü yeniden çağırıyor. Sonraki temas için bilinmeyenlerde ek epoch turu var: `O(A×E + D)` (D debris), fakat yüksek tekrar katsayısı. Mevcut özel asteroid üretim/hour ve HMAC ID cache'leri var; üretim her istekte sıfırdan yapılıyor demek yanlış.

**Öneri:** tek traversal'da keşfedilmiş/keşfedilmemiş ayrımını üretip next-contact hesabına aynı sonucu vermek. Sonra oyuncu sensör sürümüne bağlı ilk temas zamanlarını cache'lemek; zaman geçince yeniden çözmek yerine `discoveredAt <= now < expiresAt` kontrolü. Saat/field generation, sensor epoch kapanması, keşif epsilon'u, asteroid spawn gate'i, expiry ve yeni epoch invalidation'ı test edilmeli. Ore miktarı claims sürümünden, debris decay saatten güncellenmeli. Isotope görünürlüğü research'e bağlı olduğu için araştırma sürümü veya ayrı DTO katmanı gerekir.

**Cache sınırı:** Ham field/claims/debris sezon bazında; keşif oyuncu bazında. Son kullanıcı asteroid listesini season anahtarıyla paylaşmak bilgi sızdırır. Ore/expiry/nextFieldChangeAt içeren final JSON'a uzun sabit TTL koymak da yanlış.

## 6. `/api/galaxy/events`

**En net gereksiz istek bulgusu:** `keys.galaxy = ['galaxy']`, `keys.galaxyEvents = ['galaxy','events']`. `refreshQueries` varsayılan prefix eşleşmesiyle invalidate ediyor. Bu nedenle yalnız harita için gönderilen world/score gibi olaylar aktif events sorgusunu da refetch ediyor.

Bunu gerçek QueryClient + aktif QueryObserver ile çalıştırdım: map invalidation map **ve events** queryFn'lerini birer kez çağırıyor; `exact:true` ile ikinci çağrı yalnız map'i yeniliyor. Test + mevcut refresh testleri **8/8 geçti**. 877 ile 880 sayılarının yakınlığı uyumlu ama bütün events isteklerinin bundan geldiğini kanıtlamıyor.

**Düzeltme:** events'e bağımsız kök anahtar vermek veya yalnız harita invalidation çağrılarını exact yapmak. Her invalidate'a topluca exact eklenmemeli; `planet`, `pirates` gibi prefix'ler bilinçli olarak birden fazla özel sorguyu yeniliyor. Galaxy-event lifecycle olayları events'i yenilemeye devam etmeli.

**Zincir/SQL:** route iki fonksiyonu paralel çağırıyor: `activeGalaxyEvents`, `nextPublicGalaxyEvent`. İkisi de account→player→season sorgusunu ayrı yapıyor. Aktif live fixture'da toplam 4 domain SELECT: iki bağlam okuması, active occurrences, sonraki public fixed event. Ruleset/live durumu erken dönerse sayı azalabilir.

**Cache:** Bu iki sonuç aynı sezondaki oyuncular için ortaktır. Auth/placement kontrolünü koruyarak season context'i bir kez çöz; aktif ve izinli sonraki olayı season+ruleset/config revision ile cache'le. En yakın start/end sınırı cache geçerliliğinin üst sınırı olmalı; event lifecycle, sezon ve config değişikliği invalidation göndermeli. Gizli rastgele gelecek olaylar veya asteroidKey istemciye çıkmamalı.

**Plan/indeks:** Active sorgu 648 occurrence'ı tarıyor, mevcut anda sonuç sıfır. `(season_id, ends_at, starts_at)` deneyinde 9 tur medyan **0,146→0,038 ms**, buffer **32→2**. Sonuç eşdeğerliği doğrulandı fakat aktif eventli dal ayrıca benchmark edilmedi. Mutlak kazanç 0,108 ms; yeni indeksin yazma/depolama maliyetini haklı çıkaran yoğunluk kanıtı yok. İlk öncelik iki bağlam sorgusu ve gereksiz HTTP çağrısını kaldırmak. Next-public sorgu mevcut index ile 0,049 ms / 3 buffer; şu anda indeks sorunu görünmüyor.

**Complexity:** Dönen event sayısı G için DTO üretimi O(G), tür başına rota üretimi ayrıca var. Mevcut active SQL planı tablo taraması nedeniyle O(tüm occurrence sayısı); next query index + LIMIT yolu kullanıyor.

## 7. `/api/galaxy`

**Zincir:** commander → season ruleset → monument facts + HP radiation → ortak worlds, özel telescopes/sensors/memory/clan presence, admin listesi, kendi faults, radiation → podium → UNKNOWN/REMEMBERED/RESOLVED redaction.

PublicWorlds cache'i olmasına rağmen monuments, radiation, admin/podium gibi yardımcı veriler ve özel teleskop işi ayrı okunuyor. Soğuk publicWorlds ana join planı 166 dünya / **1,208 ms / 224 buffer**; buildings 0,758 ms; satellites 0,210 ms. Bu yerel veride tek büyük SQL'in yüzlerce ms sürdüğü gösterilmedi. Warm sentetik route'ta 16 ifade kalmıştı; gerçek oyuncunun watch/klan/anıt durumuna göre değişir.

**Bekleme zinciri:** season ve monument/radiation aşaması bitmeden diğer bağımsız Promise.all grubu başlamıyor. Season context'i ortaklaştırıp gerçekten bağımsız yüklemeleri aynı aşamada başlatmak wall time'ı azaltabilir. Havuz tüketimi ölçülerek yapılmalı; sınırsız paralellik değil.

**Kilit bulgusu:** `readPublicMonumentFacts → assertMonumentAvailable → lockSeason(..., false) → FOR SHARE`. Buradaki false kilidi kapatmıyor, `requireLive` kontrolünü kapatıyor. EXPLAIN'de `LockRows` görülüyor. Okuma sezon güncellemesiyle çekişebilir; shared lock okurları birbirini normalde engellemez. Prod'da gerçekleşmiş lock-wait oranı ölçülmedi. Sezon tutarlılığı korunarak salt snapshot okuma yoluna ayrılması değerlendirilmelidir.

**Algoritmik bulgu:** `monumentView.ts:199–200` her M anıt için waves.filter ve lots.filter içinde waves.some yapıyor: worst-case `O(M×W + M×L×W)`. Önce waveId→monumentId, sonra monument→waves/lots Map'leriyle gruplamak `O(M+W+L)` yapar. Ayrıca controller isimlerinin find aramalarını Map'e çevirmek mümkün. Mevcut kopyada 8 anıt, 4 wave, 9 lot; bugünkü maliyeti küçük, büyüme problemi somut. Radyasyon hesabı bu complexity'ye dahil değil.

Galaksi görüş projeksiyonu temel olarak N dünya × S sensör; podium sıralaması O(N log N). Watch sayısı ve özel hedef projeksiyonları ayrıca maliyet getirir. Teleskop okumaları lastConfirmedAt yazabildiği için bütün GET'i değişmez salt veri gibi cache'lemek doğru değil.

**Cache önerisi:** season/ruleset, admin exclusion, podium, radyasyon kaynakları ve anıt ham facts için sürümlü sezon cache'i. Anıt pozisyonu/radyasyon dozunu şu an için projekte et; hareket eden final DTO'yu uzun TTL ile dondurma. Honor/score/skin, monument/control, radiation, admin policy ve season olaylarını ilgili cache'lere bağla. Teleskop hedef snapshot'ı gerekiyorsa hedef state sürümü + okuyucu yetkisiyle ayrılmalı; teyit yazısının anlamı korunmalı.

**Kesin sınır:** Aynı dünya bir oyuncuda UNKNOWN, diğerinde REMEMBERED, üçüncüsünde RESOLVED olabilir. Son galaxy JSON'unu ortak season cache'ine koymak kabul edilemez.

## 8. `/api/planets/:id`

**Zincir:** kimlik/sahiplik → read-only repeatable-read transaction → `loadPlanetViewData` / `loadPlanetViewState` → planet/season/building/satellite/unit/fault/economy/radiation → commander research/queue/colonies/clan/honor → assets/orders/convoy/dock/bays/clan support/workshop → transaction sonrası `buildPlanetView`.

**Asıl aday sorgu sayısı:** Önceki sıcak sentetik route ölçümü 41 ifade. Gerçek kopya service planlarında aynı planet/season/core/radiation verilerine tekrar dönüşler var. Ayrı sorguların çoğu çok kısa; bays count 0,433 ms / 43 buffer, spent convoy join 0,108 ms / 73 buffer, bu oyuncuda research JSON sorgusu 0,103 ms. Başka oyuncunun 573 raporlu geçmişinde research daha pahalıydı; tek oyuncuyu bütün prod için temsilci saymıyorum.

**SQL tasarımı:**

- Tek transaction içinde planet/season/shard/core/radiation context'ini alt fonksiyonlara geçirmek; zaten okunmuş satırları tekrar SELECT etmemek.
- Commander research/unlocks, clan membership ve honor policy'yi world state'ten ayırmak. Hesap/oyuncu+season+revision ile cache; research completion, battle-derived discovery, clan/honor ve placement değişikliklerinde invalidation. Aynı snapshot garantisini cache ile bozma: sürüm tutarlılığı kurulmadan transaction dışı eski commander verisini içine koyma.
- Araştırma keşfi için battle_reports JSON round SUM'u tekrar tekrar taranıyor. Aynı SUM'u bir kez üretmek; daha kalıcı çözüm, savaş sonucu yazılırken discovery fact/hasUnlock türetip mevcut tarihçe için backfill yapmak. Aynı transaction, idempotency, mevcut hesapların kazanılmış hakları korunmalı. Önceki EXPLAIN karşılaştırmaları ara raporda; bu tur yeni kazanç yüzdesi ölçülmedi.
- Gezegen listesiyle detay aynı eventte yenileniyor. Liste yanıtı zaten individual cache'i besliyor. Tam güncel liste alındığında detay için aynı state'i ikinci kez istememek; yalnız ilgili dünya değiştiyse detay patch'ini listeye aktarmak. SnapshotAt/versiyon geriye gidiş koruması korunmalı.

**CPU:** `buildPlanetView` birimlerde O(U), queue filtrelerinde sabit sayıda O(Q), strategic asset gruplarında sıralama O(B log B). Araştırma ve ekonomi/radyasyon yardımcı maliyetleri ayrıca var. Döngü birleştirmek sabit katsayıyı azaltabilir; mevcut kanıt 41 ifadeyi azaltmanın önüne bu mikro işi koymayı desteklemiyor.

**Cache sınırı:** Kaynaklar, radiation hasarı, readyAt ve kuyruklar zamanla değişir. Final JSON'a uzun TTL yerine private state snapshot + timestamp/rates + revision ve olay invalidation kullan. Yanıt cache'inde player/world/season/ownership revision bulunmalı; sahiplik değişince eski sahibine içerik dönmemeli. Mutasyonlar güncel DB ve kilitleri kullanmaya devam etmeli.

**İlk beş dışındaki kritik komşu:** `/api/planets` 745 istek, p50 **328**, p95 **794**, p99 **1.368 ms**. Toplam request-time 279,836 saniye; detayın 154,760 saniyesinden fazla. Bunlar CPU saniyesi değil. Sırf sayıda ilk beşe girmedi diye ertelenmemeli: dört dünya fixture'ında 113 SQL; dünya tablolarını toplu yükleme burada daha büyük potansiyel taşıyor.

## 9. Socket/SSE kararı

Bugün sistem zaten SSE ile olay gönderiyor; eksik olan her olaydan sonra tekrar tam GET yapılması. Aynı full-query işini WebSocket mesaj handler'ına taşımak SQL ve projeksiyon maliyetini kaldırmaz.

Önerilen sıra:

1. Hatalı/geniş invalidation'ları düzelt. Özellikle map→events ve list+detail tekrarları.
2. Sezon ortak snapshot'larını ve private read model'lerini sürümle; her istemciye yalnız yetkili DTO üret.
3. Mevcut SSE üzerinden küçük state delta'ları taşı: private world/queue değişimi, public event lifecycle, yetkili traffic contact değişimi. Hareket için rota/zaman projeksiyonunu koru.
4. Sequence/cursor, reconnect snapshot, versiyon boşluğu halinde refetch, out-of-order/duplicate event, visibility kaybında remove, bounded queue/backpressure tanımla. Kimlik/placement değişince stream kapsamı yeniden doğrulansın.
5. Sağlıklı canlı bağlantıda polling'i azalt; bağlantı/sürüm kaybında kontrollü fallback. Trafik bearing ve discovery sınırları test edilmeden polling kapatılmamalı.

WebSocket ancak gerçekten çift yönlü düşük gecikmeli komut akışı gerekiyorsa ayrıca seçilmeli. Mevcut tek yönlü bildirim yükü için protokol değişikliği ön koşul değil.

## 10. Uygulama önceliği ve kabul ölçümleri

| Sıra | İş | Beklenen somut değişim | Doğrulama |
|---|---|---|---|
| 1 | Galaxy/events invalidation ayrımı | World/score olayı events HTTP isteği üretmez | Aktif observer testi + istemci trigger sayacı |
| 2 | Gezegen context paylaşımı, liste batch, list/detail tek yenileme | Aynı verinin SQL ve HTTP tekrarları düşer | Soğuk/sıcak SQL sayısı; 1 ve 4 dünya; API p95 |
| 3 | Events tek context + sezon cache | Warm domain SQL kaldırılır/azalır | Başlama/bitiş sınırı, ruleset, rollover, cache miss sayısı |
| 4 | Galaxy yardımcı ortak cache'leri ve read-lock ayrımı | Her oyuncuda aynı DB işi azalır | Lock wait, SQL sayısı, 3 replica invalidation |
| 5 | Mining discovery tekrarını kaldırma; HP lethal memo | Aynı hesaplar tekrar çalışmaz | Gerçek field/epoch/cohort CPU benchmark + eşdeğerlik |
| 6 | Yetkili SSE delta ve revision | Trafik GET sayısı ve response bytes azalır | İstek/aktif oyuncu-dakika; boşluk/reconnect/görüş testleri |

Sıralama ölçülen istek dağılımı ve somut kod tekrarlarına dayanıyor. Yüzde hızlanma veya kaç eşzamanlı oyuncuyu kaldıracağı henüz ölçülmedi; sayı uydurmuyorum. İndeks eklemek bu beş endpoint için tek başına ana çözüm görünmüyor.

## 11. Kalan incelemeler

- Endpoint span'leri: auth/placement, SQL bekleme, projection CPU, serialization, response-write ayrımı. Şu an prod p95'in ne kadarı CPU/SQL/network, doğrudan ayrıştırılamıyor.
- HTTP tetikleyici dağılımı: poll/SSE/focus/reconnect/mutation. Tam kaç gereksiz çağrının kaldırılacağı bununla ölçülmeli.
- Uzun sensor history, kalabalık filo/monument lots ve aktif galaxy-event fixture'ları. Şimdiki MAIN örneği 53 oyunculu ve çoğu görev geçmişte.
- Trafik radyasyon çözümü CPU flamegraph; HP lethal memo anahtarının bütün bağımlılıkları.
- Yeni cache'lerin tüm mutation writer'larına karşı invalidation matrisi; özellikle capture, relocation, fault, research, clan, honor, radiation, rollover ve 3 replica reconnect.
- Rehberdeki indeks adayı yalnız boş active-event sonucu üzerinde karşılaştırıldı; bu yüzden migration önerisi değil.
- Tam beş route'un aynı oyuncu setinde cold/warm uçtan uca benchmark'ı ve eşzamanlı yük testi yapılmadı. Önceki sentetik route SQL sayıları ve gerçek kopya service planları birbirinden ayrıdır.

Kanıt dosyaları: [yeni SQL planları](evidence/top-endpoints-2026-10-26/top-plans.json), [SQL karşılaştırmaları](evidence/top-endpoints-2026-10-26/top-comparisons.json), [cache sayaçları](evidence/top-endpoints-2026-10-26/cache-totals.json), [QueryClient kanıt testi](evidence/top-endpoints-2026-10-26/zz-endpoint-prefix-audit.test.ts.txt), [önceki ayrıntılı rapor](architecture-performance-audit-2026-10-26.md).

Yeni analiz testleri: log parser 2, capture contract 1, comparison contract 1, QueryClient kanıtı ve mevcut refresh testleri 8; toplam 12 başarılı test. Geçici harness'ler kanıt klasöründe metin olarak saklandı; ürün test keşfine eklenmedi. Yerel ölçüm container'ı iş sonunda durduruldu; üretimde restart/deploy yapılmadı.
