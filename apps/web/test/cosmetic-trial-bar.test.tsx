import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import i18n from '../src/i18n/index.js';
import { CosmeticTrialBar } from '../src/screens/CosmeticTrialBar.js';
beforeEach(async () => { await i18n.changeLanguage('en'); });
it('offers owned world selection, comparison and independent exit/store actions', () => {
  const select = vi.fn(), compare = vi.fn(), end = vi.fn(), shop = vi.fn();
  render(<CosmeticTrialBar trial={{ planetId: 'one', cosmeticId: 'ring-aurora', enabled: true }}
    worlds={[{ id: 'one', name: 'Orion' }, { id: 'two', name: 'Vega' }]} onSelect={select} onCompare={compare} onEnd={end} onShop={shop} />);
  fireEvent.change(screen.getByRole('combobox', { name: 'World to try on' }), { target: { value: 'two' } });
  expect(select).toHaveBeenCalledWith('two');
  fireEvent.click(screen.getByRole('button', { name: 'Show equipped look' }));
  expect(compare).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Return to shop' }));
  expect(shop).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'End trial' }));
  expect(end).toHaveBeenCalledOnce();
});
