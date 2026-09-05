# Entegrasyon Planı — Korsan Filoları (Pirate Fleets)

> **Durum:** ONAYLANDI — uygulama başlıyor.  
> **Karar kimliği:** D150 (`docs/decisions.md` içine yazılacak).  
> **Sahibi kararları:** görünürlük craft-zone · gemi ödülü kısıtsız · korsan saldırmaz ·
> sıfır Dominion · kârlı ekonomi · DECISIVE-only ele geçirme · çift taraflı enkaz ·
> dünya başına tek akın.

## Context

**Ne yapıyoruz.** Galakside asteroidler gibi kendi kapalı yörüngelerinde dolaşan,
4 seviyeli NPC korsan filoları. Oyuncu bunlara akın düzenler; kazanırsa hammadde,
enkaz ve şansına korsan kadrosundan **bir gemi** alarak döner.

**Neden.** Core loop bugün iki hedef sınıfı tanıyor: başka bir oyuncu ve statik
neutral dünyalar. Oyunun tüm gerilimi "filon evde mi?" sorusunda
(`docs/game-design.md:335`) — ama o soruyu sorabilmek için önce filo kurman
lazım ve filo kurmanın tek yolu ekonomiyi beklemek. Korsan filosu **hareketli,
seviyesi okunabilir, fiyatı belli bir hedef** ekliyor:
`CURIOSITY · RISK · OPPORTUNITY · RE-ENGAGEMENT · MEMORABILITY`.
"Bir gemi kazanma" ihtimali oyunun bugün hiç sahip olmadığı şey: **filonun
tezgâhtan başka bir kapıdan da büyüyebilmesi.**
Ayrıca kullanıcıların oyunda kalma süresini arttıracağını düşünüyoruz.

**Beklenen sonuç.** Her oturumda değerlendirilecek, kaçırılabilir bir fırsat, ve
sensör yatırımının somut karşılığı — korsanı önce gören önce vurur.

---

## Onaylanmış kararlar

| Konu           | Karar                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------- |
| Görünürlük     | **Craft gibi canlı zone.** NONE/CONTACT/IDENTIFIED. Rota asla yayınlanmaz.               |
| Gemi ödülü     | **Her hull, kısıt yok** — Shipyard/research kapısı yok.                                  |
| Saldırganlık   | **Sadece hedef.** Korsanlar hiçbir şeye saldırmaz.                                       |
| Skor           | **Sıfır Dominion.** `dominionSwing: 0`, neutral dünya ile birebir.                       |
| Ekonomi        | **Kârlı — güvenilir gelir.**                                                             |
| Ele geçirme    | **Yalnız DECISIVE**, şans level'a göre: L1 yüksek → L4 düşük, seed'li.                   |
| Enkaz          | **İki taraf da**, PvP gibi (`DEBRIS.share`).                                             |
| Tekrar saldırı | **Dünya başına tek akın.** Hayatta kalanlar uçmaya devam eder; DECISIVE filoyu yok eder. |

---

## Bilinçli kabul edilen riskler

Hata değil, **senin kararınla girilen** çatışmalar. `docs/decisions.md`'ye
**D150** olarak yazılacak (D149 = public galaxy events, alınmış).

1. **`CLAUDE.md:212` — "Post-MVP: ... fleet interception".** Hareketli bir filoya
   saldırmak tam olarak bu. Kapsam kararı senin; D150 bunu "post-MVP'den öne
   alındı" diye açıkça kaydeder, sessizce geçmez.

2. **D11 (LOCKED) — savaş basit kalır.** `-%50/-35/-25/-15` beşinci bir eksen.
   **Çözüm:** ceza research değil, `combat.ts:67`'deki mevcut `SideStats`
   arabiriminden geçen bir _korsan-tarafı_ modifier. D137'nin %25 `powerCeiling`
   tavanına dokunmaz. Bu **tek doğru** bağlantı noktası: `combat.ts:168-173` bu
   arabirimi tam olarak "bir doktrin hasar havuzunda onurlandırılıp kayıp
   hesabında unutulmasın" diye yazmış.

3. **Ekonomi: "kârlı" seçimi VFR blocker'ına dokunuyor.** Korsan ganimeti
   PvP'den bağımsız yeni bir musluk; `VFR` beş seed'de LOW ve `docs/balance.md`
   bu metriklere karşı tuning'i yasaklıyor.
   **Yasaklı olmayan gaz kelebekleri** (loot grade / hull HP / `defenceSalvage` /
   hangar sabitleri / bandlar ile **asla**):
   - Spawn hızı (kişi başı) ve filo ömrü
   - Filo boyutu (2–5) ve seviye ağırlıkları
   - `hoardValueMult`
   - Dünya başına tek akın + uçuş yatağı (`flightSlots`) + yakıt
   - **En önemlisi:** ganimet `fleetCargo(survivors)` ile sınırlı. Kargo taşımak
     savaş gücünden feragat demek — `game-design.md:206-216`'nın "ne kadar kargo
     getireceğin, orada ne olduğuna dair inancına bağlı" kararı PvE'ye aynen
     taşınır. **Musluğun kendisi bir karar hâline gelir.**
   - Simülatör **indicator-only**; ARR/VFR'ye karşı tuning yapılmaz.

4. **`missions` ve `battle_reports` korsanı kaldırmıyor.**
   `missions.{ownerPlayerId, originPlanetId, targetPlanetId}` ve
   `battle_reports.{missionId, targetPlanetId}` hepsi `NOT NULL` FK.
   `schema.ts:1367-1375` bu duvara bir kez çarpmış ve mining için ayrı tablo
   yapmış; gerekçesi orada yazılı ve aynen geçerli.

---

## Mimari

### Temel model: korsan = saatin saf fonksiyonu

Asteroid modelinin birebir eşleniği. Rota, kadro, hazine ve ömür sezon
tohumundan türetilir ve **hiç saklanmaz**. Saklanan tek şey türetilemeyen
mutasyon: kümülatif kayıplar ve yok edilme. (`asteroid_claims` felsefesi.)

**Neden kapalı yörünge?** `galaxy.ts:509-545` bunu zaten ödemiş: düz bir geçişi
yalnız _daha hızlı_ bir araç yakalayabilir, bu da hedef hızlarını görünmez
olacak kadar düşürmeye zorlar. Kapalı yörüngede hedef geri gelir → **her hızdaki
filo bir randevu bulabilir.**

### Sezon içi mi, sezon sınırında mı? — **Sezon içi, ve nedeni önemli**

D143/D110 "yeni bir deterministik lane sezon sınırında başlamalı" diyor, çünkü
**mevcut** bir dağılımı değiştirmek canlı hedefleri oynatır. Korsanlar mevcut
hiçbir üreteci değiştirmiyor: kendi tohumu, kendi indeksleri, kendi tablosu olan
**tamamen bağımsız** bir lane. Tek bir kayayı bile kıpırdatmaz. Yine de
`MULTI_WORLD`'e `pirateRulesetVersion` eklenir ki ileride korsan dağılımı
değiştiğinde o değişiklik sınıra bağlanabilsin.

### Keşif hafızası — D158 ile **kullanılıyor** (bu bölüm geçersiz)

