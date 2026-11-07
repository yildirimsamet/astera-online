import { act, render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { UnlockMoment } from '../src/starter/UnlockMoment.js';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { wireVessel } from './starterVesselFixture.js';
const sound = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/sound.js', () => ({ playSound: sound }));
vi.mock('../src/starter/queries.js', () => ({ useMarkUnlockSeen: () => ({ mutate: vi.fn(), isPending: false }) }));
vi.mock('../src/ui/Toast.js', () => ({ useToast: () => vi.fn(), describe: () => '' }));
it('sounds an unlock once when the ship and the galaxy both host it', () => {
  const vessel = vesselSchema.parse(wireVessel({ unlockToAnnounce: 'production' }));
  render(<><UnlockMoment vessel={vessel} /><UnlockMoment vessel={vessel} /></>);
  expect(sound).toHaveBeenCalledOnce();
  expect(sound).toHaveBeenCalledWith('switch');
});

/** Owner playtest 2026-11-07: on the first look the "online" card stood under the NPC and confused. It waits its turn. */
it('waits, silent, while the tutorial holds it, and comes when the tutorial turns to it', async () => {
  const { holdUnlock } = await import('../src/starter/tutorial/unlockHold.js');
  sound.mockClear();
  const vessel = vesselSchema.parse(wireVessel({ id: 'held-ship', unlockToAnnounce: 'production' }));
  act(() => { holdUnlock(true); });
  const view = render(<UnlockMoment vessel={vessel} />);
  expect(view.queryByTestId('unlock-moment')).toBeNull();
  expect(sound).not.toHaveBeenCalled();
  act(() => { holdUnlock(false); });
  expect(view.getByTestId('unlock-moment')).toBeTruthy();
  expect(sound).toHaveBeenCalledWith('switch');
});
