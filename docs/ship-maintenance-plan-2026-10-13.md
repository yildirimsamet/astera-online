# Gemi hasarı, manuel bakım ve parçalama — 13 Ekim 2026

Durum: Manuel bakım ön aşaması uygulandı; ayrıntılı inceleme, bulunan hataların düzeltme tekrarları, tip/lint ve mobil/masaüstü görsel doğrulama tamamlandı. Radyasyon Bombası, gezegen/dock doz hasarı ve radyasyon başlangıcında REPAIR iptal/tam iade ikinci aşamadır.
Çalışma `master` üzerinde; yeni branch/worktree yok. Çalışma ağacındaki diğer işler korunur.
Radyasyon devam planı: [radiation-bomb-plan-2026-10-13.md](radiation-bomb-plan-2026-10-13.md).

## Uygulama ilerlemesi

- Test-first başladı: yeni saf bakım kuralları ve savaş katılımı testlerinin kırmızı olduğu doğrulandı; uygulamadan sonra geçti. Sağlıklı savaşların parity digest'i korundu.
- `units.damage` home metadata; `0157_manual_ship_health` ve hafif dock yarası için `0158_manual_dock_wounds` additive migration. Eski stok/işler otomatik taşınmaz.
- Dönüş/iniş ve planet savunma sonucunda otomatik dock ve ücretsiz tamir kaldırıldı. Kesirli yara korunuyor.
- Manuel dock/geri alma/parçalama servisi; kısmi adet, ilk istekle aynı retry sonucu, eşzamanlı tüketim ve sahiplik kontrolleri testlendi.
- Ücretli REPAIR için kısmi lot seçimi/split ve busy gemiyi parçalamayı reddetme testlendi.
- Normal saldırı/transfer, klan destek/war, anıt, ticaret, korsan ve galaksilerarası konvoy çıkışlarında yara taşınması için yeni regresyonlar eklendi ve geçti.
- Bakım HTTP route'u ve gerçek istemci Zod şemasında 0bp + kesirli yara round-trip testi geçti.
- Testler mevcut geliştirme verisini silmemek için bu işe ait `astera-maintenance-review-pg` içinde ayrı `astera_maintenance_test` veritabanında, localhost:55434'te çalıştırılıyor. Geçici alan dolduğu için bu konteyner disk üzerinde yeniden kuruldu. Geliştirme/canlı DB migration çalıştırılmadı. Check'ler sırayla, nice 10 ve tek Vitest worker ile.
- Filo/tamirhane UI, altı locale/Wiki, uçuşların başlangıç yarası, support settlement, anıt katılımı ve aid/secession yolları uygulandı. Tam normal kurallar/sunucu/arayüz taramaları tamamlandı; eski beklentiler ve bulunan sorunlar düzeltildikten sonra ilgili dosyaların tekrarları geçti. Tip/lint ve altı dilde 60 görsel durum doğrulandı. Sayılar ve sınırlar [inceleme notunda](ship-maintenance-review-2026-10-14.md) kayıtlıdır; sunucu/arayüz için tek tam çalıştırmada tüm dosyalar yeşil iddiası verilmez.
- Yeni gezegen radyasyon settlement'i ve bombalar henüz uygulanmadı. Radyasyon–REPAIR iptal/iade timeline'ı ikinci aşamanın kapsamıdır; eski pause/resume davranışı kurulmayacak.

## Owner kararları

- Gemiler hasar nedeniyle otomatik olarak tamirhaneye aktarılmaz. İniş ve gezegendeki savunma savaşı sonucu da buna dahildir.
- Ücretsiz tamir tamamen kaldırılır; %20 ve altı hasar da korunur. Sadece ücretli onarım gemiyi iyileştirir.
- Filo sayfasında hasarlı gemiler düzgün gruplandırılır. Owner bir gruptan istediği adedi tamirhaneye manuel aktarabilir.
- Savaş başlangıcında canı %5 üzerinde olan gemi normal davranır. Canı %5 veya altındaysa savaşa başlayamaz. Savaş içinde bu sınırın altına düşmek çıkış yaratmaz; gemi ölebilir. Önceki %50 kararı bu kararla değiştirildi.
- Başlangıçta %5 veya altındaki gemiler savaş görevlerine katılamaz; transfer/tahliye serbesttir (owner yanıtı).
- %5 veya altındaki hangar gemileri düşman baskınında tamamen savaş dışıdır: ateş etmez, vurulmaz, battle loss/kill/Hakimiyet girdisine girmez (owner yanıtı).
- Tamirhanede parçalama vardır. %100 canlı gemi de parçalanabilir.
- Parçalama getirisi: üretim kaynak maliyeti × kalan can oranı × 0,5.
- Parçalama anında sonuçlanır; radyasyon sırasında kapalıdır (owner yanıtı).
- Anıtta canı %5 veya altına düşen gemi kalır, üretime devam eder, saldırıda hasar vermez fakat saldırıda hasar alıp ölebilir. Eve manuel çağrılır; radyasyon sürer, çağrılmazsa radyasyondan da ölebilir (owner yanıtları).
- Radyasyonda hangar ve tamirhanede bekleyen gemiler hasar alır; tamirhane radyasyon sığınağı değildir.
- SON KARAR: Radyasyon başladığında çalışan ve sırada bekleyen bütün ücretli REPAIR işleri otomatik iptal edilir; ödenmiş onarım kaynakları tam iade edilir, iş ilerlemesi silinir. Gemiler mevcut yaralarıyla tamirhanede bekler; oyuncu onları hangara çıkarıp tahliye edebilir.
- Radyasyon bitince eski işler otomatik devam etmez. Oyuncu güncel can üzerinden yeni fiyat/süreyle yeniden onarım başlatır. Önceki duraklatma/aynı bedelle devam etme kararları bu kararla kaldırıldı.
- Owner onayıyla tamirhanedeki gemiler düşman baskınından korunur, radyasyondan korunmaz. Her pozitif yaralı gemi manuel aktarılabilir; hafif yaralı gemiyi baskından önce çekebilmek bilinçli oyun davranışıdır.
- Gezegende radyasyon varsa yeni dock aktarımı/onarım/parçalama kapalı; dışarı çıkarma ve uygun transfer/tahliye açık kalır. Bomba stoğu gezegen başına her seviyeden bir adettir.

