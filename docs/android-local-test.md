> **18 Ekim son kontrol:** testaccount+adminlesh Silent Space koruması962439cc… ile canlıda doğrulandı;4511 server testi PASS. d5538745… Network DEBUG APK telefona kuruldu; Wi-Fi+cellular otomatik recovery ve native API/SSE PASS. İmzalı AAB77,8MB/bundletool/signature/debuggable=false kabulü ve83 odaklı test PASS; son geniş frontend kontrolü sürüyor. [Güncel durum](mobile-play-upload-status-2026-10-18.md). Alt kayıtlar kronolojiktir.

# Android telefonda yerel Astera denemesi

> **Önceki 18 Ekim ara kontrolü (güncel durum üstte):** Kurulu241de81… APK'da fullscreen/IME Back,30s ses/render pause ve uzun kilit dönüşü geçti. Foreground offline cold-start→Wi-Fi otomatik toparlanması **FAIL** bulundu; yeni native Network kodu109 odaklı ve6.974 tam web testini geçti, yeni79,7MB DEBUG APK d5538745… üretildi,75 paket ve19 JVM testi geçti; **telefona kurulmadı**, cihaz kabulü bekliyor. Review hesabı Silent Space muafiyeti yerelde15 yeni+231 regresyon testini geçti, **production'a henüz uygulanmadı**. [Güncel yükleme/yayın eksikleri](mobile-play-upload-status-2026-10-18.md), [ağ](mobile-native-network-recovery-2026-10-18.md), [review hesabı](mobile-store-review-account-2026-10-18.md), [cihaz](mobile-lifecycle-device-acceptance-2026-10-18.md). Signing/AAB/store kabulü açık; iOS Android yayını sonrasında. Alt kayıtlar kronolojiktir.

Güncel: üç Android test paketi var: eski `.debug` live-reload, `.local` bundled USB API ve gerçek API adresli bundled production DEBUG. Varsayılan yeni export `out/mobile-artifacts/native-production/astera-native-production.apk`: **79.722.140 byte**, lifecycle + varlık temizliği + native Network düzeltmesi, **henüz telefona kurulmadı**; hash/kabul kaydı [burada](mobile-lifecycle-2026-10-18.md). Güncel kurulu sourceHash241de81…; önceki eee467… fullscreen APK arşivdedir. Aşağıdaki ilk açıklama tarihsel live-reload hedefidir; eski boyut/hash/cihaz ifadeleri kronolojiktir.

Bu ilk APK, bilgisayardaki güncel web sunucusunu açar. Commit edilmemiş yerel değişiklikler dahil; kaydedilen web değişiklikleri Vite üzerinden telefona da yansır. APK oyun dosyalarının bağımsız bir kopyası değildir. Bilgisayar, yerel API ve web sunucusu çalışır durumda kalmalı.

## 17 Ekim: dosyaları içinde taşıyan yerel APK

Artık iki ayrı test hedefi vardır. Aşağıdaki yeni `.local` paket oyun dosyalarını içinde taşır; eski `.debug` live-reload paketi aşağıdaki eski komutlarla korunur. Birlikte kurulabilirler. **İkisi de mağaza release'i değildir.** Gerçek cihaz kabulünün sonucu [geliştirme günlüğündedir](mobile-implementation-log-2026-10-17.md).

Yerel DB migration 0185'e gelmeli. Native auth yalnız yerel API sürecinde `NATIVE_AUTH_ENABLED=true` ve `NATIVE_APP_ORIGINS=http://localhost,https://localhost,capacitor://localhost` ile açılır. `.env.example` varsayılanı kapalıdır. **Çalışan sunucu varken ikinci API/worker başlatma**; mevcut süreci doğru ayarla yeniden aç. Production flag'i bütün replikalar ve migration güncellenmeden açılmaz.

```bash
# Repo kökünden; Java JDK 21 ve API 36/build-tools 36.0.0 gereklidir.
export JAVA_HOME="$HOME/.local/share/astera/jdk-21"
pnpm android:bundle native-local
pnpm android:install native-local
```

Bu hedefte varsayılan API `http://localhost:3100`; sadece backend için USB reverse 3100 kullanılır. Vite/5173 gerekmez. **USB'siz ağ testi değildir:** bilgisayarın API'si ve USB reverse hâlâ gerekir. Yerel HTTP istisnası bu debug hedefiyle sınırlıdır. Uzak staging/production hedefi için HTTPS API origin'i zorunludur; erişilebilir test backend'i ayrıca hazırlanmalıdır.

Çıktı: `out/mobile-artifacts/native-local/astera-native-local.apk`, `native-build.json`, `SHA256SUMS`. Uygulama `space.asteraonline.app.local` / **Astera Bundled Local**. Build kaynak ağacını öncesi/sonrası SHA-256 ile karşılaştırır; build sırasında kaynak değişirse artifact teslimini reddeder. Kurulum checksum ve APK kimliğini ADB'den önce doğrular. Args shell'e birleştirilmez. Birden fazla cihazda `ANDROID_SERIAL` kullanılır.

