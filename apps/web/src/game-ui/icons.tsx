import type { ReactElement } from 'react';

/**
 * THE KIT'S GLYPHS: filled shapes with a dark outline, the way a game draws a control
 * icon, so they read at 16 px on a lit button. Painted art (ships, buildings,
 * resources) stays the picture; these are only the verbs and marks around it.
 * Shapes are drawn on a 24 grid; `evenodd` cuts the details out of the fill.
 */
const PATHS = {
  close: 'M6.2 3.9 12 9.7l5.8-5.8 2.3 2.3-5.8 5.8 5.8 5.8-2.3 2.3-5.8-5.8-5.8 5.8-2.3-2.3 5.8-5.8-5.8-5.8z',
  plus: 'M10 3.5h4v6.5h6.5v4H14v6.5h-4V14H3.5v-4H10z',
  minus: 'M3.5 10h17v4h-17z',
  back: 'M15.6 3.2 18.4 6l-6 6 6 6-2.8 2.8L6.8 12z',
  next: 'M8.4 3.2 5.6 6l6 6-6 6 2.8 2.8 8.8-8.8z',
  lock: 'M7 10V8a5 5 0 0 1 10 0v2h1.2c.8 0 1.5.7 1.5 1.5v8c0 .8-.7 1.5-1.5 1.5H5.8c-.8 0-1.5-.7-1.5-1.5v-8c0-.8.7-1.5 1.5-1.5zm3 0h4V8a2 2 0 0 0-4 0zm2 3.4a1.6 1.6 0 0 0-.8 3v2.1h1.6v-2.1a1.6 1.6 0 0 0-.8-3z',
  home: 'M12 2.8 1.8 11.2l1.5 1.8L5 11.6V21h5.2v-6h3.6v6H19v-9.4l1.7 1.4 1.5-1.8z',
  clock: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1.4 4.4v6.6l5.3 3.2 1.4-2.3-3.9-2.3V6.4z',
  shield: 'M12 1.8 3.8 5v6.3c0 5.1 3.5 9.3 8.2 10.9 4.7-1.6 8.2-5.8 8.2-10.9V5zm0 3.5 4.8 1.9v4.1c0 3.2-2 6-4.8 7.3z',
  rocket: 'M12 1.6c3.4 2.2 5.2 5.9 5.2 10V15l2.6 2.6v3.8l-4.4-1.9H8.6l-4.4 1.9v-3.8L6.8 15v-3.4c0-4.1 1.8-7.8 5.2-10zm0 6.3a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2zM10 20.6h4L12 23z',
  crate: 'M2.5 4h19v4.2h-19zm1 5.7h17V20h-17zm5.5 2v2.6h6v-2.6z',
  bay: 'M3 5h4.4v14H3zm6.8 0h4.4v14H9.8zm6.8 0H21v14h-4.4z',
  bell: 'M12 1.8c.9 0 1.6.7 1.6 1.6v.7A6.2 6.2 0 0 1 18.3 10v4.4l2.2 2.8v1.4h-17v-1.4l2.2-2.8V10a6.2 6.2 0 0 1 4.7-5.9v-.7c0-.9.7-1.6 1.6-1.6zm-2.6 18h5.2a2.6 2.6 0 0 1-5.2 0z',
  menu: 'M3 4.6h18V8H3zm0 5.7h18v3.4H3zm0 5.7h18v3.4H3z',
  back_home: 'M9.4 3.4 3 9.6l6.4 6.2v-3.9h5.8a3.2 3.2 0 0 1 0 6.4H12V22h3.2a6.6 6.6 0 0 0 0-13.2H9.4z',
  attack: 'M20.8 1.8 22.2 3.2 12.6 14.4l1.9 1.9-1.8 1.8-1.9-1.9-3.4 3.4.4 1.8-1.8 1.8L2 19.3l1.8-1.8 1.8.4L9 14.5l-1.9-1.9 1.8-1.8 1.9 1.9z',
  check: 'M9.4 15.6 4.9 11.1 2.4 13.6l7 7L21.6 8.4 19.1 5.9z',
  warn: 'M12 1.9 1 21.4h22zm-1.5 6.4h3l-.5 6.9h-2zm1.5 8.2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z',
  star: 'M12 1.9l3.1 6.4 7 .9-5.2 4.8 1.4 7L12 17.5 5.7 21l1.4-7L1.9 9.2l7-.9z',
  help: 'M12 1.8a10.2 10.2 0 1 1 0 20.4 10.2 10.2 0 0 1 0-20.4zm0 15a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zm.1-11.2c-2.4 0-4.2 1.3-4.5 3.5l2.8.6c.1-.9.7-1.5 1.6-1.5.8 0 1.4.5 1.4 1.3 0 1.5-2.9 1.9-2.9 4.2v1.1h2.9v-.6c0-1.6 2.9-2 2.9-4.6 0-2.4-1.8-4-4.2-4z',
  up: 'M12 3.5 21.5 19h-19z',
  down: 'M12 20.5 2.5 5h19z',
  speed: 'M12 3.4a10 10 0 0 1 10 10c0 2.2-.7 4.2-1.9 5.8H3.9A9.9 9.9 0 0 1 2 13.4a10 10 0 0 1 10-10zm4.9 3.9-6.2 4.6a1.9 1.9 0 1 0 2.6 2.6z',
} as const;

export type GlyphId = keyof typeof PATHS;

export function Glyph({ id, className = 'gk-glyph' }: { id: GlyphId; className?: string }): ReactElement {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d={PATHS[id]} fillRule="evenodd" />
    </svg>
  );
}
