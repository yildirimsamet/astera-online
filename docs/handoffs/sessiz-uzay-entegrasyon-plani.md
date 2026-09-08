# Sessiz Uzay — inaktif komutan taşıma ve sıralı dönüş entegrasyonu

> **Devir teslim / uygulama planı.** Hazırlanma: 8 Eylül 2026. İncelenen commit: `f1fa09d`.
> İkinci inceleme: 8 Eylül 2026. Kilitler, kuyruk canlılığı, sensör izolasyonu ve olay işleme sınırları kodla yeniden karşılaştırıldı.
> Bu çalışma yalnızca dokümandır. Kod, şema, migration ve canlı veri değiştirilmemiştir.
> Hedef okuyucu: konuşmayı hiç görmemiş, bu özelliği test ederek uygulayacak agent.
> Aşağıdaki yeni dosya, tablo, alan ve endpoint adları **önerilen sözleşmelerdir; henüz mevcut değildir.**

## 1. İstek ve amaç

Kullanıcının isteği: Oyuna iki gün girmeyenlerin gezegenlerini silmek yerine ayrı bir normal oyun sunucusuna taşımak. Bu sunucudaki oyuncular ana sunucuya dönmek için başvurabilmeli. Ana sunucudan yeni inaktif oyuncular taşındığında açılan yerlere, başvuru sırası gözetilerek geri alınmalılar.

Amaç, ana galaksilerdeki sınırlı komutan koltuklarını aktif oyunculara açarken geri dönen oyuncunun emeğini korumak. Oyuncu hesabını, komutanını ve geliştirdiği dünyaları kaybetmeden oynamaya devam etmeli. Bekleme galaksisi bir hesap arşivi veya dondurulmuş ekran değildir.

Başarı ölçütleri:

- İnaktivite nedeniyle hiçbir komutan, başkent, koloni veya kişisel ilerleme silinmez.
- Güvenle taşınabilecek 48 saatlik inaktif insan oyuncular ana galaksiden çıkarılır.
- Bekleme galaksisinde ekonomi, inşa, araştırma, keşif, uçuş, PvP ve normal galaksi olayları çalışır.
- Dönüş başvuruları kalıcı ve deterministik sıradadır; yeniden başlatma veya iki worker sıralamayı bozmaz.
- Kapasite aşılmaz; uçuşlar kaybolmaz; komutan iki galakside birden bulunamaz.
- Oyuncu bulunduğu galaksiyi, taşınma nedenini ve dönüş durumunu görebilir.

**Vaat sınırı:** “Ana sunucuda sürekli aktif oyuncular” teknik olarak “48 saatten uzun süredir gelmeyen, güvenli taşınmaya uygun insan oyuncu birikmemesi” demektir. Uçuşu/çatışması devam eden kişi geçici olarak kalabilir. Bu mekanizma eşzamanlı çevrimiçi nüfus garantisi vermez.

## 2. Kesin gereksinimler ve planın varsayımları

### 2.1 Kullanıcı tarafından açıkça istenenler

1. İnaktivite eşiği iki gündür.
2. Silme yerine bekleme sunucusuna taşıma yapılır.
3. Bekleme sunucusu normal oynanabilir bir sunucudur.
4. Geri dönüş oyuncunun başvurusuna bağlıdır; giriş yapmak tek başına geri taşımaz.
5. Yer açıldığında başvuru sırası uygulanır.
6. **Son kullanıcı düzeltmesi:** Ana sunucuya dönenler, ana sunucudan gönderilen oyuncuların boşalttığı konumlara yerleşir. Ana dönüş için yeni koordinat üretilmez.
7. Bu teslimatta kodlama yapılmaz; uygulanabilir bir devir dokümanı hazırlanır.

### 2.2 Bu planın uygulama varsayımları

Bunlar mevcut ürün kararı gibi sunulmamalı; uygulama sırasında yeni karar kaydında açıkça işaretlenmelidir. Kullanıcının sonraki talimatı bunların önüne geçer.

| Konu | Bu planın varsayımı / gerekçesi |
|---|---|
| Görünen ad | **Sessiz Uzay**, EN: **Silent Space**. “Sonsuz” kapasite vaadi vermemek için tercih edildi. Sabit teknik kimlik isimden bağımsızdır. |
| Sunucu anlamı | Mevcut PostgreSQL/API/worker içinde ayrı `shard + season`. İlk sürüm yeni VPS veya ayrı DB gerektirmez. |
| Ana sunucu | Mevcut `EU-1` ve `EU-2` ana galaksilerdir. Her komutan ayrıldığı ana shard'a döner; galaksi seçerek rekabetten kaçış eklenmez. |
| Taşınan birim | Komutan + o anda kontrol ettiği başkent ve tüm koloniler. Yalnızca başkenti taşımak çoklu dünya sahipliğini bozar. |
| İnaktivite | `max(lastActiveAt, joinedAt, sonAnaYerlesimZamani) + 48 saat <= serverNow`. Takvim günü değil kesintisiz süre. |
| Aktivite tanımı | İlk sürüm mevcut kimliği doğrulanmış API isteği ölçütünü kullanır. Arka plan polling'i de sayılabilir. Kullanıcı etkileşimi ölçümü ayrı kapsamdır. |
| Dönüş sırası | Hedef ana shard başına uygun başvurular arasında FIFO; geçici engeli olanın başvurusu ve sequence değeri korunur. Başvuru zamanı DB'den gelir; işlem içinde verilen sıra numarası bağlayıcıdır. |
| Yeni kayıt önceliği | Dönüş başvurusu varken **inaktiviteyle boşalan adresler** dönüşlere ayrılır. Hiç kullanılmamış başkent slotları yeni kayda açık kalır; bütün galaksinin kayıt akışı durdurulmaz. |
| Kuyrukta tekrar inaktif olma | 48 saat aktivite göstermeyen başvuru `EXPIRED` olur. Tekrar başvuru yeni sıradır. Bekleme gezegeni yine silinmez. |
| Klan | Galaksiler arası üyelik yok. Taşıma anında olağan klan ayrılığı uygulanır; dönüş eski üyeliği otomatik geri vermez. |
| Sezon | Özellik sezon sıfırlamasını kaldırmaz. Aynı sezon döngüsü içinde ilerleme taşınır; mevcut sezon sonu sıfırlaması bekleme galaksisini de kapsar. |
| Botlar | Ana shard'larda mevcut bot davranışı sürer; sessizleşen botu da silme. Bekleme shard'ında otomatik bot çoğaltma yok; taşınmış bot normal komutan olarak kalabilir. Bot otomatik dönüş başvurusu yapmaz. |
| Ana dönüş konumu | Kaynak ana galaksiden inaktiviteyle çıkarılan dünyaların tam `slotIndex/x/y/z` adresleri kullanılır; rastgele/yeni koordinat seçilmez. |
| Koruma | Taşınma yeni başlangıç ödülü, ücretsiz yakıt, dokunulmazlık veya yeni oyuncu koruması vermez. |

**Önemli ürün sınırı:** Kullanıcı “sezon sonunda da gezegenler hiç silinmesin” derse bu planın sezon kararı değişir. Kalıcı gücü sezonlar arasında taşımak mevcut oyunun “yeni sezon, eşit başlangıç” kuralını değiştirir; bunu bu özelliğin içine sessizce eklemeyin.

**Kullanıcı kararı (8 Eylül 2026):** “Sıra uygun oyuncuya verilsin ama geçemeyen oyuncu unutulmasın.” Uygun başvurular arasında en eski sequence seçilir. Uçuş veya yetersiz koloni adresi gibi geçici engeller başvuruyu kapatmaz, sequence/requestedAt değiştirmez ve oyuncuyu kuyruğun sonuna atmaz. Her değerlendirme turunda eski başvurular yeniden sınanır; engeli kalkmış oyuncu kendisinden yeni uygun başvurulardan önce döner. Bu karar aşağıdaki eski katı FIFO varsayımının yerini alır.

## 3. Mevcut proje: agent'ın bilmesi gerekenler

Önce `CLAUDE.md` okuyun. `AGENTS.md` yalnızca oraya yönlendirir. Teknik yapı TypeScript, Fastify, Drizzle ORM, PostgreSQL, SSE, React/Vite/TanStack Query'dir. NestJS veya Prisma değildir. Kurallar `packages/rules` içinde saf fonksiyonlardır; zaman, DB ve rastgelelik ortamdan okunmaz.

### 3.1 İncelenen davranış ve dosya haritası

