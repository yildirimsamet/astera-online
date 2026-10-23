# Yarık v6 — seviye tasarımı planı (Claude, 2026-10-22)

Sahip, 2026-10-22: "Harita çok önemli, burada 30-50 kişi oynayacak olsa: farm yapmak isteyen
birisinin farm yapmasına imkan yok. Değil 30-50 kişi: 5 kişi bile olsa birbirlerini rahat
bırakmazlar. Bir bakışta tüm harita gözüküyor. Kalp dedigin alan ufacık içine bile girilmiyor.
Modüler 5-10 yapı modellettirp bunlarla bir kaç farklı büyüklü küçüklü yapı, bina vs bişeyler
yapabilirsin. Bunlarında içine bir şekilde farm yapılmasını sağlayan bir mekanik vs bişeyler
ekleyebilirsin. Harita bence en az 2-3 kat daha büyümeli. Farklı alanlar binalar, yapılar,
oluşumlar vs eklenmeli." — "Tamamen sana bırakıyorum, sana güveniyorum." — "Modeller bizim oyun
ile görsel olarak yapı olarak vs uyumsuz ise kullanma, codex'e yaptır."

Bu belgedeki kararlar sahibin bu yetkisiyle **Claude kararı**dır. 15-yarik-haritasi.md'nin
(v5) yerine geçer; kural ve ölçü kuralları (§3 çizilen = çarpılan, §6 görüş) aynen sürer.

## 1. Teşhis (v5, ölçülü)

| Sorun | Neden (kod) |
|---|---|
| Her şey her yerden görünüyor | Sis `FogExp2 0.00009`: 5 km'de %18, 10 km'de %56 örter. 10,4 km'lik diskin tamamı bir bakışta. 900 m'lik çıkış ışık sütunları ve açık merkez. |
| Kimse rahat bırakılmıyor | 32–50 pilot için 85 km² alan: kişi başına ~2 km², en yakın komşu ~0,7 km (≈ 6 sn). Saklanılacak yer az: 1 mağara, 3 bina. |
| Farm ancak açıkta | Saha cevherinin %40'ı Kalp'in açık 1750 m'sinde; yapı içinde yalnız Kovuk'un 8 damarı. |
| Kalp küçük, girilmiyor | Yarık Kalbi 320 m, iç yolu tek bir geçit. |
| Yapı çeşidi az | 4 yapı, hepsi tek parça. Bölge kimliği yok. |

## 2. Hedefler (ölçülür)

1. **Rahat farm:** 48 pilotta bile her pilot için **≥ 1,5 farm yeri** ki hiçbir açık şeritten
   ve açık alandan görünmesin (görüş ışınıyla ölçülür).
2. **Karşılaşma temposu:** 48 pilotta ilk temas ortalama 60–120 sn; tek başına farm eden biri
   dakikalarca rahat kalabilir. Merkez ise her zaman kalabalık ve tehlikeli.
3. **Bir bakışta görünmez:** coğrafya ~3,5 km'de yarıya söner, 6 km'de kaybolur; yalnız yer
   işaretlerinin ışıkları uzaktan okunur.
4. **Her bölge bir karar:** zengin ama açık / korunaklı ama tuzak / sakin ama fakir.
5. **Performans:** sunucu tick p95 < 5 ms (48 pilot); S22'de 60 fps; kare başına ≤ 250 bin üçgen.

## 3. Ölçü — KARAR

- Yarıçap **5200 → 13000 m (2,5 kat)**; yükseklik **±1300 → ±2000 m**. Alan 6,25 kat, hacim
  ~9,6 kat. Dikey daha az büyür: boş hacim değil, dolu katmanlar istiyoruz.
- Tam gazda çaprazlama ~3,6 dk, turboyla ~2 dk. Kenardan merkeze ~1,7 dk.
- **Yakıt:** depo 100 → 250 (yakma hızları aynı). Kenar → Kalp → çıkış + farm bugünkü oranda sığar.
- **Oda tavanı 48 pilot** (sahip: 30–50).
- **Girişler:** 12, kenarda (12,5 km). **Sabit çıkışlar:** 4, 10 km halkasında, her biri bir
  bölgenin dışında. Geçici yarıklar ve acil sıçrama aynı.
