/**
 * TİCARET GEMİSİ — the merchant's rail, its chip and its convoy sheet. D156.
 *
 * ITS OWN FILE, not a block appended to `world.ts`, for the reason the index
 * already gives: one namespace per surface. The merchant is a surface — a rail on
 * the disc, a chip in the corner and the one sheet a trade is committed from — and
 * it arrived whole rather than as an addition to an existing screen.
 *
 * NOTHING HERE IS SHARED WITH `transfer`, which reads almost identically in
 * places. Two controls that happen to say the same words are still two controls:
 * the day one of them is reworded the other must not move with it (D55).
 */
export const trade = {
  /* ── the chip in the corner ─────────────────────────────────── */
  chip: "貿易船",
  /** The rate is the whole reason to look up, so the chip carries it. */
  chipRemaining: "残り{{remaining}}",

  /* ── the focus rail ─────────────────────────────────────────── */
  eyebrow: "取引可能期間",
  title: "貿易船",
  /** Collapsed summary: how long it stays, and how soon you could be there. */
  summaryReach: "最短{{duration}}で到達",
  rateHeading: "等価交換",
  /** Screen-reader sentence for one drawn row of the rate table. */
  rateReading: "重水素1単位あたり{{amount}}{{resource}}",
  leavesIn: "出発まで",
  reachLabel: "最短到達",
  reachNoCraft: "ここには船がありません",
  reachNoCarrier: "この惑星に輸送艦がいません",
  reachCarriersAway: "輸送艦は出航中です",
  reachNone: "到達できません",
  boundary:
    "銀河中の司令官がこの貿易船の位置、軌道、交換レートを確認できます。取引枠や手数料はありません。",
  open: "輸送隊を派遣",
  noCraft: "この惑星に艦船がいません",
  noCarrier: "クーリエ、ウェイフェアラー、アトラス、またはアルゴシーが必要です",
  carriersAway: "輸送艦は出航中です",
  tooLate: "この惑星からは出発前に到達できません",

  /* ── the convoy sheet ───────────────────────────────────────── */
  sheetEyebrow: "取引可能期間・残り{{duration}}",
  sheetTitle: "貿易船",
  alloy: "合金",
  crystal: "クリスタル",
  deuterium: "重水素",
  convoyHeading: "輸送隊",
  offerHeading: "渡す資源",
  askHeading: "受け取る資源",
  askUnits: "{{units}}単位",
  carrierRoom: "この惑星に{{count}}隻・1隻あたり積載量{{volume}}",
  holdReading: "輸送隊の積載量：{{volume}}",
  ceilingStore: "最大{{amount}}・この惑星の全在庫に相当・{{worth}}{{good}}と交換",
  ceilingHold: "最大{{amount}}・{{worth}}{{good}}と交換。輸送艦を増やすと上限が上がります。",
  /** `aria-label` on the split slider. */
  splitLabel: "受け取る資源",
  splitToward: "{{resource}}を増やす",
  legOut: "往路",
  legHome: "帰路",
  legHold: "積載量",
  legReturnDecides:
    "受け取る資源は、渡す資源より積載量を多く使います。帰路に運べる量が取引の上限です。輸送艦を増やすと、さらに多くの資源を交換できます。",
  givePick: "渡す資源",
  /** `aria-label` on the offer slider. */
  giveAmount: "渡す{{resource}}の量",
  giveSpend: "貯蔵庫から支払う",
  holdNoCarrier: "積載できるのはクーリエ、ウェイフェアラー、アトラス、アルゴシーだけです。1隻以上選んでください。",
  hullNone: "この惑星にいません",
  bays: "発進枠",
  baysReading: "発進枠{{total}}のうち{{used}}を使用中",
  homeDefence: "この惑星に残る艦船{{ships}}隻・火力{{power}}",
  fuel: "往復分の燃料",
  figureOut: "往路",
  figureAway: "帰還まで",
  figureDistance: "距離",
  figureNone: "航路なし",
  fewer: "{{name}}を減らす",
  more: "{{name}}を増やす",
  quantity: "{{name}}の隻数",
  max: "{{name}}をすべて選ぶ",
  maxShort: "最大",

  /* ── the commitment ─────────────────────────────────────────── */
  send: "輸送隊を派遣",
  sending: "派遣中",
  warning: "発進した輸送隊は呼び戻せません。帰還まで{{duration}}かかります。",
  fleetsave: "出航中の輸送隊は襲撃されません。ただし、その間はこの惑星を防衛できません。",
  launched: "輸送隊が出航しました・帰還まで{{duration}}",

  /* ── one refusal per way the server says no ─────────────────── */
  chooseFleet: "輸送隊を選んでください",
  windowClosed: "貿易船は出発しました",
  noBay: "空いている発進枠がありません",
  needsCarrier: "クーリエ、ウェイフェアラー、アトラス、またはアルゴシーを追加してください",
  noOffer: "渡す資源を選んでください",
  noAsk: "受け取る資源を選んでください",
  cannotPay: "渡す資源の価値が足りません",
  selfSwap: "同じ資源同士は交換できません",
  badAmount: "整数単位で指定してください",
  overHold: "輸送隊の積載量が足りません",
  noStock: "貯蔵庫にその資源が足りません",
  cannotReach: "輸送隊の到着前に貿易船が出発します",
  noFuel: "飛行に必要な重水素が足りません",
} as const;
