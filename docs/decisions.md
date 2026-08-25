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
Bir savaşın ham değişim değeri `(looted + enemy value destroyed) − own value destroyed`; sıralamaya yazılan aktarım `round(10,000 × tanh(raw / 10,000))`. Karşı taraf bunun tam tersini alır: Dominion sıfır toplamdır, sadece combat üretir, savunmayı puanlar ve tek savaş en fazla 10.000 puan taşıyabilir. Yumuşak sınır küçük savaşları yaklaşık doğrusal bırakırken sezon sonunda tek filonun bir oyuncunun bütün birikimini silmesini engeller. Net worth modeli reddedildi; builder'lar raider'ların 2.1× net worth'una çıktı ve loot oranı değişse de raid tax 0.05 kaldı. Binds: ek anti-turtle sistemi gerekmez; Wealth gösterilir ama sıralanmaz. Canlı sezondaki eski ledger ve raporlar yeniden fiyatlanmaz; kural yalnız deploy'dan sonra çözülen savaşlara uygulanır.

D3 · Disruption — LOCKED, duration PROVISIONAL
Başarılı raid works'ü offline eder: 180 dk DECISIVE, 60 dk PARTIAL; refresh olur, stack olmaz; geçici tavan 240 dk. Çalınan alloy 1× dönerken yatırılan alloy sezon boyunca ~16× büyüdüğü için disruption raid tax'i 0.06 → 0.18 yükseltti. Binalar hasar almaz.

D4 · Two build queues replace instant construction — OWNER DECISION
Her bina, instrument, satellite ve research CONSTRUCTION; her mobile/ground hull YARD kuyruğunda zamanla tamamlanır. Kuyruklar birbirinden bağımsız, üçer sipariş derindir; maliyet siparişte bağlanır, iptal %50 iade eder, sistem arızası %100 iade eder. Süre item maliyetinin Core/Shipyard throughput'una oranıdır ve altı saatte tavandır. Önceden sıraya giren siparişler sonraki gate'lerin projected state'idir; `builtEver` yalnız tamamlanınca artar. D4'ün panic-defence gerekçesi korunur: Shipyard 0'daki bir Thorn, en dar Radar L3 uyarısından kısa sürede bitmelidir. D63 uçuşları bir oturumdan kısa hale getirip eski dönüş saatini yok ettiği için bu karar eski instant-construction kilidini supersede eder; flight bays hâlâ eşzamanlı operasyonları sınırlar.

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

D13 · Vault floor is bounded — LOCKED invariant
Koruma, koruduğu stoktan hızlı büyürse kasa er ya da geç deponun tamamını kaplar ve galakside hiçbir şey raidable kalmaz — başka hiçbir belirtisi olmadan. İlk tasarım 900 × 1.5^L ile level 3'ten itibaren elde tutulabilecek değerin 208–301%'ini kaplıyordu. Kural artık `protectedHoursPerVault / capHoursPerVault < 0.5`: hem depo hem taban aynı üretimin saati cinsinden olduğu için sınır iki sabitin oranıdır ve her seviyede geçerlidir. Eski `vaultMult < alloyMult` biçimi D101 ile bunun yerini aldı; ikisi aynı arızayı korur.

D14 · No newcomer grace — OWNER DECISION
4 saatlik immunity kaldırıldı. İlk saatlerin güvenli olması oyunun öğretmek istediği “güvenli değilsin” temasına ters. Koruma yalnızca situation-based tier band + bash limitten geliyor. Gerçek shard verisi olmadan tekrar düşünülmez.

D15 · Hardware visible, readings hidden — LOCKED
Satellites herkesçe görülür; planet size public Core tier'dan üç seviyeli siluettir. Fog state üzerindedir: fleet konumu, storage, probe sonucu vb.; construction ve level gizli. /api/galaxy yalnızca satellite TYPES yayınlar.

D16 · Manual production collection — OWNER DECISION
Works COLLECTOR.hours kadar buffer doldurur, sonra durur; tek tap storage'a aktarır ve üretim devam eder. Toplam accumulation 22 saat = 10 works + 12 storage. Uncollected ore LOOT.bufferShare ile %50 raid edilebilir; tamamen güvenli bırakılmaz.

D17 · Income is raised, prices are never cut — OWNER DECISION
Ekonomiyi hızlandırmanın güvenli yolu geliri çarpmaktır, maliyeti bölmek değil: bu dengenin dayandığı her ilişki bir ORAN'dır ve iki tabanı aynı katsayıyla ölçeklemek `payback = cost / gain`'i, kristal payını ve kasa oranını yerinde bırakıp yalnızca saati hızlandırır. Maliyeti kesmek her birini oynatırdı. D101'in ×1.20 hız katsayısı da bu kuralı izler. Sayılar D101 ile yeniden türetildi.

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

D34 · Prospector ownership cap — OWNER DECISION, COUNT SUPERSEDED BY D74
PROSPECTOR.max=2 (D74), tüm location'lar birlikte sayılır. Fiyat sınırı yerine ownership cap kullanılır; loadLocked değil totalUnitsOf row lock altında okunur. fleetAway planet API'ye taşınır; cap server-side enforcement'tır.

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

D40 · Squadron = 5 ships/model — OWNER DECISION
PER_MODEL 10→5; her model beş gemiyi, üstündeki beş pip de kesin sayıyı temsil eder. MAX_MARKERS 12 kalır; sınırı aşan gemiler sayısal overflow ile eksiksiz belirtilir. Flying asset'ler %25 küçüktür; shallow V yerine solid cone kullanılır. Radius/depth √index ile büyür; golden angle tekrar eden spoke görüntüsünü engeller.

D41 · Aegis = panelled shell — OWNER DECISION
Hexagonal fragment-shader grid; level ile cold-blue whitening. half GLSL reserved word; shader comments içinde backtick template literal'ı bozabilir; fwidth offset değil edge softening için kullanılmalıdır. Grid dome'un tamamında görünmeli, cell interiors fill olmamalıdır.

D42 · First orders removed — OWNER DECISION
İlk sipariş sistemi kaldırıldı; onboarding yeniden ele alınacak.

D43 · Prospector speed corrected — OWNER INSTRUCTION, SPEED SUPERSEDED BY D74
3,483 launch ölçümünde asteroid intercept'i 1.10 revolution ahead, median 686 unit sapıyordu. D43 hızı 660 yaptı; D74 bunu 330'a indirdi ve generated-field erişilebilirliğini yeniden ölçtü. Mining yield değişmiyor; yalnızca race sonucu değişiyor.

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

Her UI element kendi key alanına sahiptir; farklı yüzeylerdeki aynı İngilizce ifade bile ayrı key olabilir. Türkçe dictionary translation değil, yeniden yazımdır: tam cümleler, verb-based phrasing, dash yerine semicolon/full stop, dictionary equivalent yerine doğal ifade. Tab'ler Türkçe'de noun formatında: Üretim · Bilgi · Savunma · Filo.

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
account, takes the seat and replays those intents through `upgradeBuilding` and `buildUnits` with
the ordinary locks and the ordinary refusals. Principle 1 is intact: the client rendered and sent
intent, and the fact that it could also predict the outcome is what let the screen keep up with a
finger.

**D4 changes the rehearsal from an outcome preview to a commitment preview.** The three building
presses and the two-Wasp purchase are staged as the same two queue lanes the real planet uses;
durable levels and fleet never rise locally. Claim starts those four ordinary orders. The former
target/launch beat is gone: the real Wasps do not exist until the server-authored Yard completion
instant, and manufacturing an in-flight fleet before then would require a fake client outcome or
an onboarding-only instant-build rule. The ordinary post-claim surface wakes at completion and
leads into the first real launch with no tutorial state machine to persist.

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

**The wall is at the end, at the moment of commitment** — a world with a name and four paid orders
ready to become real. Two steps inside ONE `<form>`: a password manager only offers to
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
pressing its control opens a surface: the Wasp row opens a build sheet with a count picker.
Gating only the first control
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
rehearsal spends it to the last crystal: three mandatory upgrades and two Wasps.
A commander who has just been persuaded to make an account therefore lands with
all of the arithmetic grant committed — now visibly in the two build queues — and
otherwise has nothing to press at the moment the game has the least credit with
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

### D63 · The fifteen-minute galaxy — owner instruction

**Hull speeds ×9.46, derived from the slowest warship.** The Bulwark crosses the
widest leg on the disc in fifteen minutes; every other hull keeps its ratio and is
quicker. The probe scaled with them, or it would have been slower than a Wasp and
lost the one thing it is (`PROBE.speed` 270 → 2554). Mining did NOT: its speed is
a separate constant tied to rock speeds, and moving it would break the intercept.

**ASTERA IS NO LONGER AN ASYNC GAME, and that is the owner's answer rather than a
side effect.** Nothing takes hours any more — a raid is twelve minutes round trip,
mining ten, construction was already instant — so the hook Design Law #6 was built
on has no mechanism left. The owner's words: *"anlık real-time bir oyun"*. The
locked constraint is retired here rather than quietly contradicted by the code.

**Everything measured in time changed meaning, so eight constants moved with it.**
Each was re-derived against what it is a ratio OF, never picked:

| | from | to | the ratio it restores |
|---|---|---|---|
| `TRAVEL.baseMinutes` | 3 | 1 | overhead 50% → 25% of a mean leg |
| `SHIELD.regenPerHour` | 0.05 | 0.40 | 100 → 19 raids per full regen |
| `DISRUPTION` decisive/partial/cap | 180/60/240 | 40/15/60 | punishment 15× → 5× the raid's effort |
| `DEBRIS.decayMinutes` | 180 | 20 | a field lives 30 legs → 5; the race is back |
| `telescopeCooldownHours` | 24…6 | 4…1 | re-aim 30 → 8 round trips |
| `PROSPECTOR.launchMinutes` | 0.4 | 0.13 | holds the "far below a warship's" invariant |

**Two real bugs surfaced, both invisible until the tempo moved.**

`BEARING_MINUTES` is an absolute duration and a mean leg became exactly it, so a
contact's published window covered the whole remaining flight and its end point
WAS the destination — a route, which is the one thing the fog rule forbids. It is
capped at a SHARE of what is left to fly now, so it stays a heading at any speed.

`LEAD_TOLERANCE` was half a minute, to absorb the gap between an event's scheduled
instant and a worker claiming it — thirty times the poll interval even before this.
Afterwards Radar L3 buys 0.65 minutes of warning, so the tolerance was 77% of the
whole lead and every rung fired at a wider circle than it sold. Three seconds now,
which is three polls. Both have tests written against ratios, not minutes.

**The radar keeps its ladder and loses its promise.** It sold time to react and
there is none: L5 gives 3.4 minutes on a mean leg. Widening the ranges cannot fix
it — notice is a fraction of the flight. What these speeds DO open is the opposite
reading: construction is instant and a Kirpi is 800 alloy at Shipyard 0, so three
minutes is not enough to evacuate and is exactly enough to put a gun down. The
copy says that now, in both languages. The mechanic is unchanged.

**Nine tests were re-derived, none bent.** Every one encoded the old tempo as a
count of minutes — `advance(10)` into a flight that was twenty-seven, a sweep in
tenths of a minute that was tens of units and became tens of units times nine.
They assert shares and ratios now, so the next speed change cannot walk past them.
Two new tests were added for the two bugs above, and one for the radar ladder.

**The gate, honestly.** `ARR` came back into band on all five seeds — the retune
fixed what D61 and D62 could not. Two remain red: `TI` at −0.465 against a floor
of −0.40, and the informed archetype, which drops a seed. A hypothesis that the
simulator's own async cadence explained them was TESTED and refuted: scaling
`loginsPerDay` ×4 made the gate worse, not better. Re-deriving the simulator for
real-time pacing is real work and is not guessed at here.

**Binds:** the locked constraint list loses "async persistent world"; Design Law #6
needs re-deriving for a game whose flights are shorter than a session.

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

### D64 · A reason to press something after onboarding — owner instruction

**Report.** *"Onboardingden sonra user'a yapıcak bişey kalmıyor."* D58 answered the
same complaint with `OPENING_BONUS` — one more decision's worth of resources. That
bought a first purchase and nothing after it.

**What was built.** Eleven reward chains, in `packages/rules/src/rewards.ts`. Each
is a goal that keeps going — probe once, then twice more, then twice more again —
and every tier it passes is claimable independently and never expires.

**It pays for ACTS, never for attendance, and that is the whole design.**
`game-design.md` bans streaks, login bonuses and "we miss you" by name, because
each of them pays for being present at the right hour. Nothing here can be earned
by waiting: a player who leaves the tab open for a week completes none of it. Two
of the eleven chains pay for probing and raiding specifically, and they carry the
largest purses — the recorded risk against this game is *"nobody scouts, and it
degrades into a worse OGame"*.

**The grant is resources, and that is not laziness.** A permanent upgrade, a
cosmetic or a discount would all be UN-LOSABLE, which the invariant table refuses
by name. Alloy and crystal land in storage, above the vault floor, where a raider
can come and take them. A reward that can be stolen stays inside the game.