- Sunucu ızgarası 100 m sık hücreden **200 m hücreye** (13 km'de bellek 11,5 → 1,4 MB).

## 4. Harita: üç halka, yedi bölge

```
                         ·  kenar 12,5 km: 12 giriş  ·
            DIŞ SINIR (7–12 km): sakin farm cepleri · 8 karakol · 2 toz bulutu · dev kayalıklar
        ┌──────────────────────── ORTA HALKA (3–7 km) ────────────────────────┐
        │   KOVUK (mağara, yüksek)              SESSİZ LİMAN (istasyon, alçak) │
        │                                                                     │
        │ PETEK (kaya labirenti)   ╲   YARIK KALBİ KOMPLEKSİ   ╱  TERSANE     │
        │                           ╲  (0–1,2 km, girilir,   ╱   (tersane +   │
        │                           ╱   iç farm salonları)    ╲   Gangut göbeği)│
        │ ENKAZ MEZARLIĞI          ╱                           ╲               │
        │ (Enkaz + halka harabesi)      YARIK KANYONU (Kristal Kuşağı)         │
        └─────────────────────────────────────────────────────────────────────┘
              [Ç] 4 sabit çıkış 10 km'de, bölgelerin dış yüzünde
```

| Halka / bölge | Kimlik | Farm | Risk | Yapı |
|---|---|---|---|---|
| **Yarık Kalbi Kompleksi** (0–1,2 km) | ana istasyon, her yerden görünen ışık | en zengin: açık meydan + **içeride rafineri salonları** | herkes buraya gelir | modüler büyük kompleks (~900 m, 3 kat) + mevcut Kalbi kulesi çekirdekte |
| **Kovuk** | delik deşik dev asteroit | damar mağarası | dar yolda pusu | var |
| **Yarık Kanyonu** | Kristal Kuşağı'nın kalbinde yarık | kanyon duvarında kristal | üstten dalış | brief-3 |
| **Petek** | kaya labirenti | az | kovalayan kaybolur | brief-3 |
| **Sessiz Liman** | terk edilmiş istasyon + 2 ek modül | hangar ve atriumda | iç ses | var + modüler ek |
| **Enkaz Mezarlığı** | kırık savaş gemisi, halka harabesi, gövde parçaları | enkaz kargoları | sıkışık, yakın dövüş | Enkaz + `space_station_3` + modüler gövde parçaları |
| **Tersane** | yarım kalmış gemi tersanesi: iskele kafesleri | tersane depoları | açık kafes, geniş görüş | modüler + `gangut_space_hub` |
| **Dış sınır** (7–12 km) | sakin, karanlık, uzak | **tek kişilik cepler**: karakol odaları, kayalık yarıkları | az ama yalnız | 8 küçük karakol (modüler), 6 dev kayalık, 2 toz bulutu |

**Yerleşim kuralları:**
- Kalp'ten her bölgeye **açık şerit** (kayasız, hızlı, görünür; v5'te kuruldu) ve yanında
  **saklı yol** (kuşak, kanyon, toz). Bölgeler arası çevre yolu yok: orta halkada bölgeden
  bölgeye geçmek ya Kalp'ten ya dış sınırdan dolaşmaktır.
- Zenginlik içe doğru artar, görülme riski de. Dış sınırda cevher az ama gözden uzak.
- Her bölgenin uzaktan okunan tek bir ışık rengi ve şekli olur (yön bulma).
- Dikey: Kovuk ve Tersane yukarıda, Liman ve Enkaz aşağıda; dış sınırda katmanlar ±2000 m.

## 5. Görüş ve keşif — KARAR

- **Sis:** yoğunluk 0,00009 → **0,00024** (3,5 km'de yarı, 6 km'de ~%87). Işıklar (çıkış
  sütunu, yer işareti fenerleri) sisten etkilenmez: uzakta yalnız ışık kalır.
