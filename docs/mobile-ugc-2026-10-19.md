# Mobil yayın: kullanıcı içeriği güvenliği — 19 Ekim 2026

Durum: mesaj/oyuncu şikâyeti, yönetici karar ekranı ve kayıt temizliği **yerelde uygulandı**. UGC yayın kapısı henüz kapanmadı. Kalıcı engelleme, içerik öncesi kural kabulü, uygunsuz adlara müdahale ve diğer içerik yüzeylerinin kabulü açık. Yeni kaynaklar production’a veya Play Console’a dağıtılmadı. Android önce, iOS sonra; bütün platformlar aynı API kurallarını kullanır.

## Resmî gereksinim ve mevcut özellikler

[Google Play UGC politikası](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en) 19 Ekim yeniden okundu: kullanıcılar içerik oluşturmadan ilgili kuralları kabul etmeli; uygunsuz içeriğe karşı devam eden moderasyon bulunmalı. Herkese açık içerikte uygulama içi kullanıcı/içerik bildirimi ve engelleme gerekir. Yalnız DM engellemesinin bulunması bütün kabulü karşılamaz. AdSense onayı ayrı bir incelemedir.

Kod envanteri:

- `services/dm.ts`: iki yönlü DM engeli mevcut; ilişki **playerId** tabanlı. Yeni sezon/oyuncu kimliğinde kalıcılık sağlamaz.
- `lib/chatMutes.ts`: hesap başına localStorage’da genel/klan mesajı gizleme mevcut. Cihazlar arası kalıcı değildir; DM engeliyle kapsamları farklıdır. Yönetici mesajları mevcut kişisel filtreyi geçer.
- `services/chatModeration.ts`: yöneticinin kanal bazında geçici/kalıcı susturması ve son mesajları maskelemesi mevcut. Yeni şikâyet kararı, bütün geçmişi değiştirmek yerine yalnız bildirilen mesajı hedefler.
- Binary yükleme `/api/admin/chat/media` ve `claimChatMedia` (YouTube dahil) **yalnız yöneticiye açık**. Normal oyuncuların fotoğraf/video yüklediği varsayılmamalı. Oyuncular yönetici medyasını görebilir.
- Mesajlar dışında komutan/gezegen/klan adları ve klan açıklaması da içerik envanterindedir. Yeni `message|player` raporu tek başına bütün bu yüzeylerin moderasyonunu tamamlamaz.

## Uygulanan ortak API

`services/contentReports.ts`, `routes/contentReports.ts` ve additive `0190_content_reports` / `0191_content_report_integrity` göçleri. Task DB journal192; production son bilinen journal186. Eski göçler yeniden yazılmadı.

| Uç | Yetki ve davranış |
|---|---|
| `POST /api/community/reports` | Oturum gerekli; mesaj veya oyuncu seçicisi, kapalı neden listesi ve en fazla1000 karakter açıklama;202 özel alındı. |
| `GET /api/admin/content-reports` | Yalnız yönetici; en eski100 bekleyen kayıt. |
| `POST /api/admin/content-reports/:id/resolve` | Yalnız yönetici; kesin rapor UUID’si ve `{action:MASK|DISMISS,confirm:true}`. |

Bütün yanıtlar/hatalar `no-store`. İstemci, yazar kimliği veya kanıt metni gönderemez. Sunucu gerçek mesaj/profil bilgisini kendi çözer. Mesaj görünürlüğü ortak `assertMessageReadable` üzerinden kontrol edilir: başka klan/DM/galaksiye uydurma seçiciyle erişilemez. Oyuncu hedefi aynı galakside olmalı; istisna, transfer sonrasında da okunabilen **mesajlı mevcut DM ilişkisi**dir. Bu istisna rastgele diğer galaksi profillerini açmaz. Konum bilgisi rapor yanıtında yoktur.

Bir hesap aynı hedef için tek kalıcı alındı alır; eşzamanlı çağrılar hesap advisory kilidi ve unique indeksle birleşir. Yeni kayıtlar paylaşılan güvenlik sayacında5/15dk bütçe tüketir; tekrar alındı bütçe tüketmez. İlk kayıt sonrası mesaj silinse bile aynı raportör kendi alındısını yeniden alabilir. Başarılı kayıt, içeriğin kaldırıldığı veya ceza verildiği anlamına gelmez; rapor sayısı otomatik ceza üretmez.