| Mevcut dosya | Mevcut davranış / bu işte görevi |
|---|---|
| `packages/rules/src/constants.ts` | `SERVERS.count = 2`, kapasite 300, `idleDays = 3`, online 5 dakika, günlük nüfus 24 saat. Yeni 48 saat kuralı tek kaynaktan okunmalı. |
| `apps/server/src/services/reclaim.ts` | `reclaimIdleSeats`: live sezonun eski aktivite/join tarihli başkent sahiplerini seçer, player'ı kilitleyip aktiviteyi tekrar okur, uçuş varsa erteler; klanı uzlaştırır, lifetime kaydını katlar, bağlı verileri yıkıp player/dünyaları siler. Yeni taşıma yolunda `demolish` ve `foldRecord` çağrılmayacak. |
| `apps/server/src/worker/loop.ts` | Eski reclaim 10 dakikalık ayrı bakım işidir; hatası olay kuyruğunu durdurmamalıdır. Yeni iş küçük batch ve süre bütçesiyle aynı ilkeyi korur. |
| `apps/server/src/services/presence.ts` | `lastActiveAt` günceller; process içi 60 saniyelik throttle; DB hatasını yutar. `lastSeenAt` farklı amaçlıdır, inaktivite için kullanılmaz. |
| `apps/server/src/routes/auth.ts` | `requireAuth` presence çağırır; `/api/auth/me` oturum ve yerleşim için otoritedir. |
| `apps/server/src/services/servers.ts` | Listeyi resmi ordinal aralığına ve iki sunucuya sınırlar; `frontierOrdinal`, `resolveJoinTarget`, `currentPlacement`, bootstrap ve global wipe burada. Yalnızca üçüncü shard eklemek yeterli değildir. |
| `apps/server/src/services/player.ts` | `joinSeason` yeni komutan ve başlangıç dünyası yaratır; slot/account çakışmalarını retry eder. Taşıma bunu çağırmaz. Yeni kayıt kapasite kilidini dönüşle paylaşmalı. |
| `apps/server/src/services/season.ts` | Seed tabanlı harita, `createSeasonIn`, neutral dünyalar, olay takvimi, sezon olayları. `occupiedSlots` yalnız başkentleri sayar. |
| `apps/server/src/db/schema.ts` | `players.accountId` global unique; `players.seasonId` mevcut konum; `planets.seasonId`, `slotIndex`, `x/y/z`; başkent unique; sezon-slot unique. Koloni sayısı ile komutan kapasitesi ayrı konulardır. |
| `apps/server/src/services/ownership.ts` | `commanderTopology`, `lockWorlds`, kontrol/devir işlemleri. `lockWorlds` birden fazla season'ı reddeder; taşıma için doğrudan kullanılamaz. |
| `apps/server/src/services/planet.ts` | Sezon kilidi, ekonomi/gezegen işlemleri, hata sözleşmeleri. |
| `apps/server/src/services/galaxyEvents.ts` | `lockGalaxyEventAudience` üyelik ve olay anını eşleştirir. Taşıma giriş/çıkıştır; iki tarafın audience kilidine entegre olmalı. |
| `apps/server/src/worker/handlers.ts` | Uçuşlar, zamanlı işlemler, `onSeasonEnd`, `onSeasonRollover`. Sezon sonu handler'ı kodda var; manueldeki “handler yok” notu burada eskimiş. |
| `apps/server/src/services/sensorHistory.ts` | Galaksiye ve koordinata bağlı sensör geçmişi; kaynak epoch kapanır, hedefte yenisi açılır. |
| `apps/server/src/services/reports.ts` | Tarihi rapor okumaları. Eski olayın gezegenine join edip yeni konumu tarihmiş gibi göstermemeli. |
| `apps/server/src/services/clan.ts`, `clanCombat.ts` | Üyelik, lider devri, ateşkes, yardım ve değişmez savaş/klan kayıtları. |
| `apps/server/src/routes/session.ts`, `stream/bus.ts`, `services/streamRegistry.ts` | Stream bağlanırken komutanın season'ına abone olur. Taşıma sonrası eski abonelik mutlaka kapatılmalı. |
| `apps/server/src/routes/health.ts` | `idleSeatCount` yalnız raporlama içindir. `/health` taşıma veya onarım başlatmaz. |
| `apps/server/src/services/bots/` | Live galaksilerde otomatik bot yerleştirme/presence; bekleme rolüne göre filtreleme gerekir. |
| `apps/web/src/session/useSession.ts`, `useEventStream.ts`, `shardEvents.ts` | Auth yerleşimi, ready durumu, yeniden bağlanma ve cache yenileme. Taşınma “hesap çıkışı” veya “yeni oyuncu” değildir. |
| `apps/web/src/api/client.ts`, `schemas.ts`, `keys.ts` | Yeni endpoint ve placement sürümü; Zod sözleşmeleri ve galaksi cache izolasyonu. |
| `apps/web/src/screens/ServersScreen.tsx`, `shell/MenuPanel.tsx` | Ana sunucu listesi ve bekleme/dönüş kontrol yüzeyi. |
| `apps/web/src/i18n/locales/tr/`, `en/` | Bütün yeni kullanıcı metinleri iki dilde burada. |

Okunacak tasarım kayıtları: `docs/game-design.md`, `docs/decisions.md` içindeki D21/D70/D85/D88/D97/D100/D114/D134/D151/D159/D167; ayrıca `docs/architecture.md`, `docs/engineering-standards.md`, `docs/interface.md`, `docs/deployment.md`.

Mevcut geri kazanım kodu bağımlılık envanteri için değerlidir; **silme listesini UPDATE listesine çevirerek migration yazmayın.** Bir referansın varlığı o satırın taşınacak oyuncuya ait olduğu anlamına gelmez.

## 4. Mimari ve kapsam

### 4.1 Galaksi rolü

`shards.role = MAIN | WAITING` ekleyin; mevcut shard'ları `MAIN` backfill edin. Rol, ada veya `ordinal > 2` varsayımına bağlanmaz. `SERVERS.count` ana sunucu sayısı olarak anlamını korur; waiting sayısı ayrı yönetilir.

İlk bekleme shard'ı `WAIT-1`, görünen adı Sessiz Uzay olsun. Ana shard frontier hesabı sadece `MAIN` kullanır. Waiting, oyuncunun normal kayıt/join akışıyla seçebileceği bir alternatif değildir. Mevcut oyuncu auth placement üzerinden waiting'e girer ve normal oyunu açar.

Bekleme shard'ları normal 300 komutan sınırını korur. Dolunca `WAIT-2`, `WAIT-3` oluşturulabilir; UI “Sessiz Uzay · 2” gösterir. Tek haritayı sınırsız büyütmeyin. İnsan sayısı sınırsız bir harita hem 300 kişi kısıtına hem sorgu/3D performansına aykırıdır. Otomatik açılış kapasite/provisioning kilidiyle idempotent olmalı. Operasyonel shard sınırına ulaşılırsa kaynak oyuncu güvenle yerinde kalır, kapasite alarmı oluşur; silme fallback'i yoktur.

### 4.2 Aynı sezon döngüsü

Shard season'ları farklı kimlikler taşır; bu projede `seasonId` aynı zamanda mekânsal izolasyon anahtarıdır. Dolayısıyla `players.seasonId` değiştirmek sıradan metadata güncellemesi değildir.

`seasons.cycleId` ve küçük bir `season_cycles` tablosu önerilir: `id, startsAt, endsAt, status`. Aynı rekabet dönemi ana ve bekleme season'ları aynı cycle'a bağlanır. Taşıma yalnız aynı cycle, aynı ruleset ve iki live season arasında yapılır; `now < endsAt` zorunludur. Var olan season başlangıç/bitişini topluca değiştirmeyin. Legacy dönemlerin sınırları farklıysa ayrı cycle olarak eşleyin ve uygun waiting season açın.

Dönem ortasında açılan waiting season kaynakla aynı `startsAt/endsAt` taşır. `createSeasonIn` şu an endsAt'i startsAt+days ile üretiyor; waiting için kesin endsAt girdisi/uyumluluk kontrolü ekleyin, yuvarlanmış kalan gün kullanmayın. Ancak geçmiş olayların hepsini yeni oyunculara yeniden yaymayın: bootstrap geçmiş occurrence durumunu doğru kurmalı, yalnız güncel/gelecek olayları programlamalıdır. Merchant/asteroid RNG akış sırasını değiştirmeyin. `createSeasonIn` için bu kullanımın ayrı testi olmalı.

### 4.3 Komutan kimliği korunur

`accounts.id`, `players.id`, taşınan `planets.id` aynı kalır. Yeni account/player veya başlangıç sermayesi oluşturulmaz. `players_account_idx` korunur. Bir işlem içinde tüm sahip olunan dünyalar hedef season'a geçer.

`joinedAt` değiştirilmez; yeni oyuncu koruması ve eski istatistikler yeniden başlamaz. `lastActiveAt` sistemce sahte şekilde güncellenmez. Dönüşte `mainEnteredAt` konur; bu yeni koltukta 48 saatlik alt sınırı sağlar. İlk taşıma otomatik geri dönüş yaratmaz.

## 5. Önerilen veri modeli ve DB güvenceleri

Alan adları implementation sırasında tutarlı biçimde uyarlanabilir; aşağıdaki anlamlar kaybolmamalı.

| Tablo / alan | Sözleşme |
|---|---|
| `shards.role` | MAIN/WAITING; NOT NULL, legacy MAIN. |
| `season_cycles`, `seasons.cycleId` | Aynı dönem uyumluluğu ve freeze/rollover koordinasyonu. |
| `players.homeShardId` | İlk ana yerleşim shard'ı; waiting'de değişmez, dönüş hedefidir. |
| `players.placementVersion` | Her başarılı taşımada +1. Eski HTTP/stream/cache bağlamının çitidir. |
| `players.mainEnteredAt` | Ana galaksiye en son giriş; legacy `joinedAt` ile doldurulur. |
| `return_applications` | `id, playerId, cycleId, targetShardId, sequence, status, requestedAt, expiresAt, updatedAt, closedAt, closedReason`. `expiresAt` son başarılı aktiviteden 48 saat sonrasıdır; süre aşılmadan gelen aktivite uzatır, aşıldıktan sonra giriş eski sırayı diriltmez. |
| Başvuru durumları | `QUEUED, COMPLETED, CANCELLED, EXPIRED, SEASON_ENDED`. BUSY/FULL bir terminal durum değil, anlık engel nedenidir. |
| `return_queue_counters` | `(cycleId,targetShardId)` unique; kilit altında monoton sıra dağıtır. Duvar saati eşitliği ve commit sırası yarışı çözülür. |
| `commander_transfers` | `id, playerId, accountId, cycleId, direction, sourceSeasonId, targetSeasonId, fromPlacementVersion, toPlacementVersion, applicationId?, committedAt, reason`. Commit edilen transferin kalıcı denetim kaydı. |
| `transfer_worlds` | `transferId, planetId, old/new season, old/new slot ve koordinatlar`; konum geçmişi ve hata incelemesi. |
| `placement_outbox` | `id, playerId/accountId, transferId, placementVersion, kind, payload, createdAt, deliveredAt`; commit sonrası yönlendirme ve tekrar denemeye dayanıklı dağıtım. |
| `main_vacancies` | `id, cycleId, seasonId, departureTransferId, departedPlanetIdSnapshot, kind, slotIndex, x/y/z, createdAt, consumedAt, consumedReason, consumedByTransferId?, consumedByPlayerIdSnapshot?`; inaktiviteyle boşalan gerçek adres. Açık `(seasonId,slotIndex)` unique. Başkent/koloni türü korunur. |
| Harita yerleşim metadata'sı | Seçilen yerleşim modelinin sürümü ve göç slotlarının sabit tanımı; aşağıdaki harita bölümüne göre. |

Zorunlu DB sınırları:

- Player başına en fazla bir `QUEUED` başvuru: partial unique index.
- `(cycleId,targetShardId,sequence)` unique. Sequence API'de gerekirse string; JS güvenli tamsayı sınırını aşan bigint'i Number'a çevirmeyin.
- `(playerId,fromPlacementVersion)` transfer unique; bir yerleşim iki kez taşınamaz.
- Completed başvurunun tek transferi: `applicationId` non-null değerlerde unique.
- Başkent oyuncu unique ve `(seasonId,slotIndex)` unique kalır.
- Canlı season'ın shard başına tekilliğini DB ile güçlendirin; legacy duplicate olup olmadığını migration öncesi raporlayın.
- Durum/alan tutarlılığı CHECK: kapalı başvuru `closedAt` taşır; queued taşımaz; transfer version tam +1'dir.
- Yeni tabloları test temizliğine, kontrollü global wipe'a ve şema drift testine ekleyin. FK cascade varsaymayın.

