# Kapasite düzeltme planı — 31 Ekim 2026

Kaynak ölçüm: [`reports/capacity-run-2026-10-31.md`](../reports/capacity-run-2026-10-31.md). Bugün bu makine yaklaşık 100 eşzamanlı
oyuncuda yavaşlıyor, ~200'de CPU doluyor. Hedef: aynı makinede 1.000 çevrimiçi (plan §8.2 L3).

**Kurallar:**
- Her madde TDD ile yapılır.
- Kazanç, `~/capacity-run-20261031/diag/final/capacity.dump` (2.000 komutan) üzerinde yerel olarak ölçülür (madde 0). Yeni yük penceresi açılmaz.
- Bütün maddeler bitince tek bir 1.000 oyunculuk kabul koşusu yapılır.
- "Oyun mantığı riski" bölümleri koruyucu testleri adlandırır; o testler kodlamadan önce yazılır.

Yapılan: PostgreSQL ayarı (17:05 UTC, `shared_buffers` 1 GB vb.). Yoklama 5 sn kalır (karar: Claude, owner devretti).

---

## 0. Yerel ölçüm düzeneği (diğer her maddenin ön şartı)

1. **Ne:** `capacity.dump`'ı yerel bir `_test` veritabanına yükleyen küçük bir araç. Araç sıcak rotaları N eşzamanlı komutanla çağırır ve şunları yazar: istek başına CPU (ms), SQL sayısı, yanıt boyutu, p50/p95.
   - Kapsam: `/api/galaxy`, `/api/galaxy/traffic`, `/api/mining/field`, `/api/session/pending`, `POST /api/fleet/launch`, presence.
2. **Neden:** Düzeltmeleri prod'u kapatmadan, aynı veriyle, önce/sonra kıyaslamak için. "Acaba şundan mı" sorusu böyle kapanır.
3. **Kazanç:** Her maddenin etkisi sayıyla görünür; gereksiz iş elenir.
4. **Oyun mantığı riski:** Yok. Yalnız araç; prod'a dokunmaz. Prod verisine bağlanmayı reddeden mevcut koruma (`capacityGuard`) kullanılır.
5. **Daha basit yol:** Mevcut `tools/capacity.mjs`'i yerel, 10–50 kullanıcıyla koşmak. Ama yerel makinede tüm yığını açmak ağır ve CPU ölçümü
   gürültülü. Rota başına mikro ölçüm daha basit ve daha kararlı. **Seçim: rota mikro ölçümü; uçtan uca yalnız son kabulde.**

## 1. Spawn kapısını sıcak sezon satırından çıkarmak

1. **Ne:** Worker 15 sn'de bir `seasons.spawn_gate_through` alanına yazıyor. Bu iki alan (`spawn_gate_from/through`) kendi
   tablosuna (`season_spawn_gates`, sezon başına bir satır) taşınır.
   - Okuyan iki yer: `mining.ts` ve `pirateField.ts`, `spawnGateRead.applySpawnGate` üzerinden. Yazan iki yer: `spawnGate.ts` ve `season.ts`.
2. **Neden:** Her oyun yazması sezon satırını `FOR SHARE` ile kilitliyor. Worker'ın UPDATE'i bütün bu kilitlerin bitmesini bekliyor.
   Beklerken arkasına yeni gelen bütün yazmaları da sıraya sokuyor. 200 oyuncuda yazma başına ortalama 329 ms, 180 sn'de toplam 9,9 sn.
3. **Kazanç:** Galaksideki bütün yazmaların her 15 sn'de bir topluca takılması biter. Hareket p95'ine doğrudan etki; oyuncu sayısı arttıkça büyür.
4. **Oyun mantığı riski:** Düşük–orta. Kapı, asteroit ve korsan doğumunu oyuncu sayısına göre kısıyor.
   - Okuma tarafı yeni tablodan okumalı. Okuyan, sezon satırını zaten elinde taşıyor; yeni tablo bir sorgu daha ya da bir join demek.
   - Satırı olmayan sezon "kapı yok" anlamına gelmeli; bugün `null` ne demekse aynısı.
   - Koruyucu testler:
     - mevcut spawn kapısı testleri yeşil kalır;
     - "kapı satırı yok = bugünkü `null` davranışı";
     - "worker yazarken bir oyun yazması beklemez": sezon satırı `FOR SHARE` tutulurken kapı yazması bloklanmamalı.
   - Migration: alanları yeni tabloya kopyala, eski kolonlar bir sürüm boyunca dursun (geri dönüş için), sonra kaldır.
