# Astera ölçekleme planı — anlaşılır anlatım

27 Ekim 2026. Bu belge `docs/scaling-architecture-plan-2026-10-27.md` planının sade anlatımıdır. Kod satırları,
test listeleri ve ayrıntılar ana planda. İkisi çelişirse ana plan ve kod geçerlidir.

---

## 1. Tek paragrafta

Oyun bugün tek server'da çalışıyor ve az oyuncuyla sorunsuz. 1.000 eşzamanlı oyuncuya çıkınca bazı yerler
gereksiz yere çok iş yapıyor. Örnekler: her canlı mesajda bir database query'si, her 5 saniyede bir trafik
request'i, tek bir ekran için 113 query. Plan sırasıyla şunları yapıyor:

1. Önce ölçüyor ve backup'ı güvenceye alıyor.
2. Gereksiz işi kaldırıyor.
3. Canlı veriyi polling yerine push ile gönderiyor.
4. Database'i ayrı server'a ve canlı kopyalı yapıya taşıyor.

Database (PostgreSQL) her zaman tek doğru kaynak olarak kalıyor. Oyun kuralları değişmiyor.

**Planın hedefi:** galaksileri 5.000 koltuğa çıkarmak değil. Koltuk artırılırsa yapının bunu kaldıracağını
plan sonunda kanıtlamak. Kanıt, 5.000 koltuklu bir test galaksisiyle yapılan yük testi (FR fazı).

---

## 2. Terimler

| Terim | Bu belgedeki anlamı |
|---|---|
| **commit** | Bir işlemin database'e kalıcı yazılması. "Filo gönderildi" ancak commit olunca gerçektir |
| **transaction** | Ya hepsi ya hiçbiri yapılan yazma grubu. Yarım kalırsa hiçbiri olmamış sayılır |
| **lock** | Aynı dünyayı aynı anda iki işlemin değiştirmesini engeller; ikinci işlem bekler |
| **worker** | Zamanı gelen olayları (filo varışı, inşa bitişi) çözen arka plan süreci |
| **SSE** | Server'ın açık bağlantıdan istemciye anlık mesaj göndermesi. Bugün yalnız "bir şey oldu" diyor |
| **polling** | İstemcinin aralıklarla "yeni bir şey var mı" diye sorması. Trafik bugün 5 sn'de bir soruluyor |
| **push** | Server'ın değişikliği sorulmadan, kendiliğinden göndermesi |
| **cache** | Sık okunan verinin bellekte tutulması; database'e tekrar gidilmez |
| **index** | Database'in aradığı satırı tabloyu baştan sona taramadan bulmasını sağlar |
| **fog** | Oyuncunun yalnız görmeye hakkı olanı görmesi (sensör menzili, keşif) |
| **standby** | Database'in canlı kopyası. Ana server çökerse yerine geçer |
| **WAL arşivi / PITR** | Database'deki her değişikliğin server dışına sürekli kaydedilmesi; istenen ana geri dönebilmek |
| **RPO / RTO** | RPO: bir çökmede kaybedilebilecek en fazla veri (süre olarak). RTO: oyunun geri gelme süresi |
| **seq** | Bir galaksideki her commit'e verilen sıra numarası. İstemci "en son 1.204'ü gördüm, oradan devam" diyebilir |
| **head** | Bu sıra numarasını veren tek sayaç |
| **NOTIFY** | PostgreSQL'in diğer süreçlere "şu oldu" sinyali göndermesi |
| **flush / fsync** | Yazının diske gerçekten işlenmesi. Commit'in en yavaş adımıdır |
| **lease** | Bir işi belirli süre için tek bir sürecin üstlenmesi. Süreç ölürse süre dolar, başkası devralır |
| **idempotency** | Aynı komut iki kez gelse de bir kez uygulanması (zayıf mobil bağlantıda çift saldırı olmaz) |
| **lazy tick** | Dünyanın üretiminin her dokunulduğunda "şu ana kadar" hesaplanması |
| **p95** | Request'lerin %95'i bu süreden hızlı |
| **CP (CAP teorisi)** | Ağ sorunu olduğunda tutarlılığı seçmek: emin olunamıyorsa komut reddedilir |

