import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import '../src/i18n/index.js';
import AdminPanel from '../src/screens/AdminPanel.js';

/**
 * Owner 2026-10-28: every commander may fly the Yarık (`ARENA_PILOTS=*`), so the
 * pilot-seat tab is gone from the operator's desk; the desk never asks for seats.
 */
describe('the admin desk tabs', () => {
  it('offers no Commander ship seat tab and never reads the seat list', () => {
    const urls: string[] = [];
    const fetch = vi.fn((url: string) => {
      urls.push(url);
      return Promise.resolve(new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } }));
    });
    const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>
    );
    render(<Wrapper><AdminPanel /></Wrapper>);
    const tabs = screen.getAllByRole('tab').map(tab => tab.textContent);
    expect(tabs).toHaveLength(9);
    expect(tabs).not.toContain('Commander ship');
    expect(tabs).not.toContain('Komutan gemisi');
    expect(document.getElementById('admin-arena-tab')).toBeNull();
    expect(urls.some(url => url.includes('arena-pilots'))).toBe(false);
  });
});
