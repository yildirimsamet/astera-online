# Savaş simülatörü — son kullanıcı incelemesi

Bu belge ilk incelemenin bulgularını korur. Sonraki uygulama ve kapanış durumu:
[inceleme düzeltmeleri](battle-simulator-fixes-2026-10-25.md).

25 Ekim 2026. **Mevcut ekranı premium son kullanıcı sürümü olarak henüz hazır bulmuyorum.**
Savaş kaydıyla can/kalkan eşliği, ayrı gemi kimlikleri ve tur içi sıralı gösterim
çalışıyor. İnceleme; yanlış sonuç anlatımı, birbiriyle kopan ekran durumları,
mobil okunabilirlik ve gemiye ulaşma sorunları ortaya çıkardı.

**26 UI/UX bulgusu: 7 P1, 17 P2, 2 P3.** Ayrıca daha önce bildirilen ayrı
Söndürücü/Aegis motor sapması açık. P1 yanlış olay/sonuç gösteren veya temel
işlevi bozan; P2 anlaşılabilirlik ve kullanım sorunu; P3 ikincil iyileştirmedir.

## İncelenen sürüm ve yöntem

- Dal/worktree: `feature/battle-simulator-20261024`, `fc7c/blindspace`.
- Üretim ayarlarıyla derlenen yerel sürüm; inceleme adresi
  `http://localhost:5186/?simulator=1`. Yeni on hedef/sınıf önceliği dahil.
- Türkçe; 1600×1000 masaüstü, 350×812 dokunmatik Chrome emülasyonu ve
  812×350 yatay görünüm. Fiziksel telefon performansı ölçülmedi.
- Fareyle döndürme, kaydırma, yakınlaştırma; iki parmak hareketi; atış seçme,
  hedef seçme, zaman çizgisi, gerçek klavye End tuşu; düzenleme ve yeniden hesaplama.
- Varsayılan Aegis/Söndürücü/yer topları; karşılıklı imha; 18 Ok'a karşı 18 Ok;
  altı turlu Kalkan IV Kale aynası; EMP ile devre dışı savunma.
- Hesaplama Worker'ının yüklenmesini bir defa engelleyip yeniden deneme;
  kontrollü WebGL bağlam kaybı/geri gelişi; görünürlük olayıyla duraklatma;
  editör açıkken ekran genişliğini değiştirme.
- Görsellerin yanında gerçek kayıt ve oynatım durumları karşılaştırıldı.
  İlk kapsamlı tarayıcı akışında uygulama sayfa hatası ve oyuncu API isteği yoktu.
  Kontrollü hata deneyleri ayrı kaydedildi.
- Arayüz kontrolünde proje yazım/tasarım kuralları ve
  [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)
  kullanıldı. Projenin hareket tercihi gibi açık owner kararları korunarak incelendi.

Bu incelemenin bulguları raporlandı; aşağıdaki sorunlara inceleme sırasında
ürün düzeltmesi uygulanmadı. İnceleme öncesindeki kamera kadrajı düzeltmesi
incelenen derlemede bulunuyor.

## P1 — önce düzeltilmesi gerekenler

### F01 · Sahne ile atış ayrıntısı farklı anları gösteriyor

**Tekrar:** İlk atışı seç, ardından «Sonraki atış»a bas.
Sahnede `Korsan #A9 ateş ediyor` yazarken ayrıntıda `Söndürücü #A6` kalıyor.
Seçili geminin canı yeni ana geçiyor; atış tablosu eski atışta kalıyor.
Zaman çizgisi ve başa sarma da seçilmiş atışı temizlemiyor.

Oyuncu eski hasarı yeni geminin atışı sanabilir. Manuel sabitleme modu da
belirtilmediğinden bu iki farklı durumun fark edilmesi zor.

**Öneri:** Zaman değiştiğinde ayrıntıyı geçerli atışla eşleştir. Eski atışa bakmak
isteniyorsa açık bir «Sabitlenmiş atış» durumu ve «Canlı oynatıma dön» eylemi kullan.

Kaynak: `apps/web/src/battle-simulator/BattleReplay.tsx:28`, `:34`, `:58`, `:62`.
[Görsel](evidence/battle-simulator-review-2026-10-25/desktop-next-shot-after-selection.png).

