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
export const country = {
  label: 'Country',
  choose: 'Choose your country',
  searchLabel: 'Search countries',
  searchPlaceholder: 'Search by country',
  list: 'Countries',
  confirm: 'Confirm country',
  change: 'Change',
  saved: 'Country updated',
} as const;

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
      line: "{{shard}} is still filling. Gather intelligence to learn other commanders' resources and defences.",
      action: 'Understood',
    },
    core: {
      title: 'Raise the level limit first',
      line: "The Command Core sets structure level limits, except for the Hangar. Open its row and review level 2’s effect and cost. Then queue the upgrade.",
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

  /** Always reachable: skip to claim, or leave for an existing account. */
  skip: 'Skip',
  haveAccount: 'I already have a commander',

  /** The wall, at the one moment the player wants something. */
  claim: {
    eyebrowName: 'Last step',
    headingName: "Choose your commander name",
    lineName: 'Your four orders are staged. Claim {{name}} and their real clocks start together.',
    nameLabel: 'Commander name',
    next: 'Continue',

    eyebrowPassword: 'One more',
    headingPassword: "Set a password for {{name}}",
    linePassword: "Use this password to sign in with the same commander on another device.",
    passwordLabel: 'Password',
    submit: 'Claim the planet',
    working: "Creating your commander…",
    back: 'Back',
  },

  /** What the beats could not deliver, said plainly rather than swallowed. */
  trouble: {
    noFrontier: 'Every galaxy is full right now. Nothing to rehearse until a season turns over.',
    unreachable: 'Could not reach the galaxy.',
    retry: 'Try again',
    /** One or more replayed decisions were refused once the server ran them. */
    partial: "Your planet was created. Some prepared orders could not start. Check the current production queues.",
  },
} as const;
