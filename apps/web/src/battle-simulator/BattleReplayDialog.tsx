import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useApi } from '../api/context.js';
import { claimEscape } from '../lib/sheet.js';
import { coverGalaxy } from '../lib/galaxyCover.js';
import { useNativeBack } from '../platform/nativeBack.js';
import { BattleReplay } from './BattleReplay.js';
import './simulator.css';

export default function BattleReplayDialog({ kind, id, onClose }: { kind: 'BATTLE' | 'MONUMENT'; id: string; onClose: () => void }) {
  const { t } = useTranslation(), api = useApi();
  const panel = useRef<HTMLDivElement>(null), closeButton = useRef<HTMLButtonElement>(null);
  useNativeBack(panel, onClose);
  const query = useQuery({ queryKey: ['battle-replay', kind, id], queryFn: ({ signal }) => api.battleReplay(kind, id, { signal }),
    staleTime: Infinity, gcTime: 0, retry: false, refetchOnWindowFocus: false });
  useEffect(() => {
    closeButton.current?.focus();
    const release = coverGalaxy('whole');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const keydown = (event: KeyboardEvent) => {
      if (claimEscape(event, panel.current)) { onClose(); return; }
      if (event.key !== 'Tab') return;
      const top = panel.current?.querySelector<HTMLElement>('[data-sheet-panel]') ?? panel.current;
      const controls = [...(top?.querySelectorAll<HTMLElement>('button:not(:disabled), select, input, summary, [tabindex="0"]') ?? [])]
        .filter(node => node.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); document.body.style.overflow = previousOverflow; release(); };
  }, [onClose]);
  return createPortal(<div ref={panel} className="simulator sim-real-replay" data-sheet-panel="" role="dialog" aria-modal="true" aria-label={t('simulator.realReplay')}>
    <header className="sim-header"><div className="sim-heading"><h1>{t('simulator.realReplay')}</h1><p>{t('simulator.recordedBattle')}</p></div>
      <button ref={closeButton} type="button" className="sim-configure" onClick={onClose}>{t('simulator.returnToReport')}</button></header>
    <div className="sim-real-body">
      {query.isPending && <p className="sim-replay-message" role="status">{t('simulator.loadingReplay')}</p>}
      {query.isError && <div className="sim-replay-message" role="alert"><p>{t('simulator.replayLoadFailed')}</p><button type="button" onClick={() => { void query.refetch(); }}>{t('simulator.retry')}</button></div>}
      {query.data && <BattleReplay key={`${kind}:${id}`} simulation={query.data.replay} environment={query.data.replay.environment} initialViewer={query.data.viewer} ownPlayerIds={query.data.ownPlayerIds} />}
    </div>
  </div>, document.body);
}
