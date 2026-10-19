import type { Language } from '../../i18n/languages.js';

export interface LandingCopy {
  title: string; description: string; eyebrow: string; headline: [string, string]; intro: string;
  explore: string; skip: string; scroll: string; art: string; guide: string;
  chapters: [Chapter, Chapter, Chapter, Chapter];
  shipsTitle: string; shipsIntro: string; ships: [string, string, string];
  startTitle: string; steps: [Step, Step, Step]; faqTitle: string; faq: [Step, Step, Step, Step];
  readingTitle: string; readingIntro: string; reading: [string, string, string];
  closing: string; closingText: string; privacy: string; copyright: string;
}
interface Chapter { label: string; title: string; paragraphs: [string, string]; link: string }
interface Step { title: string; body: string }

export const LANDING_SEASONS: Record<Language, Step & { link: string }> = {
  en: { title: 'How do seasons work?', body: 'Each galaxy has a season start and end. Plan flight returns around closing time, then review the final standings. The next galaxy begins a new competition.', link: 'Season rules and results' },
  tr: { title: 'Sezonlar nasıl işler?', body: 'Her galaksi sezonunun başlangıcı ve bitişi vardır. Uçuş dönüşlerini kapanış zamanına göre planla; sezon sonunda kesin sıralamayı incele. Sonraki galakside yeni bir rekabet başlar.', link: 'Sezon kuralları ve sonuçları' },
  fr: { title: 'Comment fonctionnent les saisons ?', body: 'Chaque galaxie a un début et une fin de saison. Planifiez les retours avant la clôture, puis consultez le classement final. La galaxie suivante lance une nouvelle compétition.', link: 'Règles et résultats des saisons' },
  de: { title: 'Wie funktionieren die Saisons?', body: 'Jede Galaxie hat einen Saisonbeginn und ein Saisonende. Plane Rückflüge vor dem Abschluss und prüfe danach die Endplatzierungen. Die nächste Galaxie eröffnet einen neuen Wettbewerb.', link: 'Saisonregeln und Ergebnisse' },
  es: { title: '¿Cómo funcionan las temporadas?', body: 'Cada galaxia tiene un inicio y un final de temporada. Planifica los regresos antes del cierre y consulta la clasificación final. La siguiente galaxia inicia una nueva competición.', link: 'Reglas y resultados de temporadas' },
  ja: { title: 'シーズンはどう進む？', body: '各銀河にはシーズンの開始と終了があります。終了時刻を考えて帰還を計画し、最後に確定順位を確認しましょう。次の銀河では新たな競争が始まります。', link: 'シーズンのルールと結果' },
};

export const LANDING_ACTIONS: Record<Language, { play: string; account: string; javascript: string; links: [string, string, string, string, string, string, string] }> = {
  en: { play: 'Start playing', account: 'Try the practice galaxy. No account needed.', javascript: 'Playing requires JavaScript. You can read this page and the public Wiki without it.', links: ['About', 'Getting started', 'Privacy', 'Cookies', 'Terms', 'Community guidelines', 'Contact'] },
  tr: { play: 'Oynamaya başla', account: 'Eğitim galaksisini dene. Hesap gerekmez.', javascript: 'Oynamak için JavaScript gerekir. Bu sayfayı ve herkese açık Wiki’yi JavaScript olmadan okuyabilirsin.', links: ['Hakkında', 'Başlangıç rehberi', 'Gizlilik', 'Çerezler', 'Kullanım koşulları', 'Topluluk kuralları', 'İletişim'] },
  fr: { play: 'Commencer à jouer', account: 'Essayez la galaxie d’entraînement. Sans compte.', javascript: 'JavaScript est nécessaire pour jouer. Cette page et le Wiki public restent lisibles sans JavaScript.', links: ['À propos', 'Bien débuter', 'Confidentialité', 'Cookies', 'Conditions', 'Règles de communauté', 'Contact'] },
  de: { play: 'Jetzt spielen', account: 'Probiere die Übungsgalaxie. Ohne Konto.', javascript: 'Zum Spielen ist JavaScript erforderlich. Diese Seite und das öffentliche Wiki sind auch ohne JavaScript lesbar.', links: ['Über das Spiel', 'Erste Schritte', 'Datenschutz', 'Cookies', 'Nutzungsbedingungen', 'Community-Regeln', 'Kontakt'] },
  es: { play: 'Empezar a jugar', account: 'Prueba la galaxia de entrenamiento. Sin cuenta.', javascript: 'Para jugar necesitas JavaScript. Esta página y el Wiki público se pueden leer sin JavaScript.', links: ['Acerca del juego', 'Primeros pasos', 'Privacidad', 'Cookies', 'Condiciones', 'Normas de comunidad', 'Contacto'] },
  ja: { play: 'プレイを始める', account: '練習用銀河を体験。アカウントは不要です。', javascript: 'プレイにはJavaScriptが必要です。このページと公開WikiはJavaScriptなしでも読めます。', links: ['ゲームについて', 'スタートガイド', 'プライバシー', 'Cookie', '利用規約', 'コミュニティ規則', 'お問い合わせ'] },
};

