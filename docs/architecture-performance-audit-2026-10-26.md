# Astera Online — Mimari, cache ve sorgu performansı incelemesi

Tarih: 26 Ekim 2026. Durum: **Ara rapor; inceleme kullanıcının isteğiyle durduruldu.**

## 1. Sonuç

Sistemde cache ve canlı iletişim zaten var. Temel eksik, bunların kapsamı: bazı paylaşılan veriler her kullanıcı için yeniden okunuyor; özel gezegen görünümü çok sayıda sorgudan kuruluyor; SSE çoğunlukla veri yerine yeniden okuma sinyali taşıyor. Bu nedenle mevcut cache başarılı çalışsa bile önemli bir SQL ve HTTP yükü kalıyor.

Öncelik sıram:

1. Bildirim sorgusunun indeks/sıralama uyumsuzluğunu düzeltmek. Üretim kopyasında güçlü, ölçülmüş kazanç var.
2. Gezegen listesi ve detayındaki tekrarları azaltmak; ortak verileri transaction içinde bir kez okumak, dünyalara ait tabloları toplu yüklemek.
3. Galaksi yanıtının cache dışında kalan ortak parçalarını cache kapsamına almak; oyuncuya özgü görüşü ayrı hesaplamak.
4. SSE olaylarının yol açtığı gereksiz okumaları azaltmak; liste ve detay yenilemelerini birleştirmek.
5. Sürüm ve yeniden bağlanma sözleşmesi kurulduktan sonra yetkili küçük değişiklikleri canlı kanaldan taşımak.

**Bütün fetch çağrılarını WebSocket'e çevirmek ilk çözüm değil.** Aynı sorgular ve tam yanıt üretimi korunursa taşıma protokolünü değiştirmek asıl maliyeti kaldırmaz. Mevcut SSE, sunucudan istemciye veri değişikliklerini de taşıyabilir. Arena zaten ayrı WebSocket mimarisi kullanıyor.

Uygulama koduna, migration'lara veya üretim yapılandırmasına kalıcı değişiklik yapılmadı. Aşağıdaki iyileştirmeler uygulanmış ürün değişikliği değil, inceleme sonuçlarıdır.

## 2. Kaynaklar, yöntem ve sınırlar

- `/home/yildirim/Desktop/Astera-Mimari.html` içindeki tüm diyagramların veri tanımlarını okudum. Dosyaya gömülü **345 kaynak dosyasını** çalışma ağacıyla karşılaştırdım; fark çıkmadı. Bu karşılaştırma, 345 dosyanın tamamının ayrıntılı denetlendiği anlamına gelmez.
- `CLAUDE.md`, mimari ve ilgili deployment kurallarını okudum. İncelenen yerel HEAD `ac4582b6`; çalışma ağacında önceden var olan çok sayıda kullanıcı değişikliği bulunuyor. Bulgular yalnız HEAD'e değil, mevcut çalışma ağacına aittir.
- Gerçek servis çağrılarının ürettiği SQL'i Drizzle logger ile yakaladım. PostgreSQL 16 üzerinde `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` çalıştırdım.
- Kullanıcının izniyle üretimden `pg_dump` aldım. Üretimde yalnız okuma ve dump yapıldı; indeks, migration, restart, veri güncellemesi veya `EXPLAIN ANALYZE` çalıştırılmadı.
- Kopya, ayrı yerel PostgreSQL container'ına açıldı: 1 CPU sınırı, 1 GiB bellek, 128 MiB shared buffers, 4 MiB work_mem. İstatistikler yerelde `ANALYZE` ile oluşturuldu. Uygulama/worker bu kopyaya sürekli bağlı çalıştırılmadı.
- SQL karşılaştırmaları iki ısınma turundan sonra dokuz ölçümün medyanıdır. Tek bağlantı ve sıcak buffer koşullarıdır; canlı sunucu p95/p99, soğuk disk veya eşzamanlı yük ölçümü değildir. Buffer sayısı toplam erişimi ifade eder; benzersiz disk sayfası sayısı değildir.
- Son yakalamada **102 başarılı SQL planı** kaydedildi. Bazıları farklı çağrı zincirlerinde tekrar eden sorgulardır; 102 farklı endpoint değildir.
- Yeni araştırma harness'leri yalnız ölçüm içindi; otomatik test dizininden çıkarılıp kanıt klasörüne metin olarak taşındı. Ürün implementasyonu yapılmadı.

Üretim kopyasının hacmi:

| Veri | Sayı |
|---|---:|
| Oyuncu | 788 |
| Gezegen | 1.020 |
| Görev | 39.473 |
| Aktif görev | 13 |
| Savaş raporu | 3.788 |
| Bildirim | 272.012 |
| Zamanlanmış olay | 215.805 |
| Bekleyen olay | 1.345 |

Oyuncuların 735'i WAITING, 53'ü dolu MAIN sezonunda. Bu nedenle 788 oyunculuk kopya, 788 aktif MAIN oyuncusunun yükünü temsil etmiyor. İlk SQL yakalaması en kalabalık WAITING sezonundaydı; son kanıt dosyası aktif MAIN sezonu seçilerek yeniden üretildi. Büyük galaksi davranışına dair ayrı WAITING ölçümleri sonuç tablosuna karıştırılmadı.

## 3. Nereleri inceledim?

| Alan | Takip edilen kod / akış | Kapsam |
|---|---|---|
| Cache altyapısı | `services/asyncCache.ts`, `services/projections.ts`, `stream/bus.ts`, env ve Compose | Anahtarlar, TTL, single-flight, invalidation, kopma davranışı |
| Galaksi ve görünürlük | `routes/galaxy.ts`, `publicGalaxy.ts`, `intel.ts`, `sensorHistory.ts` | Ortak gerçekler, UNKNOWN/REMEMBERED/RESOLVED, teleskop, oyuncu belleği |
| Özel gezegen | `routes/planet.ts`, `planet.ts`, `planetView.ts`, `researchState.ts`, `flight.ts` | Liste/detay yükleme zinciri, salt okuma transaction'ı, araştırma ve uçuş sorguları |
| Trafik | `services/traffic.ts`, galaksi trafik route'u | Ortak snapshot, aktif görev tabloları, kişisel filtreleme |
| Ek galaksi bileşenleri | `honorPodium.ts`, `honorBenefits.ts`, `clan.ts`, `monumentView.ts`, `radiationSources.ts` | Cache dışında kalan ortak/özel okumalar |
| İstemci veri akışı | `api/queries.ts`, `world.tsx`, `planetCache.ts`, `refreshQueries.ts`, `keys.ts` | Polling, liste→detay aktarımı, stale yanıt koruması, çakışan refresh |
| Canlı akış | `useEventStream.ts`, `shardEvents.ts`, `routes/session.ts` | Olay→query eşlemesi, coalescing, reconnect, frame doğrulaması |
| Kimlik ve placement | `app.ts`, `routes/auth.ts`, `placementGate.ts` | Okuma başına doğrulama ve küçük ayrı havuz |
| Bildirim/rapor | `session.ts`, `reports.ts`, araştırma görünümü | Son N sorguları, indeksler, tarihçe maliyeti; rapor zinciri kısmen |
| Worker | `worker/queue.ts`, `worker/loop.ts` | Claim SQL, sıralı çözümleme, bakım/bot sırası; ayrıntılı handler profili yok |
| Operasyon | `runtimeMetrics.ts`, health, Nginx, production Compose | Mevcut metrikler, havuz/cache varsayılanları, sıkıştırma |

## 4. Mevcut mimaride doğru çalışan parçalar

- API başına sınırlı bellek cache'i ve aynı anahtar için tek yükleme Promise'i var. Devam eden yükleme invalidation alırsa eski sonucu yeniden kullanmama mekanizması bulunuyor.
- Varsayılan ortak TTL: galaksi 30 saniye; trafik, mining ve pirates 5 saniye. Commander/sensors/memory katmanı da cache'li. Bunlar yapılandırma varsayılanları; canlı env değerlerini ayrıca doğrulamadım.
- LISTEN sağlığı bozulduğunda cache bypass ve reset var. Yerel invalidation, aynı API sürecindeki SSE teslimatından önce çalışıyor.
- Görüş filtreleri sunucuda uygulanıyor. Ortak snapshot ile oyuncuya özel görüşün ayrılması doğru temel.
- Özel gezegen GET'leri repeatable-read, read-only snapshot kullanıyor; lazy economy okuma sırasında DB'ye yazılmıyor. Saf yanıt üretimi transaction sonrasına taşınmış.
- Teleskop teyitleri hedef başına tek tek değil, toplu SQL ile ve 15 saniyelik eşikle yazılıyor. Burada eski N+1 problemini yeniden varmış gibi değerlendirmek yanlış olur.
- İstemcide query cache, mutation yanıtından doğrudan güncelleme, geç gelen gezegen snapshot'ına karşı koruma ve refresh birleştirme var.
- Gemi konumları her frame ağdan gelmiyor; rota ve zaman bilgisiyle hesaplanıyor. Bu korunmalı.
- Nginx yapılandırmasında JSON gzip mevcut. Sıkıştırma yokmuş gibi bir öneri yapmıyorum.
- Route latency/bytes, event loop/GC, pool, placement pool, cache ve stream ölçümleri mevcut. Eksik olan her şeyin sıfırdan gözlemlenebilirliği değil; sorgu fingerprint'i ve olay başına toplam maliyet gibi daha ayrıntılı ilişkilendirme.

