# Koloni Arızaları — Uygulama Planı

> **Durum:** plan. Kod yok. Sahip kararlarının hepsi alındı; açık soru kalmadı.
> **Okuma sırası:** `CLAUDE.md` → bu dosya → `docs/game-design.md` → kod.

## 0 · Sahip kararları

| Konu | Karar |
|---|---|
| "Bağımlılık" | **Koloni sadakati.** 0–100. |
| Sadakat sıfırda | **Koloni `NEUTRAL`'a düşer.** Grace yok, sıfıra değdiği an. |
| Kapsam | **Sadece koloniler.** Capital'de ne arıza var ne sadakat. |
| Sızıntı debris'i | **Herkese açık**, mevcut `debris_fields`, mevcut 40 dk çürüme. |
| Sızıntı tavanı | **Bir arıza en fazla bir depo dolusuna mal olur** — ve hız üretimle sınırlı (§2.6). |
| Çöküş süresi | **İhmal edilen koloni ~48 saatte kopar**, ~34 değil (§4). |
| Arıza isimleri | **Sadece flavor.** "Tersanede isyan" ile "alaşım rafineri arızası" mekanik olarak aynı şey. |
| Arıza zamanlaması | **Öğrenilebilir bir ritim olmayacak.** Bazen arka arkaya. |

## 1 · Ne inşa ediyoruz

Bir koloni, ilgilenilmediğinde **bozulur**. Bozulma rastgele gelen, birbirinden bağımsız
sekiz arıza olarak görünür; her biri o dünyanın bir yeteneğini kapatır. Arızalar
durdukça koloninin **sadakati** düşer; sıfırda koloni sahipten kopar ve `NEUTRAL` olur.

Çekirdek döngüye eklediği şey: **DEVELOP artık bedava değil.** Üç koloni tutmak üç
koloninin bakımını üstlenmek demek — `AMBITION` ile `RISK` arasına gerçek bir fiyat
koyuyor, ve düşen bir koloni haritada **herkes için bir fırsat** hâline geliyor
(`OPPORTUNITY`, `COMPETITION`).

Regresyon sinyali, açıkça izlenecek: bu sistem yalnızca bir **bakım micromanagement'ı**
eklerse yanlış inşa edilmiş demektir. Arıza bir "tamir butonu" değil bir **karar**
olmalı: hangisini önce onarırım, hangisine katlanırım, hangi koloniyi bırakırım.

## 2 · Sekiz arıza ve kodda tam çıpaları

**Sekizi de aynı şeydir.** Aynı tablo satırı, aynı ömür, aynı onarım yolu, aynı bildirim.
İsimler flavor: "Tersanede isyan" mekanik olarak "Alaşım rafinerisinde elektrik kesintisi"
ile birebir aynı yapıdadır. Tek fark hangi etkiyi kapattıkları.

| id | Ne durur | Uygulama çıpası | Menü konumu (tab / item) |
|---|---|---|---|
| `REFINERY_OUTAGE` | Alaşım üretimi | `advanceEconomy` → `ra = 0` | `grow` / `REFINERY` |
| `EXTRACTOR_OUTAGE` | Kristal üretimi | `advanceEconomy` → `rc = 0` | `grow` / `EXTRACTOR` |
| `PLANT_OUTAGE` | Döteryum üretimi | `advanceEconomy` → `rd = 0` | `grow` / `DEUTERIUM_PLANT` |
| `VAULT_LEAK` | Depo + havuz orbite sızar | `advanceEconomy` + `vault_leak_flush` | `grow` / `VAULT` |
| `CORE_OUTAGE` | Aegis söner, yer savunması ateş etmez | `worker/handlers.ts` savaş çözümü | `grow` / `CORE` |
| `TELESCOPE_FAULT` | Teleskop etkisiz, çıplak göz görüşü | `services/traffic.ts:sensorPosts` | `orbit` / `TELESCOPE` |
| `SHIPYARD_REVOLT` | Hiçbir filo kalkamaz | `services/flight.ts:assertFreeBay` | `reach` / `SHIPYARD` |
| `PROSPECTOR_FAULT` | Prospector kullanılamaz | `routes/mining.ts` launch + harvest | `reach` / `PROSPECTOR` |

### 2.1 Üç üretim arızası — `packages/rules/src/economy.ts`

`PlanetEconomyInput`'a `faults?: FaultSet` eklenir; `ra`/`rc`/`rd` hesaplandıktan sonra
ilgili arıza varsa sıfırlanır. **`disruptedUntil`'e dokunulmaz** — o savaş kaynaklı,
zamanlı ve gezegenin tamamını kapatıyor; bu üçü kalemsel ve birlikte yaşayabilmeli.

`PLANT_OUTAGE` yalnızca `plantLevel >= 1` olan dünyada seçilebilir (§3).

### 2.2 `CORE_OUTAGE` — `apps/server/src/worker/handlers.ts` (~satır 755)

```ts
const defenders = garrisonOf(defender.homeFleet, coreOut ? {} : defender.ground);
const result = resolveCombat(attackingFleet, defenders, coreOut ? 0 : defender.shield, …);
```

Evde duran **gemiler savaşır** — susan yalnızca kalkan ve yer emplasmanlarıdır.

Yer birimleri savaşa girmediği için `defenderHome` geri yazımındaki `defender.ground`
döngüsü de arızayı bilmek zorunda: girmeyen birim `?? 0` ile yok sayılmamalı,
`NON_COMBATANT_HULLS` dalının aynısı gibi elden taşınmalı. **Bu satır atlanırsa arıza
yer savunmasını durdurmaz, imha eder.** Sistemin en kolay kaçırılacak hatası budur.

Kalkanı okuyan her yol (Death Star vuruşu, `strategic_intercept`) tek bir
`defenceOnline(planetId)` yardımcısından geçmeli.

