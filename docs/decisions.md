# Decision Log

Every decision that would be expensive to re-derive, at the length it is worth. **This file
outranks the code:** if the implementation disagrees, find out why before assuming the code
is right.

Keep entries short. A decision is _the rule_, _the evidence_, and _what it binds_. Narrative
belongs in git; superseded entries are deleted, not archived.

## Design

D1 · Core tension: information game — LOCKED
Oyunun ana gerilimi görmek ve görülmek; fleet allocation çözüm/tanıtım aracıdır, çekirdek değildir. Commitment-primary, timing-window ve arms-race yaklaşımları reddedildi. Binds: Telescope, Radar, Explorer, Veil core sistemlerdir; combat basit kalabilir; 3D galaxy hedef listesi değil arayüzdür.

D2 · Score = Dominion — LOCKED
Dominion = (looted + enemy value destroyed) − (lost + own value destroyed). Net worth modeli reddedildi; builder'lar raider'ların 2.1× net worth'una çıktı ve loot oranı değişse de raid tax 0.05 kaldı. Dominion sıfır toplamdır, sadece combat üretir ve verimli kazanmayı/scouting'i ödüllendirir; savunmayı da puanlar. Binds: ek anti-turtle sistemi gerekmez; Wealth gösterilir ama sıralanmaz.

D3 · Disruption — LOCKED, duration PROVISIONAL
Başarılı raid works'ü offline eder: 180 dk DECISIVE, 60 dk PARTIAL; refresh olur, stack olmaz; geçici tavan 240 dk. Çalınan alloy 1× dönerken yatırılan alloy sezon boyunca ~16× büyüdüğü için disruption raid tax'i 0.06 → 0.18 yükseltti. Binalar hasar almaz.

D4 · Instant construction — LOCKED
Build timer/queue yok. Timer sadece zayıf bir geri-dönüş sebebi ve speed-up satış mekanizması olurdu; instant build panik savunmasını mümkün kılar. Binds: Shipyard yalnızca hull tier/probe stealth'i açar, build speed'i değil.

D5 · Season = 14 days — STRUCTURE LOCKED, NUMBER PROVISIONAL
Mevcut maliyet eğrisi ve 8–24 saatlik upgrade payback ile Core L12–14 için 300–340 saat exposure gerekir. 7 gün mid-game'i ulaştırmadı; 14 gün hafta sonu oyuncularına iki şans verir. Maliyet eğrisi değişirse yeniden türetilmeli.

D6 · Clarity gradient — LOCKED
Telescope vs Veil beş durum üretir: FULL → BLIND. Amaç duvar gibi evet/hayır değil, stale olabilecek bilgiyle karar vermektir; clarity = 0 bile anlamlıdır.

D7 · Durable ground defence, 60% salvage — LOCKED
Tüketilebilir savunmada saldırıların ~%95'i DECISIVE oluyordu; bu durumda scouting değersizleşiyordu. Kalıcı savunma scouting değerini 6–19×/raid seviyesine taşıdı. Güvenli olması D2'ye bağlı; Wealth ladder olsaydı turtle açığı doğardı.

D8 · Support hull protection — LOCKED
Hauler: 80 HP, her şeyden 1.6× hasar; round 1'de ölünce saldırılar cargosuz kalıyordu. Combat hull'lar yaşarken support hull'ları korumak escort kararını oluşturuyor.

D9 · Radar warns before impact — LOCKED
40 dakikalık uçuş 40 dakika warning vermemeli. Radar seviyesinin yalnızca fuse'u uzatması gerektiği ilkesi korunuyor. Enforcement: warning event + notification payload + pending[] gate. Mekanizma D49 ile countdown'dan radius'a çevrildi.

D10 · Veil hides, never lies — LOCKED MVP
Gizli durum UNKNOWN, sahte HOME değil. Active deception güçlü bir post-MVP adayı; UNKNOWN zaten blöf üretmeye yetiyor.

D11 · Simple combat — LOCKED
3 round, simultaneous fire, counter cycle, ±8% variance, no input. ±8% sınır; random sonuçları baskın hale gelirse intel değersizleşir.

D12 · Score value destroyed, not ATK × HP — LOCKED
fleetPower counter matrix'i görmez; örneğin 26 Wasps ve 1 Bastion eşit okunabilir ama Wasps onu yok eder. fleetPower yalnızca advisory heuristic; grading asla onunla yapılmaz.

D13 · Flat vault floor; vaultMult < alloyMult — LOCKED invariant
Flat floor küçük oyuncuyu çok, büyük oyuncuyu az korur. İlk 900 × 1.5^L tasarımında vault level 3'ten itibaren elde tutulabilecek değerin 208–301%'ini kaplayarak oyundaki her şeyi raidable olmaktan çıkardı. İlişki tersine dönemez; test gerekir.

D14 · No newcomer grace — OWNER DECISION
4 saatlik immunity kaldırıldı. İlk saatlerin güvenli olması oyunun öğretmek istediği “güvenli değilsin” temasına ters. Koruma yalnızca situation-based tier band + bash limitten geliyor. Gerçek shard verisi olmadan tekrar düşünülmez.

D15 · Hardware visible, readings hidden — LOCKED
Satellites herkesçe görülür; planet size public Core tier'dan üç seviyeli siluettir. Fog state üzerindedir: fleet konumu, storage, probe sonucu vb.; construction ve level gizli. /api/galaxy yalnızca satellite TYPES yayınlar.

D16 · Manual production collection — OWNER DECISION
Works COLLECTOR.hours kadar buffer doldurur, sonra durur; tek tap storage'a aktarır ve üretim devam eder. Toplam accumulation 22 saat = 10 works + 12 storage. Uncollected ore LOOT.bufferShare ile %50 raid edilebilir; tamamen güvenli bırakılmaz.

D17 · Income doubled — OWNER DECISION
alloyBase 40→80, crystalBase 14→28. Sadece income'u ikiye katlamak testlerin 18/30'unu bozdu: RR 0.05, %83–91 repel, turtle +475k. Düzeltmeler: hull cost + Hauler cargo ×2; vaultBase 300→600; costMult 1.55→1.70; partialThreshold 0.60→0.45. Core 12 upgrade payback ~38 saat; playtest açık konusu.

D18 · Telescope range + slot cooldown — OWNER DECISION
Telescope üç gate kullanır: level-based slots, INTEL.telescopeRange, repoint cooldown (24h L1 → 6h L5). Empty slot doldurmak ücretsiz, switching ücretli. Böylece L1 telescope 30 saniyede tüm galaxy'yi tarayamaz; range knowledge'ı, cooldown ise observation commitment'ını sınırlar. Watching sessizdir.

