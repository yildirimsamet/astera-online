ASTERA · GÖZLEMEVİ

*Vizyon* [Oyun](#oyun)[İlkeler](#ilkeler)[Atmosfer](#atmosfer)[Renk](#renk)[Tipografi](#tip)[İkonlar](#ikon)[HUD](#hud)[Ekranlar](#ekranlar)[Masaüstü](#masaustu)[Sadelik](#sadelik) *Devir* [Başla](#devir)[Durum](#durum)[Kod](#kod)[Kurallar](#kurallar)[Hatalar](#hatalar)[Kararlar](#kararlar)[Mimari](#mimari)[Bileşenler](#bilesenler)[Ekranlar](#ekran-sart)[Sunucu](#sunucu)[Varlıklar](#varlik)[Plan](#plan)[Sorular](#sorular)[Sözlük](#sozluk)

**S18** · 12. günEU-1 · 51 çevrimiçiX 1204 · Y −388

# Gözlemevi

Savaş köprüsü değil, bir gözlemevi.

İki bölüm: [Vizyon](#oyun) tasarımın ne olduğunu, [Devir](#devir) onu koda nasıl uygulayacağını anlatır. Devir bölümü tek başına işe başlamaya yeter.

Bu oyunda güç bilgiden gelir. Kimin filosunun evde olduğunu, kimin deposunun dolu olduğunu ve seni kimin izlediğini bilen kazanır. Bu yüzden arayüzü bir teleskop gibi tasarlardım: gördüğün şey keskin ve parlak, eskiyen bilgi grenli ve soluk, göremediğin yer karanlık. Ekranın büyük kısmı galaksiye kalır, arayüz yalnızca kenarlarda durur.

**%75** ekranın galaksiye ayrılan payı

**5** etiketli sekme, köşede ikon yok

**10** renk; her birinin tek anlamı var

**3** dokunuş ritmi: bak, aç, basılı tut

Oyun

## Ne oynuyoruz?

Astera tarayıcıda ve telefonda oynanan, 30 günlük sezonlarla dönen kalıcı bir uzay strateji MMO'su. Bir galakside 1000 koltuğa kadar gerçek komutan var. Her komutanın ele geçirilemeyen bir başkenti var ve en fazla üç koloniye kadar büyüyebiliyor. Savaşlar sunucuda, oyuncular çevrimdışıyken çözülüyor. Asıl mücadele ise kimin neyi gördüğü üzerine.

**Filo bahistir.** Yoldaki filo bir kez geri çağrılabilir ama dönüşü, gittiği süre kadar sürer. Kaybedilen gemi kalıcı olarak gider.

**Bilgi oyunun kendisidir.** Teleskop, radar, sonda ve raporlar; hepsi eskiyen, kısmi bilgiler.

**Gezegen ortaya konan paydır.** Depo, filo ve koloniler; hepsi başkasının hedefi olabilir.

1. Geliştir
3. Biriktir
5. Gözle
7. Fırsatı gör
9. Hedef seç
11. Riske gir
13. Gönder
15. Çevrimdışı bekle
17. Sonuç
19. Kazanç / kayıp
21. Yeni karar *↺*

### Dünyalar

- 1000 koltuklu katmanlı küre: komutanlar dış kabukta, nötr dünyalar merkeze doğru T1 → T3
- 1 başkent (ele geçirilemez); koloni yuvaları başkentin Çekirdeği 9, 12 ve 15'te açılır
- Nötr dünya: önce baskın, sonra yerleşim
- Koloni sadakati: arızalar ve yenilgiler düşürür (kesin −30, kısmi −15); sıfırda koloni binaları ve stokuyla nötre döner

### Ekonomi

- Alaşım · Kristal · Döteryum (aynı zamanda yakıt)
- 7 bina: Komuta Çekirdeği, Alaşım Rafinerisi, Kristal Ocağı, Döteryum Rafinerisi, Depo, Tersane, Hangar
- Üretim havuzda birikir, oyuncu toplar
- Her üretici seviyesi "kendini X içinde öder" diye yazar

### Filo

- 22 gemi, 4 kademe; T3 ve üstü, Yıldız Gemisi Mühendisliği ve rolüne uygun tek doktrin ister
- 3 savaş sınıfı: Akıncı › Sur › Mızrak › Akıncı; Destek silahsız
- Yer topları: Kirpi, Zıpkın, Tabya
- Hangar filo kapasitesidir; Çekirdek'e bağlı değil
- Kazıcı asteroid kazar, Hurdacı enkaz toplar

### Hareket

- Uçuş hızı: Tam, %75, %50, %25, %10; yakıt değişmez, hiçbir filo 12 saatten fazla havada kalmaz
- Geri çağırma: yoldayken bir kez; filo uçtuğu süre kadar sürede döner
- Transfer: kendi dünyaların arasında yarı yakıt, varışta 5 dk bekleme
- Uçuş yuvası: aynı anda 3 + Çekirdek/3 sefer

### Koruma

- Saldırı bandı: Çekirdek kademesi ±1 (kademe = en yüksek Çekirdek / 3)
- Aynı hedefe 12 saatte en fazla 3 saldırı
- İlk gün kalkanı; ağır yenilgiden sonra toparlanma kalkanı
- Aegis kalkanı ve yer topları

### Bilgi

- Teleskop (menzil ve izleme yuvaları), Radar (erken uyarı)
- Aegis (kalkan), Perde (gizlenme)
- Sonda: stok bandı ve sınıf dağılımı; tersanen hedefin Perdesini ne kadar aşarsa okuma o kadar net
- Savaş raporları, 5 rakip işareti

### Yörünge ve araştırma

- 4 uydu: Anten, Körük, Matkap, Kılavuz; yuvalar Çekirdek 6, 9, 12 ve 15'te açılır
- 16 araştırma projesi; tüm dünyalarına birden uygulanır
- Ölüm Yıldızı (Çekirdek 12, Tersane 5): 1 saatlik EMP; Aegis'i boşaltır, yer toplarını susturur, hiçbir şeyi yok etmez ve kontrolü değiştirmez

### Galaksi olayları

- Asteroid yağmuru: kazılacak kayalar çoğalır
- Ticaret gemisi: kaynak takası
- Galaksiler arası konvoy: herkese açık, 22 gemilik hedef
- Korsanlar, enkaz alanları

### Klan

- 5 kişilik koltuk
- Yardım konvoyları, hazine, ganimet deposu
- Ortak savaş: toplanma noktası, dalgalar, klan hangarı; kendi dalganı geri çağırabilirsin

### Topluluk ve sezon

- Galaksi sohbeti (5 dil), kronik
- Hâkimiyet sıralaması, sezon ödülleri ve arşivi
- Gezegen görünümleri mağazası, Akademi

Özetle sistem sayısı çok ama döngü tek. Tasarımın işi bu sistemleri tek bir ritme bağlamak: bak, karar ver, gönder, merak et.

İlkeler

## Her ekranın uyduğu altı kural

Aşağıdaki her renk, ikon ve ekran kararı bu altı kuraldan türetiliyor. Bir karar bunlardan birine dayanamıyorsa yapılmamalı.

Kural 1

### Ekranın sahibi dünya

Telefon ekranının en az %75'i galaksiye kalır. Arayüz yalnız üç bantta yaşar: üst şerit, bağlam kartı ve dock. Ekranda aynı anda tek bir bağlam kartı olur.

**Neden:** Oyunun en güzel ve en pahalı varlığı 3D galaksi. Paneller onu örtünce oyun bir web sitesine döner.

Kural 2

### Bilgi ışıktır

Taze bilgi net ve parlak, eski bilgi grenli ve soluk, bilinmeyen karanlıktır. Belirsizlik metinle değil dokuyla anlatılır.

**Neden:** Oyuncu "bu bilgi ne kadar güvenilir?" sorusunu okumadan, bakarak cevaplar.

Kural 3

### Her rengin tek anlamı var

Kırmızı yalnızca sana olan bir şeydir. Turkuaz sen ve senin hamlendir. Mavi klanındır. Hiçbir renk süs için kullanılmaz.

**Neden:** Renk tutarlı olunca göz, yazıyı okumadan durumu sınıflandırır.

Kural 4

### Bak · Aç · Basılı tut

Birinci dokunuş seçer ve bağlam kartını açar. İkinci dokunuş dosyayı açar. Basılı tutmak gönderir. Onay penceresi yok; gönderilen filo varıştan önce bir kez geri çağrılabilir.

**Neden:** Aynı ritim her nesnede işler. Yakıt harcayan eylem kazara tetiklenmez, fikir değiştirmenin ise bir yolu vardır.

Kural 5

### Her sayının yanında ikinci bir sayı

Güç, stok ve süre her zaman bir karşılaştırmayla gelir: senin gücün ile tahmini savunma, kargon ile ganimet, geri sayım ile saat.

**Neden:** Tek başına duran sayı bilgi değildir. Karar iki sayı arasında verilir.

Kural 6

### Dönüşte önce hikâye

Oyunu açınca önce "Sen yokken" özeti gelir: en önemli üç olay ve her birinin yanında bir buton.

**Neden:** Oyuncuyu geri getiren şey "ne oldu?" merakı. Cevabı ilk ekranda olmalı.

Atmosfer

## Canlı bir NASA fotoğrafı, üç ölçekte

Kamera üç anlamlı ölçekte durur; iki parmakla ölçekler arasında geçilir. Her ölçekte ekrandaki etiketler de değişir: uzakta yalnızca ilişkiler, yakında ayrıntı görünür.

**Galaksi *uzak*** 1000 koltuklu katmanlı küre. Komutanlar dış kabukta; nötr dünyalar merkeze doğru T1, T2 ve T3 olarak dizilir. İçeri gidildikçe garnizon ve ganimet büyür. Bu ölçekte yalnızca sen, klanın, rakiplerin ve olaylar işaretli.

**Sektör *varsayılan*** Sensör balonun: gezegenler küre, filolar iz bırakan çizgiler. Balonun dışında yıldızlar görünür ama hareket görünmez. Merak buradan doğar.

Topla

**Yörünge *üs*** Kendi gezegenin büyük görünür, uydular yörüngede döner, üretim gezegenin üstünde baloncuk olarak birikir. Üs yönetimi bu sahnenin üstünde açılır.

Işık

Galaktik çekirdek sıcak ana ışık kaynağı, kenarlar soğuk mavi. Nebula tozu JWST paletinde: pas, altın, camgöbeği. Arayüzde parlama yalnızca "şu an etkin" demektir.

Hareket

Sayfa geçişi `200 ms`, basılı tutma `600 ms`, varış parlaması `1,2 sn`. Tek eğri: `cubic-bezier(.2,.8,.2,1)`. Azaltılmış hareket ayarında kısa solma kullanılır.

Ses

Uzak, düşük bir uğultu; kısa cam tıklamaları; toplamada kristal çınlaması. Saldırı alarmı tek ve ayırt edilir, başka hiçbir yerde kullanılmaz.

Anlar

Çarpışma, ele geçirme ve konvoy baskını 1–2 saniyelik sinematiklerle oynar. Herkes görebilir, oyuncu atlayabilir.

Renk

## On anlam, on renk

Zemin ve yazı renkleri anlam taşımaz; geri kalan on rengin her birinin tek bir anlamı var. Oyunun mevcut render'larıyla (bakır alaşım, mavi kristal, yeşil döteryum) uyumlu olacak şekilde seçildi.

### Zemin

**Boşluk `#04060B`** Uzay, sayfa zemini

**Sahne `#080D18`** Sayfaların zemini

**Panel `#0D1422`** Kartlar, satırlar

**Kabarık `#131C2F`** Seçili sekme, basılan yüzey

**Kenar `#2C3C60`** Ayraç ve vurgulu kenar

### İlişki

**Sen `#2EE6C8`** Dünyaların, filoların, fırsatların ve birincil buton

**Klan `#5B8CFF`** Klan üyeleri ve ortak operasyon

**Nötr `#8C97AD`** Sahipsiz dünyalar, bilinmeyenler

**Rakip `#F25CD3`** İşaretlediğin komutanlar; 1'den 5'e numaralı

**Tehdit `#FF4B4B`** Sana olan bir şey: saldırı, hasar, kayıp

### Kaynak ve durum

**Alaşım `#F2A14A`** Yalnızca alaşım ikonunun yanında

**Kristal `#7FD0FF`** Yalnızca kristal ikonunun yanında

**Döteryum `#A8EA4C`** Kaynak ve yakıt

**Eksik `#FFCC4D`** Tamamlayabileceğin bir eksik: kaynak, yuva, araştırma, boşa giden üretim

**Premium `#E6C77E`** Yalnızca mağaza ve sezon ödülleri

- **Kırmızı yalnızca tehdittir.** "Depo dolu", "kilitli" veya "yetersiz" için asla kullanılmaz.
- **Birincil buton her zaman turkuazdır** ve bir ekranda yalnızca bir tane olur.
- **Sarı, kapatabileceğin bir boşluktur.** Yanında her zaman nasıl kapanacağı yazar.
- **Kaynak renkleri ikonsuz kullanılmaz.** Renk yardımcıdır, kaynağı tanıtan ikondur.
- **Kazanç için ayrı yeşil yok.** Kazanç senin renginde (turkuaz), kayıp tehdit renginde gösterilir.

### Netlik rampası

Oyun bir teleskop okumasının güvenilirliğini zaten beş durumla hesaplıyor: teleskop seviyen eksi hedefin Perde seviyesi (`clarity`). Parlaklık ve gren bu durumu anlatır; renk yalnızca ilişkiyi anlatır, ikisi karışmaz. Sonda ve rapordan gelen bilgiye aynı dil yaşa göre uygulanır (öneri: 1, 6 ve 24 saat eşikleri).

Tam

Perdeyi 2+ aşıyor: durum ve dönüş süresi

Berrak

1 aşıyor: durum, süre yok

Kesikli

Eşit: durum, arada kopar

Bozuk

1 geride: bazen bilinmez

Kör

2+ geride: bilinmez

Tipografi

## Tek aile, üç genişlik

Hiyerarşiyi Archivo'nun genişlik ekseni taşır: geniş kesim başlıklarda, normal kesim gövdede, dar kesim yoğun etiketlerde. 350 px ekranda dar kesim, yazıyı küçültmeden isimlerin kesilmesini önler. Koordinat ve zaman damgaları için IBM Plex Mono kullanılır. Her iki yazı tipi de Türkçe karakterleri tam destekler.

KISMİ ZAFER

**Görüntü · genişlik 125 · 800** Yalnızca sonuç kelimeleri ve ana başlıklar. Büyük harf kullanılan iki yerden biri.

Başkentine saldırı · 4 dk 12 sn içinde

**Başlık · 18 · 650** Kart ve sayfa başlıkları. Cümle düzeninde, büyük harf yok.

Ok ×32 · Kargı ×20 · Sur ×10 · Engerek ×8 · Kurye ×4

**Dar · genişlik 75 · 13 · 600** Satır etiketleri, sekmeler, dock. Aynı genişliğe yaklaşık %25 daha fazla karakter sığar.

12.4803.105860

**Rakamlar · tabular** Her rakam aynı genişlikte, sütunlar hizalı kalır. Kısaltma: 12,4b (bin), 1,2M.

X 1204 · Y −388 · 21:40:07

**Veri damgası · Plex Mono** Koordinat, saat ve rapor kimliği gibi yalnızca makinenin ürettiği değerler.

**32** Görüntü**18** Başlık**15** Alt başlık**13** Gövde**11,5** Etiket (dar)**10,5** Mikro: alt sınır

İkonlar

## Şekil anlatır, renk sınıflandırır

Üç ayrı ikon ailesi var ve birbirine karışmazlar: sınıf amblemleri (dolu), harita işaretleri (ince çizgi) ve arayüz glifleri (24 px ızgara, 1,75 çizgi, yuvarlak uç, tek renk). Gemi ve bina render'ları ise ikon değil, sahnedir; en az 56 px kullanılırlar.

### Sınıf amblemleri

Akıncıhızlı vurucu

yener

Surdayanıklı

yener

Mızrakağır vuruş

yener

Akıncıdöngü

Bu üç şekil tersanede, haritada, sonda raporunda, fırlatma ekranında ve savaş raporunda aynıdır. Oyuncu karşı sınıf kuralını bir kez görür, sonra her yerde tanır. Destek gemileri dairesiyle gösterilir.

### Harita işaretleri

Başkent

Koloni

Nötr T2

Klan

Rakip

Korsan

Asteroid

Enkaz

Kalkan

Onarım

Şekil işaretin türünü, renk ilişkiyi söyler. Renk körlüğü olan bir oyuncu da başkenti koloniden, rakibi klandan şekliyle ayırır.

### Arayüz glifleri

Galaksi

Üs

Filo

İstihbarat

Klan

Sinyaller

Sonda

Saldırı

Transfer

Radar

Teleskop

Kazı

Ticaret

Topla

İşaretle

Sohbet

Süre

Kilit

Ayarlar

Paylaş

Glifler kendi rengini taşımaz; rengi içinde bulundukları bağlam verir. Navigasyonda bir glif asla yalnız durmaz, altında her zaman etiketi olur.

HUD

## Dört bant, tek bağlam

Bugünkü ekranda aynı anda on beşe yakın yüzen parça var. Önerilen HUD'da altı bölge var ve her birinin tek bir işi var. Aşağıdaki örnek, başkente saldırı gelirken ekranın nasıl göründüğünü gösteriyor.

1. **Komutan** Avatar ve sezon günü. Dokununca profil, sıralama, ödüller ve ayarlar açılır. Menü burada, ekranın başka hiçbir yerinde yok.
2. **Kaynaklar** Rakam ve altında 2 px doluluk çizgisi. Depo dolunca çizginin ucunda sarı bir çentik belirir. Dokununca saatlik üretim, depo ve güvenli miktar açılır.
3. **Şimdi hattı** Oyundaki en acil tek zamanlayıcı. Tehdit varsa kırmızıdır ve her şeyin önüne geçer. Dokununca tüm zamanlayıcılar listelenir.
4. **Dünya** Ekranın dörtte üçü. Seçmek, yakınlaştırmak ve döndürmek burada yapılır. Olaylar dünyanın içinde gösterilir, üstüne panel olarak konmaz.
5. **Bağlam kartı** Tek yuva ve sabit bir öncelik sırası: tehdit, seçili nesne, olay, öneri. İki kart asla üst üste binmez.
6. **Dock** Beş etiketli sekme. Filo sekmesindeki halka bir sonraki varışa kalan süreyi gösterir. Yüzen başka buton yok.

**Dokun** Seç; bağlam kartı açılır

**Tekrar dokun / yukarı çek** Dosyayı aç (yarım → tam sayfa)

**Basılı tut 0,6 sn** Gönder, fırlat, harca

**Aşağı çek / geri** Üstteki sayfayı kapat

**İki parmak** Ölçek: Galaksi, Sektör, Yörünge

Ekranlar

## Döngünün her adımı için bir ekran

Her mockup çekirdek döngünün bir adımını karşılıyor. Tüm ekranlar aynı parçaları kullanıyor: güç cetveli, tazelik ölçeği, sınıf amblemi, adım sayacı, halka zamanlayıcı ve basılı tutma butonu. Oyuncu bu parçaları bir kez öğrenir.

#### **Hedef dosyası**

*Gözle → Fırsatı gör* — Oyuncu bir hedef hakkında bildiği her şeyi tek sayfada görür: gücünü aralıkla, savunma bileşimini sınıf şekilleriyle, ganimeti kargosuyla karşılaştırılmış olarak. Sonucu söylemez, beklenti kurmayı sağlar.

#### **Fırlatma: tek bileşen**

*Riske gir → Gönder* — Saldırı, sonda, transfer, yerleşim, klan dalgası, ticaret ve konvoy baskını aynı ekranı kullanır. Gemi ekledikçe cetvel canlı olarak kayar. Geride ne kaldığı ve ne kadar süre açıkta kalacağın, gönder butonundan önce yazılıdır.

#### **Filo: havadakiler**

*Gönder → Çevrimdışı bekle* — Her sefer tek satır: ilerleme, hız, kalan süre ve varış saati. Geri çağrılabilen seferde dönüşün ne kadar süreceği butonun yanında yazar; çünkü geri çağırmak bedava değil, filo dönüş boyunca da havadadır. Uçuş yuvası ve Hangar doluluğu en üstte.

#### **Üs**

*Geliştir → Biriktir* — Gezegenin kendisi ekranın kahramanı; üretim toplama gezegenin üstünde baloncuk olarak durur. Kuyruk üç halka zamanlayıcıdan ibaret. Kartlar büyük render'larla iki sütunda; eksik olan kaynak sarı yazılır ve ne kadar süre sonra yeteceği gösterilir.

#### **Savaş raporu**

*Sonuç → Kazanç / kayıp* — Döngünün ödül anı yazıyla değil sahneyle açılır. Kayıplar sınıf şekilleriyle iki sütunda karşılaştırılır ve "neden" tek cümleyle anlatılır. Rapor yeni istihbarat ürettiği için bir sonraki karara doğrudan bağlanır.

#### **İstihbarat: gözlem defteri**

*Gözle → Fırsatı gör* — Teleskop yuvaları gerçek bir raf olarak görünür. Her satırın tazeliği küçük resmin netliğinden okunur. Evden ayrılmış bir filo, geri sayımlı turkuaz bir fırsat penceresi olarak listelenir.

#### **Araştırma takımyıldızı**

*Geliştir* — 16 proje, oyunun kendi dört grubunda (Ufuk, Doktrin, Endüstri, Stratejik) yıldız olarak görünür; parlaklık seviyeyi, çizgiler gerçek önkoşulları gösterir. Grup dışı önkoşul düğümün altında okla yazılır. Stratejik grup bugün bayrakla kapalı olduğu için soluk. Seçilen projenin kartı neyi açtığını gerçek gemi render'larıyla gösterir.

#### **Klan savaş odası**

*Birlikte gönder* — Operasyon, toplanma noktasından hedefe uzanan bir hat üzerinde dalgalar olarak görünür. Beş koltuk katkılarıyla birlikte gösterilir. Form doldurmak yerine "Dalga gönder" standart fırlatma ekranını açar; dalgalar hız seçimiyle aynı anda varacak şekilde ayarlanabilir.

#### **Sen yokken**

*Geri dön → Yeni karar* — Uygulama açıldığında ilk ekran budur: tehdit, kazanç ve fırsat olmak üzere en önemli üç olay ve her birinin yanında bir sonraki adım. Oyunun "ne oldu?" sorusu burada cevaplanır.

Masaüstü

## Masaüstünde büyütme değil, sütun

Geniş ekranda telefon arayüzü büyütülmez; yan yana sütunlar açılır. Sol sütunda dünyalar, havadaki filolar ve kuyruklar kalıcı olarak listelenir. Ortada galaksi, sağda telefondaki bağlam kartının aynısı olan dosya durur. Klavye kısayolları: 1–5 sekmeler, Space seçiliye odaklanır, Esc kapatır.

Sadelik

## Daha az, daha net, daha profesyonel

Aşağıdaki her satırda aynı bilgi korunuyor; yalnızca daha az yer kaplıyor ve daha hızlı okunuyor. "Şu an" sütunu oyunun 20 Eylül ve öncesine ait ekran görüntülerinden alındı.

| Konu | Şu an | Önerim |
|---|---|---|
| Kaynaklar | Rakam, 8 noktalı ölçek ve "934 free" yazısı | Rakam ve 2 px doluluk çizgisi; ayrıntılar dokununca |
| Navigasyon | Köşelerde 6 etiketsiz ikon butonu | Altta 5 etiketli dock sekmesi |
| Üretim toplama | Üstte ayrı "Works" paneli | Gezegenin üstünde "Topla" baloncuğu |
| Saldırı kararı | Açıklayıcı paragraflar ve çok sayıda sayı | Tek güç cetveli (ForceCompare'in evrimi): kanadın, savunma bandı ve "temizler / kırar" eşikleri |
| Bilgi tazeliği | Kaynak ve yaş küçük bir metin etiketiyle yazılıyor ("Sonda, canlı") | Gren, parlaklık ve "2 sa önce" damgası |
| Gemi kartı | 4 çıplak sayı ve bir açıklama cümlesi | Sınıf şekli, büyük render ve rol; sayılar ayrıntı sayfasında |
| Harcayan eylem | Onay penceresi | 0,6 saniye basılı tutma; gönderilen filo varıştan önce bir kez geri çağrılabilir |
| Hız ve geri çağırma | Hız fırlatma ekranında; geri çağırma uçuş şeridinde Kazıcı ve transfer satırlarında | Filo sekmesinde her seferin yanında aynı buton; dönüşün ne kadar süreceği butonun yanında yazar |
| Zaman | Kimi yerde geri sayım, kimi yerde saat; ikisi nadiren birlikte | Geri sayım ve saat birlikte: "4 dk 12 sn · 21:40" |
| Etiketler | Çoğu büyük harf ve geniş aralıklı | Cümle düzeni; büyük harf yalnızca sınıf ve sonuç etiketlerinde |
| İnşaat kuyruğu | Gezegen ekranının dörtte birini kaplayan panel | 3 halka zamanlayıcı |
| Savaş raporu | Rakam kartları ve açıklama metinleri; sonuç sahnesi yok | Sonuç sahnesi, sınıf kayıp çubukları ve tek cümlelik "neden" |
| Klan gönderimi | Açılır liste, sayı kutuları ve "hesapla" butonu olan form | Standart fırlatma ekranı, canlı hesaplama |
| Araştırma | Liste | Takımyıldız haritası |
| Oyuna dönüş | Galaksi açılır; olanlar Sinyaller rozetinde bekler | "Sen yokken" özeti |

Kaçınılacaklar

## Yapmayacağım şeyler

- **Her kartı kesik köşeli metal plakaya çevirmek.** Malzeme dili yalnızca basılı tutma butonunda ve sonuç sahnesinde kullanılmalı.
- **Her yere neon parlama eklemek.** Parlama yalnızca "şu an etkin" anlamına gelmeli.
- **Etiketsiz ikonlarla navigasyon.** Oyuncu bir resmi değil, adı olan bir yeri arar.
- **Tehlike olmayan durumlar için kırmızı.** Aksi halde gerçek bir saldırı gürültüde kaybolur.
- **Başlığın altına kuralı anlatan paragraf yazmak.** Kural bir dokunuş derinde durmalı.
- **Oyunun içinde tarayıcının kendi form elemanları.** Açılır liste ve sayı kutusu oyunu bir web formuna çevirir.
- **Bir köşede birden fazla yüzen öğe.** Her bölgenin tek bir sahibi olmalı.
- **Aynı bilgiyi üç farklı biçimde göstermek.** Bir rakam ve bir şekil yeterli.

Bölüm 2 · Devir

## Sıfırdan başlayan biri için devir notları

Bölüm 1 tasarımın ne olduğunu anlatır. Bu bölüm onu Astera kod tabanına uygulamak için gereken her şeyi içerir: bugünkü kodun durumu, tasarımın dayandığı doğrulanmış kurallar, onay bekleyen kararlar, her yüzeyin yeni yeri, bileşen ve ekran şartnameleri, sunucu işleri, varlıklar, test listeli faz planı ve açık sorular. 23 Eylül 2026'da `master` (5b45cbf) ve üzerindeki commit'lenmemiş çalışma alanı okunarak yazıldı.

**Önce bunu oku: doğruluk sırası.**

1. **Kod ve testler** tek doğru kaynaktır. Bu belgedeki her iddianın yanında bir kod referansı var; işe başlamadan önce o dosyayı açıp bilginin hâlâ geçerli olduğunu kontrol et.
2. **Bu belge** ikinci kaynaktır.
3. **`docs/*.md` belgeleri eski, eksik ya da yanlış olabilir** (sahibin talimatı). Onlara dayanarak karar verme; çelişkide kod kazanır.

**Çalışma kuralları (proje sahibinin zorunlu kuralları, `CLAUDE.md`).**

- Her kod değişikliği **TDD** ile yapılır: önce test yazılır, çalıştırılır ve kırmızı görülür; sonra kod yazılır ve yeşile döner. Yalnızca stil, className ve CSS değişiklikleri istisnadır.
- `pnpm verify` sıfır tip hatası, sıfır lint hatası ve beklenen testler yeşil olmadan iş bitmiş sayılmaz. `pnpm lint` 4 GB heap ile çalışır; `eslint`'i doğrudan çağırma.
- Sunucu testleri tek bir paylaşılan Postgres kullanır: aynı anda iki vitest koşusu birbirinin verisini siler, seri çalıştır.
- Ön yüz değişikliği 350×812 (DPR 2) ekranda görsel olarak doğrulanır: `node tools/visual.mjs out/<klasör>` (önce `pnpm start`). Her koşu bir komutan kaydeder; art arda çok koşu kayıt hız sınırına takılabilir.
- Oyuncunun okuduğu her metin 5 dilde yazılır: `apps/web/src/i18n/locales/{tr,en,de,fr,es}`. Cümle JSX'te birleştirilmez; sayılar adlandırılmış parametre olarak geçer.
- Ana döngüye, risk/ödüle, PvP'ye, sahipliğe, ilerlemeye ya da kimliğe dokunan her değişiklik önce sahibin onayını alır. Bu belgede bunlar [Karar defteri](#kararlar)nde toplandı.

**Bölüm 1'deki mockup'lar hakkında.** Komutan adları, gezegen adları ve sayılar örnektir; kural olan her şey [Doğrulanmış kurallar](#kurallar) tablosunda kod referansıyla yazılıdır. Önerilen tasarım token'ları aşağıda; SVG ikonlar (`i-*` glif, `c-*` sınıf amblemi, `m-*` harita işareti, `sel` seçim çerçevesi) `docs/ui-v2/icons.svg` içinde. Mockup'ların HTML'i yalnız git geçmişinde: `git show 08bf3f6:docs/ui-v2/gozlemevi.html`.

```css
:root{
  color-scheme:dark;
  --void:#04060B;--deep:#080D18;--panel:#0D1422;--raise:#131C2F;--line:#1D2842;--line-hi:#2C3C60;
  --ink:#EEF3FF;--ink-2:#A4B1CD;--ink-3:#66738F;
  --self:#2EE6C8;--self-ink:#032520;--ally:#5B8CFF;--neutral:#8C97AD;--rival:#F25CD3;--hostile:#FF4B4B;
  --warn:#FFCC4D;--alloy:#F2A14A;--crystal:#7FD0FF;--deut:#A8EA4C;--premium:#E6C77E;
  --f-ui:"Archivo","Helvetica Neue",Arial,system-ui,sans-serif;
  --f-mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
  --ease:cubic-bezier(.2,.8,.2,1);
}
```

Rakip işaretleri (K2 onayıyla): bugünkü 5 slot rengi korunur, paletle çakışmayan tonlara çekilir. Gren dokusu (bilgi yaşı, B7) SVG `feTurbulence` gürültüsüdür: `baseFrequency .85`, `numOctaves 2`, `mix-blend-mode: overlay`, opaklık yaşa göre 0 / .35 / .6.

**Bir faz ne zaman biter?** O fazın kabul kriterlerinin her biri bir test olarak yazılmış ve yeşil olduğunda, 350 px'te görsel doğrulama yapıldığında ve yeni metinler 5 dile eklendiğinde. Kriter, test olmadan "bitti" sayılmaz.

Devir · Durum

## Uygulama durumu

Bu tablo her faz sonunda güncellenir. Ayrıntılı ilerleme repoda `docs/ui-v2/PROGRESS.md`; çalışma dalı `ui-v2` (worktree `.claude/worktrees/ui-v2`). Yeni arayüz bayraksız, önümüzdeki sezonla yayınlanır.

| Faz | İçerik | Durum |
|---|---|---|
| Adım 0 | Worktree, başlangıç ölçümü, şartname kopyası, fleet escape güncellemesi | Tamam |
| F0 | H1, H2 (ui-v2'de; master'a cherry-pick: 074f338, a7b8348) | Tamam |
| F1 | v2 token, yazı tipi, ikon, kit | Sırada |
| F2 | v2 HUD | Bekliyor |
| F3 | Dosya, Fırlatma, Filo, S1, S2 | Bekliyor |
| F4 | Rapor, S4 | Bekliyor |
| F5–F8 | Üs, İstihbarat, Klan, Sen yokken, Masaüstü | Bekliyor |
| F9 | 3D gezegenler | Bekliyor (varlıklar geldi) |
| F10 | Temizlik | Bekliyor |

Devir · Mevcut kod

## Bugünkü kodda bilmen gerekenler

### Yığın ve komutlar

| Parça | İçerik |
|---|---|
| Monorepo | pnpm çalışma alanı: `apps/web`, `apps/server`, `packages/rules`, `packages/sim` |
| apps/web | React, Vite, Tailwind v4 (`@theme` `src/styles.css` içinde), @react-three/fiber + drei + postprocessing, @tanstack/react-query, i18next, motion, zod |
| apps/server | Fastify, Drizzle ORM, Postgres, Redis. Gerçek zamanlı akış SSE ile `/api/stream`. `ROLE=both` iken tek süreç hem API hem worker |
| packages/rules | Oyunun tüm kuralları, saf TypeScript. Sunucu ve istemci aynı paketi kullanır; UI'daki her hesap buradan gelir |
| packages/sim | Sezon simülatörü (`pnpm sim`) |
| `pnpm start` | `tools/dev-up.sh`: Docker'da Postgres (tmpfs, her açılışta boş), migrate, bootstrap, API:3100, web:5173 (istemci `/api`'yi API'ye yönlendirir) |
| `pnpm verify` | typecheck + lint + test (tüm paketler) |
| Görsel doğrulama | `node tools/visual.mjs out/<klasör>`: 350×812, DPR 2, SwiftShader. Başka modlar: `--battle-reports`, `--academy`, `--silent-space` |

### Bugünkü tasarım sistemi

Değiştirilecek sistem şudur. Yeni token'lar eklenirken aşağıdaki koruyucu testler **silinmez**; aynı niyetle, yeni değerlere göre yeniden yazılır.

| Konu | Bugün (kod) | Yer |
|---|---|---|
| Yazı tipleri | Görüntü: Saira Variable. Gövde: IBM Plex Sans Variable. `--font-mono` de Saira'ya bağlı. Yüklü ama kullanılmayan: `@fontsource/archivo-narrow`, `@fontsource/ibm-plex-mono` | `src/styles.css` satır 2–3 ve `@theme`; `package.json` |
| Renkler | alloy `#d9a441` · crystal `#6fd3e0` · deuterium `#8eea36` · threat `#e2412c` · threat-ink `#ffb0a2` · opportunity `#5ad39b` · bone (metin) `#f3f7ff` · dim `#93a0b6` · faint `#738198` · plate `#0c1321` / hi `#182236` / lo `#050911` | `@theme` (`--color-*`) |
| Kanallar | `--ch-crystal 91 210 255`, `--ch-threat 255 96 77`, `--ch-opportunity 88 244 179`, `--ch-alloy 255 190 82`; kullanım `rgb(var(--ch-x) / 40%)` | `styles.css` ~506 |
| Netlik rampası | full `#edf6ff` · clear `#afc8dd` · int `#7c8ca3` · deg `#5a6478` · blind `#39404f` | `--color-clarity-*` |
| Tip ölçeği | hero 46 · readout 27 · figure 18 · title 16 · body 12 · caption 10 · label 11 · micro 9; tracking-label.14em | `--text-*` |
| Rakip renkleri | Slot başına 5 renk: `#ff6b43 #f2c14e #c86bff #ff5fa2 #8b8bff` | `galaxy/PlanetField.tsx` `RIVAL_COLOURS` |
| Koruyucu testler | `palette.test.ts` (her renk tek yerde kanal olarak; plate durumları tek mekanizma) · `surface-vocabulary.test.ts` (her sınıf bir şeye çözülür) · `chat-type-scale.test.tsx` · `viewport-zoom.test.ts` (form alanı 16 px tabanı, pinch reddi) | `apps/web/test/` |
| Lint kuralı | `text-[..]`, `tracking-[..]`, `rounded-[..]` yasak; ölçekten adım kullanılır, yeni adım `@theme`'e eklenir | `eslint.config.js` `no-restricted-syntax` |
| Kit | ArtWell, Button, Confirm, GradeStamp, Meter, Plate, PriceTag, Readout, ResourcePill, Segmented, Sheet, Surface, useCountUp, useOwnPress | `src/ui/kit/` |
| Sınıf ikonları | `SkirmisherIcon`, `BulwarkIcon`, `LanceIcon`, `SupportIcon`; karşı sınıf işareti `CounterMark` | `src/ui/icons/index.tsx`, `src/ui/CounterMark.tsx` |

### Bugünkü ekran envanteri

| Parça | Dosya | Ne yapıyor |
|---|---|---|
| Üst çubuk | `shell/StatusBar.tsx` | Birden fazla dünya varsa aktif dünya `<select>`'i; `Stock` ×3 (değer, kapasite, saatlik, Depo'nun koruduğu); `Signals` (zil); menü butonu; `AttackShield`; `Works` (üretim havuzu, Topla, "Depo dolu"); `Bays` (uçuş yuvası); `RecoveryBoostNote` |
| Galaksi üstü | `screens/GalaxyView.tsx` | `DiscReadout` (sunucu, çevrimiçi, dünya sayısı) · `ActiveGalaxyEvent` (olay çipleri) · `SensorToggles` (katman düğmeleri + olay rehberi) · `DiscControls` (Araştırma, Eve dön, İstihbarat, Klan, Transfer; etiketsiz) · `ChronicleLauncher` · `ChatLauncher` · `SituationGuide` · `PendingStrip` |
| Durum motoru | `lib/directives.ts` | threat / opportunity / growth / idle yönergeleri; `SituationGuide` ilkini gösterir |
| Havadakiler | `shell/PendingStrip.tsx` | Uçuşlar, madencilik ve kurtarma seferleri; Kazıcı ve transfer satırlarında geri çağırma |
| Odak panelleri | `galaxy/FocusPanel.tsx` | PlanetFocus, OwnedPlanetFocus, AsteroidFocus, PirateFocus, IntergalacticConvoyFocus, TradeFocus, RunFocus, ThreadFocus, ContactFocus, DebrisFocus; sonda `ProbeControl`, Ölüm Yıldızı `StrikeConfirm` |
| Gönderim sayfaları | `screens/` | `LaunchSheet` (saldırı, korsan), `TransferSheet`, `SettlementSheet`, `TradeSheet`, `IntergalacticConvoySheet`, `WorldsPanel`; klan dalgası `ClanWarPanel` içinde |
| Paneller | `GalaxyView.tsx` `Panel` tipi | planet, research, intel, report, leaderboard, clan, chat, chronicle, rewards, announcements, feedback, donate, skin-shop, skin-inventory, admin, recap, menu, return |
| Menü | `shell/MenuPanel.tsx` | Sezon (Sıralama, Ödüller, Sezon özeti) · Astera (Mağaza, Envanter, Duyurular, Geri bildirim, Destek) · Yardım (rehber, Akademi tekrarı) · Cihaz (dil, ses, müzik, görüntü kalitesi, FPS, gizlilik) · Rakip işaretleri · Hesap (galaksi, sezon bitişi, çıkış) · Sessiz Uzay · Admin |
| Gezegen ekranı | `screens/PlanetScreen.tsx` | Sekmeler `TABS = grow, orbit, defend, reach, tactical`; etiket `GROUPS[id].problem`; kuyruklar, orbit rafı, kartlar (`UpgradeRow`, `ItemSheet`) |
| Araştırma | `screens/ResearchPanel.tsx` | `GROUPED`: Ufuk, Endüstri, Doktrin, Stratejik (Stratejik `FEATURE_FLAGS.STRATEGIC_RESEARCH_ENABLED=false` ile gizli) |
| Diğer | `screens/`, `shell/`, `onboarding/` | IntelScreen, BattleReports, ClanScreen, ChatScreen, ChronicleScreen, LeaderboardScreen, RewardsScreen, SeasonArchiveScreen, SeasonRecap, Skins/SkinInventory, DonateScreen, AnnouncementsScreen, FeedbackScreen, ServersScreen, AdminPanel, LandingScreen, Academy, SilentSpaceNotice, ConsentNotice, LoadingScreen |

Devir · Doğrulanmış kurallar

## Tasarımın dayandığı oyun gerçekleri

Her satır koddan okundu. Ekrana konan her bilgi bu tabloyla uyuşmak zorunda. Özellikle görünürlük satırları (11–15) bir sis sızıntısını önler: bir mockup buradakinden fazlasını gösteriyorsa mockup yanlıştır.

| # | Konu | Kural | Kod | Arayüze etkisi |
|---|---|---|---|---|
| 1 | Uçuş hızı | `MISSION_PACES = [1,.75,.5,.25,.1]`. Tek bacak en fazla 12 sa (`TRAVEL.pacedFlightCapMinutes`); tam hız her zaman seçilebilir. Hız yakıtı değiştirmez; dönüş bacağı hep tam hız. Korsan saldırısında hız yok | `rules/travel.ts` `allowedPaces`; `api/client.ts` launch/transfer/startClanWar `pace` | Fırlatmada hız satırı (bugün `LaunchSheet`'te var). Havadaki sefer verisinde `pace` alanı yok → [S1](#sunucu) |
| 2 | Geri çağırma (bugün) | Transfer: yoldayken bir kez, dönüş uçulan süre kadar, iniş her zaman sığar, yakıt iadesi yok. Kazıcı: temastan önce. Klan dalgası: kendi dalgası | server `services/movement.ts` `recallTransfer`; `POST /api/fleet/:missionId/recall`; `/api/mining/runs/:runId/recall`; `/api/clan/war/contributions/:id/recall` | Buton yalnız sunucu `recallable: true` derse çıkar; istemci tahmin etmez |
| 3 | Saldırı geri çağırma | **Kodda yok.** `api/client.ts`: "IRREVERSIBLE. There is no recall endpoint". Sahip 23 Eylül 2026'da açılmasına karar verdi; kural ayrıntısı açık ([K8](#kararlar)) | — | Tasarım transfer kuralını varsayar; [S2](#sunucu) |
| 4 | Transfer | Kendi dünyaların arası yakıt %50 (`FUEL.laneShare.HOMEWARD = 0.5`). Varışta 5 dk bekleme (`TRANSFER_COOLDOWN_MINUTES`, `planets.transferReadyAt`); geri çağırma bu beklemeye takılmaz | `rules/fuel.ts`, `constants.ts`; web schema `transferReadyAt` | "Filoyu taşı" yarı fiyatı ve kalan beklemeyi butonda söyler |
| 5 | Uçuş yuvası | Dünya başına eşzamanlı sefer; planet view `flight {used, total}` | web schema `flight`; `StatusBar` `Bays` | Fırlatma ve Filo'da "5 / 7" |
| 6 | Saldırı bandı | `coreTier = ceil(Çekirdek / 3)`; iki komutanın en yüksek Çekirdek kademeleri arasındaki fark ≤ 1 (`ABUSE.tierBand`) | `rules/loot.ts` `canAttack`, `coreTier`; web `lib/band.ts` `outOfBandAbove` | Sis altında istemci yalnızca "bandın üstünde"yi kanıtlayabilir. **"Bandında" asla yazılmaz** |
| 7 | Tekrar saldırı sınırı | Aynı saldırgandan aynı hedefe 12 saatte en fazla 3 saldırı (`ABUSE.bashLimit = 3`, `bashWindowMinutes = 720`) | `loot.ts`; server `services/mission.ts` | Saldırı butonunda ret nedeni |
| 8 | Kalkanlar | İlk gün kalkanı; ağır yenilgi sonrası toparlanma kalkanı (`earnsRecoveryShield`, eşik `ABUSE.recoveryLossHours` = 4 saatlik net üretim kaybı) | `loot.ts`; `StatusBar` `AttackShield` | Kalkan varken tehdit rengi kullanılmaz ([H1](#hatalar)) |
| 9 | Koloni | Yuvalar başkent Çekirdeği 9, 12, 15'te (`MULTI_WORLD.colonyCoreThresholds`). Sadakat: yenilgide KESİN −30, KISMİ −15 (`FAULT.battleLoyaltyLoss`); arızalar düşürür; 0'da koloni binaları ve stokuyla nötre döner. Sadakat değeri yalnız sahibine görünür (planet view `loyalty`) | `rules/strategic.ts` `colonyCapacity`; `constants.ts`; server `services/loyalty.ts` | Rakip dosyasında sadakat değeri yok, yalnızca kural |
| 10 | Ölüm Yıldızı | 60 dk EMP: Aegis 0, yer topları susar. Hiçbir şey yok etmez, kontrolü değiştirmez. Çekirdek 12 + Tersane 5. `STRATEGIC_CRAFTING_ENABLED = true`, `STRATEGIC_RESEARCH_ENABLED = false` | `constants.ts` `DEATH_STAR`, `FEATURE_FLAGS`; server `services/strategic.ts` | Koloni ele geçirme dili kullanılmaz |
| 11 | Teleskop izleme yuvası | Yuva başına: `status` (HOME / AWAY / UNKNOWN), `staleMinutes`, `etaMinutes` (yalnız FULL), `state`. `clarity = teleskop − perde`: ≥2 FULL, 1 CLEAR, 0 INTERMITTENT, −1 DEGRADED, altı BLIND (TR: tam, berrak, kesikli, bozuk, kör) | `rules/intel.ts` `telescopeReading`, `clarityState`; web `intelSchema.watching`; `ui/Clarity.tsx` | İzleme satırı **gemi sayısı göstermez**; dönüş saati yalnız tam netlikte |
| 12 | Teleskop görüşü (uçan filo) | Teleskop menzilindeki uçan filo: kesin gemi dağılımı (`fleet`). Menzil dışı: `unknown`, konum var tür yok | web `trafficSchema` | Tehdit kartında kesin sayı yalnız gelen filo teleskop menzilindeyse |
| 13 | Radar | Yön L2+, kütle sınıfı (LIGHT / MEDIUM / HEAVY) L4+, köken ve tür silueti L5+; kadro vermez | `rules/intel.ts` `radarRevealsBearing/Size/Origin/Composition`, `massClass` | Tehdit kartı radar seviyesine göre değişir |
| 14 | Sonda | Stok bandı, ateş gücü bandı (`fuzzBand`), sınıf okuması (DOMINANT / EVEN / SHARES / UNREAD / NONE). Doğruluk: senin tersanen, hedefin Perdesi (`probeAccuracy`) | `rules/intel.ts` `classReading` | Dosyada "okunan dağılım"; yüzdeler yalnız SHARES okumasında |
| 15 | Savaş raporu | Savunan, saldıranın gönderdiği filoyu ve kayıplarını görür. Saldıran yalnızca savunanın kayıplarını görür; savunanın sahaya çıkardığı filo ve kalanları gizli (`theirFleet: {}`) | server `services/reports.ts` `viewOf` | Rapor, karşı tarafın kalanlarını asla göstermez |
| 16 | Tahmin | `forecastLines(wing, input)` → `{ clears, breaks }`, ikisi de aralık: `clears` altı KESİN, `breaks` altı en az KISMİ. Kaçış çizgisi `escapeLine(wing) = combatValue(wing) / ESCAPE.ratio` (3); hüküm `escapeVerdict(wingPower, wall, clears)` → RUN / STAND / UNSURE. `matchupsAgainst` karşı sınıf metnini, `wallKnowledgeOf` duvar bilgisini verir. `ForceCompare` kazanan ya da yüzde söylemez | `rules/forecast.ts`; web `ui/ForceCompare.tsx`; metinler `tr/shapes.ts` (`matchup*`) | Güç cetveli bunun görsel evrimidir; **yeni tahminci yazılmaz** |
| 16b | Taktik geri çekilme (a64b230) | Savunan hattın gemileri, akın hattın ateş gücünün en az 3 katıysa **ve** savaş zaten KESİN kaybedilecekse, yakıtı yetiyorsa (`escapeFuel`) savaştan önce kalkar; savaşı yalnız yer topları ve Aegis verir. Yakıt yetmezse gemiler kalır (STRANDED). Yeni sezon kuralı: `fleetEscapeApplies(rulesetVersion)` | `rules/escape.ts` `resolveRaid`; web `ui/EscapeReadout.tsx`, `ui/ForceCompare.tsx`; metinler `tr/shapes.ts` (`escapeRun/Stand/Unsure/At/Rule`), `tr/planet.ts` (`defend.escapeReady/escapeShort`), bildirim `raidedEscaped`, `raidedStranded`, `raidTargetFled` | Saldıran: cetvelde üçüncü "kaçar" çizgisi + hüküm cümlesi. Savunan: Savunma sekmesinde kendi eşiği ve kalkış yakıtı. Rapor ve bildirim kaçışı söyler |
| 17 | Araştırma ağacı | Önkoşullar: Yoğun Yakıt ← İzotop; Gravitik ← İzotop; Ölüm Yıldızı Prot. ← Gravitik; Önleme Ağı ← Gravitik; Stratejik Stok ← Ölüm Yıldızı Prot.; Gemi Gücü ← Yıldız Gemisi Müh.; Gemi Zırhı ← Yıldız Gemisi Müh.; Gemi İtkisi ← Yoğun Yakıt. Diğer altısının önkoşulu yok. T3 ve üstü gemi: Mühendislik + role uygun tek doktrin | `rules/research.ts` `RESEARCH_PROJECTS`; `rules/hulls.ts` `requiredResearch` | Takımyıldız bu veriden türetilir, elle çizilmez |
| 18 | Galaksi | 1000 koltuk, yarıçap 3000 katmanlı küre: komutanlar 0.80–1.00R, sunucu komutanları 0.72–0.80R, T1 0.50–0.70R, T2 ~0.35R, T3 ~0.12R. Yeni sezonla gelir | commit `9f5ee19`; `rules/galaxy.ts` | Galaksi ölçeği görseli |
| 19 | Dönüş özeti | `GET /api/session/return`: en fazla 5 giriş (fleet_returned, convoy_result, raided, raid_result, scan_detected, accrued, unlock), pending, newUnlocks. **Okunduğunda** `players.lastSeenAt` ilerler; başlıklar sunucuda İngilizce düz metin. İstemci overlay'i kaldırıldı: telefon sekmeyi yeniden yükleyince neredeyse her dönüşte çıkıyordu ve girişte bloke eden bir istekti | server `services/session.ts` `buildReturnPayload`; `db/schema.ts`; web `session/useSession.ts` (kaldırılma notu) | "Sen yokken" bu iki hatayı çözerek geri gelir ([K5](#kararlar), [S3](#sunucu)) |
| 20 | Bildirimler | Türler: colony_captured, colony_fault, colony_lost, colony_loyalty_warning, convoy_result, death_star_result, fleet_returned, galaxy_event_started/ended, incoming_fleet, probe_report, raided, raid_result, scan_detected, settlement_lost/success, strategic_incoming, strategic_intercepted, target_gone, unlock. Yardımcılar: `describeNotification`, `isUrgent`, `isAlarming`, `signalFamily`, `signalOutcome`, `signalGlyph` | web `lib/notifications.ts` | Şimdi hattı ve Sen yokken buradan beslenir |
| 21 | Gezegen çizimi | Galakside 16 PNG render kameraya bakan kart (billboard), render başına bir instanced draw. Skin'ler 3D `.glb`: normalize birim geometri, görünüm başına bir draw, yüklenemezse PNG'ye düşer | `galaxy/PlanetField.tsx`, `PlanetSkinModel.tsx`, `SkinAssetBoundary.tsx` | [K7](#kararlar), [3D gezegenler](#varlik) |
| 22 | Basma | Bir kontrol yalnızca üzerinde başlayan basmaya cevap verir (hayalet tıklama hatası D109a) | `ui/kit/useOwnPress.ts` | Basılı tut butonu bunun üstüne kurulur |
| 23 | Saat | Sunucu saatine göre istemci saati `serverNow()`; geri sayımlar saniyede bir sorgu yapmaz | web `lib/clock.ts` | Tüm geri sayımlar bunu kullanır |

Devir · Bugün düzeltilebilecek hatalar

## Tasarım kararı beklemeyenler

Bunlar yeni tasarımdan bağımsız, bugünkü koddaki hatalar. İlk faz olarak yapılabilir.

| # | Hata | Kanıt | Düzeltme | Önce yazılacak test |
|---|---|---|---|---|
| H1 | Saldırı kalkanı varken kırmızı THREAT kartı | `lib/directives.ts`: "zemin savunması yok" kuralı (`ground === 0 && exposed > floor`) kalkanı hiç kontrol etmiyor | Kalkan aktifken aynı durum `growth` türünde çıkar ve kalkanın bitiş süresini söyler | Kalkanlı, yer savunmasız gezegende hiçbir yönerge `threat` değildir; kalkan bitince `threat` olur |
| H2 | "Depo dolu" tehdit renginde | `shell/StatusBar.tsx` ~404 `text-threat` | Tehdit dışı bir uyarı rengi (bugünkü paletle alloy tonu; yeni palette `warn`) | Depo dolu işareti `text-threat` sınıfı taşımaz |
| H3 | Klan savaşı gönderiminde elle "Rota ve maliyeti hesapla" | `screens/ClanWarPanel.tsx` `actions.quote` butonu | Filo ya da çıkış dünyası değişince teklif otomatik istenir (300 ms debounce); eski teklif ekranda "güncelleniyor" olarak kalır | Filo değişince tek bir teklif isteği gider; gönder butonu teklifsiz etkin değildir |
| H4 | Türkçe klan sekmeleri taşıyor | 20 Eylül ekran görüntüsü: "KUVVETLERÜYELER" çakışması, "ÖZET" ekran dışında | Sekme etiketleri cümle düzeninde ve dar kesimde; 5 sekme 350 px'e sığar | Görsel: 5 dilde 350 px'te sekmeler taşmaz |
| H5 | Odak rayı olay hapının ve sohbet butonunun üstüne biniyor | 20 Eylül `03-focus.png` | Faz 2'deki tek bağlam yuvası kalıcı çözüm; o zamana kadar odak rayı açıkken alt öğeler gizlenir | Odak açıkken olay hapı ve sohbet düğmesi DOM'da görünür değil |

Devir · Karar defteri

## Sahibin onayını bekleyen kararlar

Sahip 23 Eylül 2026'da K1–K11'in tamamını önerildiği gibi onayladı. Her satırda bugünkü davranış, onaylanan öneri ve gerekçesi var.

| # | Konu | Bugün | Öneri | Neden | Durum |
|---|---|---|---|---|---|
| K1 | Navigasyon | Köşelerde etiketsiz `DiscControls` (konumları sabit tutuluyor), `SensorToggles`, sohbet ve kronik düğmeleri, menü butonu | Altta 5 etiketli sekme: Galaksi · Üs · Filo · İstihbarat · Klan. Sol üstte komutan çipi (menü). Zil sayfası üç sekmeli: Sinyaller · Kronik · Sohbet. Sağ üstte tek "Görünüm" çipi (katmanlar + olay rehberi) | Adı olmayan yere ulaşılmaz; ekran galaksiye kalır; köşe başına en fazla bir öğe | Onaylandı |
| K2 | Renk paleti | Bölüm "Bugünkü tasarım sistemi"; kendi dünyalar crystal ile aynı camgöbeği; rakipler slot başına 5 renk | Bölüm 1 "Renk": 10 anlamlı renk; "Sen" turkuazı kristalden ayrılır. Rakip için iki seçenek: (a) tek magenta + numara, (b) 5 rengi koru ama paletle çakışmayan tonlara çek | Her rengin tek anlamı olsun; kırmızı yalnız tehdit | Onaylandı |
| K3 | Tipografi | Saira + IBM Plex Sans; 8 adımlı ölçek (gövde 12); büyük harf üç sınıfta ama pratikte yaygın | Archivo (genişlik ekseni 62–125) + IBM Plex Mono; boyutlar bugünkü sıkı ölçekte kalır (gövde 12 px; sahibin "büyük yazı yok" talimatı); büyük harf yalnız sınıf ve durum etiketleri ile sonuç kelimeleri | Dar kesim 350 px'te kesilmeyi önler; hiyerarşi. **Not:** sahibin "büyük yazı ve buton yok" talimatı var; gövdenin 12 → 13 olması ayrıca onaylanmalı | Onaylandı |
| K4 | Onay biçimi | Fırlatma sayfası tek dokunuşla gönderir; kuyruk iptali ve Ölüm Yıldızı onay sayfası (`Confirm`) açar | Fırlatma (tüm türler) ve Ölüm Yıldızı: 0,6 sn basılı tut. Bir şeyi yok eden eylemler (kuyruk iptali kaynağın yarısını yakar) `Confirm`'de kalır, çünkü neyin kaybolduğunu yazması gerekir | Kazara gönderim olmaz, ek sayfa da açılmaz | Onaylandı |
| K5 | "Sen yokken" | Overlay kaldırılmış (kural 19) | Şartlarla geri gelir: bloke etmez, eşik geçilmeden çıkmaz, kapatılınca `lastSeenAt` ilerler, metin istemcide yerelleştirilir ([E10](#ekran-sart)) | Oyuncuyu geri getiren "ne oldu?" sorusu ilk ekranda cevaplanır | Onaylandı |
| K6 | Araştırmanın yeri | Ayrı panel, `DiscControls`'tan açılıyor | Üs sekmesinin üstünde "Bu dünya \| Araştırma" segmenti. İçerik yine komutan geneli ve bunu yazar | İlerleme tek yerde; köşe butonu kalkar | Onaylandı |
| K7 | Gezegenler 3D | PNG billboard (kural 21) | 3D küre + dönüş + terminator + atmosfer; 2D küçük resimler aynı 3D kaynaktan render ([Varlıklar](#varlik)) | Işık sahneyle uyumlu, dönen canlı dünyalar; skin'ler zaten 3D | Onaylandı |
| K8 | Saldırı geri çağırma kuralı | Yok | Transfer kuralı: yoldayken bir kez, dönüş uçulan süre kadar, yakıt iadesi yok, iniş her zaman sığar, son dakika kilidi yok. Savaş kaydı oluşmadığı için tekrar saldırı sınırına sayılmaz; dönüş bacağı trafikte normal uçuş gibi görünür | Sahip kararı (23 Eylül); ayrıntı gerekli | Onaylandı |
| K9 | Araştırma takımyıldızı | Grup akordeonlu liste | Takımyıldız + seçili kart ([E8](#ekran-sart)) | "Sırada ne var?" tek bakışta | Onaylandı |
| K10 | Masaüstü | Sayfalar tam genişlik; yalnız bazı ekranlarda kırılım | ≥1100 px: 3 sütun; 700–1099 px: 2 sütun ([E11](#ekran-sart)) | Sahip masaüstünün hiç düşünülmediğini söyledi | Onaylandı |
| K11 | Bilgi yaşı dili | Metin etiketi ("Sonda, canlı") | Netlik (teleskop) = çubuklar + parlaklık; yaş (sonda, rapor) = gren + "X sa önce". Yaş eşikleri önerisi: 1 / 6 / 24 sa | Güvenilirlik okumadan görülür | Onaylandı |

Devir · Bilgi mimarisi

## Her yüzeyin yeni yeri

Bugün var olan her şeyin nereye taşınacağı. Hiçbir yüzey kaybolmaz. Kural: her yüzeye, hiçbir şey olmadığında da dock, komutan çipi ya da zil üzerinden en fazla iki dokunuşla ulaşılır. Galaksi hiç kapanmaz; sekmeler onun üstünde sayfa olarak açılır.

| Bugün | Yeni yer | Not |
|---|---|---|
| Aktif dünya `<select>` | Kaynak şeridinin başında aktif dünyanın işareti (◇ başkent, △ koloni); dokununca Dünyalar sayfası (`WorldsPanel`: liste, geçiş, transfer) | Yalnız ikinci dünyadan sonra görünür. Kendi dünyasına galakside dokunmak da onu aktif yapar (bugünkü davranış) |
| `Stock` ×3 | Üst çubukta kaynak ölçeri ×3 (aktif dünyanın) | Dokununca Ekonomi ayrıntısı: saatlik, kapasite, Depo'nun koruduğu, dolma süresi |
| `Works` (havuz, Topla, Depo dolu) | Gezegenin üstünde "Topla" baloncuğu (galakside ve Üs'te) + Üs sekmesinde rozet; depo dolu = kaynak çizgisinin ucunda sarı çentik | Toplama isteği bugünkü mutasyon |
| `AttackShield` | Komutan çipinde kalkan işareti ve süre; bitişe 1 saat kala Şimdi hattına girer |  |
| `Bays` | Filo sekmesinin başı ve Fırlatma |  |
| `RecoveryBoostNote` | Üs üretim satırında toparlanma notu |  |
| `Signals` (zil) | Üst çubuk zili; sayfa sekmeleri Sinyaller · Kronik · Sohbet | K1. Sohbetin okunmamış noktası zile taşınır |
| Menü butonu | Komutan çipi (sol üst) → Komutan sayfası | Menüdeki tüm bölümler aynen (Sezon, Astera, Yardım, Cihaz, Hesap, Sessiz Uzay, Admin) |
| `DiscReadout` | Komutan sayfasının başı (sunucu, çevrimiçi) + Galaksi ölçeğinde ekran başlığı |  |
| `ActiveGalaxyEvent` | Bağlam yuvasının "olay" önceliği + dünyada işaret |  |
| `SensorToggles` | Sağ üstte tek "Görünüm" çipi: katmanlar ve olay rehberi | Galaksi sekmesinde görünür |
| `DiscControls`: Araştırma | Üs › Araştırma | K6 |
| `DiscControls`: Eve dön | Galaksi sekmesine tekrar dokunmak kamerayı aktif dünyaya uçurur |  |
| `DiscControls`: İstihbarat, Klan | Dock |  |
| `DiscControls`: Transfer | Dünyalar sayfası + kendi dünyana odaklanınca bağlam kartındaki "Buraya taşı" | Bugünkü "from → to" sayfası korunur |
| `ChronicleLauncher`, `ChatLauncher` | Zil sayfasının sekmeleri | K1 |
| `SituationGuide` | Bağlam yuvasının en düşük önceliği ("öneri") | H1 düzeltmesiyle |
| `PendingStrip` | Filo sekmesi › Havada + dock'taki Filo halkası | Geri çağırma satırları buraya |
| Odak panelleri | Bağlam kartı (kısa) → dosya (yarım / tam sayfa) | İçerik aynı verilerden |
| Gönderim sayfaları | Tek Fırlatma bileşeni, türe göre bölümler | B14 |
| planet paneli | Üs sekmesi |  |
| research paneli | Üs › Araştırma | K6 |
| intel paneli | İstihbarat sekmesi: Gözlem · Raporlar · Radar | Rakip işaretleri Gözlem'e taşınır |
| report paneli | İstihbarat › Raporlar; bildirimden doğrudan rapor | Bugünkü davranış |
| clan paneli | Klan sekmesi |  |
| leaderboard, rewards, recap, sezon arşivi | Komutan › Sezon |  |
| skin-shop, skin-inventory, donate | Komutan › Mağaza |  |
| announcements, feedback | Komutan › Astera |  |
| admin | Komutan › Admin (yalnız yetkili) |  |
| return (Sessiz Uzay) | Komutan › Sessiz Uzay + kendi bildirimi | "Sen yokken" ile karıştırılmaz |
| Akademi, rehber | Komutan › Yardım | Onboarding bu işin kapsamı dışında; yalnız token'ları alır |
| Landing, Loading, Consent | Değişmez | Yalnız token'lar |

Devir · Bileşenler

## Bileşen şartnamesi

Her bileşen için amaç, veri, davranış ve kabul testleri. Test adları öneridir; her kabul kriteri bir test olur. "Yeniden kullan" yazanlar mevcut kodu genişletir, sıfırdan yazılmaz.

#### B1 · Üst çubuk

- **Amaç:** Kim olduğun, aktif dünyanın kaynakları ve bildirimler; tek satır.
- **Yapı:** [Komutan çipi] [aktif dünya işareti, ≥2 dünyada] [kaynak ×3] [zil]. Yükseklik 48 px + güvenli alan.
- **Kaynak ölçeri:** İkon 16 px, değer (tabular; 99.999'a kadar tam sayı, üstü yerel kısaltma: TR "12,4b", EN "12.4k"), altında 2 px doluluk (değer / kapasite). Dolu: çizginin ucunda sarı çentik, tehdit rengi yok. Dokununca Ekonomi ayrıntısı.
- **Zil:** Sayı = görülmemiş, durum dışı bildirimler (bugünkü kural: durum sayıya girmez). Nabız yalnız acil olanda.
- **Veri:** planet view (`alloyCap`, `alloyPerHour`, `vaultProtected`…), `Signals`.
- **Testler:** Üç ölçer değer/kapasite gösterir · dolu ölçer tehdit rengi almaz · dünya işareti yalnız ≥2 dünyada · zil sayısı durumları saymaz · 350 px'te 5 dilde kesilme yok (görsel).

#### B2 · Şimdi hattı

- **Amaç:** Oyundaki en acil tek zamanlayıcı.
- **Öncelik:** 1) Sana gelen düşman (pending `incoming`, en yakın varış) · 2) kendi saldırının varışı ≤10 dk · 3) en yakın kendi varışın (filo, transfer, madencilik dönüşü) · 4) ≤5 dk'da biten inşaat/araştırma · 5) ≤15 dk'da biten galaksi olayı · 6) kalkan bitişine ≤1 sa. Hiçbiri yoksa satır gizlenir.
- **Görünüm:** Nokta (1'de kırmızı, diğerlerinde turkuaz), başlık, alt bilgi, geri sayım ("4 dk 12 sn"), dokununca saat, "+N" diğerleri. Dokunmak tüm zamanlayıcıların listesini açar.
- **Veri:** pending thread'ler, kuyruklar, aktif olaylar; `serverNow()`.
- **Testler:** Öncelik sırası tablo testi · düşman her zaman kazanır · boşken DOM'da yok · TR/EN süre biçimi · düşman satırı `aria-live="polite"`.

#### B3 · Bağlam yuvası

- **Amaç:** Ekranda tek bir kart; üst üste binme imkânsız.
- **Öncelik:** A) sana gelen tehdit · B) seçili nesne · C) aktif galaksi olayı · D) öneri (`directives`, tehdit olmayan ilk). Bir nesne seçiliyken tehdit gelirse kart değişmez; kart başlığında kırmızı "1 tehdit" hapı çıkar, dokununca tehdit kartına geçer (oyuncunun bağlamı zorla koparılmaz).
- **Yükseklikler:** Kısa ≤140 px; yukarı çekmek ya da ikinci dokunuş dosyayı açar: yarım %55, tam %92. Aşağı çekmek ya da X bir sonraki önceliğe döner.
- **Yerine geçer:** `SituationGuide`, odak rayının kısa hâli, `ActiveGalaxyEvent` çipi.
- **Testler:** Öncelik tablosu · aynı anda iki kart yok · seçim varken tehdit kartı yerini almaz · kapatma sırası.

#### B4 · Dock

- **Yapı:** Galaksi · Üs · Filo · İstihbarat · Klan; sabit sıra, etiket her zaman, ikon 21 px, yükseklik 64 px + güvenli alan.
- **Rozetler:** Üs: toplanabilir havuz ya da arıza varsa nokta · Filo: bir sonraki kendi varışına ilerleme halkası + havadaki sayısı · İstihbarat: görülmemiş rapor · Klan: klan dikkati (bugünkü `lastClanSeenAt` mantığı).
- **Davranış:** Aktif Galaksi sekmesine tekrar dokunmak kamerayı aktif dünyaya uçurur. Diğer sekmeler galaksinin üstünde sayfa açar; canvas asla unmount olmaz.
- **Testler:** Sıra sabit · 5 dilde etiketler 350 px'e sığar (görsel) · Galaksi'ye tekrar dokunma aktif dünyayı çerçeveler · rozet kuralları.

#### B5 · Güç cetveli (ForceCompare'in evrimi)

- **Yeniden kullan:** `ui/ForceCompare.tsx` ve `forecastLines`. Yeni hesap yok; yalnızca görsel ve metin.
- **Görünüm:** Aynı eksende iki şerit: kanadın (turkuaz dolu) ve savunmanın sonda bandı (taralı). Savunma şeridinde üç işaret: kaçış çizgisi (`escapeLine`, sarı kesikli), `clears` (turkuaz kenarlı) ve `breaks` (açık kenarlı). Açıklama: "altı kaçar ~E", "altı kesin temizlenir ~X", "altı en az kırılır ~Y". Altında `escapeVerdict` hükmü mevcut metinle (`escapeRun` / `escapeStand` / `escapeUnsure`); kaçış kuralı sezonda yoksa (`fleetEscapeApplies` false) çizgi ve hüküm çizilmez.
- **Yasaklar:** Kazanan, yüzde, yeşil tik yok. Hiç bakılmamışsa savunma şeridi çizilmez, yerine "Sonda yok: savunma bilinmiyor" ve sonda butonu. Okumanın açık bıraktığı kısım taralı kalır.
- **Eksen:** Üst sınır = max(kanat, bant üstü, breaks üstü) × 1,15, yuvarlanmış.
- **Testler:** Mevcut ForceCompare testleri (ve `fleet-escape.test.tsx`) yeşil kalır · kazanan metni yok · bakılmamışsa bant yok · aralıklar `forecastLines` çıktısıyla aynı · kaçış çizgisi `escapeLine` ile aynı ve kural kapalı sezonda yok.

#### B6 · Karşı sınıf satırı

- **Yeniden kullan:** `matchupsAgainst` ve mevcut metinler (`tr/shapes.ts`: `matchupMajority`, `matchupRemainder`, `matchupMixed`, `matchupSplit`, `matchupBring`, `matchupSingle`, `matchupExposure`, `matchupProbe`).
- **Görünüm:** Sınıf amblemleriyle tek satır: "◆ Ağırlıklı Mızrak, yarıdan fazla · ⬢ Sur getir · kalanı okunmadı, seni karşılayabilir".
- **Testler:** DOMINANT / EVEN / SHARES / UNREAD için doğru metin · SHARES sıfır olmayan sınıfı düşürmez.

#### B7 · Netlik ve yaş işaretleri

- **Netlik:** Teleskop satırlarında mevcut `ClarityBars` (5 çubuk) + durum kelimesi (tam, berrak, kesikli, bozuk, kör) + küçük resmin parlaklığı `--color-clarity-*`'dan.
- **Yaş:** Sonda ve rapordan gelen bilgide "X sa önce" + gren katmanı: <1 sa yok, 1–6 sa hafif, 6–24 sa güçlü, >24 sa güçlü + soluk (eşikler K11).
- **Kural:** Renk ilişkiyi, parlaklık ve gren kesinliği anlatır; ikisi karışmaz.
- **Testler:** Durum → çubuk eşleşmesi · yaş → gren sınıfı eşikleri · BLIND "?" ve kesikli çerçeve.

#### B8 · Sınıf amblemi

- **Şekiller:** ▲ Akıncı (SKIRMISHER) · ⬢ Sur (BULWARK) · ◆ Mızrak (LANCE) · ● Destek (SUPPORT). SVG bu sayfadaki `c-sk`, `c-bw`, `c-ln`, `c-sp` sembolleri.
- **Yeniden kullan:** Mevcut `SkirmisherIcon`, `BulwarkIcon`, `LanceIcon`, `SupportIcon` ve `CounterMark` bu şekillere çevrilir; yeni bir ikon ailesi açılmaz.
- **Yerler:** Tersane kartları, fırlatma satırları, raporlar, dosya, radar bileşimi.
- **Testler:** Her sınıfın aria etiketi sınıf adı · dört sınıf dört farklı şekil.

#### B9 · Basılı tut butonu

- **Temel:** `useOwnPress` üstüne kurulur: basma butonun üstünde başlamalı.
- **Davranış:** 600 ms kesintisiz basma; halka ve alt çizgi dolar. Erken bırakma ya da parmağın dışarı kayması iptal eder. Başlangıçta ve başarıda kısa titreşim. Engelli durumda basılı tut yok, sebep butonun üstünde yazar.
- **Klavye / ekran okuyucu:** Space basılı tutulabilir. Enter butonu satır içi iki adımlı onaya çevirir ("Gönder · emin misin?"); ekran okuyucuya "basılı tut ya da iki kez onayla" söylenir.
- **Hareket azaltma:** Dolum görünür kalır (durumdur), parlama animasyonu kalkar.
- **Kullanım:** K4'e göre: tüm fırlatmalar ve Ölüm Yıldızı.
- **Testler:** Yalnız 600 ms sonra tetikler · erken bırakınca tetiklemez · dışarı kayınca iptal · başka yerde başlayan basma tetiklemez · klavye yolu · engelliyken sebep görünür.

#### B10 · Hız seçici

- **Yeniden kullan:** `LaunchSheet`'teki mevcut hız satırı (`data-launch-pace`), seçenekler `allowedPaces`'ten.
- **Görünüm:** "Uçuş hızı", altında "yakıt aynı · en çok 12 sa"; Tam · %75 · %50 · %25 · %10. Seçim varış satırını anında günceller. Korsan hedefinde gösterilmez.
- **Testler:** İzin verilmeyen hız seçilemez · varış süresi hızla ölçeklenir · yakıt değişmez.

#### B11 · Uçuş satırı (Filo)

- **Veri:** pending thread: `kind`, `targetName`, `arriveAt`, `homeAt`, `leg`, `fleet`/`mass`, `recallable`, `path.departAt`. Hız etiketi için yeni `pace` alanı (S1).
- **Hesap:** İlerleme = (şimdi − departAt) / (arriveAt − departAt). Geri çağırma önizlemesi = uçulan süre (şimdi − departAt) → "X dk'da evde".
- **Davranış:** Buton yalnız `recallable` iken. Geri çağrılınca satır "Eve dönüyor, uçtuğu kadar sürecek" der (mevcut `recallFleetStarted` metni) ve bir daha buton göstermez.
- **Testler:** İlerleme ve önizleme hesabı · `recallable` false iken buton yok · geri çağrıldıktan sonra buton yok · dönüş bacağında buton yok.

#### B12 · Halka zamanlayıcı (kuyruk)

- **Görünüm:** Konik ilerleme halkası, içinde nesnenin küçük resmi, ad ve kalan süre. İnşaat ve tersane hatları ayrı; araştırma hattı Araştırma segmentinde.
- **Davranış:** Dokununca kuyruk sayfası; iptal orada ve `Confirm` ile (yarısı yanar, önce yanan yazılır).
- **Testler:** İlerleme oranı · boş hat "+ Boş hat" · iptal Confirm açar.

#### B13 · Topla baloncuğu

- **Görünüm:** Kendi dünyanın üstünde, 3D sahneye bağlı turkuaz hap: "+3,2b". Yalnız havuz dolmaya başlayınca görünür (öneri: havuz kapasitesinin %10'u); dolunca nabız.
- **Davranış:** Dokunmak toplar (mevcut mutasyon), kaynak ölçerleri yerinde güncellenir.
- **Testler:** Eşik altında görünmez · dokunma tek istek atar · doluyken nabız sınıfı.

#### B14 · Fırlatma bileşeni

- **Amaç:** Tüm gönderimlerin tek anatomisi.
- **Bölümler:** Başlık (fiil + hedef) · güç cetveli + karşı sınıf satırı (savaş türlerinde) · gemi satırları (`QuantityStepper`: −, sayı, +, Maks; amblem; hazır sayısı) · kargo (transfer, yerleşim, ticaret) · hız seçici · bilgi ızgarası (varış + saat, dönüş, yakıt, kargo, uçuş yuvası, evde kalan) · uyarı satırı · basılı tut.
- **Türler:** Saldırı · korsan (hız yok) · sonda · transfer (yarı yakıt, bekleme) · yerleşim (kuruluş kargosu, talep süresi) · ticaret (`quoteTrade`) · konvoy baskını · klan dalgası (klan kapasitesi, toplanma, dönüş kilidi) · Ölüm Yıldızı.
- **Teklif:** Sunucu teklifi gereken türlerde (klan dalgası) teklif otomatik istenir, "Hesapla" butonu yok.
- **Testler:** Her tür doğru bölümleri gösterir · teklif değişiklikte otomatik · ret nedeni butonun üstünde · basılı tut olmadan gönderim yok.

#### B15 · Rapor sahnesi

- **Görünüm:** Sonuç kelimesi (KESİN ZAFER / KISMİ ZAFER / PÜSKÜRTÜLDÜ; savunan için karşılıkları), hedef gezegenin render'ı, ganimet şeridi, kuvvetler (kendi: gönderilen → kalan; karşı: yalnız yok edilenler + "kalanlar gizli"), tek cümle "neden", bilanço satırı (ganimet, yakıt, kayıp). Taktik geri çekilme: saldırana "gemileri kaçtı" (ne tuttuğu söylenmez), savunana kaçan gemiler ve yanan yakıt ya da "yakıt yetmedi" (mevcut `BattleReports` metinleri).
- **Veri:** Mevcut rapor görünümü; bilanço için yakıt alanı yok (S4).
- **Testler:** Saldırgana karşı tarafın kalanları asla verilmez · "neden" cümlesi sınıf verisinden · savunan görünümü saldıranın filosunu gösterir.

Devir · Ekranlar

## Ekran şartnameleri

Bölüm 1'deki her mockup'un veri kaynağı, davranışı, kenar durumları ve kabul kriterleri.

#### E1 · Galaksi (HUD)

- **Bölgeler:** B1 üst çubuk, B2 Şimdi hattı, dünya, B3 bağlam yuvası, B4 dock. Sağ üstte "Görünüm" çipi.
- **Ölçekler:** Galaksi (tüm küre, yalnız ilişkiler ve olaylar), Sektör (varsayılan, sensör balonu), Yörünge (kendi dünyan büyük). İki parmakla geçiş; etiketler ölçeğe göre açılır.
- **Kenar:** Tek dünya: dünya işareti yok. Tehdit + seçim: B3 kuralı. Lesson (Akademi) modu: bugünkü kısıtlar korunur.
- **Kabul:** 350×812'de hiçbir öğe üst üste binmez · ekranın ≥%70'i dünya · IA tablosundaki her yüzey ≤2 dokunuş.

#### E2 · Hedef dosyası

- **Sıra:** Başlık (render, [ETİKET] sahip, dünya türü, mesafe/uçuş) · bilgi satırı (kaynak ve yaş) · Güç (B5) · Okunan dağılım (`classReading`; yüzdeler yalnız SHARES) + B6 · Yer savunması (biliniyorsa) · Ganimet tahmini (stok bandı × `computeLoot` × `vaultProtects`, kargonla karşılaştırmalı) · Koloni kuralı (yalnız COLONY: sadakat kuralı, değer değil) · Geçmiş (`RivalHistory`) · Eylemler: Sonda, İşaretle, Saldırı planla.
- **Yasaklar:** "Bandında" yazmaz; rakibin sadakat değerini göstermez; izleme yuvasından gemi sayısı çıkarmaz.
- **Ret nedenleri:** Butonun üstünde: bandın üstünde (kanıtlanabiliyorsa), tekrar saldırı sınırı, kalkan (süreyle), köken toparlanıyor, tersane isyanı.
- **Kabul:** Bakılmamış hedefte savunma şeridi yok ve sonda çağrısı var · SHARES dışında yüzde yok · koloni bloğu yalnız koloni hedefinde.

#### E3 · Fırlatma

- **Bileşen:** B14. Uyarı satırı: "Başkent X süre zayıf kalır" (evde kalanlara göre) + geri çağırma notu (K8 sonrası saldırıda).
- **Kabul:** Gemi eklendikçe cetvel ve ızgara anında değişir · izin verilmeyen hız seçilemez · teklif gerekiyorsa otomatik.

#### E4 · Filo

- **Sekmeler:** Havada (B11 satırları: kendi uçuşlar, madencilik, kurtarma, klan dalgaları) · Evde (dünya başına garnizon) · Hangar (dünya başına kapasite).
- **Başlık:** Uçuş yuvası ve Hangar doluluğu.
- **Kabul:** Her uçuşun ilerlemesi ve kalan süresi doğru · geri çağırma yalnız izinliyse · satıra dokunmak kamerayı o gemiye götürür (bugünkü davranış).

#### E5 · Üs

- **Sahne:** Kendi dünyanın render'ı (K7 sonrası 3D), yörüngede uydu yuvaları (dolu, boş, kilitli + açılacağı Çekirdek), B13.
- **İçerik:** Segment "Bu dünya | Araştırma" (K6) · üretim satırı (saatlik, depo %, Depo'nun koruduğu işaret) · B12 kuyruklar · kategori sekmeleri (`grow` Ekonomi, `orbit` Sensör/Yörünge, `defend` Savunma, `reach` Tersane, `tactical` bayrağa bağlı) · iki sütun kartlar (render ≥74 px; sahip / alınabilir / yetersiz / kilitli durumları; eksik kaynak sarı ve yetme süresiyle; üreticilerde "kendini X içinde öder").
- **Koloni:** Arıza ve sadakat bloğu en üstte (`FaultSheet`).
- **Savunma sekmesi:** Taktik geri çekilme satırı (`EscapeReadout`): kendi eşiğin ve kalkış yakıtı; yakıt yetmiyorsa uyarı (sarı, tehdit değil).
- **Kabul:** Dört durum görsel olarak ayrışır · eksik fiyat asla kesilmez · kuyruk iptali Confirm açar.

#### E6 · Savaş raporu

- **Bileşen:** B15. Eylemler: İzle (mevcut tekrar oynatma varsa), Klana paylaş, Yeniden saldır (dosyaya gider).
- **Kabul:** Kural 15'e tam uyum · koloni hedefinde sadakat kuralı satırı.

#### E7 · İstihbarat

- **Segmentler:** Gözlem (teleskop rafı `telescopeSlots`, izleme satırları B7, işaretli rakipler) · Raporlar (sonda + savaş, bugünkü iki sekme) · Radar (son 24 sa zaman çizgisi + liste, `radarLog`).
- **Fırsat:** AWAY durumundaki izlenen komutan "Pencere" çipiyle; süre yalnız tam netlikte (`etaMinutes`).
- **Kabul:** İzleme satırında gemi sayısı yok · netlik çubukları durumla eşleşir.

#### E8 · Araştırma takımyıldızı

- **Türetme:** Gruplar `ResearchPanel` `GROUPED`'dan, çizgiler `RESEARCH_PROJECTS[*].prerequisite`'ten. Grup dışı önkoşul düğümün altında "← ad". Stratejik grup bayrağa göre gizli ya da soluk.
- **Düğüm:** Parlaklık = seviye / en yüksek; 0 = içi boş; kilitli (önkoşul, zaman, Çekirdek) = soluk + kilit.
- **Seçili kart:** Ad, seviye → sonraki, etki (mevcut metin), önkoşul, açtığı gemiler (`HULLS[*].requiredResearch`), fiyat, süre, Araştır. Araştırma hattı (3 yuva) görünür.
- **Kabul:** 16 düğüm · çizgiler önkoşullarla birebir · hiçbir etiket üst üste binmez (görsel).

#### E9 · Klan savaş odası

- **Veri:** `ClanWarPanel`'in mevcut verisi: operasyon (hedef, toplanma, bitiş), dalgalar (oyuncu, durum, ETA), koltuklar, klan hangarı, katkılar.
- **Görünüm:** Toplanmadan hedefe hat üzerinde dalgalar · beş koltuk katkı çubuklarıyla · klan hangarı · "Dalga gönder" → B14 (klan dalgası türü, otomatik teklif) · kendi dalganda geri çağır.
- **Kabul:** "Hesapla" butonu yok · başlatma engelleri görünür metinle.

#### E10 · Sen yokken

- **Eski hatalar:** (1) Sekme yeniden yüklenince neredeyse her dönüşte çıkıyordu; (2) girişi bloke ediyordu; (3) metinler İngilizce sabitti.
- **Tetik:** Galaksinin ilk karesinden sonra istenir (bloke etmez). Yalnız `awayMinutes` ≥ eşik (öneri 30 dk) ve en az bir durum dışı giriş varsa açılır.
- **İçerik:** En fazla 3 satır: önce alarm (`isAlarming`), sonra kazanç, sonra fırsat; her satırda tek eylem. "Tümü (N)" zil sayfasını açar. Depo ya da sadakat uyarısı altta tek satır.
- **Kapatma:** `lastSeenAt` GET'te değil, kapatma onayında (POST) ilerler. Yerelleştirme istemcide: sunucu tür + parametre döner (S3).
- **Kabul:** Eşik altında açılmaz · aynı yokluk için ikinci kez açılmaz · GET `lastSeenAt`'i değiştirmez · 5 dilde metin · giriş akışını geciktirmez.

#### E11 · Masaüstü

- **≥1100 px:** Üç sütun: sol 260 px taslak (Dünyalar, Havada, Kuyruk), orta galaksi, sağ 320 px bağlam/dosya. Dock yerine üstte sekme çubuğu. Sayfalar sağ sütunda ya da ortada en fazla 720 px.
- **700–1099 px:** İki sütun: galaksi + sağ panel.
- **Kurallar:** Raster görseller doğal boyutunun üstüne büyütülmez. Klavye: 1–5 sekmeler, Space seçiliye odaklanır, Esc kapatır.
- **Kabul:** 1280 ve 1920 px'te görsel doğrulama · hiçbir resim doğal boyutunu aşmaz.

Devir · Sunucu işleri

## Tasarımın gerektirdiği sunucu ve veri işleri

| # | İş | Neden | Yer | Önce yazılacak test |
|---|---|---|---|---|
| S1 | Pending thread'e `pace` alanı | Filo satırında hız etiketi | server pending projeksiyonu (`missions.pace` zaten var) + web `pendingThread` şeması | Sözleşme: %50 hızla atılan saldırının pending kaydı `pace: 0.5` döner |
| S2 | Saldırı geri çağırma uç noktası (K8'e bağlı) | Sahip kararı | `services/movement.ts` `recallTransfer` genelleştirilir; saldırının savaş zamanlaması iptal edilir; trafik ve radar dönüşü gösterir | Varıştan önce kabul · ikinci kez red · varıştan sonra red · dönüş = uçulan süre · yakıt iadesi yok · hedefte savaş kaydı oluşmaz |
| S3 | Dönüş özeti: tür + parametre, yan etkisiz GET, onayla ilerleme | E10'un üç eski hatası | `services/session.ts`, `routes/session.ts` | GET `lastSeenAt`'i değiştirmez · POST ilerletir · girişler metin değil tür + parametre |
| S4 | Rapor görünümüne ödenen yakıt | Bilanço satırı | `services/reports.ts` `viewOf` (`missions.fuel_paid` kalkışta yazılıyor) | Rapor, o saldırının kalkışta ödenen yakıtını döner |
| S5 | Kütle sınıfı metinleri | Tehdit kartı "Ağır kütle" | `locales/*` (yeni anahtar) | 5 dilde anahtar mevcut |

Devir · Varlıklar

## Sanat, yazı tipi ve ses

### İkonlar

Başlangıç noktası bu sayfanın SVG sembolleri: `i-*` arayüz glifleri, `c-*` sınıf amblemleri, `m-*` harita işaretleri. Kurallar: 24 px ızgara, 1,75 çizgi, yuvarlak uç, `currentColor`, dolgu yok (amblemler hariç). `ui/icons/index.tsx`'e React bileşeni olarak taşınır; aynı işi gören mevcut ikonun yerini alır, yeni aile açılmaz.

### Yazı tipi (K3 onaylanırsa)

Archivo, genişlik ekseniyle (62–125). `@fontsource-variable/archivo` paketinin genişlik eksenini içerip içermediği kontrol edilmeli; içermiyorsa font dosyası kendin barındırılır. IBM Plex Mono zaten kurulu (`@fontsource/ibm-plex-mono`). İkisi de OFL lisanslı. Türkçe karakterler iki yazı tipinde de var.

### Gezegenler: PNG mi 3D mi? (K7)

**Güncelleme 23 Eylül:** sahip 16 gezegen için 3D model sağladı: `apps/web/public/assets/models/planets/defaults/planet_1..16.glb`. Her biri tek mesh, ~10.400 üçgen, **Draco** sıkıştırmalı, üç WebP doku (renk, normal, pürüzlülük; 1024 px). Projenin yükleyicisi meshopt kullanıyor ve Draco kapalı (`useGLTF(path, false)`, `facing.ts`); Draco çözücüsünü CDN'den çekmek CSP'ye takılır. Uygulama: modeller `tools/models.mjs` hattıyla meshopt'a çevrilir, ~1.500 üçgenlik düşük LOD üretilir; uzakta PNG billboard, Sektör'de yakın gezegenler düşük LOD, odak ve Yörünge'de tam model. Aşağıdaki doku haritası önerisi bu modellerle karşılandı.

**Önerim: galakside 3D, arayüz kartlarında 2D.** Bugünkü 16 PNG ışığı içine gömülü birer render; kodun kendi notu da bunları küreye sarmanın gömülü ışıkla çatışacağını söylüyor. Bu yüzden 3D için yeni kaynak gerekir, mevcut PNG'ler kullanılamaz.

- **Neden 3D:** ışık sahnedeki kaynaktan (galaktik çekirdek) gelir, gündüz/gece sınırı her gezegende tutarlı olur; gezegenler kendi ekseninde yavaşça döner, sahne "canlı" görünür; Yörünge ölçeğinde yakın plan mümkün olur. Skin'ler zaten 3D olduğu için billboard ile 3D'nin aynı sahnede karışması da biter.
- **Kaynak:** 16 görünüm için eşdikdörtgen (equirectangular) renk haritası, 2:1 (usta 4096×2048; web 2048×1024 ve 1024×512). İsteğe bağlı normal ve pürüzlülük haritası, alfa bulut katmanı. Blender'da üretilir; aynı ustadan 2D küçük resimler de render edilir, böylece kart ile sahne aynı gezegeni gösterir.
- **Sıkıştırma:** KTX2/Basis. Sıkıştırmasız 16 × 2048×1024 RGBA yaklaşık 128 MB GPU belleği eder; telefonda kabul edilemez.
- **Çizim:** tek küre geometrisi; doku başına bir instanced mesh (bugünkü 16 draw call ile aynı bütçe). Shader: tek yönlü ışık + terminator, fresnel atmosfer kenarı, id'den türeyen dönüş fazı.
- **LOD:** Galaksi ölçeğinde nokta; Sektör'de 1024 dokulu küre; Yörünge ve odakta 2048 + bulut + normal, tembel yüklenir.
- **Güvenlik ağı:** doku yüklenemezse `SkinAssetBoundary` gibi PNG billboard'a düşer.
- **Alternatif:** dokusuz, gürültü tabanlı prosedürel gezegen shader'ı. Varlık maliyeti sıfır ve sonsuz çeşitlilik; ama sanat yönetimi zor ve mevcut görünümü birebir tutturmak güç. Önerim doku haritası.

### Rapor sahnesi

Üç sonuç × iki taraf için arka plan: hedef gezegenin render'ı + mevcut prosedürel ateş ve duman (`galaxy/vfx.ts`). Ek sanat varlığı şart değil.

### Ses

Bugün yalnız müzik var (`lib/music.ts`). Gerekenler: fırlatma, varış, toplama (kristal çınlaması), tek ve ayırt edilir saldırı alarmı, arayüz tıklaması, basılı tut dolumu.

Devir · Uygulama planı

## Fazlar, bağımlılıklar ve önce yazılacak testler

Sıra döngüdeki ağırlığa göre: oyuncunun her oturumda gördüğü yüzeyler önce. Her faz kendi başına yayınlanabilir; bir faz bitmeden sonrakine geçilmez.

1. **Faz 0 · Hatalar** H1–H5. Tasarım kararı gerektirmez. Testler: [Hatalar](#hatalar) tablosunun son sütunu.
2. **Faz 1 · Token'lar ve kit** Önkoşul: K2, K3. Yeni `@theme` token'ları; koruyucu testlerin yeni kurallara göre yeniden yazımı; yazı tipi; ikon seti; B7, B8, B9, B12 ve B5'in görsel hâli. Kabul: `pnpm verify` yeşil; mevcut ekranlar yeni token'larla bozulmadan görünür (`visual.mjs` öncesi/sonrası).
3. **Faz 2 · HUD** Önkoşul: K1, Faz 1. B1–B4; `DiscControls`, `SensorToggles`, sohbet/kronik düğmeleri, `SituationGuide` ve `PendingStrip` kalkar; her yüzey [Bilgi mimarisi](#mimari) tablosundaki yerine taşınır. Kabul: tablodaki her satır için "≤2 dokunuşla ulaşılır" testi; 350 px'te çakışma yok.
4. **Faz 3 · Dosya, Fırlatma, Filo** Önkoşul: K4, Faz 2. E2, E3, E4; B10, B11, B14; S1. Saldırı geri çağırma UI'ı S2 ile birlikte (K8 ayrıntısı gelince).
5. **Faz 4 · Üs** Önkoşul: K6, Faz 2. E5; B12, B13. 3D olmadan, mevcut render'larla başlar.
6. **Faz 5 · Rapor ve Sen yokken** Önkoşul: K5. E6, E10; B15; S3, S4.
7. **Faz 6 · İstihbarat, Araştırma, Klan** Önkoşul: K9, K11. E7, E8, E9; H3'ün kalıcı çözümü B14 ile.
8. **Faz 7 · Masaüstü** Önkoşul: K10. E11.
9. **Faz 8 · 3D gezegenler** Önkoşul: K7 ve varlık üretimi. Diğer fazlardan bağımsız, paralel yürüyebilir.

**Bağımlılıklar:** Faz 1 hepsinin önkoşulu. Faz 2, Faz 3, 4 ve 6'nın önkoşulu. S2 olmadan saldırı geri çağırma UI'ı yapılmaz. Karar reddedilirse ilgili faz, o kararın "bugün" sütunuyla devam eder.

Devir · Açık sorular

## Sahibe sorulacaklar

23 Eylül: sahip karar defterini tamamen onayladı; aşağıdaki sorular onaylanan önerilerle kapandı (saldırı geri çağırma kuralı K8 satırında). Yeni sorular çıktıkça buraya eklenir.

1. **Saldırı geri çağırma (K8)** Bir kez mi? Dönüş uçulan süre kadar mı? Varıştan önceki son kaç dakika kilitli? Savunanın radarı dönüşü görür mü? Geri çağrılan saldırı tekrar saldırı sınırına sayılır mı?
2. **Dock (K1)** Sekmeler ve sıraları onaylı mı? Sohbet ve Kronik zil sayfasına taşınsın mı?
3. **Rakip işaretleri (K2)** Beş renk mi kalsın, tek renk + numara mı olsun?
4. **Yazı boyutu (K3)** "Büyük yazı yok" talimatına rağmen gövde 12 → 13 px olabilir mi?
5. **Basılı tut (K4)** Yalnız fırlatma ve Ölüm Yıldızı mı? Satın almalar dahil mi?
6. **Sen yokken (K5)** Eşik 30 dk uygun mu? En fazla 3 satır yeterli mi?
7. **Araştırma (K6, K9)** Üs'ün altında segment mi, ayrı yüzey mi? Takımyıldız mı, liste mi?
8. **3D gezegenler (K7)** Doku haritalarını kim üretecek? Prosedürel shader alternatifi değerlendirilsin mi?
9. **Masaüstü (K10)** Kırılım noktaları 700 ve 1100 px uygun mu?
10. **Bilgi yaşı (K11)** 1 / 6 / 24 saat eşikleri uygun mu?

Devir · Sözlük

## Terimler

| Terim | Anlam |
|---|---|
| Kanat | Bir saldırıya gönderilen savaş gemileri (`wing`) |
| Duvar | Hedefteki savunma: gemiler + yer topları + Aegis (`wall`) |
| Bant | Sondanın verdiği tahmini aralık (`fuzzBand`) |
| Temizler / kırar | `forecastLines` eşikleri: `clears` altı KESİN, `breaks` altı en az KISMİ |
| Kademe | `coreTier = ceil(Çekirdek / 3)`; saldırı bandı ±1 kademe |
| Netlik | Teleskop − Perde; tam, berrak, kesikli, bozuk, kör |
| Yaş | Bir bilginin ölçüldüğü andan bu yana geçen süre |
| Kütle | Radar silueti: hafif, orta, ağır (`massClass`) |
| Sınıflar | Akıncı (SKIRMISHER) › Sur (BULWARK) › Mızrak (LANCE) › Akıncı; Destek (SUPPORT) silahsız |
| Havuz (Works) | Üretimin biriktiği ve oyuncunun topladığı yer |
| Hâkimiyet | Sıralama puanı (Dominion) |
| Bağlam yuvası | Ekrandaki tek kart alanı (B3) |
| Şimdi hattı | Üst çubuğun altındaki en acil zamanlayıcı (B2) |
| Dosya | Bir hedefin yarım/tam sayfa ayrıntısı (E2) |
| Fırlatma bileşeni | Tüm gönderimlerin ortak ekranı (B14) |

Mockup'lardaki komutan adları, gezegen adları ve sayılar örnektir; kurallar Devir bölümündeki "Doğrulanmış kurallar" tablosundadır. Gemi, bina ve araştırma adları oyunun kendi Türkçe adları, görseller oyunun kendi render'larıdır. Kod durumu: 23 Eylül 2026, master 5b45cbf + commit'lenmemiş çalışma alanı.
