# Karakterli eğitim galaksisi — 1 Kasım 2026

**Durum:** FlightSchool uygulanmıştır. Bu belge 1–2 Kasım geliştirme, yerel ortam ve
kabul kayıtlarını korur; aşağıdaki worktree, port, test sayıları ve yayın hazırlıkları
o çalışmanın kayıtlarıdır. Güncel davranış ve yerel kodda uygulanan ilk sezon paketi
[review-onboarding.md](review-onboarding.md) içindedir. Güncel giriş `App.tsx` içinden
`flightSchool/FlightSchool.tsx` dosyasına gider; eski `Academy.tsx` ve `TUTORIAL_EXIT`
oyuncunun bu eğitimden çıkış paketi değildir. Eğitimde gerçek hesaba aktarılan ödül yoktur.

## Owner kararları

- Eski `blindspace-onboarding` çalışması kullanılmaz. Başlangıç güncel `master` 9fac8df1; yeni worktree `blindspace-academy-redesign`, dal `codex/academy-redesign-20261101`.
- Oyunu hiç bilmeyen kişiye, gerçek oyun arayüzüyle, izole bir galakside öğret.
- Önce bütün kurgu çalışır; süreyi sonra birlikte kısalt. Gereksiz ödül toplama ve menü turları yok.
- Verilen `tutorial-npc.png` ve `tutorial-hand-icon.png` kullanılır. Kısa telefonlarda karakter belden yukarı kadrajlanır; metin küçültülerek yer kazanılmaz.
- İnşa ve toplu üretim üç saniye. Metnin tamamını gösterme ile sonraki adım farklı eylemdir. Önemli sonuçlar okunmadan geçmez.
- Eğitim filosu ve yükseltmeleri gerçek galaksiye taşınmaz. Yeni başlangıç `PLANET_START` ve `START_BUILDINGS` ile sunucudan gelir. Eğitim atlamak veya tekrar oynamak ekonomik avantaj üretmez.
- Hareketli asteroide bir Kazıcı gönderme ve gerçek yörüngeye uygun yakalama/dönüş ana akışın parçasıdır.
- İlk uygulamada deploy/merge talebi yoktu; 2 Kasım talimatı inceleme, doğrulanmış düzeltmeler ve üretim yayınına yetki verdi.

## Kurgu

11 bölüm: kendi gezegenini seç → üç kaynak ve Havuz/Depo toplama → Komuta Çekirdeği/iki üretici → Anten/Teleskop/gözlem/1–5 menzil karşılaştırması → Tersane/Kazıcı/hareketli asteroit/dönüş/toplama → sonda/tahmini rapor → Hangar/30 Ok/2 Kurye → akın/savaş/dönüş/rapor → yaklaşan hareket/Radar/uyarı → Aegis/yer topları/savunma/rapor → normal başlangıçla gerçek galaksi.

Her sahne: ihtiyaç, kısa açıklama, oyuncunun gerçek kontrolle eylemi, gözle görülen sonuç. Sahne tanımları `apps/web/src/onboarding/flightSchool/scenes.ts`; Türkçe ve İngilizce konuşmalar `copy.ts`.

## Teknik sınırlar

- Ayrı QueryClient, kimliksiz özel Api ve ağ fallback'i olmayan taşıyıcı. Eğitim oyun istekleri sunucuya gitmez.
- Güncel GameShell, WorldProvider, GalaxyView, gerçek bina/gemi/gönderim/rapor pencereleri kullanılır.
- Yörünge/yakalama, görüş menzili, kapasite, bedeller, yakıt, istihbarat tahmini, savaş ve ganimet ortak rules fonksiyonlarından gelir. Eğitim saatleri ve galaksi kurgusu özeldir.
- Yerel depoya sonuçlar yerine sürümlü eylem geçmişi kaydedilir; yenilemede doğrulanıp yeniden yürütülür. Gerçek galaksiye bu geçmiş de gönderilmez; claim yalnız boş intent listesi alır.
- Eğitim sensör katmanları gerçek cihaz tercihlerini değiştirmez.
- Sonuç sahnesi kullanıcı onayı ister. Aynı dokunuş hem metni tamamlayıp hem sahneyi atlatamaz.

