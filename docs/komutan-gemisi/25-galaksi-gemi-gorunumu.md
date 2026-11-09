# Galakside Komutan Gemisi görünümü — 2026-11-09

Sahip, galaksideki komutan gemilerinin küçük ve sönük kaldığını bildirdi. İki kat boyut,
temiz/cilalı metal parlaması ve daha uzun egzozu onayladı; ilk görselden sonra egzozun
genişliğinin yaklaşık %25 azaltılmasını istedi. Yarık'taki model ölçeği bu değişikliğin kapsamında değil.

## Uygulama

- `PARK.length`: 0,7 → **1,4 gezegen yarıçapı**. Gemi uzunluğu gezegen çapının %70'i.
  Mevcut yörünge ve dönüş süresi korunur.
- `ESCORT_LENGTH`: 1,15 → **2,3 filo temel birimi**. Ana galakside uçan gövde uzunluğu
  **1,656 sahne birimi**; tek başına dönüş aynı ölçeği kullanır. Filo yuvası ve seçim
  alanı boyutu mevcut ortak hesaplardan büyür.
- `createCommanderHull`, galaksiye özel materyal kopyaları oluşturur. Önbellekteki GLB,
  geometri ve dokular değiştirilmez; hangar/Yarık materyalleri etkilenmez.
  Metalin gövde rengi ve haritaları korunur. İnce clearcoat, daha düşük pürüzlülük ve
  mevcut uzay yansımasının biraz daha güçlü okunması cilalı yüzey hissini verir.
- `CommanderDrive`, mevcut kapalı plazma geometrisini gerçek motor noktalarına bağlar.
  Alev geriye doğru incelir, hafif titreşir ve akışı shader ile görünür. Boyu sınıfa göre
  0,32–0,60 gövde uzunluğudur. Alevin enine ölçeği ve motor halesi ilk görsele göre
  **%25 daraltılmıştır**; uzunluğu korunur. Yumuşak saydamlık, yüzeyi örten beyaz parlamayı sınırlar.
- Tamir/bakımda egzoz kapalı kalır. Sahnede yeni ışık, gölge geçişi veya varlık indirmesi yoktur.
  Galaksi için en düşük detay seviyesi ve mevcut uzay aydınlatması kullanılır.

## Etkileşimli inceleme

`/v2-gallery.html?view=commander-presence&lng=tr`

Üç sınıf, yakın inceleme, gezegen yanı, filo eşliği, tek başına dönüş ve motor aç/kapat.
Sol tuş döndürür, tekerlek yakınlaştırır, sağ tuş kaydırır. Telefonda döndürme ve iki
parmakla yakınlaştırma desteklenir. Ayrı yakınlaştır/uzaklaştır ve kamera sıfırlama düğmeleri vardır.
Bu sayfa gerçek galaksi render bileşenlerini yerel örnek verilerle çalıştırır; sunucuya yazmaz.

## Doğrulama

- Boyut, filo aralığı, dönüş ölçeği, materyal/doku paylaşımı ve temizliği, alev geometrisi
  ve sayfa seçimleri ilgili testlerle kontrol edilir.
- `node tools/visual.mjs out/commander-presence-polished --commander-presence` gerçek
  GalaxyView/Canvas içinde üç sınıfı, bakımda kapalı egzozu, filo ve dönüşü inceler.
- Etkileşimli sayfada gerçek tarayıcıyla modelin yüklenmesi, yakınlaştır/uzaklaştır,
  sınıf ve filo seçimi kontrol edildi. Fiziksel Android cihazı doğrulaması yapılmadı.
