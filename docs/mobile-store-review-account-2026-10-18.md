# Mağaza inceleme hesabı — yayın engeli

Sahip18 Ekim'de production'da **testaccount** hesabını açtığını ve Google Play Console'a inceleme hesabı olarak verdiğini bildirdi. Parola bu belgede veya test fixture'larında saklanmaz; sahibi Console App access alanında yönetir.

**Açık zorunlu iş:** Bu hesap otomatik Silent Space'e alınmamalı. Salt “not edildi” uygulamanın hazır olduğu anlamına gelmez. Mevcut Silent Space uygunluk/worker akışını ve varsa yönetici istisnasını incele; sadece review hesabına dar ve yönetilebilir bir istisna uygula, gerçek production kimliğiyle doğrula. İsim değişikliği/yeniden açılan aynı adlı hesapla yanlış kişiye istisna verilmemeli; tercihen doğrulanmış account ID kullanılmalı. Üretim DB'sine kör update veya global idle eşiği değişikliği yapma.

Bu talep Silent Space'e geçişin engellenmesini kapsar; PvP dokunulmazlığı, ücretsiz oyun ilerlemesi, gizli hesap yetkisi veya bütün test hesaplarına istisna değildir. Diğer oyun/hesap kurallarını değiştirme. Gereksinim/happy-edge/etki kaydı → gerçek RED → minimal uygulama → GREEN → gerçek production uygunluk/hesap durumu kontrolü izlenecek.

Kabul: sıradan inaktif hesap mevcut kuralla Silent Space'e gidebilir; bu kesin review account ID'si aynı koşullarda taşınmaz. İstisna kaybolma/yanlış ortam/yeniden kullanılan isim senaryoları kontrol edilir. Mağaza testinde aynı hesapla giriş ve incelemeci erişimi doğrulanır. Production uygulama/dağıtım yapılmadan bu kapı kapanmaz.

Durum: **CANLIDA UYGULANDI/DOĞRULANDI. testaccount ve adminlesh otomatik Silent Space geçişinden muaf.** Production image/env/rollback ve canlı doğrulama zorunlu yayın işi olarak açık.

## Salt okunur production doğrulaması / uygulama gereksinimi

SSH ve mevcut pinned Compose ile yalnız SELECT yapıldı:18 Ekim mevcut checkout f9378f1c. Kesin hesap ID **353df812-9561-4847-881d-0f9b528553e8**, username `testaccount`, MAIN yerleşimi var. joinedAt18 Ekim16:25UTC; mevcut30h inactivity penceresi yeni açıldı. Parola/hash/email okunmadı. Production henüz değiştirilmedi.

İncelenen otomatik MAIN→WAITING girişi `runSilentSpaceSweep`; `transferCommander` içindeki diğer çağrı operatörün açık `ownerRequested` talebidir. Sırf istisna için hesaba admin yetkisi verme veya activity timestamp'ini sürekli ileri taşıma. En küçük tasarım: boş varsayılanlı UUID listesi `SILENT_SPACE_EXEMPT_ACCOUNT_IDS`; yalnız worker environment'ına açık aktarım, env→app→worker→sweep parametre hattı ve aday SQL sorgusunda account ID'yi **LIMIT/cursor öncesi** filtreleme. Return queue ve açık operatör taşıması değişmez; yeni schema/migration gerekmez.

Test gereksinimleri: aynı anda inaktif ordinary ve review hesabı, varsayılan boş liste, rename/reused username ve account ID kapsamı, sadece exempt aday varken waiting shard açmama, cursor/normal adayın aç kalmaması, env UUID parsing/default/invalid list, worker'a config aktarımı ve gerçek Compose default/explicit passthrough. Önce izole *_test DB'de gerçek RED; değişen server/env/worker ve mevcut Silent Space regresyonları + tip/lint; sonra production için somut image/env/rollback çıktısı hazırlanacak. Mevcut API/web/native auth bayrakları ve tek worker topolojisi korunacak. Gerçek production kabulü olmadan istisna uygulanmış sayılmaz.

## Yerel TDD uygulaması

İzole127.0.0.1:5439/astera_review_account_20261018_test, yalnız bu göreve ait postgres16 container. İlk RED çalışmasında13→beklenen fail yolunun worker spy assertion'ı bütün Drizzle DB nesnesini formatlamaya çalışıp4GiB heap sınırında OOM üretti. Bu harness hatası başarı/ürün kanıtı değildir. Karşılaştırma yalnız maintenance options'a daraltıldı;2GiB heap ile temiz **13FAIL/2PASS,15test** tekrarlandı. Gerçek eksikler: env UUID/default validation, prod/stage worker aktarımı, exempt hesabın taşınması ve app→worker config eksikliği.