D19 · Asteroid mining economy — OWNER DECISION
Rock level 1–5 ore'u belirler; orbital speed level'dan bağımsız random banddadır. Interception continuous-time ve exact çözülür; sonuç seed+clock'tan yeniden üretilebilir. First arrival takes what it can carry. Prospector mining yaparken planet AWAY olmaz; telescope yalnızca combat fleet'in home olup olmadığını satar.

D20 · Galaxy is the only screen — OWNER DECISION
Tab bar kaldırıldı; galaxy tüm ekranı doldurur, diğer yüzeyler onun üstünde açılır. Focus temel etkileşimdir: her nesneye tıklama, oyuncunun bilmeye hakkı olan bilgileri ve bunların kaynağı/staleness'ını gösterir.

D21 · Identity + 10 galaxies — OWNER DECISION
Username/password, scrypt, lowercase unique; email/recovery yok. 10 galaxy × 50, her zaman en düşük ordinal boş galaxy'ye join. Bir account = bir planet = bir galaxy, unique index ile enforced. 50-world galaxy aynı disc'te neighbour mesafesini ~2× artırır; balance constant değiştirilmez. Sign-out cookie'yi temizlese de refresh JWT expiration'a kadar geçerlidir.

D22 · Opening is budget; satellites are priced — OWNER DECISION
Starting fleet yok; START = 2,060 alloy + 276 crystal. Orbital Ring emekli edildi. Slot cap yerine identity choice satellite price ile oluşturulur. Ring kaldırılınca Aegis adoption 18%→67%, raid return 1.33–1.42→0.60–0.73; sorun satellite değil SHIELD.base, 700→40.

D23 · Return overlay removed — OWNER DECISION
“While you were gone” overlay kaldırıldı; event'ler Signals'ta, flights sürekli strip'te. Loading screen spinner değil: yalnızca gerçek progress gösterir, failed asset'i settled sayar ve deadline'da açılır. Sahte progress, hiç progress olmamasından kötüdür.

D24 · Galaxy public, intent private — OWNER DECISION
Hareket eden her şey gerçek konumunda herkesçe görünür; route gizlidir. Payload yalnızca mevcut/yakın bearing window taşır. Mining tam public exception'dır. Cargo/loot/resource miktarı asla public değildir. Public motion “galaxy deserted” hissini çözer; scouting değerinin düşmesi durumunda BEARING_MINUTES, fleet payload veya görünürlük bandı geri çekilebilir.

D25 · 4 instruments + 4 satellites — OWNER DECISION
Ground instruments: Telescope, Radar, Aegis, Veil; level alır, slot kullanmaz. Orbit satellites: Uplink, Foundry, Derrick, Beacon; bir kez alınır, level yoktur.

Satellite Etki Fiyat
Uplink Telescope + Radar unlock 1,500 / 500
Foundry Works üretimi +6% 9,000 / 3,000
Derrick Prospector cargo 2.6×, speed 1.5× 9,000 / 3,000
Beacon Tüm fleet 1.3× hızlı 11,000 / 3,500

Core slotları L1/L3/L5/L9. Uplink tek gate'dir; maliyeti düşük, gerçek maliyet slot'tur. Drill artık craft'tır; Prospector'ı yalnızca minShipyard sınırlar. Foundry 1.06 kalır; daha yüksek multiplier turtle'u kazanıyor. Simulator, simulate etmediği şeyi fiyatlamamalı.

D26 · Cards must identify themselves — OWNER DECISION
Her card name altında 2–3 kelimelik TAG taşır; role cümlesinden ayrıdır. Action control küçülebilir ama clip edilemez; SHORT state iki satır olur. /api/mining schema değişimi client Zod'u bozunca asteroid sistemi tamamen karardı; çözüm: client schema'larını live app + real DB üzerinden test eden contract.test.ts. Parsed route eklendiğinde buraya da eklenir.

D27 · Two opposite ground hull classes — MEASURED
Thorn: Skirmisher, 16 atk / 60 hp / 1,600/240, Shipyard 0. Tek ground hull iki aşırı sonuç doğuruyordu. İki opposite class, “planet neye güçlü?” kararını hem defender hem attacker için anlamlı kılıyor.

Thorn RR Sonuç
920 0.96 Raiding net-negative
1,380 1.21 Floor altında
1,840 1.40 5/5 + TAX 0.100
2,300 1.36 3/5

BULWARK.atk artırılmadı; durability hull olarak kalmalı. Binds: Birden fazla ground hull, hiçbir attacking hull her şeyi hard-counter edemez, her hull counterable, en ucuz hull Shipyard 0'da.

D28 · Flight bays — OWNER DECISION
Her outbound round trip bir bay kaplar; mining squadron tek baydir. flightSlots(core)=3+floor(core/3). Base 3 probe cap'in yerini alır. Bay ownership leg-based: outbound origin'e, return target'a aittir. Count row-lock altında yapılır. Failed event tuttuğu bay'i bırakır; abandon() mission'ı geri getirir, /health failed events sayar. Simulator bay'i modellemez; constraint orada bağlanmıyor.

D29 · Opening grant remains 2,060/276 — MEASURED
Crystal, ilk üç mandatory upgrade ile tamamen bitiyor; en ucuz probe 50/50, dolayısıyla alloy artırmak açılışı çözmüyor.

START Informed top RR TAX
2,060/276 7/8 1.28 0.073
2,110/326 5/8 1.49 0.106
3,660/516 3/5 1.17 0.075

Daha gevşek opening herkesin daha erken hareket etmesini sağlar ama informed edge'i düşürür. Opening grant, “thinking'in değerini” ayarlar. Ayrıca: “Ships in flight cannot be raided. Your planet can.”

D30 · Instruments remain cheap — MEASURED
Dört instrument L5 toplamı 42,219, L10→11 building step'inden düşük. Daha pahalı yapmak gate'leri bozuyor; telescope ownership %34 ile fiyatlardan bağımsız kalıyor ve para buildings'e kayıyor. INSTRUMENT_LEVEL_WORTH=1 no-op olarak korunur; sonraki balance müdahalesinde referans olması için.

D31 · Mined ore lands in works — OWNER DECISION
Returning Prospector ore'u storage'a değil works'e bırakır; collectorCap üst sınırdır ve alloy/crystal ceiling'leri bağımsızdır. Mining artık throughput, half-rate raidability ve collection ile savaş ekonomisine bağlıdır. Panel, craft gönderilmeden önce works'ün ne kadar alabileceğini gösterir. Uncontested miner ~3,636/h, kendi üretiminin ~%86'sı; mining competes for bays ve pure miner 0 Dominion.

D32 · Battles create public debris — OWNER DECISION
Battle sonrası defender coordinates'te, iki tarafın öldürülen non-ground hull değerinin DEBRIS.share kadarını taşıyan, 3 saat yaşayan public debris field oluşur. Ground hull katkısı yoktur; bunlar zaten %60 salvage alır. Debris Wealth'e eklenir, Dominion'a değil; çünkü kimsenin elinden alınmamıştır. Field değeri piles + clock + harvested amount'tan türetilir, stored değildir. DEBRIS.share < 1.

