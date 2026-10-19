# Ortak hesap silme akışı —19 Ekim2026

Durum: geliştirme başladı; production'a dağıtılmadı. Owner app yayın eksiklerini landing'den önce kapatma talimatı verdi. [Hazırlık listesi](mobile-play-readiness-2026-10-19.md).

## Gereksinim ve karar sınırı

Web/Android/ilerideiOS tek Astera hesabını silecek; platforma özel ayrı hesap veya silme servisi yok. Uygulama içinde kolay keşfedilen talep, dışarıdan ulaşılabilen TR/EN sayfa ve kimlik doğrulamalı güvenli fulfillment gerekir. Operatör mevcut yoğun-dünya/üçüncü oyuncu/history guard'larını atlayamaz. Talep başarı mesajı silmenin tamamlandığı anlamına gelemez.

**Owner kararı:** erişim talep onaylanınca kapanır; uçuşlar/diğer oyuncuların işlemleri güvenle sonuçlandıktan sonra hesap silinir. Talebin kaydı tek başına erişimi kapatmaz. Ayrıntılar ve yerel test kanıtı aşağıda.

## İlk dilim: durable talep

- `GET /api/auth/account-deletion`: yalnız authenticated accountId'nin kendi talebi, yoksa null.
- `POST /api/auth/account-deletion`: yalnız kendi hesap kimliği, mevcut parola tekrar doğrulaması, desteklenen dil; body'ye targetaccount/username/email eklenemez.202 talebin kaydıdır, tamamlanma değildir.
- One-account/one-active-request: account lock + DB unique/idempotent insert. Aynı istek çift tıklama/ağ retry/concurrent replica altında aynı receipt'i döndürür.
- Parola doğrulaması pahalı KDF accountlock dışında, transaction'da authVersion+passwordHash tekrar kontrolü. Brute-force için bounded durable password counter ve mevcut route/IP auth rate limit.
- No-store; hiçbir parola/token/body response'a veya log'a eklenmez. Email eklemek/üçüncü taraf servise bildirim göndermek zorunlu değildir.
- Başvuru sırasında authVersion/login/refresh/SSE/world/fleet aynı kalır. Request kendi hesabına FK ile bağlı; tamamlanma/retention tasarımı ayrı kabul edilir.

Happy/edge: anonymous401; ownstatusnull; doğruparola202+readback; yanlışparola401 ve satır0; başkaaccountfield400/satır0; diğerkullanıcı403yerine sadecekendi null; iki concurrentPOSTtekreceipt; sessionrevocation/passwordchange sırasında staleproofred; tekrar gönderim timestampresetlemez; overlimit429; unsupportedlocale400; request accountId mevcutauthboundary'den gelir. Native Bearer ve web aynı endpoint.

Etki: accounts/players/world semantic değişmez; yeni additive requesttable+schema/migration, route registration, tests. Public web/deletion UI, operatör approval/fulfillment, retentions/privacy/DataSafety ve backup restore silme tekrar uygulaması daha sonraki dilimler; bunlar bitmeden hesap silme hazır denmez.

## Owner kararı ve ilk kanıt

19Ekim owner açıkça seçti: **talep onaylanınca erişim kapansın; uçuşlar/diğer oyuncuların işlemleri güvenle sonuçlandıktan sonra hesap silinsin.** Artık bu karar beklenmiyor. Onay, talebi kaydetmekten ve gerçek silmeden ayrı olmalı. Onay sonrası yeni login/refresh/access/SSE reddi, kalıcı flag+authVersion ile bütün platformlara uygulanır; zaten sunucunun kabul ettiği işlemler güvenle tamamlanır. Silme, mevcut busy guards'ı atlamaz. Manuel operatör fulfillment'i mümkün; kullanıcıya tamamlanmış gibi söylenmez.

Durable request gerçek API RED12FAIL (404) → yeni route/schema/migration/service sonrası12yeni+25security/deletion regresyonu toplam37PASS. Migration0186 yalnız yeni account_deletion_requests tablosu/indeks/FK ekler, eskiworld/accountdavranışını değiştirmez; yalnız5439taskDB'ye uygulandı. Production journal hâlâ186; yerel yenijournal187 olur, deploya taşınmadı.

