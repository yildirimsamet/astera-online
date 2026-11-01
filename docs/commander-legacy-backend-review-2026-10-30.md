# Komutan Mirası — backend incelemesi

Durum: inceleme ve geniş doğrulama sürüyor. Bu dosya tamamlanmış teslim iddiası değildir.
Dal: `codex/commander-legacy-20261030`; temel: `ca5e40a5`.

## İncelenen sınırlar

1. Kalıcı hesap / silinen sezonluk oyuncu ayrımı, wipe, reclaim ve Silent Space.
2. Gerçek sezon süresi, 12 gün sınırı, ayrı Honor/Hâkimiyet dereceleri, %80 etkinlik.
3. Olay tekrarları, arşiv/toplam çakışması, gecikmiş teslim, eşzamanlı kilit sırası.
4. Başarımların gerçek oyun işlemlerine bağlanması, üretim türü ve hedef benzersizliği.
5. Giriş zorunluluğu, vitrin/unvan sahipliği, kapalı kanıtlar ve yönetici yetkisi.
6. Kazanım tarihi doğruluğu, ödeme ve iadeler, istemci sözleşmesi, sınırlı sayfalama.

## Bulunan ve testle düzeltilen sorunlar

| Sorun | Etki | Düzeltme / kanıt |
|---|---|---|
| Gecikmiş olay eski gözlem zamanı taşıyor | Daha sonra kazanılmış geçerli ödüller geri alınabiliyor | Değerlendirme zamanı son ödül tarihinin gerisine gitmez; ledger regresyonu |
| Miktar özeti + sonradan gelen eski olay | Aynı üretim iki kez sayılabiliyor | Arşiv sınırından önceki olaylar özetin içinde değerlendirilir; geç yeni eylemler eklenir |
| Tarihi bilinmeyen tek eski metrik | Başka başarımların doğru tarihleri kaybolabiliyor | Kazanım zamanı metrik/eşik başına; farklı metrik ve yıl pini testi |
| Ödeme teslimi/iadesi yalnız sonraki profil açılışında görünür | Başka oyuncu eski koleksiyonu görebiliyor | Paddle, Polar, Shopier işlemlerinde aynı transaction sonunda yenileme |
| Sezon özeti döngü boyunca Silent Space üretimini içeriyor | Ana galaksiye kanıtlanmamış katkı yazılabiliyor | Karışık özet aktarılmaz; ayrı kanıtlar korunur |
| Erken kapanış yalnız sayaç sahibi hesapları yeniliyor | Ana galaksiden ayrılmış, yalnız yıl pini olan hesap ödülü tutabiliyor | Sayaç + katılım + aktif gün + anıt aralığı sahipleri birlikte değerlendirilir |
| Backfill yalnız sezon-result kadrosunu değerlendiriyor | Ayrılmış komutan önizlemede görünmüyor | Kalıcı kanıt sahipleri de sıralı kilitlerle değerlendirilir; önizleme/apply eşitliği testi |
| Sonda yalnız rapor dönüşünde sayılıyor | Gönderilmiş, kaybolmuş sonda sayılmıyor | Gerçek gönderim transaction'ında kayıt; dönüş tekrar tesliminde çoğalmaz |
| Gelişim saati gerçek oyun eylemlerinin tamamını kapsamıyor | Sonda/madencilik/nakliye/ticaret günü aktif sayılmıyor | Miras etkinliği ayrıca kaydedilir; mevcut hareketsizlik saati değiştirilmez |
| Geçmiş kayıtlar reclaim/transfer sırasında silinebiliyor | Kanıtlanabilen eski başarımlar kayboluyor | Temizleme/taşımadan önce sahipliği bilinen kanıtları hesaba bağlama |
| Olay bekleyen canlı HOLD süresi henüz kalıcı aralığa yazılmamış | Profil gerçek anıt süresini eksik gösterebiliyor | Profil/ilerleme okumalarında mevcut kilitli anıt zaman çizelgesiyle uzlaştırma; canlı ve ölmüş filo için API testi |
| Aşırı büyük sezon sayfalama imleci DB integer sınırını aşıyor | Hatalı istek 500 dönebiliyor | İmleç PostgreSQL int32 sınırında doğrulanır; alt/üst sınır ve aşırı büyük değer API testi |

