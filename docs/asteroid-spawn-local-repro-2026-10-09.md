# Asteroid spawn: yerel tekrar üretim ve kanıt, 2026-10-09

Bu dosya **düzeltmeden önceki incelemenin tarihsel kaydıdır**. Daha sonra owner'ın
onayıyla runtime düzeltmeleri ve v11 arz azaltımı uygulandı; güncel sonuçlar ve
geçen testler [düzeltme raporunda](asteroid-spawn-fix-2026-10-09.md).
Diagnostic senaryolar artık normal CI'da çalışan
[`asteroid-spawn-regression.test.ts`](../apps/server/test/asteroid-spawn-regression.test.ts)
dosyasında. Aşağıdaki RED sonuçları düzeltme öncesine aittir.

## Sonuç

Bugünkü prod shower'ının yüksek üretimi gerçek PostgreSQL, kuyruk ve `EventWorker` ile
localde yeniden üretildi: **35 üretim nüfusu → 105 shower kayası + 18 normal kaya**.
Mevcut bir saat satırını beş worker başlangıcı ve iki mükerrer teslim değiştirmedi.
40+20 kaya tükenmiş işaretlendikten sonra aynı indeksler geri gelmedi; önceden planlanan
18 yeni normal kaya doğdu. 800 cevherlik kayaya yapılan gerçek 700 kapasiteli uçuş,
100 cevheri olan görünür bir kaya bıraktı.

Ayrıca birbirinden bağımsız **üç uygulama hatası gerçek servis akışıyla tetiklendi**:

| Tetikleyici | Yerel gözlem | Beklenen korunma |
| --- | --- | --- |
| v9'un 60 dk x3 gelecekteki penceresine `restamp` | Satır v10 / x6 oldu, süre 60 dk kaldı; worker 210 kaya planladı | Yeni tanımın 30 dk x6 shower'ı ve normal yarım saati: toplam 123; uyumsuz restamp reddedilebilir |
| 24–28 saat eski beş nüfus kaydı, şu an 0 uygun oyuncu | Üretim nüfusu 42; normal saatte 42 kaya | Altı gerçek saat dışındaki kayıtların etkisi 0 |
| Aynı DB'yi yeni süreçte, iki kat cevher tablosuyla okumak | Claim ve indeksler aynı; tükenmiş 105 kaya tekrar görünür | Eski saatlerin cevher girdileri eski generation sürümünde kalmalı |

Bu üç hata bugünkü prod olayının nedeni olarak sunulmuyor.
[Prod incelemesinde](asteroid-spawn-prod-review-2026-10-09.md) v10 pencereleri 30 dk,
saatler kesintisiz ve ilgili son deploy'ların cevher/ömür girdileri değişmemişti.
O olayın sayıları güncel arz formülü, ilk beş dakika dağıtımı, biriken stok ve kısmi
madencilikle uyumlu. Local kontroller bu açıklamanın servis düzeyinde de çalıştığını gösteriyor.

## Kapsam ve yöntem

- Yalnız localhost PostgreSQL 16 üzerinde yeni, ayrı `_test` veritabanları kullanıldı.
  Prod'a bu çalışma sırasında bağlantı veya yazı yapılmadı; local geliştirme DB'si kullanılmadı.
- Runtime, takvim tanımları, çarpanlar ve migration'lar değiştirilmedi.
  Eklenen kod yalnız diagnostic testleri ve onları çalıştıran config'tir.
