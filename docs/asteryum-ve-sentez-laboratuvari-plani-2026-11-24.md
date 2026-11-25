# Asteryum ve Sentez Laboratuvarı — geliştirme planı (2026-11-24)

> Bağlam sıkışırsa veya yeni oturumda önce **§10 Uygulama defteri**ni oku.
> Durum: plan onaylandı; owner netleştirmeleri 2026-11-25 (K6, K11 güncellendi, K13 eklendi). Uygulama worktree `../blindspace-asterium`, branch `feat/asterium-synthesis`, taban `61969187` (canlıda çalışan sürüm).

---

## 1. Tek cümlelik kural

> **Asteryum, yalnızca günlük 1 saatlik Yarık etkinliğinden ve Ay'ların pasif üretiminden elde edilen özel bir stratejik kaynaktır; Başkent'teki Sentez Laboratuvarı'nda (KM 10) zaman ve kaynakla üretilen kapsüller, filo alanına (`hangarLoad`) göre tüketilerek kalkışta filoya harita gizliliği (Optik Örtü) veya saldırı alarmı susturma (Sessiz İtki) kazandırır.**

İki kapsül birbirinden tamamen bağımsız iki istihbarat katmanını hedefler:

- **Optik Örtü:** Filoyu galaksi haritasında sahibi ve klanı dışındaki herkesten (Teleskop, çıplak göz ve Radar `?` kontağı) gizler.
- **Sessiz İtki:** Harita görünürlüğüne dokunmaz; yalnızca hedef gezegene giden saldırı bildirimlerini (Radar uyarısı, Klan Alarmı, Bildirim Merkezi ücretli uyarısı ve haritadaki kırmızı "sana geliyor" işareti) susturur.

Sistem veri-güdümlü bir kapsül kataloğu (`EN-20`) üzerine kurulur; ileride doğrudan gezegene, Ay'a veya başka filo kurallarına uygulanan kapsüller veritabanı şemasını kırmadan eklenebilir.

---

## 2. Owner kararları (2026-11-24)

| # | Karar | Seçilen |
|---|---|---|
| K1 | İsimlendirme | Kaynak: **Asteryum** · Sayfa: **Sentez Laboratuvarı** · Ürün sınıfı: **Kapsül** · 1. Ürün: **Optik Örtü** · 2. Ürün: **Sessiz İtki**. |
| K2 | Asteryum depolama | Oyuncu/Başkent bazlı özel stratejik sezonluk stok. Alaşım/Kristal/Döteryum gibi koloni madenlerine, filo kargosuna, enkaza veya ticarete bulaşmaz; **saldırıyla yağmalanamaz**. Sezon sonunda sıfırlanır. |
| K3 | Yarık etkinliği | Sunucu saatine göre sabit günlük 1 saat (**21:00–22:00 TR**, sunucu konfigürasyonu ile ayarlanabilir), geri sayım ve başlama duyurusu/bildirimi. Sadece bu pencerede Yarık'ta Asteryum spawn olur; oyuncu toplayıp çıkıştan kaçırırsa elde eder. |
| K4 | Ay üretimi | Ay'ı olan her oyuncu, Ay'ın nadirliğine göre (`COMMON < RARE < EPIC < LEGENDARY`) pasif Asteryum üretir; ayrı Ay binası yok. Başkent stoğuna akar. Ölüm Yıldızı Ay'ı 3 saat kapattığında (`closedUntil`) üretim durur. Birden fazla Ay'ın hepsi üretir. |
| K5 | Laboratuvar kilidi | Yalnızca Başkent'te, **Komuta Merkezi 10** kilidiyle açılır (Tier 4'e geçişi teşvik eder). |
| K6 | Üretim kuyruğu ve iptal | Aynı anda **en fazla 1 aktif üretim** (kuyruk yok). **Bir işte adet seçilir** (owner 2026-11-25): süre ve maliyet adetle çarpılır. Kapsüller birer birer, her biri kendi süresi dolunca envantere düşer. İptal edilebilir; iptalde **henüz üretilmemiş** kapsüllerin ödenen kaynaklarının **%50'si** iade edilir (üretilmiş olanlar envanterde kalır). |
| K7 | Envanter erişimi | Kapsüller oyuncu bazlı envanterde durur; koloni veya Ay'dan kalkan filolara uygulanması kodda zorla engellenmez (açık bırakılır). |
| K8 | Gizlenme ayrımı & birleştirme | **Optik Örtü** = galakside sahibi ve klanı dışında tam görünmezlik (Teleskop + Radar `?` yok). **Sessiz İtki** = hedef gezegene saldırı bildirimi gitmez, harita normaldir. **İkisi aynı filoya birlikte basılabilir** (maliyetleri ayrı ayrı ödenir). |
| K9 | İzinli görevler | `attack`, `clan_war` (operasyon lideri basar), `transfer`, `settlement`. Ölüm Yıldızı (`death_star`), radyasyon bombası ve sonda gibi görevlerde **yasak**. |
| K10 | Yaşam döngüsü & bozulma | Süre sınırı yok; **ilk bacak (gidiş)** boyunca geçerlidir, saldırı/varış anında bozulur (savaş sonrası dönüş normal görünür). Geri çağırılabilen görevlerde iptalde kapsül yanmaz/iade edilmez, etki bozulmaz — filo dönüşte de gizli kalır ve eve inince biter. |
| K11 | Karşı önlem, Gözcü, Rapor | İlk sürümde karşı önlem yok (%100 tutarlı gizlilik). **Optik Örtülü filoyu hiçbir Ay Gözcüsü görmez**, Efsanevi (delen) Gözcü dahil (owner 2026-11-25 netleştirmesi: "ek mantık yok" = sayaç yok; yalnız sahibi ve klanı görür). **Savaş raporunda** saldırganın hangi kapsülü kullandığı savunana gösterilir (`DI-02`). |
| K12 | Ölçek ve açılış | İki kapsül de **500 bulk (`hangarLoad`) / 1 kapsül** (`ceil(bulk / 500)`). **Canlı sezonda açılacak** (duyuru + güvenli başlatma gerekir). |
| K13 | Üretim süreleri (2026-11-25) | Kapsül başına **Optik Örtü 30 dk**, **Sessiz İtki 60 dk** (eski 3 sa / 4 sa). Klan savaşında **birleşik filonun tamamını lider öder** (K9 teyit; katılımcı payı ileride düşünülür). |

---

## 3. Sistem tasarımı ve mekanikler

### 3.1 Asteryum (özel stratejik kaynak)

- **Kapsam:** Sezonluk (`player_id` bazlı). Sezon değişiminde tüm sezonluk kaynaklar gibi sıfırlanır.
- **Yalıtım:** `Resources` (`{ alloy, crystal, deuterium }`) arayüzüne eklenmez; kargo, yağma (`loot`), enkaz (`salvage`), koloni madenleri, ticaret, klan hazinesi ve onur/servet (`wealth`) hesaplarına dahil edilmez. Böylece blast radius minimumda kalır ve Asteryum oyun içinde nadir/stratejik kimliğini korur.
- **Saklama:** Başkent'teki Sentez Laboratuvarı'nda (KM 10 altı oyuncularda da biriken bakiye görünür) tamsayı birim olarak tutulur.

### 3.2 Elde etme yolu 1 — Günlük 1 saatlik Yarık etkinliği

> **Mimari karar (2026-11-25):** Etkinlik ayrı bir zamanlayıcı yerine mevcut galaksi etkinlik takvimine 4. tür olarak eklenir: `ASTERIUM_STORM`, `GALAXY_EVENTS.definitions` içinde `FIXED_DAILY` ve her gün 21:00–22:00 TRT (`GALAXY_EVENT_KINDS` dizisinin **sonuna** eklenir, D156). Böylece başlama/bitiş bildirimi (`processGalaxyEventLifecycle`), HUD'daki sıradaki etkinlik sayacı (`nextPublicGalaxyEvent`, `ContextSlot`), etkinlik rehberi (`GalaxyEventsGuide`) ve canlı sezona alma (`pnpm season adopt-event-calendar`, K12) hazır gelir. Yarık sunucusu aktif pencereyi bu takvimden okur. Saat değişikliği yeni takvim sürümü ve `adopt` ile yapılır (ML-01). Aşağıdaki `asteriumEventWindow` saf fonksiyonu ve `asterium_event_started` bildirimi bu yüzden **yazılmaz**.

- **Zaman penceresi:** Varsayılan her gün `21:00–22:00 Europe/Istanbul` (env / sunucu konfigürasyonu ile kaydırılabilir, `ML-01`). İstemciye bir sonraki açılış veya kalan bitiş anı ISO timestamp olarak verilir (`asteriumEvent: { active, startsAt, endsAt }`).
- **Yarık içi spawn ve toplama:**
  - `packages/rules/src/arena/farms.ts` içindeki `FARM_KINDS` listesine 4. tür olarak `'asterium'` (index `3`) eklenir.
  - Etkinlik aktif değilken Yarık'ta hiç Asteryum alanı/parçası spawn olmaz.
  - Etkinlik başladığında haritada belirli ağırlıkla (nadir ve sıcak bölgelerde) Asteryum parçaları spawn olmaya başlar.
  - Ambar (cargo) alanı normal kaynaklarla paylaşılır; bir parça az adet ama yüksek değer taşır (örn. parça başına 1–2 Asteryum, hedef: aktif ve başarılı kaçış yapan bir pilotun 1 saatte ortalama **6–15 Asteryum** çıkarabilmesi).
  - **PvP riski:** Pilot ölürse ambarındaki Asteryum (mevcut ölüm drop mekaniğiyle) uzaya saçılır; rakip pilotlar toplayıp kendi çıkışlarına götürebilir.
  - **Çıkış ve yatırım:** Çıkış kapısından sağ çıkan pilotun `hold[3]` (Asteryum) miktarı **günlük `capHours` tavanına takılmadan** 1:1 oyuncunun Asteryum stoğuna yazılır (`arena_ships` üzerindeki normal `sent_alloy/crystal/deuterium` tavanı yalnızca Başkent madenleriyle sınırlıdır).
  - **22:00 bitiş anı adaleti:** Saat 22:00:00'da yeni Asteryum spawn'ı durur; ancak o anda Yarık içinde olan ve ambarında Asteryum taşıyan pilotların yükü silinmez — çıkış kapısına ulaşırlarsa güvenle Başkent'e indirirler.
  - **Deploy-recall (KG-A15):** Geri çağrılan gemide kalan Asteryum `arena_ships.hold_asterium` sütununda korunur.
- **Bildirim & duyuru:** Etkinlik başlamadan 15 dk önce isteğe bağlı hatırlatma ve tam başlangıçta uygulama içi duyuru + bildirim gönderilir (`asterium_event_started`). Yarık giriş kartı ve ana HUD'da canlı geri sayım / "ŞU AN AKTİF" şeridi gösterilir.

### 3.3 Elde etme yolu 2 — Ay pasif üretimi

- **Nadirliğe göre üretim hızı** (başlangıç dengesi, `packages/rules/src/synthesis.ts` tek kaynak):

