# Ortak tarafta pozitif Honor yok — uygulama sözleşmesi

Kullanıcı 15 Ekim'de onayladı. Hakimiyet hesabı korunur. Yeni Honor sürümü 3; donmuş v1/v2 geçmişi aynı hesapla yeniden oynatılır. Var olan ACTIVE veya SHADOW sezonu sessizce yükseltilmez.

- Ortak saldıran taraf pozitif Honor kazanmaz. Kendi kalıcı kaybı ve seçilmiş zayıf hedefe verdiği zararın yaptırımı, pozitif askerî kazançla mahsuplaşmadan korunur.
- Birlikte savunan ev sahibi/destekçiler pozitif veya negatif Honor almaz. Saldırgan tek başınaysa kendi normal hesabı devam eder.
- Tek başına savunan, ortak saldırganları durdurduğunda normal Honor kazanabilir. Karşı tarafın ortak olması bütün savaşı dışlamaz.
- Aynı komutanın çok sayıda filosu tek komutandır. Klan etiketi, operasyon adı veya son vuruş kimliği sayımı değiştirmez.
- Ortak saldırı, gönderime katılan farklı komutanlarla belirlenir. Katılımcının uçuşta yok olması veya savaş başında pasif olması ortak gönderimi bireysel başarıya dönüştürmez.
- Savunmada gerçek savaş roster'ında bulunan destek sayılır; bir gemi veya yalnız sivil/pasif fiziksel destek de dahildir. Tamamen boş destek satırı sayılmaz. Boş ev sahibi, gerçek destekle savunulduğunda ortak taraftır. Gönderilmiş ama henüz ulaşmamış, geri döndürülmüş veya savaş öncesinde ayrılmış destek sayılmaz.
- Anıtta aynı çatışmaya katılan farklı komutanlar ortak taraftır; ayrı çatışmalar sırf aynı anda/aynı klanda diye birleştirilmez.
- Ortak tarafın sıfırlanan pozitif kazancı çift bütçesi tüketmez. Tek başına karşı tarafın pozitif kazancı kendi uygun çift bütçelerine yazılır. Gerçek zarar, tekrar ve dar karşılık bütçesi çalışmaya devam eder.
- Saldırgan negatifleri mevcut ortak başlangıç katkısı ağırlıklarıyla paylaşılır. Tek gemilik ortak eklemek negatif yaptırımdan kurtarmaz. Savunanın puanı hiçbir durumda negatif olmaz.
- İlişki/uygunsuz aktör/hedef değişimi/eski uçuş istisnaları korunur. Bu iş, review'daki Silent Space, yeni sezon hazırlığı veya özel silah entegrasyonu sorunlarını kendiliğinden çözmez.

TDD kapsamı: 1v1 eşdeğerliği; 2v1/1v2/2v2; aynı sahipli dalgalar; ilişkili katılımcı; taze/tükenmiş çiftler; olumlu başarıyla maskelenen kayıp/zayıf hedef cezası; bir gemilik ortak; boş ev sahibi; boş/pasif/sivil destek; seçili zayıf hedef ve gönüllü destek ayrımı; karşılık tüketimi/tekrar; replay/rollback; gerçek normal destekli savaş, ortak saldırı ve ortak anıt; sürüm değişmezliği; API sözleşmesi; raporda sıfır/negatif ortak sonuç açıklaması; altı dilde gönderim/leaderboard rehberi.

Değişecek alanlar: sürüm sabitleri ve commitment parser, ortak taraf kuralı ve sürüm dispatch'i, rapor/API metadata, altı dil oyuncu metni ve ilgili gönderim ekranları. DB yapısı değişmez. Mevcut savaş/Hakimiyet hesapları değiştirilmez.

## Uygulanan davranış

- `HONOR_VERSION=3`; `HONOR_LEGACY_VERSION=1` ve SHADOW adayı 2 desteklenmeye devam ediyor. `prepareHonorSeason`/yeni SHADOW hazırlığı 3'ü seçer; mevcut yapılandırmada farklı sürüm istemek hâlâ hata verir. Commitment parser üç donmuş sürümü de okur. DB migration gerekmedi.
- `honorTeam` yalnız sürüm 3 dispatch'inde `soloPositiveOnly` kullanır. Ortak tarafta pozitif askerî/ganimet terimleri hesap dışı kalır; negatifleri sonradan net sonuca sıfır tavanı koyarak gizlemiyoruz. Karşı tarafın hesabı normal çalışır.
- `honorSideParticipantCount` katılım tanımını merkezileştirir; hem pozitif uygunluğu hem rapor aynı tanımı kullanır. Aynı oyuncunun dalgaları bir kez sayılır. Boş seçili ev sahibi gerçek desteğiyle ortak sayılır; gerçek savaş roster'ına dahil olmayan boş destek sayılmaz.
- `SHARED_SIDE` rapor gerekçesi sıfır ortak sonucu açıklar. Negatif ortak sonuçta asıl kayıp/zayıf hedef gerekçesi ve ortak taraf kuralı birlikte görünür. Takım arkadaşının cezasından pay alan kişiye sahte kendi kaybı yazılmaz; payı sıfır kalan kişiye puan kaybettiği söylenmez.
- `/api/season` ve leaderboard yalnız görünür ACTIVE v3 için `honorSoloCredit=true` gönderir. Hedef karşılaştırması aynı sürümün kuralını duyurur. SHADOW/kapalı/legacy sezonlarda yeni politika reklamı yapılmaz. Eski onboarding/istemci nesnelerini bozmamak için sezon metadata'sı client sözleşmesinde opsiyoneldir.
- Ortak saldırı odası, destek gönderimi, savunma ayarı, anıt gönderimi, bireysel gönderim rehberi, leaderboard ve rapor altı dilde yeni kuralı açıklar. Mevcut Honor ikonu, beyaz/kalın başlık ve ince vurgu çizgisi kullanıldı; yeni bir iç içe panel düzeni eklenmedi.

