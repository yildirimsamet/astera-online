import { localized as l, type Localized, type WikiArticle, type WikiSection } from './model.js';
import { section } from './guides.js';

/**
 * DEVELOPMENT UPDATES, NEWEST FIRST.
 *
 * Each post describes one change that is live, in the player's terms: what changed,
 * why, and what it means for the next decision. Slugs start with the post date.
 */
function post(date: string, slug: string, title: Localized<string>, description: Localized<string>, en: readonly WikiSection[], tr: readonly WikiSection[], related: readonly string[]): WikiArticle {
  return { id: `updates.${date}-${slug}`, category: 'updates', slug: `${date}-${slug}`, title, description, updated: date, sections: l(en, tr), related };
}

const honorFairFights = post('2026-11-12', 'honor-fair-fights',
  l('Honor now weighs the fight you actually took on', 'Honor artık gerçekten göze aldığın savaşı tartıyor'),
  l('From 12 November your losses count only as far as the fight can pay, and a second raid on a much smaller commander within a day counts as bullying.', '12 Kasım’dan itibaren kayıpların savaşın getirebileceği kadar sayılır; çok daha küçük bir komutana bir gün içinde ikinci kez saldırmak zorbalıktır.'),
  [
    section('change', 'What changed',
      'Honor rewards attacks that carry real risk. Three things change for every attack launched from 12 November:',
      { kind: 'list', items: [
        'Your losses count as far as the fight can pay. With the full return, every ship you lose costs Honor as before. With the half return, losses cost half. Where the navies are too far apart to earn anything, losing ships no longer costs Honor either.',
        'Ships destroyed fighting other commanders leave the 24-hour peak at once. A commander who has just lost a fleet is no longer measured as if it still had it, and neither are you. Ships that leave your navy any other way, including losses to pirates and neutral worlds, still count for the rest of the day.',
        'A lower-tier commander is a weaker target only when their navy is less than a third of yours, not half. Between 1.5 : 1 and 3 : 1 you now earn half Honor instead of a sanction.',
      ] },
      'One new limit comes with it: attacking a commander whose navy is less than a third of yours a second time within 24 hours counts as bullying at any tier. Against an equal or higher tier the first raid earns and costs nothing; the second reduces Honor, and each further return costs more.'),
    section('example', 'A worked example',
      'Suppose your navy is four times a same-tier rival’s. Your first raid destroys their defence and you lose a few ships: your Honor does not move. If you come back the same day, the harm you cause reduces your Honor. Wait a day, or pick a rival whose navy is at least a third of yours, and the fight counts normally again.'),
    section('why', 'Why we changed it',
      'Raids won at fair odds still showed negative Honor, because every lost ship was charged in full even when the fight could not pay anything. At the same time a strong commander could raid the same small commander again and again at no Honor cost. The new rules charge risk in proportion to what the fight can return and make repeated raids on much smaller commanders cost Honor.'),
    section('what-it-means', 'What it means for you',
      'Each launch freezes the rule it was sent under, so attacks already in flight and battles already fought keep their result; nobody’s past Honor moves. Defenders keep their existing bands, and defending never reduces Honor. Before you launch, the Honor card on the launch sheet tells you when the attack would be a second raid.',
      'The [[guides.how-to-play|how to play guide]] explains how Honor sits next to Dominion, and [[combat.eligibility|attack eligibility]] covers who you may attack at all.'),
  ],
  [
    section('change', 'Ne değişti?',
      'Honor, gerçek risk taşıyan saldırıları ödüllendirir. 12 Kasım’dan itibaren gönderilen her saldırıda üç şey değişiyor:',
      { kind: 'list', items: [
        'Kayıpların, savaşın getirebileceği kadar sayılır. Tam karşılıkta kaybettiğin her gemi eskisi gibi Honor’a mal olur. Yarım karşılıkta kayıpların yarısı sayılır. Donanmalar arasındaki fark hiçbir şey kazandırmayacak kadar büyükse gemi kaybetmek de artık Honor düşürmez.',
        'Başka komutanlarla savaşta yok edilen gemiler 24 saatlik en yüksek değerden hemen düşer. Az önce filosunu kaybetmiş bir komutan artık hâlâ o filoya sahipmiş gibi ölçülmez; sen de ölçülmezsin. Korsanlara ve tarafsız gezegenlere verilen kayıplar dahil, donanmandan başka bir yolla ayrılan gemiler günün geri kalanında sayılmaya devam eder.',
        'Alt kademedeki bir komutan, donanması seninkinin yarısından değil üçte birinden azsa zayıf hedef sayılır. 1,5 : 1 ile 3 : 1 arasında artık ceza yerine yarım Honor kazanırsın.',
      ] },
      'Bununla birlikte yeni bir sınır geliyor: donanması seninkinin üçte birinden az olan bir komutana 24 saat içinde ikinci kez saldırmak, kademe fark etmeksizin zorbalık sayılır. Eşit veya üst kademeye karşı ilk akın ne kazandırır ne kaybettirir; ikincisi Honor’u azaltır ve her yeni tekrar daha fazla kaybettirir.'),
    section('example', 'Örnekle',
      'Donanmanın aynı kademedeki bir rakibinkinin dört katı olduğunu düşün. İlk akınında onun savunmasını yok ediyor, birkaç gemi kaybediyorsun: Honor’un değişmez. Aynı gün geri dönersen verdiğin zarar Honor’unu azaltır. Bir gün beklersen ya da donanması seninkinin en az üçte biri olan bir rakip seçersen savaş yeniden normal sayılır.'),
    section('why', 'Neden değiştirdik?',
      'Makul oranla kazanılan akınlar yine de eksi Honor yazıyordu; çünkü savaş hiçbir şey getiremese bile kaybedilen her gemi tam sayılıyordu. Aynı zamanda güçlü bir komutan aynı küçük komutana Honor bedeli ödemeden tekrar tekrar saldırabiliyordu. Yeni kurallar riski savaşın getirebileceği ölçüde sayıyor ve çok daha küçük komutanlara tekrarlanan akınları Honor’a mal ediyor.'),
    section('what-it-means', 'Senin için anlamı',
      'Her kalkış, gönderildiği kuralı dondurur; yoldaki saldırılar ve yapılmış savaşlar sonuçlarını korur, kimsenin geçmiş Honor puanı değişmez. Savunanlar mevcut bantlarını korur ve savunmak Honor’u hiçbir zaman azaltmaz. Göndermeden önce, gönderim ekranındaki Honor kartı saldırının ikinci akın olacağını söyler.',
      '[[guides.how-to-play|Nasıl oynanır rehberi]] Honor’un Hâkimiyet’in yanındaki yerini, [[combat.eligibility|saldırı uygunluğu]] sayfası da kime saldırabileceğini anlatır.'),
  ],
  ['guides.how-to-play', 'combat.eligibility', 'season.dominion']);

