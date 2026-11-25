# Canlı güncelleme (OTA) ve sürüm farkına dayanıklılık — plan (2026-11-24)

**Durum:** Plan onaylandı (owner, 2026-11-24, §2). Kod yok.

## 1. Sorun ve hedef

Android uygulaması oyunun web kodunu içine paketliyor (`bundled: true`, `mobile-dist/native-production`). Web her gün değişiyor, Play sürümü haftalarca geride kalıyor. Sonuç:

- Her web değişikliği yeni AAB + Play incelemesi + `MIN_NATIVE_BUILD` zorlaması ister.
- Eski uygulama yeni sunucu verisini okuyamaz. 2026-11-24'te web'de bile aynı tür hata yaşandı: istemci şeması sunucunun gönderdiği alanı tanımadı (`probeMoonSchema`, `fleet` ↔ `fleetSize`) ve bütün İstihbarat sekmesi düştü.

**Hedef:**
1. Web değişikliği uygulamaya Play'e gitmeden, dakikalar içinde ulaşır. Uygulama kendi web paketini sunucudan günceller; yalnızca değişen dosyaları indirir.
2. Play'e yalnızca native kabuk değiştiğinde gidilir (izin, native eklenti, SDK). `MIN_NATIVE_BUILD` bu nadir durumun acil anahtarı olur.
3. Sunucu ile istemci arasındaki sürüm farkı tek bir alan yüzünden ekranı düşürmez; bozan değişiklik deploy'dan önce testte yakalanır.

**Değer:** RE-ENGAGEMENT (Android oyuncusu güncelleme duvarına çarpmaz), COMPETITION (herkes aynı kuralla oynar).

## 2. Owner kararları

| # | Soru | Öneri | Neden |
|---|---|---|---|
| K1 | Güncelleme sunucusu | **Kendi VPS'imiz** (owner seçti) | Ek ücret yok; paket her web deploy'unda VPS'te zaten üretiliyor; oyuncu verisi üçüncü tarafa gitmez. |
| K2 | Yeni paket ne zaman devreye girer? | **Oyuna girerken kontrol; yeni sürüm varsa ilerlemeli yükleme ekranı ("Güncelleme indiriliyor · 12/30 MB"), bitince oyun yeni sürümle açılır** (owner: "diğer popüler oyunlardaki gibi") | Oyuncu her zaman güncel sürümle oyuna girer, oyunun ortasında ekran yenilenmez. Arka plandan dönüşte yeni sürüm varsa yalnızca "Güncelleme hazır · Yeniden başlat" kartı çıkar, oyuncu seçer. Kurallar değiştiyse (426) aynı yükleme ekranı hemen açılır. |
| K3 | Kademeli yayın? | **Herkese birden; açılamayan paket kendiliğinden eskisine döner** (owner seçti) | ~42 aktif oyuncuda dilim anlamsız; güvence otomatik geri dönüş (EN-07). |

## 3. Bilinen gerçekler (koddan)

| # | Gerçek | Yer |
|---|---|---|
| G1 | Capacitor 8.5.3; native eklentiler: AsteraSession, AsteraDisplay, App, Network, Push, LocalNotifications. | `apps/web/package.json`, `android/app/src/main/java/...` |
| G2 | İstemci `x-astera-build` başlığında Android versionCode'u gönderir, ama değer **web paketine build anında gömülür** (`VITE_ASTERA_NATIVE_BUILD`). OTA'da web değişir, kabuk numarası değişmez: bu iki kimlik ayrılmalı. | `src/platform/updateGate.ts`, `mobileBuild.ts` |
| G3 | Sunucuda iki kapı var: `MIN_NATIVE_BUILD` (426, `x-astera-build`) ve kurallar kimliği (`x-astera-rules` ≠ `ECONOMY_PROFILE.id` → 426). | `apps/server/src/app.ts:354`, `services/placementGate.ts:158` |
| G4 | 426 gelince uygulama Play mağazasına yollar; web sayfayı yeniler. | `src/shell/UpdateRequired.tsx` |
| G5 | Paket 199 MB; JS ≈ 10 MB. Geri kalanı model (39 MB), arena (37), görsel (34), legacy (21), ref paketi (40), müzik (12). Dosya adları içerik hash'li; değişmeyen dosya aynı adla kalır, yani delta doğal olarak küçük olur. | `mobile-dist/native-production` |
| G6 | `apps/server/test/contract.test.ts` gerçek API cevaplarını web şemalarıyla zaten parse ediyor (95 test), ama ay verisi kapsanmıyor. Sonda ay okuması hatası bu boşluktan geçti. | `apps/server/test/contract.test.ts` |
| G7 | Play politikası (Device and Network Abuse): mağaza dışından çalıştırılabilir kod indirme yasağı, WebView'da çalışan JavaScript için geçerli değil. Uygulamanın amacını değiştirmeyen içerik güncellemesi serbest. | Play Console politika metni; F0'da güncel metin tekrar okunur. |