5. **Daha basit yol:**
   - (a) **Yalnız değer değiştiğinde yazmak.** Kapı dakika çözünürlüğünde; 15 sn yerine dakikada bir yazar. Takılma sayısı ~4× azalır ama her takılma yine 329 ms. Yarım çözüm.
   - (b) **`FOR SHARE` yerine `FOR KEY SHARE`.** Çakışma kalkar ama sezon dondurmayı da engellemez; sezon geçişinin güvenliği bozulur. Reddedildi.
   - **Seçim: ayrı tablo.** Önce (a)'nın gerçekten yetmediği madde 0 ile ölçülür; yetiyorsa (a) yapılır.

## 2. Presence: kilitsiz, koşullu tek yazım

1. **Ne:** `presence.touch` bugün her dakika ve hesap başına bir transaction açıyor: oyuncu satırını `FOR UPDATE` ile kilitliyor,
   dönüş başvurusunu kilitleyip yeniliyor, `last_active_at` yazıyor. Yerine şu gelir:
   - `update players set last_active_at = $now where account_id = $1 and last_active_at < $now - 60 sn`;
   - dönüş başvurusu yalnız açık bir başvuru varsa mevcut kilitli yoldan yenilenir.
2. **Neden:** 200 oyuncuda 2.320 kilitli seçim, ortalama 5 ms, toplam 11,8 sn. Oyuncu satırı oyun yazmalarıyla (`lockClanPlayers` vb.) yarışıyor.
3. **Kazanç:** Oyuncu satırındaki gereksiz kilit kalkar; 2 sorgu + transaction yerine 1 sorgu.
4. **Oyun mantığı riski:** Orta.
   - `last_active_at` şunları besliyor: çevrimiçi sayısı, asteroit/korsan arzı (`countEligibleCommanders`), reclaim, dönüş kuyruğu süresi. Anlamı aynı kalmalı: dakikada en fazla bir yazım, ilk istekte hemen yazım.
   - Dönüş başvurusunun hareketsizlik süresi bugün presence ile uzuyor. Bu bağ kopmamalı.
   - Koruyucu testler:
     - mevcut presence ve dönüş kuyruğu testleri;
     - "açık başvurusu olan oyuncunun süresi yine uzar";
     - "60 sn içinde ikinci istek yazmaz";
     - "presence, oyuncu satırını kilitleyen bir oyun işlemini beklemez".
5. **Daha basit yol:**
   - Presence'ı Valkey'e taşıyıp toplu yazmak daha az sorgu demek ama yeni bir hareketli parça. Çökmede son pencere kaybolur ve arz hesabı Valkey'e bağımlı olur.
   - **Seçim: tek koşullu UPDATE.** Valkey yalnız 1.000+ ölçekte ölçüm isterse.

## 3. `/api/galaxy`'yi yerleşim havuzundan çıkarmak

1. **Ne:** `/api/galaxy` bugün `PLACEMENT_READ_ROUTES` dışında. Gerekçesi, teleskop okumalarını onaylaması (yazma).
   - Önce bu yazmanın tam yeri ve sıklığı bulunur (projeksiyon, `sensorsFor`/izleme zinciri). Yazma kısa, ayrı bir adıma ayrılır: yalnız onaylanacak okuma varsa, kendi kısa transaction'ında.
   - Rota okuma rotaları listesine girer: önce ve sonra yerleşim kontrolü, C2 kuralları.
2. **Neden:** 150 kişilik bir açılış dalgası bile `503 RETRYABLE` ile kırılıyor. Rota istek boyunca 2 slotluk havuzdan bir bağlantı tutuyor, istek ~100 ms sürüyor.
   Deploy sonrası herkesin geri bağlandığı an tam bu.
3. **Kazanç:** Açılış dalgasındaki 503'ler ve havuz kuyruğu biter. Havuzu büyütme ihtiyacı kalkar; araştırmanın önerisi de bu: havuzu
   büyütmek değil, transaction'ı kısaltmak.
