# Gönüllü koloni terki — 9 Ekim 2026

## Gereksinim ve sonuç

Master üzerinde geliştirilir; yeni dal veya worktree açılmaz. Yalnız sahibinin kolonisi
terk edilebilir. Ana gezegen terk edilemez. Buton önce koloninin adını ve kayıpları
gösteren bir onay penceresi açar. Açmak, kapatmak veya vazgeçmek sahipliği değiştirmez.
Son onay ayrı bir POST isteğidir ve açık `confirm: true` gerektirir.

Başarılı terk mevcut `secedeColony` davranışını kullanır: gezegen tarafsızlaşır;
binalar, uydular, kaynaklar ve yer savunmaları gezegende kalır; yerdeki ve onarım
istasyonundaki mobil gemiler hasarlarıyla ana gezegene taşınır. İnşaat/üretim/onarım
kuyrukları iadesiz kapanır, arızalar temizlenir, koloni kotasında yer açılır.
Komutan araştırması komutana aittir ve sürer. Başlangıç şablonuna sıfırlama yapılmaz.

## Sunucunun engelleyeceği durumlar

- Koloniyi uçuşun herhangi bir ucu olarak kullanan aktif görev: saldırı, sonda,
  dönüş, aktarım, yerleşim, Ölüm Yıldızı, klan aktarımı ve ortak savaş/destek uçuşu.
  Radar görünürlüğü ve varış saatinin geçmiş olması kontrolü kaldırmaz; gerçek
  kalıcı görev durumu esas alınır.
- Koloninin kazıcı/enkaz toplama, korsan, ticaret veya galaksiler arası konvoy görevi.
- Koloniden çıkan ortak savaş katkısı: yolda, toplanmış, geri çağrılmayı bekleyen,
  savaşta veya dönüşte; uçuş bulunmayan toplanmış filo da engeldir.
- Koloninin gönderdiği veya barındırdığı klan savunma desteği: yolda, konuşlanmış,
  dönüşte. Terminal HOME/LOST kayıtları engel değildir.
- Koloniden çıkan anıt filosu: yolda, anıtta bekleyen, dönüşte; anıt sondası yolda/dönüşte.
- Devam eden stratejik üretim/atış veya sonuçlanmamış önleme olayı.
- Görev okuyucularının dışında kalan pozitif, evde veya onarım istasyonunda olmayan
  gemi kaydı: gelecekteki görevler ve eski tutarsız kayıtlar için kapalı varsayım.
- Devam eden işgal koruması/iyileşme ve sadakati sıfırlanmış, kopuşu bekleyen koloni.

Kontroller yalnız bu koloniyle ilgilidir; ana gezegenin veya başka koloninin bağımsız
görevi terki engellemez. Bitmiş/iptal edilmiş geçmiş görevler engel değildir.
Gelen gizli uçuş hakkında yalnız genel engel nedeni döner; kimlik, konum, tür,
gemi sayısı ve zamanlar bu API ile açıklanmaz. Engeller pencerede kalıcı ve çevrilmiş
metinle gösterilir; yeniden kontrol edilebilir.

## Dokunulacak yerler ve riskler

Yeni terk servisi, gezegen API yolları, istemci şeması/API/önbellek kancası, koloni
yönetim kontrolü ve altı dilde metinler. `secedeColony` ortak sonlandırma yolu korunur;
gönüllü terk bildiriminin nedeni ayrılır. Veritabanı şeması veya denge değişikliği yoktur.

POST mevsim ve gezegen kilitleri altında koşulları yeniden okur. Ana gezegen ve
koloni global sırayla kilitlenir; anıt geçmişinin gerektirdiği ek ana gezegenler de
baştan bu sıraya katılır. Başlatma yolları aynı dünya kilitlerini aldığından kontrol
ile sahiplik değişimi arasına yeni bir uçuş giremez. Başarısızlık bütün işlemi geri
alır. Çift onay iki kez gemi taşıyamaz. İstemci eski okumaları iptal ederek koloniyi
listeden çıkarır, ana gezegen verisini uygular ve seçimi ana gezegene döndürür.

## TDD ve doğrulama

Önce servis/API/sözleşme ve arayüz testleri yazılır ve FAIL görülür. Mutasyonla
başarı, yetki, ana gezegen yasağı, bozuk kimlik/eksik onay, bütün engel durumları,
geçmiş kayıtlar, başka dünya görevleri, gizli uçuş verisi, iki eşzamanlı terk,
eşzamanlı saldırı/terk ve işlem geri alma test edilir. UI: açma terketmez,
vazgeçme/kaçış terketmez, koşul kontrolü bitmeden onay verilemez, engeller görünür,
POST sırasında değişen koşullar görünür, çift basış tek istek gönderir, hata penceresi
kapanmaz, başarı ana gezegene döner, başka dünya seçimi eski onayı kullanamaz.

