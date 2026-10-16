# Honor uygulama kaydı

**15 Ekim ortak taraf değişikliği:** kullanıcının onayıyla yeni Honor sürümü 3
uygulandı. Ortak saldıran/destekli savunan taraf pozitif Honor kazanmaz;
saldırgan yaptırımları ve tek başına karşı tarafın normal hesabı korunur. Eski
v1/v2 puanları ve sezon yapılandırmaları değiştirilmedi. [Sözleşme, kapsam ve
doğrulama](honor-solo-credit-2026-10-15.md). Bu değişiklik review'daki diğer
lansman sorunlarını kapanmış saymaz.

**15 Ekim uçtan uca review:** mevcut regresyonlar geçerken beş sorun ayrı
senaryolarla doğrulandı; bunlardan biri kapalı SHADOW gözleminde de gerçek savaşı
durdurabiliyor. Lansman durumu için [güncel inceleme raporu](honor-full-review-2026-10-15.md)
esas alınmalı. Bu review uygulama kodunu değiştirmedi.

14 Ekim: kullanıcı planı kabul etti; mevcut Hakimiyet korunacak. Savunmada
yenilgi Honor azaltmaz; boş depo yağması tek başına Honor üretmez.

## Önceki çalışmanın geri alınması

Hakimiyet'i değiştirme araştırmasının 11 belgesi ve özel prototip dizini kaldırıldı.
Dosyalar önce kendi eski SHA-256 kayıtlarıyla doğrulandı ve `.dev/honor-rollback-20261014/`
altında özel arşive alındı. Diğer 3.174 dosyanın içeriği değişmedi. Canlı Hakimiyet
hesabına önceki araştırmada uygulama değişikliği yapılmamıştı.
Honor prototipinin ortak değerleme/paylaştırma yardımcıları ve değişmez veri girdileri
ayrıldı; eski hesaplara bağımlılık kalmadı. Ayrıştırma sonrası 54 araştırma testi geçti.

## Sıra ve risk kapsamı

- [x] Sürüm 1 saf kurallar: sınıflama, verimlilik, sivil/ücretsiz yeniden kurulum,
  zayıf hedef, tekrar, beşte bir hassasiyetli karşılık bütçesi, çift indirimi.
- [x] Ortak havuz saf hesabı: aynı sahibin dalgaları birleşir; kişisel öldürme/hasar
  sahipliği yok; token müttefik/hedef, kargo-only, çift rezervasyonları ve yuvarlama.
  Kalkan ağırlığı motorun normal ateş ölçümüne bağlandı; bonus NULLIFIER hasarı hariç.
- [x] Ödül saf hesabı: eşit sıra, sınırlı ödeme, sıfır/negatif puan, iki listede tek büyük paket.
- [x] Kalıcı veri: kaynak kimliği ve kanıt, sezon sürümü, donmuş niyet, askerî/Core
  geçmişi, ilişki geçmişi, çift ve karşılık bütçesi, atomiklik, retry ve geç olay.
- [ ] Kaynak adaptörleri: normal 1v1, destek, ortak saldırı, anıt, konvoy,
  Death Star/yüzey hasarı. Kaçış, kalkan, rebuild, yaralı filo, iptal, sahip değişimi.
- [ ] API/arayüz: hedefte önceden anlaşılır koşullar, ana Honor sıralaması,
  ayrı Hakimiyet satırı, ortak pay, rapor nedenleri, ödül açıklaması, tüm diller.
- [ ] Sezon kapanışı, arşiv, ödül teslimi, yeni sezon etkinleştirmesi; mevcut
  sezonların ve Hakimiyet sonuçlarının değişmediğini gösteren regresyonlar.
- [ ] Sıralı typecheck/lint/test; arayüz değişince gerçek görsel doğrulama.

Testler önce RED, sonra GREEN. Tek worker, düşük öncelik, en fazla 4 GiB Node heap;
uzun ekonomi simülasyonu yok. Eksik adaptör/geçmişle sistemi etkinleştirmek yok.

## Üretim kural modülleri

- `packages/rules/src/honor.ts`: mikro-Honor, sınıflama, tek taraf, yönsüz çift,
  işaretli tam paylaştırma, sınırlı kalkan ağırlığı.
- `honorTeam.ts`: ortak verimlilik, karma hedef ilişkileri, tek ortak ham havuz,
  her çiftin iki tarafa birlikte uygulanan rezervasyonu, ardından ortak paylaşım.
- `honorRewards.ts`: yarışma sırası, eşitlerin kapladığı ödül basamaklarını paylaşma,
  Honor'a bağlı kaynak üst sınırı, mevcut Hakimiyet paketiyle tek büyük ödemeyi seçme.
- `honorValuation.ts`: sezon başında kaydedilecek katalog, gerçek kalıcı kayıp,
  silahlı/sivil ayrımı, ücretsiz ground rebuild ve başlangıç filosu doğrulaması.
- `honorHistory.ts`: sezon tier tepesi, 24 saat askerî tepe. Pencere öncesindeki
  son durum taşınır; yalnız son 24 saatin kayıtlarına MAX uygulama hatası yapılmaz.

Kurallar kalıcı Honor defterine ve normal 1v1/destek/ortak saldırı/anıt savaş
writer'larına bağlandı. Stratejik kaynakların entegrasyonu tamamlanmadı.
Kalıcı defterin duplicate, farklı eşzamanlı savaş, kanıt çakışması, rollback ve
geç olay yeniden hesaplama testleri gerçek izole PostgreSQL üzerinde geçti.
Kaynak adaptörleri, arayüz ve sezon etkinleştirmesi tamamlanmış değildir.

Üretimleştirme incelemesinde prototipten ayrılan iki koruma:

1. Karşılık bütçesi kaynak değerinin **beşte birlik tam biriminde** tutulur. Tek
   yağma biriminden doğan 0,2 kaynak değerini kaydedip yeniden okuyunca kaybetmez.
2. Sivil katılım ağırlığı ceza paylaşımı içindir. Pozitif başarı payı satın alamaz;
   hatalı bir adaptör K gönderse bile kargo-only tarafın pozitif ham sonucu sıfırdır.

## Gerçek kaynak envanteri ve entegrasyon sınırları

| Akış | Kaynak / gerçek kanıt | Bağlama koşulu |
| --- | --- | --- |
| Normal 1v1 | `worker/handlers.ts`, `resolveRaid`, `battle_reports` | `soloStack` boş sahibini gerçek mission/defender kimliğiyle eşleştir. Kaçış sonrası gerçek kayıplar, rebuild, gerçek yağma. |
| Savunma desteği | Aynı handler, `defenderLine`, `clanSupport` | Ev filosu + gerçek destek sahibi; host-only kişisel Honor yok. Kalkan normal ateş katkısını, NULLIFIER özel yakımından ayrı ölç. |
| Ortak saldırı | `clanWarSettlement.ts` | Ortak K/L; mevcut Hakimiyet hasar atfını Honor'a taşımama. Tüm çiftler ve kişisel pay tek transaction. |
| Anıt | `monumentArrival.ts`, `monument_battles`, katılımcılar | Ölü birimin sahibi mevcut. Nötr/boş ele geçirme puan üretmez. Yağmayı kaybeden sahipler ayrıca kesin eşleştirilmeli. |
| Death Star | `strategic.ts:applyDeathStarStrike`, `strategic_impacts` | Güncel kodda imha dizileri boş; gerçek etki kalkan söndürme, EMP ve koloni bağlılığı. Bunlardan gemi imhası uydurulamaz. Tüketilen silah ve zayıf hedefe tekrarlı stratejik zarar için adaptör sözleşmesi/ceza ayrıca tamamlanmalı; muaf bırakıp açılış yapılamaz. |
| Stratejik önleme | `strategicInterception.ts`, `strategic_interceptions` | Bir stratejik silah ve bir önleme mühimmatı tüketilir; sıradan hull kaybı değildir. Dondurulmuş varlık bedeli ve uygunluk ayrı doğrulanmalı. |
| Galaksiler arası konvoy | `intergalacticConvoyRaid.ts` | Oyuncu rakibi yok; takvim olayının ödül uçuşu. İnsan PvP Honor kaynağı değildir. |
| Ticaret / pirate / nötr | `trade.ts`, `pirateRaid.ts`, nötr savunma | Ticaret akışı mevcut kodda PvP çatışması içermez; NPC ve çevresel kayıp rekabetçi Honor'a çevrilmez. |

Askerî sahiplik için `units.ownerPlayerId` esas: uçuş, support, ortak escrow,
anıt ve dok burada temsil ediliyor. `monument_ship_lots` sağlık/teknoloji delilidir;
aynı gemiyi hem units hem lots üzerinden N'ye eklemek iki kez sayar.

Kritik kalan testler: geciken olayın etkili zamanıyla yeniden muhasebe, sezon/kimlik
ve kanıt çakışması, aynı savaşın eşzamanlı teslimi, ortak çift kilitleri, Core/filo
üretimi ve transfer geçmişinin tamlığı, saldırı sonrası taraf/sahip değişimi,
stratejik yaptırım kaçışı, eşit sıra ödül teslimi ve sezon kapanışı yarışları.