## TDD ve doğrulama

Kayıtlar `.dev/honor-solo-20261015/` altında.

| Kontrol | Sonuç |
| --- | --- |
| İlk yeni politika testleri | `initial-red.log`: **15 RED / 1 PASS** → `initial-green.log`: **16 PASS** |
| API/rapor metadata | `api-red.log`: **4 RED / 15 PASS** → entegrasyon koşusu **33 PASS** |
| Gerçek savaşlar dahil geniş Honor/sunucu regresyonu | `server-all.log`: **387 PASS / 1 RED / 2 koşullu SKIP**, 37 dosya. RED, yeni ortak ceza gerekçesi testiydi. |
| Ortak negatifin gerekçesi | `report-final-green.log`: **33 PASS**; sonradan sıfır paylı katılımcı için ek RED → GREEN yapıldı. |
| Sıfır pay ve boş destek sayımı dahil son rapor/politika koşusu | `report-absent-final-green.log`: **35 PASS**; 27 yeni politika senaryosu + 8 rapor regresyonu. Önceki geniş koşudaki tek RED giderildi. |
| Mevcut Honor kuralları | `rules-green.log`: **125 PASS**, 7 dosya |
| Honor ve gerçek ortak gönderim/ayar ekranları | `ui-final-green.log`: **117 PASS**, 10 dosya |
| Sunucu tam tip kontrolü | `server-typecheck-final.log`: **PASS** |
| Web tam tip kontrolü | `web-typecheck-3072.log`: **PASS**. 2 GiB denemesi heap sınırına takıldı; 3 GiB ile tek başına tamamlandı. |
| Değişen backend, frontend, test, locale ve görsel araç lint'i | `backend-lint.log`, `frontend-lint.log`, `tests-locales-lint.log`: **PASS** |
| Gerçek React ekranları, altı dil × 350/1280 px × dört durum | `visual.log` ve `visuals/measurements.json`: **48 PASS**; yatay taşma/kırpılma ve tarayıcı hatası yok. Ortak sıfır sonuç, ortak kayıp, gönderim rehberi ve leaderboard. Türkçe 350 px rapor/leaderboard ekranları ayrıca görsel olarak incelendi. |

Geniş sunucu koşusunun diğer 36 dosyası yeşil; değişen rapor alanı son koşuda tekrar doğrulandı. Son eklerle birlikte **391 farklı sunucu testi**, **125 kural testi**, **117 UI testi** doğrulandı. Toplam **633 test**; iki eski ruleset koşullu test atlandı. Yeni politika nedeniyle eski pozitif takım testlerini silmedik: gerçek destek savaşı v1 ve v3 için ayrı doğrulandı; eski ortak rapor testi açıkça v1'e bağlandı.

Kontroller ayrılmış `astera_honor_test` DB'de, tek Vitest işçisi ve `nice -n 10` ile çalıştırıldı; Node test heap 1024 MiB. Yerel oynanabilir sezon/production DB değiştirilmedi; deploy veya aktif sezon sürüm değişimi yapılmadı. Mevcut yerel v1 sezonu yeni kuralı kendiliğinden kullanmaz. Yeni Honor yapılandırması 3 ile hazırlanır. Yeni sürüm yapılandırılmadan önce API ve worker'ın uyumlu kodla çalışması gerekir.

Review'daki Silent Space geçmişi, sonraki sezonun Honor yapılandırması, yalnız Honor değişiminde yayın, özel silah entegrasyonu ve v2'de kalan eşzamanlılık/reaktif savunma işleri bu değişiklikle çözülmüş sayılmıyor. Bu iş, ortak dağıtımla pozitif puan aktarma yolunu yeni sürümde kaldırıyor.

Son kontrol: değişen dosyaların whitespace kontrolü temiz. Tam production build/deploy yapılmadı. Tekrarlama komutları: sunucu için önceki review'daki Honor regresyon komutu ve `test/honor-solo-credit.test.ts test/honor-report.test.ts`; UI için `vitest run honor- clan-war-panel clan-support-sheet clan-support-bay monument-sheet ranking-scores`; görsel için `verifyHonor(output, ['shared', 'shared-loss', 'target-upper', 'leaderboard'])`. Vitest komutlarında `--maxWorkers=1 --minWorkers=1 --no-file-parallelism` ve aynı disposable test DB korunmalı.
