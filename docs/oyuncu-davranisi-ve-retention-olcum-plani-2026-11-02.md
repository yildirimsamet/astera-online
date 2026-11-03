# Oyuncu davranışı, oturum ve geri dönüş ölçümü — uygulama planı

Tarih: 2 Kasım 2026

Durum: Uygulama planı; bu belge özelliğin uygulanmış veya yayımlanmış olduğunu bildirmez.

**Onboarding kaynak güncellemesi — 3 Kasım 2026:** FlightSchool artık çalışma ağacında
`App.tsx` tarafından açılan eğitimdir. Aşağıdaki release/master/worktree ayrımları
2 Kasım kaynak envanterini anlatır; güncel giriş yolunu belirlemek için
[review-onboarding.md](review-onboarding.md) ve mevcut import zinciri kullanılır.

Amaç: Oyuncunun ne zaman geldiğini, hangi aşamaları gördüğünü, ne yapabildiğini, hangi engellerle karşılaştığını ve daha sonra geri dönüp dönmediğini inceleyebilmek.

## 1. Belgenin dayanağı ve sınırları

Bu plandaki **mevcut durum** ifadeleri kod incelemesine dayanır. **Yapılacak** ifadeleri yeni geliştirme gereksinimleridir; mevcut bir özelliğin açıklaması değildir. Aşağıdaki sayısal eşikler, aksi belirtilmedikçe bu planın v1 uygulama kararlarıdır; ölçülmüş kapasite veya oyuncu davranışı iddiası değildir. İşin tamamlanma süresi, retention artışı veya oyuncuların bırakma nedeni için tahmin verilmez.

Onboarding referansı `dfa5f5452e7aa1bdab29117837c8cded5c137be2` release commit'indeki `FlightSchool` uygulamasıdır. Akademi değişikliğinin commit'i `a04095f5`; dalı `codex/academy-release-20261102`'dir. Bu belge hazırlanırken ana çalışma kopyası `6287fdf49ede22ea71080c47bf8fe5d56a2c52d5` master commit'indedir; FlightSchool bu master'da bulunmaz. Akademi referansı okunurken ilgili release commit'i kullanılmalıdır. Eski `blindspace-onboarding` çalışma kopyası, bu planın uygulanacağı onboarding değildir.

### 1.1 Kodda doğrulanan mevcut durum

| Konu | Doğrulanan davranış | Kaynak dosya / sembol |
| --- | --- | --- |
| Aktif onboarding | `App` içindeki Academy lazy import'u `FlightSchool`'a gider. | Release: `apps/web/src/App.tsx` |
| Eğitim yapısı | `SCHOOL_SCENES`, 11 bölüm altında 37 sahne tanımlar. Sahne kimlikleri açık dizelerdir. | Release: `onboarding/flightSchool/scenes.ts` |
| Eğitim taşıması | Ayrı QueryClient ve kimliksiz Api, `schoolFetch` kullanır; eğitim oyun istekleri gerçek fetch'e düşmez. | Release: `FlightSchool.tsx`, `api.ts`; `flight-school-api.test.ts` |
| Eğitim geçmişi | Eylem/zaman geçmişi `astera.flight-school.v1` anahtarında yerel tutulur; yenilemede yürütülerek eğitim durumu yeniden kurulur. | Release: `storage.ts`, `restoreSchool`, `saveSchool` |
| Gerçek oyuna geçiş | FlightSchool claim callback'ine `[]` gönderir; eğitim durumu aktarılmaz. Başarılı callback sonrasında yerel geçmiş temizlenir. | Release: `FlightSchool.tsx`, claim callback'i |
| Erken çıkış | Eğitimden erken çıkış ve son sahneden ilerleme kayıt diyaloğunu açar. Ödülsüz tekrar ayrı `replay` bağlamıdır. | Release: `FlightSchool.tsx`, `finishRead`, `SchoolCoach.onExit` |
| Açıklama | `SchoolCoach` metni zaman içinde gösterir; tam gösterim ve sonraki eylem ayrıdır. | Release: `SchoolCoach.tsx` |
| GA4 | Form kayıt/giriş ve claim sonrasında olay çağrıları bulunur. Yeni FlightSchool'da eski Academy'nin `tutorial_skip` çağrısı bulunmaz. | `session/useSession.ts`, release `FlightSchool.tsx`, eski `Academy.tsx` |
| Platform kapsamı | `webAnalytics` yalnız web için açıktır. Android için yerel bildirim ve native push capability'leri vardır. | `platform/runtime.ts`, `resolveCapabilities` |
| Son etkinlik | `Presence.touch`, `refreshReturnActivity` üzerinden `lastActiveAt` günceller. `requireAuth` bu çağrıyı yapar. | `services/presence.ts`, `services/returnQueue.ts`, `routes/auth.ts` |
| Son ilerleme | `markProgress`, geliştirme/savaş emriyle `lastProgressAt` günceller. Bu alan bütün insan etkileşimlerinin geçmişi değildir. | `services/waitingRoom.ts`; çağıran oyun servisleri |
| Kuyruk başlangıcı | `placeBuildOrder`, `startedAt` değerini önceki işin `readyAt` değerinden veya mevcut zamandan kurar. Bu alan her sipariş için emrin verildiği an değildir. | `services/buildQueue.ts`, `placeBuildOrder` |
| Claim tekrarı | `claimAccount`, kullanıcı adı mevcut ve parola doğruysa mevcut hesabı doğrulayabilir. Başarılı claim tek başına yeni hesap demek değildir. | `routes/onboarding.ts`, `claimAccount` |
| Rapor görünürlüğü | Görünür ve ön plandaki rapor yüzeyi ilgili bildirimleri görüldü işaretler. Sunucu kaydı bir boolean'dır. | `session/useReadReportSignals.ts`, `services/session.ts`, `markNotificationsSeen` |
| Push durumu | `settlePaidAlert`, taşıyıcı çağrısından önce `SENT` yazar. Taşıyıcı yokluğu veya taşıma hatası bu durumu teslim kanıtına dönüştürmez. | `services/notificationCenter.ts`, `settlePaidAlert`; `services/fcm.ts` |
| Admin kapsamı | `listAdminPlayers` son 15 dakikada etkinlik göstermiş gerçek oyuncuları listeler. | `services/adminPlayers.ts` |
| Sezon temizliği | `wipeAllServers`, `request_log` ve `players` dahil sezon verilerini siler; reclaim de oyuncu kayıtlarını kaldırır. | `services/servers.ts`, `services/reclaim.ts` |
| Hesap silme | Hesaba bağlı tabloların temizlenmesi açıkça yönetilir; analitik için henüz eklenmiş bir temizleme yoktur. | `services/accountDeletion.ts` |
| Saklama kuralı | Kişisel veri içerebilen günlükler ve özel yayın yedekleri için owner sınırı en fazla 30 gündür. | [Mevcut saklama kararı](mobile-log-retention-2026-10-19.md) |

Release'e özgü dosyaları kontrol etmek için `git show dfa5f5452e7aa1bdab29117837c8cded5c137be2:<dosya-yolu>` kullanılır. Kaynak referansının çalışma kopyasında bulunmaması, dosyanın hiç yazılmadığı anlamına gelmez.

### 1.2 Çıktılar

- Kayıt öncesinden başlayabilen, izin kapsamı belirli ziyaret ve eğitim geçmişi.
- Hesap bazında oturumlar, gözlenen ön plan süreleri ve gerçek manuel işlem zamanları.
- Eğitim, hesap açma ve ilk gerçek oyun aşamalarındaki kayıp tabloları.
- Teknik sorun, işlem engeli, sonuç görünürlüğü ve bildirimden dönüş kayıtları.
- Admin için oyuncu zaman çizelgesi ve sürüm/kampanya bazında geri dönüş raporları.
- Ölçümün eksik olduğu, kapanışın çıkarıldığı veya bir nedenin bilinmediği durumları açıkça belirten raporlar.

Bu çalışma oyun dengesi, eğitim kurgusu, kaynak ödülleri, savaş, Silent Space kuralları veya bildirim ücretlerini değiştirmez. Bildirim ölçümü, mevcut teslim mekanizmasını yeniden tasarlama işi değildir. Otomatik yeniden etkinleştirme mesajı gönderimi ve ekran/video kaydı bu planın kapsamında değildir.

## 2. Ortak uygulama kuralları

1. Her adımın geliştirmesi `CLAUDE.md` içindeki TDD sırasını izler: gereksinim ve senaryolar → test → FAIL → uygulama → PASS → inceleme → ilgili regresyonlar. Bu belgenin yazılması oyun kodu değişikliği değildir.
2. Analitik hizmetinin kapalı, yavaş veya hatalı olması oyun işlemini başarısız yapamaz. Başarısız analitik kaydı için kaynak, ödül, filo veya kuyruk işlemi geri alınamaz.
3. `training`, `live` ve `replay` bağlamları ayrı tutulur. Eğitim sonuçları gerçek ekonomi, gerçek savaş veya ilk gerçek manuel işlem metriğine giremez.
4. İstemcinin anlattığı olay, `client_observation`; gerçek sunucu işleminden üretilen olay, `server_fact`; rapor hesabı, `derived` olarak sınıflanır. İstemci `server_fact` yazamaz.
5. Sunucu kabul/teslim zamanı enjekte edilen sunucu saatinden alınır. İstemci zamanı ve cihaz içi süre ayrı alanlardır. Güvenilmeyen istemci saati oyun gerçeğini veya saklama sınırını belirleyemez.
6. Başarı, tekrar gönderim ve otomatik bitiş ayrıdır. Bir eylem birden fazla kanaldan görünse de aynı başarıyı iki kez sayamaz.
7. Hiç alınmamış bir olay, gerçekleşmediğinin kanıtı değildir. Raporlar ölçüm kapsamını ve eksik veriyi gösterir.
8. Bot, admin ve kontrollü test trafiği retention raporlarından sunucuda ayrılır. Normal client sözleşmesine bot işareti eklenmez.
9. Oyuncu içeriği yerine sınırlı olay alanları tutulur. Parola, token, sohbet/DM metni, form içeriği, tam URL/query ve ekran kaydı toplanmaz.
10. Her adımın kabul kanıtında kullanılan commit, test, veri kapsamı ve başarısızlıklar kaydedilir. Hazırlık veya birim testi, üretimde çalıştığı iddiası olarak sunulmaz.

## 3. Adımların sırası

| Adım | İş | Bağımlılık |
| --- | --- | --- |
| 01 | Uygulama tabanı ve kaynak envanteri | Yok |
| 02 | Ölçüm tanımları ve olay sözlüğü | 01 |
| 03 | İzin, veri minimizasyonu ve kapsam | 02 |
| 04 | Ziyaret kimliği, hesap bağlantısı ve kampanya kaynağı | 03 |
| 05 | Analitik veri modeli ve sunucu alımı | 02–04 |
| 06 | İstemci taşıması ve kayıp/tekrar yönetimi | 05 |
| 07 | Oturum ve ön plan/etkileşim ölçümü | 06 |
| 08 | Yeni akademinin sahne ve çıkış ölçümü | 06–07 |
| 09 | Kayıt, giriş, yerleşme ve gerçek oyuna ulaşma | 04–08 |
| 10 | Gerçek manuel işlemler ve doğru emir zamanı | 05, 09 |
| 11 | Sonuç görünürlüğü, engeller ve temel oyun döngüsü | 08–10 |
| 12 | Teknik hata ve hafif performans ölçümü | 06–09 |
| 13 | Bildirim ve oyuna geri ulaşma zinciri | 07, 09, 11 |
| 14 | Sezon/hesap yaşam döngüsü ve saklama | 05–13 |
| 15 | Geri dönüş, aşama kaybı ve veri kalitesi hesapları | 07–14 |
| 16 | Admin raporları ve oyuncu zaman çizelgesi | 15 |
| 17 | Uçtan uca doğrulama, yük ve hata izolasyonu | 01–16 |
| 18 | Aşamalı yayın, kabul ve geri alma | 17 |