D33 · Doctrine removed — MEASURED
İkinci progression axis, bonus 0 olsa bile purchase'ın kendisi ARR/TAX gate'lerini bozduğu için kaldırıldı. D30'un genellemesi: yeni un-losable sink eklenemez; research tree, permanent upgrade veya Wealth-counting cosmetic bile aynı sorunu çıkarır. Önce TAX headroom, sonra ARR yeniden ölçülmeli; band genişletilerek feature kabul edilmemeli.

D34 · Maximum 3 Prospectors — OWNER DECISION
PROSPECTOR.max=3, tüm location'lar birlikte sayılır. Fiyat sınırı yerine ownership cap kullanılır; loadLocked değil totalUnitsOf row lock altında okunur. fleetAway planet API'ye taşınır; cap server-side enforcement'tır.

D35 · Debris asset is one annulus — IMPLEMENTATION NOTE
Wreck asset bütün ring olarak tek kez instantiate edilir. unitModel ilk mesh'i alır; ince shell THREE.DoubleSide ister; model material'i flat tint'i override eder. Clearance planet radius'un multiplier'ıdır. Chunk detail mesh'e bake'dir. Tap targets: world 0–12px, wreck 16–28px. Testler arasında reload gerekir.

D36 · Instrument level must stop where data stops — MEASURED
Tables 6 entry iken L6/L8 gibi seviyeler ödeme alıp aynı sonucu veriyordu. INSTRUMENT_MAX_LEVEL table length'ten türetilir; raiseInstrument ötesini reddeder; telescope slots da clamp edilir. Aegis/Veil'de anlamlı effect sürdüğü için hard cap yok. Her levelde değer değişmeli veya “nothing left to sell” açıkça işaretlenmelidir. Existing over-cap levels grandfather edilir.

D37 · Debris share = 10% — PROVISIONAL
0.25→0.10; %25 wreck, üretildiği raid'den daha değerli oluyordu.

D38 · Galaxy must look inhabited — OWNER REPORT
Server doğru, client stale. Event stream traffic/mining'i invalid etmiyordu; neighbour launch ancak poll ile görülüyordu. Poll süreleri ~20s/30s seviyesine indirildi; arrival için useArrivals timer kullanıldı. Stale interpolation craft'ı destination'da parked gösteriyordu.

D39 · Same raid, same clock — OWNER REPORT
Attacker/defender aynı fleet için farklı countdown görüyordu çünkü one side rounded minutesRemaining, diğer side exact arriveAt taşıyordu. arriveAt tüm threads'te bulunur. Radar yalnızca warning timing'i satar; clock precision aynı kalır.

D40 · Squadron = 10 ships/model — OWNER DECISION
PER_MODEL 5→10; flying asset'ler %25 küçülür; shallow V yerine solid cone kullanılır. Radius/depth √index ile büyür; golden angle tekrar eden spoke görüntüsünü engeller.

D41 · Aegis = panelled shell — OWNER DECISION
Hexagonal fragment-shader grid; level ile cold-blue whitening. half GLSL reserved word; shader comments içinde backtick template literal'ı bozabilir; fwidth offset değil edge softening için kullanılmalıdır. Grid dome'un tamamında görünmeli, cell interiors fill olmamalıdır.

D42 · First orders removed — OWNER DECISION
İlk sipariş sistemi kaldırıldı; onboarding yeniden ele alınacak.

D43 · Prospector speed corrected — OWNER INSTRUCTION
3,483 launch ölçümünde asteroid intercept'i 1.10 revolution ahead, median 686 unit sapıyordu. PROSPECTOR.speed=3×(min+max)/2=660; sapma 0.34 revolution seviyesine indi. Mining yield değişmiyor; yalnızca race sonucu değişiyor. Intercept root artık unique ve çözülebilir.

D44 · Raid = 10s live bombardment — OWNER INSTRUCTION
Fleet arriveAt'ta target orbit'e gelir, combat COMBAT.engagementSeconds sonra resolve olur; mission bu arada in_flight kalır. arriveAt değişmez. Sonrasında D52 ile engagement tüm galaxy'ye public hale geldi. orbitStandoff, local/world coordinate ayrımı, texture-based fire color, plume/wake yönü ve CDP screenshot requestAnimationFrame starvation özel testlerle korunur.

D45 · Game must report its actions — OWNER INSTRUCTION
Server'ın doğru yaptığı ama oyuncuya iletmediği olaylar temizlendi. raid_result, probe_report, unlock dahil notification sistemi yedi türe çıkarıldı. announceUnlocks tek unlocksSeen yazarıdır. Radar level warning anında okunur. Notifications (player_id, kind, ref_id) ile idempotenttir. Payload'lar contract testinden geçer. Countdown instant olarak tutulur, etaMinutes snapshot değildir. Client mailbox: markSeen invalidation, batch toast, enum drift ve duplicate scan sorunları düzeltildi.

D46 · Missing event releases flight — BUG FIX
Event kaybolduğunda reap/fail/health bunu göremiyordu ve flight bay tutuluyordu. sweepStranded, event KIND üzerinden abandon() çağırarak bırakır.

D47 · Target visibility + migration safety — BUG FIXES
galaxyTraffic target'ı da exclude ettiği için saldırıya uğrayan oyuncu blindness yaşıyordu; leg-based attribution ile düzeltildi. Eksik migration worker'ı tamamen durdurabiliyordu; boot'ta migration journal ile schema doğrulanır, otomatik migration yapılmaz. Repair sweep hata verirse queue'yu durdurmamalıdır.

D48 · Mining launch overhead — MEASURED
3,744 launch: median 4.44m, bunun 3.00m / %68'i TRAVEL.baseMinutes; farkın %85'i craft hareket etmeden önceki sabit gecikmeden geliyordu. PROSPECTOR.launchMinutes=0.4; flight 4.44→1.86m. TRAVEL.baseMinutes değişmez. Diğer sorun stale polling/interpolation'dı.

D49 · Attack band + radar radius — OWNER DECISIONS
Attack eligibility: |coreTier(a)-coreTier(b)| ≤ 2; ABUSE.rankFloor kaldırıldı. Core tier public olduğundan rule saldırıdan önce görülebilir. Hoarder abuse'ını bash limit engeller.

Radar artık countdown değil reach:
INTEL.radarRange=[0,0,0,200,340,500]
Warning fleet circle'a girdiğinde çıkar. Notice oneWay × range / distance; radarLead() hem scheduled warning hem pendingThreads tarafından kullanılır. RADAR_LEADS yerine RADAR_RANGES vardır.

D50 · Contacts keep moving to arrival — BUG FIX
Bearing window'ın sonunu 4/5 leg'de veya 45s önce kesmek craft'ları final approach'ta donduruyordu. Fixed 45s margin kullanıldı; fog'a maliyeti yoktu.