Minimal uygulama eklendi: env UUID listesi(max20/trim/dedup), app→worker→sweep aktarımı, aday WHERE içinde account ID filtresi ve worker Compose environment; `.env.example` açıklaması. Return queue, manuel ownerRequested taşıması, admin/PvP, activity timestamp, schema/migration ve API sözleşmeleri değiştirilmedi. GREEN/tip/lint/mevcut Silent Space-worker-native auth regresyon kontrolü sürüyor. Production flag/image henüz değişmedi.

Yeni15 test **PASS**,21.42s,2GiB heap; server typecheck **PASS**. Lint ve mevcut regresyonlar henüz sürüyor. İlk4GiB OOM tekrarının sebebi assertion formatter'dı; heap yükseltilmedi, dar assertion2GiB ile normal çalıştı.

İzole test fixture performansı: regresyonun TRUNCATE adımlarında `pg_stat_activity` IO/DataFileImmediateSync beklemesi ölçüldü. **Yalnız görev container'ında** fsync/synchronous_commit kapatıldı; gerçek PostgreSQL transaction/lock/FK kontrolleri sürer, elektrik kesintisi/disk dayanıklılığı kanıtı iddia edilmez. Production ve sahibin diğer DB/container ayarları değiştirilmedi. Bu container ve DB disposable test verisidir.

Yerel kapanış:15 yeni test PASS; server typecheck ve server+rules lint PASS;17 dosya **231/231 mevcut Silent Space/return/waiting/worker/native auth/CORS/SSE/session regresyonu PASS** (267.82s). Yeni API/schema/migration yok. Tam server suite henüz bu değişiklik için çalıştırılmadı; production dağıtımı yapılmadı.

Tam olağan server suite başlatıldı; nice10,2GiB heap, tek worker/tek workspace, yalnız göreve ait test DB. Ekonomi/sezon/snowball testleri dahil değil. Sonuç `out/mobile-review-account-2026-10-18/full-suite-status.json`, log `logs/server-full.log`; RUNNING tamamlandı/PASS değildir. Runner sonunda yalnız kendi fixture container'ını durdurur; production veya sahibin başka DB/container'ına dokunmaz. Sonraki agent önce bu sonucu okumalı; aynı anda ikinci test workspace'i açmamalı. Production rollout öncesi full sonuç, temiz/pinned kaynak, özel backup/restore uyumluluk provası ve canonical all-role/web release kapıları ayrıca gereklidir.

### Tam suite koşusunun devam kontrolü

Önceki turn sonunda başlatılan full suite tamamlanmamış: devam tool session ID mevcut değil, OS'te Vitest process'i yok, log yalnız RUN banner içeriyor; sonuç JSON'u stale RUNNING kalmış. Bu koşu **INTERRUPTED**, PASS/FAIL ürün kanıtı değil. Eski durum/log ayrı saklandı, yeni attempt2 başlatıldı. Uzun komutun final sonucu görülmeden “çalışıyor/tamamlandı” kaydına güvenilmez; OS process ve final Vitest summary birlikte doğrulanmalı.15 yeni+231 regresyon PASS kanıtı bağımsız ve geçerli.

### Ayrı yayın kaynağı ve özel geri dönüş hazırlığı

Production yeniden salt okunur incelendi: checkout ve4 sağlıklı rol f9378f1c, native auth/origin'ler açık; worker Silent Space=true/batch5/max16, yeni exemption flag'i yok. Stage'e dokunulmadı. Mevcut root çalışma ağacı diğer mobil iyileştirmeleri taşıdığından release kaynağı `~/.local/share/astera/release-worktrees/review-account-20261018` detached f9378f1c kopyasında yalnız6 backend/config değişikliği+3 yeni test+bu dokümanla hazırlanıyor. Henüz commit/push/deploy yok. Test edilen server kaynakları byte olarak bu kopyayla aynı; yeni frontend/mobile değişiklikleri production web'e istemeden taşınmayacak.

