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
  populationHeld: '<0>{{amount}}</0> commanders hold a world',
  populationOnline: '<0>{{amount}}</0> in game now',
  register: 'Check Your Planet',
  signIn: 'I already have a commander',
  reassurance: 'No account yet. Play first, keep it after.',

  /**
   * THE RETURNING DOOR. Owner-reported bug.
   *
   * A device that has held a commander gets the two controls swapped: signing in
   * becomes the loud one. Their own strings rather than a reuse of `signIn` and
   * `register`, because they say different things — one is "come back to the world
   * you left", the other is "see what this is".
   */
  welcomeBack: 'Your capital is where you left it',
  signInPrimary: 'Sign in',
  returningHint: 'Same commander, same galaxy, on any browser.',
  newCommander: 'Start a new commander instead',
  opening: 'Opening the galaxy',
  ready: 'Your planet is ready',
  cover: 'Bringing the sky up',

  form: {
    labelRegister: 'Create a commander',
    labelLogin: 'Sign in',
    close: 'Close',
    eyebrowRegister: 'New commander',
    eyebrowLogin: 'Welcome back',
    headingRegister: 'Take a planet',
    headingLogin: 'Sign in',
    nameLabel: 'Commander name',
    namePlaceholder: 'Vantage',
    passwordLabel: 'Password',
    passwordPlaceholder: 'At least {{count}} characters',
    submitBusy: 'Making contact',
    submitRegister: 'Create commander',
    submitLogin: 'Sign in',
    switchToLogin: 'I already have a commander',
    switchToRegister: 'I need a commander',
    badName: 'Names are 3-16 letters, numbers or underscores.',
    noName: 'Enter your commander name.',
    shortPassword: 'Passwords are at least {{count}} characters.',
    noPassword: 'Enter your password.',
    failed: 'Could not sign in',
  },
} as const;

export const servers = {
  commanderLabel: 'Commander',
  signOut: 'Sign out',
  rule:
    'Every galaxy holds 300 commanders and no more. They fill in order, so the one you join is the one that already has people in it.',
  loading: 'Reading the sky',
  unreachable: 'Could not reach the galaxies.',
  retry: 'Try again',
  listLabel: 'Galaxies',
  noneOpen: 'No galaxy is open right now. The season is between wipes — try again shortly.',
  allFull: 'Every galaxy is full. The next one opens at the wipe, when everyone starts again.',
  online: '<0>{{amount}}</0> in game now',
  yours: 'Your galaxy',
  status: {
    open: 'Taking commanders',
    full: 'Full',
    locked: 'Opens when the one above fills',
    closed: 'Between seasons',
  },
  enter: 'Enter',
  join: 'Join',
  joining: '…',
} as const;

export const app = {
  blockedTitle: 'Not right now',
  blockedRetry: 'Try again',
  /** What `useSession` says when a request failed with no message of its own. */
  sessionFailed: 'Could not reach the server',
} as const;

export const loading = {
  /** Between screens, while identity is being settled. */
  contact: 'Making contact',
  /** The galaxy: three waits, three different sentences. */
  sweeping: 'Sweeping the disc',
  charting: 'Charting the disc',
  raising: 'Bringing it up',
} as const;

/**
 * WHAT THE DOCUMENT ITSELF SAYS, outside React.
 *
 * The `<meta name="description">` a link preview and a search result read, and
 * which of the two install manifests the browser is pointed at. The NAME is not
 * here on purpose — "Astera Online" is the product, and a product does not get
 * translated (D54).
 */
export const document = {
  description: 'Command a protected capital, win colonies, and uncover what rivals hold.',
  manifest: '/manifest.webmanifest',
} as const;

export const settings = {
  sectionLabel: 'Language',
  hint: 'The whole game switches at once. Nothing else changes.',
  /** On the control that opens the picker, and on the picker's own options. */
  choose: 'Choose a language',
  current: 'In use',
} as const;
