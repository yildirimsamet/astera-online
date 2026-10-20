# Gemi kalkanı deneyi

Bu dosya uygulama öncesindeki deneyin kaydıdır. Owner daha sonra temel kalkanı
HP × 1 ve dört araştırma seviyesiyle en fazla HP × 2 olarak seçti; uygulama ve
güncel doğrulama [buradadır](ship-shields-implementation-2026-10-20.md).
Kaynak hash'leri değiştiği için arşiv taraması artık eski girdileri güncel
kaynakmış gibi çalıştırmayı reddeder. Üretim motoru aynı bağımsız prototiple
bütün beş araştırma seviyesinde ayrıca karşılaştırılır.

Amaç: aynı veya yaklaşık eşit bileşimlerde, daha çok kayıp veren tarafta
1:1 için %30–50, 2:1 için %20–30 ve 3:1 için %5–15 sağ/yaralı filo
kalmasına yalnız gemi kalkanı ile yaklaşılabilir mi?
“En az bir taraf” ifadesi için ayrıca daha çok sağ kalan taraf da ölçülür.
Hedefler garanti veya savaş sonrası gemi iadesi değildir.

Deney oyun motoruna uygulanmaz. Bağımsız araç mevcut sağlıklı tekli savaşın
hasar paylaştırmasını, sınıf katsayılarını, eşzamanlı ateşi, tur sınırını ve
nakliye örtüsünü kullanır. Sıfır gemi kalkanıyla gerçek motorla parite testi
zorunludur. Gemi kalkanı her tur yenilenir; hull hasarı kalır. Aynı tipte
hasar önce yaralı, ardından sağlıklı gemilere gider; bir geminin kullanılmayan
kalkanı diğer gemiyi korumaz. Dolayısıyla OGame'in rastgele tekil hedef
sistemi değil, Astera'nın mevcut hasar dağılımına eklenen kişisel kalkandır.

HP veya ATK ile orantılı sabit kalkanlar taranır. İki tarafa aynı kurallar
uygulanır, oranlara göre gizli koruma yoktur. Yer savunması yeni kişisel
kalkan almaz; gezegen kalkanı aynı kalır. Sadece sağlıklı başlangıç, tekli
filolar; radyasyon/önceden yara, klan sahiplikleri ve Nullifier bu prototipin
dışındadır. Canlı PvP, yağma, Dominion veya maliyet dengesi değişmez.

Önce testler: sıfır kalkan gerçek motor paritesi; kalkan yenilenmesi; yaralı
gövde; tam sınırlar; fazla hasar; boş filo; nakliye ve yer savunması;
tohum tekrarlanabilirliği. FAIL → araç → PASS → matris → değerlendirme.
Ham girdiler önceki çalışmadan alınır, güncel kaynak hash farkları kontrol
edilir. Aynı bileşimlerde kesin oranlı sonuçlar ayrı gösterilir.

## Ölçüm

19 ayar × 1.632 senaryo × 32 tohum = **992.256 savaş**. HP katsayıları:
0 / 0,25 / 0,5 / 0,75 / 1 / 1,5 / 2 / 3 / 4 / 6 / 8.
ATK katsayıları: 0,5 / 1 / 2 / 3 / 4 / 6 / 8 / 12.

Gemi kalkanı her geminin araştırmayla artırılmış HP veya ATK değerinin
belirtilen katıdır. HP temelli ayarda tank gemiler daha büyük kalkan alır;
ATK temelli ayarda ateş gücü yüksek gemiler. İkisi de basit deneme
hipotezidir; tasarım olarak kabul edilmiş yeni gemi istatistiği değildir.

Kaynak doğrulaması: önceki ölçümde kayıtlı bütün oyun kaynak hash'leri
değişmemişti. Sıfır kalkan prototipi, 1.632 girdinin üçer tohumu üzerinde
gerçek `resolveCombat` ile **4.896 karşılaştırmada aynı sağ kalan gemi
sayılarını ve tur sayısını** verdi. Yeni kalkanın çalışması ayrı el hesabı
testleriyle kontrol edildi. Bu, prototipin mevcut hasar dağılımına kalkan
eklediğini doğrular; klan/radyasyon/önceden hasarlı geliş senaryolarını kapsamaz.