Migration önce ekleyici olmalı. Mevcut migrasyonları değiştirmeyin; sıradaki numarayı repository'den bulun. Yeni enum değerinin aynı transaction'da kullanımı PostgreSQL migration düzenine göre ayrılmalı. Audit'i sezon sıfırlamasında koruyacaksanız canlı `players` FK'sini silmeyi engelleyecek şekilde bırakmayın: nullable `ON DELETE SET NULL` ile immutable `playerIdSnapshot/accountId` veya arşiv tablosu kullanın. Aynı politika application/world audit referansları için de tanımlanmalı.

## 6. Konumlandırma: ana sunucuda boşalan adresi devralma

**Bu bölüm kullanıcının son düzeltmesini uygular:** “Ana serverdan yolladıklarımızın yerine konumuna geçsinler.” Ana sunucuya geri dönüşte yeni koordinat veya göç koloni havuzu oluşturulmaz. Dönen dünya, gönderilen dünyanın eski `slotIndex` ve `x/y/z` değerlerini aynen alır.

### 6.1 Kalıcı boş adres kaydı

Ana→waiting transferi içinde, taşınan her dünyanın **kaynak adresi** `main_vacancies` tablosuna yazılır. Başkent ve koloniler ayrı türde kaydedilir. Bu kayıt ve dünyanın kaynaktan ayrılması aynı transaction'dır. Böylece worker yeniden başlasa veya dönüş başvurusu sonradan gelse de boşalan konum kaybolmaz.

Dönen komutanın başkenti en eski uygun boş **başkent** adresine; kolonileri boş **koloni** adreslerine geçer. Aynı zamanda boşalan adreslerde sıralama `(createdAt, departureTransferId, slotIndex)` ile deterministik olsun. Kaynak ve hedef cycle/season eşleşir. Komutanın kendi eski adresine dönmesi şart değildir; sırayla açılan adresi devralır. Yeni başkent adı, bina veya kaynak verilmez: gelen oyuncunun kendi dünyası yalnız adres değiştirir.

Örnek: EU-1'de A oyuncusu başkent slotu 42'den Sessiz Uzay'a gönderildi. Dönüş sırasının başındaki B'nin başkenti EU-1 slotu 42'ye, A'nın eski koordinatlarına gelir. A'nın gezegen UUID'si B'ye verilmez; A kendi gezegeniyle waiting'dedir, B kendi gezegeniyle boşalan adrese yerleşir. A'nın eski raporları, enkazı ve istihbaratı B'nin gezegenine bağlanmaz.

### 6.2 Koloni sayısı farklı olduğunda

Oyunda komutan başına bir başkent ve en fazla üç koloni var. Bir başkentli A'nın yerine başkent + üç kolonili B'yi getirirken tek boş koordinat dört dünyaya yetmez. Kullanıcı bütün bu farklılıkları ayrıca tanımlamadığı için bu planın varsayımı:

- Başkent için bir başkent vacancy; her koloni için bir koloni vacancy gerekir.
- Tek ayrılan oyuncunun adresleri yetmezse aynı ana season'da farklı inaktif oyunculardan boşalan koloni adresleri bir araya getirilebilir.
- Bütün dünyalara uygun adres yoksa **hiçbir dünya taşınmaz**. Başvuru ve eski sıra numarası korunur; uygun sonraki başvuru değerlendirilebilir. `WORLD_SLOTS` nedeni gösterilir.
- Kullanılmayan koloni adresleri sonraki dönüşler için boş kalır; neutral dünya üretilmez. Mevcut neutral veya aktif oyuncu dünyası silinip yerine yazılmaz.
- Başkent→koloni veya koloni→başkent slot dönüşümü yapılmaz; mevcut harita slot sınıflaması ve yeni kayıt tahsis algoritması bozulmaz.

**Bu birleşimin canlılık sınırı var:** komutan koltuğu boş olsa da koloni konumu yetersizliği dönüşü sezon sonuna kadar engelleyebilir. Bekleme galaksisinde normal oyunla yeni koloni edinilmesi de bu durumu yaratabilir. Koloni bırakma zorunluluğu veya yeni koordinat üretimi bu plana dahil değildir.

Somut durum: MAIN'de hiç koloni vacancy yokken A üç kolonisi nedeniyle dönemiyorsa, daha yeni başkent-only B uygun boş başkent adresine dönebilir. A QUEUED kalır ve sequence değeri değişmez. Üç koloni adresi açıldığında A, kendisinden yeni uygun C'den önce değerlendirilir. Bu tercih kuyruğun tamamının A nedeniyle durmasını önler; A için yeterli adresin mutlaka açılacağını garanti etmez. Yeni MAIN koordinatı üretme veya koloni silme eklenmez.

### 6.3 Yeni kayıtlarla adres yarışı

Queued dönüş varsa inaktiviteyle boşalan başkent adresini yeni join/bot tüketemez. Ancak hiç kullanılmamış başkent adresine yeni kayıt yapılabilir. Kuyruk yoksa olağan yeni kayıt bu boş başkent adresini kullanabilir; aynı kapasite kilidi altında ilgili vacancy `consumedReason=JOIN`, player snapshot ve consumedAt ile kapatılır. Herhangi bir şekilde dolmuş adrese ait stale vacancy dönüşte kullanılamaz: `planets` gerçek doluluğu ve unique index final otoritedir.

Dönüş yalnız `main_vacancies` üzerinden yapılır. Ana galaksinin hiç kullanılmamış başlangıç slotları otomatik dönüş alternatifi değildir; bunlar olağan yeni kayıt alanlarıdır. Böylece kullanıcının “gönderilenin yerine geçme” kuralı korunur. Bir dönemden kalan vacancy yeni döneme taşınmaz. Dönüşte bütün seçilmiş vacancy satırları ve gezegen yerleşimleri aynı transaction'da tüketilir.

### 6.4 Bekleme galaksisine ilk yerleşim ayrı bir problemdir

Ana tarafta eski adresi devralmak **waiting'de yer yaratmaz**. Her galaksinin koordinat/slot alanı ayrı olduğu için kaynak `slotIndex`i waiting'e körlemesine kopyalamayın. `WAIT-1` farklı MAIN shard'lardan aynı slot numaralı dünyaları alabilir.

Waiting başkenti kendi boş başkent adresine yerleştirilir. Koloniler için waiting'e özgü, başkent ve mevcut authored neutral adreslerle çakışmayan deterministik göç slot havuzu kullanılır. Kaynak koordinatları taşınacak varlığın kimliği değildir; waiting koordinatları değişebilir. Yeni havuz yalnız WAITING rolünde geçerlidir; MAIN harita üretimi değişmez.

Waiting yerleşiminin gereksinimleri:

1. Komutan kapasitesi 300 olarak kalır; fiziksel dünya slot kapasitesi ayrı hesaplanır.
2. Havuz ayrı seeded stream ve yerleşim sürümüyle üretilir. Mevcut gerçek dünyalar engeldir ve koordinatları sabit kalır. Bütün web/server okuyucuları aynı tanımı kullanır.
3. Sadece adres üretin; önceden 900 boş koloni veya ücretsiz kaynak yaratmayın. Dolu slotu overwrite etmeyin.
4. Hedef waiting'de bütün dünyalara adres bulunamazsa başka uygun waiting shard'ı deneyin veya yenisini açın. Operasyonel sınıra gelinirse ana oyuncu yerinde kalır, transfer ertelenir.
5. Waiting'den dönen dünyanın boş adresi yeniden kullanılabilir. Normal oyunla neutral olan eski göç kolonisi dolu sayılır; bu yüzden kapasiteyi yalnız oyuncu sayısından türetmeyin.
6. Maksimum geometrik yoğunluğu seed deneyiyle ölçün. Mesafe veya galaksi radius'unu bu özellik için değiştirmeyin; fiziksel sınırda başka waiting shard'a geçin. 300 kişi + üçer koloni tek haritada doğrulanmadıkça desteklenmiş sayılmaz.

İlk teknik deneme, MAIN için vacancy tüketimi ve WAITING için çakışmasız allocator testidir. 3D'de 375×812 normal ve yoğun waiting sahnesini ölçün. MAIN'de aynı konumun yeni dünya UUID'siyle görünmesi eski craft focus/memory bağlarını yeni kişiye aktarmamalıdır.

## 7. Taşıma işlemi: hazırlık, kilit, commit

### 7.1 Güvenli taşıma uygunluğu

`inspectTransferBlockers(tx, topology, now)` gibi tek servis hem gidişte hem dönüşte kullanılsın. Salt geçmiş kayıtları engel saymayın; gerçek devam eden etkileşimleri sayın.

Aşağıdakiler sürüyorsa taşıma ertelenir:

- `missions.status = in_flight`: ownerPlayerId, origin veya target taşınan komutan/dünyalara bağlı; saldırı, probe, transfer, settlement, klan yardımı ve 10 saniyelik engagement dahil.
- `pirate_raids` ve `trade_runs`: pad **veya ownerPlayerId** üzerinden outbound/returning. Başkası tarafından ele geçirilmiş eski pad de hesaba katılır.
- `mining_runs`: taşınan pad, komutanın ona bağlı craft'ı ve kaynak gezegendeki enkazı hedefleyen üçüncü kişi uçuşları. Madencilik ile salvage aynı tabloda.
- Oyuncunun gemisinin kendi kontrol etmediği pad'de kalması veya kendi pad'inde yabancı gemi bulunması: mülkiyet güvenle normal kurallarla çözümlenene kadar ertele.
- Devam eden stratejik uçuş/interception, aktif recovery/claim sonucu veya henüz uygulanmamış sahiplik kararı.
- Taşınacak kişisel event'in `processing` olması, retry/failed durumunda sonucu belirsiz kalması. Worker lease/reaper ile güvenli duruma gelsin; event'i körlemesine tekrar oluşturmayın.
- Sezon freeze/rollover başlamış, ruleset/cycle uyuşmuyor, destination kapasitesi/slotları yetersiz.

İnşa, araştırma ve pad üzerindeki BUILDING/PAUSED stratejik varlığın sadece kuyrukta olması engel değildir; bunlar taşınır ve mevcut tamamlanma zamanlarını korur. Recovery gibi sahiplik sonucu üreten bir deadline için ilk sürüm erteleme daha güvenlidir.

