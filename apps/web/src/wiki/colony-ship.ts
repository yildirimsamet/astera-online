import { starter as en } from '../i18n/locales/en/starter.js';
import { starter as tr } from '../i18n/locales/tr/starter.js';
import { STARTER } from '@astera/rules';
import { topic } from './concepts.js';
import { number } from './facts.js';
import { localized as l, type WikiArticle } from './model.js';

const { pvp, carry, parts } = STARTER;
const idleHours = STARTER.idleMs / 3_600_000;

/** Plan §6: what a ship is, the galaxy it wakes in, and the way out. Figures come from the rules. */
export const colonyShipArticles: readonly WikiArticle[] = [
  topic('basics', 'colony-ship', l('Your colony ship', 'Koloni gemin'),
    l('A new commander starts on a damaged colony ship. Repairs open every system, one at a time.', 'Yeni komutan arızalı bir koloni gemisinde başlar. Her sistemi onarımlar sırayla açar.'),
    l([
      `The ship has five systems: Refinery, Survey, Defence, Cargo and Drive. It starts with ${number(STARTER.opening.alloy, 'en')} alloy, ${number(STARTER.opening.crystal, 'en')} crystal and a working refinery.`,
      'Each repair costs resources and time, runs while you are away, and may open a new part of the game: fleets, probes, research, attacks. A system that is not repaired stays closed.',
      en.handbook.crates.body,
      'Production waits in the machine until you collect it. Half of what waits there can be taken in a raid, along with a share of your holds.',
    ], [
      `Geminin beş sistemi vardır: Rafineri, Keşif, Savunma, Kargo ve Motor. ${number(STARTER.opening.alloy, 'tr')} alaşım, ${number(STARTER.opening.crystal, 'tr')} kristal ve çalışan bir rafineriyle başlar.`,
      'Her onarım kaynak ve süre ister, sen yokken de sürer ve oyunun yeni bir parçasını açabilir: filo, sonda, araştırma, saldırı. Onarılmamış sistem kapalı kalır.',
      tr.handbook.crates.body,
      'Üretim sen toplayana kadar makinede bekler. Bekleyenin yarısı ve ambarının bir payı akında alınabilir.',
    ]),
    l([
      'Pick the repair that opens what you need next. The ship screen shows what each repair opens before you pay for it.',
      'Leave something running when you log off. A repair or a flight is a reason to come back.',
    ], [
      'Sıradaki ihtiyacını açan onarımı seç. Gemi ekranı her onarımın neyi açtığını ödemeden önce gösterir.',
      'Çıkarken bir şeyi çalışır bırak. Süren onarım veya uçuş geri dönmek için bir nedendir.',
    ]), ['basics.starter-galaxy', 'basics.the-jump']),
  topic('basics', 'starter-galaxy', l('The starter galaxies', 'Başlangıç galaksileri'),
    l('Small galaxies around the main one, where ships meet, fight and prepare for the jump.', 'Ana galaksinin çevresindeki küçük galaksiler. Gemiler burada karşılaşır, savaşır ve göçe hazırlanır.'),
    l([
      `A starter galaxy holds ${String(STARTER.capacity)} ships. Everyone in it is a rival: they raid, they get raided, they leave. When one fills up, a new one opens. A galaxy that has room again takes new ships.`,
      `Battles run at half the main game's tempo, and a ship can still die in them. Outposts open with the Shipyard. Attacking a ship needs your own Aegis and one battle behind you, and with the Aegis up your ship can be attacked too. The first Aegis repair gives a ${String(pvp.shieldHours)}-hour shield. Attacking ends your own shield early.`,
      `One commander can attack the same ship ${String(pvp.bashLimit)} times in ${String(pvp.bashWindowMinutes / 60)} hours, and a ship can be raided successfully ${String(pvp.dailyRaidCap)} times a day.`,
      `A ship with no progress for ${String(idleHours)} hours goes quiet: it leaves the map and gives up its place, and it comes back when its commander does.`,
    ], [
      `Bir başlangıç galaksisi ${String(STARTER.capacity)} gemi alır. İçindeki herkes rakibindir: akın eder, akın yer, gider. Galaksi dolunca yenisi açılır. Yeri boşalan galaksi yeniden gemi alır.`,
      `Savaşlar ana oyunun yarı temposunda geçer, gemi yine de yok olabilir. Karakollar Tersane ile açılır. Gemiye saldırmak kendi Aegis’ini ve arkanda bir savaşı ister; Aegis açıkken senin gemine de saldırılabilir. İlk Aegis onarımı ${String(pvp.shieldHours)} saatlik kalkan verir. Saldırmak kendi kalkanını erken bitirir.`,
      `Bir komutan aynı gemiye ${String(pvp.bashWindowMinutes / 60)} saatte ${String(pvp.bashLimit)} kez saldırabilir. Bir gemi günde ${String(pvp.dailyRaidCap)} kez başarıyla yağmalanabilir.`,
      `${String(idleHours)} saat ilerleme kaydetmeyen gemi sessize alınır: haritadan çekilir, yerini bırakır, komutanı dönünce geri gelir.`,
    ]),
    l([
      'Keep your fleet flying when you log off: ships in flight cannot be raided, the ones at home can.',
      'Read a neighbour with a probe before you fly. Report and reality drift apart with every minute.',
    ], [
      'Çıkarken filonu uçuşta bırak: uçuştaki gemiler yağmalanamaz, evdekiler yağmalanabilir.',
      'Uçmadan önce komşunu sondayla oku. Rapor ile gerçek her dakika biraz daha ayrılır.',
    ]), ['basics.colony-ship', 'basics.the-jump']),
  topic('basics', 'the-jump', l('The jump', 'Göç'),
    l('How a finished ship reaches the main galaxy, what it carries and what it leaves behind.', 'Tamamlanan geminin ana galaksiye nasıl ulaştığı, ne taşıdığı ve geride ne bıraktığı.'),
    l([
      `The jump needs a finished Drive, ${String(parts.needed)} thrust parts and ${String(STARTER.fuelForJump)} deuterium in the tank. Parts lie in wrecks and guarded outposts, and whoever arrives first takes them.`,
      `You can carry up to ${number(carry.alloy, 'en')} alloy, ${number(carry.crystal, 'en')} crystal, ${String(carry.deuterium)} deuterium and ${String(carry.ships)} ships. Everything else stays behind and is lost. The ship becomes your first planet, with the first-season package and a 72-hour shield.`,
      'The jump does not need the Aegis: it is a choice that opens your ship to attacks and pirates.',
      'The jump is one way, and repairs and research done on the ship stay with the ship.',
    ], [
      `Göç için bitmiş bir Motor, ${String(parts.needed)} itki parçası ve depoda ${String(STARTER.fuelForJump)} Döteryum gerekir. Parçalar enkazlarda ve korumalı karakollarda bulunur, önce varan alır.`,
      `En çok ${number(carry.alloy, 'tr')} alaşım, ${number(carry.crystal, 'tr')} kristal, ${String(carry.deuterium)} Döteryum ve ${String(carry.ships)} gemi taşırsın. Gerisi geride kalır ve kaybolur. Gemin ilk gezegenin olur, ilk sezon paketi ve 72 saatlik kalkan alırsın.`,
      'Göç Aegis istemez: Aegis, gemini saldırılara ve korsanlara açan bir seçimdir.',
      'Göç tek yönlüdür. Gemideki onarım ve araştırma gemide kalır.',
    ]),
    l([
      'Choose where to land: a quiet address is safer, a crowded one has targets nearby and makes you one.',
      'Spend what you cannot carry before you leave. Near the end of a season the jump waits for the next one.',
    ], [
      'Nereye ineceğini seç: sakin adres daha güvenlidir, kalabalık adreste hedef yakındır, sen de hedef olursun.',
      'Taşıyamayacağını gitmeden harca. Sezon sonuna yakın göç bir sonraki sezonu bekler.',
    ]), ['basics.colony-ship', 'basics.starter-galaxy']),
];
