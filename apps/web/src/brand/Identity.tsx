import wordmark from './wordmark.svg?raw';
import sigil from './sigil.svg?raw';
import { useTranslation } from 'react-i18next';
import { Icon } from '../v2/icons.js';
import { FullscreenButton } from './FullscreenButton.js';
import { capabilities } from '../platform/runtime.js';
const wordmarkMarkup = { __html: wordmark };
const sigilMarkup = { __html: sigil };

/** The first HTML and every branded surface share these trusted local SVG sources. */
export function AsteraWordmark({ className = '' }: { className?: string }) {
  return <span className={className} aria-hidden="true" dangerouslySetInnerHTML={wordmarkMarkup} />;
}

export function AsteraSigil({ className = '' }: { className?: string }) {
  return <span className={className} aria-hidden="true" dangerouslySetInnerHTML={sigilMarkup} />;
}

export function BrandMasthead({ onShop }: { onShop?: () => void }) {
  const { t } = useTranslation();
  const showShop = Boolean(onShop) && capabilities().webCheckout;
  return <div className={`brand-masthead${showShop ? ' brand-masthead-with-shop' : ''}`}>
    <div className="brand-masthead-lockup" aria-label="Astera Online">
      <AsteraSigil className="brand-masthead-sigil" />
      <span className="sr-only">Astera Online</span>
      <AsteraWordmark className="brand-masthead-wordmark" />
      <span className="brand-masthead-online" aria-hidden="true">ONLINE</span>
    </div>
    <span className="brand-masthead-rule" aria-hidden="true" />
    {showShop ? (
      <div className="brand-masthead-actions">
        <button type="button" data-shop-button className="brand-masthead-shop" onClick={onShop}>
          <span className="brand-masthead-shop-face">
            <span>{t('menu.skinsShopLabel')}</span>
            <Icon id="i-chev" className="size-3" />
          </span>
        </button>
        <FullscreenButton />
      </div>
    ) : <span className="brand-masthead-address">asteraonline<span>.space</span></span>}
  </div>;
}