## Kalıcı defter sözleşmesi

Yeni Honor tabloları mevcut Hakimiyet tablolarına yazmaz. Sezon ayarı açıkça
oluşturulmadıysa hak ediş yok; SHADOW görünmez kayıt, ACTIVE yeni sezon sözleşmesidir.
Sezon ayar satırı defterin transaction kilididir. En fazla 300 komutanlı oyunda bu
kısa muhasebe bölümü, karma takımlar arasında çoklu çift kilit sırası ve deadlock
karmaşıklığını önler. Savaş/gezegen kilitlerinden sonra alınır; defter kilidinden
sonra başka oyun kaynağı kilitlenmez. Puan ve çift tabloları kendi projeksiyonudur.

Olay kimliği sezon + kaynak türü + gerçek kaynak UUID; Zod ile ayrıştırılmış delilin
kanonik hash'i aynı kimlikte değişik girdiyi reddeder. Tam tekrar mutasyonsuzdur.
Olay zamanı ve kaynak kimliği deterministik sıra oluşturur. Sona ekleme hızlıdır;
geç gelen olayda aynı sezonun Honor olayları sıralı yeniden işlenir. Ortak havuzun
rakipler arasında kurduğu bağımlılıklar nedeniyle sadece bir kişiyi geri hesaplamak
doğru değildir. Yeniden kurulum, çiftler, yaptırım/karşılık tüketimi ve kişisel
toplamlarla aynı transaction içinde tamamlanmalıdır. Kullanıcı raporu da bu
projeksiyondan okunur; eski net sayıyı ayrı yerde unutmak yok.

Tekrar sayacı ve karşılık hakkı istemciden alınmaz. Sadece uygun gerçek olaylardan,
24 saat penceresinde ve her komutan çifti için hesaplanır. Karşılık bütçesi en eski
hak edişten tüketilir; karşılık olarak tüketilmiş zarar yeni bütçe oluşturmaz.
Olay delilindeki ilişki (aynı/recent klan/yardım) server tarafından dondurulur.

## Envanter zamanı entegrasyonu

Askerî geçmiş kaydı servisi ve gerçek PostgreSQL testleri eklendi. Wealth yenilemesi
aynı transaction içinde sahip bazlı envanteri kaydeder. Tüm üretim çağrıları açık
gözlem zamanı ile bağlanacak; unutulmuş bir çağrı yalnız Honor sezonu açılınca
bozulmamalı. Gecikmiş fiziksel varışın zamanı ile güncel toplam envanterin gözlem
zamanı ayrı tutulmalı. Eski zamana güncel toplam yazılması reddedilir. Özellikle
anıt catch-up, radyasyon, dönüş/iptal, üretim ve koloninin el değiştirmesi kapsamda.

İlişki okuyucusu: yalnız sunucudaki sezon kimlikleri; bot emekli olsa da bot;
admin kimliği dış yapılandırmadan; aynı hesap rekabetçi değil. Yedi günlük klan
kontrolü aynı klanda gerçekten çakışan üyelik aralığını arar (birbirini hiç
görmemiş eski/yeni üyeyi cezalandırmaz). Teslim edilmiş gönüllü yardım, teslim
anından itibaren yedi gün sayılır; geri dönmüş/henüz yoldaki/gelecekteki yardım
geçmiş destek diye kullanılamaz. Tam sınırda süresi dolar, gelecekteki kayıtlar
geçmiş niyetin ilişkisini değiştirmez. Sunucu kanıtı istemciden alınmaz.

Doğrulama: 7 envanter/zamanlama testi ve 6 ilişki testi geçti. İlgili dört eski
savaş/radyasyon dosyasında 44 test geçti, 12 test başarısız. Hatalar eski otomatik
dok beklentilerine ait: mevcut bakım sistemi yaralı gemiyi hangarda bırakıyor.
`shipDamage.ts`, `shipMaintenance.ts` ve bu iki test dosyası görev başlangıcındaki
SHA-256 kayıtlarıyla aynı; Honor bunların içeriğini değiştirmedi. Özellikle doğrudan
`landShips` çağıran başarısız test Honor defterine hiç uğramıyor. Bu ilgisiz bakım
çalışması geri alınmadı; genel doğrulama yeşil diye sunulamaz. Sıralı regresyon
koşusu 135 saniye, en yüksek RSS yaklaşık 432 MiB, ortalama CPU %18.

## Donmuş niyet kaydı

Kaynak türü/sezon/gerçek görev kimliği bir kez kaydedilir. Katılımcı kimlikleri,
T/N referansı ve ilişki uygunluğu server tarafından alınır; aynı niyetin tekrarında
filo veya tier değişmiş olsa bile ilk sözleşme döner. Farklı katılımcı/niyet zamanı
aynı kaynak kimliğine yazılamaz. Kayıt kaynak görevle aynı transaction içinde
rollback olur. Legacy sezon kayıt üretmez. Çözümlenen savaşın katılımı değiştiyse
yeni katılımcı eski sahibin koşulunu miras alamaz; adaptör katılım farkını açıkça
ele almalı. İlk entegrasyonun 1v1 sınırı bu kontrolle korunacak.

Normal saldırı gönderimi artık niyeti aynı transaction içinde yazar (5 DB testi).
Ele geçirme ve koloninin ayrılması iki ayrı testle RED→GREEN düzeltildi: yeni
sahibin N/T kaydı ve eski sahibin filo düşüşü eksik kalmıyor. Uçuştaki eski sahibin
gemileri ona ait kalır; ayrılmada eve dönen filo üretim sayılmaz. Kalkanın normal
ateşten silahlı hattı koruyan kısmı motordan ayrı bir sonuç olarak ölçülüyor;
350 savaşlık eski sonuç hash'i değişmedi. Nullifier bonusu, boş/ateş edemeyen hat
katkı üretmez. Kesirli yağma toplam A+2C+32D üzerinden bir kez aşağı yuvarlanır;
sonra mikro-Honor hesabı tam sayı kalır. Bu yuvarlama bir olayda bir kaynak-değer
biriminden az kısmı dışarıda bırakır; UI'nın kaynak bakiyesini değiştirmez.

`honorBattleEvidence` 9 testte gerçek resolver çıktılarıyla doğrulandı: zafer,
yenilgi, karşılıklı kayıp, boş hedef, kaçış, ground rebuild, takım tank katkısı,
kalkan payı ve değişmiş/uydurulmuş katılımcı. Normal/destekli gezegen savaşı ile
ortak klan saldırısının gerçek settlement bağlantısı eklendi. Anıt ve özel saldırı
bağlantıları henüz tamamlanmadı.

Sonradan katılan mevcut oyuncunun savunma desteği için tarihsel referans bağlantısı
eklendi: niyetin tuttuğu kayıt sırası sınırı + gönderim zamanı kullanılır. Aynı
milisaniyedeki sonraki envanter değişikliği eski gönderime sızamaz. Ana hedefin
kimliği değişirse başka sahibin sınıfı miras alınmaz. Eksik geçmiş veri sessizce
bugünkü filoyla doldurulmaz (3 DB testi). Yeni sezon oyuncu kabulünden itibaren
gözlem tuttuğu için bunun lansman önkoşulu tam envanter geçmişidir; geçmişi olmayan
canlı sezonda SHADOW açmak her destek için kalibre edilmiş sonuç vaat etmez.

Kanıt hash'i sıra bağımsız hâle geldi: aynı katılımcıların farklı DB dönüş sırası
aynı kaynak kabul edilir; miktar veya sahip değişikliği hâlâ çakışmadır. Defterin
11 gerçek DB testi geçti.

## Çok kaynaklı transaction sınırı

Normal, destekli ve ortak gezegen savaşları aynı kaynak adaptörünü kullanıyor.
Anıt catch-up bir transaction içinde birden çok geçmiş savaşı çözebilir ve
ardından klan/filo mutasyonuna devam edebilir. Honor sezon kilidini her savaşın
ortasında almak farklı bir oyun transaction'ıyla ters kilit sırası yaratır.
Bu nedenle kaynak delili callback sırasında biriktirilecek; aynı DB transaction
callback'i bittiğinde, commit'ten önce Honor hesapları yazılacak. Hata bütün oyun
ve Honor yazılarını geri almalı; ayrı worker/ikinci commit yok. DB sınırındaki
küçük commit-öncesi callback kuyruğu yalnız bu kilit sırası ihtiyacını çözer.
Kuyruksuz mevcut transaction davranışı aynı kalır; sıralı callback, hata rollback
ve paralel transaction izolasyonu gerçek DB testleriyle doğrulanacak.

