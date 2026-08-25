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
    SOCIAL: { name: 'Follow @JoinAstera', tag: 'Once per account, ever' },
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
    eyebrow: 'Community bonus',
    handle: '@JoinAstera',
    url: 'https://x.com/JoinAstera',
    alloy: 'alloy',
    crystal: 'crystal',
    open: 'Open @JoinAstera on X',
    step1: 'Follow @JoinAstera — the button below opens it in a new tab.',
    step2: 'Send us a direct message with your commander name:',
    step3: 'We check it by hand. Once we do, the reward waits for you here.',
    pending: 'Waiting on your message',
    ready: 'Confirmed — claim your bonus',
    /**
     * WHAT A PLAYER WHO ALREADY HAS IT READS, and it has to say more than "Taken"
     * — every other card in this panel says that about THIS season, and a new
     * galaxy brings all of them back. This one does not come back, so the card
     * says so plainly rather than leaving somebody following an account they
     * already follow and waiting for a reply that will never pay.
     */
    forever: 'Already paid. This bonus is once per account — a new galaxy does not bring it back.',
  },
} as const;