### F02 · Zaman çizgisinin sonu, bitmiş savaş durumuna ulaşmıyor

**Tekrar:** Tohum 0; iki tarafta birer Ok; Aegis 0. Çizgiyi en sağa sürükle
veya gerçek klavyede End'e bas. Gemiler yok olmuşken «Tur sonu geri çekilmeler»
kalıyor; sonuç mesajı açılmıyor.

Bu örneğin süre sınırı `35.34999999999999`; native slider `35.34`e oturabiliyor.
18 Ok aynasında End tuşuyla `360.23`te aynı durum tekrarlandı. Son konum kullanıcıya
tam bitiş gibi görünüyor. Oynat düğmesiyle kalan son parçayı geçmek sonucu açıyor.

**Öneri:** Çizginin son konumunu kesin bitişe oturt. Bitiş durumunu sürükleme,
End, ileri atlama ve normal oynatma için aynı sözleşmeyle doğrula.

Kaynak: `BattleReplay.tsx:58`, `:107`; `timeline.ts:54`, `:91`.
[Gerçek End tuşu sonucu](evidence/battle-simulator-review-2026-10-25/retreat-keyboard-end.png).

### F03 · Karşılıklı imhada başarı mesajı

**Tekrar:** Aynı birer Ok örneğini gerçekten sonuna kadar oynat. İki tarafta da
can 0 ve durum `DESTROYED`; sonuç «Saldırın başarılı oldu».

Savaş derecesi savunmanın temizlenmesini anlatıyor. Simülatör bunu kendi filonun
akıbetinden ayırmıyor. Oyunun ortak `battleOutcome` yardımcısı, sağ kalan yoksa
kişisel sonucu kayıp olarak değerlendirebiliyor; simülatörün sonuç satırı bunu kullanmıyor.

**Öneri:** «İki filo da imha oldu»yu açıkça göster. Savunmanın temizlenmesi,
sağ kalanlar, kaçanlar ve varsa kontrol sonucu ayrı gerçekler olarak sunulsun.

Kaynak: `BattleReplay.tsx:124`; `apps/web/src/lib/battleOutcome.ts:16`.
[Görsel](evidence/battle-simulator-review-2026-10-25/desktop-mutual-wipe-finished.png).

### F04 · Kamera dönerken taraf etiketleri yanlış mekânsal bilgi veriyor

**Tekrar:** Sahneyi yaklaşık yarım tur döndür. Saldıran gemilerin ortalama ekran
Y konumu 652'den 341'e; savunanlarınki 382'den 558'e geçti. Üst etiket hâlâ
«Savunan», alt etiket «Saldıran».

Aynı gemileri kullanan iki taraf, gövde rengi ve birim işaretleriyle yeterince
ayrılmıyor. Serbest dolaşırken alttaki gemilerin kendi tarafın olduğu varsayımı bozuluyor.

**Öneri:** Gemilerde kalıcı taraf işareti; seçili kartta taraf ve filo adı;
kamera yönünü anlatan küçük gösterge. Ekran kenarı etiketleri dünya konumuyla
ilişkisini kaybetmemeli. Kamera özgürlüğü bu bilginin doğruluğunu bozmamalı.

Kaynak: `BattleReplay.tsx:85`, `:99`; `BattleStage.tsx:155`, `:291`.
[Görsel](evidence/battle-simulator-review-2026-10-25/desktop-rotated-teams.png).

### F05 · GPU kaybından sonra aynı savaşın 3B görünümü geri gelmiyor

Kontrollü `WEBGL_lose_context` deneyi oynatımı durdurdu. Ekran «3B görünüm
yüklenemedi. Atış dökümünü inceleyebilirsin» durumuna geçti. Bağlam geri
verildiğinde aynı sahne geri açılmadı. Yeni savaş simüle etmek sahneyi yeniden oluşturdu.

**Öneri:** Geçici GPU kaybı, kalıcı sahne hatası ve iyileşme ayrı durumlar olmalı.
Mevcut kayıt/zaman korunarak «3B görünümü yeniden aç» sağlanmalı. Tek çözüm
savaşı yeniden hesaplamak olmamalı.

