# Dört tur savaş denemesi — 23 Ekim 2026

**Kullanıcı talebi:** Mevcut üç tura karşı dört turu simüle et. Dört turda
kaçış son tur hariç **1., 2. ve 3. turun sonunda** olsun (kullanıcı ayrıca seçti).
Bu onay yalnız deneme kapsamındadır; canlıya uygulama/deploy yapılmaz.

## Sabitler ve kapsam

- Onaylanan bütün uygun hedeflere rastgele dağıtım ve aynı atışta artan hasarın
  aktarılması korunur. Kargo ve Hurdacı silahlı birlikler bitene kadar korunur.
- Can/atak, araştırma, kalkan, mevcut güç basamakları ve kaçış yüzdeleri aynı.
  Önceki `targeted` önerisi kullanılmaz; son açıklanan sağ kalma hedefi ölçülür.
- Üç turda yalnız tur 1/2 sonunda; dört turda yalnız tur 1/2/3 sonunda kaçış.
  Kaçış ölü gemiyi kurtaramaz, son turda ek kaçış veya iyileşme yok.
- Ana değişiklikler yalnız simülasyon motoruna tur parametresi, özetlere üçüncü
  tur kaçışını sayma desteği, yeni deney aracı/testleri ve bu rapor/verilerdir.
  Üçüncü tur kaçışını özet dışında bırakmak fiziksel/aktif korunumu bozar;
  önce bunun için test yazılır. Varsayılan üç turluk özetler değişmemeli.
- İki model aynı filo/tohumlarla karşılaştırılır; dört turun ilk iki turu
  üç turla atış/ölüm/kaçış açısından birebir aynı olmalıdır.
- Tek CPU, 2 GiB toplam bellek sınırı, swap yok; heap 1536 MiB. Ağ/DB/deploy yok.

## Küçük filo düzeltmesi

Kullanıcı ayrıca tek gemiye %10–30 filo kurtarma hedefi uygulanamayacağını
belirtti. Bu doğrudur: bir gemi için fiziksel sonuç 0 veya 1'dir. 3 Kıyamet →
1 Kıyamet'in öldürmesi normal bir kontrol durumudur; tek başına denge hatası
veya kurtarılması gereken durum olarak kullanılmaz.

Ana denge matrisi bu nedenle 20/50/100/200 ölçeği kullanır; bir gemilik testler
başarı ortalamasına katılmaz. Karma profilde ölçeğin her iki türünden bulunduğu
ayrıca belirtilir. Eski 2/10/50/200 matrisinin ortalamasıyla bu yeni matrisin
ortalaması doğrudan kıyaslanmaz; üç ve dört tur bu yeni matrisin aynı tohumlarında
karşılaştırılır.

Ana karşılaştırmanın üç turluk tarafı da onaylanan **yeni hasar dağıtımını**
kullanır. Canlıdaki tek hedef atışı ile yeni dağıtımı aynı anda değiştiren bir
karşılaştırma değildir; yalnız tur sayısı ve son tur öncesi kaçış penceresi ayrılır.

## Dört tur sonuç kaydı

400 büyük-filo senaryosu, aynı tohumlarda 38.000 üç tur + 38.000 dört tur savaşı; ayrıca 24 örnek hesap. 20/50/100/200 ölçek; beş kompozisyon, kalkan 0/4, iki yön ve beş güç oranı. Yaklaşık 296,5 saniye, gözlenen RSS 208 MiB; 2 GiB ve bir CPU kotası altında.

| Kalkan araştırması 0 | Güçsüz fiziksel sağ kalan: 3 → 4 tur | Güçlü fiziksel sağ kalan: 3 → 4 tur |
|---|---|---|
| 1:1 | %65.9 → %65.7 | %65.7 → %65.6 |
| 1:1.5 | %45.9 → %18.5 | %100.0 → %100.0 |
| 1:2 | %34.8 → %34.8 | %100.0 → %100.0 |
| 1:2.5 | %17.8 → %17.8 | %100.0 → %100.0 |
| 1:3 | %41.4 → %41.4 | %100.0 → %100.0 |

Eşit güçte etiketler yalnız iki tarafı ayırt eder; güçsüz taraf yoktur. Dört turda Korsan fiziksel sağ kalması iki tarafta yaklaşık %99,7, Kale %100 kaldı. Kullanıcı Kale hesabını sorguladı; bağımsız tek-gemi hesabı, 20-gemi eşit pay ve gerçek rastgele 20-gemi resolver bütçesiyle dört tam tur ve biriken hasar doğrulandı.

Kale atak 445, can 2158, kalkan 539,5: dört nötr ortalama atış toplam 1780, can+kalkan 2697,5. Kalan gövde canı 917,5; bu sayı gemi sağ kalma yüzdesi değildir. Kalkanın yenilenmesi veya hasarın unutulması bulunmadı.

Kullanıcı daha sonra altı tur istedi ve kaçış şansının güç farkına göre can pencereleri üzerinden kalibre edilmesini vurguladı. Sonraki çalışma [altı tur kalibrasyonu](combat-six-rounds-calibration-2026-10-23.md) olarak devam eder; bu rapor dört tur denemesinin kaydıdır.

[Ham dört tur verisi](evidence/combat-four-rounds-study-2026-10-23.json).
