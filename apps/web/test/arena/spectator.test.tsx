import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createPilot, createSandboxWorld } from '@astera/rules/arena';
import { SpectatorPanel } from '../../src/arena/SpectatorPanel.js';
import { createArenaNetwork } from '../../src/arena/network.js';
import { createHudStore } from '../../src/arena/store.js';
import { teamCopy } from '../../src/arena/teamCopy.js';
import { arenaCopy } from '../../src/arena/copy.js';

describe('the ended team member', () => {
  it('offers only living real ships from the same launch and changes viewpoint without relaunching', () => {
    const world = createSandboxWorld({ bots: 0 }); world.pilot.phase = 'dead';
    world.drones = [2, 3, 4, 5].map(id => createPilot(id));
    world.drones[1]!.phase = 'dead'; world.drones[3]!.decoyOf = 2;
    const network = createArenaNetwork(world, { sensitivity: 1, invertPitch: false }, () => undefined);
    vi.spyOn(network, 'getSnapshot').mockReturnValue({ ...network.getSnapshot(), phase: 'online' });
    network.names.set(2, 'Ada'); network.names.set(3, 'Bora'); network.names.set(4, 'Dışarıdan'); network.names.set(5, 'Kopya');
    for (const id of [2, 3, 5]) network.teamIds.set(id, 'team');
    const watch = vi.spyOn(network, 'watch'); const connect = vi.spyOn(network, 'connect'); const results = vi.fn();
    const store = createHudStore(); store.publish(world, 'flight', false, false);
    render(<SpectatorPanel world={world} network={network} store={store} teamId="team" watching={2} onResults={results} />);
    fireEvent.click(screen.getByRole('button', { name: /Ada/ }));
    expect(watch).toHaveBeenCalledWith(2); expect(connect).not.toHaveBeenCalled();
    for (const name of ['Bora', 'Dışarıdan', 'Kopya']) expect(screen.queryByRole('button', { name: new RegExp(name) })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: teamCopy().results })); expect(results).toHaveBeenCalledOnce();
    network.dispose();
  });
  it('names a lost connection, disables stale viewpoint commands and retries only as an observer', () => {
    const world = createSandboxWorld({ bots: 0 }); world.pilot.phase = 'dead'; world.drones = [createPilot(2)];
    const network = createArenaNetwork(world, { sensitivity: 1, invertPitch: false }, () => undefined);
    network.teamIds.set(2, 'team'); network.names.set(2, 'Ada');
    vi.spyOn(network, 'getSnapshot').mockReturnValue({ ...network.getSnapshot(), phase: 'failed', reason: 'connection' });
    const connect = vi.spyOn(network, 'connect').mockImplementation(() => undefined);
    render(<SpectatorPanel world={world} network={network} store={createHudStore()} teamId="team" watching={2} onResults={vi.fn()} />);
    expect(screen.getByText(arenaCopy().connectionFailed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ada/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: arenaCopy().reconnect }));
    expect(connect).toHaveBeenCalledWith(world.pilot.ship, world.pilot.tactic, true);
    network.dispose();
  });
});
