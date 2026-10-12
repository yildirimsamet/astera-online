# PvE denge güncellemesi — görev ve doğrulama notu

## Kullanıcıdan kesinleşen gereksinimler

- [x] Hurdacı hariç, iyi seçilmiş filonun net kârını ölç ve ayarla. Yakıt, gemi kaybı ve ücretli onarım düşülecek.
- [x] Seviye 4 için **alaşım + kristal toplam net kârı** normalde yaklaşık 1.000–2.000, üstte yaklaşık 2.000–3.000.
- [x] Seviye 4 net döteryum normalde yaklaşık 100–150, üstte yaklaşık 100–200.
- [x] Seviye 3, 2, 1 kârını kendi savaş gücüne göre aynı mantıkla kademelendir; tüm seviyeleri simülasyonla doğrula.
- [x] Korsanların yeni üretilen filolarından tüm yük gemilerini kaldır. Boyut 2–5 ve kendi seviyesinde en az bir savaş gemisi kalsın.
- [x] Dengeyi **bu sezonda** yayımlamaya uygun hazırla. Yeni sezon zorunluluğu ekleme.
- [x] Kısmi zaferlerden sonra aynı ganimetin yeniden yaratılmasını düzelt; toplam ödemeyi kalan ödül bütçesiyle sınırla.
- [x] Frontend'de korsana filo gönderirken anlaşılır kâr/zarar tahmini göster. Kârlı görünme ve zarar riski ayrı anlaşılacak.
- [x] Tahmin tüm kaynakları, özellikle döteryum yakıtını ve onarımını açıkça gösterecek; gemi ele geçirme garantili gelir sayılmayacak.
- [x] Hayatta kalan kargo kapasitesini, hurdacının gerçekten kaldırdığı enkazı ve kayıp olasılığını hesaba kat.
- [x] Asteroidin yeni doğma ömrünü **1–2 saat** yap.
- [x] Asteroid seviyelerinin başlangıç toplam kaynağını **400, 800, 1.200, 1.600, 2.000** yap.
- [x] İzotoplu asteroidin döteryum payını küçük miktarda artır: **%12–28**. Kristal payı korundu.
- [x] PC'yi zorlamadan çalış: yerelde tek çekirdekte yaklaşık %20 kullanım; uzak kontrollerde en fazla 2 CPU,
  tek işlem/tek test işçisi, düşük öncelik ve sınırlı bellek.
- [x] Önce test → FAIL, sonra uygulama → PASS. Sadece hedefin gerektirdiği ekonomi deneylerini çalıştır.
- [x] Frontend metinlerini `docs/ux-writing.md` ve mevcut v2 tasarımına göre yaz; ekrandan görsel olarak doğrula.
- [x] Uygulama ve ilk kontroller bittikten sonra **ayrı bir ayrıntılı CR turu** yap.
- [x] CR'de şu soruları açıkça yanıtla: eksik/yanlış var mı, unutulan veya gözden kaçan durum var mı?
- [ ] Her CR bulgusunu kod/test/oyun kanıtıyla doğrula; doğrulanan sorunları düzelt ve yeniden doğrula.
- [ ] Kullanıcının son talebi: kapsamlı ikinci CR'den sonra **bu sezona deploy et**. Yedek, restore provası,
  mevcut hedeflerin korunması ve canlı kabul kontrolleri de yayın işinin parçası.

## Mevcut durum ve başlangıç kanıtı

Başlangıç ölçümü: dört seviyede 256'şar normal korsan ve 256 yük gemisiz koşullu seviye 4 örneği;
204.800 bağımsız doğrulama savaşı. Filo seçimi farklı savaş tohumlarında yapıldı.
Normal seviye 4, iyi seçilmiş filo: +8.546 A, +4.918 C, −43,6 D.
Hurdacı eklenince: +12.035 A, +6.291 C, −66,6 D. Ele geçirilen gemi bu rakamlarda yok.
Ham kanıt: `docs/evidence/pirate-profit-audit-2026-10-12.json`.
Muhasebe aracının 13 testi ve bağımsız TypeScript kontrolü geçti.
Genel lint yaklaşık 5,7 GB tüketince kullanıcı talebiyle durduruldu; yeniden o şekilde çalıştırılmayacak.

## Dokunulacak yerler ve temel riskler

