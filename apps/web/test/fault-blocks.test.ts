import { describe, expect, it } from 'vitest';
import { launchFault } from '../src/lib/faults.js';

describe('colony fault launch blocks', () => {
  it('blocks every departure during a shipyard revolt', () => {
    expect(launchFault([{ kind: 'SHIPYARD_REVOLT' }], 'fleet')).toBe('SHIPYARD_REVOLT');
    expect(launchFault([{ kind: 'SHIPYARD_REVOLT' }], 'prospector')).toBe('SHIPYARD_REVOLT');
  });

  it('blocks only prospectors when their centre is down', () => {
    expect(launchFault([{ kind: 'PROSPECTOR_FAULT' }], 'prospector')).toBe('PROSPECTOR_FAULT');
    expect(launchFault([{ kind: 'PROSPECTOR_FAULT' }], 'fleet')).toBeNull();
  });

  it('reports the prospector fault first, matching the mining service guard', () => {
    expect(launchFault([
      { kind: 'SHIPYARD_REVOLT' },
      { kind: 'PROSPECTOR_FAULT' },
    ], 'prospector')).toBe('PROSPECTOR_FAULT');
  });
});
