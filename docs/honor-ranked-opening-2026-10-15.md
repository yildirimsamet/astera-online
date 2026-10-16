# Kapalı Honor'dan görünür yarışa geçiş

Owner 15 Ekim'de bu işlemin hazırlanmasını ve test edilmesini istedi.
Üretimde çalıştırma/deploy bu geliştirme işinin parçası değildir.

**16 Ekim güncel durum:** aşağıdaki 15 Ekim notları tarihsel kayıttır.
Silent Space ve diğer doğrulanmış hatalar düzeltildi. Yeni operator SHADOW
hazırlığı v4 seçiyor; mevcut donmuş sezonlar değişmiyor. Açılış, gerçek özel
silah uçuşları, ödül ve devir provası ile son kontrol sonuçları
[v4 release kaydında](honor-v4-release-rehearsal-2026-10-16.md), ekonomik
program ve UI incelemesi [CR kaydında](honor-cr-2026-10-16.md) izleniyor.
Canlıda veya oynanabilir yerel sezonda açılış yapılmadı.

**15 Ekim review güncellemesi:** aşağıdaki açılış mekanizmasının testleri geçti;
ancak uçtan uca incelemede SHADOW'da da savaşı durdurabilen Silent Space dönüş
hatası ve ek adalet/entegrasyon sorunları doğrulandı. Görünür açılış hazır
sayılmamalı; canlı SHADOW gözlemi de önce bu hatanın düzeltilmesini gerektiriyor.
[Bulgular, test kanıtları ve düzeltme sırası](honor-full-review-2026-10-15.md).

**Ortak savaş politikası:** yeni hazırlanan sezonların varsayılan Honor sürümü
3'tür; ortak taraf pozitif kazanmaz. Mevcut v1/v2 yapılandırması, uçuş snapshot'ı
ve eski puanlar otomatik değiştirilmez. v2 hâlâ SHADOW adayıdır. Bu politika
değişikliği review'daki diğer lansman engellerini tamamlanmış hale getirmez.
[Sürüm 3 sözleşmesi](honor-solo-credit-2026-10-15.md).

## Kabul koşulları ve sınır

- `honor-open --season UUID` önce read-only preview verir; `--yes` atomik
  açılış yapar. Mevcut kod açık MAIN sezondaki desteklenen v1 veya v3 SHADOW
  konfigürasyonunu açar; bu kontrol lansmana hazır olduğu anlamına gelmez.
  Aday v2 politika/silah işleri tamamlanmadan açılamaz.
- En az 24 saat gözlem gereklidir; önerilen 2–3 günlük inceleme takvimine
  rağmen otomatik açılış yok. İnceleme/duyuru tamamlanınca operator çalıştırır.
- Puan, çift bütçesi, negatifler, zorbalık tekrarı ve karşılık bütçesi temiz
  başlar. Kapalı olayların değişmez kanıtı ve deneme sonucu saklanır; görünür
  rapora, geç replay'e veya sezon ödülüne karışmaz.
- Donmuş kataloglar, Core sezon tepe gözlemleri, bütün askerî gözlemler,
  üyelik/yardım ilişkileri, oyun envanteri, Hakimiyet ve sezon takvimi korunur.
- Yarış açılış zamanı ayrıca tutulur; veri toplama başlangıcı değiştirilmez.
- Sezon exclusive lock açılış/gönderim/varış yarışını sıralar. Eşit
  millisecond'da da açılıştan önceki kaynaklar kimlik ile dışarıda kalır;
  sonraki kaynaklar sayılır. Zaman damgasına bakıp tahmin yapılmaz.
- Kapalı dönemde commitment alan ama geç ulaşan WORLD/CLAN_WAR/MONUMENT
  saldırıları puanlanmaz. Kapalı başlangıçtan önceki eski uçuş istisnaları
  korunur. Yeni saldırıdaki kayıp commitment hata olmaya devam eder.
- Anıtta eski savunan HOLD veya dünyada eski destek yeni saldırıya karşı
  savunabilir; saldırının başlangıcı belirleyicidir. Hazırlığı önceden yapılmış
  klan havuzu açılıştan sonra gerçek saldırıya çıktığında sayılır.
- Retry ve eşzamanlı açılış puanları ikinci kez sıfırlamaz; rollback
  görünürlük/puan/bütçe/uçuş sınırını birlikte geri alır.
- UI'da açılış tarihi ve yalnız sonrasında gönderilen saldırıların sayıldığı
  anlaşılır. Gizli aşama oyuncuya puan veya ödül göstermez.

