# Oyuncu ölçümü — son inceleme kaydı

Bu dosya yayın öncesindeki bağımsız kontrol turunun kanıtlarını toplar. Ara durumlar inceleme günlüğüdür; güncel sonuç sondaki yayın öncesi kabul bölümündedir. Uygulama sırasında bulunan hatalar da aşağıda ayrı kayıtlıdır; geçmiş test koşusu, son değişikliklerin otomatik kabulü değildir.

## İnceleme kapsamı

- Ortak olay sözleşmesi, veri modelinin tüm alanları ve 0218–0226 eklemeli migration'lar.
- Alım, kimlik bağlama, hız sınırı, replay/tekilleştirme, saat güveni ve veri saklama.
- Anasayfa/Play, 11 adımlı eğitim, claim, yerleşme, gerçek sahne hazırlığı ve arena ayrımı.
- Manuel işlemin değişmez aktörü/zamanı, niyet → commit korelasyonu, recovery ve sonuç görünürlüğü.
- Web/native auth köprüsü, bildirim ledger/provider/açılış ayrımları, kurtarma ve teknik gözlemler.
- Admin yetkisi, paydalar, eksik veri, oturum/süre/retention hesapları, sayfalama ve sorgu sınırları.
- Oyun yanıtı/idempotency sınırlarına veri sızıntısı, hesap silme, flag kapatma, deploy yapılandırması.

## Uygulama sırasında doğrulanıp giderilen sorunlar

| Bulgu | Doğrulama | Düzeltme ve kanıt |
| --- | --- | --- |
| Ana sayfa ve Play ayrımı yoktu. | Gerçek giriş bileşeni testi. | Görünüm/tıklama/giriş/yükleme hatası ayrı olay; tarayıcı kabulü. |
| Callback başarıyla dönse de lazy eğitim modülü yüklenemeyebilirdi. | Gerçek import tarayıcıda kesildi. | Play denemesi gerçek eğitim hazırlığına kadar açık; hata aynı denemeye bağlı. |
| Anasayfa süresi canlı oyun süresine katılabiliyordu. | Saf modelde iki FAIL senaryosu. | Context başına gerçek game_ready ve ilk heartbeat kırpması. |
| Arka planda yeni kapsam açılması görünür oyun sanılabiliyordu. | Ekran hook testi FAIL. | Hazır/görünür yüzey ön plan koşuluna bağlı; dönüşte tekrar gözlem. |
| Hesap geçişinden sonra ön plan yakalama yeniden başlamıyordu. | Runtime testi FAIL. | Yeni kapsam callback'i foreground ve güncel yüzeyi yeniden başlatır. |
| Eski hesabın gecikmiş API sonucu yeni kapsama yazılabiliyordu. | Gecikmiş ret testi FAIL. | Yanıt yalnız aynı özel ziyaret kapsamına yazılır. |
| Ağ kesintisi kesin sunucu reddi sayılıyordu. | API testi FAIL. | Sonuç bilinmiyor ile gerçek 4xx ret ayrı. |
| Toplu alım olay başına çok sayıda DB sorgusu yapıyordu. | 32 olayda 129 statement. | Toplu kontrol/insert; en fazla 12 statement testi. |
| Admin sayfası hesap sayısıyla ayrı sorgular ekliyordu. | Sorgu sayısı testi FAIL. | Toplu hesap okuması ve hesap başına sıralı üst sınır. |
| Yeni yerleşmemiş hesap 24 saat inaktif sayılabiliyordu. | Yeni hesap testi FAIL. | Hesap yaşı filtreye dahil. |
| Collection kapalıyken ziyaret hash'i kaynak satırına yazılabiliyordu. | Flag kapalı komut testi FAIL. | Kapalı dönemde hash/deneme bağlantısı yazılmaz. |
| Collection rollback'i izin geri almayı da kapatıyordu. | Flag kapalı DELETE testi FAIL. | Yalnız izin geri alma endpoint'i erişilebilir kalır. |
| Günlük toplam hatası saklama temizliğini atlatıyordu. | Başlangıçta hata enjeksiyonu FAIL. | Temizlik finally içinde çalışır. |
| Geçici analytics DB hatası kuyruktaki kimlik olgusunu düşürüyordu. | Transaction hata enjeksiyonu FAIL. | Kuyruktan çıkarma başarılı işlemden sonra; sınırlı retry. |
| Silme işlemi tek statement'ta bütün ziyaretleri cascade ediyordu. | 256 sınırını zorlayan gerçek DB trigger'ı FAIL. | Çocuk veriler önce, sınırlı DELETE/UPDATE grupları. |
| İzin geri alma, kalıcı komutun ölçüm korelasyonunu bırakıyordu. | Kaynak satırı testi FAIL. | Hash ve deneme kimliği de silinir; asıl emir korunur. |
| Hesap silme, başkasının dünyasında kalan kaynak metadata'sını bırakıyordu. | Gerçek erasure servisi + yaşayan başka sipariş testi FAIL. | Silinen aktörün opsiyonel snapshot/korelasyonu transaction içinde temizlenir. |
| Çok büyük sequence DB integer taşmasına ulaşabiliyordu. | Wire sözleşme testi FAIL. | İstemci sayacı PostgreSQL integer sınırında doğrulanır. |
| Rastgele özel anahtarlar bağımsız hız bütçeleri yaratabiliyordu. | Dönen sahte anahtarlarla IP testi FAIL. | Adres, context ve hesap bütçeleri ayrı. |
| Native giriş ziyaret kimliğini taşımıyordu. | JS/API/Java başlık testleri FAIL. | Ayrı opsiyonel bridge alanı → HTTP header; credential body temiz kalır. |
| Bildirim ücretlendirmesi/provider kabulü teslim sanılabilirdi. | Ledger, FCM ve alıcı/izin testleri. | Durum/sağlayıcı/açılış ayrı; teslim iddiası yok. |
| Monument cevabı/idempotency JSON'u yeni iç alanları taşıyabiliyordu. | Gerçek API/cache sınırı testi FAIL. | Public wave DTO'su hem cache öncesi hem yanıt sınırında açık seçilir. |
| İzin başlığı public marketing tipografisini devralıyordu. | 350 px ekran görüntüsü. | Yerel başlık ölçüsü; tekrar görsel kabul. |
| Opsiyonel ölçüm kimliği üretim hatası gerçek oyun isteğini/render'ı bozabiliyordu. | Crypto hata enjeksiyonu ile iki FAIL. | API asıl isteği gönderir; runtime gözlemi izole eder. |