## Mevcut kodda değişmesi gereken varsayımlar

| Kod | Şu an | Planlanan değişiklik |
| --- | --- | --- |
| `rules/damage.ts`, `hpDamage.ts` | %20 altı ücretsiz yama; üstü dock | Otomatik karar kaldırılır; bütün yaşayan gemiler yaralarıyla iner |
| `services/shipDamage.ts` | İniş/defender sonucunda dock veya autoRepaired | Hasarlı home grubunu koruyan iniş; dock yalnız açık manuel işlemle |
| `db/schema.ts` / `ship_damage_lots` | Dock hasarı >%20 şartı; ship count `units` ile | Hafif hasar dahil dock; home hasarı için ayrı kalıcı metadata |
| `planet.ts` / `planetView.ts` | Home gemisi yalnız hull ve adet | Adet + hasar grupları + savaşa uygun adet; aggregate filo korunur |
| `rules/combat.ts` | Planet host stack yaralı olamaz; tek savunan shortcut yarasız | Home yarasıyla savaş; sağlıklı savaşların sonucunu koruyan ortak çözüm |
| `escape.ts` / raid handlers | Savunan line home toplamından kuruluyor | Uygun gemiler ve gerçek yaraları; dışarıda kalan gemiler ayrı korunur |
| `mission.ts` / diğer görevler | Home'dan yalnız adet çıkarılıyor | Seçilen adetlerin gerçek yaraları da görev/wave snapshot'ına aktarılır |
| `repair.ts` / repairStation UI | Lot'un tamamı seçilir; adet seçimi yok | Kısmi aktarım/onarım ve exact seçime göre fiyat/süre |
| `FleetPage.tsx` / `FleetHost.tsx` | Home hull chip'leri; dock yalnız toplam sayı | Gezegene ve hull'a göre sağlık grupları, adet seçimi ve durum açıklaması |
| `pirateProfit.ts` / launch tahminleri | Küçük yaraları ücretsiz, yalnız dock hasarını masraf sayıyor | Bütün kalıcı yaralar hesaba girer; tahmini onarım oyuncunun seçimi olarak etiketlenir |
| Klan desteği/anıt/ortak savaş | Hasar var fakat %5 uygunluk kuralı yok | Başlangıç yarası, eligibility ve savaş dışı kalanı kayıpsız ayırma |
| Reports/notices/wiki/locales/bots | Otomatik aktarım ve ücretsiz tamir anlatılıyor | Yeni davranış; istemsiz bot bakım/parçalama kararı eklenmez |

Kesin teknik bulgu: `assertDefendingLine`, gezegen sahibinin yaralı stack'ini reddediyor. Bu kontrolü kaldırmak tek başına yetmez;
`resolveBattle`'ın tek savunan yolu, raid/escape girdisi ve savaş sonrası yazıcıları birlikte doğru yarayı taşımalıdır.

## Gemi sağlık kaydı ve konumu

Gemi konumu ile sağlık farklıdır. %40 canlı gemi hangarda durabilir; tamirhanede durması otomatik bir sonuç değildir.

| Konum/sağlık | Ne yapabilir? |
| --- | --- |
| Hangar, %100 | Normal görevler; manuel parçalama |
| Hangar, %5 üstü–%100 altı | Gerçek kalan HP ile savaş; transfer; manuel bakım/parçalama |
| Hangar, %0 üstü–%5 dahil | Savaş dışı; transfer/tahliye; manuel bakım/parçalama |
| Tamirhanede bekliyor | Savaş/görev yok; ücretli onarım başlatma, parçalama veya hangara geri alma önerisi |
| Onarım sırasında/sırada | İlgili iş gemileri ayırır; ikinci işe, göreve veya parçalamaya eşzamanlı konu olamaz |
| Uçuşta/destekte/anıtta | Konuma ait gerçek yara taşınır; kendi gezegenindeki hangar listesi gibi parçalanamaz |
| Canı sıfır | Gemi yoktur; onarılamaz, parçalanamaz |

Önerilen veri yaklaşımı:

- `units` yaşayan gemi adedinin tek otoritesi kalır. Home toplamını ikinci bağımsız envanterle çoğaltmayız.
- Home yaraları mevcut `units` home satırında JSON metadata olarak tutulur; ayrı envanter/tablo eklenmez. Hull/`damageBp`/`remainderBp` birleşimi stable seçim kimliğidir; adet explicit seçilir ve sunucu tekrar doğrular. Yaralı sayısı home sayısını aşamaz. Bu tercih sahiplik devri ve temizlikte ayrı metadata FK taşımayı gerektirmez.
- %100 gemiler mevcut aggregate home adetlerinden yaralı miktar çıkarılarak bulunabilir; sağlıklılar için tek tek gemi satırı gerekmez.
- Aynı hull ve aynı gerçek yara birleştirilebilir. Farklı yaraları ortalamak yasaktır.
- Kısmi aktarım: kaynak grubun yalnız seçilen adedi azalır; yeni dock grubuna aynı yara taşınır. Kalan gemilerin canı değişmez.
- Dock'taki mevcut kayıtlar ve aktif ücretli işler korunur. Geçiş sırasında gemiler kendiliğinden tamir edilmez veya hangara taşınmaz.
- Mevcut dock DB kısıtı artık %20 altı yarayı da kabul eder. `damageBp=0` ama pozitif kesirli yara gibi çok küçük hasarlar kaybolmaz.
- Eski ücretsiz onarımda zaten silinmiş yaralar geriye dönük uydurulamaz; yalnız kayıtlarda mevcut yaralar taşınır.
- İstemci gruplayabilir; sunucu exact yara üzerinden karar verir. Sonradan yuvarlanan %5 etiketi savaş hakkı yaratmaz.

