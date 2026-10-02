import { useTranslation } from 'react-i18next';
import { currentLanguage } from '../i18n/index.js';
import { setLanguage } from '../i18n/document.js';
import { isLanguage, LANGUAGES, LANGUAGE_LABEL } from '../i18n/languages.js';

/** A native select keeps every supported language usable on mobile. */
export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const active = currentLanguage();

  return (
    <label className={compact ? 'block w-auto' : 'block w-full'}>
      <span className="sr-only">{t('settings.choose')}</span>
      <select
        aria-label={t('settings.choose')}
        className={`min-h-10 rounded-control border border-v2-line-hi bg-v2-deep px-3 font-v2-ui text-caption text-v2-ink outline-none focus-visible:border-v2-self focus-visible:ring-1 focus-visible:ring-v2-self/30 ${compact ? 'w-auto' : 'w-full'}`}
        value={active}
        onChange={(event) => {
          const next = event.currentTarget.value;
          if (isLanguage(next)) void setLanguage(next);
        }}
      >
        {LANGUAGES.map((language) => (
          <option key={language} value={language}>{LANGUAGE_LABEL[language]}</option>
        ))}
      </select>
    </label>
  );
}