## 5. Endpoint başına ölçülen SQL işi

İzole sentetik fixture: beş oyuncu; bir oyuncuda dört dünya, bir uygun teleskop hedefi. Aktif uçuş, klan, Honor ve anıt yok. Sabit saat. İkinci okuma sıcak cache ile yapıldı. Ruleset 16 yolu da ayrıca açıldı; bu, tam üretim sezonu fixture'ı değildir.

| Endpoint | Sıcak okumada SQL ifadesi — ruleset 16 |
|---|---:|
| `/api/planets` — dört dünya | **113** |
| `/api/planets/:id` | **41** |
| `/api/galaxy` | **16** |
| `/api/intel` | **14** |
| `/api/session/pending` | **14** |
| `/api/leaderboard` — Honor kapalı | 5 |
| `/api/galaxy/traffic` | **3** |

Sayılar ana Drizzle handle'ını kapsar; placement'ın ayrı bağlantısı, EventBus, BEGIN/COMMIT dahil değildir. `SET TRANSACTION` gibi yakalanan ifadeler dahildir; hepsi SELECT değildir. Auth ve uygun route'larda placement'ın ana DB üzerindeki önce/sonra okumaları dahildir. Bunlar üretim latency rakamları değildir.

**Çıkarım:** Trafik cache'i çalışıyor; sıcak trafik okumasındaki üç ifade hesap doğrulaması ve iki placement kontrolü. Özel gezegen görünümünde benzer bir azalma yok. Dört dünyanın yanıtında 15 planet, 8 season, 13 building, 8 satellite, 8 fault, 8 convoy okuması görüldü. Commander araştırması zaten bir kez paylaşılıyor; sorun kalan dünya başına tekrarlar.

Öneri: Önce tek snapshot içinde season/shard/commander bağlamını paylaşmak; buildings, satellites, faults, queues, assets ve convoy uygunluğunu `planet_id IN (...)` ile toplu okuyup dünyalara dağıtmak. Salt `Promise.all` sorgu sayısını azaltmıyor. Tek transaction bağlantısındaki eşzamanlı çağrıların ayrı DB bağlantılarında paralel çalıştığını da varsaymamak gerekir.

Kanıt: [query-counts.json](evidence/architecture-audit-2026-10-26/query-counts.json), [ölçüm testi](evidence/architecture-audit-2026-10-26/query-count-harness.ts.txt).

## 6. EXPLAIN ile doğrulanan SQL iyileştirmeleri

### 6.1 Bildirimler — en güçlü ölçülmüş aday

Kaynak: `services/session.ts:1250`, `db/schema.ts:4479`.

Mevcut sorgu `WHERE player_id = ? ORDER BY created_at DESC LIMIT 30`. İndeks `(player_id, seen, created_at)`. `seen` filtrelenmediğinde indeks global zaman sırasını doğrudan sağlamıyor. Planda **8.679 satır bitmap taraması → top-N sort → 30 sonuç** var.

| Yöntem | Execution medyanı | Buffer erişimi |
|---|---:|---:|
| Mevcut sorgu, 8.679 bildirimli oyuncu | 3.958 ms | 3.040 |
| Aynı sorgu + `(player_id, created_at DESC)` | **0.031 ms** | **27** |
| Mevcut indeksle iki seen dalı + UNION ALL | **0.064 ms** | **30** |
| Mevcut sorgu, 280 bildirimli medyan oyuncu | 0.306 ms | 284 |
| Medyan oyuncu + yeni indeks | **0.038 ms** | **33** |

Yeni indeksin kopyadaki boyutu **10.420.224 byte**, yaklaşık 9,94 MiB. Ek yazma ve bakım maliyeti var; insert/mark-seen benchmark'ı yapılmadı. Mevcut indeks unseen filtresi için faydalı olduğundan doğrudan silinmemeli.

