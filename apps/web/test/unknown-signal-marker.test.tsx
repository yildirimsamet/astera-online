import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { UnknownSignalView } from '../src/api/schemas.js';
import { UnknownSignals } from '../src/galaxy/UnknownSignals.js';
import { prewarmStrategicBlast } from '../src/galaxy/StrategicBlast.js';

vi.mock('@react-three/drei', () => ({ Html: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('../src/lib/unknownSignal.js', () => ({ unknownSignalMarkerState: () => ({ phase: 'hidden', opacity: 0 }) }));
vi.mock('../src/galaxy/StrategicBlast.js', () => ({
  prewarmStrategicBlast: vi.fn(), StrategicBlast: () => <div data-testid="signal-pirate-blast" />,
}));
const now = Date.now();
const signal: UnknownSignalView = {
  id: '00000000-0000-4000-8000-000000000001', at: { x: 400, y: 0, z: 0 }, status: 'open',
  appearedAt: new Date(now), expiresAt: new Date(now + 3_600_000), originPlanetId: null, origin: null,
  fleet: null, damage: null, departAt: null, arriveAt: null, returnDepartAt: null, returnAt: null,
  recalledAt: null, outcome: null, deliveredAt: null, pirateFree: false,
};
beforeEach(() => { vi.clearAllMocks(); });

it('warms the existing explosion only after launch so a cold pirate reveal can render on time', () => {
  const props = { focusedId: null, onSelect: vi.fn() };
  const view = render(<UnknownSignals {...props} signals={[signal]} />);
  expect(prewarmStrategicBlast).not.toHaveBeenCalled();
  const outbound = { ...signal, status: 'outbound' as const, arriveAt: new Date(now + 60_000) };
  view.rerender(<UnknownSignals {...props} signals={[outbound]} />);
  expect(prewarmStrategicBlast).toHaveBeenCalledOnce();
  view.rerender(<UnknownSignals {...props} signals={[{ ...outbound }]} />);
  expect(prewarmStrategicBlast).toHaveBeenCalledOnce();
});
