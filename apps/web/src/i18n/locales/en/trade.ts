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
  chip: "Trade ship",
  /** The rate is the whole reason to look up, so the chip carries it. */
  chipRemaining: "{{remaining}} left",

  /* ── the focus rail ─────────────────────────────────────────── */
  eyebrow: "Trade window",
  title: "Trade ship",
  /** Collapsed summary: how long it stays, and how soon you could be there. */
  summaryReach: "reach {{duration}}",
  rateHeading: "Equal value",
  /** Screen-reader sentence for one drawn row of the rate table. */
  rateReading: "{{amount}} {{resource}} for one deuterium",
  leavesIn: "Leaves in",
  reachLabel: "Soonest reach",
  reachNone: "Out of reach",
  boundary:
    "Every commander in the galaxy sees this ship, its orbit and its rate. There is no quota and no fee.",
  open: "Send a convoy",
  noCraft: "No craft standing at this world",
  noCarrier: "Needs a Courier, Wayfarer or Atlas",
  carriersAway: "Your carriers are away",
  tooLate: "Nothing here can reach it in time",

  /* ── the convoy sheet ───────────────────────────────────────── */
  sheetEyebrow: "Trade window · {{duration}} left",
  sheetTitle: "Trade ship",
  alloy: "Alloy",
  crystal: "Crystal",
  deuterium: "Deuterium",
  convoyHeading: "Convoy",
  offerHeading: "You give",
  askHeading: "You take",
  askUnits: "{{units}} units",
  carrierRoom: "{{count}} at home · {{volume}} hold each",
  holdReading: "This convoy holds {{volume}}",
  ceilingStore: "At most {{amount}} — all this world has · exactly {{worth}} {{good}}",
  ceilingHold: "At most {{amount}} — exactly {{worth}} {{good}}. Grow the convoy to raise it.",
  /** `aria-label` on the split slider. */
  splitLabel: "What you take",
  splitToward: "more {{resource}}",
  legOut: "Out",
  legHome: "Home",
  legHold: "Convoy",
  legReturnDecides:
    "What you take is bulkier than what you give. This is all your convoy carries home, and it is what sets the ceiling above — add a ship to give more.",
  givePick: "What you give",
  /** `aria-label` on the offer slider. */
  giveAmount: "{{resource}} to give",
  giveSpend: "Leaving the store",
  holdNoCarrier: "Only a Courier, Wayfarer or Atlas has a hold — pick one.",
  hullNone: "None at this world",
  bays: "Flight bays",
  baysReading: "{{used}} of {{total}} flight bays in use",
  homeDefence: "{{ships}} craft remain here · {{power}} defence power",
  fuel: "fuel for both legs",
  figureOut: "Out",
  figureAway: "Away for",
  figureDistance: "Distance",
  figureNone: "no route",
  fewer: "Fewer {{name}}",
  more: "More {{name}}",
  quantity: "{{name}} quantity",
  max: "Max {{name}}",
  maxShort: "Max",

  /* ── the commitment ─────────────────────────────────────────── */
  send: "Send convoy",
  sending: "Dispatching",
  back: "Back",
  commit: "Send — no recall",
  warning: "A launched convoy cannot be recalled. It is away for {{duration}}.",
  fleetsave: "While it is out there it cannot be raided — but neither can it defend this world.",
  launched: "Convoy away · {{duration}}",

  /* ── one refusal per way the server says no ─────────────────── */
  chooseFleet: "Choose a convoy",
  windowClosed: "The merchant has gone",
  noBay: "No free flight bay",
  needsCarrier: "Add a Courier, Wayfarer or Atlas",
  noOffer: "Choose what to offer",
  noAsk: "Choose what to take",
  cannotPay: "The offer will not pay for that",
  selfSwap: "The merchant will not swap a resource for itself",
  badAmount: "Whole units only",
  overHold: "The convoy hold is too small",
  noStock: "Not enough of that in the store",
  cannotReach: "It will be gone before your convoy arrives",
  noFuel: "Not enough deuterium for the flight",
} as const;