- **Toz bulutları (dış sınırda 2 adet, 1–1,5 km):** içeride görüş 350 m; bulut, duman gibi
  görüş çizgisini keser (işaret, kilit, radar noktası düşer; §6'nın genişlemesi). Kurala dokunan
  tek değişiklik budur ve sahibin verdiği yetkiyle alınmıştır.
- Çıkış ışık sütunu 900 m'den 600 m'ye iner (her yerden görünen bir direk değil, yaklaşınca
  okunan bir fener).
- Radar 1000 m, AOI 1600 m aynı.

## 6. İçeride farm — KARAR: yeni kural yok, mevcut iki mekanik yapıların içine taşınır

1. **Damar odaları:** yapı odalarının duvarlarında kristal/alaşım damarları (Kovuk'taki gibi;
   `mineRate`, `crystalReserve`, `crystalRegen` aynı). Her odaya 1–3 damar.
2. **Kargo bölmeleri:** salonların içinde saha cevheri kümeleri (mıknatısla toplanan; v5 farm
   noktası mekaniği). Toplanınca başka bir bölmede yeniden doğar.

İçeride farm görünmez (kaya ve duvar görüşü keser) ama oda girişleri tuzaktır. Dışarıda farm
görünür ama kaçış açıktır. Bu karar, yeni bir kural öğretmeden "içeri gir, sakla, farm et"
oyununu açar. Yeni mekanik (ör. hurda terminali) oyun testinden sonra gerekirse eklenir.

**Dağılım (48 pilot için):** ~150 farm yeri. %25 Kalp (yarısı içeride), %45 orta halka
(çoğu içeride), %30 dış sınır (cepler). Ölçü: farm yerlerinin ≥ %60'ı hiçbir açık şeritten
görünmez.

## 7. Modüler yapı kiti — Codex (brief-4)

Liman'ın görsel dili (gunmetal, amber acil ışık, sönük turkuaz şerit); 20 m ızgara, standart
kapı **70 × 70 m** açıklık. Her parça kendi kapalı çarpıştırıcısıyla gelir: **duvar katı bir
hacimdir (≥ 3 m kalın)**, iç boşluk dışarıdır; parçalar kapılarında kenar kenara oturur, birleşik
yapı ayrıca bir collider istemez.

| # | Parça | Ölçü |
|---|---|---|
| 1 | Düz koridor | 80 m |
| 2 | 90° dönemeç | iç yarıçap ≥ 70 m |
| 3 | T kavşak | |
| 4 | Dört yol | |
| 5 | Küçük oda | 120 m küp, 2–4 kapı yuvası |
| 6 | Salon (farm) | 240 × 120 × 140 m, 4 kapı, duvarlarda damar yuvaları |
| 7 | Hangar | 140 × 90 m ağız, iniş pisti |
| 8 | Giriş ağzı | genişleyen, ışıklı hava kilidi; yapının dışa açılan ucu |
| 9 | Kule parçası | üst üste dizilir, fener başlığı |
| 10 | Hasarlı türevler | kırık koridor (uzaya açık), çökmüş oda |
| + | Süsler (girilmez, katı) | anten, güneş kanadı kökü, radyatör, tank kümesi |

**Planlar (yerleşimde kodla, tohumdan bağımsız):** Kalp Kompleksi (~30 parça, 3 kat),
Tersane (~15), Liman eki (~6), 8 karakol (3–5 parça). Test: her kapı ya bir parçaya ya bir giriş
ağzına bağlanır; tüm rota çizgileri ≥ 31 m açık; parça birleşimlerinde boşluk yok.

## 8. Sahibin verdiği modeller — inceleme

| Model | Lisans | Uyum | Karar |
|---|---|---|---|
| `gangut_space_hub` (15 bin) | CC-BY | detaylı, gri-metal istasyon, dış halka | **Tersane göbeği.** Codex: kapalı collider, halka katı, Liman paleti |
| `space_station_3` (68 bin) | CC-BY | kırık halkalı, iskeleti açık harabe | **Enkaz Mezarlığı.** Codex: kirişler ≥ 1,5 m, aralıklar §0 kuralıyla kapalı |
| `alaskan_cliff_rock_1/4` (2 M) | Fab Standart | fotogrametri kaya, Megascans kayalarıyla aynı dil | **Dış sınır kayalıkları.** 6–8 bine düşür, detay normale; çarpıştırıcı modelden |
| `sci_fi_space_station` (2,1 M) | Fab | ISS benzeri, 49 malzeme; NASA havası bizim tonda | Yedek: Kalp silüeti için parça kaynağı. Ağır; önce kit |
| `i.s.f_space_station` (98 bin) | CC-BY | turkuaz kutular, yazılar | **Kullanılmaz:** dil uymuyor |
| `space_rocks` | **CC-BY-NC** | — | **Kullanılamaz:** ticari olmayan lisans |
| `aditya_l1`, `spaceengine` | belirsiz / CGTrader | — | Kullanılmaz (lisans belirsiz) |

CC-BY modeller "Emeği geçenler" ve `CREDITS.md`'ye yazılır.

## 9. Aşamalar

| Aşama | İş | Kim | Kabul |
|---|---|---|---|
| V6a | Ölçü 13 km, yakıt 250, ızgara 200 m, 12 giriş, 4 çıkış, bölgelerin yeri, şeritler, mevcut 5 yapı + kuşaklar yeni yerlerinde; sis | Claude | layout testleri; tick p95 < 5 ms (48); harita ekranı yakınlaştırma |
| V6b | Harita ölçüm aracı: üstten çizim, görüş örneklemesi, farm gizliliği, yolculuk süreleri | Claude | §2 hedefleri sayıyla raporlanır |
| V6c | Modüler kit (10 parça) + Gangut, halka harabesi, Alaska kayalıkları | Codex (brief-4) | brief kuralları |
| V6d | Plan sistemi + Kalp Kompleksi, Tersane, Liman eki, 8 karakol; içeride farm | Claude | kapı/rota testleri; ≥ %60 gizli farm |
| V6e | Kanyon ve Petek (brief-3) yerine | Claude | rota testleri |
| V6f | Toz bulutları (görüş kuralı) | Claude | görüş testi; HUD "toz: görüş 350 m" |
| V6g | 48 botla oyun testi, telefon FPS, ayar | Claude + sahip | §2 hedefleri |

Codex sırası (11:20 güncel): review-3 Enkaz, Kalbi, Kovuk teslim edildi ve oyunda; Codex
Liman'ın ortasında kullanım limitine takıldı. Kit en acil olduğu için sıra **brief-4 (kit + sahip
modelleri) → brief-3 (Kanyon, Petek) → review-3'ün kalanı (Liman, İskele)**.