Commit-öncesi sınırın 3 DB testi ve Honor kuyruğunun 2 DB testi geçti. Kaynak
kanıtı kuyruğa alındığında Zod kopyası alınır; sonraki nesne mutasyonu eski delili
değiştirmez. Kaynak çakışması bütün oyun yazılarıyla birlikte rollback olur.
Normal/destekli/ortak gezegen entegrasyonları geçti. Boş yağma sıfır, zayıf tier'a
başarılı baskın negatif, sonuç almayan küçük intihar negatif; pasif savunma negatif
değil. Küçük saldırganı ezen çok büyük savunmacı da askerî bant nedeniyle bundan
pozitif farm üretmez. Ortak saldırıda filosuz koordinatör puan almaz. Uçuş sırasında
gezegen sahibi değişirse iki taraf için Honor dışı kalma nedeni `TARGET_CHANGED`
olarak delile yazılır; mevcut savaş davranışı ve Hakimiyet sürer.

Anıtta fiziksel olarak hedef alınan fakat ateş edemeyen yaralı gövdeler: askeri
kayıp gerçek kayıptır; pozitif katılım ağırlığı sıfırdır. Bütün taraf bu durumda
olduğunda kendi kaybının saldırı cezasını paylaştırmak için fiziksel pasif varlık
değeri kullanılır; sırf hesapta aktif ağırlık yok diye gerçek savaş takılmaz.
Kargo/ateş edemeyen gövde aynı fallback kanalıdır; pozitif paya dönüşmez.

Anıtın normal gönderimi ve ortak klan gönderimi niyet yazar. Gerçek PvP anıt
savaşı aynı Honor defterine bağlandı; bağımsız varışlar ayrı olay, ortak grup tek
olay kalır. Farklı sahiplerin ganimet kaybı, gerçek alınan miktarın yok olan yük
oranıyla eşleştirilir. Savunmanın kurtardığı saldırgan yükü pozitif yağma bonusu
sayılmaz; mevcut sözleşmenin savunma hesabı yalnız askerî başarıdır. Sonradan
eklendiğinde gönderim tarihinde henüz oyunda olmayan bir komutan için geçmiş
uydurulmaz; savaşın Honor dışı kalma nedeni `PARTICIPANT_JOINED_LATE` olarak kayda
geçer. Eskiden beri var olan oyuncunun eksik geçmişi ise veri hatası olarak kalır.
Geçmişi eksik olan kişiyi sıfır filo sayarak avantaj yaratılmaz.

Anıtın gerçek gönderim/savaş testi, geç savaş envanteri ve yeni/ayrılan sahip
koşulları toplam 8 DB testinde geçti. Ortak anıt grubunun uçtan uca ek testi,
kargo dağılımı, büyük catch-up ve sezon kapanışı flush sırası kontrolü kalıyor.
Özel saldırının geçici EMP/bağlılık etkisini kalıcı gemi imhası gibi yazmak yanlış;
bu etkinin zayıf hedef yaptırımı için ayrı, açıklanabilir girdisi henüz tamamlanmadı.

Toplu Honor sunucu kontrolü: **16 dosya / 67 test geçti**, 133,62 saniye.
Bu sonuç genel server suite'in yeşil olduğu anlamına gelmez; önceki bakım test
uyuşmazlıkları ayrı kaydedildi. Typecheck'te Honor kaynaklı hata yok; mevcut
`maintenance-dispatch.test.ts` health sözleşmesi hataları devam ediyor.

Sezon ödül entegrasyonu kapsamı: ACTIVE'de eşit Honor sırası ve kaplanan ödül
basamaklarının ortak paylaşımı; Dominion/Honor paketlerinden kaynak değerince
büyük olanın bir kez ödenmesi; sıfır/negatif ve SHADOW'da Honor ödülü yok.
Sezon arşivinde Honor ve Dominion sırası ayrı alanlar; eski sezonlar null Honor
ile kalır. Eşit Honor ödülü için aynı rewardPlace birden çok hesapta geçerli;
eski Dominion basamağının tekilliği korunur. Anıt kapanışında biriken delil
sıralama sabitlenmeden aynı transaction içinde flush edilmeli; sonra yeni olay
reddedilir, aynı olay retry edilebilir. Gerçek DB regression testleri eklendi.

Sezon ödülü ve eski Dominion regression testleri: **8 test geçti**. Eşit birincilikte
1./2. Honor paketleri havuzlanıp iki kişiye eşit verilir; unique index bu eşitliği
bozmuyor. Eski Dominion basamak tekilliği ve hesap başına tek paket korunuyor.
Kapanışta bekleyen olayın flush edilmesini ayrıca doğrulayan 3 deferral testi geçti.
Güncel kuralların tamamı: **130 dosya / 2.260 test geçti**, 104,24 saniye.

Arayüz/API kapsamı: aktif sezonun yeni istemcisinde Honor varsayılan; açıkça
seçilebilen Dominion sekmesi mevcut puanı korur. Eski istemcinin parametresiz
leaderboard çağrısı Dominion olarak kalır; mikro-Honor'u yanlışlıkla Dominion
diye etiketlemez. SHADOW puanları hiçbir public yanıta girmez. Honor'da eşit sıra
ve yalnız insan komutanlar; bot/admin ayrımının özel kimlik alanı yayınlanmaz.
Görevde React için `vercel-react-best-practices` yönergeleri okundu/uygulanıyor.

## Honor görsel önceliği — 14 Ekim kullanıcı talimatı

Tek ana simge: yükselen dört uçlu yıldız ve açık yörünge; mevcut tek renk SVG
sistemiyle çizilir. Honor beyaza yakın, kalın ve birincil; Hakimiyet gri, regular
ve aynı bağlamda yaklaşık 2 px küçük. Sıralama varsayılanı, kişisel kart, savaş
listesi/detayı, anıt raporu, sezon arşivi ve ödül açıklamaları aynı dili kullanır.
Ödül farkı dürüstçe nominal 2× ve gerçek hak edilen paket olarak gösterilir.

Davranış caseleri: Honor=0 gerçekten gösterilir; negatif Honor kırmızı utanç
işaretine dönüşmez; eski sezon/raporda null Honor uydurulmaz; SHADOW gizli kalır;
ortak savaşta kişisel pay ortak havuzdan gelir; katılımcı olmayan kişiye delil
sızmaz; özel kaynakların puanı henüz üretilmiyorsa sahte sıfır gösterilmez.
Rapor API'si tek toplu sorguyla yalnız okuyucunun sonucu/nedenini verir;
askerî referanslar ve karşı tarafın filo değerleri yayınlanmaz. Önce bu
sözleşme ve gösterim testleri RED, sonra uygulama GREEN; CSS için taklit test yok.
350 px ve masaüstü, altı dil, uzun sayı/ad ve negatif sonuç görsel kontrolü.

## Görsel öncelik ve tarihî başarı sonuçları

HonorIcon tek renk SVG olarak mevcut simge ailesine eklendi. RankingScores
bileşeni bütün yüzeylerde Honor'u 12 px / bold / açık ink; Hakimiyet'i
10 px / regular / ikincil gri gösterir. Ana sezon puanı daha büyük beyaz
readout, Honor varsayılan sekme, gerçek ödeme/tam paket ve aynı derece için
2× Hakimiyet nominal paketi görünür. Raporlarda sıfır gerçek sonuç görünür;
eski/null ve SHADOW sonucu gösterilmez. Kaynak defterinin yeniden hesaplanan
kişisel payı tek toplu sorguyla okunur; gizli N/T/hesap kimliği açılmaz.

Komutan kartı, baskın/anıt listesi ve detay, sezon kapanışı, arşiv ve kariyer
aynı hiyerarşiyi kullanır. Yeni Honor sezonunda harita kürsüsü ve önceki
sezon sohbet rozeti Honor'a bağlıdır; eski sezonlar Hakimiyet kalır. Eşit
pozitif birincilikler aynı kalıcı unvanı alır. 0/negatif Honor sıra olarak
görünür fakat madalya, şampiyon unvanı veya kariyer şampiyonluğu üretmez.

Son toplu UI kontrolü: 16 dosya / 381 test geçti. Rapor/leaderboard API
8 test; gerçek baskın/arşiv ilk kontrolü 5 test; unvan/ödül 8 test;
kariyer ve önceki sezon rozetleri 11 test; harita kürsüsü 3 test geçti.
Bu gruplar kısmen örtüşür; tek toplam test sayısı gibi toplanmaz.
Web typecheck 3 GiB heap ile geçti (RSS yaklaşık 2,49 GiB). 2 GiB
denemesi bellek sınırında durdu; 4 GiB tavan aşılmadı. Server typecheck
hâlâ yalnız önceden var olan maintenance-dispatch health sözleşmesi
hatalarında duruyor.

Görsel araç: `node tools/visual.mjs .dev/honor-20261014/visual --honor`.
Altı dil × 350/1280 px × sıralama/komutan/başarı/zayıf hedef/savunma/arşiv
72 durum kontrol edildi: yatay taşma, görünür başlık, Honor-Hakimiyet
2 px ve font ağırlığı farkı. Test düzeninin masaüstü CSS bağlamı düzeltildi,
ekranlar tekrar çekildi. Gerçek React ekranları, API biçimli deterministik
örnekler; canlı oyun oturumu veya üretim verisi ekranı olduğu iddia edilmez.