## Manuel aktarım ve ücretli onarım akışı

1. Filo sayfasında gezegen ve gemi türü seçilir; hasar grubunun canı ve adedi görünür.
2. Mevcut oyun standardındaki `− / tam adet / + / Tümü` ile taşınacak miktar seçilir. Varsayılan bütün yeni gelen gemileri sessizce seçmek yoktur.
3. “Tamirhaneye aktar” yalnız konumu değiştirir; kaynak harcamaz, kendiliğinden ücretli onarım başlatmaz.
4. Tamirhanede bekleyen gemiler için seçilen adet, kaynak bedeli ve iş süresi gösterilir; oyuncu onarım başlatır.
5. Ücretli onarım bitince seçilen yaşayan gemiler %100 canlı olarak hangara döner. Başka yaralı gruplar iyileşmez. Radyasyon başlayan dünyada eski iş iptal edilmiş olacağından, ek yaranın eski fatura/süreyle onarılması olmaz.

İki işlem anlam olarak ayrı kalır. Tek ekranda açık maliyet/süreyle “Aktar ve onar” kısayolu eklenmesi uygulanabilir;
varsa taşınma ve ücretli iş aynı transaction'da gerçekleşir, iş reddedilirse aktarım da geri alınır.
Başlangıç tercihi: mevcut ücretli maliyet/süre formülü, Industrial etkisi ve üç derinlikli REPAIR kuyruğu korunur.
Parçalı onarımda yalnız seçilen adet ve gerçek hasar fiyatlanır; eski lot'un toplam faturasını orantılayıp yanlış yuvarlamayız.
Normal koşullardaki manuel iş iptali mevcut iade kuralını korur; radyasyon başlangıcında sistemin iptal ettiği REPAIR işinde tam iade vardır. İptal gemiyi iyileştirmez. Öneri geminin tamirhanede beklemesi,
isterse oyuncunun ayrı “Hangara geri al” işlemiyle yaralı şekilde dönmesidir. İş sürerken önce iptal gerekir.

## %5 savaş uygunluğu

Kural eksik can miktarından değil kalan can oranından hesaplanır. Tam %5 savaşamaz; %5,01 savaşabilir.
`damageBp=9500,remainderBp=0` uygun değildir; `damageBp=9499,remainderBp=0` uygundur. `9499` üzerindeki kesirli yara da gerçek can oranıyla değerlendirilir. Karar gösterim yuvarlamasından önce verilir.

- Uygunluk görev seçiminde, commit sırasında ve çatışmanın gerçek başlangıcında ortak kuralla kontrol edilir.
- Görevle ayrılan gemilerin mevcut yaraları mission/wave'e taşınır. Daha sonra hasar almaları varışta eligibility'yi değiştirebilir.
- Bir saldırı grubunda uygunsuz gemi seçildiğinde sunucu sessizce kırpmak yerine açık hata döner; UI gönderilebilir adedi gösterir.
- Çatışma başlamadan son kez doz işlenir; savaş başladıktan sonra kural round başına uygulanmaz.
- Karışık hull grubu örneği: aynı türden %90×4, %60×3, %4×3. Home toplam 10; savaş başlangıç filosu 7 ve onun yaralarıdır.
- Dışarıda kalan %4×3 sonuç yazılırken aynen korunur. `survivors[hull]` toplamı bütün home filosunu overwrite edemez.
- Baskında savaş dışı gemi, ateş gücü, karşılanan HP, casualty, enkaz veya Hakimiyet hesabına dahil edilmez.
- Hangarda yer kaplaması ve sahip olunan gemi sayımı devam eder. İstemci toplamı “savunma gücü” olarak sunamaz.
- Yaralı geminin %5 üstünde olması ona azaltılmış saldırı gücü gibi yeni kural eklemez; mevcut normal savaş davranışı ve gerçek kalan HP geçerlidir.
- Bekleyen/onarım altındaki dock gemileri, %100'e yakın olsalar bile savaş filosuna katılmaz; konum uygunluğu da gerekir.
- Transfer/tahliye %5 veya altında serbesttir ve yarayı taşır. Diğer sivil görevlerin uygunluğu görev amacına göre uygulanır; onarılmamış geminin bir sivil görev üzerinden savaşa girmesi engellenir.
- Gezegen sahibi, klan desteği ve ortak saldırı dalgaları için aynı gemi bir kere sayılır. Harici oyuncunun gemisi ev sahibinin dock'una aktarılamaz/parçalanamaz.
- Savaş dışı kalan gemileri taktiksiz şekilde “escape yaptı” diye kaydetmeyiz; kaçış ve savaş eligibility farklıdır. ESCAPE minimum gemi/ateş gücü girdisi doğru katılan havuzdan kurulmalıdır.
- İstihbaratın savunma tahmini de katılabilir filoyu kullanır: mevcut `intel.ts` home toplamından `combatValue` çıkarıyor. %5 veya altındaki gemiler rakibin savunma gücünü yüksek gösteremez; gözlem doğruluğu/fog kuralları korunur.

Owner kararına göre anıtta %5 veya altına düşen HOLD gemisi orada kalır, otomatik geri dönmez. Saldırıda hasar vermez; manuel geri çağrılabilir, radyasyon hasarı devam eder ve orada ölmesi mümkündür.
Owner kararına göre bu gemi üretime devam eder ve saldırıda vurulabilir; gezegen hangarındaki baskın bağışıklığı anıta kopyalanmaz. Hiç uygun gemi kalmayan saldırı dalgası için öneri çatışma açmadan yaralı sağ kalanları eve döndürmektir.
Kara savunmalarının mevcut salvage/kaybedilme davranışı ve NPC güçleri bu gemi bakım işiyle ayrıca yeniden tasarlanmaz; başlangıç kapsamı oyuncunun mobil gemileridir.

## Parçalama formülü ve işlem

