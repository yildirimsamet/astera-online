# Bilinmeyen Sinyal — uygulama planı (2026-10-17)

Durum: **owner kararları kesinleşti, uygulama başlamadı.** Bu dosya soğuk bir agent'ın
okuyup doğrudan geliştirmeye başlayabilmesi için yazıldı. Önce `CLAUDE.md` oku; TDD,
tasarım disiplini, test kuralları (seri koşu, 4 GiB heap, uzun simülasyon yok) aynen
geçerli. Bu plan ile kod çelişirse **kod ve testler kesin bilgidir**; sayıları buradaki
owner kararlarından al.

---

## 1. Özet

Tier 1–3 oyunculara ortalama 3 saatte bir, kendi radar menzili içinde **yalnız kendisine
görünen** bir "Bilinmeyen Sinyal" çıkar. Oyuncu sinyale dokunur, **tam olarak 1 adet T1
savaş gemisi + 1 adet Kurye** gönderir. Filo vardığında tek bir sonuç açılır: kaynak,
terk edilmiş gemi, enerji parçası (üretim boost'u), bedava skin veya korsan pususu (iki
gemi de yok olur). Yarış yok; sinyal kişiseldir.

Ürün gerekçesi: CURIOSITY + RISK + RE-ENGAGEMENT. Küçük, okunabilir bir bahis: "iki ucuz
gemiyi riske at, ne çıkacak?" Düşük tier oyuncuya galakside gidecek bir yer verir.

---

## 2. Kesinleşmiş owner kararları (değiştirme — değişiklik owner'a sorulur)

| # | Konu | Karar |
|---|---|---|
| O1 | Kimler | `coreTier(peakCoreLevel)` 1, 2 veya 3 olan oyuncular (peak Core 1–9). |
| O2 | Kişisel | Sinyal yalnız sahibine üretilir ve yalnız ona görünür. Yarış yok. |
| O3 | Sıklık | Sonraki sinyal, **öncekinin çıktığı andan** itibaren `U[120, 240]` dakika sonra çıkar (ortalama 3 saat; en az 2, en çok 4). |
| O4 | Ömür | Gönderilmeyen sinyal çıktığı andan **60 dakika** sonra kaybolur. |
| O5 | Çevrimdışı | Sinyal oyuncu çevrimdışıyken de çıkar ve süresi dolunca kaybolur (owner: "arada oyuna girmeye teşvik eder"). Birikmez. |
| O6 | Konum | Başkente **en az 400 birim**, en çok radar menzili kadar uzakta. Başka bir gezegenin içinde veya çok yakınında çıkmaz (tıklama çakışması). |
| O7 | Filo | **Tam olarak** 1 savaş gemisi ∈ {Ok `DART`, Kargı `PIKE`, Sur `RAMPART`, Muhafız `WARDEN`} + 1 `COURIER` (Kurye). Ne eksik ne fazla. Başka gemi gönderilemez. |
| O8 | Gemi yoksa | Sheet eksik gemiyi söyler ve üretime yönlendirir. |
| O9 | Tek ödül | Her sinyal tam olarak bir sonuç verir. |
| O10 | Olasılıklar | Kaynak **%56** · Enerji parçası **%15** · Terk edilmiş gemi **%12** · Korsan **%16** · Skin **%1** |
| O11 | Kaynak | Toplam ≤ 1000. Döteryum ≤ 100. Verilen alaşım ≥ 200, kristal ≥ 100, döteryum ≥ 10. Tek kaynak, ikili veya üçlü kombinasyon olabilir. |
| O12 | Terk edilmiş gemi | Yalnız savaş gemisi (OFFENSIVE/DEFENSIVE aile; Nullifier, Çöp Toplayıcı ve kargo yok). **Tier 4 asla.** Oyuncu tier'ına göre: T1 → T1 %80 · T2 %15 · T3 %5; T2 → T2 %90 · T3 %10; T3 → T3 %100. |
| O13 | Gemi hasarı | Terk edilmiş gemi **%20–%60** (düzgün) hasarlı gelir. Tamir ücreti normal formülle; özel indirim yok. |
| O14 | Enerji parçası | **Ana gezegende (başkent)** üretim +%100, süre 1, 2, 3 veya 4 saat. |
| O15 | Boost çakışması | Recovery boost (+%50) ile aynı anda aktifse **toplanır**: ×2.5. |
| O16 | Skin havuzu | Var olan skinlerden: **%70** ücretli bayrak (`FLAG`, `free: false`), **%15** element gezegen (`planet-lava`, `planet-ice`, `planet-desert`, `planet-toxic`), **%15** gezegen halkası (`ring-*`). |
| O17 | Korsan | Savaş gemisi + Kurye yok olur. Başka kayıp yok. |
| O18 | Yayın | **Bayrak yok.** Özellik deploy edildiği anda **mevcut canlı sezonda** çalışır. Deploy sonrası uygun oyunculara ilk sinyal `şimdi + U[0,120]` dk içinde dağıtılır (D13 backfill). Migration additive, reset yok. |
| O19 | Radar dersi | Metin, sinyali **radarın** yakaladığını ve radarın önemini fark ettirmeli (§5.2b). |

