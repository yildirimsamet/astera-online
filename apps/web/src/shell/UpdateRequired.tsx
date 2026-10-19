import { useTranslation } from 'react-i18next';
import { AsteraWordmark } from '../brand/Identity.js';
import { OpeningScene } from '../brand/OpeningScene.js';
import { runtime } from '../platform/runtime.js';

const PLAY_STORE = 'https://play.google.com/store/apps/details?id=space.asteraonline.app';

/** The API refused this bundled build: the opening scene, one sentence of why, one way forward. */
export function UpdateRequired() {
  const { t } = useTranslation();
  return <main className="brand-loading" aria-labelledby="update-required-title">
    <div className="brand-loading-composition">
      <OpeningScene />
      <div className="brand-loading-center">
        <p className="brand-loading-name" aria-hidden="true">
          <AsteraWordmark className="brand-loading-wordmark" />
          <span className="brand-loading-online">ONLINE</span>
        </p>
      </div>
      <div role="alert" className="mx-auto mt-8 w-[min(86%,320px)] text-left">
        <h1 id="update-required-title" className="text-title font-semibold text-bone">{t('app.updateTitle')}</h1>
        <p className="mt-2 text-body leading-relaxed text-bone/80">{t('app.updateBody')}</p>
        {runtime() === 'android' && (
          <a href={PLAY_STORE} target="_blank" rel="noopener noreferrer"
            className="slab slab-primary mt-4 flex min-h-[52px] w-full items-center justify-center px-6 py-3 text-center text-body">
            {t('app.updateStore')}
          </a>
        )}
      </div>
    </div>
  </main>;
}