`pnpm android:install` args olmadan hâlâ yalnız `.debug` live-reload paketini bekler. Son Gradle çıktısı `.local` ise yanlış uygulamayı açmak yerine kimlik uyuşmazlığıyla durur; hedefi açıkça ver veya `pnpm android:apk` ile debug paketi yeniden üret. **Bundled artefact'leri genel Gradle çıktı yolundan paylaşma:** tüm debug hedefleri o dosyayı sırayla üzerine yazar. Hedefe ait `out/mobile-artifacts/…` kopyasını kullan.

## 18 Ekim: gerçek production API adresli bundled DEBUG APK

Backend/web `f9378f1c405590942de3c0d7e85c3f7c9d016033` ile yayınlandı. Hedef `https://asteraonline.space`; aynı web hesabı ve dünya kullanılır. Native beş oturum ucu ve CORS açıktır. `https://localhost`, APK içindeki belgenin origin'idir; PC/Vite sunucusu veya uzak API adresi değildir.

```bash
export JAVA_HOME="$HOME/.local/share/astera/jdk-21"
VITE_ASTERA_API_URL=https://asteraonline.space pnpm android:bundle native-production
pnpm android:install native-production
```

Hazır artifact: `out/mobile-artifacts/native-production/astera-native-production.apk`; metadata/SHA256SUMS aynı klasörde. Uygulama kimliği **space.asteraonline.app**, API origin'i HTTPS production. Vite, yerel API ve USB reverse gerekmez. **18 Ekim: Samsung SM-S901E'ye kuruldu ve açıldı; ADB reverse listesi boşken gerçek HTTPS API/CORS kontrolü geçti.** Kablo ADB kurulum/gözlem içindir. Sahibi mevcut hesabıyla giriş yaptı; gerçek Java HTTPS refresh200, ortak API200, SSE200/connected, otomatik kill/relaunch oturumu ve offline kill→Wi-Fi dönüşü geçti. Parolayı isteme/loglama. Fiziksel kablo çıkarma/mobil veri ve kalan shell/medya matrisi açık. IME ilk geriyle doğru kapanıyor; ikinci geri panel yerine uygulamayı arka plana attığından ayrı navigation düzeltmesi yapılıyor.

Build temiz/pushed yukarıdaki SHA'dan geçti. Source hash **fb9ca3a676b155458f9574105a16eb54295ee88bf0da4eccb1d0209259a45d1a**; APK150126022 byte (~143.2 MiB). JVM16/16 PASS; production APK'da embedded `.so` yok. Bu, gelecekteki signed AAB/plugin'lerin 16KB kabulü yerine geçmez. **storeReady=false, Gradle release kapalı; Google Play gönderimi değildir.**

