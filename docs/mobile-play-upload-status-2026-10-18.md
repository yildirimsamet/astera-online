# Play Console yükleme ve yayın durumu — 18 Ekim 2026

Bu kayıt sahibin güncel durum sorusuna verilen cevabı ve hesap silme URL incelemesini saklar. Kaynak/test/kurulu artifact kanıtı esas; gelecek planlar tamamlandı sayılmaz.

## Çalışan temel ve açık teknik işler

Android bundled production DEBUG APK mevcut; appId `space.asteraonline.app`, gerçek API `https://asteraonline.space`. Web/Android/iOS ortak backend/hesap/dünya, ortak istemci ve platform adaptörleri hedefi korunuyor. iOS uygulaması Android yayını sonrasında yapılacak.

Kurulu241de81 kaynaklı79,7MB APK'da mevcut oturum, fullscreen/IME Back,30s render/ses pause ve uzun lock dönüşü ölçüldü. Foreground offline cold-start ağ geri dönüşünde gerçek hata bulundu. Native Network adaptörü için109 odaklı ve6.974 tam web testi geçti; web typecheck/lint/build başarılı. Yeni79.722.140 byte DEBUG APK üretildi (sourceHash d5538745…);75 paket/config testi ve19 Android JVM testi geçti. Telefona kuruldu: Wi-Fi ve cellular foreground offline coldstart otomatik recovery13–14s, native API/SSE200 PASS. [Ağ kaydı](mobile-native-network-recovery-2026-10-18.md), [cihaz kaydı](mobile-lifecycle-device-acceptance-2026-10-18.md).

Release opt-in/signing/version girdileri eklendi;83 odaklı test PASS, gerçek Gradle signed bundleRelease PASS. Final imzalı77.780.984byte AAB üretildi; bundletool/signature/debuggable=false/API/package/version kabulü PASS. Landing öncesi son geniş frontend regresyonu7.007 PASS/29skip tamamlandı. Yeni premium landing çalışması ayrı kabul gerektirir; bu AAB önceki fingerprint ile niteliklidir. Repo dışında upload key hazır; key PC-dışı güvenli yedeği açık. Önce dahili test AAB'si hazırlanabilir; mağazaya herkese açık yayın ayrı kabul kapısıdır. [Android resmi bundle yükleme rehberi](https://developer.android.com/studio/publish/upload-bundle).

`testaccount` ve `adminlesh` için exact account ID Silent Space muafiyeti **canlıda uygulandı ve doğrulandı**, SHA962439cc….351 dosyada4511 server test PASS. Dört rol ve public web aynı SHA; native web/Android/iOS sözleşmesi korunuyor. [Ayrıntı ve kabul](mobile-store-review-account-2026-10-18.md).

## Hesap silme URL'si — üç şartın karşılaştırması

Mevcut sayfalar `https://asteraonline.space/gizlilik-politikasi.html` ve `https://asteraonline.space/privacy.html`. Astera Online/yayıncı adı var. Komutan adıyla e-posta talebi anlatılıyor, fakat belirgin ayrı silme bölümü/adımları ve silinen/saklanan veri türleriyle ek saklama süreleri yeterince açık değil. Bu yüzden mevcut URL tam hazır diye Console'a sunulmamalı. Ayrı form zorunlu değil: Google web kaynağında e-posta yoluna izin veriyor; privacy sayfasının belirgin silme bölümü/anchor'ı da kabul edilebilir. Uygulama içi talep başlatma ayrıca gerekli ve mevcut operatör silme CLI'si bunun yerini tutmuyor.

