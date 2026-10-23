# Rastgele hasar dağıtımı: simülasyon sonuçları — 23 Ekim 2026

**Durum:** Yalnız simülasyon. Canlı savaş kodu, veritabanı ve deploy değiştirilmedi.
Onaylanan davranış: [karar kaydı](combat-random-distribution-decision-2026-10-23.md).

## Kapsam ve yöntem

- Canlı sürüm temeli: `4d58d123b0483ae00f2d77110f18c6898ba7ed18`.
- Gerçek resolver kopyalanıp yalnız atış dağıtımı değiştirildi. Kopyanın değişmemiş sürümü canlı Vantasia savaşının üç turunu ve hasarlarını birebir üretti.
- Her atışın temel hasarı, bütün uygun hedeflere bağımsız Uniform(0,1] ağırlıkları toplamına oranlanarak dağıtıldı. Her atışta yeni ağırlıklar kullanıldı. Bu, rastgele dağılım için seçilen simülasyon yöntemidir; farklı ağırlık dağılımları farklı istatistikler üretebilir.
- Sınıf çarpanı hedef payına bir kez uygulandı. Öldürülen hedeften artan hasar temel hasar birimine çevrilip yeniden dağıtıldı; sınıf değişiminde hasar üretilmedi.
- Silahlı hedefler bitene kadar kargo ve Hurdacı korunur. Son silahlı hedef öldüğünde aynı atışın artanı ve sonraki atışlar desteğe gider. Mevcut sınıf çarpanının SUPPORT hedeflerine 1,6 olması da korundu.
- Üç tur, eşzamanlı ateş, mevcut ±%8 atış değişkenliği, kalıcı yaralar, yenilenmeyen kalkanlar ve mevcut tur sonu kaçış ayarları korundu. Kaçış yalnız ilk iki turun sonunda.
- Güç oranı başlangıçtaki silahlı kaynak değeriyle hesaplandı; araştırma seviyeleri iki tarafta eşit. İlk profil araştırmasız; ikinci profil yalnız Gemi Kalkanları 4 (kişisel kalkan %25 → %50). Gemi Gücü ve Gemi Zırhı ana matriste 0. İki tarafın Güç/Zırh seviyelerinin birlikte 5 olması, bu mobil/Aegis'siz düzende saldırı ve canı aynı oranda artırır; fiziksel sonuç eşliği ayrıca test edildi. Araştırma farkı bu eşliğe dahil değildir.
- Beş kompozisyon: yalnız Ok, yalnız Korsan, yalnız Kıyamet, yalnız Kale, eşit sayıda Korsan + Kıyamet. Ölçek 2/10/50/200; karma filoda gemi sayısı ölçeğin iki katı. İki yön de ölçüldü: güçlü taraf saldıran ve güçlü taraf savunan.
- Ana matris 400 senaryo: 119.000 yeni model savaşı + aynı tohumlarla 119.000 mevcut model savaşı. Küçük/orta senaryolarda 500, ölçek 50 için 150, ölçek 200 için 40 tekrar. Aşağıdaki ortalamalarda her senaryo eşit ağırlıktadır; bunlar canlı oyuncu filosu dağılımı değildir.
- Ek olarak Vantasia dizilimi 1.000 tohumla iki modelde ve gerçek görev tohumu yeni modelde çalıştırıldı. Beş örnek savaş kaydı üretildi. Odak kontrolleri 14 senaryo × 1.000 tekrar × 2 model + 14 örnek savaş: toplam 28.014 ek savaş hesabı.
- Yerelde tek süreç, bir CPU kotası, 2 GiB toplam bellek sınırı, swap yok, 1536 MiB heap ve tek V8 worker havuzu kullanıldı. İlerleme kayıtlarında en yüksek gözlenen RSS yaklaşık 215 MiB; ana çalışma yaklaşık 165 saniye sürdü.
- Ana matriste gezegen Aegis’i, yolculuk ve radyasyon kaynaklı sonraki ölümler, tamir/yağma/Dominion yazımları yok. Vantasia tekrarında mevcut 150 Aegis dahil. 4× savaş öncesi otomatik filo kaçışı ana 1–3× matrisini kapsamıyor; Vantasia tekrarında zaten çalışmamıştı.
- **Tamamen silinme:** kaçanlar dahil fiziksel olarak sağ kalan hiç mobil gemi olmaması. Aktif filonun bitmesi ve yalnız savaş gemilerinin bitmesi ham veride ayrı alanlardır. Yer savunması yeniden kurulması sağ kalan filo sayılmaz.
- Tablolardaki kaçış ve sağ kalma, her tarafın kendi başlangıç gemi sayısının yüzdesidir. Kaçış hücreleri uygun yaralı geminin koşullu kaçış ihtimali değildir. Eşit güçte Z/G yalnız iki tarafı ayırt eden etiketlerdir.