Her kaynak için:

`geri dönüş = üretim maliyeti × adet × gerçek kalan can oranı × 0,5`

| Can | Üretim maliyetinden geri alınan oran |
| --- | --- |
| %100 | %50 |
| %80 | %40 |
| %60 | %30 |
| %50 | %25 |
| %20 | %10 |

Örnek maliyet 1.000 alaşım + 400 kristal + 100 döteryum ise %60 canlı tek gemi 300 alaşım + 120 kristal + 30 döteryum verir.
Bu örnek gerçek hull fiyatı değildir; formülü açıklar.

- Alaşım/kristal/döteryum ayrı hesaplanır. Gemi üretiminde döteryum varsa aynı oranla iade edilir; uçuşta harcanmış yakıt ayrı ödül değildir.
- Başlangıç fiyat kaynağı mevcut gerçek üretim reçetesi `HULLS[hull]`'dur; şu an `buildUnits` kaynakları bu reçeteden hesaplıyor.
- Fiyat yenilenmesi/indirimli üretim geçmişi için her gemiye satın alma faturası eklenmez. Gelecekte indirim sistemi eklenirse parçalama için ayrıca kural gerekir.
- Hesapta ekranda yuvarlanmış can yüzdesi kullanılmaz. Kesirli yara ve güvenli integer sınırları korunur.
- Öneri: kaynak başına toplam gerçek miktar hesaplanır, aşağı tam sayıya yuvarlanır. UI quote ve server commit aynı helper'ı kullanır; batch'i bölmek daha fazla kaynak veremez.
- Yeni scrap kuyruğu, geri dönüş gemisi veya kamusal enkaz oluşturulmaz. Owner anında parçalamayı seçti.
- Yalnız kendi gezegeninde fiziksel olarak duran ve başka işe ayrılmamış gemi seçilebilir. Home veya bekleyen dock; uçuş/anıt/support/aktif repair uygun değildir.
- Başlangıç kapsamı bütün mobil gemiler (tam canlı olanlar ve Prospector dahil); kara savunması, probe paketi, Ölüm Yıldızı ve anti-battery bu gemi eylemine otomatik dahil edilmez.
- %100 canlı gemiyi parçalamak için önce ücretli onarım açılması veya sahte yaralı dock kaydı oluşturulması gerekmez. Tamirhane ekranındaki Parçala görünümü home gemilerini de seçebilir.
- Çalışan/sıradaki repair'a bağlı gemi doğrudan parçalanamaz; önce işi iptal etmek gerekir. Completion/iptal/parçalama yarışı atomik sonuçlanır.
- Mevcut refund/kaynak kredisi davranışıyla kaynaklar gezegen stoklarına girer. Depo kapasitesi nedeniyle sessiz miktar kaybı veya yeni transfer sistemi eklenmez; mevcut geçici taşma davranışı onay arayüzünde doğru gösterilir.
- Parçalama oyuncu eylemi geri alınamaz: miktar ve kesin kaynak dönüşüyle tek açık son onay. Yeni inventory otomatik seçilmez; başka hasar durumundaki gemiye sessizce geçilmez.
- Aynı HTTP retry ikinci defa gemi silip kaynak veremez. Mevcut durable idempotency altyapısı kullanılır; forge owner/lot/count ve eski seçim reddedilir.
- Gemiler silinirken home/dock metadata, Hangar doluluğu, Wealth ve UI invalidation birlikte güncellenir. Parçalama düşman kill/Hakimiyet puanı yaratmaz.
- Onarım sonrası parçalama kaynak döngüsü yaratmamalı: Industrial en iyi durumda maliyetin eksik can oranının yarısını ister;
  tamire harcananı çıkarınca parçalama getirisi doğrudan parçalamadan fazla olamaz. Yuvarlamalar için bunu property testiyle koruruz.

## Filo ve tamirhane tasarımı

Yeni sistemin anlaşılması Wiki'ye bırakılmaz. Owner'ın mevcut ui-v2 Command Deck dili, gemi art'ı, mobil yoğunluğu ve canlı galaksi korunur.

Filo, gezegen → mevcut gemi ailesi/türü → sağlık durumu sırasıyla açılır. Aynı gemi 50 ayrı kart olarak gösterilmez.
Hull başlığı toplam/home/away/workshop bağlamını, altında gerçek sağlık grupları can barı + adet + durum metnini verir.
Hasarlı ama savaşa uygun grup ile onarım gerektiren grup hem renk hem açık metinle ayrılır.
Örnek tek tür satırları:

| Grup | Adet | Durum | Eylem |
| --- | --- | --- | --- |
| Can %100 | 4 | Sağlam | Parçala |
| Can %72 | 3 | Savaşa uygun | Adet seç → Tamirhaneye aktar / Parçala |
| Can %4 | 2 | Savaşa katılamaz | Adet seç → Tamirhaneye aktar / Parçala |
| Tamirhanede | 1 | Bakımda | İlgili tamirhane görünümünü aç |

Benzer yaralar kapalı görünümde aralık/özet olabilir; seçim açıldığında exact gruplar ayrılır. %5 ve %5,01 asla aynı eligibility grubuna gizlenmez.
Canı %5 veya altında gemi için “Onarım gerekli” ve “Transfer edilebilir” bilgileri birlikte görünür; fırlatma ekranı uygun adetleri doğru gösterir.
Sadece yüzde değil seçili grupta gemi başına kalan/maksimum HP de gösterilebilir. Araştırma yüzünden canın anlamı ekranda açık kalır.

