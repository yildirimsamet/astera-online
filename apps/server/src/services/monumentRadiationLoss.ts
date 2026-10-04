import { randomUUID } from 'node:crypto';
import type { MonumentShipLot } from '@astera/rules';
import type { Tx } from '../db/client.js';
import { publish } from '../stream/bus.js';
import { notify } from './notifications.js';

/** Only newly destroyed physical cohorts enter this function; the paid cursor prevents replay. */
export async function tellMonumentRadiationLoss(tx: Tx, target: { id: string; ordinal: number },
  wave: { id: string; playerId: string }, destroyed: readonly MonumentShipLot[], survivors: readonly MonumentShipLot[], at: Date) {
  if (destroyed.length === 0) return;
  await notify(tx, { playerId: wave.playerId, kind: 'radiation_lost', refId: randomUUID(), at,
    payload: { targetKind: 'MONUMENT', monumentId: target.id, monumentOrdinal: target.ordinal, waveId: wave.id,
      lost: destroyed.reduce((sum, lot) => sum + lot.count, 0), left: survivors.reduce((sum, lot) => sum + lot.count, 0),
      lostDeuterium: destroyed.reduce((sum, lot) => sum + lot.deuterium, 0) } });
  await publish(tx, wave.playerId, 'private:monument');
}
