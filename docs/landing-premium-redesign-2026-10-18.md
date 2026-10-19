# Premium landing yeniden tasarımı —18 Ekim2026

Durum: **uygulama ve tarayıcı doğrulaması sürüyor; henüz canlıya yayınlanmadı.** Kullanıcı mobil testler sürerken bu işi açıkça önceliklendirdi. Android+tek backend görevi korunur; mevcut qualifiedAAB ve kuruluDEBUG APK kanıtları sonraki landing kaynaklarına otomatik taşınmaz. Release-signing tam web regresyonu landing öncesi kaynaklarda7.007 PASS/29skip tamamlandı. Yeni landing için ayrı test/build/görsel kabul gerekir.

## Gereksinim / tasarım kararı

Astera'ya özgü kontrollü uzay paleti, güçlü tipografi/kompozisyon, gerçek mevcut oyun asset'leri, ilk ekran net Play+returning login, mobile-first. Sıradan kart grid'i, sahte kullanıcı/sayı/testimonial, var olmayan Android/iOS yayın linki veya oyun mekanikleri yok. Marka özü: hamle; görsel gerilim: gezegenin ölçeği ile kararın sadeliği; signature: geniş gerçek oyun göğü/gezegen ve asimetrik kısa başlık. Mevcut Archivo/Saira ve logo/ship/atmosphere art kullanılacak; gereksiz animasyon/scroll kütüphanesi eklenmez, native browser scroll korunur. İç öz değerlendirme: mevcut giriş görseli güçlü fakat içerik/SEO/okunabilir tanıtım5/10; hedef üretim/görsel doğrulama sonrası9/10.10/10 iddiası ölçüm/kullanıcı deneyimi olmadan verilmez.

Görünür içerik: korunan ana gezegen/koloni riski, filo-yakıt-uçuş tradeoff'u, radar/teleskop/probe ile bilgi eksikliği, üretim+araştırma, klan desteği/ortak saldırı, sezonlar, açık başlangıç adımları/FAQ, anlamlı Wiki bağlantıları. Dökümanlardaki50/300 oyuncu ve65 nötr sabitleri stale; kapasite/season süresi gibi değişebilir sayılar pazarlama metnine kör alınmaz. OnBegin hâlâ mevcut Academy/eğitim, kayıt hâlâ eğitim sonrasıClaim; returning cihaz login önceliği, security notice/reset, backend/native session aynı.

## Mevcut kaynak bulguları / etki

Root index.html çoğunlukla loading frame; noscript yalnız tek kısa paragraf+Wiki links. Mevcut604satırlık LandingScreen canvas/preload/cover'a bağlı, uzun tanıtım yok. App GalaxyView/Academy/GameShell'i eager import ediyor. Wiki Vite plugin'i zaten React renderToStaticMarkup ile gerçek statikHTML üretir, EN/TR anlamlı içerik/sitemap var. i18n6dil (TR/EN/FR/DE/ES/JA), browser/stored tercihli, fallbackTR. Publisher sayfalarıEN/TR. Native auth/runtime ve web checkout/ads sınırları korunmalı.

Önerilen en küçük mimari: Node-safe paylaşılan landing içerik+semantik React sunumu; web-only Vite static generation ile root ve6locale için gerçekHTML/head/alternates; aynı bileşen runtime'da. Ana uygulama session restore davranışını korur; başlangıçta web landing görünür, CTA erken tıklandığında restore tamamlanana kadar bir defalık intent saklanır. Ağır Galaxy/Academy/GameShell/landing3D modülleri uygun branch'te lazy; poster/metin WebGL olmadan kullanılabilir. Native kompakt giriş ve auth diyaloğu korunur. Temel metin/linkler JS olmadanaynı HTML; UA/crawler ayrımı yok.

Web sayfasında browser zoom/metin seçimi/scroll erişilebilir olmalı; oyun viewport guard yalnız public landing dışında aynı çalışır. Cookie seçimi mevcut izin semantiğiyle korunur ve landing'de akış içi bir alana yerleştirilir; CTA örtülmez. CTA/modal keyboard focus/escape, linkler, reduced-motion ve dar/kısa ekranlar gerçek browser'da doğrulanır.

**Kullanıcının bu görevdeki açık reduced-motion talebi**, CLAUDE.md'deki önceki genel yasağın bu landing için istisnasıdır. İstisna yalnız yeni landing CSS'ine daraltılacak; oyunun hareketleri veya genel test koruması gevşetilmez. Yeni davranış/SSG/routing/callback/consent/viewport değişiklikleri TDD; CSS/tasarım istisnası görsel kontrolle doğrulanır.

