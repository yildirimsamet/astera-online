import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App.js';
import { useSession } from '../src/session/useSession.js';

vi.mock('../src/session/useSession.js', () => ({ useSession: vi.fn(() => { throw new Error('simulator must not start a player session'); }) }));
vi.mock('../src/platform/updateGate.js', () => ({ useUpdateRequired: () => false }));
vi.mock('../src/battle-simulator/BattleSimulator.js', () => ({ BattleSimulator: () => <div>Independent simulator</div> }));
afterEach(() => { history.replaceState(null, '', '/'); });
describe('standalone simulator entry', () => {
  it('opens from its own URL without restoring a session or reading hidden player data', async () => {
    history.replaceState(null, '', '/?simulator=1');
    render(<App />);
    expect(await screen.findByText('Independent simulator')).toBeInTheDocument();
    expect(useSession).not.toHaveBeenCalled();
  });
});