Karar, kesin mesajın `content:'**',media:null` güncellemesi, bildirim ve yönetici audit kaydı tek transaction’dadır. Audit hatasında hepsi geri alınır. Aynı kararın tekrarı ikinci audit üretmez; farklı karar409’dur. Zaten silinmiş mesaj başka içerikle değiştirilmez. Hesap silmeyle çakışmamak için ilgili hesap satırları, rapor satırından önce sıralı kilitlenir. Oyuncu raporuna `MASK`400 verir ve rapor beklemede kalır; yeni ad/ban politikası sessizce eklenmedi.

## Arayüz ve veri ömrü

Gerçek `ChatScreen` mesaj menüsünde “Bildir” bulunur. `ContentReportSheet`, mesaj/oyuncu seçimi, zorunlu neden, isteğe bağlı açıklama ve doğrulanmış alındı sunar. Kendi mesajı bildirilemez. İstek sürerken tekrar dokunuş tek POST’tur; hata taslağı korur. Engellenmiş/erişilemeyen DM’nin okunabilir eski mesajı bildirilebilir; cevap ve reaksiyon yeniden açılmaz. Yeni buton mevcut susturma/cevap sırasını korur.

`AdminPanel` → `AdminContentReports`: kanıt düz metin olarak gösterilir; HTML çalıştırılmaz, medya/iframe kendiliğinden açılmaz. Kesin mesaj kaldırma veya ret için açık inceleme onayı gerekir. Oyuncu raporunda mesaj kaldırma sunulmaz. Hatalı kuyruk boş kuyruk gibi gösterilmez; başarısız karar onayı sıfırlar. **Ekli medyayı yetkili biçimde elle inceleme yolu henüz tamamlanmadı.**

Şikâyet kaydı, oluşturulmasından30 gün sonra worker’ın dakikalık bakımında en fazla1000 kayıtlık `SKIP LOCKED` partilerle silinir; karar durumu saklamayı uzatmaz. Bozuk erasure-journal kaydı/dosya sistemi hatası diğer temizliği engellemez; her iş ayrı hata kaydıyla yeniden denenir. Filo çözümü bu bakımı beklemez; worker kapanışı arka plan işini bekler. Kesinti, kilit veya birikmiş işler süreyi uzatabilir; işletim takibi gerekir.

Raportörün hesabı silinirse kendi şikâyetleri cascade ile silinir. Bildirilen hesap silinirse bağlantısı kaldırılır; özel kanıt raporun kalan süresinde tutulabilir. Medya dosyalarının ayrı kopyası çıkarılmaz; hesap silme fiziksel dosyayı kaldırınca eski kanıt dosyası varmış gibi sunulmamalı. EN/TR privacy ve hesap silme sayfalarında bu istisna ve ayrı yedek süresi açıklanır. Bu sayfalar henüz yeni kaynakla canlıya alınmadı.

## Doğrulama kaydı

| Kontrol | Kanıt |
|---|---|
| İlk API | Gerçek route RED4FAIL →6PASS; özel404 tek başına önce eksik route nedeniyle geçiyordu, başarı kanıtı sayılmadı. |
| Karar/rollback/SQL/rate | Önce eksik resolve route ve kısıtlarda5FAIL; ardından13PASS. Kaybolan mesajın tekrar alındısı gerçek404 RED →202 GREEN. |
| Temizlik ve silme ilişkisi | TTL önce2 satır kaldığı için RED →15PASS; targetSETNULL/reporterCASCADE dahil. |
| Özel kanallar ve transfer | Klan/engelli DM kesin maskeleme testleri geçti. Transfer sonrası oyuncu raporu gerçek404 RED →18PASS. |
| Bakım hatalarının ayrılması | Bozuk imzalı-journal dosyasında TTL RED; ayrı hata işleme sonrası2 bakım senaryosu PASS. Son birleşik modül19 vaka içerir. |
| Silme/journal/şikâyet birleşimi |3 dosya54PASS; son bakım izolasyonu eklenmeden önceki kontrol. |
| Web regresyonu |9 dosya404PASS: yeni report UI11, chat89, DM13, mute12, i18n102, admin silme9, silme girişi5, public policy156, native publisher7. |
| Gerçek tarayıcı |6 dil ×350/1280px ×5 durum =60PASS; pageerror0/yatay taşma0. TR350 form ve admin görüntüleri ayrıca incelendi. Hesap silme destek formu dahil52 görünüm de PASS. |
| Tip/lint | Son server ve web typecheck PASS. Değişen UGC/ortak API/worker/schema/6 dil/harness dosyalarında lint0 hata. |

