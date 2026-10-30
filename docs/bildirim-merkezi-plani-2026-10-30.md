# Bildirim Merkezi — plan (2026-10-30)

Durum: **kararlar ve sayılar alındı, kod yok.** Sayılar tek tabloda; oynadıkça ayarlanır.

## Bugünkü durum (kod)

- Oyun içi bildirim akışı var (`apps/server/src/services/notifications.ts`, `notification_kind` enum,
  SSE). Saldırı uyarısı radar çemberi geçişiyle zamanlanıyor (`services/radar.ts`, `radar_warning`
  olayı → `incoming_fleet` / `strategic_incoming`, `worker/handlers.ts`).
- OS bildirimi yok: FCM, yerel bildirim ve web push kurulmamış. `platform/runtime.ts` içinde
  `localNotifications` ve `nativePush` değerleri `false`.

## Sahip kararları (2026-10-30)

1. **Seviye yok; bina bir kere kurulur** (2026-10-30 ikinci tur, ilk turdaki "3 seviye" kararının
   yerini alır). Kurulum: 1.510 alaşım + 1.133 kristal (Radar L2 fiyatı), seçili dünyanın deposundan.
   Oyuncu zamanlamayı kendisi seçer: **son 3 / 5 / 15 dk veya radara girdiği an.**
2. **Fiyat "bir çıtır pahalı" olmalı:** her uyarı ödenemesin, oyuncu ödeyip ödememeye karar versin.
   `fiyat = max(taban, saat × komutanın toplam saatlik döteryum üretimi)`, yukarı yuvarlanır:

   | Uyarı | son 3 dk | son 5 dk | son 15 dk | radara girdiği an |
   |---|---|---|---|---|
   | Saldırı / klan savaşı | 1 sa, en az 20 | 1,5 sa, en az 30 | 3 sa, en az 60 | 5 sa, en az 100 |
   | Ölüm Yıldızı / stratejik | ×1,5 | ×1,5 | ×1,5 | ×1,5 |
   | Sonda tespiti (anlık) | 1 sa, en az 20 | | | |

   Ölçüm (2026-10-30, canlı sezon, 203 dünya): döteryum tesisi medyanı L0, döteryum stoku medyanı 81,
   %75 dilimde 679, %90 dilimde 2.233. Tesis üretimi L3 7/sa, L5 13/sa, L10 30/sa. Yalnız uyarılar
   değil, ileride eklenecek ücretli bildirimler de aynı tabloya satır olarak girer.
3. **Ücretli türler (şimdilik):** saldırı geliyor, Ölüm Yıldızı/stratejik silah, klan savaşı,
   sonda tespiti. Sonuç bildirimleri ücretsiz push. Kuyruk bildirimleri (bina, araştırma, gemi,
   filo dönüşü) ücretsiz **yerel** bildirim (sunucu yok, cihazda zamanlanır, iptalde silinir).
4. **Radara bağlı:** radar görmediyse ücretli uyarı da gitmez.
5. **Oyun içi uyarı ücretsiz kalır.** Ücret yalnız oyun dışı push içindir.
6. **Para gönderimde düşer.** Saldırı geri çağrılırsa para düşmez. Kasa yetmezse uyarı gitmez ve
   Merkez'de "kasa boştu, N uyarı gönderilemedi" yazar.
7. **Komutana ait, Ana Menü'den açılır** (Intel her gezegene ait olduğu için Intel'e girmez).
   **Kasa bir cüzdandır:** seçili dünyanın deposundan X döteryum aktarılır, onay penceresi
   çıkar ("Emin misiniz?"), **geri aktarım yoktur** (kötüye kullanımı önler). Kasa yağmalanmaz,
   üst sınırı yoktur. Kurulum maliyeti de seçili dünyanın deposundan düşer (sahip onayı).
   Radar seçilen andan sonra görürse uyarı radar gördüğü anda gider (varsayım, sahibe sorulmadı).
8. **Sonda okur, kesin değil:** rapor kurulu olup olmadığını ve kasa bandını (boş / birkaç uyarılık / bol)
   tahmin olarak verir. Mevcut sonda netlik kuralına göre bir kısmı "belirsiz" ya da bir band
   kaymış okunur.
9. **Platform:** önce Android (yerel bildirim + FCM). **Web'de hiç açılmaz.** Web'de Merkez
   bir yönlendirme ekranı olur: "Uygulamayı yükleyip oradan girerseniz Bildirim Merkezi açılır" +
   Play bağlantısı. Amaç web oyuncusunu uygulamaya taşımak. iOS sonra.
10. **Botlar (KİLİTLİ kural):** botlar da Merkez kurar ve kasa doldurur; sonda onları insan gibi
    okur. Botlara push gitmez.

## Yapı (önerilen, onaylı)

- `packages/rules`: bildirim türleri, ücret tablosu (tür × zamanlama), zamanlamalar, taban fiyatlar ve
  kurulum maliyeti. Saf fonksiyonlar, testli.
- Sunucu: cihaz token tablosu, tercihler, kasa (cüzdan) bakiyesi, sonda okuması. Saldırıda seçilen
  zamana göre uyarı olayı; gönderirken kasadan atomik düşüm, idempotent; geri çağrıda iptal.
  FCM adaptörü (transactional outbox).
