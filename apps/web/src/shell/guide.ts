/**
 * THE QUICK-START GUIDE, WHICH IS A FILE RATHER THAN A SCREEN.
 *
 * `apps/web/public/hizli-baslangic-rehberi.html` is a finished standalone page
 * with its own stylesheet. Vite copies `public/` into the build untouched and
 * Nginx serves the webroot flat, so it has been reachable at this address in dev
 * and in production all along — what it never had was a door.
 *
 * ONE STATEMENT OF THE ADDRESS. A static asset is invisible to the type system:
 * nothing connects the string in a component to the file on disk, and a rename
 * would produce a menu row that opens a 404 with nothing failing anywhere. The
 * constant is here so there is exactly one place to change, and `menu-guide`
 * asserts the file is really there.
 *
 * PROVISIONAL, and honestly so. The owner asked for the quick version — the page
 * is a separate document that does not share the game's type scale, tokens or
 * language switch. The proper version is a surface inside the interface that
 * reads the same i18n tree as everything else; until then this is a link out,
 * and it is drawn as one.
 */
export const GUIDE_URL = '/hizli-baslangic-rehberi.html';

/**
 * OPENED WITH ITS OPENER INTACT, and that is a deliberate reversal.
 *
 * `noopener` is the right default for a link that leaves your origin, and it was
 * what this used at first. It is the wrong default here, because it also makes
 * the new tab NOT SCRIPT-CLOSABLE — and the guide's sticky back control then has
 * only one move left, which is to NAVIGATE. On a phone that means tearing down a
 * perfectly good galaxy and reloading the 3D scene to return the player to a
 * screen that was still sitting untouched in the other tab.
 *
 * What `noopener` protects against is a page you do not control reaching back
 * into yours. This is a static file in our own `public/`, on our own origin,
 * with no third-party script on it. There is nothing here to protect against,
 * and closing the tab is strictly the better way home.
 */
export function openGuide(): void {
  window.open(GUIDE_URL, '_blank');
}
