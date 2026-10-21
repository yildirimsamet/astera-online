# Anıt kargo çekilmesi ve savaş boyunca tek kalkan — 21 Ekim 2026

Owner talimatı: savunanda yalnız yük/destek gemileri kalmışsa, saldıranda
savaşabilecek bir savaş gemisi sağ kaldığında savunanın gemileri anıtı terk eder,
saldıran yerleşir. İki tarafta da yalnız yük gemileri kalırsa mevcut savunan HOLD
kalır, saldıran eve döner. Savaş gemisi bulunan savunma bu yolla çekilemez.

Ek owner talimatı: kişisel gemi kalkanı bütün savaş türlerinde yalnız savaş
başında tam dolu; savaş turları arasında yenilenmez. Yeni savaş bağımsız tam
kalkanla başlar. Gövde yaraları kalıcıdır. Radyasyon kalkanı atlayarak canı
azaltır; canı biten gemi ölür. Araştırma kapasitesi/fiyatı aynı kalır.

## Etkilenen yollar ve korunan ayrımlar

- Ortak motor: solo/ortak saldırı, destekli savunma, gezegen, anıt, nötr/korsan,
  eğitim ve tahmin. Azami kapasite ve ön geminin kalan kalkanı ayrı tutulur.
  Sağlıklı ortak kohortta tek kalkan artığı, yaralı girişte ayrı ön gemi artığı
  taşınır. Dalga bölmek ek kalkan sağlamamalı; yalnız kalkan hasarı gövde yarası,
  tamir bedeli veya gövde katkı puanı olmamalı.
- Anıt: savaş motorunun gerçek sağ kalanları/kayıpları değiştirilmez. Çekilen
  yük gemileri imha veya ganimet sayılmaz. Gemiler yaraları, yükleri ve yakıt
  rezervleriyle normal fiziksel dönüş yoluna girer. Gerçek öldürülen gemilerin
  ganimeti ve Dominion hesabı mevcut yöntemle sürer.
- Her savunan sahibin sağ kalan dalgası ayrı güvenli evine döner. Kargo önce
  HOLD'dan çıkarılır, sonra kazanan için kapasite seçimi yapılır. Olay tekrarında
  ikinci savaş, ikinci dönüş veya çoğalan gemi/yük olmamalı. Transaction hatasında
  savaş, dönüş, puan ve kontrol birlikte geri alınmalı.
- Kontrol ile imha derecesi ayrı kalır. Kargo çekilerek kontrol değiştiğinde
  rapor/bildirim “saldırı püskürtüldü” yerine yük gemilerinin geri çekildiğini
  söyler. Bu bilgi mevcut immutable savaşın kontrol/sağ kalanlarından türetilir;
  rakibin filo adedi veya güncel konumu açılmaz. Eski API kayıtları uyumludur.
- Altı dilde araştırma, gemi bilgisi ve anıt kuralı; TR/EN Wiki ve ana tasarım
  belgeleri güncellenir. Gezegen Aegis'i ve radyasyon azaltma araştırması ayrı kalır.

## Doğrulama

Yeni kural testleri önce başarısız görüldü: tur yenilenmesi ve anıt kontrolünde
4, fiziksel kargo dönüşünde 2, istemci bayrak/rapor testinde 1 başarısızlık.
Üretim motoruyla bağımsız sağlıklı prototip karşılaştırması 1.632 girdi ×
5 kalkan seviyesi × 3 tohum = 24.480 savaşta sağ kalan/tur eşleşmesi sağlar.
Ardışık darbeler için 500 özellik denemesi gövde/kalkan hesabını birlikte sınar.
Diğer koşullar: yaralı giriş, bölünmüş dalga, farklı sahip teknolojisi,
Aegis/Nullifier, radyasyonda ölüm, yeni savaşta dolu kalkan, kargo korunumu,
iki taraf kargo, çok sahipli geri çekilme, fiziksel eve varış ve olay tekrarı.

### Son inceleme ve doğrulanan düzeltmeler

- Yaralı aynı-can gruplarında yalnız kalkanı vurulmuş gemi yeni tura dolu
  kalkanlı diğer gemilerle aynı sırada girebiliyordu. Kalan kalkan ayrı taşınır,
  aynı candaki gemilerde harcanmış kalkan önce hedeflenir. Sabit örnek ve bağımsız
  gemi bazlı modelle 300 karışık yaralı/sağlıklı senaryo bunu denetler.
- Kontrol kargo çekilmesiyle değişse bile imha derecesi `REPELLED` kalabilir.
  Derece/puan hesabını değiştirmeden rapor ve bildirimde gerçek kargo çekilmesi
  gösterilir. Her iki tarafın görünümü test ve mobil ekran görüntüsüyle doğrulandı.
- Eski sürekli kalkan dolumuna göre hazırlanmış yedi kural, dört sunucu ve bir
  Wiki beklentisi yeni kurala uymuyordu. Sayısal örnekler yeniden hesaplandı;
  hasar testlerinin yaralı/sağlıklı farkını ölçmesi korunarak girdiler düzeltildi.
- Son CR ek bir oyun mantığı hatası doğrulamadı. Test kapsamındaki eksikler
  giderildi: kargo çekilmesinden sonra transaction rollback ve yeniden deneme,
  gerçek PostgreSQL'de eşzamanlı aynı varış, karışık yaralıların bağımsız referansı.
  Rollback savaş, katılımcılar, fiziksel lotlar, dalgalar, dönüş olayları,
  bildirimler ve kontrolün birlikte eski duruma dönmesini sınar.

### Kontrol sonuçları

- Kural paketinin 143 dosyalık ilk tam çalışmasında 2.748 test geçti; eski
  beklentili yedi test yukarıdaki güncellemelerden sonra ilgili 82 testlik
  çalışmada geçti. Ek sınır durumlarıyla anıt/kalkan dosyaları da tekrar geçti:
  anıt 16/16, son kalkan çalışması 18/18. Tarihsel kalkansız digest paritesi geçti.
- Bağlı sunucu akışlarının dokuz dosyasında 118 test ilk çalışmada geçti;
  eski hasar örnekleri düzeltildikten sonra iki ilgili dosya 9/9 geçti.
  Son anıt varış dosyası 29/29 geçti; kargo/yakıt, çok sahipli savunma, replay,
  yarış ve rollback bu dosyada kapsanır.
- Web temel kontrolleri 209/209 geçti. İlgili 63 dosyalık çalışmada 925 test
  geçti; eski Wiki kuralı düzeltildikten sonra Wiki dosyası 13/13 geçti.
- Bağımsız deney aracı 12/12 geçti; sağlıklı filolarda 24.480 üretim-parite
  karşılaştırması dahil. Uzun ekonomi/sezon/snowball simülasyonu çalıştırılmadı.
- Bütün workspace tip kontrolleri ve üç sıralı lint grubu geçti.
- Görsel kontrol: TR/EN × 350/1280 genişlik; seviye 0/3/4 gemi bilgisi,
  araştırma, savaş raporu, anıt saldıran/savunan görünümü. Taşma veya tarayıcı
  hatası yok; mobil görüntüler ayrıca gözle incelendi. Kanıt:
  `out/ship-shields-no-regen-2026-10-21/checks.json`.

Tam paketler, ilk geçişte başarısız olup düzeltilen dosyaların hedefli tekrarları
ve son ek testler birlikte değerlendirilmiştir; tüm paketlerin son sürümde tek
komutla baştan çalıştırıldığı iddia edilmez. Yayın/deploy yapılmadı.
