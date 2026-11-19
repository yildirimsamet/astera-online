# Ay (Moon) — geliştirme ve entegrasyon planı (final, 2026-11-19)

Durum: **final; uygulama sürüyor (§17).**

- Owner kararları Y1–Y4 işlendi; tasarım belgesinde S53–S56 olarak yer alıyor.
- İki maliyet kararı (S30, Y5) 2026-11-19'da owner tarafından verildi (V28, V29).
- Oyun kuralları için tek kaynak `docs/ay-plani-2026-11-18.md` belgesidir (S1–S56).
- Bu belge kuralların **nasıl** kurulacağını anlatır: veri, kod yapısı, sıra, testler ve riskler.
- İki belge çelişirse kuralda tasarım belgesi, yapıda bu belge geçerlidir.
- Her faz bitince §17'deki ilerleme tablosu güncellenir.
- Kod olguları HEAD `d637eabf` üzerinde doğrulandı (§2).

## 0. Kısa özet

**Üç sürüm**

| Sürüm | Ne | Ne zaman |
|---|---|---|
| R1 | F1: koloni düşüşünde gemiler yok olur (§13 F1) | Canlıya ayrı çıkar. Ruleset gerekmez. Önce oyuncuya duyurulur, deploy owner'ın emriyle yapılır. |
| R2 | Ay (F0, F2–F10) | Ruleset 20 ile bir sonraki sezon sınırında açılır. Hedef sınır: EU-1'in bittiği 2026-12-27. |
| R3 | Rakam ayarı | Playtest, canlı ölçüm ve (owner isterse) sim sonrasında. |

**Ana mimari kararlar**

1. **Gövde kavramı:** Dünya iki gövdedir: `PLANET` ve `MOON`. Filonun yeri (`units.location`) ham `'home'` metniyle değil, tek bir konum modülüyle okunur. Eski kodda "evde değilse görevdedir" diye düşünen 15'ten fazla yer var. Bunlar düzeltilmezse aydaki filo "görevde" sayılır (§6.1). **En kritik iş budur.**
2. **Kilit kuralı:** Ay satırı yalnız gezegen satırı kilitliyken değişir. Ayın kendi kilidi yoktur, bu yüzden kilitlenme (deadlock) olmaz.
3. **Hareket tablosu:** Gezegen ↔ ay geçişi ve kapı sıçraması `missions` tablosuna girmez; kendi küçük tablosunda (`moon_moves`) durur. Böylece radar, trafik, Honor ve analitik gibi görevleri tarayan yollara sızmaz.
4. **Tembel zaman:** Çatlak iyileşmesi, kapı şarjı ve kapanma süresi okunduğu anda zamandan hesaplanır. Zamanlanmış olay yalnız bir şeyin o anda **olması** gerektiğinde kullanılır.
5. **Karanlık geliştirme:** Ay kodu master'da, `moonsEnabled(season, shard)` kapısının arkasında yaşar. Canlı sezon (ruleset 19) hiçbir şey görmez. Yeni sezonların varsayılan ruleset sabiti en son, R2 bittiğinde 20'ye çıkar.
6. **Sis sorguda tutulur:** Gizli bir alanı sunucu payload'a hiç koymaz; arayüzün çizmemesine güvenilmez. Her yeni alan için bir sızıntı testi yazılır (§8).
7. **Tohum defteri:** Bir yuvaya tohum ayı sezonda yalnız bir kez konur. Yuva yeniden açılsa bile patlatılmış ya da taşınmış bir tohum ayı geri gelmez (§6.3).

**Owner kararları (2026-11-19)**

- **Y1:** Ayın varlığı ve çatlakları herkese görünür. Nadirliği yalnız dünyayı keşfeden ya da probe atan görür.
- **Y2:** Nötr dünyanın tohum ayına Death Star vurulabilir ve ay yok edilebilir.
- **Y3:** Ay savaşında kaçış yoktur; ay son duraktır.
- **Y4:** Koloni yuvası nötr olarak geri gelirse ayı da onunla kalır ve yeni bir ödül olur.

**Açık:**
- S30: Common ay maliyeti.
- Y5: Ay Çekimi araştırmasının maliyeti ve süresi.

## 1. Sürüm stratejisi ve dal

- **Master'da, kapı arkasında geliştirme.** Owner kuralı "master'da çalış, deploy master'dan"dır. Ay kodu bu kurala şöyle uyar:
  - Her migration eklemelidir ve varsayılan değer taşır. Sezon ortasında deploy edilebilir.
  - Her servis, route, worker, bot ve istemci yolu `moonsEnabled` kapısına bakar.
  - Kapı kapalıyken davranış bire bir bugünküdür. Bunu mevcut testlerin yeşil kalması kanıtlar.
  - Owner ayrı bir worktree isterse plan değişmez; yalnız birleştirme adımı eklenir.
- **Ruleset:**
  - `MOON.rulesetVersion = 20` sabiti F2b'de eklenir.
  - Yeni sezonların aldığı varsayılan `rulesetVersion` (`constants.ts:3599`) **R2'nin son adımında** 19'dan 20'ye çıkar. Erken çıkarsa geliştirme sırasında açılan bir sezon (ör. Kestrel yenilenirse) yarım bir ay sistemiyle başlar.
  - Testler ve stage, sezonu açıkça ruleset 20 ile kurar.
- **Galaksi rolü:**
  - Ay yalnız `MAIN` galakside çalışır; bekleme galaksisi (`WAITING`) kapı dışıdır.
  - Başlangıç galaksisi ayrı tablolar ve servislerle çalıştığı için (`services/starter/`) etkilenmez (S47).
- **Tarih:**
  - Hedef sezon sınırı 2026-12-27'dir.
  - F10'un oyuncu testi bu sınırdan en az bir hafta önce yeşil değilse ay bir sonraki sınıra kalır.
  - Yarım özellik canlıya çıkmaz; sezon ortasında açılmaz.
- **Geri alma:**
  - Sezon başlamadan önce: varsayılan sabiti 19'da bırakmak yeter.
  - Sezon başladıktan sonra: kural geri alınmaz, yalnız hata düzeltmesi yapılır.
  - Migration'lar eklemeli olduğu için kod geri alınırsa veri sorun çıkarmaz.

## 2. Doğrulanmış olgular (kod, HEAD d637eabf)

| # | Olgu | Kaynak |
|---|---|---|
| O1 | `units` birincil anahtarı `(planet_id, hull, location)`. `location`: `'home'`, görev id'si, `dock:<lot>` ya da adlı konum (`pirate:`, `trade:`) | `apps/server/src/db/schema.ts:1818`, `packages/rules/src/damage.ts:44` |
| O2 | `totalUnitsOf` dünyanın bütün konumlarını sayar. Aydaki gemiler Hangar'a kendiliğinden sayılır (S12). | `services/planet.ts:1179` |
| O3 | Tersane Hangar sınırını `projected.units`, iniş sınırını `landingBlock` hesaplar; ikisi de bütün konumları sayar. | `services/build.ts:372`, `services/movement.ts:156` |
| O4 | `homeFleet` yalnız `'home'` satırlarından kurulur. | `services/planet.ts:778` |
| O5 | "Evde ve tamirhanede değilse görevdedir" diye sınıflayan ham sorgular var; bunlar `'moon'` satırını görevde sanar. Liste tablonun altında. | grep |
| O6 | Savaş kilidi (K12, `assertNoArrivalPending`) dünya genelidir. Her kalkış `takeHomeHealth` üzerinden geçer. | `services/homeHealth.ts:30,50` |
| O7 | Saldırı çözümü `onMissionArrival` içinde, yaklaşık 1.000 satır. Rapor `context.environment: 'PLANET'` alanını zaten taşır (1369). | `worker/handlers.ts:285` |
| O8 | Savaş enkazı, yok olan gemi değerinin `DEBRIS.share = 0.30`'udur. | `packages/rules/src/constants.ts:3071` |
| O9 | Death Star nötr dünyaya da vurur. ±1 tier bandı yalnız sahipli hedefte ölçülür; nötrün ölçülecek komutanı yoktur. | `services/strategic.ts:~320,448,503` |
| O10 | Koloni düşünce destek dalgaları eve döner (`releaseSupportForWorldChange`). `loseWave` hazırdır ama bildirim göndermez. | `services/loyalty.ts:418`, `services/clanSupport.ts:700,1043` |
| O11 | Dünya devri `transferPlanetControl` ile yapılır (gemiler :404, destek :440). | `services/ownership.ts:308` |
| O12 | Gezegen satırını silen ya da taşıyan yollar (aşağıda). | — |
| O13 | Nötr dünyalar sezon boyunca kademeli açılır (census). Başkent boş yuvaya yeni satır olarak kurulur; tohum aylı dünyada doğmaz. | `services/season.ts:342,380`, `services/player.ts:313` |
| O14 | Ruleset 19'dur. Özellikler `rulesetVersion >= X` karşılaştırmasıyla açılır. | `constants.ts:3599` |
| O15 | Olay kuyruğu `ORDER BY resolve_at, ref_id, id` ile sıralanır. **Aynı andaki savaş ve iniş sırası rastgeledir.** | `worker/queue.ts:36` |
| O16 | `mission_kind`, `event_kind` ve `notification_kind` Postgres enum'udur; yalnız sona değer eklenebilir. | `schema.ts:87,111,220` |
| O17 | `missions_origin_idx` ve `missions_target_idx` kısmi değildir, bütün geçmişi tarar. | `schema.ts:1977` |
| O18 | Radyasyon kaynağının çapası `anchorKind 'ZONE' / 'PLANET' / 'MONUMENT'` alanıdır. | `schema.ts:2375` |
| O19 | Probe raporu bant kolonlarıyla tutulur. `target_planet_id` cascade'siz bir FK'dir. | `schema.ts:3779` |
| O20 | `watches.last_status` metin kolonudur. | `schema.ts:3978` |
| O21 | Kamusal galaksi D127 kuralıyla tier, sahip ve gelişmişliği gizler. | `routes/galaxy.ts:225` |
| O22 | Görünürlüğün tek kaynağı `packages/rules/src/sight.ts` (`sensorZone`), projeksiyonu `services/traffic.ts`'tir. Bir alanı sorgu gizlemelidir, arayüz değil. | `docs/review-sight.md` §6–7 |
| O23 | Gezegenler far / lite / full LOD ve instanced mesh ile çizilir. | `apps/web/src/galaxy/planetLod.ts`, `PlanetField.tsx` |
| O24 | Oyun 6 dildedir: de, en, es, fr, ja, tr. | `apps/web/src/i18n/locales` |
| O25 | Galaksi rolleri `MAIN` / `WAITING`'dir. Başlangıç galaksisi ayrı tablolardadır. | `schema.ts:541,5597` |
| O26 | Son migration 0252'dir. | `apps/server/drizzle` |
| O27 | Uçuş yuvası `flightSlots(core)` ile hesaplanır ve kalkış dünyasının görevlerini sayar. | `packages/rules/src/economy.ts:166`, `services/flight.ts:149` |
| O28 | Savaşmayan gövdeler (`NON_COMBATANT_HULLS`) gezegen savaşında hiç ölmez. | `worker/handlers.ts:1007` |
| O29 | Gözlemcinin dünya hafızası `probe_world_memories` tablosudur. `silhouette` alanı `publicWorlds` projeksiyonundan kurulur; kaynak PROBE ya da BATTLE'dır; `invalidatedAt` alanı vardır. | `services/intel.ts:770–830`, `schema.ts:3940` |

**O5 — ham `'home'` karşılaştırması yapan yerler.** Hepsi §6.1'de konum modülüne geçer:

- `intel.ts:178,197,975,1083`
- `colonyAbandonment.ts:68`
- `planet.ts:781,860,1200`
- `planetView.ts:243`
- `planetRadiation.ts:125,129,161,276`
- `commanderTransfer.ts:169` (burada `'moon'` transferi yanlışlıkla erteletir)
- `ownership.ts:404`
- `loyalty.ts` (`secedeColony`)
- `homeHealth.ts`
- Servislerde ayrıca 53 tane `eq(units.location` geçiyor; hepsi taranır.

**O12 — gezegen satırını silen ya da taşıyan yollar:**

- **Boşta koltuk geri alma** gezegeni siler, koloniyi nötr olarak yeniden kurmaz (`reclaim.ts:778`).
- **Galaksi silme** bütün gezegenleri siler (`servers.ts:733`).
- **Hesap silme** `demolish`'tan sonra, eskiden nötr yuva olan kolonileri `createNeutralWorld` ile **yeni satır** olarak kurar (`accountDeletion.ts:338–349`).
- **Komutan transferi** gezegen satırlarını aynı id ile hedef sezona **taşır** ve eski koloni yuvalarında yeni nötr dünya kurar (`commanderTransfer.ts:276–300`).

## 3. Mimari ilkeler

1. **Gövde tek kavramdır.**
   - `packages/rules/src/moon.ts` içinde `type WorldBody = 'PLANET' | 'MOON'` tanımlanır.
   - Sunucuda `services/unitLocation.ts` şunları verir: `bodyLocation(body)`, `isStanding(loc)`, `isAway(loc)`, `isDock(loc)`, `isHop(loc)`.
   - Modül dışında ham `'home'` / `'moon'` karşılaştırması yasaktır. Bir **guard test** bunu tarar (mevcut "glow guard" testi gibi).
2. **Tek kilit sırası.**
   - Ay satırı, `moon_moves` ve aydaki birimler yalnız gezegen satırı `lockWorlds` ile kilitliyken değişir.
   - İki dünyaya dokunan işlem (kapı) iki dünyayı tek `lockWorlds` çağrısıyla kilitler; fonksiyon sıralamayı kendisi yapar.
