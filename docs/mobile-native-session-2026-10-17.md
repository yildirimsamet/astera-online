# Native oturum sözleşmesi — 17 Ekim 2026

Durum: backend/istemci/Android uygulaması ve bundled local APK eklendi; Android'de Keystore/bridge/process-kill/offline logout cihaz kontrolleri geçti. HTTPS/USB'siz kullanım, iOS ve M1'in kalan kabulü açık. Ayrıntılı test/cihaz kanıtı [geliştirme günlüğünde](mobile-implementation-log-2026-10-17.md). Web cookie oturumu ve mevcut username/doğrulanmış email kimlik politikası korunur. Aynı backend ve hesaplar kullanılır; yeni sosyal login/OAuth sistemi kurulmaz.

## Sınır

Native login/register/claim/refresh/logout ayrı uçlar kullanır. Android'de dar yerel Capacitor plugin'i HTTP oturum işlemini yapar; uzun credential Android Keystore anahtarıyla AES-GCM şifrelenir ve app-private saklanır. JavaScript'e yalnız kısa access token ve şemayla doğrulanan oturum/claim sonucu döner. `getRefreshToken` gibi genel bir getter ve genel amaçlı authenticated native HTTP arayüzü yoktur. iOS aynı JS sözleşmesini Keychain ile gerçekleştirecek; Android sonucu iOS kanıtı değildir.

Yerelde eklenen, henüz production'a yayınlanmayan uçların hepsi POST:

| Yol | İşlev |
| --- | --- |
| `/api/native/auth/login` | Ortak hesaba cihaz oturumu aç |
| `/api/native/auth/register` | Ortak hesap sisteminde kayıt |
| `/api/native/onboarding/claim` | Academy ilerlemesini ortak hesap/gezegene geçir |
| `/api/native/auth/refresh` | Cihaz oturumunu aynı persisted current/next ikilisiyle yenile |
| `/api/native/auth/logout` | Yalnız bu cihazın oturumunu iptal et |

`/api/auth/me`, `/api/stream` ve oyun API'leri ortaktır. `/api/native/auth/me` veya platforma özel filo/inşaat/sohbet backend'i oluşturulmadı. Native uçlar `NATIVE_AUTH_ENABLED` açıkken kayıt edilir.

Normal API/SSE WebView fetch ile Bearer kullanır; native'de cookie credentials gönderilmez. Global fetch/XHR patch açılmaz. Admin medya XHR'ı da cookie göndermez. CORS yalnız açıkça seçilen app origin'lerine izin verir; Authorization, Content-Type, x-placement, idempotency-key yanında kodun gerçekten kullandığı **x-astera-cosmetics ve x-media-type** unutulmaz. `x-server-time`, `x-placement`, Date erişimi ve Vary: Origin test edilir. CORS kimlik doğrulama değildir.

## Per-device session ve rotation kararı

- DB'de hesap, account authVersion snapshot'ı, session UUID, mevcut/önceki refresh SHA-256 özetleri, expiry ve revoke durumu tutulur. Ham refresh credential DB'ye/log'a girmez. Hesap silinmesi session'ı cascade temizler.
- İlk credential sunucuda 256-bit rastgele üretilir. Native istemci her yenileme için bir sonraki 256-bit credential'ı CSPRNG ile üretir; **mevcut + sonraki** ikilisini ağ isteğinden önce güvenli saklamaya atomik yazar. Refresh isteği sessionId/mevcut/sonraki taşır. Başarılı cevap refresh secret döndürmez; native taraf önceden bildiği sonraki credential'ı kalıcı current yapar.
- Sunucu session satırını kilitler. Mevcut hash eşleşiyorsa rotate eder. Önceki hash ve mevcut hash gönderilen aynı ikiliyi karşılıyorsa bu kaybolmuş cevabın tekrar denemesidir; yeniden rotate etmeden aynı session için access verir. Böylece yanıt kaybı + uzun offline/process kill, bilinmeyen yeni bir credential yüzünden oturumu kaybettirmez. Bu Astera'nın idempotency tasarımıdır; standart tarafından zorunlu tutulmuş bir wire format olduğu iddia edilmez.
- Önceki credential farklı bir next ile yeniden kullanılırsa session iptal edilir. Bilinmeyen token session UUID'sini bilerek iptal ettiremez. Aynı current/next reddedilir; gerçek plugin her zaman taze CSPRNG kullanır. Bir cihazın logout'u diğer cihazın veya web'in oturumunu kapatmaz. Account-wide authVersion değişimi hepsini iptal eder.
- Access JWT native session UUID'sine de bağlıdır. Her auth kontrolünde session aktifliği doğrulanır; SSE event/idle heartbeat de iptali izler. Yalnız refresh'i kapatıp mevcut access/SSE'yi açık bırakma.
- Native logout/hesap değişimi local credential'ı ağ beklemeden temizler ve bekleyen auth işlemlerinin neslini geçersiz kılar. Gecikmiş refresh/login local credential'ı geri yazamaz. Ağ yokken sunucunun iptalini tamamladığını iddia etme; kalıcı revocation kuyruğu ile tekrar deneme ihtiyacı uygulanırken açıkça kaydedilecek.