### 2.3 `TELESCOPE_FAULT` — `apps/server/src/services/traffic.ts:sensorPosts`

`sensorSphere(at, telescopeLevel, radarLevel, planetId)` çağrısına `telescopeLevel = 0`
geçilir. `sensorReach(0)` zaten çıplak göz tabanını döndürüyor — "default görüş"
tam olarak budur ve `packages/rules` saf kalır.

Arıza yalnızca **görüş yarıçapını** düşürür, teleskopun sattığı **watch slot**'lara
dokunmaz: bir izleme yuvasını arıza sırasında düşürmek, oyuncunun günler önce kurduğu
bir gözlemi sessizce siler ve geri gelmesi mümkün olmaz.

### 2.4 `SHIPYARD_REVOLT` — `apps/server/src/services/flight.ts`

`assertFreeBay` on iki kalkış çağrı yerinin hepsinde (saldırı, transfer, yerleşim,
ticaret, korsan, konvoy, madencilik, stratejik), `assertFreeClanAidBay` on üçüncüsünde
çalışıyor. İkisinin de başına `await assertDeparturesAllowed(tx, planetId)`. Tek çıpa,
atlanmış lane yok.

**Sonda kalkışı (`/api/intel/probe`) kapsam dışı** — sonda uçuş yuvası kullanmaz,
tersanede üretilmez, sahibin talimatı "gemi yollayamazsın". Bilgi katmanı arıza
sırasında da çalışmalı; yoksa arıza oyuncuyu kör + felç bırakır.

**Dönüş ve iniş engellenmez.** Uçuştaki filo eve gelir; arıza yalnızca kalkışı durdurur.

### 2.5 `PROSPECTOR_FAULT` — `apps/server/src/routes/mining.ts`

`/api/mining/launch` ve `/api/mining/harvest` → 409 `FAULT_PROSPECTOR`.
`/api/mining/runs/:runId/recall` **reddedilmez** — dışarıdaki kazıcıyı geri çağırmak
arızanın engellemesi gereken şey değil.

### 2.6 `VAULT_LEAK` — sızıntı ve debris

**Oran.** İki maddeli, ikisi de sütun başına:

```
leakPerHour_i = min( storageCap_i(rate_i, vault) / FAULT.leakDrainHours,   // 48
                     rate_i × FAULT.leakIncomeCap )                        // 2
```

Söylenebilir hâli: **sızıntı, tam bir depoyu 48 saatte boşaltacak hızda akar — ama
hiçbir zaman üretiminin iki katından hızlı değil.**

İkinci madde zorunlu. Depo saatleri üretimden çok daha hızlı büyüyor
(`storageHours`'daki satın alma garantisi), yani tek başına birinci madde şunu veriyordu:

| Core | Üretim/saat | Tavansız sızıntı/saat | **Tavanlı** |
|---|---|---|---|
| 6 | 1.265 | 1.422 | **1.251** |
| 12 | 2.689 | 5.481 | **4.715** |
| 18 | 4.565 | 18.600 | **9.129** |
| 24 | 6.640 | 199.015 | **13.280** |
| 30 | 8.878 | 2.421.694 | **17.757** |

Üretimi 8.878 olan bir dünyada saatte 2,4 milyon sızıntı bir arıza değil, bir silme
işlemi. Tavanla birlikte sızıntı her seviyede aynı şeyi ifade ediyor: **kapalı geçen
her saat, iki saatlik üretimini orbite ve komşunun görüş alanına koyar.**

Tavan, sütun başına olduğu için döteryumu da kendiliğinden düzeltiyor: döteryum deposu
kristal hızından boyutlanıyor, yani kendi üretiminin ~30 katı büyüklükte — tavansız
hâlde o sütun ilk saatte sıfırlanırdı.

**Toplam tavan.** Tek bir arıza oluşumu boyunca akabilecek toplam, sütun başına
**bir depo doluşu** ile sınırlı (`FAULT.leakTotalStores = 1`). Tavana ulaşınca sızıntı
durur; arıza **durmaz** — satır yerinde kalır, sadakat düşmeye devam eder, onarım hâlâ
gerekir. Fix sheet bunu söyler: *"Kasa boşaldı — akacak bir şey kalmadı."*

**Sıra.** Önce havuz (`buffer*`), sonra depo. `advanceEconomy` içinde üretim havuza
eklendikten **sonra** çekilir — "malzeme yoksa da doldukça akar" böylece kendiliğinden
doğru olur: boş havuza giren üretim aynı aralıkta çıkar.

**Debris'e dönüşüm.** Sızan miktar `planets.pending_leak_*` sütunlarında birikir (lazy,
bedava). Arıza aktifken kolonide duran bir `vault_leak_flush` scheduled event
`FAULT.leakFlushMinutes` (20) aralığında kendini yeniden kurar; her ateşlemede birikmiş
yığın `DEBRIS.minimum` (250) üstündeyse gezegene çıpalı, **herkese açık** bir
`debris_fields` satırı yazar ve yığını sıfırlar. Onarımda son bir flush.

Neden lazy değil de event: debris 40 dakikada çürüyor ve herkese açık. Sızıntıyı
yalnızca sahibi oyunu açtığında yazarsak 24 saat sonra tek seferde taze bir tarla
belirir — kimse yarışamaz, çürüme anlamını yitirir, arıza komşu için görünmez olur.
Mimarideki ayrım tam olarak bu: *bir an, kimse bakmıyorken bile olmak zorundaysa*
scheduled event'tir.

`debris_fields` kısıtı `(planetId not null and pirateRaidId null)`; `missionId` null
kalabilir, şema değişikliği yok. `reports.ts`'nin "bu enkazı hangi savaş yaptı" yolunun
`missionId` null'ı kaldırdığı **implementasyondan önce doğrulanacak**.

