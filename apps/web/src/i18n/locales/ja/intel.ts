/**
 * WHAT YOU KNOW — the intel centre, the battle reports, the clarity readout, and
 * the dossier lines the focus rail is built from.
 */

export const intel = {
  shelf: {
    label: "情報",
    watch: "時計",
    reports: "レポート",
    radar: "レーダー",
  },
  rivals: {
    heading: "マークされたライバル",
    none: "銀河上の彼らの世界のライバルをマークします。マークは彼らが保持するあらゆる世界へと彼らを追っていきます。",
    lost: "をディスクから削除",
  },
  known: {
    heading: "あなたが知っていること",
    legendToggle: "透明度と古さ",
    legend: "バーは 望遠鏡 の明瞭さ、ライブです。探査機の読み取り値は経年変化します。1 時間後には画像が粒状になり、1 日後には色あせ、どれくらい前のものかを示します。",
    telescope: "望遠鏡",
    probe: "プローブレポート",
    window: "ウィンドウ {{duration}}",
    empty: "まだ何も知られていません: 望遠鏡 はライブを監視し、プローブは 1 つの読み取り値を返します。",
  },
  openOrbit: "オープンオービット",
  tabs: {
    label: "情報のレポート",
  },
  coverage: {
    label: "カバレッジ",
    blind: "単一の惑星を見ることはできません",
    partial_one: "{{count}} スロットの {{seen}} を監視しています",
    partial_other: "{{count}} スロットの {{seen}} を監視しています",
    full: "あなたが持っているすべてのスロットは誰かを監視しています",
    blindHint: "望遠鏡 はそれを阻止する最も安価な方法です。",
    idleHint_one: "{{count}} スロットはアイドル状態です。銀河の中から世界を 1 つ選び、そこを指します。",
    idleHint_other: "{{count}} スロットはアイドル状態です。銀河の中から世界を 1 つ選び、そこを指します。",
    scarcity_one:
      "{{neighbours}} 世界はそこにあり、{{count}} は目を費やします。誰かを動かすとクールダウンがかかるので、誰を動かすかを選択してください。",
    scarcity_other:
      "{{neighbours}} の世界がそこにあり、{{count}} の目を費やします。誰かを動かすとクールダウンがかかるので、誰を動かすかを選択してください。",
    oneMore: "望遠鏡 L{{level}} ならもう 1 つ見ます。",
    noRadar: "そして、レーダー がない場合、自分を狙った脅威と他の動きを区別することはできません。",
  },

  watching: {
    nextSlot: "望遠鏡 L{{level}}",
    heading: "見てます",
    slotsUsed: "{{used}}/{{total}} スロットを使用",
    slotLabel: "スロット {{slot}}",
    slotEmpty: "アイドル状態",
    missingNoSlot: "スロットが何も指されていません",
    missingNoTelescope: "望遠鏡 がありません",
    gives: "惑星の艦隊が出発する瞬間をお知らせします。これは、あらゆる襲撃を決定する唯一の事実です。",
    costPoint: "銀河内の惑星を選択し、それにスロットを向けます。",
    costInstall: "あなたの惑星の画面からインストールしてください。",
    away: "彼らの惑星は、彼らが残したものによって守られています。",
    intermittent:
      "断続的な読み取りは、最大で 20 分ごとに更新されます。もう一度確認しても改善されません。ウィンドウがひっくり返るまで答えは固定されます。",
  },

  probes: {
    openDossier: "オープンドシエ",
    heading: "プローブレポート",
    newest: "新しい順",
    missing: "プローブは戻ってきません",
    gives: "リソースと単位の推定値 (範囲として表示)。戦闘結果を保証するものではありません。",
    /**
     * THE FIGURES ARE INTERPOLATED, NOT WRITTEN. D59.
     *
     * This line said "220 alloy" for two phases while `PROBE` charged 50 and 50 —
     * a price the game had never charged, on the one card whose whole job is to
     * sell scouting to somebody deciding whether to look or to hit. It is passed
     * the real constants now, so it cannot drift from them again.
     *
     * Speed leads the sentence on the owner's instruction: a probe is the fastest
     * thing a commander can arm, and nobody was using it.
     */
    cost: "速くて安い — {{alloy}} 合金、{{crystal}} クリスタル、そしてそれはあなたが所有するすべての軍艦を上回ります。彼らのレーダーがそれを捉えるかもしれない。",
    stock: "在庫",
    defence: "武装ユニット値",
    ships: "船",
    accuracyHome: "{{percent}} 精度 · 艦隊は帰国しました",
    accuracyOut: "{{percent}} 精度・艦隊が出ました",
    scaleNote: "各バーはゼロから始まります。帯は推定値、青緑色の線はあなたの世界を表します。",
    estimateNote: "これらの数値は推定範囲です。武装ユニットの値には、シールドと非武装の船は含まれません。",
    caught: "彼らはそれを捕まえました",
    /* Two words beside the signal bars, which carry the accuracy themselves. */
    homeTag: "艦隊は帰国しました",
    outTag: "艦隊は終了しました",
  },

  radar: {
    glance: "レーダー · 過去 24 時間",
    contacts_one: "{{count}} 連絡先",
    contacts_other: "{{count}} 連絡先",
    dayAgo: "−24時間",
    now: "現在",
    day: "過去 24 時間",
    heading: "誰があなたを見ていますか",
    level: "レーダー L{{level}}",
    missing: "レーダー がありません",
    gives:
      "宇宙船が動いているのが見える円を描き、あなたを狙った探査機を捕捉し、飛行の残り時間であなたの世界を狙った脅威をマークします。",
    cost: "誰かがこの惑星の全体像を構築できるかもしれませんが、あなたには決してわかりません。",
    quiet: "何もスキャンされていません。 レーダー L{{level}} が聞いています。",
    scan: "スキャンが検出されました",
    bearing: "銀河の{{bearing}}から",
    origin: " · {{planet}}",
    /** Which of the caller's own worlds the scan landed on. */
    onWorld: " · {{planet}}",
    /* Captions beside the two drawn rings; the picture carries the rest. */
    ringSense: "何かがそこにあります",
    ringWarn: "時間制限付き警告",
    /** While the two circles are one, one caption states what the circle does. */
    ringOne: "検出と時限警告",
    /**
     * THE READING FOR SOMEBODY WHO CANNOT SEE THE RINGS. The two circles carry
     * both figures and the difference between them; this is the same fact in the
     * one form a screen reader can take.
     */
    noteFleets:
      "レーダー L{{level}} は、時計なしで {{sense}} ユニットを狙った脅威を識別します。 {{warn}}台では到着時間を加算します。",
    /** The merged form. One circle, both products, one sentence. */
    noteFleetsOne:
      "レーダー L{{level}} は、{{sense}} ユニットに向けて移動する宇宙船を示し、その到着時刻であなたの世界を狙った脅威を示します。",
    /**
     * THE HALF NO PICTURE CAN DRAW. D49: a reach is what the defender owns and
     * the warning it buys is what the ATTACKER decides, by choosing what to fly.
     * The rings are fixed; how long something sits inside them is not.
     */
    noteSlow: "低速で重い艦隊が レーダー リーチ内に長く留まります。",
    noteProbesLegacy: "レーダー L{{level}} はプローブを捕捉し、そのサークル内に侵入する艦隊について警告します。",
    noteBearing: "L2 は、来た方向を追加します。",
    noteOrigin: "L5 は惑星に名前を付けます。",
  },
} as const;