**Bu plan uçuş iptali, anlık iniş veya zorunlu recall eklemiyor.** Sürekli saldırıya uğrayan inaktif komutanın taşınması uzun sürebilir. Ertelenme süresi ve nedenleri operatöre görünür olur. Saldırı yasağıyla “boşaltma modu” eklemek PvP kuralı değişikliği olduğundan ayrı karar gerektirir.

### 7.2 Kilit protokolü

Sadece transfer transaction'ına kilit koymak yetmez; join, capture/settle, launch, queue handler ve sezon sonu aynı sınırları tanımalıdır.

Hedef protokol: global lifecycle/provisioning koordinasyonu gerektiğinde → hedef admission/kapasite advisory kilidi → ilgili season satırları ID sırasıyla → ilgili clan satırları ID sırasıyla → bütün ilgili player'lar ID sırasıyla → dünyalar ID sırasıyla → kişisel event/queue/vacancy satırları.

**Kilit kipleri bağlayıcıdır:** Mevcut `lockSeason` ve audience membership çağrısı `FOR SHARE` alır; bu iki taşımanın veya taşıma ile yeni launch'ın birbirini dışlamasını sağlamaz. İlk sürümde transfer kaynak ve hedef season satırlarını baştan `FOR UPDATE` alır; ordinary gameplay mevcut `FOR SHARE` ile devam eder. Aynı transaction'da önce SHARE alıp sonra UPDATE'e yükseltmeyin. Transfer season kilidini kısa `NOWAIT`/transaction-local timeout ile alamazsa tamamen rollback edip sonraki turda dener. Böylece yeni flight/capture, blocker okuması ile commit arasına giremez. Uzun operasyon/harita üretimi bu kritik kesimde yasaktır.

**Mevcut somut klan tuzağı:** `reconcileClanPlayerReclaim` önce clan, sonra üyelerin player satırlarını kilitler. Önce taşınan player'ı kilitleyip bu helper'ı çağırmak normal clan mutation ile ters sıra/deadlock yaratabilir. Transfer önce season kilitlerini, ardından clan ve bütün etkilenebilecek üyeleri aynı sırayla almalı; helper parçaları buna uygun kullanılmalıdır. Normal ayrılma endpoint'ini çağırmayın: gönüllü ayrılmanın cooldown retleri zorunlu taşımayı durdurmamalı. Zorunlu çıkış üyeliği sonlandırır, lider/ateşkes/üyelik kilidi sonuçlarını yine üretir.

Presence yalnız player → o player'ın application satırı kilidini kullanır; sonra season/clan/admission kilidine geri dönmez. Ordinary gameplay, event handler, admin araçları ve bot mutasyonlarında season kilidini atlayan yollar varsa transfer açılmadan kapsanmalıdır. Global wipe/provisioning önce kendi ortak lifecycle kilidini alır; season'ı tutup sonradan bu global kilide dönmez.

`lockGalaxyEventAudience`, `lockSeason`, `lockWorlds`, `joinSeason`, `onSeasonEnd` mevcut sıraları uygulama öncesi çıkarılmalı. Yeni helper bunlarla ters sıra kurmamalı. Global wipe'ın mevcut advisory kilidi ile cycle koordinasyonunu ortaklaştırın. Başka oyuncunun pad'ini kapsayan normal bir işlemde de player → planet sırası korunur. Sadece process mutex kullanmayın.

Özellikle mevcut `lockWorlds`, season'ı kilitlemeden önce dünyaları okuyor ve sonra row lock alıyor. Taşıma eklenince ön okumadaki season eski olabilir. Kilit altındaki final dünyaların **beklenen season/version ve controller** değerlerini yeniden kontrol edin; değiştiyse işlemi harcama yapmadan yeniden çözün veya `PLACEMENT_CHANGED` döndürün. Aynı kontrol account→player ön okumaları için gereklidir.

Enqueue, iptal, expire, return admission ve yeni join aynı hedef kuyruk/kapasite koordinasyonunu kullanmalı. Enqueue/iptal/admission, season → player → application sırasını da paylaşır; başvuru tablosunu kilitleyip sonra player kilidi bekleyen ayrı yol kurmayın. Sayaç satırı yokken `FOR UPDATE` koruma sağlamaz: önce unique upsert ile oluşturun, sonra kilitleyin. Başvuru sıra numarası transaction içinde verilir ve aynı kilit altında commit edilir.

### 7.3 İki yönlü atomik transfer transaction'ı

1. Adayı dışarıda ucuz sorguyla seç. Bu sonuç yetki veya uygunluk garantisi değildir.
2. Gerekirse waiting shard'ı ayrı, idempotent provisioning işlemiyle hazırla. Player transaction'ının içinde uzun harita/takvim üretimi yapma.
3. Ortak kilit protokolünü al. İki yönde kaynak/target live, cycle/ruleset, player version ve owned dünyaları yeniden oku. **Gidişte** MAIN→WAITING ve inaktivite cutoff; **dönüşte** WAITING→home MAIN, geçerli QUEUED başvuru, uygunlar arasında en eski sıra ve expiry doğrula. Dönüşte inaktif olma şartı aranmaz.
4. **Gidişte** oyuncu sonradan geldiyse transfer yapma. Aynı anda giriş ve taşıma yarışında DB'de ilk geçerli kilitli işlem kazanır; transfer önce commit etmişse giriş waiting placement'ı görür.
5. Blocker'ları kontrol et. Kaynak ve hedefin gerçek koltuk/slot durumunu kilit altında hesapla. Dönüşse uygun `main_vacancies` satırlarını kilitle; gidişse kaynak adreslerin vacancy kayıtlarını bu transaction içinde hazırla.
6. Ekonomiyi aynı `now` anına ilerlet. Due kişisel completion işlemleri varsa transfer içinde rastgele handler çalıştırma: normal resolver'a bırakıp bu transferi ertele. Due olmayan taşınabilir işler kendi deadline'larıyla geçer. Geçmiş süreyi tekrar üretme.
7. Klan ayrılığını uygula; kaynak sensör/izleme bağlarını kapat; tarihsel konum snapshot'larını hazırla.
8. Player'ın season'ını, bütün owned dünyaların season/slot/koordinatını, taşınabilir pending kişisel event season'larını değiştir. Gidişte kaynak vacancy kayıtlarını oluştur; dönüşte başkent ve kolonileri seçilen vacancy adreslerine aynen yerleştir ve kayıtları tüket. Süreler, queue maliyetleri, UUID'ler korunur.
9. `placementVersion + 1`, transfer/world audit ve private outbox kaydı yaz. Dönüşse aynı transaction'da başvuruyu COMPLETED yap ve `mainEnteredAt` yaz.
10. Her iki galaksinin yalnız gerçekten değişen public sorgu ailelerini geçersizleştirecek bildirimleri transaction ile ilişkilendir. Hedef bilgisini kaynak galaksinin herkese açık payload'ına koyma.
11. Commit. Outbox dispatcher SSE yönlendirmesini ve bildirim teslimini tekrar denenebilir şekilde yapar.

Bir adım başarısızsa player ve bütün dünyaları kaynakta kalır. “Önce kaynak kaydı sil, sonra hedefte oluştur” akışı yoktur. Basit `seasonId UPDATE` de yeterli değildir.

### 7.4 Event claim yarışı ve sınıflandırma

Worker `claimDue` ile event satırını `processing` yapıp bir JS nesnesi alır; handler sonra ayrı transaction'da çalışır. Sadece `busy()` sorgusu, ardından `UPDATE scheduled_events SET season_id=...` güvenli değildir: claim araya girip belleğinde eski season taşıyabilir.

Transfer, taşıdığı bütün aktif kişisel event satırlarını kısa NOWAIT kilidiyle **yeniden okur**. `processing` gördüğünde tamamını rollback/ertele; `pending` ve due olmayan satırları kilit altında değiştir. Claim önce kazanmışsa ertele; transfer önce kazanmışsa claimant commit sonrası güncel satırı almalı. Handler ayrıca DB'deki event/ref current season'ını doğrulasın; bellekten eski season ile iş yapmasın. `complete/fail/reap/abandon` için stale handler'ın yeni denemeyi kapatmaması owner/claim-generation kontrolüyle sınanmalı; mevcut `complete(id)` koşulsuz güncelliyor. Bu koruma yalnız transfer tarafında “retry yap” diyerek sağlanmaz.

| Mevcut `event_kind` | Taşıma davranışı |
|---|---|
| `build_complete` | Order world-local; legacy research ref fallback'i de tanınmalı. Pending/due olmayan event taşınır; deadline ve expectedReadyAt korunur. |
| `research_complete` | Commander-local; funding planet tarihi adres olabilir. Current owner/cycle'dan çöz. |
| `death_star_ready` | Pad-local BUILDING/PAUSED asset için taşınabilir. Silah ve interceptor ayrımı korunur. |
| `mission_arrival`, `radar_warning`, `mining_arrival`, `mining_return`, `pirate_arrival`, `pirate_return`, `trade_arrival`, `trade_return`, `strategic_intercept`, `strategic_intercept_impact` | İlgili canlı flight/effect bitene kadar blocker; tamamlanmış referansa ait stale event varsa no-op/idempotent uzlaştırma. |
| `recovery_end`, `occupation_end` | Aktif deadline çözülene kadar blocker; tarihi deadline'ı yeniden başlatma. |
| `neutral_reinforce` | Taşınan kontrollü kolonide stale event varsa ref/kind guard ile etkisizleştir. Hedefte yeni neutral garnizon basma. Gerçek neutral dünya taşınmaz. |
| `asteroid_impact` | Hedef/payload ref'i varsa kaynak mekânsal olayıdır: ilgili dünya üzerindeki henüz çözülmemiş etki için ertele, hedef galaksinin asteroid index'ine dönüştürme. |
| `season_end`, `season_rollover`, `season_act`, `galaxy_event_start`, `galaxy_event_end` | Galaxy-global: kaynakta kalır. Taşınan kişinin adı audience/history'de var diye event taşınmaz. |