Tam sistemin kalanları: hedef/gönderim ön açıklaması, ayrıntılı ortak
havuz/kişisel pay dökümü, özel stratejik geçici baskının yaptırım tanımı,
ek ortak anıt/catch-up regresyonları, ödül teslim makbuzu, açık yeni-sezon
açılış komutu. Bu eksikler bitmeden Honor ACTIVE açılmadı ve açılmamalı.

## Oynanabilir yerel sezon — kullanıcı yönlendirmesi

Kullanıcı tüm çalışma klasörü değişiklikleriyle güncel ruleset'te oynamak istedi.
Standart yerel astera DB'si boştu (0 hesap/0 sezon); mevcut başka DB'ler
değiştirilmeden astera-pg:5433 açıldı, 0163'e kadar migration uygulandı.
Yeni EU-1 sezonu `MULTI_WORLD.rulesetVersion=18`, güncel tempo başlangıcı,
8 hareketli anıt ve 8 radyasyon kaynağıyla oluşturuldu. Honor yalnız bu
yeni yerel deneme sezonunda ACTIVE; başlangıçtan önce gerçek saatle
hazırlandı. Üretimde etkinleştirme yok.

LocalKomutan (Core15), LocalRakip (15), LocalKucuk (12), LocalUst (18)
yerel insan test hesapları, çeşitli gemiler, kaynak ve hazır stratejik araçlar
verildi; ana hesapta bakım ekranını denemek için iki yaralı Dart var.
API+worker :3100, mevcut kaynak Vite :5173; bilgisayarı yormamak için
bot döngüsü kapalı. Yeni DB 1 CPU / 512 MiB; Node API heap 1 GiB.
Gerçek web istemcisinin Zod sınırları üzerinden giriş/season/planets/
monuments/Honor/reports/galaxy çağrıları geçti. Gerçek oyun ekranı da
açıldı, tarayıcıda pageerror yok. Yerel özel hazırlık kayıtları/ilk DB
yedeği `.dev/local-play-20261014/` içinde. Bu veri test suite DB'sinden
ayrı; sonraki testlerde oynanabilir veritabanı truncate edilmez.

## Gönderim öncesi karar desteği

Sıradaki iş: mevcut hedef sahibine göre Honor sınıfını ve askerî karşılık bandını,
ilişkili rakip uygunluğunu, aynı çiftte azalan karşılığı ve geçerli karşılık
bütçesi varlığını salt okunur API ile göstermek. Kesin puan/zafer vaat edilmez;
ortak destek katılımı sonucu değiştirebilir. N/T değerleri ve hesap kimlikleri
istemciye verilmez. Legacy/SHADOW kapalı, yabancı sezon hedefi reddedilir,
boş tarihçe uydurulmaz, GET gözlem/puan yazmaz. Test önce RED sonra GREEN.

İncelenecek önemli ortak savaş açısı: oyuncunun seçtiği denk ev sahibine sonradan
küçük destek katılımcısı eklenmesi, saldırgana seçmediği zayıf rakip yaptırımı
çıkarıyor mu? Mevcut kurallar kayıp sahibi bazında katsayı kullandığı için bunun
somut adversarial testi ve karar gerekçesi gerekiyor. Son vuruş atfı yapılmayacak.

Hakimiyet ödül görünürlüğü kullanıcı tarafından yakalandı: Honor açık sezonun
arşiv üst paneli Dominion ödüllerini saklıyordu; ayrıca seçili alt sekmeye ait
puan yerine parent'ın Honor board'una bakmak yanlış hak ediş gösterebilirdi.
Tablo LeaderboardScreen içinde gerçekten seçili Dominion board'una taşındı;
Honor sekmesi kendi hak edişini, Dominion kendi eski programını gösterir.
İki listede büyük paketin bir kez verilme kuralı Dominion'da da açık görünür.
Legacy tablosu aynı yerden bir kez render edilir; iki kopya yok. Görünürlük,
gerçek DOM sırası/puanıyla doğru paket ve sekme dönüşü testleri önce RED.

## Ortak sekme tasarımı düzeltmesi — kullanıcı görsel geri bildirimi

Legacy ui/kit/Segmented plate-sunk/legend üst sınıfları Honor,
geribildirim, kozmetik filtreler ve arşiv profilini eski parlak oluk/uppercase
diline çekiyordu. İki mevcut Segmented ailesinin görünümü ortak ui-v2 yüzeyine
alınacak: Archivo, cümle düzeni, koyu sakin panel, ince çizgi, aktif yüzeyin
net ışığı, 36 px dokunma alanı, klavye odak halkası. Eski siyah kabartmalı plate
ve dekoratif ağır shadow kalkacak. Honor özel önceliği kendi label'ında kalır.
Grup/tablist semantiği, klavye roving, unread dot, panel/id ve flush taşma
sözleşmeleri değişmez. CSS tasarımı yerel TDD istisnasıdır; davranış regression
mevcut testlerden, boyut/uzun etiket kontrolleri gerçek tarayıcıdan yapılır.

İki ortak bileşen de yeni `v2-segmented` görünümünü kullanıyor. Honor, profil,
geri bildirim, gezegen/takas; ayrıca klan, istihbarat, filo, sohbet/bildirim,
kozmetik, bakım ve yönetim sekmeleri kapsandı. Uzun v2 sekme etiketleri dar
ekranda kelime ortasından bölünmez; gerekirse kendi şeridinde yatay kayar.
Klan/Intel/bildirim/base/kalite/Honor/i18n dahil 9 dosya / 194 test geçti.
Dil seçici native select olduğundan bu değişikliğin kapsamında değil.

Görsel harness artık her dil için tarayıcı locale ve kayıtlı dil tercihini
sabitliyor, gerçek çözülen dili ve ekran başlığını ayrıca doğruluyor. Önceki
yalnız dosya adında dil yazan kontrol yeterli değildi. Son tasarımın ekranları
tekrar çekiliyor; fixture ekranları gerçek kullanıcı oturumu değildir.

Gönderim öncesi hedef açıklaması için component testleri 3/3 GREEN; gerçek
gönderim ekranında zayıf hedef uyarısı ve bağlantı hatasının açık gösterimi
testleri önce RED (2 başarısız, nötr hedef zaten geçiyor). API coarse sınıfını
kullanan kart gönderim ekranına bağlandı; Academy/nötr/kendi gezegeni hariç.
Kesin puan/zafer vaat edilmez; ilişkili rakip, azaltılmış askerî karşılık,
aynı rakipte azalan kazanç ve sınırlı karşılık hakkı altı dilde anlatılır.

Test ortamı notu: yalnız disposable `astera-honor-test-20261014` DB'sinde
disk baskısını azaltmak için fsync kapalı. Gerçek oynanabilir DB değiştirilmedi.
Bu testler işlem atomikliğini ölçer; güç kesilmesi dayanıklılığı kanıtı değildir.

Hedef API 10/10 GREEN (kimlik doğrulama, read-only ve geçmiş kaybında hata dahil).
Gönderim/Academy/i18n taraması: 209 geçti, 3 başarısız. Yalnız yeni Honor preview
kodunu Vite test dönüşümünde bellekten çıkaran kontrol çalışması aynı 3 hatayı
tekrarladı (73 geçti): korsan kâr beklentisi ve iki eski radyasyon/ücretsiz bakım
metni beklentisi. Çalışma klasörü ve oynanan kaynaklar geri alınmadı; mevcut
bakım değişiklikleri bu işi yeşile boyamak için değiştirilmedi.

Sıradaki rapor açıklaması: kişisel puan yanında açılabilir ortak havuz, ilk
katılım ağırlığının oranı, kalıcı askerî hasar ve tarafın kalıcı kaybı. Kayıp
hesabı tek taraf havuzundan gelir; son vuruş/kişisel öldürme kredisi eklenmez.
Kesin N/T, rakibin savaş dışındaki varlığı ve hesap kimlikleri açıklanmaz.
Kayıp/hasar tutarları sabit ağırlıklı askerî maliyet değeri olarak tanımlanır;
geçersiz/tarihsel eksik savaşta döküm uydurulmaz. İstemci alanı optional,
eski makbuzlar ve null raporlar çalışmaya devam eder. Önce API/UI RED.

Rapor ortak havuz/döküm GREEN: gerçek 1v1 savaş ve istemci Zod sözleşmesi,
paylaştırılmış ortak katkı, hedef ön açıklaması dahil server 3 dosya / 20 test.
Web Honor rapor/leaderboard/hedef/gönderim/i18n 5 dosya / 116 test geçti.
Son kaynak + test + görsel harness lint grubumuz temiz. Aynı taramada mevcut
queries.ts bakım import type satırlarında üç bağımsız lint hatası devam ediyor.

## Ek hata denetimi — kullanıcı yönlendirmesi

