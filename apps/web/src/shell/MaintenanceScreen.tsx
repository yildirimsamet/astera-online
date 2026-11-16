import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../api/context.js';
import { AsteraWordmark } from '../brand/Identity.js';
import { OpeningScene } from '../brand/OpeningScene.js';
import { clockTime, countdown, useNow } from '../lib/time.js';
import { clearMaintenance } from '../platform/maintenanceGate.js';
import { reloadWebApp } from '../platform/updateGate.js';

/** How often the screen asks whether the server is back. */
const POLL_MS = 30_000;

/**
 * THE GAME IS IN PLANNED MAINTENANCE. Scaling plan F0.9.
 *
 * Says when it is expected back in the player's own clock and counts down to it; once
 * the public notice answers again the game reloads by itself, so nobody has to sit
 * pressing a button. The reopening is the operator's estimate: past it, the screen
 * says it is running long instead of showing a countdown at zero.
 */
export function MaintenanceScreen({ endsAt }: { endsAt: string | null }) {
  const { t } = useTranslation();
  const api = useApi();
  const now = useNow();
  useEffect(() => {
    let live = true;
    const id = window.setInterval(() => {
      void api.maintenanceNotice().then(() => {
        if (!live) return;
        live = false;
        clearMaintenance();
        reloadWebApp();
      }, () => undefined);
    }, POLL_MS);
    return () => { live = false; window.clearInterval(id); };
  }, [api]);

  const until = endsAt === null ? NaN : Date.parse(endsAt);
  const known = Number.isFinite(until);
  const left = until - now;
  return <main className="brand-loading" aria-labelledby="maintenance-title">
    <div className="brand-loading-composition">
      <OpeningScene />
      <div className="brand-loading-center">
        <p className="brand-loading-name" aria-hidden="true">
          <AsteraWordmark className="brand-loading-wordmark" />
          <span className="brand-loading-online">ONLINE</span>
        </p>
      </div>
      <div role="status" className="gk-brandstatus">
        <h1 id="maintenance-title" className="gk-display gk-brandstatus__title">
          <span aria-hidden="true" className="gk-brandstatus__lamp" />
          {t('app.maintenanceTitle')}
        </h1>
        <p className="gk-sub gk-brandstatus__body">{t('app.maintenanceBody')}</p>
        {known && (left > 0
          ? <div className="gk-brandstatus__clock">
            <p className="gk-sub">{t('app.maintenanceReturn', { time: clockTime(new Date(until)) })}</p>
            <p role="timer" className="gk-num">{countdown(left)}</p>
          </div>
          : <p className="gk-sub" data-tone="warn">{t('app.maintenanceLate')}</p>)}
        <div className="brand-loading-rail" aria-hidden="true"><span className="brand-loading-sweep" /></div>
        <p className="gk-note">{t('app.maintenanceBack')}</p>
      </div>
    </div>
  </main>;
}