Önceki matris: T1–T4, dört tek tip + iki karma bileşim, bütün eşleşmeler,
240.000 ve 1.000.000 bütçe; ayrıca tam oranlı aynı-bileşim savaşları.
Ek senaryolar: gezegen kalkanı 6/10, araştırma farkları, nakliye, yer
savunması. Girdi dosyasındaki gerçekleşen oranlar geçerlidir; bütçeli
senaryolarda tam sayı yuvarlaması vardır. “Tam oranlı” tabloda yoktur.

Sağ kalan yatırım = yaşayan gemilerin tam yapım değeri / başlangıçtaki
savaş gemilerinin tam yapım değeri. Yaralı sağ kalanlar buna dahildir.
Bu değer mevcut HP yüzdesi veya onarım maliyeti düşülmüş net yatırım değildir.
İki taraftaki bu oranların **küçüğü** hedefe göre değerlendirilir; bu taraf
her zaman raporun kaybedeni veya savunanı olmak zorunda değildir.
Nakliye/yer savunması hedef sağ kalma payına dahil değildir.

## En açıklayıcı karşılaştırma: tam oranlı T3–T4 karma aynaları

Her hücre 128 savaş: iki seviye × iki bileşim × 32 tohum. Değerler, her
savaşta daha az yatırım koruyan tarafın ortalama sağ kalan yatırım payıdır.

| Her geminin kalkanı | 1:1 | 2:1 | 3:1 |
| --- | ---: | ---: | ---: |
| Yok | %16,6 | %0 | %0 |
| HP × 0,5 | **%36,1** | %0 | %0 |
| HP × 0,75 | **%43,1** | %0 | %0 |
| HP × 1 | **%48,8** | ≈%0 | %0 |
| HP × 1,5 | %57,5 | %7,9 | %0 |
| HP × 2 | %63,8 | **%22,4** | %0 |
| HP × 3 | %72,2 | %41,2 | **%9,6** |
| ATK × 2 | **%42,7** | %0 | %0 |
| ATK × 6 | %64,9 | **%26,6** | %2,1 |
| ATK × 8 | %70,5 | %39,0 | **%12,0** |

HP × 0,5 ve × 0,75 ile 1:1 denemelerin tamamı %30–50 bandına girdi.
HP × 2 ile 2:1 denemelerin %60,2'si %20–30 bandındaydı. ATK × 8 ile
3:1 denemelerin %96,9'u %5–15 bandındaydı. Bunlar **farklı ayarlar**:
aynı ayarın üç hedefi birlikte karşıladığı anlamına gelmez.

Denediğimiz tek katsayılı HP/ATK kalkanları, bu karma filo grubunda üç
hedefi birlikte yakalayamadı. 3:1 zayıf tarafı koruyacak miktar, 1:1
savaşları hedeflenenden çok daha az kayıplı yapıyor. Bu bir matematiksel
imkânsızlık ispatı değildir; farklı gemiye özgü kalkanlar veya farklı hedef
dağılımı burada sınanmadı.

## Ortalamaya bakınca oluşan yanlış izlenim

Temel 6×6 matrisinin tamamında, HP × 1,5 için (satır başına 9.216 savaş):

| Hedef oran | Daha az korunan tarafta ortalama kalan yatırım | En az bir tarafta tam imha |
| --- | ---: | ---: |
| 1:1 | %48,2 | %4,0 |
| 2:1 | %21,9 | %24,8 |
| 3:1 | %5,2 | **%67,0** |

Ortalama hedeflere yakınken 3:1 savaşların çoğu hâlâ tam imha. Gemilerin
bir kısmını çok iyi koruyup başka karşılaşmalarda hiç korumamak, kullanıcının
“çok geniş koşul aralığında tam imha” problemini çözmüş sayılmaz.

HP × 2'de 3:1 ortalama sağ kalma %10,3'e yükselse de tam imha %52,7.
ATK × 6'da aynı ortalama %11,9 ve tam imha %46,5. Sadece ortalama
oranlardan başarı ilan etmek bu modellerin önemli sorunlarını gizler.

