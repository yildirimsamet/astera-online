# İki eksende dönen dış anıtlar — uygulama ve geçiş planı

12 Ekim 2026. Uygulama yerel çalışma ağacında; gerçek sunucuya deploy yapılmadı. Ayrıntılı hata incelemesi ve doğrulama kaydı: [code review](moving-monuments-code-review-2026-10-12.md).

## Kesinleşen kapsam

- Gezegenler sabit. Sekiz dış anıt ortak katı kürede, yatayda 8 ve dikeyde 16 saatte döner.
- **Aktif sezonda, bütün anıtlar oyuncu filosu bakımından boşken açılacak.** Giden/dönen filo, sonda veya açık anıt klan hazırlığı da kalmamalı. Komut bunu atomik olarak kontrol eder.
- Alan geçişi radyasyon hasarı vermez. Anıtta bekleme hasarı hedef kimliğine ve bekleme süresine bağlı kalır; aura yalnız görseldir.
- Gerçek gidiş bedeli + azami dönüş rezervi başta alınır. Gerçek dönüş bedeli geri çağırırken ayrılır. Her gemi grubu yalnız kendi kullanılmayan payını **eve varınca** alır. Dönemeyen geminin payı yanar.
- Klan hazırlığında henüz uçulmamış anıt bacağı için de rezerv tutulur. Katkının sahibi, araştırması, hasarı ve yakıt payı ayrı kalır.
- İlk anıt davranışındaki gibi tekrar savaş/yük gemisi desteği açıktır. Tier, kalkan, kapasite ve uçuş yuvası kuralları sürer.
- Gelecekteki radyasyon füzesi ayrı iştir. Kaynak kimliği gezegen ve anıtı destekler; füze seviyeleri, süre/yığılma ve gezegende hangi filolara hasar vereceği bu işte uydurulmadı. Mevcut gezegen ana filosuna yeni sürekli hasar sistemi eklenmedi.

## 1. Uygulanan hareket: yatay 8 saat, dikey 16 saat

Sekiz anıta **aynı iki eksenli katı dönüşüm** uygulanacak. Her anıt merkezden 6.000 birim uzakta kalacak; anıtlar arası mesafeler değişmeyecek. Yalnız kendi modelleri dönmeyecek, galaksideki gerçek konumları yukarı/aşağı ve yatay yönde ilerleyecek.

Önerilen başlangıç ayarı:

| Parametre | Değer |
| --- | --- |
| Yatay / Y ekseni turu | **8 saat** |
| Dikey / X ekseni turu | **16 saat** |
| Küre yarıçapı | **6.000** |
| Dönüş sırası | `RY(yatayAçı) × RX(dikeyAçı)` |
| Başlangıç noktaları | Mevcut sekiz anıt koordinatı |
| Zaman referansı | Ortak, değişmez etkinleştirme zamanı |
| Bağlı nesneler | HOLD filoları ve görsel radyasyon aurası |

**Sekiz saat sonra anıt aynı konuma dönmez.** Yatay eksen bir tur tamamlar, dikey eksen yarım tur ilerler. Kimliği belirli bir anıtın bütün dönüşümü 16 saatte başlangıca döner. Arayüzde “8 saatte tamamen aynı noktada” denmemeli.

İki eksenin ikisinin de 8 saat olması denenmiştir; önerilmemiştir. İkinci eksenin 16 saat olması, istenen yukarı/aşağı hareketi verirken ilk hareket yönünün arkasına kıvrılan buluşmaları azaltıyor. Bu süre bir varsayımdan değil, aşağıdaki karşılaştırmadan seçildi; üretim ayarı olarak henüz açılmadı.

## 2. Dyson koduyla ilişki ve neden oranı aynen almadım?

[`DysonShells.tsx`](../apps/web/src/galaxy/DysonShells.tsx) gerçek dönüşü şu sırayla kuruyor:

```text
ATTITUDE = sabitTilt × SPIN_Y × SPIN_X
PERIOD_Y = 150 saniye
PERIOD_X = 233 saniye
```

Anıtlar için aynı iki eksenli dönüş türü ve çarpım sırası kullanıldı; sekizinin başlangıç tilti ortak kimlik dönüşümü seçildi. Anıt başına bağımsız tilt/faz eklenmedi; ortak katı küre korunuyor.

Dyson oranını tam koruyup yatay turu 8 saate ölçeklersek dikey tur **12 saat 25 dakika 36 saniye** olur. Bu da hesaplandı. Bazı uzak kalkışlarda anıtın yolu yön değiştirerek buluşma noktasını başlangıçtaki hareket yönünün arkasına taşıyor. Buluşma yine ilk 112 dakika içinde; bu olgu sonraki tur beklemekten farklı. Kullanıcının “ön tarafta buluşsun” tercihine daha iyi uyduğu için **8/16** seçildi.

## 3. İki eksende “önde/arkada” tanımı

Tek bir düzlemsel yörünge açısı artık yok. Yatay/dikey eksen açıları veya üstten ekran görüntüsü tek başına karar vermeye yetmez. Kalkış anındaki gerçek 3B hareket yönünü kullanıyoruz:

```text
m₀ = anıtKonumu(kalkışAnı)
v₀ = anıtHızı(kalkışAnı)       // türev, gemi hızı değil
m₁ = anıtKonumu(buluşmaAnı)
ileriPay = dot(m₁ − m₀, normalize(v₀))

ileriPay > 0 → ilk hareket yönünün ön yarı uzayında
ileriPay < 0 → ilk hareket yönünün arka yarı uzayında
```

Bu, buluşma noktasını sınıflandırır; geminin bütün yolunun anıtın anlık burnunun önünde kalacağını söylemez. Eğri bir yolun başlangıç teğetinin arkasına dönmesi de mutlaka tam tur atıldığı anlamına gelmez.

Ayrı ölçüler:

- **İlk erişim:** ulaşılabilir ilk buluşma kökü seçiliyor mu?
- **İlk yönün önü:** yukarıdaki 3B izdüşüm pozitif mi?
- **Eksende tur:** uçuş boyunca yatay veya dikey eksen tam tur tamamlıyor mu?
- **Yer değiştirme:** başlangıç/buluşma noktaları arasında küre merkezinden görülen açı ve mesafe oranı.

Tam konuma dönüş iki eksenin ortak periyoduyla belirlenir. “Bir eksen tur atmadı” bütün olası küçük kıvrımların yokluğu anlamına gelmez; bu nedenle ilk-kök ve yön ölçüleri birlikte kullanılır.

## 4. Hesaplanan sonuçlar

[Hesap aracı](../tools/monument-two-axis-audit.mjs) ve [ham sonuçlar](evidence/monument-two-axis-audit-2026-10-12.json) depoya eklendi. Güncel `travelExact` ve `distanceFactor = 1,2` kullanıldı.

**113 gerçek hız**: filonun en yavaş gemisi, araştırma, beacon ve varsa pace sonrası seyahat fonksiyonuna verilen değer. Gerçek uzay hızı **94,1667 birim/dakika**. %10 seçeneğine daha sonra düşürülmüş 11,3 hız bu hesabın kapsamında değil.

Her modelde 250 oyuncu yuvası × 8 anıt × 48 kalkış zamanı = **96.000 uçuş**. Kalkış zamanları 30 günlük zaman aralığına yayılmış sınırlı sorgulardır; ekonomi/sezon simülasyonu yapılmadı. Seed `20261012`, 1.000 oyuncu yuvasından her dördüncüsü. Eşit ağırlıklı geometrik örneklemdir; oyuncu tercihleri/gerçek maç ortalaması değildir.

### 4.1 Dört model karşılaştırması

