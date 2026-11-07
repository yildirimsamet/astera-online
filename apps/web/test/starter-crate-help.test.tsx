import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import i18n from '../src/i18n/index.js';
import { Handbook } from '../src/onboarding/prologue/Handbook.js';
import { getWikiArticle } from '../src/wiki/catalog.js';
afterEach(async () => { cleanup(); await i18n.changeLanguage('en'); });
it.each(['en', 'tr', 'de', 'fr', 'es', 'ja'])('explains crates, one-time payment and the jump limit in %s help', async language => {
  await i18n.changeLanguage(language);
  render(<Handbook onClose={vi.fn()} />);
  expect(screen.getByText(i18n.t('starter.handbook.crates.title'))).toBeTruthy();
  expect(screen.getByText(i18n.t('starter.handbook.crates.body'))).toBeTruthy();
  expect(i18n.t('starter.handbook.crates.body')).not.toBe('starter.handbook.crates.body');
});
it('includes the same crate rule in the two published Wiki editions', () => {
  const article = getWikiArticle('basics.colony-ship');
  expect(JSON.stringify(article?.sections.en)).toMatch(/salvage crates/i);
  expect(JSON.stringify(article?.sections.tr)).toMatch(/kurtarma kasaları/i);
});