İlk tarayıcı kontrolü, seçim alanının etiketini doğru bulamadı. Kontrolün ayrı `id` / `label htmlFor` ilişkisi düzeltildi; test seçicisi gevşetilmedi. İlk web tip hatası DM fixture’ındaki `lastMessage:null`, sunucu tip hatası helper’ın `unknown` Fastify payload sınırıydı; gerçek sözleşme düzeltilerek kapandı, compiler-silencing cast eklenmedi.

Yerel loglar: `/tmp/astera-content-report-web-regression-final.log`, `/tmp/astera-content-report-peer-{red,green}.log`, `/tmp/astera-report-housekeeping-{red,green}.log`, `/tmp/astera-content-report-{server,web}-types-final.log`, `/tmp/astera-content-report-lint-r2.log`. Son worker/content-report geniş kontrolü **3 dosya62PASS**,147,76sn: şikâyet19 + worker37 + scheduling6 (`/tmp/astera-content-report-worker-regression-final.log`). Önceki bütün-proje sonuçları yeni kaynak için tam regresyon yerine kullanılamaz; yeni APK/Play kurulum kabulü yapılmadı. Ekonomi/sezon simülasyonu çalıştırılmadı.

Tarayıcı tekrarı: `WEB=http://127.0.0.1:5174 node tools/visual.mjs out/content-reports-2026-10-19 --content-reports`. Gerçek bileşenler ve fixture transport kullanır; gerçek hesap oluşturmaz, mesaj göndermez veya moderasyon uygulamaz. Görüntüler ve `results.json` aynı çıktı dizinindedir.

## Açık işler ve kararlar

1. Hesap kimliğine bağlı kalıcı engelleme ve yönetimi yerelde uygulandı; son kabul aşağıdadır. Production rollout ve yeni native pakette kabul açık. Mevcut yerel susturma ve DM-only engeli ayrı kalır.
2. Genel/klan filtresi, unread, alıntı/reaksiyon, eski cursor ve DM çift-kilidi yerelde test edildi. Filolar/PvP/ekonomi bu sosyal engelden etkilenmez. Son ortak kaynak kabulü ve rollout ayrıca gerekir.
3. İçerik öncesi topluluk kurallarının sunucu tarafından doğrulanan kabulü; eski ve yeni üyeler, kayıt/giriş ve bütün içerik oluşturma uçları birlikte incelenmeli.
4. İsim/klan/gezegen/açıklama yüzeylerinin bildirim ve gerçek moderasyonu; ekli medyanın yetkili incelemesi. Yalnız mesaj `MASK`i bütün UGC kapısını kapatmaz.
5. Owner’a uygunsuz komutan adında yalnız görünen adın tarafsız adla değiştirilmesi soruldu; giriş username ve ilerleme korunacak önerisi **yanıt bekliyor**. CLAUDE.md identity kuralı nedeniyle karar gelmeden uygulanmayacak. Normal oyuncu rename akışı varmış gibi mandatory-rename ekranı tasarlanmadı.
6. Onaylanmış silme hesabına yeni uçuş kabulü/PvP kararı da ayrıca yanıt bekliyor; önce kabul edilmiş uçuşların normal sonuçlanması korunacak.
7. Bütün kaynak için gerekli ordinary regresyon, yeni paket, ortak gerçek API ve native/Play cihaz kabulü. [Veri güvenliği envanteri](mobile-data-safety-2026-10-19.md) henüz Console’a gönderilmiş beyan değildir.