Saklama süresini tahmin ederek30/90 gün yazma; gerçek silme servisi, yedek döngüsü ve zorunlu saklama politikasıyla doğrula. Kamuya açık metin uygulanabilir davranışı anlatmalı. [Google resmi hesap silme şartları](https://support.google.com/googleplay/android-developer/answer/13327111?hl=tr),18 Ekim yeniden kontrol edildi.

## Yayından önce kalan kapsam

Hesap silme; UGC şikâyet/engelleme/moderasyon; planlanan store billing/backend doğrulama ve yerel üretim hatırlatmaları; kalan medya/cihaz/uzun kullanım matrisi; privacy/Data safety/yaş/içerik beyanları; mağaza görselleri/açıklamaları ve review erişimi. Bunların hepsi ilk dahili artifact yüklemesinin önkoşulu diye yorumlanmamalı; halka açık yayın kabul kapılarıdır. Detay [ana checklist](mobile-store-release-checklist-2026-10-16.md).

Sahibin kişisel hesabı yaklaşık2025'te açılmış:13 Kasım2023 sonrasındaki kişisel hesaplar için en az12 test kullanıcısının kesintisiz14 gün **kapalı teste** katılımı ve ardından production erişimi başvurusu gerekir. Dahili test bu süreyi başlatmaz. Gerçek Console production erişim durumu henüz görülmedi. [Google resmi test şartları](https://support.google.com/googleplay/android-developer/answer/14151465?hl=tr),18 Ekim yeniden kontrol edildi.

## Saklama süreleri hakkında kod inceleme notu

Mevcut `deploy/backup.sh` varsayılan `BACKUP_KEEP=14` ile **son14 yedek dosyasını** tutuyor; bu14 gün garantisi değildir. Cron sıklığı, production override'ı ve ayrıca saklanan özel release yedekleri incelenmeden sayfaya14 gün yazılamaz. `services/accountDeletion.ts` halen operator komutu; transfer history/queued return/aktif iş gibi korumalar nedeniyle doğrudan self-service HTTP çağrısına açılmamalı. Yeni talep/tamamlama akışı bu guard'ları ve üçüncü oyuncuların dünya bütünlüğünü gözetmelidir.

Son kontrol: yeni ağ APK'sı kuruldu, Wi-Fi/cellular ve native API/SSE cihaz kabulü PASS. testaccount+adminlesh koruması production'da aktif/doğrulandı;4511 olağan server testi ve server type/lint PASS. İmzalı AAB üretimi ve bundletool/signature/package/config kabulü PASS; son frontend geniş test sonucu release output kayıtlarından doğrulanmalı.

### Silme servisinde yeni kaynak bulgusu — henüz TDD ile doğrulanmadı

`deleteAccount()` ve `describeAccount()` displayName exact eşleşmesi ile normalleştirilmiş username eşleşmesini ayrı LIMIT1 sorgularıyla UNION ediyor ve ilk satırı alıyor. DisplayName benzersizliği/başka kişinin username'iyle çakışması bu selector'da reddedilmiyor. Bir kişinin giriş adıyla diğerinin görünen adı aynıysa operator preview/confirm aynı kişiyi seçme garantisi taşımayabilir. Bu **kaynak inceleme bulgusu**, henüz yeni gerçek DB RED testi yazılıp çalıştırılmadı. Self-service endpoint authenticated accountId kullanmalı; operator selector da ambiguous girdide yazmadan durmalı. Devam eden review-account full suite kaynağı dondurulduğundan ayrı sonraki silme TDD aşamasına bırakıldı; mevcut release-account diff'ine eklenmedi.

Production backup envanteri: kullanıcı crontab'ında backup.sh için günlük `17 3 * * *`; .env içinde BACKUP_KEEP/BACKUP_DIR override bulunmadı. Script default son14 snapshot'ı tutar; başarısız/kaçırılan cron ve ayrıca private release yedekleri nedeniyle bu bilgi tek başına tüm kopyalar için14 gün maksimum saklama taahhüdü değildir.

İmzalı AAB araştırması/koruma gereksinimleri [release signing kaydında](mobile-android-release-signing-2026-10-18.md). Mevcut production appId debug imzalı kuruluma release/Play imzalı paket sıradan `adb install -r` güncellemesiyle geçemez; sahibinin kurulumunu/yerel oturumunu silme kararı kendiliğinden uygulanmaz.

Selector bulgusunun kapsamını daraltan ek inceleme: normal insan kayıt akışı displayName'i girilen username casing'inden üretip giriş adını normalleştiriyor; şu an kullanıcı rename endpoint'i bulunmadı. Dolayısıyla yeni insan kayıtları için cross-field çakışma kendiliğinden kanıtlanmış değil. Ancak schema displayName için unique/canonical bağ kurmuyor; bot identity/roster ve capacity CLI'ları farklı displayName yazabiliyor, legacy veriler de ayrıca incelenmeli. Gelecek self-service silmede authenticated accountId kullanma gereği sürer; operator belirsizlik testi bu gerçek ulaşılabilirlik sınırlarıyla yazılmalı, varsayıma dayanarak yanlış kişiyi silme açığı ilan edilmemeli.

### E-posta ile silme talebi —18 Ekim soru cevabı

Sahip e-posta talebi yönlendirmesinin uygunluğunu sordu. Google resmi FAQ yeniden açıldı: **müşteri destek e-postası veya form kabul edilir**, otomatik anında silme zorunlu değil. Uygulama içindeki belirgin hesap silme yolu web silme kaynağına götürebilir. Web sayfası Astera Online/geliştirici adı, belirgin talep adımları/iletişim, silinen/saklanan veriler ve süreleri açıklamalı; uygulamayı yeniden kurmayı zorunlu tutamaz. Gerçek talepler tamamlanmalı. [Resmî FAQ](https://support.google.com/googleplay/android-developer/answer/13327111?hl=tr). Bu yanıt önceki erişim kapanma zamanı sorusuna onay değildir; kimlik/dünya silme zamanlaması kararı açık. iOS için Apple'ın ek in-app kuralları ayrıca karşılanmalı.

Güncel özet: ağ cihaz kabulü ve review/admin exemption canlı kabulü tamam; AAB final export/validation, silme sayfası+in-app yol+uygulanabilir saklama politikası, UGC, ödeme/bildirim ve mağaza/kapalıtest açık. Önceki paragraflar kronolojik ara durumları kaydeder.

### iOS için e-posta sınırı yeniden doğrulandı

[Apple resmi5.1.1(v) FAQ](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion),18 Ekim: regüle olmayan uygulamalar kullanıcıyı hesap silmek için e-posta/telefon/support-chat'e mecbur bırakmamalı. Uygulama içinde talep başlatılır; makul süreli **manuel backend tamamlaması kabul edilir**, süre ve sonuç kullanıcıya bildirilir. Dolayısıyla Google için e-posta yolu seçilse bile ortak backend gelecekte iOS'un uygulama içi talebini taşımalıdır. Erişimin talepte mi tamamlanmada mı kapanacağı önceki owner kararı hâlâ açık. Google izni Apple izni diye genellenmez.
