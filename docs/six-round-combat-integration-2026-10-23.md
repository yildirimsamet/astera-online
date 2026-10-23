# Altı tur / rastgele dağıtım: üretim entegrasyon planı

**Yetki:** Kullanıcı asıl oyun koduna uygulama istedi; devamında testler temiz
çıkınca yalnız bu işe ait değişikliklerin deploy edilmesini açıkça onayladı.
Kontroller ve son inceleme tamamlanmadan deploy yapılmaz.
Temel üretim kodu `4d58d123`; kalibrasyon kayıtları `8523e634` ile sabitlendi.
Diğer işlerin kirli ana çalışma dizinine dokunmadan ayrı dal/worktree kullanılır.

## Son davranış sözleşmesi

- Altı tur. Her iki tarafın tur başındaki ateş hakkı korunur; aynı tur ölmek
  ateş hakkını kaldırmaz. Kaçanlar sonraki turlarda ateş/hasar almaz.
- Her silahlı geminin atışı, o anda hayatta olan bütün uygun hedeflere yeni
  rastgele ağırlıklarla paylaştırılır. Sınıf çarpanı paya bir kez uygulanır.
- Öldürülen hedefte artan hasar temel atış birimine geri çevrilip yeniden
  dağıtılır. Farklı sınıfa aktarım hasar üretmez; tek atışta birden fazla ölüm olur.
- Önce bütün silahlı hedefler; yük gemileri ve Hurdacı (`SUPPORT`) en son.
  Son silahlı hedef öldüğünde aynı atışın artanı ve sonraki atışlar kargoya gider.
- Aegis → kişisel kalkan → can. Turlar arasında kalkan/can yenilenmez.
  Radyasyon doğrudan cana vurur; sıfır can ölümdür.
- Kaçış yalnız **1–5. tur sonunda** yaşayan mobil gemilerde çalışır; 6. turda yok.
  Eşik azami araştırmalı gövde canına göredir, kalkan dahil değildir. Güç oranı
  savaş girişinde sabitlenir, silahsız kargo/Hurdacı güce eklenmez.

| Büyük/küçük güç | Güçsüz şans / can sınırı | Güçlü şans / can sınırı |
|---|---|---|
| 1–<1,5 | %10 / ≤%30 | %10 / ≤%30 |
| 1,5–<2 | %20 / ≤%46 | %10 / ≤%30 |
| 2–<3 | %28 / ≤%66 | %10 / ≤%30 |
| ≥3 | %40 / ≤%80 | %6 / ≤%26 |

- Temel gemi kalkanı %25, dört araştırma bonusu, gemi can/atakları, otomatik
  savaş öncesi 4× kaçış, 12 saat koruma ve yer savunması kurtarma aynı kalır.
- Kaçanlar kontrol/sonuç hesabında savaş dışı; fiziksel ölüm, hurda, Dominion
  imha puanı değildir. Kalıcı yaraları ve sahiplikleri korunur. Anıtta kazananın
  kaçanları HOLD'a döner; kaybeden kendi sağ kalanlarıyla eve döner. İki tarafta
  yalnız kargo kaldığında savunan kontrolü tutar.

## İncelenen yollar ve dokunulacak alanlar

1. `packages/rules/src/randomBattle.ts`: ortak dağıtım, hasar bütçesi, tur sonu
   kaçış, sahip bazlı kayıp/kaçış/hasar ve Aegis/Honor telemetrisi.
2. `constants.ts`, `battleRetreat.ts`: altı tur ve son tablo. Son tur kontrolü
   sabit `round < 3` yerine tur sabitinden türetilir.
3. `combat.ts`: solo/joint/supported bütün canlı yollar random motora delegasyon
   yapıyor. `shipShields:false` her tarafta açıkça verilen eski kohort yolu yalnız
   tarihî tekrar/golden testleri için var; sunucu bu bayrağı kullanmıyor. Bu yolun
   tarihî üç tur aritmetiği açıkça korunarak eski tekrarlar değiştirilmez.
4. `escape.ts`, `forecast.ts`, `monumentCombat.ts`, `pirates.ts`: ortak motorun
   sonuçlarını kullanıyor. 4× otomatik kaçışın iki kez çözümlemesi, başarı çizgileri,
   korsan kargo ele geçirme ve anıt kontrol/ganimet semantiği doğrulanır.