### Durum (2026-10-22)

- **V6a bitti:** layout v6 testleri, 48 pilotta tick p95 2,7 ms, harita ekranı. Sabit sis
  yoğunluğu her karede eski 0,00009'a dönüyordu (`stage.ts` belt döngüsü); `fogDensity()` ile
  düzeltildi ve testlendi.
- **V6b test olarak:** `packages/rules/test/arena/map-goals.test.ts`. Gözcü noktaları açık
  şeritler (250 m'de bir) ve açık Kalp (400 m ızgara, üç yükseklik). Bir farm yeri, AOI (1600 m)
  içindeki hiçbir gözcüden temiz çizgiyle görülmüyorsa gizlidir. Hedefler: ≥ 72 gizli yer
  (48 × 1,5) ve ≥ %60. İlk ölçüm 86 yer, %57 çıktı. Orta halkanın farm yerleri artık yalnız
  korunaklı yere düşüyor: yoğun kuşağın içi ya da her şeridin ve Kalp'in AOI'sinin dışı.
  Böylece iki hedef de tuttu.
- **V6f bitti:** iki toz bulutu var: 105° ve 285°, 9,5 km'de, 650 m yarıçaplı. Kural
  şu: bir görüş çizgisi tek bulutun içinden 350 m'den uzun geçerse kör olur. Bu durumda işaret,
  kilit ve harita noktası düşer, sunucu da o pilotu göndermez. Her bulutun içinde ≥ 3 farm cebi
  var. Ekranda: dışarıdan kahverengi toz bulutu, içeride görüşü 350 m'ye kapatan sis, HUD'da
  "Toz bulutu · Görüş 350 m · uzaktan seni de görmezler", haritada bulut ve lejant.
- **Kit, ilk parça (12:28):** `kit_corridor` kapı, collider ve rota kurallarını tuttu, ama
  görünüşü düz gri bir kutuydu (lod0'da 90 üçgen, Liman dilinde hiçbir şey yok). Sebebin bir
  kısmı benim "parçaları hafif tut" talimatımdı. Codex durduruldu; `yarik-structures-review-5.md`
  (sekizgen gövde, 20 m'de bir kaburga, kapı çerçeveleri, ışıklı iç, trim sheet) ile koridoru
  yeniden yapıp kite devam ediyor.
- **V6d başladı:** `blueprints.ts` (plan = çeyrek dönüşlü kit parçaları; `openPorts` her kapının
  tam bir karşı kapıyla buluştuğunu denetler; `blueprintPoses` planı trigonometri olmadan
  yerleştirir) ve katalogda `ports`/`cargo`. `structures.test.ts` her kit parçasını denetler:
  kapı ızgarada ve önü açık, çerçeve katı, rotalar ≥ 62 m açık, damarın arkası katı, kargo
  çevresinde ≥ 40 m boşluk. Plan verileri ve layout'a bağlama kit gelince.
- **V6d, ilk binalar oyunda (Claude kararı):** `plans.ts`: **Karakol** (ağız · koridor · farm
  odası · koridor · ağız, yan kapılar kapaklı; 8 tane, dış sınırda, her biri Kalp'e bakan 30°
  çizgilerinde, çıkışsız açılarda) ve **Rafineri** (farm salonu, Kalp'e bakan ağız, arkada
  hangar, çatıda iki katlı kule; her katta bir ağız, tepede kuyu; 3 kanat Kalp'te 30/150/270°,
  800 m, üç yükseklikte). Damarlar artık her yapının damar noktalarında büyür (kargo
  körfezlerinden uzak), kargo noktaları farm yeri olur. Kalp farmının yarısı rafinerilerde.
  Ölçüm: gizli farm yeri 111/150 (%74; hedef ≥ 72 ve ≥ %60). Harita: karakol ve rafineri
  simgeleri, lejantta ne işe yaradıkları. Koridor/oda/ağız/kapak/salon/hangar/kule oyunda.
- **PC kapandı (13:20):** Codex kırık koridordan devam ediyor (`yarik-kit.blend` 13:20
  kaydı); review-7 (kule tepesi giriş, gölge yüz çok karanlık) sırada.
- **Kit tamam, iki yeni bina (16:40):** kırık koridor, çökük oda ve dört süs geldi; kural
  testleri geçti. Dış halkadaki 4 karakol artık **harabe** (çökük oda + gedikli koridor: üçüncü
  giriş yandaki gedik). **Liman eki**: Sessiz Liman'dan 15° yanda, 6 km'de, şeridinin dışında;
  T kavşak, iki farm odası (biri çökük), üç ağız ve bir gedik; ön ağzı Liman'a bakar. Haritada
  karakol simgesiyle çizilir; lejant "hep bir arka kapı" oldu (harabe karakolun üç kapısı var).
  Codex şimdi Gangut'ta (Tersane göbeği); review-7 Gangut'tan sonra gidecek.
- **Süsler ve Tersane (17:45):** her kit binasının çatısında en az bir süs var (anten, radyatör,
  tank, güneş kanadı), 2 m gömülü; çatı derisi 10 m. **Tersane** ayrılmış yerinde (0°, 5 km,
  +300 m): ortada Gangut (halka istasyon, geçişi Kalp çizgisinde, halkada bir farm cebi), iki
  yanda iki kit deposu (salon + hangar + çatıda gözcü kulesi; her biri 4 giriş, iki ayrı
  yükseklikte). Kalp'ten açık şerit Gangut'un ön girişine gelir; haritada halka + iki depo,
  "Tersane" etiketi. 48 gemide tick p95 3,1 ms.
- **Açık hata (Codex, review-8):** Gangut'un halkası geçiş ekseninin iki ucunu da kesiyor
  (y 55, |z| 160–210). Göbekten düz çıkan pilot halkaya çarpıyor. "Her giriş 150 m açık" testi
  bu yüzden kırmızı. Codex halkaya iki kapı açıyor; ardından review-7.
- **Araç düzeltmesi:** `yarik-structures.mjs` isimle çalışınca kataloğu yalnız o isimlerle
  yazıyordu; artık katalog her zaman tüm bitmiş parçaları içeriyor, isimler yalnız hangi render
  glb'lerinin yeniden üretileceğini seçiyor. Nicemlemenin bıraktığı sıfır alanlı üçgenler de
  (Gangut'ta 3 tane; oyun bunları atınca kenarlar açık kalıyordu) komşusunu bölerek onarılıyor.
- **Akşam (2026-10-22):** review-8 kapandı (Gangut halkasında iki 96 m geçit; "her giriş 150 m
  açık" testi yeşil) ve review-7 geldi (kit'te açık albedo, pencere sıraları, amber ışıklar;
  kule tepesi kuyusu giriş). **6 dev kayalık** dış sınırda (11 km, yarım açılarda, iki tarama
  sırayla, yarık Kalp'e bakar; rota ve ağız testleri yeşil). Görsel kusur: yarık duvarları düz
  boolean yüz, doku yayılmış → `yarik-structures-review-9.md`. **halka_harabe** gelmedi:
  collider'da 1–4 mm aralıklı köşeler nicemlemede kaynıyor (14 açık kenar), Codex düzeltiyor;
  sonra review-4 (Kovuk dışı, Enkaz karanlık) → brief-3 (Kanyon, Petek) → review-3 kalanı.
- **Gece (2026-10-22):** halka_harabe düzeldi ve **Enkaz Mezarlığı'nda**: Enkaz'ın 750 m yanında,
  150 m yukarıda, şeridin dışında; geçişi yukarıdan aşağı, kargosu farm yeri (test yeşil).
  Codex sırası daraltıldı: Kovuk tek tur → kayalık yarıkları (review-9) → Kanyon + Petek → son
  olarak Enkaz albedosu. Enkaz oyunda düzeltilemedi: Kalp'e bakan yüzü siyah dokuya düşüyor
  (renk ×2, metal 0,55, 4× öz ışık o pikselleri hiç değiştirmedi); kod geri alındı.
- **V6c ve V6e bitti (2026-10-22 gece):** Codex kuyruğu kapandı. **Yarık Kanyonu** Kristal
  Kuşağı'nın ortasında (300°, 5,2 km; kuşağın kaya ve kristali çevresinde, duvarlarında damar).
  **Petek** ayrılmış yerinde (180°, 5,2 km, Kalp'ten açık şerit). Yeni yapı türleri `canyon`,
  `honeycomb`: yer işareti, harita simgesi (kıvrık yarık / hücreler) ve "Kaya mağarası · içeri gir,
  takipçini kaybet" lejantı. Kovuk'un yeni dışı (tarama dokusu, kırık siluet) ve kayalık yarık
  duvarları oyunda. Damar en küçük boyu 6 → 4 m (kanyon duvarı rotadan ~40 m'de).
  **Enkaz karanlığının kökü:** pbr materyal `vertexColors=true` kalıyordu, renk niteliği ise
  hazırlıkta siliniyordu; WebGL eksik niteliği 0 okur → siyah. `authored()` artık köşe rengi
  okumaz (testli). Harita etiketleri artık işaretin dış yanında (Kalp üstte), çakışmıyor.
  Sıradaki: V6g (48 bot + telefon FPS).
- **V6g telefon (2026-10-22, S22):** Yükte çökme: Chrome'un 32-bit sayfa süreci ~600 MB'ta
  SIGTRAP. Nedenler: yapı dokuları webp (açılınca ~745 MB, kitin 17 parçası aynı 4 dokuyu ayrı
  taşıyor); geliştirmede StrictMode paketi iki kez paralel yüklüyordu. Düzeltme: yapı glb'leri
  KTX2 (`tools/arena-ktx2.mjs glbs-prepare/-pack`, VPS; doku 586 → 170 MB), yükleme bir kez.
  Kare: HUD 10 Hz'de bütün sayfayı ve işaretçileri yeniden kuruyordu; sayfa yalnız `phase`'e
  abone, işaretçiler `HudMarks` (memo). Savaş sahnesi (12 gemi, 96 duman) **42–63 fps, ort.
  ~52**; çağrı 200–240, üçgen 290–350 bin (hedef ≤ 250 bin — açık). Ölçüm DevTools'suz
  yapılmalı: bağlıyken React dev + inspector kareyi ~4× şişiriyor, yükte belleği taşırabiliyor.
  Arka görüş kaldırıldı (KG-X23): savaş sahnesi 228k → 134k üçgen, 161 → 117 çağrı.
- **V6g 48 bot (2026-10-23, VPS, başsız, 15 dk × 2 tohum, 4 sn arayla giriş):** tick p50 0,7 ms,
  p95 1,5–2,1 ms (hedef < 5 ✓), tek seferlik 38–142 ms sıçrama. İlk temas (1300 m, görüş ışını)
  medyan 13–28 sn, ort. 26–68 sn (hedef 60–120: hızlı); temasların %59–71'i doğulan girişin
  1,5 km'sinde, %29–33'ü 20 sn önce doğmuş biriyle → **girişler sırayla dağıtılıyor** (sahip;
  `nextEntry`, takımlar gelince aynı girişten birlikte). Kalp (< 1,2 km) yalnız %4–7 dolu: botlar
  kuşaklara gider, oyuncu davranışını yansıtmaz. **Hata düzeltildi:** sunucu 1600 m'deki herkesi
  gönderiyordu, istemci 12'den fazla satırlı anlık görüntüyü bozuk sayıp atıyordu (kalabalıkta
  donma) — sunucu artık en yakın 12'yi gönderir. Anlık görüntü pilot başına ort. 3,2 KB, en çok
  5,9 KB × 15 Hz; madenler (~1 KB, her pakette tamamı) ve kargo (~0,9 KB, harita geneli) en büyük
  kalemler; mermi/duman/kargo AOI'siz → sıradaki ölçek işi.
- **V6g 50 pilot gerçek soket (2026-10-23, VPS, ARENA_SEATS 100):** 50 WebSocket istemci tek
  400 m'lik it dalaşında (ateş, duman, gizlenme, turbo); sunucu ile istemciler aynı makinede, ağ
  gecikmesi/kaybı yok. **Darboğaz anlık görüntüydü, simülasyon değil:** CPU'nun ~%41'i paket
  kurma + gönderme, simülasyon %5,5; bağlı kimse kalmayınca aynı 53 gemiyle tick p95 1,5 ms.
  Ortak satırlar (mermi/duman/kargo/maden) pilot başına 50 kez kuruluyordu → tick başına bir kez:
  tick p95 ~35 → 18 ms, düşen tick 8 → 0, 300 ms üstü paket arası 95 → 0, RTT tepe 459 → 129 ms,
  CPU %55 → 37. **Açık:** paket ort. 13 KB (mermi 5,1 · duman 3,5 · diğer pilotlar 2,4 · kargo
  1,2 · maden 1,0 KB) × 15 Hz ≈ pilot başına 1,5 Mbit/sn (~700 MB/saat); duman havuzu (96) sürekli
  dolu, puf'ların %97'si 12,5 sn ömrünü doldurmadan siliniyor (kalabalıkta duman perdesi ~1–2 sn).
  Botlar kimseyi öldürmedi: ölüm başına herkese giden kadro (roster) yayını ölçülmedi.