Sıradaki dilim: admin-only talep listesi/onay; onay idempotent olup accountauthVersion'ı yalnız bir kez artırır. TalepId'yi admin açıkça seçer, username/displayName selector kullanılmaz. Non-admin403/anonymous401, başkatalep sızmaması, native/web credentialrevoke, freshversiontoken/login bypassreddi, safe/no-worldfulfillment ve yoğunworlddefer testleri önceRED.

##19Ekim uygulama / test checkpoint

- Onay RED6FAIL/12PASS → yeni flag/authVersion/route sınırı sonrası request+nativeauth+security toplam39PASS. Hem webcookie hem native refresh/access/login, yeni authVersion ile imzalanan credentialbypass ve operatöridempotence kontrol edildi. Henüz production'a uygulanmadı.
- Uygulamaiçi entrygalaksiseçimindenönce ve Menu→Account altında eklendi; recoveryemailkapalıyken de görülebilir. Parola+kalıcılıkcheckbox, normal talepstatusu/receipt, pendinghatasında retry ve tekflightguard;6dil. UI RED5FAIL →5yeni+11ilgili regresyon toplam16PASS. Google/Apple hesabı ayrı oluşturulmaz; yalnız authenticatedhesap talebi.
- Sonraki fulfillment API RED4FAIL/18PASS alındı. ExactrequestUUID→accountId, explicitoperatöronayı; ortakbusy/demolish gövdesi yenidenkullanılır. Safegraph için placementlease→lifecycle→seasonexclusive→account/currentplacement recheck; yeniincomingflight quietcheck'i geçemez. Approvedpath taşınma/duyuru kayıtlarını yok etmek yerine kişiselaccountFK'yi null yapar; queuedreturnterminalCANCELLED olur. EskiCLI korumaları aynı tutulur. Migration0188 unpublished; testkabülü sürüyor.
- İncelemede ek önemli bulgu: chatmedia rowcascade fiziksel dosyayı silmiyor. Varolan orphan temizliği yalnız sonraki medya upload'ında çalışıyor; bunu zaman sınırlı silme diye sunma. Fulfillment için commit sonrası durable dosya silme kuyruğu ve worker retry gerekir; henüz uygulanmadı.
- Backup azami süre owner'a soruldu: normalson14başarılıkopya, özelreleaseyedekleri süresiz; önerilen30gün vs14gün. Yanıt gelmeden mevcutduruma aykırı30gün metni yayımlanmayacak. Ayrı eski policy/retention beyanları tam hazır değildir.
- Rolloutkritik: onay işlemi ancak bütünAPIreplikaları/worker yeni authflag'i tanıyan sürüme geçince açılmalı. Eskiimage yeni authVersion token'ını flag'i bilmeden üretebilir. Migration eski istemciyle uyumludur; ancak onaylama rollout ortasında yapılmaz.

## 19 Ekim yeni saklama kararı ve uygulama sınırı

Owner **en fazla 30 gün** seçti: normal günlük yedekler ve kişisel veri içeren özel yayın yedekleri de bu sınıra tabidir. Önceki süresiz özel yayın yedeği istisnası kaldırılacak. Henüz retention uygulaması canlıda devreye alınmadı; web sayfasında uygulanmış gibi sunulmaz. Normal yedeklerin son 14 başarılı kopya sınırı ayrıca korunur. Başka projelerin yedekleri/HoofyWood volume kapsam dışıdır.

Gereksinim: yaş sınırı yeni yedek alınamasa da bağımsız çalışmalı; DB ve medya çiftlerini, yarım dosyaları ve özel yayın klasörlerinin kişisel veri içeren kopyalarını kapsamalı. Kök/symlink/başka proje yolları korunmalı; varsayılan dry-run, açık apply; hatalı ayar silme yapmadan durmalı. Saat sınırı, sayım, başarısız backup, eski özel klasör, yeni dosya/eski klasör, symlink ve unrelated içerik test edilecek. Uygulamadan önce gerçek envanter/dry-run incelenecek; ilk tur yalnız Astera kapsamı.

