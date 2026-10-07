# Komutan Gemisi — Savaş, yetenekler, çıkış ve alan

> **Durum:** Tasarım + başlangıç değerleri (2026-10-07). **Tüm sayıların tek kaynağı bu
> dosyadaki [başlangıç değerleri](#baslangic-degerleri) tablosudur;** kodda
> `packages/rules/src/arena/tuning.ts` olarak yaşar.
> **Hedef okuyucu:** Savaş kurallarını (`rules/arena`) ve sunucu odasını yazacak agent.
> **Dayanak:** S18–S37, S43–S44, S64–S79 ([01](01-urun.md)); KG-K4, KG-K5, KG-A1, KG-A2, KG-A3,
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
   │         ├──(yakıt = 0)──► fuelOut (10 sn savunmasız) ──────────────────────────► towed
   │         └──(girdi sessiz ≥1 sn)──► linkLost (30 sn) ──(dönerse)──► flying
   │                                         └──(dönmezse)──────────────────────────► towed
```

`extracted` ve `towed` uçlarında gemi dünyadan çıkar ve sonuç ekranı açılır ([07](07-hud-ve-ekranlar.md#sonuc-ekranlari)).
`fuelOut` ve `linkLost` sırasında yok edilirse sonuç `destroyed`'dır.

## 2. Ateş ve mermi

- **Ateş (S64):** ATEŞ basılıyken `fireRate` hızında; sol/sağ namlu sırayla. İlk mermi basışta.
  Her atış `shotFuelCost` döteryum düşer (KG-A3, tek depo varsayımı); yakıt yetmezse atış olmaz.
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
- Etki: `turboSpeedMul`, `turboAccelMul`, dönüş tavanı `turboTurnMul` (< 1), ek yakıt `turboBurn`.

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
  çevreye görünür (titreşimli belirிş efekti + ses).
- **Hasar alır** (KG-K4). İsabet kıvılcımı vuran tarafa görünür (konumu anlık ele verir — adil).
  Hasar almak görünmezliği bozmaz (prototip varsayılanı, [KG-A25](02-kararlar.md#kg-a25)).
- Sunucu görünmez gemiyi diğerlerinin snapshot'ına koymaz; yalnız `cloakShimmerDist` içinde
  "titreşim" bayrağı (KG-T17). Motor izi, isim etiketi, hedef çerçevesi, arka görüşteki görüntü,
  motor sesi başkalarında yoktur.
- Sahibinin ekranında: hafif renk filtresi + "GÖRÜNMEZ 3,2 sn" sayacı.

**Doğuş kalkanı (S29, KG-A1)**
- `spawnShield` saniye. Biter: **ateş** (spec) — prototip varsayılanıyla ayrıca **çıkış alanına
  giriş** ve **kargo toplama** (KG-A1, sahibe F0'da sorulur) — ya da süre dolunca.
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
| Sayаçta hasar aldı | "Hasar aldın — sayaç sıfırlandı" | 0'a döner, durmaya devam ederse yeniden başlar |
| Sayaçta gaz verdi / kımıldadı | "Hareket ettin — sayaç sıfırlandı" | 0 |
| Alandan çıktı | gösterge geri gelir | 0 |
| Tamamlandı | "Ana gezegene dönülüyor" | → sonuç ekranı |

- Sayacı yalnız **hasar** ve **hareket** sıfırlar. Ateş etmek sıfırlamaz (spec yasaklamıyor);
  duman ve görünmezlik kullanılabilir (çıkışı korumak bilinçli taktik); turbo hareket demektir
  ([KG-A26](02-kararlar.md#kg-a26)).
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
## 8. Yakıt bitmesi (S35–S37, KG-A2)

Yakıt 0 → motor kapanır (gaz zorla 0), gemi yavaşlayıp durur, HUD "Yakıt bitti — kurtarma yolda
· 10 sn" ve gemi **`fuelOutRescueDelay` boyunca savunmasızdır** (prototip varsayılanı, KG-A2).
Süre bitince `towed`: yeni hasar yok, eski hasar kalır (S36), kargo **o konuma** kapsül olarak
bırakılır (S37). Bu sürede yok edilirse yok edilme kuralları geçerlidir.

<a id="baglanti-kopmasi"></a>
## 9. Bağlantı kopması ve arka plan (KG-K5)

- Sunucu, `linkLostAfter` boyunca girdi gelmezse veya soket kapanırsa `linkLost`'a geçer:
  gaz zorla 0, gemi durur, yeni yetenek yok (aktif olan kendi süresinde biter), **savunmasız**.
- `linkLostGrace` (30 sn, kesin) içinde aynı hesap `hello` ile dönerse kontrol geri verilir
  ("Bağlantı geri geldi"). Dönmezse `towed`: yakıt bitmesiyle aynı sonuç (yeni hasar yok, kargo düşer).
- İstemci `visibilitychange` ile görünür olunca kendiliğinden yeniden bağlanır ve kalan süreyi
  gösterir. Telefonu kilitlemek de bu kurala tabidir; giriş ekranında ve ayarlarda yazılı.

## 10. Kargo — test yükü (F5) ve sonrası (F9)

- F9'a kadar her pilot `testCargo` birim **TEST** kargosuyla doğar (S44). AMBAR göstergesi onu
  gösterir. Çıkışta "60 test kargo eve ulaştı"; yok edilme/yakıt/kopmada kapsül olarak düşer.
- **Değişmez:** odadaki toplam kargo yalnız çıkışla ve kapsül kaybolmasıyla azalır (test edilir).
- Gerçek kaynak toplama yöntemi [KG-A12](02-kararlar.md#kg-a12), F9.

## 11. Alan yerleşimi (`rules/arena/layout.ts`)

- Küre `arenaRadius`, referans düzlem y = 0 (roll dengelemesi buna göre, [03](03-ucus-ve-kontroller.md)).
- **Merkez:** giriş `(0, +centerSplit, 0)`, çıkış `(0, −centerSplit, 0)` — ikisi ayrı (doğan
  oyuncu çıkışın üstüne düşmesin).
- **Dış çember** (`ringRadius`): girişler 0°, 120°, 240°; çıkışlar 60°, 180°, 300° (girişle çıkış
  arası en geniş açıda). S27'yi birebir karşılar.
- Doğuş: dört girişten **rastgele biri** (S28), `spawnJitter` içinde, merkeze bakarak.
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

| Ad | Değer | Not |
|---|---|---|
| `tickRate` / `snapshotRate` | 30 Hz / 15 Hz | KG-T10 |
| `arenaRadius` | 3000 m | |
| `ringRadius` | 2200 m | dış giriş/çıkış çemberi |
| `centerSplit` | 350 m | merkez giriş ↔ çıkış ayrımı (yarısı) |
| `spawnJitter` | 80 m | |
| `exitRadius` | 120 m | |
| `exitHold` ✱ | 3 sn | S31 |
| `spawnShield` ✱ | 60 sn | S29 |
| `speedMax` | 120 m/s | referans HUD "HIZ 120" |
| `accel` / `decel` | 30 / 40 m/s² | 0→120 ≈ 4 sn; 120→0 ≈ 3 sn |
| `stopEpsilon` | 0,5 m/s | altı tam 0 |
| `turnRateMax` | 90°/sn | 180° ≈ 2 sn |
| `turnResponse` | 0,06 sn | aşmasız yaklaşma |
| `stickLinear` / `deadzone` | 0,3 / 0,06 | [03 §4](03-ucus-ve-kontroller.md) |
| `rollLevelRate` | 1,5 /sn | |
| `turboSpeedMul` / `turboAccelMul` / `turboTurnMul` | 1,6 / 2,0 / 0,6 | |
| `turboCharge` / `turboRegen` / `turboRegenDelay` | 3 sn / 0,4 sn/sn / 1 sn | |
| `turboMinStart` / `turboTapBurst` | 0,3 sn / 0,35 sn | |
| `fuelTank` | 100 | döteryum birimi |
| `throttleBurn` / `idleBurn` / `turboBurn` | 0,25 / 0,02 / +0,25 /sn | tam gazda ≈ 6,7 dk (KG-A19) |
| `shotFuelCost` | 0,02 /atış | KG-A3 |
| `hull` | 400 | |
| `damage` | 10 /isabet | |
| `fireRate` | 8 /sn | sol-sağ sırayla |
| `muzzleSpeed` | 600 m/s | + gemi hızı |
| `projectileLife` | 1,5 sn | menzil ≈ 900–1080 m |
| `convergeDist` | 350 m | |
| `spreadBase` / `spreadMin` | 1,5° / 0,5° | yarı açı |
| `shipHitRadius` | 6 m | |
| `smokeEmitDuration` / `smokePuffInterval` | 1,5 sn / 0,15 sn | |
| `smokeRadius` / `smokeGrow` / `smokeLife` / `smokeCooldown` | 35 m / 0,6 sn / 7 sn / 18 sn | |
| `cloakDuration` / `cloakCooldown` / `cloakShimmerDist` | 4 sn / 25 sn / 60 m | |
| `fuelOutRescueDelay` | 10 sn | KG-A2 |
| `linkLostAfter` / `linkLostGrace` ✱ | 1 sn / 30 sn | KG-K5 |
| `testCargo` / `cargoCapacity` | 60 / 100 | |
| `cargoScatterCount` / `pickupRadius` / `dropLife` | 6 / 25 m / 300 sn | |
| `roomCap` | 48 | KG-T4 |
| `interpDelay` | 100 ms (uyarlanır 100–200) | KG-T14 |
| `extrapolationCap` / `headStartCap` | 150 ms / 100 ms | KG-T14, KG-T15 |
| `aoiRadius` | 1500 m | snapshot'a giren uzaklık |
| `offscreenEnemyDist` | 800 m | [07](07-hud-ve-ekranlar.md) |
| `boundaryWarn` | 150 m | KG-T20 |

**Değişiklik günlüğü:** her değişiklik bu tablonun altına tek satır: tarih · ad · eski → yeni ·
neden (hangi gözlem/ölçüm).

## 14. Ayar yöntemi (S82)

Değerler yalnız kovalamaca senaryosu üzerinden değiştirilir: kargo taşıyan kurban + saldırgan,
botlarla ve sahiple. Ölçülenler: uzaklık ve gecikme kovasına göre isabet oranı, gözlenen TTK,
doğru oynayan kurbanın kaçış oranı, iyi oynayan saldırganın yakalama oranı, çıkış süresi,
çıkış çevresindeki ölümler. Hedef: **ikisi de mümkün** — kurban zamanında tepkiyle kaçabilir,
saldırgan iyi takip ve nişanla yakalayabilir. Protokol: [11](11-test-ve-playtest.md).
