# Entegrasyon Planı — Galaksi Etkinlikleri · Asteroid Yağmuru

> **Durum:** UYGULANDI — doğrulama ve rollout hazırlığı sürüyor.  
> **İlk etkinlik:** `ASTEROID_SHOWER` / Asteroid Yağmuru.  
> **İlk davranış:** Etkinlik penceresi boyunca asteroid **spawn hızı ×5**; başlangıç ve
> bitişte galaksideki herkese kalıcı bildirim.  
> **Uygulama tabanı:** 2026-09-02 çalışma ağacı. Fleet Catalog V2 ile aynı kirli çalışma ağacında
> çakışan dosyalar korunarak, değişiklikler additive patch'lerle yapılmıştır.

Bu doküman hem fazlı entegrasyon planı hem de gerçekleşen uygulamanın yaşayan sözleşmesidir.
Kod tamamlanmış; production rollout'u tam doğrulama, kapasite ölçümü ve yeni sezon sınırına bağlıdır.

---

## 1 · Sonuç ve önerilen mimari

Tek bir `if (asteroidShower) spawn *= 5` eklenmeyecek. İlk özellik yalnızca Asteroid Yağmuru olsa
da kurulacak yapı daha sonra Ticaret Gemisi, savaş alarmı, kaynak anomalisi veya başka galaksi
etkinliklerini aynı yaşam döngüsü üzerinden taşıyabilmelidir.

Önerilen yapı beş parçadan oluşur:

1. **Saf ve deterministik takvim üreticisi:** Bir sezonda hangi gün kaç etkinlik olacağını,
   başlangıç/bitiş zamanlarını, aynı türün tekrar bekleme süresini ve türler arası çakışma
   yasaklarını çözer.
2. **Kalıcı etkinlik occurrence kayıtları:** Üretilen takvim sezon başında veritabanına bir kez
   yazılır. Canlı sezonun davranışı sonraki config değişiklikleriyle geriye dönük değişmez.
3. **Mevcut alanı bozmayan asteroid bonus lane'i:** Yağmur kayaları mevcut asteroidlerin
   index, kimlik, yörünge ve spawn zamanlarını değiştirmeden ayrı deterministik lane'lerde üretilir.
4. **Zamanlanmış yaşam döngüsü:** Başlangıç/bitiş `scheduled_events` üzerinden işlenir. Worker
   bildirim, Chronicle ve SSE yayınını yapar; asteroid spawn etkisinin doğru zamanda çalışması
   worker'ın ayakta olmasına bağlı olmaz.
5. **Yetkili durum yüzeyi:** Oyuncu yalnızca aktif etkinlikleri görür. Başlangıç/bitiş Signals
   bildirimi alır; galaksi ekranında etkinliğin adı, etkisi ve kalan süresi okunur.

Uygulama sırası ve her adımın teslimatı özetle şöyledir:

| Faz | Teslimat | Durum |
|---|---|---|
| 0 | Ürün sözleşmesi, denge değerleri ve rollout kararı | Tamamlandı · D149 ve sabit config |
| 1 | Typed config ve saf deterministik takvim üreticisi | Tamamlandı · rules suite yeşil |
| 2 | Occurrence tablosu, migration ve sezon seeding/repair | Tamamlandı · migration/schema-drift yeşil |
| 3 | Mevcut asteroidleri bozmayan bonus lane | Tamamlandı · baseline/expiry testleri yeşil |
| 4 | Worker başlangıç/bitiş işlemleri, bildirim ve Chronicle | Tamamlandı · idempotent lifecycle testleri yeşil |
| 5 | Aktif-event API'si, SSE invalidation ve istemci yüzeyi | Tamamlandı · contract/web testleri yeşil |
| 6 | Entegrasyon ve arıza senaryoları | Tamamlandı · server 1.057/1.057 yeşil |
| 7 | Denge, kapasite ve bilgi sızıntısı denetimi | Rollout gate · 300-client canlı ölçüm bekliyor |
| 8 | Doküman, rollout ve rollback hazırlığı | Doküman/görsel tamam; canlı rollout kanıtı bekliyor |

### Uygulama doğrulama kaydı · 2026-09-02

- Monorepo typecheck: rules, server, web ve simulator geçti.
- Rules: **543/543**; server gerçek PostgreSQL suite: **1.057/1.057**; simulator: **87/87**.
- Event odaklı web paketi: **66/66**; tüm web koşusunda **1.750 test geçti**, ortak çalışma
  ağacındaki untracked Film POC için 7 ve bağımsız `spend.readingSpend` çevirisi için 1 test kaldı.
- Migration `0048_marvelous_raider.sql` gerçek PostgreSQL'e uygulandı; schema-drift testi geçti.
- Targeted type-aware ESLint temiz. Root lint, event kapsamı dışındaki untracked Film POC'nin 12
  hatasında durduğu için root `pnpm verify` bütünüyle yeşil değildir.
- 14 günlük schedule: **70 occurrence**, **140 lifecycle job**. Composed field: 3.478 baseline +
  2.870 bonus = **6.348 asteroid**; 100 soğuk pure composition ölçümünde ortalama **1,08 ms**.
- Disposable `astera_test` üzerinde gerçek API + mobil istemci görsel harness'i runtime error olmadan
  tamamlandı. Event chip'i ×5 ve server-clock geri sayımını gösterdi; status katmanı sahne
  tıklamalarını kesmesin diye `pointer-events-none` regresyon testiyle kilitlendi.

```text
Sezon oluşturma
    │
    ├─ saf scheduler + gizli, domain-separated RNG
    │       └─ günlük adet · düşük-priority dağılımı · cooldown çözümü
    │
    ├─ galaxy_event_occurrences (değişmez takvim + effect snapshot)
    │       ├─ galaxy_event_start scheduled_event
    │       └─ galaxy_event_end scheduled_event
    │
    └─ asteroid field
            ├─ mevcut base lane        (byte-for-byte aynı)
            ├─ mevcut +15% extra lane  (byte-for-byte aynı)
            └─ occurrence başına shower bonus lane

Yetkili saat ──> asteroidlerin görünmesi/sona ermesi
Worker        ──> toplu bildirim + Chronicle + shard invalidation
Client        ──> aktif event sorgusu + Signals + serverNow() geri sayımı
```

Bu yaklaşım `CLAUDE.md` içindeki şu kurallarla uyumludur:

- continuous state formülden ve saatten türetilir;
- exact future moments scheduled event'tir;
- global tick/per-planet loop kurulmaz;
- server authority korunur;
- timed sistem restart, retry, duplicate ve concurrency'ye dayanır;
- asteroid koordinatı veya tick snapshot'ı saklanmaz;
- fog sorguda uygulanır ve gizli asteroid schedule istemciye çıkmaz.

---

## 2 · Oyun sözleşmesi

### 2.1 İlk sürümün kesin anlamı

`ASTEROID_SHOWER` için ilk sözleşme:

- Süre: **60 dakika**.
- Spawn çarpanı: **×5**.
- Çarpan mevcut aktif asteroid sayısına, asteroid ömrüne, cevher miktarına veya madencilik
  hızına uygulanmaz. Yalnızca pencere içindeki **yeni asteroid giriş hızına** uygulanır.
- Normal alan pencere boyunca çalışmaya devam eder. Bonus lane normal hızın `×(5 - 1)` kadar
  ek asteroid üretir; normal + bonus toplamı yaklaşık ×5 olur.
- Bonus kayaların `appearsAt` değeri `[startsAt, endsAt)` aralığındadır.
- Etkinlik bittiği anda yalnızca spawn hızı ×5'ten normal ×1 seviyesine döner; alan veya cache
  topluca temizlenmez. Daha önce doğmuş kayalar birden yok olmaz, normal 2.5–5 saatlik ömürlerini
  tamamlar, tükenir veya madenciler tarafından boşaltılır. Bu yüzden aktif asteroid nüfusu event
  sonrasında doğal expiry/mining temposuyla kademeli olarak normale iner.
- Etkinliğin bitmesi uçuşta olan Prospector görevini iptal etmez ve hedefi yerinden oynatmaz.
- Bonus kayalar normal kayalarla aynı level, ore, Crystal, isotope, hız, ömür ve yörünge
  dağılımını kullanır. Bu tercih ayrıca denge testinden geçer; isotope kayalarını özel olarak
  hariç tutmak spawn çarpanının anlamını sessizce değiştireceği için önerilmez.