## Dokunulacak yerler / riskler

Additive migration ve Honor schema, opening service/CLI, journal replay
filtreleri, WORLD/CLAN_WAR/MONUMENT commitment okuması, public rapor filtreleri,
leaderboard wire/UI/6 locale. Fiziksel savaş math ve Hakimiyet math değişmez.
Silah adaptörleri bu işin dışında; aday2'yi açan bir kaçış kapısı eklenmez.

Özellikle kapalı olayların ACTIVE olduktan sonra raporda görünmesi, geç replay'in
eski puanları diriltmesi, kapalı dönemin harcanmış çift bütçesi ve provokasyonun
taşınması, aynı-ms sınırı, yanlış shard/sealed config, eski uçuşun gerçek
savaşını durdurma, operatör retry'sinin yeni puanları silmesi test edilecek.

Testler önce RED, sonra uygulama, ardından GREEN ve gerçek normal/ortak/anıt
akışları. PC için tek worker, sequential check ve düşük heap kullanılacak.

## Uygulama ve doğrulama

0167 migration iki alan ekler: `honor_seasons.ranked_at` ile gözlem ve yarış
başlangıcı ayrılır; `honor_events.ranked` ile saklanan kapalı kanıtlar görünür
rapor ve kronolojik yarış replay'inden çıkarılır. Mevcut ACTIVE kayıtları
migration'da mevcut başlangıcı ve puanlarını korur; SHADOW açılmaz.

`openHonorRanking` eksik referans, kapalı/bitmiş/future/WAITING sezon,
desteklenmeyen sürüm, aday2 ve 24 saatten kısa gözlemde yazmaz. Askerî güncel
durum açılış transaction'ında gözlenir; eski gözlemler silinmez. Puan
projection'ı ve bütün yarış bütçeleri boşalır. Önceden oluşturulmuş commitment
kaynakları ve gerçek eski pending uçuşlar, mevcut legacy listesine eklenip
dondurulur. Retry bu listeyi büyütmez. Skor/sezon invalidation'ları commit
ile mevcut açık istemcilere gönderilir.

Deneme puanları API'de görünmez. Raporlar ve geç replay yalnız kendi phase'ini
okur. Bilinen eski olayın tekrar settlement'ı ACTIVE yarışa puan eklemez;
bilinmeyen backdated yarış olayı reddedilir. Veri toplama `created_at` değeri
ve kataloglar değişmez. Üyelik/yardım geçmişi silinmez.

TDD RED: yeni servis yokken 20 test başarısız; sonraki CLI/API RED iki eksik
giriş noktasını, UI RED açılış açıklamasının eksikliğini gösterdi. GREEN:

- Bütün Honor server testleri + gerçek ortak anıt savaşları + sezon ödülleri
  + API contract: **35 dosya, 354 geçti, 2 mevcut legacy-only skip**.
- Son kapanış sınırı incelemesinde, yarış açılışından önceki saat ile seal
  yapılabildiği RED testle gösterildi; `sealHonor` ranked boundary'yi de kontrol
  edecek şekilde düzeltildi. Güncel açılış/CLI/gerçek raid/ödül/deferred tekrar
  kontrolü: **7 dosya, 61 geçti** (geniş kümedeki olaylar ve yeni sınır testi).
- Eski writer'ın SHADOW olayına kolon default'u ile yanlış `ranked=true`
  bırakması RED testle gösterildi. Açılış bütün mevcut SHADOW olaylarını
  deneme olarak işaretler; kanıt/sonuçlar korunur. Güncel açılış/CLI/gerçek
  raid seti bu ek korumayla **3 dosya, 41 geçti**.
- Leaderboard/Honor sonuç/i18n web: **4 dosya, 129 geçti**.
- Açılış ekranı: **6 dil × 350/1280 px = 12 görsel kontrol**; yatay taşma,
  çeviri ve Honor/Hâkimiyet hiyerarşisi kontrol edildi.
- Gerçek 1v1'in açılıştan önce/sonra aynı-ms gönderimi, geç varış ve retry;
  ortak dünya/anıt saldırısının önce gönderilmesi ve önceden hazırlanan
  havuzun sonra gönderilmesi; eski HOLD savunması; kapalı raporun görünür
  olmaması; eski kapalı puanların geç replay'de geri gelmemesi; concurrent
  operator; işlem sonundaki hata ile atomik rollback; migration backfill'i
  ve sıfır yarış puanının ödül üretmemesi bu kapsamda geçti.

