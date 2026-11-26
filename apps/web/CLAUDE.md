# apps/web — Tasarım disiplini

Kök `CLAUDE.md` §4'ün ayrıntısıdır; `apps/web` altında çalışırken otomatik yüklenir. Kökteki kurallar (VFX briefi, hareket tercihi, el kitabı §4.7) burada da geçerlidir.

Frontend görevlerinde ilgili gamedev skill'lerini (Game Development Router) incele ve gerekli olanları kullan. Yeni veya güncellenen her component, sayfa, section, element ve tasarım aşağıdaki **beş ilkeye** uymalıdır. İlk dört kullanılabilirlik ilkesi her ekranda estetik tercihlerden önce gelir; bunlardan birini karşılamayan yüzey, bitmiş görünse de tamamlanmış değildir. Geliştirici sayıların anlamını zaten bildiği için bu eksikleri fark etmeyebilir.

## 1. Clarity — Oyuncu bunu anlıyor mu?

Bir değeri göstermek, anlaşılır kılmak değildir. Oyuncunun karar verirken kullanacağı her sayının yanında şu soruların yanıtı anlaşılabilmelidir:

- Bu neyi temsil ediyor?
- Büyük olması iyi mi?
- Benim karşılık gelen değerimle nasıl kıyaslanıyor?
- Başka nelerle ilişkili?
- Bunu hangi karar için kullanacağım?

## 2. Predictability — Oyuncu sonucu tahmin edebiliyor mu?

Kesinlik verme: belirsizlik oyunun temelidir; “kazanacak mıyım?” sorusuna kesin cevap veren ekran, temel döngüdeki riski ortadan kaldırır. Ancak hiç tahmin edilemeyen sonuç rastgele görünür ve istihbaratın değerini yok eder; belirsizliği azaltmayan bilgiye kimse bedel ödemez.

**Oyuncu bir beklenti oluşturabilmeli ve bu beklentisinde yanılabilmelidir. Girdileri ve kuralı ver; cevabı verme.**

## 3. Decision support — Oyuncu karar vermek için gereken bilgiye sahip mi?

- Kurallar kullanıldıkları yerde, o anda gereken miktarda keşfedilebilir olmalıdır.
- Ne yirmi sayfalık Wiki/her kartta bütün kurallar ne de açıklamasız bir sistem uygundur.
- Kademeli açıklama kullan: satır olguyu, bir dokunuş ilerideki sheet kuralı anlatır.
- Kuralları karar verildikten sonra öğretme. Örnek: her savaşı belirleyen counter cycle çarpanlarının yalnızca filo kaybedildikten sonraki savaş raporunda görünmesi karar desteği değildir (D124).
- Oyuncu özelliğin neden var olduğunu hissedebilmelidir. “Bunu neden yapıyorum?” diyorsa “bana ne kazandırır?” ve “ne zaman kullanmalıyım?” yanıtları yüzeyde eksiktir.

## 4. Interaction cost — Kullanmak ne kadar zahmetli?

Scroll, dokunma ve ekran değiştirme maliyettir. Karşılaştırılacak on öğenin her birinin bir ekran kaplaması ile toplam iki ekrana sığması aynı deneyim değildir.

350 px genişliğindeki telefonda bilgi yoğunluğu ve ekran ekonomisi dekoratif boşluktan önce gelir. **Her boşluğun amacı olmalıdır.** 74 px görsel alanı yüksekliğini hak edebilir; 40 px'e inen render favicon gibi görünür. Kapalı bir bölümün altında duran paragraf ise alanını hak etmez.

## 5. Premium design — Görsel kalite zorunludur

