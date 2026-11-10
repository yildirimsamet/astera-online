# C. Mimari Kararlar ve Alternatifler (FAZ 3)

- **Tarih:** 2026-11-05.
- **Durum:** **Kabul edildi** (owner, 2026-11-06). Ayrıntılar FAZ 4 belgelerinde (D–J).
- **Owner kararları:**
  - Genel yön uygun.
  - Y8: Geç olay `resolve_at` anının durumuna göre çözülür.
  - ADR-10: Bugünkü VPS ile devam edilir. Yazılımda gözle görülür iyileşme görülmeden sunucu değişmez. Stage için ayrı VPS de yok; aynı makinede düşük öncelikle çalışır (J).
  - Eski veritabanı kopyalarından 17 Ekim'deki silindi (2026-11-06); 19 Ekim'deki duruyor.
- **Girdiler:** [A. Denetim](A-mevcut-mimari-denetimi.md) (bulgu kodları K, Y, O), [B. Gereksinimler](B-gereksinimler-ve-sorular.md) (S yanıtları), [canlı ölçüm](canli-olcum-2026-11-05.md), yük testleri (A §10).

## Etiketler

| Etiket | Anlamı |
| --- | --- |
| **Kesin** | Kod, ölçüm veya birincil kaynak destekliyor. |
| **Hipotez** | Mantıklı, ama kazancı ölçülmeden söz verilmez. Her hipotezin yanında doğrulama ölçüsü yazılıdır. |
| **Owner** | Oyun kuralına, risk/ödüle veya bütçeye dokunuyor; owner karar verir. |

## Çerçeve: neyi optimize ediyoruz?

Öncelik sırası (owner):
1. Veri bütünlüğü.
2. Yazılımda azami performans.
3. Yazılımla yapılacak bir şey kalmayınca yatay genişleme.

Ölçülen gerçekler:
- **Bugünkü duvar, istek başına API CPU'su.** İstek başına `4,35 + 2,23 × deyim` ms harcanıyor.
- **Olay sonrası yeniden okumalar** API CPU'sunun %28'i.
- **Postgres'in payı küçük.** Analitik kurtarma işi PG süresinin %44'ü.
- **Worker** saniyede ~7–8 olayda doyar.
- **Hedef:** T2, yani 2.000 online.

## Özet

| No | Karar alanı | Önerilen | Etiket |
| --- | --- | --- | --- |
| ADR-01 | Mimari biçim | Modüler monolit ve tek PostgreSQL; galaksi ile global veri arasında sınır | Kesin |
| ADR-02 | Ölçek yolu | Yazılım → adanmış çekirdek → uygulama/DB ayrımı → galaksi grubu başına sunucu | Kesin (sıra), Owner (bütçe) |
| ADR-03 | Okuma maliyeti | Node 24; önbellek isabetinde sıfır deyim; ağır rotalarda gruplu sorgu | Hipotez |
| ADR-04 | Gerçek zamanlı yayılım | Olay başına galaksi düzeyinde tek hesap; veri taşıyan SSE ve sıra numarası | Hipotez |
| ADR-05 | Yazma yolu | Kira havuzu kalkar; yerleşim, idempotency ve kilit sırası tek komut zarfında | Kesin (yön), Hipotez (kazanç) |
| ADR-06 | Worker | Önce hijyen ve zaman aşımları, sonra galaksiye göre paralel işleme | Kesin (hijyen), Hipotez (paralel) |
| ADR-07 | Kaynak bütünlüğü | CHECK kısıtları, `double precision`, kaynak ve gemi defteri | Kesin |
| ADR-08 | Sezon geçişi ve arşiv | Geçmiş verisi önce arşive, sonra bugünkü silme; şişmeye `REINDEX CONCURRENTLY` (inceleme: `TRUNCATE` reddedildi, E §4) | Kesin (yön) |
| ADR-09 | Analitik işi | 30 günlük tarama yerine imleçli artımlı okuma; sonuç olguları için ayrı yol (inceleme, E §7) | Kesin |
| ADR-10 | Altyapı | Stage ayrılır; geri yükleme tatbikatı; ölçerek adanmış çekirdeğe geçiş | Owner (bütçe) |
| ADR-11 | Güvenlik | Rol ayrımı, rol başına sır, refresh token ailesi | Kesin |
| ADR-12 | Dağıtım | Expand-contract migration ve sırayla yeniden başlatma | Kesin |

