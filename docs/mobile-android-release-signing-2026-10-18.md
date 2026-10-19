# Android imzalı AAB hazırlığı — gereksinim ve araştırma

Durum: **imzalı release AAB üretildi; bundletool/config/signature/debuggable kabulü PASS. Son geniş frontend regresyonu sürüyor; mağaza policy/ürün/Console kapıları açık.** Server full suite ve review/admin production kabulü tamamlandı. Kod değişikliği TDD RED→GREEN ile yapılmalı; bu dosya implementation kanıtı değildir.

## Mevcut kaynak / önemli sınırlar

`apps/web/android/app/build.gradle` release variant'ını koşulsuz kapatıyor; yalnız bundled DEBUG APK üretiliyor. Production applicationId `space.asteraonline.app`, backend https://asteraonline.space. Debug APK geçerli debug imzası taşıması nedeniyle mağaza sürümü değildir. min24/target36; mevcut APK embedded ELF0 (sonraki SDK'larda yeniden ölçülecek). Native billing/reklam ayrı capability sınırlarında kapalı.

Kaynak aramasında upload keystore/signing yapılandırması bulunmadı; `~/.local/share/astera/signing` yok ve ilgili signing env değişkenleri yok. Android `.gitignore` yalnız *.jks/*.keystore koruyor, root `.gitignore` *.p12 gibi özel anahtarları genel olarak dışlamıyor. Özel key/parola repo içine oluşturulmamalı; yeni pipeline'da secret dosyalarının yanlışlıkla eklenmesini ayrıca engelle.

**Telefondaki uygulama:** aynı production appId ile debug sertifikalı. Release veya Google Play imzalı paket farklı sertifika taşıyacaktır; normal güncelleme aynı imzayı gerektirir. `adb install -r` ile sessizce debug→release geçilemez. Sahibinin mevcut kurulumu/Keystore oturumunu sırf release smoke için silme. Native Network düzeltmesi aynı debug anahtarıyla mevcut kuruluma yükseltilebilir; gerçek Play sürümüne geçişte gereken kaldırma/yeniden giriş ayrıca somutlaştırılmalı. Bu adımın hesabı/backend dünyasını silmekle ilgisi yok; cihazdaki yerel oturum etkilenir.

## Gereksinim / happy-edge / etki

- Mevcut debug/live-reload/native-local/staging komutları aynı çalışmalı. Release yalnız açıkça seçilmiş native-production/HTTPS ve hazır özel signing girdileriyle açılır; eksik/yanlış hedef veya anahtarda erken ve secret içermeyen hata.
- Upload key ile imzalı AAB, debuggable=false, dev server URL yok, doğru applicationId/API/CSP, kapalı web checkout/reklam bootstrap ve seçili native plugin'ler. İmzalı AAB üretmek bütün M3 ürün/politika kapılarını tamamlamak değildir; metadata storeReady=true diye erken ilan etme.
- Key ve parola VITE_ değişkenlerine, JS bundle'a, git'e, argüman/log çıktısına veya exported artifact'e girmemeli. Repo dışı0700 dizin/0600 secret dosyası; mevcut anahtarı otomatik yenileme/üzerine yazma. Certificate fingerprint/public upload sertifikası ayrı paylaşılabilir.
- Sürüm kodu pozitif tamsayı, sürüm adı açık; Console'da kullanılan kod tekrar yüklenemez. Mevcut Console versionCode/certificate kaydı görülmeden “ilk code1 kabul edilir” garantisi yok.
- Gerçek üretimde signing/config/AAB kontrolü, bundletool validate ve mümkünse temiz test kurulumundan smoke. AAB ile son APK/Play signing sertifikası ayrımını sakla; AAB'yi zipalign/apksigner APK işlemi gibi ele alma.
- Önce saf release girdi/config sınırı testleri, yanlış hedef/eksik key/bozuk version/secret sızıntısı/default release kapalı senaryoları RED; sonra minimal helper/Gradle opt-in ve anlamlı gerçek artifact kabulü. Etki alanı Android Gradle+native build CLI/metadata+secret ignore kuralları+testler; oyun/API sözleşmesi değişmez. iOS imzalama/provisioning sonraki aşama; ortak frontend/platform yapısı korunur.

## Resmî kaynaklar — 18 Ekim yeniden kontrol

[Android app signing](https://developer.android.com/studio/publish/app-signing): AAB upload key ile imzalanır; Play App Signing dağıtılan APK'ları uygulama signing key'iyle imzalar. Bu iki anahtar ayrıdır. Upload key kaybında reset istenebilir; aynı signing kimliğini farklı mağazalarda kullanma kararı ayrıca önemlidir. Debug sertifikası yayın için kabul edilmez. Özel anahtar saklanmalı; önerilen key geçerliliği en az25 yıl.

[Bundle yükleme](https://developer.android.com/studio/publish/upload-bundle) ve [bundletool](https://developer.android.com/tools/bundletool): yükleme artifact'i ve cihaz için oluşturulan APK ayrı kontrol edilir. Kullanılacak bundletool sürümü/checksum'u kurulum sırasında birincil release kaynağından doğrulanmalı; gelişigüzel jar indirme veya parolayı CLI argümanına yazma yok.

## Oluşturulan upload anahtarı — özel dosyalar

Repo dışında `~/.local/share/astera/signing/astera-upload.p12`, alias `astera-upload`; parola yalnız aynı private dizindeki `android-upload.pass` dosyasında. Parent0700, keystore/parola0600 doğrulandı. RSA4096, SHA256withRSA,10.000 gün geçerlilik; JDK21 keytool `-storepass:file`/`-keypass:file` kullanıldı, parola argüman/env/log/repoya yazılmadı. Mevcut key/dosya üzerine yazılmadı; yeni yol `exist_ok=False`/O_EXCL ile oluşturuldu.

Public upload sertifikası `upload-certificate.pem`; SHA256 **FE:7C:24:C9:AA:D3:4F:59:15:8D:C4:2F:35:83:D8:24:B4:0B:B1:93:85:0D:C6:EB:DC:08:B3:D4:8A:BD:45:37**. Public kopyası ve secretsiz metadata `out/mobile-artifacts/android-signing/` altında. Bu fingerprint **upload** sertifikasına aittir; Play dağıtım signing sertifikası diye kullanma. Private key başka cihaza/VPS'ye gönderilmedi; sahibinin güvenli PC-dışı yedeği henüz açık. Parola/keystore'u sırf yeniden build için yeniden üretme; ileride aynı anahtarı kullan.

Play Console kaydı ve AAB üretimi henüz yok. [JDK21 keytool resmi belgesi](https://docs.oracle.com/en/java/javase/21/docs/specs/man/keytool.html) password seçeneklerinin :file/:env modlarını açıklar;18 Ekim kontrol edildi. Key üretimi build/signing hazırlığıdır; uygulama kodu değişmedi, Gradle release koruması halen kapalıdır.

## TDD hazırlığı — server suite bitmeden ikinci test workspace'i açılmaz

`apps/web/test/android-release-config.test.ts` gereksinim testleri önce eklendi. **Henüz çalıştırılmadı**, `androidRelease.ts` implementasyonu henüz yok. Yeni frontend release işi tamamlandı/PASS değildir; önce açık opt-in ile gerçek Gradle bundleRelease RED'i ve config testleri çalıştırılacak, sonra implementation. Devam eden server suite yalnız server/rules kaynaklarını kapsıyor ve bu kaynaklar donduruldu.

Helper kontratı: yalnız production native/HTTPS, açık sürüm/alias ve repo dışı gerçek private dosya yolları; password değeri dönmez. Keystore/parola için realpath+isFile+izin denetimi, symlink'le repo içine kaçışın reddi,0/negatif/fraction/bozuk/üst sınır versionCode, eksik girdiler, boş/multiline versionName, whitespace'i bozmayan password-file davranışı. Gerçek key formatı/alias/signature ayrı actual build sınırında doğrulanır; unit fixture sahte keystore'dur.

[Android sürüm belgesi](https://developer.android.com/studio/publish/versioning) Play versionCode üst sınırını **2100000000** olarak doğruluyor; kod yeniden kullanılamaz. Yeni release'in debug export'unu değiştirmeyen ayrı artifact klasörü olmalı; aynı kaynak fingerprint/metadata/CSP kontrolleri mevcut CLI'dan paylaşılmalı. Şifre JVM'ye private dosyadan ilk satır olarak, baştaki/sondaki boşlukları bozmadan aktarılır; CLI/env değerine veya VITE_ değişkenine dönüştürülmez.

## Yayın araçları / ek gizlilik bulgusu

Resmî Google bundletool1.18.3 (2025-12-15) `~/.local/share/astera/tools/bundletool-all-1.18.3.jar` yoluna indirildi;32520401byte, SHA256 `a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29`, resmî GitHub asset digest'iyle aynı. [Resmî release](https://github.com/google/bundletool/releases/tag/1.18.3). Henüz AAB validate yapılmadı.

Native CSP ve ChatMediaAttachment hâlâ youtube-nocookie iframe'e izin veriyor. [YouTube resmî embed belgesi](https://support.google.com/youtube/answer/171780?hl=en) privacy enhanced embed'in kişiselleştirilmemiş reklam gösterebileceğini belirtiyor. Dolayısıyla web reklam bootstrap'ının kapalı olması native uygulamanın bütün üçüncü taraf reklam/takip ihtimallerinin yokluğu anlamına gelmez. Native YouTube'u kullanıcı dokunuşuyla dış uygulama/tarayıcıya taşıma ve CSP'yi daraltma, TDD ile ele alınmalı; henüz fix/kabul yapılmadı. Uploaded HTML video autoPlay akışının background download completion sonrası oynatma ihtimali de davranış testiyle doğrulanmalı; music/SFX lifecycle kontrolleri HTMLvideo'yu kendiliğinden kapsamaz.

Server full suite PASS. Production host kapısı HoofyWood servisleri nedeniyle engelli; sahibinin yanıtını beklerken bağımsız release TDD işi sürdürülebilir.

### Gerçek RED

18 Ekim Gradle `-PasteraStoreRelease=true :app:bundleRelease` production sync üzerinde **FAIL**: app modülünde bundleRelease task'ı yok (release variant koşulsuz kapalı). Bu gerçek istenen build davranışı eksikliğidir. Saf config testinin yeni modül import hatası ayrıca kaydedildi; compiler/import hatası ürün davranış RED'i olarak sayılmadı. Resmî Android build variants/signing ve bundletool password-file sözleşmesi yeniden kontrol edildi; imza Gradle signingConfig ile, AAB incelemesi bundletool/JAR verifier ile yapılacak.

### Implementation / ara GREEN

Native-production HTTPS private signing input helper+Gradle opt-in+ayrı `pnpm android:release` eklendi; default release kapalı kalır, debug export aynı.32 config+50 mevcut native config/artifact testi PASS; yeni gerçek git-ignore sınırı önce eksik koruma nedeniyle RED (Array[]), sonra6 dosya83PASS. İlk ignore harness path/exit-code hataları ürün RED'i sayılmadı. .p12/.pfx/.jks/.keystore/android-upload.pass/keystore.properties Git discovery dışında; public upload certificate görünür.

Gerçek private key ile Gradle :app:bundleRelease **PASS**,191task/70s; release signing validation/critical lint geçti. Final CLI fingerprint/export/certificate inspection/bundletool henüz açık; ilk Gradle çıktısı final source artifact değildir. Web typecheck ve değişen release TS/test lint PASS; lint fixture dynamic-delete düzeltildi. Key parolası private file'da kaldı. Default kapalı/yanlış hedef/eksik girdiler ve tüm web regresyonları finalde yeniden kontrol edilecek.

### Final AAB / gerçek artifact kabulü PASS

`pnpm android:release` fingerprint sabit kalma denetimiyle başarılı. Export **out/mobile-artifacts/native-production-release/astera-native-production-v1.aab**, **77.780.984 byte**; SHA256 **090075c4742be5b15c8a8af1b2b3210f3b57aacd417f30fe1743aa0e951a9fac**. SourceHash **e84d70e95e887e56ac60b5d41ea0db3d08fe923087a8c26435469edcc5421cfe**, git tabanı962439cc…+commit edilmemiş mobil/release kaynakları; temiz production server commit'inin frontend artifact'ı diye gösterme. Sonraki docs/evidence güncellemeleri build anının fingerprint'ini değiştirmez.

VersionCode1/versionName1.0.0; applicationId space.asteraonline.app/min24/target36, gerçek HTTPS API/no remote document/no logging/modernbridge/fullscreen. Gerçek bundletool1.18.3 validate **PASS**; AAB'den universal APK üretimi, apksigner doğrulama ve upload sertifikası eşleşmesi **PASS**; gerçek manifest/badging **debuggable=false**, AD_ID/billing permission yok.695 packed public runtime dosyası synced assets ile byte eşit, Vite çıktısına ek yalnız Capacitor-generated cordova.js/cordova_plugins.js; embedded ELF0/privatekeyfiles0. İlk paket sayımının Vite'de olmayan iki generated bridge dosyasını hesaba katmaması harness eksikliğiydi; synced Android inventory+Vite subset birlikte doğrulandı. Önceki DEBUG APK da ZIP public scope'ta695 dosya;575 önceki rapordaki daha dar/eksik envanter sayımıydı. Android runtime davranışı bu sayım nedeniyle değişmedi.

Default `:app:bundleRelease --dry-run` release disabled/task not found; açık opt-in ama missing signing config erken reddedildi: iki negatif gerçek Gradle gate **PASS**. Sonuçlar `bundle-content-acceptance.json`, `release-acceptance.json`, `negative-gradle-acceptance.json`, AndroidManifest.xml ve SHA256SUMS aynı output klasöründe. Universal APK **telefona kurulmadı** (debug→upload cert değişimi için local app/session erase yapılmadı); Play distribution sertifikası/Console version-code uygunluğu henüz görülmedi. Metadata **storeReady=false** kalır; bu AAB iç test adayıdır, public yayın hazır onayı değildir.

Data safety envanteri için gerçek universal APK permissions: INTERNET, ACCESS_NETWORK_STATE ve AndroidX'in uygulama kapsamlı DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'i. Kamera/READ_MEDIA/AD_ID/BILLING/konum izni yok. Bu, kullanıcı chat'e dosya yüklerse sunucunun fotoğraf/video toplamadığı anlamına gelmez; gerçek veri akışı ve üçüncü taraf içerik ayrı beyan edilir. İzin listesi tek başına Data safety tamamlandı kanıtı değildir.
