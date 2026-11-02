# Oyuncu ölçümü — yayın öncesi uygulama durumu

Kapsam: [18 adımlı plan](oyuncu-davranisi-ve-retention-olcum-plani-2026-11-02.md). Bulgular ve tekrar üretim kanıtları: [son inceleme](oyuncu-olcum-son-review.md). Bu belge 2 Kasım 2026 tarihli yayın öncesi kayıttır; canlı kabul kanıtı ayrıca dağıtım artefaktına yazılır.

## Uygulanan kapsam

- Anasayfa görünümü, Play ve giriş tıklaması, gerçek eğitim hazırlığı/yükleme hatası ayrı gözlenir.
- Eğitim 11 ana adımdır; 37 alt sahne teşhis ayrıntısıdır. Eğitim, tekrar, arena ve strateji oyunu ayrı bağlamlardır.
- Gerçek sahne hazırlığı, ön plan/arka plan, etkileşim, görünür yüzey, görülen engel/sonuç ve sınırlı teknik hata/performance kodları kaydedilir. Kesin çıkış nedeni veya arka planda kalan bilinmeyen süre üretilmez.
- İnşa, araştırma, filo, madencilik, ticaret, korsan ve Anıt kaynakları değişmez kabul zamanı/aktör/provenance taşır. Sunucu kabulü, etkili tamamlanma ve ekranda görülen sonuç ayrı kalır.
- Kalıcı kaynak recovery'si tekrarlı çalışmada tek olgu üretir. Kaynak toplama gibi kalıcı sipariş taşımayan yanıtlar `response_confirmed` olarak ayrılır; process kill altında aynı garanti verilmez.
- Bildirim ledger durumu, FCM sağlayıcı kabul/ret sonucu, cihazdaki planlama ve açılış ayrı gözlenir. Sağlayıcı kabulü cihaz teslimi sayılmaz.
- Admin: 24/48/72 saat yokluk, 30 günlük zaman çizelgesi, ölçülmüş süre/oturum, ilk 24 saat dönüşü, olgunlaşan D1/D3/D7, sürüm/platform/dil/kampanya kesitleri ve eksik veri göstergeleri. Hesap sayfası en çok 50, olay sayfası en çok 200 kayıt; hesap başına 1000 olay özet sınırı aşılırsa toplamlar bilinmiyor kalır.
- Anonim ziyaretler ayrı korumalı admin endpoint'lerinde incelenir. Yönetici ve otomatik hesaplar oyuncu raporu paydalarından çıkarılır; bu ayrım oyuncuya açık API'lere taşınmaz.

## Owner'ın son kimlik kararı

Oyun ölçümü için ayrı başlangıç izin penceresi yoktur. Anonim ziyaret geçmişi, kayıt/giriş sonrasında oyuncu hesabına bağlanmaz. Hesaplı ziyaret doğrulanmış kimlikle ayrıca açılır; sunucu olguları kendi hesap konteynerinde kalır. İstemci ölçüm kimliği/kuyruğu yalnız sayfa belleğindedir; eski ölçüm storage anahtarları temizlenir, oyun kurtarma kaydı korunur.

Menü ve public footer'da ölçümü kapatma seçeneği vardır. Mevcut Google tercihi ve OS bildirim istemleri korunur. TR/EN gizlilik/çerez ve KVKK sayfalarında kapsam, ayrım, kapatma ve saklama anlatılır. Bu değişiklik hukuki uygunluk onayı olarak sunulmaz.

Ham gözlemler ve günlük toplamlar 30 günlük sınırla temizlenir. İzin/tercih geri alındığında ziyaret, ham gözlemler ve siparişlerin opsiyonel ziyaret/deneme bağlantısı silinir. Hesap silme, başka oyuncunun dünyasında yaşayan siparişin silinen aktör metadata'sını da temizler; oyun emri korunur.

## Oyun ve canlı sürüm izolasyonu