D51 · One live galaxy — BUG FIXES
Return leg başlangıcı standoff ile düzeltilir; foreign craft worlds içine girmeyecek şekilde clearOfWorlds ile yüzeye alınır; exact minutesLeft tek clock source olur; foreign arrival unknown açıkça gösterilir; salvage ContactKind=harvest ile doğru render edilir. /api/galaxy artık 60s polling ile stale kalmaz; telescope reads (watchId,timeWindow) seed'i sayesinde tekrar okumak confirmation satın almaz. useNotifications.enabled gerçekten query'yi kontrol eder.

D52 · Living galaxy: battle public, server clock, nothing waits — OWNER INSTRUCTION
Ürün hedefi: “fun, utopian, epic — a NASA photograph happening right now.”
Combat engagement tüm galaxy'ye yayınlanır; aynı MISSION ID aynı volley'yi üretir. Target coordinates zaten public'tir; owner/origin disclosure yoktur. Target'a ulaşan fleet her durumda 10s fire eder.

Arrival margin tamamen kaldırıldı; bearing window gerçek arrival instant'ına kadar gider. Tüm animasyonlar serverNow() ile cihaz clock'una göre değil server offset'ine göre çizilir.

Liveness: worker poll 5s→1s; arrival refetch “chasing” yapar ve payload değişince durur; bystander engagement da aynı hook ile güncellenir. İlk polling modelinden sonra D53 ile 60s safety poll + galaxy-wide SSE broadcast modeline geçildi.

Bombardment daha yoğun: round/model 4–8, toplam minimum 18, maximum 40 shared/model. ContactFocus: “A raid is landing / Under fire”.

D52b · Review fixes
Composition public kalır; Radar'ın sattığı şey attribution + warning time'dır. /api/planet economy caps production multiplier'ı hesaba katmıyordu; düzeltilip Works meter ve satellite output ile hizalandı. Client'ın parse ettiği tüm 30 route contract test kapsamına alındı. join galaxy dolduktan sonra idempotentliğini kaybediyordu; düzeltildi. Recalled probe notification artık doğru craft kind'ını söyler. Kullanılmayan 5 exported function silindi. Blind attack valuation storageCap yerine works + storage kuralına getirildi; bu TAX'ı tekrar band içine taşıdı, ARR tek kırmızı kaldı.

D52a · Review of D52
useProjected device/server epoch'larını karıştırıyordu; tüm hesap serverNow()/toServerTime'a taşındı. Stranded-flight sweep artık worker tick'inden bağımsız 30s cadence kullanır. wipeAllServers debris foreign key sırası yüzünden oynanmış galaxy'yi silemiyordu; düzeltildi. Beacon return leg'de hız bonusunu uygulamıyordu; düzeltildi ve simulator ile hizalandı.

D53 · Galaxy live for everyone — OWNER INSTRUCTION
Scene renderer setInterval yerine requestAnimationFrame kullanır; stride display refresh'e göre floor edilir. Bombardment sırasında <FullRate /> tüm frame'leri ister. Public event bus artık season-keyed ikinci topic ile neighbour traffic'i de yayınlar. Bystander launch visibility gerçek browser'da 821–872ms, eski poll ise 20s idi.

Broadcast payload yalnızca { shard id, kind }; world/owner/heading/position taşımaz. Yalnızca public payload değiştiğinde publish edilir. 50 commander için eski sistemin boşta 150 req/min tabanı yerine event-driven model kullanılır. 60s poll safety net olarak kalır; /health bus durumunu raporlar.

Mutations artık aynı transaction içinde planetView() döndürür; ikinci /api/planet round-trip kalkar. Launch kendi pendingThreads'ini de döndürür. Client upgrade/build/instrument/satellite/collect için güvenli optimistic prediction yapar; emin olunmayan constraint'lerde prediction yapılmaz. Gerçek browser'da server 2s geciktirilse bile screen tap ile 683ms içinde eşleşti. Projection rollback da server clock ile düzeltildi.

Galaxy clock render'ı gereksiz watching array recreation üretiyordu; BufferGeometry yeniden yaratılması engellendi. İki varsayılan hata doğrulanmadı: engagement geçişi 5s clock yüzünden gecikmiyor; resting geometry leak yok, plateau 42'de.

abandon() ve sweepStranded artık public departure broadcast eder. /api/stream gerçek socket üzerinden test edilir.

D53 — Deliberately NOT DONE
Mining/salvage launch hâlâ iki round-trip kullanır; bunu tek round-trip yapmak mining + pending döndürmeyi gerektirdiğinden scope dışıdır. Atmosphere pass ayrı tutulmuştur.

D53a · Worlds get atmosphere — OWNER INSTRUCTION
Dünya sahnedeki tek hareketsiz nesneydi. Atmosphere limb eklenerek edge'de daha parlak, siluet dışına hafif taşan gerçekçi ışık oluşturuldu. Tek instanced quad + iki gradient kullanılır; effect küçük tutulur, selection ring'i bastırmaz. World başına düşük frekanslı 18s / 1.5% breathing eklenmiştir.

Disc plane önce ring/spoke diagram olarak bırakıldı; bu çözüm fotoğraf hissini sağlayamadı ve D53b ile superseded edildi. Query error state'leri de isPending || !data yüzünden forever-loading görünüyordu; error/empty ayrımı standartlaştırıldı.

D53b · Plane is photographed, not plotted — OWNER REJECTION
Ring/spoke yapısı tamamen kaldırıldı; plane, nebula ile aynı görsel prensiplerle oluşturulmuş painted plate haline getirildi: domain-warped noise, independent dust subtraction, narrow palette, arms fading at rim. Amaç görseli legible yapmak değil, world'leri scenery'den üstün tutmak. Brightness yaklaşık 0.18; test “dark enough” değil, subordination ilişkisini ölçer. Rim'de sıfır, Core içi boş olmalıdır.

D54 · Astera Online + identity — OWNER INSTRUCTION

Name: Blindspace repo içindeki public/runtime isimlerden çıkarıldı. Package scope @astera/\*; DB role/database/container/channel sırasıyla astera, astera_test, astera-pg, astera_events; title/manifest = Astera Online; mobile short names = Astera. Repository directory blindspace kalır.

Identity/art: Art black background'a göre tasarlanmadığı için alpha extraction alpha=max(r,g,b), colour=pixel/alpha ile yapıldı; luminance kullanılmadı. 255-color quantization 66KB vs 272KB. Wordmark tek component'tir; icons/favicon'ler artwork'ün wordless square crop'larıdır.

Logout: Kullanıcı SEASON kontrolünün altında gizli olduğu için logout'u bulamıyordu. Header kontrolü artık commander NAME + season duration gösterir. Genel kural: bir surface yalnızca side-effect üzerinden ulaşılabiliyorsa veya açan kontrol onu adlandırmıyorsa oyuncu açısından yoktur.

