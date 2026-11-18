# İlk oturumu sahnelemek (Faz 5): "tıkla geç" yerine "gör, anla, yap"

Tarih: 2026-11-18 · Dal: `feat/new-player-journey` · Durum: **owner onayı bekliyor**

## 1. Sorun

Owner'ın 2026-11-18 tarihli yorumu:

> "Oyuncu giriyor ve sürekli işaret edilen şeylere tıklıyor ama bir amacı olduğunu, ne yaptığını ve neden yaptığını anlayamıyor. […] Ekranı kilitleyip 2-3 sn'lik kamera hareketleriyle o an tanıtılmak istenen şeyi göstermek yok. Tüm yapıyı 'aman sıradaki şeye doğru tıklasın, gerisi önemli değil' mantığıyla kurmuşuz. […] Geminin nereleri arızalı, ben bir şeyler yaptıkça nereleri düzeliyor bilmiyorum ve görmüyorum. Bir tamir anı yok. […] Gemi ilk başta sönük, yanık; birkaç ONAR'a basınca birden parlamış, cillop gibi olmuş bile."

İki izole oyuncu testi de aynı sonucu verdi. Testler 2026-11-17/18'de yapıldı. Modellerin ne kodu ne `CLAUDE.md`'yi gördüğü bir ortamda, yalnızca ekran görüntüsüyle ve dokunarak oynandı:

| | Sonnet ("strateji seven, sabırsız") | Haiku ("okumayan, 19 yaş") |
|---|---|---|
| Eylem sayısı | 34 (kendisi bıraktı) | 22, ardından **"BURADA KAPATIRDIM"** |
| KARAR / ONAY / KAYIP | 6 / ~24 / 4 | 8 / 6 / 8 |
| Kendi sözü | "Rehber dokun diyor, ben dokunuyorum. Oyun beni elimden tutup götürüyor, strateji yok." | "Kasa ve sayaçlar bana oyun oynadığımı değil, izlediğimi hissettirdi." |
| Ortak takılma | "Gerekli: Tersane" nerede? Soluk ONAR neden basılmıyor? | Aynısı; tam burada kapattı |
| Sevdiği an | Rafinerinin alev alması, kazıcının fırlaması | Rafinerinin alev alması, "Topla" |

İki testin ortak sonucu şu: oyuncunun sevdiği anlar dünyada bir şeyin değiştiği anlar. Ödül almak ve parlayan tuşa basmak sevilmedi.

## 2. Kodda kök nedenler (doğrulandı)

**K1. Gemi ekranında onarım görünmüyor.**
- Gemi ekranının tepesindeki görsel (`starter/ShipHero.tsx`), her gövde için 3 resimden biri: WRECKED, PATCHED ya da RENEWED.
- Resim, onarım payı %35'e ve %80'e ulaştığında birden değişiyor (`packages/rules/src/starter/look.ts`). "Birden cillop gibi" an tam olarak bu değişim.
- Sistem başına hasar (yangın, köz, kıvılcım) yalnızca galaksideki 3B modelde var (`galaxy/VesselBurn.tsx`, `damageSpots`) ve onarımla sönüyor.
- Ama onarım, galaksiyi tamamen örten bir sheet içinde veriliyor (`GalaxyView.tsx`, `detents={['full']}`). Oyuncu tamir ettiği parçayı hiç görmüyor.

**K2. Rehber neden anlatmıyor, emir veriyor.**
- `tutorial.line` satırlarında 7 kez "düğmesine dokun", 2 kez "sekmesine dokun" ve 7 kez başka "dokun" geçiyor.
- İhtiyaç söyleniyor ama gösterilmiyor. Örnek: "Dışarısı karanlık" deniyor, ama oyuncu karanlığı bir sorun olarak hiç yaşamıyor.

**K3. Yönetmen yok.** İlk kez yaşanan anlarda kamera bir çekim yapmıyor:
- Teleskop açılınca hemen bir yakınlaştırma jesti isteniyor, ardından asteroide dokun, ardından sheet açılıyor. Asteroide yaklaşma anı yok.
- Radar bir temas yakalayınca yalnızca bir satır okunuyor; ne yapılacağı ve bunun ne anlama geldiği söylenmiyor.
- Kalkışı takip etme (`followLaunch.ts`) var; bu tek örnek.

