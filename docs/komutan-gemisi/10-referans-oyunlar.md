# Komutan Gemisi — Referans oyunlar: neden iyi, ne alırız, ne almayız

> **Durum:** İlk araştırma + 2026-10-08 APK/üretici kaynakları incelemesi ve MVP uygulama kaydı.
> **Hedef okuyucu:** Kontrol, his ve gelişim kararlarını verecek agent.
> **Dayanak:** S4 ([01](01-urun.md)); sahibin talimatları aşağıda (R1–R3).

---

## 1. Sahibin talimatları

- **R1** Metalstorm'daki **uçuş mekaniklerini, kontrolleri ve vuruş mekaniklerini** dikkatlice
  incele; gerekirse araştır. En çok beğeni alan oyun o; demek ki bir şeyleri iyi yapmışlar.
- **R2** Subdivision'ı da dikkatlice incele: işimize yarayacak, mantığımıza uyacak çok şey var —
  farklı gemiler, geliştirme sistemi, kayalar, ambar kapasitesi, geminin durduğu 3B hangar vb.
- **R3** Bu oyunların karışımı olan yeni bir oyun yapmıyoruz. Başarılı oyunların iyi yaptığı
  şeylerin **neden** iyi olduğunu ve **nasıl** yapıldığını anlayıp **kendi oyunumuza en çok uyan**
  yapıyı kendi tarzımızla kuruyoruz (S4). Bir fikir alınacaksa önce "Astera'nın döngüsüne ne
  katıyor?" sorusu cevaplanır (CLAUDE.md: her özellik OWNERSHIP · CURIOSITY · COMPETITION ·
  AMBITION · RISK · OPPORTUNITY · RE-ENGAGEMENT · MEMORABILITY · FUN'dan birini güçlendirmeli).

## 2. Metalstorm (Starform, Unity URP; mobil + PC; takım tabanlı hava savaşı) — öncelikli

**Bilinenler:**
- Dört kontrol şeması: sanal joystick, tilt, imleçle nişan (cursor aiming), klavye-fare/gamepad.
  Oyuncu yorumu: tilt "bir parmağı boşa çıkardığı için" en kolayı.
- HUD: hız göstergesi, **ideal dönüş hızı göstergesi**, yakıt, aktif silah, **top için önleme
  (lead) nişangâhı**, füze kilit göstergesi, mini haritada uçuştaki füzeler.
- Her silah için tahmin çizgisi belli bir mesafede gösterilir; **ateş ederken uçak tahmin
  çizgisine doğru bir miktar kendiliğinden döner** (cömert nişan yardımı).
- Derinlik: dönüş hızı, optimum dönüş hızı, stall hızı → afterburner/hava freni ile **hız yönetimi** beceri.
- Hedef: simülasyon değil, hızlı arcade; PC ve mobilin eşit eğlenceli olması.
- Eleştiri: oyuncular **ödeyerek kazan** (pay-to-win) güç farklarından şikâyetçi.

**Neden iyi:** girdi az (yön + ateş), derinlik hız yönetiminde; lead nişangâhı topçuluğu
öğrenilebilir yapıyor; tehdit bilgisi net (kilit uyarısı, mini harita); dokunmatikte seçenek bol.