Kaynak: `BattleStage.tsx:27` — hata sınırının `failed` durumu aynı sahnede sıfırlanmıyor.
[Görsel](evidence/battle-simulator-review-2026-10-25/gpu-lost.png).

### F06 · Gerçek hasar rozette «−0» oluyor

Varsayılan savaşta `43.38` anında `A6` için gerçek gövde hasarı
`0.0247672724`; görünen rozet «−0». Pozitif küçük kalkan hasarında da aynı
yuvarlama yolu var. Oyuncu atışın işlemediğini düşünebilir.

**Öneri:** Pozitif hasarı sıfır gibi yazma. Küçük değerler için yeterli basamak
veya «<0,1» gösterimi; ayrıntıda daha hassas değer kullan.

Kaynak: `BattleStage.tsx:232`.
[Görsel](evidence/battle-simulator-review-2026-10-25/desktop-tiny-damage.png).

### F07 · Mobil atış dökümü sahneyi ve kontrolleri kapatıyor

350 px ekranda panel neredeyse bütün genişliği kaplıyor. Hedefe tıklamak seçili
gemi kartını arkada açıyor; kullanıcı etkisini göremiyor. Ayrıntının sonuna
kaydırınca kapatma düğmesi yukarıda kalıyor. Escape paneli kapatmıyor. Alttaki
oynatım kontrolleri de panelin altında.

**Öneri:** Sabit başlık/kapatma, geri hareketi ve kontrollü odak yönetimi.
«Hedefe bak» paneli kapatıp ilgili gemiyi görünür şekilde odaklamalı.
Sahneyle karşılaştırılabilecek bir alt panel yerleşimi tercih edilmeli.

Kaynak: `simulator.css:179`; `BattleReplay.tsx:129`, `:140`.
[Görsel](evidence/battle-simulator-review-2026-10-25/mobile-log-scrolled-escape.png).

## P2 — anlaşılabilirlik, durum ve gezinme