## 3 · Arızalar nasıl gelir

**Kapı:** `kind = 'COLONY'` **ve** `CORE >= 6`. Capital hiçbir zaman.

**Model:** koloni başına tek bir `fault_spawn` scheduled event. Ateşlendiğinde:

1. Uygun ve **o an aktif olmayan** arızalar listelenir. `PLANT_OUTAGE` yalnızca
   `DEUTERIUM_PLANT >= 1` ise listede. "Aynı arıza aynı anda ikinci kez olamaz" bir
   kontrol değil, listenin yapısal sonucu.
2. Liste boşsa event yeniden kurulur, hiçbir şey olmaz.
3. Değilse üniform çekim, arıza satırı, bildirim.
4. Sonraki event §3.1'deki dağılımla kurulur.

### 3.1 Ritim — öğrenilemez olmak zorunda

Sabit 6 saatlik aralık **reddedildi**: oyuncu ritmi öğrenir ve altı saatte bir açıp
bakar. Oyun bir alarm saati değil.

Gap, iki kollu bir karışım:

```
p = FAULT.burstChance (0.30)  → gap ~ Exp(ortalama FAULT.burstMeanMinutes = 25 dk)
1 - p                         → gap ~ Gamma(2, ortalama FAULT.calmMeanHours = 8.4 sa)
gap = max(gap, 60 sn)
```

Ortalama gap = `0.30 × 0.42sa + 0.70 × 8.4sa = 6 saat` → sekiz arıza için beklenen süre
**48 saat**. Ölçüldü: 200k çekimde gap ortalaması 6,02 saat.

Neden bu şekil:

- **Arıza onda üç ihtimalle bir öncekinin hemen ardından gelir** — "bazen bir kaçı arka
  arkaya". Gap'lerin **%29'u bir saatin altında**. Oyuncu iki arızayı yarım saat içinde
  yiyebilir.
- **Sakin kol Gamma(2), düz üstel değil.** Üstelin modu sıfırdadır: arka arkaya birden
  fazla çok kısa sakin gap gelmesi gerekenden olası, ve bu doğrudan koloniyi 20 saatte
  kaybettiren kuyruğu besliyordu. Gamma(2) — iki üstelin toplamı, tek satır — üst
  kuyruğu korurken alt kuyruğu kesiyor: ölçülen %5'lik en kötü çöküş 25 saatten
  **29 saate** çıkıyor, medyan 47,3'ten **49 saate**.
- **Öğrenilebilir bir periyot yok.** Burst kolu memoryless; sakin kolun modu sıfırdan
  farklı ama bileşik dağılımın varyansı hâlâ ortalamasının üstünde. Altı saatte bir
  açıp bakmanın hiçbir karşılığı yok.

Rastgelelik `packages/rules` saflığını bozmadan çağıranın verdiği `Rng` ile —
mevcut `seededFrom(eventId)` deseni, böylece bir spawn'ın neden o arızayı ve o gap'i
seçtiği yeniden üretilebilir.

İlk event **CORE 6 tamamlandığında** (`applyBuildCompletion`) kurulur; mevcut kolonilere
migration ile geriye dönük.

## 4 · Sadakat

`planets.loyalty` — 0–100, `real`, lazy. Yalnızca `CORE >= 6` kolonilerde anlamlı;
altında 100'de sabit ve gösterilmiyor.

```
k = o an aktif arıza sayısı
k === 0 : +100 / FAULT.loyaltyRecoverHours                  saatte   (12)
k  >  0 : -100 / FAULT.loyaltyCollapseHours × (k / 8)^3     saatte   (12)
```

Sekiz arıza aynı anda → 100'den 0'a **tam 12 saat**, istenen sabit. Küp, arızaların
**birikimli** olduğunu söyleyen şey: dört arıza saatte 1,04 (tek başına 96 saat),
altı arıza 3,52, sekiz arıza 8,33. Söylenebilir hâli: **her arıza, sadakat kaybını bir
öncekinden daha çok hızlandırır.**

Küp keyfi değil, ölçülmüş: doğrusal düşüşle ihmal edilen koloni ortalama 35,5 saatte
kopuyordu — "48 saatte tüm arızalar aktif" noktasından önce, yani tablo dolmadan dünya
gidiyordu. Üsteller denendi:

| Üs | Ortalama çöküş | Medyan | En kötü %5 |
|---|---|---|---|
| 1 (doğrusal) | 35,5 sa | 33,5 | 20,0 |
| 2 | 45,1 sa | 42,6 | 23,4 |
| **3** | **49,8 sa** | **49,0** | **29,0** |
| 4 | 52,6 sa | 49,8 | 26,2 |

Üç, hedefi ("~46–48 saat") tutturan ve en temiz kapalı formu olan üs. 40.000 koşuluk
Monte Carlo, §3.1'deki gap dağılımıyla.

**Mutlak taban 12 saattir ve kaldırılamaz.** Sekiz arıza ilk saatlerde arka arkaya
gelirse — burst kolunun izin verdiği şey — çöküş 12 saat sonrasıdır, çünkü "sekiz arıza
= 12 saat" verilmiş sabittir. Ölçülen en kötü koşu 13,2 saat, ilk yüzdelik 23 saat.
Bu tail'i daha yukarı çekmenin tek yolu ya bursts'ü ya da 12 saat sabitini feda etmek.

Saf fonksiyon `packages/rules/src/faults.ts:advanceLoyalty`; planet tick'i ile aynı
`lastTickAt` çıpasını kullanır, ayrı saat tutmaz.

**Uyarılar.** Kayıp sürpriz olamaz (Predictability). `colony_loyalty_warning` bildirimi
%50, %25 ve %10'da bir kez gider; payload sadakati ve **mevcut hızla kalan süreyi**
taşır. Uyarı hiçbir şeyi geciktirmez, yalnızca okunabilir kılar.

