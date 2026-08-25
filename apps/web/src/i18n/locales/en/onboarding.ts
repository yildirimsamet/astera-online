/**
 * THE REHEARSAL — ninety seconds of the real game, before there is an account.
 *
 * Every line is a beat, and every beat is a thing the player is about to DO. None
 * of them explains a system: the copy names what to look for and gets out of the
 * way, because the beat only advances when the thing actually happens.
 *
 * The house style holds here as hard as anywhere — consequence first, never a
 * system name, and never a paragraph where a clause will do.
 */
export const onboarding = {
  /** The one-line caption over the disc while the galaxy is being looked at. */
  beats: {
    wide: {
      title: '{{shard}}',
      line: 'Real people play in this galaxy. Every planet is a player’s home. The ships you see are their real fleets.',
      action: 'Show me my world',
    },
    yours: {
      title: 'This planet is yours',
      line: '{{name}} is your safe home planet. Here you make resources, study rivals, build defences and make ships. Tap your planet.',
    },
    briefing: {
      title: 'The game has four steps',
      line: 'First, make resources. Then study rivals. Protect your planet. When you are ready, send your ships. Every upgrade makes one of these jobs stronger.',
      action: 'Take the first step',
      mapGrow: 'Make',
      mapIntel: 'See',
      mapDefend: 'Protect',
      mapReach: 'Send',
      mapOutcome: 'Learn · decide · send',
    },
    fog: {
      title: 'Learn first, risk later',
      line: 'Tap another planet. You can see its level, but not its resources, ships or defences. Gather information first. Then decide if you should attack.',
    },
    fogAlone: {
      title: 'Nobody else is here yet',
      line: '{{shard}} is still filling. When it does, you will not be able to see what any of them are holding.',
      action: 'Understood',
    },
    core: {
      title: 'Raise the level limit first',
      line: 'The Command Core sets how high your other buildings can go. Tap its row. See what level 2 gives and costs, then add it to the queue.',
    },
    refinery: {
      title: 'Make more alloy',
      line: 'The Refinery makes alloy every hour. You use alloy for most buildings and ships. Tap its row and queue level 2.',
    },
    extractor: {
      title: 'Now make crystal',
      line: 'The Extractor makes crystal every hour. Strong ships and intel tools need crystal. Tap its row and queue level 2.',
    },
    fleet: {
      title: 'Now make two ships',
      line: 'Open the {{ship}} row under Fleet. Choose Max and queue both ships. You will use these fast ships to scout rivals or attack them.',
    },
  },

  /** Always reachable, at every beat. A tutorial nobody can leave is a trap. */
  skip: 'Skip',
  haveAccount: 'I already have a commander',

  /** The wall, at the one moment the player wants something. */
  claim: {
    eyebrowName: 'Last step',
    headingName: 'Sign the world with your name',
    lineName: 'Your four orders are staged. Claim {{name}} and their real clocks start together.',
    nameLabel: 'Commander name',
    next: 'Continue',

    eyebrowPassword: 'One more',
    headingPassword: 'Lock {{name}}',
    linePassword: 'Pick a password and your commander is waiting in whichever browser you sign in from.',
    passwordLabel: 'Password',
    submit: 'Claim the planet',
    working: 'Taking the world',
    back: 'Back',
  },

  /** What the beats could not deliver, said plainly rather than swallowed. */
  trouble: {
    noFrontier: 'Every galaxy is full right now. Nothing to rehearse until a season turns over.',
    unreachable: 'Could not reach the galaxy.',
    retry: 'Try again',
    /** One or more replayed decisions were refused once the server ran them. */
    partial: 'Your world is yours. One staged order was refused when the real queues started.',
  },
} as const;
