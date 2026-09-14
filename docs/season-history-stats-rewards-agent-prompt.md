# AI Agent Görev Prompt'u — Sezon Arşivi, Komutan Karneleri ve Sonraki Sezon Ödülleri

Bu görevi `/home/yildirim/Desktop/Coding/MyProjects/blindspace` repository'sinde uçtan uca tamamla. Yalnızca plan veya örnek kod üretme: ürünü ve mevcut sistemi analiz et, gerekli dar kararları ölçümlerle netleştir, testleri önce yaz, implementasyonu yap, gerçek arayüzü görsel olarak doğrula ve kalite kapılarını çalıştır.

## 1. Amaç

Oyuncu sezon boyunca neden yarıştığını bilmeli; sezon sonundaki world wipe'ı kayıp olarak değil, tamamlanan bir hikâye ve yeni yarışın başlangıcı olarak görmeli.

Ortaya çıkacak sistem:

- Tamamlanan her sezonun kalıcı leaderboard'unu saklar.
- Tamamlanmış (`frozen` veya rollover sonrası `wiped`) leaderboard'daki bir komutana dokununca o sezona ait ayrıntılı karneyi açar.
- Bir komutanın tamamlanmış bütün sezonlarını birleştiren `Genel` kariyer görünümünü sunar.
- Temel istatistikleri aynı sezondaki uygun komutanların ortalamasıyla karşılaştırır.
- Dominion sıralamasındaki ilk 10 gerçek kullanıcıya, önceden ilan edilmiş ödülü hemen sonraki sezonda bir kez teslim eder.
- Canlı sezonun bugünkü leaderboard kapsamını ve fog-of-war güvenliğini **aynen korur**.

Hedef; `COMPETITION`, `AMBITION`, `RE-ENGAGEMENT` ve `MEMORABILITY` duygularını güçlendirmektir. Yeni bir görev/battle-pass sistemi veya ikinci bir gameplay skoru üretmek değildir.

## 2. Değiştirilemez sınırlar

### 2.1 Canlı leaderboard aynen kalacak

Bugün çalışan `/api/leaderboard` ve `LeaderboardScreen` canlı sezon için davranışsal bir regression sınırıdır:

- Dominion sırası ve mevcut tie-breaker değişmeyecek.
- Mevcut satır alanları, arama, kendi satırını vurgulama ve planet-focus davranışı korunacak.
- Planet/Core bilgisi bugünkü sensor-memory/fog kurallarını aşmayacak.
- Canlı satırlar komutan profiline veya ayrıntılı istatistiğe açılmayacak.
- Hiç kimse — kendi hesabı dahil — canlı season id ile archived-profile endpoint'inden ayrıntılı karne alamayacak.
- Canlı sezondaki asteroid/convoy geliri, üretim miktarı veya süresi, işler, kaynaklar, filo, gemi üretimi/kaybı, savaş kırılımı, aktivite, online süresi, ortalama veya bunlardan türetilebilecek bir yan kanal yayımlanmayacak.

İlk 10 ödül tarifesi sezon sırasında gösterilecekse, leaderboard satırlarını değiştirmeyen ayrı ve statik bir açıklama/legend olarak göster. Hangi canlı oyuncunun hangi ayrıntılı eylemleri yaptığı incelenebilir hâle gelmemeli.

### 2.2 Otorite ve kapsam

- Canlı ve tamamlanmış sezonun rekabet skoru mevcut Dominion'dur. İkinci bir sezon skoru ekleme.
- Ayrıntılı komutan karneleri yalnızca tamamlanmış (`frozen` veya `wiped`) sezonlardan oluşur; yasak olan durum `live` sezondur.
- `Genel`, seçilen komutanın yalnızca tamamlanmış (`frozen`/`wiped`) sezonlarını birleştiren kariyer özetidir; canlı sezon verisini içermez.
- Bu görev bir global “all-time leaderboard” istemiyor. Onaylanmış formül yokken farklı nüfus/ruleset'lerdeki rank veya Dominion'u sentetik bir kariyer puanına dönüştürme.
- Birden fazla bağımsız galaksiyi gerekçesiz birleştirme. Mevcut Dominion yarışının season/cycle/shard kapsamını koru.
- MAIN ↔ Silent Space/WAITING transferi yaşayan bir hesap için aynı cycle'da iki sonuç veya eksik istatistik üretme; mevcut cycle-wide kayıt davranışını koru.