Tamirhane aynı yüzeyde iki açık eylem görünümü önerir: Onar / Parçala. Onar görünümünde bekleyen ve kuyruktaki gemiler, seçilen adet,
fiyat, süre, kaynak yeterliliği ve sonuç görünür. Parçala görünümünde healthy home gemileri de vardır; onarımda olanlar açık nedenle kilitlidir.
Başka ekranlara gitmeden seçilen adet için onarım bedeliyle parçalama dönüşünü karşılaştırabilmek gerekir.
Bottom action alanı seçilen gemi adedini ve kaynak toplamını canlı günceller; mevcut sağlık değişirse eski tutarı onaylatmayız.
Adet kontrolü mevcut oyun standardına uyar: eksi, tam adet göstergesi, artı ve Tümü; yeni bir sayı giriş dili eklenmez.
Radyasyonda durum “Radyasyon nedeniyle tamirhane devre dışı”; aktarım, onarım ve parçalama kapalı; yalnız gözlem ve uygun tahliye akışı kalır.
Radyasyonun kalkması otomatik hangar→dock transferi, ücretsiz yama veya eski onarımın devamını tetiklemez; oyuncu güncel yara için yeni iş başlatır.

Yeni UI'lar önce somut önizlemeyle owner'a gösterilir; final uygulama 350×812 telefon ve masaüstünde Playwright/tools/visual ile kontrol edilir.
Yerleşim, dokunma hedefleri, küçük can farklarının anlaşılması, partial miktar girişi, empty/loading/error ve değişen gezegen seçimi kontrol edilir.
Metinlerde teknik lot/metadata/queue version anlatılmaz; can, adet, bakım ve karar sonucu oyuncu dilinde yazılır. Bütün desteklenen diller ve Wiki birlikte güncellenir.

## Radyasyon Bombası ile uyum kontrolü

| Potansiyel çakışma | Önceden çözüm |
| --- | --- |
| İsabetten sonra hafif hasarın her inişte silinmesi | Ücretsiz tamir bu ön işte tümüyle kalkar |
| Doz %20'yi geçince otomatik güvenli dock | Otomatik aktarım tümüyle kalkar; aktarım explicit ve radyasyonda yasak |
| Radyasyon bitince eski otomatik dock/yama/onarımın devam etmesi | Bitiş ortamı temizler; home/dock yarası korunur, yeni onarımı oyuncu başlatır |
| %5 ve altındaki gemiyi savaş listesinden çıkarırken envanterden de silme | Savaş dışı gemiler ayrı korunur; radiation settlement home toplamını kapsar |
| Savaş dışı gemiyi radyasyondan bağışık sanma | Savaş eligibility ve radyasyon maruziyeti farklı helper/karardır |
| Gemiyi uçurup döndürerek iyileştirme | Her özel uçuşta seçilen yarayı taşı, dönüşte aynı yarayı home'a ekle |
| Parçalamayı radyasyonda ölümden kaçış ve kaynak dönüşüne çevirme | Owner seçimiyle radiation active guard parçalamada da zorunlu |
| İade quote sırasında %70, commit sırasında %60 can | İşleme kadar doz hesaplanır; quote değişmişse yeni tutar gösterilir, eski yüksek iade verilmez |
| Yard'dan yeni gemi doğup geçmiş dozu alması | Sağlık ekleme anı açık; radiation engine daha sonra cohort'a bu andan sonrası dozu uygular |
| Eski repair event'inin radyasyonda veya sonrasında iyileştirmesi | İş terminal CANCELLED durumuna geçer; eski event completion/yeniden teslim gemiyi onaramaz |
| Tamirhanenin radyasyon sığınağı olması | Dock doz alır; eski REPAIR otomatik iptal/tam iade, yaşayan gemi yarasıyla çıkarılabilir |
| Araştırma completion'ının geçmiş dozu ucuzlatması | Health update açık zaman/tech sınırı taşır; gelecekteki radiation engine önce eski dönemi kapatır |
| Anıt HOLD gemisi %5 veya altındayken davranış | Yerinde kalır, üretir, ateş etmez; saldırı ve radyasyonla ölebilir, dönüş manuel |
| Sağlık barı yuvarlaması %5 hakkı yaratması | Tek exact eligibility helper; UI statüsü API sonucu ve ortak kuraldan |
| Grup bölme/merge hasarı veya kaynak üretmesi | Exact yara korunur; adet/dose/refund invariants ve concurrency testleri |

Bu ön işte bomba üretimi/fırlatma veya gezegene yeni radyasyon yazılmaz. Health kayıtları ve işlemler, gelecekteki radyasyonun
belirli ana kadar settlement yapabilmesine uygun tasarlanır. Mevcut anıt radyasyonu ve onun hasarlı dönüşleri bu aşamada doğru taşınır.

## İlgili API ve sınırlar

Önerilen dar işlem ailesi: selected home → dock aktar, selected idle dock → home geri al, selected dock quantity → repair order,
selected local home/dock quantity → scrap quote/commit. Mevcut repair start/cancel API'si yeni seçim şekliyle genişletilir.
Tüm işlemler authenticated owner/planet/season/placement kontrolü, Zod parse, aynı dünya kilidi ve atomik count/health/resource güncellemesi kullanır.
İstemci fiyat, remaining HP veya owner id belirleyemez. Yeni mutation'lar mevcut player-scoped idempotency altyapısını kullanır.
Uçuş/onarım completion ile yarışlar aynı lock disiplinini izler; lock alındıktan sonra sayılar ve lot/owner ilişkisi yeniden doğrulanır.
Filo API'sinin aggregate eski alanları bilinçli korunur; homeDamage/combatEligible gibi yeni görünüm gizli rakip filo bilgisine public kanaldan sızmaz.

## Uygulama sırası ve gerekli doğrulama