Hedef testler → PASS, kod incelemesi, sıralı typecheck/lint/normal testler;
yerel PC için `nice -n 10`, tek workspace ve tek Vitest worker kullanılır.
Uzun ekonomi/mevsim/snowball testleri çalıştırılmaz. Ön yüz telefon ve masaüstünde
`tools/visual.mjs` ile görülüp doğrulanır. Kullanıcının mevcut ilgisiz değişiklikleri
korunur; çakışan dosyalarda yalnız gerekli ekleme yapılır.

## Uygulama ve tamamlanan kontroller

- 72 terk API/kalıcılık testi ve 90 API sözleşme testi geçti. Gerçek saldırı servisiyle
  yarış, çift onay, geri alma ve eski anıt geçmişinin kilit sırası bu kapsamdadır.
- 16 arayüz testi geçti: gerçek dünya seçicisi ana gezegene döner; gecikmiş liste
  yanıtı koloniyi geri getiremez; başarısız yeni kontrol eski uygunluğu kullanmaz;
  görünüm envanteri geçersizleştirilir.
- İnceleme, terk sonrası Servet hesabının yenilenmesini ve gönüllü terkin kayıp
  alarmından ayrılmasını ekledi. Hazır stratejik donanımın gezegende kalacağı onayda
  açıkça belirtilir. Başarılı POST yanıtı kaybolursa istemci sahipliği yeniden okur,
  yazmayı tekrar denemez. Sadakatin son kayıt güncellemesinden sonra sıfırlanması,
  korumanın tam bittiği an ve sonuçlanmamış önlemenin iki ucu ayrıca test edilir.
  Ana gezegenin son ekonomi güncellemesi de Servet hesabına dahil edilir;
  bir saatlik üretim sonrasında yanıt ile kayıtlı hesap eşitliği ayrıca doğrulandı.
- `node tools/visual.mjs out/colony-abandonment --colony-abandonment`, yerel Vite
  üzerinde gerçek bileşenleri test API'siyle çalıştırdı. TR/EN/DE/FR/ES/JA dillerinde
  350 ve 1280 pikselde 12 senaryo geçti. Onay, üç eşzamanlı engel, yeniden kontrol,
  açık onay gövdesi ve ana gezegen seçimi doğrulandı. Görüntüler ve ölçümler
  `out/colony-abandonment` dizinindedir; gerçek oyun verisi değiştirilmedi.
- Ayrı PostgreSQL test veritabanında gerçek HTTP API ve gerçek tarayıcıyla tek seferlik
  kontrol geçti: Escape/vazgeçme istek göndermez; onay açıkken gerçek saldırı başlatılır,
  son onay reddedilir; gerçek geri çağırma/worker inişi sonrası yeniden kontrol açılır;
  başarılı terkin yanıtı kesilse de sahiplik ana gezegene döner. Sekiz mobil gemi
  taşınır, dört yer savunması ve iki hazır stratejik donanım gezegende kalır, ödenmiş
  inşaat emri iadesiz kapanır. Görüntüler elle incelendi. Kanıt ve tek seferlik kontrol
  `out/colony-abandonment/manual-http-evidence.json` ve `manual-http.mts` dosyalarındadır.
- Sahiplik değişimi `shard:control` ile yayılır; harita için yavaş büyüme yayınını
  beklemez. Kapalı koloninin geçmişte kalan sorguları iptal edilir.
- Kalıcılık testleri yerel `astera_colony_abandon_20261009_test` veritabanında
  çalışır; mevcut geliştirme veritabanı kullanılmaz.

Son doğrulama tamamlandı: 2.026 kural, 3.143 sunucu ve 5.671 arayüz testi geçti
(toplam 10.840; mevcut 30 test atlandı). Tam typecheck ve kök `pnpm lint` geçti.
350×568 pikselde 12 engelin birlikte gösterildiği ek kontrol de geçti; liste
kaydırılabilir, yeniden kontrol/vazgeçme düğmeleri erişilebilir ve onay engellidir.
Ölçümler ve elle incelenen görüntü `out/colony-abandonment/stress` dizinindedir.
Ekonomi/mevsim simülasyonları ve snowball audit çalıştırılmadı.