## Son turda ayrıca doğrulanacaklar

Henüz tamamlandı olarak işaretlenmedi:

- Yeni eklenen alanlar ve bağlamlar dahil bütün değişen dosyalarda tip/lint kontrolü.
- Sahiplik/izin/hesap/sekme yarışları ve yarım kalan yanıtların yeniden gözden geçirilmesi.
- Gerçek eylem, worker tamamlanması, görülen sonuç ve geri dönüşün birbirine karışmaması.
- Değişen veri alanlarının normal API, stream ve tekrar isteği cache'lerine taşınmaması.
- Rollover/reclaim/account deletion ve olağan kaynak/auth/bildirim regresyonları.
- Son admin/izin/engel/kurtarma ekranlarının 350/390 px ve masaüstü kabulü.
- Geçici DB ve süreç cleanup'ı; kanıtlarda gerçek oyuncu veya gizli anahtar olmaması.

## Kapsam ve kanıt sınırları

Owner'ın son talimatıyla yük yalnız kabaca kontrol edildi; uzun 15 dakika/burst ve p95/p99 karşılaştırması kabul koşulu olarak kullanılmayacak. Kısa koşuda 1000 context'ten 14.000 farklı olay bulundu.

Bağlı gerçek Android cihaz yok. Tam Android Gradle/APK kabulü yerel JDK/Firebase yapılandırması nedeniyle tamamlanmadı; gerçek session Java kaynakları doğrudan derlendi ve session/HTTP JUnit testleri ayrı çalıştırıldı.

Production'da yeni ölçüm etkinleştirilmedi; canlıya yayın veya canlı D1/D3/D7 sonucu bu dosyanın varlığıyla kabul edilmiş sayılmaz.


## İzin penceresi değişikliğinden sonraki yeniden inceleme

Owner talebi: bütün geliştirme tekrar gözden geçirilecek; yalnız izin bileşeni incelenmiş sayılmayacak.