Happy path ve edge case ayrı değerlendirilecek; mevcut testlerin yeşil olması
yeterli kabul edilmez. İlk kod incelemesi açığı: anıt adaptörü gönderimden sonra
oyuna gerçekten yeni katılmış savunmacıyı tarihçe uydurmadan açıkça puansız
işlerken, normal dünya desteği aynı durumda missing-history hatasıyla gerçek
savaşın transaction'ını durdurabilir. Mevcut eski oyuncunun bozuk/eksik geçmişi
hâlâ hata olmalı. Yeni katılım için yalnız gerçek savaş saati ve joinedAt ile
kanıtlanan aynı mevcut dışlama uygulanacak; genel puan formülü değişmez.

Normal destek yeni-katılım hatası RED ile tekrarlandı; düzeltme sonrası geç
destek/gerçek destek/ortak klan saldırısı/anıt: 4 dosya / 10 test GREEN.
Web typecheck temiz. Server typecheck yalnız mevcut maintenance-dispatch
testindeki iki bağımsız hata yüzünden tamamlanamıyor; Honor kaynak hatası yok.
Rapor dökümü de dahil son görsel kontrol 13 durum × 6 dil × 2 genişlik = 156
görünümde geçti; mobil Türkçe döküm elle de incelendi.

### Açık adalet riski: denk ev sahibine düşük tier'lı savunma desteği

Vitest dışında 10 ayrı sayısal senaryo çalıştırıldı (`manual-honor-cases`).
Mutlu akış, karşılıklı kayıp, boş yağma, sivil kayıp, sivri sinek, eşit müttefik,
kargo katılımcısı ve iki karışık destek düzeni ayrı çıktı olarak kaydedildi.
Taraf payları korunuyor ve pasif savunana negatif yok. Ancak PEER ev sahibinin
yanında düşük tier'lı destek kaybı saldırgana WEAK cezası yazıyor.

Bu yalnız sentetik formül örneği değil: `manual-supported-raid.ts` ile güncel
v18'de gerçek sendClanSupport → launchAttack → iki gerçek arrival resolver
çalıştırıldı. Üç komutan, saldırıdan önce henüz varmamış destek, ev sahibinin
299 Dart'lık gerçek transfer görevi rezervi; gönderim ön açıklaması PEER/FULL.
Savaşta saldırgan -6,896124 Honor aldı. Bunun 5,46 Honor'u seçmediği düşük
tier'lı destekçinin 21.840 değerlik kaybına ait zorbalık cezası; kalan negatif
kendi saldırı kaybı hesabı. Pozitif puanı kısıtlama ile zorbalık cezası burada
ayrı ele alınmalı. Oynanabilir kullanıcı DB'si ve üretim değiştirilmedi.

İlk çözüm adayı: seçilmeyen savunma destekçisi WEAK ise ondan pozitif askerî
puan yok; fakat onun gönüllü muharebe katılımından saldırgana zorbalık cezası
yazılmaz. Seçilen zayıf dünya sahibi/başlangıç anıt hedefleri için ceza korunur.
Kendi saldırı kaybı, ortak havuz/pay, ilişkili rakip, çift bütçesi ve tekrar
kuralı korunur. İlk karşılaşma prototipinde denk ev sahibi + zayıf destek için
ham -12,499 → +0,001 Honor; zayıf ev sahibi + üst decoy -12,49875 olarak kalır.
Bu üretim kuralı değişikliği değildir; henüz onaylanmış/entegre çözüm değildir.
Yeni hedef kimliği bilgisi, sıralı tekrar/karşılık ve anıt karışımında ayrıca
denetlenmeli. Genel sistem bu açık kapanmadan adil/hazır ilan edilmez.

Ek hedef/hesap/kapanış kontrolleri: 4 dosya / 27 test geçti. Yeni admin testinin
ilk başarısızlığı testin displayName'i username sanmasıydı; gerçek account
username ile düzeltildi, uygulama davranışı değiştirilmedi. Sonradan gelen
Destek ilişkisi, gerçek çift kullanımı, karşılık bütçesinin tam 24 saat sınırı,
kendi hedefi ve admin dışlaması ayrıca kontrol edildi.

Normal savaş entegrasyonu artık hem ruleset1 hem güncel18'de çalıştırılıyor;
latest fixture açık HOLD duruşunda, gerçek ESCAPE senaryosu ayrı. 9 test geçti,
1 yalnız legacy'de uygulanmayan modern escape testi bilinçli skip. Kaçan filoya
uydurulmuş kalıcı imha/pozitif Honor yazılmadığı gerçek worker ile doğrulandı.

İkinci açıklama açığı: karışık bir savaşta net Honor pozitifse zayıf-hedef
kesintisi tek COMBAT nedeni içinde görünmüyor. Ortak dökümde, taraf havuzunda
gerçekten uygulanmış zayıf-hedef cezası var mı açık bir ek açıklama gösterilecek.
Kesinti tutarı tahmin edilmeyecek, puan formülü değişmeyecek. API ve UI için
pozitif-net + zayıf-victim senaryoları önce RED.

Saat birimi denetiminde kendi yeni testimizde `FixedClock.advance`'in dakika
aldığı yakalandı: 24 saat testine ms sayısı veriliyordu, recall testinde de
1000 dakika ilerlenip pencere aşılmıştı. Gerçek timestamp `set(Date)` ile
düzeltildi. Karşılık hakkı artık tam sınırdan 1 ms önce açık, sınırda kapalı
doğrulanır. Başarısız recall, zaman çizelgesinin yanlış kurulmasıydı;
oyundaki geri çağırma kuralını/testi yeşile boyamak için değiştirmedik.

## Onaylanan savunma desteği düzeltmesi

Kullanıcı "Okey" ile aday kuralı onayladı. Gerçek gönderim niyetine seçilen
savunmacı kimlikleri kaydediliyor (`selectedDefenders`); destek genişletmesi
ilk kimlikleri koruyor, anıtta ilk seçilen bütün sahipleri kapsıyor. Zayıf
gönüllü destekçiden pozitif askerî kazanç yok, onun muharebe kaybı saldırgana
zorbalık cezası da yazmıyor. Seçilen zayıf hedefin cezası, tekrar/karşılık,
saldırganın bütün kalıcı kaybı ve tek ortak taraf havuzu korunur.

Önce üretim kuralı 1 RED, adapter 3 RED; sonra kurallar 6 dosya / 88 GREEN.
Eski delil/commitmentlarda alan optional: tarihsel delilin hash'i değişmez,
önceki makbuzlar geriye dönük değiştirilmez. Yeni alanın dizi sırası hash'te
kanonikleştirildi; farklı hedef muafiyeti aynı kaynakta retry ile geçirilemez.
Hedef kartında related PEER için çelişkili pozitif kazanç cümlesi kaldırıldı;
önce görünür çelişki testi RED. Büyük backend taraması devam ediyor.

İzole destek politikasının prototipi (`.dev/.../prototype-honor-team.ts`) üretim
kurallarına bağlanmadı. Önce missing-module RED; sonra seçilen tüm hedeflerin
eski formülle aynı kalması, zayıf destekten pozitif kazanç olmaması, seçilen zayıf
ev sahibinin üst decoy ile korunamaması, kendi kayıp cezası, savunanın kazanımı,
sivil yağma, anıt hedefleri, tekrar/karşılık, ilişkili rakip ve ortak çift bütçesi
olmak üzere 15 test geçti. 108 T/N karşılaştırması ve 9 tekrar/karşılık birleşimi
aynı kuralı koruyor; bu küçük aritmetik kontrolleri gerçek savaş kalibrasyonu
veya tüm abuse yollarının kanıtı diye sunulmuyor.

Gerçek destek manuel denemesinin iki ayrı varyantı tutuldu: baseline negatif
zorbalık kesintisini yeniden üretiyor, tier-upgrade kontrolünde ev sahibinin
Core12→13 olması destekçiyi mevcut ±1 destek bandının dışına çıkarıp geri
gönderiyor. Bu varyant artık tek-sahip savaşı; düşük destek kaybı yok. Eski
donmuş Honor tier'ı yine4, callback tekrarı aynı tek makbuzu getiriyor. İlk
senaryonun deliliyle karıştırılmadı; ayrı JSON/log dosyaları tutuldu.

Onaylanan üretim düzeltmesi sonrası tüm Honor backend taraması: 21 dosya,
105 geçti / 2 legacy'de bilinçli skip. Ardından yeni WAITING/frozen etkinleştirme
guard ve muaf destek rapor kontrolü eklendi; 2 dosya / 21 GREEN. Gerçek v18
destekli savaşı tekrar oynatan manual-approved denemede aynı delilden eski
politika -7,0091; yeni politika -1,5491 Honor. Tam 5,46 kesinti kaldırıldı,
kendi kalıcı kayıp hesabı korunuyor. Referans tier dondurma ve tek makbuz replay
aynı denemede doğru. Web 6 dosya / 120 GREEN.

