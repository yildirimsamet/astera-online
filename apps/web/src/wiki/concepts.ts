import { localized as l, type Localized, type WikiArticle, type WikiSection } from './model.js';

export function topic(category: string, slug: string, title: Localized<string>, description: Localized<string>, how: Localized<readonly string[]>, use: Localized<readonly string[]>, related: readonly string[]): WikiArticle {
  const sections = (language: 'en' | 'tr'): WikiSection[] => [
    { id: 'rules', title: language === 'en' ? 'How it works' : 'Nasıl çalışır?', blocks: how[language].map(text => ({ kind: 'text', text })) },
    { id: 'decisions', title: language === 'en' ? 'Your next decision' : 'Bir sonraki kararın', blocks: use[language].map(text => ({ kind: 'text', text })) },
  ];
  return { id: `${category}.${slug}`, category, slug, title, description, sections: l(sections('en'), sections('tr')), related };
}

export const conceptArticles: readonly WikiArticle[] = [
  topic('basics', 'quick-start', l('Quick start', 'Hızlı başlangıç'),
    l("Learn how to collect resources, develop your first planet, scout a target and prepare a fleet for its first mission.", "Kaynak toplamayı, ilk gezegenini geliştirmeyi, hedefi keşfetmeyi ve filonu ilk görevine hazırlamayı öğren."),
    l([
      "Astera Online keeps running while you are offline. Your planets produce resources, queued orders finish and fleets continue their missions. You do not need to keep the game open for these actions to progress.",
      "The Academy teaches the controls in a fast practice session. After joining a galaxy, select your planet and collect resources from the Works into the Store. Resources in the Works cannot pay for construction or flights.",
    ], [
      "Astera Online, oyundan çıktığında da devam eder. Gezegenlerin kaynak üretir, sıradaki işler tamamlanır ve filoların görevlerini sürdürür. Bu işlemlerin ilerlemesi için oyunu açık tutman gerekmez.",
      "Akademi, hızlandırılmış eğitimde kontrolleri öğretir. Galaksiye katılınca kendi gezegenini seç ve kaynakları Havuzdan Depoya topla. Havuzda bekleyen kaynaklarla inşaat bedeli veya uçuş yakıtı ödenmez.",
    ]),
    l([
      "Open Production to see your buildings and queues. Improve the producer for the resource you need. Raise the [[building.CORE|Command Core]] if its level blocks the upgrade you want.",
      "Open Fleet to build ships. For a raid, combine armed ships with enough cargo capacity to carry loot. A raid attacks another planet to obtain resources; sending only transports does not provide combat firepower.",
      "Install [[satellite.UPLINK|Uplink]] before building Telescope or Radar. Before a raid, check protection, a recent [[intel.probes|probe report]], fuel and cargo. Review the ships left defending home and the expected return time. After the mission, read its report before repeating it.",
    ], [
      "Binalarını ve sipariş sıralarını görmek için Üretim bölümünü aç. Eksik kaynağın üretim binasını geliştir. İstediğin yükseltmeyi seviye sınırı engelliyorsa [[building.CORE|Komuta Çekirdeğini]] yükselt.",
      "Gemi üretmek için Filo bölümünü aç. Akın için savaş gemileriyle ganimeti taşıyacak kargo kapasitesini birlikte hazırla. Akın, kaynak almak için başka gezegene yapılan saldırıdır. Yalnız nakliye gemisi göndermek savaş gücü sağlamaz.",
      "Teleskop veya Radar kurmadan önce [[satellite.UPLINK|Anten]] kur. Akından önce korumayı, güncel [[intel.probes|sonda raporunu]], yakıtı ve kargoyu kontrol et. Gezegeninde savunmaya kalan gemileri ve dönüş zamanını incele. Görevden sonra aynı akını tekrarlamadan önce raporunu oku.",
    ]), ['basics.loop', 'economy.collectors', 'fleet.flights']),
  topic('basics', 'loop', l('Information, risk & opportunity', 'Bilgi, risk ve fırsat'),
    l("Use production to build your fleet, gather current intelligence and compare a mission’s possible reward with its cost and risks.", "Üretimle filonu geliştir, güncel istihbarat topla ve görevin olası getirisini bedeliyle ve riskleriyle karşılaştır."),
    l([
      "Develop a planet, collect resources, scout a target and send a fleet. The mission can bring resources, destroy ships and reveal new information. Ships away on a mission do not defend their home planet.",
      "An unseen defence is unknown, not empty. A report describes the moment of observation. Returning fleets, finished orders or arriving support can change the target before your attack lands.",
    ], [
      "Gezegenini geliştir, kaynak topla, hedefi keşfet ve filo gönder. Görev kaynak getirebilir, gemi kaybına yol açabilir ve yeni bilgi sağlayabilir. Görevdeki gemiler çıkış gezegenini savunmaz.",
      "Görmediğin savunmanın boş olduğunu varsayma. Rapor, gözlem anındaki durumu anlatır. Dönen filo, tamamlanan sipariş veya gelen destek, saldırın varmadan hedefi değiştirebilir.",
    ]),
    l([
      "Compare potential loot with fuel, permanent ship losses and time away. Check what remains at home. Winning a battle can still cost more resources than it brings back.",
      "Use [[intel.watches|silent watches]] to notice fleet departures. Use probes to learn the defence and [[combat.counters|combat classes]] to choose suitable ships. Better information helps you estimate the result; it does not guarantee victory.",
    ], [
      "Olası ganimeti yakıt, kalıcı gemi kaybı ve uzakta geçecek süreyle karşılaştır. Gezegeninde kalan savunmayı kontrol et. Savaşı kazansan da harcadığından daha az kaynak getirebilirsin.",
      "Filoların ayrılışını fark etmek için [[intel.watches|sessiz gözlemleri]] kullan. Savunmayı öğrenmek için sonda gönder; uygun gemileri [[combat.counters|savaş sınıflarına]] göre seç. Güncel bilgi sonucu tahmin etmeyi kolaylaştırır; zaferi garanti etmez.",
    ]), ['intel.overview', 'combat.model', 'season.dominion']),
  topic('basics', 'controls', l('Reading the interface', 'Arayüzü okumak'),
    l("Find your active planet, ships, intelligence and clan. Learn how resource meters, timers, reports and action confirmations work.", "Aktif gezegenini, gemilerini, istihbaratını ve klanını bul. Kaynak göstergelerini, sayaçları, raporları ve işlem onaylarını öğren."),
    l([
      "Select an object on the galaxy map and open its details to act. Base manages the active planet. Fleet lists ships at home and ongoing flights. Intel contains observations and battle reports. Clan contains membership and shared operations.",
      "The resource meters at the top show spendable stock and storage capacity. The timer line highlights an approaching event; open it to see other timers. The bell opens personal notifications, public news and chat.",
    ], [
      "Galaksi haritasında bir nesneyi seç ve işlem yapmak için detayını aç. Üs, aktif gezegenini yönetir. Filo, gezegendeki gemileri ve uçuşları gösterir. İstihbaratta gözlemler ve savaş raporları bulunur. Klanda üyeliği ve ortak harekâtları yönetirsin.",
      "Üstteki kaynak göstergeleri, harcanabilir miktarı ve depo kapasitesini gösterir. Zamanlayıcı satırı yaklaşan bir olayı gösterir; diğer sayaçlar için satırı aç. Zil, kişisel bildirimleri, herkese açık haberleri ve sohbeti açar.",
    ]),
    l([
      "Check the active planet before paying or sending ships. Construction uses that planet’s stock. Research is shared across your planets, but the selected paying planet supplies its resources.",
      "Read the cost, arrival time and consequence before holding a confirmation button. Keyboard confirmation also supports Enter. Open the menu for Wiki, Academy replay, language, sound, account and community pages.",
    ], [
      "Ödeme yapmadan veya gemi göndermeden önce aktif gezegeni kontrol et. İnşaat, o gezegenin kaynaklarını kullanır. Araştırmalar bütün gezegenlerinde geçerlidir; bedel ödeme için seçtiğin gezegenden çıkar.",
      "Onay düğmesini basılı tutmadan önce bedeli, varış zamanını ve sonucu oku. Klavyeyle onay için Enter da kullanılabilir. Wiki, Akademi tekrarı, dil, ses, hesap ve topluluk sayfaları menüdedir.",
    ]), ['basics.quick-start', 'economy.queues', 'season.identity']),
  topic('worlds', 'capital', l('Your capital', "Ana gezegenin"),
    l("Learn why your capital stays yours, what raids can damage and how its Command Core affects research and colony capacity.", "Ana gezegeninin neden senin kaldığını, akınların neleri etkilediğini ve Komuta Çekirdeğinin araştırmayla koloni kapasitesini nasıl belirlediğini öğren."),
    l([
      "Your capital is your home planet throughout the season. A raid cannot capture it. Raids can still destroy its defending units, take unprotected resources and temporarily stop production.",
      "The capital’s [[building.CORE|Command Core]] determines research timing, some research requirements and colony slots. A colony’s Core controls that colony’s local capacities. Raising a colony Core does not satisfy a capital-level requirement.",
    ], [
      "Ana gezegenin sezon boyunca senin kalır; akınla ele geçirilemez. Akınlar yine de savunmadaki birliklerini yok edebilir, korumasız kaynaklarını alabilir ve üretimini geçici olarak durdurabilir.",
      "Ana gezegendeki [[building.CORE|Komuta Çekirdeği]] araştırma süresini, bazı araştırma koşullarını ve koloni yuvalarını belirler. Koloninin Çekirdeği o koloninin kapasitesini yönetir. Koloni Çekirdeğini yükseltmek, ana gezegen için belirtilen seviye koşulunu karşılamaz.",
    ]),
    l([
      "Keep fuel and a defence at home so you can respond after a loss. The [[building.VAULT|Store]] protects only part of your stock. Aegis alone cannot defend a planet without combat-ready units.",
      "Distinguish capitals from colonies when choosing a target. A capital keeps its owner; a colony can become neutral if its [[worlds.colonies|loyalty]] reaches zero.",
    ], [
      "Kayıptan sonra toparlanabilmek için ana gezegeninde yakıt ve savunma bırak. [[building.VAULT|Depo]] kaynaklarının yalnızca bir kısmını korur. Savaşabilecek birimi olmayan gezegeni Aegis tek başına savunamaz.",
      "Hedef seçerken ana gezegenle koloniyi ayır. Ana gezegenin sahibi değişmez. Koloninin [[worlds.colonies|sadakati]] sıfıra düşerse gezegen tarafsız olur.",
    ]), ['worlds.colonies', 'combat.eligibility', 'building.CORE']),
  topic('worlds', 'neutral', l("Neutral planets & settlement periods", "Tarafsız gezegenler ve yerleşim yarışı"),
    l("Scout a neutral planet, defeat its defence and open the timed settlement period needed to found a colony.", "Tarafsız gezegenin savunmasını keşfet, savaşı kazan ve koloni kurmak için gereken süreli yerleşim yarışını aç."),
    l([
      "Neutral planets belong to no player. Their development tiers and garrisons differ; a garrison is the force defending a planet. Appearance gives a broad threat estimate, while a probe can provide more detail. Higher-tier garrisons can replenish, so old reports may no longer match.",
      "A decisive raid victory opens a timed settlement period. Victory does not give you ownership. You must send a [[worlds.settlement|settlement fleet]] with free colony capacity, Couriers and founding resources. It must arrive before the period ends.",
      "The raid winner receives an initial priority period only if they have free colony capacity when settlement opens. Other commanders can compete after that priority ends.",
    ], [
      "Tarafsız gezegenler hiçbir oyuncuya ait değildir. Gelişim kademeleri ve garnizonları farklıdır; garnizon, gezegeni savunan birliklerdir. Görünüm genel tehdit seviyesini, sonda daha ayrıntılı bilgiyi verir. Üst kademelerde garnizon yenilenebilir; eski rapor güncel savunmayı göstermeyebilir.",
      "Akında kesin zafer, süreli yerleşim yarışını açar. Savaşı kazanmak gezegeni ele geçirmek değildir. Boş koloni yuvan, Kuryelerin ve kuruluş kaynakların olmalıdır. [[worlds.settlement|Yerleşim filonu]] gönder ve yarış bitmeden varmasını sağla.",
      "Akını kazanan oyuncu, yarış açıldığında boş koloni yuvası varsa başlangıç önceliği alır. Bu öncelik sona erince diğer komutanlar da yerleşim için yarışabilir.",
    ]),
    l([
      "Check settlement travel time before raiding. Even after a victory, your fleet may be too far away to settle before the deadline. During an open settlement period, compare your arrival time with its countdown.",
      "Neutral raids can bring resources and expansion opportunities. They do not transfer PvP [[season.dominion|Dominion]]. The neutral planet’s tier is separate from the attack-band rule used between players.",
    ], [
      "Akından önce yerleşim uçuşunun süresini kontrol et. Savaşı kazansan da filon yarış bitmeden yetişemeyebilir. Yarış açıkken varış zamanını kalan süreyle karşılaştır.",
      "Tarafsız gezegenlere akın, kaynak ve koloni fırsatı sağlar. Bu savaşlarda oyuncular arasındaki [[season.dominion|Hâkimiyet]] puanı aktarılmaz. Tarafsız gezegen kademesi ile oyuncuların saldırı uygunluğunu belirleyen kademe aralığı ayrı kurallardır.",
    ]), ['worlds.settlement', 'intel.probes', 'combat.model']),
  topic('worlds', 'settlement', l('Founding a colony', 'Koloni kurmak'),
    l("Prepare colony capacity, Couriers, resources and fuel. Learn settlement priority, arrival requirements and what returns if settlement fails.", "Koloni yuvanı, Kuryeleri, kaynakları ve yakıtı hazırla. Yerleşim önceliğini, varış koşulunu ve başarısız yerleşimde geri dönenleri öğren."),
    l([
      "Your capital’s Core opens colony slots at the levels in the table below. Each settlement flight reserves one slot until it resolves. Choose a neutral planet with an open settlement period and check that your arrival is valid.",
      "Send the required Couriers with the founding resources and one-way flight fuel. On success, the Couriers stay on the new colony and the founding resources are spent. Occupation protection starts on arrival.",
      "The new colony starts with the stock assigned to its neutral development tier. Your founding resources are a cost; they are not added to that starting stock.",
    ], [
      "Ana gezegenindeki Çekirdek, aşağıdaki seviyelerde koloni yuvası açar. Yoldaki her yerleşim filosu bir yuvayı ayırır. Yerleşim yarışı açık tarafsız gezegeni seç ve varışının koşullara uyduğunu kontrol et.",
      "Gereken Kuryeleri kuruluş kaynakları ve tek yön uçuş yakıtıyla gönder. Yerleşim başarılı olursa Kuryeler yeni kolonide kalır; kuruluş kaynakları harcanır. Varışta işgal koruması başlar.",
      "Yeni koloni, tarafsız gelişim kademesine göre belirlenen başlangıç kaynaklarıyla açılır. Kuruluş için gönderdiğin kaynaklar bedeldir; bu başlangıç miktarına ayrıca eklenmez.",
    ]),
    l([
      "A settlement fleet cannot be recalled. Priority is checked at arrival, which must be strictly before the settlement deadline. A free colony slot does not reserve the target planet for you.",
      "If someone else settles first or the period closes before arrival, your ships return with the founding resources. Spent fuel is not refunded. Leave room for their return and prepare the new colony’s [[worlds.colonies|maintenance]].",
    ], [
      "Yerleşim filosu geri çağrılamaz. Öncelik, varış anında kontrol edilir. Filo, yarışın bitiş anından önce varmalıdır. Boş koloni yuvan olması, hedef gezegeni sana ayırmaz.",
      "Başka oyuncu önce yerleşirse veya yarış varıştan önce kapanırsa gemilerin kuruluş kaynaklarıyla geri döner. Harcanan yakıt iade edilmez. Dönüş için Hangarda yer bırak ve yeni koloninin [[worlds.colonies|bakımını]] planla.",
    ]), ['worlds.neutral', 'building.CORE', 'hull.COURIER']),
  topic('worlds', 'colonies', l('Colonies, faults & loyalty', 'Koloniler, arızalar ve sadakat'),
    l("Manage each colony’s buildings, ships and repairs. Learn how faults and defeats reduce loyalty and when a colony becomes neutral.", "Her koloninin binalarını, gemilerini ve onarımlarını yönet. Arızaların ve yenilgilerin sadakati nasıl düşürdüğünü, koloninin ne zaman tarafsız olduğunu öğren."),
    l([
      "Each colony has separate buildings, stock, ships and instruments. Completed research is shared across all your planets. Developed colonies can suffer faults that interrupt production, leak stored resources or disable equipment and actions.",
      "Possible faults affect producers, the Store, Command Core, Telescope, Shipyard or Prospectors. Open the affected item to see the specific consequence and repair. A Command Core fault and a Shipyard fault do not disable the same functions.",
      "Active faults reduce loyalty; several faults make it fall faster. Loyalty recovers when faults are cleared. A lost raid or [[combat.death-star|EMP hit]] can also reduce it. At zero loyalty, you lose the colony and it becomes neutral. A decisive ordinary raid does not directly give ownership to its attacker.",
    ], [
      "Her koloninin binaları, kaynakları, gemileri ve gezegen cihazları ayrıdır. Tamamlanan araştırmalar bütün gezegenlerinde geçerlidir. Gelişmiş kolonilerde üretimi durduran, kaynak kaybettiren veya cihazlarla işlemleri devre dışı bırakan arızalar çıkabilir.",
      "Arızalar üretim binalarını, Depoyu, Komuta Çekirdeğini, Teleskobu, Tersaneyi veya Kazıcıları etkileyebilir. Arızanın sonucunu ve onarımını görmek için etkilenen öğeyi aç. Çekirdek ve Tersane arızaları farklı işlevleri devre dışı bırakır.",
      "Aktif arızalar sadakati düşürür; birden fazla arıza düşüşü hızlandırır. Arızalar giderilince sadakat toparlanır. Kaybedilen akın veya [[combat.death-star|EMP isabeti]] de sadakati azaltabilir. Sadakat sıfırda ise koloniyi kaybedersin ve gezegen tarafsız olur. Normal akında kesin zafer, gezegeni doğrudan saldırana vermez.",
    ]),
    l([
      "Check both the blocked action and the time until loyalty runs out. Paying for a repair does not finish it immediately. The fault remains active until repair completes. Colony faults and damaged ships use different repair processes.",
      "Check notifications and Base warnings. Transfer resources or ships to a colony that needs help. Keep enough stock for repairs before spending everything on upgrades.",
    ], [
      "Engellenen işlemi ve sadakat tükenene kadar kalan süreyi birlikte kontrol et. Onarım bedelini ödemek arızayı hemen gidermez; etkisi onarım tamamlanana kadar sürer. Koloni arızaları ile hasarlı gemiler ayrı işlemlerle onarılır.",
      "Bildirimleri ve Üs uyarılarını kontrol et. Yardım gereken koloniye kaynak veya gemi aktar. Bütün kaynaklarını geliştirmeye harcamadan önce onarım için yeterli miktarı ayır.",
    ]), ['worlds.transfers', 'fleet.repairs', 'combat.death-star']),
  topic('worlds', 'transfers', l("Transfers between your planets", "Gezegenlerin arasında transfer"),
    l("Move ships and resources between your planets. Choose which transports return and check destination room, fuel and recall rules.", "Gezegenlerin arasında gemi ve kaynak taşı. Dönecek nakliyecileri seç; hedef kapasitesini, yakıtı ve geri çağırma kurallarını kontrol et."),
    l([
      "A transfer sends selected ships and resources to another planet you own. It uses a flight bay at the origin. Ships away still occupy their origin Hangar room until their transfer is completed.",
      "The load must fit the selected ships’ cargo capacity. Your Store must contain both the load and the required fuel. You can leave ships at the destination or choose eligible transports to unload and return.",
      "The preview includes fuel for the selected route, including any return. An outbound transfer can be recalled once before arrival. It takes the time already flown to return; no extra fuel is charged and spent fuel is not refunded.",
    ], [
      "Transfer, seçtiğin gemileri ve kaynakları sahip olduğun başka gezegene gönderir. Çıkış gezegeninde bir uçuş rampası kullanır. Gemiler, transfer tamamlanana kadar çıkış gezegeninin Hangar alanında sayılır.",
      "Yük, seçilen gemilerin kargo kapasitesine sığmalıdır. Çıkış Deposunda hem gönderilecek yük hem gereken yakıt bulunmalıdır. Gemileri hedefte bırakabilir veya uygun nakliyecilerin yükü boşaltıp dönmesini seçebilirsin.",
      "Önizleme, seçtiğin rotanın yakıtını varsa dönüş dahil gösterir. Gidişteki transferi varıştan önce bir kez geri çağırabilirsin. Dönüş, o ana kadar uçulan süre kadar sürer. Ek yakıt alınmaz; harcanan yakıt iade edilmez.",
    ]),
    l([
      "Check free Hangar room at the destination and the defence left on each planet. Moving every warship to one colony can leave your capital’s resources undefended.",
      "If ownership changes and the ships cannot land safely, they return to a safe planet. A planet that receives a transfer has a short wait before another transfer can depart. Check its displayed availability before planning an immediate onward flight.",
    ], [
      "Hedefteki boş Hangar alanını ve her gezegende kalan savunmayı kontrol et. Bütün savaş gemilerini bir koloniye taşımak, ana gezegenindeki kaynakları savunmasız bırakabilir.",
      "Hedefin sahipliği değişirse ve gemiler güvenle inemezse güvenli bir gezegene dönerler. Transfer alan gezegenden yeni transfer göndermek için kısa bir bekleme uygulanır. Hemen başka uçuş planlamadan önce gösterilen bekleme süresini kontrol et.",
    ]), ['fleet.flights', 'building.HANGAR', 'clan.aid']),
  topic('economy', 'resources', l('Resources & storage', 'Kaynaklar ve depolama'),
    l("Learn what alloy, crystal and deuterium buy, how each planet stores resources and what a raid can take.", "Alaşımın, kristalin ve döteryumun kullanımını öğren. Gezegenlerin ayrı depolarını, kapasite sınırlarını ve akınla alınabilecek kaynakları incele."),
    l([
      "Alloy is used for most buildings and ships. Crystal pays for advanced ships, instruments and research. Deuterium supplies flight fuel and some purchases. Each planet has separate stock; a colony’s resources do not automatically pay for a capital order.",
      "Producer upgrades increase hourly production and the capacities based on it. The Store increases how many production hours fit in storage. Bonuses and faults can change the current rate. Incoming cargo can exceed storage capacity, but collection from the Works needs free storage room.",
    ], [
      "Alaşım, çoğu bina ve gemide kullanılır. Kristal; gelişmiş gemiler, gezegen cihazları ve araştırmalar için gerekir. Döteryum, uçuş yakıtını ve bazı satın alımları karşılar. Her gezegenin kaynakları ayrıdır. Koloninin kaynakları ana gezegendeki siparişe otomatik harcanmaz.",
      "Üretim binalarını yükseltmek, saatlik üretimi ve üretime bağlı kapasiteyi artırır. Depo, daha fazla saatlik üretime karşılık gelen kaynak tutmanı sağlar. Bonuslar ve arızalar üretim hızını değiştirebilir. Gelen kargo depo kapasitesini aşabilir. Havuzdan toplamak için ise Depoda boş yer gerekir.",
    ]),
    l([
      "The resource meter compares current stock with capacity. If a purchase costs more than storage can hold, improve storage or production before waiting for more collection. Transfers can also bring resources from another planet.",
      "The [[building.VAULT|Store]] protects a limited amount against raids, not all stored resources. Check [[combat.loot|loot rules]] and your remaining defence before leaving a large stock at home.",
    ], [
      "Kaynak göstergesi, mevcut miktarı kapasiteyle karşılaştırır. Satın alım bedeli depoya sığmıyorsa daha fazla toplamayı beklemeden depoyu veya üretimi geliştir. Başka gezegeninden transferle de kaynak getirebilirsin.",
      "[[building.VAULT|Depo]], akınlardan yalnız sınırlı miktarı korur; bütün kaynaklar korunmaz. Gezegeninde büyük kaynak birikimi bırakmadan önce [[combat.loot|yağma kurallarını]] ve kalan savunmanı kontrol et.",
    ]), ['economy.collectors', 'building.VAULT', 'building.DEUTERIUM_PLANT']),
  topic('economy', 'collectors', l('Works & collection', 'Üretim havuzu ve toplama'),
    l("Collect produced resources from the Works into the Store so you can spend them. Leave room for passive production and returning mining loads.", "Üretilen kaynakları harcayabilmek için Havuzdan Depoya topla. Yeni üretim ve dönen madencilik yükleri için kapasiteyi kontrol et."),
    l([
      "Your planets produce resources automatically into the Works. Collect them into the Store before spending them. The Works and Store have separate capacities. Each resource’s Works capacity is based on its hourly production.",
      "When a resource’s Works space is full, more of that resource cannot accumulate. Returning asteroid and debris loads also enter the Works and must fit its available room.",
      "Collection is limited by free Store capacity. If only part fits, the rest stays in the Works. A returned mining load is not spendable until you collect it.",
    ], [
      "Gezegenlerin kaynakları otomatik olarak Havuzda üretir. Bu kaynakları harcamadan önce Depoya toplamalısın. Havuzun ve Deponun kapasiteleri ayrıdır. Her kaynağın Havuz kapasitesi, o kaynağın saatlik üretimine bağlıdır.",
      "Bir kaynağın Havuzu dolunca o kaynak birikmeye devam edemez. Asteroitlerden ve enkaz sahalarından dönen yükler de Havuza eklenir; boş Havuz kapasitesiyle sınırlıdır.",
      "Toplama, Deponun boş kapasitesiyle sınırlıdır. Yükün yalnız bir kısmı sığarsa kalan kaynak Havuzda bekler. Madencilik yükü dönmüş olsa da toplamadan harcayamazsın.",
    ]),
    l([
      "Collect before placing an order and before several mining flights return. If the Store is full, spending resources or increasing storage capacity can make room for collection.",
      "The Works do not hide all your resources from raids. A successful raid can take some uncollected production as well as unprotected stock. Include both when planning your defence.",
    ], [
      "Sipariş vermeden ve birkaç madencilik yükü dönmeden önce kaynaklarını topla. Depo doluysa kaynak harcamak veya depo kapasitesini artırmak, toplama için yer açabilir.",
      "Havuz, kaynaklarının tamamını akınlardan korumaz. Başarılı akın, korumasız Depoyla birlikte toplanmamış üretimin bir kısmını da alabilir. Savunmanı planlarken ikisini de hesaba kat.",
    ]), ['economy.resources', 'galaxy.mining', 'combat.loot']),
  topic('economy', 'queues', l('Construction, Yard & Research queues', "İnşaat, Tersane ve Araştırma sıraları"),
    l("Learn which orders share a queue, when payment and work begin, and what you lose when cancelling an order.", "Hangi siparişlerin aynı sırayı kullandığını, ödemenin ve üretimin ne zaman başladığını, iptal edince ne kaybettiğini öğren."),
    l([
      "Each planet has separate Construction and Yard queues. Buildings, instruments and satellites use Construction. Ships and ground defences use the Yard. Each queue works on one order at a time and can hold a limited number of orders.",
      "Research has one separate queue shared across your planets. Paying from another planet does not start a second queue. Ship repairs use another queue; colony fault repairs are a separate process.",
      "You pay when placing an order. A queued order begins after the one ahead of it finishes. Requirements and capacity must permit the order. An earlier queued building or research can satisfy a later order’s prerequisite.",
    ], [
      "Her gezegenin İnşaat ve Tersane sıraları ayrıdır. Binalar, gezegen cihazları ve uydular İnşaatı kullanır. Gemiler ve yer savunmaları Tersaneyi kullanır. Her sıra aynı anda bir iş yürütür ve sınırlı sayıda sipariş tutar.",
      "Araştırma, bütün gezegenlerinin kullandığı tek ve ayrı sıradır. Başka gezegenden ödeme yapmak ikinci araştırma sırası açmaz. Gemi onarımlarının ayrı sırası vardır; koloni arızaları farklı işlemlerle onarılır.",
      "Bedel, siparişi verdiğinde ödenir. Bekleyen iş, önündeki iş tamamlanınca başlar. Siparişin koşulları ve kapasite gereksinimi karşılanmalıdır. Daha önce tamamlanacak sıradaki bina veya araştırma, sonraki siparişin ön koşulunu karşılayabilir.",
    ]),
    l([
      "Cancelling Construction or Yard orders refunds only the share in the table below; the rest is lost. Started research cannot be cancelled. Check the order’s current state before deciding to cancel.",
      "[[research.AI_ROBOTS|AI Robots]] shortens new Construction orders. [[research.YARD_AUTOMATION|Yard Automation]] shortens new Yard orders, including ships, Prospectors and ground defences. Neither research adds queue space or lowers resource prices.",
    ], [
      "İnşaat veya Tersane siparişini iptal edersen aşağıdaki pay iade edilir; kalan kaynak kaybolur. Başlatılan araştırma iptal edilemez. İptal kararı vermeden önce siparişin güncel durumunu kontrol et.",
      "[[research.AI_ROBOTS|Yapay Zekâ Robotları]], yeni İnşaat siparişlerini hızlandırır. [[research.YARD_AUTOMATION|Tersane Otomasyonu]], gemi, Kazıcı ve yer savunması dahil yeni Tersane siparişlerini hızlandırır. İki araştırma da sıraya yer eklemez veya kaynak bedelini düşürmez.",
    ]), ['research.overview', 'fleet.repairs', 'worlds.colonies']),
  topic('hardware', 'orbit', l('Orbit slots & instrument choices', "Yörünge yuvaları ve gezegen cihazı seçimi"),
    l("Plan orbit slots for satellites and learn how Telescope, Radar, Aegis and Veil differ from orbital equipment.", "Uydular için yörünge yuvalarını planla. Teleskop, Radar, Aegis ve Perdenin yörünge donanımından farkını öğren."),
    l([
      "Telescope, Radar, Aegis and Veil are instruments on your planet. Each has upgrade levels and uses no orbit slot. Satellites use orbit slots; you can install one of each type on a planet, with no satellite upgrades.",
      "The local Command Core opens orbit slots. Uplink uses one slot to enable Telescope and Radar. Foundry improves production, Derrick improves Prospectors and Beacon speeds up the fleet missions listed on its page.",
    ], [
      "Teleskop, Radar, Aegis ve Perde, gezegene kurulan cihazlardır. Seviyeleri yükseltilebilir; yörünge yuvası kullanmazlar. Uydular yörünge yuvası kullanır. Her gezegene her türden bir uydu kurulabilir; uyduların seviyesi yükseltilmez.",
      "Gezegenin Komuta Çekirdeği yörünge yuvalarını açar. Anten, bir yuva kullanarak Teleskop ve Radarı açar. Körük üretimi, Matkap Kazıcıları geliştirir. Kılavuz, kendi sayfasında belirtilen filo görevlerini hızlandırır.",
    ]),
    l([
      "Decide which action needs improving on this planet. With few slots, installing Uplink for intelligence can delay installing a production or mining bonus. Raise the Core when you need another slot.",
      "Read each satellite’s scope before buying it. Derrick does not enlarge raid cargo. Beacon does not increase combat power. Uplink alone supplies neither Telescope observations nor Radar warnings.",
    ], [
      "Bu gezegende hangi işlemi geliştirmek istediğini belirle. Yuvan azsa istihbarat için Anten kurmak, üretim veya madencilik uydusunu erteleyebilir. Yeni yuva gerektiğinde Çekirdeği yükselt.",
      "Satın almadan önce uydunun etki kapsamını oku. Matkap, akın kargosunu büyütmez. Kılavuz, savaş gücünü artırmaz. Anten tek başına Teleskop gözlemi veya Radar uyarısı sağlamaz.",
    ]), ['building.CORE', 'satellite.UPLINK', 'instrument.TELESCOPE']),
  topic('research', 'overview', l("Research across your planets", "Bütün gezegenlerinde geçerli araştırmalar"),
    l("Learn how shared research works, which projects require discovery and how capital level and completion time affect your fleets.", "Ortak araştırma sırasını, keşifle açılan projeleri ve ana gezegen seviyesiyle tamamlanma zamanının filolarına etkisini öğren."),
    l([
      "Research belongs to your commander and applies across your planets. All projects share one Research queue. You can select a planet to pay, but research timing and Core requirements always use your capital’s Core.",
      "Each project has its own level limit and prerequisites. Some become available later in the season. A project shown in the Wiki may still be locked in your current game.",
      "Some projects also need a gameplay discovery. Dense Fuel Cells requires a raid that fills your cargo while loot remains. Gravitic Charges requires an active Aegis to absorb the stated share of raid damage. Discovery opens the project; you must still pay for and complete it.",
    ], [
      "Araştırmalar komutanına aittir ve bütün gezegenlerinde geçerlidir. Hepsi tek Araştırma sırasını kullanır. Ödeme yapacak gezegeni seçebilirsin; araştırma süresi ve Çekirdek koşulları her zaman ana gezegeninin Çekirdeğine bağlıdır.",
      "Her araştırmanın seviye sınırı ve ön koşulları ayrıdır. Bazıları sezonun ilerleyen saatlerinde açılır. Wiki’de gördüğün bir araştırma, mevcut oyununda henüz açık olmayabilir.",
      "Bazı araştırmalar oyun sırasında keşfedilir. Yoğun Yakıt Hücreleri için bir akında kargon dolmalı ve hedefte ganimet kalmalıdır. Gravitik Yükler için aktif Aegis, akın hasarının belirtilen payını emmelidir. Keşif araştırmayı açar; bedelini ödeyip tamamlaman yine gerekir.",
    ]),
    l([
      "Choose the effect you need: new ship access, attack, hull strength, cargo or shorter production time. Unlocking a ship is different from improving existing ships. Starship Engineering meets advanced ship requirements but adds no attack bonus.",
      "An attacking fleet uses its launch-time research; ordinary defenders use their levels when combat begins. Speed improvements apply to newly launched missions. Check the project’s scope and the ship’s own requirements before purchasing.",
    ], [
      "İhtiyacın olan etkiyi seç: yeni gemi, saldırı, dayanım, kargo veya daha kısa üretim süresi. Gemi açmak ile mevcut gemileri geliştirmek farklıdır. Yıldız Gemisi Mühendisliği gelişmiş gemilerin koşulunu karşılar; saldırı bonusu vermez.",
      "Saldıran filo, kalkış anındaki araştırmaları kullanır. Normal savunma, savaş başladığındaki seviyeleri kullanır. Hız artışı, yeni gönderilen görevlere uygulanır. Araştırmayı almadan önce etki kapsamını ve geminin kendi gereksinimlerini kontrol et.",
    ]), ['economy.queues', 'research.STARSHIP_ENGINEERING', 'research.GRAVITIC_CHARGES']),
];