Bu plan yazıldığında model craft-zone idi: korsan sensörden çıkınca yok olurdu.
**D158 sahibin talimatıyla bunu tersine çevirdi** ("korsan filolar, asteroid
gibi"): `orbitDiscoveredAt` / `sensor_epochs` korsana da kalıcı keşif verir — bir
kez çemberine girmiş korsan, ömrü boyunca diskte kalır ve akın hedefi olmayı
sürdürür. Hafıza bir **taban**tır, tavan değil: `pirateZone` canlı `sensorZone`'u
döndürür ve yalnızca `CONTACT`'a kadar taban koyar, dolayısıyla kadro/seviye
teleskopta, kütle/silüet radarda kalır — D123'ün fidelity merdiveni delinmez.

### Katman haritası

```
packages/rules/src/pirates.ts   ← YENİ. spec, pozisyon, kadro, hazine, ceza, ödül
packages/rules/src/combat.ts    ← CombatTech → CombatSide (damageMult)
packages/rules/src/galaxy.ts    ← interceptAsteroid → paylaşılan interceptOrbit'e delege

apps/server/src/services/pirateField.ts ← YENİ. asteroidField.ts'in aynası
apps/server/src/services/pirateRaid.ts  ← YENİ. akın başlatma + çözümleme
apps/server/src/services/traffic.ts     ← İKİ yeni üretici döngü (aşağıya bak)
apps/server/src/services/session.ts     ← pendingThreads: korsan akını (aşağıya bak)
apps/server/src/services/reports.ts     ← nullable missionId/targetPlanetId
apps/server/src/services/reclaim.ts     ← boşluk enkazı + pirate_raids temizliği
apps/server/src/worker/handlers.ts      ← pirate_arrival / pirate_return

apps/web/src/galaxy/Fleets.tsx      ← ContactKind + CONTACT_STYLE + contactMarkers
apps/web/src/screens/FocusPanel.tsx ← PirateFocus rayı
apps/web/src/lib/notifications.ts   ← raid_result korsan varyantı
apps/web/src/shell/Signals.tsx      ← rapor derin bağlantısı
apps/web/src/api/schemas.ts         ← Zod kontratı
```

---

## Denetimde bulunan gedikler

> Bunlar ilk taslakta **yoktu** ve her biri feature'ı sessizce yarım bırakırdı.
> Doğrulanmış satır numaralarıyla veriyorum.

### G1 — Oyuncu KENDİ akınını göremez (kritik)

`traffic.ts:1143` mining döngüsünün ilk satırı: `if (ownedPlanets.has(run.planetId)) continue;`
Sahibinin kendi aracı traffic'ten **kasten çıkarılır**; ona özel yoldan gider.
Ve o özel yol `pendingThreads` (`session.ts:405`) **`missions` tablosuna INNER
JOIN yapıyor** (`:448-458`) — korsan akını `missions`'ta olmadığı için
kimsenin kendi akını hiçbir ekranda görünmez.

**Çözüm:** `PendingThread.kind`'a `'pirate'` eklenir ve `pendingThreads`
`pirate_raids` üzerinden ikinci bir sorgu ile UNION alır. Hedef adı sentetik
(`"Korsan Filosu L3"`), hedef koordinatı `intercept_x/y/z`.

**Neden mining gibi ayrı bir projeksiyon değil:** korsan akını **savaş filosunun
evden ayrılması**. Ev savunması şeridi, "havada bir şey var mı" dönüş kancası ve
`AWAY` durumu bunun için var. Prospector garrison değil; korsan filosu.

### G2 — İki üretici döngü gerekiyor, bir değil

İlk taslak yalnız korsan **filolarını** yayınlıyordu. Korsan **akınları** da
başkalarının gözünde uçan gerçek craft'lar; mining runs gibi ayrı bir döngüyle
`projectGalaxyTraffic`'e girmeli, aynı zone merdiveninden geçerek.

### G3 — `battle_reports` okuyucuları nullable'ı kaldırmıyor

`reports.ts` boyunca `missionId: string` non-nullable (`:49`, `:147`, `:378`) ve
rakip dünya adı `targetById.get(row.targetPlanetId)` ile çözülüyor (`:390`,
`:399`). Migration tek başına yetmez; `readBattleReports` korsan satırında
**yazıyla** karşılamalı, boş kutu çizmemeli.

### G4 — Bildirim ve rapor derin bağlantısı kopuk

- `notifications.ts:276` ve `:466` `raidResult` payload'ını parse edip
  `identity(targetUsername, targetPlanetName, ...)` ile etiket üretiyor —
  korsanda bunların hiçbiri yok.
- `Signals.tsx:348` `event.refId`'yi **mission id** sayıp rapora gidiyor.
  Korsanda refId bir akın id'si.

**Çözüm:** `raidResult` şemasına ayrık `targetKind: 'PIRATE'` + `pirateLevel`
varyantı; `identity()`'ye korsan dalı; Signals'da rapor araması `pirateRaidId`
ile de eşleşir; `notifications.raidWiped`/`raidNothing` için korsan kopyaları.

### G5 — `reclaim.ts` boşluk enkazını temizleyemiyor

`reclaim.ts:141-147` enkazı **yalnız** `planetId` veya `missionId` ile buluyor.
Boşlukta oluşan enkazın ikisi de yok → koltuk geri alındığında hayalet satır.
`pirate_raids` satırları için de temizlik yolu yok.

### G6 — Karşılıklı imha ve çarpışma penceresi belirsizdi

- **Karşılıklı imha:** `resolveCombat` DECISIVE'i "savunan sıfır + kalkan sıfır"
  diye tanımlıyor; saldıranın da sıfır olması mümkün. O zaman ganimeti eve
  taşıyacak kimse yok → **ganimet yok, gemi yok, dönüş bacağı yok**, yalnız
  rapor + enkaz. Açıkça yazılmalı yoksa hayalet dönüş bacağı doğar.
- **10 saniyelik çarpışma:** korsan hareketli. Kavga **randevu noktasında**
  olur; o 10 saniye boyunca korsanın yayınlanan konumu yörünge değil o nokta
  (istemcide zaten `engagementHold`, `scene.ts:645`). Yörüngeye devam ettirilirse
  gemiler birbirinden uzaklaşırken dövüşür.

---

## Uygulama — dilimler

> **Her dilim TDD: test yaz → FAIL → implementasyon → PASS → tüm suite → refactor.**

### Dilim 0 — Planı repoya yaz

`docs/integration-plan-pirate-fleets.md`. Uygulama boyunca güncellenir.

### Dilim 1 — `packages/rules/src/pirates.ts` (saf kurallar)

**Testler önce:** `packages/rules/test/pirates.test.ts`

```ts
export type PirateLevel = 1 | 2 | 3 | 4;

export interface PirateSpec {
  index: number;
  level: PirateLevel;
  roster: Fleet; // 2–5 gemi, türetilmiş
  hoard: Resources;
  radius;
  period;
  phase;
  inclination;
  ascendingNode;
  speed;
  appearsAt: number;
  expiresAt: number; // sezon dakikası
}
```

`constants.ts` içinde `PIRATE` bloğu — hepsi **PROVISIONAL**, docblock'ta
gerekçesiyle:

```ts
export const PIRATE = {
  damageMult:    { 1: 0.50, 2: 0.65, 3: 0.75, 4: 0.85 },  // şartname
  captureChance: { 1: 0.50, 2: 0.35, 3: 0.25, 4: 0.15 },  // hasar tablosunun tersi
  sizeMin: 2, sizeMax: 5,
  levelWeights: [0, 0.45, 0.30, 0.18, 0.07],   // toplam 1.00
  hoardValueMult: 1.4,        // korsanın kendi fleetValue'suna oran
  spawnPerPlayerPerHour: ..., // kişi başı — ölçek ölünce içerik ölür
  lifeHoursMin: 2, lifeHoursMax: 4,
  bearingMs: TRAFFIC.refreshMs * 2,   // yay-hatası notu aşağıda
} as const;
```

Fonksiyonlar (saf, `Rng` argüman olarak — A1):

- `generatePirateSchedule(rng, span, seed)` — `appendAsteroidLane` (`galaxy.ts:197`)
  şablonu. **Additive-lane disiplini zorunlu** (`galaxy.ts:258-272`): yoğunluk
  artışı mevcut bir korsanı oynatmaz, silmez, yeniden indekslemez.
- `piratePosition(spec, minutes)` — `asteroidPosition` ile aynı trig.
- `pirateActive(spec, minutes)`
- `pirateRoster(level, rng)` — **kompozisyon kuralı:**
  - havuz = `MOBILE_HULLS.filter(id => (HULLS[id].tier ?? Infinity) <= level)`
    ⚠️ `tier` BASTION/THORN/PROSPECTOR'da `null`; `?? Infinity` bunları eler.
    Çıplak `<= level` hem tip hatası verir hem yanlış olur.
  - **garantili 1 adet tam-level gemi**, ve o gemi `COMBAT_HULLS`'tan. Yoksa
    "2 Courier'lik korsan"ı hiçbir şey vurmadan soyarsın.
  - kalan 1–4 slot havuzdan serbest (SUPPORT dahil — kargo gemisi ödülün
    kendisi olur ve `combat.ts:59-64` gereği hattın arkasında korunur).
- `pirateHoard(spec, rng)` — `fleetValue(roster) * hoardValueMult`, üç kaynağa
  bölünmüş.
- `pirateStats(level)` — hasar cezasının **tek** kaynağı.
- `pirateCapture(roster, grade, rng)` — DECISIVE değilse `null`; değilse
  `captureChance[level]` ve **orijinal kadrodan** rastgele bir hull.

**"Kârlı" ne demek — süpürülecek denklem.** Tahmin değil, ölçüm:

```
E[net] = min(hoard, fleetCargo(survivors))                    // ganimet
       + (flyingValue(attackerLosses) + flyingValue(pirateLosses)) * DEBRIS.share
                                                              // enkaz (hasat edilirse)
       + captureChance[level] * E[fleetValue(1 gemi)]          // gemi
       - fleetValue(attackerLosses)                            // kayıp
       - missionFuel(...)                                      // yakıt
```

`hoardValueMult` bu ifadeyi **doğru kompozisyonlu** bir filo için pozitif
yapacak şekilde süpürülür; yanlış kompozisyon negatif kalmalı — karar oradan
doğuyor.

**Hasar cezasının bağlanması.** `combat.ts`:

```ts
export interface CombatSide {
  tech: TechLevels;
  /** Bu tarafın her atışına uygulanan çarpan. Korsan cezası; research DEĞİL. */
  damageMult?: number;
}
export interface CombatTech {
  attacker: CombatSide;
  defender: CombatSide;
}
```

`statsFor` bunu `atk`'ya çarpar. `damageMap`, `applyCasualties`,
`specialistDamage` zaten `SideStats` üzerinden okuduğu için **başka hiçbir yer
değişmez**. Üretimde 2 çağrı yeri: `handlers.ts:563`, `neutral.ts:175`.

> ⚠️ `hp`'ye dokunulmaz. Şartname "hasar atmalı" diyor — ceza yalnız saldırıda.
> L4 korsan (Cataclysm atk 800 → 680) tam HP'siyle gerçekten tehlikeli olmalı.

**Yörünge çözücüsünü paylaştır (zorunlu bitişik değişiklik).**
`interceptAsteroid` (`galaxy.ts:546`) 0.2 dk tarama + 40 geçiş bisection yapıyor.
İkinci bir kopya, bu projenin adını defalarca koyduğu "bir yerde onurlandırılıp
diğerinde unutulan kural" hatası. Çıkarılacak:

```ts
export function interceptOrbit(
  from: Vec3,
  hullSpeed: number,
  positionAt: (minutes: number) => Vec3,
  expiresAt: number,
  nowMinutes: number,
): Interception | null;
```

`interceptAsteroid` buna delege eder. **Regresyon kanıtı:** mevcut
`interception.test.ts` ve `invariants.test.ts` üretilmiş-alan taraması
**değişmeden** yeşil kalmalı — refactor öncesi ve sonrası çalıştırılır. D150'ye
"forced adjacent change" olarak kaydedilir.

### Dilim 2 — `services/pirateField.ts`

`asteroidField.ts`'in aynası. `packages/rules` `crypto` import edemez (A1);
anahtarlı determinizm sunucudan enjekte edilir (`asteroidField.ts:16` `keyedRng`).

- `privatePirateField(key)` — LRU-32 memoize
- `pirateId(key, index)` — HMAC → 22 karakter opak. **Ham index asla API'ye
  çıkmaz** (`asteroidField.ts:105` deseni, D143 kuralı)
- `pirateIndexFromId(key, field, id)` — regex + `timingSafeEqual`
- `loadPirateSnapshot(db, seasonId, now)` → `Projections`'a yeni `AsyncCache`.
  Paylaşılan snapshot'ta çağıran alanı **olmaz**; fog istek anında uygulanır.
- İsimlendirme: `Korsan L{level}-{sıra}`, sezon içinde tekil (D146 analoğu).

**Migration — `pirate_state`:**

```
(season_id, index) PK
losses                 jsonb NOT NULL DEFAULT '{}'
destroyed_at           timestamptz
destroyed_by_player_id uuid REFERENCES players(id)
```

Satır yoksa = el değmemiş. Canlı kadro = `roster(spec) − losses`.

### Dilim 3 — Akın: `services/pirateRaid.ts` + worker

**Migration — `pirate_raids`** (`miningRuns` şablonu):

```
id, season_id, planet_id (origin), pirate_index,
status ('outbound'|'returning'|'done'),
fleet jsonb, tech jsonb,           -- doktrin fırlatmada donar (D137)
intercept_x/y/z, depart_at, arrive_at, home_at,
loot jsonb, captured_hull text
UNIQUE (planet_id, pirate_index) WHERE status <> 'done'
```

**Migration — `battle_reports`:**

- `target_kind` → `'PLAYER' | 'NEUTRAL' | 'PIRATE'`
- `mission_id`, `target_planet_id` **nullable**
- `pirate_raid_id` eklenir
- CHECK: tam olarak bir hedef bağlayıcısı dolu
- **G3**: `reports.ts` okuyucuları güncellenir.

**Migration — `debris_fields` (boşluk enkazı):**
`planet_id` nullable + `x/y/z` + CHECK. `projectVisibleDebris` (`mining.ts:162`),
`launchHarvest` (`mining.ts:998` gezegen satırından koordinat okuyor) ve
`Wrecks.tsx:110` (`byId.get(w.planetId)`) alandan okuyacak şekilde güncellenir.
**G5**: `reclaim.ts:141-147` boşluk enkazını ve `pirate_raids` satırlarını da
toplar.

> Bu en pahalı parça ve **ayrı commit'e alınabilir.** İlk turda korsan savaşı
> neutral gibi yalnız saldırganın enkazını bıraksın, boşluk enkazı ikinci
> commit'te açılsın — meşru bir küçültme. Öyle yapılırsa **D150'de kaydedilir.**

**`launchPirateRaid(...)`** — kanonik sıra korunur:

```
lock → advance economy → assertWorldOperational → filo elde mi?
  → assertFreeBay                                    (D28, tek kıtlık)
  → pirateActive? → zaten akın var mı? (unique index de korur)
  → sensorZone(spheres, piratePosition(now)) !== 'NONE'    ← FOG KAPISI
  → interceptOrbit(...) → yoksa CANNOT_INTERCEPT
  → missionFuel(fleet, |origin−intercept|, legs: 2) → assertFuel   (D136)
  → assertSeasonOpenThrough(arrive + dönüş)
  → insert pirate_raids → setUnits(planetId, fleet, `pirate:${raidId}`)
  → schedule('pirate_arrival') → publishShard → publish(private)
  → recomputePlayerWealth
```

- **Fog kapısı canlı görüş şart.** Sensöründen çıkmış bir korsanı "hatırlayıp"
  vuramazsın; seçilen model bu.
- **Yakıt temiz çıkıyor:** dönüş randevu noktasından aynı gezegene → `legs: 2`
  × aynı mesafe. Ek kural gerekmiyor. **Başarısızlıkta iade yok** (D136).
- **Bağlanmayacaklar:** `attack_commitments` yok, klan kotası yok, `canAttack`/
  `bashLimit` yok, rakip (D103) tetiklenmez — karşı tarafta oyuncu yok.

**`onPirateArrival`:**

```
claimRaid (durum çevirir → idempotent; yeniden teslim çözülmüş bulur)
lock season → lock origin planet → lock pirate_state FOR UPDATE
                                   (sıra: oyuncular → gezegenler → korsan)
canlı kadro = roster − losses
kadro boşsa → returnUntouched            (yarışı başkası kazanmış)
resolveCombat(fleet, kadro, shield: 0, seededFrom(raidId), {
  attacker: { tech: raid.tech },
  defender: { tech: {}, damageMult: PIRATE.damageMult[level] },
})
losses += defenderLosses; DECISIVE ise destroyed_at/by
saldıran hayatta kalan YOKSA → ganimet yok, gemi yok, dönüş yok  (G6)
computeLoot(hoard, {0,0,0}, EMPTY_VAULT, grade, fleetCargo(survivors, raid.tech))
pirateCapture(...) → captured_hull
debris: (flyingValue(attackerLosses) + flyingValue(defenderLosses)) * DEBRIS.share
battleReports insert: targetKind 'PIRATE', dominionSwing 0, bookBattle ÇAĞRILMAZ
notify 'raid_result' (mevcut kind — bildirim listesi kapalı kalır)
survivors varsa → dönüş bacağı + schedule('pirate_return')
```

**Chronicle: kayıt yok.** D96 yalnız o anda meşruen public olan geçişleri
kaydeder; boşluktaki bir korsan ölümü public değil.

**`onPirateReturn`:** ganimet depoya, hayatta kalanlar + **ele geçirilen gemi**
`addUnits` ile eve, `recomputePlayerWealth`. D133 açık: **yakalamadan doğan
hangar taşması yasaldır ve silinmez** — yalnız yeni girişi engeller. Dönüş yolu
`landingBlock`'a takılmaz. `builtEver` **artmaz** (o sütun ne inşa ettiğini
sayar, ne sahip olduğunu değil).

