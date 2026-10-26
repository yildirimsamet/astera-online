import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useApi } from '../api/context.js';
import { BattleReplay } from './BattleReplay.js';
import { useFullScreenLayer } from './layer.js';
import { battleReplayQuery } from './replayQuery.js';
import './simulator.css';

export default function BattleReplayDialog({ kind, id, onClose }: { kind: 'BATTLE' | 'MONUMENT'; id: string; onClose: () => void }) {
  const { t } = useTranslation(), api = useApi();
  const panel = useRef<HTMLDivElement>(null), closeButton = useRef<HTMLButtonElement>(null);
  useFullScreenLayer(panel, onClose);
  const query = useQuery(battleReplayQuery(api, kind, id));
  useEffect(() => { closeButton.current?.focus(); }, []);
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