export const reports = {
  heading: "戦闘レポート",
  newest: "新しい順",
  empty:
    "まだ何も争われていません。戦闘は、このゲームにおいて決して推測ではない唯一の情報です。",
  youRaided: "あなたが襲撃しました",
  raidedBy: "による襲撃",
  rounds: "{{count}} ラウンド",
  sheetYouRaided: "ターゲット: {{opponent}}・{{planet}}",
  sheetYouRaidedPirate: "ターゲット: {{opponent}}",
  sheetTheyRaided: "攻撃者: {{opponent}}",
  attackedPlanet: "攻撃された惑星: {{planet}}",
  heldAgainstYou: "{{planet}}は守り続けた。この襲撃では戦利品は何も得られませんでした。",
  brokenByYou: "{{planet}} の防御にダメージを与えました。",
  /**
   * A PIRATE VERDICT NAMES NO WORLD, because there is not one. Both sentences
   * above are built around `{{planet}}`, which is the empty string out here.
   */
  pirateBroken: "乗組員が壊れました。彼らに残ったものはあなたのものです。",
  pirateHeld: "海賊たちは守り続けた。この襲撃では戦利品は何も得られませんでした。",
  /** The prize, and the only door in the game into a hull you did not build. */
  pirateCaptured: "海賊より",
  pirateOverrun: '護衛を失った輸送艦は逃げられなかった：{{fleet}}。',
  pirateCapturedNote:
    "あなたが破壊した乗組員の残骸から無傷で採取されました。これは、艦隊が戻る世界の駐屯地に加わります (たとえ 格納庫 容量を超えていたとしても) が、あなたが建造したものとしてカウントされません。",
  youHeld: "襲撃を中止しました。攻撃者はリソースを何も取得しませんでした。",
  youFell: "襲撃により防御が損傷しました。",
  /** The price of the haul, beside it. `Rounds` is the model's number, not the player's. */
  shipsLost: "船舶紛失",
  haul: "帰ってきたもの",
  haulLost: "彼らが奪ったもの",
  /** What your Garbage Collectors lifted — beside the haul, never inside it. D200. */
  salvageHaul: "残骸からの回収",
  roundsLabel: "ラウンド",
  taken: "撮影されました",
  lost: "紛失しました",
  dominion: "ドミニオン",
  dominionSummaryGained: "この戦闘で {{amount}} ドミニオンを獲得しました。",
  dominionSummaryLost: "この戦闘で {{amount}} ドミニオンを失いました。",
  dominionReason: "確保した戦利品と敵の恒久的な損失でポイントが増えます。奪われた戦利品と自軍の恒久的な損失で減ります。艦船の隻数ではなく資源価値で計算します。",
  dominionBreakdown: {
    title: "ドミニオンの動き",
    lootGained: "確保された戦利品",
    lootLost: "戦利品はあなたから奪われました",
    enemyLosses: "敵の永久損失",
    ownLosses: "永久的な損失",
    total: "合計ポイント変更",
  },
  clansAtLaunch: "この艦隊が発足したときのクラン",
  yourClan: "あなたの側",
  theirClan: "彼らの側",
  noClan: "クランがありません",
  verdict: {
    label: "戦闘結果",
    yourForce: "あなたの力",
    yourLosses: "あなたの損失",
    sent: "送信済み",
    held: "持っていました",
    total: "合計",
    lost: "紛失しました",
    returned: "生き残った",
    standing: "立っている",
    destroyed: "あなたが破壊しました",
    enemyDestroyed: "敵ユニットを破壊しました",
    attackerDestroyed: "攻撃船を破壊",
    noneReturned: "あなたの船は戦闘で生き残れませんでした。",
    someReturned: "{{count}} 隻の船が戦闘を生き延びました。",
    enemySurvivedNote: "敵ユニットは残っています。彼らの数は隠されています。この数はあなたが破壊したものだけです。",
    enemyUnknownNote: "この番号はあなたが破壊したものだけです。残りの敵の数は非表示になります。",
    loot: "戦利品",
    rosterUnknown: "このレポートには開始カウントがありません。生存数は計算できません。",
    walkoverSummary: "目標を防衛するユニットが存在しませんでした。争いはなかった。",
    piratePartialSummary: "海賊艦隊の一部は戦闘終了時点でもまだ生きていた。",
    title: {
      attacking: {
        DECISIVE: "襲撃は成功しました",
        DECISIVE_WIPED: "防御を突破しましたが、艦隊を失いました",
        PARTIAL: "襲撃は部分的に成功しました",
        PARTIAL_WIPED: "防御にダメージを与えましたが、艦隊を失いました",
        REPELLED: "あなたの襲撃は撃退されました",
      },
      defending: {
        DECISIVE: "防御が突破されました",
        PARTIAL: "防御が部分的に突破されました",
        REPELLED: "レイドを停止しました",
      },
    },
    summary: {
      attacking: {
        DECISIVE: "目標を防衛するユニットが残っていない。",
        PARTIAL: "完全成功条件が満たされませんでした。防御ユニットまたはシールドがまだ立っています。",
        REPELLED: "敵は守り続けた。戦利品は何も取らなかった。",
      },
      defending: {
        DECISIVE: "この戦闘であなたの防御ユニットはすべて破壊されました。",
        PARTIAL: "攻撃者は完全には成功しませんでした。ユニットまたはシールドはまだ立っていたままです。",
        REPELLED: "防御は維持されました。襲撃者は略奪品を何も取らなかった。",
      },
    },
  },
  /*
    WHAT IT SHOWS IS LOSSES, so that is what it says. The heading claimed 'what
    they had' over a list of what was DESTROYED — and its own empty state said
    'nothing of theirs was destroyed', so the two disagreed inside one block.
    Losses are still the floor on what they fielded; the dossier is where that
    inference is drawn, and it says 'at least' in as many words.
  */
  theirLosses: "あなたが破壊したもの",
  theirs: "彼らが持っていたもの",
  theirsEmpty: "彼らのものは何も破壊されませんでした。",
  /** The roster table. 'What it cost you' describes one of its three columns. */
  yourForce: "あなたの力",
  yours: "かかった費用",
  yoursEmpty: "何も失いませんでした。",
  howItWent: "どうなったか",
  reasonHeading: "なぜこの結果になるのでしょうか?",
  rulesToggle: "戦闘ルールと計算",
  roundCalculationToggle: "このラウンドのショット計算を表示",
  roundLossesYours: "あなたのユニットは破壊されました",
  roundLossesTheirs: "敵ユニットを破壊しました",
  roundNoCasualties: "損失なし",
  roundShield: "防御側のシールドが {{amount}} のダメージを吸収しました。",
  turningPointSupport: "{{round}} ラウンドの後、発砲できるユニットはありませんでした。 {{support}} 残りの支援船は攻撃できませんでした。",
  turningPointWiped: "{{round}} ラウンドの後、あなたの部隊全体が破壊されました。",
  roundDamageNote: "ダメージ数値には、防御側のシールドによって吸収されたダメージが含まれます。",
  roundDealt: "対応しました",
  roundTook: "あなたが撮った",
  roundLine: "あなたは <0>{{dealt}}</0> を取引しました、<1>{{took}}</1> を受け取りました",
  shield: "シールド {{amount}}",
  shieldBreaker: "ヌリファイア +{{amount}}",
  aegis: {
    aria: "イージス シールド",
    label: "イージス",
    labelTheirs: "敵 イージス シールド",
    labelYours: "イージス シールド",
    broken: "壊れました",
    roundedZero: "報告数 0",
    damaged: "破損しました",
    held: "開催中",
    before: "戦闘前",
    after: "戦闘後",
    note: "惑星シールドは防御ユニットよりも先にダメージを受けます。",
    brokenUnitsRemain: "シールドは 0 を報告しましたが、防御ユニットは生き残りました。",
    brokenDefenceGone: "シールドが壊れました。この戦闘で防御側のユニットもすべて破壊されました。",
    brokenMeaning: "シールド強度は四捨五入です。報告された 0 だけでは、防御部隊がすべて破壊されたことを証明するものではありません。",
    absorbed: "{{amount}} シールドダメージ吸収",
  },
  /* ── what a report owes each case. `docs/battle-reports.md` ── */
  /**
   * THE WALKOVER. `resolveCombat` breaks before round one when there is nothing
   * standing and no shield, so the most common raid in the game arrives with
   * `rounds: []` — and drew a heading over an empty plate.
   */
  /** The four questions a battle report answers, in the order a reader asks them. */
  q: {
    happened: "何が起こったのですか",
    there: "敵について学んだこと",
    enemyForce: "戦闘開始時の敵ユニット",
    enemyLosses: "敵から破壊したもの",
    incomingForce: "あなたを攻撃した艦隊",
    who: "あなたの勢力はどうなりましたか？",
    changed: "戦利品とポイントの変更",
  },
  walkoverHeading: "ここには守備部隊はいませんでした",
  walkoverBody:
    "ここには戦闘艦隊も地上防衛も存在しませんでした。あなたの船が到着し、荷物を積み込んで出発しました。報告すべき戦いはなかった。",
  walkoverDefendingBody:
    "あなたの世界には防御ユニットは存在しませんでした。攻撃する艦隊は戦わずに入手可能な戦利品を奪うことができました。",
  /** Their board, and how far the reading goes. */
  theirBoardComplete: "戦闘開始時に防御している全ユニット",
  theirBoardCompleteNote:
    "この戦いで全てが破壊されました。一部の地上砲は戦闘後に再構築される場合があります。",
  theirBoardEmptyAtStart: "開始時にここに防御ユニットはいませんでした",
  theirBoardEmptyAtStartNote:
    "目標には戦闘艦も地上砲もなかったので、ここには破壊されたユニットのリストはありません。",
  theirBoardFloor: "破壊されたユニットのみ",
  theirBoardFloorNote:
    "これは敵の艦隊全体ではありません。この戦闘で破壊されたユニットのみがリストされています。残りのユニットはここでは明らかにされません。見積もりの​​ために新しいプローブを送信します。",
  theirBoardMissingRosterNote: "このレポートには攻撃艦隊の先発名簿がありません。あなたが破壊した船のみがリストされます。生存者は計算できません。",
  theirBoardNothing: "あなたは何も破壊しませんでした",
  /**
   * THE DEFENDER'S VERSION, WHICH IS NOT A BOUND AT ALL. D164.
   *
   * The two above describe a reading with an edge to it — wreckage, and how far it
   * lets you see. This one describes a force the reader stood underneath, so it
   * makes no claim about limits: it names what arrived, and the bar beside each
   * hull says how much of it the defence took down.
   */
  theirBoardArrived: "何がやって来たのか",
  theirBoardArrivedNote:
    "戦闘艦と支援艦を含む艦隊全体があなたに向けて派遣されました。各行には、到着した数、破壊された数、残った数が表示されます。",
  /** The wall, stated apart from the ships, because it is a different kind of thing. */
  groundHeading: "地上防御",
  groundNote: "これらの銃は惑星を守るものですが、飛行することはできません。破壊された各タイプの {{percent}}% は戦闘後に再構築されますが、切り捨てられます。彼らの損失は船舶とは別に処理されます。",
  shipsHeading: "船",
  noGroundHeading: "地上防御なし",
  noGroundNote: "あなたが到着したとき、この世界には壁がありませんでした。",
  calculation: {
    intro:
      "上記の修正されたレシピでは、以下の数値が生成されます。その後、各ラウンドは同じ 3 つのステップに従います。",
    formulaHeading: "攻撃力の作り方",
    formulaBase: "1 ・基本：ユニット数×攻撃力×研究。",
    formulaCounter: "2 ・カウンター：強勝負 ×{{strong}};弱マッチ×{{weak}}。",
    formulaRoll: "3 ・ショット変化：－{{min}}%～+{{max}}%。",
    formulaHp: "ダメージは総 HP に対するターゲットの割合で分割されます。",
    formulaCarry: "ユニットがすべての HP を低下させる必要があります。未完了のダメージは次のラウンドに持ち越されます。",
    formulaSupport: "支援船は、側に少なくとも 1 つの戦闘ユニットが残っている間は保護され続けます。",
    resultHeading: "結果の決定方法",
    resultDecisive:
      "決定的 · 防御ユニットはすべて消滅し、シールドはゼロになります。 · 貨物制限前に露出在庫の {{decisiveLoot}}% を取得できます。",
    /**
     * THE SAME RULE WITHOUT THE HALF THAT CANNOT APPLY. A shield is a structure on
     * a world; a legend that names one out at a rendezvous is describing a
     * condition the reader could never have met or failed.
     */
    resultDecisivePirate:
      "決定的 · 乗組員のすべての船がいなくなりました · 積み荷の {{decisiveLoot}}% を貨物制限前に持ち帰ることができ、ここでのみ船体を曳航して持ち帰ることができます。",
    resultPartial:
      "一部 · 防御ユニット値の少なくとも {{threshold}}% が破壊される · 貨物制限前に露出在庫の {{partialLoot}}% を取得できる。",
    resultRepelled:
      "撃退 · {{threshold}}%未満の防御ユニット値が破壊される · 何も取れない。",
    round: "ラウンド {{round}}",
    fire: "1・同時火災",
    fireNote: "損失がなくなる前に双方が発砲します。このラウンドで破壊されたユニットは引き続き発砲します。",
    yourShot: "あなたのショット",
    theirShot: "彼らのショット",
    shotChange: "ショットチェンジ",
    positivePercent: "+{{amount}}%",
    negativePercent: "−{{amount}}%",
    neutralPercent: "0%",
    aegis: "2 · イージス が攻撃を受ける",
    noAegis: "2 · アクティブな イージス がありません",
    shieldCharge: "シールドチャージ",
    absorbed: "{{amount}} 吸収されました",
    reachedHulls: "船体に到達しました",
    shieldBreaker: "{{amount}} は ヌリファイア のみのシールド ダメージでした",
    noAegisNote: "何もヒットをキャッチできませんでした。すべての {{amount}} の攻撃力が防御側の船体に到達しました。",
    /** The same step, in open space: there is no world here and so no structure. */
    openSpace: "2 · 主砲と車体の間には何もありません",
    openSpaceNote:
      "ランデブーには、ヒットをキャッチするためのワールドや構造がありません。すべての{{amount}}の攻撃力が乗組員に届きました。",
    losses: "3 · 損失により戦闘から離脱",
  },
  /** The three outcomes the whole combat model produces. */
  gradeDecisive: "決定的",
  gradePartial: "部分的",
  gradeRepelled: "はじかれました",
  strategicFirstStrike: "インパクト",
  strategicEmpEffect: "イージス がゼロになり、1 時間再生成できません。その時間の間、地上防御は発砲したりダメージを受けることはできません。",
  strategicLoyalty: "コロニーへの忠誠心",
  strategicLoyaltyChange: "{{before}}% → {{after}}%",
  strategicLoyaltyNext: "{{loss}}% 以下では、次のヒットでコロニーが奪われます。",
  strategicSecededAttacker: "植民地は離脱して中立となり、現在は誰もそれを保持していません。",
  strategicSecededDefender: "あなたの植民地は離脱して中立になりました。",
  strategicSecededShort: "コロニーが離脱しました",
  strategicCaptured: "捕獲されました",
  strategicIneffective: "無効です",
  strategicIntercepted: "傍受されました",
  strategicYouAttacked: "あなたの デス・スター がターゲットにされています",
  strategicAttackedBy: "デス・スター 送信者",
  strategicDestroyedInFlight: "デス・スター 飛行中に破壊されました",
  strategicRadarTrigger: "ターゲット ワールドは、レーダー L3+ 傍受リングを通過した後、交戦しました。",
  strategicTelescopeTrigger: "防御側は、自分たちの世界の 1 つが 望遠鏡 の視界を通じてそれを認識した後、それに交戦しました。",
  strategicTotalDamage: "合計破壊値",
  strategicShieldLost: "シールドが破壊されました",
  strategicResourcesLost: "リソースが破壊されました",
  strategicOrdersLost: "キューに入れられた作業が破棄されました",
  strategicResourceBreakdown: "破壊されたリソース",
  strategicNoFleetLost: "駐留艦隊も地上防衛も破壊されませんでした。",
  strategicLevelLosses: "レベルが失われました",
  strategicNoLevelLoss: "建物や計器のレベルは失われました。",
  strategicDestroyedOrders: "建設物が破壊されました",
  strategicNoOrdersLost: "アクティブな建設オーダーは破棄されませんでした。",

  /** A world nobody holds. There is no commander to name. */
  neutralHolder: "要求のない世界",

  /**
   * WHAT THE STAMP AT THE TOP OF THE REPORT ACTUALLY MEANS.
   *
   * The grade sets the loot share and how long the works stay down, so it is the
   * most consequential word on the surface — and nothing in the game had ever said
   * what separates the three.
   *
   * IT IS SAID WITHOUT JARGON AND FROM THE READER'S SIDE, and both halves of that
   * were got wrong first. "More than 42% of the DEFENCE VALUE was destroyed" is a
   * combat model talking to itself: `defenceValue` is an internal quantity, the
   * percentage is a threshold nobody can act on, and the sentence is written from
   * nobody's point of view — so the commander who had just been raided read a
   * neutral description of their own losses. A player should finish this line
   * knowing what happened to THEM and why the haul was the size it was.
   */
  why: {
    attacking: {
      DECISIVE: "あなたはそれを守るすべてのものを破壊し、シールドを破壊しました。これが完全な扉を開くものです。",
      DECISIVE_WIPED: "あなたはすべての防御ユニットを破壊しましたが、戦利品を持ち帰るために生き残った船はありませんでした。",
      DECISIVE_WITHOUT_SHIELD: "あなたはそれを守るすべてのものを破壊しました、そしてそれがすべての始まりです。",
      WALKOVER: "ここには防御ユニットはいませんでした。利用可能な戦利品はあなたの艦隊に公開されました。",
      PARTIAL: "部分的に成功するには十分なダメージを与えましたが、完全には成功しませんでした。戦利品の一部のみが入手可能になりました。貨物スペースがなければ何も持ち込めません。",
      PARTIAL_WIPED: "あなたは部分的に成功するのに十分なダメージを与えましたが、戦利品を持ち帰ることができるほど生き残った船はありませんでした。",
      REPELLED: "破壊されたユニットのリソース値が、すべての防御ユニットの開始値の {{threshold}}% に達しませんでした。それが襲撃が撃退された理由である。船の数やシールドの破壊だけが結果を決めるわけではありません。",
    },
    defending: {
      DECISIVE: "防御側ユニットがすべて倒れ、シールドが壊れ、利用可能な戦利品がレイダーに開放されました。回収される量は、残っている貨物スペースに応じて異なります。",
      DECISIVE_WITHOUT_SHIELD: "防御ユニットがすべて倒れ、利用可能な戦利品がレイダーに開放されました。回収される量は、残っている貨物スペースに応じて異なります。",
      DECISIVE_WIPED: "防御側ユニットはすべて倒れ、彼らが同行していた船もすべて倒れました。戦利品は開いており、家に持ち帰るための生きたものは何も残されていませんでした。",
      WALKOVER: "あなたの世界には防御ユニットが存在しなかったため、利用可能な戦利品がレイダーに公開されました。",
      PARTIAL: "攻撃者は部分的に成功するには十分なダメージを与えましたが、完全には成功しませんでした。戦利品の一部のみが入手可能になりました。",
      PARTIAL_WIPED: "攻撃者は部分的に成功するのに十分なダメージを与えましたが、攻撃を運ぶ船は一隻も生き残れませんでした。あなたの世界からは何も残らなかった。",
      REPELLED: "防御は維持されました。彼らは何も乗り越えず、何も得られませんでした。",
    },
  },

  /** Everything a battle did beyond the loot line, each said only when true. */
  effects: {
    heading: "何をしたか",
    shieldTheirs: "船体が被弾する前に、相手のシールドが{{amount}}ダメージを吸収しました。",
    shieldYours: "船体が被弾する前に、あなたのシールドが{{amount}}ダメージを吸収しました。",
    cargoLimited:
      "船倉が満杯になりました。あの惑星には運びきれない資源が残っています。クーリエ、ウェイフェアラー、アトラス、アルゴシーを増やしてください。",
    salvaged_one: "地上砲{{count}}基が戦闘後に残骸から再建されました。",
    salvaged_other: "地上砲{{count}}基が戦闘後に残骸から再建されました。",
    worksTheirs: "敵の生産施設は{{duration}}停止します。その間は資源を生産しません。",
    worksYours: "あなたの生産施設は{{duration}}停止しました。",
    /** The defender's copy of what the raider's collectors lifted. D200. */
    salvageTheirs: "敵のガベージコレクターが残骸から{{amount}}を回収しました。",
    /** Koloni arızaları: what a heavy defeat broke. Defender only. */
    /** Taktik geri çekilme. Defender: what ran and what the lift burned, or why it could not. */
    escaped_one: "あなたの艦船は戦闘前に退避しました（重水素−{{fuel}}）。襲撃側の火力があなたの戦列の3倍以上でした。",
    escaped_other: "あなたの艦船{{count}}隻は戦闘前に退避しました（重水素−{{fuel}}）。襲撃側の火力があなたの戦列の3倍以上でした。",
    stranded: "艦船は退避できる状況でしたが、燃料が足りませんでした。重水素が{{fuel}}必要で、保有量は{{available}}でした。",
    /** Raider: the line emptied in front of the raid, and nothing about what it held. */
    fled: "敵艦は戦闘前に退避しました。火力差が3倍以上で全滅する戦列は、惑星に往復分の燃料があれば退避します。",
    colonyFaults: "この敗北により{{planet}}で発生した故障：{{faults}}。",
    /**
     * Recovery shield, defender only: the NET loss of the lookback at this battle, in
     * hours of the reader's own production, against the bar. Owner instruction, 2026-09-18.
     */
    recoveryProgress:
      "回復シールド：直近{{window}}時間の正味損失は、生産量{{bar}}時間分の基準に対して{{hours}}時間分です。{{bar}}に達すると{{shield}}時間襲撃されなくなります。自分の襲撃で得た資源は損失から差し引かれます。",
    recoveryEarned:
      "この敗北で{{shield}}時間の回復シールドを得ました。直近{{window}}時間の正味損失は生産量{{hours}}時間分です。",
    recoveryRefused:
      "直近{{window}}時間の正味損失は生産量{{hours}}時間分で、{{bar}}時間分の基準を超えました。ただし自分の襲撃艦隊が飛行中はシールドを得られません。",
    wreck: "{{planet}}の上空に資源{{amount}}相当の残骸があります。誰でも回収できます。",
    /** The same field, read from the world it is drifting over. */
    wreckYours: "残骸中の {{amount}} があなたの軌道を漂っています。あなたも含めて、誰でもそれを受け取ることができます。",
    /** No orbit to name: the field sits at the rendezvous, in open space. */
    wreckVoid:
      "残骸に包まれた{{amount}}が、広場のランデブーで漂流しています。 プロスペクター を送信します。そして、それを目撃した他の人も同様に送信できます。",
  },

  /** The caller's own board: what went in, what died, what was standing after. */
  force: {
    /** Screen-reader only: the bar is the picture, this is what it says. */
    reading: "投入{{sent}}、喪失{{lost}}、残存{{left}}",
    hull: "船体",
    /** The attacker chose to send it; the defender simply had it there. */
    sent: "投入",
    held: "保有",
    lost: "喪失",
    left: "残存",
    rebuilt: "再建",
    start: "開始時",
    arrived: "到着しました",
    rebuiltNote: "{{count}} 破壊された地上砲は戦闘後に再建されました。残りのカウントに含まれます。",
    groundType: "地上砲・飛行不可",
    supportType: "支援船・発砲できません",
    combatType: "戦闘艦",
    summary: "投入{{brought}} · 喪失{{lost}} · 残存{{left}}",
  },
  /** Whose casualties. Both sides fly Darts, so colour alone cannot say it. */
  roundTheirs: "彼ら",
  roundYours: "あなた",
  roundNoLosses: "このラウンドではどちらの側もユニットを失いませんでした。",
  roundStanding: {
    unknownOwn: "このレポートには開始カウントがありません。残りの単位は計算できません。",
    heading: "ラウンド終了後はあなたの側 {{round}}",
    enemyHeading: "{{round}} ラウンド後の攻撃艦隊",
    summary: "発砲可能な {{combat}} ユニット・{{support}} 非武装支援船",
    supportExposed: "支援船は発砲できません。彼らを守る戦闘ユニットは残っていない。",
    noneLeft: "戦闘を継続できるユニットが残っていません。",
    unknownEnemy: "敵の残り数を非表示にします。上記の敵の損害は艦隊全体ではありません。",
  },
} as const;