`eventKind` enum'una `pirate_arrival`, `pirate_return` (append-only).

### Dilim 4 — Fog projeksiyonu: `traffic.ts` **iki** yeni döngü

**(a) Korsan filoları.**

```ts
for (const spec of activePirates) {
  const at   = piratePosition(spec, nowMinutes);
  const zone = zoneAt(at);                    // ← sight.ts, tek otorite
  if (zone === 'NONE') continue;

  const ahead = engaging(spec) ? at : piratePosition(spec, nowMinutes + bearingMin);
  if (zone === 'CONTACT') {
    const reveal = radarReveal(at);
    out.push({ id: pirateId(key, spec.index), kind: 'unknown', from: at, to: ahead, ...,
      ...(reveal.size ? { mass: massClass(livingRoster) } : {}),
      ...(reveal.kind ? { silhouette: 'pirate' } : {}) });
    continue;
  }
  out.push({ id, kind: 'pirate', from: at, to: ahead, ...,
    mass: massClass(livingRoster), fleet: livingRoster, level: spec.level });
}
```

**(b) Korsan akınları** (G2) — mining döngüsünün eşi, `if (ownedPlanets.has(...)) continue;`
dahil; sahibi kendi akınını `pendingThreads`'ten alır (G1).

> ⚠️ **Yay hatası — bu tuzağı kaçırma.** `windowOf` düz bacak için yazılmış.
> Korsan kapalı yörüngede: tur süresi `2πr/v`, asteroid parametre aralığında
> ~8–90 dakika. `TRAFFIC.bearingMinutes` (4 dk) penceresi en kısa turda **180°'ye
> yakın yay** demek; düz kiriş görünür biçimde yanlış olur ve gemi yörüngenin
> içinden geçer. Korsan penceresi bu yüzden ayrı ve kısa:
> `PIRATE.bearingMs = TRAFFIC.refreshMs * 2` (10 sn) → en kötü durumda ~7° yay,
> gözle ayırt edilemez. İstemcinin `COAST_MS = 3000` payı geç okumayı kapatır.
> **Pencere `TRAFFIC.refreshMs`'in altına inemez** — CLAUDE.md'nin "yayınlanan
> pencere asla bir refetch'ten kısa olamaz" kuralı; `bearingMs` o sabitten
> **türetilir**, ayrı bir sayı olarak yazılmaz.