**PROGRESS IS COUNTED, NEVER ACCUMULATED.** There is no achievement table, no
counter incremented from six services and no listener on the event queue. Ten of
the eleven chains are read off rows the game keeps anyway — missions by kind,
mining runs that arrived, levels standing right now. It costs three queries and
buys four things: a chain added later is retroactive for everyone with no
backfill; a counter cannot drift from the world it counts, because it *is* the
world; nothing needs to be made idempotent, because nothing is written on the path
that produces progress; and a raid resolving while the panel is open needs to tell
the panel nothing.

**The one exception is `planets.builtEver`.** A ship does not survive the thing it
describes — it dies, and its `units` row goes down with it — so "how many have you
ever built" is unrecoverable. One jsonb column, written inside the lock
`buildUnits` already holds. The migration backfills it from what each planet is
holding now, which under-counts a veteran and never over-counts one.

**The amounts.** The brief was *"orta iyi arası"*. 13,600 alloy and 4,740 crystal
if every tier is taken, against a fourteen-day season that produces well over
100,000 — roughly a tenth, front-loaded. Crystal is held at ~35% of alloy, which
is the income share and not a taste: paying crystal faster than it is earned would
silently undo the scarcity `ECON.crystalCostBase` took a whole pass to derive.

**The simulator does not model any of it**, so the season gate is unmoved: `TI` is
still −0.4652 and the informed archetype still drops one seed, exactly as before.
That is a known gap and not a result.

**Two bugs the tests found in this work, both about paying twice.**
`findRewardTier` used to accept `PROBE:1e0` and `PROBE:1:1` as aliases for
`PROBE:1` — and the claim's idempotency is a primary key on the id, which cannot
tell three spellings apart. The parse is strict now and the service keys off the
canonical form rather than the caller's string. Separately, a mission `abandon()`
had cancelled was still counted as a raid flown, so a failing event queue paid out
alloy.

### D64a · The Twitter bonus is a human reading a message — owner instruction

Follow `@JoinAstera`, send the commander name by direct message, claim the bonus
from the panel — once per commander. **D104 made "once" mean once per ACCOUNT,
for ever**: keyed on the season's player row, as it was written here, the grant
died with every wipe and every idle-seat reclaim and the same follower could be
paid again in the next galaxy.

There is no Twitter API in this project and there is not going to be one: a
marketing integration is not a game system, and the honest implementation of "a
human checked" is a human checking. `season reward <commander>` writes the grant
row; the PLAYER still claims it from the panel, so the resources arrive while they
are looking at them and the ordinary claim path does the locking, the once-only
key and the toast.

**No HTTP surface for it, deliberately.** An admin endpoint would put an admin
credential in the environment of a public API for the sake of a few dozen manual
grants a season.

**The lookup does not case-fold.** `'İ'.toLowerCase()` is `i` plus a combining
dot, in JavaScript and in Postgres alike, so `lower(name) = lower($1)` never
matches a commander called `İhsan` — and roughly half this game's players are
Turkish. The display name is compared as written; the username is compared after
`normaliseUsername`, the same function that folded it on the way in. Comparing a
value against itself through its own normaliser is the only case-insensitivity
that is safe in any alphabet.

### D65 · One way in, instead of four — owner instruction

The header's right-hand end had grown a commander control, an intel control and
the signals beacon, and the rewards panel would have been a fourth — on a phone,
beside two stock columns the `Stock` docblock already records as starved for width
at five digits. Everything that is not NEWS went behind one menu control.

**D54 is not being undone, and it would be easy to think it is.** That finding was
not "the commander control must be on the header" — it was *"a control that says
SEASON and draws a clock is not a way out, because nobody presses a readout"*. The
bug was the LABEL. This control's accessible name still carries the commander and
still names what is behind it; the sheet it opens is still titled with the
player's own name; sign-out is still exactly two taps from the galaxy. What is
given up is the name being legible without opening anything, against a hamburger —
the one glyph on a phone that needs no label to read as "everything else is here".

`onboarding.test.tsx` records the relaxation rather than dropping the test.

### D65a · An eye, exactly where the icon set says not to use one

`icons/index.tsx` states that `intel` is an aperture and **not** an eye, because an
eye reads as surveillance OF you and the Intel centre is your own instrument. The
probe control now wears an eye, which is the opposite act and the opposite icon: a
probe looks at somebody else's world, and that world is TOLD. The two glyphs
disagreeing is the silent half of the fog disagreeing with the loud half.

### D66 · The score, and the four ways background audio breaks — owner instruction

One track, looped, defaulting to 0.35, paused whenever the page is not being looked
at and resumed from the same instant. The level is adjustable and remembered on
the device; changing it updates the live element without restarting the track.
What the implementation is actually about is
lifecycle:

· **Autoplay is blocked, and that is not an error.** Every current browser refuses
  `play()` until the page has been interacted with. The first attempt is expected
  to fail; the rejection arms a one-shot listener on the next real gesture.
· **`pause()` preserves `currentTime`**, so "resume where it left off" needs no
  bookkeeping — and deliberately none, because a stored position and the element's
  own position are two sources of truth for one fact.
· **Pausing a pending `play()` rejects it** with `AbortError`, every time a tab is
  backgrounded during the load window. An unhandled rejection in the console of a
  live game is indistinguishable from a real fault.
· **It must leave nothing behind.** What leaks is not a DOM node — the element is
  never in the document — it is an in-flight media fetch and a decoder, and both
  survive a `pause()`. Clearing `src` and calling `load()` is what frees them, and
  StrictMode's double mount is exactly the case that turns a missed teardown into
  two tracks playing over each other.

`visibilitychange` is the whole of the pause rule and `blur` is deliberately not
part of it: `blur` also fires for devtools and the address bar, neither of which
means the player stopped watching.

The menu carries both an immediate mute/resume control and a 0–100 level slider.
They are separate preferences: moving the level does not silently undo a mute,
and neither operation rebuilds or seeks the audio element.

### D67 · Google Analytics, loaded the way Next.js would load it — owner instruction

The brief asked for Next's best practice and this is not a Next app, so
`@next/third-parties`' `<GoogleAnalytics>` was translated rather than the pasted
snippet copied. Four things that component does, all of which matter more here:

1. **It never blocks the page** — `afterInteractive`, never in `<head>`. Here it
   waits for idle as well: the pasted snippet would sit in front of a 1.8 MB
   three.js bundle on a phone, which is the one thing `LoadingScreen` exists to
   keep honest.
2. **`dataLayer` and `gtag` exist before the script does**, so a call made during
   the load window queues instead of being dropped.
3. **The id is configuration.** `VITE_GA_ID`, inlined at build time. Unset — every
   dev server, every test, every local build — nothing is fetched and nothing is
   defined. That is the whole opt-out.
4. **It is idempotent.** StrictMode mounts twice and two tags double every figure.

No consent banner, because nothing here reads or writes anything the player gave
us: no ad module, no user id, no custom dimension carrying a commander name. No
route tracking, because there is no router. Two events, both GA4's own names:
`sign_up` and `login`, with `method` separating the front-door registration from
the rehearsal claim — which is the single number this project most needs to read.

### D68 · Signing out stopped handing out a second planet — owner-reported bug

*"Onboarding bitirdim ve logout oldum → tekrar preview sayfasına yönlendirildim →
CLAIM YOUR PLANET → başka bir serverda yeniden gezegen veriyor."*

**Reproduced against the real API before anything was changed, and the server was
not at fault.** The same credentials come back to the same account and the same
planet with nothing replayed; `joinSeason` returns the existing placement and
`settle()` still throws `ALREADY_PLACED` for a second galaxy. Every rule held.

What produced the second world was the DOOR. D56 made the loud control on the
landing page "play ninety seconds of the real galaxy", on the correct argument
that a stranger should not be asked for a password before they have a reason.
A player who has just signed out is not a stranger — and the dialog at the end of
a rehearsal asks you to CREATE a commander, so the obedient thing to type is a new
name. A new name is a new account, and a new account is legitimately entitled to a
seat in the frontier galaxy. Nothing refused, because nothing was broken.

**Two changes, both on the client.** Signing out lands on the front door with the
sign-in form already open. And the device remembers that a commander has existed
here (`lib/returning.ts`), which inverts the weights on a cold start days later:
signing in becomes the loud control and the rehearsal becomes the quiet line.

**It is a hint and never a gate.** Both doors stay reachable from either state — a
shared phone, or somebody deliberately making a second commander, must still get
through — and a device with storage disabled gets the first-time door, which is
the correct default rather than a degraded one. Nothing here is trusted by the
server.

### D69 · The camera stopped moving on its own — owner-reported bug

Two reports, one cause each, both about the rig acting without being asked.

**It re-framed itself while the player sat still.** The "ease onto a new subject"
effect was keyed on a MEMOISED GETTER whose dependencies were the six query
results behind it — `nodes`, `asteroids`, `pending`, `runs`, `contacts`, `wrecks`.
Every one is a fresh array on every refetch, and in a live galaxy those refetch on
each shard broadcast as well as on the sixty-second net. So the effect fired
several times a minute with nobody touching anything: the pivot re-eased and
`pullTo` dollied the camera back in, wiping out the player's framing. The
docblock claimed it "fires on a change of subject and not on every render", which
was the intention and was never true. It is keyed on `focusIdentity()` now — a
stable string that moves when somebody selects something else and at no other
time.

**It jumped when a followed craft ended.** A fleet, probe or drill stops existing
the moment it lands or gets home, and the rig read the missing position as
"nothing is focused" — which handed the frame to the LEASH and dragged a camera
that had followed a squadron out to the rim back toward the middle of the disc at
a new angle. Losing a subject now RELEASES the rig: no ease, no leash, no
re-frame, free-look exactly where it was left. The release is cleared by the
player — touching the controls, picking something new, pressing home — never by
the world. **The camera may be moved by an instruction and never by the absence of
one.**

Both rules moved out of the `useFrame` callback into `galaxy/follow.ts` as pure
functions, because a rule inside a frame loop wrapped in a WebGL canvas is a rule
no test can reach.

### D70 · Three days away and the seat goes back — owner instruction

*"Bir oyuncu 3 gün boyunca oyuna girmezse gezegeni silinsin ve böylece serverlarda
yer açılır. Pasif hesaplar birikmez."*

**The seat is the scarce thing and this is what keeps it moving.** A galaxy holds
fifty worlds and galaxies fill strictly in order — the only mitigation the
empty-shard risk has — and that inverts completely once seats are held by people
who signed up and never came back. The live shard already looked like this: a
hundred accounts in two days, and worlds the owner read as bots because nothing
had happened on them since.

**The account survives** — owner decision. Only the season presence is reclaimed;
the record folds into `accounts.lifetime` exactly as a wipe folds it, and the
commander signs back in, finds no planet, and is taken to the server list. That
path is why D68 had to land first: without it, a reclaimed commander would have
been offered onboarding.

**Three safety properties, and they are the whole design.** It never touches a
world with anything in the air that names it — including a raid an active player
launched at it thirty seconds ago — and defers to a later sweep instead; deleting
a mission out from under a live fleet is not theoretical, it happened on this
project's production database once and stranded a real player's Wasps. It
re-reads `lastActiveAt` under a row lock, so a commander who opens the game
between the candidate read and the delete keeps their world. And it runs one
transaction per planet, so a world that cannot be taken apart leaves every other
one alone.

**It takes other people's history with it**, and that is stated rather than
hidden: `battle_reports` carries foreign keys to both players and to the mission,
so a raid an active commander flew against a reclaimed world cannot be kept. It is
the same trade a wipe makes, it is the only one the schema allows, and it is worth
less than the seat.

Runs in the worker on a ten-minute clock with its own catch — *housekeeping may
never stop the event queue* — and `/health` reports how many seats are eligible so
a sweep that has stopped running is visible.

### D71 · The community bonus goes first, and the store cannot swallow a reward

Owner instruction, three parts.

**Pinned above everything, claimable goals included.** It is the only reward that
asks the player to do something OUTSIDE the game, so it is the only one that
cannot be discovered by playing — every other chain is met by pressing the thing
it pays for. A card nobody scrolls to is a card nobody follows. Raised to 1,000
alloy and 500 crystal, the same size as `OPENING_BONUS`, and still excluded from
`rewardPurse()` so it cannot drag the economy's ratios around from outside.

**"Depo doluysa ödül boşa mı gidiyor?" — no, and the panel now says so.** A grant
is written straight to storage with no clamp, exactly as `OPENING_BONUS` is, so
the whole amount lands and the store is allowed to sit above its ceiling. What it
costs is the WORKS, which cannot be emptied into an over-full store — the pressure
is to spend rather than to hoard. The note appears only when a claimable tier
would actually overflow, and it is measured against the largest SINGLE tier rather
than their sum, because they are claimed one at a time.

**A sound switch in the menu**, beside the language because both are preferences
about the device rather than about the commander. It is a pause and a resume on
the element that is already there, never a rebuild — so the track carries on from
where it was silenced rather than restarting. D107 extends the same control with a
persisted level without changing that lifecycle.

### D72 · One craft, one marker — the real-time movement pass

Owner report: craft stuttering, freezing, arriving at the wrong time, appearing
twice, and two clients disagreeing about the same squadron. Six causes, none of
them in the interpolation itself, which was correct throughout.

