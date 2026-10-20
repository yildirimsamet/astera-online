# Savaşta filo kaybı incelemesi — 20 Ekim 2026

## Soru ve kapsam

Saldıran/savunan oranları 1, 1,5, 2 ve 3 iken bir tarafın veya iki tarafın
tamamen yok olması ne sıklıkta gerçekleşiyor? OGame ile benzer kontrollü
senaryolar karşılaştırılacak. Oyun kuralları değiştirilmeyecek.

Bu çalışma canlı savaşların temsili örneklemi veya sezon/ekonomi simülasyonu
değildir. Sabit senaryo matrisi, her hücrede farklı rastgele tohumlarla çalışır.
Hücrelere eşit ağırlık verilir; oyuncuların hangi filoyu ne sıklıkta seçtiğine
ilişkin bir varsayım yapılmaz.

## Ölçüm planı

- Gerçek `resolveRaid`, güncel HP ve bakım seçenekleri; sağlıklı başlangıç.
- Oran, arayüz/kaçış hesabındaki `combatValue` (silahlı birliklerin ham kaynak
  maliyeti). Saldırı hasarı veya ATK×HP oranı değildir.
- T1–T4; Raider, Striker, Fortress, Escort ve iki karma bileşim.
- Aynı bileşimler ve farklı bileşimlerin tüm eşleşmeleri ayrı raporlanır.
- Savunma bütçeleri 240.000 ve 1.000.000; tam sayı gemi nedeniyle gerçekleşen
  oran da kaydedilir. Üretim, hangar kapasitesi ve uçuş öncesi erişilebilirlik
  simüle edilmez; bu bütçeler savaş hesabının büyüklük hassasiyetini sınar.
- Kalkan 0/6/10, araştırma farkı, nakliye ve yer savunması ek kontrolleri.
- Tam kayıp gerçek gemi sayısıyla; ≥%90 kayıp hem sayı hem gemi yapım değeriyle
  ölçülür. Yer savunması ve nakliye, savaş gemisi kaybıyla karıştırılmaz.
- Kaçış açık, yeterli yakıt. Kaçan gemiler kayıp sayılmaz. 3,5 altındaki temel
  hücrelerde kaçış beklenmez.
- Savaş sonucu etiketi, hayatta kalmakla eş tutulmaz; karşılıklı imha ayrı sayılır.
- OGame için üçüncü taraf simülatörün sürümü, girdileri ve sınırlılıkları saklanır.

## Doğrulama ve risk

Önce ölçüm yardımcıları için bütçe, sıfır filo, eşik, nakliye/yer ayrımı,
karşılıklı imha ve kaçış regresyonları yazılıp FAIL gözlenir; sonra yardımcılar
tamamlanıp PASS doğrulanır. Oyun motorunun ilgili mevcut testleri de çalıştırılır.
Yeni araç yalnız kuralları okur; veritabanına, oyun sabitlerine veya sunucu
yerleşim koduna yazmaz.

## Sonuç: Astera

163.200 savaş çözüldü: 115.200 temel matris, 38.400 ek kontrol, 9.600 tam
oranlı aynı bileşim karşılaştırması. Her hücre 100 farklı tohumla çalıştı.
Bu sayılar canlı oyuncu savaşlarının oranı değildir.

Temel matris: sağlıklı savaş gemileri, iki tarafta Power/Armor 2, kalkan ve
yer savunması yok. Dört seviye, dört tek tip filo ve iki karma filo, tüm 6×6
eşleşmeler, iki büyüklük. Her satır 28.800 savaş.

| Hedef saldıran/savunan değeri | En az bir taraf tamamen yok | İki taraf tamamen yok | En az bir taraf ≥%90 gemi kaybı | Savunan tamamen yok |
| --- | ---: | ---: | ---: | ---: |
| 1:1 | %39,34 | %2,73 | %52,16 | %20,81 |
| 1,5:1 | %78,86 | %0 | %88,07 | %73,36 |
| 2:1 | %94,44 | %0 | %95,95 | %94,44 |
| 3:1 | %100 | %0 | %100 | %100 |

**Tam sayı etkisi:** bu tablodaki oranlar hedef bütçe oranlarıdır. Gerçekleşen
oran aralıkları sırasıyla 0,911–1 / 1,415–1,5 / 1,912–2 / 2,908–3.
Gemi paketini aşağı yuvarlama saldıranı biraz küçültür. Eşitlik hakkında kesin
çıkarımlar aşağıdaki yuvarlamasız deneyden yapılır.

