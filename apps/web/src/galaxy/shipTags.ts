/** About the widest chip a hull tag draws ("kıvılcım atıyor" at 11 px), in CSS pixels. */
export const TAG_REACH = 90;
/** What a chip keeps clear of the screen's edge. */
const TAG_MARGIN = 8;

/**
 * Which way a hull tag's chip leads from its pin at screen `x`: its own way (`dx`), unless the chip
 * would leave the screen there, when it leads the other way. One standing above or below stays.
 */
export function tagLead(x: number, width: number, dx: number): number {
  if (dx < 0 && x + dx - TAG_REACH < TAG_MARGIN) return -dx;
  if (dx > 0 && x + dx + TAG_REACH > width - TAG_MARGIN) return -dx;
  return dx;
}
