import { useEffect, type ReactNode } from 'react';

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
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
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
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 animate-[fade-in_140ms_ease-out] bg-void/80 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="panel relative max-h-[86dvh] animate-[sheet-in_180ms_ease-out] overflow-y-auto rounded-t-md border-x-0 border-b-0 border-t-line pb-[env(safe-area-inset-bottom)]"
      >
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-line-soft bg-panel/95 px-4 py-3 backdrop-blur">
          <div className="min-w-0 flex-1">
            {eyebrow && <p className="legend mb-1">{eyebrow}</p>}
            <h2 className="truncate font-display text-[19px] tracking-wide text-bone">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="btn px-3 py-1.5">
            Close
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
        {footer && (
          <div className="sticky bottom-0 border-t border-line-soft bg-panel/95 px-4 py-3 backdrop-blur">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