**Sıfırda:** koloni kopar — §5.

## 5 · Koloni koptuğunda

Sadakat sıfıra değdiği an, `colony_secession` scheduled event içinde tek transaction'da:

1. `planets.kind = 'NEUTRAL'`, `controllerPlayerId = null`, `protectedUntil = null`,
   `disruptedUntil = null`, sezon telemetrisi `seasonTelemetrySegments`'e kapatılır
   (`transferPlanetControl`'un yaptığının aynısı).
2. `neutral_planet_state` satırı yazılır: `tier` CORE seviyesinden türetilir
   (`CORE ≤ 9 → 1`, `10–15 → 2`, `≥16 → 3`), `profileSeed` gezegen id'sinden
   deterministik, `economyAnchorAt = now`.
3. **Binalar, enstrümanlar, uydular ve stok yerinde kalır.** `neutralEconomyAt` zaten
   dünyanın kendi bina satırlarını okuyor — düşen koloni üretmeye devam eder.
4. **Yer emplasmanları dünyayla birlikte kopar** (`ownerPlayerId = null`, bakıcının
   muhafızı olur). **Mobil gemiler ve prospector'lar capital'e alınır** — filo bir
   savaş olmadan kaybedilmez; *"the fleet is the bet"* bunu gerektiriyor.
5. Arıza satırları, onarımları, `pending_leak_*` ve `loyalty` sıfırlanır; bekleyen
   `fault_spawn` / `vault_leak_flush` / `fault_repair_complete` event'leri iptal.
6. Uçuştaki işler: `reclaim.ts:busy()`'nin saydığı satır kategorilerinin aynısı —
   dönüş bacakları `safeHomePlanet`'e yönlendirilir, `build_orders` terk edilir
   (iade yok: kaynak o dünyanın stoğuna harcanmıştı, stok dünyayla gitti).
7. `colony_lost` bildirimi — **yeni notification kind gerekmez**.
8. Dominion **üretilmez**. D2: dominion sıfır toplamlıdır ve yalnızca savaş üretir.
   Kopuş bir **wealth** kaybıdır.
9. `assertColonyCapacity` sayacında yer açılır — oyuncu yeni bir koloni kurabilir.

**Sonrası — ve bu sistemin en iyi tarafı.** `reinforceNeutral` bakıcı muhafızını
template'e göre bedava tamamlıyor, ama **binaları asla indirmiyor**. Düşen bir core-18
kolonisi haritada core-18 binalarıyla, tier-3'ün mütevazı muhafızıyla duran bir
**ödül** olarak kalır: onu ilk alan büyük bir dünya kazanır. Bir komşunun ihmali
herkesin fırsatı hâline geliyor — `OPPORTUNITY` ve `COMPETITION`, ek sistem olmadan.

**`releasePlanetControl` D179'da bilinçli olarak silinmişti** (`ownership.ts`'deki not
duruyor). Bu adım onu geri getiriyor. Karar verilmiş; not, D167/D179'un ödediği
bedellerin — 1'den 6'ya kadarki maddelerin — yeniden ödenmesi gerektiği için duruyor.

## 6 · Onarım — üç eşzamanlı lane

Mevcut `build_orders` **kullanılmaz**: o kuyruk seri (D4) ve iptal edilebilir; istenen
ikisinin de tersi.

Onarım durumu **arıza satırının kendisinde**:

```
repair_slot        integer null   -- 0..2
repair_started_at  timestamptz null
repair_ready_at    timestamptz null
```

- Eşzamanlılık: `unique (planet_id, repair_slot) where repair_ready_at is not null` —
  `build_orders_planet_queue_slot_active_idx` ile birebir aynı şekil.
- Süre: uniform **5–15 dk**, sunucuda `Rng` ile çekilir.
- Fiyat (§7) depodan **başlangıçta** düşülür.
- **İptal yok.** Route yok, buton yok; `QueueStrip`'e `onCancel` geçilmez (prop zaten
  opsiyonel: *"Omit for irreversible lanes such as commander research"*).
- Bitiş: `fault_repair_complete` → satır silinir; `VAULT_LEAK` ise son flush,
  `TELESCOPE_FAULT` ise `refreshSensorEpoch`.
- Dördüncü lane isteği: 409 `FAULT_REPAIR_SLOTS_FULL`.

## 7 · Fiyat merdiveni

Üç kademe, `constants.ts`'de **yazılmış tablo** (`ECON.storageHoursLadder` deseni).
Türetilmiş formül denendi, tutmuyor: verilen üç çapa noktasında kademeler arası açıklık
daralıyor (core 6'da 1:2:4, core 18'de 1:1,5:2) ve tek çarpan bunu veremiyor.

| Kademe | Arızalar |
|---|---|
| T1 | `REFINERY_OUTAGE`, `EXTRACTOR_OUTAGE`, `PLANT_OUTAGE` |
| T2 | `TELESCOPE_FAULT`, `PROSPECTOR_FAULT` |
| T3 | `VAULT_LEAK`, `CORE_OUTAGE`, `SHIPYARD_REVOLT` |

Tablo alaşımı verir; kristal T1'de yok, T2'de `×0,4`, T3'te `×0,5`.

| Core | T1 | T2 | T3 |
|---|---|---|---|
| 6 | 25 | 50 | 100 |
| 7 | 40 | 75 | 140 |
| 8 | 60 | 110 | 190 |
| 9 | 90 | 155 | 260 |
| 10 | 130 | 220 | 360 |
| 11 | 200 | 330 | 530 |
| 12 | **300** | **500** | **800** |
| 13 | 400 | 640 | 980 |
| 14 | 510 | 790 | 1.180 |
| 15 | 630 | 950 | 1.390 |
| 16 | 760 | 1.120 | 1.610 |
| 17 | 880 | 1.300 | 1.800 |
| 18 | **1.000** | **1.500** | **2.000** |
| 19–29 | seviye başına ≈ %12 | | |
| 30+ | 3.900 | 5.800 | 7.800 — **sabit** |