### 2.3 Güvenli çalışma

- Repository kökündeki `AGENTS.md` dosyasını ve yönlendirdiği `CLAUDE.md` dosyasını tamamen oku.
- Kod ve testler kesin kaynaktır; dokümanlar eski olabilir.
- Kirli worktree'deki kullanıcı değişikliklerini koru. İlgisiz dosyaları değiştirme veya geri alma.
- Server authoritative kalmalı. İstemciden rank, istatistik, reward miktarı veya eligibility kabul etme.
- Her kod değişikliğinde zorunlu TDD uygula: requirement/edge case analizi → test → doğru nedenle FAIL → implementation → PASS → review → tüm testler.
- `any`, compiler-silencing cast, core logic TODO'su, fake data ve kalıcı placeholder bırakma.

## 3. Önce mevcut sistemi doğrula

Dosya adları değişmişse `rg` ile gerçek karşılıklarını bul. Özellikle şunları incele:

- `apps/server/src/services/season.ts`
- `apps/server/src/worker/handlers.ts` içindeki season end/rollover akışı
- `apps/server/src/db/schema.ts`: `accounts`, `botProfiles`, `seasonCycles`, `seasons`, `seasonResults`, player/world ve ilgili action tabloları
- `apps/server/src/routes/season.ts`, `galaxy.ts`, `auth.ts`
- `apps/server/src/services/rewards.ts`, `routes/rewards.ts`
- `apps/server/src/services/accountDeletion.ts`
- MAIN/WAITING transfer ve rollover servisleri
- `apps/web/src/screens/LeaderboardScreen.tsx`, `SeasonRecap.tsx`, `RewardsScreen.tsx`
- `apps/web/src/api/{schemas,client,queries,keys}.ts`
- Menü/panel navigasyonu, Türkçe/İngilizce i18n ve ilgili testler

Dokümanlardan yalnızca ilgili bölümleri oku:

- `docs/game-design.md`: sezon, kalıcı kimlik, Dominion, transfer ve Deuterium
- `docs/interface.md`: leaderboard, menu/sheet ve karşılaştırma dili
- `docs/balance.md`: sezon ekonomisi, başlangıç kaynakları, rewards, Dominion ve Deuterium; dosyanın tamamını gereksiz yere okuma
- `docs/engineering-standards.md`: API contract, test ve görsel doğrulama kuralları

Başlamadan önce kısa bir risk haritası ve metrik sözlüğü çıkar. Metrik sözlüğünde her alan için şunlar yer alsın: kesin tanım, otoriter kaynak/olay, hangi anda ve hangi actor'a yazıldığı, iptal/başarısızlık davranışı, season boundary, gizlilik, aggregation ve eski veri desteği.

## 4. Bilgi mimarisi

Mevcut yüzeylerin yanında aynı işi yapan kopuk bir sistem kurma. Canlı leaderboard'u koruyup geçmiş kayıtları onun doğal devamı hâline getir.

### 4.1 Sezon arşivi

Mobil-first bir arşiv/season selector sun:

- `Canlı Sezon`: bugün çalışan leaderboard'un aynısıdır.
- `Sezon 1`, `Sezon 2`, ...: tamamlanmış (`frozen`/`wiped`) sezon leaderboard'larıdır.
- Cycle'ı paylaşan shard'lar aynı sezon numarasını paylaşmalı; galaksi adı ayrıca gösterilmeli.
- Sezon numarası response sırasındaki geçici array index'inden türetilmemeli. Kalıcı, unique ve deterministik cycle ordinal'i (veya eşdeğer sağlam model) kullanılmalı.
- Mevcut cycle'lar için ordinal backfill'i `startsAt` ve deterministik tie-breaker ile bir kez yapılmalı; sonradan yeni satır gelince eski numaralar kaymamalı.
- Yüzlerce sezon düşünülerek season index kademeli yüklenmeli. Bir tamamlanmış sezon leaderboard'u en fazla mevcut galaxy kapasitesi kadar satır taşıdığı için gereksiz pagination ile bugünkü bütün-liste arama deneyimini bozma; ölçüp gerekçelendirirsen server-side arama/pagination kullan.