Tam oranlı deneyde savunanın filo tarifindeki her ağırlık 100 gemidir; saldıran
bunu tam 1 / 1,5 / 2 / 3 ile çarpar. Dolayısıyla aynı bileşimde gemi sayısı,
yapım değeri, toplam ATK ve toplam HP oranlarının hepsi hedef oranı karşılar.

| Tam oran, T1–T4 aynı bileşim | Bir taraf tamamen yok | İki taraf tamamen yok | Savunan ortalama gemi değeri kaybı |
| --- | ---: | ---: | ---: |
| 1:1 | %16,67 | %16,38 | %74,43 |
| 1,5:1 | %81,33 | %0 | %97,34 |
| 2:1 | %100 | %0 | %100 |
| 3:1 | %100 | %0 | %100 |

Her satır 2.400 savaş, altı bileşim eşit ağırlıkta. Özellikle:

- T3/T4'te aynı karma bileşimlerin 1:1 savaşlarında **0/400 tam imha** var;
  buna rağmen saldıran ortalama %80,38, savunan %80,99 gemi değeri kaybediyor.
- Aynı karma filoların 1,5:1, 2:1 ve 3:1 karşılaşmalarında savunan
  **her oran için 400/400** kez tamamen yok oluyor.
- Pike/Talon/Ballista/Cataclysm tek tip filolarının 1:1 savaşlarında en az
  bir taraf **400/400**, iki taraf **393/400 (%98,25)** kez yok oluyor.
  Hepsi ilk turda bitiyor. Dolayısıyla “eşit her filo mutlaka silinir”
  yanlış; Lance/Striker aynalarında karşılıklı imha çok belirgin.

### Ek kontroller

T3/T4, iki karma bileşimin bütün 2×2 eşleşmeleri ve iki büyüklük, her oran
için 1.600 örnek:

- Aegis 6 (1.139 HP) veya 10 (5.767 HP) eklemek, 1,5:1 ve üzerindeki
  savunan savaş gemilerinin %100 tam imha oranını bu matriste değiştirmedi.
  Bu, her büyüklükte ve her seviyede kalkanın etkisiz olduğu anlamına gelmez.
- Savunan Power/Armor 5, saldıran 2 olsa da bu karma filo setinde 1,5:1 ve
  üzerindeki tam imha oranı %100 kaldı.
- Başlangıç savaş gemisi sayısının %10'u kadar nakliye eklenince, 1,5:1'de
  savaş gemilerinin tamamı her denemede yok oldu; **nakliye dahil bütün
  mobil filonun** tam imhası %81,88 oldu. 2:1 ve 3:1'de bu da %100.
- Aktif yer savunması ek kontrolünde saldırı bütçesi **filo + topların**
  değerine göre yeniden ayarlandı. Sonuç, aynı saldırıya ücretsiz top
  eklemenin etkisi diye yorumlanmamalı.
- Kaçış açık ve yakıt yeterli olmasına rağmen, incelenen oranlar 3,5'in
  altında olduğu için hiçbir örnekte kaçış olmadı.

## Sonuç: OGame / TrashSim

