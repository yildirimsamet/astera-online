# Google Play kapalı test — 19 Ekim 2026

Owner'ın seçimi: ilk dağıtım doğrudan **kapalı test**. Daha önce paket yüklenmedi; ilk adayın applicationId'si `space.asteraonline.app`, versionCode'u `1`, versionName'i `1.0.0`. Bu dosya yükleme/inceleme/katılım kanıtı değildir. Güncel AAB'nin dosya yolu, SHA-256 ve kaynak commit'i final artifact kabulünden sonra eklenecek; 18 Ekim artifact'i yeni silme ve topluluk özelliklerini içermez.

## Süre ve erişim

13 Kasım 2023 sonrasında açılan kişisel hesaplarda en az **12 kişinin önceki 14 gün boyunca kesintisiz katılımı** gerekir. Süre AAB dosyasını hazırlamakla, yüklemekle, incelemeye göndermekle veya APK'yı kabloyla kurmakla başlamaz. Kapalı sürüm erişilebilir olmalı ve testçiler opt-in bağlantısıyla katılmalıdır. Üretim başvurusu anında da en az 12 kişi bu koşulu sağlamalıdır. Ayrılıp yeniden katılan kişinin sayılan süresi yeniden kesintisiz olmalıdır.

Üretime geçiş otomatik değildir. Console'dan production erişimi başvurusu yapılır; gerçek test kullanımı, geri bildirim ve bunlara göre yapılan düzeltmeler açıklanır. Var olmayan geri bildirim/katılım uydurulmaz. Yeni sürümler kapalı test sırasında aynı kanala güncellenebilir; her yüklenen yeni paket daha yüksek versionCode kullanır.

## Console uygulama sırası

1. Uygulama ayarları ve mağaza girişini tamamla: Astera Online adı, oyun/strateji kategorisi, gerçek destek bilgileri ve görseller.
2. App content alanlarını aynı adaya göre doğrula: çalışan reviewer erişimi, privacy/silme URL'leri, Data safety, ads, hedef kitle, IARC ve Console'un istediği diğer beyanlar. Yaş/hedef kitle cevapları mevcut oyun ve owner tercihine göre verilir; otomatik 3+ veya aile uygulaması seçilmez.
3. **Test and release → Testing → Closed testing** içinde bir kanal seç/oluştur. Testçi e-posta listesi veya Google Group'u owner yönetir; izinsiz e-posta/davet gönderilmez. Ülke erişimini ve testçi Google hesabı eşleşmesini kontrol et.
4. Play App Signing/upload sertifikasını doğrula. Güncel imzalı AAB'yi yükle; Console'un paket, API, sürüm ve imza kontrollerini gör. Kontroller görülmeden kabul edildi denmez.
5. Kısa EN/TR sürüm notlarını ekle. Uyarıları gider, kapalı test sürümünü incelemeye gönder/yayımla. Console'un gerçek durumunu ve katılım bağlantısını kaydet.
6. En az 12 testçinin opt-in ve Play'den kurulumunu doğrula. Herkesin yalnız APK alması sayılmaz. Hesap girişini, gerçek galaksiyi, ağ kesintisi/dönüşünü, Android Back ve sosyal güvenlik yollarını test et.
7. Pre-launch report ve gerçek geri bildirimleri düzenli izle. Özel testçi adreslerini repoya koymadan tarih, cihaz/Android/WebView, senaryo, bulgu ve düzeltme commit'ini kaydet.
8. Console koşulu sağlandıktan sonra production erişimine başvur. Başvuru onayı ve gerçek production sürüm yayını ayrı adımlardır.

Bu ortamda Play Console'a bağlı browser/Google Play API bağlantısı bulunamadı. Owner Chrome profilini ele geçirmek veya yeniden başlatmak yok. Dosyanın hazır olması Console'a yüklendiği anlamına gelmez; gerçek yükleme erişimi ayrıca sağlanmalıdır.

## EN/TR ilk sürüm notu taslağı

EN:
- First closed test of Astera Online.
- Develop your capital, gather intelligence, dispatch fleets and join clans in a shared persistent galaxy.
- Includes account deletion requests, community rules acceptance, reporting and social blocking.

TR:
- Astera Online'ın ilk kapalı testi.
- Ortak ve kalıcı galakside başkentini geliştir, istihbarat topla, filolar gönder ve klanlara katıl.
- Hesap silme talebi, topluluk kuralları onayı, şikâyet ve sosyal engelleme yollarını içerir.

Bu notlar yalnız son pakette gerçekten bulunan ve canlı backend'de çalışan özellikler için kullanılacak. Native rewarded ads, satın alma ve push bildirim bu sürümde yok; mağazada varmış gibi tanıtılmaz.

## Mağaza görselleri

19 Ekim resmî kurallar: ikon 512×512, alpha içeren 32-bit PNG, en fazla 1024KB; feature graphic 1024×500 JPEG veya alpha içermeyen 24-bit PNG; en az iki gerçek ekran görüntüsü, JPEG/24-bit PNG, boyutlar 320–3840 ve uzun kenar kısa kenarın en fazla iki katı. Uzun telefon ekran görüntüsü bu oranı aşıyorsa uygun gerçek görünüm alınmalı; oyun ekranı yerine promotional artwork kullanılmaz. Kısa açıklama en fazla 80 karakter. Console'daki gerçek gereksinimler ayrıca görülür; önerilen tanıtım boyutları zorunlu koşullarla karıştırılmaz.

## Resmî kaynaklar

- [Kişisel hesap test şartları](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en), 19 Ekim tekrar okundu.
- [Kapalı test kurulumu](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en).
- [Görseller ve açıklama kuralları](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en).
- [Hedef API şartı](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en): 31 Ağustos 2026 itibarıyla standart yeni Android app/update API36+; aday target36.