Tamamlanmış sezon leaderboard'u en az şunları gösterir:

- Nihai Dominion sırası ve Dominion
- Sezon sırasında kullanılan snapshot komutan adı
- Mevcut recap unvanı/rozeti
- Ödül kazandıysa mühürlenmiş ödül basamağı
- Arama ve kullanıcının kendi satırının erişilebilir vurgusu
- Satıra dokununca açılan tamamlanmış sezon karnesi

### 4.2 Komutan profili ve `Genel`

Bir tamamlanmış sezon leaderboard satırından açılan profil önce seçilen sezonu gösterir. Profilde:

- `Genel`: bu account'un yalnızca tamamlanmış (`frozen`/`wiped`) sezonlarından kariyer özeti
- Katıldığı `Sezon N` kayıtları: ayrı ayrı sezon karneleri

`Genel` en az şunları içerir:

- Tamamlanan sezon sayısı
- En iyi derece
- Şampiyonluk, podyum ve ilk 10 sayıları
- Toplanması anlamlı temel eylem toplamları
- Sezon sezon sonuç kartları

Farklı Dominion ruleset'lerinden gelen ham Dominion toplamını rekabet sırası gibi sunma. Gösterilecekse kapsamı/ruleset farkı doğru etiketle. Eski snapshot'larda bulunmayan metrikler kariyer toplamında `0` sayılmamalı; kapsanan sezon sayısı veya `veri yok` durumu görünür olmalı.

Profilin kalıcı bağı account üzerinden kurulmalı; season-scoped `playerId` kalıcı kimlik değildir. Buna rağmen o sezonda kullanılan görünen ad snapshot'ta korunmalı; daha sonraki ad değişikliği geçmiş kaydı yeniden yazmamalı.

## 5. Sezon karnesi

Karneyi sayı çöplüğüne çevirmeden üç grupta sun. Aşağıdaki **çekirdek metrikler** zorunludur; “ek” maddeleri yalnızca güvenilir, düşük karmaşıklıklı ve gerçekten anlamlıysa ekle.

### 5.1 Rekabet ve savaş

Çekirdek:

- Nihai sıra, Dominion ve unvan
- Toplam PvP savaşı; saldırı/savunma ayrımı
- Verilen/alınan hasar
- Oyunculardan güvenceye alınan loot; Alloy/Crystal/Deuterium kırılımı
- Tamamlanmış gemi üretimi ve kalıcı gemi kaybı; toplam ve anlamlı hull kırılımı

Ek: açık tanımlı galibiyet/mağlubiyet veya battle-grade dağılımı, en büyük raid, en sık karşılaşılan rakip ve mevcut clan recap'i.

### 5.2 Ekonomi ve üretim

Çekirdek:

- Pasif Works ekonomisinde gerçekten üretilen Alloy/Crystal/Deuterium
- Etkin üretim süresi

“Üretim” ile storage'a collect edilen miktarı karıştırma. “Etkin üretim süresi” için sunucuda ölçülebilir tek bir semantik belirle ve UI'da açıkla: ekonominin gerçekten ilerleyebildiği süre; frozen/disrupted/cap'e takılmış zamanın dahil olup olmadığını netleştir. Uygulamanın açık kalma süresini ölçme.

Ek: güvenilir ölçülebiliyorsa cap/disruption nedeniyle üretilemeyen süre, tamamlanan construction/yard/research işi ve sezon içindeki en yüksek controlled-world sayısı.

### 5.3 Keşif ve fırsat

Çekirdek:

- Asteroid'e gerçekten ulaşan mining run sayısı
- Asteroidlerden gerçekten çıkarılıp actor'a atfedilen kaynak; resource kırılımı
- Intergalactic Convoy denemesi/başarısı
- **Teslim edilmiş** convoy kazancı; resource kırılımı

