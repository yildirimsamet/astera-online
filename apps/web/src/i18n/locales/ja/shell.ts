/**
 * THE CHROME THAT NEVER LEAVES — the header, the in-flight strip, Signals, and
 * the furniture every surface is built out of.
 */

export const statusBar = {
  activeWorld: "現在の惑星",
  capitalWorld: "首都 · {{name}}",
  colonyWorld: "コロニー・{{name}}",
  alloyLabel: "合金",
  crystalLabel: "クリスタル",
  deuteriumLabel: "重水素",
  /** The store's ceiling, stated as space. */
  storeFull: "フル",
  storeFree: "空き{{amount}}",
  /**
   * THE MENU CONTROL. Owner decision: the header's right-hand end had grown to
   * three controls plus a beacon and had run out of room for a fourth.
   *
   * It says what is behind it rather than saying "menu", because D54's bug was a
   * control labelled as something other than what it opened.
   */
  /*
    IT NAMES WHAT IS ACTUALLY BEHIND IT, and it used to promise Intel — which
    moved onto the disc with research and the clan. A control whose name lists a
    surface it cannot reach is D54's bug wearing an accessible name instead of a
    face, and this string is what a screen reader and the screenshot harness read.
    The four groups the sheet is built from, in the order it draws them.
  */
  menuHint: "司令官 {{name}} — リーダーボード、報酬、お知らせ、ヘルプ、アカウント",
  menuWaiting: "受取可能な報酬{{count}}件",
  clanWaiting: "クランの新着{{count}}件",
  newcomerShield: {
    hint: "あと{{duration}}は襲撃されません",
  },
  recoveryShield: {
    hint: "回復シールド · あと{{duration}}は襲撃されません",
  },
  recoveryBoost: {
    mark: "生産量+50%",
    note: "シールド時出力 +50%",
  },
  bays: {
    hint: "{{used}}/{{total}} フライトベイが使用中",
    label: "ベイ",
    free: "空き{{count}}",
  },
  works: {
    label: "生産施設",
    labelFull: "生産施設が満杯",
    collect: "回収",
    firstTip: "生産した資源は生産プールに貯まります。使う前に貯蔵庫へ回収してください。",
    fullStopped: "満杯 · 生産停止",
    fillsIn: "満杯まで{{time}}",
    gathers: "回収するまで生産した資源がここに貯まります",
    idle: "—",
    hintFull: "生産施設が満杯です。今すぐ回収してください",
    hintCollect: "{{amount}}を回収",
    /** Each waiting resource by name, in the bubble's accessible name (owner, 2026-09-24). */
    alloy: "{{amount}}合金",
    crystal: "{{amount}} クリスタル",
    deuterium: "{{amount}} 重水素",
    collected: "{{amount}}を回収しました",
    collectedPartly: "{{moved}}を貯蔵庫へ回収・{{held}}は生産プールに残っています",
    storeFull: "貯蔵庫が満杯です",
  },
} as const;

