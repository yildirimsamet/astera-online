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