## Diğer senaryolar ve yan etkiler

- HP × 1,5, T3/T4 karma filoların bütçeli eşleşmelerinde 3:1 tam imhayı
  engellemedi: kalkan 0/6/10 ve nakliye kontrollerinde %100.
- Aynı ayarda 2:1 için eşit araştırmada tam imha %1,4 iken, saldıran
  Power/Armor 5 ve savunan 2 olunca %60 oldu. Bir tek eşit araştırma
  senaryosuna göre ayar yapmak yeterli değil.
- Kişisel kalkan güçlenen tarafı da güçlendiriyor. Tam oranlı karma
  filolarda HP × 3 ile 3:1 zayıf taraf ortalama %9,6 kalırken güçlü
  taraf %93,1 kalıyor.
- HP × 2 ve üzerindeki tam oranlı karma 1:1 örneklerinin tamamında,
  savunanın değer kaybı mevcut %42 kısmi başarı eşiğinin altında kaldı.
  Kalkan eklemek yağma/başarı kuralları açısından da sonuç doğurur.
  Yeni zafer/yağma kuralı bu çalışmada uygulanmadı.
- Mevcut odaklı hasar dağılımı değişmediği için kalkan çok sayıda yaralı
  gemi üretmiyor: aynı tipte çoğu gemi ya sağlıklı kalıyor ya ölüyor;
  kısmi yara genellikle tip başına tek gemide. Kişisel kalkan ve yaygın
  yaralanma birbirinden ayrı tasarım kararlarıdır.
- Sayı/değer kayıpları ikisi de ham çıktıda mevcut. Ana tablolar yatırım
  değerini esas alıyor; sonuçlar bütün canlı oyuncu savaşlarının oranı
  olarak yorumlanmamalı.

## Değerlendirme

**1:1 hedefi için gemi kalkanı işe yarayan bir araç.** Fakat üç hedefi
aynı anda tutarlı biçimde elde etmek için test edilen basit kalkan modeli
tek başına iyi bir çözüm vermedi. Kalkanı büyütmek, güç farkından doğan
tam imha eşiğini ileri taşır; zayıflayan filonun ateşinin düşmesi ve güçlü
tarafın daha az kayıpla savaşması devam eder.

Sonraki tasarım deneyi için en anlamlı ayrım:

1. Mütevazı kalkanla denk savaşlardaki erken ve karşılıklı imhayı azaltmak.
2. Kaybeden tarafta kalan filoyu korumak için savaştan çıkma/etkisiz kalma
   davranışını ayrıca sınamak. Bu ikinci adım yeni bir savaş kuralıdır;
   mevcut üç tura sadece daha fazla HP eklemekle aynı şey değildir.

Kayıp yüzdesine göre otomatik gemi iadesi ya da her savaşta zorunlu bir
sağ kalma kotası bu deneyde önerilmiş veya uygulanmış değildir.

## Dosyalar ve doğrulama

- [Deney aracı](../tools/ship-shield-experiment.mjs)
- [Testler](../tools/ship-shield-experiment.test.mjs)
- [Ham sonuçlar](evidence/ship-shield-experiment-2026-10-20.json)
- [Girdi matrisi](evidence/combat-attrition-astera-2026-10-20.json)

```bash
nice -n 10 node --max-old-space-size=4096 --import tsx --test tools/ship-shield-experiment.test.mjs
nice -n 10 node --max-old-space-size=4096 --import tsx tools/ship-shield-experiment.mjs --run
```

7 test geçti; bunlardan biri 4.896 gerçek motor karşılaştırması yapar.
992.256 örneğin sayaç sınırları, toplamı ve alt/üst/hedef bandı ayrımı
ayrıca doğrulandı. Oyun kaynaklarına, veritabanına veya çalışan PvP
kurallarına değişiklik yapılmadı. Yeni araç ve test dosyasının hedefli lint
kontrolü geçti; bütün depo için `pnpm verify` çalıştırılmadı.
