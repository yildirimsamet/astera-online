import { expect, it, vi } from 'vitest';

const loaded = vi.hoisted(() => ({ german: 0 }));
vi.mock('../src/i18n/locales/de/index.js', async importOriginal => {
  loaded.german++;
  return importOriginal();
});

it('does not initialize unused locale dictionaries, but loads one when the player selects it', async () => {
  vi.resetModules();
  loaded.german = 0;
  const { default: i18n } = await import('../src/i18n/index.js');
  expect(loaded.german).toBe(0);
  await i18n.changeLanguage('de');
  expect(loaded.german).toBe(1);
  expect(i18n.t('loading.contact')).not.toBe('loading.contact');
  await i18n.changeLanguage('en');
});