**K4. Kilitler nedenini söylemiyor.**
- "Gerekli: Tersane" yazıyor ama oyuncuyu oraya götüren bir yol yok.
- Soluk ONAR tuşu neyin eksik olduğunu söylemiyor. Tersane 800 alaşım ve 300 kristal istiyor; isteğe bağlı onarımların çoğu Tersane'ye bağlı.

**K5. Ödüller üst üste yığılıyor.**
- Her onarımdan sonra bir kurtarma kasası açılıyor.
- Ayrıca "Topla" anı ve Faz 4'teki 7 Gün kutusu da gemi ekranında. **Bu sonuncusu benim hatam.**
- İlk 5 dakikada üç ayrı "basılı tut, al" anı oluyor.

**K6. Temasın bir sonucu yok.** Kart "saldırı fırsatı olabilir" diyor ama oyuncunun bu bilgiyle ne yapacağını söylemiyor.

**K7. Açılış siyah.**
- Test, oyuna bomboş siyah bir ekranla başladı.
- Bu dev sunucusunun ilk derlemesinden de kaynaklanabilir; prod build'de ölçülecek.

**İyi haber:** Onarım sırası zaten bir ihtiyaç zinciri. Önce Rafineri, sonra Kristal Ocağı, Teleskop, Radar (ilk kazı gönderilince açılıyor), Anten ve en son Tersane. Yani **ilerleme kurallarına dokunmadan** bu sıra hikâyeye çevrilebilir. İş büyük ölçüde sunum işi.

## 3. Sektör bunu nasıl yapar (akıl hocası notu)

İyi mobil oyunların ilk deneyimi (FTUE, *first-time user experience*) üç kurala dayanır:

1. **Önce dünya bir sorun gösterir, sonra araç verilir.**
   - Clash of Clans'ta goblinler köye saldırır, kamera onları gösterir, sonra oyuncu topu yerleştirir ve topun goblinleri vurduğunu görür.
   - Hay Day'de karakter, kamerayla tarlayı gösterip "buğday ekelim" der.
   - Oyuncu aracı ihtiyacı yaşadıktan sonra alır.
2. **Kısa yönetilen çekimler (camera beat).**
   - 2–3 saniyelik kamera hareketidir. Üst ve altta siyah bantlar (*letterbox*: "şimdi izle" işareti) belirir ve dokunuş kısa süre kilitlenir.
   - Kamera yeni şeyi gösterir: bir yakınlaşma, bir dönüş, bir takip.
   - Her çekim tek bir kavram tanıtır. Dokunmak çekimi sonuna atlatır.
3. **İlerleme dünyanın içinde görünür (diegetic).**
   - İlerleme yüzdeyle değil, modelin kendisiyle anlatılır: yanan bölüm söner, ışığı yanar.
   - Oyuncu "motoru tamir ettim" diye kendisi görür.

Buna bir sözlük ekleyelim:
- **Establishing shot (tanıtım çekimi):** Bir sahnenin başında kameranın tüm mekânı gösterdiği geniş plan. Bizde, gemi açılınca tüm geminin hasarını tek bir dönüşte göstermek.
- **Beat (an):** Tek kavram taşıyan kısa sahne birimi.

## 4. İlkeler (Faz 5'in kuralları)

- **İ1 — İhtiyaç önce dünyada doğar.** Her onarım, dünya ihtiyacı gösterdikten sonra önerilir:
  - Karanlık görünür, sonra Teleskop gelir.
  - Tanınmayan bir sinyal görünür, sonra Anten gelir.
  - Korunan bir ganimet görünür, sonra gemi gelir.
- **İ2 — Her onarım 3B gemide bir sahnedir.**
  1. Sheet kenara çekilir ve kamera o sistemin yerine gider (2 sn).
  2. Onarım sürerken orada kaynak kıvılcımı görünür.
  3. Onarım bitince o bölümün yangını söner, ışıkları sırayla yanar; ses ve titreşim birlikte gelir.
  4. Tek satır anlamını söyler: "Rafineri çalışıyor: alaşım iki kat hızlı."

  Resim birden değişmez; değişim bölüm bölüm olur.