## Korunan kaçış ayarları

| Büyük/küçük güç | Zayıf: şans / can eşiği | Güçlü: şans / can eşiği |
|---|---|---|
| 1–<1,5 | %25 / ≤%25 | %25 / ≤%25 |
| 1,5–<2 | %33 / ≤%30 | %20 / ≤%30 |
| 2–<3 | %55 / ≤%55 | %15 / ≤%30 |
| ≥3 | %70 / ≤%70 | %10 / ≤%25 |

## Kalkan araştırması 0: başlangıç kişisel kalkanı %25

Z/G = güçsüz / güçlü taraf. Tam silinme sütunu, en az bir tarafın hiç fiziksel sağ kalanı kalmayan savaşların oranıdır.

| Güç oranı | 1. tur kaçış Z / G | 2. tur kaçış Z / G | Güçsüz sağ kalan | Tam silinme eski → yeni |
|---|---|---|---|---|
| 1:1 | 3,1% / 3,1% | 0,6% / 0,7% | 65,2% | 4,4% → 24,5% |
| 1:1,5 | 3,0% / 0,2% | 0,9% / 0,2% | 43,1% | 10,6% → 30,1% |
| 1:2 | 2,7% / 0,0% | 30,2% / 0,0% | 33,5% | 26,5% → 34,8% |
| 1:2,5 | 8,1% / 0,0% | 10,7% / 0,0% | 18,8% | 33,7% → 51,4% |
| 1:3 | 39,9% / 0,0% | 0,3% / 0,0% | 40,2% | 44,1% → 41,7% |

## Kalkan araştırması 4: başlangıç kişisel kalkanı %50

Z/G = güçsüz / güçlü taraf. Tam silinme sütunu, en az bir tarafın hiç fiziksel sağ kalanı kalmayan savaşların oranıdır.

| Güç oranı | 1. tur kaçış Z / G | 2. tur kaçış Z / G | Güçsüz sağ kalan | Tam silinme eski → yeni |
|---|---|---|---|---|
| 1:1 | 0,5% / 0,5% | 2,0% / 2,0% | 63,2% | 11,3% → 23,2% |
| 1:1,5 | 0,5% / 0,0% | 0,0% / 0,1% | 59,6% | 25,6% → 34,7% |
| 1:2 | 8,7% / 0,0% | 20,7% / 0,0% | 48,4% | 28,1% → 24,3% |
| 1:2,5 | 0,8% / 0,0% | 29,1% / 0,0% | 30,0% | 27,5% → 41,6% |
| 1:3 | 16,1% / 0,0% | 13,4% / 0,0% | 29,5% | 32,1% → 44,2% |

## Gemi türüne göre kritik ayrışma

| 1:3, kalkan araştırması 0 | En az bir taraf tamamen silindi | Güçsüz tarafta sağ kalan |
|---|---|---|
| Ok | 2,9% | 69,1% |
| Korsan | 2,7% | 69,3% |
| Kıyamet | 100,0% | 0,0% |
| Kale | 2,7% | 62,4% |
| Korsan + Kıyamet | 100,0% | 0,0% |

