import type { FaultKind } from '@astera/rules';

/** `SILENT_SPACE` is a lock, not a fault, and it is named first because no repair lifts it (D212). */
export type LaunchFault = 'SILENT_SPACE' | 'SHIPYARD_REVOLT' | 'PROSPECTOR_FAULT';

/** The known client-side reason a departure cannot leave this world. */
export function launchFault(
  faults: readonly { kind: FaultKind }[] | undefined,
  lane: 'fleet' | 'prospector',
  /** The origin world's `silentSpace`. Pass it only on the fight and farm lanes it closes. */
  silentSpace = false,
): LaunchFault | null {
  if (silentSpace) return 'SILENT_SPACE';
  // Mining applies this guard before the shared flight-bay guard on the server.
  if (lane === 'prospector' && faults?.some((fault) => fault.kind === 'PROSPECTOR_FAULT')) {
    return 'PROSPECTOR_FAULT';
  }
  return faults?.some((fault) => fault.kind === 'SHIPYARD_REVOLT')
    ? 'SHIPYARD_REVOLT'
    : null;
}