5. Sunucu `worker/handlers.ts`, `services/clanWarSettlement.ts`,
   `monumentArrival.ts`, `reports.ts`, `monumentReports.ts`: sonuçları kendi sahiplerine
   uygulama, kalıcı yaralar, destek/joint sahipliği, radyasyon, iade ve raporlar.
   Kalıcı round verisi JSON dizisi; DB şemasında üç tur üst sınırı bulunmadı.
6. Web rapor dizilerini zaten dinamik geziyor; API round dizisinde üç tur sınırı
   yok. Altı turu ve 4/5. tur kaçışını görebildiği regresyonla doğrulanır.
7. Wiki (`fleet-and-intel.ts`, `facts.ts`), `MonumentBattleRules` ve altı
   `locales/*/monument.ts`: eski tek hedef / üç tur / ilk iki tur metinleri güncellenir.
   Sayılar mümkünse kurallardan türetilir. Mevcut eski raporlar açılmaya devam eder.
8. `docs/game-design.md`, `balance.md`, `battle-reports.md`: güncel davranış açıklanır;
   önceki deney kanıtları tarihî kayıt olarak değiştirilmez.

## Başlıca kırılma riskleri

- Hasar aktarımında hedef sınıfını ikinci kez çarparak hasar üretmek; öldürülen
  hedefe veya erken kargoya tekrar ateş etmek; Hurdacı'yı kargo kapasitesinden
  dolayı yanlış sınıflamak; iki tarafın atışlarını sırayla uygulayıp avantaj vermek.
- Telemetride aktarılmış fazla hasarı iki kez saymak; gerçek gövde hasarı ve
  Aegis katkısı sınırlarını aşmak; arkadaşların kayıp/yaralarını birbirine yazmak.
- Ölüleri kaçırmak, kaçanları ganimet/hurda/puan için ölü saymak veya dönen
  geminin canını iyileştirmek. 6. tur sonuna yanlış ek kaçış koymak.
- Altı tur sabitinin tarihî kohort tekrarlarını değiştirmesi; istemci/yardımın
  hâlâ üç tur veya iki kaçış penceresi anlatması; eski raporların reddedilmesi.
- Tüm hedeflere dağıtımın O(saldıran × savunan) maliyeti. Büyük filo ve motoru
  tekrar tekrar çağıran saldırı önizlemesi süre/bellek ölçümü gerektirir.

## TDD ve doğrulama sırası

1. Önce başarısız kurallar testleri: son tablo/basamaklar, altı tam tur,
   5. tur kaçışı/6. turda kaçış yok, bütün hedeflere yayılma, aynı atışta taşma,
   karma sınıf/cargo/Hurdacı ve bağımsız Kale hasar bütçesi.
2. En küçük üretim değişikliği. Kalibrasyon modeliyle aynı input/tohumlarda
   dağıtım/sonuç/yaraların eşliği; gerçek Vantasia dizilimi dahil kontrol.
3. Kapsamlı normal kurallar testleri ve tarihî replay digesti; özellik testleriyle
   deterministiklik, sahiplik ve gemi/hasar/enkaz korunumu.
4. Sunucu mutlu yol + sınırlar: gezegen solo/joint/support, anıt solo/joint/support,
   taraflar yalnız kargo, kaçanlarla kazanma/kaybetme, NPC, radyasyon yaraları,
   landing/tamir ve rapor 4/5/6. tur görüntüsü. DB testleri tek işçiyle.
5. Web rapor/API/Wiki/i18n testleri; 350px ve masaüstünde ilgili kural/rapor
   yüzeylerinin görsel kontrolü. Eski üç tur raporu da test edilir.
6. Performans örnekleri ve source incelemesi; lint/typecheck/build uygun kapsamda.
   Test/typecheck/lint sırayla, tek CPU/işçi, 2 GiB cgroup, swap yok, 1536 MiB heap.
   Uzun ekonomi/sezon çalışmaları çalıştırılmaz.
7. Bulgular doğrulanır ve fixlenir; yapılanlar, kanıtlar ve kalan sınırlar raporlanır.

## Durum

- [x] Gereksinim ve ilk etki incelemesi / plan
- [x] Kurallarda RED → GREEN
- [x] Ortak yollar, sunucu ve rapor regresyonları
- [x] Web açıklamaları ve görsel doğrulama
- [x] Performans, lint/typecheck/build ve son inceleme
- [ ] Canlıya alma ve yayın sonrası sağlık kontrolleri

## İnceleme sırasında doğrulananlar