const honorBands = post('2026-11-09', 'honor-attack-bands',
  l('Fair fights now earn Honor at sensible odds', 'Dengeli savaşlar artık makul oranlarda Honor kazandırıyor'),
  l('Attacks launched since 9 November use wider Honor bands for each tier difference, so a fight you win at reasonable odds no longer costs you Honor.', '9 Kasım’dan itibaren gönderilen saldırılar her kademe farkı için daha geniş Honor bantları kullanıyor; makul oranla kazandığın bir savaş artık Honor kaybettirmiyor.'),
  [
    section('change', 'What changed',
      'Honor is the season ladder that rewards choosing fair fights. Before 9 November, an attack only earned full Honor when the defender’s navy was close to yours, and a lower-tier target counted as weak as soon as its navy fell below three quarters of yours. In practice that punished ordinary, sensible attacks: many raids won at a modest advantage still scored negative Honor.',
      'Since 9 November, every new attack compares your whole navy with the defender’s, each at its highest point over the last 24 hours, and uses a band that depends on the tier difference:',
      { kind: 'table', caption: 'Honor return by your navy compared with the defender’s', columns: ['Defender', 'Full Honor up to', 'Half Honor up to'], rows: [
        ['Lower tier', '1.5 : 1', '2 : 1'], ['Same tier', '2 : 1', '3 : 1'], ['Higher tier', '2.5 : 1', '3 : 1'],
      ] },
      'A lower-tier defender whose navy is under half of yours still counts as a weak target, and pressuring weak targets can still cost Honor. Beyond 3 : 1 against an equal or higher tier, an attack earns no Honor but no longer counts as bullying a smaller commander.'),
    section('example', 'A worked example',
      'Suppose your navy, at its peak over the last day, is twice the size of a same-tier rival’s. That is exactly 2 : 1, so a win earns full Honor. If your navy were two and a half times theirs, the same win would earn half. Against a lower-tier commander the bands are tighter: at 1.5 : 1 you still earn full Honor, at 1.8 : 1 half, and once their navy is less than half of yours they count as a weak target. Against a higher tier you can bring up to two and a half times their navy and still earn full Honor, because a higher-tier commander has stronger hulls and research behind each ship.'),
    section('why', 'Why we changed it',
      'Honor should push commanders toward fights worth watching, not punish the attacks a normal season is built on. Players told us that winning at sensible odds felt like losing, and the scores agreed. The new bands keep the line against picking on much weaker commanders while letting a well-prepared raid be rewarded.'),
    section('what-it-means', 'What it means for you',
      'Each launch freezes the rule it was sent under, so attacks already in flight and battles already fought keep their old result; nobody’s past Honor moves. Defenders keep their existing bands. When you plan your next raid, compare your navy with the target’s at its recent peak, not only with the fleet you send: Honor looks at whole navies.',
      'The [[guides.how-to-play|how to play guide]] explains how Honor sits next to Dominion, and [[combat.eligibility|attack eligibility]] covers who you may attack at all.'),
  ],
  [
    section('change', 'Ne değişti?',
      'Honor, dengeli savaş seçmeyi ödüllendiren sezon sıralamasıdır. 9 Kasım’dan önce bir saldırı ancak savunanın donanması seninkine yakınsa tam Honor kazandırıyordu; alt kademedeki bir hedef de donanması seninkinin dörtte üçünün altına düştüğü anda zayıf sayılıyordu. Pratikte bu, sıradan ve makul saldırıları cezalandırıyordu: küçük bir üstünlükle kazanılan birçok akın yine de eksi Honor yazıyordu.',
      '9 Kasım’dan itibaren her yeni saldırı, senin bütün donanmanı savunanınkiyle, ikisinin de son 24 saatteki en yüksek değeriyle karşılaştırır ve kademe farkına bağlı bir bant kullanır:',
      { kind: 'table', caption: 'Donanmanın savunanınkine oranına göre Honor getirisi', columns: ['Savunan', 'Tam Honor şu orana kadar', 'Yarım Honor şu orana kadar'], rows: [
        ['Alt kademe', '1,5 : 1', '2 : 1'], ['Aynı kademe', '2 : 1', '3 : 1'], ['Üst kademe', '2,5 : 1', '3 : 1'],
      ] },
      'Donanması seninkinin yarısının altında olan alt kademedeki savunan hâlâ zayıf hedef sayılır ve zayıf hedeflere baskı yapmak hâlâ Honor kaybettirebilir. Eşit veya üst kademeye karşı 3 : 1’in ötesinde saldırı Honor kazandırmaz ama artık küçük bir komutana zorbalık sayılmaz.'),
    section('example', 'Örnekle',
      'Donanmanın son bir gündeki en yüksek değerinin, aynı kademedeki bir rakibinkinin iki katı olduğunu düşün. Bu tam olarak 2 : 1’dir; kazanılan savaş tam Honor getirir. Donanman onunkinin iki buçuk katı olsaydı aynı zafer yarım Honor getirirdi. Alt kademedeki bir komutana karşı bantlar daha dardır: 1,5 : 1’de hâlâ tam Honor, 1,8 : 1’de yarım Honor kazanırsın; onun donanması seninkinin yarısının altına indiğinde zayıf hedef sayılır. Üst kademeye karşı ise onun donanmasının iki buçuk katına kadar getirip yine tam Honor kazanabilirsin, çünkü üst kademedeki bir komutanın her gemisinin arkasında daha güçlü gövdeler ve araştırmalar vardır.'),
    section('why', 'Neden değiştirdik?',
      'Honor, komutanları izlemeye değer savaşlara yöneltmeli; normal bir sezonun üzerine kurulduğu saldırıları cezalandırmamalı. Oyuncular makul oranla kazanmanın kaybetmek gibi hissettirdiğini söyledi; puanlar da bunu doğruladı. Yeni bantlar çok daha zayıf komutanları hedef almaya karşı çizgiyi korurken iyi hazırlanmış bir akının ödüllendirilmesine izin veriyor.'),
    section('what-it-means', 'Senin için anlamı',
      'Her kalkış, gönderildiği kuralı dondurur; yoldaki saldırılar ve yapılmış savaşlar eski sonuçlarını korur, kimsenin geçmiş Honor puanı değişmez. Savunanlar mevcut bantlarını korur. Bir sonraki akınını planlarken yalnız gönderdiğin filoyu değil, donanmanı hedefin yakın zamandaki en yüksek değeriyle karşılaştır: Honor bütün donanmalara bakar.',
      '[[guides.how-to-play|Nasıl oynanır rehberi]] Honor’un Hâkimiyet’in yanındaki yerini, [[combat.eligibility|saldırı uygunluğu]] sayfası da kime saldırabileceğini anlatır.'),
  ],
  ['guides.how-to-play', 'combat.eligibility', 'season.dominion']);

