# Yarık haritası — Y5 tasarım planı (v1, 2026-10-22)

Sahibin oyun testi listesindeki beş madde ([14 §17.1](14-yarik-plani.md#171-sahibin-oyun-testi-listesi-2026-10-22))
aynı işte birleşir: haritanın baştan, planlı kurulması. Ölçü ve oda kararları [14 §9–10](14-yarik-plani.md#9-harita)'da;
bu belge onların üstüne bölgeleri, yapı kurallarını, çıkışı ve harita ekranını koyar.
**KARAR** = sahip onayladı. **ÖNERİ** = sahibin onayını bekliyor.

## 0. Sahibin istekleri

| # | Sahip | Bu belgede |
|---|---|---|
| 4 | "Düz duvar gibi yapılar değişmeli, kaldırılmalı. Atmosfer ile hiç uyuşmuyorlar." | §3: kutu yapı kalmaz |
| 5 | "Bunun içinden mi geçilecek, üstünde mi durulacak, neresinden geçilecek, neresinde beklenecek hiç bir şey belli değil." | §5 |
| 7 | "Bu gemilerin falan içinden geçebiliyorum, içinde beklenebiliyor. Böyle bug şeklinde saklanma yeri olamaz." | §3: çizilen = çarpılan |
| 8 | "Rastgele yapılmamalı. Akıllıca planlanmalı. Mağara gibi kayalardan oluşmuş, içinde birden farklı path olan yapılar olmalı. Gemiler içine girip izini kaybettirebilmeli. İçine girilebilen, içinde farklı yollar olan terk edilmiş uzay binaları olmalı. Harita şu anki boyutunun 2 katı büyümeli." | §1–4, §6 |
| 9 | Dokununca açılan harita: neredeyim, kaba yapılar, giriş ve çıkışlar | §7 |

**Bugünkü durumun teşhisi (2026-10-22, oyunda tel kafesle bakıldı):**
- Merkezin altındaki sekizgen levha, kapı direkleri, karakol hangarı ve direği düz kutu olarak
  çiziliyor. Kutu hem görüntü hem çarpıştırıcı (4).
- Enkaz gemi modeli çarpışma kutularıyla örtüşmüyor: tel kafes gövdenin yalnız bir kısmını
  kapsıyor. Karakolun 130 m arkasındaki süs modelinin ve merkez istasyonun halkalarının hiç
  çarpıştırıcısı yok. Gemi bunların içine girip bekleyebiliyor (7).
- Kapıdaki halka modeli "içinden geç" diyor; kural ise "120 m içinde tam dur, 3 sn hasarsız
  bekle" (5).
- Kaya ve yapı görüşü kesmiyor: yalnız gizlenme ve duman kesiyor (`pilotVisible`). Kayanın arkasına
  saklanan gemi işaretiyle, kilidiyle, radarıyla görünmeye devam ediyor. Bu kalırsa mağara izini
  kaybettirmez (8).

## 1. Haritanın işi

Harita döngünün sahnesidir: **farm → risk → kovalamaca → kaçış → çıkış**. Her bölge bir karar
yaratmalı. Bir bölgenin işi yoksa yer kaplar, oyun yaratmaz.

| Karar | Haritada karşılığı |
|---|---|
| Nerede farm atayım? | zengin ama açık merkez / orta zenginlikte, korunaklı mağara içi / seyrek ama sakin dış kuşak |
| Hangi rotadan gideyim? | açık koridor hızlı ama görünür; kuşak ve mağara yavaş ama saklı |
| Kovalanıyorum, nereye? | mağara ve istasyon içi: dar, çok yollu, görüşü kesen yer. Takipçi aynı yolu seçmek zorunda. |
| Nereden çıkayım? | 3 sabit çıkış bilinir ve kamp edilebilir; geçici yarık şanstır; acil sıçrama pahalıdır |

**Yön bulma:** her bölgenin uzaktan tanınan tek bir yer işareti olur (istasyon, dev kaya, enkaz).
Oyuncu kuşağın ya da mağaranın içinde kaybolabilir (KG-K23), ama haritada kaybolmaz.

## 2. Ölçü — KARAR (14 §9)

- Yarıçap 2600 → **5200 m**, yükseklik ±650 → **±1300 m**. Sahibin "2 katı" isteğiyle aynı: her
  boyut iki kat, hacim 8 kat.
- Tam gazda (120 m/sn) bir uçtan bir uca ~87 sn.
- **Dönüş yarıçapı (ölçü kuralı):** tam gazda ~96 m, 80 m/sn'de ~58 m, 60 m/sn'de ~42 m,
  iniş hızında ~16 m (`turnRateMax` 1,25 · `slowTurnBonus` 0,3). Turboda dönüş %40 düşer.
  Mağara ve koridor ölçüleri buna göre konur (§3.2).

## 3. Yapı kuralları — ÖNERİ

### 3.1 Çizilen = çarpılan (madde 7)

Y2'de kayalar için kurulan kural yapılara da uygulanır:
- Her yapının çarpıştırıcısı **kendi modelinden** üretilir (sade ağ, ≤ 8 bin üçgen). Kutu
  çarpıştırıcı kalmaz.
- **Hat kapısı (test):** görsel yüzey ile çarpışma yüzeyi arasındaki en büyük fark ≤ 0,5 m.
  Fazlası build'de hata verir.
- Model **kapalı yüzey** olmalı: gemi duvarın içine düşemez. İçine girilen her boşluk tasarlanmış
  bir boşluktur (giriş, koridor, oda). "Modelin içi" diye bir yer yoktur.
- Çarpıştırıcı Y2'deki üçgen BVH ile çalışır. İçbükey ve tünelli şekilleri zaten taşır; yeni motor
  gerekmez.

### 3.2 İçine girilen yapılar (madde 8)

| Ölçü | Değer | Neden |
|---|---|---|
| Tünel çapı | 60–90 m | gemi kapsülü + 2 gemi yan yana + 80 m/sn'de dönüş payı |
| Dönemeç yarıçapı | ≥ 60 m | 80 m/sn'de geçilir; tam gaz duvara sürtünür (hız bir beceri) |
| Oda | 150–250 m | farm ve kısa it dalaşı alanı; içinde damarlı kaya |
| Giriş | her yapıda ≥ 3, en az 2'si farklı yönden | tek girişli yer tuzaktır, çok girişli yer kaçıştır |
| İç yol | girişler arası ≥ 2 ayrı yol, en az bir halka | takipçi hangi yoldan çıktığını bilemez |
| Işık | girişte yön ışıkları, içeride karanlık + damar parıltısı | içerisi okunur ama tekin değil |

### 3.3 Düz duvar yok (madde 4)

- Kutu biçimli hangar, levha ve direkler kalkar. Yerlerine modelli yapılar gelir (§4) ya da
  hiçbir şey gelmez.
- Kapı ve iniş yerleri §5'teki iskeleye dönüşür.

## 4. Bölgeler — ÖNERİ

```
                        dış kenar: 6 giriş ağzı
              ·  ·  Dış Kuşak (seyrek kaya, sakin, az cevher)  ·  ·
         ┌───────────────────── Orta Halka ─────────────────────┐
         │  [Ç1]                                          [Ç2]  │
         │   KOVUK                          SESSİZ LİMAN        │
         │   mağara kompleksi,              terk edilmiş        │
         │   3 giriş, iç farm               istasyon, hangar    │
         │            ╲      YARIK KALBİ      ╱                 │
         │             merkez istasyon, en zengin, açık         │
         │            ╱   olaylar, kamp riski  ╲                │
         │   ENKAZ MEZARLIĞI                KRİSTAL KUŞAĞI      │
         │   dev enkazlar, bazıları         yoğun kaya, farm,   │
         │   delik gövdeli (içinden yol)    kaya tünelleri      │
         │                 SİS BULUTU (görüş 400 m)        [Ç3] │
         └──────────────────────────────────────────────────────┘
   [Ç] = sabit çıkış iskelesi, siperli, girişlerden uzak · geçici yarıklar rastgele
```

| Bölge | Yer işareti | Ne için | Risk |
|---|---|---|---|
| **Yarık Kalbi** (merkez) | dev istasyon (`sci_fi_space_station`) | en zengin serbest cevher, olaylar | açık alan, herkes görür |
| **Kovuk** | delik deşik dev asteroit | içeride damarlı kaya; kovalanan izini kaybettirir | dar yolda pusu |
| **Sessiz Liman** | terk edilmiş istasyon | hangar ve koridorlar; iniş yeri; kısa yol | içeride ses var: kim girdi bilinmez |
| **Enkaz Mezarlığı** | kırık ana gemi | delik gövdelerden geçen yollar, düşük cevher | sıkışık alan, yakın dövüş |
| **Kristal Kuşağı** | kristal sütun | yoğun kaya, kazı | kaybolma, çarpma |
| **Sis Bulutu** | — | görüş 400 m: radar ve gizlilik oyunu | kör karşılaşma |
| **Dış Kuşak** | — | sakin farm, girişler | uzak çıkışlar, yakıt |

**Yerleşim kuralları:**
- Merkezden her bölgeye **iki rota**: kısa açık koridor + uzun korunaklı kuşak/mağara rotası.
- Her sabit çıkış bir korunaklı bölgenin kenarında durur: çıkışa saklanarak yaklaşılabilir, ama
  iskele açıktadır (kamp ile kaçış dengesi, KG-A22).
- Girişler çıkışlardan ≥ 1500 m uzakta. Doğan gemi çıkış kampının içine düşmez.
- Dikey katman: Kovuk ve Liman farklı yüksekliklerde. Yukarıdan pusu ve alttan sızma rotaları.

### 4.1 Yerleşim v1 — uygulanan (2026-10-22)

Açılar oyun içi: `+X` 0°, `+Z` 90° (haritada yukarı). Yükseklik (y) dikey katmanı verir.

| Yer | Konum (açı, yarıçap, y) | Ne |
|---|---|---|
| Yarık Kalbi | merkez | merkez istasyon (geçici: kutu + model; kapalı model Codex'ten gelecek), farm cevherinin üçte biri |
| Sessiz Liman | 30°, 2800 m, −240 | terk edilmiş istasyon (alt kat) |
| Kovuk | 150°, 2700 m, +260 | mağara kompleksi (üst kat); içinde kristal yatakları |
| Kristal Kuşağı | 270°, 2700 m | büyük yoğun kuşak (yarıçap 750 m), en çok kristal |
| Enkaz Mezarlığı | 210°, 2600 m, 0 | kırık ana gemi (geçici: kutu + model; kapalı model Codex'ten gelecek) |
| Saklı rotalar | 60°, 120°, 330° · 1600 m | üç orta kuşak: Kalp'ten her bölgeye kısa açık yol + kuşak içinden saklı yol |
| Çıkış iskeleleri | 30°/−200, 150°/+200, 270°/0 · 3900 m | her biri bir korunaklı bölgenin hemen ötesinde: bölge içinden saklanarak yaklaşılır, iskele açıktadır |
| Girişler | dış kenar 4800 m: 0°, 60°, 120°, 180°, 240°, 300° | çıkışların arasında; en yakın çıkış 2414 m |
| Dış Kuşak | tüm disk | seyrek kaya, az cevher |

Kaldırılanlar: karakol (kutu hangar), röle direkleri ve kapı direkleri (madde 4, 7).

**Açık şeritler (2026-10-22):** Kalp'ten Liman, Kovuk, Enkaz ve Kristal Kuşağı'na dümdüz giden
şeritlerde kaya yok (merkez çizgisinin ≥ 100 m çevresi, test). Hızlı ama görünür yol budur;
kuşaklar yanındaki saklı yoldur. **Yarık Kalbi ve Enkaz** artık Codex'in kapalı modelleri: haritada
hiç kutu çarpıştırıcı kalmadı (test).

**Madde 8 eksik teşhisi (2026-10-22):** kayadan mağara tek (Kovuk). İki yeni, farklı oynanan kaya
mağarası [brief-3](yarik-structures-brief-3.md)'te: **Yarık Kanyonu** (Kristal Kuşağı'nın
ortasında, yer yer üstü açık kıvrımlı yarık) ve **Petek** (90°'de, çok hücreli kaya labirenti).
Sis Bulutu ayrı bir görüş kuralı getirir; sahip onayı olmadan eklenmez.

## 5. Çıkış iskelesi (madde 5) — KARAR (2026-10-22): kural aynı, görünüş netleşir

**Kural aynı kalır:** çıkış bölgesinde tam dur ya da iskeleye in, **3 sn hasarsız bekle** (S31).
Değişen, bunun nasıl gösterildiği:
- **Halka kalkar.** Halka "içinden geç" der. Yerine **iskele** gelir: düz iniş yüzeyi, üstünde
  ışıklı iniş dairesi.
- **Bölge sınırı görünür:** 120 m'lik bölge yarı saydam bir kubbe kenarıyla çizilir. İçerisi
  çıkış, dışarısı değil.
- **İniş dairesi = durulacak yer.** "DUR" işareti ve dairenin üstünde bekleme halkası.
- **HUD, bölgeye girince:** "Çıkış · tam dur ya da iskeleye in · 3 sn hasarsız bekle". Sayaç
  halkası iniş dairesinde de görünür. Hasar alınca "Hasar aldın, sayaç sıfırlandı" (bugün var).
- Uzaktan: tek bir dikey ışık sütunu (bugün var) + harita ekranında simge.

Alternatif, kural değişikliği gerektirir: "halkanın içinden yavaşça geç". Daha basit ama bugünkü
"dur ve bekle" gerginliğini (kamp riski) siler. Önerilmez.

## 6. Görüş kuralı (madde 8'in şartı) — KARAR (2026-10-22)

İzini kaybettirmek bilgi katmanını değiştirir; PvP kuralıdır.
- Kaya ya da yapı iki gemi arasındaki görüş çizgisini kesince düşenler: hedef işareti, mesafe
  etiketi, kilit ve harita/radar noktası.
- Gemi modeli zaten GPU derinliğiyle saklanır. Sunucu konumu göndermeye devam eder (AOI
  1600 m), istemci işaretleri çizmez. Kilit sunucuda da görüşle doğrulanır.
- **Son görülen yer:** görüş kesilince işaret 2 sn soluk bir "son görülen" noktası olarak kalır,
  sonra söner. Takipçi tahmin eder, bilmez (dört soru: öngörülebilirlik).
- Maliyet: oda başına görüş ışını ≤ 32×31 / snapshot, BVH üstünde. Ölçülecek; p95 tick < 5 ms
  kapısı sürer.

## 7. Harita ekranı (madde 9) — ÖNERİ

- **Açma:** sol üstteki mini haritaya dokun. Kapatma: tekrar dokun ya da geri. Uçuş durmaz
  (çok oyunculu); kontroller açık kalır, harita ekranın üst kısmını kaplar.
- **Gösterir:** üstten bölge şekilleri ve adları, yer işaretleri (Kovuk, Liman, Kalp, Enkaz),
  sabit çıkışlar, girişler, açık geçici yarıklar (kalan süreyle), kendi konumun, yönün ve
  yüksekliğin (yan çubuk).
- **Göstermez:** düşman gemileri. Bilgi oyunun kendisidir; harita yeri gösterir, kimin nerede
  olduğunu değil.
- Aynı çizim yerleşim için geliştirici gözden geçirme aracıdır: harita verisi tek kaynaktan
  gelir.

## 8. Varlıklar — KARAR (2026-10-22): Codex, Blender MCP ile üretir; Claude inceler, düzelttirir

İçine girilen yapılar özel üretim ister. Elimizdekiler (14 §14) dışarıdan bakılacak modeller.

| Varlık | Kaynak | Not |
|---|---|---|
| **Kovuk** (delik deşik dev asteroit, 600–900 m) | Codex / Blender | kapalı yüzey; 3 giriş; §3.2 ölçüleri; iki oda; LOD0 ≤ 60 bin, çarpıştırıcı ≤ 8 bin üçgen |
| **Sessiz Liman** (terk edilmiş istasyon) | Codex / Blender, modüler parçalar (koridor, kavşak, hangar, oda) | parçalar kapalı yüzey; birleşince §3.2 |
| **Çıkış iskelesi** | Codex / Blender | iniş dairesi + bölge kubbesi ışığı ayrı; ≤ 15 bin |
| **Delik gövdeli enkaz** | mevcut enkaz modeli + Codex | gövdeyi boydan boya geçen yol; çarpıştırıcı modelden |
| **Yarık Kalbi** | `sci_fi_space_station` (≤ 100 bin'e indirilir) | çarpıştırıcı LOD2'den |
| **Kaya tüneli** (Kristal Kuşağı) | mevcut kaya kataloğu | prosedürel: kayalar bir eğri boyunca kabuk dizer; çarpıştırıcı zaten tam |

**Prototip önce:** kaya tüneli bugünkü kayalarla hemen kurulabilir. Mağara oynanışı (izini
kaybettirme, dönemeç hızı, pusu) Codex varlıkları gelmeden test edilir.
PROTOTYPE → PLAY → OBSERVE → DECIDE.

## 9. Uygulama sırası (Y5) ve kabul ölçütleri

| Adım | İş | Kabul |
|---|---|---|
| Y5a | Yapı çarpıştırıcısı modelden (§3.1); kutu çizimi kalkar | Her yapıda görsel–çarpışma farkı ≤ 0,5 m (test). Tel kafeste boşluk yok. |
| Y5b ✅ | Görüş kuralı (§6), [KG-K31](02-kararlar.md#kg-k31) | Kaya arkasındaki hedefte işaret/kilit düşer (test). Tick p95 < 5 ms. |
| Y5c ✅ (v1 varlıklarla) | Yerleşim v5 (§4.1): 5200 m disk, 6 giriş kenarda, 3 çıkış iskelesi, Kovuk (yüksek) ve Sessiz Liman (alçak) Codex modelleriyle; karakol, röle, kapı direkleri kalktı. Kovuk'un maden noktaları duvarlarında kristal. Botlar kenar bandındaki (sınır korumasının geri çevirdiği) madeni hedef seçmez. | layout.test: giriş↔çıkış ≥ 1500 m, iskele yüzeyi çıkışın tam altında, yapı rotalarında ≥ 31 m boşluk; structures.test: kapalı collider, ağızlar açık. Sahip oynar. |
| Y5d (yarım) | Çıkış iskelesi (§5). Yapıldı: halka ve portal kalktı; 120 m bölge yarı saydam kubbe (içindeyken kenar parlar); iniş dairesinde 24 parçalı yay 3 sn beklemeyle dolar; üstünde turkuaz ışık sütunu (uzaktan okunur); İskele modeli çıkışın altında; HUD metni "iskele kubbesinde dur". Kalan: İskele v2 (H yerine iniş işareti, direk). | Oyuncu ilk bakışta nerede duracağını bilir: sahip oyun testi. HUD metni tr/en. |
| Y5e ✅ | Harita ekranı (§7): radara dokun · aç/kapa, kuzey yukarı, kendi ok + irtifa, çıkış/giriş/yapı/kuşak, "gemiler görünmez" notu. Gaz sürgüsü açık kalır. Bölge adları: Yarık Kalbi, Kovuk (tünel çizgileriyle), Sessiz Liman (hangar ağzı merkeze), Enkaz. | 350 px'te okunur; düşman göstermez (test). |
| Y5f (oyunda, görünüm turu sürüyor) | Kovuk + Sessiz Liman v2 oyunda (review-1: ayrı collider, 4 ağız, 2 oda + sütun, 3 seviye; Liman'da atrium döngüsü + baypas). Kovuk duvar kristalleri rota boşluğuna girmez (girerse küçülür). [review-2](yarik-structures-review-2.md): İskele (geometri iniş işareti) ve Liman (hangar, isim, ışık şeritleri) oyunda; yapıların ikinci UV seti (`uv1`, panel normalleri) artık korunuyor. Sırada [brief-2](yarik-structures-brief-2.md) (Yarık Kalbi, Enkaz), sonra [review-3](yarik-structures-review-3.md) (collider rotalar dışında büyüyebilir: kafes direk, yırtık levhalar, Liman gövdesi oyunda kara). | §3.2 ölçüleri araçla ölçülür; telefonda 60 fps hedefi. Ölçüldü: 32 gemi tick p95 2,07 ms. |

## 10. Sahibin kararları (2026-10-22)

1. Görüş: kaya ve yapı arkasındaki gemi işaret, kilit ve haritada görünmez (§6).
2. Çıkış: kural aynı (dur + 3 sn hasarsız); halka kalkar, iskele gelir (§5).
3. Varlıklar: Codex, Blender MCP ile yapar; Claude modeli inceler, beğenmediği yeri düzelttirir.
   Brif: [yarik-structures-brief.md](yarik-structures-brief.md).
4. Sıra: Y5 (harita) Y4'ten (sınıflar) önce.
