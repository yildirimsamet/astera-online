# Klan giriş ücreti ve avantajların görünürlüğü

Ek işler (owner, aynı oturum):
- [x] Galaksideki üç gezegen ölçeğinin her biri mevcut değerine göre %20 küçülecek.
- [x] Tamirhane kartına Tersane/Hangar kartındaki kenarlık uygulanacak.

İstek: kuruluş bedeli 2.000 alaşım + 1.000 kristal olacak. Klan sayfası savunma
desteği, ortak saldırı, birlikte anıt tutma ve mevcut diğer avantajları açıklayacak;
klansız oyuncu klan bulmaya veya kurmaya doğrudan yönlendirilecek.

Kapsam: ortak `CLAN.creationCost`, kural/ödeme testleri, `ClanScreen`, altı dilde
ilgili metinler ve kuruluş bedelinin denge dokümanındaki kaydı. Core 7 şartı,
üyelik/uyum süreleri ve savaş kuralları değişmiyor. Mevcut çalışma ağacındaki diğer
değişiklikler korunacak.

Kontrol senaryoları:
- Tam 2.000/1.000 ile kuruluş başarılı; kaynaklar bir kez düşer, döteryum değişmez.
- Alaşım veya kristal bir birim eksikse kuruluş reddedilir; ödeme/üyelik oluşmaz.
- API kuruluş görünümü aynı fiyatı ve doğru ödenebilirlik durumunu bildirir.
- Mevcut Core, üyelik kilidi, kimlik ve eşzamanlı kuruluş testleri korunur.
- Arayüz sunucudan gelen fiyatı gösterir; klan bul/kur bağlantıları ilgili girdiye gider.
- Avantajlar klansız görünümde ve üye özetinde bulunur. Destek otomatik yardım
  olarak sunulmaz; gemiler sahibiyle kalır, destekli gezegen geri çekilemez.
- Ortak saldırının lider tarafından başlatılması, anıttaki üretim/radyasyon riski,
  yardım ile geçici desteğin farkı ve üyelik beklemesi açıkça anlatılır.
- Türkçe/İngilizce 350 px ve masaüstü görsel kontrolü; diğer dillerde çeviri uyumu.

Risk: fiyat tüm etkin galaksilerde ortak kuraldan okunur. Sunucuda ayrı sabit veya
veritabanı fiyat alanı yok; göç gerekmiyor. Arayüzdeki yönlendirmeler yalnız gezinir,
klan kurmaz/başvuru göndermez. Yeni API veya sorgu eklenmez.

Uygulama ve kanıt:
- Yeni ücret testleri önce eski 7.500/3.000 ücretinde başarısız oldu; ortak kural
  değiştikten sonra 37 sunucu klan testi geçti (tam ödeme, iki eksik kaynak sınırı,
  mevcut eşzamanlı/idempotent kuruluş kontrolleri dahil).
- Son web kontrolü: klan arayüzü, altı dil tutarlılığı, arayüz tokenları ve galaksi
  boyutları birlikte 129/129 test geçti.
- Gezegen ölçeği testi önce eski değerlerde başarısız oldu; değişiklikten sonra
  klan/ölçek kural testleri 28/28 geçti. Boyut oranı ve yumuşak seviye artışı korundu.
- `node tools/visual.mjs out/clan-entry --clan-entry`: Türkçe/İngilizce, 350/1280 px,
  klansız/üye yüzeyleri, gerçek girdi odağı, taşma ve üç kartın hesaplanan kenarlığı
  doğrulandı. Gerçek PlanetField ile üç yarıçap ölçüldü ve ekran görüntüsü incelendi:
  0.3766902769 / 0.702 / 1.1985246. Kanıt: `out/clan-entry/`.
- Tip kontrolü tüm workspace'lerde geçti. Web kontrolünün varsayılan 2 GiB heap'i
  yetmediğinden izin verilen 4 GiB tavanıyla tekrar çalıştırıldı; sınır aşılmadı.
- `pnpm lint` üç ardışık grupta tüm dosyaları kapsayarak hatasız tamamlandı.
- Normal test paketlerinin tamamı tek workspace/işçiyle çalıştırıldı; uzun
  ekonomi/sezon simülasyonları çalıştırılmadı. Genel pakette bulunan ikinci eski
  kuruluş fiyatı beklentisi (`economy-profile.test.ts`) ve küçülme öncesi
  asteroid/gezegen büyüklüğü beklentisi güncellendi. Son ilgili kural kontrolü
  35/35 geçti; klan başlığının tanımsız `text-xl` sınıfı `text-title` ile düzeltildi.
- Genel paketin ilk çalıştırması tamamen yeşil değil: sunucuda vacation alan
  listeleri, eski Death Star kademe fixture'ları ve worker scheduling; webde
  Shopier, menü, Japonca, BuildSheet ve destek bildirimi beklentileri başarısız
  oldu. Bu alanlardaki bağımsız çalışma ağacı değişikliklerine müdahale edilmedi.
  Test süresince çalışma ağacında başka değişiklikler de olduğu için bu kayıt
  o çalıştırmanın sonucudur; daha sonraki tüm çalışma ağacı için yeşil kapı iddiası
  değildir. Son ilgili web kontrolünde i18n testi de hatasız geçti.
- Alt süreçlerin yanlış DB seçtiği asteroid/CLI testleri, açık test bağlantısıyla
  (`DATABASE_URL=postgres://astera:astera@localhost:5433/astera_test`) yeniden
  çalıştırıldı: 41/41 geçti. Üretim/geliştirme veritabanı değiştirilmedi.