const startingPackage = post('2026-11-03', 'first-season-package',
  l('Every new commander now starts with a working world', 'Her yeni komutan artık çalışan bir dünyayla başlıyor'),
  l('Your first season now begins with stock, developed buildings, installed sensors and a small fleet, granted once per account, so the first hour is spent deciding rather than waiting.', 'İlk sezonun artık stok, gelişmiş binalar, kurulu cihazlar ve küçük bir filoyla başlıyor; hesap başına bir kez veriliyor ve ilk saat beklemekle değil karar vermekle geçiyor.'),
  [
    section('change', 'What changed',
      'New commanders used to arrive with an almost empty planet and spend their first hour waiting for the first upgrades to finish. Since 3 November, your first season in a galaxy starts with a starting package on your world, granted once per account:',
      { kind: 'list', items: [
        'Store: 1,500 alloy, 1,000 crystal and 50 deuterium, with a little production already waiting in the Works.',
        'Buildings: Command Core 3, Alloy Refinery 2, Crystal Extractor 2, and Store, Shipyard and Hangar at level 1.',
        'Instruments: Telescope 3, Radar 2 and Aegis 1, with an Uplink already in orbit.',
        'Ships: three Darts, one Warden, one Courier and one Prospector.',
      ] },
      'The package arrives whether or not you finish or skip the training, and replaying the training or joining later seasons does not grant it again.',
      'Each piece has a job. The Uplink is what allows Telescope and Radar on a world, so you no longer spend an orbit slot and an install before your first observation. Telescope 3 gives two silent watch slots, enough to follow two neighbours’ fleets. Radar 2 warns you of incoming fleets with their arrival time. Aegis 1 holds 150 shield points and refills 35% of them every hour. One Dart with the Courier is exactly what an unknown signal asks for, and the Prospector can start mining the first passing asteroid.'),
    section('why', 'Why we changed it',
      'Astera is a game about information and decisions: choosing a target, reading a report, deciding what to risk. None of that can happen while a new commander waits for a level 1 refinery. With working sensors and a first fleet, you can place a watch, answer an unknown signal or send a first probe within minutes of arriving, which is where the game actually starts.'),
    section('what-it-means', 'What it means for you',
      'Use your protection window to learn with real tools rather than to build them. Collect the Works, raise your producers while their payback is short, put your two Telescope watches on neighbours and answer your first unknown signal with a Dart and the Courier. The [[guides.how-to-play|how to play guide]] walks through that first day, and the [[guides.economy|economy guide]] shows which upgrades pay back fastest.'),
  ],
  [
    section('change', 'Ne değişti?',
      'Yeni komutanlar eskiden neredeyse boş bir gezegene iner ve ilk saatlerini ilk yükseltmelerin bitmesini bekleyerek geçirirdi. 3 Kasım’dan itibaren bir galaksideki ilk sezonun, dünyanda hesap başına bir kez verilen bir başlangıç paketiyle başlıyor:',
      { kind: 'list', items: [
        'Depo: 1.500 alaşım, 1.000 kristal ve 50 döteryum; Havuzda da toplanmayı bekleyen biraz üretim.',
        'Binalar: Komuta Çekirdeği 3, Alaşım Rafinerisi 2, Kristal Ocağı 2; Depo, Tersane ve Hangar 1. seviyede.',
        'Cihazlar: Teleskop 3, Radar 2 ve Aegis 1; yörüngede kurulu bir Anten.',
        'Gemiler: üç Ok, bir Muhafız, bir Kurye ve bir Kazıcı.',
      ] },
      'Paket, eğitimi tamamlasan da atlasan da gelir; eğitimi yeniden oynamak veya sonraki sezonlara katılmak onu tekrar vermez.',
      'Her parçanın bir görevi var. Anten, bir dünyada Teleskop ve Radar kurulmasını sağlar; artık ilk gözleminden önce bir yörünge yuvası ve bir kurulum harcamazsın. Teleskop 3, iki komşunun filosunu izlemeye yetecek iki sessiz gözlem yuvası verir. Radar 2 gelen filoları varış zamanlarıyla haber verir. Aegis 1, 150 kalkan puanı tutar ve her saat bunun %35’ini yeniler. Bir Ok ve Kurye, bilinmeyen bir sinyalin istediğinin tam karşılığıdır; Kazıcı da geçen ilk asteroitte madenciliğe başlayabilir.'),
    section('why', 'Neden değiştirdik?',
      'Astera bilgi ve karar üzerine bir oyundur: hedef seçmek, rapor okumak, neyi riske atacağına karar vermek. Yeni bir komutan 1. seviye bir rafineriyi beklerken bunların hiçbiri olamaz. Çalışan cihazlar ve ilk bir filoyla, varışından birkaç dakika içinde bir gözlem koyabilir, bilinmeyen bir sinyali yanıtlayabilir ya da ilk sondanı gönderebilirsin; oyunun gerçekten başladığı yer orasıdır.'),
    section('what-it-means', 'Senin için anlamı',
      'Koruma süreni araçları kurmak için değil, gerçek araçlarla öğrenmek için kullan. Havuzu topla, geri ödemeleri kısayken üretim binalarını yükselt, iki Teleskop gözlemini komşularına koy ve ilk bilinmeyen sinyalini bir Ok ve Kurye ile yanıtla. [[guides.how-to-play|Nasıl oynanır rehberi]] o ilk günü adım adım anlatır; [[guides.economy|ekonomi rehberi]] de hangi yükseltmelerin en hızlı geri ödediğini gösterir.'),
  ],
  ['guides.how-to-play', 'guides.economy', 'basics.quick-start']);

