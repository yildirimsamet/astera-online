# Astera Online — Android APK ve iOS uygulama planı

Tarih: 16 Ekim 2026. Bu çalışma plan ve araştırmadır; uygulama kodu, paketler ve sunucular değiştirilmedi. Sürüm ve mağaza kuralları yayın tarihinde yeniden doğrulanmalıdır.

## Karar

Mevcut React/Vite/Three.js istemcisini Capacitor 8'in güncel kararlı sürümüyle Android ve iOS uygulamalarına paketle. Ionic UI zorunlu değil. Oyun arayüzü, görseller, oyun kuralları ve mevcut sunucu kullanılmaya devam edecek. Capacitor JavaScript'i native render motoruna dönüştürmez; oyun Android WebView ve iOS WKWebView içinde çalışır. Gerçek cihaz performansı kabul koşuludur.

İlk hedef kullanıcının Android telefonunda kurulabilen APK. Sonraki hedefler paketlenmiş Android test sürümü, Google Play yayını ve aynı web istemcisinden iOS/TestFlight/App Store sürümü.

| Seçenek | Bu proje için değerlendirme |
| --- | --- |
| Capacitor | Android ve iOS, mevcut web arayüzü, ihtiyaç oldukça native API ekleme. Tercih. |
| TWA/Bubblewrap | Android için uygun alternatif; web origin modeline yakın, fakat iOS hedefini çözmüyor. |
| PWA | Mevcut manifest ve ikonlarla tarayıcıdan kurulum imkânı; istenen APK ve iki mağaza hedefinin karşılığı değil. |
| React Native / Flutter / Unity | Mevcut arayüz ve WebGL katmanında kapsamlı yeniden çalışma doğurur; bu hedef için gerekli değil. |