## 4. Yaklaşım

**Araç:** `@capgo/capacitor-updater` eklentisi, manuel modda, kendi sunucumuzla. Bulut hesabı kullanılmaz.
- Eklenti indirmeyi, paketi yerleştirmeyi ve "yeni paket açılmadıysa eskisine dön" işini yapar.
- Biz yalnızca "hangi sürüm var, hangi dosyalar" bilgisini VPS'ten veririz.
- **Yedek yol:** F0'da eklenti Capacitor 8 ile uyumsuz çıkarsa veya delta desteği kendi sunucuyla çalışmazsa, Capacitor çekirdeğindeki `WebView.setServerBasePath` / `persistServerBasePath` ile ince bir kendi eklentimizi yazarız. Mevcut AsteraSession eklentisiyle aynı desen.

**Akış:**
1. Web deploy'u yalnız webroot'u değil, `ota/<sha>/` altına uygulama paketini de yayınlar:
   - `manifest.json`: dosya → sha256, boyut.
   - Dosyalar içerik hash'iyle tekrar kullanılır.
   - `ota/latest.json`: `{ version: <web sha>, minShell: <versionCode>, rules: <ECONOMY_PROFILE.id>, manifest: <url> }`.
2. **Oyuna giriş (K2):** Açılışın marka sahnesinde (`OpeningScene`) uygulama `latest.json`'u okur.
   - Yeni sürüm varsa ve kabuk `minShell`'i karşılıyorsa sahne "Güncelleme indiriliyor" ilerlemesine geçer: yüzde, MB ve bir ilerleme çubuğu.
   - Yalnızca hash'i farklı dosyalar indirilir ve hash'ler doğrulanır. Bitince uygulama yeni paketle yeniden başlar ve oyun açılır.
   - Ağ yoksa ya da kontrol 5 sn içinde cevap vermezse oyun eldeki paketle açılır. Kural uyumsuzluğu ayrıca 426 ile yakalanır.
3. Yeni paket, ilk başarılı `/api/auth/me` cevabından sonra "hazırım" bildirir. Bildirmezse eklenti bir sonraki açılışta eski pakete döner.
4. **Arka plandan dönüş:** Uygulama en fazla 30 dakikada bir kontrol eder. Yeni sürüm varsa yalnızca "Güncelleme hazır · Yeniden başlat" kartı çıkar; oyuncu seçer, oyun kendi kendine yenilenmez.
5. **Kurallar değiştiyse** (sunucu 426 dönerse) aynı yükleme ekranı hemen açılır, paket indirilir ve oyun yeniden başlar. Play mağazası yalnızca kabuk `minShell`'in altındaysa önerilir.
6. **Oyun hissi:** Yükleme ekranı bir form değil, oyunun açılış sahnesinin parçasıdır.
   - İlerleme sahnedeki ışık ve halka üzerinden okunur, metin kısa ve anlamlıdır ("Yeni filo verileri alınıyor…" değil; "Güncelleme indiriliyor · 12/30 MB").
   - Bitişte kısa bir ses ve titreşim (`lib/sound`, `haptic`).
   - El kitabı: UI-ilgili bölüm ve `checklists.md` F3'te geçirilir.

**Kimlikler (G2):**
- `x-astera-build`: kabuğun gerçek versionCode'u. Çalışma anında native'den okunur, pakete gömülmez.
- `x-astera-web`: web paketinin git SHA'sı. Sunucu loglar ve Sentry `release` etiketine yazar (EN-05).
- `MIN_NATIVE_BUILD` yalnızca kabuğa bakar; anlamı değişmez.

## 5. Sürüm farkına dayanıklılık

