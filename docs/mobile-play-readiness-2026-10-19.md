# Android test ve Play hazırlığı —19 Ekim2026

Kaynak: gerçek build/artifact/cihaz kayıtları ve19 Ekim yeniden açılan resmî Google belgeleri. Bu bir Play onayı değildir; Console'a yükleme/dağıtım yapılmadı, Console'un signing/version/form durumuna erişilmedi.

## Tamamlanan temel

- Tek API/hesap/dünya: web ve Android production HTTPS kullanır; iOS aynı sözleşmeye hazırlanmıştır, henüz iOS uygulaması yoktur.
- Android appId `space.asteraonline.app`. Telefon testindeki bundled production DEBUG APK API bağlantısı, güvenli native session, fullscreen/IME/Back/lifecycle ve Wi-Fi+cellular cold-start recovery kabulünü geçti. [Cihaz/ağ kaydı](mobile-native-network-recovery-2026-10-18.md).
- Play'e yüklenecek **AAB**, doğrudan test için kullanılan APK'dan ayrıdır. `out/mobile-artifacts/native-production-release/astera-native-production-v1.aab`, versionCode1/name1.0.0, minSdk24/targetSdk36, debuggable=false,77.780.984B; signature/bundletool/package/manifest/config kabulü PASS. [Artifact kayıtları](mobile-play-internal-upload-2026-10-18.md).
- Bu AAB **landing öncesi** `e84d70e95e887e56ac60b5d41ea0db3d08fe923087a8c26435469edcc5421cfe` kaynak fingerprint'iyle kabul edildi. Önceki tam web regresyonu535dosya/7.007PASS/29skip; son landing kaynaklarının sonucu bunun yerine kullanılamaz. Yeni kaynak için ayrı tam test/build gerekir.
- Manifest yalnızINTERNET, ACCESS_NETWORK_STATE ve uygulamaya özel AndroidX receiver izni içerir. AD_ID/BILLING/kamera/konum/genişmedya izni yok; embeddedELF0. YeniSDK eklendiğinde izin/16KB/beyan kabulü tekrarlanır.
- İnceleme ve admin hesabının yalnız automaticMAIN→WAITING Silent Space muafiyeti production962439cc… üzerinde aktif/doğrulandı. İnceleme parolası dosyaya yazılmaz.

## Eksikler / yayın kapıları

| Konu | Gerçek durum ve gerekli iş |
|---|---|
| Hesap silme | Uygulama içi6dil talep ve adminonay/tamamla/dosya retry yerelde kodlandı; EN/TRdışHTML veprivacybağlantısı test edildi. Yeni uygulama kodu/policy sayfaları production’a dağıtılmadı. Doğrulanmış dış destek talebini kuyruğa kayıt ve imzalı restore-erasure koruması da yerelde uygulandı. Son ortak regresyon/yayın kabulü ve onaylı hesaba yeni gelen uçuşlar politikası açık. Ayrıntı: [19Ekim silme kaydı](mobile-account-deletion-2026-10-19.md). |
| Silme davranışı | Owner kararı: onaydaerişim kapanır, uçuşlar/diğeroyuncuların işlemleri güvenle bitincesilinir. Silme/native-auth/security/journal/CLI son modül regresyonu6dosya80PASS; enson UGC ekleri için bütünkaynak kabulü ayrıca gereklidir. Günlük/özelyayın yedeklerine max30gün bağımsıztemizlik VPS’tekuruldu; mevcutyedekler yeniydi/apply0. Kontrollü restore: maintenance altında güncel imzalı journal korunur, eski DB/media üzerine tekrar uygulanır; failclosed/dryrun/idempotence modül testleri geçti. Tamkaynak ve operasyonel rollout kabulü açık. |
| UGC | Şikâyet, admin karar kuyruğu ve30günTTL yerelde eklendi. Kalıcı accountblock için son sunucu regresyonu4dosya50PASS, web7dosya235PASS ve6dil72browserstatePASS; bunlar sonraki kural kabulü değişikliklerinin tam kabulü değildir. Kural kabulü backend/auth/native/Academy regresyonu4dosya108PASS. Açık checkbox/istemci entegrasyonu ve6dil86browserstatePASS; ortak sosyal sunucu5dosya64PASS. Rapor medyası inceleme eklendi: yeni sunucu6PASS, ilgili web7dosya138PASS ve6dil60browserstatePASS. İsim/klan moderasyonu, son tam ordinary regresyon ve rollout açık. Bunlar production'a dağıtılmadı; tümUGC şartları PASS sayılmaz. |
| Privacy/DataSafety | [Kaynak tabanlı envanter/Console taslağı](mobile-data-safety-2026-10-19.md) hazır; son aday paket/ağ/log ve üçüncü taraf akışlarıyla doğrulanmalı. Kontrollü WebView de beyan kapsamındadır. |
| Reklam beyanı | Native AdMob/rewardedSDK yok ve capability kapalı. Ancak mevcut YouTube embed reklam/veri işlemesi ayrıca değerlendirilmeden “reklam yok/veri yok” cevabı verilmez. Web AdSense ile native ads aynı ürün değildir. |
| Console | App access adımları + çalışan reviewer hesabı, DataSafety, privacyURL, hedefkitle/yaş/IARC, ads, açıklamalar/ikon/ekrangörüntüleri ve destek bilgileri gerçek pakete göre doğrulanmalı. Formların tamamlandığı bilinmiyor. |
| Playden kurulum | Play App Signing/Console en yüksekversionCode/uygunuploadsertifikası henüz görülmedi. Play dağıtımından kurulum+oturum/ağ/Back kabulü ve pre-launch raporu açık. Debug sertifikalı mevcut kurulumu uninstall/clear-data ile kendiliğinden silme. |
| Cihaz matrisi | Orta segment/farklıAndroid/WebView, medya/codec, uzun kullanım/ısınma/bellek/ANR ve IPv6-only kabulü tamamlanmadı. Önceki kısa cihaz testleri bunların yerine geçmez. |
| Signing yedeği | Uploadkey private olarak repo dışında mevcut; sahibin güvenli PC-dışı yedeği henüz doğrulanmadı. Yeni build için key yenileme yapılmaz. |
| Kapalı test | Kişisel hesap yaklaşık2025: Console'da bu app için production erişimi önceden yoksa12kişinin kesintisiz14gün closed-test opt-in'ı ve production başvurusu gerekir. APK paylaşımı/internaltest bu süreyi başlatmaz. |

