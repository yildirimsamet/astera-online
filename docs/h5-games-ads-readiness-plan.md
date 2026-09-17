# H5 Games Ads başvuru ve entegrasyon planı

Tarih: 17 Eylül 2026  
Durum: P0.1–P0.4 kodda tamamlandı; kalan iş AdSense konsolu, Search Console ve üretim
doğrulaması. **Ödüllü reklam yerleşimi bilinçli olarak ertelendi** — ürün sahibi kararı:
“Ödüllere karışma. Önce başvuru yapacağız ve kabul edilmesini bekleyeceğiz.”

## Hedef

Astera Online'ı Google H5 Games Ads başvurusuna göndermeden önce üç koşulu birlikte
sağlamak:

1. Google'ın inceleyebildiği, özgün içeriği ve açık gezinmesi olan bir yayıncı sitesi.
2. EEA, Birleşik Krallık ve İsviçre için Google sertifikalı CMP; Türkiye için KVKK'ya
   uygun, reklam ve analitik depolamasını açık seçimden önce kapalı tutan izin akışı.
3. H5 Games Ads API'sinin sayfada kurulu ve çalışır olması; ileride gelecek yerleşimin
   ödülü yalnız tamamlanmış reklam sonrasında vermesi ve Google ödüllü reklam kurallarına
   uyması.

Başvuru, 1 ve 2 üretimde doğrulanmadan gönderilmeyecek. 3'ün **yerleşim** kısmı başvuruyu
bloke etmiyor: H5 başvurusu çalışan bir reklam yerleşimi değil, kurulu bir entegrasyon ve
politikaya uygun bir site istiyor — ve ödül tasarımı, kabul beklenirken yapılacak bir iş.

## İlk denetim (uygulama öncesi)