Ölçek kontrolü: core 18'de T3 = 2.000 alaşım, gelir 3.000/saat → ~40 dakikalık gelir.
Core 30'da 7.800, gelir 5.826/saat → ~80 dakika. "Ufak miktarlar, core'a göre ufak ufak
artsın" karşılanıyor; hiçbir noktada bir yükseltmeyle yarışmıyor.

## 8 · Veri modeli

Yeni migration (`0089_*` — `0088` çalışma ağacında zaten var, sezon ödülleri):

```sql
create table planet_faults (
  id           uuid primary key default gen_random_uuid(),
  planet_id    uuid not null references planets(id),
  kind         text not null,
  started_at   timestamptz not null,
  leaked_alloy real not null default 0,      -- sızıntı tavanı için, sütun başına
  leaked_crystal real not null default 0,
  leaked_deuterium real not null default 0,
  repair_slot  integer,
  repair_started_at timestamptz,
  repair_ready_at   timestamptz,
  repair_cost  jsonb,
  constraint planet_faults_kind_check check (kind in (…8 değer…)),
  constraint planet_faults_slot_check check (repair_slot is null or repair_slot between 0 and 2),
  constraint planet_faults_repair_pair check (
    (repair_slot is null and repair_started_at is null and repair_ready_at is null)
 or (repair_slot is not null and repair_started_at is not null and repair_ready_at is not null))
);
create unique index planet_faults_planet_kind_idx on planet_faults (planet_id, kind);
create unique index planet_faults_repair_slot_idx on planet_faults (planet_id, repair_slot)
  where repair_ready_at is not null;
create index planet_faults_planet_idx on planet_faults (planet_id);
```

`planets` üzerine: `loyalty real not null default 100`,
`pending_leak_alloy/crystal/deuterium real not null default 0`.

`event_kind` enum'a **sona** eklenir (enum sırası fiziksel kimlik): `fault_spawn`,
`fault_repair_complete`, `vault_leak_flush`, `colony_secession`.
`notification_kind` enum'a: `colony_fault`, `colony_loyalty_warning`.
Kopuş mevcut `colony_lost`'u kullanır.

`schema-drift.test.ts` ve `contract.test.ts` bunlarla birlikte güncellenecek.

## 9 · Fazlar

Her faz tek başına sevk edilebilir ve kendi testleriyle yeşil olmadan sonrakine
geçilmez. **TDD zorunlu:** önce test (§10), FAIL, sonra implementasyon.

**Faz 1 — kurallar (saf).** `packages/rules/src/faults.ts`: `FaultKind`, `FaultSet`,
uygunluk, sadakat matematiği, fiyat tablosu, sızıntı oranı ve tavanı, spawn gap
dağılımı. `constants.ts:FAULT`. `economy.ts`'ye arıza ve sızıntı farkındalığı.

**Faz 2 — depolama ve okuma.** Migration, `planet_faults`, `loadLocked`'ın arızaları
yüklemesi, `planetView`'ın yayınlaması, `/api/planet` sözleşmesi. Hâlâ hiçbir arıza
oluşmuyor; elle yazılmış satır okunabiliyor.

**Faz 3 — etkiler.** Sekiz çıpanın hepsi (§2). **Sistemin en riskli fazı** — sekiz alt
sistemin davranışı değişiyor ve *arıza yokken hiçbirinin farklı davranmadığını*
kanıtlamak, arıza varken durduğunu kanıtlamak kadar önemli.

**Faz 4 — spawn ve onarım.** `fault_spawn`, `fault_repair_complete`,
`vault_leak_flush` handler'ları; `POST /api/planets/:planetId/faults/:faultId/repair`;
bildirimler.

**Faz 5 — arayüz.** §11.

**Faz 6 — sadakat ve kopuş.** Sadakat canlanır, uyarılar, §5'in dokuz maddesi.
**Ayrı faz, çünkü geri alınamaz bir sahiplik kaybı yazıyor** ve önceki hiçbir faz buna
bağlı değil. Faz 5'e kadar sistem tam olarak çalışır, sadece koloni kaybı yoktur.

## 10 · Test planı (önce yazılacaklar)

**`packages/rules/test/faults.test.ts`**
- Uygunluk: plant yoksa `PLANT_OUTAGE` seçilemez; capital hiç seçilemez; CORE 5'te yok.
- Sadakat: k=8 → tam 12 saatte 0; k=1 → 96 saat; k=0 → geri dolum; 0/100 kenetlenmesi;
  sıfır aralık, bir haftalık aralık, geriye giden saat.
- Fiyat tablosu: core 5/6/12/18/30/31/99 → 30 ile aynı.
- Sızıntı: tam depo tam 48 saatte biter; havuz önce boşalır; boş gezegen negatife
  düşmez; aralık içinde üretilen de akar; **tavan bir depoda durur ve arıza yaşamaya
  devam eder**.
- Spawn dağılımı: 100k çekimde ortalama gap 6 saat ± tolerans; burst kolu payı ~%30;
  gap hiçbir zaman 60 sn altında değil; **sabit bir periyot yok** (ardışık gap'ler
  arasında korelasyon yok).

**`packages/rules/test/economy.test.ts`** (mevcut, genişletilir)
- Arıza yokken `advanceEconomy` çıktısı **bit bit** eskisiyle aynı. Faz 1'in güvencesi.

**`apps/server/test/faults.test.ts`**
- Spawn aynı arızayı iki kez üretmez; hepsi aktifken event boşa döner ve kendini
  yeniden kurar.
