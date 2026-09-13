# %25 ekonomi deneyi — 2026-09-13

Tarihsel deney: sahip bu ayarları sonradan %30 ile değiştirdi ve filo garnizonlarını
artırdı. Bu sayfa mevcut aday değildir; [güncel ölçüm](economy-experiment-30pct-2026-09-13.md).
Koloni kapısı da bu ölçümden sonra `9 / 12 / 15` olarak değişti; aşağıdaki Core 6
rotaları mevcut kuralla yerleşemez.

Baz: sahibin onayladığı yerel `147deca` checkpoint'i. Bu bir deneydir;
production deploy'u, sezon reset'i veya sezon güvenliği onayı değildir.

## Uygulanan değişiklikler

- Tüm uçan katalog gemilerinin mevcut alloy/crystal faturaları ×1,25;
  bileşenler yukarı yuvarlanır. Prospector, taşıyıcılar ve Garbage Collector dahil.
  Probe faturası da 50/30'dan 63/38'e çıktı. Gemi üretim D'si değişmedi.
- Alloy Refinery, Crystal Extractor ve Deuterium Plant'in her level'daki gerçek
  saatlik üretimi ×0,75. Tasarımın fiyat hesaplama referansı değiştirilmedi;
  bina, araştırma ve enstrüman faturaları otomatik ucuzlamadı.
- Bina, gemi/yer savunması, araştırma, uydu ve stratejik imalat süreleri ×1,25.
  Sekiz saatlik imalat tavanı da on saate çıktı; robot/tersane indirimleri korunur.
  Uplink 5→6,25 dk, Death Star 60→75 dk, Anti-Strategic 30→37,5 dk.
- Yer savunmasının ve stratejik silahların kaynak fiyatları artırılmadı:
  bunlar uçan gemi değildir. Uçuş, savaş, takviye ve toparlanma süreleri değişmedi.
  Tarafsız garnizonlar, kalkan seviyeleri, capture stock ve Core kapıları değişmedi.

Örnekler: Dart/Pike 300/60→375/75; Courier 600/150→750/188;
Garbage Collector 10.000/5.000→12.500/6.250. Donanım, hız ve cargo değişmedi.
Gemi imalat süresi yeni faturadan tekrar türetilmedi: zaman artışı yalnızca %25,
yanlışlıkla %56,25 değil.

## Değişmeyen ödüller ve türetilen etkiler

Zaten yarıya indirilmiş sezon ödül kesesi **22.743 A / 11.149 C / 0 D**;
ikinci kez yarıya indirilmedi. Akademi ödül telafisi **2.223 A / 1.089 C** kaldı.
Daha pahalı Akademi alışverişleri ve iki Dart'a bağlı başlangıç bütçesi nedeniyle
Akademi çıkışı kalan kaynak 2.518/1.691/46'dan **2.518/1.518/46** oldu.
Yeni ücretsiz telafi verilmedi; temel `PLANET_START` toplamı 1.500/400/50 kaldı.

Depo, WORKS ve korunan kaynak miktarları üretim saatleriyle tanımlandığından gerçek
kaynak kapasiteleri de %25 azaldı; saat cinsinden sınırlar değişmedi. Bu özellikle
tek siparişin finanse edilmesini etkiler: açılış alloy deposu 3.878 iken 12 Pike
faturası 4.500'dür. Pahalılaşan gemi değerinden türeyen sefer yakıtı da artabilir;
bu deneyde yakıt bedeli olağan servis üzerinden ödendi.

Core 2→6 kaynak toplamı değişmedi: **2.437 A / 657 C**.
Temel imalat toplamı 24,88→31,10 dakikaya çıktı.

## Eski 52,59 dakika rotasının gerçek sunucu ölçümü

`joinSeason`, gerçek seed 4242 geometrisi, build/probe/reward/attack/settlement
servisleri ve `EventWorker` kullanıldı. Tek hesap; ek kaynak/gemi, merchant,
başka oyuncu, gezegen taşıma veya madencilik geliri eklenmedi. Zaman yalnızca
normal üretim ve scheduled-event anlarına ilerletildi; oyun süreleri kısaltılmadı.

1. **Birebir eski politika başarısız:** 4,63 dakikada bankada 3.796 A bulunurken
   12 Pike 4.500 A ister. Servis `INSUFFICIENT_RESOURCES` döndürür.
2. **Yasal uyarlama:** aynı nihai ordu ve iki baskın korunur. Normal gelir toplanır;
   10 Pike 6,87 dakikada, birer Pike 79,62 ve 201,45 dakikada ücretle alınır.
   İlk baskın dönüş geliri Core'u finanse eder. Uzayan bekleme ilk claim'i
   geçirdiği için ikinci baskın Core 6 hazır olduktan sonraya alınır; normal boş
   dünya baskını yeni claim açar. Claim süresi veya oyun kuralı değiştirilmez.
3. Son adayın taze tam saldırgan test koşusunda koloni **258,31 dakika** sonra
   kuruldu: yaklaşık **4 saat 18 dakika**. Aynı son adayın ikinci taze koşusunda
   **265,79 dakika** (yaklaşık 4 saat 26 dakika) gözlendi. Ön ara adayda ayrıca
   271,31 dakika ölçüldü. Bunlar sabit süre/garanti/minimum değildir; savaşın ±%8 rastgeleliği
   sefer kimliğinden türediği için aynı sezon seed'i tek başına aynı sonucu vermez.

**Sonuç: bu üç ayar doğal 6 saat hedefini sağlamıyor.** Refineri yükseltme,
madencilik veya başkasının açtığı claim'i alma gibi başka yasal stratejilerin
daha hızlı olmayacağı da kanıtlanmadı. Bağımsız başkent testinde Core 6, ikinci
Courier ve erişilebilir üç ödül 31,13 dakikada hazır; founding alloy açığı yalnızca
61'dir. Bu bir solo garnizon temizleme rotası değildir.

Kanıt: [saldırgan sunucu testleri](../apps/server/test/snowball-audit.test.ts),
[bağımsız ekonomi kontrolleri](../packages/rules/test/economy-adjustment.test.ts).
Eski ucuz escort testi adayda daha erken kaynak yetersizliğine takılır;
beklenti gerçek hata koduna güncellendi, oyun davranışı değiştirilmedi.

## Teslim ve açık sınırlar

Bu aşamada yalnızca hedefli kontroller ve rules/server typecheck çalıştırıldı:
ekonomi/ödül 30/30, gerçek sunucu saldırgan regresyonları 8/8, ikinci taze
kolonileşme tekrarı 1/1 yeşil; rules/server typecheck exit 0, `git diff --check` temiz.
Checkpoint'in 5.647 testlik tam yeşil sonucu bu yeni aday için geçerli değildir.
Yeni tam test, filo kalibrasyonu ve adversarial rota taraması rollout öncesinde gerekir.
Push, deploy, sezon reset'i veya deney commit'i yapılmadı.

Doğrulanmış eski korsan tekrar-kese hatası hâlâ açık. Ayrıca fiyat artışı ayrı bir
korsan kalibrasyon sınırını etkiler: sabit `PIRATE_ADMISSION_PRICES` Dart'ı 300/60,
canlı aday 375/75 fiyatlar. Tablo artık bu gövdeyi maliyet üst sınırı olarak
kapsamaz; canlı değerden türeyen keseler de değişebilir. Dağılımı sessizce yeniden
indekslemek aktif sezon konumlarını değiştirir; burada yapılmadı. Bu gözlem tek
başına aylık toplam bütçenin aşıldığını kanıtlamaz, yeni kalibrasyon gerektirir.
