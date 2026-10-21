# Kalkan sonrası anıt ele geçirme incelemesi — 21 Ekim 2026

> Aşağıdaki ölçümler değişiklik öncesi teşhistir. Ardından owner, savaş içi
> kalkan yenilenmesinin kaldırılmasını ve anıtta savunan kargonun çekilmesini
> onayladı. [Uygulama kaydı](monument-cargo-retreat-and-shields-2026-10-21.md).

Oyuncu bildirimi mevcut kodla yeniden üretildi. Sağlıklı, eşit araştırmalı
3 Korsan, 1 Korsan + 1 Argosi tutan anıtı alamıyor; savunana can hasarı bile
vermiyor. Bu örnekte yanlış bir dönüş olayı saptanmadı: motor savunmayı
temizleyemiyor, anıt kontrolü savunanda kalıyor ve sunucu saldıranı `DEFEAT`
nedenli dönüşe geçiriyor.

## Ölçüm kapsamı

99 senaryo × 512 tohum = 50.688 yerel savaş. Gerçek üretim savaş motoru
`resolveMonumentCombat`, bakım katılımı açık. Farklı gemiler, filo büyüklükleri,
araştırma seviyeleri, önceki yaralar, kalkan öncesi davranış ve nötr garnizonlar
karşılaştırıldı. Üretim veritabanına veya canlı oyuncu raporlarına erişilmedi.
Bunlar belirtilen girdilerin sonuçlarıdır; tüm canlı savaşların kazanma oranı
olarak yorumlanamaz.

Sunucunun aynı sahibin farklı gemilerini ayrı lot/stack olarak geçmesi ayrıca
768 tohum/araştırma/filo kombinasyonunda kontrol edildi: birleşik filo ile ayrı
lotlar aynı tur kayıtlarını, sağ kalanları ve kontrol sonucunu verdi.

[Ham sonuçlar](evidence/monument-shield-audit-2026-10-21.json).

## 1. Tam yenilenme küçük filolarda aşılamayan ateş eşiği yaratıyor

Güncel Korsan: 408 saldırı, 1.508 azami can, araştırmasız 1.508 kişisel
kalkan. Üç Korsan normal turda 1.224 vuruyor. En iyi +%8 atışta bile
1.321,92 < 1.508. Kalkan her tur tam dolduğu için hiçbir turda cana
ulaşılmıyor. Üç tur sonunda iki tarafın bütün gemileri sağlıklı kalıyor.
Savunan Korsan hayattayken Argosi hedeflenmiyor.

Bu durumda sadece tur sayısını artırmak veya aynı filoyu tekrar göndermek
can hasarı sağlamaz. Diğer koşullar değişmedikçe hiçbir saldırı yıpranma
biriktirmez. Savunan Korsanı başlangıçta %50 yaralamak da kalkanı küçültmez:
kalkan mevcut cana değil azami cana bağlıdır. Bu varyant da 512/512 kez sıfır
gövde hasarıyla sonuçlandı.

Saldırana Gemi Gücü 5 vermek üç Korsanın bazı atışlarını kalkandan geçiriyor;
fakat 512 örneğin hiçbirinde anıt alınamadı. Saldıranın kendi kalkan seviyesini
yükseltmesi ise doğrudan ateşini artırmaz.

## 2. Kargo koruması ve üç tur limiti ayrı bir engel

Anıt kontrolü için savunanın yük gemileri de yok olmalı. Yük gemileri turun
başında en az bir savaş birliği varsa hedeflenmez. Savaş gemileri üçüncü turda
yok olduğunda kargo için dördüncü atış turu bulunmuyor. Aynı turun fazla ateşi
de sonradan yük gemilerine yönlendirilmiyor.

Savunma bütün örneklerde 1 Korsan + 1 Argosi; iki tarafta araştırma sıfır:

| Saldırı | Kalkan öncesi ele geçirme | Güncel ele geçirme |
| --- | ---: | ---: |
| 2 Korsan | %31,84 | %0 |
| 3 Korsan | %100 | %0 |
| 4 Korsan | %100 | %0 |
| 5 Korsan | %100 | %0 |
| 6 Korsan | %100 | %100 |

Beş Korsanla savunan Korsan 351/512 savaşta öldü; o savaşların tamamında
Argosi sağ kaldığından kontrol değişmedi. Anıtta yalnız Korsan olduğunda beş
Korsan aynı 351/512 örneği ele geçiriyor. Bu, kargo etkisini ayrı doğrular.

Sorun yalnız tek gemilik filo yuvarlaması değil. 30 Korsan → 10 Korsan +
10 Argosi, 512/512 kez ele geçiremedi. 510/512 savaşta savunan Korsanların
tamamı yok oldu ama Argosiler kaldı. 90 → 30 + 30 ve 300 → 100 + 100
örneklerinde de bütün Korsanlar ölürken kargo kaldı ve ele geçirme %0 oldu.

Savunana Gemi Kalkanları 4 verildiğinde 3, 5 ve 6 saldıran Korsan hiç can
hasarı veremiyor. 8 Korsanla ele geçirme %0, 10 Korsanla %100 ölçüldü.
Saldıranın güç/zırh/kalkan seviyesi bu karşılaştırmada sıfırdır.

## 3. Bütün anıtlar veya bütün gemiler için kazanmak imkânsız değil

3 Kıyamet → 1 Korsan + 1 Argosi, 512/512 kez ele geçirdi. Kıyamet Mızrak
sınıfında, Korsan ise Akıncı sınıfındadır; Kıyametin yüksek ateşi ve sınıf
üstünlüğü bu küçük filoda kalkan eşiğini aşar. Bu eşit maliyet karşılaştırması
değildir; saldırının gemi türü ve ateşinin önemini gösterir.

Kodun mevcut nötr garnizonları ayrıca denendi: 3 Korsan, 3 Hisarlı EASY
garnizonu; 10 Korsan, 10 Leviathanlı HARD garnizonu 512/512 kez temizledi.
Korsanlar HARD'a katılabilecek kademededir; EASY örneği yalnız motor karşılaştırmasıdır,
oyuncunun kademe kapısını aşabildiği anlamına gelmez. Bu sonuçlar mevcut şikâyeti
yanlışlamaz: oyuncunun 1 Korsan + 1 Argosi tutması farklı bir savunmadır.

## Kod yolu ve raporlama

- `packages/rules/src/shipShield.ts`: kalkan aşılmadan gövde hasarı yok.
- `packages/rules/src/combat.ts`: her tur yeni kalkan; destek koruması turun
  hedef havuzunda hesaplanır, yok edilen savaş gemisinin payı aynı turda kargoya aktarılmaz.
- `packages/rules/src/monumentCombat.ts`: herhangi bir savunan kaldığında
  `DEFENDER`; yalnız saldıran savaş gemisi yaşar ve savunma tamamen biterse `ATTACKER`.
- `apps/server/src/services/monumentArrival.ts`: yukarıdaki sonuca göre HOLD
  veya `DEFEAT` dönüşü; nötr garnizonun gerçek gövde yaraları saklanır.
- Anıt raporu tur sayısı ve kayıpları veriyor; kişisel kalkan emilimini ve tur
  hesabını göstermiyor. Normal savaş raporundaki kalkan ayrıntıları anıt raporuna
  taşınmamış. Bu yüzden “neden geri döndüm” cevabı oyuncuya yeterince görünmüyor.

## Değerlendirme

Bu, onaylanan %100 tur yenileme kuralının anıtın tam temizleme koşuluyla denge
uyumsuzluğu. Önceki kalkan incelemesi sağ kalma ve hesap doğruluğunu sınadı,
ancak küçük anıt garnizonlarını ele geçirme eşiğini ve korunan kargoyu yeterince
ele almadı. Mevcut 25 anıt/kalkan regresyon testi de geçiyor; dolayısıyla onların
geçmesi bu oynanış sorununu yakalamaya yetmiyor.

