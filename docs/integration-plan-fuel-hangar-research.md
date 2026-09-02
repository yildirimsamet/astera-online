# Entegrasyon Planı — Yakıt · Hangar · Araştırma

> **Durum:** T1-T12 indi (D131–D140).
> Kalan: T13 (doküman) — her görevle birlikte yürüdü; kalan tek iş görsel doğrulama.
>
> **T12'de plandan sapmalar, gerekçeleriyle.** (a) Beş grup yerine **dört**: tek satırlık
> "Lojistik" bandı grup değil başlıktır, Gemi Ambarları Endüstri'ye girdi. (b) Plan yalnız
> menüyü istiyordu; T10'un **rotasız kalmış** `buildInterceptor`'ı da bu sürümde bağlandı —
> Önleme Ağı araştırması aksi hâlde hiçbir şeyi yetkilendirmiyordu. (c) Aynı tabloyu paylaşan
> iki varlık türünün **altı okuması** yanlıştı ve mühimmat inşa edilebilir olur olmaz canlı
> hataya dönüşüyordu; hepsi D140'ta.
> Ölçümler ve kalibrasyon gerekçeleri `docs/decisions.md` D131-D133'te.
> **Sahibi:** owner instruction (bu dosyadaki her karar oyun sahibinin talimatıdır).
> **Yazıldığı taban:** `081c416` + çalışma ağacındaki commit'lenmemiş D127/D128 işi.

Bu dosya altı konuluk bir talebin uygulama planıdır. Her görev için **ne yapılacak**,
**nasıl yapılacak**, **neyi bozabilir** ve **ne ölçülerek kabul edilecek** yazılıdır.

---

## 0 · Başlamadan önce

1. **Çalışma ağacındaki D127/D128 işi inmeden hiçbir görev başlamaz.** 92 dosyada
   commit'lenmemiş değişiklik var ve bu planın 4, 5, 6 numaralı görevleri aynı
   dosyalara dokunuyor (`constants.ts`, `hulls.ts`, `types.ts`, `planetView.ts`,
   `economy.ts`). Üstüne yazmak çakışma değil, sessiz kayıp üretir.
2. `pnpm verify` yeşil olmadan bir sonraki göreve geçilmez.
3. `packages/rules` değiştiğinde **iki dev sunucusu da yeniden başlatılır** —
   API galaksiyi önbelleğe alıyor, Vite bağlı paketi izlemiyor.
4. Bir dosyayı düzenlemeden önce **docblock'unu oku.** 3D dosyaları ve test
   koşumları yerel tuzaklarını yazıyor.

---

## 1 · Kapsam

### İçeride

| # | Görev |
|---|---|
| T1 | Kazıcı transfer açığının kapatılması |
| T2 | Kazıcılar normal baskında ölmez |
| T3 | Dünyalarım paneli + transfer arayüzünün anlaşılır hale getirilmesi |
| T4 | Hangar binası ve gemi alanı |
| T4b | Yer savunması emplasman kapağı — **T4 ile aynı sürümde** |
| T5 | Döteryum Rafinerisi (araştırma seviyesine bağlı) |
| T6 | Filo yakıtı |
| T7 | Araştırma altyapısının hesap-geneline taşınması |
| T8 | Ekonomi ve lojistik araştırmaları |
| T9 | Silah araştırmaları |
| T10 | Anti-ölüm-yıldızı yer savunması |
| T11 | Ölüm Yıldızı ×2 stoklama (seri üretim) |
| T12 | Araştırma menüsü (arayüz) |
| T13 | Doküman ve karar kayıtları |

### Dışarıda — bilinçli olarak

- **Filoyu geri çağırma.** Sahibi tarafından kapsam dışı bırakıldı. P3
  (`Launched fleets cannot be recalled`) olduğu gibi kalır.
- **4. ve 5. koloni.** `colonyCapacity` 3'te kalır; CLAUDE.md'deki locked
  constraint metnine dokunulmaz.

---

## 2 · Bağımlılık sırası

```
T1 ──┐
T2 ──┤  (bağımsız, paralel çıkabilir)
T3 ──┘

T4  (Hangar + gemi ALANI stat'ı)
     │
T7  (araştırma altyapısı: hesap geneli)
     ├──> T5  (rafineri — araştırma seviyesine bağlı)
     │       │
     │       └──> T6  (yakıt — T4'ün ALAN'ını ve T5'in arzını kullanır)
     ├──> T8  (ekonomi/lojistik araştırmaları)
     ├──> T9  (silah araştırmaları)
     ├──> T10 (anti-ölüm-yıldızı)
     ├──> T11 (Ölüm Yıldızı ×2)
     └──> T12 (araştırma menüsü)

T13 (doküman) — her görevle birlikte, sonda değil
```

**İki sıralama kuralı, ikisi de pazarlıksız:**

1. **T6 (yakıt), T5 (rafineri) olmadan inemez.** Döteryumun pasif üretimi yok;
   yakıt zorunlu olur ve rafineri yoksa sezonun ilk 35 saatinde hiç kimse hiçbir
   şey fırlatamaz.
2. **T10 (anti-sistem) ve T11 (×2 stoklama) aynı sürümde çıkmalı.** İkisi
   birbirinin cevabıdır: stoklama anti-sistemin cevabı, anti-sistem stoklamanın
   maliyetidir. Ayrı ayrı inerlerse denge bir sürüm boyunca tek taraflı kalır.
3. **T4b (yer savunması kapağı), T4 ile aynı sürümde çıkmalı.** Gemi tavanlı,
   taret tavansız bir sürüm yayınlamak kaplumbağayı dominant strateji yapar —
   ve bu, T4'ün kendi ürettiği bir eğimdir, eski bir sorun değil.

---

## 3 · Tüm iş boyunca geçerli kurallar

Bunlar görev bazlı değil, planın tamamı için geçerlidir.

### 3.1 Sunucu

- Her yeni kural `packages/rules` içinde **saf fonksiyon** olarak yazılır. Sunucu,
  simulator ve istemci aynı fonksiyonu okur. Bir etkinin bir yerde uygulanıp başka
  yerde unutulması bu kod tabanında daha önce yaşandı (satellite etkileri) ve
  docblock'lar bunu uyarı olarak taşıyor.
- Mutasyon sırası değişmez: **gezegen kilidi → ekonomiyi ilerlet → doğrula →
  değiştir → commit → yayınla.**
- İki gezegene dokunan her işlem **artan ID sırasında** kilitlenir (`lockWorlds`).
- Yeni bir zamanlanmış olay yazılıyorsa yeniden başlatma, tekrar teslim, çift
  kayıt ve işlem ortası hata için tasarlanır. Idempotent olmayan handler kabul
  edilmez.
- Yeni enum değerleri **listenin sonuna** eklenir. `ALTER TYPE ... ADD VALUE`
  ekler; listeyi yeniden sıralamak drizzle'a tipi baştan kurduran bir migration
  ürettirir.
- Sis (fog) sorguda zorlanır, arayüzde değil.
- Yeni rotalar `app.after()` **içinde** kaydedilir; dışarıda kaydedilen rota
  kuyruğa alınmış eklentileri (rate limit) almayabilir. Ret nesnesi düz obje değil
  `GameError` olur, yoksa `statusCode` kaybolur ve 500'e döner.
- **Yeni her tablo iki temizlik listesine girer:** `reclaim.ts` (koltuk geri
  kazanımı) ve `servers.ts` (sezon wipe). Girmezse ya yabancı anahtar ihlali ya
  sonsuza kadar büyüyen yetim satır olur.

### 3.2 İstemci

- Kullanıcıya görünen hiçbir metin bileşen içinde yazılmaz.
  `apps/web/src/i18n/locales/{en,tr}/` altına gider. **Türkçe, Türkçe yazılır** —
  birebir çeviri değil, doğal karşılık.
- Retler kod ve sayı taşır, bitmiş cümle taşımaz. Yerelleştirme istemcide olur.
- Tipografi sekiz rol token'ı; `.plate` / `.slab` bileşen sözlüğü; boşluk ölçeği
  `4·8·12·16·24·32`; ritim ebeveyn `gap`'i ile. ESLint keyfi değerleri yasaklıyor.
- Parmak altına monte edilen kontroller `useOwnPress` kullanır; klavye
  aktivasyonu (`detail === 0`) çalışmaya devam eder.
- Yalnızca **kesin** sonuçlar tahmin edilir. Optimistik güncellemeden önce her
  sunucu guard'ı tekrar kontrol edilir.
- Değişmeyen payload kimliğini korur (`shareStructure`).

### 3.3 Test

- **Testsiz kod bitmemiş iştir.**
- Hıza bağımlı kurallar sabit dakikayla değil **oranla** test edilir.
- Bir test kırıldığında önce kök neden bulunur; test veya bant genişletilmez.
- Yeni her rota `contract.test.ts`'e girer — şekil kayması birim testlerinden
  geçip istemciyi kırar.

### 3.4 Paylaşılan eğriler ve imza tuzakları

Bu kod tabanında bazı fonksiyonlar **tek eğri / tek imza** olarak yazılmış ve
onlarca yerden okunuyor. Yeni bir bina veya kaynak eklemek bu imzalara dokunuyor.
Her biri ayrı ayrı ele alınmalı.