Worker bakım işi hiçbir due event'i işlemeye zaman bırakmayacak şekilde tekrar tekrar transfer denememeli. Önerilen başlangıç ayarları: inaktivite taraması 60 saniye; dönüş/expiry taraması 10 saniye; tick başına en fazla 5 transfer denemesi ve 100 ms bakım bütçesi. Kilit alınamazsa aynı turda spin retry yok. Bakım bütçesi transaction'lar arasındaki admission sınırıdır, süren SQL'i kendiliğinden kesmez; DB lock/statement timeout ayrıca ayarlanır ve timeout tüm transferi rollback eder. Bunlar önerilen ölçüm başlangıçlarıdır; staging event-lag sonucu ile ayarlanır. Shard provisioning normal flight resolver döngüsünde uzun senkron iş olmamalı; ayrı bounded bakım işi olarak yürütülür.

## 8. Verilerin taşınma politikası

| Veri grubu | Yapılacak işlem |
|---|---|
| Accounts, parola/session, account rewards | Aynen korunur. Taşıma login/logout veya sosyal ödül sıfırlaması değildir. |
| Player kimliği, Dominion taken/lost, kişisel research, unlocks | Aynen korunur. Yerleşim/galaksi alanları güncellenir; score taşıma ile artmaz. |
| Gezegen adı, kind, yapılar, satellites, yerel research, stock/buffer, shield, builtEver, academyStep | Korunur. Ekonomi commit anına ilerler; yeni dünya başlangıcı uygulanmaz. |
| Units | Kendi dünyalarındaki own/home craft ve savunmalar aynı kimliklerle kalır. Owner'ı olmayan/başkasına ait **pozitif adetli canlı** varlık için blocker kuralı uygulanır; count=0 tarihsel satırlar tek başına taşımayı durdurmaz. |
| Strategic assets | Pad'deki sahip olunan silah ve interceptor korunur; aktif uçuş/interception engeldir. |
| Build/research orders | Kimlik, startedAt/readyAt, sıra ve ödenmiş cost korunur. Funding planet daha önce kaybedilmişse araştırma commander'a ait olmaya devam eder; eski funding FK tarihsel kalabilir, refund kaybolan pad'e gitmemeli. |
| Pending kişisel scheduled events | Sadece typed ref sahipliği kanıtlanan construction/yard/research vb. event'lerin season bağlamı güncellenir. `resolveAt/dedupeKey` korunur. Yeni konum/version ile çalıştığı doğrulanır. |
| Processing/failed kişisel events | Lease/sonuç çözümlenmeden taşıma yok; duplicate payment engeli. |
| Done mission/mining/pirate/trade, battle/probe/strategic reports | Kaynak season'da tarihsel kalır. Dünya sonradan taşındı diye olayın season'ını değiştirmeyin. Rapor eski yer/isim/klan snapshot'ını okur. |
| Kişisel ödül ilerlemesi | `rewardGrants` korunur; Mevcut `flightCounts/miningCounts` planet UUID'siyle sayar; bu kapsam korunur, bütün ödülleri gereksizce commander-wide yapmayın. `pirateVictories` yalnız `pirateIndex` ile distinct yapıyor: farklı season'lardaki aynı index farklı korsandır; `(seasonId,pirateIndex)` olarak düzeltin. Aynı ödül tekrar ödenmez, kazanılmış ilerleme eksilmez. |
| Attack/clan aid commitments, bash/cooldown | Süreler silinmez/yenilenmez. Kaynak audit'i korunur; aynı cycle'da gidip dönen kişi aktif limitten kaçamaz. |
| Debris fields | Kaynak uzayda kalır; koordinat snapshot'ı zaten vardır. `planetId` artık tarihsel anchor'dır, target gezegenin yeni konumu olarak kullanılmaz. Third-party salvage doğru kaynak yerde devam eder; taşıma anında aktif bağımlılık varsa ertele. |
| Asteroid claims, pirate state, galaxy event calendar | Kaynakta kalır. Hedef kendi field/key/calendar'ını kullanır; asteroidIndex/pirateIndex galaksiler arası anlam taşımaz. |
| Sensor epochs | Kaynaktaki açık epoch'ları transfer anında kapat; hedefte yeni koordinatlarla yenisini aç. Eski epoch satırları source season'da kalır, hedef keşfi açmaz. Sıfır süreli epoch CHECK'i için create+move aynı anda test yazın. |
| Watches | Observer veya target taşınınca live ilişki sonlanır; başkasını hedef galakside izlemeye devam etmez. Ücret/cooldown geçmişi korunur; yeni ücretsiz retarget istismarı yaratılmaz. |
| Probe world memories | Eski okumalar tarihsel olarak korunur; live dossier için observer ve target'ın doğru season/placement bağlamında olduğunu doğrula. Target yerleşim version/season bilgisi ekleyerek eski bilginin yeni konuma otomatik taşınmasını önle. |
| Rival pointer'ları | Tarihsel kimlik kalabilir; farklı galaksideki rival current target/odak/launch olamaz. Live yüzeyde unavailable. |
| Clan membership ve requests | Taşınan kişinin üyeliğini sonlandır, açık başvuru/davetlerini kapat, gerekiyorsa lider devret/disband et; 24 saat kuralları korunur. Clan score ve immutable snapshot'lar geri alınmaz. |
| Chat/clan messages, public events | Kaynak galakside tarihi olarak kalır. Author'ın yeni season'ına join edilerek hedef sohbete taşınmaz. Eski clan chat'e yeni erişim verilmez. |
| Notifications | Kişisel geçmiş kalır; eski koordinat/hedef linkleri sadece tarihi gösterir, yeni galakside eylem başlatmaz. Taşıma bildirimi transferId ile idempotent. |
| Request log | Yerleşim version bağlamı ekle. Eski dünyada verilen yanıt replay edilerek yeni dünyada işlem yapılmış gibi gösterilemez. |
| Season results/lifetime | Transferde katlama veya yeni sezon sonucu yok. Cycle biterken komutan bir kez sayılır; final bulunduğu shard ladder'ında sonuçlanır. |

**Kodda saptanan zorunlu sensör düzeltmeleri:** `sensorHistoryForPlayer` şu an sadece `playerId` filtreliyor; dönen `seasonStart` parametresi filtre değil zaman dönüşümüdür. İmzaya açık current `seasonId` ekleyip SQL'de filtreleyin ve asteroid/pirate/traffic bütün çağrılarını güncelleyin. Aksi halde eski galakside görülen sensör küreleri yeni galakside keşif açar. `refreshSensorEpoch` içindeki `unchanged` karşılaştırması da `seasonId` içermiyor; iki galakside koordinatlar aynıysa epoch değişimini kaçırır. Season eşitliğini ekleyin. Sıfır süreli epoch silme dalı mevcut; yeniden tasarlamak yerine transfer boundary testiyle koruyun.

`scheduled_events.payload` içindeki UUID'leri metinsel arama/değiştirme yapmayın. Her event kind için “world-local / commander-local / history / galaxy-global / transfer blocker” sınıflandırması çıkarın; tanınmayan aktif tür fail-closed biçimde ertelensin. Test, yeni bir event kind eklenince sınıflandırmayı güncellemeyi zorunlu kılsın.

Rapor, ödül ve recap sorgularında özellikle `JOIN planets` ile current konum/owner türeten yerleri denetleyin. Tarihsel `missions.seasonId` ile `planets.seasonId` artık farklı olabilir; bu kontrollü bir ayrımdır, bütün tablolarda eşitlik dayatmayın. Buna karşılık live gameplay ilişkileri her zaman tek season'a ait olmalıdır.

## 9. Dönüş kuyruğu algoritması

### 9.1 Başvuru

- Yalnız `WAITING` rolündeki, live ve endsAt'i geçmemiş season'daki kendi komutanı başvurabilir.
- Hedef client'ın gönderdiği serbest shard ID değildir: `homeShardId` + current cycle'dan sunucu çözer.
- Aynı komutanın **süresi dolmamış** queued başvurusu varsa aynı başvuruyu döndür; yeni sıra verme. Süresi dolmuş satırı önce EXPIRED kapat, yeni istekte yeni sıra ver.
- Yeni başvuru için hedef queue kilidi → player kilidi → mevcut placement tekrar kontrolü → sıra sayacı +1 → insert.
- İptal yalnız oyuncunun kendi queued başvurusuna uygulanır. Aynı iptalin tekrarı mevcut CANCELLED sonucu döndürür. Dönüş önce commit etmişse COMPLETED+güncel placement döner; iptal olmuş gibi yanıt verilmez. Başkasının ID'si hiçbir bilgi açıklamayan 404 üretir.
- Cancelled/expired başvurudan sonra başvuru yeni sequence alır. Başvuru geçmişini overwrite etme.
- Transfer history'de source/home eşleşmesini doğrula; yeni kayıt ile waiting'e girmiş sahte hesap yolunu kapat.

### 9.2 Aktivite ve expiry yarışının çözümü

Mevcut `Presence.touch` zaman damgasını körlemesine yeniler. Worker henüz expire etmeden 49. saatte giriş yapan kişiye eski sıra kalmamalı. `expiresAt` kalıcı olsun. Başarılı presence yazısı player kilidi altında önce açık application'ı kontrol eder: `now >= expiresAt` ise EXPIRED yapar, değilse `expiresAt = now + 48 saat` yapar; ardından activity yazar. Admission aynı alanı player/application kilidi altında tekrar doğrular. Presence süresi dolmuş başvuruyu sessizce yeniden oluşturmaz.

Throttled normal activity en fazla mevcut 60 saniyelik çözünürlükte kalabilir; `/api/return-applications` oluşturma/iptal ve ilk session resume için throttle'sız başarılı activity transaction'ı kullanın. DB yazısı başarısızken “başvuru yenilendi” yanıtı dönmeyin. Public `/health`, bot sweep veya outbox retry'sı insan activity/expiry'sini uzatmaz. Arka plan API trafiğinin hâlâ aktivite sayıldığı Bölüm 2 varsayımı değişmez.

### 9.3 Admission sweep

Her hedef MAIN için, süre ve batch bütçesi içinde:

1. Kilit altında geçerliliğini kaybetmiş eski başvuruları kapat: biten cycle, artık waiting'de değil, 48 saat inaktif vb.
2. Hedef admission kilidi altında queued başvuruları sequence sırasıyla değerlendir. Geçici oyun engeli doğrulananı başvurusunu değiştirmeden geç; uygun en eski başvuruyu seç. Kilit contention'ı uygun olmama kanıtı değildir: `SKIP LOCKED` ile kilitli eski başvuruyu atlama, hedefi ertele.
3. Gerçek boş komutan koltuğunu ve inaktif transferinden kalan açık başkent vacancy kaydını kontrol et. İkisinden biri yoksa çık; hiç kullanılmamış başlangıç slotuna dönüş yerleştirme.
4. Başvurunun oyuncusu güvenli taşınabilir değilse veya tüm kolonilerine adres yoksa başvuruyu ve sequence değerini koru, sonraki başvuruyu değerlendir. `blockedReason` üret; kesin ETA verme. Ortak başkent/koltuk kapasitesi yoksa turu bitir.
5. Başkent ve tüm koloniler için Bölüm 6’daki tür uyumlu vacancy adreslerini ayır; dönüş transaction'ını commit et. Başvurunun COMPLETED olması ve koltuğun dolması ayrılmazdır.
6. Her başarılı transferden sonra güncel kapasiteyle en eski başvurudan yeniden değerlendir. Her komutan ayrı transaction; bütün galaksiyi tek uzun transaction'a alma. Süre/batch bütçesiyle bölünen tarama geçici cursor kullanabilir; yeni tur eski engelli başvuruları tekrar ziyaret etmelidir. Kalıcı sıra değişmez.

Ana→waiting sweep tamamlandıktan sonra return sweep çalıştırın. Dönüşü yalnız aynı sweep'in boşalttığı sayıya sınırlamayın: önceki sweep'lerden kalmış, henüz tüketilmemiş vacancy adresleri de kullanılabilir. Hiç kullanılmamış başlangıç slotu veya kayıtsız rastgele boş konum dönüş alternatifi değildir. Worker restart, iptal veya expired head sonrası bir sonraki bakım turu devam eder.

Yeni oyuncu join'i **aynı kapasite/admission kilidi altında** geçerli queued başvuru ve gerçek boş slotları yeniden kontrol eder. Queue varsa açık inaktivite vacancy adreslerini spawn adaylarından çıkarır; kalan hiç kullanılmamış başkent slotlarına kayıt yapılabilir. Uygun slot kalmadıysa ve kalan fiziksel boşluklar dönüşe ayrıldıysa `RETURN_QUEUE_PRIORITY` verir. Bot seat oluşturma da bu kontrole tabidir.

`listServers/frontierOrdinal/resolveJoinTarget` aynı **yeni kayda ayrılabilir** kapasite hesabını kullanır: dolu koltuklar + dönüşe ayrılmış boş başkent adresleri yeni kayıt açısından kullanılamazdır. UI gerçek nüfusu reserved sayısıyla şişirmez; gerektiğinde `returnReservedSeats`/admission nedeni ayrı gösterilir. EU-1'in bütün boş adresleri dönüşe ayrıldıysa yeni kayıt için EU-2 frontier olabilir. Aksi halde “open” görünen ama her join'i reddeden sunucu oluşur. Frontend'de açık göründüğü için son koltuğu verebilen ayrı bir yol kalmamalı; Academy claim dahil tüm join yollarını test edin.

### 9.4 Sıra gösterimi

`position = kendisinden önceki geçerli QUEUED başvuru sayısı + 1`. Sequence doğrudan sıra değildir; iptaller boşluk bırakır. Sıra anlık bilgilendirmedir, garanti edilmiş bekleme süresi değildir. Başka oyuncuların isimleri, gezegenleri veya activity tarihleri liste halinde yayınlanmaz.

Başvuru sırasında uçuş yasaklanmaz; waiting normal oyundur. Oyuncuya uçuşlar bitmeden taşınamayacağı söylenir. Sıranın başındaki kişi uçuş açarsa uygun sonraki kişi dönebilir; uçuşu olanın başvurusu kapanmaz ve eski sırası korunur. Arayüz başvuru sırasının kesin dönüş sırası olmadığını açıklar.

## 10. API, oturum, SSE ve arayüz

### 10.1 Önerilen sözleşmeler

| Endpoint | Davranış |
|---|---|
| `GET /api/placement` | Güncel `playerId, seasonId, shardCode, shardName, role, placementVersion, homeShardCode, lastTransfer, returnApplication, serverNow`. Yalnız kendi hesabı. |
| `POST /api/return-applications` | Body boş veya sıkı boş obje. Aktif başvuruyu oluştur/döndür. Sunucu hedef/sıra/zaman seçer. |
| `DELETE /api/return-applications/:id` | Kendi queued başvurusunu idempotent iptal; admission yarışı aynı kilitte çözülür. |
| `/api/auth/me`, `/api/season` | Mevcut payload'a role ve placementVersion ekle; auth bootstrap tek okumada doğru galaksiyi bulabilsin. |
| `/api/servers` | MAIN listesi frontier için; waiting'e normal join sunma. Rol/display bilgisi gerekiyorsa ayrı alanla göster; listeyi doğrudan union edip üçüncü sunucuyu “open” yapma. |

Örnek private durum:

```json
{
  "role": "WAITING",
  "shardCode": "WAIT-1",
  "shardName": "Sessiz Uzay",
  "placementVersion": 3,
  "homeShardCode": "EU-1",
  "returnApplication": {
    "id": "uuid",
    "status": "QUEUED",
    "position": 4,
    "requestedAt": "2026-09-08T12:00:00.000Z",
    "blockedReason": "CAPACITY"
  }
}
```

Önerilen error kodları: `NOT_IN_WAITING`, `PLACEMENT_CHANGED`, `RETURN_TARGET_UNAVAILABLE`, `RETURN_QUEUE_PRIORITY`, `APPLICATION_NOT_FOUND`, `SEASON_NOT_LIVE`. Batch blocker nedenleri ayrıca `IN_FLIGHT`, `RECOVERY`, `EVENT_PROCESSING`, `CAPACITY`, `WORLD_SLOTS`, `RULESET_MISMATCH` olabilir; normal geçici ertelemeyi sistem hatası gibi sunmayın. Mutasyonlar yeni authoritative placement+application görünümünü aynı transaction'dan döndürür; Zod server/web contract testleri yazılır.

### 10.2 Canlı bağlantı ve yetki

- Mevcut bus private payload'ı `{playerId, kind}` şeklinde parse eder; key ekleyip kendiliğinden geçeceğini varsaymayın. İlk sürüm mevcut şemayla `private:placement` invalidation üretir; version/transfer ayrıntısı authoritative `/api/placement` üzerinden okunur. Kalıcı outbox bu minimal invalidation'ı yeniden yayınlayabilir.
- Kaynak galaksi aboneliği server tarafında sonlandırılır; client reconnect tek koruma değildir. Outbox **asenkron** olduğundan commit ile revoke arasında boşluk vardır. İlk sürüm source shard frame'ini sokete yazmadan current placement version/season DB'den doğrulanır; kısa player `FOR SHARE` koruması altında sadece bounded socket write kuyruğa alınır, ağın flush edilmesi beklenmez. Transfer player UPDATE kilidiyle sıralanır. Uyumsuzlukta eski abonelik kapanır, placement refetch sinyali verilir. Sadece TTL cache veya eventual revoke, “eski frame hiç yazılmaz” güvencesi sağlamaz; maliyeti yük testinde ölçün.
- Stream açılışındaki whoAndWhere ile subscribe arasında da aynı version guard gerekir. Global announcement ve player'ın kişisel tarih bildirimi source-shard frame'iyle karıştırılmaz; source public frame'leri bugün yalnız invalidation olsa bile eski galaksinin zaman bilgisini izlemeyi sürdürmemeli.
- Outbox kaybolan bildirimi tekrar verir; authoritative GET/reconnect da eski state'i onarır. SSE backlog olmadığı için salt “bir event attık” yeterli değildir.
- İstemci eski in-flight GET'leri abort eder, query cache'i ve seçili foreign target/traffic/route formunu temizler, `/me`/placement okur, yeni season stream'ini açar.
- Yanıtlar placementVersion/season bağlamı taşır. Geç gelen eski yanıt yeni cache'i dolduramaz. Mutation intent beklenen version ile sınanır; transferden önce hazırlanmış saldırı yeni galakside işlenmez.
- Mobil reconnect, çoklu sekme ve iki cihaz aynı davranışı göstermeli. Private event teslimi kaybolsa bile 60 saniyelik placement/season yenilemesi ve her mutasyonun version kontrolü toparlamalı.
- API yetkisi current player season'ından türetilir. Başkasının/kaynak galaksinin UUID'sini bilmek live GET veya POST yetkisi vermez; kişinin yetkili eski rapor arşivi bu yasağın dışında, read-only history'dir. Çok sorgulu live GET'ler tek tutarlı snapshot'ta placement/topology okur ve response version taşır; READ COMMITTED'da bir sorguyu kaynak, sonrakini hedef galaksiden birleştirmeyin. Clan, chat, reports, dossier, radar, probe, leaderboard, asteroid, pirate, trade sorguları ayrı ayrı sınanır.

### 10.3 Oyuncuya gösterilecek akış

Ana galaksi menüsünde kısa kural: “48 saat oyuna girmezsen dünyaların Sessiz Uzay'a taşınır. İlerlemen korunur.” Detayda sezon sıfırlaması ve uçuş istisnası açıklanır. Büyük modal veya sürekli alarm gerekmez.

Taşınmış oyuncu login olunca doğrudan waiting galaksisindeki kendi başkentini görür; onboarding veya sıfırdan sunucu seçimi açılmaz. Bir kez gösterilen bildirim:

> “48 saat oyuna girmediğin için dünyaların Sessiz Uzay'a taşındı. Burada oynamaya devam edebilir veya EU-1'e dönüş başvurusu yapabilirsin.”

Kompakt menü satırı: “Sessiz Uzay · Dönüş başvurusu”. Başvurmuşsa “EU-1 · Sıran 4” ve “Başvuruyu iptal et”. Gerekli detay: “Yer açıldığında sırayla dönersin. Devam eden uçuşların varsa taşıma bekler. 48 saat gelmezsen başvurun sona erer.” Kesin tarih/süre gösterme.

Dönüşte kısa bildirim ve yeni galaksiye geçiş yapılır. Yeni konumun inaktif oyuncudan boşalan bir adres olduğu, kişinin kendi eski adresine dönme garantisi olmadığı açıklanır. Otomatik kamera hareketi sadece gerçek placement değişiminin yeni sahneyi kurması içindir; sıradan refetch kamerayı yeniden çerçevelemez. Loading/error/empty birbirinden ayrıdır; hata sırasında mevcut oynanabilir sahne tutulur.

## 11. Sezon, puan ve bot entegrasyonu

### 11.1 Sezon sınırı

