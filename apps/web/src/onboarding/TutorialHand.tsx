import { useEffect, useRef, type RefObject } from 'react';

/** D172. The supplied hand follows the final (action) target. No scrim, hitbox
 * or frame-rate React state: scrolling remains available to the player.
 */
export function TutorialHand({ targets, bubble, kind = 'action' }: {
  targets: () => readonly Element[];
  bubble?: RefObject<HTMLElement | null>;
  kind?: 'action' | 'intro';
}) {
  const ref = useRef<HTMLDivElement>(null);
  /** The last control this hand pulled into view. One scroll per target, ever. */
  const reached = useRef<Element | null>(null);
  useEffect(() => {
    let frame = 0;
    const paint = () => {
      const hand = ref.current;
      const found = document.querySelector('[data-loading-screen]') ? [] : targets();
      const box = found[found.length - 1]?.getBoundingClientRect();

      /**
       * BRING THE TARGET INTO THE SHEET'S VIEW. Owner instruction.
       *
       * The launch picker is taller than a phone, so the Max button the hand is
       * pointing at is regularly below the fold. The hand hides itself when that
       * happens, which is honest and useless on its own — the card then asks the
       * commander to press something with nothing on screen to press.
       *
       * ONCE PER TARGET, the same rule `useScrollIntoView` keeps for a beat. The
       * hand walks Max to Max to Commit and each new control earns one scroll;
       * the same one never earns a second, because a player who scrolled away to
       * read the fuel line did it on purpose.
       */
      const subject = found[found.length - 1] ?? null;
      if (subject !== reached.current) {
        reached.current = subject;
        if (box && (box.bottom > window.innerHeight || box.top < 0)) {
          subject?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }
      // The hand points at Claim, but the coach must clear the card's title too.
      const rewardBox = found[found.length - 1]?.closest('[data-reward-claim]')?.closest('li.plate')?.getBoundingClientRect();
      const coachBox = rewardBox ?? box;
      const card = bubble?.current;
      // Read before writing styles: a second layout flush on every frame competes
      // with the opening WebGL flight. The planet also needs more breathing room.
      const placeCard = card && !card.contains(found[found.length - 1] ?? null);
      const height = placeCard ? card.getBoundingClientRect().height : 0;
      const gap = found[found.length - 1]?.hasAttribute('data-academy-home') ? 48 : 16;
      if (hand) {
        const visible = box && box.width > 0 && box.height > 0 &&
          box.right > 0 && box.bottom > 0 && box.left < window.innerWidth && box.top < window.innerHeight;
        const openingReady = found[found.length - 1]?.getAttribute('data-academy-home-ready') !== 'false';
        hand.style.visibility = visible && openingReady ? 'visible' : 'hidden';
        if (visible) {
          const x = kind === 'intro' ? box.left : Math.max(0, Math.min(window.innerWidth - 48, box.right - 12));
          const y = kind === 'intro' ? box.top : Math.max(0, Math.min(window.innerHeight - 48, box.top + box.height / 2));
          hand.style.transform = `translate3d(${String(x)}px, ${String(y)}px, 0)`;
          hand.style.width = kind === 'intro' ? `${String(box.width)}px` : '48px';
          hand.style.height = kind === 'intro' ? `${String(box.height)}px` : '48px';
          if (placeCard && coachBox) {
            const above = coachBox.top - height - gap;
            const below = coachBox.bottom + 16;
            /**
             * A SHEET OWNS THE BOTTOM, SO THE CARD OWNS THE TOP. Owner report.
             *
             * In the launch lessons the hand points near the FOOT of a tall sheet
             * — Max on the last row, then Commit — and "above the target" had
             * hundreds of pixels of room there. It used them: the card landed on
             * the ship picker, so the commander was told to choose a fleet by a
             * card sitting on top of the fleet.
             *
             * Inside a sheet there is no good float. The card goes to the top and
             * stays there while the sheet is up, which also stops it hopping from
             * row to row as the hand walks the Max buttons.
             */
            const inSheet = found[found.length - 1]?.closest('[data-sheet-panel]') != null;
            const top = inSheet ? 8
              : above >= 8 ? above : below + height <= window.innerHeight - 8 ? below : 8;
            const value = `${String(top)}px`;
            if (card.style.top !== value) card.style.top = value;
          }
        } else if (bubble?.current) {
          bubble.current.style.top = '8px';
        }
      }
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => { cancelAnimationFrame(frame); };
  }, [targets, bubble, kind]);
  if (kind === 'intro') return <div ref={ref} data-tutorial-intro aria-hidden="true"
    className="pointer-events-none fixed left-0 top-0 z-[60] rounded-control border border-crystal"
    style={{ visibility: 'hidden' }} />;
  return <div ref={ref} aria-hidden="true"
    className="pointer-events-none fixed left-0 top-0 z-[60] size-12 select-none"
    style={{ visibility: 'hidden' }}>
    <style>{`
      @keyframes academy-tap {0%,65%,100%{transform:translate(4px,4px) scale(1)} 20%,35%{transform:translate(0,0) scale(.9)}}
      @keyframes academy-ripple {0%,15%{transform:scale(.2);opacity:0} 25%{opacity:.7} 70%,100%{transform:scale(2.4);opacity:0}}
    `}</style>
    <span data-tap-ripple className="absolute -left-2 -top-2 size-5 rounded-full border border-crystal animate-[academy-ripple_1600ms_ease-out_infinite]" />
    <span data-tap-ripple className="absolute -left-2 -top-2 size-5 rounded-full border border-crystal animate-[academy-ripple_1600ms_200ms_ease-out_infinite]" />
    <img
    src="/assets/images/general/tutorial-hand-icon.png"
    alt=""
    aria-hidden="true"
    width={48}
    height={48}
    draggable={false}
    className="pointer-events-none relative z-10 select-none animate-[academy-tap_1600ms_ease-in-out_infinite]"
  /></div>;
}
