/**
 * THE PAGE DOES NOT ZOOM. THE GALAXY DOES.
 *
 * A pinch is a game control here: the disc is a live 3D scene and `OrbitControls`
 * owns every gesture over the canvas, which is why that element carries
 * `touch-action: none` (`galaxy/GalaxyCanvas.tsx`). Everything AROUND it — the
 * resource header, the works, the in-flight strip, every sheet — is fixed chrome
 * sized to the viewport, and browser zoom does not scale it so much as break it:
 * the header slides off the top, the strip leaves the bottom edge, and the disc
 * ends up windowed inside a page that is now larger than the screen.
 *
 * So the page refuses the pinch GESTURE, and it takes three mechanisms because no
 * single one covers every browser:
 *
 *   · `touch-action: pan-x pan-y` on the root (`styles.css`) — the standards-based
 *     answer. It leaves panning and scrolling alone while removing pinch-zoom AND
 *     double-tap-to-zoom, and it is what actually works on iOS. A descendant may
 *     still ask for `none`, which is more restrictive, so the canvas is unaffected.
 *   · `gesturestart` / `gesturechange` / `gestureend` — Safari's own non-standard
 *     pinch events, and the last route left on an installed home-screen app.
 *   · `wheel` with `ctrlKey` — how every browser reports a trackpad pinch and a
 *     ctrl-scroll. Only that combination is refused; an ordinary wheel still
 *     scrolls, and the canvas still dollies.
 *
 * WHAT IS DELIBERATELY LEFT ALONE: the CAPABILITY to magnify. Locking the scale in
 * the viewport meta would have been the shortest route and it is the wrong one —
 * it removes zoom altogether on the browsers that honour it, and
 * `test/interface-accessibility.test.tsx` had already forbidden those flags under
 * `mobile access` before the pinch was ever a problem. Safari's Aa menu, keyboard
 * zoom and OS-level magnification all still work. What is refused is the
 * two-finger gesture that fires by accident on a game played with two thumbs.
 */
export function lockViewportZoom(): () => void {
  const refuse = (event: Event): void => {
    event.preventDefault();
  };

  const refusePinch = (event: WheelEvent): void => {
    // Not `deltaMode` or magnitude: a trackpad pinch and a ctrl-scroll are the
    // same event, and the flag is the only thing that separates either from an
    // ordinary scroll the page still needs.
    if (event.ctrlKey) event.preventDefault();
  };

  // Safari fires these on the document; they are not in any standard, so they are
  // registered by name rather than through a typed map.
  const GESTURES = ['gesturestart', 'gesturechange', 'gestureend'] as const;
  for (const type of GESTURES) document.addEventListener(type, refuse, { passive: false });
  window.addEventListener('wheel', refusePinch, { passive: false });

  return () => {
    for (const type of GESTURES) document.removeEventListener(type, refuse);
    window.removeEventListener('wheel', refusePinch);
  };
}