| Yatay / dikey tur | Kalkış yönünün arkasında buluşma | Bir eksenin tam turunu bekleme | Yakın hedeflerde ortalama uçuş |
| --- | ---: | ---: | ---: |
| 8 / 8 saat | 7.634 / 96.000 — %7,95 | 0 | 44,17 dk |
| 8 / 12,4267 saat — Dyson oranı | 2.222 / 96.000 — %2,31 | 0 | 37,19 dk |
| **8 / 16 saat** | **0 / 96.000** | **0** | **35,74 dk** |
| 12 / 18,64 saat — yavaşlatılmış Dyson oranı | 870 / 96.000 — %0,91 | 0 | 30,36 dk |

Yakın hedef: kalkıştaki mesafe ≤3.000; yalnız analiz için kullanılan eşik. Ortak dönüşte hızlar birbirini bazı konumlarda kısmen dengeliyor; anıtın başlangıç yönü sonra kıvrılabiliyor. Her iki ekseni yavaşlatmak bu biçim etkisini otomatik olarak ortadan kaldırmıyor.

### 4.2 Önerilen 8 / 16 saat modelinin ayrıntısı

| Ölçü | Bütün örnekler | Yakın başlayan 3.826 örnek |
| --- | ---: | ---: |
| Ortalama uçuş | 72,49 dk | 35,74 dk |
| Uçuş p95 | 103,37 dk | 62,84 dk |
| En uzun ölçülen uçuş | 111,35 dk | 82,16 dk |
| Ortalama yatay ilerleme | 54,37° | 26,81° |
| Ortalama dikey ilerleme | 27,18° | 13,40° |
| İki nokta arasındaki ortalama küresel açı | 46,10° | 24,29° |
| Kalkış yönünün arkasına düşme | 0 | 0 |

Gözlenen en yüksek mesafe oranı **2,72×**. Anıt senden uzaklaşıyorsa kısa başlayan bir yol yine uzayabilir. Bu model, “önünde buluşsun” açısından iyi aday; **“bütün uçuşlar yalnız biraz uzasın” garantisi vermiyor**.

İki nokta arasındaki azami küresel açı örneklemde yaklaşık **91,04°**. Önceki tek eksenli plandaki “83,6°'lik ilk çeyrek yay” ifadesi buraya taşınamaz. Burada 83,6° yalnız yatay eksenin faz artışı için üst sınırdır.

### 4.3 Daha sık yön kontrolü

Gezegen örneklerinden bağımsız olarak sekiz anıt için:

- 1.024 farklı dikey başlangıç fazı;
- mümkün uçuş aralığında 257 farklı süre;
- model başına **2.105.344** faz/süre çifti kontrol edildi.

Başlangıç Y dönüşü skaler çarpımı değiştirmediği için bu kontrolün bağımsız değişkeni X fazıdır. 8/16 modelinde negatif ileriPay bulunmadı; ölçülen en küçük pay **+209,57 birim**. Diğer modellerde negatif değerler yeniden bulundu.

Bu, oldukça daha sık sayısal kontrol; **aralıklardaki bütün gerçek sayılar için matematiksel yön kanıtı değildir**. Üretimde “her durumda ön” mutlak bir oyun garantisi olacaksa faz/süre alanı için hata sınırlarıyla doğrulama veya analitik kanıt, kurallar paketinin kabul koşuluna eklenmeli. Şu an sonuç “örneklerde tamamı önde ve sonraki tur gerekmiyor”dur.

## 5. Neyi matematiksel olarak garanti edebiliyoruz?

### 5.1 En geç buluşma sınırı iki eksende de geçerli

Gezegenler 4.500, anıtlar 6.000 yarıçap içinde. Herhangi bir zamanda kalkış noktasına mesafe en fazla 10.500 olabilir:

```text
azamiUçuş = 10.500 × 1,2 / 113 = 111,5044 dakika
azamiYatayFaz = 111,5044 × 360 / 480 = 83,6283°
azamiDikeyFaz = 111,5044 × 360 / 960 = 41,8142°
```

