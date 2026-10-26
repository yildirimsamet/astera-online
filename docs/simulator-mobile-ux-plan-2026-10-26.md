# Savaş Simülatörü — mobil UI/UX planı (2026-10-26)

Sahip talebi: "Mobil benim için çok önemli… her şey çok boğucu. Hem simülasyonun oynadığı alan,
hem ayarlar, butonlar, açıklamalar, bannerlar, toasterlar. Baştan sona UI/UX odaklı tasarım planla."

Kapsam: `?simulator=1` sayfası ve aynı `BattleReplay` bileşenini kullanan oyun içi gerçek savaş
tekrarı (`BattleReplayDialog`). Hedef ekranlar: 350×812 (ana bütçe), 411×893, yatay 812×375,
masaüstü 1280×800.

## 1 · Bugünkü durum (350×812, ölçüldü)

| Parça | Yükseklik | Sorun |
| --- | ---: | --- |
| Başlık (logo, başlık, dil) | 103 | "Choose a language" iki satır; logo büyük; oyuna hiçbir şey katmıyor |
| Araç çubuğu | 51 | "Configure fleets" neyin kurulduğunu söylemiyor (11'e 10 mu, 200'e 3 mü?) |
| Üst bilgi alanı (iki taraf + şerit + Aegis) | 104 | Üç ayrı kutu; Aegis savunanın olduğu halde ayrı satırda |
| **Savaş alanı** | **293** | Ekranın %36'sı. Ürün bu, ama en az yeri o alıyor |
| Kamera satırı (Birim seç, Genel, +, −) | 42 | 21+ gemilik yerel `select`; + ve − pinch ile zaten var |
| Zaman satırı | 29 | "74.5s / 136.1s": saniye oyuncu için anlamsız, birimi raunt |
| Oynatma düğmeleri | 48 | 7 düğme; ⇅ ve "Shots" ne yaptığını söylemiyor |
| "Simultaneous round…" + "Round end" | 26 | Kural metni oynatma kontrollerinin arasında |
| Raunt sekmeleri | 34 | Yatay kayıyor; 8'in 5'i görünüyor, "Round 5 / 8" kesik |
| Savaş dengesi | 32 | İyi bilgi, ama sabit yer kaplıyor |
| Sonuç satırları | 0–60 | Ekranın altında, savaş bittiği anı kaçırıyor |
| Altbilgi | 29 | Her zaman aynı cümle |

Sahnenin üstünde yüzenler: gemi başına HP sayısı/adı/"bu raunt ateş edecek", hasar rozetleri,
dünya etiketleri (◆ Attacker, ▲ Defender, ↗ Alive · out of combat), geri çekilenler paneli,
akın sonrası notu (`top:130px` sabit), "ayarlar değişti" notu, hesaplama örtüsü.

Teşhis: Ekranın her parçası kendi kutusunu ve kendi açıklamasını taşıyor. Hiçbir parça savaş
alanına yer bırakmıyor, sahnenin üstündekiler de birbirine çarpıyor.

## 2 · İlkeler

1. **Sahne ürünün kendisi.** Telefonda ilk ekranın en az %65–70'i savaş alanı olacak.
2. **Tek ekran, sayfa kaydırması yok.** Sahne parmakla döndürülüyor (`touch-action: none`).
   Uzun bir sayfada dikey kaydırma ile kamera döndürme birbiriyle çakışır. Bu yüzden ayrıntılar
   sayfanın altına değil, alttan açılan bir sayfaya taşınıyor.
3. **Sahnenin üstünde yalnız canlı an durur:** kim ateş ediyor, kim vuruldu, kim kaçtı. Kural,
   sayı tablosu ve listeler bir dokunuş derinde kalıyor (aşamalı gösterim).
4. **Her yazının bir kararı veya anlamı olmalı.** Açıklaması olmayan simge ya da saniye gibi
   anlamsız birim kalmayacak.
5. **Sabit yükseklik:** Şerit ve satırlar atıştan atışa boy değiştirmeyecek, sahne zıplamayacak.