## 1–2 Kasım doğrulama kaydı

- İlk model/konuşma testlerinde eksik modül FAIL; implementation sonrası PASS.
- Okunmamış sonuçta bekleme, yanlış sipariş/adet, kapasite, hareketli asteroit/yakalama, sonlu eğitim bütçesi, tekrar işlememe ve eylem geçmişinden kurtarma testleri eklendi.
- Gerçek API şemaları üzerinden özel taşıyıcı testleri eklendi; maden/akın POST cevaplarındaki eksik alanlar FAIL ile yakalanıp düzeltildi.
- İlk toplama için depoda yer olmaması FAIL ile yakalandı; eğitim bütçesi sıradaki işlemin açığını tamamlayacak şekilde ayrıldı.
- Eski ekran çerçevesi yerine güncel GameShell/WorldProvider bağlandı; kapsam testleri FAIL→PASS.
- Sipariş süresi ve gemi adedi için özel sunum kapsamı; gerçek oyun dışarıda aynı davranır.
- 390×844 tarayıcıda bütün akış gerçek kontroller ve normal saatlerle oynandı; yazılar atlanmadı. İki savaş raporu açıldı ve komutan oluşturularak gerçek galaksiye geçildi. Claim yanıtında CORE 1, 1.500 alaşım, 400 kristal, 50 döteryum, boş filo ve boş yer savunması doğrulandı. Tarayıcı çalışma hatası yoktu. Son kısa telefon turu ve genel kontroller sürüyor.
- Genel web tsc 2048 MiB sınırında OOM verdi. Yeni modülleri, değişen bağımlılıklarını ve testlerini kapsayan daraltılmış tsc (global declaration dosyaları dahil) geçti; bu genel workspace typecheck yerine geçen bir iddia değildir.

## O çalışmada kullanılan yerel ortam

- Web: `http://127.0.0.1:5193/tr/`.
- Telefona açık adres, derlenmiş sürümü Vite preview ile sunar. Geçici kullanıcı servisleri: `astera-academy-web` ve `astera-academy-api`; terminal oturumunun kapanması oyunu durdurmaz. Kaynak düzenlemeleri telefonda otomatik sayfa yenilemesi yapmaz.
- API/worker: `http://127.0.0.1:3183/health`, aynı worktree'nin normal server entrypoint'i.
- Ayrı oyun DB: `astera_academy_redesign_play_test`; migration ve local bootstrap uygulandı. Otomatik test için truncate edilmez.
- Eski onboarding ortamı 5191/3181 ve eski worktree korunur.


## Oynama sırasında bulunan ve düzeltilenler

