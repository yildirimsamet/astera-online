import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { RESOURCE_ART } from '../ui/assets.js';
import { AsteraSigil, AsteraWordmark } from './Identity.js';

/** Both brand dialogs keep keyboard focus inside the card and restore its opener. */
export function useBrandPanelFocus(open = true, completed = false) {
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    // Read the question before choosing: do not highlight a random answer.
    content.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const dialog = content.current?.closest('[role="dialog"]');
      if (!dialog) return;
      const buttons = dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (!first || !last) return;
      const focused = document.activeElement;
      if (!Array.from(buttons).some((button) => button === focused) || (event.shiftKey ? focused === first : focused === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [open]);
  useEffect(() => { if (open && completed) content.current?.querySelector('button')?.focus(); }, [open, completed]);
  return content;
}

export function BrandLockup() {
  return <div className="gk-quizbrand" aria-label="Astera Online">
    <span className="sr-only">Astera Online</span><AsteraSigil className="gk-quizbrand__sigil" />
    <AsteraWordmark className="gk-quizbrand__word" /><span aria-hidden="true">ONLINE</span>
  </div>;
}

/** The quiz's reward, first, on the kit's figures in each resource's colour (G13-d). */
export function BrandRewardTray({ reward, label }: { reward: { alloy: number; crystal: number; deuterium: number }; label: string }) {
  const { t, i18n } = useTranslation();
  return <div className="gk-well gk-quizreward">
    <p className="gk-label">{label}</p>
    <dl>{(['alloy', 'crystal', 'deuterium'] as const).map(resource => <div key={resource} data-resource={resource}>
      <dt><img src={RESOURCE_ART[resource]} alt="" draggable={false} /><span>{t(`vocabulary.resource.${resource}`)}</span></dt>
      <dd className="gk-num">+{reward[resource].toLocaleString(i18n.resolvedLanguage)}</dd>
    </div>)}</dl>
  </div>;
}