**`ContactKind`'a `'pirate'`** (sunucu `traffic.ts:170`, istemci `schemas.ts:1671`
ve `:1687`). `level` yalnız IDENTIFIED'da.

**Yayınlanmayanlar:** yörünge elemanları (radius/period/phase/inclination/
ascendingNode), ham index, hazine miktarı. Yörünge = rota, ve seçilen model
rotayı yasaklıyor.

**Çarpışma anı (G6):** `engagement: { arriveAt, endsAt, target }` **yalnız**
`sensorZone(at) !== 'NONE'` olan gözlemciye. Dünya vakasında koordinat zaten
public; korsanda değil.

### Dilim 5 — İstemci

**Render: neredeyse bedava.** `Foreign` (`Fleets.tsx:1901`) → `contactMarkers`
(`:1675`) `contact.fleet` varsa zaten gerçek hull GLB'lerini ve tam-sayı pip'leri
çiziyor. Gereken:

- `CONTACT_STYLE` (`:1627`) + `CONTACT_TITLE`'a `'pirate'` — neon rengi oyuncu
  filosundan ayırt edilmeli (`visual-design.md:130-141`: "hue kategoriyi taşır").
- `contactMarkers`'a `'pirate'` dalı → `markersFor(contact.fleet)`.
- `GalaxyCanvas.tsx:270-357` kamera `subject` dalı.
- Kendi akını: `pendingThreads`'ten gelen `'pirate'` thread'i mevcut own-fleet
  çizim yoluna girer (yeni bileşen gerekmez).

**Etkileşim — asıl iş.** `ContactFocus` (`FocusPanel.tsx:1968`) bugün **tamamen
okunur, hiç eylemi yok.** Yeni `PirateFocus`, `AsteroidFocus` (`:1527`)
şablonundan:

- Seviye rozeti + hasar cezası **yazıyla** ("Bu filo %35 daha az hasar verir") —
  D124: göremediğin kural kural değildir.