**The duplicate was a fog leak wearing a rendering costume.** `pendingThreads`
selects every mission with this planet at EITHER end — it has to, because an
inbound raid is how the radar warning reaches you — and then special-cased exactly
one foreign leg: an attack aimed at you. Four legs match that query without being
yours, and the other three fell through to the branch that describes your own
craft. So a probe flying at you, a probe flying home from you, and a raider's
survivors leaving your orbit were all handed to you with a full `path` (both
endpoints, so the disc drew the route), the hulls inside them, and `targetName` set
to the OTHER WORLD'S NAME.

The consequences were exact and had all been reported as separate bugs. A player
who had just been probed could read who probed them off their own pending strip,
which is the whole of D9 given away. A player who had just been raided watched
twenty of the attacker's Wasps leave their orbit labelled as their own outbound
squadron — and, because an outbound fleet bombards when it arrives, watched a
phantom bombardment of the raider's homeworld. And every one of those legs is
ALSO published to that same caller by `/api/galaxy/traffic`, which excludes only
what the caller genuinely owns: one mission, two payloads, two craft on one disc,
disagreeing about what they were.

The rule was already written down twice — `flight.ts` counts bays with it,
`traffic.ts` decides what to publish with it — and both were right. It is now
stated once, as `legBelongsTo`, and all three surfaces read it.

**Structural sharing was off, everywhere, and had been since the first schema.**
React Query preserves identity across a refetch by walking the old value against
the new one; its walker recurses through plain arrays and plain objects and treats
everything else as a leaf compared by reference. A `Date` is neither — and every
payload the disc draws from parses its instants with `z.coerce.date()`, which mints
fresh ones every time. So `traffic`, `pending` and `mining` came back as brand new
arrays of brand new objects on every read, several times a minute, whether or not
anything had changed.

That is the root of a whole class of symptoms that had each been patched locally:
every `useMemo` below those lists re-ran, every `BufferGeometry` built from one was
rebuilt, and the camera re-framed itself on data that had not moved — which is D69,
and why `focusIdentity` exists. One clause added to the walker fixes it for the
whole client: a Date compared to a Date is equal when it names the same instant.
`api/structural.ts`.

**And it is one clause, held to that by a test against the library's own function.**
This replaces the walker for EVERY query in the app, so the claim that bounds the
risk is not "it handles Dates" — it is "it is otherwise exactly what the library
would have done". The first version reached for `Object.is` at the leaf because it
reads better than `===`, and that silently changed the answer for `NaN` (which
would have stopped churning) and for `-0` (which would have replaced `+0`). Neither
is reachable through a Zod-parsed JSON payload, which is exactly why nothing would
ever have caught it; the conformance cases in `structural.test.ts` did, on the pass
that wrote them.

**And the geometry it rebuilt was never freed.** Replacing the `geometry` prop of a
mounted object hands three.js a new buffer and drops the old one on the floor;
nothing unmounted, so nothing disposed it. That is a GPU allocation per craft per
refetch for as long as the tab is open — invisible until the scene starts to
stutter an hour into a session, which is the hardest kind of bug to connect to its
cause. Both ends of every route are written each frame anyway, so the buffer never
needed rebuilding: one per craft, mutated in place, disposed when the craft leaves.

**A reconnection is a resync, and nothing was doing one.** The stream carries no
cursor and no backlog, so everything that happened while the socket was down was
simply never delivered. The only thing closing that gap was the sixty-second net,
so a dropped socket, a deploy or a phone waking from sleep left the disc up to a
minute stale with craft parked on their destinations and nothing on screen saying
so. `api.stream` reports when the socket is actually up; every open after the first
re-reads the live set. The first is deliberately exempt — the queries have only just
fetched, and doubling a cold start buys nothing.

**A mutation's answer could be overwritten by a read issued before the tap.**
`useOptimisticPlanet` cancels in-flight reads on the way IN and said why; the way
OUT did not. `useArrivals` invalidates `planet` and `pending` on every due arrival,
so a launch pressed in that same second had its brand new fleet overwritten by a
list that predates it — the squadron appeared on the disc and blinked out for up to
a minute. It needs no network trouble at all to reproduce, and there is a test that
fails without the cancel.

**A contact could coast through the world it was landing on.** The client
extrapolates half a window past the published one, because a craft that stops dead
in open space reads as a broken game. That is right for a heading and wrong for an
arrival, and four coordinates and two instants cannot tell the two apart. The
payload says: `landing` is set only when the window is clamped to the arrival, which
only happens inside the last `MIN_COAST_MS` — and in that minute the window's end
point already IS the destination, published in full. It names a property of a
payload the caller is already holding.

**And a stranger's bearing window expiring is not an arrival.** That wake sat in
the same list as real arrivals, which refetch nine payloads including the most
expensive read in the game — so `/api/galaxy` was being pulled on a schedule set
entirely by other people's traffic. One key now, and the same timer.

**What was NOT changed, having been checked.** The event system needs no sequence
numbers, no versions and no de-duplication: a shard event carries a kind and
nothing else and can only ever say "go and read what you were already entitled
to", which is idempotent and order-independent by construction, and every server
handler is already claim-once. Adding a version to a payload that carries no state
would be inventing a problem. `travelMinutes` still rounds arrivals UP to whole
minutes and is still wrong at D63's speeds — it is consistent between server and
every client, so it is a tempo bug rather than a synchronisation one, and it stays
on the known-issues list with its own pass.

**Verified live, not only in the suite.** `tools/movement.mjs` signs two commanders
in against a real server, puts a raid and a probe in the air, and measures both
screens through the dev bridge: every craft advances between two samples, no two
markers occupy the same point, the same craft is in the same place on both screens,
and nothing is drawn at the origin or inside a world. `tools/loop-check.mjs` gained
the same question asked from the far end of a raid.

### D73 · Raids interrupt the live loop, not the session — owner instruction

Works disruption is 15 minutes for DECISIVE, 5 for PARTIAL and zero for REPELLED,
with a hard ceiling of 15 minutes from the current instant. Repeated raids refresh
the applicable window but never stack it. Production resumes on the exact ending
minute already carried by `disruptedUntil`; notifications state the duration written
by settlement and the live planet view owns the countdown.

### D74 · Two slower Prospectors — owner instruction, measured

`PROSPECTOR.max` is 2 across every unit location. Base speed is 330; Derrick keeps
1.5× and therefore gives 495. `HULLS.PROSPECTOR.speed` is the ship-card duplicate
and is locked equal to the authoritative constant. The slower base drops below the
old unique-root proof threshold (360), but not below the solver's capability: a
five-seed sweep over 50 spawn slots × 200 rocks found 100% reachable at spawn and
at 25/50/75/90% of lifetime for both speeds. Maximum base flight was 7.22 minutes,
round trip 14.44 and lead 1.006 revolutions; boosted was 4.84/9.68 and 0.666
revolutions. No asteroid generation change was needed.

### D75 · The account display name is the visible commander identity — owner instruction

`accounts.displayName` is the canonical name of a person. `players.name` remains
season state but is never a public identity source. Galaxy labels, focus surfaces,
intel and battle reports lead with the commander; `planets.name` is retained only
as secondary location context. Notifications use explicit `targetUsername`,
`originUsername` and `fromUsername` fields and keep parser fallbacks for historical
payloads. A username is joined only inside projections whose existing fog rule has
already revealed that person; identity is not a new intel tier.

### D76 · The Dominion ladder is the whole local galaxy — owner instruction

The leaderboard returns every commander in the caller's galaxy, bounded by that
galaxy's configured capacity. A row is rank, player/account identity, planet,
public Core tier and `round(dominionTaken - dominionLost)`. Ordering is score
descending, then `joinedAt` ascending, then player id ascending. Combat publishes
`shard:score` only when a rounded score changes; `shard:world` also refreshes the
open ladder because a public tier changed.

### D77 · Galaxy chat is seasonal, live and server-authored — owner instruction

Chat belongs to one season and is wiped with that world. A message stores only its
season, author player, trimmed 1–280 character content and the authoritative server
instant. The authenticated player is always the author; clients cannot submit an
author or username. Reads are cursor-paginated to at most fifty rows and never cross
the caller's season. One player may commit at most five messages in any rolling ten
seconds, enforced transactionally. Message instants are strictly monotonic inside
a season under the same transaction lock; the timestamp read marker can therefore
never collapse two concurrent authors.

Unread state is durable on the player row and counts only messages from other
commanders after the latest visible message the player marked read. Posting one's
own message never creates unread state. `shard:chat` announces only that the scoped
chat projection changed; an open panel refreshes immediately and a closed panel
refreshes the unread dot on the permanent lower-right Galaxy control. Chat has no
commander-menu row and does not mark the account-menu control. Message time copy uses Moment durations at the locked
minute, hour and day boundaries.

### D78 · Hull crystal redistribution has no selectable candidate — measured blocker

The simulator now reports crystal-cap player-hours, final median unused crystal and
crystal spending by category. LANCE, BULWARK and HAULER were exercised at 25%, 30%
and 35% crystal shares without changing total prices; Wasp and opening arithmetic
stayed fixed. Across seeds 42, 7, 99, 4242 and 1337, baseline cap time was 8,888
player-hours. The partial candidates produced 6,962 (−21.7%), 5,863 (−34.0%) and
4,656 (−47.6%) respectively.

No candidate can be selected. At 30% and 35%, existing season gates regress. The
25% result misses the cap-time target and also regresses gates. This original reading
did not include mining or Prospector procurement; D84 adds that model, re-runs all
four cases and reaches the same blocked conclusion with complete Prospector spend.
No fuel, permanent upgrade or other un-losable sink is introduced as a substitute.

### D79 · Revealed commander identity is a route back to the world — owner instruction

An identity already revealed in Signals is bold and directly focusable when its
notification payload names the corresponding planet id. Activating it closes the
notification sheet, selects that world and moves the existing Galaxy camera focus
to it; the dossier starts collapsed. Chat exposes the same route on other
commanders' usernames using the planet id already public inside the caller's own
galaxy; Leaderboard usernames use their row's already-public planet id as the same
route. IDs are attached only beside identities the existing projection already
reveals, so this adds navigation and no new fog tier.

### D80 · Three-times combat cargo is blocked — measured

Wasp, Lance, Bulwark and Hauler cargo were raised exactly 3× while Prospector
capacity stayed unchanged, then run through the five-seed season gate. The prior
green baseline gained two new failures: seed 99 ARR fell to 0.290 and pooled TI to
−0.4305. The gate bands were not widened. The experiment is therefore not
authoritative and the live cargo figures remain unchanged. Survivor cargo bounds
and Hauler escort targeting gained direct regression coverage independently.

### D81 · A denser sky — owner instruction

`asteroidSpawnPerHour` 2.7 → 3.375. More of the disc is worth looking at, and the
race for a rock happens oftener. About fifteen rocks in the sky at any moment
against twelve, which is the rate times the mean life and is what a player
actually experiences — the rate itself is invisible.

**It re-rolls nobody.** The season's whole schedule is one deterministic pass over
the seed and a rock's index is its position in that pass, so index `i` keeps the
same radius, speed, level, ore, phase and height: the eight draws per rock are
consumed in the same order whatever `count` is. What moves is the SPACING —
`interval = span / count` — so every `appearsAt` slides 20% earlier and the set of
rocks visible at a given instant is a different set. On a season already running,
the field turns over once, on the next read, for everybody at once.

**Safe for a run already in the air.** `resolveMiningArrival` finds its rock by
index and does not re-check `asteroidActive`, and the count only ever grew — so the
index still exists and still names the same orbit. The claim rows keyed by index
stay coherent for the same reason. A player mid-decision may find a rock gone when
they launch, which is an ordinary `ASTEROID_GONE` refusal.

**The season gate held.** More rocks is more mining income, which is exactly what
the gate measures, and all five seeds stayed in band.

**And it re-locked a measured ceiling, which is the part worth remembering.** The
reachability sweep asserts a worst-case flight in revolutions of the rock's orbit,
and those ceilings are MEASURED maxima rather than design limits. The sweep starts
each intercept at `appearsAt + ...`, so a change to the spacing samples the same
orbits at different angles — the Derrick case moved from 0.67 to 0.6742 and failed
a bound that had been locked to the previous sample. Nothing about reachability got
worse: across 500,000 intercepts there are zero unreachable rocks and the worst
case is still inside one revolution (0.9895 plain, 0.6742 Derrick). The bound moved
to 0.68 and both measured maxima are now written at the site, so the next reader can
tell a re-lock from a regression.

Also new: the field had no test of its POPULATION at all — every other asteroid
test is a property of one rock. `invariants.test.ts` now pins rate x mean life
across five seeds and most of a season, and asserts the disc never empties, which
is the failure a mean alone cannot show.

### D82 · Hull crystal costs rise by one quarter — owner instruction

Every vehicle and ground-defence hull now costs 1.25× its D78 crystal amount,
rounded to the nearest whole resource: Wasp 0, Lance 238, Bulwark 775, Hauler 163,
Bastion 475, Thorn 150 and Prospector 150. Alloy prices, attack, hit points, speed,
cargo, class, unlock level and ground/mobile identity do not move. Because zero
remains zero, the two opening Wasps and `START` arithmetic are unchanged.

