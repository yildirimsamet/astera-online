# Onaylanan kararlar

Bu dizin, henüz uygulanmamış kararları da içerir. Her kaydın durumunu kontrol et;
bir tasarım kararını canlı oyunda zaten uygulanıyor kabul etme.

- **2026-10-23 — Savaşta hasarın bütün uygun hedeflere rastgele dağıtılması:**
  [Onaylanan savaş sözleşmesi](combat-random-distribution-decision-2026-10-23.md).
  Hurdacı, yük gemileriyle aynı korunan hedef grubundadır.
  [Uygulama öncesi simülasyon sonuçları](distributed-damage-study-2026-10-23.md) kaydedildi;
  canlı oyun uygulaması/deploy yapılmadı.

- **2026-10-23 — Kaçış yüzdelerinde hafif kalibrasyon:** Kullanıcının deneme
  talebiyle [dokuz aday ve son doğrulama](distributed-retreat-tuning-2026-10-23.md)
  kaydedildi. `targeted` ölçülü bir öneridir; canlı ayar veya son kullanıcı
  onayı değildir. Hasar dağıtım sözleşmesi korunur.

- **2026-10-23 — Sağ kalma hedefinin düzeltilmesi:** Kullanıcı yakın güçte iki
  tarafın da ortalama %10–20 fiziksel sağ kalmasını, 1:2'de güçsüzün %10–20,
  1:3'te %20–30 kaçmasını istedi. [Yeni hedef ve mevcut sınırların kontrolü](combat-survival-targets-2026-10-23.md).
  Önceki `targeted` adayı bu hedef için onaylanmış veya yeterli bir ayar değildir.

- **2026-10-23 — Dört tur simülasyonu:** Kullanıcı dört turu denemeyi ve
  dört turda kaçışın **1., 2. ve 3. turun sonunda** olmasını seçti.
  [Dört tur karşılaştırması](combat-four-rounds-study-2026-10-23.md).
  Tek gemi için kesirli filo kurtarma hedefi uygulanmaz; ana denge ölçümü
  20/50/100/200 ölçeğindeki filolarla yapılır. Bu bir deploy kararı değildir.

- **2026-10-23 — Son yönlendirme: altı tur ve kaçış şansı kalibrasyonu.**
  Kullanıcı dört turdan sonra savaşın **altı tur** olmasını istedi; önce seçtiği
  “son tur hariç” kuralıyla kaçış pencereleri 1–5. tur sonlarıdır. Can/atak
  değiştirilmeden, güç farkıyla artan güçsüz can eşikleri ve kaçış şansları
  [altı tur çalışmasında](combat-six-rounds-calibration-2026-10-23.md) denenir.
  Bütün hedeflere rastgele dağıtım ve kargo/Hurdacı koruması sabittir.
  Bu dalda üretim kodu/deploy değiştirilmedi; simülasyon ve karar kaydıdır.
  42.400 altı-tur hesabında önerilen şans/can tablosu %10/30, %20/45,
  %20/60, %40/75 (güçsüz) olarak doğrulandı. Bu bir **adaydır**: varsayılan
  kalkanla 1:1 ortalaması ~%17, 1:2 kaçışı ~%13, 1:3 kaçışı ~%24;
  1:1,5 güçlü taraf kaybı ve kalkan 4/kompozisyon ayrışmaları hedefi tam karşılamaz.
