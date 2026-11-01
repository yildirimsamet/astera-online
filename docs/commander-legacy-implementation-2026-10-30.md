# Komutan Mirası — uygulama kaydı

Durum: backend akışları uygulandı; kapsamlı regresyon ve son kod incelemesi sürüyor. Yayında değildir. Frontend ve 3D
varlıklar henüz geliştirilmedi. Bu kayıt, tamamlanmamış işi teslim edilmiş gibi göstermez.

Çalışma alanı: `/home/yildirim/.codex/worktrees/aeab/blindspace`.
Dal: `codex/commander-legacy-20261030`; temel: yeni menü/profil release'i `ca5e40a5`.
Ana çalışma alanındaki kaydedilmemiş değişikliklere dokunulmaz.

## Kullanıcının kesinleştirdiği ürün kuralları

- Hesap kalıcı; Miras ödülleri kozmetiktir. Mevcut sezon kaynak ödülleri ayrı kalır.
- Kariyer başarımları sezonlar arasında birikir, bütün eşiklerin parçaları korunur.
- Honor ve Hâkimiyet galaksi bazında ayrı kupa aileleridir.
- Sadık Komutan: sezonun ilk 24 saatinde katılım, gerçek oyun eylemi yapılan sezon
  günlerinin en az %80'i. Aynı döngüde galaksi değiştirmek günleri iki kez saydırmaz.
- Yıl pini hesap yaşı değildir; ilgili takvim yılında oyun oynamanın hatırasıdır.
- 12 günden kısa kapanmış sezonların hiçbir verisi başarım hesabına alınmaz.
  Canlı sezonda kazanım bekletilmez; erken kapanış geçersiz katkıyı geri çeker.
- Koloni Avcısı: rakibin kolonisini saldırıyla nötrleştirmek yeterlidir. Ardından
  kolonileştirmek gerekmez. Nötr kolonileştirme ayrı başarımdır.
- Asteroitler farklı kayalar olarak sayılır. Stratejik silahlarda fırlatma sayılır.
- Klan savunma desteği, sohbet, Zorba kaldırılmıştır. Klan ortak filo saldırısı kalır.
- Araştırmacı: aynı sezonda tüm araştırmaları son seviyeye getirmek.
- Gemi üretim plaketleri gemi türü başınadır.
- Anıt süresi şahsi filonun gerçekten HOLD'da kaldığı sürelerin birleşimidir;
  eşzamanlı birden fazla filo/anıt bir saati ikiye katlamaz.
- Kanıtlanabilen eski başarımlar verilir. Eksik kanıt ve kazanım tarihi uydurulmaz.
- Profilleri yalnız giriş yapanlar görebilir. Hesap seviyesi/ödül puanı eklenmez.
- Önce backend temiz ve testli tamamlanır; sonra frontend. Profilde raflı 3D vitrin,
  altında geçmiş sezon kartları istenir. Yeni menü ve `/profile` korunur.
- Model aşamasında kullanıcının bulduğu modeller incelenir; ayrıca Blender için
  ayrı bir subagent kullanılması açıkça istenmiştir. Backend delegasyonu istenmemiştir.
- Tek kaliteli, tamamlanmış yayın hedeflenir; eksik bir ilk sürüm yayınlanmaz.

## Uygulanan temel

- Saf katalog ve 12 gün, eşikler, araştırma tamamlığı, anıt birleşimi, %80 kuralları.
- Kalıcı profil, ödül, vitrin, etkinlik günü, katılım, kanıt ve saldırı niyeti tabloları.
- Kaynak olayı benzersizliği, sahipliği doğrulayan FK'ler, kozmetik sonlandırma fazı.
- Üretim, araştırma, silah fırlatma/durdurma, korsan, asteroit, sonda,
  kolonileştirme/nötrleştirme ve ortak savaş kayıt bağlantıları.
- Başarımlar için saldırı anındaki tier'lerin saklanması ve gerçek savaşta değerlendirme.
- Kapanışta ham kanıtları koruma, kanıtlanan arşiv üretimini aktarma ve ödül değerlendirme.
- Giriş zorunlu profil, koleksiyon, geçmiş, ilerleme, vitrin/unvan API'leri.
- Ödül ayrıntısı, sahip sayısı, koşul ve kaynak sezon API'si; istemci Zod sözleşmeleri.
- Sezonluk oyuncu silindikten sonra arşiv sonuç kimliğiyle kalıcı profile ulaşma.
- Profil/ilerleme okumasında canlı anıt süresini gerçek zaman çizelgesiyle uzlaştırma;
  ölmüş gemiden sonraki süre veya API okumasından aktif gün üretmeme.
