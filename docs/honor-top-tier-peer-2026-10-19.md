# Honor: zirveden bir alt kademeye saldırı

Owner onayı: 19 Ekim 2026. Önce plan ve etki incelemesi, sonra TDD ile uygulama.

## Davranış

- Aynı galaksi/sezondaki en yüksek Honor kademesinde bulunan komutanın tam bir
  alt kademeye saldırısı, kademe değerlendirmesinde eşit rakip sayılır.
- Zirveyi paylaşan bütün komutanlar yararlanır. Alt kademeden yukarı saldırının
  mevcut üst kademe avantajı ve askeri değer koşulları korunur.
- Askeri değer oranı, gerçek hasar, saldırgan kayıpları, ilişki, tekrar, misilleme,
  ortak tarafın pozitif Honor yasağı ve ±1 saldırı izni değişmez.
- En yüksek kademe, mevcut galaksi üyelerinin Honor'da kullanılan sezonluk
  kademe zirveleri ve henüz gözleme yazılmamış mevcut Core'ları ile belirlenir.
  Ayrılan oyuncular, başka galaksiler ve sahipsiz dünyalar zirveyi yükseltmez.
  Honor'a katılmayan bot ve yönetici hesapları da zirveyi belirlemez; mevcut
  Honor uygunluk kuralları kullanılır.
- Gönderimde `galaxyTopTier` sabitlenir. Uçuş, geç sonuç ve yeniden hesaplama
  güncel galaksi zirvesini tekrar okumaz. Alanı bulunmayan eski kayıtlar eski
  kuralla hesaplanır; veri göçü veya geçmiş puanların değiştirilmesi gerekmez.
- Bir oyuncu daha yüksek kademeye ulaştığında yeni gönderimlerde yeni zirve
  kullanılır. Önceden gönderilmiş saldırının koşulları değişmez.

## Dokunulacak yerler ve riskler

1. `packages/rules/src/honor.ts`, `honorTeam.ts`: tek karşılaştırma kuralı ve
   saldıran tarafa uygulanması. Savunanın yukarı rakip avantajı korunmalı.
2. `honorReference.ts`, `honorTarget.ts`: aynı sunucu kaynaklı zirve hesabı.
   Önizleme salt okunur kalmalı; özel sayılar istemciye gönderilmemeli.
3. `honorCommitment.ts`, `honorAccounting.ts`: isteğe bağlı, pozitif tam sayı
   alanın doğrulanması ve kalıcı kanıtta korunması. Eski kanıtların özeti,
   idempotency ve yeniden hesaplama sonuçları değişmemeli.
4. `honorBattleEvidence.ts`, `honorStrategic.ts`: normal/ortak/anıt savaşları,
   EMP, önleme ve radyasyon aynı gönderim koşulunu taşımalı. Kaynaklardan birini
   unutmak oyuncuya aynı hedef için çelişkili Honor sonucu verir.
5. Hedef API şeması, `HonorTargetCard`, altı dil: yalnız istisnanın uygulandığını
   belirten `topTierPeer` bayrağı; eşit kademe sayılmasının nedeni ve ters yön
   avantajı açıklanır. Yeni sayfa veya ek etkileşim gerekmez.

Zirve okuması yeni oyun/oyuncu kilidi almayacak; mevcut kilit sırası korunacak.
Mevcut çalışma alanındaki ilgisiz değişiklikler korunacak.

## TDD ve doğrulama

Önce başarısız test: 8→7 eşit değerlendirme; 7→8 avantajı; 7→6 normal kural;
zirve 9 iken 8→7 istisnasız; tam bir alt kademe sınırı; eşit zirve; düşük/boş
askeri değer; ilişki/ortak taraf/kayıp sınırları; yanlış sayılar; eski kayıt.

Sunucu testleri: gerçek gönderim ve hedef API'si; başka galaksi ve sahipsiz
dünya; sezonluk Honor kademe zirvesi; uçuş sırasında zirve değişimi; tekrar
gönderim, rollback, geç olay ve eşzamanlı hesap; normal ve stratejik kanıt.
Arayüz testi: açıklama ve eski API yanıtıyla uyumluluk.

Owner'ın sonraki açık talimatı: yalnız Honor ve etkileyebileceği yollar test
edilecek; bütün testler çalıştırılmayacak. Başlatılmış geniş koşu durduruldu;
tam sunucu/web kabulü sayılmayacak. Honor regresyonu, ilgili saldırı kademe
sınırları, typecheck ve değişen dosyaların lint'i sıralı, tek worker ve en fazla
4 GiB Node heap ile çalıştırılacak. Ekonomi/season simülasyonları
çalıştırılmayacak. Hedef kartı 350 px ve masaüstünde
`node tools/visual.mjs` üzerinden görsel doğrulanacak.

## Sonuç

Uygulama ve owner'ın daralttığı kapsamdaki doğrulama tamamlandı. Bu geliştirmeye
ait açık CR bulgusu kalmadı. Canlıya dağıtım veya Honor etkinleştirmesi yapılmadı.

## Ayrıntılı CR

- **Düzeltildi:** İlk zirve sorgusu, Honor dışındaki bot/admin hesaplarını da
  sayıyordu. Bu hesapların yüksek Core'u gerçek liderin istisnasını kapatıyordu.
  İki önce-fail test ardından sorgu mevcut Honor uygunluğuyla hizalandı.
