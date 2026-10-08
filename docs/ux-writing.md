# Astera Online UI/UX Yazım Standardı

Sürüm: **1.0** · Tarih: **7 Ekim 2026** · Durum: **Yeni ve güncellenen işlevsel metinlerde uygulanır.**

Amaç: Oyuncu, bir metni ilk okumada anlayabilmeli ve karar vermek için gereken bilgiyi bulabilmeli. Ne olduğunu, ne yapabileceğini ve eylemin hangi koşullarda ne sonuç vereceğini açıklıyoruz.

Bu, ASD-STE100 Issue 9'un açıklık ve tutarlılık ilkelerinden yararlanan kendi ürün standardımızdır. STE100 sertifikası veya tam uyum iddiası değildir. İngilizce, Türkçe ve diğer desteklenen dillerde aynı bilgi ve karar desteğini hedefler.

## 1. Kapsam ve öncelik

**Kapsam:** UI etiketleri, butonlar, menüler, durumlar, sayılar, açıklamalar, araç ipuçları, hata mesajları, onaylar, bildirimler, onboarding, Academy, mekanik anlatımları, Wiki, Wiki başlıkları ve sayfa açıklamaları.

**Kapsam dışında:** Lore, kurgu, karakter konuşmaları ve anlatı metinleri. Bunların içindeki maliyet, talimat veya oyun kuralı yine bu standarda uyar. Lore, işlevsel bir açıklamanın yerine geçmez.

Öncelik sırası:

1. Oyunun uygulanan davranışı ve oyuncuya açıklanabilecek bilgi.
2. Oyuncunun karar verebilmesi için gereken açıklık ve kapsam.
3. Terminoloji ve diller arasındaki anlam tutarlılığı.
4. Kısalık, ritim ve görsel yerleşim.

**Bu dosya, yazımın normatif kaynağıdır; oyun mekaniklerinin kanıtı değildir.** Oyun bilgisi için mevcut çalışan kodu ve ilgili testleri incele. Eski dokümanlara, kod yorumlarına veya mevcut çeviri cümlelerine doğrulanmış mekanik gibi güvenme. Kod ve test çelişiyorsa nedeni çöz; tahmin ederek metin yazma.

## 2. Her açıklamanın cevaplaması gereken sorular

Metnin görevi için anlamlı olan soruları cevapla:

- Bu nedir, ne işe yarar?
- Kim veya ne etkilenir: bu gezegen, ana gezegen, bütün gezegenler, seçili filo?
- Ne yapabilirim; bunu nereden yaparım?
- Hangi kaynak, seviye, kapasite veya başka koşul gerekir?
- Ne değişir, ne kadar değişir; ne zaman başlar veya biter?
- Hangi sınır, istisna veya risk bu kararı değiştirir?
- Bilgi kesin mi, tahmin mi; ne zaman ölçülmüş?
- İşlem yapılamıyorsa neden; mümkün olan sonraki adım ne?

Her butona bütün açıklamayı yerleştirme. Oyuncunun o anda kararını değiştiren bilgiyi aynı yüzeyde göster; ayrıntılı kuralı detay sheet'ine, tam açıklamayı Wiki'ye taşı. Maliyet, geri alınamama veya önemli kayıp yalnız Wiki'de bulunamaz.

## 3. Zorunlu yazım kuralları