6. **Önce kaldır, sonra taşı** (sahip, 2026-10-26: "Gereksiz şeyler olmasa da olur"). Bir parça
   karar ya da anlam taşımıyorsa başka yere taşınmaz, silinir.

### Kaldırılanlar

| Parça | Neden gereksiz |
| --- | --- |
| Alt başlık "Build two fleets…" ve altbilgi cümlesi | Sayfanın adı zaten söylüyor |
| Sahnedeki "Drag to orbit…" ve "Viewing from…" | Hareket kendini öğretir; bakılan taraf güç şeridinde parlak |
| Dünya etiketleri (◆ Attacker, ▲ Defender, ↗ Alive · out of combat) | Güç şeridi ve taraf işaretleri aynı şeyi söylüyor |
| Gemi başına HP sayısı ve "Will fire this round" yazısı | Can çubuğu ve amber işaret yeterli; sayı seçilen gemide |
| Kamera `+` ve `−` | Pinch ve tekerlek var; yalnız "Genel görünüm" kalır |
| "Birim seç" listesi | Gemiye dokunmak, atış satırı ve geri çekilen satırı aynı kartı açıyor |
| ↺ başa dön, "Round end" düğmesi | Zaman çubuğu ve raunt parçaları aynı işi yapıyor |
| 7'li hız listesi | Tek çip: 1× → 2× → 4× → ½× |
| Saniye göstergesi | Birim raunt ve atış |
| Raunt sekmeleri | Raunt parçalı zaman çubuğu |
| ⇅ taraf değiştir düğmesi | Güç şeridinde tarafa dokunmak |
| "Simultaneous round…" katlaması ve playback/camera yardım metinleri | Tek cümlelik kural, Özet'teki dengenin altına |
| "Ayarlar değişti" notu | Simüle et düğmesinin hâli |
| Yüzen akın sonrası notu | Savaş sonu kartında tek satır |

## 3 · Yeni yerleşim (350×812)

```text
┌──────────────────────────────────┐
│ ‹ ASTERA   Savaş simülatörü  🌐TR │ 44  uygulama çubuğu
├──────────────────────────────────┤
│ [⚙ Filolar  11 ⚔ 10] [Gezegen▾][▶ Simüle et] │ 44  senaryo çubuğu
├──────────────────────────────────┤
│ ◆ Saldıran ●11 ✕0 ↗0 │ Savunan ●10 ✕1 ↗0 ▲ │ 30  güç şeridi
│                      │ Aegis ▬▬▬▬░░ 640/1.1K │     (Aegis savunanın altında)
│ Raunt 3/8 · Saldıran ateş ediyor   Atış 3/4 │ 34  durum şeridi (2 sabit satır)
│ Corsair #A8 ateş ediyor                      │
├──────────────────────────────────┤
│                                  │
│                                  │
│          SAVAŞ ALANI             │ ~570 (bugün 293)
│      (yalnız işaret + çubuk)     │
│                                  │
│ ↗2                             ⊙ │   ↗ geri çekilenler · ⊙ genel görünüm
├──────────────────────────────────┤
│ ▶  ‹ ›  |1▮2▮3▮4▯5▯6▯7▯8|   1×    │ 44  oynatma + raunt şeritli zaman çubuğu
├──────────────────────────────────┤
│ ︿ Özet · Atışlar    Saldıran güçlü 1:1,9 │ 36  ayrıntı tutamacı
└──────────────────────────────────┘
```

Bütçe: 44 + 44 + 64 + 44 + 36 = 232 → savaş alanı **≈580 px (bugünün ~2 katı)**.
411×893'te ≈660 px.

### 3.1 Uygulama çubuğu (103 → 44)
- Solda geri oku ve küçük logo, ortada "Savaş simülatörü".
- Sağda dil, yerel `select` üzerine giydirilmiş küçük bir ikon (🌐 TR) olacak.
- Alt başlık telefonda gizlenir; masaüstünde kalır.

### 3.2 Senaryo çubuğu (51 → 44)
- "Filoları ayarla" düğmesi kurulumu özetler: `⚙ 11 ⚔ 10` (birim sayıları, korsan varsa ☠ işareti).
- Savaş alanı seçimi kısa etiketle kalır.
- "Simüle et" düğmesinin iki hâli var:
  - normal;
  - **ayarlar değişti** hâli: nokta ve "Yeniden simüle et" yazısı. Bugünkü ayrı "değişti" notu (`sim-dirty`) kaldırılır.