D55 · Turkish + English localization — OWNER INSTRUCTION

Türkçe/İngilizce device-detected, 2 tap ile değişebilir; runtime string fetch yok. i18next + react-i18next, bundle içi resources. Detection sırası stored choice → navigator.languages → Turkish fallback.

Her UI element kendi key alanına sahiptir; farklı yüzeylerdeki aynı İngilizce ifade bile ayrı key olabilir. Türkçe dictionary translation değil, yeniden yazımdır: tam cümleler, verb-based phrasing, dash yerine semicolon/full stop, dictionary equivalent yerine doğal ifade. Tab'ler Türkçe'de noun formatında: Üretim · Yörünge · Savunma · Filo.

Ship isimleri de çevrilir: Atmaca, Mızrak, Siper, Şilep, Tabya, Diken, Kazıcı. Rules package language-free kalır.

Errors stable CODE + params taşır; isimler ID olarak gelir ve client tarafından son anda çevrilir. Numbers/clocks locale-aware'dir (toLocaleString). t() typed olduğu için eksik/extra key compile-time fail eder; testler ayrıca empty string, untranslated copy, missing placeholders ve plural sorunlarını kontrol eder. Untranslated testinin exception listesi de test edilir: artık aynı olmayan bir istisna testi kırar, böylece izin çürümez.

Kurallar locales/tr/entry.ts başına yazıldı — çeviri yapan bir sonraki kişi önce onu okur.