- IDENTIFIED'da kadro çipleri; CONTACT'ta yalnız `?` + (Radar 4/5'te) kütle/kind.
- **Randevu teklifi:** `reachMinutes` + korsanın kalan ömrü. `tooLate` reddi
  `AsteroidFocus:1584` ile aynı — sebebi yazılı, satır kaybolmaz.
- Filo seçici + `LaunchSheet`'in ev-savunması güç çubuğu. D144 kelime dağarcığı
  (`SpendBar`/`Tally`/`FlightBar`); **yeni şekil icat edilmez.**
- Onay sayfası **geri çağrılamaz** uyarısını taşır (`interface.md:66`).
- Savaş animasyonu : ilk ulaşan filo ile korsan filosu durdurulur -> korsan filosu gelen filoya döner var karşılıklı bombardıman(hazır animasyon var) animasyonu başlar.
  filo savaş'ı kazanırsa -> diger gelen tüm filoların görevleri iptal olur ve oldukları yerden geri dönerler. Ancak korsanlar kazanırsa: kalan korsan filosu yoluna devam eder ve onlara doğru gelen diger filoların rotaları yeniden hesaplanır (10sn savaştıkları için rotada sapma olacak görsel olarak yanlış konumlandırma savaşı olmamalı.) döngü bu şekilde devam eder.
  Görüş alanı içindeki tüm herkes aynı anda aynı animasyonu aynı savaşı yanı rotaları izler. (hareket halindeki asteroidlere kazıcı yollama logic'inin biraz daha gelişmiş hali gibi düşünebilirsin.)
  **Randevu önizlemesi sunucudan gelir.** İstemci `interceptOrbit`'i kendi
  çalıştırırsa iki farklı dakika çıkar. `GET /api/pirates` her görünür korsan için
  çağıranın seçili dünyasından hesaplanmış `reachMinutes` taşır.

**Bildirim ve rapor (G4):** `raidResult` şemasına `targetKind: 'PIRATE'` +
`pirateLevel`; `identity()`'ye korsan dalı; `Signals.tsx:348` rapor araması
`pirateRaidId`'yi de eşler.

**i18n:** tüm dizeler `apps/web/src/i18n/locales/{tr,en}/`. Türkçe doğal
yazılacak, `İ` naif case-fold edilmeyecek.

### Dilim 6 — Rotalar + kontrat

```
GET  /api/pirates       → görünür korsanlar (fog uygulanmış) + reachMinutes
POST /api/pirates/raid  → { originPlanetId?, pirateId, fleet }
```

`routes/mining.ts:239` deseni: `requireAuth`, strict Zod body, iş mantığı
serviste, ham index yanıttan **strip** edilir, refuse'lar `GameError`,
rate-limit reddi de `GameError`.

`apps/web/src/api/schemas.ts` şemaları yazılır; `contract.test.ts` bunları parse
eder — düz parse **artı** düz parse'ın erişemediği her opsiyonel alan için birer
vaka (`contract.test.ts:755-808` şablonu).

### Dilim 7 — Dokümantasyon (kodla birlikte)

- `docs/decisions.md` → **D150 · Korsan filoları**: karar tablosu, post-MVP
  kapsam kararı, D11'e karşı `SideStats` gerekçesi, sıfır Dominion,
  `interceptOrbit` forced adjacent change, "Binds:" satırı.
- `docs/game-design.md` → korsan bölümü + **yarattığı kararın adı** (doküman
  kendi kapısını koyuyor: karar üretmeyen sistem oraya yazılmaz).
- `docs/balance.md` → `PIRATE` sabitleri, `E[net]` denklemi, çevrilebilir ve
  **yasak** kelebekler.
- `docs/review-sight.md` → §7.1 geçiş matrisine korsan satırı.
- `docs/glossary.md` → korsan filosu, korsan seviyesi, ele geçirme.
- `CLAUDE.md` → invariant satırları + "Current state".

---

## Kırabileceğimiz çalışan logic'ler

| #   | Nerede                           | Ne kırılır                                                                                                                             | Korunma                                                                                                                    |
| --- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | `combat.ts` `SideStats`          | `damageMult` `atk`'ya uygulanıp `applyCasualties`'te unutulursa hasar havuzu ile kayıp ayrışır — bu dosyanın **en iyi sakladığı** hata | Ceza yalnız `statsFor` içinde. Test: `defenderDamage` beklenen oranda düşsün **ve** `attackerLosses` onunla tutarlı olsun. |
| 2   | `interceptAsteroid`              | Paylaşılan çözücüye çıkarma madenciliği bozar                                                                                          | Mevcut `interception.test.ts` + `invariants.test.ts` alan taraması **değişmeden** yeşil. Refactor öncesi/sonrası çalıştır. |
| 3   | `traffic.ts` fog                 | `zoneAt` bacağa uygulanırsa "yakınından geçen her şeyin tüm uçuşu" yayınlanır (`review-sight.md:387-400`)                              | `zoneAt(at)` **anlık konuma**. `sensor-horizon.test.ts`'e korsan geçiş matrisi.                                            |
| 4   | Pencere ↔ `TRAFFIC.refreshMs`    | Ayrışırsa "her korsan nereye uçtuğunu yayınlar" — CLAUDE.md bu hatanın yaşandığını yazıyor                                             | `bearingMs` `refreshMs`'ten **türetilir**; test bu ilişkiyi assert eder.                                                   |
| 5   | `pendingThreads` (G1)            | Oyuncu kendi akınını göremez → "filom kayboldu"                                                                                        | `'pirate'` kind + `pirate_raids` UNION; test: fırlatma yanıtında thread var.                                               |
| 6   | `reports.ts` (G3)                | Null gezegende patlar veya boş kutu çizer                                                                                              | Migration ile birlikte okuyucular; `reports.test.ts`'e PIRATE vakası.                                                      |
| 7   | Bildirim/derin bağlantı (G4)     | Etiket boş, rapor açılmaz                                                                                                              | `raidResult` varyantı + Signals eşlemesi; `notifications.test.ts` vakası.                                                  |
| 8   | `debris_fields` / `reclaim` (G5) | `launchHarvest` ve `Wrecks.tsx` gezegenden koordinat okuyor → boşluk enkazında çöker; reclaim hayalet bırakır                          | CHECK + iki okuyucu + reclaim; `debris.test.ts`'e boşluk vakası.                                                           |
| 9   | `units.location` ad alanı        | `pirate:${id}` mission id sanılırsa filo iki yerde sayılır / kaybolur                                                                  | Mining'in `mine:${id}` deseni birebir; `fleetOfMission`/`clearMissionUnits` sınır testleri.                                |
| 10  | Hangar / `landingBlock`          | Ele geçirilen gemi hangarı taşırırsa iniş reddedilir → **gemi buharlaşır**                                                             | D133 taşmayı yasal sayar. Dönüş `landingBlock`'a takılmaz. Test: dolu hangara yakalanmış gemiyle dön.                      |
| 11  | Dominion sıfır-toplam            | Korsandan skor sızarsa `invariants.test.ts` property testi kırılır                                                                     | `bookBattle` **çağrılmaz**, `dominionSwing: 0`. Test: savaş öncesi/sonrası ledger birebir aynı.                            |
| 12  | Uçuş yatakları                   | Korsan akını yatak tüketmezse D28'in tek kıtlığı delinir                                                                               | `assertFreeBay` yörünge çözümünden **önce** (mining'in sırası).                                                            |
| 13  | Eşzamanlılık                     | İki dünya aynı korsanı aynı anda vurursa `losses` kaybolur                                                                             | `pirate_state` `FOR UPDATE`, kilit sırası gezegenden sonra. `concurrency.test.ts`.                                         |
| 14  | Idempotency                      | Reaper yeniden teslim ederse çift ganimet / çift gemi                                                                                  | `claimRaid` durum çevirir; `notify` `(player, kind, refId)` ile zaten idempotent.                                          |
| 15  | Karşılıklı imha (G6)             | Sıfır hayatta kalanla dönüş bacağı → hayalet uçuş                                                                                      | Açık dal: ganimet/gemi/dönüş yok, yalnız rapor + enkaz.                                                                    |
| 16  | Sezon devri                      | Korsan durumu kalırsa hayalet satırlar                                                                                                 | `servers.ts:553` deseniyle temizlik; `season-lifecycle.test.ts` vakası.                                                    |
| 17  | `AWAY` durumu                    | Korsan akınındaki filo evde sayılırsa savunma yalan söyler                                                                             | Origin dünyası akın süresince `AWAY` okur — bu bir raid, mining değil.                                                     |
| 18  | Ekonomi muslukları               | Kârlı korsan `VFR`/`ARR`/`TAX`'i oynatır                                                                                               | Yasaklı olmayan kelebekler. Bandlar/loot grade/hull HP/hangar sabitlerine **dokunulmaz**.                                  |

---

## Doğrulama

**1. Kapı:**

```bash
pnpm verify      # 0 type error, 0 lint error, beklenen testler yeşil
```

`pnpm lint` kök script'ten 4 GB heap alır — çıplak `eslint .` ile atlanmaz.
Migration'lar yeni imajdan önce; `assertSchemaCurrent` kodun DB'nin önünde
olmasını reddeder.

**2. Yeni test dosyaları:**

- `packages/rules/test/pirates.test.ts` — spec determinizmi, kadro kuralı
  (min/max, garantili tam-level combat hull, `tier: null` sızıntısı yok),
  hasar cezası, ele geçirme dağılımı, yörünge pozisyonu
- `packages/rules/test/combat.test.ts` — `damageMult` hem hasarda hem kayıpta
- `packages/rules/test/interception.test.ts` — `interceptOrbit` sonrası asteroid
  davranışı **bit-bit aynı**
- `apps/server/test/pirate-raid.test.ts` — fırlatma reddi (fog dışı, yatak yok,
  yakıt yok, zaten akın var, randevu yok), çözümleme, kargo tavanı, yakalama,
  enkaz, sıfır Dominion, karşılıklı imha
- `apps/server/test/pirate-fog.test.ts` — üç bölge geçiş matrisi, rota/ham index
  sızıntısı yok, çarpışma anı fog-kapılı
- `apps/server/test/concurrency.test.ts` — iki dünya, tek korsan
- `apps/server/test/contract.test.ts` — iki yeni rota
- `apps/web/test/pirate-focus.test.tsx` — ray, reddetme durumları, i18n

**3. Uçtan uca elle:**

```bash
node tools/visual.mjs
```

- Korsan gerçek hull asset'leriyle çiziliyor mu; yörünge yay hatası gözle görülüyor mu
- Sensör çemberinin dışından içine geçen bir korsanın **belirdiği anı** izle
- Radar 3 (`?`) → Radar 5 (silüet) → Teleskop (tam kadro) merdiveni
- Bir akın fırlat: **kendi akınını göründüğünü doğrula (G1)**, 10 saniyelik
  çarpışmayı izle, dönüşte ganimeti + gemiyi gör
- Bildirime tıkla → rapor açılsın (G4)
- Boşlukta oluşan enkaza Prospector gönder (G5)

**4. Playtest — bu ölçülmeden "bitti" denmez** (`docs/playtest-log.md`):

- Bir oturumda kaç korsan görülüyor? Sıfırsa `spawn` veya `SENSOR.baseRadius`
  çevrilir (ikisi de yasaklı liste dışında)
- Ödül "kârlı" mı hissettiriyor, yoksa **zorunlu angarya** mı oldu? İkincisi
  CLAUDE.md'nin "micromanagement grows" regresyon sinyali
- Korsan avı PvP'nin **yerini mi alıyor**? Alıyorsa bu "resources replace players
  as the fun" sinyalidir → ödül küçültülür, **bandlar değil**

---

## Sıralama

Dilim 1–3 oynanamaz ama tamamen test edilebilir; oradaki hata en ucuz orada
yakalanır. Boşluk-enkazı migration'ı (Dilim 3'ün son parçası) diğerlerinden
bağımsız ve en pahalısı — ilk turda neutral davranışıyla (yalnız saldırganın
enkazı) gidip ikinci commit'te açmak meşru bir küçültme, ve öyle yapılırsa
**planda değil, D150'de** kaydedilir.

