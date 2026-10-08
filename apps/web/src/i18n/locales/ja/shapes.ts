/**
 * THE DRAWING VOCABULARY'S OWN WORDS. D142.
 *
 * Every string in this file is a caption on a shape that has already made the
 * point, or a sentence for the screen reader that cannot see the shape at all.
 * Nothing here is load-bearing: a player who reads none of it still knows whether
 * the fuel covers the flight, how sure a probe reading is, and which way a fleet
 * is pointing.
 *
 * It has its own namespace because these components are cross-surface — the spend
 * bar is on two launch sheets, the flight bar is on the strip and in the roster —
 * and a caption that lived on one of those surfaces would move with it.
 */

/** A price taken out of a store: `SpendBar`. */
export const spend = {
  reading: "{{label}}：{{spend}}使用、残り{{left}}",
  readingSpend: "{{label}}: {{spend}}",
  readingShort: "{{label}}：{{short}}不足",
  shortfall: '{{short}}不足',
} as const;

/** A probe's fuzzed reading, drawn as the doubt it is: `RangeBand`. */
export const rangeBand = {
  join: " – ",
  reading: "{{label}}：{{low}}～{{high}}の範囲",
  yours: "あなた：{{value}}",
} as const;

/** Which way a craft is pointing and how far it has got: `FlightBar`. */
export const flightBar = {
  out: "出航中：この惑星から離れています",
  back: "帰還中：この惑星に向かっています",
  incoming: "接近中：位置不明",
} as const;

/**
 * THE COUNTER CYCLE'S OWN WORDS. D124.
 *
 * The multipliers this namespace captions were printed in exactly ONE place in the
 * whole game before it existed — `CombatFormula`, inside a battle report, which is
 * to say after the fleet was already lost. Everything here exists so the same rule
 * is legible at the moment it is being bet on instead.
 *
 * The strings are captions. A player who reads none of them still sees three
 * different shapes and a green or red mark, which is the rule arriving without
 * being read; these are for the screen reader and for confirming what the shape
 * already said.
 */
export const counter = {
  /** The relation, as a heading over a hull's two lines. */
  heading: "マッチアップ",
  strongVs: "{{class}}に強い",
  weakVs: "{{class}}に弱い",
  /** SUPPORT is outside the cycle in both directions and must not fake a rung. */
  supportNote: "非武装。味方の戦闘艦が生き残っている間は守られます。",
  /** The three-word verdict on one pairing. */
  strong: "強い",
  weak: "弱い",
  even: "互角",
  /** No shot at all: a support hull firing is not a weak match, it is no match. */
  none: "攻撃なし",
  multiplier: "×{{mult}}",
  matchupLabel: "{{attacker}}対{{defender}}：{{outcome}}、ダメージ×{{mult}}",
  cycleLabel: "機動型は防壁型に、防壁型は突撃型に、突撃型は機動型に強い",
  /** Above the two bars on the launch sheet — the one name of the one force unit. D199. */
  compareHeading: "武装ユニット値",
  compareYours: "派遣戦力",
  compareTheirs: "現地戦力",
  /** The reading has an age and a width, and both are the fact. */
  compareRecord: "{{source}}, {{age}}",
  compareLive: "{{source}}、現在の情報",
  compareUnknown: "未測定",
  compareUnknownWhy: "探査機を送ると、この値を確認できます。",
  compareLabel: "派遣戦力は{{yours}}。敵の惑星の最新観測値は{{theirs}}です。",
  /**
   * WHAT THE FIGURE AND THE LINES ARE, ONE TAP DEEP. D199.
   *
   * The figure is what the hulls and guns that can fire cost — D183 took the
   * transports out of it. The lines are the battle engine run on this wing against
   * every wall the reading allows, so they include the counter cycle, research and
   * a known shield; what they leave out is said, never implied.
   */
  /** Taktik geri çekilme on the comparison: the verdict line and the rule one tap deeper. */
  escapeRun: "敵の戦力はあなたの火力の3分の1未満です。敵の惑星に往復分の燃料があれば、敵艦は退避し、地上砲だけが戦います。",
  escapeStand: "敵艦は退避せずに戦います。観測値はあなたの火力の3分の1以上か、この部隊で壊滅させられる量を超えています。",
  escapeUnsure: "敵艦は退避するかもしれません。観測値だけでは退避条件をすべて判断できません。",
  escapeAt: "退避判定の戦力線：{{at}}",
  escapeRule:
    "戦術撤退には、防衛側の3倍以上の火力と、防衛部隊を全滅させる規模の攻撃が必要です。惑星には{{distance}}ユニット分の往復燃料も必要です。条件を満たすと艦船は戦闘を避けます。地上砲は残り、資源は略奪される場合があります。",
  escapeMinimumRule: "防衛側の惑星に戦闘艦が{{count}}隻以上必要です。探査機の観測では正確な隻数は分かりません。",
  compareRuleToggle: "これは何ですか？",
  compareMeaning: "攻撃ダメージではなく資源コストです。艦隊が大きいだけでは勝利は保証されません。",
  compareRule:
    "比較には武装艦と地上砲の資源価値を使い、シールドと非武装艦は含めません。予測にはクラス、研究、既知のシールドも反映します。部分成功と完全成功のどちらにも、少なくとも1隻が生き残る必要があります。クラスやシールドが不明だと閾値は範囲になり、左端が最悪、右端が最良の条件です。下の損失予測は想定費用を示します。情報が古い場合があり、射撃のランダムな変動は含みません。",
  linesClears: "防御が最大{{at}}なら完全成功",
  linesBreaks: "最大{{at}}なら少なくとも部分成功",
  lineJoin: " · ",
  lossLabel: "あなたの推定損失：艦隊の{{share}}（資源価値ベース）",
  lossUncertainty: "これは現在の情報に基づく損失の範囲で、勝率ではありません。",
  lossTotalRisk: "高リスク：あなたの艦船が1隻も帰還しない可能性があります。",
  /** What the lines could not see, and what is already known about the reading. D199. */
  noteShieldUnmeasured: "シールドの残量は未測定",
  noteShapeUnread: "防衛戦力の内訳は未確認",
  noteUnarmedUnknown: "輸送艦は戦力に含まれません",
  noteUnarmed_one: "防衛戦列に輸送艦{{band}}隻",
  noteUnarmed_other: "防衛戦列に輸送艦{{band}}隻",
  noteSeen: "敵に探査機を発見されました",
  noteSomeAway: "探査機の観測時、敵艦隊の一部は出航中でした",
  noteTelescopeAway: "望遠鏡：敵艦隊は現在出航中",
  noteTelescopeHome: "望遠鏡：敵艦隊は現在この惑星に駐留中",
  noteLastRaid: "前回の襲撃では主に{{class}}が沈みました",
  mixMostly: "主力は{{class}}",
  mixEven: "突出した艦種はありません",
  matchupMajority: "主力は{{class}}（過半数）",
  matchupRemainder: "残りは未確認で、あなたの部隊に強い艦種が含まれる可能性があります",
  matchupUnread: "{{share}}%は未確認",
  matchupMixed: "混成防衛：単一の天敵艦種はありません",
  matchupSplit: "確認済みの艦種内訳",
  matchupBring: "{{class}}を編成",
  matchupSingle: "この部隊は単一艦種です。相性の悪い敵艦が未確認の部分にいる可能性があります",
  matchupExposure: "有利{{strong}}%・不利{{weak}}%",
  matchupProbe: "造船所レベルが2高い探査機なら艦種の内訳が分かります",
} as const;
