import { useTranslation } from 'react-i18next';
import { currentLanguage } from '../i18n/index.js';
import { setLanguage } from '../i18n/document.js';
import { isLanguage, LANGUAGES, LANGUAGE_LABEL } from '../i18n/languages.js';

/** The app language is a real list now; a native select keeps all five choices usable on mobile. */
export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const active = currentLanguage();

  return (
    <label className={compact ? 'block w-auto' : 'block w-full'}>
      <span className="sr-only">{t('settings.choose')}</span>
      <select
        aria-label={t('settings.choose')}
        className={`field min-h-9 ${compact ? 'w-auto py-1' : 'w-full'}`}
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
