# Gerçek savaş tekrarları: doğrulama ve düzeltme incelemesi

25 Ekim 2026. İzole `feature/battle-simulator-20261024` worktree. Bu rapor,
önceki 26 görsel bulgunun ardından **gerçek savaşa bağlanan** oynatıcıyı inceler.
Canlıya yayın/merge yapılmadı. Bulgular; test, gerçek PostgreSQL transaction'ı ve
350/1600 piksel tarayıcı incelemesiyle doğrulanır. Tamamlanmayan kontroller ayrıca
belirtilir; test sayısı veya ekran görüntüsü tek başına kalite kanıtı sayılmaz.

## Kullanıcının netleştirdiği kurallar

- %50 izleme eşiği mevcut `combatValue` oranıdır. Kargo/hurdacı bu değere girmez.
  Bu yüzden az silahlı, çok yüklü savunmalarda bilgi açılabilmesi kullanıcı
  tarafından açıkça kabul edildi. Savunan ve gerçek savunma destekçileri kendi
  savaşlarını izleyebilir. Oran, savaş başlangıcında dondurulur.
- Söndürücü için eski global öncelik geri getirilir. Aegis kaldığı sürece tur
  başında bütün bonuslar uygulanır; sonra normal atışlar başlar. Bonus yalnız
  Aegis'e işler. Eski araştırmalı azami HP/sınıf ağırlığı korunur; normal atışların
  10 farklı hedef sınırı, sınıf önceliği ve kargo koruması değişmez.

## Doğrulanan bulgular