Özel backup `~/backups/astera-review-account-20261018T171124Z`: tutarlı pg_dump gzip41.034.795 byte, media2.479.086 byte, .env ve runtime inspect, eski pinned Compose, webroot, Nginx config, commit/image kimliği. Parent0700, hassas dosyalar0600; gzip bütünlüğü ve modlar doğrulandı. Önceki image için benzersiz review-pre etiketi tutuldu. Bunlar hazırlıktır: restore/candidate image/uyumluluk ve canlı postflight açık. Production servisleri yeniden başlatılmadı, DB/veri/feature flag değiştirilmedi.

Rollout planı:6 dosyalık additive config/filtre değişikliği için yeni schema/migration/API/event türü yok. Mevcut canonical kapılar gereği üç API+singleton worker+web aynı yeni full SHA ile ordinary compatible rolling yayınlanacak; API/env/native auth/mağaza bayrakları korunacak. Sadece worker yeni exact UUID listesi alır. Worker-only farklı-SHA dağıtımı veya root dirty mobile kaynaklarının toptan yayını yapılmayacak. Rollback: korunmuş full-SHA image/web/env/pinned Compose, additive veri değişikliği yok; eski DB dump'ını canlı yeni yazıların üstüne restore etmek yok.

Tam suite sırasında kendi PostgreSQL fixture'ında384MiB limitine bağlı21.053 memory.max olayı, yaklaşık4 milyon direct page scan ve94.781 major fault ölçüldü; OOM0. Host available6GiB, Vitest worker yaklaşık0.4GiB. Yalnız görev container'ının memory limiti1GiB (swap dahil1GiB, CPU1 korunur) yapıldı; ürün DB/config/semantik ve Node2GiB heap sınırı değişmedi. Bu, suite'i sahte bellek baskısında çalıştırıp owner PC'yi disk/swap ile zorlamamak içindir; güç kaybı dayanıklılığı testi değildir.

### Restore ve önerilen env farkı hazır

Yedek yalnız **astera_review_rehearsal_20261018t171124z** adlı yeni disposable DB'ye `ON_ERROR_STOP=1` ile yüklendi; current_database adı, journal186 ve review hesabının kopyada varlığı doğrulandı. İlk sayım komutunda docker exec stdin aktarımı eksik olduğundan JSON boş kaldı; SQL sayımı `-i` ile yeniden çalıştırılıp doğrulandı, restore veya canlı DB tekrar yazılmadı. Count/loglar0700 private parent altında0600. Candidate image davranış provası henüz açık.

Aynı özel backup altında `candidate.env` ve `candidate-compose.prod.yml` hazırlandı. Tam resolved Compose secret içerdiğinden yalnız private dosyaya yazıldı; gerçek runtime ile karşılaştırmada API1/2/3 env farkı **yok**, worker'da yalnız **SILENT_SPACE_EXEMPT_ACCOUNT_IDS** yeni. Native auth/origin'ler aynı. Bu env **canlı .env üzerine uygulanmadı**; image SHA sonraki final commit ile pinlenecek.

Aday prova yalnız snapshot DB'ye, ayrı JWT'ye ve loopback portlara bağlı olmalı; mail/billing/bot kapalı, gerçek service secret'ları taşınmaz, medya yalnız clone volume. Eski/yeni image'de shared web/native API read/write ve gerçek SSE; yeni image'in gerçek env parsing/worker options/sweep yolu kontrol edilecek. İnaktif review hesabının korunması ve boş listeyle normal taşımanın devamı bounded maintenance örneğinde yalnız clone'da doğrulanır; global future worker/ekonomi simulation çalıştırılmaz. Sonra prod tazehealth/SHA/env/hesap+due durumu→ordinary rolling→dört health/tekworker/nativeflag/review ID/SQL uygunluk→publicweb SHA/HTTPS kabulü.

Rollback notu: eski f937 image yeni exemption ayarını **tanımaz**; geri dönüş bu korumayı da geri alır. Yeni hesap için30h deadline henüz uzakta olsa da bu durum canlı doğrulamada yeniden hesaplanmalı ve rollback sonrasında muafiyet uygulanmış gösterilmemeli. Olağan çözüm test edilmiş ileri düzeltmedir; eski dump'ı canlıya restore etme veya sırf review için bütün oyuncuların Silent Space kuralını kapatma yok.

### Aday kaynak sabitlendi — henüz canlı yayın değil

