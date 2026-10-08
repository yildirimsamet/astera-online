import wordmark from './wordmark.svg?raw';
import sigil from './sigil.svg?raw';
const wordmarkMarkup = { __html: wordmark };
const sigilMarkup = { __html: sigil };

/** The first HTML and every branded surface share these trusted local SVG sources. */
export function AsteraWordmark({ className = '' }: { className?: string }) {
  return <span className={className} aria-hidden="true" dangerouslySetInnerHTML={wordmarkMarkup} />;
}

export function AsteraSigil({ className = '' }: { className?: string }) {
  return <span className={className} aria-hidden="true" dangerouslySetInnerHTML={sigilMarkup} />;
}

export function BrandMasthead() {
  return <div className="brand-masthead">
    <div className="brand-masthead-lockup" aria-label="Astera Online">
      <AsteraSigil className="brand-masthead-sigil" />
      <span className="sr-only">Astera Online</span>
      <AsteraWordmark className="brand-masthead-wordmark" />
      <span className="brand-masthead-online" aria-hidden="true">ONLINE</span>
    </div>
    <span className="brand-masthead-rule" aria-hidden="true" />
    <span className="brand-masthead-address">asteraonline<span>.space</span></span>
  </div>;
}
