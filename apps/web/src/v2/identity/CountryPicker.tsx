import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CountryCode } from '@astera/rules';
import { Button, SectionHead } from '../kit/Surface.js';
import { Flag } from './Flag.js';
import { countryName, countryOptions } from './country.js';

export function CountryPicker({ value, onSelect, onClose }: {
  value: CountryCode;
  onSelect: (country: CountryCode) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState<CountryCode>(value);
  const [query, setQuery] = useState('');
  const language = i18n.resolvedLanguage ?? 'en';
  const options = useMemo(() => countryOptions(language, selected, query), [language, query, selected]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-v2-void/70 p-2 sm:items-center" role="dialog" aria-modal="true" aria-label={t('country.choose')}>
      <section className="flex max-h-[min(720px,92dvh)] w-full max-w-xl flex-col gap-3 rounded-sheet border border-v2-line bg-v2-panel p-3 font-v2-ui">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <SectionHead label={t('country.choose')} />
            <p className="mt-1 flex items-center gap-2 text-caption text-v2-ink-2"><Flag code={selected} language={language} />{countryName(selected, language)}</p>
          </div>
          <button type="button" aria-label={t('sheet.close')} className="text-v2-ink-2" onClick={() => { onClose(); }}>×</button>
        </header>
        <label className="sr-only" htmlFor="country-search">{t('country.searchLabel')}</label>
        <input id="country-search" className="min-h-12 w-full shrink-0 rounded-control border border-v2-line-hi bg-v2-deep px-3 text-body text-v2-ink outline-none focus:border-v2-self" type="search" placeholder={t('country.searchPlaceholder')} value={query} onChange={(event) => { setQuery(event.target.value); }} />
        <div className="min-h-0 overflow-y-auto" role="list" aria-label={t('country.list')}>
          {options.map(({ code, name }) => (
            <div key={code} role="listitem">
              <button type="button" aria-label={name} aria-pressed={selected === code} className={`flex min-h-10 w-full items-center gap-2 border-b border-v2-line px-2 text-left text-caption ${selected === code ? 'bg-v2-self/10 text-v2-self' : 'text-v2-ink-2'}`} onClick={() => { setSelected(code); }}>
                <Flag code={code} language={language} />
                <span className="min-w-0 flex-1 truncate">{name}</span>
                <span className="font-v2-mono text-micro text-v2-ink-3">{code}</span>
              </button>
            </div>
          ))}
        </div>
        <Button full variant="primary" onClick={() => { onSelect(selected); }}>{t('country.confirm')}</Button>
      </section>
    </div>
  );
}
