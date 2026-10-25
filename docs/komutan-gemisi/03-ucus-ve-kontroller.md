# Komutan Gemisi — Uçuş ve kontroller

> **Durum:** MVP'de uygulandı (2026-10-08); kamera 3. şahıs (KG-K19), hafif nişan yardımı (KG-K20)
> ve iniş yardımı (KG-T41) eklendi. Sayılar burada **değil**,
> [04 §Başlangıç değerleri](04-savas-mekanikleri.md#baslangic-degerleri) tablosundadır; burada
> parametre adları ve kurallar var.
> **Hedef okuyucu:** Uçuş simülasyonunu ve dokunmatik kontrolleri yazacak agent.
> **Dayanak:** S9–S17, S53–S55, S61–S63, S85 ([01](01-urun.md)); KG-T11, KG-T13, KG-T30 ([02](02-kararlar.md)).

---

## 1. Başarı tanımı

Sahibin cümlesiyle: oyuncu **istediği manevrayı zorlanmadan** yapar; küçük parmak hareketi
hassas düzeltme, büyük hareket rahat dönüş; **bıraktığında dönüş durur**, gemi doğrultusunu
korur; hedefi sürekli aşmaz; kamera sallanmaz; gaz, yön, ateş ve yetenekler **iki başparmakla
birlikte** kullanılır. Bunun kanıtı testler değil, **sahibin telefonda kovalamaca senaryosunu
rahat oynamasıdır** (S80–S83). Testler yalnız kuralların doğru çalıştığını kanıtlar.

## 2. Uçuş modeli (`packages/rules/src/arena/flight.ts`)

Sabit adım `dt = 1/30 s` (KG-T10). Birimler metre, saniye, radyan.

**Durum:** konum `p`, yönelim `q` (birim kuaterniyon), skaler hız `s ≥ 0`, gaz `τ ∈ [0,1]`,
açısal hız `ω = (pitch, yaw)`, turbo durumu, yakıt.

**Kurallar:**
1. İleri vektör `f = q · (0,0,1)` — repo model kuralı: burun **+Z**, yukarı **+Y**
   (`docs/visual-design.md`). Hız vektörü **daima** `v = f · s`: kayma yok, **geri gitme yok**
   (S14). `s` asla negatif olamaz.
2. Hedef hız `s* = τ · speedMax`; turbo aktifse gazdan bağımsız `speedMax · turboSpeedMul` (KG-K26). `s < s*` ise `accel`,
   `s > s*` ise `decel` ile yaklaşır. Gaz 0 → gemi `decel` ile **yavaşlayıp durur** (S15);
   `s < stopEpsilon` olunca tam 0 ("DURDU" durumu — çıkış için gerekli).
3. Yön: çubuk vektörü `(x, y)` (birim daire içinde) §4'teki eğriden **büyüklük olarak** geçer
   (yön korunur) → istenen hız `ω* = (pitch: y', yaw: x') · turnRateMax`. Gerçek `ω`, `ω*`'a
   **kritik sönümlü, birinci dereceden** yaklaşır
   (`turnResponse` zaman sabiti, ~60 ms): hızlı ama sarsıntısız, **asla aşma yapmaz**.
   Çubuk bırakılınca `ω* = 0` → dönüş ~0,1 sn içinde durur, gemi o doğrultuda kalır (S61).
   Yaklaşma katsayısı `min(1, dt / turnResponse)`; nötr girdide kalan hız
   `turnRateMax · turnStopRatio` altına indiğinde tam 0 olur (en çok dört tick).
4. Turbo aktifken `turnRateMax · turboTurnMul` (< 1): turbo düz kaçışta hız verir ama dönüşte
   kovalayan köşeyi kesebilir — turbo tek başına garantili kaçış değildir (S78).
5. Kuaterniyon güncellemesi yalnız aritmetik + `sqrt`: `q ← normalize(q ⊗ (1, ½ωx·dt, ½ωy·dt, 0))`
   (KG-T11). `sin/cos/atan2/pow` yok.
6. **Roll dengeleme:** girdi roll üretmez ama yaw + pitch birikince ufuk yatar ve oyuncu yönünü
   kaybeder. Alanın referans "yukarı"sı +Y'dir; gemi düzleme yakınken (burun düzlemden ±60°
   içinde) roll hatası `e = dot(sağ, +Y)` ile `rollLevelRate · e` hızında sıfıra çekilir. Dik
   tırmanış/dalışta kapalı (takla atmasın). Kamera bu düzeltme dışında **yatmaz** (S55).