- Hasarın yayılması ve artanın aktarılması, az sayıdaki ağır geminin çok sayıda hafif hedefi temizlemesini sağlıyor. Buna karşılık eski tek-hedef modelinin boşa giden hasar nedeniyle sağladığı örtük koruma kalkıyor; toplam sıfırlanma birçok senaryoda artıyor.
- Güçsüz saf Kıyamet tarafı 1:2 ve üzerinde bu örneklemde tamamen silindi. Yüksek ilk tur hasarı, zayıf tarafı tur sonu kaçışından önce öldürüyor. Kaçış olasılığı sadece turu sağ bitiren uygun yaralılara uygulanır.
- Eşit güçte saf Kıyamet savaşlarında kalkan 4, daha az fiziksel kurtulan üretebiliyor: ilk tur yarası kaçış eşiğine inmeyip ikinci tur ölüm gerçekleşebiliyor. Daha büyük kalkan otomatik olarak daha çok kaçış anlamına gelmiyor.
- 1:3, 1:2,5’ten daha çok gemi kurtarabiliyor. 3× sınırında zayıf tarafın can penceresi ≤%55’ten ≤%70’e, kaçış şansı %55’ten %70’e çıkıyor; daha çok gemi ilk tur kaçabiliyor. Bu, korunan kademeli politikanın sonucu.
- Genel ortalama, bazı kompozisyonların %100 silinmesini gizliyor. Oran tek başına sonuç tahmini sağlamaz; kompozisyon, gemi sayısı, can/atak ve kaçış turu birlikte değerlendirilmelidir.

## Somut tur kayıtları: Korsan, araştırma 0

Her satır ayrı bir örnek savaştır; istatistiksel ortalama değildir. Güçlü taraf saldıran, başlangıçta savunanda 20 Korsan var. Saldırandan bu örneklerde kaçan/ölen yok.

| Güç oranı | Saldıran / savunan | Savunan 1. tur kaçan | 2. tur kaçan | Ölen toplam | Aktif kalan | Fiziksel sağ kalan |
|---|---|---|---|---|---|---|
| 1:1 | 20 / 20 | 0 | 0 | 0 | 20 | 20 |
| 1:1,5 | 30 / 20 | 0 | 1 | 15 | 4 | 5 |
| 1:2 | 40 / 20 | 1 | 10 | 9 | 0 | 11 |
| 1:2,5 | 50 / 20 | 6 | 0 | 14 | 0 | 6 |
| 1:3 | 60 / 20 | 17 | 0 | 3 | 0 | 17 |

## Vantasia → uzayadam: aynı görev tohumu

- Giriş: saldıran 11 Kıyamet + 5 Korsan + 3 Kale + 5 Palatin + 1 Atlas; savunan 235 Ok + 15 Kirpi + 2 Kurye. Gerçek araştırmalar ve 150 Aegis kullanıldı.
- Eski motor/canlı kayıt: 70 Ok + 2 Kirpi öldü; kaçış yok; REPELLED.
- Yeni dağıtım, aynı görev tohumu: 1. tur 106 Ok öldü, 39 Ok kaçtı. 2. tur kalan 90 Ok + 15 Kirpi + 2 Kurye öldü. Üçüncü tur gerekmedi.
- Yeni dağıtım sonucu DECISIVE; saldıranın 25 gemisi de sağ ve gövde hasarsız. Savunanın fiziksel sağ kalanı 39 kaçmış Ok. Aktif savunma kalmadığı için kaçanlar kesin zaferi engellemedi.
- Aynı başlangıcın 1.000 farklı tohumunda yeni model 1.000/1.000 DECISIVE üretti. Savunanın fiziksel olarak tamamen silindiği örnekler %22,4; ortalama mobil sağ kalan oranı %9,03. Bu, gelecekteki her tohum için kesinlik iddiası değildir.

