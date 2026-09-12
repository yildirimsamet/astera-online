# Entegrasyon Devir Planı — Intergalactic Convoy

> **Durum:** YEREL KOD TAMAM. Gerçek tarayıcı/staging rollout kanıtları açık; fazlar §0.2'de
> izleniyor.
>
> **Karar numarası:** **D201** (`docs/decisions.md` en yüksek mevcut numara D200'dür).
>
> **Özellik kimliği:** `INTERGALACTIC_CONVOY`
>
> **Oyuncu adı:** TR `Galaksilerarası Konvoy`, EN `Intergalactic Convoy`
>
> **İncelenen kod tabanı:** 2026-09-11 çalışma ağacı; mevcut Asteroid Yağmuru,
> Ticaret Gemisi, korsan akını, hareketli-hedef uçuşu, worker, fog, bildirim ve ekonomi
> altyapıları.
>
> **Hedef okuyucu:** Bu konuşmayı ve ön araştırmayı hiç görmemiş uygulama ajanı.
>
> **İkinci denetim:** 2026-09-11; mobile retry/idempotency ve stale snapshot, moving-engagement
> segmenti, aynı konvoya eşzamanlı çoklu saldırı, simultaneous job sırası, multi-world origin
> kimliği, bot katılımı, eski ruleset üretimi, ayrı resource/ship kalite eşikleri, bildirim yoğunluğu,
> versioned route ve uzun oluşum/ingress eksikleri plana işlendi.

Bu dosya uygulama emri değil, eksiksiz devir sözleşmesidir. Uygulama ajanı önce
`AGENTS.md` üzerinden yönlendirildiği `CLAUDE.md` dosyasının tamamını okumalı; sonra burada
belirtilen karar kapılarını kapatmalı ve her fazda önce kırmızı testi yazıp en küçük kodla
yeşile dönmelidir.

---

## 0. Karar kaydı ve ilerleme defteri

> Bu bölüm uygulama sırasında yazıldı. §2'nin varsayımları ile burası çeliştiğinde **burası
> kazanır**; §2'deki kapanmış kararlar da uygulama sözleşmesine taşındı.

### 0.1 Kapatılan owner kararları — 2026-09-12

| § | Karar | Sonuç |
|---|---|---|
| 2.1 | Ticaret Gemisi akşam penceresi | **21:00–23:00.** 14 saatlik yorum reddedildi. |
| 2.3 | Tekrar farm freni | **Occurrence başına dünya kotası = 1.** Bir dünya bir konvoy penceresine ömründe bir kez saldırır. Ölçüm beklenmedi; fren şimdi kondu. Yeni refusal: `CONVOY_ALREADY_RAIDED`. |
| 2.4 | Ödül olasılıkları | **Plandaki v1 aynen onaylandı.** %15 × shipQualityFactor; adet 80/17/3; tier 55/27/13/5; havuz = görünür sekiz hull; `shipDropFullFirepower` = `combatValue({ CATACLYSM: 1 })`, occurrence'a snapshot. |
| 2.6 | Botlar | **v1'de konvoya saldırmaz.** Bot brain'e lane eklenmez. |
| 2.7 | Ad | **TR `Galaksilerarası Konvoy`**, EN `Intergalactic Convoy`, ID `INTERGALACTIC_CONVOY`. |
| 2.7 | Sınır semantiği | Oluşum **merkezi** gameplay anchor'dır; pencerenin **tam ortasında** `(0,0,0)`. Rank ingress/egress yalnız görsel fade. |
| 2.8 | Erişim garantisi | **Artık garanti VAR ve geometriyle satın alındı** — aşağıya bak. Yine de honest refusal (`CONVOY_OUT_OF_REACH`) pencere sonuna yakın launch'lar için korunur. |

### 0.2 ÇAP GEÇİŞİ BİR SAAT DEĞİL, **İKİ SAATTİR** — owner talimatı

> *"Baştan sona 2 saat'te geçecek şekilde plan'ı güncelle. Böylece herkes kesin bir şekilde
> ulaşabilir. Saatleri de: akşam 18:00–20:00, gece 22:00–24:00."*

**D204 schedule override:** geçiş süresi değişmeden kalır; güncel Türkiye pencereleri
**07:00–09:00 ve 19:00–21:00**'dir. Aşağıdaki uygulama/kabul maddeleri bu son talimatı kullanır.

Bu, §2.8'in "erişim garantisi yoktur" varsayımını **tersine çevirir** ve gizli catch-up bonusu
eklemeden yapar: konvoy yavaşlar, kural değişmez.

Ölçüm (`GALAXY.radius = 2000`, `TRAVEL.distanceFactor = 1.2`):

| | birim/dakika |
|---|---:|
| Konvoy, 1 saatlik çap | 66.67 |
| Konvoy, **2 saatlik çap** | **33.33** |
| En yavaş mobile hull (ARGOSY, `79.295 / 1.2`) | 66.08 |
| En yavaş ateş eden hat (CITADEL/PALADIN, `120.805 / 1.2`) | 100.67 |

Bir saatte konvoy en yavaş taşıyıcıdan **hızlıydı** — o filo hiçbir zaman yetişemezdi. İki saatte
en yavaş gövde bile konvoyun **iki katı** hızlıdır ve çapın tamamı 4.000 birim, yani en yavaş filo
için 60.5 dakika: pencerenin yarısı. Erişim artık geometrik olarak garantidir.

Sonuçlar (plandaki her yeri bağlar):

- `INTERGALACTIC_CONVOY.durationMinutes = 120`, iki pencere de tam 120 dakika.
- Merkez geçişi **30. dakikada değil, 60. dakikadadır**; `position(t)` `t/120` ile lerp eder.
- Konvoy hızı `2 × GALAXY.radius / 120` game-unit/dakika.
- Takvim: **Konvoy 07:00–09:00 ve 19:00–21:00.**
- 07:00–09:00 penceresi aynı saatlerdeki Ticaret Gemisi ile **bilerek çakışır**.
- 19:00–21:00 penceresi Asteroid Yağmuru ile 20:00–21:00 arasında **bilerek çakışır**;
  `mutuallyExclusive` boş.

### 0.3 §2.3 kotasının şema sonucu

İki ayrı kısıt gerekir, biri diğerini kapsamaz:

1. `UNIQUE (planet_id) WHERE status <> 'done'` — aynı dünyadan aynı anda tek aktif filo
   (farklı occurrence'lar arasında da geçerli; önceki akın hâlâ havadayken sonraki pencereye
   ikinci filo çıkamaz).
2. `UNIQUE (planet_id, occurrence_id)` — bir dünya bir pencereye **ömründe bir kez** saldırır;
   run `done` olduktan sonra bile ikinci akın imkânsızdır. Bu, §11'de tablo dışı vurgulanan
   coğrafi farm riskinin tamamını kapatır.

### 0.4 İlerleme defteri

Bağlantı koparsa buradan devam edilir. Her faz bittiğinde satır güncellenir.

| Faz | Durum | Not |
|---|---|---|
| 0 — Karar ve baseline | ✅ | Kararlar §0.1/§0.2'de; ekonomi simülasyonu muafiyeti owner tarafından ayrıca kilitlendi. |
| 1 — Sabit takvim ve kind contract | ✅ | Ruleset 8 sabit planner, ruleset 4–7 registry, kind/lifecycle contract ve shipping/economy ayrımı tamam. |
| 2 — Saf konvoy kuralları | ✅ | Route/intercept/reward/drop/fuel/formation kuralları ve 25 feature testi yeşil. |
| 3 — Schema ve migration | ✅ | Append-only enumlar, run tablosu, constraint/indexler ve `0075_quiet_guardsmen.sql` hazır; PostgreSQL schema testi yeşil. |
| 4 — Field, active API, lifecycle | ✅ | Private route seed, public active projection, start/end lifecycle ve Chronicle akışı tamam. |
| 5 — Launch ve concurrency | ✅ | Strict/idempotent launch, frozen quote, refusal sırası, dünya kotası ve yarış testleri tamam. |
| 6 — Worker, dönüş, recovery | ✅ | Exactly-once arrival/return, deterministic award, safe-home, abandon/season/reclaim ve offline recap tamam. |
| 7 — Traffic, pending, realtime | ✅ | Fog-safe moving segment, pending/traffic projectionları, SSE/cache invalidation ve web şemaları tamam. |
| 8 — Web ve görsel | 🚧 | Rail/sheet, 22 benzersiz gemilik çift sıra, hareketli 5 sn volley ve locale testleri tamam; 350 px gerçek tarayıcı görsel/perf kanıtı bekliyor. |
| 9 — Kapanış ve rollout | 🚧 | Yaşayan dokümanlar, kimliksiz route/refusal ve accepted/replay telemetry'si ile yerel doğrulama tamam; staging migration, kalıcı dashboard ve drain rollback tatbikatı deploy aşamasında yapılacak. |

### 0.5 İnceleme düzeltmeleri — 2026-09-12

Tam bir inceleme sonrası 17 madde bulundu ve kapatıldı. Davranış değiştirenler `docs/decisions.md`
D201 altına "Review corrections" olarak yazıldı.

| # | Önem | Konu | Durum |
|---|---|---|---|
| 1 | Kritik | `contactPosition` ↔ `engagementPosition` sonsuz özyineleme; konvoy akınını gören her oyuncunun sahnesi her karede çöküyordu | ✅ |
| 2 | Yüksek | Teklif tazeliği reaksiyon süresi testine dönüşmüştü (ölçüldü: medyan 4–5 sn bütçe) | ✅ |
| 3 | Yüksek | Occurrence kotası ekranda görünmüyordu (D124) | ✅ `convoyOccurrenceSpent` |
| 4 | Yüksek | `intergalactic-convoy-visual.test.ts` typecheck'i kırıyordu | ✅ görsel iş tamamlandı |
| 5 | Orta | Offline özette LIMIT, lane filtresinden önce uygulanıyordu | ✅ |
| 6 | Orta | Konvoy satırları `accrued`/`unlock`'u kuyruktan atabiliyordu | ✅ `CONVOY_RECAP_LINES` |
| 7 | Orta | `convoy_result` Signals üçlüsünde tanımsızdı → gri not + zil | ✅ |
| 8 | Orta | Ödül tablosunda üç sayı yalnız `title` ile ayrılıyordu; dokunmatikte tooltip yok | ✅ |
| 9 | Orta | Terk edilen outbound run kotayı yakıyordu | ✅ migration 0076 |
| 10 | Düşük | `schedule()` `dedupeKey` için `onConflictDoNothing` yoktu | ✅ |
| 11 | Düşük | Unique ihlali domain hatasına çevrilmiyordu | ✅ |
| 12 | Düşük | `lookAt` yerine stabil quaternion gerekiyordu | ✅ |
| 13 | Düşük | D53 sapması (ikinci transaction) belgesizdi | ✅ belgelendi |
| 14 | Düşük | TR metinde İngilizce "launch", yerleşik olmayan tier biçimi | ✅ |
| 15 | Düşük | `fullRewardForceRatio ≠ 1` launch içinde 500 üretecekti | ✅ |
| 16 | Düşük | Ölü `galaxyEventConfig` export'u + `plannedEffectFor` gizli varsayılanı | ✅ |
| 17 | Düşük | Ruleset-5 TRADE_SHIP entitlement değişikliği belgesizdi | ✅ |

**Kapsam dışı, konvoya ait değil:** `apps/server/test/contract.test.ts` bağlantı havuzu
tükenmesiyle kırmızı — `beforeEach` 79 kez `buildApp()` çağırıyor ve dosyada hiç `app.close()`
yok, Postgres `max_connections`'a çarpıyor (`PostgresError 53300`). Konvoy bu dosyaya yalnız
3 satırlık bir yeniden adlandırma ekledi ve `it()` sayısını değiştirmedi.

### 0.5 Son yerel doğrulama — 2026-09-12

- Root lint ve dört workspace typecheck'i yeşil; web production build'i yeşil.
- Hedefli rules testleri **56/56**, server testleri **131/131**, web testleri **210/210** yeşil.
- `packages/sim/test/economy-scope.test.ts` ve tasarım doğrulamasındaki explicit exclusion testi
  yeşil: Asteroid Shower, Trade Ship ve Intergalactic Convoy ARR/VFR/progression/season ekonomi
  simülasyonlarına import edilmez veya gelir olarak eklenmez.
- Tam workspace koşusunda rules **1100/1100**, web **2763/2763** yeşildi. Server koşusundaki tek
  feature kaynaklı olmayan allow-list beklentisi `convoy_result` eklenerek düzeltildi; ilgili suite
  sonrasında **19/19**, bu turun hedefli server kapsamı da **131/131** yeşil geçti.
- Tam sim koşusunda ekonomi modelinin mevcut beş calibration kırmızısı sürüyor: dört seed'de VFR
  alt sınırı ve seed 42 informed-archetype sıralaması. Bunlar konvoy geliri içermez. Ayrıca bağımsız
  eski tasarım-validation testi, kaldırılmış Hangar modelinden sonra `worldStats()` artık `hangar`
  üretmediği için `Invalid physical session` ile duruyor; konvoy exclusion assertion'ı tek başına
  yeşil ve bu özellik söz konusu araca hiçbir gelir dalı eklemiyor.
- `0075_quiet_guardsmen.sql` schema-drift testi yeşil; `git diff --check` temiz.
- `/metrics`, launch route'unun HTTP durumlarını ve stabil refusal kodlarını, ayrıca
  `intergalactic-convoy.launch` için `accepted`/`replay` ayrımını oyuncu kimliği toplamadan sunuyor.

---

## 1. Amaç ve sonuç

Yeni etkinlik, galaksiyi iki saat içinde bir kenardan karşı kenara düz bir çap boyunca geçen,
merkezden tam 60. dakikada geçen, mevcut gemi modellerinden oluşan uzun ve çift sıralı bir
konvoydur. Oyuncular kendi dünyalarından savaş gemisi ve yük gemisi karışımı bir filo gönderir:

1. Filo hareketli konvoyun **oluşum merkezine** yetişir.
2. Beş saniye boyunca konvoyla aynı hızda yan yana ilerleyerek ateş eder.
3. Konvoy karşılık vermez; saldıran filo kayıp vermez.
4. Filo, çıkış dünyasının iki saatlik nominal üretimini aşmayan ve kendi kargo kapasitesine
   sığan Alloy/Crystal/Deuterium ödülü kazanır.
5. Ayrıca filodaki en yüksek gemi tier'ını aşmayacak şekilde, düşük bir olasılıkla toplam
   1–3 gemi çekebilir.
6. Ödül ve gemiler dönüş tamamlanınca komutana teslim edilir.

Aynı dünyadan aynı anda yalnız bir aktif konvoy akını bulunabilir; kilit dönüş tamamlanana kadar
sürer. Bir başkent ve iki kolonisi olan oyuncu, her dünyadan birer tane olmak üzere üç konvoy
akınını aynı anda yürütebilir. Kural oyuncu başına değil, **çıkış dünyası başına** uygulanır.

### Önerilen sistem şekli

```text
Sabit TRT takvimi
  └─ galaxy_event_occurrences: INTERGALACTIC_CONVOY
       ├─ aktifken public route/spec
       ├─ start/end notification + Chronicle + SSE
       └─ doğrusal, çap boyunca saf konum fonksiyonu

Seçili dünya + filo
  └─ ortak rules quote
       ├─ hareketli hedef kesişimi
       ├─ 5 sn engagement bitişi
       ├─ gidiş + farklı dönüş mesafesi yakıtı
       ├─ 2 saatlik üretim snapshot'ı
       └─ firepower × cargo ödül quote'u
             │
             ▼
POST /api/intergalactic-convoy/launch
  └─ transaction + dünya kilidi + partial unique index
       ├─ fleet park et
       ├─ yakıtı iki bacak için peşin al
       └─ convoy_arrival job
             │
             ▼
5 sn ateş bittiğinde arrival handler
  ├─ deterministik resource/gemi ödülünü bir kez yaz
  ├─ owner-only convoy_result bildirimi üret
  ├─ dönüşü, konvoyun o andaki konumundan başlat
  └─ convoy_return job
             │
             ▼
return handler
  ├─ safeHomePlanet ile filoyu komutana teslim et
  ├─ resource + 0/1–3 ödül gemisini bir kez ekle
  └─ notification + pending/traffic/planet invalidation
```

Bu özellik `missions` tablosuna sıkıştırılmamalıdır. Konvoy bir gezegen değildir; mevcut korsan
ve ticaret uçuşları gibi kendi run tablosu ve lifecycle'ı olmalıdır.

---

## 2. Uygulamadan önce kapatılacak kararlar

Aşağıdaki maddeler ürün sahibinin onayı olmadan sessizce farklı yorumlanmamalıdır. Kalın seçenekler
bu planın önerdiği varsayılanlardır.

### 2.1 Çözülen Ticaret Gemisi saati

İstekteki `akşam 21:00–11:00`, diğer üç Ticaret Gemisi penceresinin ikişer saat olmasıyla ve
`11:00` saatinin “akşam” olmamasıyla çelişir.

- **Owner kararı: `21:00–23:00`.**
- Eğer gerçekten `21:00–ertesi gün 11:00` isteniyorsa 14 saatlik bu pencere `01:00–03:00` ve
  `07:00–09:00` ile üst üste gelir. O durumda ayrı occurrence mı, tek uzun occurrence mı olduğu
  ayrıca kararlaştırılmalı; aşağıdaki config doğrudan uygulanmamalıdır.

Bu karar §0.1'de kapatılmıştır.

### 2.2 Paylaşılan konvoy stoğu

İstek bir toplam stok veya oyuncular arası tükenme tanımlamıyor.

- **Öneri: occurrence sınırsız/paylaşımsızdır.** Her tamamlanan akın kendi üretim ve kargo
  tavanına göre ödül üretir; başka oyuncunun saldırısı bu oyuncunun ödülünü azaltmaz.
- Böylece global mutable `convoy_state` ve ilk-vuruş yarışı kurulmaz.
- Paylaşılan/tükenen stok istenirse mimari değişir: stok satırı önceden seed edilmeli,
  `SELECT ... FOR UPDATE` altında eksiltilmeli ve UI kalan stoğu nasıl göreceğini tanımlamalıdır.

### 2.3 Tekrar akını ve ekonomi riski

“Filo dönmeden yenisini gönderemez” ifadesi, döndükten sonra tekrar göndermeye izin verir.
Konvoy rotasına çok yakın bir dünya birkaç saniyelik tur süresiyle aynı iki saat içinde çok sayıda
ödül üretebilirdi. Bu, çalışan ekonomiyi kırabilecek en büyük açık noktaydı.

- **Owner kararı: occurrence başına dünya kotası 1'dir.** Dönüş tamamlansa bile aynı dünya aynı
  occurrence'a ikinci kez saldıramaz; `UNIQUE (planet_id, occurrence_id)` bunu DB'de de korur.
- 300 dünya koordinatıyla reachability ölçümü ekonomi simülasyonu değil feature correctness
  testidir; 64 isotropic rota ve tier temsilleriyle sıfır erişim kaçağı kanıtlanmıştır.

### 2.4 Ödül olasılıkları

İstek ship drop olasılığını ve 1/2/3 adet dağılımını sayı olarak vermiyor. Başlangıç için bu planın
önerdiği, testlerde kilitlenecek v1 değerleri:

- İstekteki gemi “level”ı repodaki `HULLS[id].tier` (1–4) olarak yorumlanır; ayrı bir gemi-level
  sistemi yoktur. Research level veya filo adedi bu tavan değildir.

- Tam kalite filoda gemi drop olasılığı: **%15**.
- Gerçek olasılık: `0.15 × shipQualityFactor`.
- Drop gerçekleştiğinde adet: **%80 bir**, **%17 iki**, **%3 üç**.
- Tier seçimi, gelen filonun `maxTier` değerine kadar normalize edilen ağırlıklarla yapılır:
  tier 1 `%55`, tier 2 `%27`, tier 3 `%13`, tier 4 `%5`.
- Aynı saldırıda aynı hull birden fazla seçilebilir; toplam hiçbir zaman üçü geçmez.

Bu değerler canlı ekonomi testlerine eklenmeyecek olsa da risksiz bir PvE kaynağı oldukları için
ürün sahibinin açık onayıyla `INTERGALACTIC_CONVOY` v1 effect snapshot'ına yazılmalıdır.

Kaynak kalitesi ile gemi çekilişi kalitesi **aynı paydayı kullanmamalıdır**. Kaynak eşiği çıkış
dünyasının üretimine bağlıdır; onu gemi için de kullanmak level-0/yeni koloniden bir Dart ve büyük
taşıyıcılarla ucuz biçimde tam %15 ship chance üretir. Önerilen v1 gemi eşiği, tek bir Cataclysm'ın
`combatValue({ CATACLYSM: 1 })` değeridir ve occurrence effect'inde **hesaplanmış sayısal
`shipDropFullFirepower` olarak snapshot edilir**. İleride hull fiyatı değişse bile başlamış
occurrence'ın olasılığı değişmez. Bu eşik ve görünür sekiz hull'ın ödül pool'u olması da owner
kararına yazılmalıdır.

### 2.5 “Ekonomi testlerine dahil etme” yorumu

- **Konvoy simulator, ARR, VFR, progression/economy calibration veya aylık referans gelire
  eklenmeyecektir.**
- `ECONOMY_PROFILE` içine konvoy income dalı/flag'i eklenmeyecek; mevcut
  `tradeShip: false` ve `asteroidShower: false` ölçüm değerleri korunacaktır.
- Buna karşılık ödül tavanı, kargo, olasılık, idempotency ve concurrency için feature-specific
  rules/server testleri zorunludur. Bunlar ekonomi simülasyonu değil, correctness testidir.

### 2.6 Server botlarının katılımı

Repoda gerçek ekonomi ve gerçek servislerle oynayan server commander botları vardır. Bunları yeni
lane'e otomatik dahil etmek, insan oyuncular test edilmeden dış kaynak üretimini ve aynı konvoydaki
görsel trafiği yükseltir.

- **Önerilen v1: botlar konvoya saldırmaz.** `Lane`, persona weight ve bot brain'e convoy lane'i
  eklenmez.
- Bu bir oyuncu kuralı değildir; bot davranış seçimidir. İnsan launch servisi bot hesabına teknik
  olarak ayrıcalık veya engel koymaz.
- Daha sonra bot katılımı istenirse aynı public event verisini okuyup aynı launch servisini çağıran,
  persona-weighted ayrı bir dilim yapılır. Botlar reward, fuel, bay, same-world lock veya saat
  kurallarından muaf tutulamaz.
- Bot katılımı açılırsa bu, economy simulator'a konvoy geliri eklemek anlamına gelmez; fakat canlı
  supply telemetry'si ve rollout limiti tekrar onaylanır.

### 2.7 Ad ve görsel sınır semantiği

- **Canonical ID** `INTERGALACTIC_CONVOY`, EN adı `Intergalactic Convoy`, TR oyuncu adı
  `Galaksilerarası Konvoy`dur. İstekteki “Kervan” takvim kısaltması yalnız tarif olarak kalır.
- **İki saat, oluşum merkezinin sınırdan sınıra hareket süresidir.** Start'ta ön rank'lar galaksiye
  girmiş, arka rank'lar sınır dışında; end'de bunun tersi olabilir. Bütün 20 craft'ın fiziksel olarak
  sınırı tamamen geçmesi de tam iki saate sığdırılmak istenirse route endpoint/speed ve gameplay
  anchor sözleşmesi değişir. Bu plan merkezin exact 60. dakikada `(0,0,0)` olmasını önceliklendirir;
  rank ingress/egress'i yalnız görsel clipping/fade ile anlatır.

### 2.8 Her dünyanın erişebilmesi garanti mi?

İki saatte çap geçen hareketli hedef, en yavaş filo çizgisinden de yavaştır. Açılış anında
300 stable slot, 64 isotropic rota ve tier 1–4 temsiliyle ölçülen erişim garantisi sıfır kaçakla
kanıtlanmıştır.

- Erişim yine geometri ve seçilen filo hızına bağlıdır; geç launch veya beş saniyelik engagement'ı
  pencereye sığmayan seçim açıkça `CONVOY_OUT_OF_REACH` görür.
- Bu geometry/reachability correctness çalışması economy simulator'a ödül geliri eklemez.
- Garanti gizli catch-up/teleport ile değil, exact 120 dakikalık çap hızıyla sağlanır.

---

## 3. Kesin oyun sözleşmesi

### 3.1 Takvim — Türkiye saati

Aralıkların tamamı Türkiye saati, sözleşme olarak pinlenmiş `UTC+03:00` ve half-open
`[başlangıç, bitiş)` şeklinde yorumlanır. `Europe/Istanbul` yalnız insan tarafından okunur etikettir;
cihaz/process timezone'u veya gelecekte değişebilecek host tzdb davranışı kullanılmaz.

| Etkinlik | TRT penceresi | Süre/etki |
|---|---:|---:|
| Ticaret Gemisi | 01:00–03:00 | 2 saat |
| Ticaret Gemisi | 07:00–09:00 | 2 saat |
| Ticaret Gemisi | 15:00–17:00 | 2 saat |
| Ticaret Gemisi | **21:00–23:00** | 2 saat |
| Asteroid Yağmuru | 02:00–03:00 | ×3 |
| Asteroid Yağmuru | 10:00–11:00 | ×3 |
| Asteroid Yağmuru | 13:00–14:00 | ×5 |
| Asteroid Yağmuru | 20:00–21:00 | ×10 |
| Galaksilerarası Konvoy | **07:00–09:00** | 2 saat |
| Galaksilerarası Konvoy | **19:00–21:00** | 2 saat |

Sonuçlar:

- Ticaret Gemisi mevcut günde dört rastgele, üçer saatlik occurrence modelinden günde dört sabit,
  ikişer saatlik occurrence modeline geçer.
- Asteroid Yağmuru rastgele beş günlük modelden sabit dört pencereye geçer; multiplier occurrence
  başına snapshot'tır.
- Konvoy günde iki kez çıkar.
- Türler birbirini dışlamaz. Özellikle Ticaret Gemisi ile Konvoy 07:00–09:00 boyunca, Asteroid
  Yağmuru ile Konvoy 20:00–21:00 boyunca birlikte aktiftir; `mutuallyExclusive` boş kalır.
- 02:00'de Trade ve Asteroid birlikte başlar; 03:00'te birlikte biter. 07:00'de Trade ile ilk
  Convoy birlikte başlar. DB/API/UI order'ı `startsAt`, sonra canonical kind order, sonra `id` ile stabil
  olmalıdır. Worker handler'larının doğruluğu aynı timestamp'teki claim sırasına bağlı olamaz.
- Sezon ilk/son gününde yalnız **tamamı sezon aralığına sığan** sabit pencereler yazılır. Kısmi
  etkinlik yaratılmaz, saat kaydırılmaz ve süre kısaltılmaz.
- Sezon başlangıcından önce başlamış bir pencere backfill edilmez. Sezon bitişini aşan pencere
  de yaratılmaz.

### 3.2 Konvoy rotası

- Her occurrence için server-only season secret ve domain-separated label
  `intergalactic-convoy:route:v1:<sequence>` ile deterministik bir yön türetilir.
- Effect snapshot `routeVersion: 1` taşır. `intergalacticConvoySpec()` bu sürüme göre dispatch eder;
  gelecekte v2 eklenir, v1 algoritması yerinde değiştirilmez. Aksi halde kod deploy'u, persisted
  occurrence aynı kaldığı halde canlı konvoyu başka bir çapa ışınlar.
- Yön 3B kürede isotropic olmalıdır: azimuth uniform `[0, 2π)`, `z` uniform `[-1, 1]`.
- `u` birim yön ve `R = GALAXY.radius` ise:

```text
from = -u × R
to   = +u × R
position(t) = lerp(from, to, clamp((t - startsAt) / 120 dakika, 0, 1))
```

- Konvoy `startsAt` anında galaksi sınırında görünür; 60. dakikada tam `(0,0,0)` merkezinden
  geçer; `endsAt` anında karşı sınırda kaybolur.
- Hız sabittir: `2 × GALAXY.radius / 120` game-unit/dakika.
- Gelecek occurrence rotaları istemciye verilmez. Yalnız aktif occurrence'ın `from`, `to`, hız
  ve zamanları public'tir.
- Route/spec occurrence kimliğinden aynı sonucu verir; restart, replica veya tekrar read rotayı
  değiştirmez.
- Çap bir dünyaya çok yakın geçebilir; bunun gameplay collision etkisi yoktur. Staging ölçümü
  route ile bütün sabit planet slotları arasındaki minimum mesafeyi raporlar. Görsel çakışma kabul
  edilemezse route'u sonradan kaydırmak yerine, occurrence yaratılırken stable planet-slot setine
  karşı domain-separated candidate rejection yapılır ve seçilen `routeVersion` algoritmasında
  dondurulur.

### 3.3 Görsel oluşum

Tek sıra yerine daha okunaklı **çift sıra** kullanılır. Oluşumun local `+Z` ekseni hareket
yönüdür; düşük tier önde, yüksek tier arkadadır. Owner görsel incelemesiyle tekrarlar kaldırılmış,
**11 rank / 22 craft** içinde her mobile Fleet V2 hull tam bir kez kullanılmıştır. Sabit v1 görünür
roster:

```text
Ön / +Z
Rank 01: DART               | PIKE
Rank 02: RAMPART            | WARDEN
Rank 03: COURIER            | VIPER
Rank 04: TALON              | STRONGHOLD
Rank 05: SENTINEL           | WAYFARER
Rank 06: TEMPEST            | BALLISTA
Rank 07: LEVIATHAN          | PRAETORIAN
Rank 08: ATLAS              | NULLIFIER
Rank 09: GARBAGE_COLLECTOR  | CATACLYSM
Rank 10: CORSAIR            | CITADEL
Rank 11: PALADIN            | ARGOSY
Arka / -Z
```

- Yeni GLB veya bitmap üretilmez. Yalnız
  `apps/web/src/ui/fleet-v2-assets.ts` içindeki `FLEET_V2_ASSET_MANIFEST` kullanılır.
- Görsel roster ile ödül roster'ı ayrıdır. Görselde 22 mobile hull vardır; ground ve Prospector
  yoktur. Versioned ödül pool'u ilk onaylanan sekiz hull olarak aynen kalır ve görsel sıra/drop
  ağırlığı arasında örtük bağ kurulmaz.
- Oluşumun gameplay hedefi görseldeki tek bir hull değil, iki sıranın geometrik merkezidir.
- Model facing/pose/scale/light/trail bilgisi manifestten okunur; `Fleets.tsx` içindeki model clone,
  exhaust, wake ve rank yapı taşları mümkün olduğunca export edilip yeniden kullanılır. Aynı GLB
  hazırlama kodunun ikinci kopyası yazılmaz.
- Sabit slotlar saf bir `convoyFormationSlots(formationVersion)` fonksiyonuyla üretilecek ve tier
  sıralaması test edilecektir. Persisted v1 occurrence current mutable layout'a düşmez. Mevcut
  `formationLayout()` ağır gemiyi öne aldığı için doğrudan kullanılamaz.
- Konvoy baseline'ı önceki değerinin tam 2×'idir. Komşu rank aralıkları hull boyutuna göre
  22/28/34/34/41/54/56/68/76/72, lateral lane aralığı 64 game unit'tir; T3/T4 ardışık rank'ları
  owner incelemesiyle ayrıca 6 unit açılmıştır. Her geminin deterministic
  ileri/geri salınımı en küçük rank boşluğunun yarısından küçüktür; rank sırası hiçbir frame'de
  değişmez. Batched wake ve instanced drive ışıkları sahne hareketini taşır; ilk pulse-ring denemesi
  owner görsel incelemesinden sonra tamamen kaldırılmıştır. İlk 16 line-streak wind denemesi de değişmeden
  geriye kayan çocukça çizgiler gibi okunduğu için kaldırılmıştır. Son uygulama, tek instanced draw içindeki
  dört şeffaf ve formation boyunca sabit flow veil'dir: vertex dalgaları ile domain-warped fragment noise
  local +Z'den -Z'ye yüzeyin içinden akar, damar biçimi sürekli evrilir ve arada karanlık boşluk bırakır.
- Event start'ında 22 model birden pop etmemelidir: ön rank sınırı ilk geçen olacak şekilde rank'lar
  kısa, deterministic fade ile içeri girer; end'de aynı sıra karşı sınırdan çıkar. Gameplay anchor
  yine oluşum merkezi ve 60. dakikada `(0,0,0)`'dır. Fade yalnız presentation'dır.
- Isotropic yön world-up eksenine paralel olabilir. Parent orientation, kör `lookAt()` yerine
  local `+Z`'yi route direction'a taşıyan stabil quaternion ve en az paralel fallback up-axis ile
  kurulmalıdır; north/south yönlerinde NaN, roll flip veya mirror testte reddedilir.

### 3.4 Saldırı ve beş saniyelik ateş

- Launch fleet en az bir `MOBILE_HULL` içermeli ve `combatValue(fleet) > 0` olmalıdır.
  Yalnız Courier/Wayfarer/Atlas/Argosy gibi ateş etmeyen yük gemilerinden oluşan filo reddedilir.
- Yük gemileri savaş değerini artırmaz; yalnız kargo kapasitesi ve en yüksek eligible tier
  hesabına katılır. Böylece savaş gemisi ödülü üretir, nakliye gemisi onu taşıyabilir.
- Sunucu ve web aynı saf `interceptLinearTransit()` hesabını kullanır. İlk ulaşılabilir kesişim
  seçilir; tam beş saniyelik ateş `endsAt` öncesinde tamamlanamıyorsa launch reddedilir.
- Kesişim anında filo konvoy oluşum merkezine gelir, konvoy durmaz. Filo beş saniye boyunca
  konvoy hızını eşleyerek yanında kalır ve ateş eder.
- Çift sıranın geometrik merkezi boşlukta kalabileceği için beam/impact VFX tam boş noktaya
  yığılmaz: `runId` ile deterministic olarak merkezdeki birkaç görünür hull/offset'e dağıtılır.
  Offset'lerin centroid'i gameplay anchor'dır; hedef seçimi yalnız presentation, hull hasarı/ölümü
  veya farklı reward üretmez.
- Bu beş saniye payload ve görselde ayrı bir moving segmenttir:
  `engagementPath = { from: intercept, to: engagementEnd, startsAt: arriveAt,
  endsAt: engagementEndsAt }`. Outbound path'in son noktasında craft'ı dondurup hareket eden
  konvoya uzaktan ışın ateşletmek yasaktır.
- Dönüş başlangıç noktası ilk intercept noktası değil, beş saniye sonunda konvoyun ulaştığı
  noktadır. `GALAXY.radius = 2000` ise konvoy beş saniyede yaklaşık 5.56 unit ilerler; bunu yok
  saymak sahibi ve izleyici görsellerini ayırır.
- Konvoy saldırmaz. `resolveCombat`, casualty, grade, Dominion, debris, salvage, Aegis, raid
  report ve bash/tier-band kodlarına girilmez. Gönderilen filonun tamamı döner.
- Mevcut `COMBAT.engagementSeconds = 10`, `engagementEndsAt()` ve `isEngaging()` dünya/korsan
  savaşlarının sözleşmesidir ve **5'e indirilmez**. Konvoy için ayrı
  `CONVOY.engagementSeconds = 5`, `convoyEngagementEndsAt()` ve `isConvoyEngaging()` eklenir.
- Public PvE saldırısı newcomer shield'ı düşürmez, PvP ceasefire/bash/tier-band sayaçlarını,
  first-strike/world-record/unlock veya raid istatistiklerini tetiklemez. World operational,
  flight-bay, fuel ve season kontrolleri ise aynen geçerlidir.
- Launch geri çağrılamaz. Yakıt iki gerçek bacak için peşin ödenir ve hiçbir hata/ödülsüzlük
  halinde iade edilmez; yalnız server-side abandonment mevcut güvenli-dönüş semantiğini uygular.
- Filo dönüşü event bittikten sonra olabilir, fakat `homeAt` sezon bitimini aşamaz.

### 3.5 Hareketli hedef kesişim kuralı

`interceptOrbit()` bu hedef için kullanılmamalıdır; konvoy dairesel yörüngede değildir. Rules
paketine genel bir doğrusal-hedef çözücü eklenmelidir:

```ts
interceptLinearTransit({
  origin,
  targetAtQuoteTime,
  targetVelocity,
  fleetUnitsPerMinute,
  minMeetMinute,
  maxMeetMinute,
}): { meetsAtMinute: number; at: Vec3 } | null
```

Çözücü `|target0 + velocity × dt - origin| = fleetSpeed × dt` denkleminin en erken geçerli,
sonlu ve `dt >= 0` kökünü bulur. Şunları fail-closed ele alır: negatif discriminant, sıfır/NaN
hız, iki kök, yaklaşan/uzaklaşan hedef, hedefle aynı noktada başlama, tangent, kayan nokta epsilon'u
ve event horizon'u. İstemci ayrı bir yaklaşık formül yazmamalıdır.

Stale quote koruması zorunludur. Yalnız `quotedFlightSeconds` kıyaslamak yetersizdir: aynı süre,
daha geç bir absolute intercept'e ait olabilir. İstemci request'e server-clock tabanlı
`quotedAt`, `quotedFlightSeconds` ve `quotedArriveAt` gönderir. Transaction içindeki server sonucu
hem süre hem absolute arrival bakımından `INTERGALACTIC_CONVOY.quoteToleranceSeconds` içinde
değilse veya `quotedAt` gelecekte/eskiyse `CONVOY_QUOTE_CHANGED` döner; UI event/planet verisini
yenileyip tekrar onay ister. Bunlar güvenlik otoritesi değil, oyuncunun gördüğü geri çağrılamaz
commit'i doğrulayan UX sözleşmesidir; gerçek bütün değerleri server yeniden hesaplar. Önerilen
başlangıç toleransı **5 saniye**, maksimum quote yaşı **15 saniye**dir; değerler tek rules
constant'ında testle kilitlenir.

### 3.6 Kaynak ödülü

Launch transaction'ında, kilitlenmiş çıkış dünyasının o andaki bina/orbit snapshot'ından nominal
iki saatlik tavan hesaplanır. Foundry multiplier dahil; mevcut stok, buffer doluluğu, Vault,
sonradan yapılan upgrade ve uçuş sırasında oluşan outage/capture dahil değildir:

```ts
const boost = productionMult(origin.orbit);
const productionCap = {
  alloy: Math.floor(alloyRate(origin.buildings.REFINERY) * boost * 2),
  crystal: Math.floor(crystalRate(origin.buildings.EXTRACTOR) * boost * 2),
  deuterium: Math.floor(deuteriumRate(origin.buildings.DEUTERIUM_PLANT) * boost * 2),
};
```

Tek bir ortak saf `quoteIntergalacticConvoyReward()` fonksiyonu kullanılmalıdır:

```text
capTotal             = alloyCap + crystalCap + deuteriumCap
firepower            = combatValue(fleet)    // yalnız ateş edebilen hull'lar
resourceFullThreshold = max(1, capTotal × fullRewardForceRatio)
resourceQualityFactor = clamp(firepower / resourceFullThreshold, 0, 1)
shipQualityFactor     = clamp(firepower / shipDropFullFirepower, 0, 1)
raw[k]                = floor(productionCap[k] × resourceQualityFactor)
cargo                 = fleetCargo(fleet, launchTech)
cargoFactor           = min(1, cargo / max(1, sum(raw)))
reward[k]             = floor(raw[k] × cargoFactor)
```

v1 için `fullRewardForceRatio = 1`; `shipDropFullFirepower` §2.4'te onaylanan bağımsız pozitif ve
finite snapshot'tır. Dolayısıyla bir filonun ateş gücü iki saatlik toplam üretim değerine ulaştığında
kaynak tavanını doldurur; daha büyük savaş filosu kaynak ödülünü iki saatin üzerine çıkarmaz. Gemi
şansı ise koloninin üretimi sıfır/düşük diye ucuzlamaz. Tek cargo factor üç kaynağa oransal
uygulanır; sıra ile önce Alloy doldurup Deuterium'u sıfırlamak yasaktır.

Kurallar:

- Her resource ayrı ayrı `0 <= reward[k] <= productionCap[k]`.
- `sum(reward) <= fleetCargo(fleet, launchTech)`.
- Ateş etmeyen gemiler iki quality factor'ı da artırmaz ama cargo'yu artırır.
- Resource quote launch'ta oyuncuya gösterilir ve snapshot run satırına yazılır; arrival sırasında
  config veya dünya tekrar okunarak farklı bir tutar üretilmez.
- Kaynaklar engagement sonunda run'a kazanılmış olarak yazılır; dünya hesabına yalnız dönüşte
  eklenir. Storage cap dönüş ödülünü silmemelidir; mevcut raid-return overcap semantiği izlenir.

### 3.7 Gemi ödülü

- `maxTier`, gönderilen tüm tier'lı mobile hull'ların en yüksek tier'ıdır. Ateşsiz taşıyıcı tier'ı
  da bu tavana katılır; ancak filo bütünü yine `combatValue > 0` olmalıdır.
- Eligible pool, §3.3'teki versioned görünür manifestin `tier <= maxTier` üyeleridir.
- Başarı olasılığı §2.4'teki `0.15 × shipQualityFactor` değeridir; resource quality ile
  karıştırılmaz.
- Başarıdan sonra adet ve tier §2.4 dağılımlarıyla çekilir; seçilen tier içindeki iki manifest
  hull'ı eşit olasılıklıdır.
- Randomness server-only season key ve `intergalactic-convoy:reward:v1:<runId>` label'ından
  türetilir. Run ID server tarafından üretilir; istemci seed seçemez.
- Sonuç `awardedFleet: Fleet` olarak run satırında bir kez persist edilir. Retry aynı sonucu verir;
  ikinci kez roll veya ikinci kez teslim yapamaz.
- Ödül gemisi için Shipyard/research/roster cap kontrolü yapılmaz; korsan capture gibi bulunan
  gemi doğrudan filoya birleşir.
- Ödül gemileri **çekilen/towed prize** sayılır: resource cargo kapasitesi tüketmez, dönüş yakıtını
  veya hızını değiştirmez ve return flight'ın visible roster'ına eklenmez. Bu değerler original
  launch fleet/tech ile frozen kalır. Ödül hull'ları yalnız return delivery transaction'ında units'e
  dönüşür.
- Engagement sonunda owner-only `convoy_result` bildirimi resource reward ve `awardedFleet`
  sonucunu “yükte, dönüşte teslim” olarak açıklar. Böylece oyuncu beş saniyelik eylemin sonucunu
  dönüş dakikaları boyunca beklemez. `fleet_returned` bildirimi teslimi ayrıca doğrular; iki mesaj
  farklı dedupe kind/ref sözleşmesine sahiptir.

---

## 4. Takvim altyapısı değişikliği

Mevcut `packages/rules/src/galaxyEvents.ts` rastgele `dailyCount`, duration, cooldown ve
`quietWindow` paketleyicisidir. Yeni istek üç event'in de **tam saatini** verdiği için random
packer'a sahte constraint'ler eklenmemelidir.

### 4.1 Typed schedule modu

`GalaxyEventDefinition` discriminated union yapılmalıdır:

```ts
type RandomDailyDefinition<E> = {
  schedule: 'RANDOM_DAILY';
  // mevcut dailyCount/duration/cooldown/quietWindow/effect/nightEffect alanları
};

type FixedDailyDefinition<E> = {
  schedule: 'FIXED_DAILY';
  version: number;
  windows: readonly {
    startsAtLocalMinute: number;
    endsAtLocalMinute: number;
    effect: E;
  }[];
};
```

Eski random planner ve testleri tarihsel davranışı korumak için yerinde kalır. Fixed planner:

- windows'u sıraya sokar ve aynı kind içinde overlap'i reddeder;
- dakika değerlerini integer ve `[0, 1440]` sınırında doğrular;
- bu v1'de cross-midnight window kabul etmez;
- her Türkiye tarihini UTC minute'a saf biçimde çevirir;
- yalnız sezona tam sığan occurrence'ları üretir;
- kind başına sequence'i sıfırdan ve start sırasıyla verir;
- effect'i pencerenin kendisinden snapshot eder;
- en sonda ortak `assertMutuallyExclusiveEventWindows()` kontrolünü çalıştırır.

`plannedEffectFor()` fixed kind için yalnız config'de gerçekten bulunan exact local start minute'ı
eşleyebilir; eşleşme yoksa fail closed olur. Yakın pencereye yuvarlamak veya generic day/night
effect'e düşmek, özellikle 02:00 ×3 ile 20:00 ×10'u restamp sırasında karıştırır.

### 4.2 Kind ve sürümleme

- `GalaxyEventKind`, `GalaxyEventEffects`, `PlannedGalaxyEvent`, `GALAXY_EVENT_KINDS`, map ve
  bütün exhaustive switch'lere `INTERGALACTIC_CONVOY` eklenir.
- `GALAXY_EVENT_KINDS` append-only kalır:
  `['ASTEROID_SHOWER', 'TRADE_SHIP', 'INTERGALACTIC_CONVOY']`.
- Yeni route RNG label'ı `intergalactic-convoy:route:v1`; reward label'ı ayrı namespace'tir.
- Yeni effect tipi en az şu versioned politikayı snapshot eder:

```ts
interface IntergalacticConvoyEffect {
  routeVersion: 1;
  formationVersion: 1;
  resourceCapHours: 2;
  fullRewardForceRatio: 1;
  shipDropFullFirepower: number; // v1: creation anındaki combatValue({ CATACLYSM: 1 })
  shipDropChanceAtFullQuality: 0.15;
  shipCountWeights: readonly [0.80, 0.17, 0.03];
  shipTierWeights: readonly [0.55, 0.27, 0.13, 0.05];
  rewardPoolVersion: 1;
}
```

Effect parser bütün numeric alanlarda finite/positive sınırlarını, probability'lerde `[0,1]`'i ve
count/tier weight toplamlarının epsilon içinde `1` olmasını doğrular. `rewardPoolVersion` explicit
hull listesine dispatch eder; current catalog'dan dinamik pool türetilmez.

- Asteroid definition `2 -> 3`, Trade definition `2 -> 3`, Convoy definition güncel schedule/effect
  snapshot'ı için `2` olur.
- Top-level `GALAXY_EVENTS.version` da yeni schedule shape ile artırılır. Yeni
  `INTERGALACTIC_CONVOY`/`CONVOY` rules constant'ı duration, engagement, quote tolerance,
  formation ve reward defaults'unun tek kaynağıdır; server/web literal tekrar yazmaz.
- `MULTI_WORLD.rulesetVersion` mevcut 7'den **8**'e çıkarılır.
- Yeni `fixedGalaxyEventScheduleRulesetVersion: 8` ve
  `intergalacticConvoyRulesetVersion: 8` boundary'leri eklenir. Eski canlı sezonlar kendi
  persisted occurrence'larını aynen tutar.
- `CALENDAR_LABEL` Record'a yeni kind append edilir. Fixed takvim saat seçimi için RNG tüketmez;
  rota ve ödül RNG'leri calendar stream'inden ayrıdır.
- `GenerateGalaxyEventScheduleInput.rngFor` sözleşmesi açıkça güncellenir: her random kind için bir
  kez istenir; fixed kind için hiç istenmez. Bir fixed kind eklemek Asteroid'in legacy random
  stream'inden tek draw bile tüketemez.

Sadece convoy'u ruleset 8'e gate etmek yeterli değildir: `seedGalaxyEventCalendar()` current global
definitions okuduğu için deploy sonrasında elle ruleset 4/6/7 ile yaratılan bir season yanlışlıkla
yeni sabit Asteroid/Trade takvimini alabilir. Şu iki çözümden biri testle zorunlu seçilmelidir:

1. **Öneri:** `galaxyEventConfigForRuleset(version)` ile ruleset 4–5, 6–7 ve 8+ için frozen config
   registry tutmak.
2. Eski ruleset'le yeni season yaratmayı route/CLI seviyesinde açıkça reddetmek.

“Mevcut season zaten persist edildi” bu creation-path açığını kapatmaz.
`restampFutureOccurrences()` da satırın season `rulesetVersion` değerini join edip aynı registry'yi
kullanmalıdır; current global definitions ile eski random başlangıç saatini fixed pencereye
eşlemeye çalışmamalıdır. Bir CLI çağrısı farklı ruleset sezonlarını kapsıyorsa her satır kendi
config'iyle restamp edilir veya unsupported kombinasyon daha hiçbir row yazılmadan açıkça reddedilir.

### 4.3 Canlı sezonu değiştirmeme

`galaxy_event_occurrences` sezon yaratılırken bir kez dealt/persist edilir. Bu nedenle:

- Sabit saatler ve yeni kind varsayılan olarak **yalnız ruleset 8 ile açılan yeni sezonda** başlar.
- `restampFutureOccurrences()` yalnız effect günceller; zamanı veya kind listesini değiştirmek
  için kullanılmaz ve effect'i occurrence'ın season ruleset config'inden hesaplar.
- Mevcut canlı sezondaki Trade/Asteroid zamanları yeniden dağıtılmaz.
- Canlı sezona konvoy eklemek daha sonra ayrıca istenirse ayrı, açık yetkili, dry-run'lı ve
  idempotent bir CLI yalnız gelecekteki `INTERGALACTIC_CONVOY` satırlarını append edebilir.
  Trade/Asteroid satırlarına dokunamaz. Bu planın default rollout'u bu değildir.

### 4.4 Shipping ile ekonomi ölçümünü ayırma

Şu anda `seedGalaxyEventCalendar()` şu erken çıkışı yapıyor:

```ts
if (!ECONOMY_PROFILE.tradeShip && !ECONOMY_PROFILE.asteroidShower) return;
```

Bu, yorumlarda “measurement switch” denen değerleri fiilen shipping switch'i yaptığı için yeni
istekle çelişir. Uygulama ajanı önce bu bağı ayırmalıdır:

- Calendar seeding `ECONOMY_PROFILE` okumamalıdır.
- Shipping entitlement yalnız season ruleset boundary'lerinden ve gerekiyorsa ayrı açık isimli
  bir `PUBLIC_GALAXY_EVENTS_ENABLED` runtime/deploy config'inden gelmelidir.
- `ECONOMY_PROFILE.tradeShip/asteroidShower` false kalır; konvoy için economy flag eklenmez.
- `waiting-servers.test.ts` içindeki “bilerek kırmızı” tripwire yeni sözleşmeyle güncellenir:
  economy flags false iken yeni ruleset sezonunun public event calendar'ı oluştuğunu kanıtlayan
  yeşil isolation testi olur.
- `CLAUDE.md` ve `docs/balance.md` mevcut erken-return açıklamasıyla birlikte güncellenir.
- Ekonomi araçlarının raporladığı `excluded` metadata/listesine `intergalactic-convoy` eklenir ve
  exclusion guard testi güncellenir. Bu, event income modellemek değil; bilerek model dışı
  bırakıldığını makinece okunur biçimde kanıtlamaktır.

Bu ayrım yapılmadan konvoyu sadece config'e eklemek üretimde hiçbir occurrence yaratmayabilir.

---

## 5. Veri modeli ve migration

Migration, mevcut Drizzle journal'dan sonraki numarayla generate edilmelidir; çalışma ağacı kirli
olduğu için bu plan sabit dosya numarası dayatmaz.

### 5.1 Append-only enum'lar

Sıra değiştirmeden sona ekle:

- `galaxy_event_occurrence_kind`: `INTERGALACTIC_CONVOY`
- `event_kind`: `convoy_arrival`, `convoy_return`
- `notification_kind`: `convoy_result`
- Yeni `intergalactic_convoy_run_status`: `outbound`, `returning`, `done`

`mission_kind` genişletilmez. Lifecycle mevcut `galaxy_event_started/ended`, dönüş mevcut
`fleet_returned` kind'ını kullanır; `convoy_result` yalnız beş saniyelik engagement'ın owner-only
sonucudur. Bütün enum değerleri sona append edilir, reorder edilmez.

### 5.2 `intergalactic_convoy_runs`

Yeni tablo:

| Alan | Anlam |
|---|---|
| `id` | server-generated UUID, reward RNG kimliği |
| `season_id` | season FK |
| `occurrence_id` | `galaxy_event_occurrences` FK |
| `planet_id` | çıkış dünyası ve parked-units sahibi |
| `owner_player_id` | filoyu gönderen komutan; pad el değiştirirse değişmez |
| `status` | outbound / returning / done |
| `fleet` | immutable launch roster |
| `tech` | launch anındaki doctrine/propulsion/cargo snapshot'ı |
| `intercept_x/y/z` | ateşin başladığı, bir kez çözülen nokta |
| `engagement_end_x/y/z` | beş saniye sonunda dönüşün başladığı nokta |
| `return_x/y/z` | launch anındaki origin planet koordinatı; immutable visual dönüş endpoint'i |
| `depart_at` | gidiş başlangıcı |
| `arrive_at` | beş saniyelik ateşin başladığı an |
| `engagement_ends_at` | exact `arrive_at + 5s`; pending/worker tek clock'u |
| `home_at` | iki bacak da bilindiği için launch'ta yazılan immutable dönüş anı |
| `production_cap` | launch dünyasının iki saatlik frozen Resources tavanı |
| `resource_quality_factor` | resource quote audit'i için 0..1 |
| `ship_quality_factor` | bağımsız ship drop olasılığı audit'i için 0..1 |
| `quoted_resource_reward` | launch'ta hesaplanan ve UI'a gösterilen immutable Resources |
| `resource_reward` | arrival'da bir kez persist edilen Resources; önce null |
| `awarded_fleet` | arrival'da bir kez persist edilen 0/1–3 gemi; önce null |

İndeksler ve constraints:

- `(season_id, status)` ve `(owner_player_id, status)` normal index.
- **Partial unique:** `.on(planetId).where(status <> 'done')`. Occurrence ID bu indexte yoktur;
  kural aynı eventte değil, tüm konvoy akınlarında o dünyadan yalnız bir aktif filo olmasıdır.
- Kilit fiziksel dünyaya aittir ve control transfer'da düşmez. Yeni controller, eski komutanın
  run'ı `done` olmadan aynı pad'den konvoy launch edemez; aksi karar istenirse unique/index ve
  “her gezegenden bir filo” yorumu birlikte owner tarafından değiştirilmelidir.
- Service aynı kontrolü kullanıcı dostu `CONVOY_FLEET_ALREADY_AWAY` için yapar; DB index iki
  replica/request yarışının otoritesidir.
- İki quality kolonu finite ve `[0,1]`; zaman sırası
  `depart_at <= arrive_at < engagement_ends_at <= home_at`; production/reward değerleri
  non-negative doğrulanır. JSON sınırları yine Zod ile parse edilir.
- Yeni koordinat ve quality kolonları `real` yerine `double precision` olmalıdır; beş saniyelik
  moving segment DB round-trip precision'ı yüzünden client/server hedefinden ayrılmaz.
- `quoted_resource_reward` launch'tan itibaren non-null'dır. `resource_reward` ve `awarded_fleet`
  yalnız unresolved outbound run'da null olabilir; arrival sonucu yoksa zero Resources ve `{}`
  yazılır. Böylece “roll çalışmadı” ile “çalıştı, ödül çıkmadı” aynı değer olmaz.
- Parked unit location: `intergalactic-convoy:<runId>`.

### 5.3 Effect ve payload type'ları

- `galaxy_event_occurrences.effect` union'ına `IntergalacticConvoyEffect` eklenir.
- Server `effectSchema` discriminated union'ına yeni exact Zod shape eklenir. JSONB hiçbir yerde
  doğrudan cast edilmez; mevcut `occurrenceEffect()` tek kapı kalır.
- `GalaxyEventLifecyclePayload` yeni branch taşır: event kind, startsAt, endsAt ve ödül politikasını
  açıklamak için `resourceCapHours`/`shipDropChanceAtFullQuality`. Kalıcı Chronicle'a route,
  secret, formation koordinatı veya ödül roll'u yazılmaz.
- `convoy_result` ve `fleet_returned` payload'ları aynı stable `runId`,
  `trip: 'intergalactic_convoy'`, resource reward, awarded fleet ve gerekli destination bilgisini
  structured taşıyan ayrı discriminated branch'ler alır. Çevrilmiş cümle server payload'ına
  yazılmaz; `runId` offline recap coalescing/dedupe anahtarıdır.

### 5.4 Silme, reclaim ve transfer bağımlılıkları

Yeni tablo şu yolların tamamına eklenmelidir:

- season wipe/delete sırası (`services/servers.ts`): run'lar occurrence ve planetlerden önce;
- account/player reclaim (`services/reclaim.ts`): aktif run varken veri kaybetme/dangling FK yok;
- account deletion shared reclaim/busy/commander-row yolları: yalnız doğrudan reclaim route'u değil,
  aynı helper'ları kullanan hesap silme de convoy run'ını görür;
- commander transfer (`services/commanderTransfer.ts`): aktif run transferi engelleyen taramaya ekle;
- scheduled transfer policy (`services/transferReferences.ts`): `convoy_arrival` ve
  `convoy_return` mevcut pirate/trade gibi `BLOCKER`; closed Record/exhaustiveness testi güncellenir;
- flight-bay hesabı (`services/flight.ts`): `status != done` bay'i meşgul eder;
- `onSeasonEnd()`/server close readiness: outbound/returning convoy sayısı sıfır olmadan season
  wipe/closure tamamlanmış kabul edilmez;
- health/stranded sayımı ve worker abandon sweep;
- test DB cleanup/fixture reset ve schema drift snapshot'ları.

---

## 6. Server servisleri ve lifecycle

### 6.1 Public field/spec

Yeni `apps/server/src/services/intergalacticConvoyField.ts`:

- occurrence + season key'den `IntergalacticConvoySpec` üretir;
- yalnız aktif occurrence lookup'u sunar;
- route seed'ini ve gelecekteki occurrence'ları sızdırmaz;
- rules paketinin `intergalacticConvoyPosition()` fonksiyonunu kullanır;
- aynı input için replica/restart boyunca aynı from/to değerini üretir;
- Trade Field kalıbındaki gibi bounded LRU kullanacaksa cache key season key + occurrence
  ID/sequence + starts/ends + `routeVersion`ın tamamını kapsar. Yalnız sequence'e göre cachelemek,
  test/fixture veya aynı key'le farklı pencereyi yanlış spec'e bağlar; secret loglanmaz.

`activeGalaxyEvents()` yeni branch'te şunu döndürür:

```ts
{
  id,
  kind: 'INTERGALACTIC_CONVOY',
  startsAt,
  endsAt,
  appearsAtMinute,
  expiresAtMinute,
  route: { from, to, speed },
  visual: { formationVersion },
  rewardPolicy: {
    resourceCapHours,
    fullRewardForceRatio,
    shipDropFullFirepower,
    shipDropChanceAtFullQuality,
    maxAwardedShips: 3,
  },
}
```

### 6.2 Launch transaction'ı

Yeni `apps/server/src/services/intergalacticConvoyRaid.ts` ve route
`POST /api/intergalactic-convoy/launch` oluşturulur. Strict Zod body:

```ts
{
  originPlanetId: uuid, // zorunlu: hangi başkent/koloninin kilitlendiği belirsiz olamaz
  occurrenceId: uuid,
  fleet: mobileFleetSchema,
  quotedAt: ISO UTC timestamp,
  quotedFlightSeconds: nonnegative finite number,
  quotedArriveAt: ISO UTC timestamp,
}
```

Body object ve fleet map `.strict()` olmalıdır; hull count'ları pozitif safe integer, timestamp'ler
timezone taşıyan geçerli ISO UTC olmalı, unknown/zero/negative/fractional/unsafe değerler service'e
ulaşmadan reddedilmelidir. Server yine availability ve arithmetic overflow sınırlarını transaction
içinde kontrol eder.

Route mevcut `idempotency-key` header kalıbını zorunlu kullanmalıdır. Web confirmation başına bir
key üretir ve double-tap/network retry'larında **aynı key'i** gönderir. Route
`idempotentMutation()` içine girer; launch core mevcut `Tx`'i kabul eder ve nested transaction
açmaz. Aynı key/farklı body `IDEMPOTENCY_CONFLICT`; aynı key/aynı body ilk başarılı command'in
run ID ve immutable launch sonucunu verir. Aksi halde ilk transaction başarılı fakat response
kayıpsa retry “fleet already away” diyerek yanlış sonuç verir.

Mevcut idempotency helper tam HTTP response'u saklıyorsa D53 `planet + pending` snapshot'ını körlemesine
replay etmek yasaktır: gecikmiş retry, daha yeni cache'i eski unit/resource state'ine geri sarabilir.
Request log yalnız immutable command sonucu/run ID'yi saklamalı veya helper bir replay hook'u
sunmalıdır; ilk yanıt ve replay'de volatile authoritative `planetView + pending` HTTP dönmeden hemen
önce server tarafında yeniden hydrate edilir. Client aynı response shape'i alır ama hiçbir replay
eski snapshot'ı cache'e yazmaz. Route ayrıca mevcut authenticated mutation rate limitini korur;
idempotency per-world unique indexin yerine geçmez.

Transaction sırası değiştirilemez:

1. Auth hesabından owner/player çöz; occurrence ID'nin başka season'da varlığına dair bilgi sızdırma.
2. `loadLocked()` ile çıkış dünyasını lock et ve ekonomiyi authoritative `now`'a advance et.
3. Season açık, world operational ve caller owner kontrollerini yap.
4. Fleet sayıları, mobile-only, availability ve `combatValue > 0` doğrula.
5. Bu dünyada `status != done` convoy run olmadığını kontrol et; DB unique violation'ı aynı domain
   hatasına çevir.
6. `assertFreeBay()` çağır; yeni run flight bay sayımına dahil olmalıdır.
7. Active, aynı-season `INTERGALACTIC_CONVOY` occurrence/spec'i çöz.
8. Launch tech snapshot'ını al; fleet pace ve en erken linear intercept'i hesapla.
9. `arriveAt + 5 saniye <= occurrence.endsAt` değilse `CONVOY_OUT_OF_REACH`.
10. `quotedAt`, `quotedFlightSeconds` ve absolute `quotedArriveAt` farklarını §3.5'e göre doğrula;
    stale ise hiçbir şey harcamadan reddet.
11. Production cap, iki ayrı quality factor, cargo ve exact resource quote'u saf rules
    fonksiyonundan hesapla.
12. Dönüş başlangıcı olarak `position(arriveAt + 5s)`, immutable endpoint olarak launch anındaki
    origin planet koordinatını kullan. Gidiş ve dönüş mesafesini ayrı hesapla.
13. Her iki bacak yakıtını launch roster için topla, authoritative deuterium'dan peşin al.
    Mevcut `missionFuel(fleet, distance, 2)` simetrik varsayımıyla kullanılmaz. Rules'ta
    `missionFuelForDistances(fleet, [outboundDistance, returnDistance])` gibi tek shared helper
    ekle; her bacağın rounding'ini testle kilitle.
14. Frozen tech/orbit speed snapshot'ıyla dönüş süresini ve exact `homeAt`'ı şimdi hesapla;
    `assertSeasonOpenThrough(homeAt)` yap. Worker zamanı veya ownership değişimi bunu değiştiremez.
15. Run'ı `engagementEndsAt`, `homeAt`, immutable return point ve `quotedResourceReward` dahil
    insert et, filoyu
    `intergalactic-convoy:<runId>` konumuna park et, origin unit'lerinden çıkar ve fuel'i kaydet.
16. `convoy_arrival` event'ini **engagement bitişine** schedule et; dedupe key
    `convoy:arrival:<runId>`.
17. Private/player ve shard realtime yayınlarını transaction outbox düzeninde yap.
18. Idempotent immutable sonucu yaz; sonra D53 biçiminde **o response anındaki** authoritative
    planet + pending + run quote cevabını hydrate edip dön.

Launch cevabı en az run/occurrence ID, frozen fleet, depart/arrive/engagement-end/exact homeAt,
iki nokta, flight seconds, fuel, production cap, resource/ship quality, cargo, quoted resource
reward, pending ve authoritative planet içermelidir. Ship drop sonucu launch cevabında açıklanmaz;
yalnız hesaplanan şans gösterilir, roll engagement sonunda yapılır.

### 6.3 Arrival handler

`convoy_arrival` job tam `arriveAt + 5s` anını temsil eder:

1. Run ve occurrence'ı transaction içinde yükle.
2. Atomic `outbound -> returning` claim yap; zero row duplicate/retry demektir ve no-op'tur.
3. `quoted_resource_reward` değerini `resource_reward` alanına kopyala; current world/config
   okuyup yeniden fiyatlama yapma.
4. Server-only deterministic RNG ile `awardedFleet` roll et ve iki ödülü aynı transaction'da yaz.
5. Aynı transaction'da idempotent owner-only `convoy_result` notification yaz; resource ve ship
   ödülünün yolda olduğunu belirt.
6. Orijinal fleet parked kalır; kayıp üretme. Awarded hull'ı parked unit olarak ekleme.
7. Dönüş süresi/endpoint'i yeniden hesaplama; launch'ta frozen `return_x/y/z` ve `homeAt` kullan.
   `safeHomePlanet` burada rota üretmez, yalnız return delivery transaction'ında sahipliği çözer.
8. `convoy_return` event'i stored `homeAt` için dedupe key `convoy:return:<runId>` ile schedule edilir.
9. Pending/traffic ve görsel engagement invalidation yayınlanır. Resource veya award payload'ı
   public shard event'ine konmaz.

Arrival handler occurrence'ın worker `now` anında hâlâ aktif olmasını tekrar şart koşmaz. En geç
geçerli saldırı `convoy_arrival` ile `galaxy_event_end` job'ını aynı timestamp'e koyabilir;
handler'lar hangi sırada claim edilirse edilsin kabul edilmiş run aynı ödülü alır.

Worker geç kalıp hesaplanan `homeAt` geçmişteyse return event due olarak yazılır ve normal queue
hemen işler; filonun gecikmesi katlanarak büyütülmez.

### 6.4 Return handler

1. Atomic `returning -> done` claim.
2. `safeHomePlanet(ownerPlayerId, originalPlanetId)` çağır. Koloni uçuş sırasında ele geçirildiyse
   filo ve ödül captor'a değil komutanın güvenli dünyasına gider.
3. Parked original fleet ile `awardedFleet` birleştirilir ve destination units'e eklenir.
4. `resource_reward` destination resource store'a raid-return semantiğiyle eklenir.
5. Parked location temizlenir; wealth ilgili planet/player için yeniden hesaplanır.
6. Tek `fleet_returned` bildirimi resource ve awarded fleet özetiyle yazılır.
7. Private + shard invalidation yayınlanır.

Status claim, notification dedupe ve persisted rewards birlikte exactly-once gözlenen sonuç sağlar;
handler içindeki herhangi bir external/random side effect transaction dışında kalmamalıdır.

### 6.5 Abandonment ve recovery

- `convoy_arrival` kalıcı fail olursa original fleet güvenli eve döner; reward sıfırdır; fuel iade
  edilmez.
- `convoy_return` kalıcı fail olursa arrival'da persist edilmiş resource ve awarded fleet
  kaybedilmeden güvenli eve teslim edilir.
- `sweepStranded()` SQL'i iki convoy event kind'ını ve run status'larını bilir.
- `/health` stranded flight count convoy run'larını kapsar.
- Worker restart, duplicate event, failed job reset ve out-of-order invocation test edilir.
- Occurrence event bitti diye aktif run silinmez veya geri çağrılmaz.

---

## 7. Fog, traffic ve realtime

Konvoy public bir galaxy event; ona giden oyuncu filosu sıradan player traffic'tir.

- Konvoyun kendisi `activeGalaxyEvents` üzerinden herkese görünür ve `Contact` olarak ikinci kez
  yayınlanmaz.
- Oyuncunun kendi akını `pendingThreads()` üzerinden full fleet ve exact path ile görünür;
  `traffic.ts` kendi craft'ını dışarıda tutmaya devam eder.
- Own pending branch zorunlu `originPlanetId` taşır. Seçili dünyadaki “konvoy filosu zaten yolda”
  state'i isim veya koordinat karşılaştırmasıyla türetilmez; başkent ve koloniler stable ID ile
  eşlenir. Foreign/incoming payload bu alanı almaz.
- PlanetView/current-owner action contract'ı ayrıca generic `convoyLaunchLocked`/bay occupancy
  boolean'ı taşımalıdır. Control transfer sonrası yeni sahibi bloke eden eski run'ın owner ID,
  fleet, route, reward veya homeAt'ı açıklanmaz; eski komutan kendi account pending'inde full thread'i
  görmeye devam eder.
- Yabancı saldırı filosu mevcut `sensorZone` kurallarından geçer: NONE'da craft/path yok,
  CONTACT/Radar'da mevcut mass/silhouette, IDENTIFIED/Telescope'da exact fleet. Owner, origin,
  cargo, reward ve tam planet endpoint'i asla public olmaz.
- Beş saniyelik ortak event etkisi için NONE gözlemci yalnız konvoy üzerinde anonim muzzle/impact
  flash görebilir; attacker craft veya bearing üretilemez. Contact görünürse mevcut volley sistemi
  o craft'ı formation olarak çizer. Bu ayrım fog testine yazılmalıdır.
- Bir occurrence'a farklı dünyalardan/oyunculardan aynı anda sınırsız sayıda run bağlanabilir.
  Traffic/scene projection bunu `Map<occurrenceId, engagement>` gibi tek slotta tutamaz; her
  engagement `runId` ile ayrı listelenir. Son gelen saldırı öncekini overwrite etmez, konvoy hızını
  veya rotasını değiştirmez ve bir oyuncunun state'i başka oyuncunun visibility'sine taşmaz.
- `PendingThread.kind` append edilir: `intergalactic_convoy`. `leg` outbound/return kalır;
  engagement `arriveAt <= serverNow < engagementEndsAt` ile türetilir, üçüncü DB status şart
  değildir. Branch ayrıca `engagementPath` taşır; own craft bu aralıkta `from -> to` interpolate
  edilir, outbound `path.to` üzerinde tutulmaz.
- Görsel faz worker claim zamanından değil frozen timestamp'lerden türetilir: `arriveAt` öncesi
  outbound, `engagementEndsAt` öncesi engaging, sonra `homeAt`'a kadar return. Arrival worker birkaç
  saniye geç kaldı diye craft konvoy üstünde donmaz. `now >= homeAt` olduğu halde DB hâlâ `done`
  değilse endpoint'te “teslim ediliyor” olarak clamp edilir; extrapolate, duplicate delivery veya
  client-side unit grant yapılmaz. Persisted status hâlâ reward/delivery otoritesidir.
- Return path `engagement_end` noktasından başlamalı; owner pending ve stranger traffic aynı
  visual-leg kuralını kullanmalıdır.
- Ownership değişirse uçuş çizgisi launch'ta frozen eski origin koordinatına gider; mid-flight
  başka dünyaya kırılıp zıplamaz. Teslim transaction'ı `safeHomePlanet` ile güncel destination'ı
  seçer ve owner-only dönüş payload'ı gerçek teslim dünyasını söyler. Visual endpoint ile delivery
  destination'ın bu bilinçli ayrımı contract testine yazılır.
- Lifecycle mevcut `galaxy-event` SSE invalidation'ını kullanır. Launch/arrival/return mevcut
  transaction-safe bus kalıbıyla pending, traffic, planet, galaxy events ve notification query'lerini
  uyandırır. Yeni poll loop eklenmez.
- Aynı timestamp'teki eventlerin API/notification order'ı stabil secondary key kullanır; client
  her refetchte chip veya Chronicle satırlarını yer değiştirmez.

Önemli strict-schema riski: `apps/web/src/api/schemas.ts` içindeki active event parser bilinmeyen
kind'ı sessizce düşürür; pending parser ise bilinmeyen kind yüzünden tüm pending response'u
reddeder. Server yayına çıkmadan iki union da aynı dilimde güncellenmelidir.

---

## 8. Web istemcisi ve 3B sahne

### 8.1 API ve cache

- `activeGalaxyEventSchema` yeni discriminated branch'i route/reward policy ile parse eder.
- `galaxyLifecyclePayloadSchema` ve known-kind set yeni kind'ı bilir.
- `convoyLaunchSchema` strict response'u parse eder; yeni client method ve mutation eklenir.
- Mutation başlamadan ilgili eski planet/pending fetch'leri cancel edilir; success'te authoritative
  planet ve pending doğrudan cache'e yazılır, ardından `traffic`, `galaxyEvents`, `worlds`,
  notifications uygun şekilde invalidate edilir.
- Mutation component remount/timeout/double-tap boyunca confirmation'a ait aynı idempotency key'i
  korur; ancak yeni kullanıcı confirm'i yeni key üretir. Replay response'undaki planet/pending'in
  server tarafından yeniden hydrate edildiği contract testle doğrulanmadan cache'e doğrudan yazılmaz.
- Active-event query'nin mevcut cadence ve SSE invalidation'ı yeniden kullanılır. Konvoy konumu
  için network polling yapılmaz; `serverNow()` ve saf position fonksiyonu yeterlidir.
- `useFleetArrivals()` yalnız `arriveAt` ile yetinmez: convoy pending için `arriveAt`, exact
  `engagementEndsAt` ve return `homeAt` momentlerini arm eder. Arrival anındaki refetch worker'ın
  beş saniye sonraki status değişimini kaçırmamalıdır; SSE ve bounded settle offsets korunur.

### 8.2 Event chip ve focus

- `ActiveGalaxyEvent.tsx` nested ternary yerine kind bazlı exhaustive renderer/helper'a ayrılır.
- Konvoy chip'i adı ve kalan süreyi gösterir; Ticaret Gemisi gibi pressable olup oluşuma focus eder.
- `Focus` union'ına `{ kind: 'intergalacticConvoy'; id: string }` eklenir.
- `GalaxyCanvas` focus resolver her frame aynı rules-derived doğrusal konumu izler.
- Focus rail kapalı halde ad + kalan süre + seçili dünyadan yaklaşık erişim özetini gösterir.
- Açık detay şunları açıkça yazar:
  - “Konvoy karşılık vermez; filon kayıp vermez.”
  - “Ateş süresi 5 sn.”
  - “Launch geri çağrılamaz; yakıt iki bacak için peşin.”
  - seçili filonun Ateş gücü, Kargo, ayrı resource quality ve ship quality factor'ları;
  - her resource için iki saatlik tavan, quality sonrası ham ödül ve kargo sonrası gerçek quote;
  - gemi drop yüzdesi, 1–3 adet ve max eligible tier;
  - bu dünya için aktif convoy run varsa dönüş anı ve neden ikinci launch yapılamadığı.

### 8.3 Launch sheet

Yeni `IntergalacticConvoySheet.tsx` önerilir; normal `LaunchSheet` combat forecast/defender
semantiğine sahip olduğu için boolean prop'larla bozulmamalıdır. Yine de `FleetCards`, roster order,
quantity controls, firepower/cargo ve flight bar ortak component olarak reuse edilir.

- World context hangi başkent/koloninin launch ettiği gerçeğini taşır.
- `originPlanetId` request, launch response ve own pending'de aynı stable ID'dir; optional capital
  fallback yoktur.
- Aynı dünya aktifken action disable; diğer dünyaya geçince enable olabilir.
- Dünya yeni ele geçirilmiş ve önceki komutanın run'ı hâlâ aktifse own pending görünmese bile generic
  planet occupancy action'ı disable eder; UI eski owner/run ayrıntısı uydurmaz veya istemez.
- Yalnız cargo seçiliyse “ateş edebilen en az bir gemi” açıklaması gösterilir.
- Ulaşamayan/5 saniyeyi event bitmeden tamamlayamayan filo için ETA yerine açık refusal vardır.
- Confirm yüzeyi fuel, gidiş ETA, 5 saniye, tahmini dönüş, resource quote ve ship chance'i commit
  öncesinde gösterir.
- `CONVOY_QUOTE_CHANGED` cevabı selection'ı silmeden refetch + tekrar onay ister.

### 8.4 `IntergalacticConvoy.tsx`

- Tek parent `THREE.Group` kullanır. `useFrame` içinde ref'in position/quaternion'u
  `serverNow()` sonucundan set edilir; frame başına React state/setState yoktur.
- Formation slotları, model listesi ve static geometry `useMemo`/module constant olarak tutulur.
- Her gemi `FLEET_V2_ASSET_MANIFEST` ve mevcut posed model helper'larını kullanır.
- Focus hit area bütün oluşumu kapsar; her tek hull ayrı focus target değildir.
- Hull baseline'ı 2×; size-aware longitudinal/64 lateral slot geometrisi ve bounded longitudinal
  salınım rules/web testleriyle sabittir. Wakes tek buffer/draw, motor ışıkları instanced'dır.
- Focus range, son nose-to-tail uzunluk + 45° FOV + portrait padding üzerinden türetilir ve exact
  uygulanır; yakın kamera da filoyu kırpamaz. Subject oluşumun uzunluk orta noktasıdır.
- Odaklanınca ince route diameter çizgisi gösterilebilir; event aktif değilken route sahnede kalmaz.
- GLB'ler mevcut `useGLTF` cache'ini kullanır. 22 modeli koşulsuz global preload etmeden önce
  açılış bundle/network etkisi ölçülür; tercihen occurrence aktifken preload edilir.
- Yeni inline büyük dependency, barrel import veya istemci/server aynı formülünün kopyası eklenmez.
- Mevcut `Bombardment`/volley static world veya duran pirate hedefi varsayıyorsa global davranışı
  değiştirilmez. Ayrı `ConvoyVolley` ya da target-position callback'i, attacker ve convoy anchor'ını
  her frame aynı moving engagement clock'undan okur. Çok sayıda eşzamanlı attacker için VFX/draw
  count ölçülür ve yalnız presentation tarafında deterministic cap/aggregation uygulanır; own
  volley hiçbir zaman cull edilmez.
- WebGL/GLB yükü gecikse veya context kaybolsa bile DOM chip -> focus rail -> launch sheet yolu
  kullanılabilir kalır; 3B model action'a erişimin tek kapısı değildir.

Bu maddeler React 19/R3F performans incelemesine dayanır: konum sürekli değişen bir görsel için
component re-render/poll yerine ref güncellemesi kullanmak ana koşuldur.

### 8.5 Pending, Signals, Chronicle ve i18n

- `PendingStrip` target identifier `INTERGALACTIC_CONVOY` değerini TR/EN yerelleştirir; gidiş,
  “ateş ediyor” ve dönüş halleri ayrılır.
- Return notification resource miktarlarını icon + sayı ve awarded hull'ları canonical isimleriyle
  gösterir.
- `Signals`, notification route/deep-link ve `ChronicleScreen` iki eventli ternary'den exhaustive
  kind renderer'a çevrilir; aksi halde üçüncü kind Asteroid metniyle görünür.
- Bir akın normalde iki kişisel an üretir: engagement'ta “ödül yolda”, dönüşte “teslim edildi”.
  Kalıcı notification satırları ayrı kalabilir; fakat `buildReturnPayload()` içindeki en fazla beş
  satırlık “while away” özeti aynı `runId` için bunları tek satırda coalesce eder: dönüş olmuşsa
  teslimi, henüz yoldaysa sonucu gösterir. Çok sayıdaki konvoy akını PvP baskın/scan uyarılarını
  listeden düşürmemeli; mevcut güvenlik/stratejik olay önceliği korunur.
- TR/EN locale'lerinde event adı, chip, rail, sheet, refusals, start/end lifecycle ve return result
  stringleri aynı PR'da eklenir.
- 350 px telefonda ad, timer ve action kırpılmadan; keyboard/focus ve reduced-motion durumunda
  anlaşılır olmalıdır.

---

## 9. Adım adım uygulama fazları

Her faz kendi kırmızı testleriyle başlar. Testi olmayan production dilimi tamamlanmış sayılmaz.

### Faz 0 — Karar ve mevcut baseline

- [ ] `CLAUDE.md` ve doğrudan ilgili docs/service/test dosyalarını oku.
- [ ] §2.1–2.8 kararlarını owner ile kapat; özellikle saat typo'su, tekrar riski, iki kalite eşiği,
  reward pool, oyuncu adı, sınır semantiği ve erişim garantisini kayda geçir.
- [ ] Kararı yeni `D200+` numarasını mevcut `docs/decisions.md` sırasına bakarak kaydet; numarayı
  bu plandan körlemesine seçme.
- [ ] Dirty worktree'deki kullanıcı değişikliklerini kaydet; unrelated dosyaları restore/reformat etme.
- [ ] Başlangıçta targeted mevcut rules/server/web event, trade ve pirate testlerini çalıştırıp
  baseline hata listesini kaydet. Mevcut unrelated kırmızıları yeni özellikle “düzeltme”.

**Çıkış:** Bütün ürün belirsizlikleri yazılı onaylı; test baseline biliniyor.

### Faz 1 — Sabit takvim ve kind contract

- [ ] Önce `packages/rules/test/galaxy-events.test.ts` içine exact TRT window, multiplier,
  half-open, partial season day, overlap, invalid fixed config ve append-only kind testlerini yaz.
- [ ] `GalaxyEventDefinition` schedule union'ını ve fixed planner'ı uygula.
- [ ] Üç definition'ı §3.1 saatlerine geçir; effect/version'ları ekle.
- [ ] `plannedEffectFor()` exact fixed-start eşlemesini ve aynı timestamp stable secondary order'ı
  testle; 02:00/03:00 ve 23:00 çift event sınırlarını özellikle kapsa.
- [ ] `GALAXY_EVENT_KINDS` ve bütün typed union/map/switch'leri genişlet.
- [ ] Eski ruleset'le yeni season creation ve `restampFutureOccurrences` için §4.2
  registry/refusal sözleşmesini uygula; multi-ruleset restamp current config'e düşmesin.
- [ ] `seedGalaxyEventCalendar` ile `ECONOMY_PROFILE` coupling'ini §4.4'e göre ayır.
- [ ] Server calendar/effect/lifecycle schema ve seeding testlerini güncelle.
- [ ] Trade tests/comments/spec expiry değerlerini 180 -> 120 dakikaya geçir; en yavaş taşıyıcının
  hâlâ yetişebildiğini ve geç launch'ın honest biçimde reddedildiğini kanıtla.
- [ ] Asteroid base/extra lane kimlik/yörünge baseline'ının değişmediğini, yeni fixed occurrence
  sequence ve dört multiplier lane'inin yalnız yeni season'da doğru eklendiğini kanıtla.

**Çıkış:** Yeni ruleset sezonu her TRT tarihinde doğru on sabit occurrence penceresini üretir;
eski live season satırlarına dokunmaz; economy ölçüm flags false iken shipping calendar oluşur.

### Faz 2 — Saf konvoy kuralları

- [ ] Yeni `packages/rules/test/intergalactic-convoy.test.ts` yaz.
- [x] Route isotropy/bounds, antipodal endpoints, merkez 60. dakika ve exact 120 dakika testleri.
- [ ] `routeVersion: 1` fixture/golden testi; yeni algoritma deploy'unda v1 rota değişemez.
- [ ] Linear intercept edge/property testleri: approaching/receding, slower/faster, tangent, iki
  kök, no hit, now hit, NaN/zero, event horizon, 5 saniye sığmaması.
- [ ] Production cap, combat-only iki ayrı quality factor, cargo proportional clamp, rounding ve
  invariants. Sıfır/düşük üretimli koloninin resource eşiğiyle full ship chance alamadığını kilitle.
- [ ] Ship eligibility/tier/drop/count, deterministic seed ve 100k draw distribution tolerance testi.
- [ ] Awarded hull'ın return cargo/fuel/speed ve visible in-flight roster'ı değiştirmediği testleri.
- [ ] Unsafe integer/NaN/Infinity/overflow input'larını reject eden boundary/property testleri.
- [ ] Unequal two-leg fuel helper testleri; mevcut symmetric `missionFuel(..., 2)` sonuçlarını
  değiştirmediğini ispatla.
- [ ] Rules export'larını `packages/rules/src/index.ts` üzerinden aç.

**Çıkış:** Server veya React import etmeyen, deterministic ve property-tested saf feature paketi.

### Faz 3 — Schema ve migration

- [ ] Önce schema/migration beklentisi testlerini kırmızı yap.
- [ ] Append-only enum değerlerini ve `intergalactic_convoy_runs` tablosunu ekle.
- [ ] Partial unique index ve check constraint'leri ekle.
- [ ] Null-vs-empty reward state, double-precision coordinate ve timestamp order testlerini ekle.
- [ ] `pnpm --filter @astera/server db:generate` ile yalnız beklenen migration diff'ini üret;
  generated SQL'i elle gözden geçir. Enum reorder/rebuild kabul etme.
- [ ] Disposable gerçek PostgreSQL'e migration uygula; schema drift testini çalıştır.

**Çıkış:** Eski veriyi silmeden additive migration; same-world race DB tarafından engelleniyor.

### Faz 4 — Field, active API ve lifecycle

- [ ] `intergalacticConvoyField.ts` deterministic spec, HMAC namespace independence ve same-sequence/
  different-window cache-key testlerini yaz/uygula.
- [ ] Server effect parser, active event view, lifecycle payload, join-during-event notification,
  Chronicle ve SSE testlerini önce kırmızı yap.
- [ ] `/api/galaxy/events` yalnız active route'u yayınlasın; future route leak testi ekle.
- [ ] Client active/lifecycle schema branches aynı dilimde eklensin.

**Çıkış:** Konvoy bir public event olarak doğru saatte beliriyor, focus edilebilir veri taşıyor ve
başlangıç/bitiş yollarından hiçbiri worker queue'yu unknown union ile durdurmuyor.

### Faz 5 — Launch ve per-world concurrency

- [ ] `apps/server/test/intergalactic-convoy-launch.test.ts` oluştur.
- [ ] Happy path yanında şu kırmızı testleri yaz: wrong season/owner, expired event, late 5s,
  no intercept, empty/cargo-only/ground/prospector fleet, insufficient ships/fuel, occupied world,
  no bay, stale quote, season-end return, same-world serial/concurrent race, different-world
  parallel launch.
- [ ] Aynı `idempotency-key`/aynı body replay ve aynı key/farklı body conflict testleri; ilk response
  kaybını simüle et. Gecikmiş replay'in immutable run'ı korurken güncel planet/pending hydrate edip
  daha yeni client cache'ini geri sarmadığını kanıtla.
- [ ] `quotedAt`/duration/absolute `quotedArriveAt` üçlüsünde stale, future-clock ve tolerance boundary
  testleri yaz.
- [ ] Service/route'u §6.2 transaction sırasıyla uygula.
- [ ] Run insert, unit parking, fuel debit, event schedule ve complete launch response'u kanıtla.
- [ ] Unique violation domain error'a çevrilirken başka constraint hatalarını yutma.

**Çıkış:** Bir başkent + iki koloniden üç parallel launch geçer; aynı dünyadan ikinci launch hem
normal hem yarışmalı istekte reddedilir ve hiçbir double debit olmaz.

### Faz 6 — Worker, dönüş ve failure recovery

- [ ] `apps/server/test/intergalactic-convoy-resolve.test.ts` oluştur.
- [ ] Exact 5s, no casualty/no retaliation, reward invariants, 0 ve 1–3 ship sonuçlarını test et.
- [ ] Existing world/pirate 10-second engagement testlerini değiştirmeden koru.
- [ ] `convoy_arrival` ile `galaxy_event_end` aynı timestamp'te iki handler sırasını da test et.
- [ ] `homeAt == seasonEndsAt` sınırında convoy return ile `season_end` iki sırada da çalışsın;
  season close aktif run bitene kadar defer etsin.
- [ ] `convoy_result` engagement'ta bir kez, `fleet_returned` teslimatta bir kez yazılıyor; offline
  recap aynı run'ın iki satırını coalesce ediyor ve PvP uyarılarını düşürmüyor.
- [ ] Arrival/return duplicate ve concurrent handler testleri; reward RNG yalnız bir kez gözlenir.
- [ ] Colony captured mid-flight testi: eski pad yerine `safeHomePlanet`.
- [ ] Worker delay testi: home clock launch'ta frozen stored `homeAt` kalmalı; late `now` uzatmamalı.
- [ ] Arrival-abandon no reward ve return-abandon persisted reward teslim testleri.
- [ ] Stranded sweep, `/health`, `onSeasonEnd`, season cleanup, direct reclaim, account deletion,
  commander transfer ve `TRANSFER_EVENT_POLICIES` exhaustiveness testlerini ekle.

**Çıkış:** Restart/retry/failure hiçbir gemi veya ödülü çoğaltmaz, kaybetmez, bay'i sonsuza kadar
kilitlemez.

### Faz 7 — Traffic, pending ve realtime contracts

- [ ] `traffic.test.ts`: NONE/CONTACT/IDENTIFIED, owner exclusion ve 5s anonymous impact testleri.
- [ ] Aynı occurrence'a eşzamanlı çok run testinde bütün engagement'lar `runId` ile korunuyor; biri
  diğerini overwrite etmiyor veya visibility bilgisini sızdırmıyor.
- [ ] `pending.test.ts`: outbound/engaging/return, exact two-leg points ve commander ownership.
- [ ] Pending branch'te stable `originPlanetId`, moving `engagementPath` ve arrival/end/home timer
  invalidation'larını test et.
- [ ] Worker-late projection testinde craft timestamp'e göre return eder, `homeAt` sonrası endpoint'te
  clamp olur ve server delivery olmadan client units/reward eklemez.
- [ ] `contract.test.ts`: active event, launch response, pending and notifications real data parse.
- [ ] `worker.test.ts`, event enum exhaustive handler map ve reconnect/arrival invalidation testleri.
- [ ] Web strict schemas ve shard event invalidation'larını tamamla.

**Çıkış:** Üçüncü event ilk kez çıktığında event/pending/Chronicle ekranlarından hiçbiri sessizce
drop olmaz veya bütünüyle parse hatasına düşmez; fog zayıflamaz.

### Faz 8 — Web ve görsel

- [ ] Saf `convoyFormationSlots` ve rules/web position parity testleri.
- [x] Exact 11-rank/22-unique-craft roster, 2× ölçek, sıkı spacing ve sıraları değiştirmeyen
  longitudinal motion testleri.
- [ ] Rank ingress/egress ve direction world-up'a paralelken stable
  quaternion testleri.
- [ ] `IntergalacticConvoy.tsx`, canvas wiring, focus tracking ve click hit area.
- [ ] Event chip, rail ve yeni attack sheet component testleri.
- [ ] World switching ve per-world disabled state testleri.
- [ ] Captured-world testinde new owner generic occupancy görür; former owner'ın run detail'i yoktur.
- [ ] PendingStrip, notification, Signals, Chronicle ve TR/EN testleri.
- [ ] R3F profiler/dev measurement: active event frame'lerinde React render loop veya ek network
  poll olmadığını doğrula.
- [ ] Yoğun eşzamanlı engagement sahnesinde VFX/draw-call cap ölçümü; own volley her koşulda görünür.
- [ ] `node tools/visual.mjs` ile 350 px: galaxy overview, focused convoy, sheet, 5s firing,
  return fleet, simultaneous Trade Ship + Convoy ve reduced-motion görüntülerini incele.

**Çıkış:** 22 mobile gemi asset'iyle çift sıra, önden T1 arkaya T4 okunuyor; etkileşim ve
performans mobile kalite barını geçiyor.

### Faz 9 — Kapanış ve rollout

- [ ] §11 observability ölçümlerini ekle.
- [ ] 300 world slot × isotropic route × representative tier filo erişilebilirlik raporunu ve
  aynı-world short-loop outlier raporunu owner'a sun; §2.3/§2.8 karar eşiklerini doğrula.
- [ ] `docs/game-design.md`, `balance.md`, `interface.md`, `visual-design.md`, `architecture.md`,
  `deployment.md`, `decisions.md` ve `CLAUDE.md` yaşayan sözleşmelerini güncelle.
- [ ] Economy simulator'a convoy import/branch eklenmediğini diff ile doğrula.
- [ ] Targeted suites, typecheck/lint ve en son root `pnpm verify` çalıştır.
- [ ] Migration -> server/worker/web -> ruleset-8 yeni season sırasını staging'de prova et.
- [ ] Çalışan run'lar varken rollback senaryosunu prova et.

**Çıkış:** Kabul kriterleri, migration, visual evidence, failure evidence ve rollout/rollback notu
tam; yeni sezon açılmadan önce bütün worker'lar iki yeni event kind'ını işleyebiliyor.

---

## 10. Dosya temas matrisi

Liste yönlendiricidir; ajan `rg` ile gerçek call site'ları yeniden taramalı ve unutmamalıdır.

| Katman | Mevcut dosyalar | Yeni/ana değişiklik |
|---|---|---|
| Rules config | `packages/rules/src/constants.ts`, `galaxyEvents.ts`, `index.ts` | fixed windows, kind/effect, version gates |
| Rules geometry/reward | `travel.ts`, `sight.ts`, `hulls.ts`, `fuel.ts`, `economy.ts`, `loot.ts`, `combat.ts` | yeni `intergalacticConvoy.ts`, linear intercept, ayrı 5s clock, reward quote, unequal legs |
| Rules tests | `packages/rules/test/galaxy-events.test.ts`, `trade.test.ts` | yeni convoy suite + legacy regression |
| DB | `apps/server/src/db/schema.ts`, `apps/server/drizzle/meta/*` | append enums, run table, generated migration |
| Event service | `services/galaxyEvents.ts`, `tradeField.ts` kalıbı | new effect/active/lifecycle + `intergalacticConvoyField.ts` |
| Launch/resolve | `services/trade.ts`, `pirateRaid.ts`, `ownership.ts`, `flight.ts`, `fuel.ts` | new `intergalacticConvoyRaid.ts` |
| HTTP | `routes/trade.ts`, `routes/galaxyEvents.ts`, `app.ts`, `services/idempotency.ts` | strict/idempotent convoy launch route/register |
| Worker | `worker/handlers.ts`, `worker/abandon.ts`, `worker/loop.ts`, `worker/queue.ts`, `services/transferReferences.ts` | arrival/return, recovery, transfer policy, health |
| Session/fog | `services/session.ts`, `traffic.ts`, `flight.ts`, `commanderTransfer.ts`, `reclaim.ts`, `accountDeletion.ts`, `servers.ts` | origin ID, multi-engagement list, pending kind, bay/projection/cleanup/season close |
| Notifications | `services/notifications.ts`, `chronicle.ts`, `reports.ts`, `session.ts` | lifecycle + structured result/return + offline coalescing |
| Web contracts | `apps/web/src/api/schemas.ts`, `client.ts`, `queries.ts`, `keys.ts` | active/launch/pending/lifecycle union, mutation cache |
| Web galaxy | `screens/GalaxyView.tsx`, `ActiveGalaxyEvent.tsx`, `galaxy/GalaxyCanvas.tsx`, `scene.ts`, `FocusPanel.tsx` | render/focus/rail/wiring |
| Web visual | `galaxy/Fleets.tsx`, `flightVisual.ts`, `Squadrons.tsx`, `volley.ts`, `ui/fleet-v2-assets.ts` | reuse primitives + new `IntergalacticConvoy.tsx` |
| Web action | `screens/TradeSheet.tsx`, `LaunchSheet.tsx`, `ui/FleetCards.tsx` | new `IntergalacticConvoySheet.tsx` |
| Web feedback | `shell/PendingStrip.tsx`, `Signals.tsx`, `screens/ChronicleScreen.tsx`, `lib/notifications.ts` | three phases + return reward |
| i18n | `i18n/locales/{tr,en}/*`, `i18next.d.ts`, `i18n/errors.ts` | all convoy/event/refusal copy |
| Tests | `apps/server/test/*`, `apps/web/test/*` | new suites plus contract/worker/traffic/visual regression |
| Live bots | `services/bots/brain.ts`, `personas.ts`, bot tests | v1'de lane eklenmediğini kilitle; ileride ayrı owner kararı |
| Economy exclusion | `tools/economy-design-validation.ts`, `.test.ts`, `packages/sim/*` | excluded metadata guard; sim'e income branch ekleme |
| Docs | `CLAUDE.md`, `docs/{decisions,game-design,balance,interface,visual-design,deployment}.md` | new living contract and rollout evidence |

---

## 11. Çalışan logic'i kırma riskleri

| Risk | Nasıl kırılır | Zorunlu koruma |
|---|---|---|
| Asteroid takvimi yeniden deal edilir | Yeni kind mevcut RNG stream/order'ına sokulur | kind sona append, ayrı HMAC namespace, existing schedule regression |
| Canlı sezon saatleri değişir | config değişikliği mevcut rows'a uygulanır/restamp times | persisted calendar immutable; ruleset 8/new season only |
| Eski-ruleset season create/restamp bozulur | seeder/restamp current global config'i okur | frozen ruleset registry veya açık creation/refusal; row-season join |
| Hiç event seed edilmez | economy flags shipping gate olarak kalır | §4.4 separation + waiting-server isolation test |
| Worker tüm uçuşları durdurur | effect/payload union üçüncü kind'ı parse etmez | discriminated exhaustive schema + lifecycle worker test |
| Pending ekranının tamamı çöker | strict pending enum güncellenmez | server/web union aynı slice + real contract test |
| Konvoy UI'da görünmez | forward-compatible active parser unknown kind'ı drop eder | real active convoy contract test |
| Aynı dünya çift ödül basar | yalnız service precheck; iki replica yarışır | partial unique planet/status index + concurrent integration test |
| Başarılı launch kullanıcıya hata görünür | response kaybolur, retry yeni request sayılır | stable idempotency key + replayed response test |
| Retry client cache'ini geçmişe sarar | request log eski planet/pending HTTP snapshot'ını döner | yalnız immutable command replay + current projection hydrate |
| Aynı oyuncunun kolonileri yanlış engellenir | unique owner_player_id üzerinde kurulur | uniqueness yalnız planet_id; 3-world acceptance test |
| Seçili koloni yerine başkent kilitlenir | optional origin fallback kullanılır | request/pending'de zorunlu stable originPlanetId |
| Ele geçirilen dünya yanlış enable/sızıntı yapar | yeni owner own pending göremez ama planet unique doludur | generic occupancy boolean; eski run detail'i private |
| Cargo-only filo bedava ödül alır | fleet count mobile olmakla yetinilir | `combatValue > 0`; transports quality dışında |
| Yeni koloni ucuz tam ship chance alır | production-based resource quality gemi roll'una da uygulanır | independent snapshotted `shipDropFullFirepower` |
| Kargo araştırması yok sayılır | launch/arrival `{}` tech ile hesaplar | required launch tech snapshot, common `fleetCargo` |
| Quote ve sonuç ayrılır | arrival current buildings/config okur | production cap + quote frozen on run |
| Honest quote aynı süreyle stale kalır | yalnız relative duration kıyaslanır | quotedAt + absolute quotedArriveAt + age/tolerance |
| Dönüş rotası görselde kayar | ilk intercept noktasından döner | 5s-end point persist; owner/traffic parity test |
| Ateş eden filo geride kalır | engagement boyunca outbound endpoint'te dondurulur | explicit moving engagementPath + end timer |
| Bütün savaşlar 5 saniyeye iner | global `engagementEndsAt` değiştirilir | convoy-specific clock; existing 10s regression |
| Yakıt eksik alınır | simetrik `distance × 2` kabul edilir | separate distances shared helper |
| Ödül iki kez verilir | RNG her retry'da roll/delivery yapılır | atomic status claim + persisted result + notification dedupe |
| Ödül çekilişi hiç çalışmamış görünmez | null ile `{}` aynılaştırılır | null unresolved, empty resolved-no-drop contract |
| Ödül hull dönüşü yavaşlatır | roster'a uçuş ortasında katılır | towed prize; pace/fuel/cargo original fleet'ten frozen |
| Koloniyi alan rakip filoyu kazanır | dönüşte current controller okunur | owner_player_id + safeHomePlanet |
| Fog rota/owner sızdırır | public event ile attacker contact karıştırılır | event public, player flight sensor-projected; NONE tests |
| Eşzamanlı saldırılar kaybolur/sızar | occurrence ID tek engagement map key'i olur | runId-keyed list + multi-attacker fog/scene test |
| Dominion/economy bozulur | normal combat/loot path reuse edilir | no `resolveCombat`/`bookBattle`/debris; feature rules ayrı |
| Yeni hull canlı ödül pool'unu değiştirir | `MOBILE_HULLS.filter(tier)` doğrudan kullanılır | versioned explicit visual/reward manifest |
| Deploy canlı rotayı değiştirir | route algoritması versionlanmadan düzenlenir | effect routeVersion + frozen v1 golden fixture |
| Deploy canlı tren dizilimini değiştirir | renderer current formation constant'ını okur | effect formationVersion + v1 slot golden fixture |
| Aynı saat eventleri UI'da zıplar | yalnız `startsAt` ile unstable sort | canonical kind/id secondary order; order-independent handlers |
| Season aktif filoyla kapanır | `onSeasonEnd` yeni tabloyu saymaz | close-readiness convoy count + account deletion/reclaim regression |
| Konvoy mesajları kritik uyarıyı boğar | her raid result/return offline top-5'e ayrı girer | same-run coalesce + PvP/strategic priority |
| Bazı dünya/tier'lar hiç yetişemez | moving target erişimi ölçülmeden açılır | slot/route/tier reachability study + owner threshold |
| Konvoy tekrarlı/boş ya da iç içe bir tren görünür | sekiz hull tekrar edilir veya tek spacing kullanılır | 11 rank/22 unique craft, size-aware gaps ve 2× görünür ölçek |
| Dikey rotada gemiler döner/NaN olur | `lookAt` world-up singularity | stable quaternion + fallback up-axis test |
| React frame başına render eder | konum state'e yazılır veya query poll artırılır | `useFrame` ref mutation + memoized slots + profiler test |
| Bundle/network şişer | sekiz GLB app boot'ta koşulsuz preload | existing cached assets; active-time preload + measure |
| Rollback uçuşları strand eder | worker eski image'a dönerken run aktif | launch drain flag; arrival/return capable worker run'lar bitene kadar tutulur |

Rota yakınındaki dünyanın çok kısa round-trip ile aynı occurrence'ı defalarca farm etme riski,
`one active until return` kilidine eklenen occurrence-başına-dünya kotasıyla kapatılmıştır.
Rollout telemetry'si bu invariantı ve coğrafi dağılımı yine izler.

---

## 12. Edge case kataloğu

### Zaman/takvim

- Tam start anında aktif, tam end anında inaktif.
- Launch kesişir fakat beş saniye end'i aşıyorsa reddedilir.
- Season 07:30'da başlarsa o günün 07:00 konvoyu yaratılmaz; 19:00 yaratılır.
- Season 20:30'da bitiyorsa 19:00 occurrence yaratılmaz.
- Trade ve Convoy 07:00–09:00 birlikte aktifken array order/UI/focus doğru kalır.
- Asteroid Shower ve Convoy 20:00–21:00 birlikte aktifken aynı doğruluk korunur.
- Worker lifecycle gecikse de active state DB worker flag'inden değil authoritative clock'tan çıkar.
- Host UTC veya Europe/Istanbul dışında çalışırken schedule değişmez.
- 02:00/03:00 ve 23:00 tied jobs ters sırada işlense de lifecycle/run sonuçları aynıdır.
- `homeAt == seasonEndsAt` ise `season_end` önce claim edilse dahi aktif run silinmez; return
  tamamlanınca rollover devam eder.
- Explicit ruleset 4/6/7 season creation ya frozen eski config alır ya açıkça reddedilir; current
  fixed config'i sessizce alamaz.
- Corrupt fixed effect (`NaN`, negative threshold, weight sum != 1) seed/parse aşamasında fail closed.

### Geometri/uçuş

- Dünya konvoy start/end noktasında, merkezinde veya rota üzerinde olabilir.
- Fleet targettan yavaş olduğu halde yaklaşan segmentte intercept edebilir; uzaklaşanda edemeyebilir.
- Kök `now`, `endsAt - 5s` veya floating-point epsilon sınırındadır.
- Çok kısa mesafede zero-minute/zero-fuel rounding exploit'i engellenir; mevcut minimum fuel
  sözleşmesi korunur.
- 5 saniyede ilerlenen küçük mesafe return path ve visualde kaybolmaz.
- Route direction tam/neredeyse world-up; quaternion finite ve rank order aynı kalır.
- Formation start/end sınırında rank'lar kademeli girer/çıkar; gameplay anchor değişmez.
- Formation'ın merkezi sınırdayken bazı rank'ların içeride/dışarıda olması §2.7 semantiğini korur;
  visual half-length route mesafesine yanlışlıkla eklenmez.
- Config yanlış `GALAXY.radius`, duration veya zero direction üretirse fail closed.
- Tüm slot/route/tier erişim matrisi yanında, konvoy dünyadan uzaklaşırken quote ile confirm arasında
  kesişimin yok olması honest refusal üretir; gizli catch-up yoktur.

### Filo/ödül

- Empty, negative, fractional, unknown, ground ve Prospector payload'ları boundary'de reddedilir.
- Sadece taşıyıcılar reddedilir; bir Dart + taşıyıcılar kabul edilir.
- Gönderilen en yüksek tier ateşsiz Argosy ise maxTier 4 olabilir; bu §3.7'nin bilinçli sonucudur.
- Dünya production level 0; capTotal 0; quality division-by-zero üretmez ve resource reward 0'dır.
- Level-0/düşük üretimli koloninin `resourceQualityFactor` değeri yüksek olsa bile
  `shipQualityFactor` yalnız bağımsız firepower eşiğinden gelir; ucuz full ship chance oluşmaz.
- Cargo 0 veya raw toplamdan küçük/büyük/eşit; floor toplamı cargo'yu aşmaz.
- Award hiç yok, 1, 2, 3; duplicate hull; tier truncation; future catalog hull eklenmesi.
- Awarded hull tow olduğu için cargo/fuel/pace hesaplarını değiştirmez ve return öncesi units olmaz.
- Resource reward storage cap üstüne çıkabilir; silently discard edilmez.

### Concurrency/ownership/failure

- Aynı world aynı ms iki launch; yalnız biri debit/insert olur.
- Aynı idempotency key retry; aynı immutable run/quote ve yeniden hydrate current projections.
  Aynı key başka origin/fleet; conflict ve sıfır debit.
- Aynı key gecikmeli replay edilirken başka mutation planet'i değiştirmişse immutable run aynı,
  response'taki planet/pending ise yenidir; cache rollback olmaz.
- Aynı player farklı üç world; üçü de bağımsız geçer.
- Dünya control transfer olur; fiziksel planet lock eski run done'a kadar yeni controller'ı generic
  biçimde bloklar ama eski owner/fleet/route/reward/homeAt bilgisini sızdırmaz.
- Aynı occurrence/aynı beş saniyede çok oyuncu saldırır; bütün run'lar ayrı resolve olur, tek visual
  map slotunda overwrite olmaz ve public konvoy hiç durmaz.
- İlk run done olurken ikinci launch yarışır; lock/index sonucu deterministik olmalıdır.
- Origin capture/reclaim/commander transfer/season end uçuşun iki bacağında ayrı ayrı.
- Origin capture sonrası return path eski immutable koordinata giderken teslim `safeHomePlanet`'a
  yapılır; path capture anında yeniden çizilmez ve launch'ta frozen `homeAt` değişmez.
- Direct reclaim ile account deletion aynı shared row setini görür; `onSeasonEnd` aktif run varken
  yanlışlıkla ready dönmez.
- Arrival handler iki worker'da; return handler iki worker'da; event duplicate/out of order.
- Arrival worker `engagementEndsAt` sonrasında veya `homeAt` sonrasında uyanır; visual clock donmaz,
  due return hemen kuyruğa girer ve delivery yine yalnız server transaction'ında olur.
- Run var scheduled event yok; scheduled event var run yok; occurrence yanlış kind/corrupt effect.
- Notification insert fail/duplicate, SSE retry ve client reconnect.
- Engagement result + return delivery aynı `runId` ile persistent kalır; offline top-5 özeti bunları
  birleştirir ve daha kritik incoming/raid uyarısını crowd-out etmez.

### İstemci/fog

- Eski client bilinmeyen active kind'ı drop etse de server çalışır; yeni client real contract'ı parse eder.
- Active query stale olup event bitmişken launch server tarafından reddedilir.
- Device clock ileri/geri; position/countdown yalnız `serverNow()`.
- Viewer attacker'ı görmüyor ama impact flash görüyor; origin/bearing çıkaramıyor.
- Eski komutanın `originPlanetId`si control transfer sonrası owned-world listesinde yoktur; kendi
  PendingStrip run'ı yine render eder, world lookup null diye tüm pending response çökmez.
- Context loss/low-end GPU/eight GLB load; fallback UI action kullanılabilir kalır.
- Reduced motion ateşin anlamını kaybetmeden titreşim/abartılı motion'u keser.

---

## 13. Observability ve rollout

### 13.1 Ölçümler

En az season/event/world bucket'larında, player kimliğini loga açık yazmadan ölç:

- active occurrence start/end process lateness;
- launch accepted/refusal count ve refusal reason;
- idempotency replay/conflict ve quote-changed count;
- outbound/engaging/returning/done gauge;
- arrival/return queue lateness, retry, abandon ve stranded count;
- round-trip p50/p95/min ve occurrence başına aynı-world repeat dağılımı;
- distance-to-route ile raid count/reward korelasyonu;
- world-slot/fleet-tier bazında reachable-window oranı ve peak concurrent engagement sayısı;
- awarded Alloy/Crystal/Deuterium toplamları ve productionCap/cargo utilization;
- resourceQualityFactor ve shipQualityFactor dağılımları;
- ship roll/drop/count/tier dağılımı;
- safeHomePlanet reroute sayısı;
- active event API payload/cache latency ve client schema parse errors;
- active R3F scene frame time, model load bytes, memory ve aggregated/cull edilen foreign VFX sayısı.

Alarm koşulları: duplicate reward invariant ihlali, stranded run > 0, reward > cap/cargo, tier > max,
worker unknown event kind, event active olduğu halde zero active API row ve belirlenen coğrafi outlier
eşiğinin aşılması.

### 13.2 Deploy sırası

1. Owner kararları ve ruleset-8 boundary merge edilir; yeni season henüz açılmaz.
2. Additive migration bütün DB'lere uygulanır.
3. Arrival/return bilen worker ve server deploy edilir.
4. Web schema/UI deploy edilir; staging'de gerçek occurrence ve run doğrulanır.
5. Economy flags false durumdayken production shipping seeding'i doğrulanır.
6. Ruleset 8 yeni season açılır; ilk 07:00 occurrence gözlenir.
7. İlk iki occurrence boyunca launch/return/drop/coğrafya dashboard'u aktif izlenir.

### 13.3 Rollback

- DB enum/table migration'ı additive bırakılır; geriye döndürmek için data silinmez.
- Hiç run yoksa yeni launch route/event kind feature flag ile kapatılabilir.
- Aktif run varsa eski worker image'a tam rollback yapılmaz. Önce yeni launch'lar kapatılır, mevcut
  run'lar arrival/return-capable worker ile drain edilir; sonra uygulama rollback edilir.
- Başlamış occurrence satırı silinmez; lifecycle Chronicle geçmişi korunur.
- Schedule hatası yeni sezonda görülürse occurrence'ları topluca redeal etmek yerine sezon açılışı
  durdurulur veya gelecekteki yalnız hatalı kind için açık, auditli operasyon hazırlanır.

---

## 14. Kabul kriterleri

Özellik ancak aşağıdaki maddelerin tamamı kanıtlandığında tamamlanmıştır.

### Takvim ve public event

- [x] §3.1'deki bütün saatler 30 günlük sezon ve arbitrary season boundaries üzerinde exact.
- [x] Asteroid multiplier'ları doğru occurrence effect'inde: 02 ×3, 10 ×3, 13 ×5, 20 ×10.
- [x] Trade akşam penceresi owner tarafından doğrulanmış ve testte exact.
- [x] Convoy 07–09 ve 19–21, exact 120 dakika; half-open sınırlar doğru.
- [x] Eski live season occurrence satırları değiştirilmeden frozen ruleset config'inde kalıyor.
- [x] Deploy sonrası explicit eski ruleset'le season creation/restamp frozen eski config'i
  kullanır ya desteklenmediğini hiçbir row yazmadan açıkça reddeder; current fixed config'e düşmez.
- [x] Active API gelecek takvimi/rotayı sızdırmıyor.

### Rota ve görsel

- [x] Endpoint'ler galaksi sınırında ve antipodal; 60. dakikada konum tam merkez.
- [x] Route aynı occurrence için restart/replica boyunca deterministik.
- [x] Çift sırada tier 1 önde, tier 4 arkada; 22 mobile Fleet V2 asset'i tam bir kez kullanılıyor.
- [ ] Gameplay intercept noktası ile drawn formation merkezi rules/web parity testinde aynı.
- [ ] 22 craft ingress/egress'i §2.7 sınır semantiğini bozmaz; vertical route quaternion finite.
- [x] 300 world-slot × 64 isotropic route × representative tier reachability testi §2.8'i karşılıyor.
- [ ] Frame başına React state/poll yok; 350 px visual harness ve performans ölçümü kabul edildi.

### Launch ve eşzamanlılık

- [x] En az bir ateş eden mobile hull şart; cargo-only/invalid fleet reddediliyor.
- [x] Aynı world'den status done olmadan ikinci run, yarışmalı istek dahil, imkânsız.
- [ ] Aynı commander'ın üç farklı world'ünden üç concurrent run mümkün.
- [ ] Control transfer fiziksel world lock'ını düşürmüyor; new owner yalnız generic occupied state
  görüyor, former owner's private run detayını alamıyor.
- [x] Free bay, ship availability, fuel, world operation, owner, season ve stale quote kontrolleri
  tek transaction içinde ve hiçbir refusal partial debit bırakmıyor.
- [x] Stale quote absolute arrival ve quote age ile yakalanıyor; aynı-key gecikmiş replay güncel
  planet/pending döndürüyor ve client cache'ini geçmişe sarmıyor.
- [x] Full 5s engagement event bitmeden tamamlanamıyorsa launch yok.
- [x] Gidiş/dönüş farklı mesafelerle hesaplanıyor; iki bacağın yakıtı peşin; recall/refund yok.

### Ödül ve dönüş

- [x] Konvoy hiç ateş etmiyor; attacking fleet'te casualty, Dominion, debris, salvage veya battle
  report oluşmuyor.
- [x] Resource quote/result her key için production snapshot tavanını ve toplam cargo'yu aşmıyor.
- [x] Resource ve ship quality ayrı eşik kullanıyor; sıfır/düşük üretimli dünya ship chance'i
  ucuzlatmıyor; persisted effect probability/weight'leri strict doğrulanıyor.
- [x] Upgrade, outage veya colony capture uçuş ortasında frozen quote'u değiştirmiyor.
- [x] Ship ödülü yalnız 0 veya 1–3; tier gelen filonun maxTier'ını aşmıyor; yalnız versioned
  visible manifestten geliyor.
- [x] Retry/concurrent worker aynı reward'u ikinci kez roll veya deliver etmiyor.
- [x] Ödül launch/engagement anında dünyaya eklenmiyor; dönüşte bir kez ekleniyor.
- [x] Origin el değiştirirse fleet/resource/ship komutanın `safeHomePlanet` dünyasına dönüyor.
- [x] Return/arrival abandonment filoyu strand etmiyor ve doğru pre/post-engagement ödül semantiğini
  koruyor.
- [ ] Account deletion/reclaim/commander transfer/season close aktif convoy run'ını atlamıyor.

### Fog, realtime ve UI

- [x] Konvoy herkese public; attacker fleet mevcut sensor ladder dışında görünmüyor.
- [x] NONE observer anonymous impact'ten attacker identity/origin/path çıkaramıyor.
- [ ] Aynı occurrence'a eşzamanlı çok saldırı runId bazlı ayrı kalıyor; engagement overwrite veya
  cross-player visibility leak yok.
- [ ] Owner pending gidiş, exact 5s engagement ve dönüşü doğru authoritative clock ile gösteriyor.
- [x] Worker geçken visual timestamp'e göre ilerliyor, home endpoint'inde clamp oluyor; server
  delivery olmadan client resource/unit üretmiyor.
- [x] Event chip, focus rail, sheet, Signals, Chronicle, return notification ve TR/EN copy tamam.
- [x] Offline top-5 recap aynı run'ın result/return satırlarını coalesce ediyor ve kritik PvP/
  strategic uyarıları konvoy spam'i yüzünden düşürmüyor.
- [x] Aynı anda Trade Ship + Convoy UI'da ikisi de görünür/focus edilebilir.
- [x] Launch success response full planet + pending taşır; eski in-flight query sonucu bunu silemez.

### Kalite, ekonomi sınırı ve rollout

- [x] Event-specific rules/server/web testleri green; adversarial time/concurrency/failure kapsamı var.
- [x] Convoy simulator, ARR, VFR, monthly reference veya economy calibration gelirine dahil değil.
- [x] Economy validation `excluded` metadata'sında `intergalactic-convoy` var; package sim içinde
  convoy income import/branch yok.
- [x] `seedGalaxyEventCalendar` artık measurement flags'e bağlı değil; `waiting-servers` isolation
  testi yeni sözleşmede green.
- [x] Gerçek PostgreSQL migration ve schema-drift green.
- [x] Root `pnpm verify` kapsamındaki unrelated kırmızılar ayrı ve açık
  kaydedilmiş; feature kapsamındaki hiçbir kırmızı kabul edilmemiş.
- [ ] `node tools/visual.mjs` kanıtı ve staging'de bir tam launch -> 5s -> return akışı tamam.
- [ ] Aktif run drain eden rollback prosedürü prova edilmiş.

---

## 15. Uygulama ajanına son kısa sıra

1. Önce §2.1–2.8 kararlarını kapat; özellikle `21:00–11:00`, reward threshold/pool ve erişim
   garantisini tahmin ederek ship etme.
2. Takvimi fixed-window moduna geçir ve economy/shipping coupling'ini ayır.
3. Saf route/intercept/reward/fuel kurallarını test-first tamamla.
4. Additive schema/migration ve DB-level per-world uniqueness'i kur.
5. Active event/lifecycle contract'ını server ve web'e birlikte ekle.
6. Launch transaction'ını, sonra idempotent arrival/return/abandon akışını yap.
7. Pending/traffic/fog/realtime contracts'ını kapat.
8. Mevcut Fleet V2 asset'leriyle çift sıralı R3F görselini ve action UI'ı yap.
9. Coğrafi repeat-farm ölçümünü owner'a sun; istenmeyen throttling'i sessizce ekleme.
10. Docs, full verify, gerçek DB migration, visual harness ve rollout/rollback kanıtıyla bitir.
