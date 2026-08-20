import { app, document, landing, loading, servers, settings } from './entry.js';
import { pendingStrip, sheet, signals, statusBar, surface } from './shell.js';
import { focus, galaxy } from './world.js';
import { action, itemSheet, launch, planet, planetHero, upgradeRow } from './planet.js';
import { clarity, dossier, intel, reports } from './intel.js';
import { directives, gains, notifications, units, vocabulary } from './data.js';
import { errors } from './errors.js';
import { onboarding } from './onboarding.js';
import type { Resources } from '../en/index.js';

/**
 * TÜRKÇE — çeviri değil, Türkçe yazılmış metin.
 *
 * Tip `Resources` olarak bağlandığı için İngilizcede olup burada olmayan bir
 * anahtar derleme hatasıdır; fazladan bir anahtar da öyle. `test/i18n.test.ts`
 * aynı kontrolü çalışma zamanında da yapar, çünkü tip sistemi opsiyonel bir
 * anahtarı yakalar ama boş bir dizeyi yakalamaz.
 */
export const tr: Resources = {
  landing,
  servers,
  app,
  loading,
  document,
  settings,
  statusBar,
  pendingStrip,
  signals,
  sheet,
  surface,
  galaxy,
  focus,
  planet,
  itemSheet,
  upgradeRow,
  action,
  planetHero,
  launch,
  intel,
  reports,
  clarity,
  dossier,
  vocabulary,
  gains,
  directives,
  notifications,
  units,
  errors,
  onboarding,
};