Adımların kabul kriterleri geçmeden bağımlı adım tamamlandı olarak işaretlenmez. İzin metni veya platform beyanı için çözülmemiş bir karar, bağımlı davranış ölçümünü etkinleştirmek için varsayımla doldurulmaz.

## Adım 01 — Uygulama tabanını ve kaynakları sabitle

### Ne yapılacak?

Uygulamanın hangi kod tabanına ekleneceği ve her olayın hangi gerçek noktadan üretileceği kayda geçirilecek.

### Neden?

Yeni FlightSchool ile master'daki eski Academy aynı giriş uygulaması değildir. Yanlış dalda yazılan ölçüm, oyuncunun kullandığı akışta hiç çalışmayabilir veya terk edilmiş akışı raporlayabilir.

### Nasıl yapılacak?

1. Uygulama başlangıcında master, seçilen çalışma dalı, üretim API/worker revision'ı ve yayımlanmış web girişinin referans verdiği onboarding chunk'ı salt okunur doğrulanacak.
2. FlightSchool, `SCHOOL_SCENES`, claim, gerçek oyun kabuğu, auth, bildirim ve admin kaynak yolları kaydedilecek. İncelenen dosya commit'i bu envantere yazılacak.
3. Her olay için üretici fonksiyon/bileşen, bağlam, doğruluk kaynağı ve mevcut test dosyası eşleştirilecek.
4. Yeni analitik modülleri çalışma dalına eklenecek; eski onboarding worktree'sindeki değişiklikler bu işe taşınmayacak.
5. Başlangıç envanterinde `lastActiveAt`, `lastProgressAt`, `request_log`, kuyruk zamanları ve mevcut GA4 çağrılarının bu belgede açıklanan sınırları korunacak.

### Dikkat edilecekler

- Üretimde eski hash'li asset'in bulunması onun aktif giriş olduğu anlamına gelmez; `index.html` ve onun giriş bağımlılığı takip edilecek.
- Branch adı tek başına yayın kanıtı sayılmayacak.
- Çalışma kopyasındaki kullanıcı değişikliklerine müdahale edilmeyecek.

### Kabul kriterleri

- [ ] İncelenen web ve sunucu revision'ları kaydedilmiş; aktif onboarding import'u gösterilmiş.
- [ ] Envanterde her planlanan olayın üretim noktası ve `training/live/replay` bağlamı var.
- [ ] Uygulama dalında güncel FlightSchool kaynakları mevcut; eski gerçek oyun rehberini uygulama bağımlılığı yapan bir değişiklik yok.
- [ ] Mevcut oyuncuların geçmişini bu yeni ölçüm varmış gibi tamamlayan bir backfill kararı yok.

## Adım 02 — Metrikleri ve olay sözlüğünü tanımla

### Ne yapılacak?

Ziyaret, oturum, etkinlik, manuel işlem, ilk oyun, dönüş ve aşama kaybı tek anlamla tanımlanacak; istemci ve sunucu aynı sürümlü sözlüğü kullanacak.

### Neden?

Formdan giriş sayısı, token yenilemesi ve yeniden oynamaya gelme farklı şeylerdir. Aynı isme farklı anlamlar verilirse doğru kayıtlar bile yanlış rapor üretir.

### Nasıl yapılacak?

1. Yeni ortak sözleşmede olay adı, şema sürümü, üretici, tetikleme koşulu, izinli alanlar, tekrar anahtarı ve zaman anlamı belirtilecek. Paket seçimi mevcut bağımlılık kurallarına uyacak; saf `rules` paketine ağ, saat veya I/O eklenmeyecek.
2. V1 oturum kuralı: Aynı tarayıcı sekmesi/native uygulama bağlamında son gözlenen ön plan etkinliğinden sonra **30 dakika veya daha fazla** boşluk varsa sonraki ön plan gelişi yeni oturumdur. Daha kısa arka plan geçişi aynı oturumda yeni ön plan dilimidir. Açık logout mevcut hesaba bağlı oturumu kapatır.
3. Sayfa yenilemesi ve token yenilemesi tek başına yeni oturum açmaz. Farklı cihaz/sekme ayrı oturum tutar; hesap başına toplam ön plan süresinde çakışan dilimler birleştirilir.
4. `foreground_ms`: gözlenen ön plan dilimleri. `interaction_ms`: ön planda, son gerçek dokunma/klavye/harita etkileşimini izleyen **60 saniyelik** pencerelerin birleşimi. Bu pencere ölçüm tanımıdır; dikkat veya okuma kanıtı değildir.
5. `first_game_ready`, gerçek hesap ve galaksi verisiyle ilk kullanılabilir oyun yüzeyi hazır olduğunda oluşur. Eğitim veya yalnız API cevabı bu olayı oluşturamaz.
6. `first_manual_command`, gerçek oyunda oyuncu eylemiyle sunucunun kabul ettiği ilk kayıtlı oyun işlemidir. Eğitim işlemi, başlangıç hibesi, otomatik worker, admin ve bot işlemleri hariçtir. Kaynak toplama, geliştirme, üretim, araştırma ve geçerli görev gönderimi ayrı işlem türleri olarak korunur.
7. `last_observed_at`, ön plan gözlemi veya gerçek oyuncu işleminin sonudur. 24/48/72 saat etiketleri bundan hesaplanır; mevcut presence alanının anlamı değiştirilmez.
8. Her olayda veri bağlamı ile doğruluk kaynağı ayrı alan olur: `mode` ve `source` birbirinin yerine kullanılmaz.

### Dikkat edilecekler

- Arka plandaki otomatik sorgular, SSE mesajı, push token kaydı ve analitik yeniden gönderimi oyuncu etkileşimi değildir.
- Bir sonucun oluşması, ekrana gelmesi ve okunması aynı metrik değildir. “Okundu/anlaşıldı” sonucu yalnız görünürlük olayından üretilmez.
- Oturum boşluk eşiği, Silent Space eşiğini değiştirmez.

### Kabul kriterleri

- [ ] Her metrikte başlangıç, bitiş, dahil/hariç koşulları ve veri kaynağı yazılı.
- [ ] 29 dakika 59 saniye boşluk ve tam 30 dakika boşluk farklı beklenen sonuçlarla test edilmiş.
- [ ] İki sekmede aynı 10 dakikalık dönem, hesap toplamında 20 dakika sayılmıyor.
- [ ] Token yenilemesi oturum sayısını; worker bitişi manuel işlem sayısını artırmıyor.
- [ ] Sözlük dışı olay ve alanlar şemadan reddediliyor.

## Adım 03 — İzin, veri minimizasyonu ve ölçüm kapsamını kur

### Ne yapılacak?

Hangi verinin hangi izin ve amaçla alınacağı uygulama sözleşmesine bağlanacak; ölçülemeyen kullanıcılar raporda görünmezce “oynamadı” sayılmayacak.

### Neden?

Mevcut consent modülü Google sinyallerini yönetir; native'de `webAnalytics` kapalıdır. Bunlar yeni birinci taraf davranış toplamasının kendiliğinden açık olduğu anlamına gelmez.

### Nasıl yapılacak?

1. Mevcut oyun işlem kaydı, teknik işletim kaydı ve yeni isteğe bağlı davranış ölçümü ayrı veri sınıfları olarak envantere yazılacak.
2. Yeni davranış ölçümünde politika uygunluğu (`policy_eligible`), tercih (`granted/denied/unknown`) ve platform desteği (`available/unavailable`) ayrı tutulacak. Toplama yalnız bu üç koşulun izin verdiği durumda açık olacak. Google CMP'nin yönettiği web ile uygulamanın kendi tercih akışı birbirine varsayımla eşitlenmeyecek.
3. Yeni isteğe bağlı davranış kaydı ve kalıcı ziyaret kimliği, tanımlı izin koşulu sağlanmadan oluşturulmayacak/gönderilmeyecek. Native için ayrı capability ve tercih bağlantısı kurulacak; `webAnalytics` açılarak geçiştirilmeyecek.
4. Tercih geri alındığında davranış toplama duracak; gönderilmemiş isteğe bağlı kuyruk temizlenecek. Yerel kimlik kapsamı ve server tarafındaki silme/anonymization işi Adım 14 ile bağlanacak.
5. Alanlar allowlist ile sınırlandırılacak. Teknik hata metinleri ve stack'ler kişisel veri/URL/token temizliğinden geçirilecek; ham form/body kaydedilmeyecek.
6. Gizlilik açıklaması ve platform veri beyanlarında yeni veri akışını karşılayan değişiklikler hazırlanacak. Bu belgelerin yayımlanma durumu kabul kaydında belirtilecek.

### Dikkat edilecekler

- Bildirim izni, analitik izni değildir. Hesap/topluluk koşulları kabulü de analitik izni yerine geçmez.
- İstemciye gelen `account_id` alanı tek başına veri yazma yetkisi vermez.
- İzin verilmeyen geçmiş olaylar, izin sonradan verildi diye geçmişe dönük yüklenmez.
- Tam cihaz parmak izi, tam IP, tam referrer ve reklam tıklama token'ları olay alanı olmayacak.

### Kabul kriterleri

- [ ] İzin öncesi ve ret halinde yeni davranış isteği, kalıcı ziyaret kimliği veya kalıcı davranış kuyruğu oluşmuyor.
- [ ] Geri alma sonrası yeni olay gönderilmiyor; bekleyen isteğe bağlı olaylar yeniden açılışta da gönderilmiyor.
- [ ] Web/native izin yolları ve `unknown` durumu ayrı testlerle doğrulanmış.
- [ ] Otomatik kişisel veri temizleme testi parola/token/URL/query/chat örneklerini olay gövdesinden çıkarıyor.
- [ ] Admin raporu ölçülen hesap sayısını ve ölçüm kapsamını gösteriyor; ret/eksik veri başarısız oyuncu gibi sınıflanmıyor.

## Adım 04 — Ziyaret kimliğini, hesap bağlantısını ve kampanya kaynağını kur

### Ne yapılacak?

Kayıt öncesi izinli ziyaretin eğitim ve kayıt yolculuğu, doğrulanmış hesapla ilişkilendirilecek; kampanya bilgisi sınırlı ve açık kaynakla tutulacak.

### Neden?

Yeni akademi hesap öncesidir. Aynı tarayıcıda farklı hesaplara geçilebildiği için yalnız ortak localStorage kimliğine dayanmak yolculukları yanlış kişiye bağlayabilir.

### Nasıl yapılacak?