| No | Önem | Bulgu ve kanıt | Düzeltme |
|---|---|---|---|
| R01 | Yüksek, motor | Söndürücü bonusu normal atışlarla iç içeydi; 300 Aegis örneğinde 200 yerine 100 gövde hasarı oluşabiliyordu. Tek Söndürücü/iki hedef örneğinde 800 yerine 700 bonus emiliyordu. | Global ön faz ortak motora taşındı; beş regresyon, kayıt/RNG paritesi. Ayrı `aegisStrikes`, gemilere sahte hasar olayı yok. |
| R02 | Yüksek, görsel | Yer savunması merkezinin küre dışında olması, modelin altının yüzey dışında olduğunu garanti etmiyordu. Düz yönelim eğimli yüzeye gömülüyordu. | Gerçek yüzey normaline göre konum/yönelim; model altı için pay. 399 top sınırı da test edilir. |
| R03 | Orta, düzen | Eski genişlik sınırı sekiz küçük gemide satır kırıyordu. Geniş 16 büyük gemilik savunmada Aegis saldıran hattına taşabiliyordu. | En çok 16 gemi/satır. Koruyucu küre genişliğine göre saldıran mesafesi; 33 gemide 16/16/1 testi. |
| R04 | Orta, yanlış durum | Masaüstü bitiş görüntüsünde tüm savunanlar imha olurken sekiz mavi top tabanı hâlâ çiziliyordu. Oyuncu bunları yaşayan toplar sanabilir. | Model ve taban aynı kayıtlı imha geçişini kullanır; geri sarınca birlikte döner. Tabanlar iki ortak çizimle örneklenir. |
| R05 | Yüksek, büyük savaş | 260 birimlik sabit orbit sınırı ve 600 birimlik uzak kesim, geçerli büyük kayıtta genel görünümü kesebiliyordu. | Mesafe ve uzak kesim gerçek formasyondan hesaplanır; 2.000 birlik kaydı testi. Kaçış alanı da hareket sınırına dahildir. |
| R06 | Orta, kamera | 399 top içeren senaryoda savunanın odak kamerası ile seçili top arasındaki hat gezegen küresini kesiyordu; eski davranış geometrik testte yeniden üretildi. | Yüzey toplarına radyal yönden odaklanılır. İki bakışta kamera–top hattı küre dışındadır; mobil kart için üst alanda yer bırakılır. |
| R07 | Yüksek, sahiplik | Ortak saldırıda “Filo 1/2” oyuncunun hangi gemiyi gönderdiğini açıklamıyordu. Aynı oyuncunun farklı araştırmalı dalgaları da ayrı tutulmalı. | Sunucuda özel katılımcı/alias eşlemesi; API yalnız okuyucunun savaş içi alias'larını verir. Seçim, birim kartı ve kaçış listesinde senin/müttefik filo ayrımı. Araştırma yığın kimliğiyle okunur. |
| R08 | Yüksek, sonuç | Korsan kargolarının savaş sonrası imha edilmesi ve anıtta kaybeden kargonun çekilmesi yalnız normal atışlardan üretilemez. | Gerçek sonuca ait ayrı savaş sonrası olay ve son durum. Yeni tur/atış uydurulmaz; çekilenler hayatta ve savaş dışında gösterilir. |
| R09 | Orta, yanlış bilgi | Ortak çözücünün yer topu kurtarma değeri, tarafsız yerleşimin gerçekten uygulamadığı bir yeniden kurulum iddiası yaratıyordu. | Tarafsız tekrar, gerçek rapor gibi sıfır kurtarma taşır. Gerçek tarafsız baskın testi. |
| R10 | Orta, state | Raporun parent'ı yenilenince kapanış callback'i değişiyor, modal efekti odağı yeniden kapatma düğmesine çekiyordu. | Sabit callback; açık oynatıcının odağı parent yenilemesinde korunur. |
| R11 | Orta, gezinme | Escape/Android Back, açık atış dökümünü ayrı katman olarak ele almıyordu. | Önce döküm kapanır; sonra tekrar. Odak açana döner. Klavye odağı en üst katmanda kalır. |
| R12 | Orta, yükleme | 3B modül indirmesi reddedilince hata uygulamanın genel hata ekranına kaçabilir; indirme sürerken geri dönüş yoktu. | Modül indirme hatası rapor içinde tutulur. İptal vardır; kapatılan indirme ayrıntılı kaydı istemez. Chromium deneyi başarısız modülün aynı sayfada yeniden istenmediğini doğruladı; modül hatasında açık “Oyunu yenile”, API hatasında gerçek “Tekrar dene” sunulur. |
| R13 | Orta, sözleşme | Aynı tur sonu dizisinde tekrarlı gemi kimliği, doğru uzunlukta olsa da eksik gemi bırakabiliyordu. | Zod, ilk kadro ile her tur/son durum arasındaki kimlik bütünlüğünü doğrular; bozuk kayıt çizilmeden reddedilir. |
| R14 | Yüksek, gizlilik | Ayrıntılı kayıt rapor listesinde yüklenirse zayıf saldıran veya ilgisiz kişi ağdan düşman kadrosunu okuyabilir. | Ayrı tablo, yalnız metadata listesi ve yetkili tembel ayrıntı endpoint'i. Zayıf saldıran/ilgisiz kişi/başka sezon testleri; iç UUID, tohum, yakıt stoku ve savaş dışı araştırma gönderilmez. |
| R15 | Orta, kimlik | Gerçek tekrarda kamera tarafı değişince sonuç “sen” hitabını karşı tarafa geçiriyordu. | Kameradan bağımsız gerçek okuyucu tarafı; perspektif değiştirme sonuç kimliğini değiştirmez. Serbest simülatörde taraf seçimi korunur. |
| R16 | Yüksek, kişisel kayıp | Müttefikler kazanırken okuyucunun bütün gemileri imha olsa bile yalnız takım başarısı gösterilebiliyordu. | Takım sonucu ve kişisel imha ayrı açıklanır. Hayatta kaçanlar veya savaş öncesi çıkan filo imha sayılmaz. |

## Kapsam ve kontroller

- Gerçek üreticiler: kişisel baskın, savunma desteği, ortak klan saldırısı, korsan,
  tarafsız gezegen, anıt/NPC/klan. Kaçış ön denemesi değil, gerçekten uygulanan dal
  kaydedilir. Sonuç ve kayıt aynı transaction'da; mükerrer teslim kaydı değiştirmez.
- Kalıcılık: ayrı tablo; rapor/sezon silinince cascade. `0197` ve ardından özel
  sahiplik eşlemesi için `0198` **üretilmiş** migration; uygulanmış dosya değiştirilmedi.
- State: ileri/geri/baş/son, atış/döküm seçimi, aynı tur ölürken ateş hakkı, son
  turda kaçış yokluğu, karşılıklı imha, GPU kaybı/dönüşü, model yükleme hatası,
  indirme/istek hatası, kapatma/iptal ve yeniden açma.
