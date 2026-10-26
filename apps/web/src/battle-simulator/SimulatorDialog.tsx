import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useApi } from '../api/context.js';
import { BattleSimulator } from './BattleSimulator.js';
import { scenarioFromReplay } from './fromReplay.js';
import { useFullScreenLayer } from './layer.js';
import { battleReplayQuery } from './replayQuery.js';
import type { SimulatorSource } from './replayView.js';
import './simulator.css';

/**
 * The simulator over the game. From the menu it opens a free scenario; from a report it opens the
 * forces that fought, read from that battle's replay — nothing the replay does not already show.
 */
export default function SimulatorDialog({ source, onClose }: { source?: SimulatorSource; onClose: () => void }) {
  const { t } = useTranslation(), api = useApi();
  const panel = useRef<HTMLDivElement>(null);
  useFullScreenLayer(panel, onClose);
  useEffect(() => { panel.current?.focus(); }, []);
  const query = useQuery({ ...battleReplayQuery(api, source?.kind ?? 'BATTLE', source?.id ?? ''), enabled: source !== undefined });
  const initial = useMemo(() => query.data && scenarioFromReplay(query.data.replay, { ...(source?.pirateLevel ? { pirateLevel: source.pirateLevel } : {}) }),
    [query.data, source?.pirateLevel]);
  const back = t(source ? 'simulator.returnToReport' : 'simulator.returnToMenu');
  return createPortal(<div ref={panel} tabIndex={-1} className="sim-layer" data-sheet-panel="" role="dialog" aria-modal="true" aria-label={t('simulator.title')}>
    {!source || initial ? <BattleSimulator onLeave={onClose} backLabel={back} {...(initial ? { initialScenario: initial, note: t('simulator.fromReport') } : {})} />
      : <div className="simulator"><header className="sim-header"><div className="sim-heading"><h1>{t('simulator.title')}</h1></div>
        <button type="button" className="sim-configure" onClick={onClose}>{back}</button></header>
        {query.isError ? <div className="sim-replay-message" role="alert"><p>{t('simulator.replayLoadFailed')}</p>
          <button type="button" onClick={() => { void query.refetch(); }}>{t('simulator.retry')}</button></div>
          : <p className="sim-replay-message" role="status">{t('simulator.loadingReplay')}</p>}</div>}
  </div>, document.body);
}
