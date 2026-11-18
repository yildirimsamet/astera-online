import { useEffect } from 'react';

/*
  THE HEIGHT THE GAME HAS ON SCREEN (owner phone playtest 2026-11-18, item 23). In a phone browser the
  foot of the game sometimes lay under the browser's bottom bar, out of reach: the page had taken the
  height it would have with the bars hidden. The window's inner height is the page's real height, so it
  is kept on the root as `--app-h`, and every full screen is drawn in it (`h-dvh` reads it, `100dvh`
  only stands in before it is known).
*/
export function watchAppHeight(win: Window = window): () => void {
  const root = win.document.documentElement;
  const write = (): void => { root.style.setProperty('--app-h', `${String(win.innerHeight)}px`); };
  write();
  const events = ['resize', 'orientationchange', 'pageshow'] as const;
  for (const event of events) win.addEventListener(event, write);
  win.visualViewport?.addEventListener('resize', write);
  return () => {
    for (const event of events) win.removeEventListener(event, write);
    win.visualViewport?.removeEventListener('resize', write);
    root.style.removeProperty('--app-h');
  };
}

let screens = 0;

/** While a game screen is up the page itself never scrolls, so the browser's bars never slide away and back. */
export function useAppScreen(): void {
  useEffect(() => {
    const root = document.documentElement;
    screens += 1;
    root.setAttribute('data-app-screen', '');
    return () => {
      screens -= 1;
      if (screens === 0) root.removeAttribute('data-app-screen');
    };
  }, []);
}