- Etkinlik herkesçe bilinir; kaya konumları bilinmez. D143 keşif/fog kuralları aynen uygulanır.

### 2.2 Bildirim sözleşmesi

Etkinlik başladığında:

- TR: **“Galakside asteroid yağmuru başladı.”**
- EN: **“An asteroid shower has begun in the galaxy.”**

Etkinlik bittiğinde:

- TR: **“Asteroid yağmuru bitti. Yeni asteroid oluşma hızı normale döndü.”**
- EN: **“The asteroid shower has ended. Asteroid spawn is back to normal.”**

Bildirimler sunucuda çevrilmiş cümle olarak saklanmaz. Payload yalnızca stabil kimlik ve sayıları
taşır; cümle istemcide i18n ile kurulur:

```ts
{
  eventKind: 'ASTEROID_SHOWER',
  startsAt: '...',
  endsAt: '...',
  asteroidSpawnMultiplier: 5,
}
```

İki genel notification kind eklenmesi önerilir:

- `galaxy_event_started`
- `galaxy_event_ended`

Böylece gelecekte her etkinlik için yeni notification enum'u eklenmez. Her iki satır da
`refId = occurrence.id` kullanır; kind farklı olduğu için mevcut
`(player_id, kind, ref_id)` idempotency kuralı hem başlangıcı hem bitişi birer kez kabul eder.

### 2.3 “Herkes” tanımı

- Geçiş anında sezonda bulunan her player için bir notification satırı yazılır.
- Etkinlik başladıktan sonra galaksiye katılan oyuncu, aktif-event API'sinde etkinliği hemen görür
  ve join transaction'ı içinde idempotent bir `galaxy_event_started` bildirimi alır.
- Etkinlik bittikten sonra katılan oyuncuya geçmiş başlangıç/bitiş bildirimi backfill edilmez;
  Chronicle son 24 saatin herkese açık tarihçesidir.
- Reclaim edilmiş player'ın kişisel notification satırları mevcut davranış gibi silinebilir;
  occurrence ve Chronicle kayıtları sezona aittir ve kalır.

### 2.4 Takvim ve zaman tanımları

- Günlük dağılım Türkiye takvimine göre değerlendirilir. Yetkili zone
  `Europe/Istanbul`'dur; oyuncunun cihaz timezone'u veya process'in host timezone'u kullanılmaz.
- **Düşük öncelikli pencere Türkiye saatiyle `[00:00, 08:00)` aralığıdır.** Bu bir blackout
  değildir: event bu saatlerde başlayabilir, fakat gündüz penceresine göre daha seyrek seçilir.
- Bir event'in hangi pencereye ait olduğu `startsAt` ile belirlenir. Tam `00:00` düşük önceliğe,
  tam `08:00` normal önceliğe girer; event'in 08:00 sonrasına sarkması sınıfını değiştirmez.
- Günlük toplam 5 olduğunda düşük öncelikli pencere için hedef 1 event, hard cap 2 event'tir.
  Scheduler önce config'deki hedef payı ayırır; kalan event'ler düşük ağırlıkla bu pencereye
  düşebilir, ancak günlük cap'i aşamaz. Böylece gece saatleri yasaklanmaz ve geceye 3–5 event
  yığılması mümkün olmaz.
- Sezon keyfî bir saatte açılabileceği için ilk/son Türkiye takvim günü kısmi olabilir. Bu iki
  kenar günün adedi kullanılabilir dakika oranına göre deterministik yuvarlanır; event'ler sezon
  dışına sıkıştırılmaz. Tam günlerde `dailyCount` aynen uygulanır.
- Zone dönüşümü saf scheduler'daki config-versioned sabit UTC+3 offset'iyle yapılır. Üretilen UTC occurrence'lar DB'ye
  snapshot olarak yazıldığı için cihaz, restart veya sonradan gelen timezone verisi canlı sezonu
  kaydırmaz.
- Aralıklar half-open'dır: `[start, end)`. X tam biterken Y başlayabilir; bu overlap değildir.
- Aynı tür için tekrar kuralı:
  `next.startsAt >= previous.endsAt + repeatCooldownMinutes`.
- X/Y birlikte olamaz kuralı için typed pair alanı config'de ayrılmıştır. İlk sürümde yalnız tek
  event türü bulunduğundan liste boştur; ikinci tür eklenirken weighted tür seçimi ve pair çözücüsü
  aynı saf scheduler içinde kırmızı testlerle etkinleştirilecektir.
- Etkinlik sezon başlangıcından önce başlayamaz ve sezon bitişini aşamaz.
- Gelecekteki takvim istemciye gönderilmez. Oyuncu yalnızca başlamış ve henüz bitmemiş occurrence
  kayıtlarını görür; sürpriz takvim public `season.seed` üzerinden tahmin edilemez.

### 2.5 İlk config şekli

Sayılar kod akışına dağılmış literal'lar olmayacak. Önerilen tek typed config:

```ts
export const GALAXY_EVENTS = {
  version: 1,
  calendar: {
    timeZone: 'Europe/Istanbul',
    utcOffsetMinutes: 180,
    dailyCount: { min: 5, max: 5 },
    lowPriorityWindow: {
      startsAtLocalMinute: 0,
      endsAtLocalMinute: 8 * 60,
      targetShare: 0.2,
      overflowWeight: 0.25,
      maxDailyCount: 2,
    },
    candidateAttempts: 512,
  },
  definitions: {
    ASTEROID_SHOWER: {
      version: 1,
      durationMinutes: 60,
      repeatCooldownMinutes: 120,
      effect: { asteroidSpawnMultiplier: 5 },
    },
  },
  mutuallyExclusive: [] as const,
} as const;
```

İlk sürüm için değerler **×5, tam Türkiye takvim günü başına tam 5 kez, 60 dakika süre ve bitişten
sonra 120 dakika cooldown** olarak kilitlenmiştir. Başlangıçlar bu nedenle en az üç saat aralıklıdır.
Min/max biçimi ileride sabit veya aralıklı günlük sayıyı destekler; bu sürümde ikisi de 5'tir.
Aktivasyon ayrıca `MULTI_WORLD.galaxyEventsRulesetVersion = 4` sezon sınırıyla korunur.

`targetShare: 0.2`, 5 event'lik tam günde gece için 1 event hedefler. Hedef paydan sonra geceye
düşecek ek adaylar `overflowWeight` ile gündüze göre düşük ağırlık alır ve `maxDailyCount: 2`
kesin sınırdır. Bu üç değer de oyun koduna gömülmez; balance config'inin parçasıdır.

---

## 3 · Mevcut sistem ve korunacak invariants

### 3.1 Asteroid alanı

Bugünkü akış:

- `packages/rules/src/galaxy.ts::generateAsteroidSchedule`
- stabil 9/saat base lane;
- D110 ile eklenen bağımsız +15% lane;
- `apps/server/src/services/asteroidField.ts::privateAsteroidField`
- `apps/server/src/services/mining.ts::fieldOf/loadMiningSnapshot`
- D143 oyuncu keşfi ve opaque asteroid id.

En önemli invariant: **yoğunluk artışı mevcut kayayı hareket ettiremez, silemez veya yeniden
indexleyemez.** D110'un ikinci lane'i tam bu nedenle eklenmiştir. Asteroid Yağmuru üçüncü bir
bağımsız kaynak olmalı; mevcut iki lane'e ait RNG draw sırası, count, index, `appearsAt`, yörünge,
ore ve opaque id byte-for-byte aynı kalmalıdır.

### 3.2 Scheduled worker

`scheduled_events` ve worker zaten gereken altyapıyı sağlar:

- `FOR UPDATE SKIP LOCKED` ile claim;
- `resolve_at` sırası;
- stale processing reaper;
- retry/failed görünürlüğü;
- handler registry;
- injected clock.

Yeni timer, cron, `setInterval` tabanlı event scheduler veya global tick kurulmayacaktır.

### 3.3 Notifications ve mevcut karar çatışması

