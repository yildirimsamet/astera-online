# Anıt güncelleme planı

Tarih: 2026-10-10. Son kullanıcı cevaplarıyla netleştirildi.
Onaylanan kuralların uygulama ve geçiş kaydı. Canlı sezona geçiş, anıtlar boşken
ayrı operatör komutuyla yapılır; veritabanı şema göçü mevcut anıtları taşımaz.

## Ayarlar ve erişim

| Kural | Şu an | Easy | Hard |
| --- | --- | --- | --- |
| Anıt sayısı | Tek tür, toplam 5 | 4 | 4 |
| Yeni filo gönderebilen oyuncular | Anıta özel tier sınırı yok | Tier 1–3 | Herkes |
| HOLD kapasitesi | 7.270 hacim | 1.550 hacim | 7.270 hacim |
| Radyasyon | Gemi başına 4 HP/dk | Gemi başına 2 HP/dk | Gemi başına 5 HP/dk |
| Radyasyon seviyesi | Ayrı seviye yok | 1 | 2 |
| Radyasyon görünümü | Mevcut yeşil | Sarı ağırlıklı, daha hafif | Yeşil ağırlıklı, mevcut yoğunluk |
| Model çevre çizgisi | Mavi | Yeşil | Kırmızı |
| Model boyutu | Tüccar gemisinin 3 katı | Tüccar gemisinin 3 katı | Tüccar gemisinin 5 katı |
| Üretim | Anıt başına 10 döteryum/dk | Anıt başına 3 döteryum/dk | Anıt başına 8 döteryum/dk |
| İlk nötr filo | 10 Leviathan | 3 Stronghold | 10 Leviathan |

Oyuncu tier'ı mevcut hesapla bulunur: en gelişmiş mevcut gezegendeki Komuta
Çekirdeğinin her üç seviyesi bir tier. Easy için çekirdek 1–9 uygundur.
Gemi tier'ı veya kalkış gezegeninin zayıf olması erişimi değiştirmez.
Klan üyeleri de kişisel tier'larıyla değerlendirilir.
Sınır, gerçekten gemi gönderen kişiye uygulanır. Kendi gemisini katmayan
Tier 4+ klan lideri, uygun Tier 1–3 üyelerin Easy saldırısını işaretleyip
başlatabilir; liderin mevcut koordinasyon yetkisi korunur.

Easy'yi tutarken veya Easy'ye giderken tier 4'e çıkan oyuncunun mevcut
filosu devam eder. Yeni gönderim, kargo dahil, kapanır. Erişim yeni
gönderimde değerlendirilir; sonradan tier yükselmesi başlamış seferi bozmaz.

Sekiz anıt, merkezden mevcut 6.000 birim uzaklıkta küreye dağıtılır.
Basit yerleşim küpün sekiz köşesidir; Easy ve Hard dönüşümlü atanır.
Böylece her dört anıtlık grup da kendi içinde üç boyutlu dengeli dağılır.

## Kişisel filo kuralı

**Aynı anıta ilk filonu gönderdikten sonra yalnız kargo ekleyebilirsin.
O anıta ait kendi filonun tamamı eve dönmeden yeni savaş filosu gönderemezsin.**

- Kısıt gönderim anında başlar. Kodda filo önce OUTBOUND (yolda), anıta
  yerleşince HOLD (tutuyor), çekilince RETURNING (dönüyor) olur. Üç durumda
  da yeni savaş filosu gönderilemez.
- Kısmi veya tam geri çekme serbesttir. Geri çekilen savaş gemisini tamir
  edip tekrar eklemek veya başka savaş gemisiyle değiştirmek mümkün değildir.
- Kargo eklemek ve geri çekmek serbesttir; tier ve mevcut dost hangar
  kapasitesi şartları uygulanır. Ek gemi gönderiminin istisnası gerçek kargodur.
- Sadece kendi kargon anıtta kalsa da yeni savaş filosu gönderemezsin.
  Anıta giden veya eve dönen kendi kargon da seferin bitmediği anlamına gelir.
