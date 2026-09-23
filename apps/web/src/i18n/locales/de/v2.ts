/** Gözlemevi-v2-Bausteine — die Texte der neuen Komponenten (docs/ui-v2/gozlemevi.md). */

/** B9: gedrückt halten zum Senden. */
export const hold = {
  hint: 'Gedrückt halten oder zum Bestätigen zweimal Enter drücken',
  confirm: '{{label}} · sicher?',
};

/** B12: eine Bauschlange als Ringe. */
export const lane = {
  /** Ein leerer Platz in der Schlange. */
  free: '+ Freier Platz',
};

/** B1: eine Ressourcenanzeige in der oberen Leiste. */
export const meter = {
  /** Read by a screen reader: the stock against the store. */
  reading: '{{resource}}: {{value}} von {{cap}}',
  /** The same, when the store is full. */
  full: '{{resource}}: {{value}} von {{cap}}, Lager voll',
};

/** B5: das Kräftelineal. */
export const ruler = {
  /** In place of the defence strip when nothing was ever measured. */
  unknown: 'Keine Sonde: ihre Verteidigung ist unbekannt',
  /** The button that closes that gap. */
  probe: 'Sonde senden',
};