---

## 3. Hedef ve öncelikler

- **Şimdi:** tek galaksi, 1.000 eşzamanlı oyuncu.
- **Hazırlık hedefi:** galaksi başına 5.000 kayıtlı / 1.000 çevrimiçi. Plan koltukları artırmaz; artırılırsa
  yapının kaldıracağını kanıtlar.
- **Gelecek:** 5 galaksi; toplam 25.000 kayıtlı, 5.000 çevrimiçi. Yapı buna hazır kurulur, ikinci galaksi
  açılırken tamamlanır.
- **Öncelik sırası:**
  1. Veri tutarlılığı: çift harcama, kaybolan filo ve fog sızıntısı asla olmaz.
  2. Düşük gecikme.
  3. Maliyet.

**Neden tutarlılık önce?** Oyunun bahsi gezegen ve filo. Birkaç saniye beklemek oyuncuya ucuza gelir,
tutarsızlık ise kalıcıdır. Bu yüzden database'e ulaşılamazsa komut reddedilir; "şimdilik kabul edelim, sonra
düzeltiriz" denmez.

**Hedef süreler (tek galaksi, 1.000 oyuncu):**

| Ne | Bugün | Hedef |
|---|---|---|
| Komutun cevabı | ölçülmedi | p95 ≤120 ms |
| Ekran verisi (gezegen listesi vb.) | p95 424–794 ms | p95 ≤200 ms |
| Bir değişikliğin başka oyuncunun ekranına gelmesi | 0,5–1,5 sn | p95 ≤150 ms |
| Görüş alanına giren filonun görünmesi | 0–5 sn | p95 ≤150 ms |
| Worker'ın olayı geç işlemesi | ortalama ~500 ms | p95 ≤100 ms |
| Çökmede veri kaybı (RPO) | 24 saate kadar | önce ≤60 sn, sonra 0 |
| Çökme sonrası geri gelme (RTO) | tanımsız | önce ≤60 dk, sonra ≤15 dk |

---

## 4. Bugün sistem nasıl çalışıyor

1. Oyuncu bir komut gönderir (ör. saldırı). API bir transaction açar, ilgili dünyaları lock'lar, kuralı
   uygular, yazar ve commit eder.
2. Transaction'ın içinde NOTIFY ile "şu oldu" sinyali gönderilir.
3. SSE bağlantısı açık istemcilere "bir şey oldu" mesajı gider. İstemci ilgili ekranı baştan request eder.
4. Uçan filolar (trafik) ayrıca 5 sn'de bir polling ile sorulur.
5. Worker saniyede bir "zamanı gelen olay var mı" diye bakar ve olayları çözer.

**Sağlam olan ve korunanlar:** kural paketi, lock sırası, idempotent işlemler, fog fonksiyonları, istemcideki
tahmin ve düzeltme.

---

## 5. 1.000 oyuncuda nerede sorun çıkar

### Çevrimiçi oyuncu sayısıyla büyüyen sorunlar

| Sorun | Basitçe | Çözüm (faz) |
|---|---|---|
| Her SSE mesajında database query'si | 1.000 alıcı × saniyede ~10 olay = saniyede 10.000 gereksiz query | Yetki bilgisi bellekte tutulur; yetki iptal edilirse database haber verir (F1) |
| Olay veri taşımıyor | Her olayda istemciler ekranı baştan request ediyor | Mesaj değişikliğin kendisini taşır (F3) |
| Trafik polling'i | Görüş alanına giren filo ancak bu 5 sn'lik soruyla yakalanıyor. 1.000 oyuncuda saniyede 200 request | Server filonun görüşe gireceği anı hesaplar ve tam o an gönderir (F3) |
| Cache galaksiye göre ayrılmamış | Bir galaksideki olay herkesin cache'ini siliyor; 1.024 hesap sınırında hepsi sıfırlanıyor. Bugün de ana sezon ve 735 kişilik bekleme odası var | Cache galaksi anahtarlı olur (F1) |
| `/api/galaxy` 6 slotluk ayrı bir havuzda sırada | 1.000 oyuncuda bu endpoint tek başına ~3 slot dolduruyor | Önce ölç ve havuzu büyüt (F1), sonra ayrı havuzu kaldır (F2) |
| Worker saniyede bir bakıyor | Olaylar ortalama yarım saniye geç işleniyor | Bir sonraki olayın tam anında uyanır (F1) |
| Gezegen listesi 4 dünya için 113 query | Database ayrı server'a geçince her query'ye ağ gecikmesi eklenir | Toplu okuma, ≤30 query. Database taşınmadan önce şart (F1) |
| Backup aynı server'da, günde bir | Disk giderse 24 saatlik veri kaybolur | Sürekli WAL arşivi (F0) |
| Hesap başına SSE sınırı yok | Tek hesap çok bağlantı açıp yükü katlayabilir | En fazla 3 bağlantı (F1) |

