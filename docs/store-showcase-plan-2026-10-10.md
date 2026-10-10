# Menü vitrini ve araştırmaya dayalı mağaza iyileştirmeleri

İstek: tek sahnede bir gezegen, halka, yörüngede Red Dragon, geminin üzerinde premium klan bayrağı ve ayrı yörüngede probe. Mobilde kabul edilen kompakt yerleşim korunacak. Analitik olay eklenmeyecek.

Sahne: Lav gezegeni, Helios halkası, Red Dragon, Ash Phoenix bayrağı ve UFO probe. Oyunun mevcut modelleri ve efektleri tek, küçük bir Canvas içinde kullanılıyor. Bayrak gemiyle birlikte hareket ediyor; probe ters yönde ve farklı hızda dönüyor. Son görsel geri bildirimle buz gezegeni lava çevrildi, bayrak yaklaşık %23 küçültüldü ve probe yörüngesi dışarı açıldı. Görsel metin ve dokunma alanlarını kaplamıyor. Yükleme/model/WebGL hatasında mağaza girişi kullanılabilir kalıyor. Menü kapandığında sahne kaldırılıyor.

Araştırmanın oyuna uyarlanması:

- [NN/G ürün sayfası araştırması](https://www.nngroup.com/articles/ecommerce-product-pages/): tanınabilir ürün görseli, karşılaştırılabilir ürün bilgisi, görünür fiyat ve işlem geri bildirimi. Mevcut döndürülebilir ürün önizlemeleri korunacak. Ürün görseli ile kullanım kapsamı birlikte gösterilecek; ödeme hazırlanırken bu durum düğmede belirtilecek.
- [Baymard ürün listesi araştırması](https://baymard.com/research-articles/product-listing-information): temel bilgiler liste üzerinde bulunmalı. Gezegen dışındaki ürün kartlarına sunucunun yerel fiyatı eklenecek. Gemi kartlarında gövde uygunluğu ve sahiplik bilgisi korunacak. Ücretsiz/sahip olunan ürünler satın alınabilir gibi gösterilmeyecek.
- [NN/G hata mesajı rehberi](https://www.nngroup.com/articles/error-message-guidelines/): hata nedenini anlaşılır biçimde göster, uygulanabilir kurtarma yolu sun. Sunucunun bilinen kozmetik/ödeme reddi korunacak. Fiyat yükleme hatası satışın henüz açılmamasıyla karıştırılmayacak; yalnız fiyat sorgusu yeniden denenecek.

Bunlar kullanılabilirlik bulgularının Astera'ya uyarlanmasıdır; Astera'da ölçülmüş satış artışı iddiası değildir. Yeni fiyat, indirim, ödeme sağlayıcısı veya oyun mekaniği eklenmeyecek.

Riskler ve doğrulama: mevcut mağaza/envanter geçişleri, ücretsiz bayraklar, mevcut sahiplik, gövde bilgisi, Shopier alternatifi, ülkeye göre fiyatlandırma, farklı kategorilerde hata/bekleme ve fiyatı olmayan ürünler. İşlevsel değişiklikler önce başarısız regresyonla doğrulanacak. Görsel sahne mobil/masaüstünde, birkaç farklı hareket anında ve varlık yükleme hatasıyla kontrol edilecek. Önceki ilgisiz asteroid/koloni değişikliklerine dokunulmayacak.

Ek UFO isteği: diskin altından aşağıya doğru genişleyen, beyaza yakın yarı saydam bir ışık huzmesi skin'in ortak parçası olacak. Ayrı ürün, mekanik veya hak eklenmeyecek. Aynı efekt mağaza/envanterdeki ortak model önizlemesinde, menü vitrininde, kendi uçan probe'unda ve tanımlanmış yabancı probe'da kullanılacak. Ürün küçük resmi de aynı sahneden yeniden üretilecek.

Son görsel geri bildirim: ilk ışığın dalgalı çizgileri denizanasını andırıyordu; kullanıcı loş ve sınırları belirgin olmayan bir huzme istedi. Çizgiler kaldırıldı, kenarlar ve alt uç yumuşatıldı, ışık ağzı kısıldı. Hareket yalnız çok hafif bir parlaklık değişimi olarak korundu. Ürün küçük resmi bu görünümden yeniden üretildi.

UFO riskleri ve sınırlar: efekt yalnız kataloğun UFO model/önizleme yollarında oluşmalı; varsayılan probe, gemiler ve kimliği belirsiz temaslar etkilenmemeli. Huzme gövdenin altında kalmalı, ufak bir geometri bütçesi kullanmalı, derinlik testine uymalı ve dokunma hedefi olmamalı. Yükleme hata sınırları, normalize edilmiş gövde boyutu ve orijinal GLB korunmalı. URL eşleştirme/yerleşim regresyonları önce kırmızıya düşürülecek; ardından gerçek tarayıcıda ürün, vitrin ve iki oyun içi çizim yolu incelenecek. Görsel shader/tasarım değişiklikleri tasarım istisnası kapsamındadır.

Son durum: istenen sahne, mobil görsel düzeltmeler, araştırmaya dayalı fiyat/işlem geri bildirimi ve ortak UFO ışığı uygulandı. UFO ürün görseli gerçek sahneden yeniden üretildi; altı dilde açıklaması güncellendi. Önce kırmızı, sonra yeşil işlevsel regresyonlar ve gerçek tarayıcı kontrolleri tamamlandı. Son tam web koşusu 5.655 PASS / 29 mevcut SKIP; tip kontrolü PASS; incelemeye ait 42 dosyada lint 0 hata / 0 uyarı. Tam sonuçlar [inceleme raporunda](store-inventory-review-2026-10-09.md). Analitik eklenmedi.

Loş ışık rötuşu tam koşumdan sonra yalnız görsel shader, ışık ağzının opaklığı ve ürün görselini değiştirdi. Sonrasında UFO/varlık regresyonlarındaki 5 test, değişen iki kaynak dosyasının lint kontrolü ve `tools/visual.mjs --ufo-probe` içindeki beş tarayıcı görünümü yeniden geçti. Kanıtlar `out/store-showcase-20261010/ufo-dim*` altında.
