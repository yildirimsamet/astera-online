/* global document, window, screen, getComputedStyle */
/*
 * iPhone home-screen probe (players' report 2026-11-19): prints the numbers the dock and top-bar fix
 * depends on. Installed twice by a tester (ios-probe.html / ios-probe-black.html). See test/ios-probe.test.ts.
 */

/** @param {string} unit */
function unitHeight(unit) {
  const element = document.querySelector(`[data-unit="${unit}"]`);
  return element ? Math.round(element.getBoundingClientRect().height) : 0;
}

function drawRuler() {
  const ruler = document.querySelector('[data-ruler]');
  if (!ruler || ruler.childElementCount > 0) return;
  for (let y = 0; y <= 120; y += 10) {
    const tick = document.createElement('div');
    tick.className = 'tick';
    tick.style.top = `${String(y)}px`;
    tick.textContent = String(y);
    ruler.appendChild(tick);
  }
}

export function renderReadings() {
  document.documentElement.style.setProperty('--inner', `${String(window.innerHeight)}px`);
  const safe = document.querySelector('[data-safe]');
  const style = safe ? getComputedStyle(safe) : null;
  const viewport = window.visualViewport;
  const ios = /OS (\d+)_(\d+)(?:_(\d+))?/u.exec(navigator.userAgent);
  const standalone = 'standalone' in navigator && navigator.standalone === true;
  const displayMode = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  const bar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.getAttribute('content') ?? '?';
  const lines = [
    `screen: ${String(screen.width)} x ${String(screen.height)}  (dpr ${String(window.devicePixelRatio)})`,
    `innerHeight: ${String(window.innerHeight)}  innerWidth: ${String(window.innerWidth)}`,
    `visualViewport: ${viewport ? `${String(Math.round(viewport.width))} x ${String(Math.round(viewport.height))}  offsetTop ${String(Math.round(viewport.offsetTop))}` : 'yok'}`,
    `clientHeight: ${String(document.documentElement.clientHeight)}`,
    `dvh: ${String(unitHeight('dvh'))}  svh: ${String(unitHeight('svh'))}  lvh: ${String(unitHeight('lvh'))}`,
    `safe-area top: ${style?.paddingTop ?? '?'}  safe-area bottom: ${style?.paddingBottom ?? '?'}`,
    `standalone: ${String(standalone)}  display-mode: ${displayMode ? 'standalone' : 'browser'}`,
    `status bar: ${bar}`,
    `iOS: ${ios ? [ios[1], ios[2], ios[3]].filter(Boolean).join('.') : 'bilinmiyor'}`,
    '',
    'Pembe: web katmanı, hiçbir kutu yok. Siyah ya da başka renk: iOS’un kendi alanı.',
    'Kesikli beyaz çizgi: alt güvenli alan sınırı.',
  ];
  const panel = document.querySelector('[data-readings]');
  if (panel) panel.textContent = lines.join('\n');
}

if (document.querySelector('[data-readings]')) {
  drawRuler();
  renderReadings();
  window.addEventListener('resize', renderReadings);
  window.addEventListener('orientationchange', renderReadings);
  window.visualViewport?.addEventListener('resize', renderReadings);
  setTimeout(renderReadings, 500);
}
