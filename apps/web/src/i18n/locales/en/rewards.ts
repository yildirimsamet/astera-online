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
  empty: 'No reward goals available',
  emptyHint: 'Reload the reward list to check again.',
  summaryReady: "Ready to claim",
  summaryClaimed: "Claimed milestones",
  allMilestones: "All milestones",
  eyebrow: 'Quests and goals',
  title: 'Rewards',
  intro:
    "No expiry, no streak. Rewards go to your store; unprotected ones can be raided.",

  waiting: '{{count}} ready to claim',
  allTaken: 'Everything on offer has been taken. More arrives as the galaxy does.',

  claim: 'Claim',
  /** The supply pod over the list: the next ready payout, opened by a tap (C34). */
  welcome: {
    board: 'New Commander · 7 Boxes',
    rule: 'Each box grants an escalating fixed cache; day 3 adds the Helios planet ring, day 4+ adds deuterium, and day 7 adds the Titan Drive engine flame. The next is ready {{gap}} hours after you open one, and it waits for you.',
    title: 'Commander box {{box}}/{{of}}',
    opened: 'Opened',
    ready: 'Ready',
    hold: 'Hold',
    wait: 'in {{time}}',
    big: 'Big box',
    later: 'Fixed reward',
    poured: 'To your store: {{purse}}',
    skinRingHelios: 'Helios Ring',
    skinEngineTitan: 'Titan Drive',
  },
  /** GÜNLÜK GÖREVLER (owner, 2026-11-24): four acts, each paying a small purse once a UTC day. */
  /** Rewards in two tabs (owner 2026-11-24): the day's quests, and the standing goals. */
  tabs: {
    label: 'Reward sections',
    daily: 'Daily',
    goals: 'Goals',
  },
  daily: {
    title: 'Daily quests',
    granted: '+{{alloy}} alloy · +{{crystal}} crystal · +{{honor}} Honor',
    resets: 'Resets in {{time}}',
    about: 'How daily quests work',
    fact: 'Each quest pays once a day.',
    rule: 'What you do today counts; the day starts again at 00:00 UTC, at the same moment for everyone. Take a finished quest: the purse goes into your capital\'s store, where it can be raided. A missed day costs you nothing.',
    quests: {
      PROBES: 'Send 3 probes',
      RIFT: 'Fly into the Yarık',
      PIRATE: 'Hunt a pirate',
      ASTEROID: 'Mine an asteroid',
    },
  },
  takeAll: 'Take all · {{count}}',
  go: 'Go',
  next: 'Next: {{name}} · {{count}} to go',
  openPod: 'Open the pod',
  podTask: 'Task',
  podPrize: 'Reward',
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
    'Over your storage ceiling: nothing is lost, but you can\'t collect until you spend.',

  /**
   * ONE ENTRY PER CHAIN, `name` + `tag`, the same shape every card in the game
   * uses (`docs/interface.md`): the name says what the goal IS, the tag says why
   * anybody would want it. A player scanning eleven of these needs both.
   */
  chains: {
    VAULT: { name: 'Store', tag: 'Deepen the store and put part of it out of reach' },
    PIRATE: { name: 'Pirates defeated', tag: 'Win against different crews and bring ships home' },
    PROBE: { name: 'Probes sent', tag: 'Look before you leap' },
    RAID: { name: 'Worlds raided', tag: 'Different worlds, not the same one twice' },
    CORE: { name: 'Command Core', tag: "Raise building level limits, except for the Hangar" },
    SHIPYARD: { name: 'Shipyard', tag: 'Opens heavier hulls' },
    REFINERY: { name: 'Alloy Refinery', tag: 'Alloy every hour' },
    EXTRACTOR: { name: 'Crystal Extractor', tag: 'Crystal every hour' },
    SHIPS: { name: 'Darts built', tag: 'Counted for the whole season' },
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
    how: 'How to earn it',
    howFact: 'Three steps on X.',
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
