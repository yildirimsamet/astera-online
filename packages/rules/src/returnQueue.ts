/**
 * Admission is FIFO among currently eligible applications. A temporary blocker
 * never changes seniority or removes an application. The server supplies current
 * eligibility under its admission lock, scoped to one target shard and cycle;
 * a lock timeout is not proof of ineligibility. Re-evaluate after every transfer.
 */
export function nextEligibleReturn<T extends { readonly sequence: bigint; readonly eligible: boolean }>(
  applications: readonly T[],
): T | null {
  let next: T | null = null;
  for (const application of applications) {
    if (application.eligible && (next === null || application.sequence < next.sequence)) {
      next = application;
    }
  }
  return next;
}
