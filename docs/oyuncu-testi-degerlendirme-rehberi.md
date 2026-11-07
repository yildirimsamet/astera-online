# Oyuncu testi değerlendirme rehberi

**Amaç:** Bir oyuncunun yaşadığı oyunu, oyun tasarımı ve kullanılabilirlik ilkeleriyle değerlendirmek.

**Ne zaman kullanılır:** Yalnız oyun bittikten sonra. Oynamadan önce okunursa oyuncu artık ilk kez oynayan biri gibi bakmaz, kontrol listesi doldurur.

**Kaynaklar:** `docs/oyuncu-arastirmasi-2026-11-05.md`, Nielsen'in 10 kullanılabilirlik ilkesi, Desurvire'in PLAY ve GAP ilkeleri, Hodent'in kullanılabilirlik ve bağlanabilirlik ayrımı, öz-belirleme kuramı (yeterlik, özerklik, aidiyet), Loewenstein'ın bilgi boşluğu kuramı, platform dokunma hedefi önerileri.

## Nasıl değerlendirilir

1. **Yaşadığına bak, kuralı sonra uygula.** Her bölüm için notlarına ve ekran görüntülerine dön. Gerekirse görüntüyü yeniden aç.
2. **Yalnız gördüğünü yaz.** Kodu, dokümanı veya Wiki'yi bilmiyorsun; oyunun iç kurallarını tahmin etme. Emin değilsen "kanıt yok" yaz.
3. **İyiyi de yaz.** Her bölümde iyi uygulanmış en az bir şeyi ara. Bulamazsan "bulamadım" de. Her yerde sorun bulmak da yanlılıktır.
4. **Davranışı fikirden önde tut.** "Burada üç kez geri döndüm" bulgusu, "bence kafa karıştırıcı" bulgusundan güçlüdür.
5. **Ne zaman fark ettiğini ayır.**
   - **Oyunda:** Oynarken fark ettin, notlarında var.
   - **Rehberle:** Bu rehberi okuyunca fark ettin.

## Bulgu biçimi

Her bulgu bir satırdır:

| Alan | Değerler |
| --- | --- |
| Ekran | Ekran görüntüsü dosyası veya dosyaları |
| İlke | Bu rehberdeki ilkenin kodu, örneğin `B2` |
| Durum | İyi uygulanmış / Kötü uygulanmış / Eksik |
| Ne oldu | Ne bekledin, ne gördün, ne yaptın |
| Etki | Engelleyici (ilerleyemedim) / Yüksek (yanlış karar verdim veya bırakmak istedim) / Orta (zaman kaybettim) / Düşük (fark ettim, etkilemedi) |
| Kanıt | Gördüm / Tahmin |
| Fark | Oyunda / Rehberle |

## A. İlk deneyim ve öğrenme

Oyun yeni oyuncuyu nasıl karşılıyor, nasıl öğretiyor?

| Kod | Soru | İyi | Kötü |
| --- | --- | --- | --- |
| A1 | Oyun bir şeyi önce anlatıp sonra mı yaptırıyor, yoksa yaptırarak mı öğretiyor? | Bir dokunuşla dene, sonucu gör | Uzun metin, sonra serbest bırakma |
| A2 | İlk anlamlı eyleme kaç dokunuş ve kaç dakikada ulaştın? | Birkaç dokunuşta "bunu ben yaptım" hissi | Uzun hazırlık, sonucu belirsiz eylemler |
| A3 | Yeni sistemler sırayla mı açıldı, aynı anda mı yığıldı? | Her açılış tek ve anlaşılır | Bir dönüşte birçok yenilik birden |
| A4 | Kendine güvenin arttı mı? İlk denemeler küçük ve güvenli miydi? | İlk hatanın bedeli küçük | İlk hata büyük kayıp |
| A5 | Başka oyunlardan bildiğin şeyler işine yaradı mı, yoksa ters mi düştü? | Tanıdık simge ve hareketler | Tanıdık görünüp başka iş yapan öğeler |
| A6 | Kendi başına bıraktığında ne yapacağını biliyor muydun? | Sıradaki hedef her an görünür | "Şimdi ne yapacağım?" anları |

## B. Anlaşılabilirlik

Bir değeri göstermek onu anlaşılır kılmak değildir. Karar verirken kullandığın her sayı için şunlara bak:

| Kod | Soru | İyi | Kötü |
| --- | --- | --- | --- |
| B1 | Bu sayı neyi temsil ediyor? | Birim ve anlam yanında | Çıplak sayı veya kısaltma |
| B2 | Büyük olması iyi mi kötü mü? | Renk veya işaret yönü söylüyor | Yönü tahmin etmek gerekiyor |
| B3 | Benim karşılık gelen değerimle kıyaslanabiliyor mu? | Benimki ile onunki yan yana, aynı ölçüde | Farklı ekranlarda farklı ölçüler |
| B4 | Hangi kararım için kullanacağım belli mi? | Sayı, kararın verildiği yerde | Sayı bir yerde, karar başka yerde |
| B5 | Oyunun dili benim dilim mi? | Gündelik kelimeler, adlar | İç kodlar, teknik terimler |
| B6 | Aynı şey her yerde aynı adı ve sayıyı mı taşıyor? | Tutarlı ad ve değer | Aynı olay için farklı sayılar |
| B7 | Ekrandaki metin bulunduğum yere ve duruma mı ait? | Duruma uygun metin | Başka bir oyun aşamasından kalma metin |

## C. Öngörülebilirlik

Oyuncu bir beklenti kurabilmeli ve yanılabilmelidir. Oyun girdileri ve kuralı verir, cevabı vermez.

| Kod | Soru | İyi | Kötü |
| --- | --- | --- | --- |
| C1 | Bir eylemden önce sonucunu kabaca tahmin edebildin mi? | Girdiler ve kural görünür, sonuç belirsiz ama tahmin edilebilir | Ya kesin cevap ya hiçbir ipucu yok |
| C2 | Belirsizliğin ne kadar olduğu söylendi mi? | Aralık veya güven düzeyi | Belirsizlik gizli |
| C3 | Sonuçtan sonra neden öyle olduğunu anladın mı? | Belirleyici etkenler ve senin kararının payı açık | Sonuç rastgele görünüyor |
| C4 | Sonucu kendi kararına mı, şansa mı bağladın? Bu doğru muydu? | Kararın etkisi görünür | Kayıp açıklanamıyor |

## D. Karar desteği

Kurallar, kullanıldıkları yerde ve o anda gereken kadar öğretilmeli.

| Kod | Soru | İyi | Kötü |
| --- | --- | --- | --- |
| D1 | Bir kuralı kararı verdikten sonra mı öğrendin? | Kural karar ekranında | Kural ancak sonuç ekranında |
| D2 | Kilitli bir şeyin neden kilitli olduğunu ve neyle açılacağını gördün mü? | Kilit, açılma koşulunu söylüyor | Düğme yok, neden yok |
| D3 | Ekran, şu an yapamayacağın bir eylemin ödülünü gösterdi mi? | Ödülle birlikte "şu koşulla" | Ödül görünür, eylem görünmez |
| D4 | Bir kararın riski karar öncesinde söylendi mi? | Bedel ve risk karar anında | Risk karar sonrası ortaya çıkıyor |
| D5 | Seçenekleri tek tek açmadan karşılaştırabildin mi? | Karşılaştırma bilgisi listede | Her seçenek için ayrı ekran |
| D6 | Özelliğin sana ne kazandırdığını ve ne zaman kullanacağını hissettin mi? | "Bunu şunun için yaparım" | "Bunu neden yapıyorum?" |

## E. Sistem durumu ve geri bildirim

| Kod | Soru | İyi | Kötü |
| --- | --- | --- | --- |
| E1 | Her dokunuştan sonra bir şey olduğunu anladın mı? | Anında görünür tepki | Sessizlik, belirsiz bekleme |
| E2 | Oyunu kapatıp dönünce ne olduğunu doğru ve eksiksiz anladın mı? | Özet, ne değişti, ne yapmalı | Eksik veya yanlış özet |
| E3 | Bildirimler seni ilgili yere götürdü mü? | Dokununca tam o yer | Bildirim açılmıyor veya yanlış yere gidiyor |
| E4 | Kaynakların ve gemilerin nerede, ne durumda olduğunu bildin mi? | Tek bakışta durum | Durum dağınık, çelişkili |

## F. Etkileşim maliyeti

