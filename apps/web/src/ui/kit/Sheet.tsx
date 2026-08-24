import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, m } from 'motion/react';
import { IconButton } from './Button.js';
import { CloseIcon } from '../icons/index.js';

/**
 * SHEET — the surface a decision is made on.
 *
 * `docs/interface.md` I3: every item has a detail sheet and the sheet is the commit
 * surface. Committing from the bottom of the screen keeps what you are deciding about
 * on screen ABOVE it while you choose — you decide while looking at what you know,
 * never on a separate page that made you forget it.
 *
 * Since I5 the thing above is not just the previous panel but the live galaxy, so the
 * scrim is glass rather than paint: the world stays visible and slightly out of focus
 * behind the decision.
 *
 * `open` is a prop rather than the caller conditionally rendering, because exit
 * animations only run if the element stays mounted long enough to play them, and
 * every caller getting that right independently is a bug waiting to happen.
 */
export function Sheet({
  open,
  title,
  eyebrow,
  onClose,
  children,
  footer,
  /**
   * Swipe down to dismiss. OFF for anything irreversible — a launch sheet that can be
   * closed by a stray thumb is a fleet sent by accident.
   */
  dismissible = true,
}: {
  open: boolean;
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  dismissible?: boolean;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end">
          <m.button
            type="button"
            aria-label={t('sheet.dismiss')}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="absolute inset-0 bg-void/70"
          />

          <m.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38, mass: 0.9 }}
            {...(dismissible
              ? {
                  drag: 'y' as const,
                  dragConstraints: { top: 0, bottom: 0 },
                  dragElastic: { top: 0, bottom: 0.4 },
                  onDragEnd: (
                    _e: unknown,
                    info: { offset: { y: number }; velocity: { y: number } },
                  ) => {
                    // Distance OR speed — a slow long drag and a quick flick both read
                    // as "put this away", and requiring both feels stuck.
                    if (info.offset.y > 130 || info.velocity.y > 700) onClose();
                  },
                }
              : {})}
            className="glass relative max-h-[88dvh] overflow-hidden rounded-t-2xl pb-[env(safe-area-inset-bottom)] shadow-[0_-18px_46px_-12px_rgba(0,0,0,0.85)]"
            style={{ boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 12%), 0 -18px 46px -12px rgb(0 0 0 / 85%)' }}
          >
            {dismissible && (
              <div className="flex justify-center pb-1 pt-2.5">
                <span className="h-1 w-9 rounded-full bg-white/20" />
              </div>
            )}

            <div className="flex items-start gap-3 px-4 pb-3 pt-1">
              <div className="min-w-0 flex-1">
                {eyebrow === undefined ? null : <p className="legend mb-1">{eyebrow}</p>}
                <h2 className="truncate font-display text-title font-bold tracking-wide text-bone etch">
                  {title}
                </h2>
              </div>
              <IconButton ariaLabel={t('sheet.close')} onClick={onClose} tone="ghost" size="sm">
                <CloseIcon className="size-4" />
              </IconButton>
            </div>

            <div className="rail-soft" />

            <div className="max-h-[62dvh] overflow-y-auto overscroll-contain px-4 py-4">
              {children}
            </div>

            {footer === undefined ? null : (
              <>
                <div className="rail-soft" />
                <div className="bg-void/60 px-4 py-3">{footer}</div>
              </>
            )}
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
