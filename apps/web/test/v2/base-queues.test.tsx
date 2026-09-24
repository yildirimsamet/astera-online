import type { ReactNode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { BuildOrderView } from '../../src/api/schemas.js';
import { ToastProvider } from '../../src/ui/Toast.js';
import { planetView } from '../fixtures.js';

const cancel = vi.fn();
vi.mock('../../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../src/api/queries.js');
  return { ...actual, useCancelBuildOrder: () => ({ mutate: cancel, isPending: false, variables: undefined }) };
});

const { BaseQueues } = await import('../../src/v2/shell/BaseQueues.js');

/**
 * THE BASE'S QUEUES AS RINGS. Spec B12 · E5 (docs/ui-v2/gozlemevi.md), the mock's
 * "Rafineri 12 dk · Ok ×12 5 dk · + Boş hat".
 *
 * Construction and the Yard each a lane of rings; a tap opens the queue sheet, where
 * a cancel is asked through Confirm before half of it burns. Nothing building stays
 * the owner's one line.
 */

const NOW = Date.now();

const order = (over: Partial<BuildOrderView> = {}): BuildOrderView => ({
  id: 'o1',
  queue: 'CONSTRUCTION',
  slot: 0,
  kind: 'BUILDING',
  subject: 'REFINERY',
  count: 1,
  startedAt: new Date(NOW - 60_000),
  finishesAt: new Date(NOW + 12 * 60_000),
  cost: { alloy: 100, crystal: 100, deuterium: 0 },
  ...over,
} as BuildOrderView);

const wrap = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;

describe('the Base queues', () => {
  it('stays one line while nothing builds', () => {
    render(<BaseQueues planet={planetView({ queues: { CONSTRUCTION: [], YARD: [] } })} />, { wrapper: wrap });
    expect(document.querySelector('[data-queues-idle]')).not.toBeNull();
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('draws construction and the yard as lanes of rings, free slots said', () => {
    render(<BaseQueues planet={planetView({ queues: { CONSTRUCTION: [order()], YARD: [] } })} />, { wrapper: wrap });
    expect(screen.getAllByRole('group')).toHaveLength(2);
    expect(document.querySelectorAll('[data-ring]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-free-slot]').length).toBeGreaterThan(0);
  });

  it('opens the queue sheet on a tap, and cancels only after Confirm', async () => {
    render(<BaseQueues planet={planetView({ queues: { CONSTRUCTION: [order()], YARD: [] } })} />, { wrapper: wrap });
    const user = userEvent.setup();
    await user.click(document.querySelector<HTMLElement>('[data-ring]')!.closest('button')!);
    const sheet = await screen.findByRole('dialog');
    expect(cancel).not.toHaveBeenCalled();
    const ask = within(sheet).getAllByRole('button').find((button) => /cancel/i.test(button.getAttribute('aria-label') ?? button.textContent));
    expect(ask).toBeDefined();
    await user.click(ask!);
    await user.click(await screen.findByTestId('confirm-commit'));
    expect(cancel).toHaveBeenCalledWith('o1', expect.anything());
  });
});