1. `packages/rules`: korsan doğma/ödül girdileri, bütçe muhasebesi, ortak kâr tahmini, asteroid sabitleri ve testler.
2. `apps/server`: saatlik korsan üretim girdilerinin saklanması/okunması, kalan ödül, atomik ödeme, botların aynı ödülü görmesi ve API sözleşmesi.
3. `apps/web`: korsan API verisi, filo gönderme tahmini, kaynak ve belirsizlik metni, regresyonlar ve görsel doğrulama.
4. `tools`: tekrarlanabilir ve yavaş çalıştırılan kalibrasyon; sonuçlar ve kaynak dosya hash'leri.
5. `docs`: denge sonuçları, bu sezon geçiş yöntemi ve tamamlanmış CR kanıtları.

Halihazırda doğmuş hedefleri yeniden üretmek, gemileri/kaynakları/son tarihi yoldaki filoların altında değiştirebilir.
Asteroid saatlerinin mevcut generation snapshot'ı korunacak. Korsanlara da saatle birlikte saklanan üretim girdisi eklenecek;
eski satırlar eski üretimi sürdürecek, yeni saatler yeni kurala geçecek. API/worker geçişi sıralı ve uyumlu olmalı.
Mevcut sezon sıfırlanmayacak; oyuncuların daha önce kazandığı kaynak geri alınmayacak.

Kalan korsan ödülü tek hedef üzerindeki yazma kilidi altında düşülecek. Eşzamanlı saldırı ve tekrar işleme,
ilk kısmi zafer, iki kısmi zafer sonrası bitirme, karşılıklı yok olma ve kargosuz sağkalım ayrı doğrulanacak.
Kazanç tahmini kesin zafer sözü vermeyecek; araştırma, filo hasarı, mesafe, kargo ve kamusal enkaz belirsizliği belirtilecek.
Asteroidlerin eski saatleri 5 saate kadar yaşayabildiği için geriye bakış penceresi geçişte daraltılmayacak.

## Uygulama sırasında doğrulanan sonuçlar

- Yeni korsan girişleri saat satırında saklanıyor. Geçiş bayrağı mevcut sezonun sonraki saatlerinde çalışıyor;
  eski saat/handle/rota/son tarih değişmiyor. Server 8 generation/uyumluluk testi geçti.
- `0150_pirate_reward_ledger` migration'ı ganimet defterini ekliyor ve geçmiş raporlardan dolduruyor.
  Gerçek kısmi savaş + bitirme, eşzamanlı ilk saldırı, rollback/retry ve tarihsel backfill (enkaz hariç,
  eski eksik D alanı dahil) için dört veritabanı testi geçti.
- Varsayılan yerel test DB'si eski bir dalın journal/schema uyuşmazlığına sahipti. Kod dışı bu durumu
  mevcut DB'ye müdahale etmeden ayrı `astera_pve_balance_test` DB'sinde temiz migration ile çözdük.
- Asteroid 28 ilgili regresyon geçti. Saatlik eski generation ve eski statik sezonlar korundu.
  Alan geriye bakış penceresi **12 saat**, bu sürümde daraltılmadı.
- 128 korsan × 4 seviye × 5 filo politikası × 32 bağımsız doğrulama: **81.920 doğrulama savaşı**.
  Gidiş mesafesi 1.000, hurdacı/gemi ele geçirme hariç, kendi seviyesinde filo ve uygun araştırmalar.
  İyi seçilen filoda L1–4 A+C net: **168 / 331 / 448 / 1.475**; D net: **19 / 37 / 75 / 114**.
  A+2C+32D üretim değeriyle kâr, korsan savaş gücüyle yaklaşık aynı oranda büyüyor.
  İlk ödeme üst sınırları A+C: **360 / 720 / 1.500 / 3.000**, D: **30 / 60 / 120 / 199**.
  Ganimet tavanları net kâr garantisi değil; kötü filo, uzak rota, onarım ve yarış zarar bırakabilir.
  Kanıt: `docs/evidence/pirate-balanced-calibration-2026-10-12.json`.
- Hesaplama uygulaması sabit 12 bağımsız örnek kullanıyor; gemi ele geçirme ve kamusal enkazı gelir saymıyor.
  Bilinen HP radyasyonu, dönüşte azalan kargo ve ücretli onarım dahildir. Döteryum ve A+C'den biri
  net azalırken sadece üretim değeri pozitif diye "muhtemelen kârlı" denmiyor; kararsızlık gösteriliyor.