Bu kontrol noktasının kaynak SHA256 dökümü ve sınırları `out/content-reports-2026-10-19/verification.json` içindedir. Bu sınırlı dosya dökümü, native release aracının bütün paket sourceHash kabulünün yerine geçmez.

## Kalıcı engelleme dilimi — gereksinim ve etki

Yeni topluluk engeli ayrı, account UUID tabanlı ve cihaz/sezon bağımsızdır. Eski yerel susturma ve yalnız-DM engeli korunur; eski kayıtlar sessizce daha geniş kapsama taşınmaz. Yeni engel iki oyuncunun genel/klan mesajlarını birbirinden gizler ve iki yönde yeni DM’yi durdurur. Mevcut DM geçmişi raporlama için okunabilir; engelli içerik unread/alıntı/reaksiyon yollarından geri dönmemeli. Filo, saldırı, konum istihbaratı, ekonomi ve klan üyeliği değişmez.

`POST /api/community/blocks {targetPlayerId}` yalnız aynı galaksideki veya mesajlı mevcutDM ilişkisiyle bilinen kişiyi çözer; kendi hesabı/uydurma hedef/extraalan reddedilir. GET yalnız kendi engellerini, DELETE yalnız kendi accountUUID ilişkisini etkiler; galaksi seçmeden liste/engel kaldırma mümkün olmalı. En fazla500 ilişki; yeni eklemeler shared-rate-budget, tekrar/idempotent çağrı özgün zamanı korur. Hesap silme iki yöndeki ilişkileri cascade ile kaldırır.

Genel/klan sorgusunda engel filtresi LIMIT’ten önce ve unread ile aynı SQL koşulunda çalışır. Alıntı ve reaksiyonlar da ilişkili kişiyi sızdırmaz. DM gönderimi ile yeni engel account çifti advisory kilidinde sıralanır; eski DM player kilidinin sırası ve hesap-silme account→dependent sırası incelenir. Yeni engel kaldırılınca eski yalnız-DM engeli varsa kalır; UI kapsamları ayırır. Yeni UI gerçek sohbet menüsünden doğrudan engelleme ve başlıktan kalıcı engel yönetimi sunar; altıdil, ui-v2, 350px/desktop, açık etki/onay, hata ve single-flight kabulü gerekir. Önce gerçekAPI/UI RED, ardından uygulama ve mevcutchat/DM/account-deletion regresyonu.

Kalıcı engel ilkAPI gerçekRED7FAIL (routeyok).0192_community_blocks additive göç üretildi; eskiDMblock kayıtlarına dokunulmadı. İlkGREEN6PASS/1FAIL, klanbadgefixtureeski ruleset yüzünden özelliğikapalıydı; modernclanruleset+gerçekGET/api/clan/chat ile başarı kanıtı sıkılaştırıldı. Reaksiyon için doğruendpointte ayrıca gerçekRED200 (engellenmiş kullanıcı reaksiyon gönderebiliyordu) alındı; pairlock+yetki kontrolü ve rosterfiltresi eklendi. Yeni sezon playerrecreation testinde gerçekdemolish ile eskiplayer silinir ve aynıaccountyeniUUIDalır; DMhâlâ403 olmalı.

Kalıcı engel backend10PASS. Frontend gerçekChatHost/DM menüsünde6RED →6UI+1event+102i18n+13DM+12mute+11report = **145PASS**. İlkUI denemesinde erişilebilir isim bulunamadı: mevcutv2Button `ariaLabel` prop'u kullanıyor; HTML `aria-label` sessizce aktarılmıyordu, prop doğru sınırdan geçirildi. Accountblock ayrıcommunityBlockedByMe alanıyla eskiDMtoggle'dan ayrılır; manager açıkken event listesi ve bütün sosyalcache'ler güncellenir.

İleri regresyon: engelliDM'de kendi eski mesajına reaksiyon göndererek karşı tarafa bildirim gönderebilme gerçekRED200 yakalandı. Mesaj yazarı yerine DMçiftinin communityengeli de pairlock altında denetleniyor; historyraporlanabilirliği korunuyor. Yeni012vaka +mevcutmessage-interactions/DM testleri sırayla çalışıyor.