1. **Sözleşme testleri (G6):** Ay verisi `contract.test.ts`'e eklenir: aylı dünyaya sonda, `/api/intel`, `/api/galaxy` ay listesi, gezegen ayı, Gözcü taramaları, aya saldırı raporu. Kural: sunucuya yeni bir JSON alanı ekleyen her iş, o alanı içeren gerçek cevabı web şemasıyla parse eden bir sözleşme testi de ekler (`docs/engineering-standards.md`'e yazılır).
2. **N-1 kontrolü:** Bir test betiği canlıdaki web sürümünün şemalarını (`git show <canlı sha>:apps/web/src/api/schemas.ts`) geçici bir dosyaya alır ve yeni sunucunun sözleşme cevaplarını onlarla da parse eder. Eski istemciyi kıracak değişiklik deploy'dan önce görülür. Deploy betiği bunu çalıştırır.
3. **Liste başına hoşgörü:** Sunucunun gönderdiği listeler (sonda raporları, radar kaydı, savaş raporları, bildirimler, kuyruklar) eleman eleman parse edilir:
   - Tanınmayan veya bozuk eleman atlanır ve Sentry'ye tek bir uyarı gider.
   - Sayfanın geri kalanı çalışır.
   - `chroniclePageSchema` bunu zaten yapıyor (`knownChronicleKinds`); aynı desen ortak bir yardımcıya taşınır.
   - Sayfanın kendisi bozuksa hata yine görünür. Hoşgörü yalnızca liste elemanı içindir, sessiz veri kaybı yaratılmaz.

## 6. Fazlar (adım → doğrulama)

| Faz | İş | Doğrulama |
|---|---|---|
| F0 Spike (½ gün) | Eklentiyi debug APK'ya kur. S22'de: kendi sunucudan indir, sonraki açılışta uygula, "hazırım" gelmezse geri dön, manifest ile kısmi indir. Lisans ve Capacitor 8 uyumu kontrol edilir; Play politika metni tekrar okunur. | Telefonda video veya ekran görüntüsüyle 4 senaryo; karar: eklenti mi, kendi eklentimiz mi. |
| F1 Kimlikler | `x-astera-build` native'den okunur, `x-astera-web` eklenir; Sentry release = web SHA; sunucu iki değeri loglar. | Testler: başlıklar doğru; `MIN_NATIVE_BUILD` yalnızca kabuğa bakıyor. |
| F2 Yayın | Web build betiği `ota/<sha>/manifest.json` + dosyalar + `latest.json` üretir; nginx `/ota/`'yı uzun önbellekle sunar; `latest.json` önbelleksiz. `latest.json` en son yazılır (atomik). | Betik testi: manifest hash'leri dosyalarla eşleşiyor; yarım yayın `latest.json`'u değiştirmiyor. |
| F3 İstemci | Açılışta kontrol + ilerlemeli yükleme ekranı (marka sahnesi); dönüşte "Güncelleme hazır" kartı; 426 akışı; delta indirme; "hazırım" bildirimi; 5 sn zaman aşımı ve çevrimdışı açılış. | Birim testleri (sürüm karşılaştırma, minShell, 426 akışı) + S22'de uçtan uca: web deploy → telefon 1 dk içinde yeni sürümde. |
| F4 Dayanıklılık | §5.1–5.3. | Sözleşme testleri yeşil; N-1 betiği bugünkü `fleet` hatasını eski şemayla yakalıyor (geriye dönük kanıt). |
| F5 Geçiş | Güncelleyicili kabukla AAB v15 → Play. Yayına girince `MIN_NATIVE_BUILD=15` son kez. Sonraki web deploy'ları OTA ile gider. `deployment.md` + hafıza güncellenir. | Play'deki v15 bir web deploy'unu Play'siz alıyor. |

**Tahmini iş:** F0–F4 ≈ 3–4 gün + telefon testleri. F5 Play incelemesine bağlı.

## 7. Riskler

- **Bozuk paket:** Açılmayan paket otomatik olarak eskisine döner. Bozuk ama açılan paket için sıradaki web deploy'u düzeltir; acil durumda `latest.json` bir önceki SHA'ya çevrilir (tek adım geri dönüş).
- **Mobil veri:** İlk OTA, v15'in paketinden farkı indirir. Sonrakiler genellikle birkaç MB JS. Büyük varlık değişikliğinde (yeni model paketi) indirme Wi-Fi'ı beklemez ama ilerlemeyi gösterir. Gerekirse sonradan "büyük güncellemeyi Wi-Fi'da indir" eklenir.
- **Native–web uyumsuzluğu:** Yeni web, kabukta olmayan bir native eklentiyi çağırırsa `minShell` yükseltilir. Bu durumda uygulama Play'e yönlendirir; `MIN_NATIVE_BUILD`'in yeni rolü budur.

## 8. İlerleme