| Doğrulanmış bulgu | Kanıt | Durum |
| --- | --- | --- |
| Anonim ziyaret bearer alımıyla hesabına yükseltilebiliyordu. | Yeni ayrım testi FAIL→PASS. | Hesap ilk ziyareti doğrulanmış kimlikle açılır; anonim kapsam sonradan bağlanmaz. |
| Auth fact callback'i anonim eğitim geçmişini bağlayabiliyordu. | Ayrım ve gerçek auth/placement regresyonları. | Sunucu olguları bağımsız account konteynerine yazılır. |
| Kaynak siparişte anonim hash + gerçek aktör dolaylı bağlantı bırakıyordu. | Gerçek upgrade testi FAIL→PASS. | Korelasyon yalnız aynı doğrulanmış hesabın geçerli ziyareti için alınır. |
| Opsiyonel ziyaret tablosu kilidi, bu doğrulama okumasını bekletebiliyordu. | ACCESS EXCLUSIVE kilitle gerçek oyun komutu FAIL. | Sorguya transaction-local 250 ms statement sınırı eklendi; PASS kontrolü sürüyor. |
| Aynı milisaniyedeki olayların DB sırası game_ready kanıtını silebiliyordu. | Saf rapor testi FAIL→PASS. | Context sequence ile eşit zaman sıralaması. |
| Bir sekme kapanınca diğer açık sekme birleşik oturumu kapalı gösterebiliyordu. | Çok sekmeli rapor testi FAIL→PASS. | Açık context kümesi dikkate alınır. |
| Güvenilmeyen eğitim saati son aşama olabiliyordu. | Saat güveni testi FAIL→PASS. | Güvenilmeyen olay kalite sayacında kalır. |
| Ziyaret anahtarı isteğinin JSON gövdesi zaman aşımından sonra takılabiliyordu. | Takılı ReadableStream testi FAIL→PASS. | Zaman aşımı gövde tüketimini de kapsar. |
| Açık rapor sonradan başlayan ölçümde kaybolabiliyordu. | Hook testi FAIL→PASS. | Yeni kapsamda yalnız gerçekten görünür rapor yeniden yakalanır. |
| Anıt HTTP cevabında oyun alanları kaybolmuştu. | Genel regresyonda 3 FAIL. | Önceki oyun alanları korunur; yalnız 7 yeni iç alan ayıklanır. Yeniden koşuda bu üç test geçti. |

Ham kayıtların anonimliği ile hesaba bağlanmama farklıdır. İstemci gözlemleri bağımsız geçici ziyaretlerde tutulur; IP/altyapı erişim günlükleri için tam anonimlik iddiası yapılmaz. Yeni kullanım bildirimi hukuki inceleme sonucu olarak sunulmaz. Üretim toplaması hâlâ kapalıdır.


### Anıt eşzamanlı okuma bulgusunun doğrulanması

Aynı `parallel reads consistent with physical partial recalls` testi, hiçbir geliştirme içermeyen `afd55bd2` kaynakları `git archive` ile ayrı geçici klasöre çıkarılarak tekrar çalıştırıldı. Baseline da 503/RETRYABLE ile FAIL verdi (44 testten yalnız bu test seçildi). Kanıt: `/tmp/astera-analytics-monument-baseline.log`. Yeni provenance filtre düzeltmesinin sebep olduğu üç oyun sözleşmesi hatası giderildi; kalan paralel okuma bulgusu önceden mevcut ve bu ölçüm değişikliğinin regresyonu değildir. Genel suite bu nedenle tamamen yeşil olarak sunulmaz.

Kilit izolasyonu testinin düzeltme sonrası sonucu PASS: analytics_visitors tablosu ACCESS EXCLUSIVE kilidi altındayken gerçek upgrade komutu 200 döner. Ziyaret doğrulaması transaction-local 250 ms PostgreSQL statement timeout ile başarısızlığa düşer; asıl oyun işlemi çalışır. Bekleyen opsiyonel sorgu bağlantıyı süresiz tutmaz.

### Canlı sürümle birleştirme sonrası doğrulanan join hatası

Canlı API/worker sürümü `f2e4fd3ef2ca8236ef942144d0741727ab46372b` yerel master'a birleştirildi. Canlı webin `release.txt` damgası ayrıca kontrol edildi: `dfa5f5452e7aa1bdab29117837c8cded5c137be2`; önceki web/API eşitliği varsayımı kullanılmadı. Sunucunun yeni bundle paketlemesi nedeniyle ortak analytics API kaynakları Docker'ın build ve CLI runtime aşamalarına eklendi; paketleme testi FAIL→PASS.