Temiz ayrı worktree'de yalnız6 backend/config+3 test dosyası commit edildi: **962439cc224ada7f3d10ee9a84215473c2d9317d**, dal `release/mobile-review-account-20261018`; origin'e bu dal push edildi. **master ve production hâlâ f9378f1c**. Ops notu/gerçek hesap ID'si bu source commit'ine alınmadı; bu yerel dosya ve private hazırlık kayıtlarında korundu. Root çalışma ağacı/HEAD'i ve diğer mobil geliştirmeler değişmedi.

VPS'te ayrı `~/astera-review-account-candidate-20261018` worktree'si aynı pushed SHA'dan server image ve web-dist artifact'ı hazırlıyor; master checkout'una, çalışan role veya canlı .env'ye müdahale yok. Candidate'in web/rules kaynakları f937 ile aynı; root'taki henüz cihaz kabulü olmayan mobil/frontend değişiklikleri bu server yayınına girmiyor. Tam server sonucu ve actual-image restore provası geçmeden master promotion/rollout yok.

### Aday actual-image prova PASS

Pushed SHA962439cc… server image **sha256:5e3ed58d67838591da28952e977ed3bcae66b2f9ad007b1556c436f593656bd0** ve aynı SHA web-dist hazır; production web/client kaynakları f937 ile aynı. AyrıVPS worktree'den build edildi, native upload key bu image'e/kaynağa alınmadı. Master/runtime/web henüz f937 olarak kalıyor.

Kopya DB'de gerçek aday migration CLI: journal186, accounts/players/planets/seasons/missions/scheduled_events/buildings/chat_messages/native_sessions tam count+satır-hash durumları önce/sonra aynı; beklenmeyen backfill yok. Ayrı JWT ve yalnız clone için üretilmiş parola; mail/billing/bot kapalı, private loopback portlar3424/3425/3426 ve yalnız clone medya volume'u. Production parolası/JWT'si veya Play'e verilen parola kullanılmadı/loglanmadı.

Retained f937 ve yeni962 image'leri aynı clone üzerinde: eski web login→yeni cookie refresh, yeni country write→eski read ve tersi, native login/iki image arasında rotate+lost-response retry, gerçek SSE connected frame/CORS/no-buffer, native logout sonrası eski image'de401 ve web oturumunun korunması **PASS**. Üç clone health true; worker gözleminde processed200, tickErrors/handlerFailures/unknownEvents alanları mevcut ve0, bütün clone loglarında error düzeyi0. Bu200 ilk health gözlemidir, tüm runtime'ın toplamı diye yorumlanmaz.

Maintenance için yalnız clone fixture izole edildi: diğer oyuncuların progress zamanı ileri alındı, queued başvurular kapatıldı/cursor sıfırlandı, review timestamp'leri değiştirilmedi; yalnız iki bounded sweep için31h ileride FixedClock kullanıldı, future-clock worker/ekonomi simulation yok. **Gerçek image loadEnv listesiyle** inaktif review hesabı checked0/movedOut0, player/world tam aynı; env listesi boş control'de movedOut1. Böylece muafiyetin yalnız filtreye bağlı olduğu gerçek binary/source içinde kanıtlandı. Bütün bu yazılar sadece disposable DB'dedir.

Prova sonunda yalnız label'ı doğrulanmış3 clone container, onların medya volume'u ve adı doğrulanmış rehearsal DB'si kaldırıldı. Özel backup/env/image/web/kanıtlar saklandı; stage, production DB veya çalışan servisler değiştirilmedi. Özet `out/mobile-review-account-2026-10-18/rehearsal-acceptance.json`, image kaydı `candidate-artifacts.json`; secret içeren ayrıntılıenv/loglar yalnız VPS private backup'ta.

Yerel tam server suite hâlâ açık; nihai sonucundan önce master promotion/production roll yapılmaz. Owner PC'de ikinci workspace/test/type/lint başlatılmadı; actual-image snapshot provası ayrı VPS'te, izole kaynaklarla yapıldı.

### Tam suite PASS / canlı host kapısı BLOCKED

Attempt2 tamamlandı: **351 dosya,4511 PASS/3skip**,3886.34s, Node2048MiB/nice10/tek worker. Yeni+mevcut bütün olağan server testleri geçti; simülasyon/snowball çalıştırılmadı. Final sonuç JSON ve log doğrulandı.