/** One telescope reading, rendered as certainty. */
export const clarity = {
  barsLabel: "クラリティ {{state}}",
  stateFull: "フル",
  stateClear: "クリア",
  stateIntermittent: "断続的",
  stateDegraded: "が劣化しました",
  stateBlind: "ブラインド",
  unreadable: "読み取れません",
  fleetHome: "艦隊ホーム",
  fleetAway: "艦隊・アウェイ",
  backIn: "· {{minutes}}mに戻る",
  unwatched: "監視が割り当てられていません",
} as const;

/** What you know about another world, and how you know it. */
export const dossier = {
  /* The E2 target dossier (docs/ui-v2/gozlemevi.md), in the mock's words. */
  page: {
    peekWing: "あなたの翼 {{value}}",
    peekDefence: "防御 {{band}}",
    peekDefenceUnknown: "防御力不明",
    rival: "ライバル {{n}}",
    range: "範囲 {{d}}",
    flight: "{{time}} フライト",
    unreachable: "圏外です",
    known: "既知 {{have}}/{{total}}",
    lookNone: "内部を調べたプローブはありません",
    lookProbe: "プローブレポート",
    shape: "構成の読み取り",
    shareUnread: "未読",
    lootRow: "{{label}}：{{band}} · あなたの船倉{{cargo}}",
    others: "その他の読み取り値",
    wing: "あなたの翼を自宅に",
    power: "パワー",
    loot: "戦利品",
    lootTag: "見積もり",
    lootMeaning: "調査員が読んだところによると、決定的な勝利がもたらす可能性は何でしょうか。貯蔵庫のシェアはすでに下落しています。",
    lootPartial: "部分勝利",
    lootHold: "あなたの船倉{{cargo}}",
    lootShort: "船倉には{{cargo}}まで積めます。それ以上の戦利品は持ち帰れません。",
    colony: "コロニー",
    colonyRule: "決定的な勝利には忠誠心の {{decisive}} がかかりますが、部分的な勝利には {{partial}} がかかります。ゼロになると、植民地は建物と株とともに中立に離脱し、最初に着陸した人が優先します。",
  },
  sourcePublic: "パブリック",
  sourceTelescope: "望遠鏡",
  sourceProbe: "プローブ",
  sourceBattle: "バトルレポート",

  confidencePrecise: "精密",
  confidenceGood: "良い",
  confidenceRough: "ラフ",
  confidenceVague: "曖昧",

  ownerLabel: "保有者",
  ownerNote: "所有者はシーズン中、誰でも無料で確認できます。",
  ownerRecordNote: "探査機が確認した所有者です。その後変わっている可能性があります。",

  developmentLabel: "開発",
  developmentValue: "ティア{{tier}}",
  developmentVersus: "ティア{{tier}} · あなた{{mine}}",
  developmentBandNote:
    "襲撃とデス・スター攻撃が可能なのは、ティア差が1以内の司令官だけです。双方が持つ最も発展した惑星で判定します。あなたはティア{{mine}}なので、ティア{{low}}～{{high}}が対象です。この惑星が相手の最高ティアとは限りません。",

  hardwareLabel: "軌道上の衛星",
  hardwareNote: "衛星の存在は見えます。性能を知るには探査機が必要です。",
  hardwareRecordNote: "探査機の通過時に軌道上にあった衛星です。その後増えている可能性があります。",

  fleetLabel: "相手の艦隊",
  fleetUnreadable: "確認できません",
  fleetAway: "出航中",
  fleetHome: "惑星に駐留中",
  fleetVeiledNote: "相手のヴェールがこちらの望遠鏡を上回っています。望遠鏡を強化するか、探査機を送ってください。",
  fleetAwayUnknownNote: "いつ帰還するかは分かりません。その不確実さを踏まえて判断してください。",
  fleetAwayNote: "相手の惑星を守れるのは、残していった戦力だけです。",
  fleetHomeNote: "望遠鏡による観測は相手に通知されません。",

  fleetGapNoTelescope: "望遠鏡がありません",
  fleetGapOutOfRange: "望遠鏡の範囲外です",
  fleetGapNoSlot: "この惑星に観測枠を割り当てていません",
  fleetGapWhy:
    "ゲーム内で最も貴重な事実は、離れた艦隊は惑星を守ることができないということです。",
  fleetGapRange: "望遠鏡の到達範囲は{{reach}}、この惑星までの距離は{{distance}}",
  fleetGapSlots: "{{count}}枠すべて使用中です。1枠を移動してください",

  /**
   * THE LABEL FOLLOWS THE NUMBER. The probe reports what a raid could TAKE now —
   * `raidableStock` — rather than the whole store, so "Resources held" would be
   * naming a different quantity than the one printed under it.
   */
  stockLabel: "現在奪える資源",
  stockNote: "襲撃で奪える最大量です。貯蔵庫の保護分は含まれず、艦隊の船倉容量によってさらに少なくなる場合があります。",
  stockCaught: "相手のレーダーが探査機を捉えました。誰かに調べられたことが知られています。",
  stockClean: "探査機は気付かれずに帰還しました。",
  /** The one force unit, D199 — what the hulls and guns that can fire cost. */
  defenceLabel: "武装ユニット値",
  defenceNote: "探査機の通過時に射撃可能だった艦船と地上砲の資源コストです。攻撃ダメージではなく、シールドと非武装艦船は含みません。",
  defenceRatio: "{{world}}の防衛戦力の約{{ratio}}倍です。",
  shapeLabel: "防衛戦力の構成",
  shapeNote: "射撃可能な戦力の資源価値で示します。50%を超える種類が過半数です。",
  shapeUnread: "未読",
  shapeUnreadNote: "彼らの ヴェール は、プローブを送信した 造船所 よりも強力です。",
  shieldLabel: "シールドチャージ",
  shieldNote: "船体が攻撃する前に襲撃の砲撃を受け、数時間かけて砲撃を補充します。",
  unarmedLabel: "列内では非武装",
  unarmedNote: "彼らは何も発砲しませんが、クリーンスイープですべてを沈める必要があります。",
  shipsLabel: "船舶数をカウントしました",
  shipsAllHome: "彼らの所有物はすべて家にありました。",
  shipsSomeOut: "彼らの船の一部が出航していました。",

  /**
   * THE FOUR READINGS THE PROBE ALWAYS TOOK AND NOTHING EVER PRINTED.
   *
   * Each one names WHEN it was true rather than asserting it now, because all
   * four are frozen at the look. The dossier prints the age beside them.
   */
  /**
   * THE FUEL SHARE OF THE BAND ABOVE, NOT THE TANK. D166.
   *
   * It used to read the whole store while sitting directly under "Raidable now",
   * so the one deuterium figure on the screen measured a different quantity from
   * every other number beside it. Both come off `computeLoot` now, and the label
   * says which question this answers.
   */
  deuteriumLabel: "襲撃可能な重水素",
  deuteriumNote: "上記のバンドの燃料シェア — 決定的な襲撃が実行できるもの。",
  strategicLabel: "戦略兵器",
  strategicReady: "発射可能",
  strategicBuilding: "建造中",
  strategicUnknown: "発射台に何かあります",
  strategicNote: "探査機が通過した時点で発射台にありました。その後に発射された可能性があります。",
  strategicUnknownNote: "探査機の情報だけでは建造の進み具合は分かりません。",
  interceptorLabel: "戦略兵器防衛",
  interceptorCount_one: "迎撃弾{{count}}発を装填済み",
  interceptorCount_other: "迎撃弾{{count}}発を装填済み",
  interceptorCountNote: "迎撃弾1発でデス・スター1基を破壊します。{{needed}}基が同時に到着すれば1基は突破できます。偵察後に迎撃弾が増えた可能性もあります。",
  interceptorEmpty: "迎撃弾なし",
  interceptorEmptyNote: "現時点で戦略兵器を迎撃する弾は確認されていません。偵察後に装填された可能性はあります。",
  loyaltyLabel: "植民地の忠誠度",
  loyaltyValue: "{{value}}%",
  loyaltyNote_one: "デス・スター1基の命中で忠誠度が{{loss}}下がります。忠誠度が{{loss}}以下なら植民地は離脱します。ここは1回の命中で離脱します。",
  loyaltyNote_other: "デス・スター1基の命中で忠誠度が{{loss}}下がります。忠誠度が{{loss}}以下なら植民地は離脱します。ここは{{count}}回の命中が必要です。故障がなければ忠誠度は回復します。",
  doctrinesLabel: "戦闘ドクトリン",
  doctrinesNone: "戦闘研究なし",
  doctrinesNote: "敵艦は基本値より強化されています。攻撃時にはこの倍率が適用されます。",
  doctrinesNoneNote: "探査機による観測時、敵は艦船の戦闘研究を持っていませんでした。",

  surfaceGapLabel: "この惑星の基本情報",
  surfaceGapMissing: "この惑星はまだ観測していません",
  surfaceGapWhy:
    "所有者、成長の度合い、軌道上の設備はまだ分かりません。探査機を送ると一度に確認できます。",

  probeGapLabel: "資源と防衛戦力",
  probeGapMissing: "この惑星の詳細は未調査です",
  probeGapAged: "この惑星の観測情報は古くなっています",
  probeGapWhy:
    "見えていない戦力に艦隊を賭けることになります。探査機を送れば推測を幅のある観測値に変えられます。",

  compositionLabel: "確認済みの戦力",
  compositionValue: "少なくとも{{fleet}}",
  compositionNote: "前回の戦闘で破壊した分です。敵はすでに再建しているかもしれません。",
  compositionGapLabel: "艦隊の正確な内訳",
  compositionGapMissing: "この相手とはまだ戦っていません",
  compositionGapWhy: "正確な艦隊構成を知るには、戦闘報告書が必要です。",
} as const;
