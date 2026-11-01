import { useEffect, useRef } from 'react';

/** Only the top Legacy sheet owns focus; closing restores the piece/name that opened it. */
export function useLegacyDialogFocus() {
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const body = content.current, dialog = body?.closest('[role="dialog"]');
    if (!body || !dialog) return;
    const previous = document.activeElement;
    body.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const layers = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
      if (layers[layers.length - 1] !== dialog) return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]'))
        .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('[hidden], [inert]')
          && getComputedStyle(element).visibility !== 'hidden' && getComputedStyle(element).display !== 'none');
      const first = controls[0], last = controls.at(-1), focused = document.activeElement;
      if (!first || !last) { event.preventDefault(); body.focus(); return; }
      if (!dialog.contains(focused) || focused === body || (event.shiftKey ? focused === first : focused === last)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return content;
}