Ek: probe, pirate ve salvage gibi mevcut çekirdek eylemlerden güvenilir olanlar.

Launch, arrival, secured reward ve delivered reward aynı olay değildir. İptal edilen, başarısız kalan, hâlâ outbound olan veya season closure politikasına göre tamamlanmamış eylemi başarı olarak sayma. Season end'in mevcut afterglow/“uçuşları bitir sonra freeze et” semantiğini koru; yalnızca timestamp'e bakarak geçerli kapanış sonuçlarını dışlama.

### 5.4 Sezon ortalaması

Her çekirdek özet metriğini şu anlamda karşılaştır:

> 50.000 asteroid kaynağı çıkardın · Bu sezondaki uygun komutan ortalaması 27.000

- Cohort; aynı tamamlanmış season/cycle ve aynı rekabet galaksisinde geçerli bir yerleşimi olmuş bütün gerçek kullanıcılar olmalı. Reward eligibility veya pozitif Dominion şartı arama.
- Admin, system ve bot hesapları cohort'a girmemeli; bu kimlikler istemciye açıklanmamalı.
- Uygun olup ilgili eylemi hiç yapmayan oyuncu ortalamaya `0` ile dahil olmalı.
- Cohort membership season freeze anında sabitlenmeli ve sezon daha sonra `wiped` olduğunda değişmemeli.
- Ortalama sealed per-player snapshot'lardan deterministik türetilmeli. Ayrı aggregate satırı saklanacaksa drift edemeyeceği kanıtlanmalı.
- API cohort sayısını taşımalı; 0/1 kişilik cohort, sıfır average, division-by-zero, `NaN` ve `Infinity` güvenli ele alınmalı.
- Ortalama her alt hull satırına tekrarlanarak UI şişirilmemeli; karar değeri taşıyan ana toplamlar karşılaştırılmalı.
- Büyük sayılar, duration ve resource isimleri typed i18n ile Türkçe/İngilizce doğru formatlanmalı.

## 6. Kalıcı snapshot ve geçmiş veri

Rollover gameplay tablolarını sildiğinden kalıcı sonuç snapshot'ı `frozen` geçişinde, wipe öncesinde server tarafından mühürlenmelidir.

### 6.1 Snapshot garantileri

- Leaderboard satırı, final rank, metrikler, cohort üyeliği ve reward entitlement aynı freeze işleminin tutarlı transaction sınırında oluşmalı; `wiped` geçişi bu snapshot'ı silmemeli/değiştirmemeli.
- Season-end retry aynı sonucu üretmeli; istatistik veya ödül ikiye katlanmamalı.
- Account ile season player ayrımı korunmalı.
- Çoklu world/colony katkıları doğru actor'da birleşmeli. Bir world el değiştirince önceki sahibin geçmiş üretimi yeni sahibine kaymamalı.
- MAIN/WAITING transferinde cycle-wide battle/action kayıtları bir kez sayılmalı ve `seasonResults`'ın mevcut one-result-per-cycle invariant'ı bozulmamalı.
- Büyük kümülatif sayılarda mevcut bigint, safe-integer ve Zod sınırları izlenmeli.
- Snapshot schema/version ve metrik-bazlı availability bulunmalı.
- Query/index tasarımı 300 oyuncu ve çok sezon için N+1 üretmemeli.
- Migration deploy-safe ve mevcut satırlarla uyumlu olmalı.

Genişletilmiş/version'lı `seasonResults`, normalize stats tabloları veya dengeli bir birleşimden hangisinin doğru olduğunu kod/query/migration ihtiyaçlarıyla kanıtla. Rastgele JSON alanları yığma; tersine her mutation'a drift edebilecek onlarca counter da ekleme.

Season end'de mevcut immutable satırlardan güvenilir hesaplanabilen metrikleri orada türet. Lazy economy nedeniyle geçmişten çıkarılamayan üretim miktarı/süresi gibi değerler için mevcut `advanceEconomy` yollarında atomik, idempotent cumulative accounting kullan; dakikalık cron veya yalnızca profil ekranı açılınca ölçülen eksik sayaç üretme.

### 6.2 Eski sezonlar ve production güvenliği

