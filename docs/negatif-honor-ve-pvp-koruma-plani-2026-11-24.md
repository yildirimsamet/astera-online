# Negatif Honor Kademeleri ve PvP Koruma Güncellemeleri — Geliştirme & Devir Planı (2026-11-24)

> **Bu belge sıfır bağlamla işi devralacak bir geliştirici veya ajan için eksiksiz teknik devir dokümanıdır (Handoff Spec).**
> İşi devraldığında kod yazmaya başlamadan önce **§0**, **§1** ve **§3 (Kritik Tuzaklar)** bölümlerini baştan sona oku; ardından **§5 Uygulama Defteri**ndeki sırayı **zorunlu TDD (`FAIL → PASS`)** disipliniyle takip et.
>
> **Durum:** Owner kararları (`K1–K8`), 8 adımlık uygulama, kapsamlı kod incelemesi (review) ve doğrulamalar tamamlandı (`feat/honor-benefits-v2`).

---

## 0. Devir Özeti — İşi Devralan İçin İlk Bilinmesi Gerekenler

### 0.1 Amaç ("Ne Yapıyoruz?")
Zayıf oyuncuların ezilmesini/zorbalanmasını azaltmak ve oyunu bıraktıran tek taraflı saldırı baskısını kırmak için **savaş formüllerine (hasar, zırh, kalkan HP, counter çarpanları) hiç dokunmadan** şu 5 eksende değişiklik yapıyoruz:
1. **Negatif Honor kademelerini 2'den 4'e çıkarıyoruz (`-25 / -50 / -150 / -200`):**
   - `Tier -3` (`≤ -150 Honor`): Mevcut yaptırımlara ek olarak **filo kaldırırken `+%25` döteryum yakıt ücreti**.
   - `Tier -4` (`≤ -200 Honor`): `Tier -3`'e ek olarak **tüm gezegenlerde saatlik Alaşım, Kristal ve Döteryum üretiminde `-%25` kesinti**.
2. **Zorbalık (`WEAK`) tekrar ceza çarpanını artırıyoruz ve önceden uyarıyoruz:**
   - Son 24 saatte aynı hedefe yapılan zorbalıkların negatif Honor çarpanı `1.0× / 1.5× / 2.0×` yerine **`1× / 2× / 3×`** oluyor.
   - Saldırı hazırlık ekranında (`LaunchSheet` → `HonorTargetCard` ve düşmana nişanlanan `EMP` / `Radyasyon Bombası` panelleri) önceki saldırıda negatif Honor alınmışsa oyuncuya kalkıştan önce açıkça **`2×` / `3×` katlamalı kayıp uyarısı** gösteriliyor.
3. **PvP yağma oranlarını 2 kademeden 3 kademeye ayırıyoruz:**
   - Savunan `Tier 1–3`: `%25` Kesin / `%12,5` Kısmi (mevcut korunur).
   - Savunan `Tier 4–5`: **`%45` Kesin / `%22,5` Kısmi** *(yeni ara kademe)*.
   - Savunan `Tier 6+` (ve Nötr): `%60` Kesin / `%30` Kısmi.