Medya follow-up: durable anonim outbox + commit sonrası silme + worker retry eklendi. Gerçek dosya, başarısız unlink/retry ve kilit çakışması testleri RED3FAIL → GREEN3PASS; daha geniş doğrulama henüz tamamlanmadı. Beş locale resource kaydı eksikliği mevcut i18n testiyle RED11FAIL/91PASS olarak yakalandı; kayıtlar düzeltildi, GREEN kontrolü sırada.

## Saklama: yerel GREEN ve canlı operasyon kabulü

`deploy/backup-retention.py`: dry-run varsayılan, `--apply` açık seçim; snapshot UTC adı yaşın kaynağıdır (mtime/touch/copy ömrü uzatamaz). Son 14 günlük DB/medya çifti sayımına ek olarak 30 gün eksi bir saat sınırı vardır. Saatlik zamanlama payı sayesinde olağan çalışmada 30 gün geçilmez. Özel Astera yayın klasörlerinde dump, medya, log/JSON/env ve alt dosyalar da sona erer. Yalnız kökteki `pinned-compose.yml` korunur: çalışan Compose bu kişisel veri içermeyen image pin dosyasını referanslıyor. Yayın klasörleri değişmez snapshot'tır; yeni yedek eski klasöre yazılmaz. Symlink izlenmez; başka proje/volume ve tanınmayan dosya adları kapsama girmez. Hata çıkışı başarısızdır; yeni backup alınmasından bağımsız çalışır.

RED4FAIL → retention4 + mevcut backup5 = GREEN9PASS. Normal backup helper yeni scripti çağırır ve private umask077 uygular; bu helper kaynak güncellemesi henüz uygulama dağıtımına katılmadı. Bağımsız retention scripti ise19Ekim VPS `~/.local/lib/astera/backup-retention.py` konumuna kuruldu; SHA256 `6e595eb5524d651b3ef09d2924fbe24f8e14bdffd8bb0d303ca7bf8c784e84dc`. Envanter ve dry-run0; apply0 (henüz30günü aşan Astera snapshot yok). Diğer cron'lar korunarak `13 * * * * python3 $HOME/.local/lib/astera/backup-retention.py --directory $HOME/backups --apply >> $HOME/backups/astera-retention.log 2>&1` eklendi. API/worker/image/veritabanı bu adımda değişmedi. Host kapalı kalması/cron hatası operasyon riski olarak izlenmeli; salt cron kurulumu sonsuz çalışma garantisi değildir. Bu yalnız sunucudaki Astera yedek kopyaları kabulüdür; canlı servis logları, sağlayıcılar, yerel kopyalar ve silme sonrası restore prosedürü ayrıca denetlenmeli.

Dil resource düzeltmesi GREEN107PASS (i18n102 + talepUI5). Güncel uygulama kodunun full-suite/type/lint kabulü hâlâ açık.

## Yönetici ekranı gereksinimi

Operatör talep UUID'si ve kullanıcı/komutan adını beraber görür; önce kimliği doğruladığını ve geri alınamaz sonucu ayrı onaylar. Talep kaydı → erişimi kapatan onay → güvenli silme farklı eylemlerdir; onaysız talepte tamamla görünmez. Ağ/DB hatası başarı olmaz; WORLD_BUSY/DELETION_BUSY sonrasında hesap kaydı aynı kalır ve tekrar denenebilir. Anonim medya kuyruğu ayrıca listelenir; hesap silinse bile kalan dosya işi görünür/retry edilebilir. Queue/status erişimi yalnız mevcut admin boundary; ekran parolayı/email'i istemez. Normal kullanıcıya listesi sunulmaz. Etki: bounded admin API response, Zod client methods, AdminPanel sekmesi ve bağımsız ui-v2 component +6dil. Mevcut duyuru/oyuncu/moderasyon/satın alma sekmelerinin davranışı korunur. Önce API ve gerçek AdminPanel UI testleri RED.

İnceleme bulgusu: ödeme FK'sinin null olması tek başına kişisel veriyi temizlemiyor. Shopier notu/kodu, Paddle customerId ve Polar checkout URL'si kalıyordu. Hesap silmede bunlar temizlenecek; ödeme/ürün/teslim-iade kimlikleri ve tutar, varolan yeniden teslim/çifte iade önleme kayıtları olarak korunacak. Aynı siparişin yeniden hakkı teslim edilmemeli. Kalıcı minimal finansal kayıtların ömrü kaynakta zaten süresizdir; bunu "bütün veriler30günde silinir" diye anlatma, kişisel notların silinmesini ayrıca kanıtla. Sağlayıcıdaki müşteri/ödeme verisi ve destek e-postası ayrı operatör takibi gerektirir.