- Mevcut `seasonResults` verisinden kesin türeyen eski alanları güvenli backfill et.
- Hiç tutulmamış ayrıntıları `0` diye uydurma; `unavailable`/version ile dürüstçe göster.
- Yeni telemetry yalnızca deploy/cutover sonrasından itibaren doğruysa bunu UI ve snapshot version'da belirt.
- Geçmiş `/api/auth/me` recap uyumluluğunu bozma.
- Eski sezon backfill'i **ekonomik ödül üretmemeli**. Reward programının açık bir activation cycle/version'ı olmalı.

Production'dan geçmiş sezon çıktılarına ihtiyaç duyarsan yalnızca repository'de zaten tanımlı ve onaylı **read-only** erişimi kullan:

- Production veritabanına hiçbir koşulda write, migration, backfill veya düzeltme çalıştırma.
- Geniş/full dump alma; gereken minimum kolonları veya aggregate sonuçları `SELECT`/read-only transaction ile oku.
- Credential, token, e-posta, password hash veya gereksiz kişisel veriyi log'a/dosyaya taşıma.
- Read-only erişim mevcut değilse yeni yetki/bypass üretme; hangi bilginin eksik kaldığını bildir ve deploy ile gelecekte toplamaya başla.

### 6.3 Hesap silme ve kimlik

Kalıcı arşiv, hesap silme davranışını bozmamalı. `accountDeletion.ts` akışını kapsa:

- Silinen hesabın kişisel kimliği ve teslim edilmemiş entitlement'ı mevcut gizlilik politikasına uygun silinmeli/anonimleşmeli.
- Sezon sırasını korumak gerekiyorsa kişiye geri bağlanamayan tombstone (`Silinmiş Komutan`) kullan; eski display name'i yanlışlıkla tutma.
- Silinen hesabın rank'ı kaldırıldığında diğer oyuncuların mühürlenmiş final rank'larını sonradan yeniden numaralandırma.

## 7. İlk 10 sonraki sezon ödülü

Bu prompt, sınırlı Top-10 kaynak ödülünün mevcut “sezonlar arasında ekonomik güç taşınmaz” kuralına **ürün sahibi tarafından istenmiş bir istisna** olduğunu kabul eder. Agent aynı ilkesel onayı tekrar sormamalı; fakat avantajın snowball yaratmayacak kesin miktarı ve Deuterium teslim zamanı ölçülmeden rastgele sayı ship etmemelidir. Supersede edilen tasarım kuralını ve sınırlarını dokümante et.

### 7.1 Rekabet kapsamı ve eligibility

- Ödül mevcut Dominion sırasından doğmalı; ayrı puan üretme.
- Bağımsız galaksiler ayrı yarışıyorsa her birinin kendi ödül kapsamını koru.
- Admin/system hesapları ödül alamaz.
- Production botlarının bugün live/final rank içinde bulunup bulunmadığını koddan doğrula. Canlı leaderboard'u değiştirmeden “ilk 10 gerçek kullanıcı” ödülünün botlarla nasıl işleyeceği açıkça kararlaştırılmalı: botun basamağı yakması, ödülün sonraki gerçek kullanıcıya kayması veya ayrı `rewardPlace` kullanılması birbirinden farklı ürün sonuçlarıdır. `isBot` bilgisini public API'ye sızdırma.
- Tüm Dominion'u `0` olan küçük/boş sezonda join-time tie-breaker ile ödül verilmesinin abuse/attendance bonusuna dönüşüp dönüşmediğini değerlendir. Minimum eligibility olacaksa açık, server-side ve season başından ilan edilmiş olmalı.
- 10'dan az uygun kullanıcı varsa yalnızca var olan ödül yerleri oluşmalı.

Display `finalRank`, reward eligibility ve varsa `rewardPlace` kavramlarını birbirine karıştırma. Tamamlanmış sezon UI'ı oyuncunun neden hangi ödülü aldığını doğru söylemeli.

### 7.2 Ödül programı ve balance

