# Guard rota uygulaması — 28 Ekim 2026

Kapsam: ölçülen sıralı gelişim rotasını galaksi başına ilk iki Raider kimliğine bağlamak; normal oyun ödülleri, kaynak ayırma, güncel bakiye, toplam gemi sahipliği ve düzenli üç oturum. Aynı sezonda devreye alınabilir; prod yazması/deploy bu geliştirme turuna dahil değildir. Yeni ceza/koordinasyon sistemi ve 60 günlük tempo değişikliği kapsam dışıdır.

Kimlik seçimi, sezon içindeki Raider profillerinin ordinal sırasıdır; emekli profiller de sıralamada kalır, emeklilik başka bir hesabı aniden guard yapmaz. Hesap/isim, gezegen, kaynak, gemi, araştırma, rapor ve mevcut siparişler değiştirilmez. İki aday normal bedellerle gelişir. Diğer botlar mevcut persona tavanlarında kalır.

Gerekli sınırlar: kuyruktaki hedef tekrar alınmaz; ev/uzak/tamir/üretim gemileri birlikte sayılır; ileri teknoloji edinmiş bot eski kademe gemilerini tamamlamak için geriye dönmez; eski büyük filolar hangarı doldurmuşsa yeni gemi silinmez/hediye edilmez, gerekli kapasite satın alınır. Ön koşul/keşif beklemesi kalıcı blok yaratmaz. Uydu yuvaları dolu mevcut dünyalarda donanım sökülmez. Bina/araştırma için biriktirilen bütçe sonraki ucuz alımla tüketilmez. Her başarılı hizmetten sonraki bakiye ve kuyruk kullanılır. Gece sessizliği, ilk gün kalkanı, ateşkes, fog, yakıt, PvP sınırları ve tek tur/tek uçuş korunur.

Dokunulacak yerler: `services/bots/` karar ve oturum kodu, ilgili sunucu testleri, rota ölçümüyle uyum kontrolü ve bu kayıt. DB göçü, public API, istemci akışı veya oyun kuralı değişikliği beklenmiyor. Ödüller normal gelişim ödülleridir; sezon sıralama ödülleri alınmaz.

TDD sırası: 1) rol/rota/oturum ve aktif sezon fixture testleri FAIL; 2) uygulama; 3) aynı testler PASS; 4) bütün bot/ödül/onarım/queue/fog regresyonları ve tip/lint kontrolü. Uzun snowball veya sezon simülasyonu yeniden çalıştırılmayacak; ölçülmüş rota ve olağan servis regresyonları kullanılacak.

Özellikle sınanacaklar: sıfır kaynak, pahalı araştırma birikimi, fazla mevcut gemi, görevde/tamirde gemi, aynı türde iki kuyruk, yarım kalmış araştırma, uydu yuvaları dolu dünya, sezon sonu, worker restart/zaman atlaması, emeklilik, EU-2/WAITING/donmuş sezon, guard dışındaki bot, gerçek oyuncu ve sezon ödül sınırı.

## Uygulanan davranış

- İki aday, o sezonun en küçük ordinal değerli iki `RAIDER` oyuncusudur. Profil/isim yenilenmez; yeni kimlik veya sezon açılmaz. Göç/aktivasyon SQL'i yoktur. Güncel işçi sürümü sonraki normal turlarında rotayı kullanır.
- `guardRoute.ts`, ölçülen sıranın sunucu tipli karşılığıdır. Araçtaki genişletilmiş sıra ile birebir eşitlik olağan testte kontrol edilir. Core 18 ve 30/30/20 sonrasında guard normal bedellerle gelişmeye devam eder; devam yatırımlarında sezon sonuna kadar üretici geri dönüşü dikkate alınır.
- Mevcut bir dünyada bedel depo kapasitesine sığmıyorsa ve sıradaki Kasa yükseltmesi satın alınabiliyorsa önce Kasa alınır. Eski gemiler yüzünden yeni pakete yer yoksa Hangar yükseltilir. Dolu yörüngede uydu sökülmez, mümkün olmayan uydu hedefi diğer gelişimi durdurmaz.
- Başlangıç/T3 savaş gemileri daha üst kademe üretim izni edinildiğinde eksik diye tekrar alınmaz. Kazıcı ve nakliyeciler bu savaş kademesi ayrımının dışındadır. Tamir en başta, ev/uzak/tamir/kuyruk toplamı yeni gemi alımından önce değerlendirilir.
- Sabah 08, öğlen 14 ve akşam 21 Türkiye saati çevresinde, kimlik/gün başına 0–44 dakika farklılaşan üç adet birer saatlik oturum penceresi vardır. Aynı mevcut oturum yöneticisi, minimum saat, dinlenme ve gece sessizliğini uygular. Guard oturumları insan çevrimiçiliği sıfır olduğunda da açılır; kalan sıradan bot etkinliği insan talebinden türemeye devam eder.
- Normal botların gemi seçimi, hangi gövdenin ağırlığı büyük diye değil, mevcut/üretimdeki filo değerinin hedef dağılımında hangisinin eksik olduğuna göre sıralanır. Raider araştırma listesine eksik İzotop ön koşulu eklendi. Bütün botlarda her başarılı alımın döndürdüğü güncel bakiye/kuyruk sonraki karara aktarılır.
- Operasyon günlüklerinde her guard turunun gelişim işlemleri ve kaynak/ön koşul/kapasite beklemesi `info` düzeyinde `guard development` mesajında izlenir. Ödül toplama tur başına üç claim ile sınırlıdır; geçmişte biriken ödüller tek turda büyük işlem patlaması yaratmaz.