İndeks eklemeden alternatif: `seen=false` ve `seen=true` dallarında ayrı ayrı son 30'u al, `UNION ALL`, dışarıda son 30'u seç. `seen NOT NULL` olduğu için dallar ayrık. En fazla 60 aday sıralanır. Kopyadaki sonuç ID'leri aynı çıktı. Eşit timestamp'lerde mevcut sorgunun da kesin tie-breaker'ı yok; uygulamadan önce deterministik sıralama sözleşmesi ve eşit zaman testleri eklenmeli.

**Tercih:** Basit sorguyu koruyan yeni zaman indeksi birinci aday. Migration/write maliyeti tercih edilmiyorsa iki dal seçeneği güçlü alternatif. Bu ~128 kat SQL execution farkıdır; tüm endpoint veya oyun için 128 kat hız iddiası değildir.

### 6.2 Araştırma keşfi — her gezegen okumasında rapor tarihçesi

Kaynak: `services/researchState.ts:133`.

`shieldInsight` sorgusunda `jsonb_array_elements(rounds)` üzerinden aynı attackerDamage SUM iki ayrı scalar subquery'de hesaplanıyor. Üretim kopyasında 573 raporlu saldırgan için iki aggregate'in her biri 26 kez çalıştı.

| Yöntem | Execution medyanı | Buffer erişimi |
|---|---:|---:|
| Mevcut | 0.352 ms | 92 |
| MATERIALIZED aday CTE, JSON toplamı bir kez | 0.298 ms | 92 |
| Mevcut + `(attacker_player_id, shield_absorbed)` | 0.241 ms | 26 |
| Tek toplam + aynı indeks | 0.210 ms | 26 |
| Keşif bulamayan 44 raporlu oyuncu: mevcut | 0.160 ms | 44 |
| Aynı negatif sorgu + indeks | 0.109 ms | 6 |

Keşif boolean'ı, en çok raporu olan 20 saldırganda rewrite ile aynı çıktı. Bu test tüm oyun senaryolarını kapsamaz. Ölçülen mutlak kazanç küçük; bildirim kadar öncelikli değil. CTE'nin olası materialization maliyeti farklı veri dağılımlarında ayrıca kontrol edilmeli.

Daha önemli mimari seçenek: keşif bilgisi her gezegen yanıtında tarihçeden tekrar türetilmesin; oyuncuya ait araştırma görünümünde cache'lensin ve ilgili rapor/araştırma olayıyla invalidation alsın. Kalıcı discovery read model düşünülürse mevcut geçmişten türetme kuralı, sezon/transfer davranışı ve bütün rapor yazıcıları önce incelenmeli. Henüz tasarlanmış veya doğrulanmış bir uygulama değildir.

### 6.3 Rapor listesi — OR ve geniş satırların sıralanması

Kaynak: `services/reports.ts:474`.

İki katılımcı dalı için sınırlı deney:

| Yöntem | Execution medyanı | Buffer erişimi |
|---|---:|---:|
| attacker OR defender → sıralama → LIMIT 20 | 0.760 ms | 600 |
| Her dalda LIMIT 20 → UNION → dış LIMIT | 0.613 ms | 35 |

Sonuç ID'leri kopyada eşit. Buffer düşüşü anlamlı, süre kazancı daha küçük. Destekçi ve ortak savaş katılımcı dalları bu rewrite deneyine dahil değil. Gerçek endpoint yalnız son raporları değil, rakip özeti için geniş tarihçeyi de okuyor; LIMIT optimizasyonu bu ikinci maliyeti çözmez. ID/zaman adaylarını seçip geniş rapor satırlarını sonradan yükleme ayrıca denenmeli.

**Eksik doğrulama:** Çalışma ağacındaki yeni replay okuması üretim kopyasında olmayan `battle_replays` tablosuna erişti; reports çağrı zinciri `42P01` ile kesildi. Bu, yerel kod/üretim şeması farkıdır; üretimde rapor endpointi bozuk sonucunu çıkaramayız. Kopyaya migration uygulamadım. Reports için uçtan uca güncel maliyet henüz ölçülmüş değil.

### 6.4 Denendi ama şu anda önerilmeyen indeksler

Aktif missions için origin/target/owner partial indeksleri birlikte denendi:

| Sorgu | Önce → sonra execution | Buffer |
|---|---:|---:|
| Uçuş bay sayacı | 0.459 → 0.541 ms | 43 → 39 |
| Ortak trafik missions okuması | 0.055 → 0.080 ms | 15 → 15 |
| Pending görev join'i | 0.214 → 0.269 ms | 71 → 61 |

Bu dağılımda fayda kanıtlanmadı. Mevcut `(status, arrive_at)` indeksi 39.473 görev içinde yalnız 13 aktif göreve etkili erişiyor. Büyük tablo var diye yeni indeks eklemek doğru değil. Daha yüksek aktif uçuş sayısında yeniden denenebilir; şimdilik migration önermiyorum.