## Uygulama sırası

1. Gereksinim ve kenar durumlarını kaydet (bu dosya).
2. Korsan generation/bütçe regresyonlarını yazıp kırmızı çalıştır.
3. Yeni korsan üretimini ve simülasyon girdilerini uygula; düşük CPU ile kalibre et.
4. Ödemeyi ve kalan ödülün API/bot görünümünü atomik olarak bağla; server regresyonlarını çalıştır.
5. Frontend kâr/zarar tahminini testten başlayarak ekle; tasarım ve metinleri tamamla.
6. Asteroid ömür/kaynak/izotop regresyonlarını yaz, kırmızı çalıştır, sabitleri değiştir, yeşil çalıştır.
7. İlgili tip/lint/test kontrollerini sıralı ve sınırlı kaynakla çalıştır; UI'yi görsel doğrula.
8. Ayrı CR turu: tüm diff'i yeniden oku, invariants/failure/concurrency/time/UI incele, bulguları doğrula ve fixle.
9. Yeniden kontroller; son kâr tablosu, eksikler ve yayın durumu açık sonuç.

## Ayrı CR kaydı

Uygulama tamamlandı; son frontend hedefli regresyon turunda 68/68 test geçti.
Bu noktada ayrı inceleme turu başlatıldı: tüm diff, yeni modüller, çağıranlar,
veritabanı geçişi, eski/yeni saatler, ödeme eşzamanlılığı, rota/onarım/kargo hesabı ve
frontend yeniden okundu. Doğrulanan bulgular aşağıda; son olağan test kapısı ve yayın
kabulü tamamlanmadan üretim tamamlandı sayılmayacak.
İnceleme sorusu: **Eksik, yanlış var mı? Unutulan, gözden kaçan durum var mı?**

- [x] İnceleme, bütün uygulama tamamlandıktan sonra yeni turda başlatıldı.
- [x] Eksik/yanlış/unutulan durum soruları yanıtlandı.
- [x] Bulgular ve yeniden üretme kanıtları kaydedildi.
- [x] Doğrulanan bulgular düzeltildi.
- [ ] Düzeltmelerden sonra gerekli kontroller tekrar geçti.

### Doğrulanan CR bulguları

1. **Gecikmiş varışlarda deadlock:** farklı geliş saatli iki hazır varışın raid satırları
   alınmışken ilk kazanan, ikincisini erkenden döndürmek için onun satırını bekliyordu;
   ikinci ise ilk varışın korsan satırını bekliyordu. İki varışı açık DB kilitleriyle sıraya
   koyan yeni test gerçek PostgreSQL `40P01` üretti. Gelecek akınları seçme işlemi
   `FOR UPDATE SKIP LOCKED` kullanacak şekilde düzeltildi. Zaten varışı/geri çağırması
   işlenen akın kendi işleminde korsanın bittiğini görerek döner. Yeni regresyon dahil
   dört server dosyasında **52/52 test yeşil**.
2. **Negatif yarım birim:** `Math.round(-0.5)` ile işaret seçilirken mutlak değer ayrı
   yuvarlanıyordu; −0,5 ekranda `1` görünüyordu. Yeni test kırmızı çalıştı. Mutlak tutar
   bir kez yuvarlanıp işaret özgün değerden seçildi. Kart ve ilerleyen saat regresyonları
   son hedefli turda **5/5 yeşil**.
3. **Deneyde uçuş süresi:** araç çatışmayı 5 saniye sayıyordu; gerçek kural 10 saniye.
   Kuralın `ENGAGEMENT_MS` değeriyle karşılaştırılan test, 5 saniyelik farkla kırmızı
   çalıştı; sabit yerine ortak kural kullanıldı. Net kaynak sonuçları etkilenmez.
   Araç testleri **15/15 yeşil**. Yeni kalibrasyon kanıtı doğru süre ve güncel kaynak
   hash'leriyle yenilendi; ekonomi/radyasyon/RNG/seyahat kaynakları dahil **21 kaynak
   hash'i** yerel adayla tam eşit. Net sonuçlar aynı kaldı.
