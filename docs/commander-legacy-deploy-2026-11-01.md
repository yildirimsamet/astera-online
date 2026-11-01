# Komutan Mirası — yayın ve geçmiş kazanım planı

Yetki: kullanıcının 1 Kasım talimatı; plan → staging provası → aynı release’in canlı yayını. Çalışma `/home/yildirim/.codex/worktrees/legacy-release/blindspace` içindeki ayrı release worktree’sinde. Ana çalışma alanının kaydedilmemiş işleri korunur.

## Release sınırı

Taban `c90fc0cbb769f3c8d560aee5cdbce28719b62e82`; canlı üç API ve worker bu tabanda. Canlı web marker’ı `491c1a3e07829d40b58885bc9be0861fc8676c3e`. Bu release yalnız Miras backend/frontend, 40 ödül modeli, testler ve işletim araçlarını taşır. Başka görevdeki FocusPanel saydamlığı, DM aracı ve kılavuz düzenlemeleri release’e alınmaz.

Canlı journal 217 kayıt; tek ek migration `0217_commander_legacy.sql`. Yeni tablolar/indeksler ve sahiplik FK’leri eklenecek. Mevcut dünya verisi, kaynak ödülü hakları, sezon takvimi ve ekonomi kuralları korunacak. Normal uyumlu rolling yolunun staging kilit/karma sürüm ölçümleriyle doğrulanması gerekir.

İlk envanter: 1.746 hesap, 1.473 arşiv sonucu, 26 kapanmış ve 3 canlı sezon; son 15 dakika etkinlik göstergesi 7. Bunlar değişen canlı değerlerdir; rollout öncesi tekrar kaydedilir.

## Kimlere hangi eski kazanımlar verilir?

| Kaynak / koşul | Verilecek Miras |
| --- | --- |
| Gerçek kapanışı en az 12 gün olan ana galaksi sezonu; katılım arşivi | Döngü başına Sezon Hatırası ve kanıtlanabilen yıl pini |
| Aynı uygun sezondaki pozitif Honor / Hâkimiyet sonucu | Galaksi başına ayrı şampiyon, ikinci, üçüncü veya ilk 10 derecesi; bir sıralamada tek kupa |
| Gemi türü başına doğrulanmış üretim özeti | 100 / 1.000 / 10.000 eşiklerinin her biri; karışık Silent Space özeti ana galaksi üretimi varsayılmaz |
| Hâlâ saklanan kesin gönderim/sonuç kayıtları | Farklı korsan/asteroit, sonda, silah fırlatma, düşürülen füze, ortak saldırı ve tamamlanmış araştırma eşikleri |
| Sahipliği ve canlılık sınırı doğrulanmış anıt HOLD aralıkları | Süre birleşimi üzerinden 1 saat / 12 saat / 1 gün / 3 gün |
| İade edilmemiş Destekçi kozmetik hakkı | Kalıcı Efsanevi Destekçi; sahibi profil açmasa da hesap uzlaştırmasında verilir |
| Kanıtlı farklı ücretli kozmetik hakları | Mevcut katalogdaki Gösterişçi eşikleri; iptal/iade edilmiş haklar sayılmaz |
| İlk gün katılım ve en az %80 gerçek aktif gün kanıtı | Sadık Komutan; giriş/hesap yaşı eksik aktif günün yerine geçmez |

12 günden önce kapanan sezonların hiçbir başarım katkısı alınmaz. Eski `closed_at` yoksa ilk gerçek sonuç zamanı kapanış kanıtıdır; planlanan bitişten süre uydurulmaz. Silinmiş hedef ayrıntıları toplam sefer sayısından yeniden üretilmez. Kazanım tarihi kanıtlanamıyorsa NULL kalır. Yıl rozeti hesap yaşını değil ilgili yılda oynama kanıtını temsil eder.

Canlı sezonun korunmuş geçmişi de ayrı uzlaştırılacak; sezon kupası canlı sezonda verilmeyecek. Mevcut canlı sezondaki kariyer katkıları ilk günden sayılır; sezon ileride 12 günden önce kapanırsa mevcut geri alma kuralı çalışır. Kozmetik hakları sezon katkılarından bağımsızdır.

Kesin kişi/ödül listesi staging’de güncel canlı snapshot’ı üzerinde hesaplanıp erişimi kısıtlı CSV/JSON’a çıkarılacak. Listede hesap/komutan, tanım, derece, edisyon, kaynak sezon, kazanım tarihi ve kanıt kapsamı olacak; kullanıcı verileri Git’e konmayacak. Plan dosyasına toplu adetler ve özel dosyaların yolları yazılacak.

İşletim sırası (release image içindeki package-local `tsx` ile):

```text
apps/server/src/cli/legacy.ts backfill --all --limit 12 --apply
apps/server/src/cli/legacy.ts bootstrap --scope players --all --limit 12 --apply
apps/server/src/cli/legacy.ts bootstrap --scope accounts --all --limit 24 --apply
```

`--apply` olmadan her sayfa yazılarını rollback eder. Bu sayfalı önizleme birbirinin üzerine eklenen bütün sezonların toplam dağıtım raporu değildir; tam dağıtım, staging kopyasında yukarıdaki sıralı uygulama ve ardından alınan dökümle hesaplanır. Her komut cursor/işlenen/yeni ödül sayısını JSON satırlarıyla verir. Aynı sıra ikinci kez çalıştırıldığında yeni ödül sıfır olmalıdır. Canlı katkı taraması tekrar-okunabilir transaction snapshot’ı kullanır; bütün hesapların yalnız kalıcı kozmetik haklarını da kapsayan son uzlaştırması ayrı sayfalanır.