- Hayatta kalan bütün kendi gemilerin eve ulaştığında tekrar istediğin
  savaş filosuyla başlayabilirsin. Yok olmuş gemilerin dönmesi beklenmez.
- Kural oyuncu ve anıt bazındadır. Klanın kontrolü sürse bile kendi seferin
  tamamen bittiyse yeni filo gönderebilirsin. Başka anıttaki filon bunu engellemez.
- İlk kez katılan klan üyesi, kişisel tier ve dost kapasite uygunsa savaş
  filosuyla katılabilir. Ona da ilk gönderimden itibaren aynı kural uygulanır.
- İlk ortak saldırıya birlikte çıkan katkılar başlangıç filosunun parçasıdır.
  Ortak saldırı, kişinin devam eden başka seferine takviye ekleme yolu olamaz.
- Kargo ile yasaklı başka gemi karıştırılan ek gönderim bütünüyle reddedilir.
  Kontrol sunucuda, tekli ve ortak gönderim yollarında uygulanır. Ek savaş
  filosu varış kuyruğuna girmeden reddedilir; başlamış geçerli seferler sürer.

## Temel durumlar

| Durum | Sonuç |
| --- | --- |
| Tier 1–3 oyuncu Easy veya Hard'a ilk filosunu yollar | Gönderebilir; mevcut savaş ve klan kuralları uygulanır |
| Tier 4+ oyuncu Easy'ye yeni saldırı veya dost filo yollar | Kargo dahil reddedilir; küçük gemi veya zayıf koloni sonucu değiştirmez |
| Easy'deki veya Easy'ye yoldaki oyuncu tier 4'e çıkar | Mevcut filo devam eder; yeni gönderim kapanır |
| İlk filo henüz yoldadır, ikinci savaş filosu gönderilmek istenir | Reddedilir; HOLD'a varması beklenmeden kısıt başlamıştır |
| Savaş filosunun bir kısmı eve çekilir | Yeni savaş gemisi gönderilemez; kargo akışı devam edebilir |
| Savaş gemileri eve döner ama anıtta kişisel kargo kalır | Yeni savaş filosu gönderilemez; kendi savaş gücü olmadığından üretim payı sıfırdır |
| Bütün kişisel filo çekilmiş ama hâlâ dönüştedir | Eve varış beklenir; yeni savaş filosu gönderilemez |
| Bütün hayatta kalan kişisel filo eve dönmüştür | Klan hâlâ tutsa da tier ve kapasite uygunsa yeni savaş filosu gönderilebilir |
| Bütün kişisel gemiler yok olmuştur | Başka aktif kişisel anıt filosu yoksa tekrar gönderilebilir |
| Klan üyesi ilk kez katılır | Tier ve dost kapasite uygunsa katılabilir; sonra aynı kişisel kısıta tabidir |
| Tier 4+ lider, kendi gemisini katmadan Tier 1–3 üyelerin Easy saldırısını yönetir | İşaretleyebilir ve başlatabilir; katılan her üyenin tier ve kişisel filo hakkı ayrı kontrol edilir |
| Güçsüz oyuncu klanının Hard anıtına yalnız kargo yollar | Kendi savaş gücü yoksa üretim payı alamaz; kaynak paylaşımı değişmez |
| Anıt doludur veya saldıran filo kapasiteden büyüktür | Bütün saldıran filo savaşır; zafer sonrası sığan sağ kalanlar kalır, fazlası döner |
| Dost kargo veya ilk kez katılan klan üyesi için yer yoktur | Mevcut kapasite ve yoldaki rezervasyon hesabıyla gönderim reddedilir |
| Aynı anda iki savaş gönderimi yapılır | İlk kişisel gönderim tamamlandıktan sonra ikinci istek reddedilir; iki başlangıç filosu oluşmaz |

Kaynak paylaşımı mevcut kişisel savaş gücü ve kişisel boş kargo kuralıyla
devam eder. Hasar, tamir, yakıt, uçuş, mevcut kontrol sonuçları ve nötr
garnizonun 24 saatlik geri dönüş kuralı korunur.