3. **Saf kural tek yerde.**
   - Nadirlik, şans, rıhtım, şarj, çatlak, menzil, tohum ve boyut sınıfı `moon.ts` içinde saf fonksiyonlardır.
   - Sunucu, sim ve istemci aynı fonksiyonları çağırır.
   - Rastgelelik `rng.ts` ile tohumlanır (`hashSeed('moon-birth', missionId)`); `Math.random` kullanılmaz.
4. **Tembel türetim.**
   - `effectiveCracks(moon, now)` son darbeden 24 saat geçtiyse 0 döndürür. İyileşme için olay ya da cron yoktur.
   - `closed_until` ve `gate_ready_at` kullanıldıkları anda zamanla karşılaştırılır.
   - Olay yalnız şunlar için kurulur: iniş, sıçrama bitişi, "kapı hazır" bildirimi, kurulumun bitişi.
5. **Tek kapı.**
   - `moonsEnabled(season, shard)` = `season.rulesetVersion >= MOON.rulesetVersion && shard.role === 'MAIN'`.
   - Sunucu kapı kapalıyken `MOONS_DISABLED` döndürür.
   - İstemci kapı durumunu sezon payload'ındaki `features.moons` alanından okur.
6. **Ayrı hareket tablosu.** Geçiş ve sıçrama `moon_moves` tablosunda, kendi olay türüyle tutulur. `missions` tablosunu tarayan yaklaşık 40 yol (radar, trafik, Honor, yuva, analitik) etkilenmez.
7. **Savaş çekirdeği paylaşılır, büyük handler parçalanmaz.**
   - Gezegen yolunun davranışı değişmez.
   - Yeni `services/moonBattle.ts` dosyası `resolveRaid` fonksiyonunu çağırır.
   - Yalnız ortak olması gereken iki parça çıkarılır:
     - `settleBattleWreck`: enkazı fiyatlar, toplayıcı payını ayırır, ay zarını atar ve enkazı yazar.
     - `applyBattleAftermath`: sadakat, toparlanma kalkanı ve ledger işlerini yapar.
   - Çıkarmadan önce ve sonra gezegen savaşı testleri yeşil olmalıdır.
8. **Sis sorguda.** Her yeni payload alanı için "kim görür?" sorusu cevaplanır ve bir sızıntı testiyle kanıtlanır (§8).
9. **Botlar oyuncu yolundan geçer.** Aynı servis fonksiyonlarını, insanın sahip olduğu bilgiyle çağırırlar. Bot için kısa yol yazılmaz (§10).
10. **Performans tasarımın parçasıdır.**
    - Gözcü için kısmi indeks.
    - Kompakt galaksi payload'u.
    - Yörünge ekran kartında (shader) hesaplanır.
    - Kare başına bellek ayırma yapılmaz.
    - Telefonda (S22) ölçülür (§11).

## 4. Veri modeli ve migration'lar

### 4.1 Yeni tablolar

**`moons`** (her dünyada en çok bir ay, S1)

| Kolon | Tip | Not |
|---|---|---|
| `planet_id` | uuid PK → `planets(id)` **ON DELETE CASCADE** | Ayın gezegensiz anlamı yoktur. CASCADE, O12'deki silme yollarında FK hatasını önler. S56 taşıması silmeden önce yapılır (§6.17). |
| — | Sezon kolonu **yok** | Sezon `planets` üzerinden okunur. Komutan transferi gezegen satırını başka sezona taşıdığı için (O12) ayrı bir sezon kolonu bayatlardı. |
| `rarity` | text + CHECK (`COMMON`, `RARE`, `EPIC`, `LEGENDARY`) | Enum yerine CHECK: ileride `ALTER TYPE` gerekmez. |
| `origin` | text + CHECK (`SEED`, `BUILT`, `BATTLE`) | Yalnız sahibine görünür (§8). |
| `cracks` | smallint not null default 0, CHECK ≥ 0 | Ham sayaç; okumak için `effectiveCracks()` kullanılır. |
| `last_hit_at` | timestamptz null | Kamusaldır (S53). İstemci iyileşmeyi kendisi hesaplar. |
| `closed_until` | timestamptz null | Death Star darbesi kapıyı ve Gözcü'yü 3 saat kapatır. |
| `gate_ready_at` | timestamptz null | Kapı şarjı, kapı başına (S51). |
| `visual_seed` | integer not null | Yüzey ve yörünge bundan çıkar; bütün istemcilerde aynıdır. |
| `born_at` | timestamptz not null | — |
| `born_mission_id` | uuid null | Savaş doğumunun rapor ve Chronicle bağlantısı. |

**`moon_seed_ledger`** (tohum defteri)

- Kolonlar: `season_id`, `slot_index`. İkisi birlikte PK.
- Tohum ayı bir yuvada ilk kez kurulduğunda yazılır.
- `createNeutralWorld` bu defterde kaydı olan yuvaya bir daha tohum ayı koymaz.

**`moon_moves`** (geçiş ve sıçrama; `missions` tablosuna girmez)

| Kolon | Not |
|---|---|
| `id` uuid PK, `season_id`, `owner_player_id` | Hareket galaksi değiştirmez. Komutan transferi bekleyen hareket varken ertelenir (§6.17). |
| `kind` CHECK (`HOP_UP`, `HOP_DOWN`, `JUMP`) | — |
| `from_planet_id`, `to_planet_id` → `planets` ON DELETE CASCADE | Geçişte ikisi aynı dünyadır. |
| `fleet` jsonb, `damage` jsonb | Hasar lotları gemiyle taşınır. |
| `fuel_paid` real | Yalnız JUMP'ta dolu; geçiş ücretsizdir (S49). |
| `depart_at`, `arrive_at` | Geçiş +90 sn, sıçrama +10 sn. |
| `status` CHECK (`PENDING`, `LANDED`, `RETURNED`, `CANCELLED`, `LOST`) | — |
| İndeksler | `(from_planet_id) WHERE status='PENDING'`, `(to_planet_id) WHERE status='PENDING'` |

Hareket sırasında birimler şöyle durur:

- **Geçiş:** Gemiler `hop:<id>` konumuna taşınır. Havadadırlar, hiçbir gövdede sayılmazlar (S37).
- **Sıçrama:**
  - Gemiler 10 saniye boyunca kalkış ayında `'moon'` olarak durur ve o ayın savaşına katılır (§3.4 tasarım).
  - Kalkışa ayrılan miktar `moon_moves` satırından okunur.
  - Aydan yapılan öbür kalkışlar bu ayrılmış miktarı düşerek hesaplanır.

**`moon_scans`** (Gözcü raporları)

- Kolonlar: `id`, `season_id`, `scanner_player_id` → `players` ON DELETE CASCADE, `scanner_planet_id`, `target_planet_id`, `scanned_at`, `fuel_paid`, `pierced` (Legendary), `rows` jsonb (sürümlü yük, `v: 1`).
- Gezegen id'leri **FK değildir**: rapor o anın kaydıdır ve silme yollarına iş eklemez. Artık olmayan bir dünya raporda "artık yok" olarak çizilir.
- İndeks: `(scanner_player_id, scanned_at desc)`.

### 4.2 Kolon eklemeleri

| Tablo | Kolon | Neden |
|---|---|---|
| `missions` | `origin_body`, `target_body` text not null default `'PLANET'` + CHECK | Aydan kalkış (S34), aya saldırı ve transfer (S2/S50), dönüşün hangi gövdeye ineceği, Gözcü görünmezliği. |
| `missions` | Kısmi indeksler `(target_planet_id) WHERE status='in_flight'` ve `(origin_planet_id) WHERE status='in_flight'` | Gözcü taraması ve gövdeye göre K12 bütün geçmişi taramaz (O17). |
| `debris_fields` | `body` text default `'PLANET'` | Yalnız çizim için: enkaz ayın yanında görünür. Toplama çapası gezegen kalır. |
| `watches` | `last_moon_status` text null | Teleskobun iki satırı (S40). |
| `probe_reports` | `moon` jsonb null | Nadirlik, aydaki filo bandı, kapı ve Gözcü durumu, çatlaklar, geçişte bayrağı (S23). |
| `probe_world_memories` | `silhouette.moonRarity` (jsonb içinde; migration gerekmez) ve `source` alanına `'SCAN'` | Nadirliğin keşif hafızası (S53). Eski satırlarda alan yoktur; "bilinmiyor" sayılır. |
| `hp_radiation_sources` | `anchor_kind` alanına `'MOON'` (tip ve varsa CHECK) | Radyasyon gövdeye göre çalışır (S45). Çapa id'si gezegenin id'sidir. |
| `build_orders` | `kind = 'MOON'` (typed text) | CONSTRUCTION hattında Common ay kurulur. |

### 4.3 Enum eklemeleri (yalnız sona)

- `event_kind`: `moon_move_land`, `moon_gate_ready`.
- `notification_kind`: `moon_born`, `moon_cracked`, `moon_destroyed`, `moon_gate_ready`, `moon_lost_fleet` (S41).
- F1 için destekçiye "dalgan kayboldu" bildirimi gerekirse ayrı bir değer eklenir (O10: `loseWave` bildirim göndermiyor).
- Chronicle türleri: `MOON_BORN`, `MOON_DESTROYED`. "El değiştirdi" kaydı mevcut ele geçirme kaydına eklenir (V18).

### 4.4 Migration tuzakları

- **Numara ve `when`:**
  - Bugün sıradaki numara 0253'tür.
  - Üretmeden hemen önce `ls apps/server/drizzle` ve `_journal.json` kontrol edilir.
  - `when` değeri son kayıttan büyük olmalıdır; değilse drizzle migration'ı **sessizce atlar**.
  - Başka bir oturum araya migration eklerse birleştirmeden önce numara yeniden verilir.
- **Enum:** `ALTER TYPE ... ADD VALUE` kendi migration'ında yapılır. Yeni değer aynı transaction'da kullanılmaz.
- **`missions` indeksi:**
  - Drizzle migration'ları transaction içinde çalışır, bu yüzden `CREATE INDEX CONCURRENTLY` kullanılamaz.
  - Önce canlıda tablonun satır sayısı **salt okunur** ölçülür (owner onayıyla).
  - Tablo büyükse indeks bakım penceresinde kurulur.
- **F1:** Migration ancak yeni bir bildirim türü gerekirse eklenir (tek enum değeri). Sezon istatistiğine yeni alan gerekirse `CURRENT_SEASON_STATS_VERSION` kuralına uyulur (§6.19).

## 5. Kural paketi — `packages/rules/src/moon.ts` (F0)

Bütün fonksiyonlar saftır ve `moon.test.ts` içinde birim testlidir.

| Fonksiyon | Tanım | Kaynak |
|---|---|---|
| `MOON` sabitleri | `rulesetVersion` 20, `hopSeconds` 90, `gateOpenSeconds` 10, `scanCost {deuterium: 30}`, `strikeCloseHours` 3, `crackHealHours` 24 | §4 tasarım |
| `gateCapacity(r)` | 470 / 1.550 / 3.250 / 7.270 (bulk); rıhtım kapasitesiyle aynı | S12 |
| `gateChargeMs(r)` | 6 / 4 / 3 / 2 saat | S17/S51 |
| `scanRange(r)` | 1.500 / 2.250 / 3.000 / 4.000 | S20 |
| `scanPierces(r)` | Yalnız Legendary | S20 |
| `crackLimit(r)` | 3 / 5 / 7 / 9 | S19 |
| `effectiveCracks(m, nowMs)` | Son darbeden 24 saat geçtiyse 0. İstemci de aynı fonksiyonu kullanır. Kural paketi saat kuramadığı için (`new Date` lint yasağı) bütün zamanlar epoch milisaniyedir. | S19 |
| `strikeMoon(m, nowMs)` | Yeni çatlak sayısı, `closedUntilMs` ve `explodes` döndürür. İyileşmişse sayaç 1'den başlar. | S19 |
| `moonBirthChance(wreck)` | `min(0.20, wreck / 5000 × 0.01)`; `wreck < 10000` ise 0. `wreck`, toplayıcı **öncesi** enkazın alloy + crystal + deuterium toplamıdır. | S44 |
| `birthRarityWeights(c)` | %2'de 60/30/9/1, %20'de 30/35/25/10, arası doğrusal | §3.2 tasarım |
| `rollMoonBirth(seed, wreck)` | `null` ya da bir nadirlik (tohumlu) | — |
| `replaces(current, born)` | Yalnız doğan ay daha nadirse `true` | S11 |
| `jumpCapacity(originRarity, destFreeDock)` | `min(gateCapacity(origin), destFreeDock)` | §3.4 tasarım |
| `dockFree(r, standing, inbound)` | Kapasiteden aydaki ve aya gelmekte olan filoyu düşer | S12 |
| `jumpFuel(distance, fleet, tech)` | Mevcut `missionFuel`, HOMEWARD oranıyla | S49 |
| `fleetSizeClass(bulk)` | hafif / orta / ağır; eşikler 470 ve 3.250 (V14) | S33 |
| `seedMoonPlan(seed, neutralSlots)` | Yuva başına deterministik plan (§6.3) | S22 |
| `moonsEnabled(season, shard)` | §3 ilke 5 | — |
| `gozcuSees(mission, pierces)` | `pierces` ise her zaman `true`. Değilse yalnız `origin_body = PLANET` ve `target_body = PLANET` olan uçuşta `true` (V15). | S15/S50 |

## 6. Sunucu entegrasyonu — alan alan

### 6.1 Konum ve gövde temeli (F2a, davranış değişmez)

- **Ne:**
  - `services/unitLocation.ts` yazılır.
  - `homeHealth.ts` gövdeye göre genelleştirilir: `readBodyHealth`, `writeBodyHealth`, `takeBodyHealth(tx, planetId, body, fleet, now)`.
  - `assertNoArrivalPending(tx, planetId, body, now)` gövde parametresi alır. Sorgu `missions.target_body = body` ile süzülür; şimdilik her çağrı `PLANET` geçirir.
  - O5 listesindeki her yer modüle geçer.
