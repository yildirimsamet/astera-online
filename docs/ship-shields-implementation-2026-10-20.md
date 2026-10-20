# Gemi kalkanları — uygulama kapsamı

Owner kararı: her mobil gemide azami (zırh araştırmalı) canı kadar savaş
kalkanı. Gemi Kalkanları araştırması dört seviyede tabana toplam %25, %50,
%70, %100 ekler; artışlar birbiri üzerine çarpılmaz. Her tur yenilenir.
Radyasyon doğrudan gövdeye işler; kalkanı tüketmez ve kalkandan faydalanmaz.
Yer savunması kişisel kalkan almaz. Gezegen Aegis'i önce işler; Nullifier'ın
bonus ateşi yalnız Aegis içindir. Kalkan hasarı onarım hasarı değildir.

Etkilenen yollar: solo/klan/çoklu savunma/anıt savaşları, önceden yaralı
ve bakım eşiğindeki gemiler, sahip bazlı teknoloji ve hasar payı, Dominion,
kaçış öngörüsü, korsan/nötr savaşları, filo tahmini, araştırma katalogları,
API doğrulaması, araştırma haritası ve seviye/maliyet gösterimi, gemi bilgisi,
savaş raporu ve Wiki. Radyasyon hesabı ve radyasyon araştırması ayrı kalır.
Araştırma metin ID'si mevcut genel kayıt/queue yolunu kullanır; DB şema
değişikliği gerekip gerekmediği koddan kontrol edilir.

Test planı: el hesabı kalkan sınırları, tur yenileme, kalıcı gövde yarası,
boş/çok büyük filo, ground ve support, yaralı kohortlar, farklı araştırmalı
sahipler, dalgaya bölme istismarı, Aegis/Nullifier sırası, gövdeye göre
Dominion katkısı, radyasyonda araştırmadan bağımsız doğrudan HP kaybı.
Yeni davranış için FAIL → uygulama → PASS; ardından rules/server/web
ilişkili regresyonlar, typecheck/lint ve mobil/masaüstü görsel kontrol.
Deney araçları ve eski hasar paritesi gerektiğinde açıkça eski kuralla çalışır.

Fiyat hedefi: Güç/Zırh ile aynı ilk ekonomik referans (stage 4, üç saatlik
çaba), fakat seviye başına 1,8 kat artış; dört seviyeli ulaşılabilir bir
uzmanlaşma. Maliyetler mevcut profileResearch ve ortak kristal indirimi
üzerinden hesaplanır; ayrı bir gizli fiyat tablosu eklenmez.

| Seviye | Temel kalkana toplam artış | Azami canın katı | Alaşım | Kristal | Döteryum |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0 | %0 | 1 | — | — | — |
| 1 | %25 | 1,25 | 4.662 | 2.869 | 42 |
| 2 | %50 | 1,5 | 8.391 | 5.164 | 75 |
| 3 | %70 | 1,7 | 15.103 | 9.294 | 135 |
| 4 | %100 | 2 | 27.185 | 16.729 | 243 |

Her satır ayrı ödenecek bedeldir. Ön koşul Yıldız Gemisi Mühendisliği 1.
Araştırma gövde HP'sini değiştirmez; zırh ve kalkan ayrı hesaplanır.
Yeni savaşlarda kalkan varsayılandır; eski deneyi yeniden üretmek için yalnız
araç/test tarafında `CombatSide.shipShields: false` kullanılabilir. API'de
oyuncunun değiştirebildiği bir savaş seçeneği değildir. Araştırma kimlikleri
veritabanında text olarak tutulduğu için yeni göç gerekmez. Raporun JSON
tur kaydına iki isteğe bağlı kişisel kalkan emilimi alanı eklendi; eski
raporlardaki eksik değerlerden yeni savaş geçmişi üretilmez.

Kohort kimliği gemi tipi + azami can + kişisel kalkan kapasitesidir. Eşit
özellikli dalgalar hasar ve kayıp yuvarlamasını paylaşır; dalgaları bölmek
fazladan kalkan yaratmaz. Farklı kalkan araştırmalı sahipler aynı kohorta
girmez. Katkı puanı gerçek gövde hasarını kullanır, emilen kalkanı saymaz.

Eğitim korsanı eski iki Ok ile üç turda bitmediği için başlangıç yapımı
dört Ok oldu. Miktarı build picker, API doğrulaması, kaynak hesabı ve eğitim
filosu birlikte okur. Sonraki iki Ok takviyesi aynıdır. Gerçek oyuncu ve NPC
savaşlarıyla aynı kalkan kuralı eğitimde de çalışır. Altı dilde yönlendirme
güncellendi; eğitim bitişi yine gerçek ganimet ve sağ kalanlardan hesaplanır.

Araştırma haritası altı etiketli dar grup düzenini korur: Radyasyon Kalkanı
keşif grubuna, Gemi Kalkanları doktrin grubuna yerleştirildi. Grup açıklamaları,
araştırma kartı/seviyeleri, gemi gövde/kalkan bilgisi, rapor ve Wiki güncellendi.