- **İ3 — Yönetmen çekimi kısadır.**
  - Her çekim en fazla 3 sn sürer, letterbox gösterir ve dokunuş onu sonuna atlatır.
  - Owner'ın 10 saniye kuralı (2026-11-07) korunur: hiçbir çekim 10 saniyeye yaklaşmaz.
  - İlk 10 dakikada toplam yönetilen süre yaklaşık 25 sn'yi geçmez.
  - Her çekim yalnızca ilk seferde oynar.
  - Oyun hareketi işletim sisteminin hareket tercihinden bağımsızdır (`CLAUDE.md` §4.5).
- **İ4 — Satır sırası neden, ne, sonuç.**
  - En fazla 12 kelimedir.
  - "Düğmesine dokun" yazılmaz; işaret zaten yeri gösterir.
  - Satır hikâye diliyle konuşur: "Kör uçuyoruz", "Biri bizi izliyor".
- **İ5 — Gemi raporu hedef merdivenidir.**
  - 5 sistemin durumu sözle söylenir: "Motor yanıyor", "Anten kopuk".
  - Bu durum hem 3B gemide hem sheet'te görünür.
  - Yüzde, ayrıntıya iner.
  - Uzun vadeli hedef ilk dakikada söylenir: "Motoru yakarsak buradan gideriz."
- **İ6 — Kilit her zaman nedenini söyler ve oraya götürür.**
  - Örnek: "300 kristal eksik: Kazıcı dönünce yeter."
  - Örnek: "Önce Anten · Göster".
- **İ7 — Bir anda tek ödül anı.** İlk 10 dakikada hiçbir şey karşılıksız ödül vermez; kasa, bir sonraki onarımın köprüsü olduğu yerde açılır.

## 5. Yeni ilk oturum (an sırası)

| # | An | Kamera ve sahne | Satır (örnek) | Oyuncunun eylemi | Dünyada değişen | Öğrenilen |
|---|---|---|---|---|---|---|
| A0 | Açılış | Siyah ekran yerine yükleme sahnesi | — | — | — | — |
| A1 | Güç | (Var) Kol, rafineri alevi | (var) | Kolu indirmek | Ocak alevlenir | Üretim |
| A2 | **Gemi raporu** (yeni) | 3 sn'de geminin etrafında yarım tur; yanan her bölüm sırayla parlar ve etiketlenir | "Gemi ayakta ama yarı ölü. Motoru yakarsak buradan gideriz." | Dokun: geç | Hedef belirir | Uzun hedef (sıçrama) |
| A3 | Rafineri onarımı | Kamera rafineri bölümüne gider; 5 sn kaynak; yangın söner, ocak yanar | "Rafineri çalışıyor: alaşım daha hızlı." | ONAR | Bölüm ışığı yanar | Onarım = gemi değişir |
| A4 | Kristal Ocağı | Aynı kalıp, kristal | "Kristal, hassas parçaları onarır." | ONAR | Bölüm yanar | İkinci kaynak |
| A5 | **Karanlık** (yeni) | Kamera geri çekilir: geminin çevresi simsiyah, sensörler ölü | "Kör uçuyoruz. Teleskop olmadan hiçbir şey göremeyiz." | ONAR (Teleskop) | — | İhtiyaç |
| A6 | Teleskop açılır | (Var) Görüş açılır; kamera alana döner | "Etrafımız dolu." | — | Alan görünür | Görüş |
| A7 | **Asteroide yaklaşma** (yeni) | Kamera en yakın kayaya 2,5 sn'de süzülür; kaya parlar, "Kristal" etiketi | "Bu kayada maden var. Kazıcı getirir." | Kayaya dokun → Kazıcı | (Var) Kazıcı takibi | Madencilik |
| A8 | **Sinyal** (yeni) | Radar açılınca kamera temasa 2 sn döner; "?" yaklaşır | "Bir şey yaklaşıyor. Ne olduğunu göremiyoruz." | ONAR (Anten) | — | Radar ↔ istihbarat ihtiyacı |
| A9 | Sonda | Sonda kalkar (var), rapor gelince kamera temasa döner | "İki Ok, iki Kurye. Bize gelmiyor; ambarı dolu." | Sonda gönder → raporu oku | Temas tanınır | İstihbarat |
| A10 | **Tersane ihtiyacı** | Kamera boş tersane bölümüne gider | "Gemisiz bu ganimeti alamayız." Eksik varsa: "300 kristal eksik: Kazıcı dönünce yeter." | ONAR (Tersane) | Tersane ışığı yanar | Filo |
| A11 | İlk gemi | Kamera tersane kapısına gider; Ok dışarı süzülür | "İlk gemin." | Üret | Gemi görünür | Gemi üretimi |
| A12 | İlk av | (Var) Karakol avı | (var) | Saldır | Rapor | Savaş döngüsü |
| A13 | Gemi raporu II | A2'nin tekrarı: neler düzeldi, neler kaldı | "Motor hâlâ yanıyor. Sıradaki onarımlar onu uyandırır." | — | — | Sonraki hedef |

