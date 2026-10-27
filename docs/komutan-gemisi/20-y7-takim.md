# Y7 · Takım lobisi ve ortak ganimet

24 Ekim 2026 · Y7 kodu ve otomatik doğrulama tamamlandı. Fiziksel cihaz/oynanış kabulü ve canlı dağıtım yapılmadı.

## Kabul ve işlem sınırı

- Mevcut klan lideri lobiyi açar; aynı klanın üyeleri katılır, taktiğini seçip hazır olur.
  Kapasite `CLAN.maxMembers`; üyelik ve liderlik her mutasyonda sunucuda doğrulanır.
- Hazır olma gemi seçimi/seviye/puan/yakıt/mühimmat/bakım durumunu sabitler. Sonradan
  değişen gemi yeniden hazır olmalıdır. Tamir, bakım, uçuş veya yetersiz yakıt bedeli engeldir.
- Kalkış bütün kadro için tek işlemdir; birinin koşulu bozulursa kimse ödemez veya uçuşa geçmez.
  Bir kişilik kadro solo davranır. Tekrarlı kalkış ikinci kez ücret alamaz.
- Takım uçuşları solo kargo yatırmaz. Yalnız başarılı çıkışların kargosu kalıcı havuza gider.
  Ölüm, kopma/kurtarma, test uçuşu havuza kaynak eklemez; XP kişiseldir.
- Bütün sorti sonuçları gelince havuz, kalkışta dondurulan kadroya eşit bölünür. Ölen/atılan/
  klandan ayrılan üyenin payı korunur. Pay yalnız sahibinin başkentine, bir kez ve mevcut günlük
  Yarık aktarım tavanı içinde yatırılır. Çıkış/claim tekrarları çift kaynak üretemez.
- Çökme/deploy tamamlanmamış uçuşları geri çağırır, çıkarılmış havuzu korur. Hiç bağlanmayan
  rezerve gemi 30 saniye içinde geri çağrılır. Sezon donmadan paylar zorunlu kapatılır.
- Dostluk sunucunun klan kimliğinden gelir; farklı takımda/solo giren aynı klan üyesi de dosttur.
  Dost mermi/füze/kilit/tarama hedefi olmaz; kalkan ve onarım kendine veya yaşayan gerçek dosta.
  Onarım alıcının değil gönderenin gücünü kullanır. Dost isim/gövde/harita işaretleri ayırt edilir.
- Ölen takım üyesi kalan arkadaşını izler; maç bitmeden tekrar uçuş açamaz.
- Sahip kararı: bölünemeyen birimler en yüksek değerli ganimeti çıkarana gider; eşitlikte
  sabit oyuncu kimliği sırası kullanılır. Alınmayan pay 7 gün sonra otomatik yatırılır.

## Etkilenen zincir

`rules/arena/team.ts`, savaş/dostluk ve protokol → DB takım/kadro/ganimet göçü →
`arenaTeams` + mevcut `arenaShips` işlem sınırı → arena REST/WS → klan lobisi,
uçuş dost işaretleri, seyirci ve sonuç/claim.

Kilit sırası: sezon → varsa klan → takım → sıralı gemiler → sıralı başkentler.
Solo davranış regresyonu, yetki/sahte gövde, eşzamanlı join/ready/start/claim, yetersiz kaynakta
rollback, dondurulmuş sezon, ayrılan üye, boş havuz, crash recall ve bağlantısız rezerv testlenir.
Uzun ekonomi/sezon simülasyonu bu kapsamda değildir.

## Uygulama notları

- Migration `0200_arena_teams`: kalıcı takım, kalkış kadrosu, dondurulmuş gemi/taktik,
  çıkarılmış yük, pay ve tek seferlik yatırım makbuzu. Gerçek DB sözleşmesi web Zod şemasıyla testlenir.
- Klan sayfasındaki lobi takımı kurar ve uçuş hazırlığına götürür. `Hazırım` ve toplu kalkış,
  varlıklar/şaderler yüklendikten sonra Yarık giriş ekranındadır. Sonraki bağlantı yeniden ücret almaz.
- Takımdan ayrılmadan solo kalkış engellenir. Kalkıştan önce klandan ayrılan/atılan kişinin eski
  rezervi temizlenir; dağılmış klanın hazırlık lobisi kapanır. Başlamış maçın kadrosu değişmez.
- Galaksi klan işlemleri gezegen → klan sırasını kullandığı için yalnız **toplu kalkış**,
  önce sezon satırını özel kilitler. Böylece klan → takım → bütün gemiler/başkentler sırası
  galaksiyle deadlock üretmez. Diğer mutasyonlar mevcut paylaşımlı sezon kilidini kullanır.
  Testte önce deadlock üretildi; düzeltme sonrası iki işlem birlikte tamamlandı.
- Protokol 14: kendi satırında onarımı gönderenin gücü; roster'da sunucu klan/takım kimlikleri;
  bitmiş üyenin snapshot'ında `watching`. `watch` yalnız yaşayan aynı takım kamerasını seçer.
  Yeni sorti açmadan izleyici olarak geri dönülebilir.
- Dost ateşi/kilit/tarama engeli kurallardadır. Dost isim/gövde işaretleri ve radar camgöbeği;
  harita yalnız yaşayan gerçek klan dostlarını gösterir. Destek için A, ardından dosta dokunulur.
- Bekleyen pay hangarda ve sonuçta alınabilir; klan üyeliği şartı aranmaz. Günlük tavanın
  artanı ayrıca gösterilir. Tek kişilik takımın geri çağrılması boş pay bildirimi üretmez.

