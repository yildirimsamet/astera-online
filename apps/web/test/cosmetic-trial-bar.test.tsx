import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import i18n from '../src/i18n/index.js';
import { CosmeticTrialBar } from '../src/screens/CosmeticTrialBar.js';
beforeEach(async () => { await i18n.changeLanguage('en'); });
it('offers owned world selection, comparison and independent exit/store actions', () => {
  const select = vi.fn(), compare = vi.fn(), end = vi.fn(), shop = vi.fn();
  render(<CosmeticTrialBar trial={{ planetId: 'one', cosmeticId: 'ring-aurora', enabled: true }}
    worlds={[{ id: 'one', name: 'Orion' }, { id: 'two', name: 'Vega' }]} onSelect={select} onCompare={compare} onEnd={end} onShop={shop} />);
  // C39: the world is a kit choice, no native select (kit rule).
  expect(screen.getByRole('radiogroup', { name: 'World to try on' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: 'Vega' }));
  expect(select).toHaveBeenCalledWith('two');
  fireEvent.click(screen.getByRole('button', { name: 'Show equipped look' }));
  expect(compare).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Return to shop' }));
  expect(shop).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'End trial' }));
  expect(end).toHaveBeenCalledOnce();
});

it('sits on the kit: a cut plate, the look named in gold, no old surface language', () => {
  render(<CosmeticTrialBar trial={{ planetId: 'one', cosmeticId: 'ring-aurora', enabled: false }}
    worlds={[{ id: 'one', name: 'Orion' }]} onSelect={vi.fn()} onCompare={vi.fn()} onEnd={vi.fn()} onShop={vi.fn()} />);
  const bar = document.querySelector('[data-cosmetic-trial]');
  expect(bar).toHaveClass('gk-trial');
  const names = [bar!, ...bar!.querySelectorAll('[class]')].flatMap(node => (node.getAttribute('class') ?? '').split(/\s+/));
  expect(names.filter(name => /(^|-)v2(-|$)/.test(name) || ['text-micro', 'text-caption', 'text-body'].includes(name))).toEqual([]);
  expect(screen.getByRole('button', { name: 'Return to shop' })).toHaveClass('gk-btn');
  expect(screen.queryByRole('combobox')).toBeNull();
});
