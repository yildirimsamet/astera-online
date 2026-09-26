import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../src/i18n/index.js';
import { CountryPicker } from '../src/v2/identity/CountryPicker.js';
import { Flag } from '../src/v2/identity/Flag.js';
import { detectCountry } from '../src/v2/identity/country.js';
import { ClaimDialog } from '../src/onboarding/ClaimDialog.js';
import { MenuPanel } from '../src/shell/MenuPanel.js';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('country identity', () => {
  it('draws the authored SVG flag with a localised accessible name', () => {
    render(<Flag code="TR" language="en" />);
    const flag = screen.getByRole('img', { name: 'Türkiye' });
    expect(flag.getAttribute('src')).toMatch(/tr\.svg/);
  });

  it('falls back to the two-letter code when no flag exists', () => {
    render(<Flag code="XX" language="en" />);
    expect(screen.getByLabelText('XX')).toHaveTextContent('XX');
  });

  it('infers the first valid browser region and otherwise defaults to Türkiye', () => {
    expect(detectCountry({ languages: ['de-AT', 'en-US'], language: 'de-AT' })).toBe('AT');
    expect(detectCountry({ languages: ['tr', 'en'], language: 'tr' })).toBe('TR');
    expect(detectCountry({ languages: ['xx'], language: 'xx' })).toBe('TR');
  });
});

describe('the country picker', () => {
  it('keeps its search field at a comfortable touch height', () => {
    render(<CountryPicker value="TR" onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('searchbox')).toHaveClass('min-h-12', 'shrink-0');
  });
  it('keeps the current country first and returns a new selection', async () => {
    const onSelect = vi.fn();
    render(<CountryPicker value="DE" onSelect={onSelect} onClose={vi.fn()} />);

    const list = screen.getByRole('list', { name: 'Countries' });
    expect(within(list).getAllByRole('button')[0]).toHaveAccessibleName(/Germany/);
    await userEvent.setup().click(within(list).getByRole('button', { name: /Japan/ }));
    expect(onSelect).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Confirm country' }));
    expect(onSelect).toHaveBeenCalledWith('JP');
  });

  it('folds Turkish dotted and dotless i while searching local country names', async () => {
    await i18n.changeLanguage('tr');
    const onSelect = vi.fn();
    render(<CountryPicker value="TR" onSelect={onSelect} onClose={vi.fn()} />);

    await userEvent.setup().type(screen.getByRole('searchbox'), 'isp');
    const list = screen.getByRole('list', { name: 'Ülkeler' });
    expect(within(list).getAllByRole('button')).toHaveLength(1);
    await userEvent.setup().click(within(list).getByRole('button', { name: /İspanya/ }));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ülkeyi onayla' }));
    expect(onSelect).toHaveBeenCalledWith('ES');
  });

  it('carries the selected country into the registration claim', async () => {
    const onClaim = vi.fn(() => Promise.resolve());
    render(<ClaimDialog planetName="Kestrel" onClaim={onClaim} onSignIn={vi.fn()} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Commander name'), 'NewPilot');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: /United States/ }));
    await user.type(screen.getByRole('searchbox'), 'Japan');
    await user.click(within(screen.getByRole('list', { name: 'Countries' })).getByRole('button', { name: 'Japan' }));
    await user.click(screen.getByRole('button', { name: 'Confirm country' }));
    expect(screen.getByRole('button', { name: /Japan/ })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Password'), 'a-real-password');
    await user.click(screen.getByRole('button', { name: /claim/i }));
    expect(onClaim).toHaveBeenCalledWith('NewPilot', 'a-real-password', 'JP');
  });

  it('lets a taken commander name be edited and resubmitted on the password step', async () => {
    const onClaim = vi.fn(() => Promise.reject(new Error('taken')));
    const view = render(<ClaimDialog planetName="Kestrel" onClaim={onClaim} onSignIn={vi.fn()} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Commander name'), '李 小龙');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText('Password'), 'a-real-password');
    await user.click(screen.getByRole('button', { name: /claim/i }));
    view.rerender(<ClaimDialog planetName="Kestrel" onClaim={onClaim} onSignIn={vi.fn()} error="Name taken" />);
    expect(screen.getByLabelText('Commander name')).toHaveClass('field-bad');
    expect(screen.getByLabelText('Password')).not.toHaveClass('field-bad');
    await user.clear(screen.getByLabelText('Commander name'));
    await user.type(screen.getByLabelText('Commander name'), 'عَلِيّ');
    await user.click(screen.getByRole('button', { name: /claim/i }));
    expect(onClaim).toHaveBeenLastCalledWith('عَلِيّ', 'a-real-password', expect.any(String));
  });

  it('marks only the field that failed local validation', async () => {
    render(<ClaimDialog planetName="Kestrel" onClaim={vi.fn()} onSignIn={vi.fn()} />);
    const user = userEvent.setup();
    const name = screen.getByLabelText('Commander name');
    await user.type(name, 'A');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(name).toHaveClass('field-bad');
    await user.type(name, 'lice');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    const password = screen.getByLabelText('Password');
    await user.type(password, 'short');
    await user.click(screen.getByRole('button', { name: /claim/i }));
    expect(password).toHaveClass('field-bad');
    expect(name).not.toHaveClass('field-bad');
  });

  it('hides the previous name refusal while a corrected claim is pending', async () => {
    let finish: (() => void) | undefined;
    const onClaim = vi.fn()
      .mockRejectedValueOnce(new Error('taken'))
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    const view = render(<ClaimDialog planetName="Kestrel" onClaim={onClaim} onSignIn={vi.fn()} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Commander name'), 'First Pilot');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText('Password'), 'a-real-password');
    await user.click(screen.getByRole('button', { name: /claim/i }));
    view.rerender(<ClaimDialog planetName="Kestrel" onClaim={onClaim} onSignIn={vi.fn()} error="Name taken" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Name taken');
    await user.clear(screen.getByLabelText('Commander name'));
    await user.type(screen.getByLabelText('Commander name'), 'Second Pilot');
    await user.click(screen.getByRole('button', { name: /claim/i }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    finish?.();
  });

  it('updates the commander country from the account menu', async () => {
    const onCountryChange = vi.fn(() => Promise.resolve());
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
    render(
      <QueryClientProvider client={client}>
        <ApiProvider api={api}>
          <MenuPanel galaxy="Vantage" shard="EU-1" endsAt={null} country="TR" onCountryChange={onCountryChange} onOpen={vi.fn()} onSignOut={vi.fn()} />
        </ApiProvider>
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Türkiye/ }));
    await user.type(screen.getByRole('searchbox'), 'Spain');
    await user.click(within(screen.getByRole('list', { name: 'Countries' })).getByRole('button', { name: 'Spain' }));
    await user.click(screen.getByRole('button', { name: 'Confirm country' }));
    expect(onCountryChange).toHaveBeenCalledWith('ES');
  });
});
