/** Gözlemevi v2 kit — the words the new components carry (docs/ui-v2/gozlemevi.md). */

/** B9: press and hold to commit. */
export const hold = {
  /** Read by a screen reader: the two ways to use the button. */
  hint: "長押しするか、Enter を 2 回押して確定します",
  /** The inline second step after one Enter. */
  confirm: "{{label}} · 実行しますか？",
  /** Shown on the face after a release that came too soon. */
  release: "長押しで確定してください",
  /** Before the label on the face, as the mock's "Basılı tut · 74 gemiyi gönder"; the hint already tells a reader. */
  verb: "長押し",
};

/** B12: a build lane drawn as rings. */
export const lane = {
  /** A slot in the lane with nothing in it. */
  free: "+ 空き枠",
};

/** B1: a resource meter on the top bar. */
export const meter = {
  /** Read by a screen reader: the stock against the store. */
  reading: "{{resource}}: {{value}}/{{cap}}",
  /** The same, when the store is full. */
  full: "{{resource}}：{{value}}/{{cap}}、貯蔵庫が満杯",
  /** A price against what you hold (the need bar). */
  need: "{{resource}}：{{have}}/{{need}}（不足{{short}}）",
  short: "不足{{amount}}",
};

/** B5: the force ruler. */
export const ruler = {
  /** In place of the defence strip when nothing was ever measured. */
  unknown: "探査機による測定なし：相手の防御力は不明",
  /** The button that closes that gap. */
  probe: "探査機を送る",
};

/** The v2 sheet: its grab handle. */
export const handle = {
  /** Opens the sheet one height further. */
  expand: "拡大する",
  /** At the top: settles it one height lower. */
  collapse: "縮小",
};

/** B4: the dock, five tabs in one order. */
export const dock = {
  /** The navigation landmark, for a screen reader. */
  label: "メインナビゲーション",
  galaxy: "銀河",
  base: "基地",
  fleet: "艦隊",
  intel: "情報",
  clan: "クラン",
  /** The dot on Base, read aloud. */
  baseWaiting: "修理待ちの艦船があります",
  /** Beside the Fleet ring: your own craft in the air. */
  airborne: "航行中：{{count}}",
  /** The count on Intel: reports you have not seen. */
  reports: "新しい報告書：{{count}}件",
  /** The count on Clan. */
  attention: "確認待ち：{{count}}件",
};

/** B2: the Now line, the one timer that matters most. */
export const now = {
  /** The line, for a screen reader. */
  label: "次に起きること",
  /** The sheet one tap under it: every timer. */
  sheet: "タイマー",
  work: "作業完了",
  research: "研究完了",
  /** An order behind the head of its lane: no clock yet (2026-10-06). */
  queued: "前の作業が終わると開始",
  event: "イベント終了",
  shield: "シールド終了",
  shieldDetail: "終了後は襲撃を受ける可能性があります",
  /** The clock time beside a countdown in the sheet. */
  at: "{{time}}に",
};

/** K1: the bell sheet, three tabs. */
export const bell = {
  /** The sheet's name: all three tabs answer it. */
  title: "何が起きた？",
  /** The tab list, for a screen reader. */
  label: "シグナル、記録、チャット",
  signals: "シグナル",
  chronicle: "クロニクル",
  chat: "チャット",
  /** The dot on Chat, read aloud. */
  chatUnread: "{{count}} 未読",
};

/** B1: the top bar. */
export const topBar = {
  /** The shield's time on the commander chip: whole hours, rounded down. */
  hours: "{{h}}h",
};

/** The View chip and sheet: layers, the events guide and the galaxy caption. */
export const view = {
  chip: "ビュー",
  title: "ビュー",
  layers: "レイヤー",
  telescope: "望遠鏡の範囲",
  telescopeDetail: "保有する惑星から艦隊の状態を確認できる範囲",
  radar: "レーダーの範囲",
  radarDetail: "接近する艦隊をレーダーが警告する範囲",
  events: "銀河イベントの案内",
  /** The round button under the View chip: the disc's old Home mark. */
  home: "自分の惑星へ移動",
};

/** B3: the context slot, one card at a time. */
export const slot = {
  incoming: "攻撃が接近中",
  prepare: "防衛を準備",
  look: "詳細を見る",
  event: "銀河イベント",
  show: "確認する",
  lands: "到着まで{{time}}",
  ends: "終了まで{{time}}",
  pill: "接近中の攻撃：{{count}}件",
  dismiss: "閉じる",
};

