import { and, eq, inArray, asc, desc, gt, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { HONOR_VERSION, HONOR_LEGACY_VERSION, HONOR_CANDIDATE_VERSION, HONOR_LAUNCH_VERSION, isSupportedHonorVersion } from '@astera/rules';
import type { Tx } from '../db/client.js';
import { commanderTransfers, honorCommitments, honorObservations, honorSeasons, players } from '../db/schema.js';
import { honorEvidenceSchema } from './honorAccounting.js';
import { observeHonorOwner, honorOwnerReference, honorGalaxyTopTier } from './honorReference.js';
import { readHonorRelations } from './honorRelations.js';

const reference = z.object({ id: z.string().min(1), tier: z.number().int().positive(),
  navy: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) }).strict();
export const honorCommitmentSchema = z.object({
  galaxyTopTier: honorEvidenceSchema.shape.galaxyTopTier,
  retaliationLootPercent: honorEvidenceSchema.shape.retaliationLootPercent,
  version: z.union([z.literal(HONOR_LEGACY_VERSION), z.literal(HONOR_VERSION), z.literal(HONOR_CANDIDATE_VERSION), z.literal(HONOR_LAUNCH_VERSION)]), at: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  referenceOrder: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  /** An absent commander can genuinely join later, even within the same millisecond. */
  presentAtLaunch: z.array(z.string().min(1)).optional(),
  attack: z.array(reference).min(1), defence: z.array(reference), eligible: z.boolean(),
  exclusion: honorEvidenceSchema.shape.exclusion,
  selectedDefenders: honorEvidenceSchema.shape.selectedDefenders,
  relations: honorEvidenceSchema.shape.relations,
}).strict();
export type HonorCommitment = z.infer<typeof honorCommitmentSchema>;
type Source = z.infer<typeof honorEvidenceSchema.shape.source>;

/** Call under the source's game/world locks, before taking any Honor settlement lock. */
export async function commitHonor(tx: Tx, input: {
  seasonId: string; source: Source; id: string; attack: readonly string[]; defence: readonly string[];
  at: Date; adminUsernames: ReadonlySet<string>;
}): Promise<HonorCommitment | null> {
  const [config] = await tx.select().from(honorSeasons).where(eq(honorSeasons.seasonId, input.seasonId));
  if (!config) return null;
  if (!isSupportedHonorVersion(config.version)) throw new Error('Unsupported frozen Honor version');
  const attack = [...new Set(input.attack)].sort(), defence = [...new Set(input.defence)].sort();
  const ids = [...new Set([...attack, ...defence])].sort();
  if (ids.length === 0) throw new Error('Missing Honor actors');
  const actors = await tx.select({ id: players.id }).from(players)
    .where(and(eq(players.seasonId, input.seasonId), inArray(players.id, ids)))
    .orderBy(asc(players.id)).for('update');
  if (actors.length !== ids.length) throw new Error('Missing or foreign-season Honor actor');
  const source = and(eq(honorCommitments.seasonId, input.seasonId), eq(honorCommitments.source, input.source),
    eq(honorCommitments.sourceId, input.id));
  const [existing] = await tx.select().from(honorCommitments).where(source);
  if (existing) {
    const frozen = honorCommitmentSchema.parse(existing.snapshot);
    if (frozen.version !== config.version) throw new Error('Conflicting Honor commitment version');
    if (frozen.at !== input.at.getTime() || JSON.stringify(frozen.attack.map(row => row.id)) !== JSON.stringify(attack)
      || JSON.stringify(frozen.defence.map(row => row.id)) !== JSON.stringify(defence)) {
      throw new Error('Conflicting Honor commitment');
    }
    return frozen;
  }
  if (config.closedAt !== null) throw new Error('Honor season is sealed');
  // Establish the present inventory if this is the first action after a shadow
  // activation. This never invents a reference for a past launch.
  for (const id of ids) await observeHonorOwner(tx, id, input.at);
  const [boundary] = await tx.select({ id: honorObservations.id }).from(honorObservations)
    .where(eq(honorObservations.seasonId, input.seasonId)).orderBy(desc(honorObservations.id)).limit(1);
  const referenceOrder = boundary?.id ?? 0;
  const references = new Map<string, { navy: number; tier: number }>();
  for (const id of ids) references.set(id, await honorOwnerReference(tx, input.seasonId, id, input.at, referenceOrder));
  const relationship = await readHonorRelations(tx, { ...input, attack, defence });
  const members = (owners: string[]) => owners.map(id => ({ id, ...references.get(id)! }));
  const roster = config.version === HONOR_LAUNCH_VERSION
    ? await tx.select({ id: players.id }).from(players).where(eq(players.seasonId, input.seasonId)).orderBy(asc(players.id)) : undefined;
  const snapshot = honorCommitmentSchema.parse({ version: config.version, at: input.at.getTime(), referenceOrder,
    galaxyTopTier: await honorGalaxyTopTier(tx, input.seasonId, input.at, input.adminUsernames),
    // Keep the legacy wire shape until every API/worker understands 40% contracts.
    ...(config.retaliationLootPercent === 40 ? { retaliationLootPercent: 40 } : {}),
    ...(roster ? { presentAtLaunch: roster.map(row => row.id) } : {}),
    attack: members(attack), defence: members(defence), selectedDefenders: defence, ...relationship });
  await tx.insert(honorCommitments).values({ seasonId: input.seasonId, source: input.source, sourceId: input.id, snapshot });
  return snapshot;
}

