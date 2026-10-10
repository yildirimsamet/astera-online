import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type * as Fiber from '@react-three/fiber';
import { afterEach, expect, it, vi } from 'vitest';
import { ShopShowcase } from '../src/shell/ShopShowcase.js';

const renderer = vi.hoisted(() => ({ imported: vi.fn(), mounted: vi.fn(() => null) }));
vi.mock('@react-three/fiber', async (original) => {
  renderer.imported();
  return { ...await original<typeof Fiber>(), Canvas: renderer.mounted };
});

afterEach(() => { vi.unstubAllGlobals(); });

it('shows its still artwork immediately without loading a renderer in a WebGL-capable browser', async () => {
  vi.stubGlobal('WebGLRenderingContext', vi.fn());
  const view = render(<ShopShowcase onShop={vi.fn()} onInventory={vi.fn()} />);
  await act(async () => { await vi.dynamicImportSettled(); });

  expect(renderer.imported).not.toHaveBeenCalled();
  expect(renderer.mounted).not.toHaveBeenCalled();
  expect(view.container.querySelectorAll('canvas')).toHaveLength(0);
  const images = view.container.querySelectorAll('img');
  expect(images).toHaveLength(1);
  expect(images[0]).toHaveAttribute('alt', '');
  expect(images[0]).toHaveAttribute('loading', 'eager');
  expect(screen.getAllByRole('button')).toHaveLength(2);
});

it('offers the same artwork and working destinations before image decoding finishes', async () => {
  vi.stubGlobal('WebGLRenderingContext', undefined);
  const onShop = vi.fn(), onInventory = vi.fn();
  const view = render(<ShopShowcase onShop={onShop} onInventory={onInventory} />);
  await waitFor(() => { expect(view.container.querySelectorAll('img')).toHaveLength(1); });
  const [shop, inventory] = screen.getAllByRole('button');
  shop!.click();
  expect(onShop).toHaveBeenCalledTimes(1);
  expect(onInventory).not.toHaveBeenCalled();
  inventory!.click();
  expect(onInventory).toHaveBeenCalledTimes(1);
  expect(onShop).toHaveBeenCalledTimes(1);
});

it('hides a failed decorative image while keeping the shop entrance usable', () => {
  const onShop = vi.fn();
  const view = render(<ShopShowcase onShop={onShop} onInventory={vi.fn()} />);
  const image = view.container.querySelector('img');
  expect(image).not.toBeNull();
  fireEvent.error(image!);
  expect(image).not.toBeVisible();
  const [shop, inventory] = screen.getAllByRole('button');
  expect(shop).toBeEnabled();
  expect(inventory).toBeEnabled();
  shop!.click();
  expect(onShop).toHaveBeenCalledTimes(1);
  fireEvent.load(image!);
  expect(image).toBeVisible();
});