1. **Bir cümle, bir ana fikir.** Farklı koşulları, etkileri ve istisnaları ayrı cümlelere veya maddelere böl.
2. **Eylemi doğrudan söyle.** Talimatta “Filoyu gönder” kullan; “Filo gönderimi gerçekleştirilmelidir” kullanma.
3. **Önce gerekli koşul, sonra eylem.** Oyuncunun işlemden önce bilmesi gereken ön koşulu işlemden sonra açıklama.
4. **Özne ve kapsam belli olsun.** “Üretimi artırır” tek başına yetmeyebilir; hangi kaynağın, hangi gezegendeki üretimi olduğunu belirt.
5. **Aynı kavram, aynı ad.** Ekran, bildirim, rapor ve Wiki aynı oyuncu terimini kullanır. Farklı kavramlara aynı adı verme.
6. **Genel sıfat yerine gerçek etki.** “Daha güçlü”, “daha verimli” ve “gelişmiş” bir açıklamanın tamamı olamaz. Hangi ölçünün değiştiğini söyle.
7. **Koşulu kaybetme.** “Her zaman”, “kesin”, “anında”, “ücretsiz” ve “güvenli” yalnız davranış bunları gerçekten destekliyorsa kullanılabilir.
8. **Bilmediğini biliniyormuş gibi yazma.** “Bilinmiyor”, “ölçülmedi”, “tahmini” ve “güncel değil” farklı durumlardır. Boş veriyi sıfır, eski ölçümü canlı bilgi olarak sunma.
9. **Sonucu doğrulandığı durumda bildir.** İstek gönderilmesi, işlemin başlaması ve işlemin tamamlanması farklı durumlardır. “Tamamlandı” bunların ortak etiketi değildir.
10. **Yapılabilecek bir sonraki adım ver.** Hata, engel ve boş durumda eylem öneriyorsan ürün gerçekten bu eylemi desteklemeli. Çözüm bilinmiyorsa neden uydurma.
11. **Oyuncunun dilini kullan.** API adı, hata kodu, karar numarası, sürüm adı, veritabanı terimi ve geliştirici kısaltması işlevsel oyuncu metnine taşınmaz.
12. **Açıklık için gereken bilgiyi kısaltma uğruna silme.** Metin sığmıyorsa yerleşimi veya bilgi katmanını düzelt. Önemli koşulu kesme veya erişilemeyen hover metnine taşıma.

## 4. Ses, dil ve uzunluk

- Sakin, açık ve saygılı yaz. Hata veya kayıpta oyuncuyu suçlama; mizah, abartı ve slogan kullanma.
- Türkçede “sen” dili ve doğrudan fiil kullan; özne zaten belliyse her cümleye “sen” ekleme. İngilizcede doğal “you” dili kullan.
- Etken anlatımı tercih et. “İptal ediliyor” gibi doğal durum metinlerini veya öznesi bilinmeyen açıklamaları zorla emir cümlesine çevirme.
- Uzun isim zincirlerini, iç içe koşulları ve çift olumsuzlukları böl. “Bunun”, “orada”, “diğeri” yalnız gönderdiği şey açıkça belliyse kullanılabilir.
- Türkçe işlevsel metinde “public”, “item”, “claim” gibi gereksiz İngilizce kelimeler kullanma. Oyundaki gerçek özel adları koru; teknik terimi ilk gerekli yerde açıkla.
- Butonlarda ve başlıklarda cümle düzeninde büyük harf kullan; özel adların yazımını koru. Tam cümleye nokta koy; kısa etikete gerekmedikçe nokta koyma.

**Uzunluk hedefleri, anlamı silme yetkisi değildir:**

| Metin | Hedef |
| --- | --- |
| Buton | Genellikle 1–4 kelime; eylem ve gerekirse nesne |
| Başlık | Tek konu veya görev; genellikle 2–6 kelime |
| Kısa yardımcı metin | Genellikle 1–2 cümle; karar için gerekli etki veya koşul |
| İngilizce talimat cümlesi | En fazla 20 kelime hedefi |
| İngilizce açıklama cümlesi | En fazla 25 kelime hedefi |
| Türkçe cümle | Genellikle 20 kelimeyi aşmadan bir ana fikri anlatma hedefi |
| Açıklayıcı paragraf | Tek konu; genellikle 2–4, en fazla 6 cümle |

20/25 kelime sınırları STE100'den alınan İngilizce hedeflerdir. Türkçe için seçilen hedef ürün tercihimizdir; İngilizce sözlüğünü veya dilbilgisini Türkçeye uygulamayız. Japonca gibi dillerde kelime sayısı yerine doğal cümle yapısını ve gerçek ekran yerleşimini incele.

Bir uzunluk hedefini aşmak gerekiyorsa önce bölmeyi dene. Hâlâ gerekiyorsa anlamı koru ve incelemede nedenini belirt. Bu, zorunlu doğruluk veya bilgi açıklama kurallarını esnetmez.

## 5. Terminoloji

Adlandırmada mevcut oyuncu sözlüğünü başlangıç noktası olarak kullan: `apps/web/src/i18n/locales/*/data.ts` ve ilgili özellik locale dosyaları. Mekaniği ayrıca koddan doğrula. Yeni ad icat etmeden aynı kavramın mevcut adını ara.