Mevcut D45/game-design metni notification listesini kapalı kabul eder ve yalnızca “sana olan,
öngöremediğin, harekete geçebileceğin” olayları içeri alır. Kullanıcı talebi galaksi çapındaki
başlangıç/bitişleri de Signals'a soktuğu için bu sıradan bir enum eklemesi değildir; bilinçli bir
ürün kararı değişikliğidir.

Uygulama ile birlikte:

- D45 ya güncellenecek ya da yeni bir owner decision ile public galaxy lifecycle bildirimlerinin
  dar istisnası tanımlanacak;
- dark pattern yasağı değişmeyecek;
- event-specific onlarca notification kind yerine yalnızca iki lifecycle envelope kullanılacak;
- her notification'ın “door” olması kuralı korunacak: asteroid event bildirimi Signals'ı kapatıp
  oyuncuyu galaksi haritasına döndürecek.

### 3.4 Chronicle tablosu occurrence tablosu değildir

Mevcut `galaxy_events` tablosu son 24 saatin herkese açık **Chronicle geçmişidir**. Aktif durum,
başlangıç/bitiş planı veya effect config saklamak için kullanılmamalıdır.

Yeni tablo farklı bir kavramdır:

- `galaxy_event_occurrences`: planlanan ve yürüyen etkinlik occurrence'ları;
- `galaxy_events`: gerçekleşmiş public geçişlerin Chronicle kayıtları.

İsim benzerliği uygulamada docblock ve tiplerle açıkça ayrılmalıdır.

---

## 4 · Veri modeli

### 4.1 Yeni tablo: `galaxy_event_occurrences`

Önerilen kolonlar:

| Kolon | Amaç |
|---|---|
| `id uuid PK` | Notification ref'i ve occurrence kimliği |
| `season_id uuid FK` | Event'in ait olduğu galaksi/sezon |
| `sequence integer` | Sezon içindeki deterministik sıra; repair/idempotency anahtarı |
| `kind galaxy_event_kind` | İlk değer `ASTEROID_SHOWER`; enum append-only |
| `definition_version integer` | Effect snapshot'ını ileride güvenle okuyabilmek için |
| `starts_at timestamptz` | Yetkili başlangıç |
| `ends_at timestamptz` | Yetkili bitiş |
| `effect jsonb` | Definition version ile ayrılan, Zod ile okunan immutable effect snapshot |
| `start_processed_at timestamptz NULL` | Başlangıç yan etkileri commit oldu mu/worker ne kadar geç kaldı |
| `end_processed_at timestamptz NULL` | Bitiş yan etkileri commit oldu mu/worker ne kadar geç kaldı |

Kısıtlar ve indexler:

- unique `(season_id, sequence)`;
- check `starts_at < ends_at`;
- check `definition_version > 0`;
- index `(season_id, starts_at, ends_at)` aktif-event sorgusu için;

Gameplay'deki “aktif” durumu processed marker'dan değil yetkili saatten türetilir:

```text
active = startsAt <= now < endsAt
```

Worker altı saat kapalı olsa bile asteroid spawn penceresi zamanında açılır/kapanır. Marker'lar
yalnızca teslimat ve operasyon gözlemi içindir.

### 4.2 Enum ve queue değişiklikleri

Append-only eklemeler:

- `galaxy_event_kind`: `ASTEROID_SHOWER`
- `event_kind`: `galaxy_event_start`, `galaxy_event_end`
- `notification_kind`: `galaxy_event_started`, `galaxy_event_ended`

`scheduled_events` üzerine nullable, producer-owned `dedupe_key` eklenir ve unique index konur:

```text
UNIQUE(dedupe_key)
```

Galaxy event producer'ı `galaxy-event:start:<occurrenceId>` ve
`galaxy-event:end:<occurrenceId>` anahtarlarını kullanır. `NULL` olan eski queue kayıtlarının
semantiği değişmez; başka producer'ların `kind/refId` tekrarları yanlışlıkla engellenmez. Bu index
aynı occurrence için iki başlangıç veya iki bitiş işi yazılmasını DB seviyesinde engeller. Handler
idempotency yine de gereklidir; unique index onun yerine geçmez.

### 4.3 Effect snapshot

İlk JSON biçimi definition version ile birlikte okunur:

```ts
{
  asteroidSpawnMultiplier: 5,
}
```

Occurrence yaratıldıktan sonra bu payload değişmez. Config'in sonraki deploy'da ×4 veya süreyi
90 dakika yapması mevcut sezonu değiştirmez; yalnızca yeni sezon takvimine uygulanır.

### 4.4 Temizlik yolları

Yeni tablo aşağıdaki listelere açıkça eklenir:

- `apps/server/src/services/servers.ts` — seasonal wipe, `seasons` silinmeden önce;
- `apps/server/test/helpers.ts::truncateAll`;
- `apps/server/src/cli/capacity.ts` disposable capacity reset.

`reclaim.ts` değişmemelidir: occurrence player'a değil sezona aittir; tek koltuk reclaim edildiğinde
galaksi etkinliği silinemez. Bu “unutuldu” değil, bilinçli kapsam dışıdır.

---

## 5 · Takvim üretimi

### 5.1 Saf scheduler

Yeni `packages/rules/src/galaxyEvents.ts` I/O, clock ve ambient randomness içermez. Girdileri:

- season süresi;
- typed config;
- config'deki sabitlenmiş UTC+3 offset'i ve Türkiye takvim kovaları;
- dışarıdan verilen RNG.

Çıktısı UUID içermeyen saf plan kayıtlarıdır:

```ts
interface PlannedGalaxyEvent {
  sequence: number;
  kind: GalaxyEventKind;
  startsAtMinute: number;
  endsAtMinute: number;
  definitionVersion: number;
  effect: GalaxyEventEffect;
}
```

Server `asteroidKey` üzerinden `galaxy-events:v1` domain'iyle HMAC/seed üretir ve RNG'yi saf
scheduler'a verir. Böylece:

- takvim restart ve replica'larda yeniden üretilebilir;
- public `season.seed` gelecekteki event saatlerini ele vermez;
- asteroid RNG stream'i tüketilmez;
- `Math.random` rules paketine girmez.

### 5.2 Constraint çözümü

Her tam Türkiye takvim günü için adet `dailyCount.min..max` aralığından deterministik çekilir;
sezonun kısmi ilk/son günü kullanılabilir dakika oranıyla deterministik yuvarlanır. Bu sürümde tek
tür olduğu için seçim doğrudan `ASTEROID_SHOWER`'dır. Başlangıç adayları deterministik, bounded
constraint search ile yerleştirilir. Kısmi ilk/son günlere largest-remainder dağıtımı uygulanır;
keyfî saatte başlayan 14 günlük sezon da toplam 70 occurrence üretir.

Günlük `N` belirlendikten sonra `floor(N × targetShare)` düşük öncelikli pencerenin taban hedefini
üretir. Örneğin `N = 5` ve `targetShare = 0.2` için ilk hedef 1'dir. Kalan adaylar normal pencereye
yüksek, `[00:00, 08:00)` penceresine `overflowWeight` kadar düşük ağırlıkla yerleştirilir. Gece
adedi hiçbir durumda `maxDailyCount = 2` değerini aşamaz. Cooldown yüzünden plan
çözülemiyorsa cap'i delmek veya event'i sessizce düşürmek yerine mevcut fail-fast davranışı
uygulanır.

Her aday şu kurallardan geçer:

1. Gün/sezon sınırları içinde mi?
2. Başlangıç anının Türkiye saat dilimi doğru mu ve düşük-öncelik hard cap'i aşılmış mı?
3. Aynı türün önceki bitişi + cooldown sonrasında mı?
4. Sezonun sonundan önce tam süresini tamamlıyor mu?

Takvim üretildikten sonra `mutuallyExclusive` pair'leri half-open pencere çakışmalarına karşı
fail-fast doğrulanır. İkinci event türü eklenirken weighted tür seçimi ve iki türün birleşik aday
üretimi bu doğrulamanın önüne eklenir; boş config alanı bugün uygulanmış bir çok-türlü solver varmış
gibi yorumlanmamalıdır.

