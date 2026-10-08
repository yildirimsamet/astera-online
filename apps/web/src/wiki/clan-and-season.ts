import { localized as l, type WikiArticle } from './model.js';
import { topic } from './concepts.js';
export const clanAndSeasonArticles: readonly WikiArticle[] = [
  topic('clan', 'membership', l('Clan membership & leadership', 'Klan üyeliği ve liderlik'),
    l("Create or join a clan, manage applications and invitations, and learn waiting periods, leaving restrictions and former-clan ceasefires.", "Klan kur veya katıl. Başvuruları ve davetleri yönet; üyelik beklemelerini, ayrılma kısıtlarını ve eski üyelerle ateşkesi öğren."),
    l([
      "A clan is a limited group led by one commander. It has applications, invitations and private chat. Founding needs the stated capital Core level and resources. Members keep ownership of their own planets, fleets and research.",
      "After joining, a waiting period applies to aid, detailed history and joint-attack contributions. These features do not all become available immediately. Check your membership countdown before planning a shared action.",
      "Clanmates cannot attack one another as ordinary enemies. Leaving, expulsion or disbanding can lock new membership and start a ceasefire with former clanmates. These timers have different purposes; their durations are below.",
    ], [
      "Klan, bir komutanın yönettiği sınırlı gruptur. Başvuruları, davetleri ve özel sohbeti vardır. Kurmak için belirtilen ana gezegen Çekirdeği seviyesi ve kaynaklar gerekir. Üyelerin gezegenleri, filoları ve araştırmaları kendilerine ait kalır.",
      "Katılınca yardım, ayrıntılı geçmiş ve ortak saldırıya filo gönderme için bekleme uygulanır. Bu özelliklerin hepsi hemen açılmaz. Ortak işlem planlamadan önce üyelik sayacını kontrol et.",
      "Klan arkadaşları birbirine normal düşman gibi saldıramaz. Ayrılma, atılma veya dağılma, yeni üyeliği kilitleyebilir ve eski üyelerle ateşkes başlatabilir. Bu sayaçlar farklı kuralları gösterir; süreleri aşağıdadır.",
    ]),
    l([
      "Confirm that your invitation or application was accepted before using clan actions. The leader manages members and the shared operation. Membership does not reveal every member’s private sensor readings or reports.",
      "Agree on the target and timing in clan chat. [[clan.aid|Gifts]] permanently move resources or ships. [[clan.support|Defensive support]] keeps ships yours. [[clan.joint-war|Joint attacks]] gather fleets for one target. Choose the action that matches your purpose.",
    ], [
      "Klan işlemlerini kullanmadan önce davetinin veya başvurunun kabul edildiğini kontrol et. Lider üyeleri ve ortak harekâtı yönetir. Üyelik, bütün üyelerin özel sensör bilgisini veya raporlarını otomatik açıklamaz.",
      "Hedefi ve zamanı klan sohbetinde belirle. [[clan.aid|Yardım]], kaynakları veya gemileri kalıcı verir. [[clan.support|Savunma desteğinde]] gemiler senin kalır. [[clan.joint-war|Ortak saldırı]], filoları tek hedef için toplar. Amacına uygun işlemi seç.",
    ]), ['clan.aid', 'clan.support', 'clan.joint-war']),
  topic('clan', 'aid', l('Clan gifts & loot depot', 'Klan yardımı ve yağma deposu'),
    l("Give resources or ships to a clanmate within their aid limit. Learn what returns, what becomes theirs and how the Loot Depot works.", "Yardım limiti dahilinde klan arkadaşına kaynak veya gemi ver. Neyin döndüğünü, neyin alıcıda kaldığını ve Yağma Deposunu öğren."),
    l([
      "A loaded aid convoy gives its resources to the recipient; the transport ships return to you. An empty aid convoy gives its eligible mobile ships permanently. A ship gift is not temporary defensive support.",
      "Both forms require the membership waiting period, permission to receive aid and room in the recipient’s allowance. The limit counts gifts received during the stated period. Ship gifts count at their resource value.",
      "Only eligible cargo transports carry a resource gift. A ship gift also needs recipient Hangar room. Policy and ownership are checked again on arrival. Refused aid returns without being delivered. Aid cannot be recalled.",
      "Eligible ordinary raid returns can allocate a clan loot share to each member’s Loot Depot. Claim your available share to a suitable planet. The depot is separate from the treasury used for Clan Hangar upgrades.",
    ], [
      "Yüklü yardım konvoyu, kaynakları alıcıya verir; nakliye gemileri sana döner. Boş yardım konvoyundaki uygun gemiler alıcıya kalıcı geçer. Gemi yardımı, geçici savunma desteği değildir.",
      "İki tür için de üyelik beklemesi tamamlanmalı, alıcı yardımı kabul etmeli ve yardım limitinde yer olmalıdır. Limit, belirtilen sürede alınan yardımları sayar. Gemi yardımı, gemilerin kaynak değeriyle hesaba katılır.",
      "Kaynak yardımını yalnız uygun nakliye gemileri taşır. Gemi yardımında alıcının Hangarında da yer gerekir. Varışta yardım tercihi ve sahiplik yeniden kontrol edilir. Reddedilen yardım teslim edilmeden döner. Yardım geri çağrılamaz.",
      "Paylaşıma uygun normal akınların dönüşünde kişisel payın Yağma Deposunda birikebilir. Alınabilir payını uygun gezegenine aktar. Yağma Deposu, Klan Hangarını geliştiren hazineden ayrıdır.",
    ]),
    l([
      "Check the recipient’s allowance and what remains on your planet before sending. Aid has its own speed bonus and extra flight-bay allowance. Those benefits do not apply to stationed defensive support.",
      "Choose [[clan.support|clan support]] if you want the ships to stay yours and return later. Choose a gift only when you intend to give up ownership of its resources or ships.",
    ], [
      "Göndermeden önce alıcının kalan limitini ve kendi gezegeninde kalanları kontrol et. Yardımın ayrı hız bonusu ve ek uçuş rampası hakkı vardır. Bunlar konuşlu savunma desteğine uygulanmaz.",
      "Gemilerin senin kalmasını ve sonra dönmesini istiyorsan [[clan.support|klan desteğini]] seç. Yardımı, kaynakları veya gemileri kalıcı vermek istediğinde kullan.",
    ]), ['clan.membership', 'clan.support', 'worlds.transfers']),
  topic('clan', 'support', l("Clan defence support", "Klan savunma desteği"),
    l("Send your ships to defend a clanmate without giving them away. Learn support capacity, research, recall and the host’s Dominion calculation.", "Gemilerini vermeden klan arkadaşını savunmaya gönder. Destek kapasitesini, araştırmayı, geri çağırmayı ve ev sahibinin Hâkimiyet hesabını öğren."),
    l([
      "The host must enable Accept clan support. Your ships stay yours and use the host’s separate support area, equal to that planet’s Hangar capacity. Until home, they also occupy your own Hangar room and a flight bay.",
      "Support fights alongside the host using its own research. A supported planet cannot tactically retreat. If a support fleet does not meet the attack’s tier conditions, it may return without entering combat when the raid arrives.",
      "The sender can recall support in transit or while stationed. The host can send it home; disabling support also returns stationed fleets. Both legs’ fuel is paid at launch and not refunded by recall. The stay has a maximum duration and can end earlier near season close.",
    ], [
      "Ev sahibi, Klan desteğini kabul et seçeneğini açmalıdır. Gemiler senin kalır. Ev sahibinde, o gezegenin Hangar kapasitesine eşit ayrı destek alanını kullanırlar. Eve dönene kadar kendi Hangar alanını ve bir uçuş rampanı da kullanırlar.",
      "Destek filosu, kendi araştırmalarıyla ev sahibinin yanında savaşır. Destekli gezegen taktik çekilemez. Destek filosu saldırının kademe koşullarına uymuyorsa akın varınca savaşa katılmadan dönebilir.",
      "Gönderen, desteği yoldayken veya konuşluyken geri çağırabilir. Ev sahibi de gönderebilir; desteği kapatmak konuşlu filoları döndürür. Gidiş-dönüş yakıtı kalkışta ödenir ve çağırınca iade edilmez. Kalış süresi sınırlıdır; sezon sonuna yakın daha erken bitebilir.",
    ]),
    l([
      "Support protects the planet but puts allied ships at risk. Only the host’s Dominion changes on the defending side; supporters do not receive their own score change from that defence.",
      "The combined armed-unit value relative to the host’s own value sets a capped score factor. It increases the host’s loss exposure and reduces gain for the host’s own exchange. Permanent support losses enter separately at resource value. Joint-attacker counts also affect the result, so use the report’s final calculation.",
    ], [
      "Destek gezegeni savunur; gelen gemileri de riske sokar. Savunan tarafta yalnız ev sahibinin Hâkimiyeti değişir. Destekçilerin bu savunma için ayrı puan değişimi olmaz.",
      "Toplam silahlı birim değerinin ev sahibinin değerine oranı, sınırlı puan çarpanını belirler. Bu çarpan, ev sahibinin kendi savaş hesabında kayıp riskini artırır ve kazanımı azaltır. Destekçilerin kalıcı kayıpları ayrı kaynak değeriyle eklenir. Ortak saldıran sayısı da etkilidir; nihai hesap için raporu incele.",
    ]), ['combat.retreat', 'clan.membership', 'season.dominion']),
  topic('clan', 'joint-war', l('Joint attacks & Clan Hangar', 'Ortak saldırılar ve Klan Hangarı'),
    l("Gather fleets at the leader’s capital for a joint attack. Learn Clan Hangar room, treasury upgrades, recall and participant returns.", "Ortak saldırı için filoları liderin ana gezegeninde topla. Klan Hangarını, hazineyi, geri çağırmayı ve katılımcıların dönüşünü öğren."),
    l([
      "The leader selects one target. Members send fleets to the leader’s capital, keeping ownership and send-time research. These fleets use shared Clan Hangar capacity while still occupying their owners’ personal Hangars.",
      "Members donate resources to the war treasury; the leader uses them to upgrade Clan Hangar capacity. This treasury is separate from the personal Loot Depot. Donations are not a personal savings balance.",
      "Contributions require the membership waiting period, a valid tier range, a flight bay and fuel for the full route. The strike must start before the target mark expires. Marking a target does not freeze its defence or protection.",
    ], [
      "Lider bir hedef seçer. Üyeler filolarını liderin ana gezegenine gönderir; sahipliği ve gönderim anındaki araştırmaları korurlar. Filolar ortak Klan Hangarını kullanır; sahiplerinin kişisel Hangar alanında da sayılmaya devam eder.",
      "Üyeler savaş hazinesine kaynak bağışlar; lider bu kaynaklarla Klan Hangarını geliştirir. Hazine, kişisel Yağma Deposundan ayrıdır. Bağış, geri alabileceğin kişisel birikim değildir.",
      "Katılmak için üyelik beklemesi, uygun kademe aralığı, uçuş rampası ve bütün rotanın yakıtı gerekir. Hedef işaretinin süresi dolmadan saldırı başlamalıdır. Hedef seçmek, rakibin savunmasını veya korumasını sabitlemez.",
    ]),
    l([
      "Before the strike begins, you can recall your contribution. The leader starts when the fleets and current target conditions permit it. After launch, the strike cannot be recalled. Surviving ships return to their owners with allocated loot and wreck resources.",
      "A new operation waits until previous fleets return or are lost. Disbanding the clan permanently deletes treasury resources without refunds. At a [[galaxy.monuments|monument]], victorious fleets may stay under its own capacity, production and radiation rules.",
    ], [
      "Saldırı başlamadan kendi filonu geri çağırabilirsin. Lider, filolar ve hedefin güncel koşulları uygunsa saldırıyı başlatır. Başlayan saldırı geri çağrılamaz. Sağ kalan gemiler, paylarına düşen ganimet ve enkaz kaynaklarıyla sahiplerine döner.",
      "Yeni harekât, önceki filolar dönene veya yok olana kadar bekler. Klan dağılırsa hazine kaynakları kalıcı silinir; iade yapılmaz. [[galaxy.monuments|Anıtta]] zafer kazanan filolar, anıtın kapasite, üretim ve radyasyon kurallarıyla orada kalabilir.",
    ]), ['clan.membership', 'galaxy.monuments', 'combat.eligibility']),
  topic('season', 'dominion', l('Dominion & the standings', "Hâkimiyet ve sıralama"),
    l("Learn how player battles change Dominion and seasonal rank. Compare actual loot and permanent losses instead of victory labels alone.", "Oyuncu savaşlarının Hâkimiyeti ve sezon sıralamasını nasıl değiştirdiğini öğren. Zafer etiketi yerine gerçek ganimeti ve kalıcı kayıpları karşılaştır."),
    l([
      "Dominion is the score used in seasonal standings. Scored player battles transfer it between opponents. In an ordinary raid, the attacker’s result combines carried loot and the defender’s permanent losses, then subtracts the attacker’s permanent losses.",
      "Losses count at resource value; the interface converts that value into points. The defender receives the opposite score change. Repelling an attack that destroys expensive ships can therefore earn Dominion.",
      "Wealth measures your holdings and is separate from Dominion. Building, mining and ordinary pirate or neutral-planet battles do not produce the same scored PvP transfer.",
    ], [
      "Hâkimiyet, sezon sıralamasında kullanılan puandır. Puanlanan oyuncu savaşlarında iki taraf arasında aktarılır. Normal akında saldıranın sonucu, taşınan ganimetle savunanın kalıcı kayıplarını toplar; saldıranın kalıcı kayıplarını çıkarır.",
      "Kayıplar kaynak değerleriyle hesaplanır; arayüz bu değeri puana çevirir. Savunanın puan değişimi, saldıranınkinin tersidir. Pahalı gemiler kaybettiren saldırıyı püskürtmek bu yüzden Hâkimiyet kazandırabilir.",
      "Servet, eldeki varlıkların değeridir ve Hâkimiyetten ayrıdır. Bina geliştirmek, madencilik yapmak, normal korsan veya tarafsız gezegen savaşı, puanlanan oyuncu savaşının aktarımını oluşturmaz.",
    ]),
    l([
      "Read the resources actually carried and units permanently lost. A victory grade does not state the score gain. A raid can win the battle but lose Dominion if its own losses cost too much.",
      "Joint attacks and supported defence adjust and allocate points under their own rules. Use the report’s participant details. Do not divide every group result equally or treat a leaderboard rank as a current fleet reading.",
    ], [
      "Gerçekten taşınan kaynakları ve kalıcı kaybedilen birimleri incele. Zafer derecesi, kazanılan puanı tek başına göstermez. Kendi kayıpların pahalıysa savaşı kazanıp Hâkimiyet kaybedebilirsin.",
      "Ortak saldırılar ve destekli savunma, puanı kendi kurallarıyla ayarlar ve dağıtır. Raporun katılımcı ayrıntılarını kullan. Her grup sonucunu eşit bölme; sıralamayı da güncel filo bilgisi sayma.",
    ]), ['combat.loot', 'clan.support', 'clan.joint-war']),
  topic('season', 'cycle', l('Season timing & final records', 'Sezon zamanı ve final kayıtları'),
    l("Check season start, phases and closing time. Plan orders and returns, then review final standings and rewards after the season.", "Sezon başlangıcını, evrelerini ve bitişini kontrol et. Siparişleri ve dönüşleri planla; sezon sonunda kesin sıralamayı ve ödülleri incele."),
    l([
      "Each galaxy has a season with a start, end and timed phases. The duration and phase boundaries are below. Some research and strategic equipment become available only after their required phase or time.",
      "Near closing, new orders and missions must fit the remaining season time. Monument holding ends at close and standings become final. The season recap records ranks, battles and notable results. A short period after closing lets you inspect the finished galaxy.",
    ], [
      "Her galaksi sezonunun başlangıcı, bitişi ve zamanlı evreleri vardır. Süre ve evre sınırları aşağıdadır. Bazı araştırmalar ve stratejik donanımlar, gereken evre veya saatten sonra açılır.",
      "Kapanışa yakın yeni sipariş ve görevler, kalan sezon süresine sığmalıdır. Sezon bitince anıtta kalma sona erer ve sıralama kesinleşir. Sezon özeti dereceleri, savaşları ve önemli sonuçları kaydeder. Kapanıştan sonra galaksiyi kısa bir süre inceleyebilirsin.",
    ]),
    l([
      "Check the final return before launching a slow mission. Placing an order does not guarantee it can finish after season close. Use the active season’s end time and any refusal shown by the game.",
      "The next galaxy starts a new competition. Recap records and cosmetic honours provide no combat bonus. Eligible rank rewards can supply next-season resources; check [[season.rewards|reward rules]] and your actual recap rather than assuming everything carries over.",
    ], [
      "Yavaş görev göndermeden önce son dönüş zamanını kontrol et. Sipariş vermek, sezon kapandıktan sonra tamamlanmayı garanti etmez. Aktif sezonun bitişini ve oyunun gösterdiği engeli dikkate al.",
      "Sonraki galaksi yeni rekabet başlatır. Sezon özeti ve görsel ödüller savaş bonusu vermez. Uygun derece ödülleri sonraki sezona kaynak sağlayabilir. Her şeyin taşındığını varsaymadan [[season.rewards|ödül kurallarını]] ve kendi sezon özetini kontrol et.",
    ]), ['season.dominion', 'season.rewards', 'galaxy.events']),
  topic('season', 'rewards', l('Progress & season rewards', 'İlerleme ve sezon ödülleri'),
    l("Claim completed gameplay goals and learn how reward stock affects capacity. Separate season-rank rewards from the once-per-account community bonus.", "Tamamlanan oyun hedeflerinin ödüllerini al; kapasiteye etkilerini öğren. Sezon derecesi ödülünü, hesap başına bir kez alınan topluluk bonusundan ayır."),
    l([
      "The Rewards panel lists goals for development, probes, raids against different planets, mining and pirates. Reaching a goal makes its reward available. You must claim it separately; completing the action does not automatically collect the prize.",
      "Each reward tier can be claimed once in its applicable season. Claimed resources enter the Store and may exceed capacity without being discarded. You may need to spend stock before collecting more from the Works. Reward resources follow ordinary raid-protection rules.",
      "Eligible final ranks with positive Dominion receive the stated resource reward for the next season. The table lists reward amounts. Your recap shows the reward actually granted to you.",
    ], [
      "Ödüller bölümü gelişim, sonda, farklı gezegenlere akın, madencilik ve korsan hedeflerini gösterir. Hedefe ulaşınca ödül alınabilir olur. Ödülü ayrıca almalısın; işlemi tamamlamak ödülü otomatik toplamaz.",
      "Her ödül seviyesi ilgili sezonda bir kez alınır. Kaynaklar Depoya eklenir; kapasiteyi aşınca silinmez. Havuzdan yeniden toplamak için önce kaynak harcaman gerekebilir. Ödül kaynakları normal akın ve koruma kurallarına bağlıdır.",
      "Belirtilen final derecelerine ulaşan, Hâkimiyeti pozitif oyuncular sonraki sezon için kaynak ödülü kazanır. Tabloda ödül miktarları vardır. Kendi sezon özetin, sana gerçekten verilen ödülü gösterir.",
    ]),
    l([
      "Open Rewards and claim an available tier with its claim action. Choose useful goals instead of risking a costly battle only to increase a counter.",
      "The community bonus has a separate confirmation process and can be claimed once per account. Joining another galaxy does not grant it again. Replaying the Academy is practice and gives no additional live-game reward.",
    ], [
      "Ödülleri aç ve alınabilir seviyeyi Al eylemiyle topla. Yalnız sayacı artırmak için pahalı savaşa girmek yerine yararlı hedefleri seç.",
      "Topluluk bonusunun ayrı doğrulama süreci vardır; hesap başına bir kez alınır. Yeni galaksiye katılmak tekrar bonus vermez. Akademi tekrarı eğitimdir; canlı oyunda yeni ödül sağlamaz.",
    ]), ['season.dominion', 'economy.resources', 'basics.quick-start']),
  topic('season', 'identity', l('Commander identity & cosmetics', 'Komutan kimliği ve görünümler'),
    l("Learn where commander names, country, clan and planet appearances are shown. Find rivals, chat and account controls while keeping reports private.", "Komutan adı, ülke, klan ve gezegen görünümlerinin nerede gösterildiğini öğren. Rakipleri, sohbeti ve hesap kontrollerini bul; raporlarını özel tut."),
    l([
      "Your commander name, country and clan appear on identity and standings screens. Your planet appearance changes its visuals, not production or combat statistics. It gives no additional attack permission.",
      "Rival marks are your private shortcuts to commanders you want to follow. Marking someone does not publish a declaration or reveal their private planets and reports. Probes and observations still determine what you know.",
    ], [
      "Komutan adın, ülken ve klanın kimlik ve sıralama ekranlarında görünür. Gezegen görünümü, üretimi veya savaş değerlerini değil görseli değiştirir. Ek saldırı hakkı sağlamaz.",
      "Rakip işaretleri, takip etmek istediğin komutanlara kişisel kısayoldur. İşaretlemek, herkese ilan yapmaz veya rakibin özel gezegen bilgilerini ve raporlarını açmaz. Bildiklerini yine sonda ve gözlemler belirler.",
    ]),
    l([
      "Use the menu for appearances, language, sound, announcements, feedback and account controls. Chat includes public language rooms and private conversations. Screenshots can reveal information your reports keep private.",
      "Privacy, terms, community and pricing pages explain their own subjects. Like this Wiki, they open without a game session. Do not include account credentials in chat or feedback when reporting a problem.",
    ], [
      "Görünümler, dil, ses, duyurular, geri bildirim ve hesap kontrolleri menüdedir. Sohbette herkese açık dil odaları ve özel konuşmalar bulunur. Ekran görüntüsü paylaşmak, özel raporundaki bilgiyi başkalarına gösterebilir.",
      "Gizlilik, koşullar, topluluk ve fiyat sayfaları ilgili konuları açıklar. Bu Wiki gibi oyun oturumu olmadan açılırlar. Sorun bildirirken hesap giriş bilgilerini sohbete veya geri bildirime yazma.",
    ]), ['intel.overview', 'season.silent-space', 'basics.controls']),
  topic('season', 'silent-space', l('Silent Space & returning', 'Sessiz Uzay ve dönüş'),
    l("Learn when inactivity moves your planets to Silent Space, which actions remain available and how to apply to return to your galaxy.", "Hareketsizlikte gezegenlerinin ne zaman Sessiz Uzay’a taşındığını, açık kalan işlemleri ve galaksine dönüş başvurusunu öğren."),
    l([
      "If you start no attack, building upgrade, research, ship or ground-defence order for 30 hours, your planets move to Silent Space. Logging in alone does not reset this timer. In the last 12 hours, the timer line below the top bar shows remaining time.",
      "Your planets and progress are preserved, and you can continue development. Resource production slows to 50% of normal. Raids, asteroid and debris gathering, pirate attacks, trade and convoy strikes are unavailable there. The move does not delete your account or reset your capital.",
      "Apply through the Silent Space menu while your former galaxy accepts return applications. When room opens, the oldest eligible application is considered. Active flights or insufficient planet space can delay a return even if you are first in the queue.",
    ], [
      "30 saat boyunca saldırı, bina geliştirme, araştırma, gemi veya yer savunması üretimi başlatmazsan gezegenlerin Sessiz Uzay’a taşınır. Yalnız giriş yapmak sayacı sıfırlamaz. Son 12 saatte üst çubuğun altındaki zamanlayıcı satırı kalan süreyi gösterir.",
      "Gezegenlerin ve ilerlemen korunur; geliştirmeye devam edebilirsin. Kaynak üretimi normal hızın %50’sine düşer. Akın, asteroit ve enkaz toplama, korsan saldırısı, ticaret ve konvoy saldırısı yapılamaz. Taşınma hesabını silmez veya ana gezegenini sıfırlamaz.",
      "Eski galaksin başvuru kabul ederken Sessiz Uzay menüsünden dönüşe başvur. Yer açılınca en eski uygun başvuru değerlendirilir. Aktif uçuş veya yetersiz gezegen alanı dönüşü geciktirebilir; ilk sırada olmak hemen dönüş garantisi değildir.",
    ]),
    l([
      "Check queue position, application status and the reason for any delay. A new period of inactivity can expire your application. Applying once does not reserve a place indefinitely.",
      "Plan ongoing orders and flight returns using the destination’s current state. The menu shows whether return applications are open and which condition is blocking your move.",
    ], [
      "Sıra konumunu, başvuru durumunu ve gecikme nedenini kontrol et. Yeniden hareketsizlik, başvurunun süresini doldurabilir. Bir kez başvurmak, süresiz yer ayırmaz.",
      "Devam eden siparişlerini ve uçuş dönüşlerini, hedef galaksinin güncel durumuna göre planla. Menü, başvuruların açık olup olmadığını ve taşınmayı engelleyen koşulu gösterir.",
    ]), ['season.cycle', 'fleet.flights', 'season.identity']),
];
