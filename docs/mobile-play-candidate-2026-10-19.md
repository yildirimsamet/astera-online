# Google Play kapalı test yayın adayı —19Ekim2026

Owner19Ekim açıkça gerekli sayfaların/backend canlıya alınmasını, güncel imzalı AAB oluşturulup Play Console'a verilmesini istedi. Henüz paket yüklemediğini doğruladı: versionCode1/versionName1.0.0 hedefi. Kanal tercihi doğrudan **kapalı test**; dahili test yayımlanmayacak.12testçi/kesintisiz14gün sonrası production başvurusu ayrı adımdır; otomatik publicyayın yok.

Kaynak962439cc tabanında ayrı `release/play-candidate-20261019` worktree'de sabitlendi. Devam eden Honor top-tier ve UnknownSignalGuide değişiklikleri bu adayda yok. Dosya incelemesinde FocusPanelnativeBack,frames/lifecycle/modelmetadata mobile çalışmasına ait olduğu doğrulanıp korundu. Locale shell ve APIşeması içindeki yalnız Honor parçaları çıkarıldı; ana çalışma ağacına dokunulmadı. Adaytamtest/build/commit/push/migrationrehearsal/rollout/Console kabulü henüz yapılmış sayılmaz.

Canlı19Ekim17:26TR: EN/TRsilmeURL404; privacy/community200eskiyayın. Yerelde yeni sayfalar, silme, reports/block/policy ve medya inceleme modülleri var. Owner'ın görünenad/klanadı moderasyonu ve onaylısilmehesabına yeniuçuş kararı bekleniyor; genericdeploytalimatı bu ürünkararlarının yanıtı sayılmadı.

Native dışmedya217modültesti ve36 gerçek browserdurumu geçti; yeni APK/cihaztesti değildir. Webgibi görünennativebundle/Android/iOS'a üçüncütarafembed kapalı, dışbağlantılar açıkseçimle. AndroidgelecekiOS tekAPI/hesap sözleşmesi korunuyor.

İlk tam web koşusunda iki RED bulundu: pending claim/Back testi yeni açık kural onayını vermediği için başvuruyu başlatmıyordu; fixture açık checkbox eylemi ve Back öncesi çağrı kanıtıyla güncellendi. Landing hesap ipucunda temada tanımlı olmayan text-xs bulundu; mevcut text-caption kullanıldı. Tam koşu diğer hataları görmek için sürüyor; bu düzeltmelerin GREEN kabulü ayrıca alınacak.

Yayın yedeği VPS üzerinde ~/backups/astera-play-release-20261019T143306Z konumuna alındı; DB/media/webroot checksum doğrulaması geçti. Son pointer yazımı eksik ~/.local/share dizininde hata verdi; dizin oluşturulup pointer güvenli modla yazıldı. Canlı servisler değiştirilmedi. Günlüklerin 30 günlük zaman sınırı ayrıca açık; bkz. mobile-log-retention-2026-10-19.md.

İlk tam web: 553 dosya, 7117PASS/11FAIL/29skip; beş hatalı modülün düzeltmeleri ve ilişkili akışlar 8dosya54PASS. Ana sorunlar yeni açık checkbox fixture'ı, lazy render için async beklenti, taşınmış AuthDialog audit yolu, locale CSP'nin dördüncü header konumu ve tanımsız tipografi token'ıydı. Ayrıca kapatma düğmesinde gerçek stray tap RED→useOwnPress→GREEN kapatıldı. Tüm workspace typecheck ve üç lint grubu PASS. Olağan rules 140dosya2493PASS. Son iki Nginx testinin eklenmesi sonrası final frontend tam kabulü açık.

İlk tam server koşusu disk tabanlı disposable test DB'nin TRUNCATE DataFileImmediateSync beklemeleri nedeniyle kesildi; PASS sayılmaz. Aynı PostgreSQL16 ve fsync ayarları korunarak yalnız yeni task-owned tmpfs container'a geçildi: astera-play-test-pg-20261019, loopback5440, DB astera_release_test, 768MiB/container ve 512MiB/tmpfs, CPU1. Son tam server koşusu burada tek worker/nice10/heap2048 ile sürüyor. Başka projenin veya dev DB'nin verisi kullanılmadı.
