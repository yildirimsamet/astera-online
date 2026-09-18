# Gezegen skinleri: uygulama planı

**Durum:** Dört fazın ilk sürümü uygulandı. Fiyatlar taslak; ödeme bağlantısı ve otomatik teslim, satış yöntemi kararlaştırılınca ayrıca açılacak. Ayrı satılan ek varlıklar bu sürüme dahil değil.

## Faz 1 · Ürün ve görünüm sözleşmesi

- Hesapta kalıcı olarak sahip olunan bir **skin** kimliği; model, renk/efekt ve ileride dahil edilebilecek ek varlıkları tek bir tarifte toplar.
- İlk katalog: lav, buz, zehir, çöl. Her biri aynı sağlam GLB modelinin ayrı paletidir.
- Saldırı sonrası altı saatlik toparlanma kalkanı, aynı skinin `RECOVERY_SHIELD` görünümünü seçer: kırık GLB ve aynı palet. Bu durum ayrı ürün değildir. Yeni oyuncu ve işgal kalkanları bu görünümü tetiklemez.
- Gelecekte tarif doğrudan dokulu model veya dahil ek varlık içerebilir; ayrı satılan ek varlıklar için ayrıca sahiplik ve uyumluluk kuralları gerekir.

## Faz 2 · Sahiplik ve giydirme

- Haklar hesaba bağlı, sezonlar arası kalıcıdır. Gezegenin seçimi ise sezonluk gezegen kaydında tutulur.
- Sahip olunan tek skin sınırsız sayıda kişinin **kendi** gezegenine uygulanabilir; gezegenler farklı skinler de kullanabilir. İstenildiği zaman ücretsiz değiştirilebilir; oyun kotası yoktur (sahip kararı, 2026-09-18). Yazma isteğine teknik hız sınırı uygulanır.
- Sunucu her seçimde oturum, gezegen kontrolü ve hak sahipliğini doğrular. Kontrol değişince (ele geçirme, koloni ayrılması) skin seçimi sıfırlanır; yeni sahip kendi skinini uygulayabilir. Hesap silinince hak kaydı **silinmez**: `account_id` boşalır, sipariş referansı kalır ve aynı sipariş başka hesaba tekrar verilemez (sahip kararı, 2026-09-18).
- Hak defteri tüm kozmetik türleri için ortaktır (`cosmetic_entitlements.cosmetic_id`); ileride gemi skinleri veya ayrı satılan ekler aynı tabloya yeni kimlik önekiyle girer.
- Manuel teslim için yalnızca operatöre açık kayıt işlemi: hesap, skin, dış sipariş referansı ve tarih. Tekrar gönderilen sipariş aynı hakkı iki kez vermez; başka hesaba kaydırılamaz.

## Faz 3 · Herkesin gördüğü görünüm

- Galaksi projeksiyonu giyilmiş skin kimliğini ve gerçekten vurulan gezegenin aktif toparlanma durumunu yayınlar. Bilinmeyen gezegenin fog sınırı korunur; keşfedilmiş gezegende görünüm canlıdır. Eski prob anısında kozmetik okuma anında dondurulur.
- Skinli gezegen 3D GLB olarak; skinsiz gezegen bugünkü PNG olarak çizilir. Farklı skinler aynı sahnede aynı anda bulunur. Model yüklenmezse PNG görünür.
- Aynı tarif ve durum seçici mağaza önizlemesi ile galakside kullanılır. Model/renk değişimi savaş kurallarına dokunmaz.

## Faz 4 · Skin sayfası ve teslim akışı

- Menüden açılan sayfa dört skinin 3D modelini döndürüp yaklaştırarak gösterir; normal ve toparlanma görünümleri karşılaştırılabilir.
- Fiyat gösterilmez; sahip olunmayan skin "Yakında" olarak etiketlenir ve sayfa ödeme sisteminin hazır olmadığını söylemez, yalnızca skinlerin yakında geleceğini söyler. Ödeme yöntemi kesinleşene kadar kullanıcıya açık ödeme bağlantısı yoktur; operatör doğrulanmış dış siparişten manuel hak tanımlar.
- Sahip olunan skin, oyuncunun kendi gezegenleri için tek sayfadan ayrı ayrı uygulanır veya varsayılana döndürülür. İşlem sonucu galakside diğer oyunculara da akar.

## Kabul koşulları

1. Tek hak, birden fazla gezegende aynı anda kullanılabilir; farklı haklar farklı gezegenlerde birlikte görünür.
2. Hak sahibi olmayan ya da gezegeni kontrol etmeyen kullanıcı seçimi değiştiremez.
3. Toparlanma kalkanı bitince model sağlam haline döner. Başka korumalar kırık modeli göstermez.
4. PNG gezegenlerle GLB gezegenler aynı sahnede görünür, bilinmeyen gezegen bilgisi açığa çıkmaz.
5. Sezon değişimi hakkı korur; gezegen seçimi yeni gezegene kendiliğinden taşınmaz.
