import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { AccountDeletionSheet } from '../src/screens/AccountDeletionSheet.js';
import i18n from '../src/i18n/index.js';

/**
 * ACCOUNT DELETION ON THE KIT (C25, 2026-11-15). It cannot be undone, so the request is the kit's
 * final hold — 1.5 s, red — and the steps before it stay: the current password and the switch
 * that says the commander understands. Enter in the password field never sends it.
 */
const REQUEST = { requestId: '5b2f0c1e-7a44-4d0e-9a51-3c8e2f6d9b10', requestedAt: new Date().toISOString(), status: 'requested' };

function show(existing: typeof REQUEST | null = null) {
  const sent: { path: string; body: unknown }[] = [];
  const fetcher: typeof fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    if (init?.method === 'POST') sent.push({ path: url, body });
    const result = init?.method === 'POST' ? { request: REQUEST } : { request: existing };
    return Promise.resolve(new Response(JSON.stringify(result), { status: 200, headers: { 'content-type': 'application/json' } }));
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ApiProvider api={new Api({ fetch: fetcher })}><AccountDeletionSheet onClose={vi.fn()} /></ApiProvider></QueryClientProvider>);
  return { sent };
}

const holdFor = async (element: HTMLElement, ms: number): Promise<void> => {
  fireEvent.pointerDown(element, { button: 0 });
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
  fireEvent.pointerUp(element);
};

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(() => { vi.useRealTimers(); });

describe('the deletion request', () => {
  it('says what it waits for before it can be held', async () => {
    show();
    const field = await screen.findByLabelText('Current password');
    expect(screen.getByRole('button', { name: /Enter your current password first/ })).toBeDisabled();
    fireEvent.change(field, { target: { value: 'correct-password' } });
    expect(screen.getByRole('button', { name: /Confirm that you understand first/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('switch', { name: /deleting my shared account and progress is permanent/ }));
    expect(screen.getByRole('button', { name: /Request account deletion/ })).toBeEnabled();
  });

  it('is a final red hold: a shorter hold sends nothing, the whole 1.5 s sends it once', async () => {
    const { sent } = show();
    fireEvent.change(await screen.findByLabelText('Current password'), { target: { value: 'correct-password' } });
    fireEvent.click(screen.getByRole('switch', { name: /permanent/ }));
    const hold = screen.getByRole('button', { name: /Request account deletion/ });
    expect(hold).toHaveClass('gk-btn--danger');
    vi.useFakeTimers();
    await holdFor(hold, 1_400);
    expect(sent).toHaveLength(0);
    await holdFor(screen.getByRole('button', { name: /Request account deletion/ }), 1_500);
    vi.useRealTimers();
    expect(await screen.findByText('Deletion request received')).toBeInTheDocument();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.body).toMatchObject({ currentPassword: 'correct-password' });
  });

  it('never sends from the Enter key in the password field', async () => {
    const { sent } = show();
    const field = await screen.findByLabelText('Current password');
    fireEvent.change(field, { target: { value: 'correct-password' } });
    fireEvent.click(screen.getByRole('switch', { name: /permanent/ }));
    fireEvent.keyDown(field, { key: 'Enter' });
    fireEvent.submit(field);
    await act(async () => { await Promise.resolve(); });
    expect(sent).toHaveLength(0);
  });

  it('shows a request already received with its reference', async () => {
    show(REQUEST);
    expect(await screen.findByText('Deletion request received')).toBeInTheDocument();
    expect(screen.getByText(REQUEST.requestId)).toBeInTheDocument();
    expect(screen.queryByLabelText('Current password')).toBeNull();
  });

  it('is drawn in the game kit, red-rimmed', async () => {
    show();
    await screen.findByLabelText('Current password');
    const body = document.querySelector('[data-deletion-sheet]');
    expect(body?.closest('.gk-sheet')).not.toBeNull();
    const names = [body!, ...body!.querySelectorAll('[class]')].flatMap((node) => (node.getAttribute('class') ?? '').split(/\s+/));
    expect(names.filter((name) => /(^|-)v2(-|$)/.test(name))).toEqual([]);
  });
});
