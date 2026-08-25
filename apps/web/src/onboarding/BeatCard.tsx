import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '../ui/kit/index.js';

/**
 * ONE BEAT, AS A CARD IN THE THUMB ZONE. D56.
 *
 * NOT A MODAL, AND THAT IS THE WHOLE DESIGN. A tutorial that covers the thing it
 * is talking about teaches nothing, and on a phone a dialog centred over a 3D disc
 * puts the text where the fingers are and the target where they are not. This sits
 * along the bottom edge, above the safe area, and NEVER blocks the surface behind
 * it — the disc stays live, the planet panel stays scrollable, and the tap that
 * finishes the beat lands on the real control.
 *
 * NO "NEXT" ON ANYTHING THAT CAN BE DONE. A beat with an achievable condition has
 * no control at all: the only way past it is the action, which is what stops this
 * being a slideshow somebody clicks through without reading. The two beats that
 * are genuinely just a sentence carry one, and say so by having one.
 *
 * THE WAY OUT IS PERMANENT. `Skip` and "I already have a commander" are on every
 * beat, because a returning player who lands on the front door and presses the
 * wrong button must never be held inside a tutorial (I5 — every surface has a
 * permanent way in; the same applies to out).
 */
export function BeatCard({
  title,
  line,
  action,
  onAction,
  onSkip,
  skipLabel,
  secondary,
  onSecondary,
  progress,
  nudge,
  place = 'bottom',
  concept,
}: {
  title: string;
  line: string;
  /** Present only on a beat with nothing to do but read it. */
  action?: string;
  onAction?: () => void;
  onSkip: () => void;
  skipLabel: string;
  secondary: string;
  onSecondary: () => void;
  /** Which beat this is, out of how many. */
  progress: { step: number; total: number };
  /**
   * Bumped whenever the gate refused a press.
   *
   * The card is where the answer is, so the card is what moves. A refusal that
   * did nothing at all reads as a dead control, and a stranger's first conclusion
   * about a dead control is that the game is broken.
   */
  nudge?: number;
  /**
   * Which edge to sit on.
   *
   * A coach mark that covers the thing it is pointing at is worse than none, and
   * the bottom edge is exactly where a mobile sheet puts its controls: the build
   * sheet's count picker sat underneath this card, so the player could be told to
   * buy two ships and then only be shown the button for one. The caller measures
   * the live target and sends the card to the other end.
   */
  place?: 'top' | 'bottom';
  /** The one systems map in the opening; shown once, never as permanent chrome. */
  concept?: { steps: readonly string[]; outcome: string };
}): ReactNode {
  /**
   * Publish this card's height so anything else that speaks from the bottom edge
   * can clear it. A toast landing across the middle of the instruction is the one
   * collision this layer can have, and it is measured rather than guessed because
   * the card's height changes with the length of the sentence.
   */
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const publish = (): void => {
      if (place === 'top') {
        document.documentElement.style.removeProperty('--toast-lift');
        return;
      }
      document.documentElement.style.setProperty(
        '--toast-lift',
        `${String(Math.round(el.getBoundingClientRect().height + 8))}px`,
      );
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--toast-lift');
    };
  }, [place]);

  return (
    <div
      /**
       * FIXED AND ABOVE THE SHEETS, NOT INSIDE THE GALAXY'S BOX.
       *
       * Every surface in this game opens as a `fixed inset-0 z-40` sheet over the
       * disc, so a card at `z-20` inside `<main>` is UNDERNEATH the planet panel —
       * which put "raise the Command Core first" behind the very screen it was
       * asking the player to work in. It was invisible for four of the nine beats
       * and the tests could not see it, because the text was in the DOM the whole
       * time. Photographing it is what found it.
       *
       * `z-50` is the layer that speaks over everything, shared with the toast. It
       * clears the in-flight strip rather than covering it: that strip is Design
       * Law #1 made visible, and the beat that ends with a fleet in the air is the
       * one moment it has something to say.
       */
      ref={box}
      className={`pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4 ${
        place === 'top'
          ? 'top-0 pt-[calc(8px+env(safe-area-inset-top))]'
          : 'bottom-0 pb-[calc(46px+env(safe-area-inset-bottom))]'
      }`}
      role="status"
      aria-live="polite"
      /**
       * The gate lets this through by name. D56.
       *
       * Whatever else a beat has locked, the card that is doing the instructing
       * stays live — its skip and its way to sign in are the difference between a
       * guided opening and a locked door.
       */
      data-beat-card
    >
      <div
        key={nudge}
        className="plate plate-cut plate-cut-sm pointer-events-auto w-full max-w-md p-4 motion-safe:animate-[nudge_360ms_ease-out]"
      >
        {/*
          A rank of pips rather than "3/9". The player is not tracking a count —
          what they need is the shape of the thing they agreed to, which is "short",
          and a number invites them to work out how much is left instead of doing
          the step in front of them.
        */}
        <div className="flex items-center gap-2" aria-hidden>
          {Array.from({ length: progress.total }, (_, i) => (
            <span
              key={i}
              className={`h-0.5 flex-1 rounded-full ${
                i <= progress.step ? 'bg-crystal' : 'bg-well'
              }`}
            />
          ))}
        </div>

        <p className="headline mt-3 leading-tight text-bone">
          {title}
        </p>
        <p className="mt-2 text-body leading-snug text-dim">{line}</p>

        {concept && (
          <div className="mt-4 border-y border-line-soft py-3" aria-label={concept.outcome}>
            <div className="grid grid-cols-4 gap-1">
              {concept.steps.map((label, index) => (
                <div key={label} className="relative min-w-0 text-center">
                  <span className="num block text-micro text-faint">0{index + 1}</span>
                  <span className="legend mt-1 block truncate text-bone">
                    {label}
                  </span>
                  {index < concept.steps.length - 1 && (
                    <span aria-hidden className="absolute -right-1 top-3 text-micro text-crystal/60">›</span>
                  )}
                </div>
              ))}
            </div>
            <p className="legend mt-2 text-center text-crystal">
              {concept.outcome}
            </p>
          </div>
        )}

        {action !== undefined && onAction && (
          <Button variant="primary" size="lg" full className="mt-4" onClick={onAction}>
            {action}
          </Button>
        )}

        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            className="text-label text-faint underline-offset-4 hover:underline"
            onClick={onSecondary}
          >
            {secondary}
          </button>
          <button
            type="button"
            className="text-label text-faint underline-offset-4 hover:underline"
            onClick={onSkip}
          >
            {skipLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
