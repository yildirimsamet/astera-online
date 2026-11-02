import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { analyticsCopy } from './copy.js';
import { analyticsAvailable, analyticsChoice, chooseAnalytics, ANALYTICS_CHOICE_EVENT } from './preference.js';

/** A persistent off switch; no initial permission dialog. */
export function AnalyticsSetting() {
  const { i18n } = useTranslation();
  const [choice, setChoice] = useState(analyticsChoice);
  useEffect(() => {
    const changed = (event: Event) => {
      const detail: unknown = event instanceof CustomEvent ? event.detail : undefined;
      setChoice(detail === 'granted' || detail === 'denied' ? detail : analyticsChoice());
    };
    window.addEventListener(ANALYTICS_CHOICE_EVENT, changed); window.addEventListener('storage', changed);
    return () => { window.removeEventListener(ANALYTICS_CHOICE_EVENT, changed); window.removeEventListener('storage', changed); };
  }, []);
  if (!analyticsAvailable()) return null;
  const copy = analyticsCopy(i18n.resolvedLanguage), enabled = choice !== 'denied';
  return <button type="button" aria-pressed={enabled} className="min-h-11 w-full px-3 text-left text-label text-v2-ink focus-visible:outline-2 focus-visible:outline-v2-self"
    onClick={() => { chooseAnalytics(enabled ? 'denied' : 'granted'); }}>{enabled ? copy.on : copy.off}</button>;
}
