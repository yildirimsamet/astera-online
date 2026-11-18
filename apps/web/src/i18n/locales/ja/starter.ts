/** The colony ship's screens. `docs/ux-writing.md` applies. */
export const starter = {
  "holdMoment": {"title": "積荷がいっぱいです", "body": "ここから稼いだ分は持っていけません。", "look": "跳躍を見る", "close": "閉じる"},
  "advice": {"huntRetry": "別の前哨基地を攻撃", "open": "他の選択肢", "title": "次はどうする、司令官？", "recommended": "おすすめ", "close": "閉じる", "huntProbe": "前哨基地を探査", "huntDecide": "守備隊を比べる"},
  "visual": {"probe": "探査", "mine": "採掘", "crate": "回収箱", "collect": "回収", "waiting": "航行中", "galaxy": "メイン銀河"},
  "dossier": {"surfaceGapLabel": "この船のすべて", "surfaceGapMissing": "この船を見たことがありません", "surfaceGapWhy": "誰が操縦し、修理がどこまで進み、何を積んでいるかはわかりません。探査機なら一度にすべて持ち帰ります。", "probeGapAged": "この船の情報は古くなっています", "probeGapWhy": "船内の状況に艦隊を賭けようとしています。探査機が推測を範囲に変えます。", "fleetGapWhy": "ゲームで最も価値のある情報: 不在の艦隊は自分の船を守れません。", "fleetGapRange": "到達 {{reach}}、この船までの距離 {{distance}}"},
  "reports": {"guardDown": "守備隊は全滅した。前哨基地はあと{{time}}無防備だ。別の艦隊で残りを運べる。", "outpost": "放棄された前哨基地", "pirates": "海賊", "attackedShip": "攻撃された船: {{planet}}", "walkover": "あなたの船に防衛ユニットがいなかったため、略奪可能な資源は攻撃側に開かれていました。", "cargoLimited": "貨物室が満杯でした。運びきれない量がありました。輸送艦を連れて行きましょう。", "landing": "生き残った艦は損傷を抱えたまま格納庫に戻ります。修理ステーションへは自分で送ってください。", "walkoverBody": "あなたの船に防衛ユニットがいませんでした。攻撃側は戦わずに略奪可能な資源を奪えました。", "noGroundNote": "到着時、この船に稼働中の防衛はありませんでした。", "piratesName": "海賊", "aegisNote": "イージスは防衛ユニットより先にダメージを受けます。", "whyStrong": "{{ships}}は{{guard}}の守備隊に優勢だった（{{mult}}）。", "whyWeak": "{{ships}}は{{guard}}の守備隊に劣勢だった（{{mult}}）。相手には{{answer}}を送ろう。", "whyEven": "{{ships}}と{{guard}}の守備隊は互角だった（{{mult}}）。数と戦力が勝敗を決めた。相手には{{answer}}が有利だ。", "rebuild": "失った艦：{{ships}}。再建には合金{{alloy}}、クリスタル{{crystal}}、{{time}}かかる。進行はそのまま。", "beatenBy": "{{name}}が先に到着した。艦隊が着いたとき守備隊はすでに倒れていたため、勝利には数えない。残りを手に入れた。", "firstVictory": "初勝利：勝利の箱が造船所で待っている。", "whyWon": "勝因"},
  "fleetPage": {"roomRule": "格納庫の枠は、この船に載る艦が帰還中や建造中でも使います。満杯になると建造が止まります。呼び戻した艦隊は必ず戻れます。", "bays": "攻撃発進枠", "openStation": "修理ステーションを開く", "emptyAir": "飛行中の艦隊はありません。銀河にある船、小惑星、前哨基地をタップして艦船を派遣できます。"},
  "handbook": {"title": "ハンドブック", "replay": "最初の数分をもう一度見る", "repairs": {"title": "修理がすべてを開く", "body": "修理のたびに次のシステムが開く。同時に進むのは1つで、留守の間も続く。"}, "holds": {"title": "機械は生産物を保管する", "body": "生産した資源は生産施設で待機します。プロスペクターの積荷も生産施設に入り、空きがなければ失われます。使う前に貯蔵庫へ回収しましょう。船倉の資源は略奪されます。"}, "sight": {"title": "飛ぶ前に見る", "body": "探査機の報告はある瞬間の記録だ。古くなるほど今のことはわからなくなる。"}, "fleets": {"title": "出撃中の艦隊は安全、船はそうではない", "body": "飛行中の艦は略奪されない。コロニー船と残った艦は略奪される。"}, "jump": {"title": "目標はジャンプ", "body": "最初の一巡を終えると、推進系は1回のジャンプ分動く。いつでも出発できる。貨物室に積んだものが一緒に着陸する。戻ることはできない。"}, "crates": {"title": "回収用の箱", "body": "特定の修理と、前哨基地での最初の決定的勝利で回収用の箱が見つかります。船の画面でふたを長押しすると、準備できた箱をすべて開けます。各箱から合金とクリスタルが一度だけ倉庫に入ります。これらは略奪の対象で、ジャンプ時の合金2,000・クリスタル1,000の上限にも含まれます。"}},
  "prologue": {"progress": "ステップ {{step}} / {{total}}", "skip": "スキップ", "signIn": "ログイン", "close": "閉じる", "alloy": "合金 {{value}}", "crystal": "クリスタル {{value}}", "refinery": "精錬所", "feed": "センサー回線", "action": {"power": "予備電源をつなぐ", "burn": "精錬所を動かす", "collect": "回収する", "patch": "センサー回線を応急修理"}, "dark": {"title": "船は真っ暗だ。", "body": "岩礁が船団を砕き、あなたをここへ投げ出した。前方の光が、目指していた銀河だ。"}, "powered": {"title": "予備電源は持ちこたえている。", "body": "5つのシステムはすべて損傷している。冷蔵庫にはクリスタルが {{crystal}} 残っている。修理には合金が要る。まず精錬所だ。"}, "burning": {"title": "炉に火が入る。", "body": "最初のひと炉は、最後の燃料ラインで動いている。"}, "batch": {"title": "最初のひと炉：合金 {{alloy}}。", "body": "精錬所は、あなたが取り出すまで生産物を保管する。"}, "collected": {"title": "センサーは見えていない。", "body": "他に誰が来たのかわからない。回線を応急修理すれば、耳がひとつ戻る。"}, "patching": {"title": "回線を修理中…", "body": "最初の修理だ。本物の修理はあなたが眠っている間も進む。"}, "signal": {"mark": "未知の信号", "title": "何かが応答した。", "body": "はるか遠く、アンテナは壊れていて読み取れない。ドライブにはあと一度だけ短い跳躍の力が残っている。", "replayBody": "はるか遠く、アンテナは壊れていて読み取れなかった。続きは知っているはずだ。", "replayAction": "ゲームに戻る", "go": "信号へ向かう"}, "hint": {"hold": "点火するまで長押し", "weld": "タップごとに亀裂を1つ溶接", "claim": "長押しで始める"}, "warping": {"title": "跳躍中…"}, "found": {"title": "この船はあなたのものになる。", "body": "浅瀬の向こうを漂う船。炉は燃え、耳がひとつ直った。自分のものにすれば、冒険が始まる。", "action": "舵を取る"}, "claim": {"title": "この船はあなたのものになる。", "ship": "この船", "intro": "船は合金 {{alloy}}、クリスタル {{crystal}}、稼働中の精錬所で始まる。留守の間も修理は進む。"}},
  "chatRoom": "銀河チャンネル",
  "away": {"fell": "{{name}}が陥落", "crateReady": "勝利の箱が造船所で待っています。", "beaten": "{{by}}が先に{{name}}へ到達", "details_one": "詳細（{{count}}）", "details_other": "詳細（{{count}}）", "online": "不在中に再稼働：{{systems}}", "lost": "{{value}}は収まらず", "fleetHome": "艦隊が帰還", "fleetHomeDetail_one": "+{{resources}} 資源 · {{count}} 隻", "fleetHomeDetail_other": "+{{resources}} 資源 · {{count}} 隻", "haulAlloy": "+{{value}} 合金", "haulCrystal": "+{{value}} クリスタル", "haulDeuterium": "+{{value}} 重水素", "ships_one": "{{count}} 隻", "ships_other": "{{count}} 隻", "toShip": "船へ"},
  "launchFleetsave": "飛行中の艦は略奪されません。コロニー船は略奪される可能性があります。",
  "contact": {"scout": "偵察艦", "scoutDetail": "戦いではなく偵察に来ています。遠くからスキャンして去ります。", "raid": "海賊の襲撃"},
  "outpostGuide": "{{name}} 前哨基地へ",
  "outpostReading": {"guard": "守備隊", "own": "あなたの艦隊: {{cls}}", "none": "守備隊なし", "unread": "クラス未判読", "even": "クラス均等", "most": "が大半", "beats": "› 右隣に勝つ · ↺ {{last}} › {{first}}", "carry": "運べる量", "stock": "在庫 {{band}}", "crate": "最初の決定的勝利でコンテナが開きます"},
  "outpost": {"title": "放棄された前哨基地", "rule": "守備隊を倒すと最大{{amount}}の資源を得られます。艦隊が運べるのは{{carry}}です。6時間で補充されます。", "label": "前哨基地 · レベル{{level}}"},
  "readout": {"ships": "{{count}}隻", "outposts": "前哨基地{{count}}か所", "level": "守備レベル{{level}}", "firstHunt": "最初の狩り · {{level}}"},
  "lab": {"premise": "この研究は船に残ります。メイン銀河には持ち込めません。", "holdsRole": "プロスペクターの積載量を増やします。", "queue": "船の研究", "queueHint": "船で進められる研究は一度に1件です。修理と造船所は別に進みます。", "idleHint": "マップで星を選びましょう。", "queueFull": "船で進められる研究は一度に1件です。完了を待ってください。"},
  "deck": {"label": "船内デッキ", "repairs": "修理", "yard": "造船所", "research": "研究"},
  "yard": {"against": "対象", "queue": "造船キュー", "dockRule": "ステーションの料金は本来の{{percent}}%です。", "dockHurt": "{{count}}隻がステーションを必要としています", "dockGo": "{{count}}隻を修理"},
  "board": {"title": "出発ボード", "empty": "まだ誰もジャンプしていません。最初の一人になれます。", "ago": "{{time}}前"},
  "jumpCall": {"title": "ジャンプ準備完了", "line": "メイン銀河が待っています。ドライブを開こう。"},
  "mainRow": {"facts": "{{worlds}}の世界。シーズンはあと{{days}}日で終わります。", "waiting": "新シーズンが近づいています。", "repair": "最初の修理、採掘1回、探査報告1件を終えると、推進系が1回のジャンプ分目覚めます。", "ready": "推進系の準備ができました。いつでもジャンプできます。貨物室が満ちているほど強く着陸できます。", "eyebrow": "あなたの目的地", "story": "岩礁に散らされる前、艦隊が目指していた場所。本当の旅はここから始まる。守る世界、ライバル、クラン、勝ち取るシーズン。", "legRepair": "出発準備", "legHold": "貨物室", "go": "船へ行く"},
  "plan": {"optional": "任意の修理が残り{{count}}件。役立つのは船内だけで、首都は自前の建物で始まります。"},
  "outlook": {"noFrontier": "今はどの銀河にも空きがありません。船はここで続けられ、空きが出ればジャンプできます。", "seasonClosed": "このシーズンはもう船を受け入れません。終了まで{{days}}日。船は次のシーズンに着陸し、準備済みの船には開始時に知らせます。それまで前哨基地と修理はここで役立ちます。"},
  "arrival": {"hunt": "海賊を狩る", "huntLine": "海賊艦隊まで{{minutes}}分。海賊を攻撃してもシールドは消えない。", "protection": "保護", "carried": "一緒に着陸", "package": "初シーズンの支給", "total": "使える合計", "ships": "船{{count}}隻", "decide": "最初の一手", "outward": "最初の出撃を計画", "outwardLine": "艦隊とデューテリウム{{deuterium}}が準備済み。まず目標を探査しよう。", "grow": "デューテリウム生産を開く", "growLine": "ここではデューテリウム生産はゼロ。{{research}}を研究してから{{plant}}を建てよう。飛行を支えます。"},
  "readyLabel": "出発準備",
  "wholeShip": "全システム {{done}}/{{total}}",
  "jump": {"holdTitle": "貨物室", "holdShips": "健全な艦", "holdFull": "積荷満杯：新しい収入は船に残ります。", "staysAboard": "修理と研究は船に残ります。", "leftJoin": "、", "leftPart": {"alloy": "合金{{amount}}", "crystal": "クリスタル{{amount}}", "deuterium": "デューテリウム{{amount}}", "ships_one": "船{{count}}隻", "ships_other": "船{{count}}隻"}, "stayFact": "船内の生産はメイン銀河の{{mult}}倍。", "stayAbout": "積荷の増やし方", "guardFact": "シールド{{shield}}時間 · 襲撃は司令コア{{low}}–{{high}} · {{silent}}時間でサイレントスペース", "guardAbout": "世界の守られ方", "behindAbout": "船に残る修理", "stayTitle": "ここに残るなら", "stayLine": "船内の生産はメイン銀河の{{mult}}倍です。最初の狩りとその箱、採掘遠征、生産の修理で積荷が満ちます。", "landTitle": "着陸すると", "landPack": "シーズンパック：合金{{alloy}}、クリスタル{{crystal}}、艦船{{ships}}隻。", "shield": "シールドは{{hours}}時間。指揮官を攻撃すると消え、海賊への攻撃では消えません。", "band": "あなたを襲撃できるのは司令コア{{low}}–{{high}}の指揮官だけです。", "silent": "その後{{hours}}時間、攻撃・強化・研究・造船の指示がないと、あなたの世界はサイレントスペースへ移ります。", "behindTitle": "残るもの", "panel": "ジャンプ", "go": "ジャンプの準備", "title": "{{name}}へジャンプ", "addresses": "着陸地点", "neighbours": "近くの世界:{{count}}", "friendNear": "昔の隣人{{name}}が近くにいる", "tone": {"quiet": "静か", "mixed": "中間", "busy": "混雑"}, "toneNote": {"quiet": "より安全。目標は遠い。", "mixed": "両方少しずつ。", "busy": "目標は近く、あなたも目標です。"}, "cargo": "貨物室で運ぶもの", "package": "さらに初シーズンパックと72時間のシールドを受け取ります。", "carryMost": "移住で運べるのは最大で合金{{alloy}}、クリスタル{{crystal}}、デューテリウム{{deuterium}}、船{{ships}}隻です。", "left": "失うもの:{{list}}。", "warn": "この船はジャンプで消費されます。貨物室外の資源と船は失われます。", "hold": "ジャンプ", "leaving": "出発中…", "replay": "もう一度見る", "skip": "スキップ", "scene": {"lit": "推進点火", "leaving": "浅瀬を抜ける", "gap": "虚空を越える", "fall": "{{name}}", "world": "あなたの世界"}},
  "landingRewards": {"ribbon": "修理はここで報酬になる", "body": "船がしてきたことが待っている：報酬{{count}}件。", "take": "すべて受け取る · {{count}}", "spent": "倉庫に入った。最初の強化に使おう。", "spend": "強化する", "later": "あとで"},
  "galaxyLine": {"departed": "{{name}}がメイン銀河へ跳んだ", "wreck": "戦闘が残骸フィールドを残した", "outpost": "レベル{{level}}の前哨基地が空になった"},
  "landing": {"dismiss": "閉じる", "title": "{{name}}に着陸しました", "go": "自分の世界へ", "line": {"battle": "戦闘は2倍厳しくなり、イージスは全力です。", "opened": "クランとランキングが開きました。", "alerts": "スマホ通知は最初の1週間無料。その後は通知センターから届きます。"}, "tip": {"core": "コアがティアを決めます。近いティアにしか襲撃できず、襲撃も同様です。", "colony": "コロニーは最大3つです。中立世界は短時間だけ占領できます。", "clan": "クランは情報を共有し共に守ります。クランタブを見てみましょう。", "dominion": "ドミニオンは最も多く保持する者を順位付けし、シーズン末に報酬があります。", "honor": "オナーは公平に戦う者を順位付けします。弱い艦隊への襲撃は得るものが少ないです。"}},
  "shieldNote": "艦のシールドは毎回の戦闘を満タンで始まります。船体の損傷は修理ステーションで直すまで残ります。",
  "tempoNote": "ここではダメージとイージスが半分です。メイン銀河では同じ戦闘が2倍の速さで進みます。",
  "intel": {"blind": "どの船の内部も見えていません", "openShip": "船を開く", "telescopeGives": "監視中の船の艦隊が出撃したかを示します。攻撃前に、読み取りの古さと残存戦力を考えましょう。", "telescopeCost": "船の望遠鏡を修理しましょう。", "idleHint": "空き枠: {{count}}。マップで船を選び、枠を向けましょう。", "scarcity": "周囲の船: {{neighbours}}隻。あなたの枠: {{count}}。向け直すには待ち時間があるので、よく選びましょう。", "radarGives": "範囲内の動きと、あなたの船を狙う脅威の到着時刻を示します。探査機を検知できますが、確実ではありません。", "radarCost": "船のレーダーを修理しましょう。", "nextSlot": "修理 {{level}}", "oneMore": "望遠鏡の修理 {{level}} で監視できる船が1隻増えます。", "radarLevel": "レーダー · 修理 {{level}}", "radarFleets": "レーダー修理 {{level}} は{{sense}}の距離で自分を狙う脅威を時刻なしで識別し、{{warn}}の距離で到着時刻も表示します。", "radarFleetsOne": "レーダー修理 {{level}} は{{sense}}までの移動中の機体を表示し、自分の船を狙う脅威には到着時刻を付けます。", "radarBearing": " 修理 2 で飛来方向もわかります。", "radarQuiet": "スキャンは検知されていません。レーダーは作動中です。", "scaleNote": "各バーはゼロから始まります。帯は相手の推定値、青緑の線はあなたの船です。", "attack": "攻撃", "howTo": {"title": "2つの前哨基地を比べる", "guard": "守備隊: クラス列で艦隊が守備隊の左にあれば有利、右にあれば不利です。", "bars": "バー: 線があなたの戦力です。防御と艦隊が線の左にあれば、前哨基地はあなたより弱いです。", "carry": "積載: 艦隊は運べる分だけ持ち帰ります。", "go": "決めたら{{attack}}を押し、艦隊を選んで送り出します。"}, "home": "自分の船へ飛ぶ"},
  "news": {"victoryCrateOpened": "勝利の箱を開けました：合金+{{alloy}}、クリスタル+{{crystal}}。", "crateOpened_one": "回収箱を開けました：合金+{{alloy}}、クリスタル+{{crystal}}。", "crateOpened_other": "回収箱を{{count}}個開けました：合金+{{alloy}}、クリスタル+{{crystal}}。", "mineHome_one": "プロスペクターが{{brought}}を持ち帰りました。すべて生産施設に入りました。", "mineHome_other": "プロスペクター{{count}}機が{{brought}}を持ち帰りました。すべて生産施設に入りました。", "mineLost_one": "プロスペクターが{{brought}}を持ち帰りました。{{landed}}が生産施設に入り、{{lost}}は空きがなく失われました。", "mineLost_other": "プロスペクター{{count}}機が{{brought}}を持ち帰りました。{{landed}}が生産施設に入り、{{lost}}は空きがなく失われました。", "mineEmpty_one": "プロスペクターは空のまま戻りました。持ち帰れるものは残っていませんでした。", "mineEmpty_other": "プロスペクター{{count}}機は空のまま戻りました。持ち帰れるものは残っていませんでした。", "repairDone": "{{name}}を修理しました。", "probeReport": "{{name}}の探査レポートが届きました。", "probeDetected": "探査機があなたの船をスキャンしました。", "radarPast": "レーダー:艦隊が到着しました。", "shieldPast": "シールドが消えました。", "radar": "レーダー:{{time}}後に艦隊が到着します。", "raidOver": "{{name}}への攻撃が終わりました。報告を読みましょう。", "firstVictory": "{{name}}が陥落！勝利の箱が造船所で待っている。", "beatenBy": "{{by}}が先に{{name}}へ到着した。守備隊はすでに倒れていた。報告を読もう。", "attacked": "{{name}}があなたの船を攻撃しました。報告を読みましょう。", "fleetHome": "艦隊が帰還しました。", "turnedBack": "目標に到達できませんでした。艦隊は引き返しています。", "yardDone": "造船所:{{name}} {{count}}隻が完成しました。", "researchDone": "{{name}}がレベル{{level}}になりました。", "dockDone": "修理ステーションの作業が終わりました。艦は万全です。", "shieldWarning": "シールドは{{time}}後に消えます。", "seasonOpen": "{{name}}で新シーズンが始まりました。船はジャンプできます。"},
  "reading": {"repairLabel": "修理", "repairNote": "この船の修理の進み具合です。進むほど蓄えが増え、出発が近づきます。", "unknownShip": "未確認の船"},
  "systemShort": {"REFINERY": "精製", "SURVEY": "探査", "DEFENCE": "防衛", "CARGO": "貨物", "DRIVE": "駆動"},
  "systemsLabel": "船のシステム",
  "locked": "ロック中",
  "perHour": "/時",
  "moreRepairs": "ほかの修理", "nextRepairs": "修理",
  "slots": "作業枠",
  "stepState": {"done": "修理済み", "queued": "待機中", "closed": "ロック中", "open": "準備完了"},
  "quiet": {"warn": "{{time}}以内に修理しないと、船はこの銀河での場所を失います。", "asleep": "{{hours}}時間修理がなかったため、船は場所を失いました。修理を始めると場所に戻れます。"},
  "queue": {"title": "修理の待ち列"},
  "eyebrow": "植民船",
  "goal": "船を立て直し、推進系を目覚めさせ、本銀河へ跳ぶ時を自分で選ぼう。",
  "next": "次の修理",
  "tutorial": {"skip": {"link": "ガイドは不要です", "title": "ガイドを閉じますか？", "body": "ガイドを閉じてもよろしいですか？士官による案内は終了します。メニューのアカデミーからいつでも再開できます。ゲームは今の状態から続けられます。", "keep": "ガイドを続ける", "close": "ガイドを閉じる", "again": "ガイドを再開する", "againHint": "偵察士官がまた案内します"}, "chapter": {"1": "目覚め", "2": "最初の修理", "3": "目を開く", "4": "最初の探査機", "5": "造船所", "6": "最初の収穫", "7": "望遠鏡", "8": "レーダー", "9": "メイン銀河への道"}, "next": "次へ", "reveal": "メッセージをすべて表示", "away": "終わったら呼びます。{{clock}}ごろです。それまで船と銀河を見て回ってください。", "ok": "OK", "back": "{{time}}後に戻ります", "reopen": "ガイドを表示", "nav": {"openShip": "修理は船内で行う。{{base}}タブだ。", "openShip_work": "次の作業は船内で。{{base}}タブだ。", "closePage": "次の作業は銀河で。このページを閉じよう。", "dismissUnlock": "新しいシステムが稼働した。カードを読んで閉じよう。"}, "line": {"online": "司令官、無線が通じた！この船は君のものだ。精錬所を起こそう。", "collect": "修理は合金で払う。精錬所の産出は生産施設で待っている。倉庫へ移そう。", "orderRefinery": "修理には合金と結晶が要る。まず{{name}}で合金を速めよう。", "waitFirst": "5秒で終わる。大きな修理は君がいない間も続く。", "firstCrate": "封印された区画が開いた。コンテナを長押し。中身は君のものだ。", "openIntel": "探査機が戻った。報告は{{intel}}で待っている。", "openReport": "わかっていることはすべてここに。探査した船を開こう。", "report": "光る部分が勝利で運べる獲物だ。読んでから艦隊を出す。", "farewell": "船の修理は{{percent}}%。次の作業がジャンプを開く。", "farewell_open": "ジャンプが開いた。「ジャンプの準備」から行ける。急がなくていい。とどまるほど貨物室が満ちる。", "mine": "この岩には鉱石がある。プロスペクターが船へ運ぶ。", "collectMine": "プロスペクターが帰還した！積荷は生産施設で待っている。", "telescopeLook": "望遠鏡が見えるようになった。岩と通過する艦隊だ。ドラッグして見回そう。", "zoomRock": "岩は遠い。2本の指を広げるか、ホイールで近づこう。", "findRock": "岩が近くなった。ひとつ選ぼう。", "radarRing": "レーダーが動きを捉えた！緑の円は望遠鏡に見えないものを聞く。", "radarContact": "? は正体不明の航行だ。こちらへ来る艦隊はまずここに現れる。", "sightTrio": "望遠鏡がその航行を識別した。レーダーは警告、探査機は中を読む。", "openCrate": "次のコンテナが開ける。次の修理の代金入りだ。長押ししよう。", "orderExtractor": "繊細な部品は結晶で直す。{{name}}が結晶を作る。", "orderTelescope": "何も見えない。{{name}}で周囲が見える。", "orderRadar": "近づくものを先に聞きたい。{{name}}が遠くの動きを捉える。", "waitTelescope": "望遠鏡が開いていく。もうすぐ外が見える。", "waitRadar": "レーダーが起動中だ。もうすぐ接近する動きが聞こえる。", "orderSurvey": "他の船の中を読みたい。{{name}}が探査機を送る。", "waitSurvey": "アンテナを建設中だ。完成したら隣の船を探査できる。", "probe": "一人じゃない。隣の船に探査機を送り、何を持っているか確かめよう。", "orderShipyard": "獲物を運ぶ船がない。{{name}}が船を造る。", "waitYard": "造船所を建設中だ。完成したら自分の船を造れる。", "buildShip": "船が2隻そろった。自分でも1隻造ろう。光る船体だ。"}, "push": "修理が終わったときや、誰かが船に近づいたときにお知らせしてもよいですか？", "allow": "通知する", "later": "あとで", "hint": "進路に迷いましたか？{{task}} 次のステップの行をタップしてください。", "dismiss": "了解"},
  "outcome": {"courage": "勇気は報われます。造船所に勇気の箱が届いています。", "DECISIVE": "前哨基地を制圧", "PARTIAL": "部分的な結果", "REPELLED": "撃退された", "BEATEN": "先を越された", "beaten": "{{by}}が先に到着した。守備隊はすでに倒れていた。残りを手に入れた。", "crate": "初勝利！勝利の箱が造船所で待っている。", "line": {"DECISIVE": "守備隊は崩れた。勝因は報告に。", "PARTIAL": "守備隊の一部が倒れた。足りなかったものは報告に。", "REPELLED": "守備隊は持ちこたえた。理由は報告に。"}, "lost_one": "{{count}}隻を失った", "lost_other": "{{count}}隻を失った", "lootHome": "戦利品は艦隊の帰還時に倉庫へ入る。", "ok": "OK", "report": "報告を読む", "openCrate": "箱を開ける"},
  "objective": {"zoomRock": "小惑星に近づいてください。", "huntRetry": "その戦いには勝てませんでした。より強い艦隊で{{name}}を攻撃しましょう。", "probe": "一番近い船に探査機を送る。タップして探す。", "mine": "最寄りの小惑星へプロスペクターを送りましょう。タップして探せます。", "underwayProbe": "探査機は移動中。報告は情報タブに届く。", "underwayMine": "プロスペクターは採掘中。自動で戻ってくる。", "restSave": "今はここまで。{{clock}}頃に戻って{{name}}を。", "restWait": "今はここまで。修理は{{clock}}頃に終わる。", "repair": "{{name}}を修理する。船を開く。", "collect": "生産施設が作ったものを上のバーから回収する。", "save": "{{name}}：あと約{{time}}で支払える。", "saveNever": "{{name}}：足りない資源を作る設備を修理する。", "wait": "修理中。{{time}}後に完了。", "huntProbeMining": "プロスペクターは移動中。その間に、海賊の前哨基地が二つある。守備隊を知らずに攻めはしない。探査機を送ろう。", "huntProbe": "海賊の前哨基地が二つある。守備隊を知らずに攻めはしない。探査機を送ろう。", "huntProbing": "探査機は移動中。戻ったら守備隊を読む。", "huntDecide": "報告が届いた。二つの守備隊を比べて、艦を選ぼう。", "huntRaid": "艦隊が前哨基地へ向かっている。戦闘は到着時だ。", "crate": "準備できたコンテナを開けよう。次の修理に必要な資源が入っている。"},
  "log": {"title": "航海日誌", "now": "今", "go": "行く", "chapter": {"POWER": {"title": "電力", "line": "予備電力は持っている。船は目覚めた。"}, "REFINERY": {"title": "精錬所", "line": "合金と結晶を作る。修理はすべてそれで払う。"}, "SURVEY": {"title": "探査", "line": "アンテナ：探査機、レポート、情報タブ。"}, "DEFENCE": {"title": "防衛", "line": "イージス、望遠鏡、レーダー：襲撃を事前に察知し、耐え抜く。"}, "CARGO": {"title": "貨物", "line": "造船所と格納庫：最初の船と艦隊タブ。"}, "DRIVE": {"title": "ドライブ", "line": "最初の一巡で1回のジャンプ分目覚める。いつ発つかはあなたが決める。"}}},
  "repair": "修理",
  "stepCount": "段階 {{stage}}/{{total}}",
  "optional": "任意・修理率には含まれません",
  "inQueue": "待機中", "readyIn": "完了まで{{time}}",
  "systemAria": "{{name}}: 修理 {{total}} 件中 {{done}} 件、{{state}}",
  "needs": "先に: {{what}}",
  "go": "見る",
  "queueFull": "修理の待ち列は {{count}} 件までです。完了を待ってください。",
  "affordIn": "{{what}}不足 · 約{{time}}でたまる。",
  "collectFirst": "{{what}}不足 · 上のバーの生産施設から回収しよう。",
  "noIncome": "{{what}}不足 · まだ生産源がない。生産するシステムを修理しよう。",
  "allQueued": "必須の修理はすべて完了または待機中です。",
  "allRepaired": "必須の修理はすべて完了しました。",
  "ordered": "{{name}}: 修理を注文しました",
  "state": {
    "broken": "故障",
    "damaged": "損傷",
    "done": "修理済み"
  },
  "system": {
    "REFINERY": "精製モジュール",
    "SURVEY": "探査アンテナ",
    "DEFENCE": "防衛システム",
    "CARGO": "貨物室と格納庫",
    "DRIVE": "恒星間エンジン"
  },
  "module": {
    "SURVEY": "探査アンテナ"
  },
  "fact": {
    "FIRST_PROBE_REPORT": "最初のプローブレポート",
    "FIRST_MINING_SENT": "最初のプロスペクター発進", "FIRST_MINING_RETURN": "最初の採掘帰還",
    "FIRST_BATTLE_REPORT": "最初の戦闘レポート",
    "FIRST_OUTPOST_VICTORY": "最初の前哨基地での勝利",
    "FIRST_OUTPOST_DEFEAT": "最初の前哨基地攻撃"
  },
  "factHow": {"FIRST_OUTPOST_DEFEAT": "前哨基地を攻撃しましょう。", "FIRST_PROBE_REPORT": "近くの船か前哨基地にプローブを送りましょう。", "FIRST_MINING_SENT": "プロスペクターを小惑星に送りましょう。", "FIRST_MINING_RETURN": "プロスペクターを小惑星に送り、戻るのを待ちましょう。", "FIRST_BATTLE_REPORT": "前哨基地を襲撃するか、イージス稼働後に海賊を迎え撃ちましょう。その戦闘のレポートが条件になります。", "FIRST_OUTPOST_VICTORY": "前哨基地の守備隊に決定的勝利を収めましょう。"},
  "attackLocked": "船を攻撃するには、自分のイージスの修理と一度の戦闘が必要です。イージスがあると、あなたの船も攻撃されるようになります。",
  "aegisChoice": {"title": "選ぶのは君だ", "hold": "イージスを修理", "with": "イージスあり", "withShield": "ダメージはまずシールドが受ける。", "withPirates": "海賊が来るようになる。", "withNeighbours": "{{hours}}時間後、近隣の船も君を攻撃できる。", "withAttack": "一度戦えば、君も船を攻撃できる。", "without": "イージスなし", "withoutSafe": "海賊も近隣の船も君を攻撃できない。", "withoutOutposts": "襲撃できるのは前哨基地だけ。", "withoutJump": "出発には不要。"},
  "outpostLocked": "前哨基地への襲撃は造船所で開きます。造船所を修理すると、建造した船でここを襲撃できます。",
  "effect": {
    "rate": {
      "alloy": "合金 +{{amount}}/時",
      "crystal": "クリスタル +{{amount}}/時",
      "deuterium": "重水素 +{{amount}}/時"
    },
    "ships": "付属: {{ships}}",
    "deuterium": "重水素 {{amount}} 付属",
    "room": "格納庫容量 {{room}}",
    "storeCeiling": "合金の貯蔵上限 {{from}} → {{to}}",
    "telescope": "望遠鏡の範囲 {{distance}}",
    "radar": "レーダーの範囲 {{distance}}",
    "aegis": "イージス {{hp}}",
    "surveyBand": "プローブの読み取り幅が狭まる"
  },
  "feature": {
    "production": {
      "gain": "生産が開く",
      "line": "精製所が合金を作ります。上部バーから回収してください。"
    },
    "intel": {
      "gain": "プローブが開く",
      "line": "近くの船が暗い点で表示されます。プローブでその船の保有物が分かります。"
    },
    "fleet": {
      "gain": "艦隊が開く",
      "line": "船を建造し、プロスペクターで小惑星を採掘し、前哨基地を襲撃し、損傷した船を修理ステーションで直せます。"
    },
    "chat": {
      "gain": "チャットが開く",
      "line": "この銀河の他の船と話せます。"
    },
    "salvage": {
      "gain": "残骸フィールドが開く",
      "line": "残骸フィールドがマップに表示されます。プロスペクターで回収できます。"
    },
    "research": {
      "gain": "研究が開く",
      "line": "研究で船とプロスペクターの積載を強化します。この船とともに終わります。"
    },
    "telescope": {
      "gain": "望遠鏡が開く",
      "line": "リングの内側で他の船とその飛行が見えます。"
    },
    "radar": {
      "gain": "レーダーが開く",
      "line": "リングの内側の飛行は不明な接触として表示され、警告します。"
    },
    "defence": {
      "gain": "防衛が開く",
      "line": "イージスが先にダメージを受け止めます。海賊や他の船がこの船を攻撃できるようになります。一度戦闘をすると、あなたも船を攻撃できます。"
    },
    "attack": {
      "gain": "攻撃が開く",
      "line": "イージスが稼働している船を攻撃できます。相手もあなたを攻撃できます。"
    },
    "deuterium": {
      "gain": "重水素が開く",
      "line": "飛行は重水素を消費します。この精製所が生産します。"
    },
    "migration": {
      "gain": "ジャンプが開く",
      "line": "推進系が1回のジャンプ分動くようになった。ジャンプは船の「駆動」から。急がなくていい。とどまるほど貨物室が満ちる。"
    }
  },
  "funnel": {"title": "開始時の道のり", "sessions": "{{accounts}}アカウント・{{sessions}}セッション・2回目に戻ったアカウント{{returned}}件", "push": "通知：質問{{asked}}・許可{{granted}}・拒否{{denied}}", "crates": "箱：{{accounts}}アカウントで{{opened}}個開封", "chain": "命令の連鎖：命令{{accepted}}アカウント → 結果受領{{resolved}} → 確認{{viewed}} → 次の命令{{decided}}", "haul": "最初の採掘帰還：{{returned}}アカウント・純益あり{{gained}}・満杯の施設で損失{{wasted}}", "steps": "ステップと離脱", "dropoff": "到達{{accounts}}・前より{{dropoff}}件減少"},
  "crate": {"victory": "初勝利のコンテナ", "title_one": "回収コンテナ", "title_other": "回収コンテナ ×{{count}}", "hold": "長押しで開けて受け取る", "open": "開ける：{{purse}}"},
  "unlock": {
    "online": "{{system}} 復旧",
    "try": "試す",
    "showJump": "ジャンプを見る",
    "later": "あとで"
  },
  "director": {"skip": "長押しでスキップ", "shipReport": {"orbit": "船は持ちこたえている。だが半分死んでいる。", "goal": "エンジンに火を入れれば、ここを出られる。"}, "repair": {"work": "{{name}}を修理中。", "REFINERY": "{{name}}が稼働：合金が速く流れる。", "EXTRACTOR": "{{name}}が点火：結晶が精密な部品を直す。", "TELESCOPE": "{{name}}が開いた：外が見える。", "RADAR": "{{name}}が聞いている：近づくものは分かる。", "SURVEY": "{{name}}が立った：他の船を読める。", "SHIPYARD": "{{name}}が稼働：自分の船を造れる。"}, "hull": {"PATCHED": "船体がまとまってきた。", "RENEWED": "船がまた輝く。"}, "field": "望遠鏡が開いた。周りは賑やかだ。", "dark": "盲目で飛んでいる。望遠鏡なしでは何も見えない。", "rock": "この岩には鉱石がある。採掘船が持ち帰る。", "contact": "何かが近づいている。正体は分からない。", "probe": "探査機が戻った。{{name}}はもう謎じゃない。", "yardNeed": "探査機が獲物を探している。運ぶには造船所の船がいる。", "ships": {"TELESCOPE": "貨物室に{{hull}}が待機していた。望遠鏡が岩を映したので、採掘に行ける。", "SHIPYARD": "造船所が最初の艦を造った：{{hull}} ×{{count}}。貨物室で待機し、戦利品を運ぶ。"}, "report2": {"round": "最初の戦いを終えた。船は今こうだ。", "drive": "エンジンはまだ燃えている。次の修理で目を覚ます。", "ready": "エンジンは準備完了。ジャンプの窓が開いた。"}, "condition": {"burning": "炎上中", "smouldering": "くすぶり", "severed": "断線", "sparking": "火花", "working": "稼働中"}},
  "tab": {
    "repair": "開くには {{module}} を修理してください。",
    "mainGalaxy": "本銀河で開きます。",
    "report": "最初の探査レポートで開きます。"
  }
};
