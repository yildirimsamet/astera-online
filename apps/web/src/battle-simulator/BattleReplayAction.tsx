import { useEffect, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BattleReplayStatus } from '@astera/rules';

import { GameButton, Glyph } from '../game-ui/index.js';
import { loadBattleReplayView, reloadReplayPage } from './replayView.js';
import { SimulatorHost } from './SimulatorHost.js';
type ReplayView = Awaited<ReturnType<typeof loadBattleReplayView>>;
/**
 * No telemetry request or 3D module is loaded until the reader chooses to watch — or to try the same
 * forces in the simulator, which reads them from this replay (the pirate level comes from the report).
 *
 * On the kit (C16b): one row above the scene — watching on a steel plate, trying as the quiet move
 * beside it; the sheet's one primary stays "attack again". While the 3D view downloads the watch
 * button spins, so the press is answered before the layer can open.
 */
export function BattleReplayAction({ kind, id, status, pirateLevel }: { kind: 'BATTLE' | 'MONUMENT'; id: string; status?: BattleReplayStatus; pirateLevel?: number }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [ReplayDialog, setView] = useState<ReplayView | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!open || ReplayDialog) return;
    let cancelled = false;
    setFailed(false);
    void loadBattleReplayView().then(view => { if (!cancelled) setView(() => view); }, () => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [open, ReplayDialog]);
  // The kit button takes no ref: focus goes back through the door that holds both.
  const door = useRef<HTMLDivElement>(null);
  const close = useCallback(() => { setOpen(false); door.current?.querySelector<HTMLButtonElement>('.gk-replaydoor__watch')?.focus(); }, []);
  const [trying, setTrying] = useState(false);
  const closeTry = useCallback(() => { setTrying(false); door.current?.querySelector<HTMLButtonElement>('.gk-replaydoor__try')?.focus(); }, []);
  if (status !== 'AVAILABLE') return <p data-testid="replay-unavailable" className="gk-report__note" data-tone="plain">
    {t(status === 'INSUFFICIENT_FORCE' ? 'simulator.replayInsufficient' : status === 'TOO_LARGE' ? 'simulator.replayTooLarge' : 'simulator.replayNotRecorded')}
  </p>;
  return <>
    <div ref={door} data-replay-door="" className="gk-replaydoor">
      <GameButton size="sm" glyph="eye" className="gk-replaydoor__watch" pending={open && !ReplayDialog && !failed} onPress={() => { setOpen(true); }}>
        {t('simulator.watchBattle')}
      </GameButton>
      <GameButton size="sm" tone="ghost" glyph="refresh" className="gk-replaydoor__try" onPress={() => { setTrying(true); }}>{t('simulator.trySimulator')}</GameButton>
    </div>
    {trying && <SimulatorHost source={{ kind, id, ...(pirateLevel ? { pirateLevel } : {}) }} onClose={closeTry} />}
    {open && (ReplayDialog ? <ReplayDialog key={`${kind}:${id}`} kind={kind} id={id} onClose={close} /> : <div className="gk-well gk-replaydoor__wait" role={failed ? 'alert' : 'status'}>
      <p className="gk-replaydoor__say">
        {failed ? <span className="gk-replaydoor__mark" data-tone="warn"><Glyph id="warn" /></span> : <span className="gk-spin" aria-hidden="true" />}
        <span>{t(failed ? 'simulator.viewLoadFailed' : 'simulator.loadingReplay')}</span>
      </p>
      <div className="gk-replaydoor__moves">
        {failed && <GameButton size="sm" glyph="refresh" onPress={reloadReplayPage}>{t('simulator.reloadGame')}</GameButton>}
        <GameButton size="sm" tone="ghost" glyph="back" onPress={close}>{t('simulator.returnToReport')}</GameButton>
      </div>
    </div>)}
  </>;
}