- 10 bağımsız, sabitlenmiş simülasyon örneğiyle bütün sayısal sonuçlar, sahiplik,
  yaralar ve kaçışlar birebir aynı. Eklenen `distributedFire` rapor işareti
  karşılaştırmadan ayrılıyor; örneklerin beklenen sayıları üretimden yenilenmedi.
- İlk tam rules geçişi, eski üç tur / eski tablo beklentilerini ve gerçek bir
  kayan nokta sınır hatasını yakaladı. Pozitif kalan can bir ULP'den küçükse
  `maxHP - kalanHP` tam `maxHP`'ye yuvarlanabiliyordu; eski yuvarlak yara çıktısının
  kodlaması artık yaşayan gemiyi 9999 bp ile temsil ediyor. Hassas HP modeli korunuyor.
- 150 sabit tohumlu karma sınıf/kalkan/kargo/Hurdacı özelliği, temel hasar bütçesini,
  ölü hedefte artan hasarı ve sahip bazlı gerçek gövde kredilerini doğruluyor.
- Aynı gövdeden kritik ve uygun iki geminin testinde yalnız `damageBp=9500`
  kontrolü yeterli değildi: aktif başlayan sağ kalan gemi `9500 + remainderBp`
  yarasıyla da kalabiliyor. Test ilk kritik geminin **tam** yara kimliğini kontrol ediyor.
- Dağıtımın büyük filolarda maliyeti doğrulandı. Aynı RNG/aritmetik sırasını koruyan
  çarpan önbelleği, yeniden kullanılan ağırlık dizisi ve yerinde hedef temizliği
  7270×7270 Dart örneğini yerel tek CPU'da yaklaşık 53 s → 16,5 s indirdi.
  14540×14540 örneği yaklaşık 38,8 s / 151 MB RSS; gerçek azami uçların maliyeti
  hâlâ yüksektir. Küçük ve orta savaşlar ayrı ölçüldü. Bu performans sınırı gizlenmez.
- Tarayıcı önizlemesi pahalı hesapları Web Worker'a taşıyor. Değişen filo/yara/okuma
  eski işi sonlandırıyor; aynı içerikle yenilenen API nesneleri işi iptal etmiyor.
  Eski sonuç yeni filoya gösterilmiyor. Hata halinde uydurma tahmin yerine açıklama var.
  Worker olmayan ortamlarda aynı ortak hesapla uyumlu geri dönüş bulunuyor.
- Yeni raporlara geriye uyumlu `distributedFire` tur işareti eklendi. Yeni hasar
  açıklaması yalnız bu işaretle gösteriliyor. Eski raporların sayıları değiştirilmedi.
- Anıt raporuna sahip bazlı tur kaybı/kaçışı ve karşı taraf toplam kaçışı eklendi.
  Eski kayıtta sahip bazlı ölüm telemetrisi yoksa tahminle kişisel kayıp üretilmiyor.
  Rakibin ilk filosu, kalan filosu ve yaraları ifşa edilmiyor.
- İlk tam kurallar doğrulaması: 158 dosya / 2899 test PASS; tarihî replay özeti PASS.
  Son web/sunucu, görsel, lint ve tip kontrolleri tamamlanınca aşağıya kaydedilecek.
- Yerel sunucu tip kontrolü 1536 MiB heap'e sığmadı. Tavan yükseltilmedi; VPS'te
  canlıdan ayrı kaynak dizini ve konteynerde 3 GiB heap / 4 GiB toplam sınır kullanıldı.

## Doğrulama kapsamının ayrıntısı

- Web'in tam normal paketi: 595 dosya; 7395 PASS, 29 skip ve tek eskimiş
  anıt haber testi. O test eski yardım metnindeki “3 tur” sayesinde yanlışlıkla
  geçiyordu; gerçek rapor `roundCount=5` ile azami `COMBAT.rounds=6` ayrı kontrol
  edildi. Düzeltilen dosya 20/20 PASS. Skip'ler mevcut isteğe bağlı testlerdir.
- Dağıtılmış yaralar yüzünden 50'den fazla sağlık grubuyla karşılaşmak artık daha
  olağan. Tamirhane “Tümünü seç” butonu bu durumda işlemi engelleyen bir seçim
  yaratıyordu. Aynı 50-grup API sınırı korunup buton açıkça “İlk 50 can grubunu seç”
  olarak kullanılabilir ilk parçayı seçer. Kullanıcı onaylamadan taşıma/onarım yok.
  Diğer gruplar kaybolmaz; sonraki işlemde alınır. TDD RED→GREEN, i18n dahil 110 PASS.