- İstemci: Ana Menü'de Merkez ekranı (kurulum, kasa, aktarım + onay, tür/zaman tercihleri,
  gönderilemeyen uyarılar), yerel bildirim adaptörü (`@capacitor/local-notifications`), push
  kaydı, bildirime dokununca doğrulanmış hedefe gitme.

## Görseller

Seviye olmadığı için tek kademe. Mevcut düzene uyulur: şeffaf donanım (300×300, `images/general/*_1..3.png` gibi),
sahne kartı (768×512 webp, `images/atmosphere/*-t1..3-v2.webp`, alt üçte bir koyu), Merkez başlık
görseli. Prompt şablonu `assets/source/atmosphere/prompts-v2.json`; ana PNG'ler `assets/source/`;
kayıt `provenance.json`. Codex (`codex exec`) üretir, Radar/Teleskop yanında karşılaştırılır,
webp'ye optimize edilir, oyunda ekran görüntüsüyle doğrulanır. Bildirim türü ikonları SVG
(`v2/icons.tsx`).

## Uygulanan (2026-10-30)

- Kurallar `8b805f56`, sunucu `e0df7688`; istemci: Ana Menü "Bu sezon" grubunda kutucuk, Merkez ekranı
  (kurulum, kasa, onaylı aktarım, zamanlama fiyatları, tür anahtarları, son uyarılar, kural detayı),
  web'de Play bağlantısı, sonda raporunda (Hedef dosyası) Merkez okuması.
- Yerel kuyruk uyarıları **Merkez kurulmadan da** kullanılabilir (ücretsiz, binaya bağlı değil).
  Ayar cihazda, varsayılan kapalı; izin istemi yalnız oyuncu açınca. Telefon izni hiç saklanmaz:
  her açılışta ve uygulama öne her geldiğinde okunur; ayarlardan kapatılırsa ekranda söylenir.
  Senkron tek seferde bir tane çalışır (eskiyen plan atlanır), dil değişince metin yenilenir,
  çıkışta cihazdaki kuyruk uyarıları silinir. Android 12+ tam zamanlı alarm izni yoksa Android
  uyarıyı geciktirir: gecikmenin %75'i kadar, en fazla 1 saat (S22 ölçümü 2026-10-30: +1 sa →
  45 dk pay, +4/+12 sa → 1 sa pay). Ekran bunu söyler ve ayarı açar; izin değişince kurulu
  uyarılar yeniden kurulur. Eklentiye `isExactNotification` yalnız izin varken verilir, yoksa
  eklenti her zamanlamada ayar ekranını kendisi açıyor. İzinsiz +2 dk uyarı, süreç öldürülmüş +
  zorla derin uyku + güç modunda 16 sn geç geldi.
- Görseller: `images/atmosphere/notification-center-v1.webp` (sahne/başlık/kutucuk),
  `images/general/notification_center_1.webp` (donanım); tank penceresi kanonik döteryum yeşili.

## Uygulanan (2026-10-31)

- Menü: kart Ayarlar'dan Ana Menü'ye, Envanter'in altına taşındı; kasanın kaç saldırı uyarısına
  yettiğini ya da boş olduğunu kartın kendisi söyler.
- Ekran: "1 uyarı / 5 uyarı" seçicileri kaldırıldı (bilet satın alma gibi okunuyordu). Döteryum
  ekleme kasa kartının içinde: yazılan miktar için "aktarımdan sonra kasa · bu ayarla N uyarı".
  Zamanlama gerçek bir ayar listesi ("İnişe 5 dakika kala", fiyat "/ uyarı" olarak ikincil);
  "tek kasa, zamanlama yalnız bir uyarının fiyatını değiştirir" notu.
- FCM (HTTP v1): sunucu `services/fcm.ts` servis hesabıyla JWT-bearer girişi (RS256, ≤1 sa,
  `firebase.messaging`), token bitmeden 1 dk önce yenilenir, 401'de bir kez yeniden giriş. Telefon
  başına bir mesaj, `android.priority HIGH`, `notification.channelId 'alerts'`, `tag` = baskın id.
  404 `UNREGISTERED` ve "registration token" diyen 400 `INVALID_ARGUMENT` telefonu siler; başka
  hata telefonu tutar ve loglanır; gönderici asla fırlatmaz (ücret zaten COMMIT edildi).
  Env: `FCM_SERVICE_ACCOUNT` = servis hesabı JSON'unun base64'ü; yalnız worker gönderir;
  boşsa uyarılar kaydedilir, gönderilmez.
- İstemci `platform/push.ts`: izin yalnız oyuncu isteyince (Merkez kurulunca + Merkezdeki sarı
  kart) sorulur; izinli telefon her açılışta ve dil değişince sessizce bağlanır. `alerts` kanalı
  token'dan önce kurulur. Token cihazda saklanır: çıkışta ve telefon ayarlarından bildirim
  kapatılınca sunucudan silinir, böylece görülmeyecek uyarıya ücret kesilmez (`NO_DEVICE`).
  Ön planda da gösterilir (`presentationOptions: sound, alert`). Durum çubuğu simgesi
  `ic_stat_astera` (beyaz/saydam halkalı gezegen), push ve kuyruk uyarılarında ortak.
- Firebase dosyaları repo dışında: `~/.local/share/astera/firebase/` (600). Derleme için
  `google-services.json` `apps/web/android/app/` altına kopyalanır ve git'te yok sayılır.

## Açık işler

- Bot davranışı (Merkez kurma/fonlama). Gerçek telefonda uçtan uca push testi.