## Aktif sezon yayını

Bu kayıt deployment izni veya yapılmış deployment değildir. Olağan `docs/deployment.md` sürüm/yedek/prova kapıları uygulanır. Guard geliştirmesi sunucu içidir; bu paket için sezon reseti, mevcut zaman damgalarının düzeltilmesi, doğrudan kaynak/gemi verme veya profil adlarının senkronizasyonu yapılmaz. 60 günlük tempo paketi bu yayına karıştırılmaz.

Yayın öncesi hedef galakside iki adayın mevcut profil, gezegen, kaynak, kuyruk ve araştırma görüntüsü salt okunur alınır. Yayın sonrası üç uygulama API'si ve tek worker sağlığı, kuyruk gecikmesi, hata sayıları ve guard gelişim kayıtları izlenir. Mevcut siparişler kendi bitiş anlarında tamamlanmalıdır. Kapalı/donmuş veya EU-2/WAITING evrenlerine guard sürülmemelidir.

Kod geri alınırsa eski worker normal bot politikasına döner; guardların normal hizmetler üzerinden ödediği ve kazandığı varlıklar geçerli oyun verisidir. Bunları silmek, yedekten canlı verinin üzerine dönmek veya araştırmayı geri çevirmek geri alma adımı değildir.

## Doğrulama sonucu

- TDD: yeni modüller olmadan guard testleri FAIL; normal filo dağılımı testi ilk-hull seçiminde FAIL; dolu yörünge/depo vakası FAIL; üst kademe filonun Kurye'yi hâlâ tamamlaması testi FAIL. Her birinin ilgili kodu düzeltildi, etkilenen testler tekrar geçti.
- 19 sunucu dosyasında 285 farklı senaryo doğrulandı: bütün bot paketleri, ödüller, inşaat kuyrukları, araştırma ve Endüstri. Geniş koşuda 284 geçti; o sırada eklenen Kurye testi kırmızıydı. Kurye düzeltmesinden sonra etkilenen guard/politika dosyaları yeniden çalıştırıldı: **15/15 PASS**. İlgisiz assertion gevşetilmedi; eski nüfus-azaltma fixture'ı, test ettiği sıradan oturum davranışını guardlardan ayırmak için açıkça BALANCED yapıldı.
- Ölçülen rota ile sunucu rotası eşitliği dahil araç regresyonları **6 PASS**, iki uzun rota ölçümü bilinçli olarak skip. Toplam **291 farklı olağan senaryo** doğrulandı. Snowball/uzun sezon simülasyonu yeniden çalıştırılmadı.
- `pnpm --filter @astera/server typecheck`: PASS. Sunucu ve değişen araç dosyasını kapsayan `pnpm lint`: PASS, hata/uyarı yok. `git diff --check`: PASS. Tüm frontend veya tüm workspace testlerinin koşulduğu iddia edilmiyor; istemci/rules kodu değişmedi.
- Bir worker/tek Vitest worker ile sıralı, `nice -n 10` ve en fazla 4 GiB Node heap ile çalıştırıldı. Testler yerel `_test` veritabanında; prod'a bu geliştirme turunda bağlantı/yazma/deploy yapılmadı.

Kaynak hash'leri ve tam komutlar: [uygulama doğrulama kaydı](evidence/bot-guard-implementation-2026-10-28.json).

