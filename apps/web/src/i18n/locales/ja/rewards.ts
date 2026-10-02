/**
 * THE REWARD PANEL.
 *
 * Every sentence here answers one of two questions and nothing else: *what do I
 * have to do*, and *what do I get*. Nothing congratulates the player, nothing
 * urges them, and nothing counts down — this is a list of standing offers, not a
 * campaign to be nagged through.
 *
 * The names are the GOALS rather than the prizes ("Probes sent", never "Scout
 * Bonus I"), because the panel's real job is to point at parts of the loop a new
 * commander has not tried yet. A player reading this list should come away
 * knowing that probing, raiding, mining and salvaging exist.
 */
export const rewards = {
  eyebrow: "常設の報酬",
  title: "報酬",
  intro:
    "銀河での行動が報酬になります。期限も連続プレイの条件もありません。報酬は貯蔵庫に入りますが、ほかの司令官に奪われる可能性があります。",

  waiting: "受け取れる報酬：{{count}}件",
  allTaken: "現在受け取れる報酬はありません。銀河での行動を続けると、次の報酬が開放されます。",

  claim: "受け取る",
  claimed: "受取済み",
  /** What is still between the player and this tier. Never a scolding. */
  toGo: "あと{{count}}",
  locked: "未開放",

  /** The target on a tier row. `×3` and `L5` — never "3 probes", which reads wrong at 1. */
  goalCount: "×{{n}}",
  goalLevel: "L{{n}}",
  /** The chain's standing, beside its name. */
  progressCount: "{{have}} / {{need}}",
  progressLevel: "L{{have}}",
  progressDone: "完了",

  granted: "+{{alloy}}合金・+{{crystal}}クリスタル",
  overCap:
    "報酬を受け取ると貯蔵庫の上限を超えます。資源は失われませんが、一部を使うまで生産分を回収できません。",

  /**
   * ONE ENTRY PER CHAIN, `name` + `tag`, the same shape every card in the game
   * uses (`docs/interface.md`): the name says what the goal IS, the tag says why
   * anybody would want it. A player scanning eleven of these needs both.
   */
  chains: {
    VAULT: { name: "貯蔵庫", tag: "貯蔵量を増やし、一部を襲撃から守る" },
    PIRATE: { name: "海賊を撃破", tag: "異なる海賊に勝ち、艦船を帰還させる" },
    PROBE: { name: "探査機を派遣", tag: "攻撃前に相手の情報を集める" },
    RAID: { name: "惑星を襲撃", tag: "異なる惑星を襲撃する" },
    CORE: { name: "司令中枢", tag: "ほかの施設のレベル上限を引き上げる" },
    SHIPYARD: { name: "造船所", tag: "より大型の艦船を建造できるようにする" },
    REFINERY: { name: "合金精錬所", tag: "時間あたりの合金生産量を増やす" },
    EXTRACTOR: { name: "クリスタル採掘所", tag: "時間あたりのクリスタル生産量を増やす" },
    SHIPS: { name: "ダートを建造", tag: "シーズン中の建造数が対象" },
    AEGIS: { name: "イージス", tag: "惑星を守るシールド" },
    MINE: { name: "小惑星を採掘", tag: "通過する小惑星に向かう" },
    SALVAGE: { name: "残骸を回収", tag: "戦闘後に残った資源を回収する" },
    SOCIAL: { name: "@JoinAsteraをフォロー", tag: "アカウントごとに1回限り" },
  },

  /**
   * The one reward the game cannot see, so the card has to be an instruction
   * rather than a progress bar. Three steps, stated plainly, with the handle as a
   * real link — a player is not going to retype it.
   */
  /**
   * THE COMMUNITY BONUS, and it is written as an INSTRUCTION rather than as a
   * description, because it is the only thing in the game a player has to do
   * somewhere else. Three steps, in the order they have to happen, each one short
   * enough to be read on a phone with the app already open in another tab.
   */
  social: {
    eyebrow: "コミュニティボーナス",
    handle: "@JoinAstera",
    url: "https://x.com/JoinAstera",
    alloy: "合金",
    crystal: "クリスタル",
    open: "X で @JoinAstera を開く",
    step1: "@JoinAsteraをフォローしてください。下のボタンから別のタブで開けます。",
    step2: "司令官名をダイレクトメッセージで送ってください：",
    step3: "運営が手動で確認します。確認後、ここで報酬を受け取れます。",
    pending: "メッセージの確認待ち",
    ready: "確認済み・ボーナスを受け取れます",
    /**
     * WHAT A PLAYER WHO ALREADY HAS IT READS, and it has to say more than "Taken"
     * — every other card in this panel says that about THIS season, and a new
     * galaxy brings all of them back. This one does not come back, so the card
     * says so plainly rather than leaving somebody following an account they
     * already follow and waiting for a reply that will never pay.
     */
    forever: "受取済みです。このボーナスはアカウントごとに1回限りで、新しい銀河でも再び受け取れません。",
  },
} as const;