## TDD kapsamı / dokunulacak alanlar

### Sıradaki uygulama dilimi

Korunmuş sohbet medyası: Web'in cookie kullanan HTML img/video yolu korunur. Native uploaded medya Bearer + credentials omit ile, kanal/messageId erişim kapsamı korunarak alınır; object URL hesap değişimi/logout/unmount'ta iptal edilir. Gecikmiş yanıt eski hesaba ait görüntüyü tekrar açamaz. Image/video MIME ve gerçek akan byte sayısı mevcut 10/50 MB kurallarıyla sınırlanır. Native video oyuncu isteyene kadar indirilmez; fotoğraf görünürlüğe yaklaşınca yüklenir. YouTube mevcut iframe yolunu korur. Ağ/401/abort/boyut/MIME ve URL cleanup senaryoları önce test edilir. Bu değişiklik ortak chat upload veya mesaj erişim yetkisini değiştirmez.

Native paket ayarı tek doğrulanan sözleşmeden Vite/Capacitor'a gider. Web `dist` korunur; native `mobile-dist/<hedef>` kullanır. `native-local` yalnız debug, ayrı `.local` kimlik ve localhost HTTP API istisnası; staging/production HTTPS zorunlu. `server.url` bundled hedeflerde bulunmaz. Release Gradle kapısı henüz açılmaz. Public site HTML/ödeme/reklam scriptleri, dev fixture ve PWA servis worker'ı native çıktıya kopyalanmaz. Paket CSP'si nginx nonce'una dayanmaz, inline boot scriptlerinin SHA-256 hash'lerini içerir. Artifact metadata API/target/source hash taşır, secret taşımaz.

Kurulum sınırı: Gradle tüm debug hedefleri aynı `app-debug.apk` yoluna yazar. Eski `android:install` komutu son build `.local` olsa da `.debug` activity'sini açabiliyordu. Kurulum komutu hedef/APK applicationId'sini **ADB'den önce** doğrulayacak; bundled için export edilen hedef dosyası kullanılacak. Live reload yalnız 5173, native-local yalnız 3100 reverse kurar; uzak hedeflerde USB reverse yoktur. Yanlış/bozuk/eksik artifact fail eder; başka uygulamanın verisi temizlenmez.

Java session motoru JVM testlerinde enjekte edilen store/network ile sınanır: secret saklanmadan access dönmemesi; refresh öncesi next'in kalıcı yazılması; yanıt kaybı/process restart aynı çiftle retry; offline/5xx credential korunması; 401 temizliği; logout/kimlik değişimi sırasında gecikmiş cevabın reddi; offline revocation kuyruğu; storage failure; farklı oturum credential'ının kabul edilmemesi. Android store AtomicFile + Keystore AES-GCM, no-backup dizin ve API/package AAD bağı kullanır. Native HTTP dar operasyon listesi, yönlendirme reddi, süre/boyut sınırı ve yalnız public body/header allowlist'i kullanır. Plugin yalnız bundled yapılandırmada etkinleşir; live-reload cookie akışı değişmez. Secure storage/iframe/kill-relaunch yerel bundled Android cihaz kabulü geçti; HTTPS/USB'siz kullanım ve iOS kabulü açık.

Sunucu: additive native session tablosu + generate edilen migration, native routes/services, ortak claim'in session açma sınırı, TokenService/requireAuth/erken rate-limit kimliği ve SSE, env/CORS, test helper temizliği. İstemci: enjekte edilebilir auth transport, Api auth seçimi ve base URL, credentials sınırı, native plugin registration + güvenli store. Paket: debug/live-reload korunurken ayrı bundled hedef/çıktı; HTTPS staging/production ve yalnız açık native-local geliştirme istisnası, CSP ve artifact negatif kontrolleri. Ürün kimliği/PvP/oyun kuralları değişmez.

Senaryolar: native register/login/claim; web cookie regresyonu; yanlış parola/bozuk gövde; token türü karışması; server DB'de hash/JS'de secret yok; aynı refresh ikilisinin ardışık/eşzamanlı tekrarı; eski credential + farklı next; unknown credential; expiry; hesap sürüm iptali/silme; iki cihaz; logout-refresh yarışı; access/SSE iptali; rate limit; storage failure; decrypt/key invalidation; app update/kill/relaunch; offline logout; yanlış endpoint/redirect/HTTP üretim reddi; response header/log temizliği. Native bridge bulunmaması anlaşılır hata verir, sessizce cookie fallback yapmaz. Canlı hesaba/production DB'ye test işlemi yapılmaz.

## Araştırma kaynakları ve sınırları

### Capacitor'ın global CookieHandler bulgusu