| ID | Doğrulanan bulgu | Oyuncu etkisi / öneri | Kaynak / kanıt |
|---|---|---|---|
| F08 | Editör açıkken masaüstünden 350 px'e geçince oynatım arka planda devam ediyor. | Mobil editör kontrolleri kapatırken zaman ilerliyor. Ekran boyutu, editör açıklığı ve duraklatma aynı reaktif durumdan türetilmeli. | `BattleSimulator.tsx:91`; [görsel](evidence/battle-simulator-review-2026-10-25/resize-open-editor.png). |
| F09 | Altıncı tur sonunda da «Tur sonu geri çekilmeler» safhası var. | Gerçekte altıncı turda kaçış kontrolü yok. Son tur tamamlanması ile kaçış safhası ayrılmalı; kaçış olmadığında da sonuç açık olmalı. | `timeline.ts:47`, `:91`; [görsel](evidence/battle-simulator-review-2026-10-25/sixth-round-retreat-label.png). |
| F10 | Kaçan gemi etiketsizleşip siliniyor; seçili kartında kaçış durumu yazmıyor. | Hangi geminin hayatta kaçtığı kalıcı olarak izlenemiyor. Ayrı kaçanlar alanı ve tur/kimlik/can listesi gerekiyor. | `BattleStage.tsx:217`, `:281`; aşağıdaki ayrıntılı kaçış incelemesi. |
| F11 | Gemiye odaklan, yakınlaştır/uzaklaştır ve kamerayı toparla eylemleri yok. | Fare tekerleği ve iki parmak hareketi çalışıyor; seçilen gemiye kolay ulaşma ve kaybolunca dönme zayıf. Mobilde hareket yardımı da gizleniyor. Seçili kartta «Odaklan», sahnede «Genel görünüm» ve erişilebilir yakınlaştırma kontrolleri eklenmeli. | `BattleStage.tsx:143`; `simulator.css:211`; `BattleReplay.tsx:140`. |
| F12 | Mobil can yazıları 7 px; birçok gemi çok küçük, gezegen/Aegis baskın. | Yakınlaştırma 3B gemiyi büyütse de HTML yazısı aynı fontta kalıyor. Türü tanımak ve dokunarak seçmek zor. Mobil kadraj/oluşum, asgari okunabilir yazı ve seçili/hedeflenen birime odaklanan görünüm tasarlanmalı. | `simulator.css:169`; [görsel](evidence/battle-simulator-review-2026-10-25/mobile-aegis.png). |
| F13 | Sınıf, güçlü/zayıf eşleşme ve tur çarpanı anlatılmıyor. | Hedef tablosunda yalnız ×1.6/×0.625 var. Editörde ve seçili kartta sınıf yok. «Saldırı 305» ile atıştaki «Saldırı 311,64» aynı adla farklı değerler. Temel saldırı, tur değişkenliği, karşı sınıf ve emilen hasar ayrı açıklanmalı. | `SideEditor.tsx:21`; `BattleReplay.tsx:100`, `:136`, `:140`. |
| F14 | Yer topunun saldırısı «Yer savunmaları 144» diye gösteriliyor. | Birim sayısıyla karışabilir. «Saldırı 144» yazılmalı; «Gemi kalkanı 0/0» yerine kişisel kalkanı olmadığı ve Aegis koruması anlatılmalı. | `BattleReplay.tsx:103`; [görsel](evidence/battle-simulator-review-2026-10-25/desktop-ground-selected.png). |
| F15 | Aegis'in kırılması ve Söndürücü katkısı ana sahnede yeterince ayrışmıyor. | Sayaç ve çarpışma var; «Aegis kırıldı», normal emiş ve özel bonusun anlamı belirgin değil. «Yalnız kalkana ek hasar» ifadesi kişisel kalkan sanılabilir. Açıkça Aegis adı kullanılmalı; özel katkı vuruş anında kısa bir açıklamayla gösterilmeli. Büyük küre yerine temas sınırı daha güçlü okunmalı. | `BattleReplay.tsx:93`, `:142`; [görsel](evidence/battle-simulator-review-2026-10-25/mobile-aegis.png). |
| F16 | Aegis seviyesi 0 iken EMP/savunma kapalı bilgisi sahnede görünmüyor. | Toplar savaşa katılmayınca yok sayılmış gibi algılanabilir. Devre dışı savunma bilgisi Aegis kapasitesine bağlı olmamalı; katılmayan birlikler açıklanmalı. | `BattleReplay.tsx:93`, `:97`; [görsel](evidence/battle-simulator-review-2026-10-25/desktop-emp-without-aegis.png). |
| F17 | Henüz ateş edilmeden turun bütün atış sonuçları listeleniyor. | «Filolar hazır» durumunda bile hasarlar görülüyor; geçmiş/gelecek atış ayrımı yok. Tam tur planı ile gerçekleşen atışlar görünür biçimde ayrılmalı. | `BattleReplay.tsx:79`, `:132`; başlangıç gözlemi JSON'da. |
| F18 | Sıralı görüntünün eşzamanlı hesaplamayı temsil ettiği açık anlatılmıyor. | «Saldıran ateş ediyor → savunan ateş ediyor» ilk vuruş avantajı sanılabilir. Sıfır canla karşılık veren gemi de bug gibi algılanabilir. «Bu tur ateş edecek» yardımcı; bir defalık kısa eşzamanlılık açıklaması ve belirgin bekleyen-atış işareti gerekiyor. | `BattleReplay.tsx:88`; `timeline.ts:89`. |
| F19 | Müttefik geminin hangi filoya/araştırmaya ait olduğu görünmüyor. | Birden çok filo ve farklı araştırma seçilebiliyor; sahnede/kartta yalnız gövde adı ve A/D kimliği var. Aynı tip gemilerin farklı can/kalkanını açıklamak zor. Kartta taraf ve Filo 1/2 bilgisi olmalı. | `BattleReplay.tsx:100`; kayıt `playerId/stackId` taşıyor. |
| F20 | Yük gemisi ve Hurdacı'nın rolü öğretilmiyor. | Korunmaları doğru; kartta saldırı 0 dışında rol bilgisi yok. Enkaz toplama/ganimet dönüşü bu ekranın `resolveBattle` sonucunda hesaplanmıyor. Hurdacı işlevsiz sanılabilir. Savaş sonrası rol özeti veya bu kapsamın açık açıklaması gerekli. | `scenario.ts:90`; `BattleReplay.tsx:100`, `:127`; gerçek toplama `salvage.ts:61` ve sunucu settlement yolunda. |
| F21 | Başlangıç canı geçersizken hata yanlış alanlara yönlendiriyor. | Canı 0 yapınca «Adetleri ve araştırma seviyelerini kontrol et» çıkıyor. Alan işaretlenmiyor, yanlış can alanına gidilmiyor. Alan bazlı hata ve 1–100 aralığı gösterilmeli. Boş yazabilme/blur davranışı korunmalı. | `BattleSimulator.tsx:29`, `:73`; [görsel](evidence/battle-simulator-review-2026-10-25/invalid-health.png). |
| F22 | Elle düzenlenmiş savaş hâlâ seçili örneğin adıyla görünüyor. | Birer Ok aynasında başlık «Karma filolar» kalabiliyor. Açılır liste kontrolsüz `defaultValue` kullanıyor. «Özel senaryo» durumu ve belirgin örneğe dön eylemi gerekiyor. | `BattleSimulator.tsx:69`. |
| F23 | Hazır örnekler 1200 px altında gizleniyor. | Mobil oyuncu Söndürücü/yer topu/kargo örneklerine kolay ulaşamıyor; aynı sahneyi elle kurması gerekiyor. Örnekler mobil ayar paneline taşınmalı. | `simulator.css:183`. |
| F24 | İlk hesaplama hatasında sahne hâlâ «hazırlanıyor» diyor. | Hata ve yükleniyor aynı anda gösteriliyor. Yeniden deneme başarılı; hata görünümü ise ayrı, tutarlı bir durum olmalı. | `BattleSimulator.tsx:91`; [görsel](evidence/battle-simulator-review-2026-10-25/worker-failure.png). |

