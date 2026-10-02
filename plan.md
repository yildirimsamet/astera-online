# Plan — Kalıcı Gemi Hasarı · Repair Station · Industrial · Radyasyon

> Durum: **ONAYLANDI, uygulanmadı.** Rev. 2 (2026-09-29, koda karşı gözden geçirildi; değişiklikler §8'de).
> Kaynak: sahibin "Ship Damage, Repair Station & Radiation" spesifikasyonu.
> Her faz **TDD** ile yapılır (CLAUDE.md): test yaz → FAIL → implementasyon → PASS → review.
> Kod ve testler kesin bilgidir. Satır referansları HEAD `ee177b9` içindir.

---

## 0. Sahip kararları (2026-09-29)

| # | Karar | Seçim |
|---|---|---|
| K1 | Savaşta kalıcı hasar | **Savaş matematiği aynen kalır; turlar arası `carry` kalıcı olur.** Öldürme, kayıp, grade, yağma ve Dominion birebir aynı. Sonuç: savaş başına taraf × gövde tipi için **en fazla 1** hasarlı gemi. |
| K2 | Tamir kuyruğu | **Her dünyada ayrı, seri REPAIR kuyruğu, 3 sıra.** Tersane kuralları geçerli: aynı anda bir iş çalışır, iptalde %50 iade edilir, arkadakiler yeniden zamanlanır. Üretimi bloklamaz. Bir iş birden çok lotu kapsayabilir ("Hepsini onar"). |
| K3 | Radyasyon | **Maks HP'nin %'si / dakika** (kaynak başına serbest `intensity`); bulut içinde sabittir; kaynaklar üst üste binerse toplanır. **Tick yok**: segment tabanlı kesin süre hesaplanır (doğru–küre kesişimi, SHELTER çıkarılır, aktif pencere uygulanır, recall = iki segment). Kaynaklar **anchor'lı veri satırıdır** (ZONE / PLANET / ileride MONUMENT), modu **EMIT / SHELTER** olur. v1'de yalnız uçuşlar etkilenir; evdeki gemiler etkilenmez. |
| K3a | Monument uyumu | Monument'ta bekleme **durağan segment** olarak modellenir. Açık uçlu bekleme için **tek bir eşik event'i** (%100'e ulaşma anı) kurulur; kaynak değişince settle edilip event yeniden kurulur. v1'de yapılmaz, ama mimaride yeri hazırdır. |
| K4 | v1'de radyasyon nerede | **Canlıda hiçbir yerde yok.** Yalnız test için admin CLI ile gezegene veya serbest noktaya eklenir. |
| K5 | Yayın | **Yeni sezonla**, ruleset **14** kapısıyla. Canlı sezon (≤13) bugünkü gibi davranır. |
| K6 | Industrial fiyatı | **Yard Automation L1–L2 fiyatı:** L1 = 7.897 alaşım / 4.860 kristal; L2 = 14.214 / 8.747. Profil `{ stage: 6, hours: 3, growth: 1.8, fuel: 0 }`. |

### Küçük / geri alınabilir kararlarım (itiraz edilirse değişir)

- **D1 — Zemin savunmaları ve NPC'ler kalıcı hasar almaz.**
  - Zemin savunmaları (BASTION, HARPOON, THORN) zaten `defenceSalvage` ile telafi ediliyor.
  - NPC'ler: nötr garnizon ve korsan mürettebatı.
  - Bu durumlarda `carry` bugünkü gibi atılır.
- **D2 — Hasar birimi: tam sayı basis point (bp), 0–10000.**
  - `≤ 2000 bp` otomatik onarılır (tam %20 dahil). `≥ 10000 bp` yok olur.
  - Değer oran olarak tutulur, bu yüzden SHIP_ARMOR araştırmasından etkilenmez.
- **D3 — Tek bir inişte aynı `(hull, bp)` çiftine sahip gemiler tek lot olur.**
  - Farklı inişlerin lotları **birleştirilmez**; UI gövdeye göre gruplar.
  - Kayıpsızdır; birleştirmenin getireceği "tamirde mi" yarışını da yok eder.
- **D4 — Tamir maliyeti:** kaynak başına `ceil(birimFiyat × adet × bp × pct / (10000 × 100))`.
  - Tam sayı aritmetiği kullanılır; float kaynaklı ceil kayması olmaz.
  - İptal mevcut `cancelRefund` ile %50 floor iade eder. Deuterium dahildir.
- **D5 — Tamir süresi:** `hullWorkMinutes(hull, adet, Shipyard, tech) × bp/10000 × industrialMult`.
  - Değerler tamir **başlarken** okunur ve siparişe dondurulur.
- **D6 — Dock'taki gemiler istihbaratta görünmez ve "filo dışarıda" sinyalini de tetiklemez.**
- **D7 — Dock'taki gemiler dünyaya aittir.**
  - Ele geçirmede `home` satırlarıyla birlikte sahip değiştirir.
  - Ayrılmada (secession) başkente taşınır.
  - Komutan transferinde gezegenle birlikte taşınır ve transferi **engellemez**.
- **D8 — Dock'taki gemiler Hangar yükünde ve Wealth'te sayılır.** Sahip olunan gemidir.
- **D9 — Radyasyonla yok olan gemi:**
  - Enkaz bırakmaz, Dominion'a yazılmaz.
  - Ganimet / yük hayatta kalanların kargo kapasitesine kırpılır.
  - Garbage Collector salvage'ı, hayatta kalan Collector sayısına kırpılır.
  - Hepsi ölürse hepsi kaybolur.
- **D10 — Ölümcül rota koruması.**
  - Sunucu, rota en az bir gemiyi yok edecekse `RADIATION_LETHAL` ile reddeder; `acknowledgeRadiation` ile geçilir.
  - Tahmini istemci kendisi hesaplar (`useLaunchPlan` + aynı saf fonksiyon).
- **D11 — Repair Station'ın hiçbir kapısı yok.**
  - Shipyard seviyesi, gövde araştırması ya da SHIPYARD_REVOLT tamiri engellemez; ücretsiz ayrı istasyondur.
  - Süre yine o dünyanın Shipyard seviyesine göre hesaplanır (D5).
- **D12 — v1'de tamir tüm lot üzerinden yapılır.** Lotun bir kısmını onarma (lot bölme) Monument'la birlikte gelir. Savaş lotları zaten tek gemidir.
- **D13 — Radyasyonla tamamen yok olan saldırı hiç vurmamış sayılır.** `attack_commitments` ve klan roster kaydı recall'daki (K8) gibi geri verilir; tekrar-saldırı limitine sayılmaz.
- **D14 — v1'de radyasyon kayıpları sezon `shipsLost` istatistiğine yazılmaz; tamir maliyeti de `raidLedger`'a girmez.** Bu açık bir "etkilenmedi" notudur. Radyasyon canlıya çıkınca yeniden bakılır.
- **D15 — İstemci, filonun radyasyonda sönme anını yalnız kendi filoları için çizer.** Düşman rotası sisli (D123 trafik pencereleri).

---

## 1. Mevcut sistem (kanıtlı)

- **Gemi depolama**
  - Tablo: `units(planet_id, hull, location, count)` (`db/schema.ts:1525`). PK: `(planet_id, hull, location)`.
  - `location` değerleri: `'home'`, mission id, `mine:<id>`, `clan-war:<uuid>`, korsan ve ticaret namespace'leri.
  - `totalUnitsOf` tüm konumları sayar: Hangar, Wealth, klan gücü.
  - Savunma ve fırlatma yalnız `home` okur.
  - `home` **dışını** okuyan 4 yer var:
    - `intel.ts:152` — Telescope HOME/AWAY sinyali
    - `intel.ts:896` — probe `anyAway`
    - `planet.ts:918` — `awayFleet`
    - `commanderTransfer.ts:134` — `UNITS` ertelemesi
- **Savaş**
  - Tek çözücü: `resolveJointCombat` (`packages/rules/src/combat.ts:378`).
  - Saldırgan her zaman `applyJointCasualties` ile işlenir (tek stack'te de). Savunmacı `applyCasualties` ile işlenir.
  - Hasar turlar arası `carryA` / `carryD` ile taşınır (`combat.ts:396-397`) ve savaş sonunda atılır.
  - Çağıranlar:
    - PvP: `worker/handlers.ts:798`
    - Klan savaşı: `clanWarSettlement.ts:259`
    - Nötr: `neutral.ts:226`
    - Korsan: `pirateRaid.ts:532`
    - forecast, academy, sim
- **Kuyruk**
  - `build_orders` (`schema.ts:1876`); tipi `BuildQueueId = 'CONSTRUCTION' | 'YARD'` (`economy.ts:705`).
  - `placeBuildOrder` (`buildQueue.ts:261`): maliyet düşümü, seri başlangıç, sezon sonu koruması.
  - `cancelBuildOrder` (`buildQueue.ts:347`): %50 iade, `reflowQueue` ile yeniden zamanlama, bağımlılık reddi.
  - `applyBuildCompletion` (`buildQueue.ts:462`), `abandonBuildOrder`, `onBuildComplete` (`handlers.ts:2320`).
  - Build rotaları idempotency anahtarı kullanmaz; koruma planet kilidi ve durum geçişiyle sağlanır.
- **Araştırma**
  - Önkoşul kontrolü yalnız "≥1" (`researchState.ts:205-209`, `research.ts:191`, sim `season.ts:2083`).
  - Fiyat `profileResearch` üzerinden hesaplanır; kristalde ×0,8 indirim uygulanır.
- **Uçuş**
  - Düz çizgi; konum saklanmaz. Recall `recallFrom` ve `recalledAt` alanlarını saklar (`movement.ts:605`).
  - Launch önizlemesi istemcide hesaplanır (`useLaunchPlan`).
- **Silme listeleri (FK sırası elle yazılmış)**
  - Sezon wipe: `servers.ts:~600-690`.
  - Koltuk geri alma ve hesap silme: `reclaim.ts demolish` (`reclaim.ts:401`, `accountDeletion.ts` bunu çağırır).
  - Worker kurtarma: `worker/abandon.ts` — mission, klan savaşı bacağı, mining, trade, convoy, build.
- **Ölçekler**
  - HP 38–2158.
  - Üretim gemi başına 1,3–23 dk.
  - 1000 birimlik uçuş 7,9–20 dk.

---

## 2. Model ve değişmezler

```ts
// packages/rules/src/damage.ts (yeni)
interface DamageLot { hull: HullId; count: number; damageBp: number } // 1..9999
type DamageLots = readonly DamageLot[];                                 // listede yok = sağlam
const dockLocation = (lotId: string) => `dock:${lotId}`;               // raidLocation/tradeLocation gibi
const isDockLocation = (location: string) => location.startsWith('dock:');
```

- **I1 — `home` konumundaki her gemi %100 HP'dir.** Bu yüzden savunmacı hiçbir zaman ön-hasarlı savaşmaz. Savaşa yalnız saldırgan (radyasyon yüzünden) ön-hasarlı girebilir.
- **I2 — > 2000 bp hasarlı gemi yalnız `units.location = dock:<lotId>` konumunda durur.**
  - `ship_damage_lots` satırı **yalnız** şunları tutar: `id`, `planet_id`, `hull`, `damage_bp`, `repair_order_id`, `created_at`.
  - Adet, sahip ve sezon bilgisi **tutulmaz**. Adet ve sahip `units` satırındadır; sezon gezegenden okunur. Böylece capture ve transfer ikinci bir alanı güncellemek zorunda kalmaz.
- **I3 — Uçuştaki hasar, gemiyi tutan satırın `damage` alanındadır.**
  - `missions.damage`, `clan_war_contributions.damage`, `pirate_raids.damage`.
  - R2'de: `mining_runs`, `trade_runs`, `intergalactic_convoy_runs`.
  - `null` = hepsi sağlam.
- **I4 — Eşik yalnız iki anda uygulanır:**
  - (a) savunmacıya, savaştan hemen sonra;
  - (b) uçuştan gelen gemiye, bir dünyaya **indiğinde** (worker `abandon` inişi dahil).
- **I5 — `≥ 10000 bp` olan gemi yok olur.** Yalnız radyasyonla olabilir.
- **I6 — Ruleset kapısı yalnız hasarın *üretildiği* yerlerde kontrol edilir:**
  - savaş hatları, radyasyon settle, tamir başlatma, Industrial görünürlüğü.
  - İniş yolları kapı kontrol etmez: eski sezonda `damage` her zaman `null` olur ve davranış birebir aynı kalır.
- **I7 — Tamir durumu türetilir.** Bir lot, `repair_order_id` alanı `status='BUILDING'` olan bir siparişi gösteriyorsa tamirdedir. Toplu iptal, abandon ve secession gibi her yol lotu kendiliğinden "hasarlı" durumuna döndürür.
- **I8 — Toplam gemi korunur.** Radyasyon ölümü ve savaş kaybı dışında hiçbir yol `units` toplamını değiştirmez; yalnız konumu değiştirir.

---

## 3. Gereksinim analizi — happy path ve edge case'ler

### 3.1 Savaş
1. **Happy path:** saldırganın kısmi hasarlı gemisi dönüş mission'ına lot olarak yazılır. Savunmacının kısmi hasarlı gemisi:
   - ≤ 2000 bp ise `home`'da kalır ve raporda "otomatik onarıldı" görünür;
   - > 2000 bp ise dock'a gider.
2. 2000 bp otomatik onarılır; 2001 bp dock'a gider.
3. Tip tamamen öldüyse lot oluşmaz. SUPPORT gövde korunuyorsa lot oluşmaz. Zemin savunmasında lot oluşmaz (D1).
4. Escape: kaçan gemilere dokunulmaz. Walkover'da hasar yoktur. CORE_OUTAGE davranışı değişmez.
5. Joint war: kısmi gemi bir cohort'a (`hull:hp`) aittir. Deterministik olarak, kalan sağlam sayısı en büyük stack'e atanır; eşitlikte `contributionId` belirler.
6. Ön-hasarlı saldırganda en çok hasarlı gemi önce ölür. Ön-hasar yoksa aritmetik **bit bit aynı** kalır.
7. `claimMission` idempotenttir: rapor iki kez teslim edilse de ikinci lot oluşmaz.
8. bp = `round(carry/hp × 10000)`. Sonuç 0 ise gemi sağlam sayılır; 10000 çıkarsa 9999'a kırpılır.
9. Escape eşiği (`combatValue`) ön-hasarı yok sayar. Bu v1 için bilinçli bir karardır.

### 3.2 İniş
1. Dünya el değiştirmişse iniş `safeHomePlanet` hedefine yapılır; dock lotu orada açılır.
2. Recall edilmiş saldırı savaş hasarı taşımaz; yalnız radyasyon hasarı taşıyabilir.
3. Transfer, reroute, klan yardımı dönüşü ve settlement yalnız radyasyon hasarı taşıyabilir (I1).
4. Worker `abandon` bir mission'ı, klan savaşı bacağını ya da korsan dönüşünü kurtarırken `damage` alanını **yok saymamalıdır**. Yok sayarsa bedava tamir olur ve I1 bozulur. `landShips` kullanılır.
5. Sezon wipe ve koltuk geri alma yeni tabloları FK sırasına göre siler. `debris_fields`, `research_orders` ve `player_rivals` daha önce bu yüzden wipe'ı kilitlemişti.

### 3.3 Repair Station
1. **Happy path:** tek bir lotu, bir hull'ın tüm lotlarını ya da "Hepsini onar" ile hepsini onarmak. Tamir bitince gemiler `dock` → `home` geçer ve lot silinir.
2. Hata durumları:
   - `INSUFFICIENT_RESOURCES`
   - `QUEUE_FULL` (queue adı 5 dilde çevrilir)
   - `REPAIR_LOT_BUSY`
   - yabancı lot → 404/403
   - `SHIP_DAMAGE_UNAVAILABLE` (ruleset < 14)
   - `SEASON_ENDS_BEFORE_BUILD`
   - `assertWorldOperational`
3. Çift dokunma: planet kilidi + lotlar `FOR UPDATE`. İkinci istek `REPAIR_LOT_BUSY` alır. Build rotalarıyla aynı model; idempotency anahtarı gerekmez.
4. İptal: %50 floor iade edilir, lot hasarlı durumuna döner, arkadakiler yeniden zamanlanır. İkinci iptal `BUILD_ORDER_NOT_FOUND` alır ve iade tekrarlanmaz.
5. İptal ile tamamlanma yarışı: mevcut `BUILD_ORDER_FINISHED` durum geçişleri çözer.
6. Abandon tam iade eder. Secession siparişleri iptal eder (`loyalty.ts:329`); lotlar başkente taşınır.
7. Capture: dock satırlarının sahibi değişir. REPAIR siparişi YARD siparişiyle aynı kaderi paylaşır.
8. Komutan transferi: dock satırları gezegenle birlikte taşınır ve `UNITS` ertelemesi **dock'u saymaz**. Saysaydı, tamir etmeyen hareketsiz komutan Silent Space'e hiç taşınamazdı. REPAIR siparişi mevcut `build_complete` yeniden hedefleme mantığıyla taşınır (`commanderTransfer.ts:147-160`).
9. Tamir ortasında biten Industrial koşan siparişi değiştirmez (D5).

### 3.4 Industrial
1. Maks seviye 2'dir; `researchEffectAt` yürüyüşünden çıkar.
2. Önkoşul: YARD_AUTOMATION **≥ 2**. Hem sahip olunan hem kuyruktaki seviye için kontrol edilir; sim'de de aynı ayna uygulanır.
3. Kuyrukta YA L2 varken Industrial kuyruğa alınabilir. YA L2 iptal edilirse ve Industrial ona bağlıysa iptal reddedilir.
4. Fiyat = YA L1 / L2 fiyatı (K6). Ruleset < 14'te görünmez.

### 3.5 Radyasyon
1. Özel geometriler:
   - Segment küreye teğetse doz 0 olur.
   - Segment kürenin içinde başlıyorsa sayım t0'dan başlar.
   - Durağan segmentte (sıfır uzunluk) pencere boyunca tam doz alınır.
2. Pencere kırpılır. EMIT kaynaklarının katkıları toplanır; SHELTER kendi hacmindeki bütün EMIT katkısını sıfırlar.
3. Recall iki segmenttir. Reroute ayrı bir mission'dır. Yavaş pace daha fazla doz demektir.
4. **Savaşan her varışta doz savaştan ÖNCE uygulanır:**
   - PvP saldırı
   - nötr gidiş bacağı
   - klan savaşı saldırı bacağı
   - korsan (R2)
5. Tüm filo ölürse:
   - **Saldırı:** savaş olmaz; commitments geri verilir (D13); saldırgan bildirim alır; savunmacıya bilgi verilmez.
   - **Klan savaşı dalgası:** katkı sıfırlanır ve operasyon, "dalgası yok edilmiş" yolundan devam eder. Test ile doğrulanacak.
   - **Settlement:** başarısızlık yolu çalışır (escrow iade).
   - **Transfer:** yük kaybolur.
6. Kısmi ölümde yük, ganimet ve salvage kırpılır (D9). Kırpma `allocateClanLoot`'tan **önce** yapılır.
7. Uçuş sürerken kaynak eklenir ya da biterse, saklanan pencereler sayesinde geçmiş doğru kalır. Kaynak satırı silinmez; `active_until` ile bitirilir.
8. PLANET anchor'lı kaynağın koordinatı oluşturulurken saklanır. Gezegen sezon içinde hareket etmez. Komutan transferi gezegeni başka sezona taşırsa kaynak eski konumda ZONE gibi kalır; test-only kapsamda bu kabul edilir.
9. Ruleset < 14 sezonda CLI reddeder.
10. Probe ve Death Star gemi (hull) değildir; radyasyondan etkilenmez.

---

## 4. Fazlar

Her fazın altında sırasıyla: **Dokunulacak yerler · Kırılma riski · Önce yazılacak testler · Kabul kriterleri**.

Test fixture'ları sezonu `rulesetVersion: 1` ile kurar (`test/helpers.ts:253`). Bu yüzden mevcut testler kapı sayesinde etkilenmez. Yeni testler 14'ü açıkça set eder.

Sunucu testleri tek Postgres üzerinde seri koşar. Adım başına yalnız dokunulan testler koşulur; tam suite'ler F13'te koşulur.

### F0 — Kurallar temeli (saf)
- **Dokunulacak yerler:**
  - `constants.ts`:
    - `MULTI_WORLD.shipDamageRulesetVersion: 14`
    - `SHIP_DAMAGE = { autoRepairMaxBp: 2000, destroyedBp: 10000 }`
    - **`MULTI_WORLD.rulesetVersion` burada yükseltilmez; bu iş F13'te yapılır.**
  - Yeni `damage.ts`: `shipDamageApplies`, `needsDock`, `dockLocation`, `isDockLocation`, `carryToBp`, `normalizeLots`, `splitForLanding`, `applyDose`, `shipRepairInvoice`, `shipRepairCost`, `shipRepairWorkMinutes`, `shipRepairMinutes`.
  - ✅ **Yapıldı (2026-09-30).** Uygulamadaki sapmalar:
    - `repairCost` ve `repairMinutes` adları `faults.ts`'te zaten kullanılıyor; yeni fonksiyonlar bu yüzden `shipRepair*` adını aldı.
    - Tamir fonksiyonları Industrial'ın bıraktığı payı `pct` (100/75/50) parametresiyle alıyor. `INDUSTRIAL` id'si F5'te gelecek; F5 `repairPct(tech)` ekleyecek.
    - `capLoadToSurvivors` tek kullanıcısı olan F9'a taşındı.
    - `RESEARCH_TECH.repairLadder` F5'e taşındı.
- **Testler:** `packages/rules/test/ship-damage.test.ts`
  - Sınırlar: 2000 / 2001 / 9999 / 10000.
  - Spesifikasyon örneği: 1000/500 @ %40 → 400/200. 10 dk × %40 → 4 dk.
  - Deuterium, ceil davranışı, ×0,75 ve ×0,5 çarpanları.
  - `capLoadToSurvivors`.
  - fast-check: adetler korunur; normalize işlemi idempotent.
- **Kabul kriteri:** rules testleri yeşil.

### F1 — Savaş: carry kalıcı + saldırgan ön-hasarı (`combat.ts`)
- **Dokunulacak yerler:**
  - `JointAttackerStack.damage?: DamageLots` eklenir.
  - Çıktılara şunlar eklenir: `JointContributionOutcome.survivorDamage`, `CombatResult.attackerDamage`, `CombatResult.defenderDamage` (savunmacının son `carry`'si; filtreyi çağıran yapar).
  - `applyJointCasualties` önüne **ön-hasar öneki** eklenir: yeni hasar önce ön-hasarlı lotları öldürür (bp büyükten küçüğe), sonra **bugünkü kod** hiç değişmeden `effective = kalan + carry` ile çalışır.
  - Savaş sonunda `carry` → `{count: 1, bp}` lotuna çevrilir.
  - `resolveCombat` ve `resolveRaid` yeni alanları geçirir.
  - **Savunmacı ön-hasar girdisi eklenmez** (I1). Monument savaşları gelince eklenir.
- **Kırılma riski:** EN YÜKSEK risk bu fazda. Ön-hasar yoksa önek adımı çalışmaz; mevcut aritmetik satırlarına dokunulmaz.
- ✅ **Yapıldı (2026-09-30).**
  - `test/combat-parity-digest.test.ts`: değişiklikten **önce** 350 tohumlu savaşın (solo ve joint) çıktısı SHA-256 özetine bağlandı; değişiklikten sonra özet aynı kaldı.
  - Zemin topları çözücü içinde `defenderDamage`'den çıkarılıyor (D1).
  - `resolveCombat` ön-hasarı 6. parametre olarak alıyor; `soloStack` 3. parametre olarak alıyor.
  - Test durumu: rules 1755/1755 ve sim testleri yeşil.
- **Testler:** `combat-damage.test.ts`
  - carry → lot.
  - Tip öldü → lot yok.
  - SUPPORT korunuyor → lot yok.
  - Ön-hasarlı gemi önce ölür.
  - Joint'te atama deterministik.
  - Stack lotları toplamı = `attackerDamage`.
  - fast-check parite: `damage` verilmezse eski alanlar birebir aynı çıkar.
  - Mevcut clan-war parite, combat, forecast, academy ve sim testleri **değiştirilmeden** yeşil kalır.

### F2 — Depolama ve yardımcılar
- **Migration `0122_*`:**
  - Yeni `ship_damage_lots` tablosu (I2 alanları). `CHECK damage_bp BETWEEN 2001 AND 9999`. FK'ler: `planet_id` ve `repair_order_id → build_orders`.
  - `missions.damage`, `clan_war_contributions.damage`, `pirate_raids.damage` (jsonb, null olabilir).
  - `battle_reports.attacker_damage` ve `battle_reports.defender_damage` (jsonb, varsayılan `'[]'`).
  - `build_orders` CHECK'lerinde `queue` ve `kind` listelerine `'REPAIR'` eklenir.
  - `BuildQueueId` ve `BuildOrderKind` tiplerine `'REPAIR'` eklenir.
- **`services/shipDamage.ts`:**
  - `dockLotsOf`
  - `dockDamaged` (savunmacı: `home`'dan düşer, dock'a yazar)
  - `landShips` (`splitForLanding` → `home` + dock; özet döner)
- **`home` dışı okumalar:**
  - `planet.ts awayFleet` dock'u **hariç** tutar.
  - `planetView` yeni `fleetDocked: Fleet` alanını ve `dock` bloğunu döner. Web'deki sahiplik hesapları için gerekir (F6).
- **Silme listeleri:**
  - `servers.ts` wipe: `ship_damage_lots` silinmesi **`build_orders` ve `units`'ten önce** yapılır.
  - `reclaim.ts demolish`: gezegen bazında silinir. Hesap silme de bu yolu kullandığı için onu kapsar.
- ✅ **Yapıldı (2026-09-30).**
  - Migration `0122_acoustic_monster_badoon.sql`. `BuildQueueId`/`BuildOrderKind` tiplerine `'REPAIR'` F4'te eklenecek (DB CHECK şimdiden hazır).
  - `landShips` ve `dockDamaged` açık bir `at` parametresi alıyor.
  - Wipe ve hesap silme testlerinin, koruma satırları kaldırıldığında FK hatasıyla kırıldığı doğrulandı.
- **Testler:** `ship-damage-storage.test.ts`
  - CHECK kısıtları.
  - `landShips` eşik davranışı ve I8 korunumu.
  - `awayFleet` ile `fleetDocked` ayrımı.
  - Dock satırı varken **sezon wipe başarılı** olur.
  - Dock satırı varken **reclaim / hesap silme başarılı** olur.

### F3 — Savaş hatları, inişler ve `home` dışı okumalar
- **Dokunulacak yerler:**
  1. **PvP** (`handlers.ts` ~798–1240):
     - Savunmacının zemin dışı `defenderDamage` lotları → `dockDamaged`.
     - `attackerDamage` → dönüş mission'ının `damage` alanı.
     - Rapor alanları yazılır.
     - `raided` payload'una `docked` ve `autoRepaired`, `raid_result` payload'una `damaged` eklenir.
  2. **Klan savaşı:**
     - `clanWarSettlement.ts`: savunmacı + `survivorDamage` → `clan_war_contributions.damage`; katılımcı sonuçlarına kişisel lotlar.
     - `clanWar.ts:1614-1628` inişi `landShips` kullanır.
  3. **Nötr:** `neutral.ts:226` + dönüş bacakları (414/468).
  4. **Korsan:** `pirateRaid.ts:532` + dönüş inişi.
  5. **İnişler `landShips` kullanır:**
     - `settleReturn`
     - `resolveTransfer`
     - `rerouteToSafeHome` (`damage` kopyalanır)
     - `resolveClanAid`
     - `resolveSettlement`
     - `worker/abandon.ts` (mission ~150–166, `abandonClanWarLeg`, korsan)
  6. **`home` dışı okumalar:**
     - `intel.ts:152` Telescope sinyali ve `intel.ts:896` probe `anyAway` → `dock:` hariç tutulur (D6). **Bu yapılmazsa dock'taki tek gemi dünyayı "filo dışarıda" gösterir.**
     - `commanderTransfer.ts:134` → `dock:` sayılmaz (D7).
  7. **Rapor API'si (`reports.ts`):** herkes yalnız **kendi** tarafının hasar lotlarını görür (sis kuralı). Klan savaşında kişisel lotlar gösterilir.
  8. **Kenarlar:**
     - `loyalty.ts` secession: dock lotları başkente taşınır.
     - `ownership.ts:376-382` capture: dock satırlarının sahibi değişir.
- **Testler:**
  - `raid-damage.test.ts`
  - `clan-war-damage.test.ts`
  - `neutral-damage` / `pirate-damage`
  - `landing-damage.test.ts`: transfer, reroute, recall, yardım, settlement, abandon; `null` hasarda davranış değişmez.
  - `dock-intel.test.ts`: dock'ta gemi varken Telescope `HOME`, probe `anyAway=false`.
  - `dock-ownership.test.ts`: capture, secession, komutan transferi (dock + koşan REPAIR ile).
  - Dock'taki gemi her fırlatma hattında ve savunmada **yok sayılır**: attack, transfer, klan dalgası, yardım, settlement, korsan, trade, convoy.
  - Ruleset 1/13 sezonunda lot oluşmaz.
- **Kabul kriteri:** I1, I2 ve I8 her yolda test edilmiş.
- ✅ **Yapıldı (2026-09-30).** Yeni testler: `dock-reads`, `raid-damage`, `npc-battle-damage`, `clan-war-damage`, `landing-damage`, `dock-ownership`; `clan.test` ve `multi-world.test` dosyalarına ek testler. Bilinen kırmızılar dışında regresyon yok. Notlar:
  - Migration `0123`: `clan_war_participant_results.damage`. Kişisel rapor hasarı buradan okunuyor; `contributions.damage`'tan türetilmiyor, çünkü radyasyon onu sonradan değiştirebilir.
  - Gidiş-dönüş transferinde bölme, rules'taki `lotsWithin` ile gövde tipine göre yapılıyor. Dönüş planı gövde tipi bazında olduğu için kısmi bölmeye gerek kalmadı.
  - Transfer teslimatının zil bildirimi yok (mevcut davranış). Radyasyonla hasar görüp dock'a inen gemiler için bildirim F9'da eklenecek.
  - Nötr dönüş bacağı `parentMissionId` yazmıyor (mevcut davranış, değiştirilmedi).
  - `abandon.ts`'te korsan olayları için dal yok (mevcut davranış); klan savaşı kurtarması `landContribution` üzerinden hasarı taşıyor.
  - Katılımcı listesinde hasar gösterilmiyor, çünkü o liste savunmacıya da açık. Herkes sadece `yourDamage` alanını görüyor.

### F4 — Repair Station (sunucu)
- **Dokunulacak yerler:**
  - `services/repair.ts` — `startRepair(db, planetId, { lotIds } | { all: true }, clock, playerId)`:
    - `withPlanetLock` → `assertWorldOperational` → ruleset kapısı → `buildQueueContext(tx, planet, 'REPAIR')`
    - lotlar `FOR UPDATE`; dünya, sahip ve "tamirde değil" kontrolü
    - `placeBuildOrder({ kind: 'REPAIR', subject: hull | 'ALL', count })`
    - `repair_order_id` set edilir
    - **`WithPlanet`** döner (D53: mutation tüm dünyayı döner)
    - D11 geçerli: Shipyard, araştırma veya fault kapısı yok.
  - `buildQueue.ts`:
    - `projectOrder` ve `orderDependsOn` REPAIR için no-op.
    - `applyOrderEffect` case `'REPAIR'`: `dock:<lot>` → `home`, lot ve dock satırı silinir. `shipsBuilt` telemetrisine **yazılmaz**.
    - `cancelBuildOrder` ve `abandonBuildOrder` değişmez (I7).
  - Rota: `POST /api/planets/:planetId/repairs`, Zod: `{ lotIds: uuid[1..50] } | { all: true }`, strict. İptal mevcut `/build-orders/:orderId/cancel` ile yapılır.
  - `planetView`: `dock` (lot, fiyat, süre; toplam) + `queues.REPAIR` (her zaman dizi olarak).
- **Testler:**
  - `repair-station.test.ts`:
    - Happy path, "hepsi", seri zamanlama.
    - Tüm hata kodları (§3.3.2).
    - İptal %50 floor; tail yeniden zamanlanır.
    - Abandon tam iade.
    - Industrial indirimi.
    - Shipyard 0 olan kolonide tamir yapılabilir.
  - `repair-concurrency.test.ts`:
    - Paralel iki başlatma → tek düşüm.
    - Paralel iki iptal → tek iade.
    - İptal ile tamamlanma yarışı.
- **Kabul kriteri:** hiçbir yarışta kaynak ya da gemi çoğalmaz veya kaybolmaz.
- ✅ **Yapıldı (2026-09-30).**
  - `services/repair.ts` (`startRepair`), `shipDamage.ts` (`releaseRepairedLots`, `dockView`), `buildQueue.ts` (REPAIR tamamlanması).
  - Rota: `POST /api/planets/:planetId/repairs`. `planetView` artık `dock`, `fleetDocked` ve `queues.REPAIR` döndürüyor.
  - Hata kodları: `REPAIR_LOT_NOT_FOUND`, `REPAIR_LOT_BUSY`, `REPAIR_NOTHING_WAITING`, `SHIP_DAMAGE_UNAVAILABLE` ve kuyruğun kendi hataları. Bunların i18n metinleri F6'da.
  - Web'e yalnız typecheck'i korumak için minimum ekler yapıldı: REPAIR sipariş şeması, opsiyonel `dock` / `fleetDocked` / `queues.REPAIR`, kuyruk etiketi "Onarım · Ballista" (yeni `repairStation` ad alanı, 5 dil). Arayüzün kendisi F6'da.
  - Testler: `repair-station` (13) ve `repair-api` (4).

### F5 — Industrial
- **Dokunulacak yerler:**
  - `types.ts`: `'INDUSTRIAL'` listenin **sonuna** eklenir.
  - `research.ts`:
    - `researchEffectAt` case → `repairMult`.
    - `ResearchProject.prerequisiteLevel?: number` (varsayılan 1).
    - Industrial `{ prerequisite: 'YARD_AUTOMATION', prerequisiteLevel: 2 }`.
  - `economy-profile.ts` `researchWork.INDUSTRIAL`.
  - `constants.ts` `RESEARCH_TECH.repairLadder = [75, 50]`; `tech.ts` `repairPct(tech)` (100/75/50). Değer `shipRepairCost` ve `shipRepairMinutes` fonksiyonlarına `pct` olarak geçer.
  - Seviye farkındalığı üç yerde uygulanır: `researchState.ts:205-209` ve API payload'undaki `prerequisiteLevel` (`:257`), `research.ts:191` bağımlılık yürüyüşü, sim `season.ts:2083`.
  - Ruleset < 14'te gizli.
- **Kırılma riski:**
  - `research-tables`, `research-ceiling` ve `contract.test.ts` (`RESEARCH_PROJECT_IDS` okur) güncellenmeli.
  - Web `schemas.ts:59` enum'u da güncellenmeli.
- ✅ **Yapıldı (2026-09-30), F4'ten ÖNCE.** Tamir maliyeti Industrial payına (`repairPct`) bağlı olduğu için sıra değiştirildi; böylece F4'e geçici bir "sabit %100" yazılmadı.
  - Önkoşulun tek okuması `researchPrerequisiteMet` (rules): sunucu, sim (iki yer) ve web aynı fonksiyonu kullanıyor. Seviye belirtmeyen projelerin davranışı değişmedi.
  - Düzeltme: araştırma oyuncu tarafından iptal edilemiyor. Bağımlılık yürüyüşü yalnız sistemin bir siparişi terk etmesinde (abandon) kullanılıyor. YA L2 terk edilirse arkasındaki Industrial da terk edilir; YA L3 terk edilirse Industrial ayakta kalır.
  - Web: sanayi bandı 6 yıldıza çıktı (yeni yerleşim, YA→Industrial dikey çizgi); gerekçe metni "YA'yı 2. seviyeye çıkar"; 5 dilde metinler eklendi.
  - **Açık madde:** Industrial için özel bir lab görseli yok; geçici olarak `lab/lab.png` kullanılıyor. Görsel doğrulama F6'da yapılacak.
  - Katalog sabitleyen testler (proje sayısı 17, kademe 54, id listesi, yıldız sayısı 17) bilinçli olarak güncellendi.
- **Testler:**
  - Rules: max = 2; fiyat = YA L1/L2; `repairPct`.
  - `research-industrial.test.ts`: YA1 red, YA2 kabul; kuyruktaki YA2 ile kabul; bağımlı iptal reddi; ruleset kapısı; tamirde indirim.
  - Sim önkoşul aynası.

### F6 — Web
- **Şema ve tipler:**
  - `api/schemas.ts`: `dock`, `fleetDocked`, `queues.REPAIR`, research id, `prerequisiteLevel`, rapor hasar alanları, bildirim alanları.
  - `BuildQueueId` tüketicileri:
    - `lib/predict.ts`
    - `v2/kit/QueueSheet.tsx` (`Lanes` tipi)
    - `onboarding/academyWorld.ts:184` ve `onboarding/world.ts` fixture'ları
    - `v2/gallery/Gallery.tsx`
- **Sahiplik hesapları dock'u saymalı** (yoksa istemci, sunucunun reddedeceği bir yapımı teklif eder):
  - `lib/predict.ts:162`
  - `ui/FleetCards.tsx:56`
  - `screens/TransferSheet.tsx:240`
  - Not: burada `{...fleet, ...fleetAway}` toplama değil üzerine yazma yapıyor. Bu mevcut bir hata; aynı satır düzeltilirken giderilir.
- **Yüzeyler:**
  - `FleetPage` yeni `'dock'` sekmesi (Tamirhane).
  - `BaseQueues` / `QueueLane` REPAIR şeridi.
  - `BattleReports` + `ReportScene`: sağlam / hasarlı / yok edildi; otomatik onarıldı / Tamirhaneye gitti.
  - Defend sekmesi: "N gemi tamirde — savunmaya katılmaz".
  - Home sekmesi: "N gemi Tamirhanede" bağlantısı.
  - Bildirim metinleri.
  - Industrial düğümü: `lib/constellation.ts`, `i18n/names.ts`, `lib/gains.ts`, `ui/assets.ts`.
- **i18n (5 dil):** yeni hata kodları (`REPAIR_LOT_BUSY`, `SHIP_DAMAGE_UNAVAILABLE`, `RADIATION_LETHAL`), `QUEUE_FULL` içindeki `{{queue}}` için "repair" adı, tüm yeni metinler.
- **Tasarım — 4 soru** (350 px; kompakt premium; mock olmadığından kit bileşenleri: `Sheet`, `QueueLane`, `Cost`, `ClassEmblem`, `NeedBar`):
  1. **Clarity:**
     - Satır: `ClassEmblem · Ballista ×1 · %64 hasar`, maliyet chip'leri ve süre.
     - "Yeni geminin %64'ü" karşılaştırması.
     - Home ve Defend sekmelerinde sayının neden düştüğü açıklanır.
  2. **Predictability:** maliyet ve süre dokunmadan görünür. İptal butonu iadeyi sayıyla gösterir.
  3. **Decision support:** bir dokunuş derinde kural sayfası (≤%20 ücretsiz · >%20 kullanılamaz · maliyet = hasar payı · Industrial %25/%50). Industrial yoksa ipucu gösterilir.
  4. **Interaction cost:** tek dokunuşla "Hepsini onar". Boş Tamirhane sade bir durum metni gösterir.
- **Testler:** `lib` saf fonksiyonları, şema parse, predict/sahiplik (dock dahil). Görsel doğrulama `tools/visual.mjs` + galeri kamerası ile yapılır, 350×812 @DPR2 ve masaüstünde. Kayıt limiti nedeniyle koşu sayısı az tutulur.
- ✅ **Yapıldı (2026-09-30).**
  - **Fleet sayfası:** `'repair'` sekmesi (Tamirhane · N), dünya başına dock kartı, "Hepsini onar", iptal onayı; Garrison'da "N Tamirhanede" chip'i sekmeye götürür. `BaseQueues` / `QueueSheet` REPAIR şeridi yalnızca doluyken görünür.
  - **Rapor:** `ReportScene` içinde `data-report-damage` bloğu (`BattleReports` sahneyi gömdüğü için orada da görünür). Satır "Sur ×1 · %64 hasar" der. Savunan için "Tamirhaneye" / "ücretsiz onarıldı" yazar; saldıran için "eve inince değerlendirilir" notu çıkar.
  - **Bildirimler:** `raided` (REPELLED dahil) → docked/patched cümlecikleri; `raid_result` → "N hasarlı dönüyor"; `fleet_returned` raid/pirate/recalled → iniş cümlecikleri. Hepsi yalnızca oldu ise söylenir; eski payload'lar aynen okunur.
  - **Defend sekmesi:** `DefenceReadings` "Defence" kararının detayı "N gemi Tamirhanede · savunmaz" der; çekirdek arızası ve yük gemisi notlarının yanında da görünür.
  - **Ek düzeltme:** takımyıldızda sezonun sahip olmadığı projeye (ruleset < 14'te INDUSTRIAL) giden çizgi artık çizilmiyor.
  - **Galeri:** `fleet-repair`, `report` (saldıran, hasarlı) ve yeni `report-defend` görünümleri; 350 @DPR2 ve 1280'de en/tr/de fotoğraflandı, konsol hatası yok.
  - **Açık madde (sahibe):** Industrial için özel lab render'ı gerekiyor (şimdilik `lab/lab.png`).

### F7 — Mirror'lar: botlar, sim, istatistik
- Sunucu botları (`bots/brain.ts`): yeni gemi üretmeden önce dock doluysa ve bütçe yetiyorsa `startRepair({ all: true })`. Test: `bots-repair.test.ts`.
- Sim:
  - Savaş başına tamir maliyeti `fleet-calibration` ile ölçülür.
  - Etki < %1 ise ölçümüyle birlikte "etkilenmedi" notu yazılır; değilse maliyet düşümü eklenir.
  - Önkoşul aynası F5'te yapılır.
- `raidLedger` ve sezon `shipsLost` için D14 notları `docs/balance.md`'ye yazılır.
- forecast değişmez (ön-hasar yalnız radyasyondan gelir; F10'da ayrı satır).
- ✅ **Yapıldı (2026-09-30).**
  - **Botlar:** `repairDocked`, turun İLK adımı (collect'ten hemen sonra), yalnız "gemiden önce" değil. Gerekçe: tur boyunca güncel mağazayı okuyan tek adım bu; sonraki adımlar turun açılış görünümüyle karar veriyor. Ayrıca tamirdeki gemi savunmadığından tamir en ucuz savunmadır. En ucuz lotlardan başlar, mağazanın tam ödeyebildiği kadarını tek iş olarak `startRepair` kapısından gönderir. `buyShips` sahiplik sayımları (`owned`, Prospector, Courier) dock'u da sayar. Test: `bots-repair.test.ts` (4).
  - **Sim ölçümü:** `measureFleetBattle` artık `meanAttackerRepair` / `meanDefenderRepair` döndürüyor. Fatura/kayıp oranı 240k–1M bütçede %1'in altında, ama 2k'da %54, 10k'da %17. Bu yüzden maliyet düşümü eklendi: `season.ts` `payRepairs` (PvP baskının iki tarafı ve tarafsız dünya saldıranı; yağmadan sonra, mağazadan, sıfırın altına inmeden). Kapı `world.rulesetVersion` (yeni `SimConfig.rulesetVersion`, varsayılan `MULTI_WORLD.rulesetVersion`), yani F13'e kadar sim değişmez. Sezon ölçümü: tamir, tüm kayıpların %4,4'ü (1. hafta %9–11). Rakamlar `docs/balance.md`'de.
  - **D14 notları** `docs/balance.md`'ye yazıldı.
  - **F13'e not:** sürüm 14'e geçince sim bantları (VFR, arketip) yeniden okunmalı; tamir faturası yağmayı ve mağazaları etkiliyor.

### F8 — Radyasyon çekirdeği (rules, saf)
- **`radiation.ts`:**
  - Tipler: `RadiationSource`, `Segment`.
  - Fonksiyonlar: `sphereInterval`, `segmentExposure`, `segmentsDoseBp`, `missionSegments` (recall dahil), `lethalAtMs`.
- **Testler (fast-check):**
  - Bölünebilirlik (segmenti ikiye bölmek aynı dozu verir).
  - Yön simetrisi.
  - Teğet, içeriden başlama, durağan segment.
  - Pencere kırpma.
  - SHELTER.
  - EMIT toplamı.
  - Recall iki segment = eşdeğer iki mission.
  - Pace ölçeği (süre ×10 → doz ×10).
- **Kabul kriteri:** sunucu, istemci ve sim aynı fonksiyonu kullanır. Başka bir kopya yazılmaz.
- ✅ **Yapıldı (2026-09-30).** `packages/rules/src/radiation.ts`, 23 test; property'ler ayrıca 3000 koşuyla zorlandı.
  - **Tek profil:** her segment için parça parça sabit doz hızı profili çıkarılır. Toplam doz (`segmentsDoseBp`) ve ölüm anı (`lethalAtMs`) aynı profilden okunur, yani birbirleriyle çelişemezler.
  - **Yuvarlama:** doz tam bp'ye `floor(raw + 1e-6)` ile iner (float gürültüsü, "1999,9999…" bir gemiyi yaşatmasın diye). `lethalAtMs`, yol orada kesildiğinde tam gövdeye ulaşan ilk tam ms'yi döndürür; bir dakika önce gemi yaşar (property testi).
  - **Ek fonksiyon:** `segmentsUntil(path, ms)` — uçuş sürerken yapılan settle (K3a) ve testler için.
  - **Recall:** `missionSegments`, sunucunun `recallFrom` / `recalledAt` / yeni `arriveAt` alanlarından iki segment üretir. İkisinden yalnız biri verilirse RangeError.

### F9 — Radyasyon sunucusu (R1: `missions` ve klan savaşı)
- **Migration:**
  - `radiation_sources`: `id`, `season_id`, `anchor_kind ('ZONE'|'PLANET')`, `anchor_id`, `x/y/z` (double), `radius > 0`, `intensity_pct_per_minute >= 0`, `mode ('EMIT'|'SHELTER')`, `active_from`, `active_until`, `label`, `created_at`.
  - `battle_reports.attacker_radiation_lost` (jsonb, varsayılan `'{}'`): savaş öncesi radyasyon kaybı.
  - Gerekirse yeni `notification_kind` değeri enum'un **sonuna** eklenir. Aynı migration içinde kullanılmaz.
- **CLI** `cli/radiation.ts`:
  - Komutlar: `add --planet|--at`, `list`, `end`.
  - Ruleset < 14'te reddeder.
  - Kaynak değiştikten sonra galaxy cache'i ve shard yayınını tetikler, istemciler yeniden çeker.
  - Bu yayın `wipe`'ın silme listesine de eklenir.
- **Rules:** `damage.ts`'e `capLoadToSurvivors` eklenir (ganimet / yük ve Collector salvage kırpma, D9). F0'dan buraya taşındı.
- **Servis** `services/radiation.ts`: `sourcesForSeason`, `settleFlightRadiation(tx, holder, segments)` → `applyDose` → `units` + `damage`; ölen gemileri döner.
- **Entegrasyon:**
  - Savaşan varışlar (§3.5.4) doz sonrası `stack.damage` ile savaşa girer. Hepsi ölürse mevcut `fleetCount(...) === 0` dalı kullanılır (`handlers.ts:~754`); D13 ve bildirim.
  - Diğer inişler: önce doz, sonra kırpma (D9), sonra `landShips`.
  - Klan savaşında her bacakta (staging dahil) doz uygulanır; dalga imha yolu test edilir.
  - Sunucu koruması: `launchAttack` ve `launchTransfer` içinde `RADIATION_LETHAL`.
  - `/api/galaxy` sezonun aktif ve yaklaşan kaynaklarını döner.
- **Testler:** `radiation-flights.test.ts`
  - Gelen, giden ve yanından geçen filo; kaynak dışı rota.
  - Recall, reroute, pace.
  - Kısmi ve toplu ölüm; D13.
  - Settlement başarısızlığı; yük ve salvage kırpma.
  - Uçuş ortasında eklenen kaynak; SHELTER.
  - İstemci tahmini = gerçekleşen doz.
  - Koruma ve onay; ruleset kapısı; CLI.

- ✅ **Yapıldı (2026-09-30).** Testler: `radiation-service` (9), `radiation-flights` (13), `radiation-api` (4), `radiation-cli` (4); `clan.test` ve `clan-war-damage` dosyalarına radyasyon testleri; rules `capLoadToSurvivors` (4). Her koruma testi, kural geçici olarak kapatılıp kırmızıya döndüğü görülerek kanıtlandı.
  - **Temel gözlem:** filo evden tam HP ile kalkar (I1) ve doz herkese eşittir. Bu yüzden gidiş bacağında bulut ya hepsini öldürür ya hiçbirini. Kısmi ölüm yalnız savaş hasarı taşıyan dönüş bacağında (veya elle kurgulanmış hasarda) olur. Bunun sonucu: savaş raporuna yazılacak `attacker_radiation_lost` v1'de hep boş kalırdı. Kod incelemesinde (2026-09-30) ölü durum olarak kaldırıldı; migration 0124 yeniden üretildi (henüz hiçbir yere dağıtılmamıştı). Karışık hasar Monument'larla gelince gerçek bir yolla eklenecek.
  - **Settle noktaları:** saldırı varışı (PvP ve tarafsız dünya, hedefin korunup korunmadığına bakmadan önce), `settleReturn` (dönüş ve recall), `resolveTransfer`, `resolveSettlement`, `resolveClanAid`, klan savaşının üç bacağı (sahnelemeye varış, hücum havuzu, dönüş; worker'ın vazgeçtiği dönüş dahil). Probe ve Death Star yollarına dokunulmadı.
  - **Depo:** mission'ın gemileri `(owner, location)` ile bulunur. Reroute bacakları gemileri ilk ev satırında tutar.
  - **Hepsi ölürse:**
    - Saldırı: savaş olmaz, `releaseStrike` çalışır (recall ile ortak; D13), savunana hiçbir şey söylenmez.
    - Transfer: `LOST`, yük kaybolur.
    - Settlement: `LOST`, kurucu ücret güvenli eve iade edilir, `settlement_lost` gönderilir, dünya hafızası yazılmaz.
    - Klan yardımı: taahhüt `RETURNED` (teslimden sonraysa `DELIVERED` kalır).
    - Klan dalgası: `LOST` + `completeIfSettled`.
  - **Kısmi ölümde yük kırpma (D9):** baskın ganimeti ve salvage `capLoadToSurvivors` ile, klan payı dağıtılmadan önce kırpılır. Transferde kargo ve ücret tek yük olarak kırpılır; gidiş-dönüş filosu hayatta kalanlara sınırlanır. Klan yardımı kendi kapasite ölçüsüyle (`clanTransferCargoCapacity`) kırpılır.
  - **Bildirim:** yeni tür `radiation_lost` `{lost, left, toPlanetId, toPlanetName}`. Yalnız filonun sahibine gider; klan dalgasında dalganın sahibine. Hepsi ölen dönüşte `fleet_returned` gönderilmez.
  - **Koruma (D10):** `launchAttack` ve `launchTransfer`, gidiş bacağı gemi öldürecekse `RADIATION_LETHAL {count}` (409) döndürür; `acknowledgeRadiation` ile geçilir. Rota gövdelerine alan eklendi. Yalnız hasar veren bulut koruma tetiklemez.
  - **`/api/galaxy` `radiation`:** aktif, yaklaşan ve son `2 × TRAVEL.pacedFlightCapMinutes` içinde bitmiş kaynaklar dahil. Böylece istemci, uçuştaki kendi filosunun sönme anını sunucuyla aynı pencerelerle hesaplar. Ruleset < 14'te boş döner.
  - **CLI:** `pnpm radiation add|list|end` (`cli/radiationCommand.ts` saf ayrıştırıcı). Kaynak değişince `publishShard('world')`. Wipe kaynakları siler (kanıtlı).
  - **Önceden var olan kırmızı:** `pirate-field.test.ts` digest'i. HEAD'deki rules kaynağıyla ayrı bir worktree'de aynı değer hesaplandı; bu işten gelmiyor. `neutral-colony-d209` bilinen kırmızı.

### F10 — Radyasyon web
- **`galaxy/RadiationHaze.tsx`:**
  - Yeşilimsi-sarı, additive, `depthWrite:false`, yavaş gürültü.
  - Yoğunluk → opaklık. SHELTER çizilmez. Lag'e duyarlı.
- **`FocusPanel` bulut satırı:** "Radyasyon · dakikada maks HP'nin %3'ü · >%20 hasar tamir ister".
- **Kendi filolarının sönmesi:** `lethalAtMs` anında (D15).
- **`useLaunchPlan` + `LaunchSheet` / `TransferSheet`:** "Rota radyasyondan geçiyor · ~%34 hasar (eşik %20)" satırı; ölümcül rotada onay adımı.
- **Testler:** `lib` fonksiyonları; görsel doğrulama (bulut, launch satırı).
- ✅ **Yapıldı (2026-09-30).** Testler: `radiation-lib` (10), `radiation-launch` (5), `radiation-focus` (5), `radiation-notice` (10); `transfer-sheet` (+2), rules `wingLethalAtMs` (+2), sunucu `pending.fadeAt` (+2). Mevcut `notification-routes` kaydına tür eklendi; `repair-copy` testinin Türkçe iddiası gerçekten Türkçeyi doğrulayacak şekilde güçlendirildi (ortak kurulum her testi İngilizceye sıfırlıyormuş).
  - **Rota tahmini (D10):** `LaunchSheet` ve `TransferSheet`, basılı-tut düğmesinin üstünde üç satırdan birini gösterir: "~%X hasar · %20'yi aşan Tamirhanede bekler", "ücretsiz onarılır" ya da ölümcülse tehdit renginde "N gemiyi varmadan yok eder". Ölümcül rotada basılı tutmak onaydır; `acknowledgeRadiation` gönderilir. Korsan hedefi ve Akademi dersi hariç (v1'de dozlanmıyorlar).
  - **Odak paneli:** dünya bir bulutun içindeyse "dakikada gövdenin %X'i · %20'yi aşan Tamirhaneyi bekler" ya da sığınak satırı çıkar. Sayı yerel biçimde yazılır (TR `%1,5`). Hook'lar sahip olunan dünyanın erken dönüşünden önce (`focus-hook-order` testi bunu yakaladı).
  - **Kendi filonun sönmesi (D15), plan değişikliği:** istemci hesabı yerine sunucu hesaplıyor. Sebep: `pending` kaydında hasar yok ve recall edilmiş uçuşun yalnız son bacağı var; doz ise görevin başından birikiyor. Sunucu `pending` kaydına `fadeAt` koyuyor (`wingLethalAtMs`: en sağlam gemi ne zaman düşer), istemci craft'ı o anda diskten kaldırıyor.
  - **Bildirim:** `radiation_lost` cümlesi 5 dilde; tehdit ailesi, kayıp sonucu, filo simgesi, alarm; tıklayınca filo panosuna gider. `RADIATION_LETHAL` hata metni 5 dilde.
  - **3B pus:** `galaxy/RadiationHaze.tsx`. Yalnız şu an yanan EMIT kaynakları çizilir; tek arka-yüz küre, additive, `depthWrite:false`, yüze bakış açısıyla orantılı alfa (merkez yoğun, kenar sönük), yavaş gürültü. Yeni renk token'ı `--color-v2-radiation: #d8f04a` (döteryum yeşilinden sarıya çalar). Yeni yakılan bulut istemci saatine takılmasın diye filtre beş saniyelik bir saatle yeniden değerlendirilir (görsel koşuda bulunan bir hata).
  - **Görsel doğrulama:** galeri (`launch-radiation`, `launch-radiation-lethal`, `transfer-radiation`, `focus-radiation`; en/tr, 350 @DPR2 ve 1280). 3B pus, izole bir veritabanı + API + Vite üzerinde, CLI ile eklenen bir bulutla fotoğraflandı. İlk hâl sert kenarlı bir disk gibi okunuyordu; yumuşak gaza çevrildi.

### F11 — Radyasyon R2 (ertelenebilir)
- Kapsam:
  - `mining_runs`, `pirate_raids` (korsanın gidiş dozu savaştan önce), `trade_runs`, `intergalactic_convoy_runs`.
  - Bu hatların launch uçlarında (settlement, klan yardımı, klan dalgası, mining, korsan, trade, convoy) tahmin satırı ve `RADIATION_LETHAL` koruması.
- Yöntem: segment → `damage` kolonu → doz → `landShips`. `abandon.ts` içindeki karşılıkları da güncellenir.
- ⏸ **Ertelendi (2026-09-30).** Planın izin verdiği gibi. K4 gereği canlıda bulut yok; v1'de madencilik, korsan, ticaret ve konvoy hatları doz almıyor ve bu sınır `docs/game-design.md`'de yazılı. Bu hatların fırlatma korumaları da gelmiyor. Monument'la birlikte ele alınması doğal.

### F12 — Dokümantasyon
- `docs/game-design.md`: kurallar.
- `docs/balance.md`: Industrial, tamir formülü, F7 ölçümü, D14.
- `docs/glossary.md`: Lot, Tamirhane, Radyasyon, SHELTER.
- `docs/interface.md`: Tamirhane sekmesi.
- ✅ **Yapıldı (2026-09-30).**
  - `game-design.md`: Combat altında "Kalıcı gemi hasarı" ve "Radyasyon" bölümleri (v1 kapsamı ve F11 sınırı dahil).
  - `balance.md`: fiyatlanmış kural (tamir formülü, Industrial L1–L2, koddan okunan rakamlar), F7 ölçümleri, D14.
  - `glossary.md`: Damage (bp), Lot, Tamirhane / Industrial, Radyasyon / SHELTER.
  - `interface.md`: I6c "basılan düğmenin alacağı bedel düğmenin yanında yazar" (fırlatma/transfer tahmini, odak satırı, Tamirhane sekmesi, Defence notu).

### F13 — Yayın adımı (en son)
- `MULTI_WORLD.rulesetVersion` 13 → **14**. Bu, özellik tamamlanmadan **yapılmaz**. Bekleyen prod deploy'u (force wipe → yeni sezon) yarım bir özellikle dağıtılmamalı.
- `packages/rules/test/galaxy-events.test.ts:463` beklentisi (13) güncellenir.
- `MULTI_WORLD.rulesetVersion` ile sezon kuran testler 14 altında yeniden koşulur ve beklentileri gözden geçirilir: `garbage-collector`, `neutral-colony-d209`, `account-deletion`, `multi-world`, `fleet-v2-cutover`.
- Tam suite'ler (server, web, rules, sim) + `pnpm verify`. Mevcut bilinen kırmızılar dışında yeni kırmızı olmadığı raporlanır; baseline yeniden ölçülmez.
- ✅ **Yapıldı (2026-09-30).** `MULTI_WORLD.rulesetVersion = 14`. Rules, web ve sunucu tam koşuldu: sunucudaki 49 kırmızının hepsi HEAD'de de kırmızı ya da bilinen listede. Sim'de ruleset 14'ün yarattığı iki yeni kırmızı var: TAX 0,0445 → 0,0382 (alt sınır 0,04) ve informed arketip 5/5 → 3/5 tohum (42, 4242). **Sahip kararı: kabul.** Bu değer tasarımın bedeli sayıldı; oyun ayarlanmadı. TAX alt sınırı 0,035'e, informed iddiası "tohumların çoğunda"ya çekildi; ikisi de ölçümün hemen altında. Sim tamamen yeşil.
- **Kod incelemesi (2026-09-30):** 9 bulgu doğrulandı ve düzeltildi:
  - secession'da lot–sipariş FK bağı
  - radyasyonla yok olan settlement'a yanlış bildirim
  - sunucunun ölümcül reddinden sonra onay yolu
  - `lethalAtMs` float kenarı
  - ruleset < 14'te Tamirhane sekmesi
  - `planetView` fazla sorguları
  - ölü `attacker_radiation_lost` sütunu (0124 yeniden üretildi)
  - tüm dönüş kanadı ölünce gereksiz iş
  - non-null assertion'lar
- **Tamirhane Üs'e taşındı (sahip isteği, 2026-09-30):** Tamirhane artık her dünyanın Üs → Filo sekmesinde, Tersane ve Hangar'ın altında iki sütunu kaplayan bir kart (`screens/RepairStation.tsx`). Kartın merdiveni yok; basınca Tamirhane menüsü açılır: hasarlı lotlar (varsayılan hepsi seçili, seçimden çıkarılabilir), seçimin toplam bedeli/süresi, kuyruk (karışık işin gemileri, saat, iptal), kurallar ("Nasıl çalışır"). Filo sayfasındaki Tamirhane sekmesi kaldırıldı; oradaki "N tamirde" çipi o dünyanın Üs → Filo → Tamirhane'sini açar. Sunucu lot görünümüne `orderId` ekledi; istek başına lot sınırı `SHIP_DAMAGE.repairLotsPerOrder` oldu. Üs ekranı onarım bitişinde de uyanır.
- **İnceleme (2026-10-01):** Hasar yüzdesi her yerde (Tamirhane, kuyruk, savaş raporu, radyasyon tahmini) `damagePct` ile yukarı yuvarlanıp %99'la sınırlanıyor: 2001 bp eskiden "%20 · Tamirhaneye" okunuyordu, 2000 bp'nin "%20 · ücretsiz" satırının hemen altında. "Yeni geminin %X kadarı" Endüstri yokken hasarın kendisi, Endüstri altında bir kez en yakına yuvarlanıyor. Kuyrukta iş varken alt çubuk yeni işin ne zaman başlayacağını söylüyor; bitişini geçmiş ama henüz kapanmamış iş "Bitiyor…" diyor. 50 lot sınırı sunucu testinde sabit.

  İncelemenin kaçırdığı bir hata da düzeltildi: radyasyonun yok ettiği gemiler servetten düşmüyordu.
- **Yerel wipe sırasında bulunan, bu işten bağımsız hata (2026-09-30):** sezon sonu Dominion denetimi (`assertDominionLedgers`) klan ortak savaşının günlüğünü (`clan_war_dominion_events`) okumuyordu. Bu yüzden ortak savaş kazanılmış hiçbir sezon kapanamıyordu. Denetim artık o günlüğü de sayıyor; birim testi ve `forceSeasonEnd` entegrasyon testi eklendi. Yerel galaksiler ruleset 14 ile yeniden açıldı.

---

## 5. Sıra

```text
F0 → F1 → F2 → F3 → F4 → F5 → F6 → F7       (hasar + tamir + Industrial)
F0 ────────────→ F8 → F9 → F10 → (F11)      (radyasyon; F8 erken başlayabilir)
                                  F12 → F13  (doküman, sonra yayın)
```

## 6. Riskler

| Risk | Azaltma |
|---|---|
| Savaş paritesi (F1) | Önek adımı yalnız ön-hasar varsa çalışır; mevcut testler değiştirilmeden yeşil kalır. |
| Gemi çoğalması / kaybı | Adet yalnız `units`'te tutulur; her yol için I8 testleri. |
| İade çoğalması | Mevcut `cancelBuildOrder` + kilit + durum geçişi; eşzamanlılık testleri. |
| **Wipe / reclaim FK kilidi** | F2'de silme listeleri güncellenir ve dock satırı varken wipe ve reclaim testleri koşulur (emsal: `debris_fields`, `research_orders`, `player_rivals`). |
| **Telescope sinyali bozulması** | F3'te `intel.ts` filtresi + `dock-intel` testi. |
| **Transfer'in kalıcı kilitlenmesi** | Dock satırları `UNITS` ertelemesine sayılmaz. |
| **Bedava tamir (abandon)** | `abandon.ts` inişleri `landShips` kullanır. |
| Yarım özelliğin sezona dağıtılması | Ruleset yükseltmesi F13'te, en sonda. |
| Mirror unutma | F3, F6 ve F7 listeleri; her kalem ya test ya da açık not alır. |

## 7. Kapsam dışı ve ileriye not

- Monument, bekleme ve eşik event'i (K3a). Savunmacının ön-hasarlı savaşması (Monument savaşlarıyla gelir).
- Savaş motoru değişikliği (K1). Zemin savunmaları ve NPC hasarı (D1).
- Canlı radyasyon yerleşimi (K4). Gövde başına radyasyon direnci. Final görseller. Lotun bir kısmını onarma (D12).
- **Radyasyon canlıya çıkınca tasarım kararı gerekecek (Monument ile):**
  - Dock'taki gemi raid'de yok edilemez. Kasıtlı olarak radyasyonda hasar alıp gemileri dock'a sokmak bir "fleet save" yolu olabilir.
  - REPAIR kuyruğu, radar uyarısında kaynak saklamak için 3 slot daha ekler (Tersane kuyruğundaki %50 iptal bedeli burada da geçerli).

## 8. Rev. 2 — Gözden geçirmede düzeltilenler

1. **Sezon wipe (`servers.ts`) ve reclaim / hesap silme (`reclaim.ts demolish`)** tabloları elle, FK sırasıyla siliyor. Yeni tablolar eklenmezse wipe kilitlenir. → F2.
2. **Telescope "filo dışarıda" sinyali ve probe `anyAway`**, `home` dışındaki her satırı sayıyor. Dock'taki tek gemi yanlış istihbarat üretirdi. → F3.6, D6.
3. **Komutan transferi:** Rev. 1'de dock satırlarının transferi ertelemesi öneriliyordu. Bu, tamir etmeyen hareketsiz komutanın hiç taşınamaması demekti. → Artık ertelemez; dock satırları gezegenle taşınır (D7).
4. **Worker `abandon.ts`** kurtarma inişleri `damage` alanını yok sayarsa bedava tamir olur ve I1 bozulur. → F3.5.
5. **Lot satırından adet, sahip ve sezon çıkarıldı** (tek doğruluk kaynağı `units`); inişler arası birleştirme kaldırıldı (D3).
6. **`MULTI_WORLD.rulesetVersion` yükseltmesi** F0'dan F13'e taşındı; bekleyen prod wipe'ı yarım özellik dağıtmasın.
7. **F1'deki savunmacı ön-hasar parametresi kaldırıldı** (I1 sayesinde gereksiz; YAGNI).
8. **Web sahiplik hesapları** (`predict.ts`, `FleetCards`, `TransferSheet`) `fleetAway` üzerinden çalışıyor. Dock oradan çıkınca `fleetDocked` eklenmeli; `BuildQueueId` tüketicileri ve fixture'lar listelendi. → F6.
9. **Radyasyon tahmini istemcide hesaplanır** (`useLaunchPlan`); sunucu yalnız korur. Rev. 1'deki "önizleme uçları" ifadesi yanlıştı.
10. **Nötr gidiş bacağında doz da savaştan önce uygulanır;** Rev. 1 yalnız dönüşü sayıyordu.
11. Eklenen kurallar: yok olan saldırıda commitments'ın geri verilmesi (D13); salvage kırpma (D9); savaş öncesi radyasyon kaybının rapora yazılması; D14 notları; D15 sis kuralı.
12. **İdempotency:** build rotaları gibi durum tabanlı (lot meşgul / sipariş aktif değil). `request_log` ifadesi kaldırıldı.
13. Tamir hiçbir kapıya takılmaz (D11); başlatma rotası `WithPlanet` döner; REPAIR tamamlanması `shipsBuilt`'e yazılmaz.
14. Sim'deki araştırma önkoşul aynası, `contract.test.ts` ve i18n hata kodları eklendi.