Her yeni an, oyuncunun neyi neden yaptığını önceden bilmesini sağlıyor. Raporun 1. sorusunun ("Bu oyun ne hakkında? Ben bu oyunda neyim, amacım ne?") cevabı A2'de veriliyor.

## 6. Faz 4 düzeltmeleri

- 7 Gün kutusu starter galaksisinde görünmez; inişten sonra başlar (**S6**).
- İniş kartı, ödül anı ve ipucu tek bir sahnede birleşir. Arka arkaya üç pencere açılmaz.
- Ödül panelindeki "Git", kamerayı birden zıplatmaz; yönetmenin 2 sn'lik uçuşunu kullanır.

## 7. Sanat yolu (akıl hocası: önce en iyisi)

Bölüm bölüm onarım görünümü için modelin bölümlerinin ayrı ayrı "yanabilmesi" gerekiyor.

1. **En kaliteli yol: sanatçıya bölmek.**
   - Bir hard-surface 3B sanatçısı (ArtStation ya da Fiverr) her gövdeyi 5 sistem parçasına ayırır.
   - Her parçanın hasarlı ve onarılmış malzemesi, ayrıca ışık (emissive) haritası olur.
   - Kabaca gövde başına 400–1.200 $ tutar; 3 gövde gerekir. Bu tahmindir; kesin fiyat teklifle çıkar.
   - Süre birkaç haftadır.
2. **Bizim yolumuz: shader hilesi, yeni sanat gerekmez.**
   - Her sistemin 3B yeri zaten tanımlı (`VESSEL_BAYS`).
   - Shader, her pikselin o noktalara uzaklığından bölge çıkarır. Onarılmamış bölge koyu, soluk ve titrek görünür; onarılan bölgede ışık süpürmesi olur.
   - 3 model arasındaki geçiş, birden değişmek yerine eriyerek (dissolve) olur.
   - Maliyeti tek bir 5'li uniform dizisi. Owner'ın "ışık yerine ucuz hile" kuralına uyar.

**Önerim:** 2 ile başlayalım ve S22'de bakalım. Yetmezse 1'e geçeriz. 2'nin kodu 1'de de kullanılır.

## 8. Owner'a sorular

- **S1.** İ1–İ7 ilkeleri ve §5 an sırası bu yönde mi? Çıkarmak ya da eklemek istediğin an var mı?
- **S2.** Kilit ölçüsü uygun mu? Her çekim en fazla 3 sn sürer, dokunuş onu atlatır, ilk 10 dakikada toplam yaklaşık 25 sn. Bu, 2026-11-07 tarihli 10 sn kuralının içinde kalıyor.
- **S3.** Sanat yolu: §7-2 (shader, hemen) mi, §7-1 (sanatçı) mı?
- **S4.** Deploy:
  - Faz 1–4, Faz 5 bitene kadar bekleyecek mi?
  - **Önerim beklemesi.** Yeni oyuncunun ilk 10 dakikası tam da bu iş. Faz 4'ün ek ödül anlarını eski akışla yayınlamak hissi kötüleştirir.
- **S5.** Onarım sırası ve süreleri değişmiyor. Bu plan ilerleme kuralına dokunmaz; yalnızca sunumu değiştirir. Doğru mu anladım, bu sınırda kalalım mı?
- **S6.** 7 Gün kutusu inişten sonra başlasın mı? Bu, 2026-11-06 planındaki "Yeni Komutan 7 Günü"nün başlangıç anını değiştirir.

### Owner'ın cevabı (2026-11-18)

> "Başlayabilirsin, sana tüm akış, tüm yapı konularında izin veriyorum. İstersen gerekli anlarda internet üzerinden araştırmalarda yapabilirsin. Bu onboarding akışını elinden gelen en iyi şekilde yap. Sana güveniyorum ve tamamen sana bırakıyorum."