## P3 — ikinci aşama

**F25 · Yatay telefon yerleşimi:** 812×350 görünümünde sahne yüksekliği 34 px'e
kadar indi. Dikey ekran ana hedef olduğu için ilk düzeltme grubunun dışında;
yatay kullanım desteklenecekse kontroller ve editör ayrı yerleşim istemektedir.
[Görsel](evidence/battle-simulator-review-2026-10-25/landscape-812x350.png).

**F26 · Çok gemili savaşın temposu:** 18 Ok'a karşı 18 Ok, bu kayıtla yaklaşık
360 saniye oynatım sürüyor. 16× hızda 1,2 saniyelik hasar rozeti gerçek zamanda
yaklaşık 75 ms kalır. Atış atlama ve tur seçimi var; aşama içi «12/18 atış»
ilerlemesi, isteğe bağlı detaylı atış inceleme ve hızlı tur izleme akışı daha
iyi yönlendirmeli. Gösterim süresinin gerçek savaş süresi olmadığı da belirtilmeli.

## Kaçan gemiler — ayrıntılı değerlendirme

Tohum 0, iki tarafta 18 Ok, Aegis 0. İlk kaçış dördüncü turda `308.75`
gösterim anında. `Ok #A13` için:

| An | Motor/oynatım durumu | Can | Görsel |
|---|---|---|---|
| Önce, 308.65 | ACTIVE | 19,6565 / 77 | İsim/can etiketi görünür. |
| Sırasında, 309.35 | RETREATED | Aynı | Etiketin opacity değeri hemen 0; gövde geriye kayıp küçülüyor. |
| Sonra, 310.15 | RETREATED | Aynı | Gemi sahneden silinmiş; seçili kart hâlâ saldırı/can bilgisi veriyor, kaçış durumu yazmıyor. |
| Geri sarınca | ACTIVE | İlk değerle aynı | Oynatım durumu geri yükleniyor. |

Saldıranın aktif sayısı 16→15, kaçanı 0→1; savunanın kaçanı 0→2.
İmha sayıları kaçış yüzünden artmıyor. A13'ün sonraki atış ve hedef olma sayısı
**0**. Gerçek sayım ve savaş dışına çıkarma doğru. Bu doğru davranışın oyuncuya
aktarımı eksik.

[Önce](evidence/battle-simulator-review-2026-10-25/retreat-before.png) ·
[Sırasında](evidence/battle-simulator-review-2026-10-25/retreat-during.png) ·
[Sonra](evidence/battle-simulator-review-2026-10-25/retreat-after.png).

Önerilen **Kaçanlar alanı**:

1. Tur sonunda «Saldırandan 1, savunandan 2 gemi geri çekiliyor» duyurusu.
   Her ilgili gemide okunabilir kaçış işareti, adı ve kalan can.
2. Gemi kaçış yönüne döner; kesintisiz bir yol boyunca kendi tarafının kaçış
   alanına gider. Mevcut geriye kayma/küçülme, patlayarak ölmekten daha net ayrılır.
3. Varınca tamamen kaybolmak yerine «Savaş dışı · hayatta» kartı/temsilcisi kalır.
   Kendi/rakip ve müttefik filolar birbirinden ayrılır. Büyük sayıda tür bazlı
   özet açılıp tek gemiye kadar incelenebilir.
4. Alan; kaçış turu, tür, adet ve kalan canı korur. Tıklayınca «Tur 4'e dön»
   ve gemiyi takip et eylemleri bulunur. Geri sarınca alan ve sayaçlar da geri alınır.
5. Savaş öncesi otomatik kaçış ile tur sonu kaçışı ayrı etiketlenir. Savaş
   öncesi kaçanlar kayıttaki aktif gemilerden çıkarıldığı için bugünkü «Çekildi»
   sayacıyla alt bilgi farklı kapsamlar anlatıyor; bu fark açık yazılmalı.
6. Son turda kaçış animasyonu/safhası üretilmez. Kaçan gemi tekrar ateş etmez,
   hedef olmaz, imha/enkaz olarak sunulmaz. Görsel alan yeni bir savaş birimi yaratmaz.

Neden kaçtığını anlatırken kalan can ve geçerli kaçış koşulu/olasılığı
gösterilebilir. Mevcut kayıt kaçışın gemi kimliğini taşıyor; çekilen rastgele
sayının kendisi kaydedilmiyor. Kaydedilmemiş bir zar sonucu uydurulmamalı.

## Aegis, yer topları ve özel gemiler için doğruluk durumu

| Konu | Doğru çalışan | Eksik/yanıltıcı sunum |
|---|---|---|
| Aegis | Gezegen ve savunanları kapsayan ortak alan; ışının yüzeye çarpması; normal/bonus emişin kaydı; başlangıç doluluğu. | Büyük alan savaşın önüne geçiyor; kırılma mesajı ve Söndürücü katkısının anlamı zayıf. Önceden bildirilen global bonus önceliği motor sapması ayrıca açık. |
| Yer topları | Gerçek adetler; ayrı can/kimlik; kişisel kalkan olmaması; kaçmaması; savaş sonu kurtarma. Üç sabit muharebe koltuğu kuralı yok. | Saldırı etiketi yanlış; kalkanın olmaması açıklanmıyor; tür/aktif/devre dışı/kurtarılan ayrımı sahnede zayıf. |
| Söndürücü | Öne yerleşiyor; bonus Aegis'e kaydediliyor; kişisel kalkan/cana bonus eklenmiyor. | Rolü ve ek hasarın kapsamı ana görünümde öğretilmiyor. |
| Yük/Hurdacı | Arkada; silahlılar varken korunuyor; ateş etmiyor; seçilen uygun hedeflere geçiş motor kaydıyla aynı. | Rol kartı, savaş sonrası işe yararlılık ve hurda toplama kapsamı yok. |
| Gemi kalkanları | Gerçek ayrı değer; kişisel kalkan tüketilmeden gövde hasarı almama; turlar arasında yenilenmeme; sabit tam bar izi. | Küçük mavi çubuk/rozetin Aegis'ten farkı bir lejantla öğretilmiyor; genel görünümde sayısal kalkan yalnız seçilince okunuyor. |
| Sınıflar | Çarpan ve yeni hedef önceliği motor tarafında uygulanıyor; hedef satırında çarpan var. | Sınıf adı/işareti, güçlü-zayıf eşleşme ve neden o hedeflerin seçildiği görünmüyor. |

**Ayrı motor bulgusu K01:** Söndürücünün eski global Aegis bonus önceliği yeni
motorda aynı değil. Bu incelemede değiştirilmedi. İki kontrollü örnek ve kaynak
[motor karşılaştırma raporunda](combat-engine-comparison-2026-10-25.md).
Bu, sahnenin mevcut motor kaydını doğru oynatmasından ayrı bir sorundur.

