import { app, document, landing, loading, servers, settings } from './entry.js';
import { chat, leaderboard, menu, pendingStrip, sheet, signals, statusBar, surface, toast } from './shell.js';
import { focus, galaxy, pirate, worlds } from './world.js';
import { action, capacity, itemSheet, launch, planet, planetHero, transfer, upgradeRow } from './planet.js';
import { clarity, dossier, intel, reports } from './intel.js';
import { directives, gains, notifications, units, vocabulary } from './data.js';
import { errors } from './errors.js';
import { flightBar, rangeBand, spend } from './shapes.js';
import { onboarding } from './onboarding.js';
import { research } from './research.js';
import { rewards } from './rewards.js';
import { seasonRecap } from './season.js';
import { chronicle } from './chronicle.js';
import { clan } from './clan.js';
import { community } from './community.js';
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
  menu,
  leaderboard,
  chat,
  pendingStrip,
  signals,
  sheet,
  toast,
  surface,
  galaxy,
  focus,
  pirate,
  worlds,
  planet,
  capacity,
  spend,
  rangeBand,
  flightBar,
  itemSheet,
  upgradeRow,
  action,
  planetHero,
  launch,
  transfer,
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
  research,
  rewards,
  seasonRecap,
  chronicle,
  clan,
  community,
};
