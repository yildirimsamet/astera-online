import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import i18n from '../src/i18n/index.js';
import { SkinShopContent } from '../src/screens/SkinsScreen.js';
vi.mock('../src/screens/SkinPreview.js', () => ({ SkinPreview: () => <div /> }));
vi.mock('../src/screens/CosmeticPreview.js', () => ({ CosmeticPreview: () => <div /> }));
beforeEach(async () => { await i18n.changeLanguage('en'); });
it('tries the selected planet or ring without purchasing and offers no trial for craft or flags', () => {
  const onTry = vi.fn(), onPurchase = vi.fn();
  render(<SkinShopContent commander="Orion" collection={{ ownedSkinIds: [], planets: [] }} onOpenInventory={vi.fn()} onTry={onTry} onPurchase={onPurchase} />);
  fireEvent.click(screen.getByRole('button', { name: 'Try on my world' }));
  expect(onTry).toHaveBeenLastCalledWith('planet-lava');
  fireEvent.click(screen.getByRole('button', { name: /^Planet rings/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Try on my world' }));
  expect(onTry).toHaveBeenLastCalledWith('ring-aurora');
  fireEvent.click(screen.getByRole('button', { name: /^Engines/ }));
  expect(screen.queryByRole('button', { name: 'Try on my world' })).not.toBeInTheDocument();
  expect(onPurchase).not.toHaveBeenCalled();
});