---

## ADR-01. Mimari biçim

**Bağlam.** 89 bin satırlık tek kod tabanı, tek veritabanı, 83 dosyalık import döngüsü (Y11). İleride galaksiler ayrı sunuculara gidebilir (S2). Galaksiler arası yazma bugün yalnız başlangıç galaksisinden ana galaksiye geçişte var (S8).

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| A. Bugünkü hâl | Değişiklik yok | Sınır yok; galaksiyi başka sunucuya taşımak imkânsıza yakın |
| **B. Modüler monolit: `global` ve `galaxy` modülleri** | Tek süreç ve tek transaction korunur; ileride galaksi grubu ayrılabilir | Modül kuralını koruyacak test gerekir |
| C. Mikroservisler | Bağımsız ölçek | Dağıtık transaction, ağ gecikmesi, tek kişilik operasyona fazla yük; ölçülen darboğazı çözmez |
| D. Bellekte yetkili galaksi aktörü (oyun sunucusu modeli) | Okumada SQL yok, en yüksek performans | Tam yeniden yazım; kalıcılık ve tutarlılık yeniden kurulmalı; owner kuralı "çalışan sistemi yeniden yazma" |

**Öneri: B.**
- Galaksi modülü global tabloları yalnız dar bir arayüzle kullanır: hesap, ödeme, kozmetik, Legacy, sonuçlar.
- Galaksiler arası her işlem iki adımlı ve idempotent tasarlanır. Bugün aynı transaction'da çalışmaya devam eder.
- D, performans için en güçlü seçenek. T2'ye yazılım adımlarıyla ulaşılamazsa yeniden değerlendirilir.

**Doğrulama:** Import kuralı testi (galaksi → global yalnız arayüzden); döngü sayısı azalır.

## ADR-02. Ölçek yolu

**Bağlam.** Bugünkü maliyetle T2 için ~30–34 çekirdek gerekiyor. Raporun yazılım adımları tutarsa bu ~15–18'e iner (B, Ölçülen kapasite). Owner yatay genişlemeyi en sona koydu.

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| A. Hemen yatay | Tavan hemen kalkar | İş başına maliyet aynı kalır, para ve operasyon yükü katlanır |
| **B. Basamaklı** | Her basamak ölçülür; para yalnız yazılım tükenince harcanır | Daha uzun yol |
| C. Yönetilen bulut ve Kubernetes | Otomasyon | Contabo'nun birkaç katı fiyat; tek kişiye fazla karmaşıklık |

**Öneri: B.** Basamaklar:
1. Yazılım adımları (ADR-03, 04, 05, 06, 09) bugünkü makinede yapılır. Her adımdan sonra aynı araçla CPU/istek ölçülür.
2. Stage prod makinesinden çıkar (ADR-10).
3. Adanmış çekirdeğe geçilir; ölçümle (ADR-10).
4. Uygulama ve veritabanı iki makineye ayrılır. Gerekirse API ikinci makinede çoğalır. LISTEN/NOTIFY makineler arasında çalıştığı için yeni bileşen gerekmez.
5. Gerekirse yeni galaksiler yeni sunucuda açılır (T3). Global veri tek yerde kalır.

**Owner:** Bütçe (ADR-10).

## ADR-03. Okuma yolunun maliyeti

