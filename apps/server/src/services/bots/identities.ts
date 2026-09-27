import { randomBytes } from 'node:crypto';
import { asc, eq, sql } from 'drizzle-orm';
import type { CountryCode } from '@astera/rules';
import type { Db } from '../../db/client.js';
import type { Clock } from '../../clock.js';
import { hashPassword } from '../../auth/password.js';
import { accounts, botProfiles, players } from '../../db/schema.js';
import { GameError } from '../planet.js';
import { personaFor } from './personas.js';
import { handleFor } from './roster.js';

type Identity = Readonly<{ name: string; country: CountryCode }>;

const turkish = [
  'KaraKedi', 'Volkan99', 'Ruzgar_Efe', 'GeceKusu', 'Bozkurt_06',
  'BordoBereli', 'Simsek7', 'Kaptan', 'Gölge_Avcısı', 'Efsane34',
  'SonSamurai', 'Kasırga', 'Kizil_Elma', 'Yakamoz', 'Poyraz_',
  'DeliKurt', 'Celik_Bilek', 'Gizemli_', 'MaviGece', 'Aslan_53',
  'Turkuaz', 'Devrim_', 'KanatsizKuş', 'Yildirim88', 'Samanyolu',
  'SiyahBeyaz', 'Kafadar', 'GeceAvcisi', 'SessizSair', 'Kuzey_Ruzgari',
  'Reis_61', 'Atmaca', 'Sarmaşık', 'Dolunay_', 'Gokturk',
  'BuzAdam', 'Fırtına_10', 'CılgınTurk', 'DerinDeniz', 'YalnizKurt',
  'KorAtes', 'Anatolia_', 'Izmirli_35', 'Zifiri', 'Alaturka',
  'CesurYurek', 'Gokyuzu', 'Turkmen', 'Serdengecti', 'Saka_16',
  'YediTepe', 'Pusat_', 'OzgurRuh', 'Son_Barat', 'Sahin_01',
  'Toprak', 'Alev_Alev', 'Gece_Mavisi', 'Son_Umut', 'Tipi_',
  'Vatan_55', 'Kasırga_77', 'DusKapanı', 'Kizil_Gunes', 'SakaKusu',
  'MehmetciK', 'Akdeniz_', 'Yildiz_07', 'SiyahPanter', 'Bozkir_',
] as const;

const french = [
  'L_Ombre', 'PetitChat99', 'Noir_Etoile', 'Roi_Soleil', 'Lune_Blanche',
  'FleurDeLys', 'Phantom_FR', 'Mon_Ami', 'Eclair12', 'RoseNoire',
] as const;

const german = [
  'EisenKaiser', 'Schatten_99', 'BlitzKrieg', 'Sturm_Drache', 'NachtWolf',
  'FrostBite_DE', 'SchwarzerBär', 'SilberPfeil', 'Adler_01', 'DonnerGott',
] as const;

const spanish = [
  'El_Matador', 'Sombra77', 'Fuego_Azul', 'El_Diablo', 'Sol_Naciente',
  'Cazador_ES', 'Lobo_Blanco', 'Sangre_Real', 'Viento_10', 'Turo_Rojo',
] as const;

/** The owner's exact public names and countries; order assigns previously unnamed accounts. */
export const BOT_IDENTITIES: readonly Identity[] = [
  ...turkish.map((name) => ({ name, country: 'TR' as const })),
  ...french.map((name) => ({ name, country: 'FR' as const })),
  ...german.map((name) => ({ name, country: 'DE' as const })),
  ...spanish.map((name) => ({ name, country: 'ES' as const })),
];

const key = (name: string): string => name.trim().normalize('NFKC').toLocaleLowerCase('tr');

/**
 * Reconcile once per deploy while application roles are stopped. Existing account and
 * player IDs stay put, so planets, fleets and reports retain their owners. A retired
 * name is reserved and never silently brought back into play. One transaction makes
 * a collision with a real commander fail before changing any bot identity.
 */