Search deneme limitine ulaşırsa daha az event üretip sessizce devam etmez; config/seed ile birlikte
açık hata verir ve sezon creation transaction'ı rollback olur. Production'a çıkmadan seed corpus
testi, seçilen config'in pratikte her seed için çözülebildiğini kanıtlar.

### 5.3 Sezon yaratma ve repair

`createSeasonIn` içinde, season row yazıldıktan sonra ve transaction commit olmadan:

1. `MULTI_WORLD.galaxyEventsRulesetVersion = 4` ruleset gate'i kontrol edilir;
2. tam sezon takvimi üretilir;
3. occurrence satırları bulk insert edilir;
4. her occurrence için start/end scheduled event yazılır;
5. herhangi bir adım hata verirse season dahil her şey rollback olur.

Worker boot'unda `ensureGalaxyEventLifecycleEvents` benzeri dar bir repair çalışır:

- yalnızca occurrence'ı olup start/end queue satırı eksik olan kayıtları onarır;
- `dedupe_key` unique index'i ile iki boot/replica yarışında çift yazmaz;
- geçmiş `resolveAt` değerini “şimdi”ye çevirmeden korur; worker overdue işi sırayla claim eder;
- `failed` event'i gizlice kopyalayıp sağlık alarmını örtmez.

Özellik ruleset v4 ile yaratılan yeni sezonda seed edilir; bu özellik deploy edilmeden önce yaratılmış
canlı sezona occurrence backfill yapılmaz. Aktivasyon yeni season boundary'sinde olur. Bunun
nedenleri D143, rollback güvenliği ve config snapshot bütünlüğüdür.

---

## 6 · Asteroid bonus lane tasarımı

### 6.1 Üretim formülü

Bir occurrence için:

```text
normalRate = GALAXY.asteroidSpawnPerHour
bonusRate  = normalRate × (multiplier − 1)
bonusCount = round(bonusRate × durationHours)
```

60 dakika ve ×5 için yaklaşık 41 bonus kaya üretilir. Normal schedule aynı pencerede kendi yaklaşık
10 kayasını üretmeye devam eder; toplam giriş yaklaşık 52/saat olur.

Bonus spawn'lar occurrence penceresine eşit aralıklı slot + slot içi jitter ile yayılır. Başlangıçta
41 kayayı tek frame'de patlatmak hem görsel yığın hem de madencilik fırsatında tek anlık piyango
üretir; mevcut alanın steady-spawn prensibi korunur.

### 6.2 Index ve RNG izolasyonu

`generateAsteroidSchedule` tarafından üretilen mevcut alan önce aynen oluşturulur. Ardından
`startsAt + sequence` sırasındaki her Asteroid Yağmuru için bonus lane append edilir.

- İlk bonus index = mevcut alanın son index'i + 1.
- Her occurrence bağımsız RNG alır; önerilen domain:
  `asteroid:shower:<seasonId>:<sequence>:v1`. Buradaki `sequence`, saf scheduler'ın ürettiği ve
  occurrence satırında değişmeden saklanan deterministik sezon sırasıdır; rastgele DB UUID'si RNG
  girdisi yapılmaz.
- Bir shower lane'indeki draw sayısı başka occurrence'ın veya base lane'in stream'ini etkilemez.
- Occurrence satırları canlı sezonda eklenmez/silinmez/sıralanmaz; böylece sonraki bonus indexleri
  kaymaz.
- Opaque id mevcut `asteroidId(asteroidKey, index)` yolunu kullanmaya devam eder.

### 6.3 Cache değişikliği

Bugünkü cache yalnızca `asteroidKey` ile anahtarlanıyor. Artık alan aynı key yanında immutable
occurrence snapshot'ına da bağlıdır.

Öneri:

- base field cache ayrı ve mevcut davranışı korur;
- composed season field cache `seasonId + eventScheduleSignature` ile anahtarlanır;
- signature occurrence `sequence/kind/start/end/effect/version` değerlerinden oluşur; rastgele
  occurrence UUID'si dahil edilmez;
- `idCache` de composed field signature'ını kullanır; yalnız `asteroidKey` kullanırsa bonus opaque
  id'ler lookup map'inde bulunmaz;
- cache bounded LRU kalır ve yeni process eski snapshot taşımadığı için deploy sonrası temiz başlar.

### 6.4 Mining akışında tek authoritative field

Aşağıdaki yolların hepsi aynı composed field'i okumalıdır:

- `/api/mining` ve `/api/mining/field` projection;
- asteroid discovery ve `nextFieldChangeAt`;
- opaque id → index çözümü;
- `launchMining` visibility/availability kontrolü;
- mining arrival settlement;
- isotope projection;
- test helper'ları ve güvenilir server tooling.

Sadece GET yolunu bonus alanla güncellemek, oyuncuya görünen ama launch'ta “yok” denen kayalar
üretir. Sadece launch yolunu güncellemek ise gizli hedef enumeration açığı yaratır.

### 6.5 Fog ve güvenlik

- Raw occurrence takvimi ve gelecekteki shower saatleri mining API'ye çıkmaz.
- Bonus kaya ancak oyuncunun mevcut sensor epoch'larından biriyle D143'e göre keşfedilmişse döner.
- Opaque id regex ve HMAC doğrulaması değişmez.
- Undiscovered bonus id tahmin edilse bile launch `ASTEROID_UNAVAILABLE`/404 verir.
- Shower SSE payload'ı yalnız shard + kind taşır; kaya id, konum, count veya spawn anı taşımaz.

---

## 7 · Yaşam döngüsü, bildirim ve realtime

### 7.1 Start handler

`onGalaxyEventStart` transaction içinde:

1. occurrence row `FOR UPDATE` alınır;
2. event/season/ref eşleşmesi ve effect payload Zod ile doğrulanır;
3. `start_processed_at` doluysa işlem idempotent no-op olur;
4. sezondaki player id'leri bounded query ile alınır;
5. notification satırları **tek bulk insert** ile yazılır, conflict'ler atlanır;
6. Chronicle'a `galaxy_event_started` kaydı yazılır;
7. `start_processed_at = clock.now()` yazılır;
8. transaction içinde `publishShard(..., 'galaxy-event')` çağrılır; PostgreSQL actual teslimatı
   yalnız commit'ten sonra yapar.

Notification `createdAt`, worker'ın geç claim ettiği an değil occurrence `startsAt` olmalıdır.

### 7.2 End handler

`onGalaxyEventEnd` aynı kurallarla bitiş satırlarını yazar. Ek güvenlik:

- start marker yoksa shared start-delivery fonksiyonunu önce aynı transaction içinde çalıştırır;
- ardından end notification/Chronicle kaydını occurrence `endsAt` anıyla yazar;
- `end_processed_at` doluysa no-op olur.

Bu, start beş kez hata verirken end event'inin aynı batch'te öne geçmesi halinde tarihçenin “bitti,
sonra başladı” şeklinde yazılmasını engeller.

### 7.3 Bulk notification servisi

`services/notifications.ts` tek notification yazma otoritesi olarak kalır. Yanına genel bir
`notifySeasonPlayers` eklenir; handler içinde ikinci bir insert implementasyonu kopyalanmaz.

300 kişilik galakside her sınırda:

- 300 notification row;
- bir bulk `INSERT ... ON CONFLICT DO NOTHING`;
- bir shard `NOTIFY`;
- 300 ayrı `pg_notify` yok.

Yeni katılan tek oyuncunun active-event backfill'i mevcut `notify` ile player topic'ine gidebilir.

### 7.4 Chronicle

Başlangıç ve bitiş public state transition olduğu için Chronicle'a da yazılır:

- `galaxy_event_started`
- `galaxy_event_ended`

Payload yalnız zaten public olan event kind, pencere ve multiplier bilgisini taşır. Kaya listesi,
keşif, kimlerin madencilik yaptığı veya isotope ayrıntısı taşımaz.

### 7.5 SSE ve cache invalidation

Yeni shard kind: `shard:galaxy-event`.

Client mapping:

- `keys.galaxyEvents`
- `keys.notifications`
- `keys.miningField`

Chronicle writer ayrıca mevcut `shard:chronicle` yayınını üretir. Coalescer aynı 250 ms pencerede
query key'lerini tekilleştirir.