/** A genuine later placement has no launch-time inventory. Freeze its first real
 * entry observation instead of fabricating old navy or reading post-battle ships.
 * Existing commanders with corrupt history must still fail explicitly. */
async function lateHonorReference(tx: Tx, seasonId: string, id: string, frozen: HonorCommitment, observedAt: Date) {
  const [actor] = await tx.select({ joinedAt: players.joinedAt }).from(players)
    .where(and(eq(players.id, id), eq(players.seasonId, seasonId)));
  if (!actor || actor.joinedAt > observedAt) throw new Error('Missing Honor reference history');
  const [transfer] = await tx.select().from(commanderTransfers).where(and(eq(commanderTransfers.playerId, id),
    eq(commanderTransfers.targetSeasonId, seasonId), gte(commanderTransfers.committedAt, new Date(frozen.at)),
    lte(commanderTransfers.committedAt, observedAt))).orderBy(asc(commanderTransfers.toVersion)).limit(1);
  const absent = frozen.presentAtLaunch !== undefined && !frozen.presentAtLaunch.includes(id);
  const newAccount = actor.joinedAt.getTime() > frozen.at;
  const laterTransfer = transfer && transfer.committedAt.getTime() > frozen.at;
  if (frozen.presentAtLaunch?.includes(id) || (!absent && !newAccount && !laterTransfer)) {
    throw new Error('Missing Honor reference history');
  }
  if (!transfer && !newAccount && !(absent && actor.joinedAt.getTime() === frozen.at)) {
    throw new Error('Missing Honor placement evidence');
  }
  const enteredAt = transfer?.committedAt ?? actor.joinedAt;
  const [first] = await tx.select().from(honorObservations).where(and(eq(honorObservations.seasonId, seasonId),
    eq(honorObservations.playerId, id), gte(honorObservations.at, enteredAt), lte(honorObservations.at, observedAt),
    gt(honorObservations.id, frozen.referenceOrder))).orderBy(asc(honorObservations.at), asc(honorObservations.id)).limit(1);
  if (!first) throw new Error('Missing Honor entry observation');
  return { at: first.at, reference: await honorOwnerReference(tx, seasonId, id, first.at, first.id) };
}

/** Late support joins the common pool using launch-time history, not its later power. */
export async function worldHonorCommitment(tx: Tx, input: {
  seasonId: string; missionId: string; host: string; supporters: readonly string[]; adminUsernames: ReadonlySet<string>;
  observedAt?: Date;
  source?: 'WORLD' | 'CLAN_WAR';
}): Promise<HonorCommitment | null> {
  const [config] = await tx.select().from(honorSeasons).where(eq(honorSeasons.seasonId, input.seasonId));
  if (!config) return null;
  if (config.legacySources.includes(`${input.source ?? 'WORLD'}:${input.missionId}`)) return null;
  const [committed] = await tx.select().from(honorCommitments).where(and(eq(honorCommitments.seasonId, input.seasonId),
    eq(honorCommitments.source, input.source ?? 'WORLD'), eq(honorCommitments.sourceId, input.missionId)));
  if (!committed) {
    throw new Error('Missing Honor attack commitment');
  }
  const frozen = honorCommitmentSchema.parse(committed.snapshot);
  if (frozen.version !== config.version) throw new Error('Conflicting Honor commitment version');
  const ids = [...new Set([input.host, ...input.supporters])].sort();
  if (frozen.defence.length !== 1 || frozen.defence[0]?.id !== input.host) {
    if (!input.observedAt) throw new Error('Honor target owner changed');
    const defence = [];
    for (const id of ids) {
      await observeHonorOwner(tx, id, input.observedAt);
      defence.push({ id, ...await honorOwnerReference(tx, input.seasonId, id, input.observedAt) });
    }
    // The current owner's genuine state is evidence only: neither side earns or
    // loses Honor on an attack committed against somebody else. Combat proceeds.
    return { ...frozen, defence, eligible: false, exclusion: 'TARGET_CHANGED',
      relations: frozen.attack.flatMap(a => ids.map(b => ({ a: a.id, b, related: true }))) };
  }
  const at = new Date(frozen.at);
  const defence = [];
  const lateTimes = new Map<string, Date>();
  let exclusion = frozen.exclusion;
  for (const id of ids) {
    const original = frozen.defence.find(row => row.id === id);
    if (original) { defence.push(original); continue; }
    if (frozen.presentAtLaunch && !frozen.presentAtLaunch.includes(id) && input.observedAt) {
      const late = await lateHonorReference(tx, input.seasonId, id, frozen, input.observedAt);
      defence.push({ id, ...late.reference }); lateTimes.set(id, late.at); continue;
    }
    try {
      defence.push({ id, ...await honorOwnerReference(tx, input.seasonId, id, at, frozen.referenceOrder) });
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'Missing Honor reference history' || !input.observedAt) throw error;
      const late = await lateHonorReference(tx, input.seasonId, id, frozen, input.observedAt);
      defence.push({ id, ...late.reference });
      lateTimes.set(id, late.at);
      if (frozen.version !== HONOR_LAUNCH_VERSION) exclusion = 'PARTICIPANT_JOINED_LATE';
    }
  }
  // Eligibility is judged on everyone together; a late joiner's own read only supplies
  // relations, because the joiner and the attack alone may include no person.
  const facts = await readHonorRelations(tx, { ...input, at, attack: frozen.attack.map(row => row.id), defence: ids });
  for (const [id, time] of lateTimes) {
    const joined = await readHonorRelations(tx, { ...input, at: time, attack: frozen.attack.map(row => row.id), defence: [id] });
    facts.relations = facts.relations.filter(row => row.b !== id).concat(joined.relations);
  }
  return { ...frozen, defence, selectedDefenders: frozen.selectedDefenders ?? frozen.defence.map(row => row.id),
    eligible: exclusion === undefined && frozen.eligible && facts.eligible,
    ...(exclusion ? { exclusion } : {}),
    relations: facts.relations.map(row => frozen.relations.find(old => old.a === row.a && old.b === row.b) ?? row) };
}

