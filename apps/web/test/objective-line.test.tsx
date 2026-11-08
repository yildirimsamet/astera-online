import { REPAIR_LADDER } from '@astera/rules';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { StarterGoal } from '../src/starter/tutorial/visualGoal.js';
import { ObjectiveLine } from '../src/starter/ObjectiveLine.js';
import { wireVessel } from './starterVesselFixture.js';

afterEach(cleanup);

const first = REPAIR_LADDER.find(s => s.module === 'REFINERY' && s.stage === 2);

describe('the next-step line over the galaxy', () => {
  it('names the first repair, and a tap opens the ship', () => {
    const open = vi.fn();
    render(<ObjectiveLine vessel={vesselSchema.parse(wireVessel({ alloy: 10_000, crystal: 10_000 }))} fetchedAt={Date.now()} onOpenShip={open} />);
    const line = screen.getByTestId('ship-objective');
    expect(line.getAttribute('data-kind')).toBe('repair');
    expect(line.textContent).toContain('Next');
    fireEvent.click(line);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('says what the repair opens, in a word', () => {
    render(<ObjectiveLine vessel={vesselSchema.parse(wireVessel({ alloy: 10_000, crystal: 10_000, modules: { REFINERY: 2, EXTRACTOR: 1 }, progress: { modules: { REFINERY: 2, EXTRACTOR: 1 }, facts: [], parts: 0, fuel: 0 } }))} fetchedAt={Date.now()} onOpenShip={vi.fn()} />);
    expect(screen.getByTestId('ship-objective').textContent).toMatch(/opens probes/i);
  });

  it('says "that is all for now" and the time to come back, when the next step is a long way off', () => {
    const vessel = vesselSchema.parse(wireVessel({ alloy: 0, crystal: 10_000, bufferAlloy: 0 }));
    render(<ObjectiveLine vessel={vessel} fetchedAt={Date.now()} onOpenShip={vi.fn()} />);
    const line = screen.getByTestId('ship-objective');
    expect(line.getAttribute('data-rest')).toBe('');
    expect(line.textContent).toMatch(/that is all for now/i);
  });

  // Nobody to probe: the line must not send the player after a ship that is not there.
  it('asks for the first probe only when there is another ship to probe', () => {
    const probeReady = { alloy: 0, crystal: 0, bufferAlloy: 0, modules: { REFINERY: 2, EXTRACTOR: 1, SURVEY: 1 }, features: ['production', 'intel'] };
    render(<ObjectiveLine vessel={vesselSchema.parse(wireVessel(probeReady))} fetchedAt={Date.now()} onOpenShip={vi.fn()} />);
    expect(screen.getByTestId('ship-objective').getAttribute('data-kind')).toBe('probe');
    cleanup();
    render(<ObjectiveLine vessel={vesselSchema.parse(wireVessel(probeReady))} fetchedAt={Date.now()} onOpenShip={vi.fn()} alone />);
    expect(screen.getByTestId('ship-objective').getAttribute('data-kind')).not.toBe('probe');
  });

  it('is a mark the tutorial can point at', () => {
    render(<ObjectiveLine vessel={vesselSchema.parse(wireVessel({ alloy: 10_000, crystal: 10_000 }))} fetchedAt={Date.now()} onOpenShip={vi.fn()} />);
    expect(screen.getByTestId('ship-objective').getAttribute('data-guide')).toBe('objective');
  });

  it('points at the top bar when only the works can pay, and opens nothing', () => {
    expect(first).toBeDefined();
    const vessel = vesselSchema.parse(wireVessel({ alloy: (first?.alloy ?? 0) - 5, crystal: 10_000, bufferAlloy: 60 }));
    render(<ObjectiveLine vessel={vessel} fetchedAt={Date.now()} onOpenShip={vi.fn()} />);
    const line = screen.getByTestId('ship-objective');
    expect(line.getAttribute('data-kind')).toBe('collect');
    expect(line.tagName).not.toBe('BUTTON');
    expect(line.textContent).toContain('top bar');
  });
});

it('uses the officer road for both its short label and its destination, even when mining is already available', () => {
  const open = vi.fn(), rock = vi.fn();
  render(<StarterGoal.Provider value={{kind:'step',id:'orderExtractor3',step:'press',chapter:5,nav:'openShip',marks:['[data-guide="dock-base"]']}}>
    <ObjectiveLine vessel={vesselSchema.parse(wireVessel({modules:{REFINERY:3,EXTRACTOR:2,SURVEY:1,SHIPYARD:1},features:['production','intel','fleet']}))} fetchedAt={Date.now()} onOpenShip={open} onFocusRock={rock}/>
  </StarterGoal.Provider>);
  const line=screen.getByTestId('ship-objective');
  expect(line.textContent).toContain('Extractor');expect(line.textContent).not.toContain('Send a Prospector');
  fireEvent.click(line);expect(open).toHaveBeenCalledOnce();expect(rock).not.toHaveBeenCalled();
});