Server projection mapping `shard:galaxy-event` için mining cache'ini invalid eder. Composed alan
immutable takvimi zaten taşısa da bu invalidation başlangıç/bitiş sınırında replica'ların aynı
generation'da kalmasını sağlar ve gelecekte event effect adapter'ları eklendiğinde unutulacak gizli
bir cache bağı bırakmaz.

---

## 8 · API ve istemci sözleşmesi

### 8.1 Yeni route

Route: `GET /api/galaxy/events`.

- Auth zorunlu.
- Season id istemciden alınmaz; player row'dan türetilir.
- Yalnız `startsAt <= now < endsAt` occurrence'ları döner.
- Planlanan gelecek event'ler veya gizli schedule dönmez.
- Liste config ile bounded'dır.
- Event kind istemcide string olarak parse edilir; yeni server/eski client kombinasyonu tüm
  response'u düşürmez.

Örnek response:

```json
{
  "events": [
    {
      "id": "uuid",
      "kind": "ASTEROID_SHOWER",
      "startsAt": "2026-09-01T12:00:00.000Z",
      "endsAt": "2026-09-01T13:00:00.000Z",
      "asteroidSpawnMultiplier": 5
    }
  ]
}
```

Yeni route `app.after()` içindeki kayıt zincirine eklenir ve server/client contract testine girer.

### 8.2 Client query

Eklenecek parçalar:

- `galaxyEventsSchema`;
- API client metodu;
- `keys.galaxyEvents`;
- `useGalaxyEvents` query;
- 60 saniyelik safety refetch;
- reconnect/focus resync listesi;
- `shard:galaxy-event` dar invalidation mapping'i.

Aktif event `endsAt` taşıdığı için istemci:

- geri sayımı yalnız `serverNow()` ile hesaplar;
- bitişte lokal olarak chip'i gizleyebilir;
- `endsAt + worker settle offset` anında events/mining field/notifications için bir reconciliation
  read armar;
- cihaz saatiyle yetkili karar vermez.

Başlangıç önceden istemciye verilmediği için prediction yapılmaz; SSE, reconnect ve safety poll
başlangıcı getirir.

### 8.3 Galaxy UI

Minimum tamamlanmış yüzey:

- `GalaxyView` / `DiscReadout` yakınında aktif event chip/strip;
- “Asteroid yağmuru · ×5 spawn · 43 dk” benzeri, tamamen i18n cümlesi;
- mobile portrait'te dünya/online/rock sayısını ezmeyecek tek satırlı düzen;
- `aria-live="polite"` veya eşdeğer erişilebilir değişim;
- notification satırına dokununca Signals kapanır ve galaksi görünümü açık kalır.

Sadece toast yeterli değildir. Oyuncu toast'ı kaçırsa bile etkinliğin devam ettiğini ve ne zaman
biteceğini görebilmelidir; “görülemeyen kural kullanılamaz” invarianti bunu gerektirir.

### 8.4 Signals

`lib/notifications.ts`:

- lifecycle payload Zod parser;
- iki kind için i18n description;
- alarm değil, normal info tonu;
- start notification diğer düşük öncelikli bildirimler gibi toast olabilir;
- inbound fleet/raid urgency'sini geçmez;
- end notification urgent değildir.

`Signals.tsx`:

- lifecycle kind'ları galaksiye dönen destination map'e girer;
- exhaustive notification route testi güncellenir;
- mümkünse mevcut `GalaxyIcon`/`DrillIcon` kullanılır; yeni raster asset gerekmez.

### 8.5 Dekoratif meteor tuzağı

`apps/web/src/galaxy/Environment.tsx::Meteors` tamamen local, `Math.random` kullanan dekoratif bir
efekttir ve docblock'u hiçbir bilgi taşımadığını açıkça söyler. Asteroid Yağmuru authority'si buna
bağlanmamalı ve bu efekt spawn sayısı olarak kullanılmamalıdır.

İlk sürümde özel meteor VFX kapsam dışıdır. Sonradan eklenirse yalnız active event state'in görsel
yorumu olur; gameplay kayaları ve madencilik hedefleri yine authoritative field'dan gelir.

---

## 9 · Uygulama fazları

Her faz TDD sırasını izler:

1. requirement/edge case;
2. test yaz;
3. testi çalıştır ve beklenen nedenle **FAIL** gördüğünü kaydet;
4. minimum implementation;
5. focused test **PASS**;
6. ilgili package suite;
7. refactor;
8. tekrar test;
9. phase gate.

Bir fazın testi yeşil olmadan sonraki faza geçilmez.

### Phase 0 · Karar ve rollout sözleşmesi

**Amaç:** Koddan önce ürün ve authority çelişkilerini kapatmak.

Yapılacaklar:

1. Yeni owner decision kaydı ekle:
   - public galaxy lifecycle event'leri Signals istisnasıdır;
   - Asteroid Yağmuru spawn-rate çarpanıdır;
   - event bitişi yalnız yeni bonus spawn'ı durdurur; bonus kayalar bitişte silinmez;
   - Türkiye saati 00:00–08:00 düşük önceliklidir; 5 event'lik günde hedef 1, hard cap 2'dir;
   - D143 fog aynen kalır;
   - ilk aktivasyon season/ruleset boundary'sidir.
2. Günlük `5..5` ve `repeatCooldownMinutes = 120` değerlerini typed config'de kilitle.
3. Isotope dağılımının normal kayalarla aynı olduğu kararı kaydet.
4. `MULTI_WORLD.galaxyEventsRulesetVersion = 4` sezon gate'ini kullan; eski canlı sezona backfill
   yapma.

**Dokunulacak dokümanlar:**

- `docs/decisions.md`
- `docs/game-design.md`
- `docs/architecture.md`
- `docs/balance.md`
- `docs/interface.md`
- gerekirse `CLAUDE.md` current-state/invariant özeti

**Gate:** Notification kapalı-listesiyle yeni istek arasında çelişkili metin kalmaz; sayısal config
“örnek” değil production için açık değerdir.

### Phase 1 · Saf config ve takvim scheduler'ı

**Önce testler:** `packages/rules/test/galaxy-events.test.ts`.

Test vakaları:

- aynı RNG/config aynı planı üretir;
- farklı seed'ler zaman dağılımını değiştirir;
- her tam Türkiye takvim gününde adet min/max içindedir;
- sezonun kısmi ilk/son Türkiye günü deterministik ve orantılı adet üretir;
- cihaz/process timezone'u değişse de aynı calendar girdisi aynı planı üretir;
- `[00:00, 08:00)` penceresi blackout değildir; çok-seed corpus'unda event üretir;
- günlük toplam 5 iken düşük-öncelikli pencerenin hedefi 1, hard cap'i 2'dir;
- hiçbir Türkiye takvim gününde 00:00–08:00 başlangıç sayısı 2'yi aşmaz;
- tam 00:00 düşük, tam 08:00 normal öncelik olarak sınıflandırılır;
- düşük öncelikli pencere gündüze göre corpus genelinde daha az event alır;
- duration tam 60 dakikadır;
- aynı event tekrarları end + Y'den önce başlamaz;
- `mutuallyExclusive` config alanı typed'dır, üretilen takvim üzerinde half-open overlap'i fail-fast
  doğrular ve ilk tek-tür sürümünde boştur;
- end/start aynı anı overlap sayılmaz;
- event season dışına taşmaz;
- config `min > max`, duration ≤0, multiplier ≤1, negatif cooldown ile fail eder;
- düşük-öncelik başlangıç/bitiş aralığı geçersizsa, `targetShare`/`overflowWeight` 0–1 dışındaysa
  veya `maxDailyCount` negatifse config fail eder;
- çözülemeyen config sessiz eksik occurrence üretmez, açıklayıcı hata verir;
- 14 günlük birçok seed corpus'u bounded deneme limitini aşmaz;
- rules paketi clock/I/O/ambient randomness almaz.

**Implementation dosyaları:**

- `packages/rules/src/constants.ts`
- `packages/rules/src/galaxyEvents.ts` — yeni
- `packages/rules/src/index.ts`

**Kırılabilecek yer:** `packages/rules` lint boundary. `Date`, `Date.now`, `Math.random`, Node crypto
ve server tipi import edilmemeli.