Worker aday seçimi için `WHERE status='pending'` koşullu `(resolve_at, ref_id, id)` indeksi: **0.211 → 0.162 ms**, buffer **266 → 266**. Deney yalnız `SELECT ... FOR UPDATE SKIP LOCKED LIMIT 100` seçim bölümünü kapsıyor; tam claim UPDATE/WAL veya eşzamanlı worker testi değil. Küçük kazanç; öncelikli değil.

Kanıtlar: [yakalanan 102 plan](evidence/architecture-audit-2026-10-26/captured-plans.json), [ana karşılaştırmalar](evidence/architecture-audit-2026-10-26/comparisons.json), [ek karşılaştırmalar](evidence/architecture-audit-2026-10-26/extra-comparisons.json). Parametre değerleri ve UUID'ler rapor kanıtlarında maskelendi.

## 7. Cache nerelere eklenmeli?

| Veri | Uygun kapsam / anahtar | Tutarlılık şartı | Öncelik |
|---|---|---|---|
| Sezon kuralları, shard rolü, sabit tarihler | seasonId + konfigürasyon sürümü | Adoption/admin değişiklikleri de invalidation üretmeli | Yüksek; önce request içi paylaşım |
| Ortak ladder tabanı ve podium | seasonId + ranking + yapılandırma sürümü | Skor, kimlik, bot/admin dışlama, klan ve sezon değişimleri | Yüksek |
| Anıtların ham roster/kapasite/kimlik verisi | seasonId; gerekirse monumentId | Dalga, kontrol, üyelik, radyasyon ve sezon olayları | Yüksek |
| Radyasyon kaynakları ve hareket parametreleri | seasonId + revision | Aktiflik sınırları request saatinde uygulanmalı; geçmiş doz aralığı korunmalı | Yüksek |
| Oyuncunun klan görünümü | playerId + üyelik/placement sürümü; ortak roster clanId | Ayrılma/kick/disband, kontrol, posture ve ad değişimleri | Orta |
| Araştırma/keşif ham görünümü | playerId + seasonId + revision | Araştırma bitişi ve yeni uygun savaş raporu | Orta |
| Özel gezegen ham snapshot'ı | ownerPlayerId + planetId + placement/control/state revision | Her yazıcı ve rollback güvenliği kanıtlanmalı; ekonomi şimdiye projekte edilmeli | Toplu sorgulardan sonra |
| Bildirim/rapor sayfası | playerId + filtre/sayfa + revision | Yeni kayıt, seen, izin/üyelik, silme, relocation | İndeks ve sorgu düzeltmesinden sonra |

`routes/galaxy.ts:60` cache isabetinde dahi season, teleskop, klan, Honor podium, fault ve radyasyon okumalarını yapıyor. Anıt dalı `readPublicMonumentFacts → assertMonumentAvailable → lockSeason` üzerinden season SHARE lock da alıyor. Sentetik ruleset 16 ölçümünde anıt yokken bile bu kilit gözlendi. Bu okuma henüz tamamen kilitsiz değildir.

`honorPodium.ts` sıralı tüm uygun oyuncuları okuyup uygulamada ilk üç rank'ta kesiyor. SQL'e sınır taşınabilir, ancak **düz LIMIT 3 yanlış olabilir**: eşit puanlı oyuncular aynı rank'ı paylaşıyor. Eşitlikleri koruyan aday/threshold sorgusu ayrıca ölçülmeli.

İlk aşamada mevcut process-local `AsyncCache` mekanizmasını genişletmek makul. Valkey'e geçiş otomatik çözüm değil: serialization, ağ erişimi, revision ve invalidation sözleşmesi ayrıca gerekir. Üç API'nin tekrar oluşturma maliyeti ölçülmeden ikinci cache katmanını zorunlu saymıyorum. Valkey bugün ağırlıkla rate-limit store.

## 8. Gezegen görünürlüğü: cache ve push için zorunlu ayrım

`publicWorlds` adı, içindeki her alanın bütün oyunculara gönderilebileceği anlamına gelmiyor. Ortak sunucu snapshot'ının çıkışında oyuncuya özel redaction var:

- **UNKNOWN:** yalnız izin verilen konum/kimlik anahtarı ve public moment alanları; güncel sahibin/donanımın tamamı gönderilmez.
- **REMEMBERED:** gelişim ve donanım bilgisi eski probe/battle snapshot'ından gelir. Güncel dünya cache'iyle bu kaydı yenilemek oyuncuya kazanmadığı istihbaratı verir.
- **RESOLVED:** sahiplik veya sensör erişimiyle hak edilen güncel görünüm. Fleet overlay ayrıca teleskop şartlarına bağlıdır.
- Klan üyeliği, tam sensör görüşü değildir. Klan presence alanları ayrı bir yetki katmanıdır.
- `claimPriorityMine`, kendi fault bilgisi, kendi dünyaları, araştırma, kaynak ve filo özel katmandadır.
- Leaderboard'da bile planetId/planetName erişimi oyuncunun keşif/sensör durumuna göre değişiyor. Tam yanıtı seasonId ile ortak cache'lemek yanlış.

Doğru hat: **ortak ham snapshot → güncel yetki/sensör/bellek katmanı → oyuncuya özel projection → HTTP veya canlı mesaj.** Push için de aynı kurallar geçerli. İstemciye ham dünyaları gönderip gizlemeyi UI'a bırakmak kabul edilemez.

TTL tek başına güvenlik mekanizması olamaz. Sensör daralması, dünya kaybı, üyelikten çıkarılma ve placement değişiminde eski yetkili veri yeniden sunulmamalı. Zamanla değişen EMP/koruma/vacation/skin gibi alanların yalnız DB yazısıyla değişmediği de dikkate alınmalı. Mevcut worlds cache'inde EMP bitişi için özel tazeleme var; diğer zaman sınırlarının tamamının doğruluğu bu incelemede test edilmedi.

## 9. SSE / fetch / WebSocket değerlendirmesi

### Ölçülen ve koddan doğrulanan sorunlar

1. `routes/session.ts:219`: **her SSE frame'i**, heartbeat dahil, placement/authVersion için DB okuyor. Native oturumda ek isCurrent kontrolü var. İstemci coalescing'i bu maliyeti azaltmaz; frame zaten gönderim hattına girmiştir. Bir shard olayının N bağlantıya yayılması N doğrulama okuması üretir. Bu formül kod davranışıdır; üretim QPS ölçümü değildir.
2. `shardEvents.ts:154`: build_complete hem planet hem planets yeniliyor. Liste zaten `planetCache.ts:47` ile detay cache'lerini dolduruyor. Aynı olaydaki iki yükleme farklı query key'lerde olduğundan normal tek-query dedup bunları birleştirmez. Aktif observer durumuna göre yinelenen ağ işi oluşabilir.
3. `private:sight` hem galaxy hem intel yeniliyor; ikisi de `readTelescopes` çağırıyor. Aynı olay için aynı kişisel okuma zinciri tekrarlanıyor.
4. `shard:control` geniş private query kümelerini bütün galaksiye yeniletiyor. Anıt kontrolü de bu kind'ı yayımlıyor; planet capture ile monument control aynı geniş invalidation'a bağlanmış.
5. Bilinen build/research gibi olaylar daraltılmış; ancak diğer tanınmayan player olayları geniş LIVE_READS resync'ine düşüyor. Yalnız aktif query'ler refetch edilir; liste uzunluğu kadar her zaman HTTP isteği olduğunu iddia etmiyorum.
6. İlk stream open sırasında resync, snapshot/subscription yarışını kapatıyor; bedeli başlangıç okumalarının tekrarlanabilmesi. Replay cursor veya snapshot revision olmadığı için bunu doğrudan kaldırmak güvenli değil.
7. Replica tutarlılığı için 500 ms/1.500 ms gecikmeler var. Bunlar sürüm ispatı değil; yavaş replica penceresini azaltan zaman tabanlı önlemler.

### Önerilen yön

İlk adım, mevcut SSE üzerinde daha dar olaylar ve request birleştirme. Listeden detay besleme korunmalı; toplu görünüm tazeleniyorsa aynı dünyayı ayrıca istememeli. Dünya ve anıt kontrol olayları ayrıştırılmalı. Teleskop görünümü, büyük galaksi gövdesinden ayrı yenilenebilir bir özel projection olmalı.

Sonraki aşama: domain revision + snapshot revision + yetkili delta. Kısa kopmada yalnız eksik değişiklikleri al; cursor boşluğu/uyuşmazlığında snapshot'a dön. Deltanın placement ve visibility revision'ı uyuşmuyorsa uygulanmamalı. NOTIFY bir wake-up olabilir; replay için kalıcı ve sınırlı saklanan outbox/cursor gerekir. Mevcut genel stream'de bu yok; placement transferine ait özel outbox'ın bulunması genel replay olduğu anlamına gelmez.