Bu yetkiyle verdiğim kararlar:

- **S1:** İ1–İ7 ve §5 uygulanır.
- **S2:** Her çekim en fazla 3 sn sürer, dokunuş onu atlatır, her çekim yalnızca ilk sefer oynar.
- **S3:** Shader ve yönetmenlik yolu seçildi; sanatçı gerekmez. Kod okuması bunu doğruladı. 3B gemide zaten şunlar var:
  - sistem başına ışık (`OwnVessel` bay sprite'ları),
  - yangın, köz ve kıvılcım (`VesselBurn`),
  - "uyanış" nabzı (`AwakenPulse`).

  Eksik olan şey, oyuncunun gemiyi o anda görmesi.
- **S4:** Faz 1–4, Faz 5 bitene kadar bekler. **Deploy yine owner kontrol etmeden yapılmaz.**
- **S5:** İlerleme kuralları (sıra ve süreler) değişmez.
- **S6:** 7 Gün kutusu inişten sonra başlar.

### Owner'ın oyununda bulunan hatalar (2026-11-18), düzeltildi

1. **Karakol bayrağı dokunuşu almıyordu.** Ekrandaki karakol bayrağı `pointer-events: none` idi. El bayrağı gösteriyordu ama dokunuş boşluğa düşüyordu. Bayrak artık dokunuşu alıyor.
2. **İstihbarat sekmesi tanıtımından önce açılıyordu.** Sekme Anten onarımıyla açılıyordu, tanıtım ise ilk raporda geliyordu.
   - Sekme artık ilk sonda ya da savaş raporuyla açılıyor (`TabLock {kind:'report'}`).
   - Sonda göndermek Anten'le açık kalıyor.
3. **Rehber kartı raporu kapatıyordu.** "Rehber kartına yer bırak" kuralı kit öncesi bir sınıfı (`.overflow-y-auto`) hedefliyordu ve boşa düşmüştü. Kural artık `.gk-focus__file`'ı hedefliyor.
4. **Saldırı planında gemiler aşağıda kalıyordu.**
   - Saldırı planı açılınca "sondanın raporu" satırı okunmuş sayılıyor (`launchSheet.ts`).
   - Tempo notu gemilerin altına taşındı.
5. **İnişte pencereler üst üste biniyordu.**
   - İniş ödülü penceresi katmansızdı ve olay kartının altında kalıyordu. Artık `fixed inset-0 z-50`.
   - İlk hafta notu sabit 96 px'teydi ve üst bandın notunun üstüne biniyordu. Artık `--v2-top-h` altında duruyor.

### İlerleme (Faz 5)

| # | Durum | Not |
|---|---|---|
| Hatalar 1–5 | yapıldı | Yukarıda |
| 5.1–5.5 | yapıldı | `da2e7b82`: yönetmen, gemi raporu, onarım sahneleri, gövde geçişi, karanlık, teleskop alanı ve kayaya yaklaşma |
| Efektler | yapıldı | Owner 2026-11-18: yumuşak yuvarlak parlama yasak. `b4c5b15e`, `35a6f4b7`, `0b49e353`: her efekt kendi olayı, kütüphaneden, briefli; `softGlow()` silindi; koruma testi `no-glow-sprite.test.ts`. Owner kalan 5 halka/korona kullanımını uygun buldu. |
| 5.8 7 Gün | yapıldı | S6: sunucu kutuyu yalnız inişten sonra verir. Yedi kutu tek panoda (Synty kasaları, gövde ve kapak ayrı render), hazır kutu basılı tutularak yerinde açılır. Pano iniş ödül anının içinde (ayrı pencere yok) ve Ödüller panelinde: hazırsa en üstte. Galeri: `?view=rewards-ready&welcome=first\|ready\|wait\|last`, `?view=landing-rewards(-box)&welcome=first`. |
| 5.3 A13, İ5, 5.6 A9–A11 | yapıldı | Gemi raporunda 5 sistem 3B gövdede sözle etiketlenir (yanıyor/tütüyor/kopuk/kıvılcım atıyor/çalışıyor), hull'un gösterdiğiyle aynı. A13: ilk savaş raporundan sonra ikinci rapor; motor satırı sıçrama penceresine göre. A9: sonda raporu gelince kamera sondalanan gemiye döner. A10: sonda yoldayken ve Tersane sıradayken boş kargo bölmesi. A11: Tersane dönünce ilk iki Ok kargo bölmesinden süzülüp yanında durur, sonra uzaklaşır. Sahne sırasında odak kartı, karakol işaretleri, göç şeridi ve alt şerit gizlenir. |
| 5.4 | yapıldı | Rehber ve yönetmen satırları 6 dilde yeniden yazıldı: en fazla 12 kelime, neden → ne → sonuç, hiçbir dilde düğme adı ya da "dokun" yok (işaret yeri gösterir). Koruma: `starter-guide-copy.test.ts` (uzunluk, düğme adı, her dilde aynı değişkenler). |
| 5.7 | yapıldı | Kilitli kart "Önce X" der; yanındaki "Göster" o onarımın kartını açar (başka sistemdeyse o sisteme geçer). Soluk ONAR'ın altındaki satır önce neyin ne kadar eksik olduğunu söyler ("54 alaşım eksik · yaklaşık 18 dk içinde birikir"), düğmenin erişilebilir açıklaması da odur. Kazıcı dönüşüne bağlı tahmin eklenmedi: gemi ekranı uçuş verisini bilmiyor. |
| 5.9 | ölçüldü, değişiklik gerekmedi | Prod build (`vite build` + `vite preview`, 350×760, masaüstü GPU, ısınmış önbellek): yeniden yüklemede siyah kare yok. 0–3,6 sn markalı yükleme ekranı (yörünge logosu, "Galaksi bilgileri yükleniyor" → "Oyun görünümü hazırlanıyor"), 3,8 sn'de gemi ve galaksi. Not: ilk ~0,3 sn'lik satır sayfanın URL diliyle gelir ("/" İngilizce), Türk oyuncuya "Preparing the game" görünür; herkese açık sayfa işi, kapsam dışı. S22'de ölçülmedi. |
| İ7 | değerlendirildi | Tek ödül anı 5.8'deki birleşik iniş anıyla sağlandı. Kasa kuralları ilerleme kuralı olduğu için (S5) değiştirilmedi. |
| 5.10 | sürüyor | |

## 9. Başarı ölçütü

- §1'deki iki izole test aynı yönergelerle yeniden koşulur. Hedefler:
  - ONAY payı %50'nin altında olmalı, KAYIP en fazla 2.
  - İki oyuncu da raporun 1. sorusunda gemiyi, hedefi (sıçrama) ve şu an neyi neden tamir ettiğini söyleyebilmeli.
  - Hiçbiri ilk avdan önce "kapatırdım" dememeli.
- Owner'ın kendi oyunu: "tamam, bu olmuş" hissi.
- Her an için birim testleri yazılır. S22'de 50–60 fps kaba bakış yapılır; nadir çalan efekt kuralı geçerli.

## 10. Adımlar (onaydan sonra; her biri TDD)

| # | İş | Doğrulama |
|---|---|---|
| 5.1 | Yönetmen: an kuyruğu, kısa kilit, letterbox, dokununca atlama, "yalnızca ilk sefer" kaydı | Birim testi + 350 px ekran görüntüsü |
| 5.2 | 3B gemide bölge shader'ı ve eriyerek geçiş; onarım anı (sheet kenara, kamera bölüme, kıvılcım, sönme, ışık) | Test + S22 kaba bakış |
| 5.3 | Gemi raporu A2 ve A13; sözlü sistem durumları | Test |
| 5.4 | Rehber satırlarının yeniden yazımı: neden, ne, sonuç; 6 dil, `ux-writing.md` | Kopya testleri |
| 5.5 | Karanlık A5, kayaya yaklaşma A7 | Test + oyun |
| 5.6 | Sinyal A8 → Anten ihtiyacı; rapor sonrası A9 | Test + oyun |
| 5.7 | Kilit nedeni ve "Göster" (İ6) | Test |
| 5.8 | Ödül yığınını açmak: 7 Gün inişten sonra, iniş sahnesi birleşik | Test |
| 5.9 | Açılış yükleme sahnesi (prod build'de ölçüldükten sonra) | Ölçüm |
| 5.10 | Tam kapı, 350 px oyun, iki izole test, owner'ın kontrolü | §9 |