**Gate:** rules typecheck/lint/focused suite yeşil; invalid config gerçekten fail-fast.

### Phase 2 · Persistence, migration ve season seeding

**Önce testler:** Yeni `apps/server/test/galaxy-events.test.ts` ve season lifecycle testleri.

Test vakaları:

- eligible yeni season occurrence'ları ve iki lifecycle event'i atomik yazar;
- eski ruleset season'ı occurrence üretmez;
- aynı `(season, sequence)` iki kez yazılamaz;
- aynı occurrence için ikinci start/end schedule yazılamaz;
- occurrence zamanı/effect snapshot config değişiminden etkilenmez;
- season creation ortasında hata tüm satırları rollback eder;
- boot repair eksik queue satırını bir kez geri getirir;
- failed lifecycle satırını duplicate ile gizlemez;
- wipe ve capacity reset FK/leak bırakmaz.

**Implementation dosyaları:**

- `apps/server/src/db/schema.ts`
- generated `apps/server/drizzle/<next>_*.sql`
- `apps/server/drizzle/meta/<next>_snapshot.json`
- `apps/server/drizzle/meta/_journal.json`
- `apps/server/src/services/galaxyEvents.ts` — yeni
- `apps/server/src/services/season.ts`
- `apps/server/src/index.ts`
- `apps/server/src/services/servers.ts`
- `apps/server/test/helpers.ts`
- `apps/server/src/cli/capacity.ts`

Migration `pnpm --filter @astera/server db:generate` ile üretilir; uygulanmış migration elle
değiştirilmez. App image'dan önce migration koşar ve `assertSchemaCurrent` korunur.

**Gate:** gerçek PostgreSQL persistence testleri ve season/wipe suite yeşil.

### Phase 3 · Asteroid shower bonus lane

**Önce testler:** rules asteroid testleri + server mining/fog/security testleri.

Test vakaları:

- shower yokken mevcut alanın tamamı sabit fixture'a göre byte-for-byte aynıdır;
- shower eklemek base ve D110 extra lane'in hiçbir kayasını değiştirmez;
- 60 dk ×5 occurrence doğru bonus count/rate üretir;
- bonus `appearsAt` yalnız `[start, end)` içindedir;
- bonus kayalar event bittikten sonra kendi `expiresAt` anlarına kadar aktif kalır;
- `endsAt` öncesi/sonrası snapshot karşılaştırmasında doğal olarak expire olanlar dışında hiçbir
  asteroid topluca silinmez ve `endsAt` ya da sonrasında yeni bonus kaya doğmaz;
- event bitişi composed-field/id cache'ini boşaltıp canlı hedefleri geçersiz kılmaz;
- tüm indexler unique ve baseline sonrasındadır;
- occurrence başına RNG izolasyonu korunur;
- cache hit/miss aynı field'i verir;
- bonus opaque id resolve edilir;
- undiscovered bonus rock API'de ve launch'ta gizlidir;
- discovered bonus rock normal şekilde launch/claim edilebilir;
- event end, aktif mining run'ı bozmaz;
- `nextFieldChangeAt` bonus discovery/expiry'yi doğru hesaplar;
- isotope entitlement bonus kayalarda da korunur.

**Implementation dosyaları:**

- `packages/rules/src/galaxy.ts` veya yeni dar asteroid-event helper'ı
- `packages/rules/test/invariants.test.ts`
- `packages/rules/test/asteroid-yield.test.ts`
- `apps/server/src/services/asteroidField.ts`
- `apps/server/src/services/mining.ts`
- gerekirse `apps/server/src/services/projections.ts`
- `apps/server/test/mining.test.ts`
- `apps/server/test/asteroid-fog.test.ts`
- `apps/server/test/asteroid-api-security.test.ts`
- `apps/server/test/helpers.ts`

**Özel kontrol:** `fieldOf`, GET projection ve launch validation aynı composed field kaynağına
taşınmadan phase tamamlanmış sayılmaz.

**Gate:** mevcut asteroid fixture'ları değişmeden, yeni bonus alan tüm mining/fog testlerinden geçer.

### Phase 4 · Worker lifecycle, bildirim ve Chronicle

**Önce testler:** worker, notifications, Chronicle ve concurrency.

Test vakaları:

- start tam scheduled instant ile tüm mevcut oyunculara yazılır;
- end aynı occurrence için ayrı kind olarak yazılır;
- start/end duplicate delivery notification/Chronicle/SSE çoğaltmaz;
- iki eşzamanlı handler'dan yalnız biri yan etki üretir;
- transaction ortası hata marker, notification ve Chronicle'ın tamamını rollback eder;
- worker altı saat kapalıyken start/end resolve-time sırasıyla ve authoritative timestamp'le yazılır;
- end start'tan önce işlenmeye çalışılırsa tarihçe yine start → end olur;
- event effect worker kapalıyken saatinde devam eder/biter;
- active event sırasında join eden oyuncu start bildirimi alır;
- event bittikten sonra join eden geçmiş kişisel bildirim almaz;
- 300 oyuncu tek bulk insert ve tek shard publish kullanır;
- worker permanent failure `/health.failedEvents` tarafından görünür kalır.

**Implementation dosyaları:**

- `apps/server/src/services/notifications.ts`
- `apps/server/src/services/chronicle.ts`
- `apps/server/src/services/player.ts`
- `apps/server/src/worker/handlers.ts`
- `apps/server/src/stream/bus.ts`
- `apps/server/src/services/projections.ts`
- `apps/server/test/worker.test.ts`
- `apps/server/test/notifications.test.ts`
- `apps/server/test/chronicle.test.ts`
- `apps/server/test/concurrency.test.ts`
- gerekirse `apps/server/test/broadcast.test.ts`

**Gate:** retry/concurrency/failure testleri yeşil; notification idempotency tek writer üzerinden.

### Phase 5 · API, realtime ve istemci yüzeyi

**Önce testler:** API contract, shard routing, notification rendering/routing, i18n ve component.

Test vakaları:

- caller yalnız kendi season'ının aktif event'ini alır;
- gelecek/bitmiş occurrence dönmez;
- malformed DB effect payload kontrollü hata/telemetry üretir, unsafe cast ile geçmez;
- server response client Zod schema'sından geçer;
- bilinmeyen future event kind eski client'ta tüm listeyi kırmaz;
- `shard:galaxy-event` yalnız events + notifications + mining field'i invalid eder;
- coalescer duplicate reads üretmez;
- SSE kaçıran reconnect/focus/safety poll aktif event'i getirir;
- start/end notification Türkçe ve İngilizce doğru cümleyi üretir;
- her yeni notification kind'ın destination'ı vardır;
- event chip server clock ile geri sayar ve `endsAt` sınırında kaybolur;
- aktif event mobile portrait'te readout'u taşırmaz;
- toast raid/incoming fleet'i öncelik sırasında aşağı itemez;
- i18n placeholder ve iki dil parity testleri geçer.

**Implementation dosyaları:**

- `apps/server/src/routes/galaxyEvents.ts` — yeni
- `apps/server/src/app.ts`
- `apps/server/test/contract.test.ts`
- `apps/web/src/api/schemas.ts`
- `apps/web/src/api/client.ts`
- `apps/web/src/api/keys.ts`
- `apps/web/src/api/queries.ts`
- `apps/web/src/session/shardEvents.ts`
- `apps/web/src/session/useEventStream.ts`
- `apps/web/src/lib/notifications.ts`
- `apps/web/src/shell/Signals.tsx`
- `apps/web/src/screens/GalaxyView.tsx`
- `apps/web/src/screens/ChronicleScreen.tsx`
- `apps/web/src/screens/ChronicleLauncher.tsx`
- `apps/web/src/i18n/locales/en/data.ts`
- `apps/web/src/i18n/locales/tr/data.ts`
- `apps/web/src/i18n/locales/en/chronicle.ts`
- `apps/web/src/i18n/locales/tr/chronicle.ts`
- `apps/web/test/shard-events.test.ts`
- `apps/web/test/notification-routes.test.tsx`
- `apps/web/test/i18n.test.ts`
- yeni event surface/component testi

Frontend değişikliği gerçek uygulamada `node tools/visual.mjs` ile ve mobile portrait ekran
görüntüsüyle doğrulanır.