Language switcher iki yerdedir: commander sheet (dil bir account bilgisidir) ve front door (yanlış dile düşen ziyaretçinin hesabı yoktur, sheet'e erişemez). Her seçenek kendi dilinde yazılır — "Türkçe", "Turkish" değil.

i18n instance DOM'a dokunmaz; lang/description/manifest güncellemesi document.ts'e ayrılmıştır. Sebep: server'ın contract test'i notifications.ts üzerinden bu instance'ı import eder ve Node tipleriyle derlenmek zorundadır.

### D56 · The rehearsal: ninety seconds of the real game before there is an account — owner instruction

**The front door stopped being a form.** Two equally weighted buttons, one of them opening a
password field, is the shape of a service you sign up for; a stranger meeting it has been asked
to commit before being given a reason to. There is one control now, signing in is a line of
text for the minority arriving on a new device, and the premise paragraphs are gone — the
middle of that page is the sky, which is the argument it is actually making.

**A visitor plays the real galaxy first, and it costs the shard nothing.** `GET /api/preview` is
public and writes NOTHING: no account, no player row, no planet, and above all **no seat**. A
galaxy holds fifty worlds and fills strictly in order (D21), and that rule is the only mitigation
the empty-shard risk has — handing a seat to somebody who has committed nothing is how it gets
spent on people who never came back. What the payload carries is the same projection every
player already receives about everybody else (`services/publicGalaxy.ts`, shared with
`/api/galaxy` so the fog's floor cannot drift between an authenticated read and an
unauthenticated one) plus the slot the server would give them, by name.

**The motion is free.** Contacts carry their own departure and arrival instants and every leg is
interpolated against the server clock, so one payload and a clock is a galaxy that keeps moving
for as long as the visitor watches it — no stream, no poll, no session.

**Nothing is rebuilt.** The rehearsal renders the real `StatusBar`, `GalaxyView`, `PlanetScreen`
and focus rail, handed an `Api` whose `fetch` never leaves the device (`rehearsalFetch`). A
tutorial made of its own mock surfaces teaches an interface that does not exist. Its planet is
built from `@astera/rules` — the same module the server validates with, which is the whole reason
this is cheap here and would be reckless anywhere else — and parsed by the production Zod
schemas, so a rehearsal that drifts from the contract fails where a real payload would.

**It decides nothing.** Every press produces an INTENT. `POST /api/onboarding/claim` makes the
account, takes the seat and replays those intents through `upgradeBuilding`, `buildUnits` and
`launchAttack` with the ordinary locks and the ordinary refusals. Principle 1 is intact: the
client rendered and sent intent, and the fact that it could also predict the outcome is what let
the screen keep up with a finger.

**The opening it teaches is arithmetic, not a script.** `START` is 2,060 alloy and 276 crystal,
and a fresh planet holds the Core and the Refinery both at 1 — so `1 >= 1` refuses the first
upgrade a commander reaches for and the order is forced: Core, Refinery, Extractor, which spend
**all 276 crystal exactly**, leaving alloy for **exactly two Wasps**. That is why the first flight
is a raid and not a probe: after the mandatory three there is no crystal for one. A test asserts
the whole chain, so a balance change breaks it here rather than in front of a stranger.
**D58 put a cushion on the real planet and left this untouched on purpose** — the rehearsal opens
on `START`, the server creates the world with `PLANET_START`, and the difference is exactly
`OPENING_BONUS`. Handing the rehearsal the cushion as well would make the beat's sentence false
and turn a lesson in scarcity into a shopping trip; what the commander finds after claiming is a
welcome rather than a misprediction. `openWorld` says so at the site.

**The wall is at the end, at the moment of most desire** — a world with a name, a fleet they
built and a target they chose. Two steps inside ONE `<form>`: a password manager only offers to
save a credential when the username and the password are submitted together, so two forms would
silently cost every player the thing that makes an account survive a reinstall.

**Idempotency without a key.** A retried claim recognises the caller by password rather than
answering USERNAME_TAKEN for the name they just made, and replays the opening only onto a planet
nobody has acted on — exactly the grant, a Core at 1, no ships, no missions. `request_log` is the
wrong tool here: it exists for the launch path, where one player makes many similar calls and only
a key can tell them apart. A claim happens once per account, ever, and a fact derived from state
cannot go stale the way a stored key can (A5). **A refused replay step never costs the account** —
the account and the planet commit first, and each step reports for itself.

**It is guided, and one thing is pressable at a time.** A beat that asks for the Command Core
while every other control still works is a suggestion, and a stranger who presses something else
is left looking at an instruction that no longer describes the screen. `Gate.tsx` cancels
ACTIVATIONS outside the beat's target — never pointer or touch events, which would cancel the
scroll or the orbit they were the first frame of — so the panel still scrolls and the disc still
orbits. Worlds are gated at the tap router instead of by a hole in an overlay, because a world is
a moving point inside a canvas and a hole drifts off it the moment the camera does. **The beat
card is always exempt:** a player who cannot find what a beat asks for has to be able to leave, or
a guided opening becomes a locked door.

**The gate follows the commitment down.** A beat's allowance is a LIST, shallow to deep, because
pressing its control opens a surface: the Wasp row opens a build sheet with a count picker, and
choosing a target opens the focus rail and then the launch sheet. Gating only the first control
seals the player inside the very sheet they were told to open — found by photographing it, not by
a test. The spotlight takes whichever target is on top, and the card flips to the opposite edge so
it never covers what it is pointing at.

**The camera opens on the whole disc with nothing selected.** The ordinary first frame snaps to
the player's own world, which is right for a commander returning to a season and wrong for
somebody who has never seen this galaxy — it answers "where am I" before they have asked, and it
leaves the opening instruction with nothing to do. Flying in is the one camera move the rehearsal
makes, and it is a control the player presses.

**Forced by this, and each says something general:**
- **`REFINERY` and `EXTRACTOR` rows had no `id`,** so `onNeed()` switched tab and then scrolled to
  nothing. Two of the five buildings could never be pointed at. Hull rows had none either.
- **`data-act` marks the one control a row commits with,** so a surface outside the row can light
  it without knowing how the row is built.
- **The rehearsal drew every rock the seed produces** rather than the ones alive right now —
  nine hundred asteroids over a galaxy that has a few dozen, burying the worlds the beats were
  asking the player to find. `activeAsteroids`, the same filter the server runs.
- **A sentinel id reached a `uuid` column** and the driver refused it, which is the protection
  working: `galaxyTraffic` takes `null` for "exclude nothing" now.
- **The toast landed across the instruction.** The card publishes its own height as
  `--toast-lift`.
- **Pressing the door dropped to the loading frame** — a spinner where a decision should be. The
  page stays and the control says it is working.

**THE LIGHT IS DRIVEN BY THE FRAME LOOP, NOT BY REACT, and it took three reports to get
right.** Measuring a target into `useState` puts the ring one paint behind it — the rAF
measures, React re-renders, and the browser shows the new position on the next frame — which
standing still is invisible and on a sheet somebody is dragging reads exactly as lag. It also
re-rendered `GalaxyView` sixty times a second while a finger was down, which is the failure
`Anything that renders the disc takes stable props` (D53) exists to prevent. Nothing in
`Spotlight` is state now: the boxes are written onto the DOM inside the measuring frame.

**A `box-shadow` can only cut ONE hole, and a beat lights more than one thing.** It lights the
control it wants pressed AND the TAB that control lives under, so with a single hole the tab got
a ring and stayed in the dark — a highlight that visibly did not work. The scrim is an SVG mask
with one hole per target.

**And the scrim is OFF where the whole surface is the decision.** Choosing a target is made by
reading the disc: every world inside the tier band is a legal answer, and greying it out hid the
one thing that beat is asking to be looked at. `dim: false` on that gate; the rings still say
where the controls are.

**Z-INDEX IS NOT THE QUESTION; THE STACKING CONTEXT IS.** The beat card painted over the
loading cover, and raising its number would have fixed the symptom and left the trap. The shell
is `relative z-10`, which MAKES a context — sixty inside a box at ten still loses to fifty
outside it. Every overlay the onboarding draws now lives inside that same wrapper.

**ONLY THE TOPMOST SURFACE IS LIT.** A beat's list spans layers on purpose — the tab, the row's
control, then whatever that control opened — and all of them keep resolving once a sheet is up,
so the two underneath were ringed on top of the sheet covering them. Sheets NEST (the build
sheet renders inside the planet panel), so "topmost" is the deepest `[data-sheet-panel]`, not
the last in document order.

**THE CARD CLEARS EVERY SURFACE THAT OWNS THE BOTTOM EDGE, not just sheets.** The focus rail is
the other one, and narrowing the lit list to the attack control is what exposed it: before that
the rail happened to be measured and the flip happened by accident rather than by rule.

**A GATE MAY ONLY OFFER WHAT THE REHEARSAL CAN HONOUR.** The dossier carries a probe and a
telescope beside the attack, and neither is affordable out of the opening grant — the three
mandatory upgrades spend every unit of crystal and a probe costs fifty of it. Leaving them
pressable put a raw `REHEARSAL_ONLY` on the one screen that is supposed to be teaching. The gate
names the attack path specifically, and the code has a translated sentence behind it in case one
ever slips through again.

**Known limitation:** a refresh mid-rehearsal starts it again. The intents are pure and could be
replayed out of `sessionStorage`; it is not built, because ninety seconds is short enough that
losing it is a smaller cost than a resume path that can disagree with a re-read frontier.

### D56a · The tabs stop giving advice — owner decision
The recommendation pip is gone from the planet screen's tab bar. It marked whichever problem
`lib/directives.ts` ranked highest, and the owner's reading is that a bar of four categories
should state what each one IS and leave the choosing alone — a pip beside an instruction is two
opinions on one screen, which is exactly what the ranking was consolidated to avoid.
**What survives:** the engine still decides which tab the screen OPENS on (`useAdvice`), because
a screen has to open on something. That is a default rather than a recommendation, and it is
invisible.
**What is now unused:** `ui/DirectiveCard.tsx` was already rendered nowhere before this — the
galaxy became the only screen at D20 and the card lost its home. It is the last piece of the
engine's old surface and is left in place deliberately, not overlooked.
**Binds:** `docs/interface.md` I2 no longer describes a pip.

### D57 · Production: one origin, one process, three ceilings — owner instruction

**Live at `asteraonline.space`.** Host nginx serves the built client from
`/var/www/astera` and proxies `/api` to a single container on `127.0.0.1:3200`;
Postgres is a second container on `127.0.0.1:5545` with a named volume. Full
detail in `docs/deployment.md`.

**One origin, and the subdomains redirect.** `api.` and `socket.` were registered
before the code was read; both now 301 to the apex. The client is built
same-origin — `credentials: 'same-origin'`, a `SameSite=Lax` refresh cookie, and no
CORS registered anywhere — so serving the API from `api.` breaks two things
silently: sessions end at the first token expiry, and `x-server-time` becomes
unreadable, which drops the disc back onto the DEVICE clock and undoes D52 for
every player at once. `socket.` was never needed; the only realtime surface is SSE
on `/api/stream`.

**Three rate-limit ceilings, and the seat one is the reason.**
`/api/onboarding/claim` is unauthenticated and takes a SEAT: fifty worlds a galaxy,
filled strictly in order, and that ordering is the whole mitigation for the
empty-shard risk. Unlimited, one script spends it in seconds. Login is capped
because sessions are stateless JWTs with no lockout anywhere else, and because a
wrong password costs a full scrypt — the decoy hash in `authenticate` means a name
that does not exist costs exactly as much, which is right for timing and expensive
under load: fifty concurrent bad logins pinned a core for half a second on the
development box. A global ceiling sits under both. `/health` is exempt, because its
callers are machines and a 429 there reads as an outage.

**`TRUST_PROXY` is off by default and on in production.** Behind nginx `req.ip` is
the proxy, so one bucket would hold the entire internet and the first burst would
lock out every player at once. It is only safe because the API port is published on
loopback: a server reachable directly must never believe an address the caller
wrote.

**Routes are registered inside `app.after()`, and that is load-bearing.**
`register` QUEUES a plugin; routes added synchronously afterwards exist before the
plugin does, so a plugin that works by inspecting routes as they arrive never sees
them. Every per-route ceiling was silently ignored — the API answered 200 to an
unlimited flood, typechecked, and passed every test not specifically looking for a
429.

**A rate-limit refusal is a `GameError`.** Whatever `errorResponseBuilder` returns
is handed to the error handler AS the error, and a plain object arrives with no
`statusCode` — so the handler cannot tell it from a bug and answers 500. Returning
the project's own error type means one refusal shape for the whole API, and
`RATE_LIMITED` localises off its code with `{ seconds }` intact (D55).

**`tsx` is a dependency of `apps/server`, not a dev tool.** `@astera/rules` is
consumed as source so the three consumers cannot drift, so production needs a
TypeScript runtime. It resolves because pnpm links the workspace package as a
symlink and Node takes the real path — outside `node_modules`, which is the only
place tsx will transpile.

**Migrations run before the new image serves.** The server refuses to start against
a database it is ahead of (D47) and that refusal is the good outcome; the reverse
order is an old image against a new schema, which answers every request and fails
every worker tick.

**`/health` reports and never restarts.** Compose does not restart an unhealthy
container and nothing may be wired up to make it: every 503 it produces describes
state a restart would clear without fixing, and clearing it destroys the evidence.

**Binds:** `docs/deployment.md`; `docker-compose.prod.yml` and the file beside it
are not interchangeable — `docker-compose.yml` is tmpfs and its password is the
word "astera".

### D58 · A cushion after onboarding — owner instruction, overriding a measured refusal

**A new planet is created with `START` plus `OPENING_BONUS` (1,000 alloy, 500
crystal), granted once, when the planet is made.** One account holds one planet,
so it cannot fire twice; there is no daily grant and no repeat.

**The problem is real.** `START` is exactly what the opening COSTS and the
rehearsal spends it to the last crystal: three mandatory upgrades and two Wasps,
which then leave. A commander who has just been persuaded to make an account
therefore lands on a world with no ships at home, no resources and a flight forty
minutes out — nothing to press, at the moment the game has the least credit with
them. The owner's words were "boş boş bekliyor".

**It is also exactly what D22/D29 refused, and that refusal was measured.** The
evidence is kept in `constants.ts` rather than deleted: a looser opening improves
raid returns and the tax on peaceful players, and does it by eroding the informed
player's edge. This override was measured too, on the same five-seed gate:

| | before | after |
|---|---|---|
| `ARR`, all five seeds | RED on 42 and 99 (0.298 / 0.299, band 0.308–0.326) | **green on all five** |
| `TAX` · `RR` · `TI` · `VFR` · `SV` | green | green |
| informed archetype tops every seed | **green, 5/5** | **RED — RAIDER tops seed 42, 4/5** |

One red assertion became one red assertion, and moved: `ARR` — red since D52a and
second on the roadmap — is now in band on every seed, and the cost is that the
design's CENTRAL claim slipped on one seed of five. Nothing was tuned to produce
either result. That trade is the owner's, and it is written here so the next
reader does not rediscover it as a mystery.

**The rehearsal runs on `START`, not on `PLANET_START`, and that is deliberate.**
A beat says out loud that the crystal is gone exactly and that this is not a
coincidence. Handing the rehearsal the cushion would make that sentence false, let
a fourth upgrade and a third Wasp become affordable inside a guided beat, and turn
a lesson in scarcity into a shopping trip. The cushion is what the commander finds
when the rehearsal becomes a season: the server creates the planet with
`PLANET_START`, the replay spends `START` of it, and precisely `OPENING_BONUS` is
left standing. Every web test passed unchanged across this change, which is the
evidence that the teaching was not touched.

**`untouched()` had to move with it.** The claim's idempotency guard recognises a
world nobody has acted on by comparing its resources to the opening grant. Left
reading `START`, it would find every fresh planet already touched, skip the replay
and answer every rehearsal decision with `ALREADY_OPENED` — an onboarding that
asks a stranger for five choices and silently discards all of them.

**The simulator opens its bots on `PLANET_START` too.** A simulator that models a
different opening from the one shipping is measuring a game that does not exist.

**Binds:** the invariant "do not enlarge the opening grant" is superseded by owner
decision; `START` keeps its arithmetic and its documentation because that is what
the opening teaches.

### D59 · Make looking worth doing — owner instruction

**A probe flies three times faster (90 → 270) and costs half the crystal (50 → 25).**
The complaint was that nobody used them: the answer arrived long after the decision
it was meant to inform, so commanders raided blind. Crystal is the binding resource
in the opening, so it is the half of the price that decides whether a probe is
affordable at the moment somebody is working out what kind of game this is.

**HOW MANY may be in the air is still the flight bay, not a probe counter.** D28
made the bay the one scarcity every craft shares and removed `PROBE.maxInFlight`;
restoring it was considered and refused by the owner. A planet starts with three
bays, so the practical answer to "at most three probes" is already yes at the level
where a player is learning to scout.

**The card that sells scouting was quoting a price the game had never charged.**
`intel.probes.cost` said "220 alloy" for two phases while `PROBE` charged 50 and 50
— tracked in CLAUDE.md as a known issue and translated faithfully into Turkish
rather than fixed. It is interpolated from the constant now, in both languages, so
it cannot drift again, and the sentence leads with speed because that is the thing
worth advertising that was not being advertised.

**Measured, and it moved nothing.** The five-seed gate reads exactly as it did
before: `ARR`, `TAX`, `RR`, `TI`, `VFR` and `SV` all in band, and the one red
assertion is still D58's — RAIDER tops seed 42.

**Binds:** nothing quotes a craft price as a literal string.

### D61 · Winning a fight has to pay — owner instruction

**"Bir filo yolluyorum, savaşı kazanıyorum ama tatmin etmiyor. Oyun PvP odaklı
olmalı."** Measured on the live shard at 34 players before changing anything:

    26 raids · mean haul 17 alloy + 5 crystal · 13 of them took NOTHING
    a Wasp cost 520; the mean raid returned 4% of one

**The cause was the vault floor, and it was a bug wearing a constant's clothes.**
`vaultBase` was derived against alloy and then charged against crystal too — "600
per resource", written in `docs/balance.md` and marked PROVISIONAL. Crystal income
is 35% of alloy income, so 600 crystal is the same thing as 1,700 alloy: at
Extractor L2 the crystal store caps at 678 and the floor covered 88% of it.
Crystal was unraidable for the entire opening.

`vaultProtects` returns a PAIR now, and that shape is the fix — the compiler found
all nine call sites, two of them inside the simulator, which had been modelling
the same mistake. A second exported function would have let the next caller make
it again.

**Four numbers moved, each with a reason:**

| | from | to | why |
|---|---|---|---|
| vault floor (alloy) | 600 | 450 | the average live planet held 615; alloy was 97% protected |
| vault floor (crystal) | 600 | `450 × 28/80` = 158 | derived from the income ratio, as `crystalCostMult` is |
| `lootDecisive` / `lootPartial` | 0.5 / 0.25 | 0.65 / 0.35 | the dial is INERT on the ladder — which is exactly what makes it safe to spend on the reward |
| every hull price | — | **halved** | uniform, so every ratio the balance rests on is untouched; only fleet size per unit of economy moves |

`START` is re-derived from the same four lines — 1,540 rather than 2,060 — so the
opening still costs exactly three upgrades and two Wasps. `DEBRIS.minimum` halved
with the hulls: it is priced in ship value, and leaving it would have doubled it
in real terms. Five debris tests said so immediately.

**Storage was asked for and deliberately NOT given.** `capHours` 12 → 14 was
tried and measured: it costs the informed archetype a seed. It is also already
answered — halving hull prices doubled the store in the only unit a player counts
it in, from 3.9 Wasps to 7.8 at Refinery L2.

**Measured, and the gate moved in both directions.** The informed archetype tops
every seed again — D58's regression is closed. In its place `ARR` reads 0.297 and
0.300 against a floor of 0.300 on two seeds, and `TI` reads −0.457 against a floor
of −0.40. Both are the bands that encode "do not make hoarding too painful", and
both are a few thousandths out. Nothing was tuned to produce either.

**Cargo is now the binding constraint on a small raid, and that is the design
working.** With 333 lootable on an average world, two Wasps still come home with
78 — they can only carry 80. The answer is a Hauler, which is why it matters that
one went from 2,300 alloy to 1,150.

**Binds:** `docs/balance.md` line 41 no longer reads "600 × 1.30^L per resource".

### D62 · A little more room for the attacker — owner instruction

`COMBAT.partialThreshold` 0.45 → 0.42. A raid that breaks 42% of the defending
fleet comes home with a partial haul and an hour of disruption instead of nothing.

**It is the only honest lever for "the attacker wins more".** The variance band is
locked at ±8% — below it randomness drowns the intel layer — and the counter cycle
is what makes composition a decision. This number is the one that DEFINES whether
an attack counted.

**0.38 was tried first and the measurement refused it.** A lower bar helps the
BLIND attacker more than the informed one, because an informed attacker already
picks fights it wins outright; at 0.38 the informed archetype lost the ladder
again — the claim the whole design rests on, and the one D61 had just won back.

**It changes almost nothing this week, and that is worth saying.** Measured on the
live shard: 30 DECISIVE against 1 REPELLED. The whole galaxy is defended by 22
Wasps and one Thorn, and two planets have any shield at all. The attacker already
wins 97% of the time; what a win actually costs them is SHIPS — 20 lost across 30
victories. This lever is for the point where people start building defence.

**The price, stated:** `ARR` now reads under its floor on four seeds instead of
two — 0.292 to 0.300 against 0.300. Successful raids empty stores, and `ARR` is
the band that says there must be something left to raid. Nothing was tuned to hide
it.

### D60 · The online count on the disc — owner instruction

`/api/season` carries `online` beside `players`, counted on the same
`SERVERS.onlineWindowMinutes` window the server list uses — two surfaces
disagreeing about how many people are in a galaxy is worse than either being
wrong. It rides the payload the galaxy screen already reads rather than a second
request, and it leaks nothing: a galaxy's population is public to somebody who has
not signed in.

The figure is optional on the client's schema so an older server still parses,
which means the contract test has to assert it is actually SENT — the same silent
failure the notification payloads had. It asserts through `requireAuth`, where
presence is stamped: a caller who has just made an authenticated request is in the
galaxy by definition, so the count can never honestly be zero there.

## Architecture

A1 · One source of truth — LOCKED
@astera/rules: pure, dependency-free, clock/I/O/randomness yok. Server sonuçları, simulator balance'ı bunun üzerinden değerlendirir; client yalnızca prediction/render yapar. Aynı dili gerektirdiği için Unity/Godot reddedildi. ESLint ve CI ile clock bağımlılığı engellenir.

A2 · React Three Fiber — LOCKED
TypeScript paylaşımı + 3D/DOM aynı tree avantajı nedeniyle seçildi. Unity WebGL payload/C# yüzünden, Godot web maturity/A1 yüzünden, Phaser 2D olduğu için, Babylon React katmanı daha zayıf olduğu için reddedildi. Capacitor/Tauri aynı build'i package eder.

A3 · Hybrid persistence — LOCKED
Continuous değerler lazy evaluation ile; kesin zamanda çalışması gerekenler scheduled events ile hesaplanır. Global tick/per-planet loop yok. 300 player production için sürekli background compute = 0.

A4 · SSE only — LOCKED MVP
Client→server REST; server→client SSE. Fleet/asteroid hareketi timestamp tabanlı client-side hesaplanır.

A5 · Derivable state only — LOCKED
Formula + clock ile türetilebilen şeyler DB'de tutulmaz: fleet positions, asteroid coordinates, resource tick rows yok. Mission departAt/arriveAt; asteroid radius/period/phase taşır.

A8 · REST + Zod — LOCKED
~14 endpoint; debugging, native shell ve rate limiting kolaylığı. Shared Zod end-to-end type sağlar.

A9 · Drizzle — LOCKED
SQL-first; FOR UPDATE/SKIP LOCKED birinci sınıftır.

A10 · Postgres LISTEN/NOTIFY + SSE — LOCKED
API ve worker ayrı process group olduğundan in-memory emitter production'da sessizce bozulabilir. publish() transaction içinde çağrılır; NOTIFY yalnızca COMMIT'te gönderilir, rollback'te yok olur.

A11 · Unlocks derived, not stored — LOCKED
Unlock'lar history'den türetilir: battle → telescope, scan → radar/veil, watch → explorer. Yalnızca players.unlocksSeen persist edilir. İlk battle kaybedilse dahi telescope unlock olabilir; oyuncu dead-end'e düşmemelidir.

A12 · probe_reports ≠ scan_events — LOCKED
Aynı olayın iki tarafıdır: biri target/content, diğeri origin'i temsil eder. Birleştirmek fog enforcement'ı tehlikeye sokar. Probe values zaten fuzzed olarak saklanır.

A13 · Exactly one clock — LOCKED invariant
DB'ye yazılan tüm timestamp'ler injected clock'tan gelmelidir; defaultNow() yasak. Önceden battle_reports.createdAt DB clock kullanıyordu ve fixed-clock testinde “while you were gone” haberleri kapanmıyordu. Bu ayrım tek clock ile çözüldü.
