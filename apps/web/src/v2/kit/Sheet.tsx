import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { dragStep, nextDetent, type Detent } from '../../lib/sheet.js';
import { useOwnPress } from '../../ui/kit/useOwnPress.js';
import { Icon } from '../icons.js';

/**
 * Peek and half are ceilings: a sheet with little in it is only as tall as its
 * content, because empty height is space with no purpose (seen on the gallery: a
 * two-row queue sheet stood half the screen tall). Full is a page, and fills.
 */
const HEIGHT: Record<Detent, string> = {
  peek: 'max-h-[140px]',
  half: 'max-h-[55dvh]',
  full: 'h-[92dvh]',
};

const PAGE: readonly Detent[] = ['half', 'full'];

export interface SheetProps {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  /** Where it was opened from, when that is a surface rather than the galaxy. */
  onBack?: () => void;
  /** The heights it uses, lowest first; it opens at the first. Default: half and full. */
  detents?: readonly Detent[];
  onDetentChange?: (detent: Detent) => void;
  /** A function receives the current height, so a card can become a dossier as it opens. */
  children: ReactNode | ((detent: Detent) => ReactNode);
  footer?: ReactNode;
  /** The caller owns the body's insets (edge-to-edge rows). */
  bleed?: boolean;
  /** The body does not scroll; its child owns scrolling (a chat log). */
  contained?: boolean;
}

/**
 * THE SHEET THAT OPENS OVER THE GALAXY. Spec B3, B4 and the gesture table
 * (docs/ui-v2/gozlemevi.md).
 *
 * Three heights and one handle. peek (≤140 px) is the context card: the world
 * beside it stays undimmed and live, so it is not modal. half (55%) and full (92%)
 * are the dossier and the pages the dock opens: dimmed behind, modal. Pull the
 * handle up or tap it to open further; pull down to settle; pull down from the
 * lowest height, tap the close, press Escape, or tap the dim to close.
 *
 * A PULL IS NOT A TAP. A drag that settled the sheet swallows the click that
 * follows it, and the release is heard on the window, because a thumb pulling a
 * twenty-pixel handle leaves it long before it lets go.
 *
 * THE DIM ONLY ANSWERS A PRESS THAT BEGAN ON IT (D109a, `useOwnPress`): the tap
 * that opened the sheet must not close it again.
 *
 * It sits above the dock (`--v2-dock-h`, set by the shell in F2) and never
 * unmounts the canvas under it.
 */
export function Sheet({
  title,
  eyebrow,
  onClose,
  onBack,
  detents = PAGE,
  onDetentChange,
  children,
  footer,
  bleed = false,
  contained = false,
}: SheetProps) {
  const { t } = useTranslation();
  const [detent, setDetent] = useState<Detent>(detents[0] ?? 'half');
  const dragged = useRef(false);
  const release = useRef<((event: PointerEvent) => void) | null>(null);

  const settle = (direction: 'up' | 'down'): void => {
    const next = nextDetent(detents, detent, direction);
    if (next === null) {
      onClose();
      return;
    }
    if (next === detent) return;
    setDetent(next);
    onDetentChange?.(next);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  useEffect(() => () => {
    if (release.current) window.removeEventListener('pointerup', release.current);
  }, []);

  const onPull = (event: ReactPointerEvent): void => {
    // Every gesture starts clean: a pull that ended on the title must not swallow the next tap.
    dragged.current = false;
    const from = event.clientY;
    if (release.current) window.removeEventListener('pointerup', release.current);
    const up = (end: PointerEvent): void => {
      window.removeEventListener('pointerup', up);
      release.current = null;
      const step = dragStep(end.clientY - from);
      if (step === null) return;
      dragged.current = true;
      settle(step);
    };
    release.current = up;
    window.addEventListener('pointerup', up);
  };

  const dismiss = useOwnPress(onClose);
  const atTop = detent === detents[detents.length - 1];
  const modal = detent !== 'peek';

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-40 flex flex-col justify-end"
      style={{ bottom: 'var(--v2-dock-h, 0px)' }}
    >
      {modal && (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          data-scrim=""
          {...dismiss}
          className="pointer-events-auto absolute inset-0 bg-v2-void/60"
        />
      )}
      <div
        role="dialog"
        aria-modal={modal}
        aria-label={title}
        data-detent={detent}
        data-sheet-panel=""
        className={`pointer-events-auto relative mx-auto flex w-full max-w-xl flex-col overflow-hidden rounded-t-sheet border border-b-0 border-v2-line bg-v2-panel font-v2-ui transition-[height,max-height] duration-300 ease-v2 ${HEIGHT[detent]}`}
      >
        <div className="shrink-0 touch-none" onPointerDown={onPull}>
          <button
            type="button"
            aria-label={t(atTop ? 'handle.collapse' : 'handle.expand')}
            onClick={(event) => {
              const afterPull = dragged.current;
              dragged.current = false;
              // Only a pointer click can be the tail of a pull; a key press (`detail` 0) never is.
              if (afterPull && event.detail !== 0) return;
              settle(atTop ? 'down' : 'up');
            }}
            className="flex h-4 w-full items-center justify-center"
          >
            <span aria-hidden="true" className="h-1 w-9 rounded-full bg-v2-line-hi" />
          </button>
          <header className="flex items-start gap-1 px-2 pb-2">
            {onBack && (
              <button
                type="button"
                aria-label={t('sheet.back')}
                onClick={onBack}
                className="grid size-8 shrink-0 place-items-center rounded-control text-v2-ink-2"
              >
                <Icon id="i-chev" className="size-4 rotate-180" />
              </button>
            )}
            <div className="min-w-0 flex-1 px-1 pt-1">
              {eyebrow && <p className="truncate text-micro uppercase tracking-wide text-v2-ink-3">{eyebrow}</p>}
              <h2 className="truncate text-figure font-semibold text-v2-ink">{title}</h2>
            </div>
            <button
              type="button"
              aria-label={t('sheet.close')}
              onClick={onClose}
              className="grid size-8 shrink-0 place-items-center rounded-control text-v2-ink-2"
            >
              <Icon id="i-close" className="size-4" />
            </button>
          </header>
        </div>

        <div
          data-sheet-body=""
          className={`min-h-0 flex-1 ${contained ? 'flex flex-col overflow-hidden' : 'overflow-y-auto overscroll-contain'} ${bleed ? '' : 'px-3 pb-3'}`}
        >
          {typeof children === 'function' ? children(detent) : children}
        </div>

        {footer && <div className="shrink-0 border-t border-v2-line px-3 py-2.5">{footer}</div>}
      </div>
    </div>
  );
}
