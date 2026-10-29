# Onaylanan kararlar

Bu dizin, henüz uygulanmamış kararları da içerir. Her kaydın durumunu kontrol et;
bir tasarım kararını canlı oyunda zaten uygulanıyor kabul etme.

- **2026-10-29 — Bot savaşları Honor sayar; bot sırasını tutar (BOT = İNSAN).**
  Owner: *"Bot savaşlarında da honor sayılmalı, insanlar botların bot oldugunu
  anlamamalı."* Canlı sezonda insan→bot baskını raporda "Honor yarışının dışında"
  yazıyordu; bu ifşaydı. Artık en az bir insanın olduğu savaş normal Honor üretir.
  Yalnız botlardan oluşan savaş Honor üretmez; o raporu hiçbir insan görmez, botlar
  da birbirini kasıp sıralamayı şişiremez. Admin ve aynı hesap hâlâ Honor dışı.
  Puanı olan bot, Honor kürsüsünde ve galaksi zirve kademesinde herkes gibi sayılır.
  Ödül: bot, Honor'da da Hakimiyet'teki gibi sırasını tutar. Bot 1. ise 1.lik ödül
  dağıtılmaz, insanlar görünen sıralarının ödülünü alır. Bu kayıt, 2026-10-28
  KİLİTLİ kaydındaki "kürsü, Honor kaynağı" dışlamasının yerini alır. Kural canlıya
  çıkmadan sonuçlanan bot savaşları geriye dönük puanlanmaz. Eski kodla yola çıkıp
  henüz sonuçlanmamış uçuşlar için, deploy'dan sonra her canlı sezonda bir kez
  `season honor-refresh --season UUID --yes` çalıştırılır. DM'de de bot herkes gibi
  aranır ve mesaj alır (owner: "DM alıcı listesi botları çıkartmasın").

- **2026-10-29 — Shopier: oyuncuya özel geçici ürün (notta kod yöntemi kaldırıldı).**
  Owner: alıcı adını veya kodu yazmasa da kim olduğu anlaşılmalı; görünümler yalnız oyun
  içinden alınır. "Shopier ile öde" basışı o komutan + görünüm için gizli, dijital, stoğu 1
  bir Shopier ürünü açar; ödenen siparişin `productId`'si hesabı söyler. Ödenmeyen ürün 48 saat
  açık kalır, her basışta süre baştan başlar. Çakışan açık ürünler (paket ↔ içindeki görünümler)
  kapanır; yine de çift ödeme olursa sipariş kuyruğa düşer, iadeyi sahip elle yapar. KDV boş
  (sahip henüz mükellef değil). Dükkândaki 9 görünüm ürünü silinir (gizlenmez), 4 destek kartı
  kalır. Canlı deneme sonuçları ve plan: `docs/shopier-gecici-urun-plani-2026-10-29.md`.
  Durum: kod 29 Ekim'de yayına çıktı, bayrak kapalı; satışın açılışı (ürün silme, sepet, webhook) ayrı adım.

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

- **2026-10-23 — Öncelikli hedefler, çift yüzdeler ve üretim entegrasyonu:**
  Kullanıcı önce 1:2'de %15–25 ve 1:3'te %20–30 gerçek kaçış hedefini seçti;
  doğrulamadan sonra kaçış yüzdelerinin çift tam sayıya yuvarlanmasını istedi.
  [Son tablo ve kanıt](combat-six-rounds-priority-2026-10-23.md): güçsüz için
  şans/can penceresi %10/30, %20/46, %28/66, %40/80; güçlü için %10/30,
  %10/30, %10/30, %6/26. Güç basamakları 1/1,5/2/3; altı tur, son tur hariç
  1–5. tur sonlarında kaçış. Gemi istatistikleri, %25 temel kalkan ve araştırma
  aynı. Kullanıcı artık asıl kod entegrasyonunu istedi; önce etki planı ve TDD.
  Simülasyon sonuçlarının üretime uygulanması/deploy henüz tamamlanmış değildir.
