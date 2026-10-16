import { localized as l, type WikiArticle } from './model.js';
import { topic } from './concepts.js';
export const galaxyArticles: readonly WikiArticle[] = [
  topic('galaxy', 'vacation', l('Vacation mode', 'Tatil modu'),
    l('Pause and protect your capital and every colony for 1–7 days, paid in deuterium.', 'Ana gezegenini ve bütün kolonilerini döteryum karşılığında 1–7 gün duraklat ve koru.'),
    l([
      'Open Vacation mode from the menu. Every world must enter together. Incoming and outgoing flights must finish, including clan war and support fleets in both directions. Development queues may remain; they pause with their remaining work.',
      'Each world’s Command Core level is rounded up to the next even level. Use that level’s basic hourly Deuterium Refinery output: 12 hours per vacation day for the capital and 6 hours for each colony. For a Core 17 capital and Core 12 and 15 colonies, two days cost R(18) × 24 + R(12) × 12 + R(16) × 12, where R is hourly output. The total is rounded up. Payment comes first from the capital’s Store, then its Works; colonies are never charged directly.',
      'Attacks and probes are blocked on every world. Production, development, repairs, faults, loyalty and personal damage processes pause. You cannot launch missions, collect resources, transfer fleets or resources, or take other gameplay actions. Chat and existing reports remain available. The season and galaxy events continue.',
    ], [
      'Menüden Tatil modunu aç. Bütün gezegenler birlikte geçer. Gelen ve giden seferler bitmeli; ortak klan filosundaki ve iki yöndeki destek gemileri dönmüş olmalı. Geliştirme kuyrukları kalabilir; kalan süreleriyle duraklatılır.',
      'Her gezegenin Komuta Çekirdeği seviyesi bir sonraki çift seviyeye yuvarlanır. O seviyedeki Döteryum Rafinerisinin temel saatlik üretimi kullanılır: günlük ana gezegen için 12, her koloni için 6 saat. Ana gezegen 17, koloniler 12 ve 15 seviyedeyse iki günün bedeli R(18) × 24 + R(12) × 12 + R(16) × 12 olur; R saatlik üretimdir. Toplam yukarı yuvarlanır. Ödeme önce ana gezegenin Depo döteryumundan, eksik kalırsa Havuzundan alınır; kolonilerden alınmaz.',
      'Bütün gezegenlerin saldırı ve sondadan korunur. Üretim, geliştirmeler, onarım, arıza, sadakat ve kişisel hasar süreçleri durur. Sefer başlatamaz, kaynak toplayamaz, filo veya kaynak aktaramaz ve diğer oyun eylemlerini yapamazsın. Sohbet ve mevcut raporlar açık kalır. Sezon ve galaksi etkinlikleri devam eder.',
    ]), l([
      'Vacation must end at least 24 hours before the season ends; it cannot be bought in the last 24 hours. With exactly two days remaining, at most one day is available. Pausing a queue must not move its completion past the season end.',
      'Return at any time using End vacation; unused time is not refunded. Protection ends immediately on every world and queues resume where they stopped. At scheduled or early return, production, faults and loyalty resume and a fresh 30-hour Silent Space inactivity window begins. Vacation time never becomes catch-up production or damage.',
    ], [
      'Tatil sezon bitiminden en az 24 saat önce biter; son 24 saatte satın alınamaz. Tam iki gün kalmışsa en fazla bir gün alınabilir. Kuyruğu duraklatmak da emrin tamamlanmasını sezon dışına taşıyamaz.',
      'Tatili bitir ile istediğin zaman dönebilirsin; kalan sürenin ücreti iade edilmez. Bütün gezegenlerin koruması hemen kalkar ve kuyruklar kaldığı yerden sürer. Erken veya otomatik dönüşte üretim, arıza ve sadakat süreçleri yeniden çalışır; Silent Space için yeni 30 saat başlar. Tatilde geçen zaman sonradan topluca üretim veya hasar olarak işlenmez.',
    ]), ['economy.resources', 'fleet.flights']),
  topic('galaxy', 'mining', l('Asteroids & mining', 'Asteroitler ve madencilik'),
    l("Send Prospectors to moving asteroids or debris. Compare available resources, hold capacity and return time, then collect the load.", "Hareketli asteroitlere veya enkaza Kazıcı gönder. Kalan kaynağı, ambarı ve dönüş süresini karşılaştır; gelen yükü topla."),
    l([
      "A Prospector flies to the predicted meeting point of a moving asteroid. It takes the resources remaining on arrival and returns. Other commanders can arrive first and take them. Discovery does not reserve an asteroid or its resources.",
      "Ordinary asteroids contain alloy and crystal. [[research.ISOTOPE_SPECTROMETRY|Isotope Spectrometry]] opens deuterium mining from isotope asteroids. Prospectors can also collect resources from revealed debris fields left by battles.",
      "Mining capacity uses Prospector Holds research and the origin’s Derrick. Ordinary Cargo Holds does not affect Prospectors. A loaded return is slower than an empty return. If an asteroid is emptied before you arrive, your inbound craft turn home.",
    ], [
      "Kazıcı, hareketli asteroitle hesaplanan buluşma noktasına uçar. Varışta kalan kaynakları alır ve döner. Başka komutanlar önce varıp kaynakları tüketebilir. Keşif, asteroidi veya kaynaklarını sana ayırmaz.",
      "Normal asteroitler alaşım ve kristal içerir. [[research.ISOTOPE_SPECTROMETRY|İzotop Spektrometrisi]], izotop asteroitlerinden döteryum toplamayı açar. Kazıcılar, savaşlardan kalan keşfedilmiş enkaz sahalarından da kaynak toplayabilir.",
      "Maden kapasitesini Kazıcı Ambarları araştırması ve çıkış gezegenindeki Matkap artırır. Gemi Ambarları araştırması Kazıcıyı etkilemez. Yüklü dönüş, boş dönüşten yavaştır. Asteroit sen varmadan boşalırsa yoldaki Kazıcıların eve döner.",
    ]),
    l([
      "Choose the craft count against remaining resources, hold capacity and a free flight bay. More capacity only helps if resources remain when you arrive. Include both legs when comparing missions.",
      "You can recall an outbound mining mission. Returning resources enter the [[economy.collectors|Works]] within its capacity and must be collected before spending. Make room before several loads return. Very short trips can require a cooldown before the craft fly again.",
    ], [
      "Kazıcı sayısını kalan kaynak, taşıma kapasitesi ve boş uçuş rampasına göre seç. Büyük ambar, varışta kaynak kalırsa daha çok yük getirir. Görevleri karşılaştırırken gidişi ve dönüşü birlikte değerlendir.",
      "Gidişteki madencilik görevini geri çağırabilirsin. Dönen kaynaklar kapasitesi dahilinde [[economy.collectors|Havuza]] eklenir; harcamadan önce toplamalısın. Birkaç yük dönmeden yer aç. Çok kısa seferlerden sonra Kazıcıyı yeniden göndermek için beklemek gerekebilir.",
    ]), ['hull.PROSPECTOR', 'satellite.DERRICK', 'economy.collectors']),
  topic('galaxy', 'pirates', l('Pirate encounters', 'Korsan karşılaşmaları'),
    l("Intercept a moving pirate fleet before it leaves. Compare its ships, damage multiplier and possible rewards with your fuel and losses.", "Hareketli korsan filosunu ayrılmadan yakala. Gemilerini, hasar çarpanını ve olası ödülleri kendi yakıtınla ve kayıplarınla karşılaştır."),
    l([
      "Pirates are moving combat targets that remain for a limited time. Sensors affect which details you can see. Each level uses the damage multiplier below. The preview calculates where your fleet can meet the pirates, rather than flying to their old position.",
      "Send at least one armed ship from a free flight bay, with round-trip fuel. Your slowest ship must reach the pirates before they leave. A successful attack can bring resources. Only a decisive victory has the listed chance of capturing a ship.",
    ], [
      "Korsanlar, sınırlı süre kalan hareketli savaş hedefleridir. Sensörlerin görebildiğin ayrıntıları etkiler. Her seviye aşağıdaki hasar çarpanını kullanır. Önizleme, eski konuma uçuş yerine filonun korsanlarla buluşabileceği noktayı hesaplar.",
      "En az bir savaş gemisi, boş uçuş rampası ve gidiş-dönüş yakıtı gerekir. En yavaş gemin korsanlar ayrılmadan yetişebilmelidir. Başarılı saldırı kaynak getirebilir. Yalnız kesin zaferde, belirtilen olasılıkla gemi ele geçirilebilir.",
    ]),
    l([
      "Compare visible ships and [[combat.counters|classes]] with your force. Cargo is needed to carry the reward. A slow transport can add capacity but prevent the fleet from reaching the target in time.",
      "You can [[fleet.flights|recall a pirate raid]] once before combat. After combat, victory and captured ships are not guaranteed. Pirate attacks do not transfer PvP Dominion. Check current route, fuel and time before launching.",
    ], [
      "Görünen gemileri ve [[combat.counters|sınıfları]] kendi kuvvetinle karşılaştır. Ödülü taşımak için kargo gerekir. Yavaş nakliyeci kapasite eklese de filonun zamanında yetişmesini engelleyebilir.",
      "Korsan akınını çatışmadan önce bir kez [[fleet.flights|geri çağırabilirsin]]. Saldırı, zaferi veya gemi ele geçirmeyi garanti etmez. Korsan saldırıları oyuncular arasındaki Hâkimiyet puanını aktarmaz. Göndermeden önce güncel rota, yakıt ve süreyi kontrol et.",
    ]), ['combat.counters', 'fleet.flights', 'intel.overview']),
  topic('galaxy', 'trade', l('Trading with the merchant', 'Tüccarla ticaret'),
    l("Trade resources with the merchant at equal value. Check both cargo loads, flight fuel and arrival before the merchant leaves.", "Tüccarla eşit değerde kaynak değiştir. İki yönün kargosunu, uçuş yakıtını ve tüccar ayrılmadan varışını kontrol et."),
    l([
      "The merchant’s position and exchange rates are visible to the galaxy. Give one resource and receive others of equal trade value. The merchant charges no fee and sets no trade quota. Only Courier, Wayfarer, Atlas and Argosy provide trade cargo capacity.",
      "Both the offered resources and the return load must fit your transports. Trading deuterium for alloy or crystal can produce a larger resource count. Check return capacity as well as outbound capacity. Offered resources leave your Store at launch; fuel is paid separately.",
    ], [
      "Tüccarın konumu ve değişim oranları galakside görülebilir. Bir kaynağı, eşit ticaret değerindeki diğer kaynaklarla değiştirirsin. Tüccar ücret almaz ve ticaret kotası uygulamaz. Ticaret kargosunu yalnız Kurye, Seyyah, Atlas ve Argosi taşır.",
      "Hem vereceğin kaynaklar hem dönüş yükü nakliyecilere sığmalıdır. Döteryumu alaşıma veya kristale çevirmek daha fazla kaynak birimi oluşturabilir. Gidişle birlikte dönüş kapasitesini kontrol et. Verdiğin kaynak gönderimde Depodan çıkar; yakıt ayrıca ödenir.",
    ]),
    l([
      "Select the merchant, choose transports and set the resources to give and receive. Your fleet must meet the merchant before departure. You can recall before reaching the merchant. The convoy brings the surviving offer home without trading; fuel stays spent. You can send more convoys while earlier fleets are away if you have ships, fuel and free flight bays.",
      "Ships and cargo in transit cannot be raided as home stock, but cannot defend home either. Include the unprotected stock and ships left on the origin planet in your plan. Trading changes which resources you hold; it does not add free trade value.",
    ], [
      "Tüccarı seç, nakliyecileri ekle ve vereceğin kaynakla alacağın miktarları belirle. Filon, tüccar ayrılmadan buluşmalıdır. Tüccara varmadan geri çağırabilirsin. Konvoy, sağ kalan gemilerdeki teklifini takas etmeden eve getirir; yakıt iade edilmez. Gemin, yakıtın ve boş uçuş yuvan varsa önceki filolar dışarıdayken yeni konvoy gönderebilirsin.",
      "Uçan gemiler ve kargolar, gezegendeki kaynaklar gibi yağmalanamaz; gezegeni de savunamaz. Çıkış gezegeninde kalan korumasız kaynakları ve gemileri hesaba kat. Ticaret, kaynak türlerini değiştirir; ücretsiz ek ticaret değeri oluşturmaz.",
    ]), ['research.CARGO_HOLDS', 'hull.COURIER', 'galaxy.events']),
  topic('galaxy', 'convoys', l('Intergalactic Convoy', "Galaksilerarası Konvoy"),
    l("Attack the Intergalactic Convoy once per planet during a crossing. Compare firepower, cargo capacity, production limits and ship reward chance.", "Galaksilerarası Konvoya, geçiş başına her gezegenden bir kez saldır. Ateş gücünü, kargoyu, üretim sınırını ve gemi ödülü olasılığını karşılaştır."),
    l([
      "The Intergalactic Convoy crosses the galaxy at scheduled times. Send at least one armed ship to meet it during the event. It does not return fire, but route radiation can still damage your fleet.",
      "Each planet can complete one attack per crossing. While an attack from that planet is away, you cannot launch another against the convoy. The attack cannot be recalled, and you pay both legs’ fuel when sending it.",
      "Firepower affects reward quality and the chance of a ship prize. Surviving cargo capacity limits resources brought home. The maximum resource reward also depends on origin-planet production and the event’s production-hour limit. A ship prize is not guaranteed.",
    ], [
      "Galaksilerarası Konvoy, takvimde belirtilen saatlerde galaksiden geçer. Etkinlik sürerken buluşmak için en az bir savaş gemisi gönder. Konvoy karşı ateş açmaz; rota radyasyonu yine filona hasar verebilir.",
      "Her gezegen, bir geçişte bir saldırı tamamlayabilir. O gezegenden konvoya gönderilen görev varken ikinci saldırı başlatılamaz. Saldırı geri çağrılamaz. Gidiş ve dönüş yakıtı gönderimde ödenir.",
      "Ateş gücü, ödül kalitesini ve gemi kazanma olasılığını etkiler. Eve gelen kaynak, sağ kalan kargo kapasitesiyle sınırlıdır. Azami kaynak ödülü, çıkış gezegeninin üretimine ve etkinliğin üretim saati sınırına da bağlıdır. Gemi ödülü garanti değildir.",
    ]),
    l([
      "Review firepower, cargo, production limit, fuel and return time together. Adding warships without cargo room can raise potential reward without increasing what you actually carry home.",
      "The convoy moves, so check the current meeting time before sending. Review radiation losses and the defence left at home. A target that does not fire can still have a costly route.",
    ], [
      "Ateş gücünü, kargoyu, üretim sınırını, yakıtı ve dönüş süresini birlikte incele. Kargo eklemeden savaş gemisi eklemek, olası ödülü artırsa da eve taşınan miktarı artırmayabilir.",
      "Konvoy hareket ettiği için göndermeden önce güncel buluşma zamanını kontrol et. Radyasyon kayıplarını ve gezegeninde kalan savunmayı incele. Hedef ateş açmasa da uçuşun bedeli ve riski vardır.",
    ]), ['galaxy.events', 'fleet.flights', 'galaxy.radiation']),
  topic('galaxy', 'monuments', l('Holding a monument', 'Anıt tutmak'),
    l("Win control of a monument, earn deuterium with armed ships and free cargo room, and recall before radiation destroys your fleet.", "Anıtın kontrolünü kazan. Savaş gemileri ve boş kargoyla döteryum biriktir; radyasyon filonu yok etmeden geri çağır."),
    l([
      "Monuments are public positions contested by players. Each has fleet capacity, deuterium production and radiation. Some names honour leading commanders from the previous season. To hold one, defeat its neutral garrison or the hostile fleet already there.",
      "Capture requires clearing the whole defence and keeping an armed ship able to fight. Cargo alone can retain existing control. A partial or repelled attack can earn positive Dominion without capturing the monument. The battle report states control, grade, ship losses and score separately. Later radiation losses do not change that historical result.",
      "There are four Easy and four Hard monuments. Easy accepts new fleets from commander tiers 1–3; Hard accepts tiers 4 and above. Your highest current world’s Command Core determines your tier, one tier per three Core levels. If you rise above tier 3, an existing Easy fleet continues, but you cannot send new ships, including cargo.",
      "You can send combat and cargo reinforcements while earlier fleets are outbound, holding or returning. Each dispatch consumes its own fuel and flight bay. Friendly support must fit the monument’s available capacity. Recalling a fleet does not return its ships to your home until the return flight lands.",
      "A fleet in flight does not turn back when the monument changes hands. On arrival it meets the monument as it is then. If your side holds it, the fleet joins and ships that do not fit return. If a rival or the neutral garrison holds it, the fleet fights. If it is empty, an armed ship takes it; cargo alone cannot and returns.",
      "Moving monuments rotate horizontally in 8 hours and vertically in 16 hours. Your fleet flies to their predicted arrival position. Launch pays the outbound cost and reserves the maximum return fuel. Recall prices the actual return. Each ship’s unused reserve is refunded only when it reaches home; ships that never return lose their share. Joint clan fleets also reserve their future monument flight until the combined departure.",
      "Armed-ship power determines your share of production. Deuterium fills free cargo room on your ships. If only unarmed transports survive, they earn no production. Full holds stop collecting. Ships keep their owners, damage and research; clanmates can fight on the same side.",
      "Eligible friendly fleets reserve capacity before arrival. You can attack a full monument with a fleet larger than its capacity: the entire fleet fights. After a victory, higher-tier ships fit first and excess survivors return. Incoming enemy fleets can change the production share and expected losses.",
    ], [
      "Anıtlar, oyuncuların kontrolü için savaştığı herkese açık konumlardır. Her anıtın filo kapasitesi, döteryum üretimi ve radyasyonu vardır. Bazı adlar önceki sezonun önde gelen komutanlarından alınır. Tutmak için tarafsız garnizonu veya anıttaki düşman filosunu yenmelisin.",
      "Dört kolay ve dört zor anıt vardır. Kolay anıtlara Tier 1–3 komutanları yeni filo gönderebilir; zor anıtlara yalnız Tier 4 ve üzeri komutanları yeni filo gönderebilir. Tier, mevcut en gelişmiş gezegenindeki Komuta Çekirdeğinin her üç seviyesinde artar. Tier 3’ü aşarsan kolay anıttaki mevcut filon devam eder, fakat kargo dahil yeni gemi gönderemezsin.",
      "Anıtı ele geçirmek için savunmanın tamamını temizlemeli ve savaşabilecek bir savaş gemisini hayatta tutmalısın. Yalnız yük gemileri mevcut kontrolü koruyabilir. Kısmi veya püskürtülen saldırıda Hâkimiyet kazanabilir ama anıtı ele geçiremeyebilirsin. Rapor kontrolü, çatışma derecesini, gemi kayıplarını ve puanı ayrı gösterir. Sonraki radyasyon kayıpları geçmiş savaş sonucunu değiştirmez.",
      "Önceki filolar yoldayken, anıtta beklerken veya dönerken savaş ve yük gemisi desteği gönderebilirsin. Her gönderim kendi yakıtını ve uçuş yuvasını kullanır. Dost desteği anıttaki boş hacme sığmalıdır. Geri çağırdığın gemiler ancak dönüş uçuşu bitince gezegenine gelir.",
      "Anıt yolda el değiştirse de filon geri dönmez. Varışta anıtın o anki durumuyla karşılaşır. Anıtı tarafın tutuyorsa katılır; sığmayan gemiler döner. Rakip veya tarafsız garnizon tutuyorsa savaşır. Anıt boşsa savaşabilen bir gemi onu ele geçirir; yalnız yük gemileri ele geçiremez ve geri döner.",
      "Hareketli anıtlar yatayda 8, dikeyde 16 saatte döner. Filon tahmini varış konumuna uçar. Gönderimde gidiş bedeli ödenir; en uzak dönüş için yakıt ayrılır. Geri çağırırken gerçek dönüş bedeli hesaplanır. Her geminin kullanılmayan payı yalnız o gemi eve varınca iade edilir; dönemeyen geminin payı yanar. Klan ortak filolarında, birleşik kalkışa kadar anıta uçuş için de rezerv tutulur.",
      "Savaş gemilerinin gücü, üretimden alacağın payı belirler. Döteryum, gemilerinin boş ambarlarına yüklenir. Yalnız silahsız nakliyeciler sağ kalırsa üretimden pay alamazlar. Ambar dolunca toplama durur. Gemiler sahiplerini, hasarlarını ve araştırmalarını korur; klan arkadaşları aynı tarafta savaşabilir.",
      "Uygun dost filoları için varıştan önce kapasite ayrılır. Dolu anıta kapasiteden büyük filoyla saldırabilirsin; filonun tamamı savaşır. Zaferden sonra yüksek kademeli gemiler önce yerleşir; sığmayan sağ kalanlar döner. Gelen düşman filoları, üretim payını ve beklenen kayıpları değiştirebilir.",
    ]),
    l([
      "Before sending, check flight damage, expected arrival health, available capacity and the next predicted ship loss. Radiation continues while holding the monument. A full cargo load may be lost if its ship is destroyed.",
      "Recall selected ships to bring their deuterium home. Monument probes face the stated loss chance; survivors give an exact observation-time fleet snapshot. Ordinary battle reports do not reveal the opponent’s remaining fleet. Holding ends when the season closes.",
    ], [
      "Göndermeden önce uçuş hasarını, beklenen varış sağlığını, boş kapasiteyi ve sonraki gemi kaybı tahminini kontrol et. Anıtta kalırken radyasyon sürer. Taşıyan gemi yok olursa içindeki yük de kaybolabilir.",
      "Gemilerini seçip geri çağırarak döteryumu eve getir. Anıt sondaları belirtilen olasılıkla kaybolur; sağ kalanlar gözlem anındaki kesin filo bilgisini verir. Normal savaş raporları rakibin kalan filosunu açıklamaz. Sezon bitince anıtta kalma sona erer.",
    ]), ['galaxy.radiation', 'intel.probes', 'clan.joint-war']),
  topic('galaxy', 'radiation', l("Radiation & ship damage", "Radyasyon ve gemi hasarı"),
    l("Check radiation at a monument and plan your recall before ships and cargo are lost.", "Anıttaki radyasyonu kontrol et; gemi ve kargo kaybından önce geri çağırmayı planla."),
    l([
      "In galaxies with moving monuments, radiation damages ships while they hold the affected monument. Flying through an aura causes no radiation damage. Damage follows the monument even when its position changes.",
      "Radiation Bombs add a separate 30-minute source to a planet or monument. L1 deals 9, L2 12.5 and L3 18 HP/min per ship. Sources add up to at most 50 HP/min before protection. Each hit keeps its own expiry.",
      "On colonies, a successful L1/L2/L3 hit also removes 5/10/15 loyalty points and causes up to 0/1/2 new random faults. Aegis does not block these colony effects. Active faults cannot repeat; the Core requirement and fault protection still apply. A hit that reduces loyalty to zero makes the colony neutral without adding new faults. Capitals, neutral worlds and monuments do not receive this colony payload.",
      "Each active Aegis level reduces radiation damage to ships on its planet by 1 HP/min. Each ship’s Radiation Shielding further reduces the remaining damage. Aegis protects home ships, the workshop and visiting clan fleets. It needs at least 1 shield HP. After battle depletion, recharge waits 15 minutes; EMP blocks it for an hour. Aegis does not protect ships at monuments.",
      "Aegis absorbs damage without removing radiation. Green haze and source timers remain visible even at zero incoming damage. Repairs and scrapping work while Aegis blocks all radiation; damage getting through cancels repairs with a full refund and closes those actions. Ships can still leave the workshop for evacuation.",
      "Radiation sources on the same target can add damage. The monument sheet shows HP lost per ship per minute and the next expected casualty. Galaxies that have not enabled monument movement retain their earlier flight radiation rules; check the flight preview.",
      "[[research.RADIATION_SHIELDING|Radiation Shielding]] reduces fixed HP/min damage through four levels. Each ship loses the same absolute HP at the same source and protection level, so stronger hulls last longer. Protection is saved when the fleet is sent; later research does not upgrade an existing flight or garrison.",
    ], [
      "Hareketli anıtların olduğu galaksilerde radyasyon, etkilenen anıtta bekleyen gemilere hasar verir. Auradan uçarak geçmek radyasyon hasarı vermez. Anıtın konumu değişse de hasar anıta bağlı kalır.",
      "Radyasyon Bombası gezegene veya anıta ayrı bir 30 dakikalık kaynak ekler. L1 gemi başına 9, L2 12,5 ve L3 18 HP/dk hasar verir. Koruma öncesinde kaynakların toplamı en fazla 50 HP/dk olur. Her isabet kendi süresinde biter.",
      "Kolonide başarılı L1/L2/L3 isabeti ayrıca 5/10/15 sadakat puanı düşürür ve en fazla 0/1/2 yeni rastgele arıza oluşturur. Aegis bu koloni etkilerini engellemez. Aktif arızalar tekrarlanmaz; Çekirdek gereksinimi ve arıza koruması geçerlidir. Sadakati sıfırlayan isabet yeni arıza eklemeden koloniyi tarafsızlaştırır. Ana gezegen, tarafsız gezegen ve anıta bu koloni etkileri uygulanmaz.",
      "Her aktif Aegis seviyesi, bu gezegendeki gemilerin radyasyon hasarını 1 HP/dk azaltır. Her geminin Radyasyon Kalkanı araştırması, kalan hasarı ayrıca azaltır. Aegis evdeki gemileri, tamirhaneyi ve konuk klan filolarını korur. En az 1 kalkan canı gerekir. Savaşta sıfırlanınca dolum 15 dakika bekler; EMP dolumu bir saat engeller. Anıttaki gemilere Aegis koruması uygulanmaz.",
      "Aegis hasarı engeller ama radyasyonu kaldırmaz. Gemilere hasar ulaşmasa da yeşil sis ve kaynak süreleri görünür. Aegis bütün radyasyonu engellerken onarım ve parçalama çalışır; hasar geçmeye başlarsa onarımlar tam iade ile iptal olur ve bu işlemler kapanır. Tahliye için gemileri tamirhaneden hangara geri alabilirsin.",
      "Aynı hedefteki radyasyon kaynaklarının hasarı birleşebilir. Anıt ekranı, gemi başına dakikalık HP kaybını ve sonraki gemi kaybı tahminini gösterir. Anıt dönüşü açılmamış galaksilerde önceki uçuş radyasyonu kuralları sürer; uçuş önizlemesini kontrol et.",
      "[[research.RADIATION_SHIELDING|Radyasyon Kalkanı]], dört seviyede sabit HP/dk hasarını azaltır. Aynı kaynak ve korumada her gemi aynı miktarda HP kaybeder; canı yüksek gemi daha uzun dayanır. Koruma, filo gönderilirken kaydedilir; sonraki araştırma mevcut uçuşu veya anıtta bekleyen filoyu güçlendirmez.",
    ]),
    l([
      "Check remaining health and the next expected loss while holding. Each destroyed ship loses its own cargo and unused fuel reserve. Recall before losses prevent your fleet from fighting or bringing resources home.",
      "Read the radiation-loss confirmation before launching. Heavily damaged survivors need the [[fleet.repairs|Repair Station]]. Reports distinguish radiation damage from damage caused by combat.",
    ], [
      "Beklerken kalan sağlığı ve sonraki kayıp tahminini kontrol et. Yok olan geminin kendi kargosu ve kullanılmayan yakıt rezervi de kaybolur. Kayıplar filonun savaşmasını veya kaynak taşımasını engellemeden geri çağır.",
      "Göndermeden önce radyasyon kaybı onayını oku. Ağır hasarlı dönen gemiler [[fleet.repairs|Tamirhanede]] onarılmalıdır. Raporlar radyasyon hasarıyla savaş hasarını ayırır.",
    ]), ['galaxy.monuments', 'fleet.repairs', 'fleet.flights', 'research.RADIATION_SHIELDING']),
  topic('galaxy', 'events', l('Event calendar', 'Etkinlik takvimi'),
    l("Plan asteroid showers, merchant visits and convoy crossings with the weekly schedule in Türkiye time, UTC+3.", "Türkiye saatiyle, UTC+3 olarak gösterilen haftalık takvimden asteroit yağmurunu, tüccarı ve konvoy geçişlerini planla."),
    l([
      "The weekly schedule has different weekday and weekend times. All times below use Türkiye time, UTC+3. If your device uses another time zone, also check the in-game countdown.",
      "Asteroid showers increase new asteroid spawns during the event. Existing asteroids keep their resources and lifetimes. Merchant visits open resource exchanges. Convoy crossings offer one successful strike per planet. Each event has its own mission rules.",
    ], [
      "Haftalık takvimde hafta içi ve hafta sonu saatleri farklı olabilir. Aşağıdaki saatler Türkiye saatidir, UTC+3 kullanır. Cihazın başka saat dilimindeyse oyun içindeki geri sayımı da kontrol et.",
      "Asteroit yağmuru sırasında daha fazla yeni asteroit ortaya çıkar. Mevcut asteroitlerin kaynakları ve ömürleri değişmez. Tüccar geldiğinde kaynak değiştirirsin. Konvoy geçişinde her gezegenden bir başarılı saldırı yapılabilir. Her etkinliğin görev kuralları ayrıdır.",
    ]),
    l([
      "Open View → Galaxy events for the next event and weekly guide. Keep suitable ships and flight bays available for a short event. A calendar entry does not guarantee your fleet will arrive before the target leaves.",
      "Check the live interception time and remaining event duration. Near season end, new orders and missions must also fit the season’s remaining time.",
    ], [
      "Sonraki etkinliği ve haftalık rehberi görmek için Görünüm → Galaksi etkinliklerini aç. Kısa etkinlikler için uygun gemileri ve boş uçuş rampalarını hazır tut. Takvimde etkinlik olması, filonun hedef ayrılmadan yetişeceğini garanti etmez.",
      "Güncel buluşma zamanını ve kalan etkinlik süresini kontrol et. Sezon sonuna yakın yeni siparişler ve görevler, kalan sezon süresine de sığmalıdır.",
    ]), ['galaxy.mining', 'galaxy.trade', 'galaxy.convoys']),
];