### Kayıtlı oyuncu sayısıyla büyüyenler (FR fazında düzeltilir)

- **Honor:** her saldırıda bütün oyuncu listesini kaydediyor ve her savaşta bütün toplamları yeniden yazıyor.
- **Sezon kapanışı:** bütün dünyaları tek transaction'da işliyor; 5.000 dünyada galaksi dakikalarca lock'ta kalır.
- **Galaksi haritası verisi:** dünya sayısıyla büyüyor, hem server'da hem telefonda.
- **Galaksi olayı bildirimleri:** her oyuncuya ayrı satır yazılıyor; bildirimlerin %72'si bunlar.
- **Harita geometrisi:** bugünkü geometri 1.000 koltuk için. 5.000 koltuk için yeni harita bir ürün kararı (K6).

---

## 6. Ne ölçtük, ne çıktı

Ölçümler yerelde izole bir PostgreSQL'de ve 26 Ekim prod kopyasında yapıldı.

- **Commit hızı:** bugünkü yol (transaction içinde NOTIFY) ile planlanan yeni sıra sayacı aynı hızda. Bu
  bilgisayarda saniyede ~250–1.000 commit; lock'suz aynı iş 2.300–13.000. Sınırı disk belirliyor. 1.000
  oyuncunun ihtiyacı saniyede ~15–75 commit, yani yeterli. Yeni database server'ı hızlı diskli seçilmeli.
- **Yeni sıra sayacı doğru çalışıyor:** 34.719 commit'te hiç boşluk ya da tutarsız okuma çıkmadı.
- **Gerçek oyuncu davranışı:** aktif oyuncu saatte 12–20 komut gönderiyor; plan 120 varsaymıştı. Yaklaşık 5
  kat pay var.
- **Honor:** bugün savaş başına 1,4 ms, 1.000 oyuncuda tahminen ~5–8 ms. Acil değil.
- **Bildirimler:** database'in %36'sı; bunun %72'si galaksi olayı duyurusu.
- **Kaynak değerleri:** en yüksek kaynak 156.639; mevcut sayı tipi yeterli (K9). Negatif kaynak veya birim
  yok, yani "eksiye düşemez" kuralları database'e eklenebilir.

**Ölçemediklerimiz ve beklediğimiz sonuç:**

| Ne | Beklenen | Ne zaman ölçülür |
|---|---|---|
| Prod disk hızı | Hızlı diskte saniyede ~400–1.500 commit, sıradan diskte ~150–400. İkisi de yeter, ikincisinde pay az | F0 |
| Fog/trafik hesabının CPU maliyeti | Oyuncu başına 0,5–3 ms. Bu yüzden her değişiklikte herkesi baştan hesaplamak olmaz; yalnız değişen filo ve etkilenen oyuncular hesaplanır | F0 |
| Sezon kapanış süresi | 1.000 dünyada 5–20 sn | F0 |
| 1.000 oyunculu gerçek yük testi | İlk darboğaz büyük ihtimalle `/api/galaxy` havuzu, ardından SSE query'leri | F0 |

---

## 7. Hedef yapı

```
Oyuncu ──► Nginx ──► API (3 süreç) ──► PostgreSQL (ana) ──► Standby (canlı kopya)
                       ▲                   │
                       └── SSE ◄── sıra numaralı değişiklik akışı (seq)
Worker (aktif + yedek) ──► PostgreSQL
WAL arşivi ──► server dışı depolama
```

