# Gerçek savaş tekrarları — uygulama ve kabul

Asıl hedef: oyuncu gerçek savaş raporundan, o savaşta gerçekleşen atışları 3B
olarak izler. Bağımsız simülatör bunun ilk aşamasıdır; entegrasyon tamamlanmadan
görev tamamlanmış sayılmaz. Aynı izole worktree kullanılır.

## Sıra

1. Ortak motorda gerçek çözüme ait kayıt: normal/destekli baskın, savaş öncesi
   kaçışın gerçek son dalı, ortak klan saldırısı, korsan, anıt/klan/neutral hatları.
   Kayıt açık/kapalı aynı sonuç ve aynı RNG tüketimi üretir.
2. Büyük JSON'u rapor listesine taşımayan ayrı kayıt tablosu ve üretilmiş Drizzle
   migration. Savaş ve kayıt aynı transaction'da; yeniden teslim mükerrer üretmez.
3. Sunucuda katılımcı yetkisi: savunan ve savunma destekçileri kendi savaşını
   görür. Saldıran tarafın toplam muharebeye hazır silahlı `combatValue` değeri,
   savunmanın (aktif yer topları ve destekler dahil) en az %50'si ise saldıranlar
   tam tekrarı görür. Yük/hurdacı ve ateş edemeyen birlikler eşiği şişirmez.
   Owner 25 Ekim: mevcut `combatValue` oranı korunur; savunan yük filosunun
   eşik dışında kalmasından kaynaklanan bilgi açığının kabul edildiği teyit edildi.
   Eşik savaş başında dondurulur; güncel filo/araştırmayla tekrar hesaplanmaz.
4. Yetkili ayrıntı endpoint'i; yetkisiz/yetersiz güç/başka sezon/olmayan rapor
   ayrıntılı gemi veya araştırma sızdırmaz. Liste yalnız durum taşır.
5. Mevcut 3B oynatıcı ortak veri modelinden çalışır. Gerçek kayıt yeniden
   simüle edilmez; izleyici tarafı kendi cephesi altta olacak şekilde başlar.
   Sıradan ve anıt raporları ile bildirimden açılan rapor aynı izle eylemini sunar.
6. Gerçek transaction → kayıt → yetkili API → rapor → 3B son durum uçtan uca
   test edilir; mobil, hata/tekrar deneme/kapatma ve eski raporlar doğrulanır.

## Sınırlar ve doğruluk

- Eski raporların eksik atışları bugünkü istatistiklerle uydurulmaz.
- Başka oyuncunun UUID/operasyon iç kimlikleri görüntü kaydında gereksiz yere
  paylaşılmaz; oyuncu/filo bağları tutarlı görsel kimliklerle korunur.
- Kayıt bütçesi aşılırsa savaş sonucu değişmez ve yarım kayıt gerçekmiş gibi
  gösterilmez. Kaydın neden bulunmadığı UI'da açık olur. Savaş büyüklüğü sınırlanmaz.
- İlgili kayıt, rapor/sezon silinince temizlenir. Liste sorgusu büyük kayıt
  yüklemez. Büyük filolar yerel 400 birlik editör sınırıyla kesilmez.
- K01: owner 25 Ekim kararıyla global Söndürücü önceliği geri getirildi.
  Ortak motor ve kayıttaki ayrı Aegis ön ateş fazı aynı gerçek olayları taşır;
  görsel sıra yeni bir savaş hesaplamaz.

## TDD

Önce başarısız testler: çözücü paritesi ve kaçış son dalı; %50 sınırı ve kargo;
katılımcı olmayan, farklı sezon ve zayıf saldıran; müttefik sahipliği; eski kayıt;
atomiklik/yeniden teslim; API/Zod sözleşmesi; rapordan açma ve kapanma.
Server testleri yalnız bu iş için açılmış, adı `_test` ile biten ayrı DB'de çalışır.
Kontroller sıralı/tek worker, heap en çok 4 GiB; uzun ekonomi testleri kapsam dışı.

## Durum