Sürekli hareket, sabit pozitif gemi hızı ve hedefin o süre boyunca aktif olması koşuluyla bir buluşma bu zamana kadar oluşur. Sezon sonu gibi görev uygunluk sınırları ayrıca uygulanır. Bu bound, hedefin iki eksende hangi kıvrımları yaptığından bağımsız.

Dolayısıyla 113 gerçek hızda **8 saatlik veya 16 saatlik turu bekleme gerekmiyor**. Bu bir örneklem sonucu değil, mesafe sınırından gelen sonuçtur.

### 5.2 113 hızda ilk buluşmayı bulmak için güvenli hızlı yol

İki eksenli harekette mevcut `interceptOrbit` doğrudan kullanılamaz. Ama 113 için her durumda karmaşık çok-kök araması da gerekmiyor.

`Q(t)=RY(ωy t) RX(ωx t)` için anlık açısal hız büyüklüğü:

```text
Ω = sqrt(ωy² + ωx²)
```

Sabit kalkış noktası `a`, hareketli anıt `m(t)` için mesafenin değişim hızı:

```text
|d/dt |m(t) − a|| ≤ Ω × |a|
```

Gerekçe: anıt hızı `ω × m`; mesafe türevindeki skaler üçlü çarpım `a × m = a × (m − a)` ile sınırlandırılabilir. Bu sınır, anıtın toplam yüzey hızını kullanmaktan daha sıkıdır. `|a| ≤ 4.500` olduğundan 8/16 ayarında azami mesafe değişim hızı yaklaşık **65,86 birim/dakika**, 113 filonun hızı **94,17**.

Bu nedenle `f(t) = mesafe(a,m(kalkış+t)) − gemiHızı×t` kesin azalan. **Tek kök** var ve güvenli bracket üzerinde ikili arama ilk buluşmayı bulur. Deney aracı bu eşitsizliği her kalkışta doğrulamadan çözümü kullanmıyor.

8/16 için tüm gezegen kalkışlarında bu hızlı yolu güvenceye alan gerçek katalog-hız eşiği yaklaşık **79,03'ten büyük**. Bu eşiğin altında buluşma imkânsız demek değildir; tek-kök garantisini bu eşitsizlikle veremeyiz. 75, 56 ve düşük pace'ler için genel ilk-kök yolu gerekir.

**Üretim şartı:** desteklenen bütün filo hızları için çalışan çözücü tamamlanmalı. 113 başarılı diye diğer filolar sessizce yanlış köke gönderilmemeli. Genel ilk-kök çözücüsü uygulandı; düşük hız, dar erişim aralığı ve izole teğet için regresyon testleri eklendi.

## 6. Uygulama sözleşmesi

### Zaman ve hareket

`packages/rules/src/monumentMotion.ts` iki tarafın ortak konum, türev ve ilk buluşma kaynağıdır. `RY × RX` sırası ve 8/16 periyotları sürüm 17 sözleşmesidir. `monuments.x/y/z` değişmez başlangıç koordinatlarıdır; her karede veya tick'te veri tabanına konum yazılmaz.

Yeni sezonlar 17 ile açılır. Eski canlı sezonda `seasons.monument_motion_starts_at` ayrı geçiş zamanıdır; sezonun başka kuralları değiştirilmez. Geçiş anında mevcut konumlar korunur. Fetih, respawn ve klan değişimi fazı sıfırlamaz. Kapanışta hareket `closedAt/endsAt` konumunda donar.

Genel yavaş-hız yolu boş aralıkları hız sınırıyla eler ve aralıkları soldan tarar. Teğet ve çok dar ilk erişim için test vardır. Hassasiyet bütçesi aşılırsa yanlış ETA üretilmez; işlem hata ile geri alınır. 113 hızda kanıtlanmış tek-kök yolu kullanılır.

### Filo, sonda ve savaş

