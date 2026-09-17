# iOS Safari'de lazy modül yükleme hatası (16–17 Eylül 2026)

## Gözlem

İki oyuncu raporunda aynı iPhone Safari hatası var: `TypeError: Importing a module script failed.`
İlki 16 Eylül 09:27 UTC'de `index-DFHY1bL8.js`, ikincisi 17 Eylül 04:12 UTC'de
`index-LoGevwk1.js` çalışırken oluşmuş. React bileşen zinciri `Lazy → Suspense` gösteriyor.
Bu sürümde galakside tembel yüklenen üç ekran `ClanScreen`, `IntergalacticConvoySheet` ve
`AdminPanel`; raporda başarısız isteğin URL'si olmadığı için üçünün hangisi olduğu
belirlenemiyor. Dolayısıyla bu belge belirli bir ekranı hatalı ilan etmiyor.

17 Eylül 12:39 UTC'deki canlı `HEAD` kontrolünde bu iki eski ana paket URL'si de `404`
döndü. Bu tek başına rapor anındaki eksik chunk'ı kanıtlamaz: ikisi de artık eski sürüm.
Ancak dağıtım kodu eski hash'li varlıkları `rsync --delete` ile siliyordu; uzun süre açık
kalan sekmelerin daha sonra `import()` ile eski bir chunk istemesi deterministik biçimde
aynı hataya yol açar. Nginx ayrıca eksik `/assets/` yanıtlarına bile bir yıllık
`immutable` önbellek başlığı ekliyordu. Bu iki bulgu birlikte dağıtım kaynaklı
yükleme arızasını güçlü biçimde destekliyor. Ağ kesintisi veya Safari'nin kendi
önbellek hatası da aynı metni üretebilir; mevcut raporda ağ isteği yok.

## Düzeltme

- `deploy/publish-web.sh` yeni varlıkları önce yayınlar, eski hash'li dosyaları
  korur, kaldırılmış içerik sayfalarını temizler ve `index.html` dosyasını en son
  atomik olarak değiştirir.
- Eski `index.html.gz` silinir; aksi halde Nginx yeni düz HTML yerine eski
  sıkıştırılmış HTML'yi gönderebilir.
- Hem kısa dağıtım betiği hem operasyon rehberindeki durdurulmuş ve rolling
  yayın yolları eski hash'li varlıkları korur.
- Başarısız `/assets/` yanıtlarına artık bir yıllık `immutable` başlığı eklenmez.
- Entegrasyon testi açık sekmenin eski modülünü ve yeni build'in varlıklarını
  aynı webroot içinde doğrular.

## Üretim doğrulaması

Bu değişiklik üretime çıktıktan sonra eski sürümle açık bırakılmış bir sekmede
klan/konvoy/yönetici panelini açıp Network panelinde ilgili eski `.js` isteğinin
`200` döndüğünü doğrula. Yeni raporlarda başarısız modül URL'sini ve HTTP durumunu
da kaydetmek, ağ hatası ile dağıtım hatasını ayırmayı mümkün kılar.

Hash'li varlıklar bilinçli olarak otomatik temizlenmiyor. Disk kullanımı ayrıca
izlenmeli; temizlik politikası eklenirse açık sekme ömrü ve `Cache-Control`
süresi birlikte ele alınmalı.
