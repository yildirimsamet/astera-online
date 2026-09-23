import { silentSpace } from './silentSpace.js';
import { app, consent, document, landing, loading, servers, settings } from './entry.js';
import { chat, crash, leaderboard, menu, pendingStrip, sheet, signals, statusBar, surface, toast } from './shell.js';
import { focus, galaxy, pirate, worlds } from './world.js';
import { action, capacity, faults, itemSheet, launch, planet, planetHero, transfer, upgradeRow } from './planet.js';
import { clarity, dossier, intel, reports } from './intel.js';
import { directives, gains, notifications, units, vocabulary } from './data.js';
import { errors } from './errors.js';
import { flightBar, rangeBand, spend, counter } from './shapes.js';
import { onboarding } from './onboarding.js';
import { research } from './research.js';
import { rewards } from './rewards.js';
import { skins } from './skins.js';
import { seasonRecap } from './season.js';
import { chronicle } from './chronicle.js';
import { clan } from './clan.js';
import { clanWar } from './clanWar.js';
import { community } from './community.js';
import { trade } from './trade.js';
import { academy } from './academy.js';
import { convoy } from './convoy.js';
import { hold, lane, meter, ruler } from './v2.js';
import type { Resources } from '../en/index.js';

/** DE — translated from the English resource tree. */
export const de: Resources = {
  silentSpace, academy, landing, servers, app, crash, loading, document, settings, consent,
  statusBar, menu, leaderboard, chat, pendingStrip, signals, sheet, toast, surface, galaxy,
  focus, pirate, worlds, planet, faults, capacity, spend, rangeBand, flightBar, counter,
  itemSheet, upgradeRow, action, planetHero, launch, transfer, intel, reports, clarity, dossier,
  vocabulary, gains, directives, notifications, units, errors, onboarding, research, rewards,
  skins, seasonRecap, chronicle, clan, clanWar, community, trade, convoy, hold, lane, meter, ruler,
};
