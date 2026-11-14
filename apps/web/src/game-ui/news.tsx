import { useId, type ReactNode } from 'react';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';
import { Glyph, type GlyphId } from './icons.js';

/**
 * THE NEWS (G1-e, 2026-11-14): what happened while the player was away, one row each. The coin
 * is in the colour of what kind of news it is — an enemy's red, a gain's green, a watch's amber,
 * the galaxy's blue — and carries the mark of what happened. The row's ground says whether it
 * went the player's way; a new row is lit. Its press opens what it is about.
 */
export type NewsTone = 'hostile' | 'good' | 'warn' | 'info' | 'alloy' | 'crystal' | 'steel';

/** How the news went for the reader: the ground the row lies on. Neutral has none. */
export type NewsOutcome = 'win' | 'partial' | 'loss' | 'neutral';

export function NewsRow({ glyph, tone, outcome = 'neutral', fresh = false, banner, age, open, tool, children }: {
  glyph: GlyphId;
  tone: NewsTone;
  outcome?: NewsOutcome;
  /** New in this reading: the coin is bright and a dot sits in the corner. */
  fresh?: boolean;
  /** A row about everyone, not the reader ("Galaxy event"): said above the sentence. */
  banner?: string;
  /** How long ago ("35 min ago"). */
  age?: string;
  /** What a press on the row opens, and its name for a reader. */
  open?: { label: string; onPress: () => void };
  /** A round press of its own at the row's end (fly to whoever it names). */
  tool?: ReactNode;
  /** The sentence. */
  children: ReactNode;
}) {
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); open?.onPress(); });
  return (
    <div
      className="gk-news"
      data-tone={tone}
      {...(outcome === 'neutral' ? {} : { 'data-outcome': outcome })}
      {...(fresh ? { 'data-fresh': '' } : {})}
      {...(banner === undefined ? {} : { 'data-banner': '' })}
    >
      {open !== undefined && (
        <button type="button" {...OWN_SOUND} aria-label={open.label} className="gk-news__open" onPointerDown={own.onPointerDown} onClick={own.onClick} />
      )}
      <span className="gk-news__coin" data-glyph={glyph} aria-hidden="true">
        <Glyph id={glyph} />
        {fresh && <span data-unread="" className="gk-news__dot" />}
      </span>
      <span className="gk-news__text">
        {banner !== undefined && <span className="gk-label gk-news__banner">{banner}</span>}
        <span className="gk-news__line">{children}</span>
        {age !== undefined && <span className="gk-sub gk-num">{age}</span>}
      </span>
      {tool !== undefined && <span className="gk-news__tool">{tool}</span>}
    </div>
  );
}

/** Rows of news on one plate, under a head of what they are — or named only for the reader. */
export function NewsList({ title, label, children }: (
  { title: string; label?: never } | { label: string; title?: never }
) & {
  /** `<li>` rows. */
  children: ReactNode;
}) {
  const head = useId();
  return (
    <section className="gk-newslist">
      {title !== undefined && <h3 id={head} className="gk-label gk-newslist__head">{title}</h3>}
      <ul className="gk-newslist__rows gk-cut" {...(title === undefined ? { 'aria-label': label } : { 'aria-labelledby': head })}>
        {children}
      </ul>
    </section>
  );
}
