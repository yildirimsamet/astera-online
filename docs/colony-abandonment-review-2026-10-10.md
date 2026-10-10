# Koloni terki — kod incelemesi ve doğrulama

10 Ekim 2026, master. İnceleme yalnız koloni terki değişikliklerini kapsar;
çalışma alanındaki diğer görevlerin değişiklikleri korunur.

## Bulunan ve düzeltilen eksikler

| Bulgu | Sonuç ve düzeltme | Kanıt |
| --- | --- | --- |
| Başarılı uygunluk kontrolünden sonra yeni kontrol başarısız olduğunda eski `allowed` verisi kullanılabiliyordu. | Onay yalnız son sorgu başarılıysa açılır; hata halinde kapalı kalır. | Yeni UI testi önce FAIL, düzeltme sonrası PASS. |
| Sahiplik değişimi yavaş `world` yayınından gönderiliyordu. | Anında `shard:control` kullanılır; harita ve dünya listesi gecikmiş büyüme yayınını beklemez. | Gerçek stream aboneliği testi önce FAIL, sonra PASS; içerik yalnız shard ve türdür. |
| Koloni bırakılınca skin envanterinin dünya listesi yenilenmiyordu. | Envanter sorgusu geçersizleştirilir. | UI testi önce FAIL, sonra PASS. |
| Oyuncunun kayıtlı Servet değeri terkten sonra eski koloniyi saymaya devam ediyordu; ana gezegenin son üretim güncellemesi de hesaba dahil edilmeliydi. | Servet aynı transaction içinde sahiplik değişimi ve ana gezegenin ekonomi güncellemesinden sonra yeniden hesaplanır; yanıt yenilenen değeri taşır. Dominion değişmez. | Yeni kalıcılık testleri önce FAIL, sonra PASS. Bir saatlik bekleme testinde eski sıra 2124, doğru hesap 2247 döndürüyordu; sıra düzeltilince kayıt ve yanıt eşitlendi. |
| Sunucu başarıyla COMMIT yaptıktan sonra POST yanıtı kaybolursa istemci eski koloniyi göstermeye devam edebiliyordu. | Hata durumunda sahiplik ve etkilenen okumalar yenilenir; POST otomatik tekrarlanmaz. | Yeni UI testi önce FAIL, sonra PASS; gerçek HTTP yanıtı kesilerek tarayıcıda da doğrulandı. |
| Gönüllü terk, bildirim metni ayrılmış olsa da kayıp alarmı gibi renklendiriliyor ve önceliklendiriliyordu. | `ABANDONED` nedeni nötr bilgi olarak gösterilir. Sadakat kopuşu, eski ve bilinmeyen nedenler alarm olarak kalır. | UI testleri önce FAIL, sonra PASS; eski nedenler ayrıca sınanır. |
| Hazır Ölüm Yıldızı ve önleme mühimmatının gezegende kalacağı onay metninde açık değildi. | Altı dilde açıklama eklendi. Bunlar mobil filo aktarımının parçası değildir; gezegene ait donanımdır. | UI metin testi önce FAIL, sonra PASS; varlıkların kalıcılığı API testinde ve gerçek HTTP kontrolünde doğrulandı. |

## Son onay ve kalıcılık incelemesi

GET uygunluk sonucu izin değildir. POST mevsim ve sıralı dünya kilitlerini alır;
sahipliği ve bütün engelleri kilit altında yeniden okur. Gerçek saldırı/terk yarışı,
iki eşzamanlı terk ve transaction ortasında zorlanan hata test edilir. Hata halinde
sahiplik, gemiler, kuyruk ve bildirim değişiklikleri geri alınır.

Uçuşun Radar'da görünmesi ve ETA'nın geçmiş olması kontrolü gevşetmez. Aktif ortak
savaş katkısının beş durumu, desteğin üç aktif durumu ve gönderen/barındıran uçları,
anıt filosu/sondası, kazı, korsan, ticaret ve konvoy ayrı ayrı sınanır. Sonuçlanmamış
önleme, asıl görev sonuçlanmış olsa bile hem saldıran hem hedef koloni için engeldir.
Pozitif, evde ve onarım istasyonunda olmayan gemi kaydı tanınmayan görevleri de engeller.