Aşağıdaki eşleştirmeler mevcut adlandırmadan alınmıştır; yeni bir mekanik tanımlamaz:

| Kavram | Türkçe | İngilizce | Kaynak |
| --- | --- | --- | --- |
| Ana komuta binası | Komuta Çekirdeği | Command Core | `data.ts` → `building.CORE.name` |
| Kaynak deposu / depo binası | Depo | Store | `data.ts` → `building.VAULT.name` |
| Yeni gemi üretim binası | Tersane | Shipyard | `data.ts` → `building.SHIPYARD.name` |
| Filo alanını sağlayan bina | Hangar | Hangar | `data.ts` → `building.HANGAR.name` |
| Ham kaynak | Alaşım | Alloy | İlgili kaynak etiketleri |
| Ham kaynak / yakıtın kaynağı | Döteryum | Deuterium | İlgili kaynak etiketleri |

Bir terimi değiştirirken etkilenmiş UI, erişilebilir ad, rapor, yardım, çeviri ve Wiki kullanımlarını birlikte incele. Benzer görünen fakat farklı işlevleri olan kavramları tek kelimede birleştirme: örneğin üretilmiş kaynakların beklediği havuz ile harcanabilir kaynakların bulunduğu depo aynı şey değildir.

Oyun içi ID'ler ve Wiki'nin kalıcı URL'leri oyuncu adından ayrıdır. Yalnız görünen adı değiştirmek için ID veya URL değiştirme. Bu tabloyu yeni bir paralel içerik kaynağına dönüştürme; isimler locale kaynaklarında kalır.

## 6. Sayılar, zaman ve belirsizlik

**Sayı:** Değerin adını, birimini ve gerekiyorsa kapsamını göster. “120” yerine bağlama göre “Saatlik alaşım: 120” yaz. Bir sayıyı anlamak için oyuncunun kodu bilmesi gerekmemeli.

**Oran:** Yüzdesel artış ile yüzde puan farkını ayır. Aynı taban için “%20 artırır” ile “1,2 katına çıkarır” eşdeğerdir; “20 yüzde puan ekler” farklıdır. Oranın hangi tabana uygulandığını belirt. “×2 katı” gibi aynı oranı iki kez söyleme.

**Sınır:** “En az”, “en fazla”, “daha az”, “daha fazla” ifadeleri gerçek karşılaştırmayla eşleşmeli. Eşitlik durumunu ve yuvarlamayı karar değiştiriyorsa açıkla. Kapasiteyi kullanılmış/toplam olarak adlandır; hangi kapasite olduğu belirsiz bir kesir verme.

**Karşılaştırma:** İki değeri aynı birim, kapsam, zaman ve bonus koşullarında karşılaştır. Temel değeri bonus uygulanmış değerle açıklamasız karşılaştırma. Wiki tablosunda temel değer mi, oyuncuya göre değişen değer mi olduğunu belirt.

**Biçim:** Sayı, çoğul ve tarih için mevcut yerelleştirme ve biçimleyicileri kullan. Karar için gereken hassasiyeti koru; kompakt sayının tam değeri gerektiğinde aynı akışta erişilebilir olsun. Açıklayıcı metinde zaman birimini açık yaz; dar sayaçlarda ortak yerelleştirilmiş biçimi kullan.

**Zaman:** Süre, geri sayım, bitiş saati ve bilgi yaşı ayrı anlamlardır. Uçuşta kalan süre, uzun araştırmada bitiş saati, istihbaratta ölçüm yaşı karar desteği sağlar. Tarih veya saat bir sonraki güne taşıyorsa bunu belirsiz bırakma; saat dilimini ilgili bağlamda açıkla.

**Sayaç sonu:** “0 dakika sonra açılır” yazma. Sunucu doğruladıysa uygun “Hazır” veya “Tamamlandı” durumunu göster. Yalnız yerel sayaç bittiyse mevcut bekleme durumunu anlat; işlem bitti diye söz verme. Sıfırın gerçek ölçüm olduğu süre veya sayı alanlarını bu nedenle değiştirme.

**İstihbarat:** Güncel ölçüm, eski rapor ve tahmini değer açıkça ayrılır. Ölçüm yaşı ve bilgi eksikliği karar noktasında görünür. Savaşın sonucunu veya rakibin güncel durumunu, eldeki bilginin desteklediğinden daha kesin anlatma. Oyun belirsiz olabilir; açıklama belirsiz olamaz.