- İlk karede aktif gezegenin gelmemesi ve açılış kamerasının eğitim odağını ezmesi: başlangıç cache'i hazırlanır, eğitim odağı sahne çizildikten sonra uygulanır.
- Kazıcı hedefinin yanlış API biçimi yüzünden görünmemesi, gerçek saatin kesirli milisaniyeleri yüzünden ilerlemenin sıfırlanması: gerçek API şeması ve kayıt doğrulaması düzeltildi.
- Kargo kategorisi kapalı olduğu için Kurye üretiminin erişilememesi ve Aegisin yanlış Üs bölümünde aranması: ilgili yerel eğitim kategorisi açılır, Aegis Savunma bölümünde gösterilir.
- Uçuş ve savaşın uzaktan kalması: Kazıcı/sonda/filo gidiş ve dönüşte izlenir; çatışmada hedef gezegene yakınlaşılır.
- Radar uyarısı söylenmesine rağmen görünmemesi, hazırlıkta filonun ilerlemesi, savaş efektinin eksik olması: gerçek uyarı ve temas biçimleri kullanılır. Hazırlıkta hareket ve varış sayacı durur; Savunmayı izle eylemi saldırıyı devam ettirir.
- Raporda hasar alan Aegisin gezegende dolu kalması: kalan kalkan ortak savaş sonucundan gelir.
- Üretim göstergesinin yenilemede geri düşmesi ve dolu depoya toplama: kaynak üretimi yerel zamandan hesaplanır; kapasite aşılmaz, sığmayan kaynak Havuzda kalır.
- Teleskop genel görünümünde filo ve gelişim ayrıntılarının küçük kalması: gelişmiş dünya, daha küçük dünya ve uçan komşu filo ayrı yakın çekimlerle gösterilir.
- Eski kayıtlar yeni filo yakın çekimi eklenince sıfırlanmaz; eski eylem geçmişi için geçiş testi vardır.
- Teleskop genel görünümü ve 1–5 menzil gösteriminde gezegen yarıçapları gerçek çizimin 10 katıdır. Normal galaksi, yakın çekimler ve uçuşlar aynı ölçekte kalır. Açılış iki saniye bekler, görüş 2,8 saniyede büyür; kamera hafif geri çekilir. Keşfedilmemiş etiketi canlı isimle değişir.
- Altair gerçek Dyson aşamasında (Çekirdek 15), Lyra başkenttir. Halka ve uydular gerçek gezegen renderer'ından gelir.
- Lyra'nın kartını çarpıyla kapatmak eğitimdeki seçimi de temizler. Aynı gezegen yeniden seçilebilir; bu davranış gözlem, sonda ve akın için ortaktır.
- El ve çerçeve aynı, yerleşimi oturmuş kontrolü izler. Önceki pencerenin kapanışı sırasında eski menüye atlamaz. Kırpılmış Kurye kontrolü kendi penceresinde kaydırılarak görünür hâle gelir.
- 350×600 turunda Ok kartının sabit sekmelerin altındaki alana sığmadığı ayrıca bulundu. Kısa ekranlarda gemi kartı 96 px yüksekliğinde yatay yerleşir; resim, isim ve fiyat birlikte görünür. Rehberin boyu veya telefon yönü değişirse aynı hedefin kaydırması yeniden hesaplanır; bunun için FAIL→PASS regresyon testi eklendi.
- Her üretim siparişinden sonra gerçek kuyruk görünür alana kaydırılır. Kısa telefon turu bu görünürlüğü sipariş bitmeden ölçer.
- Akın seçiminde önce 30 Ok ve 2 Kurye birlikte tamamlanır; eksik seçim gönderilemez. Seçim tamamlanana kadar açıklama ve güç cetveli ikinci gemiyi örtemez.
- Kazıcı ve sonda yolculuğunda hareketli beyaz oklar ekranı sürüklemeyi öğretir. Gerçek sürüklemede veya yedinci saniyede kaldırılır.
- Örnek filo Lyra'dan Altair'e sekiz saniyede gider. Kamera gemiden ayrılmadan kaynağı gösteren açıdan hedefe döner. Varışta temas kaldırılır; bekleyen oyuncuya Devam kontrolü elle gösterilir.
- Yenilemeyle dönülen Teleskop/Radar gösterimi veya örnek uçuş, yükleme perdesi kalktıktan sonra yeniden başlar.

## Son düzeltmelerin kontrolleri

- Eğitim: 20 dosyadaki ilk 62 test geçti; sonraki kısa ekran düzeltmesinde 12 ilgili test (yeni yeniden kaydırma testi dahil) geçti. Toplam 63 eğitim testi var. Kapatıp yeniden seçme, 10 kat boyut, gecikmeli keşif, varışta kaybolma, dönen kamera, elin yerleşmesi ve geçici oklar bu kapsamdadır.
- İlgili normal oyun regresyonları: 16 dosyada 268 test geçti; filo seçimi, odak kartları, kuyruklar, sensör tercihleri, kimlik/parola, ülke, kurallar onayı, native Back ve HUD kapsanır.
- Değişen dosyaların lint kontrolü ve yeni kod/değişen bağımlılıkları kapsayan daraltılmış TypeScript kontrolü geçti. Vite üretim derlemesi geçti.
- Önceki genel web turunda 8.320 test çalıştı. Kalan menü/arena tarih varsayımı hataları özgün worktree'de de yeniden üretildi; zamanlayıcı testi tek başına geçti. Genel web TypeScript kontrolünün 2 GiB bellek sınırında tamamlandığı iddia edilmez.
- Son kısa telefon turu, kaynak dosyası yenilemelerinden etkilenmeyen üretim önizlemesinde yürütülür (`5194`, API `3183`). Telefona açık geliştirme adresi `5193` korunur.

