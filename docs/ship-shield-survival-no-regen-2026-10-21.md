# Yenilenmeyen kalkanla filo sağ kalımı — 21 Ekim 2026

359.424 savaş, 1.620 senaryo. Üretimdeki `d35951719c07b336c6da5526674aad08e24b86dd` ile dokuz ilgili kural kaynağının birebir eşitliği doğrulandı. İzole ve ağsız Node 22.23.3 imajında gerçek `resolveBattle` çalıştırıldı. Canlı veriye erişilmedi; oyun kodu veya denge değiştirilmedi.

## Tanımlar ve kapsam

- Oran küçük:büyük filodur. Aynı bileşimde tam gemi adedi/güç oranı; farklı bileşimde oyunun silahlı filo güç/maliyet hesabı (`combatValue`) kullanılır. Farklı bileşimde tam gemilere aşağı yuvarlama nedeniyle gerçek oran hedefin %98,03–%100 aralığındadır.
- “Daha çok kaybeden” iki tarafın **başlangıç savaş gemisi adedine göre daha düşük sağ kalan yüzdesi** olan taraftır; eşitlikte aynı oran alınır. Bu, kontrol veya ganimet derecesiyle tanımlanan kazanan değildir. Üç tur sonunda iki taraf da kalabilir.
- Sağ kalma ihtimali, bu tarafta en az bir savaş gemisinin kalmasıdır; eşdeğer olarak hiçbir tarafın bütün savaş gemilerini kaybetmemesidir. Tam silinme bunun tümleyenidir. Sağ kalan gövdesi pozitif yaralı gemiler dahildir.
- Ortalama kalan, bütün örneklerin ortalamasıdır: tamamen silinen örnekler **0** sayılır. Yalnız sağ kalınan örneklerdeki ortalama ayrı hesaplanır. Bu bir gemi adedi oranıdır; kalan toplam HP oranı değildir.
- Ana gruplar: sağlıklı filolar, iki tarafta Güç/Zırh 2, aynı kalkan araştırması, üç tur, ±%8 atış. Kargo, Aegis, yer savunması, başlangıç yarası veya araştırma farkı ana ortalamalara katılmaz. Bunların bazıları ayrı kontrollerdedir.
- Ana tablo aynı kademede altı bileşimin bütün 6×6 eşleşmelerini dört kademede tarar. Temel küçük filo bütçesi 1 milyon; iki kalkan seviyesi × üç oran × 144 eşleşme × 128 tohum = **110.592 savaş**.
- Bileşimler eşit ağırlıklıdır; bunlar **kontrollü senaryo ortalamalarıdır, canlı oyuncu savaşlarının sıklık tahmini değildir**. %0/%100 sonlu örneklerde gözlenendir; her farklı savaş için garanti değildir.

## Farklı bileşimler: ana sonuç

| Oran | İki taraftaki kalkan seviyesi | En az bir gemi kalma | Ortalama kalan | Tam silinme | Sağ kalınanlarda ortalama kalan |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1:1 | 0 | %85,21 | %38,38 | %14,79 | %45,04 |
| 1:1 | 4 | %100,00 | %54,78 | %0,00 | %54,78 |
| 1:2 | 0 | %50,46 | %11,68 | %49,54 | %23,15 |
| 1:2 | 4 | %80,49 | %29,30 | %19,51 | %36,40 |
| 1:3 | 0 | %13,08 | %1,97 | %86,92 | %15,04 |
| 1:3 | 4 | %46,32 | %9,58 | %53,68 | %20,67 |

Araştırmasız 1:3 için önceki yaklaşık %50 silinme / %10 kalan hedefi sağlanmıyor: silinme %86,92, ortalama kalan %1,97. İki tarafın da kalkanı 4 olduğunda sonuç %53,68 silinme / %9,58 kalan ile hedefe yaklaşıyor.

## Aynı bileşim: bütün araştırma seviyeleri

24 bileşim (her kademede dört tek gemi tipi + iki karışım), küçük tarafta bileşim ağırlığı başına 100 gemi. Büyük taraf ×1/×2/×3. 360 senaryo × 512 tohum = 184.320 savaş.

