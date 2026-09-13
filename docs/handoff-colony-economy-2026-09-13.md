# Devir: Koloni ekonomisi açığı ve sezon reset'i (2026-09-13)

Bu doküman işi devralacak ajan içindir. Önce `CLAUDE.md`'yi oku; bu doküman onu değiştirmez,
sadece bu işin bağlamını ve sahibin kararlarını taşır. **Tüm değişiklikler TDD ile yapılır**
(CLAUDE.md → Development discipline).

---

## 1. Ne oldu

### 1.1 Şikâyet

Canlı sezon (EU, `cc2d011b-7699-429d-b5d9-ceb017f9ea3f`, ruleset 8) 2026-09-12 18:55 UTC'de
açıldı. ~3 saat sonra birkaç oyuncu Core 8, iki koloni (üçü T2) ve T2 gemileri (Viper, Talon,
Wayfarer) ile öndeydi. Sahip dupe/bug şüphelendi. Bir oyuncu (vantasia) şunu yazdı:

> "her kurduğun kolonide ana gezegen binalarını kopyalıyor ve kasaları full dolu açıyor koloniyi
> … döteryum full çıkıyor koloniyi kurar kurmaz."

### 1.2 İnceleme (production DB, salt okunur, snapshot ~2026-09-12 21:45 UTC)

Production `0a28f55` imajını çalıştırıyordu. İlk 30 oyuncunun hesap defteri o commit'in kurallarıyla
yeniden kuruldu:

- **Dupe / exploit YOK.**
  - Her bina seviyesi = başlangıç şablonu (akademi veya tarafsız şablon) + `build_orders`
    içindeki COMPLETED sipariş sayısı. Bedava seviye yok.
  - `planets.built_ever` = tamamlanmış YARD siparişleri. Bedava gemi yok.
  - Aynı gezegen+kuyrukta zamanı çakışan sipariş yok (paralel inşa yok); araştırmada da yok.
  - Her oyuncuda `harcama + eldeki stok + yoldaki yük` ≤ `PLANET_START + ödüller + yağma + madencilik
    + üretim integrali (bina seviyesi zaman çizelgesiyle) + ele geçirilen gezegen stoğu (üst sınır)`.
  - Sezonda clan aid = 0, PvP savaşı = 0. Hesaplar arası kaynak aktarımı mümkün olmamış.
  - sedser'in, FevziYRT'nin kurduğu T1-24'e inen ikinci yerleşimi doğru reroute oldu; 800/400 yükü
    sedser'e döndü.
- **"Ana gezegen binalarını kopyalıyor" yanlış.** 22 kolonide de ödenmemiş seviyeler tam olarak
  `MULTI_WORLD.neutral[tier].buildings` (T1 2/2/2/0/0/0, T2 5/5/5/0/2/0).
- **"Kasalar full açılıyor" DOĞRU ve asıl sorun bu.** Aşağıda.

### 1.3 Kök nedenler (hepsi `0a28f55` kodunun izin verdiği davranış)

1. **Tarafsız stok yerleşene miras kalıyor.** `createNeutralWorld` (`apps/server/src/services/season.ts`)
   tarafsızı dolu depoyla açar: T1 3.878/1.939/970, T2 12.763/6.381/3.191, T3 23.512/11.756/5.878
   (alloy/crystal/deuterium). Baskın yük kapasitesi kadar alır. `resolveSettlement`
   (`movement.ts`) → `transferPlanetControl` (`ownership.ts`) sadece sahibi değiştirir, stoğa
   dokunmaz; üstüne 800/400 yerleşim yükünü ekler. Deuterium "full" görünür çünkü Vault 0
   dünyanın deuterium kapasitesi tam bu stoktur. Oyuncu tesisi saatte ~10–20 deuterium üretir;
   tek T2 ≈ 150+ saatlik üretim.
2. **T1 tarafsızın savunması yok** (`fleet: {}`, `ground: {}`, reinforcement `null`). 1 Dart +
   2 Courier yetiyor. 3 saatte 30 T1'in 19'u alındı.
