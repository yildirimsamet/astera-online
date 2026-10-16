# Android telefonda yerel Astera denemesi

Bu ilk APK, bilgisayardaki güncel web sunucusunu açar. Commit edilmemiş yerel değişiklikler dahil; kaydedilen web değişiklikleri Vite üzerinden telefona da yansır. APK oyun dosyalarının bağımsız bir kopyası değildir. Bilgisayar, yerel API ve web sunucusu çalışır durumda kalmalı.

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