- Rank 1–10 için monoton azalan, typed ve tek kaynaktan okunan reward table kullan.
- Ödül programı/version'ı cycle/season oluşturulurken sabitlenmeli. Sezon ortasındaki deploy, oyuncuya önceden gösterilmiş ödülü değiştirmemeli.
- UI preview, season-end entitlement ve payout aynı frozen program version'ından okumalı.
- Season end anında miktar entitlement satırına snapshot edilmeli; gelecekteki balance değişikliği geçmiş alacağı değiştirmemeli.
- Kullanıcının verdiği “1.: 3k Alloy, 2k Crystal, 500 Deuterium” yalnızca örnektir; onaylanmış balance değildir.

En az iki güvenli ödül tablosunu gerçek ekonomiyle ölç:

- Başlangıç kaynağı ve ilk gün üretimine oran
- Erken upgrade/hull maliyetleri
- Mevcut `REWARD_CHAINS` bütçesi
- `Alloy + 2×Crystal + 32×Deuterium` referansının doğru bağlamı
- Deuterium'un normal erişim saati ve contested-source rolü
- Ödüllü/ödülsüz eşit becerili oyuncuların ilk 24/48 saat farkı
- Avantajın kaç üretim saatinde eridiği ve iki sezon sonunda compounding etkisi

Deuterium'u T+0 vermek normal erişim kapısını deliyorsa; entitlement'ın başta görünmesi fakat Deuterium'un normal unlock anında teslimi gibi bir alternatif üret. Deterministik simulation/regression testi ödülün hissedilir olduğunu ama sonucu kendi başına belirlemediğini ve runaway avantaj yaratmadığını ölçsün.

### 7.3 Tek karar kapısı

Archive/statistics implementasyonunu durdurmadan ölçümleri tamamla. Reward kodunu canlı kurala bağlamadan önce kullanıcıya **tek bir toplu karar** getir:

1. Önerilen rank 1–10 reward table ve güvenli alternatif
2. Deuterium'un T+0 mı normal unlock anında mı teslim edileceği
3. Botların ödül basamaklarındaki politikası ve gerekiyorsa minimum eligibility
4. Oyuncu immediate successor cycle'a hiç katılmazsa entitlement'ın expire mı olacağı; varsayılan öneri yalnızca o cycle boyunca geçerli olmasıdır

Soyut soru sorma. Önerilen varsayılanı, ölçülen etkileri ve trade-off'ları kısa bir tabloyla sun. All-time skor veya çapraz sezon istisnası için yeniden izin isteme.

### 7.4 Exactly-once hak ediş ve teslimat

Entitlement en az şu frozen bilgileri taşır: source season/cycle, account, display final rank, reward place/eligibility, Alloy/Crystal/Deuterium miktarları, program version, target successor cycle, status, created/delivered timestamp.

- Source competition + account için unique/idempotent kayıt olmalı.
- Hedef successor cycle henüz oluşmadıysa hak kaybolmamalı.
- Ödül, account'un hemen sonraki uygun MAIN cycle'a ilk başarılı yerleşiminde server tarafından bir kez teslim edilmeli; rollover anında online olma şartı olmamalı.
- Geç join aynı cycle içinde ödülü almalı. Cycle tamamen kaçırılırsa onaylanan expiry politikası uygulanmalı.
- Season-end/rollover retry, worker crash, iki cihaz ve eşzamanlı join/claim en fazla bir payout üretmeli.
- Payout yeni capital'in başlangıç kaynakları yaratıldıktan sonra uygulanmalı; initialization tarafından ezilmemeli.
- Storage cap üstü mevcut rewards politikasıyla tutarlı, açık ve kayıpsız ele alınmalı; silent clamp yapma. Wealth, projection/cache/event güncellemeleri doğru olmalı.
- Client'ın rank veya miktar göndererek claim edebileceği endpoint oluşturma.
- Account silinirse bekleyen entitlement yeniden canlanmamalı.

Ödül sezon sırasında statik program özetiyle; tamamlanmış recap/profile'da kazanılan miktar ve teslim durumuyla; yeni sezon girişinde görünür, tek seferlik bir confirmation ile anlatılmalı. Aynı ödülü iki farklı ekranda iki kez claim ettirme.