## İkinci inceleme: sınır durumları

Gereksinim: aktif sezondaki farklı bina/filo dağılımları rotayı kilitlememeli. Dolu kara savunması mobil üretimi durdurmamalı; Hangar kurtarma adımı da depo kontrolünden geçmeli; son Hangar seviyesinde bütün paket yerine sığan adet alınabilmeli. Paket bedeli depodan büyükse tek tek/parçalı normal alım mümkün kalmalı. Mevcut birlikler silinmez, kuyruklar ve gerçek servis kapıları korunur. Etki alanı guard hedef seçimi/teklifi ve ilgili testlerdir; ortak oyun kuralları değişmez. Bu sınırlar önce kırmızı regresyonlarla doğrulanacak.

Kaynak ayırma tüm para birimleri için geçerlidir: keşif sondası da A/C harcadığından pahalı araştırma için ayrılmış bütçeyi tüketmemelidir. Madencilik/hurda servisleri yakıt kesmez; savaş uçuşlarının yakıtı mevcut tahmin fonksiyonunda kontrol edilir. Normal botlarda bütçe ayırma olmadığı için mevcut uçuş davranışı korunmalıdır.

Ek kapasite sınırı: Kasa Core tavanındaysa veya sıradaki Kasa da depoya sığmıyorsa, pahalı acil Hangar ekonomik gelişimin önüne kalıcı olarak geçmemeli. Olağan sıradaki ucuz üretici yükseltmesi, kapasiteyi erişilebilir hale getirmek üzere korunmalı.

Üretimi hiç olmayan yakıtın eksikliği yalnız Kasa alarak çözülmez. Mevcut sezon botunda Sentez 1 var ama Döteryum Rafinerisi yoksa, Sentez 2 için yakıt depolamaya çalışmadan önce planlanmış ilk rafineri başlatılmalıdır.

Sıradan botların eski kara savunması alımında da kapasite biriminden adet hesabına dönüş ve üretimdeki topların doluluğu incelenir. 12 birim alan kaldığında 12 Harpoon istenmemeli; kuyruğa verilmiş topların alanı yeniden kullanılmamalı. Bu, persona oranlarını veya savunma kurallarını değiştirmeden alım hesabında düzeltilebilir.

### Testle doğrulanan bulgular ve düzeltmeler

| Öncelik | Bulgu | Çözüm |
| --- | --- | --- |
| Yüksek | Eski toplar kara alanını doldurduğunda ilk eksik top hedefi bütün YARD hattını tutuyor, mobil savaş gemileri seçilemiyordu. | Hiçbir top sığmayan hedef atlanır; aynı tersanede mobil hedef seçilebilir. Eski toplar korunur. |
| Yüksek | Acil Hangar hedefi, depo denetiminden sonra seçildiği için kendi bedeli depoya sığmasa da Kasa kurtarması tetiklenmiyordu. | Hangar değişimi önce yapılır; son hedef listesi depo denetiminden geçer. |
| Yüksek | Son Hangar seviyesinde hedef paketin tamamı sığmıyorsa sığan gemiler de alınamıyordu. | Alım adedi gerçek boş alanla sınırlandırılır; kuyruktaki gemiler de alan ayırır. |
| Orta | Toplam hedef bedeli depodan büyük olduğunda gereksiz toplu birikim/Kasa yükseltmesi bekleniyordu. | Depoya sığan normal bedelli parça alınır; toplam sahiplik hedefi korunur. |
| Orta | Araştırma için ayrılan A/C tur sonu sondasına harcanabiliyordu; yalnız yakıt ayrımı uygulanmıştı. | Üç para biriminin de harcanabilir bakiyesi hesaplanır; doğrudan ve eski raporu yenileyen sonda yolları bu bakiyeyi kontrol eder. |
| Yüksek | Acil Hangar depoya sığmıyor ve Kasa da erişilemiyorsa, ucuz ekonomik hedefin sürekli yerini alıp gelişimi durduruyordu. | Kasa kurtarması mümkün değilse asıl ekonomik hedef korunur. |
| Yüksek | Sıradan botlarda kalan alan, top adedi sanılıyor ve kuyruktaki toplar sayılmıyordu. Alana sığan küçük sipariş varken bütün denemeler reddedilebiliyordu. | Kuyruk yükü düşülür ve kalan alan gövdenin gerçek büyüklüğüne bölünür. Persona oranları değişmez. |