## Durum geçişleri — kabul ve sorunlar

| Geçiş | Sonuç |
|---|---|
| İlk yükleme → hazır | Sahne hazır olana kadar başlatma kapısı var; normal akış çalışıyor. |
| Oynat → duraklat → sürdür | Çalışıyor. |
| Görünmezlik olayı → geri dönüş | Deneyde zaman 2,3833'te durdu ve kendiliğinden atlamadı. Görünürlük olayı sentetik olarak tetiklendi. |
| Editörü mobilde normal açma | Duraklatıyor. Açık masaüstü editörüyle mobil genişliğe geçiş ise F08. |
| Atış seç → sonraki/önceki/başa sar | Sahne zamanı değişiyor; seçilmiş eski ayrıntı kalabiliyor: F01. |
| Çizginin sonu / End | Bitiş açılmayabiliyor: F02. |
| Normal oynatımla bitiş | Açılıyor; karşılıklı imha mesajı yanlış: F03. |
| Kaçış → sonraki tur → geri sar | Kimlik/can/sayaç korunuyor; sonraki ateş/hedef olma yok. Görsel statü eksikleri F10. |
| Altıncı turun son safhası | Yanlış kaçış başlığı: F09. |
| Yeni ayarlar → yeni savaş | Önceki kayıt ayarlar değişirken hemen bozulmuyor; yeni savaşla oynatım/seçim sıfırlanıyor. Hazır örnek adı ise F22. |
| Geciken hesap sırasında yeni düzenleme | Mevcut UI regresyonu yeni düzenlemenin eski yanıtla «uygulandı» sayılmamasını doğruluyor. |
| Worker hatası → tekrar dene | Hata yakalanıyor ve tekrar deneme çalışıyor; yükleme metni F24. |
| GPU kaybı → geri geliş | Duraklatma var; aynı 3B sahneye iyileşme yok: F05. |
| Boş sayısal alan → blur | İstenen boş yazım ve blur normalleştirmesi çalışıyor. Geçersiz canın açıklaması F21. |

## Önerilen düzeltme sırası ve kabul ölçütü

1. **Durum doğruluğu:** F01–F07; sonra F08–F09. Bütün zaman/atış/gemi/sonuç
   bileşenleri aynı anı anlatmalı. End, son piksele sürükleme, geri sarma,
   sıfır can, karşılıklı imha ve GPU geri gelişi ayrı kabul senaryoları olmalı.
2. **Oyuncunun okuyabilmesi:** F10–F16. Mobilde gemiye rahat odaklanma,
   kimlik/taraf/sınıf/rol, okunabilir can-kalkan ve kaçanlar alanı birlikte tasarlanmalı.
3. **Anlatım akışı:** Gerçekleşen/gelecek atış ayrımı, eşzamanlılık açıklaması,
   müttefik sahipliği, özel gemi rolleri ve ayar/hata durumları.
4. **Görsel kalite:** Gezegen/Aegis arka plan olmalı; ana odak gemi, atış,
   temas, hasar ve anlaşılır kaçış hareketi. Okunabilirlik düzeldikten sonra
   siluet, ışık, vuruş ve imha efektleri aynı görsel dilde parlatılmalı.

Kabulde 350 px ekranda oyuncu; kimin ateş ettiğini, hangi sınıfa neden daha çok
vurduğunu, hasarın Aegis/kalkan/cana nasıl ayrıldığını, hangi geminin öldüğünü
ve hangisinin hangi turda kaçtığını geliştirici açıklaması olmadan anlayabilmeli.
İstediği gemiye kolay ulaşabilmeli; serbest kamerada tarafları karıştırmamalı;
başa/sona sarınca bütün ekran doğru duruma dönmeli.

## Kanıt dizini

[18 ekran görüntüsü ve altı gözlem kaydı](evidence/battle-simulator-review-2026-10-25/).
`observations.json`: ilk uçtan uca kullanım; `followup.json`: dönen kamera ve
karşılıklı imha; `retreat.json`: gerçek End tuşu ve kaçış; `state.json`:
hata/yeniden deneme/resize/görünürlük/GPU/son tur/geçersiz can;
`mechanics.json` ve `retreat-state-invariants.json`: kayıtla sayısal eşlik.