İncelemede daha önce olmayan testler eklendi: kayıtta pozitif olduğu halde geçen
zamanda sıfırlanan sadakat; koruma/iyileşmenin tam bitiş anı; hazır stratejik donanımın
yerinde kalması; güncel Servet; bilinmeyen bildirim nedeninin alarm olarak kalması;
COMMIT sonrası yanıt kaybı; ana gezegende bir saatlik üretimin son hesaba dahil edilmesi.
Bu zaman ve hata sınırları 72 sunucu ve 16 UI terk testinin
parçasıdır. 90 API sözleşme testi de geçti.

## Tarayıcı ve manuel inceleme

`tools/visual.mjs --colony-abandonment` gerçek bileşenleri test API'siyle çalıştırır.
TR/EN/DE/FR/ES/JA, 350 ve 1280 pikselde 12 senaryo geçti. Onay, üç birlikte engel,
yeniden kontrol, tek açık onay isteği, ana gezegen seçimi, taşma ve dokunma alanları
ölçüldü; görüntüler elle incelendi.

Ek olarak 350×568 pikselde 12 engelin tamamı birlikte gösterildi. Listeyi kaydırma,
yeniden kontrol/vazgeçme düğmelerine erişim, kapalı onay ve düğmelerin 44 piksel
dokunma alanı geçti. Görüntü elle incelendi; kanıtlar
`out/colony-abandonment/stress` dizinindedir.

Bunun yanında `out/colony-abandonment/manual-http.mts`, 350×667 tarayıcıda gerçek
Fastify HTTP API ve ayrı PostgreSQL test veritabanıyla tek seferlik kontrolü çalıştırdı:

1. Pencereyi açmak, Escape ve vazgeçmek POST göndermez.
2. Onay açık ve ilk kontrol uygunken gerçek saldırı servisiyle saldırı başlatılır.
   Son onay 409 döner; genel uçuş gerekçesi görünür, koloni sahibinde kalır.
3. Gerçek geri çağırma ve worker inişi tamamlanır; yeniden kontrol onayı açar.
4. Sonraki POST gerçekten 200/COMMIT olur; yanıt tarayıcıya iletilmeden kesilir.
   İstemci sahipliği GET ile yeniden okur, ana gezegene geçer ve POST'u tekrarlamaz.
5. Veritabanından sekiz mobil geminin taşındığı, dört yer savunmasının ve iki hazır
   stratejik donanımın kaldığı, ödenmiş inşaatın iadesiz kapandığı ve terk bildirimi
   doğrulanır. Ekran görüntüleri de incelenir.

Bu kontrol Playwright ile yürütüldü; fiziksel telefonda parmakla oynama testi değildir.
Canlı oyun verisi kullanılmadı. Gerçek sunucudaki birden çok API replica ve fiziksel
ağ kesintisi bu yerel doğrulamanın kapsamı dışındadır. Bunların test edildiği iddia edilmez.

Kanıtlar `out/colony-abandonment/measurements.json`, `manual-http-evidence.json`
ve aynı dizindeki görüntülerdir.

## Tamamlanan genel doğrulama

Tek workspace ve tek Vitest worker ile sırayla çalıştırılan normal regresyon:

| Takım | Geçen dosya | Geçen test | Atlanan test |
| --- | ---: | ---: | ---: |
| Kurallar | 111 | 2.026 | 0 |
| Sunucu | 212 | 3.143 | 1 |
| Arayüz | 413 | 5.671 | 29 |
| Toplam | 736 | 10.840 | 30 |

Genel komut sıfır koduyla tamamlandı. 72 sunucu ve 16 UI terk testi bu genel
takımda da geçti. Tam typecheck, kök `pnpm lint` ve `git diff --check` geçti.
Ekonomi/mevsim simülasyonları ve snowball audit çalıştırılmadı.

Çıktılar: `/tmp/astera-colony-abandonment-regression.log`,
`/tmp/astera-colony-abandonment-final-typecheck.log`,
`/tmp/astera-colony-abandonment-final-lint.log`.
