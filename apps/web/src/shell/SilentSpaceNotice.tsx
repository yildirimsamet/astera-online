import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReturnStatus } from '../api/schemas.js';
import { describeError } from '../i18n/errors.js';
import { full } from '../lib/format.js';
import { Banner, Dialog, GameButton, Glyph, Well } from '../game-ui/index.js';
import { AtmosphereImage } from '../ui/AtmosphereArt.js';
import { ATMOSPHERE } from '../ui/atmosphere.js';

/**
 * SILENT SPACE (G10, C28 2026-11-15): "I gave no order for 30 hours — where am I, what is shut,
 * and how do I get home?" The room is drawn first (its scene and why the commander is here), then
 * what it withholds, then the way back: the application and its place in the queue. One
 * explanation per verified placement on this device; the menu can always reopen it.
 */
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
  const dismiss = (): void => {
    setAcknowledged(true);
    try { localStorage.setItem(storageKey, 'seen'); } catch { /* Session state still dismisses it. */ }
    onClose();
  };
  if (!visible) return null;
  const apply = (): void => {
    if (busy || !data.canApply || data.application) return;
    setBusy(true);
    setError(null);
    void onApply().catch((cause: unknown) => { setError(describeError(cause)); }).finally(() => { setBusy(false); });
  };
  return (
    <div ref={dialog} className="gk-silent fixed inset-0 z-50"
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.stopPropagation(); dismiss(); }
        if (event.key !== 'Tab') return;
        const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        const first = buttons?.[0];
        const last = buttons?.[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
      <Dialog ribbon={t(data.application ? 'silentSpace.queued' : 'silentSpace.title')} onBack={dismiss}
        actions={<>
          {!data.application && data.canApply && <GameButton tone="action" size="lg" wide glyph="recall" pending={busy} onPress={apply}>
            {t(busy ? 'silentSpace.applying' : 'silentSpace.apply')}
          </GameButton>}
          <GameButton tone="ghost" wide onPress={dismiss}>{t('silentSpace.later')}</GameButton>
        </>}>
        <div className="gk-silent__body">
          <div className="gk-silent__scene">
            <AtmosphereImage art={ATMOSPHERE.galaxyAccount} />
            <span className="gk-label">{t('silentSpace.menu')}</span>
          </div>
          <p className="gk-copy">{t('silentSpace.body')}</p>
          {/* D212: what this room withholds, before the player finds out from a refused launch. */}
          <ul className="gk-silent__shut">
            <li><Glyph id="lock" />{t('silentSpace.closed')}</li>
            <li><Glyph id="clock" />{t('silentSpace.production')}</li>
          </ul>
          {data.application ? (
            <Well className="gk-silent__queue">
              <p role="status" className="gk-silent__place">{t('silentSpace.position', { galaxy: data.homeShard, position: full(data.application.position) })}</p>
              <p className="gk-acct__note">{t('silentSpace.queueHint')}</p>
              <p className="gk-acct__note">{t('silentSpace.expiry')}</p>
            </Well>
          ) : (
            <p className="gk-silent__way">{data.canApply ? t('silentSpace.returnTo', { galaxy: data.homeShard }) : t('silentSpace.unavailable')}</p>
          )}
          {error && <Banner tone="hostile" role="alert" title={error} />}
          {!data.application && <p className="gk-acctsheet__fine">{t('silentSpace.reminder')}</p>}
        </div>
      </Dialog>
    </div>
  );
}