Anonim dosya kuyruğu eski operator CLI silmelerinden de gelebilir; bunların uygulama talep kaydı/complete audit'i yoktur. Dosya retry'ını hesap silme endpoint'ine bağlamak404 üretir. Admin-only media-cleanup endpoint'i yalnız durable kuyruğu işler; canlı asset referansı varsa dosyayı silmez. Bilinmeyen UUID'ye işlem yaptığında dosya üretmez/silmez; no-op idempotent. Önce gerçek API RED.

## Son checkpoint:19Ekim01:16TR

- API/UI yönetim kuyruğu RED1/RED6 → UI6 + i18n102 + eski admin14 = GREEN122PASS. API tam request25 + eski CLI20 = GREEN45PASS. Bu turda anonim outbox'ın testTRUNCATE listesinde eksik olduğu kanıtlandı (2FAIL/43PASS); helper güncellendi,45PASS tekrarlandı. Kuyruğun production'da accountcascade'den bağımsız kalması kasıtlıdır.
- Kişisel ödeme metaverisi ve bağımsız dosya retry RED2 →3ilgili testGREEN (ödeme alan temizliği, live-file guard +admin-only/idempotentretry, başarısızunlinkworkerretry). Eski CLI işi için ayrı `/api/admin/account-deletion/:requestId/media-cleanup` endpoint'i eklendi; UI yanlışcompletionrouteRED1 → doğrujobrouteGREEN6. Kaynaklarda yeni test sayısı27;47tam silme regresyonu henüz yeniden çalıştırılmadı.
- Dışarıdan okunur EN/TR HTML silme sayfaları, canonical/hreflang/OG ve gizlilik sayfasından belirgin bağlantı eklendi. Public siteRED15/141PASS → public156 +admin6 +nativepublisherlinks7 = GREEN169PASS. SayfalardaJS/Canvas/iframe yok; e-posta yolu, sahiplik doğrulama, onayda erişimin kapanması, silinen/saklanan türler ve30günbackup süresi görünür. Henüz publicwebsiteyayını/browsergörselkabulü yok.
- Server typecheck ilk tur4hata buldu: randomUUID varsayılanından aşırı dar parametre çıkarımı2, ortakNode/browser language modülündeDOMlocation2. Parametre açıkça string yapıldı; pathname untrustedglobalboundary'den typeguard ile okunuyor. Dil/rota testiGREEN111PASS. Server typecheck tekrarı başladı; tam webtypes/lint/fulltest/newbuildhenüz yok.
- Kritik açıklar: dışarıdan e-postayla alınmış ve sahipliği doğrulanmış talebi operatörün durable kuyruğa kaydetme yolu; yedek restore sonrası silinmiş hesapların geri gelmesini engelleyen güncel erasureledger/prosedür; sağlayıcı/destek ve bağlantı günlüklerinin saklama denetimi. Bunlar kapanmadan silme paketini production-ready diye sunma. Mevcutminimal payment tombstone süresizliği sayfada açık; bunu kişiselnotların da süresiz saklandığı şeklinde uygulama.
- Resmi kaynaklar19Ekim yeniden kontrol edildi: https://support.google.com/googleplay/android-developer/answer/13327111?hl=en (inapp+web/email ve retaineddata açıklaması); https://support.google.com/googleplay/android-developer/answer/14151465?hl=en (12/14closedtest); https://support.google.com/googleplay/android-developer/answer/9876937?hl=en (UGC). PostgreSQL16errorcodes https://www.postgresql.org/docs/16/errcodes-appendix.html kilit çakışma mapping'i için kontrol edildi. Bunlar politika onayı garantisi değildir.

##19Ekim01:42TR ek kabul

