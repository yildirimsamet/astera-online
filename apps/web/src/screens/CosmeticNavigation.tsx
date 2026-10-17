import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Segmented } from '../v2/kit/Segmented.js';
import { capabilities } from '../platform/runtime.js';

/** Both existing cosmetic screens share one visible switch, above their categories. */
export function CosmeticNavigation({ active, onShop, onInventory }: {
  active: 'shop' | 'inventory';
  onShop: () => void;
  onInventory: () => void;
}) {
  const { t } = useTranslation();
  const root = useRef<HTMLDivElement>(null);
  const showShop = capabilities().webCheckout;
  useEffect(() => {
    if (!showShop) return;
    root.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus({ preventScroll: true });
  }, [active, showShop]);
  if (!showShop) return null;
  return (
    <div ref={root} data-cosmetic-navigation className="cosmetic-navigation mx-auto max-w-2xl px-3 pt-3">
      <Segmented
        label={t('skins.collection')}
        options={[
          { id: 'shop', label: t('menu.skinsShopLabel') },
          { id: 'inventory', label: t('menu.skinsInventoryLabel') },
        ]}
        value={active}
        onChange={(id) => { if (id !== active) (id === 'shop' ? onShop : onInventory)(); }}
      />
    </div>
  );
}
