import { useTranslation } from 'react-i18next';
import { AsteraWordmark } from '../brand/Identity.js';
import { OpeningScene } from '../brand/OpeningScene.js';
import { runtime } from '../platform/runtime.js';
import { reloadWebApp } from '../platform/updateGate.js';
import { GameButton, Glyph } from '../game-ui/index.js';

const PLAY_STORE = 'https://play.google.com/store/apps/details?id=space.asteraonline.app';

/** The API refused this client: explain why, then reload the web or update the app. */
export function UpdateRequired() {
  const { t } = useTranslation();
  const platform = runtime();
  return <main className="brand-loading" aria-labelledby="update-required-title">
    <div className="brand-loading-composition">
      <OpeningScene />
      <div className="brand-loading-center">
        <p className="brand-loading-name" aria-hidden="true">
          <AsteraWordmark className="brand-loading-wordmark" />
          <span className="brand-loading-online">ONLINE</span>
        </p>
      </div>
      <div role="alert" className="gk-brandstatus">
        <h1 id="update-required-title" className="gk-display gk-brandstatus__title">{t('app.updateTitle')}</h1>
        <p className="gk-sub gk-brandstatus__body">{t(platform === 'web' ? 'app.updateWebBody' : 'app.updateBody')}</p>
        {platform === 'web' && (
          <GameButton tone="action" size="lg" wide glyph="refresh" onPress={reloadWebApp}>{t('app.reloadGame')}</GameButton>
        )}
        {platform === 'android' && (
          <a href={PLAY_STORE} target="_blank" rel="noopener noreferrer" className="gk-btn gk-btn--action gk-btn--lg gk-btn--wide">
            <span className="gk-btn__glyph"><Glyph id="up" /></span><span>{t('app.updateStore')}</span>
          </a>
        )}
      </div>
    </div>
  </main>;
}