**`upgradeCost(level)` bütün binalar için TEK eğridir.** Bina başına çarpan yok
(`INSTRUMENT_COST_MULT`'ın bina karşılığı yok). Sonuç: **Hangar ve Döteryum
Rafinerisi, aynı seviyedeki Core / Refinery / Extractor ile birebir aynı fiyata
mal olur** ve bağımsız fiyatlandırılamaz. İki yol var:

| Yol | Maliyet | Kırdığı yer |
|---|---|---|
| **A — Kabul et** *(önerilen)* | Sıfır | Yok. Yeni binalar paylaşılan eğriyi kullanır; denge Hangar'ın *kapasite* eğrisiyle ve rafinerinin *üretim* eğrisiyle ayarlanır |
| B — `BUILDING_COST_MULT` ekle | Orta | `investedInBuilding(level)` bina kimliği almak zorunda kalır → `score.ts:16` (Wealth), `strategic.ts::applyDeathStarStrike` içindeki `buildingDamage` döngüsü, ve `docs/balance.md`'deki her ölçüm |

**Yol A önerilir.** Fiyat, bir sonraki adımın *faydasıyla* ayarlanır — bir binanın
kaç seviye kapasite veya kaç birim üretim verdiğiyle — fiyat eğrisiyle değil.
Bu, `upgradeCost`'un tek eğri kalmasını sağlar ve Ölüm Yıldızı hasar hesabını
olduğu gibi bırakır.

**`vaultProtects(vault, refinery, extractor)` on dört yerden çağrılıyor.**
Döteryuma taban eklemek dördüncü bir parametre demek:

```
apps/server : worker/handlers.ts · services/clanLoot.ts · services/planetView.ts
packages/sim: invariants.ts · season.ts (dört ayrı yerde)
apps/web    : lib/gains.ts · lib/directives.ts · onboarding/world.ts
```

`gains.ts` ve `directives.ts` istemcinin **tavsiye** kodudur; sessizce yanlış
sayı vermeleri kullanıcıya yanlış yönlendirme olarak çıkar, tip hatası olarak
değil — çünkü parametre sayısı değişince derleyici zaten durduracaktır. Asıl risk
`onboarding/world.ts`: rehearsal'ın kendi dünyası aynı fonksiyonu okuyor ve
farklı bir taban gösterirse ekran kendi kendisiyle çelişir.

**`deuteriumStorageCap` ve `deuteriumCollectorCap` şu an Extractor oranından
türüyor.** Döteryumun kendi oranına çevrilmesi migration gerektirmez (türetilmiş
değerler), ama **mevcut her oyuncunun döteryum depo tavanı değişir.** Bu bir
denge kaymasıdır, sessiz bir düzeltme değil.

### 3.5 Ölçüm

- Simulator modellemediği faydayı fiyatlamaz. T6 (yakıt) ve T5 (rafineri) sim'e
  girmeden bantlar anlamını yitirir.
- Sağlık bandı bir özelliği kabul etmek için **genişletilmez.** Model veya sabit
  düzeltilir.

---

## 4 · Görevler

---

### T1 · Kazıcı transfer açığının kapatılması

**Amaç.** Bir gezegen ikiden fazla kazıcıya sahip olamıyor — ama transfer yoluyla
sınırsız kazıcı basılabiliyor. Açık kapatılacak, kazıcı taşıma yeteneği korunacak.

**Bağımlılık.** Yok. İlk inecek görev.

**Açığın tam mekanizması.**

1. `movement.ts::validateTransferFleet` yalnızca `HULLS[hull].ground` olanları
   reddediyor. `PROSPECTOR` ground değil → transfere giriyor.
2. `movement.ts::resolveTransfer` → `addUnits(tx, target.id, mission.fleet)` —
   hedefte **hiçbir kota kontrolü yok.**
3. `build.ts`'teki kota kontrolü `context.projected.units` okuyor; bu
   `totalUnitsOf(planetId)`, yani **gezegen başına.** Kazıcıları başka dünyaya
   yollayınca kalkış gezegeninin kotası boşalıyor.

Kalkış tarafı doğru çalışıyor: `reserveFleet` satırları `planetId = origin`,
`location = missionId` olarak bırakıyor ve `totalUnitsOf(origin)` bunları sayıyor.
**Delik yalnızca hedefte.**

**Dokunulan dosyalar.**

- `apps/server/src/services/movement.ts` — `launchTransfer`, `resolveTransfer`
- `apps/server/src/services/ownership.ts` — `transferPlanetControl`
- `apps/server/src/services/planet.ts` — yardımcı sayaç (varsa yeniden kullan)
- `apps/web/src/i18n/locales/{en,tr}/errors.ts`
- `apps/server/test/` — yeni test dosyası

**Nasıl.**

1. `packages/rules` içine tek bir yardımcı:
   `prospectorRoom(owned: number): number` → `PROSPECTOR.max - owned`.
   Sunucu ve istemci aynı sayıyı okur.
2. `launchTransfer` içinde, `lockWorlds` sonrası ve `assertFreeBay` yanında:
   hedefin `totalUnitsOf(targetPlanetId).PROSPECTOR` sayısı + taşınan kazıcı
   sayısı `PROSPECTOR.max`'ı aşıyorsa `PROSPECTOR_CAP` ile reddet.
   `lockWorlds` iki dünyayı da kilitlediği için sayım yarış koşulundan güvenlidir.
3. `resolveTransfer` içinde, `addUnits`'ten **önce** aynı kontrol. Aşıyorsa
   `rerouteToSafeHome(tx, mission, now)` çağır ve `'REROUTED'` dön. Bu yol zaten
   var — hedef dünya el değiştirdiğinde kullanılıyor.
4. `transferPlanetControl` içindeki
   `or(eq(units.location, 'home'), eq(units.hull, 'PROSPECTOR'))` satırı, ele
   geçirilen dünyanın kazıcılarını yeni sahibe devrediyor. Devir sonrası hedef
   dünya `PROSPECTOR.max`'ı aşıyorsa fazlası **silinmez** — bu bir savaş
   sonucudur, oyuncunun hatası değil. Aşım durumu T4'teki taşma kuralıyla aynı
   şekilde davranır: aşılmışken yeni kazıcı üretilemez ve gelen transfer
   reddedilir.

**⚠ Neyi bozabilir.**

| Risk | Nerede | Önlem |
|---|---|---|
| Kalkış kotası iki kez sayılır | `totalUnitsOf` uçan gemileri de sayıyor. Hedefte sayarken kalkıştaki rezerve satırları hedefe ait değil — karıştırma | Sayım her zaman `units.planetId` üzerinden; `location` filtresi yok |
| Yönlendirme ghost stack bırakır | `rerouteToSafeHome` yorumu bunu yazıyor: satırlar orijinal home satırında kalır, `location` mission id'siyle güncellenir | Mevcut fonksiyonu **değiştirme**, olduğu gibi çağır |
| Klan yardımı açığı | D114 zaten kazıcı hediyesini yasaklıyor | Sadece doğrula, değiştirme |
| Rehearsal kırılır | `rehearsalFetch.ts` transfer ucunu taklit etmiyor | Etkilenmiyor, doğrula |
| `abandon.ts` çakışması | Satır 146 madencilik koşusundaki kazıcıları eve geri katıyor; kota aşımı üretebilir | Aşımı **yasal** kabul et, silme |

**Test / kabul.**

- Kazıcı sayısı hiçbir yoldan `PROSPECTOR.max`'ı geçmiyor: üretim · transfer
  kalkışı · transfer varışı · dünya ele geçirme · madencilik dönüşü.
- Hedefi uçuş sırasında dolan bir transfer eve yönlendiriliyor, kazıcı silinmiyor.
- Aşım durumundaki bir gezegen yeni kazıcı üretemiyor ve transfer alamıyor.
- `PROSPECTOR_CAP` reti `{ max, have }` taşıyor, tr/en metinleri var.

---

### T2 · Kazıcılar normal baskında ölmez

**Amaç.** Kazıcı, sıradan bir baskında savunan filonun parçası olmaktan çıkar.
**Ölüm Yıldızı vuruşunda ölmeye devam eder.**

**Bağımlılık.** Yok.

**Neden.** Mevcut davranış bilinçli — `hulls.ts` docblock'u *"mining is not free
money, it is capital parked outdoors"* diyor. Ama bu bir **karar değil, ceza**:
oyuncu kazıcıyı savaşa sokma seçimi yapmıyor, sadece evde duruyor. Kaybı
madencilik yeteneğini tamamen durduruyor. Stratejik silahın onları hâlâ öldürmesi,
baskın ile vuruş arasındaki farkı korur.

**Dokunulan dosyalar.**

- `packages/rules/src/hulls.ts` — yeni `garrisonOf` yardımcısı + docblock revizyonu
- `apps/server/src/worker/handlers.ts` — savunan filo kurulumu (~487) ve sağ kalan
  yazımı (~494-500)
- `apps/server/src/services/neutral.ts` — neutral savaşı
- `apps/server/src/services/clanCombat.ts` — doğrula (aynı yolu kullanıyorsa
  otomatik düzelir)
- `apps/server/src/services/strategic.ts` — `DESTROYED_HOME` **değişmez**
- `packages/rules/test/combat.test.ts`, `apps/server/test/`

**Nasıl.**

1. `packages/rules/src/hulls.ts` içine:
   ```ts
   /** Bir baskının karşısına çıkan her şey. Kazıcı dahil değildir. */
   export function garrisonOf(home: Fleet, ground: Fleet): Fleet
   ```
   Kazıcıyı dışarıda bırakır. Neutral savaşı, oyuncu savaşı, klan savaşı ve
   rehearsal **bu tek fonksiyonu** okur.
2. `handlers.ts`'te `const defenders = { ...defender.homeFleet, ...defender.ground }`
   yerine `garrisonOf(defender.homeFleet, defender.ground)`.
3. **Sağ kalan yazımı — en kritik adım.** Mevcut döngü şöyle:
   ```ts
   for (const [hull] of fleetEntries(defender.homeFleet)) {
     defenderHome[hull] = result.defenderSurvivors[hull] ?? 0;
   }
   ```
   Kazıcı savaşa girmediği için `defenderSurvivors` içinde **yok** → `?? 0`
   çalışır → **bütün kazıcılar silinir.** Açık bir taşıma satırı şart:
   ```ts
   if (defender.homeFleet.PROSPECTOR) {
     defenderHome.PROSPECTOR = defender.homeFleet.PROSPECTOR;
   }
   ```
   Bu satır olmadan görev, düzeltmeye çalıştığı hatanın daha kötüsünü üretir.

**⚠ Neyi bozabilir.**

| Risk | Açıklama | Önlem |
|---|---|---|
| **Sessiz filo silme** | Yukarıdaki `?? 0` tuzağı | Açık taşıma satırı + test |
| Enkaz alanı | Enkaz `!HULLS[id].ground` ile süzülüyor; kazıcı ölmezse enkazı da olmaz | Beklenen davranış, teste yaz |
| Dominion değişimi | `defenderLossValue` ~2×850 düşer | İhmal edilebilir; sim ile doğrula |
| `grade` hesabı | Savunmasız gezegende artık DECISIVE daha güvenilir | İyi yönde — D112 claim penceresi için doğru |
| Ölüm Yıldızı | `DESTROYED_HOME` listesinde `PROSPECTOR` var | **Dokunma.** Vuruş öldürmeye devam eder |
| Neutral dünyalar | Kazıcıları yok | Etkisiz, ama tek fonksiyon kullansın |

**Test / kabul.**

- Baskın sonrası kazıcı sayısı değişmiyor — kazanan, kaybeden ve imha edilen
  savunma senaryolarının üçünde de.
- Ölüm Yıldızı vuruşu sonrası kazıcı sayısı sıfır.
- Yalnızca kazıcısı olan bir gezegene yapılan baskın DECISIVE dönüyor.
- Kazıcı enkazı üretilmiyor.

---

### T3 · Dünyalarım paneli + transfer arayüzü

**Amaç.** Dünyalar arası geçiş ve maden/gemi aktarımı tek bir kolay yerden
yapılabilsin. Maden aktarımı için şilep gerektiği ekranda **görünsün.**

**Bağımlılık.** Yok. **Sunucu değişikliği gerekmiyor.**

**Neden sunucu değişmiyor.** `POST /api/fleet/transfer` gövdesinde zaten
`originPlanetId` alıyor (`routes/planet.ts:272`). Yani aktif dünyayı
değiştirmeden herhangi bir dünyadan herhangi bir dünyaya transfer bugün
mümkün — sadece arayüzü yok.

**Şilep sorununun tam sebebi.** `TransferSheet.tsx` gemi satırlarını
`MOVABLE.filter((id) => (planet.fleet[id] ?? 0) > 0)` ile kuruyor. Şilebin yoksa
**listede Şilep satırı hiç çıkmıyor**, kapasite sessizce `0 / 0` gösteriyor,
kaydırıcılar 0'da kilitli kalıyor ve sebep hiçbir yerde yazmıyor. Sunucunun
`TRANSFER_NEEDS_CARGO_HULL` reti var ama ekran o cümleyi hiç kurmuyor.

**Dokunulan dosyalar.**

- `apps/web/src/screens/GalaxyView.tsx` — sağ üstteki `HomeworldIcon` butonu (~660)
- `apps/web/src/screens/TransferSheet.tsx`
- Yeni: `apps/web/src/screens/WorldsPanel.tsx`
- `apps/web/src/api/world.tsx` — `useWorld` (değişiklik gerekmeyebilir)
- `apps/web/src/i18n/locales/{en,tr}/world.ts`, `shell.ts`
- `apps/web/test/`

**Nasıl.**

1. **Dünyalarım paneli.** Sağ üstteki gezegen ikonu (şu an yalnızca kamerayı eve
   alan `HomeworldIcon`) paneli açar. Her dünya için:
   - isim, tür (capital/koloni), kaynak özeti, filo özeti, uçuş yuvası durumu
   - satıra dokun → **hem odaklan hem aktif yap**
   - satırda "buraya gönder" affordance'ı
2. **Odak ve aktif dünya birlikte hareket eder.** `selectPlanet(id)` ve
   `onFocusPlanet(id)` aynı kullanıcı hareketidir. `StatusBar` içindeki yorum
   ayrılmalarının kamerayı ikiye böldüğünü kaydediyor — Home bu dünyaya giderken
   odak hâlâ eskisini gösteriyordu.
3. **Doğrudan transfer.** Panelden kaynak + hedef seçilir, aktif dünya
   değişmeden `TransferSheet` açılır. Mevcut yol (aktif yap → diske dokun) aynen
   kalır; D118 bozulmaz.
4. **`TransferSheet` düzeltmeleri.**
   - Şilep ve Runner satırları **0 adetteyken de görünür**: kapalı, yanında sebep
     ("maden taşımak için gerekli, elinde yok").
   - Kargo bölümünün başında kalıcı bir gereklilik satırı.
   - `0 / 0` yerine açıklayıcı metin.
   - Kapasite sayacı halihazırda doğru; yalnızca **niçin sıfır** olduğu yazılacak.
5. **Header'daki `<select>` şimdilik kalır.** Yeni panel yeterince kullanışlı,
   anlaşılır ve stabil olduğu kanıtlanınca sahibi kaldırılmasını isteyecek.

**⚠ Neyi bozabilir.**

| Risk | Açıklama | Önlem |
|---|---|---|
| Kamera ikiye bölünür | Odak ve aktif dünya ayrı hareket ederse | İkisi tek çağrıda |
| D118 kırılır | "Her dünyayı açmadan önce odakla" kuralı | Eski yol aynen korunur, yeni yol ek |
| İki seçici drift eder | Header `<select>` + panel | Geçici, kabul edilmiş; ikisi aynı `useWorld` state'ini okur |
| Yeniden çizim maliyeti | `GalaxyView` saat üzerinden yeniden render oluyor; disk bileşenlerine taze dizi geçmek GPU buffer'ı baştan kurar | Panel disk bileşenlerinin dışında; props stabil kalsın |
| Gizli kazıcı transferi | Panel kazıcı taşımayı kolaylaştırır | T1 kotayı kapatıyor; T3, T1'den sonra inmeli |
| Metin bileşende kalır | | Tüm metin `locales/` altında, tr doğal yazılır |

**Test / kabul.**

- Şilebi olmayan bir oyuncu transfer ekranını açtığında neden maden
  yollayamadığını **okuyabiliyor.**
- Panelden yapılan transfer, aktif dünyayı değiştirmiyor.
- Panelden bir dünyaya dokunmak hem kamerayı hem aktif dünyayı taşıyor.
- Eski akış (aktif yap → diske dokun) çalışmaya devam ediyor.
- `node tools/visual.mjs` ile görsel doğrulama yapıldı.

---

### T4 · Hangar ve gemi alanı

**Amaç.** Sınırsız gemi basılamasın. Her geminin bir **alanı** olsun, Hangar alan
sağlasın, Hangar seviyesi alanı büyütsün.

**Bağımlılık.** Yok, ama T1'den sonra inmesi mantıklı (aynı sayım mantığı).

**Kritik tasarım kararı — tek sayı, iki iş.** Gemi alanı (`bulk`) aynı zamanda
T6'daki **yakıt kütlesidir.** İki ayrı sayı ilk düzenlemede birbirinden kayar.

**Dokunulan dosyalar.**

`packages/rules`:
- `types.ts` — `BuildingId`, `BUILDING_IDS`, `Hull` arayüzüne `bulk`
- `hulls.ts` — her hull'a `bulk` değeri
- `constants.ts` — `HANGAR` bloğu, `START_BUILDINGS`, `MULTI_WORLD.neutral[1..3].buildings`
- `economy.ts` — `hangarCapacity(level)`, `fleetBulk(fleet)`, `upgradeCost` etkileşimi
- `index.ts` — export

`apps/server`:
- `services/build.ts` — YARD siparişi kontrolü
- `services/movement.ts` — `launchTransfer`, `resolveTransfer`
- `services/clanAid.ts` — `payloadCanLand` genişletmesi
- `services/planetView.ts` — kapasite/kullanım payload'a
- `services/strategic.ts` — `CORE_BOUND_BUILDINGS` gözden geçir
- `cli/capacity.ts`, `routes/onboarding.ts` — hull listeleri

`apps/web`:
- `screens/PlanetScreen.tsx` — Hangar satırı + kapasite göstergesi + sipariş kısıtı
- `screens/TransferSheet.tsx`, `LaunchSheet.tsx` — kapasite bilgisi
- `ui/assets.ts` — Hangar görseli
- `i18n/locales/{en,tr}/{planet,data,errors}.ts`
- `onboarding/world.ts`, `rehearsalFetch.ts`

`packages/sim`:
- `archetypes.ts`, `season.ts` — bina listesi ve gemi üretim kararı

**Nasıl.**

1. **Bina.**
   ```
   BuildingId = CORE | REFINERY | EXTRACTOR | VAULT | SHIPYARD | HANGAR
   START_BUILDINGS.HANGAR = 0
   ```
   `buildingLevelsFrom` eksik satırı zaten 0 sayıyor (`planet.ts:103`) →
   **veri taşıma gerekmiyor.** Mevcut gezegenler otomatik olarak seviye 0 okur.
2. **Kapasite tabanı sıfır olamaz.**
   ```
   hangarCapacity(level) = HANGAR.base + level * HANGAR.perLevel
   ```
   `HANGAR.base > 0` olmak zorunda — taze bir dünya `HANGAR: 0` ile başlıyor ve
   gemi tutabilmeli. Aksi halde `PLANET_START` bozulmadan oyun açılışta kilitlenir.
3. **Kullanım.**
   ```
   used(planet) = Σ( totalUnitsOf(planetId)[h] × HULLS[h].bulk )   // ground HARİÇ
   ```
   - **Evdeki + havadaki her şey sayılır.** `PROSPECTOR.max` docblock'unun
     gerekçesi burada da geçerli: havadakini saymayan kota, kota değildir.
   - **Yer savunması sayılmaz.** Bastion ve Thorn emplasman; zaten %60 salvage ve
     1.6× bütçe gücüyle ayrı fiyatlanmışlar. Kapasiteye sokmak savunmayı nerf'ler
     ve `docs/balance.md` savunmanın kırılgan olduğunu kaydediyor.
   - **Kazıcı sayılır**, ama `PROSPECTOR.max` ayrıca durur. Biri "ne kadar",
     diğeri "kaç tane" sorusu.
4. **Dört kontrol noktası.**

   | # | An | Nerede | Ne yapar |
   |---|---|---|---|
   | a | Gemi siparişi | `build.ts`, `PROSPECTOR` kontrolünün yanında | Projeksiyonlu kullanım + sipariş ≤ kapasite; aşarsa `HANGAR_FULL` |
   | b | Transfer kalkışı | `movement.ts::launchTransfer` | **Hedefin** kapasitesi; aşarsa reddet — oyuncu gemilerini boşuna yollamasın |
   | c | Transfer varışı | `movement.ts::resolveTransfer` | Tekrar kontrol; aşarsa `rerouteToSafeHome` |
   | d | Klan yardımı | `clanAid.ts::payloadCanLand` + `resolveClanAid` | Aynı ikili kontrol |

   **(c) neden ayrı:** transfer dakikalar sürüyor. Sen yolladıktan sonra hedef
   kendi gemilerini üretip dolabilir. Sadece kalkışta bakarsan gemiler dolu bir
   gezegene iner.
5. **Taşma yasaldır.** Aşağıdaki üç durumda oyun gezegeni kendi limitinin üstüne
   çıkarır ve oyuncu hiçbir hata yapmamıştır:
   - savaştan sağ dönen gemiler eve iner
   - ele geçirilen dünyanın gemileri sahibine geçer (`transferPlanetControl`)
   - gideceği yer kaybolan filo başka dünyaya yönlendirilir (`rerouteToSafeHome`,
     `abandon`, `sweepStranded`)

   **Bir kuralın yan etkisi olarak gemi silinmez.** Kural: *limit aşılabilir,
   aşılmışken yeni giriş durur.* Aşılmışken yeni gemi üretilemez ve transfer
   alınamaz; gemiler öldükçe / gönderildikçe / Hangar büyüdükçe normale döner.
   Arayüz durumu açıkça söyler.

**⚠ Neyi bozabilir.**

| Risk | Açıklama | Önlem |
|---|---|---|
| **`PLANET_START` / `untouched()`** | `untouched()` yeni dünyayı `PLANET_START` ile karşılaştırıyor; rehearsal replay buna bağlı | `HANGAR: 0` ekle, `PLANET_START` kaynak değerlerine **dokunma** |
| **Neutral şablonları** | `MULTI_WORLD.neutral[1..3].buildings` `Record<BuildingId, number>` — tip hatası verir | Üç şablona da `HANGAR: 0` (veya tier'a uygun değer) |
| **Sim archetype'ları** | Bina listesi sabit | `packages/sim` güncellenmezse ARR anlamsızlaşır |
| **Ölüm Yıldızı hasarı** | `CORE_BOUND_BUILDINGS` Core düştüğünde tavana çarpan binaları kırpıyor | Hangar Core'a bağlı mı? **Evet** — diğerleriyle tutarlı olsun, listeye ekle |
| **Probe silhouette** | `coreLevel` taşıyor, bina listesi taşımıyor | Değişiklik gerekmiyor; ama D127 gereği Hangar seviyesi **public olmamalı** |
| **Sipariş ekranı yalan söyler** | Sunucunun reddedeceği bir gemiyi teklif eden kontrol | `planetView` kapasite + kullanım döner, ekran kısıtı önceden gösterir (kazıcıda zaten var olan kalıp) |
| **Yarış koşulu** | İki sipariş aynı anda son yeri görür | Sayım gezegen satır kilidi altında, `assertFreeBay` ile aynı şekil |
| **Rehearsal** | Onboarding gemi üretiyor | `rehearsalFetch.ts` aynı kapasiteyi hesaplamalı |
| **`upgradeCost(L).alloy < storageCap(L, vault)`** | Invariant | Hangar fiyatı bu bandı kırmamalı |
| **Hangar bağımsız fiyatlandırılamaz** | `upgradeCost(level)` tüm binalar için tek eğri — §3.4 | Yol A: fiyatı değil, seviye başına verdiği kapasiteyi ayarla |
| **`SHIPS` ödül zinciri** | Zincir `planets.builtEver` okuyor (kümülatif), anlık filo değil | Kapak zinciri **bloklamaz**, yalnızca yavaşlatır — doğrula |
| Kazıcı hangar alanı yiyor | İki kazıcı, savaş gemisi tutabilecek yeri kaplar | **Kasıtlı.** Madencilik artık filo büyüklüğüne karşı bir tercih — docblock'a yaz |
| `investedInBuilding` otomatik çalışıyor | `score.ts:16` tüm bina seviyelerini tek eğriyle topluyor | Yeni bina Wealth'e kendiliğinden giriyor — doğrula, dokunma |

#### T4b · Yer savunması emplasman kapağı — **aynı görevin parçası**

**Bu ertelenemez, çünkü sorunu T4'ün kendisi yaratıyor.**

T4'ten **önce** bir oyuncunun fazlası iki yere gidebiliyordu: gemi veya taret.
T4'ten **sonra** gemi tavanlı, taret tavansız — yani hangar tavanına dayanmış bir
oyuncunun fazlasını koyacak **tek yeri taret kalıyor.** Bu mevcut bir durum
değil; T4'ün ürettiği yeni bir kaplumbağa eğimi. Kapağı aynı sürümde koymazsak
ilk oynanan sezonda kaplumbağa dominant strateji olur.

İkinci gerekçe D27'nin kendisi: iki karşıt yer sınıfı, *"ne kadar savunma"*
sorusunu *"ne TÜR savunma"* sorusuna çevirmek için var — ve "ne tür", yalnızca
bilgi katmanının cevaplayabildiği soru. Tavansız "ne kadar" bunu çürütür:
yeterince taret alırsan iki sınıftan da alırsın ve seçmek zorunda kalmazsın.
**Toplamı sınırlamak oyunun merkezi iddiasını güçlendirir.**

**İki ayrı kapak, iki ayrı kaynaktan — kasıtlı.**

```
hangarCapacity(hangarLevel)  →  filo kapasitesi    (yatırım yaptığın şey)
groundSlots(coreLevel)       →  emplasman kapasitesi (dünyayı geliştirmenin sonucu)
```

İkisi ayrı havuzdur. Filoya yatırım savunmandan çalmaz, savunmaya yatırım
filondan çalmaz — ikisi ayrı karar olarak kalır. Aynı havuza koymak, savunma ile
saldırıyı tek bir sürgüye bağlar ve oyunun istediği iki ayrı sorunun ikisini de
tek soruya indirir.

**Core neden doğru kaynak.** Zaten "bu dünya ne kadar büyük" demek: uçuş
yuvalarını açıyor (`flightSlots = 3 + floor(core/3)`), uydu yuvalarını açıyor,
koloni kapasitesini veriyor. Bir türetilmiş kapasite daha tutarlı ve **yeni bina
gerektirmiyor.**

**Ayar.** Cömert. Normal gelişmiş bir dünyada bağlamaz; yalnızca normal
savunmanın ~3 katını istifleyen kaplumbağada bağlar. Sayı sim ile bulunur.

**Uygulama.** `packages/rules`'da tek fonksiyon; `build.ts`'te hangar
kontrolünün yanında bir dal — `spec.ground` ayrımı zaten `:260` satırında var;
`planetView`'da kapasite + kullanım; `PlanetScreen`'de savunma sekmesinde
gösterim; `GROUND_SLOTS_FULL` ret kodu (en + tr). Ölçü birimi `bulk`, gemilerle
aynı — üçüncü bir birim icat edilmez.

**Taşma kuralı aynı.** Hiçbir taret silinmez. Tavanın üstündeyken yenisi
üretilemez; taretler öldükçe (ve %60 salvage ile geri geldikçe) veya Core
büyüdükçe normale döner.

| ⚠ Risk | Açıklama | Önlem |
|---|---|---|
| **Savunma ikinci kez nerf'lenir** | `docs/balance.md` savunmayı kırılgan kaydediyor; %60 salvage tam bu yüzden verilmiş | Cömert ayar; ARR **yukarı** kaymamalı — sim ile ölç |
| **Neutral şablonları kapağı aşabilir** | `MULTI_WORLD.neutral[3].ground = { THORN: 6, BASTION: 2 }`, Core 8 | Üç tier de kendi Core'unun kapağı altında kalmalı — **test yaz** |
| Mevcut oyuncular tavan üstünde | Canlı sezonda | Taşma yasal; hiçbir şey silinmez |
| Rehearsal | Onboarding taret üretiyor | Aynı kapasiteyi hesaplasın |

**Test / kabul.**

- Sınırsız gemi basılamıyor.
- Hiçbir yoldan gemi silinmiyor — savaş dönüşü, ele geçirme, yönlendirme dahil.
- Aşım durumundaki gezegen üretemiyor ve transfer alamıyor; aşım geçince
  normale dönüyor.
- Sipariş ekranı reddedilecek bir seçeneği aktif göstermiyor.
- `pnpm sim` ile bantlar yeşil.

---

### T5 · Döteryum Rafinerisi

**Amaç.** Döteryumun pasif üretimi olsun; üretim tavanı bir araştırmaya bağlı
olsun ve araştırma seviyesi ilerledikçe tavan yükselsin.

**Bağımlılık.** **T7 (araştırma altyapısı) önce inmeli.**

**Ladder.**

```
Araştırma seviye 1  →  Rafineri en fazla seviye 3
Araştırma seviye 2  →  Rafineri en fazla seviye 6
Araştırma seviye 3  →  Rafineri en fazla seviye 9
...
Araştırma seviye 1 ucuz; sonraki seviyeler hızla pahalılaşır.
```

Bu, oyunda **zaten var olan** bir mekaniğin ikinci kez söylenmesidir: hiçbir bina
Command Core'u geçemez. Oyuncuya yeni kavram öğretmiyor, öğrenme maliyeti sıfır.

**Dokunulan dosyalar.**

- `packages/rules/src/types.ts` — `BuildingId` (yedinci bina)
- `packages/rules/src/constants.ts` — `DEUTERIUM` bloğu genişler, `START_BUILDINGS`,
  `PLANET_START`, neutral şablonları
- `packages/rules/src/economy.ts` — `deuteriumRate(level)`,
  `deuteriumStorageCap`, `deuteriumCollectorCap`, `advanceEconomy`, `collect`,
  `vaultProtects`
- `apps/server/src/services/planet.ts` — `loadLocked` ekonomi girdisi
- `apps/server/src/services/planetView.ts` — `deuteriumPerHour`
- `apps/web/src/shell/StatusBar.tsx` — `rate={0}` sabiti kalkar
- `packages/sim/src/season.ts` — döteryum arzı
- `docs/game-design.md:103`, `docs/balance.md`, `docs/decisions.md`

**Nasıl.**

1. **Yedinci bina** (`REFINERY` alloy rafinerisi; bu ayrı bir bina — isimlendirmeyi
   karıştırma). Öneri: `DEUTERIUM_PLANT` veya `CONTAINMENT`. T4'teki Hangar ile
   aynı ekleme prosedürü.
2. **Üretim.** `advanceEconomy` şu an `bufferDeuterium: state.bufferDeuterium`
   diyor — hiç büyümüyor. `PlanetEconomyInput`'a `deuteriumPlantLevel` eklenir ve
   `bufferDeuterium` alloy/crystal ile aynı şekilde `collectorCap` altında büyür.
3. **Depolama.** `deuteriumStorageCap` ve `deuteriumCollectorCap` şu an
   *Extractor* oranından türüyor. Kendi üretim oranından türeyecek şekilde
   değiştirilir. Mevcut kural — *"Vault floors use hours of each resource's own
   production"* — döteryum üretim kazandığı an bunu kendiliğinden kapsar.
4. **Vault koruması.** Döteryuma **az miktarda** koruma eklenir. Şu an sıfır;
   değerli bir kaynak için mantıksız ve yeni oyuncuyu ilk baskında yakıtsız
   bırakır (T6 ile birlikte oyunu durdurur).
5. **Başlangıç deposu.** `PLANET_START.deuterium` sıfırdan çıkar; ~8-10 kalkışlık
   bir depo verilir. Oyuncu zinciri ilk oturumda öğrenir:
   *yakıtım var → azalıyor → rafineri lazım → rafineri araştırma istiyor.*
6. **Araştırma seviye 1 sıfır döteryum ister.** Mevcut projelerin bazıları
   döteryumla ödeniyor; rafineri araştırması da isterse **kilitlenme** olur.

**⚠ Neyi bozabilir.**

| Risk | Açıklama | Önlem |
|---|---|---|
| **İzotop asteroitleri ölür** | Döteryumun tek kaynağı onlar ve sezonun ikinci perdesinin tamamı (D93) bunun üzerine kurulu | **Kabul kriteri:** rafineri = uçmaya yeter, garantili, yavaş. Asteroit = Runner/Breacher/araştırma/Ölüm Yıldızı finansmanı, hızlı, çekişmeli. Rafineri asteroit gelirine yaklaşırsa perde ölü içerik olur |
| **Kilitlenme** | Rafineri araştırması döteryum isterse | Seviye 1 sıfır döteryum |
| **Açılış ölür** | T6 ile birlikte: araştırma yoksa rafineri yok, rafineri yoksa yakıt yok, yakıt yoksa kalkış yok | Başlangıç deposu |
| `PLANET_START` değişti | `untouched()` ve rehearsal replay buna bağlı | Dört tüketici de (server · claim guard · sim · rehearsal) aynı sabiti okur — hepsini doğrula |
| Ölüm Yıldızı yarılaması | Döteryumu zaten yarıya indiriyor | Değişiklik gerekmiyor, sadece doğrula |
| `deuteriumStorageCap` imza değişikliği | Çağıranlar var | Tümünü tara |
| Sim döteryum modellemiyor | ARR ve bantlar yanılır | `packages/sim` güncellenmeden T6 inmez |
| `StatusBar` `rate={0}` | Sabit sıfır | Gerçek oranı geçir |
| **`vaultProtects` imzası** | Döteryum tabanı dördüncü parametre → **14 çağrı yeri**, üçü istemcinin tavsiye kodu, dördü simulator | §3.4'teki liste; `onboarding/world.ts` en riskli — rehearsal kendi kendisiyle çelişebilir |
| **`deuteriumStorageCap` tabanı** | Extractor oranından kendi oranına geçiş mevcut her oyuncunun tavanını değiştirir | Migration yok ama **denge kayması** — sim ile ölç |
| **İsim çakışması** | `REFINERY` zaten alloy rafinerisi | Yeni bina `DEUTERIUM_PLANT` / `CONTAINMENT`; i18n'de iki "rafineri" olmasın |
| `collect()` zaten hazır | `roomD` / `takeD` yolları mevcut; eksik olan yalnızca üretimdi | Beklenenden az iş — doğrula, yeniden yazma |

**Test / kabul.**

- Rafineri araştırma tavanının üstüne çıkarılamıyor.
- Araştırma seviye 1 sıfır döteryumla alınabiliyor.
- Yeni dünya elle tutulur bir depoyla açılıyor; rehearsal aynı sayıyı gösteriyor.
- Vault küçük bir döteryum koruması sağlıyor.
- `pnpm balance:economy` ve `pnpm balance:goal` yeşil.
- Sim: asteroit döteryum geliri rafineri gelirinden **belirgin şekilde** yüksek.

---

### T6 · Filo yakıtı

**Amaç.** Her kalkış yakıt tüketsin. Yakıtı yetmeyen kalkamasın.

**Bağımlılık.** **T4** (gemi alanı) ve **T5** (döteryum arzı). İkisi de inmeden
başlamaz.

**Kural — sahibinin talimatı.** Tek yön ya da gidiş-dönüş fark etmez:
**tam yakıt zorunlu.** Tek yönlük bütçeyle kalkış yok, filo mahsur kalmaz.

**Formül.**

```
fuel = ceil( Σ(adet × HULLS[h].bulk) × distance / FUEL.scale ) × bacak
```

Hıza bağlı **değil.** Bulwark zaten yavaşlığıyla ödüyor; hızı da fiyatlamak çift
vergi olur. Mesafe ekonomik bir maliyet haline gelir — D125/D126 mesafeyi bir
*bilgi* maliyeti yapmıştı, yakıt onu bir *ekonomi* maliyeti yapar. Tutarlı.

**Kim öder.**

| Yol | Yakıt | Gerekçe |
|---|---|---|
| `launchAttack` | Gidiş + dönüş, kalkışta tahsil | Havadaki filonun depoya erişimi yok |
| `launchTransfer` | Tek bacak | |
| `launchSettlement` | Tek bacak | |
| `launchClanAid` | Tek bacak | |
| `launchDeathStar` | Tek bacak | Zaten 33.000; sembolik |
| **Keşif uçuşu (probe)** | **Yok** | Ölçülen gate metriği "saldırıların ≥%50'si probe/telescope sonrası". D121 probe'u zaten rasyonladı; ikinci kez rasyonlamak ölçtüğün şeyi bozar |
| **Madencilik koşusu** | **Yok** | Döteryum madenden geliyorsa kilitlenir |

**Dokunulan dosyalar.**

- `packages/rules/src/` — yeni `fuel.ts`, `constants.ts` içinde `FUEL` bloğu,
  `index.ts` export
- `apps/server/src/services/mission.ts` — `launchAttack`
- `apps/server/src/services/movement.ts` — `launchTransfer`, `launchSettlement`
- `apps/server/src/services/clanAid.ts` — `launchClanAid`, `quoteClanAid`
- `apps/server/src/services/strategic.ts` — `launchDeathStar`
- `apps/server/src/services/planetView.ts` — yakıt stoğu görünürlüğü
- `apps/web/src/screens/{LaunchSheet,TransferSheet}.tsx`
- `apps/web/src/i18n/locales/{en,tr}/errors.ts`
- `apps/web/src/onboarding/rehearsalFetch.ts`
- `packages/sim/src/season.ts`
- `apps/server/test/contract.test.ts`

**Nasıl.**

1. `packages/rules/src/fuel.ts` — tek saf fonksiyon:
   ```ts
   export function missionFuel(fleet: Fleet, distance: number, legs: 1 | 2): number
   ```
   Sunucu, istemci ve simulator **aynı** fonksiyonu okur.
2. Her kalkış yolunda, mevcut kaynak kontrolünün yanına yakıt kontrolü; borç
   `saveResources` ile aynı işlem içinde düşülür. Gezegen satır kilidi altında.
3. **Kalkış ekranı maliyeti commit'ten önce gösterir.** Ret kodu sayılarla döner:
   `INSUFFICIENT_FUEL { needed, have }`. Metin en+tr yerelde.
4. `packages/sim` yakıtı modeller.

**⚠ Neyi bozabilir.**

| Risk | Açıklama | Önlem |
|---|---|---|
| **Gate metriği düşer** | "Oturumların ≥%80'i havada bir şeyle bitsin". Yakıtı olmadığı için kalkamayan oyuncu bu metriği doğrudan düşürür | Fiyat, ortalama bir akının kârının **%5-8'ini geçmemeli** |
| **ARR bandı kırılır** | Yakıt her akına doğrudan vergi; taban 1.30 | Band **genişletilmez.** Ganimet ve `defenceSalvage` inert kaldıraçlar — kırılırsa **yakıt fiyatı** düşer |
| Probe rasyonu ikiye katlanır | | Probe yakıt ödemez |
| Madencilik kilitlenir | | Madencilik yakıt ödemez |
| Rehearsal patlar | 90 saniyelik onboarding kalkış yapıyor | `rehearsalFetch.ts` aynı hesabı yapar; başlangıç deposu yeter |
| Klan yardımı teklifi yalan söyler | `quoteClanAid` yakıtı bilmezse "gönderilebilir" der, kalkış reddeder | Teklife yakıt satırı ekle |
| Tahmin kesin değil | D53: yalnızca kesin sonuçlar tahmin edilir | Yakıt deterministik; kalkıştan önce tüm guard'lar tekrar kontrol edilir |
| Sim modellemiyor | Ölçüm anlamını yitirir | T6 sim güncellenmeden inmez |
| **Yönlendirilen bacak fazladan uçar** | `rerouteToSafeHome` ödenenden uzun bir bacak kurabilir; `resolveClanAid` gönderene döner; kalkış dünyası ele geçirilirse `safeHomePlanet` daha uzak bir başkente yönlendirir | **Fazladan yakıt alınmaz.** Bunlar sistem hatası yollarıdır, oyuncunun kararı değil. Kuralı docblock'a yaz, yoksa biri sonradan "düzeltir" |
| **`abandon()` yakıt iade etmez** | Terk edilen görev birimleri geri veriyor | İade yok; kural yazılı olsun |
| Ganimet kargosu ile yakıt kütlesi karışır | `fleetCargo`, `transferCargoCapacity` ve yakıt kütlesi üç ayrı sayı | Üçü ayrı kalır; hiçbiri diğerinden türetilmez |

**Yakıt kuralı, tek cümle:** *yakıt kalkışta ve yalnızca kalkışta ödenir; hiçbir
sistem yolu ek yakıt istemez ve hiçbir iptal yakıt iade etmez.*

**T6 denetimi — sonradan kapatılan üç açık.** Yakıt indikten sonra yapılan tam
inceleme, "kalkış ekranı maliyeti commit'ten önce gösterir" kabul maddesinin iki
yolda tutulmadığını buldu. Üçü de kapatıldı:

1. **Yerleşim paneli yakıttan hiç söz etmiyordu.** Sunucu `INSUFFICIENT_FUEL` ile
   reddediyor, panel ise koloni yuvasını, rampayı, iki Nakliyeci'yi, Alaşım'ı,
   Kristal'i ve varış süresini sayıp döteryumu atlıyordu. Artık gereksinim rozeti
   ve `settleNeedFuel` engeli var — mesafeye göre değişen tek gereksinim odur.
2. **Klan yardımı formu `quote.fuel`/`hasFuel` alanlarını hiç okumuyordu.** Teklif
   "gönderilebilir" diyor, kalkış reddediyordu — planın adıyla uyardığı hata.
   Artık transfer sayfasıyla aynı `SpendBar` konvoy paketlenirken canlı çiziliyor
   ve gönderim düğmesi ona bakıyor.
3. **"Tam yakıt ya da kalkış yok" kuralı dört kez yazılmıştı** ve biri yanlıştı
   (`launchTransfer`, kargo + yakıt toplamına bakmıyordu — negatif depo). Tek
   `assertFuel` koruması kaldı; yerleşimin taşıdığı `cost.deuterium` de artık
   toplama giriyor.

Ayrıca **gemi kartında beşinci istatistik**: `hullFuelRate` — bir geminin
`FUEL.reference` (1.000 birim) başına yaktığı döteryum. Kartın sorusu "hangi
gövde" olduğu için oran; ücret değil. Yer savunması sıfır okur, çünkü uçmaz.

**Test / kabul.**

- Yakıtı yetmeyen kalkamıyor; ret sayılarla dönüyor ve iki dilde okunuyor.
- Probe ve madencilik yakıt ödemiyor.
- Saldırı gidiş-dönüş yakıtını kalkışta ödüyor.
- Kalkış ekranı maliyeti commit'ten önce gösteriyor — **dört yolda da**:
  baskın, transfer, yerleşim, klan yardımı.
- Sim: ARR ≥ 1.30, oturum-sonu-havada metriği düşmüyor.
- Rehearsal sonuna kadar oynanabiliyor.

---

### T7 · Araştırma altyapısı — hesap geneli

**Amaç.** Araştırma gezegen başına değil **hesap geneli** olsun; aynı anda tek
araştırma çalışsın; seviyeli projeler desteklensin.

**Bağımlılık.** Yok, ama T5, T8, T9, T10, T11, T12'nin tamamı buna bağlı.

**Neden.** Mevcut `planet_research` gezegen anahtarlı. Seviyesiz *izinler* için
tolere edilebilir; seviyeli *çarpanlar* için felaket — 3 kolonili bir komutan
aynı araştırmayı 4 kez satın alır ve bu doğrudan bir regresyon sinyalidir
("micromanagement grows").

**Dokunulan dosyalar.**

- `apps/server/src/db/schema.ts` — yeni `player_research` tablosu
- Yeni migration + `apps/server/drizzle/meta/_journal.json`
- `apps/server/src/services/researchState.ts` — tamamen yeniden yazılır
- `apps/server/src/services/research.ts` — `completeResearch`
- `apps/server/src/services/buildQueue.ts` — `RESEARCH` sipariş türü, projeksiyon
- `apps/server/src/services/build.ts` — hull kapıları (`RUNNER`, `BREACHER`)
- `apps/server/src/services/strategic.ts` — `hasResearch`
- `apps/server/src/services/clanAid.ts` — `payloadCanLand`
- `apps/server/src/services/intel.ts` — `ISOTOPE_SPECTROMETRY` okuması
- `packages/rules/src/research.ts` — seviyeli proje modeli
- `packages/rules/src/types.ts` — `ResearchProjectId`, `ResearchLevels`
- `apps/server/src/services/reclaim.ts`, `season.ts` — sezon temizliği
- `apps/web/src/api/schemas.ts`

**Nasıl.**

1. **Şema.**
   ```
   player_research (player_id, project_id, level, completed_at)
   PRIMARY KEY (player_id, project_id)
   ```
   Mevcut `planet_research` satırları migration ile taşınır: bir oyuncunun
   herhangi bir dünyasında tamamlanmış proje, oyuncuya seviye 1 olarak yazılır.
   **Eski tablo bir sürüm boyunca bırakılır**, okunmaz.
2. **Tek slot, ayrı sıra.** Aynı anda tek araştırma çalışır; toplam üç proje
   komutanın hesap-geneli RESEARCH sırasında bekleyebilir. Maliyet seçilen
   gezegenden sipariş anında alınır. Başlayan araştırma oyuncu tarafından iptal
   edilemez; yalnızca sistem hatası kaynakları tam iade eder. İnşaat ve Tersane
   sıraları bundan tamamen ayrıdır.
3. **Seviyeli model.**
   ```ts
   interface ResearchProject {
     id: ResearchProjectId;
     maxLevel: number;              // 1 = eski izin projeleri
     costAt(level: number): Resources;
     prerequisite: ResearchProjectId | null;
     availableAtMinutes: number;
     requiredCore?: number;
   }
   ```
   `maxLevel: 1` olan projeler bugünkü davranışı aynen sürdürür.
4. **Etkiler tek yerde.** Her etki `packages/rules` içinde **tek bir export
   edilmiş saf fonksiyon**tur ve her tüketici onu okur. Bu pazarlık konusu değil —
   kod tabanının kendi uyarısı: bir etkinin bir yerde onurlandırılıp başka yerde
   unutulması satellite etkilerinde yaşandı.
5. **Keşif (discovery) mantığı korunur.** `ISOTOPE_SPECTROMETRY` sezon saatiyle,
   `DENSE_FUEL_CELLS` gerçek kargo-sınırlı bir baskınla, `GRAVITIC_CHARGES` kalkan
   emen bir raporla açılıyor. Bu, araştırmayı PvP'ye bağlayan mekanizma —
   **kaldırma**, oyuncu seviyesine taşı.

**⚠ Neyi bozabilir.**

| Risk | Açıklama | Önlem |
|---|---|---|
| **Migration veri kaybı** | Gezegen → oyuncu taşıması | Eski tabloyu silme; tek yönlü kopyala, doğrula |
| **`assertSchemaCurrent`** | Kod şemadan ileriyse sunucu açılmayı reddeder | Migration **yeni imajdan önce** çalışır |
| Enum/kısıt | `build_orders_kind_check` `RESEARCH` içeriyor | Değişiklik gerekmiyor |
| Keşif kaybolur | Kargo/kalkan sezgileri savaş geçmişinden türüyor | Sorgular `attackerPlayerId` üzerinden — zaten oyuncu bazlı, uyumlu |
| Kuyruk projeksiyonu | `buildQueueContext` `research` setini gezegenden okuyor | Oyuncu seviyesine çevir; `queueAvailable` mantığı korunur |
| Sezon temizliği | `reclaim.ts` ve sezon wipe'ı `planet_research` siliyor | Yeni tabloyu da sil; `account` kapsamı hariç |
| Rehearsal | Sahte API araştırma ucunu taklit ediyor mu | Doğrula, gerekiyorsa güncelle |
| Contract test | `/api/planet` payload'ında `research` şekli değişir | `contract.test.ts` + `schemas.ts` birlikte |
| **`reclaim.ts` `players` satırını siliyor** | `reclaim.ts:360` `delete(players)`. `player_research` yabancı anahtarla bağlıysa **önce** silinmeli, yoksa FK ihlali → koltuk geri alınamaz | `planetResearch` silinen satırın (`:357`) hemen yanına ekle |
| **Sezon wipe** | `servers.ts:554` `tx.delete(planetResearch)` yapıyor | Yeni tabloyu aynı yere ekle |
| **Kuyruk projeksiyonu `Set`** | `ProjectedBuildState.research` bir `Set<ResearchProjectId>`; seviyeli araştırma **seviye haritası** olmak zorunda | `projectOrder` seviyeyi ekler; `queueAvailable` "bir sonraki seviye" sorusunu sorar |
| **`build_orders.count`** | `count > 0` kısıtı var; araştırma siparişi hedef seviyeyi taşıyabilir | Ya `count` = hedef seviye, ya `subject` = `"ID:level"`. **Birini seç ve docblock'a yaz** |
| Rehearsal | Sahte API araştırma ucunu taklit ediyor mu | Doğrula, gerekiyorsa güncelle |

**Karar gerekiyor — araştırma Wealth'e girsin mi?** `score.ts` şu an bina,
enstrüman, uydu, filo, yer savunması ve kaynakları sayıyor; araştırmayı
saymıyor. Seviyeli araştırma büyük bir kaynak kuyusu haline geldiğinde,
araştırmaya yatırım yapan bir komutanın Wealth'i gerçekte harcadığından düşük
görünür — enstrümanlarda tam olarak bu hata yaşandı ve `investedInInstrument`
onun için yazıldı (docblock'u anlatıyor). İki seçenek:

- **Gir** — `Holdings`'e araştırma eklenir, `investedInResearch` yazılır. Wealth
  dürüst kalır. `Holdings` tüketicilerinin hepsi taranır.
- **Girme** — bilinçli karar olarak kaydedilir: araştırma kalıcı güçtür, Wealth
  ise yağmalanabilir/yok edilebilir değerdir; ikisi aynı şey değildir.

Sessiz bırakılamaz.

**Test / kabul.**

- Bir dünyada tamamlanan araştırma tüm dünyalarda geçerli.
- İkinci bir araştırma paralel başlatılamıyor.
- Migration sonrası mevcut oyuncuların projeleri kaybolmamış.
- Oyuncu araştırmayı iptal edemiyor; sistem hatası tam iade yapıyor.
- Keşif mekanizmaları çalışıyor.

---

### T8 · Ekonomi ve lojistik araştırmaları

**Amaç.** Üç ekonomi + bir lojistik projesi.

**Bağımlılık.** T7. (Rafineri projesi T5 ile birlikte.)

**Projeler.**

| Proje | Etki | Okunduğu yer |
|---|---|---|
| Döteryum Rafinerisi | Rafineri seviye tavanı | T5 |
| Gemi üretim hızı | YARD sipariş süresi | `shipMinutes` |
| Kazıcı kapasitesi | Kazıcı hold | `prospectorHold` |
| Gemi depo kapasitesi | Gemi kargo | `fleetCargo` |

**Nasıl.**

- Her etki `packages/rules` içinde tek fonksiyon; mevcut fonksiyonlar seviye
  parametresi alacak şekilde genişletilir (`shipMinutes`, `prospectorHold`,
  `fleetCargo`).
- Maliyetler, araştırmanın artık **bir kez** ödendiği ve oyuncunun 1-3 dünyası
  olduğu varsayımıyla kalibre edilir.

**⚠ Neyi bozabilir.**

| Risk | Açıklama | Önlem |
|---|---|---|
| **Kargo araştırması ganimeti şişirir** | `fleetCargo` ganimet tavanını belirliyor | ARR bandını sim ile ölç; kargo doğrudan akın kârı |
| **`DENSE_FUEL_CELLS` keşfi bozulur** | Keşif "kargo-sınırlı baskın" olayına bakıyor; kargo büyüyünce sınırlanma azalır | Keşif eşiğini gözden geçir |
| Kazıcı kapasitesi Derrick ile çakışır | `drillHoldMult` zaten çarpan uyguluyor | İkisi çarpımsal mı toplamsal mı — açık karar ver ve docblock'a yaz |
| Üretim hızı D128'i bozar | D128 yard süresini 1.50 katsayısıyla kalibre etti | `pnpm balance:goal` altı-yedi günlük bandı korumalı |
| Kargo ≠ transfer kapasitesi | `transferCargoCapacity` yalnızca Hauler/Runner sayıyor | İkisinin ayrı kalması **kasıtlı** — karıştırma |

**Test / kabul.**

- Her etki tek fonksiyondan okunuyor; ikinci bir kopya yok.
- `pnpm balance:goal` bandı koruyor.
- ARR ≥ 1.30.

---

### T9 · Silah araştırmaları

**Amaç.** Beş savaş projesi: dört gemi doktrini + bir genel atak/zırh.

**Bağımlılık.** T7.

**Önerilen gruplama** *(sahibinin "iki ofansif iki defansif" cümlesine göre
kuruldu; eşleştirme değiştirilebilir, detaydır)*:

| Proje | Kapsadığı hull |
|---|---|
| Wasp doktrini | WASP |
| Lance doktrini | LANCE |
| Bulwark doktrini | BULWARK |
| Yer savunması doktrini | BASTION, THORN |
| Genel atak/zırh | Tüm gemiler |

**TEK VE SERT KURAL — ortak tavan.**

```
Bilgi  (counter cycle) : 1.6 / 0.625 = 2.56×   →  %156 avantaj
Tech   (tüm araştırma) :               1.25×   →   %25 avantaj   ← TAVAN
```

Beş silah projesinin **birleşik** etkisi hiçbir hull üzerinde eşit-bütçe gücünü
1.25×'in üstüne çıkaramaz. Atak ve cana **ayrı ayrı** %25 verirsen çarpım 1.5625×
olur ve tam olarak counter cycle'a eşitlenir — o noktada teknoloji bilgiyle aynı
güce çıkar ve `hulls.ts`'in yazdığı merkezi iddia
(*"information beats tech by construction, and that is the claim the whole game
rests on"*) düşer.

Bu tavan bir **test** olarak yazılır, yorum olarak değil.

**Zorunluluk — görünürlük.** Tech seviyeleri `probeReports.silhouette`'e eklenir.
%25'te bu tercih değil: görünmeyen bir çarpan her keşif uçuşunun değerini
sessizce yer ve D124 bunu açıkça yasaklıyor (*"a rule the player cannot SEE is not
a rule"*). D127 ile tutarlı: bakışta donar, hedef büyüdükçe bayatlar — bu bir
bayatlık hatası değil, özelliktir.

**Dokunulan dosyalar.**

- `packages/rules/src/combat.ts` — `resolveCombat` imzası
- `packages/rules/src/hulls.ts` — etkili atk/hp
- `apps/server/src/worker/handlers.ts` — savaş çağrısı
- `apps/server/src/services/neutral.ts`, `clanCombat.ts`
- `apps/server/src/db/schema.ts` — `missions` snapshot alanı, `silhouette` genişletmesi
- `apps/server/src/services/intel.ts` — probe raporu
- `apps/server/src/services/publicGalaxy.ts` — `silhouetteOf`
- `packages/rules/test/combat.test.ts` (357 test)

**Nasıl.**

1. `resolveCombat(attacker, defender, shield, rng, tech?)` — `tech` opsiyonel ve
   varsayılanı nötr olsun ki mevcut testler kırılmadan geçsin, sonra kademeli
   güncellensin.
2. **Saldıranın tech'i kalkışta snapshot'lanır** ve `missions` satırına yazılır.
   Kalkıştan sonra yapılan bir yükseltme uçmakta olan bir saldırının sonucunu
   değiştirmemeli — bu, "Read defender radar level when the warning fires"
   kuralının aynası: savunanın tech'i **savaş anında** okunur, saldıranınki
   **kalkışta** dondurulur.
3. Savunanın yer savunması doktrini savaş anında okunur.

**⚠ Neyi bozabilir.**

| Risk | Açıklama | Önlem |
|---|---|---|
| **Counter cycle ezilir** | Tech bilgiyle eşitlenirse oyunun tezi düşer | Ortak tavan testi |
| **Probe değersizleşir** | Görünmeyen çarpan | Silhouette'e tech eklenir |
| **357 rules testi** | `resolveCombat` imza değişikliği | `tech` opsiyonel + nötr varsayılan |
| Enkaz ve Dominion | `fleetValue` kaynak maliyeti okuyor, atk/hp değil | Etkilenmiyor — doğrula |
| ±%8 varyans | "Randomness must not erase intel value" | Tech varyansı büyütmez |
| `fleetPower` | Advisory; counter matrisini yok sayıyor | Tech'i buraya **koyma**, sonuç derecelendirmesi `fleetValue` ile |
| Yer savunması fiyatı | Bastion/Thorn 1.6× eşit-bütçe gücünde | Doktrin ikisini de yükseltirse savunma ekonomisi kayar; sim ile ölç |
| Simulator | Bot'lar tech araştırmıyor | Sim'e ekle, yoksa ARR yanılır |
| **`missions` migration** | Saldıranın tech'i kalkışta dondurulacak → yeni kolon | Migration; eski satırlar `null` → nötr okunur |
| **`silhouette` genişliyor** | Probe artık daha çok şey satıyor | D127 ile **tutarlı** ve kasıtlı: keşif uçuşunun sattığı şey büyüyor. Kararda gerekçesiyle yaz |
| Eski raporlar | `silhouette` D127 öncesi satırlarda `null` | Yeni alanlar da null-toleranslı olmalı |

**Test / kabul.**

- Hiçbir hull'un birleşik tech çarpanı 1.25×'i geçmiyor (test).
- Probe raporu tech seviyelerini taşıyor ve donmuş kalıyor.
- Kalkıştan sonra yükseltme, uçan saldırının sonucunu değiştirmiyor.
- Sim: bilgili archetype hâlâ kazanıyor (`informedArchetypeWins`).

---

### T10 · Anti-ölüm-yıldızı yer savunması

**Amaç.** Gelen Ölüm Yıldızı, savunanın radar çemberini geçtiği anda imha edilsin.
Sistemin mühimmatı olsun ve kullanıldığında yeniden üretilsin.

**Bağımlılık.** T7 (araştırma kapısı).

**Neden radar çemberi.** Varış anında yapılan bir kontrol **görünmez** bir
kuraldır — yalnızca sonucu görürsün. Radar yarıçapı ise diskte **zaten çizili
duruyor** (D126). Ölüm Yıldızı o çemberi geçerken vurulursa:

- kural gözle görülür olur — D124 tam olarak bunu istiyor
- patlama uzayda, çemberin üstünde, dünyanın yanı başında olur
- radar seviyesi birdenbire çok daha değerli hale gelir
- saldırgan hedefin çemberini görüp riski hesaplayabilir

**Menzil = radarın dar/atıflı çemberi** (`radarRange`, saatli olan) —
`radarContactRange` (geniş, saatsiz) değil. Sistem minimum bir radar seviyesi
ister ve kartında menzilini açıkça yazar, yoksa *"pahalı sistemi kurdum hiç ateş
etmedi"* tuzağı oluşur.

**Dokunulan dosyalar.**

- `apps/server/src/db/schema.ts` — `eventKind`'e `strategic_intercept`,
  `notificationKind`'e yeni değer, savunma varlığı tablosu veya
  `strategicAssets` genişletmesi
- Yeni migration
- `apps/server/src/worker/handlers.ts` — yeni handler
- `apps/server/src/services/strategic.ts` — `launchDeathStar` (olayı kur)
- `apps/server/src/services/intel.ts` — probe raporuna sistemin varlığı
- `packages/rules/src/constants.ts` — `ANTI_STRATEGIC` bloğu
- `apps/web/src/galaxy/DeathStarImpact.tsx` veya yeni `Interception.tsx`
- `apps/web/src/screens/PlanetScreen.tsx` — savunma sekmesi
- `apps/web/src/i18n/locales/{en,tr}/`

**Nasıl.**

1. **Model.** Ölüm Yıldızı'nın kendisiyle aynı şekil: gezegen başına bir savunma
   varlığı + şarj sayacı. Mühimmat YARD kuyruğundan yeniden üretilir.
2. **Zamanlama — referans uygulama `radar_warning` handler'ı.** O handler
   halihazırda tam olarak istediğimiz şeyi yapıyor: radar çemberinin geçilme
   anında ateşliyor, o anda savunanın radar seviyesini **yeniden okuyor**,
   ve `nextRadarCheck` ile merdivenden aşağı iniyor.
   Yeni bir `strategic_intercept` olayı **aynı yardımcıları** (`radarLead`,
   `nextRadarCheck`, `RADAR_RANGES`) kullanır. Ayrı olay, çünkü bir bildirim yolu
   ile bir savaş çözümü aynı handler'da olmamalı.
3. **Sıra önemli.** Kesişme anında hem `strategic_intercept` hem
   `radar_warning` (→ `strategic_incoming` bildirimi) tetiklenebilir.
   **Önce imha kontrolü.** İmha olduysa savunana "geliyor" değil "imha ettin"
   denir.
4. **Recovery penceresinde de ateş eder.** Sahibinin kararı. Etmezse D113'ün iki
   vuruşluk ele geçirme rotası sistemi bedavaya geçer.
5. **Yayın.** İmha herkese yayınlanır (D106: paylaşılan efektler anını ve yerini
   yayınlar), iki tarafa da bildirim gider.
6. **Probe görünürlüğü.** Rapor sistemin varlığını söyler. Böylece Ölüm Yıldızı
   saf kaynak kararı olmaktan çıkıp **istihbarat kararına** dönüşür — bu,
   özelliğin en güçlü savunması.

**⚠ Neyi bozabilir.**

| Risk | Açıklama | Önlem |
|---|---|---|
| **Ölüm Yıldızı ölü içerik olur** | 33.000 kaynak + 60 dk + Core 12 + Shipyard 5 + araştırma zinciri. Ucuz bir önleyici D113'ün tüm işini çöpe atar | Mühimmat, Ölüm Yıldızı'nın anlamlı bir kesri; her kullanımda yeniden üretilir |
| **Radar 0 tuzağı** | Çemberi olmayan gezegen hiç ateş edemez | Minimum radar seviyesi kurulum şartı; kart menzili yazar |
| **Olay çift teslim** | Worker yeniden teslim edebilir | Handler idempotent: şarj tüketimi ve mission kapanışı tek işlemde, `status != 'in_flight'` ise no-op |
| **Radar uçuş sırasında büyür** | Kesişme anı değişir | Kalkışta mevcut menzile göre kur, ateşlerken seviyeyi yeniden oku — `radar_warning` bu kalıbı zaten uyguluyor |
| Bildirim çakışması | "Geliyor" + "imha edildi" aynı anda | İmha önce; imha varsa "geliyor" bastırılır |
| D127 sızıntısı | Sistemin varlığı public olmamalı | Yalnızca probe raporunda |
| Neutral hedefler | Neutral'ın sistemi yok | Handler erken döner |
| Görsel bütçe | Yeni VFX | `docs/visual-quality.md` bütçesi; kabul çekimi tanımla |
| **Temizlik listeleri** | Yeni varlık tablosu | `reclaim.ts` (varlık + `scheduledEvents.refId` temizliği, `strategicAssets` ile aynı kalıp) ve `servers.ts` sezon wipe |
| **Baskında/transferde hayatta kalma** | Ölüm Yıldızı varlığı dünyayla birlikte el değiştiriyor ve baskını atlatıyor (D113) | Anti-sistem de aynı davranmalı; **şarj da devredilir mi** — açık karar ver |
| Chronicle | İmha bir public geçiş (D96) | Chronicle kaydı eklensin mi — karar ver, sessiz bırakma |

**Test / kabul.**

- Ölüm Yıldızı, savunanın dar radar çemberinde imha ediliyor.
- Şarj tükeniyor; şarjsız sistem ateş etmiyor.
- Recovery penceresinde ateş ediyor.
- Handler iki kez çalıştırıldığında tek şarj tüketiyor.
- İmha diskte herkese görünüyor; iki tarafa da bildirim gidiyor.
- Probe raporu sistemin varlığını söylüyor; `/api/galaxy` söylemiyor.

---

### T11 · Ölüm Yıldızı ×2 stoklama

**Amaç.** Bir gezegen iki Ölüm Yıldızı stoklayabilsin; **seri** üretilsin;
tek tek ve peş peşe fırlatılabilsin.

**Bağımlılık.** T7 (araştırma kapısı).

**Nasıl.**

1. `strategic.ts::buildDeathStar` içindeki `DEATH_STAR_EXISTS` guard'ı, `BUILDING`
   / `PAUSED` / `READY` durumundaki varlıkların **sayısını** kontrol eder ve
   araştırma seviyesine göre 1 veya 2'ye izin verir.
2. **Seri üretim.** İkinci varlık, birincisi bitmeden **başlamaz**. Her biri yine
   60 dakika. Tek kazanç: ikincisini başlatmak için başında beklemek gerekmez.
   Zaman maliyeti korunur, angarya kalkar.
3. Fırlatma tek tek. Her fırlatma bir uçuş yuvası tutar; peş peşe fırlatmak
   `assertFreeBay` ile sınırlanır.

**⚠ Neyi bozabilir.**

| Risk | Açıklama | Önlem |
|---|---|---|
| **Tek başına koloni ele geçirme** | D113: koloni, 2 saatlik recovery penceresi içinde **ikinci** vuruşla el değiştirir. Diski geçmek 13 dakika. İki stoklanmış silahla tek komutan, tek dünyadan, art arda neredeyse her koloniyi alır. Şu an bu rota ikinci bir dünya, bir klan arkadaşı veya bir saat bekleme gerektiriyor | **Seri üretim** bunu büyük ölçüde dengeler: ikinci silah yine 60 dakika sürer. Yine de sim ile ölç; gerekirse ikinci varlık daha pahalı olur |
| `deathStarCapture` bayrağı | Kalkışta donduruluyor (D97) | Değişmez |
| Uçuş yuvası | İki silah iki yuva | `assertFreeBay` zaten sınırlıyor |
| `finishDeathStarBuild` | `assetId` ile idempotent | İkinci varlık için doğrula |
| Baskın/transfer hayatta kalma | Varlık dünyayla birlikte el değiştiriyor | İki varlık için de doğrula |

**T10 ile kilitlenmesi kasıtlıdır ve iyidir.** Savunanın bir şarjı varsa,
saldıran iki silah stoklayıp birincisini yem olarak gönderebilir; ilki imha
edilir, ikincisi iner. Bu, iki özelliği birbirinin cevabı yapar: stoklama
anti-sistemin cevabıdır, anti-sistem stoklamanın maliyetidir. İkisi ayrı ayrı
inerse denge tek taraflı görünür — **T10 ve T11 aynı sürümde çıkmalı.**

**Test / kabul.**

- İkinci silah, birincisi bitmeden başlamıyor.
- İki silah peş peşe fırlatılabiliyor, her biri bir yuva tutuyor.
- Ele geçirme rotası sim'de ölçülmüş; bant kırılmıyor.

---

### T12 · Araştırma menüsü

**Amaç.** Araştırma ayrı bir menü kategorisi olsun; benzer araştırmalar
gruplansın; seviyeli projeler seviyesini göstersin.

**Bağımlılık.** T7, T8, T9, T10, T11.

**Gruplar.**

| Grup | Projeler |
|---|---|
| Endüstri | Döteryum Rafinerisi · Gemi üretim hızı · Kazıcı kapasitesi |
| Lojistik | Gemi depo kapasitesi |
| Silah | Wasp · Lance · Bulwark · Yer savunması doktrinleri · Genel atak/zırh |
| Stratejik | Anti-ölüm-yıldızı · Ölüm Yıldızı ×2 |

**Nasıl.**

- Yeni bir `Panel` değeri ve ekran. `MenuPanel` üzerinden erişilir.
- Mevcut dört sezonluk proje **"Reach" sekmesinden çıkar**, buraya taşınır — tek
  kavram, tek yer.
- Her kart iki-üç kelimelik bir etiket + rol cümlesi taşır (etiket tanımlar, rol
  kararı açıklar).
- Seviyeli projeler mevcut seviye / tavan gösterir. Etkisi değişmeyen bir
  yükseltme **gösterilmez** (mevcut `INSTRUMENT_MAX_LEVEL` kuralının aynısı).
- Aynı anda tek araştırma çalıştığı için ekran hangi araştırmanın koştuğunu ve ne
  zaman biteceğini mutlak zamanla söyler.

**⚠ Neyi bozabilir.**

| Risk | Önlem |
|---|---|
| "Reach" sekmesi boşalır | Sekme yapısını gözden geçir; dördü de bir problemi adlandırıyor |
| Onboarding `data-tab` ile sekme işaret ediyor | Araştırma taşınırsa beat'ler kırılır — `script.ts` kontrol |
| Metin bileşende kalır | Tümü `locales/` altında |
| Kapalı kapı sinyali | Erişilemeyen proje **sebebini** yazar, sessizce gri kalmaz |
| Etkisiz seviye gösterilir | `RESEARCH_MAX_LEVEL` etki tablosundan **türetilir**, elle yazılmaz — `INSTRUMENT_MAX_LEVEL` kalıbının aynısı | Etkisi değişmeyen bir yükseltme hiç gösterilmez |

**Test / kabul.**

- Araştırma tek yerden erişiliyor; "Reach" sekmesinde kalıntı yok.
- Seviyeli proje seviyesini ve tavanını gösteriyor.
- Erişilemeyen her proje sebebini yazıyor.
- Onboarding sonuna kadar oynanıyor.
- Görsel doğrulama yapıldı.

---

### T13 · Doküman ve karar kayıtları

**Her görevle birlikte yapılır, sonda toplanmaz.** Kod değiştiğinde doküman
değişir; kilitli davranış değiştiyse invariant güncellemesi ve karar kaydı şarttır.

**Yeni karar kayıtları (`docs/decisions.md`).**

| Konu | Ne kaydeder |
|---|---|
| Hangar ve gemi alanı | Kapasitenin ne saydığı, taşmanın niçin yasal olduğu |
| Döteryum Rafinerisi | *"Deuterium is never produced passively"* kuralının **tersine çevrilmesi**, gerekçesiyle |
| Filo yakıtı | Formül, kimin ödediği, probe ve madenciliğin niçin muaf olduğu |
| Araştırma hesap geneli | D93'ün *"never levelled"* sınırının **tersine çevrilmesi** |
| Silah araştırması tavanı | Counter cycle ile ilişkisi, ölçülmüş rakamlarla |
| Anti-ölüm-yıldızı | Radar çemberi kararı, fiyat gerekçesi |
| Kazıcı baskında ölmez | `hulls.ts` docblock'undaki eski gerekçe **silinmez**, üzerine yazılır |

**Yeni invariant satırları (`CLAUDE.md`).**

- Rafineri yakıtı karşılar, asteroitler ödülü verir
- Yakıt kütlesi ile hangar alanı tek sayıdır
- Kapasite aşılabilir, aşılmışken yeni giriş durur; gemi asla silinmez
- Silah araştırmalarının birleşik etkisi counter cycle'ı geçemez
- Görünür bir çarpan, keşif raporunda olan çarpandır
- Kazıcı normal baskında ölmez, stratejik vuruşta ölür
- Anti-ölüm-yıldızının menzili radarın çizili çemberidir

**Diğer dosyalar.** `docs/game-design.md` (döteryum bölümü, hull tablosu, hardware
bölümü) · `docs/balance.md` (yeni sabitler ve ölçümler) · `docs/glossary.md`
(Hangar, alan, yakıt, rafineri, anti-ölüm-yıldızı) · `docs/interface.md`
(araştırma menüsü, dünyalar paneli).

**Emekliye ayrılan metinler silinir**, yorum olarak bırakılmaz.

---

## 5 · Kırılma haritası — görevler arası

Bir yeri yaparken bozulması en muhtemel yerler. Her satır bir kontrol maddesidir.

| Değişiklik | Sessizce kırdığı yer | Nasıl yakalanır |
|---|---|---|
| Savunan filo kurulumu (T2) | Sağ kalan yazımı kazıcıyı 0 yazar | Baskın sonrası kazıcı sayısı testi |
| Yeni `BuildingId` (T4, T5) | `MULTI_WORLD.neutral[1..3]` tip hatası, sim archetype'ları, `CORE_BOUND_BUILDINGS` | `pnpm typecheck` + sim koşusu |
| `PLANET_START` (T5) | `untouched()` claim idempotency guard'ı, rehearsal replay | Dört tüketicinin de aynı sabiti okuduğu test |
| Yakıt (T6) | ARR bandı, oturum-sonu-havada metriği, rehearsal, klan yardımı teklifi | Sim + rehearsal ucu ucuna oynanış |
| Araştırma hesap geneli (T7) | Keşif mekanizmaları, kuyruk projeksiyonu, sezon temizliği, contract şekli | Migration testi + `contract.test.ts` |
| `resolveCombat` imzası (T9) | 357 rules testi, neutral savaşı, klan savaşı | Opsiyonel nötr parametre |
| Kargo araştırması (T8) | Ganimet tavanı → ARR; `DENSE_FUEL_CELLS` keşif eşiği | Sim + keşif testi |
| Yeni zamanlanmış olay (T10) | Worker yeniden teslim, çift şarj tüketimi | Handler'ı iki kez çalıştıran test |
| Ölüm Yıldızı ×2 (T11) | Tek başına koloni ele geçirme rotası | Sim'de ele geçirme sayısı |
| Yeni panel (T3, T12) | Disk bileşenlerine taze props → GPU buffer yeniden kurulumu | Görsel doğrulama + render sayacı |
| `vaultProtects` imzası (T5) | 14 çağrı yeri; `onboarding/world.ts` rehearsal'ı kendi kendisiyle çeliştirir | Derleyici durdurur; rehearsal'ı elle oyna |
| Yeni tablo (T7, T10) | `reclaim.ts` FK ihlaliyle patlar, sezon wipe yetim bırakır | İki temizlik listesini de güncelle |
| Yer savunması kapağı (T4b) | `MULTI_WORLD.neutral[3].ground` kendi kapağını aşarsa neutral üretimi geçersiz dünya kurar | Üç tier için de kapak testi |
| Bina fiyatı (T4, T5) | `upgradeCost` tek eğri; ayrı fiyat istersen Wealth ve Ölüm Yıldızı hasarı bozulur | §3.4 Yol A |
| Herhangi bir `packages/rules` değişikliği | API galaksiyi önbelleğe alıyor, Vite bağlı paketi izlemiyor | **İki dev sunucusunu da yeniden başlat** |
| Herhangi bir görev | 2.482 mevcut test | Yeni testler **eklenir**, mevcut olanlar gevşetilmez |
| Yeni bağımlılık (`apps/web`) | Vite 504 döndürebilir | Yeniden optimizasyondan sonra Vite'ı yeniden başlat |

---

## 6 · Ölçüm ve kabul

### Her görev için

```bash
pnpm verify   # 0 tip hatası · 0 lint hatası · tüm testler yeşil
```

### T5, T6, T8, T9, T11 için ek olarak

```bash
pnpm balance:economy   # formül/tablo ilişkileri
pnpm balance:goal      # altı-yedi günlük gelişim bandı (D128)
pnpm sim               # beş tohum, 54 kapı
```

**Bant genişletmek yasak.** Bir bant kırılırsa model veya sabit düzeltilir.

### Ölçülecek yeni sayılar

| Metrik | Hedef | Nerede |
|---|---|---|
| Akın getiri oranı (ARR) | ≥ 1.30 | sim |
| Rafineri döteryum geliri ÷ asteroit döteryum geliri | belirgin şekilde < 1 | sim |
| Bilgili archetype kazanma oranı | düşmüyor | sim (`informedArchetypeWins`) |
| Herhangi bir hull'un birleşik tech çarpanı | ≤ 1.25× | rules testi |
| Tek başına koloni ele geçirme sayısı | artış kontrollü | sim |

### T3 ve T12 için

`node tools/visual.mjs` ile görsel doğrulama. Mobil portre öncelikli.

---

## 7 · Riskler

| Risk | Şiddet | Nerede patlar | Azaltma |
|---|---|---|---|
| Yakıt, "oturumların %80'i havada bir şeyle bitsin" hedefini düşürür | **En yüksek** | Playtest | Fiyat, ortalama akın kârının %5-8'ini geçmesin |
| Rafineri izotop asteroitlerini gereksizleştirir | **Yüksek** | Sezonun ikinci perdesi ölü içerik olur | Sim kabul kriteri |
| Yakıt ARR bandını kırar | Yüksek | sim | Ganimet değil yakıt fiyatı düşer |
| Ucuz anti-ölüm-yıldızı stratejik silahı öldürür | Yüksek | D113'ün tüm işi | Mühimmat fiyatı |
| Araştırma çarpanları bilgi katmanını ezer | Yüksek | Oyunun merkezi iddiası | Ortak tavan + probe görünürlüğü |
| **Gemi tavanlı, taret tavansız bir sürüm** | **Yüksek** | Fazlanın gidecek tek yeri taret olur → kaplumbağa dominant | T4b, T4 ile aynı sürümde |
| Yer savunması kapağı savunmayı fazla nerf'ler | Orta | ARR yukarı kayar | Cömert ayar; sim ile ölç |
| Hangar altıncı, rafineri yedinci binadır | Orta | Tip hataları, sim, sanat, iki dil | Tam tarama listesi T4/T5'te |
| Migration veri kaybı | Orta | T7 | Eski tabloyu silme, doğrula |
| İki dünya seçici drift eder | Düşük | T3 | Geçici, kabul edilmiş |

---

## 8 · Açık kalan ayarlar

Bunlar **karar değil, kalibrasyon** — uygulama sırasında sim ile bulunacak:

- `HANGAR.base`, `HANGAR.perLevel`, her hull'un `bulk` değeri
- `groundSlots(coreLevel)` eğrisi — normal dünyada bağlamaz, ~3× istifte bağlar
- `FUEL.scale`
- Döteryum rafinerisi üretim eğrisi ve araştırma maliyet merdiveni
- Vault'un koruduğu döteryum miktarı
- `PLANET_START.deuterium` başlangıç deposu
- Silah araştırmalarının seviye başına adımları (tavan 1.25× sabit)
- Anti-ölüm-yıldızı mühimmat fiyatı ve minimum radar seviyesi
- İkinci Ölüm Yıldızı'nın fiyatı (gerekirse birinciden pahalı)

Sahibi *"kalibre edemezsek 2x 3x yaparız, oyuncu yorumlarına bakarız"* dedi —
bu sabitler oynanışla ayarlanır, argümanla değil.

### Kararlar — onaylandı, uygulanacak

Bunlar sayı değil, karardır. Altısı da sahibi tarafından onaylandı; açık soru
olarak değil, **uygulama talimatı** olarak okunur.

| # | Karar | Gerekçe |
|---|---|---|
| K1 | **Araştırma Wealth'e girer** (§T7) | Enstrümanlarda tam olarak bu hata yaşandı; `investedInInstrument` onun için yazıldı. `Holdings`'e araştırma eklenir, `investedInResearch` yazılır |
| K2 | **Yeni binalar paylaşılan fiyat eğrisini kullanır** (§3.4, Yol A) | Fiyat değil fayda ayarlanır. `upgradeCost` tek eğri kalır; Wealth ve Ölüm Yıldızı hasar hesabı bozulmaz |
| K3 | **Anti-sistemin şarjı dünya el değiştirince devredilmez** (§T10) | Mühimmat sahibinin yatırımıdır, dünyanın değil. Varlık devredilir, şarj sıfırlanır |
| K4 | **İmha edilen Ölüm Yıldızı Chronicle'a girer** (§T10) | D96'nın tanımına uyan bir public geçiş |
| K5 | **Yer savunmasına Core'dan türeyen ayrı bir kapak gelir — T4b, aynı sürümde** (§T4b) | Sorunu T4'ün kendisi yaratıyor: gemi tavanlı, taret tavansız kalırsa fazlanın gidecek tek yeri taret olur. Ayrıca D27'nin *"ne kadar" → "ne tür"* dönüşümünü güçlendirir |
| K6 | **Araştırma siparişi seviyeyi `subject` = `"ID:level"` ile taşır** (§T7) | `count` zaten "kaç adet" demek; anlamı bükülmez |