### 3.3 Güç şeridi + durum şeridi (104 → 64)
- **Güç şeridi:** her taraf tek satır: renk + ad + ● aktif, ✕ yok edildi, ↗ çekildi. Kelimeler ekran okuyucuda kalır; uzun basınca açıklama çıkar.
  - **Aegis**, savunan tarafın hücresinin altında 3 px'lik çubuk olarak durur ("640/1,1K"). Ayrı satır olmaz.
  - **Bir tarafa dokununca kamera o tarafa geçer.** Bugünkü anlamı belirsiz ⇅ düğmesi kalkar; bakılan tarafın kenarı parlak olur.
- **Durum şeridi**, iki sabit satır:
  - Üst satır: raunt, sıra ve sağda "Atış 3/4".
  - Alt satır: ateş eden gemi, ya da "Aegis yalnız kalkanı vurur", ya da "2 saldıran, 1 savunan çekildi".
  - Savaş bitince tek satır: "Savaş bitti". Tekrar hatası düzeltildi.

### 3.4 Savaş alanı
- **Gemi başına varsayılan:** taraf işareti (◆/▲) ve can çubuğu. HP sayısı, isim ve "bu raunt ateş edecek" yazısı yok.
  - Sırası gelecek gemiler amber işaretle gösterilir (kelime yok).
  - Ateş eden gemi tek satırlık ad etiketi alır.
  - Seçilen gemi tam bilgi alır.
- **Hasar:** vurulan geminin üstünde tek satırlık kısa ömürlü çip: `−77 ◈−19`. Çipler üst üste binerse en yenisi kalır.
- **Dünya etiketleri:** "◆ Attacker / ▲ Defender" kalkar; güç şeridi bunu zaten söylüyor. Kaçış noktası küçük bir "↗2" çipi olur.
- **Tek yüzen düğme:** sağ altta 32 px'lik Genel görünüm ⊙.
- **Seçilen gemi kartı:** 2 satırlık kompakt kart (bu oturumda yapıldı). Gemi her zaman kartın üstünde kalır (kamera testi var).

### 3.5 Oynatma satırı (42 + 29 + 48 + 26 + 34 = 179 → 44)
- `▶  ‹ ›` ve **raunt şeritli zaman çubuğu**: iz 8 parçaya bölünür, her parça bir raunt.
  - Bir parçaya dokunmak o raundun başına atlar. Bu, raunt sekmelerinin yerini alır.
  - Oynatma başı parça içinde ilerler. Çekilme ve patlama anları ize küçük tik olarak düşer.
- Hız: tek bir `1×` çipi; dokundukça 1× → 2× → 4× → ½× döner.
- Saniye gösterilmez. Erişilebilir etiket: "Raunt 3/8, atış 3/4".

### 3.6 Ayrıntı sayfası (tutamaç 36 px, yukarı çekince %70 yükseklik)
Tutamağın kendisi de bilgi taşır: sekme adları ve sağda dengenin hükmü ("Saldıran güçlü · 1:1,9").
Sekmeler:
- **Özet:**
  - sonuç cümlesi;
  - iki tarafın kalan / kaybedilen / çekilen sayıları;
  - kurtarılan yer birimleri;
  - akın sonrası (korsan baskını, kargo çekilmesi);
  - geri çekilenler listesi (sahnedeki "↗2" çipi buraya açılır);
  - savaş dengesi (güç, oran, tempo, çekilme pencereleri) ve altında tek cümlelik kural.
- **Atışlar:** bugünkü atış kaydı ve atış hesabı. Ayrı diyalog yerine sekme olur.

### 3.7 Savaş sonu anı
Bugün savaş bitince sonuç ekranın altında bir satır ve sahnede "Battle complete" yazısı; an kaçıyor.
Yeni hâli: sahnenin altında yükselen **sonuç kartı**:
- "Akının başarılı oldu";
- `Saldıran 5/11 kaldı · Savunan 0/10 · 2 çekildi`;
- varsa akın sonrası satırı;
- [Tekrar izle] [Ayrıntılar].