| Ay Nadirliği | Günlük üretim | 1 Asteryum süresi |
|---|---|---|
| `COMMON` | **2 / gün** | 12 saat |
| `RARE` | **3 / gün** | 8 saat |
| `EPIC` | **4 / gün** | 6 saat |
| `LEGENDARY` | **6 / gün** | 4 saat |

- **Tembel (lazy) hesaplama — cron yok:**
  - `moons` tablosunda `asterium_synced_at` (timestamp) ve `asterium_fraction` (double precision, `[0, 1)`) tutulur.
  - Üretim sadece Ay açıkken işler: `effectiveElapsedMs = max(0, nowMs - max(syncedAtMs, closedUntilMs))` (Ay kapalıyken `closedUntil` sonrası başlar; detay aşağıda).
  - Hesap: `total = fraction + (effectiveElapsedMs / msPerUnit)`, `whole = Math.floor(total)`, `nextFraction = total - whole`.
  - `whole > 0` ise aynı transaction içinde `player_asterium.balance += whole` yazılır ve `moons` satırı güncellenir.
- **Ay yaşam döngüsü kancaları (sıfır sızıntı):**
  - **Ölüm Yıldızı Ay'ı vurduğunda (`strikeMoon`):** Önce `now` anına kadar biriken üretim mevcut sahibe yazılır, ardından `asterium_synced_at = closedUntil` (`now + 3 saat`) yapılır. Böylece 3 saatlik kapalılık süresinde 0 üretim olur, yeniden açıldığında otomatik devam eder.
  - **Dünya el değiştirir / devredilir / terk edilirse:** Sahiplik değişimi transaction'ında önce eski sahibe `now` anına kadar birikmiş üretim yazılır, ardından `asterium_fraction = 0`, `asterium_synced_at = now` olarak sıfırlanır.
  - **Ay patlarsa:** `moons` satırı silinir; o ana kadar Başkent'e aktarılmış Asteryum oyuncuda kalır.
  - **Yeni Ay doğar / kurulursa:** `asterium_synced_at = bornAt`, `asterium_fraction = 0`.
  - **Birden fazla Ay:** Oyuncunun tüm sahip olduğu dünyalardaki Ay'lar ayrı ayrı üretir ve hepsi oyuncunun tek Asteryum stoğuna akar.
  - **Canlı sezon açılışı:** Migration sırasında mevcut tüm `moons` satırlarına `asterium_synced_at = NOW()` yazılır; geriye dönük toplu Asteryum basılmaz.

### 3.4 Sentez Laboratuvarı ve genişletilebilir kapsül mimarisi

- **Konum ve kilit:** Başkent'te (`PlanetScreen` içinde ayrı sekme/ekran: **Sentez Laboratuvarı**). Başkent `CORE >= 10` olduğunda açılır (`SYNTHESIS.requiredCore = 10`).
  - KM 10 altında sayfa görünür ama kilitlidir: mevcut Asteryum bakiyesi, günlük Yarık etkinliği sayacı, Ay'lardan gelen pasif hız ve iki kapsülün önizlemesi *"Komuta Merkezi 10'da açılır"* işaretiyle gösterilir (`LD-11`, `CLAUDE.md §4.6`).
- **Veri-güdümlü genişletilebilir katalog (`EN-20`):**

```ts
export type CapsuleId = 'OPTIC_VEIL' | 'SILENT_THRUST';
export type CapsuleTarget = 'FLEET' | 'PLANET' | 'MOON';

export type CapsuleScaling =
  | { readonly kind: 'FLEET_BULK'; readonly bulkPerCapsule: number }
  | { readonly kind: 'FLAT'; readonly count: number };

export interface CapsuleDefinition {
  readonly id: CapsuleId;
  readonly target: CapsuleTarget;
  readonly stackGroup: string;
  readonly scaling: CapsuleScaling;
  readonly allowedMissions?: readonly MissionKind[];
  readonly cost: {
    readonly alloy: number;
    readonly crystal: number;
    readonly deuterium: number;
    readonly asterium: number;
  };
  readonly craftMinutes: number; // kapsül başına; bir iş `quantity × craftMinutes` sürer
  readonly cancelRefundRatio: number; // 0.5
}
```

- **Neden bu yapı geleceğe hazır?**
  - İleride gezegene doğrudan basılan bir kapsül (ör. *"6 saatlik geçici enerji/kalkan takviyesi"*) eklendiğinde: `CAPSULE_CATALOG`'a `target: 'PLANET'`, `scaling: { kind: 'FLAT', count: 1 }` ile yeni bir `CapsuleId` girer, mevcut `player_capsules` ve `synthesis_jobs` tabloları **değişmeden** çalışır; sadece `POST /api/synthesis/apply-planet` gibi hedefe özel tek bir uygulama akışı eklenir.
  - `stackGroup` alanı, farklı kategorilerdeki kapsüllerin aynı hedefe birlikte basılmasına izin verirken (örn. `OPTIC_VEIL` + `SILENT_THRUST`), aynı kapsülün iki kez eklenmesini tek kuralla engeller.