- Capital'de arıza yok; CORE 6'da ilk event kuruluyor.
- Üç onarım eşzamanlı başlar, dördüncü 409.
- İptal route'u **yok** (sözleşme testi).
- Kaynak yetmezse 409 ve hiçbir şey düşülmez.
- Aynı arızaya iki eşzamanlı onarım isteği → biri kazanır (`concurrency.test.ts` deseni).
- Redelivery: `fault_repair_complete` iki kez işlenirse arıza bir kez silinir.

**`apps/server/test/fault-effects.test.ts`**
- Sekiz etkinin her biri: arıza varken durur, yokken durmaz.
- `CORE_OUTAGE`: yer savunması **ateş etmez ama yok da olmaz** — savaş sonrası sayı aynı.
- `SHIPYARD_REVOLT`: on üç kalkış lane'i reddedilir; iniş, dönüş ve sonda reddedilmez.
- `TELESCOPE_FAULT`: görüş çıplak göze düşer, watch slot'lar durmaz.

**`apps/server/test/vault-leak.test.ts`**
- Flush `DEBRIS.minimum` altında tarla yazmaz, üstünde yazar.
- Yazılan tarla **herkese açık**: sahibi olmayan oyuncunun `/api/mining/field` görüşünde.
- Onarımda son flush, `pending_leak_*` sıfır.
- Tavan dolduktan sonra yeni tarla yazılmaz.

**`apps/server/test/colony-secession.test.ts`** (Faz 6)
- Sadakat sıfırda dünya `NEUTRAL`, `neutral_planet_state` tier'ı CORE'dan doğru.
- Binalar duruyor; yer savunması bakıcıya geçti; mobil filo capital'de.
- Dominion üretilmedi; `colony_lost` bir kez gitti; koloni kotasında yer açıldı.
- Bekleyen event'ler iptal; uçuştaki dönüşler `safeHomePlanet`'e indi.
- Düşmüş dünyaya uçmakta olan bir saldırı `resolveNeutralBattle`'a düşüyor.

**`apps/web/test/faults.test.tsx`**
- Arızalı item greyish + ikon; tab'da ikon; tıklayınca **fix sheet**, yükseltme sheet'i
  değil.
- Bildirime tıklamak: doğru koloni seçiliyor, doğru tab açılıyor, doğru item'a scroll
  ediliyor — sekiz arızanın her biri için tablo testi.
- Onarım şeridinde iptal kontrolü **yok**.
- `notification-routes.test` genişletilir: `colony_fault` ve `colony_loyalty_warning`
  `DESTINATION` içinde. Eksik giriş sessizce düşüyor; testin varlık sebebi bu.

**Sunucu testleri seri koşar** (tek paylaşılan Postgres).

## 11 · Arayüz

Dört soru (`CLAUDE.md`) her yüzeyde cevaplanacak.

### 11.1 Onarım şeridi

`PlanetScreen`'de `BuildQueues`'un **hemen altında**, aynı `plate plate-inset`
kabuğuyla `FaultRepairs`. Üç yuva, `QueueStrip` yeniden kullanılır, `onCancel` yok.
Hiç arıza yoksa **section render edilmez** — `BuildQueues`'un boş hali için ödenen
dersin aynısı (*"üretim yoksa bile full section açık bom bom duruyor"*). Arıza var ama
onarım yoksa tek satır: kaç arıza, en pahalısının fiyatı, "Onar".

### 11.2 Tab çubuğu

`Segment<T>`'e `mark?: ReactNode`; `Tabs` arızalı item'ı olan tab'a küçük arıza ikonu.
Sayı yok — ikon "burada bir şey bozuk" der, kaç tane olduğu tab'ın içinde okunur.
Bu, D170'te kaldırılan **tavsiye veren pip** değil: bir olgu, bir sıralama değil.

### 11.3 Menü item'ı

`UpgradeRow` arızalıyken hafif greyish yıkama, greyish kenarlık, sağ üstte arıza ikonu.
Satır basılabilir kalır ama **fix sheet** açar. Arıza sırasında yükseltme kapalı: bozuk
bir rafineriyi yükseltmek okunmuyor ve satırın tek bir anlamı olmalı.

### 11.4 Fix sheet (yeni)

Alttan gelen, `ItemSheet`'ten ayrı yüzey:

- **Ne oldu** — bir cümle: arızanın adı ve ne durduğu.
- **Sana neye mal oluyor** — *o dünyaya ait ölçülmüş* rakam: "saatte 1.770 alaşım
  üretilmiyor", "saatte 5.481 kaynak orbite akıyor ve herkes görebiliyor". Bu satır
  arızayı bildirimden **karara** çevirir; olmazsa oyuncu neyi onardığını bilmiyor.
- **Ne kadar** — fiyat, `SpendBar` ile karşılanabilirlik.
- **Ne kadar sürer** — "5–15 dk" aralığı; süre çekiliyor, kesin sayı vaat edilmiyor.
  Predictability: girdiler ve kural verilir, cevap verilmez.
- **İptal edilemez** — butonun üstünde, basmadan önce.

### 11.5 Bildirim ve derin bağlantı

`colony_fault` payload: `{ planetId, planetName, fault, group, itemId }`.

Yol: `Signals` satırına basılınca `selectPlanet(planetId)` → `onPanel('planet')` →
`setRequestedPlanetGroup(group)` → `PlanetScreen`'e yeni `focusItem` prop'u → mevcut
`focused` state'i ve `goToNeed`'in scroll davranışı yeniden kullanılır.

Gereken plumbing: `onOpen(panel, stop, reportMissionId)` imzası
`focus?: { planetId?, group?, itemId? }` alacak şekilde genişler; `panelRoute.ts`'de
`nextPanelStop`'un yanına `nextPanelFocus` — aynı "istek yalnızca onu taşıyan gezinmeye
aittir" kuralı, aynı sebeple ayrı fonksiyon ve ayrı test.