1. Bakımın onaylanmış kurallarını bu planla uygula; önizleme ve test kapsamını hazırla. Asset/bomba fiyat seçimlerini bu ön işe taşıma.
2. Rules testleri önce FAIL: ücretsiz onarım yok, %5 sınırı, partial health split/merge, kaynak dönüşü ve tamir sonrası parçalama döngüsü.
3. Kalıcı home health ve migration/API testleri önce FAIL; mevcut dock ve repair verisinin korunması.
4. İniş, savaşa girdi/çıktı, bütün launch/transfer/return adapter'ları; sonra manuel aktarım ve quantity repair.
5. Atomik scrap quote/commit; idempotency, cancellation ve inventory/Wealth entegrasyonu.
6. Filo/tamirhane tasarım önizlemesi, uygulama, launch ve rapor/i18n/Wiki güncellemeleri.
7. Mevcut anıt radyasyonu ve yeni radyasyon tasarımıyla uyum review; gerekli ordinary regression testleri.
8. Ordinary `pnpm verify`, tek workspace/worker, `nice -n 10`, heap ≤4 GiB; görsel kontrol. Uzun ekonomi/sezon simülasyonu ayrıca istenmedikçe çalıştırılmaz.
9. Bu temel doğrulandıktan sonra Radyasyon Bombası, gezegen dozu ve radyasyon başlangıcındaki otomatik REPAIR iptal/tam iade davranışını uygula.

Kritik testler:

- %1 hasarla iniş ve savunma sonrası yara aynen kalır; %20/%20+ ve %5 sınırları yeni kurala göre.
- Tam %5 vs %5,01 ve fraction boundary; savaşa uygun gemi round içinde %5 altına düşebilir/ölebilir.
- Aynı hull healthy/eligible wounded/ineligible wounded karışımı; katılmayan gemi survivor yazımında kaybolmaz veya iyileşmez.
- Onarım kuyruğuna 10 gemiden 3 aktarma; kalan 7'nin tam yarası ve yeni dock 3'ün yarası aynı kalır.
- Aynı gruptan eşzamanlı launch/transfer/dock/scrap; çift gemi kullanımı veya resource claim yok.
- Active/queued repair ship doğrudan scrap edilemez; iptal/completion yarışı; partial quantity ve kalan dock.
- %100/%80/%50/%20 can örnekleri; küçük kesirler, sıfır iade, farklı kaynaklar, aşağı yuvarlama, çok büyük adet ve malformed input.
- Bir batch'i parçalara bölmek daha fazla refund vermez; current Industrial ile repair+scrap döngüsü kazanç yaratmaz.
- Tüm iniş ve abandoned flight yolları ücretsiz yama/dock yapmaz; waves/metadata/units arasında adet uyumsuzluğu yok.
- NPC/ground/Prospector ve elde edilmiş/klanla verilmiş gemiler için scope, owner/transfer ve existing invariants.
- Wealth, Hangar yükü, capture/secession/season wipe/delete/relocation, rapor ve bildirim; bakım düşman kayıp kredisi üretmez.
- Mevcut sağlıklı muharebe, ground salvage, shield, escape ve score ledger sonuçları gereksiz yere değişmez.
- UI seçili adet 0/1/tümü, yeni grup gelişi, yetmeyen kaynak, değişen quote, stale world, i18n, %5 etiketi ve mobil taşma.

## Bakımda kalan karar durumu

Bakımın ana mekanikleri owner yanıtlarıyla kapandı. Bomba fiyat/süre/asset/üretim paralelliği ve özel radyasyon kapsamı asıl radyasyon planında kalır; bakımın ilk aşamasını engellemez.
Kesin şema, sınırlı API ayrıntıları ve UI küçük tercihleri uygulamada bu planın kurallarına göre verilir; bağımsız oyun kuralı gibi eklenmez.

## Güncel radyasyon–tamirhane davranışı

| Durum | Son davranış |
| --- | --- |
| Radyasyon başlarken ücretli REPAIR işi sürüyor/sırada | Otomatik iptal; ödenmiş onarım kaynakları tam iade; iş ilerlemesi kaybolur |
| Geminin konumu | Tamirhanede mevcut yarasıyla bekler; otomatik home'a aktarılmaz |
| Radyasyon sırasında dock gemisi | Radyasyon hasarı alır; baskında korunur |
| Oyuncu tahliye etmek ister | Idle dock'tan home'a çıkarabilir; normal transfer/tahliye kurallarıyla gönderebilir |
| Radyasyon sırasında yeni dock/onarım/parçalama | Reddedilir; kaynak/gemi harcanmaz |
| İkinci bomba veya duplicate isabet | Yeni kaynak kendi penceresinde kaydedilir; önceden iptal edilmiş işe ikinci iade yapılmaz |
| Radyasyon bittikten sonra | Otomatik onarım başlamaz; güncel can üzerinden yeni fiyat/süreyle oyuncu başlatır |
| Radyasyon altında dock gemisi ölür | Gemi yok edilir; eski iptal edilmiş iş onu diriltemez, ikinci kaynak iadesi yoktur |
| Normal zamanda oyuncu ücretli işi iptal eder | Mevcut normal iptal/iade kuralı; yara iyileşmez |

Örnek: %60 canlı gemiye iş başlamış, bitime 10 dakika kala radyasyon gelmişse eski REPAIR işi iptal edilir ve faturası tam iade edilir.
Geminin canı radyasyon sonunda %30 ise yeniden başlatılan iş %30→%100 onarımı için güncel tarifeye göre hesaplanır.
Eski 10 dakika veya eski düşük fatura kullanılmaz. Radyasyonun başlangıcından önce gerçekten bitmiş iş geriye dönük iptal edilmez.

Zaman sınırı: `readyAt <= radiationStart` olan iş gerçek zaman çizgisinde tamamlanmış sayılır; `readyAt > radiationStart` olan aktif/sıradaki iş iptal edilir.
Aynı milisaniyedeki tamamlanma, o ana kadar yapılmış işi bitirir; yeni radyasyon o andan sonraki doz içindir. Worker'ın UUID/sıralama farkı sonucu değiştirmez.
HTTP onarım/iptal/aktarım/tahliye işlemi, daha önce varması gereken ama henüz worker'ın işlemediği bombanın üzerinden ilerleyemez; hedefin önceki due olayları uzlaştırılır.
Otomatik iptal olmuş iş için eski manuel iptal isteği gelirse yeni para iadesi yapılmaz; mevcut iptal/iade sonucu gösterilir, gemiyi eski işe geri bağlamaz.