## Kargo ve Hurdacı / anıt odak kontrolleri

Kontrol sonucu, aynı hasar/kaçış sonucuna mevcut anıt kontrol kuralının uygulanmasıdır. Anıt radyasyonu/yolculuk/persistence bu çalışmada yoktur. Her satır 1.000 tohum.

| Senaryo, kalkan araştırması 0 | Anıt saldırana geçti | Savunan fiziksel sağ kalan |
|---|---|---|
| 2 Korsan → 1 Korsan | 100,0% | 57,2% |
| 3 Korsan → 1 Korsan + 1 Argosi | 100,0% | 44,5% |
| 5 Korsan → 2 Korsan | 100,0% | 23,9% |
| 4 Ok → 2 Kargı + 1 Kurye | 100,0% | 24,1% |
| 1 Korsan → 10 Ok | 100,0% | 12,1% |
| 6 Korsan + 2 Kurye + 2 Hurdacı → 2 Korsan + 2 Kurye + 2 Hurdacı | 100,0% | 21,8% |
| Yalnız kargo + Hurdacı | 0,0% | 100,0% |

Yalnız kargo/Hurdacı olan iki taraf ateş etmedi, hiç gemi ölmedi ve savunan anıtı korudu. Hurdacı’nın silahlı hedefler ayaktayken hasar almaması ve son silahlı hedef öldüğü atışta hasar alabilmesi ayrıca birim testleriyle doğrulandı.

## Doğrulama ve tekrar çalıştırma

- 25 odak testi ve yeni araçların lint kontrolü geçti: hasar korunumu, bütün hedeflere dağılım, karma sınıf çarpanları, kargo/Hurdacı koruması, aynı atışta taşma, Aegis ve Nullifier, kalkanın yenilenmemesi, eşzamanlı ölüm, kaçanların tekrar hedef olmaması, üçüncü tur kaçışı olmaması, ortak/destekli filo fiziksel sonuç eşliği ve rapor metrikleri.
- Ham 400 senaryonun sonuçları ayrıca bağımsız hesapla kontrol edildi: fiziksel sağ kalan + ölü = başlangıç; aktif + kaçan = fiziksel sağ kalan; sonuç kategorileri toplamı 1.
- Ana matristeki tek bir senaryonun örneklem büyüklüğü 40–500 arasındadır; özellikle büyük filolarda nadir olayların yokluğu sıfır olasılık kanıtı değildir.
- Model yalnız araştırma aracıdır; uygulama veya deploy değildir. Kazanma/kaçış eşikleri ve gemi istatistikleri bu çalışma için kalibre edilmedi.

Kod ve tekrar çalıştırma araçları `study/random-distribution-20261023` dalında,
`/home/yildirim/Desktop/Coding/MyProjects/blindspace-random-distribution` çalışma
dizinindedir. Komutlar bu dizinde, bağımlılıklar kuruluyken çalıştırılır.

```bash
systemd-run --user --scope -p MemoryMax=2G -p MemorySwapMax=0 -p CPUQuota=100% nice -n 10 node --v8-pool-size=1 --max-old-space-size=1536 --import tsx --test --test-concurrency=1 tools/distributed-damage-model.test.mjs tools/distributed-damage-study.test.mjs
systemd-run --user --scope -p MemoryMax=2G -p MemorySwapMax=0 -p CPUQuota=100% nice -n 10 node --v8-pool-size=1 --max-old-space-size=1536 --import tsx tools/distributed-damage-study.mjs --trials=500 --large-trials=150 --huge-trials=40
systemd-run --user --scope -p MemoryMax=2G -p MemorySwapMax=0 -p CPUQuota=100% nice -n 10 node --v8-pool-size=1 --max-old-space-size=1536 --import tsx tools/distributed-damage-study.mjs --focused
```

Ham veriler: [ana matris](evidence/distributed-damage-study-2026-10-23.json), [odak kontrolleri](evidence/distributed-damage-focused-2026-10-23.json).