3. **T2 savunması zayıf** (8 Dart + 2 Pike ≈ 3,6k firepower) ama Core 5/Ref 5/Ext 5/**Shipyard 2**
   veriyor, yani anında T2 gövde üretimi.
4. **Ödüller erken saatlerde üretimi eziyor.** Sezon kesesi `MONTHLY_REFERENCE × 0,03` = 45,5k alloy /
   22,3k crystal (`packages/rules/src/rewards.ts`). vantasia 3 saatte 27,7k alloy ödül aldı,
   pasif üretimi 2,7k.
5. **İlk incelemedeki koloni-seviye-ödülü iddiası API sınırında elendi.** İç servis
   `Standing.levels` ile verilen gezegeni okur; fakat `apps/server/src/routes/rewards.ts` GET/POST
   için daima komutanın `kind='CAPITAL'` gezegenini seçer. Koloni kimliği query/body ile verilse
   de ödül açılmaz. Bu filtre üretim commit'i `0a28f55` içinde de vardır. Core 2 başkent + Core 8
   koloni HTTP regresyonu `snowball-audit.test.ts` içindedir; bunu mevcut oyuncu açığı sayma.

### 1.4 Örnek zaman çizelgeleri

- **vantasia:** T1-19'u 20:05'te 17/8/4 yağmayla aldı, 20:32'de yerleşti. 5 dk sonra kolonide
  10 Dart (3.000/600) sipariş etti. T2-13'e üç baskın yaptı (toplam ~260 alloy yağma), 21:08'de
  yerleşti. 20 dk içinde kolonide ~11,2k alloy harcadı (9 Viper, 2 Courier, Core, Refinery,
  Extractor); bu para miras stoktan geldi.
- **Engraver:** 20:21'de katıldı. Ödüllerle 15 Dart + 9 Pike bastı, 21:32'de T2-02'yi DECISIVE
  aldı, 21:37'de yerleşti. 15 dk içinde 2 Wayfarer, 2 Courier, 2 Prospector, Aegis/Uplink/Veil
  sipariş etti. Hâlâ 6.075/4.130/2.780 duruyordu.
- **FevziYRT:** En yüksek yağma. T1-24'ten 2 Wayfarer'la 2.714/1.357/679; T2-15'ten (koloni kapasitesi
  dolu olduğu hâlde) 6.071/3.035/1.517. Tarafsız stoğu çiftlik gibi kullanıyor.

---

## 2. Sahibin kararları (kilitli — yeniden sorma)

### 2.1 Ele geçirilen koloninin başlangıç stoğu

Yerleşim başarıyla indiğinde koloninin stoğu **tam olarak** şu olur (tarafsızdan kalan stok silinir,
works/buffer sıfırlanır):

| Kademe | Alloy | Crystal | Deuterium |
|---|---|---|---|
| T1 | 1.000 | 500 | 0 |
| T2 | 5.000 | 2.500 | 1.000 |
| T3 | 15.000 | 5.000 | 3.000 |

**Yerleşim yükü EKLENMEZ** (sahip açıkça "tam benim sayım" dedi). Oyuncunun ödediği 1.000/500'ün
(`SETTLEMENT_CHARGE`) tamamı başarılı yerleşimde maliyet olur. Başarısız yerleşimde (claim kapandı
veya başkası kazandı) bugünkü davranış korunur: Courier'lar, yük ve ücret eve döner, yakıt dönmez.

Uygulama notu: En sade yol, `resolveSettlement`'ta başarılı dalda `mission.cargo` teslimini kaldırıp
stoğu tier değerine **set** etmek. Mission satırındaki `cargo`/`settlementEscrow` iade yolu için
kalsın. Değerler `MULTI_WORLD.neutral[tier]` içine yeni bir alan olarak konmalı (ör. `captureStock`);
başka yere literal yazılmamalı. Kademe `neutral_planet_state.tier`'den okunur. Bu satır
`transferPlanetControl` içinde silindiği için tier'ı **silinmeden önce** oku.

### 2.2 Tarafsız garnizonlar

TR isim → hull ID: Ok=`DART`, Kargı=`PIKE`, Engerek=`VIPER`, Hisar=`STRONGHOLD`, Nöbetçi=`SENTINEL`,
Kasırga=`TEMPEST`, Balista=`BALLISTA`, Leviathan=`LEVIATHAN`, Praetoryen=`PRAETORIAN`,
Kirpi=`THORN` (yer), Tabya=`BASTION` (yer).

| Kademe | `fleet` | `ground` | Aegis |
|---|---|---|---|
| T1 | DART 12, PIKE 6, VIPER 1, STRONGHOLD 1 | THORN 1 | seviye 1 |
| T2 | DART 20, PIKE 20, VIPER 8, STRONGHOLD 8 | THORN 2, BASTION 2 | seviye 2 |
| T3 | VIPER 15, STRONGHOLD 15, TEMPEST 5, BALLISTA 5, SENTINEL 5, LEVIATHAN 5, PRAETORIAN 5 | THORN 5, **BASTION 3** | seviye 4 |

Bu filo sayıları sahibin %30 deneyi ve sonraki T1 AEGIS 1 / VIPER 1 / STRONGHOLD 1
eklemesiyle güncellediği adaydır (2026-09-13).
Önceki D209 sayıları `147deca` checkpoint'inde korunur; not 17–20'deki eski
kalibrasyonlar bu yeni garnizonun ölçümü değildir. [İlk %30 deney](economy-experiment-30pct-2026-09-13.md),
[T1 kalkanlı tekrar](economy-experiment-t1-aegis-2026-09-13.md).

- **T3 Tabya 3, 5 değil.** Sahip ilk başta 5 istedi; 5 Kirpi + 5 Tabya = 120 bulk, `groundSlots(8)` = 100.
  Sahip "5 Kirpi + 3 Tabya" (84 bulk) seçti. T2: 48 ≤ 70, T1: 6 ≤ 40.
  `packages/rules/test/capacity.test.ts` bu sınırı ve "T3 payı > 0,25 ve < 1" iddiasını tutuyor;
  84/100 ikisini de geçer.
- **Bina seviyeleri DEĞİŞMEZ** (T1 2/2/2, T2 5/5/5 + Shipyard 2, T3 8/8/8 + Shipyard 4).
- Kaba büyüklük (0a28f55 kurallarıyla `combatValue`): T1 0 → ~5,1k; T2 3,6k → ~25,3k;
  T3 ~33,5k → ~65,3k. D208 fiyatlarıyla sayılar biraz değişir.

**Aegis tier 3'e hardcode edilmiş, şablona taşınmalı.** Her birini `template.instruments.AEGIS`'ten
okuyacak şekilde değiştir:
- `apps/server/src/services/season.ts` → `shield: tier === 3 ? shieldHp(3) : 0` ve
  `if (tier === 3) insert AEGIS level 3`
- `apps/server/src/services/neutral.ts` → `reinforceNeutral` içindeki `if (tier === 3 …) while (level < 3)`
- `packages/sim/src/season.ts:498` → `aegis: chosen.tier === 3 ? 3 : 0`

`MULTI_WORLD.neutral[2].instruments` = `{ AEGIS: 2 }`, `[3]` = `{ AEGIS: 4 }`. Aegis 4'ün Core 8
altında geçerli olduğunu bir testle doğrula ("Core caps the Aegis").

### 2.3 Koloni kapasitesi

`colonyCapacity(capitalCore)` (`packages/rules/src/strategic.ts`), yalnızca ana gezegenin Core'una göre:

| Core | Önceki D209 | Güncel sahip kararı |
|---|---|---|
| < 6 | 0 | 0 |
| 6–8 | 1 | **0** |
| 9–11 | 2 | **1** |
| 12–14 | 3 | **2** |
| ≥ 15 | 3 | **3** |

Üst sınır 3 kalır (`colonyCapacity(Infinity) === 3`; `returnPlacement.ts` ve `waitingPlacement.ts`
buna dayanıyor). `packages/rules/test/strategic.test.ts:81` tablosu güncellenir. "Never shrinks
retroactively" (D97) wipe olduğu için canlı veride sorun yaratmaz, ama kural kodda kalır.

**Ek karar (sahip, 2026-09-13, CR bulgusu 1):** Kapasite **kesinlikle ANA GEZEGENİN (CAPITAL)
Core'undan** okunur, kontrol edilen en güçlü Core'dan değil. Bedava Core'la gelen koloni (T2 Core 5,
T3 Core 8) yuva açmaz. API alanı `highestCore` → `capitalCore` olarak yeniden adlandırılır (server
`ColonyStanding`, web şeması, sim `strategicCapacity`).

### 2.4 Tarafsız dünya sayısı

`MULTI_WORLD.neutralCounts`: `{ 1: 30, 2: 15, 3: 6 }` → **`{ 1: 38, 2: 19, 3: 8 }`** (toplam 51 → 65).

`neutralSlotPool = capacity + 450` (750 aday) yeterli, ama `selectNeutralSlots` / `neutralTargets`
katmanlı yerleşimi (T3 merkez, T2 orta halka) bu sayılarla deterministik ve çakışmasız çalışmalı;
test et. "6"/"51" diye literal yazan yerler:

- `apps/server/test/multi-world.test.ts:117` (`toHaveLength(6)`)
- `packages/rules/test/strategic.test.ts:121`
- `apps/server/src/cli/capacity.ts` (sabitten okuyor; fixture'ı kontrol et)
- `docs/game-design.md:492`, `docs/deployment.md:59` ve `:847` (51/30/15/6), cutover adımındaki
  "51 neutral worlds per successor"

### 2.5 Deploy kapsamı

Bu reset **D208 ile birlikte** yayına çıkar. Çalışma dizininde commit edilmemiş D208 filo
kalibrasyonu var (`git status`: rules constants/hulls/fuel/score/pirates/valuation,
`docs/fleet-calibration-d208.md`, …). Önce D208'in kendi testlerinin yeşil olduğunu doğrula ve ayrı
commit et, sonra bu işi üstüne kur. Commit'i sahip isterse at.

### 2.6 Araştırma koloniden komutana "ekstra" gelemez (owner talebi)

Durum: Araştırma zaten komutana ait (`player_research`, D134). Ele geçirme hiçbir araştırma yazmaz;
production'da siparişsiz araştırma satırı yok (2026-09-12 21:50 UTC kontrolü). **Gerçek açık:**
`completeResearch` (`apps/server/src/services/research.ts`) `requiredCore` şartını ve
`researchMinutes(cost, core)` süresini **siparişin verildiği gezegenin** Core'undan okuyor. Bedava
Core 8'li T3 kolonisinden sipariş veren, ana gezegeni Core 5 olan bir komutan kendi gelişiminin
açmadığı araştırmayı açabiliyor ve daha hızlı araştırıyor.

Karar (sahip onayladı):
- Core şartı ve araştırma süresi **her zaman komutanın ANA gezegeninin (CAPITAL) Core'undan** okunur.
- Bedel yine seçilen gezegenden ödenir (davranış değişmez).
- "Ele geçirme `player_research` yazmaz" regresyon testiyle kilitlenir.
- İstemci tarafı (`apps/web/src/lib/predict.ts:372`, `screens/ResearchPanel.tsx:453`) aynı Core'u
  okumalı. Yoksa kolonide buton açık görünür ama sunucu reddeder.
- Death Star Protocol'ün `requiredCore` (12) şartı da buna tabi. Stratejik üretim kapalı (D206),
  ama kural tutarlı olmalı.

### 2.7 Kolonileştirilemiyorsa butonun üstünde nedenini yazan küçük bilgi kutusu (owner talebi)

Tarafsız bir dünyanın odak panelinde (`apps/web/src/galaxy/FocusPanel.tsx`) "Koloni kur" butonu
kullanılamıyorsa, butonun hemen üstünde kısa bir bilgi kutusu nedenini yazar. Bugün sadece buton
etiketi değişiyor (ör. "Koloni kur · koloni yuvası dolu"), bu da Core şartını söylemiyor. Nedenler
en az şunları kapsamalı (mevcut `settleNeed*` anahtarları):

- Koloni yuvası yok veya dolu → **hangi Core'da açılacağını söyle** (ör. "Sonraki koloni için
  Komuta Merkezi 9 gerekli"), `colonyCapacity` eşiklerinden türet, literal yazma
- 2 Kurye yok
- Uçuş rampası dolu
- Alloy / Crystal / Deuterium (yakıt) eksik
- Claim penceresi kapanmadan varılamıyor
- Ana dünya toparlanıyor

Kompakt tasarım kuralı (CLAUDE.md "Compact and premium"): tek satır, küçük font. 350px'te
`tools/visual.mjs` ile doğrula. Metinler `i18n/locales/{tr,en}`.


### 2.8 Tarafsız takviyesi bedava ve tam (sahip kararı, 2026-09-13)

`reinforceNeutral` T2'de her 6 saatte, T3'te her 4 saatte **garnizonu ve Aegis kubbesini şablona
bedavaya tamamlar**; tarafsızın deposundan harcamaz. "Tam kubbe" hem Aegis seviyesini hem de
o seviyenin tam kalkan yükünü (`shieldHp(level)`) ifade eder. Gerekçe: yeni garnizon deposundan pahalı
(T2 ~20,4k alloy'a karşı depo ~12,8k), depodan ödeseydi hiç tam geri gelmezdi. T1 **yenilenmez**
(`reinforcementMinutes: null` kalır). Binalar bugünkü gibi depodan ödenerek şablona tamamlanır,
ama bina yetmezliği artık garnizon/kubbe yenilemesini **bloklamaz**.

### 2.9 Sezon ödülleri yarıya (sahip kararı, 2026-09-13)

`packages/rules/test/rewards.test.ts` → "halves every seasonal reward and leaves the Twitter follow
reward unchanged" testi bu işten önce yazılmıştı; sahip implement edilip bu deploy'a girmesini
istedi. Sezon zincirlerinin her kademesi `floor(eski / 2)`, SOCIAL 1000/500 aynen.

**Onboarding etkisi ve telafisi (sahip kararı):** Akademi 9 ödül talep ettiriyor. Yarılama
tek başına mezunun çıkış stoğunu 2.491/1.691'den 295/602'ye düşürüyordu; akademi yine
tamamlanıyordu (her ders eksiğini `fund` ile kendisi tamamlıyor) ama ilk oturum boş kalıyordu.
Sahip "akademi çıkışını telafi et" dedi: `packages/rules/src/academy.ts` yeni
`academyExitGrant(claimedRewards)` = talep edilen ödüllerin toplamı (yani yarılamanın geri
aldığı yarı), **sadece** `academyExitCheckpoint` üzerinden, yani oyuncunun katıldığı dünyaya
ekleniyor. Dersler kartlarında yazan tutarı ödemeye devam ediyor. Çıkış: 2.518/1.691/46.
Erken atlayan oyuncu, talep ettiği kadarının payını alıyor.

### 2.11 Anten (UPLINK) uydusu: 1.000 alloy / 500 crystal, 5 dakika (sahip talebi)

`UPLINK` uydusunun fiyatı 1.000 alloy / 500 crystal / 0 deuterium, üretim süresi 5 dakika olacak.
Bugün `satelliteCost(id)` ve `buildMinutes(cost, core, tech)` ile türetiliyor
(`packages/rules/src/economy.ts`). Sadece UPLINK değişir, diğer uydular aynı kalır. D198 gereği
AI Robots indirimi CONSTRUCTION kuyruğundaki her şeye uygulanıyor; "5 dakika" taban süre olarak
uygulanmalı, sonra robot indirimi düşmeli (her yapı için tek kural, istisna yok).

### 2.12 Gemi deuterium'u: ×2 denemesi geri alındı; D208 baseline korunur

Sahibin son açıklaması: gemi üretim deuterium'unu ×2 artırma denemesi, tier'lar arası
hiyerarşik verimliliği bozduğu için geri alındı; uygulanmış bir sahip çarpanı değildir.
Canlı `profileHull` basamakları `2 / 6 / 20`; kalibrasyon ve 52,59 dakika senaryosu bu
baseline ile çalıştı. Önceki “bunlar sahibin zaten iki katına çıkardığı nihai değerler”
anlatımı düzeltilmiştir; fiyatlara bu düzeltmede dokunulmadı.

Reddedilen `4 / 12 / 40` adayında D208 değerlemesiyle güç aynı kalırken T2, T1'den
verimsizleşiyordu (Akıncı T1→T2 0,95, Kale 0,93); T4 ancak T1 kadar verimli kalıyordu.
Korsan kabul fiyatı güvenlik testi de kırılıyordu. Bu aday baseline'a yeniden uygulanmamalı.

### 2.10 Bilinçli olarak dokunulmayanlar (sahip kararı)

- `neutralThreat(1)` = `'UNGUARDED'` kalır (ekranda gösterilmiyor).
- Tarafsızın baskınla alınabilen başlangıç deposu değişmez.
- Ödül iç servisi verilen gezegenin seviyesini okumaya devam eder; mevcut HTTP rotaları yalnızca
  başkenti seçer. Ele geçirilmiş koloni seviyeleriyle ödül açılabildiği iddiası elendi (§1.3-5).
---

## 3. Dokunulacak yerler (kontrol listesi)

**Kurallar** (`packages/rules`):
- `constants.ts` → `MULTI_WORLD.neutral[1|2|3]` (`fleet`, `ground`, `instruments`, yeni
  `captureStock`) ve `neutralCounts`
- `strategic.ts` → `colonyCapacity`
- Testler: `capacity.test.ts`, `strategic.test.ts`, `fleet-v2-contract.test.ts:375-377`
  (tier garnizon iddiaları), `deuterium.test.ts:194`

**Sunucu** (`apps/server`):
- `services/season.ts` → `createNeutralWorld`: Aegis/kalkan şablondan
- `services/movement.ts` → `resolveSettlement`: stok set, yük teslim yok, buffer sıfır
- `services/neutral.ts` → `reinforceNeutral`: Aegis şablondan
- Testler: `multi-world.test.ts`, `account-deletion.test.ts`, `silent-space-neutral-reset.test.ts`,
  yerleşim/transfer testleri. Sunucu testleri **seri** koşar (tek paylaşılan Postgres).
- `commanderTransfer.ts` / Silent Space MAIN koloni reset'i `createNeutralWorld`'ü yeniden kullanıyor;
  yeni garnizon ve Aegis orada da doğru seed edilmeli.

**İstemci** (`apps/web`) — D124: oyuncunun göremediği kural, kural değildir:
- `i18n/locales/{tr,en}/world.ts` → `foundingAlloyExplain` / `foundingCrystalExplain` şu an
  "yeni koloninin başlangıç stoğu olarak taşınır. Akının maliyeti değildir" diyor; artık yanlış.
  `settlementConfirm.noRecall` "gezegene yalnızca kuruluş yükü iner" diyor; yanlış.
- `screens/SettlementSheet.tsx`, `galaxy/FocusPanel.tsx`: ücret + yük ayrımı artık "başarıda
  tamamı harcanır, koloni kademe stoğuyla açılır, başarısızlıkta hepsi döner" olmalı. Kademe
  stoğu sheet'te yazmalı. Kompakt tasarım kuralı geçerli. `node tools/visual.mjs` ile 350px'te doğrula.
- Testler: `settlement-sheet.test.tsx`, `focus-actions.test.tsx`
- Probe/launch sheet garnizonu zaten `forecastLines` ile okuyor; T1'in artık bir duvarı var.
  "Boş hat walkover" (D173) T1 için artık geçerli değil; ilgili UI/test varsayımlarını kontrol et.

**Simülatör / araçlar:**
- `packages/sim/src/season.ts` → tarafsız modeli (Aegis literal'i, stok, kapasite)
- `tools/colony-claim-study.ts`, `tools/economy-calibration.ts` (`SETTLEMENT_*` kullanıyor)
- Denge bantlarını **genişletme**. Kırılan denge testi olursa kök nedeni raporla.

**Dokümanlar:** `docs/decisions.md`'ye **D209** (sahip talimatı) ekle: stok, garnizon, kapasite,
sayı, T3 Tabya 3 gerekçesi. Ayrıca `docs/game-design.md` (51 → 65, kapasite eşikleri),
`docs/deployment.md` sayıları, `CLAUDE.md` "Current state" satırı.

---

## 4. Deploy + wipe

Normal lifecycle değil; `docs/deployment.md` → **"Owner-authorized emergency wipe"** adımlarını
aynen uygula:

1. `pnpm verify` yeşil. Frontend görsel olarak doğrulanmış.
2. Migration gerekiyor mu kontrol et (şema değişmiyorsa gerekmez; `neutral_planet_state.tier` 1–3
   check'i aynı kalır).
3. İmajı build et, bakım sayfasını yayınla, `api1-3` + `worker`'ı **tamamen** durdur.
4. Yazıcı yokken yedek al ve checksum'ını kaydet.
5. Yeni imajla: `season.ts wipe --yes </dev/null`.
6. Açılmadan önce her galakside doğrula:
   - live season, ruleset 8
   - `neutral_planet_state` tier sayıları 38/19/8
   - T2 dünyalarında AEGIS level 2 satellite, T3'te level 4, `shield = shieldHp(level)`
   - `units` garnizon satırları şablonla birebir (`owner_player_id IS NULL`)
   - ruleset-8 etkinlik takvimi sayıları (deployment.md: 120/120/60; TRT 00:00 dışında açılırsa
     Trade Ship 119 olabilir, bu beklenen durum)
7. Önce worker, sonra API'ler. Duman testi: bir T1'e baskın → garnizonla savaş → DECISIVE → yerleşim →
   koloni 1.000/500/0 ile açılıyor ve yerleşim yükü eklenmemiş.

`season wipe --yes`'in `--starts-at` seçeneği yok. Etkinlik takviminin tam dolu olması isteniyorsa
wipe'ı TRT 00:00'a denk getir.

---

## 5. Açık kalanlar — sahibe sorulmadan KARAR VERME

1. **Tarafsız başlangıç stoğu (baskınla alınabilen) değişmedi.** T2 hâlâ 12,8k/6,4k/3,2k tutuyor.
   FevziYRT'nin yaptığı gibi yerleşmeden yağma çiftliği mümkün; yeni garnizon bunu pahalılaştırıyor
   ama kaldırmıyor. Sahip istemedi, sadece raporla.
2. **Koloni-seviye-ödülü canlı açık değildir** (§1.3-5). İleride ödül rotası seçili gezegene
   açılırsa ölçü ayrıca ele alınmalıdır; mevcut rotayı değiştirme.
3. **T1 takviye almıyor.** İlk DECISIVE'den sonra yerleşilmezse üretimle yeniden dolan depo,
   kalıcı ve savunmasız bir yağma çiftliğine dönüşebilir. Bu, §2.8'deki kilitli sahip kararıdır.
4. **Ödül kesesinin erken saatlere yığılması** (§1.3-4). Toplam sezon ödülleri §2.9 ile yarıya
   indirildi; dağılımın erken saatlere yığılması ayrıca değiştirilmedi.

---

## 6. İnceleme sorguları (tekrar üretmek için)

```bash
ssh yildirim@hoofywood.com "docker exec -i astera-postgres-prod psql -U astera -d astera"
```

- Bedava seviye kontrolü: her `(planet, building)` için `level - count(build_orders COMPLETED BUILDING)`.
  Kapitalde akademi payı ≤ 2 (CORE/REF/EXT) ve ≤ 1 (VAULT/SHIPYARD) çıkmalı, kolonide tarafsız şablonu
  vermeli.
- Bedava gemi kontrolü: `planets.built_ever` = `sum(build_orders.count)`, YARD COMPLETED, gövde bazında.
- Paralel inşa: aynı `planet_id, queue` için `tstzrange(started_at, ready_at)` çakışması.
- Defter: `build_orders.cost` (+ CANCELLED yarı iade) + `research_orders.cost` + gezegen stok/buffer +
  yoldaki `missions.loot/cargo/salvage` ↔ `PLANET_START` + `reward_grants` (claimed) +
  `account_rewards` + çözülmüş return `loot/salvage` + `mining_runs.mined_*` + üretim integrali +
  ele geçirilen gezegen stoğu (üst sınır). **Yoldaki return yağmasını hem gelire hem stoğa yaz**,
  yoksa sahte açık çıkar.


Bunlara ek olarak Owner'ın istedikleri:
1.Kullanıcının feth ettigi kolonilerden komutan'a araştırma gelmemeli. Komutan sadece yapmış oldugu araştırmaları tüm gezegen/kolonilerinde kullanabilir ama bir yeri kolonisi haline getirdiyse oradan ekstra araştırma komutan'a yazılamaz.
2.Bir oyuncu bir neutral'ı kolonileştiremiyorsa (komuta merkezinin level'ı yetmiyorsa vs.) kolonileştirme butonunun üstüne ufak bir info box ile neden yapamadığı yazılmalı.
---

## 7. İlerleme günlüğü (en güncel en üstte değil, sırayla)

> Devralan: buradan devam et. Her adım "durum · ne yapıldı · sıradaki" formatında.
> Deploy/wipe production'a dokunur; sahipten o anda açık onay almadan **yapılmaz**.

| # | Adım | Durum |
|---|---|---|
| 0 | Baseline: D208 çalışma dizininde test/type durumu | ✅ typecheck temiz; rules 1 kırmızı (aşağıda not 1) |
| 1 | Rules: garnizon + instruments + `captureStock` + `neutralCounts` (§2.2, §2.4) | ✅ |
| 2 | Rules: `colonyCapacity` 9/12/15 (§2.3) + `nextColonyCore` | ✅ (sahip revizyonu 2026-09-13) |
| 3 | Server: `createNeutralWorld` + `reinforceNeutral` Aegis şablondan (§2.2) | ✅ (not 3) |
| 4 | Server: `resolveSettlement` stok set, yük teslim yok (§2.1) | ✅ (not 3) |
| 5 | Server + web: araştırma Core'u ana gezegenden (§2.6) | ✅ |
| 6 | Sim: tarafsız Aegis literal'i ve model (§3) | ✅ sim 112/112 (11 skip) |
| 7 | Web: yerleşim metinleri + bilgi kutusu (§2.1, §2.7) | ✅ kod+test; 350px genel + TR/EN yerleşim ve baskın öncesi Core notu görsel kontrolü geçti |
| 8 | Docs: D209, game-design, deployment, CLAUDE.md | ✅ |
| 9a | Server: takviye bedava (§2.8) + garnizon devri açığı | ✅ |
| 9b | Rules: sezon ödülleri yarıya (§2.9) + akademi çıkış paketi | ✅ rules 1155/1155 yeşil |
| 9c | Rules+server+web+sim: UPLINK 1k/500, 5 dk (§2.11) | ✅ |
| 9d | Rules: D208 gemi deuterium baseline (§2.12) | ✅ `2 / 6 / 20`; ×2 denemesi geri alındı |
| 9 | `pnpm verify` tam yeşil + görsel doğrulama | ✅ son seri koşu exit 0; 5.647 geçti / 13 skip; 350×812 genel ve TR/EN hedefli kontrol geçti (not 19) |
| 10 | Deploy + wipe (§4) — SAHİP ONAYI GEREKİR | ⏳ |

### Notlar

1. **(ÇÖZÜLDÜ → §2.9, implement edilecek) Önceden var olan kırmızı test:** `packages/rules/test/rewards.test.ts`
   → "halves every seasonal reward and leaves the Twitter follow reward unchanged". Çalışma dizininde
   bu iş başlamadan önce yazılmış, implementasyonu yapılmamış bir TDD testi (sezon ödüllerini yarıya
   indirme). Dokunulmadı. Sahibe sorulmalı: implement edilecek mi, yoksa test geri mi alınacak?
   Olduğu gibi kalırsa `pnpm verify` kırmızı kalır.
2. **Adım 1–2 ne yaptı:**
   - `packages/rules/src/constants.ts`: `MULTI_WORLD.neutral[1|2|3]` artık `instruments: { AEGIS: n }`
     (T1 `0`), yeni `fleet`/`ground` ve `captureStock` taşıyor. `neutralCounts` 38/19/8. Yeni
     `MULTI_WORLD.colonyCoreThresholds = [9, 12, 15]` (ilk D209 uygulaması `[6, 9, 12]` idi;
     sahip aynı gün eşiği üç seviye yükseltti).
   - `packages/rules/src/strategic.ts`: `colonyCapacity` eşikleri sayıyor. Yeni
     `nextColonyCore(colonies, reservations)` bir sonraki koloninin Core'unu veya `null` döndürüyor
     (bilgi kutusu bunu okuyacak).
   - Testler: yeni `packages/rules/test/neutral-colony-d209.test.ts`; `strategic.test.ts` ve
     `fleet-v2-contract.test.ts` eski değerlerden güncellendi.
   - `neutralThreat(1)` hâlâ `'UNGUARDED'` döndürüyor. Web bu alanı sadece şemada parse ediyor,
     ekranda göstermiyor. T1 artık korumalı olduğu için etiket yanıltıcı; değiştirilmedi, sahibe
     sorulabilir.
3. **Adım 3–5 (sunucu) ne yaptı:**
   - `season.ts` `createNeutralWorld`: kalkan `shieldHp(template.instruments.AEGIS)`, Aegis satellite
     `AEGIS > 0` ise şablon seviyesinde.
   - `neutral.ts` `reinforceNeutral`: kubbe `template.instruments.AEGIS`'e kadar yeniden kuruluyor
     (tier 3 literal'i kalktı).
   - `movement.ts` `resolveSettlement`: başarıda stok `captureStock`'a SET, buffer'lar 0, yük
     teslim edilmiyor. Tier, `transferPlanetControl` silmeden önce seçilen `target.state.tier`'den.
   - `researchState.ts` yeni `researchCoreLevel(db, playerId)` (CAPITAL'in CORE'u).
     `research.ts` `completeResearch` requiredCore + süreyi buradan okuyor. `planetView.ts` yeni
     alan `researchCore` yayınlıyor (istemci için; web şeması henüz güncellenmedi, adım 5/web).
   - Test: yeni `apps/server/test/neutral-colony-d209.test.ts` (11 test, yeşil).
   - Sıradaki: tam sunucu paketi. Eski varsayımlara dayanan testler kırılacak (boş T1'e 1 Dart ile
     walkover, Core 3'te koloni, 51 dünya, "yerleşimde stok + 800"). Bunlar yeni kurallara göre
     güncellenmeli, kural gevşetilmemeli.
4. **Web (adım 5 ve 7):**
   - `apps/web/src/lib/colonization.ts`: yeni saf `settlementBlock(input)`. İlk karşılanmamış şartı
     (RECOVERING, COLONY_CORE{requiredCore,currentCore}, COLONY_MAX, FLIGHT_BAY, COURIER, ALLOY,
     CRYSTAL, FUEL, TOO_LATE) döndürür. Test: `test/settlement-block.test.ts`.
   - `FocusPanel.tsx`: slab etiketi (`SETTLE_LABEL`) ve üstteki not (`[data-settle-reason]`,
     `settleReason`) aynı bloktan okuyor. i18n `focus.planet.settleWhy.*` (tr/en). Test:
     `focus-actions.test.tsx` → "explains above the disabled control…".
   - `SettlementSheet.tsx`: "Kuruluş yükü" + "Kuruluş ücreti" satırları kalktı. Yerlerine
     "Kuruluş bedeli" (charge) ve tier biliniyorsa tam genişlikte "Koloni şununla açılır"
     (`captureStock`) geldi. `noRecall`, `foundingAlloyExplain`, `foundingCrystalExplain` metinleri
     yeni kurala göre güncellendi.
   - Araştırma: şemaya zorunlu `researchCore` eklendi. `orderTime.ts` (`researchCoreOf`),
     `predict.ts` ve `ResearchPanel.tsx` artık onu okuyor. Akademi dünyası (`onboarding/world.ts`)
     kendi Core'unu veriyor. Test fixture'ı varsayılan olarak `buildings.CORE`'u kullanıyor.
     Yeni testler: `order-time`, `research-panel`, `predict`.
   - Açık: kolonide Core şartlı araştırmanın "Core'a git" düzeltme butonu hâlâ o gezegenin
     Core'una yönlendiriyor (ana gezegene değil). Metin doğru, sadece kısayol yanlış dünyayı açar.
5. **İlk tam sunucu koşusu** (ödül yarılama ve akademi değişikliğinden ÖNCE başlatıldı):
   94 dosya, 20 kırmızı. Hepsi eski kurallara dayanan testler: `multi-world.test.ts` (16),
   `account-deletion.test.ts` (2), `preview.test.ts` (1), `silent-space-neutral-reset.test.ts` (1).
   Sıradaki iş: bunları tek tek incelemek. Kural testlere uydurulmayacak, testler kurala.
6. **Takviye (§2.8) ve bulunan açık (adım 9a):**
   - `neutral.ts` `reinforceNeutral` yeniden yazıldı: garnizon ve kubbe şablona **bedava**
     tamamlanıyor (asla üstüne çıkmıyor). Binalar depodan sırayla ödeniyor ve yetmezlik garnizonu
     bloklamıyor. **Açık claim (veya recovery) bitene kadar bekliyor** (`nextReinforcementAt = claimUntil`).
   - **Bulunan açık, kapatıldı:** `ownership.ts` `transferPlanetControl` gezegendeki `home`
     birimlerinin sahipliğini yerleşene veriyordu. Tarafsız garnizon (owner NULL) claim açıkken bir
     şekilde ayaktaysa (takviye, operatör claim'i) yerleşen oyuncu bedava filo alıyordu. Artık
     `owner_player_id IS NULL` satırlar siliniyor.
   - Testler: `neutral-colony-d209.test.ts` (17). `multi-world.test.ts` güncellendi: 38/19/8 sayısı,
     `COLONY_CORE`, düşmüş garnizonlu T1 walkover, tam `captureStock`, altyapı-depodan testi.
   - **Oyun sonucu (sahibe raporla):** T1 `captureStock.deuterium = 0` olduğu için yeni bir T1
     koloni, oyuncu oraya deuterium taşıyana kadar filo kaldıramıyor (transfer dahil). Sahip bu
     sayıyı kendisi verdi; bilinçli mi diye teyit edilmeli.
7. **İlk tam koşudaki 20 kırmızının durumu:** hepsi güncellendi ve dosya bazında yeşil:
   `multi-world` (31/31), `account-deletion` + `preview` (33/33, 51 sabiti `neutralCounts`
   toplamından türetildi), `silent-space-neutral-reset` (8/8). Bu sonuncusu garnizon devri açığı
   kapanınca kendiliğinden geçti: tarafsız garnizon sahiplenilince adres "güvenli değil" sayılıyordu.
   Ödül yarılama + akademi değişikliğinden sonra **tam sunucu koşusu henüz tekrarlanmadı**.
8. **UPLINK (§2.11):** `constants.ts` `SATELLITES.UPLINK` = 1.000/500 (elle, tempo dışı) ve yeni
   `UPLINK_BUILD_MINUTES = 5`. `economy.ts` yeni `satelliteMinutes(id, core, tech)`: UPLINK
   `5 × robotSpeedMult`, diğerleri `buildMinutes`. Okuyanlar: server `build.ts installSatellite`,
   web `orderTime.ts` (`{ satellite }` subject) + `PlanetScreen.tsx`, sim `season.ts`. Akademi Anten
   dersinde uyduyu satın aldırmıyor, o adımda da 1.440/616 var; onboarding etkilenmiyor.
   Testler: rules `neutral-colony-d209.test.ts` "D209 Uplink", `tempo.test.ts`; server
   `construction-speed.test.ts`; web `order-time.test.ts`.
   CLAUDE.md "iki quote" kuralına üçüncü quote (`satelliteMinutes`) eklendi; D209 kaydına yazılmalı.
9. **Sim (adım 6):** `buildWorld` Aegis şablondan; `reinforceNeutralSim` sunucuyu yansıtıyor (bedava
   garnizon/kubbe, claim bekleme); yerleşim `captureStock` set ediyor ve tarafsız garnizonu
   kaldırıyor. **Bot heuristiği değişti:** T1 artık korumalı, bu yüzden `neutralRaidEligible(1)`
   T2 ile aynı ×1.8 marjı istiyor ve `raidFleetFor` T1'e 3 gemilik jeton kanat yerine %60 gönderiyor.
   Testler: `strategic.test.ts` (+3 D209), `player-calendar.test.ts` fixture'ları.
   Denge ölçümü (ARR vb.) bu değişikliklerle **yeniden ölçülmedi**.
10. **Code review (2026-09-13, sahip istedi) — bulgular, henüz DÜZELTİLMEDİ:**
    1. *Çözüldü:* Koloni kapasitesi artık yalnızca CAPITAL Core'u okuyor (`ownership.ts
       colonyStanding`). Sonraki sahip revizyonuyla yuvalar Core 9 / 12 / 15'te açılıyor; ele geçirilen
       dünyanın Core'u hiçbir yuva açmıyor.
    2. *UX açığı:* Bilgi kutusu sadece claim açıkken çıkıyor. Claim öncesinde (NEUTRAL_PREP) Core
       yetmezliği sayıyla söylenmiyordu. Sonraki UX düzeltmesi claim öncesinde de ortak
       `settlementBlock` üzerinden güncel Core 9 gereksinimini gösteriyor.
    3. *Hata:* `ResearchPanel` kolonide Core şartı için "düzelt" kısayolu koloninin Core'una gidiyor,
       ana gezegene değil.
    4. *Lint (verify'ı kırar):* `neutral.ts` kullanılmayan `instrumentCost` importu; sim
       `raidFleetFor` kullanılmayan `tier` parametresi.
    5. *Bayat yorumlar:* `movement.ts:334` ("handed to the colony on landing"), `constants.ts:2934`
       ("Delivered capital…"), `SETTLEMENT_CAPITAL` adı artık yanıltıcı.
    6. *Teyit:* T1 `captureStock.deuterium = 0` → yeni T1 koloni yakıt taşınana kadar hiç filo
       kaldıramıyor.
    7. *Küçük:* Akademi çıkış paketi, `fund` tamamlamaları yüzünden ~27 alloy fazla veriyor
       (2.518 vs 2.491).
    8. *Konvansiyon:* web şemasında `researchCore` zorunlu. Kod tabanında yeni alanlar rolling
       deploy için optional tutuluyor. Offline wipe deploy'unda sorun yok.
    9. *Kapsam:* `transferPlanetControl` NULL owner'lı birimleri her çağıranda siliyor (grant-colony
       CLI dahil). Prod'da tarafsız olmayan gezegende böyle satır yok (0); yine de
       `expectedControllerPlayerId === null` ile sınırlamak daha dar ve güvenli.
    10. *Oyun notu:* T1 hiç yenilenmediği için ilk DECISIVE'den sonra yerleşilmezse kalıcı yağma
        çiftliği olur (depo üretimle doluyor).
    11. *Yapılmadı:* tam web koşusu, tam `pnpm lint`, görsel doğrulama, sim ARR ölçümü, docs adımı (8).
11. **İkinci tam sunucu koşusu (tüm server değişikliklerinden sonra): exit 0, tamamı yeşil.**
12. **CR bulgusu 1 uygulandı (kapasite = ana gezegen Core'u):** `ownership.ts colonyStanding` artık
    CAPITAL'in CORE'unu okuyor; alan `highestCore` → `capitalCore` (server, web şeması, FocusPanel
    fallback'i `planet.researchCore`, `colonization.ts`). `strategic.ts` parametre adları, sim
    `strategicCapacity` = `colonyCapacity(p.buildings.CORE)`. Testler: server D209 (+2), sim (+1),
    ilgili web testleri. Yeşil: sim 111, server D209+multi-world+contract 129, web 54.
    **CR bulgusu 4 (lint) ve 5 (bayat yorumlar) de düzeltildi** (`neutral.ts` import, sim `raidFleetFor`
    parametresi, `ownership.ts` `max` importu, `movement.ts` ve `constants.ts` yorumları).
    Açık: CR 2 ve 3 sahibe yeniden açıklandı, cevap bekleniyor.
13. **CR 2 ve 3 uygulandı (sahip: "2 evet, 3 ana gezegen"):**
    - (2) `FocusPanel.tsx`: `[data-settle-reason]` notu artık baskından ÖNCE de (`NEUTRAL_PREP`)
      görünüyor, ama sadece koloni yuvası sebebi (COLONY_CORE/COLONY_MAX) için. Kurye/kaynak
      sebepleri 3. adıma ait olduğundan claim açılana kadar gösterilmiyor. Test:
      `focus-actions.test.tsx` → "says the Core a colony needs before any raid…".
    - (3) Yeni `apps/web/src/lib/researchNeed.ts` `researchNeedWorld(id, capitalPlanetId)`.
      `GalaxyView.tsx` araştırma panelinin `onNeed`'inde CORE için önce ana gezegeni seçiyor
      (`selectPlanet`), sonra planet sheet'i açıyor. `research.needCore` metni "Ana gezegende Komuta
      Çekirdeğini …" oldu (tr/en). Test: `research-need.test.ts`.
    - Yeşil: web ilgili 146 test, typecheck, değişen dosyalarda lint.
    - **Kalan:** tam `pnpm verify` (web tam paket + tam lint), görsel doğrulama (350px), docs adımı 8
      (D209 kaydı, game-design, deployment, CLAUDE.md), deploy + wipe (sahip onayı).
14. **Adım 8 (docs) tamam:** `docs/decisions.md` → yeni **D209** kaydı (D208'in hemen altında;
    iptal edilen deuterium ×2 dahil). `docs/game-design.md` 65 dünya ve koloni eşikleri,
    `docs/deployment.md` 51 → 65 kontrolleri, `CLAUDE.md` iki yeni invariant, "üç quote" ve Current
    state. Sıradaki: tam `pnpm verify` (arka planda başlatıldı).
15. **Tam `pnpm verify` sonucu (2026-09-13 ~03:00):**
    - typecheck ✅, **tam lint ✅**, rules 1155 ✅.
    - server: `contract.test.ts` 26 kırmızı → **başka bir ajan aynı `astera_test` DB'sinde test koşturuyordu**
      (No such season / TRUNCATE hataları). DB boşken tek başına yeniden koşuldu: **79/79 yeşil**. Önceki
      tam sunucu koşusu 94/94 yeşildi. Devralan: server testlerinden önce
      `pg_stat_activity` kontrolü şart (hafıza: astera-server-tests-serialize).
    - web: 2 kırmızı.
      (a) `surface-vocabulary.test.ts`: bilgi kutusu elle yapılmış kart sınıfı kullanıyordu →
      `plate plate-inset` yapıldı, yeşil.
      (b) `focus-sheet-owner-fixes.test.tsx` "opens taller than half the screen": `FocusPanel.tsx`
      `max-h-[70dvh]` → `65dvh`. **Bu değişiklik bu işten ÖNCE çalışma dizininde vardı (D208 WIP), bizim
      değil.** Test ≥66 istiyor. Sahibe sorulmalı: 65 kasıtlı mı (test güncellenir) yoksa 70'e mi dönülsün?
    - Görsel doğrulama yapılmadı: 5173/3100 dev sunucuları rules değişikliklerinden önce başlatılmış,
      kullanıcıya ait; yeniden başlatmak için izin gerekiyor.
16. **Panel yüksekliği çözüldü:** sahip `65dvh`'nin kasıtlı olduğunu söyledi →
    `focus-sheet-owner-fixes.test.tsx` alt sınırı 65 yapıldı, yeşil. Web'de bilinen kırmızı kalmadı.
    Açık: görsel doğrulama için dev sunucuları yeniden başlatma izni; deploy + wipe onayı.
17. **Devralma incelemesiyle doğrulanıp kapatılan gizli hatalar:**
    - Tarafsız takviyesi Aegis seviyesini kuruyor fakat kalkan yükünü 0 bırakıyordu. Sunucu artık
      şablon seviyesinin tam kalkanını kuruyor; sunucu regresyon testi eklendi.
    - Simülatör her savaşa tarafsızı tam kalkanla sokuyor ve kalan kalkanı saklamıyordu. Kalkan
      artık kalıcı, zamanla yenileniyor, savaştan kalan değer yazılıyor ve takviyede tam doluyor.
    - `tools/capacity.mjs` eski 51/30/15/6 production şeklini hardcode etmişti; 65/38/19/8 şekli
      artık doğrudan `MULTI_WORLD.neutralCounts`'tan türetiliyor ve testle kilitli.
    - `transferPlanetControl`, tarafsız olmayan sahip değişimlerinde de NULL-owner home birimlerini
      siliyordu. Temizleme yalnızca beklenen eski denetleyici NULL ise yapılıyor; regresyon testi var.
    - D208 raporu 64 örnek diyordu fakat araç varsayılanı 128'di. Varsayılan 64'e indirildi ve test
      edildi; `pnpm --silent` komutu geçerli JSON üretir.
    - Kök ekonomi kapanış aracı eski %3 ödül kesesini, Core 3 kolonileşmesini ve kaldırılmış hangar
      tavanını modelliyordu. Canlı kurallardan türetilecek şekilde düzeltildi; 5/5 araç testi yeşil.
    - `tools` altındaki tarihsel aday deneylerinde D184 sonrası tanımsız Hangar ve D208'den kopmuş
      prototip yakıt kopyası doğrulandı; kapasite açıkça sınırsız, yakıt ortak canlı kuraldan okunuyor.
      Araçların eski sabit savaş/koruma beklentileri türetilen değerlere çevrildi. Artık gerçekten
      çalışan eski `target-derived candidate` kendi T3 hız hedefini erken aşıyor (14 gün: 2,56;
      30 gün: 6,02) ve raporda doğru biçimde reddedilmiş (`pacingPassed=false`) kalıyor; bu aday
      canlı D208/D209 sezon simülasyonu değildir.
    - Taze kalibrasyon: 657.088 izole savaşta yön/progression/small-wallet hatası 0; 300 oyunculu
      iki koşuda ilk koloni gün 4,52/4,53, 65 koloninin tamamı yaklaşık gün 19,6'da alındı. Mevcut
      model üretimde yaşanan 1–2 saatlik koloni yarışını yeniden üretmiyor.
18. **Tek hesaplı saldırgan incelemesi:** Ayrıntılar `docs/snowball-audit-2026-09-13.md`.
    Core 2→6 temel süresi yalnızca ~24,88 dakika; Akademi çıkışı + erişilebilir ödüller,
    Core 6 / iki kurye / 1.000-500 founding bedelini aynı ilk oturumda finanse edebilir.
    Ayrıca gerçek seed 4242 geometrisinde, ücretli gemiler + beş probe ödülü + iki T1 baskınıyla
    **solo ilk koloni 52,59 dakikada kuruldu** (Akademi çıkışından itibaren; merchant, ek grant,
    başka oyuncu veya gezegen taşıma yok). Simülatörün ortalama ilk kolonisi erken-fetih güvencesi değil.
    - Asteroid ilk-hit yarışında 1.200 alınan cevherin ledger'a 600 yazıldığı doğrulandı. Claim
      satırı kilitten önce seed ediliyor; gerçek PostgreSQL eşzamanlılık testi artık 1.200/1.200.
      Tek seri worker'da üretim patlamasının kanıtlanmış nedeni diye sunma.
    - Tarafsız takviyenin state→world sırası, acquisition/combat'ın world→state sırasıyla
      çakışıyordu. Gerçek PostgreSQL NOWAIT testiyle doğrulandı ve world→state yapıldı;
      son saldırgan/D209/mining hedefli koşuda 55/55 test yeşil (ucuz escort rota hipotezi elendi).
    - **AÇIK kod hatası:** Korsan PARTIAL hoard'ı düşürmüyor; dönüş sonrası aynı origin tekrar
      atabiliyor. İki normal launch/return toplam 754/412/13 ödüyor, ilk hoard 720/393/14.
      Sonlu tekrar-ödeme bug'ı; persistent remaining-purse / PARTIAL sahip kararı uygulanmadı.
    - Başkent kapısı, T1 boş çiftliği, capture D'si + 32 valuation, dünya-local üretim/Convoy
      bileşimi hâlâ erken snowball yaratabiliyor. Yeni sezonun bunları kapattığını iddia etme.
    - Ek kural kanıtı: Core 6 / Yard 6 + ödenmiş engineering/power/armor ile Tier 4 Cataclysm
      üretilebilir; `canAttack(6,2)` yine geçer, `canAttack(7,2)` geçmez. Bu bir zamanlı solo-T4
      rotası değil; düşük-Core PvP bandının filo gücünü sınırlamadığı doğrulandı, kural değiştirilmedi.
    - Akademi tam checkpoint'i tek HTTP claim'de kabul edilir, ders tamamlama server kanıtı
      yoktur; retry ikinci paket vermez. Eğitim ekranı süresini zorunlu sezon kapısı sayma.
19. **Son teslim kapısı (2026-09-13):**
    - Ayrı yerel `_test` DB ve `npm_config_workspace_concurrency=1` ile taze, seri tam
      `pnpm verify` **exit 0**: typecheck/lint yeşil; rules 1.155, server 1.573 (95 dosya),
      web 2.807 (2 skip), sim 112 (11 skip). Toplam **5.647 geçti / 13 skip**.
    - Ek kök araç paketi: 22 dosya / 154 test yeşil. Saldırgan + D209 + mining hedefli
      gerçek sunucu koşusu: 3 dosya / 55 test yeşil; solo 52,59 dakika yeniden üretildi.
      Kabul bantları genişletilmedi; `git diff --check` temiz.
    - 350×812 genel görsel koşu ile TR/EN T3 settlement ve baskın öncesi Core notu kontrolü
      tamamlandı. Mevcut dev sunucuları öldürülmedi/yeniden başlatılmadı; not 15–16'daki
      görsel kontrol bekleyişi artık kapalı. Hedefli component fixture settlement başlatmaz;
      gameplay kanıtı gerçek servis testindedir.
    - **Teknik D208/D209 doğrulaması teslim edilebilir; sezon güvenliği henüz teslim edilemez.**
      Not 18'deki korsan tekrar-ödeme bug'ı açık; ilk-saat kolonileşmesi ve compound ekonomi
      için sahip kararları `docs/snowball-audit-2026-09-13.md` sonunda listelidir.
      Sonraki iş bu kararları netleştirmek, ilgili düzeltmeleri regresyonla uygulamak ve yeniden
      kalibre etmektir. Deploy/wipe/commit yapılmadı; adım 10 hâlâ o anda sahip onayı gerektirir.
20. **Checkpoint ve sahibin %25 ekonomi deneyi (2026-09-13):**
    - Sahip onayıyla yerel `147deca` checkpoint commit'i atıldı; push/deploy/wipe yok.
      Not 19'daki tam yeşil sonuç bu checkpoint içindir, sonraki deney için değildir.
    - Sahip gemilerin mevcut alloy/crystal fiyatlarına +%25, üç üreticinin tüm level
      üretimine −%25 ve tüm imalat/yapım sürelerine +%25 istedi. Fiyatları üretimden
      türeten tasarım referansı sabit tutuldu; binalar/araştırmalar otomatik ucuzlamadı.
      Gemi üretim D'si, yarıya indirilmiş sezon ödülleri ve tarafsız garnizonlar değişmedi.
    - Eski 52,59 dakika rotası birebir tekrarlandığında 12 Pike siparişine para yetmedi.
      Aynı ordu + iki baskın, yasal gelir toplama ve ücretli parçalı üretimle son adayda
      258,31 dakikada koloni kurdu. **6 saat doğal zorluk hedefi sağlanmış değildir.**
      Bu matematiksel minimum değildir; savaş rastgeleliği sefer kimliğine bağlıdır.
    - Tam test paketi ve yeni filo kalibrasyonu bu deney aşamasında çalıştırılmadı.
      Ayrıntılar ve kapsam sınırları: `docs/economy-experiment-25pct-2026-09-13.md`.
21. **%30 + daha güçlü garnizon + doğru uyarlanan açılış (2026-09-13):**
    - Sahip %25'i %30 ile değiştirdi; checkpoint bazında 1,30/0,70/1,30, üst üste
      çarpma yok. §2.2 filo sayıları güncellendi; ground/kalkan/binalar/capture stock/takviye sabit.
    - Eski sabit 12 Pike / iki raid güncel T1'i temizlemiyor; bunu “en hızlı oyuncu”
      sayan tekrar koşusu yetersizdir. Gerçek claim'ler, Ref/Ext yatırımları,
      sensörün açtığı normal mining ve açık tersaneye göre ücretli ordu planı ölçüldü.
    - 5 Dart + Warden + 4 ücretli Pike + 5 ücretli Talon + 2 Courier ile tek DECISIVE;
      Core 6 hazır, gerçek haul founding'i finanse eder, normal settlement koloni kurar.
      Üç gerçek asteroid alanında **201,39 / 206,06 / 215,26 dakika**; en hızlı
      bulunan 3 saat 21 dakika (Akademi çıkışından), matematiksel minimum değildir.
    - DB kaynak makbuzları, tam %30 sipariş süreleri, garrison ve gerçek sahiplik
      tekrar doğrulandı. **Doğal 6 saat hedefi hâlâ sağlanmıyor.** Tam workspace
      verify ve yeni filo/season kalibrasyonu yok; push/deploy/reset/yeni commit yok.
      Rapor: `docs/economy-experiment-30pct-2026-09-13.md`.
