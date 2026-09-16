# Kazıcı geri çağırma, transfer yasağı ve sonda temposu — code review

Tarih: 2026-09-16

Bu inceleme yalnızca bu çalışma kapsamında değişen davranışları kapsar. Aynı çalışma
ağacındaki sezon arşivi, savaş raporu, ekonomi dengesi ve diğer ajanlara ait değişiklikler
bu raporun kod kapsamına dahil değildir.

## Sonuç

İstenen üç davranış uçtan uca uygulanmıştır:

- Yalnızca hedefe henüz ulaşmamış `outbound` Kazıcı uçuşu geri çağrılabilir. Araç,
  ekranda bulunduğu dönüş noktasından gezegenin yüzeyine fiziksel bir dönüş bacağı uçar.
- Kazıcı gezegenler arası transfer arayüzünde gösterilmez; hazırlanmış veya eski bir
  istemci pozitif `PROSPECTOR` sayısı gönderirse backend kalkışı başlamadan reddeder.
- Sonda, komutan ve hedef gezegen başına beş saniyelik aralıkla, para yettiği sürece
  tekrar gönderilebilir. Havada sonda sınırı ve normal uçuş bölmesi tüketimi kaldırılmıştır.

## CR sırasında bulunan ve düzeltilen sorunlar

| Önem | Bulgu | Düzeltme / koruyan test |
| --- | --- | --- |
| P1 | Recall ile varış worker'ı farklı kilit sırası kullanırsa sezon sonu işlemiyle deadlock oluşabiliyordu. | Bütün yollar `season → mining run → planet` sırasına alındı; sezon yönetimiyle eşzamanlı recall testi eklendi. |
| P1 | HTTP isteği gezegen kilidini beklerken hedefe ulaşılmış olabilirdi; kilitten önce okunan saat geç bir recall'a izin verebilirdi. | Karar saati `loadLocked` sonrasında tekrar okunuyor; tam varış sınırı ve kilit bekleme testleri eklendi. |
| P1 | Recall sonrası kalan eski `mining_arrival` olayı kalıcı hata yoluna düşerse Kazıcıyı gerçek dönüşünden önce eve koyabilirdi. | Abandon işlemi event fazını (`outbound`/`returning`) doğruluyor; eski varış eventinin ışınlama yapmadığı test edildi. |
| P1 | Hatalı dönüş eventinin kurtarılması, eşzamanlı garrison değişikliğini eski sayıyla ezip Kazıcı kaybedebilirdi. | Gezegen satırı home-unit read/merge/write öncesi kilitleniyor; eşzamanlı güncellemede `4 + 1 = 5` testi eklendi. |
| P1 | Farklı kolonilerden art arda gelen mining yanıtları, komutan geneli uçuş listesini eski snapshot ile geri sarabiliyordu. | Mining mutasyonlarına komutan-geneli sıra kapısı ve gezegen kapısı birlikte uygulandı; gezegenler arası yanıt sırası testi eklendi. |
| P1 | Recall cevabındaki başka koloni planet görünümü, legacy capital cache alias'ını ezebilirdi. | Capital kimliği doğrulanmadan alias yazılmıyor; yabancı koloni recall cache testi eklendi. |
| P1 | Koloni Kazıcı havadayken el değiştirince birimler ve private mining listesi yeni komutana geçiyor, fakat recall launch sahibini aradığı için ne yeni ne eski komutan çağırabiliyordu. | Recall yetkisi güncel dünya kontrolüne bağlandı; launch owner yalnızca immutable attribution olarak kaldı. Capture sonrası yeni sahibin çağırabildiği, eski sahibin göremediği kırmızı→yeşil testle doğrulandı. |
| P1 | Eski mining satırlarında launch sahibi boş kalırsa sezon attribution ve oyuncu reclaim temizliği eksik kalabilirdi. | `0087_yellow_dracula.sql` kontrollü owner backfill yapıyor; mevcut attribution'ı koruyan ve nötr dünyaya owner uydurmayan migration testi eklendi. |
| P2 | Dönüş saati gezegen merkezine göre hesaplanırken çizilen uçuş yüzeyde bitiyordu; özellikle anlık recall birkaç saniye yerinde bekleyen araç üretiyordu. | Mesafe, dönüş noktasından outbound yüzey başlangıcına göre hesaplanıyor; ilk test kırmızıda 3182 ms sapmayı yakaladı, düzeltmeden sonra 1 ms toleransla geçti. |
| P2 | Yalnızca eski outbound eventinin varlığı, dönüş eventi kayıp recalled uçuşu stranded taramasından gizleyebilirdi. | Stranded sorgusu mevcut run fazına karşılık gelen event türünü arıyor; eksik return job testi eklendi. |
| P2 | Otomatik sonda dönüş satırı yeni ücretli launch gibi sayılıp hayali beş saniyelik cooldown üretebilirdi. | Cooldown sorguları yalnızca `parentMissionId IS NULL` ücretli outbound satırlarını okuyor; dönüş kaydı regresyon testi eklendi. |
| P2 | Beş saniye bittiğinde React başka sebeple render olmazsa sonda düğmesi kapalı kalabiliyordu. | Kontrol server-corrected `useNow(1000)` saatiyle kendisi güncelleniyor; süre sonunda düğmenin açıldığı UI testi ve görsel kontrol eklendi. |
| P2 | Geri çağrılan kısa debris uçuşu, hedefe hiç ulaşmadığı halde Kazıcı dinlenme cooldown'ı kazanabiliyordu. | Dinlenme sorgusu `recalledAt IS NULL` şartı taşıyor; enkaz almama ve dinlenme kazanmama birlikte test edildi. |
| P2 | Eski Prospector kabul testleri Kazıcılı gezegen transferini başarılı davranış sayıyordu; doğru backend yasağı tam paketi kıracaktı. | Eski transfer senaryoları yeni kurala taşındı; karışık filonun hiçbir craft ayırmadan reddi ve Kazıcısız normal transferin çalışması birlikte test edildi. |
| P3 | Başarılı recall bildirimi kazanç gibi renklendirilebilirdi. | `mining_recalled` ayrı payload olarak parse edilip nötr sonuç ve açık dönüş metniyle gösteriliyor. |

