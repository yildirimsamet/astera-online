# Play Console dahili test paketi —18 Ekim2026

**İmzalı AAB üretildi ve artifact kabulü PASS; son geniş frontend sonucu release output status dosyasından kontrol edilir. Public yayın onayı değildir.**

- Dosya: `out/mobile-artifacts/native-production-release/astera-native-production-v1.aab`
- Paket: `space.asteraonline.app`; görünen ad: Astera Online
- VersionCode1 / versionName1.0.0; min24/target36, debuggable=false
- Boyut77780984byte; SHA256 `090075c4742be5b15c8a8af1b2b3210f3b57aacd417f30fe1743aa0e951a9fac`
- SourceHash `e84d70e95e887e56ac60b5d41ea0db3d08fe923087a8c26435469edcc5421cfe`; git tabanı962439cc…+yerel mobil/release farkları. Backend canlıSHA aynıdır, fakat bu AAB yalnız temiz962 kaynaklarıyla yapılmış değildir. Sonraki doküman değişiklikleri build anının hash'ine geriye dönük dahil değildir.
- Bundletool validate, AAB→APK üretimi, JAR/APK imzaları ve upload sertifikası, gerçek config/manifest/API/CSP, dosya eşleşmesi PASS. Embedded ELF0; sonraki nativeSDK eklemelerinde16KB koşulu yeniden ölçülmeli. Metadata storeReady=false.

## Console'da yapılacak somut adımlar

1. Astera Online uygulamasını seç/oluştur; yayıncı/app adı ve paket alanlarını yukarıdakiyle eşleştir. Daha önce upload edilen versionCode1 veya farklı upload sertifikası varsa bu dosyayı zorlayarak kullanma: mevcut Console durumunu doğrulayıp yeni versionCode veya doğru upload-key kaydıyla yeniden üret.
2. Play App Signing kurulumunu Console üzerinden tamamla. Upload sertifikası public kopyası `out/mobile-artifacts/android-signing/upload-certificate.pem`; SHA256 `FE:7C:24:C9:AA:D3:4F:59:15:8D:C4:2F:35:83:D8:24:B4:0B:B1:93:85:0D:C6:EB:DC:08:B3:D4:8A:BD:45:37`. Bu upload anahtarıdır; Google'ın dağıtım signing sertifikası ayrıdır. Gelecekte App Links/provider kayıtlarına gereken Play distribution fingerprint'i Console'dan alınır.
3. Test ve yayınlama → Test → Dahili test alanında yeni sürüm oluştur ve **.aab** dosyasını yükle. Verification universal.apk/.apks veya telefondaki debug APK mağaza upload dosyası değildir. Console hatalarını kaydet; yükleme başarılı diye public yayın/production erişimi tamamlandı sayma.
4. Sürüm notuna Android ilk paketinin shared backend/hesap/dünya ve fullscreen kullanımını yaz; henüz bulunmayan IAP/ads/bildirim/iOS özelliklerini vaat etme. Testçi listesi/opt-in linkini Console'da hazırla. Sahibin açık talimatı olmadan davet/e-posta gönderilmez.
5. **Gerçek Play dağıtımı** ile kurulum/login/refresh/SSE/offline dönüş/IME/Back/lifecycle kabulünü tekrarla. Mevcut telefonda aynı appId debug sertifikası var; upload/Play sertifikalı APK bunun üzerine normal update olarak kurulamaz. Sahip onayı olmadan mevcut app/Keystore oturumunu uninstall/clear-data ile silme; önce sonuç ve yeniden giriş planını somutlaştır. Backend hesabı/dünyası yerel uninstall ile silinmez.

Bu çalışma Console'a otomatik giriş/yükleme veya tester daveti yapmadı; Console signing/version durumu henüz okunmadı.

## İlk açık yayın öncesi kalan kapılar

Hesap silme web kaynağı+in-app talep yolu+gerçek fulfillment/retention; UGC report/block/moderasyon; planlanan native store purchase doğrulama/restore/refund ve yerel hatırlatmalar; kalan cihaz/media/IPv6-only/uzun kullanım; privacy/Data safety/yaş/içerik/ads beyanları ve mağaza görselleri. Native reklam SDK'sı yok, fakat mevcut YouTube iframe olası reklam/data işlemesi ayrı değerlendirilmelidir. iOS Android yayını sonrası; tek backend korunur.

Kişisel hesabın yaklaşık2025'te açılmış olması nedeniyle, Console'da başka mevcut production erişimi yoksa en az12 kişinin kesintisiz14 gün **kapalı teste** katılımı ve sonra production erişimi başvurusu gerekir. Dahili test bu14 günü başlatmaz. [Google resmi şartlar](https://support.google.com/googleplay/android-developer/answer/14151465?hl=tr),18 Ekim yeniden doğrulanan kayıt.

`testaccount` Play App access hesabı sahibi tarafından Console'da yönetilir; parola bu dosyada/fixture'da saklanmaz. testaccount ve adminlesh exact account ID Silent Space istisnası962439cc… production worker'da aktif/doğrulandı. Sıradan oyuncuların/PvP kuralları değişmedi. Yeni rollout'larda worker allowlist'i boş varsayılana sıfırlama. [Canlı kabul kaydı](mobile-store-review-account-2026-10-18.md).

Özel upload key `~/.local/share/astera/signing/astera-upload.p12`, parola yalnız `android-upload.pass` private dosyasında. **PC-dışı güvenli yedek sahibi tarafından yapılmalı; henüz yapılmış sayılmaz.** Private dosyaları Git'e, public artifact'e, VPS'ye veya sohbet mesajına ekleme; sırf yeni build için anahtar oluşturma/yenileme yok. [İmzalama ve test kanıtları](mobile-android-release-signing-2026-10-18.md).

Resmî kaynaklar: [Android signing](https://developer.android.com/studio/publish/app-signing), [AAB upload](https://developer.android.com/studio/publish/upload-bundle), [bundletool](https://developer.android.com/tools/bundletool).
