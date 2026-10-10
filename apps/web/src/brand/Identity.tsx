import wordmark from './wordmark.svg?raw';
import sigil from './sigil.svg?raw';
import { useTranslation } from 'react-i18next';
import { Icon } from '../v2/icons.js';
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
  return <div className={`brand-masthead${onShop ? ' brand-masthead-with-shop' : ''}`}>
    <div className="brand-masthead-lockup" aria-label="Astera Online">
      <AsteraSigil className="brand-masthead-sigil" />
      <span className="sr-only">Astera Online</span>
      <AsteraWordmark className="brand-masthead-wordmark" />
      <span className="brand-masthead-online" aria-hidden="true">ONLINE</span>
    </div>
    <span className="brand-masthead-rule" aria-hidden="true" />
    {onShop ? (
      <button type="button" data-shop-button className="brand-masthead-shop" onClick={onShop}>
        <span className="brand-masthead-shop-face">
          <Icon id="i-spark" className="size-3.5" />
          <span>{t('menu.skinsShopLabel')}</span>
          <Icon id="i-chev" className="size-3" />
        </span>
      </button>
    ) : <span className="brand-masthead-address">asteraonline<span>.space</span></span>}
  </div>;
}