const phoneAlerts = post('2026-10-31', 'phone-raid-alerts',
  l('Raid alerts on your phone: the Notification Center', 'Telefonuna akın uyarısı: Bildirim Merkezi'),
  l('The Android app can now warn you before an attack lands, even with the game closed. Alerts are paid in deuterium from a wallet, and you choose how early they arrive.', 'Android uygulaması artık bir saldırı varmadan önce, oyun kapalıyken bile seni uyarabiliyor. Uyarılar bir cüzdandaki döteryumla ödeniyor ve ne kadar erken geleceğini sen seçiyorsun.'),
  [
    section('change', 'What changed',
      'A persistent game keeps running while you sleep, and the most painful moment in Astera used to be waking up to a battle report you could have prevented. The Notification Center, built once from the commander menu in the Android app, now sends a phone alert when your Radar sees an attack coming toward any of your worlds, even with the game closed.',
      'Three kinds of alert exist. An incoming attack alert covers a fleet or a joint clan fleet on its way to one of your worlds. A strategic weapon alert covers a Death Star and costs one and a half times as much. A probe alert is sent at once when a probe is caught over one of your worlds.'),
    section('how', 'How it works',
      'Alerts are paid in deuterium from the center’s wallet, one alert at a time as each one goes out. You top the wallet up from any world; deuterium moved into the wallet cannot be moved back and is spent only on alerts. You also choose the timing: three, five or fifteen minutes before impact, or as soon as your Radar sees the fleet. The earlier the alert, the more deuterium each one uses, and if your Radar only sees the fleet later than your chosen timing, the alert goes out the moment it does.',
      'Nothing is charged for an alert that cannot reach you. If your phone does not allow notifications, no alert is sent and no deuterium leaves the wallet, and if the wallet cannot pay for the next alert, it is not sent until you add more.',
      'Choose the timing by what you would do with the warning. Three minutes is enough to spend the Store on an upgrade so there is less to loot. Fifteen minutes can be enough to bring a nearby fleet home, finish a repair or change your defence posture. “On radar” gives the longest warning your Radar allows and costs the most per alert. The price of an alert follows your own deuterium production, so it stays in proportion as your economy grows.'),
    section('what-it-means', 'What it means for you',
      'An alert is only as early as your Radar allows, because the center cannot warn you about a fleet it does not see. A higher Radar gives you a longer warning range and, from level 4, an estimate of the attack’s strength. Pair the two: the alert wakes you, the Radar tells you what is coming, and the [[guides.defence|defence guide]] lists what to do in the minutes before impact.'),
  ],
  [
    section('change', 'Ne değişti?',
      'Kalıcı bir oyun sen uyurken de çalışır; Astera’daki en acı an, önleyebileceğin bir savaş raporuyla uyanmaktı. Android uygulamasında komutan menüsünden bir kez kurulan Bildirim Merkezi, artık Radarın herhangi bir dünyana gelen saldırıyı gördüğünde, oyun kapalıyken bile telefonuna uyarı gönderiyor.',
      'Üç tür uyarı vardır. Gelen saldırı uyarısı, dünyalarından birine yönelen bir filoyu veya ortak klan filosunu kapsar. Stratejik silah uyarısı bir Ölüm Yıldızını kapsar ve bir buçuk katı maliyetlidir. Sonda uyarısı, dünyalarından birinin üstünde bir sonda yakalandığında hemen gönderilir.'),
    section('how', 'Nasıl çalışır?',
      'Uyarılar, merkezin cüzdanındaki döteryumla ve her biri gönderildiği anda ödenir. Cüzdanı herhangi bir dünyandan doldurursun; cüzdana aktarılan döteryum geri taşınamaz ve yalnız uyarılara harcanır. Zamanlamayı da sen seçersin: çarpmadan üç, beş veya on beş dakika önce ya da Radarın filoyu gördüğü anda. Uyarı ne kadar erkense her biri o kadar çok döteryum kullanır; Radarın filoyu seçtiğin zamanlamadan daha geç görürse uyarı gördüğü anda gider.',
      'Sana ulaşamayacak bir uyarı için hiçbir şey alınmaz. Telefonun bildirimlere izin vermiyorsa uyarı gönderilmez ve cüzdandan döteryum çıkmaz; cüzdan bir sonraki uyarıyı ödeyemiyorsa sen ekleyene kadar uyarı gönderilmez.',
      'Zamanlamayı uyarıyla ne yapacağına göre seç. Üç dakika, yağmalanacak daha az şey kalsın diye Depoyu bir yükseltmeye harcamaya yeter. On beş dakika, yakındaki bir filoyu eve getirmeye, bir onarımı bitirmeye ya da savunma duruşunu değiştirmeye yetebilir. “Radarda”, Radarının izin verdiği en uzun uyarıyı verir ve uyarı başına en pahalısıdır. Bir uyarının fiyatı kendi döteryum üretimini izler; böylece ekonomin büyüdükçe orantılı kalır.'),
    section('what-it-means', 'Senin için anlamı',
      'Uyarı ancak Radarının izin verdiği kadar erkendir; merkez görmediği bir filo için seni uyaramaz. Daha yüksek bir Radar daha uzun bir uyarı menzili ve 4. seviyeden itibaren saldırının güç tahminini verir. İkisini birlikte kullan: uyarı seni uyandırır, Radar neyin geldiğini söyler; [[guides.defence|savunma rehberi]] de çarpmadan önceki dakikalarda yapılacakları listeler.'),
  ],
  ['guides.defence', 'instrument.RADAR', 'intel.watches']);

