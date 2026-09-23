/** Composants Gözlemevi v2 — les textes des nouveaux composants (docs/ui-v2/gozlemevi.md). */

/** B9 : maintenir pour envoyer. */
export const hold = {
  hint: 'Maintenez appuyé, ou appuyez deux fois sur Entrée pour confirmer',
  confirm: '{{label}} · sûr ?',
};

/** B12 : une file de production en anneaux. */
export const lane = {
  /** Une place vide dans la file. */
  free: '+ Place libre',
};

/** B1 : une jauge de ressource dans la barre du haut. */
export const meter = {
  /** Read by a screen reader: the stock against the store. */
  reading: '{{resource}} : {{value}} sur {{cap}}',
  /** The same, when the store is full. */
  full: '{{resource}} : {{value}} sur {{cap}}, entrepôt plein',
};

/** B5 : la règle des forces. */
export const ruler = {
  /** In place of the defence strip when nothing was ever measured. */
  unknown: 'Aucune sonde : leur défense est inconnue',
  /** The button that closes that gap. */
  probe: 'Envoyer une sonde',
};

/** La feuille v2 : sa poignée. */
export const handle = {
  /** Opens the sheet one height further. */
  expand: 'Agrandir',
  /** At the top: settles it one height lower. */
  collapse: 'Réduire',
};

/** B4 : le dock, cinq onglets dans un ordre fixe. */
export const dock = {
  /** The navigation landmark, for a screen reader. */
  label: 'Navigation principale',
  galaxy: 'Galaxie',
  base: 'Base',
  fleet: 'Flotte',
  intel: 'Renseignement',
  clan: 'Clan',
  /** The dot on Base, read aloud. */
  baseWaiting: 'Quelque chose à collecter ou à réparer',
  /** Beside the Fleet ring: your own craft in the air. */
  airborne: 'En vol : {{count}}',
  /** The count on Intel: reports you have not seen. */
  reports: 'Nouveaux rapports : {{count}}',
  /** The count on Clan. */
  attention: 'En attente de toi : {{count}}',
};

/** B2 : la ligne Maintenant, le minuteur qui compte le plus. */
export const now = {
  /** The line, for a screen reader. */
  label: 'Minuteur le plus urgent',
  /** The sheet one tap under it: every timer. */
  sheet: 'Minuteurs',
  work: 'Travaux bientôt finis',
  research: 'Recherche bientôt finie',
  event: 'Événement bientôt fini',
  shield: 'Ton bouclier tombe',
  shieldDetail: 'Ensuite, les raids peuvent t’atteindre',
  /** The clock time beside a countdown in the sheet. */
  at: 'à {{time}}',
};