- Üç sağlayıcıda satın alma/iade ile anlık koleksiyon yenilemesi; manuel skin ücretli sayılmaz.
- Sonda gönderiminde sayılır; normal/anıt sonda kaybı kazanılmış gönderimi geri almaz.
- Madencilik, sondalar, kolonileştirme, nakliye, ticaret ve klan desteği aktif gün kaydına
  girer. Klan desteği başarımı yoktur; bu kayıt yalnız gerçek oyun gününü ispatlar.
- Reclaim ve Silent Space geçişinden önce eski kanıtları kalıcı hesaba aktarma.
- Tarihsel araştırma, anıt sondası, ortak anıt saldırısı ve yaşayan filonun kanıtlanmış
  anıt süreleri. Bilinen gerçek gönderim tarihleri eski aktif günleri de kanıtlayabilir.
- Sınırlandırılmış CLI: önizleme bütün yazıları geri alır, `--apply` tek sayfa uygular.
- Yöneticiye özel kanıt/geri alma listesi, gerekçeli geri alma ve yalnız koşul hâlâ
  sağlanıyorsa geri yükleme; kalıcı denetim kayıtları.

## Kalan zorunlu işler

- Son paket lint ve son değişiklikleri kapsayan regresyon sonuçlarını tamamla ve kaydet.
- Ayrıntılı backend incelemesini sonuçlandır: [inceleme kaydı](commander-legacy-backend-review-2026-10-30.md).
- Eksik görsel asset manifesti, lokalizasyon ve kullanıcıya kazanım koşulları.
- UI/3D tasarımı, gerçek modeller, mobil performans ve görsel doğrulama.
- İlgili olağan regresyonlar, sözleşmeler, tüm typecheck/lint. Uzun ekonomi/sezon
  simülasyonlarına izin yok. Sonra kullanıcı bağlamına uygun deploy hazırlığı.

## Eski veride kanıt sınırları

- Kapanmış sezonun gerçek süresi 12 günden azsa bütün katkı dışarıda kalır.
- Eski sezon özeti üretimi döngü boyunca toplar; Silent Space'e taşınmış bir hesabın
  karışık özeti ana galaksi üretimi diye aktarılmaz. Ayrı, kanıtlı olayları korunur.
- Bir geminin üretim özeti kesin miktarı ispatlayabilir, kesin kazanım gününü değil.
  Bu durumda `earnedAt: null` döner; değerlendirme günü kazanım günü gibi gösterilmez.
- Silinmiş oyuncu kimliğini güncel gezegen sahibine bağlayarak ödül verilmez.
- Kaybolmuş anıt filosunun son işlem zamanı son geminin gerçek ölüm anını ispatlamaz;
  güvenilir kalıcı aralık yoksa bu geçmiş süre uydurulmaz.
- UTC takvim yılı ve sezon başlangıcından itibaren 24 saatlik aktif gün kullanılır.

## Test çalıştırma notu

İzole DB: `astera_legacy_20261030_1943_test`, yerel `astera-pg`, port 5433.
Kimlik bilgileri mevcut yerel test varsayılanıyla aynıdır. Canlı DB'ye erişilmedi.
İş bittiğinde bu görev için yaratılan DB kapatılıp silinmelidir.

Kısa hedefli test: `nice -n 10`, tek worker, 1024 MiB heap. Orta/uzun test grupları
2–3 worker, her worker ayrı disposable `_test` DB ve 1024–1536 MiB heap ile;
çalışma alanları sırayla, test/typecheck/lint aynı anda çalıştırılmaz. Ana çalışma
alanındaki 30 Ekim owner kuralı eski checkout'taki 9 Ekim tek-worker kuralını günceller.
Typecheck geniş programı 1536 MiB'de OOM verdi, 3072 MiB'de tamamlanıp bir null
owner hatası buldu; düzeltildi. 4096 MiB üstü kesinlikle yasaktır.

Kırmızı/yeşil döngü görülen testler: `packages/rules/test/legacy.test.ts`, server
`legacy-ledger`, `legacy-events`, `legacy-archive`, `legacy-api`, transaction-finalizers
ve mevcut build/loyalty/mining/monument/probe/pirate/clan-war/multi-world testlerindeki
yeni kritik beklentiler. Bunlar daha geniş regresyon yerine geçmez.