SSE frame doğrulamasını kaldırmayı önermiyorum. Güvenli ilk deney, bir flush grubundaki bağlantıları topluca sorgulayarak aynı doğrulama semantiğini korumak. Revocation/placement cache'i düşünülürse bus kopması, silme ve token/session iptali için fail-closed sözleşmesi gerekir; yalnız uzun TTL kabul edilemez.

HTTP: ilk snapshot, komutlar, geçmiş/sayfalama ve recovery için kalabilir. SSE: yetkili güncellemeler için kullanılabilir. WebSocket: çift yönlü yüksek frekanslı arena için zaten yerinde. Ana galakside WebSocket'i zorunlu kılan ölçülmüş bir ihtiyaç henüz yok.

## 10. Worker ve operasyon bulguları

- Worker due olaylarını sıralı `for ... await` ile işliyor; bakım/bot işleri claim'den önce zaman harcayabiliyor. Yavaş bir handler diğer due olayları geciktirebilir. Gerçek handler süreleri ölçülmediği için bunun mevcut ana darboğaz olduğunu söylemiyorum.
- Rastgele paralel worker eklemek önerilmiyor. Aynı hedefe olay sırası, lock düzeni ve bakım singleton'ları var; güvenli paralellik ayrı bir çalışma gerektirir.
- `/api/galaxy` ve `/api/intel` teleskop teyidi yazdığı için placement read allowlist'inde değiller. Ayrı placement pool'u handler boyunca tutuluyor. Varsayılan iki slot/API, bu tür isteklerde kuyruk oluşturabilir; tam API cluster yük testi henüz yapılmadı.
- Mevcut genel sağlık/cache metrikleri korunmalı. Ek ihtiyaç: route başına SQL sayısı/zamanı, query fingerprint, cache fill süresi/byte boyutu, olay başına frame+refetch maliyeti ve domain bazlı worker lateness.
- Üretimde `pg_stat_statements` kurulu değil; mevcut extension listesinde yalnız plpgsql görüldü. Bu yüzden canlı toplam SQL zamanına göre kesin bir sıcak sorgu sıralaması çıkarılmadı. Extension eklenmedi.

## 11. Çalıştırılan doğrulamalar

İzole sentetik test DB'sinde, sırayla ve tek worker ile:

- Server: async-cache, projection-efficiency, planet-view-cost, telescope-query-count, sensor-history-cache, stream-frames — **29/29**.
- Server: event-bus-reconnect, asteroid-api-security, world-memory — **30/30**.
- Web: shard-events, event-stream — **63/63**.
- Geçici SQL sayım harness'i — **1/1**.

Toplam **123 test geçti**. Bunlar bütün projenin testi değildir. Uzun ekonomi simülasyonu, genel verify, tam lint/typecheck, UI/playtest çalıştırılmadı; ürün kodu değiştirilmedi.

Plan karşılaştırmalarında bildirim ve iki taraflı rapor listesi için ID eşitliği; araştırma rewrite'ı için 20 saldırganda discovery boolean eşitliği kontrol edildi. Bunlar production implementasyonunun ihtiyaç duyacağı concurrency/edge-case testlerinin yerine geçmez.

## 12. İncelenmesi gereken eksikler

| Eksik | Neden gerekli? |
|---|---|
| Üretim route/QPS ve SQL toplam zaman dağılımı | Küçük sorgunun çok çağrılmasıyla büyük sorgunun seyrek çağrılmasını karşılaştırmak |
| 3 API + worker eşzamanlı yük, 300/1.000 aktif MAIN oyuncusu | Pool beklemesi, invalidation fırtınası ve gerçek p95/p99; mevcut kopyada 13 aktif görev var |
| Private planet bulk loader önce/sonra prototipi | 113 sorgunun kaça düşeceğini ve tutarlılığın korunduğunu ölçmek |
| Bütün cache bağımlılıklarının yazıcı matrisi | Mutation/worker/admin/adoption/transfer yollarında eksik invalidation bırakmamak |
| Zaman sınırı ve görünürlük daralması testleri | EMP dışındaki timed state, sensör kaybı, üyelik ve relocation yarışları |
| Güncel şemaya taşınmış ayrı kopyada tam reports/replay | Mevcut prod kopyasında battle_replays yok; rapor zinciri tamamlanmadı |
| Leaderboard tam sorgu rewrite/cache ve tie deneyleri | Mevcut sıralama tamamen okunuyor; podium için eşit puanlar korunmalı |
| Chat, DM, clan home/war/support/treasury uçları | Ana sıcak yol dışında detaylı EXPLAIN ve authorization analizi yapılmadı |
| Commerce, admin, auth/security/session tüm sorguları | Bu inceleme tam uygulama/database audit'i değil |
| Worker handler süreleri ve bot sweep profili | Claim seçim süresi tüm worker maliyetini temsil etmez |
| İndeks yazma/WAL/autovacuum etkisi | Bildirim ve araştırma indekslerinin toplam işletim maliyetini görmek |
| Generic prepared plan, soğuk buffer, farklı veri dağılımları | Mevcut EXPLAIN karşılaştırmaları belirli parametrelerle sıcak yerel koşullarda |
| Snapshot sürümü/outbox tasarımının prototipi | Delta replay, duplicate/out-of-order, gap ve auth/placement fence garantileri |
| İstemci parse/render/GC profili ve gerçek payload bütçesi | SQL hızlanması telefonun JSON/React/3D maliyetini tek başına çözmez |
| Production env/aktif Nginx yapılandırmasının karşılaştırılması | Depodaki varsayılanların canlı ayarlarla aynı olduğu henüz doğrulanmadı |