export const pendingStrip = {
  empty: "飛行中の艦船はありません",
  openFlights: "飛行中の艦船",
  sheetEyebrow: "飛行中の艦船",
  sheetTitle: "飛行中",
  sheetEmpty: "飛行中の艦船はまだありません。",
  incoming: "接近中の艦隊",
  /**
   * AND WHICH WORLD IT IS COMING FOR. Not a radar product — it is your own world.
   * With four of them, "inbound fleet · 6 min" does not say where to move.
   */
  incomingAt: "接近中 → {{world}}",
  incomingFromAt: "接近中 → {{world}} · {{origin}}発",
  probe: "探査機 → {{target}}",
  deathStar: "デス・スター → {{target}}",
  settlement: "入植隊 → {{target}}",
  transfer: "輸送 → {{target}}",
  pirateOut: "襲撃 → {{target}}",
  pirateHome: "襲撃隊が帰還中 · {{target}}",
  /*
    THE MERCHANT IS NAMED HERE, NOT ON THE SERVER. D156.

    A `trade` thread carries the event-kind identifier `TRADE_SHIP` and no world,
    because there is no world on the far end and the server has never written
    user-facing copy. Without these two lines the strip printed that identifier.
  */
  tradeOut: "交易船団 → 交易船",
  tradeHome: "交易船団が帰還中 · 交易船",
  intergalacticConvoyOut: "攻撃隊 → 銀河間輸送船団",
  intergalacticConvoyHome: "攻撃隊が帰還中 · 銀河間輸送船団",
  fleetHome: "艦隊が{{target}}から帰還中",
  fleetOut: "艦隊 → {{target}}",
  engaging: "交戦中",
  more: "+{{count}}",
  drillOut: "プロスペクター → 小惑星",
  drillHome: "プロスペクターが帰還中",
  salvageOut: "プロスペクター → 残骸",
  drillCount: "{{count}}隻のプロスペクター",
  recallProspectors: "プロスペクターを呼び戻す",
  recallFleet: "艦隊を呼び戻す",
  recallingFleet: "呼び戻し中",
  recallFleetStarted: "艦隊が帰還を開始しました。ここまで飛行した時間と同じだけ帰路にかかります。",
  recallingProspectors: "呼び戻し中…",
  recallStarted: "プロスペクターが帰還を開始しました",
  craftCount: "{{count}}隻",
  craftUnknown: "艦船の内訳を確認できません",
  incomingHint: "接近警報 · 出発地は霧で不明",
  /**
   * THE SAME WARNING, WHEN THE CRAFT IS ON YOUR DISC. D162.
   *
   * The origin is still unsold — that is the top of the radar ladder — but saying
   * "hidden by fog" over a fleet the commander can watch crossing their own circle
   * reads as the interface disagreeing with the picture.
   */
  incomingVisible: "接近警報 · センサーで確認できます。タップして見る",
  /**
   * THE RADAR LADDER, FINALLY WORTH CLIMBING. D123.
   *
   * L3 is the warning. L4 adds the size, which is what turns "something is coming"
   * into a choice between spending the stock, flying the fleet out and standing.
   * L5 names the world it left, and a named world is what a warning has to become
   * before it is a grudge.
   */
  incomingFrom: "{{origin}}から接近中",
  massLight: "小規模艦隊が接近中",
  massMedium: "中規模艦隊が接近中",
  massHeavy: "大規模艦隊が接近中",
} as const;

export const signals = {
  beacon: "シグナル",
  beaconUnread: "シグナル — {{count}} 未読",
  title: "シグナル",
  eyebrowUnread: "{{count}}件の新着",
  eyebrowRead: "通知履歴",
  statusHeading: "現在の状況",
  eventsHeading: "これまでの出来事",
  openEvent: "関連レポートを開く",
  /** The eyebrow on a galaxy-wide row, so it is never mistaken for personal news. */
  worldEvent: "銀河の出来事",
  empty:
    "通知はまだありません。接近する艦隊の警告、検出した偵察機、帰還した艦船をここに表示します。",
  repeat: "×{{count}}",

  /** The states that are true right now, rather than things that happened. */
  status: {
    disruptedLine: "生産施設が停止中",
    disruptedDetail: "襲撃を受けました。{{duration}}後に生産が再開します。",
    worksStoppedLine: "生産が停止中",
    worksStoppedDetail: "生産施設が満杯です。回収するまで、毎時{{amount}}の生産が一時停止します。",
    alloyStoreLine: "合金貯蔵庫は満杯です",
    crystalStoreLine: "クリスタル貯蔵庫は満杯です",
    storeDetail: "{{amount}}の資源が生産プールにあります。保管資源を使うか容量を増やして空きを作ってください。",
  },
} as const;

/** The bottom sheet every decision is made from. */
export const sheet = {
  /*
    A SHEET OPENED FROM THE MENU HAS SOMEWHERE TO GO BACK TO, and that is a
    different word from "close". See `Sheet`'s own note.
  */
  back: "戻る",
  close: "閉じる",
  dismiss: "閉じる",
} as const;

export const toast = {
  dismiss: "メッセージを閉じる",
} as const;