Ödül görünürlüğü sıradaki eksik: teslim DB'de tek seferlik ve kaynakları yatırıyor,
ama makbuz sıralama türünü seçmiyor, placement parser alanı siliyor ve güncel
season API oyuncuya okunabilir teslim makbuzu sunmuyor. Yeni optional makbuz
alanı, Honor/Dominion kaynağı ve gerçek yatırılan kaynaklar açık gösterilecek;
"hak ediş" ve "teslim edildi" ayrı kalacak. Test önce RED; tutar/program/single
payout hesabı değişmeyecek. Başkasının makbuzu veya pending kayıt açıklanmayacak.

Ödül makbuzu tamamlandı: gerçek rollover + eşzamanlı join + güncel season API
testi GREEN. Bekleyen hak ediş, başka hesap ve kaynak sezonu makbuzu için null;
eski Dominion teslim/retry davranışı ayrıca korunuyor (2 dosya / 6 GREEN).
UI makbuz + leaderboard 7 GREEN; 6 dil × 2 genişlik × 4 yüzeyde 48 görsel
kontrol geçti. Gerçek yatırılan tutar gösteriliyor, nominal paket değil.

Özel kaynak audit'i: güncel Death Star EMP kalıcı birim/kaynak imha etmiyor,
ancak aktif Aegis'i boşaltıyor, 60 dakika ground ateşini kapatıyor ve koloniden
20 sadakat puanı götürüyor. Silahın normal tüketimini saldırganın savaş kaybı
saymak denk hedefe başarılı EMP'de dahi -21,6 Honor doğurur; bu mevcut kabul
edilmiş formülden otomatik çıkarılamaz. Interceptor gerçek bir DS'yi yok ediyor,
ama normal units tablosu ve Honor Navy referansı stratejik stokları içermiyor.
Bu nedenle adapter'ı körlemesine bağlamadan gerçek ACTIVE/v18 üç senaryo
(denk EMP, zayıf koloni EMP, interception) bağımsız manuel yürütülecek. Yeni
basınç cezası/stratejik kayıp tanımı core PvP kararıdır, owner onayı gerektirir.

Manuel stratejik akış ilk preview'de `Missing Honor reference history` ile durdu:
prepareHonorSeason mevcut katılımcıların başlangıç stokunu kaydetmiyor. Gerçek
gelecek sezon katılımı kayıt üretse de sezon hazırlandıktan sonra Honor açılması
ve mevcut oyunculu SHADOW başlangıcı bu boşluğa düşüyor. Düzeltme sözleşmesi:
yeni konfigürasyon oluşturulduğunda mevcut gerçek oyuncuların şimdiki stokları
sıralı oyuncu kilitleri altında aynı transaction'da bir kez gözlenecek. Retry
yeni snapshot veya geçmiş puan yaratmayacak; etkinleştirme öncesi launch-time
referans uydurulmayacak; normal ACTIVE başlangıç/WAITING/frozen guard'ları
korunacak. Eski eksik tarihçe hatasını sessiz dolduran geniş fallback yok.
Dokunulan yer: prepareHonorSeason + ledger regresyonları; ilk test RED.

Başlangıç snapshot RED → GREEN (4 dosya / 33). Eski referans testlerinin global
tek-row beklentisi artık iki gerçek başlangıç gözlemini de sayıyordu; redundant
gözlem kontrolü mevcut satırlarla eşitlik ve owner kapsamı kullanıyor. Gecikmiş
anıt testinde ilk boş ve wave-eklenmiş stok aynı ms'de ayrı gerçek gözlemler.
Geniş tarama 107 geçti / 2 skip, 2 normal-savaş fixture beklentisi yanlış çıktı:
"zayıf hedef" testi etkinleştirmeden SONRA büyük hedefin Core'unu düşürüp
rezervini siliyordu. Gerçek kaydedilen sezon/24h tepe silinmez; bu durumda
pozitif sonuç kural gereği doğru. O case tepe-koruma regresyonuna dönüştürüldü;
gerçek zayıf hedef initial stock'u etkinleştirme ÖNCESİ hazırlanan ayrı gerçek
raid case'i eklendi. Kural/negatif bekleme gevşetilmedi, iki farklı durum ayrıldı.

Son geniş kontrol: 24 backend dosyası 124 GREEN / 2 legacy-only skip; 12 web
dosyası 140 GREEN. Server ve web typecheck GREEN; bu tur değişen 20 dosyanın
lint'i GREEN. LocalKomutan/v18 gerçek login, API sözleşmeleri ve galaksi
tarayıcı kontrolünde hata yok; yerel oyun açık ve korunuyor.

Ek 6 gerçek normal senaryo Vitest dışında: denk sivil imhası/yağma 0,
zayıf sivil imhası/yağma -4,37045, yalnız kargo saldırı NOT_A_WARSHIP ile
reddedildi (stok korundu), THORN50 kaybından30 ücretsiz yeniden kurulum
çıkarıldı (+10,822094 saldıran / +15,532401 savunan), EMP altında THORN50
aynen kaldı ve Honor0, uçuşta korumaya çarpma hiç savaş/makbuz üretmedi.

Ödül copy audit: “aynı sırada tam paketin iki katı” cümlesi Honor eşitliğinde
yanlış anlaşılır; tied rank1'in paketi 1+2 basamaklarını paylaşır, her kişiye
tek başına4000A vaat edilmez. Temel tarifenin2× olması ile eşitlerin işgal
ettikleri paketleri paylaşması altı dilde açık ayrılacak. Matematik değişmez.
Gerçek tied paket/tam açılış eşiği ile görünür açıklama testi önce RED.

Eşit paket copy RED → GREEN: 2 dosya /8test. Core matematiği aynı. Sıradaki
gerçek normal-savaş edge kontrolleri: gönderimdeki koloninin üçüncü oyuncuya
geçmesi (gerçek savaş devam eder, TARGET_CHANGED Honor0), saldırgana geçmesi
(kendi filosuyla savaş yok), secession ile NPC'ye dönmesi (NPC Honor yok).
transferPlanetControl/secedeColony gerçek servisleri, callback tekrarı ve
rapor journal'ı kontrol edilecek; yerel kullanıcı oyununa dokunulmayacak.

3 gerçek sahiplik savaşı GREEN, kural değişmedi. Archive UI audit'inde Honor0
ile eşit1 olan profile hâlâ "Top5%" başarı cümlesi çıkabiliyor; mevcut medal
guard'ı bunun için de kullanılacak. Pozitif Honor ve eski Dominion başarısı
korunacak; gerçek skor/sıra saklanmayacak. Sıfır kayda sahte başarı/podyum
vurgusu yazılmayacak. Önce görünür davranış testi RED.

Muhasebe audit'i: aynı effective-ms'deki karşılıklı savaşlarda kanonik source
kimliği hangisini önce replay ederse onun zararı diğerine yeni karşılık
bütçesi açabiliyor. "Rakip ÖNCE zarar verdiyse" sözleşmesinde eşzamanlı zarar
önceki provokasyon değildir; rastgele id bir zayıf saldırıyı cezasız seçmemeli.
Yalnız daha eski at'lı grant kullanılacak; gerçekten önceki bütçe aynı ms'ye
gelmiş savaşlarda tüketilebilir kalacak. Mevcut kronolojik replay/hash/çift ve
tekrar kuralı değişmez. Etkilenen yer: advanceHonor grant uygunluk/tüketim;
iki source-order varyantı aynı sonucu isteyen test önce RED.

Eşzamanlı karşılık RED → GREEN, 3 dosya29kontrol; gerçekten eski grant
tüketiliyor, aynı zamanda yeni grant dokunulmadan kalıyor. Zero-Honor arşiv
başarı cümlesi RED → GREEN, 3dosya29test; pozitif/legacy başarı korunuyor.
Ek 12görselde6dil eşit-ödül yardım metni açılarak taşma/çeviri kontrolü geçti.

İkinci eşzamanlı açık ayrı manuel aritmetikte doğrulandı: aynı ms'de iki zıt
eşdeğer100hamHonor savaş, kanonik id sırasına göre A66,666666/D33,333334
veya tersi veriyor. Zayıf hedefte aynı ms'de1000+10000 gerçek zarar da toplam
-4 veya -2,875 oluyor. Bunlar tarihi gerçekten yaşanmış savaş iddiası değil,
aynı kanıtın yalnız source-id değişen karşılaştırması. Hazır sayılmayı engeller.

İzole aday: aynı effective-ms içindeki yalnız muhasebe işlemleri bir grup;
her savaşın kendi verimliliği/ortak taraf havuzu korunur. Aynı çiftin pozitif
artan karşılığı bütün grup için bir kez, ham havuz oranında paylaşılır. Aynı
yönlü zayıf zararlar işgal ettikleri tekrar basamaklarının ortalama katsayısını
kullanır (iki ilk eşzamanlı olay:1 ve1,5→1,25). Toplam eski karşılık bütçesi
gerçek harm oranında paylaşılır, yeni aynı-ms provokasyon kullanılmaz. Boş ve
ineligible olay katsayı basamağı doldurmaz; grubun gerçek harmful sayısı daha
sonraki olaya kalır. Ayrı zamanlı davranış birebir aynı kalmalıdır. Aday
yalnız `.dev` prototipi; üretim muhasebesine bağlı değil, owner kararına sunulur.

