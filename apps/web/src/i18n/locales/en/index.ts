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

/**
 * ENGLISH, AND IT IS THE SHAPE EVERY OTHER LANGUAGE IS CHECKED AGAINST.
 *
 * The type of this object is what `CustomTypeOptions` binds `t()` to, so a key
 * that does not exist here is a COMPILE error at the call site rather than a
 * `landing.form.nameLabel` printed on screen. `test/i18n.test.ts` then walks this
 * tree against every other language and fails on the first key either side is
 * missing — between the two, "eksik hiç bir yer kalmamalı" is mechanical rather
 * than a promise.
 *
 * One namespace per surface, and NOTHING SHARED BETWEEN THEM. Two controls that
 * read the same in English get two keys, because they are two controls: the day
 * one of them is reworded — or translated differently, which happens constantly
 * between English and Turkish — the other must not move with it.
 */
export const en = {
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
} as const;

/**
 * The English tree with its string LITERALS widened back to `string`.
 *
 * Every locale file is `as const`, which is what gives `t()` its key
 * autocompletion — without it the type is `Record<string, string>` and a typo is
 * silent again. The cost is that `typeof en` says `premise` is the literal
 * English sentence, so no other language could ever satisfy it. Widening the
 * leaves while keeping the SHAPE is exactly the contract wanted: same keys, any
 * text.
 */
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };

export type Resources = Widen<typeof en>;
export type Namespace = keyof Resources;

export const NAMESPACES = Object.keys(en) as Namespace[];
