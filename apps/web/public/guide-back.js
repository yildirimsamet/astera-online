/* global document, window */
/*
 * STEP BACK IF THERE IS SOMEWHERE TO STEP BACK TO, NAVIGATE IF THERE IS NOT.
 *
 * The menu links to the guide in this same tab, so the galaxy is one entry back
 * in this tab's own history — and going BACK is what lets the browser restore
 * the page it already has (bfcache) instead of booting a fresh 3D scene and
 * fetching the assets again. That is the whole reason this is not a plain link.
 *
 * The guard is the referrer: a reader who arrived cold — a shared link, a
 * bookmark, a search result — has no game behind them, and for them the
 * anchor's own href="/" is the right answer and this handler stands aside.
 *
 * FIRST-PARTY FILE RATHER THAN AN INLINE BLOCK, and that is not style. The
 * production `Content-Security-Policy` grants `script-src 'self'` and never
 * `'unsafe-inline'`, so the inline version this replaces was silently refused by
 * every browser that reached the deployed page: the button worked, and it worked
 * by doing the plain navigation the handler exists to avoid. A publisher page
 * that logs a CSP violation is also exactly what the H5 Games Ads review reads.
 */
(function () {
  var back = document.querySelector('.back');
  if (!back) return;
  back.addEventListener('click', function (event) {
    var cameFromTheGame =
      window.history.length > 1 &&
      document.referrer.startsWith(window.location.origin + '/');
    if (!cameFromTheGame) return;
    event.preventDefault();
    window.history.back();
  });
}());
