import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import i18n from '../src/i18n/index.js';
import { SkinShopContent } from '../src/screens/SkinsScreen.js';
import { SkinInventoryContent } from '../src/screens/SkinInventoryScreen.js';
vi.mock('../src/screens/SkinPreview.js', () => ({ SkinPreview: () => <div /> }));
vi.mock('../src/screens/CosmeticPreview.js', () => ({ CosmeticPreview: ({ id }: { id: string }) => <div data-testid="cosmetic-preview">{id}</div> }));
beforeEach(async () => { await i18n.changeLanguage('en'); });
const collection = { ownedSkinIds: [], ownedCosmeticIds: ['ring-aurora'] as const, equipment: { RING: 'ring-aurora' as const }, planets: [] };
it('lets customers inspect separate model and effect categories without exposing equip actions in the shop', () => {
  render(<SkinShopContent commander="Orion" collection={{ ...collection, ownedCosmeticIds: [...collection.ownedCosmeticIds] }} onOpenInventory={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /^planet rings/i }));
  expect(screen.getByTestId('cosmetic-preview')).toHaveTextContent('ring-aurora');
  expect(screen.queryByRole('button', { name: /^equip/i })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^probes/i }));
  expect(screen.getByTestId('cosmetic-preview')).toHaveTextContent('probe-ufo');
  fireEvent.click(screen.getByRole('button', { name: /^clan standards/i }));
  expect(screen.getByTestId('cosmetic-preview')).toHaveTextContent('flag-aurora');
  fireEvent.click(screen.getByRole('button', { name: /^ships/i }));
  expect(screen.getByTestId('cosmetic-preview')).toHaveTextContent('ship-red-dragon');
  expect(screen.getAllByText('For Corsair')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: /whale/i }));
  expect(screen.getByTestId('cosmetic-preview')).toHaveTextContent('ship-shark');
  expect(screen.getAllByText('For Citadel')).not.toHaveLength(0);
});

it('inventory equips and resets only the selected ship type while preserving other ship looks', () => {
  const equip = vi.fn();
  render(<SkinInventoryContent collection={{ ...collection,
    ownedCosmeticIds: ['ship-shark', 'ship-red-dragon'],
    equipment: { SHIP: { CORSAIR: 'ship-red-dragon', CITADEL: 'ship-shark' } },
  }} onEquip={vi.fn()} onEquipCosmetic={equip} pending={null} failure={null} onOpenShop={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /^ships/i }));
  fireEvent.click(screen.getByRole('button', { name: /whale/i }));
  expect(screen.getByRole('button', { name: /^equipped$/i })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /restore default/i }));
  expect(equip).toHaveBeenCalledWith('SHIP', null, 'CITADEL');
  expect(screen.queryByRole('button', { name: /scorpion/i })).not.toBeInTheDocument();
});

it('equips a newly owned ship skin into its declared hull slot', () => {
  const equip = vi.fn();
  render(<SkinInventoryContent collection={{ ...collection, ownedCosmeticIds: ['ship-shark'], equipment: {} }}
    onEquip={vi.fn()} onEquipCosmetic={equip} pending={null} failure={null} onOpenShop={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /^ships/i }));
  fireEvent.click(screen.getByRole('button', { name: /^equip appearance$/i }));
  expect(equip).toHaveBeenCalledWith('SHIP', 'ship-shark', 'CITADEL');
});
it('inventory shows owned items, supports resetting a slot, and never sells unowned products', () => {
  const equip = vi.fn();
  render(<SkinInventoryContent collection={{ ...collection, ownedCosmeticIds: [...collection.ownedCosmeticIds] }} onEquip={vi.fn()} onEquipCosmetic={equip} pending={null} failure={null} onOpenShop={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /^planet rings/i }));
  expect(screen.getByTestId('cosmetic-preview')).toHaveTextContent('ring-aurora');
  expect(screen.queryByText('Helios')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /restore default/i }));
  expect(equip).toHaveBeenCalledWith('RING', null);
});

it('shop hides missing model categories while retaining categories with inspectable skins', () => {
  render(<SkinShopContent commander="Orion" collection={{ ownedSkinIds: [], planets: [] }} onOpenInventory={vi.fn()} />);
  const categories = within(screen.getByRole('navigation', { name: i18n.t('skins.categories') }));
  expect(categories.queryByRole('button', { name: /^miners/i })).not.toBeInTheDocument();
  expect(categories.getAllByRole('button')).toHaveLength(6);
});

it('offers and equips Titan as an engine without changing a ship model slot', () => {
  const equip = vi.fn();
  render(<SkinInventoryContent collection={{ ...collection, ownedCosmeticIds: ['engine-titan', 'ship-scorpion'], equipment: { SHIP: { VIPER: 'ship-scorpion' } } }}
    onEquip={vi.fn()} onEquipCosmetic={equip} pending={null} failure={null} onOpenShop={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /^engines/i }));
  expect(screen.getByTestId('cosmetic-preview')).toHaveTextContent('engine-titan');
  fireEvent.click(screen.getByRole('button', { name: /^equip appearance$/i }));
  expect(equip).toHaveBeenCalledWith('ENGINE', 'engine-titan');
  expect(screen.queryByRole('button', { name: /solar forge/i })).not.toBeInTheDocument();
});

it('inventory opens on an owned category and does not offer unowned categories', () => {
  render(<SkinInventoryContent collection={{ ...collection, ownedCosmeticIds: [...collection.ownedCosmeticIds] }} onEquip={vi.fn()} pending={null} failure={null} onOpenShop={vi.fn()} />);
  const categories = within(screen.getByRole('navigation', { name: i18n.t('skins.categories') }));
  for (const name of [/^planets/i, /^ships/i, /^probes/i, /^miners/i, /^engine/i]) {
    expect(categories.queryByRole('button', { name })).not.toBeInTheDocument();
  }
  expect(categories.getByRole('button', { name: /^planet rings/i })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByTestId('cosmetic-preview')).toHaveTextContent('ring-aurora');
  expect(categories.getByRole('button', { name: /^clan standards/i })).toBeInTheDocument();
});

it('falls back to another accessible category when the active inventory skin is revoked', () => {
  const props = { onEquip: vi.fn(), pending: null, failure: null, onOpenShop: vi.fn() };
  const { rerender } = render(<SkinInventoryContent {...props} collection={{ ...collection, ownedCosmeticIds: ['ring-aurora', 'ship-scorpion'] }} />);
  fireEvent.click(screen.getByRole('button', { name: /^ships/i }));
  expect(screen.getByTestId('cosmetic-preview')).toHaveTextContent('ship-scorpion');
  rerender(<SkinInventoryContent {...props} collection={{ ...collection, ownedCosmeticIds: [...collection.ownedCosmeticIds] }} />);
  expect(screen.queryByRole('button', { name: /^ships/i })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^planet rings/i })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByTestId('cosmetic-preview')).toHaveTextContent('ring-aurora');
});
