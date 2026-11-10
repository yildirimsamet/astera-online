# İki taktik ve manevra kayaları — 2026-11-09

Sahip, her komutan gemisinin mevcut ana yeteneğinin yanında iki seçilebilir taktik
taşımasını ve boş çatışma alanlarına farklı büyüklükte kaya grupları eklenmesini istedi.
Hedef, sürekli birbirine dönerek takip eden pilotlara görüş kesme ve yön değiştirme fırsatı vermek.

## Seçim ve kontrol

- Ana yetenek **Q**, taktik yuvaları **E / C**; **F** gaz azaltma olarak kalır.
  Geliştirmedeki çarpışma görünümü **Alt+C** ile açılır.
- Hazırlıkta önce yuva, ardından taktik seçilir. Diğer yuvadaki taktik seçilirse yerleri
  değişir; aynı taktik iki yuvada bulunamaz. Son seçimler cihazda saklanır.
- Mobilde ikinci taktik, ilk taktiğin solunda ve biraz yukarısındadır. Ateş, turbo,
  ana yetenek ve yön çubuğunun etkileşim alanları korunur. Her taktiğin ayrı sayacı vardır.
- Beklemeler bağımsızdır. Mevcut yetenek süreleri, güçleri, puanları ve sınıf yakınlığı
  değişmez; her yuva kendi taktiğinin kazanılmış rütbesini kullanır.
- Takım hazırlığı iki seçimi kaydeder; kalkışta kadroyla birlikte donar. Yeniden bağlanma
  uçuşun seçimini sürdürür. Eksik ikinci yuva eski kayıtlar için kabul edilir.

## Harita

- `buildArenaLayout` mevcut yapılara ve kaynaklara dokunmadan boş uçuş düzlemine kaya ekler.
  Üretim kaynak yerleşiminden sonra yapılır; kaynak konumları, kimlikleri ve ödülleri korunur.
- Mevcut tohumda **490 kaya / 185 grup**: 47 tekli, 53 ikili, 44 üçlü, 41 beşli.
  Büyük bir ana kaya ile daha küçük eşlikçilerden oluşur. Katalog modelleri kullanılır;
  çizilen geometri, çarpışma ve görüş engeli olarak mevcut sisteme katılır.
- Gruplar bütünüyle yerleştirilir veya elenir; yarım gruplar bırakılmaz. Giriş/çıkış,
  yapı yaklaşımı ve ana koridorların mevcut koruma alanları uygulanır. Kaynak toplama
  noktaları çevresinde boşluk bırakılır; grup içi kaya yüzeyleri arasında en az 50 m vardır.
- Harita sürümü **6**, arena protokolü **16**. İstemci ve arena sunucusu birlikte yayınlanmalıdır.
  Veritabanı migration'ı: `0229_arena_dual_tactics`.

Bu düzenleme uçuş hızını, dönüşü veya nişanı değiştirmez. Dairesel takibi kesin olarak
bitirdiği iddia edilmez; bunun için iki pilotla gerçek karşılaşma testi gerekir.

## Doğrulama

Kurallar: her sınıfta bütün farklı taktik çiftleri ve yuva sıraları, bağımsız bekleme/rütbe,
seçilmeyen taktiklerin reddi, snapshot aktarımı; haritada grup boyutları, kaynak açıklığı,
giriş/çıkış, çarpışma ve tohum tutarlılığı.

İstemci: seçim, iki kontrol, E/C, takım hazırlığı ve yeniden bağlantı. Gerçek tarayıcı
akışı: `WEB=http://127.0.0.1:5297 node tools/visual.mjs out/arena-dual-tactics --arena-dual-tactics`.
Bu kontrol 350 px mobil ve 1280 px masaüstünde hazırlık → kalkış → iki taktiği kullanma
akışını ve düğmelerin birbirine taşmamasını doğrular; görselleri aynı klasöre yazar.
