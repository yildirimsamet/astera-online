import { useMemo, useRef, useState } from 'react';
import { useNativeBack } from '../../platform/nativeBack.js';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { CountryCode } from '@astera/rules';
import { GameButton, Glyph, RoundButton } from '../../game-ui/index.js';
import { haptic } from '../../lib/haptics.js';
import { OWN_SOUND, playSound } from '../../lib/sound.js';
import { useOwnPress } from '../../ui/kit/useOwnPress.js';
import { Flag } from './Flag.js';
import { countryName, countryOptions } from './country.js';

/**
 * THE FLAG A COMMANDER FLIES (G10, C26 2026-11-15): from the account page and at sign-up. The
 * chosen country heads the plate and the list, lit and ticked; a search narrows the list; the
 * choice is only sent by the confirm, so a stray tap in a long list costs nothing.
 */
export function CountryPicker({ value, onSelect, onClose }: {
  value: CountryCode;
  onSelect: (country: CountryCode) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const panel = useRef<HTMLDivElement>(null);
  useNativeBack(panel, onClose);
  const [selected, setSelected] = useState<CountryCode>(value);
  const [query, setQuery] = useState('');
  const language = i18n.resolvedLanguage ?? 'en';
  const options = useMemo(() => countryOptions(language, selected, query), [language, query, selected]);

  return createPortal(
    <div ref={panel} className="gk gk-cpick fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={t('country.choose')}>
      <section className="gk-cpick__panel gk-plate gk-bolts">
        <header className="gk-cpick__head">
          <div className="min-w-0">
            <p className="gk-label">{t('country.choose')}</p>
            <p className="gk-cpick__now"><Flag code={selected} language={language} /><span>{countryName(selected, language)}</span></p>
          </div>
          <RoundButton glyph="close" label={t('sheet.close')} onPress={onClose} />
        </header>
        <label className="sr-only" htmlFor="country-search">{t('country.searchLabel')}</label>
        <input id="country-search" className="gk-field__input" type="search" placeholder={t('country.searchPlaceholder')} value={query}
          onChange={(event) => { setQuery(event.target.value); }} />
        <div className="gk-cpick__list gk-well" role="list" aria-label={t('country.list')}>
          {options.map(({ code, name }) => (
            <div key={code} role="listitem">
              <CountryRow code={code} name={name} language={language} chosen={selected === code} onPress={() => { setSelected(code); }} />
            </div>
          ))}
        </div>
        <GameButton tone="action" size="lg" wide onPress={() => { onSelect(selected); }}>{t('country.confirm')}</GameButton>
      </section>
    </div>,
    document.body,
  );
}

function CountryRow({ code, name, language, chosen, onPress }: { code: CountryCode; name: string; language: string; chosen: boolean; onPress: () => void }) {
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); onPress(); });
  return (
    <button type="button" {...OWN_SOUND} aria-label={name} aria-pressed={chosen} className="gk-cpick__row"
      onPointerDown={own.onPointerDown} onClick={own.onClick}>
      <Flag code={code} language={language} className="gk-cpick__flag" />
      <span className="gk-cpick__name">{name}</span>
      <span className="gk-cpick__code gk-num">{code}</span>
      <span className="gk-cpick__tick" aria-hidden="true">{chosen && <Glyph id="check" />}</span>
    </button>
  );
}
