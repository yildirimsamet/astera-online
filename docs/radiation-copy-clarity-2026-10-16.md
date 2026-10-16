# Radyasyon açıklamaları — 2026-10-16

İstek: Aegis'in seviye başına korumasını toplam radyasyon sınırından ayrı anlatmak. `docs/ux-writing.md` uygulandı. Yalnız oyuncu metinleri değişti; mekanik değişmedi.

- Aegis açıklaması: her aktif seviyenin, o gezegendeki gemilerin radyasyon hasarını 1 HP/dk azalttığı doğrudan söylendi. 50 HP/dk sınırı bu cümleden çıkarıldı.
- Toplam sınır, bomba/hasar açıklamasında ayrı cümle. Ekrandaki koruma ve koruma sonrası hasar ayrı etiketler.
- Gemi araştırması: yalnız gemileri koruduğu, gezegende Aegis'in ek koruma verdiği, anıtta geminin korumasının geçerli olduğu anlatıldı. Evde güncel araştırma, gönderilmiş filoda kalkış seviyesi ayrımı korundu.
- Araştırma özetindeki eski yalnız L1/L2 ifadesi düzeltildi: araştırma her radyasyon seviyesinde geçerli.
- Bomba süresi yenileme izlenimi vermesin diye her bombanın isabet ettiği yerde 30 dakika radyasyon oluşturduğu söylendi.
- Onarım: Aegis aşılırsa tamir/parçalama durur; süren onarım iptal edilir ve kaynaklar tam iade edilir.
- Koloni arızası: belirsiz “Çekirdek gereksinimi” yerine hedef kolonide Çekirdek 6 ve arıza korumasının bulunmaması açıklandı. Bomba üretim şartıyla karışması önlendi.
- Altı dilde gezegen, araştırma ve Aegis eşya açıklamaları; İngilizce/Türkçe Wiki birlikte güncellendi.

## Doğrulama

- Mevcut çeviri, radyasyon göstergesi, araştırma, üretim ve Wiki testleri: 9 dosya / 247 test geçti (`/tmp/radiation-copy-tests.log`).
- Değişen 19 dosya lint: 0 hata ve 0 uyarı (`/tmp/radiation-copy-lint.log`). Whitespace kontrolü temiz.
- Üretim/savunma kartları: altı dil, 350 ve 1280 px; 24 görsel kontrol geçti (`/tmp/astera-radiation-copy-production-20261016/checks.json`). Önceden bilinen Fransızca kara savunması başlık taşması bu değişiklik kapsamı dışında.
- Aegis/gemi koruması, araştırma metni, radyasyon kadranı ve fırlatma: altı dilde 350/1280 px, 12 ekran düzeni / 72 görüntü geçti (`/tmp/astera-radiation-copy-20261016/checks.json`). Bilgi butonları açıldı; taşma, çözülmemiş değişken veya çeviri anahtarı yok. Aegis bilgi kutusunda 50 HP/dk sınırının bulunmadığı ayrıca kontrol edildi. Türkçe Aegis bilgi kutusu ve kadran görüntüleri gözle incelendi.
- Master üzerinde yalnız metinler güncellendi; yeni test veya mekanik eklenmedi. Canlıya dağıtım yapılmadı.