const combatV3 = post('2026-10-26', 'combat-v3-and-simulator',
  l('Combat v3: random targeting, a new loss table and the battle simulator', 'Savaş v3: rastgele hedefleme, yeni kayıp tablosu ve savaş simülatörü'),
  l('Shots now pick any living armed target, the stronger side’s average losses are published per power ratio, and you can replay any battle report in the new simulator.', 'Atışlar artık herhangi bir canlı silahlı hedefi seçiyor, güçlü tarafın ortalama kayıpları her güç oranı için yayımlanıyor ve her savaş raporunu yeni simülatörde yeniden oynatabiliyorsun.'),
  [
    section('change', 'What changed',
      'Three things changed in how battles resolve. First, targeting: every shot now picks any living armed enemy at random and hits it with that class’s matchup multiplier. Previously ships fired at their counter class first, which let a smaller, carefully mixed line out-trade a larger fleet.',
      'Second, the stronger side’s losses. The outmatched side manoeuvres, so each of the stronger side’s hits does less the wider its advantage is, up to 4×. That handicap was redrawn so that the stronger side always loses less than the weaker one, and the game now publishes the average result at each power ratio: about 54% of the stronger side lost at 1.2 : 1, 30% at 1.6 : 1, 13% at 2 : 1 and 3% at 3 : 1.',
      'Third, a battle simulator. You can open it from Help in the menu, or press “Try in simulator” on any battle report to load the forces that actually fought.'),
    section('why', 'Why we changed it',
      'A battle should reward the commander who brought more and better-matched force, while still making every victory cost something. Counter-first targeting made results hard to predict and sometimes inverted them. Random targeting with class multipliers keeps classes decisive without letting a clever mix beat a much bigger fleet, and publishing the loss table turns “will I win?” into the more useful question “what will this win cost?”.'),
    section('what-it-means', 'What it means for you',
      'Plan with averages, not exact matchups. Against a mixed defence, estimate the average multiplier your classes will get, not their best case. Use the published table as a price list before you launch, and use the simulator after a surprising report to see which part of the battle went differently. The [[guides.battles-and-reports|battle guide]] walks through the whole model, and the [[guides.fleet-building|fleet guide]] shows how to build for mixed defences. Your existing ships and research carry over unchanged; only the way they fight was redrawn.'),
  ],
  [
    section('change', 'Ne değişti?',
      'Savaşların çözülme biçiminde üç şey değişti. Birincisi hedefleme: her atış artık rastgele herhangi bir canlı silahlı düşmanı seçiyor ve o sınıfın eşleşme çarpanıyla vuruyor. Önceden gemiler önce karşı sınıflarına ateş ederdi; bu da daha küçük ama özenle karıştırılmış bir hattın daha büyük bir filoyu alt etmesine izin veriyordu.',
      'İkincisi güçlü tarafın kayıpları. Zayıf taraf manevra yapar; güçlü tarafın üstünlüğü ne kadar genişse, 4 kata kadar, her vuruşu o kadar az etkili olur. Bu dezavantaj, güçlü tarafın her zaman zayıf taraftan az kaybedeceği biçimde yeniden çizildi ve oyun artık her güç oranındaki ortalama sonucu yayımlıyor: güçlü taraf 1,2 : 1’de yaklaşık %54, 1,6 : 1’de %30, 2 : 1’de %13, 3 : 1’de %3 kaybeder.',
      'Üçüncüsü bir savaş simülatörü. Menüdeki Yardım bölümünden açabilir ya da herhangi bir savaş raporunda “Simülatörde dene” diyerek gerçekten savaşan kuvvetleri yükleyebilirsin.'),
    section('why', 'Neden değiştirdik?',
      'Bir savaş, daha fazla ve daha iyi eşleşmiş kuvvet getiren komutanı ödüllendirmeli; ama yine de her zafere bir bedel ödetmeli. Önce karşı sınıfa ateş etmek sonuçları tahmin etmeyi zorlaştırıyor ve bazen tersine çeviriyordu. Sınıf çarpanlı rastgele hedefleme, akıllıca bir karışımın çok daha büyük bir filoyu yenmesine izin vermeden sınıfları belirleyici tutuyor; kayıp tablosunu yayımlamak da “kazanır mıyım?” sorusunu daha faydalı olan “bu zafer neye mal olur?” sorusuna dönüştürüyor.'),
    section('what-it-means', 'Senin için anlamı',
      'Tam eşleşmelerle değil ortalamalarla planla. Karışık bir savunmaya karşı sınıflarının en iyi durumunu değil, alacakları ortalama çarpanı tahmin et. Yayımlanan tabloyu kalkıştan önce bir fiyat listesi gibi, simülatörü de şaşırtıcı bir rapordan sonra savaşın hangi kısmının farklı gittiğini görmek için kullan. [[guides.battles-and-reports|Savaş rehberi]] bütün modeli, [[guides.fleet-building|filo rehberi]] de karışık savunmalara karşı nasıl filo kurulacağını anlatır. Mevcut gemilerin ve araştırmaların değişmeden kalır; yalnız savaşma biçimleri yeniden çizildi.'),
  ],
  ['guides.battles-and-reports', 'guides.fleet-building', 'combat.model']);

export const updateArticles: readonly WikiArticle[] = [honorFairFights, honorBands,startingPackage, phoneAlerts, combatV3];