4. **Eski testlerin kapsamı:** genel kurallar turu 2.079 test geçirdi; üç test eski ore
   tablosu/izotop aralığı veya statik alanı yeni ömürle karşılaştırdığı için kırmızıydı.
   Statik alan ömrü donmuş legacy girdiden; yeni ore ve izotop beklentileri kullanıcının
   yeni değerlerinden okunacak şekilde düzeltildi. Dört hedefli kontrol yeşil.
5. **Rollback sınırı:** eski worker, v2 doğma bayrağı kapalı olsa bile `loot_paid`
   yazmaz. Migrasyondan sonra ona dönmek defterde yeni bir ödeme boşluğu yaratır.
   Yayın kılavuzu bu noktadan itibaren defteri destekleyen worker imajını zorunlu kıldı;
   v2 saatleri açıldıktan sonra API de v2 parser'ını korumalıdır.
6. **Yeni regresyonun taşınabilirliği:** genel kurallar turunda **2.081/2.082** geçti;
   tek kırmızı, tüm hedefi ham JSON hash'iyle sabitleyen yeni testti. Deployed
   `042693c` kaynakları ve aday aynı Node 22 Alpine ortamında **40/40 hedefte tam eşit**.
   Bu ortamın ham hash'i `3ab1d9e1…`, yerelin `48d29d49…`; fark `Math.pow` kaynaklı
   radius/period son bitleri. Projenin mevcut `orbitFingerprint` yardımcısıyla,
   doğrudan deployed kaynaktan alınan `53c49177…` beklentisi kullanıldı. Oyun geometri
   kodu değiştirilmedi; diğer kimlik/pencere/filo/ganimet alanları tam karşılaştırılıyor.
7. **Önceki CI'daki rastlantısal test hatası:** deployed `042693c` için GitHub Actions
   `38182314010`, klan gizlilik testinin JSON içindeki `400` metnini yasakladığını
   gösterdi; rastgele klan UUID'si `…-4000-…` içerince gerçek veri sızıntısı olmadan
   test kırmızıydı. Sayısal bağış değeri artık `Object.values` içinde sayı olarak
   aranıyor; `treasury` alanının gizliliği ayrıca doğrulanmaya devam ediyor.
   Aynı hedefli gizlilik testi düzeltmeden sonra **yeşil**.
8. **Madencilik regresyonunda eski kaynak varsayımı:** tam CI'nın ikinci server
   shard'ı, yeni seviye 1 kayasını hâlâ 800 kaynak sayan testte kırmızı çalıştı
   (`expected 400 to be 800`). Üretim hesabı doğruydu; 700 kapasiteli tek gemi
   artık bu kayayı tamamen tüketir. Regresyon yeni seviye 1 için 400/400 ve
   seviye 2 için 800/700/100 kalan şeklinde iki gerçek varışa ayrıldı.
   İki durum da gerçek DB/worker üzerinden **2/2 yeşil**; tükenen kaya gizleniyor,
   kısmen kazılmış kaya kalan 100 kaynakla görünür kalıyor.
9. **Yayın kılavuzunun CSP regresyonu:** ilk CI'nın web turu, kısaltılmış kılavuzda
   vhost'un yeni webroot'tan sonra kurulmasını açıkça söyleyen `AFTER the rename`
   cümlesini arıyordu. Kılavuz doğru sırayı zaten açıklıyordu; öngörülen adım
   açık cümleyle tekrar belirtildi. Testin koruduğu yayın sırası değiştirilmedi;
   yayın/nonce/rollback dosyasının **13/13 testi yeşil**.

### Doğrulanmayan şüphe ve kapsanan durumlar

- Radyasyon zamanının ilerlemesi ertelenen kâr tahminini sürekli yeniden hesaplatır mı?
  Bitiş saati gidişin ortasına düşen bir bulut ve her okumada ilerleyen saatle yeni hook testi
  **yeşil**: tahmin saat durmadan, 15'ten az saat okumasında tamamlandı. Üretim kodunda
  bu şüphe için bir hata doğrulanmadı; `pirate-profit-clock.test.tsx` kapsamı koruyor.