/** Loading, failure and emptiness, wherever a whole surface is in one of them. */
export const surface = {
  unreachable: "{{what}}を読み込めませんでした。",
  retry: "もう一度試してください",
  /** What each caller of `Unreachable` is naming. */
  whatPlanet: "あなたの惑星",
  whatIntel: "偵察情報",
  whatReports: "戦闘レポート",
  whatRewards: "あなたの報酬",
  whatLeaderboard: "ドミニオンランキング",
  whatChat: "銀河チャット",
  whatChronicle: "銀河の記録",
  whatAnnouncements: "お知らせ",
  whatAdminFeedback: "プレイヤーのフィードバック",
  waitingPlanet: "惑星を読み込み中",
  waitingIntel: "偵察情報を読み込み中",
  waitingLeaderboard: "銀河ランキングを読み込み中",
  waitingChat: "銀河チャットを開いています",
  waitingChronicle: "銀河の記録を読み込み中",
  /** The generated crest a world wears. One element, used on two surfaces. */
  planetSigil: "惑星",
} as const;

/**
 * THE MENU — one way in to everything that is not the galaxy.
 *
 * Every string here is its own, including the ones that read like a label
 * somewhere else: the row that opens Intel is not the header button that used to,
 * and the day one of them is reworded the other must not move with it.
 */
export const menu = {
  /* The card the Commander page opens on: who, where, and how you stand (owner, 2026-09-24). */
  profile: {
    label: "あなたの指揮官",
    noClan: "クランがありません",
    seasonDay: "シーズンデー {{day}}",
    rank: "ランク",
    worlds: "ワールド",
    shield: "シールド",
    shieldNone: "なし",
  },
  eyebrow: "司令官",
  /*
    THE GROUP NAMES. Four words doing the work nine identical rows could not: a
    reader should be able to tell WITHOUT reading the rows that the leaderboard
    and the sound slider are different kinds of thing.
  */
  seasonHeading: "今シーズン",
  asteraHeading: "アステラチーム",
  helpHeading: "ヘルプ",
  deviceHeading: "このデバイス",
  marksHeading: "あなたのマーク",
  intelLabel: "情報",
  intelHint: "望遠鏡、探査機、レーダー、戦闘レポート",
  rewardsLabel: "報酬",
  rewardsHint: "達成した目標の資源報酬を受け取る",
  /*
    The hint is this row's accessible name (see `MenuRow`), so it says what the
    page IS. It no longer promises a new tab, because the row no longer opens
    one — a hint that describes the old behaviour is worse than none.
  */
  guideLabel: "Wiki",
  guideHint: "建物、艦船、銀河のルール",
  rewardsWaiting: "受取可能{{count}}件",
  /** T12: research is a commander's, not a world's, so its way in is here. */
  researchLabel: "研究",
  researchHint: "全惑星で共有する研究と必要条件を確認する",
  leaderboardLabel: "リーダーボード",
  leaderboardHint: "ドミニオンによってランク付けされたすべての指揮官",
  announcementsLabel: "お知らせ",
  announcementsHint: "Astera チームからのニュース、更新情報、メモ",
  announcementsWaiting: "新着{{count}}件",
  feedbackLabel: "フィードバック",
  feedbackHint: "不具合、感想、改善案を送る",
  skinsShopLabel: "ショップ",
  skinsShopHint: "惑星の外観と価格を確認する",
  skinsInventoryLabel: "インベントリ",
  skinsInventoryHint: "ワールドにスキンを装備する",
  clanLabel: "クラン",
  clanHint: "クランに加入するか、最大5人のクランを作る",
  clanMemberLabel: "クラン · [{{tag}}]",
  clanMemberHint: "メンバー、援助、共有戦利品、クラン履歴とチャット",
  clanWaiting: "{{count}} 待機中",
  rivalLabel: "ライバル・{{commander}}",
  rivalHint: "{{planet}} に注目して次の手を選択してください",
  rivalLostLabel: "ライバル信号が失われました",
  /** The chip's own face. The sentence above is still its accessible name. */
  rivalLostShort: "ロストマーク",
  rivalLostHint: "あの世界はもうない。マーカーをクリアします。",
  rivalCleared: "失われたライバルマーカーがクリアされました。",
  accountHeading: "アカウント",
  soundLabel: "サウンド",
  soundOn: "スコアが再生中です。",
  soundOff: "このデバイスではサイレントになっています。",
  volumeLabel: "音楽の音量",
  volumeValue: "{{volume}}%",
  /**
   * WHICH OF THE NINE IS SOUNDING. The count is part of the label on purpose: "3"
   * alone is a number, "3 / 9" is a position — it says how far the arrows reach
   * and that there is something on the other side of them.
   */
  trackLabel: "トラック {{index}} / {{total}}",
  trackPrev: "前のトラック",
  trackNext: "次のトラック",
  trackClock: "{{position}} / {{duration}}",
  /**
   * RESOLUTION. Three rungs, one word each — all three share a 350-wide row. The
   * line beneath belongs to the chosen rung: a rung's name does not say what it
   * buys, and the sentence does.
   */
  qualityLabel: "画質",
  quality: {
    high: "高",
    balanced: "バランス型",
    low: "低",
  },
  qualityHint: {
    high: "最も細かい画質です。バッテリー消費が増える場合があります。",
    balanced: "解像度の上限を下げて描画負荷を抑えます。発熱とバッテリーへの効果は端末によって異なります。",
    low: "解像度の上限が最も低い設定です。輪郭の平滑化は有効のままで、細部の鮮明さが下がる場合があります。",
  },
  /** A readout the player turns on. The hint says what the number counts. */
  fpsLabel: "フレームレート",
  fpsOn: "オン",
  fpsOff: "オフ",
  fpsHint: "銀河を1秒間に描画する回数です。値が高いほど動きが滑らかになります。",
} as const;

