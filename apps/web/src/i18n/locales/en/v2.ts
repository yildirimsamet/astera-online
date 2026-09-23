/** Gözlemevi v2 kit — the words the new components carry (docs/ui-v2/gozlemevi.md). */

/** B9: press and hold to commit. */
export const hold = {
  /** Read by a screen reader: the two ways to use the button. */
  hint: 'Press and hold, or press Enter twice to confirm',
  /** The inline second step after one Enter. */
  confirm: '{{label}} · sure?',
};

/** B12: a build lane drawn as rings. */
export const lane = {
  /** A slot in the lane with nothing in it. */
  free: '+ Free slot',
};

/** B1: a resource meter on the top bar. */
export const meter = {
  /** Read by a screen reader: the stock against the store. */
  reading: '{{resource}}: {{value}} of {{cap}}',
  /** The same, when the store is full. */
  full: '{{resource}}: {{value}} of {{cap}}, store full',
};