`monumentMotion.ts` sunucu adaptörü buluşmayı çözer, varışı milisaniyeye yukarı yuvarlar ve hedef noktasını **aynı kayıtlı anda** tekrar hesaplar. Sezon bitişine eşit varış reddedilir. Gidişin düz bacağı ve ETA'sı kaydedildikten sonra değişmez.

OUTBOUND recall kayıtlı düz bacağın o andaki noktasından döner. HOLD recall anıtın güncel noktasından döner. Dönüş başladıktan sonra anıt hareketi filoyu sürüklemez. Kısmi seçim hem hasarı hem kargoyu hem yakıt payını böler. Alternatif ev mevcut `safeHomePlanet` kuralına uyar.

Savaş/probe gecikmiş worker'ın saatinde değil, planlanan olay anında çözülür. Raporlar o andaki konumu saklar. Klan son kalkışında en yavaş katılımcı ve seçilen pace ile ortak bir buluşma hesaplanır; tüm dalgalar aynı anda ve aynı noktada savaşır. Her pace için çözüm ayrıca yapılır; tam hız ETA'sını pace'e bölmek yeterli değildir.

### Yakıt hesabı

Ev sınırı `H = max(4500, oyuncunun mevcut gezegen yarıçapları)` ve azami dönüş mesafesi `max(anıt yarıçapı, H) + H`dır. OUTBOUND geri çağırma başlangıcı da bu sınıra dahildir. Böylece yasal gelecekteki evler ve mevcut dışarıdaki operatör fixture'ları kapsanır. Her geminin rezervi tek başına dönmeye yetecek şekilde yuvarlanır; keyfî kısmi geri çağırma filoyu yakıtsız bırakamaz. Gerçek dönüş faturası seçili grubun gerçek mesafesinde bir kez yuvarlanır.

Rezerv kargo değildir; kargo kapasitesini tüketmez ve yağmalanmaz. Oyuncunun servetinde sayılır. Kısmi recall/hasarlı savaş kohortları paylarını taşır; ölü geminin payı yaşayanlara devredilmez. İade, HOME geçişi ve kaynak kredisiyle aynı transaction'dadır; tekrar edilen event ikinci kez ödemez.

Klan katkısı gerçek gezegen→toplanma bacağını öder; gelecekteki toplanma→anıt ve anıt→ev için ayrı rezerv tutar. Dönüş sınırı `max(anıt yarıçapı, toplanma yarıçapı, H) + H`dır; başka üyeye ait dış toplanma gezegeninden ani OUTBOUND geri çağırma da kapsanır. Birleşik kalkışta gerçek anıt uçuşu fiyatlanır; fazla ayrılan tutar ve dönüş rezervi native gemi kohortlarına aktarılır. Kalkmadan iptal edilen lider ana-gezegen katkısı zaten evdedir, kullanılmayan rezerv o anda iade edilir. Fiziksel katkı iptalde normal dönüşünü tamamlayınca iade alır. Eski ön ödemeli kayıtların rezervi sıfırdır; geriye dönük bedel üretilmez.

Sezonun mevcut doğrudan eve teslimi korunur. Eve teslim edilen sağ kalanlar kullanılmamış rezervlerini alır; uçmadıkları hayalî dönüş için yakıt kesilmez.

### Radyasyon

`RadiationTarget {kind: PLANET | MONUMENT, id}` kaynak ve bekleme segmentinde eşleşmelidir. Uçuş segmentinde hedef etiketi yoktur. Sonuç: aura boyutu/hareketi uçuş hasarı hesabına girmez. Anıtın kendi bekleme dozu, kaynakların aktif tarihçesi, EMIT/SHELTER, kesirli HP ve kayıpta üretim ağırlığının değişmesi korunur.

