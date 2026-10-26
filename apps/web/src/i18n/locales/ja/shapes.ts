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
  /** Combat v3 force ruler (owner 2026-10-25): each side’s power, their ratio, and the rule one tap deep. */
  compareHeading: "相対戦力",
  compareLabel: "あなたの戦力は{{yours}}、相手の戦力は{{theirs}}です。",
  comparePick: "艦船を選ぶと、この目標と比較できます。",
  compareMeaning: "互いに対する火力と耐久力です。クラス相性も含みます。強い側ほど艦隊を多く残します。",
  compareRule: "戦力は武装艦と稼働中の地上砲を数えます。研究、損傷、相手に対するクラス相性、イージスの充填量を含みます。非武装艦は戦力に加わりません。探査機は範囲で観測するため、各陣営の戦力も範囲になります。比率の下端があなたにとって最悪の場合です。観測値は古くなり、戦闘では毎回射撃がランダムに決まります。",
  ratioYou: "あなたは{{band}}倍強い",
  ratioThem: "相手は{{band}}倍強い",
  ratioOpen: "観測値ではどちらが強いか決まりません：相手は最大{{them}}倍、あなたは最大{{you}}倍",
  ratioEven: "ほぼ互角",
  ratioNoFire: "相手側に反撃する武装はありません",
  ratioUnarmed: "あなたの部隊には攻撃できる艦がありません",
  axisTheirs: "相手が優勢",
  axisEven: "互角",
  axisYours: "あなたが優勢",
  outcomeHeading: "平均して各陣営に残るもの",
  outcomeRatio: "比率",
  outcomeWeak: "弱い側が残す",
  outcomeStrong: "強い側が失う",
  outcomeNote: "多数の戦闘の平均です。生きて撤退した艦は残ったものとして数えます。1:1では、大きい艦隊ほど多く残ります。",
  escapeRun: "観測範囲のすべてで、あなたの戦力は相手の{{ratio}}倍以上です。あなたの部隊が戦列を全滅させられ、相手の燃料が離脱費を払えるなら、敵艦は退避します。",
  escapeStand: "敵艦は退避せずに戦います。観測範囲のすべてで、あなたの戦力は相手の{{ratio}}倍未満です。",
  escapeRule: "あなたの戦力が、稼働中の地上砲を含む相手戦列の{{ratio}}倍以上なら、敵艦は戦闘前に退避します。あなたの部隊がその戦列を全滅させられることも条件です。相手の惑星は{{distance}}単位の往復燃料を払う必要があります。地上砲は残り、資源は引き続き略奪できます。",
  compareYours: "派遣戦力",
  compareTheirs: "現地戦力",
  compareRecord: "{{source}}, {{age}}",
  compareLive: "{{source}}、現在の情報",
  compareUnknown: "未測定",
  compareUnknownWhy: "探査機を送ると、この値を確認できます。",
  escapeUnsure: "敵艦は退避するかもしれません。観測値だけでは退避条件をすべて判断できません。",
  escapeMinimumRule: "防衛側の惑星に戦闘艦が{{count}}隻以上必要です。探査機の観測では正確な隻数は分かりません。",
  compareRuleToggle: "これは何ですか？",
  lineJoin: " · ",
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