Grup prototipinin ilk6kontrolü geçti, eski karşılık paylaşımı1mikro kısa
yuvarlandı (beklenen -3,125000, çıkan -3,124999). Beklenti gevşetilmedi;
ortak ceza yönlü çift için bir kez yuvarlanıp remainder paylaştırıldı.
Son10kontrol GREEN: ayrı zamanlarda birebir eski davranış, iki eşdeğer
karşılıklı havuz50/50, üç havuz gerçek2:1oranıyla80/40, kayıt-id değişmezliği,
1,25 zayıf batch katsayısı ve sonraki gerçek tekrar, boş/ineligible, eski
karşılık bütçesinin tek ortak tüketimi, takım havuzu payları, tam negatif
kayıp kesintisi, source-kapsamı ve yanlış kimlik reddi. Henüz DB adapter'ı
değişmedi; deployment hazır değildir. Aday kararı yeni tekrar basamağı
paylaşımı içerdiğinden core PvP kararına sunulur.

Son backend taraması:25dosya129GREEN/2legacy-onlyskip. Profil edge visual24
capture6dilde350/1280 geçti; Honor0 sahte percentile/medal vurgusu yok.
Görselde ayrıca özel ArchiveChoice sezon strip'inin shared segmented ailesi
dışında eski legend/uppercase tasarımı kaldığı görüldü; aynı v2 frame/option
tokenları ile stil düzeltildi. Mevcut onScroll pagination ve seçme davranışı
korundu; iç içe farklı scroller eklenmedi. Tekrar24capture GREEN.

### Açılıştan önce uçuşa çıkan saldırılar: yeni regresyon incelemesi

SHADOW açıldığında zaten uçuşta olan raid/joint/anıt saldırısında launch
commitment yok; varış adapter'ı bunu veri bozulması sanıp gerçek savaşı
rollback edebilir. RED gerçek servis savaşlarıyla doğrulanacak. Beklenti:
bu eski saldırılar normal sonuçlanır, sonradan uydurulmuş Honor üretmez;
açılıştan sonraki gerçekten eksik commitment ise hâlâ hata verir.
Aynı milisaniyedeki önce/sonra ayrımını yalnız saatle yapamayız. Aktivasyon
season exclusive lock altında o anda gerçekten uçuşta olan source anahtarlarını
bir kez dondurmalı; tekrar aktivasyon yeni saldırıları muaf yapmamalı.
Kontroller: eski normal/joint/native anıt, timestamp eşitliği, yeni geçerli
saldırı, yeni commitment silinmesi, sahte source, rollback/retry ve activation
ile launch yarışması. Değişim scoring formülüne/Dominion'a dokunmaz.

RED doğrulandı:2normal (0/1ms),1joint ve1native anıt gerçek savaşta
missing commitment ile rollback oldu. Düzeltme:season FOR UPDATE açılış
barajı + o andaki gerçek uçuşların source anahtarları `legacy_sources`;
normal/joint/anıt adapter'larında yalnız bu açık listedeki eski uçuşlar
Honor dışı kalır. Yeni saldırının eksik commitment'ı hâlâ hatadır. Liste
tekrarda genişlemez, transaction rollback ile geri alınır. Aynı timestamp'in
iki tarafını DB sırası belirler; saat karşılaştırmasından muafiyet uydurulmaz.
0164 migration eski SHADOW konfigürasyonlar için yalnız açıkça daha eski,
commitment'sız ve hâlâ pending uçuşları onarır; eşit saat geçmişe dönük
kanıtlanamadığından kendiliğinden muaf sayılmaz. Aktif konfigürasyonlar
backfill ile değiştirilmez. Yerel oynanabilir DB sıfırlanmadan migrate edildi.

İlk düzeltme5dosya30GREEN. Ek concurrency/native-joint doğrulaması10GREEN
(39test filtre nedeniyle çalışmadı):gerçek season SHARE kilidi altında
açılış timeout ile bekler; açılıştan önce/sonra aynı-ms doğru ayrılır;
aynı ortak anıt operasyonunun iki dalgası tek source sayılır ve battle1kez
sonuçlanır. Bir testte ikinci aynı-target raid denendi ve oyun doğru olarak
FLEET_ALREADY_COMMITTED dedi; fixture gerçek ters yöndeki karşı saldırıya
düzeltildi, oyun kuralı gevşetilmedi.

### Devam eden canlı sezona deploy sorusu

Kod deploy'u, SHADOW ölçümünü açmak ve ACTIVE sıralama/ödülü açmak ayrı
işlemlerdir. Mevcut live sezon SHADOW olabilir; ana sıralama, rapor, kürsü,
arşiv ve ödül ACTIVE filtresindedir. Açılıştan önceki uçuşlar sonucunu alır
ama Honor almaz. Önceki sezon savaşlarına eksik T/N/ilişki geçmişiyle Honor
uydurulmaz. Mevcut sezon ortasında ACTIVE engeli sürer; yeni sezon başında
ilan edilmiş yeni immutable katalog ile ACTIVE hazırlanır. SHADOW→ACTIVE
yerinde dönüşüm yapılmaz. Henüz canlı deploy/aktivasyon yapılmadı. Stratejik
silah ve eşzamanlı ortak muhasebe adayları tamamlanmadan final release hazır
ilan edilmeyecek; operasyonel açılış komutu da ayrıca hazırlanmalıdır.

Canlı sezon geçişi için4dosya23GREEN:gerçek açılış-sonrası SHADOW savaşı
ölçülüyor ama hedef rehberi/kürsü/rapor puanı görünmüyor; mevcut sezon
ortasında ACTIVE reddediliyor. Leaderboard SHADOW sayıları yayımlamıyor;
SHADOW arşiv/ödül üretmiyor, mevcut Dominion ödül sözleşmesi korunuyor.
0164'ün gerçek SQL backfill'i eski uçuşu onarıyor, yeni bozuk commitment'ı
muaf yapmıyor. Server typecheck GREEN.

Geçiş düzeltmesi sonrası bütün Honor backend + mevcut sezon ödülleri +
anıt adlandırma + ortak anıt regresyonu:27dosya182GREEN/2legacy-onlyskip.
Typecheck ve değişen9dosyanın lint'i GREEN; git diff --check temiz.
Tüm repository kontrolleri diye sunulmaz:paylaşılan workspace'te Honor
dışında yüzlerce bekleyen değişiklik vardır. Bu tur mevcut Hakimiyet
formülü ve canlı veri değiştirilmedi.

Migration sonrası gerçek yerel oyun smoke GREEN:LocalKomutan,v18,Honor
ranking,4komutan,Core15,23hull,17research,30galaxyworlds; browser errors[].
Yerel sezon sıfırlanmadı ve kullanıcı oynamaya devam edebilir.

### SHADOW açılış aracı — gerekli davranış ve test kapsamı

Operatör belirli bir season UUID için `season honor-shadow --season ID`
çalıştırabilmeli; varsayılan yalnız read-only dry-run. `--yes` gerçek
SHADOW hazırlığını aynı season lock altında yapar. ACTIVE'e dönüşüm yok.
Eksik/yanlış ID, kapanmış/henüz başlamamış/bitiş anına ulaşmış sezon,
Silent Space, ACTIVE konfigürasyon ve desteklenmeyen sürüm reddedilir.
Tekrar ve yarışan açılışlar ilk zamanı/kataloğu/eski uçuş listesini korur.
Dry-run observation/commitment/journal/toplam/sezon/oyuncu kaydı yazmaz;
birkaç operatör eşzamanlı çalıştırsa tek açılış olur. CLI hata kodu ve
no-write kontrolü gerçek alt süreçle test edilecek. Sadece disposable test
DB'de apply; yerel kullanıcı sezonu ve canlı config değiştirilmez.

SHADOW servis RED(missing module)→13GREEN; gerçek CLI RED→7GREEN.
Kapanış fixture'ında closedAt/endReason DB çifti zorunlu olduğu için test
gerçek eşleşen SCHEDULED_END ile düzeltildi. Invalid argv test tablosu da
her argüman dizisini tek test girdisi taşıyacak şekilde düzeltildi. Bu iki
fixture düzeltmesi üretim kuralını gevşetmedi. CLI varsayılan salt-okuma,
yalnız --yes açık yazım; source sayıları ve sezon kimliği raporlanır.

### Taktik EMP adayını saf kural olarak somutlaştırma

Adayın saf hesabı normal kurallar workspace'ine alınacak; henüz stratejik
settlement writer'ına veya mevcut ACTIVE/SHADOW kataloglarına bağlanmayacak.
Bu, gerçek adapter öncesi kontrol edilebilir uygulama adımıdır. Mevcut
sezonlara fiyat/versiyon/puan değişimi uygulanmaz. Vakalar:denk/üst/yarım
bant, küçük ground token, gerçek kalkan/sadakat, mevcut blackout uzatma,
ilişkili/bot/dışlanan, kısmi/tam karşılık, tekrar katsayıları, mikrolar,
band sınırları ve geçersiz delil. Basınç toplamı ve tüketilen karşılık ayrı
alanlarda taşınacak; net basınç toplam basınçmış gibi kaydedilmeyecek.