`DESTINATION`'a iki giriş. Eksik giriş **sessizce** düşer; bu yüzden
`notification-routes.test` genişletilmeden giriş yazılmaz.

### 11.6 Sadakat göstergesi

`PlanetHero`'da yalnızca koloniler için ince bir çubuk. Yüzde **ve** "şu anki hızla
X saat". İkinci kısım olmadan çubuk `SHOW` ediyor ama `HELP` etmiyor: oyuncunun bilmesi
gereken %34 değil, **ne kadar vakti olduğu**.

## 12 · Dokunulan ve kırılabilecek yerler

| Yer | Risk | Koruma |
|---|---|---|
| `advanceEconomy` | Oyundaki her transaction'ın tepesinde | Arıza yokken bit-bit aynı çıktı testi |
| `worker/handlers.ts` savaş | Yer savunması **yok edilebilir** | Savaş sonrası sayı testi |
| `assertFreeBay` | 13 kalkış lane'i | Her lane için ayrı test |
| `sensorPosts` | Fog kuralları | `intel-states`, `asteroid-fog` yeşil kalmalı |
| `debris_fields` | `missionId` null yolu | `reports.ts` doğrulanacak |
| `event_kind` enum | Sıra fiziksel kimlik | Yalnızca sona ekleme |
| `ownership.ts` | D179 geri açılıyor | Faz 6, ayrı sevkiyat |
| `neutral.ts` | Düşen dünya bakıcı kurallarına giriyor | `colony-secession.test.ts` |
| `planetView` | İstemci sözleşmesi | `contract.test.ts` |

## 13 · Balans kolları (hepsi tek sabit)

| Sabit | Varsayılan | Ne yapar |
|---|---|---|
| `FAULT.minCoreLevel` | 6 | Arızaların başladığı seviye |
| `FAULT.burstChance` / `burstMeanMinutes` | 0.30 / 25 | Arka arkaya gelme sıklığı |
| `FAULT.calmMeanHours` | 8.4 | Sakin kolun ortalaması (ikisi 48 saati verir) |
| `FAULT.loyaltyCollapseHours` | 12 | Sekiz arızayla sıfıra iniş |
| `FAULT.loyaltyCurveExponent` | 3 | Çöküşün birikimliliği — çöküş süresini belirler |
| `FAULT.loyaltyRecoverHours` | 12 | Arızasız geri dolum |
| `FAULT.leakDrainHours` | 48 | Sızıntı hızı (depo tarafı) |
| `FAULT.leakIncomeCap` | 2 | Sızıntı hız tavanı (üretim tarafı) |
| `FAULT.leakTotalStores` | 1 | Bir arızanın toplam maliyeti |
| `FAULT.leakFlushMinutes` | 20 | Debris tarlası yazma aralığı |
| `FAULT.repairMinutes` | 5–15 | Onarım süresi aralığı |
| `FAULT.repairSlots` | 3 | Eşzamanlı onarım |
| `FAULT.priceLadder` | §7 | Fiyatlar |

---

## 14 · Sevk edilen — uygulama notları

Plan ile kodun ayrıldığı yerler. **Kod kesin bilgi; bu bölüm neden ayrıldığını tutuyor.**

### Uygularken bulunan üç gerçek hata

**1 · Spawn idempotent değildi.** Çekimi event id'sinden seed'lemenin yettiğini varsaydım.
Yetmiyor: çekim *aktif olmayan* arızalardan yapılıyor, ilk koşudan sonra havuz bir eleman
kısalıyor ve aynı rastgele sayı **başka** bir arızaya düşüyor. Worker commit edip
`complete()` edemeden ölürse reaper satırı geri veriyor ve koloni ikinci bir arıza
yiyordu — sessizce, sezonun kalanı boyunca. **Determinizm, değişen bir küme üzerinde
idempotens değildir.** `planet_faults.spawn_event_id` + unique index bağladı.

**2 · Flush dünyayı ilerletmiyordu.** `pending_leak_*` yalnızca lazy tick tarafından
yazılıyor. `vault_leak_flush` handler'ı kolonu ilerletmeden okuyunca sahibin son
ziyaretindeki değeri buluyordu — dokunulmamış bir dünyada sıfır, sonsuza kadar. Sızıntı
ancak kurbanı oyunu açtığında orbite çıkardı, yani feature'ın tam tersi. `loadLocked`
eklendi.

**3 · `PROSPECTOR` hiçbir tab'a ait değildi.** `TAB_OF` yalnızca engellenen satın alma ve
araştırma gereksinimi tarafından okunuyordu ve ikisi de bir craft'a takılamaz. Bir arıza
takılabiliyor; eksik giriş `PROSPECTOR_FAULT` bildirimini Üretim tab'ına indiriyordu.

### Plandan sapmalar