- **Üretim ve iptal kuralları:**
  - Aynı anda **en fazla 1 aktif iş** (`synthesis_jobs` tablosunda `player_id` primary key). İş bir **adet** taşır (`quantity`, 1…`SYNTHESIS.maxBatch`); süre ve maliyet adetle çarpılır.
  - **Birer birer teslim:** `delivered = min(quantity, floor((now - startedAt) / craftMinutes))`. Teslim edilen kapsüller okuma/harcama/iptal anında tembelce envantere yazılır (`synthesis_jobs.delivered` sütunu ile idempotent); son kapsül `completes_at` anında `synthesis_complete` olayıyla düşer.
  - Başlatırken Başkent kaynaklarından (`alloy`, `crystal`, `deuterium`) + oyuncu stoğundan (`asterium`) atomik olarak düşülür. (Önce oyuncunun Ay pasif Asteryum'u ve Başkent madenleri lazy-sync edilir!)
  - **Ödenen tutar dondurulur:** `synthesis_jobs` satırına `paid_alloy`, `paid_crystal`, `paid_deuterium`, `paid_asterium` yazılır.
  - **İptal (%50 iade):** Önce teslim edilmesi gerekenler teslim edilir; ardından **üretilmemiş adetlerin** payı (`paid × (quantity − delivered) / quantity`) üzerinden `Math.floor(pay * 0.5)` kadar alaşım, kristal, döteryum Başkent'e (depo tavanına dikkat: iade mevcut kaynak iptal deseniyle Başkent'e eklenir, overflow/buffer kuralı adım 0'da mevcut bina/gemi iptalinden doğrulanır) ve Asteryum oyuncu stoğuna iade edilir. İleride tarif fiyatları değişse bile iptal istismarı (`ML-06`) imkânsızdır.
  - **Sezon sonu sınırı:** `completesAt > season.endsAt` ise üretim başlatılamaz.
  - **Tempo çarpanı:** Süreler gerçek zamanlıdır (inşaat/tersane hızlandırıcılarından ayrı; başlangıçta kapsül başına 30 dk ve 60 dk (K13), istenirse ileride laboratuvar seviyesi/araştırma ile bağlanabilir).
  - **Tamamlanma:** `scheduled_events` üzerinde `synthesis_complete` olayı tetiklenir (işçi gecikirse okuma/harcama anında tembel tamamlama da çalışır — her ikisi aynı atomik `DELETE ... RETURNING` kilidini kullanır). Tamamlanınca kalan kapsüller envantere yazılır, satır silinir ve oyuncuya `synthesis_ready` bildirimi **bir kez** gider.

### 3.5 İlk iki kapsül — tarifler, alan ölçeği ve etki kuralları

#### Başlangıç tarifleri (KM 9–10 gerçek gelirine kalibre; canlı ölçümle ayarlanabilir)

| Kapsül | Kod ID | `stackGroup` | Alan birimi | Maliyet (1 kapsül) | Üretim süresi | İzinli görevler |
|---|---|---|---|---|---|---|
| **Optik Örtü** | `OPTIC_VEIL` | `FLEET_STEALTH_SIGHT` | **500 bulk** (`hangarLoad`) | **4 Asteryum** · 250 Döteryum · 3.000 Kristal · 2.000 Alaşım | **30 dk** | `attack`, `clan_war`, `transfer`, `settlement` |
| **Sessiz İtki** | `SILENT_THRUST` | `FLEET_STEALTH_RADAR` | **500 bulk** (`hangarLoad`) | **6 Asteryum** · 350 Döteryum · 2.000 Kristal · 4.000 Alaşım | **60 dk** | `attack`, `clan_war` *(saldırı bildirimi üreten görevler)* |

> **Önemli UX koruması:** `transfer` ve `settlement` görevleri zaten hedef gezegende düşman Radar saldırı bildirimi üretmez. Bu yüzden `SILENT_THRUST` yalnızca `attack` ve `clan_war` görevlerinde seçilebilir; oyuncunun yanlışlıkla dost transferde Sessiz İtki yakması engellenir.

#### Filo alanına göre adet hesabı

```ts
export function requiredCapsulesForFleet(capsuleId: CapsuleId, fleet: Fleet): number {
  const bulk = hangarLoad(fleet);
  if (bulk <= 0) return 0;
  const def = CAPSULE_CATALOG[capsuleId];
  if (def.scaling.kind !== 'FLEET_BULK') return def.scaling.count;
  return Math.ceil(bulk / def.scaling.bulkPerCapsule);
}
```

- Örnekler (500 bulk/kapsül):
  - 100 bulk küçük baskın → **1 kapsül**
  - 500 bulk filo → **1 kapsül**
  - 501 bulk filo → **2 kapsül**
  - 1.550 bulk (Rare Ay rıhtımı boyutu) → **4 kapsül**
  - 3.250 bulk (Epic Ay rıhtımı boyutu) → **7 kapsül**
  - Aynı 1.550 bulk filoya hem Optik Örtü hem Sessiz İtki basılırsa → **4 Optik Örtü + 4 Sessiz İtki** tüketilir.

#### Etki matrisi (kim ne görür, ne zaman bozulur)

| Durum | Kendi + Klanı (Galaksi Haritası) | Diğer Oyuncular & Hedef (Teleskop + Radar `?`) | Hedef Radar Bildirimi (`incoming_fleet`, Klan Alarmı, Ücretli Uyarı, `inbound: true`) |
|---|---|---|---|
| **Kapsül yok** | Görür | Mevcut `sensorZone` kuralı | Mevcut Radar kuralı |
| **Yalnız Optik Örtü** | Görür *(gizli uçuş rozetiyle)* | **GÖRMEZ** (`NONE` — ne Teleskop ne `?`) | **GİDER** *(mevcut Radar kuralıyla)* |
| **Yalnız Sessiz İtki** | Görür *(sessiz itki rozetiyle)* | Mevcut `sensorZone` kuralı *(ama kırmızı `inbound` işareti yok)* | **GİTMEZ** *(sıfır bildirim, sıfır klan alarmı, sıfır ücretli uyarı)* |
| **Optik Örtü + Sessiz İtki** | Görür *(çift gizlilik rozetiyle)* | **GÖRMEZ** | **GİTMEZ** |

#### Bozulma, varış, dönüş ve geri çağırma kuralları

1. **Saldırı / Varış (`arriveAt`):**
   - Filo hedefe ulaşıp savaşa girdiği an her iki kapsülün etkisi **bozulur ve biter**.
   - Savaş parlaması ve enkaz alanı herkese görünür (mevcut D52 kuralı korunur).
   - Savaş sonrasında oluşan normal dönüş görevi (`kind = 'return'`) **kapsülsüz** oluşturulur; eve dönen filo normal görüş kurallarına tabidir.
   - `transfer` ve `settlement` görevleri hedefe vardığında görev tamamlanır ve etki biter.
2. **Geri çağırma (Recall):**
   - **Düzeltme (2026-11-25):** `attack` ve `transfer` K8'den beri geri çağrılabilir (`recallFlight`, `apps/server/src/services/movement.ts:699`); `mission.ts:98`'deki "no recall" yorumu eskidir. Geri çağırma görev satırını yerinde günceller (`turnMissionHome`), böylece `applied_capsules` kendiliğinden korunur.
   - Geri çağırılabilen görevlerde (ve ileride recall eklenebilecek görevlerde) filo hedefe ulaşmadan geri çevrilirse: tüketilen kapsüller iade edilmez ama **etki bozulmaz** — dönüş bacağındaki görev satırı `applied_capsules` bilgisini korur ve filo gizli olarak eve döner; eve indiğinde (`resolved`) etki biter.
3. **Klan Savaşı (`clan_war` / `COMBINED_ATTACK`):**
   - Operasyon toplanırken (`ASSEMBLING`) gelen destek kolları normaldir.
   - Operasyon lideri birleşik saldırıyı başlatırken (`launchClanWarStrike`), lider kendi envanterinden **birleşik filonun toplam `hangarLoad`'ına göre** Optik Örtü ve/veya Sessiz İtki basabilir.
   - Quote ekranı birleşik bulk ve gereken kapsül adedini canlı gösterir; fırlatma transaction'ında liderin envanterinden atomik düşülür.
4. **Savaş raporu (`DI-02`):**
   - Savaş raporuna `appliedCapsules: CapsuleId[]` alanı yazılır.
   - Savunan ve saldırgan savaş raporunda kullandığı/maruz kaldığı gizlilik kapsüllerini açıkça görür (ör. *"Saldırgan bu operasyonda Optik Örtü ve Sessiz İtki kullandı"*). Böylece uyarı almayan savunan bunun bir hata/bug değil rakibin pahalı bir hamlesi olduğunu anlar.
5. **Ölüm Yıldızı, Radyasyon Bombası, Sonda, Ay Gözcüsü:**
   - Ölüm Yıldızı, radyasyon bombası ve sondaya kapsül basılamaz (`CAPSULE_MISSION_FORBIDDEN`).
   - **Ay Gözcüsü (K11, 2026-11-25):** `OPTIC_VEIL` aktif uçuş hiçbir Gözcü taramasında satır üretmez, Efsanevi delme dahil (`moonScan.ts` döngüsünde `missionHidesFromGalaxy` kontrolü). Rota dünyaları da (S53) bu uçuştan açılmaz. `SILENT_THRUST` tek başına Gözcü'yü etkilemez.

---

## 4. Teknik mimari, veritabanı şeması ve API

### 4.1 Pure kurallar (`packages/rules`)

Yeni modül: `packages/rules/src/synthesis.ts` (ve `index.ts` export):
- `SYNTHESIS`: `requiredCore: 10`, `cancelRefundRatio: 0.5`, `maxBatch: 20` *(Hangar 10 tam filosu 15 kapsül ister; tavan bunu tek işte karşılar)*, `bulkPerCapsule: 500`, `moonPerDay: { COMMON: 1, RARE: 1.5, EPIC: 2, LEGENDARY: 3 }` *(owner 2026-11-25 yarıya indirdi; ilk değer 2/3/4/6)*, `eventSchedule: { timeZone: 'Europe/Istanbul', startHour: 21, durationMinutes: 60 }`.
- `CAPSULE_CATALOG`, `CAPSULE_IDS`, `CapsuleId`, `AppliedCapsule`.
- `requiredCapsulesForFleet(capsuleId, fleet)`: `hangarLoad` tabanlı saf hesap.
- `validateMissionCapsules(missionKind, requestedIds)`: tekrar, `stackGroup` çakışması ve görev uyumluluğu kontrolü.
- `synthesisDelivered(job, nowMs)`: o ana kadar üretilmiş adet.
- `cancelRefund(paidCost, quantity, delivered)`: üretilmemiş pay üzerinden her kaynakta `Math.floor(pay * 0.5)`.
- `accrueMoonAsterium(input: { rarity, syncedAtMs, closedUntilMs, fraction, nowMs })`: saf tembel üretim hesabı → `{ gained, nextFraction, nextSyncedAtMs }`.
- `asteriumEventWindow(now, config)`: belirli bir `Date` anında etkinliğin aktif olup olmadığını, mevcut/sonraki `startsAt` ve `endsAt` değerlerini hesaplayan saf fonksiyon (DST/saat dilimi güvenli `Intl.DateTimeFormat` ile).
- `missionHidesFromGalaxy(appliedCapsules, isPostCombatReturn)`: `OPTIC_VEIL` aktiflik kuralı.
- `missionSuppressesRadarWarning(appliedCapsules)`: `SILENT_THRUST` aktiflik kuralı.

Arena kuralları (`packages/rules/src/arena/`):
- `farms.ts`: `FARM_KINDS = ['alloy', 'crystal', 'deuterium', 'asterium'] as const` ve `ASTERIUM_STORM` (pilot başına fırtına, G5). ~~`FARM_POINTS`, `ASTERIUM_FIELD_SPAWNS`~~: owner 2026-11-25 kaldırıldı (G4, G5).
- `world.ts`: `ArenaWorld.asteriumStorm`; Asteryum artık field respawn'dan çıkmaz, `stepAsteriumStorm` kendi 8 slotunda (`STORM_SLOTS`) merkezdeki boş noktalara büyütür (G5). Fırtına bitince yeni taş büyümez, sahadaki ve ambardaki taşlar silinmez.
- `economy.ts`: `extractAsterium(hold)` — `Math.floor(Math.max(0, hold[3] ?? 0))` (günlük `capHours` tavanına girmez).

### 4.2 Veritabanı şeması ve migration

> Not (2026-11-25): Canlı taban `61969187`'de son migration `0270_drop_arena_pilots.sql`. Probe bataryası sürümü (`../blindspace-probe-release`) `0271` alıyor. Bu iş geçici olarak `0272_asterium_and_synthesis.sql` ile başlar; merge anında numara ve `when` sırası yeniden kontrol edilir (bkz. hafıza: drizzle out-of-order trap).

1. **`player_asterium` tablosu:**
   - `player_id` `uuid PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE`
   - `balance` `integer NOT NULL DEFAULT 0 CHECK (balance >= 0)`
   - `updated_at` `timestamptz NOT NULL DEFAULT now()`
2. **`player_capsules` tablosu:**
   - `player_id` `uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
   - `capsule_id` `text NOT NULL CHECK (capsule_id IN ('OPTIC_VEIL', 'SILENT_THRUST'))`
   - `quantity` `integer NOT NULL DEFAULT 0 CHECK (quantity >= 0)`
   - `PRIMARY KEY (player_id, capsule_id)`
3. **`synthesis_jobs` tablosu (tek aktif üretim garantisi):**
   - `player_id` `uuid PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE`
   - `season_id` `uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE`
   - `capsule_id` `text NOT NULL CHECK (capsule_id IN ('OPTIC_VEIL', 'SILENT_THRUST'))`
   - `started_at` `timestamptz NOT NULL`
   - `completes_at` `timestamptz NOT NULL` *(son kapsülün bitişi = `started_at + quantity × craftMinutes`)*
   - `quantity` `integer NOT NULL CHECK (quantity BETWEEN 1 AND 50)`
   - `delivered` `integer NOT NULL DEFAULT 0 CHECK (delivered >= 0 AND delivered <= quantity)`
   - `paid_alloy` `integer NOT NULL CHECK (paid_alloy >= 0)`
   - `paid_crystal` `integer NOT NULL CHECK (paid_crystal >= 0)`
   - `paid_deuterium` `integer NOT NULL CHECK (paid_deuterium >= 0)`
   - `paid_asterium` `integer NOT NULL CHECK (paid_asterium >= 0)`
4. **`moons` tablosuna 2 sütun:**
   - `asterium_synced_at` `timestamptz NOT NULL DEFAULT now()` *(migration'da mevcut satırlara `now()` atanır)*
   - `asterium_fraction` `double precision NOT NULL DEFAULT 0 CHECK (asterium_fraction >= 0 AND asterium_fraction < 1)`
5. **`arena_ships` tablosuna 1 sütun:**
   - `hold_asterium` `double precision NOT NULL DEFAULT 0 CHECK (hold_asterium >= 0)`
6. **`missions` tablosuna 1 sütun:**
   - `applied_capsules` `jsonb NOT NULL DEFAULT '[]'::jsonb` (`AppliedCapsule[]`, ör. `[{ "id": "OPTIC_VEIL", "count": 2 }]`)
7. **`battle_reports` tablosuna / rapor JSON'una alan:**
   - `applied_capsules` `jsonb NOT NULL DEFAULT '[]'::jsonb` (`CapsuleId[]`) — mevcut raporlar boş diziyle geriye dönük tam uyumlu (`EN-07`).
8. **Enum genişletmeleri:**
   - `scheduled_event_kind`: `'synthesis_complete'` (ve etkinlik bildirim zamanlayıcısı gerekiyorsa `'asterium_event_notice'`).
   - `notification_kind`: `'synthesis_ready'`, `'asterium_event_started'`.

### 4.3 Sunucu servisleri, akışlar ve API uçları

Yeni servis: `apps/server/src/services/synthesis.ts`
- `syncPlayerMoonAsterium(tx, playerId, now)`: Oyuncunun sahip olduğu tüm Ay'ları `FOR UPDATE` ile kilitler, `accrueMoonAsterium` ile biriken tam Asteryum'u `player_asterium` içine atomik ekler, `asterium_synced_at` / `asterium_fraction` günceller.
- `settleMoonAsteriumOnLifecycle(tx, planetId, ownerPlayerId, now, opts?: { freezeUntil?: Date; resetFraction?: boolean })`: Ölüm Yıldızı vuruşu, dünya devri/fethi/terki sırasında tek ortak kapı.
- `creditPlayerAsterium(tx, playerId, amount, now)`: Yarık çıkışında atomik `INSERT ... ON CONFLICT DO UPDATE SET balance = balance + amount`.
- `getSynthesisState(db, playerId, now)`: Önce varsa süresi dolmuş işi tembelce tamamlar + Ay pasif üretimini senkronlar; laboratuvar kilit durumu (`coreLevel`, `requiredCore`), Asteryum bakiyesi, Ay'lardan gelen toplam günlük/saatlik hız, kapsül envanteri, aktif üretim işi, katalog ve günlük Yarık etkinliği penceresini tek sorgu grubunda döner.
- `startSynthesis(db, playerId, capsuleId, idempotencyKey, now)`: KM >= 10 kontrolü, aktif iş yok kontrolü, sezon sonu kontrolü, kaynak + Asteryum atomik düşüm (`EN-03`), `synthesis_jobs` kaydı ve `synthesis_complete` planlaması.
- `cancelSynthesis(db, playerId, idempotencyKey, now)`: Aktif işi `FOR UPDATE` / `DELETE ... RETURNING` ile atomik siler; iş zaten bittiyse tamamlar (yarış durumu engellenir); bitmediyse `paid_*` üzerinden %50 iade yapar ve bekleyen `synthesis_complete` olayını iptal eder.
- `completeSynthesis(tx, playerId, now)`: Worker handler (`onSynthesisComplete`) + okuma/başlatma tembel çağrısı tarafından paylaşılan idempotent tamamlama.
- `consumeCapsulesForMission(tx, playerId, missionKind, fleet, requestedCapsuleIds)`: Tüm launch yollarının (`attack`, `transfer`, `settlement`, `clan_war`) çağırdığı tek atomik tüketim fonksiyonu (`FOR UPDATE` ile `player_capsules` bakiyesini kontrol edip düşer, `AppliedCapsule[]` döner).

Yeni route: `apps/server/src/routes/synthesis.ts`
- `GET /api/synthesis` → Laboratuvar durumu, bakiye, envanter, aktif iş, Ay pasif hızı, katalog, Yarık etkinliği penceresi.
- `POST /api/synthesis/start` → Zod `{ capsuleId: z.enum(CAPSULE_IDS), quantity: z.number().int().min(1).max(SYNTHESIS.maxBatch) }` + idempotency + rate limit (`EN-06`).
- `POST /api/synthesis/cancel` → Idempotency + rate limit.

Güncellenecek mevcut servis ve route'lar:
- **`apps/server/src/routes/planet.ts` & `services/mission.ts`:** `attack`, `transfer`, `settlement` launch body'sine opsiyonel `capsules?: CapsuleId[]` eklenir. `consumeCapsulesForMission` launch transaction'ında çalışır; `missions.appliedCapsules` kaydedilir. `SILENT_THRUST` varsa `radar_warning` planlanmaz.
- **`apps/server/src/routes/clan.ts` & `services/clanWar.ts`:** `clanWar` quote ve launch uçlarına opsiyonel `capsules?: CapsuleId[]` eklenir. Birleşik filo `hangarLoad`'ı hesaplanır, liderin envanterinden düşülür.
- **`apps/server/src/services/traffic.ts`:**
  - Viewer'ın `clanId` bilgisi ve aktif `OPTIC_VEIL` görev sahiplerinin `clanId` haritası tek batch sorguyla (`EN-04`, sıfır N+1) yüklenir.
  - `OPTIC_VEIL` aktif bir görevde viewer sahip veya aynı klan üyesi değilse görev tamamen atlanır (`continue` — ne `IDENTIFIED` ne `CONTACT`). Sahip ve klan üyelerine `stealth: CapsuleId[]` işaretiyle gösterilir.
  - `aimedAtMe` içinde `missionSuppressesRadarWarning(mission.appliedCapsules)` kontrolü eklenir → `SILENT_THRUST` varsa `inbound: true` bayrağı basılmaz.
- **`apps/server/src/worker/handlers.ts` (`onRadarWarning`, `onMissionArrival`) & `services/radar.ts` (`wakeInboundRadarWarnings`):**
  - `onRadarWarning` ve `wakeInboundRadarWarnings` başında `if (missionSuppressesRadarWarning(mission.appliedCapsules)) return` savunma katmanı eklenir (sonradan Radar/Anten kurulumu sızıntısını %100 engeller).
  - `onMissionArrival`: Savaş raporuna `appliedCapsules` yazılır; savaş sonrası oluşan `return` görevi `appliedCapsules: []` ile yaratılır.
- **`apps/server/src/services/moonBattle.ts` / `moonExplosion.ts` / dünya el değiştirme & terk:** Ay pasif üretim settle kancası bağlanır.
- **`apps/server/src/arena/server.ts` & `services/arenaShips.ts` & `arenaTeamLedger.ts`:**
  - `server.ts` her tick/periyodik kontrolde `asteriumEventWindow(now)` durumunu `world.asteriumEventActive`'e aktarır ve protokol/HUD'a yayınlar.
  - Çıkışta (`extracted`) `hold[3]` → `creditPlayerAsterium` ile Başkent'e yazılır; deploy-recall'da `hold_asterium` saklanır; takım paylaşımında (`arenaTeamLedger.ts`) Asteryum da takım üyelerine adil bölüşülür (adım 0'da `splitTeamLoot` doğrulanacak).

---

## 5. Oyuncu deneyimi, UI/UX, game feel ve VFX briefi

### 5.1 Oyuncu yolculuğu ve yüzeyler (`CLAUDE.md §4`)

1. **Keşif ve hedef (`LD-11`):**
   - Başkent alt navigasyonunda/menüsünde **Sentez Laboratuvarı** görünür. KM 10'dan önce kilit simgesiyle açılır: *"Komuta Merkezi 10'da açılır · Asteryum: 14 · Ay gelirleri aktif · Yarık etkinliği: 2 sa 14 dk"*. Oyuncu Tier 4 hedefini somut bir ödülle bağlar.
2. **Günlük Yarık Etkinliği (`21:00–22:00 TR`):**
   - Yarık giriş ekranında (`ArenaGate.tsx` / `Hangar.tsx`) ve ana üst şeritte canlı geri sayım; saat 21:00'da *"Asteryum Fırtınası Başladı — 60 dk"* canlı rozeti.
   - Yarık içinde Asteryum parçaları mevcut alaşım/kristal/döteryumdan anında ayrışan **soğuk prizmatik mor-turkuaz** renk ve özel ikonuyla görünür (`farmColors.ts`, `Hud.tsx`). Toplama anında ambara uçuş ve sayaç tepkisi (`UI-06`).
3. **Ay kartı (`MoonPanel.tsx`):**
   - Ay durum kartına tek kompakt satır eklenir: *"Asteryum Üretimi: +3 / gün (Sonraki +1: 4 sa 12 dk)"*. Ölüm Yıldızı Ay'ı kapattığında satır uyarı tonuna döner: *"Kapalı — üretim 2 sa 40 dk duraklatıldı"*.
4. **Sentez Laboratuvarı ekranı (`SynthesisLabScreen.tsx`):**
   - Üst şerit: Asteryum bakiyesi + 2 gelir kaynağının canlı özeti (*Ay'lardan +X/gün* · *Yarık etkinliği geri sayımı*).
   - Aktif Sentez yuvası: Çalışan kapsül için canlı ilerleme çubuğu, kalan süre ve **basılı tutarak iptal** (`GameHold`, *"%50 kaynak iadesi"* açıkça yazılı, `UI-08`).
   - Kapsül kartları (**Optik Örtü**, **Sessiz İtki**):
     - Her kartta tek cümle kural (*"Ne gizler? Ne zaman bozulur? 1 kapsül = 500 filo alanı"*), sahip olunan adet, maliyet satırı (eksik kaynak kırmızı değil net eksiklik göstergesiyle), üretim süresi ve **basılı tutarak sentezle** (`GameHold`, weight `spends`).
     - `ⓘ` detay sheet'inde net örnek tablo (500 / 1.000 / 1.500 bulk için kaç kapsül gerektiği ve Optik Örtü + Sessiz İtki farkı).
5. **Filo Kalkış Çekmeceleri (`LaunchSheet.tsx`, `TransferSheet.tsx`, `SettlementSheet.tsx`, `ClanWarPanel.tsx`):**
   - Seçili gemiler değiştikçe canlı hesaplanan **Kapsül Şeridi**:
     - `Filo alanı: 1.240 → Gerekli: 3 kapsül`
     - İki aç/kapa şalteri: **Optik Örtü** (`3 / 5 hazır`) ve **Sessiz İtki** (`3 / 2 yetersiz` — saldırı/klan savaşı dışındaki görevlerde Sessiz İtki gösterilmez).
     - Şalter açıldığında kalkış özeti ve `GameHold` butonu görsel olarak "Gizli Kalkış" tonuna geçer; hangi katmanların gizlendiği tek satırda onaylanır (`Clarity` + `Predictability`).
6. **Galaksi Haritası (`GalaxyView.tsx`) & Savaş Raporu (`BattleReports.tsx`):**
   - Sahip ve klan üyeleri gizli uçan filoyu ince kesikli/yarı-saydam faz çizgisi ve küçük kapsül rozetiyle görür (*"Optik Örtü aktif — rakipler göremiyor"*).
   - Savaş raporunda (`BattleReports.tsx`) savunan ve saldırgan için belirgin istihbarat bandı: *"Gizli Operasyon: Optik Örtü · Sessiz İtki"*.

### 5.2 VFX briefi (`CLAUDE.md §4.5`)

> Yumuşak yuvarlak parlama, büyüyen hale ve "her yere uyan" efekt kullanılmaz.

1. **Dünyada fiziksel olarak ne oluyor:**
   - *Kalkış (Optik Örtü):* Filo yörüngeden ayrılırken gemi siluetlerinin üzerinden ince altıgen kırılma/faz tarama ağı geçer; gemiler sahibin/klanın ekranında yarı-saydam faz görüntüsüne iner, düşman istemcisinde hiç çizilmez.
   - *Savaşta bozulma:* Filo hedef yörüngeye vardığı an kırılma ağı kısa bir parazit yırtılmasıyla dağılır ve gemiler tam maddesel gövdesiyle savaşa girer.
   - *Yarık Asteryum toplama:* Kristal kümesi kırılıp ince prizmatik kıymıklar halinde geminin emiş hattına çekilir.
2. **Kütüphane adayları (`~/Desktop/Coding/MyProjects/game-assets/` — önizleme sonrası oyuna kopyalanıp `CREDITS.md` ve `usage.json` güncellenecek):**
   - Faz/kırılma dokusu: `library/vfx/textures/space-combat-kit/universalvehiclecombat--demoassets--effects--shields--hexagons.png` ve `library/vfx/textures/vfx-graph-scifi-shield-v1/textures--digital-onezero-01.png`
   - Faz örgü efekti (uyarlama adayı): `library/vfx/shield/00gamedevs-vfx/aegis-weave.js`
   - Asteryum ikonu adayı: `library/icons/space-painted/cartoon-icons-sampler/512--space-energy-crystal.png`
   - Kapsül/ikon adayları: `library/icons/consumables-painted/wenrexa-potions/` (veya Astera UI v2 gözlemevi stiline uygun özel vektör/render — uygulama öncesi önizlemede karar verilir).
3. **Neden bu olayı anlatıyor:** Altıgen kırılma ağı "optik gizleme/faz bükülmesi" fikrini tek bakışta okutur; varıştaki kısa yırtılma ise kuralın ("ilk bacak sonunda bozulur") dünyada görünür karşılığıdır (`UI-15`).

### 5.3 Ses ve haptik (`AU-01`)

- Sentez başlatma: mekanik kilit + düşük frekanslı reaktör başlangıcı + orta `haptic`.
- Sentez iptal: basınç boşaltma sesi + hafif `haptic`.
- Kalkışta kapsül şalteri açma: keskin faz kilidi tıkı; gizli kalkış onayı: bastırılmış/boğuk motor kalkış sesi (normal kalkıştan işitsel olarak ayrışır).
- Yarık'ta Asteryum toplama: mevcut alaşım/kristalden daha berrak/yüksek tınılı kristal toplama sesi.
- Tüm durumlar ses kapalıyken de görsel rozet ve metinle tamamen anlaşılır (`CLAUDE.md §4.6`).

---

## 6. Bot davranışı (kilitli kural 2026-10-28)

> Oyuncular bir botun bot olduğunu hiçbir zaman anlayamamalıdır. Hiçbir metinde, Wiki'de veya payload'da bot ifadesi bulunamaz.

- **Bilgi eşitliği (savunma):** `apps/server/src/services/bots/moon.ts:152` botun gelen saldırıları yalnızca kendi `incoming_fleet` bildirimlerinden okuduğunu doğrular. `SILENT_THRUST` bu bildirimi üretmediği için botlar da Sessiz İtki kullanan oyunculara karşı doğal olarak kör olur (hileli tepki veremez).
- **Yarık etkinliği:** `packages/rules/src/arena/bots.ts` içindeki Yarık botları etkinlik saatinde `kind = 3` (Asteryum) parçalarını yüksek öncelikli hedef olarak görür ve toplamaya/kaçırmaya çalışır; etkinlik dışında davranışları değişmez.
- **Sentez ve kullanım (saldırı):** KM 10+ olan ve uygun Asteryum stoğuna ulaşan botlar (`apps/server/src/services/bots/brain.ts`), persona ağırlığına göre ara sıra Optik Örtü veya Sessiz İtki sentezler ve büyük/stratejik baskınlarda gerçek bir oyuncu gibi uygular (en fazla haftada/günde sınırlı sıklıkla, kaynaklarını yakmadan).

---

## 7. El kitabı ilkeleri, değişen eski kurallar ve ölçüm planı

### 7.1 Uygulanan `game-dev-handbook` ilkeleri

- **DF-12 (Anlamlı seçimler):** Oyuncu Asteryum'u hangi kapsüle harcayacağına ve 500 bulk ölçeğinde küçük/ucuz gizli vur-kaç mı yoksa büyük/pahalı hayalet darbe mi yapacağına karar verir.
- **DI-02 (Adil kayıp):** Savunan uyarı almadan vurulduğunda savaş raporunda kullanılan kapsülü açıkça görür; sistemin bozuk olmadığını, rakibin pahalı bir araç kullandığını bilir.
- **LD-11 (Kapı anahtardan önce gösterilir):** KM 10 öncesi oyuncular Asteryum toplayabilir ve Sentez Laboratuvarı'nı kilitli önizlemeyle görür.
- **SB-09 (Dokunulmazlık için karşı önlem — bilinçli erteleme):** İlk sürümde %100 tutarlı gizlilik ve sıfır karşı önlem owner kararıdır (K11); denge yüksek Asteryum/Döteryum maliyeti + üretim süresi + 500 bulk ölçeğiyle sağlanır. Canlı veride aşırı baskın çıkarsa Faz 2'de maliyet/karşı önlem (ör. Efsanevi Gözcü) açılabilir.
- **SB-11 / SB-12 (Kaynak ayrımı):** Asteryum ayrı stratejik havuzdur; savunma/ekonomi binalarıyla aynı inşaat kuyruğunu tüketmez.
- **PE-09 / PE-10 (Kaynak giriş–çıkış ve zamanlı takvim):** İki kontrollü giriş (günlük 1 saatlik Yarık + Ay pasif), tek kontrollü çıkış (tüketilebilir kapsüller + %50 iptal yanığı).
- **ML-01 / ML-06 (Sunucu konfigürasyonu ve fiyat değişimi güvenliği):** Etkinlik saati ve tarifler sunucudan yönetilir; iptal iadesi ödenen tutar (`paid_*`) üzerinden hesaplanır.
- **UI-06 / UI-08 / UI-15:** Yarık toplamada sayaç tepkisi; üretim/iptal/gizli kalkışta `GameHold` onayı; galakside gizlilik durumunun sahnede okunması.
- **EN-03 / EN-04 / EN-06 / EN-20 / EN-21:** Atomik bakiye/envanter kilitleri, N+1'siz klan görüş sorgusu, rate-limit + idempotency, veri-güdümlü katalog, sunucu otoritesi.

Teslimden önce `checklists.md` içinde geçirilecek bölümler: **"A new mechanic or feature proposal"**, **"A player action"**, **"A reward or reveal moment"**, **"A HUD element"**, **"Progression and loot"**, **"An online backend before real players arrive"**, **"Audio"**.

### 7.2 Değişen eski kurallar / güncellenecek dokümanlar

- `docs/game-design.md` ve `docs/review-sight.md`:
  - "Teleskop çemberindeki her filo tanımlanır, Radar çemberindeki her filo `?` görünür" kuralına **Optik Örtü** istisnası eklenecek.
  - "Radar menziline giren her düşman saldırısı bildirim tetikler" kuralına **Sessiz İtki** istisnası eklenecek.
  - Yeni kaynak **Asteryum** (özel stratejik stok) ve **Sentez Laboratuvarı (KM 10)** bölümleri eklenecek.
- `apps/web/src/wiki/` ve 6 dil (`tr, en, de, es, fr, ja`) i18n dosyaları (`docs/ux-writing.md` standardına göre, bot kelimesi sıfır).

### 7.3 Canlı ölçüm planı (denge varsayımı → kanıt)

Başlangıç sayıları (Ay 1/1,5/2/3 gün — 2026-11-25'te 2/3/4/6'dan yarıya indi, Yarık 6–15/saat, 4 ve 6 Asteryum, 500 bulk) varsayımdır; canlı açılıştan sonra aşağıdakiler ölçülerek kalibre edilir:
- Günlük 21:00–22:00 Yarık etkinliğine katılım oranı ve kişi başı ortalama çıkarılan Asteryum.
- Toplam Asteryum girişinin **Yarık vs Ay** paylaşım oranı (hedef: ikisi de anlamlı kalsın, biri diğerini anlamsızlaştırmasın).
- Günlük üretilen ve harcanan **Optik Örtü** vs **Sessiz İtki** adedi.
- Gizli saldırıların toplam PvP saldırılarına oranı (hedef: özel operasyon hissi — örn. <%15; spam'a dönerse maliyet veya bulk ölçeği sıkılaştırılır).
- Savunan şikâyet / bildirim merkezi tepkisi (Sessiz İtki kullanılan baskınlarda rapor okunma oranı).

---

## 8. Kritik riskler, uç durumlar ve dikkat edilecekler

| # | Risk / Uç durum | Önlem |
|---|---|---|
| 1 | **Radar / Anten sonradan kurulursa (`wakeInboundRadarWarnings`)** | Hem `mission.ts`/`clanWar.ts` planlama anında hem `radar.ts` ve `handlers.ts` içinde `missionSuppressesRadarWarning` çift kontrolü yapılır. |
| 2 | **Haritadaki kırmızı `inbound: true` sızıntısı** | `traffic.ts` içindeki `aimedAtMe` fonksiyonu `SILENT_THRUST` için `null` döner; böylece bildirim gitmese bile haritada "sana geliyor" alarm halkası yanmaz. |
| 3 | **F2 Klan Alarmı ve Ücretli Bildirim sızıntısı** | `onRadarWarning` hiç çalışmadığı için ne `raiseClanAlarm` ne `armPaidAlert` tetiklenir; savunanın Bildirim Merkezi bakiyesi düşmez. |
| 4 | **Klan görünürlüğü N+1 sorgusu (`OPTIC_VEIL`)** | `traffic.ts` içinde viewer'ın klanı ve gizli görev sahiplerinin klanları tek `inArray` sorgusuyla önceden çekilir (`EN-04`). |
| 5 | **Klan Savaşı birleşik filo bulk'u ve lider değişimi** | Kapsül sayısı `COMBINED_ATTACK` toplam `hangarLoad`'ı üzerinden fırlatma anında yeniden hesaplanır ve liderin envanterinden atomik düşülür; quote ile launch aynı saf fonksiyonu kullanır. |
| 6 | **Amiral (Komutan Gemisi) eskortu sızıntısı** | Adım 0'da `admiralForFlight` ve `traffic.ts` eskort çizimi doğrulanır; `OPTIC_VEIL` aktif saldırıya eşlik eden eskort düşman haritasında görünmez. |
| 7 | **22:00 etkinlik bitişinde ambardaki Asteryum** | 22:00:00'da yalnızca yeni spawn durur; ambarda taşınan Asteryum çıkış kapısından güvenle çıkarılabilir. |
| 8 | **Ay kapalıyken / el değiştirirken / patlarken üretim** | `strikeMoon` önce settle eder sonra `asterium_synced_at = closedUntil` yazar; sahiplik değişiminde eski sahibe settle edilip sıfırlanır. |
| 9 | **Üretim tamamlanma vs iptal yarış durumu** | İki uç da `synthesis_jobs` satırını `FOR UPDATE` ile kilitler; `completesAt <= now` ise iptal reddedilir ve iş tamamlanır. |
| 10 | **Tarif fiyatı değişince iptal istismarı** | İade oranı canlı katalogdan değil, `synthesis_jobs.paid_*` sütunlarından hesaplanır. |
| 11 | **Eşzamanlı çift kalkışta aynı kapsülü iki kez harcama** | `player_capsules` satırları `FOR UPDATE` ile kilitlenir, yetersiz bakiyede 409 `INSUFFICIENT_CAPSULES` döner (`EN-03`). |
| 12 | **Canlı sezon açılışı (K12)** | Geriye dönük uyumlu migration (`DEFAULT` değerler); mevcut Ay'lara `asterium_synced_at = now()`; mevcut tüm görevler `applied_capsules = '[]'`; oyun içi duyuru yayınlanır. |

---

## 9. TDD test matrisi (her ölçüt bir test, koddan önce)

> `CLAUDE.md §3` gereği tüm geliştirme adımlarında önce testler yazılır, **FAIL** doğrulanır, ardından kod yazılıp **PASS** doğrulanır. Uzun simülasyonlar (`packages/sim`) çalıştırılmaz.

**Rules (`packages/rules`)**
- **R1:** `requiredCapsulesForFleet`: 0 bulk → 0; 1 bulk → 1; 500 → 1; 501 → 2; 1.550 → 4; yer savunmaları (`ground`) hesaba katılmaz.
- **R2:** `validateMissionCapsules`: tek kapsül geçerli; `OPTIC_VEIL + SILENT_THRUST` `attack` ve `clan_war`'da geçerli; aynı kapsül 2 kez reddedilir; `SILENT_THRUST` `transfer`/`settlement`'da reddedilir; `death_star` ve `probe` tüm kapsülleri reddeder.
- **R3:** `cancelRefund`: tek sayılarda `Math.floor(paid * 0.5)` (örn. 5 → 2, 4 → 2, 0 → 0); adetli işte yalnız üretilmemiş pay iade edilir (4 adet, 1 teslim → ödenenin 3/4'ünün yarısı).
- **R3b:** `synthesisDelivered`: 0 dk → 0, 29:59 → 0, 30:00 → 1 (Optik Örtü), son adette `quantity`'yi aşmaz; `maxBatch` ve 0/negatif adet reddi.
- **R4:** `accrueMoonAsterium`: 4 nadirlikte doğru tam birim + kesir birikimi; `closedUntil > now` iken 0 üretim; kapalı dönem atlanıp açılıştan sonrası doğru hesaplanır; birden fazla okuma idempotent.
- **R5:** `asteriumEventWindow`: 20:59:59 TR kapalı (sonraki 21:00), 21:00:00–21:59:59 TR aktif, 22:00:00 TR kapalı (sonraki yarın 21:00); gün dönümü ve saat dilimi sınırları.
- **R6:** `missionHidesFromGalaxy` & `missionSuppressesRadarWarning`: gidiş / recall dönüşü / savaş sonrası normal dönüş ayrımları.
- **R7:** Arena `FARM_KINDS` 4. tür (`asterium`), `extractAsterium` tam sayı, etkinlik kapalıyken Asteryum spawn üretmez.

**Server (`apps/server`)**
- **S1:** `GET /api/synthesis` KM < 10 iken kilitli döner ama bakiye, Ay hızı ve etkinlik penceresini gösterir; KM >= 10 iken açık döner.
- **S2:** `POST /api/synthesis/start` reddedilir: KM < 10, aktif iş varken, Asteryum veya Başkent kaynağı yetersizken, `completesAt > season.endsAt` iken, geçersiz `capsuleId` iken. Başarılı olunca adet × tarif kadar kaynak + Asteryum düşülür, `paid_*` kaydedilir, `synthesis_complete` planlanır. Adet aralık dışıysa ve son kapsül sezon sonundan sonra bitiyorsa reddedilir.
- **S3:** `POST /api/synthesis/cancel`: teslim edilmişler envanterde kalır, üretilmemiş payın yarısı iade edilir (`paid_*` üzerinden); tamamlanma zamanı geçtiyse iptal yerine iş tamamlanır; çift iptal idempotent/409.
- **S4:** `onSynthesisComplete` & tembel tamamlama: aynı anda tetiklenseler bile `player_capsules.quantity` tam olarak iş adedi kadar artar (birer birer teslim + son teslim çift sayılmaz), `synthesis_ready` bildirimi tek kez gider.
- **S5:** Ay pasif üretimi: 4 nadirlik doğru üretir; çoklu Ay toplanır; Ölüm Yıldızı vuruşunda `closedUntil` süresince üretim durur; dünya fethi/devri/terkinde eski sahibin birikimi korunur, yeni sahip 0 kesirle başlar; Ay patlayınca Başkent bakiyesi silinmez.
- **S6:** Filo kalkışı (`attack`, `transfer`, `settlement`): kapsül sayısı sunucuda `hangarLoad`'dan hesaplanır, envanterden atomik düşülür; yetersiz stokta 409; koloni ve Ay'dan kalkışta da çalışır; `death_star` ve `probe` reddeder.
- **S7:** Eşzamanlı 2 kalkış yarışı: 3 kapsül varken aynı anda 2×2 kapsüllük kalkış → yalnız biri geçer (`FOR UPDATE`).
- **S8:** `clan_war` (`COMBINED_ATTACK`): birleşik filo bulk'una göre lider envanterinden düşer; lider dışında kimse basamaz; quote ile launch birebir eşleşir.
- **S9:** `OPTIC_VEIL` trafik testi: sahip görür, aynı klan üyesi görür, düşman hedef ve 3. kişi (yüksek Teleskop + Radar + çıplak göz dahil) **görmez** (`NONE`). **Gözcü:** Efsanevi Ay'ın delen taraması dahil hiçbir tarama satır üretmez ve rota dünyalarını açmaz (K11).
- **S10:** `OPTIC_VEIL` tek başına basılıyken saldırıda `onRadarWarning` yine çalışır; savaş anında etki biter, savaş sonrası `return` görevi herkese normal görünür.
- **S11:** `SILENT_THRUST` trafik + uyarı testi: harita görünürlüğü normal ama `inbound: true` yok; `onRadarWarning` çalışmaz; `incoming_fleet`, `clan_alarm`, `paid_alerts` oluşmaz; uçuş ortasında Radar/Anten yükseltilse bile (`wakeInboundRadarWarnings`) uyarı sızmaz.
- **S12:** `OPTIC_VEIL + SILENT_THRUST` birlikte: haritada sıfır görünürlük + sıfır uyarı + savaş anında tam çözülme + savaş raporunda her iki kapsülün kaydı.
- **S13:** Recall testi: geri çağırılabilen görevde dönüş bacağı `applied_capsules`'ı korur, gizli döner, iade olmaz, eve inince biter.
- **S14:** Savaş raporu (`DI-02`): savunan ve saldırgan rapor payload'ında `appliedCapsules` doğru görünür; kapsülsüz eski raporlar geriye dönük bozulmaz.
- **S15:** Bot bilgi eşitliği ve kullanımı: `SILENT_THRUST` altında bot `incoming_fleet` görmez; bot sentez/kullanım payload'ında hiçbir bot işareti yok.
- **S16:** Contract testi, query budget testi (N+1 yok) ve sezon sonu / hesap silme cascade testleri.

**Arena / Yarık (`apps/server/src/arena` + `services/arena*`)**
- **A1:** Etkinlik saatinde (21:00–22:00 TR) Asteryum spawn olur, dışında olmaz.
- **A2:** Pilot Asteryum toplayıp çıkıştan çıkınca `player_asterium.balance` günlük `capHours` tavanına takılmadan artar.
- **A3:** Pilot ölürse ambarındaki Asteryum yere düşer ve başka pilot tarafından toplanıp çıkarılabilir.
- **A4:** 22:00:00 geçildikten sonra ambarda zaten bulunan Asteryum çıkış kapısından başarıyla indirilir.
- **A5:** Deploy-recall sırasında `hold_asterium` korunur; takım çıkışı bölüşümü çalışır.

**Web (`apps/web`)**
- **W1:** `SynthesisLabScreen`: KM < 10 kilitli durum, KM >= 10 açık durum, `GameHold` üretim başlatma ve %50 iade iptal akışı.
- **W2:** Kalkış çekmeceleri (`LaunchSheet`, `TransferSheet`, `SettlementSheet`, `ClanWarPanel`): canlı `hangarLoad → kapsül adedi` hesabı, şalter aç/kapa, `transfer`/`settlement`'da Sessiz İtki gizli, yetersiz stok engeli.
- **W3:** `MoonPanel` Asteryum üretim satırı ve kapalı Ay uyarı durumu; Yarık giriş/HUD etkinlik sayacı.
- **W4:** `BattleReports` gizli operasyon rozeti; `GalaxyView` sahip/klan gizli uçuş görünümü.
- **W5:** 6 dil (`tr, en, de, es, fr, ja`) i18n eşlik testi (sıfır eksik anahtar, sıfır bot kelimesi).
- **W6:** Görsel doğrulama: `node tools/visual.mjs` ile 350 px mobil görünümde Laboratuvar, Ay kartı ve Kalkış çekmecesi kontrolü.

---

## 10. Uygulama defteri

### 10.1 Adımlar (`adım → doğrulama`)

| # | Adım | Doğrulama | Durum |
|---|---|---|---|
| 0 | **Ön doğrulama:** İptal kaynağı Başkent'e eklenirken depo tavanı/buffer davranışı; `admiralForFlight` eskortunun `traffic.ts` görünürlüğü; `arenaTeamLedger.ts` (`splitTeamLoot`) 4. kaynak uyumu; `planetView.ts` kaynak/kuyruk yapısı; son migration numarası | Notlar §10.3'e yazılır | ✅ 2026-11-25 |
| 1 | **Rules (`packages/rules`):** `synthesis.ts` (katalog, bulk hesabı, Ay tembel üretim, etkinlik penceresi, gizlilik yardımcıları) + `arena/farms.ts`, `world.ts`, `economy.ts`, `protocol.ts` (R1–R7) | Rules testleri FAIL → PASS | ✅ `synthesis.test.ts`, `asterium-storm.test.ts`, `arena/asterium-field.test.ts` |
| 2 | **Şema + Migration:** `player_asterium`, `player_capsules`, `synthesis_jobs`, `moons` 2 sütun, `arena_ships.hold_asterium`, `missions.applied_capsules`, `battle_reports.applied_capsules`, enum'lar | Temiz DB'de migration + canlı uyumluluk | ✅ `0271_asterium_and_synthesis` (merge'de yeniden numaralanabilir), `asterium-schema.test.ts` |
| 3 | **Sentez servisi & API + Ay pasif üretimi:** `services/synthesis.ts`, `routes/synthesis.ts`, `onSynthesisComplete`, Ay yaşam döngüsü kancaları (`moonBattle`, devir/terk) (S1–S5) | Server testleri FAIL → PASS | ✅ `synthesis.test.ts`, `synthesis-routes.test.ts`, `synthesis-activation.test.ts` (+ `season activate-synthesis`) |
| 4 | **Yarık etkinliği entegrasyonu:** `arena/server.ts`, `arenaShips.ts`, `arenaTeamLedger.ts`, etkinlik zamanlayıcı & duyuru/bildirim (A1–A5) | Arena & server testleri FAIL → PASS | ✅ `arena-asterium.test.ts`, `arena/sortie.test.ts` fırtına anahtarı; protokol 17 |
| 5 | **Filo kalkışı & Klan Savaşı kapsül tüketimi:** `mission.ts`, `clanWar.ts`, `routes/planet.ts`, `routes/clan.ts`, recall koruma kuralı (S6–S8, S13) | Server testleri FAIL → PASS || ✅ `capsule-launch.test.ts` (S6, S7, S13, S14), `clan-war-start.test.ts` S8 |
| 6 | **Görüş, Radar ve Savaş Raporu entegrasyonu:** `traffic.ts` (`OPTIC_VEIL` + klan batch sorgusu + `aimedAtMe`), `handlers.ts` (`onRadarWarning`, `onMissionArrival`), `radar.ts` (`wakeInboundRadarWarnings`) (S9–S12, S14, S16) | Server testleri + query budget FAIL → PASS || ✅ `capsule-sight.test.ts` (S9–S12), `moon-scan.test.ts` S9-Gözcü; query-budget/traffic/sensor-horizon yeşil |
| 7 | **Botlar:** `arena/bots.ts` (etkinlikte Asteryum hedefleme) ve `bots/brain.ts` (KM 10+ sentez ve stratejik kullanım) + bilgi eşitliği doğrulaması (S15) | Bot testleri FAIL → PASS || ✅ `bots-synthesis.test.ts`; bot regresyonları yeşil. Yarık bot işi gereksiz (G10) |
| 8 | **Web — API, Laboratuvar ve Ay/Yarık UI:** `api/{schemas,client,queries,keys}.ts`, `SynthesisLabScreen.tsx`, `PlanetScreen.tsx` sekme, `MoonPanel.tsx` satır, Yarık etkinlik HUD & giriş sayacı (W1, W3) | Web testleri FAIL → PASS | ✅ `asterium-contract`, `synthesis-lab`, `moon-panel`, `arena/asterium-kind`, `arena/hangar` (çıkış özeti), `galaxy-events-guide`. Yarık içi fırtına göstergesi ertelendi (G16). |
| 9 | **Web — Kalkış çekmeceleri, Galaksi VFX & Rapor:** `LaunchSheet`, `TransferSheet`, `SettlementSheet`, `ClanWarPanel`, `GalaxyView` gizli uçuş efekti, `BattleReports` rozeti, ses/haptik, asset kopyalama + `CREDITS.md` (W2, W4) | Web testleri + 350 px `visual.mjs` | ✅ galaksi örtü efekti dahil (G17) `transfer-sheet`, `settlement-sheet`, `clan-war-panel`, `battle-report-admiral`, `api-bodies`; 350 px galeri çekimi (`synthesis`, `synthesis-running`, `transfer-veil`, `settlement-veil`, tr+en, konsol hatası yok). Örtülü kendi uçuşunun galaksi görünümü ertelendi (G17); yeni asset yok, `CREDITS.md` değişmedi. |
| 10 | **i18n (6 dil), Wiki ve dokümanlar:** `locales/{tr,en,de,es,fr,ja}`, `wiki/`, `docs/game-design.md`, `docs/review-sight.md`, canlı sezon açılış duyurusu taslağı (W5) | Eşlik testi + `ux-writing.md` kontrolü | ✅ 6 dil `synthesis` + etkinlik rehberi; `game-design.md`, `review-sight.md` §5.5. Wiki `galaxy.asterium` eklendi (G18). |
| 11 | **Son review & regresyon:** `checklists.md` kontrolü, `pnpm verify` (uzun simülasyonlar hariç), mobil boyutta uçtan uca oyuncu akışı denemesi | Yeşil `pnpm verify` | ✅ 2026-11-25: sunucu 577 dosya (4 parça, ayrı `_test` DB), web 1086, rules 3830; typecheck temiz. Kalan kırmızı yalnız tabanda (61969187): web `type-scale` (wiki-room), `v2/icons` (i-clan), lint `MoonPanel.tsx:445`; yük altında sıra kayan `bots-guard`, `monument-send` tek başına yeşil. Mobil uçtan uca oyuncu akışı (canlı sunucuyla) yapılmadı, yalnız galeri çekimi. |

### 10.2 Dosya haritası

- **Rules:**
  - Yeni: `packages/rules/src/synthesis.ts`
  - Güncelleme: `packages/rules/src/index.ts`, `packages/rules/src/arena/{farms,world,economy,protocol,bots}.ts`
- **Server:**
  - Yeni: `apps/server/src/services/synthesis.ts`, `apps/server/src/routes/synthesis.ts`, `apps/server/drizzle/0272_asterium_and_synthesis.sql` *(merge anında yeniden numaralanabilir)*
  - Güncelleme: `apps/server/src/db/schema.ts`, `apps/server/src/app.ts`, `apps/server/src/routes/{planet,clan,moon}.ts`, `apps/server/src/services/{mission,clanWar,traffic,radar,planetView,moonBattle,arenaShips,arenaTeamLedger}.ts`, `apps/server/src/worker/handlers.ts`, `apps/server/src/arena/server.ts`, `apps/server/src/services/bots/brain.ts`
- **Web:**
  - Yeni: `apps/web/src/screens/SynthesisLabScreen.tsx`, `apps/web/src/components/CapsuleSelector.tsx`
  - Güncelleme: `apps/web/src/api/{schemas,client,queries,keys}.ts`, `apps/web/src/screens/{PlanetScreen,MoonPanel,LaunchSheet,TransferSheet,SettlementSheet,ClanWarPanel,GalaxyView,BattleReports}.tsx`, `apps/web/src/arena/{ArenaGate,Hangar,Hud,farmColors,copy}.ts(x)`, `apps/web/src/wiki/`, `apps/web/src/i18n/locales/{tr,en,de,es,fr,ja}/`
- **Doküman & Kredi:**
  - `docs/game-design.md`, `docs/review-sight.md`, `CREDITS.md` (kütüphaneden kopyalanan asset'ler için)

### 10.3 Doğrulanmış kod gerçekleri (2026-11-24)

- Filo alanının tek otoritesi `hangarLoad(fleet)` (`packages/rules/src/hulls.ts:338`); Ay rıhtım kapasiteleri (`470 / 1.550 / 3.250 / 7.270`) bu birimi kullanır.
- ~~Normal `attack` geri çağrılamaz~~ **YANLIŞ (2026-11-25):** `recallFlight` (`movement.ts:699`) `transfer` + `attack` geri çevirir (K8, tek dönüş, `recalledAt`). Satır yerinde güncellenir; `applied_capsules` korunur.
- Ay Gözcüsü (`moonScan.ts:47–75`) gezegen→gezegen uçuşları her zaman görür ve rota dünyalarını açar (S53); Ay uçuşlarını yalnız `LEGENDARY` deler (`scanPierces`, `moon.ts:88`). K11 gereği `OPTIC_VEIL` burada da atlanır.
- `moonBirth.ts:32` var olan Ay'ın nadirliğini yükseltebilir → nadirlik değişmeden önce üretim settle edilmeli. F1 koloni ayrılması (`colonyAbandonment.ts`, secession) sahiplik değiştirir → aynı settle kancası.
- Radar 5 uyarısı kalkış gezegenini adıyla verir (`handlers.ts` `radarRevealsOrigin`); yalnız Optik Örtü basılıysa savunan Radar 5 ile kolonisini yine öğrenir (matrisle tutarlı).
- Yarık tek oda, `ARENA_MAX_SEATS = 120` (`arena/protocol.ts:48`); 21:00 etkinliği kalabalık yaratabilir → Adım 4'te dolu oda davranışı doğrulanır.
- Görev tablosunu okuyan görünürlük kanalları (Adım 0'da tek tek denetlenir): `traffic.ts`, `moonScan.ts`, `admiralPath.ts`, `arena/galaxyShips.ts`, `clanStrength.ts`, `intel.ts` (yalnız AWAY durumu), `notificationCenter.ts`, `session.ts` (pending `incoming`), koridor çizgileri / `publishShard('launch')`.
- Botlar yalnız kendi görevlerini ve kendi `incoming_fleet` bildirimlerini okur (`bots/brain.ts:875,1051`, `bots/moon.ts:175,324`) → bilgi eşitliği korunur.
- `onRadarWarning` (`apps/server/src/worker/handlers.ts:1992`) tek merkezden `incoming_fleet`, `raiseClanAlarm` (F2) ve `armPaidAlert` (`incoming_attack`) üretir.
- `bots/moon.ts:152` botların gelen saldırıları yalnızca kendi `incoming_fleet` bildiriminden okuduğunu doğrular — `SILENT_THRUST` botlara karşı otomatik bilgi eşitliği sağlar.
- `traffic.ts:1152` içindeki `aimedAtMe`, `inbound: true` işaretini üretir; `SILENT_THRUST` burada da bastırılmalıdır.
- `moons` tablosunda (`schema.ts:6094`) şu an kaynak/bina sütunu yok; yalnızca `rarity`, `cracks`, `closedUntil`, `gateReadyAt` var.
- `packages/rules/src/arena/farms.ts` üzerinde `FARM_KINDS = ['alloy', 'crystal', 'deuterium']`; `protocol.ts:225` doğrulaması doğrudan `FARM_KINDS` dizisinden beslenir.
- KM 9 baz saatlik gelir referansı (`packages/rules/src/economy-profile.ts:63`): ~1.739 Alaşım, ~870 Kristal, ~56 Döteryum/saat.
- Son migration (taban `61969187`): `0270_drop_arena_pilots.sql`.

### 10.3b Geçici kararlar ve owner'a sorulacaklar (2026-11-25 gece, owner uyurken)

Owner: "sorman gerekenleri boş bırak veya geçici karar ver, gelince sor". Aşağıdakiler **geçici**; her biri tek satırla geri alınabilir.

| # | Konu | Geçici karar | Neden / bedel |
|---|---|---|---|
| G1 | Canlıya açılış | Ay modeli: `ruleset ≥ 21` sezonlara oluşturulurken, canlı sezona `pnpm season activate-synthesis --shard X --yes` ile açılır. Varsayılan ruleset **20'de kaldı** (yükseltmek senin kararın). | Ruleset yükseltmek dönüş/transfer eşitliğini etkiler; Ay'da da böyle yapıldı. |
| G2 | Etkinlik altyapısı | Ayrı zamanlayıcı yerine galaksi etkinlik takvimine `ASTERIUM_STORM` türü (bkz. §3.2 notu). | Hazır bildirim, HUD sayacı, rehber ve canlı alma; `asterium_event_started` bildirimi gereksizleşti. |
| G3 | Takım uçuşunda Asteryum | **Havuza girmez**: her pilot kendi çıkardığını alır (`endSortie`, takım dahil). | Takım defteri (`arena_team_*`) şemasına dokunmamak için. İstersen eşit bölüşüme çevrilir. |
| G4 | Yarık puanı | ~~`FARM_POINTS[asterium] = 10`~~ → **Owner 2026-11-25: kaldırıldı.** "Yarık'ta puan diye bir şey yok"; oda sıralaması yok etme/ölüm tablosudur. XP puana bağlı değildir (`sortieXp`, ambar). Ayrıntı `komutan-gemisi/02-kararlar.md` KG-K34. | Puan ilk deathmatch denemesinden kalmaydı. |
| G5 | Fırtına spawn ağırlığı | ~~Tek parça × 2 Asteryum, ağırlık 1 (normal çekilişin ~%9'u)~~ → **Owner 2026-11-25:** pilot başına dinamik (`ASTERIUM_STORM`): uçan her gemi saatte 10 birim borç ekler, merkezde (2 km) 1–2 birimlik parça doğar, açılışta pilot başına ~1 parça, aynı anda en çok pilot sayısı kadar (2–8). Oyuncuya yalnız "ortalarda" denir, işaret yok. Ayrıntı `komutan-gemisi/02-kararlar.md` KG-K34. | Hedef 6–15/saat/pilot; test 11–13. Canlı ölçümle ayarlanır (§7.3). |
| G6 | Ortak oda, farklı galaksiler | Fırtına, herhangi bir canlı sezonda açık `ASTERIUM_STORM` penceresi varsa odada eser. Sentezi açılmamış bir sezonun pilotu taş toplayabilir ama çıkışta Asteryum **yazılmaz**. | Tek oda tüm galaksileri karıştırıyor; iki galaksiyi aynı anda aktive etmek bu farkı kaldırır. |
| G7 | Batch tavanı | `maxBatch = 20` (DB kontrolü 50'ye kadar izin verir). | Hangar 10 tam filo 15 kapsül ister. |
| G8 | İptal iadesi | İade Başkent deposuna **tavan üstüne** de yazılır (günlük görev ödülüyle aynı). | Yanan kaynağın depoda buharlaşmaması. |
| G9 | Ay yarım birimi | Sahiplik değişince (ele geçirme, ayrılma) yarım birim sıfırlanır; nadirlik yükselmesi / kapanma / patlamada eski sahibe kadar ödenip devam eder. | Yeni sahip eskinin kesrini almasın. |
| G10 | Yarık botları | Dokunulmadı: canlı Yarık odasında bot pilot yok (`thinkBot` yalnız sandbox'ta); galaksi botları Yarık'a uçmuyor. | Plan "arena/bots.ts Asteryum hedeflesin" diyordu; hedefleyecek bot yok. |
| G11 | Bot laboratuvar alışkanlığı | Persona başına `synthesis` alışkanlığı (RAIDER: %30 tur, 3'lü Sessiz İtki, baskında %60 takar; BUILDER %8/1 Örtü/%25; PROSPECTOR %10/1/%30; BALANCED %18/2/%45). Ayrı tohumlu RNG akışı, eski bot zarları kaymaz. | Kapsül kullanımı bir koltuğu ele vermesin; oranlar varsayım, canlıda ölçülecek. |
| G12 | Örtülü uçuşun dönüşü | Savaştan dönen hayatta kalanlar **kapsülsüz** döner (haritada görünür); geri çağrılan (K8) uçuş aynı ayak olduğu için örtü sürer. | Kapsül "bir uçuşluk"; dönüşü de gizlemek bedeli ikiye katlar. |
| G13 | Probe raporundaki "filo dışarıda" | Örtülü saldırının kaynak dünyası probe'lanınca "AWAY + dönüş saati" yine görünür. | Bu, uçuşun kendisi değil probe'lanan dünyanın durumu; gizlemek probe'u yalancı yapar. Sorulacak. |
| G14 | Laboratuvar görseli | ✅ **Owner 2026-11-25: agy ile ürettir.** `synthesis_lab.webp` (bina), `capsule-veil.webp`, `capsule-silent.webp`, `asterium.webp` ikonları; ev ikon dili ve Araştırma Laboratuvarı ile aynı plaka/ışık. Laboratuvar kimya laboratuvarı olarak yeniden tasarlandı: iksir rafı (kapsül kartı: resim, elde ×N, tanesi dk, Asteryum bedeli), çalışan partide şişe rafı (dolu / kaynayan / boş), `flask` glifi. | — |
| G15 | Asteryum'un rengi | ✅ **Owner 2026-11-25: yeni kaynak rengi.** Lavanta `#B48CFF`, `gozlemevi.md` 11. anlam; `--color-v2-asterium`. | — |
| G16 | Yarık içinde fırtına göstergesi | ✅ **Owner 2026-11-25: ekle.** Protokol 18: `welcome.storm` + değişince `{kind:'storm', active}` (MP-06); HUD'da `StormChip`. | — |
| G17 | Kendi örtülü uçuşunun görünümü | ✅ **Owner 2026-11-25: evet, Yarık görünmezlik efektine benzer.** Sunucu: sahibin bekleyen işinde ve klanın trafik kontağında `veiled: true`. Galaksi: gövde Yarık cloak shader'ının lavanta sürümüyle yalnız kenar olarak çizilir (`galaxy/veil.ts`, instanced batch); motor ışığı, iz, bayrak çizilmez. | — |
| G18 | Wiki | ✅ **Düzeltme:** Ay sayfası canlıda ve master'da var (`galaxy.moons`); önceki not yanlıştı. `galaxy.asterium` başlığı eklendi (kaynak, fırtına saati, laboratuvar, 500 hacim kuralı, iki etki, rapor), sayılar kurallardan. | — |

### 10.3c Owner turu 2026-11-25 (lab ortamı sonrası, 8 madde)

| # | İstek | Yapılan |
|---|---|---|
| R1 | Asteryum ikonu (agy) | Ev kaynak ikonlarıyla aynı render dilinde lavanta jeot: `public/assets/images/resources/asterium.webp`, `RESOURCE_ART.asterium`. Laboratuvar plakası, tarif kartları, `CostLine` (dördüncü kaynak, eksikse işaretli), Ay paneli satırı, Yarık dönüş ve test uçuşu çipleri (`HaulChip`, `FARM_ART`; renk noktası yerine ikon). Eski `ui/icons/asterium.webp` silindi. |
| R2 | Kapsül metinleri, "harita" yok | Optik Örtü: "Filon yalnız sana ve klanına görünür…" + yalnız saldırı/klan savaşında "Saldırıda hedefin Radar'ı uyarıyı yine verir." (`capsuleWords`). Sessiz İtki: uyarı/alarm gitmez, savaş raporundan öğrenir, uçuş görünür kalır. Kod doğrulaması: örtü yalnız `missionHidesFromGalaxy`, uyarıyı yalnız `missionSuppressesRadarWarning` keser. Türkçe metinlerde "harita" kalmadı (Yarık'ın mini harita katmanı hariç); kural `docs/ux-writing.md §5`. Diğer dillerde ~74 "map" sıradaki iş. |
| R3 | Taktik iki sekme | `Tactical` bileşeni: Silahlar / Laboratuvar (`GameTabs`); laboratuvar yalnız başkentte ve Asteryum'lu galakside. Laboratuvar kendi bölmesinde: görsel + stok plakası, gelir şeridi (Aylar · Fırtına), Tarifler rafı (yeni kapsül = yeni şişe), sipariş veya damıtıcı. `synthesis_ready` bildirimi `planetId + group:'tactical' + itemId:'synthesis-lab'` taşır, basınca laboratuvar bölmesi açılır. |
| R4 | Kapsüller hep mor olmasın | Optik Örtü inci `#BFE6F7`, Sessiz İtki kor `#D9854A` (`--color-v2-capsule-*`, `gozlemevi.md`). İkonlar agy ile yeni sıvılarla yeniden üretildi; şişe rafı, damıtıcı, kalkış pipleri ve galaksi örtü çizgisi (`VEIL_TONE`) kapsülün kendi tonunda. |
| R5 | Başarım ekranı aşağı uzuyor | Kök neden: dönen ışın katmanı (170vmax) kaydırma alanını büyütüyordu; master'da ve canlıda da vardı. FX katmanına `overflow-hidden`; 350×812'de scrollHeight = clientHeight = 812. |
| R6 | Saldırı sheet'inde Honor bloğu | Tek satıra katlandı ("Denk hedef · yarım karşılık"), kurallar ⓘ arkasında; zayıf hedef uyarısı kapalıyken de görünür. Güç cetveli ve eşleşme satırının altına taşındı. Diğer sheet'ler: Ölüm Yıldızı/radyasyon onay sheet'inde Honor kutusu zaten en altta; Hedef dosyasında Güç'ün üstünde yalnız kademe çipi ve bakış satırı var (kısa, karar için gerekli). |
| R7 | Yeni hesabın taşları/korsanı herkese mi görünüyor | Hayır: `personal_rocks` ve yeni oyuncu korsanı yalnız sahibine. Lab ortamında gördüğün, iki dünyayı yan yana taşımamla ve kamera mesafesiyle ilgiliydi. **Dikkat:** canlıdaki c5e7bdee (probe-battery) master'a birleşmemiş; master'da `personalRocks.ts` / `newcomerScenario.ts` yok. |
| R8 | Yarık telefonda açılmıyor | Kök neden lab kurulumu: worktree'de ref paketi yoktu (symlink) ve arena origin listesi LAN adresini içermiyordu (`ARENA_ALLOWED_ORIGINS`). Telefon yolu (webp paket) LAN IP'den bağlanıyor. Masaüstü headless'ta KTX2 dönüştürücüsünün takıldığı gözlendi; gerçek cihazda doğrulanmadı. |

### 10.3d Owner turu 2026-11-25 (ikinci tur, 8 madde)

| # | İstek | Yapılan |
|---|---|---|
| S1 | Laboratuvardaki Asteryum en üstte ayrı | Laboratuvar bölmesinin ilk satırı stok şeridi (`[data-lab-stock]`: 30 px ikon, "Asteryum stoğu", büyük sayı). Görsel plakasındaki stok kaldırıldı (aynı bilgi iki kez yok). |
| S2 | Ay üretimini azalt | Owner seçimi "herkese yarıya": `moonPerDay` 1 / 1,5 / 2 / 3 (eski 2/3/4/6). Dört Aylı komutan ~7/gün. Küsuratlı oran ekranda dile göre yazılır ("1,5" / "1.5"). |
| S3, S6 | Ay üretimi nereye gidiyor, kolonilerde de var mı | Her Ay, koloniler dahil, ürettiği her birimi o an komutanın Asteryum stoğuna (laboratuvar stoğu) yazar; başkente taşınmaz, yolda yağmalanmaz. Ay panelindeki yeni bölüm bunu tek cümleyle söyler. |
| S4 | Ay menüsünde ince Asteryum bölümü | `MoonAsterium` (`[data-testid=moon-asterium]`, <80 px): ikon, "günde N", "şimdiye kadar N", sıradaki birime dolan çubuk, "Sıradaki birim … sonra" (Ölüm Yıldızı kapalıyken "Kapalı: … sonra yeniden üretir"), nereye gittiği. Sunucu `moons.asterium_produced` (migration 0272) ile Ay'ın o sahibine ödediği birimi sayar; yeni sahip sıfırdan başlar. İstemci sayacı `moonAsteriumReading` ile sunucunun kuralıyla ileri sayar. |
| S5 | Laboratuvar görseli kesik | Bina artık `object-fit: contain`, koyu zemin üzerinde bütün görünüyor (178 px); ad altta, binanın altında. |
| S7 | Yarık'ta Asteryum ambarda yer kaplıyor mu | Evet: her birim 1 ambar birimi, alaşım/kristal/döteryumla aynı. Ambar: Akıncı 300, Kılavuz 400, Muhafız 500 (seviye ile büyür). Fırtına taşı 2 birim; puan değeri 10 (diğerleri 1/2/3). Hedef aktif pilota saatte 6–15, yani ambarın küçük bir kısmı. |
| S8 | Yarık süreleri geri biraz yükselsin | Owner seçimi: ölüm tamiri 15 dk, uçuş sonrası bakım 5 dk (`ARENA_ECONOMY`; eski 3/3, ondan önce 60/10). Amiral eskortu 60/10 aynı. Ücretli tamir (15–30 dk) Yarık ölümünde yine önerilmez. Karar `komutan-gemisi/02-kararlar.md`. |