4. **Oyun mantığı riski:** Orta–yüksek. Sensör/teleskop kuralları gizlilik ve istihbarat dengesini taşıyor (`docs/review-sight.md` önce okunur).
   - Taşınma (relocation) sırasında galaksi okuması yanlış galaksiyi göstermemeli. Okuma rotası kuralları bunu C2'deki önce/sonra kontrolle sağlıyor.
   - Koruyucu testler:
     - `placement-read.test.ts` (okuma rotası yazmaz, kilitlemez);
     - teleskop onayı aynı sonuçları üretir;
     - taşınma anında 409;
     - mevcut sensör ve istihbarat testleri.
5. **Daha basit yol:**
   - (a) **Havuzu 2'den 4'e çıkarmak.** Ölçüldü: 200'de CPU yine doldu, 150 açılışta yine 503. Sorunu ötelemekten öte bir şey yapmıyor. Reddedildi; F1.6 planındaki "4'e çıkar" kararı geri alınır.
   - (b) **Teleskop onayını tamamen worker'a taşımak.** Daha büyük değişiklik, istihbarat zamanlamasını değiştirir.
   - **Seçim: onayı küçük ayrı adıma ayırmak.**

## 4. Galaksi yanıtı: değişmeyen ve değişen parça, bir kez JSON, ETag/304

1. **Ne:** `/api/galaxy` yanıtı 153 KB. 200 oyuncuda ağdaki toplam baytın %74'ü bu rotadan.
   - **Değişmeyen kısım** (dünya konumları, adlar, renkler, kalıcı nitelikler) sezon başına bir kez, sürümlü adresten, kalıcı önbellekli sunulur.
   - **Değişen kısım** (durumlar, sahiplik, podyum) galaksi değiştiğinde bir kez JSON'a çevrilir ve sıkıştırılır. Hash'i ETag olur, eşleşen istek 304 alır.
   - **Kişisel kısım** (kendi dünyaların, sensörler, izlenenler, talep saati) küçük ayrı bir yanıt olur.
   - İstemci üçünü birleştirir.
2. **Neden:** Bugün her istekte 1.000 dünya üzerinde podyum, admin filtresi ve kişisel işaretler yeniden hesaplanıyor ve 153 KB baştan
   JSON'a çevriliyor. Profilde GC %10, soket yazımı %7, `routes/galaxy` %5.
3. **Kazanç:** En büyük CPU ve bayt kazancı. Beklenti: sık okunan yanıt ~20–30 KB, değişmediyse gövdesiz 304, JSON üretimi istek
   başına değil değişiklik başına. Madde 0 ile ölçülür.
4. **Oyun mantığı riski:** Orta.
   - Gizlilik: kişisel bilgiler (gizli varlıklar, talep sahibi, admin dünyaları) ortak parçaya sızmamalı. Bugün bu filtreler istek başına uygulanıyor; ortak parça yalnız herkese aynı olanı taşımalı.
   - Bot gizliliği (LOCKED): ortak parça bot işareti taşımaz; bugünkü yanıtla aynı alanlar.
   - Koruyucu testler:
     - "birleştirilmiş yanıt bugünkü `/api/galaxy` ile derin eşit" (eşdeğerlik testi, birden çok komutan için);
     - "ortak parça iki farklı komutana bayt bayt aynı";
     - "gizli varlık ve admin dünyası ortak parçada yok";
     - ETag değişmeden 304.
   - İstemci: harita birleştirmeyi tek yerde yapar; ekran değişmez. `useEventStream` okumaları güncellenir.
5. **Daha basit yol:**
   - (a) **Yalnız ETag/304** (yanıtı bölmeden). Kolay ama galaksi sık değiştiği için çoğu istek yine 153 KB üretir. İlk adım olarak değerli, tek başına yetmez.
   - (b) **Yalnız `@fastify/compress`.** Baytı azaltır ama CPU'yu artırır, çünkü sıkıştırma her istekte yapılır. Reddedildi.
   - **Seçim: önce (a) + bir kez JSON (küçük adım), ölçülür; ardından değişmeyen/değişen ayrımı.**

## 5. Galaksi önbelleği: eskiyi sun, arkada yenile

