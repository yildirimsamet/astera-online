import { z } from 'zod';
import type { TransferReturnPlan } from '@astera/rules';

const KEY = 'astera.transfer-return.v1';
const choice = z.enum(['STAY', 'RETURN']);
const planSchema = z.object({ cargoShips: choice, otherShips: choice });

/** Device preference only; fleet, route and cargo never travel into storage. */
export function readTransferReturnPlan(): TransferReturnPlan {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      const plan = planSchema.safeParse(parsed);
      if (plan.success) return plan.data;
    }
  } catch {
    // A corrupt or blocked preference must not prevent a transfer.
  }
  return { cargoShips: 'RETURN', otherShips: 'STAY' };
}

export function rememberTransferReturnPlan(plan: TransferReturnPlan): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ cargoShips: plan.cargoShips, otherShips: plan.otherShips }));
  } catch {
    // The current sheet keeps working when the device cannot persist the choice.
  }
}