---

# Ek A — Migration DDL taslağı

> Drizzle şeması yazılır, `pnpm db:generate` migration'ı üretir. Aşağıdaki DDL
> **niyetin ifadesi**; elle yazılmaz. `MULTI_WORLD.pirateRulesetVersion` eklenir.

## A.1 `pirate_state` — türetilemeyen tek mutasyon

```sql
CREATE TABLE pirate_state (
  season_id              uuid NOT NULL REFERENCES seasons(id),
  index                  integer NOT NULL,
  losses                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  destroyed_at           timestamptz,
  destroyed_by_player_id uuid REFERENCES players(id),
  PRIMARY KEY (season_id, index)
);
```

Satır yokluğu = el değmemiş korsan. `asteroid_claims` ile aynı felsefe:
**yalnızca dünyanın formülden türetilemeyen kısmı saklanır.**

## A.2 `pirate_raids` — akın (`mining_runs` şablonu)

```sql
CREATE TYPE pirate_raid_status AS ENUM ('outbound', 'returning', 'done');

CREATE TABLE pirate_raids (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id     uuid NOT NULL REFERENCES seasons(id),
  planet_id     uuid NOT NULL REFERENCES planets(id),   -- origin
  pirate_index  integer NOT NULL,
  status        pirate_raid_status NOT NULL DEFAULT 'outbound',
  fleet         jsonb NOT NULL,
  tech          jsonb,                                   -- fırlatmada donar (D137)
  intercept_x   real NOT NULL,
  intercept_y   real NOT NULL,
  intercept_z   real NOT NULL,
  depart_at     timestamptz NOT NULL,
  arrive_at     timestamptz NOT NULL,
  home_at       timestamptz,
  loot          jsonb,
  captured_hull text
);

CREATE INDEX pirate_raids_planet_idx ON pirate_raids (planet_id, status);
CREATE INDEX pirate_raids_season_idx ON pirate_raids (season_id, status);

-- "Dünya başına tek akın" — yarışı veritabanı garanti eder, kontrol değil.
CREATE UNIQUE INDEX pirate_raids_planet_target_idx
  ON pirate_raids (planet_id, pirate_index) WHERE status <> 'done';
```

## A.3 `battle_reports` — üçüncü hedef türü

```sql
ALTER TABLE battle_reports ALTER COLUMN mission_id       DROP NOT NULL;
ALTER TABLE battle_reports ALTER COLUMN target_planet_id DROP NOT NULL;
ALTER TABLE battle_reports ADD COLUMN pirate_raid_id uuid REFERENCES pirate_raids(id);

-- Tam olarak bir hedef bağlayıcısı. Konvansiyon değil, kısıt.
ALTER TABLE battle_reports ADD CONSTRAINT battle_reports_one_target CHECK (
  (target_kind IN ('PLAYER','NEUTRAL')
     AND mission_id IS NOT NULL AND target_planet_id IS NOT NULL
     AND pirate_raid_id IS NULL)
  OR
  (target_kind = 'PIRATE'
     AND pirate_raid_id IS NOT NULL
     AND mission_id IS NULL AND target_planet_id IS NULL)
);
```

`targetKind` TS tipi `'PLAYER' | 'NEUTRAL' | 'PIRATE'` olur.

## A.4 `debris_fields` — boşluk enkazı _(ayrı commit'e alınabilir)_

```sql
ALTER TABLE debris_fields ALTER COLUMN planet_id DROP NOT NULL;
ALTER TABLE debris_fields ADD COLUMN x real;
ALTER TABLE debris_fields ADD COLUMN y real;
ALTER TABLE debris_fields ADD COLUMN z real;
ALTER TABLE debris_fields ADD COLUMN pirate_raid_id uuid REFERENCES pirate_raids(id);

ALTER TABLE debris_fields ADD CONSTRAINT debris_fields_one_anchor CHECK (
  (planet_id IS NOT NULL AND x IS NULL AND y IS NULL AND z IS NULL)
  OR
  (planet_id IS NULL AND x IS NOT NULL AND y IS NOT NULL AND z IS NOT NULL)
);
```

> `pirate_raid_id`, `reclaim.ts`'in boşluk enkazını bulabilmesi için. Bugün
> `reclaim.ts:141-147` yalnız `planet_id`/`mission_id` ile arıyor; bu sütun
> olmadan boşluk enkazı hayalet kalır (G5).

## A.5 Enum'lar — append-only