| Oran | Kalkan seviyesi | En az bir gemi kalma | Ortalama kalan | Tam silinme |
| --- | ---: | ---: | ---: | ---: |
| 1:1 | 0 | %99,36 | %48,96 | %0,64 |
| 1:1 | 1 | %100,00 | %53,11 | %0,00 |
| 1:1 | 2 | %100,00 | %56,66 | %0,00 |
| 1:1 | 3 | %100,00 | %59,15 | %0,00 |
| 1:1 | 4 | %100,00 | %62,42 | %0,00 |
| 1:2 | 0 | %48,72 | %11,47 | %51,28 |
| 1:2 | 1 | %64,44 | %15,88 | %35,56 |
| 1:2 | 2 | %81,41 | %20,90 | %18,59 |
| 1:2 | 3 | %83,33 | %25,21 | %16,67 |
| 1:2 | 4 | %83,33 | %30,74 | %16,67 |
| 1:3 | 0 | %15,42 | %1,15 | %84,58 |
| 1:3 | 1 | %17,67 | %2,84 | %82,33 |
| 1:3 | 2 | %33,11 | %5,22 | %66,89 |
| 1:3 | 3 | %33,34 | %7,26 | %66,66 |
| 1:3 | 4 | %42,77 | %10,16 | %57,23 |

## Gemi türü ortalamayı güçlü biçimde değiştiriyor

Aşağıdakiler aynı tipte 100 geminin aynı tipte 300 gemiye karşı savaşı; 512 tohum, iki tarafta aynı araştırma.

| Gemi | Kalkan | Sağ kalma ihtimali | Ortalama kalan |
| --- | ---: | ---: | ---: |
| Korsan | 0 | %0,00 | %0,00 |
| Korsan | 2 | %99,02 | %6,16 |
| Korsan | 4 | %100,00 | %21,51 |
| Kıyamet | 0 | %0,00 | %0,00 |
| Kıyamet | 2 | %0,00 | %0,00 |
| Kıyamet | 4 | %0,00 | %0,00 |
| Kale | 0 | %100,00 | %10,51 |
| Kale | 2 | %100,00 | %28,07 |
| Kale | 4 | %100,00 | %39,92 |
| Palatin | 0 | %0,00 | %0,00 |
| Palatin | 2 | %0,00 | %0,00 |
| Palatin | 4 | %16,80 | %0,32 |

## Ek kontroller ve doğrulama

- Küçük filolar: bileşim ağırlığı başına 1/10 gemi, L0/L4; 288 × 128 = 36.864 savaş. Tek gemi bölünemediği için %0/%100 uçları daha belirgindir; ana büyük-filo ortalamalarıyla karıştırılmaz.
- Dördüncü kademede kalkan araştırması farkı, Güç/Zırh farkı, başlangıçta %50 yara ve %20 adet kargo: 108 × 256 = 27.648 savaş. 100 Korsan–300 Korsan L0 örneğine kargo eklenince savaş gemisi kalanı yine %0 iken toplam mobil gemi kalanı %16,67 olabilir. Bu nedenle kargo ana savaş gemisi sonucunu yükseltmek için kullanılmadı.
- Başlangıçta %50 yaralı 100 Korsan, 300 Korsana karşı L2/L2 iken örneklerde silindi; sağlıklı L2/L2 aynı örnekte ortalama %6,16 savaş gemisi bırakır.
- Ölçüm yardımcıları önce eksik modül hatasıyla FAIL, uygulama sonrası 5/5 PASS. Denominatörler, sıfırları içeren ortalama, koşullu ortalama, kargo ayrımı, tekrar üretilebilirlik ve gerçek üretim motoru kontrolü kapsanır.
- Bütün 1.620 satırda toplam örnek, olasılık tümleyeni ve koşullu ortalama tutarlılığı doğrulandı. Ayrı sağlıklı filo prototipiyle 285 savaşta iki tarafın bütün gemi tiplerindeki sağ kalanları birebir eşleşti.
- Tohumlar ve her senaryonun gerçek girdi/çıktı toplamları ham kanıttadır. Ekonomi/sezon/snowball simülasyonu yok.

[Ham sonuçlar](evidence/ship-shield-survival-no-regen-2026-10-21.json) · [Ölçüm aracı](../tools/ship-shield-survival-audit.mjs)