This supersedes D78's conclusion that live hull prices remain unchanged, but it
does not select any of D78's rejected candidates. D78 redistributed an unchanged
total between alloy and crystal; D82 leaves alloy fixed and raises the total price.
The planned research system remains a future crystal sink rather than being folded
into this change.

**Original measured exception, explicitly accepted by the owner on 2026-08-22.** Across the
five fixed 50-player seeds, crystal-cap time falls from D78's 8,888 player-hours to
7,704 (−13.3%), and the median of final unused crystal falls from about 9,473 to
9,057. All pooled gates and every other per-seed gate remain green. Seed 7 alone
lands at ARR 0.2962205608319292, 0.0038 below the standard 0.300 floor. The global
band was not widened. D84's mining-complete model returns seed 7 to ARR
0.3056324045916809, inside the normal band, so the temporary exact-value pin is now
deleted as this paragraph originally required.

### D83 · Fixed-destination flights land at the continuous instant — prerequisite fix

Raids, probes, their return legs and salvage flights now schedule `arriveAt` from
`travelExact` (or the Prospector's corresponding exact rule). `travelMinutes`
remains the rounded-up human-facing estimate only. At D63's short tempo a whole
minute was 8–50% of a leg: two different hull speeds frequently produced the same
stored arrival, so composition stopped being a time decision on short routes and a
future fast cargo hull could not have delivered the capability it sold.

This changes no speed, distance factor, launch overhead, radar radius or combat
window. The radar derives its lead from the stored exact leg, the client animates
against the same timestamps, and the ten-second engagement still begins at
`arriveAt`. Asteroid interception was already continuous. The minute-stepped
season simulator still observes the same effective tick (`ceil(exact)`); its wider
real-time cadence gap remains separate work rather than being hidden inside this
timing correction.

### D84 · The season simulator now contains the existing asteroid economy

The simulator now buys Prospectors, preserves `PROSPECTOR.max` across home and
in-flight craft, reconstructs the seeded asteroid schedule, solves interception with
the shared exact rule, settles first arrival first against one cumulative claim per
rock, and returns ore into the independent alloy/crystal Works ceilings. Overflow is
lost exactly as on the server. Prospectors at home remain losable defenders and craft
in flight are absent from the planet. Mining has its own seed-derived RNG stream so
adding an adoption decision does not silently rewrite attack, composition and login
randomness in the baseline being compared.

Archetypes deliberately model adoption rather than perfect play: TURTLE, RAIDER and
CASUAL target one craft with 20%, 25% and 35% launch chances per login; FARMER and
GRINDER target two with 70% and 85%. A commander compares the four nearest active,
non-empty rocks and chooses the best available ore per round-trip minute. These are
calibration assumptions, not new live-game rules. Flight-bay contention, debris
salvage and continuous real-time player decisions remain outside the model and may
not be priced from this reading.

Across seeds 42, 7, 99, 4242 and 1337, baseline crystal-cap time is 7,660.5
player-hours, final median unused crystal is 9,232.6, Prospector crystal spend is
213,600 and 3,389,700 ore is claimed. All normal pooled and per-seed gates hold and
the informed archetype tops every seed. Seed 7 ARR rises from D82's accepted
0.2962205608319292 to 0.3056324045916809, so its special test is removed.

D78 is now complete rather than blocked on missing coverage. Same-total 25%, 30%
and 35% crystal redistribution gives 6,821.8, 5,620.2 and 4,479.9 cap player-hours.
The 25% candidate still misses its purpose and breaks TI plus informed-player
dominance on seed 7; 30% additionally breaks seed 42 ARR and informed dominance on
two seeds; 35% breaks TI and seed 99 ARR. No candidate is selectable, so D82's live
price table remains authoritative and Frontier research gets no pre-emptive economy
change from this experiment.

### D85 · Season freeze is an atomic, permanent record — Frontier prerequisite

Every season schedules exactly one `season_end` event in the same transaction that
creates it. When that event resolves, the season row is the serialization point:
ordinary world mutations hold a shared season lock before any planet lock, while
the freeze holds the season row for update. The lock order is therefore always
season → planet. A snapshot cannot finish while a mutation that began in the live
season is still able to commit behind it.

Freeze refuses to run while a mission or mining squadron is still in flight. New
launches will separately be required to fit their complete round trip inside
`endsAt`; the refusal at freeze is the recovery guard for old rows and worker
ordering, not the normal clock. Once frozen, the galaxy remains readable and
beautiful, but resource collection, construction, hardware changes, watches,
probes, mining and raids are refused server-side. The client hiding a button is
never the authority for this boundary.

One `season_results` row per account and season stores the final rank, Dominion,
damage dealt and taken, most-fought rival snapshot, biggest raid, a text title and
a server-authored recap JSON. Ranking uses the live ladder's exact ordering:
rounded Dominion descending, then joined-at and player id. Results reference the
account and season, never the disposable player row, so wiping a world cannot wipe
the commander's history. Titles are identity only and carry no resource, combat or
unlock advantage into another season.

This slice does not yet delete the frozen world or automatically open its
successor. That grace-period transition is operationally separate: freezing and
recording the only copy of the result must be proven before deletion is allowed to
run behind it.

### D86 · The season closes as a story, not a claim screen

When `/api/season` first returns a frozen season with the caller's result, the live
galaxy stays mounted underneath one full-screen personal recap. The recap is
acknowledged per account and season in local device storage when the commander
closes it, so a mobile browser remount cannot turn the ending into D23's recurring
door to dismiss. It remains permanently reachable from the Commander menu while
that frozen galaxy is readable.

The surface reads only the result already carried by `/api/season`; it creates no
second request and no client-authored outcome. Final rank and Dominion lead, while
battles, attacks, defences, damage, most-fought rival and biggest raid turn the
score into a memory of other people. A commander with no battles gets an honest
quiet-season account rather than invented drama. Closing the recap means “inspect
the final galaxy”, not “collect”: there is no reward button, currency, research,
unlock or inherited power attached to the ending.

The server's stored English title remains compatibility data for existing results;
the visible title is derived from the same locked rank/Dominion bands and localised
by the client. Successor creation, grace-period expiry, historical result browsing
after wipe and cosmetics earned from records remain separate slices.

### D87 · The latest record crosses the wipe with the account

`/api/auth/me` carries the caller's newest `season_results` row, joined to its
galaxy identity, whether or not that account currently owns a planet. This is the
only payload that can put a returning commander on the correct side of a wipe in
one round trip, so the record belongs beside placement rather than behind a second
history request. The field is optional in the client contract for one-deploy
compatibility and nullable for an account that has never finished a season.

An unacknowledged latest result opens the same D86 recap over either the server
list or a new live galaxy; the acknowledgement key is unchanged, so seeing it
before the wipe cannot make it reappear afterwards. Both surfaces retain a named
way back to the record. Only the newest result is carried on session open — a full
cross-season archive is a later account surface, not payload added to every login.

This closes the data-loss-in-the-interface prerequisite for automated cleanup: a
commander who was offline throughout the frozen grace period can still read what
happened after the seasonal player and planet rows are gone. It does not itself
schedule or execute that cleanup.

### D88 · Fifteen minutes of afterglow, then one atomic world rollover

Every season schedules a `season_rollover` event for fifteen minutes after its
`endsAt`, beside the existing end event and in the same creation transaction. The
window is for watching the final galaxy and sharing the result, not for catching
offline players — D87 makes the record survive indefinitely. A day-long frozen
intermission would remove the game's only decisions for a day; fifteen minutes is
long enough to inspect the ending without turning the reset into waiting.

The first due rollover waits while any current season is still live. Once all are
frozen, one database transaction folds lifetime figures, marks the old seasons
wiped, deletes their seasonal world, creates every successor and schedules those
successors' end and rollover events. Opening successors outside that transaction
is forbidden: a worker crash between deletion and bootstrap would otherwise leave
no event and no world capable of recovering itself. Duplicate rollover events are
deleted with the old queue, so only the claimed event can perform the transition.

The transaction publishes `shard:rollover` to every old season at commit. A live
client responds by reopening its authoritative session from `/api/auth/me`, which
moves it from the vanished planet to the server list while retaining the latest
record. The event carries no result, identity or placement and therefore reveals
nothing beyond the public fact that the season ended. CLI wipe uses the same
atomic path; frozen seasons count as wiped seasons in its report.

### D89 · The Chronicle remembers public moments, never hidden facts

The Galaxy Chronicle is a season-scoped, server-authored record of moments the
whole galaxy is already entitled to witness. Its first vocabulary is deliberately
small: a bombardment reached a named world, or a Command Core crossed a public
visual tier. A bombardment entry names only the target world and its commander;
it never carries the attacker, route, fleet, grade, losses or loot. A Core entry
may carry its new tier because that tier is already published by `/api/galaxy`.

Rows store their public copy as a snapshot and do not foreign-key the subject
planet. An idle seat may therefore disappear without erasing the event that made
the galaxy feel inhabited; following an old subject may fail gracefully instead.
Each source has one `(season, kind, ref)` identity, so worker redelivery cannot
tell the same story twice. The insert and `shard:chronicle` publication share the
transaction that made the moment real.

The read is scoped from the authenticated commander's current season, limited to
the previous 24 hours and cursor-paged by `(occurredAt, id)`. It is not an audit
log, an intel shortcut, a notification inbox or a new reward system. More event
kinds are admitted only when their complete payload is independently public and
the moment helps a commander ask what happened in the galaxy.

### D90 · Three-person team, medium-to-large trajectory — owner instruction

Astera is no longer constrained to a small game one solo developer can finish. It
is built by a three-person team and is intended to grow into a medium-to-large
multiplayer game. This supersedes the solo-development scope in the locked product
constraints, production risks, asset policy and infrastructure rationale.

The larger production capacity does not relax the product's design discipline.
Mobile-first portrait, web first, a real-time persistent world, one planet per
player, server authority, simple play and depth created by interacting systems all
remain locked. Additional people permit owned art production, stronger tooling,
larger content and operational work; they are not by themselves evidence for a new
gameplay system. New assets and technically ambitious presentation require an
owner, a budget, measurable acceptance criteria and a fallback before entering a
milestone.

### D91 · One seasonal rival, built from encounters rather than a new game system

A commander may mark exactly one other current-season planet as their Rival. The
choice is stored on the seasonal player row, carries no combat, loot, score or
intel advantage, and is replaced rather than accumulated. It is returned on the
existing season read and changed by one authenticated intent endpoint; opening a
dossier therefore creates no extra read or waterfall. Self and cross-season
targets are refused. The planet id deliberately has no foreign key, so reclaiming
a target cannot block cleanup; a missing target reads as a lost signal until the
commander replaces or clears it.

The existing dossier remains the only rival surface. Battle history is aggregated
server-side across the full season into encounters, attacks each way, Dominion
gained and lost, last interaction and the latest composition the opponent was
actually seen to lose. Individual reports now identify the opponent by planet id,
never by display text. Probe time is joined on the client from the already-loaded
intel payload, so the story adds no request and reveals no new fact. A battle still
says only what was fielded, never what survived or remains.

The stored planet is the anchor used to choose the Rival; the stored player is the
identity that the interface marks. Every capital and colony that commander currently
controls therefore wears the same rival reticle and label. This is presentation of an
already-public controller relationship, not new intel and not a gameplay modifier.

### D92 · Deuterium is one ruleset, not a rollout branch

Deuterium enters the current game as a mandatory third member of every resource
value. It is never optional in TypeScript or in a newly written JSON payload; old
JSON rows are normalised to zero at their read boundary and backfilled by the
migration. A planet begins with zero Deuterium and produces none passively. Zero
therefore means "none acquired", never "this server or player is outside a test".
That zero is visible in both the permanent status bar and the planet wallet before
Spectrometry: hiding a real resource until its first unlock makes later costs look
like a rule the interface invented at the moment of purchase.

There is no feature flag, control cohort, environment balance switch,
`frontierVersion` or ruleset fork. The asteroid, research and hull slices may land
in separate reviewable changes, but each completed slice becomes the one game for
every current season. That implementation sequencing must not leak into the
player contract as nullable fields or alternate behaviour.

The Crystal Extractor will contain both Deuterium works and storage without adding
a sixth building. The Vault protects exactly zero Deuterium. Raid, cargo, debris,
mining and Wealth arithmetic must include the third resource from the first slice,
so later production cannot reveal a silent two-resource path. Existing START
arithmetic remains unchanged because every opening cost and grant carries exactly
zero Deuterium.

### D93 · Frontier begins with one door, and the door opens onto the public race

The first research release contains one seasonal, instant project: Isotope
Spectrometry. It appears in Reach when the season reaches hour 42, costs Crystal,
has no timer or level, and is stored only as a completed `(planet, project)` pair.
It unlocks no passive income and no stat multiplier. Its product is permission to
read and pursue isotope-rich asteroids, so the permanent spend points straight
back into public movement, contested mining, exposed cargo and raid opportunity.

Isotope-rich rocks are derived statelessly from `(season seed, asteroid index)`
on one seed-shifted lane in every nine eligible indexes. They consume no draw from
the existing asteroid generator, begin no earlier than hour 42, replace 10% of the
rock's existing ore with Deuterium, and never increase total ore. The bounded cadence
matters: the old independent
10% roll left roughly one live field in five with no Deuterium source at all, while
Frontier prices already required it. An anomaly becomes visible when it becomes mineable; there is no
separate approach window or countdown to explain. Its rock and motion trail carry
the same crisp neon-green signature as Deuterium throughout the interface. This is
public identification, not composition intel: only a commander with Spectrometry
sees its Deuterium share or may launch at it. Ordinary rocks and ordinary mining
remain unchanged.

The 600 Crystal price is accepted after the simulator modelled both the spend and
the resulting Deuterium flow: all 54 five-seed season gates remain green without
widening a band. ARR now counts Deuterium and the actually losable 40% of durable
ground defence; omitting either understated the live risk already present rather
than measuring this feature. No feature flag, cohort, ruleset version, research
timer, new building or passive Deuterium producer is introduced.

### D94 · Runner is the first repeatable Deuterium sink, not a better Hauler

Runner is a mobile support hull unlocked by Dense Fuel Cells after Isotope
Spectrometry and a cargo-limited successful raid. It costs 650 Alloy, 225 Crystal
and 75 Deuterium; carries 300; flies at 420; has 45 HP and no attack. Like a
Hauler it is protected while combat hulls live and becomes prey when they do not.
A support-only fleet remains illegal.

The deliberately poor cargo-per-cost ratio prevents Runner replacing Hauler. It
sells a shorter exposure window for Wasp/Lance raids, not cheaper capacity; adding
a Bulwark still slows the whole fleet to Bulwark speed. Because the hull is lost
in combat and returns part of all three prices to wreckage, most new Frontier spend
can remain losable. Its price and adoption are accepted by the five-seed simulation:
all 54 existing gates remain green and Haulers still carry most cargo.

### D95 · Breacher attacks a shield condition, never the counter cycle

Gravitic Charges is the third instant seasonal project. It requires Isotope
Spectrometry and is discovered only when an attacker's real battle report records
an Aegis absorbing at least 25% of that battle's normal outgoing damage. It costs
1,200 Crystal and 250 Deuterium and unlocks one hull; it grants no global stat
multiplier. Discovery remains derived from battle history rather than a stored
flag, so PvP is the door and there is no detached research checklist.

Breacher remains Lance-class: 12 normal attack, 95 HP, speed 250, no cargo, and a
price of 1,400 Alloy, 350 Crystal and 180 Deuterium at Shipyard 3. It does not add
a fourth counter class. While a shield exists, the Breacher adds four times its
own class-adjusted normal damage directly to that shield, making its total shield
effect five times normal. The extra damage is capped by the live shield and never
passes into ships or ground defence. With no shield it is an intentionally poor
Lance substitute. Combat rounds record the actually absorbed Breacher bonus
separately so reports, discovery audits and later balance work never infer it.

These prices and the 25% discovery share must keep every existing simulation gate
without widening a band. Breacher adoption against shieldless targets is a
specific rejection condition: if the simulator treats it as a generic warship,
the feature has erased the information decision it exists to create.

### D96 · Chronicle grows only at public state transitions

The Chronicle adds four public moments: an isotope anomaly being exhausted, a
wreck field forming, a wreck field being fully claimed, and the Dominion leader
changing. Season act boundaries are scheduled server moments and join the same
feed. Each event is idempotent by `(season, kind, refId)`, snapshots only public
identity or public field data, and broadcasts only after its readable payload has
changed. Mining claims and battle settlement write their Chronicle event in the
same transaction as the state transition.

There is no entry for an ordinary partial mining claim, a private research
completion, a probe, hidden cargo, fleet composition or loot. An exhausted isotope
field says that the public race ended; it never says who took the fuel. A leader
event names only the commander and world already visible on the leaderboard.
Chronicle therefore makes the galaxy feel consequential without becoming intel.
Natural wreckage decay remains derived from the clock and creates no scheduled row;
“exhausted” here means a Prospector claim removed the final publicly visible value.
Existing live seasons receive missing Act events when the new worker boots, under
the season row lock. They are not inserted by the enum migration: PostgreSQL cannot
use an enum value in the transaction that adds it, and an old worker running during
deploy could consume that new kind before its handler exists.

### D97 · One commander holds a capital and may win up to three colonies — owner instruction

The seasonal identity remains one account, one player and one galaxy. Its stake is
now a protected `CAPITAL` plus at most three `COLONY` worlds, rather than one planet.
The capital cannot be abandoned or captured. D98 permits destructive Death Star impacts
against it without ever allowing control transfer. Colony capacity
is derived from the highest Command Core the commander controls: Core 0–2 gives zero,
3–5 one, 6–8 two and 9+ three. A lower Core never removes an existing colony; it only
prevents another acquisition until holdings plus in-flight settlement and Death Star
capture reservations fit again. A launch against a capturable world already in recovery is
stamped as a capture attempt and reserves capacity; a capital launch and any other launch are
stamped destructive and never
transfers control, even if another impact starts recovery while that rocket is in flight.
This keeps destructive bombardment available when colony capacity is full without allowing
a race to exceed the cap. The leaderboard and recap continue to name the capital, while
Wealth aggregates every controlled world and every fleet owned by that commander.

A v2 season creates exactly seventeen deterministic neutral worlds outside the first
fifty capital slots: ten T1, five T2 and two T3. They share one authoritative stock and
garrison, start full, produce Alloy and Crystal on normal curves, never passively produce
Deuterium and expose only `EMPTY`, `LOW` or `RICH` reserve bands publicly. T1 has L2
Core/Refinery/Extractor and no defence; T2 has those at L5, Shipyard L2, eight Wasps and
two Lances; T3 has them at L8, Shipyard L4, Aegis L3, sixteen Wasps, six Lances, two
Bulwarks, six Thorns and two Bastions. T2 and T3 buy deterministic template recovery from
their own stock every six and four hours respectively. Captured or reclaimed neutrals are
never replaced.

Neutral battles use the normal combat and loot arithmetic but never Dominion, bash,
rival/research/reward progress, defender notification, system-funded wreckage or the
season's largest-PvP-raid measure. The first decisive conventional raid opens one public
claim window; D111 re-derives its length from the widest settlement flight the disc can
produce, so this thirty-minute figure no longer holds. A valid one-way settlement consumes
one Hauler plus 1,000 Alloy and 500 Crystal, must arrive before that window ends, and the first atomically valid
arrival wins. A losing settlement returns its fleet and cargo to its origin or, if that
world is no longer controlled, its commander's capital. Control transfer preserves the
world's installed state and begins six hours of occupation protection.

`TRANSFER` is a one-way mission between two worlds controlled by the same commander.
Ships and Prospectors may move; ground defence may not. Resources require a Hauler or
Runner and fit only those hulls' cargo. If the target changes controller before arrival,
the mission returns to the mission owner's capital. The same owner identity keeps all
ordinary away fleets with their commander when a home world changes controller.

The War act adds the instant planetary `DEATH_STAR_PROTOCOL` research after Gravitic
Charges (Core 6; 7,200 Alloy, 2,400 Crystal, 600 Deuterium). A world with that project,
Core 6 and Shipyard 5 may spend 15,000 Alloy, 4,800 Crystal and 1,500 Deuterium on one
Death Star. This is the single exception to instant construction: it takes sixty minutes,
pauses during recovery, survives ordinary raids and transfers with the world. Capital
worlds may build and launch one and may also be targeted. Launch frees the world's asset
slot, uses one flight bay, carries no escort or cargo, cannot be recalled or intercepted,
and resolves exactly at `arriveAt` as a public galaxy moment.

A first valid Death Star strike against any enemy world clears storage, works
and shield; lowers Core, Refinery, Extractor, Shipyard and Aegis one level; destroys every
home Wasp, Lance, Bulwark, Hauler, Runner, Breacher, Prospector, Thorn and Bastion; preserves
away craft, research, Vault, Telescope, Radar, Veil, satellites and any ready/building
Death Star; clears conventional disruption and claim; and begins six hours of recovery.
It yields no loot, Dominion or debris. During recovery the world is readable, probeable
and may receive owner transfers or mining returns, but produces, regenerates, collects,
buys or launches nothing; pre-launched ordinary attacks turn back without battle.

A second Death Star impact before the matching recovery end repeats the damage. On a neutral
or player colony whose launch was stamped as a capture attempt, it also gives control to that
impact's commander, ends recovery and begins six hours of occupation protection. A capital
instead begins a fresh recovery window and never changes hands. Neutral and player-colony
acquisition share one atomic control-transfer primitive. Simultaneous impacts resolve by
`(resolveAt, mission id)`; a rocket arriving during protection is consumed without effect.
Stored research and hardware are never
deleted by prerequisite loss: effective instrument level is capped by Core and excess
orbit slots become inactive in numeric slot order, reactivating automatically when their
requirements return.

This decision supersedes D21/D90 only where they say one player owns one planet, D4 only
for the sixty-minute Death Star build, the building-indestructibility rule only for the
listed Death Star damage, and any statement that colonisation does not
exist. Ordinary PvP still never damages buildings or changes control. The ready/building
Death Star on a capital is an explicit owner override to the no-new-unlosable-sink result;
no TAX, ARR or other existing acceptance band may be widened to admit it. Deployment is
expand/backfill/contract, v2 activation occurs only at a new-season boundary, and the
season's immutable `rulesetVersion` decides whether these worlds exist.

### D98 · A Death Star destroys any enemy world; only colonies change hands — owner instruction

The destructive and acquisition roles are separate. A ready Death Star may target any
enemy capital, colony or neutral world. Every effective impact clears storage, works and
shield, destroys the named home fleet and defence, lowers the named buildings and Aegis,
and starts or refreshes six hours of recovery. This is true for capitals too: "protected
capital" means uncapturable, not immune to the game's strategic weapon.

Only a neutral or player colony that was already recovering when the rocket launched is a
capture attempt. That launch reserves colony capacity and may transfer control when it
arrives inside the same recovery window. A capital launch is always destructive, including
during recovery; it never reserves capacity and can never transfer control. This supersedes
D97 only where it made capitals invalid Death Star targets.

The Frontier supply is raised without adding passive production or remapping the original
seeded one-in-nine lane. One additional seed-shifted seam appears every ten lanes, raising
the eligible isotope rate from 10/90 to 11/90 (10% more rich rocks), and a rich rock replaces
10.4% rather than 10% of its ore with Deuterium. Total rock ore stays unchanged; expected
Deuterium flow rises 14.4%. Five fixed 50-player seeds accept this setting with every existing
band and the informed-player gate unchanged. A 10.5% share was rejected because the informed
archetype lost the seed-99 ladder. This preserves contested mining, public movement, cargo
exposure and raid theft as its only sources. It supersedes D93's two abundance figures, not
its acquisition loop.

### D99 · One galaxy admits 300 active commanders — owner instruction

The production admission ceiling is three hundred commanders in one galaxy, with a
three-hundred-and-seventy-five-connection burst gate. This replaces D21's fifty-seat ceiling;
galaxies still fill strictly in ordinal order and an account still has one seasonal commander in
one galaxy. The stored `shards.playerCap` remains authoritative for an already-open season, so
the new default is applied only by a new-season bootstrap or wipe and never silently enlarges a
live galaxy.

Capacity does not silently rebalance the game. The disc keeps its radius, travel formula, fleet
speeds, Telescope ranges, combat, economy and fog rules. D97's neutral supply is enlarged for
this population to exactly thirty T1, fifteen T2 and six T3 worlds; a new v2 season therefore opens
with 300 capital addresses and 51 neutral worlds. The deterministic neutral address pool begins after all 300
capital addresses, so a neutral can never occupy a seat that a later commander is entitled to.
The denser neighbourhood and scarcer per-commander neutral opportunity are explicit playtest
consequences of this owner decision, not permission to tune balance constants inside a capacity
change. This supersedes D97 only for the neutral counts and the first capital-slot boundary.

The supported production shape for this target is three API replicas, one event worker, one
PostgreSQL instance and a small shared Valkey rate-limit store. PostgreSQL `LISTEN/NOTIFY`
continues to carry transactional shard invalidations to every API replica. Shared public
projections may be cached only as bounded, disposable data: player-specific Telescope, ownership
and fog fields are applied after the cache, invalidation follows the committed shard event, and a
short TTL is only a repair net. Turning the cache off must make the service slower, never
different. The caller's own world topology may use a separate bounded account-keyed cache, but it
is never shared into a public projection and is bypassed whenever the invalidation bus is unhealthy.
Mining follows the same boundary in the contract: `/api/mining/field` is the shared asteroid/debris
surface; `/api/mining/status` contains only the caller's worlds, runs, research and isotope knowledge.

"Capacity 300" is an operational claim, not the value of one constant. Opening admission at 300
requires a repeatable 300-user real HTTP/SSE run, a 375-connection burst, worker-wave correctness,
mobile profiling and a soak against the acceptance bounds recorded here. Until those
gates pass, the code and deployment are 300-ready but production capacity is not certified. This
decision supersedes D21 and every later sentence that calls fifty the galaxy seat ceiling; it
does not supersede the five fixed 50-player simulator seeds, whose balance measurements remain a
separate regression model. Those historical comparisons explicitly retain their 10/5/2 fixture;
default simulation and every live v2 season use D99's 30/15/6 layout.

### D100 · Production opens at most two galaxies — owner instruction

The supported live world is two galaxies of three hundred commander seats each. They still fill
strictly in ordinal order: EU-2 exists so admission can continue when EU-1 reaches 300, not as a
day-one choice that splits the population. Bootstrap and atomic season rollover open exactly the
first two ordinals at the current `SERVERS.capacity`; a predecessor shard row is configuration
history, never the source of the successor count or capacity.

Older EU-3 and above shard rows are retained because season results and prior seasons reference
them, but they are retired from the public server list and cannot be selected by admission. No
production migration deletes historical shards or rewrites their old season capacity. This
supersedes D21/D99 only where they describe ten simultaneously available galaxies; the one-account,
one-commander, one-galaxy constraint and sequential frontier are unchanged.

### D101 · Economy v2 — the whole ruleset re-derived — owner instruction

Every economic number was replaced at once, because they are derived against each other and a
partial adoption breaks the ratios that make them safe. **A wipe-boundary change.**

**Production carries a linear factor.** `base × L × g^L` instead of `base × g^L`. It is the only
common shape that doubles output at L1→L2 — the opening a 14-day season needs — while decaying to
+16% per level by L18, which is the brake. A pure exponential has one growth rate for ever.

**Prices were not cut; income was raised ×1.20** (D17's rule). Content lands around day 11 and the
last days are war.

**Strategic commitments moved with that economy.** A settlement consumes two Haulers plus
2,000 Alloy and 1,000 Crystal; the Death Star Protocol costs 11,000 / 3,600 / 900 and the asset
28,000 / 9,000 / 2,600. D97's earlier one-Hauler and price figures are superseded. Flight speeds
are unchanged by this economic pass.

**The disc is 2.5× wider.** The balance was tuned on a 50-planet galaxy; production runs 351 on the
same disc, so every commander's tenth-nearest world had gone from 510 units to 204. Radius 1000 →
2500 restores that gameplay density. The later owner-reviewed 300-player fixture keeps the web at
50 game units per world unit, so that larger disc is visible rather than compressed back into the
old picture. Hull speeds do NOT take the factor: the disc moved to meet them, which is what lands an
11–16 minute neighbourhood raid. `radarRange` does not either — it is sized in warning minutes, not
in galaxy share.

**The Vault sets storage capacity as well as the floor**, and this was forced. `upgradeCost` grows
at 1.56 while a flat store grows at `L × 1.10^L`; they cross, and above the crossing one upgrade
costs more than a full store can hold. The pre-v2 curves crossed at L10 — the bug shipped. The
floor is now hours of each resource's OWN production, which makes D61's alloy-figure-charged-against-
crystal bug unrepresentable.

**The hull table is priced on `atk · hp / value²`** — equal-budget power when damage is spread
across a force. Attack-per-resource is what made the old Bulwark lose every equal-budget matchup
including against the Lance it counters. A tech tier buys ~15%; the counter cycle buys 156%, so
information still beats tech.

**The bands did not move.** `ARR` was out of band through the pass and five constant-level levers
failed to move it; what did was mirroring the build queue in the simulator. `docs/balance.md`
records which five and what each cost.

### D102 · Isotope concentration is seeded per asteroid between 10% and 25% — owner instruction

An isotope-rich asteroid no longer carries the same Deuterium concentration as every other rich
asteroid. Its concentration is a deterministic, whole-percent roll in the inclusive 10–25% range,
derived from the season seed and asteroid index without consuming or moving the galaxy RNG. The
same asteroid therefore has one value for the server, simulator and every entitled client, while
different rocks create materially different public races. The asteroid's independently seeded
Crystal share remains intact; Deuterium replaces its Alloy body. This prevents a richer isotope seam
from silently erasing the resource needed to enter the research path, and the generated maxima still
leave at least 10% Alloy. Total ore remains unchanged. This supersedes D98's fixed 10.4% share;
isotope cadence and bonus-seam frequency do not change.

### D103 · A Rival choice commits on the first shared move, and strategic strikes are history

A Rival marker may be corrected or cleared only while the two commanders have no recorded probe,
battle or Death Star impact between them. The first such interaction commits that opponent for the
rest of the season; after commitment the endpoint refuses replacement and removal. This preserves
misclick recovery without making Rival a freely swappable label chosen after every result. Encounter
history remains opponent history whether or not that opponent was marked at the time.

A resolved Death Star writes one idempotent strategic-impact row containing both commander
identities, the target, outcome, destroyed home force and destroyed economic value. The value is
the cleared storage/works plus the replacement prices of the building and Aegis levels removed and
the destroyed home force; regenerated shield is excluded. Rival dossiers count the strike as an
interaction, and the same stored value contributes to season damage dealt/taken. This extends D85
and D91: a strategic weapon can no longer destroy a world while leaving both histories unchanged.

### D104 · The follow bonus is paid once per person, and the population figure is live — owner instruction

*"Twitter takip bonusu kişiye 1 kez verilebilmeli. Her sezon her sezon alamaz."* The @JoinAstera
grant now lives in `account_rewards`, keyed on the ACCOUNT, and every reward chain declares a
`scope`: `season` for the ten counted chains, `account` for this one. `reward_grants` keeps the
season-scoped tiers and keeps dying with the world, which is right — their progress is counted off
worlds that cease to exist. Nothing deletes from `account_rewards`: not `wipeAllServers`, not the
idle-seat reclaim (D70), not a rollover. The failure it closes was one key: a player row is deleted
by both of those, so after every turnover the ledger said the account had never been paid and the
operator's command reported `already: false` — 1,000 alloy and 500 crystal a fortnight, for ever,
for one follow performed once. `grantReward` now resolves an ACCOUNT rather than a player, so a
commander between galaxies can still be granted the bonus. The card states the rule where the
player reads it: once taken, the three instructions and the link to X come down and it says the
bonus does not come back with a new galaxy.

`useSeason` carried a `staleTime` and no refetch. Staleness only decides whether a refetch may be
served from cache, so `online` — the population figure in the corner of the disc — was read once on
mount and then frozen for the life of the tab; a manual reload was the only way to move it. It is
the one read in the client where the TIMER is the mechanism rather than the safety net under a
broadcast (D53): presence has no moment to publish. `lastActiveAt` is stamped at most once a minute
per commander and the count is a five-minute trailing window, so nobody arrives and nobody leaves —
the figure drifts. Broadcasting it would be one shard event per commander per minute, three hundred
a minute on a full galaxy, to move a number in a corner.

### D105 · A resolved Death Star impact remains reconstructible for its public effect window

The explosion is a server-clock event, not a callback owned by the sender's tab. An in-flight Death
Star supplies every observer with the same mission id, target and arrival timestamp; after resolution,
traffic continues to expose that anonymous contact for `DEATH_STAR.impactSeconds`. This short replay
window is necessary for a tab opened, focused, restored from bfcache or reconnected just after the
worker commits: without it the mission has already left the in-flight query and that client can never
reconstruct an explosion which continuously open clients are still showing. The contact discloses no
owner or origin, expires at the same strict edge as the visual, and uses one rules-level duration on
server and client. Client lifecycle edges resynchronise all live reads, while contact-window expiry
uses bounded consistency retries; neither vehicle motion nor effect timing depends on timer delivery.

### D106 · One galaxy, one clock: every viewer draws the same craft in the same place

*"Herkes aynı anda aynı şeyi görmeli."* A craft in flight was drawn by two independent pieces
of code — the owner interpolated its whole leg out of `pending`, everybody else interpolated a
bearing window out of `/api/galaxy/traffic` — and both were correct against their own inputs
while disagreeing with each other by more than a planet's width. The owner's renderer has
stopped its legs short of a world since D44, because a craft drawn at a planet's coordinates is
drawn inside it; the public window knew nothing about that rule and published the physical
position. The gap grows along the leg and is widest at the arrival, which is the moment the
whole galaxy is looking: the attacker watched their fleet still closing while everyone else
watched it sit on the target and wait.

**The visual leg is now one definition, in `packages/rules/src/view.ts`.** The unit conversion,
the height exaggeration, the three drawn world sizes and the orbital standoff live there; the
server publishes every bearing window ON that leg, and the client draws its own craft ALONG it.
Both sides derive it from the same public `coreTier`, so the two pictures are the same line by
construction rather than by agreement. Drawing geometry is allowed in the rules package for one
reason only, and it is the same test everything else there passes: two processes must agree on
it. `clearOfWorlds` moved inside `threadPosition`, `contactPosition` and `runPosition` for the
same reason — a renderer cannot forget a rule it does not have to remember.

**An effect is a PUBLISHED moment and place, never one inferred from a flight.** A raid has
said "I am bombarding this world, from here until here" since D52; a Death Star said nothing, so
its detonation existed only on the attacker's client — the one payload it could be worked out
from. `Contact.impact` gives it the same shape as `engagement`, armed on the final approach where
the destination is already conceded and carried by D105's replay window after the mission
resolves, so a tab that was elsewhere can still play it — D105 kept the contact alive, and this
is the field that says what it MEANS, rather than leaving each renderer to infer an instant and
a place from the shape of a bearing window. The rule generalises: any
future effect everybody is meant to watch together is published, not derived.

**A Death Star does not survive its own strike.** Owner instruction. The weapon IS the
explosion, and it lingered for eight seconds on every screen because both payloads legitimately
still described it — the attacker's mission is only resolved on the worker's next tick, and the
resolved mission is republished to carry the effect. `useStrikeConsumed` states what those
payloads mean and both renderers ask it.

**The coast is a bridge over a late read, not a substitute for one.** It was half the published
window again — and a window is at least a minute, so a failed refetch could draw a craft thirty
seconds of flight past where it was. That costs nothing while the craft is still flying, because
a coast runs at the true speed; the damage is all on the other side of the arrival, where the
real craft has stopped and the guess sails on through the world it just landed on. It is three
seconds now, and a tab that comes back to the front resyncs immediately (D104's lifecycle edge).

`apps/server/test/one-galaxy.test.ts` is what makes this stay true. It walks a raid, a probe, a
Death Star, a mining run and a leg coming home second by second, computing the owner's picture
and a stranger's picture with the REAL renderers imported across the package boundary, and
fails if they differ by a fifth of a world unit. It is also where the next craft kind gets
asked the only question that matters: does everybody see the same thing.

### D107 · The foot strip is the fleet roster, and departure focus is capability-based — owner instruction

The permanent in-flight strip now reads both mission threads and mining/salvage runs. A Prospector
in `mining.runs` is therefore the same visible reason to return as a fleet, probe, transfer,
settlement craft or Death Star in `pending`; an empty mission list can no longer state that nothing
is airborne while drills cross the disc. Pressing the strip opens the complete live roster. Every
owned drawable row focuses the craft already rendered by the disc, while an anonymous inbound
warning remains visible without inventing a route the Radar did not reveal.

Focus after departure is no longer wired into individual launch callbacks. The client baselines the
first complete payload without moving the camera, then follows any newly appearing owned drawable:
a pending row with a path or a live mining row. The identity is remembered across stale disappearances
and return legs, so a refetch cannot focus the same mission twice. A future craft that uses either
payload capability inherits launch focus without another vehicle-kind branch.

Build and combat launch sheets share one exact quantity control: minus and plus move by one, Max
jumps to the server-visible ceiling, and the figure is a read-only input. This replaces fixed ladders
and size-dependent jumps, both of which made intermediate quantities unreachable. The galactic dust
plate rotates only from client frame deltas; its slow ambient turn remains active even when reduced
motion is enabled, while the scene's faster effects still respect that preference. It is presentation and
never a server-clock fact. The music control keeps mute/resume and adds a persisted 0–100 device-level
slider that mutates the live audio element rather than recreating it.

### D108 · Progression is organised by player intent, and every commitment opens — owner instruction

The planet tabs no longer mirror implementation kinds. Their player-facing model is Production,
Intel, Defend and Fleet; Turkish uses Üretim, Bilgi, Savunma and Filo. Foundry lives with production; Uplink, Telescope, Radar and Veil live with
information; Vault, Aegis and both ground batteries live with survival; Derrick, Beacon, research,
Shipyard and mobile hulls live with operations beyond the world. Aegis under Orbit was the clearest
failure: the code was correctly calling it a ground instrument while the interface asked a player
looking for a shield to search the sky.

The four satellites still compete for the same Core-opened sockets. That comparison moves out of
their former shared list and into a persistent orbit rack above the category content; every satellite
sheet names the same slot cost. The strategic identity choice therefore survives the information
architecture change instead of being hidden by it.

Every progression row is now a compact scanner and never a commit control. Pressing a building,
instrument, satellite, research project, mobile hull or ground battery opens its bottom sheet. The
sheet owns the role, present condition, next outcome, later ladder or milestones, exact price,
requirements and final action. This is also the new rehearsal grammar: a guided beat opens the item,
explains why that step matters to the larger loop, then commits from the real sheet. A list can be
scanned quickly; a purchase cannot be made without seeing what it is for.

The rehearsal gates activation rather than gestures: scrolling, pinching and orbiting stay live,
but an unrelated menu or item cannot change the staged world. Closing a detail sheet is recoverable;
the same highlighted row opens it again. Skip and existing-account entry remain deliberate exits.
After the fleet beat, the camera eases back to the full disc before asking for another planet, so a
player cannot be asked to tap a world that the previous close-up left off-screen.

### D109 · One ladder, one card word, one control per idea — the interface system, enforced

An audit measured what the design system was actually doing rather than what its comments said,
and the answer was that it had forked. The vocabulary was right and half the interface had never
been moved onto it.

**What was measured.** 346 hand-written `text-[Npx]` declarations across eighteen distinct sizes,
against nineteen uses of the seven tokens `styles.css` had defined for exactly that purpose — with
a comment saying the scale existed "so the sprawl of arbitrary text-[13px] can end". An `<h2>` was
rendered at 11, 13, 18 or 21px depending on the file. Forty-eight distinct hand-built uppercase
label recipes stood beside `.legend`. Eighteen letter-spacings, two of them the same number spelled
differently (`0.1em`, `0.10em`). Thirteen corner radii in the stylesheet, nine of them live on one
screen, with `rounded` and `rounded-sm` resolving to the same four pixels in Tailwind v4. Three card
materials (`plate`, `frame`, `panel`) at seventeen, seventeen and nine uses. Five button systems.
Three segmented controls with three different grammars for "this one is selected" and three
different things said to a screen reader. Five off-palette reds for one idea.

**Where the fork ran.** `plate`, the new material, had reached the commander menu, the server list,
the season recap and the leaderboard. It had reached none of PlanetHero, ItemSheet, UpgradeRow,
PlanetScreen or FocusPanel — the five files that are ninety per cent of the game. The kit's own
`Sheet`, the better-dressed of the two, sat at zero imports while all nine real sheets used a legacy
panel whose entrance animation named a keyframe that had never been written.

**What is settled.**

*Type* is eight steps, each tied to a role rather than a size: `hero · readout · figure · title ·
body · caption · label · micro`. `caption` (12px) is the one step added. Uppercase is three
component classes and nothing else — `.legend` for an engraved caption, `.name` for what a thing
is, `.headline` for a section that owns the block under it. Tracking is two values, radius is six,
and spacing is `4 · 8 · 12 · 16 · 24 · 32` with every half-step snapped onto it.

*Material* is one card word. `.plate` with four states — raised, `flush`, `inset` (what `frame`
was), `sunk` — and `.slab` for anything pressed. `frame`, `panel`, `btn`, `group`, `art-well`,
`bracket`, `scan`, `rail`, `glass-thin` and the whole claim-badge block are deleted.

*One control per idea.* `Segmented` is the only segmented control: the selected segment is the one
that is lit and raised, `role` picks tablist or group semantics, and the keyboard contract the intel
tabs implemented by hand now belongs to every one of them. `Sheet` is the only bottom sheet, and it
owns its own padding — `bleed` hands that job to the caller, which is what replaced fourteen
negative margins whose only purpose was to cancel a gutter applied one level too high.

**The rule has teeth this time.** `text-[`, `tracking-[` and `rounded-[` are refused by ESLint in
`apps/web/src`. A convention that is only written down decays back to whatever each author types,
and this one had already proved it once.

**Four things were drawing wrongly and nobody could see why.** `chrome.css` gave `.group` a card
background and a 1px inset ring while Tailwind uses the same class as its `group-hover:` marker, so
every purchasable row in the game drew an unintended card inside the plate that already had one.
Eight `border-*` colour utilities sat on box-shadow shapes with no border width, so they drew
nothing — including the only thing distinguishing an error toast from an informational one. Every
bottom sheet arrived as a jump cut against a keyframe that did not exist. And the disc drew a name
for every marked world with no screen-space collision test at all, so worlds that clustered wrote
three labels into the same forty pixels and ran off the edge of the phone; labels are placed in
priority order now — selection, own worlds, rival, a world on a clock, an open window — and one that
would overlap a placed label is not drawn.

**Three interface rules were being broken by the code that documented them.** A full store went
threat-red beside a meter that correctly kept its hue (I0). The planet sheet's own wallet, which
exists so a price can be checked without closing the sheet, rendered the same three figures with
`compact()` while the header above it used `full()` — both on screen at once. And DEFENCE and SHIELD
sat side by side both reading "None", one in red and one in bone; an absent system is a GAP, amber,
and red is reserved for something happening to you.

### D109a · A dismiss control answers only a gesture that began on it

Tapping a world on the disc opened the planet sheet and it shut itself again. The
event trace, from the running client:

```
pointerdown → canvas          the finger lands on the world
pointerup   → canvas
SHEET OPEN                    React mounts the sheet ~98ms later
touchend    → canvas
click       → button[scrim]   the browser dispatches the tap's click NOW,
sheet gone                    and the scrim is what is under the finger
```

A synthesised click is delivered to whatever occupies the point at DISPATCH time,
not to what was there when the finger went down — so the scrim was closing a sheet
on the tail of the very gesture that asked for it. Opening the same sheet from a
DOM control never failed, because there the click is consumed by the button that
was pressed; the owner reported exactly that asymmetry.

It is a race, which is why it reached a phone first and a desktop second, and why
it surfaced with D109: giving the sheet the entrance animation it had been
declaring against a keyframe that did not exist means that for its first 340ms the
point under the finger is still scrim rather than panel. The animation is right.
The scrim was always wrong.

A DELAY WOULD ONLY MOVE THE RACE. What settles it is the rule the control should
have had: a press belongs to the surface it STARTED on. `useOwnPress` records the
control's own `pointerdown` and ignores any click without one, which is
timing-independent and costs nothing.

**THE CLASS, NOT THE INSTANCE.** The sheet was found by playing; the question that
mattered more was whether the same thing sits somewhere nobody has tapped yet. It
does. The focus rail mounts along the bottom edge the instant a world is selected,
and a world can be tapped there — so the stray click lands on one of its two
controls: the toggle, which EXPANDS a rail the owner decided must open closed, or
CLEAR, which deselects the world the player just chose, on the same gesture that
chose it. The front door's dialog scrim and the season recap's close are the same
shape and are guarded before anyone meets them.

KEYBOARD ACTIVATION IS NOT A POINTER PRESS. Enter or Space on a focused button
fires a click with no `pointerdown` — exactly the shape being refused — so the
guard exempts `detail === 0`. Measured rather than assumed: a touch tap and a
mouse click both carry `detail: 1`, a keyboard activation carries `0`. Without
that exemption the guard would have made every one of these controls keyboard-dead.

`test/sheet-dismiss.test.tsx` holds the sheet's behaviour; `test/stray-click.test.tsx`
holds the primitive and audits the four surfaces by name, so the next overlay is
added by copying one that already carries the fix.

### D110 · Asteroids enter the galaxy fifteen percent faster — owner instruction

The asteroid arrival rate rises from 9 to 10.35 per hour. This is a rate increase,
not a fifteen-percent cut to the interval. The established 9/hour deterministic lane
is left byte-for-byte intact — indices, rolls and appearance times included — and a
second 1.35/hour lane supplies new indices between it. That prevents a balance change
from moving or deleting a target already visible in a live season. Capacity modelling
uses the matching per-player rate, 0.030 to 0.0345, so every documented galaxy size
receives the same proportional increase.

### D111 · The claim window is derived from the widest settlement flight, not typed

`MULTI_WORLD.claimMinutes = 30` is replaced by `SETTLEMENT_CLAIM_MINUTES`, computed in
`packages/rules/src/strategic.ts` as the two-Hauler flight time across `GALAXY_SPAN` —
the corner-to-corner bound of the disc — rounded up to a whole minute. At the shipped
radius that is 73 minutes. The literal is gone from `constants.ts` and may not be typed
back in: any change to the disc radius, the disc thickness, `TRAVEL`, the Hauler's speed
or the settlement's Hauler count now moves the window with it.

**Thirty was this same derivation with the arithmetic already done.** At radius 1000 the
widest crossing was a little over 2,000 units and two Haulers covered it in 29.2 minutes.
D101 then widened the disc 2.5× and named every constant that did and did not take the
factor — hull speeds no, `radarRange` no, the Prospector and the rocks yes — and the claim
window was never in that list. The widest crossing became 71.1 minutes against an unchanged
thirty-minute window, so the window stopped covering the flight it exists to contain.

**What it cost**, measured across seeds 1-3 at the shipped 300-capital / 51-neutral layout:
48% of all (capital, neutral) pairs were settleable at all; the median pair missed by 0.8
minutes; the worst pair needed 71 minutes; and the six T3 worlds at the contested centre —
the whole strategic prize — sat 21 to 33 minutes from a rim capital. A commander could win
a decisive raid and then watch the world's one window close with their Haulers still in the
air, and because the opener is public, decisively raiding a distant neutral was a gift to a
nearer rival. Every settlement test in the suite placed its two worlds 20 to 150 units
apart, which is why this shipped green.

**Proximity still decides the race**, because the first valid arrival wins and a nearer
commander still arrives first. What changed is that distance no longer decides who may
enter it. The ceiling is the only slack a commander at the extreme rim gets — about a
minute at a real seed's widest pair — and that is deliberate.

This does not supersede D97's "one public claim window per neutral world"; it only
re-derives its length. In the 50-player regression fixture the change raises total
settlements across the five seeds from 8 to 20, with every acceptance band unchanged.

### D112 · A claim window that has closed reopens; a live one is never extended — owner instruction

`resolveNeutralBattle` opened a claim only where `claim_until IS NULL`, and nothing in the
system ever puts an EXPIRED claim back to null. A neutral world whose window ran out was
therefore un-settleable for the rest of the season: still raidable, still lootable, and
worth nothing to take. The only thing that could undo it was a Death Star landing on that
world, which clears the claim as part of its damage. Fifty-one neutral worlds retired one
at a time, each on the first occasion nobody's Haulers made it.

The guard is now "null OR already past". The half that always mattered is kept exactly: a
decisive raid landing while the window is OPEN does not push its end back, or a commander
with a spare squadron holds a claim open indefinitely and nobody else's Haulers ever beat
theirs. Only a window that has closed opens again, and it opens at full length.

This supersedes D97's "the FIRST decisive conventional raid opens ONE public claim window"
in one respect only — a world may host more than one window across a season, never more
than one at a time. Everything else about the claim is unchanged: it is public, it is
opened only by a decisive conventional raid, and the first atomically valid settlement
arrival wins it. D111 sets its length.

`packages/sim` carries the same rule. Together with D111 the two changes raise total
settlements in the 50-player regression fixture from 8 to 20 across the five seeds, with
every acceptance band unchanged.

**A note on the one red test.** `packages/sim/test/season.test.ts` →
"surfaces Gravitic Charges and Breachers without turning them into a default fleet" now
fails, and it is being left failing on the owner's instruction. It is not a colonisation
regression. Measured on unmodified master, across 15 seeds x 50 players x 14 days — 750
bot-seasons — exactly ONE bot ever researches Gravitic Charges, and only on seed 99, which
the five-seed gate happens to include. The assertion is `researched.length > 0`, so it
rides on that single coincidence and any change that moves the simulation's trajectory
drops it to zero. The mechanism itself is intact: 18 to 25 players per seed still reach
`shieldInsightSeen`, and 21 of 50 still field an Aegis. What never happens is the specific
event the chain needs — a GRINDER, the only archetype with `researchesBreacher`, raiding a
defender whose shield absorbs a quarter of its outgoing damage.

**What leaving it red costs.** `pnpm verify` is red, and because `pnpm -r test` stops at the
first failing package, the server and web suites do not run under that one command at all —
they must be run per package, where both are green (server 693, web 1,093, rules 316). So
the cost is not one missing assertion; it is that the standard verification command stops
covering 1,786 other tests. Until this is settled, verify with `pnpm typecheck && pnpm lint`
and then each package's `test` script separately.

### D113 · The Death Star is re-specified, and says what it does — owner instruction

**The weapon.** It costs 15,000 Alloy, 15,000 Crystal and 3,000 Deuterium, and both
gates — `DEATH_STAR_PROTOCOL` and the craft itself — are Command Core 12. The research
reads `DEATH_STAR.requiredCore` rather than carrying its own figure, so permission and
capability cannot drift apart. Shipyard 5 and the sixty-minute build are unchanged.

**What an impact does, and the list is now closed.** Every ship and gun standing on the
world is destroyed; half of everything stored and in the works is destroyed; the Command
Core loses one level; the Aegis loses two and the shield drops to nothing; every queued
building order is cancelled with no refund; and the world produces, collects, buys and
launches nothing for two hours. Away craft, research, and every other building and orbit
instrument survive — the Core's fall pulls a building down only where `CORE_CEILING`
requires it, so a Refinery on the old ceiling drops and one two levels under it does not.

**Halving replaces zeroing, and that is what makes a second strike a decision.** A second
impact inside the recovery window takes half of what is LEFT, so the arithmetic composes
instead of repeating an already-total loss. It also makes the lazy economy load-bearing:
zeroing a stale row and zeroing a current one give the same answer, halving does not, so
the target is advanced to `now` first — an owned world through `loadLocked`, a neutral
through `advanceNeutralEconomy`, which nothing else was calling on this path.

**Recovery falls from six hours to two.** It is also the window a capture has to arrive
in, and that is why shortening it was safe rather than reckless: a Death Star crosses the
whole disc in 13.1 minutes and the second one takes sixty to build, so the capture leg is
73.1 minutes against a 120-minute window. Six hours had made the punishment an
evening-long outage.

**The queued-order burn is a fix as well as a rule.** `applyOrderEffect` raises a building
to `before + 1` without re-reading the Core ceiling, so an order placed at Core 12 could
complete after a strike had left Core 11 and stand at a level `build.ts` refuses to sell.
Cancelling those orders removes the only path to that state. `destroyBuildingOrders`
touches BUILDING orders only: instruments are effective-capped by the Core already (D97),
satellites are gated by slot count rather than level, research carries no level, and hulls
are in the other queue, which a strike does not touch.

**The interface says all of it, on both sides.** The forge card tells the owner what they
are buying before they spend 33,000; the focus rail tells the attacker what the rocket
does to the world under the crosshair, capital included. Two surfaces, two sets of strings
(D55), every figure read from `DEATH_STAR` and `MULTI_WORLD`. Both blocks are
`plate plate-inset` and not `plate-threat`: the lit states belong to a plate that is doing
something now, and an explanation is reference, not state. Raising the research gate to
Core 12 also forced the research row to show it — `researchState` computes availability
from discovery, prerequisite and the act clock and never from `requiredCore`, so the row
rendered as buyable and the tap came back `RESEARCH_UNAVAILABLE`. Survivable at Core 6;
the ordinary case at Core 12.

**Measured, on real rows and on the five gate seeds.** A Core 12 / Refinery 12 /
Extractor 10 / Vault 8 / Shipyard 5 world holding 40,000 Alloy: after one impact it holds
20,000, Core 11, Refinery 11, Extractor 10, Vault 8, Shipyard 5, Aegis 1, no home fleet,
its away fleet and research intact, its queued Extractor cancelled, and 120 minutes of
recovery. A second impact thirty minutes later leaves 10,000 and Core 10. On admission:
36 of 50 simulated commanders stand at Core 12 + Shipyard 5 by day 7 and 41 by day 9,
against a War act that opens on day 4 — a real gate, three days into the act, not dead
content. Median end-of-season Crystal is 42,000-72,000 against a 15,000 craft.

Economic balance was explicitly not measured on the owner's instruction. Note that the
simulator has never once built a Death Star on any seed: its bots reach it through
`GRAVITIC_CHARGES`, which needs a GRINDER to raid a shielded defender, and that has
happened once in 750 bot-seasons. The strategic layer's own tests cover the path instead.

### D115 · A squadron draws every ship it holds; the launch sheet says what is already away — owner instruction

**The marker cap is gone.** `formationFor` truncated a formation at twelve markers and
`markersFor` builds them in `ALL_HULLS` order, so one crowded hull ate the whole budget
and every other hull disappeared from the disc. Reported from play: a fleet of 83 Wasps,
4 Lances, 2 Haulers and 1 Bulwark drew as twelve full Wasp markers and nothing else —
60 of 90 ships, one of four hulls — while the focus panel it opens spelt all four out.
D40 required the overflow to be stated as a number instead; it never was. `Formation.hidden`
was computed in `Squadrons.tsx`, carried through `Fleets.tsx` and read by nothing, so the
cap's only lasting effect was to state a fleet wrongly with full confidence. `MAX_MARKERS`,
`Formation` and `formationFor` are deleted; the four call sites take `markersFor` directly.

What the cap bought was real and is now spent: a marker costs two draw calls and a depth
clear, and the light, pip and wake fields are batched per formation but the hull is not. A
large fleet is now a large formation. If that becomes a frame problem the answer is
instancing the hull, not cutting ships back out of the picture — a picture that disagrees
with the panel above it is the more expensive failure.

**Removing the cap broke the bombardment, and review caught it.** `Bombardment` passes
`slots.length` into `volleyFor`, whose ceiling is shared out as
`perModel = max(1, floor(MAX_ROUNDS / models))` — so the `max(1, …)` floor took over past
40 models and the volley became one round per marker with no ceiling at all. Measured on
the real functions: 200 ships drew 40 markers and fired 40 rounds; 1,000 ships drew 200
markers and fired **200 rounds 0.0155s apart**, against a file whose two stated properties
are "at most `MAX_ROUNDS`" and "never two rounds inside 0.05s". Both bombardment tests said
"at any formation size" while iterating `[1, 2, 3, 5, 8, 12]` — exactly the range the
deleted cap guaranteed, which is why they stayed green.

Past the ceiling the FIRING models are now a subset of 40, spread through the cone by
`slotOf` rather than taken off its tip, so the volley still comes from the whole squadron.
At or below 40 models `slotOf(i) === i` and the schedule is byte-identical to before.
Measured after: 12 → 36 rounds at 0.1355s, 40 → 40 at 0.0690s, 60 → 40 at 0.0896s spanning
slots 0–58, 200 → 40 at 0.0853s spanning 0–195. The size list in the tests now reaches
`[…, 18, 39, 40, 41, 60, 200]`, and a new test holds the spread.

**Two costs are accepted rather than fixed, and they are pre-existing.** A squadron's only
hit target is one invisible sphere at its centroid of radius `max(0.45, scale × 1.6)`, and
the formation radius grows as `sqrt(i)`: at 12 markers it was already 0.73 against a 0.47
sphere, and at 200 it is 3.10. Craft aim is the same shape — `formationAimDirection` points
each model at the target from its own offset, so an edge craft in a wide formation points
inward during the ten-second hold. Both were true before this change and both are now
larger. Neither is a break; if the tap becomes a real complaint the answer is sizing the
sphere to the formation, which is two lines.

**And the per-marker cost multiplies across foreign traffic, not just your own fleet.**
Composition is public (D24) and `contactMarkers` draws a stranger's squadron the same way,
while `galaxyTraffic` projects every in-flight mission in the season onto every client with
no limit. Twenty simultaneous 100-ship raids in a 300-commander galaxy is roughly 400
markers on one disc. Capping foreign contacts would recreate exactly the lying picture this
decision removes, one screen removed from the player, so it is not done — but this is the
number to watch first if the disc drops frames, and it has not been measured on a phone.

**And the launch sheet says where the rest of the fleet is.** `planet.fleet` is what is
standing on the world, which is the right thing to offer — nothing in the air can be
launched again — but a hull entirely away loses its row, so the sheet read as a fleet that
had shrunk with nothing on it to say why. Flights are twelve minutes and up; the player who
sent one has often forgotten. One caption now names what is out: "83 Wasp · 2 Hauler still
in flight." MOBILE hulls only, because `fleetAway` also carries Prospectors on a mining run
and this sheet can never send one.

The caption may not promise a return, and the first draft did: `fleetAway` is every unit of
the world whose `location` is not `home`, which includes transfer and settlement fleets —
`resolveTransfer` and `resolveSettlement` hand those to the destination world for good. "You
cannot send them until they are back" was therefore false for every one-way mission. It
states what is true of all of them instead: they are away, and only what is standing here
can be sent.

Forced by the same line: the empty-hangar sentence tested `fleetCount(planet.fleet) === 0`,
and `fleet` carries the Prospector — so a world whose only craft at home was a miner showed
an empty list with no sentence under it, which is exactly the confusion the caption exists
to end. It counts MOBILE hulls at home now. Three tests hold the three cases.

### D116 · A deploy stops the world only when the release forces it — owner instruction

**The runbook took downtime on every release, and almost none of them needed it.** Its stop
existed for two reasons and both are conditional: the final dump has to be a rollback boundary
no player write can be newer than (rule 4), and no process may span a migration (rule 5). A
release that applies no DDL has neither problem — it never rolls the database back at all, it
rolls the IMAGE and the WEBROOT back, and rule 10 retains both. The third reason, keeping Nginx
down while the client is replaced (rule 7), is a property of replacing files IN PLACE; renaming
a fully-built directory into place closes the same window with two renames on one filesystem.

**Step 6 is now a gate that is answered from the release, not from habit.** Four things force a
stop: pending DDL, old and new server code that cannot both be live (a removed or reshaped route,
a changed event kind), a worker that must not process events under old code, and a data repair or
season operation riding along. Each row says how to CHECK it — step 5 already runs `migrate` with
the new image against the restored production shape, so "is there DDL" is a measurement, and
`git diff --stat "$previous..$release" -- apps/server packages/rules` answers the second. None
true takes the rolling path; any true takes the quiesced one; both converge on internal
acceptance and the external proof, which did not move.

**The rolling path leans on what the vhost already does.** Nginx balances `least_conn` across the
three API replicas with `max_fails=2 fail_timeout=5s`, so it routes around one that is restarting.
Replicas go one at a time and each must be healthy AND reporting the release SHA before the next
is touched — two down out of three is a capacity event even when it is not an outage. The worker
is a singleton and cannot be rolled: it takes a real ten-to-twenty-second gap, which is not
user-facing because a scheduled event is claimed with `SKIP LOCKED` and simply runs that late,
the same lateness `WORKER_POLL_MS` already admits. It goes last, so the APIs are already on the
new image when it returns. Rule 1's single-SHA identity is unaffected — all four containers, the
image label, both git refs and the web release marker still have to agree.

**First used for D115, with 16 commanders mid-session.** Client-only release, no DDL: the
rehearsal left the restored copy at 31 migrations, which is the measurement rule 5 now asks for.
All four containers rolled to `31f4c0c` and stayed healthy, the public root answered 200 at every
step including across the webroot rename, and the eight identities agreed afterwards. The world
kept running through it: in-flight missions held at 13 while mining runs went 2 → 3 and build
orders 1 → 4. That last part is the acceptance note step 11 now carries — on a rolling release
the after-counts should be HIGHER than the before-counts, and a set that did not move while
players were active is itself worth investigating.

### D117 · A laden Prospector flies home at a third of its outbound speed — owner instruction

**The choice was between slowing the return leg and putting a cooldown on the craft, and the
structure decided it.** The return leg has exactly one writer — `resolveMiningArrival` computes
`prospectorTravelExact(distance, speed)` and stores `homeAt` — and every consumer reads that
stored instant rather than recomputing a speed: the owner's craft interpolates `arriveAt →
homeAt` in `runPosition`, the public contact is built from the same two instants in
`projectGalaxyTraffic`, the countdown comes off the instant, and the `mining_return` event is
scheduled at it. So one line moves the whole system, and the delicate part — the continuous-time
interception solver — is outbound only and is not touched at all.

A cooldown would have needed a refusal code with localised figures, an absolute `readyAt` on the
payload, and a countdown surface, because a control may never offer what the server will refuse.
It would also have been a second rationing system on top of `PROSPECTOR.max`, and it would have
rationed by making the player wait at a screen with nothing on it — which the second feel test
forbids outright. The slower leg keeps the cost visible and moving: the craft is drawn for the
owner and for the galaxy every minute of it, and it holds a flight bay throughout.

**`PROSPECTOR.returnSpeedFactor` is 1/3, and it is a RATIO for D63's reason.** It multiplies the
SPEED, not the trip, so only the travel term moves — `prospectorTravelExact` is
`launchMinutes + travel`, and turning around at a rock does not make the approach to your own
world take longer. Four sites read it through one helper, `prospectorReturnSpeed`, because the
server and the simulator have to agree: the return leg itself, the season-end guard on a mining
launch, the season-end guard on a harvest launch, and the simulator's own turn-around plus the
rock-scoring its bots do (they rank rocks by yield per minute of the whole round trip, so a leg
they do not fly makes them choose wrong).

**The salvage run pays it too.** Owner decision. Both kinds of run turn around through the same
line, so it holds without a branch, and a test exists to notice if somebody adds one.

**MEASURED, AND IT DOES NOT DO WHAT IT LOOKS LIKE IT DOES.** Five seeds, 50 players, 14 days,
against the same seeds at the old symmetric speed:

| | launches | ore claimed |
|---|---|---|
| symmetric (old) | 6,849 | 3,524,500 |
| a third (new) | 6,865 | 3,524,000 |

That is 0.01% less ore, which is noise. The reason is the one `PROSPECTOR.launchMinutes` already
records from D43: the galaxy's mining income is bounded by the ore that EXISTS against a demand
two orders of magnitude larger, so a longer round trip changes WHO reaches a rock first and how
long they are committed, not what the field yields. **Do not cite this change as a mining nerf.**
What it buys is commitment — a bay held three times as long, and a craft in the open for the
whole of it. The season gate stayed green on all five seeds with the bands unchanged, and the
only red assertion is still D112's.

The usual simulator caveat applies and is sharper here than elsewhere: its bots relaunch the
moment a craft lands, so they model the field emptying rather than a person deciding whether the
trip is worth it. The structural argument above does not depend on that; the human effect does.

**Two tests were bending on a symmetry that is no longer true.** `contract.test.ts` and
`notifications.test.ts` both reached the return by advancing `run.flightMinutes + 1` — the
OUTBOUND time — so they stopped short of the landing and found no notification. Both read the
stored `homeAt` now, which is what schedules the event and is immune to the next change.

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