## Doğrulama ve devam noktası

- Önce yeni testlerde FAIL görüldü; uygulamadan sonra tüm rules paketi **3.148/3.148** geçti.
- Tam web taramasında **639 dosya / 7.674 test** geçti; dört başarısız test düzeltildi:
  hangar sorgu sırası, tanımsız klan renk sınıfı, net görüntü kuralına aykırı bulanıklık,
  seyircide bağlantı hatasının görünmemesi. Sonradan eklenen ganimet sonrası hangar stok
  yenilemesi ve klan hazırlık bağlantısıyla birlikte **74 dosya / 431 test** son koşuda geçti.
  Geniş taramadaki Wiki dosya izleyici sınırı (`ENOSPC`) sistem ayarını değiştirmeden test
  sürecinde polling ile giderildi; aynı Wiki testlerinin **28/28** tekrarı bu 431'e dahildir.
- Gerçek test PostgreSQL'inde arena, gemi, takım, klan, sezon kapanışı/arşivi/silmesi,
  göç sözleşmesi ve şema kontrolü: **18 dosya / 226 test** geçti. Karşılıklı gezegen/klan
  kilidinde deadlock ve çökme kurtarması başarısızken yeni uçuş açılması önce üretildi,
  sonra düzeltildi. Migration 0200 test DB'sinde uygulandı.
- Rules/server/web tip kontrolü ve değişen kaynak/test/araçları kapsayan sıralı `pnpm lint`
  grupları sıfır hatayla geçti. Web üretim derlemesi **12,35 sn** içinde geçti.
- `node tools/visual.mjs .dev/arena/2026-10-24-y7/visual --arena-team`:
  TR/EN × 350/1280 px lobi, hazır/taktik, ortak kalkış ve pay/taşan miktar;
  350 px gerçek render'da dost işareti, dokunarak destek hedefi, dostu izlemeyen nişangâh,
  yaşayan takım arkadaşına kamera geçişi ve sonuç ekranına dönüş geçti. Yatay taşma ve
  tarayıcı hatası yok. HTTP/WS yanıtları izole fixture'dır; oyuncu kaynağına dokunulmadı.
- `ARENA_VISUAL_HANGAR=1 node tools/visual.mjs .dev/arena/2026-10-24-y7/hangar-final --arena`:
  TR/EN × 350/1280 px hangar, ayrı yetenek puanı, 3. rütbe kilidi, tamir ve sınıf değerleri
  tekrar geçti. Son telefon görüntüleri incelendi. Kanıtlar `.dev/arena/2026-10-24-y7/` altında.
- Bütün kontroller tek workspace/worker, sıralı ve en fazla 4096 MiB Node heap ile koşuldu.
  Uzun ekonomi/sezon simülasyonu çalıştırılmadı. `git diff --check` temiz.

Sıradaki plan maddesi **Y8: görsel kademeler ve kostüm**. Y3 telefon belleği/performansı,
Y4 bot TTK ölçümü, Y5 fiziksel cihaz/oynanış kabulü ve Yarık Özü sistemi önceki açık
durumlarını korur. Rütbe 4–5 Öz gelene kadar kilitlidir.

Çalışma `blindspace-arena-playtest` worktree'sinde ve commit edilmemiştir. Commit, push
ve canlı dağıtım yapılmadı. Migration 0197–0200 üretimde ayrıca uygulanmalı, protokol 14
için web/arena birlikte güncellenmelidir. Geçici test PostgreSQL'i kaldırıldı;
mevcut web önizlemesi **http://localhost:5199/** açık bırakılır. Bu yalnız frontend'dir;
canlı API/arena sunucusunun başlatıldığı anlamına gelmez.

## Yerel bağlantı hatası sonrası servis durumu

24 Ekim devamında kullanıcı `Could not reach the server` hatasını bildirdi. Web 5199
açıktı; API 3100, arena 3101 ve PostgreSQL kapalıydı. Bu hata bir işlem tekrar gönderilmeden
tanılandı. Yukarıdaki yalnız-frontend durumu bu incelemenin başlangıcını anlatır.

- Mevcut `astera-pg` başlatıldı. Standart Docker yapılandırması tmpfs kullandığı için önceki
  kapanışta eski yerel veri zaten silinmişti; ilk okumada public tablo sayısı 0 idi.
  Migration'lar uygulandı ve standart `season bootstrap` EU-1/EU-2'yi açtı. Yerel hesap sayısı 0.
- API/worker `ROLE=both PORT=3100`, arena `ROLE=arena PORT=3101 ARENA_ENABLED=true
  ARENA_DEV=false` ile aynı yerel DB üzerinde çalışıyor. Mevcut oturum/koltuk yetkileri korunur;
  herkese Yarık erişimi veya debug yetkisi verilmedi. Origin listesi 5199'un localhost,
  127.0.0.1 ve mevcut LAN adresini kapsar.
- `/health` başarılı; web proxy'sinden `/api/servers` 200, `/arena/health` etkin oda yanıtı,
  oturumsuz `/arena/team` beklenen 401'i verir. Kaynak harcayan kullanıcı işlemi yeniden gönderilmedi.
- Loglar: `.dev/arena/2026-10-24-y7/local-{migrate,bootstrap,api,arena}.log`.
  Bu yerel servisler kullanım için açık bırakılır; `astera-pg` test temizliğiyle kaldırılmaz.
