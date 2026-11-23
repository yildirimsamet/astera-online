/** The colony ship's screens. `docs/ux-writing.md` applies. */
export const starter = {
  "holdMoment": {"title": "Ambarın dolu", "body": "Bundan sonra kazandığını götüremezsin.", "look": "Sıçramaya bak", "close": "Kapat"},
  "advice": {"huntRetry": "Diğer karakola saldır", "open": "Diğer seçenekler", "title": "Sırada ne var, Komutan?", "recommended": "Önerilen", "close": "Kapat", "huntProbe": "Karakolları sondala", "huntDecide": "Bekçileri karşılaştır"},
  "visual": {"jump": "Sıçrama", "report": "Rapor", "probe": "Sonda", "mine": "Maden", "crate": "Kasa", "collect": "Topla", "waiting": "Uçuşta", "galaxy": "Ana galaksi"},
  "dossier": {"surfaceGapLabel": "Bu gemi hakkındaki her şey", "surfaceGapMissing": "Bu gemiyi hiç görmedin", "surfaceGapWhy": "Kimin uçurduğunu, onarımlarının nereye geldiğini ve ne taşıdığını göremezsin. Bir sonda hepsini tek seferde getirir.", "probeGapAged": "Bu gemiye dair okuman eskidi", "probeGapWhy": "Gemide ne olduğuna filo bahse giriyorsun. Sonda bu tahmini bir aralığa çevirir.", "fleetGapWhy": "Oyundaki en değerli bilgi: uzaktaki filo kendi gemisini savunamaz.", "fleetGapRange": "Erişim {{reach}}; bu gemi {{distance}} uzakta"},
  "reports": {"guardDown": "Muhafız düştü. Karakol {{time}} daha korumasız: başka bir filo kalan kaynağı alabilir.", "outpost": "terk edilmiş bir karakol", "pirates": "korsanlar", "attackedShip": "Saldırılan gemi: {{planet}}", "walkover": "Geminde savunan birim yoktu, bu yüzden alınabilecek yağma saldırganlara açıktı.", "cargoLimited": "Ambarların doldu. Orada taşıyabileceğinden fazlası vardı. Kurye gemileri getir.", "landing": "Sağ kalanlar yaralarıyla hangara döner. Onları Tamirhaneye sen gönder.", "walkoverBody": "Geminde savunan birim yoktu. Saldıran filo alınabilecek yağmayı savaşmadan alabildi.", "noGroundNote": "Vardığında bu geminin ayakta duran bir savunması yoktu.", "piratesName": "Korsanlar", "aegisNote": "Aegis, savunan birimlerden önce hasar alır.", "whyStrong": "{{ships}} gemilerin {{guard}} bekçilere üstündü ({{mult}}).", "whyWeak": "{{ships}} gemilerin {{guard}} bekçilere karşı zayıftı ({{mult}}). Onlara karşı {{answer}} gönder.", "whyEven": "{{ships}} gemilerin {{guard}} bekçilerle denkti ({{mult}}): sonucu sayı ve güç belirledi. Onlara karşı {{answer}} üstündür.", "rebuild": "Kayıp: {{ships}}. Yenisi {{alloy}} alaşım, {{crystal}} kristal ve {{time}}. İlerlemen yerinde.", "beatenBy": "{{name}} senden önce vardı: filon indiğinde bekçi zaten düşmüştü, bu yüzden zafer sayılmaz. Kalanı aldın.", "firstVictory": "İlk zaferin: zafer kasası Tersane’de seni bekliyor.", "whyWon": "Neden kazandın?"},
  "fleetPage": {"roomRule": "Bu geminin taşıdığı her gemi için yer: evde, dışarıda ve tersanede. Dolu Hangar tersaneyi durdurur; geri çağrılan filo her zaman sığar.", "bays": "Saldırı yuvaları", "openStation": "Tamirhaneyi aç", "emptyAir": "Havada bir şey yok. Gemi göndermek için galakside bir gemiye, kayaya ya da karakola dokun."},
  "handbook": {"title": "El kitabı", "replay": "İlk dakikaları yeniden izle", "repairs": {"title": "Her şeyi onarım açar", "body": "Her onarım sıradaki sistemi açar. Aynı anda biri sürer, sen yokken de devam eder."}, "holds": {"title": "Makineler ürettiğini tutar", "body": "Üretim, depoya toplayana kadar havuzda bekler. Kazıcının getirdiği de havuza iner; yer yoksa kaybolur. Ambardaki kaynaklar yağmalanabilir."}, "sight": {"title": "Uçmadan önce bak", "body": "Sonda raporu tek bir anı gösterir. Eskidikçe bugünü daha az anlatır."}, "fleets": {"title": "Uçan filo güvende, gemi değil", "body": "Uçuştaki gemiler yağmalanamaz. Koloni gemin ve evde kalanlar yağmalanabilir."}, "jump": {"title": "Hedef göç", "body": "İlk döngüden sonra motor bir sıçramaya yetecek kadar çalışır. İstediğin an gidebilirsin: ambarın ne taşıyorsa seninle iner. Geri dönüş yoktur."}, "crates": {"title": "Kurtarma kasaları", "body": "Belirli onarımlar ve ilk kesin karakol zaferin kurtarma kasalarını açığa çıkarır. Gemi ekranında bir kasa kapağını basılı tutarak hazır kasaların hepsini aç. Her kasa depoya bir kez alaşım ve kristal verir. Bu kaynaklar yağmalanabilir; göçteki 2.000 alaşım / 1.000 kristal ambar tavanını aşmaz."}},
  "prologue": {"progress": "Adım {{step}} / {{total}}", "skip": "Atla", "signIn": "Giriş yap", "close": "Kapat", "alloy": "Alaşım {{value}}", "crystal": "Kristal {{value}}", "refinery": "Rafineri", "feed": "Sensör hattı", "action": {"power": "Yedek gücü bağla", "burn": "Rafineriyi çalıştır", "collect": "Topla", "patch": "Sensör hattını yamala"}, "dark": {"title": "Gemin karanlık.", "body": "Resif filoyu dağıttı, seni buraya savurdu. İlerideki ışık, yola çıktığın galaksi."}, "powered": {"title": "Yedek güç tutuyor.", "body": "Beş sistemin hepsi arızalı. Soğuk depoda {{crystal}} kristal kalmış. Her onarım alaşım ister, önce rafineri."}, "burning": {"title": "Ocak tutuşuyor.", "body": "İlk parti, son yakıt hatlarıyla çalışıyor."}, "batch": {"title": "İlk parti: {{alloy}} alaşım.", "body": "Rafineri ürettiğini sen boşaltana kadar tutar."}, "collected": {"title": "Sensörler kör.", "body": "Başka kimlerin geldiğini göremiyorsun. Hatta bir yama, sensörlere bir kulak verir."}, "patching": {"title": "Hat yamalanıyor…", "body": "İlk onarımın. Gerçekleri sen uyurken de sürer."}, "signal": {"mark": "Bilinmeyen sinyal", "title": "Bir şey cevap verdi.", "body": "Çok uzakta ve anten okuyamayacak kadar arızalı. Motorun kısa bir sıçrayışlık gücü kaldı.", "replayBody": "Çok uzaktaydı ve anten okuyamayacak kadar arızalıydı. Gerisini biliyorsun.", "replayAction": "Oyuna dön", "go": "Sinyale git"}, "hint": {"hold": "Tutuşana kadar basılı tut", "weld": "Her dokunuş bir çatlağı kaynaklar", "claim": "Başlamak için basılı tut"}, "warping": {"title": "Sıçranıyor…"}, "found": {"title": "Bu gemi artık senin olabilir.", "body": "Sığlıkların ötesinde sürükleniyor; ocağı yanıyor, bir kulağı yamalı. Sahiplen, macera başlasın.", "action": "Dümene geç"}, "claim": {"title": "Bu gemi senin olabilir.", "ship": "bu gemi", "intro": "Gemin {{alloy}} alaşım, {{crystal}} kristal ve çalışan bir rafineriyle başlar. Sen yokken onarımlar sürer."}},
  "chatRoom": "Galaksi kanalı",
  "away": {"fell": "{{name}} düştü", "crateReady": "Zafer kasan Tersane’de hazır.", "beaten": "{{by}} {{name}} karakoluna senden önce vardı", "details_one": "Ayrıntılar ({{count}})", "details_other": "Ayrıntılar ({{count}})", "online": "Sen yokken yeniden çalışmaya başladı: {{systems}}", "lost": "{{value}} sığmadı", "fleetHome": "Filo döndü", "fleetHomeDetail_one": "+{{resources}} kaynak · {{count}} gemi", "fleetHomeDetail_other": "+{{resources}} kaynak · {{count}} gemi", "haulAlloy": "+{{value}} alaşım", "haulCrystal": "+{{value}} kristal", "haulDeuterium": "+{{value}} Döteryum", "ships_one": "{{count}} gemi", "ships_other": "{{count}} gemi", "toShip": "Gemiye git"},
  "launchFleetsave": "Uçuştaki gemiler yağmalanamaz. Koloni gemin yağmalanabilir.",
  "contact": {"scout": "Keşif gemisi", "scoutDetail": "Savaşmaya değil bakmaya geliyor. Uzaktan tarar ve gider.", "raid": "Korsan akını"},
  "outpostGuide": "{{name}} karakoluna git",
  "outpostReading": {"guard": "Bekçi", "own": "Filon: {{cls}}", "none": "Bekçi yok", "unread": "Sınıflar okunamadı", "even": "Sınıflar eşit", "most": "çoğunlukta", "beats": "› sağdakini yener · ↺ {{last}} › {{first}}", "carry": "Taşıyabileceğin", "stock": "stokta {{band}}", "crate": "İlk kesin zaferin bir kasa açar"},
  "outpost": {"title": "Terk edilmiş karakol", "rule": "Muhafızı yenersen {{amount}} kaynağa kadar alırsın; gemilerin {{carry}} taşıyabilir. 6 saatte yeniden dolar.", "label": "Karakol · seviye {{level}}"},
  "readout": {"ships": "{{count}} gemi", "outposts": "{{count}} karakol", "level": "Muhafız seviyesi {{level}}", "firstHunt": "İlk av · {{level}}"},
  "lab": {"premise": "Bu araştırma gemiyle kalır. Ana galaksiye seninle gelmez.", "holdsRole": "Kazıcı kargo kapasitesini artırır.", "queue": "Gemi araştırması", "queueHint": "Gemi aynı anda tek proje yürütür. Onarımlar ve Tersane ayrı çalışmaya devam eder.", "idleHint": "Haritadan bir yıldız seç.", "queueFull": "Gemi aynı anda tek proje yürütür. Bunun bitmesini bekle."},
  "deck": {"label": "Gemi bölümleri", "repairs": "Onarım", "yard": "Tersane", "research": "Araştırma"},
  "yard": {"against": "Karşı", "queue": "Tersane sırası", "dockRule": "İstasyon ana fiyatın %{{percent}} kadarını alır.", "dockHurt": "{{count}} gemi İstasyon bekliyor", "dockGo": "{{count}} gemiyi onar"},
  "board": {"title": "Kalkış panosu", "empty": "Henüz kimse göç etmedi. İlk sen olabilirsin.", "ago": "{{time}} önce"},
  "jumpCall": {"title": "Göçe hazır", "line": "Ana galaksi seni bekliyor. Motor’u aç.", "later": "Ne zaman istersen ana galaksiye geçebilirsin."},
  "mainRow": {"facts": "{{worlds}} dünya. Sezon {{days}} gün sonra bitiyor.", "waiting": "Yeni sezon yolda.", "repair": "İlk onarımları bitir, bir maden seferi ve bir sonda raporu al: motor bir sıçramaya yetecek kadar uyanır.", "ready": "Motor hazır. İstediğin an sıçrayabilirsin; ambarın ne kadar doluysa o kadar güçlü inersin.", "eyebrow": "Hedefin", "story": "Resif filoyu dağıtmadan önce gittiğiniz yer. Asıl yolculuk burada başlıyor: tutulacak dünyalar, rakipler, klanlar, kazanılacak bir sezon.", "legRepair": "Çıkışa hazırlık", "legHold": "Ambar", "go": "Gemiye git"},
  "plan": {"optional": "{{count}} isteğe bağlı onarım kaldı. Yalnız bu gemide işe yarar: başkentin kendi binalarıyla başlar."},
  "outlook": {"noFrontier": "Şu an hiçbir galakside yer yok. Gemin burada oynamaya devam eder; yer açılınca göç açılır.", "seasonClosed": "Bu sezon artık gemi almıyor: {{days}} gün sonra bitiyor. Gemin yeni sezona iner; hazır gemiye sezon açılınca haber veririz. O zamana kadar karakollar ve onarımlar burada kazandırır."},
  "arrival": {"hunt": "Korsan avla", "huntLine": "Bir korsan filosu {{minutes}} dk uzakta. Korsana saldırmak kalkanını düşürmez.", "protection": "Koruma", "carried": "Seninle inen", "package": "İlk sezon paketi", "total": "Kullanılabilir", "ships": "{{count}} gemi", "decide": "İlk hamlen", "outward": "İlk seferi planla", "outwardLine": "Filon ve {{deuterium}} Döteryumun hazır. Önce bir hedefi sondala.", "grow": "Döteryum üretimini aç", "growLine": "Ana galakside Döteryum üretimin sıfır. Önce {{research}} araştırmasını yap, sonra {{plant}} binasını kur: uçuşlarını o besler."},
  "readyLabel": "Çıkışa hazırlık",
  "wholeShip": "Tüm sistemler {{done}}/{{total}}",
  "jump": {"holdTitle": "Ambarın", "holdShips": "Sağlam gemiler", "holdFull": "Ambar dolu: fazlası gemide kalır.", "staysAboard": "Onarımlar ve araştırmalar gemide kalır.", "leftJoin": ", ", "leftPart": {"alloy": "{{amount}} alaşım", "crystal": "{{amount}} kristal", "deuterium": "{{amount}} Döteryum", "ships_one": "{{count}} gemi", "ships_other": "{{count}} gemi"}, "stayFact": "Gemide üretim ana galaksinin {{mult}} katı.", "stayAbout": "Ambar nasıl dolar", "guardFact": "Kalkan {{shield}} sa · akın Çekirdek {{low}}–{{high}} · Sessiz Uzay {{silent}} sa", "guardAbout": "Dünyan nasıl korunur", "behindAbout": "Gemide kalan onarımlar", "stayTitle": "Burada kalırsan", "stayLine": "Gemideki üretim ana galaksinin {{mult}} katı. İlk av ve kasası, maden seferleri ve üretim onarımları ambarı doldurur.", "landTitle": "İnince", "landPack": "Sezon paketi: {{alloy}} alaşım, {{crystal}} kristal, {{ships}} gemi.", "shield": "Kalkan {{hours}} saat. Bir komutana saldırırsan düşer; korsana saldırmak düşürmez.", "band": "Sana yalnız Komuta Çekirdeği {{low}}–{{high}} olanlar akın edebilir.", "silent": "Sonra {{hours}} saat saldırı, geliştirme, araştırma ya da üretim emri vermezsen dünyan Sessiz Uzay'a çekilir.", "behindTitle": "Geride kalanlar", "panel": "Göç", "go": "Göçe hazırlan", "title": "{{name}} galaksisine göç", "addresses": "Nereye ineceksin", "neighbours": "Yakındaki dünya: {{count}}", "friendNear": "Eski komşun {{name}} yakında", "tone": {"quiet": "Sakin", "mixed": "Arada", "busy": "Kalabalık"}, "toneNote": {"quiet": "Daha güvenli. Hedefler uzak.", "mixed": "İkisinden de biraz.", "busy": "Hedefler yakın, sen de hedefsin."}, "cargo": "Ambarla inecekler", "package": "Ayrıca ilk sezon paketi ve 72 saatlik kalkan alırsın.", "carryMost": "Göç en çok {{alloy}} alaşım, {{crystal}} kristal, {{deuterium}} Döteryum ve {{ships}} gemi taşır.", "left": "Kaybolacak: {{list}}.", "warn": "Gemi bu seferde tüketilir. Ambarın dışında kalan kaynak ve gemiler kaybolur.", "hold": "Göç et", "leaving": "Kalkıyor…", "replay": "Yeniden izle", "skip": "Atla", "scene": {"lit": "Motor yandı", "leaving": "Sığlıktan çıkış", "gap": "Boşluğu geçiş", "fall": "{{name}}", "world": "Senin dünyan"}},
  "landingRewards": {"ribbon": "İlk ödüllerin", "body": "İlk adımların {{count}} ödül kazandırdı.", "take": "Ödülü al", "spent": "Depolarında.", "continue": "Devam", "later": "Sonra"},
  "galaxyLine": {"departed": "{{name}} ana galaksiye sıçradı", "wreck": "Bir savaş enkaz alanı bıraktı", "outpost": "Seviye {{level}} bir karakol boşaltıldı"},
  "landing": {"dismiss": "Kapat", "title": "{{name}} galaksisine indin", "go": "Dünyama geç", "line": {"battle": "Savaşlar artık iki kat sert, Aegis tam gücünde.", "opened": "Klan ve sıralama açıldı.", "alerts": "Telefon bildirimleri ilk hafta ücretsiz, sonra Bildirim Merkezi'nden gelir."}, "tip": {"core": "Çekirdek kademeni belirler. Yalnız yakın kademelere akın edersin, sana da öyle akın edilir.", "colony": "En fazla üç koloni tutabilirsin. Tarafsız dünyalar kısa bir süre sahiplenmeye açılır.", "clan": "Klan istihbaratı paylaşır, birlikte savunur. Klan sekmesine bak.", "dominion": "Dominion en çok elinde tutanı sıralar, sezon sonunda ödül verir.", "honor": "Honor adil savaşanı sıralar. Zayıf filoya akın az kazandırır."}},
  "shieldNote": "Gemi kalkanları her savaşa dolu başlar. Gövde yaraları Tamirhane onarana kadar kalır.",
  "tempoNote": "Burada hasar ve Aegis yarıdır. Ana galakside aynı savaş iki kat hızlı geçer.",
  "intel": {"blind": "Tek bir geminin içini göremiyorsun", "openShip": "Gemiyi aç", "telescopeGives": "İzlediğin geminin filosu ayrıldı mı gösterir. Saldırıdan önce okumanın yaşını ve geride kalanı tart.", "telescopeCost": "Gemindeki Teleskobu onar.", "idleHint": "Boş yuva: {{count}}. Haritadan bir gemi seç ve birini ona çevir.", "scarcity": "Çevredeki gemi: {{neighbours}}. Yuvan: {{count}}. Yuvayı başka gemiye çevirmek bekleme süresi başlatır, seçerek izle.", "radarGives": "Menzildeki hareketi ve gemine yönelen tehdidin varış zamanını gösterir. Sondaları yakalayabilir, yakalama garanti değildir.", "radarCost": "Gemindeki Radarı onar.", "nextSlot": "Onarım {{level}}", "oneMore": "Teleskop onarımı {{level}} bir gemi daha izletir.", "radarLevel": "Radar · onarım {{level}}", "radarFleets": "Radar onarımı {{level}}, sana yönelen tehdidi {{sense}} birimde süresiz ayırt eder. {{warn}} birimde varış süresini de ekler.", "radarFleetsOne": "Radar onarımı {{level}}, {{sense}} birime kadar hareket eden araçları gösterir ve gemine yönelen tehdidi varış süresiyle işaretler.", "radarBearing": " Onarım 2, geldikleri yönü de ekler.", "radarQuiet": "Tarama algılanmadı. Radarın açık.", "scaleNote": "Her çubuk sıfırdan başlar: bant onların tahminidir, turkuaz çizgi senin gemindir.", "attack": "Saldır", "howTo": {"title": "İki karakolu karşılaştır", "guard": "Bekçi: Sınıf dizisinde filon bekçinin solundaysa üstünlük sende, sağındaysa onda.", "bars": "Çubuklar: Çizgi senin gücün. Savunma ve filo çizginin solundaysa karakol senden zayıf.", "carry": "Yük: Filon yalnız taşıyabildiği kadarını getirir.", "go": "Kararını verince {{attack}} düğmesine bas, filonu seçip gönder."}, "home": "Gemine uç"},
  "news": {"victoryCrateOpened": "Zafer kasası açıldı: +{{alloy}} alaşım, +{{crystal}} kristal.", "crateOpened_one": "Kurtarma kasası açıldı: +{{alloy}} alaşım, +{{crystal}} kristal.", "crateOpened_other": "{{count}} kurtarma kasası açıldı: +{{alloy}} alaşım, +{{crystal}} kristal.", "mineHome_one": "Kazıcın {{brought}} ile döndü: hepsi havuzda.", "mineHome_other": "{{count}} Kazıcın {{brought}} ile döndü: hepsi havuzda.", "mineLost_one": "Kazıcın {{brought}} ile döndü: {{landed}} havuza girdi, {{lost}} yer bulamadı ve kayboldu.", "mineLost_other": "{{count}} Kazıcın {{brought}} ile döndü: {{landed}} havuza girdi, {{lost}} yer bulamadı ve kayboldu.", "mineEmpty_one": "Kazıcın boş döndü: alınacak bir şey kalmamıştı.", "mineEmpty_other": "{{count}} Kazıcın boş döndü: alınacak bir şey kalmamıştı.", "repairDone": "{{name}} onarıldı.", "probeReport": "{{name}} için sonda raporu geldi.", "probeDetected": "Bir sonda gemini taradı.", "radarPast": "Radar: bir filo geldi.", "shieldPast": "Kalkanın düştü.", "radar": "Radar: {{time}} içinde bir filo geliyor.", "raidOver": "{{name}} akınının sonucu geldi. Raporu oku.", "firstVictory": "{{name}} düştü! Zafer kasan Tersane’de hazır.", "beatenBy": "{{by}} {{name}} karakoluna senden önce vardı: bekçi zaten düşmüştü. Raporu oku.", "attacked": "{{name}} gemine saldırdı. Raporu oku.", "fleetHome": "Filon döndü.", "turnedBack": "Hedefe ulaşılamadı. Filon geri dönüyor.", "yardDone": "Tersane: {{count}} {{name}} hazır.", "researchDone": "{{name}} seviye {{level}} oldu.", "dockDone": "Onarım İstasyonu işini bitirdi. Gemilerin sağlam.", "shieldWarning": "Kalkanın {{time}} sonra düşüyor.", "seasonOpen": "{{name}} galaksisinde yeni sezon açıldı. Gemin kalkabilir."},
  "reading": {"repairLabel": "Onarım", "repairNote": "Bu geminin ne kadarı onarıldı. İlerledikçe birikimi artar ve ayrılmaya yaklaşır.", "unknownShip": "Bilinmeyen gemi"},
  "systemShort": {"REFINERY": "Rafineri", "SURVEY": "Keşif", "DEFENCE": "Savunma", "CARGO": "Kargo", "DRIVE": "Motor"},
  "systemsLabel": "Gemi sistemleri",
  "locked": "kilitli",
  "perHour": "/sa",
  "moreRepairs": "Diğer onarımlar", "nextRepairs": "Onarımlar",
  "slots": "Çalışma yuvaları",
  "stepState": {"done": "onarıldı", "queued": "sırada", "closed": "kilitli", "open": "hazır"},
  "quiet": {"warn": "{{time}} içinde onarım yapmazsan gemin bu galaksideki yerini bırakır.", "asleep": "{{hours}} saat onarım yapılmadığı için gemin yerini bıraktı. Bir onarım başlatınca yeniden yer alır."},
  "queue": {"title": "Onarım sırası"},
  "eyebrow": "Koloni gemisi",
  "goal": "Gemiyi ayağa kaldır, motoru uyandır ve ana galaksiye ne zaman sıçrayacağını sen seç.",
  "next": "Sıradaki",
  "tutorial": {"jumpNow": "Hemen geç", "jumpLater": "Önce güçlen", "skip": {"link": "Rehber istemiyorum", "title": "Rehberi kapat?", "body": "Rehberi kapatmak istediğine emin misin? Subay artık sana yol göstermeyecek. Rehberi menüdeki Akademi'den yeniden açabilirsin. Oyun kaldığın yerden devam eder.", "keep": "Rehberle devam et", "close": "Rehberi kapat", "again": "Rehberi yeniden aç", "againHint": "Keşif subayı yeniden yanında olur"}, "chapter": {"1": "Uyanış", "2": "İlk onarımlar", "3": "Gözlerimiz", "4": "İlk sonda", "5": "Tersane", "6": "İlk ganimet", "7": "Teleskop", "9": "Ana galaksiye giden yol"}, "next": "Devam", "reveal": "Metnin tamamını göster", "away": "Bitince seni çağıracağım, {{clock}} civarı. O zamana kadar gemini ve galaksiyi gez.", "ok": "Tamam", "back": "{{time}} sonra dönüyorum", "reopen": "Rehberi göster", "nav": {"openShip_jump": "Motor hazır. Sıçrama gemide hazırlanır; ışıklı satır seni oraya götürür.", "openShip": "Onarımlar gemide yapılır: {{base}} sekmesi.", "openShip_work": "Sıradaki iş gemide: {{base}} sekmesi.", "closePage": "Sıradaki iş galakside. Bu sayfayı kapat.", "dismissUnlock": "Yeni bir sistem açıldı. Kartı oku, sonra kapat."}, "line": {"jumpAsk": "Gemin sıçramaya hazır. Hemen mi geçelim, önce güçlenelim mi?", "jumpGo": "Sıçrama bu tuşla başlar. İneceğin yeri sonra seçeceksin.", "online": "Komutan, telsiz çalışıyor! Bu gemi artık senin. Rafineriyi uyandıralım.", "collect": "Onarımlar alaşımla ödenir. Rafinerinin ürettiği havuzda bekliyor: depoya al.", "orderRefinery": "Her onarım alaşım ve kristal ister. Önce {{name}}: alaşım hızlanır.", "waitFirst": "Beş saniye. Büyük onarımlar sen yokken de sürer.", "firstCrate": "Onarım mühürlü bir bölme açtı. Basılı tut, içindekiler senin.", "openIntel": "Sonda döndü. Raporu {{intel}} sekmesinde bekliyor.", "openReport": "Bildiğimiz her şey burada. Sondaladığımız gemiyi aç.", "report": "Işıklı kısım, bir zaferin taşıyacağı ganimet. Okumadan filo göndermeyiz.", "farewell": "Gemi %{{percent}} onarıldı. Sıradaki işler sıçrama yolunu açar.", "farewell_open": "Sıçrama açık: “Göçe hazırlan”. Acele yok; kaldıkça ambar dolar.", "farewell_fleet": "Motor hazır. Bütün filolar eve dönünce sıçrama açılır.", "farewell_season": "Motor hazır. Bu sezon kapanıyor; bir sonrakine ineceksin.", "farewell_frontier": "Motor hazır. Bütün galaksiler dolu; yer açılınca geçeriz.", "mine": "Bu kayada maden var. Kazıcı gönder, yükü gemiye getirsin.", "collectMine": "Kazıcı yüküyle döndü! Ganimet havuzda: depoya al.", "telescopeLook": "Teleskop artık görüyor: kayalar ve geçen filolar burada. Kaydırıp etrafına bak.", "zoomRock": "Kayalar uzakta. Yaklaşmak için iki parmağını aç ya da tekeri çevir.", "findRock": "Kayalar artık yakında. Birini seç.", "openCrate": "Bir kasa daha hazır; sıradaki onarımın parası içinde. Basılı tut.", "orderExtractor": "Hassas parçalar kristalle onarılır. {{name}} kristal üretir.", "orderTelescope": "Kör uçuyoruz. {{name}} etrafımızı gösterecek.", "orderRadar": "Yaklaşanı önceden duymalıyız. {{name}} uzaktaki hareketi yakalar.", "waitTelescope": "Teleskop açılıyor. Birazdan dışarıyı göreceğiz.", "waitRadar": "Radar açılıyor. Birazdan yaklaşanı duyacağız.", "waitMine": "Kazıcı kayaya uçuyor. Yüküyle dönüşünü izle.", "waitProbe": "Sonda yolda. Raporu birazdan elimizde.", "orderSurvey": "Başka gemilerin içini okumalıyız. Sondaları {{name}} fırlatır.", "waitSurvey": "Sonda rampası kuruluyor. Bitince komşulara sonda yollarız.", "probe": "Yalnız değiliz. Bir komşuya sonda yolla, neyi olduğunu öğren.", "orderShipyard": "Ganimeti taşıyacak gemimiz yok. {{name}} gemi üretir.", "waitYard": "Tersane kuruluyor. Bitince kendi gemilerini üreteceksin.", "buildShip": "İki gemin hazır. Bir tane de sen üret: ışıklı gövde."}, "push": "Onarım bitince ve biri gemine yaklaşınca haber vereyim mi?", "allow": "Haber ver", "later": "Sonra", "hint": "Bir yön mü arıyorsun? {{task}} Nasıl ilerleyeceğini görmek için sıradaki adım satırına dokun.", "dismiss": "Anladım"},
  "outcome": {"courage": "Cesaretin ödülsüz kalmadı. Cesaret kasan Tersane’de hazır.", "DECISIVE": "Karakol düştü", "PARTIAL": "Kısmi sonuç", "REPELLED": "Püskürtüldün", "BEATEN": "Biri önce vardı", "beaten": "{{by}} senden önce vardı; bekçi zaten düşmüştü. Kalanı aldın.", "crate": "İlk zaferin! Zafer kasan Tersane’de hazır.", "line": {"DECISIVE": "Bekçi dağıldı. Neden kazandığın raporda.", "PARTIAL": "Bekçinin bir kısmı düştü. Neyin eksik kaldığı raporda.", "REPELLED": "Bekçi direndi. Nedeni raporda."}, "lost_one": "{{count}} gemi kaybı", "lost_other": "{{count}} gemi kaybı", "lootHome": "Ganimet, filo dönünce depoya iner.", "ok": "Tamam", "report": "Raporu oku", "openCrate": "Kasayı aç"},
  "objective": {"zoomRock": "Asteroitlere yaklaş.", "huntRetry": "Savaşı kazanamadın. {{name}} karakoluna daha güçlü saldır.", "probe": "En yakın gemiye sonda gönder. Bulmak için dokun.", "mine": "En yakın asteroide Kazıcı gönder. Bulmak için dokun.", "underwayProbe": "Sondan yolda. Raporu İstihbarat'a düşecek.", "underwayMine": "Kazıcın madende. Kendiliğinden geri dönecek.", "restSave": "Şimdilik bu kadar. {{name}} için {{clock}} civarı gel.", "restWait": "Şimdilik bu kadar. Onarım {{clock}} civarı biter.", "repair": "{{name}} onarımı. Gemiyi aç.", "collect": "Üretileni üst çubuktan topla.", "save": "{{name}}: yaklaşık {{time}} içinde ödeyebilirsin.", "saveNever": "{{name}}: eksik kaynağı üreten sistemi onar.", "wait": "Onarım sürüyor. {{time}} içinde hazır.", "huntProbeMining": "Kazıcın yolda. Bu arada iki korsan karakolu var; bekçilerini bilmeden saldırmayız. Sonda gönder.", "huntProbe": "İki korsan karakolu var; bekçilerini bilmeden saldırmayız. Sonda gönder.", "huntProbing": "Sondalar yolda. Dönünce bekçileri okuruz.", "huntDecide": "Raporlar geldi: iki bekçiyi karşılaştır, gemini seç.", "huntRaid": "Filon karakola gidiyor. Savaş varışta.", "crate": "Kasayı aç, sıradaki onarımın parası içinde."},
  "log": {"title": "Seyir defteri", "now": "Şimdi", "go": "Git", "chapter": {"POWER": {"title": "Güç", "line": "Yedek güç tutuyor. Gemi uyandı."}, "REFINERY": {"title": "Rafineri", "line": "Alaşım ve kristal üretir. Her onarım bunlarla ödenir."}, "SURVEY": {"title": "Keşif", "line": "Anten: radar, sondalar, raporlar ve İstihbarat sekmesi."}, "DEFENCE": {"title": "Savunma", "line": "Aegis ve teleskop: dışarıyı gör, baskında ayakta kal."}, "CARGO": {"title": "Kargo", "line": "Tersane ve hangar: ilk gemilerin ve Filo sekmesi."}, "DRIVE": {"title": "Motor", "line": "İlk döngü onu bir sıçramaya yetecek kadar uyandırır. Ne zaman gideceğini sen seçersin."}}},
  "repair": "Onar",
  "stepCount": "Aşama {{stage}} / {{total}}",
  "optional": "İsteğe bağlı · onarım yüzdesine sayılmaz",
  "inQueue": "Sırada", "readyIn": "{{time}} sonra hazır",
  "systemAria": "{{name}}: {{total}} onarımdan {{done}} tanesi tamam, {{state}}",
  "needs": "Önce {{what}}",
  "go": "Göster",
  "queueFull": "Onarım sırası en fazla {{count}} iş alır. Birinin bitmesini bekle.",
  "affordIn": "{{what}} eksik · yaklaşık {{time}} içinde birikir.",
  "collectFirst": "{{what}} eksik · üst çubuktaki havuzdan topla.",
  "noIncome": "{{what}} eksik · henüz üreten yok; onu üreten sistemi onar.",
  "allQueued": "Bütün zorunlu onarımlar bitti veya sırada.",
  "allRepaired": "Bütün zorunlu onarımlar bitti.",
  "ordered": "{{name}}: onarım sıraya girdi",
  "state": {
    "broken": "Arızalı",
    "damaged": "Hasarlı",
    "done": "Onarıldı"
  },
  "system": {
    "REFINERY": "Rafineri modülü",
    "SURVEY": "Keşif anteni",
    "DEFENCE": "Savunma sistemleri",
    "CARGO": "Kargo ve hangar",
    "DRIVE": "Yıldızlararası motor"
  },
  "module": {
    "SURVEY": "Sonda rampası"
  },
  "fact": {
    "FIRST_PROBE_REPORT": "ilk sonda raporun",
    "FIRST_MINING_SENT": "ilk Kazıcı uçuşun", "FIRST_MINING_RETURN": "ilk madencilik dönüşün",
    "FIRST_BATTLE_REPORT": "ilk savaş raporun",
    "FIRST_OUTPOST_VICTORY": "ilk karakol zaferin",
    "FIRST_OUTPOST_DEFEAT": "ilk karakol denemen"
  },
  "factHow": {"FIRST_OUTPOST_DEFEAT": "Bir karakola saldır.", "FIRST_PROBE_REPORT": "Komşu bir gemiye ya da bir karakola sonda gönder.", "FIRST_MINING_SENT": "Bir asteroide Kazıcı gönder.", "FIRST_MINING_RETURN": "Bir Kazıcıyı asteroide gönder ve dönmesini bekle.", "FIRST_BATTLE_REPORT": "Bir karakola baskın yap ya da Aegis açıkken korsanları karşıla. O savaşın raporu sayılır.", "FIRST_OUTPOST_VICTORY": "Bir karakolun bekçilerini kesin bir zaferle yen."},
  "attackLocked": "Gemilere saldırmak için kendi Aegis’in onarılmış ve arkanda bir savaş olmalı. Aegis açıkken senin gemine de saldırılabilir.",
  "aegisChoice": {"title": "Seçim senin", "hold": "Aegis’i onar", "with": "Aegis ile", "withShield": "Hasarı önce kalkan karşılar.", "withPirates": "Korsanlar gelmeye başlar.", "withNeighbours": "{{hours}} saat sonra komşular da sana saldırabilir.", "withAttack": "Bir savaştan sonra sen de gemilere saldırabilirsin.", "without": "Aegis olmadan", "withoutSafe": "Ne korsan ne komşu sana saldırabilir.", "withoutOutposts": "Yalnız karakollara akın edersin.", "withoutJump": "Çıkış için gerekmez."},
  "outpostLocked": "Karakol baskını Tersane ile açılır. Tersaneyi onar; ürettiği gemiler buraya baskına çıkabilir.",
  "effect": {
    "rate": {
      "alloy": "Saatte +{{amount}} alaşım",
      "crystal": "Saatte +{{amount}} kristal",
      "deuterium": "Saatte +{{amount}} Döteryum"
    },
    "ships": "Yanında gelir: {{ships}}",
    "deuterium": "Yanında {{amount}} Döteryum gelir",
    "room": "Hangar odası {{room}}",
    "storeCeiling": "Alaşım depo tavanı {{from}} → {{to}}",
    "telescope": "Teleskop menzili {{distance}}",
    "radar": "Radar menzili {{distance}}",
    "aegis": "Aegis {{hp}}",
    "surveyBand": "Sonda daha dar aralık okur"
  },
  "feature": {
    "production": {
      "gain": "Üretimi açar",
      "line": "Rafineri alaşım üretir. Üretileni üst çubuktan topla."
    },
    "intel": {
      "gain": "Sondayı açar",
      "line": "Komşu gemiler karanlık nokta olarak görünür. Sonda, birinin elinde ne olduğunu gösterir."
    },
    "fleet": {
      "gain": "Filoyu açar",
      "line": "Gemi üretir, Kazıcıyla asteroit kazar, karakollara baskın yapar, hasarlı gemileri Onarım İstasyonu’nda onarırsın."
    },
    "chat": {
      "gain": "Sohbeti açar",
      "line": "Bu galaksideki diğer gemilerle konuşabilirsin."
    },
    "salvage": {
      "gain": "Enkaz alanlarını açar",
      "line": "Enkaz alanları artık haritada görünür. Kazıcı bunları toplayabilir."
    },
    "research": {
      "gain": "Araştırmayı açar",
      "line": "Araştırma gemilerini ve Kazıcı ambarını geliştirir. Bu gemiyle birlikte biter."
    },
    "telescope": {
      "gain": "Teleskopu açar",
      "line": "Halkasının içinde diğer gemileri ve uçuşlarını görürsün."
    },
    "radar": {
      "gain": "Radarı açar",
      "line": "Halkasının içindeki uçuş, bilinmeyen kontak olarak görünür ve seni uyarır."
    },
    "defence": {
      "gain": "Savunmayı açar",
      "line": "Hasarı önce Aegis karşılar. Korsanlar ve diğer gemiler artık bu gemiye saldırabilir; bir savaştan sonra sen de gemilere saldırabilirsin."
    },
    "attack": {
      "gain": "Saldırıyı açar",
      "line": "Aegis’i açık gemilere saldırabilirsin. Onlar da sana saldırabilir."
    },
    "deuterium": {
      "gain": "Döteryumu açar",
      "line": "Uçuşlar Döteryum yakar. Bu rafineri Döteryum üretir."
    },
    "migration": {
      "gain": "Göçü açar",
      "line": "Motor bir sıçramaya yetecek kadar çalışıyor: gemide Motor'dan geçersin. Hemen gitmek zorunda değilsin; kaldıkça ambar dolar."
    }
  },
  "funnel": {"title": "Başlangıç yolculuğu", "sessions": "{{accounts}} hesap · {{sessions}} oturum · {{returned}} hesap ikinci oturuma döndü", "push": "Push: {{asked}} sorulan · {{granted}} izin veren · {{denied}} reddeden", "crates": "Kasalar: {{accounts}} hesapta {{opened}} açılış", "chain": "Emir zinciri: {{accepted}} hesap emir verdi → {{resolved}} sonucunu aldı → {{viewed}} sonucu gördü → {{decided}} yeniden emir verdi", "haul": "İlk kazı dönüşü: {{returned}} hesap · {{gained}} net kazançlı · {{wasted}} dolu tesis yüzünden kayıp verdi", "steps": "Adımlar ve düşüş", "dropoff": "{{accounts}} ulaştı · öncekinden {{dropoff}} az"},
  "crate": {"victory": "İlk zafer kasası", "title_one": "Kurtarma kasası", "title_other": "{{count}} kurtarma kasası", "hold": "Basılı tut, aç ve al", "open": "Aç: {{purse}}"},
  "unlock": {
    "online": "{{system}} çevrimiçi",
    "try": "Dene",
    "showJump": "Sıçramayı göster",
    "later": "Sonra"
  },
  "director": {"radarLesson": {"telescope": "Mavi küre teleskobun görüş alanı: içine gireni olduğu gibi görürüz.", "radar": "Yeşil küre radarın bilgi alanı: bir şey olduğunu bilir, ne olduğunu değil.", "caught": "Radar bir cisim yakaladı. Ne olduğunu henüz göremiyoruz.", "seen": "Teleskobun görüşüne girdi: {{hull}} ×{{count}}. Yalnızca geçiyorlar.", "calm": "Bize gelselerdi, radara girdikleri an kırmızı uyarı alırdık."}, "jump": {"lit": "Motor uyandı. Gemin artık sıçrayabilir.", "away": "Ana galaksi bekliyor: sezon ve rakipler orada."}, "skip": "Basılı tut · geç", "shipReport": {"orbit": "Gemi ayakta ama yarı ölü.", "goal": "Motoru yakarsak buradan gideriz."}, "repair": {"work": "{{name}} onarılıyor.", "REFINERY": "{{name}} çalışıyor: alaşım daha hızlı akıyor.", "EXTRACTOR": "{{name}} yandı: kristal hassas parçaları onarır.", "TELESCOPE": "{{name}} açıldı: artık dışarıyı görüyoruz.", "RADAR": "{{name}} dinliyor: yaklaşan her şeyi duyarız.", "SURVEY": "{{name}} kuruldu: başka gemilerin içini okuruz.", "SHIPYARD": "{{name}} çalışıyor: kendi gemilerimizi yaparız."}, "hull": {"PATCHED": "Gövde toparlanıyor.", "RENEWED": "Gemi yeniden parlıyor."}, "field": "Teleskop açıldı. Etrafımız dolu.", "dark": "Kör uçuyoruz. Teleskop olmadan hiçbir şey göremeyiz.", "rock": "Bu kayada maden var. Kazıcı onu eve getirir.", "probe": "Sonda döndü. {{name}} artık sır değil.", "yardNeed": "Sonda ganimet arıyor; taşıyacak gemimiz yok. Tersane yapar.", "ships": {"TELESCOPE": "Kargo bölmesinde bir {{hull}} bekliyordu. Teleskop kayaları gösterince maden taşır.", "SHIPYARD": "Tersane ilk gemilerini yaptı: {{hull}} ×{{count}}. Kargo bölmesinde bekliyorlar; ganimeti onlar taşır."}, "report2": {"round": "İlk savaşımızı verdik. Gemi şimdi böyle.", "drive": "Motor hâlâ yanıyor. Sıradaki onarımlar onu uyandırır.", "ready": "Motor hazır. Sıçrama penceresi açık."}, "condition": {"burning": "yanıyor", "smouldering": "tütüyor", "severed": "kopuk", "sparking": "kıvılcım atıyor", "working": "çalışıyor"}},
  "tab": {
    "repair": "Bunu açmak için {{module}} sistemini onar.",
    "mainGalaxy": "Bu, ana galakside açılır.",
    "report": "İlk sonda raporunla açılır."
  },
  "scenario": {
    "hourTitle": "Kuruluş Saati",
    "hourBadge": "60 DK AKTİF",
    "hourHeadline": "Alaşım ve kristal üretimi",
    "hourPrivilege": "Ana galaksiye iniş yaptın! İlk 60 dakika boyunca ana gezegenindeki ocaklar 5 kat (+%400) hızla üretim yapar.",
    "hourInstantTitle": "5 dk ve altı yükseltmeler anında",
    "hourInstantBody": "Toplam süresi 5 dakika veya daha az olan bina ve alet yükseltmeleri beklemeden biter. Bu kural her zaman geçerli.",
    "hourShieldTitle": "72 saat koruma kalkanı",
    "hourShieldBody": "Diğer komutanlar ana gezegenine saldıramaz. Korsan avlamak kalkanını bozmaz.",
    "hourTreasury": "Başlangıç hazinen ve filon",
    "hourStart": "Kurmaya başla",
    "mineTitle": "Asteroit kazısı",
    "mineBody": "Çevrende bir asteroit bul, dokun ve Kazıcı gönder.",
    "pirateTitle": "Korsan filosu",
    "pirateBody": "Yakında bir korsan filosu dolaşıyor. Haritada bul, dokun ve filonla saldır.",
    "probeTitle": "Gezegen keşfi",
    "probeBody": "Son görev: Haritada başka bir gezegen seç ve Sonda gönder.",
    "wrapTitle": "Galaksiye hazırsın",
    "wrapBody": "Temel görevleri tamamladın. Benden bu kadar — galakside başarılar, Komutan!",
    "wrapDone": "Tamamla",
    "dismiss": "Rehberi kapat",
    "dismissConfirm": "Rehberi kapatmak istiyor musun?",
    "dismissYes": "Kapat",
    "dismissNo": "Vazgeç",
    "stepProgress": "Görev {{current}}/{{total}}",
    "tourStep": "Arayüz {{current}}/{{total}}",
    "tourSkip": "Turu geç",
    "tourNext": "İleri",
    "tourDone": "Görevlere başla",
    "tourStatusTitle": "Etkin güçlerin ve olaylar",
    "tourStatusBody": "Sol üstten 5× Kuruluş Saati sayacını, 72 saatlik koruma kalkanını ve galaksi etkinliklerini takip edersin.",
    "tourReadoutTitle": "Hızlı hedef tarayıcısı",
    "tourReadoutBody": "Görüş alanındaki asteroitleri, korsanları ve anıtları buradan tek dokunuşla listeler ve kamerayı üstlerine odaklarsın.",
    "tourToolsTitle": "Galaksi araçları",
    "tourToolsBody": "Teleskop menzilini açıp kapatır, tek tuşla ana gezegenine döner, görev ödüllerine ve bildirimlerine buradan ulaşırsın.",
    "tourDockTitle": "Üs, filo, klan ve sohbet",
    "tourDockBody": "Alt bardan üssünü geliştirir, filonu ve klanını yönetirsin. Sağ alttaki butonla galaksi sohbetine katılırsın.",
    "batchedEvents_one": "1 galaksi etkinliği başladı — Sinyaller'de.",
    "batchedEvents_other": "{{count}} galaksi etkinliği başladı — Sinyaller'de."
  }
};