/** E4: the Fleet page — in flight, at home, the Hangar. */
export const fleetPage = {
  views: "艦隊一覧",
  air: "飛行中",
  home: "駐留中",
  bays: "発進枠",
  hangar: "格納庫",
  pace: "{{pct}}% 速度",
  recall: "呼び戻す",
  recallHome: "呼び戻すと{{time}}後に帰還",
  recalling: "帰還へ転針中…",
  emptyAir: "飛行中の艦隊はありません。銀河にある惑星、小惑星、海賊をタップして艦船を派遣できます。",
  focusWorld: "{{world}}を銀河で表示",
  shipsHome_one: "{{count}}隻が駐留中",
  shipsHome_other: "{{count}}隻が駐留中",
  away: "{{count}}隻が出航中",
  noShips: "駐留する艦船はありません",
  capital: "首都",
  colony: "植民地",
  roomRule: "格納庫の枠は、この惑星の船が帰還中や建造中でも使います。満杯になると新しい船の建造と受け入れはできません。呼び戻した艦隊は必ず戻れます。",
  ground: "地上防衛",
  ceiling: "この司令中枢での上限は{{shown}}",
  full: "満杯",
};

/** The battle report scene (B15), the mock's "KISMİ ZAFER" page. */
export const reportScene = {
  damageTitle: "艦船に損傷あり",
  damageLot: "{{name}}×{{count}}・損傷{{pct}}%",
  toDock: "修理ステーションへ",
  patched: "無料で修理済み",
  landing: "帰還時に判定します。損傷が20%を超える艦船は修理待ちになり、それ以下は無料で修理されます。",
  eyebrow: "バトルレポート・{{planet}}",
  rounds_one: "{{count}}ラウンド",
  rounds_other: "{{count}}ラウンド",
  you: "あなた",
  destroyed: "{{count}}を破壊",
  hidden: "敵に残る戦力と戦場の全体像は不明です。報告書には、あなたが撃破したものだけが載ります。",
  whyDecisive: "損失の理由",
  whyPartial: "なぜ部分的な勝利？",
  whyRepelled: "なぜ撃退された？",
  why: "損失の大半は{{lost}}でした。{{by}}はそれに強く、{{bring}}は{{by}}に強い艦種です。",
  balance: "収支",
  balanceLoot: "戦利品{{amount}}",
  balanceFuel: "燃料 −{{amount}}",
  balanceLost: "損失：{{list}}",
  balanceNone: "損失なし",
  cargoFull: "船倉が満杯",
  intel: "{{planet}}の防衛情報は{{time}}時点の記録です",
  loyalty: "植民地の忠誠度−{{amount}}",
  watch: "再生",
  share: "クランへ",
  shareLine: "{{planet}}で{{word}}・戦利品{{loot}}・損失{{lost}}",
  again: "もう一度攻撃",
} as const;

/** K6: the switch at the top of the Base — this world, or the commander's research. */
export const baseSwitch = {
  label: "ベース",
  world: "この惑星",
  research: "研究",
} as const;

/** E8 · K9: the research constellation. */
export const researchMap = {
  label: "研究マップ",
  /** The strategic three while their release switch is off: the server refuses them. */
  /** A prerequisite already held, said on the card. */
  needs: "{{name}}が必要です",
  /** The next rung of a ladder that opens a hull, and the one rung of a permission. */
  opensAt: "レベル{{level}}で開放",
  opens: "開放",
} as const;

/** D1/D2: a world's room, part by part, in your own colour. */
export const roomBar = {
  hangar: "格納庫の空き",
  ground: "地上設備の空き",
  home: "駐留{{value}}",
  away: "出航中{{value}}",
  queued: "建造待ち{{value}}",
  incoming: "今回の注文{{value}}",
  free: "空き{{value}}",
  reading: "{{label}}：{{total}}枠中{{used}}枠を使用",
  returnFits: "飛行中の船も格納枠を使い続けるため、帰還する艦隊は必ず収まります。",
  nextHangar: "格納庫をレベル{{level}}にすると{{from}}→{{to}}枠になります。",
  gunsStay: "地上砲は惑星間を移動できません。",
  nextCore: "司令中枢をレベル{{level}}にすると{{from}}→{{to}}枠になります。",
};