- **Regresyon kapsamı korundu:** Eski iki kişilik zayıf hedef fixture'larında
  saldırgan artık lider istisnasına giriyordu. Normal raid'in zayıf hedef testi
  üçüncü, daha yüksek komutanla korunuyor. EMP/radyasyon gerçek worker testleri
  hem lider hem lider olmayan saldırgan için ayrı beklenti taşıyor.
- Önizleme ve gönderim aynı tek-snapshot sorguyu kullanır. Gönderim retry'ı
  önceki kaydı döndürür; zirveyi değiştiremez. Sorgu yeni row lock almaz.
- Normal, destekli, ortak ve anıt savaşları `honorBattleEvidence` üzerinden;
  EMP, önleme ve radyasyon `strategicHonorEvidence` üzerinden sabit zirveyi taşır.
- Tek olay ve aynı anda gelen olayların hesabı aynı `honorTeam` kuralını kullanır.
  Yeniden hesaplama galaksinin güncel durumunu okumaz. Alanı olmayan eski
  kanıtların JSON/hash yapısı ve eski sınıflandırması korunur.
- İstisna yalnız saldırganın aşağı yönlü kademe sınıflandırmasını değiştirir.
  Savunanın ve yukarı saldıranın üst kademe bonusları, askeri değer bantları,
  kayıp kesintileri, ortak taraf kısıtı, çift tavanı ve uygunluk korunur.
- Eşit sayılan saldırı zayıf hedef tekrarı üretmez ve misilleme bütçesi tüketmez;
  gerçek zararın karşı tarafa misilleme hakkı üretmesi mevcut kuralla devam eder.
- API yalnız `topTierPeer` bayrağını döndürür; zirve sayısı ve askeri değerler
  istemciye eklenmez. Eski API yanıtlarıyla uyumludur.

## Doğrulama kanıtları

- İlk kural RED: 21FAIL/8PASS; mevcut davranıştan kaynaklanan sınıflandırma ve
  puan farkları doğrulandı. Hedef kartı RED1/5PASS; yardım metni RED1/8PASS.
- İzole DB sunucu RED8/2PASS; ortak test veritabanındaki önceden var olan
  migration/schema uyumsuzluğu bu göreve ait DB'ye taşınmadı. Ortak DB onarılmadı.
- CR bot/admin testleri RED2 görüldükten sonra uygunluk filtresi düzeltildi.
- Son sunucu: **54 dosya / 431PASS / 2skip**, 447,93s. Bütün Honor dosyaları,
  `monument-honorees`, radyasyon/Honor saat sınırı, saldırı kademe bandı ve Core
  kademe onayı dahildir. Atlanan iki varyant eski ruleset'te kaçış/geri çağırma
  koşullarıdır; güncel ruleset karşılıkları geçti.
- Son web: **10 dosya / 174PASS**, 16,32s. Honor arayüzleri, API şeması, yardım,
  fiyat yenilemesi, solo kuralı, i18n ve Türkçe metin regresyonları dahildir.
- Owner'ın kapsamı daraltmasından önce tamamlanan kural paketi: **141 dosya /
  2.522PASS**. Bunun ardından başlatılan genel sunucu koşusu owner talimatıyla
  durduruldu; bütün proje testleri geçmiş gibi sunulmaz. Ekonomi/sezon simülasyonu
  ve snowball audit çalıştırılmadı.
- Son kural + sunucu typecheck **PASS**. Daha önceki genel web typecheck, bu işe
  başlamadan değişmiş olan topluluk politikası API fixture'ları ve klan testindeki
  `exact` seçeneğinde 11 hata verdi; Honor dosyalarında tip hatası bildirmedi.
  İlgisiz dosyalar bu görevde değiştirilmedi; genel web typecheck PASS sayılmadı.
- Değişen kaynak/test/tool dosyalarının lint'i: **26 dosya / 0 hata**, üç sıralı
  grup (15 server/rules, 10 web, 1 tool). Genel lint PASS iddiası yoktur.
- Gerçek tarayıcı: **168 ekran**, altı dil × 350/1280 px; yeni istisna kartı 12
  birleşimin tamamında görünür, çevirili ve taşmasız. TR350 görüntüsü ayrıca
  açılarak incelendi. `node tools/visual.mjs out/honor-top-tier-peer --honor`.
- `git diff --check` **PASS**.

Son loglar: `/tmp/astera-honor-top-tier-{server,web,types}-final.log`;
lint sonuçları ve görsel ölçümler `out/honor-top-tier-peer/` altındadır.
Koşular ayrı kapsamlardır; test sayıları benzersiz toplam gibi toplanmamalıdır.

Owner'ın sonraki isteğiyle yapılan salt okunur canlı incelemede EU-1/EU-2
v4/SHADOW, bütün 118 olay ranked=false, ekonomik avantajlar kapalı ve olay/pay
toplamlarıyla kalıcı toplamlar arasında 0 fark görüldü. Yeni zirve terimini taşıyan
canlı gönderim kaydı yoktur. Oyuncu puanları ve zaman bilgisi özel çalışma çıktısı
`out/honor-top-tier-peer/live-honor-2026-10-19.md` içindedir. Canlıda hiçbir
yapılandırma veya puan değiştirilmedi.
