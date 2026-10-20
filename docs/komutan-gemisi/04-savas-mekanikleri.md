# Komutan Gemisi — Savaş, yetenekler, çıkış ve alan

> **Durum:** Tasarım + başlangıç değerleri (2026-10-07). **Tüm oyun ayar değerlerinin tek kaynağı
> bu dosyadaki [başlangıç değerleri](#baslangic-degerleri) tablosudur;** kodda
> `packages/rules/src/arena/tuning.ts` olarak yaşar.
> **Hedef okuyucu:** Savaş kurallarını (`rules/arena`) ve sunucu odasını yazacak agent.
> **Dayanak:** S18–S37, S43–S44, S64–S79 ([01](01-urun.md)); KG-K4, KG-K5, KG-K9, KG-K10, KG-K11,
> KG-T15–T20 ([02](02-kararlar.md)).

Her kural **sunucuda** uygulanır (S51). İstemci aynı fonksiyonları yalnız tahmin ve görsel için koşar.

---

## 1. Pilot durum makinesi

```
            ┌────────────── hasar alınca sayaç sıfırlanır ─────────────┐
 spawn ──► flying ──(çıkış alanında, durdu)──► exiting ──(3 sn hasarsız)──► extracted
   │         │  ▲                                  │
   │ kalkan  │  └──────────(hareket / alandan çıkış)┘
   │ (60 sn) ├──(gövde ≤ 0)─────────────────────────────────────────────► destroyed ─► towed
   │         ├──(yakıt = 0)──► fuelOut (kurtarma sayacı) ───────────────────────────► towed
   │         └──(girdi yok, linkLostAfter)──► linkLost (30 sn) ──(dönerse)──► flying
   │                                         └──(dönmezse)──────────────────────────► towed
```

`exiting`, `flying`'in alt durumudur: çıkış alanında ve `s = 0`. `extracted` ve `towed` uçlarında
gemi dünyadan çıkar ve sonuç ekranı açılır ([07](07-hud-ve-ekranlar.md#sonuc-ekranlari)).

<a id="durum-olay"></a>
**Durum × olay kuralları** (prototip varsayılanı; F5'ten önce sahip onayı, [KG-A27](02-kararlar.md#kg-a27)):

| Olay ↓ · durum → | `flying` | `fuelOut` | `linkLost` |
|---|---|---|---|
| Oyuncu girdisi | uygulanır | **hiçbiri** uygulanmaz (yön, ateş, yetenek dahil) | yok; aynı soketten yeniden gelirse → `flying` |
| Gaz | oyuncunun | zorla 0 | zorla 0 |
| İsabet | hasar; kalkan varsa söner | aynı | aynı |
| Kalkan | ateş / çıkış alanı / kargo / süre ile biter | kendi süresinde biter | kendi süresinde biter |
| Aktif duman, görünmezlik | sürer | süresi dolunca biter | süresi dolunca biter |
| Çıkış sayacı (alanda, `s = 0`) | ilerler | **ilerler** — çıkışa ulaşmış gemi durmak için yakıt istemez | **ilerler** — çıkış fiziksel kuraldır |
| Gövde ≤ 0 | `destroyed` | `destroyed` | `destroyed` |
| Yakıt 0 | → `fuelOut` | — | yakıt yanmaya devam eder; 0 olursa kurtarma sayacı da başlar |
| Sayaç doldu | — | `towed` | `towed` |
| Yeni soketle `hello` | devralır (eski soket `replaced`) | devralır, `fuelOut` sürer | devralır → `flying` |

İki sayaç birlikte işliyorsa önce dolan çeker (sonuç aynı). Çekilmeden önce çıkış sayacı dolarsa
`extracted`.

## 2. Ateş ve mermi

- **Ateş (S64):** ATEŞ basılıyken `fireRate` hızında; sol/sağ namlu sırayla. İlk mermi basışta.
  Her atış `shotFuelCost` döteryum düşer (KG-K11, tek ortak depo); yakıt yetmezse atış olmaz.
- **Doğuş:** namlu noktasından (`rules/arena` verisi, modelden değil — KG-T26), nişangâh
  doğrultusunda `convergeDist` uzaklıktaki noktaya doğru, üstüne dağılım (§3).
- **Hız:** `gemi hızı + yön · muzzleSpeed` (miras, KG-T15). **Takip yok** (S65).
- **Ömür:** `projectileLife` sonra yok olur → menzil sınırlı; uzaklaşan oyuncu kurtulur (S70).
- **Çarpışma (S68):** her tick, merminin o tick'te kat ettiği segment, hedefin aynı tick'teki
  hareketine **göre** süpürülür (göreli segment–küre). Hedefler: atan hariç tüm gemi küreleri
  (`shipHitRadius`), asteroit ve yapı küreleri (siper — mermiyi durdurur). İlk çarpan kazanır.
- **Hasar:** isabet başına `damage`. **Fiziksel isabete ek ıskalama zarı yok** (S66).
- Kalkanlı gemiye çarpan mermi kalkanda söner: hasar yok, ayırt edici "kalkan" kıvılcımı + sesi
  (saldırgan neden hasar veremediğini anlar).

## 3. Dağılım (isabet oranı)

- İsabet seviyesi → koni yarı açısı (`spreadBase` → en yüksek seviyede `spreadMin`). Geliştikçe
  dağılım daralır (S66); nişan kontrolü değişmez (S55).
- Yön: koni içindeki birim disk noktalarından oluşan **sabit tablo** (256 nokta, **merkez
  ağırlıklı**: noktaların ~%60'ı yarı yarıçap içinde). Tablo kaynakta **sabit sayılar** olarak
  durur (bir kerelik üretim betiğiyle yazılır); çalışma anında trigonometri yok (KG-T11).
- İndeks: `seededFrom(lifeSeed, shotIndex)` (`rules/rng.ts`). `lifeSeed` sunucu tarafından her
  doğuşta verilir, sahibine `welcome`'da gider → istemcinin çizdiği iz sunucu mermisiyle aynı.
  Risk: değiştirilmiş istemci sıradaki sapmayı bilir; kazanç koni içiyle sınırlı, kabul edildi.
- **Hedef (S67):** başlangıç gemisiyle, 300 m'deki bir gemiye doğru nişan alınmış atışların
  **~%80'i** isabet eder. Test: tablo + `spreadBase` ile analitik oran.

## 4. Hasar ve öldürme süresi (TTK)

- Hedef (S75): eşit başlangıç gemilerinde, iyi nişanla (~%60 isabet) **ilk isabetten ölüme
  7–9 sn**. Bu süre kurbanın hasar yönünü görmesine, arka görüşe bakmasına, duman/turbo/manevra
  kullanmasına yeter. Tablodaki değerler bu hedefi verir (400 / (8 × 10) = 5 sn %100 isabette,
  ~8 sn %60'ta). Botlu senaryoda ölçülür ve kaydedilir ([11](11-test-ve-playtest.md)).

## 5. Yetenekler

**Turbo (S23, S78)**
- Şarj `turboCharge` saniye; aktifken saniyede 1 azalır; bırakınca `turboRegenDelay` sonra
  `turboRegen` hızında dolar. En az `turboMinStart` şarjla başlar.
- Basılı = şarj bitene kadar; kısa basış = `turboTapBurst` süreli patlama.
- Etki: gazdan bağımsız hedef hız `speedMax · turboSpeedMul` (KG-K26), `turboAccelMul`, dönüş tavanı
  `turboTurnMul` (< 1), ek yakıt `turboBurn`. Bırakınca gemi `decel` ile gaz hızına süzülür.

**Duman (S22, S56, S76)**
- Dokununca `smokeEmitDuration` boyunca kuyruktan `smokePuffInterval` aralıkla küre bulutlar
  bırakır; her bulut `smokeGrow` içinde `smokeRadius`'a büyür, `smokeLife` yaşar. Bekleme `smokeCooldown`.
- **Yalnız görüş:** hasar yok, hız etkisi yok, mermiyi durdurmaz.
- Görüş hattı fonksiyonu `lineOfSight(from, to, puffs)` (KG-T18): bakan → hedef segmenti bir
  bulutun etkin yarıçapını kesiyorsa hedef **görünmez sayılır** → isim etiketi, hedef çerçevesi,
  önleme işareti, ekran dışı göstergesi gösterilmez (S76). Prototipte istemci uygular; herkese
  açık yayından önce sunucu da snapshot'tan çıkarır.
- Bulutlar arka görüşte de görünür (kendi dumanın arkanı kapatır — bilinçli takas).

**Görünmezlik (S24, S77, KG-K4)**
- `cloakDuration` sürer; bitince `cloakCooldown` başlar.
- **Ateş anında bozulur** (sunucu, atış girdisini işlediği tick'te). Bozulma hem sahibine hem
  çevreye görünür (titreşimli beliriş efekti + ses). Süre dolunca sahibine "GÖRÜNMEZLİK BİTTİ".
- **Hasar alır** (KG-K4). İsabet kıvılcımı vuran tarafa görünür (konumu anlık ele verir — adil).
  Hasar almak görünmezliği bozmaz (prototip varsayılanı, [KG-A25](02-kararlar.md#kg-a25)).
- Sunucu görünmez gemiyi diğerlerinin snapshot'ına koymaz; yalnız `cloakShimmerDist` içinde
  "titreşim" bayrağı (KG-T17). Motor izi, isim etiketi, hedef çerçevesi, arka görüşteki görüntü,
  motor sesi başkalarında yoktur.
- Sahibinin ekranında: hafif renk filtresi + "GÖRÜNMEZ 3,2 sn" sayacı.

**Doğuş kalkanı (S29, KG-K9)**
- `spawnShield` saniye. Biter: **ateş** (spec) — prototip varsayılanıyla ayrıca **çıkış alanına
  giriş** ve **kargo toplama** (KG-K9, sahip onayladı) — ya da süre dolunca.
- Kalkan başkalarına balon olarak görünür; sahibinin HUD'unda geri sayım. Kalkış anı **nedeniyle**
  açıkça gösterilir (S58): "KALKAN KALKTI — ateş ettin" · "— çıkış alanına girdin" · "— kargo
  aldın" · "— süre doldu".

## 6. Çıkış (S30–S31, S57, S79)

Çıkış alanı: işaret fenerinin çevresinde `exitRadius` küresi. Sayaç yalnız **alan içinde ve
tam durmuşken** (`s = 0`) ilerler, `exitHold` saniyeye ulaşınca `extracted`.

| Durum | HUD metni (örnek) | Sayaç |
|---|---|---|
| Alan dışında | ekran dışı gösterge "ÇIKIŞ • 850 m" | — |
| Alanda, hareket ediyor | "Çıkış alanındasın — tamamen dur" + hız | durur |
| Alanda, durdu | "Gemi durdu — hasar almadan bekle · 2/3 sn" | ilerler |
| Sayaçta hasar aldı | "Hasar aldın — sayaç sıfırlandı" | 0'a döner, durmaya devam ederse yeniden başlar |
| Sayaçta gaz verdi / kımıldadı | "Hareket ettin — sayaç sıfırlandı" | 0 |
| Alandan çıktı | gösterge geri gelir | 0 |
| Tamamlandı | "Ana gezegene dönülüyor" | → sonuç ekranı |

- Sayacı yalnız **hasar** ve **hareket** (`s > 0`; turbo dahil) sıfırlar. Yerinde dönmek hareket
  değildir. Ateş etmek sıfırlamaz (spec yasaklamıyor); duman ve görünmezlik kullanılabilir (çıkışı
  korumak bilinçli taktik) ([KG-A26](02-kararlar.md#kg-a26)).
- Bağlantı kopması ve yakıt bitmesinde sayaç sürer ([§1 tablosu](#durum-olay)).
- "Neden başlamadı / neden kesildi" her zaman metinle söylenir (S57).

## 7. Yok edilme (S32–S34)

- Gövde ≤ 0 → `destroyed`. Olay: öldüren, konum, son hasarın yönü.
- Patlama efekti; gemi dünyadan çıkar. Kargo `cargoScatterCount` kapsüle bölünüp patlama
  noktasından rastgele (tohumlu) hızlarla saçılır, yavaşlar, `dropLife` sonra kaybolur.
  Kapsülü **herkes** (öldüren dahil) üstünden geçerek alır (`pickupRadius`, ambar kapasitesi kadar).
- Kalan yakıt ve mühimmat korunur (S34); gemi eve çekilir, tamir gerekir (S33; F8).
- Sonuç ekranı: seni kim, kaç metreden vurdu · aldığın hasar · düşen kargo · korunan yakıt ·
  "Tamir gerekli" · **"Ana gezegene dön"**. Prototipte buton galaksiye döner; dev modunda ayrıca
  "Tekrar gir".

<a id="yakit-bitmesi"></a>
## 8. Yakıt bitmesi (S35–S37, KG-K10)

Yakıt 0 → motor kapanır (gaz zorla 0), gemi yavaşlayıp durur, **hiçbir girdi alınmaz**. HUD
"Yakıt bitti — kurtarma yolda · 10 sn"; gemi **`fuelOutRescueDelay` boyunca savunmasızdır**
(sahip kararı, KG-K10). Süre bitince `towed`: yeni hasar yok, eski hasar kalır (S36), kargo
**o konuma** kapsül olarak bırakılır (S37). Bu sürede yok edilirse yok edilme kuralları geçerlidir.
Çıkış alanında durmuşken yakıt biterse sayaç sürer ([§1](#durum-olay)).

<a id="baglanti-kopmasi"></a>
## 9. Bağlantı kopması ve arka plan (KG-K5)

- Girdi gelmeyince sunucu son girdiyi en çok `inputRepeatMax` tick tekrar eder, sonra nötr girdi
  uygular (yön 0, ateş ve turbo kapalı, gaz yerinde).
- `linkLostAfter` boyunca girdi gelmezse veya soket kapanırsa `linkLost`: gaz zorla 0, gemi durur,
  yeni yetenek yok (aktif olan kendi süresinde biter), **savunmasız**. Kalkan ve çıkış sayacı:
  [§1 tablosu](#durum-olay).
- `linkLostGrace` (kesin) içinde dönen oyuncu kaldığı yerden sürer ("Bağlantı geri geldi"): aynı
  soketten girdi yeniden gelirse doğrudan, yeni soketse `hello` (`resume`) ile. Dönmezse `towed`:
  yakıt bitmesiyle aynı sonuç (yeni hasar yok, kargo düşer).
- İstemci `visibilitychange` ile görünür olunca yeniden bağlanır ve kalan süreyi gösterir. Android
  arka plandaki sayfayı bellekten atabilir; bu yüzden giriş anında `sessionStorage`'a niyet yazılır
  ve açılışta varsa doğrudan `resume` ile bağlanılır ([06 §3](06-istemci.md#uygulama-dali)).
  Telefonu kilitlemek de bu kurala tabidir; giriş ekranında ve ayarlarda yazılı.

## 10. Kargo — test yükü (F5) ve sonrası (F9)

- F9'a kadar her pilot `testCargo` birim **TEST** kargosuyla doğar (S44). AMBAR göstergesi onu
  gösterir. Çıkışta "60 TEST kargo kurtarıldı"; yok edilme/yakıt/kopmada kapsül olarak düşer.
- **TEST kargo hiçbir zaman başkente yatırılmaz** (F8'de de): yalnız sortie istatistiğine yazılır.
  Yoksa her doğuş bedava kaynak basar. Gerçek kargo F9'da gelir.
- **Kısmi toplama:** kapsülden ambara sığdığı kadar alınır, kalanı kapsülde kalır.
- **Değişmez:** odadaki toplam kargo yalnız çıkışla ve kapsül kaybolmasıyla azalır (test edilir).
- Gerçek kaynak toplama yöntemi [KG-A12](02-kararlar.md#kg-a12), F9.

## 11. Alan yerleşimi (`rules/arena/layout.ts`)

- Küre `arenaRadius`, referans düzlem y = 0 (roll dengelemesi buna göre, [03](03-ucus-ve-kontroller.md)).
- **Merkez:** giriş `(0, +centerSplit, 0)`, çıkış `(0, −centerSplit, 0)` — ikisi ayrı (doğan
  oyuncu çıkışın üstüne düşmesin).
- **Dış çember** (`ringRadius`): girişler 0°, 120°, 240°; çıkışlar 60°, 180°, 300° (girişle çıkış
  arası en geniş açıda). S27'yi birebir karşılar.
- Doğuş: dört girişten **rastgele biri** (S28), `spawnJitter` içinde. Burun **yatay**: dış
  girişlerde merkeze doğru, merkez girişte rastgele bir yatay yöne (aşağıdaki çıkışa bakmaz; roll
  dengelemesi dik bakışta kapalıdır).
- Çevre: asteroit kümeleri (statik küreler, çeşitli boyut), enkaz, dış çıkışların yanında birer
  yapı (yer işareti + siper), çıkışlarda dikey ışıklı fener ve zeminde halka (görsel 01). Kamera
  yakınında yalnız istemcide toz/çizgi parçacıkları: hız ve yön hissi (S47). Merkez koridorlar
  sade tutulur (S56).
- Yerleşimin `layoutVersion`'ı protokolde; uyuşmazlık = protokol hatası (KG-T8).
- Sınır: KG-T20.

## 12. Çıkış kampı riski (S79, KG-A22)

Ölçülecek: çıkışa 400 m içinde gerçekleşen ölümlerin oranı · ortalama çıkış süresi · "kampçı"
bot senaryosunda taşıyıcının çıkış başarı oranı. Sonuçla birlikte KG-A22'deki önlemler sahibe sunulur.

<a id="baslangic-degerleri"></a>
## 13. Başlangıç değerleri (hipotez — tek kaynak)

Kesin olanlar spec'ten gelir ve değiştirilmez (✱). Diğerleri kovalamaca senaryosuyla ayarlanır.
Diğer belgeler bu değerleri **adıyla** anar; çelişki olursa bu tablo geçerlidir.

| Ad | Değer | Not |
|---|---|---|
| `tickRate` / `snapshotRate` | 30 Hz / 15 Hz | KG-T10 |
| `arenaRadius` / `arenaHalfHeight` | 2600 m / ±650 m | düz disk (KG-T33): tam gazda çaprazlama ≈ 43 sn |
| `ringRadius` | 2050 m | dış giriş/çıkış çemberi |
| `centerSplit` | 380 m | merkez giriş ↔ çıkış ayrımı (yarısı); merkez istasyonun üstü ve altı |
| `spawnJitter` / `spawnClear` | 60 m / 160 m | girişin çevresi her zaman açık |
| `exitRadius` | 120 m | |
| `exitHold` ✱ | 3 sn | S31 |
| `spawnShield` ✱ | 60 sn | S29 |
| `speedMax` | 120 m/s | referans HUD "HIZ 120" |
| `accel` / `decel` | 34 / 20 m/s² | 0→120 ≈ 3,5 sn; 120→0 ≈ 6 sn (süzülerek durur) |
| `stopEpsilon` | 0,5 m/s | altı tam 0 |
| `turnRateMax` / `slowTurnBonus` | 1,25 rad/sn (~72°/sn) / +%30 | %50 gazda ~82°/sn, durmuşken ~93°/sn; hız yönetimi beceridir (KG-T35) |
| `turnResponse` | 0,06 sn | aşmasız yaklaşma |
| `turnStopRatio` | 0,05 | o anki dönüş tavanına oranla; nötr girdide en çok dört tick |
| `stickLinear` / `deadzone` | 0,15 / 0,06 | merkezde çok yumuşak, kenarda tam dönüş ([03 §4](03-ucus-ve-kontroller.md)) |
| `rollLevelRate` | 1,5 /sn | |
| `turboSpeedMul` / `turboAccelMul` / `turboTurnMul` | 1,8 / 7 / 0,6 | turbo 216 m/s, her gazda; 60 → 216 ≈ 0,65 sn |
| `turboCharge` / `turboRegen` / `turboRegenDelay` | 6 sn / 0,8 sn/sn / 1 sn | boştan dolum 7,5 sn (+1 sn bekleme) |
| `turboMinStart` / `turboTapBurst` | 0,3 sn / 0,35 sn | |
| `fuelTank` | 100 | döteryum birimi |
| `throttleBurn` / `idleBurn` / `turboBurn` | 0,25 / 0,02 / +0,25 /sn | tam gazda 100 / 0,27 ≈ 6,2 dk; sürekli ateşte ≈ 3,9 dk (KG-A19) |
| `shotFuelCost` | 0,02 /atış | KG-K11 |
| `hull` | 400 | |
| `damage` | 10 /isabet | |
| `fireRate` | 8 /sn | sol-sağ sırayla |
| `muzzleSpeed` | 600 m/s | + gemi hızı |
| `projectileLife` | 1,5 sn | menzil ≈ 900–1080 m |
| `convergeDist` | 350 m | |
| `spreadBase` / `spreadMin` | 1,5° / 0,5° | yarı açı |
| `shipHitRadius` | 6 m | görsel gemi boyu 15 m |
| `landSpeed` / `landSettle` / `landedYawRate` | 24 m/s / 0,35 sn / 1,2 rad/sn | bu hızın altında temas = iniş (KG-K21) |
| `liftSpeed` / `liftTicks` / `landedTurboRegenMul` | 14 m/s / 12 tick / ×2 | kalkış itişi; inişte turbo iki kat dolar |
| `bounce` / `bounceLoss` / `knockDecay` | 0,6 / 0,85 / 1,6 /sn | sekme: dik yaklaşma × 0,6 geri itme; kafa kafaya ileri hızın %85'i gider |
| `mineRate` / `crystalReserve` / `crystalRegen` | 4 /sn / 40 / 0,35 /sn | tükenen kristal yarısına dolana kadar kazılmaz |
| `gimbalCos` / `gimbalRange` | cos 3,5° / 700 m | namlu, burna yakın görünür hedefin önleme noktasına döner (KG-K20) |
| `assistMax` / `assistCos` / `assistRange` | 0,32 / cos 9° / 900 m | ateş ederken direksiyon mıknatısı; sunucu kırpar |
| `botRespawn` | 8 sn | |
| `smokeEmitDuration` / `smokePuffInterval` | 1,5 sn / 0,15 sn | |
| `smokeRadius` / `smokeGrow` / `smokeLife` / `smokeCooldown` | 45,5 m / 0,6 sn / 10,5 sn / 18 sn | sahip 2026-10-21: süre +%50, alan +%30, görsel yoğunluk +%25 |
| `cloakDuration` / `cloakCooldown` / `cloakShimmerDist` | 4 sn / 25 sn / 60 m | |
| `fuelOutRescueDelay` | 10 sn | KG-K10 |
| `linkLostAfter` | 1 sn | mobil ağda sert gelirse 2–3 sn |
| `linkLostGrace` ✱ | 30 sn | KG-K5 |
| `inputBuffer` / `inputQueueMax` / `inputRepeatMax` | 3 tick / 12 / 9 tick (KG-K27) | [05 §6](05-ag-ve-sunucu.md#girdi) |
| `resultKeep` | 10 dk | yeniden bağlanana son sonuç ([05 §3](05-ag-ve-sunucu.md#uc-nokta)) |
| `testCargo` / `cargoCapacity` | 60 / 100 | |
| `cargoScatterCount` / `pickupRadius` / `dropLife` | 6 / 25 m / 300 sn | |
| `roomCap` | 48 | KG-T4 |
| `interpDelay` | 133 ms (iki snapshot aralığı; uyarlanır 133–200) | KG-T14 |
| `extrapolationCap` / `headStartCap` | 150 ms / 100 ms | KG-T14, KG-T15 |
| `aoiRadius` | 1600 m | snapshot'a giren uzaklık |
| `offscreenEnemyDist` | 800 m | [07](07-hud-ve-ekranlar.md) |
| `boundaryWarn` | 200 m | KG-T20; sınır ızgarası yaklaşınca belirir |

**Değişiklik günlüğü:** her değişiklik bu tablonun altına tek satır: tarih · ad · eski → yeni ·
neden (hangi gözlem/ölçüm).

- 2026-10-08 · alan küreden diske: `arenaRadius` 3000 → 2600, `arenaHalfHeight` yeni ±650 · sahip: "ne sürekli
  savaş ne 10 dk arama"; düz referans düzlemi yön bulmayı kolaylaştırır, sık kuşak yine kaybettirir.
- 2026-10-08 · `accel` 30 → 34, `decel` 40 → 42 · 3. şahıs kamerada hızlanma/yavaşlama daha hissedilir.
- 2026-10-08 · iniş, kazı, nişan yardımı ve yavaş dönüş bonusu değerleri eklendi (KG-K20, KG-K21).
- 2026-10-08 · `decel` 42 → 20 · sahip: "hızı kesince çok hızlı duruyor".
- 2026-10-08 · `stickLinear` 0,3 → 0,15 ve çubuk yarıçapı 52 → 64 px · sahip: "joystick fazla hassas".
- 2026-10-08 · `scrapeKeep` kaldırıldı, `bounce`/`bounceLoss`/`knockDecay` eklendi · sahip: belli hızın üstünde sekme.
- 2026-10-09 · `turboSpeedMul` 1,6 → 1,8, `turboAccelMul` 2 → 3,5, `turboCharge` 3 → 6, `turboRegen` 0,4 → 0,8;
  turbo hedefi gazdan bağımsız · sahip: "turbo biraz daha hızlı, 2 kat uzun, dolum aynı" (KG-K26).
- 2026-10-09 · `turboAccelMul` 3,5 → 7 · sahip: "turbo ivmelenme olmamış".
- 2026-10-09 · `turnRateMax` 90 → ~72°/sn, `slowTurnBonus` 0,45 → 0,3, çubuk yarıçapı 64 → 72 px · sahip: "yön
  değiştirme seri, nişan almak zor".

## 14. Ayar yöntemi (S82)

Değerler yalnız kovalamaca senaryosu üzerinden değiştirilir: kargo taşıyan kurban + saldırgan,
botlarla ve sahiple. Ölçülenler: uzaklık ve gecikme kovasına göre isabet oranı, gözlenen TTK,
doğru oynayan kurbanın kaçış oranı, iyi oynayan saldırganın yakalama oranı, çıkış süresi,
çıkış çevresindeki ölümler. Hedef: **ikisi de mümkün** — kurban zamanında tepkiyle kaçabilir,
saldırgan iyi takip ve nişanla yakalayabilir. Protokol: [11](11-test-ve-playtest.md).
