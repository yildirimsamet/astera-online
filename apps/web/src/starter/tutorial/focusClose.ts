/**
 * THE GUIDE PUTS A READ CARD AWAY (owner, phone playtest 2026-11-18, item 12). The first probe report is
 * read on the world's focus card; after Next it stayed open, and the player could not tell whether to
 * probe again, close it, or what. The galaxy lends the guide its own close, and Next on that line uses it,
 * so the next line speaks on a clear sky.
 */
let lent: (() => void) | null = null;

/** The galaxy's close, for as long as the galaxy is drawn; the returned call takes it back. */
export function lendFocusClose(close: () => void): () => void {
  lent = close;
  return () => { if (lent === close) lent = null; };
}

export function closeFocus(): void {
  lent?.();
}
