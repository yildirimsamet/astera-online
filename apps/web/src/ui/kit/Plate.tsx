import type { ReactNode } from 'react';

/**
 * PLATE — a surface that holds information.
 *
 * The base object of the whole interface. See `styles/chrome.css` for the material
 * and `docs/interface.md` I6 for when each of plate / slab / socket is the right
 * word. The component exists rather than a bare className so the two things that are
 * easy to get wrong stay in one place: which tone means what, and the fact that a
 * `cut` plate needs a shadow wrapper because `clip-path` clips `box-shadow`.
 */

/**
 * Tone is STATE, never decoration.
 *
 * A plate wearing anything but `neutral` is asserting that something is true right
 * now — you are threatened, a window is open, this is selected. If every plate glows
 * the player learns that glow means nothing, and the one surface that needed to shout
 * has no way left to do it.
 */
export type PlateTone = 'neutral' | 'lit' | 'threat' | 'opportunity' | 'alloy';

const TONE: Record<PlateTone, string> = {
  neutral: '',
  lit: 'plate-lit',
  threat: 'plate-threat',
  opportunity: 'plate-opportunity',
  alloy: 'plate-alloy',
};

export function Plate({
  children,
  tone = 'neutral',
  cut = false,
  sunk = false,
  flush = false,
  className = '',
  as: Tag = 'div',
}: {
  children?: ReactNode;
  tone?: PlateTone;
  /**
   * Sheared corners. An ACCENT — the directive, the commit surface, the active dock
   * plate. Never the default card shape: at list density the cuts turn into noise and
   * stop meaning anything.
   */
  cut?: boolean | 'sm' | 'lg';
  /** Recessed instead of raised: tracks, wells, inactive segments. */
  sunk?: boolean;
  /** No lift. For plates that fill the screen and have nothing to rise off. */
  flush?: boolean;
  className?: string;
  /** A closed set rather than `ElementType`: a plate is a container, never a control. */
  as?: 'div' | 'section' | 'article' | 'header' | 'footer' | 'li' | 'aside';
}) {
  const shape = cut === false ? 'plate' : `plate-cut${cut === 'sm' ? ' plate-cut-sm' : cut === 'lg' ? ' plate-cut-lg' : ''}`;

  const body = (
    <Tag
      className={`${shape} ${sunk ? 'plate-sunk' : ''} ${flush ? 'plate-flush' : ''} ${TONE[tone]} ${className}`}
    >
      {children}
    </Tag>
  );

  // `clip-path` clips `box-shadow`, so a cut plate can only get a shadow from a
  // `filter` on a wrapper — that follows the clipped silhouette. It is the one
  // `filter` in the system and it costs a raster layer, which is why cut plates are
  // rare and never appear inside a list.
  return cut === false ? body : <div className="cut-shadow">{body}</div>;
}
