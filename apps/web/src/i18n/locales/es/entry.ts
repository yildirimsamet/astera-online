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
  populationHeld: '<0>{{amount}}</0> comandantes ya gobiernan su mundo',
  populationOnline: '<0>{{amount}}</0> jugando ahora',
  register: 'Descubre tu planeta',
  signIn: 'Ya tengo un comandante',
  reassurance: 'Aún no necesitas una cuenta. Empieza a jugar y guarda tu progreso después.',

  /**
   * THE RETURNING DOOR. Owner-reported bug.
   *
   * A device that has held a commander gets the two controls swapped: signing in
   * becomes the loud one. Their own strings rather than a reuse of `signIn` and
   * `register`, because they say different things — one is "come back to the world
   * you left", the other is "see what this is".
   */
  welcomeBack: 'Tu capital está donde lo dejaste',
  signInPrimary: 'Iniciar sesión',
  returningHint: 'El mismo comandante, la misma galaxia, en cualquier navegador.',
  newCommander: 'Crear un comandante nuevo',
  opening: 'Abriendo la galaxia',
  ready: 'Tu planeta está listo',
  cover: 'El cielo se abre ante ti',
  publicLinksLabel: 'Más información',
  aboutLink: 'Acerca de Astera',
  guideLink: 'Cómo jugar',
  privacyLink: 'Privacidad',
  termsLink: 'Términos',
  contactLink: 'Contacto',

  form: {
    labelRegister: 'Crear un comandante',
    labelLogin: 'Iniciar sesión',
    close: 'Cerrar',
    eyebrowRegister: 'Nuevo comandante',
    eyebrowLogin: 'Bienvenido de nuevo',
    headingRegister: 'Toma un planeta',
    headingLogin: 'Iniciar sesión',
    nameLabel: 'Nombre del comandante',
    namePlaceholder: 'Vantage',
    passwordLabel: 'Contraseña',
    passwordPlaceholder: 'Al menos {{count}} caracteres',
    submitBusy: 'Conectando',
    submitRegister: 'Crear comandante',
    submitLogin: 'Iniciar sesión',
    switchToLogin: 'Ya tengo un comandante',
    switchToRegister: 'Necesito un comandante',
    badName: 'El nombre debe tener entre 3 y 16 letras, números o guiones bajos.',
    noName: 'Introduce el nombre de tu comandante.',
    shortPassword: 'Las contraseñas tienen al menos {{count}} caracteres.',
    noPassword: 'Introduce tu contraseña.',
    failed: 'No se pudo iniciar sesión',
  },
} as const;

export const servers = {
  commanderLabel: 'Comandante',
  signOut: 'Cerrar sesión',
  rule:
    'En cada galaxia caben hasta {{seats}} comandantes. Se llenan por orden, así que entrarás en una donde ya hay gente jugando.',
  loading: 'Explorando el cielo',
  unreachable: 'No se puede acceder a las galaxias ahora mismo.',
  retry: 'Inténtalo de nuevo',
  listLabel: 'Galaxias',
  noneOpen: 'No hay ninguna galaxia abierta ahora mismo. La próxima temporada está por comenzar; vuelve a intentarlo dentro de poco.',
  allFull: 'Todas las galaxias están llenas. La siguiente se abrirá cuando comience una nueva temporada y todos vuelvan a empezar.',
  online: '<0>{{amount}}</0> jugando ahora',
  yours: 'Tu galaxia',
  status: {
    open: 'Acepta comandantes',
    full: 'Completo',
    locked: 'Se abre cuando el de arriba se llena',
    closed: 'Entre temporadas',
  },
  enter: 'Entrar',
  join: 'Unirse',
  joining: '…',
} as const;

export const app = {
  blockedTitle: 'Ahora no',
  blockedRetry: 'Inténtalo de nuevo',
  /** What `useSession` says when a request failed with no message of its own. */
  sessionFailed: 'No se pudo acceder al servidor',
} as const;

export const loading = {
  /** Between screens, while identity is being settled. */
  contact: 'Conectando',
  /** The galaxy: three waits, three different sentences. */
  sweeping: 'Explorando la galaxia',
  charting: 'Trazando el mapa de la galaxia',
  raising: 'La galaxia está apareciendo',
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
  description: 'Dirige una capital protegida, gana colonias y descubre lo que tienen tus rivales.',
  manifest: '/manifest.es.webmanifest',
} as const;

export const settings = {
  sectionLabel: 'Idioma',
  hint: 'El idioma cambia en todo el juego. Todo lo demás sigue igual.',
  /** On the control that opens the picker, and on the picker's own options. */
  choose: 'Elige un idioma',
  current: 'En uso',
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
  title: 'Cookies y opciones de publicidad',
  essentials: 'El inicio de sesión siempre almacena una cookie de sesión. Esa parte no es opcional.',
  optional:
    'Solo guardamos datos de medición y publicidad si lo permites. Si rechazas esta opción, podrás seguir jugando igual y verás anuncios sin personalizar.',
  accept: 'Permitir',
  refuse: 'Rechazar',
  close: 'Cerrar',
  policy: 'Política de cookies',
  /** The permanent way back in. A row in the device group, not its own section. */
  menuRowLabel: 'Privacidad',
  /** The row's accessible name; its visible text is the current answer. */
  menuLabel: 'Configuración de privacidad y cookies',
  menuGranted: 'Permitido',
  menuDenied: 'Rechazado',
  menuUnset: 'Aún no elegido',
} as const;