Rewardedads, bildirim ve IAP henüz yoktur. Bunlar her oyunda zorunlu özellikler değildir; ilk sürüm bunları içermeden çıkabilir. Dijital satış açılacaksa uygun PlayBilling+server doğrulama/restore/refund akışı ayrıca tamamlanmalı. Kapalı capability'ler mağaza metninde varmış gibi vaat edilmez.

## Dahili test / kapalı test ayrımı

### Son durum doğrulaması —19 Ekim

Kural kabulü frontend'i ve yetkili rapor medya incelemesi yerelde modül/browser kabulünü geçti; tam kaynak kabulü ve rollout açık; eldeki imzalı AAB yeni silme/şikâyet/engel/kural kabulü kodlarını içermez. Sıradaki sıra: eksik UGC uçları ve UI → ordinary test/type/lint/browser kabulü → ortak API ve public sayfaların kontrollü rollout'u → yeni imzalı AAB ve telefonda/Play'de kabul → Console form/sertifika/version kontrolü ve test yayını. Yeni paket hazır demek için eski artifact veya eski tam regresyon sonuçları kullanılmaz.

İlk güncel test adayı için yaklaşık1–2 iş günü yalnız planlama tahminidir; tam regresyonda çıkan hata, açık ürün kararları, cihaz ve Console erişimi süreyi değiştirebilir. Kapalı testin14gün koşulu yüklemeye değil production erişimine ilişkindir. Resmî kişisel hesap şartı19Ekim yeniden açılıp doğrulandı; gerçek Console'da uygulamanın mevcut production erişimi görülmedi.

Yalnız **internal track** üzerinde aktif uygulamalar için DataSafetyform muafiyeti Google tarafından açıkça tanımlanır. Closed/open/production için bu muafiyet genellenmez. Dahili testte artifact yüklenebilmesi, hesap silme/UGC dahil tüm politika kapılarının tamamlandığı veya kamuya açık yayına hazır olunduğu anlamına gelmez. Gerçek Console uyarıları ayrıca görülmelidir.

##19 Ekim resmî kaynakları

- [Hesap silme](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en): uygulamaiçi yol ve web kaynağı; e-posta/form desteklenir; kolaykeşif ve app/geliştirici adı, veri/saklama açıklaması gerekir.
- [UGC](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en-TT): kullanıcı/içerik şikâyeti ve gerekli block/moderasyon.
- [İnceleme hazırlığı](https://support.google.com/googleplay/android-developer/answer/9859455?hl=en-EN): appaccess,privacy,ads,hedefkitle/içerik beyanları.
- [DataSafety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en): internal-only istisnası ve kontrollüWebView kapsamı.
- [Kişisel hesap test şartları](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en):12testçi/14gün continuousclosedtest; ardındanproductionbaşvurusu ve gerçek etkileşim/geri bildirim.
- [Hedef API](https://support.google.com/googleplay/android-developer/answer/11926878?hl=tr):31Ağustos2026'dan beri yeni standartAndroid app/update içinAPI36+; mevcutAAB36bu eşiği karşılar.


### Canlı public URL denetimi —19Ekim17:26TR

`curl` HTTPS dışkontrolü: `/account-deletion.html`404, `/hesap-silme.html`404; `/privacy.html`200 ve `/community-guidelines.html`200. Mevcut200sayfalar güncel yerel metnin yayında olduğu anlamına gelmez. Pythonurllib useragent ile403alındı; curlCloudflareyanıtı ayrı doğrulandı, tümpublicsayfalar403 diye raporlanmaz. Google hesap silme belgesi tekrar açıldı: çalışanwebkaynağı, app/geliştiriciadı ve belirgintalep yolu gerektirir; destekmaili kabul edilebilir. YerelEN/TRsilmehtml içeriği hazır olsa da canlı404 nedeniyle ConsolehesapsilmeURLkabulü **FAIL/açık**. Backend vepublicsayfaların doğru rollout'u ve yeni dışkabul olmadan forma tamamlandı yazılmaz.