- Kurallar: Aegis ve kişisel kalkan ayrımı; yer topunda kişisel kalkan yokluğu;
  her dalganın araştırması; sınıf çarpanları ve 10 hedef sınırı; kargo/hurdacı
  koruması; gerçek hasar rozetleri; kaçan geminin canı/kimliği ve park alanı.
- Eski rapora eksik atış uydurulmaz. Büyük savaşın kaydı sınırı aşarsa savaş
  normal biter; yarım tekrar yerine açık neden gösterilir.
- Bir mevcut eşzamanlı anıt testi rastgele dalga UUID'si yüzünden bazen kargonun
  ölmesini, bazen kaçmasını bekliyordu. Bu bir üretim yarışı bulgusu değildi.
  Testin savaş tohumu sabitlendi; gerçek yarış/mükerrer teslim kontrolü korundu.

## Kabul sonucu

- [x] Motor: Söndürücü kararı sonrası 231 test / 12 dosya.
- [x] Arayüz: 301 test / 23 dosya; modül indirme hatası için ek 18 test / 2 dosya.
- [x] Sunucu: son Söndürücü/sahiplik değişiklikleriyle 193 regresyon / 9 dosya.
- [x] Rules, sunucu ve web TypeScript kontrolleri.
- [x] Üç sıralı lint grubu ve son production paket kontrolü.
- [x] Son kodla gerçek API → rapor → 3B: 1600px saldıran, 350px savunan;
  13 görüntü, sıfır beklenmeyen tarayıcı hatası. Son can/kalkan/durum birebir aynı.
- [x] Ayrıntılı bulguların son tarayıcı görüntüleriyle kapanış kontrolü.

Son görüntüler ve makineyle doğrulanmış sonuçlar:
[gerçek savaş kanıtı](evidence/battle-replay-2026-10-25/real-battle/evidence.json),
[mobil yüzey topu](evidence/battle-replay-2026-10-25/real-battle/350-ground-focus.png),
[masaüstü yüzey topu](evidence/battle-replay-2026-10-25/real-battle/1600-ground-focus.png),
[mobil savaş sonu](evidence/battle-replay-2026-10-25/real-battle/350-battle-end.png).
Serbest simülatörün production paketinde de 8 görüntü, son durum eşitliği ve
sıfır oyuncu API isteği ayrıca geçti:
[simülatör kanıtı](evidence/battle-replay-2026-10-25/standalone/evidence.json).

Son paketle ek 10 tarayıcı görüntüsü: klavyeyle sona gitme/geri sarma, atışlar
arasında gezinme, ters kamera altında taraf kimliği, mobil odak, atış dökümünden
Escape ile çıkış, tur sonu kaçış uçuşu/parkı/listeden seçim, yatay telefon ve
kontrollü GPU kaybı/dönüşü geçti. GPU dönüşünde zaman ve bütün gemi durumları aynı
kaldı; yeniden savaş hesaplanmadı. [Etkileşim kanıtı](evidence/battle-replay-2026-10-25/review/evidence.json).
Model indirme hatası da gerçek tarayıcıda üretildi; tekrar deneme modeli yeniden
istedi, savaş worker'ı bir kez çalıştı ve 12,5 saniyelik konum korundu.
[Model hatası kanıtı](evidence/battle-replay-2026-10-25/asset-retry/evidence.json).

Toplam 33 son paket/gerçek API görüntüsü saklandı. Mobil boyut değişimindeki
kontrol, sabit 300 ms bekleme yerine gerçek duraklama durumunu bekler; yazılımsal
GPU gecikmesi yanlış ürün bulgusu sayılmadı. Yerel rapor önizlemesinde Vite'ın
inline `null` ayarı birleştirmede atlaması da doğrulandı; dosya izleme çözülmüş
ayar üzerinde kapatıldı. Önizleme ENOSPC veya polling gerektirmeden açılır.

Fiziksel telefon/GPU performansı ölçülmedi. Yazılımsal WebGL ekran görüntüsünün
süresi, oyuncu cihazındaki FPS ölçümü olarak sunulmaz. Canlıya yayın yapılmadı.