## Hazırlık ve staging kabulü

1. Temiz release diff’ini incele; geçerli test/tip/lint kontrolleri ve server/web derlemesi. Tek push edilmiş SHA’yı sabitle; image revision ve web marker bu SHA olacak.
2. Canlı ve staging’in mevcut image, gerçek runtime environment/Compose, webroot ve Nginx dosyalarını özel yedekte sakla. Güncel tutarlı canlı DB dump’ı al; checksum/restore doğrula.
3. Canlı DB’nin yeni bir kopyasını staging PostgreSQL’de ayrı DB’ye restore et. Eski staging DB’sini sakla; stage için ayrı JWT, kapalı ödeme/posta gönderimi ve aynı-origin ayarları korunur.
4. Aynı image ile migration provası; journal/hash prefix, kalıcı kayıt kimlikleri ve kilit süresini doğrula. Tutulan okuyucu altında lock timeout testi kontrollü disposable kopyada çalışır; canlı oturumlar öldürülmez.
5. Eski image ile migration sonrası ilgili okuma/yazma, yeni image/API/worker ile gerçek olay ve profil kabulü. Kuyruk ve dünya korunumu kanıtı alınır.
6. Arşiv backfill’i, canlı korunmuş kanıtlar ve hesap/kozmetik uzlaştırması kontrollü sayfalarda çalışır. İlk/ikinci çalıştırmanın ödül kimlikleri karşılaştırılır; ikinci dağıtım sıfır yeni ödül üretmeli. Önizleme rollback doğrulanır.
7. Staging’in üç API ve worker’ını aynı release’e geçir; client yayınla. HTTPS giriş/refresh, özel profil yetkisi, koleksiyon, vitrin/unvan, 40 model, eski sekme asset erişimi, SSE ve yeni olay smoke’u doğrulanır.

## Canlı geçiş ve geri dönüş

Staging kabulünden sonra güncel canlı envanteri ve tutarlı özel yedek yeniden alınır. Kanıtlanmış düşük kilit bütçesiyle migration bir kez uygulanır. Eski sürüm API’leriyle çalışan aralıkta şema uyumu korunur; birer API ve singleton worker yeni image’e geçer. Her adım health/SHA/image/queue kontrolüyle kapılanır. Web en son, eski hash’li asset’ler korunarak yayınlanır.

Geçmiş dağıtımı canlı kaynağında aynı servisler ve benzersiz kaynak kimlikleriyle yürür; staging ödül satırları canlıya kopyalanmaz. Canlıda o sırada biriken yeni olaylar kaynak kimliği/toplam sınırı kurallarıyla uzlaştırılır. Hesap bazında küçük transaction’lar ve en fazla iki bağlantı kullanılır. Kesinti gerektiren yeni bir bulgu olursa staging ölçümü ve etkin oyuncu sayısıyla ayrıca ele alınır; normal rolling onayı kesintili işlem varsayımı değildir.

Uyumlu code rollback’inde additive Miras tabloları ve dağıtılmış ödüller yerinde kalır; doğrulanan önceki image/web/runtime geri alınabilir. Oyuncular yeni işlem yaptıktan sonra eski DB dump’ı üstlerine restore edilmez. Birinci tercih kontrollü forward fix’tir. Bütün rollout aşamaları, backfill adetleri ve gözlem sonuçları bu dosyaya eklenecek.

## İlk staging provasının sonuçları

Canlı snapshot’ı üzerindeki ilk prova 69 hesaba 285 ödül verdi: 75 sezon hatırası, 67 yıl pini, 16 Hâkimiyet derecesi, 7 Efsanevi Destekçi, 7 Gösterişçi kademesi, 21 sonda, 15 asteroit ve 77 gemi üretim plaketi. Honor kupası ve diğer başarım türleri için bu snapshot’ta yeterli kanıt/eşik yoktu. Bunlar canlı dağıtımının sabit sayıları değildir; canlı kaynaklar tekrar değerlendirilir.

Migration kilit altında bir saniyelik DB kilit bütçesiyle iptal oldu ve journal/tablolar geri alındı; engelsiz uygulamada journal 218 oldu. Migration ve üç uzlaştırma sonrasında 13 eski veri grubunun satır/hash değerleri aynı kaldı. Önizleme yazmadı; üç uygulamanın tekrarı sıfır yeni ödül üretti ve mevcut ödül kimlik/tarihlerini korudu.

Eski ve yeni image ile `/api/auth/me`, `/api/planet`, ülke yazımı ve kaynak toplama aynı migrated kopyada 200 döndü. Üç staging API, worker ve arena sağlıklı açıldı. Staging’in eski Nginx ayarındaki eksik `/profile` yönlendirmesi canlıdaki mevcut ayarla eşitlendi.

Gerçek tarayıcı kabulünde ödül sahip sayacının bütün ödül sahiplerini saydığı bulundu. Farklı tanım/kademe/edisyon ve geri alınan hakları ayıran regresyon testi önce kırıldı; dış sorgu sütunları açıkça nitelenerek düzeltildi, ilgili 8 API testi geçti. Son yayın SHA’sı bu düzeltmeyi de içerir; staging son image ile yeniden doğrulanmadan canlıya geçilmez.

İlk prova kanıtları VPS’te `/home/yildirim/releases/legacy-113fc7c5beb7/` altında tutulur. Kişi bazındaki liste `stage-allocation.private.csv`; yerel kopyası release worktree’sindeki `out/legacy-release/stage-allocation.private.csv` dosyasıdır. Bu özel dosyalar Git’e eklenmez.