**Bağlam.**
- Ortalama istek 4,7 deyim atıyor. Yerleşim kontrolü tek başına API CPU'sunun %13'ü.
- Ağır rotalar 12–17 deyim atıyor.
- Drizzle tek deyimde ham sürücüden pahalı (1,38 ms ile 0,33 ms, 100/sn'de).
- Gruplu gönderim deyim başına %50–60 ucuz.
- Prod Node 22'de çalışıyor.

| Seçenek | Beklenen kazanç | Maliyet ve risk |
| --- | --- | --- |
| **A. Node 24 LTS** | AsyncLocalStorage, Node 24'te varsayılan olarak AsyncContextFrame kullanıyor; Node 22'de bayrakla −%7,2 ölçüldü | Sürüm yükseltme testi |
| **B. İsabette sıfır deyim** | Yerleşim kontrolü okumanın içine biner; oturum, komutan ve asteroit satırları bellekte, mevcut NOTIFY geçersiz kılmasıyla. Hesap: ~%20–25 | Önbellek tutarlılığı; yarış testi önce yazılır |
| **C. Ağır rotalarda tek gidiş-dönüş** | `planets`, `rewards`, `monuments`, `session/return` ≤ 5 deyim; bağımsız sorgular gruplu | Rota başına yeniden yazım |
| D. Sıcak yollarda Drizzle yerine ham `postgres.js` | Deyim başına ~1 ms | Tip güvenliği elle korunur; yalnız ölçülmüş yollarda |
| E. `--max-semi-space-size` | −%8,6 | GC duraklaması p99 85–200 ms; 16–32 MB ayrıca ölçülmeli |
| F. Başka dilde yeniden yazım | Belirsiz | Kural paketinin TypeScript olması; reddedildi |

**Öneri: A → B → C; D yalnız ölçülen sıcak yolda; E ölçülerek.** Hipotez.
**Doğrulama:** Her adımdan sonra 200 test oyuncusunda CPU/istek. Hedef: API istek başına ≤ 9 ms.

## ADR-04. Gerçek zamanlı yayılım

**Bağlam.**
- Olay geldiğinde her istemci okumaya gidiyor: isteklerin %42'si, API CPU'sunun %28'i.
- Bağlantı başına sunucu hesabı (`soon()`) daha kötü çıktı: CPU +%6, okuma p95 ×2,8.
- Boştaki SSE ucuz: 250 bağlantı 0,16 çekirdek.
- Kabul edilen hedef: başkasının hareketi ≤ 3 sn (S9).

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| A. Bugünkü "git yeniden oku" | Basit, doğru | Maliyet oyuncu × olay |
| B. Bağlantı başına sunucu hesabı | İstek azalır | Ölçüldü, daha kötü |
| **C. Olay başına tek hesap, veri taşıyan SSE** | Her API süreci olayı bir kez okur; herkese değişiklik gider; galaksi sıra numarasıyla kayıp tespit edilir, yalnız boşlukta tam okuma | Sisli veri için izleyici filtresi gerekir; istemci deltaları uygular |
| D. WebSocket ve harici aracı (Redis, NATS) | Çoklu makinede güçlü | Yeni bileşen; LISTEN/NOTIFY bugün ve iki makinede yeter |

**Öneri: C.** Taşıma SSE ve LISTEN/NOTIFY olarak kalır.
- NOTIFY yalnız olay kimliği taşır; yük sınırı 8.000 bayt.
- Olayın herkese açık kısmı süreç başına bir kez hesaplanır.
- Sisli kısım yalnız menzili olayı kapsayan izleyiciler için filtrelenir. Görüş kuralları aynen geçerli: sonradan gelen görüş değişimi tele gitmez.
- Sıra: önce `mining/field` (en büyük pay), sonra `pirates`, sonra trafik.

Hipotez. Kazancın üst sınırı ölçüldü: olay okuması kapalı koşu.
**Doğrulama:** Olay okumalarının payı %42'den %10'un altına iner; başkasının hareketi p95 ≤ 3 sn.

## ADR-05. Yazma yolu: kira havuzu, idempotency, kilit sırası

**Bağlam.**
- K1: Bütün 5xx'ler, API başına 2 bağlantılık kira kuyruğundan geliyor.
- Y6: Kritik yazmalarda idempotency anahtarı yok.
- O10: Canlıda `players.wealth` kaynaklı deadlock var.

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| A. `PLACEMENT_POOL_MAX` artırmak | Tek satır | Kuyruğu öteler; bağlantı ve kilit maliyeti kalır |
| **B. Komut zarfı** | Ayrı havuz ve paylaşımlı advisory kilit kalkar; çift basma ve deadlock sınıfı birlikte kapanır | Her yazma rotası zarfa taşınır |
| C. Galaksi başına tek yazar | Kilit yok | Kuyruk ve gecikme; tam yeniden yazım |

B'de her yazma tek transaction'da aynı sırayı izler:
1. Idempotency anahtarı kontrolü.
2. Oyuncu satırı kilidi ve `placement_version` doğrulaması.
3. Sabit kilit sırası: sezon, oyuncu, sıralı gezegenler.
4. İş ve olay yazımı.

Taşınma, tatil ve transfer, kilit yerine sürüm artırır.

**Öneri: B.** Kesin yön.
- Kazanç hipotez: kalan 5xx'lerin çözülmesi.
- Ön koşul: Kira, taşınma sırasında eski yerleşimle yazılmasını engelliyor. Sürüm kontrolü bunu ancak her yazma yolu oyuncu satırını kilitliyor veya sürümü aynı deyimde doğruluyorsa sağlar. FAZ 4'te bütün yazma yolları bu açıdan listelenecek.
- `wealth` gibi önbellek sütunları ya aynı sırayla yazılır ya da türetilir (O1).

**Doğrulama:**
- Yarış testleri: taşınma sırasında yazma, çift gönderim, deadlock senaryosu.
- Yük altında `RETRYABLE` sayısı 0.

## ADR-06. Worker ve zamanlanmış olaylar

**Bağlam.**
- K2: Worker tek ve sıralı. FCM çağrısı döngüde, zaman aşımı yok.
- Y7: Çöken worker'ın aldığı olaylar 5 dk sonra geri döner.
- Y8: Geç işlenen olay, işlendiği andaki duruma göre çözülüyor.
- Y10: `done` satırlar duruyor, güncellemelerin %3,4'ü HOT.
- Ölçüm: olay başına ortalama 129 ms; tavan ~7–8 olay/sn.

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| **A. Hijyen** | Ucuz, sağlamlık hemen artar | Tavanı değiştirmez |
| **B. Galaksiye göre paralel işleme** | Tavan galaksi sayısıyla büyür; galaksi içi sıra korunur | Galaksiler arası olayların (transfer) ayrı kuralı gerekir |
| C. Olay başına deyim azaltma | Tavan ~2 kat (hesap) | Handler bazında iş |
| D. Harici kuyruk | — | Postgres kuyruğu bu ölçekte yeter; yeni bileşen |

A'nın içeriği:
- Dış çağrılar (FCM) outbox'a.
- Worker'da `statement_timeout` ve `lock_timeout`.
- 5 dk yerine kısa kira ve kalp atışı.
- `done` satırların hemen silinmesi veya arşive alınması.
- Kısmi index ile HOT güncelleme.

**Öneri: A hemen, C ile birlikte; B, worker yük testi T1'de doygunluk gösterirse.**
- Sıra anahtarı (galaksi) şimdiden tasarıma girer.
- Y8 için **Owner** kararı: geç olay `resolve_at` anının durumuna göre mi çözülsün? Öneri: evet. Kod yorumu da bunu amaçlıyor; ama oyun sonucunu değiştirir.

**Doğrulama:** Worker yük testi (henüz yok): T1 olay hızında gecikme p95 ≤ 1 sn (S9).

## ADR-07. Kaynak ve gemi bütünlüğü

**Bağlam.**
- K3: Kaynaklar `real` (float4) tutuluyor; `>= 0` CHECK yok.
- `setUnits` negatifi sessizce 0'a çeviriyor.
- Kaynak ve gemi için defter yok.

S5 sayesinde dünya tabloları sezon başında boş; şema değişikliği veri eşlemesi gerektirmez.

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| A. Bugünkü hâl | — | Bir sonraki hata iz bırakmaz |
| **B. CHECK ≥ 0, clamp yerine hata** | Veritabanı son savunma hattı olur | Bugün gizlenen hatalar görünür olur; önce testler |
| **C. `real` → `double precision`** | 15 hane; kural paketi zaten JS sayısı kullanıyor | Satır başına +16 bayt |
| C2. `bigint` mili-birim | Tam kesinlik | Kural paketiyle her sınırda dönüşüm; daha çok değişiklik |
| **D. Ekleme-yalnız kaynak ve gemi defteri** | "Kaynak çoğaldı mı?" sorusu yanıtlanır; istatistiğin ham kaynağı (S10) | Yazma başına +1 deyim (gruplanabilir); sezon başına büyür |
| E. Tam event sourcing | Her şey yeniden oynatılabilir | Yeniden yazım; reddedildi |

**Öneri: B + C + D.** D sezon başına bölümlenir ve sezon sonunda arşive gider (ADR-08). Kesin.
**Doğrulama:** Korunum denetimi: defter toplamı ile bakiye eşleşir. Fuzz testinde negatif değer reddedilir.

## ADR-08. Sezon geçişi ve arşiv

> **İnceleme düzeltmesi (2026-11-06):** Aşağıdaki B seçeneğinin `TRUNCATE` kısmı reddedildi.
> - `TRUNCATE`, FK ile bağlı kalıcı `return_applications` tablosunu da boşaltırdı.
> - Silme yolu "dört" değil; kodda 75 dosyada 299 silme noktası var.
>
> Geçerli tasarım E §4'te: geçmiş sınıfı önce arşive, bugünkü `DELETE`, ardından `REINDEX CONCURRENTLY`.

**Bağlam.**
- K5: 70 tablo tek transaction'da `DELETE` ile siliniyor.
- Bu silme index'leri şişiriyor: index 176 MB, veri 96 MB.
- Owner: sezonlar sıfırlanmaya devam eder, veri yok edilmez, ileride ayrıntılı istatistik istenir. Veritabanını ve okumayı yormamalı (S5b, S10).

Kodda veriyi yok eden dört yol var. Arşiv kararı hepsini kapsamalı:

| Yol | Ne siliyor | Ne zaman |
| --- | --- | --- |
| Sezon geçişi (`servers.ts`) | Ana galaksilerin bütün dünya tabloları | Sezon sonu, hepsi birlikte |
| Pasif koltuk geri alma (`reclaim.ts`) | 3 gün girmeyen oyuncunun dünyası; FK yüzünden başkalarının o dünyayla ilgili savaş raporları da gidiyor | Sezon içinde, oyuncu başına |
| Başlangıç galaksisi temizliği (`starter/retention.ts`) | Eski raporlar, sohbet, biten olaylar; bu galaksilerde sezon silmesi yok | Sürekli |
| Hesap silme (`accountDeletion.ts`) | Kişisel veri | Oyuncu isteğiyle; yasal yükümlülük |

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| A. Bugünkü `DELETE` | — | Veri kaybolur; şişme; süre veriyle büyür |
| **B. Arşive kopyala, sonra `TRUNCATE`** | Canlı tablolar her sezon temiz ve küçük başlar; `TRUNCATE` anlık, şişme yok; mevcut tekil index'ler aynen çalışır | Kopyalama süresi; kalıcı tablolardan dünya tablolarına FK varsa `TRUNCATE` engellenir |
| C. Canlı tabloları sezona göre partition et, sonra `DETACH` | Kopyalama yok | ~70 tabloda PK ve tekil index'lere `season_id` eklenir; "hesap başına tek komutan" kuralı yeniden kurulur |
| D. Dışa aktarım (nesne depolama, sıkıştırılmış dosya) | Veritabanı hiç büyümez | İstatistik için ayrı okuma aracı gerekir |

**Öneri: B.**
- Arşiv aynı veritabanında ayrı `archive` şemasında tutulur. Tablolar ekleme-yalnız ve sezona göre bölümlüdür.
- Canlı sorgular arşive hiç dokunmaz.
- Sezon sonunda istatistik özetleri hesaplanıp kalıcı tablolara yazılır.
- Arşiv büyürse eski sezonlar D ile dışarı alınır; geri yükleme yolu yazılı olur.
- **Koltuk geri alma ve başlangıç galaksisi temizliği** satır bazında silmeye devam eder, çünkü hacim küçük. Ama her silme önce arşive kopyalar. Savaş raporlarının oyuncuya bağlı FK'leri anlık görüntü kimliğine çevrilir; böylece pasif oyuncunun dünyası silinince başkalarının raporu kaybolmaz.
- **Kişisel veri arşive girmez.** Sohbet, IP ve cihaz bilgisi bugünkü saklama kuralında kalır. Arşiv oyuncuyu kimlikle tutar; hesap silindiğinde arşivdeki kimlik anonimleştirilir.
- `TRUNCATE` yalnız ana sezon geçişinde, bütün ana galaksiler aynı anda kapandığı için kullanılır. Galaksiler ileride farklı zamanlarda kapanırsa C yeniden değerlendirilir.

Kesin yön. FAZ 4'te kalıcı tablolardan dünya tablolarına giden FK listesi çıkarılacak.
**Doğrulama:** Geçiş süresi ölçülür. Geçişten sonra canlı tablo ve index boyutu sıfıra yakın; arşiv satır sayısı kaynakla eşit.

## ADR-09. Analitik kurtarma işi

**Bağlam.** Y12: Her API dakikada bir ve her POST'tan sonra 30 günlük komut tablolarını tarıyor. PG süresinin %44'ü bu iş.

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| A. Bugünkü tarama | — | Yazma ve veriyle büyür |
| **B. İmleçli artımlı okuma** | Her koşu yalnız yeni satırları okur; en küçük değişiklik | Kaynak tablo başına imleç |
| C. Transactional outbox | Kesin teslim, ayrı tüketici | Her komuta ek yazma |
| D. Analitiği ayrı veritabanına almak | Oyun DB'si rahatlar | Yeni bileşen; kök nedeni çözmez |

**Öneri: B.** Kesin.
**Doğrulama:** Bu işin PG süresindeki payı %44'ten %5'in altına iner.

## ADR-10. Altyapı, yedek ve barındırma

**Bağlam.**
- Bugün Contabo Cloud VPS 6: 6 paylaşımlı vCPU, 12 GB.
- Her dakikanın ilk 6 saniyesinde VM dışından takılma oluyor.
- Stage, izleme ve iki eski veritabanı kopyası aynı makinede (O9).
- Geri yükleme hiç denenmedi (S12). RPO ≤ 1 dk, RTO ≤ 30 dk (S3).

**Barındırma seçenekleri.** Fiyatlar Contabo sayfasında 24 aylık süre için gösterilen aylık değerlerdir. KDV ve süre koşulu sayfada net değil; siparişten önce doğrulanmalı.

| Seçenek | Çekirdek | RAM | Aylık (yaklaşık) | Not |
| --- | --- | --- | --- | --- |
| Cloud VPS 6 (bugün) | 6 paylaşımlı vCPU | 12 GB | ~€7,5 | Takılma ölçüldü |
| Cloud VPS 12 / 16 | 12 / 16 paylaşımlı vCPU | 48 / 64 GB | ~€20–25 / ~€37 | Ucuz kapasite, takılma riski sürer |
| Cloud VDS S / M | 6 / 8 "sanal çekirdek" (Hyper-Thread ile 3 / 4 fiziksel), adanmış | 24 / 32 GB | ~€43–54 / ~€54–68 | AMD EPYC 7282, 2,8 GHz |
| Cloud VDS L / XL | 12 / 16 sanal çekirdek (6 / 8 fiziksel) | 48 / 64 GB | ~€76–96 / ~€103–129 | T2'de uygulama veya DB makinesi adayı |

Uyarı: VDS'in çekirdek başına hızı bugünkü makineden düşük olabilir; işlemci 2,8 GHz Zen 2. Geçmeden önce aynı yük aracıyla bir aylık sözleşmede ölçülmelidir. Hipotez.

**Öneri:**
1. Stage ayrı ve ucuz bir VPS'e taşınır (~€5–8). Eski iki kopya owner onayıyla silinir.
2. Geri yükleme tatbikatı en erken işlerden biridir. Ölçülecek: pgBackRest'ten yeni makineye kurulum süresi (RTO). Tatbikat betiği repoya girer.
3. `postgresql.auto.conf` ayarları repoya taşınır.
4. Dış uptime kontrolü ve makine dışı alarm yolu kurulur. Claude ile müdahale en sona kalır (S4).
5. Yazılım adımlarından sonra ölçüm yapılır. T1'e yaklaşınca adanmış çekirdeğe geçilir. T2'de uygulama ve DB ayrılır.

**Owner:** Aylık bütçe tavanı ve geçiş zamanı.

## ADR-11. Güvenlik

| Konu | Bugün | Öneri |
| --- | --- | --- |
| DB rolü (Y5) | Uygulama superuser | Ayrı roller: `app` (DML), `worker`, `migrate` (DDL), `readonly` (ölçüm) |
| Sırlar (Y5) | Her süreçte hepsi | Rol başına yalnız gerekenler; ödeme sırları yalnız API'de |
| Refresh token (O2) | Eski token süresi dolana kadar geçerli | Token ailesi: kullanılan eski token tekrar gelirse aile iptal edilir |
| Boşta transaction | Sınır yok | `idle_in_transaction_session_timeout` |

Kesin. Düşük risk; ayrı küçük adımlar.

## ADR-12. Dağıtım

**Bağlam.** `deploy.sh` bütün rolleri durdurup migration yapıyor (K4). Oturumlar elle sırayla yeniden başlatmayı zaten uyguluyor. Hedef: dağıtım kesintisi ≤ 30 sn (S3).

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| A. Bugünkü durdur ve başlat | Basit | Her dağıtımda kesinti |
| **B. Expand-contract migration ve sırayla yeniden başlatma** | Kesintisiz; elle yapılan iş betiğe girer | Migration'lar iki adımlı yazılır |
| C. Mavi-yeşil | Anında geri dönüş | İki kat kaynak |

**Öneri: B.** Kırıcı dünya şeması değişiklikleri sezon geçişine bağlanır (S5). Kesin.

---

## Owner değerlendirmesi için

1. **Genel yön:** Özet tablodaki öneriler uygun mu? Kesinleşirse FAZ 4'te D–J teslimatları bunlara göre yazılır.
2. **ADR-06, Y8:** Geç işlenen olay `resolve_at` anının durumuna göre çözülsün mü? Öneri: evet.
3. **ADR-10, bütçe:** Aylık altyapı tavanı nedir? İki öneri:
   - Stage'i ayırmak (~€5–8) ve geri yükleme tatbikatı hemen.
   - Adanmış çekirdeğe geçiş, yazılım adımlarından sonra ölçerek.
4. **Eski iki veritabanı kopyası** silinsin mi?