- Hedef premium AAA kalitesidir; görsellik ve premium hissiyat oyuncuyu etkileyen başlıca unsurlardandır.
- Görsel dilin kaynağı `docs/ui-v2/gozlemevi.md` (her ekranın uyduğu altı kural, renklerin anlamları) ve `docs/ui-v2/design-mocks/` mock'larıdır; tasarımı bunlardan türet.
- **UI kiti zorunludur (owner, 2026-11-26):** Ekranlar `src/game-ui/` parçalarıyla kurulur. Kitte karşılığı olan şey elle çizilmez; karşılığı olmayan önce kite eklenir. Önemli anın kendine özgü sunumu da kitin token'larıyla kurulur. Hangi iş için hangi parça, token'lar ve yerleşim kuralları: `docs/ui-kit.md`.
- Geliştirdiğin, güncellediğin veya düzelttiğin işin tasarım gereksinimlerini asla atlama.
- **VFX briefi (owner, 2026-11-18):** Efekt yazmadan önce 3 satırlık VFX briefi yazılır ve teslimde gösterilir: o anda dünyada fiziksel olarak ne oluyor, kütüphaneden hangi asset (yol), neden bu olayı anlatıyor. Yumuşak yuvarlak parlama, büyüyen hale ve "her yere uyan" efekt yasaktır.
- Oyun hareketleri işletim sisteminin hareket tercihinden bağımsızdır. **Yalnız public landing CSS'i**, owner'ın 2026-10-18 tarihli açık erişilebilirlik talebiyle istisnadır.

## 6. Game feel — Biz bir OYUNUZ: oyuncu deneyimi standardı (owner, 2026-11-06)

Astera Online, mobil öncelikli, web tabanlı ve android uygulaması olan bir 3D uzay strateji oyunudur. Oyuncuya canlı bir dünyada bir gemiyi, gezegeni veya filoyu yönettiğini hissettir. Oyuncuya dokunan her görevde, sistemin nasıl çalışacağıyla birlikte oyuncunun onu nasıl keşfedeceğini, kullanacağını ve sonucunu nasıl hissedeceğini tasarla. Bu, görevin parçasıdır. Kullanıcının her animasyonu, sesi ve etkileşimi ayrı ayrı tarif etmesini bekleme.

Her geliştirmede uygula:
- Önce oyuncunun yaşayacağı anı belirle. Mevcut akışı incele. Oyuncu bu ekrana niye geliyor, ilk neyi fark etmeli, hangi eylemi yapmalı ve sonrasında dünyada ne değişmeli? Görseli, kontrolü ve geri bildirimi bu akışa göre seç.
- Eyleme uygun bir kontrol tasarla. Bir sistemi devreye almak şalteri çevirmek, bir sinyali araştırmak sahnedeki kaynağa dokunmak, kritik bir işlemi başlatmak kısa süre basılı tutmak gibi hissettirebilir. Sık kullanılan işlemleri hızlı ve anlaşılır tut. İlk çalıştırma, keşif, onarım ve sıçrama gibi önemli anlara daha fazla özen göster. Her kontrolün ne yaptığı ve nasıl kullanılacağı anlaşılır olsun.
- Sonucu oyun dünyasında göster. Oyuncunun eylemine sahne, nesne ve arayüz birlikte karşılık versin. Bir rafineri devreye girdiğinde ocağı tutuşabilir. Bir gemi onarıldıkça arızalı bölümleri sönebilir ve sistemleri yeniden ışık verebilir. Animasyon, ses, kamera ve desteklenen cihazlarda titreşimi eylemin ağırlığına göre kullan. Temel durum ve sonuç, ses kapalıyken de anlaşılabilsin.
- Oyuncuya bir sonraki hamlesi için neden ver. Özellikle ilk deneyimde oyuncu mevcut durumunu, sıradaki adımı, bu adımın ne işe yaradığını ve uzun vadede nereye varacağını anlayabilsin. Merak veya sahiplenme yaratmak istediğin yerde bunu akışın içine koy. Örneğin oyuncu bir sinyali izleyip gemiyi gerçekten görürse, gemiyi sahiplenme çağrısı anlam kazanır.
- Görsel kaliteyi sahneye göre değerlendir. Ana nesne ilk bakışta seçilsin. Işık, siluet, renk ve hareket dikkati doğru yere taşısın. Hasar ve ilerleme, mümkün olduğunda modelin ve çevrenin değişiminden okunsun. Oyunun görsel dilini koru ve etkileşimi bağlamına göre şekillendir.
- Mobil tasarımda baş parmakların ulaşabilecegi alan ve mesafeleri değerlendir. Kullanıcı deneyimini atlama.

