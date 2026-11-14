import type { ReactNode } from 'react';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';
import { Glyph, type GlyphId } from './icons.js';
import { Dot } from './readouts.js';

/**
 * THE MENU'S ONE KIND OF THING (G1-f2, 2026-11-14): every place the commander's menu opens is a
 * tile — a cut plate with the place's own picture behind it, its mark on a coin, its name. News
 * behind it is a red count; a word of warning a chip; a wide tile says its state in a line. The
 * reader hears the name and what is behind it (`hint`), which the picture says to the eye.
 */
export type TileTone = 'steel' | 'premium' | 'self' | 'warn';

export function MenuTile({ tile, glyph, label, hint, art, artAt, news, badge, status, tone = 'steel', wide = false, onPress }: {
  /** Which place: `data-tile`, for a lesson, a test or focus coming back to it. */
  tile: string;
  glyph: GlyphId;
  label: string;
  /** What is behind it, for a reader. */
  hint: string;
  /** The place's picture, and where in it to look. */
  art?: string;
  artAt?: string;
  /** News behind it: the red count, and its words for a reader. Nothing at zero. */
  news?: { count: number; said: string };
  /** A word of warning on the tile ("Wallet empty"). */
  badge?: string;
  /** A wide tile's line: where the place stands. It stands in for the hint. */
  status?: string;
  tone?: TileTone;
  /** Across the row: a call to act, or a place that says its state. */
  wide?: boolean;
  onPress: () => void;
}) {
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); onPress(); });
  const fresh = news !== undefined && news.count > 0 ? news : null;
  const name = [label, status ?? hint, fresh?.said, badge].filter((part): part is string => part !== undefined).join('. ');
  return (
    <button
      type="button"
      {...OWN_SOUND}
      aria-label={name}
      className="gk-mtile gk-cut"
      data-tile={tile}
      data-tone={tone}
      {...(wide ? { 'data-wide': '' } : {})}
      onPointerDown={own.onPointerDown}
      onClick={own.onClick}
    >
      {art !== undefined && <img className="gk-mtile__art" src={art} alt="" draggable={false} style={artAt === undefined ? undefined : { objectPosition: artAt }} />}
      <span className="gk-mtile__coin" aria-hidden="true"><Glyph id={glyph} /></span>
      <span className="gk-mtile__text">
        <span className="gk-mtile__label">{label}</span>
        {status !== undefined && <span className="gk-mtile__status">{status}</span>}
      </span>
      {fresh !== null && <span className="gk-mtile__news" aria-hidden="true"><Dot count={fresh.count} /></span>}
      {fresh !== null && <span className="sr-only">{fresh.said}</span>}
      {badge !== undefined && <span className="gk-mtile__chip">{badge}</span>}
    </button>
  );
}

/** Tiles two by two; an odd last one goes across the row rather than leave half of it empty. */
export function TileGrid({ label, children }: { label?: string; children: ReactNode }) {
  return <div role="group" className="gk-tiles" {...(label === undefined ? {} : { 'aria-label': label })}>{children}</div>;
}