- Transfer bir sezon bitişi değildir; `accounts.lifetime.seasons` artmaz.
- Kaynak/target aynı cycle ve ruleset olmalı. Dönem ortasında waiting açılışı kalan süreyi uzatmaz.
- Season end, admission ve transfer ortak lifecycle koordinasyonuyla yarışır. Freeze başladıysa yeni transfer durur; pending kişisel event'ler normal kurallarla tamamlanır.
- `onSeasonEnd` finalde yalnız o season'da bulunan komutanları sıralar. Gezmiş komutanın rapor/recap'i cycle boyunca kendi geçmişini görebilmeli. İki shard'dan çift ödül/sonuç üretilmemeli.
- Global rollover bütün cycle shard'larını, waiting dahil, hesaba katar; waiting live kaldığı için sonsuza kadar beklemez. Mevcut global wipe politikasını koruyarak yeni tabloların FK/temizleme sırasını ekleyin.
- Açık başvurular `SEASON_ENDED`; yeni sezona eski güç veya sıra devretmez. Hesap sonuç ekranı ve normal yeni sezon yerleşimi devam eder.
- Aynı cycle dışına transfer teknik olarak reddedilir. Eski güçlü dünyayı yeni sezona taşımaya izin veren “fallback” yoktur.

**Lifecycle ayrıntıları:** `cycleId` transfer uyumluluk grubudur; mevcut global wipe'ı bağımsız per-cycle wipe'a dönüştürmez. Legacy farklı bitişli gruplar varsa global rollover mevcut gibi bütün live sezonların kapanmasını bekler. Provisioning ile wipe aynı lifecycle kilidini kullanır; freeze/endsAt sınırında yeni WAIT live season açılmaz. Rollover sonrası MAIN'ler normal bootstrap ile açılır, boş waiting shard'ları kapalı tutulup ihtiyaç halinde yeni cycle'da açılır; geçmiş WAIT sayısını her yeni sezonda otomatik büyüterek taşımayın.

`onSeasonEnd` şu an pending mission/mining/build/strategic build sayıyor; research, pirate ve trade için eşdeğer bitiş doğrulamasını transfer/lifecycle testlerinde açıkça ekleyin. `endsAt` gelmiş ama status henüz live ise yeni return/join/queue açılmamalı. Özellikle tarihsel raporlar kaynak season'da kaldığı için recap için cycle+katılımcı sorgusu gerekir; rank yalnız final yerleşimden hesaplanır. `(cycleId,accountId)` sonuç tekilliği eklenerek bir account'a iki shard sonucu engellenir; lifetime fold global wipe'ta bir kez kalır.

### 11.2 Puan ve ekonomi

Komutan Dominion ve progression taşır; waiting'de normal savaşlardan kazandığını dönüşte korur. Ana leaderboard toplamının oyuncu giriş/çıkışıyla değişmesi beklenen sonuçtur, global sıfır-toplam iddiasıyla yanlış test yazmayın. Tek savaşta verilen/alınan Dominion simetrisi korunur.

Waiting'de pasif rakiplerden güç/puan toplamak ürünün normal sunucu isteğinin doğal riskidir. İlk sürüm gizli multiplier, indirim, score reset veya özel PvP koruması eklemez. Waiting→main dönüşlerin Dominion/wealth dağılımı ve saldırı sonuçları playtestte izlenir. Klan puanı geçmişte kazanıldığı klanda kalır.

### 11.3 Botlar

`ensureBotSeats` sadece MAIN için normal kota doldursun; yeni WAIT shard'ları 12 bot daha üretmesin. Account başına tek player index'i nedeniyle waiting'de olan bir botu “eksik koltuk” diye tekrar yaratmayın. Bot brain waiting'de mevcut komutana hizmet ediyorsa ordinary services ve aynı fog kuralları geçerli kalır. Bot taşıma/dönüş önceliği insan kuyruğunu baypas etmez. Bot otomatik başvuru ilk sürümde yoktur.

D159 ve bot CLI yorumlarındaki “3 günde reclaimed/silinir” ifadeleri yeni politikayla güncellenmeli. İnaktivite temizliğinin insan/bot için gizli silme istisnası kalmamalıdır.

## 12. Uygulama paketleri ve teslim sırası

Her pakette **test yaz → FAIL kanıtla → implement → PASS → ilgili regresyon**. Bu repo kod değişikliği için TDD'yi zorunlu tutar. Bu doküman teslimi test çalıştırıldığı anlamına gelmez.

### Paket A — envanter ve davranış sözleşmesi

- Bu dokümanı ve manueli oku; commit farklarını kontrol et.
- Bütün `seasonId`, player/world FK, `scheduledEvents` kind ve JSON ref kullanımlarından bağımlılık matrisi çıkar; Bölüm 8'i gerçek çağrı noktalarıyla tamamla.
- Lock order haritasını çıkar. Eski `seasonId` ön okuması kullanan mutasyonları belirle.
- Saf 48 saat/FIFO/uyumluluk kurallarını testle sabitle.
- Ana vacancy ve waiting colony allocator deneyini yap; harita ve slot planı sonuçlanmadan veri taşıma implementation'ına geçme.

### Paket B — şema, boşalan konumlar ve kapasite

- Rol/cycle/placement alanları, queue/counter/vacancy/audit/outbox ve index'ler için additive migration.
- Var olan MAIN/placement alanlarının deterministik backfill'i; duplicate live season, bozuk topology ve slot raporu.
- Yeni tablo fixture/cleanup/schema drift desteği.
- `waitingServers.ts` provisioning, `placementSlots.ts` allocation, ana join ortak kapasite kilidi.
- Server frontier yalnız MAIN; waiting full → ikinci waiting testi.

### Paket C — güvenli transfer motoru

Önerilen yeni dosyalar: `services/commanderTransfer.ts`, `services/transferReferences.ts`, `services/placementSlots.ts`.

- Busy/ref sınıflandırması, ekonomi ve queue uyarlaması.
- Klan, sensör, fog/history, ödül ilerlemesi adaptörleri.
- Her iki yönde atomic transfer, expected version, audit/outbox.
- Önce test servis çağrısıyla; worker henüz otomatik taşıma yapmasın.

### Paket D — FIFO ve worker

Önerilen: `services/returnQueue.ts`, `services/inactivityTransfers.ts`.

- Idempotent başvuru/iptal/expiry.
- Uygun başvurular arasında FIFO admission ve yeni kayıt/bot priority guard.
- Eski reclaim worker çağrısını tamamen çıkar; yerine feature-flag kontrollü sweep.
- Küçük batch, elapsed-time bütçesi, contention'da hızlı erteleme. Timeout kaynaklı olay varış gecikmesini ölç.
- `/health` metrikleri ve operatör dry-run/report komutu. Dry-run veri yazmaz.

### Paket E — API ve web

- Route registration mevcut `app.after()` düzeninde; auth/rate-limit/Zod.
- `/me` ve season payload'ları, shared API schema contract testleri.
- SSE server-side revoke/outbox teslimi, client placement reconciliation.
- Menüde başvuru/sıra/iptal, girişte bildirim, iki dil.
- 375×812 görsel kontrol; çoklu sekme/cihaz, reconnect, eski request yarışları.

### Paket F — lifecycle, regresyon ve canlı geçiş

- Sezon end/rollover, audit retention/FK ve bot davranışı.
- D70, sunucu sayısı/tek galaksi/çoklu dünya ve ilgili diğer kararların kapsamlı güncellemesi. Yeni D numarasını o andaki son kayda göre seçin.
- `CLAUDE.md`, `docs/game-design.md`, `docs/architecture.md`, `docs/decisions.md`, `docs/deployment.md`, TR/EN metinleriyle aynı davranışı anlatın.
- Staging yoğunluk ve failure denemeleri; geri dönüş runbook'u; sonra özellik aktivasyonu.

Kod teslimi yalnız migration+service olarak tamamlanmış sayılamaz: queue UI, eski stream yetkisinin kaldırılması, history/fog ve rollover bu özelliğin zorunlu parçalarıdır.

## 13. Test matrisi

Mevcut testlerden genişletilecekler: `apps/server/test/reclaim.test.ts`, `servers.test.ts`, `one-galaxy.test.ts`, `season-lifecycle.test.ts`, `auth.test.ts`, `session.test.ts`, `stream.test.ts`, `research.test.ts`, `sensor-horizon.test.ts`, `schema-drift.test.ts`. Eski reclaim testlerinin yeni politikayla çelişen silme beklentilerini sessizce geçirmeyin; taşıma beklentisiyle değiştirin.

Yeni öneriler: `commander-transfer.test.ts`, `return-queue.test.ts`, `transfer-races.test.ts`, `transfer-history.test.ts`, `waiting-servers.test.ts`; web'de placement-change ve return-queue contract/interaction testleri. Gerçek transaction/unique/row lock davranışı PostgreSQL integration testidir, yalnız mock ile kanıtlanamaz.