Yerel oynanabilir DB sıfırlanmadı. 0167 uygulandı. Çalışma alanına daha önce
eklenmiş 0152 kaynak indeks migration'ının yerel journal'da atlandığı,
iki indeksin de gerçekten eksik olduğu doğrulandı. Yalnız yerelde gerçek SQL
ve tam migration hash/timestamp'ı tek transaction'da uygulandı; mevcut API/
worker kendi eski çalışma ayarlarıyla yeniden başlatıldı. Health ok, 4 yerel
oyuncu, bot0, failure0. Üretime hiçbir yazma/açılış/deploy yapılmadı.

Tam server typecheck, Honor değişiklikleri dışında
`transferReferences.ts:73` üzerindeki TS1360 ile kırmızı: ayrı radyasyon
bombası işinin `radiation_bomb_arrival`, `radiation_bomb_intercept`,
`radiation_bomb_intercept_impact`, `planet_radiation_boundary` türleri transfer
politika tablosunda eksik. Dosya bu işte değiştirilmedi. Web typecheck de
ayrı radyasyon değişikliğinin 1|2|3 seviyesi ile eski 1|2 fonksiyon sözleşmesi
uyuşmazlığı nedeniyle kırmızı: `RadiationHaze.tsx:86` ve
`radiation-lib.test.ts:206–207` TS2345. Bunlar genel yayın engelleridir;
tam repository typecheck GREEN denmedi ve hiçbir guard gevşetilmedi.
Honor'un server ve ilgili test kapsamının lint'i GREEN.
Web değişiklikleri, altı dil ve görsel kontrol aracının lint'i de GREEN.
Çalışma alanındaki ayrı iş daha sonra dört transfer politikasını ekledi;
güncel tam **server typecheck GREEN**. Bu dosyanın düzeltmesi Honor açılış
işine ait değildir. Yukarıdaki kırmızı sonuç, ilk inceleme anını kaydeder.
Son güncel **web typecheck hâlâ aynı üç TS2345 ile kırmızı**; Honor dosyaları
için tip hatası raporlanmadı. Genel web build için radyasyon seviye sözleşmesi
düzeltilmeli; başarılı Honor testleri bu kırmızı kontrolün yerine geçmez.
Yerel browser smoke: v18, 4 komutan, Core15, 23 hull türü, 17 araştırma,
30 galaksi dünyası; pageerror yok. Testler için yerel oynanabilir sezon
sıfırlanmadı veya SHADOW'a dönüştürülmedi.

## Operatör akışı

```bash
# Uyumlu build/schema ile gizli gözlemi başlatmak:
pnpm season honor-shadow --season UUID
pnpm season honor-shadow --season UUID --yes

# 2–3 gün gerçek veri incelemesi, kurallar/ödül ve başlangıç duyurusundan sonra:
pnpm season honor-open --season UUID
pnpm season honor-open --season UUID --yes
```

İşlem otomatik zamanlayıcı değildir. Açılış saati exclusive sezon kilidi
alındıktan sonra sunucu clock'undan alınır; preview saati rezervasyon veya
kesin gelecek takvimi değildir. Her MAIN sezon açıkça seçilir. Bir uçuşu
iptal etmek veya tamamlanmış savaşı değiştirmek gerekmez. Açılıştan önce
gönderilen saldırılardan sonra varanlar da yarış dışında kalır; eski filonun
yeni saldırıya karşı savunması sayılır.

0167 rollout'u sırasında eski Honor writer'ları yeni `ranked` alanını
bilmiyorsa SHADOW olaylarına default true yazabilir. Bu nedenle schema ve
uyumlu API/worker geçişi koordineli yapılmalı; eski/yeni Honor writer'ları
aynı anda çalıştırılmamalıdır. Canlı değişiklikten önce güncel kopyada
migration/geri dönüş ve gözlem→açılış rehearsal'ı yapılmalıdır. Bu geliştirme
kanıtları tek başına canlı dağıtım onayı değildir. Aday2/silah politikası için
mevcut ayrı bitirme ve kabul koşulları hâlâ geçerlidir.

Görünür açılıştan sonra kod geri dönüşü de yeni phase filtresini ve uçuş
sınırını anlamalıdır; eski, bütün deneme olaylarını aynı yarışa replay eden
Honor writer'a dönmek desteklenmez. Migration journal'ını geri almak veya
eski DB yedeğiyle yeni oyuncu yazılarını ezmek geri dönüş yöntemi değildir.