Kalıcı engel + mevcut DM/mesaj etkileşimleri **3dosya27PASS**. Regresyonda klan gönderim/okuma helper'ına accountId yerine actor.accountId gerektiği yakalanıp düzeltildi. Ek iki ağ/UXkenarı önceRED: engellenen sonmesaj paginationcursor'ı 400yapıp eski sayfalara geçişi bozuyordu; cursoroda/galaksi sınırı korunup görünürlük yalnız dönen satırlara uygulandı. Engellenen yazara hazırlanmışreplydraft açık kalıyordu; yalnız başarılıblocksonrası ilgili reply temizleniyor. Sonharness gerçekChatHost/Sheet, altıdil350/1280, uzunad+kısamesajmenüsü+onay/başarı/liste/unblock durumlarını ölçüyor.

Kalıcı engel browserharness **6dil×350/1280×6durum =72PASS**, panel/log dahil yataytaşma0 ve pageerror0. Gerçek TR350onay ve uzunadlı manager görüntüleri incelendi. Kaynak `tools/community-blocks-visual.mjs`, `node tools/visual.mjs out/community-blocks-2026-10-19 --community-blocks`; API fixture, gerçek hesap değiştirilmedi. Maksimum500 ilişki, DBfailure rollback ve oppositeblock+inflightDM regresyonları eklendi. Privacy/data-safety notlarına engelilişkisinin30günlükreportTTL'den ayrı olarak kaldırma/hesapsilmeye kadar yaşadığı işlendi.

## Topluluk kurallarını kabul etme dilimi — gereksinim ve etki

Yeni kayıt/Academy claim, komutan adı diğer oyunculara yayımlanmadan önce geçerli kullanım/topluluk kural sürümünü açıkça kabul eder. Mevcut hesapların girişi, oturumu, dünyaları ve okunabilir geçmişi kapanmaz; yeni içerik göndermeden önce bir kez kabul gerekir. Kabul, cookie/reklam izni değildir. Checkbox kendiliğinden seçilmez; metin/bağlantılar oyuncunun dilinde gösterilir, desteklenmeyen public hukuk dili EN/TR mevcut fallback sözleşmesini kullanır.

Sürüm ortak saf sözleşmede sabitlenir; sunucu account/version/locale/acceptedAt kaydını tutar ve aynı sürüm tekrarında ilk zamanı korur. Eski veya eksik sürüm yeni publickayıt/claim için anlamlı403 verir; mevcut login protokolü değişmez. Henüz mağazada yayımlanmış Android sürümü yoktur; yeni adayın bütün kayıt/claim istemcileri aynı sürümü açıkça gönderir. Eski web sekmesi veya eski debugAPK yeni kayıt için güncellenmeli; bu rollout kısıtı gizlenmez. Gelecekte sürüm artırımı, yayımlanmış native istemci ve metinler birlikte planlanmadan yapılmaz.

GET/POST `/api/community/policy` authenticated/no-store; başka hesabın kabulü yazılamaz. Kamuya/başka oyunculara içerik oluşturan chat/DM/klan metni ve emoji uçları sunucu guard'ı taşır. Şikâyet, engelleme, hesap silme, mevcut geçmişi okuma ve normal oyun emirleri kabulden bağımsız kalır. Yeni hesapta kabul kaydı hesapla aynı transaction'da; eski claim yeniden denemesinde parola doğrulanmadan mevcut hesaba kabul yazılamaz. Kayıt hesap silmeyle cascade olur. Yanlış sürüm, locale, extraalan, auth, concurrentretry, disk/DBfailure, mevcutgiriş, frontendnetworkfailure, eskiAPI, altıdil ve nativeURL testleri zorunlu. Ordinaryfixture'lar kabul etmiş aktif oyuncuyu açıkça modelleyecek; negatif test bu kaydı kaldırarak gerçekguard'ı sınayacak. Gizli varsayılan kabul veya yalnız istemci checkbox'ına güvenme yok.