## 7. Metin türlerine göre kalıplar

Kalıplardaki alanları yalnız doğru ve ilgiliyse kullan; olmayan veri veya davranış üretme.

| Tür | İçerik |
| --- | --- |
| Gezinme | Gidilecek yer veya konu: “Filo”, “Araştırma”, “Wiki” |
| Eylem butonu | Fiil + gerekiyorsa nesne: “Filoyu gönder”, “Siparişi iptal et” |
| Mekanik / öğe açıklaması | Ne işe yarar → hangi kapsamda ne değişir → önemli koşul veya sınır |
| Ön koşul / devre dışı eylem | Eksik koşul → mevcut/gerekli değer → mümkün olan sonraki adım |
| İşlem sürüyor | Hangi işlem sürüyor → varsa güvenilir ilerleme veya süre |
| Başarı | Doğrulanan işlem → ne değişti → gerekiyorsa sonraki adım |
| Kural nedeniyle engel | Yapılamayan eylem → gerçek neden → oyuncunun yapabileceği şey |
| Teknik hata | Hangi işlem doğrulanamadı → bilinen durum → güvenli sonraki adım |
| Boş durum | Ne yok → gerekiyorsa neden → ürünün desteklediği ilk adım |
| Arama sonucu yok | Sonuç bulunmadı → sorguyu düzeltmeye yönelik somut öneri |
| Onay | Hangi eylem → kapsam ve bedel/kayıp → geri alınabilirlik → açık eylem butonu |
| Bildirim / rapor | Ne oldu → nerede ve ne zaman → doğrulanan sonuç → ilgili yere bağlantı |

**Onaylar:** Kaynak kaybını yalnız iade tutarıyla anlatma. Hem kaybolan hem geri gelen miktarı göster; ilerleme kaybını veya geri çağrılamamayı davranışa göre açıkla. Aynı onayda iki “İptal” kullanma: işlemi yapan “Siparişi iptal et”, onaydan çıkan “Vazgeç” olabilir.

**Hatalar:** Ağ bağlantısı sorunu ile oyun kuralının reddini ayır. Kod veya ham sunucu mesajı gösterme. İşlemin sonucu bilinmiyorsa “Kaynak harcanmadı” deme ve tekrar ücretlendirebilecek bir eylemi kontrolsüz yeniden denemeye yönlendirme. “Tekrar dene” yalnız güvenli ve uygulanabilir olduğunda kullanılır.

**Erişilebilirlik:** İkonun erişilebilir adı gerçek eylemi söyler. Sayı ve durum yalnız renkle anlatılmaz. Ekran okuyucu metni, görünen metnin anlamını ve önemli değerlerini korur. Gerekli açıklama mobilde açılabilmeli; yalnız hover veya görsel konum tarifine bağlı olmamalı.

## 8. Wiki ve uzun mekanik açıklaması

Bir makalede okuyucunun ihtiyacına göre şu düzeni kullan; mekanik gerektirmediği başlığı doldurmak için içerik üretme:

1. **Kısa tanım:** Nedir, ne işe yarar?
2. **Çalışma kuralı:** Girdi, işlem ve sonuç; kapsam ve zamanlama.
3. **Gereksinimler:** Kaynak, seviye, kapasite ve gerekli önceki adımlar.
4. **Sınırlar ve riskler:** Kararı değiştiren istisna, kayıp ve geri alınamama.
5. **Kullanım:** Oyuncu bunu hangi durumda, hangi gerçek adımlarla kullanır?
6. **Referans değerleri / örnek:** Gerekiyorsa birimli tablo ve açıklaması.
7. **İlgili konular:** Anlamlı bağlantı metniyle ön koşula veya sonraki karara bağlantı.

Başlıklar içerikte cevaplanan konuyu söyler. “Buraya tıkla” yerine gidilen konunun adını kullan. Sayfa başlığı ve description içeriği doğru özetler; anahtar kelime doldurmak için tekrar ekleme.

Sayısal kural mümkün olduğunda mevcut ortak kural kaynağından üretilir. Açıklama, tablo ve örnek aynı koşulları anlatır. Örneğin varsayımları belirtilir; varsayımsal sayı gerçek oyun değeri gibi gösterilmez.