1. Yeni izinli ziyaret için rastgele `visitor_id`; her eğitim denemesi için `training_attempt_id`; her sekme/native bağlamı için `context_id` oluşturulacak. Yenilemede devam ile sıfırdan başlatma ayrı kaydedilecek.
2. Sunucu anonim alım için sınırlı ömürlü bir ziyaret yetkisi verecek. Hesaba bağlama yalnız aynı ziyaret yetkisi ve doğrulanmış hesap oturumu birlikte bulunduğunda yapılacak. Kullanıcının serbest yazdığı bir `account_id` veya ziyaret UUID'si bağlama için yeterli olmayacak.
3. `identity_link` yalnız mevcut ziyaret/deneme kapsamını bağlayacak. Ortak cihazdaki önceki hesabın olayları yeni hesaba taşınmayacak. Logout ve hesap değişiminde eski hesaba ait bekleyen batch yeni token ile gönderilmeyecek.
4. İlk ve mevcut ziyaret kaynağı ayrı tutulacak. İzinli alanlar: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`; her biri en fazla 128 karakter, kontrol karakterleri temizlenmiş ve allowlist şemasıyla doğrulanmış olacak.
5. UTM yoksa `unknown/direct_observed` ayrımı açık veriyle yapılacak; bir hesap Twitter reklamı verildiği gün açıldı diye Twitter'a atanmayacak. Referrer kullanılacaksa yalnız normalize edilmiş origin saklanacak, path/query saklanmayacak.
6. İstemci/akış sürümü, web/native, PWA görünüm modu, arayüz dili ve gerçekten kullanılan eğitim metni dili ayrı alanlar olacak. Cihazlar arası bağlantı yalnız doğrulanmış aynı hesaptan kurulacak.

### Dikkat edilecekler

- Rastgele kimlik, cihaz parmak izi değildir; silinmiş depoyu aşarak kimlik kurmaya çalışılmayacak.
- Kayıtlı eski hesabın menüden eğitim tekrarı, yeni oyuncu eğitimi cohort'una girmeyecek.
- Kampanya verisi kimlik doğrulama veya gameplay kararı için kullanılmayacak.

### Kabul kriterleri

- [ ] Eğitim → kayıt akışı tek ziyaret ve doğru hesap altında birleşiyor.
- [ ] A hesabından çıkıp B hesabına giren cihazda A geçmişi B'ye bağlanmıyor.
- [ ] Başkasının ziyaret kimliğini göndermekle hesap bağlantısı kurulamıyor.
- [ ] Yenilemeyle devam eden eğitim denemesi ile kullanıcı tarafından yeni başlatılan deneme ayrılıyor.
- [ ] Kaynağı olmayan ve engelleyici nedeniyle ölçülemeyen ziyaretler reklam kampanyasına uydurularak atanmıyor.

## Adım 05 — Veri modelini ve sunucu alım sınırını ekle

### Ne yapılacak?

Mevcut PostgreSQL'de sınırlı analitik kayıtları, güvenli batch alımı ve admin okumaları için veri temeli kurulacak.

### Neden?

`request_log` idempotency içindir ve sezon temizliğinde silinir. Oyun tablolarını sınırsız sorgulamak veya bütün ham API cevaplarını saklamak yolculuk kaydı ihtiyacını doğru çözmez.

### Nasıl yapılacak?

1. Yeni Drizzle şeması ve additive migration hazırlanacak. Kavramsal tablolar: `analytics_visitors`, `analytics_sessions`, `analytics_events`, `analytics_daily_aggregates`. Kesin sütunlar Adım 02 sözlüğünü karşılayacak; genel amaçlı sınırsız JSON deposu kurulmayacak.
2. Olay zarfı en az `event_id`, `schema_version`, `name`, `source`, `mode`, `context_id`, `session_id`, `sequence`, `occurred_at_client`, `received_at`, sürüm ve sınırlı `properties` taşıyacak. Hesap/oyuncu/season/shard bağlantısı sunucuda doğrulanacak.
3. Yeni `/api/analytics/events` batch sınırı: **32 olay**, açılmış JSON gövdesi en fazla **32 KiB**, tek properties gövdesi en fazla **2 KiB**. Bilinmeyen alanlar ve istemciden `server_fact` gönderimi reddedilecek.
4. Kimlik doğrulama, mevcut token doğrulama mekanizmasını kullanacak fakat `Presence.touch` çağırmayacak. Anonim ziyaret yetkisi ve hesap erişimi ayrı doğrulanacak.
5. Analitik için ayrı limit anahtarı/bütçesi uygulanacak: context başına dakikada **6 batch**; hesap veya anonim ziyaret için dakikada **12 batch**. Anonim yetki oluşturma ayrıca sınırlanacak. Analitik retleri oyun isteği kotasını tüketmeyecek.
6. Retry için `event_id` benzersiz olacak. Sunucu olayları ayrıca işlem türü + kalıcı kaynak kimliği + geçiş türü üzerinden tekilleştirilecek. Aynı olay kimliğine farklı payload gönderimi çatışma olarak reddedilecek.
7. Olay zaman/pagination indeksleri `account/time`, `session/sequence`, `visitor/time` okumalarını ve süreli temizliği karşılayacak. Oyuncu kimliği sezon snapshot'ı olacak; zorunlu `players` FK'siyle rollover engellenmeyecek.
8. Olay alım yanıtı alındı/tekrar sayısını döndürecek. Hiçbir oyun durumunu, presence alanını veya kuyruğunu güncellemeyecek.
9. Sunucu gerçeğinin gerçekleşme zamanı kaynak işlemden; istemci gözleminin sırası `context_id + sequence` ve monoton sürelerden alınacak. İstemci mutlak zamanı ayrıca `trusted/untrusted/unknown` olarak işaretlenecek. Düzeltilemeyen saat veya 24 saatlik gönderim ömrü dışındaki olay kesin bir geçmiş saate yerleştirilmeyecek; belirsizlik ve ret nedeni kalite kaydına yazılacak. Veri alım zamanı ile olay zamanı ayrı kalacak.

### Dikkat edilecekler

- Zod/şema doğrulaması istemcinin anlattığı eylemi sunucu gerçeği yapmaz.
- Olay içindeki sezon ve oyuncu UUID'si geçmiş bağlam olabilir; güncel placement ile uyuşmazlık sessizce başka sezona yazılmayacak. Tarihsel bağlam ve yetki ayrı doğrulanacak.
- Payload sınırı parse işleminden önce de uygulanacak; limitsiz batch açılmayacak.
- Analitik tabloları normal oyun API select'lerine ve client cevaplarına sızmayacak.

### Kabul kriterleri

- [ ] Boş/geçersiz batch, 33 olay, 32 KiB üzeri gövde, sahte kaynak ve yabancı hesap denemeleri test edilmiş.
- [ ] Aynı batch iki API replikasına gönderildiğinde tek olay kümesi var.
- [ ] Kabul edilen analitik batch öncesi/sonrası `lastActiveAt`, `lastProgressAt`, return queue expiry, wealth ve kaynaklar aynı.
- [ ] Analitik rate limit'i dolduğunda normal gameplay isteği kullanılabilir durumda.
- [ ] Migration eski kayıtları değiştirmiyor; eski API ile additive şema uyumluluğu test edilmiş.

## Adım 06 — İstemci kuyruğunu ve taşımasını kur

### Ne yapılacak?

İzinli olayları oyunu bekletmeden gönderen; kesinti, tekrar, logout ve kapanış durumlarını sınırlı kaynakla yöneten taşıyıcı eklenecek.

### Neden?

Yalnız uygulama kapanırken gönderilen olaylar, son aşamaları kaybedebilir. Her tıklamada ayrı ağ isteği ise oyuna gereksiz yük ekler.

### Nasıl yapılacak?

1. Yeni `analytics` istemci modülü oyun mutation'ından bağımsız kuyruk tutacak. Normal ön planda **15 saniyede bir** veya batch sınırına ulaştığında gönderim denenecek. Batch, **32 olay veya 32 KiB gövde sınırından hangisine önce ulaşırsa** orada bölünecek; boyut UTF-8 serileştirilmiş gövdeden hesaplanacak. Aynı context'te tek uçuşta batch olacak.
2. Kuyruk sınırı context başına **256 olay veya 256 KiB** olacak. Dolunca en eski isteğe bağlı olaylar düşürülecek; düşen adet/sınıf, kişisel içerik olmadan kalite sayacına yazılacak. Oyun belleğini sınırsız büyüten geri basınç kurulmayacak.
3. İzinli kalıcı kuyruk en fazla **24 saat** tutulacak; ret/logout/hesap değişimi kapsam sınırları Adım 03–04'e uyacak. Kuyruk, eğitim kurtarma kaydından ayrı olacak; `clearSchool` analitik teslim durumunu yönetmeyecek.
4. Geçici ağ/5xx hatasında sırasıyla **5, 15, 60 saniye** bekleme; devamında en fazla 60 saniyelik bekleme uygulanacak. `Retry-After` varsa en az o süre beklenecek. Şema/yetki gibi kalıcı 4xx hataları sonsuz tekrar edilmeyecek.
5. Arka plana geçerken küçük batch için `fetch` ve desteklenen ortamda `keepalive` denenecek. Bearer header'ı gerektiren alım `sendBeacon` ile çalışıyormuş gibi yazılmayacak. Native taşıma ve izinli origin/CORS sınırı mevcut platform mimarisiyle test edilecek.
6. Gönderim callback'leri kendi olaylarını tekrar üretmeyecek. Telemetri isteğinin hatası, tekrar telemetri hatası üreten döngüye girmeyecek.
7. Sunucu alım saati saklama sınırının tek kaynağı olmayacak; eski bir olayı yeniden göndererek izin verilen ham veri ömrü uzatılamayacak. Yaş ve saat güvenilirliği Adım 14'e göre yönetilecek.

### Dikkat edilecekler

- Olayın kuyruğa girmesi teslim kanıtı değildir.
- App kill/OS askıya alma halinde son batch'in ulaştığı garanti edilmez.
- Yavaş analitik yanıtı oyun düğmesini pending bırakmayacak; Promise oyun işleminin başarısına bağlanmayacak.
- İzin geri alınırken devam eden batch ve local queue yarışları test edilecek.

### Kabul kriterleri

- [ ] Kesinti ve yeniden bağlanmada aynı event ID korunuyor; server sayısı şişmiyor.
- [ ] 24 saatlik eski kuyruk ve sınırı aşan yük temizleniyor; bellek/disk sınırları geçilmiyor.
- [ ] Logout/hesap değişimi sonrası eski olay yeni hesabın token'ıyla gönderilmiyor.
- [ ] Analitik servisi cevap vermese de inşa/gönderim akışı tamamlanıyor.
- [ ] App kill, izin geri alma, kalıcı 400 ve geçici 503 senaryoları sınırlı tekrar davranışıyla test edilmiş.

## Adım 07 — Oturum, ön plan ve etkileşim dilimlerini ölç

### Ne yapılacak?

Uygulama açılışı, görünür olma, arka plan, son gözlem ve gerçek etkileşim dilimleri tutulacak; bunlardan Adım 02'deki oturumlar üretilecek.

### Neden?

Mevcut `lastActiveAt` geçmişi saklamaz. Ön planda açık bırakılan oyun ve gerçekten işlem yapılan ziyaretin ayrı gösterilmesi gerekir.

### Nasıl yapılacak?

1. `platform/activity.ts` içindeki ortak `watchAppActivity`/`isAppActive` kullanılacak. İkinci, bağımsız native/DOM lifecycle dinleyicisi oluşturulmayacak.
2. İlk native durum yanıtı başlangıç durumunu kuracak; otomatik olarak “geri geldi” olayı sayılmayacak. Ön plana geçiş ve arka plana geçiş ayrı dilim olayları olacak.
3. Yalnız ön plandayken **60 saniyede bir** heartbeat alınacak. Pointer hareketlerinin tamamı değil; gerçek pointerdown, keydown ve oyun haritası etkileşimlerinden son etkileşim anı bellekte güncellenecek. Koordinat/tuş içeriği gönderilmeyecek.
4. Ön plan ve etkileşim süreleri cihazın monoton saatiyle hesaplanacak. Heartbeat en son görünür yüzeyi, son etkileşim zamanını ve süre artışlarını taşıyacak; her heartbeat için ayrı kalıcı olay biriktirmek yerine oturum özeti güncellenecek.
5. **120 saniyeyi aşan gözlem boşluğu** otomatik olarak kesintisiz oynama süresine eklenmeyecek. Aradaki zaman bilinmiyor olarak işaretlenecek. 30 dakikalık oturum sınırı, gözlenmeyen süreye oynama süresi eklemek için kullanılmayacak.
6. Kapanış olayı gelmezse oturum zaman aşımıyla kapatılacak; `last_observed_at` son alınan gözlemde kalacak. Bitiş türü `observed_background`, `logout` veya `inferred_timeout` olarak gösterilecek; arka plan olayı “uygulama kesin kapandı” diye sunulmayacak.
7. UTC olay zamanı ve ölçülen yerel UTC offset'i ile saat/gün dağılımı üretilecek. Yerel saat değişimi, saat dilimi değişimi ve gece yarısı oturum bölme gerekçesi olmayacak.

### Dikkat edilecekler

- Heartbeat, OS'nin uygulamayı öldürme anını veya oyuncunun dikkatini kanıtlamaz.
- Arka plan otomatik sorguları, analitik retry ve push token senkronizasyonu süreyi uzatmaz.
- Çift sekme toplamı hesapta birleşirken tek tek oturum geçmişi kaybolmaz.
- Ölçüm kimliği yeniden başlatma ve veri temizleme nedeniyle değiştiyse cihazlar parmak iziyle birleştirilmez.

### Kabul kriterleri

- [ ] Ön planda 5 dakika, arka planda 20 dakika, tekrar ön planda 3 dakika senaryosunda ön plan toplamı 8 dakika; arka plan dahil değil.
- [ ] Birbiriyle çakışan iki sekme hesap toplamını ikiye katlamıyor.
- [ ] Beklenmedik process kill sonrası kapanış `inferred_timeout`; bitiş son gözleme dayanıyor.
- [ ] Native ilk durum ve çift DOM/native callback'i tek geri dönüş üretmiyor veya çift saymıyor.
- [ ] Heartbeat ve etkileşim testlerinde presence/ilerleme alanları değişmiyor.

## Adım 08 — FlightSchool sahnelerini ve eğitim çıkışını ölç

### Ne yapılacak?

Yeni akademinin her sahnesi için görünürlük, açıklama, kullanılabilir kontrol, eylem, bekleme ve sonuç geçişi kaydedilecek; erken çıkış/tamamlama/yeniden devam ayrılacak.

### Neden?

Sunucuya aktarılmayan eğitim eylemlerinden, yalnız gerçek gezegen tablolarına bakarak kayıp aşaması çıkarılamaz. Sahne yüklenmesi ve metin gösterimi, oyuncunun karar bekleyişinden ayrılmalıdır.

### Nasıl yapılacak?

1. `SCHOOL_SCENES` kimlikleri olayların kararlı sahne anahtarı olacak. `scene_index` tek anahtar olmayacak; `training_version` ve olay şeması sürümü birlikte tutulacak.
2. `training_started`, `training_resumed`, `training_scene_visible`, `training_text_revealed`, `training_action_ready`, `training_action_accepted`, `training_result_visible`, `training_scene_completed`, `training_exit_requested` ve `training_completed` olayları açık tetiklerle tanımlanacak.
3. İlk sahne görünürlüğü yalnız gerekli sahne hazır ve ön planda olduğunda yazılacak. `onSceneReady` ile sonraki sahne/control görünürlüğü ayrı değerlendirilecek; ilk callback bütün sahneler için hazır kanıtı sayılmayacak.
4. `SchoolCoach.onRevealed` yalnız “metin tamamen gösterildi” anlamında kullanılacak. Elle metni açma ile sonraki sahneye geçme ayrı tutulacak; okuma/anlama iddiası kurulmayacak.
5. `schoolAction` ile kabul edilen eylem tek kaydedilecek. `tickSchool` ile üretim/uçuş tamamlanması oyuncunun yeni eylemi sayılmayacak. Bekleme türü `text`, `scene_preparation`, `order`, `flight`, `user_action` olarak ayrılacak.
6. Normal son sahneden kayıt diyaloğuna geçiş `completed`; erken eğitim çıkışı `skipped`; menüden tekrar `replay` olarak etiketlenecek. Diyaloğun açılması, kayıt veya gerçek oyuna geçiş başarısı sayılmayacak.
7. Yenilemede `restoreSchool` kullanılırken eylem geçmişi yeniden analitik olay olarak basılmayacak; yalnız devam olayı ve mevcut görünür sahne yazılacak.
8. Ölçüm bağımlılığı FlightSchool'un izole `schoolFetch` taşıyıcısına eklenmeyecek. Üst uygulamadan, izin denetimli ve gameplay'den ayrı bir olay çıkışı verilecek. Analitik kapalıyken eğitim hiçbir ek ağa ihtiyaç duymadan çalışacak.

### Dikkat edilecekler

- 3 saniyelik eğitim üretimi gerçek oyundaki süre veya ilerleme metriği değildir.
- Sahne state'inin ilerlemesi, sonucunun oyuncuya gösterildiğini tek başına kanıtlamaz.
- Kontrolün DOM'a eklenmesi, ekran içinde kullanılabilir olmasına eşitlenmez; mevcut el/çerçeve hedef bulma ve görünürlük kurallarıyla doğrulanacak.
- Mevcut depolama sürümü, analitik eklemek için eğitimi sıfırlayacak biçimde değiştirilmeyecek.

### Kabul kriterleri

- [ ] 37 sahnenin her biri için beklenen başlangıç/bitiş ve eylem kaynağı test tablosunda var.
- [ ] İlk sahnede çıkış, son sahnede tamamlama ve ödülsüz replay üç farklı analitik sonuç üretiyor.
- [ ] Yenileme, önceki üretim/savaş/scene_completed olaylarını ikinci kez saymıyor.
- [ ] Metin açma ve Devam aynı olay değil; arka planda geçen süre aktif sahne süresine eklenmiyor.
- [ ] Analitik kapalı testte `schoolFetch` gerçek oyun fetch'ine düşmüyor; analitik açık testte yalnız izinli ölçüm alımı kullanılıyor.
- [ ] Eğitim claim'i yine `[]` gönderiyor; eğitim filosu, kaynakları ve başarıları gerçek oyun işlem sayısını artırmıyor.

## Adım 09 — Kayıt, giriş, yerleşme ve gerçek oyuna ulaşmayı ayır

### Ne yapılacak?

Oyuncunun eğitimden hesap kimliğine, ardından gerçek galaksiye geçişi ayrı başarı/hata aşamalarıyla kaydedilecek.

### Neden?

Eğitimi bitirip kayıt formunda kalmak, hesap açıp yerleşememek ve oyuna girip işlem yapmamak farklı sorunlardır. Tek `sign_up` olayı bunları ayıramaz.

### Nasıl yapılacak?

1. Claim diyaloğunda isim adımının gösterilmesi/geçilmesi, parola/onay adımının gösterilmesi ve gönderim girişimi kaydedilecek. İsim/parola/ülke formunun ham içeriği alınmayacak; yalnız adım kimliği ve sınırlı hata kodu tutulacak.
2. İstemci girişimleri kararlı `attempt_id` taşıyacak. Sunucu kaynaklarından `account_created`, `authenticated_existing`, `placement_completed` gerçekleri ayrılacak. `claimAccount` retry fallback'i yeni hesap oluşturma metriğini artırmayacak.
3. `useSession` içindeki restore, formdan login, claim, yeniden deneme ve `blocked` durumları ayrı sonuç kodlarıyla bağlanacak. Başarılı token refresh yeni login/session olayı üretmeyecek.
4. Hesap oluşturma ile placement ayrı commit olabiliyorsa her ikisinin sonucu ayrı yazılacak; `SHARD_FULL`, doğrulama hatası, ağ hatası ve 5xx aynı “oyuncu vazgeçti” sonucuna çevrilmeyecek.
5. Gerçek `WorldProvider` verisi, oyun kabuğu, kullanılabilir kontroller ve ilk sahne hazırlığı tamamlandığında `game_ready` üretilecek. Aynı oturumda her render veya her query yenilemesi yeni game_ready olmayacak.
6. `game_ready` kaydı kullanılan giriş yolu, eğitim sonucu/versiyonu, istemci/sunucu sürümleri ve gerçek season/shard bağlamını taşıyacak.
7. Client'a henüz ulaşmamış başarı ile görülen başarı ayrılacak. Sunucuda hesap oluşturulup cevap kaybolduğunda sonraki deneme aynı hesabı doğru tanıyacak; analiz iki kayıt saymayacak.

### Dikkat edilecekler

- Başarısız login olayına kullanıcı adı/e-posta eklenmeyecek; yabancı hesap eşleştirmesi yapılmayacak.
- Eğitimdeki standart başlangıç mesajının gösterilmesi, oyuncunun gerçek başlangıcı gördüğü anlamına gelmez.
- Mevcut eski web/native istemciler yeni opsiyonel ölçüm alanlarını göndermediğinde auth/claim çalışmaya devam edecek.

### Kabul kriterleri

- [ ] Aynı kayıt isteğinin tekrarında bir account_created; birden fazla girişim kaydı var.
- [ ] Mevcut hesapla başarılı claim, yeni hesap sayısını artırmıyor.
- [ ] Yerleşme başarısızlığı ve oyun görünümünün yüklenememesi raporda ayrı aşamalar.
- [ ] Oyun hazır olmadan sekmeyi kapatan hesap game_ready olarak sayılmıyor.
- [ ] Restore/refresh işlemi ilk manuel işlem veya yeni kayıt sayılmıyor.
- [ ] Eski auth/claim/native contract testleri yeni alanlar olmadan geçiyor.

## Adım 10 — Gerçek manuel işlemleri doğru zaman ve sahiplikle kaydet

### Ne yapılacak?

Oyuncunun kabul edilmiş geliştirme, üretim, araştırma ve diğer gerçek oyun işlemlerinin zamanını; işlemin planlanan başlangıcı ve otomatik tamamlanmasından ayıran kayıt kurulacak.

### Neden?

Bir saat sonra başlayan kuyruk işi, oyuncunun bir saat sonra yeniden geldiğini göstermez. Gezegen el değiştirdikten sonra güncel sahibinden geçmiş işlem sahipliği çıkarmak da yanlış kişiye etkinlik yazar.

### Nasıl yapılacak?

1. İnşa ve araştırma için değişmez `ordered_at`, emri veren hesap snapshot'ı ve işlem kaynağı metadata'sı eklenecek. `started_at`/`ready_at` mevcut kuyruk anlamını koruyacak. Metadata normal client sipariş cevabına otomatik taşınmayacak.
2. Görevlerde launch owner ve `depart_at` alanlarının yazıldığı/değiştiği bütün yollar incelenecek. Gerçek gönderim anını ve aktörü değişmez biçimde tutan mevcut alanlar doğrudan kullanılacak; aynı gerçeği tutan ikinci zaman alanı eklenmeyecek. Bu koşulu sağlamayan işlem türü, doğru zaman/aktör metadata'sı eklenmeden doğrulanmış manuel etkinlik kaynağı yapılmayacak.
3. İşlem kaynakları sunucuda ayrılacak: oyuncu isteği, başlangıç/eğitim hibesi, worker, admin ve bot. İstemci bu kaynağı seçemeyecek.
4. `command_committed` yalnız transaction başarıyla commit olduktan sonra üretilecek. Idempotency replay bir accepted daha üretmeyecek; transaction rollback hiçbir başarı üretmeyecek.
5. Analitik aktarım commit sonrasında sınırlı taşıma ile yapılacak. Analitik yazma başarısızlığı oyun transaction'ına taşınmayacak. Kalıcı kaynak satırı bulunan işlemler için ayrı worker işi, kaynak kimliği üzerinden eksik olayları tekrar çıkaracak; tekrarlar tekilleştirilecek.
6. Kuyruğa önceden verilen ikinci/üçüncü işin `ordered_at` değerleri oyuncu eyleminde alınacak; kuyruk reflow/cancel/tempo değişimi bunları güncellemeyecek.
7. Kaynak toplama, sipariş iptali ve benzeri eylemlerde kalıcı tekrar üretilebilir kaynak bulunmuyorsa olayın teslim sınırlılığı sözlükte belirtilecek. Bu eylemler için kayıp olmayan tarihçe varmış gibi rapor üretilmeyecek.
8. Eski satırlara planlanan başlangıçtan `ordered_at` tahmini doldurulmayacak; yeni metadata'nın başladığı tarih raporda gösterilecek.
9. Aynı kabul edilmiş kaynak kayıtlarından olayları tekrar çıkaran recovery işi `received_at` zamanını geçmişteki emir zamanı yerine kullanmayacak; source occurrence, aktör ve olayın ilk ölçüm kapsamı korunacak. Olay kimliği kayıt/işlem/geçişten kararlı üretilerek canlı aktarım ve recovery aynı olaya birleşecek.

### Dikkat edilecekler

- `markProgress` bütün manuel etkinlikler için genel analitik hook'u olmayacak; kapsamı farklıdır.
- Gezegenin güncel sahibi yerine işlem anındaki aktör kullanılacak.
- Başarılı emirden sonra ağ cevabı kaybolması, işlemin başarısız olduğu anlamına gelmez; attempt, commit ve client sonucu ayrı tutulacak.
- Recovery taraması yeni dönemle sınırlı, indeksli ve batch olacak; her admin sayfası açılışında bütün oyun tabloları taranmayacak.

### Kabul kriterleri

- [ ] Aynı anda kuyruğa verilen ve bir saat arayla başlayacak işlerde ordered_at değerleri gerçek emir anına; started_at değerleri kuyruk sırasına ait.
- [ ] Reflow/cancel/yeniden zamanlama ordered_at ve aktörü değiştirmiyor.
- [ ] Çift istek/idempotency replay ve worker tekrar teslimi başarı sayısını şişirmiyor.
- [ ] Rollback ve analitik kesintisi oyun sonucunu bozmuyor; kalıcı kaynaklı eksik olay recovery ile bir kez tamamlanıyor.
- [ ] Gezegen devri ve Silent Space transferi geçmiş işlemi yeni sahibin/galaksinin olayı yapmıyor.
- [ ] Eski emirler “zamanı bilinmiyor”; yeni manuel emirler açık başlangıç kapsamıyla raporlanıyor.

## Adım 11 — Sonuç görünürlüğünü, engelleri ve oyun döngüsünü ölç

### Ne yapılacak?

Oyuncunun hangi yüzeyi kullandığı, yapmak istediği işlemin neden engellendiği, hangi sonucu gördüğü ve sonrasında hangi eylemi yaptığı bağlanacak.

### Neden?

“Görevi bitti ama dönmedi”, “döndü fakat sonucu bulamadı” ve “sonucu gördükten sonra oynamadı” aynı sorun değildir. Yalnız inşa sayısı, Astera'nın keşif/karar/etkileşim döngüsünü açıklamaz.

### Nasıl yapılacak?

1. `surface_visible` kararlı yüzey adlarıyla kaydedilecek: üs, geliştirme ayrıntısı, filo/üretim, galaksi, keşif/istihbarat, görev gönderimi, savaş/sonda raporu, klan ve arena. Render/query başına olay yazılmayacak.
2. `command_attempted`, `command_blocked` ve `command_committed` ortak bir action/attempt bağlantısıyla ayrılacak. Engel kodları kaynak, yakıt, ön koşul, kuyruk doluluğu, uygun filo yokluğu, koruma, menzil/ulaşılabilirlik ve sistem hatası sınıflarına bağlanacak; mevcut oyun kodu varsa aynen korunacak.
3. Disabled kontrol için yalnız ekranda gösterilen engel `blocker_visible` olarak kaydedilecek. Kullanıcı tıklayamıyorsa “denedi ve reddedildi” denmeyecek. Aynı yüzey/engel aynı görünürlük diliminde tekrar spam edilmeyecek.
4. Worker sonucu `outcome_resolved`; ilgili sonucu ön planda başarılı yüklenen yüzeyde sunma `outcome_visible` olacak. Referans görev/sipariş/rapor kimliğiyle ilişkilendirilecek.
5. `useReadReportSignals` görünürlük sınırı yeniden kullanılacak; mevcut `seen=true` alanından geçmiş bir seen zamanı uydurulmayacak. Yeni olay, bildirimi topluca okundu işaretleme işlemiyle karıştırılmayacak.
6. Madencilik, keşif/sonda, ticaret, PvE/PvP, koloni, klana katılma ve arena için ayrı işlem türleriyle ilk kullanım ve sonraki ziyaret incelenecek. Sohbet için yalnız başarılı kullanım sayısı/kanal türü; içerik ve konuşulan kişi listesi alınmayacak.
7. Her son oturum özetinde son görünür yüzey, son manuel işlem, son görülen engel/sonuç ve varsa devam eden işlerin kimlik/tür özeti tutulacak. “Neden bıraktı” otomatik kesin hükmü üretilmeyecek.

### Dikkat edilecekler

- API'de yüklenmiş fakat kapalı/arka planda kalan rapor görünmüş sayılmaz.
- Savaş kaybından sonra dönmeme korelasyonu neden kanıtı değildir. Savaştan önce ayrılmış kişi “savaş yüzünden bıraktı” grubuna konmaz.
- Arena'ya geçişte mevcut sayfa reload'u oyun çıkışı gibi yorumlanmayacak; ürün modu değişimi ayrıca tutulacak.
- Kamera koordinatları, her sürükleme karesi ve özel istihbarat içerikleri toplanmayacak.

### Kabul kriterleri

- [ ] İşin bitmesi, sonucun ekrana gelmesi ve sonraki manuel eylem üç ayrı zamanla sorgulanabiliyor.
- [ ] Gizli mounted rapor, başarısız yükleme ve arka plan, outcome_visible üretmiyor.
- [ ] Bir işlemde gösterilen engel ile server reddi bağlantılı ama iki ayrı başarısız emir gibi sayılmıyor.
- [ ] Disabled kontrol etkileşim yapılmadan “denendi” olarak kaydedilmiyor.
- [ ] PvP kaybı yaşamamış veya kayıptan önce ayrılmış oyuncu kayıp-sonrası gruba girmiyor.
- [ ] Arena/eğitim/sosyal etkinlikler kendi bağlamında; gerçek manuel ekonomi/savaş sayısını yanlış artırmıyor.

## Adım 12 — Teknik hataları ve hafif performans özetini bağla

### Ne yapılacak?

Oyuncunun gördüğü yükleme/bağlantı/hata durumları, son aşamayla ilişkilendirilecek; teknik sorun nedeniyle kaybolan yolculuklar ayrılabilecek.

### Neden?

Mevcut admin performans kaydı ve cihazdaki crash kaydı, bütün oyuncuların ayrılma öncesindeki teknik durumunu merkezi olarak göstermiyor.

### Nasıl yapılacak?

1. Başlangıç zincirinde shell JS çalıştı, kimlik yüklemesi başladı/bitti, gameplay veri hazır, 3D ilk hazır kare ve game_ready süreleri ayrı ölçülecek. JS hiç çalışmadığında client olayı olmadığı açık kalacak; kayıt yokluğu otomatik oyuncu vazgeçişi olmayacak.
2. `ErrorBoundary`, temizlenmiş `error`/`unhandledrejection`, WebGL context kaybı ve lazy chunk yükleme hatası sınırlı hata kimliğiyle bağlanacak. Mevcut crash ekranı ve yerel kurtarma çalışmaya devam edecek.
3. API merkezi katmanında route şablonu, action correlation, cevap kodu, normalize hata kodu, gecikme ve toparlanma sonucu tutulacak. Otomatik token refresh sonrası başarılı olan işlem nihai auth başarısızlığı gibi raporlanmayacak.
4. Ön planda **60 saniyelik** pencerelerde FPS/uzun kare/uzun görev/ağ hata sayısı özeti üretilecek; her frame veya saniye için ham kayıt gönderilmeyecek. Yüksek ayrıntılı mevcut admin recorder bütün oyunculara açılmayacak.
5. Aynı hata parmak izi aynı oturumda **en fazla 5 ayrıntı olayı** gönderecek; fazlası sayaç olarak tutulacak. Ham metin yerine temizlenmiş bounded alanlar ve build kimliği kullanılacak.
6. Analitik taşımasının kendi hataları aynı kullanıcı hata hattına girmeyecek. Genel servis arızası ve sürüm bazlı hata artışı mevcut operasyonel metriklerle zaman üzerinden karşılaştırılacak.

### Dikkat edilecekler

- App kill veya OS bellek sonlandırması için gözlenmeyen bir crash olayı uydurulmaz.
- Düşük FPS ile ayrılmanın birlikte olması tek başına neden kanıtı değildir.
- Kaba platform/browser ailesi ve viewport sınıfı yeterli olacak; GPU/cihaz parmak izi toplanmayacak.

### Kabul kriterleri

- [ ] React hatası, WebGL kaybı, chunk hatası ve ağ kesintisi kendi sınıfıyla aynı oturuma bağlanıyor.
- [ ] Token refresh ile toparlanan işlem kalıcı başarısızlık grubuna girmiyor.
- [ ] Tekrarlayan hata ve render döngüsü olay sınırlarını aşmıyor.
- [ ] Hata mesajı/stack'e eklenmiş token/query/kişisel metin temizleme testinden geçiyor.
- [ ] Teknik ölçüm açık/kapalı karşılaştırmasında Adım 17'nin performans kapıları sağlanıyor.

## Adım 13 — Bildirim ve yeniden ulaşma zincirini ölç

### Ne yapılacak?

Hatırlatmanın planlanmasından gerçek oyuna dönüşe kadar gözlenebilen aşamalar ve PWA/hesap kurtarma yolları kaydedilecek.

### Neden?

Oyuncunun geri gelmemesi, hatırlatmanın hiç kurulmadığı, izin verilmediği veya bildirimin açılmasına rağmen oyuna ulaşılamadığı durumlarda farklı yorumlanmalıdır.

### Nasıl yapılacak?

1. Android yerel bildirimlerde tercih, OS display izni ve exact-alarm durumu ayrı kaydedilecek. Planlandı, iptal edildi, planlama reddedildi ve desteklenen callback'te dokunuldu aşamaları ölçülecek.
2. Push için mevcut alert/ref ID'leri üzerinden planlama, cihaz yokluğu, yetersiz bakiye, iptal, taşıyıcıya gönderim girişimi ve taşıyıcının kabul/ret sonucu ayrılacak. `SENT` teslim veya açılma metriğinin kaynağı yapılmayacak.
3. Yeni ölçüm callback'leri, izinli platformun notification action olaylarını yakalayacak; açılışın alert ID'siyle game_ready ve sonraki manuel işlem bağlanacak. Bildirim ilk açılışta auth tamamlanmadan geldiyse bağlam tutulacak ve hesap doğrulanınca ilişkilendirilecek.
4. Bildirime dokunma aynı oturumun ön plan devamı olabilir; sadece dokunuldu diye yeni oturum açılmayacak. Bildirim açılmadan daha sonra normal giriş yapan oyuncuya “bildirimden geldi” etiketi verilmeyecek.
5. PWA için teklif gösterimi, kurulum istemi sonucu ve gözlenen kurulu mod ayrılacak. Tarayıcının kurulumu doğrulayamadığı durum `unknown` kalacak.
6. Mevcut oyunu bulma/hesaba dönme yüzeyleri için yardım açma, mevcut hesaba giriş ve parola kurtarma girişimi/sonucu ölçülecek. Parola kurtarma adresi/kodu kaydedilmeyecek.
7. Bildirim ücreti, gönderim politikası veya izin isteme anı bu adımda değiştirilmeden mevcut davranışa ölçüm eklenilecek.

### Dikkat edilecekler

- Yerel planlama OS'nin bildirimi zamanında gösterdiğini kanıtlamaz. Doğrulanmayan teslim alanı `unknown` olur.
- Push provider kabulü telefon teslimi değildir. Desteklenmeyen teslim/gösterim callback'i için sahte başarı oluşturulmaz.
- Aynı telefonda hesap değişiminde bildirim bağlamı yanlış hesaba yazılmaz.
- Bildirim izni reddedildiği için oyuncuya ek analitik amaçlı izin istemi gösterilmez.

### Kabul kriterleri

- [ ] NO_DEVICE, UNFUNDED, CANCELLED, taşıyıcı hatası ve taşıyıcı kabulü ayrı sorgulanabiliyor.
- [ ] `SENT` fakat taşıyıcı çağrısı olmayan kayıt teslim edilmiş sayılmıyor.
- [ ] Yerel/push bildirime dokunma → auth → game_ready → manuel işlem zinciri kontrollü Android denemesinde aynı referansla bulunuyor.
- [ ] Bildirimsiz organik dönüş bildirim başarısına yazılmıyor.
- [ ] Web'de desteklenmeyen native izin/delivery olayları üretilmiyor; PWA sonuçları destek kapsamıyla gösteriliyor.

## Adım 14 — Sezon/hesap yaşam döngüsü ve veri saklamasını tamamla

### Ne yapılacak?

Analitik geçmişinin sezon resetinde kaybolmaması, oyuncu silmeyi engellememesi ve belirlenen saklama sınırını aşmaması sağlanacak.

### Neden?

Mevcut sezon/reclaim akışları oyuncu ve işlem tablolarını siler. Yeni tabloların yanlış FK veya süresiz kimlik bağlantısı kurması hem geçmişi hem silme işlemlerini bozabilir.

### Nasıl yapılacak?

1. Analitik hesap ilişkisi, hesap yaşam döngüsüne bağlı olacak; sezon oyuncu/gezegen kimlikleri olay anının snapshot'ı olarak tutulacak. Transfer olayı geçmişi bugünkü placement'a taşımayacak.
2. Rollover, reclaim, hesap silme/onaylı silme ve yeniden hesap açma yolları yeni analitik ilişkileriyle test edilecek. Silinen hesapla bağlı ham olaylar, oturumlar ve ziyaret bağlantıları temizlenecek.
3. Ham olay/oturum/kimlikli ziyaret verileri için **en fazla 30 gün** ömür uygulanacak. Temizlik saati ve sınır hesabı sunucu saatiyle yapılacak; ilk kabul/sunucu kaynak zamanı değişmez kalacak ve tekrar alım ömrü uzatmayacak. Süresi dolmuş ziyaret/session kapsamı üzerinden gönderim, eksik session'ı yeniden oluşturarak kabul edilmeyecek. Recovery de saklama penceresi dışındaki eski kaynakları tekrar analitik kayıt yapmayacak.
4. Saatlik temizlikte 30 gün sınırının aşılmaması için son saatlik güvenlik payında kayıtlar erken silinecek. Temizlik başarısızlığı alarm üretecek; batch işlemleri küçük ve indeksli olacak.
5. Daha uzun süreli aggregate yalnız hesaba/cihaza/ziyarete geri bağlanamayan toplamları içerecek. Küçük ve ayırt edilebilir kampanya/cihaz kesitleri birleştirilecek; **5'ten küçük** gruplar ayrıntılı uzun ömürlü aggregate olarak tutulmayacak. Beş kişiye ulaşmak tek başına anonimlik kabulü olmayacak; birleşik filtrelerden kişi çıkarımı ve zaman hassasiyeti de denetlenecek. Bu koşulu karşılamayan toplamlar da 30 günlük sınırda temizlenecek.
6. Aggregate ve retention hesabı, ham veri silinmeden önce kendi tanımlı penceresi tamamlandığında üretilecek. Saklama sınırı dışındaki oyuncu zaman çizelgesinde “veri saklama süresi doldu” gösterilecek.
7. Yerel 24 saatlik kuyruk ve ziyaret/eğitim kimliklerinin temizliği, server temizliğiyle ayrı ama uyumlu çalışacak. Kuyruk dosyaları ve özel kabul kanıtları kişisel kayıtların süresiz ikinci kopyası olmayacak.

### Dikkat edilecekler

- İşletim yedeklerinin mevcut 30 günlük sınırı korunacak; bu adım mevcut yedekleri kendiliğinden silmek için yetki değildir.
- Oyun için gereken asıl business kayıtlarının saklama politikası bu analitik temizleyicisiyle değiştirilmez.
- Anonim toplam olduğu iddia edilen tabloda account/session/visitor ID, kişi listesi veya geri çevrilebilir kimlik bırakılmaz.

### Kabul kriterleri

- [ ] Sezon değişimi tarihsel olayları başka sezona yazmıyor ve rollover'ı FK ile durdurmuyor.
- [ ] Reclaim ve hesap silme mevcut akışları başarılı; silinen hesap analitik admin aramasında bulunmuyor.
- [ ] Sınır anı, tekrar teslim ve temizlik hatası testleri mevcut; yaşlı kayıt retry ile gençleşmiyor.
- [ ] Uzun ömürlü toplamdan bireysel zaman çizelgesi kurulacak kimlik alanı yok.
- [ ] Saklama süresi dolmuş geçmiş, “hiç etkinlik yok” diye raporlanmıyor.

## Adım 15 — Geri dönüş, aşama kaybı ve veri kalitesi hesaplarını kur

### Ne yapılacak?

Ölçümden doğrulanabilir sorgularla oturum, funnel, geri dönüş ve teknik kapsam raporları üretilecek.

### Neden?

Ham olay sayıları oyuncunun davranışını tek başına açıklamaz. Doğru payda, zaman penceresi ve gözlem kapsamı olmadan sürüm/kampanya karşılaştırması yanıltıcı olur.

### Nasıl yapılacak?

1. Eğitim funnel'ı ziyaret/deneme tabanlı; hesap ve gerçek oyun funnel'ı doğrulanmış hesap tabanlı hesaplanacak. Ana ziyaret funnel'ında aynı kişinin tekrar eğitimleri dönüşüm sayısını artırmayacak; tekrar denemeler ayrı tabloda bulunacak.
2. Aşama zinciri: izinli ziyaret → eğitim başlangıcı → tamamladı/erken çıktı → kayıt ekranı → gerçek yeni hesap veya mevcut giriş → placement → game_ready → ilk manuel işlem → ilk sonuç görünürlüğü → sonraki oynama oturumu → sonraki manuel işlem.
3. `24 saat içinde dönüş`: ilk game_ready'den sonraki ayrı oturumda, ilk 24 saat içinde yeniden game_ready veya gerçek manuel işlem görülmesi. İlk oturumun otomatik sorguları bu metriği karşılamaz.
4. `D1/D3/D7 geri dönüş`: ilk game_ready'den itibaren sırasıyla **[24,48), [72,96), [168,192) saat** pencerelerinde ayrı oturumda gerçek oyun hazır veya manuel işlem gözlenmesi. `Dn manuel dönüş` yalnız manuel işlem koşulunu karşılayan alt metriktir.
5. İlgili pencerenin üst sınırına ulaşmamış hesaplar başarısız sayılmayacak; `henüz değerlendirilemez` olarak ayrılacak. Eğitim tamamlayanlar tek payda yapılmayacak; kayıp ziyaret ve erken çıkanlar funnel'da kalacak.
6. 24/48/72 saattir görülmeyen hesaplar son gözlenen aşama ve son gerçek işlemle listelenecek. `Silent Space OUT/RETURN` olayları ayrı ürün olayları olarak gösterilecek; transfer nedeni retention/churn hükmüne dönüştürülmeyecek.
7. Eğitim/istemci sürümü, kayıt dönemi, kampanya, platform, dil, sezon yaşı ve yeni/eski hesap kesitleri sunulacak. Eğitimdeki 3 saniyelik üretim gerçek oyun bekleme süresine katılmayacak.
8. Başarılı/tekrar/reddedilen/geç gelen/düşürülen olay sayıları ve son alım zamanı kalite raporuna yazılacak. Consent, desteklenmeyen platform ve sürüm kapsamı gösterilecek. Veri toplama kesintisi oyuncu kaybı alarmından ayrı tutulacak.
9. Savaş veya engelden sonra dönmeme sorguları, olayın son görünür/manuel etkinlikten önce/sonra oluşma sırasını koruyacak; neden etiketi yerine gözlenen ilişkiyi raporlayacak.

### Dikkat edilecekler

- Rapor dilinde takvim günü retention ile bu belgenin saat pencereleri karıştırılmayacak.
- Yeni sürüm sonrası reklam kaynağı/başlangıç ekonomisi/sezon yaşı değiştiyse fark yalnız onboarding etkisi diye sunulmayacak.
- SQL toplamının paydası, seçilmiş tarih ve kimlik kapsamı raporda görünür olacak.
- Test/admin/bot ayrımı yalnız sunucuda yapılacak; normal oyuncu API'sine discriminator eklenmeyecek.

### Kabul kriterleri

- [ ] Bilinen olaylarla hazırlanmış fixture için oyuncu/ziyaret sayıları ve bütün oranlar elle hesaplanan sonuçla aynı.
- [ ] Tam 24/48/72/96/168/192 saat sınırları, UTC offset değişimi ve geç gelen olaylar test edilmiş.
- [ ] D7 penceresi tamamlanmamış kullanıcı D7 başarısızlığı olarak sayılmıyor.
- [ ] Birbirini tekrar eden kayıt/olaylar sayıları değiştirmiyor.
- [ ] Toplama kesintisindeki dönem “oyuncular topluca bıraktı” olarak sunulmuyor.
- [ ] Eski ve yeni onboarding sürümleri ayrı seçilebiliyor; toplandığında kapsama ilişkin uyarı açık.

## Adım 16 — Admin raporlarını ve oyuncu zaman çizelgesini ekle

### Ne yapılacak?

Mevcut admin alanına geçmiş oyuncu araması, oturum çizelgesi, eğitim/kayıt kayıp akışı, geri dönüş ve kalite görünümleri eklenecek.

### Neden?

Mevcut son 15 dakika listesi, 24 saattir gelmeyen bir oyuncunun nerede kaldığını incelemek için yeterli değildir. Verinin okunabilir ve doğru bağlamla gösterilmesi gerekir.

### Nasıl yapılacak?

1. Yeni admin okuma endpoint'leri `requireAdmin` ile korunacak. Query parametreleri allowlist, sayfa boyutu en fazla **100**, tek tarih aralığı en fazla **30 gün** olacak. Zaman çizelgesi cursor ile sayfalanacak.
2. Oyuncu araması mevcut hesap doğrulamasına bağlı olacak; normal oyuncu başkasının eğitim/oturum geçmişini okuyamayacak. Ayrı görünümde kayıtsız ziyaretler yalnız anonim ölçüm kimliğiyle incelenecek.
3. Zaman çizelgesi giriş yolunu, eğitim denemesini, oturum/ön plan dilimlerini, son manuel işlemi, görülen sonuç/engeli ve teknik hataları sıralayacak. `client_observation/server_fact/derived` farkı ayrıntıda görülecek.
4. Oturum kartında gözlenen ön plan ve etkileşim süreleri, son gözlem, bitiş türü ve bilinmeyen boşluklar gösterilecek. Kesin kapanış bilinmiyorsa saat kesinmiş gibi sunulmayacak.
5. Funnel ve cohort tablolarında pay, payda, dönem, eğitim/sürüm/platform filtresi, olgunlaşma durumu ve veri kapsamı beraber gösterilecek. 24/48/72 saat listesi ayrı filtre olacak.
6. Bildirim kaydında planlama/gönderim/kabul/açılma ve game_ready bağlantısı ayrı satırlar olacak; bilinmeyen teslim görünür kalacak.
7. Mobil 350 px, 390 px ve masaüstünde okunabilir UI hazırlanacak; yoğun tablolar karşılaştırmayı koruyacak. Başlangıçta yeni grafik kütüphanesi veya ayrı dashboard servisi eklenmeyecek.
8. Admin sorguları read-only olacak; başka oyuncunun kaynak tick'ini, presence veya bildirim görüldü durumunu ilerletmeyecek.

### Dikkat edilecekler

- Metrik yanındaki tanım ve kapsam görünür olacak; büyük bir sayı tek başına başarı gibi gösterilmeyecek.
- Bot/test filtreleri normal oyuncu client'ına veya public rapora açılmayacak.
- Ham olay payload'u, gizli oyun bilgisi veya token “debug kolaylığı” için admin tabloya dökülmeyecek.
- Uzun geçmişte N+1 sorgu veya sınırsız `.select()` kullanılmayacak.

### Kabul kriterleri

- [ ] Yetkisiz/normal hesap yeni endpoint'lerden veri alamıyor; parametre ve kapsam sınırları test edilmiş.
- [ ] 24 saattir gelmeyen hesap mevcut online listesinde olmasa da doğru zaman çizelgesiyle bulunuyor.
- [ ] Tahmini bitiş, eksik veri, saklama süresi dolması ve henüz olgunlaşmamış cohort ayrı gösteriliyor.
- [ ] Filtre değişiminde pay/payda/tarih aynı veriye ait; eski cache farklı hesaba görünmüyor.
- [ ] 350 px, 390 px ve masaüstü görsel kabulü `tools/visual.mjs` ile kaydedilmiş.
- [ ] Admin okuması gameplay verisini değiştirmiyor; sorgu sayısı/planı ve pagination sınırı doğrulanmış.

## Adım 17 — Uçtan uca, yük ve hata izolasyonu kabulünü tamamla

### Ne yapılacak?

Tek tek olay testlerine ek olarak oyuncunun bütün yolculuğu, arıza durumları ve sistem maliyeti doğrulanacak.

### Neden?

Doğru adlandırılmış olayların yanlış sırada, yanlış hesapta veya hiç gönderilmeden üretilmesi tek başına birim testinden kaçabilir. Ölçüm oyunun performansına ve doğruluğuna zarar veremez.

### Nasıl yapılacak?

1. Her adımın FAIL→PASS ve regresyon kanıtı bir araya getirilecek. Sunucu auth/claim/native, presence, kuyruk, session, notification, rollover/reclaim/account deletion ve kontrat testleri ilgili kapsamla çalıştırılacak.
2. Web/native yolculuklarında temiz ziyaret, izin ret/kabul/geri alma, ilk sahnede erken çıkış, bütün eğitimi bitirme, yenilemeyle devam, mevcut hesaba giriş ve menüden replay oynanacak.
3. Kayıt cevabı kaybı, oyun cevabı kaybı, process kill, uzun arka plan, saat atlaması, iki sekme, iki cihaz, hesap değişimi, notification açılışı, analitik 4xx/5xx ve kapalı analitik DB alımı test edilecek.
4. Bütün testler izolasyonlu veride yapılacak. DB worker'ları çalıştırma/worker'a özel `_test` veritabanı kullanacak; migration ve başarı/hata/iptal cleanup'ı uygulanacak. Worker/bellek/workspace sınırlarında güncel `CLAUDE.md` esas alınacak.
5. Normal kalite kapıları tip/lint/ilgili testler ve kapsam geniş olduğu için olağan `pnpm verify` olacak. Uzun ekonomi/sezon simülasyonu veya snowball audit'i başlatılmayacak.
6. Ayrı sentetik kabul profili: **1000 eşzamanlı ön plan context'i**, context başına dakikada 1 heartbeat ve 6 anlamlı olay, **15 dakika**; ayrıca toplam 1000 olay/saniye **60 saniyelik burst**. Bu profil kapasite iddiası değildir; bu özellik için geçilecek test yüküdür.
7. Aynı ortamda ölçüm kapalı/açık karşılaştırılacak. Kabul kapıları: gameplay route'larında p95 artışı en fazla **%5**, p99 artışı en fazla **%10**; ölçümden kaynaklanan yeni gameplay 5xx yok; istemci kuyruğu belirlenen sınırda; sunucunun kabul ettiği benzersiz event ID kümesi ile saklanan olay kümesi aynı. Kuyrukta düşen veya hiç teslim edilmemiş olaylar kabul edilmiş olay gibi sayılmayacak.
8. Mobil kontrollü aynı sahne/cihaz karşılaştırmasında p95 frame time artışı en fazla **%5** olacak; CPU/RSS/ağ/SQL ölçümleri kanıta yazılacak. Sonuçları ölçmeden “hafif” veya “1000 oyuncuyu kaldırır” denmeyecek.
9. Veri doğruluğu için sunucu kaynak kayıtları, kabul edilen olaylar ve admin raporu aynı fixture kimlikleriyle karşılaştırılacak. Tek başına event sayısı yeterli olmayacak.

### Dikkat edilecekler

- Bu test profili oyun ekonomisi simülasyonu değildir; üretimde yük testi yapılmayacak.
- Beklenen veri kaybı senaryosu örneğin process kill, “tam teslim” iddiasıyla kapatılmayacak; bilinmeyen/kayıp kapsamı raporda doğrulanacak.
- Genel suite tamamlanmadıysa geçmiş bir koşu üzerinden bütün kapılar geçti denmeyecek.

### Kabul kriterleri

- [ ] Uçtan uca senaryoların her birinde beklenen kimlik/bağlam/olay sırası ve rapor sonucu kayıtlı.
- [ ] Analitik kapanınca gameplay, auth, bildirim ve eğitim çalışıyor; presence etkilenmiyor.
- [ ] Hedefli ve olağan genel kontrollerin sonuçları, başarısızlıkları ve kapsamı açık.
- [ ] Sentetik yük ve mobil karşılaştırma belirtilen kapıları geçiyor; ham kişisel veri içermeyen kanıt dosyaları var.
- [ ] Sıfırdan geçiş, eski istemci uyumu, sezon değişimi ve hesap silme uçtan uca doğrulanmış.
- [ ] Tüm geçici test veritabanları ve süreçleri temizlenmiş; production verisi kullanılmamış/değiştirilmemiş.

## Adım 18 — Aşamalı yayın, canlı kabul ve geri alma

### Ne yapılacak?

Ölçüm, normal yayın kurallarıyla kapalı hazırlanacak; sınırları doğrulanarak etkinleştirilecek ve gerektiğinde yalnız ölçüm kapatılabilecek.

### Neden?

Yeni veri toplama, auth/oturum, kuyruk, bildirim ve admin yollarına dokunur. Migration veya dashboard'un varlığı canlı ölçümün doğru çalıştığını tek başına göstermez.

### Nasıl yapılacak?

1. Ayrı collection/admin feature flag'leri eklenecek. Flag kapalıyken yeni client toplaması başlamayacak ve yeni davranış depolaması yapılmayacak; gameplay'in çalışma koşulu bu flag olmayacak.
2. Additive migration ve eski/yeni image uyumu, güncel deployment prosedürüyle izole restore üzerinde doğrulanacak. Normal migration/rollout/backup kuralları korunacak.
3. Önce kontrollü, işaretli test hesapları ve test ziyaretleriyle web/native yolculuk oynanacak. Bunlar retention cohort'larından çıkarılacak; gerçek oyunculara ölçüm testi için mesaj gönderilmeyecek.
4. Etkinleştirme anı, collection başlangıcı, istemci/sunucu/onboarding sürümleri ve platform kapsamı kayıt altına alınacak. Eski verilerin henüz ölçülmediği admin'de gösterilecek.
5. İlk canlı kabul: olay alımı, tekilleştirme, session süreleri, manuel emir zamanları, bildirim açılışı ve rapor paydaları kontrollü bilinen verilerle karşılaştırılacak. Canlı oyuncuların oyun durumuna test işlemi yapılmayacak.
6. Olay reddi, kuyruk düşümü, alım gecikmesi ve temizlik başarısızlığı için operasyonel görünürlük açılacak. `server_fact` kaynakları ile event projection arasındaki eksikler ayrıca izlenecek.
7. Geri alma önce toplama flag'ini kapatacak; client'ın ölçüm yokluğunda oynayabildiği doğrulanacak. Additive tabloyu veya güncel oyuncu verisini silerek geri dönülmeyecek.
8. Retention değerlendirmesi yalnız Adım 15'teki zaman penceresi tamamlandıktan sonra yapılacak. İlk gün çalışan olay hattı “retention arttı” kabulü sayılmayacak.

### Dikkat edilecekler

- Bu plan dosyasının oluşturulması üretime çıkma veya yeni veri toplamayı açma işlemi değildir.
- Geri alma, analitik veriyi eski üretim dump'ıyla değiştirmek veya yeni oyuncu yazılarını silmek değildir.
- Native kapsamı yayımlanmış uygulama sürümüyle doğrulanacak; web kaynağı değişti diye bütün telefonların güncellendiği varsayılmayacak.

### Kabul kriterleri

- [ ] Üretim yayın kimliği, migration sonucu, client kapsamı ve etkinleştirme başlangıcı kayıtlı.
- [ ] Kontrollü canlı yolculuk admin raporunda doğru; test trafiği gerçek oyuncu cohort'unda yok.
- [ ] Collection kapatma ve eski/yeni istemci hata izolasyonu denemeleri başarılı.
- [ ] Normal gameplay sağlık ve gecikme kabulü korunmuş; temizlik/kalite izlemesi çalışıyor.
- [ ] Gerçek D1/D3/D7 sonucu yalnız olgunlaşmış payda ve ölçüm kapsamıyla raporlanıyor.

## 4. V1 olay sözlüğünün asgari kapsamı

Bu tablo yeni uygulamanın sözleşme gereksinimidir. Bir olay, yalnız adına bakılarak mevcut kabul edilmez. Adım 02'de her satırın tam şeması ve tetikleyicisi test edilecektir.

| Aile | Örnek olay / sonuç | Kaynak ve anlam |
| --- | --- | --- |
| Ziyaret | `visit_started`, `identity_linked` | İzinli ziyaret; hesap bağlantısı server doğrulamasıyla. |
| Ana sayfa | `landing_visible`, `play_clicked`, `login_clicked`, `training_load_failed` | Ana sayfanın görünmesi, başlatma niyeti, giriş ve eğitim yükleme hatası ayrı gözlemler. |
| Lifecycle | `foreground_started`, `foreground_ended`, session özeti | İstemci gözlemi; uygulamanın kesin kapandığı iddiası değil. |
| Eğitim başlangıcı | `training_started`, `training_resumed` | Yeni deneme / kurtarılan deneme / replay bağlamı. |
| Eğitim sahnesi | `training_scene_visible`, `training_text_revealed`, `training_action_ready` | Görünür sahne, gösterilmiş metin, kullanılabilir hedef ayrı. |
| Eğitim eylemi | `training_action_accepted`, `training_result_visible`, `training_scene_completed` | Yerel eğitim sonucu; gerçek oyun işlemi değil. |
| Eğitim çıkışı | `training_exit_requested`, `training_completed` | Erken çıkış, bitirme ve kayıt diyaloğuna ilerleme ayrımı. |
| Kimlik | `auth_attempted`, `auth_result`, `account_created` | Attempt istemci; hesap oluşturma ve doğrulanmış başarı server. |
| Yerleşme | `placement_completed`, `placement_failed`, `game_ready` | Placement server gerçeği; hazır oyun yüzeyi istemci gözlemi. |
| Komut | `command_attempted`, `command_committed`, `command_blocked` | Niyet, gerçek commit ve engel ayrı; kararlı correlation kimliği. |
| Yüzey/sonuç | `surface_visible`, `blocker_visible`, `outcome_resolved`, `outcome_visible` | Görülen yüzey ve worker sonucu ayrı. |
| Teknik | `load_phase`, `client_error`, `network_recovered`, `performance_summary` | Temizlenmiş ve sınırlı teknik gözlem; oyuncu içeriği yok. |
| Bildirim | `alert_scheduled`, `alert_transport_result`, `alert_opened` | Desteklenen kanaldaki gözlem; planlama/gönderim teslim değil. |
| Geri ulaşma | `install_offer`, `install_result`, `recovery_result` | PWA/hesap kurtarma aşaması ve destek kapsamı. |
| Transfer | `commander_transfer` | Mevcut OUT/RETURN kaynağından; churn nedeni değil. |

Olay adlarına oyuncu adı, gezegen adı, kullanıcı metni veya dinamik ID eklenmez. Bunlar gerekiyorsa izinli ve sınırlı referans alanında bulunur; event name kardinalitesi sabit tutulur.

## 5. İlk admin kabulünde cevaplanması gereken sorular

1. Ölçülebilen ziyaretlerin kaçı eğitime başladı; kaçı hesap açmadan ayrıldı?
2. Her eğitim sahnesinde kaç kişi görüntüleme, eylem ve sonuç aşamalarına ulaştı? Hangi süre metin/yükleme/uçuş/oyuncu hareketinde geçti?
3. Erken çıkan ve tamamlayanların kaçı kayıt diyaloğunu, yerleşmeyi ve gerçek oyun görünümünü geçti?
4. Gerçek oyunda ilk manuel işlem ne zaman verildi; hangi engelle karşılaşıldı?
5. İlk iş/görev sonucu oluştuğunda oyuncu daha sonra döndü mü; döndüyse sonucu gördü mü ve yeni bir işlem yaptı mı?
6. Hesabın kaç ayrı oynama oturumu ve hangi saatlerde gözlenen etkinliği var? Ön plan süresi ile etkileşim süresi nasıl ayrılıyor?
7. Son 24/48/72 saattir görülmeyen oyuncuların son gözlenen aşaması, işlemi, engeli ve teknik durumu ne?
8. Bildirim gerçekten gözlenebilen hangi aşamaya ulaştı; dokunulduysa gerçek oyuna ve sonraki işleme geçilebildi mi?
9. Kampanya/platform/dil/eğitim sürümü bazında farkların paydası ve ölçüm kapsamı ne?
10. Veri toplama kesintisi, izin eksikliği veya henüz tamamlanmamış pencere, oyuncu kaybı sayısını yanlış büyütüyor mu?

Bu soruların cevapları gözlenen olgular olarak gösterilir. “Sıkıldı”, “unuttu”, “kaybettiği için bıraktı” gibi gerekçeler oyuncunun açık geri bildirimi olmadan kesin etiket yapılmaz.

## 6. Kaynaklar ve uygulama referansları

- [Çalışma kuralları](../CLAUDE.md), [mimari](architecture.md), [deployment](deployment.md), [UX yazım standardı](ux-writing.md).
- [Mevcut analitik çağrıları](../apps/web/src/lib/analytics.ts), [oturum makinesi](../apps/web/src/session/useSession.ts), [platform lifecycle](../apps/web/src/platform/activity.ts).
- [Kimlik ve presence](../apps/server/src/routes/auth.ts), [claim ve tekrar davranışı](../apps/server/src/routes/onboarding.ts), [inşa kuyruğu](../apps/server/src/services/buildQueue.ts), [idempotency](../apps/server/src/services/idempotency.ts).
- [Rapor görünürlük sınırı](../apps/web/src/session/useReadReportSignals.ts), [bildirim merkezi](../apps/server/src/services/notificationCenter.ts), [FCM taşıyıcısı](../apps/server/src/services/fcm.ts).
- [Sezon temizliği](../apps/server/src/services/servers.ts), [hesap silme](../apps/server/src/services/accountDeletion.ts), [günlük saklama kararı](mobile-log-retention-2026-10-19.md).
- Yeni akademi: yukarıdaki release commit'inde `apps/web/src/onboarding/flightSchool/` altındaki `FlightSchool.tsx`, `scenes.ts`, `world.ts`, `api.ts`, `storage.ts`, `SchoolCoach.tsx`; ilgili `flight-school-*.test.*` dosyaları. Bu dosyalar master'a taşınmadan göreli dosya bağlantısı varmış gibi kullanılmaz.
- [GameAnalytics: olay planlama](https://docs.gameanalytics.com/getting-started/plan-your-sdk-implementation/) ve [ilerleme olayları](https://docs.gameanalytics.com/events-metrics-and-filtering/event-types/progression-events/): ölçülecek soruya bağlı olay tasarımı için araştırma kaynağı. Bu plandaki eşiklerin doğrulandığı iddiası değildir.
- [MDN: sendBeacon](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon), [Request.keepalive](https://developer.mozilla.org/en-US/docs/Web/API/Request/keepalive): kapanış ve özel istek özellikleri için taşıma sınırları.
- [Capacitor App API](https://capacitorjs.com/docs/apis/app): web/native lifecycle bağlantısı.
- [Firebase mesaj teslimi](https://firebase.google.com/docs/cloud-messaging/understand-delivery): gönderim, alınma, gösterim ve açılmanın farklı ölçümler olması.

## Ana sayfa kapsamı — 2026-11-02 düzeltmesi

Adım 04, 08, 15 ve 16 için açık gereksinim: izinli ziyaret tek başına ana sayfanın görüldüğü veya Play'e basıldığı anlamına gelmez.

**Ne yapılacak:** Web ana sayfası ve native başlangıç yüzeyi için `landing_visible`, `play_clicked`, `login_clicked`, `training_load_failed` kaydedilecek. Ana zincir: ana sayfa görünür → Play tıklaması → eğitim hazır → 11 ana eğitim adımı. Her ana adımın alt sahnesi teşhis ayrıntısıdır.

**Neden:** Hiç tıklamayan, tıklayıp yükleme hatası alan ve eğitime başlayıp ayrılan ziyaretler farklı kayıplardır.

**Nasıl:** Görünürlük ön plan ve izin koşuluyla; Play tıklaması yükleme başlamadan önce bir `attemptId` ile; yükleme hatası aynı deneme kimliğiyle kaydedilecek. Yalnız başlatma callback'inin reddi değil, eğitim modülünün lazy import/render hatası da mevcut hata sınırından yakalanacak. Eğitim gerçekten hazır olduğunda giriş denemesi kapatılacak ve eğitim başlangıcının `refId` alanı Play denemesini gösterecek. Sonraki oyun hatası eski Play'e yükleme hatası olarak bağlanmayacak. Giriş düğmesi eğitim başlangıcından ayrı tutulacak. CTA yinelenen tıklamaya kapalıyken ikinci olay oluşmayacak. Kampanya ve istemci sürümü izinli ziyaret üzerinden ilişkilendirilecek.

**Dikkat:** İzin öncesi tıklamalar sonradan yeniden oluşturulmayacak. Tıklama eğitim başlangıcı, eğitim başlangıcı hesap oluşturma sayılmayacak. Ana sayfa içindeki rehber bağlantısı, oyunu başlatan Play ile karıştırılmayacak. Ölçülemeyen ziyaretler “tıklamadı” diye etiketlenmeyecek.

**Kabul kriterleri:** Ana sayfa görünürlüğü, Play, giriş ve yükleme hatası ayrı testlerle doğrulanır. Play sonrası yükleme reddedilirse `play_clicked` + `training_load_failed` vardır; `training_started` yoktur. Giriş düğmesi `play_clicked` üretmez. İzin yokken bu olaylar gönderilmez. Yönetim raporunda ana sayfa → Play → eğitim sayıları ayrı görünür.

## Yük doğrulaması kapsamı — owner'ın son talimatı

Adım 17'deki uzun sentetik yük ve ayrıntılı gecikme karşılaştırması bu çalışma için zorunlu kabul kapısı olmaktan çıkarıldı. Owner bu aşamada yalnız kaba yük kontrolü istedi. Mevcut kısa koşunun gerçek olay/hata/kaynak gözlemleri kaydedilecek; tamamlanmamış 15 dakika, burst, mobil p95 veya sunucu p95/p99 profili geçti olarak sunulmayacak. Kullanıcı yeniden istemeden bu uzun koşu başlatılmayacak.


## İzin penceresi ve kimlik kapsamı — owner'ın son kararı

Bu bölüm, yukarıdaki ayrı first-party açık rıza penceresi ve anonim geçmişi hesabına bağlama gereksinimlerinin yerine geçer. Google reklam/analitik tercih akışı değiştirilmez.

- Oyun kullanım ölçümü için ayrı başlangıç izin penceresi gösterilmez. Oyunun menüsünde kapatma seçeneği bulunur; kapalı tercih korunur.
- Kayıtsız ziyaret tanımlayıcısı ve gönderilmemiş kuyruk yalnız sayfa belleğindedir. Sayfa yenilenince yeni ölçüm ziyareti başlar; eğitim oyun kurtarma kaydı değişmez.
- Anonim ziyaret hiçbir HTTP alımı, auth callback'i, kaynak komut metadata'sı veya recovery yolunda hesaba dönüştürülmez. Kayıt/girişte yeni hesaplı ölçüm ziyareti açılır; eski kuyruk yeni hesapla gönderilmez.
- Oyuncu ölçüm kapsamı açmak doğrulanmış erişim kimliği gerektirir. Sunucunun gerçek hesap/yerleşme olguları ayrı sunucu konteynerine yazılır; anonim eğitim kimliği taşımaz.
- Anasayfa/eğitim ziyaret raporu ile oyuncu geri dönüşü ayrı paydalardır. Kayıt öncesi eğitim bir oyuncunun geçmişi gibi gösterilmez. “Anonim” burada hesaba bağlanmayan geçici ölçüm ziyaretidir; bütün altyapı erişim günlüklerinin hukuken anonim olduğu iddiası değildir.
- Gizlilik ve çerez politikalarının Türkçe/İngilizce sürümleri ve KVKK aydınlatması; alanlar, amaç, ayrım, en fazla 30 gün saklama ve kapatma yolunu açıklar. Bildirim izinleri ve Google tercihleri ayrı kalır.
- Kabul: anonim alımın hesaplı isteğe dönüştürülmesi 403; hesaplı ziyaret kimliksiz açılamaz; kaynak sipariş anonim ziyaret hash'ini taşımaz; giriş/hesap değişimi yeni kapsam açar; başlangıç ölçüm penceresi yoktur; kapalı ölçüm altında oyun çalışır.

Bu teknik ayrım tek başına bütün ülke ve işleme amaçları için hukuki uygunluk kararı değildir. Bu çalışma canlı toplamayı açmaz.
