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
