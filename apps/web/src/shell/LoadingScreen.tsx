import { Wordmark } from '../ui/Wordmark.jsx';

/**
 * THE WAIT, MADE PART OF THE GAME.
 *
 * This replaces two things. The bare `Making contact` line that stood in for every
 * session transition, and — more importantly — the "While you were gone" overlay
 * (D23), which threw a full-screen modal in the player's face every time a phone
 * browser reloaded the tab in the background. That overlay was answering a real
 * question, but it was answering it as an interruption, at the one moment a player
 * had just chosen to come back and wanted to be IN the game.
 *
 * What is here instead is the last thing between a player and the disc, so it has
 * one job: hold the frame with something that looks like the game rather than like
 * a page that has not finished. Three parts, no more.
 *
 *   THE MARK. The same `Wordmark` the front door hangs, at a smaller width, so the
 *   loading frame and the landing page read as one surface rather than as two
 *   screens that happen to follow each other.
 *
 *   THE INSTRUMENT. A dish sweeping an arc — the same object the Signals beacon
 *   draws, moving. It is the one piece of motion, and it is doing the thing the
 *   caption says: listening. Pure SVG and two CSS animations, because this frame
 *   exists precisely when WebGL has not come up yet and must never wait on it.
 *
 *   THE MEASURE. A rail that fills with a real fraction where one is known, and
 *   travels as an indeterminate sweep where it is not. It never fakes a number.
 *
 * `prefers-reduced-motion` is handled globally in `styles.css`, which flattens
 * every animation here to a still frame that still reads correctly.
 */
export function LoadingScreen({
  caption,
  progress,
}: {
  /** What is actually being waited on, in the game's voice. Never a lie. */
  caption: string;
  /**
   * 0 to 1 where the wait is measurable, omitted where it is not.
   *
   * A determinate bar is worth a great deal and a fabricated one is worth less
   * than nothing, so there is no default: a caller that does not know says so by
   * leaving this out, and gets a sweep.
   */
  progress?: number;
}) {
  const known = progress !== undefined;
  const pct = Math.round(Math.min(1, Math.max(0, progress ?? 0)) * 100);

  return (
    <main
      /**
       * THE COVER IS THE TOPMOST THING IN THE APP.
       *
       * It shared `z-50` with the toast and with the onboarding's beat card, and
       * DOM order decided the rest — so a card written later in the tree painted
       * over a screen whose entire job is to be the only thing visible. A layer
       * that must cover everything cannot be on the same rung as the things it
       * covers.
       */
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden bg-void px-8"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* The same ground the body paints, so nothing flashes on the handover. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 55% at 50% -10%, #0e1830 0%, transparent 60%),' +
            'radial-gradient(90% 40% at 50% 105%, #0b1322 0%, transparent 70%)',
        }}
      />

      <div className="relative flex w-full max-w-xs flex-col items-center">
        <Dish />

        <h1 className="mt-8">
          <Wordmark width={200} />
        </h1>

        <p className="legend mt-3 text-center">{caption}</p>

        {/* The rail. Thin, full width of the column, and the only bright thing. */}
        <div
          className="relative mt-6 h-px w-full overflow-hidden bg-line-soft"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          {...(known ? { 'aria-valuenow': pct } : {})}
        >
          {known ? (
            <span
              className="absolute inset-y-0 left-0 bg-crystal transition-[width] duration-300 ease-out"
              style={{
                width: `${String(pct)}%`,
                boxShadow: '0 0 8px rgb(89 200 255 / 70%)',
              }}
            />
          ) : (
            <span
              className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-crystal to-transparent motion-safe:animate-[shimmer_1400ms_ease-in-out_infinite]"
              style={{ boxShadow: '0 0 8px rgb(89 200 255 / 50%)' }}
            />
          )}
        </div>

        {known && (
          <p className="num mt-2 text-[11px] tabular-nums text-faint">{pct}%</p>
        )}
      </div>
    </main>
  );
}

/**
 * A dish, sweeping.
 *
 * Two arcs at different radii on the same slow rotation, with the outer one
 * fading — so it reads as a beam going out and coming back rather than as a wheel
 * turning. The still frame, for anyone who has asked for no motion, is a dish with
 * two range rings, which is the correct picture either way.
 */
function Dish() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="size-16 text-crystal"
      fill="none"
      stroke="currentColor"
      aria-hidden
    >
      <g className="origin-center motion-safe:animate-[spin_3600ms_linear_infinite]">
        <path
          d="M32 32 L32 6"
          strokeWidth="1"
          strokeLinecap="round"
          strokeOpacity="0.55"
        />
        <path
          d="M20 9.5 A26 26 0 0 1 44 9.5"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.9"
        />
      </g>

      <circle cx="32" cy="32" r="26" strokeWidth="1" strokeOpacity="0.12" />
      <circle cx="32" cy="32" r="16" strokeWidth="1" strokeOpacity="0.18" />
      <circle
        cx="32"
        cy="32"
        r="3"
        fill="currentColor"
        stroke="none"
        className="motion-safe:animate-pulse"
      />
    </svg>
  );
}