Kaynaklar: [Capacitor kurulumu](https://capacitorjs.com/docs/getting-started), [Android TWA](https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities).

## Koddan doğrulanan başlangıç durumu

- `apps/web`: React 19, Vite 6, Three.js ve React Three Fiber.
- `apps/server`: Fastify, PostgreSQL ve Redis tabanlı mevcut multiplayer backend. Backend APK'ya taşınmayacak; oyun çevrimiçi kalacak.
- Capacitor/native Android/iOS projesi henüz yok.
- `apps/web/public/manifest.webmanifest`: portrait ve standalone; uygulama ikonları mevcut. Native ikon/splash üretimi ayrıca yapılacak.
- `apps/web/src/api/client.ts`: `baseUrl` enjekte edilebilir; varsayılan boş. İstekler ve SSE `credentials: 'same-origin'` kullanıyor.
- `apps/server/src/routes/auth.ts`: access token bellekte, refresh token `HttpOnly`, `SameSite=Lax` cookie içinde; production'da `Secure`.
- Canlı veri WebSocket değil; `fetch` + `ReadableStream` üzerinden Bearer token ile SSE. Global fetch değişimi bunu kırabilir.
- `apps/web/vite.config.ts` ve nginx, aynı origin modelini varsayıyor. Nginx CSP nonce yerleştiriyor; paketlenmiş dosyalar nginx'ten geçmeyecek.
- Safe area/viewport desteği, görünürlük değişiminde yenileme ve bazı WebGL context kaybı mekanizmaları var. Native cihazda yeniden doğrulanmalı.
- Paddle, Polar ve Shopier ödeme kodları; build sırasında eklenen AdSense/H5 Games Ads var. Kodun bulunması, servislerin canlı ve etkin olduğunu kanıtlamaz.
- Hesap silme servisi ve DM engelleme uçları mevcut. Mağaza gereksinimlerinin uçtan uca karşılandığı bu incelemede doğrulanmadı.
- Ölçülen mevcut `public` yaklaşık 139 MB, mevcut `dist` yaklaşık 142 MB. Bunlar kaynak/çıktı klasörü boyutları; APK/AAB indirme boyutu değil ve `dist` bu çalışma sırasında yeniden üretilmedi.
- Bilgisayar: Node 24.11.0, pnpm 9.15.4, Java 21, ADB ve sistem Gradle var. `ANDROID_HOME=/home/yildirim/Android/Sdk`, fakat klasör bulunmuyor; standart konumlarda Android Studio tespit edilmedi. SDK kurulumu gerekli. Sistem Gradle yerine üretilen projenin Gradle wrapper'ı kullanılacak.
- Çalışma ağacında çok sayıda mevcut değişiklik var. Uygulama sırasında bunlar korunacak; APK'nın hangi kaynak anından üretildiği kaydedilecek.

## Aşama 1 — Hızlı cihaz denemesi

1. Telefon modeli, Android sürümü ve güncel WebView/Chrome sürümünü kaydet. Capacitor 8 minimum Android API 24 ister; oyunun fiili cihaz tabanı performansla belirlenecek.
2. Android SDK command-line tools, platform-tools, API 36 platformu ve uyumlu build-tools kur. İstenirse Android Studio 2025.2.1 veya yenisiyle debug yapılabilir; CLI build için IDE zorunlu değil.
3. Capacitor core/CLI/Android sürümlerini aynı uyumlu sürüm ailesinde sabitle. Önce Android projesini oluştur; iOS bağımlılıklarını sonraki aşamada ekle.
4. Önerilen yerleşim: yapılandırma `apps/web/capacitor.config.ts`, native projeler `apps/web/android` ve ileride `apps/web/ios`. Release `webDir` değeri `dist`.
5. Kimlik adayı: `space.asteraonline.app`; geliştirici/domain sahipliğiyle kesinleştir. Test uygulaması ayrı `.debug` kimliği kullanabilir. Production uygulama kimliği mağazaya ilk yüklemeden önce kesinleşmeli.
6. Yalnız debug yapılandırmasında `server.url` ile yerel Vite sunucusunu aç. USB için `adb reverse tcp:5173 tcp:5173`; WebView adresi `http://localhost:5173`. Böylece mevcut `/api` proxy ve giriş çerezi aynı origin'de kalır. Alternatif aynı Wi-Fi üzerinden bilgisayarın LAN IP'si; mevcut `pnpm phone` adresi gösterir.
7. HTTP izni yalnız debug'a ait olacak. Yerel backend/DB ile test et; production'da test hesabı/oyun işlemi oluşturma.
8. Gradle `assembleDebug` ile APK üret. USB hata ayıklamayı açıp cihazı yetkilendirerek `adb install -r <apk>` ile kur; alternatif dosyayı telefona aktarıp ilgili kaynağa kurulum izni ver.
9. Açılış, giriş, galaksi/zoom/dokunma, filo hareketi, ses, klavye, Android geri tuşu ve 15–20 dakikalık oynanışı kontrol et. FPS, ısınma, bellek/context kaybı ve siyah ekran gözlemlerini kaydet.

**Çıktı:** Telefonda çalışan debug APK ve kısa cihaz test raporu. Bu ilk demo bilgisayar/Vite açıkken çalışır; mağaza mimarisinin veya bağımsız çalışan test sürümünün tamamlandığını göstermez.

Capacitor `server.url` seçeneğini geliştirme/live reload için tanımlar; release mimarisi buna dayanmayacak. Kaynaklar: [Capacitor yapılandırma](https://capacitorjs.com/docs/config), [Capacitor 8 gereksinimleri](https://capacitorjs.com/docs/updating/8-0), [Android CLI build](https://developer.android.com/build/building-cmdline).

## Aşama 2 — Dosyaları APK içinde taşıyan sürüm

Hedef mimari: **paketlenmiş React/Three.js dosyaları → HTTPS API + SSE → mevcut backend**. Bu sürüm test sunucusu erişilebilirken bilgisayara bağlı kalmadan Wi-Fi ve mobil veriyle çalışmalı. Backend adresini değiştirmek gerekiyorsa altyapı/deploy ayrıca ele alınacak.

### Ağ ve oturum — önce doğrulama deneyi

Paketlenmiş istemci varsayılan olarak Android'de `https://localhost`, iOS'ta `capacitor://localhost` origin'inden açılır. Mevcut göreli `/api` adresleri uzak backend'e ulaşmaz; yalnız base URL eklemek de refresh cookie'yi çözmez.

Öncelikli ve en az sunucu değişikliği gerektiren aday:

- Native giriş/kayıt/claim/refresh/logout işlemleri için açıkça çağrılan native HTTP adaptörü ve native cookie jar kullan; mevcut HttpOnly refresh-cookie sözleşmesini koru. Oturum açan tüm uçları kapsa, yalnız login'i değiştirme.
- Normal API ve SSE isteklerini mevcut Bearer token ve WebView fetch üzerinden yürüt. Native akışta tarayıcı çerezine dayanma; web akışını koru.
- Backend'de yalnız tanımlı uygulama origin'leri için CORS/preflight ekle. Authorization, Content-Type, `x-placement`, `idempotency-key` gibi kullanılan başlıkları kapsa. `x-server-time`, `x-placement` ve gerekiyorsa Date başlığını erişilebilir yap. CORS kimlik doğrulamanın yerini tutmaz.
- Global `fetch`/XHR patch'ini açma; SSE'nin parça parça akışı, iptal ve yeniden bağlanma davranışını koru.
- Native cookie kalıcılığı, doğru host/path, uygulama yeniden açılışı, logout ve refresh-cookie'nin JavaScript'e açılmaması gerçek cihazda kanıtlanmalı. iOS cookie davranışını Android sonucundan çıkarma.
- Bu aday cihaz doğrulamasını geçmezse fallback: mevcut web auth'u koruyup native oturum uçları ve Android Keystore/iOS Keychain destekli saklama ekle. Refresh token localStorage veya sıradan Preferences içine konmayacak. Bu fallback ayrı test ve kapsam gerektirir; wrapper kurulumunun otomatik çözdüğü varsayılmayacak.

Bu deney paketlenmiş sürüm için bir geçiş koşuludur. Kaynaklar: [Native HTTP](https://capacitorjs.com/docs/apis/http), [Capacitor Cookies ve iOS kısıtları](https://capacitorjs.com/docs/apis/cookies).

### Build ve uygulama davranışı

- Web/native build hedeflerini ayır. Native build'de API adresi zorunlu ve HTTPS olsun; release içine `server.url`, debug endpoint ve HTTP izni girmesini otomatik kontrol et.
- Native başlangıç HTML/CSP'sini nginx nonce değiştirmesine bağımlı bırakma. Script, font, model, WASM/decoder, worker/blob ve video yollarını paket içinde doğrula; CSP'yi gereksiz gevşetme.
- İlk paketlenmiş denemede ödeme/reklam kapalı olsun. Mevcut native kullanıcının sahip olduğu kozmetikleri görüntüleme/equip akışı bundan ayrı değerlendirilecek.
- Android geri tuşu önce klavyeyi/üstteki paneli kapatmalı; oyun kökündeki çıkış davranışı açıkça tanımlanmalı. Android 16 edge-to-edge, çentik ve alt gesture alanı doğrulanmalı.
- Native app lifecycle olaylarını mevcut yeniden bağlanma/yenileme mekanizmasına bağla. Arka planda JavaScript'in sürekli çalışacağı varsayılmayacak; server oyunu sürdürür, dönüşte istemci gerçeği yeniden okur.
- Linkler güvenli şekilde sistem tarayıcısında açılsın; uygulama içi keyfi gezinme native bridge'e erişmesin. PWA yükleme ve tarayıcı fullscreen çağrılarını native deneyime uyarla.
- İkon, splash, koyu başlangıç zemini, klavye davranışı, audio interruption ve bağlantı hatası ekranı tamamlanmalı. İnternetsizken sahte oyun durumu sunma.
- 139 MB public klasörünün hangi dosyalarının ilk paket için gerekli olduğunu ölç. Önce çalışan paket çıkar; gerekiyorsa kullanılmayan dosyaları dışla veya büyük içerikler için sürümlü uzak indirme tasarla. İmzalı release boyutu ve açılış süresi ölçülmeden optimizasyon kapsamını büyütme.
- Web dosyaları uygulamayla güncellenir; backend bağımsız yayınlanabilir. Eski mobil istemciler için API uyumluluğu/sürüm politikası tanımlanmalı. İlk sürümde OTA JavaScript güncelleme altyapısı gerekli değil.

### Test ve kabul koşulları

Repo kuralı: davranış kodunda TDD. Önce sözleşme/regresyon testleri FAIL, ardından uygulama ve PASS. Tüm olağan kontroller `pnpm verify` ile, tek workspace/worker, düşük öncelik ve en fazla 4 GiB Node heap ile; uzun ekonomi/simülasyon testleri bu kapsamda çalıştırılmayacak. Frontend değişikliklerini `node tools/visual.mjs` ve gerçek cihazla doğrula.

| Senaryo | Beklenen sonuç |
| --- | --- |
| İlk açılış, kayıt, onboarding claim, giriş | Doğru hesap/galaksi; başarısız cevap anlaşılır |
| Uygulamayı kapatıp açma, token süresi dolması | Oturum politikası içinde hesap korunur; refresh yarışı/döngüsü yok |
| Logout, geçersiz veya silinmiş hesap | Oturum temizlenir; başka hesaba veri sızmaz |
| SSE kopması, 401, uçuş modundan dönüş | Kontrollü yeniden bağlantı ve eksik verinin tekrar okunması |
| Arka plan/ekran kilidi ve Wi-Fi → mobil veri | Sunucu saati, filolar, raporlar ve kaynaklar güncel |
| İşlem sırasında bağlantı kesilmesi/tekrar deneme | Mevcut idempotency davranışı korunur; çift filo/harcama yok |
| CORS ve header erişimi | İzinli origin çalışır, izinsiz origin reddedilir; saat/placement okunur |
| Klavye, geri tuşu, çentik ve gesture alanı | Kritik kontrol örtülmez; panel/klavye doğru kapanır |
| Uzun oynanış/context kaybı | Kullanılabilir FPS ve sıcaklık; siyah ekranda kalmama |
| Aynı değişiklikten web sürümü | Tarayıcı giriş, ödeme ve SSE regresyonları yok |

**Çıktı:** Yerel web dosyaları içeren APK, HTTPS test backend'inde bilgisayardan bağımsız oyun, test kanıtları ve build komutları.

## Aşama 3 — Google Play hazırlığı

- APK cihaz kurulumu içindir; Google Play için imzalı Android App Bundle (AAB), upload key, Play App Signing ve düzenli versionCode üretilecek. Anahtar/parolalar git'e yazılmayacak. [Capacitor yayın rehberi](https://capacitorjs.com/docs/android/deploying-to-google-play).
- Araştırma tarihinde yeni uygulamalar/güncellemeler Android 16/API 36 veya üzerini hedeflemeli. Bu, telefonun minimum Android sürümünden farklıdır. [Google Play target API](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en).
- Kullanılan native kütüphaneler dahil 16 KB page-size uyumluluğu doğrulanacak. [Android gereksinimi](https://android-developers.googleblog.com/2025/05/prepare-play-apps-for-devices-with-16kb-page-size.html).
- Önce internal test; uygun kişisel hesaplarda production erişiminden önce en az 12 kişinin kesintisiz 14 gün katıldığı closed test ve erişim başvurusu gerekiyor. Kural, 13 Kasım 2023 sonrasında açılan kişisel hesaplara uygulanır; APK'yı kendi telefonuna kurmak için gerekmez. [Resmi test kuralı](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).
- Privacy policy, Data safety, reklam beyanı, içerik/yaş derecelendirmesi, destek adresi, inceleme erişimi ve telefon ekran görüntüleri hazırlanacak.
- Hesap oluşturma varsa uygulama içinden silme ve uygulama dışından erişilebilen silme başvuru yolu doğrulanacak. [Google hesap silme](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en).

## Aşama 4 — iOS / TestFlight / App Store

- Aynı web/native adaptör mimarisi için Capacitor iOS projesi üretilecek. macOS + uygun Xcode gerekir; yerel Linux'ta iOS binary üretilemez. Mac veya macOS CI kullanılabilir; gerçek iPhone testi gerekir. Capacitor 8 tabanı Xcode 26+, minimum iOS 15; güncel Apple submission SDK şartı upload öncesinde ayrıca doğrulanacak. [Ortam gereksinimleri](https://capacitorjs.com/docs/getting-started/environment-setup).
- Signing, bundle ID ve App Store Connect tamamlanacak; TestFlight → gerçek iPhone testi → inceleme sırası izlenecek.
- Apple 4.2 açısından gerçek oyun deneyimi, tam ekran gezinme, hata/bağlantı yönetimi ve cihaz entegrasyonu gösterilecek; Capacitor kullanmak otomatik ret veya kabul anlamına gelmez. Hesap silme, chat için raporlama/engelleme/moderasyon ve destek erişimi doğrulanacak. [Apple inceleme kuralları](https://developer.apple.com/app-store/review/guidelines/).
- Privacy beyanları, kullanılan SDK'ların privacy manifest gereksinimleri, yaş derecelendirmesi ve varsa tracking için gerekli izinler kullanılan SDK/veri akışına göre hazırlanacak.

## İki mağaza için ödeme, reklam ve bildirim kapsamı

- İlk cihaz testi ve ilk ücretsiz mağaza sürümü için ödeme kapalı yaklaşımı en küçük kapsamdır. Native ekranda Paddle/Polar/Shopier ödeme linki veya dışarıdan satın alma yönlendirmesi otomatik olarak korunmayacak.
- Uygulama içinde skin/kozmetik satışı açılacaksa varsayılan yol Google Play Billing ve Apple IAP. Ülke/program bazlı istisnalar var; belirli bir pazarda alternatif ödeme kullanılacaksa koşulları ayrıca doğrula. Backend satın alma doğrulaması, ürün → kozmetik eşlemesi, tekrar teslimin önlenmesi, restore/refund/revocation süreçleri gerekir. [Google Payments](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en), [Apple ödeme kuralları](https://developer.apple.com/app-store/review/guidelines/).
- Mevcut AdSense script'i native reklam entegrasyonunu tamamlamaz. İlk native sürümde reklamı kapat; sonra AdMob veya uygun WebView entegrasyonu, test reklamları ve consent akışını ekle. H5 Games Ads'in belgelenmiş uygulama entegrasyonu Android kapsamındadır; iOS'ta aynı sonucu varsayma. [H5 Games Ads](https://support.google.com/adsense/answer/9959170?hl=en), [WebView API for Ads](https://developers.google.com/admob/android/browser/webview/api-for-ads).
- Push ilk APK için gerekli değil. Sonraki kapsam: Android FCM ve iOS APNs, kullanıcı izni, cihaz token kayıt/silme, server-side bildirim, gizlilik/tercihler ve doğru ekrana yönlendirme. SSE yalnız açık uygulamadaki canlı kanal olarak kalır; uygulama kapalıyken push yerine geçmez.

## Hesaplar, maliyet ve uygulama sırası

- Kişisel Android debug APK için mağaza hesabı/ücreti gerekli değil.
- Google Play geliştirici kaydı: tek seferlik 25 USD; Apple Developer Program: yıllık 99 USD veya mevcut yerel fiyat. Vergi/bölge ve Mac/CI maliyetleri ayrı. [Google kayıt](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en), [Apple üyelik](https://developer.apple.com/programs/).
- Kullanıcıdan beklenen bilgiler: Android marka/model/sürüm, mevcut geliştirici hesapları ve iOS için Mac erişimi. Bu bilgiler planı engellemez; gerçek cihaz testi ve mağaza hesabı işlemleri ilgili aşamada kullanıcı katılımı ister.
- Uygulama sırası: **SDK → debug wrapper APK → cihaz performansı → paketlenmiş oturum/API deneyi → bağımsız test APK → Google Play test/yayın → iOS/TestFlight/yayın**.
- Mağaza hesabı doğrulaması, ücret ödemeleri, gerçek cihaz yetkilendirmesi ve mağazaya gönderim için gereken kullanıcı işlemleri uygulama sırasında somut çıktılar hazırlandıktan sonra ele alınacak. Bu plan mağaza inceleme onayı veya belirli teslim süresi garantisi değildir.