export const leaderboard = {
  eyebrow: "ローカル銀河",
  title: "リーダーボード",
  empty: "この銀河にはまだ指揮官が参加していません。",
  rank: "ランク {{rank}}",
  score: "ドミニオン",
  you: "あなた",
  nearby: "あなたの最も近いライバル",
  searchLabel: "指揮官、惑星、または氏族を検索",
  searchPlaceholder: "司令官、惑星またはクラン",
  noMatch: "検索に一致する指揮官、惑星、クランがありません。",
  locationUnknown: "この司令官の居場所をまだ発見していません。",
  /*
    THE IN-SEASON PRIZE — the answer to "what am I playing for".
    It sits directly above the standings, because that is where the decision is.
  */
  rewards: {
    title: "シーズン終了賞品",
    left: "残り{{duration}}",
    explain: "最初の {{places}} 位は、次の銀河のリソースを獲得できます。ボットはその地位を保ちますが、賞品は受け取りません。指揮官には少なくとも {{minimum}} ドミニオンが必要です。",
    table: "順位別賞金",
    tableCount: "上位 {{places}} の場所 · 検査可能",
    place: "ランク {{place}}",
    holding: "ランク {{place}} · あなたはこれを勝ち取っています",
    paidWhen: "それは、あなたが新しい季節に自分の世界を見つけた瞬間に着陸します。",
    standing: "ランク {{place}}",
    behind: "{{score}} さらにドミニオンがトップ {{places}} に到達します。",
    minimum: "{{score}} ドミニオンを増やすと賞品を獲得できます。",
    botIneligible: "ボットはランクを維持しますが、シーズン賞を受け取ることはできません。",
    climb: "一番上の {{places}} に到達して取得します。",
    unranked: "この銀河に参加してランキングに参加してください。",
  },
  archive: {
    selectorLabel: "シーズン記録",
    archiveIndex: "シーズン記録",
    waitingArchive: "シーズンレコードをロードしています",
    live: "ライブシーズン",
    seasonChoice: "シーズン {{ordinal}}・{{galaxy}}",
    seasonNumber: "シーズン {{ordinal}}",
    seasonHeading: "シーズン {{ordinal}}・{{galaxy}}",
    /* A rank is not a boast without its field — first of four reads like first of three hundred. */
    percentile: "トップ {{share}}% · {{rank}} の {{commanders}} 司令官",
    fieldSize: "{{count}} 司令官",
    medals: "トロフィー",
    signature: "あなたの署名艦",
    leadWorks: "作品出力",
    leadProduced: "判明した作品の合計",
    leadRuns: "{{count}} 小惑星の走行から",
    signatureCount: "{{count}} を構築しました",
    multiple: "×{{value}}",
    share: "{{value}}%",
    loadingOlder: "古いシーズンを読み込んでいます",
    completedBoard: "シーズンリーダーボードを完了しました",
    waitingBoard: "完成したリーダーボードを開く",
    emptyBoard: "この銀河では指揮官の結果は記録されませんでした。",
    searchLabel: "完了したシーズンを指揮官別に検索",
    searchPlaceholder: "司令官",
    noMatch: "その検索に一致する指揮官はありません。",
    galaxyRecord: {
      title: "ギャラクシーレコード", subtitle: "この銀河のシーズン結果の記録",
      champion: "チャンピオン", clans: "クラン表彰台",
      biggestBattle: "検証された最大の戦い", dominionSwing: "最もシャープなドミニオンの変更",
      contestedWorld: "最も競争の激しい世界",
      battleLine: "{{attacker}} → {{defender}} at {{planet}}・{{value}} ロスト",
      swingLine: "{{attacker}} → {{defender}}・{{amount}} ドミニオン",
      worldLine: "{{planet}} · {{count}} 競合レコード",
    },
    openCommander: "{{commander}} シーズン記録をオープン",
    openSeasonRecord: "オープンシーズン {{ordinal}}・{{galaxy}} レコード",
    commanderCard: "指揮官シーズン記録",
    waitingProfile: "司令官レコードを開く",
    back: "シーズン順位表に戻る",
    profileViews: "司令官 レコード ビュー",
    seasonTab: "シーズン {{ordinal}}",
    overall: "全体",
    cohort_one: "その他 = 今シーズンの {{count}} 司令官全体の平均",
    cohort_other: "その他 = 今シーズンの {{count}} 指揮官全体の平均",
    /** The three-column breakdown truncates; the long sentence is said once above. */
    averageShort: "その他: {{value}}",
    statsUnavailable: "今シーズンの詳細な記録は保存されていません。",
    statsUnavailableHint: "あなたのランクと称号は保持されます。測定されなかったものはゼロとして表示されません。",
    legacyStats: {
      title: "保存されたシーズンレコード",
      hint: "記録された戦闘数値が表示されます。経済性、艦隊生産および探査は測定されていないため省略されています。",
    },
    partialStats: {
      title: "一部の活動記録なし",
      hint: "記録開始前の活動が一部含まれていない場合があります。表示される合計は記録された活動の分です。",
    },
    forcedEnd: {
      title: "シーズンが早期に終了しました",
      hint: "早期終了時点の順位と報酬でシーズンが記録されました。",
    },
    none: "なし",
    ratios: {
      trade: "与えられたダメージ",
      haul: "レイドごとの戦利品",
      kept: "艦隊を保持",
      convoy: "護送船団命中率",
      hourly: "1 時間あたりの出力",
      perRun: "実行あたりの運搬量",
    },
    sections: {
      form: "フォルムと効率性",
      competition: "競技＆バトル",
      economy: "経済性と生産性",
      exploration: "探索と機会",
    },
    metrics: {
      finalRank: "最終順位",
      battles: "戦闘",
      shipsBuilt: "建造された船",
      shipsLost: "船舶紛失",
      shipsBuiltByHull: "建造船の種類別",
      shipsLostByHull: "種類ごとに失われた船舶",
      playerLoot: "指揮官からの戦利品",
      productiveTime: "生産時間、全ワールド",
      produced: "ワークスプロデュース",
      asteroidRuns: "小惑星が走る",
      asteroidMined: "小惑星から抽出",
      convoyAttempts: "護送隊の試み",
      convoySuccesses: "コンボイの成功",
      convoyDelivered: "輸送隊の報酬を受け取りました",
    },
    resources: {
      alloy: "合金",
      crystal: "クリスタル",
      deuterium: "重水素",
    },
    career: {
      completed: "完了したシーズン",
      bestRank: "最高ランク",
      championships: "チャンピオンシップ",
      podiums: "表彰台",
      topTen: "トップ10フィニッシュ",
      noTelemetry: "完了したシーズンには詳細な記録がまだありません。",
      recordedCombatTotals: "記録された戦闘の合計",
      recordedTotals: "記録されたキャリア合計",
      covered_one: "{{count}} シーズンをカバー",
      covered_other: "{{count}} シーズンをカバー",
      coveredWithPartial: "{{count}}シーズンを記録・{{partial}}シーズンは活動記録が不完全",
      seasons: "季節ごとに",
    },
  },
} as const;