7. Yakıt: saniyede `idleBurn + throttleBurn · τ` (+ turbo aktifse `turboBurn`); durmuş gemi de
   `idleBurn` yakar (S16). Her atış `shotFuelCost` düşer (tek ortak depo, KG-K11). Yakıt 0 →
   [04 §Yakıt bitmesi](04-savas-mekanikleri.md#yakit-bitmesi).
8. İntegrasyondan sonra: asteroit/yapı itmesi (KG-T19), alan sınırı (KG-T20).
9. Aynı başlangıç durumu + aynı girdi dizisi → **bit düzeyinde aynı sonuç** (sunucu ve her
   tarayıcı; KG-T11). Test edilir.

## 3. Başparmak bütçesi — hangi kontrol aynı anda gerekir?

| Aynı anda gereken | Neden | Çözüm |
|---|---|---|
| yön + ateş | kovalarken nişan | sol: yön · sağ: ATEŞ |
| yön + turbo | kaçarken manevra | sol: yön · sağ: TURBO |
| yön + duman / görünmezlik | kaçış anı | sol: yön · sağ: dokunuş |
| ateş + turbo | **gerekmez** — ardışık yapılır | ikisi de sağda, ayrık hedef |
| gaz ayarı | anlık, nadiren | yapışkan kol (bırakınca kalır) |

**Kural (S54):** sol başparmak **yalnız yön** için ve sürekli; sağ başparmak ayrık eylemler;
gaz bırakılınca yerinde kalan bir kol olduğu için bir başparmağın **kısa süre** ayrılmasıyla
ayarlanır. Aynı başparmakla **eşzamanlı** basılması gereken iki kontrol yoktur.

## 4. Yön çubuğu (yüzen hız-joystick'i)

- Sol alttaki bölgede parmağın değdiği yer merkez olur, ama merkez sabit bir **ev alanına**
  kıstırılır (ekranın sol kenarından ~200 px, alttan ~250 px; `Controls.tsx`). Yarıçap
  `STICK_RADIUS` = 72 px (uzun yol = aynı dönüş için daha ince nişan). Merkez parmağı **izlemez**: parmak halkanın dışına çıkınca çubuk tam
  sapmada kalır, taban ekranda gezinmez (sahip, 2026-10-08).
- Ölü bölge `deadzone` (~%6). Büyüklük `m` ölü bölge sonrası 0–1'e yeniden ölçeklenir, eğri
  **büyüklüğe** uygulanır (eksen başına değil — kare tepki olmasın):
  `m' = m · (k + (1−k) · m²)`, `k = stickLinear`. Küçük sapma çok yavaş, hassas dönüş;
  tam sapma `turnRateMax`. (Örnek, k=0,15: %10 → maks'ın ~%1,6'sı; %50 → ~%18'i; %100 → %100.)
- Ayarlar: **hassasiyet** (k ve ölçek; isabetten bağımsız, S55), **pitch ters çevir** (varsayılan:
  yukarı itince burun yukarı).
- Her kontrol kendi `pointerId`'sini yakalar (Pointer Events) → çoklu dokunma güvenli; bölge
  dışında başlayan dokunuş hiçbir şey yapmaz.

## 5. Gaz kolu (yapışkan)

- Dikey kol, sağ kenarda; parmakla sürüklenen seviye **bırakınca kalır** (S62). 0–100 %, sayı
  ile. Yapışma noktaları: 0 (dur), %20 (iniş hızı 24 m/s, kolda "İNİŞ" yazar), %50 (seyir), %100
  (`THROTTLE_DETENTS`, `input.ts`).
- **Çift dokunuş:** 0 ↔ son sıfır olmayan değer (çıkışta hızlı durma, sonra hızlı kalkış).
- Turbo kolda değildir (sağ başparmak).

## 6. Sağ başparmak düğmeleri

| Düğme | Davranış | Boyut/yer |
|---|---|---|
| **ATEŞ** | basılı tuttukça atış hızında ateş (S64) | ≥ 84 px, sağ alt, başparmağın dinlenme noktası |
| **TURBO** | basılı = şarj bitene dek; kısa basış = kısa patlama (S23) | ≥ 56 px, ATEŞ'e en yakın |
| **DUMAN** | dokun = bırak (bekleme süresi) | ≥ 56 px |
| **GİZLEN** (görünmezlik) | dokun = etkinleştir | ≥ 56 px, en uzak (en nadir, yanlış basılmasın) |

Düğmeler arası boşluk ≥ 12 px (repo kuralı: hedef ≥ 44 px; savaşta daha büyüğü). Durumlar
(hazır/doluyor/aktif/bekleme) yalnız renkle değil, halka + sayaç + kısa metinle ([07](07-hud-ve-ekranlar.md)).
Düğme **adları** sahibin görsellerindeki gibi: DUMAN, TURBO, GİZLEN, ATEŞ. **Sıra ve yer** bu
tabloya göre (TURBO ATEŞ'e en yakın, GİZLEN en uzak) ve test edilerek (S53). Yanlış basma sorun
olursa GİZLEN'e ~150 ms basılı tutma eşiği denenir (dev anahtarı).

## 7. İki aday yerleşim (prototipte dev anahtarıyla)

- **A — referans görsellerdeki gibi:** sol alt yön çubuğu, **gaz kolu çubuğun iç yanında**; sağ alt
  ATEŞ, üstünde yay biçiminde TURBO · DUMAN · GİZLEN. Gaz ayarı yönü kısa süre keser.
- **B — sağ başparmak kullanımı:** sol alt yalnız yön çubuğu; **gaz kolu sağ kenarda**, ATEŞ ve
  yeteneklerin yanında. Gaz ayarı ateşi kısa süre keser (sağ başparmak dokunuşlar arasında
  zaten boştadır).

**Karar ölçütleri (F7, [KG-A4](02-kararlar.md#kg-a4)):** sahibin tercihi (kovalamaca + çıkış
senaryosu sonrası) · ölçülen: seyirden tam duruşa geçiş süresi, dakikada yanlış basış, yönün
kesildiği toplam süre · sahip **dönüş + ateş + turbo**'yu aynı anda yapabiliyor mu (S63).
Referans görsellerdeki yerleşim **test edilmeden aynen uygulanmaz** (S53).

## 8. Kamera ve silahlar

- **3. şahıs takip kamerası** (KG-K19, KG-T36; `render/camera.ts`). Kol geminin **gecikmeli**
  yönelimiyle arkada asılır, kamera geminin **gerçek** burnunun ilerisine bakar. Dönüşte gemi
  ekranda dönüşün dışına kayar ve yan yüzünü gösterir; yukarı çekince kamera alttan yetişir; düz
  uçuşta gemi alt ortada sabittir. Hız ve turbo kolu yavaşça uzatır.
- FOV dikeyde 72°, yatayda 56°; hızla birkaç derece, turboda ~9° açılır (yumuşak geçiş).
- Kamera dönüşe yalnız hafifçe yatar; gövdenin yatışı yalnız görseldir. Sarsıntı "trauma"
  modelidir: hasar, sert sekme ve öldürmede kısa, karesiyle sönen titreme; ateşte tepme yok.
- Kol bir kayanın içine girecekse gemiye doğru kısalır.
- **Yakınsama:** iki namludan çıkan mermiler nişangâh doğrultusunda sabit `convergeDist`
  mesafesinde kesişir (+ dağılım). Namlu noktaları `rules/arena` verisidir; sunucu aynı hesabı
  yapar. Yakın mesafede yanal sapma vuruş yarıçapının çok altında kalır.

<a id="nisan"></a>
## 9. Nişan

- Nişangâh = geminin ileri yönü. **Hassasiyet ayarı yalnız çubuk eğrisini, isabet özelliği yalnız
  dağılımı** etkiler (S55, S66).
- **Hafif nişan yardımı** (KG-K20, KG-T34): ateş basılıyken önleme noktası nişangâhın çok
  yakınındaysa gemi hafifçe hedefe döner; hedef üzerindeyken çubuk yavaşlar (sürtünme). Sunucu,
  görünür hedefin önleme noktası burundan birkaç derece içindeyse namluyu oraya yöneltir. Kilit
  yoktur; görünmez ya da duman arkasındaki hedefe yardım yoktur.
- **İzlenen hedef** (KG-T16): nişangâha en yakın, menzil içinde, görünür düşman; kilit değil,
  yalnız önleme işaretinin kime ait olduğunu seçer.
- **Önleme işareti** (S73): mermi gemi hızını miras aldığından göreli çözülür: `p_rel` = hedef −
  namlu, `v_rel` = hedef hızı − kendi hız; `|p_rel + v_rel·t| = muzzleSpeed · t` ikinci derece
  denklemi (yalnız aritmetik + `sqrt`). Hedef önce interpolasyonlu durumundan `H` kadar ileri
  taşınır: `H = interpDelay + RTT + inputBuffer − headStart` (≥ 0; nedeni [05 §8](05-ag-ve-sunucu.md#isabet)).
  Çözüm yoksa veya `t` mermi ömründen büyükse işaret gösterilmez. Duman arkasında ya da görünmez
  hedefte işaret yoktur (S76–S77). İşaret mermiyi **yönlendirmez**, isabeti **garanti etmez**.

## 9b. İniş (KG-K21, KG-T35, KG-T41)

- **Kural:** toplam hız ≤ `landSpeed` iken maden yatağına (alaşım, kristal, döteryum) değmek iniştir;
  kaya ve yapılara yalnız **İN** yaklaşması indirir (girdi biti 32; sahip 2026-10-21), yoksa yavaş temas da
  sekmedir. Daha hızlı değmek her zaman sekmedir:
  gemi yüzeyden geri itilir, kafa kafaya çarpışta hızının çoğunu kaybeder. Hasar yoktur.
- **İN** düğmesi (yakında yüzey varken ve hız ≤ `landSpeed` iken görünür; iniş çemberi de): tek dokunuş. Nişangâha en yakın yüzey seçilir
  (menzil 260 m, canlı kristal öncelikli), iniş noktasında halka belirir; gemi oraya yönelip
  mesafeye göre gazı düşürür. Düğme **İPTAL** olur ve kalan mesafeyi gösterir. Çubuğu belirgin
  oynatmak da yardımı keser.
- **KALK** 0,165 sn basılı tutma ister (sahip 2026-10-21: 0,55 sn'den %70 kısa); yanlışlıkla art arda dokunuş kalkış yapmaz. Gaz kolunu
  itmek de kalkıştır. Turbo da kalkıştır: inmiş gemide turbo gemiyi
  kaldırıp doğrudan hızlandırır (kazıda pusuya düşen pilotun kaçışı). Turbo, iniş yardımını da iptal eder.
- Kristale inen gemi kazar; kazı ışını uzaktan görünür.

## 10. Mobil web ayrıntıları (atlanırsa kontroller bozulur)

- Arena kökünde `touch-action: none`, `user-select: none`, `-webkit-touch-callout: none`,
  bağlam menüsü engelli; sayfa yakınlaştırma zaten `lib/viewport.ts` ile kapalı.
- **Kenar hareketleri:** iOS Safari'de sol kenardan kaydırma = geri. Android hareketli gezinmede
  (sahibin telefonu Android) **iki yan kenardan** kaydırma = geri, alttan yukarı = ana ekran.
  Etkileşimli bölgeler sol ve sağ kenardan ≥ 24 px, alttan ≥ 24 px + `env(safe-area-inset-bottom)`
  içeride (B yerleşimindeki sağ kenar gaz kolu ve sağ alttaki ATEŞ dahil). Arenaya girerken
  `history.pushState`; `popstate` gelirse sayfadan çıkılmaz, "Alandan yalnız çıkış noktasından
  ayrılabilirsin" uyarısı + bağlantı kopması kuralı (KG-K5) hatırlatılır. Ana ekran hareketi
  engellenemez: uygulama arka plana geçer, KG-K5 işler.
- Güvenli alan boşlukları `env(safe-area-inset-*)`. iPhone Safari'de öğe tam ekranı **yok**;
  Android Chrome'da tam ekran istenir. Yön kilidi yalnız Android tam ekranında çalışır; iOS'ta
  kilit yok → katmanla çözülür (§11).
- **Kullanıcı etkinleştirmesi:** tam ekran, yön kilidi ve `AudioContext` bir dokunuşun (`click`)
  içinde istenmeli; basılı tutma (`HoldButton`: parmak hâlâ ekrandayken `setTimeout`) bunu
  sağlamaz. Bu yüzden yükleme ekranı **"BAŞLA"** dokunuşuyla biter: bu dokunuş tam ekranı, kilidi
  ve sesi açar, `hello` gönderir; doğuş ve kalkan sayacı oyuncu hazırken başlar
  ([06 §3](06-istemci.md#uygulama-dali)).
- LAN'da (HTTP) iOS jiroskop izni yok; titreşim yalnız Android.

<a id="dikey-mi-yatay-mi"></a>
## 11. Dikey mi, yatay mı? (S85)

Varsayılan **dikey**. F7'de şunlardan biri doğrulanırsa yatay önerilir (karar sahibin, KG-A4):
(a) sahip dönüş + ateş + turbo'yu dikeyde rahat birleştiremiyor; (b) dar yatay görüş yüzünden
kovalamacada hedef sık sık ekran dışına kaçıyor (ölç: kovalamaca süresinin yüzde kaçında hedef
ekran dışı); (c) sahneyi görsel olarak kapatan HUD öğeleri (düğmeler, gaz kolu, dinlenen çubuk
halkası, arka görüş, üst şerit, bağlam paneli, silah modelleri) güvenli alanın **%35**'inden
fazlasını kaplıyor — `tools/arena-visual.mjs` DOM dikdörtgenlerinden hesaplar (görünmez dokunma
bölgeleri sayılmaz).
Yatay seçilirse: yalnız arena yatay olur (galaksi dikey kalır); dikey tutulan telefonda tam ekran
"Telefonu yatay çevir" katmanı (ikon + metin); HUD ve kontroller yatay için yeniden yerleşir.

## 12. Masaüstü dev kontrolleri (ürün değil, test aracı)

`W/S` veya `↑/↓` pitch · `A/D` veya `←/→` yaw · fare (pointer lock) = sanal çubuk · `R/F` gaz ± ·
`X` gaz 0 · `Space` ateş · `Shift` turbo · `Q` duman · `E` görünmezlik · `L` önleme işareti ·
`` ` `` dev katmanı. Masaüstü sekmesi, sahibin telefonuna karşı ikinci oyuncu olur ve PC/mobil
ölçümünde kullanılır — **ikinci bir hesapla**: aynı hesap telefonu düşürür (tek pilot,
[11 §7](11-test-ve-playtest.md#sahiple-oturum)).

## 13. PC/mobil eşitliği (S60, KG-A18)

Fare doğrudan kamerayı döndürseydi PC açık ara üstün olurdu. Öneri: fare **sanal çubuğu** sürer
(imleç merkezden uzaklaştıkça dönüş hızı artar), dönüş hızı tavanı (`turnRateMax`) iki platformu
eşitler; isabet = koni olduğundan fare hassasiyeti dağılımı aşamaz. F10'da botlar + masaüstü +
telefonla isabet oranı karşılaştırılıp sahibe sunulur.

## 14. Test edilecek kurallar (TDD, ayrıntı [11](11-test-ve-playtest.md))

`s` hiç negatif olmaz (özellik testi) · gaz 0 → sonlu sürede tam 0 · durmuşken yakıt `idleBurn`
ile azalır · çubuk bırakılınca dönüş ≤ 4 tick'te durur, aşma yok · turbo'da dönüş tavanı düşük ·
roll dengelemesi sınırlı ve dik açıda kapalı · aynı girdi dizisi bit düzeyinde aynı durum · eğri
monoton, ölü bölge sıfır · sınırda dışa hız sıfır · asteroit içine girilemez.
