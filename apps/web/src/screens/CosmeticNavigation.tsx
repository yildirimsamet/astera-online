import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { GameTabs } from '../game-ui/index.js';
import { capabilities } from '../platform/runtime.js';

/** Both existing cosmetic screens share one visible switch, above their categories: the kit's tabs. */
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
    <div ref={root} data-cosmetic-navigation className="gk-cosmo__nav">
      <GameTabs
        label={t('skins.collection')}
        tabs={[
          { id: 'shop', label: t('menu.skinsShopLabel') },
          { id: 'inventory', label: t('menu.skinsInventoryLabel') },
        ]}
        value={active}
        onChange={(id) => { (id === 'shop' ? onShop : onInventory)(); }}
      />
    </div>
  );
}