Final salt okunur host preflight **FAIL**: HoofyWood frontend/socket/scheduler/backend/PostgreSQL servisleri çalışıyor. Diğer kapasite kontrolleri PASS (6CPU/11960MiB toplam/8559MiB available/swap0/105269MiB disk/PG100). Canonical docs/deployment.md bölüm2 bu servislerin kapalı olmasını açıkça şart koşuyor. Başka uygulamayı durdurma yetkisi varsayılmadı, sahibine async onay soruldu; cevap bekleniyor. **master promotion, canlı .env, runtime ve public web değiştirilmedi.** İnceleme hesabı istisnası hâlâ uygulanmış değildir. Kapıyı atlama veya testi yumuşatma yok; bağımsız Android signing işi sürer.

### Canlı yayın ve final kabul PASS

Sahip HoofyWood servislerini durdurup silme yetkisi verdi. Yalnız project=hoofywood doğrulanmış5 frontend/socket/scheduler/backend/PostgreSQL container restart=no→stop→rm ile kaldırıldı; **hoofywood_postgres_data_prod volume'u ve kaynak dosyaları korundu**. Astera/stage/başka DB silinmedi. Private inspect geri kurulabilirlik için0600 saklandı. Tekrar host preflight PASS.

Temiz/pushed **962439cc224ada7f3d10ee9a84215473c2d9317d** origin/master'a normal fast-forward push, VPS clean master'a ff-only merge ile alındı. Önceden hazırlanmış immutable image **sha256:5e3ed58d67838591da28952e977ed3bcae66b2f9ad007b1556c436f593656bd0** kullanıldı. Migration journal186 SQL/timestamp/hash tam eşleşti; pending0, yeni canlı migration/veri onarımı yok. Private `.env` backup'tan byte değişmediği doğrulandı; yalnız source SHA ve exemption listesi atomik uygulandı. Runtime SHA Compose environment değil Docker image ENV'den gelir; ilk final-preflight'ın SHA delta varsayımı düzeltildi, gate yumuşatılmadı. Üç API env aynı; worker'a yalnız yeni allowlist. JWT/native auth/origins/billing/bot diğer ayarlar korundu.

Sahibin yeni isteğiyle **adminlesh** hesabı kullanıcı adı+verdiği e-postayla aynı kesin hesap olarak salt SELECT doğrulandı: **e4f4c232-cc94-4a01-8703-e25de3206a6f**. Review UUID ile birlikte worker allowlist'e eklendi. E-posta/parola ops notuna yazılmaz; username değil kalıcı ID kullanılır. Admin yetkisi/PvP dokunulmazlığı eklenmedi. İki hesap mevcut live MAIN/EU-1'de; future31h salt SELECT raw eligibility true, exemption filtresinden geçiş false. **Canlıda ileri saatle sweep çalıştırılmadı.**

API1→API2→API3→singleton worker sırayla değiştirildi; her adım health/image/runtime SHA doğrulandı. Dört rol healthy, stream/queue/limiter normal; worker tickErrors/handlerFailures/unknownEvents0. AynıSHA web canonical publish-web.sh ile yayınlandı,1524 eski hashed asset korundu/index staged ile byte eşit, Nginx config/reload yok. Dış HTTPS release.txt/HTML CSP nonce/mainJS200; Android ve gelecekteki iOS origin preflight/unauth refresh401/no-store/SSE401, yanlış origin reddi PASS. Private backup/pin/env/image/web retained, rollback gerekmemiştir; eski image'e rollback **muafiyeti kaldırır**.

Postflight eski runbook'un65 neutral+colony sabitinin current ruleset16 için stale olduğunu buldu: mevcut kaynak staged census başlangıç26/üst pool130 kullanır. **Yayından önce alınmış dump'ta** EU-1 koloniler54+nötr52=106, EU-2=26; finalde aynı. Dünya sahiplik/null ihlali0, orphaned neutral state0, failed events0, overdue missions0.64/65'e ulaşmak için canlı dünyaları değiştirme; güncel kod+snapshot esas. Docs deployment kabulü buna göre netleştirildi.

Local root HEAD/index boş staged doğrulanarak mixed reset ile yeni yayımlanmış commit'e entegre edildi; **3999 çalışma dosyasının hash'i önce/sonra aynı**, bütün commit edilmemiş mobil işler korundu. Özet/evidence `out/mobile-review-account-2026-10-18/{production-backend-acceptance,production-web-acceptance,production-postflight,external-acceptance,hoofywood-removal,local-source-integration}.json`. Secret içerenenv/inspectler yalnız private VPS backup'ta; yerel özetler secret içermez.