4. **Toparlanma Kalkanı (Ağır Yenilgi Kalkanı) kazanma eşiğini düşürüyoruz:**
   - Ana Galakside kalkan süresi zaten **12 saat** (+ vurulan gezegende `+%50` üretim boost'u). Süre ve boost korunuyor; ancak `Tier 4+` için kalkan kazanma eşiği 6 saatte `4` saatlik net üretim kaybından **`3` saatlik net üretim kaybına** indiriliyor *(koloni arızası eşiği `4` saatte sabit bırakılıyor!)*.
5. **Saldırı sıklığı (Bash & Cooldown) limitlerini daraltıyoruz:**
   - `Tier 1–4` bireysel akın beklemesi: savaştan sonra **12 saatte 1** (eskiden `Tier 1–3` idi).
   - `Tier 5+` kişisel bash limiti: **12 saatte en fazla 2** saldırı (eskiden `3` idi).
   - Klan toplam saldırı tavanı: aynı hedef komutana **12 saatte en fazla 3** saldırı (eskiden `5` idi).

### 0.2 Zorunlu Çalışma Kuralları (`CLAUDE.md` Özeti)
- **Zorunlu TDD:** Tek satırlık sabit değişikliği dahil **önce test yazılır/güncellenir → ilgili test çalıştırılıp `FAIL` görülür → en sade kod yazılır → `PASS` görülür**. Yalnız saf CSS/görsel düzenlemeler istisnadır.
- **Bellek ve Paralellik Sınırı:**
  - Node heap asla `3 GiB` (`--max-old-space-size=3072`) üstüne çıkamaz; test worker başına tavan `1024 MiB` (asla `1536 MiB` üstü değil).
  - Kısa hedefli testlerde **1 worker** (`--poolOptions.forks.maxForks=1` veya tek dosya), orta gruplarda **3–4 worker** kullan.
  - Doğrudan `vitest` / `tsc` çalıştırırken başına `node tools/heavy.mjs` ekle; `test`, `typecheck` ve `lint` asla aynı anda paralel çalıştırılmaz.
- **Uzun Test Yasağı:** `packages/sim`, `snowball-audit`, `pnpm test:long` veya `pnpm verify --include-long-tests` kullanıcı açıkça istemedikçe **kesinlikle çalıştırılmaz**. Normal `pnpm verify` bunları zaten hariç tutar.
- **Bot Gizliliği (Kilitli Kural 2026-10-28):** Oyuncuya görünen hiçbir UI metninde, 6 dil çevirisinde, hata mesajında, Wiki'de veya istemci API şemasında `bot` kelimesi ya da işareti yer alamaz. Botlar sunucuda gerçek oyuncularla birebir aynı kurallara (zamlı yakıt, bash limitleri vb.) tabidir.
- **Kirli Çalışma Ağacı Uyarısı:** Çalışma dizininde başka oturumlara ait commit edilmemiş değişiklikler (`0265–0268` migration'ları, günlük görevler, sonda bataryası vb.) bulunabilir. **`git checkout --`, `git reset`, `git clean` kesinlikle yapma**; başkalarının hunk'larına dokunma ve yeni migration numarasını o anki en son `apps/server/drizzle/meta/_journal.json` kaydına bakarak ver.
- **El Kitabı (`~/Desktop/Coding/MyProjects/game-dev-handbook/`):** Başlamadan `CLAUDE.md` §4.7 gereği nereleri okuduğunu bildir; teslimden önce `checklists.md` kontrolünü geçir ve teslim notunda ilke ID'lerini (`DI-02`, `DI-10`, `SB-04`, `SB-07`, `SB-12`, `SB-18`, `PE-09`, `UI-01`, `UI-08`, `UI-14`, `ML-01`) belirt.

---

## 1. Kilitlenen Owner Kararları (`K1–K8`, 2026-11-24)

| Kod | Konu | Eski Davranış | Yeni Karar (Uygulanacak) |
|---|---|---|---|
| **K1** | Negatif Honor kademeleri | 2 kademe: `-25`, `-100` (`Tier -1, -2`) | **4 kademe (`V2`):** `-25`, `-50`, `-150`, `-200` (`Tier -1, -2, -3, -4`). `Tier -2`'nin tamir (`+%10`), konvoy (`-%30`), ticaret (`%14`) oranları `Tier -3` ve `-4`'te sabit kalır; üstüne kümülatif olarak **`Tier -3`: `+%25` filo yakıtı**, **`Tier -4`: `+%25` yakıt + tüm gezegenlerde `-%25` saatlik üretim** eklenir. |
| **K2** | `+%25` yakıt kapsamı | Yoktu | **Taktik geri çekilme (`escapeFuel`) hariç** tüm oyuncu filo kalkışlarında geçerli (akın, korsan, klan savaşı, anıt gidiş+rezerv, konvoy, ticaret, transfer, koloni kurma, klan yardımı, klan savunma desteği, bilinmeyen sinyal, Ay Kapısı). |
| **K3** | `-%25` üretim kapsamı | Yoktu | Komutanın **tüm gezegenlerinde** **Alaşım Rafinerisi + Kristal Ocağı + Döteryum Rafinerisi** saatlik üretim hızı `%25` azalır (`×0.75`). **Havuz/Depo tavanları, Depo koruma tabanı ve Toparlanma Kalkanı üretim paydası nominal kalır.** |
| **K4** | Toparlanma Kalkanı | `Tier 1–3`: 2s kayıp / 8s pencere / 12s kalkan. `Tier 4+`: **4s kayıp** / 6s pencere / 12s kalkan (+%50 vurulan gezegen boost'u). | Süre (**12 saat**) ve vurulan gezegen boost'u (**+%50**) korunur. `Tier 4–5` ve `Tier 6+` kazanma eşiği `4` saatten **`3` saatlik net üretim kaybına** düşürülür. **Koloni arızası eşiği `4` saatte sabit kalır.** |
| **K5** | Saldırı sıklığı (12 saatte) | `Tier 1–3`: 1 akın · `Tier 4+`: 3 saldırı · `Klan`: 5 saldırı | **`Tier 1–4`:** savaştan sonra 12 saatte **1** bireysel akın · **`Tier 5+`:** 12 saatte **2** saldırı · **`Klan`:** aynı hedefe 12 saatte **3** saldırı. |
| **K6** | Sezon açılışı | `HONOR_BENEFIT_PROGRAM_VERSION = 1` | **Mevcut canlı sezonlar dahil** tüm aktif `MAIN` galaksilerde hemen V2'ye yükseltilir; kapalı tarihsel sezonlar V1 olarak okunmaya devam eder; Wiki güncelleme duyurusu eklenir. |
| **K7** | Zorbalık tekrar çarpanı & uyarı | 24 saatte `1.0× / 1.5× / 2.0×`; saldırı sheet'inde önceki negatif Honor uyarısı yoktu. | Yeni kalkışlarda 24 saatte **`1× / 2× / 3×`** (`weakRepeatScale: 100`). Saldırı hazırlık ekranlarında önceki zorbalıkta negatif Honor alınmışsa (veya filo yoldaysa) **`2×` / `3×` katlamalı kayıp uyarısı** gösterilir. |
| **K8** | PvP yağma kademeleri | `Tier 1–3`: `%25/%12,5` · `Tier 4+`: `%60/%30` | **`Tier 1–3`:** `%25/%12,5` (Havuz `%15/%7,5`) · **`Tier 4–5`:** **`%45/%22,5`** (Havuz `%22,5/%11,25`) · **`Tier 6+` & Nötr:** `%60/%30` (Havuz `%30/%15`). |

---

## 2. Nasıl Yapılacak? — Katman Katman Uygulama Kılavuzu

### 2.1 Rules Katmanı (`packages/rules/src/`)

#### A) `packages/rules/src/honorBenefits.ts` — Program V2 ve Yakıt Fonksiyonları
1. **Sürüm ve Eşik Tipleri:**
   - `HONOR_BENEFIT_PROGRAM_VERSION = 2` (eski sürüm sabiti `HONOR_BENEFIT_PROGRAM_V1 = 1` olarak tutulsun).
   - `HonorBenefitThresholds` tipini hem V1 (`readonly [number, number]`) hem V2 (`readonly [number, number, number, number]`) negatif eşiklerini kabul edecek şekilde genişlet:
     ```ts
     export interface HonorBenefitThresholds {
       readonly positive: readonly [number, number];
       readonly negative: readonly [number, number] | readonly [number, number, number, number];
     }
     export const HONOR_BENEFIT_THRESHOLDS_V1: HonorBenefitThresholds = {
       positive: [25_000_000, 75_000_000],
       negative: [25_000_000, 100_000_000],
     };
     export const HONOR_BENEFIT_THRESHOLDS_V2: HonorBenefitThresholds = {
       positive: [25_000_000, 75_000_000],
       negative: [25_000_000, 50_000_000, 150_000_000, 200_000_000],
     };
     export type HonorBenefitTier = -4 | -3 | -2 | -1 | 0 | 1 | 2;
     ```
2. **Oran Tablosu (`HONOR_BENEFIT_RATES`):**
   - Her kademeye `fuelPct` ve `productionPct` ekle:
     - `2`: `{ tier: 2, repairPct: -10, convoyPct: 30, tradePct: 0, fuelPct: 0, productionPct: 0 }`
     - `1`: `{ tier: 1, repairPct: -5, convoyPct: 15, tradePct: 0, fuelPct: 0, productionPct: 0 }`
     - `0`: `{ tier: 0, repairPct: 0, convoyPct: 0, tradePct: 0, fuelPct: 0, productionPct: 0 }`
     - `-1`: `{ tier: -1, repairPct: 5, convoyPct: -15, tradePct: 7, fuelPct: 0, productionPct: 0 }`
     - `-2`: `{ tier: -2, repairPct: 10, convoyPct: -30, tradePct: 14, fuelPct: 0, productionPct: 0 }`
     - `-3`: `{ tier: -3, repairPct: 10, convoyPct: -30, tradePct: 14, fuelPct: 25, productionPct: 0 }`
     - `-4`: `{ tier: -4, repairPct: 10, convoyPct: -30, tradePct: 14, fuelPct: 25, productionPct: -25 }`
3. **`honorBenefits(score, thresholds)` Doğrulaması:**
   - Hem `positive` hem `negative` dizisinin her elemanının `> 0` tam sayı ve kesin artan sırada (`arr[i] > arr[i - 1]`) olduğunu doğrula (mevcut `RangeError` davranışı korunmalı).
   - `negative.length === 4` ise `score <= -n[3] → -4`, `<= -n[2] → -3`, `<= -n[1] → -2`, `<= -n[0] → -1`; `negative.length === 2` (V1) ise sadece `-2`, `-1` dönecek.
4. **Tek Merkezli Yakıt Hesaplayıcıları (`honorFuelCost` & `honorLaunchFuel`):**
   - İstemci ve sunucu yuvarlama sırasının asla ayrışmaması için iki saf fonksiyonu buradan export et:
     ```ts
     export function honorFuelCost(
       baseFuel: number,
       benefits: Pick<HonorBenefits, 'fuelPct'> | null | undefined,
     ): number {
       const fuel = honorInteger(baseFuel);
       const pct = benefits?.fuelPct ?? 0;
       if (pct === 0 || fuel === 0n) return honorNumber(fuel);
       return honorNumber((fuel * honorInteger(100 + pct) + 99n) / 100n);
     }

     export function honorLaunchFuel(
       plainFuel: number,
       benefits: Pick<HonorBenefits, 'fuelPct'> | null | undefined,
       admiralFuelMult = 1,
     ): number {
       honorInteger(plainFuel);
       if (!(admiralFuelMult > 0 && Number.isFinite(admiralFuelMult))) {
         throw new RangeError('Invalid admiral fuel multiplier');
       }
       const afterAdmiral = admiralFuelMult === 1 ? plainFuel : Math.ceil(plainFuel * admiralFuelMult);
       return honorFuelCost(afterAdmiral, benefits);
     }
     ```

#### B) `packages/rules/src/{honor,honorTactical,honorTeam}.ts` — `1× / 2× / 3×` Zorbalık Çarpanı
1. `honor.ts` içine ekle:
   ```ts
   export const HONOR_WEAK_REPEAT_SCALE = 100;
   export type HonorWeakRepeatScale = 50 | typeof HONOR_WEAK_REPEAT_SCALE;

   export function honorWeakRepeatHalfUnits(weakRepeat: number, scale?: HonorWeakRepeatScale): bigint {
     honorInteger(weakRepeat);
     const step = BigInt(Math.min(weakRepeat, 2));
     return scale === HONOR_WEAK_REPEAT_SCALE ? 2n + 2n * step : 2n + step;
   }
   ```
2. `HonorSideInput` (`honor.ts:89`), `HonorTacticalInput` (`honorTactical.ts:5`) ve `HonorTeamInput` (`honorTeam.ts:34`) arayüzlerine opsiyonel `weakRepeatScale?: HonorWeakRepeatScale;` ekle.
3. Şu 4 satırdaki `BigInt(2 + Math.min(..., 2))` ifadesini `honorWeakRepeatHalfUnits(..., input.weakRepeatScale)` ile değiştir:
   - `packages/rules/src/honor.ts:147`
   - `packages/rules/src/honorTactical.ts:51`
   - `packages/rules/src/honorTeam.ts:191`
   - `packages/rules/src/honorTeam.ts:217`

#### C) `packages/rules/src/monumentFuel.ts` — Anıt Yakıt Rezervi Tutarlılığı
- `monumentFuelReserves(fleet: Fleet, maximumDistance: number, fuelPct = 0)`: Satır `17`'deki `missionFuel({ [hull]: 1 }, maximumDistance, 1)` değerini `honorFuelCost(..., { fuelPct })` ile sar.
- `priceMonumentReturn(lots: readonly MonumentShipLot[], actualDistance: number, fuelPct = 0)`: Satır `33`'teki `const fuel = honorFuelCost(missionFuel(fleet, actualDistance, 1), { fuelPct });` olarak güncelle. Böylece `fuel <= reserve` eşitsizliği her mesafede korunur ve inişte `+%25` ceza yanlışlıkla oyuncuya iade edilmez.

#### D) `packages/rules/src/economy.ts` — `-%25` Saatlik Üretim
- `PlanetEconomyInput` (`economy.ts:890`) içine `honorProductionShare?: number;` ekle (geçerli aralık `(-1, 0]`, varsayılan `0`; aralık dışı veya `NaN` için `RangeError` fırlat, tıpkı satır `993`'teki `clanBonus` kontrolü gibi).
- Satır `995`'teki `const share = 1 + clanBonus;` satırını `const share = (1 + clanBonus) * (1 + honorProductionShare);` yap.
- **Kesinlikle `nominalA`, `nominalC`, `nominalD` satırlarına (`984–986`) dokunma!** Kapasite tavanları nominal kalmak zorundadır.

#### E) `packages/rules/src/{pvpBalance,constants,clan}.ts` — PvP Yağma, Kalkan, Arıza ve Bash Sabitleri
1. `constants.ts`:
   - Satır `2266`: `bashLimit: 2` *(eskisi `3`)*
   - Satır `2269`: `personalRaidProtectedTier: 4` *(eskisi `3`)*
   - Satır `2391`: `recoveryLossHours: 3` *(eskisi `4`)*
   - Satır `3955` (`FAULT` nesnesi içine): `heavyDefeatLossHours: 4` sabiti ekle!
2. `clan.ts`:
   - Satır `33`: `attackLimit: 3` *(eskisi `5`)*
3. `pvpBalance.ts`:
   - `MID_TIER_PVP_BALANCE` ekle ve export et:
     ```ts
     export const MID_TIER_PVP_BALANCE: PvpBalance = {
       lootDecisive: 0.45,
       lootPartial: 0.225,
       lootBufferShare: 0.5,
       recoveryLossHours: ABUSE.recoveryLossHours, // 3
       recoveryLookbackHours: ABUSE.recoveryLookbackHours, // 6
       recoveryShieldHours: ABUSE.recoveryShieldHours, // 12
     };
     ```
   - `pvpBalanceForTier(tier)` fonksiyonunu güncelle:
     - `tier` tam sayı ve `1 <= tier <= 3` → `LOW_TIER_PVP_BALANCE`
     - `tier` tam sayı ve `4 <= tier <= 5` → `MID_TIER_PVP_BALANCE`
     - Diğer tüm durumlar (`tier >= 6`, `null`, `undefined`) → `STANDARD_PVP_BALANCE`.

---

### 2.2 Veritabanı Şeması ve Migration (`apps/server/src/db/schema.ts` & `drizzle/`)

1. **`apps/server/src/db/schema.ts` değişiklikleri:**
   - `eventKind` (`satır ~111` dizisinin **EN SONUNA**, asla araya değil!): `'honor_penalty_sync'` ekle.
   - `planets` (`satır ~1521`, `clanBonus` yanına):
     `honorProductionShare: doublePrecision('honor_production_share').notNull().default(0),`
   - `monumentWaves` (`satır ~2560`, `fuelPaid` yanına):
     `fuelPct: integer('fuel_pct').notNull().default(0),` (ve `monument_waves_amounts_check` içine `${t.fuelPct} >= 0` kontrolü eklenebilir veya ayrı check).
   - `clanWarContributions` (`satır ~3483`):
     `monumentFuelBudget` `$type` tanımını `{ outbound: MonumentFuelReserves; homeward: MonumentFuelReserves; fuelPct?: number }` olarak genişlet (JSONB sütunu olduğu için SQL DDL değişikliği gerekmez).
2. **`apps/server/src/services/transferReferences.ts` (`satır ~89`):**
   - `TRANSFER_EVENT_POLICIES` nesnesine `honor_penalty_sync: 'BLOCKER'` ekle *(eklenmezse hem TypeScript derlemesi hem `transfer-events.test.ts` patlar!)*.
3. **Migration Dosyası (`apps/server/drizzle/02XX_honor_benefits_v2.sql`):**
   - Uygulama anında `apps/server/drizzle/meta/_journal.json` dosyasındaki en son `idx` ve dosya numarasına bakarak sıradaki numarayı kullan (`drizzle-kit generate` veya mevcut proje yöntemiyle snapshot + journal tutarlılığını koru, `schema-drift.test.ts` mutlaka geçmeli!):
     ```sql
     ALTER TYPE "public"."event_kind" ADD VALUE 'honor_penalty_sync';--> statement-breakpoint
     ALTER TABLE "planets" ADD COLUMN "honor_production_share" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
     ALTER TABLE "monument_waves" ADD COLUMN "fuel_pct" integer DEFAULT 0 NOT NULL;
     ```
   - **Dikkat:** SQL migration içine `UPDATE honor_seasons SET benefits_version = 2` **YAZMA** (bkz. §2.4 ve Tuzak #7).

---

### 2.3 Server — Honor Çarpanı (`1×/2×/3×`) ve Hedef Önizlemesi (`apps/server/src/services/`)

1. **`honorAccounting.ts`:**
   - `honorEvidenceSchema` (`satır 15` yanına): `weakRepeatScale: z.union([z.literal(50), z.literal(HONOR_WEAK_REPEAT_SCALE)]).optional(),` ekle.
   - Aşağıdaki **5 noktanın tamamını** `honorWeakRepeatHalfUnits(step, scale)` kullanacak şekilde güncelle:
     - Satır `139` (`continuationPenalty`): `honorWeakRepeatHalfUnits(prior.step ?? 0, evidence.weakRepeatScale)`
     - Satır `191` (`advanceHonor` `repeats.push` factor kaydı): `numerator: Number(honorWeakRepeatHalfUnits(step, e.weakRepeatScale)), denominator: 1`
     - Satır `254` (`advanceSimultaneousHonor` `factors`): `Number(honorWeakRepeatHalfUnits(before + n, scale))` *(grup içindeki ilgili kaynağın `weakRepeatScale` değeriyle)*
     - Satır `267` (`advanceSimultaneousHonor` `known` dalı): `Number(honorWeakRepeatHalfUnits(priorRepeats(a, b, source), row.weakRepeatScale))`
     - Satır `276` (`advanceSimultaneousHonor` `old` hesabı): `honorWeakRepeatHalfUnits(priorRepeats(e.actor, e.enemy, group[index]!.attackKey), group[index]!.weakRepeatScale)`
2. **`honorCommitment.ts`:**
   - `honorCommitmentSchema` (`satır 15` yanına): `weakRepeatScale: honorEvidenceSchema.shape.weakRepeatScale,` ekle.
   - `commitHonor` (`satır 68–73`): Yeni oluşturulan tüm snapshot'lara `weakRepeatScale: HONOR_WEAK_REPEAT_SCALE` (`100`) yaz.
3. **`honorBattleEvidence.ts` (`satır 68`) ve `honorStrategic.ts` (`satır 34` `strategicHonorEvidence`):**
   - **İkisinde birden** `...(frozen.weakRepeatScale === undefined ? {} : { weakRepeatScale: frozen.weakRepeatScale })` alanını `HonorEvidence` çıktısına aktar! (`honorRadiation.ts:34` zaten `strategicHonorEvidence` çağırdığı için Radyasyon Bombası da otomatik kapsanır.)
4. **`honorTarget.ts` (`satır 49–67`):**
   - Satır `51–53`'teki `missions` sorgusuna **`isNull(missions.recalledAt)`** koşulunu ekle (geri dönen iptal edilmiş filolar sayılmasın) ve `limit(1)` yerine bu hedefe giden aktif saldırı sayısını (`inFlightCount`) al.
   - `state.repeats` üzerinden `priorWeakCount = state.repeats.filter(r => r.a === playerId && r.b === target.owner && r.at > since && r.at <= now.getTime()).length` hesapla.
   - `comparison.kind === 'WEAK'` ise dönüş nesnesine:
     - `priorWeakCount`
     - `weakMultiplier: (1 + Math.min(priorWeakCount + inFlightCount, 2)) as 1 | 2 | 3`
     alanlarını ekle.

---

### 2.4 Server — `-%25` Üretim, Tembel Hesaplama ve Sezon V2 Geçişi

1. **`honorBenefits.ts` (`apps/server/src/services/honorBenefits.ts`):**
   - `readHonorPlayerPolicy`: `row.benefitsVersion === 1` ise `HONOR_BENEFIT_THRESHOLDS_V1`, `row.benefitsVersion === 2` (`HONOR_BENEFIT_PROGRAM_VERSION`) ise `HONOR_BENEFIT_THRESHOLDS_V2` ile `honorBenefits(score, thresholds)` çağır ve `version: row.benefitsVersion` döndür. (Başka sürümse hata fırlat.)
   - Üretim payı yardımcı fonksiyonu ekle: `honorProductionShareFrom(benefits)` → `(benefits?.productionPct ?? 0) / 100` (`0` veya `-0.25`).
   - `shards` sorgusuna gömülecek sıfır-ek-sorgulu SQL sütun yardımcısını (`clanRefineryColumns` deseniyle, `clanPerks.ts:31` gibi) tanımla:
     - `honorBenefitsVersion`: `honor_seasons` tablosundan (`season_id = planets.season_id AND mode = 'ACTIVE'`) `benefits_version`
     - `honorTotalScore`: `coalesce(honor_totals.score, 0) + coalesce(honor_quest_totals.micros, 0)` *(Dikkat: görev puanı `honor_quest_totals` tablosundadır!)*
   - `enableHonorBenefits(db, seasonId, clock, apply)`:
     - `config.benefitsVersion !== null && config.benefitsVersion !== 1 && config.benefitsVersion !== 2` ise `'Honor benefit configuration is immutable'` fırlat.
     - `apply && config.benefitsVersion !== HONOR_BENEFIT_PROGRAM_VERSION` ise `benefitsVersion = 2` olarak güncelle, sezonda toplam Honor puanı `<= -200_000_000` olan oyuncular için `scheduleHonorPenaltySync(tx, seasonId, playerId, clock.now())` çağır ve `publishShard(tx, seasonId, 'season')` yayınla.
2. **`honorActivation.ts` (`ensureMainHonorRankings`, `satır 123`) & `honorProgram.ts` (`satır 32`):**
   - `ensureMainHonorRankings`: Her canlı `MAIN` sezon için `openHonorRanking` sonrasında `await enableHonorBenefits(db, season.id, clock, true)` çağır. Böylece sunucu ayağa kalktığında tüm canlı sezonlar otomatik V2'ye geçer.
   - `inheritedHonorBenefitsProgram`: `1 | 2` sürümlerini kabul et (`versions.every(v => v === 1 || v === 2)`), varsa `Math.max(...versions) as 1 | 2` döndür (çelişkili bilinmeyen sürümde hata fırlatmaya devam et).
3. **`planet.ts`, `planetView.ts`, `session.ts`, `adminPlayers.ts`, `intel.ts`, `ownership.ts`, `loyalty.ts`, `reclaim.ts`:**
   - `planet.ts`:
     - `economyAt` (`satır 191`), `PlanetInputs` (`satır 297, 727`), `LockedPlanet`, `loadPlanetState` (`satır 556–656`) ve **`loadPlanetViewStates` (`satır 702` — unutma!)** içine `honorProductionShare` ekle.
     - `loadPlanetState` içinde `options.mutate === true` iken `shards` sorgusuna `honorProductionColumns(row.seasonId, row.controllerPlayerId)` ekle; `row.lastTickAt → now` aralığını `row.honorProductionShare` ile ilerlet, ardından `planets.update` içine `honorProductionShare: freshHonorShare` yaz.
   - `planetView.ts:349`: `pace = (p.vacationUntil ? 0 : p.silentSpace ? SILENT_SPACE.productionPace : 1) * (1 + p.clanBonus) * (1 + p.honorProductionShare)`.
   - `session.ts:534`, `adminPlayers.ts:66`, `intel.ts:962`: `clanBonus` yanına `honorProductionShare` çarpanını ekle.
   - `ownership.ts:361`, `loyalty.ts` (kopuş), `reclaim.ts`: Gezegen nötrleştiğinde `honorProductionShare: 0`, başka bir oyuncuya geçtiğinde yeni oyuncunun güncel Honor üretim payını yaz.
4. **Eşik Geçişi Senkronizasyonu (`honorLedger.ts`, `dailyQuests.ts`, `worker/handlers.ts`):**
   - `honorLedger.ts:165` (`settleHonor` — `accounting` fazında çalışır, **burada asla `planets` kilitleme!**): İşlem öncesi ve sonrası oyuncunun toplam puanını (`ledger + honor_quest_totals`) karşılaştır; `benefitsVersion === 2` olan aktif sezonda herhangi bir oyuncunun `productionPct` değeri değiştiyse (`0 ↔ -25`), `schedule(tx, { seasonId, kind: 'honor_penalty_sync', refId: actorId, resolveAt: new Date(evidence.at) })` ekle (aynı oyuncu için bekleyen `pending` olay varsa çift ekleme yapma).
   - `dailyQuests.ts` (görev ödülü alındığında): Oyuncu `-200` eşiğini yukarı kırdıysa (`oldScore <= -200_000_000 && newScore > -200_000_000`) aynı `honor_penalty_sync` olayını planla.
   - `worker/handlers.ts` (`case 'honor_penalty_sync':`): `refId` (`playerId`) ve `seasonId` ile oyuncunun kontrol ettiği gezegen ID'lerini küçükten büyüğe sıralı çek; her gezegen için ayrı/sıralı `withPlanetLock` (`loadLocked`) çağırarak `lastTickAt → now` ilerlemesini ve `honorProductionShare` yazımını tetikle, ardından `publish(tx, playerId, 'planet')` yayınla.

---

### 2.5 Server — `+%25` Yakıt (11 Kanal), Kalkan/Arıza Ayrımı, Bash ve Botlar

1. **11 Filo Kalkış Kanalı (`honorLaunchFuel` / `honorFuelCost` + opsiyonel `expectedHonorTier`):**
   Her serviste `readHonorBenefits(tx, origin.seasonId, playerId)` oku; istemci `expectedHonorTier` göndermişse `assertHonorBenefitsQuote(benefits, expectedHonorTier)` doğrula:
   1. `mission.ts:419–422` (`startAttack`): `honorLaunchFuel(plainFuel, benefits, escort?.bonuses.fuel)`
   2. `pirateRaid.ts:335–337` (`launchPirateRaid`): `honorLaunchFuel(plainFuel, benefits, escort?.bonuses.fuel)`
   3. `clanWar.ts:1426–1451` (`gatherContribution` — hem `quote` hem `contribute`), `2088` ve `2957`: Gezegen bacaklarında `honorFuelCost(leg.fuel, benefits)`; Anıt hedefinde `reserveMonumentHome(..., fuelPct)` ve `monumentFuelReserves(..., fuelPct)` + `monumentFuelBudget.fuelPct` kaydı + `priceMonumentReturn(..., budget.fuelPct)`.
   4. `monument.ts:584–588` (`preview` + `launch`), `monumentFuel.ts:7`, `monumentMovement.ts:200`, `monumentView.ts:272`: `monument_waves.fuel_pct = benefits?.fuelPct ?? 0` kaydet ve dönüş/görünümde `priceMonumentReturn(..., wave.fuelPct)` kullan.
   5. `intergalacticConvoyRaid.ts:299–323`: Zaten `benefits` okuyor ve `assertHonorBenefitsQuote` çağırıyor! Satır `299`'daki `fuel` hesabını `honorFuelCost(missionFuelForDistances(...), benefits)` yap (`assertFuel` zamlı yakıtı kontrol etmeli!).
   6. `trade.ts:321–336`: Zaten `benefits` okuyor ve `assertHonorBenefitsQuote` çağırıyor! Satır `321`'deki `fuel` hesabını `honorFuelCost(missionFuel(requested, reach, 2), benefits)` yap (`assertFuel` satır `322`'de `fuel + order.give.deuterium` kontrolünü zamlı yakıtla yapmalı!).
   7. `movement.ts:374–386` (`launchTransfer`): Her bacağı (`outbound` ve varsa `returning`) `honorFuelCost(..., benefits)` ile topla.
   8. `movement.ts:513–525` (`launchSettlement`): `honorFuelCost(missionFuel(fleet, dist, 1), benefits)`.
   9. `clanAid.ts:408` (önizleme) ve `527` (kalkış): İkisinde de `honorFuelCost(..., benefits)`.
   10. `clanSupport.ts:326` (`gatherSupport` — `quote` ve `send` ortak): `honorLaunchFuel(supportFuel(input.fleet, dist), benefits, escort.bonuses?.fuel)`.
   11. `unknownSignal.ts:192` ve `moonMovement.ts:324` (`jumpMoonFleet`): `honorFuelCost(..., benefits)`.
   - **Muafiyet Kontrolü:** `packages/rules/src/escape.ts:71` (`escapeFuel`) **kesinlikle değiştirilmeyecek!**
2. **Route Şemaları (`apps/server/src/routes/`):**
   - Mevcut `planet.ts:430–435` (tamir), `trade.ts:38`, `intergalacticConvoy.ts:34` içindeki `expectedHonorTier` Zod birleşimlerini `-4 | -3 | -2 | -1 | 0 | 1 | 2` olarak güncelle; diğer kalkış route şemalarına da opsiyonel `expectedHonorTier` ekle.
3. **`attackProtection.ts:485–492` — Kalkan (`3`s) vs Koloni Arızası (`4`s) Ayrımı:**
   - Satır `488–492`'deki `const earned = earnsRecoveryShield({ ... })` çağrısına açıkça `{ ...STANDARD_PVP_BALANCE, recoveryLossHours: FAULT.heavyDefeatLossHours }` (`4` saat) balance nesnesini ver! Aksi halde `STANDARD_PVP_BALANCE.recoveryLossHours` `3` olacağı için `3.0–3.99` saatlik kayıplar koloni arızası üretir!
4. **Botlar (`apps/server/src/services/bots/brain.ts` & `judgement.ts`):**
   - `judgement.ts:179` ve `brain.ts` içindeki yakıt yeterlilik kontrollerine `view.honorBenefits` (`honorFuelCost`) geçir; böylece negatif Honor'a düşen bir bot yetersiz döteryumla kalkış deneyip hata almaz.

---

### 2.6 Görsel Varlıklar, Web İstemcisi, i18n ve Wiki (`apps/web/`)

1. **Rozet Üretimi (`honor-m3.webp`, `honor-m4.webp`):**
   - `~/Desktop/Coding/MyProjects/game-assets/library/icons/badges/military-combat-hud/` altındaki Synty katmanlarından mevcut `apps/web/public/assets/ui/honor/honor-m2.webp` (128 px yükseklik) ile aynı boyutta iki yeni rozet birleştir:
     - `honor-m3.webp`: koyu kızıl zemin + kararmış metal çerçeve + kafatası/çapraz kemik katmanı.
     - `honor-m4.webp`: siyah/kor kızıl zemin + ağır köşeli/kanatlı çerçeve + kafatası amblemi.
   - `apps/web/src/game-ui/ranks.tsx:16` `HONOR_ART` nesnesine `[-3]` ve `[-4]` girdilerini gerçek genişlik/yükseklik (`height: 128`) değerleriyle ekle.
   - `CREDITS.md` ve `~/Desktop/Coding/MyProjects/game-assets/usage.json` dosyasına kaynak katmanları ekle ve `python3 -I tools/ingest.py` çalıştır.
2. **API Şemaları (`apps/web/src/api/schemas.ts:40–78`):**
   - `honorBenefitsSchema`: `version: 1` (`negative` 2'li tuple, `tier: -2..2`) ve `version: 2` (`negative` 4'lü tuple, `tier: -4..2`, `fuelPct: 0 | 25`, `productionPct: 0 | -25`) kabul edecek şekilde güncelle (V1 parse edilirken `fuelPct: 0, productionPct: 0` normalize edilebilir veya birleşim korunur).
   - `honorTargetSchema`: `eligible: true` koluna opsiyonel `priorWeakCount: z.number().int().nonnegative().optional()` ve `weakMultiplier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional()` ekle.
3. **`HonorBenefits.tsx` (`apps/web/src/ui/HonorBenefits.tsx`):**
   - `tiers` dizisini `value.version === 1 ? [2, 1, 0, -1, -2] : [2, 1, 0, -1, -2, -3, -4]` yap.
   - Satır `39–48` arasındaki `range(tier)` ve `next` hesaplarını yalnız `-1/-2` varsayımından çıkarıp genel indeks formülüne geçir:
     - En alt negatif kademe (`minTier = -n.length`): `atMost(-n[n.length - 1])`
     - Ara negatif kademeler (`tier < 0 && tier > minTier`): `negativeRange(-n[Math.abs(tier)], -n[Math.abs(tier) - 1])`
     - `climb`: `nextTier = (value.tier + 1) as HonorBenefitTier`, eşik `honorScore(-n[Math.abs(value.tier) - 1])`.
   - 350 px genişlikte 5 sütunun yan yana taşmaması için (`UI-14`) etkileri kompakt etiket/satır düzeniyle render et.
4. **`HonorTargetCard.tsx` (`LaunchSheet.tsx` + `FocusPanel.tsx` EMP + `RadiationBombControls.tsx`):**
   - `value.kind === 'WEAK' && (value.weakMultiplier ?? 1) >= 2` olduğunda `data-honor-escalated-warning` özniteliği ve `data-tone="hostile"` stiliyle kademeli uyarıyı göster (`priorWeakCount >= 1` ise önceki saldırıda negatif Honor alındığını ve `{{multiplier}}×` katlanacağını; `priorWeakCount === 0` ise yoldaki filoyla birlikte `{{multiplier}}×` olacağını belirt).
   - Düşman oyuncunun gezegenine hedeflenen EMP (`FocusPanel.tsx` `StrikeSheet`) ve Radyasyon Bombası (`RadiationBombControls.tsx`) hazırlık görünümlerinde de `useHonorTarget(targetPlanetId)` ile bu uyarı kartını göster.
5. **İstemci Yakıt ve Üretim Gösterimi:**
   - `admiralEscort.ts:34`, `useLaunchPlan.ts`, `navigation.ts`, `unknownSignal.ts`, `TransferSheet.tsx:273`, `SettlementSheet.tsx:54`, `FocusPanel.tsx:746`, `ClanScreen.tsx:1412`, `TradeSheet.tsx`, `IntergalacticConvoySheet.tsx` ve `MoonPanel.tsx:606` noktalarında `planet.honorBenefits` üzerinden `honorLaunchFuel` / `honorFuelCost` kullan; `fuelPct > 0` iken yakıt satırının yanında `+%25` Honor yaptırım bilgisini ve ⓘ dökümünü göster.
   - `PlanetScreen.tsx` / kaynak başlığında `planet.honorBenefits?.productionPct < 0` iken saatlik üretimde `data-tone="hostile"` işareti ve ⓘ açıklamasını göster.
6. **6 Dil i18n (`tr, en, de, es, fr, ja`) ve Wiki (`wiki/{facts,guides,updates}.ts`):**
   - `locales/*/honorBenefits.ts`: `fuel` ("Filo yakıtı"), `production` ("Saatlik üretim") başlıkları ve güncellenen `rules` açıklaması.
   - `locales/*/shell.ts`: `honorTarget.escalatedWeak` ve `honorTarget.escalatedInFlight` uyarı metinleri.
   - `locales/*/errors.ts`: `BASH_LIMIT` metnini `{{hours}}` ve `{{limit}}` parametreleriyle netleştir (*"Bir komutana {{hours}} saatte en fazla {{limit}} saldırı gönderebilirsin"*).
   - `wiki/facts.ts:175, 193, 201–202`: Yağma ve kalkan tablolarını 3 kademeye (`Tier 1–3`, `Tier 4–5`, `Tier 6+`) çıkar; bireysel akın bekleme satırını `1–4` (`ABUSE.personalRaidProtectedTier`) yap.
   - `wiki/updates.ts` ve `docs/game-design.md`: Oyuncu duyurusunu ve tasarım dokümanını güncelle.

---

## 3. Nelere Dikkat Edilmeli? — 12 Kritik Tuzak (Kırmızı Çizgiler)

1. **TUZAK 1 — `settleHonor` İçinde Gezegen Kilitleme (Deadlock & Finalizer Hatası):**
   - `settleHonor` (`honorLedger.ts`), `finalizers.ts` içindeki `'accounting'` fazında (tüm oyun kilitlerinden **sonra**) çalışır. Burada `planets` satırına `FOR UPDATE` almak kilit sırasını (`season → planets → players → honorSeasons`) tersine çevirip Postgres deadlock üretir; `beforeCommit` çağırmak ise `'A finalizer cannot schedule more transaction work'` hatası fırlatır!
   - **Doğrusu:** Sadece `schedule(tx, { kind: 'honor_penalty_sync', ... })` ile `scheduled_events` tablosuna satır ekle; gezegen kilitlemeyi worker kendi temiz transaction'ında yapsın.
2. **TUZAK 2 — `event_kind` Enum Sırası ve `TRANSFER_EVENT_POLICIES`:**
   - `clan-support-schema.test.ts:102` enum değerlerinin **append-only** olduğunu test eder; `'honor_penalty_sync'` değerini `eventKind` dizisinin ortasına koyarsan test patlar — **en sona** ekle.
   - `transfer-events.test.ts:7` her `eventKind` değerinin `TRANSFER_EVENT_POLICIES` (`transferReferences.ts`) içinde bulunmasını zorunlu tutar — `honor_penalty_sync: 'BLOCKER'` eklemeyi unutma.
3. **TUZAK 3 — `GET /api/planet` Okuma Kilidi ve Sorgu Bütçesi:**
   - `planet-read-locks.test.ts` ve `query-budget.test.ts`, okuma uçlarında ek SQL sorgusu atılmasını veya `FOR UPDATE` alınmasını yasaklar. `GET` yolunda **sadece** `planets.honor_production_share` sütununu oku; alt-seçim sorgusunu yalnız `options.mutate === true` iken mevcut `shards` sorgusunun (`planet.ts:556`) içine göm.
4. **TUZAK 4 — `loadPlanetViewStates` Unutulması (`/api/planets` Tutarsızlığı):**
   - Tekli gezegen `/api/planet` `loadPlanetState` kullanırken, çoklu gezegen `/api/planets` `loadPlanetViewStates` (`planet.ts:668`) kullanır. Her ikisinde de `PlanetInputs.honorProductionShare = row.honorProductionShare` geçirilmelidir.
5. **TUZAK 5 — Kapasite Tavanlarının ve Kalkan Paydasının Küçülmesi:**
   - `-%25` üretim cezası `alloyRate` / `crystalRate` / `deuteriumRate` veya `nominalA/C/D` üstüne uygulanırsa oyuncunun Depo ve Havuz kapasitesi `%25` küçülür (mevcut maden silinir) ve `commanderProductionRate` (`attackProtection.ts:180`) küçüleceği için zorba oyuncu Toparlanma Kalkanını `%25` daha kolay kazanır! Ceza **yalnız** `advanceEconomy` içindeki `ra/rc/rd` ve `planetView` içindeki `perHour*` akış hızına uygulanmalıdır.
6. **TUZAK 6 — Koloni Arızası Eşiğinin Yanlışlıkla `3` Saate İnmesi:**
   - `attackProtection.ts:487` koloni arızası (`earned`) hesabında `earnsRecoveryShield` fonksiyonunu parametresiz çağırıyordu (varsayılanı `STANDARD_PVP_BALANCE.recoveryLossHours`). Bu sabit `4`'ten `3`'e inince `earned` çağrısına açıkça `FAULT.heavyDefeatLossHours` (`4`) geçirilmezse savunmacıların kolonileri daha küçük saldırılarda bozulmaya başlar!
7. **TUZAK 7 — SQL Migration'da Kör `UPDATE honor_seasons` Yapmak:**
   - Mevcut `honor-successor.test.ts` ve `honor-benefits.test.ts` yeni test sezonlarının `benefitsVersion = null` başlamasını ve `enableHonorBenefits` ile açılmasını test eder. Canlı sezon yükseltmesini SQL migration veya `createSeason` içinde körlemesine değil, sunucu açılış kancası `ensureMainHonorRankings` (`honorActivation.ts:123`) üzerinden `enableHonorBenefits` çağırarak yap.
8. **TUZAK 8 — Anıt (`Monument`) Lotlarının Silinip Yazılması ve Dönüş İadesi:**
   - `replaceWaveLots` (`monumentMovement.ts:61`) her adımda `monument_ship_lots` satırlarını silip yeniden insert eder. Donmuş `fuelPct` bilgisini lot tablosunda değil `monument_waves.fuel_pct` ve `clan_war_contributions.monument_fuel_budget` içinde sakla; `monumentView.ts:272` ve `clanWar.ts:2088, 2957` içindeki `priceMonumentReturn` çağrılarına mutlaka geçir.
9. **TUZAK 9 — İstemci vs. Sunucu Amiral Yakıt Yuvarlama Sırası:**
   - İstemcide `admiralEscort.ts:34` ve sunucuda `mission.ts:420` ayrı ayrı `Math.ceil` yaparsa `1` döteryum fark oluşur. Her yerde `@astera/rules` içindeki `honorLaunchFuel` fonksiyonunu kullan.
10. **TUZAK 10 — Canlı Sezon `replayHonor` Geçmiş Bozulması ve Stratejik Silahlar:**
    - `1× / 2× / 3×` çarpanını doğrudan eski sabitin üstüne yazarsan canlı sezonda `replayHonor` çalıştığında geçmiş savaşların puanları değişir. Mutlaka `weakRepeatScale: 100` alanıyla kalkışta dondur ve `honorBattleEvidence.ts` yanında **`strategicHonorEvidence` (`honorStrategic.ts:32`)** ile **`honorAccounting.ts` içindeki 5 noktanın tamamına** taşı.
11. **TUZAK 11 — Geri Çağrılan Filoların `honorTarget.ts` İçinde Aktif Sayılması:**
    - İptal edilip eve dönen bir `'attack'` görevi `status = 'in_flight'` kalır ama `recalledAt !== null` olur. `honorTarget.ts:51` sorgusunda `isNull(missions.recalledAt)` mutlaka bulunmalıdır.
12. **TUZAK 12 — Görev Honor Tablosu Adı (`honor_quest_totals`):**
    - Yakın tarihli `0267` migration'ı ile günlük görev Honor puanları `players` tablosundan `honor_quest_totals` (`honorQuestTotals.micros`) tablosuna taşındı. Alt-seçimlerde `honor_quest_totals` kullan.

---

## 4. Zorunlu TDD Test Planı ve Çalıştırma Komutları

Her adımda önce ilgili test dosyası güncellenir/eklenir, hedefli komutla **FAIL** doğrulanır, kod yazılır ve **PASS** doğrulanır:

```bash
# Tekil rules testi çalıştırma örneği (1 worker, düşük bellek):
NODE_OPTIONS="--max-old-space-size=1024" node tools/heavy.mjs pnpm --filter @astera/rules exec vitest run test/honor-benefits.test.ts

# Tekil server testi çalıştırma örneği:
NODE_OPTIONS="--max-old-space-size=1024" node tools/heavy.mjs pnpm --filter @astera/server exec vitest run test/honor-benefits.test.ts --poolOptions.forks.maxForks=1

# Tekil web testi çalıştırma örneği:
NODE_OPTIONS="--max-old-space-size=1024" node tools/heavy.mjs pnpm --filter @astera/web exec vitest run test/honor-target-card.test.tsx
```

### Test Matrisi
- **R1 (`packages/rules/test/honor-benefits.test.ts`):** V1 (`[-2..2]`) korunumu; V2 (`-25, -50, -150, -200` ve `+25, +75`) tam sınır geçişleri (`-24_999_999`, `-25_000_000`, `-50_000_000`, `-150_000_000`, `-200_000_000`); `fuelPct` ve `productionPct`.
- **R2 (`packages/rules/test/honor-benefits.test.ts`):** `honorFuelCost` ve `honorLaunchFuel` (`0 → 0`, `6` yakıt + `0.85` amiral + `+%25` → `8`, parçalama değişmezi `split >= combined`, `MAX_SAFE_INTEGER` güvenliği).
- **R3 (`packages/rules/test/monument-fuel.test.ts`):** `fuelPct: 25` ile rezerv ve dönüş hesabı (`fuel <= reserve`, `+%25` iade edilmez).
- **R4 (`packages/rules/test/economy*.test.ts`):** `honorProductionShare: -0.25` ile 3 kaynakta `%25` üretim düşüşü; `collectorCap`, `storageCap`, `vaultProtects` ve `VAULT_LEAK` değişmezliği; `clanBonus` ve `pace` çarpımı.
- **R5 (`packages/rules/test/low-tier-pvp.test.ts`, `foundations.test.ts`):** `Tier 1–3` (`%25/%12,5`, `2`s), `Tier 4–5` (`%45/%22,5`, Havuz `%22,5/%11,25`, `3`s), `Tier 6+` & `null` (`%60/%30`, `3`s); `personalRaidProtectedTier === 4`, `bashLimit === 2`, `CLAN.attackLimit === 3`, `FAULT.heavyDefeatLossHours === 4`.
- **R6 (`packages/rules/test/{honor,honor-tactical,honor-team}.test.ts`):** `weakRepeatScale` yokken `1.0×/1.5×/2.0×`; `weakRepeatScale: 100` iken `1×/2×/3×` (tavan `3×`).
- **S1–S3 (`apps/server/test/`):** 11 filo kalkış kanalında ve `quote` uçlarında `+%25` yakıt kesintisi, `INSUFFICIENT_FUEL`, Amiral sırası, `escapeFuel` muafiyeti ve `expectedHonorTier` uyuşmazlığında `HONOR_QUOTE_CHANGED` (409).
- **S4 (`apps/server/test/`):** Savaşta `Tier -4`'e düşüşte `honor_penalty_sync` ile çevrimdışı zaman dilimi doğruluğu (`%100` → `%75`), `/api/planet` ve `/api/planets` eşliği, günlük görevle `-200` üstüne çıkışta `%100`'e dönüş, gezegen el değiştirme.
- **S5–S6 (`apps/server/test/low-tier-pvp.test.ts`, `clan-war-battle.test.ts`, `pvp-model-parity.test.ts`):** 3 kademeli yağma ve sonda `takeable` eşliği; `3.2` saat kayıpta **12 saat kalkan verilir ama koloni arızası oluşmaz**, `4.0+` saat kayıpta arıza oluşur; `Tier 1–4` 12s/1 bekleme, `Tier 5+` 12s/2 bash, `Klan` 12s/3 limit.
- **S7 (`apps/server/test/`):** `ensureMainHonorRankings` V1→V2 canlı geçişi, `honor-successor.test.ts`, `transfer-events.test.ts`, `clan-support-schema.test.ts`, `schema-drift.test.ts`, `planet-read-locks.test.ts`, `query-budget.test.ts`, `contract.test.ts` ve bot yakıt testleri.
- **S8 (`apps/server/test/{honor-accounting,honor-emp,honor-radiation-bomb,honor-target}*.test.ts`):** Normal ve stratejik silahlarda `1×/2×/3×`, karışık eski+yeni `replayHonor`, `honorTargetPreview` içinde `recalledAt` filtresi ve `priorWeakCount` / `weakMultiplier: 2 | 3`.
- **W1–W5 (`apps/web/test/` + Görsel Kontrol):** V1+V2 şema testleri, `HonorBenefits.tsx` 7 basamak ve aralık metinleri, `HonorTargetCard.tsx` `2×/3×` uyarı render testi, kalkış pencereleri yakıt ve `PlanetScreen` üretim kesinti göstergeleri, 6 dil `i18n.test.ts` + Wiki testleri ve `node tools/visual.mjs --honor-benefits` / `--honor-fair` (350 px mobil doğrulama).

---

## 5. Uygulama Defteri (Adım Adım İcra Sırası)

Her adımı tamamladıkça `⬜` işaretini `✅` olarak güncelle ve sapma olduysa altına tek satır not düş:

| # | Adım | Doğrulama Kapısı | Durum |
|---|---|---|---|
| **1** | **Rules Katmanı (§2.1):** Önce R1–R6 testlerini yaz (`FAIL`), ardından `honorBenefits.ts`, `honor.ts`, `honorTactical.ts`, `honorTeam.ts`, `monumentFuel.ts`, `economy.ts`, `pvpBalance.ts`, `constants.ts`, `clan.ts` güncellemelerini uygula (`PASS`). | `packages/rules` ilgili tüm testler yeşil | ✅ |
| **2** | **Şema & Migration (§2.2):** `schema.ts`, `transferReferences.ts` ve yeni SQL migration + snapshot/journal oluştur; `schema-drift`, `clan-support-schema` ve `transfer-events` testlerini doğrula. | Şema ve migration testleri yeşil | ✅ |
| **3** | **Server — Honor `1×/2×/3×` & Hedef Önizleme (§2.3):** Önce S8 testlerini yaz (`FAIL`), ardından `honorAccounting.ts`, `honorCommitment.ts`, `honorBattleEvidence.ts`, `honorStrategic.ts`, `honorTarget.ts` uygula (`PASS`). | Honor muhasebe, stratejik, replay ve target testleri yeşil | ✅ |
| **4** | **Server — `-%25` Üretim & Canlı Sezon V2 (§2.4):** Önce S4 ve S7 testlerini yaz (`FAIL`), ardından `honorBenefits.ts`, `honorActivation.ts`, `honorProgram.ts`, `planet.ts` (`loadPlanetState` + `loadPlanetViewStates`), `planetView.ts`, `session.ts`, `adminPlayers.ts`, `intel.ts`, `ownership.ts`, `loyalty.ts`, `reclaim.ts`, `honorLedger.ts`, `dailyQuests.ts`, `handlers.ts` uygula (`PASS`). | Üretim, sezon geçişi, `planet-read-locks` ve `query-budget` yeşil | ✅ |
| **5** | **Server — `+%25` Yakıt (11 Kanal), Kalkan/Arıza, Yağma & Bash (§2.5):** Önce S1–S3, S5–S6 testlerini yaz (`FAIL`), ardından 11 kalkış servisi + route şemaları + `attackProtection.ts` + `bots/{brain,judgement}.ts` uygula (`PASS`). | Yakıt, kalkan, yağma, bash, bot ve `contract.test.ts` yeşil | ✅ |
| **6** | **Görsel Rozetler (§2.6.1):** `game-assets` Synty katmanlarından `honor-m3.webp` ve `honor-m4.webp` üret, `ranks.tsx`, `CREDITS.md` ve `game-assets/usage.json` (`ingest.py`) güncelle. | `ranks.test.tsx` yeşil | ✅ |
| **7** | **Web, 6 Dil i18n & Wiki (§2.6.2–6):** Önce W1–W4 testlerini yaz (`FAIL`), ardından `schemas.ts`, `HonorBenefits.tsx`, `HonorTargetCard.tsx`, `admiralEscort.ts`, tüm kalkış sheet'leri, `PlanetScreen`, 6 dil `locales/*` ve `wiki/{facts,guides,updates}.ts` uygula (`PASS`). | Web birim, şema, Wiki ve 6 dil eşlik testleri yeşil | ✅ |
| **8** | **Görsel Doğrulama, Dokümanlar & Tam Regresyon:** `docs/game-design.md` güncelle, `node tools/visual.mjs --honor-benefits` ve `--honor-fair` ile 350 px mobil kontrol yap, `game-dev-handbook/checklists.md` maddelerini geçir ve `pnpm verify` çalıştır. | Sıfır type hatası, sıfır lint hatası, tüm testler yeşil | ✅ |

---

## 6. Referans El Kitabı İlkeleri (`game-dev-handbook`) ve Değişen Dokümanlar

- **Uygulanan İlkeler:** `DI-01` (sürtünme vs. zorluk), `DI-02` (kalkış öncesi `2×/3×` görünür uyarı ve net `BASH_LIMIT` mesajı), `DI-10` (`%25 → %45 → %60` kademeli yağma eğrisi), `SB-04` (`honorLaunchFuel` tekil uygulama ve nominal kapasite koruması), `SB-07` (yakıt, `pvpBalance` ve `weakRepeatScale` snapshot; üretim live recalculation), `SB-12` (`escapeFuel` taktik kaçış muafiyeti), `SB-18` (ayrı çarpan kovaları ve tekil son yuvarlama), `PE-09` (zorba döteryum gideri `+%25` / kaynak üretimi `-%25`), `UI-01`, `UI-08`, `UI-12`, `UI-14` (rozet + işaretli sayı, `expectedHonorTier` onayı, 350 px mobil uyum), `ML-01` (`V1`/`V2` sürümlü yapılandırma).
- **Güncellenecek Tasarım Bölümleri (`docs/game-design.md`):**
  1. *Ordinary raids involving tier 1–3 commanders (2026-10-12)* → `Tier 1–4: 12s/1`, `Tier 5+: 12s/2`, `Klan: 12s/3`.
  2. *The recovery shield — commander tiers (2026-10-16)* → 3 kademeli yağma (`%25 / %45 / %60`) ve `Tier 4+` `3` saatlik kalkan eşiği (`4` saat koloni arızası korunumu).
  3. *Honor fair-fight table & benefits* → `1× / 2× / 3×` zorbalık tekrar çarpanı ve `Honor Benefits V2` (`-25 / -50 / -150 / -200`).
