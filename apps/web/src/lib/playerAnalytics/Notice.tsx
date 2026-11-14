import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Toggle } from '../../game-ui/index.js';
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
  // The kit's switch (G1-f, 2026-11-14): its lamp says the state, so the name stays the name.
  return <Toggle checked={enabled} label={copy.label} onChange={(next) => { chooseAnalytics(next ? 'granted' : 'denied'); }} />;
}