| Faz | Durum |
|---|---|
| Owner kararları K1–K3 | Verildi (2026-11-24) |
| F0 Spike | Bitti (2026-11-25, S22). Karar: `@capgo/capacitor-updater` 8.54.2 (MPL-2.0), Capacitor 8 ile çalışıyor; kendi eklentimize gerek yok. Bulgular aşağıda. |
| F1 Kimlikler | Bitti (2026-11-25). `x-astera-build` açılışta `App.getInfo()` ile native'den okunur (2 sn sınır; okunamazsa gönderilmez), gömülü `VITE_ASTERA_NATIVE_BUILD` kaldırıldı. Native giriş/yenileme (`SessionHttp`) de kabuk numarasını gönderir; önceden sürüm kapısını atlıyordu. `x-astera-web` = derlemenin commit'i (`VITE_ASTERA_RELEASE`, Sentry `release` ile aynı); native derleme betiği temiz ağaçta HEAD'i verir, kirli ağaçta hiçbir commit iddia etmez. Sunucu her istek loguna geçerli değerleri `shell` / `web` olarak yazar; CORS `x-astera-web`'e izin verir. |
| F2 Yayın | Bitti (2026-11-26). `deploy.sh` aynı commit'i Docker `ota-dist` hedefiyle native paket olarak derler (VPS'teki ref paketi `--build-context refs=` ile salt-okunur bağlanır) ve `apps/web/otaPack.ts` ile paketler: `files/<sha256><uzantı>` (+`.gz`), `<sha>/manifest.json` (`file_name`, `file_hash`, `download_url`, `size`), `latest.json` (`version`, `minShell`, `manifest`). `deploy/publish-ota.sh` `/var/www/astera-ota`'ya yazar: önce dosyalar, sonra manifest, en son atomik `latest.json`; önceki sürüm `latest.previous.json`'da, `--restore-previous` tek adımda geri alır. nginx: `latest.json` `no-store` + CORS, manifest ve dosyalar 1 yıl immutable. Kök webroot dışında, çünkü web yayını webroot'u `--delete` ile eşitliyor. Plandaki `rules` alanı çıkarıldı: 426'da istemci yine `latest.json`'a bakar, ayrı alana gerek yok. `OTA_MIN_SHELL = 1` (güncelleyicisiz kabuk zaten okumaz). Eski sürümlerin temizliği henüz yok. |
| F3–F5 | Başlamadı |

### F0 bulguları (S22, `native-local` debug APK, `localhost:8099` üzerinden)

1. **A → B:** Kendi sunucudan manifest ile indirildi, `set()` ile anında yeniden yüklendi, B `notifyAppReady` çağırdı. İndirme ~2 sn.
2. **Bozuk C:** "Hazırım" gelmeyince eklenti B'ye kendiliğinden döndü ve C'yi sildi. **Ama** istemci C'yi hatırlamadığı için B açılır açılmaz C'yi yeniden indirip kurdu (30 sn'lik döngü). F3'te başarısız sürüm kalıcı saklanmalı (`updateFailed` olayı) ve aynı sürüm tekrar denenmemeli; düzeltme ancak yeni bir sürümle gelir.
3. **Delta:** 205 MB'lık paketin (1324 dosya) yalnız değişen 94 dosyası indi: **7,4 MB** (93 JS + `index.html`). Görseller ve sesler hash'leri uygulamadakiyle eşleştiği için inmedi. Yalnız bir ortam değişkeni değişse de Vite JS parça hash'lerini zincirleme değiştiriyor; tipik web deploy'u bu boyda olur.
4. **Zaman aşımı:** `appReadyTimeout: 10000` verildi ama yeni (pending) paket için eklenti en az **30 sn** bekliyor (`PENDING_BUNDLE_APP_READY_MIN_TIMEOUT_MS`). Bozuk paket en geç ~30 sn'de geri döner; F3 yükleme ekranı bunu hesaba katmalı.
5. **Gizlilik:** Eklenti varsayılan olarak Capgo bulutuna istatistik gönderiyor (`Stats batch sent successfully`). `statsUrl: ''` ile kapatıldı; üretim yapılandırmasında zorunlu (K1).
6. **Sunucu şartları:** Native kabuk CSP'si `connect-src`'yi API kökenine kısıtlıyor; `latest.json` API kökeninden (`/ota/`) sunulmalı. Farklı köken kullanılırsa CORS başlığı gerekir. Dosya indirmeleri native tarafta olduğundan CSP'den etkilenmiyor.
7. Play politika metni F5'ten önce tekrar okunacak (G7; F0'da okunmadı).