```sql
ALTER TYPE event_kind ADD VALUE 'pirate_arrival';
ALTER TYPE event_kind ADD VALUE 'pirate_return';
```

`notification_kind` **değişmez** — mevcut `raid_result` yeniden kullanılır,
böylece "on üç bildirim ve liste kapalı" kuralı korunur.

---

# Ek B — Dokunulacak dosyalar, tam liste

## B.1 `packages/rules` (saf — clock/IO/rastgelelik yok)

| Dosya              | Değişiklik                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pirates.ts`   | **YENİ.** `PirateSpec`, `generatePirateSchedule`, `piratePosition`, `pirateActive`, `pirateRoster`, `pirateHoard`, `pirateStats`, `pirateCapture` |
| `src/constants.ts` | **YENİ** `PIRATE` bloğu; `MULTI_WORLD.pirateRulesetVersion`                                                                                       |
| `src/types.ts`     | `PirateLevel`; `Hull.tier` zaten var, **yeni tip eklenmiyor**                                                                                     |
| `src/combat.ts`    | `CombatTech` → `CombatSide` (`{ tech, damageMult? }`); `statsFor` çarpanı uygular                                                                 |
| `src/galaxy.ts`    | `interceptOrbit` çıkarılır; `interceptAsteroid` ona delege eder                                                                                   |
| `src/index.ts`     | Yeni public yüzeylerin re-export'u                                                                                                                |

## B.2 `apps/server`

| Dosya                         | Değişiklik                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `src/db/schema.ts`            | Ek A'daki dört tablo/değişiklik                                                                                           |
| `src/services/pirateField.ts` | **YENİ.** `keyedRng`, `privatePirateField`, `pirateId`, `pirateIndexFromId`, `loadPirateSnapshot`, `projectPlayerPirates` |
| `src/services/pirateRaid.ts`  | **YENİ.** `launchPirateRaid`, `resolvePirateArrival`, `resolvePirateReturn`, `returnUntouched`                            |
| `src/services/projections.ts` | `pirates` `AsyncCache` girdisi + invalidation dalları                                                                     |
| `src/services/traffic.ts`     | `ContactKind` += `'pirate'`; **iki** yeni üretici döngü (filolar, akınlar)                                                |
| `src/services/session.ts`     | `PendingThread.kind` += `'pirate'`; `pendingThreads` `pirate_raids` UNION'ı **(G1)**                                      |
| `src/services/reports.ts`     | `missionId`/`targetPlanetId` nullable; PIRATE satırı için isim/etiket dalı **(G3)**                                       |
| `src/services/reclaim.ts`     | Boşluk enkazı + `pirate_raids` temizliği **(G5)**                                                                         |
| `src/services/servers.ts`     | Sezon sıfırlamada yeni tablolar                                                                                           |
| `src/worker/handlers.ts`      | `onPirateArrival`, `onPirateReturn`; `HANDLERS` kaydı                                                                     |
| `src/routes/pirates.ts`       | **YENİ.** `GET /api/pirates`, `POST /api/pirates/raid`                                                                    |
| `src/app.ts`                  | Rota kaydı `app.after()` içinde                                                                                           |

## B.3 `apps/web`

| Dosya                                          | Değişiklik                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/api/schemas.ts`                           | `piratesSchema`, `pirateRaidSchema`; `trafficSchema` contact enum'una `'pirate'` + `level` |
| `src/api/keys.ts` · `client.ts` · `queries.ts` | `usePirates`, `usePirateRaid`; `useContactWindows` korsanları da kapsar                    |
| `src/galaxy/Fleets.tsx`                        | `CONTACT_STYLE` + `CONTACT_TITLE` + `contactMarkers` korsan dalı                           |
| `src/galaxy/GalaxyCanvas.tsx`                  | Kamera `subject` dalı                                                                      |
| `src/screens/FocusPanel.tsx`                   | `Focus` varyantı + `PirateFocus` rayı                                                      |
| `src/lib/notifications.ts`                     | `raidResult` PIRATE varyantı; `identity()` korsan dalı **(G4)**                            |
| `src/shell/Signals.tsx`                        | Rapor derin bağlantısı `pirateRaidId`'yi de eşler **(G4)**                                 |
| `src/i18n/locales/{tr,en}/`                    | Ek C                                                                                       |

---

# Ek C — i18n anahtarları

`apps/web/src/i18n/locales/{tr,en}/`. Türkçe doğal yazılır; `İ` naif
case-fold **edilmez**.

```
pirate.title                 "Korsan Filosu"
pirate.level                 "Seviye {level}"
pirate.damagePenalty         "Bu filo %{percent} daha az hasar verir"
pirate.roster                "Kadro"
pirate.unknownContact        "Tanımlanamayan temas"
pirate.reach                 "{minutes} dk sonra yetişir"
pirate.tooLate               "Yetişemeden bölgeden ayrılır"
pirate.alreadyRaiding        "Bu dünyadan zaten bir akın yolda"
pirate.outOfSight            "Sensör menzilinde değil"
pirate.captureHint           "Zafer hâlinde kadrodan bir gemi kazanma şansı"
pirate.captured              "{hull} ele geçirildi"
pirate.captureMissed         "Ele geçirilebilir gemi kalmadı"
notifications.raidResultPirate      "Korsan filosuna (S{level}) akın: {detail}"
notifications.raidWipedPirate       "Korsan filosu (S{level}) filonu yok etti — {count} gemi kayıp"
```

Sunucu `GameError` kodları (`i18n/errors.ts`): `CANNOT_INTERCEPT`,
`PIRATE_GONE`, `ALREADY_RAIDING_PIRATE`, `PIRATE_OUT_OF_SIGHT`.

---

# Ek D — Uygulama kontrol listesi

> Her satır TDD: **test yaz → FAIL → implementasyon → PASS → tüm suite.**
> `pnpm verify` her dilimin sonunda yeşil olmalı.

## D0 · Hazırlık

- [x] Planı `docs/integration-plan-pirate-fleets.md` olarak yaz
- [x] `docs/decisions.md`'ye **D150** taslağını yaz (kod yazmadan önce karar sabitlenir)

## D1 · Saf kurallar

- [x] `packages/rules/test/pirates.test.ts` — spec determinizmi, kadro kuralı, hazine, ceza, ele geçirme, yörünge
- [x] `PIRATE` sabitleri + `MULTI_WORLD.pirateRulesetVersion`
- [x] `packages/rules/src/pirates.ts`
- [x] `combat.ts` `CombatSide`/`damageMult`; iki üretim çağrı yeri + `combat.test.ts` güncellenir
- [x] `interceptOrbit` çıkarımı; `invariants.test.ts` üretilmiş-alan taraması **değişmeden** yeşil (570/570)
- [x] `index.ts` re-export

## D2 · Sunucu alanı

- [x] `pirate_state` şeması + migration
- [x] `services/pirateField.ts` + `test/pirate-field.test.ts` (opak id, ham index sızıntısı yok)
- [x] `Projections` girdisi + invalidation

## D3 · Akın

- [x] `pirate_raids` + `battle_reports` migration'ları
- [x] `reports.ts` nullable okuyucuları **(G3)** + `reports.test.ts` PIRATE vakası
- [x] `services/pirateRaid.ts` `launchPirateRaid` + `test/pirate-raid.test.ts` (tüm reddetmeler)
- [x] `onPirateArrival` — karşılıklı imha dalı dahil **(G6)**
- [x] `onPirateReturn` — ganimet, gemi, hangar taşması **(D133)**, `builtEver` artmaz
- [x] `concurrency.test.ts` — iki dünya tek korsan
- [x] `season-lifecycle.test.ts` + `servers.ts` temizlik

## D4 · Fog