Geçişten önceki kaynak penceresi statik eski modelle kalır; geçiş sonrası yalnız hedefe bağlı pencere oluşur. Eski normal görevlerin geçiş öncesi henüz işlenmemiş hasarı silinmez. Anonim ZONE yeni modelde hasar üretmez ve yeni ZONE yaratılması reddedilir. Hareketli küre–rota kesişim çözücüsü kaldırıldı; ilerideki füze aynı hedefte yeni tarihli kaynak yazarak bağlanabilir.

### Görüş, radar ve arayüz

Gezegen/radar/telescope merkezleri değişmez. Native transit rotaları kayıtlı düz segmentlerdir ve mevcut sensor filtrelerinden geçer. Anıtlar kamuya açıktır; rakip HOLD gemileri hareket verisiyle açığa çıkarılmaz. Probe raporu gözlem zamanı snapshot'ıdır.

Harita modeli, hitbox, label, aura ve kamera odağı ortak sunucu saatiyle ilerler. Per-frame React state veya API isteği yoktur; label örtüşme kontrolü hareket varken 4 Hz yenilenir. Filo gönderim ekranı hareketi durdurmaz. Seçili anıt için gerçek üç boyutlu gelecek eğrisi izdüşümü ve buluşma noktası gösterilir. Seçili recall tahmini 5 saniyede yenilenir; commit her zaman güncel sunucu hesabını kullanır.

## 7. Canlı sezonda dağıtım sırası

1. Kullanıcının belirttiği boş anıt penceresini hazırla; gelen/dönen filo, sonda ve açık anıt ortak savaşını da bitir.
2. Veri tabanı yedeğini al ve normal migration zincirini uygula. Bu işe ait ek migration `0153_monument_motion_fuel.sql`dur; koordinat, hedef kimliği, sahiplik ve geçmiş raporlar değiştirilmez.
3. Bütün API ve worker süreçlerini yeni sürüme geçir. **Eski ve yeni kod birlikte çalışırken etkinleştirme yapma.** Eski süreç hareketli hedef için statik rota üretebilir.
4. İlgili shard için önizle:

   ```bash
   pnpm season activate-monument-motion --shard CODE
   ```

   `READY`, sıfır filo/sonda/operasyon ve geçiş zamanını gör. Kuru önizleme fazı değiştirmez.
5. Yetkili deploy anında aynı komutu `--yes` ile çalıştır. Kontrol transaction içinde tekrar yapılır. Exclusive season kilidi, eş zamanlı gönderimle yarışmayı önler. `BUSY` durumunda hiçbir geçiş yapılmaz; `--yes` ile hata çıkış kodu döner. Tekrar çalıştırma `ALREADY_ACTIVE` verir ve fazı sıfırlamaz.
6. İki istemcide hareketi, 113 hız civarı ilk gidişi, HOLD bekleme hasarını, kısmi recall yakıtını ve klan kalkışını gözle.

Bu belgede komutların bulunması gerçek deploy yapılmış olduğu anlamına gelmez. Yeni hareketli görevler başladıktan sonra epoch'u silip eski koda dönmek desteklenen geri dönüş değildir; önce yeni gönderimleri durdurup aktif görevleri bitirmek gerekir.

## 8. Doğrulama ve kalan sınırlar

Geometri örneklemi yukarıda; üretim regresyonları, migration ve görsel kontrol sonuçları [CR dosyasında](moving-monuments-code-review-2026-10-12.md) izlenir. Uzun ekonomi/sezon/snowball simülasyonu yapılmaz. Sentetik geometri CPU ölçümü gerçek üretim yükü veya telefon GPU garantisi sayılmaz.

113 hızda sonraki tam turu beklememe mesafe sınırından gelir. Bütün gerçek fazlar için “mutlaka ilk teğetin önünde” ayrıca kanıtlanmış değildir; örneklem sonucunu evrensel oyun garantisi olarak göstermiyoruz. Daha düşük pace'ler gerçek ilk erişim anını kullanır; oyuncunun tercihiyle daha uzun/başlangıç yönünün arkasında uçuş mümkün olabilir. Hız seçimi kapatılmaz.