Kart kaydırılarak kapatılır. Bugünkü yüzen `sim-aftermath-note` notu kalkar.

### 3.8 Filo ayarları sayfası
- Tam yükseklikte alttan açılır. Başlıkta `Saldıran 11 | Savunan 10` sekmeleri (sayılı) ve ✕ olur.
- **Sayfanın altında sabit "Simüle et"** olur, böylece kapatmadan çalıştırılır.
- Araştırma kapalı başlar, tek satır özet gösterir: "Araştırma 3 · 2 · 0 · 1".
- Gemi satırları 52 px olur: görsel, ad, sınıf çipi, temel saldırı · HP, `− 12 +` adımlayıcı. Sayıya dokununca klavye açılır.
- Örnek savaşlar, korsan, tohum ve savaş alanı ayrıntıları "Gelişmiş" katlamasına girer.
- Hata, sayfanın üstünde değil, ilgili satırın altında kırmızı gösterilir (`sim-alert` ve satır hatası).

### 3.9 Masaüstü ve yatay telefon
- Aynı parçalar kullanılır:
  - solda ayarlar;
  - ortada sahne (güç + durum şeridi sahnenin üstünde, içinde değil);
  - sağda ayrıntı sekmeleri kalıcı panel olarak (320 px).
- Gemi HP sayısı yalnız gemi büyükken gösterilir ve tek satır olur ("1508"). Bugün "1508 / 1508" üç satıra kırılıyor.
- Yatay telefonda (yükseklik ≤ 500):
  - uygulama ve senaryo çubuğu tek satıra iner;
  - güç + durum şeridi tek satır olur;
  - ayrıntı sayfası sağdan açılır.

### 3.10 Oyun içi gerçek tekrar
`BattleReplayDialog` aynı `BattleReplay`'i kullanıyor. 3.3–3.7 oraya da aynen uygulanır.
Senaryo çubuğu yerine raporun başlığı gelir.

## 4 · Kenar durumlar

- 1v1, 400 birim, yalnız yer topları, korsan, anıt, Aegis yok, savunma çevrimdışı.
- Savaş sıfır rauntta biter (kaçış önceden), herkes yok olur, hiç atış olmaz.
- Uzun gemi adları ve 6 dil: Almanca ve Fransızca en uzun; şeritler tek satırda kısalır, taşmaz.
- WebGL yok veya GPU kaybı: sahne mesajı yeni yükseklikte ortalanır.
- Ayar sayfası açıkken yeniden simüle et; tekrar sırasında ayar değişti.
- Ekran döndürme ve klavye açılışı (`svh`/`dvh`); güvenli alan (çentik, alt çubuk).

## 5 · Aşamalar

Her aşamada:
- davranış için önce test (TDD);
- 350×812, 411×893, 812×375 ve 1280×800 ekran görüntüleri;
- ilgili test grubu.

1. **Kabuk:**
   - uygulama + senaryo çubuğu;
   - tam yükseklik (`100dvh`), sayfa kaydırması yok;
   - sahne bütçesi;
   - "ayarlar değişti" düğme hâli.
2. **Şeritler:** güç şeridi + Aegis + dokununca taraf değiştirme; iki sabit satırlı durum şeridi.
3. **Oynatma satırı:** raunt şeritli zaman çubuğu, hız çipi; raunt sekmeleri, saniye ve ⇅ kalkar.
4. **Ayrıntı sayfası:** Özet / Atışlar; atış kaydı, roster, denge ve sonuçlar taşınır, gereksizler silinir.
5. **Savaş sonu kartı** ve akın sonrası.
6. **Sahne okunurluğu:** gemi okuma kuralları, hasar çipi; dünya etiketleri ve fazla kamera düğmeleri silinir.
7. **Filo ayarları sayfası:** sabit Simüle et, adımlayıcılar, araştırma özeti, Gelişmiş, satır içi hatalar.
8. **Masaüstü, yatay telefon ve gerçek tekrar** uyumu; 6 dil metin kontrolü.

