# Yerel Android cihaz denemesi — uygulama notu

> **18 Ekim güncel durum:** Bu belge ilk plan/live-reload denemesinin tarihsel kaydıdır. Geçerli bundled oturum kararı Android Keystore / ileride iOS Keychain + ortak API'dir; aşağıdaki eski native-cookie adayı uygulanmış mimari değildir. Gerçek cihaz/production kanıtı [uygulama günlüğünde](mobile-implementation-log-2026-10-17.md), son düzeltmeler ve kalan kabul adımları [code review kaydında](mobile-code-review-2026-10-18.md). Android yayını önce, iOS sonra.

## Gereksinim ve kapsam

Kullanıcı Android telefonunda mevcut oyunun tıklama, FPS ve klavye davranışını görmek istiyor. Commit edilmemiş bütün yerel değişiklikler dahil. İlk APK yerel sunucuyu açacak; kaynak snapshot'ı veya eski dist kullanılmayacak. Backend ve oyun davranışı değiştirilmeyecek.

Dokunulacak alanlar: web paketine Capacitor bağımlılıkları ve debug yapılandırması, native Android kabuğu, tekrar üretme/kurulum komutları ve kullanım notları. Mevcut kaynaklar korunacak. Web auth, SSE, ödeme veya gameplay mantığına bu aşamada müdahale edilmeyecek.

## Happy path ve sınırlar

- USB ile localhost:5173 reverse → APK → mevcut çalışma ağacı → aynı origin API.
- USB yoksa açıkça belirtilen LAN adresiyle ayrı debug APK üretilebilir.
- Yapılandırma yalnız açık debug opt-in ile çalışır; public URL, kullanıcı bilgisi, path/query/hash içeren endpoint reddedilir.
- Native release variant kapalıdır; yanlışlıkla geliştirme URL'siyle mağaza paketi üretilemez.
- SDK/ADB eksikliği, yetkisiz cihaz, sunucu/API kapalı olması ve ağ kopması görünür hata olarak ele alınmalı.
- Native keyboard resize, safe area, geri tuşu ve donanımsal hızlandırma cihazda kontrol edilecek.
- FPS için mevcut Menü → Kare hızı özelliği kullanılacak; yeni ölçer eklenmeyecek. Bekleyen galaksi yaklaşık 24–30 FPS hedeflediğinden her düşük sayı GPU yetersizliği anlamına gelmez.

## TDD ve doğrulama

Önce `test/mobile-config.test.ts` eklendi. İlk çalıştırma yapılandırma dosyası bulunamadığı için FAIL verdi. Ardından yapılandırma uygulanacak ve aynı testler PASS olmalı. Native derleme ve release variant'ın kapalı olması Gradle ile ayrıca kanıtlanacak. Olağan repo kontrolleri sırayla, tek worker ve en fazla 4 GiB Node heap ile; uzun simülasyonlar hariç.

İlk kontrol: Vite :5173 açık, API :3100 kapalı; mevcut yerel PostgreSQL var. Java 21 ve ADB hazır, SDK kuruluyor. Cihaz test sonucu ölçülmeden FPS/klavye başarılı sayılmayacak.

## Gerçek cihazdan ilk sonuçlar

- Samsung SM-S901E, Android 16, Android System WebView 155.0.8059.43.
- SDK ve tam JDK 21 kuruldu; mevcut runtime-only Java kurulumunda `javac` bulunmuyordu. JDK: `$HOME/.local/share/astera/jdk-21`.
- Yerel DB migrasyonları uygulandı, API/worker :3100 başlatıldı. Mevcut Vite :5173 kullanılmaya devam edildi; veritabanı/hesaplar sıfırlanmadı.
- Capacitor 8.5.3 debug APK başarıyla derlendi, debug imzası doğrulandı ve USB üzerinden telefona kuruldu. Boyut yaklaşık 4,2 MB; oyun dosyaları bu APK içinde değil, Vite'dan geliyor.
- Native bridge `isNativePlatform() === true`; WebView adresi `http://localhost:5173/`.
- İlk açılış ve giriş penceresi cihazda görüntülendi. Fiziksel ADB dokunuşuyla klavye açıldı, `APK_TEST` yazısı girildi ve sonra temizlendi; form gönderilmedi. Klavye açıkken viewport 780 → 407 CSS px; giriş alanı görünür. Android geri tuşu klavyeyi kapattı, viewport 780 px'e döndü ve giriş penceresi açık kaldı.
- FPS göstergesi mevcut modül üzerinden açıldı. Eğitimde alınan ilk ölçüm esnasında kullanıcı ana oyuna geçtiği için o örnek performans sonucu olarak kullanılmadı.
- Kullanıcı kontrollü ana galaksiden sonraki 10 saniyelik örnek: 27, 23, 29, 29, 27, 28, 24, 29, 28, 27 FPS. Her örnekte sayfa görünür, yükleme kapalı, canvas mevcut ve WebGL context kaybı yok. Kısa/sakin sahne ölçümüdür; uzun oynanış veya yoğun savaş performansını kanıtlamaz.
- Kanıtlar `out/android/` altında: açılış/giriş/klavye ekran görüntüleri, FPS JSON dosyaları ve paylaşılabilir `astera-local-debug.apk`.
- Başlangıç logunda Capacitor SystemBars'ın DOM hazır olmadan safe-area değişkenlerini yazma hatası iki kez gözlendi. Sonraki ölçümde top=27px/bottom=15px değişkenleri mevcut ve UI açılıyor. Framework'ün [Android 16 için açık kaydı](https://github.com/ionic-team/capacitor/issues/8530) ile eşleşiyor; bu ilk denemede üçüncü parti framework'e yama eklenmedi.
- `:app:assembleRelease` görevi bulunmadığı doğrulandı; debug sunucusuyla yanlışlıkla release artifact üretilemiyor.
- Wrapper sözleşme testleri: 19/19 PASS. Tüm workspace typecheck'leri tamamlandı; web typecheck'i varsayılan yaklaşık 2 GiB heap'te OOM verdiğinden izinli 4 GiB sınırıyla tekrar çalıştırıldı ve PASS oldu. Geniş lint/test sonuçları tamamlanınca ayrıca kaydedilecek.