0218–0226 migration'ları eklemelidir; eski satırlar geriye dönük manuel işlem veya yeni ziyaret gibi etiketlenmez. Ölçüm alımı oyun presence/progress saatini yenilemez. İstemci kuyruk/batch/bellek/hata ayrıntısı sınırlıdır. Opsiyonel doğrulama sorgusuna 250 ms PostgreSQL statement timeout uygulanır; gerçek tablo kilidi altında oyun komutunun 200 dönmesi test edildi. Yaşam döngüsü ölçüm hatasının oyun abonelerini durdurması da FAIL→PASS ile kapatıldı.

Canlı API/worker `f2e4fd3ef2ca8236ef942144d0741727ab46372b` kaynakları master'a birleştirildi. Canlı web damgası ayrıca `dfa5f5452e7aa1bdab29117837c8cded5c137be2` bulundu. Kapasite/bundle/Drizzle iyileştirmeleri korunur; arena sürümü ayrı tutulur. Bundle ve kaynak CLI'lar için ortak analytics dosyaları Docker'a dahil edildi. Çalışma yerel `master` üzerindedir.

## Son kabul kanıtları

- Sunucu: 32 dosyada 497 PASS; ayrı koşulan Anıt eşzamanlı okuma testi 1 PASS. Aynı tek test değiştirilmemiş canlı kaynaklarında da PASS. İlk koşudaki iki gerçek madencilik regresyonu kapatıldı; 104 API sözleşmesi testi son koşuda tamamen PASS.
- Web: 30 dosyada 404 PASS. Son runtime test fixture temizliği sonrasında ayrıca 12 PASS.
- Hedefli semantik tip kontrolü: değişen 49 sunucu ve 70 web dosyasında PASS. Tam sunucu `tsc --noEmit`, 2048 MiB sınırında belleksizlik nedeniyle tamamlanmadı; genel `pnpm verify` geçti iddiası yoktur.
- Son lint: 49 sunucu, 70 web ve 2 araç dosyasında PASS. Ölçüm kapalı/açık iki web build PASS. 350/390 px ve masaüstünde son tarayıcı kabulü PASS; mobil admin ve anasayfa ekran görüntüleri ayrıca incelendi.
- Kaba yük: 1000 bağlam, 14.000 farklı olay; kısmi driver'da istek hata satırı yok, son RSS 418.328 KiB ve ortalama CPU %12,8. Owner talimatıyla uzun profil durduruldu; p95/p99 veya tam burst kabulü iddiası yoktur.
- Android: gerçek session Java kaynakları bridge dahil doğrudan derlendi; izole session/HTTP JUnit altında 19 PASS. Tam Gradle/APK kabulü eksik JDK/Firebase araçları nedeniyle tamamlanmadı; bağlı gerçek cihaz yok. Gerçek cihazda soğuk açılış/bildirim teslimi kabulü verilmedi.

Ortak yerel PostgreSQL'in yeniden başladığı koşu kabul edilmedi. Son sunucu regresyonu göreve ait ayrı PostgreSQL container'ında, worker başına ayrı DB ile tamamlandı; bu DB/container'lar temizlendi. Başka oturumların DB veya süreçleri durdurulmadı. Kanıtlar `out/player-analytics/regression/` altındadır.

## Yayın kabulü

Yayın yetkisi owner tarafından verildi. Yayın öncesinde temiz/push edilmiş tek SHA, server ve web artefaktları, taze yedek, yedeğe migration provası, eski/yeni okuma-yazma uyumluluğu ve kilit sınırı doğrulanır. Sonra API'ler sırayla, tek worker en son yenilenir; eski hashed web dosyaları korunur. Canlı hesap veya sezonlarda test yerleşimi, wipe veya adoption çalıştırılmaz.

Canlı sağlık, kuyruk, şema, sürüm, CSP, eski sekme ve dış erişim kabulü `out/player-analytics/deployment/` ile VPS'teki özel release klasöründe tutulur. Önceki imaj/web/ayar/yedek korunur. Eski DB yedeği yeni oyuncu yazılarının üstüne rutin rollback olarak geri yüklenmez. İlk canlı D1/D3/D7 sonuçları ancak ilgili gözlem pencereleri olgunlaştığında değerlendirilebilir.
