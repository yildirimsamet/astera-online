/** Gözlemevi v2 kiti — yeni bileşenlerin metinleri (docs/ui-v2/gozlemevi.md). */

/** B9: basılı tutarak gönder. */
export const hold = {
  hint: 'Basılı tut ya da onaylamak için iki kez Enter’a bas',
  confirm: '{{label}} · emin misin?',
};

/** B12: halka olarak çizilen kuyruk hattı. */
export const lane = {
  /** Hatta boş duran yer. */
  free: '+ Boş hat',
};

/** B1: üst çubuktaki kaynak ölçeri. */
export const meter = {
  /** Read by a screen reader: the stock against the store. */
  reading: '{{resource}}: {{value}} / {{cap}}',
  /** The same, when the store is full. */
  full: '{{resource}}: {{value}} / {{cap}}, depo dolu',
};

/** B5: güç cetveli. */
export const ruler = {
  /** In place of the defence strip when nothing was ever measured. */
  unknown: 'Sonda yok: savunma bilinmiyor',
  /** The button that closes that gap. */
  probe: 'Sonda gönder',
};
