import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { loadSimulatorView, reloadReplayPage, type SimulatorSource } from './replayView.js';

type SimulatorView = Awaited<ReturnType<typeof loadSimulatorView>>;

/** Downloads the simulator on the first tap; a failed download stays a message over the game, with the reload that clears it. */
export function SimulatorHost({ source, onClose }: { source?: SimulatorSource; onClose: () => void }) {
  const { t } = useTranslation();
  const [View, setView] = useState<SimulatorView | null>(null), [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void loadSimulatorView().then(view => { if (!cancelled) setView(() => view); }, () => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);
  if (View) return <View {...(source ? { source } : {})} onClose={onClose} />;
  return createPortal(<div role={failed ? 'alert' : 'status'} className="fixed inset-0 z-[170] grid place-content-center gap-3 bg-[#080d18] p-6 text-center text-caption text-v2-ink-2">
    <p>{t(failed ? 'simulator.viewLoadFailed' : 'simulator.stageLoading')}</p>
    <div className="flex justify-center gap-4">
      {failed && <button type="button" className="min-h-11 text-v2-crystal" onClick={reloadReplayPage}>{t('simulator.reloadGame')}</button>}
      <button type="button" className="min-h-11 text-v2-ink-2" onClick={onClose}>{t('simulator.close')}</button>
    </div>
  </div>, document.body);
}