/** Monument holders may arrive/leave; an entirely replaced side is not the committed target. */
export async function monumentHonorCommitment(tx: Tx, input: {
  seasonId: string; sourceId: string; defence: readonly string[]; at: Date; adminUsernames: ReadonlySet<string>;
}): Promise<HonorCommitment | null> {
  const [config] = await tx.select().from(honorSeasons).where(eq(honorSeasons.seasonId, input.seasonId));
  if (!config) return null;
  if (config.legacySources.includes(`MONUMENT:${input.sourceId}`)) return null;
  const [row] = await tx.select().from(honorCommitments).where(and(eq(honorCommitments.seasonId, input.seasonId),
    eq(honorCommitments.source, 'MONUMENT'), eq(honorCommitments.sourceId, input.sourceId)));
  if (!row) {
    throw new Error('Missing Honor monument commitment');
  }
  const frozen = honorCommitmentSchema.parse(row.snapshot);
  if (frozen.version !== config.version) throw new Error('Conflicting Honor commitment version');
  const ids = [...new Set(input.defence)].sort();
  const changed = ids.length > 0 && !ids.some(id => frozen.defence.some(member => member.id === id));
  let exclusion: HonorCommitment['exclusion'] = changed ? 'TARGET_CHANGED' : frozen.exclusion;
  const at = changed ? input.at : new Date(frozen.at);
  const defence = [];
  const lateTimes = new Map<string, Date>();
  for (const id of ids) {
    const original = frozen.defence.find(member => member.id === id);
    if (original) defence.push(original);
    else {
      if (!changed && frozen.presentAtLaunch && !frozen.presentAtLaunch.includes(id)) {
        const late = await lateHonorReference(tx, input.seasonId, id, frozen, input.at);
        defence.push({ id, ...late.reference }); lateTimes.set(id, late.at); continue;
      }
      if (changed) await observeHonorOwner(tx, id, input.at);
      try {
        defence.push({ id, ...await honorOwnerReference(tx, input.seasonId, id, at, changed ? undefined : frozen.referenceOrder) });
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'Missing Honor reference history') throw error;
        const late = await lateHonorReference(tx, input.seasonId, id, frozen, input.at);
        defence.push({ id, ...late.reference });
        lateTimes.set(id, late.at);
        if (frozen.version !== HONOR_LAUNCH_VERSION) exclusion = 'PARTICIPANT_JOINED_LATE';
      }
    }
  }
  // Eligibility is judged on everyone together; a late joiner's own read only supplies
  // relations, because the joiner and the attack alone may include no person.
  const facts = await readHonorRelations(tx, { ...input, at: new Date(frozen.at), attack: frozen.attack.map(member => member.id), defence: ids });
  for (const [id, time] of lateTimes) {
    const joined = await readHonorRelations(tx, { ...input, at: time, attack: frozen.attack.map(row => row.id), defence: [id] });
    facts.relations = facts.relations.filter(row => row.b !== id).concat(joined.relations);
  }
  return { ...frozen, defence, selectedDefenders: frozen.selectedDefenders ?? frozen.defence.map(row => row.id),
    eligible: exclusion === undefined && frozen.eligible && facts.eligible,
    ...(exclusion ? { exclusion } : {}),
    relations: facts.relations.map(relation => frozen.relations.find(old => old.a === relation.a && old.b === relation.b) ?? relation) };
}
