# Komutan Mirası — son model teslimi

1 Kasım 2026. Ayrı worktree: `/home/yildirim/.codex/worktrees/legacy-models/blindspace`.

## Envanter ve eşleştirme

36 Meshy ödül (9 aile × 4 metal) ve dört özgün Ölüm Yıldızı varyantı entegre edildi. Kullanıcının 27 `.meshy` kaynağı değiştirilmedi. Son GLB’ler, kaynak SHA-256 kimlikleri, onarım/bake raporları ve 36 modeli içeren düzenlenebilir `.blend`, `/home/yildirim/Downloads/meshy_convert` altında.

| Aile | Başarım | Eşik |
| --- | --- | --- |
| radyasyon | Radyasyon Ustası | 1 / 10 / 50 / 100 fırlatma |
| silah_arkadasi | Silah Arkadaşı | 1 / 5 / 20 / 50 ortak saldırı |
| anit_tutma | Anıt Bekçisi | 1 saat / 12 saat / 1 gün / 3 gün |

İlk altı aile ve bütün onaylı miktarlar önceki entegrasyon kaydında; bu tur yeni eşik icat edilmedi. Yaygın demir, Nadir bronz, Destansı gümüş, Efsanevi altın. Destekçi kullanıcının son kararıyla **Efsanevi**.

## Onarım ve malzeme

- Yeni 12 modelde açık bağlantılar kapatıldı; metal temiz ve parlak. Kir/yıpranma üreten piksel eşik maskeleri kaldırıldı. Uygun bütün parçalarda düz koyu mine, anıtın bazı ana yüzlerinde gümüş vurgu kullanılıyor.
- İlk 24 modelin gölgelendirme teşhisi: önceki normal yeniden hesaplama kaynak ayrıntısını değiştirmişti. Güvenli kaynak normalleri korundu; yeni/bozuk yüzlerde kaynak hatalı normaller geri getirilmedi. Var olan renk WebP byte’ları aynen korundu.
- Kaynakta bağımsız normal/roughness/AO haritası yoktu; hiç var olmayan bir haritanın silindiği iddia edilmez. Gerçek geometrik AO, çakışmayan ayrı 512px UV kanalına pişirildi.
- Honor kaidesindeki iki küçük yıldız dört metalden de kaldırıldı; üst ana semboller korundu. Önceden kaldırılan sabit 1/2/3 yazıları geri gelmedi.
- Ölüm Yıldızı’nda reddedilen kuşak/bant tasarımı kullanılmıyor. Yalnız mevcut bütün kanat plakaları ve burun kapağı metal kaplandı. Özgün koyu/kırmızı gövde dokusu ve malzemesi, geometri, UV, normaller ve düğüm pozları korunuyor. Reddedilen üretici devre dışı bırakıldı.

## Özel parçalar ve sunum

Sezon Hatırası ve madalya kapaklarının UV’sindeki 90° yön hatası düzeltildi. Rölyef 512px, yazı/ikonlar açık gümüş-beyaz; aşırı bump azaltıldı. Destekçi’de kumaşla uyumlu turkuaz kabartma kalp var. Yıl rozeti eski düz kalkan yerine katmanlı metal, mine, döküm defne, kabartma yıldız ve yörüngeyle yeniden yapıldı.

Gemi minyatürleri LOD dosyasının eksik metadata’sı yerine özgün modelin facing/pose bilgisini kullanıyor. Egzozlar aynı poz uzayında ve galaksinin kendi `Exhaust`/`StrategicExhaust` bileşenlerinden geliyor; Yarık/arena alevi kullanılmıyor. Ölüm Yıldızı burnu yukarı açılı. Başa Bela, Gösterişçi, Ok ve Kıyamet Tersanecisi gerçek ödül detay bileşeninde incelendi.

## Doğrulama ve teslim

- Khronos: 40/40, sıfır hata ve uyarı; bütün source/runtime dosya kimlikleri aynı.
- 36 Meshy modelin ön/arka Three.js görüntüleri alındı; geometri/AO/normaller raporlandı. Stratejik dört modelde özgün geometri ve doku bütünlüğü ayrıca doğrulandı.
- 40 GLB toplam yaklaşık 20,25 MB; tek dosya yaklaşık 331–786 KB. Bütün koleksiyon aynı anda 40 WebGL context açmıyor; küçük resimler tek geçici renderer ile sırayla üretiliyor.
- `Astera_Awards_Polished.zip` 40 son GLB, güncel Blender dosyası, rapor ve contact sheet’lerle yenilendi; arşiv CRC kontrolü geçti. Eski ana kopyaların sürüm farkları kaynak klasöründeki README’de açık.
- Fiziksel telefon GPU ölçümü yapılmadı. Yazılımsal WebGL capture gerçek cihaz benchmark’ı değildir.

## Önizleme

- [Yeni ailelerin vitrini](http://192.168.1.73:5188/v2-gallery.html?view=legacy-profile&self=1&lng=tr&awards=new)
- [Ölüm Yıldızı](http://192.168.1.73:5188/v2-gallery.html?view=legacy-award&award=final-verdict&lng=tr), aynı adrese `&tier=1`, `2`, `3`, `4` eklenebilir.
- [Yıl rozeti](http://192.168.1.73:5188/v2-gallery.html?view=legacy-award&award=year-of-service&lng=tr)
- [Destekçi](http://192.168.1.73:5188/v2-gallery.html?view=legacy-award&award=astera-supporter&lng=tr)

Galeri örnek veridir; gerçek hesaba sahte ödül eklenmez. Önizleme API’si ayrı kopya DB’ye bağlı. Production deployment veya ana çalışma alanına kopyalama yapılmadı. Son frontend incelemesi `commander-legacy-frontend-review-2026-11-01.md` içindedir.
