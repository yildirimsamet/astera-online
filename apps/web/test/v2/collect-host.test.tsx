import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanetView } from '../../src/api/schemas.js';
import { ToastProvider } from '../../src/ui/Toast.js';
import { CollectHost } from '../../src/v2/shell/CollectHost.js';
import { planetView } from '../fixtures.js';

/**
 * THE COLLECT BUBBLE, WIRED. Spec B13 (docs/ui-v2/gozlemevi.md).
 *
 * It reads the active world's works, projected, and collects with the same
 * request and the same toast the header's Works control used — which it replaced.
 */

let planet: PlanetView = planetView();
let pending = false;
const mutate = vi.fn();

vi.mock('../../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../src/api/queries.js');
  return {
    ...actual,
    usePlanet: () => ({ data: planet, dataUpdatedAt: Date.now() }),
    useCollect: () => ({ mutate, isPending: pending }),
  };
});

beforeEach(() => {
  planet = planetView();
  pending = false;
  mutate.mockReset();
});

const host = (onOpenBase = vi.fn()) => render(<ToastProvider><CollectHost onOpenBase={onOpenBase} /></ToastProvider>);

describe('the wired collect bubble', () => {
  it('stays down while the works are nearly empty', () => {
    planet = planetView({}, { bufferAlloy: 20 });
    const { container } = host();
    expect(container.querySelector('button')).toBeNull();
  });

  it('collects once the works are worth it, in one request', async () => {
    planet = planetView({}, { bufferAlloy: 400, bufferCrystal: 30 });
    host();
    await userEvent.click(screen.getByRole('button', { name: 'Collect 400 alloy, 30 crystal' }));
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('says what came in', async () => {
    planet = planetView({}, { bufferAlloy: 400 });
    mutate.mockImplementation((_input: undefined, options: { onSuccess: (r: unknown) => void }) => {
      options.onSuccess({ moved: { alloy: 400, crystal: 0, deuterium: 0 }, blocked: { alloy: 0, crystal: 0, deuterium: 0 } });
    });
    host();
    await userEvent.click(screen.getByRole('button', { name: /^Collect/ }));
    expect(await screen.findByText('Collected 400')).toBeInTheDocument();
  });

  it('sends a full store to the base instead of collecting nothing', async () => {
    const onOpenBase = vi.fn();
    planet = planetView({}, { bufferAlloy: 400, alloy: 2000, crystal: 600, deuterium: 300 });
    host(onOpenBase);
    await userEvent.click(screen.getByRole('button', { name: 'Store full' }));
    expect(onOpenBase).toHaveBeenCalledTimes(1);
    expect(mutate).not.toHaveBeenCalled();
  });
});
