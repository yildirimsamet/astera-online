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
      line: '{{planets}} of fifty worlds are taken, by people. Everything moving out there is real, and it is happening now.',
      action: 'Show me my world',
    },
    yours: {
      title: 'One world is yours',
      line: '{{name}}, held for you. Tap it.',
    },
    fog: {
      title: 'So what is on the others?',
      line: 'Tap anybody else. You get a name and how far they have built — never what they are holding. They cannot see yours either.',
    },
    fogAlone: {
      title: 'Nobody else is here yet',
      line: '{{shard}} is still filling. When it does, you will not be able to see what any of them are holding.',
      action: 'Understood',
    },
    core: {
      title: '{{alloy}} alloy, {{crystal}} crystal',
      line: 'That is the whole budget. Raise the Command Core first — nothing may stand higher than it, so nothing else will move until it does.',
    },
    refinery: {
      title: 'Now the Refinery',
      line: 'The ceiling moved with the Core. The Refinery is what makes alloy.',
    },
    extractor: {
      title: 'And the Crystal Extractor',
      line: 'The third one. Watch the crystal as you buy it.',
    },
    fleet: {
      title: 'Your crystal is gone. Exactly.',
      line: 'That is not a coincidence — the grant is three upgrades and two ships, to the unit. Take BOTH {{ship}}s with what is left.',
    },
    target: {
      title: 'The fleet is the bet',
      line: 'Tap a world, open it, and send everything you have. You do not know what is down there — looking is one way to find out and going is the other.',
    },
    targetAlone: {
      title: 'Nothing is in range',
      line: 'Your ships are built and your bay is empty. In this galaxy, the first move will be yours to make.',
      action: 'Claim my world',
    },
  },

  /** Always reachable, at every beat. A tutorial nobody can leave is a trap. */
  skip: 'Skip',
  haveAccount: 'I already have a commander',

  /** The wall, at the one moment the player wants something. */
  claim: {
    eyebrowName: 'Last step',
    headingName: 'Sign the world with your name',
    lineName: 'Your fleet is away. {{name}} stays yours once there is a commander behind it.',
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
    partial: 'Your world is yours. One order did not survive the trip — the galaxy moved while you were signing.',
  },
} as const;