- [x] `ContactKind` += `'pirate'` (sunucu + istemci şeması)
- [x] `traffic.ts` korsan filoları döngüsü
- [x] `traffic.ts` korsan akınları döngüsü **(G2)**
- [x] `pendingThreads` korsan akını **(G1)** + fırlatma yanıtı testi
- [x] `test/pirate-fog.test.ts` — üç bölge matrisi, rota/index sızıntısı yok, çarpışma fog-kapılı
- [x] `bearingMs ↔ TRAFFIC.refreshMs` ilişki testi

## D5 · Enkaz _(ayrı commit — ERTELENDİ, D150'de kayıtlı)_

- [ ] `debris_fields` migration
- [ ] `projectVisibleDebris` · `launchHarvest` · `Wrecks.tsx` konumu alandan okur
- [ ] `reclaim.ts` boşluk enkazı + `pirate_raids` **(G5)**
- [ ] `debris.test.ts` boşluk vakası

## D6 · Rotalar + kontrat

- [x] `routes/pirates.ts` + `app.ts` kaydı
- [x] `schemas.ts` + `contract.test.ts` (düz parse **ve** her opsiyonel alan)

## D7 · İstemci

- [x] `CONTACT_STYLE` · `CONTACT_TITLE` · `contactMarkers` · kamera `subject`
- [x] `PirateFocus` rayı + `Focus` varyantı + `pirate-focus.test.tsx`
- [x] Bildirim varyantı + Signals derin bağlantısı **(G4)** + `notifications.test.ts`
- [x] i18n TR/EN (Ek C)

## D8 · Kapanış

- [ ] `node tools/visual.mjs` — görsel doğrulama listesi (Doğrulama §3)
- [x] `docs/`: decisions · game-design · balance · review-sight · glossary · CLAUDE.md
- [x] `pnpm verify` yeşil — 0 tip / 0 lint hatası; rules 573, sim 87, server 52 dosya, web 124/126 (kalan 2 dosya: `film-*`, korsanla ilgisiz, önceden kırık)

---

# Ek E — Karar öncesi cevapsız kalanlar

Uygulama sırasında **ölçülerek** kapanacak, tahminle değil:

1. **`spawnPerPlayerPerHour` ve ömür.** Bir oturumda kaç korsan görülmeli?
   Ölçüm aracı `tools/asteroid-visibility-study.ts`'in korsan eşleniği:
   üretilmiş oyuncu konumlarına karşı p90:p10 fırsat oranı.
2. **`hoardValueMult`.** `E[net]` denklemi doğru kompozisyonda pozitif, yanlış
   kompozisyonda negatif olacak şekilde süpürülür.
3. **Yörünge hız aralığı.** Korsan bir kayadan farklı okumalı — asteroid
   aralığı başlangıç noktası, ama tur süresi yay-hatası tavanını belirlediği
   için `PIRATE.bearingMs` ile birlikte seçilir.
4. **Korsan neon rengi.** `visual-design.md:149-153`: yeterli kalitede asset
   üretilemiyorsa **düşük kaliteli yaklaşım gönderilmez, sorulur.** Mevcut hull
   GLB'leri yeniden kullanıldığı için burada gereken tek şey bir renk kimliği.

---

# Ek F — Uygulama sonrası code review (kapandı)

Uygulama bittikten sonra yapılan incelemede yedi gerçek bulgu çıktı ve hepsi
düzeltildi. Buraya yazılıyor çünkü ikisi planın kendi kararlarından sapmıştı ve
biri süiti sessizce güvenilmez hâle getirmişti.

**1 · Traffic testleri deterministik değildi (P0).** `seasons.asteroidKey`
`defaultRandom()` ve korsanın keşif kapısı yok — yani her koşuda farklı bir hat
üretiliyor ve rastgele bir korsan herhangi bir testin sensör küresine girebiliyordu.
`sensor-horizon.test.ts` sekiz koşuda ikisinde düşüyordu. Düzeltme: fixture sezon
anahtarını **sabitler** ve korsan hattını **varsayılan olarak kapatır**
(`silencePirates`, gerçek `pirate_state.destroyed_at` yolundan, tek
`generate_series` cümlesiyle); korsan testleri `{ pirates: true }` ile açar.
Kayalar zaten böyle çalışıyordu — bir testin istemediği içerik onun
assertion'larına giremez. Ölçüm: 2/8 → **0/8**.

**2 · Enkaz hiç oluşmuyordu (P1).** Onaylanmış karar "iki taraf da, PvP gibi"
idi; kod `void debrisFields;` ile hiçbir saha yaratmıyordu — saldırganın kendi
kayıpları bile iz bırakmadan yok oluyordu. `debris_fields` artık nullable
`planet_id`, kendi `x/y/z`'si ve `pirate_raid_id` taşıyor; `launchHarvest`,
`projectVisibleDebris`, `Wrecks` ve `DebrisFocusHost` konumu gezegenden değil
alandan okuyor. Yan fayda: dünyası çağıranın payload'ında olmayan bir enkaz
artık kaybolmuyor.

**3 · `cargoLimited` sabit `false`'du (P1).** Oyuncuya "ambarın doldu, ganimet
bıraktın" hiç söylenmiyordu — planın "asıl gaz kelebeği kargo tavanıdır" tezinin
görünür yüzü. Ayrıca `researchState` bu kolonu Dense Fuel Cells keşfi için
okuyor, yani sabit `false` korsan akınlarının o keşfe sayılmayacağına sessizce
karar veriyordu. Artık `neutral.ts` gibi hesaplanıyor ve sayıyor.

**4 · Dönen akın fırlattığı filoyu yayınlıyordu (P2).** Teleskopla izleyen biri
randevuda yarısı ölmüş bir filoyu tam kadro görüyordu. `pendingThreads` bunu
doğru yapıyordu; `traffic.ts` yapmıyordu. Artık ikisi de canlı `units`
satırlarını okuyor.

**5 · Ele geçirme dövüşülmeyen kadrodan çekiliyordu (P2).** Yıpratılmış bir
korsanı bitiren komutan, başkasının imha ettiği bir Cataclysm'i — üstelik
orijinal sayıya göre ağırlıklı olarak — kapabiliyordu. `pirateCapture` artık
`(level, crew, grade, rng)` alıyor: ne düşürdüysen onu götürürsün.

**6 · Kayıp spec'te çıplak `throw` (P2).** Beş denemeden sonra `exhausted` ve
filo sezon boyunca havada asılı kalıyordu. Artık eli boş eve dönüyor — "bir filo
asla kaybolamaz".

**7 · Hijyen ve ölçüm (P3).** Dört derleyici-susturma kaldırıldı
(`tx as unknown as Db` yerine `sensorPosts` `Queryable` alıyor; üç ölü parametre
silindi). `balance.md`'nin arkasında aleti olmayan tablosu
**`tools/pirate-study.ts`** (`pnpm study:pirates`) ile değiştirildi ve sayılar
gerçek ölçümle güncellendi. `hoardValueMult > 1` totolojisi, kompozisyona göre
`E[net]` işaretini tutan gerçek bir testle değiştirildi. Ulaşılabilirlik
taraması `>30/40` yerine **merkez, orta bant ve kenardan %100** olarak
sıkılaştırıldı (ölçülen: Dart ile her yerden %100, uçuş 12–24 dk).

**Kapı durumu.** `pnpm typecheck` ve `pnpm lint` temiz. `packages/rules` 574 ✓,
`packages/sim` 87 ✓, `apps/server` 1103/1104. Kalan tek sunucu hatası
`galaxy-events.test.ts`'in lifecycle serileştirme testi ve `apps/web`'in yedi
film testi — üçü de korsan işinden önce vardı, `seedWorld`'e hiç dokunmuyorlar
ve bu kapsamın dışında.