- Ana gezegendeki gönderilebilir gemiler tam sağlıklı: küçük yaralar inişte ücretsiz
  onarılıyor, büyük yaralılar ayrı dock konumunda tutuluyor. Başlangıç HP'sinin tam
  sayılması bu nedenle sunucuyla aynı. Gidiş/dönüş radyasyonu ve savaş yarası ayrıca hesaplanıyor.
- Hesap silme ortak korsan satırında yalnız `destroyed_by_player_id` alanını temizliyor;
  yeni `loot_paid` defterini silmiyor. Ödül, saldıran hesabın ömrüne bağlanmadı.
- Canlı salt-okunur kontrolde kayıp yaşamış, ayakta duran ve tarihsel savaş raporu
  bulunmayan korsan satırı **0**; defter backfill'i için bu veri boşluğu gözlenmedi.

Kalan ağır kontroller, `astera-pve-check-20261012-031536` konteynerinde (4 GiB bellek,
başlangıçta 1, son kontrollerde en fazla 2 CPU, tek Vitest işçisi, düşük öncelik) ve yalnız ona bağlı ayrı PostgreSQL
konteyneri/veritabanında yapılıyor. Üretim veya stage veritabanına bağlantısı yoktur.
Kurallar, simülatör ve server TypeScript kontrolleri bu ortamda geçti.

### Son statik ve görsel kontroller

- Dört workspace TypeScript kontrolü yeşil; son frontend testi eklendikten sonra web
  yeniden kontrol edildi. Yeni denetim aracının ayrı TypeScript kontrolü de yeşil.
- Depodaki aynı lint kuralları, bellek tüketimini sınırlamak için workspace başına
  çalıştırıldı. Kurallar, simülatör, server, web, araçlar ve kök yapılandırma yeşil;
  bulunan yeni lint hataları giderilip ilgili dosyalar tekrar kontrol edildi.
- Varsayılan kapıların dışında yapılan bütün `tools/**/*.ts` tip taraması eski ekonomi
  çalışma dosyalarında 15 hata gösterdi. Deployed `042693c` temiz kaynaklarıyla aynı
  tarama aynı 15 konum/kod/mesajı verdi. Yeni hata yok. Bu eski araçlar ve uzun ekonomi
  çalışmaları değiştirilmedi; yeni korsan aracı ayrı kontrolden geçti.
- Son görsel tur: **20 ekran**, **350/1280 px**, **tr/en/de/es/fr/ja**. Kâr, zarar ve
  hurdacılı durumlar; üç kaynak sütunu, çeviri, görünür başlık ve taşma kontrolü yeşil.
  Türkçe telefon örneği: 8 savaş gemisi **+1.950 A / +1.050 C / +117 D**;
  tek Dart **−304 A / −121 C / −2 D**; hurdacılı örnek ayrı enkaz satırı gösteriyor.
  Fotoğraflar: `out/pirate-profit-final-2026-10-12/` (yerel, commit dışı).
- İlk genel server turunda yalnız geçici PostgreSQL'in **512 MiB** sınırı doldu;
  konteynerin `OOMKilled=true`, `memory.events: oom_kill=1` kaydı ve PostgreSQL
  crash-recovery günlüğü nedeni doğruladı. Üretim/stage etkilenmedi. Test DB'si
  **1,5 GiB** sınırına alındı; WAL 128/32 MiB ve checkpoint 120 saniye olarak
  sınırlandı. Yalnız sahip olunan `_test` DB'si temiz oluşturuldu. İlk turun bağlantı
  hataları ürün regresyonu sayılmadı. Yerel PC'yi ve üretim VPS'sini ek uzun test
  yükünden korumak için son tam tur, deponun mevcut GitHub Actions kapısında aynı
  yayın SHA'sı için çalıştırılacak: sekiz ayrı DB'li server shard'ı, her birinde
  tek işçi; typecheck, lint, web build, tüm olağan rules/web testleri.

## Yayın kabul kaydı

Bu kaynak notu commit öncesi kanıtı kaydeder. Yayının gerçek SHA'sı, CI sonucu,
yedek/restore ve mevcut hedeflerin tam eşitlik kanıtı, migration/rol sırası,
canlı kuyruk ve dünya kontrolleri, eski açık istemci ve mobil/masaüstü kabulü
yayın sonunda `out/pve-deploy-2026-10-12/report.md` içinde kaydedilecek.
Bu dosya tek başına yayının gerçekleştiği iddiası değildir.
