import { useTranslation } from 'react-i18next';
import { currentLanguage } from '../i18n/index.js';
import { setLanguage } from '../i18n/document.js';
import { LANGUAGES, LANGUAGE_LABEL, LANGUAGE_SHORT } from '../i18n/languages.js';
import { Segmented } from './kit/index.js';

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
 *
 * ONE CONTROL, TWO DENSITIES — AND IT USED TO BE TWO CONTROLS.
 *
 * The front door drew a hairline pill where the selected half was filled; the
 * commander sheet drew two detached slabs where the selected one was distinguished
 * by cyan TEXT and a `border-crystal/60` that never rendered, because `.btn` sets
 * `border: 0` and a colour with no width is a declaration the browser drops in
 * silence. So the same setting had two shapes and two different grammars for
 * "this one is on", and on the surface where the question is loudest, half of the
 * answer was missing.
 *
 * There is one track and one grammar now: THE SELECTED SEGMENT IS THE ONE THAT IS
 * LIT AND RAISED. `compact` changes the size of the thing, never what it is.
 */
export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const active = currentLanguage();

  return (
    <Segmented
      label={t('settings.choose')}
      size={compact ? 'sm' : 'md'}
      className={compact ? 'w-auto' : 'w-full'}
      segments={LANGUAGES.map((language) => ({
        id: language,
        label: compact ? LANGUAGE_SHORT[language] : LANGUAGE_LABEL[language],
        // The short form is an abbreviation, so the announced name stays the
        // language's own word — the one rule of a language picker.
        ...(compact ? { hint: LANGUAGE_LABEL[language] } : {}),
      }))}
      value={active}
      onSelect={(language) => {
        void setLanguage(language);
      }}
    />
  );
}
