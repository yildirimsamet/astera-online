import { LOGO } from './assets.js';

/**
 * THE NAME OF THE GAME, drawn once and used everywhere it appears.
 *
 * There are exactly two surfaces that state the identity — the front door and the
 * frame that covers every transition — and they must be the SAME object at the
 * same weight. They were two hand-set headings before, which is how a wordmark
 * drifts: one gets a tracking tweak and the loading screen stops looking like the
 * page it is loading.
 *
 * IT IS AN IMAGE, AND IT IS STILL A HEADING. The art is a painted lockup, so there
 * is no font that can set it; the `alt` carries the name, and the caller wraps this
 * in whatever heading level its page needs. A screen reader gets "Astera Online"
 * either way.
 *
 * `width` is the rendered width in CSS pixels. The file is 768 wide, so every use
 * here is a downscale — which is the right side to be on for a mark that has to
 * survive a 3× phone.
 */
export function Wordmark({ width, className }: { width: number; className?: string }) {
  return (
    <img
      src={LOGO.lockup}
      alt="Astera Online"
      width={width}
      /* Intrinsic 768 × 433. Stated as a ratio so the box is reserved before the
         bytes land and nothing below it jumps when they do. */
      height={Math.round((width * 433) / 768)}
      draggable={false}
      className={`h-auto max-w-full select-none ${className ?? ''}`}
    />
  );
}
