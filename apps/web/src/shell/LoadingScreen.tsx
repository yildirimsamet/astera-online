import { useEffect, useState } from 'react';
import { AsteraWordmark } from '../brand/Identity.js';
import { OpeningScene } from '../brand/OpeningScene.js';

/** Caption settling never gates readiness; the departing cover immediately releases input. */
export function LoadingScreen({ caption, progress, visible = true }: { caption: string; progress?: number; visible?: boolean }) {
  const [shownCaption, setShownCaption] = useState(caption);
  const [present, setPresent] = useState(visible);
  useEffect(() => {
    if (caption === shownCaption) return;
    const timer = window.setTimeout(() => { setShownCaption(caption); }, 600);
    return () => { window.clearTimeout(timer); };
  }, [caption, shownCaption]);
  useEffect(() => {
    if (visible) { setPresent(true); return; }
    const timer = window.setTimeout(() => { setPresent(false); }, 180);
    return () => { window.clearTimeout(timer); };
  }, [visible]);
  const known = caption === shownCaption && progress !== undefined && Number.isFinite(progress);
  const pct = Math.round(Math.min(1, Math.max(0, progress ?? 0)) * 100);
  if (!visible && !present) return null;

  return <main data-loading-screen data-departing={!visible} className="brand-loading" role="status" aria-live="polite" aria-busy={visible} aria-hidden={!visible}>
    <div className="brand-loading-composition">
      <OpeningScene />
      <div className="brand-loading-center">
        <h1 className="brand-loading-name" aria-label="Astera Online">
          <span className="sr-only">Astera Online</span>
          <AsteraWordmark className="brand-loading-wordmark" />
          <span className="brand-loading-online" aria-hidden="true">ONLINE</span>
        </h1>
      </div>
      <div className="brand-loading-status">
        <div className="brand-loading-readout">
          <p className="brand-loading-caption">{shownCaption}</p>
          {known && <span className="brand-loading-percent">{pct}%</span>}
        </div>
        <div className="brand-loading-rail" role="progressbar" aria-label={shownCaption} aria-valuemin={0} aria-valuemax={100} {...(known ? { 'aria-valuenow': pct } : {})}>
          {known ? <span className="brand-loading-fill" style={{ transform: `scaleX(${String(pct / 100)})` }} /> : <span className="brand-loading-sweep" />}
        </div>
      </div>
    </div>
    <p className="brand-loading-address">asteraonline<span>.space</span></p>
  </main>;
}