## Yetki ve durum makinesi incelemesi

- Endpoint yalnızca authenticated komutanı kabul eder ve kullanıcıdan planet/player kimliği
  almaz. Yetki, run'ın kalktığı dünyanın güncel controller'ıyla join edilerek belirlenir;
  yabancı UUID ile varlık bilgisi sızdırmamak için bulunamayan ve başkasına ait uçuş aynı
  404 sonucunu verir. Immutable launch owner sezon attribution'ı için korunur.
- Kabul edilen tek geçiş `outbound → returning` ve zaman koşulu `now < arriveAt`'tır.
  `returning`, `done` ve tam varış anı 409 ile reddedilir.
- Run satırı kilitli geçiş noktasıdır. İki eşzamanlı recall'dan yalnızca biri dönüş eventi
  oluşturur. Eski arrival eventinin resolver'ı artık `outbound` bulamadığı için no-op olur.
- Asteroid claim/debris claim kodu recall yolunda hiç çalışmaz; mined değerleri sıfır kalır.
- Genel gemi/probe görevlerine recall endpointi veya UI aksiyonu eklenmemiştir.

## Veri ve önbellek incelemesi

- `recalled_at`, normal maden dönüşü ile kullanıcı recall'ını ayıran kalıcı audit alanıdır.
- Launch ve recall POST cevapları mining roster, pending ve authoritative planet görünümünü
  aynı transaction'dan döndürür. İstemci önce ilgili GET'leri iptal eder, sonra bütün açık
  mining cache'lerindeki komutan-geneli roster'ı aynı yanıtla günceller.
- React sorgu cache'i gezegen bazlı stok/hardware ile komutan bazlı mining roster'ını
  karıştırmaz. Bu ayrım React performans/cache incelemesinin ana etkisidir; gereksiz
  refetch yerine hedefli cache reconciliation korunmuştur.
- Sonda cooldown sorgusu son beş saniyeyle sınırlı ve target başına en yeni launch'ı tutar;
  tarih büyüdükçe bütün mission geçmişini istemciye taşımaz.

## Transfer ve sonda regresyon sınırları

- Prospector yasağı yalnızca gezegenler arası `launchTransfer` içindir. Ortak yapısal fleet
  validator değiştirilmediği için Trade Ship gibi farklı ve mevcut mekanikler kırılmaz.
- Daha önce kalkmış transferler normal varış mantığıyla tamamlanır; havadaki craft silinmez.
- Probenin fiyatı, hızı, stealth/accuracy, rapor ve dönüş davranışı korunmuştur. Değişenler
  yalnızca aynı hedef launch aralığı, havada sayı sınırı ve normal bay tüketimidir.
- Backend cooldown tam beş saniye sınırında açılır. UI, server-corrected saati bir saniyelik
  çözünürlükle gösterdiği için erken açılmaz.

## Doğrulama

- Recall regresyon grubu: 12/12 geçti (ownership transfer, yarışlar, deadline, kilit sırası,
  event recovery, fiziksel dönüş, asteroid/debris ve yetki).
- Özellik odaklı backend paketi: 36/36 geçti.
- Özellik odaklı web cache/UI paketleri: 189/189 geçti.
- 350 × 812 görsel senaryolar: Türkçe ve İngilizce için outbound recall, returning,
  transfer ve probe cooling/ready; 6/6 geçti, yatay overflow yok.
- Workspace typecheck: geçti. Özellik kapsamındaki dosyaların lint sonucu ayrıca temizdir.

Tam workspace test/lint sonucunda bu kapsam dışındaki eşzamanlı değişikliklerden kalan
başarısızlıklar nihai teslim notunda ayrı listelenir; bu rapor onları bu özelliğe aitmiş gibi
göstermez.

## Dağıtım notu

`0087` migration uygulama sürümünden önce çalıştırılmalıdır; yeni API `recalled_at` kolonunu okur ve
yazar. Pratik güvenli sıra migration → bütün API/worker node'larını yeni sürüme alma → recall UI'ını
açmadır. Bu çalışma deploy gerçekleştirmez.

Asteroid-shower sırasında ilk ETA'nın neden sonradan uzadığı bu talebin kök-neden kapsamı değildir;
uygulanan recall, kullanıcıya o durumda güvenli geri dönüş sağlar.