/** E10: while you were away — the return story, worded from its kinds (S3). */
export const away = {
  eyebrow: "不在時間{{duration}}",
  title: "あなたがいない間に",
  all: "すべて（{{count}}件）",
  done: "銀河に戻る",
  taken: "戦利品{{loot}}・損失{{lost}}ユニット",
  held: "防衛戦で{{lost}}ユニットを失いました",
  looted: "戦利品+{{loot}}・艦船{{lost}}隻を損失",
  scan_one: "探査機に発見されました",
  scan_other: "{{count}}回の探査で発見されました",
  scanDetail: "誰かがあなたの情報を集めています。",
  convoySecured: "輸送船団の報酬を確保しました",
  convoyDelivered: "輸送船団の報酬が届きました",
  convoyDetail_one: "資源+{{resources}}・報酬の艦船{{count}}隻",
  convoyDetail_other: "資源+{{resources}}・報酬の艦船{{count}}隻",
  accrued: "+{{alloy}}合金・+{{crystal}}クリスタル",
  accruedDetail: "不在中に生産されました",
  door: {
    report: "報告書を見る",
    intel: "レーダーを見る",
    base: "基地へ移動",
    orbit: "設置する",
    signals: "通知を見る",
    dossier: "惑星の情報を見る",
    repair: "修理",
  },
  sighting: "{{planet}}の艦隊が出航しました",
  sightingBack: "{{time}}ごろ帰還・望遠鏡で確認",
  sightingSeen: "望遠鏡で確認",
  careLoyalty: "{{world}}の忠誠度{{loyalty}}%",
  careFaults_one: "故障が{{count}}件続いています",
  careFaults_other: "故障が{{count}}件続いています",
};

/** E11: the desk outline — worlds, what is in the air, the work queues. */
export const outline = {
  label: "概要",
  worlds: "惑星",
  air: "飛行中",
  airEmpty: "飛行中の艦隊はありません。惑星のカードから出航できます。",
  queues: "作業待ち",
  research: "研究",
  idle_one: "待機中・空き{{count}}枠",
  idle_other: "待機中・空き{{count}}枠",
  filled: "{{count}}/{{total}}",
  threat_one: "攻撃が{{count}}件接近中",
  threat_other: "攻撃が{{count}}件接近中",
};

/** The Repair Station (Kalıcı gemi hasarı, `plan.md` F4/F6). */
export const repairStation = {
  order: "{{name}}の修理",
  all: "複数の艦種",
  title: "修理ステーション",
  role: "損傷した船は修理されるまでここで待機します。",
  tagline: "損傷した艦船を戦列に戻します。",
  idle: "この惑星に損傷した艦船はありません。",
  waitingShips_one: "{{count}}隻が修理待ち",
  waitingShips_other: "{{count}}隻が修理待ち",
  repairingShips_one: "{{count}}隻を修理中",
  repairingShips_other: "{{count}}隻を修理中",
  queueFill: "修理キュー{{used}}/{{total}}",
  statWaiting: "待機中",
  statRepairing: "修理中",
  statQueue: "キュー",
  outOfAction: "損傷が20%を超える艦船はここで待機し、修理が終わるまで飛行も防衛もできません。",
  howItWorks: "仕組み",
  ruleFree: "戦闘や放射線による損傷が20%以下なら、無料で修理されます。",
  rulePrice: "修理費用は新造時の価格に損傷率を掛けた額です。損傷40%なら新造価格の40%です。",
  ruleTime: "修理時間は建造時間に損傷率を掛けた長さです。{{shipyard}}のレベルと{{automation}}で短縮できます。",
  ruleIndustrial: "{{industrial}}の研究で修理費用と時間が元の75%、次に50%になります。",
  youPay: "今回支払うのは新造価格の{{pct}}%です。",
  ruleQueue: "修理は造船所とは別のキューで、最大{{depth}}件を順番に進めます。",
  ruleCancel: "キャンセルすると費用の半分が戻り、艦船は再び修理待ちになります。",
  industrialChip: "{{industrial}} −{{off}}%",
  damagedHeading: "損傷した艦船",
  selectAll: "すべて選択",
  selectNone: "クリア",
  choose: "{{name}}×{{count}}を修理",
  noneWaiting: "修理待ちの艦船はありません。",
  damaged: "損傷{{pct}}%",
  share: "新造価格の{{pct}}%",
  queueHeading: "修理キュー",
  queueEmpty: "修理中のものはありません。",
  finishing: "処理を完了しています…",
  startsIn: "開始まで{{time}}",
  ends: "完了まで{{time}}",
  selected_one: "{{count}}隻を選択中",
  selected_other: "{{count}}隻を選択中",
  afterQueue: "キューの後で開始・あと{{time}}",
  repairSelected_one: "{{count}}隻を修理",
  repairSelected_other: "{{count}}隻を修理",
  pick: "修理する艦船を選んでください",
  queueFullShort: "キューが満杯・{{used}}/{{total}}",
  tooMany: "最大{{max}}行を選ぶか、すべて選んでください",
  starting: "開始中…",
  cancel: "キャンセル",
  docked_one: "{{count}}隻を修理中",
  docked_other: "{{count}}隻を修理中",
  started: "修理を開始しました",
  queue: "修理ステーション",
};