- **Nasıl:**
  1. Mevcut testler koşulur, sonuç kaydedilir.
  2. Yerler tek tek değiştirilir.
  3. Testler yine aynı sonucu vermelidir.
- **Guard test:** Servislerde modül dışında ham `'home'` / `units.location` karşılaştırmasını yasaklar. İzin verilen eski yerler açık bir listede tutulur ve liste yalnız küçülebilir.
- **Gözden kaçabilecek:** `planetRadiation.ts` bugün `'home'` dışındaki satırları atlar, böylece aydaki gemiler gezegen radyasyonundan korunur. Bu doğrudur (S45) ve korunmalıdır. Aya gelen radyasyon ayrı bir yoldan işler (§6.15).

### 6.2 Ruleset kapısı ve sezon yeteneği (F2b)

- `moonsEnabled` her giriş noktasında çağrılır: route, servis, worker handler ve bot karar dalı.
- Sezon payload'ına `features.moons` eklenir. İstemcideki bütün ay arayüzü bu alana bağlıdır.
- **Test:** Ruleset 19 sezonunda her ay route'u `MOONS_DISABLED` döner ve galaksi payload'unda ay alanı hiç bulunmaz.

### 6.3 Tohumlama ve tohum defteri (F2c)

- `seedMoonPlan(seed, selectNeutralSlots(...))` nötr yuvaların **tam listesinden** hesaplanır. Böylece census'la kademeli açılan bir yuva da aynı ayı alır (O13).
- `createNeutralWorld` yeni bir `seedMoon` bayrağı alır:
  - Yalnız ilk açılış (`openNeutralWorlds`) bayrağı `true` geçirir.
  - Yuvanın planında ay varsa **ve** `moon_seed_ledger` içinde o yuva için kayıt yoksa ay yazılır ve deftere kayıt eklenir.
  - Hesap silme ve komutan transferi gibi yeniden kurma yolları bayrağı `false` geçirir; ay bu yollarda yalnız S56 ile taşınır (§6.17).
- **Neden defter:** Patlatılmış (S54) ya da taşınmış bir tohum ayı, yuvası yeniden açılınca geri doğmamalıdır.
- **Ölçek:** Owner'ın onayladığı değer "~20 ay; T1 8, T2 7, T3 4 Epic + 1–2 Legendary"dir.
  - Bu, nötrlerin ~%15'i payıyla ifade edilir; Legendary sayısı 1–2 ile sınırlanır.
  - Daha büyük galakside sayı orantılı büyür.
  - Test: EU-1 boyutunda ~20 ay çıkar ve dağılım onaylı orandadır.
- Başkent hiçbir zaman tohum aylı doğmaz (O13). Anıt (monument) dünyaları ve özel yuvalar tohum dışıdır.

### 6.4 Ay Çekimi ve Common kurma (F2c)

- **Araştırma:**
  - `RESEARCH_PROJECTS` kataloğuna `LUNAR_CAPTURE` eklenir (`requiredCore: 9`).
  - Maliyet ve süre Y5 kararıyla belirlenir.
  - Komutan geneli RESEARCH hattında yapılır.
- **Kurma:**
  - CONSTRUCTION hattında `kind: 'MOON'` siparişi verilir.
  - Ön koşullar: araştırma bitmiş, dünyada ay yok, kuyrukta başka ay siparişi yok.
  - Maliyet S30 kararıyla, süre ~12 saat.
  - `build_complete` olayında ay yazılır.
- **Yarış (V1):** Kurulum sürerken o dünyada savaşta ay doğarsa sipariş iptal edilir, maliyet tam iade edilir.
- Ayı patlayan dünyaya yeniden kurulabilir (§3.6 tasarım).
- Dünya kaybedilince kuyruğa ne olacağını mevcut kural belirler.

### 6.5 Rıhtım ve Hangar (F3a)

- **Rıhtımda yer:** `dockFree = gateCapacity(r) − bulk(aydaki gemiler) − bulk(aya gelen PENDING geçiş ve sıçramalar)`.
- **Girişte kontrol:** HOP_UP başlangıcı, JUMP başlangıcı, aya transfer kalkışı (S50).
- **İnişte tekrar kontrol:** Yer kalmamışsa transfer ve dönüş gezegene iner (S34). Gemi hiçbir zaman silinmez.
- **Hangar:**
  - Hangar hesabı kendiliğinden doğrudur (O2). Geçiş aynı dünyada kaldığı için Hangar yükünü değiştirmez.
  - Sıçramada hedef dünyanın Hangar'ı başlangıçta kontrol edilir. Bitişte yeniden kontrol edilmez (V21).

### 6.6 Gezegen ↔ ay geçişi (F3a)

- **API:** `POST /planets/:id/moon/hop {direction, fleet}`.
- **Kontroller:**
  - `moonsEnabled` açık, dünya oyuncunun ve ay var.
  - Yalnız oyuncunun kendi mobil gemileri geçer. Yer birimi ve Prospector geçemez (§3.3 tasarım).
  - Kalkış gövdesinde K12 yok. Öbür gövde serbesttir (S13).
  - HOP_UP'ta rıhtımda yer olmalı.
  - Tatildeyse transfer kuralı uygulanır.
  - Her yönde aynı anda en çok bir geçiş olabilir (V3).
- **Etki:**
  - `takeBodyHealth` gemileri ve hasar lotlarını ayırır, gemiler `hop:<id>` konumuna geçer.
  - `moon_moves` satırı yazılır, `moon_move_land` olayı +90 sn'ye kurulur.
  - `publishWatchChanges` çağrılır.
- **İniş:**
  - Hedef gövdede varışı gelmiş ama çözülmemiş bir saldırı varsa iniş 1 sn ertelenir; **önce savaş** çözülür (O15).
  - Ay o arada patladıysa gemiler gezegene iner.
  - Dünya düştüyse satır zaten başka bir duruma geçmiştir (§6.16) ve iniş hiçbir şey yapmaz.
- Geçiş geri çağrılmaz (V3).

### 6.7 Aydan kalkış, aya iniş, dönüş (F3c)

- `launchAttack` ve `launchTransfer` fonksiyonları `originBody` ve `targetBody` alır. Varsayılan `PLANET` olduğu için eski çağrılar değişmez.
- Aydan kalkış `takeBodyHealth(MOON)` ile yapılır. Yakıt gezegen deposundan ödenir (S49). Görev dünyanın uçuş yuvasını kullanır (O27).
- Aydan yalnız **saldırı ve transfer** kalkar (S34, V6). İskân, probe, klan yardımı, klan savaşı, Death Star ve radyasyon bombası gezegenden kalkar.
- **Dönüş (`settleReturn`):**
  - `origin_body` MOON ise, ay hâlâ varsa ve rıhtımda yer varsa gemiler aya iner; yoksa gezegene.
  - Ganimet ve kargo her durumda gezegenin deposuna yazılır.
  - Aya inen hasarlı gemi ayda kalır (V9).
- **Aya transfer (S50):**
  - Kalkışta rıhtımda yer olmalıdır; inişte yer yoksa gemiler gezegene iner.
  - 5 dakikalık transfer beklemesi dünyaya uygulanır (S52).

### 6.8 Hedef gövde ve hedef değiştirme (F3b)

- **API:** `POST /missions/:id/target-body {body}`.
- **Kontroller:**
  - Mission satırı `FOR UPDATE` ile kilitlenir.
  - Görev oyuncunun, `kind = attack`, `in_flight` ve geri çağrılmamış olmalıdır.
  - `now < arrive_at` olmalıdır, değilse `RETARGET_CLOSED`. Engagement varış anıdır; K12 de buna dayanır (O6).
  - Hedef dünyada ay olmalıdır. Ayın varlığı kamusal olduğu için (S53) `NO_MOON` hatası bilgi sızdırmaz.
  - İki değişiklik arasında en az 5 sn olmalıdır (V2).
- **Radar:**
  - Uyarıyı almış savunanın gelen saldırı satırındaki gövde hemen güncellenir.
  - Push bildirimi yalnız ilk uyarıda gider; değişiklik uygulama içi yayınla gösterilir.
  - Uyarıyı almamış (radarı yetmeyen) savunana hiçbir şey gitmez.
- Hedef değiştirme yalnız tekli saldırıda vardır (V7).

### 6.9 Ay savaşı (F3b)

- `onMissionArrival` içinde `target_body = MOON` ise `resolveMoonBattle` çağrılır. Gezegen yolu olduğu gibi kalır.
- **Savunan hat:**
  - Yalnız aydaki gemiler savaşır.
  - Yer silahı ve Aegis yoktur (S21), destek istasyonu yoktur (S29), ganimet yoktur.
  - **Taktik Geri Çekilme (kaçış duruşu) uygulanmaz; ay son duraktır (S55).** Dünyanın duruşu yalnız gezegen savaşında geçerlidir.
- **Boş ay (S31):** Savaşabilecek gemi yoksa savaş olmaz.
  - Rapor "ay boştu" der.
  - Sadakat ve skor değişmez; saldırı sınırına sayılır.
  - Yalnız savaşmayan gövde varsa onlar gezegendeki gibi zarar görmez (O28, V11).
- **Ay yoksa** (varıştan önce patladıysa): Patlama uçuşu zaten geri döndürmüş olmalıdır. Korunma olarak `returnAttackUntouched` çağrılır.
- **Sonuç:** Ortak `applyBattleAftermath` ile yapılır:
  - Dominion ve Honor gezegendeki gibi.
  - Kolonide sadakat kesin zaferde −30, kısmide −15 (S28).
  - Toparlanma ve katılım kalkanları gezegendeki gibi.
- **Enkaz:** `settleBattleWreck` ile `body: MOON` olarak yazılır; doğum zarı da burada atılır (§6.13).
- **Rapor:** `context.environment: 'MOON'` (O7).
- **Saldırı sınırları:** Görev `target_planet_id` taşıdığı için bash limit, 12 saat kuralı ve ±1 tier bandı dünya başına kendiliğinden işler. Ek kod gerekmez, test yazılır.

### 6.10 Probe, teleskop, radar ve nadirliğin görünürlüğü (F3a–F3b)

F3'e başlamadan önce `docs/review-sight.md` §6–7 okunur (doküman haritası kuralı).

- **Probe (S23):**
  - `resolveProbe` rapora `moon` bölümünü ekler: nadirlik, filo bandı (mevcut doğrulukla), kapı ve Gözcü durumu ya da kalan süre, çatlaklar.
  - Geçişteki filo "geçişte" bayrağı ve bantla gösterilir (V10).
  - Probe nötr dünyaların ayını da okur.
- **Teleskop (S40):**
  - `last_moon_status` alanı `HOME` / `EMPTY` / `HOP` / `NONE` değerlerinden birini alır.
  - Her geçiş, sıçrama, iniş ve savaş `publishWatchChanges` çağırır.
  - Örtü (Veil) netlik kuralı aynen geçerlidir.
- **Radar (S24):**
  - Gelen saldırı satırı ve uyarı `targetBody` alanını taşır.
  - Bu alan `incoming` satırının `targetPlanetId` alanıyla aynı kurala uyar ve her zaman verilir.
- **Nadirliğin görünürlüğü (S53):**
  - **Canlı:** Gözlemcinin sensörü dünyayı o an tanıyorsa (`sensorZone` IDENTIFIED) güncel nadirlik gösterilir.
  - **Hafıza:** Probe, savaş ve Gözcü keşfi (yeni kaynak `SCAN`) `probe_world_memories.silhouette.moonRarity` alanına o anki nadirliği yazar (O29).
  - Hafıza donmuştur: Ay sonra daha nadiriyle değiştiyse gözlemci, yeniden bakana kadar eskisini görür. Bu, mevcut D127 hafıza kuralıyla aynıdır.
  - Ay patladıysa kamusal listede olmadığı için hafızadaki nadirlik çizilmez.

### 6.11 Ay Kapısı (F4)

- **API:** `POST /planets/:id/moon/jump {toPlanetId, fleet}`.
- **Kontroller** (`lockWorlds([a, b])` altında):
  - İki dünya da oyuncunun ve ikisinde de ay var.
  - İki kapıda da `closed_until <= now` ve `gate_ready_at <= now`.
  - Kalkış ayında K12 yok.
  - Filo, ayrılmamış ay filosundan büyük olamaz.
  - Kapasite `jumpCapacity` ile hesaplanır; hedef dünyanın Hangar'ında yer olmalı.
  - Yakıt `assertFuel` ile kalkış gezegeninden kontrol edilir.
  - Tatil ve savaş kilidinde transfer kuralları geçerlidir.
- **Etki (aynı transaction):**
  - Yakıt ödenir ve JUMP satırı yazılır.
  - İki ayın `gate_ready_at` değeri kendi nadirliğine göre ayarlanır.
  - İki `moon_gate_ready` olayı ve bir `moon_move_land` olayı (+10 sn) kurulur.
  - Kalkış parıltısı sensör kapsamlı yayınla duyurulur (§6.22).
- **Bitiş (+10 sn):**
  - İki dünya kilitlenir.
  - Kalkış ayında hâlâ duran `min(ayrılan, mevcut)` taşınır; hasar lotlarını aynı seçim fonksiyonu seçer.
  - Hedef ay patladıysa, el değiştirdiyse ya da dünya düştüyse sıçrama iptal edilir, gemiler kalkış ayında kalır (V8).
  - Varış parıltısı herkese yayınlanır (S32).
  - 5 dk transfer beklemesi uygulanmaz (S46).
  - Hedef aya varışı gelmiş bir saldırı varsa bitiş, iniş gibi 1 sn ertelenir (E2).