- **PostgreSQL tek doğru kaynak.** Redis/Valkey yalnız cache ve rate-limit için; gerçek veri tutmaz.
- **Her galaksinin kendi değişiklik akışı var.** Commit edilen her işlem sıradaki numarayı (seq) alır.
  İstemci koparsa "1.204'ten devam" der; hiçbir değişiklik atlanmaz.
- **Komut tek transaction'dır:** lock → kural → yazma → akış kaydı → commit.
- **Canlı veri:** server ortak veriyi bir kez hazırlar, her oyuncu için fog filtresinden geçirir ve yalnız
  farkı gönderir.
- **Worker:** biri aktif, biri yedek. Aktif ölürse yedek ~15 sn'de devralır (bugün 5 dk).
- **Database:** ayrı server'da ve canlı kopyalı (standby). Her commit kopyaya da yazılır, veri kaybı 0 olur.
- **Standby düşerse oyun durmaz (K3):** 10 sn bekler, kopyasız devam eder ve alarm verir.

---

## 8. Fazlar

```
F0 ──► F1 ──► F2 ──► F3
        ├──► F4a (yedek worker)
        └──► F5  (altyapı; F1'deki toplu okumadan sonra)
F3 + F4a ──► FR (5.000 koltuk hazırlığı)
Gelecek: F4b + F6 (ikinci galaksi) · F7 yalnız ölçüm gerektirirse
```

### F0 — Ölçüm ve backup (1–2 hafta)

- **Ne:** sürekli backup (WAL arşivi) ve geri yükleme provası; bakım modu (bakım ekranı + 24 saat önceden duyuru); request başına query sayısı ve süre ölçümü;
  izleme panosu ve alarm; yük testi aracını güncelleme; prod disk hızını ölçme; query'lere zaman sınırı.
- **Neden:** körlemesine optimizasyon yapmamak ve 24 saatlik veri kaybı riskini 60 sn'ye indirmek.
- **Bitti sayılır:** geri yükleme provası başarılı, panolar çalışıyor, ilk yük testi raporu hazır.

### F1 — Gereksiz işi kaldırmak (3–5 hafta)

Protokol değişmez; eski APK etkilenmez.

- **Ne:**
  - SSE'de mesaj başına query kalkar.
  - Cache galaksi anahtarlı olur.
  - Worker tam zamanında uyanır.
  - Gezegen listesi toplu okunur.
  - Galaksi ekranı cache'lenir.
  - Bildirim listesine index eklenir (128 kat hızlı).
  - Rapor listesi ve podium query'leri düzelir.
  - Gereksiz istemci yenilemeleri ve sohbet "okundu" yazmaları kalkar.
- **Bitti sayılır:** 1.000 oyunculu testte SSE mesajı başına 0 query, ekran p95 ≤200 ms, komut p95 ≤120 ms,
  worker gecikmesi ≤100 ms, doğruluk kontrollerinde sıfır hata.

### F2 — Sıra numaralı değişiklik akışı (3–4 hafta)

- **Ne:**
  - Her commit bir sıra numarası alır ve bir tabloya kaydedilir.
  - NOTIFY transaction'ın içinden çıkar.
  - Aynı komut iki kez gelirse bir kez uygulanır (idempotency).
  - Database'e "kaynak eksiye düşemez" gibi kurallar eklenir.
- **Neden:** canlı push'un temeli bu; kopma sonrasında kayıpsız devam etmeyi sağlar.
- **Dikkat:** bu adım hız kazandırmaz (ölçüldü). Kazandırdığı doğruluk ve devamlılıktır.
- **Bitti sayılır:** eski ve yeni sinyaller 24 saat boyunca birebir aynı.

### F3 — Canlı veri push (5–7 hafta)

- **Ne:**
  - SSE değişikliğin kendisini taşır; trafik polling'i kalkar.
  - Görüş alanına giriş tam anında gelir.
  - Sohbet, olaylar ve galaksi haritası da push ile gelir.
  - Bağlantı koptuğunda küçük bir "bağlantı yeniden kuruluyor" göstergesi çıkar (6 dil).
