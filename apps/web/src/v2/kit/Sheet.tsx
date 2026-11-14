import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { claimEscape, dragStep, nextDetent, type Detent } from '../../lib/sheet.js';
import { useGalaxyCover } from '../../lib/galaxyCover.js';
import { useNativeBack } from '../../platform/nativeBack.js';
import { haptic } from '../../lib/haptics.js';
import { useOwnPress } from '../../ui/kit/useOwnPress.js';
import { Glyph } from '../../game-ui/icons.js';
import { AtmosphereImage } from '../../ui/AtmosphereArt.js';
import type { AtmosphereArt } from '../../ui/atmosphere.js';

/**
 * Peek and half are ceilings: a sheet with little in it is only as tall as its
 * content, because empty height is space with no purpose (seen on the gallery: a
 * two-row queue sheet stood half the screen tall). Full can rise to the top bar's
 * foot when the content needs the room, never over it (owner, 2026-10-20).
 */
const HEIGHT: Record<Detent, string> = {
  peek: 'max-h-[140px]',
  half: 'max-h-[55dvh]',
  /** As tall as what it holds, up to a page: an item sheet over empty space was the report. */
  fit: 'max-h-full',
  /** The room from the top bar's foot to the dock, used only when content needs it. */
  full: 'max-h-full',
};

/**
 * E11 · K10: FROM 700 PX, "PAGES IN THE RIGHT COLUMN OR IN THE MIDDLE, 720 PX AT MOST".
 *
 * A page is a column on the right, the whole height between the top bar and the dock,
 * and the galaxy beside it stays live (no dim). A dialog — a sheet that only ever
 * fits its content: an item, a build, the return story — stands in the middle over
 * the dim, as tall as what it holds. The phone is unchanged.
 */
type Placement = 'page' | 'dialog' | 'card';

/*
  A CARD (M4, the return story's mock) stands in the middle at every width, over the dim,
  as tall as what it holds, and has no handle: there is nothing to pull it to.
*/
const FRAME: Record<Placement, { holder: string; scrim: string; panel: string }> = {
  page: {
    holder: 'justify-end v2-split:left-auto v2-split:w-[440px] v2-desk:w-[min(720px,50vw)]',
    scrim: 'v2-split:hidden',
    panel: 'v2-split:max-h-full! v2-split:max-w-none! v2-split:rounded-none v2-split:border-t-0',
  },
  dialog: {
    holder: 'justify-end v2-split:items-center v2-split:justify-center v2-split:p-6',
    scrim: '',
    panel: 'v2-split:max-h-full! v2-split:max-w-[32rem]! v2-split:rounded-sheet v2-split:border-b',
  },
  card: {
    holder: 'items-center justify-center px-4',
    scrim: '',
    panel: 'max-w-sm! rounded-sheet border-b pt-2',
  },
};

const PAGE: readonly Detent[] = ['half', 'full'];

