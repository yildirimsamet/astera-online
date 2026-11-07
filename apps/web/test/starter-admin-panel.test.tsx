import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { AdminStarterPanel } from '../src/screens/AdminStarterPanel.js';

afterEach(cleanup);

describe('the operator\'s starter desk', () => {
  it('reads what the server counted', async () => {
    const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
    vi.spyOn(api, 'adminStarter').mockResolvedValue({
      ships: { active: 41, dormant: 3, departed: 12 }, people: 30, crew: 14, spread: [20, 10, 9, 5],
      galaxies: [{ ordinal: 1, capacity: 30, seated: 29, open: false }, { ordinal: 2, capacity: 30, seated: 15, open: true }],
      queue: { lagSeconds: 4, failed: 2 },
    });
    render(<QueryClientProvider client={new QueryClient()}><ApiProvider api={api}><AdminStarterPanel /></ApiProvider></QueryClientProvider>);
    expect(await screen.findByTestId('starter-active')).toHaveProperty('textContent', '41');
    expect(screen.getByTestId('starter-people').textContent).toContain('30');
    expect(screen.getByTestId('starter-crew').textContent).toContain('14');
    expect(screen.getByTestId('starter-failed').textContent).toBe('2');
    expect(screen.getAllByTestId('starter-galaxy')).toHaveLength(2);
    expect(screen.getAllByTestId('starter-band')).toHaveLength(4);
  });
});