- **En kritik test:** push ile gelen görüntü, aynı anda REST'ten istenen görüntüyle birebir aynı olmalı;
  böylece fog sızıntısı olmadığı kanıtlanır.
- **Bitti sayılır:** trafik request'leri %90 azalır, görüşe giriş ≤150 ms, eski APK bozulmaz.

### F4a — Yedek worker (2 hafta; F1'den sonra, F2–F3 ile paralel)

- Worker'ı lease ile tek sahibe bağlamak. Sahip ölürse 15 sn'de devralınır; eski sahibin geç gelen yazısı
  reddedilir.
- Sezon kapanışını parçalara bölmek: önce sezon dondurulur, sonra parça parça işlenir.

### F5 — Altyapı (3–4 hafta; F1'deki toplu okumadan sonra, paralel)

- Database ayrı server'a taşınır.
- Standby ve "standby düşerse kopyasız devam et" bekçisi kurulur.
- Nginx'te SSE ve REST ayrılır.
- Failover ve geri yükleme provaları yapılır.
- Veri büyümesine karşı bakım yapılır (index'ler, temizlik).
- **Not:** önce toplu okuma (F1) bitmeli; yoksa ağ gecikmesi her query'ye eklenir.

### FR — 5.000 koltuk hazırlığı (4–6 hafta; F3–F5 ile paralel)

- **Ne:** kayıtlı oyuncu sayısıyla büyüyen işler düzeltilir:
  - Honor verisi tablolara bölünür; her savaşta bütün oyuncular yazılmaz.
  - Sezon kapanışı parçalara bölünür (önce dondur, sonra parça parça).
  - Galaksi olayı bildirimi her oyuncuya ayrı satır olmaktan çıkar.
  - Galaksi haritası verisi bir kez hazırlanır; telefonda 5.000 dünyalık harita akıcı çizilir.
  - Oyuncu silme hızlanır; korsan/asteroit hesapları ve veri büyümesi 5.000 koltukla doğrulanır.
- **Bitti sayılır:** yalnız test için kurulan 5.000 koltuklu bir galaksiyle yük testi: 1.000 çevrimiçi +
  4.000 çevrimdışı oyuncu, filoları uçuşta. Hedef süreler 1.000 koltuktakiyle aynı kalır, doğruluk
  kontrollerinde sıfır hata çıkar. Test galaksisinin haritası oyuna girmez.

### F4b + F6 — Gelecek: ikinci galaksi açılırken (+3–4 hafta)

- Worker'lar galaksileri paylaşır.
- İkinci app server'ı eklenir.
- Valkey ortak cache'i zorunlu olur (5 galaksi × süreç sayısı yüzünden).

### F7 — Yalnız ölçüm gerektirirse

- **Commit hızı sınırın yarısını geçerse:** değişiklik akışı farklı bir yöntemle okunur (logical decoding).
- **Database CPU'su sürekli %70'in üstündeyse:** database galaksilere göre bölünür.
- **Worker'da olay birikiyorsa:** galaksi içinde paralel şeritler açılır.

**Toplam süre:** tek galaksi ve 5.000 koltuk hazırlığı için ~5–6 ay.

---

## 9. İlk sprint (sırayla)

1. **Sürekli backup (WAL arşivi).** Aynı kısa restart'ta query istatistiği de açılır. En büyük risk veri
   kaybı ve kod gerektirmiyor.
2. **Query sayacı + izleme ve alarm.** Sonraki her işin etkisini görmek için.
3. **Bildirim index'i.** Ölçülmüş 128 kat hız, küçük iş.
4. **SSE'de mesaj başına query'yi kaldırmak** ve hesap başına bağlantı sınırı koymak.
5. **Cache'i galaksiye göre ayırmak.** Bekleme odası yüzünden bugün de gerekli.
6. **Worker'ın tam zamanında uyanması.**
7. **Gezegen listesini toplu okumak.**
8. **Galaksi ekranı cache'i,** rapor/podium query'leri, gereksiz istemci yenilemeleri, sohbet "okundu" işareti.
9. **`/api/galaxy` havuzunu ölçüp** gerekirse büyütmek.
10. **Yük testi aracını güncellemek.**
11. **Prod disk hızı** ve diğer ölçümler.
12. **Taban yük testi:** F1'den önceki kod sürümüyle.

**Sprint sonunda:**
- veri kaybı riski ≤60 sn,
- okumalar hızlanmış,
- SSE query'leri kalkmış,
- worker gecikmesi ~500 ms'den ~10 ms'ye inmiş.

Oyun kuralı değişmez.

---

## 10. Database: ne cache'lenir, ne hızlandırılır

**Temel kural:** komut kararları asla cache'ten verilmez; her zaman database'de ve lock altında verilir.

- **Cache'lenecek:**
  - kimlik ve yetki bilgisi,
  - sezon kuralları,
  - galaksi ekranının yardımcı verileri (podium, anıt, radyasyon),
  - araştırma keşfi,
  - ortak trafik verisi,
  - herkese açık galaksi haritası (bir kez hazırlanır, herkese aynısı gider),
  - sohbetin son mesajları.
- **Cache'lenmeyecek:**
  - oyuncunun gezegeni: her an değişiyor,
  - bildirim ve rapor sayfaları: önce query'leri düzeltilecek.

**Hızlandırılacak query'ler:**

| Ne | Bugün | Hedef |
|---|---|---|
| Bildirim listesi | 3,96 ms | 0,031 ms (yeni index) |
| Gezegen listesi | 113 query | ≤30 |
| Galaksi ekranı | ~16 query | ≤3 |
| Rapor listesi | geniş okuma | ~17 kat daha az okuma |
| Podium | bütün oyuncular okunuyor | yalnız ilk sıralar |

**Database yapısı** genel olarak sağlıklı. Eklenecekler:
- "Kaynak eksiye düşemez" gibi kurallar.
- Oyuncu silmeyi hızlandıran birkaç index.
- FR fazında: galaksi olayı bildirimini tek satırda tutmak ve Honor verisini tablolara bölmek.

---

## 11. Oyun mantığına dokunabilecek riskler ve çözümleri

1. **Aktif oyuncu sayımı.** Oyuncunun "aktif" sayılması bugün REST request'ine bağlı (dakikada bir). Trafik
   polling'i kalkınca haritaya bakan oyuncu pasif görünür. Bundan asteroit ve korsan sayısı, çevrimiçi
   sayısı ve dönüş kuyruğu etkilenir. **Çözüm:** uygulama açıkken dakikada bir küçük "buradayım" request'i.
   Test: aktif sayısı değişmemeli.
2. **Bakımda bekleyen savaşlar.** Varışlar işlendiği anda hesaplanıyor. Worker 45 dk durursa savunucu o
   sürede üretim ve inşa biriktirir, dönüşler de kayar. **Karar (K7):** bakım 24 saat önce duyurulur; duyurudan sonra
   varışı bakım saatine düşen saldırı gönderilemez. Ölçülen en uzun uçuş 14,8 saat; bu yüzden bakımda hiçbir saldırı inmez.
3. **Zaman sınırı filo kaybettirebilir.** Worker'da bir olay 5 kez hata alırsa bırakılıyor. Kısa bir zaman
   sınırı bunu tetikleyebilir. **Çözüm:** worker'a kısa zaman sınırı konmaz.
4. **Çok sekme.** Hesap başına 3 bağlantı sınırı ile istemcinin hep yeniden bağlanması birleşince 4 sekmede
   sekmeler birbirini sürekli kapatır. **Çözüm:** kapanan gizli sekme, görünür olana kadar bağlanmaz.
5. **Anıt ekranı.** Farklı bir okuma modu kullanıyor ve yeni sıra sayacıyla çakışıp hata verir. **Çözüm:**
   yazma kısmı ayrı bir işleme alınır.
6. **Sezon kapanışı.** Parçalara bölünürken sezon hâlâ açıksa sıralama karışır. **Çözüm:** önce sezon
   dondurulur, sonra parça parça işlenir.
7. **Honor lansmanı.** 3 Kasım'da açılırken Honor'u yeniden yazmak risk. **Çözüm:** lansman oturduktan sonra
   FR fazında yapılır.
8. **Worker'ın tam zamanında uyanması.** Savaşlar yarım saniye daha erken, yani gerçek anına daha yakın
   hesaplanır. Kural değişikliği değildir.
9. **Gezegen güncellemesi.** Her komutta üretim database'e yazılıyor. Akış buna tepki verirse gereksiz kayıt
   oluşur. **Çözüm:** yalnız herkesin gördüğü alanlar değişince kayıt düşülür.
10. **Varış anı geçti, savaş henüz hesaplanmadı.** Savaş, worker işlediği anda hesaplanıyor. Arada (bugün
    ortalama ~0,5 sn, saldırı dalgasında birkaç sn) sahip gemilerini transfer edip kaçırabiliyor; buna karşı
    kontrol yok. **Karar (K12, kabul edildi):** varış anı geçmiş saldırı varken o dünyadan gemi/kaynak
    çıkarma "saldırı iniyor" ile reddedilir; savaş çözülünce tekrar denenir.
11. **Yarış hataları oyuncuya genel hata olarak dönüyor.** Nadir deadlock veya lock zaman aşımında oyuncu 500
    görüyor ve istemci tekrar denemiyor. **Çözüm:** bu hatalar "tekrar dene" kodu döner; istemci aynı
    idempotency-key ile otomatik tekrar dener, çift etki olmaz.

---

## 12. Kararlar

**Verilmiş:**

- **K1 hedef:** şimdi tek galaksi; gelecekte 5 galaksi × 1.000 çevrimiçi.
- **K2:** database'in canlı kopyası (standby) olacak.
- **K3:** standby düşerse oyun durmaz.
- **K5:** yük testleri prod'da; ana oyun gece yarısı 30–60 dk bakım moduna alınır. Bakım modu bugün yok,
  F0'da yapılacak (bakım ekranı, dönüş saati, 24 saat önceden duyuru).
- **K9:** kaynak sayı tipi değişmez.
- **K10:** görülmüş bildirimler 30 gün saklanır. Bugün etkisi yok, çünkü sezon zaten 30 gün ve sonunda her
  şey siliniyor.
- **K7:** bakım 24 saat önce duyurulur; duyurudan sonra varışı bakım saatine düşen düşmanca varış (saldırı,
  klan savaşı, Death Star, radyasyon bombası, füze, korsan) oluşturulmaz. Bakım sezon sonuna ve büyük
  etkinliklere yakın konmaz. Claim, koruma ve cooldown süreleri bakımda da işler.
- **K12:** varış anı geçmiş ama henüz hesaplanmamış saldırı varken o gezegenden gemi/kaynak çıkaran komut,
  savaş çözülene kadar reddedilir.

**Senden beklenenler:**

| Karar | Soru | Önerim |
|---|---|---|
| **K11 bütçe** | Ana server dışında kaç server? | Şimdi 0 (yalnız backup depolama hizmeti). Her yük testi gecesi 1 geçici server. F5'te kalıcı olarak en az 1 (database kopyası), önerilen 2 (ayrı database server + kopyası); hangisi olacağına ilk yük testinden sonra karar verilir |
| **K4** | Eski SSE (v1) ne zaman kapansın? | F3'ten sonra karar verilir |
| **K6** | Koltuk artırılmak istenirse yeni harita | Plan koltuk artırmaz; hazırlık test galaksisiyle kanıtlanır. Karar yalnız koltuk artırılmak istenirse gerekir |
| **K8** | Arena tek oda, 100 kişi. Büyüyünce çok oda gerekir mi? | Ayrı plan |

---

## 13. Yapmayacaklarımız

| Seçenek | Neden hayır |
|---|---|
| Redis'i gerçek veri kaynağı yapmak | Çökmede veri kaybı riski |
| Mikroservis / Kubernetes | Tek geliştirici için gereksiz yük; birlikte yapılması gereken işlemler bölünür |
| Kafka | Bu ölçekte PostgreSQL yeterli |
| Oyunu WebSocket'e taşımak | REST + SSE yeterli |
| Her şeyi herkese gönderip istemcide gizlemek | Fog'u bozar |
| Otomatik failover (Patroni) | İki "ana" database oluşma riski; elle yapılan geçiş ve prova yeterli |