**Alırız:** isteğe bağlı önleme işareti (KG-T16) · ateşte **hafif** hedefe dönüş ve nişangâh
sürtünmesi (2026-10-08 sahip kararı, KG-K20; ayarı KG-T34: kısa koni, kırpılmış güç, görünür
hedef şartı) · gaz + turbo + turbo'da
dönüş cezasıyla hız yönetimi derinliği (KG-T30, [03](03-ucus-ve-kontroller.md)) · net tehdit
farkındalığı (arka görüş + hasar yönü — onların mini harita/kilit uyarısının karşılığı) ·
PC-mobil eşitliği ilkesi (KG-A18) · birden çok kontrol şeması fikri (A/B, ileride tilt seçeneği).
**Almayız (şimdilik):** Metalstorm'daki kadar cömert otomatik hizalama ve kilit (KG-X1) ·
füze (spec'te yok) ·
güç farkı yaratan para modeli ([08](08-ilerleme-ve-ekonomi.md) kartopu önlemleri) · maç yapısı
(bizimki sürekli açık extraction alanı).

**Yerel agent'ın bakacakları:**
- Sahipten Metalstorm'un **kontrol ayarları ekranlarının** (hassasiyet, ölü bölge, şema seçenekleri)
  ve bir dakikalık **oynanış ekran kaydının** paylaşılmasını iste (agent oynayamaz).
- Çıkarılan Unity verisinde okunabilirse (MonoBehaviour/ScriptableObject): uçak istatistik
  tabloları (dönüş hızı, hız), silah ayarları (mermi hızı, atış hızı, dağılım), kontrol eğrileri,
  nişan yardımı parametreleri → yalnız **aralık referansı** olarak [04](04-savas-mekanikleri.md)
  tablosunu değerlendirmede kullan, kopyalama.
- Vuruş geri bildiriminin katmanları: isabet sesi, işaret, kıvılcım, öldürme onayı ayrımı.

## 3. Subdivision Infinity (Crescent Moon / MistFly; mobil kökenli; DX sürümü UE4)

**Bilinenler:** keşif görevlerinde silah yuvası **madencilik lazeriyle** değiştirilip asteroitlerden
mineral toplanır; **yaklaşık her üç asteroitte yeni bir düşman dalgası** gelir → **kaldıkça risk
artar**. Silahlar dişli kasası + kredilerle beş kez yükseltilir; pilot seviyesiyle yeni silahlar;
gemiler temel modelin ötesine "evrilir"; **hangar**dan gemi alınır, mağazada eşya alınıp satılır.
Kısa, yoğun görevler; "bir görev daha" kancası. Dokunmatik için tasarlanmış.

**Neden iyi:** risk–ödül tek cümlede anlaşılır (daha çok kaz = daha çok tehlike); yükseltme
seviyeleri az ve okunaklı; hangar gemiye sahiplik hissi veriyor.

**Alırız:** yönetim sayfasında **3B hangar sunumu** ([07 §8](07-hud-ve-ekranlar.md#yonetim-sayfasi))
· okunaklı seviye kartları · ambar kapasitesinin anlamlı bir özellik olması · kayalar hem siper
hem kaynak · F9 için "kaldıkça artan risk" fikri (ör. madencilik yapan gemi diğerlerine bir süre
görünür olur — KG-A12 ile birlikte sahibe öneri).
**Almayız:** PvE dalgaları ana tehdit olarak (bizim tehdidimiz oyuncular; NPC yalnız canlılık
için, KG-A6) · çok gemi satın alma (tek komutan gemisi; çeşitlilik kozmetik olabilir).

**Yerel agent'ın bakacakları:** hangar sahnesi (ışık, platform, kamera), yükseltme ekranı
düzeni, kaya modelleri ve kırılma efektleri, madencilik lazeri ve toplama efektleri, kargo/ambar
arayüzü, motor alevi ve izler.

## 4. Vendetta Online (Guild Software, özel NAOS motoru; MMO, Newtonian fizik)

**Bilinenler:** dokunmatikte iki sanal çubuk; önde ve arkada radar; nişan ve gaz bölgelerinde
değişken hassasiyet; Newtonian uçuş + "flight assist" anahtarı.
**Alırız:** arka farkındalığın değeri (onların arka radarı ↔ bizim arka görüşümüz), değişken
hassasiyet fikri (bizde expo eğrisi), kalıcı uzay hissi.
**Almayız:** Newtonian kayma (KG-X6), iki çubuk karmaşıklığı. Varlıkları büyük olasılıkla özel
biçimde → düşük öncelik ([09](09-varliklar-ve-referans-cikarma.md)).

## 5. Space Commander: War and Trade (mobil F2P kökenli; ticaret + filo)

**Bilinenler:** gemi yönlendirmesi hassas ve iyi; ama **aşırı cömert kilitlenme** savaşı "eller
serbest" ve durağan yapıyor (eleştirmen); ticaret çok basit; rolleri farklı gemiler (yük gemisi
savaşta zayıf ama çok taşır).
**Alırız:** kargo ↔ savaş rolü takası fikri (seviye bütçesiyle uzmanlaşma, [08 §3](08-ilerleme-ve-ekonomi.md)).
**Almayız:** otomatik kilit / pasif savaş (S72, KG-X1).

## 6. Ortak dersler → kararlarımız

| Ders | Kaynak | Bizdeki karşılığı |
|---|---|---|
| Az girdi, derinlik tek bir yönetilen kaynakta | Metalstorm (hız) | gaz/turbo/dönüş cezası, yakıt menzili |
| Nişan yardımı oyunu pasifleştirebilir | Space Commander | yalnız çok yakında hafif mıknatıs, kilit yok (KG-K20) |
| Arka/çevre farkındalığı kaçış kararını mümkün kılar | Vendetta, Metalstorm | arka görüş, hasar yönü, ekran dışı göstergeler |
| Kaldıkça artan risk "bir tur daha" yaratır | Subdivision | extraction döngüsü, F9 önerisi |
| Para/kalıcı güç farkı yeni oyuncuyu kaçırır | Metalstorm eleştirisi | sezonluk gelişim, seviye bütçesi, güç farkı sınırı |

Kaynaklar: [Metalstorm Wiki — Getting Started](https://metalstorm.wiki.gg/wiki/Getting_Started) ·
[Steam tartışması — kontroller](https://steamcommunity.com/app/2453200/discussions/0/689742961454439893/) ·
[GeekWire — Starform](https://www.geekwire.com/2023/seattle-startup-starform-led-by-z2-vets-ready-to-take-flight-with-aerial-combat-game-metalstorm/) ·
[TheSixthAxis — Subdivision Infinity DX](https://www.thesixthaxis.com/2019/08/07/subdivision-infinity-dx-review/) ·
[Digitally Downloaded — Space Commander](https://www.digitallydownloaded.net/2021/05/review-space-commander-war-and-trade.html) ·
[Massively OP — Vendetta mobile](https://massivelyop.com/?p=306121).

## 7. 2026-10-08 inceleme ve MVP'ye uygulama

Üretici kılavuzları incelendi; APK'lardan çıkarılan modeller gerçek Three.js önizlemesinde
farklı açılardan karşılaştırıldı. Bu kayıt bütün oyunlarda telefonda oynanmış bir oturum iddiası değildir.
İlk araştırmadaki oyuncu/inceleme yorumları üretici belgesi olarak değerlendirilmez.

| Doğrudan incelenen kaynak | Çıkarılan ders ve mevcut MVP karşılığı |
|---|---|
| [Metalstorm başlangıç kılavuzu](https://metalstorm.wiki.gg/wiki/Getting_Started), [temel rehber](https://metalstorm.wiki.gg/wiki/Basic_Guide) | Kontrol seçenekleri, hız/yakıt, top önleme işareti ve çevre farkındalığı birlikte ele alınır. Bizde gaz, turbo şarjı ve dönüş cezası, önleme elması, ateşte hafif hedef mıknatısı (KG-K20), canlı arka görüş ve hasar yönü vardır. Kilit yoktur. |
| [Vendetta taktik HUD](https://www.vendetta-online.com/manual/hud_tactical.html), [ön/arka radar](https://www.vendetta-online.com/manual/hud_radar.html) | Silah ve turbo enerji kararını paylaşır; arka taraf da sürekli izlenir. Bizde sahip kararıyla ortak döteryum deposu, kalan uçuş süresi, atış tüketimi ve arka kamera aynı uçuş ekranındadır. Newtonian uçuş aktarılmadı. |
| [MistFly — Subdivision Infinity](https://www.mistfly.games/subdivision-infinity) ve çıkarılan gemi/kaya/efektler | Gemi silueti, doku detayları, normal haritaları ve uzay fonunun okunaklılığı birlikte seçildi. KG-K22 sonrası paket büyük ölçüde Subdivision'dır: gemiler, kayalar, yapı parçaları, 2048² gökyüzü, efekt dokuları ve sesler; 3. şahıs takip kamerası da Subdivision'daki gecikmeli kamera örnek alınarak kuruldu (KG-K19). |
| [HomeNetGames — Space Commander](https://store.steampowered.com/app/1449750/Space_Commander_War_and_Trade/) ve çıkarılan sesler/parçalar | Farklı gemi rolleri yük/çatışma tercihine bağlanır. Bizde test kargolu taşıyıcı bir hedef oluşturur; örneklerden motor, atış/isabet, turbo, patlama, müzik ve UI ses katmanları seçildi. |

**Görsel seçimde bulunan sorunlar:** Subdivision DFME UV yönü glTF'te düzeltilmeden doku
panelleri ters ve kayaların bazı yüzleri siyah görünüyordu. Albedo/normal bağımlılıklarıyla
birlikte düzeltildi. Gökyüzü küpünde bir yüzün boyutu farklıydı; hazırlanmış kopyalar eşitlendi.
Çevre yansıması için ayrı küçük küp kullanıldı; orijinal yüksek çözünürlüklü dosyalar korunur.

**Vuruş hissi:** dönüşümlü namlu flaşı ve geri tepme, fiziksel mermi izi, onaylı isabette X,
öldürme halkası, gerçek atlas animasyonu, yerel ses örnekleri, uzaklık/yöne göre karşı atış
sesleri ve desteklenen cihazlarda titreşim birlikte çalışır. Bunlar iki tarayıcıdaki gerçek
sunucu çatışmasıyla incelenir; fiziksel telefon hissi/F7 onayı ayrıca gerekir.
