import { useEffect, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BattleReplayStatus } from '@astera/rules';

import { loadBattleReplayView, reloadReplayPage } from './replayView.js';
import { SimulatorHost } from './SimulatorHost.js';
type ReplayView = Awaited<ReturnType<typeof loadBattleReplayView>>;
/**
 * No telemetry request or 3D module is loaded until the reader chooses to watch — or to try the same
 * forces in the simulator, which reads them from this replay (the pirate level comes from the report).
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
  const opener = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => { setOpen(false); opener.current?.focus(); }, []);
  const [trying, setTrying] = useState(false);
  const tryOpener = useRef<HTMLButtonElement>(null);
  const closeTry = useCallback(() => { setTrying(false); tryOpener.current?.focus(); }, []);
  if (status !== 'AVAILABLE') return <p data-testid="replay-unavailable" className="rounded-control border border-v2-line/60 px-3 py-2 text-micro text-v2-ink-3">
    {t(status === 'INSUFFICIENT_FORCE' ? 'simulator.replayInsufficient' : status === 'TOO_LARGE' ? 'simulator.replayTooLarge' : 'simulator.replayNotRecorded')}
  </p>;
  return <>
    <div className="flex gap-2">
      <button ref={opener} type="button" className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 rounded-control border border-v2-crystal/40 bg-v2-crystal/10 px-4 py-3 text-caption font-semibold text-v2-crystal"
        aria-haspopup="dialog" onClick={() => { setOpen(true); }}><span>{t('simulator.watchBattle')}</span><span aria-hidden="true">▷</span></button>
      <button ref={tryOpener} type="button" className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-control border border-v2-line px-3 py-3 text-label font-semibold text-v2-ink-2"
        aria-haspopup="dialog" onClick={() => { setTrying(true); }}><span>{t('simulator.trySimulator')}</span><span aria-hidden="true">↗</span></button>
    </div>
    {trying && <SimulatorHost source={{ kind, id, ...(pirateLevel ? { pirateLevel } : {}) }} onClose={closeTry} />}
    {open && (ReplayDialog ? <ReplayDialog key={`${kind}:${id}`} kind={kind} id={id} onClose={close} /> : <div className="mt-2 grid gap-2 rounded-control border border-v2-line p-3 text-caption" role={failed ? 'alert' : 'status'}>
      <p>{t(failed ? 'simulator.viewLoadFailed' : 'simulator.loadingReplay')}</p>
      <div className="flex gap-3">{failed && <button type="button" className="min-h-11 text-v2-crystal" onClick={reloadReplayPage}>{t('simulator.reloadGame')}</button>}
        <button type="button" className="min-h-11 text-v2-ink-2" onClick={close}>{t('simulator.returnToReport')}</button></div>
    </div>)}
  </>;
}