- **"Kapı hazır" olayı:** Ay silindiyse ya da `gate_ready_at` değiştiyse hiçbir şey yapmaz; değilse ayın o anki sahibine bildirim gider.

### 6.12 Gözcü (F5)

- **API:** `POST /planets/:id/moon/scan {targetPlanetId}` ve `GET /intel/moon-scans`.
- **Kontroller:**
  - Ay var ve kapalı değil.
  - Hedef menzilde: `scanRange(r)`; mesafe kamusal konumlardan hesaplanır.
  - Tarama başına 30 D gezegen deposundan ödenir.
  - Aynı aydan iki tarama arasında en az 3 sn olmalıdır (teknik koruma).
- **Sorgu:**
  - Hedef dünyaya giden ya da oradan kalkan `in_flight` görevler, §4.2'deki kısmi indekslerle okunur.
  - Görünen türler (S33): `attack`, `transfer`, `clan_transfer`, `clan_war`, `clan_support`, `settlement`, `return`.
  - Görünmeyenler: probe, madencilik, Death Star ve radyasyon bombası.
  - Gövde süzgeci `gozcuSees` ile uygulanır.
- **Satır içeriği:** yön (gelen / giden), öbür dünyanın id'si, varış saati ve `fleetSizeClass`. **Görev türü yoktur** (S14/S33); niyeti oyuncu tahmin eder.
- **Keşif:** Rotada görünen ve tarayanın bilmediği her dünya `rememberWorld(source: 'SCAN')` ile keşfedilmiş sayılır. Ayının nadirliği de hafızaya yazılır (§6.10).
- **Sessizlik:** Hedefe bildirim, radar kaydı ya da hedefin görebileceği bir analitik iz gitmez.

### 6.13 Savaşta doğum ve yerine geçme (F6)

- **Yer:** Doğum zarı `settleBattleWreck` içinde atılır. Bu fonksiyonu gezegen savaşı, ay savaşı ve klan birleşik saldırısı çağırır (V16).
- **Hangi savaşlar:**
  - Yalnız sahibi Ay Çekimi'ni bitirmiş, nötr olmayan dünyalarda (S9).
  - Korsan, konvoy ve boşluk savaşlarının dünya çapası yoktur; doğum olmaz.
  - Death Star patlama enkazı ay doğurmaz (S35).
- **Girdi:** Toplayıcılar ve klan zafer kasası payını almadan önceki toplam enkaz (S44; `handlers.ts:1280` `made`).
- **Sonuç:** `rollMoonBirth(hashSeed('moon-birth', missionId), wreck)`.
  - Dünyada ay yoksa yeni satır yazılır.
  - Doğan ay daha nadirse mevcut ayın yerine geçer: nadirlik ve köken güncellenir; çatlak, şarj ve kapanma sıfırlanır; gemiler yerinde kalır.
  - Daha nadir değilse hiçbir şey olmaz.
  - Bildirim ve Chronicle kaydı yazılır. Chronicle'da nadirlik **yazılmaz** (S53, V18).
- Aynı savaşta sadakat sıfırlanırsa ay doğar ve dünyayla birlikte nötre geçer. Bu bilinçli bir sonuçtur ve testi yazılır.

### 6.14 Death Star, çatlak, patlama (F7)

- **Fırlatma:** `launchDeathStar` `targetBody` alır.
  - MOON hedefinde dünyada ay olmalıdır.
  - **Nötr dünyanın tohum ayı da hedef olabilir (S54).** Nötr hedefte ±1 tier bandı yoktur (O9); Death Star zaten Çekirdek 13 ister.
  - Sahipli hedefte ±1 tier bandı aynen uygulanır.
- **Önleme (S48):** Görev aynı `target_planet_id` alanını taşıdığı için gezegenin önleme sistemi ayı kendiliğinden korur. Nötr dünyanın önleme sistemi yoktur.
- **İsabet:** `applyDeathStarStrike` içindeki MOON dalı `strikeMoon` çağırır.
  - EMP, sadakat kaybı ve ele geçirme yoktur (S36).
  - Gezegene vuran Death Star aya dokunmaz (S39).
- **Uçuşta el değiştirme:** Hedef dünya uçuş sırasında el değiştirirse (ör. nötr dünya claim edildi) isabet anındaki sahibe göre mevcut Death Star kuralı uygulanır: kendi dünyası olduysa etkisiz, başkasınınsa normal. Bant yeniden ölçülmez (E15).
- **Patlama (`explodeMoon`, tek transaction):**
  1. Aydaki bütün gemiler, savaşmayanlar dahil, yok olur.
  2. Bu gemilerin Dominion ve Honor değeri son darbeyi vurana savaştaki gibi yazılır (S35). Nötr ayda gemi yoktur, skor yazılmaz.
  3. Gemi öldüyse herkese açık enkaz kalır (`body: MOON`); bu enkazdan ay doğmaz.
  4. O aya giden bütün görevler, düşmanınki dahil, `turnMissionHome` ile o anda geri döner.
  5. Aya giden HOP_UP gezegene iner.
  6. Bu aya gelen JUMP iptal edilir; bu aydan kalkan JUMP'ın gemileri ayda oldukları için ölür.
  7. Bekleyen kapı olayları kendi kontrolleriyle hiçbir şey yapmaz.
  8. Chronicle `MOON_DESTROYED` kaydı (nadirlikle, V18) ve bildirimler yazılır.
  9. Ay satırı silinir.
  10. Kamusal patlama anı yayınlanır.
- **Honor ayrıntısı:**
  - Honor'un adil dövüş tabloları bir saldırı filosu varsayar.
  - Patlama kredisi, mevcut Death Star Honor yolu (`honorStrategic.ts`) "öldürülen değer" ile genişletilerek verilir.
  - Formül F7 testlerinde sabitlenir; S35'teki "savaştaki gibi" ifadesi esastır.

### 6.15 Radyasyon gövdeye göre (F7)

- Radyasyon bombası `targetBody` alır. MOON hedefinde kaynak `anchor_kind 'MOON'` ile yazılır.
- Ay radyasyonu yalnız `'moon'` satırlarına işler; gezegen radyasyonu yalnız `'home'` ve tamirhane satırlarına (S45).
- Bombanın önlenmesi Death Star'daki gibi gezegen tarafından yapılır (V12).

### 6.16 Dünya kaybı yolları (F1 + F3)

Tek yardımcı fonksiyon yazılır: `settleWorldLossMoves(tx, planetId, cause, now)`. Düşüş, terk ve devir yolları bunu çağırır.

| Durum | Gezegen ve tamirhanedeki gemiler | Aydaki gemiler | Geçişteki gemiler | Bekleyen sıçrama | Sahibinin o dünyaya uçuşları | Destek dalgaları |
|---|---|---|---|---|---|---|
| Sadakat düşüşü (S19c) | Yok olur | Yok olur | Güvenli eve dönüş görevine çevrilir (S19d) | Gelen iptal; giden ölür | Bugünkü gibi inişte güvenli eve (V22) | Duranlar yok olur (S42); yoldakiler eve döner (V5) |
| Gönüllü terk | Başkente taşınır (bugünkü gibi) | Başkente taşınır | Başkente taşınır | İptal; gemiler başkente | Bugünkü gibi | Bugünkü gibi eve döner |
| Devir (`transferPlanetControl`) | Mevcut kural | Mevcut kuralla aynı | Önceki sahibin güvenli evine | İptal | — | Mevcut kural |

- Yer birimleri düşüşte bugünkü gibi nötr garnizona geçer.
- Komutan gemisi (admiral) yok edilmez, başkente döner. F1'de bunun testi yazılır.

### 6.17 Silme, taşıma ve sezon sonu (F2c, F3a)

**Kural (S56):**
- Koloni yuvası nötr olarak yeniden kurulursa ay o yuvada kalır.
- Başkentin ayı başkentle gider; başkent silinirse ay da silinir.
- Taşınan ay şu alanları korur: nadirlik, köken, çatlak, son darbe, kapanma. Kapı şarjı sıfırlanır (V19).

| Yol | Ne yapılır |
|---|---|
| Hesap silme (`accountDeletion.ts:338–349`) | `demolish`'tan **önce** koloni aylarının satırları okunur. `createNeutralWorld` aynı yuvaya yeni satırı kurduktan sonra ay o satıra yazılır. Aydaki gemiler hesabın gemileriyle birlikte silinir. Başkentin ayı CASCADE ile gider. |
| Komutan transferi (`commanderTransfer.ts:276–300`) | Önce aydaki bütün gemiler kendi gezegenine iner (V20). Koloni ayı eski yuvadaki yeni nötr dünyaya geçer (`moons.planet_id` güncellenir). Başkentin ayı gezegen satırıyla birlikte taşınır; `WAITING` galakside kapı kapalı olduğu için orada pasif durur, `MAIN`'e dönünce yeniden çalışır. Bekleyen geçiş ya da sıçrama varken transfer ertelenir. Ertelemenin durumu `FLIGHT`'tır. |
| Boşta koltuk geri alma (`reclaim.ts`) | Bugünkü kod koloniyi nötr olarak yeniden kurmuyor (O12). Ay, gezegenle birlikte CASCADE ile silinir; tohum defteri yuvanın sonradan yeniden açılmasında tohumun geri dönmesini engeller. F2c'de doğrulanır; yol ileride nötr kurarsa aynı taşıma kuralı uygulanır. |
| Galaksi silme (`servers.ts:733`) | `moon_moves`, `moon_scans` ve `moon_seed_ledger` gezegenlerden önce silinir; `moons` CASCADE ile gider. |
| Sezon dondurma (`freezeSeason`) | Bekleyen geçişler hedefine indirilir, sıçramalar iptal edilir; dondurulmuş sezonda olay işlenmez. |

Chronicle kayıtları sezon arşivinde kalır. Ek bir "ay rekoru" kapsam dışıdır.

### 6.18 Bildirim, Chronicle, push (S41)

- **Kişisel bildirimler:** ayın doğdu, çatladı, patladı, kapı hazır. Saldırı uyarısı gövdeyi söyler.
- **Push:** Push kategorileri `notificationCenter` kurallarına eklenir; oyuncunun ayarları geçerlidir.
- **Uyarı:** `/api/notifications` payload'u ham yayınlanır (O22). Ay bildirimleri yalnız alıcının zaten bildiğini taşır. Örneğin "ayın çatladı" bildirimi, alıcının radar ya da teleskopla görmediği bir saldırganın kimliğini taşımaz.
- **Chronicle (V18):**
  - **Doğdu:** Nadirlik yazılmaz (S53).
  - **Patladı:** Nadirlik yazılır, çünkü kamusal çatlak sayısı eşiği zaten gösterir.
  - **El değiştirdi:** Mevcut ele geçirme kaydına "aylı" bayrağı eklenir, nadirlik yazılmaz.
  - Dünya kimliği mevcut `publicPlanetIdentity` kuralıyla verilir.

### 6.19 Skor: Dominion, Honor, sezon istatistiği

