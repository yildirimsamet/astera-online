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
  eyebrow: 'Standing offers',
  title: 'Rewards',
  intro:
    'The galaxy pays for playing it. Nothing here expires, nothing needs a streak, and everything lands in your store — where anyone can come and take it.',

  waiting: '{{count}} ready to claim',
  allTaken: 'Everything on offer has been taken. More arrives as the galaxy does.',

  claim: 'Claim',
  claimed: 'Taken',
  /** What is still between the player and this tier. Never a scolding. */
  toGo: '{{count}} to go',
  locked: 'Locked',

  /** The target on a tier row. `×3` and `L5` — never "3 probes", which reads wrong at 1. */
  goalCount: '×{{n}}',
  goalLevel: 'L{{n}}',
  /** The chain's standing, beside its name. */
  progressCount: '{{have}} / {{need}}',
  progressLevel: 'L{{have}}',
  progressDone: 'Complete',

  granted: '+{{alloy}} alloy · +{{crystal}} crystal',
  overCap:
    'This will take you over your storage ceiling. Nothing is lost — but the works cannot be emptied until you spend some of it.',

  /**
   * ONE ENTRY PER CHAIN, `name` + `tag`, the same shape every card in the game
   * uses (`docs/interface.md`): the name says what the goal IS, the tag says why
   * anybody would want it. A player scanning eleven of these needs both.
   */
  chains: {
    PROBE: { name: 'Probes sent', tag: 'Look before you leap' },
    RAID: { name: 'Worlds raided', tag: 'Different worlds, not the same one twice' },
    CORE: { name: 'Command Core', tag: 'The ceiling everything else obeys' },
    SHIPYARD: { name: 'Shipyard', tag: 'Opens heavier hulls' },
    REFINERY: { name: 'Alloy Refinery', tag: 'Alloy every hour' },
    EXTRACTOR: { name: 'Crystal Extractor', tag: 'Crystal every hour' },
    SHIPS: { name: 'Wasps built', tag: 'Counted for the whole season' },
    AEGIS: { name: 'Aegis', tag: 'A shield over your world' },
    MINE: { name: 'Asteroid drilled', tag: 'Reach a passing rock' },
    SALVAGE: { name: 'Wreck salvaged', tag: 'Take what a battle left behind' },
    SOCIAL: { name: 'Follow @JoinAstera', tag: 'Once per commander' },
  },

  /**
   * The one reward the game cannot see, so the card has to be an instruction
   * rather than a progress bar. Three steps, stated plainly, with the handle as a
   * real link — a player is not going to retype it.
   */
  social: {
    handle: '@JoinAstera',
    url: 'https://x.com/JoinAstera',
    step1: 'Follow @JoinAstera.',
    step2: 'Send a direct message with your commander name — {{name}}.',
    step3: 'It is checked by hand, and the reward appears here to claim.',
    pending: 'Waiting on the message',
    ready: 'Confirmed — claim it',
  },
} as const;