| Grup | Zorunlu senaryolar |
|---|---|
| Zaman | 47:59:59 taşınmaz; tam 48 saat taşınmaya uygun; yeni join korunur; UTC/gece yarısı fark etmez; `lastSeenAt` sonucu değiştirmez; mainEnteredAt alt sınırı. |
| Aktivite yarışı | Aday seçildikten sonra başarılı presence yazısı → transfer yok; transfer önce kazanır → login yeni placement; presence DB hatası gözlemlenebilir; worker sahte activity yazmaz. |
| Ana dönüş konumu | Kaynak ana galaksiden inaktiviteyle çıkarılan dünyaların tam `slotIndex/x/y/z` adresleri kullanılır; rastgele/yeni koordinat seçilmez. |
| Koruma | Başkent + 0/1/3 koloni; UUID/name/building/resource/buffer/ship/research/reward korunur; bir world slotu bulunamazsa hiçbir dünya taşınmaz. |
| Uçuş | Her mission türü, engagement, outbound/return pirate/trade, mining/salvage, incoming hostile/friendly, ele geçirilmiş pad'den dönüş, yabancı unit. Sonuç normal resolve sonrası bir kez gelir. |
| Queue/event | İnşa/yard/research transfer öncesi/sonrası tam boundary; processing event; failed retry; eski event yeni season'a iki kez kaynak ödemez. |
| Recovery | Death Star ve koloni deadline'ı taşıma sayesinde iptal olmaz; kaynakta çözülür; relieved/unrelieved sonuçları D167'yi korur. |
| Idempotency | Aynı transfer iki kez; request retry; aynı anda iki başvuru; sıra numarası boşluğu; iptal+dönüş yarışı; commit sonrası süreç ölümü. |
| FIFO | A/B/C sıra, A busy veya WORLD_SLOTS → B döner ve A aynı sequence ile kalır; A uygun olunca C’den önce döner; bütün başvurular engelliyken hiçbiri silinmez; A expired → B ilerler; iptal+yeni başvuru sona; iki worker tek koltuk; restart sırası aynı. |
| Join rekabeti | Son koltukta return vs signup vs Academy claim vs bot; kapasite aşılmaz, başvuru önceliği korunur. |
| Harita | A çıktı/B tam aynı ana slot ve koordinata girdi; UUID B olarak kaldı; vacancy restart sonrası korundu; join/vacancy yarışı; farklı MAIN aynı slot ile waiting'e gidiş; 0→3 koloni farkında atomik erteleme; farklı çıkışlardan koloni adresi toplama; eski intel/enkaz yeni dünyaya bağlanmıyor; waiting slot çakışması ve yoğunluk. |
| İzolasyon | Eski season planet UUID'siyle GET/attack/watch/chat/clan eylemi reddi; kaynak SSE artık gelmez; target memory yeni koordinatı sızdırmaz. |
| Tarih | Raporda eski konum/klan; source debris source'ta; reward eligibility aynı cycle geçmişini sayar; social bonus tekrar yok; cooldown dönüşte sürer. |
| Klan | Member, leader, tek üyeli klan; pending aid/raid; immutable clan score/history; dönüşte membership kendiliğinden dönmez. |
| Sezon | Freeze ile yarış; mismatch ruleset/cycle; waiting bootstrap ara gün; global rollover waiting dahil tamamlanır; lifetime/result tek kez. |
| Kapasite | Waiting dolu → yeni shard; iki provisioner tek shard; operasyonel limit → ertele; MAIN listesi/frontier bozulmaz. |
| Arayüz | Başvuru yok/queued/expired/error; cold login waiting ready; iki cihaz; event kaybı; eski GET geç gelmesi; transferde kamera/form/cache reset. |
| İnceleme regresyonları | Kuyruk varken hiç kullanılmamış slota join; expiry worker çalışmadan 49. saatte login; aynı koordinatlı iki season epoch; farklı season aynı pirateIndex ödülü; claim→transfer→handler yarışı; clan leave→transfer deadlock; DB commit sonrası outbox gecikmesi. |
| Worker | Transfer hatası normal fleet arrival'ı durdurmaz; row contention'da 1 saniyelik worker ritmi uzun beklemeye dönüşmez; lock cycle deadlock deneyi. |

Komutlar (repo kökünden):

```bash
pnpm --filter @astera/server test
pnpm --filter @astera/web test
pnpm --filter @astera/rules test
pnpm verify
node tools/visual.mjs
```

Test helper'ı veriyi truncate eder ve DB adı `_test` ile bitmelidir; üretim bağlantısıyla test çalıştırmayın. Test ortamı ayrıntıları `apps/server/test/helpers.ts` ve deployment dokümanından okunur. Yeni hedefli testleri önce çalıştırın, sonrasında `pnpm verify` zorunludur. Var olan manuel D134/VFR balance failure'ı bildiriyor; mevcut checkout'ta yeniden ölçün, “bilinen” diye yeni hatayı ona bağlamayın. Son raporda baseline ve yeni failures ayrılmalı; bantlar genişletilmemeli.

## 14. Operasyon, geçiş ve geri alma

### 14.1 Güvenli yayın sırası

1. Restore edilebilir DB yedeği ve staging kopyası; mevcut row/asset sayılarının başlangıç raporu.
2. **Eski destructive reclaim çağrısını devre dışı bırakan köprü sürümünü önce yayınlayın.** Yeni feature flag kapalıyken davranış “silme de taşıma da yapma” olmalı. Eski reclaim fallback'i olmamalı.
3. Bütün worker süreçlerinin yeni politika üzerinde olduğunu doğrulayın. Rolling deploy'da eski worker yeni waiting player'larını silmemeli.
4. Additive migration ve backfill; şema validator; yeni API/worker/web sürümü feature flag kapalı.
5. Waiting shard/cycle hazırlığı, salt-okunur dry-run: adaylar, dünyalar, blocker nedenleri, gerekli koltuk/slot sayısı, yanlış cycle ve FK anomalileri.
6. Staging'de gidiş ve dönüş, restart, failure ve rollover senaryoları; gerçek yoğunluk ve lock gecikmesi ölçümü.
7. Oyuncuya yeni 48 saat kuralını ürün yüzeyinde gösterin. İlk aktivasyonda geçmiş `lastActiveAt` esas alınır; zaten 48 saat aşmış kişiler batch'lerle taşınır. Ek grace dönemi bu planın varsayımı değildir.
8. Küçük batch aktivasyonu; asset korunumu, queue ve worker gecikmesi izlenir. Sonra normal batch bütçesine geçilir.

Flag önerisi: `INACTIVITY_TRANSFERS_ENABLED`, `RETURN_ADMISSION_ENABLED`; ikisi de off durumunda veri korunur. Başvuru admission kapalıyken kabul ediliyorsa UI bakım durumunu açıkça gösterir. Operasyonel disable işlemi player/queue silmez.

### 14.2 İzleme

En az: uygun inaktif insan/bot sayısı, taşınan/gönderilen/dönen, blocker'a göre deferred, oldest eligible age, queue length ve oldest request age, WAIT kapasitesi/slot doluluğu, transfer süre dağılımı, lock wait/deadlock, worker event lag, outbox pending/oldest, placement version mismatch, asset invariant violation.

Log'da transferId, playerId, source/target season, reason ve duration yeterlidir; auth token/parola/ham özel rapor yazmayın. `/health` bu durumu raporlar; düzeltmez. Hedefler ilk staging ölçümüyle belirlenir; “1 saniye poll” tek başına 1 saniye event latency garantisi değildir.

### 14.3 Geri alma

- İlk adım admission ve auto-transfer flag'lerini kapatmak; mevcut oynanabilir placement'ları korumak.
- Eski destructive sürüme rollback **yasaktır**: yeni waiting'leri silebilir ve taşıma sonrası history bağlarını yanlış yorumlayabilir. Rol/placement uyumlu köprü sürümüne dönün veya forward-fix yapın.
- Commit öncesi hata DB rollback ile çözülür. Commit sonrası “eski koordinatları UPDATE et” güvenli rollback değildir: kaynak koltuk başkasına verilmiş, yeni uçuş başlamış olabilir.
- Gereken geri taşıma mevcut transfer motoruyla, kapasite/FIFO/flight/cycle kontrolleri korunarak yeni audit kaydı üretir; geçmiş kaydı silmez.
- DB backup restore yalnız tam operasyonel kurtarmadır; normal feature rollback'i değildir, sonradan oluşan oyuncu hareketlerini kaybettirir.

## 15. Yayına hazır kabul ölçütleri

- [ ] 48 saat kuralı tek kaynaktan, boundary ve presence yarışıyla doğrulandı.
- [ ] Hiçbir inaktivite yolu `demolish`, player/world delete veya `foldRecord` çağırmıyor.
- [ ] Tek komutan, tüm dünyalar, assets ve kişisel progression korunuyor.
- [ ] Bekleme normal oynanıyor; normal kayıt waiting'e giremiyor.
- [ ] MAIN kapasitesi, dönüş FIFO'su ve join/bot yarışları DB ile güvence altında.
- [ ] Ana dönüş sadece gönderilenlerin kayıtlı boş konumlarını aynen kullanıyor; vacancy yarışı ve koloni farkı test edildi.
- [ ] Waiting koloni allocation mevcut dünyaları değiştirmiyor; yoğunluk limiti ölçüldü.
- [ ] Uçuş/processing event/recovery engelleri bütün türlerde uygulanıyor.
- [ ] Tarihsel referanslar source'ta, live ilişkiler current season'da; fog ve SSE izolasyonu kanıtlandı.
- [ ] Eski cache/HTTP intent/çoklu cihaz yeni placement'a güvenle uzlaşıyor.
- [ ] Klan, ödül, sezon sonucu, rollover ve bot politikaları entegre.
- [ ] Bütün gerekli testler, `pnpm verify` sonucu ve görsel kontrol raporlandı; baseline sorunu varsa ayrı kanıtı var.
- [ ] Migration, dry-run, izleme ve uyumlu rollback adımları denendi.
- [ ] Ürün dokümanları ve TR/EN metinleri yeni davranışla aynı şeyi söylüyor.

Uygulayacak agent'ın ilk somut işi: mevcut referans/lock envanterini doğrulamak ve 48 saat sınırı, üç kolonili atomik transfer, FIFO'da iki worker/son koltuk için kırmızı testleri hazırlamak. Colony slot deneyi sonuçlanmadan canlı veri taşıma yolunu açmayın.


## 16. İkinci inceleme sonucu ve karar sınırları

Bu sürümde düzeltilen eksikler: yeni kayıtların gereksiz toplu bloklanması; klan/season lock kipi ve sırası; event claim ile taşıma yarışı; iki yönlü servise yanlış inaktivite koşulu uygulanması; expiry'nin yeniden girişte baypas edilmesi; mevcut sensör sorgularında season filtresinin eksikliği; pirate ödülünün galaksiler arasında index çakışması; outbox'ın anlık stream revoke sağlamaması; ara dönem provisioning/global rollover ayrımı.

**Çözülmüş teknik tasarım, kullanıcı onayı alınmış ürün ayrıntısı anlamına gelmez.** Şunlar hâlâ Bölüm 2 varsayımıdır: ana shard'a geri dönme kısıtı, 48 saat sonra başvurunun sona ermesi, tüm kolonilerin birlikte taşınması ve mevcut sezon sıfırlamasının sürmesi. Kullanıcının istediği kesin kurallar ise 48 saatlik gidiş, silmeme, normal waiting oyunu, başvuru sırası ve ana sunucuda gönderilenin konumunu devralmadır.

Bölüm 6.2'deki toplu kuyruk kilitlenmesi kullanıcı kararıyla çözüldü: uygun sonraki oyuncu döner, geçemeyen eski başvuru korunur ve yeniden değerlendirilir. Tek oyuncuya gerekli koloni adreslerinin mutlaka açılması garantisi hâlâ yoktur. Diğer Bölüm 2 varsayımları bu sıra kararıyla kendiliğinden onaylanmış sayılmaz.

İnceleme kod okuması ve doküman tutarlılığı kontrolüdür. Uygulama veya test çalıştırması yapılmadı; canlı DB/yoğunluk doğrulaması yapılmış sayılmaz.