- Testler hizmetleri mock'lamıyor: `createSeason → joinSeason → ensureAsteroidHourEvents →
  EventWorker.tick → loadMiningSnapshot → projectVisibleAsteroids` zinciri çalışıyor.
  Madencilik örneğinde `launchMining` ve gerçek `mining_arrival` handler'ı da çalışıyor.
- İncelenen kaynak HEAD `7f89f1be29d111cef9d58eeaa04ba1ff0d4c3757`.
  İlgili asteroid spawn/takvim/generation kodu, prod incelemesindeki `900b18a` ile aynı.
- Fixture: prod ile aynı sezon başlangıç anı, ruleset 16, 9 Ekim 20:00 TRT saati;
  gerçek v10 takvimi; 36 uygun insan ve önceki raw sayılar `38,36,39,32,31`.
  Bunlardan yeni saatin üretim nüfusu `round(212/6)=35` çıkıyor.
- Üretim anahtarı yerine sabit, açık bir test anahtarı kullanıldı. Doğum anları bu nedenle
  prod'dakilerle aynı değildir: local ilk 5 dk 56 kaya, prod incelemesinde 52 kaya.
  Her ikisinde de ilk 5 dk için ayrılmış 44 kaya ve tüm 30 dk'ya yayılan diğer kayalar var.
- Sayılar, aksi belirtilmedikçe sadece açılan 20:00 saatinin dinamik kayalarına aittir.
  Global özel alan ile oyuncunun sensör/discovery filtresi aynı sayım değildir.
  Bu çalışma browser görüntüsü veya oyuncu sensör menzili üzerine bir doğrulama yapmıyor.
- Saat ilerletilen kısa persistence testleridir. Uzun ekonomi/sezon simülasyonu çalıştırılmadı.

## Bugünkü yoğunluğu açıklayan kontroller

### Süreyi yarıya indirip çarpanı iki katına çıkarmak toplam saati sabit tutmuyor

Gerçek takvim satırıyla v9 kontrolü: 60 dk x3 → 105 kaya.
Gerçek v10 kontrolü: 30 dk x6 → 105 shower kayası; kalan normal 30 dk → 18 kaya.
Yeni saatin toplamı **123**, önceki saatin toplamı **105**.
Bu, eski ve yeni saat arasında yaklaşık %17 daha fazla arz demek.

İlk beş dakikadaki 44 garanti doğuma, diğer 61 shower kayasının 0–30 dk aralığına
dağıtımından bu fixture'da 12 doğum ekleniyor: **56 kaya / 5 dk**.
[Planner](../packages/rules/src/asteroidDynamic.ts) ile generator'ın ayrı test edilmesi
yerine, kaydedilmiş saati gerçek özel alan okuyucusu üretip projekte etti.

Alan zaten doluyken de aynı arz planlanıyor. Eski stok korunmuş fixture'da 20:30 global
özel projeksiyon 214 kayaydı. Karşı kontrol, 20:00'deki 131 eski kayayı tükenmiş işaretledi;
worker yine `[105,18]` yeni arz planladı. Bu **214/131 sayıları yerel fixture'a aittir**:
önceki saatlerin kaya planları kontrol girdisi olarak kuruldu; prod stok rekonstrüksiyonu değildir.
Mevcut cevher stoğu yeni üretim hesabına girmiyor.

### Yeniden başlatma ve silmeden sonraki doğumlar

- Beş yeni `EventWorker` örneği ve iki ayrı mükerrer `asteroid_hour` tesliminden sonra
  aynı saatin satırı, takvimin üretim girdileri ve bütün kaya spesifikasyonları aynı kaldı.
  Sonraki saat için yalnız 1 job vardı. Mükerrer job'lar iki worker ile işlendi.
- Eksik saat 4.99 dk gecikmeyle açılırsa 123 kaya planlanıyor, açıldığı anda 56 kaya zaten
  görünür oluyor. 5.01 dk gecikmede 105 kaya planlanıyor, anlık görünen 0; front-count 0.
  Bu, mevcut beş dakika toleransının bir sınır davranışıdır; bugünkü prod saati yaklaşık
  bir saniye gecikmeyle açılmıştı ve incelenen shower sırasında restart olmamıştı.
- 20:30'daki 105 kayadan 40 kaldırıldı: 65. Ardından 20: 45.
  20:59.99'da 63 kaya vardı: **18 farklı, önceden planlanmış normal indeks doğmuştu**.
  Kaldırılan 60 indeksin hiçbiri görünür olmadı. Bu local zaman çizgisi prod temizliğinin
  zaman çizgisi değildir; silmenin gelecek doğumları durdurmadığını gösteren kontrollü deneydir.

### Gerçek madencilik artığı

L1 kaya 800 cevher. Bir Prospector, Derrick ve Prospector Holds III ile kapasite 700.
Filo gerçek kuyruğa girdi, saat varışına getirildi, gerçek worker varışı çözdü:
`ore_taken=700`, filo `returning`, aynı kaya `oreRemaining=100` ile görünür kaldı.
Bu görünürlüğü kaldıran koşul 0 kalan cevher veya asteroidin expiry anıdır.

## Üç hatanın kesin kaynakları

### 1. `restampFutureOccurrences`: effect/version güncelleniyor, pencere süresi korunuyor

[galaxyEvents.ts](../apps/server/src/services/galaxyEvents.ts), satır 187–190:
`set({ effect: wanted, definitionVersion: version })`. `endsAt` ve end-job değişmiyor.

Repro gelecekteki bir v9 akşam satırını gerçek DB'de 60 dk x3 olarak düzenliyor.
19:50'de gerçek `restampFutureOccurrences` bir satırı güncelliyor:
**version=10, multiplier=6, duration=60**. Ardından gerçek `syncMissingFixedOccurrences`
0 satır ekliyor: başlangıç mevcut olduğu için sürenin tutarlılığını kontrol etmiyor.
20:00 worker'ı bu satırdan **210** kaya planlıyor; aynı saklanan saat
`loadMiningSnapshot` ile okunduğunda özel alanda da **210 asteroid spesifikasyonu** var.

Karşı kontrol aynı eski takvime gerçek `adoptLiveEventCalendar` uyguluyor:
tam pencere biçimi değişiyor; süre 30 dk, shower 105, saat toplamı 123.

Sadece deploy/restarter bu restamp işlemini tetiklemiyor. Bu hata, uyumsuz bir eski takvim
satırı effect restamp'iyle yeni tanıma geçirilirse ortaya çıkıyor. Güvenli davranış,
bu biçim değişimini reddetmek veya future takvimi tam biçimiyle benimsemek olmalı.

### 2. `rollingSupply`: son beş satır, son beş gerçek saat olmak zorunda değil

[asteroidSpawn.ts](../apps/server/src/services/asteroidSpawn.ts), satır 170–178:
sezon ve `hourStartsAt < currentHour` filtresi, azalan sıralama ve `limit(5)` var;
alt zaman sınırı yok.

Repro'da 50 komutan hâlâ sezonun içinde; hepsinin son aktivitesi 24 saat önce ve
gerçek uygun oyuncu sayısı 0. DB'deki en yeni geçmiş kaydı 24 saatlik;
beş kayıt da 50. Gerçek worker yine `round((0+250)/6)=42` nüfusu ve 42 kayayı saklıyor.
Saati tüm doğumlar geçene kadar ilerletip özel alanı okumak da **42 görünür kaya** veriyor.
Kesinti sırasında eski saatleri geri açmamak, geçmiş nüfus sorgusunun eski satırları
yeniden kullanmasını engellemiyor.

Karşı kontroller: son beş **gerçek saat** 50 ise 42, tanımlı smoothing davranışıdır;
hiç geçmiş yoksa 0 oyuncu → 0 üretimdir. Hata, 24 saatlik boşluğun altı saatlik pencere
gibi değerlendirilmesidir. Kurucu gününün smoothing muafiyeti nedeniyle fixture
özellikle sezonun beşinci gününde çalışıyor.

### 3. Saklanan saatin cevher girdisi tam dondurulmuyor

[asteroidDynamic.ts](../packages/rules/src/asteroidDynamic.ts), satır 196:
cevher her yeniden üretimde güncel `GALAXY.asteroidOreByLevel[level]` tablosundan geliyor.
Saatin saklanan şeritleri ve level weights bu cevher tablosunu içermiyor.

Repro 20:30'da doğmuş 105 kayaya tam cevher claim'i yazıyor: 0 görünür.
Ardından **iki ayrı yeni Node süreci** aynı DB'yi okuyor:

1. Mevcut tablo → 0 görünür, 105 tükenmiş claim korunmuş.
2. Yalnız o izole sürecin belleğinde iki kat cevher tablosu → aynı indekslerde 105 görünür.

İndeksler ve DB'deki `ore_taken` dizisi iki okumada birebir aynı.
Bu nedenle olay yeni üretim işi değildir: aynı indeksin yeni cevher toplamıyla
yeniden hesaplanmasıdır. Yeni süreç kullanılması, eski process cache'inin bu sorunu
maskelemesini önler. Deney DB'nin cevher verisini veya proje sabitlerini değiştirmiyor.
Canlı saatlerin generation girdileri/sürümü dondurulmalı; yeni tablo yeni saatlere uygulanmalı.

## Tekrar çalıştırma

Test kaynağı, düzeltme sonrası: [asteroid-spawn-regression.test.ts](../apps/server/test/asteroid-spawn-regression.test.ts).
Config: [vitest.asteroid-repro.config.ts](../apps/server/vitest.asteroid-repro.config.ts).
Config localhost ve `astera_asteroid_repro_*_test` DB adını zorunlu tutuyor.
Fixture bu ayrı test DB'sini her vaka arasında temizler.

Repo kökünde, local `astera-pg` container'ı çalışırken:

```bash
docker exec astera-pg createdb -U astera astera_asteroid_repro_local_test
DATABASE_URL=postgres://astera:astera@127.0.0.1:5433/astera_asteroid_repro_local_test \
  nice -n 10 pnpm --filter @astera/server exec vitest run \
  --config vitest.asteroid-repro.config.ts --reporter=verbose \
  --maxWorkers=1 --minWorkers=1 --no-file-parallelism