## Mevcut sezona geçiş

Kullanıcı, mevcut sezonda anıtların tutulmadığı uygun zamanda güncelleme
istiyor. Yalnız yeni sezon için beklenmeyecek.

- Geçişten hemen önce oyuncu HOLD'u bulunmadığı kontrol edilir. Anıta bağlı
  yoldaki/dönen filo veya sonda ve devam eden ortak saldırı hazırlığı da
  bulunmamalıdır; bulunursa geçiş ertelenir.
- Bu kontrol ve güncelleme aynı işlemde yapılır; arada yeni gönderimle
  koşulların değişmesine izin verilmez.
- Mevcut beş anıtın kimlikleri ve geçmiş raporları korunur: dört kayıt Hard,
  bir kayıt Easy olarak ayarlanır; üç yeni Easy eklenir. Sekizinin yeni
  küresel yerleşimi ve uygun tür ayarları aynı geçişte uygulanır.
- Easy'nin mevcut nötr filosu ve yeniden doğacak filo şablonu 3 Stronghold
  olarak birlikte ayarlanır. Hard şablonu 10 Leviathan kalır.
- Radyasyonun eski konum ve doz kayıtları silinmez. Eski bulutlar geçiş
  anında sonlandırılır; yeni bulutlar o andan itibaren başlatılır.
  Böylece geçmiş uçuş hasarı yeni oranlarla geriye dönük hesaplanmaz.
- Sezon sıfırlanmaz. Yeni sezon oluşturma ayarları da aynı 4+4 düzenini kullanır.
  Önceki sezonun aynı galaksideki ilk sekiz oyuncusunun adları sıralarıyla
  anıtlara eklenir. İlk beş eşleşme korunur; 6–8. sıralar yeni anıtlara eklenir.

## Uygulama ve değerlendirme

Önce erişim, kişisel filo döngüsü, ortak saldırı, eşzamanlı gönderim ve canlı
geçiş durumlarının testleri yazılır. Ardından anıt türü/ayarları, yerleşim,
sunucudaki gönderim kontrolleri, API ve arayüz güncellenir.
Veritabanı/API'deki beş anıt sınırları sekize çıkarılır; oyunda sekiz farklı
optimize model kullanılır. İlk ortak gönderimin parçaları birlikte doğrulanır;
aynı saldırıdaki katkılar birbirini ikinci bir gönderim gibi engellemez.

Kişisel döngü mevcut anıt seferlerinin durumundan kontrol edilebilir.
Kargolar dahil, o oyuncunun o anıttaki OUTBOUND/HOLD/RETURNING seferleri
bitmeden yeni savaş gönderimine izin verilmez. Sefer sona erince kişisel
gönderim hakkı yeniden açılır.

Arayüzde Easy/Hard, tier erişimi, kapasite, radyasyon, üretim ve yeni
savaş filosunun neden gönderilemediği açıkça gösterilir. Kargo seçimi ve
geri çekme bu kuralla uyumlu çalışır. Normal kurallar, sunucu/API ve
arayüz kontrolleri uygulanır; hedefli oyun testleri geçmiştir.

Sağ üstteki anıt listesinde Hard grubu üstte, Easy grubu altta bulunur.
Sınıf adları oyuncunun diline çevrilir; Türkçede üstte Zor, altta Kolay
görünür. Erişim uyarıları ve Türkçe Wiki de aynı adları kullanır.
Her grubun içinde kalıcı anıt sırası korunur. Oyuncu adları harita, liste,
odak kartı, anıt ekranı ve raporlarda aynı isim kaynağından gelir.
Önceki sezon veya ilgili sıra yoksa anıtın özgün adı gösterilir.
Model büyüklüğü seçim alanına, etiket konumuna, kamera yaklaşmasına ve
gezinti sınırına da uygulanır. Mobil ve masaüstü odak kartı uzun isimleri sarar.

