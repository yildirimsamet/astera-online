import { localized as l, type WikiArticle } from './model.js';
import { topic } from './concepts.js';
export const fleetAndIntelArticles: readonly WikiArticle[] = [
  topic('fleet', 'flights', l('Launching, fuel & recall', 'Gönderim, yakıt ve geri çağırma'),
    l("Plan fleet speed, fuel, flight-bay use and return time. Learn which missions you can recall and what happens to their fuel.", "Filo hızını, yakıtı, uçuş rampasını ve dönüş zamanını planla. Hangi görevleri geri çağırabileceğini ve yakıtın ne olduğunu öğren."),
    l([
      "Choose the origin planet, target, mission and ships. The slowest eligible ship sets fleet speed, with applicable research and orbital bonuses. Distance and fleet size affect the deuterium needed. If you send deuterium as cargo, leave enough for fuel too.",
      "You pay the quoted route’s fuel at launch. Slower speed delays arrival and return; it does not reduce fuel cost. The chosen speed also applies on return. Each slowed leg must fit the duration limit below; full speed remains available for longer crossings.",
      "A flight bay limits how many missions this planet can have away at once. Fleet and mining missions occupy a bay through their journey. Ordinary probes do not use these bays. Hangar room is a separate limit on the ships belonging to the planet.",
    ], [
      "Çıkış gezegenini, hedefi, görevi ve gemileri seç. Filonun hızını, geçerli araştırma ve yörünge bonuslarıyla en yavaş uygun gemi belirler. Mesafe ve filo büyüklüğü gereken döteryumu etkiler. Döteryum taşıyorsan uçuş yakıtına da yeterli miktarı ayır.",
      "Seçilen rotanın yakıtı gönderimde ödenir. Hızı düşürmek varışı ve dönüşü geciktirir; yakıt bedelini azaltmaz. Dönüşte de seçilen hız kullanılır. Yavaşlatılan her uçuş bölümü aşağıdaki süre sınırına uymalıdır. Tam hızdaki uzun uçuşlara bu sınır uygulanmaz.",
      "Uçuş rampaları, bir gezegenin aynı anda gönderebileceği görev sayısını sınırlar. Filo ve madencilik görevleri yolculuk boyunca bir rampa kullanır. Normal sondalar rampa kullanmaz. Hangar alanı ise gezegene ait gemilerin toplam kapasitesini sınırlar.",
    ]),
    l([
      "An outbound ordinary raid or planet transfer can be recalled once before arrival. Its return takes the time already flown. No extra fuel is charged and none is refunded. A returning fleet cannot turn again. Mining uses its own recall action; clan support can return while travelling or stationed.",
      "A pirate raid can be recalled once before combat. It turns at its current position and returns at its own speed, without battle or loot. Spent fuel is not refunded. Radiation can still damage its ships on return.",
      "Settlement, probes, Death Stars, trade and Intergalactic Convoy strikes cannot be recalled. You can recall a joint-war contribution before the shared strike starts; the launched strike cannot return early. Check the mission’s own confirmation and the defence left at home.",
    ], [
      "Gidişteki normal akın veya gezegen transferi, varıştan önce bir kez geri çağrılabilir. Dönüş, o ana kadar uçulan süre kadar sürer. Ek yakıt alınmaz; iade de yapılmaz. Dönüşteki filo tekrar yön değiştiremez. Madenciliğin ayrı geri çağırma eylemi vardır. Klan desteğini yoldayken veya konuşluyken çağırabilirsin.",
      "Korsan akınını çatışmadan önce bir kez geri çağırabilirsin. Filo bulunduğu konumdan kendi hızıyla geri döner; savaşmaz ve ganimet almaz. Harcanan yakıt iade edilmez. Dönüşte radyasyon gemilere hasar verebilir.",
      "Yerleşim, sonda, Ölüm Yıldızı, ticaret ve Galaksilerarası Konvoy saldırıları geri çağrılamaz. Ortak klan saldırısına gönderdiğin filoyu saldırı başlamadan geri çağırabilirsin. Başlayan ortak saldırı geri çağrılamaz. Görevin onayındaki koşulları ve gezegeninde kalan savunmayı kontrol et.",
    ]), ['worlds.transfers', 'galaxy.mining', 'building.HANGAR']),
  topic('fleet', 'repairs', l('Ship damage & the Repair Station', "Gemi hasarı ve Tamirhane"),
    l("Learn how ship damage affects future missions, which landing repairs are free and how to restore ships waiting in the Repair Station.", "Gemi hasarının sonraki göreve etkisini, ücretsiz iniş onarımını ve Tamirhanede bekleyen gemilerin nasıl onarıldığını öğren."),
    l([
      "Ships can survive battle or radiation and return damaged. Light damage is repaired free on landing. More heavily damaged ships wait in the Repair Station and cannot launch or defend until repaired.",
      "Every planet already has a Repair Station; you do not buy or upgrade it. Select damaged ships and place a repair order. Cost and duration depend on damage. Repairs have their own queue, separate from Construction and the Yard.",
    ], [
      "Gemiler savaştan veya radyasyondan sağ kalıp hasarlı dönebilir. Hafif hasar, inişte ücretsiz onarılır. Daha ağır hasarlı gemiler Tamirhanede bekler; onarılana kadar uçamaz ve savunmaya katılamaz.",
      "Her gezegende Tamirhane hazırdır; satın alman veya yükseltmen gerekmez. Hasarlı gemileri seçerek onarım siparişi ver. Bedel ve süre, hasar miktarına bağlıdır. Onarım sırası İnşaat ve Tersaneden ayrıdır.",
    ]),
    l([
      "Open Fleet and the Repair Station after a damaged return. Ships waiting for repair still occupy Hangar room. Cancelling a repair refunds only the normal cancellation share; it does not make the ship combat-ready.",
      "[[research.INDUSTRIAL|Industrial]] reduces repair cost and duration. It requires the stated level of Yard Automation. Compare repair with replacing lost ships, while keeping resources for fuel and immediate defence.",
    ], [
      "Hasarlı dönüşten sonra Filo bölümündeki Tamirhaneyi aç. Onarım bekleyen gemiler Hangar alanı kullanmaya devam eder. Onarımı iptal edersen yalnız normal iptal payı iade edilir; gemi savaşa hazır hale gelmez.",
      "[[research.INDUSTRIAL|Endüstri]], onarım bedelini ve süresini azaltır. Belirtilen Tersane Otomasyonu seviyesi gerekir. Gemileri onarmayı ve yenilerini üretmeyi karşılaştır; yakıt ve acil savunma için kaynak bırak.",
    ]), ['research.INDUSTRIAL', 'galaxy.radiation', 'building.HANGAR']),
  topic('combat', 'model', l('How a battle resolves', 'Savaş nasıl sonuçlanır?'),
    l("Understand combat rounds, shields, permanent losses and victory grades. Learn why attack power alone does not predict a battle.", "Savaş turlarını, kalkanı, kalıcı kayıpları ve sonuç derecelerini öğren. Tek saldırı gücü sayısının sonucu neden belirlemediğini anla."),
    l([
      "Combat has a limited number of rounds. Both sides fire in the same round. Only surviving combat-ready ships and ground defences fire. Attack, remaining hull strength, research and opposing classes affect damage. Shot variation can change a close result.",
      "An active Aegis absorbs damage before defending units. Nullifier’s extra shield damage affects only Aegis; it does not pass into ships. Without combat-ready defenders, Aegis alone cannot hold the planet. Prospectors do not take part in home defence.",
      "A decisive victory clears the defending force and its active battle shield, or takes an undefended target. Partial success destroys the required share of defending resource value without clearing everything. Otherwise, the attack is repelled. The outcome sets loot share and the production pause.",
    ], [
      "Savaş sınırlı sayıda turda sonuçlanır. İki taraf aynı turda ateş eder. Yalnız sağ kalan, savaşabilecek gemiler ve yer savunmaları ateş eder. Saldırı gücü, kalan dayanım, araştırmalar ve karşı sınıflar hasarı etkiler. Atışlardaki değişkenlik, yakın savaşlarda sonucu değiştirebilir.",
      "Aktif Aegis, savunmadaki birimlerden önce hasarı emer. Söndürücünün ek kalkan hasarı yalnız Aegis’e uygulanır; gemilere geçmez. Savaşabilecek savunmacı yoksa Aegis tek başına gezegeni savunamaz. Kazıcılar gezegen savunmasına katılmaz.",
      "Kesin zafer, savunmadaki kuvveti ve aktif savaş kalkanını ortadan kaldırır veya savunmasız hedefte elde edilir. Kısmi başarı, savunmanın toplam kaynak değerinin gereken payını yok eder. Bu koşul da sağlanmazsa saldırı püskürtülür. Sonuç, ganimet payını ve üretimin duracağı süreyi belirler.",
    ]),
    l([
      "Compare [[combat.counters|classes]], current damage, Aegis and support, as well as attack. Hull strength, also called HP, is how much damage a unit can take before destruction. Cargo ships do not fire and are protected while armed ships survive.",
      "Surviving cargo capacity is needed to take loot home. After combat, read permanent losses, damaged survivors and the resources actually returned. A victory grade does not by itself show whether the raid was profitable.",
    ], [
      "Saldırıyla birlikte [[combat.counters|sınıfları]], mevcut hasarı, Aegis’i ve desteği karşılaştır. Gövde dayanımı, yani HP, birimin yok olmadan alabileceği hasardır. Kargo gemileri ateş etmez; savaş gemileri hayattayken korunurlar.",
      "Ganimeti eve taşımak için sağ kalan kargo kapasitesi gerekir. Savaştan sonra kalıcı kayıpları, hasarlı gemileri ve gerçekten dönen kaynakları incele. Zafer derecesi tek başına akının kârlı olduğunu göstermez.",
    ]), ['combat.counters', 'combat.loot', 'instrument.AEGIS']),
  topic('combat', 'counters', l('The combat counter cycle', 'Savaş sınıfı döngüsü'),
    l("Compare Skirmisher, Bulwark and Lance advantages. Separate combat classes from shipyard categories and understand unarmed Support ships.", "Akıncı, Sur ve Mızrak sınıflarının üstünlüklerini karşılaştır. Savaş sınıfını Tersane kategorisinden ayır; silahsız Destek gemilerini öğren."),
    l([
      "Skirmisher deals increased damage to Bulwark, Bulwark to Lance, and Lance to Skirmisher. In the reverse direction, damage is reduced. Same-class fire has no class advantage. The table below shows the damage multipliers.",
      "Offensive, Defensive, Cargo and Specialist are shipyard categories. They are different from combat class. Read each unit’s class when selecting counters. Ground defences also use Skirmisher, Bulwark or Lance.",
    ], [
      "Akıncı, Sur sınıfına daha fazla hasar verir. Sur, Mızrak’a; Mızrak, Akıncıya daha fazla hasar verir. Ters eşleşmede hasar azalır. Aynı sınıflar arasında üstünlük yoktur. Aşağıdaki tablo hasar çarpanlarını gösterir.",
      "Saldırı, Savunma, Kargo ve Uzman, Tersane kategorileridir. Savaş sınıfıyla aynı şey değildir. Karşı kuvvete uygun gemi seçerken birimin sınıfına bak. Yer savunmaları da Akıncı, Sur veya Mızrak sınıfındadır.",
    ]),
    l([
      "Support ships are unarmed and outside the counter cycle. They carry resources or collect wreckage rather than fire. Bring armed ships to protect them; adding transports does not increase attack power.",
      "Compare your fleet’s classes with a recent probe report. If it gives only a range or the largest class group, allow for missing details. Class advantage matters together with numbers, remaining hull strength, research, Aegis and clan support.",
    ], [
      "Destek sınıfı gemiler silahsızdır ve sınıf döngüsüne katılmaz. Ateş etmek yerine kaynak taşır veya enkaz toplarlar. Onları korumak için savaş gemisi gönder. Nakliye gemisi eklemek saldırı gücünü artırmaz.",
      "Filondaki sınıfları güncel sonda raporuyla karşılaştır. Rapor yalnız aralık veya çoğunluktaki sınıfı gösteriyorsa eksik ayrıntıları hesaba kat. Sınıf üstünlüğünü birim sayısı, kalan dayanım, araştırma, Aegis ve klan desteğiyle birlikte değerlendir.",
    ]), ['combat.model', 'intel.probes', 'hull.HARPOON']),
  topic('combat', 'loot', l('Loot, disruption & wreckage', 'Yağma, aksatma ve enkaz'),
    l("Learn which resources a raid can take, how surviving cargo limits loot and how wreckage collection differs from ordinary cargo.", "Akının alabileceği kaynakları, sağ kalan kargonun ganimeti nasıl sınırladığını ve enkaz toplamanın normal kargodan farkını öğren."),
    l([
      "A raid can take unprotected stored resources and part of uncollected production. The victory grade sets the loot share. Surviving cargo capacity limits the load carried away. You may win and still leave resources behind because your holds are full.",
      "The Store protects only a limited amount of stock. A probe’s loot range estimates what a decisive raid could take before your own cargo limit. It does not show the target’s exact total stock. Partial success takes a smaller share; a repelled attack takes no ordinary loot.",
      "Destroyed units can also leave wreckage. A surviving [[hull.GARBAGE_COLLECTOR|Garbage Collector]] collects a limited amount after the attack it joined. Its wreck capacity is separate from ordinary raid cargo. Remaining public debris can be collected by Prospectors.",
    ], [
      "Akın, korumasız Depo kaynaklarını ve toplanmamış üretimin bir kısmını alabilir. Sonuç derecesi ganimet payını belirler. Taşınan yük, sağ kalan kargo kapasitesini aşamaz. Kazansan da ambarların dolduğu için hedefte kaynak bırakabilirsin.",
      "Depo, kaynakların yalnız sınırlı miktarını korur. Sondanın ganimet aralığı, senin kargo sınırın uygulanmadan kesin zaferle alınabilecek miktarı tahmin eder. Hedefin toplam kaynağını kesin olarak göstermez. Kısmi başarı daha az pay alır. Püskürtülen saldırı normal ganimet alamaz.",
      "Yok edilen birimler enkaz da bırakabilir. Sağ kalan [[hull.GARBAGE_COLLECTOR|Hurdacı]], katıldığı saldırıdan sonra sınırlı miktarda enkaz toplar. Enkaz kapasitesi, normal akın kargosundan ayrıdır. Kalan herkese açık enkaz sahasından Kazıcılarla kaynak toplanabilir.",
    ]),
    l([
      "Successful raids temporarily stop the target’s production. Some destroyed ground defences are rebuilt free under the rule below. These rebuilt units are not permanent losses.",
      "Compare returned loot and wreck resources with fuel and permanent ship losses. Keep loot and wreckage separate when reading the report. A second raid may bring less if the first emptied the target.",
    ], [
      "Başarılı akın, hedefin üretimini geçici olarak durdurur. Yok edilen yer savunmalarının bir kısmı aşağıdaki kurala göre ücretsiz yeniden kurulur. Yeniden kurulan birimler kalıcı kayıp sayılmaz.",
      "Dönen ganimet ve enkaz kaynaklarını, yakıtla ve kalıcı gemi kayıplarıyla karşılaştır. Raporda ganimetle enkazı ayrı değerlendir. İlk akın hedefi boşalttıysa ikinci akın daha az kaynak getirebilir.",
    ]), ['building.VAULT', 'research.CARGO_HOLDS', 'hull.GARBAGE_COLLECTOR']),
  topic('combat', 'eligibility', l("Attack eligibility & protection", "Saldırı koşulları ve korumalar"),
    l("Check development tiers, protection and repeated-attack limits before sending a fleet against another player.", "Başka oyuncuya filo göndermeden önce gelişim kademelerini, korumaları ve tekrar saldırı sınırlarını kontrol et."),
    l([
      "Player attacks use a permitted development-tier range. Your tier comes from the highest Command Core level among your planets. It is not your total fleet power. Selecting a less developed planet does not lower your tier.",
      "Repeated-attack limits apply to the target commander across all their planets. Attacking another colony of the same player does not create a fresh allowance. A recalled ordinary raid that returns before contact does not count as a landed attack.",
      "Newcomer, recovery and occupation protection can block an attack. Recovery protection is temporary after a qualifying loss. A hostile player action can require explicit confirmation to give up your own active shield.",
    ], [
      "Oyuncuya saldırı, izin verilen gelişim kademesi aralığına bağlıdır. Kademen, gezegenlerindeki en yüksek Komuta Çekirdeği seviyesinden hesaplanır. Toplam filo gücü değildir. Daha az gelişmiş gezegeni seçmek kademeni düşürmez.",
      "Tekrar saldırı sınırı, hedef komutanın bütün gezegenlerini birlikte sayar. Aynı oyuncunun başka kolonisine saldırmak yeni hak açmaz. Temastan önce geri çağrılan normal akın, varmış saldırı sayılmaz.",
      "Yeni oyuncu, toparlanma ve işgal koruması saldırıyı engelleyebilir. Toparlanma koruması, uygun kayıptan sonra geçici olarak verilir. Başka oyuncuya düşmanca işlem başlatmak için kendi aktif kalkanından vazgeçtiğini onaylaman gerekebilir.",
    ]),
    l([
      "Check current protection and the launch refusal, rather than relying on an old report. Clan attacks also have shared quotas and membership rules. Neutral planets and pirates follow separate target rules.",
      "The table lists current reference limits. If your active season has a different rule, its live preview and countdown determine whether you can launch.",
    ], [
      "Eski rapora dayanmak yerine güncel korumayı ve gönderimin engellenme nedenini kontrol et. Klan saldırıları ortak kota ve üyelik koşullarına da bağlıdır. Tarafsız gezegenler ve korsanlar ayrı hedef kurallarını kullanır.",
      "Tablo, güncel referans sınırlarını gösterir. Aktif sezonunda farklı kural varsa gönderim uygunluğunu o sezonun önizlemesi ve sayacı belirler.",
    ]), ['worlds.capital', 'clan.membership', 'fleet.flights']),
  topic('combat', 'retreat', l('Defence posture & tactical retreat', 'Savunma duruşu ve taktik çekilme'),
    l("Choose Hold, tactical retreat or clan support. Learn the ship, strength and fuel requirements for an automatic retreat.", "Savaş, taktik çekilme veya klan desteğini seç. Otomatik çekilme için gereken gemi, güç ve yakıt koşullarını öğren."),
    l([
      "Your planet can hold and fight, allow tactical retreat, or accept clan support. Retreat and support cannot be active together. Enabling retreat does not avoid every raid.",
      "Retreat needs the minimum armed-ship count, enough deuterium and a raid that would decisively defeat the standing defence. The attacker’s armed-unit resource value must also meet the ratio below against the defending armed units. Transports do not satisfy the armed-ship minimum.",
      "If the requirements fail, the fleet fights. Successful retreat preserves the ships but spends fuel. Ground defences stay and can still fight with Aegis. The planet’s unprotected resources can still be looted.",
    ], [
      "Gezegenin savaşabilir, taktik çekilmeyi açabilir veya klan desteği kabul edebilir. Çekilme ve destek aynı anda açık olamaz. Taktik çekilmeyi açmak her akından kaçmanı sağlamaz.",
      "Çekilme için asgari savaş gemisi sayısı, yeterli döteryum ve mevcut savunmayı kesin yenilgiye uğratacak saldırı gerekir. Saldıranın silahlı birimlerinin kaynak değeri de savunana karşı aşağıdaki oranı karşılamalıdır. Nakliye gemileri, asgari savaş gemisi sayısına dahil değildir.",
      "Koşullar sağlanmazsa filo savaşır. Başarılı çekilme, yakıt harcayarak gemileri korur. Yer savunmaları kalır ve Aegis ile savaşabilir. Gezegenin korumasız kaynakları yine yağmalanabilir.",
    ]),
    l([
      "Choose retreat to preserve ships, or [[clan.support|clan support]] to reinforce defence. Support puts allied ships at risk and changes the host’s Dominion calculation. Check the posture preview for required fuel.",
      "A probe records posture at observation time. The owner can change it later. A retreat setting does not prove the target will be undefended when your raid arrives.",
    ], [
      "Gemileri korumak için çekilmeyi, savunmaya takviye için [[clan.support|klan desteğini]] değerlendir. Destek, gelen gemileri riske sokar ve ev sahibinin Hâkimiyet hesabını değiştirir. Gereken yakıtı savunma duruşu önizlemesinden kontrol et.",
      "Sonda, gözlem anındaki savunma duruşunu kaydeder. Sahibi bunu sonradan değiştirebilir. Çekilme ayarı, akının vardığında hedefin savunmasız olacağını kanıtlamaz.",
    ]), ['clan.support', 'combat.eligibility', 'intel.probes']),
  topic('combat', 'death-star', l('Death Star & EMP', 'Ölüm Yıldızı ve EMP'),
    l("Build and launch a consumable EMP weapon. Learn its requirements, interception risk and effects on shields, ground defences and colony loyalty.", "Tüketilen EMP silahını üretip gönder. Koşullarını, önlenme riskini ve kalkan, yer savunması, koloni sadakati üzerindeki etkilerini öğren."),
    l([
      "A Death Star is a single-use strategic weapon, separate from ordinary ships. It needs the stated local Core and Shipyard levels, resources and weapon capacity. Each weapon is paid for and built separately, before the season ends.",
      "If not intercepted, its EMP hit temporarily disables defence systems. Aegis charge falls to zero and cannot regenerate during the effect. Ground defences cannot fight or take damage during that period.",
      "A colony also loses loyalty. At zero loyalty, it becomes neutral. The hit does not destroy the planet or automatically capture it. Capital ownership does not change. Another hit restarts the EMP duration.",
    ], [
      "Ölüm Yıldızı, normal gemilerden ayrı, tek kullanımlık stratejik silahtır. Belirtilen Çekirdek ve Tersane seviyeleri, kaynaklar ve boş silah kapasitesi gerekir. Her silahın bedeli ayrı ödenir ve sezon bitmeden üretimi tamamlanmalıdır.",
      "Silah önlenmezse EMP isabeti savunma sistemlerini geçici olarak kapatır. Aegis sıfırlanır ve etki boyunca yenilenemez. Yer savunmaları bu sürede savaşamaz ve hasar alamaz.",
      "Koloni ayrıca sadakat kaybeder. Sadakat sıfıra inerse gezegen tarafsız olur. Silah gezegeni yok etmez ve otomatik ele geçirmez. Ana gezegenin sahipliği değişmez. Yeni isabet, EMP süresini yeniden başlatır.",
    ]),
    l([
      "The weapon takes no ordinary loot and cannot be recalled after launch. [[research.STRATEGIC_STOCKPILE|Strategic Stockpile]] increases weapon capacity on each planet. It does not remove the price or build time of another weapon.",
      "Scout defence and loyalty, then check [[combat.interception|interceptor coverage]]. One ready charge stops one weapon. Several weapons can exceed the available charges, but launching them does not guarantee a hit.",
    ], [
      "Silah normal ganimet taşımaz ve gönderilince geri çağrılamaz. [[research.STRATEGIC_STOCKPILE|Stratejik Stok]], her gezegenin silah kapasitesini artırır. Ek silahın bedelini veya üretim süresini kaldırmaz.",
      "Savunmayı ve sadakati keşfet; ardından [[combat.interception|önleyici kapsamını]] kontrol et. Hazır bir şarj, bir silahı durdurur. Birden fazla silah hazır şarj sayısını aşabilir; yine de gönderim isabeti garanti etmez.",
    ]), ['combat.interception', 'research.STRATEGIC_STOCKPILE', 'worlds.colonies']),
  topic('combat', 'interception', l("Interceptor charges", "Önleyici şarjlar"),
    l("Prepare interceptor charges to stop Death Stars automatically. Check local sensor requirements, ready charges and replacement costs.", "Ölüm Yıldızlarını otomatik durdurmak için önleyici şarj hazırla. Gezegenin sensör koşullarını, hazır sayıyı ve yeniden üretim bedelini kontrol et."),
    l([
      "An interceptor charge is a single-use defence against Death Stars. Building it requires an active Uplink and the stated Radar level on that planet. [[research.INTERCEPTION_GRID|Interception Grid]] increases capacity but is not needed for the base number of charges.",
      "A ready charge fires automatically when a Death Star meets sensor interception conditions. The weapon must cross the Radar interception area at the required time or be identified within your planets’ Telescope sight. Firing consumes the charge. One charge stops one weapon.",
    ], [
      "Önleyici şarj, Ölüm Yıldızına karşı tek kullanımlık savunmadır. Hazırlamak için o gezegende etkin Anten ve belirtilen Radar seviyesi gerekir. [[research.INTERCEPTION_GRID|Önleme Ağı]] kapasiteyi artırır; temel şarj sayısı için araştırma gerekmez.",
      "Hazır şarj, Ölüm Yıldızı sensörlerin önleme koşulunu karşılayınca otomatik ateş eder. Silah gereken zamanda Radar önleme alanına girmeli veya gezegenlerinin Teleskop görüşünde tanımlanmalıdır. Atışta şarj tüketilir. Bir şarj, bir silahı durdurur.",
    ]),
    l([
      "Check ready charges, rather than total capacity or orders still building. A charge under construction cannot stop a weapon. Several arriving weapons can exceed the ready number.",
      "Build replacements after firing and keep the required sensors operational. Interceptors stop strategic weapons. Aegis and ground defences protect against ordinary raids; upgrading them does not add interceptor charges.",
    ], [
      "Toplam kapasiteyi veya üretimdeki siparişi değil, hazır şarj sayısını kontrol et. Üretimdeki şarj silah durduramaz. Birden fazla gelen silah, hazır sayıyı aşabilir.",
      "Atıştan sonra yeni şarj üret ve gereken sensörleri çalışır tut. Önleyiciler stratejik silahı durdurur. Aegis ve yer savunmaları normal akınlara karşıdır; onları yükseltmek önleyici şarj eklemez.",
    ]), ['instrument.RADAR', 'instrument.TELESCOPE', 'research.INTERCEPTION_GRID']),
  topic('intel', 'overview', l("Visible information & private intelligence", "Görünen bilgi ve özel istihbarat"),
    l("Separate visible map objects, identified planets and private reports. Learn what sensors reveal and why missing data does not mean an empty target.", "Haritadaki izleri, tanımlanan gezegenleri ve özel raporları ayır. Sensörlerin gösterdiğini öğren; bilinmeyen hedefi boş sayma."),
    l([
      "Seeing a point on the map does not identify its planet or owner. Your sensors and previous observations determine which planet details you know. Commander names and standings do not automatically reveal all their planets.",
      "An identified planet can still have unknown ships, resources and research. These require intelligence. Base sight, Radar detection and Telescope identification provide different information. A moving contact is not necessarily an exact ship list.",
      "Radar warns about threats aimed at its own planet. Telescope identifies contacts and enables silent fleet watches. Veil can reduce what a Telescope reads. Clan membership does not give you shared access to every member’s sensors.",
    ], [
      "Haritada bir nokta görmek, gezegeni veya sahibini tanımlamak değildir. Sensörlerin ve önceki gözlemlerin hangi gezegen ayrıntılarını bildiğini belirler. Komutan adları ve sıralama, oyuncunun bütün gezegenlerini otomatik açıklamaz.",
      "Tanımlanmış gezegenin gemileri, kaynakları ve araştırmaları yine bilinmeyebilir. Bunlar için istihbarat toplamalısın. Temel görüş, Radar algılaması ve Teleskop tanımlaması farklı bilgi verir. Hareketli iz, kesin gemi listesi değildir.",
      "Radar, kendi gezegenine yönelen tehditleri bildirir. Teleskop, hareketleri tanımlar ve sessiz filo gözlemi sağlar. Perde, Teleskobun elde ettiği bilgiyi azaltabilir. Klan üyeliği, bütün üyelerin sensörlerini ortak kullanmanı sağlamaz.",
    ]),
    l([
      "Use watches to notice departures and probes to inspect defence and potential loot. Check observation time: a report delivered now may describe an earlier state. Missing information is uncertainty, not a measured zero.",
      "Public news and personal reports reveal different details. Seeing a battle on the map does not give you both participants’ private reports. Share your findings deliberately when coordinating with clanmates.",
    ], [
      "Ayrılışları fark etmek için gözlemi, savunmayı ve olası ganimeti öğrenmek için sondayı kullan. Gözlem zamanını kontrol et; şimdi gelen rapor daha eski durumu anlatabilir. Bilinmeyen bilgi, ölçülmüş sıfır değildir.",
      "Herkese açık haberlerle kişisel raporların ayrıntıları farklıdır. Haritada savaş görmek, iki tarafın özel raporlarını sana vermez. Klanla plan yaparken paylaşacağın bilgiyi bilinçli seç.",
    ]), ['intel.probes', 'intel.watches', 'instrument.VEIL']),
  topic('intel', 'probes', l('Probes & dated reports', 'Sondalar ve tarihli raporlar'),
    l("Send a paid probe to learn defence and potential loot. Understand accuracy, detection risk and the observation time recorded in reports.", "Savunmayı ve olası ganimeti öğrenmek için ücretli sonda gönder. Doğruluğu, fark edilme riskini ve rapordaki gözlem zamanını değerlendir."),
    l([
      "A probe is a scouting flight, separate from a combat fleet. You pay its resource cost when sending it. Your origin Shipyard improves accuracy and makes the probe harder to detect. Target Radar improves detection; Veil can reduce accuracy.",
      "A detected probe can alert the target. Reports may contain estimates or ranges instead of exact counts. They can show defence, ship classes, potential loot, combat research and posture, depending on the reading. An unmeasured feature is not necessarily absent.",
      "Ordinary probes use no flight bay and cannot be recalled. [[galaxy.monuments|Monument probes]] have a separate high loss chance. A surviving monument probe gives an exact snapshot at observation time.",
    ], [
      "Sonda, savaş filosundan ayrı keşif uçuşudur. Kaynak bedeli gönderimde ödenir. Çıkış gezegeninin Tersanesi, doğruluğu artırır ve sondanın fark edilmesini zorlaştırır. Hedefin Radarı algılamayı artırır; Perdesi doğruluğu düşürebilir.",
      "Fark edilen sonda hedefi uyarabilir. Rapor kesin sayı yerine tahmin veya aralık verebilir. Sonuca göre savunmayı, gemi sınıflarını, olası ganimeti, savaş araştırmalarını ve savunma duruşunu gösterebilir. Ölçülmeyen özellik, hedefte bulunmadığı anlamına gelmez.",
      "Normal sondalar uçuş rampası kullanmaz ve geri çağrılamaz. [[galaxy.monuments|Anıt sondalarının]] ayrı, yüksek kayıp ihtimali vardır. Sağ kalan anıt sondası, gözlem anındaki kesin bilgiyi verir.",
    ]),
    l([
      "Read observation and delivery time separately. The target may change between them. Compare your cargo capacity with the loot range and your classes with the reported defence. Neither estimate guarantees victory or a particular haul.",
      "Keep reports private unless you choose to share their information. For a new attack, consider whether enough has changed to justify a fresh probe.",
    ], [
      "Gözlem ve teslim zamanlarını ayrı değerlendir. Hedef, bu iki zaman arasında değişebilir. Kargo kapasiteni ganimet aralığıyla, sınıflarını raporlanan savunmayla karşılaştır. Tahminler, zaferi veya belirli ganimeti garanti etmez.",
      "Bilgiyi paylaşmayı seçmediğin sürece raporların özeldir. Yeni saldırıda hedefin değişmiş olabileceğini değerlendir; gerekirse güncel sonda gönder.",
    ]), ['building.SHIPYARD', 'instrument.RADAR', 'instrument.VEIL']),
  topic('intel', 'watches', l('Silent watches & warnings', 'Sessiz gözlemler ve uyarılar'),
    l("Use Telescope watches to track whether a fleet is home. Separate silent observations from Radar warnings about an approaching attack.", "Filonun gezegende olup olmadığını izlemek için Teleskop gözlemi kullan. Sessiz gözlemi, yaklaşan saldırının Radar uyarısından ayır."),
    l([
      "Telescope provides a limited number of watch slots. Assign a planet within watch range to observe whether its fleet is home or away. Telescope and target Veil levels affect clarity. Low clarity can leave observations intermittent or unknown.",
      "The target is not notified when you assign a silent watch. Watch range and slot cooldown limit changes. Telescope upgrades extend range and open more slots at the levels below. A watch does not reveal all resources or combat research.",
      "Radar warnings concern attacks aimed at the Radar’s own planet. Higher levels add direction, estimated strength, then origin and ship details. Detecting another moving contact does not necessarily provide an arrival time for your planet.",
    ], [
      "Teleskop sınırlı sayıda gözlem yuvası sağlar. Gözlem menzilindeki gezegeni seçerek filosunun evde veya uzakta olduğunu izle. Teleskop ve hedefin Perde seviyeleri netliği etkiler. Düşük netlikte bilgi kesintili veya bilinmiyor olabilir.",
      "Sessiz gözlem atadığında hedefe bildirim gitmez. Gözlem menzili ve yuva bekleme süresi, değişiklikleri sınırlar. Teleskop yükseltmeleri menzili artırır ve aşağıdaki seviyelerde yuva açar. Gözlem, bütün kaynakları veya savaş araştırmalarını açıklamaz.",
      "Radar uyarıları, Radarın bulunduğu gezegene yönelen saldırılar içindir. Üst seviyeler yönü, tahmini gücü, ardından çıkışı ve gemi ayrıntılarını ekler. Başka bir hareketli izi algılamak, kendi gezegenin için varış zamanı vermeyebilir.",
    ]),
    l([
      "Use a watch to notice an opportunity, then a probe to inspect the defence. Watches describe fleet presence; probes answer different questions about forces and loot.",
      "Use an inbound Radar countdown to decide which ships can return or finish repair before the attack. Check current stock and defence instead of assuming an old watch still describes the target.",
    ], [
      "Fırsatı fark etmek için gözlemi, savunmayı incelemek için sondayı kullan. Gözlem, filonun konum durumunu gösterir. Sonda, birlikler ve ganimet hakkında farklı soruları yanıtlar.",
      "Yaklaşan saldırının Radar sayacına göre hangi geminin dönebileceğini veya onarımının biteceğini değerlendir. Eski gözlemin hâlâ geçerli olduğunu varsaymadan güncel kaynakları ve savunmayı kontrol et.",
    ]), ['instrument.TELESCOPE', 'instrument.RADAR', 'intel.probes']),
];