Happy/edge:6dil aynı canonical/head/görünür content; JS/WebGL kapalı; yavaş API/erken tek/çift CTA; auth restore ready/landing/error ve returninghint; login/recovery/AcademyClaim native regresyonları; locale route/storagebrowser tercihi; missingimages;301/404/staticNginx CSPnonce/gzip; no fake metrics; cookie deny/allow/reopen/CMP;350x480/390x844/tablet/1440desktop;keyboard/reducedmotion;LCP/CLS/initialdownload. Ek backend/migration/paidservice eklenmeyecek.

## Resmî araştırma —18 Ekim

[AdSense eligibility](https://support.google.com/adsense/answer/9724?hl=en): özgün/kaliteli/faydalı içerik gerekir. [Publisher content policy](https://support.google.com/publisherpolicies/answer/11112688?hl=en): içeriksiz/düşükdeğerli/under-construction veya yalnız behavioral ekranlara reklam koyma. İyi tasarım, ek kelime sayısı veya schema tek başına onay garantisi değildir; tüm site/UGC/privacy de incelenir.

[JavaScriptSEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics): server/static-rendering kullanıcılara ve JS çalıştırmayan crawler'lara içerik sağlar; gerçek href/meta/canonical gerekir. [People-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content): arama motoru için şişirme yerine oyunu/kararları öğrenen gerçek ziyaretçiye değer. [Web Vitals](https://web.dev/articles/vitals): LCP≤2.5s/CLS≤0.1/INP≤200ms iyi eşikler,75.percentile gerçek alan ölçümü; yerel lab değeri gerçek kullanıcının CWV başarısı diye sunulmaz.

Structured data yalnız doğrulanabilir VideoGame/WebSite/WebPage olguları; sahte rating/review/offer veya FAQ rich-result garantisi yok. AdSense low-value reddinin tek nedeni JS diye ilan edilmez; kaynakta görülen ilkHTML eksikliği giderilecek somutbulgudur.

## Uygulama günlüğü

- Web için paylaşılan semantikPublicLanding + saf6dil içerik kaydı; native kompakt ekran ve tek AuthDialog korundu. Oyun/Academy/GameShell ve native landing3D branch yüklemesi lazy. Root+6locale build-timeHTML, lang/canonical/alternate/OG/Twitter/VideoGame schema; Wiki sitemap genişletildi.
- image_gen ile özgün hero üretildi. WebP masaüstü108.266B/mobil35.074B. Prompt ve köken: [görsel kaydı](landing-art-prompts-2026-10-18.md). Tanıtım illüstrasyonları, gerçek gemi renderlarıyla karıştırılmadan etiketlendi.
- Mevcut login, returning commander, practice→Claim akışı aynı callbackleri kullanıyor. Erken eğitim isteği session restore bitene kadar tek intent; login restore ile yarışmıyor. Public browserzoom/textselection açık, oyuna geçince önceki koruma geri gelir. Cookie tercihleri mevcut ConsentNotice ile normal akışa portal edilir; CMP/denied semantiği değiştirilmez.
- RED1: mevcut web Canvas/preload/section/zoom davranışları3FAIL/17PASS. Yeni temel geçişi GREEN. RED2: locale precedence ve inlineconsent6FAIL/17PASS; düzeltildi. RED3: startupgate passthrough3FAIL; restore bekleme uygulandı. Metadata URL korunumu1FAIL; düzeltildi. Locale CSP guard1FAIL; Nginx kaynağı düzeltildi.
- SSG incelemesinde eski noscript ile yeni açıklama çakışıp ikincih1 üretiyordu; gerçek test+noJSbrowser yakaladı. Explicit root-content marker ve dönüşüm sırası düzeltildi. Son172odaklıpublic/SEO/locale/deploymenttest PASS. Authform keyboard loop için ayrı gerçekRED1FAIL/10PASS alındı, fix doğrulaması bekliyor.
- İlk2048MiB typecheckheapOOM; izin verilen4096MiB ile tamamlanan check tek captiontypeeksikliği buldu, düzeltildi. Finaltypecheck halen gerekli. Kısa bir test/typecheck çakışması fark edilince yalnız kendi test processlerimiz durduruldu; sonraki kontroller sıra ile. Bu ara/iptal sonuçlar PASS diye sayılmadı.
- Görselharnessın ilk API glob'u /src/api modüllerini de401 fixture'a yakalıyordu. Bu uygulama hatası değildi; URLpathname /api/ sınırıyla düzeltildi. JavaScript kapalı kontrolü gerçek context ayarıyla yapılıyor, Wiki/page metinleri hamHTML'de.

Ek resmî kaynaklar: [Google locale/hreflang](https://developers.google.com/search/docs/specialty/international/localized-versions), [Schema.org VideoGame](https://schema.org/VideoGame). Karşılıklı6locale+x-default mutlak bağlantılar; schemaoyunun gerçek web/multiplayer olgularıyla sınırlı.

### İkinci inceleme / gerçek build

- Shared ui/assets → galaxy/model → Three.js bağı yüzünden ilk web isteğinde renderer kütüphanesi yükleniyordu. Saf craftMetadata ayrıldı; model mevcut exportlarını korur. Gerçek import sınırı RED1FAIL → GREEN;43model testi de PASS. Oyun geometrisi/pozları değiştirilmedi.
- Yeni83odaklıtest PASS: publication yeniden yerelleştirme/tek schema, restore sırasında eğitim+login çifte intent engeli, cookie tercihlerini footer'dan yeniden açınca görünür alana getirme, AuthDialog Tab/ShiftTab/focus; model ve art sınırı.
- Compiled locale HTML önce Vite csp-nonce meta bilgisini kaybetme riski taşıyordu. Artık derlenmiş head korunup yalnız public içerik+locale metadata yeniden üretilir. Yeni Vite fixtureintegration testi nonce+compiledclient+6locale+tek CSSasset davranışını doğrular.
- Landing CSS hashli dosyayla yayınlanır; styles güncellendiğinde eski browsercache yeniHTML ile karışmaz. Transform post aşamasına alındı; buildtime unresolved stylesheet uyarısının kaynağı kaldırıldı. Gerçek test RED1FAIL → GREEN.
- Yalnız web tanıtım görselleri native assetcopy dışında bırakıldı;3native target için gerçek packagingRED3FAIL → GREEN. Native language switch'in webcanonical/URL rewrite yapmaması ayrıRED1FAIL; compile/runtime sınırı eklendi.
- Web build PASS; root+6locale dosyalarında tekh1, gerçek temel içerik, compiledJS ve csp-nonce meta gözlendi. Son typecheck4096MiB/nice10 PASS (RSSyaklaşık3.1GiB). Final broadlint/test/build ve actualNginxbrowser kabulü halen gerekli.
- Önceki devbrowseracceptance4boyuttaPASS idi fakat350x480CTA564px'e düşüyordu. Görsel inceleme yakaladı; kısaekran CSS düzeltildi ve artık firstviewportCTAassert ekleniyor.
- Productionbrowser'da cookie prompt gerçekten mevcut; getByRole(dialog) iki geçerli dialog bulduğundan ilk harness selector başarısızdı. Login formu adla seçilecek; bu uygulama giriş hatası değildi.
- Headless SwiftShader eğitim canvas'ına geçti ve loading cover kalktı; ardından oyun screenshot readback30s timeout aldı. Gerçek cihaz crash/performans hatası diye sınıflandırılmadı; gerçek oyun görsel kabulü diye de sunulmadı. Public görünüm WebGL istemez. Eğitim screenshot'u varsayılan kabulden ayrıldı; render rejimi/oyun mekanikleri bu sebeple değiştirilmedi.
- Main web entry önceki mimarinin6dil+ortak oyun/contract kaynaklarını hâlâ içerir:2.78MB raw/896KB gzip (ilk build). Three.js/WebGLRenderer bu entry'de yok; model/sahne branchleri lazy. Bu parse/download bütçesi ölçülmeden gerçek orta segment telefon CWV başarısı ilan edilmez. SSG'nin erken görüntüsü bağımsızdır; gerçek75p alan ölçümü ayrı gerektirir.

### Son geçiş incelemesi

ReactSuspense görünür ağacı unmount etmeden gizleyebilir; pasif effect cleanup viewportu o anda serbest bırakmaz. Resmî [ReactSuspense caveat](https://react.dev/reference/react/Suspense) layout effect cleanup davranışını belirtir. Gerçek Suspense RED1FAIL/2PASS ve hiddenpublic+loadingwheel RED1FAIL/18PASS alındı. Public HTMLattribute useLayoutEffect ile yönetilir; loadingcover varken görünmez publicDOM zoomistisnası vermez. Her iki düzeltme71odaklıtest içinde PASS.

6dilde sezon başlangıç/bitiş, kapanışa göre dönüş planı ve yeni rekabet açıklaması eklendi; sabit süre/ödül uydurulmadı. Wiki/season metni ve server season/servers kaynakları mevcut sezon/endsAt sözleşmesini doğrular. Wiki ve publisher sayfalarının mevcut TR/EN kapsamı korunur; diğer4landingdilinin Wiki intro'su bu sınırlamayı açıklar.

Hashli landing CSS, üretimde /assets/landing altında yayınlanır; publish-web.sh'nin eski assetkoruması ve Nginx immutablecache modeliyle aynı sınırı kullanır. Gerçek Vite fixture testinde /landing-prefix RED1FAIL alındı; yeni /assets prefixfix doğrulaması sürüyor.

ActualNginx7HTMLnonce/gzip/hash ve3unknown404/noindex PASS. NoJS+JS dörtviewport (1440x960,390x844,350x640,350x480), login/Escape, erkenCTA konumu, noinitialCanvas/model, eğitimcanvasroute ve publicviewportcleanup tarayıcı kabulü PASS. Son ek6locale mobilcapture ve finalsource yeniden build kabulü halen gerekli. İlk TLS screenshot capture anlıkprotocolfailure verdi; aynıimmutablebuild tekrarında PASS; ürüncode değiştirilmedi.

Yerel mobil lab:4xCPU,100mslatency,1.6Mbpsdownload,390x844, anonymousAPIfixture ve engellenmişthirdparties: LCP1368ms, CLS0.01645, gözlenen maksimuminput-eventduration64ms. Bu fieldINP, gerçekAndroid/iOSdonanım veya75.percentileCWV kanıtı değildir. Sonsource sonrası tekrar ölçülecek. Nginx1.28fixture eski hostuyumlu http2syntax/defaulttext/html tekrarları için nonfatalwarning veriyor; CSPtest PASS. ProductionNginxupgrade scope'a eklenmedi.

### Owner geri bildirimi: API kesintisi ve consent —18 Ekim

Owner yerel önizlemede API bağlantısı kesilince tanıtımın tam ekran blocked görünümüyle kaybolduğunu bildirdi. Gereksinim: web tanıtımı ve Wiki/normal scroll görünür kalır; aynı session retry giriş alanında sunulur; anonim yerel eğitim kullanılabilir; native blocked/recovery sözleşmesi ve kimlik/token mantığı değişmez. Happy/edge: restore ağ hatası/503, yeniden deneme sırasında tanıtım, başarılı restore→mevcut komutan, art arda retry, offline yerel eğitim ve native eski davranış. Önce gerçek App/session entegrasyon regresyonu RED, ardından yalnız web sunum düzeltmesi uygulanacak.

Consent talebi: daha kompakt ui-v2 panel/Archivo/teal kontroller, iki eşdeğer izin/reddetme eylemi, mevcut açık bilgilendirme ve policy linki korunur. Landing akışı içinde CTA altı, oyunda safe-area kontrollü küçük alt panel. CSS/tasarım istisnası; consent persistence/CMP/native davranış testleri korunur, mobil/masaüstü screenshot ile boyut doğrulanır.

Önceki son web/native build ve typecheck PASS. Test harness Suspense act await uyarısı giderildi (3 test PASS, warning yok). Yanlışlıkla bütün root'u hedefleyen ek lint komutu kaynak check'i bitince durduruldu; sonuç PASS sayılmaz. Yeni geri bildirim sonrası kaynak kabulü yeniden alınacak.

API-kesintisi düzeltmesi: gerçek App+Api+useSession testi 2 FAIL/1 PASS → uygulamadan sonra aynı testler ve session/consent/landing regresyonları toplam 80 PASS. Web blocked sunumu tanıtımı açık tutar; retry aynı coldStart'ı kullanır, Academy mevcut yerel callback'tir. Session state-machine veya native blocked akışı değiştirilmedi. Hata CTA'nın altında yer alır; 350×480'de de ilk CTA ekranda kalır.

Son web build PASS. Actual Nginx son derlemede root+6locale nonce/gzip/hash/404 PASS; JS kapalı 4 viewport +6dil mobil görüntü, JS açık4viewport/login/Academy ve API503 altında3viewport tekrar PASS. Consent paneli dört viewportta ≤200px; mevcut metin ve iki izin tercihi korundu, ui-v2 Button/Archivo/renkler kullanılır. `preview-4174-real-outage.png`: kullanıcının gördüğü localhost:4174 üzerinde gerçek yerelAPI500 ile h1/publicSurface/retry görünür, tam ekran hata yok. Preview HMR sağlamaz; owner'a Ctrl+Shift+R bilgisi verildi.

Son kaynak için typecheck/lint/nativebuild/lab ve tam web testleri tekrar yürütülür. Full suite tamamlanmadan son kabul PASS ilan edilmez.

### Owner görsel netlik geri bildirimi

768×259 fleet banner'ının cover ile yaklaşık630×468'e büyütülmesi etkili çözünürlüğü düşürüyordu. Dört bölüm için yüksek çözünürlüklü mevcut PNG kaynaklarından ayrı768/1536 WebP türevleri hazırlandı; srcset/sizes ve doğal en-boy oranı kullanılır. Filo mevcut Praetorian artwork'ü, klan bölümü özgün orbitaldeck artwork'ü kullanır; eski ortak oyun assetleri yerinde kalır. Görsel/asset/sizing değişikliği tasarım istisnasıdır; browser DPR1/2 currentSrc ve screenshot ile doğrulanır. Native marketingasset dışlama aynı dizini kapsamaya devam eder.