export interface SheetProps {
  title: string;
  /**
   * The language the title is named in, where it is not the page's: a world's name is an
   * English word, and the kit head's capitals in Turkish would write THİSTLE (stage 4.1).
   */
  titleLang?: string;
  /** A compact action beside the heading, such as the chat's personal mute list. */
  titleAction?: ReactNode;
  /** Subject-specific art stays behind the named header; quiet/peek surfaces remain compact. */
  headerArt?: AtmosphereArt;
  eyebrow?: string;
  /** What stands before the title on its line: the launch's "→ [owner]" (E3). */
  lead?: ReactNode;
  /**
   * The page draws its own heading (a battle report's hero, M4): the title and eyebrow stay
   * the dialog's words for a reader, nothing is drawn twice, and the close floats over the top.
   */
  quietTitle?: boolean;
  /** The page starts with a picture: the handle and the close lie over it instead of above it. */
  floatingHead?: boolean;
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
  /** Keep a contained conversation panel at a stable height while its log scrolls. */
  fixedHeight?: boolean;
  /**
   * Wide screens only (E11): a page docks to the right, a dialog stands in the middle.
   * Default: a dialog when it only ever fits its content, a page otherwise.
   */
  placement?: Placement;
  /**
   * THE KIT'S LOOK (stage 4.1): a screen moves to the kit by asking for it. The head becomes
   * a plate with the subject's picture, the title in the display face and a line of meta;
   * the body and the foot take the kit's metal. What the sheet does does not change.
   */
  kit?: { art?: string; meta?: ReactNode; tone?: 'self' | 'hostile' };
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
  titleLang,
  titleAction,
  eyebrow,
  lead,
  quietTitle = false,
  headerArt,
  onClose,
  onBack,
  detents = PAGE,
  onDetentChange,
  children,
  footer,
  bleed = false,
  floatingHead = false,
  contained = false,
  fixedHeight = false,
  placement = detents.every((height) => height === 'fit') ? 'dialog' : 'page',
  kit,
}: SheetProps) {
  const { t } = useTranslation();
  const [detent, setDetent] = useState<Detent>(detents[0] ?? 'half');
  const dragged = useRef(false);
  const release = useRef<((event: PointerEvent) => void) | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  useNativeBack(panel, onBack ?? onClose);

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
      if (claimEscape(event, panel.current)) onClose();
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
  useGalaxyCover(panel, modal);

  return (
    <div
      data-sheet-holder=""
      className={`pointer-events-none fixed inset-x-0 top-[var(--v2-top-h,0px)] z-40 flex flex-col ${FRAME[placement].holder}`}
      /* From the screen top to above the dock; a short page keeps its own height. */
      style={{ bottom: 'var(--v2-dock-h, 0px)' }}
    >
      {modal && (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          data-scrim=""
          {...dismiss}
          // A press on the dim deepens it a moment before the sheet goes: the tap was heard (G1-g).
          className={`pointer-events-auto absolute inset-0 transition-colors duration-150 active:bg-v2-deep/40 ${FRAME[placement].scrim}`}
        />
      )}
      <div
        ref={panel}
        role="dialog"
        aria-modal={modal}
        aria-label={title}
        data-detent={detent}
        data-placement={placement}
        data-sheet-panel=""
        className={`pointer-events-auto relative mx-auto flex w-full max-w-xl flex-col ${floatingHead ? 'h-full' : ''} overflow-hidden ${kit ? 'gk gk-sheet' : 'border border-b-0 border-v2-line bg-v2-panel font-v2-ui'} transition-[height,max-height] duration-300 ease-v2 ${fixedHeight ? 'h-[70dvh] max-h-full' : HEIGHT[detent]} ${FRAME[placement].panel}`}
      >
        <div data-sheet-header="" className={`${floatingHead ? 'pointer-events-none absolute inset-x-0 top-0 z-10' : 'shrink-0'} touch-none ${headerArt && !quietTitle && detent !== 'peek' ? 'sheet-art-head' : ''}`} {...(placement === 'card' ? {} : { onPointerDown: onPull })}>
          {headerArt && !quietTitle && detent !== 'peek' && <div data-sheet-art=""><AtmosphereImage art={headerArt} /></div>}
          {placement !== 'card' && !floatingHead && <button
            type="button"
            aria-label={t(atTop ? 'handle.collapse' : 'handle.expand')}
            onClick={(event) => {
              const afterPull = dragged.current;
              dragged.current = false;
              // Only a pointer click can be the tail of a pull; a key press (`detail` 0) never is.
              if (afterPull && event.detail !== 0) return;
              settle(atTop ? 'down' : 'up');
            }}
            /*
              A column on a wide screen has one height: its handle would promise a pull that does nothing.
              A thumb's 44 px tall, it takes no more room than its 16 px row: it reaches down over the
              head's quiet middle, between the back and the close (G1-g).
            */
            className={`group relative z-10 mx-auto -mb-7 flex h-11 w-16 shrink-0 items-start justify-center ${placement === 'page' ? 'v2-split:invisible' : ''}`}
          >
            {/* The bar lights and stretches under the thumb: the pull was felt. */}
            <span aria-hidden="true" className={kit ? 'gk-sheet__grab' : 'mt-1.5 h-1 w-9 rounded-full bg-v2-line-hi transition-[width,background-color] duration-150 group-active:w-12 group-active:bg-v2-ink-2'} />
          </button>}
          {/* The close owns a stable row; scrolling tabs never need to move around it. */}
          {kit && !quietTitle ? (
            <header className={`gk-cut${kit.tone ? ` gk-cut--${kit.tone}` : ''} gk-sheet__head${onBack ? ' gk-sheet__head--back' : ''}`}>
              {onBack && <SheetBack onBack={onBack} />}
              {kit.art ? <img className="gk-sheet__art" src={kit.art} alt="" draggable={false} /> : <span />}
              <div className="min-w-0">
                {eyebrow && <p className="gk-sheet__eyebrow">{eyebrow}</p>}
                <div className={titleAction ? 'flex min-w-0 items-center gap-2' : undefined}>
                  <h2 className="gk-sheet__title gk-display gk-outlined" {...(titleLang ? { lang: titleLang } : {})}>
                    {lead !== undefined ? <span className="inline-flex min-w-0 items-center gap-1.5">{lead}<span className="truncate">{title}</span></span> : title}
                  </h2>
                  {titleAction !== undefined && <span data-title-action="" className="relative z-20 flex shrink-0 items-center gap-2">{titleAction}</span>}
                </div>
                {kit.meta !== undefined && <div className="gk-sheet__meta">{kit.meta}</div>}
              </div>
              <SheetClose onClose={onClose} />
            </header>
          ) : <header className={quietTitle ? 'flex shrink-0 items-start justify-end gap-1 px-1 pb-1' : 'flex items-center gap-1 px-1 pb-1'}>
            {/* Pressable in the quiet header's stable row too. */}
            {onBack && <SheetBack onBack={onBack} small />}
            <div className={quietTitle ? 'contents' : 'min-w-0 flex-1 px-1'}>
              {eyebrow && <p className={quietTitle ? 'sr-only' : 'gk-sheet__eyebrow'}>{eyebrow}</p>}
              {titleAction ? (
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="truncate text-figure font-semibold text-v2-ink">{title}</h2>
                  <span data-title-action="" className="relative z-20 flex shrink-0 items-center gap-2">{titleAction}</span>
                </div>
              ) : lead ? (
                <h2 className="flex min-w-0 items-center gap-1.5 text-figure font-semibold text-v2-ink">
                  {lead}
                  <span className="truncate">{title}</span>
                </h2>
              ) : (
                <h2 className={quietTitle ? 'sr-only' : 'truncate text-figure font-semibold text-v2-ink'}>{title}</h2>
              )}
            </div>
            <SheetClose onClose={onClose} small />
          </header>}
        </div>

        <div
          data-sheet-body=""
          className={kit
            ? `gk-sheet__body relative ${contained ? 'flex flex-col overflow-hidden!' : ''} ${bleed ? 'px-0! pt-0!' : ''}`
            : `relative ${floatingHead ? 'z-0' : ''} min-h-0 flex-auto ${contained ? 'flex flex-col overflow-hidden' : 'overflow-y-auto overscroll-contain'} ${bleed ? '' : 'px-3 pb-3'}`}
        >
          {typeof children === 'function' ? children(detent) : children}
        </div>

        {footer && <div className={kit ? 'gk-sheet__foot shrink-0' : 'shrink-0 border-t border-v2-line px-3 py-2.5'}>{footer}</div>}
      </div>
    </div>
  );
}

/*
  THE SHEET'S OWN CONTROLS (G1-g, 2026-11-14): the kit's round plates, a thumb's 44 px in either
  look (the plain head's face is the small one). A press buzzes once; the mixer's click is their
  sound. Escape, the dim and a pull close the sheet without a buzz: they are not this press.
*/
function SheetBack({ onBack, small = false }: { onBack: () => void; small?: boolean }) {
  const { t } = useTranslation();
  return (
    <button type="button" aria-label={t('sheet.back')} onClick={() => { haptic('tap'); onBack(); }} className={`gk-round${small ? ' gk-round--small' : ''} pointer-events-auto`}>
      <span className="gk-round__face"><Glyph id="back" /></span>
    </button>
  );
}

function SheetClose({ onClose, small = false }: { onClose: () => void; small?: boolean }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-label={t('sheet.close')}
      data-sheet-close=""
      // Taking focus first would close a phone keyboard and move the page under the finger.
      onPointerDown={(event) => { event.preventDefault(); }}
      onClick={() => { haptic('tap'); onClose(); }}
      className={`gk-round${small ? ' gk-round--small' : ''} pointer-events-auto`}
    >
      <span className="gk-round__face"><Glyph id="close" /></span>
    </button>
  );
}