[TrashSim'in yayımlanmış kaynak kodu](https://github.com/klaasvp/trashsim-public)
yerelde çalıştırıldı; savaş algoritması yeniden yazılmadı.
Kaynak commit: `6358da5ef43bc3d662d106933ba70595756457c3`.
Motor, V7 birim tablosunu kullanan yayımlanmış klasik JavaScript sürümüdür.
Güncel kapalı Gameforge sunucusuyla birebir eşitlik iddiası yoktur.

16.000 savaş: 80 hücre × 200 tohum. Altı tek tip filo, iki karma filo ve
Light Fighter/Cruiser/Battleship/Battlecruiser arasındaki farklı eşleşmeler.
Araştırmalar iki tarafta 10/10/10; rapid fire ve gemi kalkanları açık.
Sınıf/lifeform bonusları, kaçış, Space Dock ve hurda gelirleri dahil değil.
Astera ile farklı kataloglar kullanıldığı için iki matrisin toplam yüzdeleri
evrensel bir “hangi oyun daha ölümcül” skoru olarak karşılaştırılmamalı.

**Aynı bileşimli filoların sonuçları** (oranlar tam):

| Savunan / oran | Savunanın ortalama gemi değeri kaybı | Savunan tamamen yok olan deneme |
| --- | ---: | ---: |
| 500 Battleship, 1:1 | %84,71 | 0/200 |
| 500 Battleship, 1,5:1 | %100 | 200/200 |
| 500 Battleship, 2:1 | %100 | 200/200 |
| 500 Battleship, 3:1 | %100 | 200/200 |
| 500 Battlecruiser, 1:1 | %44,39 | 0/200 |
| 500 Battlecruiser, 1,5:1 | %99,998 | 198/200 |
| 1.000 LF + 100 Cruiser + 100 Battleship, 1:1 | %60,92 | 0/200 |
| Aynı karma filo, 1,5:1 | %100 | 200/200 |
| 1.000 LF + 100 Battlecruiser + 100 Destroyer, 1:1 | %30,98 | 0/200 |
| Aynı karma filo, 1,5:1 | %98,18 | 10/200 |

İncelenen sekiz aynı-bileşim filosunun **hepsi**, 2:1 ve 3:1'de bütün
denemelerde tamamen yok oldu. 1:1'de ise bu sekiz filoda hiç tam imha
olmadı. Farklı bileşimler arasında 1:1 kaynak değerinde bile tam imha var:
kaynak değerlerinin eşitliği eşit savaş yeteneği değildir.

**Gemi sayısı ve yatırım kaybı farklıdır:** LF/Cruiser/Battleship karma
filosunun 1:1 savaşında savunan gemilerinin %90,39'unu ama değerinin
%60,92'sini kaybetti. Küçük gemiler kaybın büyük bölümünü taşıdı. Aynı
ölçümü Astera için de hem sayıyla hem değerle raporladık.

### Gemi kalkanı sorusunun kontrollü deneyi

Kullanıcının ek sorusu üzerine **6.400 savaş daha** çalıştırıldı. Sekiz
aynı-bileşim senaryosunda sadece birimlerin kalkan değeri sıfırlandı.
Gemi sayıları, hull, silah, araştırma seviyeleri, rapid fire, tur sınırı ve
başlangıç rastgele tohumları aynı bırakıldı. Bu, OGame'in normal kuralı değil,
kalkan katkısını ayıran yapay bir deneydir. Kalkan değişince patlama ve hedef
akışı değiştiğinden aynı tohum aynı tekil hedef sırasını garanti etmez.

| Eşit filo (1:1), savunan | Normal kalkanlarla ortalama değer kaybı | Kalkanlar sıfırken |
| --- | ---: | ---: |
| Light Fighter | %77,97 | %81,42 |
| Heavy Fighter | %82,45 | %89,11 |
| Cruiser | %82,62 | %84,50 |
| Battleship | %84,71 | %90,40 |
| Battlecruiser | %44,39 | %76,63 |
| Destroyer | %85,37 | %91,51 |
| LF + Cruiser + Battleship | %60,92 | %68,76 |
| LF + Battlecruiser + Destroyer | %30,98 | %44,05 |

**Kalkanın etkisi var ve bazı gemilerde büyük.** Battlecruiser aynasında
yaklaşık 32 yüzde puanlık kaybı engelledi. Fakat bütün sekiz filoda 2:1 ve
3:1 savunan tam imhası kalkan açıkken de kapalıyken de %100.

Önemli ölçüm tuzağı: LF/Battlecruiser/Destroyer karmasının 1,5:1 savaşında
kalkan, tam imha sıklığını **%99,5'ten %5'e** düşürdü. Buna rağmen savunanın
ortalama yatırım kaybı **%99,9983'ten ancak %98,175'e** indi. “Tam imha
azaldı” demek tek başına oyuncunun yeniden filo kurma sorununun çözüldüğünü
göstermez. Bu yüzden gemi değerinin kaybı ve ≥%90 kayıp da incelenmelidir.

## Mekanik açıklaması ve sınır

Koddan doğrulanan mekanikler:

1. Astera'da hasar hedef tiplerinin HP payına dağıtılır; tipin aldığı hasar
   o tipteki gemileri sırayla öldürür ve kalan hasar taşınır. Hasarın 100
   gemiyi biraz yaralaması yerine çoğunlukla bir kısmını tamamen yok
   etmesi söz konusudur. Sağlıklı aynı-tip grupta kalan kesirli yara tek
   gemide kalır.
2. Ateş eşzamanlıdır. Bir turda yok olan gemi de o turun başındaki ateşini
   verir. Lance/Striker ATK/HP oranı yaklaşık 1,08–1,11 olduğundan
   aynalarda ilk tur karşılıklı imha anlaşılır bir sonuçtur. Güncel
   Cataclysm 816 ATK / 754 HP'dir; eski katalog literal değerleri yerine
   `profileHull` sonrasındaki gerçek değerler ölçüldü.
3. Kayıp arttıkça sonraki turun ateşi azalır. Üstün taraf karşı tarafın
   ateşini daha erken düşürür. Bu, her iki motorda da sayısal üstünlüğü
   tam imhaya dönüştürebilir.
4. Astera üç turla sınırlıdır, fakat savaş sırasında kayıp yüzdesine bağlı
   çekilme yoktur. 3,5 eşiği savaş öncesindeki ayrı kontroldür.
5. TrashSim/OGame gemi bazında hedef seçer, ayrı kalkan tutar ve her tur
   yaşayan gemilerin kalkanını yeniler. Hull hasarı savaşın sonraki turuna
   kalır; düşük HP'de patlama olasılığı ve rapid fire da vardır. Savaş
   altı turla sınırlıdır. Kaynak: yayımlanmış `party.class.js`,
   `simulator.js`; ayrıca
   [OGame ACS rehberi](https://board.en.ogame.gameforge.com/index.php?thread/810306-guide-07-acs-guide/).

Bu deney henüz herhangi bir yeni Astera denge ayarını kabul etmiş değildir.
Tam imhanın hangi aralıkta kabul edilebilir olduğu tasarım kararıdır;
deney yalnız mevcut modelin sonuçlarını ortaya koyar.

## OGame kayıptan sonra ve önce ne yapıyor?

- **Fleetsave:** çevrimdışıyken filoyu uçuşta tutup dönüşünü çevrimiçi
  zamana denk getirme. Risk tamamen bitmez; dönüş yakalanabilir.
- **Tactical retreat:** koşullu ve başlangıç korumasıyla sınırlı; gelişmiş
  her hesabın her kaybını engelleyen genel bir sigorta değildir.
  [Gameforge forumundaki fleetsaving rehberi](https://board.en.ogame.gameforge.com/index.php?thread/810303-guide-04-fleetsaving-guide/).
- **Space Dock / Wreck Field:** yok edilen filonun bir bölümünü geri
  hizmete alma. Rehber onarımın en fazla 12 saat sürmesini ve enkaz
  oluşumundan itibaren 72 saat içinde başlatılmasını anlatıyor. Pay,
  dock seviyesi ve evrenin debris ayarına bağlıdır; sabit “herkes %X
  geri alır” denemez.
  [Wreck Fields rehberi](https://board.en.ogame.gameforge.com/index.php?thread/813013-guide-18-wreck-fields/),
  [Gameforge açıklamasını aktaran yetkili yanıtı](https://board.en.ogame.gameforge.com/index.php?thread/830545-what-defines-wreckage-field-percentage/).

Astera'da mevcut gemi onarımı sağ kalan hasarlı gemileri onarır; yok olan
mobil filoyu geri getirmez. Yer savunmasının %60 yeniden inşası ayrı bir
mekaniktir. Mobil gemi enkazının %30'u herkese açık hurdaya gider;
savunana özel gemi iadesi değildir. Toparlanma kalkanı sonraki saldırıları
engelleyebilir, fakat ilk saldırıda yok olan gemileri geri getirmez.

## Tekrarlanabilirlik

Ham girdiler, her hücrenin sayaçları, katalog ve kaynak dosya hash'leri:

- [Astera ham sonuçları](evidence/combat-attrition-astera-2026-10-20.json)
- [TrashSim ham sonuçları](evidence/combat-attrition-ogame-2026-10-20.json)
- [TrashSim kalkanlar sıfırken](evidence/combat-attrition-ogame-no-shields-2026-10-20.json)

```bash
nice -n 10 node --max-old-space-size=4096 --import tsx tools/combat-attrition-audit.mjs --run
git clone https://github.com/klaasvp/trashsim-public.git /tmp/astera-trashsim-audit
git -C /tmp/astera-trashsim-audit checkout 6358da5ef43bc3d662d106933ba70595756457c3
TRASHSIM_SOURCE=/tmp/astera-trashsim-audit nice -n 10 node --max-old-space-size=4096 --import tsx tools/ogame-attrition-audit.mjs --run
TRASHSIM_SOURCE=/tmp/astera-trashsim-audit nice -n 10 node --max-old-space-size=4096 --import tsx tools/ogame-attrition-audit.mjs --run --no-shields --mirrors-only
```

Doğrulama: ölçüm araçlarının 11 testi geçti (kalkan izolasyonu dahil);
mevcut combat/escape/maintenance/HP paketinin 116 testi geçti. Yeni araçların
hedefli lint kontrolü geçti. Üç ham sonuç dosyasında toplam örnek sayıları,
tek/çift imha birleşimleri ve sayaç sınırları ayrıca kontrol edildi.
Oyun davranışı değiştirilmedi; bütün depo için `pnpm verify` çalıştırılmadı.