Public Wiki ile oyun içi Wiki aynı içerik kaynağını kullanır. UI özetinin daha kısa olması kuralın değişmesi anlamına gelmez. Kritik koşul ve risk, oyuncunun karar verdiği yüzeyde yine görünür.

## 9. Yerelleştirme

- Cümleyi kelime kelime çevirme; aynı eylemi, koşulu, kapsamı, sonucu ve belirsizliği doğal dille anlat.
- Türkçe ve İngilizce aynı mekanik ayrıntılarını taşır. Diğer desteklenen dillerde de bir koşul çeviri sırasında kaybolamaz.
- Çevrilebilir cümleyi anlamlı bir bütün olarak tut. Ayrı parçaları birleştirerek özellikle Türkçe ekleri veya cümle sırasını bozma.
- Yer tutucuların ne olduğu belli olsun: miktar mı, ad mı, süre mi? Ad ve ek birleşimlerini gerçek örneklerle kontrol et.
- Tekil/çoğul, sıfır, büyük sayı, uzun nesne adı ve eksik veri durumlarını incele. Oyuncunun verdiği isimleri değiştirerek çevirmeye çalışma.
- Anlamlı aynı kavramı tekrar kullan; aynı İngilizce kelimeyi taşıyan farklı bağlamları tek çeviri anahtarına zorla birleştirme.
- Türkçede büyük harf ve `i/İ/ı/I` biçimlerini doğru uygula. Dar alana sığdırmak için doğal olmayan kısaltmalar üretme.

## 10. Açıklanabilecek bilgi sınırı

Oyuncuya açık sistem kurallarını, ön koşulları, birimleri, riskleri ve açıklanabilir hesapları doğru anlat. Kaynak kodunu okuyabiliyor olmak, içindeki bütün bilgileri yayımlama yetkisi değildir.

Rakibe ait görünmeyen durum, özel hesap bilgileri, gizli istihbarat, keşfedilmemiş konumlar, güvenlik/istismar önleme eşikleri, sunucu sırları ve gizli seçim veya rastgelelik girdileri UI açıklamasına veya herkese açık Wiki'ye taşınmaz. Kullanıcının bilmemesi gereken mantığı yalnız açıklamayı kolaylaştırdığı için paylaşma.

Kuralın oyuncuya açık olması ile bu kurala giren rakip verisinin gizli olması farklıdır. Genel kuralı anlatırken gizli veriyi veya kesin sonucu açığa çıkarma. Açıklama sınırı belirsizse ilgili ayrıntıyı yayımlamadan doğrula; geri kalan doğrulanmış açıklama üzerinde ilerle.

## 11. Örnekler

İlk sütun yazım hatasını göstermek için oluşturulmuştur; mevcut UI'dan birebir alıntı olduğu iddia edilmez. Sayılı örnekler gerçek değer yerine yer tutucu kullanır. Mekanik örnekleri yayımlanacağı zaman ilgili kodla yeniden doğrulanır.

| Belirsiz / dolaylı | Tercih edilen |
| --- | --- |
| “Kaynak toplama işlemi gerçekleştirilmelidir.” | “Kaynakları havuzdan depoya topla.” |
| “Daha güçlü üretim.” | “Bu gezegenin saatlik alaşım üretimini artırır.” |
| “Yetersiz kaynak.” | “{{amount}} Alaşım daha gerekiyor.” |
| “Limit: {{limit}}.” | “Savunma en fazla {{limit}} ise tam başarı.” |
| “Güç: ?” | “Savunma bilinmiyor. Henüz sonda raporu yok.” |
| “0 dakika sonra açılır.” | “Birazdan açılır.” — yalnız süre bitmiş, durum henüz doğrulanmamışsa |
| “İade: {{refund}}.” | “İptal edersen {{lost}} Alaşım kaybolur. {{refund}} Alaşım geri gelir.” |
| “Public sayfayı aç.” | “Wiki sayfasını aç.” |
| “Fleet V2 zırh bonusu.” | “Gemi zırhı bonusu.” — gerçek etkisi ayrıntıda açıklanır |
| “Fleet dispatch must be performed.” | “Send the fleet.” |

