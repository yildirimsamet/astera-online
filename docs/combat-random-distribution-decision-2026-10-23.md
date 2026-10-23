# Savaş hasarının rastgele dağıtılması — 23 Ekim 2026

**Durum:** Kullanıcı tarafından onaylanan davranış; uygulama öncesi simülasyon tamamlandı.
Bu kayıt, özelliğin canlı koda uygulandığı veya deploy edildiği anlamına gelmez.
Yeni bir kullanıcı kararı olmadan aşağıdaki davranış değiştirilmemelidir.

## Onaylanan davranış

1. Her silahlı gemi, her tur kendi atışını yapar. Atışın hasarı o anda
   hayatta olan **bütün uygun düşman hedefleri arasında rastgele paylaştırılır**.
   Tek bir rastgele hedef seçmek bu kararı karşılamaz.
2. Örneğin bir Korsan'ın 408 hasarı, karşıdaki 10 Ok arasında rastgele
   paylaştırılır. Örnek paylar: `20, 55, 38, 70, 15, 45, 60, 30, 50, 25`.
   Payların toplamı 408'dir; bu sayılar sabit bir dağılım değildir.
3. Her geminin atışı ayrı dağıtılır. Karşıda tek uygun hedef varsa bütün
   hasar o hedefe gider. Bir sonraki atış güncel canlı hedefleri kullanır.
4. Silahlı birlikler hayattayken yük gemilerine hasar payı ayrılmaz.
   **Hurdacı (`GARBAGE_COLLECTOR`) da yük gemisi gibi korunur ve en son hasar alır.**
   Hurdacı, kargo kapasitesi olmadığı gerekçesiyle ön hatta alınamaz.
5. Bir hedefi öldürmek için gerekenden fazla hasar ayrılmışsa artan hasar
   kalan uygun hedeflere yeniden dağıtılır; öldürülen hedefte boşa gitmez.
6. Son silahlı hedef de ölürse, aynı atıştan kalan hasar yük gemilerine ve
   Hurdacılara dağıtılabilir. Aynı turdaki sonraki atışlar da onlara gider.
   Yeni tur beklenmez. Yük gemisi ile Hurdacı arasında ayrıca bir öncelik onaylanmamıştır.
7. İki taraf da tur başında sahip olduğu ateş hakkını kullanır. O tur öldürülen
   bir gemi de o turun atışını yapar; hesaplama sırası ilk ateş edene avantaj vermez.
   Önceki turda ölen veya kaçan gemiler yeniden ateş edemez.
8. İki tarafın atışları bittikten sonra turun sonuçları ve kaçışlar hesaplanır.
   Canı sıfırlanan gemi ölüdür; kalkanı olsa da kaçamaz veya hayatta kalamaz.
9. Savaş üç turdur. Kaçış yalnız **birinci ve ikinci turun sonunda**, yaşayan
   gemiler için, önceden onaylanan güç oranı/can eşiği/olasılık ayarlarıyla çalışır.
   Üçüncü tur sonunda ayrıca kaçış yapılmaz.
10. Hasar önce gemi kalkanından, sonra gövde canından düşer. Can ve kalkan
    savaş içinde turlar arasında yenilenmez. Radyasyon doğrudan cana vurur.
11. Kaçanlar sonraki turlarda ateş etmez ve hedef olmaz. Sonuç değerlendirmesinde
    aktif filodan çıkarılır; fiziksel ölüm, enkaz ve gerçek gemi kaybı sayılmaz.
12. Davranış her iki tarafa simetrik uygulanır; gezegen ve anıt savaşlarının tekli,
    ortak klan filosu ve destekli kombinasyonları arasında farklılaştırılmaz.

## Doğrulanması gereken sözleşmeler

- Rastgele dağılım gerçekten bütün uygun hedefleri kapsamalı; tek hedef atışı olmamalı.
- Hasar bütçesi korunmalı; yeniden dağıtım hasar üretememeli veya kaybettirmemeli.
  Hayatta hedef kalmadığında kullanılabilecek hasar kalmaması istisnadır.
- Aynı atışta silahlı hedeften kargoya/Hurdacıya geçiş doğrulanmalı.
- Kalkan tüketimi, hedefe bağlı sınıf çarpanları ve gezegen kalkanı mükerrer
  uygulanmamalı; simülasyon bunları nasıl hesapladığını açıkça kaydetmeli.
- Tur içi ölüler sonraki atışlarda hedef olmamalı; karşı tarafın o tura ait
  ateş hakkını kaybetmemeli. Kaçış hasar hesaplarının ortasında çalışmamalı.
- Kaçanlar dahil gerçek sağ kalan sayısı ile aktif filonun bitmesi ayrı ölçülmeli.
- Az/çok gemi, karışık sınıflar, yalnız kargo/Hurdacı, kalkanlı/hasarlı giriş,
  iki tarafın aynı tur ölmesi ve eşit güç durumları doğrulanmalı.

## Simülasyon talebi

Bu kararın ardından kullanıcı, tur başına kaçışları ve farklı güç oranlarında
filoların tamamen sıfırlanmasını yeniden simüle etmeyi istedi.
Yerel sınır: tek iş parçacığı, toplam en fazla 2 GB RAM.

[Simülasyon sonuçları](distributed-damage-study-2026-10-23.md) kaydedildi.
Sonuçlarda sorunlu kompozisyonlar bulunması, bu sözleşmeyi veya kaçış ayarlarını
kendiliğinden değiştirme izni değildir; yeni karar kullanıcıyla alınmalıdır.
