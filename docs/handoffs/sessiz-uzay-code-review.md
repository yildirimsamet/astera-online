> Bu dosya önceki ara sürümün tarihsel incelemesidir. Güncel uygulama ve son doğrulama için [uygulama durumu](sessiz-uzay-uygulama-durumu.md) esas alınır. Aşağıdaki eski tamamlanmamış iş ifadeleri güncel durum değildir.

# Sessiz Uzay — kod incelemesi

Tarih: 2026-09-08. Karşılaştırma: `f1fa09d` → mevcut çalışma ağacı; yeni/untracked implementasyon dosyaları dahil. Migration/backfill, saf kurallar, kuyruk, presence, WAIT provisioning, sensör izolasyonu, kilit kontrolleri, worker değişikliği, testler ve dokümantasyon incelendi. Bu incelemede uygulama kodu değiştirilmedi.

## Düzeltme durumu — 2026-09-08

Üç bulgu giderildi. Wipe, sezon/klan temizliği sınırından sonra player satırlarını ID sırasıyla kilitliyor; application ve world temizliği bu kilitlerden sonra yapılıyor. Bootstrap yeni MAIN sezonlarına tek bir başlangıç anı geçiriyor. Başvuru/presence saati player ve application kilitlerinden sonra okunuyor; sezon sonunu aşan başvurunun aktivite güncellemesi dahil bütün transaction geri alınıyor.

Kalıcı regresyon dosyası: `apps/server/test/return-lifecycle-races.test.ts`. Beş senaryo önce FAIL, düzeltmeden sonra PASS: sezon bitişini aşan kilit beklemesi, ilerleyen saatle ortak cycle, gerçek `wipeAllServers` ile presence kilit yarışı, presence ve enqueue için expiry sınırı. İlgili beş test dosyası toplam 71 PASS. Aşağıdaki bulgular inceleme anının tarihsel kaydıdır; geçici CR testlerinin yerini bu kalıcı testler aldı.

## Bulgular

### P1 — Sezon temizliği ve presence ters kilit sırası kullanıyor

Konum: `apps/server/src/services/servers.ts:605` ve `apps/server/src/services/presence.ts:55`.

Wipe önce `return_applications` satırlarını güncelliyor, ardından `players` siliyor. Presence önce player UPDATE kilidini, sonra application UPDATE kilidini alıyor. Wipe application kilidini tutarken presence player kilidini alırsa iki işlem birbirini bekliyor. PostgreSQL işlemlerden birini iptal ediyor; seçilen kurbana bağlı olarak sezon temizliği veya aktivite kaydı geri alınıyor.

Kanıt: wipe'ın son aşamasındaki iki kilit alımını presence servisiyle yarıştıran PostgreSQL testi `40P01: deadlock detected` üretti. Bu, tam wipe uçtan uca testi değil; aynı satırlar üzerindeki ters kilit sırasının kontrollü tekrar üretimidir.

Düzeltme: wipe, application satırlarını kapatmadan önce ilgili player satırlarını deterministik sırada kilitlemeli; bütün yollar player → application sırasını izlemeli.

### P2 — Yeni bootstrap aynı dönemi farklı cycle'lara bölüyor

Konum: `apps/server/src/services/season.ts:122`; çağıran `bootstrapServersIn`, `apps/server/src/services/servers.ts`.

Cycle tekilliği başlangıç/bitiş tarihlerinin tam eşitliğine dayanıyor. Bootstrap her galaksi için ayrı `clock.now()` çağırıyor. Gerçek saat ilerlediğinde aynı açılıştaki MAIN galaksileri farklı cycle alıyor. WAIT seçimi cycle eşitliği istediği için aynı dönemin ana galaksileri ortak WAIT kapasitesini kullanamıyor; gereksiz WAIT açılışları ve kapasite parçalanması oluşuyor. Sabit saatli mevcut testler bunu gizliyor.

Kanıt: her çağrıda bir saniye ilerleyen enjekte saatle iki galaksi bootstrap testi, beklenen tek cycle yerine iki cycle üretti.

Düzeltme: yeni bir toplu açılış/rollover için dönem başlangıcını bir kez belirleyip bütün yeni MAIN sezonlarına geçir. Legacy dönemleri migration sırasında ayrı tutma kuralı korunmalı.

### P2 — Başvuru zamanı kilit beklemesinden sonra doğrulanmıyor

Konum: `apps/server/src/services/returnQueue.ts:64` ve `apps/server/src/services/presence.ts:58`.

Başvuru, saati admission/season/player kilitlerinden önce okuyor. Sezon bitiş kontrolü de player kilidi alınmadan önce yapılıyor. Kilit beklemesi `endsAt` sınırını aşarsa eski zamanla QUEUED kayıt oluşturuluyor. Presence da player kilidi öncesindeki zamanı expiry hesabına geçiriyor; kilitte süre aşan başvurunun eski önceliğini uzatma riski taşıyor.

Kanıt: sezon bitiminden bir saniye önce başlayan başvuru gerçek PostgreSQL player kilidinde bekletildi, saat tam `endsAt` anına getirildi ve kilit bırakıldı. Beklenen `SEASON_NOT_LIVE` yerine QUEUED kayıt döndü. Presence uzantısı aynı zaman yakalama deseninin kod incelemesi bulgusudur; ayrı expiry yarış testi çalıştırılmadı.

Düzeltme: gerekli kilitlerden sonra saati yeniden oku; iki sezonun bitişini ve application expiry'sini bu güncel zamanla doğrula. Aktivite ve başvuru tarihlerini aynı doğrulanmış andan üret.

## Doğrulama ve kapsam sınırı

- Son tam `pnpm verify`: typecheck/lint geçti; rules 919 PASS, web 2443 PASS, sim 82 PASS / kullanıcı onaylı 6 SKIP, server 1320 PASS / 3 FAIL.
- Üç server hatası `bots-turn.test.ts:106`, `:124`, `:139`. Ayrı temiz `_test` veritabanıyla değişiklik öncesi `f1fa09d` arşivinde de aynı üç hata ve 17 PASS elde edildi. Bu üç test skip edilmedi.
- İnceleme için eklenen üç regresyon senaryosu da beklenen güvenli davranışa karşı FAIL verdi; yukarıdaki bulguların kanıtıdır. Normal test kümesine eklenmediler.
- FIFO saf kuralı uygun en eski başvuruyu seçiyor ve engellenen başvuruyu değiştirmiyor. Gerçek admission worker/atomik transfer/SSE/UI hâlâ tamamlanmamış durumda; uçtan uca sıra garantisi verilmiş sayılmaz.
- Migration'ların dolu üretim kopyasında provası ve gerçek transfer sonrası uçtan uca testler bu inceleme kapsamında yapılmadı.

Yerel kanıtlar:

- `/tmp/blindspace-sessiz-verify-final-2.log`: tam verify.
- `/tmp/blindspace-sessiz-cr-baseline.log`: değişiklik öncesi bot testleri.
- `/tmp/blindspace-sessiz-cr-repros.log`: üç bulgunun test çıktısı, deadlock SQLSTATE dahil.
- `/tmp/blindspace-sessiz-cr-repro.test.ts`: geçici regresyon testi. Yeniden çalıştırmak için `apps/server/test/cr-sessiz.test.ts` konumuna kopyalanıp yalnız `_test` veritabanıyla vitest'e verilmelidir. Geçici test inceleme sonunda normal test dizininden çıkarıldı.
