import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * A bottom sheet — every decision in this game is made from one.
 *
 * Committing from the bottom of the screen keeps the target's information on
 * screen above it while the player chooses, which is the whole point: you decide
 * *while looking at what you know*, never on a separate page that made you
 * forget it.
 */
export function Sheet({
  title,
  eyebrow,
  onClose,
  children,
  footer,
  contained = false,
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Give the body a real height and let its child own scrolling. */
  contained?: boolean;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 animate-[fade-in_140ms_ease-out] bg-void/80"
      />
      {/*
        THE HEADER IS NOT PART OF THE SCROLL, and that is a structural fact rather
        than a z-index one.

        It used to be `sticky top-0` inside the scrolling dialog. So was the planet
        screen's own category bar, one layer higher — two elements pinned to the
        same edge of the same scroller, with the lower one winning on z-index. The
        categories slid straight over "YOUR PLANET" as soon as anything scrolled.

        Stacking order can be argued about forever; the honest answer is that the
        header does not scroll at all. The dialog is a column of three: a fixed
        head, a body that is the only thing that scrolls, and a fixed foot. Nothing
        inside the body can reach the header now, whatever it declares — and the
        category bar's own `sticky top-0` finally means "the top of the list",
        which is what it was always trying to say.
      */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        /**
         * `data-sheet-panel` is the sheet's own box, as opposed to the full-screen
         * scrim it floats on. Anything positioning ITSELF against an open sheet —
         * the onboarding card getting out of the way of what it is pointing at
         * (D56) — has to measure this and not the container, or it is told the
         * sheet fills the screen and gives up.
         */
        data-sheet-panel
        className={`panel relative flex animate-[sheet-in_180ms_ease-out] flex-col rounded-t-md border-x-0 border-b-0 border-t-line pb-[env(safe-area-inset-bottom)] ${contained ? 'h-[86dvh]' : 'max-h-[86dvh]'}`}
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-line-soft bg-panel/95 px-4 py-3">
          <div className="min-w-0 flex-1">
            {eyebrow && <p className="legend mb-1">{eyebrow}</p>}
            <h2 className="truncate font-display text-[19px] tracking-wide text-bone">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="btn px-3 py-1.5">
            {t('sheet.close')}
          </button>
        </div>
        {/* `min-h-0` is what actually lets a flex child scroll instead of growing. */}
        <div className={`min-h-0 flex-1 px-4 py-4 pt-0 ${contained ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-line-soft bg-panel/95 px-4 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}