| Konu | Planda | Sevk edilen | Neden |
|---|---|---|---|
| Sızıntı aritmetiği | blok: üretim ekle, sızıntıyı çıkar | **sürekli, kapalı form** (`leakColumn`) | Blok hesabı bir günlük yokluğu ~%67 fazla cezalandırıyordu: havuz ilk adımda tavana dayanıyor, sızıntı hem tavanı hem depoyu yiyor. Sürekli modelde havuz hiç dolmaz, üretim hiç durmaz, kayıp iki hız arasındaki farktır. |
| Sızıntı oranı | nominal | **nominal, kasten** | Faulted rate kullanılsa rafineri arızası sızıntıyı da durdururdu: oyuncu madeni bozarak cevheri koruyabilirdi. |
| Sızıntı zaman tabanı | belirtilmemiş | **üretken dakikalar** | `disruptedUntil` "yüzey çalışmıyor" demek; çalışmayan tesisin kasası da akmıyor. Kalkan rejenerasyonu tek istisna olarak kaldı. |
| Onarım kapısı | 8 × `assertFreeBay` | **required parametre** | `faults`'ı sorgu yerine argüman yaptım; on üç çağrı yerinin hepsini derleyici gezdi. `storageCap`'in docblock'undaki aynı gerekçe. |
| `defenceOnline` | planlandı | **sevk edildi** | İki okuyucusu var: sıradan akın ve Death Star vuruşunun `shieldDestroyed` raporu. İkincisi olmasa rapor hiç yanmamış bir kubbeyi yaktığını iddia ederdi. |
| Transfer politikası | dört değer | **beşinci: `WORLD`** | Arıza event'leri bir DÜNYAYA ait ve komutan transferi dünyaları taşımıyor. `GLOBAL` aynı davranışı verirdi ve "galaksi çapında" ile "tek gezegene cıvatalı"yı aynı kategori diye öğretirdi. |
| Sadakat izleyicisi | 4 ayrı event | **tek event, dört durak** | `colony_secession` bir sonraki eşikte ateşleniyor, uyarıyor ve kendini yeniden kuruyor. Koloni başına tek satır. |
| Arızalı satırın kapısı | satır başına prop | **tek yerde `shared.onOpen`** | Her satır zaten konusunu taşıyan tek bir callback'ten geçiyor; on dört satırın hiçbirinin arıza sisteminden haberi olması gerekmedi. |

### Ölçülen ve kayda geçen davranışlar

- **Core 6'da kasa sızıntısı depoya inmiyor.** Sızıntı 885/sa, üretim 899/sa; havuz önce
  aktığı için üretim depoyu perdeliyor. Core 7'den itibaren sızıntı öne geçiyor. Bu
  "önce havuzdan akar" kuralının doğrudan sonucu, bir kaza değil — testi var.
- **Üretmeyen bir sütun sızmıyor.** `leakIncomeCap` oranı üretimle çarptığı için döteryum
  rafinerisi olmayan bir dünyanın döteryumu sızıntıdan etkilenmiyor. Kapalı bir muslukta
  sızıntı olmaz; kabul edilen sonuç.
- **Sezon telemetrisi sızıntı sırasında az sayıyor.** `produced` havuzun artışından
  türetiliyor; sızıntı havuzu boş tuttuğu için üretilen ore telemetriye girmiyor. Küçük
  ve kabul edilmiş: ayırmak `leakColumn`'un üretimden mi depodan mı aldığını takip
  etmesini gerektirirdi.

### Migration

`0089_colony_faults` — enum değerleri (sona), `planets` üzerine dört sütun,
`planet_faults` tablosu ve üç index, artı kapıyı çoktan geçmiş kolonileri altı saate
yayarak silahlandıran bir backfill.

### Test sayısı

| Yer | Test |
|---|---|
| `packages/rules/test/faults.test.ts` | 45 |
| `packages/rules/test/fault-economy.test.ts` | 13 |
| `apps/server/test/faults.test.ts` | 14 |
| `apps/server/test/fault-effects.test.ts` | 20 |
| `apps/server/test/fault-lifecycle.test.ts` | 20 |
| `apps/server/test/colony-secession.test.ts` | 14 |
| `apps/web/test/faults.test.tsx` | 8 |

## 15 · Ağır saldırı koloniyi bozar

Sahip talimatı: *"kalkan verilmesine sebep olmuş kadar bir saldırı yemişse: eklenebiliyorsa
direk en az 2 tane arıza rastgele eklensin. eklenemiyorsa 1 eklensin, tüm arızalar zaten
varsa bişey olmasın."*

**Kural:** iki uygun arıza varsa iki, bir varsa bir, hiç yoksa hiçbir şey
(`FAULT.attackFaults = 2`, `drawFaults` — yerine koymadan çekim).

**Tetik iki yerde, ikisi de mevcut kalkan kararına bağlı — ikinci bir eşik yok:**

| Yol | Tetik |
|---|---|
| PvP akını (`worker/handlers.ts`) | `grantRecoveryShield(...).earned` — kayıp, kalkan eşiğini geçti |
| Death Star ilk vuruşu (`strategic.ts`) | kalkan koşulsuz veriliyor → her zaman |

**"Kalkan verilmesine sebep olmuş kadar" bir şiddet ölçüsü olarak okundu, satır yazımı
olarak değil.** Kalkan iki durumda bilerek verilmiyor ama darbe aynı ağırlıkta: savunanın
kendi akını havadaysa, ve komutan sunucunun oynadığı bir botsa. Arıza koruma değil hasar,
o yüzden ikisinde de geliyor. Tek istisna `RECOVERY_SHIELD_ENABLED=false`: kalkan sistemi
kapalıyken aşılacak bir eşik yok, saldırı arıza da bırakmıyor.

**Ele geçiren vuruş arıza bırakmıyor** — yapısal: o dal dünyayı `transferPlanetControl`
ile devrediyor; mevcut arızalar korunuyor, sadakat yeni sahip için sıfırdan başlıyor.

**Tek yazıcı:** `breakFaults` hem saatin (`fault_spawn`, birer birer) hem saldırının
(ikişer) arızalarını yazıyor — satır, sızıntı flush'ı, sadakat izleyicisi, arıza başına
bildirim. İki kopya, bir tarafın bir satırı unutmaya başlamasının yolu.

**İdempotens:** saldırı arızaları `claimMission`'ın arkasında; tekrar teslim edilen varış
bu çağrıya hiç ulaşmıyor. Çekim görevden seed'leniyor.

Testler: `apps/server/test/fault-attack.test.ts` (13), `packages/rules/test/faults.test.ts`
("bir seferde birden fazla arıza", 10). Her tetik ve şiddet okuması mutasyonla doğrulandı.