Debug paketinin kimliği gelecekteki mağaza paketiyle aynıdır; normal Play App Signing sertifikası debug sertifikasından farklı olur. Sertifika farklıysa `adb install -r` ile zorlayarak güncelleme/data clear yapma. Mağaza sürümüne geçişte önce çevrimiçi logout, ardından sahibinin katılımıyla yalnız bu test uygulamasını kaldırıp mağaza sürümünü kurma gerekebilir; backend hesabı/dünya silinmez, tekrar giriş yapılır. Upload key ile Play'in app signing key'i ayrı kavramlardır. [Android imzalama rehberi](https://developer.android.com/studio/publish/app-signing).

## 18 Ekim review sonrası yeni paket

Yukarıdaki gerçek telefon sonuçları **eski150126022 byte APK** içindir; metadata/checksum ile `out/mobile-artifacts/production-f937-device-qualified-20261018/` altında arşivlendi. Varsayılan `out/mobile-artifacts/native-production/astera-native-production.apk` artık **152050107 byte yeni DEBUG** pakettir: sourceHash `86257405d2cc79f4a8f5a8604ae5dab5827349335c6b5b300b8389c9613f8d5c`, Git tabanı f9378f1c + commit edilmemiş review düzeltmeleri. Mağaza paketi değildir; aynı production API/hesap kullanılır.

Eğitim API izolasyonu, publisher/wiki HTTPS link'leri, Android panel/focus Back sırası, auth queue timeout ve eski renderer başlangıç yardımı düzeltildi. Paket içeriği/registry/config/CSP doğrulandı; **yeni APK henüz telefonda denenmedi**. Telefon yeniden bağlandığında `pnpm android:install native-production` ile checksum doğrulanan yeni export kurulabilir; kullanıcı verisi temizlenmez. Gerçek IME → panel → root, nested fotoğraf/ülke, browser'a git/dön, kilit/arka plan, fiziksel kablo çıkarma/hücresel ve korumalı medya matrisi ayrıca denenir. Ayrıntı ve son test sonuçları [code review raporundadır](mobile-code-review-2026-10-18.md).

## Yeniden üretme ve kurma

Gerekenler: Node 22+, pnpm, Java **JDK** 21 (`javac` dahil), Android SDK API 36 ve build-tools 36. SDK yolu `ANDROID_HOME` ile tanımlanmalı veya Android projesinin git'e alınmayan `local.properties` dosyasında bulunmalı. Bu bilgisayardaki mevcut Java 21 yalnız runtime içerdiği için tam JDK ayrıca `$HOME/.local/share/astera/jdk-21` içine kuruldu.

```bash
# Sunucular zaten çalışıyorsa tekrar başlatma.
pnpm start

# Ayrı terminalde, repo kökünden:
export JAVA_HOME="$HOME/.local/share/astera/jdk-21"
pnpm android:apk
pnpm android:install
```

`android:install`, USB reverse bağlantısını oluşturur, APK'yı kurar ve **Astera Local** uygulamasını açar. Telefonda Geliştirici seçenekleri → USB hata ayıklama açık olmalı; bilgisayara izin sorusunu onayla. Birden fazla telefon bağlıysa `ANDROID_SERIAL` ile cihaz seç.

APK: `apps/web/android/app/build/outputs/apk/debug/app-debug.apk`.

Kurulu uygulama kimliği: `space.asteraonline.app.debug`. Release variant bu projede kapalı; mağaza uygulaması için kullanma. Build tek Gradle worker ve 1 GiB JVM heap kullanır; bilgisayardaki global Gradle ayarları komut satırından sınırlandırılır.

USB kablosu ayrılıp yeniden bağlanırsa:

```bash
adb reverse tcp:5173 tcp:5173
adb shell am start -n space.asteraonline.app.debug/.MainActivity
```

Wi-Fi alternatifi için telefonu bilgisayarla aynı yerel ağa bağla, `pnpm phone` ile bilgisayarın adresini bul ve o adresle APK'yı yeniden üret:

```bash
ASTERA_MOBILE_DEV_URL=http://192.168.1.24:5173 pnpm android:apk
```

Yukarıdaki IP örnektir; kendi bilgisayarının adresini kullan. Yalnız loopback ve özel LAN adresleri kabul edilir. Kimlik bilgisi, path, query ve hash içeren adresler reddedilir. Wi-Fi APK'sında USB reverse gerekli değildir; IP değişirse yeniden build gerekir.

## Telefonda denenecekler

1. Astera Local'i aç. Açılışın boş/siyah ekranda kalmadığını kontrol et.
2. Deneme oyununa gir; galaksiyi sürükle, iki parmakla yakınlaştır, gezegen seç ve panelleri aç/kapat.
3. Menü → Cihaz bölümünde **Kare hızı → Açık** seç. Bekleyen sahnede 24–30 FPS oyun tasarımının hedefidir; kamera hareketinde, yakın planda ve filo efektlerinde ayrıca ölç.
4. Giriş/kayıt alanına dokun. Klavye açılmalı, yazı girilebilmeli, alan/butonlar klavyenin arkasında kalmamalı. Önce yerel hesabını kullan; web sitesindeki production hesabı yerel DB'de bulunmayabilir.
5. Android geri hareketini klavye açıkken, panel açıkken ve oyun kökünde ayrı dene. Bu ilk sürüm Capacitor'ın varsayılan geri davranışını kullanır; panel önceliği henüz ayrıca uygulanmadı.
6. Ekranı kilitle, tekrar aç; uygulamayı arka plana gönder ve geri dön. Sahne, ses ve canlı verinin toparlanmasını kontrol et.
7. 15–20 dakika oyna; FPS düşüşü, ısınma, geç algılanan dokunuş ve WebGL context kaybını not et.

Geliştirme build'i React geliştirme kontrollerini, Vite/HMR ve kaynak modüllerini içerir. Bu ölçümler wrapper'ın ilk cihaz kontrolüdür; production paketinin nihai performans ölçümü sayılmaz.

## Sorun giderme

- `adb devices -l` cihazı `unauthorized` gösteriyorsa telefon ekranındaki USB iznini onayla.
- Uygulama açılmıyorsa Vite :5173 ve USB reverse'ü kontrol et.
- Açılış var ama oyun/API çalışmıyorsa API :3100 ve yerel PostgreSQL'i kontrol et. Vite `/api` isteklerini :3100'e iletir.
- İlk kurulumdan sonra native/WebView hataları `adb logcat` ve Chrome `chrome://inspect/#devices` üzerinden incelenebilir. Uygulama debug modunda inspect edilebilir.
- `INSTALL_FAILED_UPDATE_INCOMPATIBLE` varsa eski APK başka debug anahtarıyla imzalanmış olabilir. Uygulamayı kaldırmak yerel oturumu siler; önce bu durumu değerlendir.