## Doğrulama kaydı

- TDD: yeni savaş/araştırma ve ekran beklentileri önce başarısız görüldü.
- Bağımsız prototiple 1.632 girdi × 5 araştırma seviyesi × 3 tohum = 24.480
  üretim motoru karşılaştırması: sağ kalanlar ve tur sayıları eşleşti.
- Eski kalkansız motorun digest'i yeniden kaydedilmedi; açık tarihsel
  replay seçeneğiyle önceki hash aynen geçiyor.
- Radyasyon, kişisel kalkan, yaralı gemi, Aegis/Nullifier, sahip bazlı
  araştırma, kalkan enerjisi ve gövde korunumu ayrıca sınanıyor.

Gemi Kalkanları için ayrı premium donanım görseli üretildi; asıl PNG ve prompt
`assets/source/premium/research/`, istemcinin 384 px WebP dosyası ise araştırma
görsellerinin ortak koleksiyonunda tutulur.

## Son inceleme ve doğrulama

- Radyasyonun azami kalkan araştırmasına rağmen canı biten gemiyi yok ettiği
  doğrudan test edildi. Savaş kalkanı radyasyon hesabına girmez.
- Yeni korsan raporunun eski “toplarla gövdeler arasında hiçbir şey yok” başlığı
  yanlış kaldı. Eksik başlık testi önce başarısız oldu; yeni rapor artık gemi
  kalkanlarını açıklar. Eski raporların kayıtları değiştirilmez.
- Eğitimde başlangıç üretimi dört Ok iken korsan talimatı altı dilde iki gemi
  istiyordu. Talimat bütün Ok gemilerini göndermeyi söyleyecek şekilde düzeltildi.
  Görsel aracın yalnız yapım adımlarını çalıştıran kolundaki eski iki beklentisi de
  dört/iki olarak düzeltildi; bu araç kolu son değişiklikten sonra çalıştırılmadı.
- Güç/Zırh açıklamalarındaki %56 toplam savaş gücü iddiası kaldırıldı. Zırhın
  hem azami canı hem kişisel kalkanı artırdığı altı dilde açıklandı. İlgili kod
  yorumları, bu sınırın yalnız saldırı × gövde canı çarpımı olduğunu belirtir.
- Kalibrasyon aracının MAX araştırma ayarı yeni kalkan araştırmasını atlıyordu.
  Saf ayar testi `undefined !== 4` ile başarısız oldu; dört seviye eklendikten
  sonra geçti. Uzun ekonomi/sezon kalibrasyonu çalıştırılmadı.
- Beş sunucu testi eski kalkansız sonuçları varsayıyordu. Yaralanma senaryoları
  1.500 tohumla ölçülerek kalkanı aşan filolara güncellendi; 2:1 kaçış testi
  gerçek kayıpların ve kalan gemilerin kalıcılığını denetler. Beş beklenti de geçti.
- Uçuş araştırma kaydının kalkan seviyesini koruması ve sondanın bu araştırmayı
  göstermesi mevcut entegrasyon testlerine eklendi ve geçti.
- Yaralı filoyu tek gemilik dalgalara bölmenin ek kalkan yaratmadığı ve farklı
  kalkanlı yaralı sahiplerde yalnız gerçek kalan gövdenin katkı puanına sayıldığı
  ek testlerle doğrulandı. Kalkan testi toplam 12 başarılı vaka.

Tamamlanan kontroller: rules 143 dosya / 2.749 test; önceki tam web turunun
başarısız eski beklentileri düzeltilip ilgili dosyalar yeniden geçirildi. Son
incelemenin web turu 258/258; sunucu ilişki grubu 112/112 (ilk tur ve düzeltilen
dosyaların yeniden koşumu), araştırma dahil son yeniden koşum 88/88. Korsan
33, bakım gönderimi 6 ve ortak savunma 1 testi de daha önce geçti. Tüm workspace
typecheck ve depo lint kontrolleri önceki uygulama aşamasında geçti; son inceleme
değişikliklerinden sonra tekrar çalıştırılmadı. TR/EN, 350/1280 px kalkan
ekranları görsel olarak doğrulandı; son korsan başlık metni için yeni görsel tur
yapılmadı. Sonradan eklenen iki kalkan testi önceki rules toplamına dahil değildir.

Paylaşılan PostgreSQL'in kurtarma hataları üzerine yalnız bu iş için ayrı test
sunucuları kullanıldı. Son tam sunucu turunda API sözleşme dosyası 102/102 geçti;
20 Ekim 2026'da owner testlerin durdurulmasını istediği için kalan tam tur SIGINT
ile durduruldu. Bu tur tamamlanmış/yeşil sayılmaz. Ayrı test sunucuları durduruldu;
başka çalışmalara ait süreçlere ve veritabanlarına dokunulmadı. Yayına alma yapılmadı.
