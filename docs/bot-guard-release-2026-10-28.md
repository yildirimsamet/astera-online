# Guard yayını — 28 Ekim 2026

Owner bu konuşmada temiz ve dikkatli deploy istedi. Hedef: canlı `fac449d8` sürümündeki Honor görünürlüğünü ve ilk 24 saat oyuncu/korsan ateşkesini koruyup incelenmiş guard gelişimini eklemek. Canlı 60 günlük dönem zaten açılmıştır; bu yayın sezon geçişi değildir.

Kaynak, ayrı ve temiz `release/bot-guard-20261028` worktree'sinde hazırlanır. Canlı commit'e göre yalnız altı bot modülü, dört bot testi, rota eşitliği testi ve inceleme/kanıt belgeleri değişir. İstemci, rules, migration ve Docker/Compose kaynak farkı yoktur. Diğer oturumların commit edilmemiş dosyaları dahil edilmez.

Yayın öncesi birleşmiş kaynakta bot/ödül/kuyruk/araştırma/onarım regresyonları, rota ön koşulları, typecheck ve kapsamlı sunucu lint koşulur. Uzun ekonomi/sezon simülasyonu bu talebin kapsamına girmez. Yeni kaynak tek temiz, origin/master'a itilmiş SHA ile server/web olarak hazırlanır; aynı SHA API1/API2/API3, Arena, worker ve public release kaydında doğrulanır.

Canlı servislerin etkin Compose dosyaları ve env'si özel yedekte aynen saklanır; image dışında çalışma ayarları değiştirilmez. PostgreSQL/Valkey yeniden başlatılmaz. Yeni özel DB/media/web/config/env yedeği alınır, checksum/gzip kontrol edilir ve dump ayrı DB'ye restore edilir. Eski/yeni image restore üzerinde aynı schema ve API yazma servisleriyle kontrol edilir; prova worker'ı yalnız bu ayrı DB'yi kullanabilir. Production migration komutu gereksiz yan etki üretmemesi için ancak journal farkı varsa değerlendirilir; bu paket migration eklemez.

İki sürüm aynı normal ücretli inşaat/araştırma/gemi siparişlerini ve event türlerini kullanır; yeni enum/payload yoktur. Bu nedenle normal uyumlu sıralı roll seçilir: API'ler tek tek, Arena ve singleton worker. Her adım health/image/SHA kapısını geçer. Sonrasında web artifact'i eski hash'li asset'ler korunarak yayınlanır; harici HTTPS, rules fence, kuyruk hataları ve guard kayıtları doğrulanır. Bot profili, kaynak veya tamamlanmış seviye için operatör SQL'i uygulanmaz.

Rollback yalnız tutulan uyumlu `fac449d8` image/web/config ile kod dönüşüdür. Yeni oyuncu yazıları üzerine eski dump geri yüklenmez; guardların normal bedelle aldığı varlıklar silinmez. Canlı kabulün gerçek SHA, image, yedek/prova yolları ve sonuçları sunucunun özel yayın kanıtında ve konuşmanın sonuç mesajında kaydedilir. Bu belge tek başına tamamlanmış deploy kanıtı değildir.