| Alan | Uygulama öncesi | Şimdi |
| --- | --- | --- |
| `ads.txt` ve yayıncı kimliği | Hazır | Hazır |
| Tarayıcının okuyabildiği içerik sayfaları | Yalnız Türkçe hızlı başlangıç rehberi | 15 sayfa, iki dilde, footer gezinmesiyle |
| `robots.txt`, `sitemap.xml`, gerçek 404 | Yok; bilinmeyen yollar `200` dönüyordu | Var; `try_files … =404` |
| Gizlilik, çerez, KVKK, koşullar | Yok | Altı belge × iki dil + KVKK |
| Google CMP | Üretimde yayınlanmamış | **Hâlâ yayınlanmadı — konsol işi** |
| İzin öncesi analitik/reklam depolaması | Analytics açılışta çalışıyordu | Dört sinyal `denied`; seçimden önce hiçbir şey |
| İzni geri alma yolu | Yok | Menüdeki “Gizlilik” satırı (CMP varsa Google'ınki) |
| CSP ve AdSense | Alan adı allowlist'i (Google desteklemiyor) | İstek başına nonce + `strict-dynamic` |
| H5 `adBreak` / `adConfig` entegrasyonu | Yok | Köprü + `adConfig()` canlı; yerleşim yok |
| Ödül tasarımı | Belirlenmemiş | **Bilinçli ertelendi** (ürün sahibi kararı) |
| Sohbet raporlama/engelleme | Yok | Yok — P1 |

## Başvuru deneyimlerinden çıkan risk

H5 program onayı ile alan adının AdSense'te “Ready” olması ayrı aşamalar.
[Bir yayıncı raporunda](https://www.reddit.com/r/Adsense/comments/1s4att5/my_game_site_was_accepted_into_googles_h5_program/)
H5 kabulüne rağmen AdSense alanı üç kez “low value content” gerekçesiyle reddedilmiş;
[bir başka SPA raporunda](https://www.reddit.com/r/Adsense/comments/1sx7zu9/approved_for_h5_games_ads_beta_but_adsense_bot/)
aynı iki aşamalı sorun anlatılıyor. Bunlar kişisel deneyimdir, Google ölçütü veya
kabul garantisi değildir. Yalnız oyunun varlığı, `ads.txt` veya uzun bir wiki de
tek başına onay sağlamıyor. Bu yüzden taranabilir özgün sayfalar, gerçek gezinme
ve Search Console doğrulaması ayrı P0 işleri; otomatik bir “20 blog yazısı”
kotası Google kuralı gibi ele alınmayacak.

## Uygulama sırası

### P0.1 — Taranabilir yayıncı sitesi

Durum: **Tamamlandı**

- [x] Türkçe ve İngilizce “Hakkında” sayfaları.
- [x] Türkçe mevcut rehberi koru; eşdeğer İngilizce “How to play” sayfası ekle.
- [x] Ana sayfada dile uygun, klavye ile erişilebilir içerik bağlantıları.
- [x] Ana sayfa ve içerik sayfalarında gerçek PNG varlığını kullanan OG/Twitter kartları.
- [x] Gerçek `robots.txt` ve `sitemap.xml`.
- [x] Bilinmeyen URL'lerde SPA kabuğu yerine gerçek `404`.
- [x] Üretim derlemesinde dosyaların kopyalandığını ve bağlantıların çalıştığını test et.
- [x] Her sayfada aynı footer gezinmesi (tüm politika seti + oyuna dönüş + e-posta).
- [x] Her dil çiftinde `hreflang` (`en`, `tr`, `x-default`).
- [x] Sayfa adresleri tek tabloda: `apps/web/src/lib/publisherPages.ts`. Sitemap, dosya
  varlığı, canonical ve oyun içi bağlantılar bu tabloya karşı test ediliyor.
- [x] Rehber sayfasındaki satır içi `<script>` dosyaya taşındı (`/guide-back.js`).
  Üretimdeki CSP `script-src 'self'` verdiği için bu blok zaten hiç çalışmıyordu.

Çıkış ölçütü: Googlebot JavaScript çalıştırmadan oyun açıklamasına ve rehbere ulaşabiliyor;
site haritası yalnız gerçek `200` sayfaları listeliyor.

### P0.2 — Hukuki ve yayıncı sayfaları

Durum: **Tamamlandı (iki dilde); yalnız CMP yayını ve üretim doğrulaması bekliyor**

Sayfalar dil eşli adreslerde: İngilizce slug İngilizce sayfa, Türkçe slug Türkçe sayfa.

| Belge | İngilizce | Türkçe |
| --- | --- | --- |
| Gizlilik | `/privacy.html` | `/gizlilik-politikasi.html` |
| Çerez | `/cookies.html` | `/cerez-politikasi.html` |
| Koşullar | `/terms.html` | `/kullanim-kosullari.html` |
| Topluluk | `/community-guidelines.html` | `/topluluk-kurallari.html` |
| İletişim | `/contact.html` | `/iletisim.html` |
| KVKK aydınlatma | — (gizlilikten bağlanıyor) | `/kvkk-aydinlatma-metni.html` |

KVKK metni 6698 sayılı Kanun kapsamında Türkiye'deki ilgili kişilere hitap eden yasal bir
bildirim olduğu için tek dilde; İngilizce gizlilik politikası ona bağlanıyor.

- [x] `/privacy.html`: veri sorumlusu, işlenen veri, amaç, hukuki sebep, alıcılar,
  saklama, haklar, Google reklam çerezleri ve reklam kişiselleştirme seçenekleri.
- [x] `/cookies.html`: zorunlu, analitik ve reklam çerezleri; sağlayıcı, amaç ve süre.
- [x] `/kvkk-aydinlatma-metni.html`: KVKK m.10 kapsamındaki ayrı aydınlatma metni.
- [x] `/terms.html`: hesap, oyun kuralları, sezon/sıfırlama ve yaptırımlar.
- [x] `/community-guidelines.html`: sohbet kuralları ve yaptırım süreci.
- [x] `/contact.html`: yayıncıya ulaşılabilen gerçek kanal.
- [x] Hesap silme talebinin kullanıcı tarafından e-postayla başlatılabildiği akış.
- [x] İngilizce arayüzün işaret ettiği hukuki sayfaların İngilizce sürümleri.
- [x] Koşullarda Google ödüllü reklam kuralları (yalnız tamamlanmış izlemede ödül, oyun
  dışında değer taşımaz, satılamaz) — yerleşim gelmeden önce yazıldı ki ilk yerleşimin
  çıktığı gün metin değiştirmek gerekmesin.

Veri sorumlusu **Samet Yıldırım**; gizlilik iletişimi
**samety3503@gmail.com**. Ev adresi yayınlanmayacak. KVKK'nın aydınlatma
rehberi, gerçek kişi veri sorumlusunun ad-soyadını ve kolay iletişim için
telefon, e-posta, internet veya posta adresi gibi yöntemlerden birini sayıyor;
bu nedenle e-posta kullanılıyor. Oyun için asgari yaş tanımlanmadı; 25–45
hedef kitle bilgisi bir yaş sınırına dönüştürülmeyecek. Saklama süreleri ve
hesap silme istisnaları mevcut kodla uyumlu anlatılacak.

Çıkış ölçütü: Footer ve CMP bütün metinlere erişiyor; sayfalar gerçek işletme ve veri
akışını tarif ediyor; aydınlatma ile açık rıza ayrı tutuluyor. Footer tarafı tamam; CMP
mesajı AdSense konsolunda yayınlanmadığı için çıkış ölçütü henüz kapanmadı.

### P0.3 — İzin mimarisi ve Google CMP

Durum: **Kod tarafı tamamlandı; kalan maddelerin tamamı AdSense konsolunda**

**Soruyu kimin soracağı ülkeye göre değil, Google'ın orada bir mesajı olup olmamasına
göre belirleniyor.** Bu, ülke listesi tutmaktan daha sağlam: Google kapsamını
genişlettiğinde kod kendiliğinden geri çekiliyor.

- **Google'ın mesajı olan her yer** — EEA / Birleşik Krallık / İsviçre için European
  regulations mesajı (IAB TCF, `__tcfapi`), açılırsa ABD eyaletleri için US state
  regulations mesajı (GPP, `__gpp` / `__uspapi`). Bu API'lerden biri tanımlıysa oyunun
  kendi bildirimi hiç açılmıyor ve menüdeki satır `googlefc.showRevocationMessage()`
  çağırıyor. İki bildirimi üst üste göstermek, hangisi kapatılırsa kapatılsın
  diğerinin oyuncu adına konuşmaya devam etmesi demek.
- **Google'ın mesajı olmayan her yer, Türkiye dahil** — AdSense Privacy & messaging
  yalnız dört mesaj tipi sunuyor: European regulations, US state regulations, ad
  blocking recovery ve Offerwall. **Dünyanın geri kalanı için genel bir çerez onayı
  mesajı yok.** Yani Türkiye'yi Google'a bırakmak teknik olarak mümkün değil; KVKK ise
  açık seçim ve “reddetmek kabul etmek kadar kolay olsun” istiyor.
  `shell/ConsentNotice.tsx` bunu soruyor: “Kabul et” ile “Reddet” aynı boyutta, yan yana,
  tek dokunuş. Burada Google'ın iki düğmeli (“Manage options” + “Consent”) şekli taklit
  edilmiyor — o şekil TCF politikasının EEA için istediği şekil; Türkiye'de reddetmeyi
  bir alt ekrana gömmek KVKK açısından geri adım olurdu.

- [x] Google Consent Mode varsayımları AdSense ve Analytics yüklenmeden önce:
  `ad_storage`, `analytics_storage`, `ad_user_data`, `ad_personalization = denied`.
  (`public/consent-bootstrap.js`, reklam yükleyicisinden önce, senkron.)
- [x] CSP'yi Google'ın desteklediği nonce + `strict-dynamic` modeline taşı. Vite her
  script etiketine `__CSP_NONCE__` basıyor, Nginx `sub_filter` ile her isteğe
  `$request_id` yazıyor. Yayıncı sayfaları ayrı ve daha sıkı bir politikayla
  sunuluyor: hiçbir üçüncü taraf kaynağı yok. Gerçek bir Nginx ve gerçek bir
  tarayıcıyla doğrulandı — sıfır CSP ihlali.
- [x] Türkiye için KVKK seçimini Google CMP kapsamı dışındaki ziyaretçilere de sun;
  zorunlu olmayan depolama seçimden önce başlamasın.
- [x] Seçimi yeniden açan kalıcı yol: menüdeki **Gizlilik** satırı. Satır mevcut
  cevabı da gösteriyor; sertifikalı CMP varsa `googlefc.showRevocationMessage()`
  çağrılıyor, yoksa oyunun kendi bildirimi açılıyor.
- [x] Reddetme de yazılıyor: “hayır” diyen ziyaretçiye her girişte aynı soru sorulmuyor.
- [ ] AdSense Privacy & messaging → European regulations → Settings altında
  “Consent mode for advertising purposes” ve ardından “Consent mode for analytics
  purposes” ayarlarını aç. Bu iki ayar varsayılan olarak kapalı; Google CMP'nin
  izin tercihini GA/Ads Consent Mode'a aktarması için ikisi de gerekli.
- [ ] “Manage options” + “Consent” iki düğmeli mesajı oluştur. Bu, Google'ın
  belgelediği iki düğmeli yapının ta kendisi. IAB TCF politikası “Consent”
  düğmesinin açık ve olumlu bir onay ifadesi taşımasını şart koşuyor —
  “Siteye devam et” gibi bir metin kabul edilmiyor.
- [ ] **“Maximize message coverage” ve “Optimize my consent message” ayarlarını
  Google'ın bıraktığı gibi AÇIK bırak.** İkisi de çoğu hesapta varsayılan olarak
  açık geliyor ve ikisi de Google'ın kendi gelir tasarımı. Planın önceki hâli
  “Optimize”ı kapat diyordu; bu karar geri alındı, çünkü (a) bunlar Google'ın
  tercih ettiği akış, (b) tek başına kapatmak zaten çalışmıyor — Google
  “Maximize message coverage” altında sunulan mesajlarda tek tek optimizasyon
  kapatmayı desteklemiyor, tamamen çıkmak için ikisini birden kapatmak gerekiyor.

  Bunun ne demek olduğunu bilerek kabul ediyoruz: optimizasyon açıkken bazı
  ziyaretçiler standart onay mesajı yerine, meşru menfaate dayanarak sınırlı
  reklam sunan **engellemeyen (non-blocking) sınırlı mesajı** görecek. Google
  bunu uyumlu bir ürün olarak sunuyor; sorumluluk yine yayıncıda.
- [ ] Astera alanını, Türkçe/İngilizce dilleri, gizlilik politikası URL'sini seç ve
  mesajı yayınla. Gizlilik URL'si olarak **`/privacy.html`** (İngilizce) ver;
  mesajın kendisi ziyaretçinin cihaz diline göre servis ediliyor ve Türkçe
  desteklenen diller arasında.
- [ ] `?fc=alwaysshow&fctype=gdpr` ve temiz tarayıcı profiliyle iki dilde doğrula.
- [ ] ABD eyalet mesajını (US state regulations) açacaksan aç; kod tarafı hazır —
  `googleCmpGoverns()` artık `__gpp` ve `__uspapi`'yi de tanıyor, yani o mesaj
  çıktığında oyunun kendi bildirimi o ziyaretçiye açılmıyor.
- [ ] Oyunun asgari yaşı yok. Çocuk/ergen kullanıcılar için reklam talebinin
  yaşa uygun işaretlenmesi ve kişiselleştirme sınırı karara bağlanacak; çocuk
  olduğu bilinen kullanıcılara kişiselleştirilmiş reklam sunulmayacak.

Çıkış ölçütü: İlk ziyarette Analytics ve reklam çerezi yok; seçim sonrasında sinyaller
doğru güncelleniyor; tercih geri alınabiliyor. Üçü de kodda sağlandı ve gerçek tarayıcıda
doğrulandı; EEA tarafı CMP yayınlanana kadar kapanmıyor.

### P0.4 — H5 Games Ads API kabuğu

Durum: **Yapılandırma yarısı tamamlandı; yerleşim yarısı ürün sahibi kararıyla ertelendi**

Ad Placement API ayrı bir kütüphane değil: AdSense yükleyicisinin içinde geliyor ve oyun
ona yayıncının kendi tanımladığı iki global üzerinden ulaşıyor — `adBreak()` ve
`adConfig()`, ikisi de `window.adsbygoogle` kuyruğuna nesne itiyor.

- [x] Google loader'ını tek kez yükle; `adBreak` ve `adConfig` kuyruk köprülerini kur.
  (`public/h5-ads.js` — Google'ın yayınladığı snippet, satır içi blok yerine birinci
  taraf dosya olarak, çünkü üretimdeki CSP `'unsafe-inline'` vermiyor.)
- [x] `adConfig({ preloadAdBreaks: 'auto', sound })` açılışta çağrılıyor ve oyuncu sesi
  açıp kapattığında yalnız `sound` alanıyla yeniden bildiriliyor — Google yaratıcıyı
  kısmen sesin açık olup olmamasına göre seçiyor ve rehberi “ses durumu değişir
  değişmez çağır” diyor. `preloadAdBreaks` bir kez yazılabilir; ikinci kez gönderilmiyor.
- [x] Köprü yoksa (dev sunucusu, test tarayıcısı, reklam engelleyici) her çağrı sessiz
  no-op; `adConfig` fırlatırsa yutuluyor. Reklam kaybı oyun kaybına dönüşmüyor.
- [x] Kuyruğa yalnızca yapılandırma giriyor, hiçbir yerleşim girmiyor —
  `test/h5-ads.test.ts` bunu davranışsal olarak doğruluyor (kuyruktaki hiçbir kaydın
  `type`, `adViewed` veya `beforeReward` alanı yok).
- [ ] `beforeAd` oyun akışını durdursun ve sesi kapatsın; `afterAd` güvenle geri alsın.
- [ ] `adViewed` dışında hiçbir callback ödül vermesin.
- [ ] Hazır olmama (`notReady`), reklam bulunmaması (`noAdPreloaded`), `frequencyCapped`,
  `dismissed`, `ignored`, hata ve sayfa görünürlüğü senaryolarını test et.
- [ ] AdSense Auto Ads'i tam ekran oyun yüzeyinde kapalı tut (konsol ayarı).

Son dört madde **yerleşim** işi ve ödül kararına bağlı; ürün sahibi bunları başvuru
kabul edilene kadar açıkça erteledi. Ödülsüz bir `adBreak()` yazmak, bu projenin
yasakladığı sessiz yer tutucunun ta kendisi olurdu.

Çıkış ölçütü: Bir reklam hatası oyunu kilitlemiyor (sağlandı); ödül iki kez yazılmıyor ve
oyun reklam boyunca ilerlemiyor (yerleşim çıktığında).

### P0.5 — Ödüllü reklam ürünü

Durum: **Ertelendi — ürün sahibi kararı, 17 Eylül 2026**

> “Ödüllere falan karışma. Daha başvuru yapmadık. Önce başvuru yapacağız ve kabul
> edilmesini bekleyeceğiz.”

Ayrıca karara bağlandı: **yalnız ödüllü, interstitial yok.** Google'ın H5 politikası
“kesintisiz oynanış sırasında” ve “her etkileşimden sonra” tam ekran reklamı yasaklıyor;
Astera'da level arası yok, dolayısıyla her interstitial bir kesinti olurdu. Ödüllü reklam
oyuncunun kendi seçtiği reklamdır ve bu oyunun hissiyle çelişmiyor.

Aşağıdakiler kabul sonrası yapılacak işin listesidir, şimdi değil:

- [ ] Oyuncu açıkça seçmeden reklam açılmıyor.
- [ ] Düğme reklamdan önce kesin ödülü ve gerekli izleme koşulunu söylüyor.
- [ ] Ödül para değeri taşımıyor, devredilemiyor ve rastgele ise olasılıklar açıklanıyor.
- [ ] Frekans sınırı, günlük sınır ve ekonomi etkisi simülasyonla doğrulanıyor.
- [ ] Sunucu tarafında idempotent hak ediş ve denetim kaydı.

Mevcut alaşım, kristal, döteryum ve gemiler klan yardımıyla devredilebildiği için doğrudan
ödül olarak kullanılmayacak. Kesin ödül oyunun ilerleme ve risk dengesini değiştirir;
uygulamadan önce ürün sahibi kararı ve ekonomi testi gerekir.

Çıkış ölçütü: Google'ın ödüllü reklam politikasına uygun, devredilemez bir ödül ve
sunucu tarafında tekil hak ediş kanıtı var. **Bu ölçüt başvuruyu bloke etmiyor:** H5
başvurusu çalışan bir yerleşim değil, kurulu bir entegrasyon ve politikaya uygun bir site
istiyor.

### P0.6 — Üretim doğrulaması ve başvuru

Durum: **Bekliyor — dağıtım sonrası, elle**

- [ ] Search Console alan doğrulaması ve site haritası gönderimi.
- [ ] Mobilde Core Web Vitals, kırık bağlantı, konsol hatası ve CSP ihlali kontrolü.
- [ ] Googlebot ve reklamsız ziyaretçi için içerik, gezinme ve oturum açmadan erişim.
- [ ] `ads.txt`, yayıncı kimliği, CMP ve AdSense hesap durumunu aynı alan üzerinde doğrula.
- [ ] Başvuru formunda AdSense hesabına bağlı e-posta, Publisher ID, alan ve para kazanma
  planını tutarlı gir.

**Dağıtımda ayrıca doğrulanacak — bu sürüm bunu ekliyor:** sunulan sayfada CSP nonce'unun
gerçekten yazıldığı. `deploy.sh` hem önceden (`nginx -V | grep http_sub_module`) hem de
sonradan (sayfa ile başlıktaki nonce'un eşleşmesi) kontrol ediyor ve eşleşmezse duruyor.
Bu kontrol atlanırsa oyun bembeyaz bir ekran olur ve hiçbir sağlık ucu bunu söylemez.
Ayrıntı: `docs/deployment.md` → “Prove the release from outside”.

Çıkış ölçütü: P0 kontrol listesi kanıtlarıyla tamam; üretimde en az bir temiz tarayıcı
test kaydı var.

### P0.7 — Başvurudan sonra (kabul gelirse)

1. Ödül kararı (P0.5) ve `adBreak({ type: 'reward' })` yerleşimi.
2. AdSense konsolunda Auto Ads'in oyun yüzeyinde kapalı olduğunun doğrulanması.
3. `data-adbreak-test="on"` ile sahte reklam üzerinden uçtan uca akış testi.

### P1 — Güven ve operasyon

- [ ] Sohbette raporla, sustur/engelle ve moderasyon kuyruğu.
- [ ] İhlal ve itiraz süreci.
- [ ] Reklam yerleşimi ve ödül hak edişi için hata/kalite panosu.
- [ ] Politika veya veri akışı değiştiğinde hukuk metinlerini güncelleme kaydı.

## Google kaynakları

- [AdSense'e site bağlarken Google CMP oluşturma](https://support.google.com/adsense/answer/7584263?hl=en)
- [EEA/UK/İsviçre mesajı oluşturma ve gizlilik URL'si](https://support.google.com/adsense/answer/10960768?hl=en-GB)
- [Sertifikalı CMP şartı](https://support.google.com/adsense/answer/13554116?hl=en-GB)
- [AdSense gizlilik politikasında açıklanması gerekenler](https://support.google.com/adsense/answer/1348695?hl=en)
- [H5 Games Ads uygunluğu ve başvuru](https://support.google.com/adsense/answer/1705831?hl=en-GB)
- [H5 oyun reklam kodunu yerleştirme](https://support.google.com/adsense/answer/9955214?hl=en)
- [H5 Ad Placement API](https://developers.google.com/ad-placement/apis)
- [`adBreak()` ve `placementInfo.breakStatus` değerleri](https://developers.google.com/ad-placement/apis/adbreak)
- [`adConfig()` alanları](https://developers.google.com/ad-placement/apis/adconfig)
- [`onReady` ile oyun yüklemesini sıralama](https://developers.google.com/ad-placement/docs/manual-sequence)
- [`data-adbreak-test="on"` ile sahte reklamlarla test](https://developers.google.com/ad-placement/docs/test)
- [H5 oyun politika gereksinimleri](https://support.google.com/adsense/answer/9959170?hl=en)
- [Ödüllü reklam politikaları](https://support.google.com/adsense/answer/9121589?hl=en)
- [Düşük değerli veya yayıncı içeriği olmayan ekranlar](https://support.google.com/publisherpolicies/answer/11112688?hl=en)
- [AdSense site hazırlık ölçütleri](https://support.google.com/adsense/answer/7299563?hl=en)
- [Google CMP Consent Mode ayarları](https://support.google.com/adsense/answer/16053245?hl=en-GB)
- [Privacy & messaging mesaj tipleri (Türkiye için bir tip yok)](https://support.google.com/adsense/answer/10924669?hl=en)
- [European regulations mesajının iki düğmeli yapısı](https://support.google.com/adsense/answer/10961068?hl=en)
- [“Maximize message coverage” ve “Optimize my consent message”](https://support.google.com/adsense/answer/18189118?hl=en)
- [AdSense'in GPP desteği (ABD eyalet mesajları)](https://support.google.com/adsense/answer/14126816?hl=en)
- [Google'ın AdSense CSP entegrasyon rehberi](https://support.google.com/adsense/answer/16283098?hl=en)
- [Yaşa uygun reklam işaretleme](https://support.google.com/adsense/answer/9007197?hl=en)
- [Çocuklara kişiselleştirilmiş reklam yasağı](https://support.google.com/publisherpolicies/answer/15101728?hl=en)

## Türkiye kaynakları

- [KVKK çerez uygulamaları rehberi](https://www.kvkk.gov.tr/Icerik/7353/Cerez-Uygulamalari-Hakkinda-Rehber)
- [KVKK'nın açık rıza gerektiren çerez kararı](https://www.kvkk.gov.tr/Icerik/7595/2022-1358)
- [Aydınlatma yükümlülüğünün asgari içeriği](https://www.kvkk.gov.tr/Icerik/6765/AYDINLATMA-YUKUMLULUGUNUN-YERINE-GETIRILMESI-HAKKINDA-KAMUOYU-DUYURUSU)
- [KVKK aydınlatma rehberi, gerçek kişi kimliği ve iletişim bilgisi](https://www.kvkk.gov.tr/Icerik/5394/Aydinlatma-Yukumlulugunun-Yerine-Getirilmesi-Rehberi)