Önceki “kuyruğu duraklat ve otomatik devam ettir”, “ek yarayı eski bedelle %100'e tamamla” ve “paused işte bütün gemiler ölünce iade” tartışmaları son kararla kaldırıldı.
Gemiler radyasyondan ölmeye başlamadan eski iş zaten iptal/iade edilir. Böylece partial ölümde ücretli iş küçültme, yeni yara için eski fatura farkı ve resume için kaynak yeterliliği sistemleri kurulmaz.

## Baştan sona inceleme: bulunan eksikler ve gerekli düzeltmeler

Bu inceleme oyun kodu değiştirmeden, mevcut kurallar/servisler/API/UI okunarak yapıldı. Bulgular uygulama ve regresyon kapsamıdır; davranışın uygulandığına veya testlerin geçtiğine dair iddia değildir.

| Bulgu | Neden bozulabilir? | Planlanan önlem |
| --- | --- | --- |
| Planet host yaralı olamaz varsayımı | `combat.ts` host hasarını reddediyor; tek savunan shortcut yarayı taşımaz | Gerçek home yarasıyla savaş girdisi ve sonuç yazıcısı birlikte düzenlenir; sağlıklı savaş parity korunur |
| Aynı hull'da katılan/katılmayan gemiler | Sonuçtaki hull adedi bütün home'u overwrite ederse %5 altı gemi silinir veya iyileşir | Savaş başlangıcında fiziksel/katılan havuz ayrılır; sadece katılanların sonucu değişir, dışarıdakiler gerçek yarasıyla aynen korunur |
| Anıtta ateş etmez ≠ vurulmaz | Planet'teki %5 altı bağışıklığını ortak filtreyle uygulamak anıt gemisini de korur | Ateş edebilme ve hedef alınabilme ayrı kararlar; konum bazlı açık matris |
| Savaş içi %5 filtresi | Her round eligibility yeniden hesaplanırsa gemi ölmeden çatışmadan kaçar | Ateş uygunluğu çatışma başlangıcında dondurulur; katılanlar savaş içinde normal yaralanır/ölür |
| Küçük/kesirli yara | Dock DB check >%20; API damageBp min1/remainder yok; legacy normalize 0bp yarayı atabilir | Pozitif kesirli yara dahil DB/API/normalizer/HP bar/quote tutarlı biçimde korunur |
| Gruptan kısmi seçim | Mevcut `repair.ts` bütün lot'u alıyor | Seçilen adet explicit; kalan ve taşınan yara aynı; fiyat/süre seçime göre sunucuda hesaplanır |
| İniş ve hediye/ödül karışımı | Home yarası yoksa bütün dönüşler healing olur; yeni ödül gemisine eski yara yazılırsa sahte hasar olur | Gerçek returning cohort yarası korunur; yeni üretilen/ödül/towed hull yalnız kendi başlangıç canını kullanır |
| Transfer/destek/klan savaşı/sivil görevler | Bir launch yolunun home yarasını taşımaması ücretsiz tamir açığı olur | Bütün kaynak home çıkışları ortak split, bütün dönüşler ortak wounded merge; özel tablo/wave damage korunur |
| Savaş sonrası klan desteği | Farklı owner'ın yarası veya adedi ev sahibine karışabilir | Owner/konum/wave sınırları korunur; battle contribution sayısı/score doğru katılanlara göre |
| İstihbarat ve güç tahmini | Probe ve launch toplam home adedini savaşa hazır sanabilir | Total-owned ayrı, uygun savunma filosu ayrı; fog/sensör hakları değişmez |
| Koloni ayrılması | `loyalty.ts` home gemilerini capital'a yalnız adetle ekliyor | Home yaraları da aynı devir anıyla taşınır; dock/aktif iş sistem kapanışı mevcut owner politikasını korur |
| Dünya kontrolü/relocation | Yeni hasar metadata'sı eski owner/dünyada kalabilir veya yeni sahibin yarasını bozabilir | Planet/units ilişkisi, safe-home, season taşıma, wipe/delete bütünlüğü; yeni FK temizlik sırası |
| Ortak build cancellation | `cancelBuildOrder` bütün işler için yarım iade ediyor | Radyasyon iptali yalnız `kind=REPAIR`/REPAIR lane; normal build/research/strategic ücret ve çalışma kuralları değişmez |
| Radyasyonda bekleyen fee | Eski completion gemiyi tam canlı bırakabilir | İş atomik CANCELLED + iade + event terminal; duplicate/processing event terminal durumu yeniden doğrular |
| Cüzdana iki kere iade | Manuel iptal, source arrival, season cleanup ve abandon yarışabilir | Terminal claim + original invoice + idempotency; bir işten toplam iade hiçbir zaman ilk ödeneni aşmaz |
| İade ve yağma sırası | İade edilen ücret artık normal gezegen stoğudur; sonra gelen baskında stok gibi yağmalanabilir | İade gerçek kaynak zamanında uygulanır; mevcut depo/yağma kuralları korunur, gizli korumalı iade cüzdanı eklenmez |
| Sezon/worker repair sweep | İptal edilen işin eski event'i stranded sanılıp yeniden onarılabilir | Cancellation receipt, dedupe, health/abandon/sweep ve cleanup regression'ları |
| Parçalama–onarım döngüsü | Can yüzdesi/fiyat yukarı yuvarlanırsa bölerek fazladan kaynak üretilebilir | Exact yara + aşağı refund/up repair rounding + conservation/property test; aynı gemi bir kere tüketilir |
| Sağlıklı gemiyi onarıma alma | %100 geminin fake dock işi baskından saklama veya sıfır ücret işi yaratır | Normal aktarım/repair yalnız gerçek pozitif yarada; %100 gemi home'dan parçalanabilir |
| Kapasite/Wealth/Prospector | Dock/yaralı/savaş dışı gemi envanterden düşmüş sanılırsa yeni gemi tavanı aşılır | Home+away+dock gerçek units üzerinden sahiplik/capacity; sağlık yüzdesiyle mevcut Wealth formülü yeniden tasarlanmaz |
| Bildirim ve UX | Eski “otomatik onarıldı”, yanlış finishing/countdown veya fiyat kullanılır | Yeni yara/aktarım/iptal/iade metinleri, quote değişimi ve tüm locale/Wiki güncellemeleri |

