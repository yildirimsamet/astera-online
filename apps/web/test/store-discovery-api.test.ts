import { expect, it } from 'vitest';
import { createCosmeticTrialClient } from '../src/v2/gallery/CosmeticTrialGallery.js';
import { createStoreDiscoveryApi } from '../src/v2/gallery/storeDiscoveryApi.js';

it('rejects mismatched slots without changing the preview collection', async () => {
  const api = createStoreDiscoveryApi(createCosmeticTrialClient());
  const before = await api.skins();
  await expect(api.equipCosmetic('RING', 'planet-ice')).rejects.toMatchObject({ code: 'SKIN_SLOT_MISMATCH' });
  await expect(api.skins()).resolves.toEqual(before);
});

it('rejects unowned worlds, appearances, non-leader flags and wrong ship hulls', async () => {
  const api = createStoreDiscoveryApi(createCosmeticTrialClient());
  const before = await api.skins();
  await expect(api.equipSkin('other-world', 'planet-ice')).rejects.toMatchObject({ code: 'PLANET_NOT_OWNED' });
  await expect(api.equipSkin('trial-home', 'planet-toxic')).rejects.toMatchObject({ code: 'SKIN_NOT_OWNED' });
  await expect(api.equipCosmetic('RING', 'ring-aurora')).rejects.toMatchObject({ code: 'SKIN_NOT_OWNED' });
  await expect(api.equipCosmetic('FLAG', 'flag-vanguard')).rejects.toMatchObject({ code: 'CLAN_LEADER_REQUIRED' });
  await expect(api.equipCosmetic('SHIP', 'ship-red-dragon', 'VIPER')).rejects.toMatchObject({ code: 'SKIN_SLOT_MISMATCH' });
  await expect(api.skins()).resolves.toEqual(before);
});
