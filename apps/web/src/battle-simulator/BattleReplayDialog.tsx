import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useApi } from '../api/context.js';
import { GameButton, Glyph, RoundButton } from '../game-ui/index.js';
import { BattleReplay } from './BattleReplay.js';
import { useFullScreenLayer } from './layer.js';
import { battleReplayQuery } from './replayQuery.js';
import './simulator.css';

/**
 * THE RECORDED FIGHT, FULL SCREEN (C16b on the kit): a kit bar with the way back, then either the
 * wait for the recording or the 3D stage. The stage keeps the simulator's own frame (`.simulator`,
 * G11); the bar and the wait sit outside it, so the simulator's button rules never reach the kit's.
 */
export default function BattleReplayDialog({ kind, id, onClose }: { kind: 'BATTLE' | 'MONUMENT'; id: string; onClose: () => void }) {
  const { t } = useTranslation(), api = useApi();
  const panel = useRef<HTMLDivElement>(null);
  useFullScreenLayer(panel, onClose);
  const query = useQuery(battleReplayQuery(api, kind, id));
  useEffect(() => { panel.current?.querySelector<HTMLButtonElement>('.gk-replay__head .gk-round')?.focus(); }, []);
  return createPortal(<div ref={panel} className="gk gk-replay" data-sheet-panel="" role="dialog" aria-modal="true" aria-label={t('simulator.realReplay')}>
    {/* The sheets' head, the way back on the left: a 3D stage leaves it the one way out on a phone without a back gesture. */}
    <header className="gk-cut gk-cut--self gk-replay__head">
      <RoundButton glyph="back" label={t('simulator.returnToReport')} onPress={onClose} />
      <div className="gk-replay__title"><h1 className="gk-display gk-outlined">{t('simulator.realReplay')}</h1><p>{t('simulator.recordedBattle')}</p></div>
    </header>
    {query.data
      ? <div className="simulator sim-real-replay"><div className="sim-real-body">
        <BattleReplay key={`${kind}:${id}`} simulation={query.data.replay} environment={query.data.replay.environment} initialViewer={query.data.viewer} ownPlayerIds={query.data.ownPlayerIds} />
      </div></div>
      : <div className="gk-replay__wait" role={query.isError ? 'alert' : 'status'}>
        {query.isError ? <span className="gk-replaydoor__mark" data-tone="warn"><Glyph id="warn" /></span> : <span className="gk-spin" aria-hidden="true" />}
        <p>{t(query.isError ? 'simulator.replayLoadFailed' : 'simulator.loadingReplay')}</p>
        {query.isError && <GameButton size="sm" glyph="refresh" pending={query.isFetching} onPress={() => { void query.refetch(); }}>{t('simulator.retry')}</GameButton>}
      </div>}
  </div>, document.body);
}
