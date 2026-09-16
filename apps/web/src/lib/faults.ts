import type { FaultKind } from '@astera/rules';

export type LaunchFault = 'SHIPYARD_REVOLT' | 'PROSPECTOR_FAULT';

/** The known client-side reason a departure cannot leave this world. */
export function launchFault(
  faults: readonly { kind: FaultKind }[] | undefined,
  lane: 'fleet' | 'prospector',
): LaunchFault | null {
  // Mining applies this guard before the shared flight-bay guard on the server.
  if (lane === 'prospector' && faults?.some((fault) => fault.kind === 'PROSPECTOR_FAULT')) {
    return 'PROSPECTOR_FAULT';
  }
  return faults?.some((fault) => fault.kind === 'SHIPYARD_REVOLT')
    ? 'SHIPYARD_REVOLT'
    : null;
}
