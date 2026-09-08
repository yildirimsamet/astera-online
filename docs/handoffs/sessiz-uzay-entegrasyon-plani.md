# Sessiz Uzay — yürürlükteki uygulama ve kabul planı

Bu metin önceki taslakların yerini alır. Son kullanıcı kararları bağlayıcıdır.

## Davranış

- Mevcut authenticated API presence ölçütü kullanılır: `max(lastActiveAt, joinedAt,
  mainEnteredAt) + 48 saat`. Polling aktivite sayılır. İnaktivite hiçbir kişisel dünyayı silmez.
- Komutan başkent ve bütün kolonileriyle aynı dönem/ruleset WAITING galaksisine taşınır.
  Dünya kimlikleri, geliştirmeler, kaynaklar, gemiler ve kişisel ilerleme korunur.
- MAIN'deki eski koloni adreslerinde başlangıç şablonunda yeni sahipsiz NEUTRAL dünyalar
  oluşur. Bunlar normal şekilde ele geçirilebilir; başkent adresi boşalır.
- Dönüş yalnız başvuruyla olur. Aktarımlardan kalan ve hâlâ sahipsiz koloni adresleri ortak
  havuzdur; farklı çıkışlardan birleştirilebilir. Gelen oyuncunun kolonileri kendi özellikleriyle
  bu konumlara yerleşir. Kullanılmayan nötrler yerinde kalır. Ele geçirilmiş adres alınmaz.
- Dönüşte oyuncu kapasitesi aşılabilir. Başkent için boşalmış adres tercih edilir, yoksa
  kullanılmamış/güvenli yeni konum üretilir. Kolonisi olmayan oyuncu koloni adresi beklemez.
  Yeni kayıtların kapasite sınırı korunur; WAITING normal kayıt listesine girmez.
- En eski uygun başvuru döner. Geçici engelde sequence değişmez, başvuru kapanmaz;
  uygun sonraki başvuru değerlendirilir. Sonraki turda eski başvurular yeniden denenir.
- Başvuruda 48 saat inaktivite expiry yaratır. Yeni başvuru yeni sıra alır.
- Bakım 5 dakikada bir, tur başına en çok 5 başarılı aktarım; fleet resolver bağımsızdır.
- Uçuş/çatışma, recovery, yabancı gemi veya işlenmekte olan event kaybolmaz: ilgili aktarım
  ertelenir. Başkasının saldırısı inaktif hedefte de bulunabilir. Engeller kaldırılarak zorlanmaz.
- Normal klan ayrılığı ve ateşkes uygulanır. Eski üyelik dönüşte geri verilmez.
- Açık oturum eski galaksi verisini temizleyip yeni placement'a geçer; TR/EN modal
  korunmuş ilerlemeyi ve dönüş başvurusunu açıklar. Sezon sonu normal sıfırlama devam eder.

## Teknik kabul

1. Tüm dünyalar atomik; gidiş/dönüş retry, concurrent workers ve admission yarışları.
2. X'in üç koloni konumunun Y(2)/Z(1) arasında paylaşılması; kalan nötrün ele geçirilmesi;
   tekrar capture/departure; yetersiz adresin sıra koruması; kapasite üstü dönüş.
3. Eski HTTP intent/yanıt, SSE ve cache fence; kaynak raporlar yeni dünya için intel olmaz.
4. Kişisel event bir kez sonuçlanır; processing/retry event taşınmaz; reset nötr event'leri
   doğru galakside kalır. Uçuşlu nötr konum tahsis edilmez.
5. Klan, pirate reward, cycle recap, sonuç tekilliği ve WAITING dahil global rollover.
6. İlgili testler → kod incelemesi → düzeltme/ilgili test → tam suite.
7. Üretim kopyasında migration, gidiş/dönüş, asset korunumu ve worker sağlık provası.
8. Yalnız kendi kodlarını push/deploy; wiki hariç. Backup, seri replica rollout, canlı
   health/commit doğrulama; sonra `SILENT_SPACE_ENABLED=true`, batch=5, interval=5 dakika.
   İlk tur ve takip eden turda audit/outbox/queue/world invariants izlenir.

Kullanıcı gerektiğinde kısa kesintiyi onayladı; mümkünse site açık kalır. Transfer başlamış
veritabanı eski dump'a geri alınmaz. Sorunda flag kapatılır, mevcut placement korunur ve
uyumlu forward fix yapılır. Bilinen 6 simulator skip yetkilidir; diğer hatalar saklanmaz.
