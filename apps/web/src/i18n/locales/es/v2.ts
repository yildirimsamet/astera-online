/** Componentes Gözlemevi v2 — los textos de los nuevos componentes (docs/ui-v2/gozlemevi.md). */

/** B9: mantener pulsado para enviar. */
export const hold = {
  hint: 'Mantén pulsado o pulsa Intro dos veces para confirmar',
  confirm: '{{label}} · ¿seguro?',
};

/** B12: una cola de obra dibujada como anillos. */
export const lane = {
  /** Un hueco vacío en la cola. */
  free: '+ Hueco libre',
};

/** B1: un medidor de recurso en la barra superior. */
export const meter = {
  /** Read by a screen reader: the stock against the store. */
  reading: '{{resource}}: {{value}} de {{cap}}',
  /** The same, when the store is full. */
  full: '{{resource}}: {{value}} de {{cap}}, almacén lleno',
};

/** B5: la regla de fuerzas. */
export const ruler = {
  /** In place of the defence strip when nothing was ever measured. */
  unknown: 'Sin sonda: su defensa es desconocida',
  /** The button that closes that gap. */
  probe: 'Enviar una sonda',
};

/** La hoja v2: su asa. */
export const handle = {
  /** Opens the sheet one height further. */
  expand: 'Ampliar',
  /** At the top: settles it one height lower. */
  collapse: 'Reducir',
};

/** B4: el dock, cinco pestañas en un orden fijo. */
export const dock = {
  /** The navigation landmark, for a screen reader. */
  label: 'Navegación principal',
  galaxy: 'Galaxia',
  base: 'Base',
  fleet: 'Flota',
  intel: 'Inteligencia',
  clan: 'Clan',
  /** The dot on Base, read aloud. */
  baseWaiting: 'Algo que recoger o reparar',
  /** Beside the Fleet ring: your own craft in the air. */
  airborne: 'En vuelo: {{count}}',
  /** The count on Intel: reports you have not seen. */
  reports: 'Informes nuevos: {{count}}',
  /** The count on Clan. */
  attention: 'Esperándote: {{count}}',
};

/** B2: la línea Ahora, el temporizador que más importa. */
export const now = {
  /** The line, for a screen reader. */
  label: 'Temporizador más urgente',
  /** The sheet one tap under it: every timer. */
  sheet: 'Temporizadores',
  work: 'Obra a punto de terminar',
  research: 'Investigación a punto de terminar',
  event: 'El evento termina',
  shield: 'Tu escudo termina',
  shieldDetail: 'Después, los ataques pueden alcanzarte',
  /** The clock time beside a countdown in the sheet. */
  at: 'a las {{time}}',
};

/** K1: la hoja de la campana, tres pestañas. */
export const bell = {
  /** The tab list, for a screen reader. */
  label: 'Señales, crónica y chat',
  signals: 'Señales',
  chronicle: 'Crónica',
  chat: 'Chat',
  /** The dot on Chat, read aloud. */
  chatUnread: '{{count}} sin leer',
};