1. **Ne:** Her sezon olayı galaksi önbelleğini tamamen siliyor; bir sonraki okuyucu 51 ms'lik 1.000 satırlık sorguyu bekliyor
   (200 oyuncuda 180 sn'de 67 kez). Bunun yerine olay önbelleği "bayat" işaretler, okuyucu eski değeri alır, tek bir arka plan yenilemesi
   başlar (stale-while-revalidate).
2. **Neden:** Silme ve yeniden doldurma döngüsü okuyucuları bekletiyor ve aynı anda gelen olaylarda gereksiz yeniden dolum yapıyor.
3. **Kazanç:** Okuyucu hiç beklemez. Yenileme sayısı olay sayısıyla değil, en fazla "bir yenileme süresi" ile sınırlanır.
4. **Oyun mantığı riski:** Orta.
   - Bayatlık en fazla bir yenileme süresi (~50 ms) kadar. Ama bir komutanın kendi eylemi (fırlatma, ele geçirme) kendi ekranında hemen görünmeli.
   - Kendi yazmasından sonraki okuma ya taze değeri beklemeli ya da istemcinin kendi tahmini (predict/reconcile) bunu kapatmalı.
   - `AsyncCache`'in tek uçuş ve geçersiz kılma kuralları korunmalı (F1.2 testleri).
   - Koruyucu testler:
     - "olaydan sonraki okuma eski değeri bekletmeden döner, sonraki okuma yeniyi görür";
     - "kendi fırlatmasından sonra komutanın okuması yeniyi görür";
     - mevcut `asyncCache` testleri.
5. **Daha basit yol:**
   - (a) **Yenilemeleri 1–2 sn birleştirmek.** En basit ama okuyucu yine bekleyebilir ve galaksi 2 sn geç kalabilir.
   - (b) **Değişen dünyayı yerinde güncellemek.** En az iş, ama her olay türünün hangi alanı değiştirdiğini bilmek gerekiyor. Kaçırılan alan bayat veri demek.
   - **Seçim: stale-while-revalidate.** Gerekirse ileride (b).

## 6. Trafik okumasını canlı bağlantıya taşımak (plan F3)

1. **Ne:** Her istemci 5 sn'de bir `/api/galaxy/traffic` çekiyor. Bunun yerine trafik değişiklikleri canlı bağlantıdan, sıra numaralı
   olaylarla iletilir. Kaçıran istemci mevcut yeniden senkronizasyon yolu ile anlık görüntü alır. Presence için hafif `POST /api/presence` (F3.7).
2. **Neden:** 200 oyuncuda 180 sn'de 25.343 istek. 1.000 oyuncuda ~200 istek/sn sırf yoklama.
3. **Kazanç:** Okuma trafiğinin en kalabalık kalemi neredeyse sıfıra iner. Hareketler canlı bağlantıyla anında görünür, 5 sn gecikme kalkar.
4. **Oyun mantığı riski:** Orta–yüksek.
   - Trafik görünürlüğü sensör menziline bağlı. Yayın her komutana yalnız göreceğini göndermeli; filtre sunucuda, komutan başına.
   - Presence anlamı korunmalı: ön plandaki ve yalnız izleyen istemci de dakikada bir aktif sayılır (F3.7 eşdeğerlik testi).
   - Koruyucu testler:
     - "canlı akıştan birleştirilen trafik, yoklama ile alınanla eşit";
     - "menzil dışı filo akışta yok";
     - "kopan istemci yeniden senkronize olur";
     - F3.7 presence testi.
5. **Daha basit yol:**
   - (a) **Aralığı 10–15 sn'ye çıkarmak.** Tek satır ama canlılık hissi düşer. Bugünkü sayılarda gereksiz; eşzamanlı ~80'e yaklaşılırsa geçici kullanılır.
   - (b) **Uzun yoklama.** Canlı bağlantı zaten var; ikinci bir mekanizma eklemek gereksiz.
   - **Seçim: F3 canlı akış.** En büyük iş; 1–5 bittikten sonra.

## 7. Bağlantı bütçesi

1. **Ne:** Yerleşim havuzu 2'de kalır, F1.6 planındaki 4'e çıkarma kararı geri alınır. Madde 3'ten sonra yerleşim havuzu yalnız yazmalarla
   dolar. Normal havuz (API başına 8) ve worker (12) ölçüme göre gözden geçirilir.
2. **Neden:** 6 çekirdekte PostgreSQL için önerilen aktif bağlantı ~13 (çekirdek × 2 + 1). Bugün aynı CPU için ~48 bağlantı yarışıyor.
   Ölçüm: havuz 4'te CPU yine doldu.
3. **Kazanç:** Aşırı yükte veritabanı CPU'su bağlam değiştirmeye değil işe gider. Kuyruk uygulamada, kontrollü ve sınırlı kalır.
4. **Oyun mantığı riski:** Düşük. Yalnız sayılar değişir. Havuz kuyruğu sınırı (2 sn → 503 RETRYABLE) zaten var.
5. **Daha basit yol:** Hiç dokunmamak. Madde 3 ve 4 sonrası ölçüm gerek görmezse bu madde kapanır.

## 8. Prod'u derlenmiş JS ile koşmak

1. **Ne:** Sunucu imajı bugün `tsx apps/server/src/index.ts` ile koşuyor (çalışırken TypeScript derliyor). Yerine build adımında
   esbuild/tsc ile JS üretilir ve `node` ile koşulur.
2. **Neden:** Açılışta esbuild derlemesi ve modül çözümü CPU'nun ~%15'i. API ayrıca kullanmadığı `packages/rules/src/arena/*` modüllerini yüklüyor. Bellek de yükseliyor.
3. **Kazanç:** Daha hızlı açılış: deploy ve yeniden başlatmada kısa kesinti, sıcaklanma süresi. Daha az bellek, ucuz hata yığınları.
   Yük altındaki kararlı CPU kazancı küçük.
4. **Oyun mantığı riski:** Düşük–orta. Kod aynı; risk paketlemede: dinamik importlar, `import.meta` yolları, drizzle migration dosya yolları.
   - Koruyucu testler: imaj içinde smoke (health, migrate, worker tick) ve deploy provası.
5. **Daha basit yol:** Node'un yerleşik TypeScript desteği (tip silme), build adımı gerektirmez. Ama bizim kodda TS'ye özel söz dizimi
   (enum, parametre özellikleri) varsa çalışmaz; ölçülmeli. **Seçim: önce yerleşik destek denenir; olmazsa esbuild.**

## 9. Yük aracı düzeltmeleri (kabul koşusu için)

1. **Ne:**
   - Kademeler arasında API'lerin boşalmasını beklemek: istek kuyruğu ve CPU sakinleşene kadar.
   - Açılış okuması başarısız olursa koşuyu düşürmek yerine kaydedip o sahte oyuncuyu geri çekilmeli yeniden denemek; gerçek istemci de böyle davranır.
   - Raporlama ve kurulum: `releaseIdentity` için imaj kimliği ortam değişkeniyle verilir; `.dockerignore` yük imajı için ayrı tutulur.
2. **Neden:** Bugünkü koşuda 300/400/500 kademeleri önceki kademenin kuyruğu bitmeden başladı ve geçersiz oldu. Tek bir 503 bütün koşuyu bitirdi.
3. **Kazanç:** Son 1.000 oyunculuk kabul koşusu tek seferde, güvenilir sonuç verir.
4. **Oyun mantığı riski:** Yok; yalnız araç.
5. **Daha basit yol:** Kademeleri ayrı ayrı elle koşmak. Bugün öyle yaptık ve zaman kaybettirdi.

---

## Sıra ve bağımlılıklar

| Sıra | Madde | Efor | Risk | Beklenen etki |
|---|---|---|---|---|
| 1 | 0. Yerel ölçüm düzeneği | küçük | yok | her şeyin ön şartı |
| 2 | 1. Spawn kapısı (önce "yalnız değişince yaz" ölçülür) | küçük | düşük–orta | yazma takılmaları |
| 3 | 2. Presence | küçük | orta | oyuncu satırı kilidi |
| 4 | 3. Galaksi havuz dışı | orta | orta–yüksek | açılış 503'leri |
| 5 | 4. Galaksi yanıtı (önce ETag + bir kez JSON) | orta–büyük | orta | CPU ve baytın asıl kaynağı |
| 6 | 5. Stale-while-revalidate | küçük–orta | orta | okuma beklemeleri |
| 7 | 7. Bağlantı bütçesi | küçük | düşük | aşırı yük davranışı |
| 8 | 8. Derlenmiş JS | küçük–orta | düşük–orta | açılış, bellek |
| 9 | 6. Trafik canlı akış (F3) | büyük | orta–yüksek | 1.000 oyuncuya giden son büyük kalem |
| 10 | 9. Yük aracı + 1.000 oyunculuk kabul koşusu | küçük | yok | doğrulama |

Her madde ayrı commit'tir ve kendi testleriyle kapanır. Prod'a çıkış owner onayıyla, madde gruplarıyla:
- 1–3 birlikte;
- 4–5 birlikte;
- 6 ayrı.

Tek bir 1.000 oyunculuk kabul koşusu en sonda yapılır. Ara ölçümler madde 0 ile yereldir.

---

## Review düzeltmeleri (31 Ekim, koda karşı doğrulandı)

### Yanlışlar

**R1. Madde 8: "önce Node'un yerleşik TypeScript desteği" çalışmaz.**
- Sunucu kodu `.ts` dosyalarını `./app.js` uzantısıyla import ediyor; bu eşlemeyi tsx yapıyor.
- Node'un tip silme özelliği bu eşlemeyi yapmaz.
- İmaj `node:22`; tip silme orada bayrak ister.
- **Doğrusu:** doğrudan esbuild ile paketlemek.

**R2. Madde 1'in kazancı abartılı, mekanizması büyük ihtimalle yanlış.**
- Planın iddiası: worker'ın bekleyen UPDATE'i, arkasına gelen bütün oyun yazmalarını sıraya sokuyor.
- PostgreSQL'de satır zaten paylaşımlı kilitliyken yeni bir `FOR SHARE` isteği beklemez, bekleyen UPDATE'in önüne geçer. Ölçülen 329 ms büyük ihtimalle worker'ın kendi beklemesi.
- UPDATE kilidi aldıktan sonra transaction'da yalnız `pg_notify` kalıyor (`spawnGate.ts:91–94`); oyun yazmalarına etkisi milisaniyeler.
- **Doğrusu:** önce üç oturumluk bir testle davranış kanıtlanır. Oyunculara etkisi yoksa madde 1 "yalnız değer değişince yaz" seviyesine iner ve sıranın sonuna gider.

### Abartı ve eksik açıklama

**R3. Madde 2: kazancın gerçek nedeni plandakinden farklı.**
- Throttle API süreci başına tutuluyor (`PresenceTracker.lastWrite` her süreçte ayrı). nginx istekleri 3 API'ye dağıttığı için bir hesap dakikada 3 kez yazıyor. Ölçülen 2.320 yazma bunu doğruluyor: 200 oyuncu × 3 dk ≈ 600 beklenirken.
- `touch` istek yolunda `await` ediliyor (`auth.ts:199, 217, 229`). Kilit beklemesi doğrudan o isteğin gecikmesine ekleniyor.
- **Doğrusu:** koşullu UPDATE'teki `last_active_at < now - 60 sn` şartı süreçler arası tekrarı da keser (3 → 1). Ayrıca yazım istek yolundan çıkarılabilir: `await` yerine sıraya al. Bu ikinci kısım ayrı bir karar; hata raporlama korunmalı.

**R4. Madde 7: "48 bağlantı CPU için yarışıyor" zayıf bir iddia.** Örneklerde aynı anda aktif backend sayısı 1–7. Bağlantıların çoğu boştaydı. Sonuç değişmiyor (havuzu büyütme), ama gerekçe şu olmalı: CPU'yu API süreçleri dolduruyor, PostgreSQL bağlantı sayısı değil.

**R5. "Makine ~200'de doyar" kesin değil.** Yük üreteci aynı makinedeydi ve CPU'su ayrıca ölçülmedi: sampler `capacity` adına süzüyordu, yük konteynerinin adı rastgeleydi. Rapordaki tavan, üretecin payı kadar düşük ölçülmüş olabilir.
- **Doğrusu:** kabul koşusunda üreteç konteynerine sabit ad verilir ve CPU'su ayrı kaydedilir (madde 9'a eklenir).