İlk denenecek çözüm adayı: temel kapasite ve dört araştırma seviyesini koruyup
savaş içindeki tam yenilenmeyi azaltmak. Sadece tur sayısını artırmak sıfır can
hasarı eşiğini çözmez. Kargoyu savaş gemileri ölünce ele geçirme veya farklı
kontrol şartı da mümkün, fakat bunlar sahiplik ve kargo riskini ayrıca değiştirir.
Yenilenme değişikliği tek başına bütün filo oranlarında ele geçirmeyi garanti
etmez; adaylar hem anıt ele geçirme hem önceki filo sağ kalma hedefleriyle birlikte
ölçülmelidir.

Bu incelemede oyun kuralı, denge sayısı, API veya ekran değiştirilmedi. 13 anıt
ve 12 kişisel kalkan regresyonu tek worker ile çalıştırıldı: 25/25 geçti.

## Ek deney: savaş sırasında kalkan hiç yenilenmezse

Owner sorusu üzerine bağımsız, sağlıklı solo filo prototipinde yalnız yenilenme
kapatıldı. Kalkan savaş başında tam dolu; geminin harcanan kalkanı sonraki tura
taşınıyor. Odaklı hedefleme, gövde canına göre hasar paylaşımı, destek koruması,
üç tur, sınıf çarpanları ve atış varyansı aynı. Savaşlar arası dolum veya kalıcı
kalkan kaydı bu deneyin kapsamında değil.

Prototipin ardışık darbeler, gemiye ait ayrı kalkanlar, fazla hasar, sıfır
gemi/atış/kalkan ve tek Korsanın yok edilmesi kontrolleri geçti. Tam yenilenmeli
referans, bu deneyin 8.192 sağlıklı anıt örneğinde gerçek üretim motorunun
savunan sağ kalanlarıyla eşleşti. 46 senaryo × 512 tohum = 23.552 deney savaşı.
[Ham sonuçlar](evidence/monument-shield-no-regen-2026-10-21.json).

| Saldırı → savunma | Her tur tam yenilenme | Savaş içinde yenilenme yok |
| --- | ---: | ---: |
| 3 Korsan → 1 Korsan | %0 ele geçirme | %100 |
| 3 Korsan → 1 Korsan + 1 Argosi | %0 | %0 |
| 4 Korsan → 1 Korsan + 1 Argosi | %0 | %31,84 |
| 5 Korsan → 1 Korsan + 1 Argosi | %0 | %100 |
| 30 Korsan → 10 Korsan + 10 Argosi | %0 | %0 |

Üç Korsan yenilenmeyen savunan Korsanı üçüncü turda öldürüyor; ancak Argosi
o turda da hedeflenmediğinden anıt yine alınamıyor. Beş Korsan savunan Korsanı
ikinci turda bitirip üçüncü turda Argosiyi temizleyebiliyor. Yenilenmeyi
kaldırmak sıfır hasar kilidini çözer; kargonun ayrı ele geçirme engelini kaldırmaz.

Önceki filo koruma hedefi açısından yalnız Korsan aynaları da ölçüldü: 100'e
100, taban kalkanda saldıran ortalama kalan değer %65,74 → %65,01; iki tarafta
azami kalkan seviyesinde %76,59 → %75,71. Dolayısıyla bu büyük filo örneklerinde
kalkanın koruması kaybolmuyor; kaldırılan şey hasar almış ön geminin tur başında
yeniden dolması. Bu dar örnekler bütün filo bileşimleri için denge garantisi
değildir. Yaralı girişler, farklı sahipler, Nullifier ve gerçek sunucu kalıcılığı
prototip kapsamı dışındadır; oyun kuralı hâlâ değiştirilmemiştir.
