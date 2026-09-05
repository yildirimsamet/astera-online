import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from './Button.js';
import { useOwnPress } from './useOwnPress.js';
import { CloseIcon } from '../icons/index.js';

/**
 * SHEET — the surface a decision is made on.
 *
 * `docs/interface.md` I3: every item has a detail sheet and the sheet is the commit
 * surface. Committing from the bottom of the screen keeps what you are deciding
 * about on screen ABOVE it while you choose — you decide while looking at what you
 * know, never on a separate page that made you forget it. Since I5 the thing above
 * is the live galaxy, so the scrim is a tint rather than paint.
 *
 * THERE WERE TWO OF THESE AND THE UNUSED ONE WAS THE BETTER-DRESSED ONE. A kit
 * sheet with a spring entrance, a grab handle and a glyph close sat at zero
 * imports while all nine real sheets used a legacy panel whose entrance animation
 * pointed at a keyframe that does not exist (`animate-[sheet-in_…]`, never
 * defined) and whose `sheet-premium` class had no rule behind it. So every
 * decision surface in the game arrived as a jump cut, and the fix had been
 * written and left on a shelf.
 *
 * This is the merge, and it keeps what the shipping one got right:
 *
 *   · THREE FIXED ROWS. A head that does not scroll, a body that is the only
 *     scroller, a foot that does not scroll. The head used to be `sticky top-0`
 *     inside the scroller, and so was the planet screen's category bar one layer
 *     up — two things pinned to the same edge, and the categories slid over the
 *     title. Structure settles that argument; z-index never does.
 *   · `data-sheet-panel`, which is how the onboarding card (D56) measures the
 *     sheet's own box rather than the full-screen scrim it floats on.
 *
 * And it fixes what neither got right: WHO OWNS THE HORIZONTAL PADDING. The body
 * pads its children by default; `bleed` hands that job to the caller. Before this
 * the planet screen was padded by the sheet, un-padded by a `-mx-4` wrapper in
 * `GalaxyView`, and re-padded by its own root — three declarations, net zero, and
 * no single owner to change.
 */
export function Sheet({
  title,
  eyebrow,
  onClose,
  children,
  footer,
  contained = false,
  bleed = false,
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Give the body a real height and let its child own scrolling. */
  contained?: boolean;
  /**
   * Drop the body's own padding, because the content runs edge to edge — a
   * portrait, full-bleed rows, a list with its own dividers. The caller then owns
   * every inset inside it, and there is exactly one owner.
   *
   * This replaces fourteen negative margins. A `-mx-4` is never a layout choice;
   * it is a note saying the padding was applied one level too high.
   */
  bleed?: boolean;
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

  /**
   * THE SCRIM ONLY ANSWERS A GESTURE THAT BEGAN ON IT. D109a.
   *
   * Tapping a world opened this sheet and it shut itself again — the tap's click
   * is dispatched after the sheet has mounted, so it lands on the scrim now under
   * the finger. `useOwnPress` carries the reasoning and the keyboard exemption.
   */
  const dismiss = useOwnPress(onClose);

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        {...dismiss}
        className="absolute inset-0 animate-[fade-in_200ms_var(--ease-hardware)] bg-void/80"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-sheet-panel
        className={`plate plate-flush relative flex animate-[sheet-in_340ms_var(--ease-hardware)] flex-col overflow-hidden rounded-b-none rounded-t-sheet pb-[env(safe-area-inset-bottom)] ${
          contained ? 'h-[88dvh]' : 'max-h-[88dvh]'
        }`}
      >
        <header className="relative flex shrink-0 items-start gap-2 px-2 pb-3 pt-3">
          {/* The one bright seam on the sheet: a filament along the cut edge, so
              the panel reads as machined into the frame rather than laid on it. */}
          <span
            aria-hidden
            className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-crystal/70 via-crystal/15 to-transparent"
          />
          <div className="min-w-0 flex-1">
            {eyebrow === undefined ? null : <p className="legend mb-1 truncate">{eyebrow}</p>}
            <h2 className="headline text-balance text-figure">{title}</h2>
          </div>
          {/*
            A GLYPH, NOT A WORD. The close used to be a full slab reading CLOSE,
            which is the heaviest control on most of these sheets and sat directly
            beside the title competing with it. Its accessible name is still the
            word, so a screen reader and the screenshot harness both still find it.
          */}
          <IconButton ariaLabel={t('sheet.close')} onClick={onClose} tone="ghost" size="sm">
            <CloseIcon className="size-4" />
          </IconButton>
        </header>

        <div className="rail-soft shrink-0" />

        {/* `min-h-0` is what actually lets a flex child scroll instead of growing. */}
        <div
          className={`min-h-0 flex-1 ${bleed ? '' : 'px-2 py-2'} ${
            contained ? 'overflow-hidden' : 'overflow-y-auto overscroll-contain'
          }`}
        >
          {children}
        </div>

        {footer ? (
          <>
            <div className="rail-soft shrink-0" />
            <div className="shrink-0 bg-void/55 px-2 py-3">{footer}</div>
          </>
        ) : null}
      </div>
    </div>
  );
}