## Mimari değerlendirme

- Oyun ve muhasebe kilitleri önce, kozmetik profil kilitleri transaction sonunda ve
  hesap sırasıyla alınır. Ödül ve kaynak oyun işlemi birlikte commit/rollback olur.
- Benzersiz kaynak kimliği aynı olayı iki kez saydırmaz. Ödül benzersizliği hesap,
  tanım, eşik, edisyon üzerindedir; bütün eşikler koleksiyonda kalır.
- Vitrin ve unvan için veritabanı sahiplik FK'leri yanında servis doğrulaması vardır.
- Açık projeksiyon hesap ID'si, e-posta, kullanıcı adı, bot işareti, özel kanıt veya
  güncel filo/kaynak/etkinlik zamanı yayımlamaz. Yalnız giriş yapan hesaplar okuyabilir.
- Yönetici geri alması otomatik yeniden değerlendirmeyle açılmaz. Gerekçeli geri
  yükleme yalnız özgün koşul hâlâ kanıtlanabiliyorsa ödülü etkinleştirir.
- Liste API'leri sınırlandırılmıştır; koleksiyon ve geçmiş anahtar bazlı sayfalanır.
- Eski kayıtların kapsam sınırları plan dosyasında açıkça belirtilir; veri uydurulmaz.
- Yayından sonra tanım kimliği, mevcut eşiklerin anlamı ve edisyon kimliği sabittir.
  Yeni kategoriler yeni tanımlarla eklenir. Eski bir kazanımın anlamı değişecekse salt
  katalog düzenlemek yerine açık veri/rule-version geçişi gerekir.

## Son incelemede düzeltilip doğrulanan profil ayrıntıları

- Kesin yeni olaylardan kazanılmış kariyer ödülünün kaynak sezonunu ayrıntıda koruma.
- İsmi boş bırakılmış galakside ad yerine galaksi kodunu kullanma.
- Sezonluk oyuncu kaydı artık yokken arşiv sonuç kimliğiyle kalıcı profile ulaşma.
- Eski katılım makbuzu aynı takvim yılı içindeyse yıl pininin kanıt kapsamı.
- Eski ücretli kozmetik hakkının, sahibi kendi profilini açmadan da ziyaretçiye görünmesi.
- Ödül ve sahip sayısını aynı SQL snapshot'ında okuyarak geri alma yarışı sırasında
  tutarsız sahip sayısı yayımlamama.
- Süren HOLD'un gerçek süresi profil açıldığında uzlaştırılır. API okuması aktif gün
  sayılmaz; son geminin gerçek ölümünden sonraki süre yazılmaz.

## İşletim

Önizleme: `NODE_OPTIONS=--max-old-space-size=1024 pnpm --filter @astera/server exec tsx src/cli/legacy.ts backfill --limit 12`

Uygulama aynı komuta `--apply` ekler. Sonraki sayfa için JSON sonucundaki `nextCursor`
değeri `--cursor UUID` olarak geçirilir. Önizleme profil/kanıt/ödül yazılarını rollback
eder. Yardım ve hatalı komut doğrulaması veritabanı bağlantısından önce çalışır.

Migration'lar canlıya uygulanmadı. Geliştirme ve test yalnız ayrı worktree ve disposable
test veritabanlarında yapılır. Frontend/Blender ve deploy bu backend incelemesinin dışındadır.

## Son doğrulama

- Geniş server koşusu: **35 dosyada 724 test geçti** (iki bağımsız disposable DB).
- Son profil/sezon düzeltmelerinden sonra Miras + finalizer koşusu: **48 test geçti**.
- Canlı HOLD ve gerçek ölüm sınırı için yeni API regresyonları: **2 test geçti**.
- Tüm workspace typecheck'leri geçti (rules, server, web, sim; simülasyon çalıştırılmadı).
- Server lint grubu sıfır hata ile geçti. Kalan lint grupları ve son regresyon bekleniyor.