Birleşim regresyonunda iki madencilik sözleşmesi testi FAIL verdi. Aynı iki test, ölçüm değişiklikleri içermeyen `51eba411` kaynaklarında PASS verdi; bu bulgu mevcut baseline sorunu olarak kapatılmadı. Drizzle `mapResultRow`, LEFT JOIN'de iç nesnenin ilk seçilen alanı null olduğunda nesneyi yok sayıyor. Nullable `analyticsAttemptId` alanının ilk sıraya eklenmesi, mevcut seferi GET durum yanıtından düşürüyordu. Etkilenen yedi kaynak tabloda `id` ilk sıraya alındı; fiziksel şema veya oyun verisi değişmedi. Gerçek launch/harvest → GET eşitliği testleri düzeltmeden sonra 2 PASS verdi. Bütün kaynak ailelerini içeren son regresyon yeniden çalıştırılıyor.

İlk birleşim koşusunda ortak yerel PostgreSQL'in test sırasında yeniden başlaması ayrıca log ile doğrulandı. Bu koşu kabul kanıtı sayılmadı. Son kontroller göreve ait `astera-analytics-pg-20261102` container'ında, worker başına ayrı geçici veritabanlarında yürütülüyor; başka oturumların PostgreSQL ayarları değiştirilmedi.

### Oyun yaşam döngüsü hata izolasyonu

Yeni hata enjeksiyonu, analytics ön plan callback'inde kimlik üretimi hata verince paylaşılan `watchAppActivity` yayınının sonraki oyun abonelerine ulaşmadığını gösterdi: oyun aboneliği 1 yerine 0 çağrı aldı (FAIL). Yalnız ölçümün activity callback'i hata sınırı içine alındı; ortak oyun yaşam döngüsü değiştirilmedi. Bu, sayfa görünürlüğü/uygulama dönüşü sırasında opsiyonel ölçümün oyun abonelerini durdurmasını önler. Düzeltme sonrası runtime ve genel web regresyonu kabulü aşağıda kaydedilecektir.

## Yayın öncesi son kabul — 2 Kasım 2026

İzin penceresi değişikliğinden sonra bütün kapsam yeniden incelendi. Yukarıdaki doğrulanmış yeni hatalar FAIL→PASS ile kapatıldı. Son kaynaklarda 32 sunucu dosyasında 497 PASS; ayrı koşulan Anıt eşzamanlılık testinde 1 PASS vardır. Aynı test değiştirilmemiş canlı kaynaklarında da PASS verdi. Önceki ortak DB / eski baseline koşularının başarısızlıkları son koşuya taşınmadı; son kabul, izole PostgreSQL üzerindedir.

Web 30 dosyada 404 PASS; son test fixture temizliği sonrasında runtime ayrıca 12 PASS. Hedefli semantik kontrol 49 sunucu ve 70 web dosyasında, lint aynı dosyalar ve iki araç dosyasında PASS. Genel server tsc bellek sınırı nedeniyle tamamlanmadı; genel verify geçti iddiası yoktur. Ölçüm açık/kapalı iki web build ve son 350/390 px + masaüstü tarayıcı kabulü PASS. Görseller ayrıca incelendi. Kanıt: `out/player-analytics/regression/post-join-fix/`, `post-live-merge-final/`, `baseline-evidence/` ve `out/player-analytics/post-live-merge-final-visual/`.

Opsiyonel kimlik üretimi hatası artık paylaşılan yaşam döngüsündeki oyun abonelerini durdurmuyor; runtime hata enjeksiyonu ve genel web regresyonu geçti. Ek izin penceresi yok, anonim geçmiş hesaba bağlanmıyor, ölçüm kimliği bellekte kalıyor.

Kod incelemesi ve yerel yayın öncesi kabul tamamlandı. Canlı yayın kabulü bu Git kaydından ayrı `out/player-analytics/deployment/` ve özel VPS release klasöründe tutulur; bu dosya canlı D1/D3/D7 veya gerçek Android cihaz kabulü iddia etmez. Android/APK ve kaba yük sınırları yukarıda geçerlidir.