### Bilerek değiştirmediğimiz kurallar

- Hakimiyet/Dominion formülü, klan puan ledgeri ve ranking yeniden tasarlanmaz. Gerçek başlangıç yarası ve yeni katılım kuralının savaş sonucu değiştirmesi istenen davranıştır; katılmayan planet gemileri kill/damage paydasına girmez.
- Kara savunmasının mevcut salvage/kaybedilme kuralları ve NPC güç dengesi korunur; oyuncunun mobil gemi bakımına ilişkin kurallar bunları sessizce kapsamaz.
- Kalkan, EMP, sadakat ve attack protection/tier/clan ceasefire aynı kurallardır; hasar metadata'sı bunların yetkisini değiştirmez.
- Görev hızı/yakıt, uçuş yuvası, taşıma kapasitesi ve normal iptal iade oranları korunur. Yarayı taşımanın hangi geminin hayatta kaldığına etkisi vardır; yeni yüzdesel hız/kargo cezası eklenmez.
- Gezegendeki ücretsiz manuel dock aktarımı baskından korunma yaratabilir; owner bu davranışı seçti. Buna gizli aktarım ücreti, süre, kapasite veya saldırı sırasında yasak eklenmez.
- Tamirhane radyasyondan korumaz. Bomba saldırısı sırasında normal tersane/bina/research kuyrukları REPAIR iptali yüzünden durdurulmaz.
- Geçmişte ücretsiz tamirle silinmiş hasar uydurulmaz. Mevcut sağlıklı gemiler, bekleyen dock ve paid orders veri geçişinde korunur.
- Henüz yeni radyasyon penceresi olmayan eski sezonların geçmiş dozu, yeni hasar/50 sınırıyla tekrar hesaplanmaz. Yeni bakım geçişi sürüm/zaman sınırıyla mevcut filo yaraları ve uçuşları kayıpsız taşır; season reset yapılmaz.

### Konuma göre hasar ve savaş matrisi

| Geminin başlangıç durumu | Ateş verir | Baskın/saldırıda hedef olur | Radyasyondan etkilenir | Üretim/dönüş |
| --- | --- | --- | --- | --- |
| Planet home can >%5 | Evet, normal savaş | Evet | Evet, kapsamındaki mobil gemi | Normal görevler |
| Planet home can ≤%5 | Hayır | Hayır | Evet, kapsamındaki mobil gemi | Transfer/tahliye açık |
| Planet tamirhane | Hayır | Hayır | Evet, kapsamındaki mobil gemi | Home'a geri alma mümkün; radyasyonda yeni iş yok |
| Anıt HOLD can >%5 | Evet | Evet | Evet | Mevcut üretim ve manuel dönüş |
| Anıt HOLD can ≤%5 | Hayır | Evet | Evet | Üretim sürer, dönüş manuel |

“Kapsamındaki” ifadesi Prospector/NPC/ground gibi asıl radyasyon planındaki istisna kararlarını değiştirmez. Bu matriste savaş dışı olmak genel bağışıklık değildir.

### Ek kabul testleri

- Radyasyon başlangıcında üç REPAIR işi bir kere iptal/tam iade; YARD ve CONSTRUCTION hiç etkilenmez.
- Onarım gerçekten radyasyondan önce bitti, aynı instantta bitti, sonra bitecekti; gerçek timeline'a göre sonuç, worker gecikmesine göre karar yok.
- Kaynak sonradan başladı/bitti/yeniden başladı, aynı source/event duplicate oldu; tamamlanmış/cancelled iş geri açılmaz, ikinci refund yok.
- Radyasyon sonunda %30 canla yeniden iş başlatıldığında yeni ücret/süre %30→%100 için; eski faturanın/10 dakikanın devamı yok.
- Eski cancelled order'a bağlı lot'un repairOrderId bağı temizlenir; gemiler mevcut yarasıyla idle dock'ta görünür ve manuel çıkabilir.
- Gemiler tümüyle öldüğünde daha önce iade edilmiş cancelled job ikinci kez ücret iade etmez; hiçbir eski event yeni units oluşturmaz.
- %99 yaralı geminin manuel dock'a alınması baskından korur; radyasyon aynı gemiye doz verir. %100 healthy gemi parçalanabilir ama fake repair'a alınamaz.
- Anıtta aynı hull'da aktif ve %5 altı cohorts; pasif gemi ateş/NULLIFIER bonusu vermez fakat saldırı casualties'ine girer; %5'i savaş içinde geçen aktif gemi savaşmaya devam eder.
- Anıt production/ownership/cargo gerçek fiziksel lot üzerinden; atıl fire filter'ı yaşayan pasif gemiyi silmez. Owner'ın üretim devam kararı korunur.
- Claimed/pending completion, player scrap/dock/launch ve radiation arrival aynı gemide yarışır; tek fiziksel sonuç/tek receipt.
- Veri geçişi, capital'a secession dönüşü, reward hull, partial transfer, araştırma snapshot'ı, shard değişimi ve eski API/DB fractional yara sınırları ayrı testlenir.
- Son iade original invoice'a eşittir; sonradan araştırma/fiyat değişimi, gemi ölümü veya ikinci bomba iade miktarını büyütemez. Idempotency/claim/cancel yarışında toplam tek bedeldir.

## Uygulama incelemesi

14 Ekim ayrıntılı kod/logic/uç durum/performans/tasarım incelemesi ve doğrulama durumu:
[ship-maintenance-review-2026-10-14.md](ship-maintenance-review-2026-10-14.md).
Tam normal testler, tip kontrolü ve lint bitmeden bu aşama tamamlandı kabul edilmez.
