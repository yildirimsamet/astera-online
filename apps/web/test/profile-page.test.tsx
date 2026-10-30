import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { ProfilePage } from '../src/shell/ProfilePage.js';
import i18n from '../src/i18n/index.js';

beforeEach(async () => { await i18n.changeLanguage('en'); });

function show() {
  const api = new Api({ fetch: () => Promise.resolve(new Response('{}', { headers: { 'content-type': 'application/json' } })) });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>;
  const onBack = vi.fn(), onSignOut = vi.fn();
  render(<ProfilePage name="Orion" onBack={onBack} onSignOut={onSignOut} />, { wrapper });
  return { onBack, onSignOut };
}

it('uses the shared sheet and focuses its content while keeping account actions available', () => {
  const { onSignOut } = show();
  expect(screen.getByRole('dialog', { name: i18n.t('menu.navigation.account') })).toHaveAttribute('data-placement', 'page');
  expect(screen.getByRole('region', { name: i18n.t('menu.navigation.account') })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: i18n.t('galaxy.commander.signOut') }));
  expect(onSignOut).toHaveBeenCalledOnce();
});

it('closes a nested vacation sheet on Escape without leaving the profile', () => {
  const { onBack } = show();
  const vacation = screen.getByRole('button', { name: /^Vacation mode\./ });
  vacation.focus();
  fireEvent.click(vacation);
  expect(screen.getByRole('dialog', { name: i18n.t('vacation.title') })).toBeVisible();
  fireEvent.keyDown(vacation, { key: 'Escape' });
  expect(onBack).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog', { name: i18n.t('vacation.title') })).toBeNull();
  // Closing a portal may leave focus on the document body.
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(onBack).toHaveBeenCalledOnce();
});

it('routes Android Back to the page return when no dialog is open', () => {
  const { onBack } = show();
  const event = new Event('astera:native-back', { bubbles: true, cancelable: true });
  screen.getByRole('dialog', { name: i18n.t('menu.navigation.account') }).dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(onBack).toHaveBeenCalledOnce();
});
