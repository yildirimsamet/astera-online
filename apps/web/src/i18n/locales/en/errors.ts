/**
 * EVERY REFUSAL, IN THE PLAYER'S LANGUAGE.
 *
 * The API answers a refusal with a stable machine CODE, an English sentence, and
 * the figures that sentence was built from (`params`). The client localises off
 * the code and fills in the params; the server's own sentence is the fallback for
 * a code this build has never heard of — a server one deploy ahead must never
 * leave the player staring at nothing.
 *
 * The English here is deliberately identical to what the server writes. That is
 * not duplication for its own sake: it means an English player sees exactly the
 * same words whether the code was recognised or not, so a missing entry is
 * invisible rather than a change of voice mid-session.
 */

export const errors = {
  /** What is shown when nothing else is known. */
  unknown: 'Something went wrong',
  unreachable: 'Lost contact with the server. Try again in a moment.',
  streamFailed: 'Stream unavailable',

  ALREADY_HARVESTING: 'You already have craft there',
  ALREADY_IN_ORBIT: 'That satellite is already in orbit',
  ALREADY_MINING: 'You already have craft working that rock',
  ALREADY_PLACED: 'You already command a planet in another galaxy',
  ASTEROID_EMPTY: 'That rock has already been stripped',
  ASTEROID_GONE: 'That rock is not in the disc',
  AT_MAX_LEVEL: 'Your {{instrument}} is at its highest level. There is nothing further to gain.',
  BAD_COUNT: 'Count must be a positive integer',
  BAD_COUNT_craft: 'Send at least one craft',
  BAD_COUNT_prospector: 'Send at least one Prospector',
  BAD_CREDENTIALS: 'That name and password do not match',
  BAD_FLEET: 'Bad ship count for {{hull}}',
  BAD_REQUEST: 'That request could not be read',
  BAD_SESSION: 'Session is invalid or expired',
  BAD_SLOT: 'Telescope L{{level}} can watch {{slots}} planet(s)',
  BASH_LIMIT: 'You have hit this planet too many times recently',
  CANNOT_INTERCEPT: 'It will leave the disc before your craft could reach it',
  CORE_CEILING: 'Command Core must be raised first',
  CROSS_SEASON: 'That planet is in another galaxy',
  EMPTY_FLEET: 'Send at least one ship',
  FIELD_GONE: 'There is nothing left of it',
  FLEET_ALREADY_COMMITTED: 'You already have a fleet committed to that planet',
  FORBIDDEN: 'You cannot attack that planet',
  GROUND_UNIT: '{{hull}}s cannot travel',
  IMMOBILE_FLEET: 'That fleet cannot travel',
  INSUFFICIENT_RESOURCES: 'Not enough resources',
  INSUFFICIENT_RESOURCES_probe: 'Not enough resources for a probe',
  INTERNAL: 'Something went wrong',
  NEEDS_UPLINK: 'Put an Uplink in orbit first',
  NO_FREE_BAY: 'All {{total}} flight bays are in use. Something has to land first.',
  NO_FREE_SLOT: 'Raise the Command Core for another orbit slot',
  NO_PLANET: 'Join a galaxy first',
  NO_SEASON: '{{shard}} is not open right now',
  NO_SESSION: 'No session cookie',
  NO_SUCH_ASTEROID: 'No such asteroid',
  NO_SUCH_FIELD: 'No such wreck field',
  NO_SUCH_SERVER: 'No galaxy by that name',
  NO_TELESCOPE: 'Install a Telescope first',
  NOT_A_WARSHIP: 'Prospectors mine; they do not raid',
  NOT_ENOUGH_CRAFT: 'Only {{available}} Prospectors at home',
  NOT_ENOUGH_SHIPS: 'Not enough {{hull}} at home',
  OUT_OF_RANGE: 'Telescope L{{level}} reaches {{reach}} units; that world is {{distance}} away',
  PLANET_NOT_FOUND: 'No such planet',
  PLAYER_NOT_FOUND: 'No such player',
  PROBE_ALREADY_OUT: 'You already have a probe working that planet',
  PROSPECTOR_CAP: 'You may hold {{max}} Prospectors, and you have {{have}}.',
  PROSPECTOR_CAP_atLimit: 'You already have {{max}} Prospectors. That is the limit.',
  /**
   * The rehearsal cannot honour that, and it should never have been offered.
   *
   * A belt-and-braces line: the beats gate every control they cannot pay for, so
   * reaching this means one slipped through. Better a sentence than the code.
   */
  RATE_LIMITED: 'Too many requests. Try again in {{seconds}} seconds.',
  REHEARSAL_ONLY: 'Not until this world is yours',
  SEASON_NOT_FOUND: 'No such season',
  SELF_ATTACK: 'You cannot attack your own planet',
  SELF_PROBE: 'You already know what is on your own planet',
  SELF_WATCH: 'You already know what your own fleet is doing',
  SERVER_LOCKED: '{{shard}} is not open yet',
  SERVER_LOCKED_frontier: '{{shard}} opens once {{frontier}} is full. Join {{frontier}}.',
  SHARD_FULL: '{{shard}} is full',
  SHIPYARD_TOO_LOW: 'Needs Shipyard L{{level}}',
  SLOT_COOLING: 'That slot is still realigning — {{minutes}} minutes left',
  TIER_BAND: 'That world is more than two development tiers from yours',
  UNAUTHENTICATED: 'Sign in first',
  UNKNOWN: 'Something went wrong',
  USERNAME_TAKEN: 'That name is already flying',
} as const;
