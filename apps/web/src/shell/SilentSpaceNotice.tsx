import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReturnStatus } from '../api/schemas.js';
import { describeError } from '../i18n/errors.js';
import { full } from '../lib/format.js';
import { Button } from '../ui/kit/index.js';

/** One explanation per verified placement on this device; the menu can always reopen it. */
export function SilentSpaceNotice({ data, open, allowAutomatic, onClose, onApply }: {
  data: ReturnStatus;
  open: boolean;
  allowAutomatic: boolean;
  onClose: () => void;
  onApply: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const identity = data.placement;
  const storageKey = `astera:silent-space:v1:${identity?.playerId ?? ''}:${String(identity?.version ?? 0)}`;
  const [acknowledged, setAcknowledged] = useState(() => {
    try { return localStorage.getItem(storageKey) === 'seen'; } catch { return false; }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const visible = identity?.role === 'WAITING' && (open || (allowAutomatic && identity.version > 0 && !acknowledged));
  useEffect(() => {
    if (!visible) return;
    const previous = document.activeElement;
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, [visible, data.application?.id]);
  if (!visible) return null;
  const dismiss = (): void => {
    setAcknowledged(true);
    try { localStorage.setItem(storageKey, 'seen'); } catch { /* Session state still dismisses it. */ }
    onClose();
  };
  const apply = (): void => {
    if (busy || !data.canApply || data.application) return;
    setBusy(true);
    setError(null);
    void onApply().catch((cause: unknown) => { setError(describeError(cause)); }).finally(() => { setBusy(false); });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 px-4">
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="silent-space-title" aria-describedby="silent-space-body"
        className="plate plate-cut w-full max-w-sm p-4 shadow-2xl"
        onKeyDown={(event) => {
          if (event.key === 'Escape') { event.stopPropagation(); dismiss(); }
          if (event.key !== 'Tab') return;
          const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
          const first = buttons?.[0];
          const last = buttons?.[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }}>
        <p className="legend mb-2">{t('silentSpace.menu')}</p>
        <h2 id="silent-space-title" className="text-title font-semibold text-bone">
          {t(data.application ? 'silentSpace.queued' : 'silentSpace.title')}
        </h2>
        <p id="silent-space-body" className="mt-3 text-body leading-relaxed text-bone/80">{t('silentSpace.body')}</p>
        {data.application ? (
          <div className="mt-3 space-y-2">
            <p role="status" className="text-body font-semibold text-bone">{t('silentSpace.position', { galaxy: data.homeShard, position: full(data.application.position) })}</p>
            <p className="text-label leading-relaxed text-bone/70">{t('silentSpace.queueHint')}</p>
            <p className="text-label text-bone/70">{t('silentSpace.expiry')}</p>
          </div>
        ) : (
          <p className="mt-3 text-body leading-relaxed text-bone/80">{data.canApply
            ? t('silentSpace.returnTo', { galaxy: data.homeShard }) : t('silentSpace.unavailable')}</p>
        )}
        {error && <p role="alert" className="mt-3 text-body text-threat">{error}</p>}
        <div className="mt-4 flex flex-col gap-2">
          {!data.application && data.canApply && <Button variant="primary" full disabled={busy} onClick={apply}>
            {t(busy ? 'silentSpace.applying' : 'silentSpace.apply')}
          </Button>}
          <Button variant="ghost" full onClick={dismiss}>{t('silentSpace.later')}</Button>
        </div>
        {!data.application && <p className="mt-2 text-label leading-relaxed text-bone/60">{t('silentSpace.reminder')}</p>}
      </div>
    </div>
  );
}
