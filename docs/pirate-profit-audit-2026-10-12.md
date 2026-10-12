# Korsan kârlılığı ve kaynak arzı — 12 Ekim 2026

## İstek ve kapsam

Kullanıcı korsanların net kârını ve sunucuya eklediği kaynakları simüle etmemizi istedi.
İlk ölçüm, dengeye dokunmadan mevcut savaş, ganimet, yakıt, tamir, enkaz ve gemi ele geçirme
kurallarını inceledi. Kullanıcının sonraki isteğiyle uygulanan denge ve geçiş notu
`docs/pve-rebalance-2026-10-12.md` dosyasında; bu dosyanın başlangıç kanıtı tarihsel kalır.

## Ölçüm şartları

- Normal spawn dağılımı ile yük gemisiz koşullu örneklem ayrı tutulacak.
- Seviye 4 ana karşılaştırma; sunucu arzında tüm seviyeler kendi doğma ağırlıklarıyla sayılacak.
- Ufak, net kârı yüksek, kayıpsızlığa yakın ve fazla güçlü filolar aynı korsan örneklerine karşı ölçülecek.
- Filo seçimi ve doğrulama farklı savaş tohumlarını kullanacak; oyuncunun sonucu önceden bilmesi varsayılmayacak.
- Ganimet kapasitesi hayatta kalan gemilerden hesaplanacak. Kesin zafer %60, kısmi zafer %30.
- Dönen gemilerin bedeli her saldırıda tekrar gider sayılmayacak. Kaybedilen gemi, yakıt ve ücretli tamir düşülecek.
- Ele geçirilen gemi, olasılığa bağlı varlık geliri olarak kaynak gelirinden ayrı gösterilecek.
- Yalnızca hayatta kalan hurdacının gerçekten kaldırdığı enkaz doğrudan kazanç sayılacak.
- Kaynaklar ayrı sütunlarda ve ekonomik karşılaştırma için A + 2C + 32D ile raporlanacak.
- Arz, galaksiye ortak doğma hızıdır; oyuncu başına özel ödül değildir. Saatlik uygun aktif nüfus, botların yarısı,
  saatlik taban ve gerçekleşen avlanma payı ayrı belirtilecek.

## Kapsam sınırları

Yeni sezonların mevcut ruleset 16 HP savaş modeli; sağlıklı başlangıç gemileri; bilinen korsan manifestosu;
üretim kapılarını açan seviye 2 araştırmalar ve Tersane 6. Yolda radyasyon olmayan güzergâh.
Uçuş mesafesi ve avlanma payı duyarlılık hesabı yapılacak. Gerçek sunucu telemetrisi, oyuncu gelişimi,
PvP kayıpları, keşfedilmeden süre dolması ve başkasının hedefi önce öldürmesi bu deneyde modellenmiyor.
Bu nedenle günlük arz sonuçları belirtilen avlanma ve saatlik aktif nüfus varsayımlarına bağlı senaryolardır.

## Başlangıç ölçümünün TDD ve inceleme notu

Önce muhasebe ve deterministik savaş regresyonları yazıldı; uygulama modülü eklenmeden testler
modül yükleme hatasıyla kırmızı çalıştırıldı. Bu ilk ölçümde yalnız araç/test/rapor dosyaları değişti.
Sonraki denge uygulaması ve kullanıcının istediği canlı yayın ayrı görev kaydında izleniyor.

Kenar durumlar: sıfır saldırgan sağkalımı, gemiler kaybolduktan sonra sağ kalan yük gemileri,
kargo yetersizliği, ücretsiz %20 onarım sınırı ve kesirli hasar, hurdacı sınırı, botların tek sayı yuvarlaması,
sıfır aktif nüfusta saatlik taban, mevcut kısmi zaferlerden sonra azalmayan ganimet stoğu.

## Sonuçlar

Başlangıç çalışması 256 normal korsan/level ve 256 yük gemisiz seviye 4 kullandı.
Filo seçimi 8 ayrı tohumda, doğrulama 32 farklı tohumda yapıldı: **204.800 doğrulama savaşı**.

| Seviye 4 filo | Net alaşım | Net kristal | Net döteryum | Net A+C |
| --- | ---: | ---: | ---: | ---: |
| Normal, kâr için seçilmiş | 8.546 | 4.918 | −43,6 | 13.464 |
| Aynı filo + 1 hurdacı | 12.035 | 6.291 | −66,6 | 18.326 |
| Yük gemisiz koşullu korsan | 7.330 | 4.300 | −51,4 | 11.630 |

Normal satırın D hesabı: ganimet 35,6 − yakıt 72,5 − kayıp gemi 0,4 − ücretli onarım 6,3 = −43,6.
Hurdacı satırında ayrıca 17,0 D enkaz geliri ve daha yüksek, 112,5 D yakıt gideri vardır.
Ele geçirilen gemi bu net rakamlarda yoktur. Ham kanıt: `docs/evidence/pirate-profit-audit-2026-10-12.json`.
Bu tarihsel raporun süre alanları çatışmayı yanlışlıkla 5 saniye sayıyordu;
gerçek 10 saniyeye göre gidiş-dönüş süreleri 5 saniye eksiktir. Kaynak sonuçları etkilenmez.
Yeni kalibrasyon `ENGAGEMENT_MS` kuralını kullanır.

Üç gerçek kısmi/bitirme savaşı, aynı beş Paladin'in azalmayan ganimetinden 52.852 A + 28.828 C + 204 D
ödeyebiliyordu: başlangıç hoard'ının yaklaşık %120'si. Yeni ödül defteri aynı hedefin bütün
saldırılarındaki toplam ödemesini ilk kesin zafer bütçesiyle sınırlar; geçmiş kazanç geri alınmaz.

Yeni denge kanıtı: `docs/evidence/pirate-balanced-calibration-2026-10-12.json`.
Yeni normal seviye 4 neti **861 A + 614 C + 114 D**; yani A+C toplamı **1.475**.
128 korsan/level, aynı seviyede yasal filo, farklı seçim/doğrulama tohumları ve 81.920 doğrulama savaşı.
Menzil 1.000, ilk hal sağlıklı ve radyasyonsuz. Uzak rota, kötü filo ve başkasının daha önce vurması
bu kârı değiştirebilir. Bu sonuç gerçek sunucu telemetrisi veya her saldırı için kazanç garantisi değildir.
