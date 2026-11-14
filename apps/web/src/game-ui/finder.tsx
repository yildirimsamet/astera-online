import type { ReactNode } from 'react';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';
import { Glyph, type GlyphId } from './icons.js';

/**
 * THE FINDER (G1-d2, 2026-11-14): what is out there in the galaxy, counted at a glance, and
 * the way to each of it. A count wears the colour of what it counts — ore the crystal blue,
 * pirates the enemy's red, wrecks the alloy, monuments the deuterium — with its mark and its
 * figure. The words are for the reader and on the head of the list a press drops.
 */
export type TallyPaint = 'self' | 'hostile' | 'warn' | 'alloy' | 'crystal' | 'deut';

/** A count of something out there; a press asks for the list of them. */
export function Tally({ glyph, paint, value, label, onPress, expanded = false, controls }: {
  glyph: GlyphId;
  paint: TallyPaint;
  value: string;
  /** What it counts, in words ("12 rocks"): the reader's name for it. */
  label: string;
  onPress?: () => void;
  expanded?: boolean;
  /** The list it opens, while it is open. */
  controls?: string;
}) {
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); onPress?.(); });
  const face = (
    <span className="gk-tally" data-paint={paint}>
      <span className="gk-tally__coin" aria-hidden="true"><Glyph id={glyph} /></span>
      <span className="gk-tally__value gk-display gk-num" aria-hidden="true">{value}</span>
      {onPress !== undefined && <span className="gk-tally__open" aria-hidden="true"><Glyph id="down" /></span>}
    </span>
  );
  if (onPress === undefined) return <span className="gk-tally-wrap"><span className="sr-only">{label}</span>{face}</span>;
  return (
    <button
      type="button"
      {...OWN_SOUND}
      className="gk-hit gk-tally-hit"
      aria-expanded={expanded}
      {...(controls === undefined ? {} : { 'aria-controls': controls })}
      onPointerDown={own.onPointerDown}
      onClick={own.onClick}
    >
      <span className="sr-only">{label}</span>
      {face}
    </button>
  );
}

/** The list a count drops: a cut plate under the counts, its head in the count's colour. */
export function DropPanel({ id, label, title, paint, children }: {
  id: string;
  /** The list's name for the reader. */
  label: string;
  title: string;
  paint: TallyPaint;
  /** `<li>` rows, and any group heads between them. */
  children: ReactNode;
}) {
  return (
    <div className="gk-drop gk-cut" data-paint={paint}>
      <p className="gk-label gk-drop__title" aria-hidden="true">{title}</p>
      <ul id={id} aria-label={label} className="gk-drop__list">{children}</ul>
    </div>
  );
}

/** A head between rows of a list ("Hard", "Easy"), in the colour of what it heads. */
export function DropGroup({ tone, children }: { tone: 'self' | 'hostile'; children: ReactNode }) {
  return <h3 className="gk-label gk-drop__group" data-tone={tone}>{children}</h3>;
}

/** One thing out there: its place in the list, its name and clause, the mark of where it flies. */
export function PickRow({ glyph, tone, index, title, detail, onPress }: {
  glyph: GlyphId;
  tone: 'self' | 'hostile';
  /** Its place ("05"): a monument's rank, or the order the list holds it in. */
  index: string;
  title: string;
  detail?: string;
  onPress: () => void;
}) {
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); onPress(); });
  return (
    <button type="button" {...OWN_SOUND} className="gk-pick" data-tone={tone} onPointerDown={own.onPointerDown} onClick={own.onClick}>
      <span className="gk-pick__index gk-display gk-num">{index}</span>
      <span className="gk-pick__text">
        <span className="gk-pick__title">{title}</span>
        {detail !== undefined && <span className="gk-sub">{detail}</span>}
      </span>
      <span className="gk-pick__mark" aria-hidden="true"><Glyph id={glyph} /></span>
    </button>
  );
}