- Tarihî deney araçları `4d58d123` gövde motoru, tur sabiti ve kaçış politikasını
  git'ten okuyor. 16 başlangıç örneğinin bağımsız eski çalışma alanından alınmış
  SHA-256'sı `278123b86a78a6e51ea0d9c4c68a36d945afb85d63b190e903d53ff85439ef83`.
  50 araç testi PASS. Eski deneyin altı tura sessizce dönüşmesi engellendi.
- VPS kontrolünün ilk test PostgreSQL'i küçük tmpfs diski dolduğu için durdu;
  bu ortam hatası ürün bulgusu sayılmadı. Yalnız o geçici konteyner değiştirildi;
  canlı PostgreSQL'e dokunulmadı. Yeniden kurulan test DB disk volume kullanıyor.
- Sunucu kapsamı: battle/raid, anıt, solo/joint/support, Honor savaş kanıtları,
  escape/capture, NPC, iade, radyasyon/tamir, ganimet/enkaz/puan ve raporlarla
  ilişkili 78 normal test dosyası. Tam normal API sözleşme dosyası 102 test PASS;
  yeni altı turlu anıt sözleşmesi ayrıca API→istemci parserı üzerinden doğrulanır.
  Ekonomi/sezon/snowball uzun çalışmaları koşulmadı.

- Gerçek tarayıcı görsel kabulü: 350/1280 px, 6 dilde kurallar; TR/EN normal
  ve anıt raporunda altı tur/5. tur kaçışı, Wiki ve 51 gruplu onarım seçimi.
  22 kontrol PASS; Worker hesaplarken ana iş parçacığı zamanlayıcısı ilerledi.
  Görseller ve ölçümler `out/six-round-integration/visual/` altında.
- Yeni API sözleşmesi ve kalıcı yara kontrolü: iki gerçek DB testi PASS.
  Anıt lotlarının rasgele UUID sırası farklı olduğundan karşılaştırma kanonik
  yara gruplarıyla yapılır; lot kimlikleri yara bilgisine karıştırılmaz.

### Son bağlı test incelemesi

- Ortak filo dönüş testi 100 Dart'ın yeni dağıtımda hiç fiziksel ölüm vermediği
  bir savunma kullanıyordu; fiziksel kayıp + sağ kalan gerektiren dönüş senaryosu
  aynı gemi sayısı ve daha dayanıklı savunmayla yeniden kuruldu. 128 tohumda hem
  kayıp hem sağ kalan doğrulandı; gerçek DB dönüş testi PASS. Esas envanter/iniş
  eşitliği gevşetilmedi.
- Eski üç turluk kargo iade fixture'ında 6 tur sonunda küçük Kurye gerçekten
  ölüyor; rollback testi daha dayanıklı Argosi ile gerçek iade yolunu test ediyor.
- Bir savaş gemisi + kargo savunmasında, 6 turdan sonra tek Argosi ya ölüyor ya
  muharebeden kaçıyordu; zorunlu kargo tahliyesi fixture'ı iki Argosi ile kuruldu.
  Aynı tohumla ortak motordan alınan yaralar; anıt lotlarında, eve dönüşte ve
  raporda korunuyor. 12,5 döteryum, 4.000 rezervin kalan yakıt iadesi, mülkiyet,
  tek işlem/idempotency ve anıtın el değiştirmesi birlikte doğrulandı. 3/3 DB test PASS.
- Yeni klan savunması rapor testi: her iki savunanın tur kayıp/kaçış toplamı
  yalnız kendi nihai katılımcı satırına eşit. Rakibin yarası/kalan filosu ve ham
  oyuncu telemetrisi yok. Tarihî sahiplik telemetrisi silinmiş örnekte ayrıntı
  üretilmiyor; toplam rapor okunuyor.1/1 DB test PASS.
- Ortak filo kalıcı yara testindeki üç turdan kalma 5 Dart / 2 Stronghold dizilimi
  altı turda istenen yaralı sağ kalanları bırakmıyordu. Yara testleri için iki
  sahibin birer Kale'si ile iki savunan Kale, Zırh V / Kalkan IV kullanıldı:
  128 tohumun hepsinde dört gemi de gerçek gövde yarasıyla hayatta. Kalıcı yara
  öncesi ruleset aynı dizilimde yara saklamıyor. İmha puanı, radyasyon ve sezon
  muhasebesi testleri kendi eski imhalı dizilimini koruyor. Dosyanın 6 testi PASS.