Kaydırma, dokunma ve ekran değiştirme maliyettir.

| Kod | Soru | İyi | Kötü |
| --- | --- | --- | --- |
| F1 | Bir şeyi bulmak için kaç ekran ve kaydırma gerekti? | Sık iş, az adım | Sık işe uzun yol |
| F2 | Ekranda olduğu halde ulaşamadığın içerik oldu mu? | Kaydırılabilir olduğu belli | Gizli devam, çalışmayan hareket |
| F3 | Dokunma hedefleri rahat mıydı? Yanlış yere dokundun mu? | Parmak boyu hedefler (iOS 44 pt, Android 48 dp civarı) | Küçük, sık dizili hedefler |
| F4 | Sık kullanılan eylemler başparmağın rahat eriştiği yerde mi? | Ana eylemler alt yarıda | Ana eylem üst köşede |
| F5 | Boşluk ve büyüklük bilgiye mi hizmet ediyor, süse mi? | Yoğun ama okunur | Kocaman boşluk, sıkışık bilgi |

## G. Hata önleme ve geri alma

| Kod | Soru | İyi | Kötü |
| --- | --- | --- | --- |
| G1 | Pahalı veya geri alınamaz bir eylem onaysız oldu mu? | Bedel ve onay görünür | Tek dokunuşla geri dönüşsüz harcama |
| G2 | Yanlış kararı geri alabildin mi? | Geri çağırma, iptal, iade kuralı açık | Geri dönüş yok veya bilinmiyor |
| G3 | Hata mesajları ne yapman gerektiğini söyledi mi? | "Şu eksik, şuradan" | Kod veya genel hata |

## H. Motivasyon, duygu ve geri dönme

| Kod | Soru | İyi | Kötü |
| --- | --- | --- | --- |
| H1 | Yeterlik: Bir şeyi başardığını, ustalaştığını hissettin mi? | Görünür ilerleme ve ustalık | İlerlemenin nedeni belirsiz |
| H2 | Özerklik: Gerçek seçimler yaptın mı, yoksa tek bir yol mu vardı? | Anlamlı alternatifler | Tek doğru yol, sahte seçim |
| H3 | Aidiyet: Başka oyuncuların varlığını hissettin mi? | Görünür canlılık, etkileşim | Boş galaksi, sessiz sohbet |
| H4 | Merak: Ayrılırken aklında açık bir soru kaldı mı, dönünce cevabını buldun mu? | "Ne oldu acaba?" ve tatmin edici cevap | Merak yok veya cevap yok |
| H5 | Kayıp adil miydi? Kaybın nedenini kabul edebildin mi? | Risk önceden belli, kayıp açıklanmış | Kayıp habersiz veya anlamsız |
| H6 | Seni geri getirecek somut bir neden var mıydı? | Yaklaşan sonuç, açılacak sistem | Sadece bekleme |

## I. Görsel kalite ve tutarlılık

| Kod | Soru | İyi | Kötü |
| --- | --- | --- | --- |
| I1 | Görsel hiyerarşi önemliyi öne çıkarıyor mu? | Önemli büyük ve parlak, ikincil sakin | Her şey aynı ağırlıkta |
| I2 | Görsel dil tutarlı mı? | Aynı tür öğe aynı görünüm | Farklı stiller karışık |
| I3 | Kaliteli ve özenli görünüyor mu? | Premium, etkileyici | Ucuz, yarım, yer tutucu görünüm |
| I4 | Görsel, oyuncuya bir şey anlatıyor mu? | Görsel durumu anlatıyor | Süs, bilgi yok |

## Değerlendirme raporu

`degerlendirme.md` dosyasına yazılır:

1. **Kısa özet:** En önemli 5 sorun ve en iyi 5 uygulama.
2. **Bölüm bölüm bulgular:** A'dan I'ya, her bölüm bir tablo; iyi uygulanmışlar da dahil.
3. **Öncelik listesi:** Etkisine göre en önemli 15 bulgu. Her biri için yalnız oyuncunun ne yaşaması gerektiği; kod önerisi yok.
4. **Rehberle değişen görüşler:** Rehberi okuyunca fikrini değiştirdiğin yerler.
5. **Sınırlar:** Denemediklerin ve kanıtı zayıf bulgular.