İnisiyatif ve teslim:
- Oyuncu açısından hedefi anlayınca, kapsam içindeki yaratıcı kararları kendin ver ve uygula. Yukarıdaki örnekleri yaklaşımı anlamak için kullan. İlerleme kuralları veya oyun dengesi gibi ürün kararlarını değiştirmek gerekiyorsa netleştir. Rutin görsel ve etkileşim kararları için onay bekleme.
- Mevcut bileşenleri ve varlıkları uygun yerlerde kullan. Mobilde okunabilirliği, dokunma rahatlığını ve performansı koru. Geri bildirimi gerçek oyun durumuyla eşleştir. Bekleyen işlem, başarı ve hata oyuncu açısından ayırt edilebilsin.
- Oyuncuya dokunan bir işi tamamlandı saymadan önce değişikliği mobil boyutta, oyunun normal akışından bir oyuncu gibi çalıştır. Eylemi nereden keşfediyorum, ne yapacağım belli mi? Yaptığım şeyin karşılığını görüyor muyum? Sonraki adımı anlıyor muyum? Bu an, oyundaki önemine uygun hissettiriyor mu? Kapsam içindeki eksikleri teslimden önce düzelt. Teslimde hangi oyuncu deneyimini tasarladığını ve neyi doğruladığını kısaca belirt; akışı çalıştıramadıysan hangi kısmı doğrulayamadığını açıkça yaz.

Hedef, Unity/Godot/Unreal ile yapılmış bir oyun hissidir; web formu değil. Her yeni veya güncellenen etkileşim için, owner söylemeden:

- **Eylemin fiziği olsun:** önemli an düz bir buton değildir. Şalter, kol, basılı tutma, sürükleme, çekme veya itme kullan; jest, eylemin anlamını taşısın (güç bağla → şalter indir).
- **Her eylemin cevabı olsun:** ses (`lib/sound`), titreşim (`haptic`) ve görsel tepki birlikte gelsin. Örneğin rafineri başlayınca ocak alevlensin. Sessiz ve hareketsiz bir sonuç, eksik bir sonuçtur.
- **Sahne canlı olsun:** durağan görsel yoktur. Hafif dönüş, titreşim, parıltı, duman, kıvılcım ve ışık olsun. Hasar ve onarım durumu görselde okunsun.
- **Tekdüzelik yasaktır:** her yere aynı buton ve kart konmaz. Önemli anın kendine özgü bir sunumu olsun.
- **Oyuncunun elinden tut ve hikâye anlat:** her ekranda sıradaki adım ve nedeni görünür olsun. Açılan sistem vurgulanarak tanıtılsın; kilit işaretiyle ne açılacağı belli olsun. Açıklama yerine hikâye kullan ("bu gemi senin olabilir"), sezon/teknik dil yerine anlam.

Kendine sor: **"Oyuncu burada büyülenir mi, bir şeye dokunduğunu hisseder mi?"**

Her yüzey için sor: **“Bu arayüz yalnızca GÖSTERİYOR mu, yoksa YARDIM EDİYOR mu?”** Bütün bilgileri sunmak, oyuncunun karar verebildiği anlamına gelmez; daha fazla göstermek her zaman daha fazla yardımcı olmak değildir.

Konuya uyan `gamedev:` skill'lerini kullan: three.js sahnesi, glTF ve materyal (`gamedev:threejs-*`), `gamedev:game-feel`, `gamedev:game-ui-ux`, `gamedev:camera-systems`, `gamedev:audio-design`, `gamedev:shader-programming`, `gamedev:performance-optimization`, `gamedev:create-game-assets` ve diğerleri.

> Oyuncu API'yi anlamaz. Oyuncu gördüğünü anlar, gösterileni bilir!