- Ay savaşı gezegen savaşının ledger yolunu kullanır. Patlama kredisi §6.14'te anlatılmıştır.
- **Düşüşte yok olan gemiler (S43):**
  - Dominion ve Honor'a yazılmaz.
  - Sezon istatistiğinde "kolonide kaybedildi" olarak görünür.
  - Alan yeni bir istatistik sürümü gerektiriyorsa `statsVersion` kuralı uygulanır (F1'de kontrol edilir).

### 6.20 Diğer kurallar

- **Tatil:** Geçiş, sıçrama ve tarama transfer kurallarına uyar.
- **Arıza:** Görevleri her iki gövdeden bağlar; geçiş ve sıçramayı bağlamaz (V13).
- **Uçuş yuvası:** Aydan kalkan görev dünyanın yuvasını kullanır; geçiş ve sıçrama kullanmaz.
- **Komutan gemisi:** Aydan kalkan saldırıya eşlik eder, kapıdan geçmez (V4).
- **Aktivite:** Her ay eylemi oyuncu emri sayılır ve mevcut aktivite kaydını günceller (Silent Space ve hareketsizlik sayaçları). Botlar da aynı yoldan geçer.

### 6.21 API, Zod, idempotency, hata kodları

- **Zod:** Bütün yeni gövdeler Zod ile parse edilir:
  - `body: z.enum(['PLANET','MOON'])`
  - `direction: z.enum(['UP','DOWN'])`
  - Filo sayıları negatif olmayan tam sayıdır.
  - `any` ve derleyiciyi susturan cast kullanılmaz.
- **Idempotency:** Geçiş, sıçrama, tarama, hedef değiştirme ve kurma mevcut `Idempotency-Key` yolundan geçer.
- **Hata kodları:** `MOONS_DISABLED`, `NO_MOON`, `MOON_EXISTS`, `MOON_RESEARCH_REQUIRED`, `MOON_DOCK_FULL`, `GATE_CHARGING`, `GATE_CLOSED`, `GATE_OPENING`, `GATE_SAME_MOON`, `HOP_PENDING`, `SCAN_OUT_OF_RANGE`, `SCAN_CLOSED`, `SCAN_TOO_FAST`, `RETARGET_CLOSED`, `RETARGET_TOO_FAST`.
- Her hata `apps/web/src/i18n/errors.ts` içinde 6 dilde karşılık bulur.

### 6.22 Yayın ve kamusal anlar

- **Varış parıltısı (herkese):**
  - Dünyanın kamusal durumuna `moonFlashAt` eklenir. Bu, mevcut kamusal vuruş anlarıyla aynı yoldur (`routes/galaxy.ts` publicMoments ve `apps/web/src/galaxy/publicMoments.ts`).
  - Sahip kimliği taşınmaz.
- **Kalkış parıltısı (yalnız sensör):**
  - Gözlemci başına `sensorZone` ile süzülür ve trafik projeksiyonunda (`traffic.ts`) kısa ömürlü bir "kapı teması" olarak döner.
  - Radarın teması (CONTACT) parıltıyı, teleskobun tanıması (IDENTIFIED) filo silüetini verir (S16).
  - Bu süzgeç istemcide **yapılmaz**.
- **Shard yayın sebepleri:**
  - `moon`: doğum, patlama, parıltı ve çatlak.
  - `retarget`: yalnız ilgili savunana.

### 6.23 Admin, stage, analitik

- **Admin aracı:** Stage ve test sezonlarında bir dünyaya istenen nadirlikte ay koyar; canlıda kapalıdır.
- **Analitik (F10 ölçümü):** Geçiş, sıçrama, tarama, hedef değiştirme, kurma, doğum, Death Star darbesi ve patlama kaydedilir.
- **Komut kaynağı:** Mevcut `commandSource` ve `analyticsVisitHash` deseni kullanılır.

## 7. Eşzamanlılık ve yarışlar

| # | Senaryo | Kural | Test |
|---|---|---|---|
| E1 | Hedef değiştirme ile varış aynı anda | Mission satırı kilitlenir; `now >= arrive_at` ise reddedilir; worker gövdeyi kilitli satırdan okur | Varıştan 1 ms önce kabul, tam varışta red |
| E2 | Geçiş inişi ya da sıçrama bitişi ile savaş aynı saniyede (O15) | Önce savaş. İniş ya da bitiş, varışı gelmiş saldırı varken kendini 1 sn erteler | Olay sırası iki yönlü kurulur; sonuç aynı |
| E3 | Savaş kilidi sürerken geçiş | Yalnız saldırının indiği gövde kilitlidir (S13) | Gezegen kilitliyken aydan geçiş serbest; tersi de |
| E4 | 10 sn'lik açılışta kalkış ayına saldırı | Gemiler savaşır; kalanlar sıçrar | 100 ayrılmış gemiden 60'ı ölür, 40'ı varır |
| E5 | Aynı kapıdan eşzamanlı iki sıçrama | `lockWorlds` altında şarj kontrolü; ikincisi `GATE_CHARGING` alır | İki paralel transaction |
| E6 | Açılışta hedef ay patlar ya da dünya düşer | İptal; gemiler kalkışta kalır; yakıt iade edilmez (V8) | — |
| E7 | Patlarken yoldaki uçuşlar | §6.14 adım 4–6 tek transaction'da | Düşman saldırısı da döner |
| E8 | Düşüş anında bekleyen geçiş ve sıçrama | §6.16 tablosu | — |
| E9 | Kurulum sürerken savaşta doğum | Sipariş iptal, tam iade (V1) | — |
| E10 | Bayat "kapı hazır" olayı | `gate_ready_at` eşleşmezse hiçbir şey yapılmaz | Şarj sürerken ayın yerine yenisi geçer |
| E11 | Aynı idempotency anahtarıyla tekrar | Aynı cevap döner, ikinci etki olmaz | — |
| E12 | Sezon dondurulurken bekleyen hareket | §6.17 | — |
| E13 | Ruleset 19 sezonunda ay verisi | Hiçbir yol ay okumaz ya da yazmaz | Kapı testi (§6.2) |
| E14 | Patlatılmış ya da taşınmış tohum ayının yuvası yeniden açılır | Tohum defteri yeniden tohumlamayı engeller | Patlat, yuvayı yeniden aç: ay yok |
| E15 | Death Star nötr aya uçarken dünya claim edilir | İsabet anındaki sahibe göre mevcut kural uygulanır; bant yeniden ölçülmez | Claim eden saldırgansa etkisiz; başkasıysa çatlar |
| E16 | Bekleyen hareket varken komutan transferi | Transfer `FLIGHT` durumuyla ertelenir | — |

## 8. Bilgi sızıntısı denetimi (her satır bir test)

| Kanal ya da alan | Kim görür | Nasıl sağlanır |
|---|---|---|
| Ayın varlığı, çatlakları, son darbe zamanı | Herkes (S53) | Kamusal ay listesi: `[worldIndex, cracks, lastHitAt, visualSeed]`; nadirlik yok |
| Ayın nadirliği | Dünyayı o an tanıyan ya da hafızasında tutan gözlemci (§6.10) | Gözlemci başına sorgu; kamusal listede yok |
| Ayın kökeni (SEED / BUILT / BATTLE) | Yalnız sahibi | Kamusal payload'da yok |
| Kapı şarjı ve kapanma | Sahibi ve probe | Probe raporu |
| Aydaki filo | Sahibi, probe (bant), teleskop durumu | Mevcut bant ve netlik kuralları |
| Geçişteki filo | Sahibi, teleskop "geçişte", probe bayrağı | Trafiğe girmez |
| Varış parıltısı | Herkes (S32) | Sahip kimliği yok |
| Kalkış parıltısı | Yalnız sensörü yeten | Sunucuda `sensorZone` |
| Gözcü sonucu | Yalnız tarayan | Hedefe hiçbir kanaldan iz gitmez |
| Saldırının hedef gövdesi | Uyarıyı alan savunan | `incoming` satırı kuralı (O22) |
| Hata kodları | Herkes | Ayın varlığı kamusal olduğu için `NO_MOON` bilgi vermez; nadirlik hiçbir hata metninde yer almaz |
| Bildirim payload'ları | Alıcı | Ham yayın: alıcının bilmediği alan yazılmaz |
| Chronicle | Herkes | V18: doğumda nadirlik yok, patlamada var |
| Bot | Hiç kimse | Ay payload'unda bot bayrağı yok; botun karar girdisi insanınkiyle aynı (§10) |

**Owner'ın kabul ettiği sonuçlar (S53, S54):**
- Kurulan ayın varlığı, keşfedilmemiş dünyanın sahibinin Çekirdek 9+ olduğunu ima eder.
- Kamusal çatlak sayısı nadirliğin alt sınırını ele verir. Örneğin 6 çatlak almış ve ayakta duran bir ay en az Epic'tir.
- Tohum ayı patlatılınca sezonun ödüllerinden biri geri gelmemek üzere kaybolur.

## 9. İstemci

### 9.1 Veri akışı

- **Sezon payload'u:** `features.moons`.
- **Galaksi payload'u:**
  - Kamusal ay listesi `[worldIndex, cracks, lastHitAtSec|null, visualSeed]`. Shard sürümüne göre tek bir önbellek kopyası tutulur.
  - Gözlemciye özel `rarityByWorld` haritası, canlı görüş ile hafızanın birleşiminden gelir.
- **Çatlak iyileşmesi:** İstemci `effectiveCracks` ile kendisi hesaplar. Böylece iyileşme anında önbelleği geçersiz kılmak gerekmez.
- **Kendi dünya görünümü:** Gezegen ve ay filosu, rıhtım (kullanılan / kapasite), kapı ve Gözcü durumu, çatlaklar, bekleyen geçiş ve sıçramalar.
- **Yörünge:** `visual_seed` ve sezon saatinden deterministik hesaplanır. Bütün oyuncular ayı aynı yerde görür; sunucu konum göndermez.

### 9.2 Render, LOD ve performans

- `apps/web/src/galaxy/Moons.tsx` gezegen LOD kademelerini (`planetLod.ts`) izler:
  - **far:** Tek instanced çizim; küçük nokta ya da billboard.
  - **lite:** Tek instanced düşük poligonlu küre. Örnek başına nadirlik rengi (biliniyorsa) ve çatlak değeri taşınır. Yörünge vertex shader'da `uTime` ile hesaplanır.
  - **full:** En çok 4 dokulu ay: odaktaki dünya ve kameraya en yakın kendi dünyaları.
- **Çatlaklar:** Tohum ve çatlak sayısıyla çalışan prosedürel bir maskeyle çizilir; ek doku gerekmez.
- **Nadirlik halkası:**
  - Nadirlik rengi ince bir **çizgi halka** olarak çizilir. Yumuşak parlama ve büyüyen hale yasaktır.
  - **Bilinmeyen nadirlik halkasız çizilir (V17).** Common'ın gri halkasıyla karışmamalıdır. Dokununca "Nadirlik bilinmiyor · probe at" yazar.
- **Dokular:** NASA SVS CGI Moon Kit (public domain, https://svs.gsfc.nasa.gov/4720) ve USGS haritaları (Europa, Ganymede, Io, Callisto). 4 görünüm × (1k albedo + normal); mevcut `planetTextureQueue` ile yüklenir.
- **Bütçe:**
  - Temel +2 draw call, odakta en çok +4.
  - Doku belleği ~6 MB'ı geçmez.
  - Kare başına bellek ayırma yapılmaz.
  - S22'de 50–60 fps korunur (§11).

### 9.3 VFX listesi

Her efekt yazılmadan önce 3 satırlık brief yazılır ve teslimde gösterilir: dünyada ne oluyor, kütüphaneden hangi asset, neden bu olayı anlatıyor.

| Efekt | Fiziksel olay | Kütüphane ve mevcut kod |
|---|---|---|
| Ay doğuşu | Enkaz bulutu dönerek toplanır ve sıkışır | `Wrecks.tsx` parçacıkları |
| Kapı açılışı ve varışı | Halka parçaları yanar, gemiler çizgi hâlinde çıkar | `library/vfx/portal/00gamedevs-vfx/astral-gate.js` (MIT); Synty `polygon-scifi-space` warpgate halkaları; `space-combat-kit` warp.wav |
| Geçiş (90 sn) | Mekik izi gezegenden aya yay çizer | `HomewardShip`, `JumpStreaks` desenleri |
| Gözcü süpürmesi | Tarama dalgası; rotalar geçici çizgiler | `ScanReveals.tsx` deseni |
| Death Star çatlağı | Darbe noktasından yayılan kalıcı çatlak | `DeathStarImpact.tsx` + çatlak maskesinin büyümesi |
| Ay patlaması | Parçalar yörüngeye saçılır; galaksi geneli bir an | `StrategicBlast`, `NukeBlast` parçaları |
| Ay kurma | Yörüngeden bir kaya çekilir | Synty asteroid modeli ve çekme hattı |

**Kaynak notu:** Sektörde ay için standart yol, doku giydirilmiş bir küredir; satın alınacak model gerekmez. NASA ve USGS dokuları ücretsiz ve public domain'dir. Kapı halkası için kütüphanedeki Synty modelleri zaten satın alınmış durumda. Bu yüzden ek maliyet yoktur.

### 9.4 Ekranlar ve etkileşim (game feel)

- **`PlanetScreen` → Ay kartı:**
  - Nadirlik rengi, rıhtım çubuğu, kapı durumu (hazır / şarj süresi), Gözcü durumu (hazır / kapalı), çatlaklar (n/sınır, iyileşmeye kalan süre).
  - Önemli eylemler başparmak bölgesindedir.
- **Geçiş:** Filo çipi gezegenden aya ya da aydan gezegene **sürüklenir**; 90 saniyelik yay görünür.
- **Kapı:** Hedef ay seçilir, **kol 0,6 sn basılı tutulur** (owner standardı); halka yanar, ses ve titreşim gelir.
- **Gözcü:** Haritada hedef dünyaya dokunulur, süpürme başlar, rapor kartı açılır.
- **`LaunchSheet`:**
  - Kalkış gövdesi seçimi; yalnız ayda filo varsa görünür.
  - Hedef gövde anahtarı: Gezegen | Ay. Sonucu tek satırla söyler: "Ay: yalnız aydaki filo savaşır, kaçış yok, ganimet yok."
  - Nadirlik bilinmiyorsa "Nadirlik bilinmiyor · probe at" yazar (S53).
- **Death Star ekranı:** Hedef ayın kamusal çatlakları görünür. Eşik yalnız nadirlik biliniyorsa yazılır.
- **Uçuş ayrıntısı:** Varışa kadar hedef değiştirme şalteri ve geri sayım.
- **`TransferSheet`:** İniş gövdesi seçimi.
- **`IntelScreen`:** Gözcü raporları, probe raporunun ay bölümü, teleskobun iki satırı.
- **Radar ve HUD'daki gelen saldırı satırı:** "Gelen filo · AYINA · 9 dk".
- **`BattleReports`:** Ay savaşı ve "ay boştu" raporu.
- **`ResearchPanel`:** Ay Çekimi kartı; kilitliyse nedeni gösterilir (Çekirdek 9).
- **CONSTRUCTION:** Common ay siparişi.
- **`NotificationCenterSheet` ve `ChronicleScreen`:** Yeni türler.
- **F1'e ait ekranlar:**
  - `ClanSupportSheet` ev sahibi koloninin sadakatini gösterir (S42).
  - Gemisi olan koloninin sadakat göstergesinde uyarı çıkar: "Sadakat biterse buradaki gemiler kaybolur." Kural, karar verilmeden önce öğretilir.
- **Wiki:** Yedek kaynaktır. Oyuncular Wiki'yi açmaz; kural kullanıldığı yerde anlatılır.

### 9.5 Ses, titreşim, metin

- Ses `lib/sound`, titreşim `haptic` ile verilir. Durum ses kapalıyken de görsel olarak okunur.
- Metinler 6 dilde (de, en, es, fr, ja, tr) ve `docs/ux-writing.md` kurallarıyla yazılır.
- Hiçbir metinde bot ifadesi yoktur.

### 9.6 Görsel doğrulama

- Her ekran 350 px'te ölçülür. Görsel kontrol `node tools/visual.mjs` ile yapılır.
- Art arda ~5 Playwright koşusu kaydı 30 dakika kilitler; hazır hesaplar kullanılır.
- Faz sonunda yerelde ya da stage'de, oyunun normal akışından oyuncu gibi denenir.

## 10. Botlar (F8) ve sim

### 10.1 Botlar

Kilitli karar: Botun ayı hiç kullanmaması onu ele vermemelidir.

- **Davranışlar** (persona ağırlıklı, insan benzeri gecikme dağılımıyla):
  - Çekirdek 9 olunca bazen Ay Çekimi araştırır, önce başkente Common ay kurar.
  - Radar uyarısında güçsüzse bazen aya kaçar; gecikme ve kaçırma oranı insana benzer.
  - Bazen kapıyla takviye yapar.
  - Saldırıdan önce bazen Gözcü taraması yapar.
  - Nadiren hedef değiştirir.
  - Saldırgan persona ya da klan ise nadiren Death Star ile ay çatlatır; bunun içinde nötr tohum ayını yok etme hamlesi de vardır (S54).
- **Bilgi eşitliği:**
  - Bot kararı veritabanının gerçeğini değil, insanın görebildiğini okur: probe ve teleskop hafızası, kendi Gözcü raporları.
  - Bot nadirliği yalnız keşifle öğrenir (S53).
  - Ay pelerinini delen ya da gizli nadirliği bilen bir bot "imkânsız bilgi" ile ayırt edilir hâle gelir. Bunun testi yazılır.
- **Kalibrasyon:** İlk hafta insan oranları ölçülür (§6.23) ve bot oranları buna yaklaştırılır.
- **Yol:** Botlar aynı servis fonksiyonlarını çağırır; mevcut `services/bots` (`brain.ts`, `judgement.ts`, `personas.ts`) genişletilir.

### 10.2 Sim (`packages/sim`)

- Kurallar aynı paketten geldiği için sim derlenir.
- `invariants.ts` içindeki konum varsayımları `'moon'` değerine göre güncellenir.
- Arketiplere ay davranışı eklemek isteğe bağlıdır.
- **Uzun sim ve kartopu denetimi yalnız owner açıkça isterse koşar** (CLAUDE.md §5).

## 11. Performans bütçesi ve ölçüm

| Alan | Bütçe | Nasıl ölçülür |
|---|---|---|
| Gözcü sorgusu | Yoldaki görev sayısıyla orantılı, < 5 ms | Kısmi indeks; `EXPLAIN ANALYZE` (yerel, üretilmiş veri) |
| K12 ve teleskop sorguları | Bugünkünden yavaş değil | Mevcut yük testi (`--scenario real`), adım adım |
| Galaksi payload'u | En kötü durumda (4.000 ay) ~150 KB ham, ~40 KB gzip; gerçekte çok daha az | Birim testi. Kamusal kısım tek önbellekte, nadirlik haritası gözlemci başına |
| Olay sayısı | Geçiş ve sıçrama başına 1, şarj başına 1 | Her yönde tek bekleyen geçiş (V3); iyileşme için olay yok |
| İstemci draw call | +2 temel, odakta +≤4 | `renderer.info` |
| İstemci fps | S22'de 50–60 | adb ile S22 profili (hafıza notu "phone profiling") |
| Bellek | Doku ≤ ~6 MB; kare başına ayırma 0 | Chrome performans kaydı |

## 12. Test planı (TDD: önce kırmızı, sonra yeşil)

- Her faz kendi testleriyle kapanır; testler fazın ölçütlerinden türetilir.
- Kısa testler 1 worker ile koşar.
- Orta ve uzun gruplar 4 worker, worker başına 1 GiB ve her worker'ın kendi `_test` veritabanıyla koşar.
- Tam süit yalnız teslimde koşar: F1 teslimi ve R2 teslimi.

| Faz | Test dosyası | Durumlar |
|---|---|---|
| F0 | `packages/rules/src/moon.test.ts` | Bütün tablolar. Şansın 10k, 50k ve 100k uçları. Ağırlıkların %2, %11, %20'de doğrusallığı. Tohumlu zarın deterministikliği. İyileşmenin 24 saatin bir öncesinde ve tam anında doğru çalışması. Patlama eşikleri. `jumpCapacity`. `gozcuSees` matrisi. `fleetSizeClass` sınırları. `seedMoonPlan`'ın EU-1 boyutunda ~20 ay vermesi ve kademeli açılışta değişmemesi |
| F1 | Mevcut düşüş testleri (`grep -rln secedeColony --include=*.test.ts`) ve yenileri | §13 F1 ölçütleri tek tek |
| F2a | Guard test; mevcut süitler | Ham `'home'` yasağı; davranış değişmez |
| F2b | `moonFeatureGate.test.ts` | Ruleset 19'da bütün yollar kapalı; payload'da ay yok |
| F2c | `moonSeed.test.ts`, `moonBuild.test.ts`, `moonCarry.test.ts` | Deterministik tohum; tohum defteri (E14); Çekirdek 9 kapısı; kurma kuyruğu; "ay zaten var" reddi; V1 iadesi; S56: hesap silmede koloni ayı yeni nötrde kalır, başkent ayı gider, korunan ve sıfırlanan alanlar (V19) |
| F3a | `moonHop.test.ts`, `moonSight.test.ts` | Rıhtım yeri; havada sayılmama; E2, E3; teleskobun iki satırı; probenin ay bölümü; **S53 görünürlüğü** (keşfedilmemiş dünyada nadirlik yok; probe, savaş, teleskop tanıması ve Gözcü sonrası var; hafızanın donması); komutan transferinde ay gemilerinin inmesi, ayın yuvada kalması, başkent ayının taşınması, E16 |
| F3b | `moonBattle.test.ts`, `retarget.test.ts` | Ayrı hedef; boş ay (S31); savaşmayan gövdeler; **kaçış duruşunun yok sayılması (S55)**; sadakat −30/−15; Honor ve Dominion; saldırı sınırları; E1; radar gövdesi; gezegen savaşı regresyonu |
| F3c | `moonLaunch.test.ts` | Aydan saldırı ve transfer; yakıtın gezegenden ödenmesi; dönüşün doğru gövdeye ya da dolu rıhtımda gezegene inmesi; aya transfer; 5 dk beklemenin dünyaya uygulanması |
| F4 | `moonGate.test.ts` | Kapasite darboğazı; iki şarj; yakıt; E4, E5, E6; parıltının görünürlüğü; sıçra-vur; S46 |
| F5 | `moonScan.test.ts` | Rota fotoğrafı; aya değen uçuşun gizlenmesi; Legendary istisnası; keşfin nadirliği hafızaya yazması; sessizlik; menzil; 30 D |
| F6 | `moonBirth.test.ts` | Araştırma şartı; nötr hariç; eşik; toplayıcı öncesi girdi; yerine geçme; Death Star enkazından doğmama; aynı savaşta düşüş; Chronicle'da nadirlik olmaması |
| F7 | `moonStrike.test.ts`, `moonRadiation.test.ts` | Çatlak; 24 sa iyileşme; 3 sa kapanma; eşikte patlama; filo kaybı; skorun son vurana yazılması; uçuşların dönmesi; önleme; gezegene vuruşun aya dokunmaması (S39); **nötr tohum ayı (S54)**: bant yok, çatlar ve patlar, skor ve enkaz yok, tohum geri gelmez; E15; gövdeye göre radyasyon |
| F8 | `services/bots` testleri | Botların ay eylemlerinin insan servis yolundan geçmesi; bilgi eşitliği (gizli nadirliği bilmeme); persona oranları |
| F9 | Web birim testleri ve görsel kontrol | Ekran durumları; bilinmeyen ve Common nadirliğin ayırt edilmesi (V17); 350 px; 6 dil anahtarları; LOD kademeleri |
| F10 | Stage playtest; owner isterse sim | §13 F10 |

Sızıntı testleri (§8) ve yarış testleri (§7) ilgili fazların dosyalarına dağıtılır. Her satır en az bir teste karşılık gelir.

## 13. Fazlar: adım → doğrulama

**Sıra:** F0 → F1 (paralel, canlıya ayrı) → F2a → F2b → F2c → F3a → F3b → F3c → F4 → F5 → F6 → F7 → F8 → F9 → F10. F5 ve F6, F4'ten bağımsızdır ve sıraları değişebilir.

**F0 — kural paketi**
- `moon.ts` testleri yazılır, kırmızı doğrulanır, kod yazılır, yeşil doğrulanır.
- Doğrulama: rules süiti, typecheck, lint.

**F1 — koloni düşüşü (R1, canlı)**
1. **Testler (kırmızı):**
   - SECESSION'da gezegendeki, tamirhanedeki ve kolonide duran destek gemileri yok olur.
   - Prospector ve savaşmayan gövdeler de yok olur. Tamir siparişleri iptal edilir.
   - Yer birimleri bugünkü gibi nötr garnizona geçer.
   - ABANDONED bugünkü gibi kalır (regresyon).
   - Düşen koloniye giden ya da dönen **her uçuş ailesi** gemi kaybetmeden sahibinin güvenli evine iner, hiçbiri nötr dünyaya inmez: görev dönüşü, koloniye transfer, madencilik, korsan, ticaret, konvoy, bilinmeyen sinyal, klan desteği (V22; bugünkü kod, testle sabitlenir).
   - Düşman saldırısı nötr dünyaya devam eder.
   - Yoldaki destek dalgası eve döner (V5). Koloniden kalkmış dalga başkente bağlanır (bugünkü gibi).
   - Dominion ve Honor değişmez; sezon istatistiği kaybı gösterir (S43).
   - Sahibine ve destekçilere bildirim gider.
   - Komutan gemisi yok olmaz.
2. **Kod:** `secedeColony` (`loyalty.ts:211`) cause'a göre dallanır. Destek dalgaları için `loseWave` ve `releaseSupportForWorldChange` ayrıştırılır.
3. **Arayüz:** Destek ekranında ev sahibinin sadakati; gemisi olan kolonide sadakat uyarısı; düşüş bildiriminin metni (6 dil).
4. **Belgeler:** `game-design.md` (Ownership), `docs/clan-defense-support-plan.md`, glossary, Wiki.
5. **Duyuru:** Oyuncu duyurusu 6 dilde hazırlanır; owner yayınlar. Deploy'dan en az bir gün önce yayınlanması önerilir.
6. **Botlar:** Düşük sadakatli kolonideki filoyu bazen çekerler (insan davranışına benzer).
7. **Teslim:** Tam `pnpm verify`. Commit owner isterse yapılır, deploy owner'ın emriyle.

**F2a — gövde temeli** (davranış değişmez)
- Konum modülü yazılır, O5 listesi modüle geçirilir, guard test eklenir.
- Doğrulama: server süitleri değişiklikten önce ve sonra aynı sonucu verir; bilinen kırmızılar değişmez.

**F2b — veri ve kapı**
- Migration'lar (§4), Drizzle şeması, `moonsEnabled`, `features.moons`.
- Doğrulama: migration temiz bir `_test` veritabanında uygulanır; kapı testleri geçer.

**F2c — tohum, araştırma, kurma, taşıma**
- S30 ve Y5 owner kararıyla V28–V29'da; sabitler V34 diliminde (F9) koda girer.
- Tohum defteri ve S56'nın hesap silme yolu yapılır.
- Doğrulama: §12 F2c testleri; yerelde ruleset 20 sezonunda ay satırlarının gözle kontrolü; boşta koltuk geri almanın koloni davranışının doğrulanması (§6.17).

**F3a — geçiş, sensörler, görünürlük, komutan transferi**
- Doğrulama: §12 F3a testleri; yerelde geçişin teleskopta "geçişte" görünmesi; keşfedilmemiş dünyada nadirliğin görünmemesi.

**F3b — ay savaşı ve hedef değiştirme**
- `settleBattleWreck` ve `applyBattleAftermath` çıkarılır; gezegen savaşı testleri yeşil kalır.
- Doğrulama: §12 F3b testleri.

**F3c — aydan kalkış ve aya iniş.** Doğrulama: §12 F3c testleri.

**F4 — kapı.** Doğrulama: §12 F4 testleri; yerelde iki kendi ayı arasında sıçrama.

**F5 — Gözcü.** Doğrulama: §12 F5 testleri.

**F6 — doğum.** Doğrulama: §12 F6 testleri.

**F7 — Death Star ve radyasyon** (nötr tohum ayı dahil). Doğrulama: §12 F7 testleri.

**F8 — botlar.** Doğrulama: §12 F8 testleri; stage'de bot davranışının gözlenmesi.

**F9 — görsel, ses, UX (premium geçiş)**
- Her fazın asgari arayüzü kendi fazında yapılır; F9 premium geçiştir.
- VFX briefleri, ses, titreşim, 350 px ve S22 ölçümü yapılır.
- Doğrulama: `tools/visual.mjs` ekran görüntüleri ve S22 fps.

**F10 — oyuncu testi ve teslim**
1. Stage'de ruleset 20 sezonu açılır; stage başlatılır ve iş bitince durdurulur. Testerlarla şu senaryolar oynanır:
   - kedi-fare: son anda geçiş ve son anda hedef değiştirme;
   - kapıyla takviye;
   - Gözcü ile takip;
   - ay kuşatması;
   - nötr Legendary'yi inkâr.
2. **Test sırasında kod değiştirilmez.** Önce commit atılır; testerlar bitirene kadar dokunulmaz.
3. Tam süitler koşulur: server 4 parça, kendi `_test` veritabanlarıyla; ardından web.
4. Varsayılan ruleset 19'dan 20'ye çıkarılır; belgeler güncellenir.
5. Sezon sınırı deploy'u owner'ın emriyle yapılır.

## 14. Belge ve metin güncellemeleri (uygulama sırasında)

| Belge | Ne değişir |
|---|---|
| `docs/game-design.md` | Travel (kapı mesafeyi atlar), Radar (dördüncü ve beşinci seçenek), sensor horizon (Gözcü), Ownership (patlama, düşüşte kayıp, S56), Combat (ay savaşı, boş ay, ayda kaçış yok), Radyasyon (gövde), bildirim listesi |
| `docs/glossary.md` | Ay, nadirlik, Ay Kapısı, Gözcü, rıhtım, geçiş, çatlak |
| `docs/ux-writing.md` | Terimler ve ton |
| `docs/review-sight.md` | Yeni sis alanları; görünür / görünmez matrisine ay satırları (S53) |
| `docs/architecture.md` | `moons`, `moon_moves`, `moon_scans`, `moon_seed_ledger`, yeni olay türleri |
| `docs/clan-defense-support-plan.md` | Düşen kolonide destek gemilerinin kaybı |
| `docs/visual-design.md` | Ay sanatı, nadirlik halkası, bilinmeyen nadirlik, VFX |
| Wiki (6 dil) | Ay sayfası (yedek kaynak) |
| `docs/ay-plani-2026-11-18.md` | Karar değişirse S tablosu ve ilerleme |

## 15. Kararlar

### 15.1 Owner kararları (2026-11-19)

| # | Konu | Karar | Planda |
|---|---|---|---|
| Y1 → S53 | Görünürlük | Ayın varlığı, çatlakları ve son darbe zamanı herkese görünür. Nadirliği yalnız dünyayı keşfeden ya da probe atan görür. | §6.10, §8, §9.1–9.2 |
| Y2 → S54 | Nötr tohum ayına Death Star | Vurulabilir ve ay yok edilebilir (inkâr taktiği). | §6.14, E14, E15 |
| Y3 → S55 | Ay savaşında kaçış | Yok; ay son duraktır. | §6.9 |
| Y4 → S56 | Silme ve transfer yollarında ay | Koloni yuvası nötr olarak geri gelirse ay onunla kalır ve yeni bir ödül olur. Başkentin ayı başkentle gider. | §6.3, §6.17 |

### 15.2 Maliyetler (S30, Y5) — owner kararı 2026-11-19 (V28–V29)

| Ne | Alloy | Crystal | Deuterium | Süre |
|---|---|---|---|---|
| Ay Çekimi araştırması (`LUNAR_CAPTURE`) | 20.000 | 10.000 | 500 | 4 saat, sabit |
| Common ay kurma | 25.000 | 15.000 | — | 8 saat, sabit |

Kıyas için `profileIncome(9)`: dünya başına saatte ~1.740 alloy, ~870 crystal, ~56 deuterium. Araştırma ~11,5 saatlik, ay ~14 saatlik alloy geliri.

### 15.3 Varsayılanlarım (geri alınabilir ayrıntılar)

| # | Varsayılan | Gerekçe |
|---|---|---|
| V1 | Kurulum sürerken savaşta ay doğarsa sipariş iptal edilir, tam iade | Oyuncu kaynak yakmaz |
| V2 | İki hedef değiştirme arasında ≥ 5 sn; push yalnız ilk uyarıda | Telefon spam'i yok, akıl oyunu korunur |
| V3 | Her yönde en çok bir bekleyen geçiş; geçiş geri çağrılmaz | Olay sayısı şişmez; 90 sn zaten kısa |
| V4 | Komutan gemisi aydan kalkan saldırıya eşlik eder, kapıdan geçmez | En az değişiklik |
| V5 | Düşen koloniye yoldaki destek dalgası eve döner | S19d ile tutarlı |
| V6 | Aydan yalnız saldırı ve transfer kalkar | S34'ün harfi |
| V7 | Hedef değiştirme yalnız tekli saldırıda | Klan savaşı ayrı bir ortak akış |
| V8 | Sıçrama iptal olursa ya da eksik giderse yakıt iade edilmez | 10 sn'lik pencere; basitlik |
| V9 | Aya dönen hasarlı gemi ayda kalır | Kapı kuralıyla aynı |
| V10 | Probe geçişteki filoyu "geçişte" bayrağı ve bantla gösterir | Teleskopla aynı |
| V11 | Ayda yalnız savaşmayan gövde varsa "ay boştu" sayılır; gövdeler zarar görmez | Gezegen kuralıyla aynı (O28) |
| V12 | Aya atılan radyasyon bombasını gezegenin önleme sistemi korur | S48'in bomba karşılığı |
| V13 | Arıza görevleri bağlar, geçiş ve sıçramayı bağlamaz | Arızadaki oyuncu saklanabilsin |
| V14 | Gözcü boyut eşikleri 470 ve 3.250 bulk | Oyuncu kendi rıhtımlarıyla kıyaslayabilsin |
| V15 | Gözcü, aya değen her uçuşu (kalkış ya da iniş) gizler | S15 ve S50'nin genel okuması |
| V16 | Doğum sahipli dünyadaki her PvP savaşında denenir: tekli saldırı, ay savaşı, klan birleşik saldırısı | S9; korsan ve konvoyun dünya çapası yok |
| V17 | Bilinmeyen nadirlik halkasız çizilir | Common'ın gri halkasıyla karışmasın (S53) |
| V18 | Chronicle: doğumda nadirlik yok, patlamada var; el değiştirme mevcut ele geçirme kaydına "aylı" bayrağıyla eklenir | S53 korunur; patlama anında eşik zaten görünür |
| V19 | Taşınan ay nadirliği, kökeni, çatlakları, son darbeyi ve kapanmayı korur; kapı şarjı sıfırlanır | Fiziksel durum sürer, sahiplik sıfırlanır |
| V20 | Komutan transferinde aydaki gemiler önce gezegene iner; bekleyen hareket varken transfer ertelenir | `WAITING`'de ay kapalı, gemiler orada mahsur kalmasın |
| V21 | Sıçrama bitişinde hedef Hangar yeniden kontrol edilmez | Başlangıçta kontrol edildi; taşma mevcut "duran taşma yasaldır" kuralıyla aynı |
| V22 | **Owner kararı (2026-11-19): en sabit yol.** Düşen koloniye giden ya da oraya dönen bütün uçuş aileleri (görevler, madencilik, korsan, ticaret, konvoy, sinyal, klan desteği) bugünkü koddaki gibi inişte `safeHomePlanet` ile sahibinin güvenli evine (kalkış dünyası hâlâ onunsa oraya, değilse başkente) iner; koloniye giden transfer varışta `rerouteToSafeHome` ile döner. Yeni kod yok; F1 testleri her aileyi sabitler. | Her aile bunu zaten yapıyor (`trade.ts:440`, `pirateRaid.ts:1180`, `intergalacticConvoyRaid.ts:573`, `unknownSignal.ts:322`, `mining.ts:1027–1050`, `movement.ts:580,945`, `handlers.ts:1784`); uçuşu yok etmek her ailenin uçuş modeline dokunmak, yani daha çok hata riski demekti. |
| V23 | **Ajan kararı (owner yokken, 2026-11-19), owner onayına sunulur.** F1 madde 6 (botlar düşük sadakatli koloniden filo çeker) uygulanmadı: botlar yalnız başkentleriyle oynar, hiçbir yoldan koloni edinmez (`services/bots/*`'ta koloni, yerleşim ya da Death Star yolu yok). Botlar koloni almaya başlarsa bu madde geri gelir. |
| V24 | **Ajan kararı.** Destekçinin "dalgan koloniyle kayboldu" bildirimi yeni enum yerine `clan_support_result` + `grade: 'COLONY_LOST'` (migration yok). Açılacak savaş raporu olmadığından satırda "aç" eylemi yok. |
| V25 | **Ajan kararı.** Destek teklifi `hostLoyalty` taşır: ev sahibi koloninin sadakati, probe gibi yukarı yuvarlanır; başkentte null. Klan arkadaşına gösterilir (gönderen riski tartsın diye). %50 altında uyarı tonu. |
| V26 | **Ajan kararı.** Kopuş kaybı sezon istatistiğine `season_telemetry_segments.telemetry.shipsLost` segmentiyle yazılır, dondurmada toplanır. Snapshot şekli değişmediği için `statsVersion` artmaz. Duyuru taslağı: `docs/duyuru-koloni-kopusu-2026-11-19.md`. |
| V27 | **Owner onayladı (2026-11-19).** S19c sebep ayırmadığı için Ölüm Yıldızı darbeleriyle sadakati sıfırlanan koloni de filosunu kaybeder (aynı `secedeColony` SECESSION yolu). Etki: Ölüm Yıldızı kolonideki filoyu da siler, savunan için risk büyür. Owner 'yalnız ihmal' derse `cause` ayrılır (DS yolu ABANDONED gibi taşır). |
| V28 | **Owner kararı (2026-11-19, Y5).** Ay Çekimi (`LUNAR_CAPTURE`) tek seviyelik izin araştırmasıdır: 20.000 alloy, 10.000 crystal, 500 deuterium, ham sabit (`scalePrice`'sız). Süre 4 saat, Çekirdek seviyesinden bağımsız sabit; katalogdaki `researchMinutes` formülü bu araştırma için atlanır. Ön koşul araştırma yok, `availableAtMinutes: 0`, `requiredCore: 9`. | İlk öneri (Grid fiyatı, ~7,7 saat) owner tarafından düşürüldü. Sabit süre ajanın yorumu: owner "4 saat" dedi; formül Çekirdeğe göre değiştirirdi. |
| V29 | **Owner kararı (2026-11-19, S30).** Common ay kurma: 25.000 alloy, 15.000 crystal, deuterium yok (ham sabit), 8 saat sabit süre. İptal mevcut `cancelRefund` kuralıyla; V1 (savaşta doğum) tam iade. | Owner yalnız alloy ve crystal söyledi; deuterium yok diye okundu (ilk öneride 1.500'dü). Common ayı 24 saatte 3 Death Star (3 × 50k alloy) öldürür; saldırana savunanınkinden ~6× pahalı. |
| V30 | **Ajan kararı.** F2a yalnız konum modülü + guard'la kapandı: bütün ham `'home'` yerleri `PLANET_LOCATION`'a, "görevde mi" sınıflayan 5 yer (`intel.ts` teleskop, `planet.ts` `awayFleet`, `commanderTransfer.ts`, `colonyAbandonment.ts`, `planetView.ts`) `awaySql`/`isAway`'e geçti. Guard izin listesi tutmaz, sıfır ham yazım ister. `homeHealth` gövde genelleştirmesi ve `assertNoArrivalPending` gövde süzgeci ilk ay okuyucusunun geldiği F3a/F3c'ye taşındı. | Okuyucusu olmayan gövde parametresi ölü kod olurdu; süzgecin dayandığı `missions.target_body` kolonu da F3b ile gelir. |
| V31 | **Ajan kararı.** Her tablo, kolon ve enum değeri onu ilk kullanan fazın migration'ıyla gelir. F2b: `0253_moons` (`moons`, `moon_seed_ledger`) + `features.moons`. `moon_moves` F3a, `missions` gövde kolonları ve `probe_reports.moon`/`watches.last_moon_status` F3a–F3c, `moon_scans` F5, `debris_fields.body` F6, enum değerleri olayı ilk üreten fazda (her biri kendi migration'ında). | Kullanılmayan kolon testsiz kalır; enum'a değer eklemek bildirim/handler tablolarında boş dal ister. Hepsi aynı karanlık dalda kaldığı için yayın sırası değişmez. |
| V32 | **Owner onayıyla ölçüldü (2026-11-19).** `missions` kısmi indeksleri (`target/origin WHERE status='in_flight'`) Gözcü fazında (F5) kendi migration'ıyla gelir. Canlı ölçüm (salt okunur, `BEGIN READ ONLY`): 13.002 satır, tablo 17 MB, `missions_origin_idx` 920 kB; ölçüm anında `in_flight` 0. Bu boyutta `CREATE INDEX` milisaniyeler sürer: bakım penceresi gerekmez, normal migration yeterli. | Tek tüketicisi Gözcü taraması; tablo küçük olduğu için kilit riski yok. |
| V33 | **Ajan kararı.** İstemci Zod şemasına `features` alanı ilk ay arayüzüyle (F3a) eklenir; Zod bilinmeyen alanı zaten atar, eski istemci kırılmaz. | Okuyucusu olmayan şema alanı eklenmez. |
| V34 | **Owner onayladı (2026-11-19): görselleri owner hazırlar, F9'da birlikte bakılır.** Ay Çekimi araştırması (`LUNAR_CAPTURE`) ve Common kurma, F2c'den çıkıp oyuncu yüzeyleriyle birlikte tek dilim olarak F9'un başına alındı. F2c: tohumlama + defter + S56 taşıma (hesap silme, komutan transferi gidiş ve dönüş) + galaksi silme. | Araştırma kimliği paylaşılan `RESEARCH_PROJECT_IDS`'e girince her araştırma ekranı (takımyıldız, sahne ve ikon görselleri, 6 dil ad/rol/detay, Wiki, kazanç satırı) onu ister. Görsel kütüphanede ay sahnesi yok; Codex ya da owner seçimi gerekir. Tohum ayları F3–F8'in bütün sunucu işini sınamaya yeter; S9 (savaşta doğum için araştırma şartı) F6'da araştırma kimliğine bağlanacağı için F6, V34 diliminden sonra gelir ya da şartı geçici olarak "her zaman yok" sayar. |
| V35 | **Ajan kararı.** Dönüşte (Sessiz Alan → ana galaksi) dönen koloni eski adresini nötrden geri alırsa o yuvadaki ay da ona geçer: ay yuvanındır (S56'nın simetriği). Başkent ayı her iki yönde başkent satırıyla taşınır; Sessiz Alan'da kapı ve Gözcü uyur. Transferden önce aydaki bütün gemiler gezegene iner (V20, `landMoonShips`). | S56 "ay yuvada kalır" der; dönüşte yuvayı geri alan dünya ayı da alır, ay Sessiz Alan'a sürüklenip kaybolmaz. |
| V36 | **Owner onayladı (2026-11-19).** Geçişteyken dünyası el değiştiren (kopuş, terk, devir) filo, geçişin iniş anında sahibinin güvenli evine (`safeHomePlanet`) bütün olarak iner; ayrı bir dönüş uçuşu kurulmaz. `moon_moves.status = 'RETURNED'`. | Plan tablosu "güvenli eve dönüş görevine çevrilir" diyordu. Geçiş en çok 90 sn sürer ve gönüllü terk bugün de filoyu başkente anında taşır; ayrı uçuş, her uçuş ailesine dokunmak demekti (V22 ile aynı gerekçe). Bedeli: kopuşta bu filo kurtulur, durandan farklı olarak. |
| V37 | **Ajan kararı.** Devirde (`transferPlanetControl`) aydaki duran filo da gezegendeki gibi yeni sahibe geçer (mevcut kural, `standingSql`). Kopuşta yok olur, terkte başkentin gezegenine iner. | §6.16 tablosundaki "mevcut kuralla aynı" satırının uygulanışı. |
| V38 | **Ajan kararı.** Bekleyen geçiş, komutan transferini (`FLIGHT`) ve hesap silme/boşta koltuk geri almayı (`WORLD_BUSY`, `reclaim.busy`) durdurur (E16). Test bunun öncesinde transferin geçişteki gemileri bırakıp gerçekleştiğini gösterdi: `hop:` satırları "görevde" sayılmadığı için hiçbir eski kontrol yakalamıyordu. | Gerçek açık; `moonMovePending` tek yerde. |
| V39 | **Ajan kararı.** Probe'un ay okuması `probe_reports.moon` kolonu yerine raporun `silhouette.moon` alanına yazılır (nadirlik, çatlak, son darbe, kapanma, aydaki filo bandı, geçişte bayrağı); nadirlik ayrıca `silhouette.moonRarity` olarak hafızaya geçer. Savaş hafızası nadirliği ay tablosundan okur. Galakside nadirlik: canlı görüşte bugünkü ay, yoksa hafızadaki (donmuş) nadirlik; patlamış ay listede olmadığı için çizilmez. Raporun ay bölümü istemci API'sine F9 arayüzüyle açılır. | Migration'sız; silhouette zaten "probe'un bakışta gördükleri"nin yeri ve hafızaya aynen kopyalanıyor. Bant ayrı tohum akışında, eski bantların hiçbiri kaymaz. |
| V40 | **Ajan kararı.** Teleskobun ay satırı (S40) şimdilik canlı okumadır: `WatchView.moon` = `HOME` / `EMPTY` / `HOP` / `NONE`, planet satırı Örtü yüzünden `UNKNOWN` ise ay satırı da `UNKNOWN`. `watches.last_moon_status` kolonu ve satır değişince bildirim, teleskop arayüzüyle (F9) gelir. | Kalıcı kolonun tek okuyucusu değişiklik bildirimi; arayüz yokken boş kalırdı. |
| V41 | **Ajan kararı.** Ay savaşı ayrı `services/moonBattle.ts` + `resolveRaid` kopyası olarak değil, `onMissionArrival`'ın saldırı yolunda `onMoon` dallarıyla kuruldu (hat = aydaki gemiler, yer/Aegis/destek/kaçış yok, ganimet yok, sağ kalanlar ve yaraları ayda). `settleBattleWreck` / `applyBattleAftermath` çıkarılmadı; enkaz fonksiyonu doğum zarıyla (F6) ilk ikinci kullanıcısını bulunca çıkarılır. Boş ay ayrı `settleEmptyMoon`. | Skor, rapor, bildirim, Honor ve kalkan için ~600 satırı kopyalamak iki yolun zamanla ayrışması demekti; dallar gezegen yolunu değiştirmez (tam server süiti yeşil). |
| V42 | **Ajan kararı.** Nötr dünyanın tohum ayına saldırı reddedilir (`MOON_UNCLAIMED`): ayda kimse yok, dünya gezegeninden alınır. Yoldayken hedef nötre düşerse ya da ay yok olursa filo dokunulmadan döner. | Boş bir hedefe uçuş yalnız yakıt yakardı; S54'ün Death Star darbesi ayrı yol (F7). |
| V43 | **Ajan kararı.** Boş ay (S31) bir rapor yazar: `battle_reports.target_body = 'MOON'`, tur yok, `DECISIVE`, ganimet 0, Dominion uygun değil. Replay, Honor, Dominion, sadakat, kalkan ve arıza yok; filo bütün döner; iki tarafa `moonEmpty` bildirimi. Rapor, 12 saatlik kişisel bekleme sayacına girer ("saldırı sınırına sayılır"). Migration 0256 `battle_reports.target_body` ekler. | Bekleme sayacı `battle_reports`'u sayıyor; ayrı sayaç yerine rapor hem "ay boştu" yüzeyi hem sınır oldu. |
| V44 | **Ajan kararı.** Ay savaşı koloniye arıza açmaz (gezegende ağır yenilgi 2 arıza açar). Sadakat (S28), toparlanma kalkanı ve skor gezegendeki gibi. | S36 ile aynı mantık: aya vuran gezegene dokunmaz. |
| V45 | **Ajan kararı.** `missions.origin_body` F3c'yi beklemeden `target_body` ile aynı migration'da (0256) geldi; şimdilik her satır `PLANET`. | Aynı tabloya iki ayrı migration yerine bir; sabit varsayılanlı kolon canlıda yalnız metadata. |

## 16. Dosya haritası

**Yeni dosyalar**

| Dosya | İçerik |
|---|---|
| `packages/rules/src/moon.ts` (+ test) | §5 |
| `apps/server/src/services/unitLocation.ts` (+ guard test) | §6.1 |
| `apps/server/src/services/moon.ts` | Ay okuma ve yazma, tohum ve defter, kurma bitişi, doğum, patlama, taşıma (S56) |
| `apps/server/src/services/moonMovement.ts` | Geçiş, sıçrama, iniş ve bitiş |
| `apps/server/src/services/moonBattle.ts` | `resolveMoonBattle` |
| `apps/server/src/services/moonScan.ts` | Gözcü |
| `apps/server/src/routes/moon.ts` | Ay route'ları (Zod) |
| `apps/server/src/worker/moonHandlers.ts` | `moon_move_land`, `moon_gate_ready` |
| `apps/server/drizzle/0253+_moons*.sql` | §4 |
| `apps/web/src/galaxy/Moons.tsx`, `moonOrbit.ts`, `moonMaterial.ts` | §9.2 |
| `apps/web/src/screens/MoonPanel.tsx` (+ v2 kit parçaları) | §9.4 |
| `apps/web/src/vfx/moon*.ts` | §9.3 |

**Dokunulacak dosyalar**

| Katman | Dosyalar |
|---|---|
| Kural | `constants.ts` (ruleset sabiti en son), `research.ts` (`LUNAR_CAPTURE`), `index.ts` (export), `sight.ts` (gerekirse kapı teması) |
| Şema | `db/schema.ts` (§4) |
| Sunucu | `homeHealth.ts`, `planet.ts`, `planetView.ts`, `intel.ts` (probe ve hafıza nadirliği), `movement.ts`, `mission.ts`, `flight.ts`, `fuel.ts`, `strategic.ts`, `strategicInterception.ts`, `radiationBomb.ts`, `planetRadiation.ts`, `loyalty.ts`, `clanSupport.ts`, `clanSupportView.ts`, `ownership.ts`, `colonyAbandonment.ts`, `commanderTransfer.ts`, `accountDeletion.ts`, `reclaim.ts`, `servers.ts`, `season.ts` (`createNeutralWorld` bayrağı), `build.ts`, `buildQueue.ts`, `research.ts`, `radar.ts`, `watchEvents.ts`, `traffic.ts`, `notifications.ts`, `chronicle.ts`, `galaxyEvents.ts`, `honorStrategic.ts`, `battleSettlement.ts`, `bots/*` |
| Worker | `worker/handlers.ts` (ay savaşı dalı, ortak yardımcıların çıkarılması, `HANDLERS`) |
| Route | `routes/planet.ts`, `routes/galaxy.ts` (kamusal ay listesi ve gözlemcinin nadirlik haritası), `routes/intel.ts` |
| İstemci | `screens/PlanetScreen.tsx`, `LaunchSheet.tsx`, `TransferSheet.tsx`, `IntelScreen.tsx`, `BattleReports.tsx`, `ResearchPanel.tsx`, `NotificationCenterSheet.tsx`, `ChronicleScreen.tsx`, `ClanSupportSheet.tsx`, `WikiScreen.tsx`, `galaxy/PlanetField.tsx`, `galaxy/publicMoments.ts`, `api/*`, `i18n/locales/*` (6 dil), `i18n/errors.ts` |
| Sim | `packages/sim/src/invariants.ts` |

## 17. İlerleme

| Faz | Durum |
|---|---|
| Tasarım (S1–S52) | ✅ 2026-11-18 |
| Entegrasyon planı | ✅ 2026-11-19 (final) |
| Y1–Y4 kararları (S53–S56) | ✅ 2026-11-19 |
| S30 ve Y5 (maliyetler) | ✅ 2026-11-19 owner kararı (§15.2) |
| F0 kural paketi | ✅ 2026-11-19 (`packages/rules/src/moon.ts`, 20 test) |
| F1 koloni düşüşü (R1, canlı) | 🟡 2026-11-19 kod + testler + 6 dil + Wiki + game-design tamam (worktree `feat/moon`). Tam doğrulama: typecheck + lint temiz, rules/sim yeşil, server 538 dosyanın hepsi yeşil; web'de tip ölçeği + ikon seti (3) ve ui-audit envanteri (3) temiz master d637eabf'de de aynen kırmızı; `landing-rewards` tam koşunun yükü altında kırmızı, tek başına worktree'de ve master'da yeşil (zamanlama). F1'e ait kırmızı yok. Yayın: owner kararı (2026-11-19) — ay işinin tamamı bitince tek seferde; F1 de onunla gider. Kayıp sezon istatistiğine `telemetry.shipsLost` segmentiyle yazılır; snapshot şekli değişmediği için `statsVersion` artmaz. Destekçi bildirimi yeni enum yerine `clan_support_result` + `grade: COLONY_LOST` (migration yok). |
| F2a gövde temeli | ✅ 2026-11-19 `services/unitLocation.ts` + guard (sıfır ham `'home'`), 32 dosya geçti; hedefli 90 server dosyası yeşil; `homeHealth` gövdesi F3'e (V30) |
| F2b veri ve kapı | ✅ 2026-11-19 `0253_moons` (`moons`, `moon_seed_ledger`, CHECK + CASCADE), `/api/season` `features.moons` (`moonsEnabled`); `moon-schema.test.ts` 4, `moon-feature-gate.test.ts` 3 test. Kalan tablo ve kolonlar fazlarına (V31) |
| F2c tohum, araştırma, kurma, taşıma | ✅ 2026-11-19 (araştırma + kurma V34 ile F9'a): `services/moon.ts` (`seedMoonAt`, `moonsOf`, `carryMoon`, `moveMoon`, `landMoonShips`), `openNeutralWorlds` planı tam seçimden okur; `moon-seed.test.ts` 5, `moon-carry.test.ts` 2, `account-deletion.test.ts` +1 |
| F3a geçiş, sensörler, görünürlük | 🟡 2026-11-19 geçiş bitti: `0254_moon_move_event`, `0255_moon_moves`, `services/moonMovement.ts` (`hopFleet`, `landMoonMove`), `POST /api/planets/:id/moon/hop`, `moon_move_land` handler (BLOCKER), `homeHealth` gövde parametresi + `arrivalPending`; dünya kaybı (kopuş/terk/devir) aydaki ve geçişteki filoyu kapsar; E16. Testler: `moon-hop` 9, `moon-world-loss` 4, `moon-carry` +1. `/api/galaxy` `moons: {list, rarity}` (kamusal liste + canlı/kendi nadirliği, ruleset 19'da alan yok; `moon-visibility` 2 test). Tam server süiti yeşil (`reclaim-fk-indexes` korumasıyla `moon_moves_owner_idx` eklendi). Probe ay bölümü + hafıza nadirliği (V39), savaş hafızası nadirliği; `moon-visibility` 3 test. Teleskobun ay satırı canlı (V40); `moon-visibility` 4 test. Kalan (F9 ile): `last_moon_status` + bildirim, probe raporu ay bölümünün API'si, kamusal listenin önbelleği (§11); Örtü altında ay satırı için ayrı test |
| F3b ay savaşı ve hedef değiştirme | 🟡 2026-11-19 sunucu: migration 0256 (`missions.origin_body/target_body/retargeted_at`, `battle_reports.target_body`), `launchAttack` + `/api/fleet/launch` `targetBody`, ay savaşı dalları (V41), boş ay (V43), K12 gövdeye göre (hop + E2 iki yönde), `POST /api/missions/:id/target-body` (E1, V2, V7), radar şeridi ve uyarısında `targetBody` (S24), replay `environment: 'MOON'` (web şeması kabul ediyor). `moon-battle.test.ts` 7, `moon-retarget.test.ts` 4. Kalan (F9): istemci yüzeyleri, ay savaş sahnesi arka planı, bildirim metinleri |
| F3c aydan kalkış ve aya iniş | ⬜ |
| F4 kapı | ⬜ |
| F5 Gözcü | ⬜ |
| F6 doğum | ⬜ |
| F7 Death Star ve radyasyon | ⬜ |
| F8 botlar | ⬜ |
| F9 görsel, ses, UX | ⬜ |
| F10 oyuncu testi ve teslim | ⬜ |
