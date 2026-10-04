# Kazıcı hızının 2,5× artırılması — 4 Ekim 2026

İstek, büyüyen galakside Kazıcıların gidiş/dönüş uçuşunu hızlandırmak olarak
incelendi. Bu belge inceleme sonucudur; kaynak sabiti ve canlı hız değiştirilmedi.
Ekonomi simülasyonu ve snowball audit çalıştırılmadı.

## Sayısal etki

`PROSPECTOR.speed` şu anda 618,75. Tek hız sabiti 1.546,875 yapıldığında,
`prospectorSpeed` ve `prospectorReturnSpeed` mevcut çarpanları korur:

| Koşul | Şimdi | Önerilen | Birim |
| --- | ---: | ---: | --- |
| Gidiş / boş dönüş | 618,75 | 1.546,875 | oyun birimi/dakika |
| Yüklü dönüş | 309,375 | 773,4375 | oyun birimi/dakika |
| Matkap ile gidiş / boş dönüş | 928,125 | 2.320,3125 | oyun birimi/dakika |
| Matkap ile yüklü dönüş | 464,0625 | 1.160,15625 | oyun birimi/dakika |

Sabit hedefe 1.000 birim gidiş 116,36 → 46,55 saniye; yüklü dönüş
232,73 → 93,09 saniye olur. Asteroid hareket ettiği için tüm interception
sürelerine doğrudan `÷2,5` uygulanmaz; gerçek solver yeni buluşmayı hesaplar.

## Korunan davranış ve yan etkiler

- Asteroid ve enkaz seferleri aynı kazıcı hızını okur; artış ikisini de kapsar.
  Matkap 1,5× ve yüklü dönüş 0,5× oranları korunur. Ambar, ore miktarı, craft
  sınırı, flight bay ve gemi fiyatı değişmez. Kazıcı seferlerinin yakıt ücreti yoktur.
  Diğer gemiler, Beacon ve Ship Propulsion hızı bu sabitten türetilmez.
- `departAt`, `arriveAt`, intercept noktası ve başlamış dönüşün `homeAt` değeri
  kayıtlıdır. Yayın bunları yeniden zamanlamaz veya kazıcıyı haritada sıçratmaz.
  Hâlâ giden bir sefer varışında yeni hızla döner; recall/target-gone dönüşü de
  dönüş kararı verilirken güncel hızı okur. Başlamış dönüş eski kayıtlı saatinde iner.
- Sezon admission guard gidiş + yüklü dönüşü hesaplayarak bitişten önce eve
  ulaşmayı şart koşar. Daha hızlı dönüş bu korumayı gevşetmez; kalıcı orphan
  kaydın doğal wipe'ı ertelemesi ayrı, önceden bulunan bir sorundur.
- **Enkaz cooldown etkisi:** kısa gidiş sınırı kaynakta 80 saniye, dinlenme
  60 saniyedir. Sınır değiştirilmezse dinlenmeye giren mesafe 687,5 → 1.718,75
  birime, Matkap ile 1.031,25 → 2.578,125 birime çıkar. Asteroid seferleri bu
  cooldown'a girmez. Bu artış için cooldown'u ayrıca değiştirmek zorunlu değildir.
- Daha fazla sefer ve daha erken varış kaynak toplama fırsatını artırır; gelir
  kesin olarak 2,5× olmaz. Alanın ore/spawn miktarı ve rakiplerin önce ulaşması
  sınırlayıcı kalır. Bu inceleme ilerleme/ekonomi dengesini simüle etmez.
- Altı dildeki Kazıcı açıklamaları 619/309 hızlarını sabit metin olarak içerir;
  gerçek değişiklikte 1.547/773 gösterimine veya kuraldan beslenen değerlere geçmeli.

## Test kanıtı ve uygulama kapsamı

Aday hız yalnız izole Vitest süreçlerinde `PROSPECTOR.speed` ve aynı sabiti
okuyan hull katalog girdisine uygulanarak denendi; production/stage DB'leri
kullanılmadı. Ayrı `astera_miner_speed_review_20261004_test` DB'si sonunda kaldırıldı.

- `mining.test.ts`, `prospector.test.ts`, `prospector-dispatch.test.ts`: **69/69 PASS**.
  Interception, dönüş, recall, çift dispatch, ore/kazıcı korunması, cooldown ve
  ownership/recovery senaryolarını kapsar.
- Turnaround, availability, foundations ve orbit interception: **95 PASS / 1 FAIL**.
  Başarısız testin `0.2` dakikalık örnekte yeniden erişilemezlik beklentisi eski,
  yavaş Kazıcı için kurulmuştur. Aday hızda hedef hâlâ erişilebilir olduğundan
  fixture artık nadir, geçici buluşma senaryosu değildir; solver çağrısından önce
  bu önkoşul assertion'ında düşer. Baseline ile aynı dosya ayrıca yeşil doğrulandı.
  Ayrı aday geometri kontrolü aynı fixture'ın gerçek yeni solve'unu ve 24 farklı
  rim/core/asteroid/Matkap interception'ını doğru residual ile doğruladı.
- Mevcut hızı sabitleyen `ship-speed`, `balance-tempo-2026-09-14`,
  `fleet-v2-contract` ve `fleet-calibration` test beklentileri bilinçli güncellenmeli;
  orbit fixture'ın nadir buluşma kapsamı korunmalı. Test silmek gerekmez.

Sonuç: teknik bir bloklayıcı bulunmadı; mevcut cooldown yan etkisi kabul edilerek
dar bir hız değişikliği yapılabilir. Migration veya force wipe gerekmez. Stage
provasından sonra worker önce, API'ler ardından aynı image'a geçmelidir: yeni hızlı
API ile eski yavaş worker'ın sezon sonu dönüş bütçesini karıştırmak önlenir.
Frontend aynı kural ve güncel açıklamalarla yayınlanır; başlamış uçuşlar korunur.

Git dışındaki kanıtlar `out/deployment-20261004/miner-speed-*-results.json` ve
`miner-speed-geometry-summary.json` altında; bu aday koşular gerçek kaynak değişikliği
sonrasında gerekli release doğrulamasının yerine geçmez.