- [x] Ortak kayıt ve gerçek çözücü bağlantıları
- [x] Kalıcılık, migration ve yetkili API
- [x] Rapor ekranı ve ortak oynatıcı
- [x] Entegrasyon, regresyon ve gerçek tarayıcı doğrulaması

## Entegrasyonda tamamlanan ayrıntılar

- Yeni `battle_replays` tablosu / üretilmiş `0197` ve `0198` migration: rapor ve kayıt tek
  transaction, tekrar teslimde değişmez; rapor/sezon silinince cascade temizlenir.
- Planet, destekli planet, ortak saldırı, korsan, tarafsız ve anıt üreticileri
  aynı yakalama katmanına bağlıdır. Eski raporlara yeniden savaş uydurulmaz.
- `GET /api/reports/:kind/:id/replay`: gerçek katılımcı / doğru sezon / başlangıçta
  dondurulmuş %50 oranı; liste yalnız `replayStatus` taşır, büyük JSON yüklemez.
- Özel tablo; istemcide yalnız tıklanınca yükleme, iptal sinyali, bellekten çıkarma,
  kapanınca rapora dönüş, hata/yeniden deneme, izleyici cephesinin altta başlaması.
- Korsan kargolarının savaş sonrası imha edilmesi ve anıt savunan kargolarının
  sonradan çekilmesi ayrı olaydır; uydurma atış/tur eklenmez. Tarafsız yer topları
  gerçekte yeniden kurulmadığı için tekrar ekranında kurtarıldı denmez.
- Görsel ek istek: 16 gemilik sıra, geniş Aegis'e göre saldıran mesafesi, gezegen
  yüzey normaline göre konumlanan ve dönen yer savunması ile tabanlar.
- Mobil geri/Escape önce atış günlüğünü kapatır; rapor yenilenmesi kamera/odak veya
  oynatma zamanını sıfırlamaz.

Kayıt sınırları: 2.000 fiziksel birlik, 100.000 isabet, 8 MiB JSON. Bunlar savaş
sınırı değildir. Bütçe aşılırsa gerçek savaş normal biter; tam tekrar yerine açık
bir bulunamama nedeni sunulur. Yarım kayıt yayınlanmaz.

Son kapsamlı inceleme ve kapatılan bulgular:
[battle-replay-review-2026-10-25.md](battle-replay-review-2026-10-25.md).

## Son doğrulama

- Ortak motor: 231 test / 12 dosya; gerçek savaş üreticileri ve yetki: 193 test /
  9 dosya; web: 301 test / 23 dosya. Modül indirme hatası için ek 18 test / 2 dosya.
- Rules, server ve web TypeScript kontrolleri; üç sıralı lint grubu; production
  web paketi geçti. Uzun ekonomi/sezon çalışması yapılmadı.
- Gerçek görev → transaction → kayıt → yetkili API → rapor → 3B zinciri,
  1600px saldıran ve 350px savunan olarak doğrulandı. Her iki izleyicide bütün
  gemilerin son can/kalkan/durumları kaydın son durumuyla birebir eşleşti.
- API hatasında tekrar deneme, modül indirme hatasında gerçek sayfa yenilemesi,
  kapanınca raporu koruma ve telefon atış dökümünde Escape davranışı geçti.
- Serbest simülatörün production paketinde 8 görüntü ve etkileşim kontrolü geçti;
  gerçek oyuncu API'sine hiç istek yapılmadı.
- Ek 10 etkileşim/GPU görüntüsü ve 2 model indirme hatası görüntüsü de geçti.
  Kaçış uçuşu/parkı, geri sarma, mobil odak, yatay telefon, GPU dönüşünde aynı
  zaman/gemi durumları ve model tekrarında tek savaş hesabı doğrulandı.

Kanıtlar: [gerçek savaş](evidence/battle-replay-2026-10-25/real-battle/evidence.json),
[serbest simülatör](evidence/battle-replay-2026-10-25/standalone/evidence.json).
Yerel inceleme: `http://localhost:5190/real-battle-preview` ve
`http://localhost:5184/?simulator=1`. Bağlantı hazır, canlıya yayın yapılmadı.