## 6 · Uygulandı (2026-10-26)

Faz 1–8 uygulandı. Faz 7'de sayfanın altına sabit bir "Simüle et" konmadı: ayar sayfası
açıkken senaryo çubuğundaki düğme zaten görünüyor, ikincisi gereksiz olurdu.

### Büyük savaşlar (500v500'e kadar)
- **Sınır:** `SIMULATION_UNIT_LIMIT` 400 → 1000 (taraf başına 500).
  - Motor: 1000 birimi ~16 ms'de çözüyor.
  - Kayıt: ~1,8 MB.
- **Yaylım temposu:** atışlar tek tek çizildiğinde 200v200 yarım saat, 500v500 bir saati aşıyordu.
  - Bir tarafın ateşi en fazla `VOLLEY_SECONDS` (16 sn) sürer; büyük tarafın atışları üst üste biner.
  - Her kayıtlı atış sırasıyla oynar; adım düğmeleri her atışa yine durur.
  - 500v500 artık ~4 dk, küçük savaşlar değişmedi.
- **Sahne etiketleri:** 64 gemiye kadar her geminin kendi etiketi var.
  - Üstünde sabit 6 etiketlik havuz devreye girer: seçilen, ateş eden, en yeni isabetler, kaçanlar (`featuredShips`).
  - Can ve kalkan çubukları GPU'da, yine her gemi için.
- **Atış kaydı:** satırlar `memo`; oynatma her 100 ms'de 500 satırı yeniden çizmiyor.

Ölçüm (production build, 390×844 DPR 2, oynatma sırasında):

| Savaş | Önce (dev, 1×) | Sonra (prod, 1×) | Sonra (prod, CPU 4× yavaş ≈ orta telefon) |
| --- | --- | --- | --- |
| 11v11 | 223 fps | 332 fps | 79 fps |
| 200v200 | 40 fps | 201 fps | 47 fps |
| 500v500 | 17 fps | 135 fps | 31 fps |

Önceki 17 fps'in sebebi 1000 ayrı DOM etiketiydi (15 bin DOM düğümü, karede ~500 ms stil hesabı).

### Yer topları (20/50/100)
- **Önceki hâl:** altın açıyla gezegene dağılıyorlardı. Sayı arttıkça küçülüyor, 50'den sonra gezegenin önünde tek leke oluyorlardı.
- **Şimdi:**
  - Saldırganın gördüğü yüzde, enlem sıraları hâlinde, önden arkaya dizilirler.
  - Her sıra soldan sağa dolar.
  - Aynı tür top tek bir batarya kuşağı oluşturur.
- **Boyut:**
  - 150 topa kadar tam boyuttadırlar.
  - Daha fazlasında küçülürler, en az %55'e kadar.
  - Gezegen topları taşıyacak kadar büyür.
  - Gezegen geniş bir savunma filosunun arkasında da en az filo genişliğinin ¼'ü yarıçapta durur.

### 6.x · Giriş noktaları ve yer topu modelleri (2026-10-26)

- **Menü → Yardım → "Savaş simülatörü"** kutucuğu (Codex arka planı `atmosphere/simulator-v1.webp`). Simülatör menünün üstünde açılır; "Menüye dön" menüye döner.
- **Rapor → "Simülatörde dene ↗"** ("Savaşı izle"nin yanında, yalnız replay varken). Güçler replay'den okunur (`fromReplay.ts`): taraflar, yaralar, araştırma, Aegis seviyesi/şarjı, savunma kapalı, kaçan filo + otomatik kaçış; korsan seviyesi rapordan gelir. Zar tohumu bilinmez: başlıkta "zarlar yeniden atılır" yazar. 5'ten fazla kanat 5.'ye katlanır.
- **Yer topları:** Bastion/Harpoon/Thorn için Codex'in Blender ile ürettiği low-poly taretler (`models/ground/*.glb`, ~2,3–2,9k üçgen, 2 malzeme, namlu +Z). Taret kendi kaidesine oturur (`battleModelParts(..., standing)`); eski altıgen plakalar kaldırıldı. Eski `ship_1/ship_3.glb` dosyaları eski paketler için duruyor.