export const chat = {
  previousSeasonPlace: "前シーズン · {{rank}}位",
  supporterBadge: "Astera支援者",
  eyebrow: "ライブ チャンネル",
  title: "チャット",
  launcher: "ギャラクシーチャットを開く",
  launcherUnread: "ギャラクシー チャットを開く — {{count}} 未読",
  launcherClanUnread: "オープンチャット — クラン内で {{count}} が未読",
  launcherBothUnread: "オープンチャット — 一般では {{general}} 未読、クランでは {{clan}}",
  channelsLabel: "チャット チャネル",
  languageLabel: "チャット言語",
  general: "一般",
  clan: "クラン",
  dm: {
    title: "DM", loading: "ダイレクトメッセージを開く", conversations: "ダイレクト メッセージでの会話",
    start: "DMを開始", closeTab: "{{name}} タブを閉じる", searchLabel: "指揮官を探せ",
    searchPlaceholder: "司令官の検索", cancel: "キャンセル", contacts: "司令官",
    noContacts: "利用可能な指揮官の一致がありません。", empty: "プライベート会話を開始するには指揮官を選択してください。",
    emptyConversation: "{{name}} に挨拶します。", list: "{{name}} のメッセージ",
    placeholder: "メッセージ {{name}}", waitingHint: "この指揮官はサイレントスペースにいます。彼らがこの銀河に戻ってきたら、また書くことができます。",
    seasonEndedHint: "今シーズンは終了しました。ダイレクトメッセージは次のシーズンに新しくオープンします。",
    blockedHint: "どちらかの司令官がもう一方の司令官をブロックしているため、この会話はメッセージを受信できません。",
    block: "ブロック {{name}}", unblock: "{{name}} のブロックを解除", blockShort: "ブロック", unblockShort: "ブロックを解除",
  },
  channelUnread: "{{channel}} — {{count}} 未読",
  clanLocked: "クランチャットはクルー専用です。",
  clanLockedHint: "クランに参加するかクランを見つけると、このチャンネルがすぐに開きます。",
  list: "ギャラクシーメッセージ",
  empty: "まだ誰も発言していません。銀河系で最初の声を上げましょう。",
  older: "古いメッセージをロードします",
  loadingOlder: "古いメッセージをロードしています",
  placeholder: "銀河にメッセージを",
  send: "送信",
  messageActions: "{{name}} メッセージに対するアクション",
  addReaction: "絵文字リアクションを追加",
  reactions: "の反応",
  reactionCount: "{{emoji}} {{count}} の反応",
  chooseReaction: "絵文字を選択してください",
  reactWith: "{{emoji}} と反応する",
  reply: "返信",
  replyingTo: "{{name}}に返信します",
  cancelReply: "返信をキャンセル",
  remaining: "{{count}} 文字残っています",
  time: {
    justNow: "たった今",
    minutes_one: "{{count}} 分前",
    minutes_other: "{{count}} 分前",
    hours: "{{hours}}h {{minutes}} 分前",
    days_one: "{{count}} 日前",
    days_other: "{{count}} 日前",
  },
} as const;

/**
 * THE SCREEN THAT REPLACES A BLANK ONE.
 *
 * Written for somebody who has just lost what they were looking at, so it says
 * what happened, what it cost them — nothing — and what to do, in that order.
 * "The galaxy is untouched" is a fact, not a comfort: the server is the only
 * authority and this failure never left the phone.
 *
 * The technical detail behind these labels is deliberately NOT translated. It is
 * pasted into a message to the person who will fix it. See `shell/crashReport.ts`.
 */
export const crash = {
  title: "ゲーム画面が停止しました",
  body: "続けるにはページを再読み込みしてください。最後の操作が確認できていない可能性があります。再読み込み後に状況を確認してください。",
  reload: "リロード",
  detailShow: "詳細を表示",
  detailHide: "詳細を隠す",
  /** What the developer needs, in the one gesture a phone can make. */
  copy: "レポートのコピー",
  copied: "コピーしました — 送信してください",
  copyFailed: "コピーできませんでした。代わりに詳細をスクリーンショットしてください。",
} as const;