Mevcut yakıt üretimini başlatma, aktif sezondan kalan siparişlerin kimlik/bedel/bitiş zamanını aynen koruma ve Kazıcı/Kurye'yi üretimde tekrar almama kontrolleri de eklendi. Yakıt başlangıcı kontrolü mevcut kodda zaten geçti; hata diye raporlanmadı.

İlk dört kapasite testi birlikte FAIL → PASS; sonda bütçe testi FAIL → PASS; erişilemeyen kapasitede ekonomi testi FAIL → PASS. İki fixture, Akademi'den kalan Warden yükünü ve önceden tamamlanması gereken yakıt adımlarını açıkça ayıracak şekilde netleştirildi; beklenen sonuçlar gevşetilmedi.

Sıradan botun kalan alana göre Harpoon/Thorn seçmesi için iki ayrı test FAIL olarak görüldü; ardından yalnız kuyruk yükü ve adet hesabı düzeltildi. Bu son değişiklik guard geliştirme dalını veya ortak üretim servislerini değiştirmez; tüm bot regresyonları tekrar çalıştırılır.

Savunma gerçekten üretilebildiğinde iki eski mobil üretim fixture'ı da kara alımı başlatıp ölçmek istedikleri son YARD yuvasını doldurdu. Kurye ve iki aynı tür kuyruk testi, kara savunması önceden yerleştirilerek mobil kapasiteyi izole edecek şekilde düzeltildi; mevcut mobil üretim/kapasite assertion'ları aynen korundu. Kuyruk derinliği veya alım önceliği değiştirilmedi.

Aynı türden iki kuyruk testi ayrıca eksik Kurye satın alarak yanlışlıkla geçebiliyordu. Kazıcı ve Kurye hedefleri fixture'da tamamlandı; başarılı yeni siparişin savaş gemisi olması sağlandı. Ayakta duran mobil yük yine 20, önceki iki kuyruk yükü 30 ve kalan alan 30'dur.

Geniş regresyonun ilk koşusu, aynı makinedeki başka bir worktree'nin testleri varsayılan yerel DB'yi kullanmaya başladığı görülünce durduruldu. Sonuç kabul edilmedi; `astera_guard_review_test` adlı ayrı yerel DB açılıp normal migration'larla hazırlandı. Son doğrulama bu DB'de tek worker ile yürütülür. Prod bağlantısı/yazması yoktur.

### İkinci inceleme doğrulaması

- İzole geniş regresyon: **20 dosya, 306/306 PASS**. Bu koşu son sıradan-bot kara kapasitesi düzeltmesinden öncedir; araştırma, Endüstri, ödüller, inşaat kuyruğu ve onarım istasyonu ortak servislerini de kapsar.
- Son kara kapasitesi düzeltmesinden sonra **15 bot dosyası** yeniden çalıştırıldı: 182 PASS, iki eski mobil fixture FAIL. Sebebi yukarıda açıklanmıştır. Fixture'lar düzeltildikten sonra etkilenen `bots-turn.test.ts` yeniden **41/41 PASS**. Böylece son bot kodunda **184 farklı bot senaryosu** doğrulandı; ortak servislerin değişmeyen 124 senaryosu ile **308 sunucu senaryosu**.
- Araç/rota eşitliği: **6 PASS**, yalnız açık izinle koşulabilecek iki uzun ölçüm skip. Toplam **314 farklı olağan senaryo**. Uzun snowball, 30/60 günlük ekonomi veya PvP simülasyonu yeniden çalıştırılmadı.
- Sunucu typecheck PASS. Sunucunun tamamını, kök yapılandırmayı ve değişen rota aracını kapsayan lint PASS: hata/uyarı yok. `git diff --check` PASS. Frontend/tüm-workspace kontrolü iddia edilmez.
- Yeni migration yok. Yerel izole test DB'si dışında veri yazması, prod bağlantısı, deploy, ücretsiz bina/gemi/araştırma verme yok.

Sınır: bu doğrulama ücretli gelişimi ve kod regresyonlarını kapsar; canlı baskınlar altında üstünlük, zorbalığı azaltma veya oyuncuların bot algısı ölçülmüş değildir. Mevcut PvP hedefleme kuralları değişmedi. 60 günlük sezonun nihai tempo paketi ayrı doğrulanmalıdır; burada yeni bir sezon/tempo ayarı uygulanmadı. Önceki uygulama kanıtının üstüne gelen güncel kaynak hash'leri ve koşu kayıtları, aynı JSON dosyasının `review` bölümündedir.