export async function syncBotIdentities(
  db: Db,
  clock: Clock,
  identities: readonly Identity[] = BOT_IDENTITIES,
): Promise<{ updated: number; created: number; active: number }> {
  const desired = new Map<string, Identity>();
  for (const identity of identities) {
    const folded = key(identity.name);
    if (!identity.name.trim() || desired.has(folded)) {
      throw new GameError('BAD_NAME', `Duplicate or empty bot name: ${identity.name}`, 400);
    }
    desired.set(folded, identity);
  }

  return db.transaction(async (tx) => {
    // Same lock as manual `bots add`: an operator cannot race the deploy's ordinal allocation.
    await tx.execute(sql`select pg_advisory_xact_lock(159159159)`);
    const profiles = await tx.select({
      accountId: botProfiles.accountId,
      ordinal: botProfiles.ordinal,
      retiredAt: botProfiles.retiredAt,
      name: accounts.displayName,
      country: accounts.countryCode,
    }).from(botProfiles).innerJoin(accounts, eq(accounts.id, botProfiles.accountId))
      .orderBy(asc(botProfiles.ordinal));
    const allAccounts = await tx.select({
      id: accounts.id, name: accounts.displayName, username: accounts.username,
    }).from(accounts);
    const botIds = new Set(profiles.map((profile) => profile.accountId));
    for (const account of allAccounts) {
      if (!botIds.has(account.id) && desired.has(key(account.name))) {
        throw new GameError('USERNAME_TAKEN', `${account.name} belongs to a real commander`, 409);
      }
    }

    const assigned = new Set<string>();
    const active = profiles.filter((profile) => profile.retiredAt === null);
    const matching = new Map<string, (typeof active)[number]>();
    for (const profile of profiles) {
      const folded = key(profile.name);
      if (!desired.has(folded)) continue;
      if (assigned.has(folded)) {
        throw new GameError('USERNAME_TAKEN', `${profile.name} is used by multiple bot accounts`, 409);
      }
      assigned.add(folded);
      if (profile.retiredAt === null) matching.set(folded, profile);
    }

    const unnamed = active.filter((profile) => !matching.has(key(profile.name)));
    const missing = identities.filter((identity) => !assigned.has(key(identity.name)));
    if (unnamed.length > missing.length) {
      throw new GameError('BAD_NAME', 'There are more active bot accounts than supplied identities', 409);
    }

    let updated = 0;
    const setIdentity = async (accountId: string, identity: Identity): Promise<void> => {
      await tx.update(accounts).set({ displayName: identity.name, countryCode: identity.country })
        .where(eq(accounts.id, accountId));
      await tx.update(players).set({ name: identity.name })
        .where(eq(players.accountId, accountId));
      updated++;
    };

    for (const identity of identities) {
      const profile = matching.get(key(identity.name));
      if (profile && (profile.name !== identity.name || profile.country !== identity.country)) {
        await setIdentity(profile.accountId, identity);
      }
    }
    for (const profile of profiles) {
      if (profile.retiredAt !== null) {
        const identity = desired.get(key(profile.name));
        if (identity && (profile.name !== identity.name || profile.country !== identity.country)) {
          await setIdentity(profile.accountId, identity);
        }
      }
    }
    for (const [index, profile] of unnamed.entries()) {
      await setIdentity(profile.accountId, missing[index]!);
    }

    const usernames = new Set(allAccounts.map((account) => account.username));
    let nextOrdinal = Math.max(-1, ...profiles.map((profile) => profile.ordinal)) + 1;
    let created = 0;
    for (const identity of missing.slice(unnamed.length)) {
      const base = handleFor(identity.name);
      let username = base;
      for (let suffix = 1; usernames.has(username); suffix++) {
        const tail = String(suffix);
        username = `${base.slice(0, 16 - tail.length)}${tail}`;
      }
      const passwordHash = await hashPassword(randomBytes(18).toString('base64url'));
      const [account] = await tx.insert(accounts).values({
        username, passwordHash, displayName: identity.name, countryCode: identity.country,
      }).returning({ id: accounts.id });
      if (!account) throw new Error(`Could not create ${identity.name}`);
      await tx.insert(botProfiles).values({
        accountId: account.id,
        ordinal: nextOrdinal,
        persona: personaFor(nextOrdinal).id,
        nextActionAt: clock.now(),
        createdAt: clock.now(),
      });
      usernames.add(username);
      nextOrdinal++;
      created++;
    }
    return { updated, created, active: active.length + created };
  });
}