Toplam üretim 50'den 44 döteryum/dk'ya düşer (%12). Hard radyasyonu %25
artar, anıt başına Hard üretimi %20 azalır. Bunlar seçilmiş başlangıç
ayarlarıdır; net kazanç dengesi henüz test edilmiş değildir.

Küresel yerleşim mesafe farkını azaltmayı hedefler; tam eşitlik sağlamaz.
Klanın ilk kez katılan üyeleri ve tamamen eve dönüp yeniden başlayan
oyuncular yakınlık avantajından hâlâ yararlanabilir. Tier 4'e yükselen
eski Easy tutucusu kalabilir. Bunlar seçilen kuralların kabul edilen
sonuçlarıdır; ek güç sınıfları veya bekleme süreleri eklenmez.

## Operatör komutu

Önce uygulama ve şema göçü dağıtılır. Eski sezonun beş anıtı `LEGACY` kalır;
yeni sezonlar doğrudan 4 Easy + 4 Hard açılır. Mevcut sezonda uygun boşlukta:

```bash
pnpm --filter @astera/server season adopt-monuments --shard EU-1
pnpm --filter @astera/server season adopt-monuments --shard EU-1 --yes
```

İlk komut yalnız kontrol raporu verir. İkinci komut koşulları aynı işlemde
yeniden kontrol ederek uygular. `BUSY` raporunda tutulan anıt, aktif filo,
sonda ve ortak hazırlık sayıları gösterilir; hiçbir anıt veya bulut değişmez.
Uygulama istemi `BUSY` ise komut başarısız çıkış koduyla biter. `ALREADY_UPDATED`
tekrar çalıştırmada değişiklik yapılmadığını bildirir. Galaksi açıkça
belirtilmelidir; bütün galaksilere otomatik işlem yapılmaz.

Geçiş sonrası harita ve kişisel anıt ekranı mevcut bildirim kanalıyla yenilenir.
Başarılı geçiş eski beş kimliği, önceki radyasyon zaman aralıklarını ve ilk
beş onurlandırma eşleşmesini korur; nötr filo ve doğuş şablonlarını birlikte ayarlar.

## Doğrulama

Son kod incelemesinin bulguları, regresyon kanıtları ve tam doğrulama sonucu
[güncel inceleme raporunda](monument-review-2026-10-10.md) tutulur. Normal
doğrulama `pnpm verify` ile, tek çalışma alanı ve tek Vitest işçisiyle,
`nice -n 10` önceliğinde yürütülür. Uzun ekonomi/sezon simülasyonları ve
snowball audit bu işin kapsamında çalıştırılmaz.

Tam doğrulamada ortaya çıkan mevcut bir arıza testinin rastgele zamanlama
varsayımı da düzeltildi: test verisi, onarımın sonraki arızadan önce
bitmesini sağlayan sabit olay kimliği kullanıyor. Oyunun arıza kuralları
değişmedi; bu dosyanın 27 testi hem hedefli hem tam sunucu çalışmasında geçti.

Sunucu testleri ve tarayıcı kontrolü ayrı yerel `_test` veritabanlarında
çalıştırıldı. Canlı veritabanına veya mevcut canlı sezona geçiş uygulanmadı.

Son gerçek API kontrolünde dokuz oyun senaryosu geçti: açık istemcide canlı
5→8 geçişi, ortak saldırının gönderim iznini anında yenilemesi, Hard fethi,
kargo kalırken savaş takviyesi yasağı, kargo gönderimi, son kargonun dönüş
sınırı, Easy'de tier yükselişi, önceki sezonun sekiz adının sonradan gelmesi
ve mobil/masaüstü yerleşimi. API yanıtları değiştirilmedi; tarayıcı hatası yok.
Sekiz modelin kaynak/optimize kopyaları mobil ve masaüstünde son 3×/5×
boyutlarla ayrıca yüklendi: 32 WebGL kontrolü geçti.

Görüntüler ve ölçümler: `out/monument-cr-2026-10-10/` ve
`out/monument-models-2026-10-10/`. İlk arayüz kontrolünün altı senaryosu
`out/monument-fairness-2026-10-10/` altında ayrıca korunur.