## Son owner ekleri

- Eğitimde galaksi merkezindeki parlak çekirdek çizilmez.
- Rehber kartındaki çıkış: “Akademiyi Bitir”.
- İlk kimlik adımı: “Komutan adını belirleyelim”; adın diğer oyunculara mesajlarda ve sıralamada görüneceği açıklanır.
- İkinci adım: seçilen komutan adına daha sonra veya başka cihazdan erişmek için parola belirlenir. Kullanıcı adı aynı formda parola yöneticileri için korunur, ikinci adımda tekrar gösterilmez. Ülke ve açık kurallar onayı korunur.
- Telefon erişimi: aynı Wi-Fi ağından `http://192.168.1.73:5193/tr/`. Gerçek yerel IP `192.168.1.73`; `192.186.1.73` değildir. Vite preview `0.0.0.0:5193` üzerinde, oyun API'si aynı origin proxy'sinden erişilebilir.

## Oynama kanıtları

`node tools/visual.mjs out/flight-school-first-full --flight-school`

İlk tam tur: `out/flight-school-first-full/`. Yazılar atlanmadı, saat ileri alınmadı, oyuncu eylemleri gerçek DOM/WebGL kontrollerinden yapıldı. `journey.json` sahne sırasını, zamanını ve normal başlangıç kontrolünü kaydeder. Ekran yakalama ve yazılım GPU beklemeleri dahil 9 dakika 39 saniye sürdü; bu sayı gerçek telefondaki kullanıcı süresi olarak sunulmaz.

Gerçek başlangıç doğrulandıktan sonra, son görsel inceleme küçük telefonlardaki pencere–rehber çakışmasını ve uçan komşu filonun yeterince görünür olmamasını ayrıca buldu. Son tur bu düzeltmelerden sonra yeniden yapılacak.

## 2 Kasım incelemesi ve release adayı

Owner, kaba CR → doğrula → düzelt → deploy sırasını istedi. Release ayrı `blindspace-academy-release` worktree'sinde, yayındaki istemci `28e5f31b` üstüne hazırlanır. Yayımdaki optimize Ok modeli korunur. Geliştirme tabanındaki `9fac8df1` iş akışı/DM/doküman değişiklikleri ve FocusPanel saydamlık değişikliği release'e taşınmaz. Sunucu ve ortak rules kaynaklarında değişiklik yoktur; migration journal 218 olarak kalır.

Doğrulanan ve düzeltilen bulgular:

- Kesirli kaydırma ölçümü (330,390625 px / 330,6875 px) bütün işaretleri gizleyebiliyordu. Bir piksellik yuvarlama toleransı ve kısa pencereye sığmayan kartın görünür bölümünü işaretleme, FAIL→PASS testleriyle düzeltildi. El ve sarı çerçeve aynı görünür dikdörtgeni kullanır. Yükleme perdesi ikisini de gizler.
- Üç saniyelik üretimin bir kısmı yumuşak kaydırmada geçiyordu. Üretim kuyruğuna kaydırma ilk karede doğrudan yapılır; menü kontrolleri yerleşene kadar bekleme davranışını korur.
- Teleskop kadrajı, rehber/dock altında kalan alanı ve tam görüş küresini birlikte kapsar. Mevcut küre önce görünür; her büyütmede kamera 900 ms içinde yeni çevreyi gösterir, görüş sınırı 2 saniye sonra 2,8 saniyede genişler. Her seviyede yeni gezegen açıldığı test edilir. Puslu, küçük ve seçilebilir cisimler keşifle gerçek renkli/büyük modele dönüşür. Dışarıdaki sonraki gezegenler kadraj açılınca görünür. İsimler gövdeleri örtmez; gezegenler aynı doğrultuda üst üste yığılmaz. Kontrolün adı “Teleskopu büyüt”tür.
- Eğitim yükseltme yanıtı her bina için `level: 1` diyordu. Komuta Çekirdeği yükseltmesinin hedef seviyesi 2 olarak yanıtlanır. Sonda yanıtı varış zamanı yanında yanlışlıkla gidiş-dönüş süresini veriyordu; varış süresiyle eşitlendi. İki sözleşme tutarsızlığı ayrı FAIL→PASS testleriyle doğrulandı.
- Son owner talimatıyla “Teleskopu büyüt” tam iki kez kullanılır: 1 → 3 → 5. Kamera önce önceki gerçek yarıçaptan yeni kadraja açılır; iki saniyelik bekleme ve görüşün büyümesi korunur. İki tıklama sonrası Devam gösterilmesi ve kademeler arası kamera başlangıcı FAIL→PASS testleriyle doğrulandı.
- 350×600 tam tur gerçek kontrollerle oynandı; iki savaş raporu ve normal galaksiye geçiş tamamlandı, tarayıcı hatası yoktu. Son görsel incelemede Radar uyarısının rehber altında kaldığı doğrulandı; yalnız bu anlatım sahnesinde gerçek uyarı rehberin altında görünür konuma taşındı.

350×600 ve 390×844 boyutlarında 13 üretim konusu tek tek açıldı: CORE, REFINERY, EXTRACTOR, UPLINK, TELESCOPE, SHIPYARD, PROSPECTOR, HANGAR, DART, COURIER, RADAR, AEGIS, THORN. 26 kartta doğru sarı çerçeve/el ve gerçek tıklama doğrulandı. Eğitim/ilgili normal oyun testlerinin release tabanında 34 dosyada 269 testi geçti; sonda sözleşmesi eklendikten sonra ilgili 15 test ayrıca geçti. Kaynak/etkilenen bağımlılıklar için daraltılmış TypeScript ve değişen bütün dosyaların lint kontrolü geçti; genel web tsc'nin 2 GiB'da tamamlandığı iddia edilmez.

Canlı host kapasite önkontrolü geçti. Taze özel dump ayrı staging DB'ye restore edildi; 218 migration, 1.747 hesap, 134 oyuncu, 222 gezegen okundu. Üç API/worker, runtime environment/Compose, webroot ve Nginx geri dönüş kanıtları VPS'teki özel `releases/academy-20261102` klasöründe saklanır. Yayıma başlamadan tarayıcı turu ve image/web kabulü tamamlanır; yayın sonrası SHA, health, nonce, eski hash'li asset ve dış HTTP kontrolleri ayrı kabul raporuna yazılır. Bu hazırlık kaydı tek başına yayın kanıtı değildir.

Son aday: 31 dosyada 266 regresyon testi, son iki tıklama testi dahil 9 ekran testi, kapsamlı daraltılmış tsc, değişen kaynakların tamamında lint ve GA/Arena seçenekleri korunmuş Vite derlemesi geçti. `out/academy-release-resume/` 350×600 tam turu normal galaksiye kadar kaydeder. `out/academy-two-growths/level-3.png` ve `level-5.png`, gerçek oynanmış geçmişten açılan tarayıcıda iki büyütmeyi gösterir; 5. seviyede üçüncü büyütme yoktur ve Tersane'ye devam edilir. `radar-warning.png` gerçek saldırı uyarısının rehberin altında görünür olduğunu doğrular (rehber altı 222,9 px; uyarı üstü 243 px); tarayıcı çalışma hatası yoktur.