### Gözden kaçanlar

**R6. Düşük yükte bile yavaş hareketler: planın hiçbir maddesi bunu hedeflemiyordu.** 50 oyuncuda CPU düşükken hareket p95 1,9 sn, fırlatma p50 807 ms. Bu CPU doluluğu değil, hareketin kendi maliyeti ya da bir kilit/kuyruk.
- **Yeni madde M:** madde 0 ile `fleet/launch`, `planet/collect` ve `planet/build` tek başına ölçülür: SQL sayısı, süre, kilit beklemesi. Kök sebep bulunur. Yüksek öncelik; oyuncunun en çok hissettiği gecikme bu.

**R7. Galaksi önbelleğini ne boşaltıyor? Plan sormamıştı.** `shard:score` da galaksiyi tamamen boşaltıyor (`projections.ts:478–488`). Puan sık değişen bir olay; 180 sn'de 67 yeniden doldurmanın büyük kısmı muhtemelen buradan.
- **Daha basit çözüm (madde 5'ten önce):** galaksinin hangi alanlarının puana bağlı olduğu bulunur. Puan değişikliği yalnız o alanları günceller ya da puan ayrı küçük bir parçaya taşınır. Gereksiz boşaltmaları kesmek, stale-while-revalidate'ten daha basit olabilir.

**R8. Galaksi neden bu kadar sık okunuyor?** Kişi başı ~27 sn'de bir. Yalnız ucuzlatmak değil, sıklığı azaltmak da seçenek:
- olay başına okumalar (`readsForShardEvent`, ağır şerit 30 sn);
- 60 sn güvenlik ağı.

Madde 0'da istemci tarafı okuma nedenleri sayılır.

**R9. Eski mobil uygulama sürümleri (APK) unutulmuştu.** Android uygulaması web paketini içinde taşıyor. Madde 4 (galaksiyi bölmek) ve madde 6 (trafik akışı), eski APK'ların bugünkü `/api/galaxy` ve `/api/galaxy/traffic` çağrılarını kıramaz.
- **Doğrusu:** eski uç noktalar, minimum APK sürümü yükseltilene kadar aynen kalır. Yeni yollar ek olarak açılır; ikisi aynı önbellekten beslenir. Eşdeğerlik testi bu yüzden kalıcı.

**R10. Madde 4'teki "değişmeyen" alanların değişmediği doğrulanmalı.** Dünya adı, rengi ve kaplaması (`equipped_skin_id`) sezon içinde değişebilir. Gerçekten sabit olan muhtemelen yalnız konum ve tür.
- **Doğrusu:** alan alan kod taraması; değişebilen her alan "değişen" parçaya.

**R11. Madde 0'da temiz bir CPU profili şart.** Prod'daki profiller açılışla karışıktı: esbuild derlemesi %10–15. "Galaksi en pahalı CPU" iddiası baytla kanıtlı, CPU payıyla değil. Madde 4'ün büyük işine girmeden önce, döküm üzerinde ısınmış süreçten rota başına CPU profili alınır.

### Güncellenmiş sıra

| Sıra | İş |
|---|---|
| 1 | 0. Yerel ölçüm düzeneği. Rota ve hareket başına CPU profili, SQL sayısı, süre. İstemci okuma nedenleri (R6, R8, R11). |
| 2 | M. Hareket maliyetinin kök sebebi (R6). |
| 3 | 2. Presence: koşullu yazım, süreçler arası tekrarın kesilmesi (R3). |
| 4 | 3. Galaksiyi yerleşim havuzundan çıkarmak. |
| 5 | R7. Puan olayının galaksiyi boşaltmasını kesmek; madde 5 ondan sonra hâlâ gerekiyorsa. |
| 6 | 4. Galaksi yanıtı. Önce bir kez JSON + ETag. Bölme R9 ve R10 ile. |
| 7 | 1. Spawn kapısı. Önce R2 testi; büyük ihtimalle yalnız "değişince yaz". |
| 8 | 8. Derlenmiş JS, esbuild ile (R1). |
| 9 | 7. Bağlantı bütçesi (R4). |
| 10 | 6. Trafik canlı akış (R9 ile). |
| 11 | 9. Yük aracı: üretecin CPU'su ayrı (R5). Ardından kabul koşusu. |