Örneklerin kod dayanağı: kaynak toplama için `packages/rules/src/economy.ts` → `collect`; üretim için aynı dosyadaki üretim fonksiyonları; oyuncu adları için `locales/*/data.ts`; savunma eşiği ve belirsizlik ifadeleri için ilgili counter/ruler metinleri ve davranışları; sayaç için `apps/web/src/lib/time.ts`; iptal için gerçek iptal işlemi ve iade hesabı. Bir örnek tek başına oyun kuralını kanıtlamaz.

## 12. İnceleme ve uygulama

Bir işlevsel metin değişikliği şu kontrolü geçer:

- [ ] Mekanik, koşul, kapsam ve sayılar çalışan kodla ve ilgili testlerle doğrulandı.
- [ ] Oyuncu neyi gördüğünü, hangi eylemi yapabileceğini ve önemli sonucu anlayabiliyor.
- [ ] Engeller, maliyetler ve önemli riskler karar anında görülebiliyor.
- [ ] Terimler UI, erişilebilir metin, rapor ve Wiki'de aynı kavramı adlandırıyor.
- [ ] Kesinlik, bilgi yaşı ve işlem durumu gerçekte desteklenen şeyi söylüyor.
- [ ] Çeviriler aynı koşul ve sonuçları koruyor; değişkenlerle doğal cümle oluşturuyor.
- [ ] Gizli bilgi ve geliştirici iç terimi sızmıyor.
- [ ] Değişen UI, 350 px mobil ve masaüstünde gerçek uzun ad/sayılarla okunuyor; kritik bilgi kesilmiyor.
- [ ] Gerekli davranış testleri geçti; kontrol edilmeyen bir yön varsa açıkça belirtildi.

**Uygulama:** Yeni ve değiştirilen metinlerde bu standardı hemen kullan. Eski metinlerin yalnız bu dosya eklendiği için uyumlu olduğunu varsayma. Tarama sırası: kaynak kaybı ve gönderim/onaylar → engeller ve hata mesajları → sayılar ve istihbarat → öğe/mekanik açıklamaları → onboarding ve Wiki → gezinme ve diğer etiketler. Açık bir engelleyici doğruluk hatasını sıra bekletmeden düzelt.

Bir akışı güncellerken etiket, yardımcı açıklama, eylem sonucu ve ilgili Wiki'yi birlikte incele. Yalnız bir butonu güzelleştirmek, yanlış yardımcı metni tamamlanmış saydırmaz.

Mevcut `player-facing-copy`, `turkish-copy`, `movement-error-copy`, `i18n` ve Wiki testlerinden yararlan. Davranışa bağlı mesaj, kaynak kaybı veya hata eşlemesi değişiyorsa anlamlı testi önce yaz; yalnız metin veya CSS değişikliğini kanıtlamak için uygulamayı taklit eden test üretme. Kelime sayacı veya terim taraması yardımcı olabilir, fakat doğru mekanik ve anlaşılabilirlik için insan incelemesinin yerini tutmaz.

Oyuncuyla kısa bir okuma kontrolünde cevapları ezberletmeden sor: “Bu ne işe yarıyor?”, “Bunu yaparsan ne olacak?”, “Neden şimdi yapamıyorsun?”, “Şimdi ne yapabilirsin?” Oyuncu yalnız etiketleri tekrar ediyor veya yanlış sonuç bekliyorsa açıklamayı düzelt.

Standardın kapsamı veya kuralları değişirse bu dosyayı ve sürümünü güncelle. İkinci bir paralel yazım kılavuzu oluşturma. Oyun metinlerinin toplu dönüşümü ayrı uygulama işidir; standardın eklenmesi mevcut UI ve Wiki'nin tamamının dönüştürüldüğü anlamına gelmez.

## Dayanak

- [ASD-STE100: Yapı ve amaç](https://www.asd-ste100.org/about_STE.html): kontrollü terminoloji, yazım kuralları ve teknik terimler.
- [ASD-STE100: Resmî açıklamalar](https://www.asd-ste100.org/STE_faq.html): doğrudan talimatlar, koşul sırası ve ilkelerin farklı bağlamlara uyarlanması.
- [ASD-STE100 Issue 9](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf): İngilizce cümle ve paragraf sınırlarının dayanağı.

Bu kaynaklar yazım ilkelerini destekler. Oyun mekaniği için Astera Online'ın kodu ve ilgili testleri esas alınır.
