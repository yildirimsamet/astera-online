/**
 * THE WAY IN — the front door, the galaxy list, the frames between them.
 *
 * Every key in this file belongs to exactly one element on one screen. Two
 * controls that happen to read "Sign in" get two keys, because the second one is
 * a verb on a form and the first one is an invitation on a poster, and the day
 * one of them wants rewording the other must not move with it.
 */

export const landing = {
  /**
   * How busy the world is. Silent until it knows — see `Population`.
   *
   * `<0>` is the tinted span the figure sits in, filled by `<Trans>`. The figure
   * arrives pre-grouped as `amount` rather than as `count`, because `count` is
   * i18next's plural selector and handing it a formatted string breaks that.
   */
  populationHeld: "<0>{{amount}}</0>人の司令官が惑星を保有",
  populationOnline: "現在<0>{{amount}}</0>人がプレイ中",
  register: "自分の惑星を見てみる",
  signIn: "司令官でログイン",
  reassurance: "アカウントは後で作れます。まずはプレイしてみましょう。",

  /**
   * THE RETURNING DOOR. Owner-reported bug.
   *
   * A device that has held a commander gets the two controls swapped: signing in
   * becomes the loud one. Their own strings rather than a reuse of `signIn` and
   * `register`, because they say different things — one is "come back to the world
   * you left", the other is "see what this is".
   */
  welcomeBack: "あなたの首都は前回のまま待っています",
  signInPrimary: "ログイン",
  returningHint: "どのブラウザでも、同じ司令官で同じ銀河へ。",
  newCommander: "新しい司令官で始める",
  opening: "銀河に接続中",
  ready: "惑星の準備ができました",
  cover: "星空を準備中",
  publicLinksLabel: "運営情報",
  aboutLink: "アステラについて",
  guideLink: "遊び方",
  privacyLink: "プライバシー",
  termsLink: "規約",
  refundsLink: "返金",
  pricingLink: "価格",
  contactLink: "お問い合わせ",

  form: {
    labelRegister: "司令官を作成する",
    labelLogin: "ログイン",
    close: "閉じる",
    eyebrowRegister: "新しい司令官",
    eyebrowLogin: "おかえり",
    headingRegister: "惑星を手に入れよう",
    headingLogin: "ログイン",
    nameLabel: "司令官名",
    namePlaceholder: "Vantage",
    passwordLabel: "パスワード",
    passwordPlaceholder: "{{count}}文字以上",
    submitBusy: "接続中",
    submitRegister: "司令官を作成",
    submitLogin: "ログイン",
    switchToLogin: "司令官でログイン",
    switchToRegister: "新しい司令官を作る",
    badName: "名前は2～32文字。どの言語の文字・数字・アンダースコア・単独のスペースも使えます。",
    noName: "司令官名を入力してください。",
    shortPassword: "パスワードは {{count}} 文字以上です。",
    noPassword: "パスワードを入力してください。",
    failed: "ログインできませんでした",
  },
} as const;

export const servers = {
  commanderLabel: "司令官",
  signOut: "サインアウト",
  rule:
    "各銀河の定員は{{seats}}人です。順に埋まるため、参加先にはすでにほかのプレイヤーがいます。",
  loading: "銀河を確認中",
  unreachable: "銀河に接続できませんでした。",
  retry: "再試行",
  listLabel: "銀河",
  noneOpen: "現在参加できる銀河はありません。シーズン切り替え中です。少し待ってからお試しください。",
  allFull: "すべての銀河が満員です。次のシーズン切り替え時に新しい銀河が開きます。",
  online: "現在<0>{{amount}}</0>人がプレイ中",
  yours: "あなたの銀河",
  status: {
    open: "参加受付中",
    full: "満員",
    locked: "上の銀河が満員になると開放",
    closed: "シーズン切り替え中",
  },
  enter: "入る",
  join: "参加",
  joining: "…",
} as const;

export const app = {
  blockedTitle: "現在は利用できません",
  blockedRetry: "再試行",
  /** What `useSession` says when a request failed with no message of its own. */
  sessionFailed: "サーバーにアクセスできませんでした",
} as const;

export const loading = {
  /** Between screens, while identity is being settled. */
  contact: "接続中",
  /** The galaxy: three waits, three different sentences. */
  sweeping: "銀河を走査中",
  charting: "銀河を描画中",
  raising: "銀河を準備中",
} as const;

/**
 * WHAT THE DOCUMENT ITSELF SAYS, outside React.
 *
 * The `<meta name="description">` a link preview and a search result read, and
 * which localized install manifest the browser is pointed at. The NAME is not
 * here on purpose — "Astera Online" is the product, and a product does not get
 * translated (D54).
 */
export const document = {
  description: "保護された首都を指揮し、植民地を獲得し、ライバルが何を保持しているかを明らかにします。",
  manifest: "/manifest.ja.webmanifest",
} as const;

export const settings = {
  sectionLabel: "言語",
  hint: "ゲーム全体が一度に切り替わります。他には何も変わりません。",
  /** On the control that opens the picker, and on the picker's own options. */
  choose: "言語を選択してください",
  current: "使用中",
} as const;

/**
 * THE PRIVACY CHOICE, IN THE PLAYER'S OWN WORDS.
 *
 * Two sentences, two buttons, one link. The first sentence says what is kept
 * whatever they choose, because the session cookie is not part of the bargain
 * and a notice that implies it is has misdescribed the deal. The second says
 * exactly what each button does — "refuse" leaves ads running, unpersonalised,
 * rather than removing them, and a player who discovers that afterwards was
 * misled by the wording rather than by the ads.
 */
export const consent = {
  title: "Cookie と広告の選択",
  essentials: "サインインすると、常に 1 つのセッション Cookie が保存されます。その部分はオプションではありません。",
  optional:
    "測定および広告ストレージは、許可されている場合にのみ使用されます。拒否してもゲームは同じように動作し、パーソナライズなしで広告が表示されます。",
  accept: "許可",
  refuse: "拒否",
  close: "閉じる",
  policy: "クッキーポリシー",
  /** The permanent way back in. A row in the device group, not its own section. */
  menuRowLabel: "プライバシー",
  /** The row's accessible name; its visible text is the current answer. */
  menuLabel: "プライバシーと Cookie の設定",
  menuGranted: "許可",
  menuDenied: "拒否されました",
  menuUnset: "まだ選択されていません",
} as const;