Kurulu `CapacitorCookies.load()` config'te JS cookie patch kapalı olsa da `CookieHandler.setDefault(CapacitorCookieManager)` çağırıyor. Bu yüzden çıplak `HttpURLConnection` bağımsız native cookie sınırı değildir; ilk JVM testindeki default CookieHandler=null, gerçek SDK koşulunu kapsamıyordu. Genel CookieHandler'ı geçici değiştirmek de diğer ağ işlemleriyle yarışır ve kullanılmayacak. Teste global CookieHandler eklendiğinde gönderme/saklama bağımsızlığı önce FAIL verdi; native session HTTP'si ayrı **OkHttp + CookieJar.NO_COOKIES**, kapalı redirect ve aynı boyut/süre/origin sınırlarına geçirildi, ardından PASS. Global fetch/XHR/CookieHandler değiştirilmez. Core `CapacitorCookiesAndroidInterface` yalnız cookie patch sorgulaması/yazma sunar; uzun native credential zaten cookie'ye hiç yazılmaz.

17 Ekim Maven Central metadata'sında OkHttp son kararlı sürüm **5.5.0** (16 Ağustos 2026), fakat Android AAR metadata'sı compileSdk **37** istiyor; API 36 host'unda gerçek build FAIL verdi. **5.4.0** AAR metadata'sı minCompileSdk **36**; mevcut host için bu sürüm sabitlendi. Sırf HTTP istemcisi için Android/AGP tabanı yükseltilmez. Seçilen sürüm build/JVM ve yerel bundled cihaz oturum testleriyle doğrulandı; JavaNetCookieJar bağımlılığı eklenmedi. Kaynaklar: [CapacitorCookies 8.5.3](https://github.com/ionic-team/capacitor/blob/8.5.3/android/capacitor/src/main/java/com/getcapacitor/plugin/CapacitorCookies.java), [OkHttp](https://github.com/square/okhttp), [Maven metadata](https://repo.maven.apache.org/maven2/com/squareup/okhttp3/okhttp/maven-metadata.xml). İlk üretilen 143 MB APK bu düzeltmeden öncedir; nihai cihaz testi için yeniden build gerekir.

### Android bridge için uygulama öncesi ek kontrol

Kurulu Capacitor Android 8.5.3 `MessageHandler.java` incelendi: modern `WebMessageListener` yalnız ana frame mesajlarını kabul ediyor; özellik yoksa veya listener kurulumu exception verirse `addJavascriptInterface` yoluna geri dönüyor. Bu eski arayüzün aynı frame/origin güvencesi olduğu varsayılmayacak. Özellik desteğini kontrol etmek tek başına fallback olmadığını kanıtlamaz. Refresh credential'ı JS'den saklamak, bir alt frame'in plugin üzerinden kısa access token istemesini tek başına engellemez.

Dar oturum plugin'i gerçek credential almadan önce güvenilir ana belgeyi doğrulamalı. İlk aday, ana belgeye geçici nonce enjekte etmekti. SDK çağrı sırası incelenince daha küçük çözüm bulundu: `MessageHandler` kurulduktan sonra, **ilk `loadWebView()` öncesi senkron plugin `load()` içinde** `removeJavascriptInterface("androidBridge")`; modern `WebMessageListener` korunur, legacy fallback kaldırılır. Native credential işlemi için `WEB_MESSAGE_LISTENER` desteği ve kapalı legacy config şarttır. Listener kurulumu başarısızsa arayüz de kalmaz; kimlik doğrulama kullanılamaz, güvensiz fallback açılmaz. Bu sıra ve iframe sınırı cihazda ayrıca kanıtlanacak; aynı origin XSS için CSP ve içerik temizliği ayrıca zorunludur. iOS'ta da frame/origin sınırı ayrıca doğrulanacak. Kaynak: kurulu SDK'nın `Bridge`/`PluginHandle` kodu, [Capacitor MessageHandler](https://github.com/ionic-team/capacitor/blob/8.5.3/android/capacitor/src/main/java/com/getcapacitor/MessageHandler.java) ve [Android WebViewCompat](https://developer.android.com/reference/androidx/webkit/WebViewCompat).

[RFC 9700 §4.14](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14) refresh secret gizliliği, replay algılama, rotation ve iptal ilkeleri için okunmuştur; bu uygulamanın OAuth uyumluluğu iddiası değildir. [Android kriptografi](https://developer.android.com/privacy-and-security/cryptography) AES-GCM/Keystore yönünü ve security-crypto deprecation bilgisini verir. [Capacitor native plugin](https://capacitorjs.com/docs/plugins/android) ve [Fastify CORS](https://github.com/fastify/fastify-cors) entegrasyon kaynaklarıdır. Gerçek header sızıntısı, Keystore kalıcılığı, native log ve stream davranışı bu kaynakların okunmasıyla kanıtlanmış olmaz; test/cihaz kaydı gerekir.

## Uzak logout onayı

Android HTTP decoder yalnız HTTP200 + JSON boolean `ok: true` cevabını iptal onayı sayar. Boş/false/null/string/error/bozuk yanıt IOException üretir; kalıcı revocation kaydı sonraki bağlantıda tekrar denenir. Bu, kullanıcıya gecikmeden verilen yerel logout cevabından ayrıdır: offline local çıkış başarılı olabilirken uzak iptal hâlâ bekleyebilir. Sınır testi RED ardından tüm Android JVM testleri 16/16 PASS (session çekirdeği15, template1); mevcut cihaz kabulündeki APK yeniden üretilmeden bu son düzeltmeyi içermez.