```

Beklenen sonuç: **10 kontrol PASS, 3 invariant FAIL**. Exit code 1 kasıtlıdır:
runtime sorunları bu çalışmada düzeltilmedi; testler başarısız koşulu gizlemiyor.
Diagnostic dosyası `.test.ts` ile bitmez; normal test keşfini kırmadan ayrı config ile çalışır.

Yalnız karşı kontrolleri çalıştırmak için son komuta `-t 'controls:'` eklenebilir.
Bu durumda 10 kontrol geçmeli, 3 hata vakası filtrelenmelidir.
Son owner isteği üzerine tekrar çalıştırma komutu düşük öncelik ve tek worker ile verildi.
Yerel kontroller ardışık çalıştırılmalı; workspace'ler aynı anda test edilmemeli.

Tam kanıt çıktısı: [asteroid-spawn-local-repro-2026-10-09.txt](evidence/asteroid-spawn-local-repro-2026-10-09.txt).
Kesinti senaryosu ayrıca 50 gerçek, inaktif komutanla güçlendirildi ve yeniden kırıldı:
[asteroid-spawn-local-outage-repro-2026-10-09.txt](evidence/asteroid-spawn-local-outage-repro-2026-10-09.txt).
Hatalı planların özel alana geçtiği son üç invariant koşumu:
[asteroid-spawn-local-invariants-2026-10-09.txt](evidence/asteroid-spawn-local-invariants-2026-10-09.txt).
Normal typecheck/lint/test doğrulaması ayrı bir local `_test` DB'sinde çalıştırıldı;
diagnostic ve normal persistence veritabanları birbirinden ayrı tutuldu.

## Tamamlanan doğrulama

- Diagnostic koşumu: 10 kontrol geçti; üç invariant, hedeflenen gerçek ihlallerden kırıldı.
  Yanlış fixture/altyapı hatası üç bug için kanıt olarak sayılmadı.
- Kesinti vakasının güçlendirilmiş koşumu: 50 mevcut, 24 saattir inaktif komutan;
  `eligible=0`, `supply=42`, 42 kaya. Hedeflenen 0 invariant'ı yeniden kırıldı.
- `pnpm --filter @astera/server typecheck`: exit 0.
- Root `pnpm lint`, ignore-pattern'larla yalnız eklenen iki TypeScript dosyası: exit 0;
  debug kaydı iki dosyanın gerçekten parse/lint edildiğini doğruluyor.
- Mevcut server asteroid/takvim/nüfus testleri: **59/59, 3 dosya PASS**.
  [Tam çıktı](evidence/asteroid-spawn-local-regressions-2026-10-09.txt).
- Normal rules paketi: **2023/2023, 110 dosya PASS**.
- Genel `pnpm test`: web'de **6 FAIL, 5606 PASS, 29 skipped** nedeniyle exit 1.
  [Kısa koşum kaydı](evidence/asteroid-spawn-local-workspace-test-summary-2026-10-09.txt).
  Üç hata `country`, `dm-screen`, `battle-report-clarity` süre aşımıydı; bu üç dosya
  aynı timeout'larla tek worker'da tekrar çalıştırıldığında **55/55 PASS**.
  Diğer üç hata `menu-structure`, `skins-screen`, `v2/tokens` doğrulamalarında:
  menü grup sırası, skin ekranının shop düğmesi ve `store.css` raw renk kuralı.
  İlgili web dosyalarında inceleme sırasında bağımsız workspace değişiklikleri vardı;
  bu çalışma o dosyaları değiştirmedi. Genel suite veya bütün workspace lint'i
  başarılı ilan edilmiyor. Genel server koşumu web hatasıyla kesildiği için yukarıdaki
  ayrı 59 testlik asteroid/takvim/nüfus koşumu kullanıldı.
- `git diff --check` temiz. `apps/server/src` ve `packages/rules/src` altında bu çalışmanın
  runtime diff'i yok. Prod'a düzeltme deploy edilmedi.