**Gate:** contract + web suite + görsel QA yeşil; toast, Signals ve kalıcı active chip birlikte
çalışır.

### Phase 6 · Uçtan uca dayanıklılık ve regresyon

Senaryolar:

1. Season yarat → event öncesi field oku → start sınırı → bonus rock keşfet → mining launch →
   event end → rock'a var → ore claim → eve dön.
2. API ve worker ayrı process; worker notification yazarken API SSE bağlantısı açıktır.
3. Worker start transaction commit'inden sonra, queue `complete()` öncesi SIGKILL olur; retry
   duplicate üretmez.
4. Event start/end boyunca LISTEN kopar; reconnect authoritative event/notification/field state'ini
   geri toplar.
5. Aynı saniyede shower start + mining arrival + battle olur; queue sırası ve coalescer hiçbir
   private/public payload'ı kaybetmez.
6. Season end'e yaklaşan event schedule'a alınmaz; mevcut Prospector season guard'ı bozulmaz.
7. Wipe sonrası eski occurrence, bonus field cache veya notification yeni sezona taşmaz.
8. Eski client yeni notification kind'ını atlar ama diğer Signals geçmişini göstermeye devam eder.

**Gate:** focused E2E/worker suites yeşil; `pnpm verify` mevcut bilinen blocker dışında yeni hata
üretmez. Mevcut `CLAUDE.md` VFR blocker'ı hâlâ varsa yeni değişiklikle ilgisiz olduğu kanıtlanıp
ayrı raporlanır; test bandı gevşetilmez.

### Phase 7 · Denge, kapasite ve güvenlik ölçümü

Bu phase release öncesi zorunludur. ×5, “yalnızca daha fazla görsel” değildir; doğrudan ekonomi ve
Deuterium arzıdır.

#### Denge hesabı

Günlük `h` saat shower ve multiplier `m` için ortalama spawn çarpanı:

```text
averageMultiplier = 1 + (m - 1) × h / 24
```

×5 ve günde 5 adet birer saatlik shower, çakışma olmadığı varsayımıyla yaklaşık **×1.83** günlük
asteroid arzı anlamına gelir. Bu değer ürün config'idir; ekonomi ve kapasite kabul ölçümü rollout
gate'i olmaya devam eder.

Bu oran cevher, Crystal ve isotope/Deuterium tavanlarını birlikte hareket ettirir. Şunlar ölçülür:

- ilk/orta/geç oyun mined income payı;
- Crystal ve Deuterium median/percentile stokları;
- refinery/extractor yatırımlarının anlamını koruması;
- Prospector bay doluluğu ve asteroid yarış oranı;
- empty sky / swarm population sınırları;
- simulator mevcut pacing modelinin event bonusunu gerçekten modelleyip modellemediği.

Simulator faydayı modellemiyorsa sağlık bantları bu özelliğe göre ayarlanmaz; önce model eklenir.

#### Kapasite

Worst-case yaklaşık değerler:

- base field: 14 günde yaklaşık 3.478 kaya;
- 5 shower/gün: yaklaşık 2.900'e kadar ek kaya;
- toplam composed schedule: yaklaşık 6.400 kaya/season;
- 70 event × 2 lifecycle × 300 oyuncu: yaklaşık 42.000 notification row/season;
- 140 ek scheduled event/season.

Ölçülecekler:

- Türkiye saati saat-bandı histogramı; 00:00–08:00 hedef payı ve günlük hard-cap ihlali;
- field generation süresi ve heap;
- per-player discovery/`nextFieldChangeAt` CPU p50/p95/p99;
- `/api/mining/field` response süresi ve cache hit oranı;
- start/end bulk insert transaction süresi;
- SSE fanout ve coalesced refetch sayısı;
- Signals latest-30 sınırında event satırlarının kişisel savaş haberlerini aşırı hızlı itip itmediği;
- 300-client capacity harness.

#### Güvenlik

- Future schedule hiçbir API/body/SSE/cache key üzerinden istemciye sızmaz.
- Opaque id tahmini bonus kayayı açmaz.
- Event kind/effect DB JSON'u Zod parse edilmeden effect adapter'a girmez.
- Başka season id'siyle event route sorgulanamaz.
- Admin/manual event yaratma endpoint'i bu sürümde yoktur; ileride eklenirse aynı scheduler validator
  ve transaction yolunu kullanmak zorundadır.

**Gate:** sabit 5/gün ve 120 dakika cooldown değerleriyle full capacity bütçesi aşılmaz.

### Phase 8 · Doküman, deploy ve rollout

Doküman güncellemeleri implementation ile aynı commit serisinde tutulur; sona bırakılmaz.

Deploy sırası:

1. Tüm testler ve visual QA.
2. Generated migration production DB'ye uygulanır.
3. Yeni event enum/table'ını bilen API image'ları deploy edilir.
4. Yeni event handler'ını bilen tek worker deploy edilir.
5. Bus/worker/health kontrol edilir.
6. Yalnız bundan sonra event-enabled yeni ruleset season oluşturulur.
7. İlk occurrence öncesi dry read: occurrence count, queue pair count, baseline asteroid fingerprint.
8. İlk start/end canlı gözlem: lateness, notification count, Chronicle, SSE, mining field.

Rollback:

- Event-enabled season açılmadan önce eski binary'ye dönüş güvenlidir.
- Event occurrence'ları schedule edildikten sonra pre-feature worker'a dönmek güvenli değildir;
  eski worker yeni event kind'ını “unknown” görüp done işaretler. Böyle bir rollback worker'ı önce
  durdurmayı ve uyumlu forward fix/operasyon planını gerektirir.
- Config değiştirip canlı occurrence'ı iptal etmek yoktur. Snapshot canlı sezon boyunca korunur.
- Gerekirse sonraki season için event scheduling kapatılır; mevcut sezonun kayaları veya görevleri
  silinmez.

Gözlem:

- worker lateness ve failed event count;
- occurrence start/end processed lag;
- beklenen/alınan notification row sayısı;
- bus listening/delivery health;
- mining projection p95;
- active event API hata oranı;
- event başlangıcında/bitiminde client refetch fanout.

**Gate:** ilk canlı event start/end kanıtı `docs/playtest-log.md` veya release log'a kaydedilir.

---

## 10 · Dosya temas matrisi

| Alan | Dosya(lar) | Değişiklik |
|---|---|---|
| Rules config | `packages/rules/src/constants.ts` | event calendar/definition config |
| Rules scheduler | `packages/rules/src/galaxyEvents.ts`, `index.ts` | saf takvim ve tipler |
| Asteroid generation | `packages/rules/src/galaxy.ts` | bağımsız shower lane |
| Rules tests | `packages/rules/test/galaxy-events.test.ts`, asteroid/invariant testleri | determinism, cooldown, quiet-hours, stable base |
| DB | `apps/server/src/db/schema.ts`, generated drizzle migration/meta | occurrence tablosu ve append-only enum'lar |
| Season | `apps/server/src/services/season.ts` | takvimi atomik seed etme |
| Boot repair | `apps/server/src/index.ts`, event service | eksik lifecycle queue onarımı |
| Event domain | `apps/server/src/services/galaxyEvents.ts` | schedule read, payload parse, active projection |
| Asteroid server field | `services/asteroidField.ts`, `services/mining.ts` | composed field/cache/launch authority |
| Worker | `worker/handlers.ts` | start/end handler registry |
| Notification | `services/galaxyEvents.ts` | bulk season notification |
| Chronicle | `services/chronicle.ts` | public start/end geçmişi |
| Realtime | `stream/bus.ts`, web `session/shardEvents.ts` | `shard:galaxy-event`, cache invalidation |
| Join | `services/player.ts` | active event start notification backfill |
| Route | `routes/galaxyEvents.ts`, `app.ts` | active-only authenticated API |
| Cleanup | `services/servers.ts`, `test/helpers.ts`, `cli/capacity.ts` | sezon/wipe/truncate |
| Web API | `api/schemas.ts`, `client.ts`, `keys.ts`, `queries.ts` | event contract/query |
| Web realtime | `session/shardEvents.ts` | dar invalidation + interval heal |
| Web notifications | `lib/notifications.ts`, `shell/Signals.tsx` | parser, cümle, destination, glyph |
| Web galaxy | `screens/GalaxyView.tsx`, `screens/ActiveGalaxyEvent.tsx` | active event chip ve countdown |
| Web Chronicle | `ChronicleScreen.tsx`, `ChronicleLauncher.tsx` | start/end tarihçesi |
| i18n | `locales/{en,tr}/data.ts`, `chronicle.ts` | bütün kullanıcı metinleri |
| Server tests | yeni event testi + worker/notification/contract/mining/fog/wipe | persistence ve failure |
| Web tests | shard events, notification routes, i18n, yeni event surface | client behavior |
| Docs | decisions/design/architecture/balance/interface/deployment | authority ve operasyon |