## 13. Devam için önerilen sıra

1. Bildirim optimizasyonunu TDD ile uygulama adayı haline getir; eşit timestamp, unread filtreleri, limit ve mark-seen eşzamanlılığını doğrula. İndeksin yazma maliyetini ölç.
2. Gezegen liste/detay tekrarlarını ve aynı event'in liste+detay fetch'ini kaldıracak tasarımı birlikte ele al. Yetki ve snapshot sınırlarını değiştirmeden toplu loader prototipi ölç.
3. Galaksi ortak yardımcı verileri ve ranking tabanını mevcut projection cache'e taşı; tüm bağımlılık/yazıcı matrisini tamamla.
4. Olay türlerini daralt; frame doğrulamasını toplulaştırmayı ölç. Teleskop ve anıt güncellemelerini büyük harita yenilemesinden ayır.
5. Bundan sonra revision/delta/replay yatırımının kalan HTTP/SQL yüküne değip değmediğini cluster benchmark'ıyla değerlendir.

Bu sıra bir performans garantisi değil, eldeki kanıtlarla önerilen uygulama önceliğidir. **Kullanıcının yeni yönlendirmesi bekleniyor; uygulama veya ek inceleme başlatılmayacak.**

## Referanslar ve kanıtların yeniden kullanımı

- PostgreSQL [çok kolonlu indeksler](https://www.postgresql.org/docs/16/indexes-multicolumn.html): kolon sırası ve eşitlik koşulları.
- PostgreSQL [EXPLAIN](https://www.postgresql.org/docs/16/using-explain.html): plan/actual ayrımı, maliyet ve ölçüm sınırları.
- PostgreSQL [NOTIFY](https://www.postgresql.org/docs/16/sql-notify.html): commit sonrası teslimat, bağlantı dinleyicileri ve payload sınırı.
- WHATWG [SSE](https://html.spec.whatwg.org/multipage/server-sent-events.html): veri taşıma ve event ID protokolü. Kullanılan fetch tabanlı özel parser için replay desteği ayrıca uygulanmalıdır.
- [SQL yakalama harness'i](evidence/architecture-audit-2026-10-26/capture-explain.mjs.txt), [karşılaştırma harness'i](evidence/architecture-audit-2026-10-26/compare-explain.mjs.txt), [ek deneyler](evidence/architecture-audit-2026-10-26/compare-extra.mjs.txt).

Harness dosyaları uygulama server dizininden çalıştırılacak göreli importlar içerir; `.txt` olarak saklanmaları yanlışlıkla test/üretim akışına girmelerini önler. Yerel kopyaya özel bağlantı yolu içerirler; yeniden çalıştırmak için yeni izole kopya ve yerel bağlantı ayarı gerekir. Maskeli planlar kaynak kullanıcı verisi içermez; ham dump ve özel parametreler repo kanıtı değildir.

Teslimde yerel `astera-architecture-audit-pg` container'ı durduruldu. Devam incelemesi için kopya volume'u ve repo dışındaki özel dump `/home/yildirim/.local/state/astera-architecture-audit-20261026` altında tutuluyor; dump/credential dosyaları yalnız kullanıcıya açık izinlerle oluşturuldu. Deployment kuralındaki en fazla 30 günlük özel yedek saklama sınırı bu kopya için de geçerli; otomatik silme kurulmadı. Sentetik test DB'si silindi. Çalışan inceleme/test süreci kalmadı.