- Server typecheck düzeltme sonrasıPASS (bu sürümden sonra supportrecordservice/route eklendi; final kaynağı için tekrar gerekir).
- `node tools/visual.mjs out/account-deletion-2026-10-19 --account-deletion`: altıdil×350/1280 request/received/admin-confirm +EN/TR350/1280publicJSdisabled =40browserstatePASS. TR350request/adminconfirm ve EN350noJS görselleri gözle incelendi; horizontalyoverflow yok. İlk harness denemesi dev5173kapalı olduğundanbağlanamadı; task-ownedVite5174başlatıldı. İkinci harness denemesi topclose/footerclose aynılabelyüzündenstrictselectorfail; test `.last()` ile footerclose'u seçti, aynıürün akışı40PASS. Bu harness hataları ürün başarısı diye sayılmadı.
- E-postayla doğrulanmış talep kaydı: `POST /api/admin/account-deletion`, strict{username,locale,confirm:true}, yalnızadmin. Originaluniqueusername üzerindenidentity; çakışandisplayNamehedefolamaz. Oluşturma erişimi kapatmaz; idempotentreceiptve1audit. APIRED2→GREEN3 (2yeni+normalconcurrentsubmission). UIformRED1→UI7+i18n102=GREEN109. Inputdeğişinceverifiedcheckboxreset; approval vecompleteayrıkalır. Bu sonformhenüzbrowserharness'ındagösterilmedi. Yeni sourcefullrequesttest29+CLI20potansiyel49; finalfullsilme kontrolü bekliyor.

## Restore koruması: uygulanacak küçük tasarım

Kritik gereksinim: eskiDB dump'ı silinmiş hesabı yeniden giriş yapabilir hale getiremez. İsim/e-posta üzerinden yeniden hedef seçilmeyecek; accountUUID'nin SHA256özeti, requestUUID, request/onay/kayıt zamanı içeren imzalı özel dosya kullanılacak. Ham hesap kimliği, ad/e-posta/parola bu kayda yazılmayacak. AppmediaUUID route'u bu gizli dizine erişemez. Her onay/tamamla denemesi journal'ı yazar; silme journal fsync/atomicrename başarılı olmadan gerçekleşemez. Dosya hatası account/worldsilmez; tekrar güvenlidir. Kayıt DB/accountcascade'den bağımsız kalır. Kaynak anahtar mevcutJWTsecret'ten amaç ayrımıyla HMAC; secret içerik/argv/log'a yazılmaz. Runtimekeyrotation yeni journal exportuyla birlikte yönetilir.

Restore aracı varsayılan dry-run; yalnız imzalı/strictşema kayıtlarıyla hash→gerçekUUID eşleştirir. Apply sahipliği veya uçuşları silmez: hedef hesapları kapatır ve approveddurabletalebi geri kurar. Varolan farklırequest/badmac/bozuk dosya/hatalızaman/yabancıhash/sameusername-newUUID, rollback/idempotency testleri gerekir. Ardından mevcut güvenli fulfillment guard'ları ile cleanup tamamlanır. Operatör maintenance altında en güncel journal'ı DB/medya restore'dan ÖNCE ayrı private konuma korur; eski medyatar yeni journal'ı ezemez. Journal yok/stale olduğunda restore'u otomatik kamuya açma. Bu düzen currentjournal korunan kontrollürestore içindir; tümhost ve ensonjournal birlikte kaybında doğrulanmış güncel dışkopya olmadan RPO0 garantisi sunulmaz.

## Restore koruması: yerel uygulama ve kanıt

Özel journal `CHAT_MEDIA_DIR/.account-erasure-ledger/<accountUUID-SHA256>.json` altında; directory0700/file0600, tempwx→filefsync→rename→directoryfsync. İçerik yalnız version/hash/requestUUID/tarihler/locale+amaç ayrımlı HMAC; ham hesapUUID/ad/email/parola yok. Onay transaction'ında ve tamamlamadan önce zorunlu yazılır. Yazılamazsa503DELETION_LEDGER_UNAVAILABLE ve DBtransaction rollback: erişim açık/hesap ve dünyalar korunur. Commit hatasından sonra dosyada geçerli onay niyeti kalabilir; restore bunu, sahibinin zaten doğrulanmış silme isteğinin erişimini kapatma niyeti olarak ele alır. API publicmedia route'u UUIDdışını kabul etmez, mevcutuploadorphan sweep de bu dizini atlar.