İlk sürümde dokunulmaması beklenen yerler:

- asteroid `.glb` assetleri;
- `Environment.tsx::Meteors` gameplay logic'i;
- combat, fleet veya building kuralları;
- mining ore/Crystal/isotope dağılım sabitleri — ölçüm ayrı bir denge kararı gerektirmedikçe;
- per-planet economy tick.

---

## 11 · Kırılma riskleri ve önlemler

| Risk | Sonuç | Önlem / kanıt |
|---|---|---|
| Base asteroid RNG'si bonus için tüketilir | Bütün canlı kayalar yer değiştirir, opaque id/claim/run bozulur | Bağımsız occurrence RNG; baseline fingerprint testi |
| Bonus indexler config değişince kayar | Claim başka kayaya bağlanır | Immutable occurrence effect/version; season-boundary config |
| Cache yalnız asteroidKey kullanır | Bonus id resolve olmaz veya eski field sunulur | Composed schedule signature hem field hem id cache'te |
| GET ve launch farklı field okur | Görünen kayaya launch reddi veya gizli kayaya launch | Tek `fieldOf`/composed authority |
| Event bitince bonus kayalar silinir | Uçuş hedefi yok olur, kaynak kaybı | Spawn penceresi ile rock lifetime ayrımı; end-run testi |
| Worker event effect'in authority'si yapılır | Worker outage spawn'ı geç başlatır/bitirir | Effect schedule + authoritative clock'tan türetilir |
| Duplicate delivery iki bildirim üretir | Signals spam | occurrence lock + markers + unique notification ref + conflict no-op |
| 300 ayrı player NOTIFY | DB/SSE fırtınası | Bulk notification + tek shard invalidation |
| Eski client yeni enum'u parse edemez | Signals tamamen boş kalır | kind string; unknown row/event graceful degradation |
| Future event schedule API'ye çıkar | Oyuncular fırsatı önceden otomasyona bağlar | active-only query, secret domain-separated seed |
| D143 atlanır | Bütün bonus kaya koordinatları download edilir | Existing sensor-history projection/launch gate yeniden kullanılır |
| Gün cihaz/host timezone'u ile hesaplanır | Oyuncuya göre saat değişir, shardlar farklı schedule üretir | Dar `Europe/Istanbul` calendar adapter'ı + UTC occurrence snapshot + sınır testleri |
| 00:00–08:00 yanlışlıkla blackout olur | Gece oyuncusu hiçbir event göremez | Hedef pay/overflow weight + çok-seed corpus'unda gece occurrence kanıtı |
| Gece hard cap cooldown uğruna delinir | 5 event'in çoğu geceye yığılır | Constraint olarak `maxDailyCount = 2`; çözümsüzlükte fail-fast |
| Cooldown yalnız aynı gün kontrol edilir | Gece yarısında erken tekrar | Scheduler önceki günün son event'ini taşır |
| Exclusion tek yönlü config olur | X, Y'yi engellerken Y, X'i engellemez | Global unordered pair modeli |
| Impossible config daha az event üretir | Production davranışı sessizce config'den sapar | Fail-fast + multi-seed solvability test |
| Yeni tablo wipe listesinde unutulur | Season rollover FK hatası veya leak | wipe/capacity/truncate testleri |
| Event notification'ları Signals'ı doldurur | Savaş haberleri latest-30 dışına itilir | Worst cadence ölçümü; gerekirse bounded limit/UX kararı |
| ×5 arz “görsel” sanılır | Refinery/Crystal/Deuterium dengesi çöker | Simulator + full-season metrics; bant genişletmeme |
| Dekoratif meteor gameplay sayılır | Her client farklı authority görür | Environment meteors tamamen ayrı kalır |
| Pre-feature worker'a rollback | Yeni queue kind'ları unknown/done olur | Activation öncesi rollback sınırı ve forward-fix prosedürü |

---

## 12 · Tamamlanma kriterleri

Özellik ancak aşağıdakilerin tamamı sağlandığında bitmiş sayılır:

- [x] Günlük event adedi, süre, multiplier ve cooldown yalnız typed config'den gelir; türler arası
      exclusion alanı ikinci event türüne kadar bilinçli olarak boştur.
- [x] Türkiye saati `[00:00, 08:00)` düşük önceliklidir; 5 event'lik tam günde taban hedef 1 ve
      hard cap 2'dir.
- [x] Düşük öncelikli pencere blackout değildir ve cihaz/host timezone'u takvimi değiştirmez.
- [x] Takvim deterministik, gizli, Türkiye takvim kovalarına göre üretilmiş UTC immutable
      snapshot'tır.
- [x] `ASTEROID_SHOWER` tam 60 dakika boyunca yaklaşık ×5 yeni spawn üretir.
- [x] Baseline ve D110 asteroid lane'leri byte-for-byte değişmez.
- [x] Bonus kayalar D143 fog/opaque-id/mining kurallarının tamamına tabidir.
- [x] Event bittiğinde spawn hızı ×1'e döner; aktif bonus kayalar ve uçuşlar doğal süreleri boyunca
      yaşamaya devam eder ve alan kademeli olarak normale iner.
- [x] Başlangıç ve bitiş mevcut oyunculara birer kez bildirilir.
- [x] Event sırasında katılan oyuncu başlangıç bildirimini ve aktif durumu alır.
- [x] Handler retry ve boot repair duplicate üretmez; genel worker crash recovery suite'i yeşildir.
- [x] Worker outage gameplay effect zamanını değiştirmez.
- [x] Chronicle start/end'i son 24 saat public history olarak gösterir.
- [x] SSE payload'ı fog bilgisi sızdırmaz ve client dar query setini invalid eder.
- [x] Galaksi ekranı aktif event'i, ×5 etkisini ve kalan süreyi sürekli gösterir.
- [x] TR/EN metinleri ve notification destination testleri eksiksizdir.
- [x] Yeni route server'ın gerçek response'u ile client Zod contract testinden geçer.
- [x] Wipe, capacity reset ve schema-current deploy akışı testlidir.
- [ ] Denge/simulator ve 300-player capacity ölçümü kabul edilmiştir.
- [ ] `pnpm verify` ortak çalışma ağacındaki Film POC lint/test ve bir bağımsız i18n hatası
      giderildikten sonra yeniden tamamen yeşil kaydedilmiştir; event kapsamı typecheck/lint/testte yeşildir.
- [x] Aktif event chip'i gerçek API ve mobil istemciyle görsel olarak doğrulanmıştır.
- [x] İlgili decisions/game-design/architecture/balance/interface/deployment metinleri kodla aynıdır.

---

## 13 · Rollout öncesi kısa kontrol listesi

1. Çalışma ağacındaki Fleet Catalog V2 ve diğer commit'lenmemiş değişiklikleri yeniden denetle;
   aynı dosyalara körlemesine patch uygulama.
2. Mevcut `pnpm verify` sonucunu kaydet; bilinen VFR blocker'ı ile yeni hataları ayır.
3. Sabit 5/gün, ×5, 60 dakika ve 120 dakika cooldown config'ini değiştirme.
4. Migration drift, paket testleri ve full verify sonucunu kaydet.
5. Yeni season boundary'sini kesinleştirmeden migration dışında production activation yapma.
6. Her phase sonunda bu dokümandaki status/kanıt satırlarını güncelle; plan uygulama sırasında
   bulunan yeni bağımlılıkla birlikte yaşayan entegrasyon kaydı olarak kalsın.
