import { useTranslation } from 'react-i18next';
import { haptic } from '../lib/haptics.js';
import { currentLanguage } from '../i18n/index.js';
import { setLanguage } from '../i18n/document.js';
import { LANGUAGES, LANGUAGE_LABEL, LANGUAGE_SHORT } from '../i18n/languages.js';

/**
 * THE WAY TO CHANGE THE LANGUAGE, AND IT IS NOT HIDDEN BEHIND A GEAR.
 *
 * Two languages is not a list — it is a pair — so this is a segmented control and
 * never a dropdown. Both options are visible and one tap apart, which is what a
 * player who has landed in the wrong language needs: they cannot read the label
 * on a menu that would take them to the setting, so the setting has to be the
 * thing they can see.
 *
 * IT LIVES IN TWO PLACES, AND BOTH ARE DELIBERATE. On the commander sheet, beside
 * the galaxy and the way out, because that is the one surface in the game about
 * the account rather than the world (D21, D54). And on the front door, because a
 * visitor who cannot read the premise has not signed in yet and cannot reach a
 * sheet that only exists after they have.
 *
 * Each option is labelled IN ITS OWN LANGUAGE — "Türkçe", never "Turkish". That is
 * the one rule of a language picker that is never negotiable: the person who needs
 * it is by definition the person who cannot read the other one.
 */
export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const active = currentLanguage();

  /**
   * THE COMPACT FORM IS FURNITURE, NOT A CONTROL COMPETING FOR ATTENTION.
   *
   * On the front door it sits in the top corner of a page whose whole job is to
   * make somebody press ONE thing. Two outlined pills up there read as a second
   * decision; a single hairline segment reads as a setting, which is what it is.
   * The full form — used on the commander sheet, where it is one of three
   * settings in a list — is unchanged.
   */
  if (compact) {
    return (
      <div
        role="group"
        aria-label={t('settings.choose')}
        className="flex overflow-hidden rounded-full border border-line/70 bg-void/45"
      >
        {LANGUAGES.map((language) => {
          const on = language === active;
          return (
            <button
              key={language}
              type="button"
              lang={language}
              aria-pressed={on}
              onClick={() => {
                if (on) return;
                haptic('tap');
                void setLanguage(language);
              }}
              className={`px-2.5 py-1 font-display text-[10px] uppercase tracking-[0.14em] transition-colors ${
                on ? 'bg-line/50 text-bone' : 'text-faint hover:text-dim'
              }`}
            >
              {LANGUAGE_SHORT[language]}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="group" aria-label={t('settings.choose')} className="flex gap-2">
      {LANGUAGES.map((language) => {
        const on = language === active;
        return (
          <button
            key={language}
            type="button"
            lang={language}
            aria-pressed={on}
            onClick={() => {
              if (on) return;
              haptic('tap');
              void setLanguage(language);
            }}
            className={`btn flex-1 py-2 text-[13px] ${
              on ? 'border-crystal/60 text-crystal' : 'text-dim'
            }`}
          >
            {LANGUAGE_LABEL[language]}
          </button>
        );
      })}
    </div>
  );
}