`pnpm --filter @astera/server erasure:restore --journal-dir /PRIVATE/PRESERVED_MEDIA_ROOT` dry-run. Apply ayrıca `--apply --maintenance-confirmed` gerektirir; bu bir operatör bakım beyanıdır, Nginx veya diğer replica'ları kendi kendine durdurmaz. Araç eski hesaba ait exacthash'i bulup authVersionbump +deletionApprovedAt+approvedrequest'i transaction'la kurar. Galaksiyi/uçuşu silmez; yeniusername-reusehesabı seçilmez. UyuşmayanrequestUUID'de bütüntransaction rollback; tekrarçağrıidempotent. Eksik/boş/bozuk/imzasıyanlış journal'ı0silmegeçmişi diye yorumlamaz; operatör bunu çözmeden servis açılmaz.

İlkAPIRED2 +olmayanreadersuite →GREEN7: privatefilevarlığı, diskhatasındarollback, imza/tamper/yanlışanahtar, dryrun+reapply+idempotency, yenihesapaynıusernamekoruması, requestconflictrollback, eksik/bozukkayıt. Sonraki retentionRED1 +CLIgatesRED1→GREEN7 (journal6+CLI1). Marker'lar hesap hâlâvarsa korunur; hesap silinmişse son kayıttan30gün sonra worker'ın dakikalık housekeep'inde kaldırılır. Worker ilk önce canlıUUIDhashsetini alır; halen tamamlanmakta olan hesaba ait yeni dosyayı süpürmez. Bu cleanup backup'ın29gün23saat +saatlikpay horizon'undan sonradır.

İnceleme bulgusu: eski `season delete-account NAME --yes` yolu journal'ı atlayabiliyordu ve isim seçici legacy'dir. Bu CLI'nın destrüktif seçeneği emekliye ayrıldı; preview kaldı. Silme isteyen kullanıcılar artık admin verifiedrequest→approve→complete akışından işlenir. Ortak `deleteAccount` servisinin eski guard'ları test/rehearsal için korunur; production CLI bu servisi doğrudan çağırmaz. Guard credentials/DByüklenmeden önce işler; REDCLI denemesi loopbackkapalıportfixture ile yapıldı, production'a dokunulmadı.

UIinceleme ekRED2→GREEN272 (admin9+talep5+i18n102+public156): öncedenonaylı desteği tekrar kaydetmek “erişim açık” demez; journal503 açıkbirbekletmehatasıdır, silindibaşarısı gösterilmez. Sonuçlar kaynakbundle'a otomatik canlı yayını anlamına gelmez. API+eskiCLI+journal+nativeauth+security daha geniş regresyonu başlatıldı.

## Son geniş regresyon

`/tmp/astera-account-deletion-regression-final.log`:6dosya **80PASS** /180s (request31+legacydeletion20+journal6+restoreCLI2+nativeauth16+security5). Bu ordinary testtir; ekonomisim/snowball çalıştırılmadı. Server/webtype önceki checkpointPASS; yeni journal/CLI kaynakları için finaltype/lint tekrarları sürdürülmeli. Weblint yalnız testhelperrequire-await buldu, helper senkrona çevrildi; serverlint8bulgu önceki test/optionchain düzeltmeleriyle kapatıldı ancak tekrar kabulü henüz yok.

Kritik yeni bulgu: onaylı hesabı sürekli yeni incoming işlemlerle busy tutarak silmeyi geciktirme ihtimali var. Yeni saldırı/destek uçuşlarını onaydan sonra reddetme önerisi owner'a async soruldu; CLAUDE PvP sınırı nedeniyle yanıt gelmeden hedef davranışı değiştirilmez. Önceden kabul edilmiş uçuşlar her seçenekte normal sonuçlanacak. UGC bağımsız ilerletilebilir. Bu karar production-ready kapısı olarak açık tutulur.

Son server typecheck **PASS**, yeni journal/CLI/worker dahil. Server+rules+root lintgroup tekrar **PASS** (`/tmp/astera-deletion-lint-server-r2.log`); web/toolsgrupları ayrı sırayla doğrulanıyor. Tüm ordinarysuite sonucu değildir.
