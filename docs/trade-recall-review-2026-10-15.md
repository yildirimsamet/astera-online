# Ticaret Gemisi filo geri çağırma incelemesi

Kapsam kaynak takası yapılan Ticaret Gemisidir. Galaksilerarası Konvoy ve gezegen
saldırılarının tekrar gönderim kuralları bu değişiklikle değiştirilmedi.

## Davranış

Tüccara varıştan kesin olarak önce, filonun sahibi geri çağırabilir. Filo bulunduğu
noktadan döner. Takas yapılmaz; sağ kalan gemilerde taşınabilen teklif kaynakları
fiziksel varışta teslim edilir. Önceden ödenmiş yakıt iade edilmez. Uçuş yuvası
gemiler eve dönene kadar kullanılır; bütün gemiler zaten yok olmuşsa serbest kalır.

Aynı geri çağırma isteği aynı dönüşü döndürür. Eşzamanlı çağrılar tek dönüş olayı
oluşturur. Eski tüccar varış olayı, geri çağrılmış filoda takas yapamaz. Varışın tam
sınırında geri çağırma reddedilir. Başka bir oyuncunun filo kimliği 404 döndürür.

## İncelemede ele alınan noktalar

1. Dönüşün eski buluşma noktasını ve gelecekteki yanaşma zamanını kullanması yanlış
   rota ve radyasyon hesabına yol açardı. Geri dönüş noktası ve zamanı donduruldu;
   sunucu teslimi, oyuncunun uçuş şeridi, yabancı trafik ve hata kurtarma aynı dönüşü
   kullanıyor. Radyasyon testi dönüş şeridinin geri çağırma anında başladığını doğruluyor.
2. Kalkış kolonisi ele geçirilmişse filo ve teklif kaynakları eski sahibine dönmeli.
   `safeHomePlanet` kullanıldı; dönüşün hedef konumu da kaydedildi. Koloni ele geçirme
   senaryosu filonun sahibinin ana gezegenine teslim edildiğini doğruluyor.
3. Gidişte birikmiş hasar geri çağırmayla silinmemeli, yok olmuş gemiler yaratılmamalı.
   Eski uzamsal HP radyasyon sürümünde yaralanma/yok olma senaryoları; güncel varlık
   radyasyon sürümünde mevcut yaraların korunması kapsanıyor.
4. Oyuncu metinleri ve Wiki eski “geri çağrılamaz” kuralını söylüyordu. Ticaret
   açıklamaları altı dilde ve iki Wiki makalesinde güncellendi.
5. Gerçek mobil görüntüde filo ayrıntısının başlığı `TRADE_SHIP` olarak görünüyordu.
   Başlık için önce davranış testi eklendi ve başarısız olduğu görüldü. Ticaret filosu
   ayrıntısı artık yerelleştirilmiş Ticaret Gemisi adını gösteriyor.

Art arda ticaret filosu göndermek zaten destekleniyordu. Yeni dönen yük gemileriyle
ikinci filo, ilk filo hâlâ yoldayken gönderildi; ayrı gemi konumları ve iki uçuş yuvası
doğrulandı. Ticaret hizmetinde kota veya tek filo yasağı bulunmadı.

## Doğrulama

- Servis: geri çağırma, sahiplik, tam varış sınırı, eşzamanlı istekler, tekrar istek,
  eski varış olayı, kaynakların tek teslimi, radyasyon ve koloni el değiştirmesi.
- HTTP: gerçek istemci Zod şemasıyla geri çağırma cevabı ve bekleyen dönüş şeridi.
- İstemci: ortak geri çağırma düğmesi ve ticarete ait API yoluna yönlendirme.
- Görsel: 350 ve 1280 piksel, Türkçe ve İngilizce; gönderim açıklaması, geri çağırma
  düğmesi ve dönüş durumu. `node tools/visual.mjs out/trade-recall/visual --trade-recall`.
- Geriye uyum: mevcut ticaret kayıtları için yeni sütunlar nullable; eski normal
  ticaretlerin yanaşma/dönüş zamanları korunur. Migration: `0172_trade_recall.sql`.

Genel typecheck/lint/test sonuçları `out/trade-recall/check-results.json` ve ilgili
loglarda bulunur. Ekonomi/sezon simülasyonları çalıştırılmaz.