###19Ekim kural kabulü uygulama kontrolü

Sunucu sosyal regresyonu **5dosya64PASS**: community-policy14, community-blocks16, content-reports19, message-interactions8, DM7. Log `/tmp/astera-community-policy-social-regression.log`. Klan kurmada eksik guard gerçek409RED, klan açıklaması değişiminde gerçek200RED yakalandı; her iki servis kural kabulünü mutasyondan önce doğruluyor. Yeni emoji kabul gerektirir; önceki reaksiyonun kaldırılması kabul gerektirmez. DBtrigger ile kabul yazma hatasında yeni hesabın da rollback olduğu doğrulandı. Auth/native/Academy önceki108PASS kontrolüyle birlikte mevcut oturumları kapatan bir kural göçü yapılmadı.

Frontend kayıt/sohbet11PASS ilk kabulü: yeni claim checkbox varsayılanboş, kanıt version+locale API'ye açıkça aktarılır. Kabulün sunucu cevabı gelmeden composer açılmaz; outage/POSTfailure/çifttap/yeniAPIversiyonu senaryoları doğrulandı. Genel/klan/DM yazma alanı ve klan kurma/açıklama değiştirme yüzeyi aynı küçük ui-v2 gate'i kullanır; keşif, üyelik kontrolleri, geçmiş, raporlama ve engelleme ayrı kalır.6dil metin ve hata eşlemesi eklendi. EN/TR public kurallar sürüm2026-10-19 ve gerçek raporlama/engel adımlarıyla güncellendi; privacy kabul kanıtının hesap silmeyle kaldırılmasını açıklar. Güncel geniş web/type/lint/browser sonuçları henüz tamamlanmış sayılmaz.

Adminin yayıncı duyuruları editoryal içeriktir; normal oyuncular bu uçları kullanamaz. Medya yükleme admin ile sınırlı olsa da mesaj gönderimi ortak chat guard'ından geçer. Admin raporlanmış medyayı yetkili olarak inceleyebilme ve komutan/klan kimliği moderasyonu sonraki ayrı dilimdir; yalnız metin mask'ı bunları kapatmaz.

19Ekim resmî UGC belgesi yeniden açılıp okundu: https://support.google.com/googleplay/android-developer/answer/9876937?hl=en . Kabul, içerik yükleme/oluşturma öncesi; uygulama içi kullanıcı/içerik bildirimi, birebir etkileşimde engelleme ve devamlı gerçek moderasyon birlikte gerekiyor. Cinsel içerik iznine yönelik incidental-content istisnası ayrıca varsayılan filtre ve yaş taraması koşulları taşıyor. Astera bu istisnaya dayanmaz; kurallarda cinsel içerik yasaklanır. Yalnız yasak metni yazılması moderasyonun işletildiğini kanıtlamaz.


### Raporlanmış medya incelemesi — gereksinim/kenarlar/etki

Admin kuyruğundaki ekli medyanın gerçekten incelenmesi eksik. Yeni GET `/api/admin/content-reports/:id/media` yalnız yetkili operatöre, hâlâbekleyen ve30günden yeni raporun sunucudan alınmış exactasset'ini döndürmeli. Query ile asset/path seçilmez. Normal oyuncu403, anonim401, bilinmeyen/kapalı/süresidolmuş/youtube/missingfile/mismatch404. Asset'in mime/kind/byte boyutu kanıtla eşleşmeli; private no-store/nosniff, mevcut range/sınırlıstream davranışı korunmalı. Bearer ve aynıorigin media refreshcookie kimliği desteklenmeli; kaynaksohbetin özel klan/DM üyesi olmak operatör incelemesi için şart değildir. Bu, genel media yetkisini genişletmez. Hesap silmeyle fizikselmedya silinmişse yenidenkopya yaratılmaz; UI erişilemediğini açıklar.

