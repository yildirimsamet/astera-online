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
  eyebrow: 'Recompensas permanentes',
  title: 'Recompensas',
  intro:
    'Tus logros en la galaxia tienen recompensa. Nada caduca ni exige jugar varios días seguidos. Los recursos llegan a tu almacén, donde otros podrían arrebatártelos en un ataque.',

  waiting: '{{count}} recompensas por recoger',
  allTaken: 'Ya has recogido todas las recompensas disponibles. Habrá más cuando avances en la galaxia.',

  claim: 'Recoger',
  claimed: 'Recogida',
  /** What is still between the player and this tier. Never a scolding. */
  toGo: 'Faltan {{count}}',
  locked: 'Bloqueado',

  /** The target on a tier row. `×3` and `L5` — never "3 probes", which reads wrong at 1. */
  goalCount: '×{{n}}',
  goalLevel: 'L{{n}}',
  /** The chain's standing, beside its name. */
  progressCount: '{{have}} / {{need}}',
  progressLevel: 'L{{have}}',
  progressDone: 'Completo',

  granted: '+{{alloy}} aleación · +{{crystal}} cristal',
  overCap:
    'Esto superará el límite de tu almacén. No perderás nada, pero no podrás recoger más producción hasta que gastes parte de tus recursos.',

  /**
   * ONE ENTRY PER CHAIN, `name` + `tag`, the same shape every card in the game
   * uses (`docs/interface.md`): the name says what the goal IS, the tag says why
   * anybody would want it. A player scanning eleven of these needs both.
   */
  chains: {
    VAULT: { name: 'Bóveda mejorada', tag: 'Protege parte de los recursos que almacenas' },
    PIRATE: { name: 'Piratas derrotados', tag: 'Vence a distintos piratas y trae tus naves de vuelta' },
    PROBE: { name: 'Sondas enviadas', tag: 'Explora antes de atacar' },
    RAID: { name: 'Mundos asaltados', tag: 'Ataca mundos distintos' },
    CORE: { name: 'Núcleo de Mando mejorado', tag: 'Amplía el límite de tus edificios' },
    SHIPYARD: { name: 'Astillero', tag: 'Abre cascos más pesados' },
    REFINERY: { name: 'Refinería de Aleaciones', tag: 'Más aleación cada hora' },
    EXTRACTOR: { name: 'Extractor de Cristal', tag: 'Más cristal cada hora' },
    SHIPS: { name: 'Dart construidos', tag: 'Se cuentan durante toda la temporada' },
    AEGIS: { name: 'Égida', tag: 'Un escudo sobre tu mundo' },
    MINE: { name: 'Asteroide explotado', tag: 'Llega hasta un asteroide en movimiento' },
    SALVAGE: { name: 'Restos recuperados', tag: 'Recoge lo que dejó una batalla' },
    SOCIAL: { name: 'Seguir a @JoinAstera', tag: 'Una sola vez por cuenta' },
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
    eyebrow: 'Bonificación comunitaria',
    handle: '@JoinAstera',
    url: 'https://x.com/JoinAstera',
    alloy: 'aleación',
    crystal: 'cristal',
    open: 'Abra @JoinAstera en X',
    step1: 'Siga a @JoinAstera: el botón a continuación lo abre en una nueva pestaña.',
    step2: 'Envíanos un mensaje directo con el nombre de tu comandante:',
    step3: 'Lo comprobamos a mano. Una vez que lo hagamos, la recompensa te espera aquí.',
    pending: 'Esperando tu mensaje',
    ready: 'Confirmado: reclama tu bono',
    /**
     * WHAT A PLAYER WHO ALREADY HAS IT READS, and it has to say more than "Taken"
     * — every other card in this panel says that about THIS season, and a new
     * galaxy brings all of them back. This one does not come back, so the card
     * says so plainly rather than leaving somebody following an account they
     * already follow and waiting for a reply that will never pay.
     */
    forever: 'Ya pagado. Este bono es una vez por cuenta: una nueva galaxia no lo recupera.',
  },
} as const;
