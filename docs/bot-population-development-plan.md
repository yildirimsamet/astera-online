# Bot nüfusu ve etkinlik planı — 2026-09-26

## Amaç ve kararlar

Her galakside bot gezegenleri gerçek oyuncu sayısıyla kademeli artsın. Aynı anda karar alan bot sayısı yalnızca aktif **gerçek** oyunculardan türesin. Botlar beş dakikalık çevrimiçi ölçümündeki kısa düşüş yüzünden oturumun ortasında kapanmasın. Rakamlar ilk denge hipotezidir; canlı ölçümle ayarlanacaktır.

- Yerleşik bot hedefi: `P = MAIN galaksisindeki bot olmayan oyuncu sayısı`; `P = 0` için 0, diğer durumda `min(100, max(2, round(P × 0.25)))`. Operatörün `BOTS_PER_GALAXY` ayarı bu hedefin üst sınırıdır. İsim havuzundan fazlası asla üretilmez.
- Yerleştirme: var olan worker sweep'i üzerinden, galaksi başına 30 dakikada en çok 4 yeni bot. Botlar oyuncu sayısı düşünce veya uyuyunca silinmez; sezon sonuna kadar dünyaları kalır.
- Etkinlik hedefi: `A = son 5 dakikada etkin bot olmayan oyuncu sayısı`; `A = 0` için 0, diğer durumda `min(yerleşik bot sayısı, ceil(yerleşik bot sayısı / 2), max(1, round(A × 0.25)))`. Bu hedef oturumların anlık aç/kapat komutu değildir.
- Oturum: ilk karar en geç 5 dakikada, en az 60 dakika görevde kalma, en fazla 180 dakika kesintisiz görev ve biten oturumdan sonra en az 30 dakika dinlenme. Etkinlik düşüşünde yeni oturumlar azaltılır; süresi dolan oturumlar kademeli biter. Her 5 dakikada yalnızca hedef yeniden hesaplanır. Saat 01.00–08.00 Türkiye saati mevcut zorunlu sessizliktir; minimum oturumun istisnasıdır. Sessizliğe bir saat kala yeni oturum açılmaz.
- Botun mevcut 7–23 dakikalık karar aralığı ve bir turda en çok bir uçuş kuralı ilk sürümde kalır. Oturum sayısı ile eylem hızı ayrı ölçülür; canlı basınç görülmeden ikisi birlikte değiştirilmez.

Örnek: 100 gerçek oyuncu, 50 etkin oyuncu ve yeterli isim havuzunda hedef 25 yerleşik / 13 görevde bot. 1.000 oyuncuda 100 bot adresi üst sınırdır.

## İnceleme ve riskler

- `services/bots/sweep.ts` sabit sayıda bot yerleştirir ve `schedule.ts` Türkiye saatine dayalı vardiyayı hesaplar. Varsayılan 8 botta deterministik bir yedi günlük örnekte bot başına günde yaklaşık 14 görev saati vardır; 4 saatlik değer kesin üst sınır değildir.
- `players.lastActiveAt` sunucu listesindeki beş dakikalık çevrimiçi değeri üretir ve botların kendisi tarafından da yazılır. Bu ham sayı hedefe sokulursa botlar kendi nüfuslarını büyütür. `services/people.ts` içindeki gerçek oyuncu ayrımı kullanılmalı.
- Worker botları `FOR UPDATE SKIP LOCKED` ile sürer. Yeni oturum seçimi de galaksi bazlı kilit altında kalıcı olmalı; iki worker aynı botu iki defa başlatmamalı. Uçuş ve üretim kuyrukları uyku sırasında kendi kurallarıyla işlemeye devam etmeli.
- Bir botun `bot_profiles` kaydını silen `retire` işlemi mevcut kodda hesabı gerçek oyuncu gibi saydırabilir. Kimlik kalıcı, sürülme durumu ayrı olmalı; bu davranış yeni sayım başlamadan düzeltilmeli.
- Artan bot nüfusu asteroid arzını, galaksi çevrimiçi sayısını, sıralamayı, baskın trafiğini ve worker gecikmesini etkiler. 12 saatlik açılış ateşkesi, ilk gün kalkanı, yeni oyuncuya 48 saat dokunmama ve oyuncu başına günlük bir bot baskını aynen korunmalı.
- `EU-2` insanlara ayrılmıştır. Donmuş sezonlarda, WAITING shard'larında ve `BOTS_ENABLED=false` durumunda oturum/yerleşme olmamalı. Yetersiz isim havuzu uyarı üretir, sahte ad üretmez.
- Üretim compose dosyası `BOTS_PER_GALAXY` değerini worker'a geçirmiyor; ayar bağlanmalı. Varsayılan değişiklik eski sezonlarda aniden çok bot yerleştirmemeli: açma anahtarı ve kademeli hız korunmalı.

## Aşamalar ve doğrulama

1. **Testleri önce yaz:** saf hedef hesabı için 0/1/100/1.000, üst sınır, negatif/geçersiz değerler; oturum için 5 dakika düşüşü, 60 dakika minimum, 180 dakika maksimum, dinlenme, gece sınırı ve zaman sıçraması. Testler değişiklikten önce başarısız olmalı.
2. **Kalıcı kimlik ve sayım:** bot profiline silmeden emekliye ayırma durumu; gerçek oyuncu filtresinin emekli botu da dışlaması; galaksi bazlı yerleşik ve etkin gerçek oyuncu sorguları. API ve diğer sistemlerin bot kimliğine bağımlılığı gözden geçirilmeli.
3. **Kademeli yerleştirme:** mevcut bot adresi/isim havuzu ve worker akışı korunarak hedef hesabı, 30 dakikalık hız sınırı, yeniden başlatma ve çift worker idempotansı uygulanmalı.
4. **Kalıcı oturum yöneticisi:** oturum başlangıcı/bitişi veritabanında tutulmalı; worker 5 dakikalık hedefi okuyup mevcut oturumları korumalı, uygun botları dönüşümlü başlatmalı, ilk turu geciktirmemeli. Gece kuralı ve mevcut tek-tur kilidi korunmalı.
5. **Gözlem ve ayar:** `/health` üzerinden galaksi bazında gerçek oyuncu, hedef/yerleşik/görevde bot ve kısa roster açığı görülebilmeli; bot turu, uçuş, oyuncuya saldırı ve worker gecikmesi ölçülmeli. Kısa yük/playtest ile davranış değerlendirilmeli.
6. **Tam doğrulama:** ilgili testler kırmızı→yeşil, sonra `pnpm verify`. Mevcut değişikliklerden kaynaklanan bağımsız hata varsa kök neden ayrıştırılıp raporlanmalı. Son kod incelemesinde oyuncu kapasitesi, sezon geçişi, neutral sayımı, asteroid arzı ve PvP sınırları kontrol edilmeli.

Bu iş sunucu davranışıdır; yeni oyuncu arayüzü akışı eklenmez. Mevcut görünür oyuncu/çevrimiçi sayılarının anlamı değiştirilirse ekran metni ve testleri aynı aşamada güncellenir.