Yeni operatör UI medyayı açıkça açana kadar hiçbir dosya/iframe yüklemez; kapatmada abort/blobcleanup ve hesap değişiminde mevcut native session sınırı korunur. Video controls/preload ile, autoplay olmadan; YouTube otomatik iframe yerine doğrulanmış videoId'den açık dışbağlantı ile incelenir. API hamdosyaID'si seçen bir adminarşivtarayıcısına dönüşmez. Etki: chatmedia stream helper'ının korunması, ayrı adminroute+istemci boundedmedia adaptörü ve moderasyonrow; oyun/chat gönderimi/evidenceTTL/erasure sahipliği değişmez. Önce server ve UI gerçekRED, ardından uygulama, native media/rapor regresyonu ve6dil browser kontrolü.


Kural kabulü gerçek browser kabulü: `WEB=http://127.0.0.1:5174 node tools/visual.mjs out/community-policy-2026-10-19 --community-policy` → **86statePASS** (6dil×350/1280×7durum +EN/TRnoJS). Varsayılan boş/onaybutonudisabled, POSTbaşarısızlığı, yenidenbaşarı, outage, yenisürüm, kayıtboş/kabul durumları; taşma/pageerror0. TR350sohbet ve claim görüntüleri görüldü. Sonradan başlayan tümweb ordinary çalışması 19eski/eksikfixture beklentisi yakaladı (nativecompact landing seçimi15, sitemap6dil beklentisi1, kayıt/claim requestproof2, adminchatfixtureacceptance1); bu çalışma kesildi ve tamkabul sayılmadı. Düzeltmeler sonrası bu5modül119PASS. Yeni reportmediaUI henüz4RED. Tamordinaryregresyon yeni medya dilimi bitince tekrar çalıştırılacak.

Raporlanmış medya backend ilkRED: 3FAIL/1mevcut404PASS; yetkili200 yerine route404, range/extraquery beklentileri eksik. UI4RED, gerçek kuyrukta açma/dışvideo bağlantısı yok. Loglar `/tmp/astera-report-media-red.log`, `/tmp/astera-report-media-ui-red.log`. Bunlar gerçek yeni davranış eksikliği; eski404ün geçmesi özellik kanıtı değildir.


Rapor medyası ek kabul: backend6PASS; native-cookie/bearer yetkisi, privateDM nonparticipantoperatörün yalnız bildirilenexactmedyayı incelemesi, normalmediaendpointinin404kalması, sessionrevoke401, queryselector400/range206/416, mesajmasksonrasıkanıt,30günsınırı/kapanış ve silinmişdosya testleri geçti (`/tmp/astera-report-media-server-recheck.log`). Önceki ortak31test denemesinde sadece cacheheader beklentisi yakalandı: onSend mevcutprivate no-store başlığını no-store'a indiriyordu; hook mevcutbaşlığı koruyacak biçimde düzeltildi. Chatmedia8 ve report19 aynıdenemede geçmişti; son ortakdosya tekrarından önce tümünü tekGREENrun diye raporlama.

Webreportmedia/nativeattachment/policy/i18n **7dosya138PASS** (`/tmp/astera-report-media-web-green.log`). Yeni7vaka gerçek4UI+3clientRED'denGREEN. Adminmedya kapalıyken img/video/iframe yok; imageexplicitopen, hata/yenidenaçma, videopreloadnone/noautoplay, YouTubeexplicitexternallink. Native yeni yol, sohbet medyasıyla aynı boundedstream/tokenrefresh/sessiongeneration/objectURLcleanup helper'ını kullanır; web report-bound URL/HttpOnlycookie yolunda kalır. Bu inceleme normal oyuncuların YouTube embed davranışını değiştirmez; DataSafety/reklam açık konusu devam eder.

Rapor medya gerçek browser kabulü:6dil×350/1280×5durum=**60PASS**, yataytaşma/pageerror0 ve üçüncütaraf medya isteği0. Kapalı/image/error/video/YouTube linki; video preloadnone ve autoplayyok. `tools/content-report-media-visual.mjs`, `node tools/visual.mjs out/content-report-media-2026-10-19 --content-report-media`; TR350imagegörseli incelendi. Gerçek kanıt/hesap kullanılmadı. İlk requestprobe yalnız URLmetninde youtube arayıp yerelTiptapmodülünü yanlışlıkla üçüncütaraf sayıyordu; probe hostname ile sınırlandı ve60durum geçti.