## 8. API ve arayüz kalitesi

Mevcut convention'a uygun route/component isimlerini seç. Typed ve testli yetenekler:

- Season/cycle arşiv index'i: stable ordinal, tarih, status ve shard/cycle bağlamı
- Tamamlanmış (`frozen`/`wiped`) sezon leaderboard'u
- Tamamlanmış season + account komutan karnesi
- Seçilen account'un completed-only `Genel` kariyer özeti
- Snapshot'lardan türetilmiş cohort averages
- Reward program preview ve giriş yapan kullanıcının entitlement/delivery durumu

Liste payload'ına bütün profilleri gömme; leaderboard ile detail query'sini ayır. Tamamlanmış snapshot'ı immutable cache'le, fakat account deletion/anonymization sonrası stale kimlik göstermeyecek invalidation/version çözümü kur. Authenticated scope, cross-season/shard parametreleri, enumeration ve hassas account alanlarını gözden geçir. Public response'a e-posta, username credential alanı, bot/admin flag'i veya gereksiz account UUID'si sızdırma.

UI mevcut kit, token, sheet/panel, icon ve navigation dilini kullanmalı. Yeni bitmap asset gerekmez. Loading, error/retry, boş arşiv, 0 istatistik, legacy/partial snapshot, silinmiş komutan ve uzun isim durumları bulunmalı. Dokunma hedefi, keyboard focus, screen-reader label ve renk dışı anlam erişilebilir olmalı. Tüm yeni metinler typed i18n ile Türkçe ve İngilizce eklenmeli.

## 9. Zorunlu TDD risk matrisi

Testleri implementation'dan önce yaz ve doğru nedenle kırmızı olduklarını gör.

### Canlı sezon güvenliği

- Mevcut `/api/leaderboard` response, sıra, fog alanları ve satır davranışı regression testi
- Live season id ile self/başka account profile isteğinin ayrıntı döndürmemesi
- Yeni endpoint üzerinden planet/core veya eylem telemetrisi side-channel oluşmaması

### Snapshot ve metrikler

- Tam season closure'da rank, zorunlu metrik ve cohort sonucunun doğruluğu
- Aynı season-end event'inin iki kez çalışması; transaction ortasında hata ve tam rollback
- Season sınırında/afterglow'da tamamlanan ve tamamlanmayan eylemler
- Multi-world attribution, ownership değişimi ve MAIN/WAITING transferinde exactly-once cycle sonucu
- Cancelled/failed/outbound mining/build/convoy ayrımları; secured ile delivered convoy farkı
- Production accounting: normal, disruption, cap, clock boundary ve freeze
- Sıfır aktivite, late join, 0/1 kişilik cohort ve ortalamaya sıfırların dahil edilmesi
- Snapshot version/availability ve yeni sezon başladıktan sonra frozen kaydın değişmemesi

### Arşiv, profil ve kimlik

- Stabil cycle ordinal/backfill; aynı cycle'daki shard'lar ve çoklu shard sınırı
- Tamamlanmış leaderboard tie-breaker'ının canlı kuralla aynı olması
- `Genel` toplamlarının yalnızca mevcut verili `frozen`/`wiped` sezonlardan gelmesi
- Eski/partial snapshot'ın `0` uydurmadan parse/render edilmesi
- Account name değişimi ve account deletion/tombstone davranışı
- Scope/authorization ve hassas alan sızıntısı

### Reward

- Rank 1–10, rank 11, 10'dan az eligible kullanıcı, all-zero tie ve onaylı bot politikası
- Program version'ın season creation'da freeze olması; config değişikliğinin mevcut sezonu/geçmiş entitlement'ı etkilememesi
- Activation cutover öncesi sezonlara retroactive payout olmaması
- Successor cycle, geç join, skip/expiry ve henüz oluşmamış successor
- Concurrent delivery/claim, season-end ve rollover retry, worker crash: exactly once
- Capital initialization sırası, storage overflow, Wealth ve cache/event güncellemesi
- Forged client rank/miktarının reddi; silinen account entitlement'ının canlanmaması

### Client ve contract