- Kapsamlı sunucu koşusunda ayrıca üç eski yara dizilimi doğrulandı ve düzeltildi:
  korsan ateşi 30 Dart'ın bütün kalkanlarına yayılınca gövdeye ulaşmıyor; 10 Dart
  256 tohumda yaralı dönüyor. Radyasyonlu NPC Kale'yi 70 Dart öldürüyor; 10 Dart
  256 tohumda hem yaşatıp hem ek gövde yarası bırakıyor. İlgili iki dosya 5 test PASS.
- Solo baskın yara dönüşü iki tarafta Zırh V / Kalkan IV'lü ikişer Kale ile
  doğrulandı. Hafif yaranın iyileştirilmemesi, baştan %10 yaralı Stronghold'un
  atışları kalkanında karşılayıp tam aynı yarayla kalmasıyla ayrıca doğrulandı.
  Dosya 3/3 PASS; önceki ruleset'in yara saklamaması da korunuyor.
- Honor ortak filo testinde bir Harpoon'un yayılmış atışı artık kesin fiziksel
  kayıp oluşturmuyor. On altı Harpoon'un en düşük varyanslı ilk tur hasarı bütün
  60 Dart'ın kalkan + can bütçesini aştığından gerçek kayıp/debit yolu sınanıyor.
  Yedi açılış/sürüm sınırı, birebir kayıp puanı ve idempotency testi PASS.
- Kök lint üç ardışık grupta bütün dosyalar için sıfır hatayla tamamlandı.
  Sonradan düzeltilen fixture'lar aynı ESLint yapılandırmasıyla ayrıca kontrol ediliyor.
  Rules/server/web/sim tip kontrolleri PASS; son fixture eklemeleri sonrası sunucu
  tip kontrolü ayrıca tekrarlanıyor. Uzun simülasyon çalıştırılmadı.
- Gerçek üretim web derlemesindeki `battleForecast.worker` tarayıcıda 100 Korsan
  örneğini ortak motorla birebir çözdü: 3,43 s boyunca ana iş parçacığı 341 kez
  ilerledi. Canlı CSP'de `worker-src self` desteği korundu.
- Özel canlı yedeği ayrı PostgreSQL'e geri yüklendi. Eski ve yeni gerçek sunucu
  imajıyla okuma/yazma, sonda/tamirhane, yara/kaçış, altı turlu rapor JSON'u ve
  kalıcı satır sayılarının korunması PASS. Test trafiği canlıya yazmadı.

- 78 dosyalık geniş sunucu koşusu tamamlandı: 1067 PASS / 13 FAIL / 2 mevcut skip.
  On üç başarısızlık yukarıda açıklanan eski savaş dizilimleriyle sınırlıydı.
  Etkilenen yedi dosyanın **tamamı** düzeltmeden sonra ayrı koşularda PASS:
  `clan-war-battle` 40, `monument-arrival` 38, `clan-war-damage` 6,
  `npc-battle-damage` 2, `raid-damage` 3, `radiation-bomb-neutral` 3,
  `honor-joint-battle` 7. Beklenen fiziksel kayıp, yara ve iade eşitlikleri
  gevşetilmedi. Böylece bu kapsamda 1080 test PASS, 2 mevcut skip; VPS'in
  Node 22 ortamında düzeltilen dosyalar ayrıca tek işçiyle yeniden çalıştırılır.
  Tek bir kesintisiz 78-dosya koşusu temizmiş gibi raporlanmaz.
- Honor kayıp fixture'ı için bağımsız sayısal kontrol: 60 Dart'ın toplam
  can + kalkanı 5775; 16 Harpoon + 20 Dart'ın en düşük ilk tur hasarı
  6038,88. Gerçek ölüm/debit yolu tek hedefe ateş varsayımına dayanmıyor.
- Node 22'deki son sekiz-dosya koşusu 103 PASS / 1 FAIL verdi; yedi dosya tamamen
  geçti. Ek hata eski sezon solo baskın fixture'ında iki Dart'ın bazen tamamının
  ölmesine karşın mutlaka dönüş misyonu beklenmesiydi. Aynı test, araştırmalı
  ikişer Kale ile kuruldu; savunan envanteri fiziksel kayıplara göre, saldıranın
  dönüşü gerçek sağ kalanlara göre kontrol ediliyor. Eski sezon hâlâ kalıcı yara
  kaydetmiyor. Bu tek dosyanın üç testi temiz geçince önceki yedi temiz dosyayla
  birlikte VPS kapsamı 104 başarılı teste tamamlanır; ilk koşu gizlenmez.
