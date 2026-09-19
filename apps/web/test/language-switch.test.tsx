import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../src/i18n/index.js';
import { LanguageSwitch } from '../src/ui/LanguageSwitch.js';

describe('language switch', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
  });

  it('offers every supported language in a dropdown and changes the app language', async () => {
    const user = userEvent.setup();
    render(<LanguageSwitch />);

    const select = screen.getByRole('combobox', { name: 'Choose a language' });
    expect(select).toHaveValue('en');
    expect(screen.getAllByRole('option')).toHaveLength(5);

    await user.selectOptions(select, 'de');
    expect(select).toHaveValue('de');
    expect(i18n.resolvedLanguage).toBe('de');
  });
});