Saf kural RED→32yeniGREEN; kurallar Honor toplam7dosya120GREEN. Yeni gerçek
CORE_OUTAGE koloni denemesinde beklenmeyen ayrım bulundu:mevcut DS impact
`shieldDestroyed` alanına karanlık kubbenin depolanmış506HP'sini de yazıyor
ve gerçekten stored charge'ı sıfırlıyor. İlk manuel beklenti aktif kalkan0
ile legacy rapor alanını aynı sandı,506!=0 ile durdu. Fiziksel oyun kuralını
değiştirmek yerine Honor girdisi gerçek Core arızası snapshot'ından filtrelenir;
dark stored charge yeni aktif kalkan başarısı sayılmaz. Ground da CORE_OUTAGE
altında yeni taktik imha/karartma kredisi üretmez. Gerçek sadakat düşüşü ayrı
kalır. Adapter, raporun shieldDestroyed alanını körlemesine kopyalayamaz.

Gerçek v18 sekiz impact ile saf kural doğrulandı:denk+3,921568,üst+4,878048,
koloni+7,692307,iki DS stoklu yarım-band ilk+1,980198/ikinci0,Core-outage
koloni yalnız sadakat+3,921568,zayıf ilk−8/gerçek blackout uzatan ikinci
−0,07365. THORN50her olayda hayatta; actualHonorRecords her olayda0.

### Eşzamanlı hesap: yalnız aday SHADOW sürümünde DB doğrulaması

Katsayı paylaşımı adayının gerçek DB commit/retry/seal testini yapabilmek için
ayrı aday Honor sürümü2 kullanılacak. Varsayılan ve mevcut katalog sürümü1
korunur; aday2 ACTIVE açılışı reddedilir ve operatör komutu otomatik2'ye
geçmez. Eski1olayları yeni grup hesabıyla replay edilmez. Yeni2SHADOW'da
aynı-at kayıt-id yönünden bağımsız yeniden kurulum yapılır. Test kapsamı:
önce büyük/küçük source-id, reversed insert, gerçek paralel teslim, exact
retry, conflicting retry rollback, geç gelen gruba bağlı sonraki olayın
rebuild'i ve kapanış öncesi queued flush; eski1sonuçlarının korunması.
Bu uygulama adımı ana Honor/ödül aday kararının onaylandığı anlamına gelmez.

Yeni DB aday testi RED9/10→GREEN10/10; sürüm1koruma testi RED'de zatenGREEN
oldu. Activation ile3dosya34GREEN. Gerçek karşılıklı v18 raid2GREEN:her iki
callback sırası, gerçek kalıcı kayıplar, tek ortak çift cap'i, tarafların gerçek
ham karşılıklarına oranı (en çok2mikro toz) ve Dominion zero-sum korundu.
Sürüm karışması için yeni2RED→2GREEN; commitment testleriyle17GREEN.

Ek gerçek vaka:launch anında askerî N=0 olan savunmacının zaten devam eden
gemi üretimi varıştan önce bitebilir. Gerçek savunma zarar verse bile mevcut
gainFactor(ownN=0)=0 kuralı başarısını sıfırlayabilir. Gerçek buildUnits→
onBuildComplete→raid varış yoluyla eski1baseline ve aday2 davranışı test
edilecek. Basit aday düzeltme:yalnız savunmada launch-N=0 ise karşılaştırma
için gerçek başlangıç aktif katılım ağırlığı kullanılır. Saldıranın N'si,
geçmiş tepe kayıtları, pozitif imha/verimlilik koşulu değişmez; katılım0
ve sivil-only savunma bundan puan alamaz. Bu da yalnız aday2için geçerlidir.

Gerçek reaktif savunma vakası doğrulandı:mevcut1doğru baseline0puan,
aday2beklenen pozitif için RED oldu. İlk fixture'ında gerçek hangar kapasitesi
40DART üretimine yetmedi; HANGAR10ile geçerli üretim ortamı kuruldu.
Saf team kuralları3RED→3GREEN; yalnız candidate2savunmada sıfır navy
karşılaştırmasına actual active contribution floor bağlandı. Saldıran
karşılaştırması ve nonzero reference aynı. İlişkili/sivil/ineligible ve yeni
aşırı güçlü savunma istismarı kontrolleri GREEN. Honor rules123GREEN.

Reaktif üretim sonrası gerçek raid GREEN her iki sürümde:1eski0davranışını,
2başarılı savunma hak edişini koruyor; history navy yine0, backdate yok.
Eşzamanlı DB/real raid ile16GREEN. Prototip11ve yeni2defteri11aynı adversarial
vektörde22GREEN; 20çift40olayda source-id permütasyonu ve cap korunumu dahil.

### Aday2 stratejik stok ve fiyat geçmişi

Hazır/uçuşta DS ve interceptor'un N'ye katılması yalnız aday2'ye bağlanacak.
Yeni nullable donmuş strategic_catalogue alanı;1NULLolarak eski hesabı tutar.
2kataloğu yoksa geçmiş fiyat uydurulmaz, hata verilir. READY dünya sahibine,
LAUNCHED gerçek görev sahibine bir kez sayılır; BUILDING/PAUSED/CONSUMED0.
Üretim bitişi/fire/interception/impact ve kontrol değişimi gerçek gözlem
zamanını kullanır. Testler:eski1koruma, iki fiyatın freeze'i, tamamlanma,
uçuş hareketinde çift saymama, ele geçirilen launch dünyası/ready stok,
harcanmış stok, eksik katalog ve24hpeak. Aday2 halen SHADOW-only.

Stratejik referans gerçek DB testleri7GREEN. Mevcut interception,
death-star-loyalty ve death-star-burst84testi yeni stok gözlem hook'larıyla
GREEN. Son Honor rules7dosya125GREEN; server typecheck GREEN. Stratejik
puan settlement adaptörleri henüz tamamlanmadı; referans testleri gerçek
EMP Honor yazıldığı anlamına gelmez.

### Aktif sezon geçmişinin yeniden değerlendirilmesi

Owner'ın geçmiş savaşları hesaplayarak bu sezonda açılış sorusu üzerine
canlı şema/kapsam yalnız READ ONLY transaction'larla tekrar incelendi.
12Ekim yerel kesitiyle14Ekim canlı sayıları ayrıldı. Klan/yardım/Core
kayıtlarının bir kısmı kurtarma için kullanılabilir; tam geçmiş yok demek
bu kaynakları görmezden gelmemeli. Ancak5Hakimiyet olayının raporu yok
(4kayıplı,5yağmalı);65radyasyon bildirimi hull dağılımı yerine adet tutuyor.
Toplam sahip olunan askerî tepe geçmişinin eksiksiz kurtarılması kanıtlanmadı.
Kesin tarihsel puan/ödül sıralaması üretilmedi. Ölçümler, sınırlar ve
sezon ortası ilan edilmiş başlangıç seçeneği:
[aktif sezon fizibilitesi](honor-active-season-feasibility-2026-10-14.md).
Üretime deploy, migration veya Honor açılışı yapılmadı.

### 15 Ekim: kapalı gözlemden ilan edilmiş görünür açılış

Owner'ın yeni talebi kapsamında `honor-open` CLI/servisi eklendi. Sezon kilidi
altında görünür yarış sıfır puan ve boş çift/tekrar/karşılık bütçeleriyle başlar;
askerî gözlemler ve kataloglar korunur. Kapalı olaylar yeni `ranked` alanıyla
denetim için kalır ve rapor/replay/ödüle karışmaz. Açılış öncesi commitment
kimlikleri ve pending uçuşlar dondurulur; retry yeni uçuşu istisnaya çevirmez.
`ranked_at` gözlem başlangıcından ayrılır, leaderboard'a açılış tarihi ve uçuş
kuralı altı dilde eklenir. Aday2/silah işi kabul edilmeden ACTIVE'e geçemez.

TDD ve gerçek motor doğrulaması:35server dosyası354GREEN/2legacy-only skip;
4web dosyası129GREEN;12açılış görseli. Operasyon ve kapsam:
[15 Ekim açılış kaydı](honor-ranked-opening-2026-10-15.md).
Yerel migration0167 ve eski0152indeks/journal boşluğu onarıldı, oynanabilir
sezon ve4komutan korunarak API yeniden çalıştırıldı. Canlı işlem yapılmadı.
Son inceleme kapanışın ranked başlangıcından önce seal edilmesini RED→GREEN
ile engelledi (7dosya61GREEN). Eski writer'ın yanlış default phase işareti
de RED→GREEN ile korundu (3dosya41GREEN). Güncel server typecheck GREEN;
web typecheck ayrı radyasyon seviye3/1|2 sözleşmesi nedeniyle kırmızı.
Honor kapsamının lint'i ve yerel browser smoke GREEN (pageerror0).