/** Public copy is shared by the HTML publisher and React. No browser/API dependency. */
export const LANDING_COPY: Record<Language, LandingCopy> = {
  en: {
    title: 'Astera Online — Multiplayer space strategy',
    description: 'Build your capital, discover rival worlds and choose when to risk your fleet. Explore Astera Online, a persistent multiplayer space strategy game.',
    eyebrow: 'A living galaxy. Your next move.', headline: ['The fleet is the bet.', 'Information is the edge.'],
    intro: 'Command a world in a persistent multiplayer galaxy. Build your economy, uncover what rivals hold, and choose which opportunities are worth your fleet.',
    explore: 'Discover the game', skip: 'Skip to content', scroll: 'Explore the galaxy', art: 'Astera Online universe · promotional artwork', guide: 'Read the field guide',
    chapters: [
      { label: '01 / Establish your world', title: 'A home to build. A frontier to claim.', paragraphs: ['Your capital is the foundation of your strategy. Develop production, collect resources, research technology and build the ships your next move needs.', 'Your capital cannot change owners, but attacks can still hurt. Colonies expand your reach as you progress — and rivals can capture them. Expansion creates opportunity and something to defend.'], link: 'Worlds & development' },
      { label: '02 / Read the unknown', title: 'The best weapon is a better reading.', paragraphs: ['Rival holdings are private until you discover them. Use radar warnings, telescope observations and probe reports to turn an unfamiliar galaxy into decisions you can make.', 'A report is a reading from a moment in time. Compare what you know, what may have changed and the risk of sending ships before committing your fleet.'], link: 'Intelligence & discovery' },
      { label: '03 / Commit your fleet', title: 'Every launch is a decision.', paragraphs: ['A fleet is more than its attack strength. Ship roles, cargo space, fuel and travel time shape what it can accomplish. The slowest selected ship sets the pace.', 'Raid for resources, transport supplies or contest a colony. Flights keep moving while you are away. Return to battle reports, new information and the consequences of your orders.'], link: 'Fleets & combat' },
      { label: '04 / Find your people', title: 'Build trust. Project power.', paragraphs: ['Clans turn individual plans into shared strategy. Coordinate in clan chat, send resources and station your own ships as support on an ally’s world.', 'Joint attacks assemble at the leader’s capital before departure. Once launched, a joint attack cannot be recalled. Preparation and communication matter before the fleet leaves.'], link: 'Clans & cooperation' },
    ],
    shipsTitle: 'A purpose for every hull.', shipsIntro: 'Ships from the game. Choose a role before choosing a fleet.',
    ships: ['Light attack craft. A small hull for offensive operations.', 'Armored escort. Bring defensive strength to your fleet.', 'Heavy freighter. Move resources with dedicated cargo capacity.'],
    startTitle: 'Your first orders.', steps: [
      { title: 'Try the controls', body: 'Begin in a practice galaxy. Learn to develop a world and send a fleet before creating an account.' },
      { title: 'Create your commander', body: 'After training, choose your commander credentials. Already playing? Sign in to continue your existing account.' },
      { title: 'Enter a living galaxy', body: 'Choose an available galaxy, establish your capital and plan your first real expedition.' },
    ],
    faqTitle: 'Before you take command.', faq: [
      { title: 'What kind of game is Astera Online?', body: 'A persistent multiplayer space strategy game with a 3D galaxy. Develop worlds, gather intelligence and dispatch fleets against real rivals.' },
      { title: 'Do I have to stay online?', body: 'No. Flights and production continue while you are away. Your next visit brings the outcomes of orders already in progress.' },
      { title: 'Can I lose my capital?', body: 'Your capital cannot be captured. It can still be attacked and damaged. Colonies can change owners, so expansion carries a different risk.' },
      { title: 'Where can I learn the rules?', body: 'The public Wiki explains buildings, research, ships, intelligence and combat. Read it without an account, then try the practice galaxy.' },
    ],
    readingTitle: 'Know before you launch.', readingIntro: 'The public Wiki explains the systems behind your decisions. No account required.', reading: ['Your first world', 'Reading the galaxy', 'Fleet composition'],
    closing: 'Your next move starts here.', closingText: 'Try a practice galaxy. Make your first decisions before creating a commander.', privacy: 'Privacy choices', copyright: 'A persistent multiplayer space strategy game.',
  },
  tr: {
    title: 'Astera Online — Çok oyunculu uzay stratejisi',
    description: 'Ana gezegenini geliştir, rakip dünyaları keşfet ve filonu ne zaman riske atacağına karar ver. Astera Online’ın kalıcı çok oyunculu galaksisine katıl.',
    eyebrow: 'Yaşayan bir galaksi. Sıradaki hamlen.', headline: ['Filo, ortaya koyduğun güç.', 'Bilgi, üstünlüğün.'],
    intro: 'Kalıcı, çok oyunculu bir galakside kendi dünyanı yönet. Ekonomini kur, rakiplerinin elindekileri keşfet ve hangi fırsatın filonu riske atmaya değeceğine karar ver.',
    explore: 'Oyunu keşfet', skip: 'İçeriğe geç', scroll: 'Galaksiyi keşfet', art: 'Astera Online evreni · tanıtım görseli', guide: 'Oyun rehberini oku',
    chapters: [
      { label: '01 / Dünyanı kur', title: 'Geliştireceğin bir yuva. Keşfedeceğin bir sınır.', paragraphs: ['Ana gezegenin, stratejinin temelidir. Üretimini geliştir, kaynakları topla, teknoloji araştır ve sıradaki hamlen için gereken gemileri inşa et.', 'Ana gezegenin el değiştirmez; ancak saldırılar yine de zarar verebilir. İlerledikçe kolonilerle etki alanını genişletirsin. Rakiplerin bu kolonileri ele geçirebilir; büyümek, savunman gereken yeni dünyalar demektir.'], link: 'Dünyalar ve gelişim' },
      { label: '02 / Bilinmeyeni oku', title: 'En iyi silah, doğru bilgidir.', paragraphs: ['Rakiplerinin elindekiler, sen keşfedene kadar gizlidir. Radar uyarıları, teleskop gözlemleri ve sonda raporlarıyla bilinmeyen galaksiyi anlamlandır.', 'Her rapor, ölçüldüğü ana ait bilgidir. Filonu göndermeden önce bildiklerini, değişmiş olabilecek koşulları ve alacağın riski birlikte değerlendir.'], link: 'İstihbarat ve keşif' },
      { label: '03 / Filonu gönder', title: 'Her kalkış bir karardır.', paragraphs: ['Filonun değeri yalnızca saldırı gücü değildir. Gemi görevleri, kargo kapasitesi, yakıt ve yolculuk süresi yapabileceklerini belirler. Seçtiğin en yavaş gemi filonun hızını belirler.', 'Kaynak için baskın yap, malzeme taşı veya bir koloni için mücadele et. Sen çevrimdışıyken uçuşlar sürer. Döndüğünde savaş raporları, yeni bilgiler ve emirlerinin sonuçları seni bekler.'], link: 'Filolar ve savaş' },
      { label: '04 / Birlikte hareket et', title: 'Güven kur. Gücünü birleştir.', paragraphs: ['Klanlar, bireysel planları ortak stratejiye dönüştürür. Klan sohbetinde koordinasyon kur, kaynak gönder ve kendi gemilerini müttefik dünyasına destek olarak yerleştir.', 'Ortak saldırılar, kalkıştan önce liderin ana gezegeninde toplanır. Yola çıkan ortak saldırı geri çağrılamaz. Hazırlık ve iletişim, filo ayrılmadan önce önemlidir.'], link: 'Klanlar ve iş birliği' },
    ],
    shipsTitle: 'Her geminin bir görevi var.', shipsIntro: 'Oyundaki gemiler. Filonu seçmeden önce görevini belirle.',
    ships: ['Hafif saldırı gemisi. Taarruz görevleri için küçük bir gövde.', 'Zırhlı eskort. Filona savunma gücü kat.', 'Ağır yük gemisi. Kaynaklarını özel kargo kapasitesiyle taşı.'],
    startTitle: 'İlk emirlerin.', steps: [
      { title: 'Kontrolleri dene', body: 'Eğitim galaksisinde başla. Hesap açmadan önce dünyanı geliştirmeyi ve filo göndermeyi öğren.' },
      { title: 'Komutanını oluştur', body: 'Eğitimden sonra komutan bilgilerini seç. Zaten oynuyor musun? Mevcut hesabınla giriş yap.' },
      { title: 'Yaşayan galaksiye katıl', body: 'Uygun bir galaksi seç, ana gezegenini kur ve ilk gerçek seferini planla.' },
    ],
    faqTitle: 'Komutayı almadan önce.', faq: [
      { title: 'Astera Online nasıl bir oyun?', body: '3D galakside geçen, kalıcı ve çok oyunculu bir uzay strateji oyunu. Dünyalarını geliştir, istihbarat topla ve gerçek rakiplerine karşı filolar gönder.' },
      { title: 'Sürekli çevrimiçi kalmalı mıyım?', body: 'Hayır. Uçuşlar ve üretim sen yokken de sürer. Sonraki ziyaretinde devam eden emirlerinin sonuçlarını görürsün.' },
      { title: 'Ana gezegenimi kaybedebilir miyim?', body: 'Ana gezegenin ele geçirilemez. Ancak saldırı alabilir ve zarar görebilir. Koloniler el değiştirebilir; genişlemek farklı bir risk taşır.' },
      { title: 'Kuralları nereden öğrenebilirim?', body: 'Herkese açık Wiki; binaları, araştırmaları, gemileri, istihbaratı ve savaşı anlatır. Hesap açmadan oku, ardından eğitim galaksisinde dene.' },
    ],
    readingTitle: 'Kalkıştan önce öğren.', readingIntro: 'Herkese açık Wiki, kararlarının arkasındaki sistemleri açıklar. Hesap gerekmez.', reading: ['İlk dünyan', 'Galaksiyi okumak', 'Filo oluşturmak'],
    closing: 'Sıradaki hamlen burada başlıyor.', closingText: 'Eğitim galaksisini dene. Komutan oluşturmadan önce ilk kararlarını ver.', privacy: 'Gizlilik tercihleri', copyright: 'Kalıcı, çok oyunculu uzay strateji oyunu.',
  },
  fr: {
    title: 'Astera Online — Stratégie spatiale multijoueur', description: 'Développez votre capitale, découvrez les mondes rivaux et décidez quand risquer votre flotte dans une galaxie multijoueur persistante.',
    eyebrow: 'Une galaxie vivante. Votre prochain coup.', headline: ['La flotte est la mise.', 'Le renseignement, votre avantage.'], intro: 'Commandez un monde dans une galaxie multijoueur persistante. Développez votre économie, découvrez les possessions rivales et choisissez les occasions qui méritent votre flotte.',
    explore: 'Découvrir le jeu', skip: 'Aller au contenu', scroll: 'Explorer la galaxie', art: 'Univers Astera Online · illustration promotionnelle', guide: 'Lire le guide',
    chapters: [
      { label: '01 / Fonder votre monde', title: 'Un foyer à bâtir. Une frontière à conquérir.', paragraphs: ['Votre capitale est la base de votre stratégie. Développez la production, collectez des ressources, recherchez des technologies et construisez vos vaisseaux.', 'Votre capitale ne peut pas changer de propriétaire, mais les attaques peuvent faire des dégâts. Les colonies élargissent votre influence et peuvent être capturées par vos rivaux.'], link: 'Mondes et développement' },
      { label: '02 / Lire l’inconnu', title: 'La meilleure arme : une meilleure information.', paragraphs: ['Les possessions rivales restent privées jusqu’à leur découverte. Alertes radar, observations au télescope et rapports de sondes vous aident à décider.', 'Un rapport décrit un instant passé. Comparez vos informations, les changements possibles et le risque avant d’engager votre flotte.'], link: 'Renseignement et exploration' },
      { label: '03 / Engager votre flotte', title: 'Chaque départ est une décision.', paragraphs: ['Rôles des vaisseaux, capacité de transport, carburant et durée du trajet comptent autant que la puissance. Le vaisseau sélectionné le plus lent fixe la vitesse.', 'Pillez des ressources, transportez du ravitaillement ou disputez une colonie. Les vols continuent hors connexion. À votre retour, découvrez les rapports et les conséquences de vos ordres.'], link: 'Flottes et combat' },
      { label: '04 / Trouver vos alliés', title: 'La confiance devient une force.', paragraphs: ['Les clans coordonnent leurs plans dans leur discussion privée. Envoyez des ressources et stationnez vos propres vaisseaux en soutien chez un allié.', 'Les attaques conjointes se rassemblent dans la capitale du chef. Après leur départ, elles ne peuvent plus être rappelées : préparez-vous avant le lancement.'], link: 'Clans et coopération' },
    ],
    shipsTitle: 'Un rôle pour chaque coque.', shipsIntro: 'Les vaisseaux du jeu. Choisissez leur mission avant votre flotte.', ships: ['Vaisseau d’attaque léger pour les opérations offensives.', 'Escorte blindée pour renforcer la défense de votre flotte.', 'Cargo lourd pour le transport de ressources.'],
    startTitle: 'Vos premiers ordres.', steps: [{ title: 'Essayer les commandes', body: 'Commencez dans une galaxie d’entraînement. Développez un monde et envoyez une flotte avant de créer un compte.' }, { title: 'Créer votre commandant', body: 'Après l’entraînement, choisissez vos identifiants. Vous jouez déjà ? Connectez-vous à votre compte existant.' }, { title: 'Rejoindre la galaxie', body: 'Choisissez une galaxie disponible, établissez votre capitale et préparez votre première expédition.' }],
    faqTitle: 'Avant de prendre le commandement.', faq: [{ title: 'Quel type de jeu est Astera Online ?', body: 'Un jeu de stratégie spatiale multijoueur persistant avec une galaxie 3D. Développez des mondes, recueillez des renseignements et affrontez de vrais rivaux.' }, { title: 'Faut-il rester connecté ?', body: 'Non. Les vols et la production continuent pendant votre absence. Retrouvez les résultats de vos ordres lors de votre prochaine visite.' }, { title: 'Puis-je perdre ma capitale ?', body: 'Votre capitale ne peut pas être capturée, mais elle peut subir des attaques et des dégâts. Les colonies peuvent changer de propriétaire.' }, { title: 'Où apprendre les règles ?', body: 'Le Wiki public explique bâtiments, recherches, vaisseaux, renseignement et combat. Consultez-le sans compte, puis essayez l’entraînement.' }],
    readingTitle: 'Comprendre avant le départ.', readingIntro: 'Le Wiki public explique les systèmes qui guident vos décisions. Sans compte. Disponible en anglais et en turc.', reading: ['Votre premier monde', 'Observer la galaxie', 'Composer une flotte'], closing: 'Votre prochain coup commence ici.', closingText: 'Essayez la galaxie d’entraînement avant de créer votre commandant.', privacy: 'Choix de confidentialité', copyright: 'Un jeu de stratégie spatiale multijoueur persistant.',
  },
  de: {
    title: 'Astera Online — Mehrspieler-Weltraumstrategie', description: 'Baue deine Hauptstadt aus, entdecke rivalisierende Welten und entscheide, wann du deine Flotte in einer persistenten Mehrspieler-Galaxie riskierst.',
    eyebrow: 'Eine lebendige Galaxie. Dein nächster Zug.', headline: ['Die Flotte ist dein Einsatz.', 'Wissen ist dein Vorteil.'], intro: 'Führe eine Welt in einer persistenten Mehrspieler-Galaxie. Entwickle deine Wirtschaft, entdecke die Besitztümer deiner Rivalen und wähle Gelegenheiten, die deine Flotte wert sind.',
    explore: 'Spiel entdecken', skip: 'Zum Inhalt', scroll: 'Galaxie entdecken', art: 'Astera-Online-Universum · Werbeillustration', guide: 'Spielanleitung lesen',
    chapters: [
      { label: '01 / Deine Welt aufbauen', title: 'Eine Heimat aufbauen. Grenzen erweitern.', paragraphs: ['Deine Hauptstadt bildet die Grundlage deiner Strategie. Entwickle Produktion, sammle Ressourcen, erforsche Technologien und baue Schiffe für deinen nächsten Zug.', 'Deine Hauptstadt kann nicht den Besitzer wechseln, aber Angriffe können Schaden anrichten. Kolonien erweitern deinen Einfluss und können von Rivalen erobert werden.'], link: 'Welten und Entwicklung' },
      { label: '02 / Das Unbekannte erkunden', title: 'Deine beste Waffe ist bessere Aufklärung.', paragraphs: ['Rivalisierende Besitztümer bleiben bis zu ihrer Entdeckung verborgen. Radarwarnungen, Teleskopbeobachtungen und Sondenberichte helfen dir bei Entscheidungen.', 'Ein Bericht beschreibt einen vergangenen Zeitpunkt. Prüfe dein Wissen, mögliche Veränderungen und das Risiko, bevor du deine Flotte einsetzt.'], link: 'Aufklärung und Entdeckung' },
      { label: '03 / Die Flotte entsenden', title: 'Jeder Start ist eine Entscheidung.', paragraphs: ['Schiffsrollen, Laderaum, Treibstoff und Flugzeit bestimmen die Möglichkeiten deiner Flotte. Das langsamste ausgewählte Schiff bestimmt ihr Tempo.', 'Erbeute Ressourcen, transportiere Vorräte oder kämpfe um eine Kolonie. Flüge laufen auch offline weiter. Bei deiner Rückkehr warten Berichte und die Folgen deiner Befehle.'], link: 'Flotten und Kampf' },
      { label: '04 / Verbündete finden', title: 'Vertrauen aufbauen. Stärke vereinen.', paragraphs: ['Clans machen aus einzelnen Plänen eine gemeinsame Strategie. Koordiniert euch im Clan-Chat, schickt Ressourcen und stationiert eigene Schiffe zur Unterstützung bei Verbündeten.', 'Gemeinsame Angriffe sammeln sich vor dem Start an der Hauptstadt des Anführers. Nach dem Start können sie nicht zurückgerufen werden. Plant deshalb vorher.'], link: 'Clans und Zusammenarbeit' },
    ],
    shipsTitle: 'Für jeden Rumpf eine Aufgabe.', shipsIntro: 'Schiffe aus dem Spiel. Wähle zuerst ihre Aufgabe, dann deine Flotte.', ships: ['Leichtes Angriffsschiff für offensive Einsätze.', 'Gepanzerte Eskorte für die Verteidigung deiner Flotte.', 'Schwerer Frachter zum Transport von Ressourcen.'],
    startTitle: 'Deine ersten Befehle.', steps: [{ title: 'Steuerung ausprobieren', body: 'Beginne in einer Übungsgalaxie. Entwickle eine Welt und entsende eine Flotte, bevor du ein Konto erstellst.' }, { title: 'Kommandanten erstellen', body: 'Wähle nach dem Training deine Zugangsdaten. Spielst du bereits? Melde dich mit deinem bestehenden Konto an.' }, { title: 'Die Galaxie betreten', body: 'Wähle eine verfügbare Galaxie, gründe deine Hauptstadt und plane deine erste echte Expedition.' }],
    faqTitle: 'Bevor du das Kommando übernimmst.', faq: [{ title: 'Was für ein Spiel ist Astera Online?', body: 'Ein persistentes Mehrspieler-Weltraumstrategiespiel mit einer 3D-Galaxie. Entwickle Welten, sammle Informationen und entsende Flotten gegen echte Rivalen.' }, { title: 'Muss ich online bleiben?', body: 'Nein. Flüge und Produktion laufen in deiner Abwesenheit weiter. Beim nächsten Besuch siehst du die Ergebnisse deiner Befehle.' }, { title: 'Kann ich meine Hauptstadt verlieren?', body: 'Deine Hauptstadt kann nicht erobert werden. Sie kann jedoch angegriffen und beschädigt werden. Kolonien können den Besitzer wechseln.' }, { title: 'Wo finde ich die Regeln?', body: 'Das öffentliche Wiki erklärt Gebäude, Forschung, Schiffe, Aufklärung und Kampf. Lies es ohne Konto und probiere danach die Übungsgalaxie.' }],
    readingTitle: 'Vor dem Start verstehen.', readingIntro: 'Das öffentliche Wiki erklärt die Systeme hinter deinen Entscheidungen. Ohne Konto. Auf Englisch und Türkisch verfügbar.', reading: ['Deine erste Welt', 'Die Galaxie beobachten', 'Flotten zusammenstellen'], closing: 'Dein nächster Zug beginnt hier.', closingText: 'Probiere die Übungsgalaxie, bevor du deinen Kommandanten erstellst.', privacy: 'Datenschutzeinstellungen', copyright: 'Ein persistentes Mehrspieler-Weltraumstrategiespiel.',
  },
  es: {
    title: 'Astera Online — Estrategia espacial multijugador', description: 'Desarrolla tu capital, descubre mundos rivales y decide cuándo arriesgar tu flota en una galaxia multijugador persistente.',
    eyebrow: 'Una galaxia viva. Tu próximo movimiento.', headline: ['La flota es tu apuesta.', 'La información, tu ventaja.'], intro: 'Dirige un mundo en una galaxia multijugador persistente. Desarrolla tu economía, descubre las posesiones rivales y decide qué oportunidades merecen arriesgar tu flota.',
    explore: 'Descubre el juego', skip: 'Saltar al contenido', scroll: 'Explora la galaxia', art: 'Universo de Astera Online · ilustración promocional', guide: 'Leer la guía',
    chapters: [
      { label: '01 / Construye tu mundo', title: 'Un hogar que construir. Una frontera que conquistar.', paragraphs: ['Tu capital es la base de tu estrategia. Desarrolla la producción, recoge recursos, investiga tecnologías y construye las naves necesarias para tu próximo movimiento.', 'Tu capital no puede cambiar de dueño, pero los ataques pueden causar daños. Las colonias amplían tu influencia y tus rivales pueden conquistarlas.'], link: 'Mundos y desarrollo' },
      { label: '02 / Lee lo desconocido', title: 'La mejor arma es una mejor información.', paragraphs: ['Las posesiones rivales son privadas hasta que las descubres. Las alertas de radar, el telescopio y las sondas te ayudan a tomar decisiones.', 'Un informe refleja un momento pasado. Compara lo que sabes, los posibles cambios y el riesgo antes de comprometer tu flota.'], link: 'Inteligencia y exploración' },
      { label: '03 / Envía tu flota', title: 'Cada despegue es una decisión.', paragraphs: ['Las funciones de las naves, la carga, el combustible y el viaje importan tanto como el ataque. La nave seleccionada más lenta marca el ritmo.', 'Saquea recursos, transporta suministros o disputa una colonia. Los vuelos continúan sin conexión. Al volver, descubre los informes y las consecuencias de tus órdenes.'], link: 'Flotas y combate' },
      { label: '04 / Encuentra aliados', title: 'Crea confianza. Une fuerzas.', paragraphs: ['Los clanes convierten los planes individuales en una estrategia común. Coordina por el chat del clan, envía recursos y estaciona tus naves como apoyo en mundos aliados.', 'Los ataques conjuntos se reúnen en la capital del líder antes de partir. Una vez lanzados, no pueden retirarse. La preparación importa antes del despegue.'], link: 'Clanes y cooperación' },
    ],
    shipsTitle: 'Una función para cada nave.', shipsIntro: 'Naves del juego. Elige su misión antes de componer la flota.', ships: ['Nave de ataque ligera para operaciones ofensivas.', 'Escolta blindada para reforzar la defensa de tu flota.', 'Carguero pesado para transportar recursos.'],
    startTitle: 'Tus primeras órdenes.', steps: [{ title: 'Prueba los controles', body: 'Empieza en una galaxia de práctica. Desarrolla un mundo y envía una flota antes de crear una cuenta.' }, { title: 'Crea tu comandante', body: 'Después del entrenamiento, elige tus credenciales. ¿Ya juegas? Accede a tu cuenta existente.' }, { title: 'Entra en la galaxia', body: 'Elige una galaxia disponible, establece tu capital y prepara tu primera expedición real.' }],
    faqTitle: 'Antes de tomar el mando.', faq: [{ title: '¿Qué tipo de juego es Astera Online?', body: 'Un juego de estrategia espacial multijugador persistente con una galaxia 3D. Desarrolla mundos, reúne información y envía flotas contra rivales reales.' }, { title: '¿Debo seguir conectado?', body: 'No. Los vuelos y la producción continúan mientras estás fuera. En tu próxima visita verás los resultados de tus órdenes.' }, { title: '¿Puedo perder mi capital?', body: 'Tu capital no puede ser conquistada, pero puede recibir ataques y daños. Las colonias sí pueden cambiar de dueño.' }, { title: '¿Dónde aprendo las reglas?', body: 'El Wiki público explica edificios, investigación, naves, inteligencia y combate. Léelo sin cuenta y después prueba la galaxia de entrenamiento.' }],
    readingTitle: 'Aprende antes de despegar.', readingIntro: 'El Wiki público explica los sistemas detrás de tus decisiones. Sin cuenta. Disponible en inglés y turco.', reading: ['Tu primer mundo', 'Observar la galaxia', 'Componer tu flota'], closing: 'Tu próximo movimiento empieza aquí.', closingText: 'Prueba la galaxia de entrenamiento antes de crear tu comandante.', privacy: 'Opciones de privacidad', copyright: 'Un juego de estrategia espacial multijugador persistente.',
  },
  ja: {
    title: 'Astera Online — マルチプレイヤー宇宙戦略ゲーム', description: '母星を発展させ、ライバルの世界を発見し、艦隊を投入する時を決めよう。進み続けるマルチプレイヤー銀河で戦略を試そう。',
    eyebrow: '動き続ける銀河。次の一手は、あなたに。', headline: ['艦隊を賭ける。', '情報で差をつける。'], intro: '進み続けるマルチプレイヤー銀河で、あなたの世界を指揮しよう。経済を育て、ライバルの戦力を探り、艦隊を投入する価値のある好機を選ぶ。',
    explore: 'ゲームを知る', skip: '本文へ移動', scroll: '銀河を探索', art: 'Astera Onlineの世界 · プロモーションアート', guide: 'ガイドを読む',
    chapters: [
      { label: '01 / 世界を築く', title: '育てる母星。広げる領域。', paragraphs: ['母星は戦略の基盤です。生産を発展させ、資源を回収し、技術を研究して、次の作戦に必要な艦船を建造しましょう。', '母星は奪われませんが、攻撃による損害は受けます。成長とともに植民地で領域を広げられますが、植民地はライバルに占領される可能性があります。'], link: '世界と発展' },
      { label: '02 / 未知を読む', title: '最高の武器は、より確かな情報。', paragraphs: ['ライバルの所有物は、発見するまで非公開です。レーダー警報、望遠鏡の観測、探査機の報告を判断に活かしましょう。', '報告が示すのは観測した時点の状態です。既知の情報、変化した可能性、投入するリスクを比べてから艦隊を送りましょう。'], link: '情報と発見' },
      { label: '03 / 艦隊を投入する', title: 'すべての出航が、決断になる。', paragraphs: ['艦隊は攻撃力だけでは決まりません。艦種の役割、積載量、燃料、航行時間が作戦を左右します。選択した最も遅い艦が速度を決めます。', '資源を襲撃し、物資を輸送し、植民地を争いましょう。オフラインでも航行は続きます。戻ると、戦闘報告と命令の結果が待っています。'], link: '艦隊と戦闘' },
      { label: '04 / 仲間と連携する', title: '信頼を築き、力を合わせる。', paragraphs: ['クランでは個々の計画を共同戦略にできます。クランチャットで連携し、資源を送り、自分の艦船を味方の世界に支援として駐留させましょう。', '共同攻撃の艦隊は出航前にリーダーの母星へ集結します。出航後は呼び戻せません。出発前の準備と意思疎通が重要です。'], link: 'クランと協力' },
    ],
    shipsTitle: 'すべての艦に、役割がある。', shipsIntro: 'ゲーム内の艦船。艦隊を選ぶ前に、任務を決めよう。', ships: ['攻撃作戦を担う軽攻撃艦。', '艦隊の防御力を補う装甲護衛艦。', '資源の輸送を担う大型貨物艦。'],
    startTitle: '最初の命令。', steps: [{ title: '操作を試す', body: '練習用銀河から始めましょう。アカウント作成前に、世界の発展と艦隊の派遣を体験できます。' }, { title: '司令官を作成する', body: '訓練後にログイン情報を設定します。すでにプレイしている場合は、既存のアカウントでログインしてください。' }, { title: '銀河に参加する', body: '参加可能な銀河を選び、母星を築いて、最初の本当の遠征を計画しましょう。' }],
    faqTitle: '指揮を始める前に。', faq: [{ title: 'Astera Onlineはどんなゲーム？', body: '3D銀河を舞台とした、進み続けるマルチプレイヤー宇宙戦略ゲームです。世界を発展させ、情報を集め、実際のプレイヤーと艦隊で競います。' }, { title: '常にオンラインでいる必要は？', body: 'ありません。離れている間も航行と生産は続きます。次に訪れた時に命令の結果を確認できます。' }, { title: '母星は奪われる？', body: '母星は占領されません。ただし攻撃や損害は受けます。植民地は所有者が変わる可能性があります。' }, { title: 'ルールはどこで学べる？', body: '公開Wikiで建物、研究、艦船、情報、戦闘を説明しています。アカウントなしで読み、その後に練習用銀河で試せます。' }],
    readingTitle: '出航する前に、知ろう。', readingIntro: '公開Wikiで、判断を支える仕組みを確認できます。アカウントは不要です。Wikiは英語とトルコ語で利用できます。', reading: ['最初の世界', '銀河を観測する', '艦隊を編成する'], closing: '次の一手は、ここから。', closingText: '司令官を作成する前に、練習用銀河で最初の判断を試しましょう。', privacy: 'プライバシー設定', copyright: '進み続けるマルチプレイヤー宇宙戦略ゲーム。',
  },
};