### Owner'ın itiraz etmediği, planlayanın verdiği kararlar

Bunlar küçük ve geri alınabilir; owner değiştirmek isterse sadece sayı veya kural değişir.

- **D1 · Sonuç zamanı:** Sinyal yaratılırken bir `seed` saklanır. Sonuç, varışta
  `seededFrom(seed)` ile **deterministik** hesaplanır; tekrar zar atma yolu yoktur.
  Gemi tier'ı **gönderim anındaki** oyuncu tier'ından okunur.
- **D2 · Teslim zamanı:** Sonuç **varışta** açıklanır (bildirim + canlı akış). Fiziksel
  ödüller (kaynak, terk edilmiş gemi) **filo eve indiğinde** teslim edilir. Fiziksel olmayan
  ödüller (enerji boost'u, skin) **varışta** verilir: dönüşte radyasyonla gemi kaybı veya
  arada skin satın alma gibi durumlar duyurulan ödülü bozmasın diye.
  Korsan sonucunda iki gemi **varışta** yok olur, dönüş bacağı olmaz.
- **D3 · Radar 0:** Başkentte radar yoksa (seviye 0) menzil olarak L1 değeri kullanılır
  (`INTEL.radarContactRange[1]` = 2700). Aksi hâlde başkentin radar seviyesinin
  `radarContactRange` değeri. Radar seviyesi başkentin `satellites` satırındaki `RADAR`
  enstrümanından okunur (radar menzilini hesaplayan mevcut kodu kullan, yeniden yazma).
  Uzaklıklar **oyun biriminde**dir (gezegen konumları, `radarContactRange`, `GALAXY.radius`).
  `toWorld` yalnız çizim içindir ve y eksenini abartır; yerleşimde kullanma.
- **D4 · Gezegen boşluğu:** Sinyal her gezegen merkezine en az **250** birim uzakta
  (gezegenler arası `GALAXY.minSeparation` = 450; 250 bunun yarısından fazla). Başkente ≥ 400
  kuralı ayrıca geçerli. Galaksi sınırının içinde kalır. Seeded rejection sampling, en fazla
  40 deneme; yer bulunamazsa bu sinyal atlanır ve sonraki normal zamanlanır (log/metric).
  Hareketli nesneler (asteroit, korsan, anıt) için boşluk aranmaz; tıklama önceliği §6'da.
- **D5 · Kalkış:** Oyuncunun kendi gezegenlerinden herhangi birinden gönderilebilir; filo
  çıktığı gezegene döner (diğer şeritlerle aynı). Sinyalin merkezi her zaman başkenttir.
- **D6 · Hız:** Yalnız tam hız. Pace seçimi bu sheet'te gösterilmez.
- **D7 · Yakıt ve yuva:** Normal `missionFuel` / `assertFuel` ve `assertFreeBay` kuralları.
  Faults'un kalkış yasağı (`assertDeparturesAllowed`) geçerli.
- **D8 · Hasarlı gemi:** Gönderilecek gemiler hasarlı olabilir (yaralarıyla gider ve döner;
  `selectHomeDispatch` / `takeHomeHealth`). Korsan sonucu hasardan bağımsızdır.
- **D9 · Geri çağırma:** Varıştan önce geri çağrılabilir. Geri çağrılan sinyal tüketilmiş sayılır,
  ödül yok, gemiler standart geri dönüş hesabıyla döner.
- **D10 · Tier yükselmesi:** Tier 4'e çıkan oyuncunun açık sinyali ve yoldaki görevi normal
  tamamlanır; yeni sinyal çıkmaz (peak düşmediği için zincir kalıcı olarak durur). Açık
  sinyal T4 olduktan sonra gönderilirse `tierAtDispatch = min(tier, 3)` kullanılır
  (terk edilmiş gemi tablosunda 4 yok).
- **D11 · Kimler hiç almaz / ne zaman atlanır:**
  - **Botlar hiç almaz.** Bot kimliği yalnız `bot_profiles` üzerinden okunur
    (`asteroidSpawn.ts` deseni); kullanıcı adına bakılmaz.
  - **Sessiz Uzay (D212):** shard rolü `WAITING` olan sezonda sinyal üretilmez. Gönderim
    `assertOutsideSilentSpace(origin)` çağırır (korsan, ticaret ve madencilik şeritleriyle aynı).
  - Oyuncu tatildeyse, başkenti yoksa veya sezon `live` değilse sinyal **atlanır** ve sonraki
    normal zamanlanır. T4'te ise zincir durur.
  - Tatil `shiftClocks` ile kişisel süreleri kaydırır. Sinyalin `expires_at` ve `next_at`
    değerleri **kaydırılmaz**: açık sinyal süresi dolunca kaybolur, tatilde yeni sinyal çıkmaz.
- **D11b · İlerleme damgası:** Sinyal gönderimi, korsan akını gibi `markProgress` çağırır
  (D212'nin 30 saatlik sayacını sıfırlar).
- **D12 · Aynı anda tek sinyal:** O3 + O4 nedeniyle iki açık sinyal olamaz (60 dk < 120 dk). Yine
  de bir oyuncunun aynı anda en fazla bir `open` sinyali olacağı DB'de garanti edilir. Önceki
  sinyalin filosu hâlâ yoldayken yeni sinyal çıkabilir (gönderebilmek için ikinci bir Ok/Kargı/Sur/Muhafız
  + Kurye gerekir).
- **D13 · İlk sinyal:** Yeni kayıt: `kayıt + U[120,240]` dk. Deploy anındaki mevcut uygun
  oyuncular için backfill: `şimdi + U[0,120]` dk (yük yayılsın).
- **D14 · Bildirim:** Sinyalin **çıkışı** kalıcı bildirim satırı **üretmez** (D45: süresi geçmiş
  bir sinyal eyleme dönüştürülemez, gürültü olur); çevrimiçi oyuncuya canlı toast ve harita
  işareti yeterli. **Sonuç** (varış) kalıcı bildirim üretir: yeni `notificationKind`
  `unknown_signal_result` (enum'un SONUNA eklenir). İniş mevcut `fleet_returned` ile.
- **D15 · Korsan görseli:** Ayrı enkaz alanı veya savaş raporu yok (gerçek savaş değil). Oyuncu
  izliyorsa filo sinyal noktasında mevcut patlama efektiyle yok olur.
- **D16 · Oranlar görünür:** Sheet'te olası sonuçlar yüzdeleriyle gösterilir (CLAUDE.md §2
  Predictability: girdiyi ve kuralı ver, cevabı sakla).
- **D17 · Enerji boost'u üst üste:** Aktif bir sinyal boost'u varken yenisi gelirse süreler
  toplanmaz: `signalBoostUntil = max(mevcut, varış + saat)`.
- **D18 · Skin yedeği:** Seçilen kategoride sahip olunmayan skin yoksa havuzdaki diğer
  kategorilerden sahip olunmayan biri seçilir (sabit sıra: FLAG → PLANET elementleri → RING).
  Havuzda hiç sahip olunmayan yoksa sonuç **kaynak** ödülüne döner (aynı seed'le).
  Sahiplik **varış** anında, entitlement'ı yazan aynı transaction içinde kontrol edilir.
  Unique çakışma (yarışan satın alma) yedek kurala düşer, hata vermez.
- **D19 · Kaynak yuvarlama:** Alaşım ve kristal 10'un katı; döteryum tam sayı.
- **D20 · Terk edilmiş gemi her zaman iner.** Emsal: korsan akınının `capturedHull`'u
  (`resolvePirateReturn`, D133). Hangar doluluğu (`TARGET_HANGAR_FULL`) ve
  `hullProductionAccessible` kontrolü **uygulanmaz**. Owner açıkça T1 oyuncuya T3 gemi
  çıkabilmesini istedi. Tamir istasyonu tersane ve araştırma şartı aramaz (`repair.ts`),
  dolayısıyla oyuncu gemiyi tamir edebilir. `builtEver` artırılmaz (gemiyi oyuncu üretmedi).
- **D21 · Test/dev tetikleyicisi:** Prod dışında, bir oyuncuya **şimdi** sinyal çıkaran ve
  sonucu zorlayan (`outcome` override) bir dev yolu olmalı. Yoksa görsel doğrulama ve manuel
  test 2–4 saat bekler. Mevcut dev/admin araç desenini izle; prod'da kapalı olduğunu test et.

---

## 3. Kural spesifikasyonu (packages/rules — saf fonksiyonlar)

Yeni dosya: `packages/rules/src/unknownSignal.ts`, sabitler `constants.ts` içinde
`UNKNOWN_SIGNAL` objesi. **İsim uyarısı:** web'de `galaxy/asteroidSignal.ts` asteroit rengi
içindir, bununla ilgisi yok. Her yerde `unknownSignal` önekini kullan.

```ts
export const UNKNOWN_SIGNAL = {
  tiers: [1, 2, 3],
  gapMinutes: [120, 240],          // çıkıştan çıkışa
  lifetimeMinutes: 60,
  minFromCapital: 400,
  minFromAnyPlanet: 250,
  noRadarRangeLevel: 1,            // radar 0 → L1 menzili
  placementAttempts: 40,
  warshipHulls: ['DART', 'PIKE', 'RAMPART', 'WARDEN'],
  cargoHull: 'COURIER',
  outcomeWeights: { RESOURCES: 56, ENERGY: 15, DERELICT: 12, PIRATES: 16, SKIN: 1 },
  resources: { totalMax: 1000, alloyMin: 200, crystalMin: 100, deuteriumMin: 10, deuteriumMax: 100 },
  derelictTierWeights: { 1: { 1: 80, 2: 15, 3: 5 }, 2: { 2: 90, 3: 10 }, 3: { 3: 100 } },
  derelictDamagePct: [20, 60],
  energyHours: [1, 2, 3, 4],
  energyProductionBonus: 1.0,      // +%100; recovery'nin +%50'siyle toplanır
  skinCategoryWeights: { FLAG: 70, PLANET_ELEMENT: 15, RING: 15 },
  planetElementSkins: ['planet-lava', 'planet-ice', 'planet-desert', 'planet-toxic'],
} as const;
```

### 3.1 Kaynak rolü (O11, D19)

1. 7 boş olmayan alt kümeden ({A}, {K}, {D}, {A,K}, {A,D}, {K,D}, {A,K,D}) biri eşit olasılıkla seçilir.
2. Seçilenlerin alt sınırları toplamı `minSum`. Üst sınır: `{D}` ise 100, yoksa 1000.
3. Toplam hedef `T ~ U[minSum, üst]`.
4. Fazlalık `T − minSum` seçilenler arasında rastgele ağırlıklarla dağıtılır. Döteryum fazlası
   ≤ 90 (D ≤ 100); taşan kısım diğer seçilenlere aktarılır.
5. A ve K 10'un katına **aşağı** yuvarlanır (alt sınır korunur), D tam sayı.

Özellik testleri (binlerce seed): toplam ≤ 1000; D ≤ 100; seçilmeyen = 0; seçilen ≥ alt sınır;
7 kombinasyonun hepsi gözlemlenir; tek başına A ve K'nın en büyük değerleri 1000'e ulaşabilir.

### 3.2 Sonuç rolü

`rollUnknownSignalOutcome(seed, tierAtDispatch, ownedSkinIds)` →
`{ kind: 'RESOURCES', loot } | { kind: 'ENERGY', hours } | { kind: 'DERELICT', hull, damageBp } | { kind: 'PIRATES' } | { kind: 'SKIN', cosmeticId }`

- Ağırlıklar O10. Dağılım testi: 100k seed'de her oran ±1 puan.
- DERELICT: tier dağılımı O12, aile filtresi O12, `damageBp ∈ [2000, 6000]`.
  `tier 4` ve `SPECIALIST` / `CARGO` hiçbir seed'de çıkmamalı.
- SKIN: O16 + D18. Sahiplik listesi argüman; havuzun hepsi sahipliyse RESOURCES.
- Aynı seed → aynı sonuç (determinizm testi).

### 3.3 Yerleşim

`placeUnknownSignal(seed, capital, planets, radarLevel, galaxyRadius)` → `Vec3 | null`.
Gezegenlerin dağıldığı düzleme/yüksekliğe uygun örnekle (`galaxy.ts` yerleşimini incele).
Testler: ≥ 400 başkent; ≥ 250 her gezegen; ≤ menzil; galaksi içinde; radar 0 → 2700;
dolu galakside `null`.

### 3.4 Filo doğrulaması

`validateUnknownSignalFleet(fleet)`: tam olarak iki kayıt; biri `warshipHulls` içinden adet 1,
diğeri `COURIER` adet 1. Ret senaryoları: boş, yalnız Kurye, yalnız savaş gemisi, 2 Ok, Ok+Kargı+Kurye,
`VIPER`+Kurye, Ok+`WAYFARER`, negatif/ondalık/NaN adet, bilinmeyen hull.

### 3.5 Üretim boost'u (O14, O15)

`economy.ts → productionHours(from, to, disruptedUntil, boostUntil)` bugün yalnız recovery
boost'unu biliyor. Sinyal boost'u ayrı bir pencere olarak eklenir:

```
saat = (normal + recoveryPenceresi × 0.5 + sinyalPenceresi × 1.0) / 60
```

İki pencere çakışırsa ×2.5 (toplama). İki pencere de "productive minutes" üzerinden
ödenir (disruption içi üretim yok; mevcut kuralla aynı). **Aynı fonksiyon hem sunucu tick'i
hem istemci üretim projeksiyonu tarafından kullanılıyor; ikisi de güncellenmeli.**
Testler: yalnız sinyal, yalnız recovery, çakışan, kısmi çakışan, pencere bitimi aralık içinde,
disruption içinde, `null`/NaN.

---

## 4. Sunucu (apps/server)

### 4.1 Şablon

En yakın mevcut şerit **korsan akını**: `services/pirateRaid.ts` (gönderim, varış, dönüş,
iniş, hasar, yakıt, yuva, akış). Aynı desenleri kullan, yeni soyutlama kurma.

### 4.2 Veritabanı (additive migration)

> Migration numarasını **uygulama anında** kontrol et. Bu plan yazılırken çalışma ağacında
> başka bir oturumun commit'lenmemiş `0182_chat_media.sql` dosyası vardı. Başkasının
> commit'lenmemiş dosyalarına dokunma. Drizzle'ın sırasız timestamp tuzağı için:
> memory `astera-drizzle-skipped-migration`.

- Yeni tablo `unknown_signals`:
  `id, season_id, player_id, seed (text/bigint), position (x,y,z), appeared_at, expires_at,
  status ('open' | 'outbound' | 'returning' | 'done' | 'expired' | 'recalled' | 'lost'),
  origin_planet_id, fleet (jsonb), damage (jsonb), tier_at_dispatch, depart_at, arrive_at,
  return_at, outcome (jsonb, varışta yazılır), delivered_at, created_at`.
  Kısmi unique index: `(player_id) WHERE status = 'open'` (D12).
- Oyuncu başına zamanlama: `unknown_signal_state(player_id PK, season_id, next_at)` veya mevcut
  bir oyuncu tablosuna `next_unknown_signal_at` kolonu. Hangisi daha sadeyse.
- `event_kind` enum'unun **sonuna**: `unknown_signal_spawn`, `unknown_signal_expire`,
  `unknown_signal_arrival`, `unknown_signal_return`.
- `notification_kind` enum'unun **sonuna**: `unknown_signal_result`.
- Planet tablosuna `signal_boost_until timestamptz null` (başkent satırında kullanılır).
- `cosmetic_entitlements.source` için yeni değer `UNKNOWN_SIGNAL` (tipine bak: enum ise sona ekle).
- Tatil modu: `vacation.ts:162` `recoveryBoostUntil`'i kaydırıyor; `signalBoostUntil` aynı
  muameleyi görmeli.

### 4.3 Akış

1. **Spawn olayı** (`unknown_signal_spawn`): oyuncu kilidi → uygunluk (O1, D11) → yerleşim (§3.3) →
   `open` satır + `expire` olayı (+60) → sonraki spawn (`appeared_at + U[120,240]`; seed'li,
   seed = `seasonId, playerId, sıra no`) → **yalnız oyuncunun kişisel akışına** yayın.
2. **Expire olayı:** satır hâlâ `open` ise `expired` + kişisel akış. `outbound` ise dokunma.
3. **Gönderim API'si** (`POST`, idempotent; mevcut `idempotency` servisini kullan): oyuncu ve
   kalkış gezegeni kilidi, sinyal satırı `FOR UPDATE`, `status = 'open'` ve `now < expires_at`,
   §3.4, sahiplik, `assertFreeBay`, `assertFuel`, `takeHomeHealth` → `outbound` + `arrival` olayı.
   Hata kodları: `UNKNOWN_SIGNAL_NOT_FOUND` (başkasının sinyali de bu: varlığını sızdırma),
   `UNKNOWN_SIGNAL_EXPIRED`, `UNKNOWN_SIGNAL_TAKEN`, `UNKNOWN_SIGNAL_FLEET` + mevcut
   `NO_FREE_BAY` / yakıt hataları. Hepsine 6 dilde `errors.ts` metni.
4. **Geri çağırma API'si:** yalnız `outbound` ve varıştan önce → `recalled` + standart dönüş.
5. **Arrival olayı:** gidiş bacağının radyasyonu (`settleSpecialFlightRadiation`, korsan
   şeridiyle aynı; iki gemi de ölürse sinyal `lost`, sonuç açılmaz) → sonuç rolü (§3.2) →
   `outcome` yazılır → ENERGY: başkentin `signal_boost_until` (D17) · SKIN: entitlement
   (`source: UNKNOWN_SIGNAL`, hesap seviyesinde kalıcı, D18) → bildirim
   `unknown_signal_result` + akış.
   PIRATES: gemiler silinir, `lost`, dönüş yok, `recomputePlayerWealth`.
   Diğerleri: `returning` + `return` olayı.
6. **Return olayı (iniş):** `resolvePirateReturn`'ü örnek al:
   - Teslim yeri `safeHomePlanet(ownerPlayerId, originPlanetId)`.
   - Dönüş bacağının radyasyonu uygulanır.
   - `capLoadToSurvivors`: Kurye ölürse kaynak taşınamaz. DERELICT gemisi radyasyonda ölürse
     iniş listesinden düşer.
   - `landShips` ile gemiler ve yaraları; DERELICT gemisi kendi `damageBp` lot'uyla aynı
     inişe eklenir (D20).
   - Kaynaklar `saveResources` ile depoya eklenir (korsan ganimeti gibi; collector'a girmez).
   - Ardından `recomputePlayerWealth`, `fleet_returned` bildirimi, durum `done` ve `delivered_at`.
7. **Sezon sonu:** açık sinyaller kaybolur; yoldaki görevler korsan akınının sezon sonu
   davranışını izler. Yeni sezonda zincir sıfırdan (D13 backfill kuralıyla) başlar.

### 4.4 Gizlilik

Sinyal **hiçbir zaman** public galaksi payload'ına, shard yayınına, başka oyuncunun okumasına,
istihbarat/probe/telescope sonuçlarına girmez. Giden filo diğer oyunculara sıradan trafik
olarak görünebilir (korsan akını trafiği nasıl görünüyorsa), ama hedefi "sinyal" olarak
ifşa edilmez. Bunun testi zorunlu.

### 4.5 Yanlış kurulması kolay yerler

- `productionHours` sunucu tick'i + istemci projeksiyonu + `planet.ts:207` civarındaki
  boost dakika dönüşümü (aynı şekilde `signalBoostUntilMinutes`).
- Spawn zinciri asla kopmamalı: olay hata verirse sonraki spawn yine zamanlanmalı
  (idempotent işleyici; aynı olay iki kez gelirse ikinci sinyal üretmemeli).
- Varış ve geri çağırma yarışı; gönderim ve expire yarışı; aynı sinyale iki eşzamanlı
  gönderim (biri kazanır).
- Kalkış kolonisi yoldayken el değiştirirse teslim `safeHomePlanet` ile yapılır (başkente düşer).
  Gemileri yeni sahibe teslim etme (korsan şeridindeki geçmiş hata).
- Yeni `notificationKind` için web tarafında `DESTINATION` satırı, cümle ve ikon gerekir
  (schema yorumuna bak). Eksik kalırsa bildirim yönsüz kalır.

---

## 5. Web (apps/web)

CLAUDE.md'deki dört soru + premium kural zorunlu. Hedef 350×812 (DPR 2) ve masaüstü.
`docs/ui-v2/design-mocks` dili, `docs/ux-writing.md`. Büyük font/buton yok, kompakt premium.

### 5.1 Galaksi işareti

- Sinyal noktasında **radyo dalgası gibi pulse**: merkezde küçük parlak çekirdek, dışa doğru
  genişleyip sönen 2–3 eş merkezli halka, ritmik (≈1.6 s). Billboard/shader, GPU'ya ucuz.
  Renk kaynak paletinden (yeşil döteryum, amber asteroit) ve düşman kırmızısından ayrı:
  soğuk camgöbeği/beyaz önerilir.
- Yanında küçük etiket: `Bilinmeyen sinyal · 42:10` (kalan süre).
- **Geniş dokunma alanı:** görsel boyutundan bağımsız sabit ekran-piksel hit yarıçapı.
  Sinyal ile hareketli nesne çakışırsa dokunmada sinyal öncelikli olur.
- Gönderim sonrası: pulse durur, sabit "hedeflendi" hâli, kendi filosu ona uçar.
  Varışta kısa bir açılma parlaması (korsanda patlama, D15). Süre dolunca yumuşak sönme.
- `prefers-reduced-motion` dalı **yazma** (proje kuralı).

### 5.2 HUD çipi ve toast

- Açık sinyal varken galaksi köşesinde küçük çip: ikon + geri sayım. Dokununca kamera sinyale
  uçar ve sheet açılır.
- Çevrimiçiyken yeni sinyal çıkınca kısa toast: "Radar bilinmeyen bir sinyal yakaladı".

### 5.2b Radarın değerini öğret (owner notu, 2026-10-17)

Owner isteği: metin oyuncuya **sinyali radarın yakaladığını** ve **radarın neden önemli
olduğunu** fark ettirmeli. Toast, sheet ve Wiki bunu söyler:

- Toast ve sheet başlığının altı: "Radarın, menzilindeki bilinmeyen bir sinyali yakaladı."
- Sheet'te radar satırı: mevcut radar seviyesi, menzil halkası ve tek cümle:
  "Radar menzili büyüdükçe sinyaller daha geniş bir alanda yakalanır." Sinyalin menzil halkası
  içinde durduğu, haritada radar çemberiyle birlikte gösterilir.
- **Radar 0 oyuncu** (L1 menzili ödünç alınır, D3): "Henüz radarın yok; bu sinyali yakın
  menzilde yakaladık. Radar kur, galaksinin sesini duy." Tek dokunuşla radar kurulum/yükseltme
  ekranına gider.
- Wiki bölümü radarın üç işini birlikte anlatır: gelen saldırı uyarısı, temas görünürlüğü ve
  sinyal alanı.
- Metin abartmaz ve yalan söylemez: radar sinyal **sıklığını** ve **ödülü** değiştirmez, yalnız
  sinyalin çıkabileceği alanı genişletir. Metin bunu ima etmemeli ("daha çok sinyal" deme).
  `docs/ux-writing.md` ve 6 dil.

### 5.3 "Sinyali incele" sheet'i

Kaynak: mevcut `LaunchSheet.tsx` / korsan gönderim sheet'inin dili. Yukarıdan aşağıya:

1. **Başlık:** Bilinmeyen Sinyal · kalan süre.
2. **Ne bu:** bir satır: "Radar menzilinde tanımlanamayan bir yayın. Bir savaş gemisi ve bir Kurye
   gönder, ne olduğunu gör."
3. **Mesafe ve süre:** tek yön ETA, gidiş-dönüş toplam ETA, yakıt maliyeti.
   Seçilen savaş gemisine göre canlı güncellenir (Sur yavaştır).
4. **Filo slotları:** `Savaş gemisi` (Ok / Kargı / Sur / Muhafız; her birinin hangardaki adedi;
   varsayılan: elde olan en ucuz) ve `Kurye` (adet). Adet seçimi yok, her slot tam olarak 1.
5. **Eksik gemi:** slot "Yok" der. Tek dokunuşla tersaneye yönlendirir. Kurye tersane 1 ister;
   tersane yoksa bunu söyler. Gönder düğmesi pasif ve nedenini yazar.
6. **Olası sonuçlar:** tek kompakt satır ikonlu yüzdeler (Kaynak 56 · Enerji 15 · Gemi 12 ·
   Korsan 16 · Skin 1). "?" ile açılan detay: kaynak aralıkları, gemi tier oranları ve %20–60
   hasar, enerji ×2 1–4 saat (recovery ile ×2.5), skin havuzu, korsan = iki gemi kaybolur.
7. **Risk satırı:** "Korsan çıkarsa kaybın: Ok + Kurye ≈ X alaşım, Y kristal" (gerçek fiyatlardan).
8. **Birincil buton:** "Sinyali incele".

### 5.4 Sonuç

- Varış bildirimi kartı sonuca göre:
  - Kaynak: miktarlar ("filo dönünce depoya eklenir").
  - Gemi: adı, tier'ı ve can yüzdesi ("tamir istasyonunda onarabilirsin").
  - Enerji: "ana gezegen üretimi ×2, N saat, şimdi başladı".
  - Skin: önizleme ve "Skinlerde".
  - Korsan: "Ok ve Kurye kayboldu".
- Ana gezegen üretim göstergesinde aktif sinyal boost'u ve kalan süresi görünür
  (recovery ile birlikteyse ×2.5).
- **Collector uyarısı:** Boost collector'ı daha hızlı doldurur ama büyütmez (`economy.ts`
  yorumu). Boost aktifken collector doluysa fazlası boşa gider. Oyuncuya kartta ve üretim
  göstergesinde "boost süresince toplamayı unutma" bilgisi gösterilir.
- Uçuşlar listesinde sinyal görevi kendi ikonu/etiketiyle.

### 5.5 Wiki ve metin

`GalaxyEventsGuide` / Wiki'ye "Bilinmeyen Sinyal" bölümü: kim alır, ne sıklıkla, ne gönderilir,
olası sonuçlar ve oranlar, risk. 6 dil (tr, en, de, es, fr, ja) eksiksiz; `docs/ux-writing.md`.

---

## 6. Dokunulacak yerler ve kırılma riski

| Alan | Dosyalar (başlangıç noktası) | Risk |
|---|---|---|
| Kurallar | `packages/rules/src/unknownSignal.ts` (yeni), `constants.ts`, `economy.ts`, `index.ts` | `productionHours` imzası değişirse tüm çağıranlar (sunucu + web) |
| Şema | `apps/server/src/db/schema.ts`, yeni migration | Enum'ları sona ekle; sıralama tuzağı |
| Servis | yeni `services/unknownSignal.ts`; `pirateRaid.ts` şablon; `shipDamage.ts`, `homeHealth.ts`, `flight.ts`, `fuel.ts`, `notifications.ts`, `cosmetics.ts`, `vacation.ts`, `planet.ts` | Üretim tick'i, tatil kaydırması, iniş |
| Worker | `worker/queue.ts` ve olay dispatch'i | Zincirin kopması, çift işlem |
| Route | yeni route + `app.ts` kaydı; Zod sözleşmesi; `test/contract.test.ts` | Sözleşme testi |
| Kayıt / backfill | `services/player.ts` (ilk spawn), tek seferlik backfill | Mevcut oyuncu yük dalgası |
| Web | `api/schemas.ts`, `api/queries.ts`, galaksi katmanı (yeni marker), HUD çip, yeni sheet, bildirim satırı, üretim projeksiyonu, Wiki, 6 locale | 350px taşma, dokunma çakışması |

Kırılmaması gerekenler: recovery boost tek başına aynı üretimi vermeli (regresyon testi);
korsan, ticaret, madencilik şeritleri ve filo yuvası sayımı değişmemeli; public galaksi
payload'ı byte bazında aynı kalmalı (sinyal sızmamalı).

---

## 7. Test listesi (önce yaz, kırmızıyı gör, sonra kodla)

Her owner kararı en az bir teste karşılık gelir.

**Rules:** §3.1–3.5'teki tüm özellik ve sınır testleri; filo doğrulama ret matrisi;
olasılık dağılımları; determinizm; tier 4 / specialist / cargo gemisinin hiç çıkmaması.

**Server (seri, tek worker):**
- Spawn: T1–3 alır; T4 almaz ve zincir durur; bot hiç almaz; Sessiz Uzay shard'ında
  üretilmez; tatil / sezon dışı atlanır ama sonraki zamanlanır; tatil süreleri kaydırmaz; gap `[120,240]`; expire +60; iki açık sinyal imkânsız (unique index +
  eşzamanlı spawn); çift olay → tek sinyal; yerleşim kuralları gerçek galakside.
- Gönderim: happy path; süre dolmuş; başkasının sinyali (`NOT_FOUND`); zaten gönderilmiş;
  her geçersiz filo; gemi yok; yuva yok; yakıt yok; kalkış yasağı; hasarlı gemiyle gönderim;
  idempotent tekrar; iki eşzamanlı gönderim → bir kazanan; gönderim ve expire yarışı;
  Sessiz Uzay'da `SILENT_SPACE_LOCKED`; gönderim `lastProgressAt`'i yazar; T4'e çıkmış
  oyuncunun açık sinyali `tierAtDispatch = 3` ile çalışır.
- Varış: her sonuç türü (seed sabitlenerek); korsanda gemiler silinir, dönüş yok ve servet
  yeniden hesaplanır; ENERGY başkentte (kalkış koloniden olsa bile) ve D17; skin entitlement
  varışta, sahiplik yedeği (D18), tamamı sahipliyken kaynağa dönüş, yarışan satın almada hata yok;
  gidiş radyasyonu iki gemiyi öldürürse sonuç yok.
- İniş: kaynak depoya; DERELICT gemi doğru `damageBp` ile ve **dolu hangara da** iner (D20),
  `builtEver` değişmez, tamir fiyatı normal formül; Kurye radyasyonda ölürse kaynak düşer;
  kalkış kolonisi el değiştirdiyse teslim başkente; servet yeniden hesaplanır.
- Dev tetikleyicisi (D21) prod'da kapalı.
- Backfill (O18): canlı sezondaki her uygun oyuncuya tek bir ilk sinyal zamanlar; iki kez
  çalışırsa (ör. sunucu yeniden başlarsa) çift sinyal üretmez.
- Geri çağırma: varıştan önce mümkün, sonra değil; ödül yok.
- Üretim: sinyal boost'u tick'te ×2; recovery ile ×2.5; tatilde kayma.
- Gizlilik: başka oyuncunun galaksi okuması, shard akışı ve istihbarat sonuçlarında sinyal yok.
- Sezon sonu davranışı.
- Sözleşme testi (`contract.test.ts`) yeni route'larla.

**Web:** sheet durumları (iki gemi var / biri eksik / hiçbiri / tersane yok / süre doldu /
yuva yok / yakıt yok / radar 0 metni ve radar ekranına geçiş); varsayılan seçim en ucuz; ETA seçime göre değişir; oranlar ve risk
satırı; sonuç kartı 5 türde; üretim projeksiyonu boost'lu; i18n anahtarları 6 dilde.

**Görsel:** `node tools/visual.mjs` ile 350×812 ve masaüstü: işaret pulse'u, etiket, çip,
sheet'in tüm durumları, sonuç kartları. Her Playwright koşusu bir komutan kaydediyor; ~5 koşu
kayıt limitine takılır (memory `astera-visual-signup-limit`). Fotoğraflamadan bitti deme.

**Kapsam dışı:** ekonomi/sezon simülasyonları ve snowball audit (owner kuralı 2026-10-09).

---

## 8. Uygulama sırası

1. **Rules** (§3): sabitler + saf fonksiyonlar + testler. `productionHours` genişlemesi.
2. **Şema + migration**, enum eklemeleri.
3. **Sunucu**: spawn/expire zinciri → gönderim → varış → iniş → geri çağırma → boost →
   skin → bildirim → akış → route + Zod → kayıt/backfill. Her adımda ilgili testler.
4. **Web**: API şemaları → işaret → çip/toast → sheet → sonuç kartı → üretim göstergesi →
   Wiki → 6 dil.
5. **Görsel doğrulama** ve düzeltmeler.
6. **Teslim**: `pnpm verify` (seri, `nice -n 10`, heap ≤ 4 GiB), tam sunucu ve web suite'leri
   bir kez. Kırmızı baseline'ı yeniden ölçme (memory `astera-test-baseline-red`);
   yeni kırmızı olmadığını göster.

Çalışma kuralları: master üzerinde çalış, branch/worktree açma; başka oturumların
commit'lenmemiş hunk'larına dokunma; stash yapma. Commit ve deploy owner isteyince.
Prod canlı sezonda; migration additive, reset gerektirmez. Deploy ayrı bir karar.
