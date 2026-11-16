import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../src/i18n/index.js';
import { AuthDialog } from '../src/screens/LandingAuthDialog.js';

/**
 * G13-b (2026-11-16): THE SIGN-IN ON THE GAME KIT. "Let me back in." The sheet is a kit panel;
 * its two fields the kit's glass slots under kit labels, a refusal a kit banner in the colour of
 * harm with the field it names lit, one lit press to sign in, and the two side ways (a forgotten
 * password, a new commander) as quiet kit presses.
 */

const OLD = /(^|\s)(text|bg|border|font|ring|decoration|placeholder:text)-v2-|rounded-(control|sheet)|(^|\s)text-(micro|body|caption|label|title|figure)(\s|$)/;
const oldPaint = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => OLD.test(name));

const open = (onSubmit = vi.fn().mockResolvedValue(undefined)) => {
  render(<AuthDialog onBegin={vi.fn()} onClose={vi.fn()} onSubmit={onSubmit} />);
  return screen.getByRole('dialog');
};
const press = (element: HTMLElement): void => {
  fireEvent.pointerDown(element, { button: 0 });
  fireEvent.click(element, { detail: 1 });
};

beforeEach(async () => { if (i18n.resolvedLanguage !== 'en') await i18n.changeLanguage('en'); });

describe('the sign-in on the kit', () => {
  it('is a kit panel with none of the old look', () => {
    const dialog = open();
    expect(dialog.querySelector('form')).toHaveClass('gk-authsheet');
    expect(oldPaint(dialog)).toEqual([]);
    expect(screen.getByRole('button', { name: i18n.t('landing.form.close') })).toHaveClass('gk-round');
  });

  it('asks in the kit’s glass slots and signs in on the one lit press', () => {
    open();
    for (const label of [i18n.t('accountSecurity.loginLabel'), i18n.t('landing.form.passwordLabel')]) {
      expect(screen.getByLabelText(label)).toHaveClass('gk-field__input');
    }
    const submit = screen.getByRole('button', { name: i18n.t('landing.form.submitLogin') });
    expect(submit).toHaveClass('gk-btn', 'gk-btn--action');
    expect(submit).toHaveAttribute('type', 'submit');
    expect(screen.getByRole('button', { name: i18n.t('accountSecurity.forgot') })).toHaveClass('gk-btn--ghost');
    expect(screen.getByRole('button', { name: i18n.t('landing.form.switchToRegister') })).toHaveClass('gk-btn--ghost');
  });

  it('says a refusal on a kit banner and lights the field it names', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    open(onSubmit);
    press(screen.getByRole('button', { name: i18n.t('landing.form.submitLogin') }));
    expect(onSubmit).not.toHaveBeenCalled();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('gk-banner', 'gk-banner--hostile');
    expect(alert).toHaveTextContent(i18n.t('accountSecurity.identifierRequired'));
    expect(screen.getByLabelText(i18n.t('accountSecurity.loginLabel'))).toHaveAttribute('aria-invalid', 'true');
  });

  it('still signs in once per press through the form', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    open(onSubmit);
    fireEvent.change(screen.getByLabelText(i18n.t('accountSecurity.loginLabel')), { target: { value: 'nova' } });
    fireEvent.change(screen.getByLabelText(i18n.t('landing.form.passwordLabel')), { target: { value: 'secret-pass' } });
    press(screen.getByRole('button', { name: i18n.t('landing.form.submitLogin') }));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith('login', 'nova', 'secret-pass');
  });
});