- Client Zod schema ↔ gerçek server response contract; testi önce kırmızı gör
- Season selector, tamamlanmış sezon satırı → profile, `Genel`/season geçişi, search ve own-row
- Loading/error/empty/legacy/deleted states
- Ortalama cümlesi, sayı/duration formatı, tr/en key-placeholder-plural uyumu
- Keyboard ve screen-reader davranışı

Fixture'larda clock, RNG ve identity deterministik olmalı. Bir testi geçirmek için assertion'ı gevşetme veya production davranışını test fixture'ına uydurma; kök nedeni düzelt.

## 10. Uygulama ve doğrulama sırası

1. Talimatları ve ilgili kaynakları oku; mevcut davranış/risk haritasını çıkar.
2. Metrik sözlüğünü ve verinin bugün tutulup tutulmadığını belirle.
3. Archive/snapshot testlerini kırmızıya getir ve reward kararından bağımsız altyapıyı uygula.
4. Reward alternatiflerini simulation ile ölç ve Bölüm 7.3'teki tek karar kapısını getir.
5. Deploy-safe schema/migration, server, API contract ve UI'ı TDD ile tamamla.
6. Targeted testleri çalıştır; sonra `pnpm verify` ile typecheck, lint ve tüm testleri sıfır hatayla bitir.
7. `node tools/visual.mjs <uygun-output-dizini>` ile dar telefon viewport'unda gerçek UI'ı incele: live leaderboard, tamamlanmış sezon listesi, sezon karnesi, `Genel`, empty/legacy ve reward durumları. Screenshot'a gerçekten bak; overflow, focus, sheet scroll ve hiyerarşi kusurlarını düzelt.
8. Son review'da privacy leak, idempotency, concurrency, migration/cutover, account deletion, transfer, N+1 ve eski client/server uyumluluğunu tekrar denetle.

## 11. Dokümantasyon ve final rapor

Kodla birlikte ilgili kesin dokümanları güncelle:

- Season archive/snapshot ve cycle ordinal davranışı
- Metrik sözlüğü ve availability/version kuralları
- Live-private / completed-public (`frozen`/`wiped`) sınırı
- `Genel` görünümün completed-only (`frozen`/`wiped`) semantiği
- Reward eligibility, bot/all-zero politikası, program version, table, delivery ve expiry
- Çapraz sezon kaynak ödülünün önceki “record/cosmetic only” kuralını hangi dar sınırla supersede ettiği
- Balance ölçümleri ve regression eşikleri

Görev bittiğinde kısa, kanıtlı bir final rapor ver:

1. Oyuncu açısından ortaya çıkan deneyim
2. Kesin ürün kararları ve reward table
3. Veri modeli, privacy ve exactly-once garantisi
4. Önemli değişen dosyalar/migration'lar
5. Çalıştırılan testler ve sonuçları
6. Görsel doğrulama sonucu
7. Varsa açık kalan gerçek risk; tamamlanmamış işi “gelecek geliştirme” diye gizleme

## 12. Definition of Done

- Live leaderboard mevcut veri ve etkileşim kapsamıyla değişmeden çalışıyor; canlı profile/telemetry leak yok.
- Tamamlanmış sezonlar stable `Sezon N` kimliğiyle listeleniyor ve wipe sonrasında leaderboard/karneleri kalıcı.
- Bir tamamlanmış sezon komutan profili zorunlu savaş, üretim, gemi, asteroid ve convoy metriklerini doğru gösteriyor.
- `Genel`, yalnızca veri bulunan `frozen`/`wiped` sezonları dürüstçe birleştiriyor.
- Ana metrikler freeze anında mühürlenmiş doğru cohort ortalamasıyla karşılaştırılıyor.
- Ödül programı sezon başından görünür ve version-frozen.
- Onaylı ilk 10 ödülü immediate successor cycle'da exactly once ve kayıpsız teslim ediliyor; eski sezonlara retroactive ödeme yok.
- Transfer, multi-world/shard, retry, concurrency, legacy data, deletion ve season-boundary riskleri testli.
- Türkçe/İngilizce ve dar mobil UI doğrulanmış.
- `pnpm verify` sıfır hatayla tamamlanmış.
